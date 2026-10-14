(function () {
  "use strict";
  if (window.__spBooted) return;
  window.__spBooted = true;

  var GLOSSARY = {
    "\u79c1":"I; me (neutral)","\u4ffa":"I; me (casual, masculine)","\u50d5":"I; me (usually masculine)","\u541b":"you; someone familiar","\u3042\u306a\u305f":"you",
    "\u4eca\u65e5":"today","\u660e\u65e5":"tomorrow","\u6628\u65e5":"yesterday","\u4eca":"now","\u6642\u9593":"time; hour","\u4eba":"person","\u4f55":"what","\u8ab0":"who",
    "\u5927\u4e08\u592b":"all right; okay; safe","\u672c\u5f53":"truth; really","\u597d\u304d":"liked; fond of","\u5acc\u3044":"disliked; to dislike","\u4e00\u7dd2":"together",
    "\u884c\u304f":"to go","\u6765\u308b":"to come","\u5e30\u308b":"to return; go home","\u898b\u308b":"to see; watch","\u805e\u304f":"to hear; ask","\u8a00\u3046":"to say","\u8a71\u3059":"to speak; talk",
    "\u601d\u3046":"to think; feel","\u77e5\u308b":"to know; find out","\u5206\u304b\u308b":"to understand","\u98df\u3079\u308b":"to eat","\u98f2\u3080":"to drink","\u3059\u308b":"to do","\u3042\u308b":"to exist (inanimate); to have",
    "\u3044\u308b":"to exist (animate); to be","\u3067\u304d\u308b":"can do; be able to","\u5f85\u3064":"to wait","\u9811\u5f35\u308b":"to do one's best; persist","\u3054\u3081\u3093":"sorry","\u3042\u308a\u304c\u3068\u3046":"thank you",
    "\u304a\u9858\u3044":"request; please","\u5148\u751f":"teacher; instructor","\u5b66\u6821":"school","\u5bb6":"house; home","\u53cb\u9054":"friend","\u6c17\u6301\u3061":"feeling","\u5fc3":"heart; mind","\u5922":"dream",
    "\u3059\u3054\u3044":"amazing; impressive","\u53ef\u611b\u3044":"cute","\u304b\u308f\u3044\u3044":"cute","\u5f37\u3044":"strong","\u5f31\u3044":"weak","\u6016\u3044":"scary; afraid","\u697d\u3057\u3044":"fun; enjoyable",
    "\u5b09\u3057\u3044":"happy; glad","\u60b2\u3057\u3044":"sad","\u65e9\u3044":"early; fast","\u9045\u3044":"late; slow","\u826f\u3044":"good","\u60aa\u3044":"bad","\u540d\u524d":"name","\u7d04\u675f":"promise",
    "\u79d8\u5bc6":"secret","\u5834\u6240":"place","\u4e16\u754c":"world","\u529b":"power; strength","\u554f\u984c":"problem; question","\u7406\u7531":"reason","\u5927\u5207":"important; precious","\u5fc5\u8981":"necessary; needed"
  };

  var state = {
    enabled: true, furigana: true, translation: true, loop: false,
    tokenizer: null, tokenizerStatus: "idle", tokenCache: new Map(),
    jpCues: [], enCues: [], tracksSeen: [],
    activeIndex: -1, currentVideoId: "", selectedWord: null, vocab: [],
    panelOpen: false, panelTab: "transcript", controlsCollapsed: false,
    discovered: [], discoveredSet: {}, genericLoaded: false, videoCount: 0,
    diag: [], autoTried: {}, autoLoadedFrom: "", nativeInfo: [],
    dict: null, dictStatus: "loading", lastTok: null
  };
  function diagLog(msg) {
    try {
      var line = new Date().toLocaleTimeString() + " " + String(msg || "");
      state.diag.unshift(line);
      if (state.diag.length > 30) state.diag.length = 30;
      if (subsMenuEl && !subsMenuEl.hidden) renderSubsMenu();
    } catch (e) {}
  }

  function kataToHira(t) { return String(t || "").replace(/[\u30a1-\u30f6]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); }); }
  /* Hepburn romaji, ASCII only on purpose: no macrons, so "ou" stays "ou"
     and nothing can turn into mojibake on fragile screens. */
  var ROMAJI_TABLE = {
    "あ":"a","い":"i","う":"u","え":"e","お":"o",
    "か":"ka","き":"ki","く":"ku","け":"ke","こ":"ko",
    "さ":"sa","し":"shi","す":"su","せ":"se","そ":"so",
    "た":"ta","ち":"chi","つ":"tsu","て":"te","と":"to",
    "な":"na","に":"ni","ぬ":"nu","ね":"ne","の":"no",
    "は":"ha","ひ":"hi","ふ":"fu","へ":"he","ほ":"ho",
    "ま":"ma","み":"mi","む":"mu","め":"me","も":"mo",
    "や":"ya","ゆ":"yu","よ":"yo",
    "ら":"ra","り":"ri","る":"ru","れ":"re","ろ":"ro",
    "わ":"wa","ゐ":"wi","ゑ":"we","を":"wo","ん":"n",
    "が":"ga","ぎ":"gi","ぐ":"gu","げ":"ge","ご":"go",
    "ざ":"za","じ":"ji","ず":"zu","ぜ":"ze","ぞ":"zo",
    "だ":"da","ぢ":"ji","づ":"zu","で":"de","ど":"do",
    "ば":"ba","び":"bi","ぶ":"bu","べ":"be","ぼ":"bo",
    "ぱ":"pa","ぴ":"pi","ぷ":"pu","ぺ":"pe","ぽ":"po",
    "うぁ":"wha","うぃ":"wi","うぇ":"we","うぉ":"who",
    "きゃ":"kya","きゅ":"kyu","きょ":"kyo",
    "しゃ":"sha","しゅ":"shu","しょ":"sho",
    "ちゃ":"cha","ちゅ":"chu","ちょ":"cho",
    "にゃ":"nya","にゅ":"nyu","にょ":"nyo",
    "ひゃ":"hya","ひゅ":"hyu","ひょ":"hyo",
    "みゃ":"mya","みゅ":"myu","みょ":"myo",
    "りゃ":"rya","りゅ":"ryu","りょ":"ryo",
    "ぎゃ":"gya","ぎゅ":"gyu","ぎょ":"gyo",
    "じゃ":"ja","じゅ":"ju","じょ":"jo",
    "びゃ":"bya","びゅ":"byu","びょ":"byo",
    "ぴゃ":"pya","ぴゅ":"pyu","ぴょ":"pyo",
    "ぢゃ":"ja","ぢゅ":"ju","ぢょ":"jo",
    "ふぁ":"fa","ふぃ":"fi","ふぇ":"fe","ふぉ":"fo",
    "てぃ":"ti","でぃ":"di","とぅ":"tu","どぅ":"du",
    "ゔ":"vu","ゔぁ":"va","ゔぃ":"vi","ゔぇ":"ve","ゔぉ":"vo",
    "ぁ":"a","ぃ":"i","ぅ":"u","ぇ":"e","ぉ":"o",
    "ゃ":"ya","ゅ":"yu","ょ":"yo"
  };
  function hiraToRomaji(t) {
    t = String(t || "");
    if (!t) return "";
    var out = "", i = 0;
    while (i < t.length) {
      if (t[i] === "っ") { // sokuon: っか -> kka, っち -> tchi, っちゃ -> tcha, っし -> sshi
        var nxt = ROMAJI_TABLE[t.slice(i + 1, i + 3)] || ROMAJI_TABLE[t[i + 1]] || "";
        if (nxt) out += /^ch/.test(nxt) ? "t" : nxt[0];
        i++;
        continue;
      }
      var r = ROMAJI_TABLE[t.slice(i, i + 2)];
      if (r !== undefined) { out += r; i += 2; continue; }
      r = ROMAJI_TABLE[t[i]];
      if (r !== undefined) {
        if (t[i] === "ん" && /[あいうえおやゆよ]/.test(t[i + 1] || "")) out += "n'"; // ん before vowel/y
        else out += r;
        i++;
        continue;
      }
      if (t[i] === "ー") { var m = out.match(/[aeiou]$/); if (m) out += m[0]; i++; continue; } // long vowel mark
      out += t[i]; // unknown char: pass through
      i++;
    }
    return out;
  }
  function isKana(c) { return /[\u3040-\u30ff\u30fc]/.test(c || ""); }
  function hasKanji(t) { return /[\u3400-\u9fff\u3005]/.test(t || ""); }
  function cleanText(t) {
    return String(t || "").replace(/\{\\[^}]+\}/g, "").replace(/<br\s*\/?\s*>/gi, " ")
      .replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/\s*\n\s*/g, " ").trim();
  }
  function fmt(sec) {
    if (!isFinite(sec)) sec = 0;
    var s = Math.max(0, Math.floor(sec)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return (h ? String(h).padStart(2, "0") + ":" : "") + String(m).padStart(2, "0") + ":" + String(ss).padStart(2, "0");
  }
  function parseTimestamp(t) {
    t = String(t || "").trim().replace(",", ".");
    var m = t.match(/(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d+))?/);
    if (!m) return 0;
    return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0) + Number("0." + (m[4] || "0"));
  }
  function parseSubtitles(text) {
    text = String(text || "").replace(/\uFEFF/g, "");
    if (/^\s*<\?xml/.test(text.slice(0, 80)) && /<transcript[\s>]/.test(text.slice(0, 900))) {
      var xmlCues = [];
      var reX = /<text[^>]*\bstart="([\d.]+)"[^>]*?(?:\bdur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g, mx;
      while ((mx = reX.exec(text))) {
        var sx = Number(mx[1] || 0), dx = Number(mx[2] || 2.5);
        var tx = cleanText(mx[3]);
        if (tx) xmlCues.push({ start: sx, end: sx + dx, text: tx });
      }
      if (xmlCues.length) return xmlCues.sort(function (a, b) { return a.start - b.start; });
    }
    if (/^\[Script Info\]/m.test(text) || /^Dialogue:/m.test(text)) {
      var ass = [];
      text.split(/\r?\n/).forEach(function (line) {
        if (line.indexOf("Dialogue:") !== 0) return;
        var parts = line.slice(9).split(",");
        if (parts.length < 10) return;
        var txt = cleanText(parts.slice(9).join(",").replace(/\\N/gi, " ").replace(/\{[^}]*\}/g, ""));
        if (txt) ass.push({ start: parseTimestamp(parts[1]), end: parseTimestamp(parts[2]), text: txt });
      });
      return ass;
    }
    var blocks = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split(/\n\n+/);
    var cues = [];
    blocks.forEach(function (b) {
      var lines = b.split("\n").filter(function (x) { return x.trim() !== ""; });
      var ti = lines.findIndex(function (x) { return x.indexOf("-->") !== -1; });
      if (ti === -1) return;
      var seg = lines[ti].split("-->");
      var body = cleanText(lines.slice(ti + 1).join(" "));
      if (body) cues.push({ start: parseTimestamp(seg[0]), end: parseTimestamp(seg[1]), text: body });
    });
    return cues.sort(function (a, b) { return a.start - b.start; });
  }
  function isJapaneseText(t) {
    var s2 = String(t || ""); if (!s2) return false;
    var jp = (s2.match(/[\u3040-\u30ff\u3400-\u9fff]/g) || []).length;
    return jp >= 2 && jp / Math.max(1, s2.replace(/\s/g, "").length) > 0.18;
  }
  function guessLang(hint, text) {
    var h = String(hint || "").toLowerCase();
    if (/(^|[^a-z])(ja|jp|jpn|japanese)([^a-z]|$)/.test(h)) return "ja";
    if (/(^|[^a-z])(en|eng|english)([^a-z]|$)/.test(h)) return "en";
    return isJapaneseText(text) ? "ja" : "en";
  }
  function ingestCues(cues, lang, label) {
    if (!cues || !cues.length) return false;
    clearLoadingWatchdog();
    if (lang === "en") { state.enCues = cues; }
    else { state.jpCues = cues; state.genericLoaded = true; state.tokenCache.clear(); }
    state.activeIndex = -1;
    setStatus("ready", label + " - " + cues.length + " lines" + (lang === "ja" && state.enCues.length ? " - EN translation on" : ""));
    renderTranscript(); renderVocab(); updateForTime(true); hideNativeTracks();
    return true;
  }
  function resolveUrl(rel, base) {
    try { return new URL(rel, base || location.href).href; } catch (e) { return rel; }
  }
  function fetchText(url) {
    // Direct fetch first (fast, same-origin), then the background proxy
    // which bypasses CORS for cross-origin subtitle CDNs (2.1 fix).
    diagLog("fetch " + String(url).slice(0, 110));
    return fetch(url, { credentials: "include" }).then(function (r) {
      return r.text().then(function (t) {
        if (t && t.length > 4) return t;
        throw new Error("empty direct");
      });
    }).catch(function () {
      return new Promise(function (resolve, reject) {
        try {
          chrome.runtime.sendMessage({ type: "SP_FETCH_TEXT", url: url }, function (resp) {
            if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
            if (resp && typeof resp.text === "string" && resp.text.length) { diagLog("proxy ok " + resp.text.length + " chars"); resolve(resp.text); }
            else reject(new Error((resp && resp.error) || "proxy empty"));
          });
        } catch (e) { reject(e); }
      });
    });
  }
  function isHlsText(t) { return /^\s*#EXTM3U/.test(String(t || "").slice(0, 200)); }
  function parseHlsSubtitles(text, baseUrl) {
    var subs = [], segs = [], lines = String(text || "").split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i].trim();
      if (ln.indexOf("#EXT-X-MEDIA:") === 0 && /TYPE=SUBTITLES/i.test(ln)) {
        var uriM = ln.match(/URI="([^"]+)"/), langM = ln.match(/LANGUAGE="([^"]+)"/), nameM = ln.match(/NAME="([^"]+)"/);
        if (uriM) subs.push({ url: resolveUrl(uriM[1], baseUrl), lang: (langM && langM[1]) || "", name: (nameM && nameM[1]) || "" });
      } else if (ln && ln.charAt(0) !== "#") {
        segs.push(resolveUrl(ln, baseUrl));
      }
    }
    return { renditions: subs, segments: segs };
  }
  function loadHlsPlaylist(url, text, depth) {
    var parsed = parseHlsSubtitles(text, url);
    diagLog("HLS " + parsed.renditions.length + " renditions, " + parsed.segments.length + " segments");
    if (parsed.renditions.length) {
      parsed.renditions.forEach(function (r) { addDiscovered(r.url); });
      var jp = parsed.renditions.filter(function (r) { return guessLang(r.lang + " " + r.name + " " + r.url, "") === "ja"; })[0] || parsed.renditions[0];
      if (jp && !state.jpCues.length) return loadSubtitleUrl(jp.url);
      return Promise.resolve(false);
    }
    if (parsed.segments.length && (depth || 0) < 2) {
      // Media playlist of WebVTT segments: fetch + merge (cap 400).
      var chain = Promise.resolve([]);
      parsed.segments.slice(0, 400).forEach(function (segUrl) {
        chain = chain.then(function (acc) {
          return fetchText(segUrl).then(function (t) { return acc.concat(parseSubtitles(t)); }).catch(function () { return acc; });
        });
      });
      return chain.then(function (all) {
        if (!all.length) { diagLog("HLS segments had no cues"); return false; }
        all.sort(function (a, b) { return a.start - b.start; });
        var lang = guessLang(url, all.slice(0, 6).map(function (c) { return c.text; }).join(" "));
        return ingestCues(all, lang, (lang === "ja" ? "Japanese" : "English") + " subtitles (HLS) - " + all.length + " lines");
      });
    }
    return Promise.resolve(false);
  }
  function loadSubtitleText(text, hint) {
    if (isHlsText(text)) { loadHlsPlaylist(hint || location.href, text, 0); return true; }
    // YouTube json3 handed over as text by the page bridge:
    var trimmed = String(text || "").trim();
    if (trimmed.charAt(0) === "{" && trimmed.indexOf('"events"') !== -1) {
      try {
        var data = JSON.parse(trimmed), jc = [];
        (data.events || []).forEach(function (ev) {
          if (!ev.segs) return;
          var tt = cleanText(ev.segs.map(function (s) { return s.utf8 || ""; }).join(""));
          if (!tt) return;
          var st = (ev.tStartMs || 0) / 1000;
          jc.push({ start: st, end: st + (ev.dDurationMs || 2000) / 1000, text: tt });
        });
        if (jc.length) {
          var jl = guessLang(hint, jc.slice(0, 6).map(function (c) { return c.text; }).join(" "));
          return ingestCues(jc, jl, (jl === "ja" ? "Japanese" : "English") + " subtitles loaded");
        }
      } catch (e) {}
    }
    var cues = parseSubtitles(text);
    if (!cues.length) { diagLog("no cues parsed from " + String(hint || "").slice(0, 80)); setStatus("warn", "That subtitle file had no readable lines. Try .srt or .vtt."); return false; }
    var lang = guessLang(hint, cues.slice(0, 6).map(function (c) { return c.text; }).join(" "));
    return ingestCues(cues, lang, lang === "ja" ? "Japanese subtitles loaded" : "English subtitles loaded");
  }
  function loadSubtitleUrl(url) {
    setStatus("", "Loading subtitle file");
    return fetchText(url).then(function (t) {
      if (isHlsText(t)) return loadHlsPlaylist(url, t, 0);
      var ok = loadSubtitleText(t, url);
      if (ok && !/timedtext/i.test(url)) state.autoLoadedFrom = url;
      return ok;
    }).catch(function (e) {
      diagLog("fetch failed " + (e && e.message || e));
      setStatus("warn", "Could not fetch that subtitle file. Use Load sub and pick the file instead.");
      return false;
    });
  }
  function maybeAutoLoad(url) {
    if (state.jpCues.length || state.autoTried[url]) return;
    // YouTube timedtext URLs already arrive with parsed text via the bridge;
    // fetching the bare baseUrl again can return empty, so let handleTracks win.
    if (/youtube\.com\/api\/timedtext|googlevideo\.com\/videoplayback/i.test(url) && !/[?&]fmt=/.test(url)) return;
    state.autoTried[url] = 1;
    diagLog("auto-try " + String(url).split("/").pop().split("?")[0]);
    loadSubtitleUrl(url);
  }
  function addDiscovered(url) {
    if (!url) return;
    var full = url;
    try { full = new URL(url, location.href).href; } catch (e) {}
    if (state.discoveredSet[full]) return;
    state.discoveredSet[full] = 1; state.discovered.push(full);
    diagLog("found " + full.slice(0, 110));
    renderSubsMenu();
    if (!state.jpCues.length) {
      setStatus("", "Subtitle file found - loading it now. Subs lists everything found.");
      armLoadingWatchdog();
      maybeAutoLoad(full);
    }
  }
  // v2.3.4: the "loading it now" pill used to hang forever when a discovered
  // URL was skipped by maybeAutoLoad and no text ever arrived. If nothing
  // loads within 15s, say so instead of spinning silently.
  var loadingWatchdog = null;
  function armLoadingWatchdog() {
    if (loadingWatchdog) clearTimeout(loadingWatchdog);
    loadingWatchdog = setTimeout(function () {
      loadingWatchdog = null;
      if (!state.jpCues.length) setStatus("warn", "Subtitle file found but nothing loaded yet. Check Subs, or use Load sub.");
    }, 15000);
  }
  function clearLoadingWatchdog() { if (loadingWatchdog) { clearTimeout(loadingWatchdog); loadingWatchdog = null; } }
  function rubyParts(surface, reading) {
    var hr = kataToHira(reading);
    if (!hasKanji(surface) || !hr || reading === "*") return null;
    var start = 0;
    while (start < surface.length && start < hr.length && isKana(surface[start]) && kataToHira(surface[start]) === hr[start]) start++;
    var sEnd = surface.length - 1, rEnd = hr.length - 1;
    while (sEnd >= start && rEnd >= start && isKana(surface[sEnd]) && kataToHira(surface[sEnd]) === hr[rEnd]) { sEnd--; rEnd--; }
    var base = surface.slice(start, sEnd + 1), ruby = hr.slice(start, rEnd + 1);
    if (!base || !ruby || !hasKanji(base)) return null;
    return { prefix: surface.slice(0, start), base: base, ruby: ruby, suffix: surface.slice(sEnd + 1) };
  }
  function findCue(cues, time) {
    var lo = 0, hi = cues.length - 1, res = -1;
    while (lo <= hi) { var mid = (lo + hi) >> 1; if (cues[mid].start <= time) { res = mid; lo = mid + 1; } else hi = mid - 1; }
    if (res >= 0 && time <= cues[res].end + 0.08) return res;
    return -1;
  }
  function translationFor(cue) {
    if (!cue || !state.enCues.length) return "";
    var mid = cue.start + (cue.end - cue.start) / 2;
    var idx = findCue(state.enCues, mid);
    if (idx >= 0) return state.enCues[idx].text;
    for (var i = 0; i < state.enCues.length; i++) if (Math.abs(state.enCues[i].start - cue.start) < 0.65) return state.enCues[i].text;
    return "";
  }
  function tokenize(text) {
    if (state.tokenCache.has(text)) return state.tokenCache.get(text);
    if (!state.tokenizer) return null;
    try {
      var toks = state.tokenizer.tokenize(text);
      // Auto-captions often remove the pause between adjacent katakana words.
      // IPADIC then returns the whole run as one unknown proper noun. Refine
      // those conservative cases into useful click targets before rendering.
      if (window.SPTokenRefiner) toks = window.SPTokenRefiner.refine(toks, state.tokenizer);
      state.tokenCache.set(text, toks);
      return toks;
    }
    catch (e) { return null; }
  }

  /* ---------- DOM ---------- */
  var root, overlay, jpEl, enEl, statusEl, dotEl, wordCard, panel, listEl, vocabListEl, fileInputEl, subsMenuEl, minerPanel;
  function allVideos() { return Array.prototype.slice.call(document.querySelectorAll("video")); }
  function videoEl() {
    var vids = allVideos(); if (!vids.length) return null;
    var playing = vids.filter(function (v) { return !v.paused && !v.ended && v.readyState > 1; });
    var pool = playing.length ? playing : vids;
    pool.sort(function (a, b) { return (b.offsetWidth * b.offsetHeight || b.clientWidth * b.clientHeight || 0) - (a.offsetWidth * a.offsetHeight || a.clientWidth * a.clientHeight || 0); });
    return pool[0];
  }
  function playerEl() {
    var yt = document.querySelector("#movie_player");
    if (yt) return yt;
    var v = videoEl(); if (!v) return null;
    return v.closest(".plyr, .video-js, .jwplayer, .fluid_video_wrapper, [class*='player'], [id*='player']") || v.parentElement || v;
  }

  function ensureRoot() {
    var player = playerEl();
    if (!player || document.getElementById("sp-root")) return !!player;
    if (getComputedStyle(player).position === "static") player.style.position = "relative";
    root = document.createElement("div");
    root.id = "sp-root";
    root.innerHTML =
      '<div id="sp-overlay">' +
        '<div id="sp-caption-box"><div id="sp-jp"></div><div id="sp-en" class="sp-en"></div></div>' +
        '<div><span id="sp-status"><span class="sp-dot"></span><span id="sp-status-text">Study Player loading</span></span></div>' +
        '<div id="sp-bar">' +
          '<button class="sp-btn" id="sp-prev" type="button" title="Previous line">|&#9664;</button>' +
          '<button class="sp-btn" id="sp-replay" type="button">Replay</button>' +
          '<button class="sp-btn" id="sp-mine" type="button" title="Mine this line into a flashcard">Mine</button>' +
          '<button class="sp-btn" id="sp-next" type="button" title="Next line">&#9654;|</button>' +
          '<button class="sp-btn" id="sp-loop" type="button" aria-pressed="false">Loop</button>' +
          '<button class="sp-btn" id="sp-furi" type="button" aria-pressed="true">Furigana</button>' +
          '<button class="sp-btn" id="sp-en-toggle" type="button" aria-pressed="true">EN</button>' +
          '<select class="sp-select" id="sp-speed"><option value="0.5">0.5x</option><option value="0.75">0.75x</option><option value="1" selected>1x</option><option value="1.25">1.25x</option><option value="1.5">1.5x</option><option value="2">2x</option></select>' +
          '<button class="sp-btn" id="sp-panel-btn" type="button">Transcript</button>' +
          '<button class="sp-btn" id="sp-load-sub" type="button" title="Load a local .srt, .vtt or .ass file">Load sub</button>' +
          '<button class="sp-btn" id="sp-subs-btn" type="button" aria-pressed="false">Subs</button>' +
          '<button class="sp-btn sp-minimize" id="sp-minimize" type="button" aria-pressed="false" aria-label="Minimize controls" title="Minimize controls">&#8722;</button>' +
        '</div>' +
      '</div>' +
      '<aside id="sp-word-card" hidden>' +
        '<div class="sp-wc-head"><div><div class="sp-wc-main" id="sp-wc-main"></div><div class="sp-wc-reading" id="sp-wc-reading"></div><div class="sp-wc-romaji" id="sp-wc-romaji"></div></div>' +
        '<button class="sp-wc-close" id="sp-wc-close" type="button" aria-label="Close">x</button></div>' +
        '<span class="sp-wc-pos" id="sp-wc-pos"></span><p class="sp-wc-meaning" id="sp-wc-meaning"></p>' +
        '<div class="sp-wc-actions"><button class="sp-wc-save" id="sp-wc-save" type="button">Save word</button></div>' +
      '</aside>';
    var fileInput = document.createElement("input");
    fileInput.type = "file"; fileInput.id = "sp-file"; fileInput.accept = ".srt,.vtt,.ass,.ssa,.txt"; fileInput.multiple = true; fileInput.hidden = true;
    var subsMenu = document.createElement("div");
    subsMenu.id = "sp-subs-menu"; subsMenu.hidden = true;
    player.appendChild(root); player.appendChild(fileInput); player.appendChild(subsMenu);
    overlay = root.querySelector("#sp-overlay");
    jpEl = root.querySelector("#sp-jp");
    enEl = root.querySelector("#sp-en");
    statusEl = root.querySelector("#sp-status-text");
    dotEl = root.querySelector(".sp-dot");
    wordCard = root.querySelector("#sp-word-card");
    fileInputEl = player.querySelector("#sp-file"); subsMenuEl = player.querySelector("#sp-subs-menu");
    bindBar();
    buildPanel();
    buildMinerPanel();
    applyToggles();
    return true;
  }
  function setStatus(kind, text) { if (statusEl) statusEl.textContent = text; if (dotEl) dotEl.className = "sp-dot" + (kind ? " " + kind : ""); }
  function applyToggles() {
    if (root) {
      root.classList.toggle("sp-hide-furigana", !state.furigana);
      root.classList.toggle("sp-hide-translation", !state.translation);
      root.classList.toggle("sp-controls-collapsed", state.controlsCollapsed);
    }
    var f = document.getElementById("sp-furi"), e = document.getElementById("sp-en-toggle"), l = document.getElementById("sp-loop"), m = document.getElementById("sp-minimize");
    if (f) f.setAttribute("aria-pressed", String(state.furigana));
    if (e) e.setAttribute("aria-pressed", String(state.translation));
    if (l) l.setAttribute("aria-pressed", String(state.loop));
    if (m) {
      m.setAttribute("aria-pressed", String(state.controlsCollapsed));
      m.setAttribute("aria-label", state.controlsCollapsed ? "Show controls" : "Minimize controls");
      m.title = state.controlsCollapsed ? "Show controls" : "Minimize controls";
      m.textContent = state.controlsCollapsed ? "Controls" : "−";
    }
    document.body.classList.toggle("sp-native-off", !!state.enabled);
    if (overlay) overlay.style.display = state.enabled ? "" : "none";
    if (wordCard && !state.enabled) wordCard.hidden = true;
    if (minerPanel && !state.enabled) minerPanel.hidden = true;
    hideNativeTracks();
  }
  function hideNativeTracks() {
    var v = videoEl(); if (!v || !v.textTracks) return;
    for (var i = 0; i < v.textTracks.length; i++) { try { v.textTracks[i].mode = "hidden"; } catch (e) {} }
  }
  function bindBar() {
    root.querySelector("#sp-replay").addEventListener("click", replay);
    root.querySelector("#sp-mine").addEventListener("click", openMiner);
    root.querySelector("#sp-prev").addEventListener("click", function () { seekLine(-1); });
    root.querySelector("#sp-next").addEventListener("click", function () { seekLine(1); });
    root.querySelector("#sp-loop").addEventListener("click", function () { state.loop = !state.loop; applyToggles(); saveSettings(); });
    root.querySelector("#sp-furi").addEventListener("click", function () { state.furigana = !state.furigana; applyToggles(); saveSettings(); });
    root.querySelector("#sp-en-toggle").addEventListener("click", function () { state.translation = !state.translation; applyToggles(); saveSettings(); });
    root.querySelector("#sp-speed").addEventListener("change", function () { var v = videoEl(); if (v) v.playbackRate = Number(this.value); });
    root.querySelector("#sp-panel-btn").addEventListener("click", function () { togglePanel(); });
    root.querySelector("#sp-load-sub").addEventListener("click", function () { if (fileInputEl) fileInputEl.click(); });
    root.querySelector("#sp-minimize").addEventListener("click", function () {
      state.controlsCollapsed = !state.controlsCollapsed;
      if (subsMenuEl) subsMenuEl.hidden = true;
      applyToggles(); saveSettings();
    });
    root.querySelector("#sp-subs-btn").addEventListener("click", function () {
      if (!subsMenuEl) return;
      subsMenuEl.hidden = !subsMenuEl.hidden;
      this.setAttribute("aria-pressed", String(!subsMenuEl.hidden));
      if (!subsMenuEl.hidden) renderSubsMenu();
    });
    if (fileInputEl) fileInputEl.addEventListener("change", function () {
      Array.prototype.forEach.call(fileInputEl.files || [], function (f) {
        var reader = new FileReader();
        reader.onload = function () { loadSubtitleText(String(reader.result || ""), f.name); };
        reader.readAsText(f);
      });
      fileInputEl.value = "";
    });
    root.querySelector("#sp-wc-close").addEventListener("click", function () { wordCard.hidden = true; });
    root.querySelector("#sp-wc-save").addEventListener("click", saveSelectedWord);
  }
  function renderSubsMenu() {
    if (!subsMenuEl) return;
    subsMenuEl.innerHTML = "";
    var head = document.createElement("div"); head.className = "sp-subs-head";
    head.textContent = state.discovered.length ? "Subtitle files found on this page" : "No subtitle files found yet on this page";
    subsMenuEl.appendChild(head);
    // Diagnostics readout (2.1): what was actually found on this page.
    var diagBox = document.createElement("div"); diagBox.className = "sp-subs-diag";
    var vidsNow = allVideos();
    var lines = [];
    lines.push("Page: " + location.hostname + " - videos: " + vidsNow.length);
    lines.push("Loaded: JP " + state.jpCues.length + " lines, EN " + state.enCues.length + " lines" + (state.autoLoadedFrom ? " (auto: " + state.autoLoadedFrom.split("/").pop().split("?")[0] + ")" : ""));
    if (state.tracksSeen && state.tracksSeen.length) lines.push("YouTube tracks: " + state.tracksSeen.map(function (t) { return t.languageCode + (t.kind ? "/" + t.kind : ""); }).join(", "));
    if (state.nativeInfo && state.nativeInfo.length) lines.push("Player tracks: " + state.nativeInfo.join(" - "));
    lines.push("Found files: " + state.discovered.length);
    diagBox.textContent = lines.join("\n");
    subsMenuEl.appendChild(diagBox);
    var retryRow = document.createElement("div"); retryRow.className = "sp-subs-row";
    var retryBtn = document.createElement("button"); retryBtn.type = "button"; retryBtn.className = "sp-small-btn"; retryBtn.textContent = "Retry detection";
    retryBtn.addEventListener("click", function () {
      state.autoTried = {};
      try { window.postMessage({ type: "SP_REQUEST_TRACKS" }, "*"); } catch (e) {}
      pollNativeTracks();
      state.discovered.slice().forEach(function (u) { maybeAutoLoad(u); });
      renderSubsMenu();
    });
    var retryHint = document.createElement("span"); retryHint.className = "sp-subs-url"; retryHint.textContent = "Re-scan player, network log below";
    retryRow.appendChild(retryHint); retryRow.appendChild(retryBtn);
    // v2.3.4: one-tap copy of the diagnostics readout for bug reports.
    var copyBtn = document.createElement("button"); copyBtn.type = "button"; copyBtn.className = "sp-small-btn"; copyBtn.textContent = "Copy diagnostics";
    copyBtn.addEventListener("click", function () {
      var txt = diagBox.textContent + "\n---\n" + (state.diag || []).slice(0, 10).join("\n");
      function done(ok) { copyBtn.textContent = ok ? "Copied" : "Copy failed"; setTimeout(function () { copyBtn.textContent = "Copy diagnostics"; }, 1500); }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { done(true); }, function () { done(false); });
        else {
          var ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select();
          var ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
          document.body.removeChild(ta); done(ok);
        }
      } catch (e) { done(false); }
    });
    retryRow.appendChild(copyBtn);
    subsMenuEl.appendChild(retryRow);
    if (!state.discovered.length) {
      var hint = document.createElement("p"); hint.className = "sp-subs-hint";
      hint.textContent = "Press play and turn the player's own CC on, wait a few seconds, then Retry detection. Streaming (HLS) subtitle playlists are followed automatically when spotted. Otherwise use Load sub to pick an .srt/.vtt file from your device.";
      subsMenuEl.appendChild(hint);
    }
    state.discovered.slice(0, 14).forEach(function (url) {
      var row = document.createElement("div"); row.className = "sp-subs-row";
      var label = document.createElement("span"); label.className = "sp-subs-url"; label.textContent = url.split("/").pop().split("?")[0] || url; label.title = url;
      var bJ = document.createElement("button"); bJ.type = "button"; bJ.className = "sp-small-btn"; bJ.textContent = "Load";
      bJ.addEventListener("click", function () { loadSubtitleUrl(url); subsMenuEl.hidden = true; });
      row.appendChild(label); row.appendChild(bJ); subsMenuEl.appendChild(row);
    });
    if (state.diag && state.diag.length) {
      var logEl = document.createElement("div"); logEl.className = "sp-subs-log";
      logEl.textContent = state.diag.slice(0, 10).join("\n");
      subsMenuEl.appendChild(logEl);
    }
    var vids = allVideos();
    state.videoCount = vids.length;
    if (vids.length > 1) {
      var vh = document.createElement("p"); vh.className = "sp-subs-hint";
      vh.textContent = vids.length + " video players found. Study Player follows the playing / largest one.";
      subsMenuEl.appendChild(vh);
    }
  }
  function pollNativeTracks() {
    var v = videoEl(); if (!v) return;
    try {
      v.querySelectorAll("track[src]").forEach(function (t) { addDiscovered(t.src); });
    } catch (e) {}
    try {
      var info = [];
      for (var i = 0; i < v.textTracks.length; i++) {
        var tt = v.textTracks[i];
        // Force the browser to load cues: disabled tracks never populate.
        try { if (tt.mode === "disabled") tt.mode = "hidden"; } catch (e) {}
        var nCues = 0; try { nCues = tt.cues ? tt.cues.length : 0; } catch (e) {}
        info.push((tt.label || tt.language || "track") + " [" + (tt.language || "?") + "/" + tt.mode + "/" + nCues + "]");
        if (!nCues) continue;
        var already = (guessLang(tt.language || tt.label || "", "") === "en") ? state.enCues.length : state.jpCues.length;
        // Determine language cheaply first; fall back to text sniffing.
        var probe = [];
        for (var j = 0; j < Math.min(5, tt.cues.length); j++) probe.push(tt.cues[j].text || "");
        var lang = guessLang(tt.language || tt.label || "", probe.join(" "));
        if (lang === "en" && state.enCues.length) continue;
        if (lang === "ja" && state.jpCues.length) continue;
        var cues = [];
        for (var k = 0; k < tt.cues.length; k++) { var c = tt.cues[k]; cues.push({ start: c.startTime, end: c.endTime, text: cleanText(c.text) }); }
        if (cues.length) { diagLog("native track " + lang + " " + cues.length + " cues"); ingestCues(cues, lang, lang === "ja" ? "Japanese subtitles (player track)" : "English subtitles (player track)"); }
      }
      state.nativeInfo = info;
    } catch (e) {}
  }
  function buildPanel() {
    panel = document.createElement("div");
    panel.id = "sp-panel"; panel.hidden = true;
    panel.innerHTML =
      '<div class="sp-panel-head"><p class="sp-panel-title">Study transcript</p>' +
      '<p class="sp-panel-sub">Tap a line to jump there. Tap any word above the video to look it up and save it.</p></div>' +
      '<button class="sp-panel-close" id="sp-panel-close" type="button" aria-label="Close panel">x</button>' +
      '<div class="sp-tabs"><button class="sp-tab" id="sp-tab-t" type="button" aria-selected="true">Transcript</button>' +
      '<button class="sp-tab" id="sp-tab-v" type="button" aria-selected="false">Vocabulary <span id="sp-v-count">0</span></button></div>' +
      '<div id="sp-view-t"><div class="sp-tools"><input class="sp-search" id="sp-search" type="search" placeholder="Search lines"><span class="sp-count" id="sp-line-count">0 lines</span></div>' +
      '<div class="sp-list" id="sp-list"><div class="sp-empty"><strong>No transcript yet</strong>Play the video with Japanese captions on, open Subs to pick a subtitle file found on the page, or use Load sub to add an .srt/.vtt file.</div></div></div>' +
      '<div id="sp-view-v" hidden><div class="sp-vocab-bar"><p>Saved in this browser</p><div class="sp-vocab-actions">' +
      '<button class="sp-small-btn" id="sp-export" type="button">Export CSV</button><button class="sp-small-btn" id="sp-clear" type="button">Clear</button></div></div>' +
      '<div class="sp-list" id="sp-v-list"></div></div>';
    document.body.appendChild(panel);
    listEl = panel.querySelector("#sp-list");
    vocabListEl = panel.querySelector("#sp-v-list");
    panel.querySelector("#sp-panel-close").addEventListener("click", togglePanel);
    panel.querySelector("#sp-tab-t").addEventListener("click", function () { setPanelTab("transcript"); });
    panel.querySelector("#sp-tab-v").addEventListener("click", function () { setPanelTab("vocab"); });
    panel.querySelector("#sp-search").addEventListener("input", renderTranscript);
    panel.querySelector("#sp-export").addEventListener("click", exportCsv);
    panel.querySelector("#sp-clear").addEventListener("click", function () { state.vocab = []; persistVocab(); renderVocab(); });
  }
  function togglePanel(force) {
    state.panelOpen = typeof force === "boolean" ? force : !state.panelOpen;
    if (panel) panel.hidden = !state.panelOpen;
    if (state.panelOpen) { renderTranscript(); renderVocab(); }
  }
  function setPanelTab(tab) {
    state.panelTab = tab;
    panel.querySelector("#sp-tab-t").setAttribute("aria-selected", String(tab === "transcript"));
    panel.querySelector("#sp-tab-v").setAttribute("aria-selected", String(tab === "vocab"));
    panel.querySelector("#sp-view-t").hidden = tab !== "transcript";
    panel.querySelector("#sp-view-v").hidden = tab !== "vocab";
    if (tab === "vocab") renderVocab();
  }
  // v2.5.3: the sentence miner lives in its own fixed side window on
  // document.body (like the transcript panel) instead of a card inside
  // the player, so player sizing can never squeeze it.
  function buildMinerPanel() {
    if (document.getElementById("sp-miner-panel")) { minerPanel = document.getElementById("sp-miner-panel"); return; }
    minerPanel = document.createElement("aside");
    minerPanel.id = "sp-miner-panel"; minerPanel.hidden = true;
    minerPanel.innerHTML =
      '<div class="sp-mn-head"><div><div class="sp-panel-title">Mine sentence</div>' +
      '<div class="sp-wc-reading" id="sp-mn-sub"></div></div>' +
      '<button class="sp-wc-close" id="sp-mn-close" type="button" aria-label="Close">x</button></div>' +
      '<div class="sp-mn-body">' +
      '<div id="sp-mn-sent" class="sp-mn-sent"></div>' +
      '<div id="sp-mn-words" class="sp-mn-words"></div>' +
      '<div class="sp-subs-hint">pitch: 0 = flat, a number = the accented mora</div>' +
      '<img id="sp-mn-shot" class="sp-mn-shot" alt="Video frame">' +
      '<div class="sp-wc-actions">' +
        '<button class="sp-wc-save" id="sp-mn-listen" type="button">Listen</button>' +
        '<button class="sp-wc-save" id="sp-mn-anki" type="button">Send to Anki</button>' +
        '<button class="sp-wc-save" id="sp-mn-csv" type="button">CSV</button>' +
      '</div><div id="sp-mn-msg" class="sp-subs-hint"></div></div>';
    document.body.appendChild(minerPanel);
    minerPanel.querySelector("#sp-mn-close").addEventListener("click", closeMiner);
    minerPanel.querySelector("#sp-mn-listen").addEventListener("click", minerListen);
    minerPanel.querySelector("#sp-mn-anki").addEventListener("click", minerToAnki);
    minerPanel.querySelector("#sp-mn-csv").addEventListener("click", minerToCsv);
  }
  function renderJapanese(text) {
    if (!jpEl) return;
    jpEl.innerHTML = "";
    var toks = tokenize(text);
    if (!toks) { jpEl.textContent = text; return; }
    toks.forEach(function (tok) {
      var btn = document.createElement("button");
      btn.type = "button"; btn.className = "sp-word"; btn.textContent = "";
      btn.setAttribute("aria-label", tok.surface_form + (tok.reading && tok.reading !== "*" ? ", " + kataToHira(tok.reading) : ""));
      var parts = rubyParts(tok.surface_form, tok.reading);
      if (parts) {
        btn.appendChild(document.createTextNode(parts.prefix));
        var ruby = document.createElement("ruby");
        ruby.appendChild(document.createTextNode(parts.base));
        var rt = document.createElement("rt"); rt.textContent = parts.ruby;
        ruby.appendChild(rt);
        btn.appendChild(ruby);
        btn.appendChild(document.createTextNode(parts.suffix));
      } else btn.textContent = tok.surface_form;
      btn.addEventListener("click", function (ev) { ev.stopPropagation(); openWord(tok); });
      jpEl.appendChild(btn);
    });
  }
  function renderActive() {
    if (!jpEl) return;
    document.querySelectorAll(".sp-cue.active").forEach(function (n) { n.classList.remove("active"); });
    var idx = state.activeIndex;
    if (idx < 0 || !state.jpCues[idx]) {
      jpEl.textContent = state.jpCues.length ? "" : jpEl.textContent;
      if (enEl) enEl.textContent = "";
      return;
    }
    var cue = state.jpCues[idx];
    renderJapanese(cue.text);
    if (enEl) enEl.textContent = translationFor(cue) || (state.enCues.length ? "" : "");
    var row = listEl && listEl.querySelector('[data-idx="' + idx + '"]');
    if (row) {
      row.classList.add("active");
      var r = row.getBoundingClientRect(), c = listEl.getBoundingClientRect();
      if (r.top < c.top || r.bottom > c.bottom) row.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }
  function updateForTime(force) {
    var v = videoEl(); if (!v || !state.jpCues.length) return;
    var t = v.currentTime;
    if (state.loop && state.activeIndex >= 0) {
      var cur = state.jpCues[state.activeIndex];
      if (cur && t >= cur.end - 0.03) { v.currentTime = cur.start + 0.01; return; }
    }
    var idx = findCue(state.jpCues, t);
    if (idx === state.activeIndex && !force) return;
    state.activeIndex = idx;
    renderActive();
  }
  function seekLine(delta) {
    if (!state.jpCues.length) return;
    var v = videoEl(); if (!v) return;
    var idx = state.activeIndex < 0 ? 0 : state.activeIndex + delta;
    idx = Math.max(0, Math.min(state.jpCues.length - 1, idx));
    v.currentTime = state.jpCues[idx].start + 0.01;
    state.activeIndex = idx; renderActive();
    v.play().catch(function () {});
  }
  function replay() {
    var v = videoEl(); if (!v || state.activeIndex < 0) return;
    v.currentTime = state.jpCues[state.activeIndex].start + 0.01;
    v.play().catch(function () {});
  }
  function renderTranscript() {
    if (!listEl) return;
    var q = (panel.querySelector("#sp-search").value || "").trim().toLowerCase();
    listEl.innerHTML = ""; var count = 0;
    state.jpCues.forEach(function (cue, i) {
      var en = translationFor(cue);
      if (q && (cue.text + " " + en).toLowerCase().indexOf(q) === -1) return;
      count++;
      var row = document.createElement("button");
      row.type = "button"; row.className = "sp-cue" + (i === state.activeIndex ? " active" : "");
      row.dataset.idx = i;
      row.innerHTML = '<span class="sp-cue-time"></span><span><span class="sp-cue-jp"></span><span class="sp-cue-en"></span></span>';
      row.querySelector(".sp-cue-time").textContent = fmt(cue.start);
      row.querySelector(".sp-cue-jp").textContent = cue.text;
      var enElRow = row.querySelector(".sp-cue-en");
      if (en) enElRow.textContent = en; else enElRow.remove();
      row.addEventListener("click", function () {
        var v = videoEl(); if (!v) return;
        v.currentTime = cue.start + 0.01; state.activeIndex = i; renderActive();
        v.play().catch(function () {});
      });
      listEl.appendChild(row);
    });
    panel.querySelector("#sp-line-count").textContent = count + (count === 1 ? " line" : " lines");
    if (!count) listEl.innerHTML = '<div class="sp-empty"><strong>No matching lines</strong>Try a different search, or check that Japanese captions are on for this video.</div>';
  }
  function posLabel(tok) {
    var map = { "\u540d\u8a5e":"noun","\u52d5\u8a5e":"verb","\u5f62\u5bb9\u8a5e":"adjective","\u526f\u8a5e":"adverb","\u52a9\u8a5e":"particle","\u52a9\u52d5\u8a5e":"auxiliary","\u63a5\u7d9a\u8a5e":"conjunction","\u611f\u52d5\u8a5e":"interjection","\u9023\u4f53\u8a5e":"pre-noun adjective","\u8a18\u53f7":"symbol" };
    return map[tok.pos] || tok.pos || "word";
  }
  /* ---------- Dictionary (bundled JMdict common-word subset) ---------- */
  function dictGet(key) {
    if (!state.dict || !key) return null;
    return state.dict[key] || null;
  }
  function lookupWord(base, surface, readingHira) {
    // Kuromoji hands us the dictionary form (basic_form), so inflected
    // words like 行きます resolve to 行く. Fall back to the surface form,
    // then to the reading for words written in kana.
    var hit = dictGet(base) || dictGet(surface) || dictGet(readingHira);
    if (!hit || !hit.g || !hit.g.length) return null;
    return { meaning: hit.g.join("; "), reading: hit.r || "", pos: hit.p || "" };
  }
  function loadDictionary() {
    var url;
    try { url = chrome.runtime.getURL("dict/jmdict.json"); } catch (e) { state.dictStatus = "unavailable"; return; }
    fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      state.dict = data || {};
      state.dictStatus = "ready";
      diagLog("dictionary ready - " + Object.keys(state.dict).length + " forms");
      // A card clicked while the dictionary was warming up gets its
      // definition filled in as soon as the data lands.
      if (state.selectedWord && state.selectedWord.pendingDict && state.lastTok) openWord(state.lastTok);
    }).catch(function () {
      state.dictStatus = "unavailable";
      diagLog("dictionary failed to load - built-in glossary only");
    });
  }
  function openWord(tok) {
    var base = tok.basic_form && tok.basic_form !== "*" ? tok.basic_form : tok.surface_form;
    var readingHira = tok.reading && tok.reading !== "*" ? kataToHira(tok.reading) : "";
    var curated = GLOSSARY[base] || GLOSSARY[tok.surface_form] || "";
    var hit = curated ? null : lookupWord(base, tok.surface_form, readingHira);
    var meaning, known = true, pendingDict = false;
    if (curated) meaning = curated;
    else if (hit) meaning = hit.meaning;
    else if (state.dictStatus === "loading") { meaning = "Dictionary is still loading, one moment..."; known = false; pendingDict = true; }
    else { meaning = "Not in the bundled dictionary. You can still save the word with its reading and the line it came from."; known = false; }
    var pos = posLabel(tok);
    if (hit && hit.pos && (pos === "word" || !tok.pos)) pos = hit.pos;
    state.lastTok = tok;
    state.selectedWord = {
      word: base, surface: tok.surface_form,
      reading: readingHira || (hit && hit.reading) || "Reading unavailable",
      pos: pos, meaning: meaning, known: known, pendingDict: pendingDict,
      context: state.activeIndex >= 0 ? state.jpCues[state.activeIndex].text : "",
      translation: state.activeIndex >= 0 ? translationFor(state.jpCues[state.activeIndex]) : ""
    };
    document.getElementById("sp-wc-main").textContent = base;
    document.getElementById("sp-wc-reading").textContent = state.selectedWord.reading;
    // v2.5.1: romaji under the kana reading. Hidden when there is no kana reading.
    var romajiEl = document.getElementById("sp-wc-romaji");
    var readingKana = kataToHira(state.selectedWord.reading);
    if (/^[぀-ヶー]+$/.test(readingKana)) { romajiEl.textContent = hiraToRomaji(readingKana); romajiEl.style.display = ""; }
    else { romajiEl.textContent = ""; romajiEl.style.display = "none"; }
    document.getElementById("sp-wc-pos").textContent = state.selectedWord.pos;
    var mEl = document.getElementById("sp-wc-meaning");
    mEl.textContent = meaning;
    mEl.classList.toggle("unknown", !known);
    var exists = state.vocab.some(function (it) { return it.word === base && it.reading === state.selectedWord.reading; });
    var saveBtn = document.getElementById("sp-wc-save");
    saveBtn.textContent = exists ? "Saved" : "Save word"; saveBtn.disabled = exists;
    wordCard.hidden = false;
    var v = videoEl(); if (v && !v.paused) { /* keep playing; learner can pause with space */ }
  }
  function saveSelectedWord() {
    if (!state.selectedWord) return;
    var exists = state.vocab.some(function (it) { return it.word === state.selectedWord.word && it.reading === state.selectedWord.reading; });
    if (!exists) state.vocab.push(Object.assign({}, state.selectedWord));
    persistVocab(); renderVocab();
    this.textContent = "Saved"; this.disabled = true;
  }
  function persistVocab() {
    try { chrome.storage.local.set({ sp_vocab: state.vocab }); } catch (e) { try { localStorage.setItem("sp_vocab", JSON.stringify(state.vocab)); } catch (e2) {} }
  }
  function renderVocab() {
    if (!vocabListEl) return;
    var countEl = document.getElementById("sp-v-count"); if (countEl) countEl.textContent = state.vocab.length;
    vocabListEl.innerHTML = "";
    if (!state.vocab.length) {
      vocabListEl.innerHTML = '<div class="sp-empty"><strong>Your word list is empty</strong>Tap any word above the video, then save it for review.</div>';
      return;
    }
    state.vocab.forEach(function (item, idx) {
      var row = document.createElement("div"); row.className = "sp-v-item";
      var body = document.createElement("div");
      body.innerHTML = '<div><span class="sp-v-word"></span><span class="sp-v-reading"></span></div><div class="sp-v-meaning"></div>';
      body.querySelector(".sp-v-word").textContent = item.word;
      body.querySelector(".sp-v-reading").textContent = item.reading;
      body.querySelector(".sp-v-meaning").textContent = item.meaning;
      if (item.context) { var ctx = document.createElement("div"); ctx.className = "sp-v-context"; ctx.textContent = item.context; body.appendChild(ctx); }
      var rm = document.createElement("button");
      rm.type = "button"; rm.className = "sp-v-remove"; rm.textContent = "x"; rm.setAttribute("aria-label", "Remove " + item.word);
      rm.addEventListener("click", function () { state.vocab.splice(idx, 1); persistVocab(); renderVocab(); });
      row.appendChild(body); row.appendChild(rm);
      vocabListEl.appendChild(row);
    });
    var ex = document.getElementById("sp-export"), cl = document.getElementById("sp-clear");
    if (ex) ex.disabled = !state.vocab.length; if (cl) cl.disabled = !state.vocab.length;
  }
  function csvCell(v) { return '"' + String(v || "").replace(/"/g, '""') + '"'; }
  function exportCsv() {
    if (!state.vocab.length) return;
    var rows = [["Word","Reading","Part of speech","Meaning","Japanese context","Translation"]];
    state.vocab.forEach(function (it) { rows.push([it.word, it.reading, it.pos, it.meaning, it.context, it.translation]); });
    var csv = "\uFEFF" + rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n");
    var url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    var a = document.createElement("a"); a.href = url; a.download = "japanese-vocabulary.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ---------- Sentence miner (v2.4.0) ----------
     One-click flashcard mining from the current subtitle line:
     sentence + furigana, per-word glosses, pitch accent, a video-frame
     screenshot, TTS listen-back, and export to Anki (via AnkiConnect)
     or CSV. Audio on the saved card is intentionally TTS-preview only;
     no show audio is ever recorded. */
  var minerCue = null, minerShot = null, minerTokens = [];
  function minerEl() { return minerPanel || null; }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // Pitch accent data (Kanjium-derived, see README), lazy-loaded so the
  // base extension never pays for it until the miner opens.
  var pitchData = null, pitchPromise = null;
  function loadPitch() {
    if (pitchData) return Promise.resolve(pitchData);
    if (pitchPromise) return pitchPromise;
    pitchPromise = fetch(chrome.runtime.getURL("dict/pitch.json"))
      .then(function (r) { if (!r.ok) throw new Error("no pitch data"); return r.json(); })
      .then(function (d) { pitchData = d || {}; return pitchData; })
      .catch(function () { pitchData = {}; return pitchData; });
    return pitchPromise;
  }
  function pitchFor(word, readingHira) {
    if (!pitchData || !word) return "";
    var arr = pitchData[word];
    if (!arr || !arr.length) return "";
    for (var i = 0; i < arr.length; i++) if (!readingHira || arr[i][0] === readingHira) return arr[i][1];
    return arr[0][1];
  }
  function minerRubyInto(el, toks) {
    // Same ruby rendering as the caption overlay, as static spans.
    el.innerHTML = "";
    toks.forEach(function (tok) {
      var parts = rubyParts(tok.surface_form, tok.reading);
      if (parts) {
        el.appendChild(document.createTextNode(parts.prefix));
        var ruby = document.createElement("ruby");
        ruby.appendChild(document.createTextNode(parts.base));
        var rt = document.createElement("rt"); rt.textContent = parts.ruby;
        ruby.appendChild(rt);
        el.appendChild(ruby);
        el.appendChild(document.createTextNode(parts.suffix));
      } else el.appendChild(document.createTextNode(tok.surface_form));
    });
  }
  function openMiner() {
    var mel = minerEl(); if (!mel) return;
    var cue = state.activeIndex >= 0 ? state.jpCues[state.activeIndex] : null;
    if (!cue && state.jpCues.length) {
      var v0 = videoEl();
      if (v0) { var idx = findCue(state.jpCues, v0.currentTime); if (idx >= 0) cue = state.jpCues[idx]; }
    }
    if (!cue) { setStatus("warn", "No subtitle line under the playhead to mine yet."); return; }
    minerCue = cue; minerShot = null;
    var v = videoEl(); if (v && !v.paused) { try { v.pause(); } catch (e) {} }
    if (wordCard) wordCard.hidden = true;
    togglePanel(false);
    mel.hidden = false;
    mel.querySelector("#sp-mn-sub").textContent = fmt(cue.start) + " - " + String(document.title || "").slice(0, 60);
    mel.querySelector("#sp-mn-msg").textContent = "";
    minerTokens = tokenize(cue.text) || [];
    var sentEl = mel.querySelector("#sp-mn-sent");
    if (minerTokens.length) minerRubyInto(sentEl, minerTokens);
    else sentEl.textContent = cue.text;
    var wordsEl = mel.querySelector("#sp-mn-words");
    wordsEl.innerHTML = "";
    loadPitch().then(function () {
      var seen = {}, any = false;
      minerTokens.forEach(function (tok) {
        var surf = tok.surface_form;
        if (!hasKanji(surf) || seen[surf]) return;
        seen[surf] = 1; any = true;
        var reading = (tok.reading && tok.reading !== "*") ? kataToHira(tok.reading) : "";
        var base = (tok.basic_form && tok.basic_form !== "*") ? tok.basic_form : surf;
        var hit = lookupWord(base, surf, reading);
        var pitch = pitchFor(surf, reading) || pitchFor(base, reading);
        var row = document.createElement("div"); row.className = "sp-mn-word";
        var w = document.createElement("span"); w.className = "sp-mn-w"; w.textContent = surf;
        var r = document.createElement("span"); r.className = "sp-mn-r";
        r.textContent = reading + (pitch !== "" ? " [" + pitch + "]" : "");
        var g = document.createElement("span"); g.className = "sp-mn-g";
        g.textContent = hit ? hit.meaning : "(no definition)";
        row.appendChild(w); row.appendChild(r); row.appendChild(g);
        wordsEl.appendChild(row);
      });
      if (!any) wordsEl.innerHTML = '<div class="sp-subs-hint">No kanji words in this line.</div>';
    });
    var shotImg = mel.querySelector("#sp-mn-shot");
    shotImg.removeAttribute("src"); shotImg.style.display = "none";
    try {
      chrome.runtime.sendMessage({ type: "SP_MINER_SHOT" }, function (resp) {
        if (resp && resp.ok && resp.dataUrl) {
          minerShot = resp.dataUrl;
          shotImg.src = resp.dataUrl;
          shotImg.style.display = "";
        }
      });
    } catch (e) {}
  }
  function closeMiner() {
    var mel = minerEl(); if (mel) mel.hidden = true;
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
  }
  function minerListen() {
    if (!minerCue) return;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(minerCue.text);
      u.lang = "ja-JP"; u.rate = 0.85;
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  function minerCardFields() {
    if (!minerCue) return null;
    var reading = minerTokens.map(function (t) {
      return (t.reading && t.reading !== "*") ? kataToHira(t.reading) : t.surface_form;
    }).join("");
    var glosses = [], seen = {};
    minerTokens.forEach(function (t) {
      var surf = t.surface_form;
      if (!hasKanji(surf) || seen[surf]) return;
      seen[surf] = 1;
      var rd = (t.reading && t.reading !== "*") ? kataToHira(t.reading) : "";
      var base = (t.basic_form && t.basic_form !== "*") ? t.basic_form : surf;
      var hit = lookupWord(base, surf, rd);
      if (hit) glosses.push(surf + " [" + (rd || hit.reading || "") + "]: " + hit.meaning);
    });
    return {
      sentence: minerCue.text,
      reading: reading,
      glosses: glosses,
      time: fmt(minerCue.start),
      title: String(document.title || "")
    };
  }
  function minerToAnki() {
    var mel = minerEl(); if (!mel) return;
    var msgEl = mel.querySelector("#sp-mn-msg");
    var f = minerCardFields(); if (!f) return;
    msgEl.textContent = "Contacting AnkiConnect on your machine...";
    var back = escapeHtml(f.reading) + "<br><br>" +
      f.glosses.map(escapeHtml).join("<br>") +
      "<br><br><small>" + escapeHtml(f.title) + " - " + escapeHtml(f.time) + "</small>";
    var note = {
      deckName: "Default",
      modelName: "Basic",
      fields: { Front: escapeHtml(f.sentence), Back: back },
      options: { allowDuplicate: false },
      tags: ["furigana-anywhere"]
    };
    if (minerShot && minerShot.indexOf(",") > 0) {
      note.picture = [{ data: minerShot.split(",")[1], filename: "fa_mine_" + Date.now() + ".jpg", fields: ["Back"] }];
    }
    fetch("http://127.0.0.1:8765", {
      method: "POST",
      body: JSON.stringify({ action: "addNote", version: 6, params: { note: note } })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.error) msgEl.textContent = "Anki said: " + j.error;
      else { msgEl.textContent = "Sent to Anki."; closeMiner(); }
    }).catch(function () {
      msgEl.textContent = "AnkiConnect is not reachable. Open Anki with the AnkiConnect add-on installed, or use CSV instead.";
    });
  }
  function minerToCsv() {
    var mel = minerEl();
    var f = minerCardFields(); if (!f) return;
    var rows = [["sentence", "reading", "words", "time", "video"]];
    rows.push([f.sentence, f.reading, f.glosses.join(" | "), f.time, f.title]);
    var csv = "\uFEFF" + rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n");
    var url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    var a = document.createElement("a"); a.href = url; a.download = "mined-sentence.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    if (mel) mel.querySelector("#sp-mn-msg").textContent = "CSV downloaded.";
  }
  /* ---------- Captions ---------- */
  function pickTrack(tracks, lang) {
    var exact = tracks.filter(function (t) { return t.languageCode === lang; });
    var any = tracks.filter(function (t) { return t.languageCode && t.languageCode.indexOf(lang) === 0; });
    var pool = exact.length ? exact : any;
    if (!pool.length) return null;
    var manual = pool.filter(function (t) { return t.kind !== "asr"; });
    return (manual.length ? manual : pool)[0];
  }
  function fetchCues(track) {
    if (!track || !track.baseUrl) return Promise.resolve([]);
    // Bug fix (2.1): the old check tested the wrong offset, so it was true
    // even for absolute URLs (https: puts the slashes at index 5) and the
    // origin got prepended onto an already-absolute URL, so every YouTube
    // caption fetch went to a nonsense address and came back empty.
    function withFmt(base, fmtVal) {
      var u = base;
      if (/[?&]fmt=/.test(u)) u = u.replace(/([?&]fmt=)[^&]+/, "$1" + fmtVal);
      else u += (u.indexOf("?") === -1 ? "?" : "&") + "fmt=" + fmtVal;
      if (u.indexOf("://") === -1) u = "https://www.youtube.com" + (u.charAt(0) === "/" ? "" : "/") + u;
      return u;
    }
    function parseJson3(txt) {
      if (!txt || txt.trim().charAt(0) !== "{") return [];
      var data; try { data = JSON.parse(txt); } catch (e) { return []; }
      var cues = [];
      (data.events || []).forEach(function (ev) {
        if (!ev.segs) return;
        var text = cleanText(ev.segs.map(function (s) { return s.utf8 || ""; }).join(""));
        if (!text) return;
        var start = (ev.tStartMs || 0) / 1000, end = start + (ev.dDurationMs || 2000) / 1000;
        cues.push({ start: start, end: end, text: text });
      });
      return cues.sort(function (a, b) { return a.start - b.start; });
    }
    var url3 = withFmt(track.baseUrl, "json3");
    diagLog("YT fetch " + (track.languageCode || "?") + " json3");
    return fetchText(url3).then(function (txt) {
      var cues = parseJson3(txt);
      if (cues.length) return cues;
      diagLog("json3 empty for " + (track.languageCode || "?") + ", trying srv3/vtt");
      return fetchText(withFmt(track.baseUrl, "srv3")).then(function (t2) {
        var c2 = parseSubtitles(t2);
        if (c2.length) return c2;
        return fetchText(withFmt(track.baseUrl, "vtt")).then(function (t3) { return parseSubtitles(t3); }).catch(function () { return []; });
      }).catch(function () { return []; });
    }).catch(function () { return []; });
  }
  function handleTracks(videoId, tracks) {
    if (!tracks || !tracks.length) { setStatus("warn", "No caption tracks found on this video"); return; }
    if (state.currentVideoId === videoId && state.jpCues.length) return;
    state.currentVideoId = videoId;
    state.tracksSeen = tracks;
    diagLog("YT tracks: " + tracks.map(function (t) { return t.languageCode + (t.kind ? "/" + t.kind : ""); }).join(", "));
    setStatus("", "Loading Japanese subtitles");
    var jpTrack = pickTrack(tracks, "ja");
    var enTrack = pickTrack(tracks, "en");
    if (!jpTrack) {
      setStatus("warn", "No Japanese subtitles on this video. Try another video with CC.");
      state.jpCues = []; state.enCues = []; state.activeIndex = -1;
      if (jpEl) jpEl.textContent = "";
      if (enEl) enEl.textContent = "";
      renderTranscript();
      return;
    }
    var label = jpTrack.kind === "asr" ? "Japanese (auto-generated)" : "Japanese subtitles";
    Promise.all([fetchCues(jpTrack), enTrack ? fetchCues(enTrack) : Promise.resolve([])]).then(function (res) {
      state.jpCues = res[0]; state.enCues = res[1]; state.activeIndex = -1; state.tokenCache.clear();
      if (!state.jpCues.length) {
        diagLog("YT track fetch empty - asking player to load CC so its own request can be captured");
        setStatus("warn", "Japanese track came back empty. Turn CC on in the player once, or use Load sub.");
        try { window.postMessage({ type: "SP_FORCE_YT_CC", lang: jpTrack.languageCode || "ja" }, "*"); } catch (e) {}
        return;
      }
      setStatus("ready", label + " - " + state.jpCues.length + " lines" + (state.enCues.length ? " - EN translation on" : " - no EN track"));
      renderTranscript(); renderVocab(); updateForTime(true);
      hideNativeTracks();
    }).catch(function () { setStatus("warn", "Could not load subtitle files"); });
  }

  /* ---------- Tokenizer ---------- */
  function initTokenizer() {
    // YouTube sometimes inserts its <video> after DOMContentLoaded. In 2.3.0
    // boot() only reached this function when a video already existed, so on
    // those pages subtitles loaded normally but stayed plain and unclickable.
    // Keep initialization independent of player timing and make it idempotent.
    if (state.tokenizerStatus !== "idle") return;
    if (!window.kuromoji) {
      state.tokenizerStatus = "failed";
      setStatus("warn", "Furigana engine missing. Plain subtitles still work.");
      return;
    }
    state.tokenizerStatus = "loading";
    setStatus("", "Loading furigana engine (first video only)");
    try {
      window.kuromoji.builder({ dicPath: chrome.runtime.getURL("dict/") }).build(function (err, tok) {
        if (err || !tok) {
          state.tokenizerStatus = "failed";
          diagLog("furigana engine failed" + (err && err.message ? " - " + err.message : ""));
          setStatus("warn", "Furigana unavailable. Plain subtitles still work.");
          return;
        }
        state.tokenizer = tok;
        state.tokenizerStatus = "ready";
        state.tokenCache.clear();
        diagLog("furigana engine ready");
        setStatus("ready", state.jpCues.length ? "Furigana ready" : "Furigana ready - pick a video with Japanese CC");
        if (state.activeIndex >= 0) renderActive();
      });
    } catch (e) {
      state.tokenizerStatus = "failed";
      diagLog("furigana engine failed" + (e && e.message ? " - " + e.message : ""));
      setStatus("warn", "Furigana unavailable on this page");
    }
  }

  /* ---------- Video wiring ---------- */
  var wiredVideo = null, rafId = 0;
  function tick() {
    updateForTime(false);
    // v2.3.4: YouTube sometimes swaps the <video> element mid-playback
    // (ad transitions, quality changes). The old element goes paused, the
    // rAF loop below stops scheduling itself, and the new element never
    // fires "play" because it is already playing, so captions froze.
    // Re-wire to the live element and keep the loop alive.
    var cur = videoEl();
    if (cur && cur !== wiredVideo) wireVideo();
    cur = wiredVideo;
    if (cur && !cur.paused && !cur.ended) rafId = requestAnimationFrame(tick);
  }
  function wireVideo() {
    var v = videoEl(); if (!v || v === wiredVideo) return;
    wiredVideo = v;
    v.addEventListener("play", function () { cancelAnimationFrame(rafId); tick(); hideNativeTracks(); pollNativeTracks(); setTimeout(pollNativeTracks, 1200); setTimeout(pollNativeTracks, 3500); });
    v.addEventListener("pause", function () { cancelAnimationFrame(rafId); updateForTime(false); });
    v.addEventListener("seeked", function () { updateForTime(true); });
    v.addEventListener("timeupdate", function () { updateForTime(false); });
    try { v.playbackRate = Number((document.getElementById("sp-speed") || {}).value || 1); } catch (e) {}
    // v2.3.4: a freshly swapped-in element is already playing, so no "play"
    // event will arrive. Kick the caption loop directly.
    if (!v.paused && !v.ended) { cancelAnimationFrame(rafId); tick(); }
  }

  function saveSettings() {
    try { chrome.storage.local.set({ sp_settings: { enabled: state.enabled, furigana: state.furigana, translation: state.translation, controlsCollapsed: state.controlsCollapsed } }); } catch (e) {}
  }
  function loadPersisted() {
    try {
      chrome.storage.local.get(["sp_settings", "sp_vocab"], function (res) {
        if (res.sp_settings) {
          state.enabled = res.sp_settings.enabled !== false;
          state.furigana = res.sp_settings.furigana !== false;
          state.translation = res.sp_settings.translation !== false;
          state.controlsCollapsed = res.sp_settings.controlsCollapsed === true;
        }
        if (Array.isArray(res.sp_vocab)) state.vocab = res.sp_vocab;
        applyToggles(); renderVocab();
      });
    } catch (e) {
      try { state.vocab = JSON.parse(localStorage.getItem("sp_vocab") || "[]"); } catch (e2) {}
      renderVocab();
    }
  }
  /* ---------- Boot ---------- */
  /* The page-world bridge (injected.js) is declared in manifest.json as a
     content script with world:"MAIN". There is intentionally NO DOM
     <script> injection here: YouTube's Trusted Types CSP blocks inline
     script injection, which used to wedge the UI on "loading". */
  var captionWatchdog = null;
  function clearCaptionWatchdog() { if (captionWatchdog) { clearTimeout(captionWatchdog); captionWatchdog = null; } }
  function armCaptionWatchdog() {
    clearCaptionWatchdog();
    captionWatchdog = setTimeout(function () {
      captionWatchdog = null;
      if (!state.jpCues.length) {
        setStatus("warn", "No subtitles found yet. Press play, turn the player's CC on, or use Load sub to add an .srt/.vtt file.");
      }
    }, 12000);
  }
  window.addEventListener("message", function (ev) {
    if (ev.source === window && ev.data && ev.data.type === "SP_GENERIC_SUB_URL") { ensureRoot(); addDiscovered(ev.data.url); return; }
    if (ev.source === window && ev.data && ev.data.type === "SP_GENERIC_SUB_TEXT") { ensureRoot(); loadSubtitleText(ev.data.text, ev.data.url); return; }
    if (ev.source !== window || !ev.data) return;
    if (ev.data.type === "SP_CAPTION_TRACKS") {
      clearCaptionWatchdog();
      ensureRoot(); handleTracks(ev.data.videoId, ev.data.tracks);
      return;
    }
    if (ev.data.type === "SP_CAPTION_UNAVAILABLE") {
      clearCaptionWatchdog();
      ensureRoot();
      if (!state.jpCues.length) setStatus("warn", "No subtitles found yet. Press play, turn the player's CC on, or use Load sub to add an .srt/.vtt file.");
    }
  });
  function boot() {
    // Start the furigana engine even when the player has not mounted yet.
    // Auto-caption videos can create their video element later than manual-CC
    // videos, which previously skipped tokenizer startup entirely.
    initTokenizer();
    if (ensureRoot()) { wireVideo(); loadPersisted(); updateForTime(true); armCaptionWatchdog(); }
  }
  var bootTimer = setInterval(function () {
    initTokenizer();
    if (ensureRoot()) { wireVideo(); pollNativeTracks(); }
  }, 1500);
  try {
    new MutationObserver(function () { if (ensureRoot()) wireVideo(); }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
  loadDictionary();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  document.addEventListener("yt-navigate-finish", function () {
    state.jpCues = []; state.enCues = []; state.activeIndex = -1; state.currentVideoId = "";
    state.autoTried = {}; state.autoLoadedFrom = ""; state.diag = []; state.tracksSeen = []; state.tokenCache.clear();
    setTimeout(function () { var old = document.getElementById("sp-root"); if (old) old.remove(); if (panel) { panel.remove(); panel = null; } ensureRoot(); wireVideo(); loadPersisted(); armCaptionWatchdog(); }, 400);
  });
  document.addEventListener("keydown", function (ev) {
    var tag = (ev.target && ev.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || ev.target.isContentEditable) return;
    var k = ev.key.toLowerCase();
    if (k === "r") { ev.preventDefault(); replay(); }
    else if (k === "f") { state.furigana = !state.furigana; applyToggles(); saveSettings(); }
    else if (k === "e") { state.translation = !state.translation; applyToggles(); saveSettings(); }
  });
  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg && msg.type === "SP_GET_STATE") {
      sendResponse({ enabled: state.enabled, furigana: state.furigana, translation: state.translation, vocabCount: state.vocab.length, lines: state.jpCues.length, enLines: state.enCues.length, found: state.discovered.length, tracks: (state.tracksSeen || []).map(function (t) { return t.languageCode; }), native: state.nativeInfo || [], dict: state.dictStatus, dictWords: state.dict ? Object.keys(state.dict).length : 0, diag: (state.diag || []).slice(0, 8) });
      return true;
    }
    if (msg && msg.type === "SP_SET") {
      if (typeof msg.enabled === "boolean") state.enabled = msg.enabled;
      if (typeof msg.furigana === "boolean") state.furigana = msg.furigana;
      if (typeof msg.translation === "boolean") state.translation = msg.translation;
      applyToggles(); saveSettings();
      sendResponse({ ok: true }); return true;
    }
    if (msg && msg.type === "SP_TOGGLE_PANEL") { togglePanel(); sendResponse({ ok: true }); return true; }
  });
})();
