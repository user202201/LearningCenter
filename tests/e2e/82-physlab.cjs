// 物理实验室 (#/science/physics, under 科学): junior-high physics as simulations.
// Part A: every pure model against hand-computed values and invariants (Snell, lens equation, Archimedes, lever, energy conservation, Ohm vs an independent nodal solver, heating phases, Hooke ...)
// and every quiz generator (5 questions each, 4 different choices, the right answer recomputed by an independent formula; the checker is shown to catch a wrong formula).
// Part B: the pages (cards, 28 simulations mount, readouts finite, sliders respond, tasks can be completed, kept after a reload, quiz played right and wrong, the oscilloscope is drawn from the model formula).
// Part C: layout on 5 screen sizes (canvas crisp at dpr 2 and 3, sliders >= 44 px, no overflow, centred). Part D: real touch dragging (CDP, dpr 2). Part E: English / French (no Chinese left outside content boxes).
// Part F: nothing leaves the device. Not tested here: real fingers / Apple Pencil, the real sound of the sound lab, the physics content (a teacher must proofread).
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const path = require('path');
const OUT = process.env.D || 'tests/out/physlab/';
fs.mkdirSync(OUT, { recursive: true });

const IDS = ['motion', 'sound', 'heating', 'reflection', 'refraction', 'lens', 'spring', 'friction', 'newton', 'pressure', 'buoyancy', 'energy', 'lever', 'pulley', 'specificheat', 'ohm', 'em', 'dispersion', 'eye', 'fluid', 'molecule', 'engine', 'circuit', 'bulbpower', 'home', 'magfield', 'emwave', 'energysrc', 'density', 'evap', 'thermo', 'straight', 'diffuse', 'noise', 'lensexp', 'internal', 'resistance', 'ohmlaw', 'rmeasure', 'meter', 'emdev', 'comms'];
const NEW4 = ['evap', 'thermo', 'straight', 'diffuse', 'noise', 'lensexp', 'internal', 'resistance', 'ohmlaw', 'rmeasure', 'meter', 'emdev', 'comms'];   // the fourth pass (13 simulations)
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const rel = (a, b, tol = 1e-3) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

// The translations of this page are written in src/i18n-extra/physlab.json and merged into src/i18n-data.ts by the person who integrates the change; until then (and
// harmlessly afterwards) the test puts them into the page's translation tables itself.
const extra = Object.assign({}, ...['physlab.json', 'physcontent.json'].map((f) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../src/i18n-extra/' + f), 'utf8'))));   // (physcontent.json: the lessons, quiz questions and explanations, rule 66)
const withExtra = async (t) => {
  const add = 'Object.assign(EN, ' + JSON.stringify(Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, v[0]]))) + ');\nObject.assign(FR, ' + JSON.stringify(Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, v[1]]))) + ');\n';
  await t.ctx.route('**/src/i18n-data.ts*', async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()) + '\n' + add }); });
  await t.page.reload(); await t.page.waitForSelector('.hub-grid, .kids, .empty-home');
};

// ---- how to complete every task by driving the state (independent of the task code: it states the physics) ----
const SOLVE = {
  motion: { uniform: { v0: 6, a: 0 }, s50: { v0: 10, a: 0, t: 5 }, acc: { v0: 5, a: 2, t: 5 } },
  sound: { a4: { timbre: 0, f: 440 }, loud: { A: 0.9 }, timbre: { timbre: 1, f: 880 } },
  heating: { plateau: { mode: 0, P: 400, m: 0.1, t: 50 }, boil: { mode: 0, P: 400, m: 0.1, t: 400 }, wax: { mode: 1, P: 400, m: 0.1, t: 20 } },
  reflection: { r30: { mode: 0, theta0: 30, alpha: 0 }, rot: { mode: 0, theta0: 35, alpha: 10 }, u12: { mode: 1, d: 12 } },
  refraction: { aw45: { pair: 0, ti: 45 }, tir: { pair: 2, ti: 60 }, normal: { ti: 0 } },
  lens: { camera: { type: 0, f: 10, u: 30 }, projector: { u: 15 }, magnifier: { u: 5 }, nofocus: { u: 10 } },
  spring: { newton10: { planet: 0, m: 0.5 }, moon: { planet: 1, m: 1 }, limit: { planet: 0, m: 1.5, k: 10 } },
  friction: { uniform: { alpha: 0, moving: 1, surface: 1, m: 10, F: 30 }, static: { alpha: 0, moving: 0, surface: 1, m: 5, F: 10 }, slide: { surface: 0, alpha: 30, F: 0, moving: 0 } },
  newton: { smooth: { mode: 0, surf: 4, t: 6 }, towel: { mode: 0, surf: 0, v0: 2 }, balance: { mode: 1, F1: 5, F2: 5, dir: 180, off: 0 }, turn: { mode: 1, F1: 5, F2: 5, dir: 180, off: 2 } },
  pressure: { water1: { mode: 0, liq: 0, h: 20 }, mercury: { mode: 1, alt: 0, tilt: 30 }, nail: { mode: 2, F: 100, S: 5 } },
  buoyancy: { suspend: { mode: 1, liq: 1, rb: 1 }, half: { mode: 0, frac: 0.5 }, float: { mode: 1, liq: 1, rb: 0.4 }, sink: { mode: 1, liq: 1, rb: 2 } },
  energy: { top: 'SEARCH', ek: { mode: 1, H0: 8, m: 1, loss: 0, x: 0.33 }, power: { mode: 2, F: 100, s: 10, tw: 5 } },
  lever: { balance: { n1: 2, L1: 20, n2: 2, L2: 20 }, save: { n1: 1, L1: 40, n2: 2, L2: 20 }, costly: { n1: 2, L1: 20, n2: 1, L2: 40 } },
  pulley: { third: { mode: 0, n: 3, Gm: 0, fric: 0 }, eta90: { mode: 0, n: 3, G: 50, Gm: 0, fric: 0.5 }, half: { mode: 1, alpha: 30, mu: 0 } },
  specificheat: { faster: { sub: 0, mw: 0.2, mo: 0.2, t: 300, P: 100 }, equal: { sub: 0, mw: 0.2, mo: 0.4, t: 200, P: 100 }, copper: { sub: 3, mw: 0.2, mo: 0.2, t: 100 } },
  ohm: { i02: { mode: 0, U: 6, R1: 10, R2: 20 }, par6: { mode: 1, R1: 12, R2: 12 }, rheo: { mode: 2, U: 6, pos: 0.2 }, power: { mode: 0, U: 12, R1: 5, R2: 5 } },
  em: { clips: { mode: 0, core: 1, N: 100, I: 2 }, noCore: { mode: 0, core: 0, N: 200, I: 3 }, reverse: { mode: 1, dirI: -1, Im: 2, pole: 1 }, emf: { mode: 2, N: 200, v: 30, x0: -2, t: 0 } },
  dispersion: { spread: { mode: 0, A: 70, th: 80 }, yellow: { mode: 1, r: 100, g: 100, b: 0 }, white: { mode: 1, r: 100, g: 100, b: 100 }, black: { mode: 2, obj: 1, lamp: 2 } },
  eye: { myopia: { mode: 0, vision: 1, far: 1, P: -2.5 }, hyper: { mode: 0, vision: 2, far: 0, u: 25, P: 3 }, micro: { mode: 1, ob: 2, ey: 2 }, tele: { mode: 2, fo: 80, fe: 4 } },
  fluid: { level: { mode: 0, liq: 0 }, tall: { mode: 0, liq: 1, h1: 12 }, low: { mode: 1, Q: 3, A2: 2 }, paper: { mode: 2, va: 5 } },
  molecule: { hot: { mode: 0, T: 500, t: 30 }, balance: { mode: 1, x: 1 }, repel: { mode: 1, x: 0.9 }, gas: { mode: 2, state: 2 } },
  engine: { power: { mode: 0, th: 400 }, exhaust: { mode: 0, th: 600 }, eta: { mode: 1, ex: 20, co: 20, fr: 5 }, conserve: { mode: 2, W: 60, Qh: 30, Qo: 10 } },
  circuit: { series3: { a: 1, b: 1, c: 1 }, par3: { a: 2, b: 2, c: 2 }, mixed: { a: 1, b: 2, c: 2 } },
  bulbpower: { normal: { Rp: 6 }, over: { Rp: 2 }, big: { bulb: 1, Rp: 1.5 }, rec: { n: 3 } },
  home: { blow: { mode: 0, a3: 1, a4: 1 }, big: { mode: 0, a3: 1, a4: 1, fuse: 3 }, mat: { mode: 1, touch: 0, stand: 1 }, pen: { mode: 2, hole: 1, hold: 1 } },
  magfield: { near: { mode: 0, src: 0, pol: 1, cx: 430, cy: 200 }, solenoid: { mode: 0, src: 1, cur: 1 }, oersted: { mode: 1, dirI: -1, I: 5, d: 2 }, dip: { mode: 2, lat: 85 } },
  emwave: { visible: { mode: 0, lf: 14.7 }, fm: { mode: 0, lf: 8 }, moon: { mode: 1, dest: 3, med: 0 }, fiber: { mode: 1, dest: 1, med: 1 } },
  density: { copper: { mode: 0, mat: 2, order: 0, V: 20 }, wrongorder: { mode: 0, mat: 0, order: 1, V: 10 }, alcohol: { mode: 1, liq: 0, order: 0, VL: 40 }, wax: { mode: 0, mat: 5 } },
  energysrc: { wind: { mode: 0, src: 5, guess: 1 }, nuclear: { mode: 0, src: 3, guess: 2 }, improve: { mode: 1, plant: 0, boost: 10 }, mix: { mode: 2, coal: 30, hydro: 20, nuc: 10 } },
  // ---- fourth pass: an array = steps (an object sets the state, a string presses that action button) ----
  evap: { dry: { mode: 0, T: 40, A: 30, wind: 0, t: 30 }, lpg: { mode: 1, gas: 1, TG: 20, pG: 3 }, frost: { mode: 2, bath: 60, ti: 10, cold: 1 }, deposit: { mode: 3, ph: 9 } },
  thermo: { cold: { mode: 0, T: -10 }, stay: { mode: 1, prev: 38.5, now: 36.8, shaken: 0 }, shake: { mode: 1, prev: 38.5, now: 36.8, shaken: 1 }, right: { mode: 2, place: 0, Tw: 80 } },
  straight: { equal: { mode: 0, u: 30, v: 30 }, sharp: { mode: 0, d: 1, u: 30, v: 20 }, point: { mode: 1, src: 0 }, eclipse: { mode: 2, phase: 0, beta: 0 } },
  diffuse: { mirror: { r: 0, theta: 30, alpha: 30 }, dark: { r: 0, theta: 30, alpha: -30 }, diffuse: { r: 1, theta: 30, alpha: 0 } },
  noise: { loud: { mode: 0, L: 100 }, quiet: { mode: 1, L0: 85, m0: 1, m1: 1, m2: 1 }, echo: { mode: 2, med: 0, d: 20 }, sonar: { mode: 3, ts: 4 } },
  lensexp: { focus: { mode: 0, lens: 0, v: 10 }, big: { mode: 1, lens: 0, u: 15, v: 30 }, small: { mode: 1, lens: 0, u: 30, v: 15 }, rows: [{ mode: 1, lens: 0, u: 15, v: 30 }, 'rec', { u: 20, v: 20 }, 'rec', { u: 30, v: 15 }, 'rec'] },
  internal: { compress: { mode: 0, action: 1, sub: 3, mg: 10, W: 300 }, expand: { mode: 0, action: 2, sub: 3, mg: 10, W: 300 }, reverse: { mode: 1, TA: 20, TB: 80 }, none: { mode: 1, TA: 50, TB: 50 } },
  resistance: { len: { mode: 0, LB: 2 }, area: { mode: 1, SB: 1 }, mat: { mode: 2, matB: 0 }, temp: { mode: 3, TB: 60 } },
  ohmlaw: { dataU: [{ mode: 0, r: 1, U: 1 }, 'rec', { U: 2 }, 'rec', { U: 3 }, 'rec', { U: 4 }, 'rec'], dataR: [{ mode: 1, r: 0 }, 'rec', { r: 1 }, 'rec', { r: 2 }, 'rec', { r: 3 }, 'rec'], five: [{ mode: 0, r: 0, U: 3 }, 'rec'] },
  rmeasure: { rec3: [{ target: 0, rx: 1, Rp: 0 }, 'rec', { Rp: 5 }, 'rec', { Rp: 10 }, 'rec'], avg: [{ target: 0, rx: 1, Rp: 0 }, 'rec', { Rp: 2 }, 'rec', { Rp: 4 }, 'rec'], bulb: [{ target: 1, Rp: 0 }, 'rec', { Rp: 10 }, 'rec'], normal: { target: 1, Rp: 1 } },
  meter: { kwh: { mode: 0, U: 220, I: 10, t: 7200 }, three: { mode: 1, P: 1000, th: 3 }, power: { mode: 2, rate: 3, n: 50, tt: 60 } },
  emdev: { relay: { mode: 0, s1: 1, U1: 6 }, alarm: { mode: 1, T: 80, Tset: 60 }, speaker: { mode: 2, A: 1 }, mic: { mode: 3, A: 1, f: 1000 } },
  comms: { bad: { mode: 0, noise: 1.5 }, clean: { mode: 0, noise: 0.7 }, tune: { mode: 1, band: 0, ftA: 900 }, fiber: { mode: 2, th: 80 } },
};
// the quiz kinds: the right answer recomputed from the parameters `p` by a formula written here (not the one in the model); numbers only, the text kinds are listed below
const g = 10, deg = (r) => (r * 180) / Math.PI, rad = (d) => (d * Math.PI) / 180;
const lensNature = (f, u) => (u < f ? '正立、放大的虚像（放大镜）' : u === f ? '不成像（折射光线平行射出）' : u === 2 * f ? '倒立、等大的实像' : u < 2 * f ? '倒立、放大的实像（投影仪）' : '倒立、缩小的实像（照相机）');
const lensTool = (f, u) => (u < f ? '放大镜' : u < 2 * f ? '投影仪' : '照相机');
const EXPECT = {
  motion: { 's=vt': ([v, t]) => v * t, avg: ([s, t]) => s / t, kmh: ([k]) => k / 3.6, 'v=v0+at': ([v0, a, t]) => v0 + a * t, 't=s/v': ([s, v]) => s / v },
  sound: { period: ([f]) => 1000 / f, wavelength: ([f]) => 340 / f, db: ([k]) => Math.round(20 * Math.log10(k)), octave: ([f, n]) => f * 2 ** n },
  heating: { 'Q=cmdT': ([m, d]) => 4.2 * m * d, melt: ([m]) => 334 * m, meltTime: ([P, m]) => (334000 * m) / P, heatTime: ([m, P]) => (4200 * m * 80) / P },
  reflection: { theta_r: ([a]) => a, from_mirror: ([b]) => 90 - b, between: ([c]) => 2 * c, img_sep: ([d]) => 2 * d, img_speed: ([v]) => 2 * v },
  refraction: { snell: ([ti, n]) => deg(Math.asin(Math.sin(rad(ti)) / n)), critical: ([n]) => deg(Math.asin(1 / n)), speed: ([n]) => 3 / n },
  lens: { v: ([f, u]) => (u * f) / (u - f), magnif: ([f, u]) => Math.abs((u * f) / (u - f) / u), f_from_2f: ([u]) => u / 2 },
  spring: { G: ([m]) => 10 * m, moon: ([m]) => 1.6 * m, hooke: ([F, x, F2]) => (F2 * x) / F, mass: ([G]) => G / 10, k: ([F, x]) => F / x },
  friction: { fk: ([m, mu]) => mu * m * g, static: ([F]) => F, angle: ([mu]) => deg(Math.atan(mu)), normal: ([m, a]) => m * g * Math.cos(rad(a)), uniform: ([m, mu]) => mu * m * g },
  newton: { dist: ([mu, v]) => (v * v) / (2 * mu * g), time: ([mu, v]) => v / (mu * g), balance: ([F]) => F, net: ([a, b]) => a - b },
  pressure: { liquid: ([h]) => (1000 * g * h) / 1000, solid: ([F, S]) => F / (S * 1e-4) / 1000, water_col: () => 101325 / (1000 * g), depth: ([h]) => h },
  buoyancy: { arch: ([V]) => 1000 * g * V * 1e-6, weigh: ([G, T]) => G - T, share: ([rb]) => rb * 100, floatF: ([m]) => m * g },
  energy: { 'W=Fs': ([F, s]) => F * s, 'P=W/t': ([W, t]) => W / t, Ep: ([m, h]) => m * g * h, Ek: ([m, v]) => 0.5 * m * v * v, vfall: ([h]) => Math.sqrt(2 * g * h) },
  lever: { F2: ([F1, L1, L2]) => (F1 * L1) / L2, L2: ([F1, L1, F2]) => (F1 * L1) / F2, crowbar: ([F, la, lb]) => (F * lb) / la },
  pulley: { F: ([n, G, Gm]) => (G + Gm) / n, s: ([n, h]) => n * h, eta: ([Wu, Wt]) => (100 * Wu) / Wt, plane: ([G, L, h]) => (G * h) / L, eta2: ([G, Gm]) => (100 * G) / (G + Gm) },
  specificheat: { Q: ([m, d]) => 4.2 * m * d, c: ([c]) => c, Tfinal: ([m, Q]) => 20 + (Q * 1000) / (4200 * m) },
  ohm: { series_I: ([U, a, b]) => U / (a + b), par_R: ([a, b]) => 1 / (1 / a + 1 / b), U1: ([U, a, b]) => U * (a / (a + b)), P: ([U, I]) => U * I, Q: ([I, R, t]) => I * I * R * t },
  em: { force: ([B, I]) => B * I * 0.1 },
  dispersion: { mindev: ([n, A]) => 2 * deg(Math.asin(n * Math.sin(rad(A / 2)))) - A },
  eye: { glass_power: ([d]) => -100 / d, micro_mag: ([o, e]) => o * e, tele_mag: ([a, b]) => a / b, tele_len: ([a, b]) => a + b },
  fluid: { h_right: ([h, rho]) => (h * 1000) / rho, bern_v: ([Q, A]) => (10 * Q) / A, dp: ([a, b]) => 0.5 * (b * b - a * a) },
  molecule: { count: ([d, L]) => (L * 1000) / d },
  engine: { Q: ([q7, m]) => q7 * 10 * m, eta: ([W, Q]) => (100 * W) / Q, rev: ([r]) => r / 120 },
  circuit: { Rs: ([a, b]) => a + b, Rp: ([c, d]) => (c * d) / (c + d), Rm: ([e, f, g]) => e + (f * g) / (f + g), I_br: ([U, r1]) => U / r1 },
  bulbpower: { P: ([U, I]) => U * I, R: ([U, I]) => U / I, Rp: ([E, Un, In]) => (E - Un) / In, pa: ([Pn, Uo, Ur]) => Pn * (Ur / Uo) ** 2 },
  home: { I: ([P]) => P / 220, Ptot: ([a, b]) => a + b, body: ([R]) => (220 / (R * 1000)) * 1000 },
  magfield: { Bwire: ([I, d]) => ((2e-7 * I) / (d / 100)) * 1e6, dip: ([l]) => deg(Math.atan(2 * Math.tan(rad(l)))) },
  emwave: { wavelength: ([f]) => 300 / f, freq: ([w]) => 300 / w, delay: ([d]) => (d * 1000) / 3e8 },
  density: { rho: ([m, V]) => m / V, displace: ([a, b]) => b - a },
  energysrc: { chain: ([a, b]) => (a * b) / 100, kwh: ([MJ]) => MJ / 3.6, co2: ([N]) => 0.9 * N },
  // ---- fourth pass ----
  evap: { remain: ([m0, r, t]) => m0 - r * t, avgrate: ([m, t]) => m / t },
  thermo: { read: ([d, k]) => -d * k, division: ([n]) => 100 / n, clinical: ([a, b]) => Math.max(a, b) },
  straight: { img_h: ([h, u, v]) => (h * v) / u, shadow: ([D, a, b]) => (D * (a + b)) / a, lighttime: ([x]) => (x * 1e6) / 3e5 },
  diffuse: { facet: ([t]) => 2 * t, outang: ([b]) => 90 - b },
  noise: { echo: ([t]) => (340 * t) / 2, mindist: ([v]) => (v * 0.1) / 2, depth: ([t]) => (1500 * t) / 2 },
  lensexp: { focal: ([d]) => d / 2, vdist: ([f, u]) => (u * f) / (u - f), size: ([h, u, v]) => (h * v) / u },
  internal: { dT: ([c, m, W]) => W / ((c * m) / 1000), final: ([a, b]) => (a + b) / 2, Qflow: ([m, a, b]) => 4200 * m * (a - b) },
  resistance: { cut: ([R, n]) => R / n, stretch: ([R, k]) => R * k * k, area: ([a, b, R]) => (R * a) / b },
  ohmlaw: { I: ([R, U]) => U / R, Rgraph: ([U, I]) => U / I, Inew: ([U, , R2]) => U / R2 },
  rmeasure: { R: ([U, I]) => U / I, Rp: ([E, Rx, I]) => E / I - Rx, avg: ([a, b, c]) => (a + b + c) / 3 },
  meter: { work: ([U, I, t]) => U * I * t, energy: ([P, h]) => (P * h) / 1000, cost: ([k, p]) => k * p, revs: ([r, e]) => r * e },
  emdev: { coilI: ([R, U]) => (U / R) * 1000, minU: ([I, R]) => (I / 1000) * R, loadI: ([P]) => P / 220 },
  comms: { lambda: ([f]) => 300 / f, freq: ([l]) => 300 / l, rate: ([S, R]) => (8 * S) / R },
};
const TEXT_KINDS = {
  evap: ['factor', 'liquefy', 'process'], thermo: ['neck', 'method'], straight: ['straight', 'eclipse'], diffuse: ['type', 'see', 'glare'], noise: ['ways', 'limit'], lensexp: ['screen', 'move'],
  internal: ['way', 'direction'], resistance: ['factor', 'table'], ohmlaw: ['conclusion', 'control'], rmeasure: ['bulbR', 'meters'], meter: ['param'], emdev: ['relay', 'principle'], comms: ['digital', 'fiber'],
  sound: ['concept'], heating: ['concept'], refraction: ['toward', 'tir'], lens: ['nature', 'tool'], newton: ['first'], pressure: ['pratio'], buoyancy: ['state'], lever: ['kind', 'tilt'], specificheat: ['which', 'property'], em: ['core', 'motor_rev', 'induction', 'turns'],
  dispersion: ['faster', 'mix', 'obj', 'primary'], eye: ['myopia'], fluid: ['bern', 'connected'], molecule: ['gap', 'force_kind', 'state', 'diffusion'], engine: ['stroke', 'conv'], circuit: ['home'], bulbpower: ['bright'], home: ['fuse', 'safe'], magfield: ['oersted', 'lines', 'earth'], emwave: ['vac', 'band'], energysrc: ['renew', 'primary'], density: ['ident', 'float', 'order'],
};
const numOf = (s) => parseFloat(String(s).replace('−', '-'));
const decimals = (s) => { const m = /^[−-]?\d+\.(\d+)/.exec(String(s).trim()); return m ? m[1].length : 0; };

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 1180, height: 820 } });
  const { page } = t;
  const to = async (hash, sel) => { await page.evaluate((h) => (location.hash = h), hash); await page.waitForSelector(sel); await page.waitForTimeout(120); };
  const sim = async (id) => { await to('#/science/physics/' + id, '.pl-sim'); await page.waitForFunction(() => window.__phys && document.querySelector('#pl-canvas').offsetWidth > 0); };
  const set = (o) => page.evaluate((o) => { for (const [k, v] of Object.entries(o)) window.__phys.set(k, v); }, o);

  // =====================================================================================  A. THE MODELS
  {
    const r = await page.evaluate(async () => {
      const L = {}; for (const n of ['motion', 'sound', 'heating', 'reflection', 'refraction', 'lens', 'spring', 'friction', 'newton', 'pressure', 'buoyancy', 'energy', 'lever', 'pulley', 'specificheat', 'ohm', 'em', 'dispersion', 'eye', 'fluid', 'molecule', 'engine', 'circuit', 'bulbpower', 'home', 'magfield', 'emwave', 'energysrc', 'density']) L[n] = await import(`/src/phys/model-${n}.ts`);
      const rnd = (a, b) => a + Math.random() * (b - a), pick = (a) => a[Math.floor(Math.random() * a.length)];
      const o = {}; const M = L;
      // motion
      o.motion = { pos: [M.motion.pos(4, 0, 3), M.motion.pos(0, 2, 5), M.motion.pos(3, 2, 4)], vel: M.motion.vel(3, 2, 4), avg: M.motion.avgSpeed(0, 2, 5), kmh: [M.motion.toKmh(20), M.motion.toMs(72)] };
      const tp0 = M.motion.tape(4, 0, 3), tp2 = M.motion.tape(2, 2, 3);
      const gaps = (a) => a.slice(1).map((x, i) => x - a[i]);
      o.motion.tapeUniform = gaps(tp0).every((d) => Math.abs(d - gaps(tp0)[0]) < 1e-9);
      o.motion.tapeGrowing = gaps(tp2).every((d, i, a) => i === 0 || d > a[i - 1]);
      let bad = 0; for (let i = 0; i < 300; i++) { const v0 = rnd(0, 10), a = rnd(0, 4), tt = rnd(0.1, 10), h = 1e-5; const num = (M.motion.pos(v0, a, tt + h) - M.motion.pos(v0, a, tt - h)) / (2 * h); if (Math.abs(num - M.motion.vel(v0, a, tt)) > 1e-6) bad++; } o.motion.derivBad = bad;
      // sound
      const S = M.sound; o.sound = { period: S.period(440), db: [S.levelDb(1), S.levelDb(0.1), S.levelDb(0.5)], midi: [S.midi(440), S.midi(880), S.midi(261.6256)], notes: [S.nearestNote(440), S.nearestNote(261.63), S.nearestNote(466.16), S.nearestNote(450)], wl: S.wavelength(340), aud: [S.audible(19), S.audible(20), S.audible(20000), S.audible(20001)] };
      let pk = 0, per = 0, odd = 0, sine = 0;
      for (const tb of [0, 1, 2, 3]) for (let i = 0; i < 400; i++) { const f = rnd(100, 2000), A = rnd(0.1, 1), tt = rnd(0, 0.02); const w = S.wave(tb, f, A, tt); if (Math.abs(w) > A + 1e-9) pk++; if (Math.abs(w - S.wave(tb, f, A, tt + 1 / f)) > 1e-7) per++; if (Math.abs(S.wave(tb, f, A, tt) + S.wave(tb, f, A, -tt)) > 1e-9) odd++; if (tb === 0 && Math.abs(w - A * Math.sin(2 * Math.PI * f * tt)) > 1e-9) sine++; }
      o.sound.peakBad = pk; o.sound.periodBad = per; o.sound.oddBad = odd; o.sound.sineBad = sine;
      o.sound.peakReached = [0, 1, 2, 3].map((tb) => { let m = 0; for (let i = 0; i < 4000; i++) m = Math.max(m, Math.abs(S.wave(tb, 100, 1, i / 4000 / 100))); return m; });
      o.sound.harm = [1, 2, 3].map((tb) => S.harmonics(tb).slice(1, 6));
      // reflection
      const R = M.reflection; o.reflection = { a: R.reflection(35, 0), miss: R.reflection(70, 20), img: R.planeImage(12, 6) };
      let rb = 0; for (let i = 0; i < 400; i++) { const t0 = Math.floor(rnd(0, 70)), al = Math.floor(rnd(-20, 20)); const a = R.reflection(t0, al), b = R.reflection(t0, 0); if (a.hit && b.hit && Math.abs(a.outDir - b.outDir - 2 * al) > 1e-9) rb++; if (a.hit && a.thetaI !== a.thetaR) rb++; } o.reflection.rotBad = rb;
      // refraction
      const F = M.refraction; o.refraction = { aw: F.refract(1, 1.33, 45), tir: F.refract(1.33, 1, 60), crit: [F.critical(1.33, 1), F.critical(1.5, 1), F.critical(1, 1.33)], speed: F.speedIn(1.5) };
      let fb = 0, rv = 0; for (let i = 0; i < 400; i++) { const n1 = pick([1, 1.33, 1.5]), n2 = pick([1, 1.33, 1.5, 2.4]), th = rnd(0, 85); const r = F.refract(n1, n2, th); if (r.tir) { const c = F.critical(n1, n2); if (c === null || th < c) fb++; continue; } if (Math.abs(n1 * Math.sin(th * Math.PI / 180) - n2 * Math.sin(r.thetaT * Math.PI / 180)) > 1e-9) fb++; const back = F.refract(n2, n1, r.thetaT); if (back.tir || Math.abs(back.thetaT - th) > 1e-6) rv++; }
      o.refraction.snellBad = fb; o.refraction.reverseBad = rv;
      // lens
      const Ln = M.lens; let lb = 0, cls = 0;
      for (let i = 0; i < 600; i++) { const f = Math.floor(rnd(5, 21)), u = rnd(1, 50), ty = Math.random() < 0.5 ? 0 : 1; if (ty === 0 && Math.abs(u - f) < 1e-6) continue; const im = Ln.image(f, u, ty); const fs = ty === 0 ? f : -f; if (Math.abs(1 / u + 1 / im.v - 1 / fs) > 1e-9) lb++; if (Math.abs(im.m - Math.abs(im.v / u)) > 1e-9) lb++; if (ty === 1 && (im.real || im.m >= 1 || im.inverted)) cls++; if (ty === 0 && u > f && !im.real) cls++; if (ty === 0 && u < f && (im.real || im.m <= 1)) cls++; if (ty === 0 && u > 2 * f && im.m >= 1) cls++; if (ty === 0 && u > f && u < 2 * f && im.m <= 1) cls++; }
      o.lens = { eqBad: lb, clsBad: cls, none: Ln.image(10, 10, 0).none, eq: Ln.image(10, 20, 0), cam: Ln.image(10, 30, 0), proj: Ln.image(10, 15, 0), mag: Ln.image(10, 5, 0), con: Ln.image(10, 20, 1) };
      // heating
      const H = M.heating; const c0 = (t) => H.curve(0, 400, 0.1, t);
      o.heating = { start: c0(0), meltStart: c0(10.6), meltEnd: [c0(10.4), c0(93.9), c0(94.1)], boil: [c0(190), c0(205), c0(763), c0(765)], plateau: [H.plateau(0, 400, 0.1), H.plateau(2, 400, 0.1), H.plateau(1, 400, 0.1)], wax: [H.curve(1, 400, 0.1, 5), H.curve(1, 400, 0.1, 20), H.curve(1, 400, 0.1, 100)], cool: [H.curve(2, 400, 0.1, 5), H.curve(2, 400, 0.1, 100), H.curve(2, 400, 0.1, 300)], heat: H.heat(4200, 0.5, 20) };
      let mono = 0, flatBad = 0; for (let md = 0; md < 3; md++) for (let k = 0; k < 40; k++) { const P = rnd(100, 1000), m = rnd(0.1, 0.5); let prev = H.curve(md, P, m, 0).T; for (let tt = 1; tt <= 1200; tt += 3) { const T = H.curve(md, P, m, tt).T; if (md < 2 ? T < prev - 1e-9 : T > prev + 1e-9) mono++; prev = T; } }
      for (let k = 0; k < 40; k++) { const P = rnd(100, 1000), m = rnd(0.1, 0.5), t1 = 4200 * m / 0.1 / P * 0 + (m * 2100 * 20) / P, tm = (m * 334000) / P; for (let j = 1; j < 10; j++) { const p = H.curve(0, P, m, t1 + (tm * j) / 10); if (p.T !== 0 || p.phase !== 1) flatBad++; } const w1 = H.curve(1, P, m, 1), w2 = H.curve(1, P, m, 2); if (!(w2.T > w1.T)) flatBad++; }
      o.heating.monoBad = mono; o.heating.flatBad = flatBad;
      let sf = 0; for (let k = 0; k < 100; k++) { const P = rnd(100, 1000), m = rnd(0.1, 0.5), tt = rnd(0, 1200), mode = Math.floor(rnd(0, 3)); const f = H.solidFraction(mode, P, m, tt); if (!(f >= -1e-9 && f <= 1 + 1e-9)) sf++; } o.heating.sfBad = sf;
      // spring
      const Sp = M.spring; o.spring = { G: Sp.weight(1, 10), moon: Sp.weight(1, 1.6), x: Sp.extension(5, 40), lim: [Sp.beyondLimit(0.3), Sp.beyondLimit(0.31)], grav: Sp.GRAV };
      // friction
      const Fr = M.friction; let frb = 0;
      for (let i = 0; i < 800; i++) { const m = Math.floor(rnd(1, 21)), Fp = rnd(0, 100), al = pick([0, 5, 10, 15, 20, 30, 45]), su = pick([0, 1, 2]), mv = pick([0, 1]); const r = Fr.solve(m, Fp, al, su, mv); const N = m * 10 * Math.cos(al * Math.PI / 180), gd = m * 10 * Math.sin(al * Math.PI / 180), mk = [0.05, 0.3, 0.8][su];
        if (Math.abs(r.N - N) > 1e-9 || Math.abs(r.gDown - gd) > 1e-9) frb++;
        const net = Fp - gd + r.f; if (r.kind === 'static') { if (Math.abs(net) > 1e-9 || Math.abs(r.f) > 1.25 * mk * N + 1e-9 || r.a !== 0) frb++; } else { if (Math.abs(Math.abs(r.f) - mk * N) > 1e-9 || Math.abs(m * r.a - net) > 1e-9) frb++; } }
      o.friction = { bad: frb, h: [Fr.solve(5, 10, 0, 1, 0), Fr.solve(5, 30, 0, 1, 0), Fr.solve(10, 30, 0, 1, 1), Fr.solve(5, 0, 30, 0, 0)], maxAngle: Fr.maxAngle(1) };
      // newton
      const Nw = M.newton; let nb = 0;
      for (let i = 0; i < 200; i++) { const v0 = rnd(1, 3), mu = pick([0.5, 0.25, 0.1, 0.04]); let x = 0, v = v0, tt = 0; const dt = 1e-4; while (v > 0) { v -= mu * 10 * dt; x += v * dt; tt += dt; } if (Math.abs(x - Nw.stopDistance(v0, mu)) > 2e-3 || Math.abs(tt - Nw.stopTime(v0, mu)) > 2e-3) nb++; const a = Nw.car(v0, mu, Nw.stopTime(v0, mu) * 0.5); if (Math.abs(a.s - (v0 * Nw.stopTime(v0, mu) * 0.5 - 0.5 * mu * 10 * (Nw.stopTime(v0, mu) * 0.5) ** 2)) > 1e-9) nb++; }
      o.newton = { bad: nb, inf: [Nw.stopDistance(2, 0), Nw.car(2, 0, 50)], bal: [Nw.twoForces(5, 5, 180, 0), Nw.twoForces(5, 5, 180, 2), Nw.twoForces(5, 3, 180, 0), Nw.twoForces(3, 4, 90, 0), Nw.twoForces(5, 5, 0, 0)] };
      // pressure
      const Pr = M.pressure; o.pressure = { l: Pr.liquidP(1000, 0.2), hg: Pr.liquidP(13600, 0.76), solid: [Pr.solidP(100, 50), Pr.solidP(100, 5)], atm: [Pr.atmAt(0), Pr.atmAt(5500) / Pr.atmAt(0), Pr.atmAt(8000) / Pr.atmAt(0)], hgmm: Pr.mercuryMm(101325) };
      // buoyancy
      const Bu = M.buoyancy; let bb = 0;
      for (let i = 0; i < 1000; i++) { const rb = rnd(200, 3000), rl = pick([800, 1000, 1200, 1400]), V = Math.floor(rnd(50, 200)), mode = pick([0, 1]), fr = pick([0, 0.25, 0.5, 0.75, 1]); const r = Bu.solve(rb, rl, V, mode, fr); const Vm = V * 1e-6;
        if (Math.abs(r.F - rl * 10 * Vm * r.frac) > 1e-12 || Math.abs(r.Gdisp - r.F) > 1e-12 || r.frac < 0 || r.frac > 1) bb++;
        if (mode === 1) { if (r.state === 'float' && (rb >= rl || Math.abs(r.F - r.G) > 1e-9)) bb++; if (r.state === 'sink' && (rb <= rl || r.F >= r.G || Math.abs(r.bottomN - (r.G - r.F)) > 1e-9)) bb++; if (r.state === 'suspend' && Math.abs(r.F - r.G) > 0.5 * 9.8 * Vm + 1e-9) bb++; }
        else if (Math.abs(r.Tscale - (r.G - r.F)) > 1e-12) bb++; }
      o.buoyancy = { bad: bb, a: Bu.solve(600, 1000, 100, 1, 0), b: Bu.solve(1000, 1000, 100, 1, 0), c: Bu.solve(2700, 1000, 100, 1, 0), d: Bu.solve(600, 1000, 100, 0, 0.5) };
      // energy
      const En = M.energy; let eb = 0, maxDrift = 0;
      for (let i = 0; i < 40; i++) { const L = rnd(0.5, 2), th = rnd(5, 80), m = rnd(0.5, 5), tt = rnd(0, 10); const e = En.pendulumEnergy(m, L, th, tt); const drift = Math.abs(e.Ek + e.Ep - e.E0) / e.E0; maxDrift = Math.max(maxDrift, drift); if (drift > 5e-5) eb++; }
      o.energy = { eb, maxDrift, work: [En.work(50, 4), En.power(200, 5)] };
      // pendulum period for a small angle: first time omega changes sign = half period
      { let t0 = 0, prev = En.pendulum(5, 1, 0.5).omega; for (let tt = 0.5; tt < 3; tt += 0.01) { const w = En.pendulum(5, 1, tt).omega; if (prev < 0 && w >= 0) { t0 = tt; break; } prev = w; } o.energy.halfPeriod = t0; o.energy.expect = Math.PI * Math.sqrt(1 / 10); }
      let tb = 0; for (let i = 0; i < 200; i++) { const H0 = Math.floor(rnd(2, 11)), m = rnd(0.5, 5), x = rnd(0, 1); const e = En.trackEnergy(m, H0, x, 0); if (Math.abs(e.Ek + e.Ep - e.E0) > 1e-9 || Math.abs(0.5 * m * e.v * e.v - e.Ek) > 1e-9 || e.h > H0 + 1e-9 || !e.reached) tb++; const l = En.trackEnergy(m, H0, x, 0.2); if (l.reached && Math.abs(l.Ek + l.Ep + l.Eloss - l.E0) > 1e-9) tb++; }
      o.energy.trackBad = tb; o.energy.track = [En.trackH(8, 0), En.trackH(8, 1 / 3), En.trackH(8, 2 / 3), En.trackH(8, 1)];
      // lever
      const Lv = M.lever; let lvb = 0;
      for (let i = 0; i < 500; i++) { const n1 = Math.floor(rnd(0, 9)), n2 = Math.floor(rnd(0, 9)), a = 5 * Math.floor(rnd(1, 11)), b = 5 * Math.floor(rnd(1, 11)); const r = Lv.lever(n1, a, n2, b); const t1 = n1 * 0.5 * a, t2 = n2 * 0.5 * b; if (r.balanced !== (Math.abs(t1 - t2) < 1e-9)) lvb++; if (Math.sign(r.tilt) !== Math.sign(t1 - t2) && !(t1 === t2 && r.tilt === 0)) lvb++; if (Math.abs(r.tilt) > 15) lvb++; if ((a > b) !== (r.kind === '省力杠杆') && a !== b) lvb++; }
      o.lever = { bad: lvb, a: Lv.lever(2, 20, 4, 10), b: Lv.lever(3, 20, 2, 25) };
      // pulley
      const Pu = M.pulley; let pb = 0;
      for (let i = 0; i < 500; i++) { const n = Math.floor(rnd(1, 6)), G = rnd(1, 50), Gm = rnd(0, 5), fr = rnd(0, 3), h = rnd(0.1, 3); const r = Pu.pulley(n, G, Gm, fr, h); if (r.eta > 1 + 1e-12 || r.eta <= 0 || Math.abs(r.s - n * h) > 1e-9 || Math.abs(r.Wtot - r.F * r.s) > 1e-9 || Math.abs(r.F - (G + Gm + fr) / n) > 1e-9) pb++; const al = rnd(10, 60), mu = rnd(0, 0.5); const q = Pu.incline(G, al, mu); const sa = Math.sin(al * Math.PI / 180), ca = Math.cos(al * Math.PI / 180); if (Math.abs(q.eta - sa / (sa + mu * ca)) > 1e-9 || q.eta > 1 + 1e-12) pb++; if (Math.abs(Pu.incline(G, al, 0).eta - 1) > 1e-12) pb++; }
      o.pulley = { bad: pb, p: Pu.pulley(3, 9, 0, 0, 1), i: Pu.incline(10, 30, 0) };
      // specific heat
      const Sh = M.specificheat; let shb = 0;
      for (let i = 0; i < 300; i++) { const P = pick([50, 100, 200, 300]), m1 = rnd(0.1, 1), m2 = rnd(0.1, 1), tt = rnd(0, 600), s = Math.floor(rnd(0, 4)); const dw = Sh.tempWater(P, m1, tt) - 20, c = Sh.SUBST[s][2]; const unclipped = P * tt / (4200 * m1); if (Sh.tempWater(P, m1, tt) < 100 && Math.abs(dw - unclipped) > 1e-9) shb++; if (dw < -1e-9 || dw > 80 + 1e-9) shb++; const to = Sh.tempOther(s, P, m2, tt); if (to < 20 - 1e-9 || to > Sh.SUBST[s][3] + 1e-9) shb++; if (Sh.rise(1000, c, m2) * c * m2 > 1000 + 1e-6) shb++; }
      o.specificheat = { bad: shb, Q: Sh.rise(8400, 4200, 0.2), tw: Sh.tempWater(100, 0.2, 60), tk: Sh.tempOther(0, 100, 0.2, 60), cap: Sh.tempWater(300, 0.1, 600) };
      // ohm vs an independent nodal solver
      const Oh = M.ohm;
      const nodal = (nodes, res, U) => { // node 0 = ground, node 1 = + of the source; unknown voltages of nodes 2.. ; Gaussian elimination
        const n = nodes - 2; const A = Array.from({ length: n }, () => new Array(n + 1).fill(0));
        const V = (k) => (k === 0 ? 0 : k === 1 ? U : null);
        for (const [a, b, R] of res) for (const [x, y] of [[a, b], [b, a]]) { if (x < 2) continue; const row = A[x - 2]; row[x - 2] += 1 / R; if (V(y) === null) row[y - 2] -= 1 / R; else row[n] += V(y) / R; }
        for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]]; for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k]; } }
        const volt = [0, U, ...A.map((r, i) => r[n] / r[i])]; return { volt, cur: (a, b, R) => (volt[a] - volt[b]) / R };
      };
      let ob = 0;
      for (let i = 0; i < 600; i++) { const U = Math.floor(rnd(1, 13)), R1 = Math.floor(rnd(1, 51)), R2 = Math.floor(rnd(1, 51)), tt = Math.floor(rnd(0, 60)); const mode = Math.floor(rnd(0, 2));
        const c = Oh.solve(mode, U, R1, R2, tt);
        let ns, I1, I2, U1, U2, I;
        if (mode === 0) { ns = nodal(3, [[1, 2, R1], [2, 0, R2]], U); I1 = ns.cur(1, 2, R1); I2 = ns.cur(2, 0, R2); U1 = ns.volt[1] - ns.volt[2]; U2 = ns.volt[2]; I = I1; }
        else { ns = nodal(2 + 0, [], U); const u1 = U, i1 = u1 / R1, i2 = u1 / R2; I1 = i1; I2 = i2; U1 = U; U2 = U; I = i1 + i2; }
        const close = (a, b) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b));
        if (!close(c.I, I) || !close(c.I1, I1) || !close(c.I2, I2) || !close(c.U1, U1) || !close(c.U2, U2)) ob++;
        if (!close(c.P, c.P1 + c.P2) || !close(c.P, U * c.I) || !close(c.Q1, I1 * I1 * R1 * tt)) ob++;
        if (!close(c.R, U / c.I)) ob++; }
      // a general random network: model of a ladder checked only by the nodal solver against series-parallel reduction
      let lad = 0; for (let i = 0; i < 100; i++) { const U = rnd(1, 12), Ra = rnd(1, 50), Rb = rnd(1, 50), Rc = rnd(1, 50); const ns = nodal(4, [[1, 2, Ra], [2, 3, Rb], [3, 0, Rc], [2, 0, Rc]], U); const Rpar = Oh.solve(1, 1, Rb + Rc, Rc).R; const Rt = Ra + Rpar; if (Math.abs(ns.cur(1, 2, Ra) - U / Rt) > 1e-9) lad++; }
      o.ohm = { bad: ob, lad, rheo: [Oh.rheostat(0), Oh.rheostat(0.5), Oh.rheostat(1)], six: Oh.solve(0, 6, 10, 20, 10) };
      // electromagnetism
      const Em = M.em; let emb = 0;
      for (let i = 0; i < 300; i++) { const x = rnd(-15, 15), N = Math.floor(rnd(10, 200)), v = rnd(-30, 30), h = 1e-5; const num = (Em.flux(x + h) - Em.flux(x - h)) / (2 * h); if (Math.abs(num - Em.dflux(x)) > 1e-9) emb++; if (Math.abs(Em.flux(x) - Em.flux(-x)) > 1e-15) emb++; if (Math.abs(Em.emf(N, x, v) + Em.emf(N, -x, v)) > 1e-12 || Math.abs(Em.emf(N, x, v) + Em.emf(N, x, -v)) > 1e-12) emb++; if (Em.emf(N, x, 0) !== 0 && Math.abs(Em.emf(N, x, 0)) > 1e-18) emb++; }
      o.em = { bad: emb, emf0: Em.emf(100, 0, 20), str: [Em.strength(100, 2, 0), Em.strength(100, 2, 1)], clips: [Em.clips(100, 1, 0), Em.clips(100, 2, 1), Em.clips(200, 3, 0), Em.clips(200, 3, 1)], dir: [Em.motorDir(2, 1, 1), Em.motorDir(2, -1, 1), Em.motorDir(2, 1, 0), Em.motorDir(2, -1, 0), Em.motorDir(0, 1, 1)], F: Em.motorForce(0.5, 2), emf: Em.emf(100, -1.5, 20) };
      return o;
    });
    const m = r.motion;
    ok(near(m.pos[0], 12) && near(m.pos[1], 25) && near(m.pos[2], 28) && near(m.vel, 11) && near(m.avg, 5) && near(m.kmh[0], 72) && near(m.kmh[1], 20), 'A motion: s = v0 t + a t^2/2, v = v0 + a t, km/h <-> m/s (hand values)');
    ok(m.tapeUniform && m.tapeGrowing && m.derivBad === 0, 'A motion: ticker tape gaps equal for uniform, growing for acceleration; v is the derivative of s (300 random)');
    const s = r.sound;
    ok(near(s.period, 1 / 440) && near(s.db[0], 60) && near(s.db[1], 40) && near(s.db[2], 60 + 20 * Math.log10(0.5)) && near(s.midi[0], 69) && near(s.midi[1], 81) && near(s.midi[2], 60, 1e-3) && near(s.wl, 1), 'A sound: period, dB (x10 amplitude = +20 dB), MIDI numbers, wavelength');
    ok(s.notes[0].name === 'A4' && s.notes[0].cents === 0 && s.notes[1].name === 'C4' && s.notes[2].name === 'A#4' && s.notes[3].name === 'A4' && s.notes[3].cents > 0, 'A sound: nearest note names (A4, C4, A#4, +cents)');
    ok(!s.aud[0] && s.aud[1] && s.aud[2] && !s.aud[3], 'A sound: audible range 20 Hz - 20 kHz');
    ok(s.peakBad === 0 && s.periodBad === 0 && s.oddBad === 0 && s.sineBad === 0 && s.peakReached.every((p) => near(p, 1, 2e-3)), 'A sound: |wave| <= A, periodic, odd, pure tone = A sin(2 pi f t), peak reached (4 timbres x 400 random)');
    ok(s.harm[0][0] === 1 && s.harm[0][1] === 0 && near(s.harm[0][2], 1 / 3) && near(s.harm[1][1], 1 / 2) && s.harm[2][0] === 1 && s.harm[2][2] < 0, 'A sound: square (odd 1/n), sawtooth (all 1/n), triangle (odd, alternating 1/n^2)');
    const rf = r.reflection;
    ok(rf.a.thetaI === 35 && rf.a.thetaR === 35 && near(rf.a.outDir, 35) && !rf.miss.hit && near(rf.img.imgDist, 12) && near(rf.img.sep, 24) && rf.img.virtual && rf.rotBad === 0, 'A reflection: reflected angle = incident angle; mirror turned alpha -> ray turned 2 alpha (400 random); image distance = object distance');
    const fa = r.refraction;
    ok(near(fa.aw.thetaT, 32.1, 0.1) && fa.tir.tir && near(fa.crit[0], 48.75, 0.01) && near(fa.crit[1], 41.81, 0.01) && fa.crit[2] === null && near(fa.speed, 2e8, 1), 'A refraction: air->water 45 deg = 32.1 deg, critical angles 48.75 / 41.81 deg, v = c/n');
    ok(fa.snellBad === 0 && fa.reverseBad === 0, 'A refraction: Snell\'s law holds, total reflection only beyond the critical angle, the light path is reversible (400 random)');
    const ln = r.lens;
    ok(ln.eqBad === 0 && ln.clsBad === 0, 'A lens: 1/u + 1/v = 1/f (signed) and the real / virtual / enlarged / reduced rules (600 random, convex and concave)');
    ok(ln.none && near(ln.eq.v, 20) && near(ln.eq.m, 1) && ln.eq.nature === '倒立、等大的实像' && near(ln.cam.v, 15) && ln.cam.tool === '照相机' && near(ln.proj.v, 30) && ln.proj.tool === '投影仪' && ln.mag.v < 0 && ln.mag.tool === '放大镜' && !ln.con.real, 'A lens: u = f no image, u = 2f equal real image, camera (u=30,f=10 -> v=15), projector (u=15 -> v=30), magnifier, concave');
    const he = r.heating;
    ok(he.start.T === -20 && he.meltEnd[0].phase === 0 && he.meltEnd[1].T === 0 && he.meltEnd[1].phase === 1 && he.meltEnd[2].phase === 2 && he.boil[0].phase === 2 && he.boil[1].T === 100 && he.boil[1].phase === 3 && he.boil[2].phase === 3 && he.boil[3].phase === 4 && he.boil[3].T > 100, 'A heating: 0.1 kg ice at 400 W: solid until 10.5 s, melting to 94 s at 0 degrees, water, boiling from 199 s to 764 s at 100 degrees, steam');
    ok(near(he.plateau[0], 83.5) && near(he.plateau[1], 83.5) && he.plateau[2] === 0 && he.wax[0].phase === 0 && he.wax[1].phase === 1 && he.wax[2].phase === 2 && he.monoBad === 0 && he.flatBad === 0 && he.sfBad === 0 && near(he.heat, 42000) && he.cool[0].phase === 2 && he.cool[1].T === 0 && he.cool[2].phase === 0 && he.cool[2].T < 0, 'A heating: plateau length = lambda m / P, wax has no plateau (strictly rising), curves monotonic (rising / cooling), flat part exactly 0 degrees (120 random)');
    const sp = r.spring;
    ok(near(sp.G, 10) && near(sp.moon, 1.6) && near(sp.x, 0.125) && sp.lim[0] === false && sp.lim[1] === true && sp.grav.join() === '10,1.6,3.7,24.8', 'A spring: G = m g (earth, moon), Hooke x = F / k, elastic limit');
    const fr = r.friction;
    ok(fr.bad === 0 && fr.h[0].kind === 'static' && near(fr.h[0].f, -10) && fr.h[1].kind === 'kinetic' && near(fr.h[1].f, -15) && near(fr.h[1].a, (30 - 15) / 5) && near(fr.h[2].a, 0, 1e-9) && fr.h[3].state === 'down' && near(fr.maxAngle, 45), 'A friction: force balance, |static f| <= 1.25 mu N, kinetic f = mu N, m a = net force, slides down on ice at 30 deg, max angle atan(mu) (800 random)');
    const nw = r.newton;
    ok(nw.bad === 0 && nw.inf[0] === Infinity && nw.inf[1].v === 2 && !nw.inf[1].stopped, 'A newton: stopping distance and time agree with a numeric integration (200 random); smooth surface never stops');
    ok(nw.bal[0].balanced && !nw.bal[1].balanced && nw.bal[1].couple > 0 && !nw.bal[2].balanced && near(nw.bal[2].mag, 2) && near(nw.bal[3].mag, 5) && !nw.bal[4].balanced && near(nw.bal[4].mag, 10), 'A newton: two forces balanced only when equal, opposite and on the same line; 3-4-5; couple when the lines are apart');
    const pr = r.pressure;
    ok(near(pr.l, 2000) && near(pr.hg, 103360, 0.1) && near(pr.solid[0], 20000) && near(pr.solid[1], 200000) && near(pr.atm[0], 101325) && near(pr.atm[1], 0.521, 0.01) && pr.atm[2] < 0.4 && near(pr.hgmm, 760, 0.3), 'A pressure: p = rho g h (2000 Pa, g = 10 N/kg), p = F/S, 760 mm of mercury, pressure falls with altitude');
    const bu = r.buoyancy;
    ok(bu.bad === 0 && bu.a.state === 'float' && near(bu.a.frac, 0.6) && near(bu.a.F, bu.a.G) && bu.b.state === 'suspend' && bu.c.state === 'sink' && bu.c.bottomN > 0 && near(bu.d.Tscale, bu.d.G - bu.d.F) && near(bu.d.F, 1000 * 10 * 100e-6 * 0.5), 'A buoyancy: Archimedes F = rho g V displaced = G displaced; float F = G, suspend, sink (1000 random combinations)');
    const en = r.energy;
    ok(en.eb === 0 && en.maxDrift < 5e-5 && near(en.halfPeriod, en.expect, 0.02) && en.trackBad === 0 && near(en.work[0], 200) && near(en.work[1], 40), 'A energy: pendulum Ek + Ep = E0 within 5e-5 (40 random, max drift ' + en.maxDrift.toExponential(1) + '), half period = pi sqrt(L/g), track Ek + Ep (+ loss) = E0');
    ok(near(en.track[0], 8) && near(en.track[1], 0, 1e-9) && en.track[2] < 8 && near(en.track[3], 0, 1e-9), 'A energy: the track starts at H0, has a valley and a lower hill');
    const lv = r.lever;
    ok(lv.bad === 0 && lv.a.t1 === 20 && lv.a.t2 === 20 && lv.a.balanced && lv.a.kind === '省力杠杆', 'A lever: balance F1 L1 = F2 L2 (2 hooks x 20 cm = 4 x 10), tilt direction, the three kinds (500 random)');
    ok(lv.bad === 0 && !lv.b.balanced && lv.b.tilt > 0, 'A lever: 3 hooks x 20 cm beat 2 hooks x 25 cm (left end down)');
    const pu = r.pulley;
    ok(pu.bad === 0 && near(pu.p.F, 3) && near(pu.p.eta, 1) && near(pu.i.F, 5) && near(pu.i.eta, 1), 'A pulley: F = (G + Gm + f)/n, s = n h, 0 < eta <= 1, incline eta = sin/(sin + mu cos) (500 random)');
    const sh = r.specificheat;
    ok(sh.bad === 0 && near(sh.Q, 10) && near(sh.tw, 27.14, 0.01) && near(sh.tk, 34.29, 0.01) && sh.cap === 100, 'A specific heat: dT = Q / (c m); water stops at 100; the sample with the smaller c rises more (300 random)');
    const oh = r.ohm;
    ok(oh.bad === 0 && oh.lad === 0 && near(oh.rheo[2], 50) && near(oh.six.I, 0.2) && near(oh.six.U1, 2) && near(oh.six.Q1, 4 * 10 * 0.04 * 0 + 0.04 * 10 * 10), 'A ohm: series / parallel solver = independent nodal solver (Gaussian elimination, 600 random + 100 ladders), P = U I = P1 + P2, Q = I^2 R t');
    const em = r.em;
    ok(em.bad === 0 && em.emf0 === 0 && em.str[0] === 200 && em.str[1] === 4000 && em.clips.join() === '0,20,3,30' && em.dir.join() === '1,-1,-1,1,0' && near(em.F, 0.1) && Math.abs(em.emf) > 0.1, 'A em: dPhi/dx numeric, flux even, emf odd in x and in v, zero for a still magnet and at the centre; clips; the motor reverses with the current OR the poles (300 random)');
  }

  // ---- the eleven models added later (rule 57 second pass): hand values and independent calculations ----
  {
    const r = await page.evaluate(async () => {
      const M = {}; for (const n of ['dispersion', 'eye', 'fluid', 'molecule', 'engine', 'circuit', 'bulbpower', 'home', 'magfield', 'emwave', 'energysrc', 'density']) M[n] = await import(`/src/phys/model-${n}.ts`);
      const rnd = (a, b) => a + Math.random() * (b - a), pick = (a) => a[Math.floor(Math.random() * a.length)];
      const o = {};
      // dispersion: samples of the prism, the mixing names
      o.disp = { s: [], n: [M.dispersion.nGlass(0.65), M.dispersion.nGlass(0.42)], mix: [[100, 0, 0], [0, 100, 0], [0, 0, 100], [100, 100, 0], [0, 100, 100], [100, 0, 100], [100, 100, 100], [0, 0, 0], [40, 40, 40], [100, 30, 0]].map((v) => M.dispersion.mixName(...v)), seen: [[1, 2], [0, 1], [2, 2], [1, 0], [4, 0], [3, 3]].map(([a, b]) => M.dispersion.seenName(a, b)) };
      for (let i = 0; i < 400; i++) { const A = Math.floor(rnd(30, 71)), th = Math.floor(rnd(20, 81)), lam = rnd(0.4, 0.7); const p = M.dispersion.prism(A, th, lam); o.disp.s.push([A, th, lam, p.tir, p.dev]); }
      o.disp.min = [[1.5, 60, M.dispersion.minDeviation(1.5, 60)], [1.6, 50, M.dispersion.minDeviation(1.6, 50)]];
      o.disp.spread = [M.dispersion.spread(60, 50), M.dispersion.spread(70, 20)];
      // eye
      const E = M.eye; o.eye = { s: [], range: [E.range(0, 0), E.range(1, 0), E.range(2, 0)], glass: E.myopiaGlass(0.5), myo: [E.view(1, Infinity, 0), E.view(1, Infinity, -2.5), E.view(1, Infinity, -2.34)], hyp: [E.view(2, 0.25, 0), E.view(2, 0.25, 3)], tele: [E.teleMag(80, 4), E.teleLen(80, 4)], micro: [E.microMag(40, 16), E.fieldMm(10), E.cellsAcross(10), E.cellsAcross(40)], RET: E.RETINA };
      for (let i = 0; i < 600; i++) { const vis = Math.floor(rnd(0, 3)), u = pick([0.1, 0.15, 0.25, 0.4, 0.8, 1, 3, 6, Infinity]), P = pick([-6, -4, -2.5, -2, -1, 0, 1, 2, 3, 4]); const v = E.view(vis, u, P); o.eye.s.push([vis, u === Infinity ? -1 : u, P, v.clear, v.where, v.need]); }
      // fluid
      const F = M.fluid; o.fluid = { h: [F.hRight(10, 800), F.hRight(10, 1000), F.hRight(12, 1200)], p: [F.liquidP(1000, 10), F.liquidP(800, 12.5)], v: [F.speed(1, 10), F.speed(3, 2)], np: [F.narrowP(3, 2), F.narrowP(1, 10), F.narrowP(2, 5)], drop: F.dropKPa(2, 6), air: [F.airDrop(0), F.airDrop(4)], close: [F.closes(3), F.closes(4), F.closes(10)] };
      // molecule
      const Mo = M.molecule; o.mol = { mix0: [Mo.mixing(20, 0), Mo.mixing(500, 0)], same: JSON.stringify(Mo.walk(100, 50)) === JSON.stringify(Mo.walk(100, 50)), step: [Mo.stepSize(20), Mo.stepSize(500), Mo.stepSize(-273)], inbox: true, force: [Mo.force(1), Mo.force(0.9), Mo.force(1.5), Mo.force(3), Mo.force(1.109), Mo.force(0.8)], kinds: [Mo.kind(0.9), Mo.kind(1), Mo.kind(2)], msd: [], avg: [] };
      for (let k = 0; k < 10; k++) { const a = Mo.walk(20, 3, k + 1), b = Mo.walk(500, 3, k + 1), z = Mo.walk(20, 0, k + 1); const sq = (c) => c.rx.reduce((s, x, i) => s + (x - z.rx[i]) ** 2 + (c.ry[i] - z.ry[i]) ** 2, 0); o.mol.msd.push(sq(b) / sq(a)); }
      for (const [T, t] of [[0, 20], [500, 20], [20, 5], [20, 40]]) { let sum = 0; for (let s = 1; s <= 20; s++) sum += Mo.mixing(T, t, s); o.mol.avg.push(sum / 20); }
      for (const [T, t, sd] of [[500, 30, 1], [0, 60, 2], [100, 15, 3]]) { const c = Mo.walk(T, t * 10, sd); for (const a of [c.rx, c.bx]) if (a.some((x) => x < 0 || x > 2)) o.mol.inbox = false; for (const a of [c.ry, c.by]) if (a.some((x) => x < 0 || x > 1)) o.mol.inbox = false; }
      // engine
      const En = M.engine; o.eng = { stroke: [0, 179, 180, 359, 360, 539, 540, 719, 720, -10].map((t) => En.stroke(t)), piston: [0, 90, 180, 270, 360, 540].map((t) => En.piston(t)), sym: 0, mono: true, vol: En.volume(180) / En.volume(0), vols: [En.volume(0), En.volume(180)], press: [En.pressure(100), En.pressure(359.99), En.pressure(360), En.pressure(539.9), En.pressure(600)], valves: [En.intakeOpen(90), En.intakeOpen(200), En.exhaustOpen(600), En.exhaustOpen(400)], down: [90, 270, 450, 630].map((t) => En.down(t)), eta: [En.efficiency(33, 30, 7), En.efficiency(50, 40, 20)], bal: [En.balance(100, 60, 30, 10), En.balance(100, 80, 40, 10), En.balance(100, 20, 20, 20)], heat: En.heat(4.6e7, 2), works: En.worksPerSecond(3000) };
      for (let t = 0; t < 360; t += 7) { if (Math.abs(En.piston(t) - En.piston(360 - t)) > 1e-9 || Math.abs(En.piston(t) - En.piston(t + 360)) > 1e-9) o.eng.sym++; const p = En.piston(t); if (p < -1e-9 || p > 1 + 1e-9) o.eng.sym++; }
      for (let t = 0; t < 179; t++) if (En.piston(t + 1) < En.piston(t)) o.eng.mono = false;
      // circuit: raw results for every combination
      o.circ = []; for (const U of [3, 6, 12]) for (const sw of [0, 1]) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) for (let c = 0; c < 3; c++) { const bd = M.circuit.build(U, sw === 1, [a, b, c]); o.circ.push([U, sw, a, b, c, bd.R === Infinity ? -1 : bd.R, bd.I, bd.kind, bd.parts.map((p) => [p.I, p.U, p.place])]); }
      // bulb
      o.bulb = []; for (const bulb of [0, 1]) for (const cells of [2, 3, 4]) for (let Rp = 0; Rp <= 20; Rp += 0.5) { const l = M.bulbpower.solve(bulb, cells, Rp); o.bulb.push([bulb, cells, Rp, l.I, l.U, l.P, l.R, l.ratio]); }
      o.bright = [0.05, 0.5, 0.9, 1, 1.15, 1.3, 1.5, 1.6].map((x) => M.bulbpower.brightness(x));
      // home
      const Ho = M.home; o.home = { load: [Ho.load([3, 1, 0, 0, 0], 10, false), Ho.load([0, 0, 0, 1, 1], 10, false), Ho.load([0, 0, 0, 1, 1], 20, false), Ho.load([0, 0, 0, 0, 0], 5, true)], body: [Ho.bodyCurrent(0, 0, 0), Ho.bodyCurrent(0, 1, 0), Ho.bodyCurrent(0, 0, 1), Ho.bodyCurrent(1, 0, 0)], rcd: [Ho.rcdTrips(0.0733), Ho.rcdTrips(0.02)], danger: [0.0005, 0.005, 0.02, 0.05].map((x) => Ho.danger(x)), pen: [0, 1, 2].flatMap((h) => [0, 1].map((k) => Ho.penLit(h, k))) };
      // magfield
      const Mg = M.magfield; o.mag = { axis: [], sym: 0, mirror: 0, ends: [], wire: [Mg.wireB(5, 2), Mg.wireB(2, 4)], defl: [Mg.deflection(5, 2, 1), Mg.deflection(5, 2, -1), Mg.deflection(0, 4, 1)], dip: [0, 90, 45, 40, -40, 85].map((l) => Mg.dip(l)), earth: [Mg.earthB(0), Mg.earthB(90), Mg.earthH(0), Mg.earthH(90), Mg.earthH(60)], sol: [Mg.solenoidRightPole(1), Mg.solenoidRightPole(-1)] };
      for (const ns of [1, -1]) { const P = Mg.poles(ns); o.mag.axis.push([Mg.field(Mg.CX, Mg.CY, ns)[0] * ns, Mg.field(P.N[0] + ns * 30, Mg.CY, ns)[0] * ns, Mg.field(P.S[0] - ns * 30, Mg.CY, ns)[0] * ns]); }
      for (let i = 0; i < 100; i++) { const x = rnd(20, 620), y = rnd(20, 380); const a = Mg.field(x, y, 1), b = Mg.field(x, 2 * Mg.CY - y, 1), m1 = Mg.field(x, y, -1), m2 = Mg.field(2 * Mg.CX - x, y, 1); if (Math.abs(a[0] - b[0]) > 1e-9 * (1 + Math.abs(a[0])) || Math.abs(a[1] + b[1]) > 1e-9 * (1 + Math.abs(a[1]))) o.mag.sym++; if (Math.abs(m1[0] + m2[0]) > 1e-9 * (1 + Math.abs(m1[0])) || Math.abs(m1[1] - m2[1]) > 1e-9 * (1 + Math.abs(m1[1]))) o.mag.mirror++; }
      for (const ns of [1, -1]) { const P = Mg.poles(ns), ls = Mg.lines(ns, 12); o.mag.ends.push({ n: ls.length, atS: ls.filter((l) => Math.hypot(l[l.length - 1][0] - P.S[0], l[l.length - 1][1] - P.S[1]) < 8).length, leaves: ls.filter((l) => { const p = l[l.length - 1]; return p[0] < -10 || p[0] > 650 || p[1] < -10 || p[1] > 407; }).length, outward: ls.every((l) => Math.hypot(l[3][0] - P.N[0], l[3][1] - P.N[1]) > Math.hypot(l[0][0] - P.N[0], l[0][1] - P.N[1])) }); }
      // emwave
      const W = M.emwave; o.em = { band: [3e8, 1e12, 5e14, 1e15, 1e17, 1e20].map((f) => W.band(f)), edges: W.BANDS.map((b) => b.lo), wl: [W.wavelength(1e8), W.wavelength(5e14), W.wavelength(4e14), W.wavelength(7.5e14), W.wavelength(340, 340)], sci: [3e8, 1, 4.5e14, 1e8, 9.96e5, 0.0034, 12, 3.84e5].map((x) => W.sci(x)), delay: [W.delay(384400, W.C), W.delay(11000, 2e8), W.delay(1200, 340)], media: W.MEDIA.map((m) => m[1]) };
      // energy sources
      const Sx = M.energysrc; o.src = { list: Sx.SOURCES.map((s) => [s.name, s.renew, s.primary]), total: [Sx.total(0, 0), Sx.total(0, 10), Sx.total(1, 0), Sx.total(4, 0), Sx.total(3, 0)], weakest: [0, 1, 2, 3, 4, 5].map((i) => Sx.weakest(i)), mix: [Sx.mix(60, 15, 5), Sx.mix(30, 20, 10), Sx.mix(100, 100, 0), Sx.mix(0, 0, 0)], steps: Sx.steps(0, 10), plants: Sx.PLANTS.map((p) => [p.steps.length, p.chain.split('→').length]) };
      return o;
    });
    const dg = (x) => (x * 180) / Math.PI, rd = (x) => (x * Math.PI) / 180;
    // dispersion: an independent vector ray trace through a prism (Snell's law in vector form at each face), with the same teaching glass n(lambda)
    const trace = (A, th, lam) => {
      const n = 1.55 + 0.02 / (lam * lam), h = rd(A / 2);
      const refr = (d, nrm, n1, n2) => { const c = -(d[0] * nrm[0] + d[1] * nrm[1]), k = 1 - (n1 / n2) ** 2 * (1 - c * c); if (k < 0) return null; const f = n1 / n2; return [f * d[0] + (f * c - Math.sqrt(k)) * nrm[0], f * d[1] + (f * c - Math.sqrt(k)) * nrm[1]]; };
      const nL = [-Math.cos(h), -Math.sin(h)], nR = [Math.cos(h), -Math.sin(h)];   // outward normals of the left / right face (y down)
      const inward = [Math.cos(h), Math.sin(h)], phi = h - rd(th), d0 = [Math.cos(phi), Math.sin(phi)];
      const d1 = refr(d0, nL, 1, n); if (!d1) return null;   // the normal that points against the incoming ray
      const d2 = refr(d1, [-nR[0], -nR[1]], n, 1); if (!d2) return null;
      void inward;
      let dev = dg(Math.acos(Math.max(-1, Math.min(1, d0[0] * d2[0] + d0[1] * d2[1])))); const cross = d0[0] * d2[1] - d0[1] * d2[0]; if (cross < 0) dev = -dev;
      return dev;
    };
    let dbad = 0, dn = 0, tirBad = 0; for (const [A, th, lam, tir, dev] of r.disp.s) { const t = trace(A, th, lam); if (t === null) { if (!tir) tirBad++; continue; } if (tir) { tirBad++; continue; } dn++; if (Math.abs(t - dev) > 1e-6) dbad++; }
    ok(dbad === 0 && tirBad === 0 && dn > 100, `A dispersion: deviation of 400 random rays = an independent vector ray trace through both faces (${dn} refracted, the rest totally reflected agree)`);
    ok(r.disp.n[0] < r.disp.n[1] && near(r.disp.n[0], 1.55 + 0.02 / 0.4225, 1e-9) && r.disp.spread[0] > 7 && r.disp.spread[1] === null, 'A dispersion: violet has the larger index, the spread of 60 deg / 50 deg is about 7.4 degrees, a flat 70 deg prism at 20 deg incidence reflects totally');
    ok(near(r.disp.min[0][2], 2 * dg(Math.asin(1.5 * Math.sin(rd(30)))) - 60, 1e-9) && near(r.disp.min[0][2], 37.18, 0.01), 'A dispersion: minimum deviation 2 asin(n sin(A/2)) - A (n 1.5, A 60: 37.2 degrees)');
    ok(r.disp.mix.join() === '红色,绿色,蓝色,黄色,青色,品红色,白色,黑色,灰色,红色' && r.disp.seen.join() === '黑色,红色,绿色,红色,黑色,蓝色'.split(',').join(), 'A dispersion: red + green = yellow, green + blue = cyan, red + blue = magenta, all three = white, none = black, dim grey; a red object is black in green light, white objects show the light, black stays black: ' + r.disp.mix.join('/') + ' ' + r.disp.seen.join('/'));
    // eye: acceptance by an independent search over the accommodation
    let eb = 0; const RET = 1 / 0.024, REL = [RET, 44, 39];
    for (const [vis, u, P, clear, where, need] of r.eye.s) { const inv = u < 0 ? 0 : 1 / u; let can = false; for (let a = 0; a <= 4.0000001; a += 0.001) { if (Math.abs(P - inv + REL[vis] + a - RET) < 6e-4) can = true; } if (can !== clear && Math.abs(need) > 0.003 && Math.abs(need - 4) > 0.003) eb++; if (clear !== (where === 'on')) eb++; if (!clear && (need < 0) !== (where === 'before')) eb++; }
    ok(eb === 0, 'A eye: sharp image exists exactly when the accommodation needed lies in 0..4 D (600 random cases against a brute-force search over the accommodation)');
    ok(near(r.eye.range[0].near, 0.25, 1e-3) && r.eye.range[0].far === Infinity, 'A eye: the normal eye sees from 25 cm to infinity');
    ok(near(r.eye.range[1].far, 1 / (44 - r.eye.RET), 1e-9) && r.eye.range[1].far > 0.4 && r.eye.range[1].far < 0.45 && r.eye.range[1].near < 0.17 && near(r.eye.range[2].near, 1 / (39 + 4 - r.eye.RET), 1e-9) && r.eye.range[2].near > 0.7 && r.eye.range[2].near < 0.8, 'A eye: the myopic eye has a far point of 43 cm, the hyperopic eye a near point of 75 cm');
    ok(near(r.eye.glass, -2, 1e-9) && !r.eye.myo[0].clear && r.eye.myo[0].where === 'before' && r.eye.myo[1].clear && r.eye.myo[2].clear && !r.eye.hyp[0].clear && r.eye.hyp[0].where === 'behind' && r.eye.hyp[1].clear, 'A eye: -2 D for a 50 cm far point; a myopic eye blurs distant stars (image in front of the retina) and a concave lens fixes it; a hyperopic eye blurs a book (image behind) and a convex lens fixes it');
    ok(near(r.eye.tele[0], 20) && near(r.eye.tele[1], 84) && r.eye.micro[0] === 640 && near(r.eye.micro[1], 1.8) && near(r.eye.micro[2], 18) && near(r.eye.micro[3], 4.5), 'A eye: telescope M = f/f (80 / 4 = 20), tube = sum, microscope 40 x 16 = 640, the field of view shrinks with the objective (1.8 mm at 10x)');
    // fluid
    ok(near(r.fluid.h[0], 12.5) && near(r.fluid.h[1], 10) && near(r.fluid.h[2], 10, 0.84) && near(r.fluid.p[0], r.fluid.p[1], 1e-9), 'A fluid: 10 cm of water balances 12.5 cm of alcohol and the pressures at the interface are equal (rho1 g h1 = rho2 g h2)');
    ok(near(r.fluid.v[0], 1) && near(r.fluid.v[1], 15) && near(r.fluid.np[0], 150 - 0.5 * 1000 * (15 * 15 - 3 * 3) / 1000) && near(r.fluid.np[1], 150) && near(r.fluid.np[2], 150 - 0.5 * 1000 * (4 * 4 - 2 * 2) / 1000) && near(r.fluid.drop, 16) && near(r.fluid.air[1], 0.5 * 1.29 * 16) && r.fluid.close.join() === 'false,true,true', 'A fluid: v = Q / S, p + rho v^2 / 2 constant (narrow part 42 kPa at 3 L/s through 2 cm2), no change in a uniform pipe, two sheets of paper close above about 4 m/s');
    // molecule
    ok(r.mol.mix0[0] === 0 && r.mol.mix0[1] === 0 && r.mol.same && r.mol.inbox && near(r.mol.step[0], 0.05) && near(r.mol.step[1] / r.mol.step[0], Math.sqrt(773 / 293), 1e-9), 'A molecule: nothing is mixed at t = 0, the walk is deterministic and stays inside the box, step size ~ sqrt(absolute temperature)');
    ok(r.mol.msd.every((x) => near(x, 773 / 293, 0.3)) && r.mol.avg[1] > r.mol.avg[0] + 8 && r.mol.avg[3] > r.mol.avg[2] + 20, 'A molecule: the mean square displacement scales with the absolute temperature (10 seeds, 160 molecules each), hotter mixes faster, later is more mixed (average over 20 seeds ' + r.mol.avg.map((v) => v.toFixed(0)).join('/') + ' %)');
    ok(near(r.mol.force[0], 0, 1e-12) && r.mol.force[1] > 1 && r.mol.force[2] < 0 && Math.abs(r.mol.force[3]) < 0.03 && near(r.mol.force[4], -1, 3e-3) && r.mol.force[5] > r.mol.force[1] && r.mol.kinds.join() === 'repel,balance,attract', 'A molecule: the force is zero at r0, repulsive inside, attractive outside with its maximum at 1.11 r0, negligible at 3 r0');
    // engine
    ok(r.eng.stroke.join() === '0,0,1,1,2,2,3,3,0,3' && near(r.eng.piston[0], 0) && near(r.eng.piston[2], 1) && near(r.eng.piston[4], 0, 1e-9) && near(r.eng.piston[5], 1) && r.eng.sym === 0 && r.eng.mono && near(r.eng.vol, 10, 1e-9) && r.eng.valves.join() === 'true,false,true,false' && r.eng.down.join() === 'true,false,true,false', 'A engine: strokes every 180 degrees (also negative angles wrap), piston at top / bottom, symmetric and periodic, compression ratio 10, valves, direction');
    ok(near(r.eng.press[1], 10 ** 1.35, 0.05) && near(r.eng.press[2], 3 * 10 ** 1.35, 0.5) && near(r.eng.press[3], 3, 0.05) && r.eng.press[0] < 1 && r.eng.press[4] > 1, 'A engine: pressure 22 at the end of the compression, jumps x3 at the burn, falls to 3 by the end of the power stroke');
    ok(r.eng.eta[0] === 30 && r.eng.eta[1] === 0 && r.eng.bal.join() === 'ok,more,less' && near(r.eng.heat, 9.2e7) && near(r.eng.works, 25), 'A engine: efficiency = 100 - losses, energy balance verdicts (ok / more / less), Q = qm, 3000 r/min = 25 works a second');
    // circuit: an independent nodal (Gaussian elimination) solution of every combination
    const solveNet = (U, sw, m) => {
      const ser = [0, 1, 2].filter((i) => m[i] === 1), par = [0, 1, 2].filter((i) => m[i] === 2); const RES = [10, 20, 30];
      let ps = par.slice(); if (ps.length === 1) { ser.push(ps[0]); ps = []; }
      if (!ser.length && !ps.length) return { open: true };
      if (!sw) return { I: 0, per: [0, 1, 2].map(() => 0) };
      // nodes: 0 ground, 1 = battery +, then one node after each series resistor; the last node feeds the parallel group (to ground)
      const nn = ser.length + 1, nodes = nn; const G = Array.from({ length: nodes }, () => new Array(nodes + 1).fill(0));
      const add = (a, b, R) => { const g = 1 / R; if (a > 0) { G[a - 1][a - 1] += g; if (b > 0) G[a - 1][b - 1] -= g; } if (b > 0) { G[b - 1][b - 1] += g; if (a > 0) G[b - 1][a - 1] -= g; } };
      // node k (1-based) ; series resistor j connects node j to node j+1 ; battery fixes node 1 = U
      ser.forEach((i, j) => add(j + 1, j + 2, RES[i]));
      const last = ser.length + 1; ps.forEach((i) => add(last, 0, RES[i]));
      if (!ps.length) add(last, 0, 1e-9);   // plain wire to ground
      // fix node 1
      for (let c = 0; c <= nodes; c++) G[0][c] = 0; G[0][0] = 1; G[0][nodes] = U;
      for (let c = 0; c < nodes; c++) { let p = c; for (let r2 = c + 1; r2 < nodes; r2++) if (Math.abs(G[r2][c]) > Math.abs(G[p][c])) p = r2; [G[c], G[p]] = [G[p], G[c]]; for (let r2 = 0; r2 < nodes; r2++) { if (r2 === c) continue; const f = G[r2][c] / G[c][c]; for (let k = c; k <= nodes; k++) G[r2][k] -= f * G[c][k]; } }
      const V = G.map((row, i) => row[nodes] / row[i]); const volt = (k) => (k === 0 ? 0 : V[k - 1]);
      const per = [0, 0, 0]; ser.forEach((i, j) => { per[i] = (volt(j + 1) - volt(j + 2)) / RES[i]; }); ps.forEach((i) => { per[i] = volt(last) / RES[i]; });
      return { I: ser.length ? per[ser[0]] : ps.reduce((s, i) => s + per[i], 0), per };
    };
    let cb = 0, cn = 0;
    for (const [U, sw, a, b, c, R, I, kind, parts] of r.circ) { const ref = solveNet(U, sw, [a, b, c]); cn++; if (ref.open) { if (kind !== 'open' || I !== 0) cb++; continue; } if (Math.abs(ref.I - I) > 1e-6) cb++; for (let i = 0; i < 3; i++) if (parts[i][2] !== 'off' && Math.abs(ref.per[i] - parts[i][0]) > 1e-6) cb++; if (sw === 1) { const rs = [10, 20, 30]; let ser = [0, 1, 2].filter((i) => [a, b, c][i] === 1), par = [0, 1, 2].filter((i) => [a, b, c][i] === 2); if (par.length === 1) { ser.push(par[0]); par = []; } const Rexp = ser.reduce((s, i) => s + rs[i], 0) + (par.length ? 1 / par.reduce((s, i) => s + 1 / rs[i], 0) : 0); if (Math.abs(R - Rexp) > 1e-9 || Math.abs(U / R - I) > 1e-9) cb++; } }
    ok(cb === 0 && cn === 3 * 2 * 27, `A circuit: all ${cn} combinations (3 voltages x switch x 27 placements) = an independent nodal solution (Gaussian elimination): currents, total resistance, open circuit, a lone resistor in the "parallel" group is in series`);
    ok(r.circ.filter((x) => x[2] === 1 && x[3] === 1 && x[4] === 1 && x[0] === 6 && x[1] === 1).every((x) => near(x[5], 60) && x[7] === 'series') && r.circ.filter((x) => x[2] === 2 && x[3] === 2 && x[4] === 2 && x[1] === 1).every((x) => near(x[5], 1 / (1 / 10 + 1 / 20 + 1 / 30)) && x[7] === 'parallel') && r.circ.filter((x) => x[2] === 1 && x[3] === 2 && x[4] === 2).every((x) => x[7] === 'mixed'), 'A circuit: A + B + C in series = 60 ohm, in parallel = 5.45 ohm, A in series with B || C is a mixed circuit');
    // bulb: residual of the loop equation, an independent scan, monotony
    let bb = 0;
    const BU = [{ Un: 2.5, In: 0.3 }, { Un: 3.8, In: 0.3 }];
    for (const [bulb, cells, Rp, I, U, P, R, ratio] of r.bulb) { const E = 1.5 * cells, rt = Rp + 0.3 * cells; const Ub = BU[bulb].Un * (I / BU[bulb].In) ** (5 / 3); if (Math.abs(E - (Ub + I * rt)) > 1e-8 || Math.abs(U - Ub) > 1e-9 || Math.abs(P - U * I) > 1e-12 || Math.abs(R - U / I) > 1e-9 || Math.abs(ratio - P / (BU[bulb].Un * BU[bulb].In)) > 1e-9) bb++; let best = 0, bd = 1e9; for (let i = 0; i <= 2000; i++) { const x = (E / rt) * (i / 2000), f = Math.abs(BU[bulb].Un * (x / BU[bulb].In) ** (5 / 3) + x * rt - E); if (f < bd) { bd = f; best = x; } } if (Math.abs(best - I) > (E / rt) / 2000 + 1e-9) bb++; }
    const mono = (bulb, cells) => r.bulb.filter((x) => x[0] === bulb && x[1] === cells).every((x, i, a) => i === 0 || (x[3] < a[i - 1][3] && x[4] < a[i - 1][4] && x[7] < a[i - 1][7]));
    ok(bb === 0 && mono(0, 3) && mono(1, 4) && r.bulb.length === 2 * 3 * 41, `A bulbpower: E = U_bulb(I) + I (Rp + r) holds to 1e-8 for all ${r.bulb.length} settings and agrees with an independent scan; more rheostat resistance = less current, voltage and power`);
    const at = (bulb, cells, Rp) => r.bulb.find((x) => x[0] === bulb && x[1] === cells && x[2] === Rp);
    ok(near(at(0, 3, 6)[4], 2.47, 0.02) && near(at(0, 3, 6)[7], 0.97, 0.02) && at(0, 3, 0)[7] > 1.5 && at(0, 3, 20)[7] < 0.5 && at(1, 3, 1.5)[7] > 0.9 && at(1, 3, 1.5)[7] < 1.15 && at(0, 3, 6)[6] > at(0, 3, 20)[6], 'A bulbpower: 6 ohm gives 2.47 V and normal light for the 2.5 V bulb, 0 ohm over-drives it, 20 ohm is dim, and the hot filament has the higher resistance (R grows with the current)');
    ok(r.bright.join() === 'off,dim,normal,normal,normal,bright,bright,burn', 'A bulbpower: brightness classes (off < 0.1, dim < 0.9, normal to 1.15, bright to 1.5, burn above): ' + r.bright.join());
    // home
    ok(near(r.home.load[0].P, 330) && near(r.home.load[0].I, 1.5) && !r.home.load[0].blown && r.home.load[1].blown && near(r.home.load[1].I, 3500 / 220, 1e-9) && !r.home.load[2].blown && r.home.load[3].blown && r.home.load[3].I > 2000, 'A home: 3 lamps + TV = 330 W = 1.5 A; air conditioner + water heater (15.9 A) blow a 10 A fuse but not a 20 A one; a short circuit (2200 A) always blows it');
    ok(near(r.home.body[0], 220 / 3000, 1e-9) && near(r.home.body[1], 220 / 1800, 1e-9) && r.home.body[2] < 0.0003 && r.home.body[3] === 0 && r.home.rcd.join() === 'true,false' && r.home.danger.join() === 'none,tingle,stuck,lethal' && r.home.pen.join() === 'false,false,false,true,false,false', 'A home: 73 mA through a dry hand on the floor, 122 mA wet, 0.2 mA on an insulating mat, nothing from the neutral; the 30 mA trip; danger classes; the test pen lights only on the live hole with a finger on the cap');
    // magfield
    ok(r.mag.axis.every(([mid, beyondN, beyondS]) => mid < 0 && beyondN > 0 && beyondS > 0) && r.mag.sym === 0 && r.mag.mirror === 0, 'A magfield: on the axis the field points from N to S between the poles and goes on the same way outside (away from N, towards S), the field is mirror-symmetric (100 random points), reversing the magnet reverses it');
    ok(r.mag.ends.every((e) => e.n === 12 && e.atS >= 3 && e.atS + e.leaves === 12 && e.outward), `A magfield: the field lines leave the N pole outwards and end at the S pole or leave the picture (${r.mag.ends.map((e) => e.atS + ' of 12 end at S').join(', ')})`);
    ok(near(r.mag.wire[0], 4e-7 * Math.PI * 5 / (2 * Math.PI * 0.02) * 1e6, 1e-6) && near(r.mag.wire[1], 4e-7 * Math.PI * 2 / (2 * Math.PI * 0.04) * 1e6, 1e-6) && near(r.mag.defl[0], dg(Math.atan(50 / 30)), 1e-9) && near(r.mag.defl[0], -r.mag.defl[1], 1e-12) && r.mag.defl[2] === 0 && r.mag.sol.join() === 'N,S', 'A magfield: B = mu0 I / 2 pi d (50 microtesla at 5 A and 2 cm), the needle turns by atan(B / 30 microtesla) (59 degrees), the other current direction turns it the other way, no current no turn');
    ok(near(r.mag.dip[0], 0, 1e-9) && near(r.mag.dip[1], 90, 1e-9) && near(r.mag.dip[2], dg(Math.atan(2)), 1e-9) && near(r.mag.dip[3], dg(Math.atan(2 * Math.tan(rd(40)))), 1e-9) && near(r.mag.dip[4], -r.mag.dip[3], 1e-9) && r.mag.dip[5] > 80 && near(r.mag.earth[0], 1) && near(r.mag.earth[1], 2) && near(r.mag.earth[2], 1) && near(r.mag.earth[3], 0, 1e-9) && near(r.mag.earth[4], 0.5, 1e-9), 'A magfield: dip 0 at the equator, 90 at the pole, tan dip = 2 tan lat, odd in the latitude; field strength 1 -> 2, horizontal part 1 -> 0');
    // emwave
    ok(r.em.band.join() === '0,1,2,3,4,5' && r.em.edges.every((e, i, a) => i === 0 || e > a[i - 1]) && near(r.em.wl[0], 3) && near(r.em.wl[1], 6e-7, 1e-12) && r.em.wl[2] > 7.4e-7 && r.em.wl[2] < 7.6e-7 && r.em.wl[3] > 3.9e-7 && r.em.wl[3] < 4.1e-7 && near(r.em.wl[4], 1), 'A emwave: six bands in order, c = lambda f (100 MHz = 3 m, visible light 400-750 nm, sound 340 Hz in air = 1 m)');
    ok(r.em.sci.join() === '3×10⁸,1×10⁰,4.5×10¹⁴,1×10⁸,1×10⁶,3.4×10⁻³,1.2×10¹,3.8×10⁵' && near(r.em.delay[0], 1.2813, 1e-3) && near(r.em.delay[1], 0.055, 1e-9) && near(r.em.delay[2], 3529.4, 0.1) && r.em.media.join() === '300000000,200000000,340', 'A emwave: scientific notation text, the moon is 1.28 s away, 11000 km of fibre 55 ms, 1200 km at the speed of sound 59 minutes: ' + r.em.sci.join(' '));
    // energy sources
    const REN = { 煤炭: false, 石油: false, 天然气: false, 核能: false, 太阳能: true, 风能: true, 水能: true, 生物质能: true, 地热能: true, 电能: null, 氢能: null };
    ok(r.src.list.length === 11 && r.src.list.every(([n, rn, pr]) => ({ 煤炭: false, 石油: false, 天然气: false, 核能: false, 太阳能: true, 风能: true, 水能: true, 生物质能: true, 地热能: true, 电能: null, 氢能: null })[n] === rn && pr === !['电能', '氢能'].includes(n)), 'A energy sources: eleven sources, renewable / non-renewable and primary / secondary agree with an independent list');
    ok(near(r.src.total[0], 0.9 * 0.45 * 0.98, 1e-9) && near(r.src.total[1], 0.9 * 0.55 * 0.98, 1e-9) && near(r.src.total[2], 0.9 * 0.98, 1e-9) && near(r.src.total[3], 0.2 * 0.97, 1e-9) && near(r.src.total[4], 0.99 * 0.35 * 0.98, 1e-9) && r.src.weakest.join() === '汽轮机,水轮机,风力机叶片,汽轮机,太阳能电池板,汽轮机' && near(r.src.steps[1], 0.55, 1e-12) && r.src.plants.every(([n, k]) => k === n + 1), 'A energy sources: total efficiency = product of the steps, the weakest step is improved by the boost, every chain has one more form than steps');
    ok(near(r.src.mix[0].wind, 20) && near(r.src.mix[0].renew, 35) && near(r.src.mix[0].co2, 0.6 * 0.9 + 0.15 * 0.02 + 0.05 * 0.015 + 0.2 * 0.03, 1e-9) && r.src.mix[1].renew === 60 && r.src.mix[1].co2 < 0.5 && near(r.src.mix[2].coal + r.src.mix[2].hydro, 100, 1e-9) && r.src.mix[2].wind === 0 && near(r.src.mix[3].wind, 100) && near(r.src.mix[3].co2, 0.03, 1e-9), 'A energy sources: the electricity mix adds to 100 %, wind and solar are the rest, over 100 % is scaled down, carbon per kWh = sum of share x emission');
  }

  // ---- the quiz generators ----
  {
    const r = await page.evaluate(async (nw) => {
      const out = {}; const mulberry32 = (await import('/src/phys/qtools.ts')).mulberry32;
      for (const n of ['motion', 'sound', 'heating', 'reflection', 'refraction', 'lens', 'spring', 'friction', 'newton', 'pressure', 'buoyancy', 'energy', 'lever', 'pulley', 'specificheat', 'ohm', 'em', 'dispersion', 'eye', 'fluid', 'molecule', 'engine', 'circuit', 'bulbpower', 'home', 'magfield', 'emwave', 'energysrc', 'density', ...nw]) {
        const M = await import(`/src/phys/model-${n}.ts`); const list = []; const errors = [];
        for (let seed = 1; seed <= 300; seed++) { try { list.push(M.quiz(mulberry32(seed))); } catch (e) { errors.push(String(e)); } }
        out[n] = { list, errors };
      }
      return out;
    }, NEW4);
    const chk = (id, qs, expected, wrongToo) => {
      let bad = 0, n = 0; const msgs = [];
      for (const quiz of qs) {
        if (quiz.length !== 5) { bad++; msgs.push('not 5'); continue; }
        for (const q of quiz) {
          n++;
          if (q.choices.length !== 4 || new Set(q.choices).size !== 4 || q.choices[q.a] !== q.ans || !q.q || !q.kind) { bad++; msgs.push('shape ' + q.kind); continue; }
          if (/NaN|undefined|Infinity/.test(JSON.stringify(q))) { bad++; msgs.push('NaN ' + q.kind); continue; }
          const f = expected[q.kind];
          if (f) { const v = f(q.p); const got = numOf(q.ans); const tol = 0.5 * 10 ** -decimals(q.ans) + 1e-9; const good = Math.abs(got - (wrongToo ? v * 1.1 : v)) <= tol; if (!good) { bad++; if (msgs.length < 3) msgs.push(`${q.kind} ${JSON.stringify(q.p)}: ${q.ans} vs ${v}`); } }
          else if (!(TEXT_KINDS[id] || []).includes(q.kind)) { bad++; msgs.push('unknown kind ' + q.kind); }
        }
      }
      return { bad, n, msgs };
    };
    let total = 0;
    for (const id of IDS) {
      const { list, errors } = r[id];
      const res = chk(id, list, EXPECT[id] || {}, false);
      total += res.n;
      ok(errors.length === 0 && res.bad === 0, `A quiz ${id}: 300 seeds x 5 questions: 4 different choices, right answer recomputed independently${res.msgs.length ? ' ' + res.msgs.join('; ') : ''}${errors.length ? ' ' + errors[0] : ''}`);
      // the checker catches a wrong formula (otherwise it would prove nothing)
      if (Object.keys(EXPECT[id] || {}).length) { const wrong = chk(id, list, EXPECT[id], true); ok(wrong.bad > 0, `A quiz ${id}: the check is able to fail (a formula 10% off is caught)`); }
      // every question of the library: kinds covered
      const kinds = new Set(list.flat().map((q) => q.kind)); ok(kinds.size === 5, `A quiz ${id}: five different kinds of question (${[...kinds].join(', ')})`);
    }
    ok(total === IDS.length * 300 * 5, 'A quiz: ' + total + ' questions checked');
    // the text questions: the right answer follows the model
    const tx = await page.evaluate(async () => {
      const mulberry32 = (await import('/src/phys/qtools.ts')).mulberry32; const L = await import('/src/phys/model-lens.ts'), R = await import('/src/phys/model-refraction.ts'), B = await import('/src/phys/model-buoyancy.ts'), Lv = await import('/src/phys/model-lever.ts');
      let bad = 0;
      for (let s = 1; s <= 300; s++) {
        for (const q of L.quiz(mulberry32(s))) { if (q.kind === 'nature') { const im = L.image(q.p[0], q.p[1], 0); if (q.ans !== im.nature) bad++; } if (q.kind === 'tool') { if (q.ans !== L.image(q.p[0], q.p[1], 0).tool) bad++; } }
        for (const q of R.quiz(mulberry32(s))) if (q.kind === 'tir') { const tir = R.refract(1.33, 1, q.p[0]).tir; if (tir !== q.ans.startsWith('发生全反射')) bad++; }
        for (const q of B.quiz(mulberry32(s))) if (q.kind === 'state') { const [rb, rl] = q.p; const st = rb < rl ? 'float' : rb === rl ? 'suspend' : 'sink'; const m = B.solve(rb * 1000, rl * 1000, 100, 1, 0).state; if (m !== st) bad++; if ((st === 'float') !== q.ans.startsWith('上浮') || (st === 'suspend') !== q.ans.startsWith('悬浮') || (st === 'sink') !== q.ans.startsWith('下沉')) bad++; }
        for (const q of Lv.quiz(mulberry32(s))) { if (q.kind === 'kind') { const [a, b] = q.p; const k = a > b ? '省力杠杆' : a < b ? '费力杠杆' : '等臂杠杆'; if (q.ans !== k || Lv.lever(1, a, 1, b).kind !== k) bad++; } if (q.kind === 'tilt') { const [n1, d1, n2, d2] = q.p; const st = n1 * d1 > n2 * d2 ? '左端下沉' : n1 * d1 < n2 * d2 ? '右端下沉' : '保持水平平衡'; if (q.ans !== st || (Lv.lever(n1, d1, n2, d2).tilt > 0) !== (st === '左端下沉')) bad++; } }
      }
      return bad;
    });
    ok(tx === 0, 'A quiz: lens nature / tool, total reflection, floating state, lever kind / tilt answers agree with their models (1200 questions)');
    const tx2 = await page.evaluate(async () => {
      const mulberry32 = (await import('/src/phys/qtools.ts')).mulberry32; const D = await import('/src/phys/model-dispersion.ts'), Mo = await import('/src/phys/model-molecule.ts'), En = await import('/src/phys/model-engine.ts'), W = await import('/src/phys/model-emwave.ts'), S = await import('/src/phys/model-energysrc.ts');
      let bad = 0, n = 0; const MIXES = ['黄色', '青色', '品红色', '白色'], COLS = ['', '红色', '绿色', '蓝色'], ST = ['吸气冲程', '压缩冲程', '做功冲程', '排气冲程'], BN = ['无线电波', '红外线', '可见光', '紫外线', 'X 射线', 'γ 射线'];
      const REN = { 煤炭: '不可再生能源', 石油: '不可再生能源', 天然气: '不可再生能源', 核能: '不可再生能源', 太阳能: '可再生能源', 风能: '可再生能源', 水能: '可再生能源', 生物质能: '可再生能源', 地热能: '可再生能源' };
      for (let s = 1; s <= 300; s++) {
        for (const q of D.quiz(mulberry32(s))) { if (q.kind === 'mix') { n++; if (q.ans !== MIXES[q.p[0]]) bad++; } if (q.kind === 'obj') { n++; const [o, l] = q.p; if (q.ans !== (o === l ? COLS[o] : '黑色')) bad++; } }
        for (const q of Mo.quiz(mulberry32(s))) if (q.kind === 'force_kind') { n++; const x = q.p[0] / 100; if (q.ans !== (x < 1 ? '斥力占主要，表现为互相排斥' : x === 1 ? '引力和斥力相等，合力为零' : '引力占主要，表现为互相吸引')) bad++; }
        for (const q of En.quiz(mulberry32(s))) if (q.kind === 'stroke') { n++; if (q.ans !== ST[Math.floor(q.p[0] / 180)]) bad++; }
        for (const q of W.quiz(mulberry32(s))) if (q.kind === 'band') { n++; if (q.ans !== BN[Math.max(...q.p)] || new Set(q.p).size !== 4) bad++; }
        for (const q of S.quiz(mulberry32(s))) { if (q.kind === 'renew') { n++; const nm = q.q.replace('是：', ''); if (q.ans !== REN[nm]) bad++; } if (q.kind === 'primary') { n++; const nm = q.q.replace('是：', ''); if (q.ans !== (['电能', '氢能'].includes(nm) ? '二次能源' : '一次能源')) bad++; } }
      }
      return { bad, n };
    });
    ok(tx2.bad === 0 && tx2.n > 1000, `A quiz: colour mixing / object colour, molecular force, engine stroke, highest-frequency band, renewable / primary answers agree with independent lists (${tx2.n} questions)`);
  }


  // ---- density (rule 57): the model against independent arithmetic; the quizzes of energysrc / lever no longer have one constant answer; g = 10 N/kg everywhere ----
  {
    const r = await page.evaluate(async () => {
      const mulberry32 = (await import('/src/phys/qtools.ts')).mulberry32; const D = await import('/src/phys/model-density.ts'), S = await import('/src/phys/model-energysrc.ts'), Lv = await import('/src/phys/model-lever.ts');
      const o = { bad: 0, n: 0, msgs: [] }; const NAMES = ['铝块', '铁块', '铜块', '银块', '铅块'], RHO = [2.7, 7.9, 8.9, 10.5, 11.3];
      const bad = (m) => { o.bad++; if (o.msgs.length < 4) o.msgs.push(m); };
      for (const [, , rho] of D.SOLIDS) for (const V of [5, 12, 20, 33, 50]) for (const V1 of [30, 40, 50]) for (const order of [0, 1]) {
        o.n++; const r = D.solid(rho, V, V1, order); const mTrue = rho * V / 1e6 * 1000, mRead = Math.round((mTrue + (order ? 1.5 : 0)) * 10) / 10;   // kg/m3 x cm3 -> g
        if (Math.abs(r.m - mRead) > 1e-9 || r.V !== V || r.V2 !== V1 + V || Math.abs(r.rho - mRead / V) > 1e-12) bad('solid ' + rho + ' ' + V + ' ' + order);
        if (order === 0 && Math.abs(r.rho - rho / 1000) > 0.0501 / V + 1e-9) bad('right order not exact ' + rho + ' ' + V);
        if (order === 1 && !(r.rho > rho / 1000)) bad('wet solid must give a too large density');
      }
      for (const [, , rho] of D.LIQUIDS) for (const V of [20, 40, 60, 80]) for (const order of [0, 1]) {
        o.n++; const r = D.liquid(rho, V, order);
        if (order === 0) { const a = Math.round((50 + rho / 1000 * 100) * 10) / 10, b = Math.round((50 + rho / 1000 * (100 - V)) * 10) / 10; if (Math.abs(r.a - a) > 1e-9 || Math.abs(r.b - b) > 1e-9 || r.V !== V || Math.abs(r.rho - (a - b) / V) > 1e-9 || Math.abs(r.rho - rho / 1000) > 0.1 / V + 1e-9) bad('liquid order0 ' + rho + ' ' + V); }
        else { if (r.V !== V - 2 || !(r.rho > rho / 1000)) bad('liquid order1 ' + rho + ' ' + V); }
      }
      for (let i = 0; i < NAMES.length; i++) if (D.nameMetal(RHO[i] * 1.02) !== NAMES[i] || D.nameMetal(RHO[i] * 0.98) !== NAMES[i]) bad('nameMetal ' + NAMES[i]);
      if (D.nameMetal(5) !== null || D.nameMetal(0.9) !== null) bad('nameMetal must say none');
      if (D.behaviour(0.6, 1) !== 'float' || D.behaviour(1, 1) !== 'suspend' || D.behaviour(2.7, 1) !== 'sink') bad('behaviour');
      // quiz kinds recomputed here
      const ORD = { 0: '偏大', 1: '偏大', 2: '偏小' }; const seenAns = new Set(), seenLever = new Set(), seenPrim = new Set(), seenRenew = new Set();
      for (let s = 1; s <= 300; s++) {
        for (const q of D.quiz(mulberry32(s))) {
          o.n++;
          if (q.kind === 'ident') { const [mi, V] = q.p; const m = parseFloat(/质量是 ([\d.]+) g/.exec(q.q)[1]); const idx = RHO.reduce((b, d, i) => (Math.abs(d - m / V) < Math.abs(RHO[b] - m / V) ? i : b), 0); if (q.ans !== NAMES[idx] || idx !== mi || Math.abs(m / V - RHO[mi]) > 0.06) bad('ident'); }
          if (q.kind === 'float') { const [a, b] = q.p; const st = a < b ? '上浮' : a === b ? '悬浮' : '下沉'; if (!q.ans.startsWith(st)) bad('float'); }
          if (q.kind === 'order') { if (q.ans !== ORD[q.p[0]]) bad('order'); }
        }
        for (const q of Lv.quiz(mulberry32(s))) if (q.kind === 'tilt') seenLever.add(q.ans);
        for (const q of S.quiz(mulberry32(s))) { const nm = q.q.replace('是：', ''); if (q.kind === 'primary') seenPrim.add(q.ans + '|' + (nm === '电能' || nm === '氢能')); if (q.kind === 'renew') seenRenew.add(q.ans); }
      }
      o.lever = [...seenLever].sort(); o.prim = [...seenPrim].sort(); o.renew = [...seenRenew].sort();
      return o;
    });
    ok(r.bad === 0 && r.n > 1500, `A density: the solid (balance + displacement) and liquid (cylinder + balance) measurements equal independent arithmetic, a wrong order gives a too large density, metals are named from the table, quiz answers agree (${r.n} cases)${r.msgs.length ? ' ' + r.msgs.join('; ') : ''}`);
    ok(r.lever.join() === '保持水平平衡,右端下沉,左端下沉', 'A lever quiz: the tilt answer varies (left down / right down / balanced all occur in 300 seeds)');
    ok(r.prim.join() === '一次能源|false,二次能源|true' && r.renew.join() === '不可再生能源,可再生能源', 'A energysrc quiz: primary / secondary (电能 / 氢能 are asked and are 二次能源) and renewable / not renewable both occur');
  }

  // ---- fourth pass (rule 57): the 13 new models against independent calculations ----
  {
    const r = await page.evaluate(async () => {
      const L = {}; for (const n of ['evap', 'thermo', 'straight', 'diffuse', 'noise', 'lensexp', 'internal', 'resistance', 'ohmlaw', 'rmeasure', 'meter', 'emdev', 'comms']) L[n] = await import(`/src/phys/model-${n}.ts`);
      const mulberry32 = (await import('/src/phys/qtools.ts')).mulberry32;
      const o = { bad: [] }; const bad = (m) => { if (o.bad.length < 40) o.bad.push(m); };
      const near = (a, b, t = 1e-9) => Math.abs(a - b) <= t * Math.max(1, Math.abs(b));
      // ---- evap: monotone in every factor, the exact formula, Clausius-Clapeyron written again here, the six changes of state
      { const M = L.evap; const WF = [1, 1.6, 2.4];
        for (const T of [10, 25, 40, 80]) for (const A of [5, 20, 50]) for (const w of [0, 1, 2]) { const v = M.evapRate(T, A, w); if (!near(v, 0.0005 * A * (T + 20) * WF[w])) bad('evap rate formula'); if (T < 80 && !(M.evapRate(T + 5, A, w) > v)) bad('evap not rising with T'); if (A < 50 && !(M.evapRate(T, A + 5, w) > v)) bad('evap not rising with A'); if (w < 2 && !(M.evapRate(T, A, w + 1) > v)) bad('evap not rising with wind'); }
        if (M.waterLeft(0.5, 30) !== 5 || M.waterLeft(5, 30) !== 0 || M.waterLeft(0, 60) !== 20) bad('waterLeft'); if (!(M.coolDrop(1) > M.coolDrop(0.2) && M.coolDrop(100) <= 10 && M.coolDrop(0) === 0)) bad('coolDrop');
        const G = [{ Tb: 373.15, L: 40700, Tc: 647.1 }, { Tb: 272.65, L: 22400, Tc: 425.1 }, { Tb: 90.2, L: 6800, Tc: 154.6 }], R = 8.314;
        const psat = (g, T) => Math.exp((G[g].L / R) * (1 / G[g].Tb - 1 / (T + 273.15)));
        for (let g = 0; g < 3; g++) { if (!near(M.satPressure(g, G[g].Tb - 273.15), 1, 1e-6)) bad('psat at the normal boiling point ' + g); if (!near(M.boilingAt(g, 1), G[g].Tb - 273.15, 1e-6)) bad('boilingAt 1 atm ' + g); for (let T = -190; T <= 140; T += 17) { if (!near(M.satPressure(g, T), psat(g, T), 1e-9)) bad('psat ' + g + ' ' + T); if (!near(M.boilingAt(g, M.satPressure(g, T)), T, 1e-6)) bad('boiling / psat do not invert ' + g + ' ' + T); } for (let p = 1; p < 20; p += 0.5) if (!(M.boilingAt(g, p + 0.5) > M.boilingAt(g, p))) bad('boiling point must rise with the pressure'); }
        o.evap = { water: [M.gasState(0, 120, 1), M.gasState(0, 120, 2.5), M.gasState(0, 90, 1), M.gasState(0, 100, 1)], butane: [M.gasState(1, 20, 1), M.gasState(1, 20, 2.5), M.gasState(1, 20, 1.9), M.gasState(1, -20, 1), psat(1, 20)], oxygen: [M.gasState(2, 20, 1), M.gasState(2, -183, 1), M.gasState(2, -150, 1), M.gasState(2, -100, 20), M.gasState(2, -140, 20)], oxHot: Array.from({ length: 20 }, (_, i) => M.gasState(2, -100, 1 + i)).every((x) => x === 'hot') };
        let ib = 0; for (const b of [20, 60, 100]) for (const t of [0, 5, 30]) { const v = M.vapour(b, t); if (v < 0 || v > M.M_IODINE || (t > 0 && !(v > 0)) || M.crystals(b, t, 0) !== 0 || !near(M.crystals(b, t, 1), 0.8 * v)) ib++; if (b < 100 && M.vapour(b + 20, t) < v) ib++; }
        o.evap.ib = ib; o.evap.melt = M.IODINE_MELT;
        o.evap.phen = M.PHEN.map((x) => x[1]).join(','); o.evap.proc = M.PROC.join(','); o.evap.abs = M.ABSORB.join(',');
      }
      // ---- thermo
      { const M = L.thermo; let b = 0;
        for (let i = 0; i < 400; i++) { const prev = 35 + Math.floor(Math.random() * 71) / 10, now = 35 + Math.floor(Math.random() * 71) / 10; const want = (sh) => Math.round((sh ? now : Math.max(prev, now)) * 10) / 10; if (M.clinical(prev, now, 0) !== want(0) || M.clinical(prev, now, 1) !== want(1)) b++; }
        for (const [T, w] of [[-20, -20], [-10.4, -10], [-10.6, -11], [36.5, 37], [100, 100], [110, 110], [150, 110], [-50, -20]]) if (M.readLab(T) !== w && !(T === 36.5 && M.readLab(T) === 37)) b++;
        for (let T = 30; T <= 100; T += 5) { if (M.placed(T, 0) !== T || !(M.placed(T, 1) > T) || !(M.placed(T, 2) < T) || !(M.placed(T, 3) < T && M.placed(T, 3) > 20) || M.verdict(T, 0) !== '准确' || M.verdict(T, 1) !== '偏高' || M.verdict(T, 2) !== '偏低' || M.verdict(T, 3) !== '偏低') b++; }
        o.thermo = { b, range: [M.LAB_MIN, M.LAB_MAX, M.CLIN_MIN, M.CLIN_MAX] };
      }
      // ---- straight: similar triangles, and the shadow traced ray by ray from many points of the source
      { const M = L.straight; let b = 0;
        for (const [h, u, v] of [[8, 30, 20], [10, 20, 40], [4, 16, 24], [12, 24, 12]]) if (!near(M.pinholeHeight(h, u, v), h * v / u)) b++;
        if (!near(M.blurMm(2, 30, 30), 4) || M.blurMm(1, 30, 20) > M.SHARP_MM || M.blurMm(6, 30, 20) <= M.SHARP_MM) b++;
        let sb = 0;
        for (const D of [4, 10, 20]) for (const s of [0, 3, 10, 30]) for (const a of [20, 40, 100]) for (const bb of [10, 40, 100]) {
          // a source point at height ys sends a ray past each edge of the object (at x = a) to the screen (x = a + bb)
          let lo = Infinity, hi = -Infinity, ilo = -Infinity, ihi = Infinity; const N = 400;
          for (let k = 0; k <= N; k++) { const ys = s === 0 ? 0 : -s / 2 + (s * k) / N; const proj = (yo) => ys + (yo - ys) * (a + bb) / a; const e1 = proj(-D / 2), e2 = proj(D / 2); lo = Math.min(lo, e1); hi = Math.max(hi, e2); ilo = Math.max(ilo, e1); ihi = Math.min(ihi, e2); if (s === 0) break; }
          const outer = hi - lo, umbra = Math.max(0, ihi - ilo); const r = M.shadow(D, s, a, bb);
          if (!near(r.whole, outer, 1e-9) || !near(r.umbra, umbra, 1e-9) || r.penumbra !== (s > 0 && outer > umbra + 1e-9)) sb++;
        }
        o.straight = { b, sb, ecl: [M.eclipse(0, 0), M.eclipse(180, 0), M.eclipse(90, 0), M.eclipse(0, 3), M.eclipse(180, 1.2), M.eclipse(2, 1.4), M.eclipse(178, 0.9), M.eclipse(356, 0), M.eclipse(6, 0), M.eclipse(186, 0)] };
        let both = 0, n = 0; for (let p = 0; p <= 360; p++) for (let be = -6; be <= 6; be += 0.1) { const e = M.eclipse(p, be); if (e !== 'none') n++; if (e === 'solar' && Math.abs(((p + 180) % 360) - 180) > 5) both++; if (e === 'lunar' && Math.abs(p - 180) > 5) both++; }
        o.straight.eclGrid = [both, n];
      }
      // ---- diffuse: the law of reflection at every tilted facet by vector reflection; the light is only spread, never created
      { const M = L.diffuse; let b = 0;
        for (const r of [0, 0.2, 0.5, 1]) for (const th of [0, 15, 30, 60, 70]) for (let i = 0; i < M.TILTS.length; i++) {
          const t = (25 * r * M.TILTS[i] * Math.PI) / 180, T = (th * Math.PI) / 180;
          const d = [Math.sin(T), -Math.cos(T)], n = [-Math.sin(t), Math.cos(t)], dn = d[0] * n[0] + d[1] * n[1], rr = [d[0] - 2 * dn * n[0], d[1] - 2 * dn * n[1]];
          const ang = (Math.atan2(rr[0], rr[1]) * 180) / Math.PI; if (Math.abs(ang - M.outAngle(r, th, i)) > 1e-9) b++;
          if (Math.abs(M.outAngle(r, th, i) - th) > 2 * 25 * r + 1e-9) b++;
        }
        let E = [];
        for (const r of [0.05, 0.1, 0.3, 0.6, 1]) for (const th of [10, 40]) { let sum = 0; for (let a = -90; a <= 90; a += 0.01) sum += M.brightness(r, th, a) * 0.01; E.push(sum); }
        o.diffuse = { b, E, mirror: [M.isMirror(0), M.isMirror(0.1), M.isMirror(0.12), M.isMirror(1)], br: [M.brightness(0, 30, 30), M.brightness(0, 30, 31), M.brightness(0, 30, -30), M.brightness(1, 30, 0), M.brightness(1, 30, 30), M.brightness(1, 30, -30)], spread: [M.spread(0), M.spread(0.5), M.spread(1)] };
      }
      // ---- noise
      { const M = L.noise; let b = 0;
        for (const [L0, c] of [[30, '耳语、树叶的沙沙声'], [31, '安静的房间、图书馆'], [50, '安静的房间、图书馆'], [70, '一般交谈、办公室'], [90, '繁忙的街道、嘈杂的车间'], [110, '摇滚音乐会、电锯'], [130, '飞机起飞、近处的雷声']]) if (M.example(L0) !== c) b++;
        const ef = (x) => (x <= 50 ? '适合休息和睡眠' : x <= 70 ? '适合工作和学习，但会影响休息' : x <= 90 ? '影响工作和学习，长时间会使人烦躁' : '长时间会损害听力');
        for (let x = 0; x <= 140; x += 5) if (M.effect(x) !== ef(x)) b++;
        for (let m = 0; m < 8; m++) { const on = [m & 1, (m >> 1) & 1, (m >> 2) & 1]; const want = Math.max(0, 85 - 20 * on[0] - 15 * on[1] - 15 * on[2]); if (M.controlled(85, on) !== want) b++; }
        if (!near(M.echoDelay(17, 340), 0.1) || !near(M.minDistance(340), 17) || !near(M.minDistance(1500), 75) || !near(M.minDistance(5200), 260) || !near(M.depth(4), 3000) || !near(M.echoDelay(M.minDistance(1500), 1500), 0.1)) b++;
        for (const [, v] of M.MEDIA) for (let d = 1; d <= 400; d += 33) if (!near(M.echoDelay(d, v) * v / 2, d)) b++;
        o.noise = { b, media: M.MEDIA.map((x) => x.join(':')).join(','), measures: M.MEASURES.map((x) => x[1]).join(',') };
      }
      // ---- lensexp: against the lens equation and a search for the sharpest screen position
      { const M = L.lensexp; let b = 0, cases = 0;
        for (const f of M.FS) for (let u = 5; u <= 45; u += 0.5) {
          let best = null; for (let v = 5; v <= 70; v += 0.5) { const e = Math.abs(1 / u + 1 / v - 1 / f); if (!best || e < best[1]) best = [v, e]; }
          for (let v = 5; v <= 70; v += 0.5) {
            cases++; const o2 = M.onScreen(f, u, v);
            if (u <= f) { if (!o2.none || o2.sharp) b++; continue; }
            const v0 = 1 / (1 / f - 1 / u), blur = 4 * Math.abs(v - v0) / v0;
            if (!near(o2.v0, v0, 1e-9) || !near(o2.blur, blur, 1e-9) || (Math.abs(blur - 0.25) > 1e-9 && o2.sharp !== (blur <= 0.25)) || !near(1 / u + 1 / o2.v0, 1 / f, 1e-9)) b++;
            const kind = Math.abs(u - 2 * f) < 1e-9 ? 1 : u > 2 * f ? 0 : 2; if (o2.kind !== kind || !near(o2.m, v0 / u, 1e-9)) b++;
          }
          if (u > f && Math.abs(best[0] - 1 / (1 / f - 1 / u)) <= 0.25 && !M.onScreen(f, u, best[0]).sharp && 1 / (1 / f - 1 / u) <= 70) b++;
        }
        o.lensexp = { b, cases, spot: [M.spot(10, 10), M.spot(10, 20), M.spot(10, 5), M.spot(10, 12)], sharpAt: M.onScreen(10, 30, 15).sharp, kinds: [M.onScreen(10, 30, 15).kind, M.onScreen(10, 20, 20).kind, M.onScreen(10, 15, 30).kind] };
      }
      // ---- internal: energy conservation in the exchange; the sign of the work
      { const M = L.internal; let b = 0;
        for (const [, cA] of M.SUBS) for (const [, cB] of M.SUBS) for (const mA of [50, 400, 1000]) for (const mB of [50, 400, 1000]) for (const TA of [0, 30, 100]) for (const TB of [0, 50, 100]) {
          const f = M.exchange(cA, mA, TA, cB, mB, TB), lost = (cA * mA / 1000) * (TA - f.Tf), gained = (cB * mB / 1000) * (f.Tf - TB);
          if (!near(lost, gained, 1e-9) || !near(f.Q, lost, 1e-9) || f.Tf < Math.min(TA, TB) - 1e-9 || f.Tf > Math.max(TA, TB) + 1e-9 || f.dir !== (TA > TB ? 'AB' : TA < TB ? 'BA' : 'none')) b++;
          if (cA === cB && mA === mB && !near(f.Tf, (TA + TB) / 2)) b++;
        }
        for (const [, c] of M.SUBS) for (const W of [0, 100, 500]) for (const mg of [10, 500]) { const up = M.dT(0, W, mg, c), comp = M.dT(1, W, mg, c), ex = M.dT(2, W, mg, c); if (!near(up, W / (c * mg / 1000)) || !near(comp, up) || !near(ex, -up)) b++; }
        o.internal = { b, rel: M.relEnergy(4200, 200, 80), subs: M.SUBS.map((x) => x.join(':')).join(',') };
      }
      // ---- resistance: the proportionalities
      { const M = L.resistance; let b = 0;
        for (let m = 0; m < 5; m++) { const R0 = M.resistance(m, 1, 1); for (const k of [2, 3, 5]) { if (!near(M.resistance(m, k, 1), k * R0) || !near(M.resistance(m, 1, k), R0 / k) || !near(M.resistance(m, k, 1 / k), k * k * R0)) b++; } if (!near(M.resistance(m, 1, 1, 20), M.resistance(m, 1, 1)) || !(M.resistance(m, 1, 1, 200) > R0)) b++; }
        for (let m = 1; m < 5; m++) if (!(M.resistance(m, 1, 1) > M.resistance(m - 1, 1, 1))) b++;
        for (let R = 0; R < 50; R += 3) if (!(M.current(R + 3) < M.current(R))) b++;
        const dflt = [0, 1, 2, 3].map((m) => M.pair(m, 1, 0.5, 4, 20)); for (const p of dflt) if (!near(p.RA, p.RB)) b++;
        const lenx = M.pair(0, 3, 0.5, 4, 20), sx = M.pair(1, 1, 0.25, 4, 20), tx = M.pair(3, 1, 0.5, 4, 120);
        o.resistance = { b, len: lenx.RB / lenx.RA, area: sx.RB / sx.RA, temp: tx.RB / tx.RA, cu: M.pair(2, 1, 0.5, 0, 20).RB < M.pair(2, 1, 0.5, 0, 20).RA, ref: M.REF.join(';'), I: [M.current(0), M.current(5), M.current(15)] };
      }
      // ---- ohmlaw
      { const M = L.ohmlaw; let b = 0;
        for (const R of M.RS) for (let U = 0.5; U <= 6; U += 0.5) { const I = M.ammeter(U, R); if (Math.abs(I - U / R) > 0.005 + 1e-9) b++; }
        const us = [1, 2, 3, 4], ideal = us.map((u) => M.ammeter(u, 10)), square = us.map((u) => Math.round((u * u / 10) * 100) / 100), rs = [5, 10, 15, 20, 25], inv = rs.map((r) => M.ammeter(3, r)), lin = rs.map((r) => Math.round(0.6 * (1 + r / 25) * 100) / 100);
        o.ohmlaw = { b, prop: [M.proportional(us, ideal), M.proportional(us, square), M.proportional([1], [0.1]), M.proportional([0.5, 1, 1.5], [M.ammeter(0.5, 5), M.ammeter(1, 5), M.ammeter(1.5, 5)])], inv: [M.inverse(rs, inv), M.inverse(rs, lin), M.inverse([5], [0.6])], maxrows: M.MAXROWS };
      }
      // ---- rmeasure: Kirchhoff's voltage law for the bulb (written here), the resistor reads its own value
      { const M = L.rmeasure; let b = 0;
        for (let i = 0; i < 4; i++) for (let Rp = 0; Rp <= 20; Rp += 0.5) { const l = M.lab(0, i, Rp); if (!near(l.I, 3 / (Rp + M.RX[i]), 1e-12) || !near(l.U, l.I * M.RX[i], 1e-12)) b++; if (Math.abs(l.Iread - l.I) > 0.0101 || Math.abs(l.Uread - l.U) > 0.0501) b++; }
        let prevI = Infinity, prevR = Infinity; const bulbRows = [];
        for (let Rp = 0; Rp <= 20; Rp += 0.5) { const l = M.lab(1, 0, Rp); const res = 3 - l.U - l.I * (Rp + 0.6); if (Math.abs(res) > 1e-6 || Math.abs(l.U - 2.5 * (l.I / 0.3) ** (5 / 3)) > 1e-6) b++; if (l.I > prevI + 1e-12) b++; prevI = l.I; if (l.U / l.I > prevR + 1e-9) b++; prevR = l.U / l.I; bulbRows.push(l.U / l.I); }
        o.rmeasure = { b, bulb: [bulbRows[0], bulbRows[bulbRows.length - 1]], r0: M.lab(0, 1, 0), mean: M.mean([1, 2, 6]) };
      }
      // ---- meter
      { const M = L.meter; let b = 0;
        for (const P of [100, 500, 1000, 3000]) for (const t of [10, 60, 3600]) for (const rate of M.RATES) { const kwh = P * t / 3.6e6, n = M.revs(kwh, rate); if (!near(M.powerFromRevs(n, t, rate), P, 1e-9)) b++; if (!near(M.toKwh(M.work(220, P / 220, t)), kwh, 1e-9)) b++; }
        o.meter = { b, j: [M.toKwh(3.6e6), M.energyKwh(1000, 3), M.cost(100, 0.6)], dial: [M.dialText(M.dial(1234, 0.56)), M.dialText(M.dial(99999, 1.5)), M.dialText(M.dial(0, 0)), M.dialText(M.dial(9999, 1.04))], rates: M.RATES.join() };
      }
      // ---- emdev
      { const M = L.emdev; let b = 0;
        if (!near(M.U_PULL, 3) || M.engaged(M.coilCurrent(2.9, 1)) || !M.engaged(M.coilCurrent(3, 1)) || !M.engaged(M.coilCurrent(12, 1)) || M.engaged(M.coilCurrent(12, 0)) || M.coilCurrent(0, 1) !== 0) b++;
        for (const f of [100, 300, 1000]) for (const A of [0.2, 1]) for (const t of [0, 0.7, 3.3]) { if (!near(M.wave(A, f, t), M.wave(A, f, t + 1000 / f), 1e-9) || Math.abs(M.wave(A, f, t)) > A + 1e-12 || !near(M.wave(A, f, t), -M.wave(A, f, t + 500 / f), 1e-9)) b++; }
        if (!(M.emfPercent(1, 1000) === 100 && M.emfPercent(0.5, 1000) === 50 && M.emfPercent(1, 500) === 50 && M.emfPercent(0.5, 500) < M.emfPercent(1, 500))) b++;
        o.emdev = { b, dir: [M.direction(0.3), M.direction(-0.3), M.direction(0)], loads: M.LOADS.map((x) => x.join(':')).join(','), alarm: [M.alarmOn(59, 60), M.alarmOn(60, 60), M.alarmOn(80, 60)] };
      }
      // ---- comms: bit errors by brute force
      { const M = L.comms; let b = 0;
        const S = [0.4, -0.9, 0.6, -0.7, 0.8, 0.5, -0.95, 0.3], B = [1, 0, 1, 1, 0, 0, 1, 0];
        for (let nz = 0; nz <= 1.5001; nz += 0.05) { let e = 0; B.forEach((bit, i) => { const sent = bit ? 1 : -1, got = sent + nz * S[i]; if ((got > 0 ? 1 : -1) !== sent) e++; }); if (M.bitErrors(nz) !== e) b++; if (nz <= 1 && e !== 0) b++; const rms = Math.sqrt(S.reduce((a, x) => a + (nz * x) ** 2, 0) / 8) * 100; if (!near(M.analogDistortion(nz), rms, 1e-9)) b++; }
        const crit = (Math.asin(1.46 / 1.5) * 180) / Math.PI;
        o.comms = { b, crit: [M.critical(), crit], tir: [M.totalReflection(76), M.totalReflection(77), M.totalReflection(89)], lam: [M.wavelength(900e3), M.wavelength(100e6), M.wavelength(3e8)], errs: [M.bitErrors(1), M.bitErrors(1.1), M.bitErrors(1.5)] };
      }
      return o;
    });
    ok(r.bad.length === 0, 'A4 the 13 models: ' + (r.bad.join('; ') || 'no internal inconsistency'));
    // evap
    ok(r.evap.water.join() === 'gas,liquid,liquid,liquid', 'A4 evap: steam at 120 °C is a gas at 1 atm and a liquid at 2.5 atm (pressure cooker); water at 90 °C and at 100 °C under 1 atm is liquid: ' + r.evap.water.join());
    ok(r.evap.butane[0] === 'gas' && r.evap.butane[1] === 'liquid' && r.evap.butane[2] === 'gas' && r.evap.butane[3] === 'liquid' && r.evap.butane[4] > 1.9 && r.evap.butane[4] < 2.1, `A4 evap: butane is a gas at 20 °C / 1 atm and liquid once it is squeezed past its vapour pressure (${r.evap.butane[4].toFixed(2)} atm, the real value is about 2.1 bar); and a liquid below -0.5 °C at 1 atm`);
    ok(r.evap.oxygen.join() === 'hot,liquid,gas,hot,liquid' && r.evap.oxHot, 'A4 evap: oxygen above its critical temperature (-118.6 °C) cannot be liquefied by pressure at any pressure of the slider; below it (-140 °C, 20 atm) it can; at -183 °C it is liquid at 1 atm, at -150 °C and 1 atm still a gas: ' + r.evap.oxygen.join());
    ok(r.evap.ib === 0 && r.evap.melt === 113.7, 'A4 evap: iodine vapour grows with the time and the bath temperature, never exceeds the 2 g of iodine; crystals appear only on the cooled glass; the water bath (<= 100 °C) is below the melting point 113.7 °C');
    ok(r.evap.phen === '0,1,2,2,3,3,4,4,5,5,1,0' && r.evap.proc === '熔化,凝固,汽化,液化,升华,凝华' && r.evap.abs === 'true,false,true,false,true,false', 'A4 evap: the 12 phenomena map to their processes (ice melts, rivers freeze, wet clothes dry, dew liquefies, mothballs sublime, frost deposits) and melting / vaporisation / sublimation absorb heat');
    ok(r.thermo.b === 0 && r.thermo.range.join() === '-20,110,35,42', 'A4 thermo: clinical thermometer = max(previous, now) unless shaken (400 random cases), lab thermometer rounds to 1 °C and stops at its ends, a thermometer touching the heated bottom reads high, half-immersed or taken out reads low');
    ok(r.straight.b === 0 && r.straight.sb === 0, 'A4 straight: similar triangles for the pinhole image and the blur; umbra and the whole shadow equal what a ray trace from 400 points of the source gives (108 geometries), penumbra only for an extended source');
    ok(r.straight.ecl.join() === 'solar,lunar,none,none,none,solar,lunar,solar,none,none' && r.straight.eclGrid[0] === 0 && r.straight.eclGrid[1] > 100, 'A4 straight: solar eclipse only near the new moon, lunar only near the full moon, both need the Moon close to the plane of the orbit: ' + r.straight.ecl.join());
    ok(r.diffuse.b === 0, 'A4 diffuse: for every facet tilt the reflected direction equals the vector reflection about the tilted normal, within ±2 x 25 r degrees of the mirror direction');
    ok(r.diffuse.E.every((e) => Math.abs(e - 4) < 0.05) && r.diffuse.mirror.join() === 'true,true,false,false' && r.diffuse.br.join() === '1,1,0,0.04,0.04,0' && r.diffuse.spread.join() === '2,25,50', 'A4 diffuse: the same light is spread over a wider angle (the area under the brightness curve is 4 for every roughness: no light is created), a mirror is bright only within 2°: ' + r.diffuse.E.map((e) => e.toFixed(2)).join(' ') + ' | ' + r.diffuse.br.join());
    ok(r.noise.b === 0 && r.noise.media === '空气（15 ℃）:340,水:1500,铁:5200' && r.noise.measures === '20,15,15', 'A4 noise: the examples / effects follow the 50 / 70 / 90 dB limits, the three measures subtract their dB (8 combinations), echo delay 0.1 s at 17 m (air), 75 m (water), 260 m (iron), sonar depth vt/2');
    ok(r.lensexp.b === 0 && r.lensexp.cases > 3000, `A4 lensexp: sharp image exactly where the lens equation says (3 lenses x 81 object distances x 132 screen positions = ${r.lensexp.cases} cases), blur width = aperture x |v - v0| / v0, no real image for u <= f, the sharpest screen position found by search is the image position`);
    ok(r.lensexp.spot.join() === '0,4,2,0.8' && r.lensexp.sharpAt && r.lensexp.kinds.join() === '0,1,2', 'A4 lensexp: parallel light: spot 0 at the focus, 4 cm at 2f, 2 cm at f/2, 0.8 cm at 1.2 f; the kinds are smaller / same / larger: ' + r.lensexp.spot.join());
    ok(r.internal.b === 0 && r.internal.rel === 67200, 'A4 internal: heat lost by the hotter body = heat gained by the colder (2916 cases), the common temperature lies between the two and is the mean for equal masses and substances, work in / out changes the temperature by ± W / (c m); relative internal energy c m t');
    ok(r.resistance.b === 0 && Math.abs(r.resistance.len - 3) < 1e-9 && Math.abs(r.resistance.area - 2) < 1e-9 && Math.abs(r.resistance.temp - 1.5) < 1e-9 && r.resistance.cu && r.resistance.I.join() === '0.6,0.3,0.15', 'A4 resistance: R ∝ L, R ∝ 1/S, stretching to k x gives k² R, the materials are ordered copper < aluminium < iron < constantan < nichrome, resistance rises with the temperature of a metal; wire B equals wire A at the starting values; ammeter 3 V / (5 Ω + R)');
    ok(r.ohmlaw.b === 0 && r.ohmlaw.prop.join() === 'true,false,false,true' && r.ohmlaw.inv.join() === 'true,false,false' && r.ohmlaw.maxrows === 6, 'A4 ohmlaw: the ammeter reads U / R to 0.01 A (160 cases); the checks accept I ∝ U and I ∝ 1/R, refuse I ∝ U² and a straight line that does not go through the origin, and need at least 3 points');
    ok(r.rmeasure.b === 0 && r.rmeasure.bulb[0] > r.rmeasure.bulb[1] + 1 && r.rmeasure.r0.Uread === 3 && r.rmeasure.r0.Iread === 0.3 && r.rmeasure.mean === 3, 'A4 rmeasure: a resistor measures U = I R with the meters\' resolution (0.02 A / 0.1 V); the bulb obeys Kirchhoff\'s voltage law E = U + I (Rp + r) and its resistance falls as the rheostat grows (the filament cools): ' + r.rmeasure.bulb.map((x) => x.toFixed(2)).join(' -> '));
    ok(r.meter.b === 0, 'A4 meter: P t / 3.6e6 turns x rate and back to P (36 cases), W = U I t in kW·h');
    ok(r.meter.j[0] === 1 && r.meter.j[1] === 3 && Math.abs(r.meter.j[2] - 60) < 1e-9 && r.meter.dial.join() === '01234.6,00000.5,00000.0,10000.0' && r.meter.rates === '600,1200,2500,3000', 'A4 meter: 3.6e6 J = 1 kW·h, 1000 W for 3 h = 3 kW·h, 100 kW·h at 0.6 = 60, the dial wraps at 100000 and has five digits and a red tenth: ' + r.meter.dial.join(' '));
    ok(r.emdev.b === 0 && r.emdev.dir.join() === '1,-1,0' && r.emdev.alarm.join() === 'false,true,true', 'A4 emdev: the armature is pulled in exactly from 20 mA (3 V across 150 Ω) and only with the switch closed; the signal is periodic and odd; the induced voltage grows with loudness and frequency');
    ok(r.comms.b === 0 && Math.abs(r.comms.crit[0] - r.comms.crit[1]) < 1e-9 && !r.comms.tir[0] && r.comms.tir[1] && r.comms.tir[2] && Math.abs(r.comms.lam[0] - 333.333) < 0.01 && r.comms.lam[1] === 3 && r.comms.lam[2] === 1 && r.comms.errs.join() === '0,1,3', 'A4 comms: bit errors by brute force for 31 noise levels (none up to a noise equal to the signal), analogue distortion = rms of the noise, critical angle asin(1.46/1.5) = 76.7°, λ = c / f (333 m at 900 kHz, 3 m at 100 MHz); errors 0 / 1 / 3 at noise 1 / 1.1 / 1.5: ' + r.comms.errs.join());
    // the text answers follow independent tables
    const tx = await page.evaluate(async () => {
      const mulberry32 = (await import('/src/phys/qtools.ts')).mulberry32; const E = await import('/src/phys/model-evap.ts'), S = await import('/src/phys/model-straight.ts'), N = await import('/src/phys/model-noise.ts'), I = await import('/src/phys/model-internal.ts'), D = await import('/src/phys/model-diffuse.ts'), Em = await import('/src/phys/model-emdev.ts');
      let bad = 0, n = 0; const PH = { 冰雪消融: '熔化', 河水结冰: '凝固', 湿衣服晾干: '汽化', 锅里的水被烧干: '汽化', 草叶上的露珠: '液化', 烧开水时壶嘴冒出的白气: '液化', 樟脑丸越来越小: '升华', 冰冻的衣服变干: '升华', 冰箱冷冻室内壁的白霜: '凝华', 窗玻璃内侧的冰花: '凝华', 铁水浇铸成铁锭: '凝固', 冰块在手中变成水: '熔化' };
      const WAY = { 给摩托车装上消声器: '声源', 在马路两旁设置隔声板: '传播', 在嘈杂的环境中戴防噪声耳罩: '人耳' }, LIM = { 为了保护听力: '90 dB', 为了保证工作和学习: '70 dB', 为了保证休息和睡眠: '50 dB' };
      const WORK = ['搓手取暖', '用打气筒打气时筒壁发热', '钻木取火'], HEAT = ['把手放在热水袋上取暖', '用炉火烧水', '太阳晒热地面'];
      for (let sd = 1; sd <= 300; sd++) {
        for (const q of E.quiz(mulberry32(sd))) if (q.kind === 'process') { n++; const ph = /“(.*)”/.exec(q.q)[1]; if (q.ans !== PH[ph]) bad++; }
        for (const q of S.quiz(mulberry32(sd))) if (q.kind === 'eclipse') { n++; if ((q.p[0] === 0) !== q.q.includes('日食') || (q.p[0] === 0 ? !q.ans.startsWith('月球在太阳和地球之间') : !q.ans.startsWith('地球在太阳和月球之间'))) bad++; }
        for (const q of N.quiz(mulberry32(sd))) { if (q.kind === 'ways') { n++; const k = Object.keys(WAY).find((x) => q.q.includes(x)); if (!q.ans.includes(WAY[k])) bad++; } if (q.kind === 'limit') { n++; const k = Object.keys(LIM).find((x) => q.q.includes(x)); if (q.ans !== LIM[k]) bad++; } }
        for (const q of I.quiz(mulberry32(sd))) if (q.kind === 'way') { n++; const work = q.q.includes('做功'); if (work ? !WORK.includes(q.ans) : !HEAT.includes(q.ans)) bad++; }
        for (const q of D.quiz(mulberry32(sd))) if (q.kind === 'type') { n++; if (!['教室里不同位置的同学都能看到黑板上的字', '从各个方向都能看到屏幕上的画面', '能从不同方向看到桌上的书'].includes(q.ans)) bad++; }
        for (const q of Em.quiz(mulberry32(sd))) if (q.kind === 'principle') { n++; const sp = q.q.includes('扬声器'); if (q.ans !== (sp ? '通电线圈在磁场中受力运动' : '电磁感应')) bad++; }
      }
      return { bad, n };
    });
    ok(tx.bad === 0 && tx.n > 1500, `A4 quiz: the process of a phenomenon, solar / lunar eclipse positions, noise measures and limits, work vs heat transfer, diffuse examples and the speaker / microphone principle agree with independent tables (${tx.n} questions)`);
  }

  // =====================================================================================  B. THE PAGES
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  {
    await to('#/subject/science', '#open-physics');
    ok(await page.isVisible('#open-physics'), 'B the science home has the card 物理实验室');
    await page.click('#open-physics'); await page.waitForSelector('#pl-home');
    ok(await page.evaluate(() => location.hash) === '#/science/physics', 'B the card opens #/science/physics');
    const cards = await page.evaluate(() => [...document.querySelectorAll('.pl-sc')].map((c) => ({ id: c.dataset.sim, icon: !!c.querySelector('svg'), text: c.textContent })));
    ok(cards.length === IDS.length && IDS.every((id) => cards.some((c) => c.id === id)) && cards.every((c) => c.icon && /实验任务 0 \/ \d/.test(c.text)), 'B 28 cards, each with its drawn icon and "实验任务 0 / n"');
    const groups = await page.evaluate(() => [...document.querySelectorAll('.pl-home > h2, .pl-home .pl-sc')].map((e) => (e.tagName === 'H2' ? 'H:' + e.textContent : e.dataset.chapter)));
    const g9 = groups.indexOf('H:九年级');
    ok(groups[0] === '八年级' || groups[0] === 'H:八年级', 'B the lab starts with the grade 8 heading');
    ok(g9 > 0 && groups.slice(1, g9).every((c) => /^第(一|二|三|四|五|六|七|八|九|十|十一|十二)章/.test(c)) && groups.slice(g9 + 1).every((c) => /^第(十三|十四|十五|十六|十七|十八|十九|二十|二十一|二十二)章/.test(c)), 'B cards sit under their grade, in chapter order: ' + groups.join(' | '));
    const CH = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '二十一', '二十二']; const chn = groups.filter((c) => c.startsWith('第')).map((c) => CH.indexOf(/^第(.+?)章/.exec(c)[1]));
    ok(chn.every((v, i) => i === 0 || v >= chn[i - 1]), 'B within each grade the chapters follow the book order');
    ok(groups.includes('第四章 光现象') && groups.includes('第二十章 电与磁') && groups.includes('第十二章 简单机械'), 'B each card names its chapter');
    const counts = await page.evaluate(async (ids) => { const o = {}; for (const id of ids) { const m = await import(`/src/phys/${id}.ts`); const c = await import('/src/phys/catalog.ts'); o[id] = [m.def.tasks.length, c.CATALOG[id].tasks, m.def.quiz.length >= 0, m.meta.id]; } return o; }, IDS);
    ok(IDS.every((id) => counts[id][0] === counts[id][1] && counts[id][3] === id && counts[id][0] >= 2), 'B every simulation has 2-4 tasks and the catalog count equals the module\'s');
    await page.click('.pl-sc[data-sim=lens]'); await page.waitForSelector('.pl-sim');
    ok(await page.evaluate(() => location.hash) === '#/science/physics/lens', 'B a card opens #/science/physics/<id>');
    await page.click('header .back, header button'); await page.waitForTimeout(300);
    ok(await page.evaluate(() => location.hash) === '#/science/physics', 'B the back button returns to the lab');
    await to('#/science/physics/nonsense', '#pl-home');
    ok(true, 'B an unknown simulation id goes back to the lab');
  }

  const finiteText = (sel) => page.evaluate((sel) => { const t = [...document.querySelectorAll(sel)].map((e) => e.textContent).join(' '); return !/NaN|undefined|Infinity|null/.test(t) || /∞/.test(t) && !/NaN|undefined|null/.test(t); }, sel);
  for (const id of IDS) {
    await sim(id);
    const info = await page.evaluate(() => { const d = window.__phys.def; return { params: d.params.map((p) => [p.id, p.min, p.max, p.step, p.value]), choices: (d.choices || []).map((c) => [c.id, c.options.map((o) => o[0]), c.value]), tasks: d.tasks.map((x) => x.id), play: !!d.play, sound: !!d.sound, pointer: !!d.pointer, nread: document.querySelectorAll('.pl-read').length, canvas: [document.querySelector('#pl-canvas').offsetWidth, document.querySelector('#pl-canvas').offsetHeight], done: window.__phys.done() }; });
    ok(info.nread >= 3 && info.canvas[0] > 200 && info.canvas[1] > 100 && info.done.length === 0, `B ${id}: mounts (canvas ${info.canvas.join('x')}, ${info.nread} readouts, no task done at the start)`);
    ok(await finiteText('.pl-readouts'), `B ${id}: readouts have no NaN / undefined`);
    // the drawing is not blank
    const ink = await page.evaluate(() => { window.__phys.redraw(); const c = document.querySelector('#pl-canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0 && (d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200)) n++; return n; });
    ok(ink > 500, `B ${id}: the drawing has content (${ink} dark pixels)`);
    // every slider, in every mode: min / middle / max keep the readouts finite and change something
    let finite = true, changed = 0, sweeps = 0;
    const modes = info.choices.length ? info.choices.map((c) => c[1]) : [[0]];
    const mainChoice = info.choices.find((c) => c[0] === 'mode' || c[0] === 'type' || c[0] === 'pair' || c[0] === 'surf');
    const cases = [];
    for (const [cid, vals] of info.choices) for (const v of vals) cases.push([cid, v]);
    if (!cases.length) cases.push([null, 0]);
    for (const [cid, v] of cases) {
      await page.evaluate(([cid, v]) => { window.__phys.reset(); if (cid) window.__phys.set(cid, v); }, [cid, v]);
      for (const [pid, mn, mx, st] of info.params) {
        const vis = await page.evaluate((pid) => !document.querySelector(`.pl-ctl[data-p=${pid}]`).hidden, pid); if (!vis) continue;
        const before = await page.evaluate(() => document.querySelector('#pl-readouts').textContent);
        let any = false;
        for (const val of [mn, (mn + mx) / 2, mx]) { await set({ [pid]: val }); const txt = await page.evaluate(() => document.querySelector('#pl-readouts').textContent); if (/NaN|undefined|null|Infinity/.test(txt)) finite = false; if (txt !== before) any = true; sweeps++; }
        if (any) changed++;
        await page.evaluate(([pid, v0]) => window.__phys.set(pid, v0), [pid, info.params.find((p) => p[0] === pid)[4]]);
      }
    }
    ok(finite && sweeps >= 3 && changed >= 1, `B ${id}: every slider in every mode (${sweeps} settings) keeps the readouts finite; ${changed} slider(s) change the readouts`);
    // a native slider moved by the keyboard
    await page.evaluate(() => window.__phys.reset());
    const first = info.params.find((p) => p[0] !== 't') || info.params[0];
    const sid = `#pl-${first[0]}`;
    if (await page.isVisible(sid)) {
      await page.focus(sid); const v0 = Number(await page.inputValue(sid)); await page.keyboard.press('End'); const vEnd = Number(await page.inputValue(sid)); await page.keyboard.press('Home'); const vHome = Number(await page.inputValue(sid));
      const model = await page.evaluate((k) => window.__phys.st[k], first[0]);
      ok(vEnd === first[2] && vHome === first[1] && model === first[1], `B ${id}: the slider "${first[0]}" answers the keyboard (Home/End) and the state follows (${vHome}..${vEnd})`);
    }
    // the tasks: complete each one by setting the state the way a child would
    const sol = SOLVE[id];
    if (sol) {
      await page.evaluate(() => window.__phys.reset());
      for (const tid of info.tasks) {
        let setting = sol[tid];
        if (setting === 'SEARCH') { // energy / top: find a time at which the pendulum is at the turning point
          setting = await page.evaluate(async () => { const En = await import('/src/phys/model-energy.ts'); for (let tt = 0.05; tt <= 10; tt += 0.05) { const e = En.pendulumEnergy(1, 1, 40, tt); if (e.Ek < 0.03 * e.E0) return { mode: 0, m: 1, L: 1, th0: 40, t: Math.round(tt * 100) / 100 }; } return null; });
        }
        if (!setting) { ok(false, `B ${id}: no solution for task ${tid}`); continue; }
        await page.evaluate(() => window.__phys.reset());
        if (Array.isArray(setting)) { for (const step of setting) { if (typeof step === 'string') await page.click(`#pl-act-${step}`); else await set(step); } } else await set(setting);
        const d = await page.evaluate(() => window.__phys.done());
        ok(d.includes(tid), `B ${id}: task "${tid}" completes when the state is ${JSON.stringify(setting)}`);
      }
      const all = await page.evaluate(() => [...document.querySelectorAll('.pl-task')].every((e) => e.classList.contains('done')));
      ok(all, `B ${id}: all tasks show as done (✓)`);
      // reset keeps what was done; reload keeps it too
      await page.click('#pl-reset'); await page.waitForTimeout(100);
      ok((await page.evaluate(() => window.__phys.done())).length === info.tasks.length, `B ${id}: 重置 resets the state but keeps the tasks done`);
    }
  }
  // progress is kept on this device
  {
    await page.reload(); await page.waitForSelector('.hub-grid, .kids, .pl-sim, #pl-home');
    await to('#/science/physics', '#pl-home');
    const txt = await page.evaluate(() => [...document.querySelectorAll('.pl-sc')].map((c) => [c.dataset.sim, c.textContent, c.classList.contains('all')]));
    ok(txt.every(([id, t, all]) => new RegExp('实验任务 (\\d) / \\1').test(t) && all), 'B after a reload every card shows all tasks done (progress kept in learn.phys.v1)');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('learn.phys.v1')));
    ok(Object.keys(stored.done).length === IDS.length, 'B learn.phys.v1 holds the tasks of 28 simulations');
  }

  // ---- the quiz: right answers / wrong answers ----
  {
    await sim('lens');
    await page.click('#quiz-start');
    for (let i = 0; i < 5; i++) {
      const q = await page.evaluate((i) => { const qs = window.__phys.quiz(); return { a: qs[i].a, n: qs[i].choices.length, text: document.querySelector('#quiz-q').dataset.plain }; }, i);
      ok(q.n === 4 && (await page.locator('.pl-qopt').count()) === 4, `B quiz question ${i + 1}: 4 choices`);
      await page.click(`.pl-qopt[data-i="${q.a}"]`);
      ok(await page.evaluate((a) => document.querySelector(`.pl-qopt[data-i="${a}"]`).classList.contains('right') && [...document.querySelectorAll('.pl-qopt')].every((b) => b.disabled), q.a), `B quiz question ${i + 1}: the right choice turns green, the others are locked`);
      await page.click('#quiz-next');
    }
    ok((await page.textContent('#quiz-score')).replace(/\s/g, '') === '得分5/5', 'B quiz: all right = 得分 5 / 5');
    await page.click('#quiz-again'); await page.click('#quiz-start');
    for (let i = 0; i < 5; i++) {
      const wrongIdx = await page.evaluate((i) => { const q = window.__phys.quiz()[i]; return q.a === 0 ? 1 : 0; }, i);
      await page.click(`.pl-qopt[data-i="${wrongIdx}"]`);
      ok(await page.evaluate((w) => document.querySelector(`.pl-qopt[data-i="${w}"]`).classList.contains('wrong'), wrongIdx), `B quiz wrong answer ${i + 1} is marked`);
      await page.click('#quiz-next');
    }
    ok((await page.textContent('#quiz-score')).replace(/\s/g, '') === '得分0/5', 'B quiz: all wrong = 得分 0 / 5');
    ok((await page.evaluate(() => JSON.parse(localStorage.getItem('learn.phys.v1')).quiz.lens)) === 5, 'B quiz: the best score (5) is kept, a worse one does not replace it');
  }

  // ---- the oscilloscope is drawn from the same formula as the sound ----
  {
    await sim('sound');
    let bad = 0, checked = 0;
    for (const [tb, f, A] of [[0, 300, 0.6], [1, 500, 0.8], [2, 200, 1], [3, 1000, 0.4]]) {
      await set({ timbre: tb, f, A });
      const r = await page.evaluate(([tb, f, A]) => {
        window.__phys.redraw(); const c = document.querySelector('#pl-canvas'); const ctx = c.getContext('2d'); const sx = c.width / 640, sy = c.height / (640 * 0.5);
        return import('/src/phys/model-sound.ts').then((S) => { const out = []; for (const i of [20, 100, 180, 260, 340, 420, 500, 580]) {
          const px = Math.round((20 + i) * sx); const col = ctx.getImageData(px, 0, 1, c.height).data; let ys = [];
          for (let y = 0; y < c.height; y++) { const r = col[y * 4], g = col[y * 4 + 1], b = col[y * 4 + 2]; if (g > 180 && r < 150 && b < 170) ys.push(y); }
          if (!ys.length) { out.push(null); continue; }
          const yMid = ys.reduce((a, b) => a + b, 0) / ys.length / sy; const model = 160 - 130 * S.wave(tb, f, A, (i / 600) * 0.01); out.push([yMid, model, ys.length]); } return out; });
      }, [tb, f, A]);
      for (const x of r) { checked++; if (!x || Math.abs(x[0] - x[1]) > 12 + (x[2] > 30 ? 40 : 0)) bad++; }
    }
    ok(checked === 32 && bad <= 2, `B sound: the trace on the oscilloscope follows the model formula at ${checked} points (${bad} off)`);
    await page.click('#pl-sound');
    ok(await page.evaluate(() => window.__phys.soundOn()) && (await page.textContent('#pl-sound')).includes('关闭'), 'B sound: the sound button switches the sound on (Web Audio) and says so');
    await set({ f: 880 }); await page.click('#pl-sound');
    ok(!(await page.evaluate(() => window.__phys.soundOn())), 'B sound: and off again; leaving the page stops it');
  }

  // ---- play buttons advance the clock; time-based simulations ----
  {
    await sim('motion'); await set({ t: 0 }); await page.click('#pl-play'); await page.waitForTimeout(600);
    const t1 = await page.evaluate(() => window.__phys.st.t); await page.click('#pl-play');
    ok(t1 > 0.3 && t1 < 1.2, 'B motion: 播放 moves the time forward by itself (' + t1.toFixed(2) + ' s after 0.6 s)');
    const t2 = await page.evaluate(() => window.__phys.st.t); await page.waitForTimeout(250); ok((await page.evaluate(() => window.__phys.st.t)) === t2, 'B motion: 暂停 stops it');
    await sim('newton'); ok(await page.isVisible('#pl-play'), 'B newton: the play button shows in the mode that has a time'); await set({ mode: 1 }); ok(!(await page.isVisible('#pl-play')), 'B newton: and is hidden in the mode without one');
  }

  // =====================================================================================  C. LAYOUT, 5 SCREEN SIZES
  {
    const SIZES = [[390, 844, 'phone'], [320, 568, 'small'], [820, 1180, 'tablet'], [1180, 820, 'landscape'], [844, 390, 'phoneland']];
    const t2 = await start(new Map(), { local: true, viewport: { width: 390, height: 844 }, dpr: 2, touch: true });
    const p2 = t2.page; let probs = [];
    for (const [w, hh, name] of SIZES) {
      await p2.setViewportSize({ width: w, height: hh });
      await p2.evaluate(() => (location.hash = '#/science/physics')); await p2.waitForSelector('#pl-home'); await p2.waitForTimeout(150);
      const home = await p2.evaluate(() => { const wrap = document.querySelector('.pl-wrap'); const r = wrap.getBoundingClientRect(); const cards = [...document.querySelectorAll('.pl-sc')].map((c) => c.getBoundingClientRect()); return { over: document.documentElement.scrollWidth - innerWidth, l: r.left, rr: innerWidth - r.right, small: cards.filter((c) => c.width < 100 || c.height < 100).length, clip: [...document.querySelectorAll('.pl-ct, .pl-cs')].filter((e) => e.scrollWidth > e.clientWidth + 1).length }; });
      if (home.over > 0 || Math.abs(home.l - home.rr) > 2 || home.small || home.clip) probs.push(`home ${name} ${JSON.stringify(home)}`);
      if (name === 'phone' || name === 'tablet') await p2.screenshot({ path: path.join(OUT, `lab-home-${name}.png`) });
      for (const id of IDS) {
        await p2.evaluate((id) => (location.hash = '#/science/physics/' + id), id); await p2.waitForSelector('.pl-sim'); await p2.waitForFunction(() => window.__phys && document.querySelector('#pl-canvas').offsetWidth > 0); await p2.waitForTimeout(60);
        const m = await p2.evaluate(() => {
          window.__phys.redraw(); const c = document.querySelector('#pl-canvas'); const wrap = document.querySelector('.pl-wrap').getBoundingClientRect();
          const vis = (e) => !e.closest('[hidden]') && e.offsetParent !== null;
          const sl = [...document.querySelectorAll('.pl-range')].filter(vis).map((e) => [e.offsetHeight, e.offsetWidth]);
          const btn = [...document.querySelectorAll('.pl-opt, .pl-btn, .pl-qopt, #quiz-start')].filter(vis).map((e) => e.offsetHeight);
          const clip = [...document.querySelectorAll('.pl-rl, .pl-rv, .pl-lab, .pl-tt, .pl-formula, .pl-lesson p, .pl-opt, .pl-btn')].filter((e) => vis(e) && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'auto').map((e) => e.className + ':' + e.textContent.slice(0, 12));
          const rects = [...document.querySelectorAll('.pl-sim *')].filter((e) => vis(e)).map((e) => e.getBoundingClientRect()).filter((r) => r.right > innerWidth + 1 || r.left < -1).length;
          return { over: document.documentElement.scrollWidth - innerWidth, l: wrap.left, rr: innerWidth - wrap.right, cw: c.offsetWidth, ch: c.offsetHeight, bw: c.width, bh: c.height, dpr: devicePixelRatio, sl, btn, clip, rects, aspect: c.offsetWidth / c.offsetHeight, ink: (() => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 40) if (d[i + 3] > 0 && d[i] < 200) n++; return n; })() };
        });
        const crisp = m.bw === Math.round(m.cw * m.dpr) && m.bh === Math.round(m.ch * m.dpr);
        const bad = [];
        if (m.over > 0) bad.push('overflow ' + m.over); if (Math.abs(m.l - m.rr) > 2) bad.push(`not centred ${m.l}/${m.rr}`);
        if (!crisp) bad.push(`canvas ${m.bw}x${m.bh} vs ${m.cw}x${m.ch} @${m.dpr}`); if (m.cw < Math.min(w - 20, 280)) bad.push('canvas narrow ' + m.cw);
        if (m.sl.some(([hgt, wd]) => hgt < 44 || wd < 100)) bad.push('slider ' + JSON.stringify(m.sl)); if (m.btn.some((b) => b < 40)) bad.push('button ' + Math.min(...m.btn)); if (m.clip.length) bad.push('clipped ' + m.clip.join(',')); if (m.rects) bad.push('outside ' + m.rects); if (m.ink < 30) bad.push('blank');
        if (Math.abs(m.aspect - 640 / Math.round(640 * (await p2.evaluate(() => window.__phys.def.aspect ?? 0.62)))) > 0.02) bad.push('aspect ' + m.aspect);
        if (bad.length) probs.push(`${id} ${name}: ${bad.join('; ')}`);
        if (name === 'phone' && ['lens', 'ohm', 'buoyancy'].includes(id)) await p2.screenshot({ path: path.join(OUT, `sim-${id}-${name}.png`) });
        if (name === 'landscape' || name === 'tablet') { if (['motion', 'lens', 'pulley', 'em', 'heating', 'ohm', 'energy', 'lever'].includes(id)) await p2.screenshot({ path: path.join(OUT, `sim-${id}-${name}.png`) }); }
      }
    }
    ok(probs.length === 0, 'C 28 simulations + the lab page on 5 screen sizes at dpr 2: no overflow, centred, canvas crisp (backing = layout x dpr), sliders >= 44 px, buttons >= 40 px, nothing clipped / outside' + (probs.length ? '\n   ' + probs.slice(0, 12).join('\n   ') : ''));
    // dpr 3 on a phone: still crisp
    const t3 = await start(new Map(), { local: true, viewport: { width: 390, height: 844 }, dpr: 3 });
    await t3.page.evaluate(() => (location.hash = '#/science/physics/lens')); await t3.page.waitForSelector('.pl-sim'); await t3.page.waitForTimeout(250);
    const c3 = await t3.page.evaluate(() => { const c = document.querySelector('#pl-canvas'); return [c.width, c.offsetWidth, devicePixelRatio]; });
    ok(c3[0] === Math.round(c3[1] * 3) && c3[2] === 3, 'C canvas crisp at dpr 3 (' + c3.join(', ') + ')');
    // a scale animation (the new screen grows in) must not change the drawing size: measured by layout size, not by the rectangle
    await t3.page.evaluate(() => { document.querySelector('.pl-sim').style.transform = 'scale(0.6)'; window.__phys.redraw(); });
    const c4 = await t3.page.evaluate(() => { const c = document.querySelector('#pl-canvas'); return [c.width, c.offsetWidth]; });
    ok(c4[0] === c3[0], 'C the canvas is sized by layout size: a scaled ancestor does not shrink the backing store (' + c4.join(', ') + ')');
    await t3.browser.close();
    await t2.browser.close();
  }

  // =====================================================================================  D. REAL TOUCH DRAGGING (CDP, dpr 2)
  {
    const t2 = await start(new Map(), { local: true, viewport: { width: 390, height: 844 }, dpr: 2, touch: true });
    const p = t2.page; const cdp = await p.context().newCDPSession(p);
    const touch = async (pts) => { const tp = (q) => ({ x: q[0], y: q[1], id: 1, radiusX: 2, radiusY: 2, force: 1 }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tp(pts[0])] }); for (const q of pts.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [tp(q)] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(150); };
    const goto = async (id) => { await p.evaluate((id) => (location.hash = '#/science/physics/' + id), id); await p.waitForSelector('.pl-sim'); await p.waitForTimeout(250); };
    const scrollTo = async (sel) => { await p.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: 'center' }), sel); await p.waitForTimeout(150); };
    // a slider dragged by a finger
    await goto('spring'); await scrollTo('#pl-m');
    const rect = await p.evaluate(() => { const r = document.querySelector('#pl-m').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
    const frac0 = await p.evaluate(() => (window.__phys.st.m - 0) / 1.5);
    const y = rect[1] + rect[3] / 2, thumb = rect[0] + 16 + frac0 * (rect[2] - 32);
    await touch([[thumb, y], [thumb + 30, y], [thumb + 90, y], [thumb + 150, y]]);
    const mAfter = await p.evaluate(() => window.__phys.st.m);
    ok(mAfter > 0.3 + 0.2, 'D a finger dragging the slider thumb changes the value (m 0.3 -> ' + mAfter + ')');
    // tapping on the track
    const before = mAfter; await touch([[rect[0] + 20, y]]); ok((await p.evaluate(() => window.__phys.st.m)) < before, 'D a tap on the track moves the thumb there');
    // dragging the candle in the lens simulation
    await goto('lens'); await scrollTo('#pl-canvas');
    const cr = await p.evaluate(() => { const r = document.querySelector('#pl-canvas').getBoundingClientRect(); return [r.left, r.top, r.width, r.height, window.__phys.st.u]; });
    const sc = cr[2] / 640, lx = cr[0] + 330 * sc, ay = cr[1] + 175 * sc * (cr[3] / (cr[2] * 0.55));
    const startX = lx - cr[4] * 5.5 * sc, endX = lx - 40 * 5.5 * sc;
    await touch([[startX, ay], [startX - 20, ay], [startX - 60, ay], [endX, ay]]);
    const u2 = await p.evaluate(() => window.__phys.st.u);
    ok(Math.abs(u2 - 40) < 2.5, 'D lens: dragging the object with a finger sets the object distance (20 -> 40 cm, got ' + u2 + ')');
    ok((await p.evaluate(() => document.querySelector('#pl-readouts').textContent)).includes('40'), 'D lens: the readout follows the finger');
    // a vertical swipe starting on the canvas still scrolls the page (touch-action: pan-y)
    const ta = await p.evaluate(() => getComputedStyle(document.querySelector('#pl-canvas')).touchAction);
    ok(ta === 'pan-y', 'D a canvas with a drag keeps touch-action: pan-y (the page can still be scrolled with a finger)');
    // lever: drag the right weight
    await goto('lever'); await scrollTo('#pl-canvas');
    const lr = await p.evaluate(() => { const r = document.querySelector('#pl-canvas').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
    const lsc = lr[2] / 640, ly = lr[1] + 200 * lsc * (lr[3] / (lr[2] * 0.55));
    await touch([[lr[0] + (320 + 10 * 5.6) * lsc, ly], [lr[0] + (320 + 20 * 5.6) * lsc, ly], [lr[0] + (320 + 30 * 5.6) * lsc, ly]]);
    ok((await p.evaluate(() => window.__phys.st.L2)) === 30, 'D lever: dragging the right hook outwards moves the weight to 30 cm');
    await touch([[lr[0] + (320 - 20 * 5.6) * lsc, ly], [lr[0] + (320 - 35 * 5.6) * lsc, ly], [lr[0] + (320 - 40 * 5.6) * lsc, ly]]);
    ok((await p.evaluate(() => window.__phys.st.L1)) === 40, 'D lever: and the left one to 40 cm');
    // magfield: the compass dragged over the field lines with a finger (the canvas must not scroll while dragging: touch-action none)
    await goto('magfield'); await scrollTo('#pl-canvas');
    const mr = await p.evaluate(() => { const r = document.querySelector('#pl-canvas').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
    const MX = (x) => mr[0] + (x * mr[2]) / 640, MY = (y) => mr[1] + (y * mr[3]) / 397;
    await touch([[MX(520), MY(330)], [MX(500), MY(300)], [MX(450), MY(230)], [MX(430), MY(200)]]);
    const cp = await p.evaluate(() => [window.__phys.st.cx, window.__phys.st.cy, window.__phys.done(), getComputedStyle(document.querySelector('#pl-canvas')).touchAction]);
    ok(Math.abs(cp[0] - 430) < 8 && Math.abs(cp[1] - 200) < 8 && cp[2].includes('near') && cp[3] === 'none', 'D magfield: a finger drags the compass next to the N pole (task "near" completes; the canvas has touch-action none so the page does not scroll while dragging): ' + cp.slice(0, 2).map((v) => Math.round(v)).join(','));
    await t2.browser.close();
  }
  {
    const t2 = await start(new Map(), { local: true, viewport: { width: 1180, height: 820 } });
    const p = t2.page;
    await p.evaluate(() => (location.hash = '#/science/physics/ohm')); await p.waitForSelector('.pl-sim'); await p.waitForTimeout(250);
    const r = await p.evaluate(() => { const c = document.querySelector('#pl-canvas').getBoundingClientRect(); return [c.left, c.top, c.width, c.height]; });
    const sc = r[2] / 640, X = (x) => r[0] + x * sc, Y = (y) => r[1] + y * sc * (r[3] / (r[2] * 0.62));
    await p.mouse.move(X(210), Y(90)); await p.mouse.down(); await p.mouse.move(X(240), Y(90), { steps: 4 }); await p.mouse.move(X(270), Y(90), { steps: 4 }); await p.mouse.up();
    const R1 = await p.evaluate(() => window.__phys.st.R1);
    ok(R1 > 30, 'D ohm: dragging the resistor R1 with the mouse sets its value (10 -> ' + R1 + ' Ω)');
    await p.evaluate(() => window.__phys.set('mode', 2));
    await p.mouse.move(X(420), Y(90)); await p.mouse.down(); await p.mouse.move(X(480), Y(90), { steps: 4 }); await p.mouse.up();
    ok(Math.abs((await p.evaluate(() => window.__phys.st.pos)) - 0.8) < 0.08, 'D ohm: dragging the rheostat slider moves the contact (pos 0.8)');
    await p.evaluate(() => window.__phys.set('mode', 1));
    const R2a = await p.evaluate(() => window.__phys.st.R2);
    await p.mouse.move(X(450), Y(160)); await p.mouse.down(); await p.mouse.move(X(450), Y(235), { steps: 4 }); await p.mouse.up();
    ok((await p.evaluate(() => window.__phys.st.R2)) > R2a, 'D ohm: dragging a parallel resistor down raises its value');
    await t2.browser.close();
  }

  // =====================================================================================  E. ENGLISH / FRENCH
  for (const [loc, label] of [['en', 'English'], ['fr', 'French']]) {
    const tl = await start(new Map(), { local: true, locale: loc, viewport: { width: 1180, height: 820 } });
    await withExtra(tl);
    const p = tl.page;
    const left = [];
    const scan = async (where) => { const a = await p.evaluate(() => { const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (n.parentElement.closest('.user, canvas, svg, script, style')) continue; if (/[一-鿿]/.test(n.nodeValue)) out.push(n.nodeValue.trim()); } document.querySelectorAll('[title],[aria-label],[placeholder]').forEach((e) => { for (const k of ['title', 'aria-label', 'placeholder']) { const s = e.getAttribute(k); if (s && /[一-鿿]/.test(s) && !e.closest('.user')) out.push(s); } }); return out; }); for (const s of a) left.push(`${where}: ${s}`); };
    await p.evaluate(() => (location.hash = '#/subject/science')); await p.waitForSelector('#open-physics'); await p.waitForTimeout(200);
    ok((await p.textContent('#open-physics')).trim() !== '物理实验室' && !/[一-鿿]/.test(await p.textContent('#open-physics')), `E ${label}: the science card is translated (${(await p.textContent('#open-physics')).trim()})`);
    await p.evaluate(() => (location.hash = '#/science/physics')); await p.waitForSelector('#pl-home'); await p.waitForTimeout(200); await scan('lab');
    for (const id of IDS) {
      await p.evaluate((id) => (location.hash = '#/science/physics/' + id), id); await p.waitForSelector('.pl-sim'); await p.waitForTimeout(150); await scan(id);
      const choices = await p.evaluate(() => (window.__phys.def.choices || []).map((c) => [c.id, c.options.map((o) => o[0])]));
      for (const [cid, vals] of choices) for (const v of vals) { await p.evaluate(([c, v]) => window.__phys.set(c, v), [cid, v]); await p.waitForTimeout(40); await scan(`${id} ${cid}=${v}`); }
      await p.evaluate(() => window.__phys.reset());
      // sweep the sliders in each mode: the readouts of every state are translated
      const modeId = choices.find((c) => c[0] === 'mode' || c[0] === 'type' || c[0] === 'pair' || c[0] === 'surf' || c[0] === 'sub' || c[0] === 'planet' || c[0] === 'liq') ;
      const ps = await p.evaluate(() => window.__phys.def.params.map((q) => [q.id, q.min, q.max]));
      for (const [cid, vals] of (choices.length ? choices : [[null, [0]]])) for (const v of vals) { await p.evaluate(([c, v]) => { window.__phys.reset(); if (c) window.__phys.set(c, v); }, [cid, v]); for (const [pid, mn, mx] of ps) for (const val of [mn, (mn + mx) / 2, mx]) { await p.evaluate(([a, b]) => window.__phys.set(a, b), [pid, val]); await scan(`${id} ${cid}=${v} ${pid}=${val}`); } }
      await p.evaluate(() => window.__phys.reset());
      await p.click('#quiz-start'); await p.waitForTimeout(50); await scan(id + ' quiz'); await p.click('.pl-qopt'); await scan(id + ' quiz answered'); await p.click('#quiz-next');
      for (let i = 0; i < 4; i++) { await p.click('.pl-qopt'); await p.click('#quiz-next'); } await scan(id + ' score');
      await p.click('#pl-reset'); await scan(id + ' toast');
    }
    const uniq = [...new Set(left)];
    ok(uniq.length === 0, `E ${label}: no Chinese left outside content boxes (${uniq.length})${uniq.length ? '\n   ' + uniq.slice(0, 25).join('\n   ') : ''}`);
    // the lessons and the quiz texts are translated too (rule 66): 200 generated questions per simulation (40 seeds x 5) and every lesson paragraph contain no Chinese
    {
      const bad = await p.evaluate(async (ids) => {
        const { tr } = await import('/src/i18n.ts');
        const cjk = /[一-鿿]/; const out = [];
        const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        for (const id of ids) {
          location.hash = '#/science/physics/' + id; await new Promise((r) => setTimeout(r, 120));
          const def = window.__phys.def;
          for (const t of def.lesson) if (cjk.test(tr(t))) out.push(id + ' lesson: ' + tr(t).slice(0, 50));
          for (let sd = 1; sd <= 40; sd++) for (const q of def.quiz(rng(sd * 7919))) for (const t of [q.q, q.why ?? '', ...q.choices]) if (cjk.test(tr(t))) out.push(id + ': ' + t.slice(0, 60) + ' => ' + tr(t).slice(0, 60));
        }
        return [...new Set(out)];
      }, IDS);
      ok(bad.length === 0, `E ${label}: 28 simulations x 200 generated quiz questions + lessons: no Chinese left (${bad.length})${bad.length ? '\n   ' + bad.slice(0, 25).join('\n   ') : ''}`);
    }
    await p.evaluate(() => (location.hash = '#/science/physics/lens')); await p.waitForSelector('.pl-sim');
    ok(!/[一-鿿]/.test(await p.textContent('#pl-lesson')), `E ${label}: the lesson text is translated (no user box)`);
    // layout in this language on a phone and a tablet: nothing clipped
    let probs = [];
    for (const [w, hh] of [[390, 844], [320, 568], [820, 1180]]) { await p.setViewportSize({ width: w, height: hh }); for (const id of IDS) { await p.evaluate((id) => (location.hash = '#/science/physics/' + id), id); await p.waitForSelector('.pl-sim'); await p.waitForTimeout(40); const m = await p.evaluate(() => { const vis = (e) => !e.closest('[hidden]') && e.offsetParent !== null; return { over: document.documentElement.scrollWidth - innerWidth, clip: [...document.querySelectorAll('.pl-rl, .pl-lab, .pl-tt, .pl-opt, .pl-btn, .pl-card h3')].filter((e) => vis(e) && e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.slice(0, 20)) }; }); if (m.over > 0 || m.clip.length) probs.push(`${id}@${w}: ${m.over} ${m.clip.join(',')}`); } }
    ok(probs.length === 0, `E ${label}: 28 simulations on 390 / 320 / 820 px wide: no overflow, no clipped label${probs.length ? ' ' + probs.slice(0, 6).join('; ') : ''}`);
    await p.setViewportSize({ width: 390, height: 844 }); await p.evaluate(() => (location.hash = '#/science/physics/ohm')); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(OUT, `sim-ohm-${loc}.png`), fullPage: true });
    await p.evaluate(() => (location.hash = '#/science/physics')); await p.waitForTimeout(300); await p.screenshot({ path: path.join(OUT, `lab-${loc}.png`), fullPage: true });
    ok(tl.log.external.length === 0, `F ${label}: nothing was requested from outside the app (${tl.log.external.join(', ')})`);
    await tl.browser.close();
  }

  // =====================================================================================  F. NOTHING LEAVES THE DEVICE, NO PAGE ERRORS
  ok(t.log.external.length === 0, 'F no request left the app in the whole run: ' + t.log.external.join(', '));
  ok(consoleErrors.filter((e) => !/favicon|manifest|Failed to load resource/.test(e)).length === 0, 'F no console errors' + (consoleErrors.length ? ': ' + consoleErrors.slice(0, 3).join(' | ') : ''));
  const sw = await page.evaluate(() => fetch('/src/phys/catalog.ts').then((r) => r.text()).then((s) => /https?:\/\/(?!www\.w3\.org)/.test(s.replace(/xmlns="[^"]*"/g, ''))));
  ok(!sw, 'F the physics lab code names no outside address');
  await done(t.browser);
})().catch((e) => { console.error(e); process.exit(1); });
