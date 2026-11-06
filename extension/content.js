// Mounts the Popcorn overlay inside YouTube's player (so it survives fullscreen),
// follows YouTube's in-page navigation, and handles regular videos and Shorts.
(() => {
  let ui = null;
  let curId = null;
  let curPlayer = null;
  let poll = null;
  let settings = { auto_research_after: 0 };
  let watched = 0;      // seconds actually played on an unresearched video
  let lastT = null;
  let state = "none";

  const send = (m) => new Promise((res) => {
    try {
      chrome.runtime.sendMessage(m, (r) => {
        const err = chrome.runtime.lastError && chrome.runtime.lastError.message;
        res(r || { ok: false, error: err || "no reply", stale: /context invalidated/i.test(err || "") });
      });
    } catch (e) {
      res({ ok: false, error: String(e), stale: true }); // extension was updated under this tab
    }
  });

  function where() {
    const u = new URL(location.href);
    if (u.pathname === "/watch") {
      return { id: u.searchParams.get("v"), player: document.querySelector("#movie_player") };
    }
    const m = u.pathname.match(/^\/shorts\/([\w-]{11})/);
    if (m) {
      const active = document.querySelector("ytd-reel-video-renderer[is-active] #shorts-player")
        || document.querySelector("#shorts-player");
      return { id: m[1], player: active };
    }
    return { id: null, player: null };
  }
  const video = () => (curPlayer ? curPlayer.querySelector("video") : null);

  function teardown() {
    clearTimeout(poll);
    poll = null;
    if (ui) ui.destroy();
    ui = null;
    curPlayer = null;
    watched = 0;
    lastT = null;
    state = "loading"; // nothing auto-starts until we know what the server has
  }

  async function load(id) {
    clearTimeout(poll);
    const r = await send({ type: "facts", id });
    if (id !== curId || !ui) return;
    if (!r.ok) {
      ui.setStatus({ state: r.stale ? "stale" : "offline" });
      return;
    }
    const d = r.data;
    state = (d.status && d.status.state) || "none";
    if (d.facts && d.facts.length) ui.setFacts(d);
    if (!d.facts || !d.facts.length || state === "researching") ui.setStatus(d.status);
    if (state === "researching") poll = setTimeout(() => load(id), 4000);
  }

  async function research(id, force = false) {
    if (!ui || id !== curId) return;
    state = "researching";
    ui.setStatus({ state: "researching", step: "Starting" });
    const r = await send({ type: "research", url: `https://www.youtube.com/watch?v=${id}`, force });
    if (!ui || id !== curId) return;
    if (!r.ok) { ui.setStatus({ state: r.stale ? "stale" : "offline" }); return; }
    if (r.data && r.data.state === "error") { state = "error"; ui.setStatus(r.data); return; }
    load(id);
  }

  // Auto-research: only after real watching, so a video you bail on costs nothing.
  function autoTick() {
    if (!ui || state !== "none" || !settings.auto_research_after) return;
    const v = video();
    if (!v || v.paused || (curPlayer && curPlayer.classList.contains("ad-showing"))) { lastT = null; return; }
    if (lastT != null && v.currentTime > lastT && v.currentTime - lastT < 3) watched += v.currentTime - lastT;
    lastT = v.currentTime;
    if (watched >= settings.auto_research_after) research(curId);
  }

  function check() {
    const { id, player } = where();
    if (id === curId && player === curPlayer && (ui || !id)) return;
    teardown();
    curId = id;
    if (!id) return;
    if (!player) { curId = null; return; } // player not built yet; next tick retries
    curPlayer = player;
    ui = window.Popcorn.create(player, {
      getTime: () => (video() ? video().currentTime : null),
      seek: (t) => { if (video()) video().currentTime = t; },
      isAd: () => player.classList.contains("ad-showing"),
      onResearch: (force) => research(id, force),
      onRetry: () => load(id),
    });
    load(id);
  }

  send({ type: "settings" }).then((r) => { if (r.ok) settings = r.data; });
  document.addEventListener("yt-navigate-finish", check);
  setInterval(check, 1000);
  setInterval(autoTick, 1000);
  check();
})();
