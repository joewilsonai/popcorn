/* Popcorn overlay: pops timed facts over any video container.
 * Shared by the Chrome extension (youtube.com) and the companion page.
 *
 *   const ui = Popcorn.create(container, { getTime, seek, isAd, onResearch });
 *   ui.setFacts(doc)     // {title, facts:[{t, kind, headline, body, source}]}
 *   ui.setStatus(st)     // {state: none|researching|error|offline, step}
 */
(function () {
  if (window.Popcorn) return;

  const MAX_VISIBLE = 2;
  const showFor = (f) => Math.max(7, Math.min(14, 3.5 + (f.headline.length + f.body.length) / 22));
  const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  const host = (u) => {
    try {
      const h = new URL(u).hostname.replace(/^www\./, "");
      return h.endsWith("vertexaisearch.cloud.google.com") ? "source (via Google)" : h;
    } catch { return ""; }
  };
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  function create(container, opts) {
    const root = el("div", "pc-root");
    const stack = el("div", "pc-stack");
    const pill = el("button", "pc-pill");
    const panel = el("div", "pc-panel pc-hidden");
    root.append(pill, stack, panel);
    container.appendChild(root);

    let facts = [];
    let enabled = true;
    let status = { state: "none" };
    const live = new Map(); // index -> bubble element

    pill.addEventListener("click", (e) => {
      e.stopPropagation();
      if (facts.length) {
        panel.classList.toggle("pc-hidden");
      } else if (status.state === "stale") {
        location.reload();
      } else if (status.state === "none" || status.state === "error") {
        opts.onResearch && opts.onResearch();
      } else if (status.state === "offline") {
        opts.onRetry && opts.onRetry();
      }
    });
    // Keep clicks inside our UI from pausing the video underneath.
    for (const n of [pill, panel]) {
      n.addEventListener("mousedown", (e) => e.stopPropagation());
      n.addEventListener("dblclick", (e) => e.stopPropagation());
    }

    // Shorts and small players get a full-width stack instead of a corner column.
    // Text scales with the player: ~15px on a small player, up to ~28px fullscreen on a big screen.
    const sizer = new ResizeObserver(() => {
      // Shorts sit in a wider box than the picture, so size to the video when it's narrower.
      const vid = container.querySelector("video");
      const vw = vid ? vid.getBoundingClientRect().width : 0;
      const w = Math.min(container.clientWidth || 640, vw > 50 ? vw : Infinity);
      root.classList.toggle("pc-narrow", w < 560);
      const px = w < 560 ? Math.max(13, w / 30) : Math.min(28, Math.max(15, w / 50));
      root.style.fontSize = `${px.toFixed(1)}px`;
    });
    sizer.observe(container);

    function renderPill() {
      pill.classList.remove("pc-busy", "pc-off", "pc-warn");
      pill.title = "";
      const st = status.state;
      if (facts.length) {
        const more = st === "researching" ? " · digging for more" : "";
        pill.textContent = enabled ? `🍿 ${facts.length}${more}` : `🍿 off`;
        pill.title = "Popcorn facts: click for the list";
        if (!enabled) pill.classList.add("pc-off");
        if (more) pill.classList.add("pc-busy");
        return;
      }
      if (st === "researching") {
        pill.textContent = `🍿 ${status.step || "Starting"}…`;
        pill.classList.add("pc-busy");
      } else if (st === "error") {
        pill.textContent = "🍿 That one failed. Try again";
        pill.title = status.step || "";
        pill.classList.add("pc-warn");
      } else if (st === "offline") {
        pill.textContent = "🍿 Popcorn server is off";
        pill.title = "Run ./install.sh again, or: popcorn.py doctor";
        pill.classList.add("pc-warn");
      } else if (st === "stale") {
        pill.textContent = "🍿 Popcorn updated: refresh this tab";
        pill.classList.add("pc-warn");
      } else {
        pill.textContent = "🍿 Pop facts for this";
        pill.title = "Research this video and pop facts while it plays";
      }
    }

    function renderPanel() {
      panel.replaceChildren();
      const head = el("div", "pc-panel-head");
      const toggle = el("button", "pc-toggle", enabled ? "Pause popups" : "Resume popups");
      toggle.addEventListener("click", () => { enabled = !enabled; clearAll(); renderPill(); renderPanel(); });
      const redo = el("button", "pc-toggle", "Research again");
      redo.addEventListener("click", () => { panel.classList.add("pc-hidden"); opts.onResearch && opts.onResearch(true); });
      const btns = el("span", "pc-btns");
      btns.append(redo, toggle);
      head.append(el("span", "pc-panel-title", `${facts.length} facts`), btns);
      panel.append(head);
      const list = el("div", "pc-list");
      facts.forEach((f) => {
        const row = el("button", "pc-row");
        row.append(el("span", "pc-row-t", mmss(f.t)), el("span", "pc-row-h", f.headline || f.body.slice(0, 60)));
        row.addEventListener("click", () => { opts.seek && opts.seek(Math.max(0, f.t - 1)); panel.classList.add("pc-hidden"); });
        list.append(row);
      });
      panel.append(list);
    }

    function bubble(f) {
      const b = el("div", "pc-bubble");
      b.dataset.kind = f.kind || "fact";
      const top = el("div", "pc-top");
      top.append(el("span", "pc-kind", f.kind || "fact"), el("span", "pc-t", mmss(f.t)));
      b.append(top);
      if (f.headline) b.append(el("div", "pc-head", f.headline));
      b.append(el("div", "pc-body", f.body));
      if (f.source) {
        const a = el("a", "pc-src", host(f.source) || "source");
        a.href = f.source; a.target = "_blank"; a.rel = "noopener noreferrer";
        b.append(a);
      }
      const bar = el("div", "pc-bar");
      bar.append(el("div", "pc-bar-fill"));
      b.append(bar);
      b.addEventListener("mousedown", (e) => e.stopPropagation());
      return b;
    }

    function removeBubble(i) {
      const b = live.get(i);
      if (!b) return;
      live.delete(i);
      b.classList.add("pc-out");
      setTimeout(() => b.remove(), 260);
    }
    function clearAll() { for (const i of [...live.keys()]) removeBubble(i); }

    function tick() {
      if (!enabled || !facts.length) return;
      if (opts.isAd && opts.isAd()) { clearAll(); return; }
      const now = opts.getTime();
      if (now == null || isNaN(now)) return;
      const active = [];
      facts.forEach((f, i) => { if (now >= f.t && now < f.t + showFor(f)) active.push(i); });
      const keep = new Set(active.slice(-MAX_VISIBLE));
      for (const i of [...live.keys()]) if (!keep.has(i)) removeBubble(i);
      for (const i of keep) {
        const f = facts[i];
        let b = live.get(i);
        if (!b) {
          b = bubble(f);
          live.set(i, b);
          stack.appendChild(b);
        }
        const left = 1 - (now - f.t) / showFor(f);
        b.querySelector(".pc-bar-fill").style.transform = `scaleX(${Math.max(0, left)})`;
      }
    }
    const timer = setInterval(tick, 200);
    renderPill();

    return {
      setFacts(doc) {
        const next = (doc.facts || []).slice().sort((a, b) => a.t - b.t);
        const same = JSON.stringify(next) === JSON.stringify(facts);
        facts = next;
        status = doc.status || { state: "done" };
        if (!same) { clearAll(); renderPanel(); }
        renderPill(); tick();
      },
      setStatus(st) {
        status = st || { state: "none" };
        // Partial facts stay on screen while research keeps going.
        if (!["done", "researching"].includes(status.state)) {
          facts = []; clearAll(); panel.classList.add("pc-hidden");
        }
        renderPill();
      },
      destroy() { clearInterval(timer); sizer.disconnect(); root.remove(); },
    };
  }

  window.Popcorn = { create };
})();
