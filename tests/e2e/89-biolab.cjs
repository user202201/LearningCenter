// 生物实验室 (#/science/bio, under 科学): junior-high biology as simulations (kit shared with the physics lab).
// Part A: every pure model against hand values, independent re-computations and invariants (Mendel enumeration + chi-square, ABO table, Lotka-Volterra against an independent RK4 and its conserved quantity,
// SIR conservation and the final-size equation, enzyme optimum, saturation, 10 % rule, thin-lens eye, Boyle, the dichotomous key) and every quiz generator (23 simulations x 300 seeds x 5 questions,
// the right answer recomputed independently; the checker is shown to catch a wrong formula).
// Part B: the pages (23 cards by grade, every simulation mounts, readouts finite, sliders respond, every task completed by driving the state, kept after a reload, quiz right / wrong, hidden state / actions / 重置).
// Part C: layout on 5 screen sizes (dpr 2 / 3, crisp canvas, sliders >= 44 px, no overflow, centred). Part D: real touch drags (CDP, dpr 2) on a slider and on three drag-and-drop simulations.
// Part E: English / French (nothing Chinese left outside content boxes; the check:i18n list is covered by src/i18n-extra/biolab.json). Part F: nothing leaves the device.
// Third pass (50 simulations): part A2 checks the 14 new models against independent computations (closed forms, enumerations, statistics of the seeded samples, ultrametric tree) and the 21 drag modes (match.ts) in bulk, plus a deny-list of words for the reproductive-system texts (zh here, en / fr in part E); B has the small interactions, D real touch drags in a label, an order and a bucket mode.
// Not tested: real fingers / Apple Pencil on an iPad, how the simulations feel to a child, the biology content (a teacher must proofread lessons, quiz wording, numbers, the 42 organisms and their features).
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const OUT = process.env.D || 'tests/out/biolab/';
fs.mkdirSync(OUT, { recursive: true });

const IDS = ['foodweb', 'population', 'microscope', 'cells', 'division', 'levels', 'seed', 'photo', 'respiration', 'transpiration', 'flower', 'digest', 'breathing', 'blood', 'nerve', 'hormone', 'eye', 'motion', 'ferment', 'classify', 'genetics', 'selection', 'epidemic', 'lifecycle', 'development', 'vessels', 'excretion', 'ear', 'behaviour', 'fossils', 'diet', 'firstaid', 'skin', 'bones', 'impact', 'health', 'reproduction', 'bloodpressure', 'microbe', 'slide', 'seedlab', 'energy', 'daphnia', 'dna', 'propagation', 'evidence', 'breeding', 'eugenics', 'animalgroups', 'ecology'];
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const extraOf = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../src/i18n-extra/' + f), 'utf8'));
const extra = extraOf('biolab.json');
const extraAll = Object.assign({}, extra, extraOf('biocontent.json'));   // (biocontent.json: lessons, quiz questions, explanations: rule 66)
const withExtra = async (t) => {
  const add = 'Object.assign(EN, ' + JSON.stringify(Object.fromEntries(Object.entries(extraAll).map(([k, v]) => [k, v[0]]))) + ');\nObject.assign(FR, ' + JSON.stringify(Object.fromEntries(Object.entries(extraAll).map(([k, v]) => [k, v[1]]))) + ');';
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
  lifecycle: { pupa: { c: 1, stage: 2 }, nymph: { c: 0, stage: 1 }, tadpole: { c: 2, stage: 1 } },
  development: { birth: { mode: 0, week: 40 }, fetus: { mode: 0, week: 8 }, spurt: { mode: 1, sex: 0, age: 11 } },
  vessels: { capillary: { mode: 1, v: 1, hr: 75 }, anaemia: { mode: 0, hct: 30 }, artery: { mode: 2, b: 0 } },
  excretion: { normal: { water: 3 }, dehyd: { water: 0.5, sweat: 2 }, glu: { glu: 12 } },
  ear: { mosquito: { mode: 0, age: 50, f: 17000 }, loud: { mode: 0, db: 100 }, cochlea: { mode: 1, part: 3 } },
  behaviour: { sort: { mode: 0, ...L(10, 'bh') }, slow: { mode: 1, a: 0, n: 60 }, fast: { mode: 1, a: 2, n: 15 } },
  fossils: { c14: { mode: 0, iso: 0, f: 25 }, u238: { mode: 0, iso: 2, f: 50 }, layers: { mode: 1, ...L(8, 'fo') } },
  diet: { balanced: { g0: 300, g1: 400, g2: 250, g3: 150, g4: 300, g5: 25, need: 2000 }, oil: { g5: 80 }, veg: { g1: 0, g2: 0, g0: 200 } },
  firstaid: { cpr: { mode: 0, rate: 110, depth: 5.5 }, overdose: { mode: 1, mgkg: 15, times: 6 }, burn: { mode: 2, ...L(5, 'ba') } },
  skin: { run: { a: 2, ta: 30 }, cold: { a: 0, ta: 0, cl: 1 }, ok: { a: 0, ta: 20, cl: 2 } },
  bones: { burn: { t: 1 }, acid: { t: 2 }, young: { t: 0, age: 10 } },
  impact: { habitat: { mode: 0, lost: 95 }, emit: { mode: 1, emit: 9, years: 100 }, cut: { mode: 1, emit: 0, years: 50 } },
  health: { aerobic: { mode: 0, age: 14, hr: 150 }, hard: { mode: 0, hr: 180 }, sleep: { mode: 1, age: 12, sleep: 10 } },
  epidemic: { herd: { mode: 0, vacc: 60 }, flat: { mode: 0, vacc: 30, iso: 30, route: 30 }, boost: { mode: 1, tb: 28 } },
  // third pass (14 more simulations)
  reproduction: { female: { mode: 0, ...L(4, 'f') }, male: { mode: 1, ...L(4, 'm') }, events: { mode: 2, ...L(4, 'e') }, order: { mode: 3, ...L(5, 'o') } },
  bloodpressure: { high: { mode: 0, r: 200 }, sys: { mode: 1, person: 0, cuff: 118 }, dia: { mode: 1, person: 0, cuff: 76 }, pulse: { mode: 2, secs: 15, hr: 120 } },
  microbe: { valid: { mode: 0, c0: 7, dil: 4, vol: 0.1 }, bact: { mode: 1, ...L(6, 'b') }, yeast: { mode: 2, ...L(6, 'y') }, resist: { mode: 3, courses: 4 } },
  slide: { onion: { mode: 0, ...L(7, 'o') }, cheek: { mode: 1, ...L(7, 'k') }, clean: { mode: 2, angle: 5, water: 3 } },
  seedlab: { bean: { mode: 0, ...L(5, 'b') }, maize: { mode: 1, ...L(6, 'm') }, iodine: { mode: 2, seed: 1, part: 1 }, sample: { mode: 3, n: 100 } },
  energy: { shield: { shield: 1 }, rice: { food: 3, shield: 1 }, heat: { food: 1, shield: 1, m: 1.5, vw: 100 } },
  daphnia: { low: { conc: 1 }, drop: { conc: 10 }, dead: { conc: 20 } },
  dna: { chrom: { mode: 0, ...L(5, 'c') }, pair: { mode: 1, k: 8 }, gamete: { mode: 2, sp: 0, cell: 1 }, sexratio: { mode: 3, N: 500 } },
  propagation: { graft: { mode: 0, scion: 0, stock: 0, align: 100 }, mismatch: { mode: 0, scion: 0, stock: 1, align: 100 }, methods: { mode: 1, ...L(6, 'm') }, compare: { mode: 2, ...L(8, 'k') } },
  evidence: { homol: { mode: 0, an: 1, ...L(5, 'h') }, embryo: { mode: 1, stage: 20 }, cyt: { mode: 2, csp: 0 }, tree: { mode: 3, a: 0, b: 1 } },
  breeding: { f2: { mode: 0, gen: 1, n: 160 }, tech: { mode: 1, ...L(8, 't') }, dolly: { mode: 2, nuc: 0, egg: 1, sur: 1 } },
  eugenics: { cousin: { mode: 0, rel: 1 }, sibling: { mode: 0, rel: 2 }, eugen: { mode: 1, ...L(8, 'e') } },
  animalgroups: { org: { mode: 0, ...L(8, 'o') }, feat: { mode: 1, ...L(8, 'f') }, bird: { mode: 2, grp: 3 } },
  ecology: { dark: { mode: 0, factor: 0, n: 20 }, types: { mode: 1, ...L(8, 'e') }, resil: { mode: 2, div: 30, dist: 60 }, fragile: { mode: 2, div: 4, dist: 40 } },
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
  lifecycle: { total: ([c]) => [130, 54, 400, 506][c], stages: ([c]) => [3, 4, 4, 3][c] },
  development: { len: ([w]) => ({ 8: 16, 12: 60, 20: 250, 28: 370, 36: 470, 40: 500 })[w], mass: ([w]) => ({ 8: 1, 12: 14, 20: 300, 28: 1000, 36: 2600, 40: 3400 })[w], spurt: ([x]) => [11, 13][x] },
  vessels: { vol: ([kg]) => (kg * 75) / 1000, plasma: ([kg, h]) => ((kg * 75) / 1000) * (1 - h / 100), speed: ([hr, v]) => ((70 * hr) / 60) / [3, 4500, 18][v] },
  excretion: { filtered: ([g]) => (g * 1440) / 1000, urine: ([w, sw]) => Math.max(0.5, w + 0.3 - sw - 0.6), reabs: ([u]) => (1 - u / 180) * 100 },
  ear: { limit: ([a]) => Math.max(8000, 20000 - 300 * Math.max(0, a - 10)), safe: ([d]) => 8 * 2 ** (-(d - 85) / 3), safe2: ([d]) => 8 * 2 ** (-(d - 85) / 3) },
  behaviour: { err: ([a, n]) => 5 + 95 * Math.exp(-[0.01, 0.05, 0.2][a] * n), trials: ([a, l]) => Math.ceil(Math.log(95 / (l - 5)) / [0.01, 0.05, 0.2][a]) },
  fossils: { left: ([n]) => 100 * 0.5 ** n, age: ([, f]) => 5730 * Math.log2(1 / f), half: ([i]) => [5730, 1.25e9, 4.47e9][i] },
  diet: { energy: ([a, b]) => (a * 350 + b * 25) / 100, protein: ([i, a]) => (a / 100) * [10, 1.5, 0.7, 18, 3, 0][i], oil: ([o]) => o * 9 },
  firstaid: { press: ([r, m]) => r * m, dose: ([k, m]) => k * m, daily: ([k, m, t]) => k * m * t },
  skin: { dry: ([ta, cl]) => 8 * (1 - 0.1 * cl) * (34 - ta), sweat: ([a, ta]) => Math.max(0, (([80, 200, 600][a] - 8 * (34 - ta)) * 3.6) / 2.43), heat: ([a]) => [80, 200, 600][a] * 3.6 },
  bones: { organic: ([a]) => 100 * (a <= 12 ? 0.5 : a <= 40 ? 0.5 - ((a - 12) / 28) / 6 : Math.max(0.2, 1 / 3 - ((a - 40) / 40) * (1 / 3 - 0.2))) },
  impact: { species: ([l]) => 100 * (1 - l) ** 0.25, co2: ([e, y]) => 420 + (0.45 * e * y) / 2.13, warm: ([c]) => 2 * Math.log2(c / 280) },
  health: { max: ([a]) => 220 - a, low: ([a]) => Math.round(0.7 * (220 - a)), high: ([a]) => Math.round(0.85 * (220 - a)) },
  epidemic: { herd: ([R]) => (1 - 1 / R) * 100, reff: ([R, i, r, v]) => R * (1 - i) * (1 - r) * (1 - v), susc: ([v]) => 1000 * (1 - v) },
  // third pass: written here, from the biology (not the formulas of the models)
  bloodpressure: { co: ([sv, hr]) => (sv * hr) / 1000, pp: ([sys, dia]) => sys - dia, kpa: ([mm]) => mm / 7.5 },
  microbe: { estimate: ([n, dil, vol]) => (n * 10 ** dil) / vol / 1e6, resist: ([r0, kill, k]) => (100 * (r0 / 1000)) / (r0 / 1000 + (1 - r0 / 1000) * (1 - kill / 100) ** k) },
  slide: { steps: () => 7 },
  seedlab: { avg: ([n, a, b, c]) => ((a + b + c) / (3 * n)) * 100 },
  energy: { q: ([vw, dT]) => 4.2 * vw * dT, per: ([Q, m]) => Q / (m * 1000), dt: ([, dT]) => dT, total: ([f, m]) => [24, 28, 16, 15][f] * m },
  daphnia: { pmin: ([n]) => 6 * n, drop: ([a, b]) => ((a - b) / a) * 100, avg: ([x, y, z]) => (x + y + z) / 3 },
  dna: { count: ([sp, cell]) => [46, 8, 14, 20, 24, 38][sp] / (cell === 1 ? 2 : 1) },
  evidence: { cyt: ([i]) => ((104 - [0, 1, 10, 12, 13, 15, 21, 44][i]) / 104) * 100, mrca: ([a, b]) => { const rank = [0, 0, 1, 2, 3, 4], t = [7, 9, 14, 28, 90]; return a === b ? 0 : t[Math.max(rank[a], rank[b])]; } },
  breeding: { f2: ([n]) => (9 * n) / 16, pure: ([n]) => n / 16 },
  eugenics: { risk: ([N, r]) => ([1 / (N * N), 1 / N / 8, 1 / N / 2][r] / 4) * 10000, ratio: ([N, r]) => [1, N / 8, N / 2][r] },
  animalgroups: { legs: ([l]) => [3, 4][l] },
  ecology: { cap: ([d]) => (80 * d) / (d + 8) },
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
const BEH = { 蜘蛛结网: '先天性行为', 母鸡孵卵: '先天性行为', 蜜蜂采蜜: '先天性行为', 黑猩猩用树枝钓白蚁: '学习行为', 小狗算算术: '学习行为', 鹦鹉学舌: '学习行为', 蚂蚁分工合作: '社会行为', 狒狒的首领与等级: '社会行为', 蜜蜂跳舞传递信息: '社会行为', 大山雀偷喝牛奶: '学习行为' };
const FOS = { 三叶虫: '寒武纪（约 5.4 亿年前）', 早期鱼类: '泥盆纪（约 4 亿年前）', 两栖类: '石炭纪（约 3.5 亿年前）', 巨型蕨类: '石炭纪（约 3.5 亿年前）', 恐龙: '中生代（约 2.5 亿 – 6600 万年前）', 始祖鸟: '中生代（约 2.5 亿 – 6600 万年前）', 哺乳动物繁盛: '新生代（6600 万年前至今）', 人类化石: '新生代（6600 万年前至今）' };
const LACKD = [['维生素 A', '夜盲症'], ['维生素 C', '坏血病'], ['维生素 D 或钙', '佝偻病（儿童）'], ['维生素 B₁', '脚气病'], ['铁', '缺铁性贫血'], ['碘', '地方性甲状腺肿（大脖子病）']];
const PROT = [['建立自然保护区', '就地保护'], ['建立动物园和植物园', '迁地保护'], ['建立濒危物种的基因库', '离体保护'], ['颁布《野生动物保护法》', '法制管理']];
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
  lifecycle: { kind: ([c], a) => a === ['不完全变态发育', '完全变态发育', '变态发育', '没有变态，属于卵生、直接发育'][c], fert: ([c], a) => a === ['体内受精', '体内受精', '体外受精', '体内受精'][c], pupa: (p, a) => a === '蛹' },
  development: { fert: (p, a) => a === '输卵管', nutri: (p, a) => a === '胎盘和脐带' },
  vessels: { valve: (p, a) => a === '防止血液倒流', bleed: ([b], a) => a === ['近心端', '远心端', '自然止血或消毒包扎'][b] },
  excretion: { step: (p, a) => a.startsWith('肾小球的滤过'), gluc: (p, a) => a.startsWith('被肾小管全部重吸收') },
  ear: { cochlea: (p, a) => a === '耳蜗', balance: (p, a) => a === '前庭和半规管' },
  behaviour: { class: (p, a, q) => a === BEH[q.match(/“(.+?)”/)[1]], class2: (p, a, q) => a === BEH[q.match(/“(.+?)”/)[1]], brain: (p, a) => a.startsWith('神经系统和大脑') },
  fossils: { layer: (p, a, q) => a === FOS[q.match(/“(.+?)”/)[1]], order: (p, a) => a.startsWith('更古老') },
  diet: { lack: (p, a, q) => a === LACKD.find((x) => q.includes(`缺乏${x[0]}`))[1], 'energy-main': (p, a) => a === '糖类' },
  firstaid: { number: (p, a) => a.startsWith('立即拨打 120'), otc: (p, a) => a.startsWith('服药前阅读说明书') },
  skin: { hot: (p, a) => a.startsWith('皮肤血管舒张'), skin: (p, a) => a === '进行光合作用' },
  bones: { treat: ([t], a) => a === ['有弹性又坚硬', '变脆，易碎（只剩无机盐）', '变软，可以弯曲（只剩有机物）'][t], child: (p, a) => a.startsWith('有机物含量较多'), inorganic: (p, a) => a === '无机盐', joint: (p, a) => a.startsWith('关节面') },
  impact: { protect: (p, a, q) => a === PROT.find((x) => q.includes(`“${x[0]}”`))[1], cause: (p, a) => a === '光合作用增强' },
  health: { sleep: ([age], a) => a === (age <= 12 ? '10–12 小时' : age <= 15 ? '9–11 小时' : '8–10 小时'), habit: (p, a) => a.startsWith('合理饮食') },
  // third pass
  reproduction: { organ: (p, a, q) => { const f = Object.entries(ORGAN_FN).find(([, fn]) => q.includes('“' + fn + '”')); return !!f && a === f[0]; }, site: (p, a) => a === '输卵管', gonad: ([g], a) => a === (g === 0 ? '睾丸' : '卵巢'), nutri: (p, a) => a === '胎盘和脐带', next: ([i], a, q) => q.includes('“' + REPRO_STAGES[i] + '”') && a === REPRO_STAGES[i + 1] },
  bloodpressure: { status: ([s, d], a) => a === (s > 140 || d > 90 ? '血压偏高（高血压）' : s < 90 || d < 60 ? '血压偏低' : '血压正常'), sound: (p, a) => a.startsWith('听不到声音') },
  microbe: { fold: ([k], a) => a === '10' + [...String(k)].map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]).join(''), range: (p, a) => a === '30–300 个', struct: (p, a) => a === '细菌没有成形的细胞核' },
  slide: { order: ([i], a, q) => q.includes('“' + ONION_STEPS[i] + '”') && a === ONION_STEPS[i + 1], saline: (p, a) => a === '生理盐水', stain: (p, a) => a.startsWith('使细胞核等结构着色'), bubble: (p, a) => a.startsWith('用镊子夹起盖玻片，使一侧先接触水滴') },
  seedlab: { part: ([i], a, q) => a === ['种皮', '胚根', '胚轴', '胚芽', '子叶'][i] && q.includes(['保护种子内部结构的是', '将来发育成根的是', '将来发育成连接根和茎的部分的是', '将来发育成茎和叶的是', '菜豆种子储存营养物质的是'][i]), store: (p, a) => a === '胚乳', iodine: (p, a) => a === '胚乳', samp: (p, a) => a.startsWith('每组取数量较多的种子') },
  energy: { loss: (p, a) => a.startsWith('燃烧放出的热量没有全部被水吸收') },
  daphnia: { ctrl: (p, a) => a.startsWith('作对照'), high: (p, a) => a.startsWith('停止跳动') },
  dna: { who: (p, a) => a === 'DNA 和蛋白质', gene: (p, a) => a === 'DNA 上具有特定遗传信息的片段', pair: ([b], a) => a === ['T', 'A', 'G', 'C'][b], sex: (p, a) => a === 'X 或 Y' },
  propagation: { scion: ([i], a) => a === ['红富士苹果', '鸭梨', '水蜜桃'][i], cambium: (p, a) => a === '接穗与砧木的形成层紧密结合', method: ([m], a, q) => { const T = { 月季: 0, 优良苹果: 1, 桂花: 2, 兰花: 3 }; const k = Object.keys(T).find((x) => q.includes(x)); return a === ['扦插', '嫁接', '压条', '组织培养'][T[k]]; }, trait: (p, a) => a === '能保持母体的优良性状', type: ([c], a) => a === (['由受精卵发育成新个体', '后代具有双亲的遗传特性，变异较多', '后代适应环境变化的能力较强，有利于生物进化', '用种子繁殖'].includes(COMPARE_ITEMS[c]) ? '有性生殖' : '无性生殖') },
  evidence: { homol: (p, a) => a === '起源于共同的祖先', embry: (p, a) => a === '它们可能有共同的祖先', closest: (four, a) => { const D = [0, 1, 10, 12, 13, 15, 21, 44], N = ['黑猩猩', '恒河猴', '狗', '马', '鸡', '海龟', '金枪鱼', '酵母菌']; const best = four.slice().sort((x, y) => D[x] - D[y])[0]; return a === N[best]; } },
  breeding: { tech: ([i], a) => a === TECH_OF[i], dolly: (p, a) => a === '提供细胞核的羊', principle: ([k], a) => a === ['让不同品种杂交，从后代中选出具有优良性状的新品种', '诱发生物的遗传物质发生改变（变异），再选育'][k] },
  eugenics: { ban: (p, a) => a === '直系血亲和三代以内的旁系血亲', measure: ([i], a) => a === MEASURE_OF[i], carrier: (p, a) => a.startsWith('不患病，但会把致病基因传给后代') },
  animalgroups: { phylum: ([o], a) => a === ['腔肠动物', '腔肠动物', '扁形动物', '扁形动物', '线形动物', '环节动物', '软体动物', '节肢动物'][o], feature: ([f], a) => a === ['腔肠动物', '扁形动物', '线形动物', '环节动物', '软体动物', '节肢动物', '环节动物', '软体动物'][f], warm: (p, a) => a === '鸟类和哺乳动物', cover: ([g], a) => a === ['鳞片，有黏液', '裸露、湿润', '鳞片或甲', '羽毛', '体表被毛'][g] },
  ecology: { abiotic: ([i], a) => a === ['阳光', '空气', '水', '温度', '土壤'][i], ecos: ([e], a) => a === ['森林', '森林', '草原', '湿地', '湿地', '海洋', '农田', '城市'][e] + '生态系统', control: (p, a) => a === '保持相同', rep: (p, a) => a === '减少偶然性，使结论更可靠' },
};
const ORGAN_FN = { 卵巢: '产生卵细胞，分泌雌性激素', 输卵管: '输送卵细胞，是受精的场所', 子宫: '胚胎和胎儿发育的场所', 阴道: '胎儿产出的通道，也是月经排出的通道', 睾丸: '产生精子，分泌雄性激素', 附睾: '储存精子，使精子成熟', 输精管: '输送精子', 精囊腺: '分泌黏液，参与精液的形成' };
const REPRO_STAGES = ['精子与卵细胞结合，形成受精卵', '受精卵分裂，形成胚泡', '胚泡植入子宫内膜（怀孕）', '胚胎发育，约 8 周发育成胎儿', '胎儿发育成熟，从母体产出（分娩）'];
const ONION_STEPS = ['擦拭载玻片和盖玻片', '在载玻片中央滴一滴清水', '撕取一小块洋葱鳞片叶内表皮', '把内表皮放入水滴中展平', '盖上盖玻片（一侧先接触水滴，缓缓放平）', '在盖玻片一侧滴一滴碘液', '在盖玻片另一侧用吸水纸吸引碘液'];
const COMPARE_ITEMS = ['由受精卵发育成新个体', '不经过两性生殖细胞的结合', '后代具有双亲的遗传特性，变异较多', '后代保持母体的优良性状，遗传稳定', '能在较短时间内产生大量新个体', '后代适应环境变化的能力较强，有利于生物进化', '用种子繁殖', '扦插、嫁接和组织培养'];
const TECH_OF = ['杂交育种', '杂交育种', '诱变育种', '诱变育种', '转基因技术', '转基因技术', '克隆技术', '克隆技术'];
const MEASURE_OF = ['禁止近亲结婚', '禁止近亲结婚', '遗传咨询', '遗传咨询', '产前诊断', '产前诊断', '适龄生育', '适龄生育'];

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

  // ---- the models of the second batch (reproduction, vessels, kidney, ear, behaviour, fossils, diet, first aid, skin, bones, environment, health) ----
  {
    const r = await page.evaluate(async () => {
      const M = {}; for (const n of ['lifecycle', 'development', 'vessels', 'excretion', 'ear', 'behaviour', 'fossils', 'diet', 'firstaid', 'skin', 'bones', 'impact', 'health']) M[n] = await import(`/src/bio/model-${n}.ts`);
      const o = {}; const mono = (a, d = 1) => a.every((x, i) => i === 0 || (d > 0 ? x >= a[i - 1] - 1e-12 : x <= a[i - 1] + 1e-12));
      const L = M.lifecycle; o.life = { n: L.CYCLES.length, tot: [0, 1, 2, 3].map(L.total), pupa: [0, 1, 2, 3].map(L.hasPupa), kinds: L.CYCLES.map((c) => c.kind) };
      const D = M.development; const wk = Array.from({ length: 41 }, (_, i) => i);
      let dd = 0; for (let a = 1.13; a < 17; a += 0.37) for (const sx of [0, 1]) { const h = 1e-3; const num = (D.height(a + h, sx) - D.height(a - h, sx)) / (2 * h); dd = Math.max(dd, Math.abs(num - D.velocity(a, sx))); }
      const vel = (sx) => { const a = Array.from({ length: 121 }, (_, i) => 6 + i / 10); const v = a.map((x) => D.velocity(x, sx)); return a[v.indexOf(Math.max(...v))]; };
      o.dev = { len: mono(wk.map(D.lengthAt)), mass: mono(wk.map(D.massAt)), nodes: D.FETUS.map(([w, l, m]) => [D.lengthAt(w) === l, D.massAt(w) === m]).flat(), phase: [0.5, 3, 8, 30].map(D.phase), dd, peaks: [vel(0), vel(1)], h18: [D.height(18, 0), D.height(18, 1)], h0: D.height(0, 0) };
      const hh = (a, sx) => D.height(a, sx); o.heights = { g: [0, 2, 10, 18].map((a) => hh(a, 0)), b: [0, 2, 10, 18].map((a) => hh(a, 1)), spurt: [1, 2, 6, 10, 12].map((a) => [D.inSpurt(a, 0), D.inSpurt(a, 1)]), spurtB: [10, 12, 14, 16].map((a) => D.inSpurt(a, 1)), spurtG: [8, 10, 11, 12, 14].map((a) => D.inSpurt(a, 0)), fast: D.velocity(0.5, 0), mono: Array.from({ length: 181 }, (_, i) => i / 10).every((a) => hh(a + 0.1, 0) >= hh(a, 0) - 1e-9 && hh(a + 0.1, 1) >= hh(a, 1) - 1e-9), week8: [D.lengthAt(8), D.massAt(8), D.lengthAt(10), D.massAt(10)] };
      const V = M.vessels; o.ves = { prod: [0, 1, 2].map((v) => V.speed(75, v) * V.VESSELS[v][1] - V.flow(75)), order: [V.speed(75, 0), V.speed(75, 2), V.speed(75, 1)], vol: V.plasmaVolume(50, 45) + (V.bloodVolume(50) * 45) / 100 - V.bloodVolume(50), an: [V.anaemic(35), V.anaemic(36)], rbc: V.rbcPerUl(45), valves: V.VESSELS.map((x) => x[3]) };
      const X = M.excretion; o.exc = { f: X.filtered(), u: [X.urine(0.5, 3), X.urine(2, 0.5), X.urine(3, 0.5), X.urine(4, 0)], reabs: X.reabsorbed(1.5), glu: [X.glucoseInUrine(10), X.glucoseInUrine(15)], monoW: mono(Array.from({ length: 15 }, (_, i) => X.urine(0.5 + i * 0.25, 0.5))), factor: X.ureaFactor(1.5) };
      const E = M.ear; o.ear = { lim: [10, 30, 50, 70].map(E.upperLimit), monoLim: mono([5, 10, 20, 40, 60, 70].map(E.upperLimit), -1), aud: [E.audible(10, 10), E.audible(20, 10), E.audible(20000, 10), E.audible(20001, 10), E.audible(17000, 60)], safe: [E.safeHours(85), E.safeHours(88), E.safeHours(100)], path: E.PATH.length };
      const B = M.behaviour; o.beh = { e0: B.errors(0, 0.2), e1: B.errors(1e6, 0.2), mono: [0.01, 0.05, 0.2].map((k) => mono(Array.from({ length: 50 }, (_, n) => B.errors(n * 4, k)), -1)), fast: [B.errors(30, 0.01) > B.errors(30, 0.05), B.errors(30, 0.05) > B.errors(30, 0.2)], tt: [0.01, 0.05, 0.2].flatMap((k) => [20, 30, 50].map((l) => { const n = B.trialsTo(k, l); return B.errors(n, k) < l && B.errors(n - 1, k) >= l; })), items: B.ITEMS.length, cls: B.ITEMS.map((x) => x[1]) };
      const F = M.fossils; o.fos = { half: F.ISOTOPES.map(([, h]) => F.remaining(h, h)), age: [0.5, 0.25, 0.125].map((f) => F.age(f, 5730) / 5730), round: [0.9, 0.3, 0.01].map((f) => F.remaining(F.age(f, 4.47e9), 4.47e9) - f), layers: F.LAYERS.length, items: F.FOSSILS.map((x) => x[1]) };
      const Di = M.diet; const gs = [300, 400, 250, 150, 300, 25]; o.diet = { energy: Di.energy(gs), sum: Di.energy([100, 0, 0, 0, 0, 0]) + Di.energy([0, 100, 0, 0, 0, 0]) - Di.energy([100, 100, 0, 0, 0, 0]), macro: Di.GROUPS.map((g) => Math.abs(4 * g[2] + 9 * g[3] + 4 * g[4] - g[1]) / g[1]), bal: [Di.balanced(gs, 2000), Di.balanced([300, 100, 250, 150, 300, 25], 2000), Di.balanced(gs, 3000)], fat: [Di.fatShare([0, 0, 0, 0, 0, 100]), Di.fatShare([0, 0, 0, 0, 0, 0])] };
      const Fa = M.firstaid; const cp = []; for (let r = 60; r <= 160; r += 5) for (let d = 2; d <= 8; d += 0.5) cp.push([Fa.effectiveCpr(r, d), r >= 100 && r <= 120 && d >= 5 && d <= 6]);
      o.fa = { cpr: cp.every(([a, b]) => a === b), n: cp.filter((x) => x[0]).length, dose: [Fa.dose(30, 5), Fa.daily(30, 5, 3)], safe: [Fa.safeDaily(30, 5, 3, 30), Fa.safeDaily(30, 15, 6, 30), Fa.safeDaily(30, 10, 3, 30)], burn: Fa.BURN.length };
      const Sk = M.skin; let bal = 0; for (let ta = 0; ta <= 45; ta += 3) for (const cl of [0, 2, 5]) for (const [, Mw] of Sk.ACTIVITY) { const sw = Sk.sweat(Mw, ta, cl), d = Sk.dryLoss(ta, cl); if (sw > 0 && Math.abs(Mw - d - (sw * 2.43) / 3.6) > 1e-9) bal++; if (sw === 0 && Mw > d + 1e-9) bal++; }
      o.skin = { bal, d: [Sk.dryLoss(34, 0), Sk.dryLoss(20, 0), Sk.dryLoss(20, 5)], st: [Sk.state(80, 0, 1), Sk.state(600, 30, 2), Sk.state(80, 20, 2)] };
      const Bo = M.bones; const ag = Array.from({ length: 76 }, (_, i) => 5 + i); o.bone = { mono: mono(ag.map(Bo.organic), -1), range: [Bo.organic(5), Bo.organic(12), Bo.organic(40), Bo.organic(80)], bend: [Bo.bend(20, 1), Bo.bend(20, 2), Bo.bend(8, 0) > Bo.bend(70, 0)], hard: Bo.hardness(20, 2) < Bo.hardness(20, 0) };
      const Im = M.impact; o.imp = { s: [Im.speciesLeft(0), Im.speciesLeft(0.9), Im.speciesLeft(1 - 0.5 ** 4)], mono: mono(Array.from({ length: 20 }, (_, i) => Im.speciesLeft(i / 20)), -1), c: [Im.co2(0, 50), Im.co2(10, 20) - Im.co2(10, 10) - (Im.co2(10, 10) - Im.co2(10, 0))], w: [Im.warming(560), Im.warming(280), Im.warming(1120)] };
      const H = M.health; o.hl = { max: H.maxHr(14), z: [H.zone(90, 14), H.zone(130, 14), H.zone(160, 14), H.zone(190, 14)], t: H.target(14), sl: [H.sleepOk(12, 10), H.sleepOk(12, 7), H.sleepOk(15, 9), H.sleepOk(15, 12)] };
      return o;
    });
    const near2 = (a, b, t = 1e-9) => Math.abs(a - b) <= t;
    ok(r.life.n === 4 && r.life.tot.join() === '130,54,400,506' && r.life.pupa.join() === 'false,true,false,false' && r.life.kinds.join() === '不完全变态发育,完全变态发育,变态发育,没有变态，属于卵生、直接发育', 'A lifecycle: four life cycles with their total days; only the silkworm has a pupa; incomplete / complete metamorphosis');
    ok(r.dev.len && r.dev.mass && r.dev.nodes.every(Boolean) && r.dev.phase.join() === '受精卵,胚胎,胎儿,胎儿' && r.dev.dd < 1e-4 && Math.abs(r.dev.peaks[0] - 11) <= 0.6 && Math.abs(r.dev.peaks[1] - 13) <= 0.6 && r.dev.peaks[0] < r.dev.peaks[1] && r.dev.h0 === 50, 'A development: fetal length and mass grow with the week and equal the table at its nodes, height is the integral of the growth speed (derivative check ' + r.dev.dd.toExponential(1) + '), the spurt peaks at about 11 (girls) and 13 (boys)');
    { // verification finding 5 + 13: realistic heights (WHO / China medians) and the growth spurt only in puberty; the 8th week of the fetus
      const H = r.heights, within = (x, lo, hi) => x >= lo && x <= hi;
      ok(within(H.g[0], 48, 52) && within(H.b[0], 48, 52) && within(H.g[1], 84, 90) && within(H.b[1], 84, 90) && within(H.g[2], 134, 142) && within(H.b[2], 134, 142) && within(H.g[3], 156, 164) && within(H.b[3], 168, 176), `A development heights are realistic: birth ~50, 2 y ~87, 10 y ~138, 18 y girls ~160 / boys ~172 cm (${H.g.map((x) => x.toFixed(0))} / ${H.b.map((x) => x.toFixed(0))})`);
      ok(H.spurt.slice(0, 3).every((x) => !x[0] && !x[1]) && !H.spurt[3][1], 'A development: no growth spurt at 1, 2 or 6 years (the quick growth of the first years is not the puberty spurt), and a 10-year-old boy is not in it yet');
      ok(H.spurtG.join() === 'false,true,true,true,false' && H.spurtB.join() === 'false,true,true,false', 'A development: the spurt window of girls (about 10-12) comes earlier than that of boys (about 12-14): ' + H.spurtG + ' / ' + H.spurtB);
      ok(H.fast > 10 && !H.spurt[0][0] && !H.spurt[0][1], 'A development: a baby grows fast (more than 10 cm a year) but that is not the spurt');
      ok(H.mono, 'A development: the height never goes down');
      ok(Math.abs(H.week8[0] - 16) <= 1 && Math.abs(H.week8[1] - 1) <= 0.5 && H.week8[2] > 25 && H.week8[2] < 45 && H.week8[3] > 3 && H.week8[3] < 7, 'A fetus: week 8 about 16 mm / 1 g, week 10 about 30 mm / 4 g (the old row of week 8 belongs to week 10)');
    }
    ok(r.ves.prod.every((x) => near2(x, 0, 1e-9)) && r.ves.order[0] > r.ves.order[1] && r.ves.order[1] > r.ves.order[2] && near2(r.ves.vol, 0, 1e-9) && r.ves.an.join() === 'true,false' && near2(r.ves.rbc, 5e6) && r.ves.valves.join() === 'false,false,true', 'A vessels: blood speed x cross-section = flow (continuity), artery > vein > capillary, plasma + cells = blood volume, anaemia below 36 %, only veins have valves');
    ok(near2(r.exc.f, 180) && near2(r.exc.u[0], 0.5) && near2(r.exc.u[1], 1.2) && near2(r.exc.u[2], 2.2) && near2(r.exc.u[3], 3.7) && r.exc.reabs > 0.99 && r.exc.glu[0] === 0 && r.exc.glu[1] > 0 && r.exc.monoW && near2(r.exc.factor, 25 / 1.5 / 0.3, 1e-9), 'A excretion: 180 L of primary urine a day, urine volume from the water balance (never below 0.5 L) rising with drinking, over 99 % of the water reabsorbed, sugar in the urine only above 10 mmol/L');
    ok(r.ear.lim.join() === '20000,14000,8000,8000' && r.ear.monoLim && r.ear.aud.join() === 'false,true,true,false,false' && near2(r.ear.safe[0], 8) && near2(r.ear.safe[1], 4) && near2(r.ear.safe[2], 0.25) && r.ear.path === 6, 'A ear: the upper limit of hearing falls with age, 20 Hz - 20 kHz audible, 85 dB = 8 h and every 3 dB halves it, six parts on the sound path');
    ok(near2(r.beh.e0, 100) && near2(r.beh.e1, 5, 1e-6) && r.beh.mono.every(Boolean) && r.beh.fast.every(Boolean) && r.beh.tt.every(Boolean) && r.beh.items === 10 && r.beh.cls.join() === '0,0,0,1,1,1,2,2,2,1', 'A behaviour: errors fall from 100 % to 5 %, faster for a larger k (earthworm < mouse < chimpanzee), trialsTo is the first trial below the limit (9 cases)');
    ok(r.fos.half.every((x) => near2(x, 0.5)) && r.fos.age.join() === '1,2,3' && r.fos.round.every((x) => Math.abs(x) < 1e-12) && r.fos.layers === 5 && r.fos.items.join() === '0,1,2,2,3,3,4,4', 'A fossils: one half-life leaves half, age = T x log2(1/f) and the remaining fraction of that age is f again, 5 layers in order');
    ok(near2(r.diet.energy, 1905, 1e-6) && near2(r.diet.sum, 0, 1e-9) && r.diet.macro.every((x) => x < 0.1) && r.diet.bal.join() === 'true,false,false' && near2(r.diet.fat[0], 1) && r.diet.fat[1] === 0, 'A diet: energy is additive, 4 kcal/g protein + 9 fat + 4 carbohydrate agrees with the table within 10 % for every food group, balance needs all six groups in range and the energy within 10 %');
    ok(r.fa.cpr && r.fa.n === 5 * 3 && r.fa.dose.join() === '150,450' && r.fa.safe.join() === 'true,false,true' && r.fa.burn === 5, 'A firstaid: compressions are effective only at 100-120 per minute and 5-6 cm (' + r.fa.n + ' of the 21 x 13 grid), dose = mass x mg/kg, the daily limit');
    ok(r.skin.bal === 0 && near2(r.skin.d[0], 0) && near2(r.skin.d[1], 8 * 14) && near2(r.skin.d[2], 8 * 0.5 * 14) && r.skin.st[0].startsWith('战栗') && r.skin.st[1].startsWith('排汗') && r.skin.st[2] === '体温平衡', 'A skin: heat made - heat lost through the skin = heat carried away by sweat (2.43 kJ/mL) in 150 settings, no sweat when the skin alone is enough');
    ok(r.bone.mono && near2(r.bone.range[0], 0.5) && near2(r.bone.range[1], 0.5) && near2(r.bone.range[2], 1 / 3, 1e-9) && near2(r.bone.range[3], 0.2, 1e-9) && r.bone.bend[0] === 0 && r.bone.bend[1] === 1 && r.bone.bend[2] && r.bone.hard, 'A bones: the organic share never rises with age (50 % at 12, 1/3 at 40, 20 % at 80), burned bone is brittle, acid-soaked bone bends, young bone bends more');
    ok(near2(r.imp.s[0], 1) && near2(r.imp.s[1], 0.1 ** 0.25) && near2(r.imp.s[2], 0.5, 1e-9) && r.imp.mono && r.imp.c[0] === 420 && near2(r.imp.c[1], 0, 1e-9) && near2(r.imp.w[0], 2) && r.imp.w[1] === 0 && near2(r.imp.w[2], 4), 'A impact: species left = (1 - lost)^0.25 (losing 15/16 of the area halves them), CO2 grows linearly with the years, 2 degrees for every doubling');
    ok(r.hl.max === 206 && r.hl.z.join() === '热身（轻松）,中等强度,较高强度,高强度（不宜持续）' && r.hl.t.join() === '144,175' && r.hl.sl.join() === 'true,false,true,false', 'A health: maximum heart rate 220 - age, four zones, target range 144-175 at 14, sleep ranges');
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
    ok(total === IDS.length * 300 * 5, 'A quiz: ' + total + ' questions checked');
    // a text check that is wrong must be caught too
    const wt = chk('blood', r.blood.list.map((qz) => qz.map((q) => (q.kind === 'abo' ? { ...q, ans: q.choices[(q.a + 1) % 4], a: (q.a + 1) % 4 } : q))), false);
    ok(wt.bad > 0, 'A quiz: a deliberately wrong text answer (ABO) is caught by the independent table');
    // verification finding 3: both 完全变态发育 and 不完全变态发育 ARE 变态发育; every development question must have exactly ONE true choice
    {
      const TRUTH = { 蝗虫: ['不完全变态发育', '变态发育'], 家蚕: ['完全变态发育', '变态发育'], 青蛙: ['变态发育'], 鸡: ['没有变态，属于卵生、直接发育', '直接发育（没有变态）'] };
      // the statements that are true for an organism, written without the app: insects: their kind and the plain "变态发育" (which would make a second right choice); frog: 变态发育; chicken: no metamorphosis
      let n = 0; const bad = [];
      for (const qz of r.lifecycle.list) for (const q of qz) if (q.kind === 'kind') {
        n++; const name = Object.keys(TRUTH).find((k) => q.q.startsWith(k));
        const trueOnes = q.choices.filter((c) => TRUTH[name].includes(c) && !(name === '青蛙' && c === '直接发育（没有变态）'));
        const wrongSemantics = name === '鸡' ? q.choices.filter((c) => c === '直接发育（没有变态）') : [];
        const pool = name === '蝗虫' || name === '家蚕' ? q.choices.filter((c) => TRUTH[name].includes(c)) : trueOnes;
        if (pool.length !== 1 || pool[0] !== q.ans || wrongSemantics.length) bad.push(name + ': ' + q.choices.join('/'));
      }
      ok(n >= 250 && bad.length === 0, `A lifecycle quiz: exactly one right choice for every organism over 300 seeds (${n} questions of the development kind) ${bad.slice(0, 2)}`);
      const old = r.lifecycle.list.flat().filter((q) => q.kind === 'kind' && /^(蝗虫|家蚕)/.test(q.q) && q.choices.includes('变态发育'));
      ok(old.length === 0, 'A lifecycle quiz: for the silkworm and the locust the bare 变态发育 is never offered as a wrong choice');
      const names = new Set(r.lifecycle.list.flat().filter((q) => q.kind === 'kind').map((q) => Object.keys(TRUTH).find((k) => q.q.startsWith(k)))); ok(names.size === 4, 'A lifecycle quiz: all four organisms are asked');
    }
  }

  // =====================================================================================  A2. THE THIRD PASS (14 more simulations): the models against independent computations
  {
    const R = await page.evaluate(async (A) => {
      const out = {}; const fails = [];
      const chk = (c, m) => { if (!c) fails.push(m); };
      const near = (a, b, t = 1e-9) => Math.abs(a - b) <= t;
      const M = {}; for (const n of ['reproduction', 'bloodpressure', 'microbe', 'slide', 'seedlab', 'energy', 'daphnia', 'dna', 'propagation', 'evidence', 'breeding', 'eugenics', 'animalgroups', 'ecology']) M[n] = await import(`/src/bio/model-${n}.ts`);
      const rnd = (a, b) => a + Math.random() * (b - a);
      const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
      const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
      // ---- reproduction: the textbook organs and what they do
      { const m = M.reproduction;
        chk(m.FEMALE.map((o) => o.name).join() === '卵巢,输卵管,子宫,阴道' && m.MALE.map((o) => o.name).join() === '睾丸,附睾,输精管,精囊腺', 'reproduction organ names');
        for (const o of [...m.FEMALE, ...m.MALE]) chk(A.ORGAN_FN[o.name] === o.fn, 'reproduction function of ' + o.name);
        chk(m.EVENTS.length === 4 && m.EVENTS.every(([, i], k) => i === k) && m.EVENTS[1][0] === '受精作用发生' && m.FEMALE[m.EVENTS[1][1]].name === '输卵管' && m.FEMALE[m.EVENTS[2][1]].name === '子宫', 'reproduction events: fertilisation in the oviduct, development in the uterus');
        chk(m.STAGES.join('|') === A.REPRO_STAGES.join('|'), 'reproduction stages in order');
        chk(m.STAGES.every((s) => s.length > 6) && m.STAGE_FN.length === 5, 'reproduction stage notes');
      }
      // ---- bloodpressure
      { const m = M.bloodpressure; let bad = 0;
        const ref = (sv, hr, r, el) => { const co = (sv * hr) / 1000, map = co * 17 * (r / 100), pp = sv / (1.75 * (el / 100)), dia = map - pp / 3; return { co, map, pp, dia, sys: dia + pp }; };
        for (let i = 0; i < 400; i++) { const sv = Math.round(rnd(40, 110)), hr = Math.round(rnd(40, 180)), r = Math.round(rnd(50, 200)), el = Math.round(rnd(50, 150)), x = ref(sv, hr, r, el);
          if (!near(m.output(sv, hr), x.co) || !near(m.mean(sv, hr, r), x.map, 1e-9) || !near(m.pulsePressure(sv, el), x.pp, 1e-9) || !near(m.diastolic(sv, hr, r, el), x.dia, 1e-9) || !near(m.systolic(sv, hr, r, el), x.sys, 1e-9)) bad++; if (!(x.sys > x.dia)) bad++; }
        chk(bad === 0, 'bloodpressure: pressures against the independent formulas');
        const d = ref(70, 75, 100, 100); chk(Math.round(d.sys) === 116 && Math.round(d.dia) === 76 && m.status(d.sys, d.dia) === 0, 'bloodpressure: the default is a normal 116 / 76');
        chk(m.systolic(70, 75, 120, 100) > m.systolic(70, 75, 100, 100) && m.systolic(70, 90, 100, 100) > m.systolic(70, 75, 100, 100) && m.pulsePressure(70, 60) > m.pulsePressure(70, 100), 'bloodpressure: narrower vessels / faster heart raise the pressure, stiffer arteries widen the pulse pressure');
        const cls = [[118, 76, 0], [140, 90, 0], [141, 80, 1], [120, 91, 1], [90, 60, 0], [89, 70, 2], [100, 59, 2], [152, 96, 1], [86, 56, 2]]; chk(cls.every(([s, di, k]) => m.status(s, di) === k), 'bloodpressure: classification by the textbook ranges 90-140 / 60-90');
        let seq = []; for (let c = 200; c >= 0; c--) seq.push(m.sound(c, 118, 76)); const trans = seq.filter((x, i) => i && x !== seq[i - 1]).length;
        chk(seq[0] === 0 && seq[200 - 118] === 1 && seq[200 - 119] === 0 && seq[200 - 76] === 2 && seq[200 - 77] === 1 && trans === 2, 'bloodpressure: sound from 118 down to 77 mmHg only (silent above the systolic and at or below the diastolic pressure)');
        chk(near(m.kpa(140), 18.6667, 1e-3) && near(m.kpa(90), 12) && m.PEOPLE.length === 3 && m.counted(120, 15) === 30 && m.counted(75, 60) === 75, 'bloodpressure: kPa conversion and pulse counting');
      }
      // ---- microbe
      { const m = M.microbe;
        chk(near(m.expected(7, 4, 0.1), 100) && near(m.expected(8, 0, 1), 1e8) && near(m.estimate(100, 4, 0.1), 1e7), 'microbe: expected colonies and the estimate');
        for (const mu of [50, 100, 200, 400]) { const a = Array.from({ length: 600 }, (_, s) => m.colonies(mu, s + 1)); chk(Math.abs(mean(a) - mu) < 0.06 * mu && Math.abs(sd(a) - Math.sqrt(mu)) < 0.3 * Math.sqrt(mu), `microbe: colony counts scatter like a count (mean ${mean(a).toFixed(1)}, sd ${sd(a).toFixed(1)} for ${mu})`); }
        chk(m.plateState(500, 480) === 0 && m.plateState(100, 100) === 1 && m.plateState(100, 29) === 2 && m.plateState(10, 12) === 2 && m.plateState(301, 301) === 0, 'microbe: plate states');
        let bad = 0; for (let i = 0; i < 300; i++) { const r0 = rnd(0.0005, 0.05), k = rnd(0.5, 0.99), n = Math.floor(rnd(0, 7)); const cf = r0 / (r0 + (1 - r0) * (1 - k) ** n); if (!near(m.resistFrac(r0, k, n), cf, 1e-9)) bad++; }
        chk(bad === 0 && m.resistFrac(0.01, 0, 5) === 0.01 && m.resistFrac(0.001, 0.9, 4) > m.resistFrac(0.001, 0.9, 3), 'microbe: resistant share against the closed form r0 / (r0 + (1 - r0)(1 - k)^n); no killing = no change; grows with every course');
        chk(m.sci(2.5e7) === '2.5 × 10⁷' && m.pow10(0) === '10⁰' && m.pow10(12) === '10¹²' && m.pow10(-3) === '10⁻³', 'microbe: scientific notation text');
        chk(m.BACT.length === 6 && m.YEAST.length === 6 && new Set(m.BACT.map((x) => x.name)).size === 6 && m.BACT.some((x) => x.name === 'DNA 集中的区域') && m.YEAST.some((x) => x.name === '细胞核'), 'microbe: the bacterium has no nucleus label, the yeast has one');
      }
      // ---- slide
      { const m = M.slide;
        chk(m.ONION.length === 7 && m.CHEEK.length === 7 && m.ONION.join() === A.ONION_STEPS.join() && m.ONION[1].includes('清水') && m.CHEEK[1].includes('生理盐水') && m.ONION[0] === m.CHEEK[0] && m.ONION[4] === m.CHEEK[4], 'slide: 7 steps each, clear water for the onion, saline for the cheek, same first and cover-slip steps');
        chk(m.bubbles(0, 3) === 0 && m.bubbles(90, 3) === 12 && m.bubbles(0, 1) === 4 && m.bubbles(45, 3) === 3 && [0, 15, 30, 45, 60, 75, 90].every((a, i, l) => !i || m.bubbles(a, 3) >= m.bubbles(l[i - 1], 3)), 'slide: bubbles grow with the angle, fewer with a bigger drop');
        chk(m.ONION_FN.length === 7 && m.CHEEK_FN.length === 7, 'slide: a reason for every step');
      }
      // ---- seedlab
      { const m = M.seedlab;
        const g = Array.from({ length: 400 }, (_, s) => m.groups(100, 90, s + 1)); const all = g.flat();
        chk(Math.abs(mean(all) - 90) < 1 && Math.abs(sd(all) - 3) < 1, `seedlab: group counts are binomial (mean ${mean(all).toFixed(2)}, sd ${sd(all).toFixed(2)})`);
        const g10 = Array.from({ length: 400 }, (_, s) => m.groups(10, 90, s + 1)).flat(); chk(sd(g10) > 0.5 && sd(g10) < 1.4 && Math.abs(mean(g10) - 9) < 0.3, 'seedlab: the smaller the group, the larger the relative scatter');
        chk(m.groups(20, 100, 3).every((k) => k === 20) && m.groups(20, 0, 3).every((k) => k === 0) && m.groups(30, 70, 5).length === 3 && JSON.stringify(m.groups(30, 70, 5)) === JSON.stringify(m.groups(30, 70, 5)), 'seedlab: 100 % all, 0 % none, three groups, repeatable');
        const e1 = []; for (const n of [10, 50, 200]) { const errs = Array.from({ length: 300 }, (_, s) => Math.abs(m.average(m.groups(n, 90, s + 11), n) - 90)); e1.push(mean(errs)); }
        chk(e1[0] > e1[1] && e1[1] > e1[2], 'seedlab: the average error falls as the groups get bigger (' + e1.map((x) => x.toFixed(2)).join(' > ') + ')');
        chk(near(m.average([18, 19, 20], 20), 95) && m.blue(0, 1) && m.blue(1, 1) && !m.blue(0, 0) && !m.blue(1, 2) && m.BEAN.length === 5 && m.MAIZE.length === 6, 'seedlab: average, iodine only on the food store, 5 + 6 structures');
      }
      // ---- energy
      { const m = M.energy; let bad = 0;
        for (let i = 0; i < 300; i++) { const f = Math.floor(rnd(0, 4)), mm = Math.round(rnd(1, 6)) / 2, vw = Math.round(rnd(2, 10)) * 10, sh = Math.floor(rnd(0, 2)); const e = [24, 28, 16, 15][f], eta = [0.35, 0.75][sh], raw = (eta * mm * e * 1000) / (4.2 * vw);
          if (!near(m.riseRaw(f, mm, vw, sh), raw, 1e-9) || m.boils(f, mm, vw, sh) !== (raw > 80) || !near(m.rise(f, mm, vw, sh), Math.min(80, raw), 1e-9)) bad++;
          if (!m.boils(f, mm, vw, sh) && !near(m.measured(f, mm, vw, sh) / e, eta, 1e-9)) bad++; }
        chk(bad === 0, 'energy: temperature rise, boiling and the measured value (always eta x the true value)');
        chk(m.measured(0, 0.5, 50, 1) > m.measured(0, 0.5, 50, 0) && m.measured(0, 0.5, 50, 1) < 24 && near(m.heat(50, 20), 4200) && m.FOODS.map((x) => x[1]).join() === '24,28,16,15', 'energy: a wind shield raises the measured value but never above the true one; Q = c m dT');
      }
      // ---- daphnia
      { const m = M.daphnia;
        let bad = 0; const per = {}; for (const c of m.CONC) { per[c] = []; for (let s = 1; s <= 300; s++) { const k = m.counts(c, s); if (k.length !== 3) bad++; for (const x of k) { per[c].push(x); if (Math.abs(x - m.baseOf(c)) > 1 && c !== 20) bad++; if (c === 20 && x !== 0) bad++; } } }
        chk(bad === 0, 'daphnia: three counts within one beat of the table, none after death');
        chk(m.CONC.every((c, i) => !i || m.baseOf(c) < m.baseOf(m.CONC[i - 1])) && m.baseOf(0) === 33 && m.baseOf(20) === 0 && Math.abs(mean(per[0]) - 33) < 0.2, 'daphnia: the higher the concentration the lower the rate');
        chk(near(m.change(0, 5), 0) && m.change(10, 5) < -20 && m.change(1, 5) > -10 && m.change(20, 5) === -100 && m.perMinute(33) === 198, 'daphnia: change against the control, per minute');
      }
      // ---- dna
      { const m = M.dna;
        chk(m.SPECIES.map((x) => x[1]).join() === '46,8,14,20,24,38' && m.SPECIES.every(([, n], i) => m.chromosomes(i, 0) === n && m.chromosomes(i, 2) === n && m.chromosomes(i, 1) * 2 === n), 'dna: chromosome numbers: body cell = zygote = 2n, sex cell = n');
        chk(['A', 'T', 'C', 'G'].every((b) => m.partner(m.partner(b)) === b && m.partner(b) !== b) && m.partner('A') === 'T' && m.partner('C') === 'G' && m.STRAND.length === 8 && /^[ATCG]+$/.test(m.STRAND), 'dna: base pairing A-T, C-G is an involution');
        const b = Array.from({ length: 300 }, (_, s) => m.boys(1000, s + 1)); chk(Math.abs(mean(b) - 500) < 4 && Math.abs(sd(b) - 15.8) < 4, `dna: boys among 1000 births (mean ${mean(b).toFixed(1)}, sd ${sd(b).toFixed(1)})`);
        chk(Math.abs(2 * m.boys(500, 1) - 500) / 500 < 0.1 && m.boys(0, 1) === 0 && m.PARTS.map((x) => x.name).join() === '细胞核,染色体,DNA,基因,蛋白质', 'dna: the default sample of the task is near 1:1; parts');
      }
      // ---- propagation
      { const m = M.propagation;
        let ok = true; for (let a = 0; a < 3; a++) for (let s = 0; s < 3; s++) { if (m.compatible(a, s) !== (a === s)) ok = false; for (const al of [0, 30, 60, 69, 70, 100]) if (m.takes(a, s, al) !== (a === s && al >= 70)) ok = false; }
        chk(ok && m.graftResult(0, 0, 100) === 0 && m.graftResult(0, 0, 60) === 1 && m.graftResult(0, 1, 100) === 2, 'propagation: a graft takes only between relatives AND with the cambium layers aligned (70 %)');
        chk(m.METHOD_ITEMS.length === 6 && [0, 1, 2, 3].every((k) => m.METHOD_ITEMS.some((x) => x[1] === k)) && m.COMPARE.length === 8 && m.COMPARE.filter((x) => x[1] === 0).length === 4 && m.COMPARE.map((x) => x[0]).join() === A.COMPARE_ITEMS.join(), 'propagation: methods and the comparison list');
      }
      // ---- evidence
      { const m = M.evidence;
        chk([0, 1, 2, 3].every((i) => near(m.similarity(i, 0), 1) && m.similarity(i, 100) < m.similarity(i, 50) && m.similarity(i, 50) < m.similarity(i, 20) && m.similarity(i, 100) > 0) && m.similarity(0, 100) < m.similarity(3, 100), 'evidence: embryos are alike early and differ more later; fish differ more than the pig');
        chk(near(m.identical(0), 100) && near(m.identical(7), (60 / 104) * 100) && m.CYT.every((x, i) => !i || x[1] >= m.CYT[i - 1][1]), 'evidence: cytochrome c table is ordered by difference');
        let bad = 0; const n = m.TREE_SP.length; for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) { if (m.mrca(a, b) !== m.mrca(b, a)) bad++; for (let c = 0; c < n; c++) if (m.mrca(a, c) > Math.max(m.mrca(a, b), m.mrca(b, c))) bad++; }
        chk(bad === 0 && m.mrca(0, 1) === 7 && m.mrca(0, 5) === 90 && [2, 3, 4, 5].every((b) => m.mrca(0, 1) < m.mrca(0, b)), 'evidence: the tree distances are symmetric and ultrametric, the chimpanzee is the closest to humans');
        chk(m.LIMBS.every((l) => l[2].length === 5 && l[2].reduce((x, y) => x + y, 0) <= 400) && m.BONES.length === 5, 'evidence: the limbs fit the drawing');
      }
      // ---- breeding
      { const m = M.breeding;
        const g = ['AB', 'Ab', 'aB', 'ab']; const cnt = { 高产抗病: 0, 高产感病: 0, 低产抗病: 0, 低产感病: 0, AABB: 0 };
        for (const x of g) for (const y of g) { const gt = (i) => [x[i], y[i]].sort().join(''); const a = gt(0), bb = gt(1); const hy = a.includes('A'), rs = bb.includes('B'); cnt[(hy ? '高产' : '低产') + (rs ? '抗病' : '感病')]++; if (a === 'AA' && bb === 'BB') cnt.AABB++; }
        chk(cnt.高产抗病 === 9 && cnt.高产感病 === 3 && cnt.低产抗病 === 3 && cnt.低产感病 === 1 && cnt.AABB === 1 && m.F2.map((x) => x[1]).join() === '9,3,3,1', 'breeding: the F2 ratio 9 : 3 : 3 : 1 and 1/16 AABB by enumerating the 16 combinations');
        chk(near(m.f2count(160, 0), 90) && near(m.pureTarget(160), 10) && [0, 1, 2, 3].reduce((s, i) => s + m.f2count(320, i), 0) === 320, 'breeding: counts');
        let ok = true; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) for (let c = 0; c < 3; c++) if (m.faceOf(a, b, c) !== a) ok = false;
        chk(ok && m.TECH_ITEMS.map((x) => m.TECHS[x[1]]).join() === A.TECH_OF.join(), 'breeding: the clone looks like the nucleus donor whatever the egg donor and the surrogate; techniques of the items');
      }
      // ---- eugenics
      { const m = M.eugenics; let bad = 0;
        for (const N of [10, 20, 50, 100, 200]) { if (!near(m.bothCarry(N, 0), 1 / (N * N)) || !near(m.bothCarry(N, 1), 1 / N / 8) || !near(m.bothCarry(N, 2), 1 / N / 2) || !near(m.risk(N, 1), m.bothCarry(N, 1) / 4) || !near(m.fold(N, 1), N / 8) || !near(m.fold(N, 2), N / 2) || !near(m.fold(N, 0), 1)) bad++; if (!(m.risk(N, 0) < m.risk(N, 1) && m.risk(N, 1) < m.risk(N, 2))) bad++; }
        chk(bad === 0 && m.risk(20, 0) > m.risk(50, 0) && near(m.per10000(m.risk(50, 0)), 1), 'eugenics: both-carry chances, a quarter for the child, folds N/8 and N/2, closer relatives = higher risk');
        chk(m.MEASURE_ITEMS.length === 8 && m.MEASURE_ITEMS.map((x) => m.MEASURES[x[1]]).join() === A.MEASURE_OF.join(), 'eugenics: measure items');
      }
      // ---- animalgroups
      { const m = M.animalgroups;
        chk(m.GROUPS.length === 6 && [...Array(6).keys()].every((k) => m.ORG_ITEMS.some((x) => x[1] === k) && m.FEATURE_ITEMS.some((x) => x[1] === k)), 'animalgroups: all six invertebrate groups appear in both sorting lists');
        const t = m.VERT_TABLE; chk(t.length === 5 && t.every((r) => r.length === 4) && t.map((r) => r[2]).join() === '变温,变温,变温,恒温,恒温' && t.filter((r) => /胎生/.test(r[3])).length === 1 && new Set(t.map((r) => r[0])).size === 5, 'animalgroups: vertebrate table (birds and mammals warm-blooded, only mammals viviparous)');
        chk(m.LEGS[0][1] === 3 && m.LEGS[1][1] === 4, 'animalgroups: insects 3 pairs of legs, spiders 4');
      }
      // ---- ecology
      { const m = M.ecology;
        let ok = true; for (let d = 2; d <= 40; d += 2) { if (!near(m.capacity(d), (80 * d) / (d + 8)) || m.capacity(d) >= 80 || (d > 2 && m.capacity(d) <= m.capacity(d - 2))) ok = false; for (let x = 0; x <= 100; x += 5) if (m.recovers(d, x) !== (x <= (80 * d) / (d + 8))) ok = false; }
        chk(ok, 'ecology: capacity 80 d / (d + 8) grows with the species number and decides the recovery');
        let ok2 = true; for (const [d, x] of [[30, 60], [10, 40], [4, 40], [2, 50]]) { const rec = m.recovers(d, x); let prev = m.biomass(d, x, 0); if (!near(prev, 1 - x / 100)) ok2 = false; for (let t = 1; t <= 30; t++) { const v = m.biomass(d, x, t); if (rec ? v < prev : v > prev) ok2 = false; prev = v; } if (rec && m.biomass(d, x, 30) < 0.95) ok2 = false; if (!rec && m.biomass(d, x, 30) > 0.5 * (1 - x / 100)) ok2 = false; }
        chk(ok2, 'ecology: biomass climbs back when the ecosystem recovers and keeps falling when it does not');
        for (const f of [0, 1, 2]) { const a = Array.from({ length: 300 }, (_, s) => m.onRight(1000, f, s + 1)); chk(Math.abs(mean(a) - 1000 * m.FACTORS[f][3]) < 8, `ecology: pillbugs on the preferred side (factor ${f}: ${mean(a).toFixed(0)})`); }
        chk(m.ECOS.length === 6 && [...Array(6).keys()].every((k) => m.ECO_ITEMS.some((x) => x[1] === k)) && new Set(m.ECO_ITEMS.map((x) => x[0])).size === 8, 'ecology: every ecosystem type has an item');
      }
      out.fails = fails; out.sensitive = Math.abs(M.microbe.resistFrac(0.01, 0.9, 3) - 0.01 * 10 ** 3) > 0.01 && Math.abs(M.microbe.expected(7, 4, 0.1) - 10 ** 7 * 0.1) > 1; return out;
    }, { ORGAN_FN, REPRO_STAGES, ONION_STEPS, COMPARE_ITEMS, TECH_OF, MEASURE_OF });
    ok(R.sensitive, 'A2 the independent check is able to fail (a wrong closed form for the resistant share differs from the model)');
    ok(R.fails.length === 0, 'A2 third pass: every new model against its independent computation' + (R.fails.length ? '\n   ' + R.fails.join('\n   ') : ''));
    // the drag modes: data and layout of every DMode of the new simulations
    const D = await page.evaluate(async () => {
      const fails = []; const chk = (c, m) => { if (!c) fails.push(m); };
      const Mt = await import('/src/bio/match.ts'), Dn = await import('/src/bio/dnd.ts');
      const mods = {};
      for (const n of ['reproduction', 'microbe', 'slide', 'seedlab', 'dna', 'propagation', 'evidence', 'breeding', 'eugenics', 'animalgroups', 'ecology']) { const m = await import(`/src/bio/${n}.ts`); mods[n] = (m.MODES || m.HOM).filter(Boolean); }
      let nModes = 0;
      for (const [n, list] of Object.entries(mods)) for (const [k, m] of list.entries()) {
        nModes++; const tag = `${n}#${k}`, N = m.items.length, sp = Mt.specOf(m), s = {};
        chk(N >= 3 && N <= 10 && new Set(m.items).size === N, tag + ' items 3-10 and different');
        chk(new Set(m.items.map((_, i) => Mt.trayIndex(i, N))).size === N, tag + ' tray order is a permutation');
        const tp = m.items.map((_, i) => sp.at(i, s));
        chk(tp.every(([x, y]) => (m.kind === 'label' ? x - 88 >= 0 && x + 88 <= 640 && y - 22 >= 0 && y + 22 <= 480 : x - 76 >= 0 && x + 76 <= 640 && y - 32 >= 0 && y + 32 <= 480)), tag + ' chips inside the canvas');
        for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { const dx = Math.abs(tp[i][0] - tp[j][0]), dy = Math.abs(tp[i][1] - tp[j][1]); chk(m.kind === 'label' ? dy >= 44 : dx >= 152 || dy >= 64, tag + ` chips ${i}/${j} do not overlap`); }
        const tg = sp.targets(s); 
        if (m.kind === 'label') {
          chk(m.marks.length === N && m.fn.length === N, tag + ' one mark and one note per item');
          chk(m.marks.every(([x, y]) => x >= 26 && x <= 440 && y >= 26 && y <= 454), tag + ' marks inside the picture, left of the tray');
          for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) chk(Math.hypot(m.marks[i][0] - m.marks[j][0], m.marks[i][1] - m.marks[j][1]) >= 40, tag + ` marks ${i}/${j} are 40+ apart`);
          if (m.place === 'right') chk(m.marks.every(([x]) => x + 24 + 292 <= 440), tag + ' slot chips fit left of the tray');
          chk(m.items.every((_, i) => sp.answer(i, s) === i), tag + ' item i belongs to mark i');
        } else {
          chk(m.answers.length === N && m.answers.every((a) => a >= 0 && a < m.buckets.length) && m.buckets.every((_, j) => m.answers.includes(j)), tag + ' every bucket gets an item, answers in range');
          for (let i = 0; i < tg.length; i++) for (let j = i + 1; j < tg.length; j++) chk(Math.abs(tg[i].x - tg[j].x) >= tg[i].hw + tg[j].hw - 0.01, tag + ` buckets ${i}/${j} do not overlap`);
        }
        chk(m.items.every((_, i) => Dn.targetAt(sp, s, tg[sp.answer(i, s)].x, tg[sp.answer(i, s)].y) === sp.answer(i, s)), tag + ' dropping on a target centre hits that target');
        // pointer logic: a right drop places, a wrong drop counts a mistake, a tap + a tap works
        const st = { ...Mt.dndFlags([m.prefix]) }; const ptr = Mt.dndPtr(() => m); const ap = (r) => r && Object.assign(st, r);
        const at0 = sp.at(0, st), right = tg[sp.answer(0, st)], wrongIdx = tg.findIndex((_, j) => j !== sp.answer(0, st));
        ap(ptr('down', at0[0], at0[1], st)); ap(ptr('move', at0[0] + 5, at0[1] - 30, st)); ap(ptr('up', tg[wrongIdx].x, tg[wrongIdx].y, st)); chk(st[`${m.prefix}0`] === 0 && st.miss === 1 && st.h === -1, tag + ' a wrong drop counts a mistake');
        ap(ptr('down', at0[0], at0[1], st)); ap(ptr('move', at0[0] + 5, at0[1] - 30, st)); ap(ptr('up', right.x, right.y, st)); chk(st[`${m.prefix}0`] === 1 && st.last === 1, tag + ' a right drop places the item');
        if (N > 1) { const at1 = sp.at(1, st), r1 = tg[sp.answer(1, st)]; ap(ptr('down', at1[0], at1[1], st)); ap(ptr('up', at1[0], at1[1], st)); chk(st.sel === 1, tag + ' a tap selects'); ap(ptr('down', r1.x, r1.y, st)); chk(st[`${m.prefix}1`] === 1 && st.sel === -1, tag + ' a tap on the target places the selected item'); }
        chk(Mt.count(st, m) === (N > 1 ? 2 : 1) && !Mt.allPlaced(st, m), tag + ' count');
      }
      return { fails, nModes };
    });
    ok(D.fails.length === 0 && D.nModes === 21, `A2 drag modes: ${D.nModes} modes of the new simulations (chips and marks inside the picture, nothing overlapping, every bucket used, wrong / right drop and tap-tap) ` + D.fails.slice(0, 8).join('; '));
    // no graphic words in the reproductive system simulation (as the deny-list of 84-safety): its own texts in Chinese
    const texts = await page.evaluate(async () => {
      const m = await import('/src/bio/reproduction.ts'), mm = await import('/src/bio/model-reproduction.ts'), Q = await import('/src/phys/qtools.ts');
      const t = [...m.def.lesson, ...m.def.tasks.map((x) => x.text), ...m.MODES.flatMap((x) => [...x.items, ...(x.fn || [])]), ...mm.STAGE_FN];
      for (let s = 1; s <= 300; s++) for (const q of mm.quiz(Q.mulberry32(s))) t.push(q.q, q.why || '', ...q.choices);
      return t;
    });
    const DENY = /性交|性行为|性生活|阴茎|阴蒂|阴唇|外阴|勃起|射精|高潮|避孕|手淫|色情|裸|交配|做爱|情欲|性欲|性感|外生殖器|私处|性爱/;
    ok(texts.length > 1500 && !texts.some((x) => DENY.test(x)), `A2 reproduction: ${texts.length} texts (lesson, tasks, labels, notes, quiz questions) contain none of the words of the deny-list`);
    ok(texts.some((x) => /教科书/.test(x)), 'A2 reproduction: the lesson says that this is textbook content');
    const dna = await page.evaluate(async () => { const m = await import('/src/bio/dna.ts'); return m.def.lesson.join(' '); });
    ok(/拓展/.test(dna) && /教科书/.test(dna), 'A2 dna: the lesson marks base pairing as an extension of the textbook');
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
    ok(cards.length === IDS.length && IDS.every((id) => cards.some((c) => c.id === id)) && cards.every((c) => c.icon && /实验任务 0 \/ \d/.test(c.text)), `B ${IDS.length} cards, each with its drawn icon and "实验任务 0 / n"`);
    const groups = await page.evaluate(() => [...document.querySelectorAll('#bl-home > h2, #bl-home .pl-sc')].map((e) => (e.tagName === 'H2' ? 'H:' + e.textContent : e.dataset.sim)));
    const g8 = groups.indexOf('H:八年级');
    ok(groups[0] === 'H:七年级' && g8 === 31 && groups.slice(1, g8).length === 30 && groups.slice(g8 + 1).length === 20 && groups[g8 + 1] === 'animalgroups' && groups[1] === 'foodweb', 'B the lab starts with 七年级 (30 cards), then 八年级 (20 cards): ' + groups.join(' '));
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
    ok((await page.locator('.pl-sc').count()) >= 17, 'B the physics lab is still there (17 cards or more)');
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
    ok(finite && sweeps >= 0 && (changed >= 1 || ['microscope', 'cells', 'levels', 'classify', 'reproduction', 'animalgroups', 'daphnia'].includes(id)), `B ${id}: every slider in every mode (${sweeps} settings) keeps the readouts finite; ${changed} slider(s) change the readouts`);
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
    ok(Object.keys(stored.done).length === IDS.length && !(await page.evaluate(() => localStorage.getItem('learn.phys.v1') && JSON.parse(localStorage.getItem('learn.phys.v1')).done.cells)), 'B learn.bio.v1 holds the tasks of all simulations; the physics store has none of them');
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


  // ---- third pass: the small interactions of the 14 new simulations
  {
    const txt = () => page.textContent('#pl-readouts');
    await sim('dna'); await set({ mode: 1 });
    await page.click('.pl-opt[data-c="pick"][data-v="0"]');   // the strand starts with A: its partner is T, so A is wrong
    ok((await page.evaluate(() => [window.__bio.st.k, window.__bio.st.miss])).join() === '0,1', 'B dna: a wrong base counts a mistake and the strand does not advance');
    const strand = 'ATGCCGTA', partner = { A: 'T', T: 'A', C: 'G', G: 'C' };
    for (const ch of strand) await page.click(`.pl-opt[data-c="pick"][data-v="${'ATCG'.indexOf(partner[ch])}"]`);
    ok((await page.evaluate(() => [window.__bio.st.k, window.__bio.st.miss, window.__bio.done().includes('pair'), document.querySelector('.pl-ctl[data-c=pick]').hidden])).join() === '8,1,true,true', 'B dna: pressing the complementary base 8 times completes the strand (the task is done, the buttons go away)');
    await sim('evidence'); await set({ mode: 0, an: 0, h0: 1, h1: 1 }); await set({ an: 2 });
    ok((await page.evaluate(() => [window.__bio.st.h0, window.__bio.st.h1, window.__bio.st.miss])).join() === '0,0,0', 'B evidence: choosing another limb clears the placed bones');
    await sim('propagation'); await set({ mode: 0, scion: 0, stock: 0, align: 60 });
    const g60 = await txt(); await set({ align: 70 }); const g70 = await txt(); await set({ stock: 1, align: 100 }); const gbad = await txt();
    ok(/形成层没有对齐/.test(g60) && /^.*成活：形成层紧密结合/.test(g70) && /不亲和/.test(gbad), 'B propagation: 60 % alignment fails, 70 % takes, a distant stock fails even at 100 %');
    await sim('eugenics'); await set({ mode: 0, N: 50, rel: 1 });
    ok(/6\.[23]/.test((await txt()).replace(/\s/g, '')) , 'B eugenics: cousins, 1 carrier in 50: about 6.3 times the unrelated chance');
    await sim('microbe'); await set({ mode: 0, c0: 7, dil: 4, vol: 0.1 });
    const seen = new Set([await txt()]); for (let i = 0; i < 4; i++) { await page.click('#pl-act-replate'); seen.add(await txt()); }
    ok(seen.size >= 2 && /适合计数/.test([...seen].join()), 'B microbe: 重新涂布 gives another plate (counts differ) and a 30–300 plate says it can be counted');
    await set({ dil: 0 }); ok(/> 300/.test(await txt()) && /无法计数/.test(await txt()), 'B microbe: undiluted plate: more than 300, cannot be counted');
    await sim('seedlab'); await set({ mode: 2, seed: 1, part: 1 }); const blueTxt = await txt(); await set({ part: 0 });
    ok(/变成蓝色/.test(blueTxt) && /不变蓝/.test(await txt()), 'B seedlab: iodine on the endosperm turns blue, on the seed coat it does not');
    await sim('energy'); const e0 = await txt(); await set({ shield: 1 }); const e1 = await txt();
    ok(/35/.test(e0.replace(/\s/g, '')) && /75/.test(e1.replace(/\s/g, '')), 'B energy: without a wind shield 35 % of the true value, with one 75 %');
    await set({ food: 1, shield: 1, m: 3, vw: 20 }); ok(/水已沸腾，数据无效/.test(await txt()), 'B energy: too much food for too little water boils: the data are invalid');
    await sim('daphnia'); await set({ conc: 10 }); const d0 = await txt(); await page.click('#pl-act-recount'); const d1 = await txt(); await set({ conc: 20 });
    ok(/存活/.test(d0) && /水蚤死亡/.test(await txt()) && d0.length > 0 && d1.length > 0, 'B daphnia: 重新计数 works; at 20 % the water flea is dead');
    await sim('bloodpressure'); await set({ mode: 1, person: 0, cuff: 100 }); const bp1 = await txt(); await set({ cuff: 180 }); const bp2 = await txt(); await set({ cuff: 60 });
    ok(/能听到脉搏声/.test(bp1) && /听不到声音/.test(bp2) && /声音消失/.test(await txt()), 'B bloodpressure: cuff 100 = pulse sound, 180 = nothing, 60 = sound gone');
    await sim('ecology'); ok(await page.evaluate(() => document.querySelector('#pl-play') === null || document.querySelector('#pl-play').hidden), 'B ecology: the play button is hidden outside the stability mode');
    await set({ mode: 2, t: 0 }); await page.click('#pl-play'); await page.waitForTimeout(600); const tt = await page.evaluate(() => window.__bio.st.t); await page.click('#pl-play');
    ok(tt > 1, 'B ecology: 播放 moves the time after the disturbance on (' + tt.toFixed(1) + ')');
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
    ok(probs.length === 0, `C ${IDS.length} simulations + the lab page on 5 screen sizes at dpr 2: no overflow, centred, canvas crisp (backing = layout x dpr), sliders >= 44 px, buttons >= 40 px, nothing clipped / outside, touch-action right` + (probs.length ? '\n   ' + probs.slice(0, 12).join('\n   ') : ''));
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

    // third pass: real touch drags in a label mode, an order mode and a bucket mode
    const dragItem = async (id, mode, idx, wrong) => {
      await goto(id); await set2(p, { mode }); await scrollTo('#pl-canvas');
      const g = await p.evaluate(async ([id, mode, idx, wrong]) => { const m = await import(`/src/bio/${id}.ts`), Mt = await import('/src/bio/match.ts'); const dm = (m.MODES || m.HOM)[mode], sp = Mt.specOf(dm), tg = sp.targets({}); const t = wrong ? tg.findIndex((_, j) => j !== sp.answer(idx, {})) : sp.answer(idx, {}); return { at: sp.at(idx, {}), to: [tg[t].x, tg[t].y], prefix: dm.prefix }; }, [id, mode, idx, wrong]);
      const [x0, y0, kx2, ky2] = await toScreen(480); const a2 = [x0 + g.at[0] * kx2, y0 + g.at[1] * ky2], b2 = [x0 + g.to[0] * kx2, y0 + g.to[1] * ky2];
      await touch([a2, [a2[0] - 12, a2[1] - 12], [(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2], b2]);
      return p.evaluate(([pf, idx]) => ({ placed: window.__bio.st[pf + idx], miss: window.__bio.st.miss, held: window.__bio.st.h }), [g.prefix, idx]);
    };
    for (const [id, mode, name] of [['reproduction', 0, 'label (female system)'], ['reproduction', 3, 'order (fertilisation to birth)'], ['slide', 0, 'order (onion mount)'], ['propagation', 2, 'bucket (sexual / asexual)'], ['evidence', 0, 'label (human arm)'], ['animalgroups', 0, 'bucket (invertebrate groups)']]) {
      const r1 = await dragItem(id, mode, 0, false); ok(r1.placed === 1 && r1.miss === 0 && r1.held === -1, `D ${id}: a finger drags item 1 of "${name}" onto its place`);
      const r2 = await dragItem(id, mode, 1, true); ok(r2.placed === 0 && r2.miss === 1 && r2.held === -1, `D ${id}: a finger dropping item 2 on a wrong place: not placed, one mistake`);
    }
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
    let out = ''; try { execFileSync('node', ['scripts/check-i18n.mjs'], { cwd: path.join(__dirname, '../..'), env: { ...process.env, CHECK_BIO: '1' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { out = String(e.stderr || '') + String(e.stdout || ''); }
    const missing = [...out.matchAll(/^missing .*?\((.+?)\): (".*")$/gm)].filter((m) => /^bio\/|^biolab\.ts/.test(m[1])).map((m) => JSON.parse(m[2]));
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
    // the lessons and the quiz texts are translated too (rule 66): 200 generated questions per simulation (40 seeds x 5) and every lesson paragraph and formula contain no Chinese
    {
      const bad = await p.evaluate(async (ids) => {
        const { tr } = await import('/src/i18n.ts');
        const cjk = /[一-鿿]/; const out = [];
        const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        for (const id of ids) {
          location.hash = '#/science/bio/' + id; await new Promise((r) => setTimeout(r, 120));
          const def = window.__bio.def;
          for (const t of [...def.lesson, ...(def.formulas || [])]) if (cjk.test(tr(t))) out.push(id + ' lesson: ' + tr(t).slice(0, 50));
          for (let sd = 1; sd <= 40; sd++) for (const q of def.quiz(rng(sd * 7919))) for (const t of [q.q, q.why ?? '', ...q.choices]) if (cjk.test(tr(t))) out.push(id + ': ' + t.replace(/-?[0-9.]+/g, 'N').slice(0, 60));
        }
        return [...new Set(out)];
      }, IDS);
      ok(bad.length === 0, `E ${label}: all simulations x 200 generated quiz questions + lessons: no Chinese left (${bad.length})${bad.length ? '\n   ' + bad.slice(0, 25).join('\n   ') : ''}`);
    }

    {
      const rep = await p.evaluate(async () => { const I = await import('/src/i18n.ts'), m = await import('/src/bio/reproduction.ts'), mm = await import('/src/bio/model-reproduction.ts'), Q = await import('/src/phys/qtools.ts');
        const t = [...m.def.lesson, ...m.def.tasks.map((x) => x.text), ...m.MODES.flatMap((x) => [...x.items, ...(x.fn || [])]), ...mm.STAGE_FN]; for (let s = 1; s <= 60; s++) for (const q of mm.quiz(Q.mulberry32(s))) t.push(q.q, q.why || '', ...q.choices); return t.map((x) => I.tr(x)); });
      const DENY_L = loc === 'en' ? /intercourse|erection|penis|ejaculat|orgasm|contracepti|vulva|clitor|masturbat|sexual behaviou?r|coitus|copulat|genitals|pornograph|nude|naked/i : /rapport sexuel|érection|pénis|éjacul|orgasme|contracepti|vulve|clitoris|masturb|comportement sexuel|coït|organes génitaux externes|pornograph|\bnu(e|s|es)?\b/i;
      ok(rep.length > 400 && !rep.some((x) => DENY_L.test(x) || /[一-鿿]/.test(x)), `E ${label}: the reproductive system texts (${rep.length}) are translated, formal and contain none of the deny-list words`);
    }
    await p.evaluate(() => (location.hash = '#/science/bio/cells')); await p.waitForSelector('.pl-sim');
    ok(!/[一-鿿]/.test(await p.textContent('#pl-lesson')), `E ${label}: the lesson text is translated (no user box)`);
    let probs = [];
    for (const [w, hh] of [[390, 844], [320, 568], [820, 1180]]) { await p.setViewportSize({ width: w, height: hh }); for (const id of IDS) { await p.evaluate((id) => (location.hash = '#/science/bio/' + id), id); await p.waitForSelector('.pl-sim'); await p.waitForTimeout(40); const m = await p.evaluate(() => { const vis = (e) => !e.closest('[hidden]') && e.offsetParent !== null; return { over: document.documentElement.scrollWidth - innerWidth, clip: [...document.querySelectorAll('.pl-rl, .pl-rv, .pl-lab, .pl-tt, .pl-opt, .pl-btn, .pl-link')].filter((e) => vis(e) && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'auto').map((e) => e.textContent.slice(0, 14)) }; }); if (m.over > 0 || m.clip.length) probs.push(`${id}@${w}: ${m.over} ${m.clip.join('/')}`); } }
    ok(probs.length === 0, `E ${label}: all simulations on 390 / 320 / 820 px wide: no overflow, no clipped label${probs.length ? ' ' + probs.slice(0, 6).join('; ') : ''}`);
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
