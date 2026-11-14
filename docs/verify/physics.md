# Verification report: physics lab (src/phys/*, docs/physics-coverage.md)

Method: every model-*.ts, every lesson, task and quiz generator was read; the 28 quiz generators were run over 300 seeds each (node, scratchpad copy, no repo file touched) to look for duplicate / NaN choices, wrong choice count and constant answers.
Sources: WebSearch returned no usable page for the 2022 物理课标 (no 必做实验 list); WebFetch of physicsteacher.suda.edu.cn failed (host not in the session's allowed network domains: it has to be allowed before a retry). Therefore EVERY curriculum statement below is "from general knowledge, unverified against the 课标 PDF". Physics facts and constants (densities, c, 340 m/s, c-values, q-values, 36 V, 30 mA) were checked by recomputation and general knowledge only.
Result of the programmatic run: no duplicate choices, no NaN, always 4 choices, no exception. Findings are about content, scope and two weak generators.

## Findings (sorted by severity)

| # | Sev | Where | Text / issue | Why | Proposed correction |
|---|---|---|---|---|---|
| 1 | error (quiz logic) | `model-energysrc.ts` quiz, `primary` question: `pi = Math.floor(rng()*9)` | Only SOURCES[0..8] can be asked; all are `primary: true`, so the answer is ALWAYS "一次能源" (confirmed: 300 seeds, one answer). 二次能源 (电能 index 9, 氢能 index 10) is never asked, a child learns "everything is 一次能源". | bug | `pi = Math.floor(rng()*SOURCES.length)` (11), same for `renew` but skip `renew === null` (电能, 氢能) |
| 2 | error (quiz logic) | `model-lever.ts` quiz `tilt` | The three pairs [3,20,2,25], [4,30,5,20], [2,40,3,20] all give torque left > right, answer is ALWAYS "左端下沉" (confirmed). "保持水平平衡" and "右端下沉" are never correct. | bug, teaches a shortcut | add pairs with right larger and equal, e.g. [2,30,3,20] (equal), [2,20,3,25], [1,40,2,30] |
| 3 | doubtful (grade placement) | `model-friction.ts`, `friction.ts` lesson / quiz / label | 动摩擦因数 μ, 静摩擦因数, `f = μN`, `tan α = μ`, `N = mg cos α`, "重力沿斜面的分力 mg sin α", slope tasks. Force decomposition and μ are 高中 (必修1). 人教版 八下 只讲滑动摩擦力与压力、粗糙程度的定性关系; no μ, no resolution of forces. Card is labelled 八下 第七章. | grade placement (from general knowledge, unverified) | Keep, but mark the slope / μ parts as 拓展 (or move to a "拓展" tag); for 初中 questions replace with: 压力变为 2 倍, 滑动摩擦力 ... ; quiz `angle`, `normal`, `fk`, `uniform` use μ |
| 4 | doubtful (grade placement) | `model-newton.ts` `stopDistance`, `stopTime`; quiz `dist`, `time`; values μ in SURFACES | s = v²/(2μg), t = v/(μg) is 高中 kinematics; the 初中 experiment is qualitative (毛巾 棉布 木板). 玻璃 is not in the textbook experiment; μ values 0.5 / 0.25 / 0.1 / 0.04 are invented | scope | mark as 拓展; quiz `dist` / `time` replace by qualitative questions (which surface: 滑得最远) |
| 5 | doubtful (grade placement) | `motion.ts` lesson 3, `model-motion.ts` (a, v0 + at, tape), params "加速度", v-t graph "面积等于路程", 打点计时器 | 加速度, 匀加速公式, v-t 图, 打点计时器 are 高中 (必修1); 八上 第一章 has v = s/t, 匀速 / 变速, 平均速度, s-t 图 | scope | tag as 拓展 or remove quiz `v=v0+at`; keep s-t图 and 平均速度 as core |
| 6 | doubtful (scope) | `model-lens.ts` quiz `v`, `magnif` (1/u+1/v = 1/f) and lesson text "像距 v > 2f" | The thin-lens formula is NOT required in 初中 (brief says so; 课标 asks qualitative laws u vs f). Numeric image distance questions are above grade | scope | Mark `v`, `magnif` as 拓展; core quiz = nature of image / application; the lesson sentences about u, f, 2f are correct |
| 7 | doubtful (scope) | `model-spring.ts`, `spring.ts` | "劲度系数 k", "F = kx", params in N/m, quiz `k` (high school). 初中 only: 伸长量与拉力成正比 (no k). Task "limit 0.3 m" and "g = 9.8" are invented-but-fine | scope | label as 拓展; quiz `k` out |
| 8 | doubtful (scope) | `model-em.ts` `motorForce` F = BIL, `flux`, `emf` = −N dΦ/dt, quiz `force`; `em.ts` lesson: "左手定则", "磁通量", "感应电动势" | B, T, 磁通量, 楞次 / 法拉第 are 高中. 人教版九年级 only says force direction depends on current and field directions (no 左手定则 stated as a rule), 感应电流 produced by cutting field lines, no emf formula. Task `emf`: ">100 mV" | scope | lesson: delete 磁通量 / 感应电动势 sentences or tag 拓展; quiz `force` out; task `emf` replace by "使电流表偏转" |
| 9 | doubtful (scope) | `model-magfield.ts` `wireB`, quiz `Bwire` (μ₀, μT, B = μ₀I/2πd), quiz `dip` (tan I = 2 tan φ), task `dip` | Quantitative field of a wire and the dipole dip formula are 高中 / beyond; 初中: qualitative Oersted, 磁倾角 not required (磁偏角 mentioned) | scope | tag 拓展; remove `Bwire`, `dip` from the default quiz |
| 10 | doubtful (scope) | `model-fluid.ts` Bernoulli numbers (`narrowP`, `dropKPa`, quiz `bern_v`, `dp`), lesson "p + ½ρv² = 常数" | 初中 only: 流速大压强小, qualitative (机翼, 两张纸). Quantitative Bernoulli is 高中 | scope | tag 拓展 |
| 11 | doubtful (scope) | `model-refraction.ts` Snell n₁ sinθ₁ = n₂ sinθ₂, 折射率, 临界角, 全反射, `speedIn` (v = c/n); lesson 2; quiz `snell`, `critical`, `speed`, `tir` | 初中 requires only: 折射光线偏向 / 偏离法线, angle relation qualitatively, 光路可逆. Snell's law and 折射率 are 高中; 全反射 is not in the 八上 core (人教版 has 光纤 as reading) | scope | tag 拓展; keep `toward` as the only core question |
| 12 | doubtful (scope) | `model-dispersion.ts` `minDeviation`, quiz `mindev`; prism Cauchy model | 最小偏向角 is 高中 | scope | remove `mindev` from quiz |
| 13 | doubtful (wording) | `model-dispersion.ts` quiz `primary` explanation: "颜料的三原色才是红、黄、蓝（品红、黄、青）" | Mixes two systems: modern textbooks / printing give 品红 黄 青; 红黄蓝 is the traditional art teaching. Written as if both are the same | accuracy | "颜料的三原色是品红、黄、青（美术中常说红、黄、蓝）" |
| 14 | doubtful (scope + invented) | `model-heating.ts`: `L_FUSION`, `L_VAPOUR`, quiz `melt`, `meltTime`; wax `c` = 2000 / 4000 / 2200 | 熔化热 / 汽化热 and λ are not in 初中 (人教版 has only a remark that melting needs heat); the wax curve with c = 4000 between 40 and 70 °C is an invented softening model (qualitatively right: no plateau) | scope / invented | tag `melt`, `meltTime` 拓展; state "示意" for wax numbers. Constants L = 3.34×10⁵, 2.26×10⁶, c_ice 2100 are correct |
| 15 | doubtful (scope) | `model-energy.ts` + `energy.ts` lesson: `Ek = ½mv²`, `Ep = mgh`, quiz `Ep`, `Ek`, `vfall` | 人教版八下 gives NO formulas for Ek / Ep (only dependence on m, v, h, qualitative); formulas are 高中. P = Fv IS in 人教版. Free-fall speed is 高中 | scope | tag 拓展 |
| 16 | doubtful (g value) | all `model-*.ts` with `g = 9.8`: spring, friction, newton, pressure, fluid, buoyancy, energy; texts "g = 9.8 N/kg"; task text "约 1960 Pa" (`pressure.ts`), "4.9 N" (`spring.ts`) | 人教版 states g = 9.8 N/kg and says "粗略计算时取 10 N/kg"; the 中考 papers (北京 and most provinces) state "g 取 10 N/kg" in the question. The app never uses 10, so answers (1960 Pa, 9.8 N, 10.3 m water column) differ from what a child meets in exams | exam alignment (from general knowledge) | Add a device switch g = 9.8 / 10 N/kg, or at least use g = 10 in the 初中-core quiz questions and print "g 取 10 N/kg"; lever hook weight 0.5 N implies g ≈ 10 already (inconsistent with 9.8) |
| 17 | doubtful (quiz quality) | `model-fluid.ts` quiz `bern`, 3rd wrong choice | "流速大的地方压强小，所以两张纸中间吹气时纸会分开": the first half is true, only the conclusion is false; a child who knows the principle but not the experiment sees a half-correct distractor | clarity | wrong choice: "流速大的地方压强大，所以两张纸中间吹气时纸会分开" |
| 18 | doubtful (physics) | `model-sound.ts` `levelDb`, label "响度级 … dB", task `loud` "响度级不低于 58 dB" | 响度级 unit is the phon; dB is 声压级 / sound level (人教版: 声音强弱等级, 分贝). "amplitude 1 = 60 dB" is arbitrary | wording | rename "声音强弱（分贝）", say "示意值" |
| 19 | doubtful (physics) | `model-eye.ts` `RETINA = 1/0.024` (41.7 D for a 24 mm eye) | A real eye is about 60 D with n = 1.336 inside; the 24 mm "air" thin-lens eye gives ~42 D. Teaching approximation, the visible figures (dioptre of glasses P = −1/far point; 100 度 = 1 D) are right. Dioptre arithmetic is not 初中 | scope | note "示意模型"; glasses power quiz `glass_power` as 拓展 |
| 20 | doubtful (physics) | `model-energysrc.ts` `CO2` table: wind 0.03 kg/kWh used for "wind + solar" | life-cycle wind ~0.011, solar PV ~0.04-0.05, hydro ~0.024, nuclear ~0.012, coal ~0.82-1.0 kg/kWh (general knowledge). Mixed rounded numbers; the label says "wind" but the mix has wind + solar | rounded content | rename "风能 + 太阳能", keep as 示意 |
| 21 | doubtful (physics) | `model-molecule.ts` `force(x) = x⁻¹³ − x⁻⁷` and 400 °C diffusion task | It is a made-up Lennard-Jones-like curve (shape right: repulsion inside r₀, minimum near 1.109 r₀). Text says "距离超过分子直径的约 10 倍作用力可忽略" (人教版: ~10⁻⁹ m, i.e. ten diameters: OK). Task "400 °C 以上" is only to make the effect visible | OK as model; label "示意" | none required |
| 22 | style | `catalog.ts` chapter labels | Names follow the 2012 人教版 numbering (第十三章 内能 … 第二十二章). The 2024 revised 人教版 has other chapter numbers / names (e.g. 八上 第二章 声音与环境). Not wrong for the 2012 edition | edition | state the edition in the page ("人教版 2012 年版目录") or check which edition the user's children use |
| 23 | style | `model-dispersion.ts` `WAVES` has 6 colours (no 靛 / 青), lessons say 7 | Lesson says 7 colours; drawing shows 6. Harmless | consistency | add 靛 (indigo) or say "六种主要色光" in the sim |
| 24 | style | `model-home.ts` | Wire colours not shown (good: 中国 colour rules for 火 / 零 / 地: 红(or 黄/绿/红) / 蓝 / 黄绿 would be risky); socket "左零右火上接地" is the textbook rule | OK | none |

## Gaps (topics / experiments missing)  (from general knowledge of 人教版 and the 2022 课标; unverified against the PDF)

Chapters with NO simulation (the coverage table claims "every chapter of 人教版 8上 / 8下 / 9 has a simulation": that is NOT true):
1. **第六章 质量与密度** (8上): 质量, 天平, 密度 ρ = m/V, 测量固体和液体的密度 (a 学生必做实验), 密度与温度. Entirely missing (buoyancy uses ρ but there is no density lab). HIGH priority.
2. **第三章 物态变化**: only 熔化 / 凝固 / 沸腾. Missing 汽化 (蒸发, 影响蒸发快慢的因素), 液化, 升华 / 凝华, 水循环, the "探究水沸腾时温度变化" is covered; 温度计 / 摄氏度 (第三章 first section) missing.
3. **第二章 声现象**: missing 声音的传播 (介质, 真空不能传声), 回声与测距, 超声波 / 次声波, 噪声的控制 (防治 3 ways), 声与信息 / 能量.
4. **第四章 光现象**: missing 光的直线传播 (影, 小孔成像, 光速), 镜面反射 vs 漫反射, 红外 / 紫外 as part of 第四章 (only in emwave).
5. **第十六章 电压 电阻**: the ohm sim has no voltmeter / ammeter connection training, no 电阻与长度 / 横截面积 / 材料 / 温度 experiment, 导体 / 绝缘体, 半导体 / 超导.
6. **第十五章 电流和电路**: 摩擦起电, 两种电荷, 导体 绝缘体, 电路的基本组成, 电流表使用, 串、并联电路中电流的规律 (探究): only closed-form values; no guided experiment.
7. **第十八章 电功率**: 电能 and 电功 W = UIt, 电能表 reading, 额定电压 / 额定功率 and 实际功率 (partly in bulbpower), 电热 / 焦耳定律实验 (探究电流热效应, 控制变量) – only formula.
8. **第七章 力**: 力的概念, 力的三要素, 力的示意图, 力的作用是相互的 not covered.
9. **第八章 运动和力**: 惯性 (only a sentence), 惯性现象, 力与运动 (合力).
10. **第十一章 功和机械能**: 动能 / 势能 影响因素 (探究 by 斜面小球撞木块) is not a guided experiment.
11. **第十二章 简单机械**: 定滑轮 / 动滑轮 separately (实质 = 等臂 / 省力杠杆), 轮轴.
12. **第十四章 内能的利用**: 燃料 热值 experiment ok (Q=qm); 内能 概念 / 做功与热传递改变内能 (第十三章 section 2) are NOT in `molecule` / `specificheat`: 改变内能的两种方式, 内能 vs 热量 vs 温度 ("物体吸热温度一定升高吗" is a classic 中考 point).
13. **第二十一章 信息的传递**: 电话, 模拟 / 数字信号, 卫星 / 光纤通信 (光纤 is in emwave), 移动通信; only 电磁波.
14. **第二十章 电与磁**: 电磁继电器, 扬声器 / 话筒, 发电机 vs 电动机 comparison, 交流 vs 直流; 磁化 / 磁极间相互作用.
15. **第二十二章 能源**: 核裂变 / 核聚变, 太阳能利用, 能量转化与转移 (conversion chains partly covered).
16. **Measurement (long, time, temperature) and 误差**: no sim (the 2022 课标 starts with 长度 / 时间 measurement and 误差).
17. 2022 课标 "跨学科实践" (e.g. 制作简易密度计, 家庭用电) not covered.

Required experiments (学生必做实验 of the 2022 课标; my recollection of the list, NOT verified): 测量长度/时间 and 速度; 水沸腾; 光的反射; 平面镜成像; 凸透镜成像; 测量固体和液体的密度; 弹簧测力计 (弹力-伸长); 滑动摩擦力因素; 二力平衡; 液体压强; 浮力大小 (阿基米德); 杠杆平衡; 机械效率 (滑轮组); 动能/势能 影响因素; 比较不同物质吸热; 串/并联电路电流 and 电压; 电流与电压、电阻; 测量电阻; 测小灯泡功率; 通电螺线管磁场; 感应电流条件; 电热 (焦耳). Coverage by the app: partial (concept sims, but not as guided procedures with measurement tables): 密度 NONE, 电流电压电阻关系 (ohm: values only), 测量电阻 NONE (listed in docs as not built), 凸透镜实验 (no screen to move), 动能/势能 NONE, 电热 NONE, 液体压强 (pressure, probe depth only; no comparison across directions / liquids as a table).

Within covered chapters (from the docs, confirmed): 伏安法测电阻, 凸透镜 screen experiment, 大气压 with air in the tube, 浮力 with other shapes.

## Verified OK (recomputed or standard facts)

- c = 3×10⁸ m/s, sound 340 m/s at 15 °C, 3.6 km/h conversion, 1 kW·h = 3.6 MJ.
- Water c 4.2×10³, ice 2.1×10³, 煤油 2.1×10³, 沙子 0.92×10³ (textbook 沙石), 铜 0.39×10³, 铁 0.46×10³, 铝 0.88×10³; heat values 汽油 4.6×10⁷, 柴油 4.3×10⁷, 酒精 3.0×10⁷, 干木柴 1.2×10⁷ J/kg; densities 水 1000, 酒精 800, 盐水 1200, 水银 13600; 1 atm 760 mm Hg = 1.013×10⁵ Pa (`P0/(13600·9.8)` = 760.2 mm).
- Reflection law, image 2d separation, relative speed 2v, mirror turn → 2α; refraction directions (toward / away from normal); lens image table u vs f, u = 2f equal real image, u = f no image; concave lens upright reduced virtual image; 近视 凹透镜 / 远视 凸透镜, dioptre P = −1/far point, 100 度 = 1 D; 显微镜 total = obj × eye; 望远镜 M = f₀/fₑ, length f₀ + fₑ.
- 力 G = mg, moon g 1.6, Mars 3.7, Jupiter 24.8 (≈ 24.79); Hooke proportional; friction depends on pressure and roughness, not area / speed; 二力平衡 four conditions; 同一直线反向合力 = difference.
- p = F/S, p = ρgh, 托里拆利 tilt does not change vertical height, altitude lowers pressure; 连通器 equal level, ρ₁h₁ = ρ₂h₂; Archimedes, 称重法, 浮沉条件, 漂浮 F = G; 杠杆 F₁L₁ = F₂L₂, 省力 / 费力 / 等臂 classification, 滑轮组 F = (G+G动)/n, s = nh, η formulas, 斜面 Gh = Fs, "使用任何机械都不省功".
- Engine: stroke order and angles, 2 revolutions per cycle, works/s = rpm/120, 压缩 = 机械能→内能; efficiency range statements (汽油机 25-30 %, 柴油机 30-40 %: textbook gives 20-30 / 30-45, acceptable).
- Electricity: series / parallel laws, P = UI, Q = I²Rt, fuse in the live wire with low melting point / high resistance (铅锑合金), 3-hole socket 左零右火上地, safe voltage ≤ 36 V, 测电笔 hold the metal tail, 并联 household; 测小灯泡 1.2×U额 limit, filament resistance changes → no averaging (the 0.6 power law is an invented teaching model).
- Magnetism: 磁感线 N → S outside, no crossing, 地磁 N pole near geographic south, 沈括, 右手螺旋定则 statement, Oersted (current-direction reverses deflection). EM spectrum order and approximate band limits, c = λf (30 MHz → 10 m check), 光纤 speed ≈ 2/3 c, sound is not electromagnetic.
- Energy sources: 煤 / 石油 / 天然气 / 核能 不可再生; 太阳 风 水 生物质 (地热) 可再生; 电能 氢能 二次;火力 efficiency 0.9·0.45·0.98 ≈ 40 %.
- Programmatic: 28 quiz generators × 300 seeds: no duplicate / NaN choices, always 4 choices, correct answer is always among the choices.

## Could not verify

- Everything against the 课标 / 中考 说明 / textbook PDFs (no accessible source; see top). In particular the exact 学生必做实验 list, which items 2022 课标 removed or marked as 拓展, and whether g = 10 is stated in a specific province's exam (北京 etc.).
- The 2012 vs 2024 revised 人教版 chapter numbering (finding 22).
- Whether the app's tasks (`check` thresholds) are completable on every screen: not run (no tests allowed); they were read and consistent with the models (e.g. towel task needs v₀ = 2 → 0.41 m ≤ 0.5 m ok).
- Real sound, fingers, devices.
