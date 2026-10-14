/* Study Player Anywhere - page-world bridge (world:"MAIN", document_start).
   2.1 rewrite. Why the old build missed subtitles that plainly exist:
   - It started at document_idle, after most players had already fetched
     their caption file, so the fetch/XHR hooks never saw the request.
   - It only recognised URLs ending in .vtt/.srt/.ass. Many players fetch
     captions from tokenised URLs with no extension, and YouTube fetches
     from /api/timedtext?...&pot=... which also has no extension.
   - On YouTube it trusted only the static captionTracks baseUrl from the
     first player response. Since 2024 that baseUrl returns an empty body
     unless the request carries the player's own pot token. The URL the
     player itself requests (captured below) carries it and works.
   Fixes: hooks installed at document_start, a PerformanceObserver plus a
   periodic performance-timeline scan (catches fetches that predate the
   hooks), body sniffing of responses (WEBVTT / timestamp arrows /
   timedtext JSON/XML), YouTube track extraction from every known source
   including the raw page HTML, and a force-CC path that asks the YouTube
   player to load the Japanese track so its own timedtext request can be
   captured. No DOM <script> injection anywhere, so Trusted Types CSP
   cannot wedge this. */
(function () {
  "use strict";
  if (window.__spBridge) return;
  window.__spBridge = true;
  var lastVideoId = "", unavailableVideoId = "", ytSentFor = "";
  var sentSubUrls = {}, sentSubTexts = {}, forcedLangs = {};

  function isYouTube() { return /(^|\.)youtube\.com$/.test(location.hostname); }
  function getVideoId() {
    try { return new URL(location.href).searchParams.get("v") || ""; }
    catch (e) { return ""; }
  }

  /* ---------- generic subtitle discovery ---------- */
  var SUB_EXT = /\.(vtt|srt|ass|ssa|ttml|xml)([?#]|$)/i;
  function looksSubtitleUrl(url, ctype) {
    if (!url) return false;
    if (SUB_EXT.test(url)) return true;
    if (/\.m3u8([?#]|$)/i.test(url)) return true;
    if (/timedtext/i.test(url)) return true;
    if (/[?&](fmt=(json3|srv3|vtt|ttml)|type=track|kind=captions)/i.test(url)) return true;
    if (/(subtitle|caption|closedcaption)/i.test(url) && !/\.(js|css|png|jpg|svg|woff2?|html?)([?#]|$)/i.test(url)) return true;
    if (ctype && /text\/vtt|application\/.*(subtitle|caption)|text\/xml.*caption/i.test(ctype)) return true;
    return false;
  }
  function looksCaptionBody(text) {
    if (!text || text.length < 8) return false;
    var head = text.slice(0, 600);
    if (/WEBVTT/.test(head)) return true;
    if (/#EXTM3U/.test(head) && (/TYPE=SUBTITLES/i.test(text.slice(0, 4000)) || /\.vtt([?#\s]|$)/im.test(text.slice(0, 4000)))) return true;
    if (/^\s*<\?xml[\s\S]{0,400}<transcript[\s>]/i.test(text.slice(0, 900))) return true;
    // v2.3.4: YouTube sends wireMagic as lowercase "pbj1", not "PBJ".
    // The old uppercase-only sniff silently dropped every timedtext body.
    if (/"wireMagic"\s*:\s*"pbj/i.test(head) || /"events"\s*:\s*\[[\s\S]{0,200}"tStartMs"/.test(head)) return true;
    if (/\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}\s*-->/.test(text.slice(0, 4000))) return true;
    if (/^Dialogue:/m.test(text.slice(0, 4000))) return true;
    if (/^\[Script Info\]/m.test(head)) return true;
    return false;
  }
  function emitUrl(url) {
    if (!url || sentSubUrls[url]) return;
    sentSubUrls[url] = 1;
    window.postMessage({ type: "SP_GENERIC_SUB_URL", url: url }, "*");
  }
  function emitText(url, text) {
    if (!looksCaptionBody(text)) return;
    var key = (url || location.href) + "|" + text.length;
    if (sentSubTexts[key]) return;
    sentSubTexts[key] = 1;
    if (text.length < 2500000) window.postMessage({ type: "SP_GENERIC_SUB_TEXT", url: url || location.href, text: text }, "*");
    else if (url) emitUrl(url);
  }
  function noteResource(url, ctype) {
    if (!url) return;
    var full = url;
    try { full = new URL(url, location.href).href; } catch (e) {}
    if (looksSubtitleUrl(full, ctype || "")) emitUrl(full);
  }
  function scanPageForSubUrls() {
    try {
      document.querySelectorAll("track[src]").forEach(function (t) { noteResource(t.src, ""); });
      document.querySelectorAll("a[href]").forEach(function (a) { if (SUB_EXT.test(a.href) || /timedtext/i.test(a.href)) noteResource(a.href, ""); });
      var html = document.documentElement ? document.documentElement.innerHTML : "";
      var re = /https?:\/\/[^\s"'<>\\]+?\.(?:vtt|srt|ass|ttml)(?:\?[^\s"'<>\\]*)?/gi, m;
      while ((m = re.exec(html))) noteResource(m[0], "");
      var re2 = /https?:\/\/[^\s"'<>\\]*timedtext[^\s"'<>\\]*/gi;
      while ((m = re2.exec(html))) noteResource(m[0].replace(/\\u0026/g, "&"), "");
    } catch (e) {}
  }
  function scanPerformance() {
    try {
      var entries = performance.getEntriesByType("resource") || [];
      for (var i = 0; i < entries.length; i++) noteResource(entries[i].name, "");
    } catch (e) {}
  }
  try {
    var po = new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (en) { noteResource(en.name, ""); });
    });
    po.observe({ entryTypes: ["resource"] });
  } catch (e) {}

  /* fetch / XHR hooks (installed at document_start, before players boot) */
  try {
    var origFetch = window.fetch;
    if (origFetch) {
      window.fetch = function () {
        var args = arguments, url = "";
        try { url = typeof args[0] === "string" ? args[0] : (args[0] && args[0].url) || ""; } catch (e) {}
        return origFetch.apply(this, args).then(function (resp) {
          try {
            var full = new URL(url, location.href).href;
            var ctype = resp.headers && resp.headers.get ? resp.headers.get("content-type") || "" : "";
            var interesting = looksSubtitleUrl(full, ctype);
            var isTimed = /timedtext/i.test(full);
            if (interesting || isTimed) {
              emitUrl(full);
              resp.clone().text().then(function (t) { emitText(full, t); }).catch(function () {});
            } else if (/subtitle|caption/i.test(full)) {
              resp.clone().text().then(function (t) { emitText(full, t); }).catch(function () {});
            }
          } catch (e) {}
          return resp;
        });
      };
    }
  } catch (e) {}
  try {
    var origOpen = XMLHttpRequest.prototype.open, origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) { this.__spUrl = url; return origOpen.apply(this, arguments); };
    XMLHttpRequest.prototype.send = function () {
      var xhr = this;
      this.addEventListener("load", function () {
        try {
          var url = new URL(xhr.__spUrl || "", location.href).href;
          var ctype = xhr.getResponseHeader ? xhr.getResponseHeader("content-type") || "" : "";
          if (typeof xhr.responseText === "string" && xhr.responseText) {
            if (looksSubtitleUrl(url, ctype) || looksCaptionBody(xhr.responseText)) { emitUrl(url); emitText(url, xhr.responseText); }
          }
        } catch (e) {}
      });
      return origSend.apply(this, arguments);
    };
  } catch (e) {}

  /* ---------- YouTube track extraction ---------- */
  function coerceResponse(r) {
    if (!r) return null;
    if (typeof r === "string") { try { return JSON.parse(r); } catch (e) { return null; } }
    return r;
  }
  function normaliseTracks(tracks) {
    return (tracks || []).map(function (t) {
      return {
        baseUrl: t.baseUrl || "",
        languageCode: t.languageCode || "",
        kind: t.kind || "",
        name: (t.name && (t.name.simpleText || ((t.name.runs || []).map(function (r) { return r.text; }).join("")))) || t.languageCode || ""
      };
    }).filter(function (t) { return t.baseUrl && t.languageCode; });
  }
  function tracksFromResponse(resp) {
    resp = coerceResponse(resp);
    if (!resp || !resp.captions || !resp.captions.playerCaptionsTracklistRenderer) return null;
    var t = normaliseTracks(resp.captions.playerCaptionsTracklistRenderer.captionTracks);
    return t.length ? t : null;
  }
  function tracksFromHtml() {
    try {
      var html = document.documentElement.innerHTML;
      var idx = html.indexOf('"captionTracks"');
      if (idx === -1) return null;
      var slice = html.slice(idx, idx + 20000);
      var m = slice.match(/"baseUrl"\s*:\s*"([^"]+)"/g);
      if (!m) return null;
      var out = [], seen = {};
      var re = /"baseUrl"\s*:\s*"((?:[^"\\]|\\.)*)"[\s\S]{0,300}?"languageCode"\s*:\s*"([^"]+)"/g, mm;
      while ((mm = re.exec(slice))) {
        var bu = mm[1].replace(/\\u0026/g, "&").replace(/\\\//g, "/");
        if (seen[bu]) continue; seen[bu] = 1;
        out.push({ baseUrl: bu, languageCode: mm[2], kind: /"kind"\s*:\s*"asr"/.test(slice.slice(mm.index, mm.index + 500)) ? "asr" : "", name: mm[2] });
      }
      return out.length ? out : null;
    } catch (e) { return null; }
  }
  function candidateResponses() {
    var out = [];
    try {
      var player = document.querySelector("#movie_player");
      if (player && typeof player.getPlayerResponse === "function") out.push(player.getPlayerResponse());
    } catch (e) {}
    try {
      var flexy = document.querySelector("ytd-watch-flexy");
      if (flexy) { if (flexy.playerResponse) out.push(flexy.playerResponse); if (flexy.playerData) out.push(flexy.playerData); }
    } catch (e) {}
    try { if (window.ytInitialPlayerResponse) out.push(window.ytInitialPlayerResponse); } catch (e) {}
    try {
      if (window.ytplayer && ytplayer.config && ytplayer.config.args) out.push(ytplayer.config.args.player_response);
    } catch (e) {}
    return out;
  }
  function readTracks() {
    var resps = candidateResponses();
    for (var i = 0; i < resps.length; i++) { var t = tracksFromResponse(resps[i]); if (t) return t; }
    return tracksFromHtml();
  }
  function sendYT() {
    var vid = getVideoId(); if (!vid) return false;
    var tracks = readTracks(); if (!tracks) return false;
    window.postMessage({ type: "SP_CAPTION_TRACKS", videoId: vid, tracks: tracks }, "*");
    lastVideoId = vid; ytSentFor = vid; unavailableVideoId = "";
    return true;
  }
  function sendUnavailable() {
    var vid = getVideoId(); if (!vid || unavailableVideoId === vid) return;
    unavailableVideoId = vid;
    window.postMessage({ type: "SP_CAPTION_UNAVAILABLE", videoId: vid, reason: "no-player-response" }, "*");
  }
  function sendWhenReady(attempt) {
    if (isYouTube() && sendYT()) return;
    if (attempt < 30) setTimeout(function () { sendWhenReady(attempt + 1); }, 500);
    else if (isYouTube()) sendUnavailable();
  }
  function forceYouTubeCC(lang) {
    if (!isYouTube() || forcedLangs[lang]) return;
    try {
      var player = document.querySelector("#movie_player");
      if (!player) return;
      forcedLangs[lang] = 1;
      try { if (typeof player.loadModule === "function") player.loadModule("captions"); } catch (e) {}
      try { if (typeof player.setOption === "function") player.setOption("captions", "track", { languageCode: lang }); } catch (e) {}
      try { if (typeof player.setOption === "function") player.setOption("captions", "reload", true); } catch (e) {}
      setTimeout(function () { forcedLangs[lang] = 0; }, 20000);
    } catch (e) {}
  }
  window.addEventListener("message", function (ev) {
    if (ev.source !== window || !ev.data) return;
    if (ev.data.type === "SP_FORCE_YT_CC") forceYouTubeCC(ev.data.lang || "ja");
    if (ev.data.type === "SP_REQUEST_TRACKS") sendWhenReady(0);
  });

  if (isYouTube()) {
    document.addEventListener("yt-navigate-finish", function () {
      lastVideoId = ""; ytSentFor = ""; unavailableVideoId = ""; forcedLangs = {}; sentSubTexts = {};
      setTimeout(function () { sendWhenReady(0); scanPerformance(); scanPageForSubUrls(); }, 350);
    });
    window.addEventListener("yt-page-data-updated", function () { setTimeout(function () { sendWhenReady(0); }, 350); });
  }
  var lastHref = location.href;
  setInterval(function () {
    if (location.href !== lastHref) {
      lastHref = location.href; lastVideoId = ""; ytSentFor = ""; unavailableVideoId = "";
      setTimeout(function () { sendWhenReady(0); scanPerformance(); }, 350);
    } else if (isYouTube()) {
      var vid = getVideoId();
      if (vid && vid !== ytSentFor) sendWhenReady(0);
    }
    scanPerformance();
    scanPageForSubUrls();
  }, 2000);
  sendWhenReady(0);
  setTimeout(function () { scanPerformance(); scanPageForSubUrls(); }, 800);
  setTimeout(function () { scanPerformance(); scanPageForSubUrls(); }, 3000);
})();
