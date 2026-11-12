#!/usr/bin/env python3
"""
Makes src/data/formulas.json: the formulas and equations page (math, physics, chemistry; primary school to junior high). Every entry is TeX (typeset by
KaTeX in the app, offline). Fields: g = the grade it is first needed (1-9), k = subject, s = group, n = name, t = the TeX.
Run:  python3 scripts/make-formulas.py
"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = []
def add(g, k, s, rows):
    for n, t in rows: F.append({'g': g, 'k': k, 's': s, 'n': n, 't': t})

# ================================================================= 数学
add(3, '数学', '平面图形：周长与面积', [
    ('长方形的周长', r'C = 2(a+b)'), ('长方形的面积', r'S = ab'), ('正方形的周长', r'C = 4a'), ('正方形的面积', r'S = a^{2}')])
add(5, '数学', '平面图形：周长与面积', [
    ('平行四边形的面积', r'S = ah'), ('三角形的面积', r'S = \dfrac{1}{2}ah'), ('梯形的面积', r'S = \dfrac{(a+b)h}{2}')])
add(6, '数学', '平面图形：周长与面积', [
    ('圆的周长', r'C = 2\pi r = \pi d'), ('圆的面积', r'S = \pi r^{2}'), ('圆环的面积', r'S = \pi (R^{2}-r^{2})')])
add(9, '数学', '平面图形：周长与面积', [
    ('弧长', r'l = \dfrac{n\pi r}{180}'), ('扇形的面积', r'S = \dfrac{n}{360}\pi r^{2} = \dfrac{1}{2}lr')])
add(5, '数学', '立体图形：表面积与体积', [
    ('长方体的体积', r'V = abh'), ('长方体的表面积', r'S = 2(ab+bh+ah)'), ('正方体的体积', r'V = a^{3}'), ('正方体的表面积', r'S = 6a^{2}')])
add(6, '数学', '立体图形：表面积与体积', [
    ('圆柱的体积', r'V = \pi r^{2}h'), ('圆柱的侧面积', r'S_{\text{侧}} = 2\pi rh'), ('圆柱的表面积', r'S = 2\pi r^{2} + 2\pi rh'), ('圆锥的体积', r'V = \dfrac{1}{3}\pi r^{2}h')])
add(9, '数学', '立体图形：表面积与体积', [
    ('球的体积', r'V = \dfrac{4}{3}\pi r^{3}'), ('球的表面积', r'S = 4\pi r^{2}'), ('圆锥的侧面积', r'S_{\text{侧}} = \pi r l')])
add(4, '数学', '角与三角形', [
    ('三角形的内角和', r'\angle A + \angle B + \angle C = 180^{\circ}'), ('三角形的三边关系', r'a + b > c,\quad a - b < c')])
add(7, '数学', '角与三角形', [
    ('四边形的内角和', r'360^{\circ}'), ('n 边形的内角和', r'(n-2)\times 180^{\circ}'), ('多边形的外角和', r'360^{\circ}'),
    ('对顶角', r'\angle 1 = \angle 3'), ('平行线的性质', r'a \parallel b \Rightarrow \angle 1 = \angle 2\ （同位角相等）')])
add(8, '数学', '角与三角形', [
    ('勾股定理', r'a^{2} + b^{2} = c^{2}'), ('勾股定理的逆定理', r'a^{2} + b^{2} = c^{2} \Rightarrow \text{三角形是直角三角形}'),
    ('全等三角形的判定', r'\text{SSS、SAS、ASA、AAS、HL}'), ('直角三角形斜边上的中线', r'CD = \dfrac{1}{2}AB'),
    ('三角形的中位线', r'DE \parallel BC,\quad DE = \dfrac{1}{2}BC')])
add(9, '数学', '角与三角形', [
    ('相似三角形', r"\dfrac{AB}{A'B'} = \dfrac{BC}{B'C'} = \dfrac{CA}{C'A'} = k"), ('相似三角形的面积比', r"S : S' = k^{2}"),
    ('圆周角定理', r'\angle ABC = \dfrac{1}{2}\angle AOC'), ('切线的性质', r'\text{圆的切线垂直于过切点的半径}')])
add(4, '数学', '运算律', [
    ('加法交换律', r'a + b = b + a'), ('加法结合律', r'(a+b)+c = a+(b+c)'), ('乘法交换律', r'a \times b = b \times a'),
    ('乘法结合律', r'(a \times b)\times c = a \times (b \times c)'), ('乘法分配律', r'a(b+c) = ab + ac'),
    ('减法的性质', r'a - b - c = a - (b+c)'), ('除法的性质', r'a \div b \div c = a \div (b \times c)')])
add(3, '数学', '分数、百分数与比', [('同分母分数加减法', r'\dfrac{a}{c} \pm \dfrac{b}{c} = \dfrac{a \pm b}{c}')])
add(5, '数学', '分数、百分数与比', [
    ('异分母分数加法', r'\dfrac{a}{b} + \dfrac{c}{d} = \dfrac{ad + bc}{bd}'), ('分数的基本性质', r'\dfrac{a}{b} = \dfrac{a \times k}{b \times k} = \dfrac{a \div k}{b \div k}\quad (k \neq 0)')])
add(6, '数学', '分数、百分数与比', [
    ('分数乘法', r'\dfrac{a}{b} \times \dfrac{c}{d} = \dfrac{ac}{bd}'), ('分数除法', r'\dfrac{a}{b} \div \dfrac{c}{d} = \dfrac{a}{b} \times \dfrac{d}{c}'),
    ('百分率', r'\text{百分率} = \dfrac{\text{部分}}{\text{总量}} \times 100\%'), ('折扣', r'\text{现价} = \text{原价} \times \text{折扣}'),
    ('利息', r'\text{利息} = \text{本金} \times \text{利率} \times \text{时间}'), ('比例的基本性质', r'a : b = c : d \Rightarrow ad = bc'),
    ('正比例', r'\dfrac{y}{x} = k\ （一定）'), ('反比例', r'xy = k\ （一定）')])
add(4, '数学', '常见数量关系', [
    ('路程、速度、时间', r's = vt,\quad v = \dfrac{s}{t},\quad t = \dfrac{s}{v}'), ('平均数', r'\bar{x} = \dfrac{x_1 + x_2 + \cdots + x_n}{n}'),
    ('总价', r'\text{总价} = \text{单价} \times \text{数量}')])
add(5, '数学', '常见数量关系', [('工作量', r'\text{工作总量} = \text{工作效率} \times \text{工作时间}')])
add(7, '数学', '有理数与整式', [
    ('绝对值', r'|a| = \begin{cases} a, & a \ge 0 \\ -a, & a < 0 \end{cases}'), ('科学记数法', r'a \times 10^{n}\quad (1 \le |a| < 10)'),
    ('同底数幂相乘', r'a^{m} \cdot a^{n} = a^{m+n}'), ('幂的乘方', r'(a^{m})^{n} = a^{mn}'), ('积的乘方', r'(ab)^{n} = a^{n}b^{n}'),
    ('一元一次方程', r'ax + b = 0 \Rightarrow x = -\dfrac{b}{a}\quad (a \neq 0)'),
    ('不等式的性质', r'a > b,\ c > 0 \Rightarrow ac > bc;\quad c < 0 \Rightarrow ac < bc'), ('利润率', r'\text{利润率} = \dfrac{\text{利润}}{\text{成本}} \times 100\%')])
add(8, '数学', '有理数与整式', [
    ('同底数幂相除', r'a^{m} \div a^{n} = a^{m-n}\quad (a \neq 0)'), ('零指数幂', r'a^{0} = 1\quad (a \neq 0)'), ('负整数指数幂', r'a^{-n} = \dfrac{1}{a^{n}}\quad (a \neq 0)')])
add(8, '数学', '乘法公式与因式分解', [
    ('平方差公式', r'(a+b)(a-b) = a^{2} - b^{2}'), ('完全平方公式', r'(a \pm b)^{2} = a^{2} \pm 2ab + b^{2}'),
    ('多项式相乘', r'(x+p)(x+q) = x^{2} + (p+q)x + pq'), ('提公因式法', r'ma + mb + mc = m(a+b+c)'),
    ('平方差分解', r'a^{2} - b^{2} = (a+b)(a-b)'), ('完全平方分解', r'a^{2} \pm 2ab + b^{2} = (a \pm b)^{2}'),
    ('十字相乘法', r'x^{2} + (p+q)x + pq = (x+p)(x+q)')])
add(8, '数学', '分式与二次根式', [
    ('分式的基本性质', r'\dfrac{A}{B} = \dfrac{A \cdot M}{B \cdot M} = \dfrac{A \div M}{B \div M}\quad (M \neq 0)'),
    ('分式的乘除', r'\dfrac{a}{b} \cdot \dfrac{c}{d} = \dfrac{ac}{bd},\quad \dfrac{a}{b} \div \dfrac{c}{d} = \dfrac{ad}{bc}'),
    ('二次根式的性质', r'(\sqrt{a})^{2} = a\ (a \ge 0),\quad \sqrt{a^{2}} = |a|'), ('积的算术平方根', r'\sqrt{ab} = \sqrt{a}\cdot\sqrt{b}\quad (a, b \ge 0)'),
    ('商的算术平方根', r'\sqrt{\dfrac{a}{b}} = \dfrac{\sqrt{a}}{\sqrt{b}}\quad (a \ge 0,\ b > 0)')])
add(8, '数学', '函数与坐标', [
    ('一次函数', r'y = kx + b'), ('两点间的距离', r'd = \sqrt{(x_2 - x_1)^{2} + (y_2 - y_1)^{2}}'),
    ('线段的中点', r'M\left(\dfrac{x_1 + x_2}{2},\ \dfrac{y_1 + y_2}{2}\right)'), ('直线的斜率', r'k = \dfrac{y_2 - y_1}{x_2 - x_1}')])
add(9, '数学', '函数与坐标', [
    ('反比例函数', r'y = \dfrac{k}{x}\quad (k \neq 0)'), ('二次函数的一般式', r'y = ax^{2} + bx + c'), ('二次函数的顶点式', r'y = a(x-h)^{2} + k'),
    ('抛物线的对称轴', r'x = -\dfrac{b}{2a}'), ('抛物线的顶点', r'\left(-\dfrac{b}{2a},\ \dfrac{4ac - b^{2}}{4a}\right)')])
add(9, '数学', '一元二次方程', [
    ('求根公式', r'x = \dfrac{-b \pm \sqrt{b^{2} - 4ac}}{2a}'), ('根的判别式', r'\Delta = b^{2} - 4ac'),
    ('根与系数的关系', r'x_1 + x_2 = -\dfrac{b}{a},\quad x_1 x_2 = \dfrac{c}{a}'), ('配方法', r'x^{2} + px = \left(x + \dfrac{p}{2}\right)^{2} - \dfrac{p^{2}}{4}')])
add(9, '数学', '三角函数', [
    ('锐角三角函数', r'\sin A = \dfrac{\text{对边}}{\text{斜边}},\quad \cos A = \dfrac{\text{邻边}}{\text{斜边}},\quad \tan A = \dfrac{\text{对边}}{\text{邻边}}'),
    ('同角三角函数', r'\sin^{2}A + \cos^{2}A = 1'),
    ('30° 的三角函数值', r'\sin 30^{\circ} = \dfrac{1}{2},\ \cos 30^{\circ} = \dfrac{\sqrt{3}}{2},\ \tan 30^{\circ} = \dfrac{\sqrt{3}}{3}'),
    ('45° 的三角函数值', r'\sin 45^{\circ} = \dfrac{\sqrt{2}}{2},\ \cos 45^{\circ} = \dfrac{\sqrt{2}}{2},\ \tan 45^{\circ} = 1'),
    ('60° 的三角函数值', r'\sin 60^{\circ} = \dfrac{\sqrt{3}}{2},\ \cos 60^{\circ} = \dfrac{1}{2},\ \tan 60^{\circ} = \sqrt{3}')])
add(8, '数学', '统计与概率', [('方差', r's^{2} = \dfrac{(x_1 - \bar{x})^{2} + (x_2 - \bar{x})^{2} + \cdots + (x_n - \bar{x})^{2}}{n}')])
add(9, '数学', '统计与概率', [('概率', r'P(A) = \dfrac{m}{n}\quad \left(\dfrac{\text{所求情况数}}{\text{所有可能的情况数}}\right)')])

# ================================================================= 物理
add(7, '物理', '运动与声光', [
    ('速度', r'v = \dfrac{s}{t}'), ('光的反射定律', r'\angle r = \angle i'), ('声音在空气中的速度（15 ℃）', r'v \approx 340\ \text{m/s}'),
    ('光在真空中的速度', r'c = 3 \times 10^{8}\ \text{m/s}'), ('平面镜成像', r'\text{正立、等大、虚像，像与物到镜面的距离相等}'),
    ('凸透镜成像（u>2f）', r'u > 2f:\ \text{倒立、缩小的实像}'), ('凸透镜成像（f<u<2f）', r'f < u < 2f:\ \text{倒立、放大的实像}'),
    ('凸透镜成像（u<f）', r'u < f:\ \text{正立、放大的虚像}'), ('密度', r'\rho = \dfrac{m}{V}')])
add(8, '物理', '力与机械', [
    ('重力', r'G = mg\quad (g \approx 9.8\ \text{N/kg})'), ('压强', r'p = \dfrac{F}{S}'), ('液体的压强', r'p = \rho g h'),
    ('阿基米德原理', r'F_{\text{浮}} = G_{\text{排}} = \rho_{\text{液}} g V_{\text{排}}'), ('称重法测浮力', r'F_{\text{浮}} = G - F'),
    ('漂浮或悬浮', r'F_{\text{浮}} = G'), ('杠杆的平衡条件', r'F_1 L_1 = F_2 L_2'), ('功', r'W = Fs'),
    ('功率', r'P = \dfrac{W}{t} = Fv'), ('机械效率', r'\eta = \dfrac{W_{\text{有}}}{W_{\text{总}}} \times 100\%'),
    ('滑轮组', r'F = \dfrac{G_{\text{物}} + G_{\text{动}}}{n}'), ('一个标准大气压', r'p_0 \approx 1.0 \times 10^{5}\ \text{Pa}')])
add(9, '物理', '热学', [
    ('物体吸收（放出）的热量', r'Q = cm\Delta t'), ('燃料完全燃烧放出的热量', r'Q = mq'), ('热机的效率', r'\eta = \dfrac{W_{\text{有}}}{Q_{\text{放}}} \times 100\%'),
    ('热平衡方程', r'Q_{\text{吸}} = Q_{\text{放}}'), ('水的比热容', r'c_{\text{水}} = 4.2 \times 10^{3}\ \text{J/(kg·℃)}')])
add(9, '物理', '电学', [
    ('电流', r'I = \dfrac{Q}{t}'), ('欧姆定律', r'I = \dfrac{U}{R}'), ('电功', r'W = UIt'), ('电功率', r'P = UI = \dfrac{W}{t}'),
    ('电功率的导出式', r'P = I^{2}R = \dfrac{U^{2}}{R}'), ('焦耳定律', r'Q = I^{2}Rt'),
    ('串联电路', r'I = I_1 = I_2,\quad U = U_1 + U_2,\quad R = R_1 + R_2,\quad \dfrac{U_1}{U_2} = \dfrac{R_1}{R_2}'),
    ('并联电路', r'I = I_1 + I_2,\quad U = U_1 = U_2,\quad \dfrac{1}{R} = \dfrac{1}{R_1} + \dfrac{1}{R_2},\quad \dfrac{I_1}{I_2} = \dfrac{R_2}{R_1}'),
    ('电能的单位换算', r'1\ \text{kW·h} = 3.6 \times 10^{6}\ \text{J}'), ('家庭电路电压', r'U = 220\ \text{V}\quad （对人体安全的电压不高于 36 V）')])

# ================================================================= 化学
ARR = lambda c: r'\xrightarrow{' + c + '}'
add(9, '化学', '化学方程式：燃烧与氧化', [
    ('氢气燃烧', r'2H_{2} + O_{2} ' + ARR(r'\text{点燃}') + r' 2H_{2}O'), ('碳充分燃烧', r'C + O_{2} ' + ARR(r'\text{点燃}') + r' CO_{2}'),
    ('碳不充分燃烧', r'2C + O_{2} ' + ARR(r'\text{点燃}') + r' 2CO'), ('一氧化碳燃烧', r'2CO + O_{2} ' + ARR(r'\text{点燃}') + r' 2CO_{2}'),
    ('硫燃烧', r'S + O_{2} ' + ARR(r'\text{点燃}') + r' SO_{2}'), ('磷燃烧', r'4P + 5O_{2} ' + ARR(r'\text{点燃}') + r' 2P_{2}O_{5}'),
    ('铁丝在氧气中燃烧', r'3Fe + 2O_{2} ' + ARR(r'\text{点燃}') + r' Fe_{3}O_{4}'), ('镁燃烧', r'2Mg + O_{2} ' + ARR(r'\text{点燃}') + r' 2MgO'),
    ('铜加热', r'2Cu + O_{2} ' + ARR(r'\triangle') + r' 2CuO'), ('铝在空气中氧化', r'4Al + 3O_{2} = 2Al_{2}O_{3}'),
    ('甲烷燃烧', r'CH_{4} + 2O_{2} ' + ARR(r'\text{点燃}') + r' CO_{2} + 2H_{2}O'),
    ('酒精燃烧', r'C_{2}H_{5}OH + 3O_{2} ' + ARR(r'\text{点燃}') + r' 2CO_{2} + 3H_{2}O')])
add(9, '化学', '化学方程式：制取气体与分解', [
    ('高锰酸钾制氧气', r'2KMnO_{4} ' + ARR(r'\triangle') + r' K_{2}MnO_{4} + MnO_{2} + O_{2}\uparrow'),
    ('氯酸钾制氧气', r'2KClO_{3} ' + ARR(r'MnO_{2},\ \triangle') + r' 2KCl + 3O_{2}\uparrow'),
    ('过氧化氢制氧气', r'2H_{2}O_{2} ' + ARR(r'MnO_{2}') + r' 2H_{2}O + O_{2}\uparrow'),
    ('电解水', r'2H_{2}O ' + ARR(r'\text{通电}') + r' 2H_{2}\uparrow + O_{2}\uparrow'),
    ('实验室制二氧化碳', r'CaCO_{3} + 2HCl = CaCl_{2} + H_{2}O + CO_{2}\uparrow'), ('高温煅烧石灰石', r'CaCO_{3} ' + ARR(r'\text{高温}') + r' CaO + CO_{2}\uparrow'),
    ('碳酸氢钠受热分解', r'2NaHCO_{3} ' + ARR(r'\triangle') + r' Na_{2}CO_{3} + H_{2}O + CO_{2}\uparrow'),
    ('实验室制氢气', r'Zn + H_{2}SO_{4} = ZnSO_{4} + H_{2}\uparrow')])
add(9, '化学', '化学方程式：酸、碱、盐与金属', [
    ('检验二氧化碳', r'CO_{2} + Ca(OH)_{2} = CaCO_{3}\downarrow + H_{2}O'), ('二氧化碳与水', r'CO_{2} + H_{2}O = H_{2}CO_{3}'),
    ('二氧化碳与氢氧化钠', r'CO_{2} + 2NaOH = Na_{2}CO_{3} + H_{2}O'), ('氧化钙与水', r'CaO + H_{2}O = Ca(OH)_{2}'),
    ('铁与稀盐酸', r'Fe + 2HCl = FeCl_{2} + H_{2}\uparrow'), ('铁与硫酸铜', r'Fe + CuSO_{4} = FeSO_{4} + Cu'), ('铜与硝酸银', r'Cu + 2AgNO_{3} = Cu(NO_{3})_{2} + 2Ag'),
    ('盐酸与氢氧化钠', r'NaOH + HCl = NaCl + H_{2}O'), ('硫酸与氢氧化钠', r'2NaOH + H_{2}SO_{4} = Na_{2}SO_{4} + 2H_{2}O'),
    ('盐酸与氢氧化钙', r'Ca(OH)_{2} + 2HCl = CaCl_{2} + 2H_{2}O'), ('盐酸与硝酸银', r'HCl + AgNO_{3} = AgCl\downarrow + HNO_{3}'),
    ('碳酸钠与盐酸', r'Na_{2}CO_{3} + 2HCl = 2NaCl + H_{2}O + CO_{2}\uparrow'),
    ('氢气还原氧化铜', r'CuO + H_{2} ' + ARR(r'\triangle') + r' Cu + H_{2}O'), ('一氧化碳还原氧化铁（炼铁）', r'Fe_{2}O_{3} + 3CO ' + ARR(r'\text{高温}') + r' 2Fe + 3CO_{2}'),
    ('碳还原氧化铜', r'C + 2CuO ' + ARR(r'\text{高温}') + r' 2Cu + CO_{2}\uparrow')])
add(9, '化学', '化学用语与规律', [
    ('金属活动性顺序', r'\mathrm{K\ Ca\ Na\ Mg\ Al\ Zn\ Fe\ Sn\ Pb\ (H)\ Cu\ Hg\ Ag\ Pt\ Au}'),
    ('常见元素的化合价（一）', r'\mathrm{H^{+1},\ Na^{+1},\ K^{+1},\ Ag^{+1},\ Ca^{+2},\ Mg^{+2},\ Zn^{+2},\ Ba^{+2},\ Al^{+3}}'),
    ('常见元素的化合价（二）', r'\mathrm{Fe^{+2}/Fe^{+3},\ Cu^{+2},\ O^{-2},\ S^{-2},\ Cl^{-1},\ F^{-1}}'),
    ('常见原子团的化合价', r'\mathrm{OH^{-1},\ NO_3^{-1},\ SO_4^{-2},\ CO_3^{-2},\ NH_4^{+1}}'),
    ('溶质质量分数', r'\text{溶质质量分数} = \dfrac{\text{溶质质量}}{\text{溶液质量}} \times 100\%'), ('溶液的酸碱性', r'\mathrm{pH} < 7\ \text{酸性},\quad \mathrm{pH} = 7\ \text{中性},\quad \mathrm{pH} > 7\ \text{碱性}'),
    ('质量守恒定律', r'\text{反应物的总质量} = \text{生成物的总质量}'), ('相对分子质量', r'M_r = \text{各原子相对原子质量之和}')])

out = os.path.join(ROOT, 'src/data/formulas.json')
json.dump({'note': '公式与方程式速查（数学、物理、化学）。每条是 TeX，由程序排版。内容是样品，请校对。', 'formulas': F}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(F), 'formulas', {k: sum(1 for f in F if f['k'] == k) for k in ('数学', '物理', '化学')})
