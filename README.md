# Study Player Anywhere

A browser extension that turns Japanese subtitles into a study layer on **almost any web video player**: furigana over every line, tap-any-word readings and meanings, line replay and looping, slowdown controls, a searchable transcript, and a saved-words list you can export.

Version 2.3.0 adds a minimize button to the player controls. Tap **−** at the right edge of the control bar to tuck the whole menu into one small **Controls** button; tap it again to restore the menu. The choice is remembered across pages.

Version 2.2.0 gives tapped words a real dictionary. Earlier builds only had a small built-in glossary, so most words showed "no definition" even though saving worked. The extension now bundles a JMdict common-word subset (about 30,000 entries, 68,000 lookup forms, readings and English meanings) and looks up the word's dictionary form, so inflected words like 行きます resolve to 行く with its definition. Lookups run fully offline; rare words outside the common subset still show their reading and can be saved.

Version 2.1.1 fixes the YouTube "Japanese track was empty" failure. The caption address was being mangled before the request was sent, so a perfectly good Japanese track came back empty every time. 2.1 also added automatic loading of discovered Japanese subtitles, HLS streaming-subtitle support, earlier detection (the reader now starts before the player does), a background fetch that gets past cross-origin blocks, and a diagnostics readout under **Subs** so a stubborn page shows what was found instead of failing silently.

## Install (Chrome, Edge, Brave, Arc)

1. Unzip this package somewhere you will keep it (do not delete the folder after installing, the browser loads from it).
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the unzipped folder (the folder that contains `manifest.json`).
5. Pin **Study Player Anywhere** from the puzzle-piece menu so you can reach it quickly.

Firefox: open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on**, and choose `manifest.json` inside the folder. Temporary add-ons are removed when Firefox restarts; for a permanent install you would need a signed build.

## Use it (any site)

1. Open a page with a video and **press play**. The study caption appears over the lower part of the player once Japanese lines are loaded.
2. Get Japanese subtitles in, in whichever way the site allows:
   - **Automatic (new):** when the extension spots a subtitle file on the page it now loads it by itself and tells you in the status pill. You no longer have to open **Subs** and pick it, though you still can.
   - **Player captions:** if the site's own player has a CC / subtitle menu, pick Japanese there. Study Player reads the player's subtitle track directly when the browser exposes it.
   - **Streaming (HLS) captions:** if the player streams with subtitle playlists, Study Player follows the playlist to the actual subtitle segments automatically.
   - **Subs button:** on the study control bar, **Subs** lists subtitle files (`.vtt` / `.srt` / `.ass` / HLS playlists) the extension spotted the page loading, plus a diagnostics readout (see Troubleshooting). Pick one to load it manually. Players that fetch their subtitle file when you press play often show up here a few seconds after playback starts.
   - **Load sub button:** pick an `.srt`, `.vtt`, or `.ass` file from your device (you can select a Japanese and an English file together). This always works, and it is the fallback for sites that hide their captions.
   - **YouTube:** open any YouTube video with a Japanese track (creator captions or auto-generated Japanese) and Study Player picks it up automatically; an English track, when present, shows under each line. If the direct caption fetch still comes back empty, turn the player's own CC on once - Study Player can then read the captions from the request the player itself makes.
3. Controls under the caption: **Replay** (or `R`), **Loop**, **Furigana** (or `F`), **EN** (or `E`), the speed menu for shadowing, **Transcript** for the searchable line list, **Load sub**, and **Subs**. Tap the **−** button at the right edge to minimize this control menu; tap the small **Controls** button to bring it back.
4. Tap any Japanese word in the big caption to see its reading and meaning, then **Save word**. Saved words live under Transcript, then Vocabulary, and in the toolbar popup, and export as CSV (Word, Reading, Part of speech, Meaning, Japanese context, Translation) for Anki or a spreadsheet.
5. Pages with several players: Study Player follows the one that is playing, or the largest one. The Subs menu tells you how many players it found.

## What it cannot read (please read)

- **Burned-in subtitles** that are part of the picture are pixels, not text. Nothing can extract them; grab a separate Japanese `.srt` for that video and use **Load sub**.
- **DRM-locked players** (the big subscription services) do not hand subtitle data to extensions in a readable form. This build deliberately targets ordinary HTML5 players, which covers most other sites.
- A site in a **cross-origin iframe** player can limit what any extension can see. **Load sub** still works there whenever the video itself is reachable.
- `.ass` styling and positioning are stripped; only the dialogue text and timing are used. `.ssa` is treated the same way.
- If a site never exposes any subtitle file and has no CC menu, **Load sub** with a subtitle file you sourced yourself is the whole answer. Subtitle files are widely available separately from videos.

## Good to know

- Plain Japanese text always works. Furigana is generated locally in your browser with a built-in Japanese dictionary (the `dict` folder), so the first video takes a few seconds while it loads, then it is instant for the rest of the session. It works fully offline after that.
- Word definitions come from a bundled subset of JMdict, the EDRDG Japanese-English dictionary (common words, about 30,000 entries). It loads once per page in the background; a word tapped during those first seconds fills its definition in automatically when the dictionary lands. Words outside the subset still show the correct reading and can be saved with their sentence context. JMdict is (C) the Electronic Dictionary Research and Development Group, used under their licence (https://www.edrdg.org/edrdg/licence.html).
- Native player captions are hidden while the overlay is on so you do not see double subtitles. Your player's own caption settings are not changed.
- Saved words are stored only in this browser (`chrome.storage.local`). Clearing the extension's data clears the list, so export a CSV when it matters.
- Because this build runs on any site, the browser will show a broader site-access permission than the old YouTube-only build. The extension still makes no analytics calls and sends nothing anywhere; it only reads the page's own video and subtitle data locally, plus local files inside the extension.

## Updating (do both reloads, or the old code keeps running)

Chrome and Edge do not auto-update unpacked extensions. Unzip this version over (or next to) the old folder, open `chrome://extensions` (or `edge://extensions`), find **Study Player Anywhere**, click **Reload**, then reload the video tab too. Skipping either reload leaves the old code running. Your saved words carry over. This update takes the version to 2.3.0; the version on the extension card is the quickest way to confirm you are running it.

## Troubleshooting

- **Still no subtitles**: open **Subs** on the video. The top box is the diagnostics readout: it shows the page, how many video players and player subtitle tracks were found (with their languages and line counts), which YouTube caption tracks exist, how many subtitle files were spotted, and a short log of what was fetched and what came back. Hit **Retry detection** after pressing play and turning the player's CC on. If you send anyone a bug report, that readout is the useful part.
- **"Japanese track was empty" on YouTube**: fixed in 2.1.1. If you still see it, confirm the extension card says 2.3.0 and both reloads above were done, then try turning YouTube's own CC button on once and hitting **Retry detection** in **Subs**.
- **Furigana missing but subtitles show**: give the first video a few seconds, check the small status pill under the caption, and reload the page once. The dictionary is about 17 MB unpacked, so a slow disk can take a moment.
- **Nothing appears at all**: confirm Developer mode is still on, the extension is enabled at `chrome://extensions`, that the video has actually started, then reload the page. Some sites build their player late; Study Player keeps watching and attaches when a video shows up.
- **Overlay sits in the wrong place**: it anchors to the player's container. Going fullscreen with the player's own fullscreen button usually fixes positioning; one page reload clears anything stuck.
- **Stuck on "Study Player loading"**: fixed in 1.1.0 and carried forward. The status pill now says what is missing instead of spinning forever. Update and reload as above.

## Privacy

The extension runs on pages you visit so it can find video players, but it does not collect analytics, does not phone home, and does not send your watch history or word list anywhere. The only network requests it makes are the subtitle-file requests for the video you are already watching, plus local files inside the extension.

## Files

- `manifest.json` - extension definition (Manifest V3, all-sites, version 2.3.0)
- `content.js` / `content.css` - the overlay, transcript, dictionary UI, subtitle parsers (VTT/SRT/ASS, YouTube XML and json3, HLS playlists), native-track reader, auto-loader, diagnostics, and local file loader
- `injected.js` - page-world helper installed before the player boots: reads YouTube's caption list, and on other sites notices subtitle files and streaming playlists the player fetches (declared in `manifest.json` as a `world: "MAIN"` content script, so no inline script injection is needed)
- `popup.html` / `popup.js` / `popup.css` - toolbar popup with toggles, status, and CSV export
- `background.js` - service worker: first-run defaults, plus the cross-origin subtitle fetch that the on-page code routes through
- `lib/kuromoji.js` + `dict/` - local Japanese tokenizer and its dictionary files for furigana
- `dict/jmdict.json` - the bundled JMdict common-word subset used for English definitions (built from JMdict by EDRDG; see Good to know for attribution)
