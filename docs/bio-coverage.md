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
| 七下 物质的运输 | 心脏、瓣膜、体循环与肺循环、ABO 血型与输血 | `blood` | built (blood vessels and blood components: NOT built) |
| 七下 生命活动的调节 | 反射弧、条件反射与非条件反射、反应时间 | `nerve` | built |
| 七下 生命活动的调节 | 激素、胰岛素与血糖、糖尿病 | `hormone` | built |
| 七下 感觉器官 | 眼与视觉、近视及矫正 | `eye` | built (the ear: NOT built) |
| 八上 动物的运动和行为 | 运动系统、骨 – 关节 – 肌肉的杠杆作用 | `motion` | built (animal behaviour, learning behaviour: NOT built) |
| 八上 细菌、真菌和病毒 | 酵母菌发酵、细菌的生长曲线 | `ferment` | built (structure drawings of bacteria / fungi / viruses only as organisms of the classification lab) |
| 八上 生物的多样性 | 生物的分类（检索表、界门纲目科属种、五个界、脊椎动物五类） | `classify` | built (42 organisms, 42-feature key) |
| 八下 遗传和变异 | 孟德尔一对基因的杂交、遗传图解、ABO 血型遗传、性别决定 | `genetics` | built |
| 八下 生物的进化 | 自然选择（桦尺蛾） | `selection` | built (fossils and the history of life: NOT built) |
| 八下 健康地生活 | 传染病的三个环节、预防措施、免疫、抗体与疫苗 | `epidemic` | built (SIR model) |

## NOT covered (honest list)

- 生殖和发育 of animals (insects, amphibians, birds) and of humans: not built (age-appropriate content needs a teacher's decision); only the flower and fruit of plants (`flower`) are covered.
- 血管与血液成分、血压、冠心病; 泌尿系统（排泄）、尿的形成; 耳的结构与听觉; 皮肤.
- 动物行为（先天性行为与学习行为）、群体行为; 细菌与真菌的结构图; 病毒的结构（只在分类游戏中出现）.
- 生物的变异的类型（可遗传 / 不可遗传）、DNA 双螺旋、转基因、基因在亲子代间的传递的细节（Hardy-Weinberg 未做）.
- 生物进化的证据（化石、比较解剖）、地球上生命的起源.
- 生物多样性的保护、人类活动对环境的影响; 合理营养与平衡膳食、安全用药、急救（见知识总结中的“安全”）.
- 实验操作技能（制作临时装片、解剖）、真实标本与照片.

## What a teacher must proofread

All lessons, task and quiz wording, the numeric constants of the models (they are simplified teaching models, not data: the enzyme optimum 37 °C / pH 6.8, photosynthesis half-saturation 8 klx, the blood-sugar model, the SIR parameters, the moth survival rates, the latency of reflexes, the eye accommodation 10 D), the 42 organisms and the features used by the key, the classification groups, the French and English translations (model-written).
