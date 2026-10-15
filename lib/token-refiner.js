(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SPTokenRefiner = api;
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";

  var KATAKANA_RE = /^[\u30a1-\u30fa\u30fc\u30fd\u30fe]+$/;
  var DASH_RE = /^ー+$/;
  var MIN_RUN = 4;        // shortest katakana run worth attempting to split
  var MIN_CHUNK = 2;      // shortest dictionary chunk considered (JMdict path)
  var LEGACY_MIN_CHUNK = 4; // shortest chunk considered (IPADIC-only fallback path)
  var MAX_CHUNK = 16;
  var MIN_COVERAGE = 0.5; // known chars / total chars required to accept a split
  var MIN_UNKNOWN_PIECE = 4; // unknown fragments must be this long, so names
                             // like タナカタロウ cannot shred into タ|ナカ|タロウ

  function isKatakanaRun(text) {
    return KATAKANA_RE.test(text || "") && Array.from(text).length >= MIN_RUN;
  }

  function oneKnownToken(tokenizer, text) {
    try {
      var result = tokenizer.tokenize(text);
      return result.length === 1 && result[0].word_type === "KNOWN" && result[0].surface_form === text ? result[0] : null;
    } catch (e) {
      return null;
    }
  }

  function synthKnownToken(template, text) {
    // Katakana reads itself, so a synthesized token is always correct on reading.
    return Object.assign({}, template, {
      word_type: "KNOWN",
      surface_form: text,
      basic_form: text,
      reading: text,
      pronunciation: text,
      pos: "\u540d\u8a5e",
      pos_detail_1: "\u4e00\u822c",
      pos_detail_2: "*",
      pos_detail_3: "*",
      conjugated_type: "*",
      conjugated_form: "*"
    });
  }

  // IPADIC treats an uninterrupted unknown katakana run as one proper noun.
  // Auto-captions remove spaces, so several ordinary loanwords can become one
  // giant click target. Recover dictionary words inside the run with a
  // longest-match dynamic program. When the bundled JMdict is available
  // (opts.hasWord), chunks as short as 2 characters are considered and a
  // split is only accepted when known chunks cover most of the run, so names
  // like ヒカキン are left alone. Without the dictionary, fall back to the
  // conservative IPADIC-only behavior (4+ character chunks).
  function splitKatakanaRun(token, tokenizer, hasWord) {
    var text = (token && token.surface_form) || "";
    if (!tokenizer || !isKatakanaRun(text)) return [token];
    if (token.word_type === "KNOWN") {
      // Only re-split a known token when the bundled dictionary cannot define
      // the whole thing, meaning IPADIC glued a compound JMdict never heard of.
      if (!hasWord || hasWord(text)) return [token];
    } else if (token.word_type !== "UNKNOWN") {
      return [token];
    }

    var minChunk = hasWord ? MIN_CHUNK : LEGACY_MIN_CHUNK;
    var isWord = hasWord
      ? function (part) { return hasWord(part); }
      : function (part) { return part.length >= LEGACY_MIN_CHUNK && !!oneKnownToken(tokenizer, part); };

    // IPADIC's unknown-word handler sometimes leaves a trailing ー run
    // outside the token (インターネットエクスプローラー + ー). The coverage
    // rule below exempts it, and the merge pass in refine() folds it back.
    var chars = Array.from(text), n = chars.length;
    var best = new Array(n + 1), prev = new Array(n + 1);
    best[0] = 0;
    for (var i = 0; i < n; i++) {
      if (typeof best[i] !== "number") continue;
      var unknownScore = best[i] - 1;
      if (typeof best[i + 1] !== "number" || unknownScore > best[i + 1]) {
        best[i + 1] = unknownScore;
        prev[i + 1] = { at: i, text: chars[i], known: false };
      }
      for (var j = i + minChunk; j <= n && j <= i + MAX_CHUNK; j++) {
        var part = chars.slice(i, j).join("");
        if (!isWord(part)) continue;
        var score = best[i] + ((j - i) * (j - i)) + 3;
        if (typeof best[j] !== "number" || score > best[j]) {
          best[j] = score;
          prev[j] = { at: i, text: part, known: true };
        }
      }
    }

    var pieces = [], cursor = n, knownChars = 0, knownCount = 0, maxKnownLen = 0;
    while (cursor > 0 && prev[cursor]) {
      var step = prev[cursor];
      pieces.unshift(step);
      if (step.known) {
        var pieceLen = Array.from(step.text).length;
        knownChars += pieceLen; knownCount++;
        if (pieceLen > maxKnownLen) maxKnownLen = pieceLen;
      }
      cursor = step.at;
    }
    if (cursor !== 0 || !knownCount) return [token];
    if (hasWord) {
      // With the dictionary available, demand real coverage, forbid tiny
      // unknown fragments, and require at least one chunk of 3+ characters,
      // so coincidental 2-character matches (アク|オス inside アクオス,
      // アリ inside アリス, タ|ナカ|タロウ) cannot shred names and brand
      // words into nonsense pieces. A trailing run of bare ー marks is
      // IPADIC's unknown-word quirk, not a real fragment, so it is exempt
      // from the fragment-size rule.
      var end = pieces.length;
      while (end > 0 && !pieces[end - 1].known && DASH_RE.test(pieces[end - 1].text)) end--;
      var unknownRuns = [], runLen = 0;
      pieces.slice(0, end).forEach(function (p) {
        if (p.known) { if (runLen) { unknownRuns.push(runLen); runLen = 0; } }
        else runLen += Array.from(p.text).length;
      });
      if (runLen) unknownRuns.push(runLen);
      var minUnknown = unknownRuns.length ? Math.min.apply(null, unknownRuns) : Infinity;
      if (knownChars / n < MIN_COVERAGE || minUnknown < MIN_UNKNOWN_PIECE || maxKnownLen < 3) return [token];
      // A 2-character chunk is only trustworthy next to a longer word.
      // Otherwise coincidental pairs (アク|オス inside the brand name
      // アクオス) shred real words, while anchored pairs (タイ|ヌードル,
      // カキ|フライ) still split.
      for (var pi = 0; pi < pieces.length; pi++) {
        var pc = pieces[pi];
        if (!pc.known || Array.from(pc.text).length !== 2) continue;
        var anchored = false;
        for (var qi = pi - 1; qi <= pi + 1; qi++) {
          if (qi === pi || qi < 0 || qi >= pieces.length) continue;
          var nb = pieces[qi];
          if (nb.known && Array.from(nb.text).length >= 3) { anchored = true; break; }
        }
        if (!anchored) return [token];
      }
    }

    var output = [];
    pieces.forEach(function (piece) {
      if (piece.known) {
        output.push(oneKnownToken(tokenizer, piece.text) || synthKnownToken(token, piece.text));
        return;
      }
      var last = output[output.length - 1];
      if (last && last.__spUnknownPiece) {
        last.surface_form += piece.text;
        last.reading = last.surface_form;
      } else {
        output.push(Object.assign({}, token, {
          word_type: "UNKNOWN",
          surface_form: piece.text,
          basic_form: "*",
          reading: piece.text,
          pronunciation: undefined,
          __spUnknownPiece: true
        }));
      }
    });
    output.forEach(function (item) { if (item && item.__spUnknownPiece) delete item.__spUnknownPiece; });
    return output;
  }

  // Katakana reads itself: even an unsplittable katakana token deserves a
  // reading so the word card and the romaji line stay useful.
  function ensureKatakanaReading(token) {
    if (token && token.word_type === "UNKNOWN" && !token.reading &&
        KATAKANA_RE.test(token.surface_form || "")) {
      token.reading = token.surface_form;
    }
    return token;
  }

  function refine(tokens, tokenizer, opts) {
    var hasWord = opts && typeof opts.hasWord === "function" ? opts.hasWord : null;
    var result = [];
    (tokens || []).forEach(function (token) {
      splitKatakanaRun(token, tokenizer, hasWord).forEach(function (part) {
        result.push(ensureKatakanaReading(part));
      });
    });
    if (hasWord) {
      // Kuromoji/IPADIC sometimes splits a real katakana word into pieces
      // (ガン|ダム for ガンダム). Fuse adjacent katakana tokens when the fused
      // form is a dictionary word. Only short pieces (2 chars or fewer) are
      // fused: longer adjacent words like チョコレート|ケーキ are legitimate
      // click targets on their own, and fusing them would only remove
      // interactivity. The dictionary-membership requirement keeps this from
      // gluing words that merely sit next to each other.
      var fused = [];
      result.forEach(function (tok) {
        var prevTok = fused[fused.length - 1];
        var prevLen = prevTok ? Array.from(prevTok.surface_form || "").length : 0;
        var tokLen = tok ? Array.from(tok.surface_form || "").length : 0;
        var word = prevTok && tok ? prevTok.surface_form + tok.surface_form : "";
        if (prevTok && tok && Math.min(prevLen, tokLen) <= 2 &&
            KATAKANA_RE.test(prevTok.surface_form || "") &&
            KATAKANA_RE.test(tok.surface_form || "") && hasWord(word)) {
          prevTok.surface_form = word;
          prevTok.basic_form = word;
          if (prevTok.reading && KATAKANA_RE.test(prevTok.reading) &&
              tok.reading && KATAKANA_RE.test(tok.reading)) {
            prevTok.reading = prevTok.reading + tok.reading;
          } else {
            prevTok.reading = word; // katakana reads itself
          }
          return;
        }
        fused.push(tok);
      });
      result = fused;
    }
    // IPADIC's unknown-word handler sometimes strands a bare ー run after a
    // katakana token (インターネットエクスプローラー + ー). Fold it back into
    // the previous katakana token when that token is a real dictionary word,
    // so the defined word keeps its definition instead of becoming unknown.
    if (hasWord) {
      var merged = [];
      result.forEach(function (tok) {
        var prevTok = merged[merged.length - 1];
        if (tok && tok.word_type === "UNKNOWN" && DASH_RE.test(tok.surface_form || "") &&
            prevTok && KATAKANA_RE.test(prevTok.surface_form || "") &&
            hasWord(prevTok.surface_form)) {
          prevTok.surface_form += tok.surface_form;
          if (prevTok.reading && KATAKANA_RE.test(prevTok.reading)) prevTok.reading += tok.surface_form;
          return;
        }
        merged.push(tok);
      });
      result = merged;
    }
    return result;
  }

  return {
    refine: refine,
    splitKatakanaRun: splitKatakanaRun,
    splitUnknownKatakana: function (token, tokenizer) {
      return splitKatakanaRun(token, tokenizer, null);
    }
  };
});
