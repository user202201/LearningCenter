# Verification report: formulas-periodic-notes

Scope: `src/data/formulas.json` (183), `src/data/periodic.json` (118), `src/data/notes.json` keys history / geo / bio / politics / safety.
Report only. No source file was changed.

## Method and honesty
- Formulas: every worked example was recomputed by hand (all 183 read), TeX parsed with the repo's own `node_modules/katex` (strict mode) by script, grade / subject labels compared with what I know of 2022 课标 and 人教版 chapter placement.
- Periodic table: compared programmatically with Bowserinator/Periodic-Table-JSON (raw.githubusercontent.com, IUPAC-style data): symbol, English name, mass (tolerance 0.05 %), grid position; Chinese names checked by reading against the official 2016 names.
- Notes: all 5 keys read in full (history 29 dynasties, 85 events, 8 groups; geo, bio, politics, safety). Compared with my knowledge of 统编版 / 人教版 and 课标.
- WebSearch was used twice (高温预警标准; 课标 根与系数/球). It did NOT return the 课标 text or the official 气象局 standard text (only news items consistent with the 高温 standard). **I could not open the 课标 PDFs or the textbooks. Every "课标 / 教材" statement below is from general knowledge, unverified against the primary document**, unless a source URL is given.
- Scripts: scratchpad `pt.py` (periodic), `tex.cjs` (KaTeX).

## Counts
error 5, doubtful 21, style 8. Programmatic: periodic table 118/118 symbols, English names (Cs "Caesium" is the IUPAC spelling), atomic numbers and Chinese names correct; all worked examples numerically correct (0 arithmetic errors found).

## Findings (severity first)

### error
| # | File / location | Text | Why | Proposed correction |
|---|---|---|---|---|
| E1 | formulas.json idx 21 球的体积, idx 22 球的表面积 (g=9, 数学 立体图形) | V = 4/3 πr³, S = 4πr² labelled grade 9 | Sphere volume / surface area are 高中 (人教A 必修二 8.3), not 2022 初中 课标 (初中 solids: 圆柱 圆锥 侧面积/展开). From general knowledge, unverified. | Remove, or mark level 高中 / 拓展 (the formula UI only has `g` 1-9: add a flag or drop). |
| E2 | formulas.json idx 105-113 (物理 运动与声光: 速度, 光的反射定律, 声速, 光速, 平面镜, 凸透镜 x3, 密度), all `g=7` | physics labelled grade 7 | In 人教版 (and most editions) physics starts in 八年级上册 (机械运动, 声, 光, 质量与密度). Grade 7 is wrong for 人教; only some local editions start earlier. | Set `g: 8` for these 9 entries. |
| E3 | notes.json safety [1.2] 高温中暑与寒潮, point 1 | "黄色预警一般是未来24小时内最高气温将升到35℃以上" | 中国气象局 standard (general knowledge; news reports I found, e.g. https://m.gmw.cn/2026-07/07/content_1304523266.htm, use "连续三天日最高气温将在35℃以上" for yellow): yellow = 连续三天日最高气温将在35℃以上; orange = 24h 内最高气温将升至37℃以上; red = 24h 内将升至40℃以上. | "高温黄色预警：连续三天日最高气温将在35℃以上；橙色：24小时内最高气温将升至37℃以上；红色：24小时内将升至40℃以上" (standard text itself not opened: check on cma.gov.cn). |
| E4 | notes.json safety [0.13] 个人卫生与七步洗手法, point 3 | "每一步至少搓15秒，全程不少于20秒" | Self-contradictory (7 steps x 15 s = 105 s vs total 20 s). Official: each step 揉搓至少 5 次 (about 3 s), whole wash at least 20 s (WHO 40-60 s). | "每一步至少揉搓5次，全程不少于20秒". |
| E5 | notes.json history group 1 [1.7] 西汉, point 1 | "前206年秦亡" | Contradicts the same file: [1.6] "前207年子婴降刘邦，秦朝灭亡" and dynasties table 秦 -221..-207. Standard: 秦 前221-前207; 前206 = 项羽分封, 楚汉战争 begins. | "前207年秦亡，前206年起楚汉之争，项羽兵败垓下". |

### doubtful
| # | Location | Text | Why / correction |
|---|---|---|---|
| D1 | formulas idx 94-96 (idx 96 根与系数的关系, g=9) | Vieta | In 人教 九上 it is 阅读与思考 (reading), 课标 2011/2022 does not require it (I believe, unverified; the search did not return the 课标 text). 中考 differs by province. Mark "拓展". |
| D2 | formulas idx 78 十字相乘法 (g=8) | | 课标 requires 提公因式法, 公式法 only (general knowledge). Mark "拓展" (not required; commonly taught). |
| D3 | formulas idx 86 两点间的距离, idx 87 线段的中点, idx 88 直线的斜率 (g=8) | | Distance / midpoint / slope formulas belong to 高中 解析几何; 初中 derives distance via 勾股. Mark 拓展. |
| D4 | formulas idx 63-65 同底数幂相乘 / 幂的乘方 / 积的乘方 (g=7) vs idx 70-72 (g=8) | | 人教: all of 整式的乘法 in 八上 (14章); 北师大 puts 幂 in 七下. Same chapter has g7 and g8 here: inconsistent. Set all to 8 (人教) or document the edition. |
| D5 | formulas idx 26 四边形的内角和, idx 27 n边形内角和, idx 28 外角和 (g=7) | | 人教 八上 11.3 多边形及其内角和; 北师大 七下/八下. Probably g=8 for 人教. (小学 4下 also touches 四边形 360°.) |
| D6 | formulas idx 99 sin²A+cos²A=1 (g=9) | | Not an explicit 课标 requirement (人教九下 uses it as exercise / derivation). Low priority. |
| D7 | formulas idx 129 水的比热容, idx 139 家庭电路电压 | TeX in strict mode: `℃` in `\text` unrecognised, Chinese in `V_{排}` `F_{浮}` `W_{有}` `Q_{放}` (idx 117, 118, 127), fullwidth `（）` in math (idx 29, 55, 56, 139) | KaTeX strict mode errors (non-strict mode renders; ℃ may fall back to a glyph without math metrics). Wrap in `\text{}` and use `^{\circ}\text{C}`. Style/robustness. |
| D8 | periodic.json Cl `mass 35.45` | | 课标 / 中考 and the app's own chemistry trainer use Cl = 35.5 (rule 56). The periodic page and trainer disagree. Option: show 35.5 for junior elements, or show both. |
| D9 | periodic.json `junior` flags (30 elements) | H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Mn Fe Cu Zn Ag Sn Ba Au Hg Pb | Plausible (first 20 + metals). Missing Pt (in the activity series of 人教九下) and I (碘, 人体必需元素), Ni/Ti arguably. Content choice, not wrong. |
| D10 | periodic.json Hs mass 277, Mc 290 | | Reference JSON: 269 / 289 (older). Wikipedia/IUPAC 2021 convention gives [277], [290] for the longest-lived known isotope: acceptable; for superheavy elements give mass number in brackets. |
| D11 | notes history events -5000 "河姆渡与半坡居民 约7000年前" | | 河姆渡 约7000年前; 半坡 约6000年前 (统编 七上, general knowledge). Split or "约6000-7000年前". |
| D12 | history events 1895 《马关条约》, "割台湾、澎湖" (event and [3.3] 必背) | | Textbook list includes 割辽东半岛 (later 三国干涉还辽). [3.3] bullet has it, the 必背 and event omit it. Add "辽东半岛（后赎回）". |
| D13 | history events 1927 "南昌起义与秋收起义 | 打响武装反抗国民党反动派第一枪" | | The "第一枪" is 南昌起义 (8月1日) only. Split into two events. |
| D14 | history [1.3] 春秋五霸 "齐桓公、宋襄公、晋文公、秦穆公、楚庄王" | | One common list; 统编七上 names 齐桓公, 晋文公, 楚庄王 and 吴越争霸 (阖闾/夫差/勾践), (my recollection, unverified). Mark "一说". |
| D15 | history [1.8] 东汉: "司马迁著《史记》" | | 司马迁 is 西汉 (汉武帝时), listed in the 东汉 section: move to [1.7]. |
| D16 | history [5.6] 工业革命: "1861-1865年美国南北战争；1868年日本明治维新" | | In 统编 these are 九下 ("殖民地人民的反抗与资本主义制度的扩展"), not 九上. Grade placement. |
| D17 | history [4.3], geo [5.5]: "2020年脱贫攻坚取得全面胜利" | | Official declaration of "全面胜利" was 2021-02-25 (2020 = 目标任务完成). Write "2020年底完成脱贫攻坚目标任务，2021年宣告全面胜利". |
| D18 | history [7.4] 时政 (2025 80周年, 2026 90周年 ...) | Arithmetic correct (1945+80, 1936+90, 1911+115, 1927+100) | Goes stale each year; must be reviewed yearly. |
| D19 | bio [0.2] 植物 | "不开花的植物有藻类、苔藓、蕨类、松柏" and tip "不开花靠孢子" | 松柏 (裸子植物) reproduce by seeds, not spores: tip contradicts the list. Reword "藻类、苔藓、蕨类靠孢子；松柏不开花但结种子". |
| D20 | bio [0.6] "小学生每天睡够9到10小时" vs safety [1.12] "小学生约10小时，初中约9小时" | | 教育部 sleep management notice (2021): 小学 10 h, 初中 9 h, 高中 8 h (general knowledge). Make bio say 10 h. |
| D21 | bio [4.7] "人工呼吸：口对口，每分钟15到20次" vs safety [2.2] CPR 30:2 at 100-120/min | | 15-20/min is the 人教 7下 / textbook figure for rescue breathing (current guidelines: 1 breath every 5-6 s = 10-12/min). Not wrong for the exam, but state both are different procedures; 中考 follows textbook. |

### style / minor
- S1 safety [0.4] 必背 omits 提 of the 提拔握压 口诀 (3 of 4).
- S2 safety [2.0] "这些电话都是免费的": true for 110/119/120/122; 12345 / 12355 may be charged at local rate depending on region (general knowledge, unverified). Reword "110、119、120、122 免费".
- S3 safety [2.2] 按压位置 "两乳头连线中点": textbook wording; current guidelines say 胸骨下半部. Keep (exam) or add 胸骨下半部.
- S4 safety [0.2] "不满12周岁不骑自行车上路" and 16 for e-bike: correct per 道路交通安全法实施条例 art. 72 (general knowledge). The helmet line hedges "许多地方规定". OK; note the new e-bike national standard (GB 17761-2024, in force 2025-09-01) is not mentioned.
- S5 politics [3.5] 刑罚 附加刑 omits 驱逐出境 (applies to foreigners only): fine.
- S6 geo [1.4] 等高线: "平原低于200米" is a rule of thumb; 鞍部 appears only in [5.1].
- S7 formulas idx 54 利息 (g=6) and idx 68 利润率 (g=7): level placement plausible, fine.
- S8 bio [4.5] 化石 "直接证据": textbook wording OK.

## Coverage gaps (课标 / 中考 topics missing from the app's area)
Formulas (数学): 菱形面积 = 对角线积的一半, 垂径定理, 直线与圆的位置关系 (d vs r), 正多边形, 二元一次方程组 (代入 / 加减), 分式方程, 一元一次不等式组, 中位数 / 众数 / 加权平均数, 相似三角形判定, 平行线分线段成比例, 黄金分割, 坡度 / 仰角俯角, 二次函数与 x 轴交点, 反比例函数 k 的几何意义, 增长率 a(1+x)^n, 圆内接四边形, 圆锥全面积, 点的对称坐标.
Formulas (物理): u=2f, u=f 的凸透镜成像, v-u 关系, 速度单位换算 1 m/s=3.6 km/h, 二力平衡 F1=F2, 固体柱体压强 p=ρgh, 滑轮组 s=nh 与 η=G/(nF), 斜面机械效率, 动能势能 (qualitative), 电阻定义 R=U/I, 并联分流, 电热器 η=cmΔt/W, 电能表, 热值 q=Q/V (gas).
Formulas (化学): 化合物中元素质量分数 = (Ar x n)/Mr x 100% (core 中考), 溶液稀释 m1w1=m2w2, 方程式计算步骤, 金属与稀酸 (Zn/Mg/Al + HCl), 氧化铁 + 酸 (除锈), CuSO4 + NaOH, Na2CO3 + Ca(OH)2, BaCl2 + Na2SO4, 铁生锈; the app has 36 equations versus 157 in the chemistry trainer.
Notes: history events (都江堰, 百家争鸣, 活字印刷, 太平天国 1851, 辛丑条约 1901, 北伐 1926, 抗美援朝 1950, 三大改造 1956, 1971 / 1972 外交, 1980 特区, 2008 奥运) exist in sections but not in the `events` timeline; geo: 洋流 / 海洋, 日界线 / 地方时, 世界地形主要山脉河流, 北美洲 / 南美洲 overview; bio: 发酵与现代生物技术 (克隆, 转基因, 酸奶), 食品安全, 血压 / 脉搏, 人体 "测反应速度" style experiments; politics: 九上 四单元 "和谐与梦想" (中华一家亲 民族团结, 中国梦 as own section), 亲情 / 家庭 (七上 亲情之爱), 民法典 & 人格权 (隐私权), 刑事责任年龄; safety: 防暴恐, 校车, 烟花爆竹, 防沉迷规定 (国家新闻出版署 2021 time limits), 泥石流 separately.

## Verified OK
- Periodic table: all 118 symbols, English names, atomic numbers, Chinese names (incl. 104-118: 𬬻 𬭊 𬭳 𬭛 𬭶 鿏 𫟼 𬬭 鿔 鿭 𫓧 镆 𫟷 鿬 鿫), masses within 0.05 % of reference except superheavy convention, grid positions identical apart from the f-block row convention (rows 8/9 instead of 9/10: a layout choice), categories sensible.
- Formulas: all 183 worked examples recomputed correct (areas, volumes, π approximations, Ohm / power / Joule examples, heat, mixture temperature, quadratic examples, trig values, 方差 8/3 etc.); no duplicate names; all `fig` ids valid names; TeX parses (except strict-mode points in D7); chemistry equations 3-5 and coefficients balanced by hand (36/36); 金属活动性顺序 and valences correct.
- History: all 29 dynasty ranges / capitals / founders, 85 events' years (apart from D11-D13), the group sections 0-7 dates (1840, 1842 terms, 1860 Beijing treaty, 1901 indemnity 4.5亿, 1935 遵义, 1936 会宁, 1937, 1945, 1949, 1978, 1997/1999, 1971/1972/1979), world history dates (1492, 1640/1689, 1776, 1789, 1914-18, 1917, 1929/1933, 1939-45, 1947, 1989/91).
- Geo: figures (960万, 8848.86 m, 长江 6300 / 黄河 5464, 14 邻国, 34 省级, 56 民族 / 汉族 91 %, 人口 14.1 亿, 国家公园 5, 双碳 2030 / 2060, 世界 80 亿, 欧盟 27, etc.).
- Bio: all textbook-level statements (细胞, 光合 / 呼吸, 消化, 循环, 神经, 遗传 1:2:1 / 3:1, 免疫三道防线, 变态发育, 显微镜) consistent with 人教 / 北师大 content as I know it.
- Politics: 宪法 amendment procedure (1/5 proposal, 2/3 vote), 宪法日 12.4, 国家安全教育日 4.15, 未成年人保护 六大保护 (2020), 刑罚 主刑 / 附加刑, 国体 / 政体, 核心价值观 24字, 新发展理念, 主要矛盾 wording.
- Safety: hotline numbers (110 119 120 122 12355 12345 12315 96110), 防溺水六不, 七步洗手口诀, CPR 30:2 and 100-120/min and 5-6 cm, 烫伤 冲脱泡盖送, 垃圾分类 colours, bite flushing 15 min, sleep hours, 20-20-20, age 12 / 16 rules.

## Could not verify
- Primary documents: 2022 课标 texts, 中考 说明, 统编 / 人教 textbook tables (not opened; statements on 课标 requirement level D1-D3, D5, E1, E2, D14, D16 are from memory and must be checked by a teacher).
- Official 气象局 warning standard text (E3 consistent with general knowledge and news examples, original not opened).
- Hs / Mc isotope convention (IUPAC provisional).
- Free-form statements in notes (tips, "必背" wording) were not checked against any textbook; only facts / numbers / dates were.
