# Translation audit 2 (second third of the English block, same keys in French)

Scope: keys 3823 .. 7645 of the 11,469 keys of `src/i18n-data.ts` (3,823 keys, in file order; the first key is
"黄河与渭河", the last is "列表与数据"), EN and FR. Mostly the geography lab, physics lab, astronomy, the chemistry
extras and the biology lab labels. Written by one auditor; all translations are model-written, so this is a
check by a second model, not by a native speaker or a teacher.

## Counts per stage

| Stage | What was done | Count |
|---|---|---|
| 1 Blind back-translation | 26 chunk files (150 keys each, EN + FR only, no Chinese). Every key got a Chinese back-translation written without looking at the source keys | 3,823 of 3,823 keys. Of these 254 long paragraphs were back-translated in condensed form (key facts, numbers, names; checked by character overlap + number comparison instead of string similarity), 63 pure formulas / unit strings were checked by identity, 4 empty / measure-word keys skipped |
| 2 Compare | Script pairs back-translation with the original key. All pairs below similarity 0.6 read by hand; plus a random sample of the high-similarity pairs | 270 low-similarity pairs read; 398 high-similarity pairs sampled (10.4 %); of the 270, 22 led to a fix or a note, the rest were paraphrases (e.g. 我国 / 中国, 一样 / 相同) |
| 2b Automatic checks on all 3,823 keys | `{n}` placeholders equal in key / EN / FR; numbers equal in EN and FR; French space before `: ; ? !`; Chinese left in EN / FR; American spellings; straight quotes in FR; "..." instead of "…" | 0 findings (the 38 number differences are the French grade labels "5e / 4e" and spelled-out numbers: "0" = "nulle", "1 million" = "un million") |
| 3 UI context | Every key of at most 6 characters (1,600 keys) located with grep in `src/**/*.ts`; the 214 keys of at most 4 characters that appear in two or more files were listed and the ambiguous ones (about 25) were read at their call sites | see "Unresolved" |
| Fixes | `src/i18n-data.ts`, single-line Edit-tool edits | 16 keys (25 value changes) plus 20 French grade labels (see below) |

`npm run check:i18n` and `npx tsc --noEmit` pass after the edits (8,390 texts at the time of the run).

## Fixes (key → old → new)

Real mistranslations (meaning changed or lost):

1. 重力是由于地球的吸引而使物体受到的力… (lesson of the weight; EN + FR) — the key says "地球上 g = 9.8 N/kg，粗略计算时取 10 N/kg", the translation said "On the Earth g = 10 N/kg, and 10 N/kg is used for rough calculations" (the 9.8 was lost, and the sentence became absurd) → EN "On the Earth g = 9.8 N/kg, and 10 N/kg is used for rough calculations; this lab takes g = 10 N/kg", FR "Sur la Terre g = 9,8 N/kg, et l'on prend 10 N/kg pour les calculs approchés".
2. 电饭煲, 电饭煲（800 W） (FR) — "Autocuiseur de riz" is a pressure cooker → "Cuiseur à riz", "Cuiseur à riz (800 W)".
3. 另取少量溶液，滴加氯化钡溶液，产生白色沉淀 / 无明显现象 (FR, 2 keys) — "On prélève un autre peu de solution" is not French → "On prélève encore un peu de solution et on ajoute goutte à goutte de la solution de chlorure de baryum : …".
4. 除杂与干燥 (the chemistry mode name; EN + FR) — "drying" had been dropped → EN "Removing impurities and drying", FR "Élimination des impuretés et séchage".
5. {0}的省会（首府、首都）是？ (EN + FR) — "(the seat of government, or the capital city)" does not say provincial / autonomous-region / national capital → EN "What is the capital of {0} (provincial capital, regional capital or national capital)?", FR "Quel est le chef-lieu de {0} (capitale de province, de région autonome ou du pays) ?".
6. 我国第二大淡水湖之一，是长江的重要调蓄湖泊 (EN) — "one of the second largest fresh-water lakes" → "one of the next largest fresh-water lakes in China after the largest, an important regulating lake of the Yangtze".
7. 盐酸浸泡（溶去无机盐） (EN + FR) — the acid is hydrochloric acid → EN "Hydrochloric acid soak (minerals dissolved)", FR "Trempage dans l'acide chlorhydrique (minéraux dissous)".
8. 最后放对 (EN + FR) — "correctly" was missing → EN "Last one placed correctly", FR "Dernier bien placé".
9. 肌肉附着点到肘的距离 / 手到肘的距离 (EN + FR) — the word "distance" was missing → "Distance from muscle attachment to elbow", "Distance de l'attache du muscle au coude", "Distance from hand to elbow", "Distance de la main au coude".
10. E 皿与对照不同的条件数 (EN + FR) — "number of" missing → "Number of conditions of E that differ from the control", "Nombre de conditions de E différentes du témoin".
11. 子房中的胚珠数 (EN + FR) — "number of" missing → "Number of ovules in the ovary", "Nombre d'ovules dans l'ovaire".
12. 氖管 (FR) "Néon" → "Lampe au néon"; 照明的光 (FR) "Lumière éclairante" → "Lumière d'éclairage".

Consistency fix (French grade labels). The grade picker of the app already says 七年级 = "Classe de 5e", 八年级 = "Classe de 4e", 九年级 = "Classe de 3e", and the geography labels use "5e / 4e". The biology unit labels used "7e / 8e" (which is the Belgian / Swiss numbering and wrong for a French reader). 20 values in my range were changed from "7e, …" / "8e, …" to "5e, …" / "4e, …" (the key stays), e.g. 七下 · 人的由来: "7e, 2e semestre · Origine de l'humain" → "5e, 2e semestre · Origine de l'humain". Keys: 八下·生殖和发育, 七下·人的由来, 七下·废物的排出, 七下·人体的运动, 八下·保护生物多样性, 七上·生物与环境, 七上·细胞, 七上·生物体, 七上·绿色植物, 七下·人体的营养, 七下·人体的呼吸, 七下·物质的运输, 七下·生命活动的调节, 七下·感觉器官, 八上·动物的运动和行为, 八上·细菌、真菌和病毒, 八上·生物的多样性, 八下·遗传和变异, 八下·生物的进化, 八下·健康地生活.

Not changed because the keys are outside my third (for the lead / the agent that owns that third): 4 more French values still read "8e": 八下 · 遗传和变异（育种与生物技术）, 八上 · 动物的主要类群, 八上 · 动物的运动, 八上 · 第六单元 生物的多样性及其保护 (`grep -n '"[^"]*": "[78]e, ' src/i18n-data.ts` finds them).

Note: during the run three of my edits were lost, because another agent rewrote the file from an older copy (FR 子房中的胚珠数, EN 肌肉附着点到肘的距离, FR 七上 · 绿色植物). They were applied again; the final state was checked with a script that reads the current values of every fixed key (see the last line of this file).

## Checked and left as they are (examples of what was looked at)

* All spelling is British ("colour", "oesophagus", "anaemia", "fertilise"; "sulfuric" with f); French uses « » and the space before : ; ? !; no placeholder was reordered except "{0}月{1}日 {2}:{3}", which is correctly "{1}/{0}" in FR (day / month) and "{0}/{1}" in EN.
* Astronomy, geography, physics and chemistry numbers (e.g. 4879 km, 1.013×10⁵ Pa, 150 million km, 29.8 km/s, moon counts "as of 2025") agree with the Chinese key in EN and FR. Facts themselves (e.g. 274 moons of Saturn) were NOT checked against sources; that is content proofreading.
* Left / right / up / down (左 右 上 下) are used only as microscope slide directions: "left / right / up / down", "gauche / droite / haut / bas" correct.
* 条 / 个 / 粒 / 只 (measure words) have an empty translation on purpose.

## Unresolved, with questions for the user

1. **物质** (key) is translated "The substance" / "La substance " (with the article and a trailing space, built for a sentence fragment) but is also a stand-alone control label.
   * fragment: `src/chemlogic4.ts:229` (stem "物质 … 的用途是：" → "The substance X is used for:");
   * stand-alone label: `src/phys/internal.ts:30` (the choice control "物质" of the internal-energy lab; it shows "The substance" / "La substance " as a label).
   Question: split with `cx("物质", "label")` (code change) or use "Substance" in the label?
2. **说明** → "Note" / "Remarque": `src/geolab-sims2.ts:114` (a note about the crust: fits) and `src/bio/match.ts:47` (the description of the function of an organelle: "Description" would fit better). Question: split with `cx`?
3. **干燥 / 潮湿** → FR "Sèche / Mouillée" (feminine, written for "la main"): `src/phys/home.ts:26` (hand) and `src/bio/model-ecology.ts:4` (the factor "水分": water in the experiment, "Eau: sèche / mouillée"?). Question: is the factor better as "Sec / Humide"?
4. **内容** → "Topic" / "Thème": a mode control label in `src/geolab-sims2.ts:112`, `src/bio/slide.ts:26`, `src/bio/health.ts:18`. "Content" would be literal; "Topic" is acceptable. No change; mentioned for the lead.
5. **判断** → "Verdict" (4 call sites: `bio/bloodpressure.ts:32`, `bio/seedlab.ts:42`, `bio/vessels.ts:28`, `phys/engine.ts:36`) and **你的判断** → "Your answer". The Chinese means "judgement / assessment". "Verdict" is a bit legal; "Assessment" / "Évaluation" would be neutral. No change.
6. **French collège numbering of the Chinese grades** (decision for the user): the app maps 七 / 八 / 九年级 to 5e / 4e / 3e (age equivalence). The usual "first year of junior high = 6e" mapping would give 6e / 5e / 4e. Which one is intended? The three labels in the grade picker and every "5e / 4e" label must follow the same choice.
7. **English wording of the volume labels:** the geography labels read "Grade 7 vol. 1 · …" while the biology labels read "Grade 7, term 1 · …". Question: use "term" in both?
8. French sentences addressed to a child inside the coding stage (sprite speech: "Aimes-tu les pommes ?", "Réfléchis encore.") use the tu-form, the UI rule 47 asks for the vous-form. They are speech of characters in a story (content), so they were left; confirm.
9. French number formatting is not uniform: "4 879 km", "1 731 g" (with a space) but "11460 ans", "3000 g", "20 000 Hz" mixed. Not changed (many entries, a style decision).
10. **Content to proofread by a teacher (not a translation question):** the lessons / quiz texts of the physics and biology labs and the astronomy facts were only checked for agreement with the Chinese text, not for correctness. In this range the only content point that disagreed with the Chinese was item 1 above.

## Limits of this audit (said honestly)

* The back-translation of the 254 long paragraphs was condensed (facts and numbers kept, not word for word), so a changed nuance inside a long sentence could be missed; those were additionally checked by the number comparison and the character overlap, and each EN / FR pair was read once against the other.
* Stage 3 read about 25 call sites; the other 1,500-odd short keys were only located (most of them are used once, in one file, as one label). A key used for two meanings that appears in only one file was not searched for.
* The 4 French grade labels outside my range are reported, not fixed.
