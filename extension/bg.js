// Talks to the local Popcorn server (youtube.com itself is not allowed to reach localhost),
// and reloads the extension by itself when its files change on disk (git pull, updates).
const BASE = "http://127.0.0.1:8931";

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  let req;
  if (msg.type === "facts") {
    req = fetch(`${BASE}/api/facts/${encodeURIComponent(msg.id)}`);
  } else if (msg.type === "settings") {
    req = fetch(`${BASE}/api/settings`);
  } else if (msg.type === "research") {
    req = fetch(`${BASE}/api/research`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: msg.url, force: !!msg.force }),
    });
  } else {
    return false;
  }
  req.then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `server said ${r.status}`);
    return data;
  })
    .then((data) => reply({ ok: true, data }))
    .catch((e) => reply({ ok: false, error: String(e) }));
  return true; // async reply
});

async function checkForUpdate() {
  try {
    // Only a "Load unpacked" copy follows the files on disk. A Chrome Web Store copy updates
    // through the store, and its files never match the server's, so it must not reload itself.
    const self = await chrome.management.getSelf();
    if (self.installType !== "development") return;
    const r = await fetch(`${BASE}/api/ext-version`);
    if (!r.ok) return;
    const { version } = await r.json();
    if (!version) return;
    const { loaded } = await chrome.storage.local.get("loaded");
    if (!loaded) {
      await chrome.storage.local.set({ loaded: version });
    } else if (loaded !== version) {
      await chrome.storage.local.set({ loaded: version });
      chrome.runtime.reload();
    }
  } catch (_) { /* server off; try again next time */ }
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.remove("loaded");
  checkForUpdate();
});
chrome.alarms.create("popcorn-update", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === "popcorn-update") checkForUpdate(); });
