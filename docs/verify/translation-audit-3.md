# Translation audit 3 (last third of the English block and the same keys of the French block)

Scope: keys 7646 to 11468 of the English block of `src/i18n-data.ts` (3,823 keys, file order at the time of the audit, first key 算法, last key 实验室温度计 ... 读数) and the same 3,823 keys in the French block.
Method: three stages, as asked. Nothing was committed or pushed. Only `src/i18n-data.ts` (single-line Edit tool edits) and this report were touched.

## Counts

| Stage | What was done | Result |
|---|---|---|
| 1 Blind back-translation | 26 chunks of 150 keys (the last one 73) were produced by a script that contains only the EN and FR texts (numbered, no Chinese). A Chinese back-translation was written for every entry from those files only. | 3,823 / 3,823 entries back-translated (EN and FR read together: the back-translation reflects both; where FR differed from EN the entry was noted while writing). |
| 2 Compare | A script paired each back-translation with the original key (bigram / character similarity). All pairs with similarity below 0.62, every key of 3 characters or fewer that was not identical, and about every 10th of the remaining non-identical pairs were read with the EN and FR next to them. | 3,823 pairs: 1,900 identical after normalisation, 597 read as low-similarity, 1,365 close but not identical (about 135 read as a sample, many more were seen while reading the low-similarity list). 19 keys were fixed from this stage (plus 4 from the automatic checks). |
| Automatic checks over all 3,823 keys | placeholders `{n}` identical in key, EN and FR; digits identical (57 differences examined by hand: all legitimate rewordings such as ordinal words, "1" dropped before "kW·h" in FR, "Chapter n"); French spacing before `: ; ? !`; French vous-form (no tutoiement found other than the one fixed); CJK left in EN / FR outside brackets (only the deliberate `京, 沪, 苏` item); flattery words; trailing spaces (all intentional: "label:  " keys); British spelling (colour, centre, grey ... consistent). | 0 placeholder faults, 0 spacing faults, 1 tutoiement, 0 untranslated texts. |
| 3 Context | The 2,197 keys of 6 or fewer meaningful characters were located in `src/**/*.ts` (file:line); 499 of them are used in more than one place and 370 in more than one file. All 370 were skimmed and the 30 or so that could carry two meanings were opened in the code. | 7 keys fixed (118, 137, 150, 1163, 1304, 2349, 2387), 5 keys reported below as one key with two meanings. |

Total edits applied: 39 single-line edits (EN and FR lines) for 30 keys. `npm run check:i18n` and `npx tsc --noEmit` pass after the edits (`i18n ok: 8390 texts`).

Honesty notes about the method:
- The first two chunks of the audit shared a scratch folder with other audit agents who overwrote the helper files; I moved to a private folder. For keys 150-299 (chunk 1) a script printed the Chinese key next to the English by mistake before I wrote the back-translation, so that chunk is not fully blind (it contains program-block labels and system messages, 120 of the 150 matched).
- Another audit agent was editing the same file at the same time. Straight double quotes in 17 of my keys (3119 ... 3496), the French `重置` ("Refaire") and the `℃` to `°C` change were already fixed by someone else when I came to edit them; I did not touch those again. They are not counted in my 39 edits.
- A back-translation by a model can share the same blind spots as the translation. The content libraries (physics, chemistry, astronomy, geography facts) were checked for sense and for numbers, not for scientific correctness.

## Fixes applied (key index in my third, key, language, old, new)

| # | Key | Lang | Old | New |
|---|---|---|---|---|
| 118 | 邻居数 | EN | Neighbours | Number of neighbours |
| 137 | 按住 | FR | enfoncée : | touche enfoncée : |
| 150 | 改为 | FR | à | en |
| 292 | 提示“大了 / 小了” | EN | Hints "too high / too low" | Hints “too high / too low” |
| 313 | 暂无题目。请先在“编辑”里添加。 | EN | No questions yet. Please add some in "Edit". | No questions yet. Please add some in “Edit”. |
| 369 | 把“创作”里保存的积木作品变成代码。 | FR | Transforme une œuvre en blocs enregistrée dans « Créer » en code. | Transformez une œuvre en blocs enregistrée dans « Créer » en code. |
| 441 | 化合反应：两种或两种以上的物质生成一种物质（多变一）。 | FR | Réaction de synthèse : deux substances ou plus forment une seule substance. | Réaction de synthèse : deux substances ou plus forment une seule substance (plusieurs en une). |
| 442 | 分解反应：一种物质生成两种或两种以上的物质（一变多）。 | FR | Réaction de décomposition : une substance forme deux substances ou plus. | Réaction de décomposition : une substance forme deux substances ou plus (une en plusieurs). |
| 1163 | 卫星归属 | EN | Which planet | Moon and its planet |
| 1163 | 卫星归属 | FR | Quelle planète | Lune et sa planète |
| 1210 | 平均密度 | FR | Densité moyenne | Masse volumique moyenne |
| 1223 | 自西向东（顺行） | FR | d'ouest en est (progrades) | d'ouest en est (prograde) |
| 1261 | 仙后座的“W”在北极星的另一侧，也能帮助定位。 | EN | The "W" of Cassiopeia is on the other side of the Pole Star and helps too. | The “W” of Cassiopeia is on the other side of the Pole Star and helps too. |
| 1299 | 云层顶部至 1 个大气压处 | EN | Cloud top to the 1-bar level | Cloud top to the 1-atmosphere level |
| 1299 | 云层顶部至 1 个大气压处 | FR | Du sommet des nuages au niveau de 1 bar | Du sommet des nuages au niveau de 1 atmosphère |
| 1300 | 最低温至 1 个大气压处 | EN | Coldest point to the 1-bar level | Coldest point to the 1-atmosphere level |
| 1300 | 最低温至 1 个大气压处 | FR | Du point le plus froid au niveau de 1 bar | Du point le plus froid au niveau de 1 atmosphère |
| 1304 | 综合常识 | EN | General | General knowledge |
| 1304 | 综合常识 | FR | Général | Culture générale |
| 1467 | 不知道几级台阶 | EN | Stairs of unknown size | Stairs with an unknown number of steps |
| 1467 | 不知道几级台阶 | FR | Escalier de taille inconnue | Escalier au nombre de marches inconnu |
| 1750 | {0} ≈ ? 万（省略万位后面的尾数） | EN | {0} ≈ ? ten thousand (drop the digits after the ten-thousands place) | {0} ≈ ? ten thousand (rounded to the ten-thousands place) |
| 2349 | 自动完成 | EN | Finish it | Auto-complete |
| 2349 | 自动完成 | FR | Terminer | Terminer auto |
| 2387 | 最好 {0} 步 | EN | Your best {0} | Best {0} moves |
| 2387 | 最好 {0} 步 | FR | Votre record {0} | Record {0} coups |
| 2661 | 开启后，字帖只练习所输入的字；本周和上周要认读的字将随机排列，印在每一行的左右两… | FR | Lorsque cette option est activée, la feuille ne travaille que les cara … ans un ordre aléatoire à gauche et à droite de chaque ligne. | Lorsque cette option est activée, le cahier d'écriture ne porte que su … ans un ordre aléatoire à gauche et à droite de chaque ligne. |
| 2748 | 共 {0} 题，限时约 {1} 分钟 | EN | {0} questions, about {1} minutes | {0} questions, time limit about {1} minutes |
| 2748 | 共 {0} 题，限时约 {1} 分钟 | FR | {0} questions, environ {1} minutes | {0} questions, durée limitée à environ {1} minutes |
| 2969 | 节奏模板： | FR | Rythmes prêts : | Rythmes prédéfinis : |
| 2977 | 保存当前节奏 | EN | Save this beat | Save current rhythm |
| 2977 | 保存当前节奏 | FR | Enregistrer ce rythme | Enregistrer le rythme actuel |
| 3149 | 数字信号是用什么来表示信息的？ | FR | Que utilise un signal numérique pour représenter l'information ? | Qu'utilise un signal numérique pour représenter l'information ? |
| 3233 | 烧开水时壶嘴冒出的白气 | FR | La « fumée blanche » qui sort du bec d'une bouilloire d'eau bouillante | La « buée blanche » qui sort du bec d'une bouilloire d'eau bouillante |
| 3361 | 不能减弱噪声 | FR | ne pas réduire le bruit | ne pas être un moyen de réduire le bruit |
| 3504 | 光源很小（点光源）时，物体后面只有一片黑暗的影；光源较大时，影的中间是完全没有光… | FR | Quand la source est très petite (source ponctuelle), il n'y a derrière … re, il n'y a pas d'éclipse de Soleil ou de Lune chaque mois. | Quand la source est très petite (source ponctuelle), il n'y a derrière … re, il n'y a pas d'éclipse de Soleil ou de Lune chaque mois. |
| 3787 | 本影的宽度 | FR | Largeur de l'ombre propre | Largeur de la zone d'ombre complète |
| 3788 | 没有本影 | FR | Pas d'ombre propre | Pas de zone d'ombre complète |
| 3796 | 影：换成点光源，使影只有本影、没有半影 | FR | Ombre : passez à une source ponctuelle pour que l'ombre n'ait qu'une ombre propre et pas de pénombre | Ombre : passez à une source ponctuelle pour que l'ombre soit une zone d'ombre complète, sans pénombre |
Reasons, grouped:
- Wrong sense / unit lost: 1163 (卫星归属 was translated as "Which planet", the label of another topic), 1299 / 1300 (key says 1 atmosphere, text said 1 bar), 1467 (unknown number of steps, not "size"), 1750 (省略 ... 尾数 is rounding, not dropping digits), 2349 (自动完成 is the auto-complete button, not "Finish it"), 2387 ("Your best 12" lost the unit: key is 最好 {0} 步), 2748 (限时 time limit dropped), 118 (邻居数 is the number of neighbours, duplicated 邻居), 1304 (综合常识 = general knowledge), 3361 (answer fragment must complete "..., c'est :").
- Wrong French term: 1210 (densité is dimensionless: masse volumique), 3504 / 3787 / 3788 / 3796 (ombre propre means the shadow on an object, not the umbra: zone d'ombre complète), 3233 (fumée blanche -> buée blanche, as used in text 3135), 2969 (prêts is "ready", presets are prédéfinis), 1223 ("progrades" plural slip), 441 / 442 (the (多变一) / (一变多) remark was lost in FR).
- Wrong register / grammar: 369 (tutoiement "Transforme" -> vous), 3149 ("Que utilise" -> "Qu'utilise"), 2661 ("la feuille ne travaille que" is not French; 字帖 is "cahier d'écriture" everywhere else), 137 / 150 (fragments of a block sentence: "touche enfoncée :" and "en").
- Button and its explanation did not match: 2977 (button said "Save this beat" while the explanation 2981 tells the user to tap "Save current rhythm"; same Chinese text 保存当前节奏).
- Typography: 292, 313, 1261 (straight quotes in EN, the rest of the file uses curly quotes).

## Unresolved, for the user (code or content decision)

One Chinese key used for two meanings (not split, listed with the uses):
1. `循环` (EN "Loop" / FR "Boucle"): world name in the coding map (`src/coding-levels.ts:329`, the other worlds are plural: Sequence, Conditions, Functions ...) and the DJ re-loop button (`src/dj.ts:200`). The world would read better as "Loops" / "Boucles". Question: split the key (for example `cx("循环", "loops")` in coding-levels) or accept the singular?
2. `顺序` (EN "Sequence" / FR "Séquence"): coding world 1 (`src/coding-levels.ts:329`) and the astronomy quiz topic for the order of the planets (`src/spacemodel.ts:164`, there it is already `cx("顺序", "order")`, so the table entry only serves the coding world: check that the astronomy label really goes through `cx`).
3. `排序` (EN "Order" / FR "Ordre"): poem practice mode "put the lines in order" (`src/poems.ts`) and coding lessons about sorting algorithms (`src/coding-lessons2.ts`, `src/coding-textlessons.ts`: the key is used there too), where "Sorting" / "Tri" would be right if it is the sorting-algorithm meaning.
4. `地区` (EN "District" / FR "Quartier"): the only use found is the bias-lab feature name (`src/coding-infolabs2.ts:266`), so "District" fits; but 地区 is also the common word for "region" (it appears inside the map texts 1717-1720), so a future use of the same key for a region would be wrong. Listed as a risk, nothing changed.
5. `范围：` (EN "Scope:" / FR "Niveau :", `src/geomap.ts:98`): the chips choose the level of the map practice (rule 53), so "Level" would be clearer than "Scope" in English. Question: keep "Scope" (literal) or change both languages to "Level" / "Niveau"?

Questions about content and wording:
6. Grade names are mixed in French: 一年级 .. 六年级 are "Année 1 .. 6", 初一 .. 初三 are "Collège 1 .. 3" (2722-2730), while 八年级 / 九年级 are "Classe de 4e" / "Classe de 3e" (646 / 647). Which scheme should the French screen use (French school levels 6e .. 3e, or Chinese grade numbers)?
7. `白棋 / 黑棋 / 白方 / 黑方` are all "Blancs / Noirs" (chess, correct) but the Gomoku and Reversi variants use "Noir / Blanc" and "les noirs / les blancs" (2370-2381): French capitalisation and number of the colour names are not uniform (Blancs / blancs / Blanc). Should the French follow one rule (chess: "les Blancs", stones: "les blancs")?
8. `Link-up` (2078), `Bubble Shooter` (2495), `Klotski` (2497) and the title `Candy Match` inside 2420 are left in English in FR (2496 `Candy Match` is `Bonbons`): intentional game names, or should they be translated (for example `Bubble Shooter` -> `Tir de bulles`)?
9. EN uses both `yuan` and plural forms in FR (`yuans` in most places, `yuan` in 2755 `{0} yuan = ? jiao`): confirm `yuans` for FR everywhere.
10. 2539 "Nine drums and cymbals" (key 九个鼓和镲): rule 43 / the drum pads speak of 8 pads; check the number in the Chinese source.
11. 1250-1300 astronomy: moon counts say "as of 2024" (key 截至 2024 年), while CLAUDE.md rule 66 says the data file follows 2025.
12. Several keys of the math / science day pages still say "week" (for example 2740 `正在生成这一周的知识点…`, 2741, 2745-2749, 2827-2836) while CLAUDE.md rule 33 says the content is now per day. Key and translations agree with each other, so nothing was changed; the Chinese keys may need updating.

Not done: keys 0 .. 7645 (other agents). No fix was made for Chinese-side faults (only translations were edited).
