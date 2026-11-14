// 地理实验室 (#/science/geo, under 科学): primary-school and junior-high geography as interactive modules + a mixed practice page.
// Part A: the content (data/geolab.json: banks, facts, climate stations, lessons) and the pure model against INDEPENDENT recomputations written here (time zones by Date arithmetic, climate by a
// second decision table, terrain by definitions, scale, contours by marching-squares invariants, Beaufort / rain tables, quake waves, water balance, solar time, ...); every question generator is run on
// 300 seeds: four different choices, the right one among them and equal to the recomputed answer; the fact questions are checked against the data (right value, no wrong choice with the same value).
// Part B: the pages (21 cards, every module mounts, readouts finite, no task done by default, every task completed by driving the state, quiz right / wrong, progress kept after a reload).
// Part C: real interaction (mouse and CDP touch at dpr 2: pin, hill, sun line, ruler, threshold, step marker, tapping a province). Part D: layout on 5 screen sizes (canvas crisp, no overflow, sliders >= 44 px, centred).
// Part E: the practice page and its memory boxes. Part F: English / French (no Chinese left outside content boxes). Part G: nothing is fetched or requested from outside.
// Not tested: real fingers, real devices, and above all the CONTENT (a teacher must proofread every lesson, fact, number and the climate stations).
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const path = require('path');
const OUT = process.env.D || 'tests/out/geolab/';
fs.mkdirSync(OUT, { recursive: true });

const IDS = ['seasons', 'terrain', 'watercycle', 'weather', 'plates', 'chinabasic', 'globe', 'timezone', 'scale', 'contour', 'continents', 'rocks', 'climate', 'population', 'development', 'regions', 'chinaterrain', 'chinanature', 'chinaecon', 'sustain', 'chinaregions'];
const extra = JSON.parse(fs.readFileSync(path.join(__dirname, '../../src/i18n-extra/geolab.json'), 'utf8'));
const withExtra = async (t) => {
  const add = 'Object.assign(EN, ' + JSON.stringify(Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, v[0]]))) + ');\nObject.assign(FR, ' + JSON.stringify(Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, v[1]]))) + ');\n';
  await t.ctx.route('**/src/i18n-data.ts*', async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()) + '\n' + add }); });
  await t.page.reload(); await t.page.waitForSelector('.hub-grid, .kids, .empty-home');
};
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const numOf = (s) => parseFloat(String(s).replace('−', '-'));
const decimals = (s) => { const m = /^[−-]?\d+\.(\d+)/.exec(String(s).trim()); return m ? m[1].length : 0; };

// ---- independent expectations (numbers: a function of p; text: a function of p), written from the definitions ----
const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;
const ZH = { rainforest: '热带雨林气候', 'monsoon-tropical': '热带季风气候', savanna: '热带草原气候', desert: '热带沙漠气候', subtropical: '亚热带季风气候', 'monsoon-temperate': '温带季风气候', continental: '温带大陆性气候', oceanic: '温带海洋性气候', med: '地中海气候', polar: '极地气候', highland: '高原山地气候' };
function climI(c) {
  if (c.tmax < 10) return 'polar'; if (c.alt >= 3000) return 'highland';
  if (c.tmin >= 18) { if (c.ptot < 500) return 'desert'; if (c.pmin >= 60) return 'rainforest'; return c.ptot >= 1900 ? 'monsoon-tropical' : 'savanna'; }
  if (c.ptot < 250 && c.tmin >= 10) return 'desert';
  if (c.tmin >= 0) { if (c.share < 40 && c.ptot < 1000) return 'med'; return c.tmax < 22 ? 'oceanic' : 'subtropical'; }
  return c.ptot < 400 ? 'continental' : 'monsoon-temperate';
}
const zoneI = (lat) => (Math.abs(lat) < 23.5 ? '热带' : Math.abs(lat) < 66.5 ? (lat > 0 ? '北温带' : '南温带') : lat > 0 ? '北寒带' : '南寒带');
const BF = [[0, 0.2], [0.3, 1.5], [1.6, 3.3], [3.4, 5.4], [5.5, 7.9], [8, 10.7], [10.8, 13.8], [13.9, 17.1], [17.2, 20.7], [20.8, 24.4], [24.5, 28.4], [28.5, 32.6], [32.7, 36.9]];
const WIND = ['北风', '东北风', '东风', '东南风', '南风', '西南风', '西风', '西北风'];
const rainI = (mm) => (mm < 10 ? '小雨' : mm < 25 ? '中雨' : mm < 50 ? '大雨' : mm < 100 ? '暴雨' : mm < 250 ? '大暴雨' : '特大暴雨');
const layerI = (d) => (d < 33 ? '地壳' : d < 2900 ? '地幔' : d < 5100 ? '外核' : '内核');
const cnum = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
const zname = (z) => (z === 0 ? '中时区' : z > 0 ? `东${cnum[z]}区` : `西${cnum[-z]}区`);
const compass = (a, b) => { const ns = b[0] > a[0] ? '北' : '南', ew = b[1] > a[1] ? '东' : '西'; return ns + ew === '北东' ? '东北' : ns + ew === '北西' ? '西北' : ns + ew === '南东' ? '东南' : '西南'; };
const terrI = (alt, rel, f) => { if (f === 3) return '盆地'; if (f === 0) return alt >= 500 ? '高原' : '平原'; if (f === 1) return alt >= 500 ? '高原' : '丘陵'; return alt >= 500 || rel >= 200 ? '山地' : '丘陵'; };
const clk = (m) => { m = ((m % 1440) + 1440) % 1440; return `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')}`; };
const stepI = (lon) => (lon < 102.5 ? '第一级阶梯' : lon < 111 ? '第二级阶梯' : '第三级阶梯');
// numeric kinds: { 'module:kind': p => value }
const NUM = {
  'globe:dlat': ([a, b]) => (b - a) * 111, 'globe:parallel': ([lat]) => Math.round(Math.cos(rad(lat)) * 100) / 100,
  'timezone:diff': ([a, b]) => a + b,
  'seasons:noon': ([lat, dec]) => 90 - Math.abs(lat - dec), 'seasons:fromNoon': ([h]) => 90 - h,
  'scale:real': ([cm, den]) => (cm * den) / 1e5, 'scale:map': ([km, den]) => (km * 1e5) / den,
  'contour:rel': ([t, b]) => t - b, 'contour:slope': ([den, cm, dh]) => (dh / ((cm * den) / 100)) * 100,
  'climate:range': ([a, b]) => a - b, 'weather:range': ([a, b]) => a - b, 'weather:drange': ([a, b]) => a - b,
  'population:rate': ([b, d]) => (b - d) / 10, 'population:after': ([p0, r, y]) => p0 * (1 + r / 100) ** y, 'population:density': ([a, p]) => p / a,
  'plates:move': ([v, t]) => v * t * 10, 'plates:gap': ([d]) => d / 3.5 - d / 6, 'plates:dist': ([dt]) => dt * 8.4,
  'watercycle:balance': ([p, e]) => p - e, 'rocks:heat': ([z]) => 15 + 30 * z,
  'sustain:percap': ([t, p]) => t / p, 'sustain:forest': ([a, f]) => (f / a) * 100, 'sustain:co2': ([c, o, g, k]) => c * 0.95 + o * 0.75 + g * 0.55 + k * 0.02,
  'chinabasic:span': ([a, b]) => (b - a) / 15,
};
const TXT = {
  'globe:zone': ([lat]) => zoneI(lat), 'globe:hemi': ([lat, lon]) => `${lat >= 0 ? '北半球' : '南半球'}、${lon > -20 && lon < 160 ? '东半球' : '西半球'}`,
  'globe:dir': ([a, b, c, d]) => compass([a, b], [c, d]),
  'timezone:convert': ([z1, z2, day, hr]) => { const d = new Date(Date.UTC(2021, 0, day, hr) + (z2 - z1) * 3600e3); return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日 ${d.getUTCHours()}:00`; },
  'timezone:zoneOf': ([lon]) => zname(Math.abs(Math.round(lon / 15)) === 12 ? 12 : Math.round(lon / 15)),
  'seasons:zone': ([i]) => ['北回归线（23.5°N）', '南回归线（23.5°S）', '赤道（0°）', '赤道（0°）'][i],
  'scale:den': ([km]) => `1∶${km * 100000}`,
  'terrain:type': ([a, r, f]) => terrI(a, r, f),
  'climate:type': ([tmin, tmax, ptot, pmin, share, alt]) => ZH[climI({ tmin, tmax, ptot, pmin, share, alt })],
  'weather:beaufort': ([n]) => `${BF[n][0].toFixed(1)}～${BF[n][1].toFixed(1)} 米∕秒`, 'weather:rain': ([mm]) => rainI(mm), 'weather:wind': ([i]) => WIND[i],
  'population:pyramid': ([b, d]) => { const r = (b - d) / 10; return r >= 1 ? '增长型' : r >= -0.1 && r < 0.5 ? '稳定型' : r < -0.1 ? '衰退型' : '过渡型'; },
  'plates:energy': ([dm]) => `${Math.round(10 ** (1.5 * dm))} 倍`,
  'rocks:layer': ([d]) => layerI(d),
  'chinabasic:solar': ([lon, h]) => clk(h * 60 + (lon - 120) * 4), 'chinaterrain:step': ([lon]) => stepI(lon),
};
const TEMPQ = ([t0, dh]) => t0 - (0.6 * dh) / 100;

// ---- how to complete every task by driving the state (independent of the task code: it states the geography) ----
let IDX = {};   // filled from the data: names -> indexes
const SOLVE = () => ({
  seasons: { summer: [['day', 172]], south: [['lat', -30], ['day', 355]], short: [['lat', 40], ['day', 355]] },
  terrain: { plateau: [['feat', 0], ['alt', 2000], ['rel', 300]], basin: [['feat', 3], ['alt', 500], ['rel', 500]], hills: [['feat', 1], ['alt', 200], ['rel', 100]] },
  watercycle: { vapor: [['link', 1]], forest: [['forest', 80]], sun: [['sun', 30]] },
  weather: { storm: [['rain', 60]], gale: [['force', 9]], range: [['tmax', 30], ['tmin', 10]] },
  plates: { himalaya: [['mode', 0], ['b', 1], ['t', 50]], gap: [['mode', 1], ['d', 260]], mag: [['mode', 1], ['mag', 7]] },
  globe: { beijing: [['lat', 40], ['lon', 116]], south: [['lat', -10], ['lon', -60]], polar: [['lat', 75]], origin: [['lat', 0], ['lon', 0]] },
  timezone: { noon: [['utc', 4]], date: [['utc', 2]], line: [['utc', 0]] },
  scale: { sixty: [['den', 3], ['cm', 6]], far: [['den', 4], ['cm', 14]], large: [['den', 0]] },
  contour: { high: [['h', 800]], steep: [['h', 900], ['s', 0.06]], section: [['ys', 0.35]], interval: [['iv', 2]] },
  continents: { 亚洲: [['e', IDX.continents['亚洲']]], 南极洲: [['e', IDX.continents['南极洲']]], 太平洋: [['e', IDX.continents['太平洋']]] },
  regions: { 西亚: [['e', IDX.regions['西亚']]], 日本: [['e', IDX.regions['日本']]], 澳大利亚: [['e', IDX.regions['澳大利亚']]] },
  chinanature: { 长江: [['e', IDX.chinanature['长江']]], 青藏高原: [['e', IDX.chinanature['青藏高原']]], 秦岭: [['e', IDX.chinanature['秦岭']]] },
  chinaecon: { 东北平原: [['e', IDX.chinaecon['东北平原']]], 大庆: [['e', IDX.chinaecon['大庆']]], 青藏铁路: [['e', IDX.chinaecon['青藏铁路']]] },
  climate: { beijing: [['st', IDX.st['北京']], ['ans', 1]], south: [['st', IDX.st['达尔文']]], winter: [['st', IDX.st['罗马']]] },
  population: { fast: [['b', 40], ['d', 5]], decline: [['b', 6], ['d', 15]], double: [['b', 30], ['d', 5], ['y', 50]] },
  development: { split: [['thr', 20]], all: [['thr', 0.5]], birth: [['thr', 20]] },
  rocks: { outer: [['mode', 0], ['depth', 4000]], inner: [['depth', 6000]], meta: [['mode', 1], ['proc', 2]] },
  sustain: { low: [['coal', 0], ['oil', 10], ['gas', 10]], clean: [['coal', 0], ['oil', 20], ['gas', 10]], coal: [['coal', 5]] },
  chinabasic: { urumqi: [['city', 4]], north: [['lat', 53]], tropic: [['lat', 20], ['lon', 110]] },
  chinaterrain: { third: [['lon', 118]], second: [['lon', 106]], high: [['lon', 90]] },
  chinaregions: { view: [['view', 1]], taiwan: [['p', IDX.prov.tw]], tibet: [['p', IDX.prov.xz]], mongolia: [['view', 0], ['p', IDX.prov.nm]] },
});

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 1180, height: 820 }, init: () => { window.__fetches = []; const f = window.fetch; window.fetch = function (...a) { window.__fetches.push(String(a[0] && a[0].url ? a[0].url : a[0])); return f.apply(this, a); }; } });
  const { page } = t;
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  const to = async (hash, sel) => { await page.evaluate((h) => (location.hash = h), hash); await page.waitForSelector(sel); await page.waitForTimeout(120); };
  const sim = async (id) => { await to('#/science/geo/' + id, '.pl-sim'); await page.waitForFunction(() => window.__geo && document.querySelector('#pl-canvas').offsetWidth > 0); await page.waitForTimeout(60); };

  // =====================================================================================  A. CONTENT AND MODEL
  const info = await page.evaluate(async () => {
    const M = await import('/src/geolab-model.ts'); const D = await M.loadGeo(); const C = await import('/src/geolab-catalog.ts');
    const idx = {}; for (const [id, m] of Object.entries(D.facts)) { idx[id] = {}; m.entries.forEach((e, i) => (idx[id][e.n] = i)); }
    const st = {}; D.stations.forEach((s, i) => (st[s.n] = i));
    const gm = (await import('/src/data/geomap-china.json')).default; const prov = {}; gm.provinces.forEach((p, i) => (prov[p.id] = i));
    return { idx, st, prov, ids: Object.keys(C.CATALOG), tasks: Object.fromEntries(Object.entries(C.CATALOG).map(([k, v]) => [k, v.tasks])), order: C.ORDER, lessons: Object.keys(D.lessons) };
  });
  IDX = { ...info.idx, st: info.st, prov: info.prov };
  ok(info.ids.length === 21 && IDS.every((id) => info.ids.includes(id)) && info.order.length === 21 && new Set(info.order).size === 21, 'A the catalog lists 21 modules, each once in the order');
  ok(IDS.every((id) => info.lessons.includes(id)), 'A every module has a lesson in the data');
  const dataChk = await page.evaluate(async () => {
    const M = await import('/src/geolab-model.ts'); const D = await M.loadGeo(); const errs = [];
    let nb = 0, nf = 0;
    for (const [id, list] of Object.entries(D.banks)) for (const b of list) { nb++; const all = [b.a, ...b.w]; if (b.w.length !== 3 || new Set(all).size !== 4 || !b.q || !b.e) errs.push('bank ' + id + ': ' + b.q); }
    for (const [id, m] of Object.entries(D.facts)) {
      const names = m.entries.map((e) => e.n); if (new Set(names).size !== names.length) errs.push('dup names ' + id);
      for (const e of m.entries) { nf++; for (const k of Object.keys(e.f)) if (!m.fields[k]) errs.push(`${id}/${e.n}: field ${k}`); if (e.box) { const [a, b, c, d] = e.box; if (!(a < b && c < d && a >= -90 && b <= 90 && c >= -180 && d <= 180)) errs.push(`box ${id}/${e.n}`); } for (const v of Object.values(e.f)) if (!v || /undefined|NaN/.test(v)) errs.push('empty ' + e.n); }
      for (const [f, def] of Object.entries(m.fields)) { const v = m.entries.filter((e) => e.f[f] !== undefined); if (v.length < 4 && ['continents', 'regions', 'chinanature', 'chinaregions', 'chinaecon'].includes(id) && v.length) errs.push(`field ${id}.${f}: only ${v.length} entries`); if (!def.label || !def.q.includes('{n}')) errs.push(`field def ${id}.${f}`); }
    }
    const nbad = D.stations.filter((s) => M.climateOf(M.chartStats(s)) !== s.type).map((s) => s.n);
    if (nbad.length) errs.push('stations: ' + nbad.join());
    const prov = D.facts.chinaregions.entries.filter((e) => e.g === '省区');
    if (prov.length !== 34) errs.push('provinces ' + prov.length);
    const bad = JSON.stringify(D).match(/台湾国|台湾共和国|中华民国|香港国|澳门国/g); if (bad) errs.push('forbidden wording ' + bad.join());
    const ab = new Set(prov.map((e) => e.f.ab)); if (ab.size !== 34) errs.push('abbreviations not unique');
    const dev = D.development.countries; if (dev.length < 15 || !dev.every((c) => c.gdp > 0 && c.birth > 0 && c.iso.length === 2)) errs.push('development data');
    if (!(D.stations.length >= 12)) errs.push('stations');
    return { errs, nb, nf, tx: JSON.stringify(D).length };
  });
  ok(dataChk.errs.length === 0, `A data: ${dataChk.nb} bank questions (4 different choices), ${dataChk.nf} fact entries, 13 climate stations agree with the classifier, 34 provinces with unique abbreviations, no forbidden wording, data ${(dataChk.tx / 1024).toFixed(0)} KB${dataChk.errs.length ? ' ' + dataChk.errs.slice(0, 6).join('; ') : ''}`);
  ok(dataChk.tx < 150 * 1024, 'A the data file is small (< 150 KB)');

  // ----- generators: 300 seeds each, independent recomputation
  const gens = await page.evaluate(async () => {
    const M = await import('/src/geolab-model.ts'); await M.loadGeo(); const mulberry32 = (await import('/src/phys/qtools.ts')).mulberry32; const out = {};
    for (const id of ['globe', 'timezone', 'seasons', 'scale', 'contour', 'terrain', 'climate', 'weather', 'population', 'plates', 'watercycle', 'rocks', 'sustain', 'chinabasic', 'chinaterrain', 'development']) for (const k of M.genKinds(id)) { const l = []; for (let s = 1; s <= 300; s++) { try { const q = M.genQ(id, k, mulberry32(s * 7919 + 13)); l.push({ q: q.q, c: q.choices, a: q.a, ans: q.ans, kind: q.kind, p: q.p }); } catch (e) { l.push({ err: String(e) }); } } out[id + ':' + k] = l; }
    return out;
  });
  const keys = Object.keys(gens);
  ok(keys.length >= 40, `A generators: ${keys.length} kinds in 16 modules`);
  let nq = 0, structBad = [], valueBad = [];
  for (const key of keys) {
    for (const q of gens[key]) {
      nq++;
      if (q.err) { structBad.push(key + ' ' + q.err); continue; }
      if (q.c.length !== 4 || new Set(q.c).size !== 4 || q.c[q.a] !== q.ans || q.c.filter((x) => x === q.ans).length !== 1) { structBad.push(key + ': ' + q.q); continue; }
      const kk = key;
      if (NUM[kk]) { const v = NUM[kk](q.p); const d = decimals(q.ans); if (!(Math.abs(numOf(q.ans) - v) <= 0.5 * 10 ** -d + 1e-9)) valueBad.push(`${kk} ${q.ans} vs ${v} (${q.p})`); }
      else if (TXT[kk]) { const v = TXT[kk](q.p); if (q.ans !== v) valueBad.push(`${kk} ${q.ans} vs ${v} (${q.p})`); }
      else if (kk === 'contour:temp') { const v = TEMPQ(q.p); if (!near(numOf(q.ans), Math.round(v * 10) / 10, 0.051)) valueBad.push(`${kk} ${q.ans} vs ${v}`); }
      else if (kk === 'development:max') { /* below */ }
      else valueBad.push('no expectation for ' + kk);
    }
  }
  ok(nq === keys.length * 300, `A generators: ${nq} questions made`);
  ok(structBad.length === 0, `A generators: four different choices, the right one among them exactly once${structBad.length ? ' ' + structBad.slice(0, 4).join(' | ') : ''}`);
  ok(valueBad.length === 0, `A generators: every right answer agrees with the independent recomputation${valueBad.length ? ' ' + valueBad.slice(0, 5).join(' | ') : ''}`);
  const devQ = await page.evaluate(async () => { const M = await import('/src/geolab-model.ts'); const D = await M.loadGeo(); const mulberry32 = (await import('/src/phys/qtools.ts')).mulberry32; let bad = 0; for (let s = 1; s <= 300; s++) { const q = M.genQ('development', 'max', mulberry32(s)); const c = q.p.map((i) => D.development.countries[i]); const best = c.reduce((a, b) => (b.gdp > a.gdp ? b : a)); if (q.ans !== best.n || c.filter((x) => x.gdp === best.gdp).length !== 1 || !c.every((x) => q.choices.includes(x.n))) bad++; } return bad; });
  ok(devQ === 0, 'A development question: the country with the highest GDP per person among the four (300 seeds)');
  // the fact and bank questions against the data
  const factChk = await page.evaluate(async () => {
    const M = await import('/src/geolab-model.ts'); const D = await M.loadGeo(); const mulberry32 = (await import('/src/phys/qtools.ts')).mulberry32; const errs = []; let n = 0;
    for (const id of Object.keys(D.facts)) {
      const mod = D.facts[id];
      for (let s = 1; s <= 600; s++) {
        const q = M.factQ(mulberry32(s * 31 + id.length), id, mod); n++;
        const [i, rev] = q.p; const e = mod.entries[i]; const fld = q.kind.split(':')[2];
        if (q.choices.length !== 4 || new Set(q.choices).size !== 4 || q.choices[q.a] !== q.ans) { errs.push('struct ' + q.q); continue; }
        if (!rev) {
          if (q.ans !== e.f[fld] || !q.q.includes(e.n)) errs.push('fwd ' + q.q);
          if (q.choices.filter((c) => c === e.f[fld]).length !== 1) errs.push('dupl ' + q.q);
        } else {
          if (q.ans !== e.n) errs.push('rev ' + q.q);
          const same = mod.entries.filter((x) => x.f[fld] === e.f[fld]).length; if (same !== 1) errs.push('rev not unique ' + q.q);
          for (const c of q.choices) if (c !== e.n) { const o = mod.entries.find((x) => x.n === c); if (!o || o.f[fld] === e.f[fld]) errs.push('rev wrong choice has the same value ' + q.q); }
        }
      }
    }
    for (const [id, list] of Object.entries(D.banks)) for (let i = 0; i < list.length; i++) { const q = M.bankQ(mulberry32(i + 5), id, list[i], i); n++; if (q.ans !== list[i].a || q.choices.length !== 4) errs.push('bank ' + q.q); }
    return { errs, n };
  });
  ok(factChk.errs.length === 0 && factChk.n > 3000, `A fact and bank questions (${factChk.n}): the right value from the data, no wrong choice with the same value, reverse questions only for unique values${factChk.errs.length ? ' ' + factChk.errs.slice(0, 4).join(' | ') : ''}`);
  const quizChk = await page.evaluate(async (ids) => { const M = await import('/src/geolab-model.ts'); const D = await M.loadGeo(); const mulberry32 = (await import('/src/phys/qtools.ts')).mulberry32; const errs = []; for (const id of ids) for (let s = 1; s <= 60; s++) { const qs = M.quizOf(D, id, mulberry32(s)); if (qs.length !== 5 || new Set(qs.map((q) => q.q)).size !== 5 || qs.some((q) => q.choices.length !== 4 || q.a < 0 || !q.why)) errs.push(id + ' ' + s); } return errs; }, IDS);
  ok(quizChk.length === 0, `A the quiz of each module: five different questions with four choices and an explanation (21 x 60 seeds)${quizChk.length ? ' ' + quizChk.slice(0, 4).join() : ''}`);
  // model facts
  const mod = await page.evaluate(async () => {
    const M = await import('/src/geolab-model.ts'); const SM = await import('/src/spacemodel.ts'); const r = {};
    r.zones = [[0, '热带'], [23, '热带'], [24, '北温带'], [66, '北温带'], [67, '北寒带'], [-30, '南温带'], [-80, '南寒带']].every(([l, z]) => M.zoneOfLat(l) === z);
    r.hemi = M.hemiEW(-19) === '东半球' && M.hemiEW(-21) === '西半球' && M.hemiEW(159) === '东半球' && M.hemiEW(161) === '西半球';
    r.zoneLon = [[0, 0], [7, 0], [8, 1], [120, 8], [-75, -5], [180, 12], [-180, 12], [-172, -11]].every(([l, z]) => M.zoneOfLon(l) === z);
    const dec = (n) => SM.declination(n); r.dec = Math.abs(dec(172) - 23.44) < 0.3 && Math.abs(dec(355) + 23.44) < 0.3 && Math.abs(dec(80)) < 1 && Math.abs(dec(264)) < 1;
    r.noon = M.noonHeight(40, 23.5) === 73.5 && M.noonHeight(-30, -23.5) === 83.5;
    // marching squares: the end points lie on the level; no segment above the highest point or below the lowest
    const hill = { x: 0.3, y: 0.35, h: 400, s: 0.12 }; const f = (x, y) => M.heightAt(x, y, hill); let max = 0; for (let i = 0; i <= 80; i++) for (let j = 0; j <= 80; j++) max = Math.max(max, f(i / 80, j / 80));
    let off = 0, n = 0; for (const L of [50, 100, 200, 300, 400]) for (const s of M.contours(f, [L], 48)) { n++; off = Math.max(off, Math.abs(f(s.x1, s.y1) - L), Math.abs(f(s.x2, s.y2) - L)); }
    r.contours = { off, n, none: M.contours(f, [max + 20, 5], 48).length };
    const lin = M.contours((x, y) => x * 100, [30], 20); r.line = lin.length > 0 && lin.every((s) => Math.abs(s.x1 - 0.3) < 1e-9 && Math.abs(s.x2 - 0.3) < 1e-9);
    const P = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]; r.share = [M.chartStats({ t: P, p: P, lat: 40, alt: 0 }).share, M.chartStats({ t: P, p: P, lat: -40, alt: 0 }).share];
    const q = M.cycle(60, 40); r.cycle = Math.abs(q.precipLand - (q.landEvap + q.transp + q.runoff)) < 1e-9 && Math.abs(q.runoff - (q.surface + q.under)) < 1e-9 && M.cycle(60, 100).under > M.cycle(60, 0).under;
    r.waves = Math.abs(M.distFromGap(M.waveGap(300)) - 300) < 1e-9; r.energy = Math.abs(M.energyRatio(1) - 31.62) < 0.01;
    r.steps = M.stepOf(80) === 1 && M.stepOf(105) === 2 && M.stepOf(115) === 3 && M.altAt(90) >= 4500 && M.altAt(120) < 100;
    r.shift = JSON.stringify(M.shiftTime(1, 2, -5)) === JSON.stringify({ day: 365, hour: 21 }) && M.monthDay(60) === '3月1日' && M.monthDay(365) === '12月31日';
    r.bf = M.BEAUFORT.length === 13 && M.BEAUFORT.every((b, i) => i === 0 || b[0] > M.BEAUFORT[i - 1][1]);
    return r;
  });
  ok(mod.zones && mod.hemi && mod.zoneLon, 'A model: temperature zones, hemisphere split at 20°W / 160°E, time-zone numbers (incl. ±180)');
  ok(mod.dec && mod.noon, 'A model: the Sun\'s declination (solstices ±23.4°, equinoxes 0) and the noon height 90 − |lat − dec|');
  ok(mod.contours.off < 6 && mod.contours.n > 100 && mod.contours.none === 0 && mod.line, `A model: contour segments lie on their level (max error ${mod.contours.off.toFixed(2)} m), none above the summit, a straight level is a straight line`);
  const PP = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120], TOT = 780, north = Math.round((100 * (50 + 60 + 70 + 80 + 90 + 100)) / TOT), south = Math.round((100 * (110 + 120 + 10 + 20 + 30 + 40)) / TOT);
  ok(mod.share[0] === north && mod.share[1] === south && mod.cycle && mod.waves && mod.energy && mod.steps && mod.shift && mod.bf, 'A model: warm-half share (north / south), water balance, quake waves, energy ratio, steps of China, date shift, Beaufort table');
  // the climate classifier against the independent one on random charts
  const cl = await page.evaluate(async () => { const M = await import('/src/geolab-model.ts'); const out = []; let s = 12345; const r = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); for (let i = 0; i < 4000; i++) { const tmin = Math.round(-30 + r() * 60), tmax = tmin + Math.round(r() * 25) + 1, c = { tmin, tmax, ptot: Math.round(r() * 3000), pmin: Math.round(r() * 100), share: Math.round(r() * 100), alt: Math.round(r() * 4500) }; out.push([c, M.climateOf(c)]); } return out; });
  const clBad = cl.filter(([c, a]) => ZH[climI(c)] !== a).length;
  ok(clBad === 0, `A model: climateOf agrees with the independent decision table on ${cl.length} random charts`);
  // memory boxes
  const mem = await page.evaluate(async () => {
    const M = await import('/src/geolab-model.ts'); const D = await M.loadGeo(); const mulberry32 = (await import('/src/phys/qtools.ts')).mulberry32; const G = await import('/src/game.ts');
    const items = M.itemsOf(D); const keys = new Set(items.map((i) => i.key)); const one = M.itemsOf(D, ['globe']);
    let p = { cards: {}, plays: 0 }; const first = M.selectItems(items, p, '2026-01-10', 10, mulberry32(1));
    p = M.applyAnswers(p, first.map((i, k) => ({ key: i.key, right: k < 5 })), '2026-01-10', { score: 5, total: 10 });
    const wrongKeys = first.slice(5).map((i) => i.key), rightKeys = first.slice(0, 5).map((i) => i.key);
    const next = M.selectItems(items, p, '2026-01-10', 10, mulberry32(2)); const nextKeys = next.map((i) => i.key);
    const later = M.selectItems(items, p, '2026-01-12', 10, mulberry32(3)).map((i) => i.key);
    const qs = items.slice(0, 400).map((it, i) => M.questionOf(D, it, mulberry32(i + 1)));
    return { n: items.length, unique: keys.size === items.length, one: one.length > 0 && one.every((i) => i.mod === 'globe'), wrongBack: wrongKeys.every((k) => nextKeys.includes(k)), rightLater: rightKeys.every((k) => !nextKeys.includes(k)), box: p.cards[rightKeys[0]].box, boxW: p.cards[wrongKeys[0]].box, laterHasRight: later.some((k) => rightKeys.includes(k)), qok: qs.every((q) => q.choices.length === 4 && q.choices[q.a] === q.ans), plays: p.plays };
  });
  ok(mem.n > 400 && mem.unique && mem.one, `A practice items: ${mem.n} questions with unique keys, filterable by module`);
  ok(mem.wrongBack && mem.rightLater && mem.box === 1 && mem.boxW === 0 && mem.plays === 1 && mem.qok, 'A memory boxes: wrong answers (box 0) come back at once, right ones go to box 1 and wait; every item makes a valid question');

  // =====================================================================================  B. THE PAGES
  {
    await to('#/subject/science', '#open-geo');
    ok(await page.isVisible('#open-geo'), 'B the science home has the card 地理实验室');
    await page.click('#open-geo'); await page.waitForSelector('#gl-home');
    ok((await page.evaluate(() => location.hash)) === '#/science/geo', 'B the card opens #/science/geo');
    const cards = await page.evaluate(() => [...document.querySelectorAll('.pl-sc')].map((c) => ({ id: c.dataset.sim, icon: !!c.querySelector('svg'), text: c.textContent, grade: c.closest('.pl-cards').dataset.grade })));
    ok(cards.length === 21 && IDS.every((id) => cards.some((c) => c.id === id)) && cards.every((c) => c.icon && /实验任务 0 \/ \d/.test(c.text)), 'B 21 cards, each with its drawn icon and "实验任务 0 / n"');
    const gr = {}; for (const c of cards) gr[c.grade] = (gr[c.grade] || 0) + 1;
    ok(gr[6] === 6 && gr[7] === 10 && gr[8] === 5, `B grouped 小学 ${gr[6]} / 七年级 ${gr[7]} / 八年级 ${gr[8]}`);
    ok(await page.isVisible('#gl-practice') && await page.isVisible('#gl-map'), 'B the home links to the practice page and to the maps');
    await page.screenshot({ path: path.join(OUT, 'home.png'), fullPage: true });
  }
  const S = SOLVE();
  const shots = new Set(['globe', 'contour', 'climate', 'chinaregions', 'timezone', 'seasons', 'plates', 'terrain']);
  for (const id of IDS) {
    await sim(id);
    const m = await page.evaluate((id) => {
      const g = window.__geo; const rv = [...document.querySelectorAll('.pl-rv')].map((e) => e.textContent);
      return { id: g.id, tasks: g.def.tasks.length, done: g.done().length, rv, nRead: rv.length, hasLesson: document.querySelector('#pl-lesson').textContent.length > 60, canvas: document.querySelector('#pl-canvas').width > 0, card: !!document.querySelector('#gl-card') && document.querySelector('#gl-card').childElementCount, store: g.def.storeKey, quizLen: g.def.quiz.length >= 0 };
    }, id);
    ok(m.id === id && m.tasks === info.tasks[id] && m.done === 0 && m.hasLesson && m.canvas && m.store === 'learn.geolab.v1', `B ${id}: mounts (${m.tasks} tasks, none done by default, lesson, canvas, progress key)`);
    ok(m.nRead >= 2 && m.rv.every((v) => v && !/NaN|undefined|Infinity/.test(v)), `B ${id}: readouts are finite (${m.rv.slice(0, 3).join(' | ')})`);
    if (['climate', 'chinaterrain', 'continents', 'regions', 'chinanature', 'chinaecon', 'chinaregions'].includes(id)) ok(m.card > 0, `B ${id}: the card of content follows the state`);
    if (shots.has(id)) await page.screenshot({ path: path.join(OUT, `sim-${id}.png`), fullPage: true });
    // complete every task by driving the state
    const solve = S[id]; const taskIds = await page.evaluate(() => window.__geo.def.tasks.map((t) => t.id));
    ok(JSON.stringify(Object.keys(solve).sort()) === JSON.stringify([...taskIds].sort()), `B ${id}: the test knows every task (${taskIds.join(', ')})`);
    for (const tid of taskIds) {
      await page.evaluate(() => window.__geo.reset());
      const before = await page.evaluate((tid) => window.__geo.def.tasks.find((t) => t.id === tid).check(window.__geo.st), tid);
      for (const [k, v] of solve[tid]) await page.evaluate(([k, v]) => window.__geo.set(k, v), [k, v]);
      const after = await page.evaluate((tid) => ({ chk: window.__geo.def.tasks.find((t) => t.id === tid).check(window.__geo.st), done: window.__geo.done() }), tid);
      if (before || !after.chk || !after.done.includes(tid)) ok(false, `B ${id}/${tid}: before=${before} after=${after.chk} done=${after.done}`);
    }
    await page.evaluate(() => window.__geo.reset());
    const dom = await page.evaluate(() => ({ done: document.querySelectorAll('.pl-task.done').length, count: document.querySelector('#pl-tcount').textContent }));
    ok(dom.done === info.tasks[id] && dom.count === `${info.tasks[id]} / ${info.tasks[id]}`, `B ${id}: all tasks completed, shown ticked (${dom.count})`);
    // the quiz: three right, two wrong
    await page.click('#quiz-start'); await page.waitForTimeout(40);
    const qs = await page.evaluate(() => window.__geo.quiz().map((q) => ({ a: q.a, n: q.choices.length, why: !!q.why })));
    ok(qs.length === 5 && qs.every((q) => q.n === 4 && q.why), `B ${id}: the quiz has 5 questions with 4 choices and an explanation`);
    for (let i = 0; i < 5; i++) {
      const pick = i < 3 ? qs[i].a : (qs[i].a + 1) % 4;
      await page.click(`.pl-qopt[data-i="${pick}"]`);
      const res = await page.evaluate(() => ({ right: document.querySelectorAll('.pl-qopt.right').length, wrong: document.querySelectorAll('.pl-qopt.wrong').length, why: !document.querySelector('#quiz-why').hidden }));
      if (res.right !== 1 || (i < 3 ? res.wrong !== 0 : res.wrong !== 1) || !res.why) ok(false, `B ${id}: quiz answer ${i} marking ${JSON.stringify(res)}`);
      await page.click('#quiz-next');
    }
    ok((await page.textContent('#quiz-score')).replace(/\s+/g, '') === '得分3/5', `B ${id}: score 3 / 5 after three right answers`);
  }
  // progress is kept after a reload; the home counts it
  await page.reload(); await page.waitForSelector('.pl-sim, .hub-grid, #gl-home');
  await to('#/science/geo', '#gl-home');
  const kept = await page.evaluate(() => [...document.querySelectorAll('.pl-sc')].map((c) => /实验任务 (\d+) \/ (\d+)/.exec(c.textContent)).map((m) => m[1] === m[2]));
  ok(kept.length === 21 && kept.every(Boolean), 'B after a reload every card still says all tasks done (kept on this device)');
  const lsKeys = await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('learn.geolab.v1')); return [Object.keys(o.done).length, Object.keys(o.quiz).length, Math.min(...Object.values(o.quiz))]; });
  ok(lsKeys[0] === 21 && lsKeys[1] === 21 && lsKeys[2] >= 3, 'B learn.geolab.v1 holds the tasks and the best quiz score of 21 modules');

  // =====================================================================================  C. REAL INTERACTION
  const dragMouse = async (pts) => { await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down(); for (const q of pts.slice(1)) await page.mouse.move(q[0], q[1], { steps: 3 }); await page.mouse.up(); await page.waitForTimeout(120); };
  const canvasBox = async () => { await page.evaluate(() => document.querySelector('#pl-canvas').scrollIntoView({ block: 'center' })); await page.waitForTimeout(100); return page.evaluate(() => { const r = document.querySelector('#pl-canvas').getBoundingClientRect(); return { l: r.left, t: r.top, k: r.width / 640 }; }); };
  const st = (keys) => page.evaluate((keys) => keys.map((k) => window.__geo.st[k]), keys);
  {
    await sim('globe'); let b = await canvasBox();
    await dragMouse([[b.l + (50 + 270) * b.k, b.t + 150 * b.k], [b.l + (50 + 200) * b.k, b.t + 100 * b.k], [b.l + (50 + 540 * (80 / 360 + 0.5)) * b.k, b.t + (24 + 270 * (50 / 180)) * b.k]]);
    let [la, lo] = await st(['lat', 'lon']); ok(Math.abs(la - 40) <= 2 && Math.abs(lo - 80) <= 2, `C globe: dragging the pin sets latitude / longitude (${la}, ${lo})`);
    await sim('contour'); b = await canvasBox();
    await dragMouse([[b.l + 100 * b.k, b.t + 100 * b.k], [b.l + (20 + 0.7 * 280) * b.k, b.t + (20 + 0.3 * 280) * b.k]]);
    let [hx, hy] = await st(['hx', 'hy']); ok(Math.abs(hx - 0.7) <= 0.03 && Math.abs(hy - 0.3) <= 0.03, `C contour: dragging moves the hill (${hx}, ${hy})`);
    const cmax = await page.evaluate(() => window.__geo.def.readouts(window.__geo.st).map((r) => r.value)); ok(cmax.every((v) => v && !/NaN/.test(v)), 'C contour: the readouts follow the hill ' + cmax.join(' | '));
    await sim('timezone'); b = await canvasBox();
    await dragMouse([[b.l + 300 * b.k, b.t + 100 * b.k], [b.l + (30 + (15.5 / 25) * 580) * b.k, b.t + 100 * b.k]]);
    let [u] = await st(['utc']); ok(Math.abs(u - 9) <= 0.3, `C time zones: dragging the sun line sets the time (${u})`);
    await sim('scale'); b = await canvasBox();
    await dragMouse([[b.l + 100 * b.k, b.t + 170 * b.k], [b.l + 370 * b.k, b.t + 170 * b.k]]);
    let [cm] = await st(['cm']); ok(Math.abs(cm - 8) <= 0.5, `C scale: dragging point B measures the distance (${cm} cm)`);
    await sim('development'); b = await canvasBox();
    const xth = 60 + ((Math.log(10000) - Math.log(800)) / (Math.log(90000) - Math.log(800))) * 540;
    await dragMouse([[b.l + 100 * b.k, b.t + 100 * b.k], [b.l + xth * b.k, b.t + 100 * b.k]]);
    let [thr] = await st(['thr']); ok(Math.abs(thr - 10) <= 1.5, `C development: dragging the line sets the threshold (${thr})`);
    await sim('chinabasic'); b = await canvasBox();
    await dragMouse([[b.l + 300 * b.k, b.t + 200 * b.k], [b.l + (60 + (30 / 70) * 480) * b.k, b.t + (14 + (26 / 56) * 384) * b.k]]);
    [la, lo] = await st(['lat', 'lon']); const city = (await st(['city']))[0]; ok(Math.abs(la - 30) <= 1.5 && Math.abs(lo - 100) <= 1.5 && city === 0, `C China extent: dragging the pin (${la}, ${lo}), the city choice goes to custom`);
    await sim('chinaterrain'); b = await canvasBox();
    await dragMouse([[b.l + 100 * b.k, b.t + 200 * b.k], [b.l + (40 + ((116 - 73) / 49) * 560) * b.k, b.t + 200 * b.k]]);
    [lo] = await st(['lon']); ok(Math.abs(lo - 116) <= 1.5, `C China steps: dragging the marker (${lo}°E) and it reads step 3`);
    ok((await page.textContent('#gl-card')).includes('平原'), 'C China steps: the card names the plains of the third step');
    await sim('chinaregions'); b = await canvasBox();
    const gm = await page.evaluate(async () => { const d = (await import('/src/data/geomap-china.json')).default; return d.provinces.map((p) => ({ id: p.id, cp: p.cp, area: p.area })); });
    for (const id of ['xj', 'hl', 'gd', 'yn', 'sc']) {
      const p = gm.find((q) => q.id === id); await page.mouse.click(b.l + p.cp[0] * (640 / 2000) * b.k, b.t + p.cp[1] * (640 / 2000) * b.k); await page.waitForTimeout(80);
      const sel = await page.evaluate(() => window.__geo.st.p); if (sel !== IDX.prov[id]) ok(false, `C map: tapping ${id} selected ${sel} instead of ${IDX.prov[id]}`);
    }
    ok(true, 'C China regions: a tap on 新疆 / 黑龙江 / 广东 / 云南 / 四川 selects that province');
    const card = await page.textContent('#gl-card'); ok(/成都|四川/.test(card) && /南方地区/.test(card), 'C China regions: the card shows the province and its region');
    await page.click('#pl-act-next'); const nx = await page.evaluate(() => window.__geo.st.p); ok(nx === IDX.prov.sc + 1, 'C China regions: the next button moves on');
    await sim('rocks'); await page.evaluate(() => window.__geo.set('mode', 1)); await page.click('.pl-opt[data-c="proc"][data-v="1"]'); ok((await st(['proc']))[0] === 1, 'C rocks: a click on a process chooses it');
    // keyboard on a slider
    await sim('globe'); await page.focus('#pl-lat'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp'); ok((await st(['lat']))[0] === 32, 'C globe: the arrow keys move the latitude slider');
  }
  {
    const t2 = await start(new Map(), { local: true, viewport: { width: 390, height: 844 }, dpr: 2, touch: true });
    const p = t2.page; const cdp = await p.context().newCDPSession(p);
    const touch = async (pts) => { const tp = (q) => ({ x: q[0], y: q[1], id: 1, radiusX: 2, radiusY: 2, force: 1 }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tp(pts[0])] }); for (const q of pts.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [tp(q)] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(160); };
    const go = async (id) => { await p.evaluate((id) => (location.hash = '#/science/geo/' + id), id); await p.waitForSelector('.pl-sim'); await p.waitForFunction(() => window.__geo && document.querySelector('#pl-canvas').offsetWidth > 0); await p.evaluate(() => document.querySelector('#pl-canvas').scrollIntoView({ block: 'center' })); await p.waitForTimeout(200); };
    const box = () => p.evaluate(() => { const r = document.querySelector('#pl-canvas').getBoundingClientRect(); return { l: r.left, t: r.top, k: r.width / 640, w: r.width }; });
    const val = (k) => p.evaluate((k) => window.__geo.st[k], k);
    await go('globe'); let b = await box();
    await touch([[b.l + (50 + 270) * b.k, b.t + 150 * b.k], [b.l + (50 + 330) * b.k, b.t + 130 * b.k], [b.l + (50 + 540 * (100 / 360 + 0.5)) * b.k, b.t + (24 + 270 * (50 / 180)) * b.k]]);
    ok(Math.abs((await val('lat')) - 40) <= 3 && Math.abs((await val('lon')) - 100) <= 3, `D touch globe: a finger drags the pin (${await val('lat')}, ${await val('lon')})`);
    await go('contour'); b = await box();
    await touch([[b.l + 80 * b.k, b.t + 80 * b.k], [b.l + 140 * b.k, b.t + 130 * b.k], [b.l + (20 + 0.6 * 280) * b.k, b.t + (20 + 0.5 * 280) * b.k]]);
    ok(Math.abs((await val('hx')) - 0.6) <= 0.04 && Math.abs((await val('hy')) - 0.5) <= 0.04, `D touch contour: a finger drags the hill (${await val('hx')}, ${await val('hy')})`);
    const sy = await p.evaluate(() => window.scrollY); ok(sy >= 0, 'D touch contour: the page did not scroll under the finger');
    await go('timezone'); b = await box();
    await touch([[b.l + 300 * b.k, b.t + 100 * b.k], [b.l + (30 + (14.5 / 25) * 580) * b.k, b.t + 100 * b.k]]);
    ok(Math.abs((await val('utc')) - 10) <= 0.4, `D touch time zones: a finger moves the sun line (${await val('utc')})`);
    await go('chinaregions'); b = await box();
    const cp = await p.evaluate(async () => (await import('/src/data/geomap-china.json')).default.provinces.find((q) => q.id === 'xj').cp);
    await touch([[b.l + cp[0] * 0.32 * b.k, b.t + cp[1] * 0.32 * b.k]]);
    ok((await val('p')) === IDX.prov.xj, 'D touch China regions: a tap on 新疆 selects it');
    await go('chinaterrain'); b = await box();
    await touch([[b.l + 100 * b.k, b.t + 200 * b.k], [b.l + (40 + ((114 - 73) / 49) * 560) * b.k, b.t + 200 * b.k]]);
    ok(Math.abs((await val('lon')) - 114) <= 2, `D touch China steps: a finger drags the marker (${await val('lon')})`);
    await t2.browser.close();
  }

  // =====================================================================================  D. LAYOUT ON 5 SCREEN SIZES
  {
    const probs = [];
    for (const [w, hh, dpr] of [[390, 844, 2], [320, 568, 2], [820, 1180, 2], [1180, 820, 2], [844, 390, 3]]) {
      const tl = await start(new Map(), { local: true, viewport: { width: w, height: hh }, dpr });
      const p = tl.page;
      for (const id of IDS) {
        await p.evaluate((id) => (location.hash = '#/science/geo/' + id), id); await p.waitForSelector('.pl-sim'); await p.waitForFunction(() => window.__geo && document.querySelector('#pl-canvas').offsetWidth > 0); await p.waitForTimeout(90);
        const m = await p.evaluate(() => {
          const vis = (e) => !e.closest('[hidden]') && e.offsetParent !== null; const cv = document.querySelector('#pl-canvas'), wrap = document.querySelector('.pl-wrap'), wr = wrap.getBoundingClientRect();
          return { over: document.documentElement.scrollWidth - innerWidth, cw: cv.offsetWidth, ch: cv.offsetHeight, crisp: cv.width / (cv.offsetWidth * (window.devicePixelRatio || 1)), range: Math.min(...[...document.querySelectorAll('.pl-range')].filter(vis).map((e) => e.offsetHeight), 99), left: wr.left, right: innerWidth - wr.right, clip: [...document.querySelectorAll('.pl-rl, .pl-lab, .pl-tt, .pl-opt, .pl-btn, .pl-card h3')].filter((e) => vis(e) && e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.slice(0, 20)), card: document.querySelector('#gl-card') ? document.querySelector('#gl-card').getBoundingClientRect().width : -1 };
        });
        if (m.over > 0) probs.push(`${id}@${w}: overflow ${m.over}`);
        if (m.cw < Math.min(260, w - 40) || m.ch < 110) probs.push(`${id}@${w}: canvas ${m.cw}x${m.ch}`);
        if (Math.abs(m.crisp - 1) > 0.03) probs.push(`${id}@${w}: canvas not crisp ${m.crisp.toFixed(2)}`);
        if (m.range < 44) probs.push(`${id}@${w}: slider ${m.range}px`);
        if (Math.abs(m.left - m.right) > 2) probs.push(`${id}@${w}: not centred ${m.left.toFixed(1)} / ${m.right.toFixed(1)}`);
        if (m.clip.length) probs.push(`${id}@${w}: clipped ${m.clip.join(',')}`);
        if (m.card >= 0 && m.card < 200) probs.push(`${id}@${w}: card ${m.card}`);
      }
      await p.evaluate(() => (location.hash = '#/science/geo')); await p.waitForSelector('#gl-home'); await p.waitForTimeout(200);
      const hm = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, left: document.querySelector('.pl-wrap').getBoundingClientRect().left, right: innerWidth - document.querySelector('.pl-wrap').getBoundingClientRect().right }));
      if (hm.over > 0 || Math.abs(hm.left - hm.right) > 2) probs.push(`home@${w}: ${JSON.stringify(hm)}`);
      if (w === 390 || w === 1180) await p.screenshot({ path: path.join(OUT, `home-${w}.png`), fullPage: true });
      await p.evaluate(() => (location.hash = '#/science/geo/practice')); await p.waitForSelector('#gl-practice-page'); await p.waitForTimeout(150);
      const pm = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth }));
      if (pm.over > 0) probs.push(`practice@${w}: overflow`);
      if (w === 390) { await p.evaluate(() => (location.hash = '#/science/geo/chinaregions')); await p.waitForSelector('.pl-sim'); await p.waitForTimeout(400); await p.screenshot({ path: path.join(OUT, 'chinaregions-390.png'), fullPage: true }); }
      await tl.browser.close();
    }
    ok(probs.length === 0, `D 21 modules + home + practice on 390 / 320 / 820 / 1180 / 844 px wide: no overflow, crisp canvas at dpr 2-3, sliders >= 44 px, centred, nothing clipped${probs.length ? '\n   ' + probs.slice(0, 8).join('\n   ') : ''}`);
  }

  // =====================================================================================  E. PRACTICE AND THE MEMORY BOXES
  {
    await to('#/science/geo/practice', '#gl-start');
    const stats0 = await page.textContent('#gl-stats'); ok(/题目 \d{3,} 道，已练 0 道/.test(stats0), 'E practice: the page counts the questions (' + stats0 + ')');
    await page.click('.mopt[data-mod="globe"]'); await page.waitForTimeout(80);
    const sg = await page.textContent('#gl-stats'); ok(/题目 \d+ 道/.test(sg) && parseInt(/题目 (\d+)/.exec(sg)[1]) < parseInt(/题目 (\d+)/.exec(stats0)[1]), 'E practice: a module chip narrows the questions (' + sg + ')');
    await page.click('.mopt[data-mod=""]');
    const round = async (rightAll) => {
      await page.click('#gl-start'); const keys = [];
      for (let i = 0; i < 10; i++) { await page.waitForSelector('#gl-q'); keys.push(await page.getAttribute('#gl-q', 'data-key')); const sel = rightAll ? '.pl-qopt[data-right="1"]' : '.pl-qopt[data-right="0"]'; await page.click(sel + ' >> nth=0'); if (!(await page.isVisible('#gl-why') && await page.isVisible('#gl-next'))) ok(false, 'E practice: no explanation / Next after an answer'); await page.click('#gl-next'); }
      await page.waitForSelector('#gl-score'); return { keys, score: (await page.textContent('#gl-score')).replace(/\s+/g, '') };
    };
    const r1 = await round(false); ok(r1.score === '得分0/10' && new Set(r1.keys).size === 10, `E practice: a round of 10 different questions, all wrong: ${r1.score}`);
    const saved1 = await page.evaluate(() => JSON.parse(localStorage.getItem('learn.geolab.practice.v1')));
    ok(Object.keys(saved1.cards).length === 10 && Object.values(saved1.cards).every((c) => c.box === 0 && c.wrong === 1) && saved1.plays === 1 && saved1.last.score === 0, 'E practice: the wrong answers are in box 0 on this device (learn.geolab.practice.v1)');
    await page.click('#gl-again'); await page.waitForSelector('#gl-start');
    ok(/已练 10 道，到期 10 道/.test(await page.textContent('#gl-stats')), 'E practice: the ten wrong ones are due');
    const r2 = await round(true); ok(r2.score === '得分10/10' && r2.keys.every((k) => r1.keys.includes(k)), 'E practice: the next round asks exactly the due questions, all right: ' + r2.score);
    const saved2 = await page.evaluate(() => JSON.parse(localStorage.getItem('learn.geolab.practice.v1')));
    ok(Object.values(saved2.cards).every((c) => c.box === 1) && saved2.plays === 2, 'E practice: right answers move up to box 1');
    await page.click('#gl-again'); await page.waitForSelector('#gl-start');
    const r3 = await round(true); ok(r3.keys.every((k) => !r1.keys.includes(k)), 'E practice: questions that are known and not due wait; new ones are asked');
    await page.screenshot({ path: path.join(OUT, 'practice.png'), fullPage: true });
  }

  // =====================================================================================  F. ENGLISH / FRENCH
  for (const [loc, label] of [['en', 'English'], ['fr', 'French']]) {
    const tl = await start(new Map(), { local: true, locale: loc, viewport: { width: 1180, height: 820 } });
    await withExtra(tl);
    const p = tl.page; const left = [];
    const scan = async (where) => { const a = await p.evaluate(() => { const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (n.parentElement.closest('.user, canvas, svg, script, style')) continue; if (/[一-鿿]/.test(n.nodeValue)) out.push(n.nodeValue.trim()); } document.querySelectorAll('[title],[aria-label],[placeholder]').forEach((e) => { for (const k of ['title', 'aria-label', 'placeholder']) { const s = e.getAttribute(k); if (s && /[一-鿿]/.test(s) && !e.closest('.user')) out.push(s); } }); return out; }); for (const s of a) left.push(`${where}: ${s}`); };
    await p.evaluate(() => (location.hash = '#/subject/science')); await p.waitForSelector('#open-geo'); await p.waitForTimeout(200);
    ok(!/[一-鿿]/.test(await p.textContent('#open-geo')), `F ${label}: the science card is translated (${(await p.textContent('#open-geo')).trim()})`);
    await p.evaluate(() => (location.hash = '#/science/geo')); await p.waitForSelector('#gl-home'); await p.waitForTimeout(200); await scan('home');
    await p.evaluate(() => (location.hash = '#/science/geo/practice')); await p.waitForSelector('#gl-start'); await scan('practice'); await p.click('#gl-start'); await p.waitForSelector('#gl-q'); await scan('practice question'); await p.click('.pl-qopt >> nth=0'); await scan('practice answered');
    for (const id of IDS) {
      await p.evaluate((id) => (location.hash = '#/science/geo/' + id), id); await p.waitForSelector('.pl-sim'); await p.waitForFunction(() => window.__geo); await p.waitForTimeout(120); await scan(id);
      const choices = await p.evaluate(() => (window.__geo.def.choices || []).map((c) => [c.id, c.options.map((o) => o[0])]));
      const ps = await p.evaluate(() => window.__geo.def.params.map((q) => [q.id, q.min, q.max]));
      for (const [cid, vals] of (choices.length ? choices : [[null, [0]]])) {
        for (const v of vals) { await p.evaluate(([c, v]) => { window.__geo.reset(); if (c) window.__geo.set(c, v); }, [cid, v]); await p.waitForTimeout(25); await scan(`${id} ${cid}=${v}`); for (const [pid, mn, mx] of ps) for (const val of [mn, (mn + mx) / 2, mx]) { await p.evaluate(([a, b]) => window.__geo.set(a, b), [pid, val]); await scan(`${id} ${cid}=${v} ${pid}=${val}`); } }
      }
      await p.evaluate(() => window.__geo.reset());
      await p.click('#quiz-start'); await p.waitForTimeout(40); await scan(id + ' quiz'); await p.click('.pl-qopt >> nth=0'); await scan(id + ' quiz answered'); await p.click('#quiz-next');
    }
    const uniq = [...new Set(left)];
    ok(uniq.length === 0, `F ${label}: no Chinese left outside content boxes (${uniq.length})${uniq.length ? '\n   ' + uniq.slice(0, 30).join('\n   ') : ''}`);
    await p.evaluate(() => (location.hash = '#/science/geo/globe')); await p.waitForSelector('.pl-sim');
    ok(/[一-鿿]/.test(await p.textContent('#pl-lesson')) && (await p.evaluate(() => !!document.querySelector('#pl-lesson.user'))), `F ${label}: the lesson text is content: it stays Chinese in a user box`);
    let probs = [];
    for (const [w, hh] of [[390, 844], [320, 568], [820, 1180]]) { await p.setViewportSize({ width: w, height: hh }); for (const id of IDS) { await p.evaluate((id) => (location.hash = '#/science/geo/' + id), id); await p.waitForSelector('.pl-sim'); await p.waitForTimeout(40); const m = await p.evaluate(() => { const vis = (e) => !e.closest('[hidden]') && e.offsetParent !== null; return { over: document.documentElement.scrollWidth - innerWidth, clip: [...document.querySelectorAll('.pl-rl, .pl-lab, .pl-tt, .pl-opt, .pl-btn, .pl-card h3')].filter((e) => vis(e) && e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.slice(0, 20)) }; }); if (m.over > 0 || m.clip.length) probs.push(`${id}@${w}: ${m.over} ${m.clip.join(',')}`); } }
    ok(probs.length === 0, `F ${label}: 21 modules on 390 / 320 / 820 px wide: no overflow, no clipped label${probs.length ? ' ' + probs.slice(0, 6).join('; ') : ''}`);
    await p.setViewportSize({ width: 390, height: 844 }); await p.evaluate(() => (location.hash = '#/science/geo/climate')); await p.waitForTimeout(300); await p.screenshot({ path: path.join(OUT, `climate-${loc}.png`), fullPage: true });
    ok(tl.log.external.length === 0, `F ${label}: nothing was requested from outside the app (${tl.log.external.join(', ')})`);
    await tl.browser.close();
  }

  // =====================================================================================  G. NOTHING LEAVES THE DEVICE, NO PAGE ERRORS
  ok(t.log.external.length === 0, 'G no request left the app in the whole run: ' + t.log.external.join(', '));
  const fetched = await page.evaluate(() => window.__fetches.filter((u) => /geolab|data\/|geomap|\.json/.test(u)));
  ok(fetched.length === 0, 'G the libraries are compiled in, not fetched (no fetch of a data file): ' + fetched.join(', '));
  ok(consoleErrors.filter((e) => !/favicon|manifest|Failed to load resource/.test(e)).length === 0, 'G no console errors' + (consoleErrors.length ? ': ' + consoleErrors.slice(0, 3).join(' | ') : ''));
  const src = await page.evaluate(async () => { const out = []; for (const f of ['geolab', 'geolab-model', 'geolab-sims1', 'geolab-sims2', 'geolab-draw', 'geolab-catalog']) { const s = await (await fetch(`/src/${f}.ts`)).text(); if (/https?:\/\/(?!www\.w3\.org)/.test(s.replace(/xmlns="[^"]*"/g, ''))) out.push(f); } return out; });
  ok(src.length === 0, 'G the geography lab code names no outside address ' + src.join());
  await done(t.browser);
})().catch((e) => { console.error(e); process.exit(1); });
