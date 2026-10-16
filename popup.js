(function () {
  "use strict";
  var enabledEl = document.getElementById("enabled");
  var furiganaEl = document.getElementById("furigana");
  var translationEl = document.getElementById("translation");
  var statusEl = document.getElementById("status");
  var vocabMeta = document.getElementById("vocabMeta");

  function setStatus(text) { statusEl.textContent = text; }

  function sendToTab(message) {
    return new Promise(function (resolve) {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        var tab = tabs && tabs[0];
        if (!tab || !tab.id || !/^https?:/.test(tab.url || "")) { resolve(null); return; }
        try {
          chrome.tabs.sendMessage(tab.id, message, function (resp) {
            if (chrome.runtime.lastError) resolve(null); else resolve(resp);
          });
        } catch (e) { resolve(null); }
      });
    });
  }

  function refreshKnown() {
    sendToTab({ type: "SP_KNOWN_COUNT" }).then(function (resp) {
      var n = resp && resp.ok ? resp.count : 0;
      document.getElementById("knownMeta").textContent =
        (n ? n + (n === 1 ? " word" : " words") + " marked as known. " : "No known words yet. ") +
        "Known words fade in the captions so new words stand out.";
    });
  }

  function refresh() {
    chrome.storage.local.get(["sp_settings", "sp_vocab"], function (res) {
      var s = res.sp_settings || {};
      enabledEl.checked = s.enabled !== false;
      furiganaEl.checked = s.furigana !== false;
      translationEl.checked = s.translation !== false;
      var n = Array.isArray(res.sp_vocab) ? res.sp_vocab.length : 0;
      vocabMeta.textContent = n ? n + (n === 1 ? " word" : " words") + " saved. Open a video and use Transcript > Vocabulary to review, or Export on the video page." : "No saved words yet. Tap any Japanese word over a video to save it.";
    });
    sendToTab({ type: "SP_GET_STATE" }).then(function (resp) {
      if (!resp) { setStatus("Open any page with a video player to connect. Settings below still apply to the next video."); return; }
      var lines = resp.lines ? resp.lines + " Japanese lines loaded on this video." : "No Japanese lines loaded yet. On the video, press play, open Subs, or use Load sub to add an .srt/.vtt file.";
      if (resp.dict === "ready") lines += " Dictionary ready: " + resp.dictWords + " word forms, so tapped words show real definitions.";
      else if (resp.dict === "unavailable") lines += " Dictionary file failed to load; only the small built-in glossary will answer.";
      else if (resp.dict) lines += " Dictionary is loading, definitions will appear in a few seconds.";
      setStatus(lines);
    });
    sendToTab({ type: "SP_ANKI_GET" }).then(function (resp) {
      if (resp && resp.ok && resp.anki) {
        document.getElementById("ankiDeck").value = resp.anki.deck || "";
        document.getElementById("ankiModel").value = resp.anki.model || "";
        document.getElementById("ankiTags").value = resp.anki.tags || "";
      }
    });
    refreshKnown();
  }

  function push() {
    var settings = { enabled: enabledEl.checked, furigana: furiganaEl.checked, translation: translationEl.checked };
    chrome.storage.local.set({ sp_settings: settings });
    sendToTab({ type: "SP_SET", enabled: settings.enabled, furigana: settings.furigana, translation: settings.translation });
  }

  [enabledEl, furiganaEl, translationEl].forEach(function (el) { el.addEventListener("change", push); });

  document.getElementById("openPanel").addEventListener("click", function () {
    sendToTab({ type: "SP_TOGGLE_PANEL" }).then(function (resp) {
      if (!resp) setStatus("Open a page with a video player first, then try again.");
      window.close();
    });
  });

  function tabAction(type, okMsg, failMsg) {
    sendToTab({ type: type }).then(function (resp) {
      if (!resp) { setStatus("Open a page with a video player first, then try again."); return; }
      if (!resp.ok) {
        setStatus(resp.error === "no-cue" ? "No subtitle line under the playhead yet. Play the video first." : (failMsg || "That didn't work on this page."));
        return;
      }
      if (okMsg) setStatus(okMsg);
      window.close();
    });
  }

  document.getElementById("mineBtn").addEventListener("click", function () {
    tabAction("SP_MINE", "Mining this line into a flashcard.", "Couldn't mine on this page.");
  });

  document.getElementById("loadSubBtn").addEventListener("click", function () {
    tabAction("SP_LOAD_SUB", "Pick a subtitle file.", "Couldn't open the file picker on this page.");
  });

  document.getElementById("subsBtn").addEventListener("click", function () {
    tabAction("SP_SUBS", "Subtitle menu toggled on the video.", "Couldn't open the subtitle menu on this page.");
  });

  document.getElementById("exportBtn").addEventListener("click", function () {
    chrome.storage.local.get(["sp_vocab"], function (res) {
      var vocab = Array.isArray(res.sp_vocab) ? res.sp_vocab : [];
      if (!vocab.length) { setStatus("Nothing to export yet. Save a word from a video first."); return; }
      function cell(v) { return '"' + String(v || "").replace(/"/g, '""') + '"'; }
      var rows = [["Word", "Reading", "Part of speech", "Meaning", "Japanese context", "Translation"]];
      vocab.forEach(function (it) { rows.push([it.word, it.reading, it.pos, it.meaning, it.context, it.translation]); });
      var csv = "\uFEFF" + rows.map(function (r) { return r.map(cell).join(","); }).join("\r\n");
      var url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      var a = document.createElement("a"); a.href = url; a.download = "japanese-vocabulary.csv";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 800);
    });
  });

  document.getElementById("ankiSave").addEventListener("click", function () {
    var anki = {
      deck: document.getElementById("ankiDeck").value.trim() || "Default",
      model: document.getElementById("ankiModel").value.trim() || "Basic",
      tags: document.getElementById("ankiTags").value.trim()
    };
    sendToTab({ type: "SP_ANKI_SET", anki: anki }).then(function (resp) {
      document.getElementById("ankiMeta").textContent = resp
        ? "Saved. Mined cards go to deck '" + anki.deck + "' as '" + anki.model + "' notes."
        : "Open a page with a video player first, then try again.";
    });
  });

  document.getElementById("ankiTest").addEventListener("click", function () {
    var meta = document.getElementById("ankiMeta");
    meta.textContent = "Pinging AnkiConnect...";
    sendToTab({ type: "SP_ANKI_TEST" }).then(function (resp) {
      if (!resp) { meta.textContent = "Open a page with a video player first, then try again."; return; }
      meta.textContent = resp.ok
        ? "Connected: AnkiConnect v" + resp.version + " is listening."
        : "Not reachable (" + (resp.error || "no response") + "). Open Anki with the AnkiConnect add-on installed.";
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll(".bulkBtn"), function (btn) {
    btn.addEventListener("click", function () {
      var lvl = btn.getAttribute("data-bulk");
      btn.disabled = true;
      sendToTab({ type: "SP_KNOWN_BULK", level: lvl }).then(function (resp) {
        btn.disabled = false;
        if (!resp) { setStatus("Open a page with a video player first, then try again."); return; }
        setStatus(resp.ok ? "Marked " + resp.added + " new words as known (" + resp.total + " total)." : "That didn't work on this page.");
        refreshKnown();
      });
    });
  });

  document.getElementById("knownClear").addEventListener("click", function () {
    sendToTab({ type: "SP_KNOWN_CLEAR" }).then(function (resp) {
      if (!resp) { setStatus("Open a page with a video player first, then try again."); return; }
      setStatus("Known words cleared.");
      refreshKnown();
    });
  });

  refresh();
})();
