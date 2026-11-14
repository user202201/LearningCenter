# End-to-end tests

Browser tests (Playwright + Chromium, touch-sized windows) against the app running with a **pretend GitHub**
(`e2e/harness.cjs` answers the GitHub contents API of a repository `demo/LearningData` from memory, including the
409 answer when two devices change a file at the same time), so nothing real is touched. `suites.txt` lists the suites:

| suite | what it proves |
|---|---|
| 01-login-and-local | wrong token / public repo / read-only token refused, QR sign-in, sign out, this-device mode makes no GitHub request |
| 02-kids-weeks-duplicates | 3 children, entering a week, "already learned?" detection (with the week), shared idioms, week navigation, rename / delete, cancel = no message |
| 03-learned-grid | every learned character in a 田字格, tap = show / hide pinyin, scrolling through 70 characters |
| 04-github-storage | which files are written, UTF-8, second device, two devices at once are merged, lost connection is reported, delete |
| 10-week-page-and-viewer | the week page (today first, forward only, plus buttons) and the full-screen character (tap, buttons, swipe, arrow keys, pinyin) |
| 16-google-sheet-sync | the Google Sheets sync script run against a PRETEND sheet + GitHub: layout A / B..K / L, re-sync, errors, auto-sync switch, read-only, no personal data (a real Google account is NOT covered) |
| 18-game | the game: the memory-curve rules (Node) and the screen (shared by every child, ring, time-out, tick / cross, retries, leaving, saving, sizes, languages) |
| 19-light-only | no dark mode: the page declares "only light" (meta + CSS), there is no dark rule, a phone in dark mode shows exactly the same screens (real "auto dark" of a phone browser can not be reproduced here) |
| 20-idioms | the shared idiom list and story page: button on the week page, adding, story editing, shared by every child, back, centred, English / French |
| 21-practice-sheet | the practice sheet: stroke counts and order, pinyin, cell rows, one A4 page as a real PDF, nothing fetched from outside, license notice, rare characters, English / French on a 320 px phone |
| 22-idiom-pool | the idiom library: import of the 成语 tab with tick boxes, ticked ones given weeks (6 a week), the rest kept, weekly random pick for next week, English / French |
| 23-story-sheet | the story printout: 3 stories per A4 page in 14 pt, 2 pages per week (one sheet, both sides), shrink / warn for long stories, real PDFs, English / French |
| 24-story-library | Built-in story library: length, characters, plain text; stories come along with the weekly random pick (no Settings card) |
| 25-sheet-write-chars | the sheet for a child who reads more than he writes: typed characters to write, this week's / last week's characters to read at both ends in random order, per child, remembered, one A4 PDF page, English / French |
| 26-settings-sections | Settings headings in order, every control under the right one, the admin block slides open / shut (no redraw) |
| 28-subject-hub | the subject picker: four big cards on 5 screens (equal margins, no overflow), EN / FR, tap effect (sparkles, ring), the curtain, 识字 = the original app, coming-soon pages, back buttons / Settings return to where they came from, reduce-motion route |
| 29-english-words | English words: the grade asked once (and its yearly step), children list, 20 new words a week by grade, never a repeat, data in english/<kid>.json only, recorded tab, per-child grade, the game in words mode (meaning on tap, speaker, long words, boxes saved), EN / FR on 3 screens |
| 30-math | math: 65 question generators (incl. word problems), settings (total time, keypad), errors book, the choice of the next topics (1500 questions each: right answer, 4 different choices, ranges), the grade, 3 topics a week, a game of 20 with a TOTAL time (previous week mixed in, right / wrong, time up, leaving), quick practice, results saved, grade change picks again, no outside request (offline), EN / FR / 4 screens, long questions fit |
| 77-mathbasics | math foundations (rule 52): 61 new topics with figures (clocks, money, shapes, charts, protractor, areas, ...): 1500 questions each re-checked independently from the text and the drawing, variety, ranges, the errors book with figures, the times table page (tap, speech, practice, weak cells, merge), figure questions on 5 screens, EN / FR, no outside request |
| 31-offline-web | the web version offline: a real production build, the service worker keeps every file, network cut + reload = the app opens, English and math work; no service worker in the packaged-app build; the update check is not answered from the cache |
| 33-science | science: 339 + 60 knowledge cards (complete, honest choices, all four fields in every grade), 8 cards a week (2 of each field), the relaxed game (no time, "did you know" after every answer), recorded + errors book, the periodic table (118, real layout, junior filter, details), formulas, no outside request, EN / FR / 3 screens; the cards in EN / FR: all 3501 cards against the tables (no Chinese, TeX untouched, four distinct choices), 20 sampled cards played per language on 320 / 390 px (right / wrong by the Chinese original, errors book, boxes), KaTeX of all TeX texts, zh unchanged |
| 32-offline-sync | offline first with the GitHub storage: merge rules, copies on the device, offline reload, a game and a new child offline, another device changing the same file meanwhile, everything merged when the network is back, few requests between screens |
| 27-admin-password | Admin mode password: chosen twice the first time, asked afterwards, wrong / cancel change nothing, only a hash kept, change it, not remembered, EN / FR |
| 15-app-icon | the app icon: sizes, no transparency (iOS), fills the square, safe area, in sync with assets/icon/icon.svg, links + manifest |
| 14-picture-and-colour | tap the picture at the top of a child page: picture + colour window, live preview, Done / Cancel, the colour changes the whole look, contrast, fits a small phone |
| 13-manage-mode | manage mode (Settings): a red - on every character to delete a wrongly entered one; cancel is silent; also in "Learned"; the + comes back below 10; an emptied week disappears; sizes on 5 screens |
| 12-children-settings-avatar | children are managed in Settings; pictures: 12 animals, a photo from the library (cut square, small JPEG), the camera, bad file, refused camera, cancel, second device |
| 11-centering-devices | equal space left / right on 11 emulated screens (iPhone, iPad, desktop), full-screen character exactly centred, nothing overlapping |
| 09-update | Settings -> check for updates / force refresh (cache cleared, still signed in), the new-version bar, on a real production build; the iOS build has none of it |
| 08-import-excel | import from Excel / Google Sheets: real .xlsx files, the user's layout, preview, duplicates, paste, bad files, cancel writes nothing |
| 07-scan-login | the login screen scans a QR code with the camera (pretend camera): good code, other code, refused camera, bad token, camera switched off, en / fr |
| 92-backup | backup / restore of the device-only data (Settings -> 备份与恢复): export has every learn.* key and never the token / admin hash / offline copies, import with preview + confirmation (cancel changes nothing, no "done" message), wrong / hostile files refused or stripped, the native bridge (pretend HarmonyBridge receives print + file, back-key steps, web unchanged), EN / FR, 3 screen sizes |
| 06-look | an animal + colour per child (stable, different), mascot, readable white text on every colour, animations off with "reduce motion" |
| 05-languages-and-layout | zh / en / fr: no Chinese UI text left, nothing cut off on a phone and two tablets; screenshots `tests/out/work/layout-*.png` — **look at them** when a screen is new |

Run everything: `npm run test:e2e`. One suite: `tests/run-all.sh 03-learned-grid`.
Rules: a new feature or a fixed bug gets a suite (or a check) in the same change; a test must fail on the old code
(check it before trusting it). Output (screenshots, logs) goes to `tests/out/` (ignored by git).

Not testable here: a real iPad / iPhone (safe areas are emulated), a real GitHub account, real Apple accounts, real children using it.


## Music, games, readings (suites 34-50)
34 subject shortcuts · 35 language track (English / French screen) · 36 notes and formulas · 37 English reading · 38 music (theory, quiz, piano incl. recording and full screen, drums, guitar) · 39 no double-tap zoom · 40 games shell · 41 snake · 42 tetris · 43 bubble shooter · 44 match-3 · 45 klotski · 46 gomoku · 47 chess · 48 xiangqi · 49 spider solitaire · 50 freecell. Run one with `bash tests/run-all.sh <name>`; do not run two `run-all.sh` at once (the runner wipes `tests/out`).

## Text coding (编程 worlds 11-13, rule 61, suites 86 / 86b / 86c)
86 codingtext (Node, no browser: 546 programs compared with real `python3` incl. the same `random.seed` numbers, 100 broken programs with kind / line / hint, step budget / recursion / output limits, all 48 levels: reference passes, starter / empty / naive solutions fail, efficiency budgets, rules, expected output = python3, stars, the block -> Python bridge on 200 random drawings, mini-lessons run, curriculum document, translations; `86-corpus.cjs` holds the programs, `86-corpus-expected.json` the stored outputs for machines without python3) · 86b codingtext-editor (typing, auto-indent, auto-close / type-over, Tab, undo, shortcuts, toolbar with the mouse and REAL touch events at dpr 2, focus stays in the text, highlighting, squiggle, bracket hint, stepper line, font sizes >= 16 px, layers aligned, a short window = on-screen keyboard) · 86c codingtext-screens (map section, worlds, levels played with wrong and right submits, results, error line, hints, answer after 3 failures, stars, call / debug / blank / drawing / efficiency / rule levels, stepper with variables, reset, drafts, lessons incl. the blocks beside Python, workshop templates / snippets (20 at most, delete asks) / block works, progress on GitHub and merged, 5 screen sizes, EN / FR, no outside request). Not testable: real fingers and the real iOS keyboard.
