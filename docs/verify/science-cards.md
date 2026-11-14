# Verification: src/data/science-cards.json (3,493 cards)

Report only. No source file was edited. Reviewer: Claude (model). Date 2026-11-14.

## Method and honest limits
- File has 3,493 cards (339 hand-written `g*`, 3,154 generated `x-*`), not about 2,900.
- Programmatic checks: duplicate ids, duplicate questions, duplicate/answer-in-wrong choices, g>gx, empty explanation, near-duplicate questions, answer-type vs distractor-type mismatch, cross-check of the 118 element cards (symbol/name/number/mass/category) against `src/data/periodic.json`, capital/continent consistency.
- Manual review: every hand-written card and every generated family was read (about 3,000 of 3,493 cards read in full; the template families element/capital/province/solar-term/zodiac/dynasty-order were checked as a family and by pattern). Not every one of ~1,080 country-capital-continent-reverse and ~400 element-template cards was fact-checked one by one; the capital and continent lists were read in full.
- Sources: **no official document could be opened.** WebSearch returned no 课标 text; WebFetch of a 课标 PDF failed (host statics.scnu.edu.cn is outside the session's allowed network domains). All factual verdicts are "from general knowledge, unverified against a cited source". An independent element library (`mendeleev`) could not be installed (permission denied), so element data was checked against my own knowledge plus internal consistency. **Grade-range findings (which 学段 / which 初中 grade) are therefore from memory of 2022 课标 / 人教版 / 统编版 structure, not verified against the PDF.**
- Scripts were in the scratchpad (`/tmp/sc`); not committed.

## Programmatic results
| Check | Result |
|---|---|
| duplicate ids | 0 |
| duplicate question text | 0 |
| answer among wrong / duplicate choices | 0 |
| g > gx | 0 |
| missing explanation | 0 |
| element cards (es/en/ez/ec/ef) vs periodic.json | all consistent; symbols, names, masses correct to my knowledge |
| near-duplicate concepts (same question, hand vs generated) | about 20 pairs (list below) |
| answer-type vs distractor-type mismatch | 8 cards (clear data defects, below) |

## Findings, errors (factually wrong or a "wrong" choice that is also right, or garbled choices)

Severity: ERROR = wrong answer, or a distractor that is also correct (question unanswerable), or garbled distractors. DOUBTFUL = defensible but misleading. STYLE.

### A. Garbled / mismatched distractors (clear defects; proposed fix: replace by same-type choices)
| id | problem | fix |
|---|---|---|
| x-fn-036 | "磁铁能吸住下面哪个东西？ 铁钉" wrong choices 一个/三个/没有 (column shift) | 塑料尺/橡皮/木筷 (as g2-03) |
| x-f1-013 | "哪个地方有大熊猫？ 四川" wrong 两个/三个/五个; also 陕西/甘肃 also have pandas | 福建/海南/吉林 |
| x-fn-031 | "刷牙几次？ 两次" wrong 玩耍/喝水/睡觉 | 一次/三次/五次 |
| x-hp-003 | yes/no question, wrong choices are units 安培/伏特/瓦特 | 可以/只能接小电流/只要是新电流表就可以 |
| x-hp-094 | 验电器原理, wrong choices are units | 异种电荷吸引/电磁感应/热胀冷缩 |
| x-hp-107 | 压强公式, wrong choices are units | $p=FS$ / $p=S/F$ / $p=F+S$ |
| x-hp-122 | 密度公式, wrong choices are numbers with units | $\rho=V/m$ / $\rho=mV$ / $\rho=m-V$ |
| x-ff-005, x-ff-032, x-ff-033 | landform question with river/lake/island distractors (type mismatch, answer obvious) | same-type distractors |

### B. A wrong choice is also correct (question ambiguous)
Animal facts (`x-an`):
- x-an-056 企鹅: wrong "脚上有蹼，会游泳" is true of penguins.
- x-an-059 鹈鹕: same wrong choice, pelicans have webbed feet.
- x-an-070 大鲵: same wrong choice, true.
- x-an-057 丹顶鹤: wrong "迁徙时排成人字或一字形" is true of cranes.
- x-an-037 金丝猴: wrong "聪明灵活，喜欢爬树" is true.
- x-an-069 青蛙: wrong "是捕捉蚊子的好手" is true.
- x-an-062 乌龟: wrong "冬天会冬眠" is true of turtles/tortoises.

Animal habitat (`x-ah`) and food (`x-af`) families, where the choice categories overlap:
- Habitat: ah-009 猴子 (森林 vs wrong 热带雨林), ah-010 大猩猩 (热带雨林 vs wrong 森林), ah-024 海豹 (wrong 极地), ah-032 羊 (wrong 草原, while 马 is 草原), ah-046 老鹰 (right answer 高山, wrong 天空与树林; inconsistent with 麻雀/燕子), ah-053 孔雀 (森林 vs 天空与树林), ah-061 蜂鸟 (森林 vs wrong 热带雨林), ah-063 蛇 (wrong 沙漠), ah-065 蜥蜴 (right 沙漠 dubious; wrong 家里 while 壁虎 is a lizard), ah-078 蝴蝶 (wrong 森林), ah-083 蝉 (wrong 天空与树林), ah-087 蜘蛛 (right 家里, wrong 草原), ah-088 蜗牛, ah-029 狗 (家里 vs 农场（家养）), ah-020 刺猬, ah-039 穿山甲.
- Food: af-002 老虎 (right 肉; wrong 肉和骨头), af-008 犀牛 (wrong 叶子/水草), af-009 猴子, af-013 北极熊 (wrong 鱼), af-014 棕熊 (wrong 果实), af-017 兔子 (wrong 草叶 = synonym of 草), af-018 松鼠 (wrong 树叶和果实), af-027 蝙蝠 (wrong 蚜虫 is an insect), af-032 羊 (wrong 草叶), af-036 雪豹 (wrong 肉和骨头), af-038 藏羚羊 (wrong 植物), af-039 穿山甲 (wrong 种子和昆虫 includes ants), af-041 麻雀 (wrong 粮食), af-044 啄木鸟, af-049 鸭子 (wrong 昆虫), af-050 鹅 (wrong 粮食), af-055 鸵鸟 (wrong 草和种子), af-056 企鹅 (wrong 小鱼虾), af-057 丹顶鹤 (wrong 鱼和小动物), af-059 鹈鹕 (wrong 小虾), af-060 翠鸟 (right 小鱼, wrong 鱼: contains the answer), af-062 乌龟, af-069 青蛙 (wrong 蚊虫 is an insect), af-073 鲨鱼 (wrong 肉和鱼), af-088 蜗牛 (wrong 草和树叶).
- Proposed fix for the whole ah/af family: use mutually exclusive choice sets (e.g. habitat: only one of 森林/热带雨林/草原/沙漠/海洋/淡水/极地 per question and no overlap such as 森林 vs 天空与树林; food: choices must be disjoint categories such as 草 / 肉 / 昆虫 / 鱼 / 果实 / 花蜜) and drop species whose habitat/diet is not unique.

Plant classification (`x-pt`, `x-pw`): mixes life form and use, so choices overlap:
- pt-011 牡丹 (wrong 药用植物; 牡丹皮 is a medicine), pt-014 向日葵 (wrong 经济作物; oil crop), pt-019 大豆 (wrong 经济作物), pt-008 梅花 (wrong 药用), pt-028/029/030 葡萄/桃子/橘子 (wrong 经济作物 / 药用), pt-021 黄瓜 (wrong 水果), pt-027 西瓜 (wrong 蔬菜), pt-040 紫菜 (wrong 水生植物), pt-042 枸杞 (wrong 经济作物), pt-007 竹子 (wrong 草本植物), pt-037 蕨 (wrong 草本植物), pt-020 土豆 (also 粮食 in China). Proposed fix: ask only within one dimension (e.g. fruit/vegetable/grain/flower), remove cross-dimension distractors.
- pw-001..015 explanations are tautologies ("松树是树木。").

Plant facts (`x-pn`): pn-007 竹子 has wrong "象征高洁的品格" (true of bamboo); pn-028 西瓜 has wrong "含水量很高，吃起来清脆" (true of watermelon).

Other:
- x-bw-010 小脑: wrong "耳朵", but x-bf-012 says 耳朵 "听声音、保持平衡" (internal contradiction).
- x-pq-041 "谁是著名的数学家？ 华罗庚": wrong "阿基米德" is also a famous mathematician.
- x-an2-012 "作为反应容器 → 锥形瓶": wrong "试管" is also a reaction vessel (x-au-001 says so).
- x-an2-018 "放大观察小物体 → 放大镜": wrong "显微镜"; x-au-017 (显微镜): wrong "放大观察小物体" is what a microscope does.
- x-kd-009 《梦溪笔谈》北宋: wrong "宋代" is also correct.
- x-cf-025 挪威 峡湾: wrong 智利 also famous for fjords.
- x-ef-033 干电池含有 锰: wrong 氧 (MnO2) and 钾 (alkaline cell KOH) also present.
- g9-22 / x-hc: 实验室制 CO2 "大理石和稀盐酸": wrong "碳酸钠和稀硫酸" does produce CO2 (only not used in labs); rephrase "最适合".
- x-ec-048 镉 属于 过渡金属 with wrong "后过渡金属": group 12 (Zn Cd Hg) is classified either way. Also ec-084 钋 (后过渡金属; often 类金属).
- x-uu-015 "温度的国际单位 摄氏度": the SI base unit is kelvin; Chinese textbooks say "单位：摄氏度". Reword to "常用单位".
- x-cf-006 泰国 "千象之国": Thailand is "白象之国" (老挝 = 万象/百万大象之国). Unverified nickname; likely wrong. Replace with 白象之国.
- x-ec-079 "金属于哪一类元素？": the string reads as "金属 于…" (parse ambiguity). Reword "金（Au）属于…".

## Findings, doubtful
- **Out of 课标 scope (high-school content placed at grade 9)**: x-hp-049 (right-hand rule for straight wire), x-hp-050..055 (左手定则 / 右手定则 for motor and generator), x-hb-017 (双受精), x-f9-018 (等位基因), x-f9-025 (色盲 X-linked). 初中 only needs the 安培定则 for a solenoid and the qualitative facts.
- **Grade placement too early (chemistry starts in 九年级)**: x-sf-* / x-sn-* (58 cards, formulas at grades 7-9, 8-9); x-hc-072..078 formulas at 6-9 / 7-9; x-hc-* at 5-9. Physics before 八年级: g7-* (速度, 凸透镜, 密度, 升华, 凝华...) are 人教 八上 content, set as grade 7. g8-21..26 (电荷 电流 电压 电阻 串并联) are 九年级 content set as 8. g3-12 光合作用 placed at 3.
- **Grade placement for biology**: all 87 cards `x-f9-*` are 9-9, yet most are 人教版 七年级 / 八年级 content (细胞分裂, 光合 and 呼吸 equations, 肾单位, 眼, 遗传, 传染病). A grade-7/8 child never gets them. In the 七/八/九 mapping, biology is mostly 七-八.
- **Element cards for all 118 elements at grades 8-9** (es/en 118, ez 36, ec 118): 课标 expects about 20 common elements and symbols. 104-118 use rare glyphs (𬬻 etc., needs font). ec asks 镧系/锕系/后过渡金属 classes, which are outside 初中.
- x-dc-004 宋朝 都城 开封 (only 北宋; 南宋 临安); x-dc-006 明朝 都城 南京 (capital from 1421 was 北京; wrong list has no 北京).
- x-pl-002 "长城在哪里？ 北京" (spans many provinces).
- x-fn-056 红黄蓝 are the 颜料三原色 vs x-hp-146 品红、黄、青 (inconsistent; the physics textbook says 品红黄青).
- x-fn-073 蚂蚁搬家 预示要下雨 (folk belief, taught as fact).
- x-f1-023 春节 在冬天 (春节 is 立春 neighbour; arguable).
- x-ff-013 北美洲最长河 密西西比河 (Missouri is longer; the Chinese textbook says 密西西比).
- x-oa/ot/ob-029 《春日》 朱熹 (attribution disputed); oa-019 《清明》 杜牧 (disputed, textbook standard).
- x-an-073 鲨鱼 "需要不停地游动才能呼吸" (true for some species only); x-an-067 壁虎 "吸盘" (adhesive toe pads).
- x-hp-137 噪声单位 分贝 (sound level unit).
- x-cap list: 俄罗斯/土耳其/埃及 continent notes fine; x-cap-024 阿斯塔纳 correct (renamed 2022).
- hp-018/019 and similar: fine.

## Style
- Self-referencing distractors (the question's own subject appears among the wrong answers): x-do-011, 015 (and the other `do`/`dp`), x-dp-002/004/011/016, x-tn-022, x-zo-001..012 (e.g. 排在鼠后面... wrong "鼠").
- Explanations that drop the verb: x-ef-011, 012, 013, 014, 021, 025, 027, 033 ("磷火柴盒侧面的涂层里含有它。"); x-ev-* have a stray space ("发生在 公元前 221 年") and only repeat the question; x-pw-* tautological.
- Odd distractors: fn-039 "消失了就没有糖", fn-045 (铃声) not science.
- Near-duplicate hand vs generated pairs (same question and answer): g9-44/hb-005, g9-37/hc-018, g8-27/hb-006, g7-34/f1-047, g7-29/hb-023, g7-19/hb-001, g6-35/hb-038, g6-34/hc-069, g6-21/g8-34, g6-18/hp-130, g8-40/hp-045, g9-26/hc-028, g5-06/hp-168, g1-09/fn-019, g7-09/hp-176, g6-26/pq-042, g2-22/f1-010, ga-015/fn-051, ga-009/fn-050, g5-31/hp-180, g8-15/hp-004, g8-18/hp-157. Not harmful (different grade ranges) but the game may ask both.

## Error rates (my reading; "problem" = ERROR or ambiguity per section B/A, excluding DOUBTFUL / STYLE)
| family / topic | cards | problems | rate |
|---|---|---|---|
| animal habitat (ah) | 93 | about 18 | 19 % |
| animal food (af) | 93 | about 28 | 30 % |
| animal facts (an) | 93 | 7 | 8 % |
| plant classification (pt/pw) | 61 | about 14 | 23 % |
| plant facts (pn) | 47 | 2 | 4 % |
| animal class (ac/aw) | 99 | 0 | 0 % |
| body (bf/bw/bn) | 72 | 1 | 1 % |
| hand-written g1-g9 | 339 | 1 doubtful distractor (g9-22), grade issues listed | under 1 % factual |
| phys (hp) | 186 | 4 garbled, 6 scope | 2 % errors, 3 % scope |
| chem (hc, sf, sn) | 168 | 0 factual; grade placement | 0 % |
| bio (hb, f9) | 171 | 0 factual; grade/scope | 0 % |
| earth/nature (hd, fn, f1) | 208 | 4 | 2 % |
| elements (es/en/ez/ec/ef) | 425 | 4 (ec-048, ef-033, ec-079, ec-084) | 1 % |
| countries (cap/rev/con/cf) | 356 | 3 (cf-006, cf-025, cf-024 doubtful) | 1 % |
| China (pa/pb/pg/pc/pr/pl) | 197 | 1-2 (pl-002 doubtful) | 1 % |
| terrain (fc/ff) | 79 | 3 style | 0 % factual |
| units/apparatus (uu/uq/us/au/an2) | 99 | 4 | 4 % |
| people / dynasty / events | 248 | 1 (pq-041) + 3 doubtful | 1 % |
| culture (节日 节气 生肖) | 174 | 0 factual | 0 % |
| poems (ka/kd/kc/oa/ot/ob/od) | 226 | 1 (kd-009) + 2 attribution | 0.5 % |
| story (sp/sg) | 58 | 0 | 0 % |
| garbage (ga) | 25 | 0 | 0 % |
| space (bo/bt) | 20 | 0 | 0 % |

Conclusion: facts of the numeric / date / formula / name type (dates, formulas, capitals, poets, periodic table, unit names, hand-written cards) are accurate. The weak parts are the generated "which of these is the habitat / food / classification" families, where choices overlap and the stated "one right answer" is not unique, plus mislabelled grade ranges for chemistry / biology and a few high-school items.

## Coverage gaps (compared with 课标 / 中考, from memory)
- 初中 化学 core: 常见酸碱盐溶解性, 金属活动性顺序 beyond 3 metals, 化学方程式 书写 and 计算, 溶液 溶质质量分数, 化合价 and 化学式 书写 (only 29 substances), 原子结构 / 离子. Cards cover definitions, not computations.
- 初中 物理: 凸透镜成像 other cases (only u>2f), 浮力/压强 calculations, 光的反射 作图 (not card-like), 电功/电功率 calculations (few), 能源 only 2 cards.
- 初中 生物: 光合作用/呼吸 experiments partly; 生殖与发育 of insects/amphibians/birds, 动物的先天/学习行为, 免疫 ok; 植物的无性生殖 only one.
- 初中 地理 (七/八年级): 经纬网, 比例尺, 等高线, 气候类型 (only 地中海), 中国的河流/气候/人口/民族 data, 四大地理区域 (北方/南方/西北/青藏; the cards use the 七大区), 世界 国家 (南非, 新加坡 capital, 斯里兰卡, 以色列, 坦桑尼亚, 玻利维亚 are missing; Africa has no 南非).
- 初中 历史: only 朝代 order and 26 dates; no 中国近现代史 events beyond dates, no 世界史 (古希腊 罗马, 文艺复兴, 工业革命 only one).
- 小学科学 学段内容 (e.g. 地球内部, 种子 / 植物的一生 detail, 力与运动, 技术与工程 (only 26 cards "tech")): thin.
- 道德与法治 / 信息科技 not in this file (not requested).

## Verified OK (from general knowledge)
- All 118 element symbols, names, atomic numbers and the masses in the explanations (including Rf-Og glyphs).
- All 34 provincial 简称, 省会, the 七大区 assignments (国家统计局), the 104 country capitals and 104 continents, flags of fact in cf except those above.
- 24 solar-term dates, seasons, order; 12 zodiac; festival dates; dynasty order; 10 book authors / eras; 51 poem line to poet/title pairs (textbook attribution).
- Physics/chemistry/biology hand-written formulas and values (G=mg, p=F/S, p=ρgh, Q=cmΔt, I=U/R, P=UI, Q=I²Rt, c water 4.2×10³, ρ water, 3.6×10^6 J, 空气成分, 水电解 2:1, 活动性顺序, 染色体 23 对, 血液循环 起点).
- Units and SI symbols (except uu-015), garbage classification (national four-class), 12 science biographies, event dates ev-001..026.

## Could not verify
- Any statement against the real 课标 PDFs, 人教版 / 统编版 tables of contents, or 中考 outlines (network blocked; WebSearch gave nothing usable).
- Exact grade ranges g..gx for all 3,493 cards (judged from memory only).
- Counts and records quoted as "最大/最长/第二" (Missouri vs Mississippi, 新几内亚岛 世界第二大岛, 里海最大湖泊) beyond common textbook usage.
- Nicknames (cf-006 千象之国) and folk claims (fn-073).
- Poem attribution disputes (oa/ot/ob-019, 029).
