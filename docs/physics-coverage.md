# Physics lab (物理实验室) — coverage of the junior-high physics course

Page `#/science/physics` (under 科学). Scope guide: 人教版 八年级上 / 下 and 九年级全一册, 2022 课程标准. The texts and numbers are written from memory (no textbook text is copied) and must be proofread by a teacher.
A simulation = `src/phys/<id>.ts` (screen) + `src/phys/model-<id>.ts` (pure physics, tested alone). Every chapter of 人教版 八上 (1-6), 八下 (7-12) and 九年级 (13-22) now has at least one simulation (the topics inside a chapter that are still missing are listed below: the claim is about chapters, not about every section). Each has a lesson, 2-4 checked tasks (实验任务) and a 5-question quiz made from the model.

| Chapter (人教版) | Grade | Topic | Simulation | Status |
|---|---|---|---|---|
| 第一章 机械运动 | 8上 | 速度、匀速 / 匀变速、s-t 与 v-t 图、打点计时器 | `motion` | built |
| 第二章 声现象 | 8上 | 音调（频率）、响度（振幅）、音色（波形）、示波器、人耳范围 | `sound` | built (sound played with Web Audio) |
| 第三章 物态变化 | 8上 | 熔化与凝固（晶体 / 非晶体）、沸腾、温度-时间曲线 | `heating` | built |
| 第四章 光现象 | 8上 | 光的反射定律、平面镜成像 | `reflection` | built |
| 第四章 光现象 | 8上 | 光的折射、全反射、临界角 | `refraction` | built |
| 第四章 光现象 | 8上 | 光的色散、色光的混合、不透明物体的颜色 | `dispersion` | built (prism with an exaggerated teaching glass, three lights, object colour) |
| 第五章 透镜及其应用 | 8上 | 凸透镜 / 凹透镜成像规律、物距像距、照相机 / 投影仪 / 放大镜 | `lens` | built |
| 第五章 透镜及其应用 | 8上 | 眼睛与眼镜、显微镜与望远镜 | `eye` | built (thin-lens eye with accommodation, myopia / hyperopia and the glasses, microscope magnification and field, Kepler telescope) |
| 第六章 质量与密度 | 8上 | 质量与天平、密度 ρ = m/V、测量固体和液体的密度（必做实验）、操作顺序造成的误差、密度表、浮沉比较 | `density` | built (balance + water displacement for a solid, beaker + measuring cylinder for a liquid, a wrong order of steps gives a too large density, metals named from the table) |
| 第七章 力 | 8下 | 弹力、胡克定律、弹簧测力计、重力（g 与星球） | `spring` | built |
| 第七章 力 | 8下 | 摩擦力（静 / 滑动，压力、粗糙程度）、斜面上的受力 | `friction` | built |
| 第八章 运动和力 | 8下 | 牛顿第一定律（阻力对运动的影响）、二力平衡的条件 | `newton` | built |
| 第九章 压强 | 8下 | 压强 p = F/S、液体压强、大气压（托里拆利） | `pressure` | built |
| 第九章 压强 | 8下 | 连通器、流体压强与流速 | `fluid` | built (U-tube with two liquids, Bernoulli in a narrowing pipe, blowing between two sheets of paper) |
| 第十章 浮力 | 8下 | 阿基米德原理、浮沉条件、密度的比较 | `buoyancy` | built |
| 第十一章 功和机械能 | 8下 | 功 W = Fs、功率 P = W/t、动能 / 势能的转化、机械能守恒 | `energy` | built (work + pendulum + track) |
| 第十二章 简单机械 | 8下 | 杠杆平衡条件、杠杆分类 | `lever` | built |
| 第十二章 简单机械 | 8下 | 滑轮组、斜面、机械效率 | `pulley` | built |
| 第十三章 内能 | 9 | 比热容、Q = cmΔT、吸 / 放热 | `specificheat` | built |
| 第十三章 内能 | 9 | 分子热运动、扩散、分子间的作用力 | `molecule` | built (random-walk diffusion model, force curve, three states) |
| 第十四章 内能的利用 | 9 | 热机四冲程、热机效率、能量守恒 | `engine` | built (crank-piston four strokes, energy flow and efficiency, an energy-balance check) |
| 第十五章 电流和电路 | 9 | 串联与并联、电路图、电流表 | `ohm` (modes), `circuit` | built; `circuit` lets the child place three resistors in a series chain / a parallel group (mixed circuits) |
| 第十六章 电压 电阻 | 9 | 电压表、电阻、滑动变阻器 | `ohm` | built |
| 第十七章 欧姆定律 | 9 | I = U/R、串并联电阻的规律、分压分流 | `ohm` | built |
| 第十八章 电功率 | 9 | P = UI、焦耳定律 Q = I²Rt | `ohm` (power and heat), `bulbpower` | built; `bulbpower` = 测小灯泡的电功率 (rheostat, hot filament, readings) |
| 第十九章 生活用电 | 9 | 家庭电路、保险丝、安全用电 | `home` | built (load and fuse, short circuit, electric shock with the residual-current device, test pen) |
| 第二十章 电与磁 | 9 | 电磁铁、电动机（左手定则）、电磁感应 / 发电机 | `em` (3 modes) | built |
| 第二十章 电与磁 | 9 | 磁场与磁感线、地磁场、奥斯特实验 | `magfield` | built (field lines traced numerically with a draggable compass, solenoid polarity, Oersted with the Earth's field, dip angle) |
| 第二十一章 信息的传递 | 9 | 电磁波、波长 / 频率 / 波速 c = λf | `emwave` | built (spectrum, c = λf, signal travel time) |
| 第二十二章 能源与可持续发展 | 9 | 能源分类、核能、太阳能、能量转化 | `energysrc` | built (classification, conversion chains with efficiencies, electricity mix and carbon) |

## What is NOT covered (for a later agent)

1. Not built: 光的色散 with real glass data (the lab uses an exaggerated teaching glass, about three times the dispersion of crown glass, and says so), the real structure of the eye (one thin lens, no iris / vitreous), the microscope and telescope as ray diagrams with two lenses (only magnification, field of view and tube length), 流体压强 for wings (only the paper experiment and the pipe), 分子 diffusion in a liquid with real numbers (a seeded random walk of 80 + 80 molecules, a temperature range of 0 to 500 degrees to make the effect visible), 做功冲程 with a real indicator diagram (the pressure is a piecewise model), nuclear / hydro / solar plants as simulations (only conversion chains with school-level efficiencies), the wiring of the home circuit as a drawing the child edits (live / neutral / earth are shown, not wired), the magnetic field of a coil / a wire as field lines (the compass is drawn, the lines only for the bar magnet and the solenoid, which uses the same two-pole model), 地磁偏角 (only the dip angle).
2. Inside covered chapters (still not built): 伏安法测电阻 as a guided wiring task, 凸透镜成像 实验 with a screen that must be moved by the child, 浮力 with objects of changing shape (the block is a prism), 大气压 with air in the Torricelli tube, 动滑轮 with several different pulleys at once.
3. The simulations are 1-D / 2-D idealisations with one slider set; no free-body-diagram editor, no collisions, no random measurement error (a real lab has some; this lab does not).
4. Circuits: `ohm` solves series, parallel and the rheostat circuit in closed form (the drawing is fixed, only the values are dragged). `circuit` goes one step further: three resistors of 10, 20 and 30 ohm are each left out, put in the series chain or in the parallel group (series chain + one parallel group). Arbitrary networks (bridges, two parallel groups in series, wires dragged from terminal to terminal) are NOT built.
5. The progress (tasks done, quiz best) is kept on this device only (`learn.phys.v1`), not per child and not synced.
6. All content (lessons, quiz wording, numbers such as 声速 340 m/s, g = 10 N/kg (the value used in the 中考 papers; the book gives 9.8 N/kg and says 10 for rough calculation; the lessons say "本实验室取 g = 10 N/kg"; only the Torricelli column uses the standard 9.80665 because 760 mm Hg is defined with it), the filament law of the bulb, the efficiencies of the plants, the carbon figures per kWh, the dip formula of a dipole) is written from memory: a teacher must proofread. The efficiencies, emissions and boundaries of the spectrum bands are school-level round numbers, not reference data.
7. Real fingers / Apple Pencil on a real iPad (in particular dragging the compass over the field lines of `magfield`, where the canvas stops the page from scrolling), the real sound of the sound lab on a device speaker, and the look on a real screen were not tested.
8. **Topics of the verification report (`docs/verify/physics.md`) that are still missing** (the sections of a chapter that have no simulation): 第三章 汽化（蒸发及影响蒸发快慢的因素）、液化、升华和凝华、水循环、温度计与摄氏度; 第二章 声音的传播（介质、真空不能传声）、回声与测距、超声波 / 次声波、噪声的控制、声与信息 / 能量; 第四章 光的直线传播（影、小孔成像、光速）、镜面反射与漫反射; 第十五章 摩擦起电、两种电荷、导体与绝缘体; 第十六章 电阻与长度 / 横截面积 / 材料 / 温度的关系、半导体 / 超导; 第十八章 电功与电能表（W = UIt、读电能表）、电热的探究实验; 第十三章 改变内能的两种方式（做功与热传递、内能 / 热量 / 温度的区别）; 第二十章 电磁继电器、扬声器和话筒、交流与直流; 第二十一章 电话、模拟信号与数字信号、卫星和移动通信; 第七章 力的三要素与示意图、力的作用是相互的; 第八章 惯性现象; 长度、时间的测量与误差; the 跨学科实践 tasks. The required experiments of the 课标 that are only partly covered: 凸透镜成像 (no screen to move), 串并联电路中电流 / 电压的规律 (values only), 测量电阻, 动能 / 势能的影响因素 (as a guided experiment), 电热 (the Joule law experiment). Whether an item belongs to the 2022 课标 or to the textbook edition of the user's children was NOT verified against the source documents.
9. Topics the verification report marks as beyond 初中 (动摩擦因数, 加速度, 劲度系数, Snell's law, thin-lens formula, E_k = mv²/2 ...) are kept as 拓展 content; their grade placement was not changed in this pass (decision of the user: grade placement is out of scope).
