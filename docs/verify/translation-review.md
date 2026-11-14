# Review of the English / French translations of the science content

Scope: `src/data/trans/parts/*.json` (notes, formulas, figures, cards-0..5, glossaries), `src/i18n-extra/{phys,bio,geo,chem,space}content.json`, the lab frame texts `physlab.json` / `biolab.json`, and the same keys inside `src/i18n-data.ts`. Keys (Chinese sources) were never changed, only values. All edits were made through a small script that changes the exact value in every file that holds the key (part files, extras, `i18n-data.ts`), then `node scripts/make-trans.mjs` rebuilt the flat tables.

Method: (1) programmatic scans of all ~21,400 effective strings (after the first-wins rule of the part files), (2) a read-through of about 650 random strings (cards 40 %, notes 20 %, formulas / figures, lab frames and content texts), (3) a targeted check of the safety-critical strings. Model-written translations were generally good (formal register, terms consistent); the faults found were mostly systematic, so one rule fixed many strings.

## Counts (distinct values changed; one string often lives in 2-3 files)

| Category | Found | Fixed |
|---|---|---|
| FR physics questions that said `g = 9,8 N/kg` where the Chinese (and the lab) use `g = 10 N/kg` | 16 | 16 |
| FR answers of the knowledge cards that leaked the right answer by grammatical gender ("Il …" for a girafe card, "Elle …" for a foie card, "Il a huit bras" as a distractor on a masculine card): the right answers of animal / plant / organ / planet cards now start gender-neutral ("Cet animal …", "Cette plante …", "Cet organe …", "Cette planète …", "C'est un …") | about 110 | about 110 |
| FR generic answers with a fixed gender used for subjects of both genders ("Il ne change pas" for a mass, "Elle disparaît", "Il diminue" …): now "Cela ne change pas / disparaît / diminue / augmente / reste inchangé" | 5 keys (about 30 uses) | 5 |
| FR planets treated as feminine (Jupiter "elle", Uranus "découverte", Neptune "prédite", Phobos "elle se lève", Triton "elle possède" …); planets and moons are masculine except Vénus, la Terre, Cérès, Éris | 14 texts | 14 |
| FR missing elision / article ("de Anhui", "la Arabie saoudite", "le Oman", "du Ouzbékistan", "de Uranus", "de Isaac Newton" …) | 42 | 42 |
| FR province names without the article ("la capitale de Henan", "se situe Ningxia", "province de Henan") | 174 | 174 |
| FR curly apostrophe `’` mixed with the straight `'` used everywhere else | 447 | 447 |
| FR decimal point instead of decimal comma (`3.1415926`, `18.998`) outside TeX | 88 | 88 |
| FR no space before `;` | 4 | 4 |
| FR thousands without separator (`20000 Hz`, `100000 fois`) and EN thousands with a space (`20 000`) or without a comma | 14 | 14 |
| EN `℃` mixed with `°C` (also FR); EN `50 %` mixed with `50%` | 100 + 67 | all |
| EN straight `"` quotes mixed with curly `“ ”` | 337 | 337 |
| EN spelling: `sulphur / sulphuric` (the chemistry texts use IUPAC sulfur), `Center`, `toward` (British `towards`) | 3 + 1 + 5 | 9 |
| EN element names capitalised in the middle of a sentence ("What is the symbol of Hydrogen?"), FR `l'élément Rhodium` (French element names are lower case) | about 365 values | all |
| Answer buttons that started with a lower-case letter although they are the only text of a button (en 58, fr 162: "thorium", "dynastie Han", "mètre carré") | 220 | 220 |
| Zodiac: 牛 was "Cow / Vache" (and 羊 "Sheep / Mouton") in answers while the questions say "ox / bœuf" and "goat / chèvre" | 2 keys | 2 |
| Wrong EN/FR meaning or wording: "成像规律" = "Images:" (now "Image formation:"), "which **group** of elements" for a category (now "category"), "heavenly body", "backward" for 落后, "send" alone in the burns mnemonic (now "send to hospital"), "give cardiopulmonary resuscitation", `{0} 亿` = "{0} hundred million" (now `{0} × 10⁸`), "Hard (not to be kept up)", "Nerve length of the arc", "wake him", a "SAMU" for the Chinese 120 line, "Mésange volant du lait", "Guatemala est la capitale du Guatemala" | 17 | 17 |
| Subscript lost in FR formulas (`F = P − F_lue` for F浮, now `F_poussée`) | 8 | 8 |
| Wrong grammatical number: "les frères Wright a inventé", "les frères Grimm a recueilli" (and a lower-case start) | 2 | 2 |
| Question wording: "Dans quelle poubelle faut-il jeter : les journaux" (stray colon) | 25 | 25 |
| FR "division de niveau provincial" (literal) → "division administrative de niveau provincial" | 39 | 39 |
| Obsolete / offensive English-French terms in 三大人种 ("Mongoloid / Caucasoid / Negroid", "négroïde") replaced by the source's colour terms and a note that this is the textbook classification | 7 | 7 |
| Inconsistent terms: Yangtsé / Yangzi (FR), Dzoungarie / Junggar, "plateau Qinghai-Tibet" / "plateau du Qinghai-Tibet", "Mongolie intérieure" / "Mongolie-Intérieure", Nanjing / Nankin (FR), "Qinghai–Tibet" / "Qinghai-Tibet" (EN), "sliding rheostat" / "rheostat", "paraffin oil" / "kerosene" for 煤油, "lentille convexe/concave" / "convergente/divergente" | 74 | 74 |

Scans that found nothing to fix: empty values, untranslated leftovers, Chinese punctuation, double spaces, English text in the French file and vice versa (one false positive: "Yu the Great"), mismatched digits (the 114 hits were months / Chinese number words / 万 / 亿 conversions; the only real ones were the g values above), unbalanced brackets or « », "faux amis" in the 300 most frequent science terms.

## Safety-critical strings (40 + the hotline family)

Checked item by item against the Chinese: 110 police, 119 fire, 120 ambulance / first aid, 122 traffic accident, 12355 youth service, 96110 anti-fraud, 12315 consumer, 12345 government service hotline (all 85 strings with a number: same number, same service in EN and FR); CPR (5-6 cm, 100-120 a minute, 30:2, call 120 first, AED); burns (冲脱泡盖送, five steps); choking (Heimlich); e-bike age 16 and bicycle age 12; helmet; warning colours (blue / yellow / orange / red; heat = yellow / orange / red); the 35 °C, 37 °C, 40 °C heat thresholds; medicine dose wording (example drug, leaflet, doctor or pharmacist); sleep hours. All numbers and meanings are identical. One **source** inconsistency is open (see open-questions-translation.md).

## Glossary decisions

* Spelling: British school style throughout (colour, centre, metre, litre, neighbour, organise / oxidise, defence, aeroplane, tonne, towards, lift, tap, yoghurt), with the IUPAC spellings **sulfur / sulfuric / sulfate** and **aluminium**. Numbers: EN `6,300` and `50%`, FR `6 300` and `50 %`; temperatures `20 °C` in both; decimals: EN point, FR comma; quotes: EN “ ”, FR « ».
* Element and substance names are lower case in running text in both languages; the first letter is capitalised only when the string is a button / label on its own.
* FR chemistry: cards keep the everyday names (oxygène, hydrogène), the chemistry lab and formulas use the collège names (dioxygène, dihydrogène). Not unified (see open questions).
* FR physics: `lentille convergente / divergente`, `poussée d'Archimède` (F_poussée), `masse volumique`, `tension`, `intensité` for current in a calculation; `courant` for the phenomenon.
* FR geography: province names carry their article (le Henan, le Tibet, l'Anhui, la Mongolie-Intérieure); pinyin names are kept (Yangzi, Junggar, Tarim, Qaidam), historical city names in French only where they are the usual French form (Pékin, Nankin, Canton in "Pékin–Canton"); planets and moons are masculine except Vénus, la Terre, Cérès, Éris.
* FR animal / plant / organ statements in the quiz cards are gender-neutral ("Cet animal …", "Cette plante …") so that the pronoun never gives the answer away.
* Zodiac and animals: ox / bœuf and goat / chèvre in every context (the 牛 and 羊 keys are shared between the zodiac cards, the "ship of the desert" card and the newton distractor).
* Human groups (人种): "races" only with the colour terms of the source and the words "as classified in the textbook"; no Mongoloid / Caucasoid / Negroid.
* 重力 stays "weight" in force contexts and "gravity" in the card about gravity; 呼吸作用 "respiration" (cards, labs) and "cellular respiration" (notes), as in the school terms of each level.

## Not changed on purpose

* The ~1,000 older, shadowed values in `cards-1` … `cards-5` whose key was mis-keyed in `cards-1` (the 297 entries corrected by `cards-0`): they never reach the screen (first part wins). They were left in the files so that part numbering and `make-trans` output stay stable; they can be deleted in a clean-up.
* Question templates such as "Quelle est l'unité du Système international pour la grandeur « temps » ?" are correct but long; a shorter "Quelle est l'unité SI du temps ?" needs the gender of each quantity.
* The teaching content itself (facts, dates, textbook placement) was not proofread: that is outside a translation review.

## Tests

`node scripts/make-trans.mjs`, `node scripts/check-trans.mjs` (0 missing), `npm run check:i18n`, `npx tsc --noEmit`, `BASE_PATH=/ npx vite build`; suites `91-content-i18n`, `36-notes-formulas`, `33-science` (cards only) against a private Vite on port 5395 (results at the end of this file).

Results: `91-content-i18n` PASS, `36-notes-formulas` PASS, `33-science` (CARDS_ONLY) PASS; `check-trans` 0 missing, `check:i18n` ok, `tsc` clean, `vite build` ok.
