# Biology lab (生物实验室) — coverage of the junior-high biology course

Page `#/science/bio` (under 科学). Scope guide: 人教版 七年级上 / 下 and 八年级上 / 下, 2022 课程标准 (生物学). The texts and numbers are written from memory (no textbook text is copied) and must be proofread by a teacher.
A simulation = `src/bio/<id>.ts` (screen) + `src/bio/model-<id>.ts` (pure model, tested alone), built on the physics lab's kit (`src/phys/kit.ts`). Each has a lesson, 2-4 checked tasks (实验任务) and a 5-question quiz made from the model.

| Chapter (人教版) | Topic | Simulation | Status |
|---|---|---|---|
| 七上 认识生物 / 生物与环境 | 生态系统的组成、食物链与食物网、能量流动（10 %）、物质循环、有毒物质积累、生态平衡 | `foodweb` | built (energy and poison; matter cycles only in the lesson) |
| 七上 生物与环境 | 种群数量的变化、捕食者与猎物、环境容纳量、S 形增长 | `population` | built |
| 七上 细胞 | 显微镜的使用（放大倍数、视野、物像倒立、对光与调焦） | `microscope` | built |
| 七上 细胞 | 植物细胞与动物细胞的结构和功能 | `cells` | built (drag labels) |
| 七上 细胞 | 细胞分裂（染色体、染色单体、DNA 的变化） | `division` | built (mitosis; meiosis only as a quiz fact) |
| 七上 生物体 | 细胞 → 组织 → 器官 → 系统 → 个体 | `levels` | built (drag) |
| 七上 绿色植物 | 种子萌发的条件（对照实验） | `seed` | built |
| 七上 绿色植物 | 光合作用（光、CO₂、温度、碘液检验淀粉） | `photo` | built |
| 七上 绿色植物 | 呼吸作用（昼夜气体交换、石灰水） | `respiration` | built |
| 七上 绿色植物 | 蒸腾作用（气孔、湿度、风、光） | `transpiration` | built |
| 七上 绿色植物 | 花的结构、传粉、受精、果实和种子的形成 | `flower` | built |
| 七上 绿色植物 | 植物的类群（藻类、苔藓、蕨类、种子植物） | `classify` (sorting game) | built (classification only; no life-cycle drawings) |
| 七下 人体的营养 | 消化系统、消化酶（唾液淀粉酶实验）、营养物质的消化 | `digest` | built |
| 七下 人体的呼吸 | 呼吸运动、肺与外界的气体交换（Boyle） | `breathing` | built (gas exchange in the alveoli: only a quiz fact) |
| 七下 物质的运输 | 心脏、瓣膜、体循环与肺循环、ABO 血型与输血 | `blood` | built |
| 七下 生命活动的调节 | 反射弧、条件反射与非条件反射、反应时间 | `nerve` | built |
| 七下 生命活动的调节 | 激素、胰岛素与血糖、糖尿病 | `hormone` | built |
| 七下 感觉器官 | 眼与视觉、近视及矫正 | `eye` | built |
| 八上 动物的运动和行为 | 运动系统、骨 – 关节 – 肌肉的杠杆作用 | `motion` | built |
| 八上 细菌、真菌和病毒 | 酵母菌发酵、细菌的生长曲线 | `ferment` | built (structure drawings of bacteria / fungi / viruses only as organisms of the classification lab) |
| 八上 生物的多样性 | 生物的分类（检索表、界门纲目科属种、五个界、脊椎动物五类） | `classify` | built (42 organisms, 42-feature key) |
| 八下 遗传和变异 | 孟德尔一对基因的杂交、遗传图解、ABO 血型遗传、性别决定 | `genetics` | built |
| 八下 生物的进化 | 自然选择（桦尺蛾） | `selection` | built |
| 八下 健康地生活 | 传染病的三个环节、预防措施、免疫、抗体与疫苗 | `epidemic` | built (SIR model) |
| 七下 人的由来 | 受精、胚胎和胎儿的发育（按周）、青春期的生长突增 | `development` | built (formal, non-graphic: sizes, weeks and growth curves only) |
| 八下 生殖和发育 | 昆虫的完全 / 不完全变态、蛙的变态发育、鸟的发育 | `lifecycle` | built |
| 七下 物质的运输 | 血液的成分、三种血管（连续性方程）、出血与止血 | `vessels` | built |
| 七下 废物的排出 | 肾单位、滤过与重吸收、水盐平衡、尿糖 | `excretion` | built |
| 七下 废物的排出 | 皮肤的功能、体温调节（产热与散热） | `skin` | built |
| 七下 感觉器官 | 耳的结构、听觉的形成、听力范围与听力保护 | `ear` | built |
| 八上 动物的运动 | 骨的成分与特性（煅烧 / 盐酸实验）| `bones` | built |
| 八上 动物的行为 | 先天性行为、学习行为、社会行为、学习曲线 | `behaviour` | built |
| 八下 生物的进化 | 化石、地层顺序、放射性测定年龄 | `fossils` | built |
| 七下 人体的营养 | 平衡膳食、能量与营养素、营养缺乏病 | `diet` | built |
| 八下 健康地生活 | 心肺复苏、安全用药（剂量）、烧烫伤的处理 | `firstaid` | built |
| 八下 健康地生活 | 运动强度（心率区间）、睡眠 | `health` | built |
| 八上 第六单元 生物的多样性及其保护 | 栖息地丧失与物种、CO₂ 与气温、保护措施 | `impact` | built |
| 七下 人的由来 | 人的生殖系统：女性 / 男性生殖器官的名称和功能（简图）、事件发生的部位、从受精到分娩的顺序 | `reproduction` | built (textbook content only; schematic, formal, no sexual-behaviour content) |
| 七下 物质的运输 | 血压（收缩压 / 舒张压、kPa 与 mmHg）、袖带测血压的原理、脉搏 | `bloodpressure` | built (teaching model, not a diagnostic tool) |
| 七下 物质的运输 | 探究酒精对水蚤心率的影响 | `daphnia` | built (teaching data, counting error ±1) |
| 七下 人体的营养 | 测定某种食物中的能量（Q = c m ΔT，热量散失） | `energy` | built (rounded teaching energy values) |
| 七上 细胞 | 制作临时装片（洋葱表皮、口腔上皮细胞）、盖盖玻片避免气泡 | `slide` | built (step order tasks; bubble count is a teaching model) |
| 七上 绿色植物 | 观察种子的结构（菜豆、玉米）、碘液检验淀粉、测定种子的发芽率（取样与重复） | `seedlab` | built |
| 七上 生物与环境 | 非生物因素对鼠妇分布的影响（对照实验）、生态系统的类型、生态系统的稳定性 | `ecology` | built (stability formula is a teaching model; bioaccumulation stays in `foodweb`) |
| 八上 动物的主要类群 | 无脊椎动物六大类群与典型动物 / 特征、脊椎动物五类的体表 / 呼吸 / 体温 / 生殖 | `animalgroups` | built |
| 八上 细菌、真菌和病毒 | 菌落计数与稀释、细菌与酵母菌的结构、抗生素与耐药性 | `microbe` | built (resistance model is simplified) |
| 八下 遗传和变异 | 染色体 - DNA - 基因的关系、染色体数目（体细胞 / 生殖细胞 / 受精卵）、性别决定与 1 : 1、碱基配对（拓展） | `dna` | built (base pairing is an extension) |
| 八下 遗传和变异 | 遗传病与近亲结婚的风险、优生措施 | `eugenics` | built (simplified teaching calculation, informational) |
| 八下 遗传和变异 / 生物技术 | 杂交育种（9 : 3 : 3 : 1）、诱变育种、转基因、克隆（多莉羊） | `breeding` | built (textbook-level, informational) |
| 八下 生殖和发育 | 植物的无性繁殖（扦插、嫁接、压条、组织培养）、有性生殖与无性生殖 | `propagation` | built |
| 八下 生物的进化 | 进化的其他证据：比较解剖学、胚胎学、分子证据（拓展）、进化树 | `evidence` | built (cytochrome c differences and divergence times are rounded reference values) |

## NOT covered (honest list)

- 避孕、性教育、月经周期的细节（青春期和人的生殖系统只按教科书的简图和名称，需要教师与家长按年龄决定，本实验室不包含）; 动物生殖的其他类型（出芽生殖、分裂生殖）与动物的克隆只在 `breeding` 中作为简单模型.
- 心脏疾病、血压以外的循环系统疾病、血型以外的凝血机制; 尿的形成中的肾小管分泌、人工肾; 皮肤的结构细节（汗腺、毛囊）.
- 病毒的结构（只在分类游戏中出现）、食品的保存与发酵食品的制作步骤; 细菌和真菌在自然界中的作用（分解者、共生）只在测验中出现.
- 变异的类型（可遗传 / 不可遗传）、Hardy-Weinberg、DNA 的复制与蛋白质合成; 地球上生命的起源（米勒实验）；`evidence` 的分子数据和进化树的年代是取整的参考值.
- 植物的结构：根尖的结构与吸水、茎的导管和筛管（输导）、叶片的结构（横切面）、光合作用的场所（叶绿体）只在课文和测验中提到，没有单独的图; 观察草履虫、观察蚯蚓、鸡卵的结构、解剖实验（需要真实标本）没有做.
- 脊椎动物五类只有表格，没有各类的详细结构图; 昆虫的发育与鸟的繁殖在 `lifecycle`; 动物在自然界中的作用（促进物质循环、帮助植物传粉）没有单独的模拟.
- 实验操作技能中的显微镜使用（`microscope`）、临时装片（`slide`）、种子的结构和发芽率（`seedlab`）、水蚤心率（`daphnia`）、食物能量（`energy`）、鼠妇（`ecology`）已做；探究唾液淀粉酶（`digest`）、探究光合作用（`photo`）已做; 其他必做实验（如观察花的结构的解剖、制作酸奶、探究食物腐败）没有做. 真实标本、照片、毒品和吸烟的危害的模拟（有意不做）.

## What a teacher must proofread


All lessons, task and quiz wording, the numeric constants of the models (they are simplified teaching models, not data: the enzyme optimum 37 °C / pH 6.8, photosynthesis half-saturation 8 klx, the blood-sugar model, the SIR parameters, the moth survival rates, the latency of reflexes, the eye accommodation 10 D), the 42 organisms and the features used by the key, the drug-dose and CPR numbers, the geological ages, the nutrient table, the heart-rate zones and sleep ranges, the classification groups, the French and English translations (model-written); third pass: the teaching constants of the new simulations (peanut / walnut / soybean / rice energy 24 / 28 / 16 / 15 kJ/g, the water-flea heart rates per 10 s 33 / 32 / 28 / 25 / 22 / 15 / 0, the cambium alignment of 70 %, the cytochrome c differences 0 / 1 / 10 / 12 / 13 / 15 / 21 / 44 of 104, the divergence times 7 / 9 / 14 / 28 / 90 million years, the pillbug choice shares, the stability formula, the blood-pressure model constants (resistance 17, compliance 1.75), the antibiotic resistance model, the relationship shares 1/8 and 1/2), the textbook scope of the reproductive-system diagrams (organ names, the epididymis and the seminal vesicle) and every text about genetic disease and close relatives.
