# Verification report: chemistry (化学)

Scope: `src/data/chem.json` (built by `scripts/make-chem.mjs` + `scripts/chem/extra.mjs`) and the rules in `src/chemlogic.ts`, `chemlogic2.ts`, `chemlogic3.ts`, `chemlogic4.ts`.
Report only: no source file was changed.

## Method and honesty

- I read the whole data file, both build scripts and all four logic files.
- I wrote scratch scripts (scratchpad `meta.py`). They enumerate the 复分解 judge over every pair in the solubility table, and check each reaction's `type` against its structure and each equation's balance.
- All 157 equations are atom-balanced and every `type` matches its structure (化合 / 分解 / 置换). The build script already enforces balance.
- **No authoritative source could be opened.** One WebSearch for the 2022 课标 必做实验 list only returned local exam guides:
  - Dongguan exam guide (not the 课标 text): https://edu.dg.gov.cn/attachment/0/404/404587/4522042.pdf. It lists 氧气的实验室制取与性质 and 粗盐中难溶性杂质的去除 as exam experiments.
  - No official 课标 PDF or 人教版 table was fetched.
- Every other judgement below is **from general knowledge, unverified against the textbook or the 课标 text**.
- The solubility table and the solubility numbers were checked against my memory of the 人教版 appendix and the usual curve values. I believe they are right but did not compare them with a scan.

## Findings (sorted by severity)

### ERROR

**E1. The `dec` (复分解) mode asks about slightly soluble products and marks them as "能反应，生成沉淀".**
- Where: `src/chemlogic.ts` `metathesis()` (about lines 483-525) and `genDec()`.
- Only a slightly soluble REACTANT sets `ambiguous`. A slightly soluble PRODUCT (CaSO4, Ag2SO4, MgCO3, Ca(OH)2) counts as a precipitate. `genDec` skips only `m.ambiguous`.
- My enumeration of the table finds 46 reactant pairs (about 46 of roughly 1000) whose only "reason" is a slightly soluble product. Examples:
  - NaOH + CaCl2, KOH + Ca(NO3)2, Ba(OH)2 + CaCl2 (product Ca(OH)2)
  - Ca(OH)2 + Na2SO4 (CaSO4)
  - CaCl2 + Na2SO4, Ca(NO3)2 + K2SO4
  - AgNO3 + Na2SO4 (Ag2SO4)
  - MgCl2 + Na2CO3 (MgCO3)
  - acid + salt pairs of the same kind, such as H2SO4 + Ca(NO3)2 or H2SO4 + AgNO3
- 人教版 and exam practice treat these as "no reaction" or as ambiguous (the textbook table marks them 微).
- `docs/chem-coverage.md` says such pairs are "never asked". That is true for `infer`, `rem` and `prop`, which use `mix()` and its `slight` test, but **not** for `dec`.
- Fix: in `metathesis` set `ambiguous` when a product cell is "m" (as `chemlogic3.mix` already does), or have `genDec` also reject `mix(a,b).ambiguous`.

### DOUBTFUL (content)

| # | Where | Text | Why | Proposed fix |
|---|---|---|---|---|
| D1 | r074 `Fe3O4+4CO=3Fe+4CO2` phenomenon | "黑色粉末逐渐变为银白色的铁" | Reduced iron powder in the school experiment is black. r075 says "变黑". Fe3O4 is black too. | "黑色粉末仍为黑色（生成的铁粉也呈黑色），澄清石灰水变浑浊" |
| D2 | r078 `4Fe+3O2+6H2O=4Fe(OH)3` | product Fe(OH)3, "红褐色物质" | Rust is Fe2O3·xH2O. The same file calls Fe2O3 "铁锈的主要成分" and r081 says "红棕色铁锈". The textbook gives no equation for rusting. | Keep the equation as a teaching model but make the colour "红棕色" and add "（铁锈的主要成分是 Fe2O3·xH2O）", or drop the equation |
| D3 | r083 vs r097 / r062 | CuO + HCl "溶液变为蓝色", Cu(OH)2 + HCl "蓝绿色", Fe + CuCl2 "蓝绿色" | Inconsistent colour of CuCl2 solution (concentrated green, dilute blue). Textbooks usually say 蓝绿色 for the CuCl2 reactions. | Use "蓝绿色" in r083 as well |
| D4 | r133 `NaOH+NH4Cl` cond "常温" vs r134-r136, r150 "加热" | Inconsistent. The textbook test for ammonium is "加碱，加热 / 研磨". | Set r133 to "加热" |
| D5 | r137 `N2+3H2=2NH3` cond ["高温","催化剂"] | The phenomenon says "高温、高压和催化剂", but 高压 is not a condition option. | Add "高压" to `CONDS` or drop it from the sentence |
| D6 | r027 `H2+Cl2` chapter `acid` | In the textbook it appears in 课题 "燃烧和灭火" (燃烧不一定需要氧气), the `fuel` chapter. r155 `Mg+CO2` is in `carbon`; the textbook has it in the same place. | Both to `fuel` |
| D7 | r092 `Ca(OH)2+H2SO4` phenomenon | "无明显现象，溶液中出现微溶的白色固体" | Self-contradictory | "溶液中可能出现微溶的白色固体（CaSO4）" |
| D8 | r112 phenomenon | "草木灰不能和铵态氮肥混用也与此类碱性有关" | Not a property of this reaction (K2CO3 + Ca(OH)2). Misleading. | Drop the parenthesis or use "（草木灰的水溶液呈碱性）" |
| D9 | r020 CO2+H2O and r018 CaO+H2O chapter `water` | CO2 + H2O is in unit 6 (`carbon`). CaO + H2O is in unit 10 / unit 9. | Move r020 to `carbon` | low priority |
| D10 | r047 `2CO+O2` chapter `fuel` | The textbook introduces it in the CO section (unit 6) | Optional | style |
| D11 | `subs` C alias "金刚石、石墨、木炭" and P alias "红磷" | 木炭 is a mixture, not an alias of the element C. 红磷 is an allotrope, not a 俗称. | C: "金刚石、石墨、C60 等是碳的单质"; P: remove the alias or write "红磷、白磷" | |
| D12 | `subs` HCl named "盐酸" (alias 氢氯酸) | The compound is 氯化氢. 盐酸 is the aqueous solution. The textbook writes 盐酸（HCl）, so acceptable. | Add "氯化氢的水溶液" to the explanation. The `mix` entry 稀盐酸 is correct. | style |
| D13 | `chemlogic2` `loss` pool includes r010 `2HgO=2Hg+O2` | "加热含杂质的固体混合物 … 剩余固体的质量". Hg is a liquid and vaporises, so "剩余固体" is wrong. It is also not a school experiment (toxic). | Exclude HgO from `P.heat` (keep KClO3 and CaCO3) | |
| D14 | `ENV` pair 酸雨 → 二氧化硫 | Acid rain is caused by SO2 and NOx. A question "造成酸雨的主要原因是" with only SO2 is incomplete. | "二氧化硫和氮氧化物" | |
| D15 | `ORD` weighing task | Putting the paper on both pans comes after adjusting the balance, but a student may also put the paper first and then adjust. The order is arguable. | Merge into one step "垫纸并调节天平平衡", or accept both orders | |
| D16 | `APPS` 锥形瓶 use "…也用于滴定" | Titration is outside 初中. It is harmless but not 课标. | Remove "也用于滴定" | |
| D17 | `act` / `dec` for carbonates + H2SO4 / CaCO3 | CaCO3 + H2SO4 is shown as "能反应，生成气体" by the judge. The `gases` bank correctly says the reaction stops. | Add a note in `why` or mark CaCO3/BaCO3 + H2SO4 as ambiguous | low |
| D18 | `calc2` "pure" / "yield" / "excess" use reactions where the reactant is a gas or an acid solution | e.g. "取 … g 含 CaCO3 的样品 … 得 H2O 多少 g" is mathematically fine. Some stems ("工业制取时") fit badly with unrelated equations. | Optional filter | style |

### STYLE / small points

- r003 and r002: wording matches the textbook. r084 CuO + H2SO4 "加热" matches the textbook "微热" (acceptable).
- `mix` 空气 "氮气约占78%，氧气约占21%": say 体积分数 ("按体积计").
- `gases` O2 test and full-bottle test are correct. H2 "full" mentions only water displacement, while its `col` also lists E. Optional.
- `elements` lacks He, Be, B, Ne, Ar, but `ATOMS` has all of the first 20. That is fine, because the atom mode uses `ATOMS`.

## Coverage gaps (课标 / 人教版 / 中考)

- 氨水 NH3·H2O (a common base in the textbook), 磷酸 H3PO4, and the fertiliser classes (氮 / 磷 / 钾 / 复合肥: 尿素, NH4NO3, KNO3, Ca(H2PO4)2, NH4H2PO4). `docs/chem-coverage.md` already admits that fertiliser classification is missing.
- 简易供氧器 (a 课标 required practice; I could not confirm it from the 课标 text). The reaction options (过碳酸钠, 过氧化氢 + MnO2) are not modelled. No equation for 2Na2O2 + 2H2O or the 过碳酸钠 decomposition.
- Neutralisation with HNO3: no `NaOH + HNO3` or `Ca(OH)2 + HNO3` equation, although HNO3 is in `subs`.
- SO2 + Ca(OH)2 and CO2 + Ba(OH)2 (absorption and test reactions) are missing.
- Combustion-condition experiment (the 铜片 / 白磷 / 红磷 燃烧条件 探究) appears only through a bank question, not a reaction (白磷 4P + 5O2 cannot be told apart from red phosphorus).
- Missing apparatus in `APPS`: 长颈漏斗, 玻璃棒, 铁架台, 水槽, 燃烧匙, 坩埚钳, 托盘天平, 试管夹, 石棉网. The `lab` bank mentions several of them.
- Not covered: 质量守恒定律 weighing experiments, 电解水 apparatus drawing, 溶液导电性, 中和 pH curve, 金属 properties tables, 化肥 identification. Some are named in the existing coverage doc.

## Verified OK (from my own knowledge, not a document)

- Solubility table (13 cations × 5 anions): every cell matches my memory of the 人教版 appendix (OH⁻: Ca 微, Mg/Al/Zn/Fe/Cu 不; SO4²⁻: Ba 不, Ca/Ag 微; CO3²⁻: Ba/Ca/Zn/Fe2/Ag 不, Mg 微, Al/Fe3/Cu "-").
- Solubility numbers of KNO3, NaCl, NH4Cl, KCl, CuSO4, Ca(OH)2 at 0-100 °C agree with the usual textbook values. The crossing-curve pairs I recomputed are consistent (KNO3/NaCl, KNO3/KCl and KNO3/NH4Cl cross between 20 and 40 °C).
- Activity series K Ca Na Mg Al Zn Fe Sn Pb (H) Cu Hg Ag Pt Au.
- School atomic masses (Cl 35.5, Cu 64, Zn 65, Fe 56, Ag 108, Ba 137 …).
- Usual valences. `valenceIn` correctly refuses Fe3O4, NH4NO3, H2O2.
- Gas densities (H2 0.09, O2 1.43, CO2 1.98 g/L) and the acid densities (98 % H2SO4 1.84, 37 % HCl 1.19, 10 % NaCl 1.07, 10 % NaOH 1.11, 20 % H2SO4 1.14).
- pH values (胃液 1.5, 雨水 5.6, 血液 7.4, 石灰水 12 …), and the indicator colours (石蕊 红/紫/蓝, 酚酞 无/无/红).
- The 38 `lab`, 15 `life`, 27 `prop`, 9 `atomqa` and 7 `remgas` questions have a correct keyed answer in my judgement. The 13 ordering tasks have a plausible textbook order (see D15).
- Metal-with-acid and metal-with-salt phenomena (Fe浅绿, Cu蓝, Ag银白), the Fe³⁺ yellow and Cu(OH)2 blue / Fe(OH)3 red-brown precipitates.
- The flows f1-f5 and the ion simulator logic (BaCl2 → NaOH → Na2CO3 → filter → HCl).
- The `infer`, `rem` and `prop` generators already refuse slightly soluble products (`mix().ambiguous`).
- Atom shell filling for Z ≤ 20, usual ions, and neutron counts.

## Could not verify

- The official 课标 text (必做实验 list, content requirements), 人教版 九上 / 九下 table of contents and appendix tables. The one search returned only local exam guides.
- The "grade level" (1 / 2 / 3) of each equation (`levelOf` is only by coefficient size, not by textbook).
- The idiom-like details of the lab banks (e.g. "3%-5% 碳酸氢钠" after concentrated H2SO4 burns: it matches my recollection of the 人教版 text).
- All phenomenon sentences beyond those listed above: judged only from memory.
- The French and English translations (not in scope).
