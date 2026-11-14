# Translation context audit (one Chinese text, two meanings)

The translation tables (`src/i18n-data.ts`) are keyed by the Chinese text, so a text used with two meanings got ONE translation
(the bug found by the user: `退出` was both "sign out" and "quit the game"). This audit looked at every Chinese string literal of
`src/**/*.ts` (9,363 distinct texts, 12,407 uses; extracted with the TypeScript AST, content tables included) that is a key of the EN table:
2,826 keys of 1-4 characters and all 700+ keys used in two or more places (up to 40 characters), and read the surrounding code of every
one that looked polysemous. Strings from the JSON libraries (`src/data/*.json`) were compared with the keys too: they are either
trilingual (`coding-info.json` `labels`, read through `L()`), content translated by `cct` / `ct`, or have no clash.

## Mechanism added (`src/i18n.ts`)

`cx("text", "ctx")` marks the minority use of a key. The plain text is the key of the majority use; the marked use has the key
`text@ctx` in the tables (e.g. `"速度@tempo": "Tempo"`). The mark is invisible (U+2063 + the ASCII code of `ctx` as zero-width bits appended to the
text), so **the Chinese display is unchanged**, the mark stays in the DOM, and it survives a switch of language (a screen drawn in Chinese and then
switched to English still finds the right entry). `tr()` looks up `text@ctx` first (also for patterns like `第 {0} / {1} 题@q`) and falls back to the
plain text; nothing invisible reaches the English / French text. `scripts/check-i18n.mjs` reads `cx(...)` calls as the key `text@ctx`.
The marked text must be the whole text of its element or attribute. JSON data cannot call `cx`: split by changing the data instead.

## Documentation and checks

* `scripts/i18n-contexts.json`: every known polysemous key with its meanings (variants), the expected EN / FR text of each, and the places where each is used.
  It also lists the keys that were examined and turned out to mean one thing everywhere but are easy to confuse (`退出`, `退出登录`, `重置`).
* `scripts/check-i18n-contexts.mjs` (part of `npm run check:i18n`, so of `npm run build` and the workflows): the table entries match the documentation,
  two variants never share the English text, every documented use still exists in its file, and every `cx()` call in the code is documented.
* `tests/e2e/96-translation-context.cjs` (in `tests/suites.txt`): the mechanism in the app's own page (en / fr / zh, no invisible character in en / fr,
  fallback, patterns) and the real screens in en and fr (sign-out confirm vs quit-game confirm, velocity vs tempo, quiz counter, "no glasses", valves,
  beat maker, DJ, Lights out, Make 24, zh unchanged, no outside request). 67 checks. Mutation check: with `没有` set back to "None" the suite fails.
* Adding a new split: `cx(...)` in the code, `"text@ctx"` EN + FR in `src/i18n-data.ts`, an entry in `scripts/i18n-contexts.json`.

## Keys that were wrong and are fixed (20 keys documented, 17 of them split or corrected)

| Key | Uses and meaning | Before | After |
|---|---|---|---|
| `速度` | physics readouts (motion, energy, Newton) = speed; beat maker slider, DJ pitch fader = tempo | Tempo / Tempo everywhere (the physics lab said "Tempo") | plain = Speed / Vitesse; `速度@tempo` = Tempo / Tempo (beats.ts, dj.ts x2) |
| `没有` | yes / no answers (wind shield, glucose in urine, "does a plant cell have X", residual-current device) vs nothing at all (no glasses, no moons) | None / Aucune everywhere ("Does a cell have a nucleus? Yes / None / not necessarily") | plain = No / Non; `没有@none` = None / Aucune (phys/eye, spaceplanet) |
| `无` | none (no nerve part cut, none listed, no rings) vs the valves of a vessel (yes / no) | None / Aucun | plain stays None / Aucun; `无@no` = No / Non (bio/vessels) |
| `种` | count word: 4 blood types, 16 pairings, structures vs "N species identified" (classification lab) | species / espèces ("16 species") | plain = types / types; `种@species` = species / espèces (bio/classify) |
| `继续` | resume a paused game (many) vs the OK button of the badge dialog | Resume / Reprendre for both | `继续@next` = Continue / Continuer (coding.ts, coding-info.ts, coding-text.ts) |
| `挑战` | difficulty "hard" (Sokoban group) vs tag of a boss level in the coding worlds | Hard / Difficile for both | `挑战@boss` = Challenge / Défi (4 places) |
| `排序` | poem practice mode (put the lines in order) vs the sorting-algorithm lesson | Order / Ordre for both (`coding2.json` already said "Sorting") | `排序@sorting` = Sorting / Tri (coding-lessons2) |
| `顺序` | coding world 1 "Sequence" vs the space quiz kind "order of the planets" | Sequence for both | `顺序@order` = Order / Ordre (spacemodel) |
| `关闭` | Close button (many) vs state of a heart valve | Close / Fermer ("AV valve: Close") | `关闭@closed` = Closed / Fermée (bio/blood x2) |
| `输入` | typing mode of a game / writing tab ("Type") vs the input given to a program in the text-coding lab | Type / Saisir for both | `输入@input` = Input / Entrée (coding-text x4) |
| `地图` | the Maps page / card vs the aria-label of one robot map | Maps / Cartes | `地图@single` = Map / Carte (coding-scene) |
| `应用` | Settings card "App" vs physics readout "applications of the band" | App / Application | `应用@use` = Uses / Usages (phys/emwave) |
| `形成` | "fruit forms" value vs the geography readout label "formation" | Forms / Se forme as a label | `形成@formation` = Formation (geolab-sims2) |
| `清除记录` | clear the PK match record vs clear the table of measurements of three physics experiments | Clear record / Effacer l'historique ("history" for a data table) | `清除记录@data` = Clear data / Effacer les mesures (3 places) |
| `新题` | Make 24: a new deal vs Lights out: a new puzzle | New hand / Nouvelle main for both | `新题@puzzle` = New puzzle / Nouvelle grille (lightsout) |
| `返回` | back (30+ places) vs the "return" block of the block language | Back / Retour ("Back" block) | `返回@return` = Return / Retourner (coding-editor) |
| `第 {0} / {1} 题` | PK duel "round n / m" vs the quiz of a lab "question n / m" | Round / Manche for both | `第 {0} / {1} 题@q` = Question {0} / {1} (phys/kit, geolab) |
| `重置` | reset (Make 24, physics, coding): all the same meaning | FR "Refaire" (= redo) | FR "Réinitialiser" (plain translation error, no split needed) |

Documented as one meaning everywhere (checked, no change): `退出` (Quit: the quit-game / quit-practice confirm buttons and the poem practice cross),
`退出登录` (Sign out, split by the lead).

## Checked and left as they are (one translation fits every use)

`完成` (Done, 20 uses: finish buttons; `完成。` = Completed.), `开始` (Start: buttons and the "when started" block), `提示` (Hint: all buttons are hints; one physics
readout also named 提示, see questions), `检查` (Check = verify; chess `将军！` has its own key), `清除` / `清空` / `重选` (Clear / Effacer),
`暂停` / `已暂停` (Pause / Paused), `设置` (Settings; Réglages), `今天`, `练习` (Practise), `游戏` (Game), `播放` (Play), `删除`, `取消` (Cancel) vs `撤销` / `悔棋`
(Undo), `确定` (OK), `选择` (Choose), `保存`, `返回` (all other uses), `全部` (All, a filter), `次` (times), `时` (h), `年` / `岁`, `倍`, `质量` (Mass:
fetus, energy, spring, planet), `体重` (Weight), `压强` (Pressure) vs `压力` (Force on the surface), `内容` (Topic: the mode chooser of the labs), `状态`
(State), `结果` (Result), `判断` (Verdict), `说明` (Note), `空格` (Space key), `位置`, `类型`, `类别`, `目标` (Target: pictures to reproduce), `关卡` / `选关` (Levels),
`世界` (World), `课程` (Lesson), `创作` (Create), `分数` (Score; only the coding "score" level and bias lab use it, the fractions of the math topics are
inside longer texts), `打开` (Open / Ouverte: only used for valve states), `随机` (Random), `暂存` (Hold), `规则` (Rule), `没有沉淀、气体或水生成。` and all
sentences with their own key. The French `重选` = "Effacer" (the card games' "deselect") is acceptable.
The generic words `记录`, `学习`, `更多` do not occur as keys of their own (`更多` has no use in code; `记录` only inside longer texts).

## Questions for the user (could not decide)

1. `难度` is translated "Level" / "Niveau" (games: "难度：简单" = "Level: easy"). "Difficulty" / "Difficulté" is more exact, but "Level" is also what `关卡`
   uses for game levels; the two never appear on one screen. Change it? (One table entry each.)
2. `入门` (Sokoban group, map levels) = "Easy" while `新手` = "Beginner" and `简单` = "Easy": a child of the "入门" group sees "Easy" next to "Easy".
   Kept as is; a native speaker should say whether "Introductory" / "Débutant" fits better.
3. `phys/energy.ts` has a readout labelled `提示` ("Hint") whose value is a note ("小车到不了这里"). "Hint" is acceptable, "Note" would be better; left because a
   split needs a test change in `82-physlab` for no clear gain.
4. `种` default is now "types" ("16 types"): "kinds" / "sortes" are alternatives; which sounds better to the family?
5. `挑战@boss` = "Challenge" while the random-practice button `随机挑战` is "Random challenge": intended (the same word in both).
6. The one-character quiz units `次`, `种`, `个`, `只`, `条`, `粒` are translated in context-free form ("times", "types", "" ...). A quiz answer like "3 个" shows as
   "3" in English; fine for counts, but nobody has proofread every quiz question's unit.
7. All new EN / FR texts are model-written, not proofread by a native speaker.
8. Not tested: a real device, other languages of the browser; the invisible marks in Chinese are zero-width and should never be seen, but copying such a
   text (select + copy) carries them along.

## Side effects to know

* In Chinese, the text of a marked element is now the Chinese plus invisible characters; a test that compares `textContent` of such an element with the bare
  word in Chinese must strip `[⁣​‌]` (none of the existing suites does; the ones I ran pass: 74, 61, 58, 82, 89, 83, 85c, 96).
* `check:i18n` now also runs `check-i18n-contexts.mjs`.
