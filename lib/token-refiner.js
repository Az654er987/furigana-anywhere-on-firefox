(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SPTokenRefiner = api;
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";

  function isLongKatakana(text) {
    return /^[\u30a1-\u30fa\u30fc\u30fd\u30fe]+$/.test(text || "") && Array.from(text).length >= 5;
  }

  function oneKnownToken(tokenizer, text) {
    try {
      var result = tokenizer.tokenize(text);
      return result.length === 1 && result[0].word_type === "KNOWN" && result[0].surface_form === text ? result[0] : null;
    } catch (e) {
      return null;
    }
  }

  // IPADIC treats an uninterrupted unknown katakana run as one proper noun.
  // Auto-captions remove spaces, so several ordinary loanwords can become one
  // giant click target. Recover only strong (4+ character) dictionary matches;
  // the conservative minimum avoids breaking unknown names into tiny fragments.
  function splitUnknownKatakana(token, tokenizer) {
    var text = token && token.surface_form || "";
    if (!tokenizer || token.word_type !== "UNKNOWN" || !isLongKatakana(text)) return [token];

    var chars = Array.from(text), n = chars.length;
    var best = new Array(n + 1), prev = new Array(n + 1);
    best[0] = 0;
    for (var i = 0; i < n; i++) {
      if (typeof best[i] !== "number") continue;
      var unknownScore = best[i] - 1;
      if (typeof best[i + 1] !== "number" || unknownScore > best[i + 1]) {
        best[i + 1] = unknownScore;
        prev[i + 1] = { at: i, known: null, text: chars[i] };
      }
      for (var j = i + 4; j <= n && j <= i + 16; j++) {
        var part = chars.slice(i, j).join("");
        var known = oneKnownToken(tokenizer, part);
        if (!known) continue;
        var score = best[i] + ((j - i) * (j - i)) + 3;
        if (typeof best[j] !== "number" || score > best[j]) {
          best[j] = score;
          prev[j] = { at: i, known: known, text: part };
        }
      }
    }

    var pieces = [], cursor = n, knownCount = 0;
    while (cursor > 0 && prev[cursor]) {
      var step = prev[cursor];
      pieces.unshift(step);
      if (step.known) knownCount++;
      cursor = step.at;
    }
    if (cursor !== 0 || !knownCount) return [token];

    var output = [];
    pieces.forEach(function (piece) {
      if (piece.known) {
        output.push(piece.known);
        return;
      }
      var last = output[output.length - 1];
      if (last && last.__spUnknownPiece) {
        last.surface_form += piece.text;
      } else {
        var unknown = Object.assign({}, token, {
          surface_form: piece.text,
          basic_form: "*",
          reading: undefined,
          pronunciation: undefined,
          __spUnknownPiece: true
        });
        output.push(unknown);
      }
    });
    output.forEach(function (item) { if (item && item.__spUnknownPiece) delete item.__spUnknownPiece; });
    return output.length > 1 ? output : [token];
  }

  function refine(tokens, tokenizer) {
    var result = [];
    (tokens || []).forEach(function (token) {
      splitUnknownKatakana(token, tokenizer).forEach(function (part) { result.push(part); });
    });
    return result;
  }

  return { refine: refine, splitUnknownKatakana: splitUnknownKatakana };
});
