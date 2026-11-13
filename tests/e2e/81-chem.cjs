// 化学 (#/science/chem, under 科学): the junior-high chemistry trainer. The library (>= 150 reactions, each re-checked here by an INDEPENDENT atom counter, the types
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
  return { happens, reasons, ambiguous: amb };
}
const allCmps = () => { const out = []; for (const an of data.ions.an) for (const cat of data.ions.cat) { const s = data.ions.sol[an][data.ions.cat.indexOf(cat)]; if (s === '-' || (cat === 'H' && an === 'CO3') || (cat === 'NH4' && an === 'OH')) continue; out.push({ cat, an }); } return out; };

const SERIES = ['K', 'Ca', 'Na', 'Mg', 'Al', 'Zn', 'Fe', 'Sn', 'Pb', 'H', 'Cu', 'Hg', 'Ag', 'Pt', 'Au'];
const METAL_CH = { Mg: 2, Al: 3, Zn: 2, Fe: 2, Cu: 2, Ag: 1 };
const crossF = (cat, cc, an, ac) => { const g = gcd(cc, ac); const a = ac / g, b = cc / g; const p = (s, n) => (n === 1 ? s : (Object.keys(atoms(s)).length > 1 ? `(${s})` : s) + n); return p(cat, a) + p(an, b); };
const ANIONS = { Cl: ['Cl', 1], NO3: ['NO3', 1], SO4: ['SO4', 2] };

// ------------------------------------------------------------------ helpers for the browser
const extra = JSON.parse(fs.readFileSync(path.join(__dirname, '../../src/i18n-extra/chem.json'), 'utf8'));
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
const chineseLeft = (page) => page.evaluate((src) => {
  const re = new RegExp(src), out = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode()); ) { const p = n.parentElement; if (!p || p.closest('.user, .user-title, script, style')) continue; if (re.test(n.nodeValue)) out.push(n.nodeValue.trim().slice(0, 40)); }
  for (const e of document.querySelectorAll('[title],[aria-label],[placeholder]')) { if (e.closest('.user, .user-title')) continue; for (const a of ['title', 'aria-label', 'placeholder']) { const v = e.getAttribute(a); if (v && re.test(v)) out.push(a + ':' + v.slice(0, 30)); } }
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
      await page.click(`#chem-bk-${cat}`);
    }
    await page.click('#chem-check');
  }
  await page.waitForSelector('#chem-verdict');
}
const currentQ = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__chemQ)));

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
  ok(await page.locator('.chem-mode[data-mode]').count() === 11 && await page.locator('#chem-ref').count() === 1 && await page.locator('#chem-levels button').count() === 4, 'home: 11 modes, the reference card, 4 level buttons');
  ok((await page.textContent('.chem-lead')).includes('保存在这台设备上'), 'the page says that progress stays on this device');
  await page.screenshot({ path: OUT + 'home.png', fullPage: true });
  await page.click('#chem-lv-1'); ok(JSON.parse(await page.evaluate(() => localStorage.getItem('learn.chem.v1'))).lv === 1, 'the level is remembered on the device');
  await page.click('#chem-lv-0');
  // back button
  await page.click('.top .back, header button[aria-label], header a'); await page.waitForTimeout(200);
  ok((await page.evaluate(() => location.hash)).startsWith('#/subject/science') || (await page.evaluate(() => location.hash)) === '#/', 'back leaves the page');

  // --- every mode played to the end: first all right (explanations, summary, progress), then with wrong answers
  let sawOverall = 0;
  for (const m of MODES) {
    await page.evaluate((m) => { window.__chemSeed = 31; location.hash = '#/science/chem/' + m; }, m);
    await page.waitForSelector('#chem-q'); await page.waitForTimeout(80);
    const keys = [];
    for (let i = 0; i < 10; i++) {
      const q = await currentQ(page); keys.push(JSON.stringify([q.key, q.stem, q.choices || q.items || (q.steps ? q.steps.map((x) => x.answer) : q.rx)]));
      ok((await page.textContent('#chem-count')).includes(`${i + 1}`), `${m} ${i + 1}: counter shows the question number`);
      if (i === 0) await page.screenshot({ path: `${OUT}mode-${m}.png`, fullPage: true });
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
  ok(sawOverall === MODES.length, `every finished round counted once (${sawOverall})`);
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
    const tilt = await page.evaluate(() => { const s = [...document.querySelectorAll('.chem-scale')].find((e) => !e.classList.contains('eq')); const ln = s.querySelectorAll('svg line')[ [...s.querySelectorAll('svg line')].length - 1 ]; return { l: +s.dataset.l, r: +s.dataset.r, dy: +ln.getAttribute('y2') - +ln.getAttribute('y1') }; });
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
    await page.click(`#chem-zone-l`); await page.click(`.chem-tile[data-f="${r[0].f}"]`); await page.click('#chem-check');
    ok((await page.textContent('#chem-msg')).includes('物质或位置不对'), 'a formula on the wrong side is refused');
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
      await pg.evaluate(({ chipSel }) => { document.querySelector(chipSel).scrollIntoView({ block: 'start' }); window.scrollBy(0, -10); document.querySelector('.scroll')?.scrollBy?.(0, 0); }, { chipSel });
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
    await pg.tap('#chem-check'); await pg.waitForSelector('#chem-verdict');
    ok((await pg.textContent('#chem-verdict')).includes('回答正确') && await pg.locator('.chem-item.ok').count() === 8, 'all 8 are right: the verdict is right and each item is green');
    await pg.screenshot({ path: OUT + 'touch-class.png', fullPage: true });
    // a wrong drop shows the right class beside the item
    await pg.click('#chem-next'); await pg.waitForSelector('#chem-q [data-id]');
    const q2 = await currentQ(pg); const wrongB = q2.buckets.find((b) => b !== q2.items[0].cat);
    for (const it of q2.items) { await pg.tap(`.chem-item[data-id="${it.id}"]`); await pg.tap(`#chem-bk-${it === q2.items[0] ? wrongB : it.cat}`); }
    await pg.tap('#chem-check'); await pg.waitForSelector('#chem-verdict');
    ok(await pg.locator('.chem-item.bad').count() === 1 && await pg.locator('.chem-item.bad .chem-right').count() === 1 && (await pg.textContent('#chem-verdict')).includes('不正确'), 'a misplaced item is red and shows its right class');
    // touch on the steppers of the balance page: targets are big enough and work
    await pg.evaluate(() => { location.hash = '#/science/chem/bal'; }); await pg.waitForSelector('#chem-q .chem-step-btn');
    const box = await pg.locator('#chem-inc-0').boundingBox(); ok(box.width >= 40 && box.height >= 40, `a stepper button is at least 40 px (${box.width} x ${box.height})`);
    await pg.tap('#chem-inc-0'); ok(+(await pg.textContent('#chem-c-0')) === 2, 'tap on + raises the coefficient');
    ok(log.external.length === 0 && tt.log.external.length === 0, 'no outside request in the touch run');
    await tt.browser.close();
  }

  // =====================================================================================  E. 5 SCREEN SIZES
  const SIZES = [[390, 844], [320, 568], [820, 1180], [1180, 820], [844, 390]];
  for (const [w, hgt] of SIZES) {
    const tl = await open({ viewport: { width: w, height: hgt } });
    const pg = tl.page;
    const pagesToCheck = [['#/science/chem', '#chem-modes', 'home'], ['#/science/chem/ref', '#chem-soltbl', 'ref'], ['#/science/chem/bal', '#chem-eq', 'bal'], ['#/science/chem/wr', '#chem-tiles', 'wr'], ['#/science/chem/cls', '#chem-buckets', 'cls'], ['#/science/chem/calc', '#chem-steps', 'calc'], ['#/science/chem/gas', '#chem-choices', 'gas'], ['#/science/chem/sol', '#chem-q', 'sol'], ['#/science/chem/dec', '#chem-choices', 'dec'], ['#/science/chem/val', '#chem-q', 'val'], ['#/science/chem/type', '#chem-q', 'type']];
    for (const [hash, sel, name] of pagesToCheck) {
      // seeds with the widest content: an equation with five terms (balance), a generator question with a figure (gas)
      await pg.evaluate(async ([name]) => { const C = await import('/src/chemlogic.ts'); await C.loadChem(); const find = (mode, pred) => { for (let s = 1; s < 800; s++) { const q = C.buildRound(mode, 0, s, C.EMPTY_PROGRESS, '2026-11-13')[0]; if (pred(q)) return s; } return 1; }; window.__chemSeed = name === 'bal' ? find('bal', (q) => { const r = C.rxById(q.rx); return r.l.length + r.r.length >= 5; }) : name === 'gas' ? find('gas', (q) => q.kind === 'col' || q.kind === 'gen') : name === 'wr' ? find('wr', (q) => { const r = C.rxById(q.rx); return r.l.length + r.r.length >= 5; }) : 4; }, [name]);
      await go(pg, hash, sel); await pg.waitForTimeout(150);
      const m = await pg.evaluate(() => { const d = document.documentElement; const nar = document.querySelector('.chem-narrow') || document.querySelector('.narrow'); const b = nar.getBoundingClientRect(); const wide = [...document.querySelectorAll('.chem-narrow *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); }).map((e) => e.className || e.tagName).slice(0, 3); return { over: d.scrollWidth - innerWidth, left: b.left, right: innerWidth - b.right, wide }; });
      ok(m.over <= 1 && m.wide.length === 0, `${w}x${hgt} ${name}: nothing sideways (${m.over}, ${m.wide})`);
      ok(Math.abs(m.left - m.right) <= 3, `${w}x${hgt} ${name}: equal space left and right (${m.left.toFixed(0)} / ${m.right.toFixed(0)})`);
      const small = await pg.evaluate(() => [...document.querySelectorAll('.chem-ch, .chem-step-btn, .chem-tile, .chem-item, .chem-mode, .chem-check, .chem-next, .chem-ok, #chem-levels .mopt')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 39.5 || r.width < 39.5); }).map((e) => e.className));
      ok(small.length === 0, `${w}x${hgt} ${name}: every touched control is at least 40 px (${small.slice(0, 3)})`);
      if (['bal', 'wr', 'cls', 'gas', 'home'].includes(name)) await pg.screenshot({ path: `${OUT}size-${w}x${hgt}-${name}.png`, fullPage: true });
    }
    await tl.browser.close();
  }

  // =====================================================================================  F. ENGLISH and FRENCH: no Chinese outside user content
  for (const [locale, label] of [['en-US', 'English'], ['fr-FR', 'French']]) {
    const tl = await open({ locale, viewport: { width: 390, height: 844 } });
    const pg = tl.page; let left = [];
    await go(pg, '#/subject/science', '#open-chem'); left.push(...await chineseLeft(pg));
    await go(pg, '#/science/chem', '#chem-modes'); left.push(...await chineseLeft(pg));
    ok(left.length === 0, `${label}: science home + chemistry home have no Chinese left ${left.slice(0, 4)}`);
    await pg.screenshot({ path: `${OUT}${locale}-home.png`, fullPage: true });
    await go(pg, '#/science/chem/ref', '#chem-soltbl'); left = await chineseLeft(pg);
    for (const tab of ['act', 'val', 'subs', 'ind', 'rx']) { await pg.click('#rt-' + tab); left.push(...await chineseLeft(pg)); }
    ok(left.length === 0, `${label}: the reference tables have no Chinese left ${left.slice(0, 4)}`);
    for (const m of MODES) {
      await pg.evaluate((m) => { window.__chemSeed = 17; location.hash = '#/science/chem/' + m; }, m); await pg.waitForSelector('#chem-q'); await pg.waitForTimeout(60);
      let bad = [];
      for (let i = 0; i < 10; i++) {
        const q = await currentQ(pg); bad.push(...(await chineseLeft(pg)));
        await answer(pg, q, i % 4 !== 1); bad.push(...(await chineseLeft(pg)));
        if (i === 1 || i === 7) await pg.screenshot({ path: `${OUT}${locale}-${m}-${i}.png`, fullPage: true });
        await pg.click('#chem-next'); await pg.waitForTimeout(30);
      }
      bad.push(...await chineseLeft(pg));
      ok(bad.length === 0, `${label} ${m}: a whole round (questions, explanations, summary) has no Chinese left ${[...new Set(bad)].slice(0, 5)}`);
    }
    ok(tl.log.external.length === 0, `${label}: no outside request`);
    await tl.browser.close();
  }
  await done();
})();
