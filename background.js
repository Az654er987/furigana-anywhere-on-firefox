/* Study Player Anywhere background worker.
   2.1: fetch proxy. Content scripts run in the page origin, so a direct
   fetch to a subtitle CDN is CORS-blocked even with host_permissions.
   Routing the subtitle download through the service worker uses the
   extension origin and the declared host_permissions, so cross-origin
   .vtt/.srt/.ass and YouTube timedtext files actually come back. */
chrome.runtime.onInstalled.addListener(function (details) {
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
