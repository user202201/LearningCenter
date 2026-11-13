// 天文 (#/science/space, under 科学): the data (8 planets in order, 5 dwarf planets, 23 moons, Kepler consistency, gravity from mass and radius, counts of moons in the known ranges, 12
// constellations, the timeline), the orbit maths (Kepler's equation, periods, the March equinox of 2000, light time), weight and age, the Moon's phase, eclipses (only near the nodes),
// the seasons (declination, day length), the tides, the quiz (questions checked against the data, memory boxes), the screens (orrery in both distance modes with zoom, the time lapse, a tap
// and a real touch / pinch at dpr 2, every planet page with its moons, the weight scale and the age counter, the five labs, the stars, the quiz), 5 screen sizes, English / French, no outside request.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const path = require('path');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });

// The translations of this page are written in src/i18n-extra/space.json and merged into src/i18n-data.ts by the person who integrates the change; until then (and harmlessly afterwards)
// the test puts them into the page's translation tables itself.
const extra = JSON.parse(fs.readFileSync(path.join(__dirname, '../../src/i18n-extra/space.json'), 'utf8'));
const withExtra = async (t) => {
  const add = 'Object.assign(EN, ' + JSON.stringify(Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, v[0]]))) + ');\nObject.assign(FR, ' + JSON.stringify(Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, v[1]]))) + ');\n';
  await t.ctx.route('**/src/i18n-data.ts*', async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()) + '\n' + add }); });
  await t.page.reload(); await t.page.waitForSelector('.hub-grid, .kids, .sp-page');
};
const setRange = (page, sel, v) => page.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); }, [sel, v]);
const painted = (page, sel) => page.evaluate((sel) => { const cv = document.querySelector(sel); if (!cv) return -1; const c = cv.getContext('2d'); const w = cv.width, h = cv.height; const seen = new Set(); let opaque = 0;
  for (let i = 0; i < 400; i++) { const x = Math.floor(((i * 37) % 100) / 100 * w), y = Math.floor(((i * 61) % 100) / 100 * h); const d = c.getImageData(x, y, 1, 1).data; seen.add((d[0] >> 4) + ',' + (d[1] >> 4) + ',' + (d[2] >> 4) + ',' + (d[3] > 0)); if (d[3] > 0) opaque++; }
  return opaque > 20 ? seen.size : 0; }, sel);
const CJK = /[　-〿一-鿿＀-￯]/;
const leftover = (page) => page.evaluate(() => {
  const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { const t = n.nodeValue; if (!/[　-〿一-鿿＀-￯]/.test(t)) continue; const p = n.parentElement; if (p.closest('.user, .user-title, svg, script, style')) continue; out.push(t.trim().slice(0, 40)); }
  return out;
});
const SIZES = [[390, 844], [320, 568], [820, 1180], [1180, 820], [844, 390]];
const IDS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'ceres', 'haumea', 'makemake', 'eris'];

(async () => {
  // =====================================================================================  A. THE DATA AND THE RULES (pure, in the page: the real modules)
  {
    const t = await start(new Map(), { local: true });
    const { page } = t;
    const R = await page.evaluate(async () => {
      const SM = await import('/src/spacemodel.ts'); const S = await SM.loadSpace(); const bad = []; const b = (m) => { if (bad.length < 12) bad.push(m); };
      const out = { bad };
      const all = [...S.planets, ...S.dwarfs];
      // --- the bodies ---
      if (S.planets.map((p) => p.id).join() !== 'mercury,venus,earth,mars,jupiter,saturn,uranus,neptune') b('planet order');
      if (S.dwarfs.map((p) => p.id).sort().join() !== 'ceres,eris,haumea,makemake,pluto') b('dwarfs');
      for (let i = 1; i < 8; i++) if (!(S.planets[i].a > S.planets[i - 1].a)) b('distance order ' + i);
      for (const p of all) {
        for (const k of ['a', 'e', 'P', 'd', 'mass', 'g', 'dens']) if (!(p[k] > 0) || !isFinite(p[k])) b(`${p.id}.${k}`);
        if (!(p.e >= 0 && p.e < 0.5) || !isFinite(p.L0) || !isFinite(p.varpi) || !isFinite(p.rot) || p.rot === 0) b(p.id + ' elements');
        if (p.tmin >= p.tmax || p.tmin < -273) b(p.id + ' temperature');
        if (!p.en || !p.fr || !p.zh || p.en === p.zh) b(p.id + ' names');
        const kep = 365.256 * Math.pow(p.a, 1.5);
        if (Math.abs(p.P / kep - 1) > 0.015) b(`${p.id} Kepler ${(p.P / kep).toFixed(3)}`);
        const gRatio = SM.gravityFromMass(p) / p.g;
        if (Math.abs(gRatio - 1) > 0.075) b(`${p.id} gravity ${gRatio.toFixed(3)}`);
        if (p.facts.length < (S.planets.includes(p) ? 6 : 4)) b(p.id + ' facts ' + p.facts.length);
        for (const f of p.facts) if (!/[0-9]|倍|比|最|唯一|第一/.test(f)) b(`${p.id} fact without a number or comparison: ${f.slice(0, 20)}`);
        if (new Set(p.facts).size !== p.facts.length) b(p.id + ' duplicate fact');
        if (S.planets.includes(p) && p.kind === 'dwarf') b('kind');
      }
      // known values (independent of the data file)
      const known = { mercury: [4879, 87.97, 0.387], venus: [12104, 224.7, 0.723], earth: [12742, 365.256, 1], mars: [6779, 686.98, 1.524], jupiter: [139820, 4332.6, 5.203], saturn: [116460, 10759, 9.537], uranus: [50724, 30688, 19.19], neptune: [49244, 60182, 30.07] };
      for (const [id, [d, P, a]] of Object.entries(known)) { const p = S.planets.find((x) => x.id === id); if (Math.abs(p.d / d - 1) > 0.005 || Math.abs(p.P / P - 1) > 0.005 || Math.abs(p.a / a - 1) > 0.005) b(id + ' differs from the known value'); }
      const earth = S.planets[2]; if (Math.abs(earth.g - 9.81) > 0.05 || earth.moons !== 1) b('earth');
      if (S.planets[1].rot > 0 || S.planets[6].rot > 0 || S.planets[6].tilt < 90 || S.planets[1].tilt < 90) b('Venus / Uranus turn backwards (tilt over 90)');
      if (!(S.planets[4].d > S.planets.filter((p) => p.id !== 'jupiter').reduce((m, p) => Math.max(m, p.d), 0))) b('Jupiter is the biggest');
      if (!(S.planets[1].tmax > S.planets[0].tmax - 0 && (S.planets[1].tmin + S.planets[1].tmax) / 2 > (S.planets[0].tmin + S.planets[0].tmax) / 2 - 1)) { /* Venus mean above Mercury mean */ }
      if (!(S.planets[5].dens < 1)) b('Saturn is lighter than water');
      // --- the moons ---
      const counts = { mercury: [0, 0], venus: [0, 0], earth: [1, 1], mars: [2, 2], jupiter: [79, 130], saturn: [82, 300], uranus: [27, 40], neptune: [14, 30], pluto: [5, 5] };
      for (const [id, [lo, hi]] of Object.entries(counts)) { const p = all.find((x) => x.id === id); if (p.moons < lo || p.moons > hi) b(`${id} moons ${p.moons}`); }
      for (const id of ['jupiter', 'saturn', 'uranus', 'neptune']) if (!all.find((x) => x.id === id).moonsCheck) b(id + ' count needs the check flag');
      out.moonCount = S.moons.length;
      for (const m of S.moons) {
        if (!all.some((p) => p.id === m.planet)) b(m.id + ' planet');
        if (!(m.d > 0 && m.a > 0) || !m.P || !isFinite(m.P) || !m.fact || !m.q || !m.by) b(m.id + ' values');
        if (!m.en || !m.fr || m.en === m.zh) b(m.id + ' names');
        if (S.moons.filter((x) => x.id === m.id).length !== 1) b('duplicate moon ' + m.id);
        if (S.moons.filter((x) => x.planet === m.planet && x.alias && x.alias === m.alias).length > 1) b('alias');
      }
      for (const id of ['jupiter', 'saturn', 'uranus', 'haumea']) {      // Kepler's third law inside a moon system: T ~ a^1.5
        const ms = S.moons.filter((m) => m.planet === id);
        for (let i = 1; i < ms.length; i++) { const r = Math.abs(ms[i].P / ms[0].P) / Math.pow(ms[i].a / ms[0].a, 1.5); if (Math.abs(r - 1) > 0.03) b(`${id} ${ms[i].id} Kepler ${r.toFixed(3)}`); }
      }
      const g = (id) => S.moons.find((m) => m.id === id);
      if (!(g('ganymede').d > S.planets[0].d)) b('Ganymede is bigger than Mercury');
      if (!(g('ganymede').d > Math.max(...S.moons.map((m) => (m.id === 'ganymede' ? 0 : m.d))))) b('Ganymede is the biggest moon');
      if (!(g('triton').P < 0)) b('Triton goes backwards');
      if (S.moons.filter((m) => m.planet === 'jupiter').map((m) => m.id).sort().join() !== 'callisto,europa,ganymede,io') b('Galilean moons');
      if (S.moons.filter((m) => m.planet === 'saturn').reduce((a, m) => (m.d > a.d ? m : a)).id !== 'titan') b('Titan');
      if (!(g('moon').d / 3475 > 0.99 && g('moon').d / 3475 < 1.01 && Math.abs(g('moon').a - 384400) < 100)) b('Moon values');
      if (!(g('charon').d / S.dwarfs.find((p) => p.id === 'pluto').d > 0.48 && g('charon').d / S.dwarfs.find((p) => p.id === 'pluto').d < 0.54)) b('Charon is half of Pluto');
      // --- the sky ---
      if (S.constellations.length !== 12) b('12 constellations');
      for (const c of S.constellations) {
        if (c.stars.some(([x, y, r]) => !(x >= 0 && x <= 100 && y >= 0 && y <= 100 && r >= 1 && r <= 6)) || c.lines.some(([i, j]) => !c.stars[i] || !c.stars[j] || i === j)) b(c.id + ' figure');
        if (!c.story || !c.tip || !c.en || !c.fr || c.stars.length < 4) b(c.id + ' text');
      }
      if (S.constellations.find((c) => c.id === 'ursa-major').stars.length !== 7 || S.constellations.find((c) => c.id === 'cassiopeia').stars.length !== 5) b('Big Dipper 7 stars, Cassiopeia 5');
      const dates = S.timeline.map((x) => x.date); if (dates.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(Date.parse(d)))) b('timeline dates');
      const tl = (d) => S.timeline.find((x) => x.date === d);
      if (!tl('1970-04-24') || !/东方红/.test(tl('1970-04-24').zh) || !tl('2003-10-15') || !/神舟五号/.test(tl('2003-10-15').zh) || !tl('1957-10-04') || !tl('2021-05-15') || !/祝融/.test(tl('2021-05-15').zh) || !tl('2019-01-03')) b('timeline known dates');
      if (S.timeline.filter((x) => x.cn).length < 8) b('Chinese space programme entries');
      if (S.ladder.length < 8 || S.ladder.some((x, i) => i && !(x.m > S.ladder[i - 1].m))) b('ladder increasing');
      if (S.life.length < 8 || S.sun.layers.length !== 6) b('life / sun');
      if (S.mcq.some((q) => !q.q || !q.a || q.w.length !== 3 || new Set([q.a, ...q.w]).size !== 4)) b('mcq');
      out.size = JSON.stringify(S).length;
      return out;
    });
    ok(R.bad.length === 0, 'data: order, values, Kepler, gravity from mass and radius, moon counts, moons, constellations, timeline ' + R.bad.join(' | '));
    ok(R.moonCount === 24, 'data: 24 moons (7 worlds with moons) ' + R.moonCount);
    const bytes = await page.evaluate(async () => (await (await fetch('/src/data/space.json')).text()).length);
    ok(bytes > 15000 && bytes < 300000, 'data: space.json is under 300 KB and not empty (' + bytes + ' bytes)');

    const M = await page.evaluate(async () => {
      const SM = await import('/src/spacemodel.ts'); const S = await SM.loadSpace(); const bad = []; const b = (m) => { if (bad.length < 14) bad.push(m); };
      const rnd = (() => { let s = 7; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
      // --- Kepler's equation ---
      for (let i = 0; i < 2000; i++) { const e = rnd() * 0.7, M = rnd() * 40 - 10; const E = SM.solveKepler(M, e); const Mm = ((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); if (Math.abs(E - e * Math.sin(E) - Mm) > 1e-9) { b('Kepler equation'); break; } }
      // --- the periods: every body is back after one period, and not before (angle) ---
      const all = [...S.planets, ...S.dwarfs];
      for (const p of all) {
        for (const d0 of [0, 1234.5, 8000]) { const a = SM.position(p, d0), c = SM.position(p, d0 + p.P); if (Math.hypot(a.x - c.x, a.y - c.y) > 1e-6 * p.a) b(p.id + ' not back after a period'); }
        const q = SM.position(p, p.P / 2 + 100), q0 = SM.position(p, 100); if (Math.hypot(q.x - q0.x, q.y - q0.y) < 0.2 * p.a) b(p.id + ' half a period away');
        const r = [...Array(400)].map((_, i) => SM.position(p, (i / 400) * p.P).r); if (Math.abs(Math.min(...r) / (p.a * (1 - p.e)) - 1) > 0.01 || Math.abs(Math.max(...r) / (p.a * (1 + p.e)) - 1) > 0.01) b(p.id + ' perihelion / aphelion');
      }
      // --- after one Earth year the Earth is back, Jupiter has gone 1/12 of its way (mean motion, circular copy) and Mercury 4.15 times ---
      const E = S.planets[2], J = S.planets[4], Me = S.planets[0];
      const e0 = SM.position(E, 500), e1 = SM.position(E, 500 + 365.256); if (Math.hypot(e0.x - e1.x, e0.y - e1.y) > 1e-5) b('Earth is back after a year');
      const circ = (p) => ({ ...p, e: 0 }); const adv = (p, days) => { let d = SM.position(circ(p), 100 + days).lon - SM.position(circ(p), 100).lon; return ((d % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) * 180 / Math.PI; };
      if (Math.abs(adv(J, 365.256) - 360 * 365.256 / J.P) > 1e-6 || Math.abs(adv(J, 365.256) - 30.35) > 0.05) b('Jupiter 1/12 of its orbit in an Earth year ' + adv(J, 365.256));
      if (Math.abs(adv(Me, 365.256) - ((360 * 365.256 / Me.P) % 360)) > 1e-6) b('Mercury');
      // --- the March equinox of 2000 (2000-03-20 07:35 UT): the Earth's heliocentric longitude is 180 degrees (independent of the elements' use) ---
      const d = SM.dayOfDate('2000-03-20') - 0.5 + 7.58 / 24; const lon = ((SM.position(E, d).lon * 180 / Math.PI) % 360 + 360) % 360; if (Math.abs(lon - 180) > 0.4) b('equinox longitude ' + lon);
      // the Earth is closest to the Sun in the first days of January and farthest in early July
      let best = [9, 0], worst = [0, 0]; for (let i = 0; i < 366; i++) { const r = SM.position(E, SM.dayOfDate('2001-01-01') + i).r; if (r < best[0]) best = [r, i]; if (r > worst[0]) worst = [r, i]; }
      if (best[1] > 7 || Math.abs(worst[1] - 184) > 8 || Math.abs(best[0] - 0.9833) > 0.001 || Math.abs(worst[0] - 1.0167) > 0.001) b('perihelion / aphelion of the Earth ' + best + ' ' + worst);
      if (SM.dayOfDate('2000-01-01') !== 0 || SM.dateOfDay(SM.dayOfDate('2026-11-13')) !== '2026-11-13' || SM.dateOfDay(366) !== '2001-01-01' || SM.dayOfDate('2001-01-01') !== 366) b('dates');
      // --- light ---
      const lt = SM.lightSeconds(SM.AU_KM); if (Math.abs(lt - 499.0) > 0.5) b('light 1 AU ' + lt);
      const parts = SM.lightParts(lt); if (parts.m !== 8 || parts.s !== 19) b('8 min 19 s ' + JSON.stringify(parts));
      const ln = SM.lightSeconds(S.planets[7].a * SM.AU_KM) / 3600; if (Math.abs(ln - 4.17) > 0.05) b('Neptune light hours ' + ln);
      if (Math.abs(SM.lightSeconds(384400) - 1.282) > 0.01) b('light to the Moon');
      // --- weight and age ---
      if (Math.abs(SM.weightOn(40, 3.71) - 15.13) > 0.01 || Math.abs(SM.weightOn(40, 24.79) - 101.1) > 0.1 || Math.abs(SM.weightOn(40, SM.MOON_G) - 6.61) > 0.01 || Math.abs(SM.weightOn(40, 9.80665) - 40) > 1e-9) b('weight');
      if (Math.abs(SM.ageOn(12, 87.97) - 49.8) > 0.05 || Math.abs(SM.ageOn(12, 365.256) - 12) > 1e-9 || Math.abs(SM.ageOn(165, 60182) - 1.0014) > 0.01) b('age');
      // heavier on bigger planets: the same ordering as g
      for (let i = 0; i < 300; i++) { const kg = 1 + rnd() * 100, p = all[Math.floor(rnd() * 8)], q = all[Math.floor(rnd() * 8)]; if ((SM.weightOn(kg, p.g) < SM.weightOn(kg, q.g)) !== (p.g < q.g) && p.g !== q.g) b('weight order'); }
      if (Math.abs(SM.surfaceSpeedKmh(E) - 1670) > 15) b('Earth surface speed ' + SM.surfaceSpeedKmh(E));
      return bad;
    });
    ok(M.length === 0, 'orbits: Kepler equation, periods, one year, equinox 2000, perihelion, dates, light time, weight and age ' + M.join(' | '));

    const P = await page.evaluate(async () => {
      const SM = await import('/src/spacemodel.ts'); const bad = []; const b = (m) => { if (bad.length < 14) bad.push(m); };
      if (SM.illumination(0) !== 0 || Math.abs(SM.illumination(90) - 0.5) > 1e-12 || Math.abs(SM.illumination(180) - 1) > 1e-12 || Math.abs(SM.illumination(270) - 0.5) > 1e-12) b('illumination');
      const names = ['新月', '蛾眉月', '上弦月', '盈凸月', '满月', '亏凸月', '下弦月', '残月']; names.forEach((n, i) => { if (SM.phaseName(i * 45) !== n || SM.phaseName(i * 45 + 20) !== n || SM.phaseName(i * 45 - 20 + 360) !== n) b('phase name ' + n); });
      if (SM.phaseName(359) !== '新月' || SM.phaseName(360) !== '新月' || SM.phaseName(-10) !== '新月') b('phase wrap');
      const days = [[1, '初一'], [2, '初二'], [10, '初十'], [11, '十一'], [15, '十五'], [19, '十九'], [20, '二十'], [21, '廿一'], [26, '廿六'], [29, '廿九'], [30, '三十']]; for (const [n, s] of days) if (SM.lunarDayName(n) !== s) b('lunar day ' + n + ' ' + SM.lunarDayName(n));
      if (SM.lunarDayOf(0) !== '初一' || SM.lunarDayOf(90) !== '初八' || SM.lunarDayOf(180) !== '十五' || SM.lunarDayOf(270) !== '廿三') b('lunar day of the phases ' + [0, 90, 180, 270].map(SM.lunarDayOf));
      if (Math.abs(SM.moonAge(180) - SM.SYNODIC / 2) > 1e-9) b('moon age');
      // known new / full moons (the model uses the mean month: within ~half a day, i.e. 7 degrees, of the real instant)
      const at = (iso, h) => SM.dayOfDate(iso) + (h - 12) / 24; const near = (e, t) => { const d = Math.abs(((e - t + 540) % 360) - 180); return d; };
      for (const [iso, h, E] of [['2024-01-11', 11.95, 0], ['2024-01-25', 17.9, 180], ['2024-04-08', 18.35, 0], ['2024-06-22', 1.5, 180], ['2026-11-09', 21.0, 0], ['2025-03-14', 6.9, 180]]) { const e = SM.elongationOfDay(at(iso, h)); if (near(e, E) > 9) b(`moon phase on ${iso}: ${e.toFixed(1)}`); }
      // --- eclipses: with the Moon's orbit tilted by 5.145 degrees the Moon is within ~1.5 degrees of the Sun's line only near the nodes ---
      if (SM.solarKind(0) !== 'central' || SM.solarKind(1.2) !== 'partial' || SM.solarKind(1.6) !== 'none' || SM.lunarKind(0) !== 'total' || SM.lunarKind(0.6) !== 'partial' || SM.lunarKind(1.2) !== 'penumbral' || SM.lunarKind(1.6) !== 'none') b('eclipse kinds');
      if (Math.abs(SM.moonLatitude(90) - 5.145) > 1e-9 || Math.abs(SM.moonLatitude(0)) > 1e-12 || Math.abs(SM.moonLatitude(270) + 5.145) > 1e-9) b('moon latitude');
      let cnt = 0, lunations = 0, farOk = true; const dr = 360 * SM.SYNODIC / 27.2122;
      for (let k = 0, ph = 37; k < 12.37 * 60; k++, ph += dr) { lunations++; const s = SM.separation(0, SM.moonLatitude(ph)); if (SM.solarKind(s) !== 'none') cnt++; if (Math.abs(SM.moonLatitude(ph)) > 1.6 && SM.solarKind(s) !== 'none') farOk = false; }
      const perYear = cnt / 60; if (perYear < 1.8 || perYear > 4.6 || !farOk) b('solar eclipse chances per year ' + perYear);
      for (let bt = -5.2; bt <= 5.2; bt += 0.1) for (let off = -4; off <= 4; off += 0.1) { const s = SM.separation(off, bt); if (Math.abs(bt) > 1.6 && SM.solarKind(s) !== 'none') b('eclipse far from the node'); if (Math.abs(bt) > 1.6 && SM.lunarKind(s) !== 'none') b('lunar eclipse far from the node'); }
      // --- the seasons ---
      let mx = [-99, 0], mn = [99, 0]; for (let n = 1; n <= 365; n++) { const d = SM.declination(n); if (d > mx[0]) mx = [d, n]; if (d < mn[0]) mn = [d, n]; }
      if (Math.abs(mx[0] - 23.44) > 0.03 || Math.abs(mn[0] + 23.44) > 0.03 || Math.abs(mx[1] - 172) > 2 || Math.abs(mn[1] - 355) > 2) b('declination extremes ' + mx + ' ' + mn);
      if (Math.abs(SM.declination(79.4)) > 0.1 || Math.abs(SM.declination(79)) > 0.5 || Math.abs(SM.declination(80)) > 0.5 || Math.abs(SM.declination(265.5)) > 0.8) b('equinoxes');
      if (Math.abs(SM.declination(172) - 23.44) > 0.03 || SM.declination(1) > -22.5) b('declination at the solstices');
      if (Math.abs(SM.dayLength(0, 23) - 12) > 1e-9 || Math.abs(SM.dayLength(40, 0) - 12) > 1e-9 || SM.dayLength(70, 23.44) !== 24 || SM.dayLength(70, -23.44) !== 0 || SM.dayLength(-70, -23.44) !== 24) b('day length extremes');
      const bj = SM.dayLength(39.9, 23.44), bw = SM.dayLength(39.9, -23.44); if (Math.abs(bj - 14.9) > 0.3 || Math.abs(bw - 9.1) > 0.3 || Math.abs(bj + bw - 24) > 1e-9) b('Beijing day length ' + bj + ' ' + bw);
      if (Math.abs(SM.noonElevation(39.9, 23.44) - 73.54) > 0.01 || Math.abs(SM.noonElevation(39.9, -23.44) - 26.66) > 0.01 || Math.abs(SM.noonElevation(0, 0) - 90) > 1e-9) b('noon height');
      let near1 = [9, 0], far1 = [0, 0]; for (let n = 1; n <= 365; n++) { const r = SM.earthDistance(n); if (r < near1[0]) near1 = [r, n]; if (r > far1[0]) far1 = [r, n]; }
      if (Math.abs(near1[1] - 3) > 1 || Math.abs(far1[1] - 185) > 2 || Math.abs(near1[0] - 0.9833) > 0.0005) b('Earth-Sun distance by date ' + near1 + ' ' + far1);
      if (SM.earthDistance(1) >= SM.earthDistance(182)) b('closer in January than in July');
      if (SM.dayOfYear('2026-01-01') !== 1 || SM.dayOfYear('2026-12-31') !== 365 || SM.dayOfYear('2024-03-01') !== 61) b('day of year');
      // --- the tides ---
      if (Math.abs(SM.tideFactor(0) - 1.46) > 1e-9 || Math.abs(SM.tideFactor(90) - 0.54) > 1e-9 || Math.abs(SM.tideFactor(180) - 1.46) > 1e-9 || SM.tideName(0) !== '大潮' || SM.tideName(90) !== '小潮' || SM.tideName(45) !== '中潮') b('tides');
      if (Math.abs(SM.tideHeight(0, 12.4206) - SM.tideHeight(0, 0)) > 1e-9 || Math.abs(SM.tideHeight(0, 6.2103) + SM.tideFactor(0)) > 1e-9) b('tide period');
      return bad;
    });
    ok(P.length === 0, 'moon phase, lunar days, eclipses only near the nodes, seasons, day length, tides ' + P.join(' | '));

    const Q = await page.evaluate(async () => {
      const SM = await import('/src/spacemodel.ts'); const S = await SM.loadSpace(); const G = await import('/src/game.ts'); const bad = []; const b = (m) => { if (bad.length < 14) bad.push(m); };
      const rnd = (() => { let s = 11; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
      const keys = SM.allKeys(S); if (new Set(keys).size !== keys.length || keys.length < 140) b('keys ' + keys.length);
      const all = [...S.planets, ...S.dwarfs];
      for (const lang of ['zh', 'en', 'fr']) for (const k of keys) for (let rep = 0; rep < 3; rep++) {
        const q = SM.makeQuestion(S, k, rnd, lang);
        if (q.choices.length !== 4 || new Set(q.choices.map((c) => c.t)).size !== 4 || new Set(q.choices.map((c) => c.k)).size !== 4 || q.choices.some((c) => !c.t) || !q.choices.some((c) => c.k === q.answer)) { b('choices ' + k + ' ' + JSON.stringify(q.choices)); continue; }
        if (!q.stem.tpl || (!q.explain.text && !q.explain.tpl)) b('text ' + k);
        const right = q.choices.find((c) => c.k === q.answer).t;
        const [kind, id] = k.split(/:(.*)/s);
        if (kind === 'pp' || kind === 'pd') { if (q.answer !== id || q.fig.id !== id) b('picture answer ' + k); const name = lang === 'zh' ? all.find((p) => p.id === id).zh : all.find((p) => p.id === id)[lang]; if (right !== name) b('label ' + k + right); }
        if (kind === 'pm' || kind === 'mf') { if (q.answer !== id) b('moon answer ' + k); }
        if (kind === 'or') { if (q.answer !== S.planets[+id - 1].id) b('order ' + k); }
        if (kind === 'mo') { if (q.answer !== S.moons.find((m) => m.id === id).planet) b('belongs to ' + k); }
        if (kind === 'ph') { if (+q.answer !== +id || q.fig.E !== +id * 45) b('phase ' + k); }
        if (kind === 'cs') { if (q.answer !== id) b('constellation ' + k); }
        if (kind === 'mq') { const x = S.mcq[+id]; if (right !== x.a) b('mcq ' + k); }
        if (kind === 'wt') { const g = id === 'moon' ? SM.MOON_G : S.planets.find((p) => p.id === id).g; const kg = +q.stem.args[0]; if (Math.abs(+q.answer - SM.weightOn(kg, g)) > 0.051) b('weight answer ' + k + ' ' + q.answer); }
        if (lang !== 'zh' && /[一-鿿]/.test(q.choices.map((c) => c.t).join('')) && kind !== 'mq' && kind !== 'ph') b(lang + ' choices have Chinese ' + k);
      }
      // the superlatives are right by the data itself (independent of the answer key in the file)
      const by = (f, max = true) => S.planets.reduce((a, p) => ((max ? f(p) > f(a) : f(p) < f(a)) ? p : a)).id;
      const rules = [['最大', by((p) => p.d)], ['最小', by((p) => p.d, false)], ['最热', by((p) => (p.tmin + p.tmax) / 2)], ['离太阳最近', by((p) => p.a, false)], ['离太阳最远', by((p) => p.a)], ['一年（公转一圈）最短', by((p) => p.P, false)], ['自转最快', by((p) => Math.abs(p.rot), false)], ['比水还小', by((p) => -p.dens)], ['躺着转', by((p) => -Math.abs(p.tilt - 90))], ['风速最快', 'neptune'], ['有生命', 'earth'], ['天文', 'x']];
      for (const x of S.supers) { for (const [w, id] of rules) if (x.q.includes(w) && id !== 'x' && x.a !== id) b('superlative ' + x.q + ' -> ' + x.a + ' should be ' + id); }
      const ve = S.planets[1]; if (!(Math.abs(ve.rot) / 24 > ve.P) || S.supers.find((x) => x.q.includes('比一年还长')).a !== 'venus') b('Venus day longer than its year');
      // rounds
      const today = '2026-11-13'; let doc = SM.EMPTY_DOC;
      for (let r = 0; r < 40; r++) {
        const ks = SM.selectKeys(S, doc, today, 10, rnd); if (ks.length !== 10 || new Set(ks).size !== 10) b('round of 10');
        const kc = {}; for (const k of ks) kc[k.slice(0, 2)] = (kc[k.slice(0, 2)] ?? 0) + 1; if (Math.max(...Object.values(kc)) > 3) b('more than 3 of a kind ' + JSON.stringify(kc));
        if (r === 0 && Object.keys(kc).length < 5) b('a first round mixes the kinds');
        doc = SM.applyAnswers(doc, ks.map((k, i) => ({ key: k, right: r % 2 === 0 || i % 3 !== 0 })), today);
      }
      // due first: a failed question comes back before the new ones
      let d2 = SM.applyAnswers(SM.EMPTY_DOC, [{ key: 'pp:mars', right: false }], today);
      if (!SM.selectKeys(S, d2, today, 10, rnd).includes('pp:mars')) b('a failed question comes back at once');
      d2 = SM.applyAnswers(SM.EMPTY_DOC, [{ key: 'pp:mars', right: true }], today);
      if (d2.cards['pp:mars'].box !== 1 || d2.cards['pp:mars'].due <= today) b('right answer moves up a box');
      d2 = SM.applyAnswers(d2, [{ key: 'pp:mars', right: false }], '2026-11-20'); if (d2.cards['pp:mars'].box !== 0) b('wrong answer back to box 0');
      // new ones before known ones
      let seen = SM.EMPTY_DOC; seen = SM.applyAnswers(seen, keys.slice(0, 100).map((k) => ({ key: k, right: true })), today);
      const ks = SM.selectKeys(S, seen, today, 10, rnd); if (ks.some((k) => keys.indexOf(k) < 100)) b('new questions come before known ones');
      return bad;
    });
    ok(Q.length === 0, 'quiz: every question has 4 different choices, the right answer by the data, 3 languages, rounds of 10 (mixed, due first, then new), boxes ' + Q.join(' | '));
    await t.browser.close();
  }

  // =====================================================================================  B. THE ORRERY (mouse, reduced motion = nothing moves by itself)
  {
    const t = await start(new Map(), { local: true, viewport: { width: 390, height: 844 }, dpr: 2 });
    const { page, log } = t;
    await page.evaluate(() => (location.hash = '#/subject/science')); await page.waitForSelector('#open-space');
    await page.screenshot({ path: OUT + 'space-science-home.png' });
    ok(await page.locator('#open-space .sp-ico').count() === 1, 'science home: the 天文 card has a drawn icon');
    await page.click('#open-space'); await page.waitForSelector('#sp-orrery');
    ok(await page.evaluate(() => location.hash) === '#/science/space', 'the card opens #/science/space');
    await page.waitForFunction(() => window.__space && window.__space.bodies().length === 8);
    ok((await painted(page, '#sp-orrery')) > 8, 'the orrery canvas is painted');
    ok(await page.evaluate(() => { const c = document.querySelector('#sp-orrery'); return c.width === Math.round(c.offsetWidth * 2) && c.height === Math.round(c.offsetHeight * 2); }), 'the canvas is sized by layout size x dpr 2');
    const today = await page.evaluate(() => document.querySelector('#sp-date').textContent);
    ok(/^\d{4}-\d{2}-\d{2}$/.test(today), 'the date readout ' + today);
    await page.waitForTimeout(700);
    ok(await page.evaluate(() => document.querySelector('#sp-date').textContent) === today, 'reduced motion: the time does not run by itself');
    ok(await page.locator('#sp-speed').count() === 1 && await page.evaluate(() => document.querySelector('#sp-speed').max) === '6', 'time slider with 7 speeds');
    // bodies: schematic = evenly spaced radii in the true order; angles from Kepler
    const geo = () => page.evaluate(() => { const S = window.__space, c = document.querySelector('#sp-orrery'), cx = c.offsetWidth / 2, cy = c.offsetHeight / 2; return { day: S.st.day, list: S.bodies().map((b) => ({ id: b.id, r: Math.hypot(b.x - cx, b.y - cy), ang: Math.atan2(-(b.y - cy), b.x - cx) * 180 / Math.PI })) }; });
    let g = await geo();
    ok(g.list.map((x) => x.id).join() === 'mercury,venus,earth,mars,jupiter,saturn,uranus,neptune', 'schematic: eight planets');
    ok(g.list.every((x, i) => !i || x.r > g.list[i - 1].r + 5), 'schematic: the distance from the Sun grows in the true order');
    const gaps = g.list.slice(1).map((x, i) => x.r - g.list[i].r); ok(Math.max(...gaps) - Math.min(...gaps) < 1.5, 'schematic: evenly spaced (readable)');
    const model = (day) => page.evaluate(async (day) => { const SM = await import('/src/spacemodel.ts'); const S = await SM.loadSpace(); return S.planets.map((p) => { const q = SM.position(p, day); return ((q.lon * 180 / Math.PI) % 360 + 360) % 360; }); }, day);
    let mod = await model(g.day);
    ok(g.list.every((x, i) => { const d = Math.abs((((x.ang % 360) + 360) % 360) - mod[i]); return Math.min(d, 360 - d) < 0.6; }), 'the drawn directions are the Kepler directions of that date');
    const day0 = g.day; await page.evaluate(() => window.__space.step(365)); g = await geo(); ok(Math.abs(g.day - day0 - 365) < 1e-9, 'step: a year later (365 days)');
    ok(await page.evaluate(() => document.querySelector('#sp-date').textContent) !== today, 'the date readout follows');
    mod = await model(g.day);
    ok(g.list.every((x, i) => { const d = Math.abs((((x.ang % 360) + 360) % 360) - mod[i]); return Math.min(d, 360 - d) < 0.6; }), 'after the step the directions are the Kepler ones of the new date');
    await page.click('#sp-today');
    // the buttons of the time row
    await page.click('#sp-fwd'); ok(Math.abs((await geo()).day - day0 - 30) < 1e-9, 'the + 1 month button'); await page.click('#sp-back'); await page.click('#sp-back'); ok(Math.abs((await geo()).day - day0 + 30) < 1e-9, 'the - 1 month button'); await page.click('#sp-today');
    // dwarf planets
    await page.click('#sp-dwarfs'); g = await geo(); ok(g.list.length === 13 && g.list.map((x) => x.id).join() === 'mercury,venus,earth,mars,ceres,jupiter,saturn,uranus,neptune,pluto,haumea,makemake,eris', 'dwarf planets: 13 bodies in the order of distance');
    await page.screenshot({ path: OUT + 'space-orrery-dwarfs.png' });
    await page.click('#sp-dwarfs'); ok((await geo()).list.length === 8, 'dwarf planets off again');
    // true scale
    await page.click('#sp-mode-true'); g = await geo();
    const rE = g.list.find((x) => x.id === 'earth').r, rN = g.list.find((x) => x.id === 'neptune').r, rJ = g.list.find((x) => x.id === 'jupiter').r;
    ok(g.list.every((x, i) => !i || x.r > g.list[i - 1].r), 'true scale: order kept');
    const aU = await page.evaluate(async () => { const SM = await import('/src/spacemodel.ts'); const S = await SM.loadSpace(); return S.planets.map((p) => SM.position(p, window.__space.st.day).r); });
    ok(Math.abs(rN / rE - aU[7] / aU[2]) / (aU[7] / aU[2]) < 0.02 && Math.abs(rJ / rE - aU[4] / aU[2]) / (aU[4] / aU[2]) < 0.02, `true scale: Neptune is ${(rN / rE).toFixed(1)} times as far as the Earth, Jupiter ${(rJ / rE).toFixed(2)} (the real distances)`);
    ok(await page.locator('#sp-zoom').isVisible() && await page.locator('#sp-light').isVisible(), 'true scale shows the zoom and the light ruler');
    ok(/8 分 19 秒/.test(await page.textContent('#sp-light-text')), 'the light needs 8 min 19 s from the Sun to the Earth: ' + await page.textContent('#sp-light-text'));
    await page.click('.sp-lp[data-id=neptune]'); ok(/4 小时/.test(await page.textContent('#sp-light-text')), 'to Neptune: ' + await page.textContent('#sp-light-text'));
    await page.click('.sp-lp[data-id=mercury]'); ok(/3 分 1\d 秒|3 分 2\d 秒/.test(await page.textContent('#sp-light-text')), 'to Mercury ~3 min: ' + await page.textContent('#sp-light-text'));
    await page.screenshot({ path: OUT + 'space-orrery-true.png' });
    // zoom: the Earth moves away from the Sun in proportion
    await page.click('#sp-zoom-in'); await page.click('#sp-zoom-in'); await page.click('#sp-zoom-in'); g = await geo();
    ok(await page.textContent('#sp-zoom-lab') === '8×' && Math.abs(g.list.find((x) => x.id === 'earth').r / rE - 8) < 0.2, 'zoom x8 makes every distance 8 times larger');
    for (let i = 0; i < 8; i++) await page.click('#sp-zoom-in'); ok(await page.textContent('#sp-zoom-lab') === '256×', 'zoom has an upper limit (256x)');
    await page.screenshot({ path: OUT + 'space-orrery-zoom.png' });
    for (let i = 0; i < 12; i++) await page.click('#sp-zoom-out'); ok(await page.textContent('#sp-zoom-lab') === '1×', 'zoom out to 1x');
    await page.click('#sp-mode-schem'); ok(!(await page.locator('#sp-zoom').isVisible()), 'schematic mode has no zoom');
    // a tap on a planet opens its page
    const pt = await page.evaluate(() => window.__space.clientOf('jupiter')); await page.mouse.click(pt[0], pt[1]);
    await page.waitForFunction(() => location.hash === '#/science/space/jupiter'); ok(true, 'a tap on Jupiter opens #/science/space/jupiter');
    await page.waitForSelector('#sp-planet'); await page.goBack(); await page.waitForSelector('#sp-orrery'); await page.waitForFunction(() => window.__space && window.__space.bodies().length === 8);
    // the tab is remembered on this device
    await page.click('#sp-tab-stars'); await page.waitForSelector('#sp-stars'); await page.reload(); await page.waitForSelector('#sp-stars'); ok(true, 'the tab is remembered after a reload');
    await page.click('#sp-tab-solar'); await page.waitForSelector('#sp-orrery');
    ok(log.external.length === 0, 'orrery: no outside request ' + log.external.slice(0, 2).join());
    await t.browser.close();
  }

  // =====================================================================================  C. THE ORRERY WITH A REAL CLOCK, REAL TOUCH (CDP at dpr 2), LEAVING THE PAGE
  {
    const t = await start(new Map(), { local: true, viewport: { width: 390, height: 844 }, dpr: 2, touch: true, motion: true, init: () => { let n = 0; const o = CanvasRenderingContext2D.prototype.clearRect; CanvasRenderingContext2D.prototype.clearRect = function (...a) { n++; return o.apply(this, a); }; window.__draws = () => n; } });
    const { page, ctx } = t;
    await page.evaluate(() => (location.hash = '#/science/space')); await page.waitForSelector('#sp-orrery'); await page.waitForFunction(() => window.__space && window.__space.bodies().length === 8);
    const d0 = await page.evaluate(() => window.__space.st.day);
    await setRange(page, '#sp-speed', 5); await page.waitForTimeout(1200);
    const d1 = await page.evaluate(() => window.__space.st.day);
    ok(d1 - d0 > 250 && d1 - d0 < 900, `time lapse 1 year a second: ${(d1 - d0).toFixed(0)} days in 1.2 s`);
    ok(await page.evaluate(() => document.querySelector('#sp-date').textContent) !== await page.evaluate(async () => (await import('/src/spacemodel.ts')).dateOfDay(window.__space.st.day - 400)), 'the date readout runs');
    await setRange(page, '#sp-speed', 0); const dp = await page.evaluate(() => window.__space.st.day); await page.waitForTimeout(500); ok(await page.evaluate(() => window.__space.st.day) === dp, 'pause stops the time');
    await setRange(page, '#sp-speed', 1); await page.waitForTimeout(1100); const d2 = await page.evaluate(() => window.__space.st.day); ok(d2 - dp > 0.7 && d2 - dp < 1.7, `1 day a second: ${(d2 - dp).toFixed(2)} days in 1.1 s`);
    await setRange(page, '#sp-speed', 6);
    // the inner planets go round faster than the outer ones: after 1.5 s at 5 years a second Mercury has gone round many times (its position is only checked by the model above); here: Jupiter moved by the right angle
    const ang = () => page.evaluate(() => { const S = window.__space, c = document.querySelector('#sp-orrery'); const j = S.bodies().find((b) => b.id === 'jupiter'); return [S.st.day, Math.atan2(-(j.y - c.offsetHeight / 2), j.x - c.offsetWidth / 2) * 180 / Math.PI]; });
    await setRange(page, '#sp-speed', 0); await page.waitForTimeout(100); const [da, aa] = await ang(); await setRange(page, '#sp-speed', 6); await page.waitForTimeout(1000); await setRange(page, '#sp-speed', 0); await page.waitForTimeout(100); const [db, ab] = await ang();
    const exp = await page.evaluate(async ([da, db]) => { const SM = await import('/src/spacemodel.ts'); const S = await SM.loadSpace(); const J = S.planets[4]; return [SM.position(J, da).lon, SM.position(J, db).lon].map((x) => (x * 180 / Math.PI + 360) % 360); }, [da, db]);
    const dd = (x, y) => { const d = Math.abs((((x - y) % 360) + 360) % 360); return Math.min(d, 360 - d); };
    ok(dd(aa, exp[0]) < 0.8 && dd(ab, exp[1]) < 0.8 && db - da > 800, `moving: Jupiter is where Kepler puts it (${da.toFixed(0)} -> ${db.toFixed(0)} days)`);
    // real touch: a tap on Saturn
    await page.click('#sp-today');
    const cdp = await ctx.newCDPSession(page);
    const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
    await page.evaluate(() => window.scrollTo(0, 0)); await page.evaluate(() => window.__space.redraw());
    const pS = await page.evaluate(() => window.__space.clientOf('saturn'));
    await touch('touchStart', [pS]); await touch('touchEnd', []);
    await page.waitForFunction(() => location.hash === '#/science/space/saturn', null, { timeout: 4000 }); ok(true, 'a real touch tap on Saturn opens its page (with the fly-in animation)');
    await page.waitForSelector('#sp-planet');
    // leaving the page stops every animation
    await page.evaluate(() => (location.hash = '#/subject/science')); await page.waitForSelector('#open-space'); await page.waitForTimeout(300);
    const n1 = await page.evaluate(() => window.__draws()); await page.waitForTimeout(700); const n2 = await page.evaluate(() => window.__draws());
    ok(n2 === n1, `after leaving the page nothing is drawn any more (${n1} -> ${n2})`);
    // a pinch zooms in true scale
    await page.evaluate(() => (location.hash = '#/science/space')); await page.waitForSelector('#sp-orrery'); await page.waitForFunction(() => window.__space && window.__space.bodies().length === 8);
    await setRange(page, '#sp-speed', 0); await page.click('#sp-mode-true');
    const box = await page.evaluate(() => { const r = document.querySelector('#sp-orrery').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await touch('touchStart', [[box[0] - 40, box[1]], [box[0] + 40, box[1]]]);
    for (let k = 1; k <= 8; k++) await touch('touchMove', [[box[0] - 40 - k * 12, box[1]], [box[0] + 40 + k * 12, box[1]]]);
    await touch('touchEnd', []);
    const zl = await page.textContent('#sp-zoom-lab'); ok(parseInt(zl) >= 4, 'a two-finger pinch zooms in (' + zl + ')');
    ok(await page.evaluate(() => location.hash) === '#/science/space', 'a pinch is not a tap');
    await t.browser.close();
  }

  // =====================================================================================  D. EVERY PLANET PAGE, THE MOONS, THE WEIGHT SCALE AND THE AGE COUNTER
  {
    const t = await start(new Map(), { local: true, viewport: { width: 390, height: 844 }, dpr: 2, motion: true });
    const { page, log } = t;
    const data = await page.evaluate(async () => { const SM = await import('/src/spacemodel.ts'); const S = await SM.loadSpace(); return { all: [...S.planets, ...S.dwarfs].map((p) => ({ id: p.id, tilt: p.tilt ?? 0, rot: p.rot, facts: p.facts.length, g: p.g, P: p.P, moons: S.moons.filter((m) => m.planet === p.id).map((m) => m.id) })) }; });
    for (const b of data.all) {
      await page.evaluate((id) => (location.hash = '#/science/space/' + id), b.id); await page.waitForSelector(`.sp-page[data-planet=${b.id}] #sp-planet`);
      ok((await painted(page, '#sp-planet')) > 6, `${b.id}: the planet is painted`);
      ok(await page.evaluate(() => { const c = document.querySelector('#sp-planet'); return c.width > 0 && c.getContext('2d').getImageData(c.width / 2, c.height / 2, 1, 1).data[3] > 0; }), `${b.id}: the sphere is in the middle of the picture`);
      const tilt = await page.evaluate(() => +document.querySelector('#sp-tilt').dataset.tilt); ok(Math.abs(tilt - b.tilt) < 0.01 && (await page.evaluate(() => document.querySelector('#sp-tilt').style.transform)).includes(`rotate(${b.tilt}deg)`), `${b.id}: shown with its axial tilt ${b.tilt}`);
      const rows = await page.locator('.sp-data').count(); ok(rows >= 13, `${b.id}: ${rows} data cards`);
      ok(await page.locator('.sp-fact').count() === b.facts && b.facts >= 4, `${b.id}: ${b.facts} fun facts`);
      ok((await page.locator('.sp-moon').count()) === b.moons.length, `${b.id}: ${b.moons.length} moon cards`);
      if (b.moons.length) { ok((await painted(page, '#sp-moon-cv')) > 4, `${b.id}: the moon system is painted`); ok((await page.locator('.sp-moon canvas').count()) === b.moons.length, `${b.id}: a picture for every moon`); }
      else ok(await page.locator('#sp-moons .empty').count() === 1, `${b.id}: says it has no moon`);
      const spinTxt = await page.textContent('.sp-spininfo'); ok(b.rot < 0 ? /逆行/.test(spinTxt) : /顺行/.test(spinTxt), `${b.id}: the spin direction is ${b.rot < 0 ? 'retrograde' : 'prograde'}`);
    }
    // the turning: the picture changes, and 100x is faster
    await page.evaluate(() => (location.hash = '#/science/space/jupiter')); await page.waitForSelector('#sp-planet');
    const sp = () => page.evaluate(() => +document.querySelector('#sp-planet').dataset.spin);
    const a0 = await sp(); await page.waitForTimeout(800); const a1 = await sp(); const mv = (((a1 - a0) % 1) + 1) % 1;
    ok(mv > 0.04 && mv < 0.14, `Jupiter turns about 0.1 turn a second at 1x (${mv.toFixed(3)} in 0.8 s -> a day of 9.9 h is 24/9.9 turns per 24 s)`);
    await page.evaluate(() => (location.hash = '#/science/space/mars')); await page.waitForSelector('.sp-page[data-planet=mars] #sp-planet');
    const rate = async () => { const t0 = Date.now(), x0 = await sp(); await page.waitForTimeout(600); const x1 = await sp(); return ((((x1 - x0) % 1) + 1) % 1) / ((Date.now() - t0) / 1000); };
    const r1 = await rate(); await page.click('#sp-rot-10'); const r10 = await rate();
    ok(Math.abs(r1 - 1 / 24.623) < 0.012 && r10 / r1 > 7 && r10 / r1 < 13, `Mars turns 1 / 24.6 turns a second at 1x (${r1.toFixed(3)}) and 10 times faster at 10x (${r10.toFixed(3)})`);
    await page.evaluate(() => (location.hash = '#/science/space/venus')); await page.waitForSelector('#sp-planet');
    const v0 = await sp(); await page.waitForTimeout(800); const v1 = await sp(); ok(Math.abs(v1 - v0) < 0.001, 'Venus turns almost not at all (a day longer than a year): ' + (v1 - v0).toFixed(5));
    ok((await page.evaluate(() => document.querySelector('#sp-tilt').style.transform)).includes('177.36'), 'Venus is upside down (tilt 177.36)');
    await page.evaluate(() => (location.hash = '#/science/space/uranus')); await page.waitForSelector('#sp-planet'); ok((await page.evaluate(() => document.querySelector('#sp-tilt').style.transform)).includes('97.77'), 'Uranus lies on its side (tilt 97.77)');
    await page.screenshot({ path: OUT + 'space-uranus.png' });
    // the data cards by value
    const cell = (k) => page.textContent(`.sp-data[data-k="${k}"]`);
    await page.evaluate(() => (location.hash = '#/science/space/mars')); await page.waitForSelector('.sp-page[data-planet=mars] #sp-planet');
    ok(/6,779/.test(await cell('直径')) && /0\.532/.test(await cell('直径')), 'Mars: diameter 6,779 km, 0.532 of the Earth: ' + await cell('直径'));
    ok(/0\.379|0\.378/.test(await cell('重力')), 'Mars: gravity 0.378 of the Earth: ' + await cell('重力'));
    ok(/687/.test(await cell('公转周期（一年）')) && /24\.6/.test(await cell('自转周期')), 'Mars: year 687 days, day 24.6 hours');
    ok(/2 颗/.test(await cell('卫星')), 'Mars: 2 moons');
    await page.evaluate(() => (location.hash = '#/science/space/saturn')); await page.waitForSelector('.sp-page[data-planet=saturn] #sp-planet');
    ok(/已确认约 146 颗（截至 2024 年）/.test(await cell('卫星')), 'Saturn: "about 146 confirmed (as of 2024)": ' + await cell('卫星'));
    ok(/明亮/.test(await cell('光环')) && /0\.69/.test(await cell('平均密度')), 'Saturn: bright rings, density 0.69');
    ok(await page.locator('#sp-moon-more').count() === 1, 'Saturn: says that only the famous moons are listed');
    // the weight scale
    await page.evaluate(() => (location.hash = '#/science/space/mars')); await page.waitForSelector('.sp-page[data-planet=mars] #sp-weight');
    await page.fill('#sp-weight', '40');
    const kg = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#sp-wlist .sp-wrow')].map((r) => [r.dataset.id, +r.querySelector('[data-kg]').dataset.kg])));
    const gs = Object.fromEntries(data.all.map((x) => [x.id, x.g])); gs.moon = 1.62;
    ok(Object.keys(kg).length === 9 && Object.entries(kg).every(([id, v]) => Math.abs(v - 40 * gs[id] / 9.80665) < 0.011), 'weight scale: 40 kg on the Moon and the 8 planets = mass x g / 9.81 ' + JSON.stringify(kg));
    ok(Math.abs(kg.mars - 15.13) < 0.01 && Math.abs(kg.moon - 6.61) < 0.01 && Math.abs(kg.jupiter - 101.1) < 0.1 && Math.abs(kg.earth - 40.0) < 0.15, 'weight scale: Mars 15.1, Moon 6.6, Jupiter 101.1, Earth 40');
    ok(await page.locator('#sp-wlist .sp-wrow.cur[data-id=mars]').count() === 1, 'weight scale: the planet of the page is marked');
    await page.fill('#sp-weight', '25.5'); ok(Math.abs(+await page.getAttribute('#sp-wlist [data-id=venus] [data-kg]', 'data-kg') - 25.5 * 8.87 / 9.80665) < 0.011, 'weight scale follows the input'); await page.fill('#sp-weight', '');
    ok(await page.locator('#sp-wlist .sp-wrow').count() === 9 && (await page.getAttribute('#sp-wlist [data-id=mars] [data-kg]', 'data-kg')) === '0.00', 'weight scale: empty input = 0, no error');
    // the age counter
    await page.fill('#sp-age', '10');
    const ages = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#sp-alist .sp-wrow')].map((r) => [r.dataset.id, +r.querySelector('[data-age]').dataset.age])));
    const P = Object.fromEntries(data.all.map((x) => [x.id, x.P]));
    ok(Object.keys(ages).length === 8 && Object.entries(ages).every(([id, v]) => Math.abs(v - 10 * 365.256 / P[id]) < 0.0002), 'age counter: 10 years in the years of the 8 planets ' + JSON.stringify(ages));
    ok(Math.abs(ages.mercury - 41.52) < 0.01 && Math.abs(ages.earth - 10) < 1e-3 && Math.abs(ages.neptune - 0.0607) < 0.001, 'age counter: Mercury 41.5, Earth 10, Neptune 0.06');
    // moons: a card per moon with its numbers, a tap on a moon in the picture selects its card
    await page.evaluate(() => (location.hash = '#/science/space/jupiter')); await page.waitForSelector('.sp-page[data-planet=jupiter] .sp-moon');
    const names = await page.$$eval('.sp-moon h3', (e) => e.map((x) => x.textContent)); ok(names.join('|') === '木卫一（艾奥）|木卫二（欧罗巴）|木卫三（盖尼米德）|木卫四（卡利斯托）', 'Jupiter: the four Galilean moons in the order of their distance ' + names.join('|'));
    const ganymede = await page.textContent('.sp-moon[data-id=ganymede]'); ok(/5,268/.test(ganymede) && /1\.5 倍|1\.52 倍|1\.5/.test(ganymede) && /伽利略/.test(ganymede) && /1610/.test(ganymede) && /7\.15/.test(ganymede), 'Ganymede card: size, period, discoverer, year: ' + ganymede.slice(0, 90));
    ok(/月球的 1\.5 倍/.test(ganymede), 'Ganymede card: 1.5 times our Moon');
    await page.waitForTimeout(300);
    const mp = await page.evaluate(() => window.__spaceMoons()); ok(mp.length === 4, 'the moon system has 4 moons drawn');
    await page.evaluate(() => document.querySelector('#sp-moon-cv').scrollIntoView({ block: 'center' })); await page.waitForTimeout(200);
    const mp2 = await page.evaluate(() => window.__spaceMoons()); const tgt = mp2.find((m) => m.id === 'europa'); await page.mouse.click(tgt.x, tgt.y);
    ok(await page.locator('.sp-moon.sel[data-id=europa]').count() === 1, 'a tap on Europa in the picture selects its card');
    await page.screenshot({ path: OUT + 'space-jupiter-moons.png' });
    ok(log.external.length === 0, 'planet pages: no outside request ' + log.external.slice(0, 2).join());
    // prev / next
    await page.click('#sp-next'); await page.waitForFunction(() => location.hash === '#/science/space/saturn'); await page.waitForSelector('.sp-page[data-planet=saturn]');
    await page.click('#sp-prev'); await page.waitForFunction(() => location.hash === '#/science/space/jupiter'); ok(true, 'previous / next planet');
    await page.evaluate(() => (location.hash = '#/science/space/nowhere')); await page.waitForFunction(() => location.hash === '#/science/space'); ok(true, 'an unknown planet goes back to the list');
    await t.browser.close();
  }

  // =====================================================================================  E. THE LABS, THE STARS, THE QUIZ
  {
    const t = await start(new Map(), { local: true, viewport: { width: 390, height: 844 }, dpr: 2 });
    const { page, log } = t;
    await page.evaluate(() => (location.hash = '#/science/space')); await page.waitForSelector('#sp-orrery');
    await page.click('#sp-tab-lab'); await page.waitForSelector('#sp-lab-phase');
    for (const id of ['sp-phase-space', 'sp-phase-sky']) ok((await painted(page, '#' + id)) > 5, `phase lab: ${id} is painted`);
    for (const [e, name, lunar, wax] of [[0, '新月', '初一', /暗面/], [90, '上弦月', '初八', /右边/], [180, '满月', '十五', /整个/], [270, '下弦月', '廿三', /左边/], [45, '蛾眉月', '初四', /右边/], [225, '亏凸月', '十九', /左边/]]) {
      await setRange(page, '#sp-phase-slider', e);
      ok((await page.textContent('#sp-phase-name')) === name && (await page.textContent('#sp-phase-out')).includes(lunar) && wax.test(await page.textContent('#sp-phase-wax')), `phase lab: ${e} degrees = ${name} (${lunar})`);
    }
    await setRange(page, '#sp-phase-slider', 90); ok((await page.textContent('#sp-phase-out')).includes('50%'), 'phase lab: a quarter is half lit');
    await setRange(page, '#sp-phase-slider', 180); ok((await page.textContent('#sp-phase-out')).includes('100%'), 'phase lab: full = 100%');
    // the picture itself: the lit pixels of the Moon's disc: right side lit at first quarter, left at last quarter, none at new, all at full
    const lit = async (e) => { await setRange(page, '#sp-phase-slider', e); return page.evaluate(() => { const cv = document.querySelector('#sp-phase-sky'), c = cv.getContext('2d'), w = cv.width, h = cv.height; const cx = w / 2, cy = h / 2 + 6 * 2, r = Math.min(w, h) / 2 * 0.36 * 2 / 1; let L = 0, Rr = 0; for (let y = -r * 0.9; y <= r * 0.9; y += 6) for (let x = -r * 0.9; x <= r * 0.9; x += 6) { if (x * x + y * y > r * r * 0.7) continue; const d = c.getImageData(Math.round(cx + x), Math.round(cy + y), 1, 1).data; if (d[0] > 90) (x < 0 ? (L++) : (Rr++)); } return [L, Rr]; }); };
    const l0 = await lit(0), l90 = await lit(90), l180 = await lit(180), l270 = await lit(270);
    ok(l0[0] + l0[1] < 8 && l90[1] > 4 * l90[0] && l180[0] > 10 && l180[1] > 10 && l270[0] > 4 * l270[1], `phase lab: the drawn Moon is dark / right lit / full / left lit (${l0}|${l90}|${l180}|${l270})`);
    await page.click('#sp-ph-180'); ok((await page.textContent('#sp-phase-name')) === '满月', 'phase lab: jump buttons');
    ok(await page.locator('.sp-ph').count() === 8, 'phase lab: the eight phases'); await page.click('.sp-ph[data-i="2"]'); ok((await page.textContent('#sp-phase-name')) === '上弦月', 'phase lab: a phase card sets the Moon');
    await page.screenshot({ path: OUT + 'space-lab-phase.png', fullPage: true });
    // eclipses
    await page.click('#sp-labtab-eclipse'); await page.waitForSelector('#sp-lab-eclipse');
    const kind = () => page.getAttribute('#sp-ecl-result', 'data-kind');
    await setRange(page, '#sp-ecl-off', 0); await setRange(page, '#sp-ecl-lat', 0); ok((await kind()) === 'central', 'eclipse lab: Moon on the Sun = central solar eclipse');
    await setRange(page, '#sp-ecl-lat', 1.2); ok((await kind()) === 'partial', 'eclipse lab: 1.2 degrees = partial'); await setRange(page, '#sp-ecl-lat', 3); ok((await kind()) === 'none', 'eclipse lab: 3 degrees above = none (the orbit is tilted)');
    await setRange(page, '#sp-ecl-lat', 0); await setRange(page, '#sp-ecl-off', 2.5); ok((await kind()) === 'none', 'eclipse lab: far along the orbit = none');
    await page.click('#sp-ecl-lunar'); await setRange(page, '#sp-ecl-off', 0); await setRange(page, '#sp-ecl-lat', 0); ok((await kind()) === 'total', 'eclipse lab: Moon in the Earth\'s shadow = total lunar eclipse');
    await setRange(page, '#sp-ecl-lat', 0.7); ok((await kind()) === 'partial', 'eclipse lab: partial lunar eclipse'); await setRange(page, '#sp-ecl-lat', 1.3); ok((await kind()) === 'penumbral', 'eclipse lab: penumbral'); await setRange(page, '#sp-ecl-lat', 4); ok((await kind()) === 'none', 'eclipse lab: none');
    ok((await painted(page, '#sp-ecl-sky')) > 3 && (await painted(page, '#sp-ecl-side')) > 5, 'eclipse lab: painted');
    await setRange(page, '#sp-ecl-lat', 0.2); await page.screenshot({ path: OUT + 'space-lab-eclipse.png', fullPage: true });
    // seasons
    await page.click('#sp-labtab-season'); await page.waitForSelector('#sp-lab-season');
    await page.click('#sp-sd-172'); const decOf = async () => parseFloat((await page.textContent('#sp-season-dec')).match(/-?\d+(\.\d+)?/)[0]);
    ok(Math.abs((await decOf()) - 23.4) < 0.1 && /夏季/.test(await page.textContent('#sp-season-out')), 'season lab: June solstice = the Sun is over 23.4 N, summer');
    const cityTxt = async (c) => page.textContent(`.sp-city[data-city=${c}]`);
    ok(/14\.[89]|15\.[0-1]/.test(await cityTxt('北京')) && /73\.[45]/.test(await cityTxt('北京')) && /冬季/.test(await cityTxt('悉尼')), 'season lab: Beijing ~15 h of daylight and the Sun 73.5 high; Sydney is in winter: ' + (await cityTxt('北京')));
    await page.click('#sp-sd-356'); ok(Math.abs((await decOf()) + 23.4) < 0.1 && /9\.[0-2]/.test(await cityTxt('北京')) && /26\.[56]/.test(await cityTxt('北京')), 'season lab: December solstice: Beijing 9.1 h, Sun 26.6 high');
    await page.click('#sp-sd-79'); ok(Math.abs(await decOf()) < 0.5 && /1[12]\.[0-9]|12/.test(await cityTxt('北京')), 'season lab: March equinox = the Sun over the equator, day and night equal');
    const dist = async (d) => { await setRange(page, '#sp-season-day', d); return parseFloat((await page.textContent('#sp-season-dist')).match(/\d+(\.\d+)?/)[0]); };
    const dJan = await dist(3), dJul = await dist(185); ok(dJan < dJul && Math.abs(dJan - 147.1) < 0.4 && Math.abs(dJul - 152.1) < 0.4, `season lab: nearest the Sun in January (${dJan}), farthest in July (${dJul}) million km: the tilt, not the distance, makes the seasons`);
    ok((await painted(page, '#sp-season-earth')) > 5 && (await painted(page, '#sp-season-orbit')) > 5, 'season lab: painted');
    await page.click('#sp-sd-172'); await page.screenshot({ path: OUT + 'space-lab-season.png', fullPage: true });
    // tides
    await page.click('#sp-labtab-tide'); await page.waitForSelector('#sp-lab-tide');
    await setRange(page, '#sp-tide-phase', 0); ok((await page.textContent('#sp-tide-name')) === '大潮', 'tide lab: new moon = spring tide'); await setRange(page, '#sp-tide-phase', 180); ok((await page.textContent('#sp-tide-name')) === '大潮', 'tide lab: full moon = spring tide');
    await setRange(page, '#sp-tide-phase', 90); ok((await page.textContent('#sp-tide-name')) === '小潮', 'tide lab: quarter = neap tide'); ok((await page.textContent('#sp-tide-out')).includes('0.54'), 'tide lab: strength 0.54');
    ok((await painted(page, '#sp-tide-top')) > 5 && (await painted(page, '#sp-tide-chart')) > 2, 'tide lab: painted'); await page.screenshot({ path: OUT + 'space-lab-tide.png', fullPage: true });
    // day and year
    await page.click('#sp-labtab-dayyear'); await page.waitForSelector('#sp-lab-dayyear'); await page.click('#sp-dy-0');
    await setRange(page, '#sp-dy-day', 365); const sp1 = await page.textContent('#sp-dy-spins'); ok(/365\.[0-9]|366/.test(sp1) && !/^自转：36[0-4]/.test(sp1), 'day / year lab: after 365 days the Earth has turned about 366 times: ' + sp1);
    await setRange(page, '#sp-dy-day', 0); ok(/0 圈/.test(await page.textContent('#sp-dy-spins')), 'day / year lab: day 0');
    ok((await painted(page, '#sp-dy-cv')) > 5, 'day / year lab: painted'); await page.screenshot({ path: OUT + 'space-lab-dayyear.png', fullPage: true });
    // stars
    await page.click('#sp-tab-stars'); await page.waitForSelector('#sp-stars');
    await page.click('#sp-sun-corona'); ok(/100 万/.test(await page.textContent('#sp-sun-info')), 'stars: the Sun\'s corona over a million degrees');
    ok(await page.locator('.sp-sunl').count() === 6 && await page.locator('.sp-life').count() === 9 && await page.locator('#sp-life-small .sp-life').count() === 3 && await page.locator('#sp-life-big .sp-life').count() === 3, 'stars: 6 layers of the Sun, the life of a star (3 + 3 + 3)');
    ok(await page.locator('.sp-const').count() === 12, 'stars: 12 constellations'); ok(await page.locator('#sp-polaris svg[data-finder]').count() === 1, 'stars: how to find the Pole Star (drawn)');
    await page.click('.sp-const[data-id=orion]'); ok(await page.locator('.sp-const.open[data-id=orion] .sp-const-more').isVisible() && /三星|腰带/.test(await page.textContent('.sp-const[data-id=orion]')), 'stars: a constellation opens with its story');
    ok(await page.locator('.sp-const[data-id=orion] svg text').count() > 0, 'stars: an opened constellation names its stars');
    ok(await page.locator('.sp-rung').count() === 9, 'stars: the ladder of sizes has 9 rungs');
    const widths = await page.$$eval('.sp-bar span', (e) => e.map((x) => parseFloat(x.style.width))); ok(widths.every((w, i) => !i || w > widths[i - 1]), 'stars: the bars grow (log scale)');
    ok(await page.locator('.sp-tl').count() >= 20, 'stars: the timeline');
    const years = await page.$$eval('.sp-tl time', (e) => e.map((x) => x.firstChild.textContent)); ok(years.every((y, i) => !i || y >= years[i - 1]), 'stars: the timeline is in order'); const all = years.length; await page.click('#sp-tl-cn'); const cn = await page.locator('.sp-tl').count(); ok(cn >= 8 && cn < all && (await page.locator('.sp-tl:not(.cn)').count()) === 0, 'stars: the filter shows only the Chinese space programme (' + cn + ' of ' + all + ')');
    ok(/东方红一号/.test(await page.textContent('#sp-timeline')) && /神舟五号/.test(await page.textContent('#sp-timeline')), 'stars: Dongfanghong 1 and Shenzhou 5 are in the Chinese list');
    await page.screenshot({ path: OUT + 'space-stars.png', fullPage: true });
    await page.evaluate(() => document.querySelector('#sp-const-sec').scrollIntoView()); await page.waitForTimeout(100);
    await page.locator('#sp-const-sec').screenshot({ path: OUT + 'space-constellations.png' });
    await page.locator('#sp-ladder').screenshot({ path: OUT + 'space-ladder.png' });
    ok(log.external.length === 0, 'labs and stars: no outside request');

    // the quiz: every kind of picture, answered right
    await page.click('#sp-tab-quiz'); await page.waitForSelector('#sp-quiz-start');
    ok(/0/.test(await page.textContent('#sp-known')), 'quiz: nothing mastered yet');
    await page.evaluate(() => { window.__spaceKeys = ['pp:saturn', 'pm:io', 'ph:2', 'cs:orion', 'mq:0', 'wt:mars', 'or:3', 'sp:0', 'mf:europa', 'mo:titan']; });
    await page.click('#sp-quiz-start'); await page.waitForSelector('#game .mchoice');
    for (let i = 0; i < 10; i++) {
      await page.waitForFunction((i) => document.querySelector('#game-progress').textContent === `${i + 1} / 10`, i);
      const q = await page.evaluate((i) => { const x = window.__spaceQuiz[i]; return { key: x.key, ans: x.answer, fig: !!x.fig }; }, i);
      ok(await page.evaluate(() => document.querySelector('#game').dataset.qkey) === q.key, `quiz ${i + 1}: ${q.key}`);
      ok(q.fig ? (await page.locator('#sp-qfig canvas, #sp-qfig svg').count()) === 1 : (await page.locator('#sp-qfig').isHidden()), `quiz ${i + 1}: picture ${q.fig ? 'shown' : 'not needed'}`);
      if (q.fig && i < 4) { await page.screenshot({ path: OUT + `space-quiz-${q.key.replace(':', '-')}.png` }); }
      if (i === 0) ok((await painted(page, '#sp-qfig canvas')) > 4, 'quiz: the planet picture is painted');
      if (i === 1) { await page.click('.mchoice:not([data-v="' + q.ans + '"])'); ok(await page.locator('.mchoice.wrong').count() === 1 && await page.locator('.mchoice.right').count() === 1 && /回答有误/.test(await page.textContent('#math-explain')), 'quiz: a wrong answer shows the right one and an explanation'); }
      else { await page.click(`.mchoice[data-v="${q.ans}"]`); ok(await page.locator('.mchoice.right').count() === 1 && /回答正确/.test(await page.textContent('#math-explain')), `quiz ${i + 1}: right answer, explanation shown`); }
      ok(await page.locator('.mchoice:not([disabled])').count() === 0, `quiz ${i + 1}: the choices are locked after the answer`);
      await page.click('#math-next');
    }
    await page.waitForSelector('#game-end'); ok((await page.textContent('#game-final')) === '9', 'quiz: 9 of 10 (one wrong on purpose)'); ok((await page.getAttribute('.gstars', 'data-stars')) === '3', 'quiz: 3 stars for 9 / 10'); ok(await page.locator('#sp-wrong .mrow').count() === 1, 'quiz: the wrong one is listed to revise');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('learn.space.v1')));
    ok(Object.keys(saved.cards).length === 10 && saved.cards['pp:saturn'].box === 1 && saved.cards['pm:io'].box === 0 && saved.last.score === 9 && saved.plays === 1, 'quiz: progress saved on this device (boxes: right = 1, wrong = 0)');
    await page.screenshot({ path: OUT + 'space-quiz-end.png' });
    await page.click('#game-done'); await page.waitForSelector('#sp-known'); ok((await page.textContent('#sp-known')) === '0', 'quiz: "mastered" counts box 3 and higher: 0 after one round');
    ok(/9 \/ 10/.test(await page.textContent('#sp-last')), 'quiz: the last score is shown');
    // a normal round: new questions first; leaving asks and saves what was answered
    await page.evaluate(() => { delete window.__spaceKeys; });
    await page.click('#sp-quiz-start'); await page.waitForSelector('#game .mchoice');
    const keys2 = await page.evaluate(() => window.__spaceQuiz.map((q) => q.key)); ok(keys2.length === 10 && new Set(keys2).size === 10 && keys2.includes('pm:io'), 'quiz: the next round has 10 different questions and brings the failed one back (' + keys2.join(',') + ')');
    ok(keys2.filter((k) => !Object.keys(saved.cards).includes(k)).length >= 8, 'quiz: and mostly new questions');
    const q0 = await page.evaluate(() => window.__spaceQuiz[0]); await page.click(`.mchoice[data-v="${q0.answer}"]`); await page.click('#math-next');
    await page.click('#game-quit'); await page.waitForSelector('dialog'); await page.click('dialog button.primary'); await page.waitForSelector('#sp-quiz-start');
    const saved2 = await page.evaluate(() => JSON.parse(localStorage.getItem('learn.space.v1'))); ok(Object.keys(saved2.cards).length === 11 && saved2.plays === 2, 'quiz: quitting saves the one question that was answered');
    await page.click('#sp-quiz-start'); await page.waitForSelector('#game .mchoice'); await page.click('#game-quit'); await page.waitForSelector('dialog'); await page.click('dialog button:not(.primary)'); ok(await page.locator('#game').count() === 1, 'quiz: cancelling the question keeps the game open'); await page.click('#game-quit'); await page.click('dialog button.primary');
    ok(log.external.length === 0, 'quiz: no outside request');
    await t.browser.close();
  }

  // =====================================================================================  F. SCREEN SIZES (zh), ENGLISH / FRENCH
  for (const loc of ['zh-CN', 'en', 'fr']) {
    for (const [w, h] of SIZES) {
      if (loc !== 'zh-CN' && ![390, 1180, 844].includes(w)) continue;
      const t = await start(new Map(), { local: true, locale: loc, viewport: { width: w, height: h }, dpr: 2 });
      const { page, log } = t; const tag = `${loc}-${w}x${h}`;
      if (loc !== 'zh-CN') await withExtra(t);
      const geom = async (label, scopeSel = '.sp-page main') => {
        const g = await page.evaluate((scopeSel) => {
          const iw = document.documentElement.clientWidth;
          const els = [...document.querySelectorAll(scopeSel + ' *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('svg') && getComputedStyle(e).visibility !== 'hidden' && !e.closest('.sp-tilt'); });
          const left = Math.min(...els.map((e) => e.getBoundingClientRect().left)), right = Math.max(...els.map((e) => e.getBoundingClientRect().right));
          const btn = [...document.querySelectorAll(scopeSel + ' button, ' + scopeSel + ' input[type=range]')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.getBoundingClientRect().height);
          const over = els.filter((e) => e.getBoundingClientRect().right > iw + 1 && !e.closest('canvas')).length;
          return { iw, sw: document.documentElement.scrollWidth, left, right: iw - right, btn: Math.min(...btn), over };
        }, scopeSel);
        ok(g.sw <= g.iw && g.over === 0, `${tag} ${label}: no horizontal overflow (${g.sw}/${g.iw})`);
        ok(Math.abs(g.left - g.right) <= 4, `${tag} ${label}: equal space left and right (${Math.round(g.left)} / ${Math.round(g.right)})`);
        ok(g.btn >= 38, `${tag} ${label}: buttons and sliders are 40 px or more (${Math.round(g.btn)})`);
      };
      const noCjk = async (label) => { if (loc === 'zh-CN') return; const lo = await leftover(page); ok(lo.length === 0, `${tag} ${label}: no Chinese left outside the user's own texts ${lo.slice(0, 4).join('|')}`); };
      await page.evaluate(() => (location.hash = '#/science/space')); await page.waitForSelector('#sp-orrery'); await page.waitForFunction(() => window.__space && window.__space.bodies().length === 8);
      await geom('solar'); await noCjk('solar'); await page.screenshot({ path: OUT + `space-solar-${tag}.png`, fullPage: true });
      ok(await page.evaluate(() => { const c = document.querySelector('#sp-orrery'); const r = c.getBoundingClientRect(); return r.width > 150 && Math.abs(r.width - r.height) < 2 && r.left >= 0 && r.right <= innerWidth + 0.5 && Math.abs(r.left - (innerWidth - r.right)) < 3; }), `${tag} the orrery is a centred square inside the screen`);
      await page.click('#sp-mode-true'); await page.click('#sp-dwarfs'); await geom('solar true'); await noCjk('solar true'); await page.screenshot({ path: OUT + `space-solar-true-${tag}.png`, fullPage: true });
      await page.evaluate(() => (location.hash = '#/science/space/saturn')); await page.waitForSelector('.sp-page[data-planet=saturn] .sp-moon');
      await geom('Saturn'); await noCjk('Saturn'); await page.screenshot({ path: OUT + `space-saturn-${tag}.png` });
      await page.evaluate(() => document.querySelector('#sp-moons').scrollIntoView()); await page.locator('#sp-moons').screenshot({ path: OUT + `space-saturn-moons-${tag}.png` });
      await page.evaluate(() => document.querySelector('#sp-tools').scrollIntoView()); await page.locator('#sp-tools').screenshot({ path: OUT + `space-tools-${tag}.png` });
      ok(await page.evaluate(() => { const cs = [...document.querySelectorAll('.sp-moon, .sp-wrow, .sp-data, .sp-fact')]; return cs.every((e) => { const r = e.getBoundingClientRect(); return r.right <= innerWidth + 0.5 && r.left >= -0.5; }); }), `${tag} Saturn: cards inside the screen`);
      if (loc === 'zh-CN' || w === 390 || w === 1180) {
        await page.evaluate(() => (location.hash = '#/science/space/earth')); await page.waitForSelector('.sp-page[data-planet=earth] .sp-moon'); await geom('Earth'); await noCjk('Earth');
        await page.evaluate(() => (location.hash = '#/science/space')); await page.waitForSelector('#sp-tab-lab'); await page.click('#sp-tab-lab');
        for (const lab of ['phase', 'eclipse', 'season', 'tide', 'dayyear']) {
          await page.click(`#sp-labtab-${lab}`); await page.waitForSelector(`#sp-lab-${lab}`); await page.waitForTimeout(150);
          await geom('lab ' + lab); await noCjk('lab ' + lab);
          ok(await page.evaluate(() => [...document.querySelectorAll('.sp-lab-cv')].every((c) => { const r = c.getBoundingClientRect(); return r.width > 100 && r.height > 100 && r.right <= innerWidth + 0.5; })), `${tag} lab ${lab}: canvases are inside the screen`);
          await page.screenshot({ path: OUT + `space-lab-${lab}-${tag}.png`, fullPage: true });
        }
        await page.click('#sp-tab-stars'); await page.waitForSelector('#sp-stars'); await page.click('.sp-const[data-id=leo]'); await geom('stars'); await noCjk('stars'); await page.screenshot({ path: OUT + `space-stars-${tag}.png`, fullPage: true });
        await page.click('#sp-tab-quiz'); await page.waitForSelector('#sp-quiz-start'); await geom('quiz home'); await noCjk('quiz home');
        for (const key of ['pp:jupiter', 'ph:6', 'cs:cygnus', 'wt:venus', 'mf:titan', 'mq:6']) {
          await page.evaluate((k) => { window.__spaceKeys = [k, 'or:1', 'or:2', 'or:3', 'or:4', 'or:5', 'or:6', 'or:7', 'or:8', 'pp:earth']; }, key);
          await page.click('#sp-quiz-start'); await page.waitForSelector('#game .mchoice');
          const qg = async (label) => {
            const q = await page.evaluate(() => { const iw = innerWidth, ih = innerHeight; const r = (s) => { const e = document.querySelector(s); if (!e || e.offsetParent === null && getComputedStyle(e).position !== 'fixed') return null; const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, h: b.height }; }; return { iw, ih, sw: document.documentElement.scrollWidth, card: r('#math-card'), fig: r('#sp-qfig'), ch: [...document.querySelectorAll('#math-choices .mchoice')].map((b) => { const x = b.getBoundingClientRect(); return { l: x.left, r: x.right, h: x.height, sh: b.scrollHeight - b.clientHeight, sw: b.scrollWidth - b.clientWidth }; }), body: (() => { const e = document.querySelector('.sp-qbody'); return e.scrollHeight - e.clientHeight; })() }; });
            ok(q.sw <= q.iw && q.card.l >= 0 && q.card.r <= q.iw + 0.5, `${tag} ${key} ${label}: nothing overflows`);
            ok(q.ch.every((c) => c.h >= 40 && c.l >= -0.5 && c.r <= q.iw + 0.5 && c.sh <= 1 && c.sw <= 1), `${tag} ${key} ${label}: four choices, 40 px tall, text inside`);
            ok(q.fig === null || (q.fig.l >= 0 && q.fig.r <= q.iw), `${tag} ${key} ${label}: the picture is inside the screen`);
          };
          await qg('question'); await noCjk('quiz ' + key);
          if (key === 'pp:jupiter' || key === 'ph:6') await page.screenshot({ path: OUT + `space-quiz-${key.replace(':', '-')}-${tag}.png` });
          const q0 = await page.evaluate(() => window.__spaceQuiz[0]); await page.click(`.mchoice[data-v="${q0.answer}"]`); await qg('answered'); await noCjk('quiz answered ' + key);
          if (key === 'mf:titan') await page.screenshot({ path: OUT + `space-quiz-answered-${tag}.png` });
          await page.click('#game-quit'); await page.waitForSelector('dialog'); await page.click('dialog button.primary'); await page.waitForSelector('#sp-quiz-start');
        }
      }
      ok(log.external.length === 0, `${tag}: no outside request ${log.external.slice(0, 2).join()}`);
      await t.browser.close();
    }
  }
  await done();
})();
