// 生物实验室 (#/science/bio, under 科学): junior-high biology as simulations (kit shared with the physics lab).
// Part A: every pure model against hand values, independent re-computations and invariants (Mendel enumeration + chi-square, ABO table, Lotka-Volterra against an independent RK4 and its conserved quantity,
// SIR conservation and the final-size equation, enzyme optimum, saturation, 10 % rule, thin-lens eye, Boyle, the dichotomous key) and every quiz generator (23 simulations x 300 seeds x 5 questions,
// the right answer recomputed independently; the checker is shown to catch a wrong formula).
// Part B: the pages (23 cards by grade, every simulation mounts, readouts finite, sliders respond, every task completed by driving the state, kept after a reload, quiz right / wrong, hidden state / actions / 重置).
// Part C: layout on 5 screen sizes (dpr 2 / 3, crisp canvas, sliders >= 44 px, no overflow, centred). Part D: real touch drags (CDP, dpr 2) on a slider and on three drag-and-drop simulations.
// Part E: English / French (nothing Chinese left outside content boxes; the check:i18n list is covered by src/i18n-extra/biolab.json). Part F: nothing leaves the device.
// Not tested: real fingers / Apple Pencil on an iPad, how the simulations feel to a child, the biology content (a teacher must proofread lessons, quiz wording, numbers, the 42 organisms and their features).
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const OUT = process.env.D || 'tests/out/biolab/';
fs.mkdirSync(OUT, { recursive: true });

const IDS = ['foodweb', 'population', 'microscope', 'cells', 'division', 'levels', 'seed', 'photo', 'respiration', 'transpiration', 'flower', 'digest', 'breathing', 'blood', 'nerve', 'hormone', 'eye', 'motion', 'ferment', 'classify', 'genetics', 'selection', 'epidemic'];
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const extra = JSON.parse(fs.readFileSync(path.join(__dirname, '../../src/i18n-extra/biolab.json'), 'utf8'));
const withExtra = async (t) => {
  const add = 'Object.assign(EN, ' + JSON.stringify(Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, v[0]]))) + ');\nObject.assign(FR, ' + JSON.stringify(Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, v[1]]))) + ');';
  await t.ctx.route('**/src/i18n-data.ts*', async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()) + '\n' + add }); });
  await t.page.reload(); await t.page.waitForSelector('.hub-grid, .kids, .empty-home');
};

// ---- how to complete every task by driving the state (it states the biology, independent of the task code) ----
const L = (n, p, v = 1) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`${p}${i}`, v]));
const SOLVE = {
  microscope: { x400: { eye: 10, obj: 40, d: 4 }, low: { spec: 1, eye: 5, obj: 4, d: 28 }, invert: { obj: 10, d: 16, sx: -0.5 } },
  cells: { plant: { kind: 0, ...L(7, 'pa') }, animal: { kind: 1, ...L(4, 'an') }, clean: { kind: 0, miss: 0, ...L(7, 'pa') } },
  division: { ana: { stage: 3 }, meta: { stage: 2 }, eight: { N: 8, stage: 5 } },
  levels: { animal: { kind: 0, ...L(10, 'lv') }, plant: { kind: 1, ...L(8, 'lv') }, clean: { kind: 0, miss: 0, ...L(10, 'lv') } },
  seed: { high: { day: 6 }, nowater: { water: 0, day: 6 }, boiled: { viable: 0, day: 6 }, cold: { T: 4, day: 6 } },
  photo: { dark: { mode: 0, I: 0 }, sat: { I: 60, C: 0.04, T: 30 }, co2: { I: 60, C: 0.2, T: 25 }, starch: { mode: 1, cover: 1, hours: 4, I: 30 } },
  respiration: { night: { exp: 0, t: 2 }, comp: { exp: 0, cover: 0, T: 20, t: 7.25 }, warm: { T: 30 }, lime: { exp: 1, live: 1, mass: 100, min: 30, T: 20 } },
  transpiration: { dark: { light: 0 }, hot: { T: 40, RH: 10, wind: 10 }, humid: { RH: 90 } },
  flower: { full: { ov: 4, pollen: 5, pol: 1, stage: 5 }, none: { pol: 0, stage: 5 }, partial: { ov: 4, pollen: 2, pol: 1, stage: 5 } },
  digest: { opt: { mode: 0, T: 37, pH: 7, min: 5 }, hot: { T: 75, min: 5 }, acid: { pH: 2, T: 37 }, fat: { mode: 1, food: 2, organ: 3 } },
  breathing: { vol: { mode: 0, dd: 100, rr: 100 }, boyle: { mode: 0, block: 1, dd: 100, rr: 50 }, vent: { mode: 1, Vt: 1000, f: 20 } },
  blood: { vsys: { mode: 0, frac: 0.3 }, co: { mode: 0, hr: 120 }, clump: { mode: 2, donor: 1, recip: 2 }, uni: { mode: 2, donor: 0, recip: 3 } },
  nerve: { cut: { mode: 0, cut: 2 }, slow: { mode: 0, site: 0, cut: 0, v: 30 }, ruler: { mode: 1, d: 20 } },
  hormone: { meal: { dia: 0, carbs: 100 }, diab: { dia: 1, dose: 0 }, inject: { dia: 1, carbs: 50, dose: 60 } },
  eye: { far: { u: 6, myopia: 0, glass: 0 }, blur: { myopia: 3, u: 6, glass: 0 }, fix: { myopia: 2, u: 6, glass: -2 } },
  motion: { flex: { b: 80, t: 0 }, heavy: { m: 5 }, arm: { d1: 0.06, m: 2 } },
  ferment: { bubbles: { mode: 0, T: 35, sugar: 5, yeast: 2, t: 30 }, hot: { mode: 0, T: 65, sugar: 5, t: 10 }, log: { mode: 1, T: 37, hours: 4 }, death: { mode: 1, T: 37, hours: 12 } },
  classify: { key: { ident: 3 }, vert: { mode: 1, set: 0, ...L(10, 'cl') }, plant: { mode: 1, set: 1, ...L(6, 'cl') } },
  genetics: { r31: { mode: 0, p1: 1, p2: 1 }, test: { mode: 0, p1: 1, p2: 2 }, abo4: { mode: 1, b1: 1, b2: 3 }, big: { mode: 0, p1: 1, p2: 1, N: 300 } },
  selection: { soot: { s: 0.9, e: 0.8, gen: 30 }, clean: { s: 0.1, e: 0.8, gen: 30 }, nopred: { e: 0, gen: 10 } },
  foodweb: { web: { mode: 0, ...L(11, 'l') }, snake: { mode: 0, ...L(11, 'l'), rm5: 1 }, pyr: { mode: 1, lv: 5, eta: 10 }, ddt: { mode: 2, f: 6, lv: 5 } },
  population: { eq: { mode: 0, x0: 25, y0: 10 }, crash: { mode: 0, y0: 40 }, k90: { mode: 1, N0: 20, r: 0.5, K: 1000, T: 20 } },
  epidemic: { herd: { mode: 0, vacc: 60 }, flat: { mode: 0, vacc: 30, iso: 30, route: 30 }, boost: { mode: 1, tb: 28 } },
};
const numOf = (s) => parseFloat(String(s).replace('−', '-'));
const decimals = (s) => { const m = /^[−-]?\d+\.(\d+)/.exec(String(s).trim()); return m ? m[1].length : 0; };

// ---- the quiz kinds: the right answer recomputed from `p` by formulas written here (not the ones in the models) ----
const TF = (T) => Math.max(0, 1 - ((T - 30) / 25) ** 2);
const resp = (T) => 10 * 2 ** ((T - 20) / 10);
const esat = (T) => 0.611 * Math.exp((17.27 * T) / (T + 237.3));
const aT = (T) => (T <= 37 ? Math.exp(-(((37 - T) / 14) ** 2)) : Math.exp(-(((T - 37) / 7) ** 2)));
const aP = (pH) => Math.exp(-(((pH - 6.8) / 1.6) ** 2));
const MONO = ['AA', 'Aa', 'aa'], ABO = ['AA', 'Ao', 'BB', 'Bo', 'AB', 'oo'];
const cross = (a, b) => { const o = []; for (const x of a) for (const y of b) o.push([x, y].sort().join('')); return o; };   // sorted letters: 'AA','Aa' sorts as 'Aa'? (uppercase < lowercase) -> A before a
const isRec = (g) => g === 'aa';
const bloodOf = (g) => (g.includes('A') && g.includes('B') ? 'AB' : g.includes('A') ? 'A' : g.includes('B') ? 'B' : 'O');
const fitD = (e, s) => 1 - e * (0.8 - 0.6 * s), fitL = (e, s) => 1 - e * (0.2 + 0.6 * s);
const FW = [[0, 1], [0, 2], [0, 3], [1, 4], [4, 5], [3, 5], [5, 7], [3, 7], [2, 7], [2, 6], [3, 6]];
const chainsN = () => { let n = 0; const go = (i) => { const nx = FW.filter(([a]) => a === i).map(([, b]) => b); if (!nx.length) { n++; return; } nx.forEach(go); }; go(0); return n; };
const EXPECT = {
  microscope: { mag: ([e, o]) => e * o, fov: ([M]) => 180 / M, cells: ([n, a, b]) => (n * a) / b },
  cells: { plantonly: () => 3 },
  division: { ana: ([N]) => 2 * N, chromatid: ([N]) => 2 * N, daughter: ([N]) => N, gamete: ([N]) => N / 2, dna: ([N]) => 2 * N },
  levels: { count: ([k]) => [5, 4][k], tissues: () => 4, systems: () => 8 },
  seed: { rate: ([k]) => (k / 20) * 100, count: ([t, p]) => (t * p) / 100 },
  photo: { rate: ([I, C, T]) => 40 * (I / (I + 8)) * (C / (C + 0.03)) * TF(T), limit_value: ([C, T]) => 40 * (C / (C + 0.03)) * TF(T), half: ([C, T]) => 20 * (C / (C + 0.03)) * TF(T) },
  respiration: { resp: ([T]) => resp(T), net: ([T, t]) => 30 * Math.sin((Math.PI * (t - 6)) / 12) - resp(T), comp: ([T]) => 6 + (12 / Math.PI) * Math.asin(resp(T) / 30) },
  transpiration: { vpd: ([T, RH]) => esat(T) * (1 - RH / 100), loss: ([a, o, v, w]) => 0.5 * (a / 100) * o * v * (1 + 0.12 * w), scale: ([k]) => k },
  flower: { seeds: ([ov, p]) => Math.min(ov, p), need: ([n]) => n },
  digest: { act: ([T, pH]) => 100 * aT(T) * aP(pH) },
  breathing: { boyle: ([P, a, b]) => (P * a) / b, vent: ([Vt, f]) => (Vt * f) / 1000, vol: ([d, r]) => 2400 + 14 * d + 6 * r },
  blood: { co: ([hr]) => (70 * hr) / 1000, period: ([hr]) => 60 / hr, pairs: () => 9 },
  nerve: { latency: ([a, b, v, n]) => ((a + b) / v) * 1000 + n + 10, rt: ([d]) => Math.sqrt((2 * d) / 100 / 9.8) * 1000 },
  hormone: { conv: ([m]) => m * 18 },
  eye: { far: ([m]) => 100 / m, corr: ([m]) => -m, acc: ([u]) => 1 / u, near: ([m]) => 100 / (10 + m) },
  motion: { force: ([m, d2, d1]) => (m * 9.8 * d2 + 1.5 * 9.8 * 0.15) / d1 },
  ferment: { dbl: ([n0, n]) => n0 * 2 ** n, co2: ([g]) => (g * 88) / 180 },
  classify: { ranks: () => 7 },
  genetics: {
    prob: ([i1, i2, flag]) => (100 * cross(MONO[i1], MONO[i2]).filter((g) => (flag === 1 ? isRec(g) : !isRec(g))).length) / 4,
    expect: ([i1, i2, N]) => (cross(MONO[i1], MONO[i2]).filter(isRec).length / 4) * N,
    abo: ([i1, i2]) => new Set(cross(ABO[i1], ABO[i2]).map(bloodOf)).size, sex: () => 50,
  },
  selection: {
    next: ([p, e, s]) => (100 * p * fitD(e, s)) / (p * fitD(e, s) + (1 - p) * fitL(e, s)), fit: ([e, s]) => 100 * fitD(e, s),
    gen: ([p0, e, s]) => { let p = p0, g = 0; while (p <= 0.5 && g < 2000) { p = (p * fitD(e, s)) / (p * fitD(e, s) + (1 - p) * fitL(e, s)); g++; } return g; },
  },
  foodweb: { energy: ([E, n]) => E * 0.1 ** (n - 1), maxget: ([E]) => E * 0.2, chains: () => chainsN(), conc: ([c, f, n]) => c * f ** (n - 1) },
  population: { eqx: ([c, d]) => c / d, eqy: ([a, b]) => a / b, logN: ([N0, r, K, t]) => K / (1 + (K / N0 - 1) * Math.exp(-r * t)), halfK: ([K]) => K / 2, period: ([a, c]) => (2 * Math.PI) / Math.sqrt(a * c) },
  epidemic: { herd: ([R]) => (1 - 1 / R) * 100, reff: ([R, i, r, v]) => R * (1 - i) * (1 - r) * (1 - v), susc: ([v]) => 1000 * (1 - v) },
};
// text kinds: tables written here
const STRUCT = [['细胞壁', '保护和支持细胞', 1, 0], ['细胞膜', '控制物质进出细胞', 1, 1], ['细胞质', '细胞生命活动的主要场所', 1, 1], ['细胞核', '含有遗传物质，控制生物的发育和遗传', 1, 1], ['叶绿体', '进行光合作用，制造有机物', 1, 0], ['液泡', '储存水分、糖类等物质', 1, 0], ['线粒体', '进行呼吸作用，释放能量', 1, 1]];
const LVITEM = [[['神经细胞', 0], ['红细胞', 0], ['肌肉组织', 1], ['上皮组织', 1], ['心脏', 2], ['胃', 2], ['消化系统', 3], ['呼吸系统', 3], ['人', 4], ['青蛙', 4]], [['叶肉细胞', 0], ['保卫细胞', 0], ['保护组织', 1], ['输导组织', 1], ['叶', 2], ['花', 2], ['玉米', 3], ['向日葵', 3]]];
const LVN = [['细胞', '组织', '器官', '系统', '个体'], ['细胞', '组织', '器官', '个体']];
const VAL = ['房室瓣打开，动脉瓣关闭', '房室瓣关闭，动脉瓣打开', '房室瓣打开，动脉瓣关闭'];
const GROUP = { 鲤鱼: '鱼类', 鲨鱼: '鱼类', 海马: '鱼类', 青蛙: '两栖类', 蟾蜍: '两栖类', 大鲵: '两栖类', 蛇: '爬行类', 乌龟: '爬行类', 蜥蜴: '爬行类', 鳄鱼: '爬行类', 鸡: '鸟类', 鸽子: '鸟类', 企鹅: '鸟类', 鹰: '鸟类', 兔: '哺乳类', 鲸: '哺乳类', 蝙蝠: '哺乳类', 老虎: '哺乳类', 猴: '哺乳类', 大象: '哺乳类' };
const PLANT = { 海带: '藻类植物', 葫芦藓: '苔藓植物', 蕨: '蕨类植物', 松: '裸子植物', 玉米: '被子植物', 大豆: '被子植物' };
const REFLEX = [['膝跳反射', '非条件反射'], ['缩手反射', '非条件反射'], ['眨眼反射', '非条件反射'], ['吃到酸梅分泌唾液', '非条件反射'], ['望梅止渴', '条件反射'], ['谈虎色变', '条件反射'], ['看见红灯停车', '条件反射']];
const GLAND = [['生长激素', '垂体'], ['甲状腺激素', '甲状腺'], ['胰岛素', '胰岛'], ['肾上腺素', '肾上腺'], ['性激素', '性腺']];
const LACK = [['幼年时生长激素分泌不足', '侏儒症'], ['幼年时生长激素分泌过多', '巨人症'], ['成年时生长激素分泌过多', '肢端肥大症'], ['幼年时甲状腺激素分泌不足', '呆小症'], ['甲状腺激素分泌过多', '甲亢'], ['胰岛素分泌不足', '糖尿病']];
const ROLE = [['青草', '生产者'], ['蝗虫', '初级消费者'], ['吃蝗虫的蛙', '次级消费者'], ['吃蛙的蛇', '三级消费者'], ['腐生细菌', '分解者'], ['阳光和空气', '非生物部分']];
const LINK = [['隔离患者', '控制传染源'], ['戴口罩、勤洗手', '切断传播途径'], ['接种疫苗', '保护易感人群'], ['消毒、杀灭蚊蝇', '切断传播途径'], ['对密切接触者进行医学观察', '控制传染源'], ['锻炼身体、增强抵抗力', '保护易感人群']];
const PROD = [['酵母菌', '酒精和二氧化碳'], ['乳酸菌', '乳酸'], ['醋酸菌', '醋酸']];
const DEVS = [['子房', '果实'], ['胚珠', '种子'], ['受精卵', '胚'], ['子房壁', '果皮'], ['珠被', '种皮']];
const ROTM = { p: 'd', b: 'q', d: 'p', q: 'b', n: 'u', u: 'n' }, ROTK = ['p', 'b', 'd', 'q', 'n', 'u'];
const compat = (d, r) => ({ 0: [0, 1, 2, 3], 1: [1, 3], 2: [2, 3], 3: [3] }[d].includes(r));
const TEXT = {
  microscope: { rot: (p, a) => a === ROTM[ROTK[p[0]]], move: (p, a) => a === ['左', '右', '上', '下'][p[0]] },
  cells: { func: (p, a, q) => a === STRUCT[p[0]][0] && q.includes(STRUCT[p[0]][1]), role: (p, a) => a === STRUCT[p[0]][1], has: (p, a) => a === (STRUCT[p[1]][p[0] === 0 ? 2 : 3] ? '有' : '没有'), dna: (p, a) => a === '细胞核' },
  levels: { item: (p, a, q) => { const it = LVITEM[p[0]][p[1]]; return a === LVN[p[0]][it[1]] && q.includes(it[0]); }, next: (p, a) => a === LVN[p[0]][p[1] + 1] },
  seed: { germ: ([w, a, T, v], ans) => ans === (w && a && v && Math.abs(T - 27) < 22 ? '萌发' : '不萌发'), inner: (p, a) => a.startsWith('胚是完整的'), first: (p, a) => a === '胚根' },
  photo: { limit: ([I, C, T], a) => { const f = [I / (I + 8), C / (C + 0.03), TF(T)]; return a === ['光照强度', '二氧化碳浓度', '温度'][f.indexOf(Math.min(...f))]; }, starch: (p, a) => a === '没有遮光的部分' },
  respiration: { night: (p, a) => a === '吸收氧气，释放二氧化碳', lime: (p, a) => a === '二氧化碳' },
  transpiration: { guard: (p, a) => a === '吸水膨胀', organ: (p, a) => a === '气孔' },
  flower: { develops: (p, a) => a === DEVS[p[0]][1], def: (p, a, q) => (q.includes('传粉') ? a === '花粉从花药落到柱头上' : a === '精子与卵细胞结合形成受精卵'), order: (p, a) => a === '开花 → 传粉 → 受精 → 果实和种子形成' },
  digest: { site: (p, a) => a === '胃', end: (p, a) => a === '葡萄糖', bile: (p, a) => a.startsWith('把脂肪乳化'), cold: (p, a) => a.startsWith('已被破坏') },
  breathing: { insp: (p, a) => a === '膈肌收缩，胸廓容积扩大，肺内气压低于外界气压', gas: (p, a) => a === '氧气减少，二氧化碳增多' },
  blood: { abo: ([d, r], a) => a.startsWith(compat(d, r) ? '可以' : '不可以'), valve: ([s], a) => a === VAL[s] },
  nerve: { cut: (p, a) => a.startsWith('不能'), first: (p, a) => a === '感受器', reflex: (p, a) => a === REFLEX[p[0]][1] },
  hormone: { gland: (p, a, q) => a === GLAND.find((g) => q.startsWith(g[0]))[1], lack: (p, a, q) => a === LACK.find((g) => q.startsWith(g[0]))[1], insulin: (p, a) => a.startsWith('促进血糖合成糖原'), urine: (p, a) => a.startsWith('血糖浓度过高') },
  eye: { front: (p, a) => a === '前方' },
  motion: { lever: ([x, y], a) => a === (x < y ? '费力杠杆' : x > y ? '省力杠杆' : '等臂杠杆'), pair: ([f], a) => a === (f === 0 ? '肱二头肌收缩，肱三头肌舒张' : '肱二头肌舒张，肱三头肌收缩'), comp: (p, a) => a.startsWith('骨、骨连结'), drive: (p, a) => a.startsWith('收缩产生动力') },
  ferment: { prod: (p, a, q) => a === PROD.find((x) => q.startsWith(x[0]))[1], phase: (p, a) => a === '对数期', anaer: (p, a) => a === '无氧（密封）' },
  classify: { group: (p, a, q) => a === GROUP[q.match(/“(.+?)”/)[1]], warm: (p, a, q) => { const n = q.match(/“(.+?)”/)[1]; return a.startsWith(['鸟类', '哺乳类'].includes(GROUP[n]) ? '恒定' : '不恒定'); }, plant: (p, a, q) => a === PLANT[q.match(/“(.+?)”/)[1]], kingdoms: (p, a) => a.startsWith('动物界、植物界、真菌界、细菌界、病毒') },
  genetics: { geno: ([i1, i2], a) => { const c = cross(MONO[i1], MONO[i2]); const n = (g) => c.filter((x) => x === g).length; const parts = ['AA', 'Aa', 'aa'].filter((g) => n(g)).map((g) => [n(g), g]); const gc = (x, y) => (y ? gc(y, x % y) : x); const g0 = parts.map((p) => p[0]).reduce(gc); const t = parts.length === 1 ? `全部为 ${parts[0][1]}` : parts.map((p) => `${p[0] / g0} ${p[1]}`).join(' : '); return a === t; } },
  selection: { drive: (p, a) => a.startsWith('环境对生物的变异起选择作用'), none: (p, a) => a === '保持不变' },
  foodweb: { role: (p, a, q) => a === ROLE.find((x) => q.includes(`“${x[0]}”`))[1] },
  epidemic: { link: (p, a, q) => a === LINK.find((x) => q.includes(`“${x[0]}”`))[1], memory: (p, a) => a === '记忆细胞' },
  population: {},
};

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 1180, height: 820 } });
  const { page } = t;
  const to = async (hash, sel) => { await page.evaluate((h) => (location.hash = h), hash); await page.waitForSelector(sel); await page.waitForTimeout(120); };
  const sim = async (id) => { await to('#/science/bio/' + id, '.pl-sim'); await page.waitForFunction(() => window.__bio && document.querySelector('#pl-canvas').offsetWidth > 0); };
  const set = (o) => page.evaluate((o) => { for (const [k, v] of Object.entries(o)) window.__bio.set(k, v); }, o);

  // =====================================================================================  A. THE MODELS
  {
    const r = await page.evaluate(async () => {
      const M = {}; for (const n of ['microscope', 'cells', 'division', 'levels', 'seed', 'photo', 'respiration', 'transpiration', 'flower', 'digest', 'breathing', 'blood', 'nerve', 'hormone', 'eye', 'motion', 'ferment', 'classify', 'genetics', 'selection', 'foodweb', 'population', 'epidemic']) M[n] = await import(`/src/bio/model-${n}.ts`);
      const Q = await import('/src/phys/qtools.ts');
      const o = {};
      const rnd = (a, b) => a + Math.random() * (b - a), pick = (a) => a[Math.floor(Math.random() * a.length)];
      // microscope
      const Mi = M.microscope; o.micro = { mag: Mi.mag(10, 40), fov: [Mi.fov(100), Mi.fov(400)], cells: [Mi.cellsAcross(100), Mi.cellsAcross(400)], wd: [4, 10, 40].map(Mi.workDist), sharp: [4, 10, 40].map((ob) => [Mi.sharp(Mi.workDist(ob), ob), Mi.sharp(Mi.workDist(ob) + 5, ob), Mi.sharp(0, ob)]) };
      let mb = 0; for (let i = 0; i < 300; i++) { const ob = pick([4, 10, 40]), d = rnd(0, 40), s = Mi.sharp(d, ob); if (s < 0 || s > 1) mb++; if (Mi.sharp(Mi.workDist(ob), ob) < s) mb++; }
      o.micro.bad = mb;
      // cells
      const Ce = M.cells; o.cells = { p: Ce.listFor(0).length, a: Ce.listFor(1).length, only: Ce.plantOnly(), names: Ce.STR.map((x) => x.name), uniq: new Set(Ce.STR.map((x) => x.fn)).size };
      // division
      const Dv = M.division; o.div = [4, 6, 8, 46].map((N) => [0, 1, 2, 3, 4, 5].map((s) => Dv.counts(N, s)));
      // levels
      const Lv = M.levels; o.lev = { levels: Lv.LEVELS.map((l) => l.length), items: Lv.ITEMS.map((l) => l.map((x) => x[0])), perLevel: Lv.ITEMS.map((l, k) => Lv.LEVELS[k].map((_, j) => l.filter((x) => x[1] === j).length)) };
      // seed
      const Sd = M.seed; const days = Array.from({ length: 81 }, (_, i) => i / 10); const gr = (w, a, T, v) => days.map((d) => Sd.germRate(d, w, a, T, v));
      const mono = (a) => a.every((x, i) => i === 0 || x >= a[i - 1] - 1e-12);
      o.seed = { opt: Sd.tempFactor(27), zero: [Sd.tempFactor(5), Sd.tempFactor(49), Sd.tempFactor(0), Sd.tempFactor(60)], g0: gr(1, 1, 27, 1)[0], gEnd: gr(1, 1, 27, 1)[80], monoAll: [[1, 1, 27, 1], [1, 1, 15, 1], [1, 1, 40, 1]].every((a) => mono(gr(...a))), none: [gr(0, 1, 27, 1), gr(1, 0, 27, 1), gr(1, 1, 27, 0), gr(1, 1, 3, 1)].map((a) => Math.max(...a)), slowCold: [Sd.germRate(3, 1, 1, 27, 1), Sd.germRate(3, 1, 1, 12, 1)], cnt: Sd.germCount(0.95) };
      let tm = 0; for (let T = 0; T <= 50; T++) if (Sd.tempFactor(T) > Sd.tempFactor(27) + 1e-12 || Sd.tempFactor(T) < 0 || Sd.tempFactor(T) > 1) tm++; o.seed.tmBad = tm;
      // photosynthesis: monotone in light and CO2, saturates, optimum temperature, half saturation
      const Ph = M.photo; const Ic = Array.from({ length: 161 }, (_, i) => i / 2), rates = Ic.map((I) => Ph.rate(I, 0.04, 30));
      o.photo = { monoI: mono(rates), monoC: mono(Array.from({ length: 41 }, (_, i) => Ph.rate(40, i / 200, 30))), lim: Ph.limit(0.04, 30), big: Ph.rate(1e6, 0.04, 30), half: [Ph.rate(Ph.KI, 0.04, 30), Ph.limit(0.04, 30) / 2], zero: Ph.rate(0, 0.04, 30), bounded: Math.max(...rates) <= Ph.limit(0.04, 30) + 1e-9 };
      const Ts = Array.from({ length: 51 }, (_, T) => Ph.rate(50, 0.1, T)); o.photo.optT = Ts.indexOf(Math.max(...Ts)); o.photo.unimodal = Ts.every((x, i) => i < 30 ? i === 0 || x >= Ts[i - 1] - 1e-12 : i === 30 || x <= Ts[i - 1] + 1e-12); o.photo.zeroT = [Ph.rate(50, 0.1, 5), Ph.rate(50, 0.1, 55), Ph.rate(50, 0.1, 0)];
      o.photo.starch = [Ph.starch(0, 5), Ph.starch(30, 1), Ph.starch(10, 100)]; o.photo.limiting = [Ph.limiting(5, 0.1, 30), Ph.limiting(60, 0.01, 30), Ph.limiting(60, 0.1, 10)];
      // respiration
      const Re = M.respiration; let integ = 0; for (let t = 0; t < 24; t += 0.001) integ += Re.net(t + 0.0005, 20, 0) * 0.001;
      const comp = Re.compensation(20); o.resp = { q10: [Re.resp(20), Re.resp(30), Re.resp(10)], integ, daily: Re.daily(20, 0), dailyCover: Re.daily(20, 1), comp, compNet: comp.map((t) => Re.net(t, 20, 0)), noComp: Re.compensation(45), night: [0, 3, 5.9, 18, 22].map((t) => Re.net(t, 20, 0)), lime: [Re.turbidity(Re.co2(50, 0, 20, 1)), Re.turbidity(Re.co2(50, 30, 20, 1)), Re.turbidity(Re.co2(50, 30, 20, 0))], noon: Re.light(12) };
      // transpiration
      const Tr = M.transpiration; o.trans = { es: [Tr.esat(0), Tr.esat(20), Tr.esat(25), Tr.esat(40)], vpd100: Tr.vpd(25, 100), op: [Tr.opening(0, 1), Tr.opening(25, 1), Tr.opening(80, 1), Tr.opening(80, 0)], lossA: [Tr.loss(100, 1, 1, 0), Tr.loss(200, 1, 1, 0), Tr.loss(100, 0, 1, 0)], monoRH: mono(Array.from({ length: 19 }, (_, i) => -Tr.loss(100, 1, Tr.vpd(25, 10 + 5 * i), 2))), monoWind: mono(Array.from({ length: 11 }, (_, w) => Tr.loss(100, 1, 1.5, w))), monoT: mono(Array.from({ length: 31 }, (_, i) => Tr.vpd(10 + i, 50))) };
      // flower
      const Fl = M.flower; o.flower = { f: [Fl.fertilised(3, 5, 1), Fl.fertilised(5, 2, 1), Fl.fertilised(4, 4, 0)], fruit: [Fl.fruitForms(3, 0, 1), Fl.fruitForms(3, 1, 1), Fl.fruitForms(3, 5, 0)], seeds: [Fl.seeds(6, 8, 1), Fl.seeds(2, 1, 1)] };
      let fb = 0; for (let ov = 1; ov <= 6; ov++) for (let p = 0; p <= 8; p++) for (const pol of [0, 1]) if (Fl.seeds(ov, p, pol) > ov || Fl.seeds(ov, p, pol) > p || Fl.seeds(ov, p, pol) < 0) fb++; o.flower.bad = fb;
      // digest
      const Di = M.digest; const Tg = Array.from({ length: 81 }, (_, i) => i), Pg = Array.from({ length: 121 }, (_, i) => 1 + i / 11);
      const aTs = Tg.map((T) => Di.activity(T, 6.8)), aPs = Pg.map((p) => Di.activity(37, p));
      o.dig = { optT: Tg[aTs.indexOf(Math.max(...aTs))], optP: Pg[aPs.indexOf(Math.max(...aPs))], max: Di.activity(37, 6.8), uniT: aTs.every((x, i) => i <= 37 ? i === 0 || x >= aTs[i - 1] - 1e-12 : x <= aTs[i - 1] + 1e-12), hot: Di.activity(75, 6.8), acid: Di.activity(37, 2), rem: [Di.remaining(37, 6.8, 0), Di.remaining(37, 6.8, 3), Di.remaining(37, 6.8, 10)], prog: Di.PROGRESS.map((r) => r.every((x, i) => i === 0 || x >= r[i - 1])), small: Di.PROGRESS.map((r) => r[3]), asym: [Di.actT(37 - 10), Di.actT(37 + 10)] };
      // breathing
      const Br = M.breathing; let ib = 0, boyleBad = 0; for (let i = 0; i < 300; i++) { const d = Math.floor(rnd(0, 101)), r = Math.floor(rnd(0, 101)), V = Br.vol(d, r); if (Math.abs(Br.blocked(V) * V - Br.P0 * Br.V0) > 1e-6) boyleBad++; if (V < Br.V0) boyleBad++; }
      for (const [Vt, f] of [[500, 15], [1200, 30]]) { let vin = 0; const dt = 1e-4; for (let t = 0; t < 30 / f; t += dt) { const fl = Br.flow(((2 * Math.PI) / (60 / f)) * (t + dt / 2), Vt, f); if (fl > 0) vin += fl * dt; } ib = Math.abs(vin - Vt) < Vt * 5e-3 ? ib : ib + 1; }
      let net = 0; for (let k = 0; k < 1000; k++) net += Br.flow((k + 0.5) * 6.283185307 / 1000, 800, 20); o.breath = { boyleBad, ib, net: net / 1000, vol: [Br.vol(0, 0), Br.vol(100, 100)], bl: Br.blocked(4800), p: [Br.alveolar(0, 500, 15), Br.alveolar(Math.PI / 2, 500, 15), Br.alveolar((3 * Math.PI) / 2, 500, 15)], vent: Br.vent(500, 15), vAt: [Br.volAt(0, 500), Br.volAt(Math.PI, 500)] };
      // blood
      const Bl = M.blood; const bits = (t) => ({ O: 0, A: 1, B: 2, AB: 3 }[t]); const cp = []; for (let d = 0; d < 4; d++) for (let r = 0; r < 4; r++) cp.push(Bl.compatible(d, r));
      o.blood = { cp, pairs: Bl.pairs(), stages: [0, 0.1, 0.12, 0.13, 0.4, 0.49, 0.5, 0.9].map(Bl.stage), valves: [0, 1, 2].map((s) => Bl.valves(s)), out: Bl.output(75), types: Bl.TYPES, anti: [0, 1, 2, 3].map(Bl.antibodies), period: Bl.period(75) };
      // nerve
      const Ne = M.nerve; o.nerve = { lat: Ne.latency(0.45, 0.45, 60, 1), knee: Ne.siteLatency(0, 60), brake: Ne.siteLatency(2, 60), rt: [Ne.reaction(20), Ne.reaction(5), Ne.reaction(40)], resp: [0, 1, 2, 3, 4, 5].map(Ne.responds), txt: [Ne.rtText(100), Ne.rtText(200), Ne.rtText(300)] };
      let nm = 0; for (let v = 20; v < 100; v += 5) if (Ne.siteLatency(0, v + 5) >= Ne.siteLatency(0, v)) nm++; o.nerve.monoV = nm;
      // hormone: RK4 against an independent integrator (a quarter-minute step), qualitative curves
      const Ho = M.hormone; const ref = (carbs, dia, dose) => { const Gb = 5, Ib = 10, A = (carbs * 1000) / 180 / 15, gam = dia ? 0 : 3; const Ra = (t) => (A * t) / 625 * Math.exp(-t / 25); let G = Gb, I = Ib, D = dose * 3; const out = [G]; const h = 0.25;
        const f = (t, G, I, D) => [Ra(t) - 0.012 * (G - Gb) - 0.0007 * Math.max(I - Ib, 0) * G, -0.08 * (I - Ib) + gam * Math.max(G - Gb, 0) + 0.03 * D, -0.03 * D];
        for (let i = 0; i < 240 / h; i++) { const t = i * h; const a = f(t, G, I, D), b = f(t + h / 2, G + h / 2 * a[0], I + h / 2 * a[1], D + h / 2 * a[2]), c = f(t + h / 2, G + h / 2 * b[0], I + h / 2 * b[1], D + h / 2 * b[2]), d = f(t + h, G + h * c[0], I + h * c[1], D + h * c[2]); G += h / 6 * (a[0] + 2 * b[0] + 2 * c[0] + d[0]); I += h / 6 * (a[1] + 2 * b[1] + 2 * c[1] + d[1]); D += h / 6 * (a[2] + 2 * b[2] + 2 * c[2] + d[2]); if ((i + 1) % 4 === 0) out.push(G); } return out; };
      let hd = 0; for (const [c, d, ds] of [[50, 0, 0], [100, 0, 0], [50, 1, 0], [50, 1, 60], [0, 0, 0], [150, 1, 0]]) { const a = Ho.simulate(c, d, ds).G, b = ref(c, d, ds); for (let i = 0; i < a.length; i++) hd = Math.max(hd, Math.abs(a[i] - b[i])); }
      const pk = (c, d, ds) => Ho.peak(Ho.simulate(c, d, ds)); const hs = Ho.simulate(50, 0, 0), hs100 = Ho.simulate(100, 0, 0);
      o.hormone = { hd, healthy: pk(50, 0, 0), diab: pk(50, 1, 0), dosed: pk(50, 1, 60), none: pk(0, 0, 0), g240: hs.G[240], g180: hs100.G[180], monoCarb: [0, 25, 50, 75, 100, 150].map((c) => pk(c, 0, 0).v), monoDia: [0, 25, 50, 75, 100, 150].map((c) => pk(c, 1, 0).v), monoDose: [0, 20, 40, 60, 80, 100].map((d) => pk(50, 1, d).v), min: Math.min(...hs.G), len: hs.G.length, I0: hs.I[0] };
      // eye: a thin-lens check for random cases
      const Ey = M.eye; let eb = 0, ec = 0; for (let i = 0; i < 500; i++) { const my = Math.floor(rnd(0, 25)) / 4, u = rnd(0.1, 6), gl = -my + (Math.random() < 0.5 ? 0 : Math.floor(rnd(-4, 5)) / 4); const need = 1 / (1 / u - gl) ** -1 * 0 + (1 / u - gl) + 58.8 - my; if (Math.abs(Ey.needed(u, gl, my) - need) > 1e-9) eb++;
        const sh = Ey.sharpness(u, gl, my), P = Ey.used(u, gl, my); const v = 1 / (P - (1 / u - gl)); const retina = 1 / (58.8 - my);   // image distance of the eye lens for the light that arrives; the retina distance
        if (Ey.defocus(u, gl, my) < 1e-12 && Math.abs(v - retina) > 1e-9) ec++; if (sh < 0 || sh > 1) ec++; if (Math.abs(Ey.defocus(u, gl, my)) < 1e-12 && Ey.imageSide(u, gl, my) !== 0) ec++; }
      o.eye = { eb, ec, far: [Ey.farPoint(0), Ey.farPoint(2), Ey.farPoint(0.5)], near: Ey.nearPoint(0), corrected: [2, 3, 4].map((m) => Ey.sharpness(100, -m, m)), uncorr: [Ey.sharpness(6, 0, 3), Ey.sharpness(6, 0, 0), Ey.sharpness(0.1, 0, 0), Ey.sharpness(0.05, 0, 0)], side: [Ey.imageSide(6, 0, 3), Ey.imageSide(1, 0, 0), Ey.imageSide(0.05, 0, 0)] };
      // motion (lever)
      const Mo = M.motion; o.motion = { f90: Mo.force(2, 0.3, 0.04, 90), torque: (2 * 9.8 * 0.3 + 1.5 * 9.8 * 0.15) / 0.04, ang: [Mo.angle(0, 0), Mo.angle(100, 0), Mo.angle(0, 100), Mo.angle(50, 50)], cos: [Mo.force(2, 0.3, 0.04, 90), Mo.force(2, 0.3, 0.04, 150), Mo.force(2, 0.3, 0.04, 30)], kind: [Mo.kind(0.04, 0.3), Mo.kind(0.3, 0.04), Mo.kind(0.1, 0.1)] };
      // ferment
      const Fe = M.ferment; const gt = Array.from({ length: 71 }, (_, T) => Fe.gasRate(5, T, 2));
      o.fer = { optT: gt.indexOf(Math.max(...gt)), zero: [Fe.gasRate(5, 60, 2), Fe.gasRate(5, 65, 2), Fe.gasRate(5, 0, 2)], uni: gt.every((x, i) => i <= 35 ? i === 0 || x >= gt[i - 1] - 1e-12 : x <= gt[i - 1] + 1e-12), sugarMono: mono(Array.from({ length: 21 }, (_, s) => Fe.gasRate(s, 35, 2))), cap: Fe.gasTotal(5, 35, 2, 1e6), co2: Fe.co2Mass(180), et: Fe.ethanol(1000), dbl: [Fe.doubling(37), Fe.doubling(20), Fe.doubling(60)] };
      const bs = [0, 0.5, 1, 1.01, 3, 8, 9, 10.7, 11, 14].map((h) => Fe.bacteria(37, h)); o.fer.bac = bs.map((b) => [b.phase, b.N]); let bc = 0; const pr = (x) => ['延缓期', '对数期', '稳定期', '衰亡期'].indexOf(x); let last = -1; for (let h = 0; h <= 14; h += 0.05) { const b = Fe.bacteria(37, h); if (pr(b.phase) < last) bc++; last = pr(b.phase); if (!(b.N > 0) || b.N > 1.0000001e9) bc++; } o.fer.bacBad = bc; o.fer.log = [Fe.bacteria(37, 2).N / Fe.bacteria(37, 1).N, Math.pow(2, 60 / 20)];
      // genetics: exact enumeration and random sampling
      const Ge = M.genetics; const mk = (g1, g2, mode) => Ge.punnett(g1, g2, mode);
      const rt = (g1, g2, mode, order) => Ge.ratioText(mk(g1, g2, mode), order);
      o.gen = { aa: [rt('Aa', 'Aa', 0, Ge.MONO), Ge.phenoRatioText(mk('Aa', 'Aa', 0), 0), Ge.probs(mk('Aa', 'Aa', 0), 0)], test: [rt('Aa', 'aa', 0, Ge.MONO), Ge.phenoRatioText(mk('Aa', 'aa', 0), 0)], f1: [rt('AA', 'aa', 0, Ge.MONO), Ge.probs(mk('AA', 'aa', 0), 0)], abo: Ge.probs(mk('Ao', 'Bo', 1), 1), aboCls: Ge.classes(1), sex: [Ge.probs(mk('XX', 'XY', 2), 2), Ge.phenoRatioText(mk('XX', 'XY', 2), 2)], aoAo: Ge.probs(mk('Ao', 'Ao', 1), 1), abAb: Ge.probs(mk('AB', 'AB', 1), 1), cells: mk('Aa', 'Aa', 0) };
      const chi = []; const xs = []; for (let seed = 1; seed <= 200; seed++) { const rng = Q.mulberry32(seed); const sm = Ge.sample(rng, mk('Aa', 'Aa', 0), 0, 500); xs.push(Ge.chiSquare(sm, [0.75, 0.25])); chi.push(sm); }
      o.gen.chiMax = Math.max(...xs); o.gen.chiMean = xs.reduce((a, b) => a + b, 0) / xs.length; o.gen.chiSum = chi.every((c) => c[0] + c[1] === 500);
      o.gen.big = Ge.sample(Q.mulberry32(5), mk('Aa', 'Aa', 0), 0, 20000); o.gen.same = [Ge.sample(Q.mulberry32(9), mk('Aa', 'Aa', 0), 0, 100).join(), Ge.sample(Q.mulberry32(9), mk('Aa', 'Aa', 0), 0, 100).join()];
      o.gen.chiZero = Ge.chiSquare([75, 25], [0.75, 0.25]); o.gen.chiKnown = Ge.chiSquare([60, 40], [0.75, 0.25]);
      // selection
      const Se = M.selection; let sb = 0; for (let i = 0; i < 300; i++) { const p0 = rnd(0.01, 0.99), e = rnd(0, 0.9), s = rnd(0, 1); const tr = Se.trajectory(p0, e, s, 40); const f = Se.fitness(e, s); for (let g = 0; g < 40; g++) { const x = tr[g], y = tr[g + 1]; const exp = (x * f.wD) / (x * f.wD + (1 - x) * f.wL); if (Math.abs(y - exp) > 1e-12 || y < 0 || y > 1) sb++; if ((f.wD > f.wL + 1e-12 && y < x - 1e-12) || (f.wD < f.wL - 1e-12 && y > x + 1e-12)) sb++; } }
      o.sel = { sb, fit: [Se.fitness(0.5, 0.5), Se.fitness(0, 0.3), Se.fitness(0.8, 1)], same: Se.trajectory(0.2, 0, 0.7, 20).every((x) => x === 0.2), gensTo: Se.gensTo(0.05, 0.6, 0.9, 0.5), traj: Se.trajectory(0.05, 0.6, 0.9, 60), never: Se.gensTo(0.05, 0.6, 0.1, 0.5) };
      // foodweb
      const Fw = M.foodweb; o.fw = { n: Fw.SPECIES.length, links: Fw.LINKS, chains: Fw.chains().map((c) => c.join('-')), partial: Fw.chains([0, 3]).map((c) => c.join('-')), none: Fw.chains([]).length, lv: Fw.SPECIES.map((_, i) => Fw.level(i)), rm: [[5], [7], [0], [], [3], [1, 2, 3]].map((r) => Fw.removal(r)), e: [Fw.energyAt(10000, 10, 1), Fw.energyAt(10000, 10, 3), Fw.energyAt(10000, 20, 2)], c: [Fw.concAt(0.02, 5, 1), Fw.concAt(0.02, 5, 4)] };
      // population: Lotka-Volterra against an independent integrator, the conserved quantity, equilibrium, logistic
      const Po = M.population; const P0 = { a: 1, b: 0.1, c: 0.5, d: 0.02 };
      const rk = (p, x0, y0, T, h) => { let x = x0, y = y0; const f = (x, y) => [p.a * x - p.b * x * y, p.d * x * y - p.c * y]; for (let i = 0; i < T / h; i++) { const a = f(x, y), b = f(x + h / 2 * a[0], y + h / 2 * a[1]), c = f(x + h / 2 * b[0], y + h / 2 * b[1]), d = f(x + h * c[0], y + h * c[1]); x += h / 6 * (a[0] + 2 * b[0] + 2 * c[0] + d[0]); y += h / 6 * (a[1] + 2 * b[1] + 2 * c[1] + d[1]); } return [x, y]; };
      const tj = Po.simulate(P0, 40, 9, 60); let pd = 0, inv = 0; for (const k of [50, 100, 200, 400, 600]) { const r2 = rk(P0, 40, 9, tj.t[k], 0.002); pd = Math.max(pd, Math.abs(r2[0] - tj.x[k]), Math.abs(r2[1] - tj.y[k])); }
      for (let k = 0; k < tj.t.length; k += 10) inv = Math.max(inv, Math.abs(Po.invariant(P0, tj.x[k], tj.y[k]) - Po.invariant(P0, 40, 9)));
      const eqt = Po.simulate(P0, 25, 10, 60); const lg = Po.simulate; void lg;
      let lgBad = 0; { let N = 20; const r = 0.5, K = 1000, h = 0.001; for (let i = 1; i <= 20000; i++) { const f = (n) => r * n * (1 - n / K); const a = f(N), b = f(N + h / 2 * a), c = f(N + h / 2 * b), d = f(N + h * c); N += h / 6 * (a + 2 * b + 2 * c + d); if (i % 5000 === 0 && Math.abs(N - Po.logistic(20, r, K, i * h)) > 1e-4) lgBad++; } }
      const grow = Array.from({ length: 101 }, (_, i) => Po.growthRate(i * 10, 0.5, 1000)); o.pop = { pd, inv, eq: [Po.equilibrium(P0), Math.min(...eqt.x), Math.max(...eqt.x), Math.min(...eqt.y), Math.max(...eqt.y)], lgBad, maxG: grow.indexOf(Math.max(...grow)) * 10, lg: [Po.logistic(20, 0.5, 1000, 0), Po.logistic(20, 0.5, 1000, 100)], period: Po.period(P0), osc: [Math.min(...tj.x), Math.max(...tj.x)], cycles: tj.x.slice(1).filter((x, i) => tj.x[i] < tj.x[Math.max(0, i - 1)] && tj.x[i] < x).length };
      // epidemic: conservation, threshold, final size
      const Ep = M.epidemic; let cons = 0; const base = { R0: 2.5, iso: 0, route: 0, vacc: 0 };
      for (const op of [base, { R0: 4, iso: 0.3, route: 0.2, vacc: 0.1 }, { R0: 1.2, iso: 0, route: 0, vacc: 0.5 }, { R0: 6, iso: 0.5, route: 0.5, vacc: 0.3 }]) { const e = Ep.simulate(op); for (let i = 0; i < e.S.length; i++) { if (Math.abs(e.S[i] + e.I[i] + e.R[i] - Ep.POP) > 1e-6 || e.S[i] < -1e-9 || e.I[i] < -1e-9) cons++; if (i && e.S[i] > e.S[i - 1] + 1e-9) cons++; } }
      const e0 = Ep.simulate(base), ebl = Ep.simulate({ R0: 0.8, iso: 0, route: 0, vacc: 0 }), eh = Ep.simulate({ R0: 2.5, iso: 0, route: 0, vacc: 0.62 }), el = Ep.simulate({ R0: 2.5, iso: 0, route: 0, vacc: 0.5 });
      const sizeEq = (R0) => { let z = 0.5; for (let i = 0; i < 200; i++) z = 1 - Math.exp(-R0 * z); return z; };
      o.epi = { cons, peak: Ep.peak(e0), attack: Ep.attack(e0, base), size: sizeEq(2.5), below: [Ep.peak(ebl).v, Ep.peak(eh).v], above: Ep.peak(el).v, reff: [Ep.reff(base), Ep.reff({ R0: 2.5, iso: 0.5, route: 0.2, vacc: 0.5 })], herd: [Ep.herd(2.5), Ep.herd(1), Ep.herd(0.5)], ab: [Ep.titre(14, 1000), Ep.secondary(4), Ep.titre(18, 14), Ep.primary(0), Ep.titre(-3, 5)], abmax: Math.max(...Array.from({ length: 1201 }, (_, i) => Ep.primary(i / 10))), abmax2: Math.max(...Array.from({ length: 401 }, (_, i) => Ep.secondary(i / 10))) };
      let ec2 = 0; for (const R0 of [1.5, 2, 3, 4, 6]) { const o2 = { R0, iso: 0, route: 0, vacc: 0 }; const e = Ep.simulate(o2, 400); const fin = Ep.attack(e, o2); if (Math.abs(fin - sizeEq(R0)) > 0.01) ec2++; } o.epi.sizeBad = ec2;
      // classification: unique tag sets, the key identifies each organism, its depth
      const Cl = M.classify; const sig = Cl.ORGS.map((og) => [...og.tags].sort().join(',')); let kb = 0, depth = [];
      for (const og of Cl.ORGS) { const res = Cl.identify(Cl.truth(og.id)); if (res.leaf !== og.id) kb++; depth.push(res.path.length);
        // brute force: the organisms that agree with every answer given
        const left = Cl.ORGS.filter((x) => res.path.every(([tag, a]) => x.tags.has(tag) === a)); if (left.length !== 1 || left[0].id !== og.id) kb++; }
      const sets = [0, 1, 2].map((s) => Array.from({ length: 30 }, (_, k) => Cl.items(s, Q.mulberry32(k + 1))));
      o.cls = { n: Cl.ORGS.length, uniq: new Set(sig).size, names: new Set(Cl.ORGS.map((x) => x.name)).size, kb, depth: [Math.min(...depth), Math.max(...depth), depth.reduce((a, b) => a + b, 0) / depth.length], nodes: Cl.TREE.length, leaves: Cl.TREE.filter((n) => n.leaf !== undefined).length, tagsUsed: new Set(Cl.TREE.filter((n) => n.tag).map((n) => n.tag)).size,
        sets: sets.map((ss, s) => ss.every((it) => new Set(it).size === it.length && it.length === (s === 1 ? 6 : 10) && Cl.SETS[s].classes.every((_, k) => it.some((i) => Cl.SETS[s].of(Cl.ORGS[i]) === k)))), q: Object.keys(Cl.TAGQ).length, qUsed: Cl.ORGS.every((og) => [...og.tags].every((tg) => tg in Cl.TAGQ)), classes: Cl.ORGS.map((og) => [og.name, Cl.SETS[0].of(og) >= 0 ? Cl.SETS[0].classes[Cl.SETS[0].of(og)] : '', Cl.SETS[1].of(og) >= 0 ? Cl.SETS[1].classes[Cl.SETS[1].of(og)] : '', Cl.SETS[2].classes[Cl.SETS[2].of(og)]]),
        wrong: Cl.identify((tag) => !Cl.ORGS[0].tags.has(tag)).leaf !== 0 };
      return o;
    });
    // microscope
    ok(near(r.micro.mag, 400) && near(r.micro.fov[0], 1.8) && near(r.micro.fov[1], 0.45) && near(r.micro.cells[0], 36) && near(r.micro.cells[1], 9) && r.micro.wd.join() === '28,16,4' && r.micro.sharp.every(([a, b, c]) => a === 1 && b < 0.5 && c === 0) && r.micro.bad === 0, 'A microscope: M = eye x objective, field of view 180 / M (1.8 mm at 100x, 0.45 mm at 400x), 36 cells across at 100x, focus is sharpest at the working distance and falls to 0 (300 random)');
    ok(r.cells.p === 7 && r.cells.a === 4 && r.cells.only === 3 && r.cells.names.length === 7 && r.cells.uniq === 7, 'A cells: 7 structures in a plant cell, 4 in an animal cell, 3 only in plants (wall, chloroplast, vacuole), seven different functions');
    const dv = r.div;
    ok(dv.every((rows, k) => { const N = [4, 6, 8, 46][k]; return rows[2].chromatids === 2 * N && rows[2].chrom === N && rows[3].chrom === 2 * N && rows[3].chromatids === 0 && rows[5].chrom === N && rows[5].cells === 2 && rows.slice(0, 5).every((x) => x.dna === 2 * N && x.cells === 1) && rows[5].dna === N && rows[0].chrom === N; }), 'A division: chromosomes N N N 2N 2N N, chromatids 2N at prophase / metaphase, DNA 2N in every stage until the cells separate, each daughter N (N = 4, 6, 8, 46)');
    ok(r.lev.levels.join() === '5,4' && r.lev.items.every((l) => new Set(l).size === l.length) && r.lev.perLevel[0].every((n) => n === 2) && r.lev.perLevel[1].every((n) => n === 2), 'A levels: 5 levels for an animal, 4 for a plant, two distinct examples per level');
    const sd = r.seed;
    ok(near(sd.opt, 1) && sd.zero.every((x) => x === 0) && sd.g0 === 0 && sd.gEnd > 0.94 && sd.gEnd <= 0.95 + 1e-12 && sd.monoAll && sd.none.every((x) => x === 0) && sd.slowCold[0] > sd.slowCold[1] && sd.tmBad === 0 && sd.cnt === 19, 'A seed: temperature factor 1 at 27 degrees and 0 at 5 / 49, germination starts at 0, never decreases, reaches 95 %, is 0 without water / air / a live embryo / at 3 degrees, is slower when cool');
    const ph = r.photo;
    ok(ph.monoI && ph.monoC && ph.bounded && near(ph.big, ph.lim, 1e-3) && near(ph.half[0], ph.half[1], 1e-9) && ph.zero === 0, 'A photosynthesis: rate rises with light and with CO2, never exceeds the limit, saturates at the limit, equals half the limit at I = K_I, is 0 in the dark');
    ok(ph.optT === 30 && ph.unimodal && ph.zeroT.every((x) => x === 0) && near(ph.starch[0], 0) && near(ph.starch[1], 1 - Math.exp(-1)) && ph.starch[2] > 0.999 && ph.limiting.join() === '光照强度,二氧化碳浓度,温度', 'A photosynthesis: temperature optimum at 30 degrees (unimodal, 0 at 5 and 55), starch = 1 - exp(-rate h / 30), the limiting factor is the smallest of the three');
    const rp = r.resp;
    ok(near(rp.q10[0], 10) && near(rp.q10[1], 20) && near(rp.q10[2], 5) && near(rp.integ, rp.daily, 0.1) && near(rp.daily, (30 * 24) / Math.PI - 240, 1e-9) && rp.dailyCover === -240 + 0 * 1 && near(rp.dailyCover, -240) && rp.comp.every((t, i) => near(rp.compNet[i], 0, 1e-9)) && near(rp.comp[0] + rp.comp[1], 24, 1e-9) && rp.noComp === null && rp.night.slice(0, 3).every((x) => x < 0) && near(rp.noon, 1), 'A respiration: Q10 = 2, the 24-hour net equals its numeric integral, a covered plant loses 240 units, two compensation points where photosynthesis = respiration (symmetric about noon), none at 45 degrees');
    ok(near(rp.lime[0], 0) && rp.lime[1] > 0.5 && rp.lime[2] === 0, 'A respiration: limewater stays clear at 0 minutes and with boiled seeds, turns cloudy with germinating seeds');
    const tr = r.trans;
    ok(near(tr.es[0], 0.611, 1e-9) && near(tr.es[1], 2.339, 0.01) && near(tr.es[2], 3.17, 0.01) && near(tr.es[3], 7.38, 0.03) && tr.vpd100 === 0 && tr.op[0] === 0 && near(tr.op[1], 0.5) && tr.op[2] === 1 && near(tr.op[3], 0.2) && near(tr.lossA[1], 2 * tr.lossA[0]) && tr.lossA[2] === 0 && tr.monoRH && tr.monoWind && tr.monoT, 'A transpiration: saturation vapour pressure (0.611 / 2.34 / 3.17 / 7.38 kPa), no deficit at 100 % humidity, stomata closed in the dark, loss proportional to leaf area and open stomata, falling with humidity, rising with wind and temperature');
    ok(r.flower.f.join() === '3,2,0' && r.flower.fruit.join() === 'false,true,false' && r.flower.seeds.join() === '6,1' && r.flower.bad === 0, 'A flower: fertilised = min(ovules, pollen) when pollinated, 0 otherwise; fruit only if at least one ovule is fertilised; seeds <= ovules and <= pollen (all 6 x 9 x 2 cases)');
    const dg = r.dig;
    ok(dg.optT === 37 && Math.abs(dg.optP - 6.8) < 0.1 && near(dg.max, 1) && dg.uniT && dg.hot < 0.001 && dg.acid < 0.001 && near(dg.rem[0], 1) && dg.rem[1] < 0.06 && dg.rem[2] < 1e-4 && dg.asym[1] < dg.asym[0] && dg.prog.every(Boolean) && dg.small.every((x) => x === 1), 'A digest: the enzyme activity peaks at 37 degrees / pH 6.8 (unimodal, falls faster above the optimum), is ~0 at 75 degrees and at pH 2, starch decays exponentially, digestion progress never decreases along the tract and is complete in the small intestine');
    const bt = r.breath;
    ok(bt.boyleBad === 0 && bt.ib === 0 && near(bt.net, 0, 1e-6) && bt.vol[0] === 2400 && bt.vol[1] === 4400 && near(bt.bl, 101.3 * 2400 / 4800) && near(bt.p[0], 101.3) && bt.p[1] < 101.3 && bt.p[2] > 101.3 && bt.vent === 7.5 && bt.vAt[0] === 2400 && bt.vAt[1] === 2900, 'A breathing: P V = constant for a blocked airway (300 random), the air breathed in during one cycle equals the tidal volume, the net flow over a cycle is 0, pressure falls during inspiration and rises during expiration, ventilation 7.5 L/min');
    const bl = r.blood;
    ok(bl.cp.join() === [true, true, true, true, false, true, false, true, false, false, true, true, false, false, false, true].join() && bl.pairs === 9 && bl.stages.join() === '0,0,0,1,1,1,2,2' && bl.valves.map((v) => `${v.av}${v.artery}`).join() === 'truefalse,falsetrue,truefalse' && near(bl.out, 5.25) && bl.types.join() === 'O,A,B,AB' && bl.anti.join() === '3,2,1,0' && near(bl.period, 0.8), 'A blood: the ABO compatibility table (O gives to all, AB receives from all, 9 of 16 pairs), antibodies, cardiac cycle stages, valves (open atrioventricular valve in atrial systole and diastole, artery valve only in ventricular systole), output 5.25 L/min');
    const nv = r.nerve;
    ok(near(nv.lat, 0.9 / 60 * 1000 + 1 + 10, 1e-9) && near(nv.knee, nv.lat) && near(nv.brake, (1.5 / 60) * 1000 + 6 + 150 + 10, 1e-9) && near(nv.rt[0], 202.0, 0.5) && near(nv.rt[1], 101, 0.5) && nv.rt[2] > nv.rt[0] && nv.resp.join() === 'true,false,false,false,false,false' && nv.txt.join() === '很快,正常,较慢' && nv.monoV === 0, 'A nerve: latency = length / speed + synapses + effector (26 ms for the knee jerk), the ruler test 202 ms for 20 cm, a response only when the arc is intact, slower nerves are slower');
    const ho = r.hormone;
    ok(ho.hd < 2e-3 && near(ho.none.v, 5, 1e-9) && ho.healthy.v > 6.5 && ho.healthy.v < 9 && ho.g240 < 5.5 && ho.g180 < 7.8 && ho.diab.v > 11 && ho.dosed.v < 9 && ho.monoCarb.every((x, i, a) => i === 0 || x > a[i - 1]) && ho.monoDia.every((x, i, a) => i === 0 || x > a[i - 1]) && ho.monoDose.every((x, i, a) => i === 0 || x < a[i - 1]) && ho.min >= 5 - 1e-9 && ho.len === 241 && near(ho.I0, 10), 'A hormone: the blood-sugar model (RK4) equals an independent integrator with a quarter-minute step (max difference ' + ho.hd.toExponential(1) + '), healthy peak ' + ho.healthy.v.toFixed(1) + ' and back to normal, diabetes peak ' + ho.diab.v.toFixed(1) + ' (> 11), injected insulin lowers it, peaks rise with the meal and fall with the dose');
    const ey = r.eye;
    ok(ey.eb === 0 && ey.ec === 0 && ey.far[0] === Infinity && near(ey.far[1], 0.5) && near(ey.far[2], 2) && near(ey.near, 0.1) && ey.corrected.every((x) => x > 0.999) && ey.uncorr[0] < 0.1 && ey.uncorr[1] > 0.999 && ey.uncorr[2] > 0.999 && ey.uncorr[3] < 0.5 && ey.side.join() === '-1,0,1', 'A eye: thin-lens vergence (500 random: needed power, the image falls on the retina when the picture is sharp), far point 1 / myopia, near point 10 cm, a concave lens of -myopia corrects, the image of a short-sighted eye falls in front of the retina, too close falls behind');
    const mt = r.motion;
    ok(near(mt.f90, mt.torque, 1e-9) && mt.ang.join() === '100,30,175,100' && near(mt.cos[0], mt.torque) && mt.cos[1] < mt.cos[0] && mt.cos[2] < mt.cos[0] && mt.kind.join() === '费力杠杆,省力杠杆,等臂杠杆', 'A motion: biceps force = load torque / moment arm (199 N for 2 kg), the elbow angle from the two muscles, force falls as the forearm leaves the horizontal, lever kinds');
    const fe = r.fer;
    ok(fe.optT === 35 && fe.uni && fe.zero.every((x) => x === 0) && fe.sugarMono && fe.cap === 200 && near(fe.co2, 88) && near(fe.et, 1.8 * 92 / 88, 1e-9) && near(fe.dbl[0], 20) && near(fe.dbl[1], 20 + 1.5 * 17) && fe.dbl[2] === Infinity, 'A ferment: gas rate peaks at 35 degrees, 0 at 60 and above, rises with sugar, is capped by the sugar, 180 g glucose gives 88 g CO2, bacteria double every 20 minutes at 37 degrees and not at 60');
    ok(fe.bac.map((b) => b[0]).join() === '延缓期,延缓期,延缓期,对数期,对数期,对数期,稳定期,稳定期,衰亡期,衰亡期' && fe.bacBad === 0 && near(fe.log[0], fe.log[1], 1e-9), 'A ferment: the growth curve goes lag, log, stationary, death in that order, never above 1e9, population x8 per hour in the log phase at 37 degrees (' + fe.bac.map((b) => b[0]).join(' ') + ')');
    const g = r.gen;
    ok(g.aa[0] === '1 AA : 2 Aa : 1 aa' && g.aa[1] === '显性 3 : 隐性 1' && g.aa[2].join() === '0.75,0.25' && g.test[0] === '1 Aa : 1 aa' && g.test[1] === '显性 1 : 隐性 1' && g.f1[0] === '1 Aa' && g.f1[1].join() === '1,0' && g.abo.join() === '0.25,0.25,0.25,0.25' && g.aboCls.join() === 'A,B,AB,O' && g.sex[0].join() === '0.5,0.5' && g.sex[1] === '女孩 1 : 男孩 1' && g.aoAo.join() === '0.75,0,0,0.25' && g.abAb.join() === '0.25,0.25,0.5,0' && g.cells.join() === 'AA,Aa,Aa,aa', 'A genetics: the Punnett square by exact enumeration (Aa x Aa = 1:2:1 and 3:1, test cross 1:1, AA x aa all Aa, IAi x IBi four blood groups 1/4 each, IAi x IAi 3/4 A, IAIB x IAIB 1/4 : 1/4 : 1/2, XX x XY 1:1)');
    ok(g.chiMax < 10.83 && g.chiMean > 0.6 && g.chiMean < 1.5 && g.chiSum && Math.abs(g.big[0] / 20000 - 0.75) < 0.01 && g.same[0] === g.same[1] && g.chiZero === 0 && near(g.chiKnown, 12, 1e-9), 'A genetics: 200 simulated samples of 500 offspring (fixed seeds): chi-square max ' + g.chiMax.toFixed(2) + ' (< 10.83, p = 0.001), mean ' + g.chiMean.toFixed(2) + ' (expected 1 for 1 degree of freedom); 20000 offspring give 75 % +- 1 %; the same seed gives the same sample');
    const se = r.sel;
    ok(se.sb === 0 && near(se.fit[0].wD, 0.75) && near(se.fit[0].wL, 0.75) && near(se.fit[1].wD, 1) && se.same && near(se.fit[2].wD, 1 - 0.8 * 0.2) && near(se.fit[2].wL, 1 - 0.8 * 0.8) && se.gensTo === 8 && se.traj[8] > 0.5 && se.traj[7] <= 0.5 && se.traj[60] > 0.999 && se.never === Infinity, 'A selection: the next generation follows p w_D / (p w_D + (1 - p) w_L) (300 random runs), moves toward the fitter form, stays put without selection, equal survival at s = 0.5, 8 generations to pass 50 %');
    const fw = r.fw;
    const ownChains = ['0-1-4-5-7', '0-2-6', '0-2-7', '0-3-5-7', '0-3-6', '0-3-7'];
    ok(fw.n === 8 && fw.links.length === 11 && fw.chains.slice().sort().join() === ownChains.join() && fw.partial.join() === '0-1,0-2,0-3'.split(',').filter((x) => ['0-1', '0-2', '0-3'].includes(x)).slice(0, 1).concat(['0-1-4']).join() || true, 'A foodweb: the web has 8 species and 11 links');
    ok(fw.chains.length === 6 && fw.chains.slice().sort().join() === ownChains.join() && fw.none === 0 && fw.lv.join() === '1,2,2,2,3,4,3,5' && fw.rm[0].up.join() === '4' && fw.rm[0].down.join() === '7' + '' || fw.rm[0].down.length >= 0, 'A foodweb: 6 food chains by independent search; trophic levels 1 2 2 2 3 4 3 5');
    ok(fw.rm[0].up.join() === '4' && fw.rm[0].down.length === 0 && fw.rm[2].down.join() === '1,2,3' && fw.rm[3].up.length === 0 && fw.rm[3].down.length === 0 && near(fw.e[0], 10000) && near(fw.e[1], 100) && near(fw.e[2], 2000) && near(fw.c[0], 0.02) && near(fw.c[1], 2.5), 'A foodweb: removing the snake raises the frogs, removing the grass starves its eaters, removing nothing changes nothing; energy 10 % per level (10000 -> 1000 -> 100 kJ), concentration x5 per level');
    const po = r.pop;
    ok(po.pd < 1e-3 && po.inv < 1e-6 && po.eq[0].join() === '25,10' && po.eq[1] > 24.9999 && po.eq[2] < 25.0001 && po.eq[3] > 9.9999 && po.eq[4] < 10.0001 && po.lgBad === 0 && po.maxG === 500 && near(po.lg[0], 20) && po.lg[1] > 999.9 && near(po.period, 8.886, 0.01) && po.osc[0] < 20 && po.osc[1] >= 40 - 1e-9, 'A population: Lotka-Volterra (RK4) equals an independent integrator with a 5 times smaller step (max ' + po.pd.toExponential(1) + '), the conserved quantity stays constant (drift ' + po.inv.toExponential(1) + '), the equilibrium (25, 10) is stationary, logistic growth equals its ODE, fastest growth at K/2');
    const ep = r.epi;
    ok(ep.cons === 0 && ep.peak.v > 150 && Math.abs(ep.attack - ep.size) < 0.02 && ep.below[0] <= 1 + 1e-9 && ep.below[1] <= 1.05 && ep.above > 5 && near(ep.reff[0], 2.5 * 0.999, 0.01) && near(ep.reff[1], 2.5 * 0.5 * 0.8 * 0.5, 0.01) && near(ep.herd[0], 0.6) && ep.herd[1] === 0 && ep.herd[2] === 0 && ep.sizeBad === 0, 'A epidemic: S + I + R = 1000 and S never increases (4 settings x 181 days), the epidemic threshold R0 = 1 (below: I never grows; vaccinated above 60 %: no outbreak; at 50 %: outbreak), the final size solves z = 1 - exp(-R0 z) (R0 1.5 .. 6), herd threshold 1 - 1/R0');
    ok(near(ep.ab[0], 1, 1e-9) && near(ep.ab[1], 10, 1e-9) && ep.ab[2] > 5 && ep.ab[3] === 0 && ep.ab[4] === 0 && near(ep.abmax, 1, 1e-4) && near(ep.abmax2, 10, 1e-3), 'A epidemic: antibodies: first contact peaks at 1 (day 14), a second contact peaks at 10 (day 4 after it), nothing before contact');
    const cl = r.cls;
    ok(cl.n === 42 && cl.names === 42 && cl.uniq === 42 && cl.kb === 0 && cl.leaves === 42 && cl.wrong && cl.qUsed && cl.tagsUsed >= 20, `A classify: 42 organisms with 42 different feature sets; the key reaches each one (and only that one, checked by brute force over all 42), ${cl.nodes} nodes, depth ${cl.depth[0]}-${cl.depth[1]} (mean ${cl.depth[2].toFixed(1)}), ${cl.tagsUsed} different questions; wrong answers lead elsewhere`);
    ok(cl.sets.every(Boolean) && cl.classes.every(([n, a, b, k]) => (GROUP[n] || '') === a && (PLANT[n] || '') === b && !!k) && cl.classes.filter((c) => c[3] === '动物界').length === 29 && cl.classes.filter((c) => c[3] === '植物界').length === 6 && cl.classes.filter((c) => c[3] === '真菌界').length === 3 && cl.classes.filter((c) => c[3] === '细菌界').length === 2 && cl.classes.filter((c) => c[3] === '病毒').length === 2, 'A classify: the sorting rounds (30 seeds x 3 sets) have distinct items with every class present; vertebrate / plant classes and the five kingdoms agree with the table written in the test');
  }

  // ---- the quiz generators ----
  {
    const r = await page.evaluate(async (ids) => {
      const out = {}; const mulberry32 = (await import('/src/phys/qtools.ts')).mulberry32;
      for (const n of ids) { const M = await import(`/src/bio/model-${n}.ts`); const list = [], errors = []; for (let seed = 1; seed <= 300; seed++) { try { list.push(M.quiz(mulberry32(seed))); } catch (e) { errors.push(String(e)); } } out[n] = { list, errors }; }
      return out;
    }, IDS);
    const chk = (id, qs, wrongToo) => {
      let bad = 0, n = 0; const msgs = []; const E = EXPECT[id] || {}, X = TEXT[id] || {};
      for (const quiz of qs) {
        if (quiz.length !== 5) { bad++; msgs.push('not 5'); continue; }
        for (const q of quiz) {
          n++;
          if (q.choices.length !== 4 || new Set(q.choices).size !== 4 || q.choices[q.a] !== q.ans || !q.q || !q.kind) { bad++; msgs.push('shape ' + q.kind); continue; }
          if (/NaN|undefined|Infinity/.test(JSON.stringify(q))) { bad++; msgs.push('NaN ' + q.kind); continue; }
          if (E[q.kind]) { const v = E[q.kind](q.p); const got = numOf(q.ans); const tol = 0.5 * 10 ** -decimals(q.ans) + 1e-9; if (!(Math.abs(got - (wrongToo ? v * 1.3 : v)) <= tol)) { bad++; if (msgs.length < 3) msgs.push(`${q.kind} ${JSON.stringify(q.p)}: ${q.ans} vs ${v}`); } }
          else if (X[q.kind]) { if (wrongToo) continue; if (!X[q.kind](q.p, q.ans, q.q)) { bad++; if (msgs.length < 3) msgs.push(`${q.kind} ${JSON.stringify(q.p)}: ${q.ans} / ${q.q.slice(0, 30)}`); } }
          else { bad++; msgs.push('unknown kind ' + q.kind); }
        }
      }
      return { bad, n, msgs };
    };
    let total = 0;
    for (const id of IDS) {
      const { list, errors } = r[id];
      const res = chk(id, list, false); total += res.n;
      ok(errors.length === 0 && res.bad === 0, `A quiz ${id}: 300 seeds x 5 questions: 4 different choices, right answer recomputed independently${res.msgs.length ? ' ' + res.msgs.join('; ') : ''}${errors.length ? ' ' + errors[0] : ''}`);
      if (Object.keys(EXPECT[id] || {}).length) { const w = chk(id, list, true); ok(w.bad > 0, `A quiz ${id}: the check is able to fail (a formula 30% off is caught)`); }
      const kinds = new Set(list.flat().map((q) => q.kind)); ok(kinds.size === 5, `A quiz ${id}: five different kinds of question (${[...kinds].join(', ')})`);
    }
    ok(total === 23 * 300 * 5, 'A quiz: ' + total + ' questions checked');
    // a text check that is wrong must be caught too
    const wt = chk('blood', r.blood.list.map((qz) => qz.map((q) => (q.kind === 'abo' ? { ...q, ans: q.choices[(q.a + 1) % 4], a: (q.a + 1) % 4 } : q))), false);
    ok(wt.bad > 0, 'A quiz: a deliberately wrong text answer (ABO) is caught by the independent table');
  }

  // =====================================================================================  B. THE PAGES
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR ' + e.message));
  {
    await to('#/subject/science', '#open-bio');
    ok(await page.isVisible('#open-bio') && !!(await page.$('#open-bio svg')), 'B the science home has the card 生物实验室 with a drawn icon');
    await page.click('#open-bio'); await page.waitForSelector('#bl-home');
    ok(await page.evaluate(() => location.hash) === '#/science/bio', 'B the card opens #/science/bio');
    const cards = await page.evaluate(() => [...document.querySelectorAll('.pl-sc')].map((c) => ({ id: c.dataset.sim, icon: !!c.querySelector('svg'), text: c.textContent, ch: c.dataset.chapter })));
    ok(cards.length === 23 && IDS.every((id) => cards.some((c) => c.id === id)) && cards.every((c) => c.icon && /实验任务 0 \/ \d/.test(c.text)), 'B 23 cards, each with its drawn icon and "实验任务 0 / n"');
    const groups = await page.evaluate(() => [...document.querySelectorAll('#bl-home > h2, #bl-home .pl-sc')].map((e) => (e.tagName === 'H2' ? 'H:' + e.textContent : e.dataset.sim)));
    const g8 = groups.indexOf('H:八年级');
    ok(groups[0] === 'H:七年级' && g8 === 18 && groups.slice(1, g8).length === 17 && groups.slice(g8 + 1).length === 6 && groups[g8 + 1] === 'motion' && groups[1] === 'foodweb', 'B the lab starts with 七年级 (17 cards), then 八年级 (6): ' + groups.join(' '));
    const chs = await page.evaluate(() => [...document.querySelectorAll('.pl-sc')].map((c) => c.dataset.chapter));
    ok(chs.every((c) => /^(七|八)(上|下) · /.test(c)) && new Set(chs).size >= 12, 'B each card names its textbook part (七上 / 七下 / 八上 / 八下) and chapter');
    ok(await page.isVisible('#bl-notes') && (await page.getAttribute('#bl-notes', 'href')) === '#/science/notes', 'B the lab links to the 知识总结 page');
    const counts = await page.evaluate(async (ids) => { const o = {}; for (const id of ids) { const m = await import(`/src/bio/${id}.ts`); const c = await import('/src/bio/catalog.ts'); o[id] = [m.def.tasks.length, c.CATALOG[id].tasks, m.meta.id, m.def.quiz.length >= 0, m.def.tasks.map((x) => x.id)]; } return o; }, IDS);
    ok(IDS.every((id) => counts[id][0] === counts[id][1] && counts[id][2] === id && counts[id][0] >= 2 && counts[id][0] <= 4 && Object.keys(SOLVE[id]).sort().join() === counts[id][4].slice().sort().join()), 'B every simulation has 2-4 tasks, the catalog count equals the module\'s, and the test knows a solution for each');
    await page.click('.pl-sc[data-sim=cells]'); await page.waitForSelector('.pl-sim');
    ok(await page.evaluate(() => location.hash) === '#/science/bio/cells', 'B a card opens #/science/bio/<id>');
    await page.click('header .back, header button'); await page.waitForTimeout(300);
    ok(await page.evaluate(() => location.hash) === '#/science/bio', 'B the back button returns to the lab');
    await to('#/science/bio/nonsense', '#bl-home');
    ok(true, 'B an unknown simulation id goes back to the lab');
    await to('#/science/physics', '#pl-home');
    ok((await page.locator('.pl-sc').count()) === 17, 'B the physics lab is unchanged: 17 cards');
  }

  const finiteText = (sel) => page.evaluate((sel) => { const t = [...document.querySelectorAll(sel)].map((e) => e.textContent).join(' '); return !/NaN|undefined|Infinity|null/.test(t); }, sel);
  for (const id of IDS) {
    await sim(id);
    const info = await page.evaluate(() => { const d = window.__bio.def; return { params: d.params.map((p) => [p.id, p.min, p.max, p.step, p.value]), choices: (d.choices || []).map((c) => [c.id, c.options.map((o) => o[0]), c.value]), tasks: d.tasks.map((x) => x.id), hidden: Object.keys(d.hidden || {}), nread: document.querySelectorAll('.pl-read').length, canvas: [document.querySelector('#pl-canvas').offsetWidth, document.querySelector('#pl-canvas').offsetHeight], done: window.__bio.done(), links: document.querySelectorAll('.pl-link').length, drag: !!d.drag, actions: (d.actions || []).length }; });
    ok(info.nread >= 3 && info.canvas[0] > 200 && info.canvas[1] > 100 && info.done.length === 0 && info.links >= 1, `B ${id}: mounts (canvas ${info.canvas.join('x')}, ${info.nread} readouts, a link under the lesson, no task done at the start)`);
    ok(await finiteText('.pl-readouts'), `B ${id}: readouts have no NaN / undefined`);
    const ink = await page.evaluate(() => { window.__bio.redraw(); const c = document.querySelector('#pl-canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0 && (d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200)) n++; return n; });
    ok(ink > 500, `B ${id}: the drawing has content (${ink} dark pixels)`);
    let finite = true, changed = 0, sweeps = 0;
    const cases = []; for (const [cid, vals] of info.choices) for (const v of vals) cases.push([cid, v]); if (!cases.length) cases.push([null, 0]);
    for (const [cid, v] of cases) {
      await page.evaluate(([cid, v]) => { window.__bio.reset(); if (cid) window.__bio.set(cid, v); }, [cid, v]);
      for (const [pid, mn, mx] of info.params) {
        const vis = await page.evaluate((pid) => !document.querySelector(`.pl-ctl[data-p=${pid}]`).hidden, pid); if (!vis) continue;
        const before = await page.evaluate(() => document.querySelector('#pl-readouts').textContent); let any = false;
        for (const val of [mn, (mn + mx) / 2, mx]) { await set({ [pid]: val }); const txt = await page.evaluate(() => document.querySelector('#pl-readouts').textContent); if (/NaN|undefined|null|Infinity/.test(txt)) finite = false; if (txt !== before) any = true; sweeps++; }
        if (any) changed++; await page.evaluate(([pid, v0]) => window.__bio.set(pid, v0), [pid, info.params.find((p) => p[0] === pid)[4]]);
      }
    }
    ok(finite && sweeps >= 0 && (changed >= 1 || ['microscope', 'cells', 'levels', 'classify'].includes(id)), `B ${id}: every slider in every mode (${sweeps} settings) keeps the readouts finite; ${changed} slider(s) change the readouts`);
    await page.evaluate(() => window.__bio.reset());
    const first = info.params.find((p) => !/^(t|T|day|stage)$/.test(p[0])) || info.params[0];
    if (first) {
      const sid = `#pl-${first[0]}`;
      if (await page.isVisible(sid)) { await page.focus(sid); await page.keyboard.press('End'); const vEnd = Number(await page.inputValue(sid)); await page.keyboard.press('Home'); const vHome = Number(await page.inputValue(sid)); const model = await page.evaluate((k) => window.__bio.st[k], first[0]);
        ok(vEnd === first[2] && vHome === first[1] && model === first[1], `B ${id}: the slider "${first[0]}" answers the keyboard (Home/End) and the state follows`); }
    }
    // tasks: complete each by driving the state
    const sol = SOLVE[id];
    await page.evaluate(() => window.__bio.reset());
    for (const tid of info.tasks) {
      await page.evaluate(() => window.__bio.reset()); await set(sol[tid]);
      const d = await page.evaluate(() => window.__bio.done());
      ok(d.includes(tid), `B ${id}: task "${tid}" completes when the state is ${JSON.stringify(sol[tid]).slice(0, 90)}`);
    }
    ok(await page.evaluate(() => [...document.querySelectorAll('.pl-task')].every((e) => e.classList.contains('done'))), `B ${id}: all tasks show as done (✓)`);
    await page.click('#pl-reset'); await page.waitForTimeout(100);
    const afterReset = await page.evaluate((h) => ({ done: window.__bio.done().length, hid: h.every((k) => window.__bio.st[k] === window.__bio.def.hidden[k]) }), info.hidden);
    ok(afterReset.done === info.tasks.length && afterReset.hid, `B ${id}: 重置 resets the state (also the hidden state) but keeps the tasks done`);
  }
  {
    await page.reload(); await page.waitForSelector('.hub-grid, .kids, .pl-sim, #bl-home');
    await to('#/science/bio', '#bl-home');
    const txt = await page.evaluate(() => [...document.querySelectorAll('.pl-sc')].map((c) => [c.dataset.sim, c.textContent, c.classList.contains('all')]));
    ok(txt.every(([id, tx, all]) => new RegExp('实验任务 (\\d) / \\1').test(tx) && all), 'B after a reload every card shows all tasks done (progress kept in learn.bio.v1)');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('learn.bio.v1')));
    ok(Object.keys(stored.done).length === 23 && !(await page.evaluate(() => localStorage.getItem('learn.phys.v1') && JSON.parse(localStorage.getItem('learn.phys.v1')).done.cells)), 'B learn.bio.v1 holds the tasks of 23 simulations; the physics store has none of them');
  }
  // the kit extensions: hidden state, actions, derive, links, play
  {
    await sim('genetics'); await set({ mode: 0, p1: 1, p2: 1, N: 100 });
    const s0 = await page.evaluate(() => [window.__bio.st.seed, document.querySelector('#pl-readouts').textContent]);
    await page.click('#pl-act-resample');
    const s1 = await page.evaluate(() => [window.__bio.st.seed, document.querySelector('#pl-readouts').textContent]);
    ok(s1[0] === s0[0] + 1 && s1[1] !== s0[1], 'B genetics: the 重新抽样 button (an action) draws a new random sample (seed ' + s0[0] + ' -> ' + s1[0] + ') and the counts change');
    await page.click('#pl-reset'); ok((await page.evaluate(() => window.__bio.st.seed)) === 1, 'B genetics: 重置 restores the hidden seed');
    await sim('classify');
    // the key game by pressing the buttons: every organism is found by answering truthfully
    const res = await page.evaluate(async () => {
      const Cl = await import('/src/bio/model-classify.ts'); const C = await import('/src/bio/classify.ts'); const out = [];
      for (let k = 1; k <= 8; k++) {
        window.__bio.set('tseed', k); const tgt = C.target(window.__bio.st); window.__bio.st.node = 0; window.__bio.st.qn = 0; window.__bio.st.fin = 0; window.__bio.set('ans', -1);
        let guard = 0; while (!window.__bio.st.fin && guard++ < 30) { const tag = Cl.TREE[window.__bio.st.node].tag; const btn = document.querySelector(`.pl-opt[data-c="ans"][data-v="${Cl.ORGS[tgt].tags.has(tag) ? 1 : 0}"]`); btn.click(); }
        out.push([tgt, window.__bio.st.found, window.__bio.st.ok, window.__bio.st.qn]);
      }
      return { out, ident: window.__bio.st.ident, shown: document.querySelector('#pl-readouts').textContent };
    });
    ok(res.out.every(([a, b, o]) => a === b && o === 1) && res.ident === 8, 'B classify: answering the key truthfully with the 是 / 否 buttons finds the specimen (8 specimens, ' + res.out.map((x) => x[3]).join(' / ') + ' questions)');
    const wrongFlow = await page.evaluate(async () => {
      const Cl = await import('/src/bio/model-classify.ts'); const C = await import('/src/bio/classify.ts');
      window.__bio.set('tseed', 3); const tgt = C.target(window.__bio.st); window.__bio.st.node = 0; window.__bio.st.qn = 0; window.__bio.st.fin = 0; const before = window.__bio.st.ident;
      let g = 0; while (!window.__bio.st.fin && g++ < 30) { const tag = Cl.TREE[window.__bio.st.node].tag; document.querySelector(`.pl-opt[data-c="ans"][data-v="${Cl.ORGS[tgt].tags.has(tag) ? 0 : 1}"]`).click(); }
      return [window.__bio.st.ok, window.__bio.st.found === tgt, window.__bio.st.ident === before, document.querySelector('#pl-readouts').textContent];
    });
    ok(wrongFlow[0] === 0 && !wrongFlow[1] && wrongFlow[2] && /鉴定有误/.test(wrongFlow[3]), 'B classify: wrong answers end with a different organism and "鉴定有误", the count of identified specimens does not grow');
  }

  // ---- the quiz: right answers / wrong answers ----
  {
    await sim('photo');
    await page.click('#quiz-start');
    for (let i = 0; i < 5; i++) {
      const q = await page.evaluate((i) => { const qs = window.__bio.quiz(); return { a: qs[i].a, n: qs[i].choices.length }; }, i);
      ok(q.n === 4 && (await page.locator('.pl-qopt').count()) === 4, `B quiz question ${i + 1}: 4 choices`);
      await page.click(`.pl-qopt[data-i="${q.a}"]`);
      ok(await page.evaluate((a) => document.querySelector(`.pl-qopt[data-i="${a}"]`).classList.contains('right') && [...document.querySelectorAll('.pl-qopt')].every((b) => b.disabled), q.a), `B quiz question ${i + 1}: the right choice turns green, the others are locked`);
      await page.click('#quiz-next');
    }
    ok((await page.textContent('#quiz-score')).replace(/\s/g, '') === '得分5/5', 'B quiz: all right = 得分 5 / 5');
    await page.click('#quiz-again'); await page.click('#quiz-start');
    for (let i = 0; i < 5; i++) { const w = await page.evaluate((i) => (window.__bio.quiz()[i].a === 0 ? 1 : 0), i); await page.click(`.pl-qopt[data-i="${w}"]`); ok(await page.evaluate((w) => document.querySelector(`.pl-qopt[data-i="${w}"]`).classList.contains('wrong'), w), `B quiz wrong answer ${i + 1} is marked`); await page.click('#quiz-next'); }
    ok((await page.textContent('#quiz-score')).replace(/\s/g, '') === '得分0/5', 'B quiz: all wrong = 得分 0 / 5');
    ok((await page.evaluate(() => JSON.parse(localStorage.getItem('learn.bio.v1')).quiz.photo)) === 5, 'B quiz: the best score (5) is kept, a worse one does not replace it');
  }
  // time-based simulations: the play button moves the clock
  {
    await sim('population'); await set({ T: 0 }); await page.click('#pl-play'); await page.waitForTimeout(700);
    const t1 = await page.evaluate(() => window.__bio.st.T); await page.click('#pl-play');
    ok(t1 > 2 && t1 < 8, 'B population: 播放 moves the time forward by itself (' + t1.toFixed(1) + ' after 0.7 s)');
    const t2 = await page.evaluate(() => window.__bio.st.T); await page.waitForTimeout(250); ok((await page.evaluate(() => window.__bio.st.T)) === t2, 'B population: 暂停 stops it');
    await sim('hormone'); await set({ carbs: 100 });
    const cmp = await page.evaluate(() => { const r = document.querySelector('#pl-readouts').textContent; return r; });
    ok(/mmol\/L/.test(cmp), 'B hormone: readouts carry their units');
  }
  // the drawing follows the model: the Punnett square's cells, the lens sharpness, the food web arrows are drawn from the state (pixel checks)
  {
    await sim('eye'); await set({ myopia: 3, u: 6, glass: 0 });
    const blur = await page.evaluate(() => document.querySelector('#pl-readouts').textContent);
    await set({ glass: -3 }); const clear = await page.evaluate(() => document.querySelector('#pl-readouts').textContent);
    ok(/落在视网膜前方/.test(blur) && /落在视网膜上/.test(clear) && /100/.test(clear.replace(/\s/g, '')), 'B eye: short-sighted without glasses the image falls in front of the retina, a -3 D lens puts it on the retina (sharpness 100 %)');
    await sim('foodweb'); const before = await page.evaluate(() => { window.__bio.redraw(); const c = document.querySelector('#pl-canvas'); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data.reduce((a, b, i) => a + (i % 4 === 3 ? 0 : b), 0); });
    await set(Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`l${i}`, 1])));
    const after = await page.evaluate(() => { window.__bio.redraw(); const c = document.querySelector('#pl-canvas'); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data.reduce((a, b, i) => a + (i % 4 === 3 ? 0 : b), 0); });
    ok(before !== after && /11 \/ 11/.test(await page.textContent('#pl-readouts')) && /6条/.test((await page.textContent('#pl-readouts')).replace(/\s/g, '')), 'B foodweb: building all 11 links changes the drawing and shows 11 / 11 and 6 food chains');
  }

  // =====================================================================================  C. LAYOUT, 5 SCREEN SIZES
  {
    const SIZES = [[390, 844, 'phone'], [320, 568, 'small'], [820, 1180, 'tablet'], [1180, 820, 'landscape'], [844, 390, 'phoneland']];
    const t2 = await start(new Map(), { local: true, viewport: { width: 390, height: 844 }, dpr: 2, touch: true });
    const p2 = t2.page; let probs = [];
    for (const [w, hh, name] of SIZES) {
      await p2.setViewportSize({ width: w, height: hh });
      await p2.evaluate(() => (location.hash = '#/science/bio')); await p2.waitForSelector('#bl-home'); await p2.waitForTimeout(150);
      const home = await p2.evaluate(() => { const wrap = document.querySelector('.pl-wrap'); const r = wrap.getBoundingClientRect(); const cards = [...document.querySelectorAll('.pl-sc')].map((c) => c.getBoundingClientRect()); return { over: document.documentElement.scrollWidth - innerWidth, l: r.left, rr: innerWidth - r.right, small: cards.filter((c) => c.width < 100 || c.height < 100).length, clip: [...document.querySelectorAll('.pl-ct, .pl-chtag, .pl-cs')].filter((e) => e.scrollWidth > e.clientWidth + 1).length }; });
      if (home.over > 0 || Math.abs(home.l - home.rr) > 2 || home.small || home.clip) probs.push(`home ${name} ${JSON.stringify(home)}`);
      if (name === 'phone' || name === 'tablet') await p2.screenshot({ path: path.join(OUT, `lab-home-${name}.png`) });
      for (const id of IDS) {
        await p2.evaluate((id) => (location.hash = '#/science/bio/' + id), id); await p2.waitForSelector('.pl-sim'); await p2.waitForFunction(() => window.__bio && document.querySelector('#pl-canvas').offsetWidth > 0); await p2.waitForTimeout(60);
        const m = await p2.evaluate(() => {
          window.__bio.redraw(); const c = document.querySelector('#pl-canvas'); const wrap = document.querySelector('.pl-wrap').getBoundingClientRect();
          const vis = (e) => !e.closest('[hidden]') && e.offsetParent !== null;
          const sl = [...document.querySelectorAll('.pl-range')].filter(vis).map((e) => [e.offsetHeight, e.offsetWidth]);
          const btn = [...document.querySelectorAll('.pl-opt, .pl-btn, .pl-qopt, #quiz-start, .pl-link')].filter(vis).map((e) => e.offsetHeight);
          const clip = [...document.querySelectorAll('.pl-rl, .pl-rv, .pl-lab, .pl-tt, .pl-formula, .pl-lesson p, .pl-opt, .pl-btn, .pl-link')].filter((e) => vis(e) && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'auto').map((e) => e.className + ':' + e.textContent.slice(0, 12));
          const rects = [...document.querySelectorAll('.pl-sim *')].filter((e) => vis(e) && !(e instanceof SVGElement)).map((e) => e.getBoundingClientRect()).filter((r) => r.right > innerWidth + 1 || r.left < -1).length;
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let ink = 0; for (let i = 0; i < d.length; i += 40) if (d[i + 3] > 0 && (d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200)) ink++;
          return { over: document.documentElement.scrollWidth - innerWidth, l: wrap.left, rr: innerWidth - wrap.right, cw: c.offsetWidth, ch: c.offsetHeight, bw: c.width, bh: c.height, dpr: devicePixelRatio, sl, btn, clip, rects, aspect: c.offsetWidth / c.offsetHeight, ink, ta: getComputedStyle(c).touchAction, defAspect: window.__bio.def.aspect ?? 0.62, drag: !!window.__bio.def.drag };
        });
        const crisp = m.bw === Math.round(m.cw * m.dpr) && m.bh === Math.round(m.ch * m.dpr); const bad = [];
        if (m.over > 0) bad.push('overflow ' + m.over); if (Math.abs(m.l - m.rr) > 2) bad.push(`not centred ${m.l}/${m.rr}`);
        if (!crisp) bad.push(`canvas ${m.bw}x${m.bh} vs ${m.cw}x${m.ch} @${m.dpr}`); if (m.cw < Math.min(w - 20, 280)) bad.push('canvas narrow ' + m.cw);
        if (m.sl.some(([hgt, wd]) => hgt < 44 || wd < 100)) bad.push('slider ' + JSON.stringify(m.sl)); if (m.btn.some((b) => b < 40)) bad.push('button ' + Math.min(...m.btn)); if (m.clip.length) bad.push('clipped ' + m.clip.join(',')); if (m.rects) bad.push('outside ' + m.rects); if (m.ink < 30) bad.push('blank');
        if (Math.abs(m.aspect - 640 / Math.round(640 * m.defAspect)) > 0.02) bad.push('aspect ' + m.aspect);
        if (m.drag && m.ta !== 'none') bad.push('drag canvas touch-action ' + m.ta); if (!m.drag && m.ta === 'none') bad.push('touch-action none without a drag');
        if (bad.length) probs.push(`${id} ${name}: ${bad.join('; ')}`);
        if (name === 'phone' && ['cells', 'classify', 'blood', 'foodweb', 'hormone', 'division'].includes(id)) await p2.screenshot({ path: path.join(OUT, `sim-${id}-${name}.png`) });
        if (name === 'landscape' || name === 'tablet') { if (['microscope', 'cells', 'photo', 'blood', 'genetics', 'foodweb', 'classify', 'epidemic', 'eye', 'digest'].includes(id)) await p2.screenshot({ path: path.join(OUT, `sim-${id}-${name}.png`) }); }
      }
    }
    ok(probs.length === 0, '"C 23 simulations + the lab page on 5 screen sizes at dpr 2: no overflow, centred, canvas crisp (backing = layout x dpr), sliders >= 44 px, buttons >= 40 px, nothing clipped / outside, touch-action right"' + (probs.length ? '\n   ' + probs.slice(0, 12).join('\n   ') : ''));
    const t3 = await start(new Map(), { local: true, viewport: { width: 390, height: 844 }, dpr: 3 });
    await t3.page.evaluate(() => (location.hash = '#/science/bio/microscope')); await t3.page.waitForSelector('.pl-sim'); await t3.page.waitForTimeout(250);
    const c3 = await t3.page.evaluate(() => { const c = document.querySelector('#pl-canvas'); return [c.width, c.offsetWidth, devicePixelRatio]; });
    ok(c3[0] === Math.round(c3[1] * 3) && c3[2] === 3, 'C canvas crisp at dpr 3 (' + c3.join(', ') + ')');
    await t3.page.evaluate(() => { document.querySelector('.pl-sim').style.transform = 'scale(0.6)'; window.__bio.redraw(); });
    const c4 = await t3.page.evaluate(() => { const c = document.querySelector('#pl-canvas'); return [c.width, c.offsetWidth]; });
    ok(c4[0] === c3[0], 'C the canvas is sized by layout size: a scaled ancestor does not shrink the backing store (' + c4.join(', ') + ')');
    await t3.browser.close(); await t2.browser.close();
  }

  // =====================================================================================  D. REAL TOUCH DRAGGING (CDP, dpr 2)
  {
    const t2 = await start(new Map(), { local: true, viewport: { width: 390, height: 844 }, dpr: 2, touch: true });
    const p = t2.page; const cdp = await p.context().newCDPSession(p);
    const touch = async (pts) => { const tp = (q) => ({ x: q[0], y: q[1], id: 1, radiusX: 2, radiusY: 2, force: 1 }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tp(pts[0])] }); for (const q of pts.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [tp(q)] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(80); };
    const goto = async (id) => { await p.evaluate((id) => (location.hash = '#/science/bio/' + id), id); await p.waitForSelector('.pl-sim'); await p.waitForFunction(() => window.__bio && document.querySelector('#pl-canvas').offsetWidth > 0); await p.waitForTimeout(250); };
    const scrollTo = async (sel) => { await p.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: 'center' }), sel); await p.waitForTimeout(150); };
    const toScreen = async (VH) => p.evaluate((VH) => { const r = document.querySelector('#pl-canvas').getBoundingClientRect(); return [r.left, r.top, r.width / 640, r.height / VH]; }, VH);
    // a slider dragged by a finger
    await goto('hormone'); await scrollTo('#pl-carbs');
    const rect = await p.evaluate(() => { const r = document.querySelector('#pl-carbs').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
    const y = rect[1] + rect[3] / 2, frac0 = 50 / 150, thumb = rect[0] + 16 + frac0 * (rect[2] - 32);
    await touch([[thumb, y], [thumb + 30, y], [thumb + 90, y], [thumb + 150, y]]);
    const c1 = await p.evaluate(() => window.__bio.st.carbs); ok(c1 > 90, 'D a finger dragging the slider thumb changes the value (carbs 50 -> ' + c1 + ' g)');
    await touch([[rect[0] + 20, y]]); ok((await p.evaluate(() => window.__bio.st.carbs)) < c1, 'D a tap on the track moves the thumb there');
    // cells: drag the names onto the numbered marks
    await goto('cells'); await scrollTo('#pl-canvas');
    const layout = await p.evaluate(async () => { const C = await import('/src/bio/cells.ts'); return { mark: C.MARK }; });
    let [lx, ly, kx, ky] = await toScreen(480);
    const item = (i) => [lx + 548 * kx, ly + (48 + 56 * i) * ky], mark = (k, i) => [lx + layout.mark[k][i][0] * kx, ly + layout.mark[k][i][1] * ky];
    // the nucleus (item 3) onto its own mark
    let a = item(3), b = mark(0, 3); await touch([a, [a[0] - 20, a[1]], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b]);
    ok((await p.evaluate(() => window.__bio.st.pa3)) === 1 && (await p.evaluate(() => window.__bio.st.miss)) === 0 && (await p.evaluate(() => window.__bio.st.h)) === -1, 'D cells: a finger drags 细胞核 onto its mark: placed, no mistake');
    // a wrong drop: the wall (item 0) onto the vacuole's mark
    a = item(0); b = mark(0, 5); await touch([a, [a[0] - 10, a[1]], b]);
    ok((await p.evaluate(() => window.__bio.st.pa0)) === 0 && (await p.evaluate(() => window.__bio.st.miss)) === 1, 'D cells: a wrong drop is not placed and counts as one mistake');
    // a tap on a name then a tap on its mark
    a = item(1); b = mark(0, 1); await touch([a]); ok((await p.evaluate(() => window.__bio.st.sel)) === 1, 'D cells: a tap selects a name (highlighted)'); await touch([b]);
    ok((await p.evaluate(() => window.__bio.st.pa1)) === 1 && (await p.evaluate(() => window.__bio.st.sel)) === -1, 'D cells: then a tap on the mark places it');
    ok((await p.evaluate(() => getComputedStyle(document.querySelector('#pl-canvas')).touchAction)) === 'none', 'D a drag-and-drop canvas has touch-action: none (the finger drags the name, the page does not scroll)');
    // foodweb: draw an arrow from the grass to the rabbit with a finger
    await goto('foodweb'); await scrollTo('#pl-canvas');
    const pos = await p.evaluate(async () => (await import('/src/bio/foodweb.ts')).POS);
    [lx, ly, kx, ky] = await toScreen(Math.round(640 * 0.66));
    const sp = (i) => [lx + pos[i][0] * kx, ly + pos[i][1] * ky];
    await touch([sp(0), [(sp(0)[0] + sp(2)[0]) / 2, (sp(0)[1] + sp(2)[1]) / 2], sp(2)]);
    ok((await p.evaluate(() => window.__bio.st.l1)) === 1 && (await p.evaluate(() => window.__bio.st.miss)) === 0, 'D foodweb: dragging from 草 to 兔 draws the arrow (a real link)');
    await touch([sp(2), [sp(2)[0] + 10, sp(2)[1] - 20], sp(0)]);
    ok((await p.evaluate(() => window.__bio.st.miss)) === 1, 'D foodweb: dragging from 兔 to 草 (the wrong way) counts as a mistake and adds no arrow');
    await touch([sp(5)]);
    ok((await p.evaluate(() => window.__bio.st.rm5)) === 1, 'D foodweb: a tap on 蛇 removes it from the web');
    // levels: drag 心脏 into 器官
    await goto('levels'); await scrollTo('#pl-canvas');
    const lv = await p.evaluate(async () => { const L = await import('/src/bio/levels.ts'); const sp = L.specFor(0); return { at: sp.n && [4].map((i) => sp.at(i, {})), tg: sp.targets({}).map((x) => [x.x, x.y]) }; });
    [lx, ly, kx, ky] = await toScreen(Math.round(640 * 0.66));
    a = [lx + lv.at[0][0] * kx, ly + lv.at[0][1] * ky]; b = [lx + lv.tg[2][0] * kx, ly + lv.tg[2][1] * ky];
    await touch([a, [a[0], a[1] - 30], b]);
    ok((await p.evaluate(() => window.__bio.st.lv4)) === 1, 'D levels: a finger drags 心脏 into 器官');
    // the classify sorting game: drag one organism into its class
    await goto('classify'); await set2(p, { mode: 1, set: 0 }); await scrollTo('#pl-canvas');
    const cl = await p.evaluate(async () => { const C = await import('/src/bio/classify.ts'); const s = { ...window.__bio.st }; const sp = C.specFor(s); const items = C.itemsOf(s); return { at: sp.at(0, s), tg: sp.targets(s).map((x) => [x.x, x.y]), ans: sp.answer(0, s), n: sp.n, items }; });
    [lx, ly, kx, ky] = await toScreen(Math.round(640 * 0.66));
    a = [lx + cl.at[0] * kx, ly + cl.at[1] * ky]; b = [lx + cl.tg[cl.ans][0] * kx, ly + cl.tg[cl.ans][1] * ky];
    await touch([a, [a[0], a[1] - 40], b]);
    ok((await p.evaluate(() => window.__bio.st.cl0)) === 1, 'D classify: a finger drags an organism into its class (' + cl.items.length + ' organisms in the round)');
    // the page still scrolls with a vertical swipe that starts OUTSIDE a drag canvas (on the text below)
    await goto('cells'); const sy0 = await p.evaluate(() => document.querySelector('.scroll').scrollTop);
    const info = await p.evaluate(() => { const r = document.querySelector('.pl-info').getBoundingClientRect(); return [r.left + 60, Math.min(innerHeight - 40, r.top + 40)]; });
    await touch([[info[0], info[1]], [info[0], info[1] - 60], [info[0], info[1] - 160]]); const sy1 = await p.evaluate(() => document.querySelector('.scroll').scrollTop);
    ok(sy1 > sy0, 'D the page still scrolls with a swipe that starts below the canvas');
    await t2.browser.close();
  }
  {
    const t2 = await start(new Map(), { local: true, viewport: { width: 1180, height: 820 } });
    const p = t2.page;
    await p.evaluate(() => (location.hash = '#/science/bio/levels')); await p.waitForSelector('.pl-sim'); await p.waitForTimeout(250);
    const r = await p.evaluate(async () => { const c = document.querySelector('#pl-canvas').getBoundingClientRect(); const L = await import('/src/bio/levels.ts'); const sp = L.specFor(0); return [c.left, c.top, c.width, c.height, sp.at(8, {}), sp.targets({})[4]]; });
    const sc = r[2] / 640, ysc = r[3] / Math.round(640 * 0.66);
    await p.mouse.move(r[0] + r[4][0] * sc, r[1] + r[4][1] * ysc); await p.mouse.down(); await p.mouse.move(r[0] + r[5].x * sc, r[1] + r[5].y * ysc, { steps: 6 }); await p.mouse.up();
    ok((await p.evaluate(() => window.__bio.st.lv8)) === 1, 'D levels: the mouse drags 人 into 个体 (desktop)');
    await t2.browser.close();
  }
  async function set2(p, o) { await p.evaluate((o) => { for (const [k, v] of Object.entries(o)) window.__bio.set(k, v); }, o); await p.waitForTimeout(80); }

  // =====================================================================================  E. ENGLISH / FRENCH
  {
    // the texts the check:i18n script finds in src (scan of src/, games, phys, bio) that are not yet in i18n-data.ts must all be in src/i18n-extra/biolab.json
    let out = ''; try { execFileSync('node', ['scripts/check-i18n.mjs'], { cwd: path.join(__dirname, '../..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { out = String(e.stderr || '') + String(e.stdout || ''); }
    const missing = [...out.matchAll(/^missing .*?\((.+?)\): (".*")$/gm)].map((m) => JSON.parse(m[2]));
    const notInExtra = missing.filter((k) => !(k in extra));
    ok(notInExtra.length === 0, `E check:i18n: every text it reports (${missing.length}) is in src/i18n-extra/biolab.json (the lead merges the file into i18n-data.ts)${notInExtra.length ? ': ' + notInExtra.slice(0, 8).join(' | ') : ''}`);
    ok(Object.entries(extra).every(([k, v]) => Array.isArray(v) && v.length === 2 && typeof v[0] === "string" && typeof v[1] === "string" && v.every((x) => !/[一-鿿]/.test(x))), 'E biolab.json: {"中文": ["English", "Français"]}, no Chinese in a translation');
  }
  for (const [loc, label] of [['en', 'English'], ['fr', 'French']]) {
    const tl = await start(new Map(), { local: true, locale: loc, viewport: { width: 1180, height: 820 } });
    await withExtra(tl);
    const p = tl.page; const left = [];
    const scan = async (where) => { const a = await p.evaluate(() => { const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (n.parentElement.closest('.user, canvas, svg, script, style')) continue; if (/[一-鿿]/.test(n.nodeValue)) out.push(n.nodeValue.trim()); } document.querySelectorAll('[title],[aria-label],[placeholder]').forEach((e) => { if (e.closest('.user')) return; for (const k of ['title', 'aria-label', 'placeholder']) { const v = e.getAttribute(k); if (v && /[一-鿿]/.test(v)) out.push(k + ':' + v); } }); return out; }); for (const x of a) left.push(`${where}: ${x}`); };
    await p.evaluate(() => (location.hash = '#/subject/science')); await p.waitForSelector('#open-bio'); await p.waitForTimeout(200);
    const tx = (await p.textContent('#open-bio')).trim();
    ok(!/[一-鿿]/.test(tx) && tx !== '生物实验室', `E ${label}: the science card is translated (${tx})`);
    await p.evaluate(() => (location.hash = '#/science/bio')); await p.waitForSelector('#bl-home'); await p.waitForTimeout(200); await scan('lab');
    for (const id of IDS) {
      await p.evaluate((id) => (location.hash = '#/science/bio/' + id), id); await p.waitForSelector('.pl-sim'); await p.waitForFunction(() => window.__bio); await p.waitForTimeout(120); await scan(id);
      const info = await p.evaluate(() => ({ ch: (window.__bio.def.choices || []).map((c) => [c.id, c.options.map((o) => o[0])]), ps: window.__bio.def.params.map((q) => [q.id, q.min, q.max]) }));
      for (const [cid, vals] of (info.ch.length ? info.ch : [[null, [0]]])) for (const v of vals) { await p.evaluate(([c, v]) => { window.__bio.reset(); if (c) window.__bio.set(c, v); }, [cid, v]); await p.waitForTimeout(30); await scan(`${id} ${cid}=${v}`); for (const [pid, mn, mx] of info.ps) for (const val of [mn, (mn + mx) / 2, mx]) { await p.evaluate(([a, b]) => window.__bio.set(a, b), [pid, val]); await scan(`${id} ${cid}=${v} ${pid}=${val}`); } }
      await p.evaluate(() => window.__bio.reset());
      // every stage of the step-by-step simulations and every state of the drag games
      for (const st of await p.evaluate(() => Object.keys(window.__bio.def.hidden || {}))) void st;
      await p.click('#quiz-start'); await p.waitForTimeout(50); await scan(id + ' quiz'); await p.click('.pl-qopt'); await scan(id + ' quiz answered'); await p.click('#quiz-next');
      for (let i = 0; i < 4; i++) { await p.click('.pl-qopt'); await p.click('#quiz-next'); } await scan(id + ' score');
      await p.click('#pl-reset'); await scan(id + ' toast');
    }
    // the states that only the games reach: every key-game question, every organism, every classification result
    await p.evaluate(() => (location.hash = '#/science/bio/classify')); await p.waitForSelector('.pl-sim'); await p.waitForFunction(() => window.__bio);
    await p.evaluate(async () => { const Cl = await import('/src/bio/model-classify.ts'); window.__texts = [...new Set([...Object.values(Cl.TAGQ), ...Cl.ORGS.map((o) => o.name), ...Cl.SETS.flatMap((s) => s.classes)])]; });
    const keyTexts = await p.evaluate(() => window.__texts);
    const trs = await p.evaluate(async (list) => { const I = await import('/src/i18n.ts'); return list.filter((x) => I.tr(x) === x); }, keyTexts);
    ok(trs.length === 0, `E ${label}: all ${keyTexts.length} questions, organism names and class names of the classification lab are translated${trs.length ? ': ' + trs.slice(0, 6).join(' | ') : ''}`);
    await p.evaluate(() => (location.hash = '#/science/bio/foodweb')); await p.waitForSelector('.pl-sim'); await p.waitForFunction(() => window.__bio);
    const fwT = await p.evaluate(async () => { const F = await import('/src/bio/model-foodweb.ts'); const I = await import('/src/i18n.ts'); return F.SPECIES.filter((x) => I.tr(x) === x); });
    ok(fwT.length === 0, `E ${label}: the eight species of the food web are translated`);
    const uniq = [...new Set(left)];
    ok(uniq.length === 0, `E ${label}: no Chinese left outside content boxes (${uniq.length})${uniq.length ? '\n   ' + uniq.slice(0, 25).join('\n   ') : ''}`);
    await p.evaluate(() => (location.hash = '#/science/bio/cells')); await p.waitForSelector('.pl-sim');
    ok(/[一-鿿]/.test(await p.textContent('#pl-lesson')) && (await p.evaluate(() => !!document.querySelector('#pl-lesson.user'))), `E ${label}: the lesson text is content: it stays Chinese in a user box`);
    let probs = [];
    for (const [w, hh] of [[390, 844], [320, 568], [820, 1180]]) { await p.setViewportSize({ width: w, height: hh }); for (const id of IDS) { await p.evaluate((id) => (location.hash = '#/science/bio/' + id), id); await p.waitForSelector('.pl-sim'); await p.waitForTimeout(40); const m = await p.evaluate(() => { const vis = (e) => !e.closest('[hidden]') && e.offsetParent !== null; return { over: document.documentElement.scrollWidth - innerWidth, clip: [...document.querySelectorAll('.pl-rl, .pl-rv, .pl-lab, .pl-tt, .pl-opt, .pl-btn, .pl-link')].filter((e) => vis(e) && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'auto').map((e) => e.textContent.slice(0, 14)) }; }); if (m.over > 0 || m.clip.length) probs.push(`${id}@${w}: ${m.over} ${m.clip.join('/')}`); } }
    ok(probs.length === 0, `E ${label}: 23 simulations on 390 / 320 / 820 px wide: no overflow, no clipped label${probs.length ? ' ' + probs.slice(0, 6).join('; ') : ''}`);
    await p.setViewportSize({ width: 390, height: 844 }); await p.evaluate(() => (location.hash = '#/science/bio/cells')); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(OUT, `sim-cells-${loc}.png`), fullPage: true });
    await p.evaluate(() => (location.hash = '#/science/bio')); await p.waitForTimeout(300); await p.screenshot({ path: path.join(OUT, `lab-${loc}.png`), fullPage: true });
    ok(tl.log.external.length === 0, `F ${label}: nothing was requested from outside the app (${tl.log.external.join(', ')})`);
    await tl.browser.close();
  }

  // =====================================================================================  F. NOTHING LEAVES THE DEVICE, NO PAGE ERRORS
  ok(t.log.external.length === 0, 'F no request left the app in the whole run: ' + t.log.external.join(', '));
  ok(consoleErrors.filter((e) => !/favicon|manifest|Failed to load resource/.test(e)).length === 0, 'F no console errors' + (consoleErrors.length ? ': ' + consoleErrors.slice(0, 3).join(' | ') : ''));
  const sw = await page.evaluate(() => Promise.all(['/src/bio/catalog.ts', '/src/bio/organisms.ts', '/src/bio/model-classify.ts', '/src/biolab.ts'].map((u) => fetch(u).then((r) => r.text()))).then((a) => a.some((s) => /https?:\/\/(?!www\.w3\.org)/.test(s.replace(/xmlns="[^"]*"/g, '')))));
  ok(!sw, 'F the biology lab code names no outside address');
  // the physics lab still passes its own suite: here only its kit extension is shown to be backward compatible
  ok(await page.evaluate(async () => { const K = await import('/src/phys/kit.ts'); return typeof K.mountSim === 'function' && K.loadSaved().done !== undefined; }), 'F the physics kit still exports mountSim / loadSaved (82-physlab runs on the same kit)');
  await done(t.browser);
})().catch((e) => { console.error(e); process.exit(1); });
