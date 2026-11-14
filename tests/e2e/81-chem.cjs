// 化学 (#/science/chem, under 科学): the junior-high chemistry trainer (part 1 + part 2: solubility curves, advanced calculations, 推断题, 除杂, 流程图, lab work, chemistry and life, atoms and ions, properties and uses). The library (>= 150 reactions, each re-checked here by an INDEPENDENT atom counter, the types
// by structure, phenomena, no duplicates, size), the data (valences, masses recomputed, solubility table, substances), the question generators over thousands of seeds
// (right answer, distractors wrong, no duplicates, the stoichiometry and solution numbers recomputed independently, the 复分解 judge against an independent rule on EVERY
// pair of the solubility table, metal activity, classification, gases), the memory boxes, and the screens: the card on the science home, every mode played to the end with
// the real controls (steppers + a live balance scale, formula tiles, steps with numbers, choices, drag with the mouse and with REAL touch events at dpr 2), explanations,
// progress on this device only, 5 screen sizes, English / French with no Chinese left, nothing leaves the device.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const path = require('path');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const CJK = /[　-〿一-鿿＀-￯]/;
const DATA_FILE = path.join(__dirname, '../../src/data/chem.json');
const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

// ------------------------------------------------------------------ independent helpers (no code of the app)
const AR = { H: 1, Li: 7, C: 12, N: 14, O: 16, F: 19, Na: 23, Mg: 24, Al: 27, Si: 28, P: 31, S: 32, Cl: 35.5, K: 39, Ca: 40, Mn: 55, Fe: 56, Cu: 64, Zn: 65, Ag: 108, Ba: 137, W: 184, Hg: 201 };
const SUBD = '₀₁₂₃₄₅₆₇₈₉';
const unsub = (s) => s.replace(/[₀-₉]/g, (c) => String(SUBD.indexOf(c)));
/** atoms of a formula by expanding brackets (a different method from the app's parser); null when it is not a formula */
function atoms(f) {
  if (!f || /[^A-Za-z0-9()·]/.test(f)) return null;
  const total = {};
  for (const [i, part] of f.split('·').entries()) {
    let mult = 1, s = part;
    if (i > 0) { const m = /^(\d+)/.exec(s); if (m) { mult = +m[1]; s = s.slice(m[1].length); } }
    let guard = 0;
    while (/\(/.test(s) && guard++ < 20) s = s.replace(/\(([^()]*)\)(\d*)/, (_, inner, n) => inner.repeat(n ? +n : 1));
    if (/[()]/.test(s)) return null;
    let used = 0;
    for (const m of s.matchAll(/([A-Z][a-z]?)(\d*)/g)) { if (!(m[1] in AR)) return null; total[m[1]] = (total[m[1]] || 0) + (m[2] ? +m[2] : 1) * mult; used += m[0].length; }
    if (used !== s.length) return null;
  }
  return total;
}
const sideOf = (s) => s.split('+').map((t) => { const m = /^(\d*)(.+?)[↑↓]?$/.exec(t); return { c: m[1] ? +m[1] : 1, f: m[2], mark: /[↑↓]$/.test(t) ? t.slice(-1) : '' }; });
const parseEq = (eq) => { const [l, r] = eq.split('='); return { l: sideOf(l), r: sideOf(r) }; };
const count = (side) => { const o = {}; for (const { c, f } of side) for (const [e, n] of Object.entries(atoms(f))) o[e] = (o[e] || 0) + c * n; return o; };
const balanced = (eq) => { const { l, r } = parseEq(eq); const a = count(l), b = count(r); return Object.keys({ ...a, ...b }).every((e) => a[e] === b[e]); };
const mass = (f) => Object.entries(atoms(f)).reduce((s, [e, n]) => s + AR[e] * n, 0);
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const SUBS = new Map(data.subs.map((s) => [s.f, s]));
const METALS = new Set(['Li', 'Na', 'Mg', 'Al', 'K', 'Ca', 'Mn', 'Fe', 'Cu', 'Zn', 'Ag', 'Ba', 'W', 'Hg']);
const isElement = (f) => Object.keys(atoms(f)).length === 1 && !f.includes('·');
/** the type by structure, written on its own */
function typeOf(eq) {
  const { l, r } = parseEq(eq);
  const nElem = (side) => side.filter((t) => isElement(t.f)).length;
  const nonMetalOxide = (f) => { const a = atoms(f); return Object.keys(a).length === 2 && 'O' in a && !Object.keys(a).some((e) => METALS.has(e)); };
  const organic = (f) => SUBS.get(f)?.c === 'org';
  if (l.length >= 2 && r.length === 1) return '化合';
  if (l.length === 1 && r.length >= 2) return '分解';
  if (l.length === 2 && r.length === 2 && nElem(l) === 1 && nElem(r) === 1) return '置换';
  if (l.length === 2 && nElem(l) === 0 && nElem(r) === 0 && r.length >= 2 && !l.some((t) => nonMetalOxide(t.f) || organic(t.f))) return '复分解';
  return '其他';
}
const VAL = { H: 1, Li: 1, Na: 1, K: 1, Ag: 1, Ca: 2, Mg: 2, Ba: 2, Zn: 2, Al: 3, O: -2, F: -1 };
const ALLOWED = Object.fromEntries(data.elements.map((e) => [e.s, e.v]));
/** is there an assignment of the usual valences that makes the compound neutral? */
function neutralPossible(f) {
  const a = atoms(f); const els = Object.keys(a);
  const opts = els.map((e) => (e in VAL ? [VAL[e]] : e === 'Cl' && !('O' in a) ? [-1] : ALLOWED[e]));
  const go = (i, sum) => (i === els.length ? sum === 0 : opts[i].some((v) => go(i + 1, sum + v * a[els[i]])));
  return go(0, 0);
}
const UNITS = { 'cat': data.ions.cat, 'an': data.ions.an };
const CHARGE = { H: 1, NH4: 1, K: 1, Na: 1, Ba: 2, Ca: 2, Mg: 2, Al: 3, Zn: 2, Fe2: 2, Fe3: 3, Cu: 2, Ag: 1, OH: -1, NO3: -1, Cl: -1, SO4: -2, CO3: -2 };

// the 复分解 judge written again: from the table and the usual teaching rules
function refMeta(a, b) {
  const sol = (c) => data.ions.sol[c.an][data.ions.cat.indexOf(c.cat)];
  const acid = (c) => c.cat === 'H', base = (c) => c.an === 'OH' && c.cat !== 'H', salt = (c) => !acid(c) && !base(c);
  const usable = (c) => acid(c) || sol(c) === 's' || sol(c) === 'v' || (sol(c) === 'm' && base(c));
  const prodCells = [{ cat: a.cat, an: b.an }, { cat: b.cat, an: a.an }].map((c) => (c.cat === 'H' && c.an === 'OH' ? 'water' : c.cat === 'NH4' && c.an === 'OH' ? 'gas' : sol(c)));
  const ambiguousReactant = (sol(a) === 'm' && salt(a)) || (sol(b) === 'm' && salt(b));
  const isPpt = (x) => x === 'i' || x === 'm';
  let happens = false, reasons = [], amb = ambiguousReactant;
  if ((acid(a) && acid(b)) || (base(a) && base(b))) happens = false;
  else if ((acid(a) && base(b)) || (base(a) && acid(b))) { happens = true; reasons = ['water']; }
  else if (acid(a) || acid(b)) {
    const s = acid(a) ? b : a, ac = acid(a) ? a : b;
    if (s.an === 'CO3') { happens = true; reasons = ['gas']; }
    else if (!usable(s)) happens = false;
    else { const np = sol({ cat: s.cat, an: ac.an }); happens = isPpt(np); reasons = happens ? ['precipitate'] : []; }
  } else if (base(a) || base(b)) {
    const bs = base(a) ? a : b, s = base(a) ? b : a;
    if (!usable(bs) || !usable(s)) happens = false;
    else {
      const set = new Set();
      if (s.cat === 'NH4') set.add('gas'); else if (isPpt(sol({ cat: s.cat, an: 'OH' }))) set.add('precipitate');
      if (isPpt(sol({ cat: bs.cat, an: s.an }))) set.add('precipitate');
      reasons = [...set]; happens = reasons.length > 0;
      if (s.cat !== 'NH4' && sol({ cat: s.cat, an: 'OH' }) === '-') amb = true;
    }
  } else {
    if (!usable(a) || !usable(b)) happens = false;
    else { happens = prodCells.some(isPpt); reasons = happens ? ['precipitate'] : []; if (prodCells.includes('-')) amb = true; }
  }
  if (prodCells.includes('m')) amb = true;   // a slightly soluble PRODUCT (CaSO4, Ag2SO4, MgCO3, Ca(OH)2): never asked
  return { happens, reasons, ambiguous: amb };
}
const allCmps = () => { const out = []; for (const an of data.ions.an) for (const cat of data.ions.cat) { const s = data.ions.sol[an][data.ions.cat.indexOf(cat)]; if (s === '-' || (cat === 'H' && an === 'CO3') || (cat === 'NH4' && an === 'OH')) continue; out.push({ cat, an }); } return out; };

const SERIES = ['K', 'Ca', 'Na', 'Mg', 'Al', 'Zn', 'Fe', 'Sn', 'Pb', 'H', 'Cu', 'Hg', 'Ag', 'Pt', 'Au'];
const METAL_CH = { Mg: 2, Al: 3, Zn: 2, Fe: 2, Cu: 2, Ag: 1 };
const crossF = (cat, cc, an, ac) => { const g = gcd(cc, ac); const a = ac / g, b = cc / g; const p = (s, n) => (n === 1 ? s : (Object.keys(atoms(s)).length > 1 ? `(${s})` : s) + n); return p(cat, a) + p(an, b); };
const ANIONS = { Cl: ['Cl', 1], NO3: ['NO3', 1], SO4: ['SO4', 2] };

// ------------------------------------------------------------------ helpers for the browser
const extra = Object.assign({}, ...['chem.json', 'chemcontent.json'].map((f) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../src/i18n-extra/' + f), 'utf8'))));   // (chemcontent.json: the content of the data library, the banks and the generated texts, rule 66)
const withExtra = async (t) => {
  const add = 'Object.assign(EN, ' + JSON.stringify(Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, v[0]]))) + ');\nObject.assign(FR, ' + JSON.stringify(Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, v[1]]))) + ');\n';
  await t.ctx.route('**/src/i18n-data.ts*', async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()) + '\n' + add }); });
  await t.page.reload(); await t.page.waitForSelector('.hub-grid, .kids, .empty-home');
};
const open = async (opts = {}) => {
  const t = await start(new Map(), { local: true, today: '2026-11-13', viewport: { width: 390, height: 844 }, ...opts });
  if (opts.locale && opts.locale !== 'zh-CN') await withExtra(t);
  return t;
};
const go = async (page, hash, sel) => { await page.evaluate((h) => (location.hash = h), hash); await page.waitForSelector(sel); await page.waitForTimeout(120); };
// rule 66: the content of the chemistry is translated too, so even the `user` boxes may hold no Chinese
const chineseLeft = (page) => page.evaluate((src) => {
  const re = new RegExp(src), out = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode()); ) { const p = n.parentElement; if (!p || p.closest('script, style')) continue; if (re.test(n.nodeValue)) out.push(n.nodeValue.trim().slice(0, 40)); }
  for (const e of document.querySelectorAll('[title],[aria-label],[placeholder]')) { for (const a of ['title', 'aria-label', 'placeholder']) { const v = e.getAttribute(a); if (v && re.test(v)) out.push(a + ':' + v.slice(0, 30)); } }
  return out;
}, CJK.source);
const progress = (page) => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('learn.chem.v1')); } catch (e) { return null; } });
/** a question list made by the app's own generators (in the page), checked here */
const makeRounds = (page, modes, seeds, lv = 0) => page.evaluate(async ({ modes, seeds, lv }) => {
  const C = await import('/src/chemlogic.ts'); await C.loadChem();
  const out = {};
  for (const m of modes) { out[m] = []; for (let s = 1; s <= seeds; s++) out[m].push(...C.buildRound(m, lv, s * 7919 + m.length, C.EMPTY_PROGRESS, '2026-11-13')); }
  return out;
}, { modes, seeds, lv });
const textOf = (parts) => parts.map((p) => (typeof p === 'string' ? p : p.u ?? p.f ?? (p.eq ? `<${p.eq}>` : ''))).join('');
const keyOf = (parts) => JSON.stringify(parts);

// ------------------------------------------------------------------ playing a question with the real controls
async function answer(page, q, right = true) {
  if (q.t === 'choice') {
    const i = right ? q.right : (q.right + 1) % q.choices.length;
    await page.click(`.chem-ch[data-i="${i}"]`);
  } else if (q.t === 'num') {
    for (let k = 0; k < q.steps.length; k++) {
      const s = q.steps[k];
      await page.fill(`#chem-in-${k}`, String(right ? s.answer : s.answer + 9));
      await page.click(`#chem-ok-${k}`);
      await page.waitForSelector(`#chem-say-${k}.ok, #chem-say-${k}.bad`);
    }
  } else if (q.t === 'bal') {
    const rx = data.reactions.find((r) => r.id === q.rx); const { l, r } = parseEq(rx.eq); const terms = [...l, ...r];
    for (const [i, t] of terms.entries()) for (let n = 1; n < (right ? t.c : t.c + 1); n++) await page.click(`#chem-inc-${i}`);
    if (!right) { await page.click('#chem-check'); await page.waitForSelector('#chem-msg.bad'); for (let i = 0; i < terms.length; i++) { const have = await page.evaluate((i) => +document.querySelector('#chem-c-' + i).textContent, i); for (let n = have; n < terms[i].c; n++) await page.click(`#chem-inc-${i}`); for (let n = have; n > terms[i].c; n--) await page.click(`#chem-dec-${i}`); } }
    await page.click('#chem-check');
  } else if (q.t === 'write') {
    const rx = data.reactions.find((r) => r.id === q.rx); const { l, r } = parseEq(rx.eq);
    if (!right) { await page.click(`.chem-tile[data-f="${l[0].f}"]`); await page.click('#chem-check'); await page.waitForSelector('#chem-msg.bad'); await page.click('#chem-clear'); }
    for (const [side, list] of [[0, l], [1, r]]) {
      await page.click(`#chem-zone-${side ? 'r' : 'l'}`);
      for (const t of list) {
        await page.click(`.chem-tile[data-f="${t.f.replace(/"/g, '\\"')}"]`);
        for (let n = 1; n < t.c; n++) await page.click(`#chem-zone-${side ? 'r' : 'l'} .chem-chip[data-f="${t.f.replace(/"/g, '\\"')}"] .chem-step-btn:nth-of-type(2)`);
      }
    }
    await page.click('#chem-check');
  } else if (q.t === 'ord') {
    const order = right ? q.items : q.items.slice().reverse();
    for (const step of order) await page.click(`.chem-ordb[data-i="${q.shown.indexOf(step)}"]`);
    await page.click('#chem-check');
  } else if (q.t === 'class') {
    // tap an item, then its class (the keyboard-friendly way) for all but two; the two are dragged with the mouse
    let dragged = 0;
    for (const it of q.items) {
      const cat = right || it !== q.items[0] ? it.cat : q.buckets.find((b) => b !== it.cat);
      if (dragged < 2) {
        const a = await page.locator(`.chem-item[data-id="${it.id.replace(/"/g, '\\"')}"]`); await a.scrollIntoViewIfNeeded();
        const ba = await a.boundingBox(); const bb = await page.locator(`#chem-bk-${cat}`).boundingBox();
        if (ba && bb && bb.y > 0 && bb.y + bb.height < 844) { await page.mouse.move(ba.x + ba.width / 2, ba.y + ba.height / 2); await page.mouse.down(); await page.mouse.move(ba.x + ba.width / 2 + 10, ba.y + 20, { steps: 3 }); await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 6 }); await page.mouse.up(); dragged++; continue; }
      }
      await page.click(`.chem-item[data-id="${it.id.replace(/"/g, '\\"')}"]`);
      await page.click(`#chem-bk-${cat} > b`);
    }
    await page.click('#chem-check');
  }
  await page.waitForSelector('#chem-verdict');
}
const currentQ = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__chemQ)));

/** the drawing of a question, read back from the page and compared with the data (independent of the app) */
async function checkSpec(page, q) {
  const info = await page.evaluate(() => {
    const box = document.querySelector('#chem-spec'); if (!box) return null; const svg = box.querySelector('svg'); if (!svg) return { none: true };
    const doc = new DOMParser().parseFromString(svg.outerHTML, 'image/svg+xml');
    const texts = [...svg.querySelectorAll('text')].map((e) => e.textContent).join('');
    const r = svg.getBoundingClientRect();
    return { ok: !doc.querySelector('parsererror'), cjk: /[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/.test(texts), w: r.width, h: r.height, vw: innerWidth, right: r.right,
      curves: [...svg.querySelectorAll('.cv-line')].map((e) => [e.dataset.sub, e.dataset.pts]), marks: [...svg.querySelectorAll('.cv-mark')].map((e) => [e.dataset.mark, +e.dataset.t, +e.dataset.s]), guides: [...svg.querySelectorAll('.cv-guide')].map((e) => +e.dataset.t),
      atom: svg.dataset.shells ? { z: +svg.dataset.z, e: +svg.dataset.e, shells: svg.dataset.shells, dots: svg.querySelectorAll('.at-e').length } : null, cell: svg.classList.contains('chem-cell') ? { z: +svg.dataset.z, sym: svg.dataset.sym, ar: +svg.dataset.ar } : null,
      app: svg.dataset.app || null, shapes: svg.querySelectorAll('path,rect,circle').length, steps: [...svg.querySelectorAll('.fl-step')].map((e) => +e.dataset.n), boxes: [...svg.querySelectorAll('.fl-box')].map((e) => [e.dataset.t, e.dataset.side || '']) };
  });
  const s = q.spec, bad = [];
  if (!info || info.none) return ok(false, 'a question with a figure shows the figure (' + q.key + ')');
  if (!info.ok || info.cjk || info.w < 60 || info.h < 40 || info.right > info.vw + 1) bad.push(`svg ${info.ok} ${info.cjk} ${info.w}x${info.h}`);
  const shellsI = (e) => { const o = []; let left = e; for (const c of [2, 8, 8, 8]) { if (left <= 0) break; o.push(Math.min(c, left)); left -= c; } return o; };
  if (s.k === 'curve') {
    if (info.curves.length !== s.subs.length) bad.push('curves ' + info.curves.length);
    for (const [f, pts] of info.curves) { const d = data.solub.d.find((x) => x.f === f); if (!d || pts !== data.solub.T.map((tt, k) => `${tt}:${d.v[k]}`).join(',')) bad.push('curve data ' + f); }
    const named = s.marks.filter((m) => m.n); if (JSON.stringify(info.marks) !== JSON.stringify(named.map((m) => [m.n, m.T, m.S]))) bad.push('marks'); if (info.guides.length !== s.marks.filter((m) => !m.n).length) bad.push('guides');
  } else if (s.k === 'atom') { if (info.atom.z !== s.z || info.atom.e !== s.e || info.atom.shells !== shellsI(s.e).join(',') || info.atom.dots !== s.e) bad.push('atom ' + JSON.stringify(info.atom)); }
  else if (s.k === 'cell') { const a = data.more.atoms[s.z - 1]; if (info.cell.z !== s.z || info.cell.sym !== a[1] || info.cell.ar !== a[3]) bad.push('cell'); }
  else if (s.k === 'app') { if (info.app !== s.id || info.shapes < 2 || !data.more.apps.some((a) => a[0] === s.id)) bad.push('app'); }
  else if (s.k === 'flow') { const f = data.more.flows.find((x) => x.id === q.meta.flow); if (JSON.stringify(info.steps) !== JSON.stringify(f.steps.map((x) => x.n))) bad.push('flow steps ' + info.steps); const sides = info.boxes.filter((b) => b[1]).map((b) => b[1]); if (JSON.stringify(sides) !== JSON.stringify(f.steps.filter((x) => x.residue).map((x) => x.residue))) bad.push('flow sides ' + sides); }
  ok(bad.length === 0, `figure of ${q.key} (${s.k}) reads back from the page ${bad.slice(0, 2)}`);
}
(async () => {
  // =====================================================================================  A. THE LIBRARY (data file)
  {
    const rx = data.reactions;
    ok(rx.length >= 150, `the library has ${rx.length} reactions (at least 150)`);
    ok(fs.statSync(DATA_FILE).size < 600 * 1024, `chem.json is ${(fs.statSync(DATA_FILE).size / 1024).toFixed(0)} KB (< 600 KB)`);
    ok(new Set(rx.map((r) => r.id)).size === rx.length, 'reaction ids are unique');
    const bad = rx.filter((r) => !atoms(sideOf(r.eq.split('=')[0])[0].f) || !r.eq.includes('=')).map((r) => r.id);
    const unparsable = rx.filter((r) => [...parseEq(r.eq).l, ...parseEq(r.eq).r].some((t) => !atoms(t.f))).map((r) => r.eq);
    ok(unparsable.length === 0 && bad.length === 0, 'every formula of every reaction parses: ' + unparsable.slice(0, 3));
    const unbal = rx.filter((r) => !balanced(r.eq)).map((r) => r.eq);
    ok(unbal.length === 0, `every reaction is balanced (independent atom count): ${unbal.slice(0, 3)}`);
    // the checker can fail: a wrong equation is found
    ok(!balanced('2H2+O2=3H2O') && !balanced('Fe+O2=Fe3O4') && balanced('3Fe+2O2=Fe3O4'), 'the independent counter finds unbalanced equations (control)');
    const lowest = rx.filter((r) => { const { l, r: rr } = parseEq(r.eq); return [...l, ...rr].map((t) => t.c).reduce(gcd, 0) !== 1; }).map((r) => r.eq);
    ok(lowest.length === 0, 'coefficients are in lowest terms: ' + lowest.slice(0, 3));
    const wrongType = rx.filter((r) => typeOf(r.eq) !== r.type).map((r) => `${r.eq}: ${r.type} vs ${typeOf(r.eq)}`);
    ok(wrongType.length === 0, `types agree with the structure: ${wrongType.slice(0, 3)}`);
    const tcount = {}; for (const r of rx) tcount[r.type] = (tcount[r.type] || 0) + 1;
    ok(['化合', '分解', '置换', '复分解', '其他'].every((t) => tcount[t] >= 10), 'every type has at least 10 reactions: ' + JSON.stringify(tcount));
    const norm = (r) => { const { l, r: rr } = parseEq(r.eq); const k = (s) => s.map((t) => t.f).sort().join('+'); return k(l) + '=' + k(rr); };
    ok(new Set(rx.map(norm)).size === rx.length, 'no reaction is listed twice');
    ok(rx.every((r) => r.ph && r.ph.length >= 6), 'every reaction has a phenomenon sentence');
    const CONDS = ['点燃', '加热', '通电', '高温', '催化剂', '常温', '光照'];
    ok(rx.every((r) => r.cond.length >= 1 && r.cond.every((c) => CONDS.includes(c))), 'conditions are among the known ones');
    ok(rx.every((r) => r.ch in data.chapters), 'every reaction belongs to a chapter');
    ok(Object.keys(data.chapters).every((c) => rx.filter((r) => r.ch === c).length >= 8), 'every chapter has at least 8 reactions');
    // gas arrows: a product that is a gas should be marked, never a reactant
    const arrows = rx.filter((r) => parseEq(r.eq).l.some((t) => t.mark)).map((r) => r.eq);
    ok(arrows.length === 0, 'no reactant carries an arrow');
    const lowerCase = rx.filter((r) => /[A-Z]{1}[a-z]{2}/.test(r.eq.replace(/[A-Z][a-z][A-Z]/g, ''))).length; void lowerCase;
    // the substances
    const missing = [...new Set(rx.flatMap((r) => [...parseEq(r.eq).l, ...parseEq(r.eq).r].map((t) => t.f)))].filter((f) => !SUBS.has(f));
    ok(missing.length === 0, 'every formula used in a reaction has a name: ' + missing.slice(0, 5));
    ok(new Set(data.subs.map((s) => s.f)).size === data.subs.length && new Set(data.subs.map((s) => s.n)).size === data.subs.length, 'formulas and names of the substances are unique');
    const catRules = { elem: (f) => isElement(f), oxide: (f) => { const a = atoms(f); return Object.keys(a).length === 2 && 'O' in a; }, acid: (f) => /^H/.test(f) || f === 'CH3COOH', base: (f) => /OH\)?\d*$/.test(f), salt: (f) => !/^H\d*[A-Z]/.test(f) || /^H[g]/.test(f), org: (f) => 'C' in atoms(f) && 'H' in atoms(f) };
    const badCat = data.subs.filter((s) => s.c !== 'other' && !catRules[s.c](s.f)).map((s) => `${s.f}:${s.c}`);
    ok(badCat.length === 0, 'categories of the substances fit their formulas: ' + badCat);
    ok(data.subs.every((s) => !['salt', 'oxide', 'base', 'acid'].includes(s.c) || ['Fe3O4', 'H2O2', 'CH3COOH', 'NH4NO3'].includes(s.f) || neutralPossible(s.f)), 'every acid / base / salt / oxide can be neutral with the usual valences: ' + data.subs.filter((s) => ['salt', 'oxide', 'base', 'acid'].includes(s.c) && !['Fe3O4', 'H2O2', 'CH3COOH', 'NH4NO3'].includes(s.f) && !neutralPossible(s.f)).map((s) => s.f));
    ok(Object.entries(AR).every(([e, m]) => data.elements.find((x) => x.s === e)?.ar === m), 'relative atomic masses of the library = the usual school values');
    ok(data.elements.every((e) => e.v.length >= 1 && e.v.every((v) => Number.isInteger(v) && v !== 0)), 'valences are non-zero whole numbers');
    ok(data.indicators.length === 2 && data.ph.length >= 12 && data.ph.every((p) => p.v >= 0 && p.v <= 14), 'indicators and pH values');
    // solubility table: complete and a few known entries (written here from the textbook table)
    const S = (an, cat) => data.ions.sol[an][data.ions.cat.indexOf(cat)];
    ok(data.ions.an.every((a) => data.ions.sol[a].length === data.ions.cat.length), 'solubility table is a full grid');
    ok(S('Cl', 'Ag') === 'i' && S('SO4', 'Ba') === 'i' && S('CO3', 'Ca') === 'i' && S('OH', 'Cu') === 'i' && S('OH', 'Na') === 's' && S('NO3', 'Ag') === 's' && S('SO4', 'Ca') === 'm' && S('OH', 'Ca') === 'm' && S('Cl', 'Na') === 's' && S('OH', 'Fe3') === 'i', 'known cells of the solubility table (AgCl, BaSO4, CaCO3, Cu(OH)2, NaOH, AgNO3, CaSO4, Ca(OH)2 ...)');
    ok(data.ions.an.every((a) => data.ions.cat.every((c) => 'sivm-'.includes(S(a, c)) || S(a, c) === 'v')), 'table cells are s, i, m, v or -');
    ok(SERIES.slice(0, 5).join() === data.activity.slice(0, 5).join() && data.activity.join('') === SERIES.join(''), 'the activity series is K Ca Na Mg Al Zn Fe Sn Pb H Cu Hg Ag Pt Au');
    const kn = data.solub.d.find((d) => d.f === 'KNO3').v;
    ok(kn.every((v, i) => i === 0 || v > kn[i - 1]) && data.solub.d.find((d) => d.f === 'Ca(OH)2').v.every((v, i, a) => i === 0 || v < a[i - 1]), 'KNO3 solubility rises with temperature, Ca(OH)2 falls');
    ok(data.gases.length === 3 && data.gases.every((g) => g.rx.every((e) => rx.some((r) => r.eq === e) && g.gen[e])), 'the three gases point at reactions of the library');
  }

  // =====================================================================================  B. THE LOGIC in the browser (real modules), checked with the independent helpers
  const t0 = await open();
  const P0 = t0.page;
  const MODES = ['bal', 'wr', 'val', 'type', 'calc', 'sol', 'dec', 'act', 'cls', 'ind', 'gas'];
  const R = await makeRounds(P0, MODES, 300);
  ok(MODES.every((m) => R[m].length >= 2900), `3000 questions made for every mode (${MODES.map((m) => R[m].length)})`);
  // --- every choice question: right index valid, choices distinct, one right
  {
    const bad = [];
    for (const m of MODES) for (const q of R[m]) if (q.t === 'choice') { const keys = q.choices.map(keyOf); if (new Set(keys).size !== keys.length || q.right < 0 || q.right >= q.choices.length || q.choices.length < 2) bad.push(`${m}/${q.kind}`); }
    ok(bad.length === 0, 'choices are distinct and the right one exists in all choice questions: ' + [...new Set(bad)]);
    ok(MODES.every((m) => R[m].every((q) => q.stem.length && q.expl.length)), 'every question has a stem and an explanation');
  }
  // --- balance / write: one per reaction, the library gives the solution; lowest terms; never twice in a row
  {
    const solved = R.bal.filter((q) => { const r = data.reactions.find((x) => x.id === q.rx); return r && balanced(r.eq); });
    ok(solved.length === R.bal.length, 'balance questions: every solution is balanced');
    const keys = new Set(R.bal.map((q) => q.rx)); ok(keys.size >= data.reactions.length * 0.95, `balance questions cover the library (${keys.size} of ${data.reactions.length})`);
    const levels = [1, 2, 3].map((lv) => R.bal.filter((q) => q.lv === lv).length); ok(levels.every((n) => n > 100), 'balance levels 1 / 2 / 3 all occur: ' + levels);
    const tiny = (eq) => { const { l, r } = parseEq(eq); const cs = [...l, ...r].map((t) => t.c); return { mx: Math.max(...cs), n: cs.length }; };
    ok(R.bal.filter((q) => q.lv === 1).every((q) => { const x = tiny(data.reactions.find((r) => r.id === q.rx).eq); return x.mx <= 2 && x.n <= 3; }), 'level 1 equations are small (coefficients <= 2, <= 3 substances)');
    const wr = R.wr; ok(wr.every((q) => q.tiles.length >= 6 && q.desc.length > 8), 'write questions: tiles (the formulas + distractors) and a sentence');
    ok(wr.every((q) => { const r = data.reactions.find((x) => x.id === q.rx); const need = [...parseEq(r.eq).l, ...parseEq(r.eq).r].map((t) => t.f); return need.every((f) => q.tiles.includes(f)) && new Set(q.tiles).size === q.tiles.length; }), 'every needed formula is among the tiles, no tile twice');
    ok(wr.every((q) => { const r = data.reactions.find((x) => x.id === q.rx); return [...parseEq(r.eq).l, ...parseEq(r.eq).r].every((t) => q.desc.includes(SUBS.get(t.f).n)); }), 'the sentence names every substance');
    const avoid = await P0.evaluate(async () => { const C = await import('/src/chemlogic.ts'); const bad = []; for (let s = 1; s <= 200; s++) { const first = C.buildRound('bal', 0, s, C.EMPTY_PROGRESS, '2026-11-13', 10)[0]; const again = C.buildRound('bal', 0, s + 500, C.EMPTY_PROGRESS, '2026-11-13', 10, first.rx); if (again.some((q) => q.rx === first.rx)) bad.push(s); } return bad.length; });
    ok(avoid === 0, 'the equation just asked is never asked first again (200 seeds)');
    const dup = await P0.evaluate(async () => { const C = await import('/src/chemlogic.ts'); let n = 0; for (let s = 1; s <= 100; s++) for (const m of ['bal', 'wr', 'type', 'calc']) { const ids = C.buildRound(m, 0, s, C.EMPTY_PROGRESS, '2026-11-13').map((q) => q.key); if (new Set(ids).size !== ids.length || ids.length !== 10) n++; } return n; });
    ok(dup === 0, 'a round of 10 has 10 different items in the item-based modes');
  }
  // --- valences
  {
    const val = R.val; const kinds = new Set(val.map((q) => q.kind)); ok(['cross', 'find', 'n2f', 'f2n', 'mr', 'pct'].every((k) => kinds.has(k)), 'valence mode mixes six kinds: ' + [...kinds]);
    let nCross = 0, bad = [];
    for (const q of val.filter((x) => x.kind === 'cross' || (x.t === 'choice' && x.meta))) {
      nCross++;
      const { cat, an } = q.meta; const right = q.choices[q.right][0].f;
      const rg = new RegExp('^(?:\\(' + cat.f + '\\)|' + cat.f + ')(\\d*)(?:\\(' + an.f + '\\)|' + an.f + ')(\\d*)$');
      const m = rg.exec(right); if (!m) { bad.push('form ' + right); continue; }
      const a = m[1] ? +m[1] : 1, b = m[2] ? +m[2] : 1;
      if (cat.ch * a + an.ch * b !== 0 || gcd(a, b) !== 1) bad.push('neutral ' + right);
      if (right !== crossF(cat.f, cat.ch, an.f, -an.ch)) bad.push('cross ' + right);
      for (const [i, c] of q.choices.entries()) {
        if (i === q.right) continue; const w = c[0].f; const mw = rg.exec(w);
        const asRight = mw && cat.ch * (mw[1] ? +mw[1] : 1) + an.ch * (mw[2] ? +mw[2] : 1) === 0 && gcd(mw[1] ? +mw[1] : 1, mw[2] ? +mw[2] : 1) === 1 && w === right;
        if (w === right || asRight) bad.push('distractor is right ' + w);
        if (!/^[\w()]+$/.test(w)) bad.push('shape ' + w);
      }
    }
    ok(nCross > 300 && bad.length === 0, `cross method: ${nCross} questions: the answer is neutral and in lowest terms, no distractor is right ${bad.slice(0, 3)}`);
    // find the valence
    let nf = 0; bad = [];
    for (const q of val.filter((x) => x.kind === 'find')) {
      nf++;
      const m = /^求 (\w+) 在 (\S+) 中的化合价/.exec(unsub(q.stem[0])); if (!m) { bad.push('stem ' + q.stem[0]); continue; }
      const [, el, f] = m; const a = atoms(f); const others = Object.entries(a).filter(([e]) => e !== el);
      // independent solving: unique integer in the allowed list making the compound neutral with the fixed valences and the groups
      const groupsIn = [['SO4', -2], ['NO3', -1], ['CO3', -2], ['OH', -1], ['NH4', 1], ['HCO3', -1]];
      let sum = 0, rest = { ...a };
      let unknown = others.filter(([e]) => !(e in VAL) && !(e === 'Cl' && !('O' in a)));
      if (unknown.length) for (const [g, ch] of groupsIn) { if (!f.includes(g) || atoms(g)[el]) continue; const ga = atoms(g); const k = Math.min(...Object.entries(ga).map(([e, n]) => Math.floor((rest[e] || 0) / n))); if (k > 0) { for (const [e, n] of Object.entries(ga)) rest[e] -= n * k; sum += ch * k; } }
      for (const [e, n] of Object.entries(rest)) if (n > 0 && e !== el) { if (e in VAL) sum += VAL[e] * n; else if (e === 'Cl' && !('O' in a)) sum -= n; else bad.push('unknown ' + e + ' in ' + f); }
      const v = -sum / rest[el];
      const shown = q.choices[q.right][0].f;
      if (+shown !== v || !ALLOWED[el].includes(v)) bad.push(`${f} ${el}: ${shown} vs ${v}`);
    }
    ok(nf > 300 && bad.length === 0, `valence of an element in a compound: ${nf} questions re-solved independently ${bad.slice(0, 3)}`);
    // names <-> formulas, masses
    bad = [];
    for (const q of val.filter((x) => x.kind === 'n2f' || x.kind === 'f2n')) {
      if (q.kind === 'n2f') { const nm = q.stem[1].u; const s = data.subs.find((x) => x.n === nm); if (!s || q.choices[q.right][0].f !== s.f) bad.push(nm); }
      else { const f = unsub(q.stem[0]).replace('下列化学式表示的物质是：', ''); const s = SUBS.get(f); if (!s || q.choices[q.right][0].u !== s.n) bad.push(f); }
    }
    ok(bad.length === 0, 'name <-> formula questions agree with the table of substances ' + bad.slice(0, 3));
    bad = []; let nm = 0;
    for (const q of val.filter((x) => x.kind === 'mr' || x.kind === 'pct')) {
      nm++;
      if (q.kind === 'mr') { const f = unsub(q.stem[0]).replace('计算相对分子质量：', ''); if (Math.abs(q.steps[0].answer - mass(f)) > 1e-9) bad.push(f); }
      else { const m = /计算 (\S+) 中 (\w+) 元素/.exec(unsub(q.stem[0])); const f = m[1], e = m[2]; const exp = +(AR[e] * atoms(f)[e] / mass(f) * 100).toFixed(1); if (Math.abs(q.steps[0].answer - exp) > 1e-9) bad.push(f + e); }
      if (!(q.els || []).length) bad.push('no atomic masses shown');
    }
    ok(nm > 300 && bad.length === 0, `relative molecular masses / mass fractions: ${nm} questions recomputed independently ${bad.slice(0, 3)}`);
  }
  // --- types, conditions, phenomena
  {
    const ty = R.type; const kinds = new Set(ty.map((q) => q.kind)); ok(['type', 'pick', 'cond', 'ph'].every((k) => kinds.has(k)), 'reaction mode mixes four kinds: ' + [...kinds]);
    const names = { 化合反应: '化合', 分解反应: '分解', 置换反应: '置换', 复分解反应: '复分解', 其他反应: '其他' }; const bad = [];
    for (const q of ty) {
      const id = q.key.split(':')[1]; const r = data.reactions.find((x) => x.id === id);
      if (q.kind === 'type') { const got = names[q.choices[q.right][0]]; if (got !== typeOf(r.eq)) bad.push('type ' + id); }
      else if (q.kind === 'pick') { const asked = names[/属于(\S+)的是/.exec(q.stem[0])[1]]; const eqs = q.choices.map((c) => data.reactions.find((x) => x.id === c[0].eq)); if (typeOf(eqs[q.right].eq) !== asked) bad.push('pick right ' + id); eqs.forEach((e, i) => { if (i !== q.right && typeOf(e.eq) === asked) bad.push('pick wrong ' + id); }); }
      else if (q.kind === 'cond') { const right = q.choices[q.right].filter((p) => typeof p === 'string'); if (right.join() !== r.cond.join()) bad.push('cond ' + id); q.choices.forEach((c, i) => { if (i !== q.right && c.filter((p) => typeof p === 'string').some((t) => r.cond.includes(t))) bad.push('cond wrong shares ' + id); }); }
      else { if (q.choices[q.right][0].u !== r.ph) bad.push('ph ' + id); q.choices.forEach((c, i) => { if (i !== q.right && c[0].u === r.ph) bad.push('ph same'); }); }
    }
    ok(bad.length === 0, `type / pick / condition / phenomenon questions agree with the library (${ty.length}) ${bad.slice(0, 3)}`);
    const phKeys = data.phKeys; const share = [];
    for (const q of ty.filter((x) => x.kind === 'ph')) { const mine = phKeys.filter((k) => q.choices[q.right][0].u.includes(k)); q.choices.forEach((c, i) => { if (i !== q.right && phKeys.some((k) => c[0].u.includes(k) && mine.includes(k))) share.push(q.key); }); }
    ok(share.length === 0, 'phenomenon distractors share no colour / smell / gas keyword with the right one');
  }
  // --- calculation by the equation
  {
    const bad = []; let n = 0;
    for (const q of R.calc) {
      n++; const m = q.meta; const r = data.reactions.find((x) => x.id === m.rx); const { l, r: rr } = parseEq(r.eq); const all = [...l, ...rr];
      const a = all.find((t) => t.f === m.a), b = all.find((t) => t.f === m.b);
      if (!a || !b || a.c !== m.ac || b.c !== m.bc || m.a === m.b) { bad.push('species ' + m.rx); continue; }
      const wa = a.c * mass(a.f), wb = b.c * mass(b.f); const ans = m.given * wb / wa;
      if (Math.abs(ans - m.ans) > 1e-6 || Math.abs(q.steps[2].answer - ans) > 1e-6) bad.push(`ans ${m.rx} ${ans} ${m.ans}`);
      if (Math.abs(q.steps[0].answer - wa) > 1e-9 || Math.abs(q.steps[1].answer - wb) > 1e-9) bad.push('steps ' + m.rx);
      if (!(q.steps[2].tol >= 0.05) || q.steps[2].tol > 0.011 * ans + 0.05) bad.push('tolerance ' + m.rx);
      if (m.given < 1 || m.given > 500 || ans < 0.1 || ans > 500 || !Number.isFinite(ans)) bad.push('range ' + m.rx);
      const st = unsub(q.stem[2]); if (!st.includes(a.f) || !st.includes(String(m.given)) || !st.includes(b.f)) bad.push('stem ' + m.rx);
      if (!(q.els || []).every((e) => e in AR)) bad.push('els');
    }
    ok(n > 2900 && bad.length === 0, `calculation questions: ${n} answers, steps and ranges recomputed independently ${bad.slice(0, 3)}`);
    ok(new Set(R.calc.map((q) => q.meta.rx)).size > 100, 'calculation questions use more than 100 different reactions');
  }
  // --- solutions
  {
    const sol = R.sol; const kinds = new Set(sol.map((q) => q.kind)); ok(['frac', 'prep', 'dilute', 'read', 'sat', 'satfrac'].every((k) => kinds.has(k)), 'solution mode mixes six kinds: ' + [...kinds]);
    const bad = []; const T = data.solub.T; const tab = Object.fromEntries(data.solub.d.map((d) => [d.f, d.v]));
    for (const q of sol) {
      const m = q.meta;
      if (q.kind === 'frac') { if (Math.abs(m.solute / (m.solute + m.water) * 100 - q.steps[0].answer) > 1e-9) bad.push('frac'); }
      else if (q.kind === 'prep') { const ans = m.askWater ? m.total - m.total * m.p / 100 : m.total * m.p / 100; if (Math.abs(q.steps[0].answer - ans) > 1e-9) bad.push('prep'); }
      else if (q.kind === 'dilute') { const ans = m.a * m.p / m.q - m.a; if (Math.abs(q.steps[0].answer - ans) > 1e-9 || !Number.isInteger(ans)) bad.push('dilute'); }
      else if (q.kind === 'satfrac') { const exp = +(tab[m.f][T.indexOf(m.T)] / (100 + tab[m.f][T.indexOf(m.T)]) * 100).toFixed(1); if (Math.abs(q.steps[0].answer - exp) > 1e-9) bad.push('satfrac'); }
      else if (q.kind === 'read') { const mm = /^(\d+) ℃时，下表中 (\S+) 的溶解度/.exec(unsub(q.stem[0])); const S = tab[mm[2]][T.indexOf(+mm[1])]; if (+q.choices[q.right][0].f !== S) bad.push('read'); q.choices.forEach((c, i) => { if (i !== q.right && +c[0].f === S) bad.push('read dup'); }); if (!q.tbl || q.tbl.rows.length !== 6) bad.push('read table'); }
      else if (q.kind === 'sat') { const mm = /^(\d+) ℃时，把 (\d+) g (\S+) 加入/.exec(unsub(q.stem[0])); const S = tab[mm[3]][T.indexOf(+mm[1])]; const sat = +mm[2] > S; if (+mm[2] === S) bad.push('sat equal'); const right = q.choices[q.right][0]; if ((right === '饱和溶液，有固体剩余') !== sat) bad.push('sat'); }
    }
    ok(bad.length === 0, `solution questions recomputed independently (${sol.length}) ${bad.slice(0, 3)}`);
    ok(sol.filter((q) => q.kind === 'sat').some((q) => q.choices[q.right][0] === '不饱和溶液') && sol.filter((q) => q.kind === 'sat').some((q) => q.choices[q.right][0] !== '不饱和溶液'), 'saturated and unsaturated both occur');
  }
  // --- the judge for double displacement against the independent rules, on EVERY pair
  {
    const cm = allCmps();
    const res = await P0.evaluate(async (cm) => { const C = await import('/src/chemlogic.ts'); const out = []; for (const a of cm) for (const b of cm) { const m = C.metathesis(a, b); out.push([m.happens, m.reasons, m.ambiguous]); } return out; }, cm);
    let i = 0, bad = [], n = 0, amb = 0, yes = 0;
    for (const a of cm) for (const b of cm) {
      const e = refMeta(a, b); const g = res[i++]; n++;
      if (e.ambiguous) amb++; if (e.happens && !e.ambiguous) yes++;
      if (g[0] !== e.happens || g[2] !== e.ambiguous || JSON.stringify([...g[1]].sort()) !== JSON.stringify([...e.reasons].sort())) bad.push(`${a.cat}${a.an}+${b.cat}${b.an}: ${g} vs ${e.happens} ${e.reasons} ${e.ambiguous}`);
    }
    ok(n > 3000 && bad.length === 0, `复分解 judge = independent rules on all ${n} ordered pairs of the solubility table ${bad.slice(0, 3)}`);
    ok(yes > 200 && amb > 100 && amb < n / 2, `the pairs include many reactions (${yes}) and some ambiguous ones (${amb}) that are never asked`);
    // known textbook answers
    const kn = (a, b) => res[cm.findIndex((c) => c.cat === a[0] && c.an === a[1]) * cm.length + cm.findIndex((c) => c.cat === b[0] && c.an === b[1])];
    ok(kn(['Ba', 'Cl'], ['Na', 'SO4'])[0] === true && kn(['Na', 'Cl'], ['K', 'NO3'])[0] === false && kn(['Na', 'OH'], ['Cu', 'SO4'])[0] === true && kn(['H', 'Cl'], ['Na', 'CO3'])[0] === true && kn(['Ag', 'Cl'], ['H', 'NO3'])[0] === false && kn(['Na', 'OH'], ['NH4', 'Cl'])[0] === true && kn(['H', 'Cl'], ['Na', 'OH'])[0] === true && kn(['H', 'Cl'], ['H', 'SO4'])[0] === false, 'textbook cases: BaCl2+Na2SO4 yes, NaCl+KNO3 no, NaOH+CuSO4 yes, HCl+Na2CO3 yes, AgCl+HNO3 no, NaOH+NH4Cl yes, HCl+NaOH yes, HCl+H2SO4 no');
    // generated questions
    const dec = R.dec; const bad2 = [];
    const decKinds = { '能反应，生成沉淀': 'precipitate', '能反应，生成气体': 'gas', '能反应，生成水': 'water' };
    for (const q of dec) {
      const fm = /^(\S+) \+ (\S+)$/.exec(q.stem[1].f); const find = (f) => cm.find((c) => { const idx = res; void idx; return false; }); void find;
      const right = q.choices[q.right][0];
      const key = q.key.replace('dec:', '').split('+');
      const pairs = cm.flatMap((a) => cm.map((b) => [a, b])).filter(([a, b]) => { const fa = formulaOfCmp(a), fb = formulaOfCmp(b); return (fa === fm[1] && fb === fm[2]); });
      if (!pairs.length) { bad2.push('pair ' + q.key); continue; }
      const e = refMeta(pairs[0][0], pairs[0][1]);
      if (e.ambiguous || e.reasons.length > 1) bad2.push('ambiguous asked ' + q.key);
      if (e.happens ? decKinds[right] !== e.reasons[0] : right !== '不能反应') bad2.push('answer ' + q.key);
      void key;
    }
    { // verification E1: a slightly soluble product (CaSO4, Ag2SO4, MgCO3, Ca(OH)2) is never asked: the stem pair, read from the solubility table, must not make one
      const SLIGHT = ['CaSO4', 'Ag2SO4', 'MgCO3', 'Ca(OH)2']; let n = 0;
      for (const q of dec) { const fm = /^(\S+) \+ (\S+)$/.exec(q.stem[1].f); if (!fm) continue; const pr = (q.expl.find((e) => e && e.f && /\+|→/.test(e.f)) || { f: '' }).f; if (q.choices[q.right][0] !== '不能反应' && SLIGHT.some((x) => pr.split(' + ').includes(x))) n++; }
      ok(n === 0 && dec.length > 2900, `no generated 复分解 question has a slightly soluble product (${dec.length} questions, ${n} bad)`);
      const kn2 = (a, b) => res[cm.findIndex((c) => c.cat === a[0] && c.an === a[1]) * cm.length + cm.findIndex((c) => c.cat === b[0] && c.an === b[1])];
      ok([[['Na', 'OH'], ['Ca', 'Cl']], [['Ca', 'OH'], ['Na', 'SO4']], [['Ca', 'Cl'], ['Na', 'SO4']], [['Ag', 'NO3'], ['Na', 'SO4']], [['Mg', 'Cl'], ['Na', 'CO3']], [['H', 'SO4'], ['Ca', 'NO3']]].every(([a, b]) => kn2(a, b)[2] === true), 'the judge marks the 46-pair family of the report (NaOH+CaCl2, Ca(OH)2+Na2SO4, CaCl2+Na2SO4, AgNO3+Na2SO4, MgCl2+Na2CO3, H2SO4+Ca(NO3)2) as ambiguous');
    }
    ok(dec.length > 2900 && bad2.length === 0, `generated 复分解 questions: answer = independent rule, no ambiguous pair asked (${dec.length}) ${bad2.slice(0, 3)}`);
    const yesShare = dec.filter((q) => q.choices[q.right][0] !== '不能反应').length / dec.length; ok(yesShare > 0.35 && yesShare < 0.65, `about half of the questions are "yes" (${(yesShare * 100).toFixed(0)} %)`);
    function formulaOfCmp(c) { const ch = CHARGE[c.cat], ac = -CHARGE[c.an]; const cf = { Fe2: 'Fe', Fe3: 'Fe' }[c.cat] || c.cat; return crossF(cf, ch, c.an, ac); }
  }
  // --- metal activity
  {
    const act = R.act; const bad = []; const idx = (s) => SERIES.indexOf(s);
    const kinds = new Set(act.map((q) => q.kind)); ok(['acid', 'salt', 'notreact', 'order'].every((k) => kinds.has(k)), 'activity mode mixes four kinds: ' + [...kinds]);
    const fix = (s) => unsub(s);
    for (const q of act) {
      const right = q.choices[q.right][0];
      if (q.kind === 'order') { const four = q.choices.map((c) => c[0].f); const most = /最强/.test(q.stem[0]); const sorted = [...four].sort((a, b) => idx(a) - idx(b)); if (q.choices[q.right][0].f !== (most ? sorted[0] : sorted[3])) bad.push('order'); }
      else if (q.kind === 'notreact') { const reacts = (s) => idx(s) < idx('H'); const asked = q.choices.map((c) => c[0].f); const nots = asked.filter((s) => !reacts(s)); if (nots.length !== 1 || nots[0] !== q.choices[q.right][0].f) bad.push('notreact'); }
      else if (q.kind === 'acid') {
        const m = /^(\w+) 与稀(盐酸|硫酸)混合/.exec(q.stem[0]); const metal = m[1], an = m[2] === '盐酸' ? ANIONS.Cl : ANIONS.SO4; const reacts = idx(metal) < idx('H');
        const salt = crossF(metal, METAL_CH[metal], an[0], an[1]);
        if (reacts) { if (right !== `能反应，生成 ${salt} 和 H2`.replace(/([A-Za-z)])(\d)/g, (_, a, d) => a + SUBD[+d])) bad.push('acid yes ' + metal + right); }
        else if (right !== '不能反应') bad.push('acid no ' + metal);
        q.choices.forEach((c, i) => { if (i !== q.right && c[0] === right) bad.push('dup'); });
      } else {
        const m = /^(\w+) 放入 (\S+) 溶液中/.exec(fix(q.stem[0])); const metal = m[1], saltF = m[2]; const sm = Object.keys(atoms(saltF)).find((e) => e in METAL_CH); const reacts = idx(metal) < idx(sm);
        const sub = (s) => s.replace(/(\w)(\d)/g, (_, a, d) => a + SUBD[+d]);
        const anE = saltF.includes('SO4') ? ANIONS.SO4 : saltF.includes('NO3') ? ANIONS.NO3 : ANIONS.Cl;
        const prod = crossF(metal, METAL_CH[metal], anE[0], anE[1]);
        if (reacts) { if (fix(right) !== `能反应，生成 ${prod} 和 ${sm}`) bad.push(`salt yes ${metal} ${saltF} ${fix(right)}`); } else if (right !== '不能反应') bad.push(`salt no ${metal} ${saltF}`);
        void sub;
      }
    }
    ok(bad.length === 0, `metal activity questions agree with the series and the cross method (${act.length}) ${bad.slice(0, 3)}`);
    const yesShare = act.filter((q) => q.kind === 'salt' || q.kind === 'acid').filter((q) => q.choices[q.right][0] !== '不能反应').length / act.filter((q) => q.kind === 'salt' || q.kind === 'acid').length; ok(yesShare > 0.3 && yesShare < 0.8, `reacting and not reacting both occur (${(yesShare * 100).toFixed(0)} % yes)`);
  }
  // --- classification, indicators, gases
  {
    const rule = (f) => { const a = atoms(f); const els = Object.keys(a); if (els.length === 1) return 'elem'; if (SUBS.get(f).c === 'org') return 'org'; if (els.length === 2 && 'O' in a) return 'oxide'; if (/^H\d*[A-Z(]/.test(f) && !/\)/.test(f.replace(/^H\d*/, '')) && f !== 'H2O2' || f === 'CH3COOH') return 'acid'; if (/OH\)?\d*$/.test(f) && !/^NH4/.test(f)) return 'base'; return 'salt'; };
    const mism = data.subs.filter((s) => s.c !== 'other' && rule(s.f) !== s.c).map((s) => `${s.f}:${s.c}/${rule(s.f)}`);
    ok(mism.length === 0, 'substance categories agree with the rules on the formula: ' + mism);
    const cls3 = (await makeRounds(P0, ['cls'], 100, 3)).cls; const cls = R.cls.concat(cls3); const seenCats = new Set();
    for (const q of cls) for (const it of q.items) seenCats.add(it.cat);
    ok(cls.every((q) => q.items.length === 8 && new Set(q.items.map((i) => i.id)).size === 8 && q.items.every((i) => q.buckets.includes(i.cat))), 'classification: 8 different items, every item has a bucket in the question');
    ok(['elem', 'oxide', 'acid', 'base', 'salt', 'mix', 'org'].every((c) => seenCats.has(c)), 'all 7 classes occur: ' + [...seenCats]);
    ok(cls.every((q) => q.buckets.length >= 4 && q.buckets.every((b) => q.items.some((i) => i.cat === b))), 'every bucket shown receives at least one item');
    const lv1 = await makeRounds(P0, ['cls'], 40, 1); ok(lv1.cls.every((q) => !q.buckets.includes('mix') && !q.buckets.includes('org')), 'level 1 classification has no mixtures or organic compounds');
    const ind = R.ind; const bad = [];
    for (const q of ind) {
      if (q.kind === 'acidity') { const mm = /约为 ([\d.]+)/.exec(q.stem[1]); const v = +mm[1]; const exp = v < 7 ? '酸性' : v > 7 ? '碱性' : '中性'; if (q.choices[q.right][0] !== exp) bad.push('acidity ' + v); }
      if (q.kind === 'red') { const nm = q.choices[q.right][0].u; const p = data.ph.find((x) => x.n === nm); if (!(p.v > 7)) bad.push('red'); q.choices.forEach((c, i) => { if (i !== q.right && !(data.ph.find((x) => x.n === c[0].u).v <= 7)) bad.push('red wrong'); }); }
      if (q.kind === 'more') { const vs = q.choices.map((c) => data.ph.find((x) => x.n === c[0].u).v); const acid = /酸性最强/.test(q.stem[0]); const best = acid ? Math.min(...vs) : Math.max(...vs); if (vs[q.right] !== best || vs.filter((v) => v === best).length !== 1) bad.push('more'); }
      if (q.kind === 'color') { const mm = /遇到(酸性|中性|碱性)/.exec(q.stem[1]); const med = { 酸性: 'acid', 中性: 'neutral', 碱性: 'base' }[mm[1]]; const i = data.indicators.find((x) => x.n === q.stem[0].u); if (q.choices[q.right][0] !== i[med]) bad.push('color'); }
    }
    ok(bad.length === 0, `indicator and pH questions agree with the table (${ind.length}) ${bad.slice(0, 3)}`);
    const gas = R.gas; const bad2 = [];
    for (const q of gas) {
      const g = data.gases.find((x) => x.f === (/(O2|H2|CO2)/.exec(unsub(q.stem[0]).replace(/₂/g, '2')) || [])[1] || x.f === (/(O|H|CO)(\d)?/.exec(q.stem[0]) || [])[0]);
      void g;
    }
    for (const q of gas) {
      const text = unsub(q.stem[0]); const gf = /(?:制取|收集较纯净的|收集较干燥的|收集|检验|证明) (\w+)/.exec(text)?.[1]; const g = data.gases.find((x) => x.f === gf);
      if (!g) { bad2.push('gas ' + text); continue; }
      if (q.kind === 'gen') { const eq = data.reactions.find((r) => r.id === q.stem[1].eq).eq; if (q.choices[q.right][0] !== g.gen[eq]) bad2.push('gen ' + eq); if (!g.rx.includes(eq)) bad2.push('gen eq'); }
      if (q.kind === 'col') { const dry = /较干燥/.test(text), pure = /较纯净/.test(text); const exp = pure ? 'C' : dry ? (g.col.includes('E') ? 'E' : 'D') : 'D'; if (q.choices[q.right][0] !== exp || !g.col.includes(exp)) bad2.push('col ' + gf); if (gf === 'CO2' && q.choices[q.right][0] !== 'D') bad2.push('co2'); }
      if (q.kind === 'test') { if (q.choices[q.right][0].u !== g.test) bad2.push('test'); }
      if (q.kind === 'full') { if (q.choices[q.right][0].u !== g.full) bad2.push('full'); }
      if (q.kind === 'react') { const names = g.rx.map((e) => parseEq(e).l.map((t) => SUBS.get(t.f).n).join('和')); if (!names.includes(q.choices[q.right][0].u)) bad2.push('react'); q.choices.forEach((c, i) => { if (i !== q.right && names.includes(c[0].u)) bad2.push('react wrong'); }); }
    }
    ok(bad2.length === 0, `gas questions agree with the table (${gas.length}) ${bad2.slice(0, 3)}`);
    ok(new Set(gas.map((q) => q.kind)).size === 5 && gas.filter((q) => q.fig).every((q) => (q.kind === 'gen' && q.fig === 'AB') || (q.kind === 'col' && q.fig === 'CDE')), 'five gas kinds; the generator question shows A / B, the collection question C / D / E');
  }
  // --- memory boxes and the choice of items
  {
    const r = await P0.evaluate(async () => {
      const C = await import('/src/chemlogic.ts'); await C.loadChem(); const today = '2026-11-13';
      let p = { cards: {}, plays: 0, lv: 0 };
      p = C.applyAnswers(p, [{ key: 'bal:r001', right: true }], today);
      const a = JSON.parse(JSON.stringify(p.cards['bal:r001']));
      p = C.applyAnswers(p, [{ key: 'bal:r001', right: false }], today);
      const b = JSON.parse(JSON.stringify(p.cards['bal:r001']));
      // 12 items: 3 wrong (due), 3 known (not due), 6 new: the round of 10 takes the 3 wrong and the 6 new first
      const ids = Array.from({ length: 12 }, (_, i) => 'r0' + String(i + 1).padStart(2, '0'));
      let q = { cards: {}, plays: 0, lv: 0 };
      q = C.applyAnswers(q, ids.slice(0, 3).map((id) => ({ key: 'bal:' + id, right: false })), today);
      q = C.applyAnswers(q, ids.slice(3, 6).map((id) => ({ key: 'bal:' + id, right: true })), today);
      const sel = C.selectIds(ids, (id) => 'bal:' + id, q, today, 10, C.rng(5));
      const done = C.applyAnswers(q, [], today, { score: 7, total: 10 });
      return { a, b, sel, wrongIn: ids.slice(0, 3).every((id) => sel.includes(id)), knownOut: ids.slice(3, 6).filter((id) => sel.includes(id)).length, last: done.last, plays: done.plays };
    });
    ok(r.a.box === 1 && r.a.right === 1 && r.b.box === 0 && r.b.wrong === 1, `memory box: right -> box 1, wrong -> box 0 (${r.a.box}, ${r.b.box})`);
    ok(r.sel.length === 10 && r.wrongIn && r.knownOut === 1, `a round takes the due (wrong) items first and the known ones last (${r.knownOut} of 3 known included)`);
    ok(r.last.score === 7 && r.plays === 1, 'a finished round is recorded (score, plays)');
  }
  // =====================================================================================  B2. PART 2: the new modes, every answer recomputed independently
  const NEW = ['curve', 'calc2', 'infer', 'rem', 'flow', 'lab', 'life', 'atom', 'prop'];
  const ALL = [...MODES, ...NEW];
  const R2 = await makeRounds(P0, NEW, 120);
  const MORE = data.more;
  ok(data.reactions.length === 157 && MORE && MORE.lab.length >= 30 && MORE.life.length >= 12 && MORE.prop.length >= 25 && MORE.apps.length === 10 && MORE.ord.length >= 12 && MORE.flows.length === 5 && MORE.atoms.length === 20, 'the part-2 data is in chem.json (banks, apparatus, ordering tasks, flows, atoms)');
  ok(NEW.every((m) => R2[m].length >= 1190), `1200 questions made for every new mode (${NEW.map((m) => R2[m].length)})`);
  // --- the data of part 2 (checked here on its own)
  {
    const banks = { lab: MORE.lab, life: MORE.life, prop: MORE.prop, atomqa: MORE.atomqa, flowqa: MORE.flowqa, remgas: MORE.remgas };
    const bad = [];
    for (const [n, b] of Object.entries(banks)) for (const q of b) { const all = [q.a, ...q.w]; if (new Set(all).size !== 4 || all.some((x) => !x) || !q.e || q.e.length < 8) bad.push(n + ':' + q.q); }
    ok(bad.length === 0, 'every written question has four different choices and an explanation ' + bad.slice(0, 2));
    ok(MORE.ord.every(([, steps]) => steps.length >= 4 && new Set(steps).size === steps.length), 'every ordering task has 4+ different steps');
    ok(new Set(MORE.uses.map((u) => u[2])).size === MORE.uses.length && new Set(MORE.apps.map((a) => a[2])).size === 10, 'the uses of the substances and the apparatus are all different phrases (one right answer each)');
    const items = [...MORE.foods, ...MORE.material].flatMap(([, xs]) => xs); ok(new Set(items).size === items.length, 'no food / material belongs to two classes');
    ok(MORE.atoms.every((a, i) => a[0] === i + 1 && AR[a[1]] !== undefined || ['He', 'Be', 'B', 'Ne', 'Ar'].includes(a[1])), 'the 20 atoms are numbered 1..20');
    ok(MORE.flows.every((f) => (f.steps || []).every((s) => !s.rx || data.reactions.some((r) => r.eq === s.rx && balanced(r.eq)))), 'every reaction named in a flow is in the library and balanced');
  }
  // --- helpers: the solubility table / mixing, written again from the table
  const catF = (k) => (k === 'Fe2' || k === 'Fe3' ? 'Fe' : k);
  const cmpFormula = (cat, an) => crossF(catF(cat), CHARGE[cat], an, -CHARGE[an]);
  const byFormula = new Map(); for (const an of data.ions.an) for (const cat of data.ions.cat) byFormula.set(cmpFormula(cat, an), { cat, an });
  const cm = (f) => { const c = byFormula.get(f); if (!c) throw new Error('unknown compound ' + f); return c; };
  const cellOf = (cat, an) => data.ions.sol[an][data.ions.cat.indexOf(cat)];
  const phase = (cat, an) => (cat === 'H' && an === 'OH' ? 'water' : (cat === 'NH4' && an === 'OH') || (cat === 'H' && an === 'CO3') ? 'gas' : 'ISM'.includes(cellOf(cat, an).toUpperCase()) && cellOf(cat, an) !== 's' && cellOf(cat, an) !== 'v' && cellOf(cat, an) !== '-' ? 'ppt' : 'sol');
  const slightP = (cat, an) => phase(cat, an) === 'ppt' && cellOf(cat, an) === 'm';
  /** observation of mixing two solutions (null = unclear and never asked) */
  const obsOf = (a, b) => {
    const e = refMeta(a, b); const ps = [{ cat: a.cat, an: b.an }, { cat: b.cat, an: a.an }];
    if (e.ambiguous || ps.some((p) => slightP(p.cat, p.an))) return null;
    if (!e.happens) return 'none';
    const ph = ps.map((p) => phase(p.cat, p.an)); return ph.includes('gas') ? 'gas' : ph.includes('ppt') ? 'ppt' : 'none';
  };
  const textP = (p) => textOf(p);
  const choiceTexts = (q) => q.choices.map((c) => textOf(c));
  const SUBSCR = (s) => unsub(s);
  const choiceFormula = (q, i) => q.choices[i][0].f;
  // --- the control: the independent mixing rule knows textbook facts
  ok(obsOf(cm('BaCl2'), cm('Na2SO4')) === 'ppt' && obsOf(cm('HCl'), cm('Na2CO3')) === 'gas' && obsOf(cm('NaCl'), cm('KNO3')) === 'none' && obsOf(cm('HCl'), cm('NaOH')) === 'none' && obsOf(cm('Na2CO3'), cm('CaCl2')) === 'ppt', 'independent mixing rule: textbook cases');

  // --- 溶解度曲线
  {
    const Tn = data.solub.T, S = (f, t) => data.solub.d.find((d) => d.f === f).v[Tn.indexOf(t)];
    const bad = []; const seen = {};
    for (const q of R2.curve) {
      seen[q.kind] = (seen[q.kind] || 0) + 1;
      const m = q.meta || {};
      if (q.kind === 'read') {
        const right = +q.choices[q.right][0].f; if (right !== S(m.s, m.T)) bad.push('read value'); if (!q.spec.subs.includes(m.s)) bad.push('read curve');
        q.choices.forEach((c, i) => { if (i !== q.right && (+c[0].f === right || Math.abs(+c[0].f - right) < 0.25 * right)) bad.push('read distractor too near ' + c[0].f + ' ' + right); });
        if (+/(\d+) ℃/.exec(q.stem[0])[1] !== m.T) bad.push('read stem T');
      } else if (q.kind === 'cmp') {
        const trio = q.spec.subs; const ord = trio.slice().sort((a, b) => S(b, m.T) - S(a, m.T)); const vals = ord.map((f) => S(f, m.T));
        if (choiceFormula(q, q.right) !== ord.join(' > ')) bad.push('cmp order'); if (vals[0] - vals[1] < 3 || vals[1] - vals[2] < 3) bad.push('cmp gap');
        q.choices.forEach((c, i) => { if (i !== q.right && c[0].f === ord.join(' > ')) bad.push('cmp same'); });
      } else if (q.kind === 'pt') {
        const mark = q.spec.marks[0]; const sat = S(m.s, mark.T); const r = q.choices[q.right][0];
        const want = mark.S < sat ? '不饱和溶液' : mark.S === sat ? '恰好饱和的溶液' : '饱和溶液，且有固体未溶解';
        if (r !== want) bad.push('pt ' + mark.S + ' vs ' + sat); if (mark.n !== 'P') bad.push('pt mark');
        if (!unsub(q.stem[0]).includes(`${mark.T} ℃`) || !unsub(q.stem[0]).includes(`${mark.S} g`)) bad.push('pt stem');
      } else if (q.kind === 'cool') {
        const ans = m.m * (S(m.s, m.T1) - S(m.s, m.T2)) / 100;
        if (Math.abs(q.steps[1].answer - ans) > 1e-6 || Math.abs(q.steps[0].answer - (S(m.s, m.T1) - S(m.s, m.T2))) > 1e-6 || !(m.T1 > m.T2)) bad.push('cool');
        const st = unsub(q.stem[0]); if (!st.includes(String(S(m.s, m.T1))) || !st.includes(String(S(m.s, m.T2)))) bad.push('cool stem values');
      } else if (q.kind === 'how' || q.kind === 'purify') {
        const slope = (f) => { const v = data.solub.d.find((d) => d.f === f).v; return v[5] < v[0] ? 'fall' : v[5] / v[1] >= 2.5 ? 'steep' : v[5] / v[1] <= 1.3 ? 'flat' : 'mid'; };
        if (q.kind === 'how') { const want = { steep: '降温结晶（冷却热饱和溶液）', flat: '蒸发结晶（蒸发溶剂）', fall: '升高温度' }[slope(m.s)]; if (!want || q.choices[q.right][0] !== want) bad.push('how ' + m.s); }
        else { const want = slope(m.a) === 'steep' && slope(m.b) === 'flat' ? '降温结晶（冷却热饱和溶液）' : slope(m.a) === 'flat' && slope(m.b) === 'steep' ? '蒸发结晶（蒸发溶剂）' : null; if (!want || q.choices[q.right][0] !== want) bad.push('purify ' + m.a + m.b); }
      } else if (q.kind === 'cross') {
        const ch = []; for (let k = 0; k < Tn.length - 1; k++) if ((S(m.a, Tn[k]) - S(m.b, Tn[k])) * (S(m.a, Tn[k + 1]) - S(m.b, Tn[k + 1])) < 0) ch.push(k);
        if (ch.length !== 1 || q.choices[q.right][0].u !== `${Tn[ch[0]]}～${Tn[ch[0] + 1]} ℃`) bad.push('cross ' + m.a + m.b);
      }
    }
    ok(['read', 'cmp', 'pt', 'cool', 'how', 'purify', 'cross'].every((k) => seen[k] > 20) && bad.length === 0, `solubility curves: ${R2.curve.length} questions (${JSON.stringify(seen)}) recomputed from the table ${bad.slice(0, 3)}`);
    ok(R2.curve.filter((q) => q.spec).every((q) => q.spec.k === 'curve' && q.spec.subs.length >= 1 && q.spec.subs.every((f) => data.solub.d.some((d) => d.f === f))), 'every curve question carries a figure of existing substances');
    // control: a wrong reading is caught
    const q0 = R2.curve.find((q) => q.kind === 'read'); ok(+q0.choices[(q0.right + 1) % 4][0].f !== S(q0.meta.s, q0.meta.T), 'control: a wrong choice is not the table value');
  }

  // --- 溶液: density, mixing, adding (sol, new kinds)
  {
    const bad = []; let n = 0;
    for (const q of R.sol.filter((x) => ['dens', 'mix', 'conc'].includes(x.kind))) {
      n++; const m = q.meta; const last = q.steps[q.steps.length - 1];
      if (q.kind === 'mix') { const ans = (m.a * m.p + m.b * m.q) / (m.a + m.b); if (Math.abs(ans - last.answer) > 1e-9 || Math.abs(ans * 10 - Math.round(ans * 10)) > 1e-9 || m.q <= m.p) bad.push('mix'); const st = unsub(q.stem[0]); if (!st.includes(`${m.a} g`) || !st.includes(`${m.b} g`) || !st.includes(`${m.p}%`) || !st.includes(`${m.q}%`)) bad.push('mix stem'); }
      else if (q.kind === 'conc') { const ans = m.add ? (m.a * m.p / 100 + m.x) / (m.a + m.x) * 100 : m.a * m.p / (m.a - m.w); if (Math.abs(ans - last.answer) > 1e-9 || m.p >= ans) bad.push('conc'); }
      else if (m.v === 'conc') { const V = m.M * m.p / m.P / m.d; if (Math.abs(V - last.answer) > 1e-9 || !(m.p < m.P)) bad.push('dens conc'); if (Math.abs(q.steps[0].answer - m.M * m.p / 100) > 1e-9) bad.push('dens solute'); }
      else if (m.v === 'solute') { const s = m.V * m.d * m.p / 100; if (Math.abs(s - last.answer) > 1e-9 || Math.abs(q.steps[0].answer - m.V * m.d) > 1e-9) bad.push('dens solute2'); }
      else if (m.v === 'water') { const p = +(m.x / (m.x + m.V) * 100).toFixed(1); if (Math.abs(p - last.answer) > 1e-9 || q.steps[0].answer !== m.V) bad.push('dens water'); }
    }
    ok(n > 800 && bad.length === 0, `solutions with density / mixing / adding: ${n} questions recomputed ${bad.slice(0, 3)}`);
    const dd = MORE.dens; ok(dd.every(([f, , p, d]) => p > 0 && p < 100 && d > 1 && d < 2 && SUBS.has(f)), 'the density table is in range (1 < d < 2, known solutes)');
    ok(MORE.gasd.every(([f, , d]) => Math.abs(d - mass(f) / 22.4) < 0.05), 'gas densities = Mr / 22.4 (standard conditions) within 0.05 g/L');
  }

  // --- 化学计算进阶
  {
    const bad = []; const seen = {};
    for (const q of R2.calc2) {
      const m = q.meta; seen[m.kind] = (seen[m.kind] || 0) + 1;
      const r = data.reactions.find((x) => x.id === m.rx); const { l, r: rr } = parseEq(r.eq); const all = [...l, ...rr];
      const T = (f) => all.find((t) => t.f === f); const W = (f) => T(f).c * mass(f);
      const near = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b)) + 1e-9;
      if (m.kind === 'gasv') { const gm = m.given * W(m.g) / W(m.a); const rho = { H2: 0.09, O2: 1.43, CO2: 1.98 }[m.g]; if (!near(q.steps[0].answer, gm) || !near(q.steps[1].answer, gm / rho) || m.rho !== rho || !rr.some((t) => t.f === m.g && t.mark === '↑')) bad.push('gasv ' + m.rx); if (!unsub(q.stem[2]).includes(`${rho} g/L`)) bad.push('gasv stem'); }
      else if (m.kind === 'pure') { const bm = m.w * m.p / 100 * W(m.b) / W(m.a); if (!near(q.steps[0].answer, m.w * m.p / 100) || !near(q.steps[1].answer, bm) || !l.some((t) => t.f === m.a) || !rr.some((t) => t.f === m.b)) bad.push('pure ' + m.rx); const st = unsub(q.stem[2]); if (!st.includes(`${+m.w.toFixed(2)} g`) || !st.includes(`${m.p}%`)) bad.push('pure stem'); }
      else if (m.kind === 'yield') { const th = m.given * W(m.b) / W(m.a); if (!near(q.steps[0].answer, th) || !near(q.steps[1].answer, th * m.y / 100) || !rr.some((t) => t.f === m.b) || !l.some((t) => t.f === m.a)) bad.push('yield ' + m.rx); }
      else if (m.kind === 'excess') { const need = m.given * W(m.b) / W(m.a); if (!near(q.steps[0].answer, need) || !near(q.steps[1].answer, m.B - need) || !(m.B > need) || !l.some((t) => t.f === m.a) || !l.some((t) => t.f === m.b) || m.a === m.b) bad.push('excess ' + m.rx); }
      else if (m.kind === 'loss') { if (/Hg/.test(m.a + m.rx) || m.rx === 'r010' || m.rx === 'r021') bad.push('loss residue is not a solid ' + m.rx); const gm = m.w - m.w2; const reactant = m.given; if (!near(q.steps[0].answer, gm) || !near(gm, m.given * W(m.g) / W(m.a)) || !near(q.steps[1].answer, reactant) || !near(q.steps[2].answer, reactant / m.w * 100) || l.length !== 1 || !(m.w2 < m.w) || !(m.p > 0 && m.p < 100)) bad.push('loss ' + m.rx); }
      else if (m.kind === 'sollast') { const sm = m.given * m.sc * mass(m.salt) / W(m.a); const cm2 = m.given * m.cc * 44 / W(m.a); const tot = m.given + m.W - cm2; if (!near(q.steps[0].answer, sm) || !near(q.steps[1].answer, cm2) || !near(q.steps[2].answer, sm / tot * 100) || !(m.W > m.given * T(m.acid).c * mass(m.acid) / W(m.a))) bad.push('sollast ' + m.rx); }
      for (const s of q.steps) if (!Number.isFinite(s.answer) || s.answer <= 0) bad.push('answer ' + m.kind);
      const dec = (x) => Math.abs(x * 100 - Math.round(x * 100)) < 1e-6;
      if (['gasv', 'pure', 'yield', 'excess', 'loss', 'sollast'].includes(m.kind) && ![m.given, m.w, m.w2, m.B, m.W].filter((x) => x !== undefined).every(dec)) bad.push('decimals ' + m.kind);
    }
    ok(Object.keys(seen).length === 6 && Object.values(seen).every((n) => n > 50) && bad.length === 0, `advanced calculations: ${R2.calc2.length} questions recomputed independently from the equation (${JSON.stringify(seen)}) ${bad.slice(0, 3)}`);
    ok(new Set(R2.calc2.map((q) => q.meta.rx)).size > 30, 'the advanced calculations use more than 30 different reactions');
    ok(R2.calc2.filter((q) => q.meta.kind === 'pure').every((q) => { const s = SUBS.get(q.meta.a); return s && ['salt', 'oxide', 'base', 'elem'].includes(s.c); }), 'a "sample" is always a solid substance (not an acid or a liquid)');
  }

  // --- 推断题
  {
    const bad = []; const seen = {};
    for (const q of R2.infer) {
      seen[q.kind] = (seen[q.kind] || 0) + 1; const m = q.meta;
      if (q.kind === 'mat') {
        const holds = m.assign.map(cm); const n = holds.length; let none = false;
        const tbl = holds.map((a, i) => holds.map((b, j) => (i === j ? '' : obsOf(a, b)))); if (tbl.flat().includes(null)) { bad.push('mat unclear pair'); continue; }
        const mark = { gas: '↑', ppt: '↓', none: '—' };
        const shown = q.tbl.rows.map((r) => r.slice(1)); if (JSON.stringify(shown) !== JSON.stringify(tbl.map((r) => r.map((x) => (x ? mark[x] : ''))))) bad.push('mat table');
        // every assignment tried: exactly one fits the table (the shown one)
        let cnt = 0; const idx = holds.map((_, i) => i);
        const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
        for (const p of perms(idx)) { let fit = true; for (let i = 0; i < n && fit; i++) for (let j = i + 1; j < n; j++) if (obsOf(holds[p[i]], holds[p[j]]) !== tbl[i][j]) { fit = false; break; } if (fit) cnt++; }
        if (cnt !== 1) bad.push('mat not unique ' + cnt);
        const asked = unsub(q.stem[0]).match(/([A-D]) 是：$/)[1]; if (m.letters.indexOf(asked) !== m.ask) bad.push('mat asked letter');
        if (choiceFormula(q, q.right) !== m.assign[m.ask]) bad.push('mat right'); if (new Set(q.choices.map((c) => c[0].f)).size !== n || !q.choices.every((c) => m.cands.includes(c[0].f))) bad.push('mat choices');
        if (tbl.flat().filter((x) => x && x !== 'none').length < 4) bad.push('mat too few reactions');
      } else if (q.kind === 'one') {
        const trio = m.trio.map(cm); const acid = (f) => (cm(f).cat === 'H' ? 'acid' : cm(f).an === 'OH' || cm(f).an === 'CO3' ? 'base' : 'neutral');
        const vec = (id) => { if (id === 'litmus') return m.trio.map(acid); if (id === 'phenol') return m.trio.map((f) => (acid(f) === 'base' ? 'red' : 'no')); if (m.trio.includes(id)) return null; return trio.map((t) => obsOf(cm(id), t)); };
        const textIds = q.choices.map((c) => (typeof c[0] === 'string' ? (c[0] === '紫色石蕊溶液' ? 'litmus' : 'phenol') : c[0].f));
        if ([...textIds].sort().join() !== [...m.choices].sort().join() || new Set(textIds).size !== 4) bad.push('one choices'); if (q.choices.length !== 4) bad.push('one 4');
        const rightId = textIds[q.right]; const valid = textIds.filter((id) => { const v = vec(id); return v && !v.includes(null) && new Set(v).size === 3; });
        if (valid.length !== 1 || valid[0] !== rightId) bad.push('one valid ' + valid); if (textIds.some((id) => { const v = vec(id); return !v || v.includes(null); })) bad.push('one unclear');
      } else {
        const COLOR = { Cu: '蓝', Fe3: '黄', Mg: '无', Na: '无' }, NAOH = { Cu: '蓝沉', Fe3: '红褐沉', Mg: '白沉', Na: '无' }, BACL = { SO4: '白沉', Cl: '无' };
        const cands = { CuCl2: ['Cu', 'Cl'], CuSO4: ['Cu', 'SO4'], FeCl3: ['Fe3', 'Cl'], 'Fe2(SO4)3': ['Fe3', 'SO4'], MgCl2: ['Mg', 'Cl'], MgSO4: ['Mg', 'SO4'], NaCl: ['Na', 'Cl'], Na2SO4: ['Na', 'SO4'] };
        const st = q.stem.filter((p) => typeof p === 'string').join('|'); const cons = [];
        if (st.includes('溶液呈蓝色')) cons.push((c) => COLOR[c[0]] === '蓝'); if (st.includes('溶液呈黄色')) cons.push((c) => COLOR[c[0]] === '黄'); if (st.includes('溶液是无色的')) cons.push((c) => COLOR[c[0]] === '无');
        const nm = /滴加氢氧化钠溶液，([^。|]*)。/.exec(st); if (nm) { const o = nm[1].includes('蓝色沉淀') ? '蓝沉' : nm[1].includes('红褐色沉淀') ? '红褐沉' : nm[1].includes('白色沉淀') ? '白沉' : '无'; cons.push((c) => NAOH[c[0]] === o); }
        const bm = /滴加氯化钡溶液，([^。|]*)。/.exec(st); if (bm) { const o = bm[1].includes('白色沉淀') ? '白沉' : '无'; cons.push((c) => BACL[c[1]] === o); }
        const fits = Object.entries(cands).filter(([, c]) => cons.every((f) => f(c))).map(([f]) => f);
        if (cons.length < 2 || fits.length !== 1 || fits[0] !== m.x || choiceFormula(q, q.right) !== m.x) bad.push('unk ' + fits + ' ' + m.x);
        q.choices.forEach((c, i) => { if (i !== q.right && cons.every((f) => f(cands[c[0].f]))) bad.push('unk distractor fits'); });
      }
    }
    ok(['mat', 'one', 'unk'].every((k) => seen[k] > 100) && bad.length === 0, `identification: ${R2.infer.length} questions, every answer unique and recomputed independently (${JSON.stringify(seen)}) ${bad.slice(0, 3)}`);
    ok(R2.infer.filter((q) => q.kind === 'mat').every((q) => q.meta.letters.length === 4), 'at "all" levels the matrix has four solutions');
  }

  // --- 除杂
  {
    const bad = []; const seen = {};
    const SCHOOL = ['HCl', 'H2SO4', 'NaOH', 'KOH', 'Ca(OH)2', 'Ba(OH)2', 'Na2CO3', 'K2CO3', 'CaCO3', 'BaCl2', 'Ba(NO3)2', 'CaCl2', 'CuSO4', 'AgNO3', 'MgCl2', 'NaCl', 'Na2SO4', 'KNO3'];
    const validSoln = (R, I, M) => {
      const a = obsOf(cm(R), cm(I)), b = obsOf(cm(R), cm(M)); if (a === null || b === null) return false;
      const e1 = refMeta(cm(R), cm(I)), e2 = refMeta(cm(R), cm(M)); if (!e1.happens || e2.happens) return false;
      const ps = [{ cat: cm(R).cat, an: cm(I).an }, { cat: cm(I).cat, an: cm(R).an }]; const sol = ps.filter((p) => phase(p.cat, p.an) === 'sol').map((p) => cmpFormula(p.cat, p.an));
      return sol.every((f) => f === M);
    };
    const SERIES2 = SERIES; const act = (s) => SERIES2.indexOf(s);
    const validSolid = (R, I, M) => {
      const kind = ['HCl', 'H2SO4'].includes(R) ? 'acid' : R === 'NaOH' ? 'naoh' : 'salt'; const Y = { CuSO4: 'Cu', ZnSO4: 'Zn', AgNO3: 'Ag', FeSO4: 'Fe' }[R];
      const rI = kind === 'acid' ? (I === 'CuO' || act(I) < act('H')) : kind === 'salt' ? (I !== 'CuO' && act(I) < act(Y)) : false;
      const rM = kind === 'acid' ? act(M) < act('H') : kind === 'salt' ? (M !== Y && act(M) < act(Y)) : false;
      return rI && !rM && (kind !== 'salt' || Y === M);
    };
    for (const q of R2.rem) {
      seen[q.kind] = (seen[q.kind] || 0) + 1; const m = q.meta;
      if (q.kind === 'soln') {
        if (m.choices.length !== 4 || new Set(m.choices).size !== 4 || !m.choices.every((f) => SCHOOL.includes(f)) || m.choices.includes(m.M) || m.choices.includes(m.I)) { bad.push('soln choices'); continue; }
        const valid = m.choices.filter((f) => validSoln(f, m.I, m.M)); if (valid.length !== 1 || valid[0] !== m.right || choiceFormula(q, q.right) !== m.right) bad.push(`soln ${m.M} ${m.I}: ${valid}`);
      } else if (q.kind === 'solid') {
        if (m.choices.length !== 4 || new Set(m.choices).size !== 4) { bad.push('solid choices'); continue; }
        const valid = m.choices.filter((f) => validSolid(f, m.I, m.M)); if (valid.length !== 1 || valid[0] !== m.right || choiceFormula(q, q.right) !== m.right) bad.push(`solid ${m.M} ${m.I}: ${valid}`);
      } else {
        const b = MORE.remgas.find((x) => textOf(q.stem) === x.q); if (!b || textOf(q.choices[q.right]) !== b.a || q.choices.some((c, i) => i !== q.right && !b.w.includes(textOf(c)))) bad.push('gas bank');
      }
    }
    ok(['soln', 'solid', 'gas'].every((k) => seen[k] > 100) && bad.length === 0, `impurity removal: ${R2.rem.length} questions: exactly one of the four reagents works (checked by the independent rules) ${bad.slice(0, 3)} ${JSON.stringify(seen)}`);
    // the independent rules know the classics
    ok(validSoln('HCl', 'Na2CO3', 'NaCl') && validSoln('BaCl2', 'Na2SO4', 'NaCl') && validSoln('BaCl2', 'Na2CO3', 'NaCl') && validSoln('NaOH', 'MgCl2', 'NaCl') && !validSoln('Ca(OH)2', 'MgCl2', 'NaCl'), 'control: classic 除杂 answers (HCl removes Na2CO3 from NaCl; Ca(OH)2 would add CaCl2)');
    ok(validSolid('HCl', 'Fe', 'Cu') && validSolid('CuSO4', 'Fe', 'Cu') && !validSolid('ZnSO4', 'Fe', 'Cu') && validSolid('AgNO3', 'Cu', 'Ag') && !validSolid('AgNO3', 'Fe', 'Cu') && validSolid('H2SO4', 'CuO', 'Cu'), 'control: classic solid 除杂 answers');
  }

  // --- 流程图
  {
    const bad = []; const seen = {};
    const SUP = (k) => { const [side, v] = k.split(':'); const map = { Na: 'Na⁺', Cl: 'Cl⁻', OH: 'OH⁻', CO3: 'CO₃²⁻', SO4: 'SO₄²⁻', H: 'H⁺', Fe2: 'Fe²⁺', Cu: 'Cu²⁺', Ba: 'Ba²⁺', Mg: 'Mg²⁺', Ca: 'Ca²⁺' }; return map[v]; };
    // the textbook results of the two simulated flows
    const KNOWN = { f2: { res: { A: ['BaCO3', 'BaSO4', 'CaCO3', 'Mg(OH)2'] }, fil: { B: ['Cl⁻', 'CO₃²⁻', 'Na⁺', 'OH⁻'], C: ['Cl⁻', 'H⁺', 'Na⁺'] } }, f3: { res: { A: ['Cu', 'Fe'], C: ['Cu'] }, fil: { B: ['Fe²⁺', 'SO₄²⁻'], D: ['Fe²⁺', 'H⁺', 'SO₄²⁻'] } }, f1: { res: { A: ['SiO2'] }, fil: { B: ['Cl⁻', 'Na⁺'] } } };
    const rightSet = (q) => (q.kind === 'res' ? q.choices[q.right].filter((p) => p.f).map((p) => p.f) : q.choices[q.right].filter((p) => p.u && p.u !== '、').map((p) => p.u));
    for (const q of R2.flow) {
      seen[q.kind] = (seen[q.kind] || 0) + 1; const m = q.meta || {};
      if (q.kind === 'res' || q.kind === 'fil') {
        const exp = KNOWN[m.flow][q.kind][m.letter]; const got = rightSet(q).slice().sort(); if (!exp || JSON.stringify(got) !== JSON.stringify(exp.slice().sort())) bad.push(`${q.kind} ${m.flow}${m.letter}: ${got} vs ${exp}`);
        const sets = q.choices.map((c, i) => JSON.stringify((q.kind === 'res' ? c.filter((p) => p.f).map((p) => p.f) : c.filter((p) => p.u && p.u !== '、').map((p) => p.u)).sort())); if (new Set(sets).size !== q.choices.length) bad.push('flow choices equal');
        if (q.kind === 'fil' && m.right.map(SUP).sort().join() !== got.join()) bad.push('fil meta');
      } else if (q.kind === 'op') {
        const f = MORE.flows.find((x) => x.id === m.flow); const s = f.steps.find((x) => x.n === m.n); if (!s || s.op !== m.op || q.choices[q.right][0] !== m.op || q.choices.filter((c) => c[0] === m.op).length !== 1) bad.push('op');
      } else if (q.kind === 'type') {
        const f = MORE.flows.find((x) => x.id === m.flow); const s = f.steps.find((x) => x.n === m.n); const names = { 化合反应: '化合', 分解反应: '分解', 置换反应: '置换', 复分解反应: '复分解', 其他反应: '其他' };
        if (!s.rx || names[q.choices[q.right][0]] !== typeOf(s.rx)) bad.push('type ' + s.rx);
      }
      if (q.spec && q.spec.k === 'flow') { const f = MORE.flows.find((x) => x.id === m.flow); const pills = q.spec.rows.filter((r) => r.k === 'pill').map((r) => r.n); if (JSON.stringify(pills) !== JSON.stringify(f.steps.map((s) => s.n))) bad.push('flow figure steps'); }
    }
    ok(['op', 'res', 'fil', 'type', 'qa'].every((k) => seen[k] > 30) && bad.length === 0, `flowcharts: ${R2.flow.length} questions: residues / filtrates equal the textbook results of the three simulated flows, operations and reaction types equal the data ${bad.slice(0, 3)} ${JSON.stringify(seen)}`);
    // an independent ion simulator of the same two flows (written again here: only "i" cells precipitate)
    const sim = (start, steps) => {
      let ions = new Set(start.flatMap((f) => { const c = cm(f); return ['c:' + c.cat, 'a:' + c.an]; })), solids = new Set(); const out = {};
      const fm = (cat, an) => cmpFormula(cat, an);
      for (const s of steps) {
        if (s.add) { const [rc, ra] = s.add; for (const k of [...ions]) { const [sd, v] = k.split(':'); const [c, a] = sd === 'a' ? [rc, v] : [v, ra]; const cl = cellOf(c, a); if (cl === 'i') { ions.delete(k); solids.add(fm(c, a)); } else if (phase(c, a) === 'gas' || phase(c, a) === 'water') ions.delete(k); } ions.add('c:' + rc); ions.add('a:' + ra); }
        else if (s.op === '过滤') { out[s.residue] = [...solids]; out[s.filtrate] = [...ions]; solids = new Set(); }
        if (s.filtrate && !s.op) out[s.filtrate] = [...ions];
      }
      return out;
    };
    const f2 = MORE.flows.find((f) => f.id === 'f2'); const o2 = sim(f2.start, f2.steps);
    ok(JSON.stringify(o2.A.slice().sort()) === JSON.stringify(KNOWN.f2.res.A.slice().sort()) && JSON.stringify(o2.B.map(SUP).sort()) === JSON.stringify(KNOWN.f2.fil.B.slice().sort()) && JSON.stringify(o2.C.map(SUP).sort()) === JSON.stringify(KNOWN.f2.fil.C.slice().sort()), 'the second, independent simulator gives the same results for the brine flow');
    ok(JSON.stringify(KNOWN.f2.res.A.slice().sort()) !== JSON.stringify(['BaSO4', 'Mg(OH)2', 'CaCO3'].sort()), 'control: a missing BaCO3 would be a different answer');
  }

  // --- 实验基本操作
  {
    const bad = []; const seen = {};
    for (const q of R2.lab) {
      seen[q.kind] = (seen[q.kind] || 0) + 1; const m = q.meta || {};
      if (q.kind === 'app') { const a = MORE.apps.find((x) => x[0] === q.spec.id); if (!a || q.spec.id !== m.id || q.choices[q.right][0].u !== a[1] || new Set(q.choices.map((c) => c[0].u)).size !== 4) bad.push('app'); }
      else if (q.kind === 'use') { const a = MORE.apps.find((x) => x[0] === m.id); if (!a) { bad.push('use'); continue; } const rt = q.choices[q.right][0].u; const ok1 = rt === a[1] || rt === a[2]; if (!ok1 || (rt === a[2] && q.choices.some((c, i) => i !== q.right && c[0].u === a[2]))) bad.push('use right'); }
      else if (q.kind === 'ord') {
        const task = MORE.ord.find((o) => JSON.stringify(o[1]) === JSON.stringify(q.items)); if (!task || JSON.stringify([...q.shown].sort()) !== JSON.stringify([...q.items].sort()) || JSON.stringify(q.shown) === JSON.stringify(q.items)) bad.push('ord');
      } else { const b = MORE.lab.find((x) => x.q === q.stem[0].u); if (!b || q.choices[q.right][0].u !== b.a || q.choices.some((c, i) => i !== q.right && !b.w.includes(c[0].u))) bad.push('lab bank'); }
    }
    ok(['app', 'use', 'ord', 'qa'].every((k) => seen[k] > 100) && bad.length === 0, `laboratory work: ${R2.lab.length} questions (${JSON.stringify(seen)}) agree with the data ${bad.slice(0, 3)}`);
    ok(R2.lab.filter((q) => q.kind === 'ord').every((q) => q.items.length >= 4), 'ordering tasks have at least 4 steps');
  }

  // --- 化学与生活
  {
    const bad = []; const seen = {};
    const cls = (tbl, it) => (tbl.find(([, xs]) => xs.includes(it)) || [])[0];
    for (const q of R2.life) {
      seen[q.kind] = (seen[q.kind] || 0) + 1; const m = q.meta || {}; const rt = q.choices[q.right][0].u;
      if (q.kind === 'food') { if (m.item !== undefined) { if (cls(MORE.foods, m.item) !== rt || cls(MORE.foods, m.item) !== m.cls) bad.push('food'); } else if (cls(MORE.foods, rt) !== m.cls || q.choices.some((c, i) => i !== q.right && cls(MORE.foods, c[0].u) === m.cls)) bad.push('foodof'); }
      else if (q.kind === 'nutr') { if (MORE.nutr.find(([n]) => n === rt)[1] !== q.stem[1].u) bad.push('nutr'); }
      else if (q.kind === 'elem') { const h = MORE.health; const ok1 = m.e && (h.find(([e]) => e === rt) && h.find(([e]) => e === rt)[1] === q.stem[1].u || h.find(([e]) => e === m.e)[1] === rt); if (!ok1) bad.push('elem'); }
      else if (q.kind === 'trace') { if (!MORE.trace.trace.includes(rt) || q.choices.some((c, i) => i !== q.right && !MORE.trace.major.includes(c[0].u))) bad.push('trace'); }
      else if (q.kind === 'mat') { if (m.item !== undefined) { if (cls(MORE.material, m.item) !== rt) bad.push('mat'); } else if (cls(MORE.material, rt) !== m.cls || q.choices.some((c, i) => i !== q.right && cls(MORE.material, c[0].u) === m.cls)) bad.push('matof'); }
      else if (q.kind === 'env') { if (MORE.env.find(([p]) => p === m.pb)[1] !== rt) bad.push('env'); }
      else { const b = MORE.life.find((x) => x.q === q.stem[0].u); if (!b || rt !== b.a) bad.push('life bank'); }
    }
    ok(['food', 'nutr', 'elem', 'trace', 'mat', 'env', 'qa'].every((k) => seen[k] > 30) && bad.length === 0, `chemistry and life: ${R2.life.length} questions agree with the class tables (${JSON.stringify(seen)}) ${bad.slice(0, 3)}`);
  }

  // --- 原子与离子
  {
    const bad = []; const seen = {};
    const shellsI = (e) => { const o = []; let left = e; for (const c of [2, 8, 8, 8]) { if (left <= 0) break; o.push(Math.min(c, left)); left -= c; } return o; };
    const SYM = MORE.atoms.map((a) => a[1]), NAME = MORE.atoms.map((a) => a[2]);
    const ionI = (z) => { const v = shellsI(z).pop(); if ([1, 2, 5, 10, 18].includes(z)) return null; return v <= 3 ? z - v : v >= 6 ? z + 8 - v : null; };
    const sup = (z, e) => { const c = z - e, n = Math.abs(c); return SYM[z - 1] + (c === 0 ? '' : (n > 1 ? (n === 2 ? '²' : '³') : '') + (c > 0 ? '⁺' : '⁻')); };
    // the independent configuration rule: the first 20 atoms (known textbook cases)
    ok(JSON.stringify(shellsI(11)) === '[2,8,1]' && JSON.stringify(shellsI(17)) === '[2,8,7]' && JSON.stringify(shellsI(20)) === '[2,8,8,2]' && JSON.stringify(shellsI(8)) === '[2,6]', 'control: electron shells of O, Na, Cl, Ca');
    for (const q of R2.atom) {
      seen[q.kind] = (seen[q.kind] || 0) + 1; const m = q.meta || {}; const rt = q.choices ? q.choices[q.right] : null;
      if (q.kind === 'z2el') { if (rt[0].u !== SYM[m.z - 1] || rt[1].u.trim() !== NAME[m.z - 1] || q.choices.some((c, i) => i !== q.right && c[0].u === SYM[m.z - 1])) bad.push('z2el'); }
      else if (q.kind === 'outer') { if (+rt[0].u !== shellsI(m.z).pop() || q.spec.z !== m.z) bad.push('outer'); }
      else if (q.kind === 'period') { if (+rt[0].u !== shellsI(m.z).length) bad.push('period'); }
      else if (q.kind === 'fig') { const z = q.spec.z, e = q.spec.e; const exp = z === e ? [SYM[z - 1], ' 原子'] : [sup(z, e)]; const got = rt.map((p) => (p.u !== undefined ? p.u : p)); if (JSON.stringify(got) !== JSON.stringify(exp)) bad.push('fig ' + got + ' ' + exp); const labels = q.choices.map((c) => c.map((p) => (p.u !== undefined ? p.u : p)).join('')); if (new Set(labels).size !== labels.length) bad.push('fig dup'); if (e !== z && ionI(z) !== e) bad.push('fig ion not usual'); }
      else if (q.kind === 'ion') { const e = ionI(m.z); if (e === null || rt[0].u !== sup(m.z, e) || q.choices.some((c, i) => i !== q.right && c[0].u === sup(m.z, e))) bad.push('ion'); const v = shellsI(m.z).pop(); if (!unsub(q.stem[0]).includes(`有 ${v} 个电子`)) bad.push('ion stem'); }
      else if (q.kind === 'cell') { if (q.t === 'num') { const ar = Math.round(MORE.atoms[m.z - 1][3]); if (q.steps[0].answer !== ar - m.z || m.z === 17) bad.push('neutrons'); } else if (rt[0].u !== NAME[m.z - 1]) bad.push('cell name'); }
      else { const b = MORE.atomqa.find((x) => x.q === q.stem[0].u); if (!b || rt[0].u !== b.a) bad.push('atom bank'); }
    }
    ok(['z2el', 'outer', 'period', 'fig', 'ion', 'cell', 'qa'].every((k) => seen[k] > 20) && bad.length === 0, `atoms and ions: ${R2.atom.length} questions agree with the independent shell rule (${JSON.stringify(seen)}) ${bad.slice(0, 3)}`);
  }

  // --- 物质的性质与用途
  {
    const bad = []; const seen = {};
    const KIND = { Mg: 'metal', Zn: 'metal', Fe: 'metal', Cu: 'metal', Ag: 'metal', CuO: 'bo', Fe2O3: 'bo', CaO: 'bo', CO2: 'ao', SO2: 'ao' };
    const truth = (R, X) => {
      const rk = ['HCl', 'H2SO4'].includes(R) ? 'acid' : ['NaOH', 'Ca(OH)2'].includes(R) ? 'base' : 'salt'; const xk = KIND[X] || (cm(X) && (cm(X).cat === 'H' ? 'acid' : cm(X).an === 'OH' ? 'base' : 'salt'));
      if (rk === 'acid') { if (xk === 'metal') return SERIES.indexOf(X) < SERIES.indexOf('H'); if (xk === 'bo') return true; if (xk === 'ao') return false; if (xk === 'acid') return false; }
      if (rk === 'base') { if (xk === 'ao') return true; if (xk === 'bo' || xk === 'metal') return false; if (xk === 'base') return false; }
      if (rk === 'salt' && (xk === 'metal' || xk === 'bo' || xk === 'ao')) return R === 'CuSO4' && xk === 'metal' && SERIES.indexOf(X) < SERIES.indexOf('Cu');
      const e = obsOf(cm(R), cm(X)); const m = refMeta(cm(R), cm(X)); if (e === null) return null; return m.happens;
    };
    for (const q of R2.prop) {
      seen[q.kind] = (seen[q.kind] || 0) + 1; const m = q.meta || {};
      if (q.kind === 'use') { const row = MORE.uses.find((u) => u[0] === m.name); if (!row) { bad.push('use'); continue; } const rt = q.choices[q.right][0].u; if (m.use !== undefined ? rt !== row[2] : rt !== row[0]) bad.push('use right'); const others = q.choices.filter((c, i) => i !== q.right).map((c) => c[0].u); if (others.includes(rt)) bad.push('use dup'); }
      else if (q.kind === 'asp') {
        const vals = m.choices.map((f) => truth(m.R, f)); if (vals.includes(null) || vals.includes(undefined)) { bad.push('asp unclear ' + m.R + m.choices); continue; }
        const want = vals.filter((v) => v === m.pos); if (want.length !== 1 || m.choices.length !== 4 || choiceFormula(q, q.right) !== m.right || truth(m.R, m.right) !== m.pos) bad.push(`asp ${m.R} ${m.pos} ${m.choices} ${vals}`);
      } else { const b = MORE.prop.find((x) => x.q === q.stem[0].u); if (!b || q.choices[q.right][0].u !== b.a) bad.push('prop bank'); }
    }
    ok(['use', 'asp', 'qa'].every((k) => seen[k] > 100) && bad.length === 0, `properties and uses: ${R2.prop.length} questions: exactly one choice is right (general properties of acids / bases / salts recomputed independently) ${bad.slice(0, 3)} ${JSON.stringify(seen)}`);
    ok(truth('HCl', 'Fe') === true && truth('HCl', 'Cu') === false && truth('NaOH', 'CO2') === true && truth('CuSO4', 'Zn') === true && truth('CuSO4', 'Ag') === false && truth('H2SO4', 'BaCl2') === true && truth('HCl', 'NaCl') === false, 'control: textbook properties');
  }

  // --- levels, banks and memory boxes, the figures
  {
    const lv = {}; for (const l of [1, 2, 3]) lv[l] = await makeRounds(P0, ['curve', 'calc2', 'infer', 'rem', 'flow', 'atom'], 40, l);
    const KL = { curve: { read: 1, pt: 1, how: 1, cmp: 2, purify: 2, cross: 2, cool: 3 }, calc2: { gasv: 1, pure: 1, yield: 2, excess: 2, loss: 3, sollast: 3 }, infer: { mat: 1, one: 2, unk: 1 }, rem: { soln: 1, solid: 2, gas: 1 }, flow: { op: 1, type: 1, res: 1, fil: 2, qa: 1 }, atom: { z2el: 1, outer: 1, fig: 2, ion: 2, period: 2, cell: 3, qa: 1 } };
    const badLv = []; for (const l of [1, 2, 3]) for (const [m, qs] of Object.entries(lv[l])) { if (qs.length < 390) badLv.push(`${m} level ${l} has ${qs.length}`); for (const q of qs) if ((KL[m][q.kind] ?? 1) > l) badLv.push(`${m}/${q.kind} at level ${l}`); }
    ok(badLv.length === 0, `a level shows only the kinds up to it (and still fills a round of 10): ${badLv.slice(0, 3)}`);
    // the written banks follow the memory boxes: the three due questions are asked first
    const r = await P0.evaluate(async () => {
      const C = await import('/src/chemlogic.ts'); await C.loadChem(); const today = '2026-11-13'; const out = {};
      for (const mode of ['lab', 'life', 'prop', 'atom', 'flow', 'rem']) {
        const ids = (await import('/src/chemlogic4.ts')).bankIds(mode); let p = { cards: {}, plays: 0, lv: 0 };
        p = C.applyAnswers(p, ids.slice(2).map((id) => ({ key: `${mode}:${id}`, right: true })), today);   // known, not due
        p = C.applyAnswers(p, ids.slice(0, 2).map((id) => ({ key: `${mode}:${id}`, right: false })), today);   // wrong = due
        const q = C.buildRound(mode, 0, 7, p, today); const keys = q.map((x) => x.key);
        out[mode] = { n: ids.length, due: ids.slice(0, 2).every((id) => keys.includes(`${mode}:${id}`)), len: q.length };
      }
      return out;
    });
    ok(Object.values(r).every((x) => x.due && x.len === 10 && x.n >= 4), 'the question banks (lab, life, prop, atom, flow, rem) take the due questions (the wrong ones) first: ' + JSON.stringify(r));
  }
  await t0.browser.close();

  // =====================================================================================  C. THE SCREENS
  const t = await open();
  const { page, log } = t;
  // --- the card on the science home, the home of the chemistry page
  await go(page, '#/subject/science', '#open-chem');
  ok(await page.locator('#open-chem svg').count() === 1, 'the science home has a chemistry card with a drawn icon');
  await page.screenshot({ path: OUT + 'science-home.png' });
  await page.click('#open-chem'); await page.waitForSelector('#chem-modes');
  ok(await page.evaluate(() => location.hash) === '#/science/chem', 'the card opens #/science/chem');
  ok(await page.locator('.chem-mode[data-mode]').count() === 20 && await page.locator('#chem-ref').count() === 1 && await page.locator('#chem-levels button').count() === 4, 'home: 20 modes (11 + 9 of part 2), the reference card, 4 level buttons');
  ok((await page.textContent('.chem-lead')).includes('保存在这台设备上'), 'the page says that progress stays on this device');
  await page.screenshot({ path: OUT + 'home.png', fullPage: true });
  await page.click('#chem-lv-1'); ok(JSON.parse(await page.evaluate(() => localStorage.getItem('learn.chem.v1'))).lv === 1, 'the level is remembered on the device');
  await page.click('#chem-lv-0');
  // back button
  await page.click('.top .back, header button[aria-label], header a'); await page.waitForTimeout(200);
  ok((await page.evaluate(() => location.hash)).startsWith('#/subject/science') || (await page.evaluate(() => location.hash)) === '#/', 'back leaves the page');

  // --- every mode played to the end: first all right (explanations, summary, progress), then with wrong answers
  let sawOverall = 0;
  for (const m of ALL) {
    await page.evaluate((m) => { window.__chemSeed = 31; location.hash = '#/science/chem/' + m; }, m);
    await page.waitForSelector('#chem-q'); await page.waitForTimeout(80);
    const keys = [];
    for (let i = 0; i < 10; i++) {
      const q = await currentQ(page); keys.push(JSON.stringify([q.key, q.stem, q.choices || q.items || (q.steps ? q.steps.map((x) => x.answer) : q.rx)]));
      ok((await page.textContent('#chem-count')).includes(`${i + 1}`), `${m} ${i + 1}: counter shows the question number`);
      if (i === 0) await page.screenshot({ path: `${OUT}mode-${m}.png`, fullPage: true });
      if (q.spec) await checkSpec(page, q);
      // the wrong answer path on question 2 (and 6 in a calculation): the right answer is shown, no score
      const wrongOne = i === 1 || i === 5;
      await answer(page, q, !wrongOne);
      const verdict = await page.textContent('#chem-verdict');
      ok(verdict.includes(wrongOne ? '不正确' : '正确') && (wrongOne ? !verdict.includes('回答正确') : verdict.includes('回答正确')), `${m} ${i + 1}: verdict ${wrongOne ? 'wrong' : 'right'}`);
      const expl = await page.textContent('#chem-expl'); ok(expl.replace(/\s/g, '').length > 6, `${m} ${i + 1}: an explanation is shown`);
      if (q.t === 'choice') ok(await page.locator('.chem-ch.right').count() === 1 && (await page.locator('.chem-ch:disabled').count()) === q.choices.length, `${m} ${i + 1}: the right choice is marked and the choices are locked`);
      if (q.t === 'bal' && !wrongOne) ok(await page.getAttribute('#chem-scales', 'data-balanced') === '1', `${m} ${i + 1}: balance scale green when balanced`);
      ok(await page.locator('#chem-next:not([disabled])').count() === 1, `${m} ${i + 1}: next is enabled after the answer`);
      await page.click('#chem-next'); await page.waitForTimeout(40);
    }
    await page.waitForSelector('#chem-sum');
    const score = await page.textContent('.chem-big'); ok(/8 \/ 10|7 \/ 10|9 \/ 10/.test(score) || /\b\d+ \/ 10/.test(score), `${m}: summary shows the score (${score})`);
    ok(await page.locator('.chem-wrong').count() >= 1, `${m}: the wrong ones are listed again with their explanation`);
    ok(new Set(keys).size === 10, `${m}: the 10 questions of a round differ (${new Set(keys).size} different)`);
    const pr = await progress(page); sawOverall = pr.plays;
    ok(Object.keys(pr.cards).filter((k) => k.startsWith(m + ':')).length >= (m === 'cls' ? 8 : 1), `${m}: progress of the memory boxes saved on this device`);
    await page.screenshot({ path: `${OUT}sum-${m}.png` });
  }
  ok(sawOverall === ALL.length, `every finished round counted once (${sawOverall})`);
  ok(log.puts.length === 0 && log.gets.length === 0, 'chemistry progress never goes to GitHub (nothing read or written)');
  ok(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('learn.chem')).join()) === 'learn.chem.v1', 'only the key learn.chem.v1 is used');
  // restart: "again" makes a new round, the first question differs from the last one of the previous round (items modes)
  {
    await page.evaluate(() => { window.__chemSeed = 5; location.hash = '#/science/chem/bal'; });
    await page.waitForSelector('#chem-q');
    const firsts = [];
    for (let round = 0; round < 3; round++) {
      let last = null;
      for (let i = 0; i < 10; i++) { const q = await currentQ(page); if (i === 0) firsts.push(q.rx); last = q.rx; await answer(page, q, true); await page.click('#chem-next'); await page.waitForTimeout(30); }
      await page.waitForSelector('#chem-sum');
      await page.evaluate((s) => { window.__chemSeed = s; }, 5);   // the same seed: only the memory of the last item avoids a repeat
      await page.click('#chem-again'); await page.waitForSelector('#chem-q');
      const nextFirst = (await currentQ(page)).rx; ok(nextFirst !== last, `round ${round + 1}: the next round does not start with the equation just asked (${last} -> ${nextFirst})`);
    }
  }

  // --- balance: the live scale, the hint, wrong checks
  await page.evaluate(async () => { const C = await import('/src/chemlogic.ts'); await C.loadChem(); let best = 1; for (let s = 1; s < 400; s++) { const q = C.buildRound('bal', 0, s, C.EMPTY_PROGRESS, '2026-11-13')[0]; const r = C.rxById(q.rx); if (r.l.length === 2 && r.r.length === 1 && r.l[0].f === 'H2') { best = s; break; } } window.__chemSeed = best; localStorage.removeItem('learn.chem.v1'); location.hash = '#/science/chem'; });
  await page.waitForSelector('#chem-modes'); await page.evaluate(() => (location.hash = '#/science/chem/bal')); await page.waitForSelector('#chem-q');
  {
    const q = await currentQ(page); const rx = data.reactions.find((r) => r.id === q.rx); const { l, r } = parseEq(rx.eq);
    const rowsOf = () => page.evaluate(() => [...document.querySelectorAll('.chem-scale')].map((e) => ({ e: e.dataset.e, l: +e.dataset.l, r: +e.dataset.r, eq: e.classList.contains('eq'), pans: [...e.querySelectorAll('svg text')].map((x) => x.textContent) })));
    const expectRows = (co) => { const a = count(l.map((t, i) => ({ ...t, c: co[i] }))), b = count(r.map((t, i) => ({ ...t, c: co[l.length + i] }))); return Object.keys({ ...a, ...b }).map((e) => ({ e, l: a[e] || 0, r: b[e] || 0 })); };
    const co = [...l, ...r].map(() => 1);
    const compare = async (why) => { const got = await rowsOf(); const exp = expectRows(co); const same = got.length === exp.length && exp.every((x, i) => got[i].e === x.e && got[i].l === x.l && got[i].r === x.r && got[i].eq === (x.l === x.r) && got[i].pans[0] === String(x.l) && got[i].pans[1] === String(x.r)); ok(same, `the scale shows the atom counts ${why}: ${JSON.stringify(got.map((g) => `${g.e}${g.l}:${g.r}${g.eq ? '=' : ''}`))}`); };
    await compare('at the start');
    ok(await page.getAttribute('#chem-scales', 'data-balanced') === '0', 'unbalanced at the start: scales are orange');
    // the beam turns toward the heavier side: read the beam line of the first unequal scale
    const tilt = await page.evaluate(() => { const s = [...document.querySelectorAll('.chem-scale')].find((e) => !e.classList.contains('eq')); const ln = s.querySelector('svg line[stroke-width="3.5"]'); return { l: +s.dataset.l, r: +s.dataset.r, dy: +ln.getAttribute('y2') - +ln.getAttribute('y1') }; });
    ok(tilt.l !== tilt.r && ((tilt.l > tilt.r && tilt.dy < 0) || (tilt.l < tilt.r && tilt.dy > 0)), `the beam goes down on the heavier side (${JSON.stringify(tilt)})`);
    // click steppers: each click changes the scale at once
    await page.click('#chem-inc-0'); co[0] = 2; await compare('after one click on + of the first term');
    await page.click('#chem-inc-0'); co[0] = 3; await page.click('#chem-dec-0'); co[0] = 2; await compare('after + + -');
    ok(await page.isDisabled('#chem-dec-1'), 'the minus button stops at 1');
    await page.click('#chem-check'); await page.waitForSelector('#chem-msg.bad');
    const msg = await page.textContent('#chem-msg'); ok(/还没有配平/.test(msg) && /[A-Z]/.test(msg.replace(/还没有配平.*：/, '')), 'a wrong check names the elements that differ: ' + msg);
    ok(await page.locator('#chem-next[disabled]').count() === 1, 'not finished: next stays off');
    // the hint fills exactly one coefficient with the right value
    const before = await page.evaluate(() => [...document.querySelectorAll('.chem-val')].map((e) => +e.textContent));
    await page.click('#chem-hint'); const after = await page.evaluate(() => [...document.querySelectorAll('.chem-val')].map((e) => +e.textContent));
    const diffs = after.map((v, i) => [i, v]).filter(([i, v]) => v !== before[i]);
    const sol = [...l, ...r].map((x) => x.c);
    ok(diffs.length === 1 && sol[diffs[0][0]] === diffs[0][1], 'the hint sets one coefficient to its right value');
    // finish: all right now, but the hint was used = not a first-try point
    for (let i = 0; i < sol.length; i++) { const have = await page.evaluate((i) => +document.querySelector('#chem-c-' + i).textContent, i); for (let n = have; n < sol[i]; n++) await page.click(`#chem-inc-${i}`); }
    co.splice(0, co.length, ...sol); await compare('with the right coefficients');
    ok(await page.getAttribute('#chem-scales', 'data-balanced') === '1' && (await page.locator('.chem-scale.eq').count()) === (await page.locator('.chem-scale').count()), 'every scale is green when balanced');
    await page.click('#chem-check'); await page.waitForSelector('#chem-verdict');
    ok((await page.textContent('#chem-verdict')).includes('不正确') && (await page.textContent('#chem-expl')).includes(rx.ph.slice(0, 6)), 'balanced with a hint / after a mistake: not counted as right; the phenomenon is shown');
    ok(await page.locator('#chem-expl .chem-cond').count() === 1, 'the conditions of the reaction are shown');
    ok(await page.locator('.chem-step-btn:disabled').count() === await page.locator('.chem-step-btn').count(), 'the steppers are locked after the answer');
    // multiples are balanced but not in lowest terms
    await page.evaluate(() => { location.hash = '#/science/chem'; }); await page.waitForSelector('#chem-modes');
    await page.evaluate(() => { location.hash = '#/science/chem/bal'; }); await page.waitForSelector('#chem-q');
    const q2 = await currentQ(page); const rx2 = data.reactions.find((r) => r.id === q2.rx); const t2 = [...parseEq(rx2.eq).l, ...parseEq(rx2.eq).r];
    for (const [i, x] of t2.entries()) for (let n = 1; n < x.c * 2; n++) await page.click(`#chem-inc-${i}`);
    await page.click('#chem-check'); await page.waitForSelector('#chem-msg.bad');
    ok((await page.textContent('#chem-msg')).includes('最简整数比') && await page.locator('#chem-next[disabled]').count() === 1, 'doubled coefficients: balanced but "not the simplest ratio", not accepted');
  }

  // --- writing equations: the judge by the real tiles
  {
    await page.evaluate(() => { window.__chemSeed = 11; location.hash = '#/science/chem'; }); await page.waitForSelector('#chem-modes');
    await page.evaluate(() => { location.hash = '#/science/chem/wr'; }); await page.waitForSelector('#chem-q');
    const q = await currentQ(page); const rx = data.reactions.find((r) => r.id === q.rx); const { l, r } = parseEq(rx.eq);
    ok((await page.textContent('#chem-desc')).length > 8 && await page.locator('.chem-tile').count() === q.tiles.length, 'the sentence and the tiles are shown');
    await page.click('#chem-check'); ok((await page.textContent('#chem-msg')).includes('请先'), 'check on an empty equation asks to place formulas first');
    // wrong side: put the first product on the reactant side
    await page.click(`#chem-zone-l`); await page.click(`.chem-tile[data-f="${r[0].f}"]`); await page.click(`#chem-zone-r`); await page.click(`.chem-tile[data-f="${l[0].f}"]`); await page.click('#chem-check');
    ok((await page.textContent('#chem-msg')).includes('物质或位置不对'), 'formulas on the wrong sides are refused');
    await page.click(`.chem-tile[data-f="${r[0].f}"]`); ok((await page.textContent('#chem-msg')).includes('已经放进'), 'the same formula twice is refused');
    await page.click('#chem-clear');
    for (const [side, list] of [[0, l], [1, r]]) { await page.click(`#chem-zone-${side ? 'r' : 'l'}`); for (const x of list) await page.click(`.chem-tile[data-f="${x.f}"]`); }
    await page.click('#chem-check'); await page.waitForSelector('#chem-msg.bad');
    const bm = await page.textContent('#chem-msg');
    const allOne = [...l, ...r].every((x) => x.c === 1);
    ok(allOne ? !/还没有配平/.test(bm) : /还没有配平/.test(bm) && await page.locator('.chem-scale').count() > 0, 'all coefficients 1: ' + (allOne ? 'accepted' : 'not balanced, the scales show it') + ' ' + bm);
    for (const [side, list] of [[0, l], [1, r]]) for (const x of list) for (let n = 1; n < x.c; n++) await page.click(`#chem-zone-${side ? 'r' : 'l'} .chem-chip[data-f="${x.f}"] .chem-step-btn:nth-of-type(2)`);
    await page.click('#chem-check'); await page.waitForSelector('#chem-verdict');
    ok((await page.textContent('#chem-verdict')).includes(allOne ? '回答正确' : '不正确'), 'a correct equation after a wrong try is accepted but not counted as first-try');
    ok(await page.locator('#chem-expl .chem-eqs').count() === 1 && await page.locator('#chem-expl .chem-cond').count() === 1, 'the explanation shows the equation and its conditions');
    // judge unit checks (control: wrong equations are refused)
    const j = await page.evaluate(async (rid) => { const C = await import('/src/chemlogic.ts'); const rx = C.rxById(rid); const L = rx.l.map((t) => ({ f: t.f, c: t.c })), R = rx.r.map((t) => ({ f: t.f, c: t.c })); return { ok: C.judgeWrite(rx, L, R).ok, swapped: C.judgeWrite(rx, R, L).ok, double: C.judgeWrite(rx, L.map((t) => ({ ...t, c: t.c * 2 })), R.map((t) => ({ ...t, c: t.c * 2 }))).problems, missing: C.judgeWrite(rx, L.slice(1), R).ok }; }, q.rx);
    ok(j.ok && !j.swapped && j.double.includes('lowest') && !j.missing, 'judgeWrite: right accepted; swapped sides, doubled coefficients and a missing formula refused');
  }

  // --- numbers: wrong value shows the right one; tolerance; empty input
  {
    await page.evaluate(() => { window.__chemSeed = 3; location.hash = '#/science/chem'; }); await page.waitForSelector('#chem-modes');
    await page.evaluate(() => { location.hash = '#/science/chem/calc'; }); await page.waitForSelector('#chem-q');
    const q = await currentQ(page); const s0 = q.steps[0];
    await page.click('#chem-ok-0'); ok((await page.textContent('#chem-say-0')).includes('请输入数字'), 'an empty answer asks for a number (no verdict)');
    await page.fill('#chem-in-0', String(s0.answer + 3)); await page.click('#chem-ok-0');
    ok(await page.locator('#chem-say-0.bad').count() === 1 && (await page.textContent('#chem-say-0')).includes(String(+s0.answer.toFixed(2))), 'a wrong step shows the right value');
    await page.fill('#chem-in-1', String(q.steps[1].answer).replace('.', ',')); await page.click('#chem-ok-1');
    ok(await page.locator('#chem-say-1.ok').count() === 1, 'a decimal comma is accepted');
    const tol = q.steps[2].tol; await page.fill('#chem-in-2', String(q.steps[2].answer + tol * 0.9)); await page.click('#chem-ok-2');
    ok(await page.locator('#chem-say-2.ok').count() === 1, `an answer within the tolerance (${tol.toFixed(2)}) is right for that step`);
    await page.waitForSelector('#chem-verdict'); ok((await page.textContent('#chem-verdict')).includes('不正确'), 'one wrong step makes the question wrong');
    ok(await page.locator('.chem-ar').count() === 1, 'the relative atomic masses are shown above the steps');
  }

  // --- the reference tables
  await go(page, '#/science/chem/ref', '#chem-soltbl');
  {
    ok(await page.locator('#chem-soltbl td').count() === 13 * 5, 'solubility table: 13 ions x 5 ions');
    const cells = await page.evaluate(() => [...document.querySelectorAll('#chem-soltbl td')].map((e) => [e.dataset.c, e.dataset.a, e.textContent]));
    ok(cells.every(([c, a, v]) => v === (data.ions.sol[a][data.ions.cat.indexOf(c)] === '-' ? '–' : data.ions.sol[a][data.ions.cat.indexOf(c)])), 'the table on the screen equals the data');
    await page.click('#rt-act'); ok(await page.locator('#chem-act .chem-actchip').count() === 15, 'activity series on screen: 15 symbols');
    ok((await page.locator('#chem-act .chem-actchip').allTextContents()).join('') === SERIES.join(''), 'in the right order');
    await page.click('#rt-val'); ok(await page.locator('.chem-valtbl tbody tr').count() === data.elements.length, 'valence table: every element');
    await page.click('#rt-subs'); const n0 = await page.locator('#chem-subtbl tr').count(); await page.click('#rc-acid'); ok(await page.locator('#chem-subtbl tr').count() === data.subs.filter((s) => s.c === 'acid').length && n0 > 100, 'substances: the filter by class works');
    await page.click('#rt-ind'); ok(await page.locator('#chem-ph .chem-phrow').count() === data.ph.length, 'pH list on screen');
    await page.click('#rt-rx'); ok(await page.locator('#chem-rxlist .chem-rxrow').count() === data.reactions.length, 'all reactions are listed');
    await page.click('#rr-metal'); ok(await page.locator('#chem-rxlist .chem-rxrow').count() === data.reactions.filter((r) => r.ch === 'metal').length, 'chapter filter');
    await page.screenshot({ path: OUT + 'ref-reactions.png' });
  }
  // --- part 2 screens: ordering steps with the real controls
  {
    const openOrd = async (minSteps) => {
      for (let s = 1; s <= 80; s++) {
        await page.evaluate((s) => { localStorage.removeItem('learn.chem.v1'); window.__chemSeed = s; location.hash = '#/science/chem'; }, s); await page.waitForSelector('#chem-modes');
        await page.evaluate(() => { location.hash = '#/science/chem/lab'; }); await page.waitForSelector('#chem-q');
        const q = await currentQ(page); if (q.t === 'ord' && q.items.length >= minSteps) return q;
      }
      throw new Error('no ordering question found');
    };
    await openOrd(5);
    let q = await currentQ(page);
    ok(q.t === 'ord' && await page.locator('.chem-ordb').count() === q.items.length && await page.locator('#chem-check[disabled]').count() === 1, 'an ordering question: one button per step, check stays off until every step is chosen');
    const first = q.shown.indexOf(q.items[0]), second = q.shown.indexOf(q.items[1]);
    await page.click(`.chem-ordb[data-i="${first}"]`); await page.click(`.chem-ordb[data-i="${second}"]`);
    ok((await page.textContent(`.chem-ordb[data-i="${first}"] .chem-ordn`)) === '1' && (await page.textContent(`.chem-ordb[data-i="${second}"] .chem-ordn`)) === '2', 'a tapped step shows its place (1, 2)');
    await page.click(`.chem-ordb[data-i="${first}"]`); ok((await page.textContent(`.chem-ordb[data-i="${first}"] .chem-ordn`)) === '' && (await page.textContent(`.chem-ordb[data-i="${second}"] .chem-ordn`)) === '1', 'a second tap on a step takes it out again (the others move up)');
    await page.click('#chem-clear'); ok(await page.locator('.chem-ordb.sel').count() === 0, 'clear removes every choice');
    ok(await page.evaluate(() => [...document.querySelectorAll('.chem-ordb')].every((b) => b.getBoundingClientRect().height >= 40)), 'every step button is at least 40 px high');
    // the wrong order: the wrong ones are red, the right order is explained, not a point
    for (const step of q.items.slice().reverse()) await page.click(`.chem-ordb[data-i="${q.shown.indexOf(step)}"]`);
    ok(await page.locator('#chem-check:not([disabled])').count() === 1, 'all steps chosen: check is on');
    await page.click('#chem-check'); await page.waitForSelector('#chem-verdict');
    ok((await page.textContent('#chem-verdict')).includes('不正确') && await page.locator('.chem-ordb.bad').count() >= 2 && (await page.textContent('#chem-expl')).includes(q.items[0].slice(0, 6)) && await page.locator('.chem-ordb:disabled').count() === q.items.length, 'a wrong order: red steps, locked, the right order in the explanation');
    // the right order
    q = await openOrd(4);
    await answer(page, q, true);
    ok((await page.textContent('#chem-verdict')).includes('回答正确') && await page.locator('.chem-ordb.ok').count() === q.items.length && (await page.textContent('#chem-msg')).includes('顺序正确'), 'the right order: all steps green, the verdict is right');
    const pr = await progress(page); ok(pr.cards[q.key] && pr.cards[q.key].box >= 1, 'the ordering task is remembered in the memory boxes (' + q.key + ')');
  }
  // --- part 2 screens: the table of the first 20 atoms in the reference
  {
    await go(page, '#/science/chem/ref', '#chem-soltbl'); await page.click('#rt-at');
    const rows = await page.evaluate(() => [...document.querySelectorAll('#chem-attbl tbody tr')].map((r) => [...r.children].map((c) => c.textContent)));
    const shellsI = (e) => { const o = []; let left = e; for (const c of [2, 8, 8, 8]) { if (left <= 0) break; o.push(Math.min(c, left)); left -= c; } return o.join(' · '); };
    ok(rows.length === 20 && rows.every((r, i) => +r[0] === i + 1 && r[1] === data.more.atoms[i][1] && r[2] === data.more.atoms[i][2] && +r[3] === data.more.atoms[i][3] && r[4] === shellsI(i + 1)), 'the reference table of the first 20 elements shows number, symbol, name, mass and shells');
  }

  ok(log.external.length === 0, 'no request left the app (' + log.external.slice(0, 2) + ')');
  await t.browser.close();

  // =====================================================================================  D. REAL TOUCH DRAGS at dpr 2 (classification) and the stepper by touch
  {
    const tt = await open({ touch: true, dpr: 2, viewport: { width: 390, height: 844 } });
    const pg = tt.page; const cdp = await tt.ctx.newCDPSession(pg);
    await pg.evaluate(() => { window.__chemSeed = 2; location.hash = '#/science/chem/cls'; }); await pg.waitForSelector('#chem-q'); await pg.waitForTimeout(200);
    const q = await currentQ(pg);
    const center = async (sel) => pg.evaluate((s) => { const e = document.querySelector(s); e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }, sel);
    const touchDrag = async (from, to) => {
      const [x0, y0] = from, [x1, y1] = to;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
      for (let k = 1; k <= 8; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * k) / 8, y: y0 + ((y1 - y0) * k) / 8 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    ok(await pg.evaluate(() => window.devicePixelRatio) === 2, 'the touch test runs at device pixel ratio 2');
    ok(await pg.evaluate(() => getComputedStyle(document.querySelector('.chem-item')).touchAction) === 'none', 'items have touch-action: none (the page does not scroll while dragging)');
    // make both the chip and its bucket visible: the page is scrolled so that the tray is at the top
    let placedByTouch = 0;
    for (const it of q.items) {
      const chipSel = `.chem-item[data-id="${it.id}"]`, bkSel = `#chem-bk-${it.cat}`;
      let from = await pg.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }, chipSel);
      let to = await pg.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }, bkSel);
      if (to[1] > 820 || to[1] < 0) { await pg.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), bkSel); from = await pg.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }, chipSel); to = await pg.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }, bkSel); }
      if (from[1] < 0 || from[1] > 840 || to[1] < 0 || to[1] > 840) continue;
      const scrollBefore = await pg.evaluate(() => [...document.querySelectorAll('*')].filter((e) => e.scrollTop > 0).map((e) => e.scrollTop).join());
      await touchDrag(from, to);
      const scrollAfter = await pg.evaluate(() => [...document.querySelectorAll('*')].filter((e) => e.scrollTop > 0).map((e) => e.scrollTop).join());
      const inBucket = await pg.evaluate(({ chipSel, bkSel }) => !!document.querySelector(bkSel + ' ' + chipSel), { chipSel, bkSel });
      if (inBucket) placedByTouch++;
      ok(inBucket && scrollBefore === scrollAfter, `touch drag: "${it.id}" lands in its class and the page did not scroll`);
    }
    ok(placedByTouch >= 5, `at least 5 of 8 items were dragged by real touch events (${placedByTouch})`);
    // the rest by tap: item, then class; then check
    for (const it of q.items) { if (await pg.evaluate(({ id }) => !!document.querySelector('#chem-tray [data-id="' + id + '"]'), { id: it.id })) { await pg.tap(`.chem-item[data-id="${it.id}"]`); await pg.tap(`#chem-bk-${it.cat}`); } }
    ok(await pg.locator('#chem-check:not([disabled])').count() === 1, 'all items placed: check is enabled');
    await pg.click('#chem-check'); await pg.waitForSelector('#chem-verdict');   // (a click: after a drag made by CDP touch events the browser sends no "click" for the next tap, only pointer events)
    ok((await pg.textContent('#chem-verdict')).includes('回答正确') && await pg.locator('.chem-item.ok').count() === 8, 'all 8 are right: the verdict is right and each item is green');
    await pg.screenshot({ path: OUT + 'touch-class.png', fullPage: true });
    // a wrong drop shows the right class beside the item
    await pg.click('#chem-next'); await pg.waitForSelector('#chem-q [data-id]');
    const q2 = await currentQ(pg); const wrongB = q2.buckets.find((b) => b !== q2.items[0].cat);
    for (const it of q2.items) { await pg.tap(`.chem-item[data-id="${it.id}"]`); await pg.tap(`#chem-bk-${it === q2.items[0] ? wrongB : it.cat}`); }
    await pg.click('#chem-check'); await pg.waitForSelector('#chem-verdict');
    ok(await pg.locator('.chem-item.bad').count() === 1 && await pg.locator('.chem-item.bad .chem-right').count() === 1 && (await pg.textContent('#chem-verdict')).includes('不正确'), 'a misplaced item is red and shows its right class');
    ok(tt.log.external.length === 0, 'no outside request in the touch run');
    await tt.browser.close();
    // the steppers by a real tap (a fresh touch page: no drag before it)
    const t3 = await open({ touch: true, dpr: 2, viewport: { width: 390, height: 844 } }); const p3 = t3.page;
    await p3.evaluate(() => { window.__chemSeed = 2; location.hash = '#/science/chem/bal'; }); await p3.waitForSelector('#chem-q .chem-step-btn');
    const box = await p3.locator('#chem-inc-0').boundingBox(); ok(box.width >= 40 && box.height >= 40, `a stepper button is at least 40 px (${box.width} x ${box.height})`);
    await p3.tap('#chem-inc-0'); await p3.waitForTimeout(400); ok(+(await p3.textContent('#chem-c-0')) === 2, 'a tap on + raises the coefficient');
    await p3.tap('#chem-hint'); await p3.waitForTimeout(300); ok((await p3.textContent('#chem-msg')).includes('已填入'), 'a tap on the hint button works');
    await t3.browser.close();
  }

  // =====================================================================================  E. 5 SCREEN SIZES
  const SIZES = [[390, 844], [320, 568], [820, 1180], [1180, 820], [844, 390]];
  for (const [w, hgt] of SIZES) {
    const tl = await open({ viewport: { width: w, height: hgt } });
    const pg = tl.page;
    const pagesToCheck = [['#/science/chem/curve', '#chem-spec', 'curve'], ['#/science/chem/infer', '#chem-q', 'infer'], ['#/science/chem/flow', '#chem-spec', 'flow'], ['#/science/chem/lab', '#chem-q', 'lab'], ['#/science/chem/atom', '#chem-q', 'atom'], ['#/science/chem/calc2', '#chem-steps', 'calc2'], ['#/science/chem/ref', '#chem-soltbl', 'ref'], ['#/science/chem', '#chem-modes', 'home'], ['#/science/chem/ref', '#chem-soltbl', 'ref'], ['#/science/chem/bal', '#chem-eq', 'bal'], ['#/science/chem/wr', '#chem-tiles', 'wr'], ['#/science/chem/cls', '#chem-buckets', 'cls'], ['#/science/chem/calc', '#chem-steps', 'calc'], ['#/science/chem/gas', '#chem-choices', 'gas'], ['#/science/chem/sol', '#chem-q', 'sol'], ['#/science/chem/dec', '#chem-choices', 'dec'], ['#/science/chem/val', '#chem-q', 'val'], ['#/science/chem/type', '#chem-q', 'type']];
    for (const [hash, sel, name] of pagesToCheck) {
      // seeds with the widest content: an equation with five terms (balance), a generator question with a figure (gas)
      await pg.evaluate(async ([name]) => { const C = await import('/src/chemlogic.ts'); await C.loadChem(); const find = (mode, pred) => { for (let s = 1; s < 800; s++) { const q = C.buildRound(mode, 0, s, C.EMPTY_PROGRESS, '2026-11-13')[0]; if (pred(q)) return s; } return 1; }; window.__chemSeed = name === 'bal' ? find('bal', (q) => { const r = C.rxById(q.rx); return r.l.length + r.r.length >= 5; }) : name === 'gas' ? find('gas', (q) => q.kind === 'col' || q.kind === 'gen') : name === 'wr' ? find('wr', (q) => { const r = C.rxById(q.rx); return r.l.length + r.r.length >= 5; }) : name === 'curve' ? find('curve', (q) => q.kind === 'cmp' || q.kind === 'cool') : name === 'infer' ? find('infer', (q) => q.kind === 'mat') : name === 'flow' ? find('flow', (q) => q.kind === 'fil' && q.meta.flow === 'f2') : name === 'lab' ? find('lab', (q) => q.kind === 'ord' && q.items.length >= 6) : name === 'atom' ? find('atom', (q) => q.kind === 'fig') : name === 'calc2' ? find('calc2', (q) => q.kind === 'sollast') : 4; }, [name]);
      await go(pg, hash, sel); await pg.waitForTimeout(150);
      const m = await pg.evaluate(() => { const d = document.documentElement; const nar = document.querySelector('.chem-narrow') || document.querySelector('.narrow'); const b = nar.getBoundingClientRect(); const wide = [...document.querySelectorAll('.chem-narrow *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); }).map((e) => e.className || e.tagName).slice(0, 3); return { over: d.scrollWidth - innerWidth, left: b.left, right: innerWidth - b.right, wide }; });
      ok(m.over <= 1 && m.wide.length === 0, `${w}x${hgt} ${name}: nothing sideways (${m.over}, ${m.wide})`);
      ok(Math.abs(m.left - m.right) <= 3, `${w}x${hgt} ${name}: equal space left and right (${m.left.toFixed(0)} / ${m.right.toFixed(0)})`);
      const small = await pg.evaluate(() => [...document.querySelectorAll('.chem-ch, .chem-ordb, .chem-step-btn, .chem-tile, .chem-item, .chem-mode, .chem-check, .chem-next, .chem-ok, #chem-levels .mopt')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 39.5 || r.width < 39.5); }).map((e) => e.className));
      ok(small.length === 0, `${w}x${hgt} ${name}: every touched control is at least 40 px (${small.slice(0, 3)})`);
      if (['bal', 'wr', 'cls', 'gas', 'home', 'curve', 'infer', 'flow', 'lab', 'atom', 'calc2'].includes(name)) await pg.screenshot({ path: `${OUT}size-${w}x${hgt}-${name}.png`, fullPage: true });
    }
    await tl.browser.close();
  }

  // =====================================================================================  F. ENGLISH and FRENCH: no Chinese outside user content
  for (const [locale, label] of [['en-US', 'English'], ['fr-FR', 'French']]) {
    const tl = await open({ locale, viewport: { width: 390, height: 844 } });
    const pg = tl.page; let left = [];
    await go(pg, '#/subject/science', '#open-chem'); left.push(...(await chineseLeft(pg)).filter((x) => /配平|化学|计算|酸碱盐|气体/.test(x)));   // (only the card of this feature: the other cards of the science home belong to other features)
    await go(pg, '#/science/chem', '#chem-modes'); left.push(...await chineseLeft(pg));
    ok(left.length === 0, `${label}: science home + chemistry home have no Chinese left ${left.slice(0, 4)}`);
    await pg.screenshot({ path: `${OUT}${locale}-home.png`, fullPage: true });
    await go(pg, '#/science/chem/ref', '#chem-soltbl'); left = await chineseLeft(pg);
    for (const tab of ['act', 'val', 'subs', 'ind', 'rx', 'at']) { await pg.click('#rt-' + tab); left.push(...await chineseLeft(pg)); }
    ok(left.length === 0, `${label}: the reference tables have no Chinese left ${left.slice(0, 4)}`);
    for (const m of ALL) {
      await pg.evaluate((m) => { window.__chemSeed = 17; location.hash = '#/science/chem/' + m; }, m); await pg.waitForSelector('#chem-q'); await pg.waitForTimeout(60);
      let bad = [];
      for (let i = 0; i < 10; i++) {
        const q = await currentQ(pg); if (i % 3 === 0) bad.push(...(await chineseLeft(pg)));   // (the whole round is played; the text is looked at on 4 of the 10 questions, questions and explanations)
        await answer(pg, q, i % 4 !== 1); if (i % 3 === 0 || i === 1) bad.push(...(await chineseLeft(pg)));
        if (i === 1 && ['bal', 'cls', 'gas', 'calc'].includes(m)) await pg.screenshot({ path: `${OUT}${locale}-${m}-${i}.png`, fullPage: true });
        await pg.click('#chem-next'); await pg.waitForTimeout(20);
      }
      bad.push(...await chineseLeft(pg));
      ok(bad.length === 0, `${label} ${m}: a whole round (questions, explanations, summary) has no Chinese left ${[...new Set(bad)].slice(0, 5)}`);
    }
    // 200 generated questions per mode (40 seeds x one round of 10): every text of every question (stem, explanation, choices, steps, table, order items, class names) is translated, no Chinese is left
    const sampled = await pg.evaluate(async () => {
      const C = await import('/src/chemlogic.ts'); await C.loadChem(); const I = await import('/src/i18n.ts');
      const cj = /[　-〿一-鿿＀-￯]/; const bad = {}; let n = 0;
      const txt = (m, x, ctx) => {
        if (typeof x === 'string') { const v = I.tr(x); if (cj.test(v)) (bad[m] ??= new Map()).set(v.slice(0, 80), ctx); }
        else if (Array.isArray(x)) x.forEach((y) => txt(m, y, ctx));
        else if (x && typeof x === 'object') { if ('u' in x) { const v = C.uText(x.u); if (cj.test(v)) (bad[m] ??= new Map()).set(v.slice(0, 80), ctx); } else if (!('f' in x || 'eq' in x || 'cross' in x)) for (const k of Object.keys(x)) txt(m, x[k], ctx); }
      };
      for (const m of C.MODES.map((x) => x.id)) for (let s = 1; s <= 40; s++) {
        const qs = C.buildRound(m, 0, s * 7919 + m.length, C.EMPTY_PROGRESS, '2026-11-13');
        for (const q of qs) { n++; for (const k of ['stem', 'expl', 'choices', 'steps', 'desc', 'tbl', 'shown', 'buckets']) if (q[k] !== undefined) txt(m, q[k], q.key + ':' + k); if (q.t === 'class') q.items.forEach((it) => txt(m, [C.tn(it.n)], q.key)); }
      }
      return { n, bad: Object.fromEntries(Object.entries(bad).map(([m, mp]) => [m, [...mp.entries()].slice(0, 3)])) };
    });
    ok(sampled.n >= 3000 && Object.keys(sampled.bad).length === 0, `${label}: ${sampled.n} generated questions (all modes, 40 rounds each): no Chinese left in any text ${JSON.stringify(sampled.bad).slice(0, 300)}`);
    ok(tl.log.external.length === 0, `${label}: no outside request`);
    await tl.browser.close();
  }
  await done();
})();
