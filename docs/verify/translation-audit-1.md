# Translation audit 1 (first third of the keys)

Scope: the first 3,823 keys of the English block of `src/i18n-data.ts` (key index 0 to 3822, from "游戏" to
"黑龙江与乌苏里江主航道汇合处" in the geography fact questions) and the same keys in the French block.
Method: a script (`extract.cjs`, kept in the scratchpad) cut the keys into 37 chunk files that hold only the numbered English and French
translations. I read only those files and wrote my own Chinese back-translation for every entry (3,823 lines) without opening the
Chinese keys. A second script then paired every back-translation with its key.

## Counts per stage

| Stage | What | Count |
|---|---|---|
| 1 | keys read blind (EN + FR each, 7,646 translations), back-translations written | 3,823 (37 chunks) |
| 2 | pairs compared by normalised similarity | 3,823 |
| 2 | similarity 1.00 (identical after removing punctuation) | 1,643 |
| 2 | 0.90 to 0.99 / 0.75 to 0.89 | 604 / 971 |
| 2 | 0.60 to 0.74 / below 0.60 (all read by hand) | 374 / 231 |
| 2 | random 10 % sample of the 1,575 pairs between 0.75 and 0.99, read by hand | 157 |
| 2 | automatic checks on EN and FR against the key: placeholders {n} (all equal), numbers (all equal; only number words, months and 万/亿 conversions differ), negation, left/right/up/down/east/west, British spelling, French spacing and vous-form, informal words | 3,823 keys, 7,646 texts; 296 pairs flagged, the 99 inside the low-similarity set and the 46 with a real signal outside it read by hand (the remaining flags were only the common words 后 / 上 / 下 / 升 / 减 in long texts) |
| 2 | EN against FR meaning (negation heuristic, numbers, placeholders) | 3,823 pairs, no divergence |
| 3 | keys of 1 to 6 characters | 1,383 (692 found as literal strings in `src/**/*.ts`, 691 are built dynamically or come from data files and cannot be located by grep) |
| 3 | context of every short key that was found, of every key used in two or more source files (117 keys) and of every key whose translation carries an article or starts in lower case (a quiz-option style) | all read |

Result: 26 keys needed a change (33 values: 12 English, 21 French), listed below. Everything else was judged accurate. The back-translations
were very close to the keys (no wrong sense of a polysemous word, no swapped direction, no lost negation, no changed number, no changed placeholder
order, one gender fault in French: fix 11), so the remaining findings are small losses of detail and consistency faults.

After the edits: `npm run check:i18n` (8,390 texts, contexts ok) and `npx tsc --noEmit` pass.

## Fixes made (key -> old -> new)

Only `src/i18n-data.ts`, one line per Edit.

1. `已复制。请粘贴到 Google 表格的 Apps Script 中（步骤见“查看详细步骤”）`
   EN `(steps: “Show detailed steps”)` -> `(steps: “See the step-by-step guide”)`;
   FR `(étapes : « Voir les étapes détaillées »)` -> `(étapes : « Voir le guide pas à pas »)`.
   Reason: the quoted label must be the real button text (key `查看详细步骤` is "See the step-by-step guide" / "Voir le guide pas à pas").
2. `开启后，“本周”和“已入库”中每个汉字的右上角会显示红色“−”…`
   EN `in its corner` -> `in its top-right corner`; FR `dans son coin` -> `dans son coin supérieur droit` (the key says 右上角, the corner was lost).
3. `管理模式：点击汉字右上角的红色“−”可删除`
   EN `in a character's corner` -> `in a character's top-right corner`;
   FR `dans le coin d'un caractère` -> `dans le coin supérieur droit d'un caractère`.
4. `无法打开相机，请改用“从相册选择”`
   EN `“Choose from library”` -> `“Choose from the photo library”` (the button key `从相册选择` is "Choose from the photo library").
5. `在新设备的登录页点击“扫码登录”进行扫描，或直接使用手机相机扫描。`
   FR `« Se connecter par code QR »` -> `« Se connecter en scannant un code QR »` (the button key `扫码登录` is that text in FR).
6. `没有声音。请点喇叭重听。` (pk.ts:274)
   EN `No sound. Tap the speaker.` -> `No sound. Tap the speaker to hear it again.`;
   FR `Pas de son. Touchez le haut-parleur.` -> `Pas de son. Touchez le haut-parleur pour réécouter.` ("重听" = hear again was lost).
7. `把本设备上的设置和学习进度保存为一个文件…`
   EN `data in "on this device" mode` (straight quotes) -> `data in “on this device” mode` (the only English text with straight quotes).
8. `百万年前` (bio/evidence.ts:61, shown as "约 {n}" + this unit)
   FR `millions d'années` -> `millions d'années avant aujourd'hui` (without it the date reads as a duration; "ago" was lost in FR).
9. `底牌` (games/doudizhu.ts:95, label above the three bottom cards)
   EN `Bottom` -> `Bottom cards`.
10. `小兔` / `小兔思考中…` / `小兔是地主。` (Dou Dizhu and Run Fast share the name 小兔; Run Fast already used "Rabbit")
    EN `Bunny` -> `Rabbit`; `Bunny is thinking…` -> `Rabbit is thinking…`; `Bunny is the landlord.` -> `Rabbit is the landlord.`
    (before: the same animal was "Bunny" as a name and "Rabbit" in `小兔：{0}`, `小兔赢了。`, `小兔出牌中。`; the FR was already "Lapin").
11. `保持不变` (bio/model-daphnia.ts:22 and bio/model-selection.ts:27)
    FR `restera la même` -> `ne change pas` (feminine form fitted only "la proportion"; the daphnia question is about "le rythme cardiaque").
12. `氢气难溶于水，密度比空气小。`
    EN `insoluble` -> `sparingly soluble`; FR `insoluble` -> `peu soluble` (难溶 is "hard to dissolve", not "insoluble").
13. `难溶于水` (option for nitrogen)
    EN `is insoluble in water` -> `is sparingly soluble in water`; FR `est insoluble dans l'eau` -> `est peu soluble dans l'eau`.
14. French term for 成语, 12 keys, `Idiomes` / `idiomes` -> `Chengyu` / `chengyu`: `汉字 {0} · 成语 {1}`,
    `{0} 周，{1} 个成语，其中新的 {2} 个`, `已导入：{0} 个汉字、{1} 个成语`, `已导入：…；另有 {2} 个已入库，已跳过`,
    `{0} 的 {1} 个汉字和学习记录会被删除…（成语是大家共用的…）`, `共 {0} 个成语，新的 {1} 个`, `已保存：新增 {0} 个汉字、{1} 个成语`,
    `成语 {0} 个`, `成语（{0}）`, `成语（所有孩子共用）`, `成语，每行一个（或用空格、逗号分开）`, `成语`.
    Reason: the same screens already said "chengyu" in 15 other keys of this third (`成语故事`, `添加成语`, `全部成语` …; 40 lines in the whole FR block), these 12 said "idiomes";
    the app uses one word now. Whether "chengyu" or "idiomes" is the right word is question 6.

## Questions for the user (not changed)

1. **Product name** `识字小助手` (main.ts:252, hub title): EN "Hanzippy", FR "Mots Cases". FR is not a translation of the Chinese and the two names do not
   match each other. Is this the intended brand in each language?
2. **French grades**: Chinese 七年级 / 八年级 are written `7e` / `8e` in FR (keys `这是教科书中的内容（七年级下册“人的由来”）…`, `八下 · 遗传和变异（育种与生物技术）`, `八上 · 动物的主要类群`,
   `八上 · 动物的运动`, `八上 · 第六单元 生物的多样性及其保护`; EN "Grade 7/8, term 1/2"). In France the school years are numbered differently
   (Chinese grade 7 is about the French "5e", grade 8 "4e", grade 9 "3e"), "7e" does not exist as a class, and "semestre" for 上册 / 下册 is also not a French school term (trimestre).
   Keep the Chinese numbering written out ("7e année chinoise") or map to the French classes?
3. **"races"** (`世界三大人种是什么？`, the answers `黄种人、白种人、黑种人`, `红种人 …` and the explanation `按肤色等特征分为黄、白、黑三大人种。`):
   EN "yellow, white and black races", FR "les races jaune, blanche et noire". It is a faithful translation of dated textbook wording. Keep as it is, or use neutral wording
   ("population groups (Mongoloid, Caucasian, Negroid)")?
4. **Typography**, not edited because it is thousands of lines and a job for a script: (a) apostrophes in FR: 1,065 straight `'` and 447 typographic `’` in my third
   (the chemistry block uses `’`), EN 62 straight / 9 typographic; (b) French spaces before `: ; ? !` are ordinary spaces (414 in my third), so a line may break before the
   colon; a no-break space would avoid that. Normalise by script?
5. **字帖**: EN "Practice sheet", FR "Cahier d'écriture" (a cahier is a notebook; the thing is one printed A4 sheet). "Feuille d'écriture" or "Feuille d'entraînement"?
6. **成语 in French**: "chengyu" (now 52 lines) or "idiomes" (everywhere)? One key outside my third still says "idiomes":
   `同时听写本周成语（{0}）` (line about 20754, not mine; the other agent should align it).
7. **`重选`** (games/doudizhu.ts:494, games/paodekuai.ts:108, button that clears the selected cards): FR "Effacer" means "erase"; "Désélectionner" is exact but longer
   (check the button width). EN "Clear" is acceptable. Change the FR?
8. **`答对了` / `答错了`** (gameui.ts:82-83, title and aria-label of the tick and cross buttons): EN "Right" / "Wrong" is clear here but "Right" is ambiguous in
   assistive tools (a direction). "Correct" / "Incorrect" would be exact. Change?

## Keys used for two different purposes (not split; the `cx("text", "ctx")` mechanism and `scripts/i18n-contexts.json` exist for this)

The translation of these keys is written as a sentence fragment (quiz answer: lower case in EN, article or "de" in FR) but the same Chinese text is also shown as a plain label:

- `氧气` (EN "oxygen", FR "de l'oxygène"): bio/model-respiration.ts:28 (answer after "…产生了：") and phys/model-evap.ts:14 (gas name in the gas selector).
  `水蒸气` ("water vapour" / "de la vapeur d'eau"): bio/model-respiration.ts:28 and phys/model-evap.ts:14 (the same list). In FR a label "de la vapeur d'eau" is wrong as a name.
- `肺` ("the lungs" / "les poumons"): bio/model-development.ts:45 (quiz option) and bio/model-animalgroups.ts:12-13 (cell of the table "Breathing organ", whose neighbours are
  "Gills" / "Branchies").
- `输卵管` ("fallopian tube" / "la trompe de Fallope"), `卵巢` ("ovary" / "l'ovaire"), `阴道` ("vagina" / "le vagin"): bio/model-reproduction.ts:5-6 (organ names shown in the diagram)
  and :22-24, bio/model-development.ts:44 (quiz options). `胎盘和脐带`, `羊水`, `卵黄`: bio/model-reproduction.ts:24 and bio/model-development.ts:45 (both quiz).
- `铁` ("iron" / "le fer"): bio/model-diet.ts:13 (mineral) and phys/model-noise.ts:10, phys/model-resistance.ts:4 (material names; the neighbours `铜` "copper" / "cuivre" and
  `铝` have no article in FR).
- `海洋` ("the ocean" / "l'océan"): bio/model-ecology.ts:9 (ecosystem list next to "Forest", "Grassland" …; here "the ocean" with article/lower case) and figures.ts:52 (figure labels use
  their own tables, so only the first is affected).
- `70 应用` is fine: phys/emwave.ts:27 already uses `cx("应用", "use")`.
- Single Chinese numerals `零 一 二 … 十 十一 十二` (translated "zero", "one" …) are used by geolab-model.ts:41 (time-zone names) and also by mathcn.ts:16-28 (Chinese numerals for the
  times-table and big numbers, content that must stay Chinese). Please confirm that no standalone numeral from mathcn.ts is passed through `tr()` (a single `十` would become "ten"
  in EN/FR). The same holds for other single-character keys (`水 铁 铜 铝 猫 狗 马 龟 鱼 对 级 代 株 类 米 吨 北 东 南 西 肺 胚`): they are safe only while a child's own
  characters stay inside the `user` class (rule 1).

## Small points noted, left as they are

- `本次先错后对的字：` is "Wrong at first, then correct:" (EN) / "Faux d'abord, puis corrects :" (FR): "this time" and "characters" are not said (the list below shows the characters).
- `经典纸牌` is "Klondike Solitaire" (EN) but "Solitaire classique" (FR); `跑得快` is "Run Fast" (EN) but "Course aux cartes" (FR): descriptive, not literal, accepted.
- `红种人` is translated "Native American" / "amérindienne" (the literal "red" is dropped on purpose).
- EN uses British spelling consistently (colour, centre, aluminium, litre, fertilisation); "sulfur" is used as asked.
- FR: no tu-form, no colloquial word, `« »` for quotation marks everywhere; no straight quotation marks in FR.
- Not testable here: how the texts look in the real UI (overflow of the longer FR strings was not checked; run `05-languages-and-layout`), and the chemistry / biology content itself
  (these are model-written texts; a teacher must proofread them).
