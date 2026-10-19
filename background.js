/* Study Player Anywhere background worker.
   2.1: fetch proxy. Content scripts run in the page origin, so a direct
   fetch to a subtitle CDN is CORS-blocked even with host_permissions.
   Routing the subtitle download through the service worker uses the
   extension origin and the declared host_permissions, so cross-origin
   .vtt/.srt/.ass and YouTube timedtext files actually come back. */
/* Fork: On/Off switch (storage key sp_active, off by default). The content
   scripts are registered only while it is on, so nothing at all runs on
   pages when it is off. Firefox clears registered scripts when the
   extension updates, hence the re-sync on install/update and startup. */
var SP_SCRIPT_IDS = ["sp-bridge", "sp-main"];
var SP_SCRIPTS = [
  { id: "sp-bridge", matches: ["<all_urls>"], js: ["injected.js"], runAt: "document_start", allFrames: true, world: "MAIN" },
  { id: "sp-main", matches: ["<all_urls>"], js: ["lib/kuromoji.js", "lib/token-refiner.js", "content.js"], css: ["content.css"], runAt: "document_idle", allFrames: true }
];
var spQueue = Promise.resolve();
function spApply(active) {
  spQueue = spQueue.then(function () {
    try {
      chrome.action.setBadgeText({ text: active ? "ON" : "" });
      chrome.action.setBadgeBackgroundColor({ color: "#e44a2a" });
    } catch (e) {}
    return chrome.scripting.getRegisteredContentScripts({ ids: SP_SCRIPT_IDS }).then(function (regs) {
      var ids = (regs || []).map(function (r) { return r.id; });
      return ids.length ? chrome.scripting.unregisterContentScripts({ ids: ids }) : null;
    }).then(function () {
      if (active) return chrome.scripting.registerContentScripts(SP_SCRIPTS);
    });
  }).catch(function (e) { console.warn("[Study Player] content script registration failed", e); });
  return spQueue;
}
function spSync() {
  chrome.storage.local.get(["sp_active"], function (res) { spApply(!!(res && res.sp_active === true)); });
}
chrome.runtime.onStartup.addListener(spSync);
chrome.storage.onChanged.addListener(function (changes, area) {
  if (area === "local" && changes.sp_active) spApply(changes.sp_active.newValue === true);
});

chrome.runtime.onInstalled.addListener(function (details) {
  spSync();
  chrome.storage.local.get(["sp_settings"], function (res) {
    if (!res.sp_settings) {
      chrome.storage.local.set({
        sp_settings: { enabled: true, furigana: true, translation: true }
      });
    }
  });
  if (details.reason === "install") {
    console.log("[Study Player] Installed. Open any page with a video player, press play, then use Subs or Load sub on the video.");
  }
});

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg && msg.type === "SP_ANKI_ADD" && msg.payload) {
    // v2.6.2: AnkiConnect POSTs go through the service worker because a
    // page's Content-Security-Policy can block a content script's direct
    // fetch() to localhost (Crunchyroll does), which made Send to Anki
    // fail with "not reachable" even with Anki open and AnkiConnect up.
    // The target is hardcoded to AnkiConnect's loopback address; only the
    // JSON-RPC payload comes from the page.
    fetch("http://127.0.0.1:8765", {
      method: "POST",
      body: JSON.stringify(msg.payload)
    }).then(function (r) {
      return r.json().then(function (j) { sendResponse({ ok: true, data: j }); });
    }).catch(function (e) {
      sendResponse({ ok: false, error: String(e && e.message || e) });
    });
    return true; // async sendResponse
  }
  if (msg && msg.type === "SP_MINER_SHOT") {
    // v2.4.0 sentence miner: capture the visible tab as the card image.
    // Covered by the existing activeTab + <all_urls> host permissions;
    // no new permissions needed.
    try {
      chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 70 }, function (dataUrl) {
        if (chrome.runtime.lastError) sendResponse({ ok: false, error: String(chrome.runtime.lastError.message || chrome.runtime.lastError) });
        else sendResponse({ ok: !!dataUrl, dataUrl: dataUrl || "" });
      });
    } catch (e) { sendResponse({ ok: false, error: String(e && e.message || e) }); }
    return true; // async sendResponse
  }
  if (!msg || msg.type !== "SP_FETCH_TEXT" || !msg.url) return false;
  var url = String(msg.url);
  // Only http(s) subtitle fetches are proxied.
  if (!/^https?:\/\//i.test(url)) { sendResponse({ ok: false, error: "bad url" }); return false; }
  fetch(url, { credentials: "include", redirect: "follow" }).then(function (r) {
    return r.text().then(function (t) {
      sendResponse({ ok: r.ok, status: r.status, text: t, finalUrl: r.url || url });
    });
  }).catch(function (e) {
    sendResponse({ ok: false, error: String(e && e.message || e) });
  });
  return true; // async sendResponse
});
