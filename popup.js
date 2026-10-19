(function () {
  "use strict";
  var powerEl = document.getElementById("power");
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

  /* Fork: On/Off switch. Off by default; sp_active drives the background's
     content script registration, and open tabs follow it on their own. */
  function renderPower(on) {
    powerEl.setAttribute("aria-pressed", String(on));
    document.getElementById("powerLabel").textContent = on ? "On" : "Off";
    document.getElementById("powerHint").textContent = on
      ? "On: the study layer runs on every page you open. Turn it off when you are done."
      : "Off: nothing runs on any page. Turn it on when you are on a page you want to study.";
    document.body.classList.toggle("is-off", !on);
  }
  function activeTab() {
    return new Promise(function (resolve) {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) { resolve(tabs && tabs[0]); });
    });
  }
  // Start the study layer in the current tab right away, without a reload.
  // A tab where it already ran follows the switch by itself (storage event).
  function injectIntoTab(tab) {
    if (!tab || !tab.id || !/^https?:/.test(tab.url || "")) return Promise.resolve();
    return new Promise(function (resolve) {
      chrome.tabs.sendMessage(tab.id, { type: "SP_PING" }, function (resp) {
        void chrome.runtime.lastError;
        if (resp && resp.ok) { resolve(); return; }
        var target = { tabId: tab.id, allFrames: true };
        Promise.all([
          chrome.scripting.insertCSS({ target: target, files: ["content.css"] }),
          chrome.scripting.executeScript({ target: target, files: ["injected.js"], world: "MAIN" })
        ]).then(function () {
          return chrome.scripting.executeScript({ target: target, files: ["lib/kuromoji.js", "lib/token-refiner.js", "content.js"] });
        }).catch(function (e) { console.warn("[Study Player] injection failed", e); }).then(resolve);
      });
    });
  }
  powerEl.addEventListener("click", function () {
    var on = powerEl.getAttribute("aria-pressed") !== "true";
    renderPower(on);
    chrome.storage.local.set({ sp_active: on }, function () {
      if (!on) return;
      setStatus("Starting on this page...");
      activeTab().then(injectIntoTab).then(function () { setTimeout(refresh, 1200); });
    });
  });

  function refreshKnown() {
    sendToTab({ type: "SP_KNOWN_COUNT" }).then(function (resp) {
      var n = resp && resp.ok ? resp.count : 0;
      document.getElementById("knownMeta").textContent =
        (n ? n + (n === 1 ? " word" : " words") + " marked as known. " : "No known words yet. ") +
        "Known words fade in the captions so new words stand out.";
    });
  }

  function refresh() {
    chrome.storage.local.get(["sp_settings", "sp_vocab", "sp_active"], function (res) {
      var s = res.sp_settings || {};
      renderPower(res.sp_active === true);
      furiganaEl.checked = s.furigana !== false;
      translationEl.checked = s.translation !== false;
      var n = Array.isArray(res.sp_vocab) ? res.sp_vocab.length : 0;
      vocabMeta.textContent = n ? n + (n === 1 ? " word" : " words") + " saved. Open a video and use Transcript > Vocabulary to review, or Export on the video page." : "No saved words yet. Tap any Japanese word over a video to save it.";
    });
    sendToTab({ type: "SP_GET_STATE" }).then(function (resp) {
      if (!resp || resp.active === false) { setStatus("Open any page with a video player to connect. Settings below still apply to the next video."); return; }
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
    var settings = { enabled: true, furigana: furiganaEl.checked, translation: translationEl.checked };
    chrome.storage.local.set({ sp_settings: settings });
    sendToTab({ type: "SP_SET", furigana: settings.furigana, translation: settings.translation });
  }

  [furiganaEl, translationEl].forEach(function (el) { el.addEventListener("change", push); });

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
