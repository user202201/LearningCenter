# Untranslated text: the dynamic crawl (suite 97)

Date of the work: 2026-11-14. Suite: `tests/e2e/97-no-chinese-crawl.cjs`, allowlist `tests/e2e/97-allowlist.json`. Read-only audit of what a user can SEE in English and French.

## What the crawler does

* Signs in on this device, makes two children (Anna, Ben) with characters, idioms and grades, then in **en and fr, at 390 x 844 (phone) and 1180 x 820 (tablet), motion off** visits every route of `src/main.ts` (about 190 seeded routes: picker, 识字 incl. sheet / dictation / writing / poems / PK, math, Languages, science incl. periodic / formulas / circuits / notes / map / chem / space / physics / bio / geo labs, coding worlds 1-16, music, the 31 games, settings) and **every route that a click discovers** (lab simulations, chem modes, games, planets, theory chapters, idiom stories ...).
* On every page it clicks up to N distinct buttons / tabs / chips / checkboxes / selects, closes the dialogs, and scans after each click. Beside the page scan a poller reads toasts and dialogs every 120 ms while they are open, and `alert` / `confirm` / `prompt` are recorded.
* Scripted flows: admin password dialog (mismatch, wrong password), add child with an empty name, every settings dialog (rename, picture, grade, delete confirm, Excel import, backup import, credits, licence), wrong files for import / backup / picture, backup export toast, secret-egg switch, update check, the grade dialog of a child without a grade (English / math / science), the games of all four subjects played to the end and left half way, times table, the quiz of every physics / biology / geography simulation, PK (chinese and languages): lobby, picking players, opening, leave confirmation, rounds, final screens, "again", record reset; idiom editor, duplicate-idiom message, invalid week entry, sheet options, story printout, the login screen with six wrong sign-ins.
* Reads: element text (incl. `<option>`, SVG `<text>` and `<title>`), `title` / `aria-label` / `placeholder` / `alt`, button values, prefilled inputs, `document.title`.
* **A finding** is any string with CJK (U+3000-303F, U+4E00-9FFF, U+FF00-FFEF) outside (a) `.user` / `.user-title` boxes, (b) text in brackets (`Name (中文)`), (c) the allowlist. Text inside a `.user` box that is *not* the test's own data (the typed characters / idioms) is reported too (kind `userbox`): app content must not hide behind the `user` class. Fullwidth `＜ ＞ ＝ ＋ －` are treated as symbols.
* Pages visited: **376 routes per phone run, 542-557 distinct routes over the two sizes and two languages** (the second number is the union of the routes found in each configuration).

## Results

| run | strings found | notes |
|---|---|---|
| 1 (before any fix, `user` boxes NOT examined) | 127 | 74 periodic-table cells, map / physics / biology / reading / coding strings |
| 3 (en phone, `user` boxes examined) | 561 | 366 poems, 83 coding, 69 music quiz, 36 map, 4 math, 3 periodic |
| final (en + fr, phone) | **0** (80 distinct strings are known gaps, see below) | 557 routes, no flow failed |

Findings and what was done (nothing is hidden by the allowlist except what is listed in the next sections):

| area | finding | fix |
|---|---|---|
| periodic table | `title` / `aria-label` of the 118 cells were the Chinese element name | now `Scandium (钪)` outside Chinese (`science.ts` `ptName`) |
| every `svg` / `canvas` | `aria-label` (e.g. 中国地图, 演草纸, 书写区, 迷宫) was never translated: `i18n.ts` skipped these elements before reading their attributes | `walk()` translates the attributes first, then skips the children |
| physics / biology labs | 63 texts of newer simulations (tasks, lessons, readouts, quiz) were written in `src/i18n-extra/*.json` but not merged into `i18n-data.ts` (so they showed in Chinese) | listed in `src/i18n-extra/crawl.json`, loaded by `i18n.ts` after `i18n-data.ts` (the table in `i18n-data.ts` wins; `check-i18n.mjs` counts the file as translated) |
| math | 126 topic names and 126 descriptions (`math-topics.json`) in `user` boxes | `user` removed on `.mtname` / `.mtdesc` / the end-screen rows; 242 EN + FR texts in `crawl.json` |
| Languages reading | the word glosses on the English screen showed Chinese (the page is for the Chinese / French screens); the source line `来源：…` sat in a `user` box | on the English screen `#/english/<kid>/read` goes back to the week page; the source line is translated again |
| music quiz | the answer frame `正确。` / `请再思考：` sat inside the `user` box with the course text | frame outside the box, only the explanation is `user` |
| coding, text bridge | generated Python comment `# 积木里的海龟一开始朝上` | now an English comment in every language |
| tooltips on the map | `Which place is 京, 沪, 苏 ...` | `Which place is Jing (京), Hu (沪), Su (苏) ...?` / `Quel lieu désignent Jing (京), Hu (沪), Su (苏) ... ?` |
| translations | fullwidth `＋` inside 11 EN / FR values | replaced by `+` |
| the ones that were not real | `东经 60°` once untranslated: another agent's edit of `i18n-data.ts` was half way when the dev server read it; fine after a restart | none |

## Allowlist (`tests/e2e/97-allowlist.json`), with the reason per entry

1. `中文` in the language menu: every language is named in its own script.
2. `第1周-2026-10-25`: the exact label that the user's Chinese sheet must contain for the import.
3. Poems (`#/poems/…`, kind userbox): titles, poets, dynasties, the lines and their word notes are Chinese literature. **Open question:** the gist (about 185) and word notes (about 700) could get EN / FR texts.
4. Map labels (`text` in the SVG of `#/science/map`): provinces, seas, islands in Chinese as on a Chinese school map; the card gives English / French name, abbreviation and pinyin.
5. Times-table rhyme (`kj-rhyme`): the rhyme that is spoken and learned.
6. Periodic table: the Chinese character in the cell and `氢  Hydrogen` in the card heading.
7. Xiangqi: the characters on the pieces and 楚河 汉界.
8. Text-coding program text: string literals / comments inside example Python programs (`tx-str`, `tx-com`, `"你好，世界"`).
9. Two entries marked **`pending`** (known gaps, counted and printed by the crawler, not hidden):
   * text coding worlds 11-13 and the workshop (`#/coding/<kid>/w11|w12|w13|code|projects`): level titles, task statements, hints, lessons, templates are Chinese content in `user` boxes by rule 61 (about 340 + 80 strings; 80 distinct ones were reached by the crawl);
   * information-technology worlds 14-16 (`#/coding/<kid>/i14|i15|i16`): the lessons (275), scenario / sort cards, hints (195), device texts (105), project templates in `coding-info.json` (rule 62; titles and prompts already have EN / FR triples, the rest has none). The crawler only opens level 1 of each world, so the real total is larger than the 80 it sees.

## Static scan for bypasses (what `check:i18n` cannot see)

* `toLocaleString` / `Intl` / `toLocaleDateString`: only `spaceui.ts` `big()` (`en-US`, so French readers get `1,234` instead of `1 234`; left as is because `83-space` compares the text); no date is built with 年 / 月 / 日 except the pattern `{0}月{1}日` in `geolab-model.ts` (translated as a pattern) and week labels `第{n}周` (patterns). No weekday or month names are produced in code; dates are ISO.
* `alert` / `confirm` / `prompt`: none in `src/` (the dialogs are `modal()`); `i18n.ts` still patches the native ones. `document.title` is set only by `i18n.ts` (`tr("学习乐园")`).
* Raw `e.message` shown by `toast()`: the messages thrown by `api.ts` are Chinese keys of the table (verified in the login flow with six wrong sign-ins and the offline flow); system errors of the browser are English by nature; the interpreter error messages of text coding are Chinese content (pending, see above).
* Chinese units in code (万, 亿, 百万): only inside question / readout templates that are table keys (math, geography, biology, space); the crawl found none left over.
* Canvas text: the 14 `fillText` calls draw Latin / digits or go through `tr()` (`spacelabs.ts`, `phys/draw.ts`, orrery labels via `nameOf`); no Chinese is drawn in a canvas without translation. The crawler cannot read canvas pixels.
* CSS `content:` has no Chinese; `::after` uses ✓ and `attr(data-name)` (note names).

## Not covered / to know

* Spoken text (`speechSynthesis`) and printed PDFs are not read. Hidden states that need real data (a real GitHub account, offline messages in GitHub mode) are not crawled; the offline messages are `api.ts` keys that `32-offline-sync` exercises.
* Only the first level of each coding world is opened, only the first 4-6 distinct buttons of a page are clicked, and a lab quiz shows 5 questions per simulation per run (quiz questions are seeded by day): a rare generated question can still hide a missing template. `81-chem`, `82-physlab`, `89-biolab`, `90-geolab`, `83-space` sample hundreds of generated questions per language for exactly this.
* The new texts I wrote (math topic names and descriptions, the physics / biology texts taken over from `i18n-extra`) follow rule 47 (formal wording, British school terms, vous-form where an instruction is addressed to the reader). A teacher / native speaker must proofread them, especially the French names of the primary-school methods (`faire dix`, `décomposition de dix`) and the Chinese-curriculum terms (`PGCD / PPCM`, `rapport entier le plus simple`).
* `crawl.json` is a stop-gap: its entries should be merged into `i18n-data.ts` and the file deleted when the lead merges (the lookup order is `i18n-data.ts` first, so a later merge changes nothing).
* Run time: about 45 minutes for the full suite (4 configurations); `tests/run-all.sh` gives suite 97 5400 s. Knobs are documented in `tests/README.md`.

## Questions for the user

1. Translate the coding content (text-coding worlds 11-13 and information-technology worlds 14-16, about 1,000 strings of lessons, task statements and hints)? It needs a decision, because rules 61 / 62 say it stays Chinese; the crawl lists it as a known gap. If yes, the `user` class must be removed from those boxes and the texts added to the translation table (or the generator `scripts/make-coding-info.py` extended with EN / FR).
2. Translate the gist and the word notes of the 185 poems, and show poet names as `Li Bai (李白)`? Or keep the poems module entirely Chinese (as the allowlist now says)?
3. Should the map keep Chinese labels in English / French (now yes, with the translated card) or should the labels follow the screen language with the Chinese in brackets?
4. French number format in the astronomy pages (`1,234` vs `1 234`)?
