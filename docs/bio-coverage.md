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

## NOT covered (honest list)

- 人的生殖器官的结构和图示、避孕与性教育（需要教师与家长按年龄决定，本实验室不包含）; 动物生殖的其他类型（无性生殖、克隆、植物的无性繁殖：嫁接、扦插）.
- 心脏疾病、血压的测量、血型以外的凝血机制; 尿的形成中的肾小管分泌、人工肾; 皮肤的结构细节（汗腺、毛囊）.
- 细菌与真菌的结构图、病毒的结构（只在分类游戏中出现）; 食品的保存与发酵食品的制作步骤.
- 变异的类型（可遗传 / 不可遗传）、DNA 双螺旋、转基因、Hardy-Weinberg; 生物进化的其他证据（比较解剖、胚胎学、分子证据）、地球上生命的起源.
- 实验操作技能（制作临时装片、解剖）、真实标本与照片; 毒品、吸烟的危害的模拟（有意不做）.

## What a teacher must proofread


All lessons, task and quiz wording, the numeric constants of the models (they are simplified teaching models, not data: the enzyme optimum 37 °C / pH 6.8, photosynthesis half-saturation 8 klx, the blood-sugar model, the SIR parameters, the moth survival rates, the latency of reflexes, the eye accommodation 10 D), the 42 organisms and the features used by the key, the drug-dose and CPR numbers, the geological ages, the nutrient table, the heart-rate zones and sleep ranges, the classification groups, the French and English translations (model-written).
