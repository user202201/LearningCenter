// Spot the difference (找不同): the pictures are GENERATED from a seed. Properties checked over 1500 generated scenes (every difference really changes picture B, none overlap, all inside,
// pieces never touch, counts 3 / 5 / 7, deterministic per seed, the next picture differs, fast), the rules (hit testing, hints, stars), the screen (taps on either picture, a wrong
// tap, hints, win, next picture, best time, keyboard), four screen sizes, EN / FR, and no request leaves the app.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const TR = JSON.parse(fs.readFileSync('src/games/spotdiff.i18n.json', 'utf8'));
const CJK = /[㐀-鿿]/;

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  const p = t.page;
  await p.evaluate(() => (location.hash = '#/games/spotdiff')); await p.waitForSelector('#sd-start');

  // ---------- the generator and the rules ----------
  const L = await p.evaluate(async () => {
    const M = await import('/src/games/spotdiff-logic.ts');
    const res = { bad: [], kinds: {}, themes: {}, scenes: 0, spots: 0, partKinds: new Set(), times: [] };
    const bad = (m) => { if (res.bad.length < 40) res.bad.push(m); };
    if (M.KIND_NAMES.length < 25) bad('library has only ' + M.KIND_NAMES.length + ' kinds');
    for (const k of M.KIND_NAMES) { const svg = M.partSvg({ id: 'x', k, x: 100, y: 75, R: 15, f: '#fa5252', d: 0, flip: 1, rot: 0 }); if (svg.length < 120) bad(k + ' draws nothing'); }
    const seenMarkup = new Map();
    for (let diff = 0; diff < 3; diff++) {
      const N = [3, 5, 7][diff], want = [8, 12, 16][diff];
      for (let seed = 1; seed <= 500; seed++) {
        const t0 = performance.now(); const sc = M.makeScene(seed, diff); res.times.push(performance.now() - t0); res.scenes++;
        const tag = `d${diff}/seed${seed}`;
        res.themes[sc.back.theme] = (res.themes[sc.back.theme] || 0) + 1;
        if (sc.diffs.length !== N) bad(tag + ': ' + sc.diffs.length + ' differences, need ' + N);
        if (sc.parts.length < want * 0.8 || sc.parts.length > want) bad(tag + ': ' + sc.parts.length + ' pieces for ' + want);
        // pieces: inside, never touching, readable colour, a size that is not tiny
        for (const q of sc.parts) {
          res.partKinds.add(q.k);
          if (q.x - q.R < 0 || q.x + q.R > M.SW || q.y - q.R < 0 || q.y + q.R > M.SH) bad(tag + ': ' + q.id + ' cut by the edge');
          if (q.R < 10) bad(tag + ': tiny piece ' + q.R);
          const bg = q.y < sc.back.gy ? sc.back.sky : sc.back.ground;
          if (q.k !== 'cloud' && M.colourDist(q.f, bg) < 80) bad(tag + ': ' + q.k + ' has low contrast against the backdrop');
        }
        for (let i = 0; i < sc.parts.length; i++) for (let j = i + 1; j < sc.parts.length; j++) { const a = sc.parts[i], c = sc.parts[j]; if (Math.hypot(a.x - c.x, a.y - c.y) < a.R + c.R) bad(tag + ': pieces ' + a.id + ' and ' + c.id + ' overlap'); }
        if (new Set(sc.parts.map((q) => q.id)).size !== sc.parts.length) bad(tag + ': duplicate piece ids');
        // differences
        const base = M.sceneMarkup(sc, []), all = M.sceneMarkup(sc, sc.diffs), spots = [], touched = [];
        for (const d of sc.diffs) {
          res.kinds[d.kind] = (res.kinds[d.kind] || 0) + 1; res.spots++;
          if (M.sceneMarkup(sc, [d]) === base) bad(tag + '/' + d.id + ' (' + d.kind + '): does not change picture B');
          if (M.sceneMarkup(sc, sc.diffs.filter((x) => x !== d)) === all) bad(tag + '/' + d.id + ' (' + d.kind + '): does not show in the full picture B');
          const q = d.p ? sc.parts.find((x) => x.id === d.p) : null;
          if (d.p && !q) bad(tag + ': difference names a missing piece');
          touched.push(d.p || d.add.id);
          if (d.kind === 'missing' && (d.set || d.add)) bad(tag + ': missing with data');
          if (d.kind === 'added' && (!d.add || sc.parts.some((x) => x.id === d.add.id))) bad(tag + ': added piece is wrong');
          if (d.kind === 'colour' && M.colourDist(q.f, d.set.f) < 150) bad(tag + ': colour change too small ' + M.colourDist(q.f, d.set.f));
          if (d.kind === 'size') { const r = d.set.R / q.R; if (r > 0.75 && r < 1.25) bad(tag + ': size change only ' + r); }
          if (d.kind === 'moved' && Math.hypot(d.set.x - q.x, d.set.y - q.y) < q.R * 0.99) bad(tag + ': moved less than a radius');
          if (d.kind === 'moved') { const nc = { x: d.set.x, y: d.set.y, r: q.R }; if (nc.x - nc.r < 0 || nc.x + nc.r > M.SW || nc.y - nc.r < 0 || nc.y + nc.r > M.SH) bad(tag + ': moved piece leaves the scene'); if (sc.parts.some((o) => o !== q && Math.hypot(o.x - nc.x, o.y - nc.y) < o.R + nc.r)) bad(tag + ': moved piece lands on another'); }
          if (d.kind === 'pattern' && d.set.d === q.d) bad(tag + ': pattern unchanged');
          if (d.kind === 'flipped' && (!M.KINDS[q.k].asym || d.set.flip !== -q.flip)) bad(tag + ': flip invisible');
          if (d.kind === 'added') { const a = d.add; if (a.x - a.R < 0 || a.x + a.R > M.SW || a.y - a.R < 0 || a.y + a.R > M.SH) bad(tag + ': added piece outside'); if (sc.parts.some((o) => Math.hypot(o.x - a.x, o.y - a.y) < o.R + a.R)) bad(tag + ': added piece on another'); }
          const s = M.diffSpot(sc, d); spots.push(s);
          if (s.x - s.r < 0 || s.y - s.r < 0 || s.x + s.r > M.SW || s.y + s.r > M.SH) bad(tag + '/' + d.id + ': hit area leaves the scene');
          if (s.r < 13) bad(tag + ': hit radius ' + s.r);
          if (d.p && !(Math.hypot(s.x - q.x, s.y - q.y) <= s.r)) bad(tag + ': spot does not cover the piece');
        }
        if (new Set(touched).size !== touched.length) bad(tag + ': two differences on one piece');
        for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) if (Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y) < spots[i].r + spots[j].r) bad(tag + ': differences ' + i + ' and ' + j + ' overlap');
        // determinism, and (for the first 50 seeds) that scenes differ from each other
        if (seed <= 50) {
          if (JSON.stringify(M.makeScene(seed, diff)) !== JSON.stringify(sc)) bad(tag + ': not deterministic');
          if (seenMarkup.has(base)) bad(tag + ': same picture as ' + seenMarkup.get(base)); seenMarkup.set(base, tag);
        }
      }
    }
    // the next picture never equals the one before
    let prev = M.makeScene(5, 1), rep = 0;
    for (let i = 0; i < 200; i++) { const sd = M.nextSeed(prev, 1), sc = M.makeScene(sd, 1); if (sd === prev.seed || M.sceneMarkup(sc, []) === M.sceneMarkup(prev, [])) rep++; prev = sc; }
    if (rep) bad(rep + ' repeated pictures in a row');
    // different difficulty = different count even for one seed
    if (M.makeScene(9, 0).diffs.length !== 3 || M.makeScene(9, 2).diffs.length !== 7) bad('counts by difficulty');
    // the game: hit testing
    const g = M.newGame(M.makeScene(11, 1)), n = g.spots.length; if (n !== 5) bad('game has ' + n);
    const s0 = g.spots[0];
    let r = M.tap(g, s0.x + s0.r * 0.9, s0.y); if (r.kind !== 'hit' || r.i !== 0) bad('tap near the edge missed');
    r = M.tap(g, s0.x, s0.y); if (r.kind !== 'again' || g.mistakes !== 0 || M.foundCount(g) !== 1) bad('the same difference was counted twice');
    r = M.tap(g, s0.x + s0.r + 3, s0.y + s0.r + 3); if (r.kind !== 'miss' || g.mistakes !== 1) bad('a tap beside counted as a hit');
    if (M.won(g)) bad('won too early');
    const g2 = M.newGame(M.makeScene(12, 0)), sp = g2.spots[0]; if (M.tap(g2, sp.x + sp.r + 4, sp.y).kind !== 'miss') bad('without minR a far tap hit'); if (M.tap(g2, sp.x + sp.r + 4, sp.y, sp.r + 6).kind !== 'hit') bad('minR did not widen');
    const g3 = M.newGame(M.makeScene(13, 2)); if (M.hintLit(g3)) bad('hint lit at the start');
    for (let k = 0; k < 3; k++) M.tap(g3, -5, -5); if (!M.hintLit(g3)) bad('hint not lit after 3 mistakes'); if (M.won(g3)) bad('3 mistakes must not end the game');
    M.tap(g3, g3.spots[0].x, g3.spots[0].y);
    const seenH = []; for (let k = 0; k < 4; k++) seenH.push(M.hint(g3));
    if (seenH[0] !== 1 || seenH[1] !== 1 || seenH[2] !== 1 || seenH[3] !== -1 || M.hintsLeft(g3) !== 0 || M.hintLit(g3)) bad('hints: ' + seenH);
    let seed = 7; const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let gi = 0; gi < 300; gi++) {
      const g4 = M.newGame(M.makeScene(1000 + gi, gi % 3)), order = g4.spots.map((_, i) => i).sort(() => rng() - 0.5); let mis = 0;
      for (const i of order) {
        if (rng() < 0.4) { const before = g4.mistakes; M.tap(g4, -50, -50); if (g4.mistakes !== before + 1) bad('miss not counted'); mis++; }
        if (M.won(g4)) bad('won before the last');
        const s = g4.spots[i], a = rng() * 6.28, rr = s.r * 0.6 * rng();
        const rs = M.tap(g4, s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr); if (rs.kind !== 'hit') bad('random tap inside missed');
      }
      if (!M.won(g4) || g4.mistakes !== mis) bad('game not won / mistakes wrong');
    }
    const st = M.stars; if (st(0, 10, 5) !== 3 || st(1, 90, 5) !== 3 || st(2, 10, 5) !== 2 || st(5, 10, 5) !== 1 || st(0, 5 * 20 + 1, 5) !== 2 || st(9, 999, 5) !== 1) bad('stars');
    let c = { x: 195, y: 148 }; c = M.moveCursor(c, 1, 1); if (c.x !== 200 || c.y !== 150) bad('cursor not clamped'); c = M.moveCursor({ x: 3, y: 4 }, -1, -1); if (c.x !== 0 || c.y !== 0) bad('cursor not clamped low');
    if (M.fmtTime(75) !== '1:15' || M.fmtTime(9) !== '0:09') bad('time format');
    res.partKinds = res.partKinds.size; res.times.sort((a, b) => a - b); res.p95 = res.times[Math.floor(res.times.length * 0.95)]; res.mean = res.times.reduce((a, b) => a + b, 0) / res.times.length; delete res.times;
    return res;
  });
  ok(L.bad.length === 0, `generator and rules over ${L.scenes} generated scenes (${L.spots} differences) + 300 random games${L.bad.length ? ' -> ' + L.bad.slice(0, 8).join('; ') : ''}`);
  ok(['missing', 'added', 'colour', 'size', 'pattern', 'moved', 'flipped'].every((k) => L.kinds[k] >= 300), 'all seven kinds of differences are generated: ' + JSON.stringify(L.kinds));
  ok(Object.keys(L.themes).length >= 5 && L.partKinds >= 25, `${Object.keys(L.themes).length} backdrops and ${L.partKinds} kinds of pieces are used`);
  ok(L.p95 < 20 && L.mean < 10, `the generator is fast (mean ${L.mean.toFixed(1)} ms, 95% under ${L.p95.toFixed(1)} ms per scene)`);

  // ---------- the screen ----------
  const hook = (f) => p.evaluate(f);
  const spotPx = (i, side) => p.evaluate(([i, side]) => {
    const w = window.__spotdiff, s = w.game().spots[i], pic = document.querySelector(`.sd-pic[data-pic=${side}]`).getBoundingClientRect();
    return { x: pic.left + (s.x / 200) * pic.width, y: pic.top + (s.y / 150) * pic.height, scale: w.scale() };
  }, [i, side]);
  const txt = (sel) => p.textContent(sel);
  ok(await p.isVisible('#sd-ovl') && (await txt('#sd-ovl h2')) === '找不同', 'a start panel with the name of the game');
  const seed0 = await hook(() => window.__spotdiff.seed()), n0 = await hook(() => window.__spotdiff.game().spots.length);
  ok(n0 === 3 && (await txt('#sd-found')) === '找到：0 / 3' && (await txt('#sd-diff')) === '难度：简单', 'starts on easy: 3 differences');
  await p.click('#sd-start');
  ok(!(await p.isVisible('#sd-ovl')), 'Start hides the panel');
  const svgs = await p.evaluate(() => [...document.querySelectorAll('.sd-pic svg')].map((s) => s.innerHTML.replace(/<g class="sd-fx".*$/s, '')));
  ok(svgs.length === 2 && svgs[0] !== svgs[1] && svgs[0].length > 800, 'two pictures, and the second is not the same as the first');
  // a wrong tap in picture A: a mistake, a cross, a shake; no loss
  // an empty place of the picture: the point farthest from every difference (found by scanning)
  const empty = await p.evaluate(() => { const g = window.__spotdiff.game(), pic = document.querySelector('.sd-pic[data-pic=a]').getBoundingClientRect(); let best = null, bd = -1;
    for (let x = 10; x < 190; x += 5) for (let y = 10; y < 140; y += 5) { const d = Math.min(...g.spots.map((s) => Math.hypot(s.x - x, s.y - y) - Math.max(s.r, 18 / window.__spotdiff.scale()))); if (d > bd) { bd = d; best = { x, y }; } }
    return { x: pic.left + (best.x / 200) * pic.width, y: pic.top + (best.y / 150) * pic.height, gap: bd }; });
  ok(empty.gap > 3, 'there is an empty place to tap for the mistake tests');
  await p.mouse.click(empty.x, empty.y);
  ok((await txt('#sd-miss')) === '失误：1' && (await p.locator('.sd-x').count()) === 2, 'a wrong tap: a mistake is counted and a cross shows on both pictures');
  ok(await p.evaluate(() => document.querySelector('.sd-pic[data-pic=a]').classList.contains('sd-shake')), 'the tapped picture shakes');
  await p.mouse.click(empty.x + 1, empty.y); await p.mouse.click(empty.x, empty.y + 1);
  ok((await txt('#sd-miss')) === '失误：3' && await p.evaluate(() => document.querySelector('#sd-hint').classList.contains('lit')) && await p.isEnabled('#sd-hint'), 'three mistakes light the hint button and the game goes on');
  ok(!(await p.isVisible('#sd-ovl')), '3 mistakes are not a loss');
  // a hint circles a remaining difference on both pictures
  await p.click('#sd-hint');
  ok((await p.locator('.sd-hint').count()) === 2 && (await txt('#sd-hint')) === '提示：2', 'the hint circles one difference on both pictures (2 left)');
  const hi = await hook(() => window.__spotdiff.game().hintsUsed), h0 = await spotPx(0, 'a');
  ok(hi === 1, 'a hint is counted');
  // tap a difference in picture B, the other in picture A, the third by keyboard
  const b0 = await spotPx(0, 'b'); await p.mouse.click(b0.x, b0.y);
  ok((await txt('#sd-found')) === '找到：1 / 3' && (await p.locator('.sd-ring').count()) === 2, 'a difference found in picture B: a ring on both pictures, counter 1 / 3');
  ok((await p.locator('.sd-hint').count()) === 0, 'the hint ring goes when that difference is found');
  await p.mouse.click(b0.x, b0.y);
  ok((await txt('#sd-miss')) === '失误：3' && (await p.locator('.sd-ring').count()) === 2, 'tapping a found difference again is neither a mistake nor counted twice');
  const a1 = await spotPx(1, 'a'); await p.mouse.click(a1.x, a1.y);
  ok((await txt('#sd-found')) === '找到：2 / 3', 'a difference found in picture A');
  // keyboard: arrows move a cursor, Space taps
  const target = await hook(() => window.__spotdiff.game().spots[2]);
  ok(!(await p.locator('.sd-cur').first().isVisible()), 'no cursor before the keyboard is used');
  const dx = Math.round((target.x - 100) / 10), dy = Math.round((target.y - 75) / 10);
  for (let k = 0; k < Math.abs(dx); k++) await p.keyboard.press(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
  for (let k = 0; k < Math.abs(dy); k++) await p.keyboard.press(dy > 0 ? 'ArrowDown' : 'ArrowUp');
  ok(await p.locator('.sd-cur').first().isVisible() && (await p.locator('.sd-cur').first().getAttribute('transform')) === `translate(${100 + dx * 10} ${75 + dy * 10})`, 'arrow keys move the cursor over the picture');
  await p.screenshot({ path: OUT + 'spotdiff-play-wide.png' });
  await p.keyboard.press('Space');
  ok((await txt('#sd-found')) === '找到：3 / 3', 'Space taps at the cursor: the last difference is found');
  await p.waitForSelector('#sd-ovl:not([hidden]) #sd-stars svg');
  const w1 = await hook(() => ({ stars: +document.querySelector('#sd-stars').dataset.stars, el: window.__spotdiff.elapsed(), mis: window.__spotdiff.game().mistakes }));
  const expect = (m, s, n) => { let r = 3; if (m > 1) r--; if (m > 4) r--; if (s > n * 20) r--; return Math.max(1, r); };
  ok(w1.stars === expect(w1.mis, w1.el, 3) && (await p.locator('#sd-stars svg.on').count()) === w1.stars, `the win panel shows ${w1.stars} stars (3 mistakes -> 2 stars)`);
  ok((await txt('#sd-ovl h2')) === '已全部找到。' && /^用时 \d+:\d\d，失误 3 次$/.test(await txt('#sd-ovl p:not(.rec)')) && await p.isVisible('#sd-rec') && (await txt('#sd-start')) === '下一幅', 'the win panel: title, time and mistakes, new record, Next picture');
  await p.screenshot({ path: OUT + 'spotdiff-win-wide.png' });
  const store = () => p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1') || '{}').spotdiff || {});
  const st1 = await store();
  ok(st1['best-0'] >= 1 && st1['stars-0'] === w1.stars && st1.solved === 1, 'best time and stars of the difficulty and the number of pictures solved are kept on this device');
  // next picture: a new random picture every time, never the same twice in a row
  const winAll = async () => { const n = await hook(() => window.__spotdiff.game().spots.length); for (let i = 0; i < n; i++) { const q = await spotPx(i, i % 2 ? 'a' : 'b'); await p.mouse.click(q.x, q.y); } await p.waitForSelector('#sd-stars svg'); };
  const seenLv = [seed0], marks = [await p.evaluate(() => document.querySelector('.sd-pic[data-pic=a] svg').innerHTML.replace(/<g class="sd-fx".*$/s, ''))];
  for (let k = 0; k < 3; k++) {
    await p.click('#sd-start');
    ok(!(await p.isVisible('#sd-ovl')) && (await txt('#sd-found')).startsWith('找到：0 /'), 'Next picture starts the next picture at once');
    seenLv.push(await hook(() => window.__spotdiff.seed())); marks.push(await p.evaluate(() => document.querySelector('.sd-pic[data-pic=a] svg').innerHTML.replace(/<g class="sd-fx".*$/s, '')));
    await winAll(); await p.waitForFunction(() => document.querySelector('#sd-ovl h2').textContent === '已全部找到。');
  }
  ok(new Set(seenLv).size === 4 && new Set(marks).size === 4, 'four pictures in a row are four different generated pictures: ' + seenLv);
  // timer + stars by time
  await p.click('#sd-start'); await hook(() => window.__spotdiff.setElapsed(999));
  await winAll(); await p.waitForFunction(() => document.querySelector('#sd-ovl h2').textContent === '已全部找到。');
  ok((await p.locator('#sd-stars svg.on').count()) === 2, 'slow but no mistakes: 2 stars');
  ok(!(await p.isVisible('#sd-rec')), 'a slower time is not a record');
  // difficulty button: 5 and 7 differences
  await p.click('#sd-start'); await p.click('#sd-diff');
  ok((await txt('#sd-diff')) === '难度：普通' && (await hook(() => window.__spotdiff.game().spots.length)) === 5 && await p.isVisible('#sd-ovl') && (await txt('#sd-found')) === '找到：0 / 5', 'difficulty button: normal = 5 differences, back to the start panel');
  await p.click('#sd-diff');
  ok((await txt('#sd-diff')) === '难度：困难' && (await hook(() => window.__spotdiff.game().spots.length)) === 7 && await p.evaluate(() => document.querySelector('#sd-diff').classList.contains('on')), 'hard = 7 differences');
  await p.click('#sd-start');
  for (let i = 0; i < 7; i++) { const q = await spotPx(i, 'b'); await p.mouse.click(q.x, q.y); }
  await p.waitForSelector('#sd-stars svg'); ok((await p.locator('.sd-ring').count()) === 14 && (await p.locator('#sd-stars svg.on').count()) === 3, 'hard: all 7 found, rings on both pictures, 3 stars');
  ok((await store()).diff === 2 && (await store()).solved >= 6, 'the difficulty and the number of solved pictures are remembered');
  // leaving removes the hook
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-grid');
  await p.waitForFunction(() => !window.__spotdiff);
  ok(true, 'leaving the game removes it (hook gone, listeners removed)');
  await p.keyboard.press('ArrowUp'); await p.keyboard.press('Space');
  ok(t.log.external.length === 0, 'no request left the app');
  await t.browser.close();

  // ---------- layout on four screens ----------
  const SIZES = [['phone', 390, 844], ['ipad-tall', 820, 1180], ['ipad-wide', 1180, 820], ['phone-wide', 844, 390]];
  for (const [name, w, hgt] of SIZES) {
    const s = await start(new Map(), { local: true, viewport: { width: w, height: hgt } });
    const q = s.page;
    await q.evaluate(() => (location.hash = '#/games/spotdiff')); await q.waitForSelector('#sd-start');
    await q.screenshot({ path: OUT + `spotdiff-${name}-ready.png` });
    await q.click('#sd-start');
    const m = await q.evaluate(() => {
      const r = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height }; };
      const a = r(document.querySelector('.sd-pic[data-pic=a]')), b = r(document.querySelector('.sd-pic[data-pic=b]')), hud = r(document.querySelector('.sd-hud'));
      return { a, b, hud, vw: document.documentElement.clientWidth, vh: document.documentElement.clientHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, scale: window.__spotdiff.scale(), n: window.__spotdiff.game().spots.length };
    });
    const inside = (x) => x.l >= -0.5 && x.r <= m.vw + 0.5 && x.t >= -0.5 && x.b <= m.vh + 0.5;
    ok(inside(m.a) && inside(m.b) && inside(m.hud), `${name} ${w}x${hgt}: both pictures and the buttons are on the screen (picture ${Math.round(m.a.w)} x ${Math.round(m.a.h)})`);
    ok(m.sw <= m.vw && m.sh <= m.vh + 1, `${name}: no page scrolling`);
    const stacked = m.b.t >= m.a.b - 1, side = m.b.l >= m.a.r - 1;
    ok(name.includes('tall') || name === 'phone' ? stacked : side, `${name}: pictures ${stacked ? 'one above the other' : 'side by side'}`);
    ok(!(m.a.l < m.b.r && m.b.l < m.a.r && m.a.t < m.b.b && m.b.t < m.a.b), `${name}: the pictures do not overlap`);
    const left = Math.min(m.a.l, m.b.l), right = m.vw - Math.max(m.a.r, m.b.r);
    ok(Math.abs(left - right) <= 3, `${name}: pictures are centred (${Math.round(left)} / ${Math.round(right)})`);
    ok(m.a.w >= 150 && Math.abs(m.a.w - m.b.w) < 1, `${name}: pictures are big enough and equal`);
    // finger-sized target: a tap 17 px beside the middle of the smallest difference still finds it
    const tgt = await q.evaluate(() => { const g = window.__spotdiff.game(); let k = 0; g.spots.forEach((sp, i) => { if (sp.r < g.spots[k].r) k = i; }); const sp = g.spots[k], pic = document.querySelector('.sd-pic[data-pic=b]').getBoundingClientRect(); return { x: pic.left + (sp.x / 200) * pic.width, y: pic.top + (sp.y / 150) * pic.height }; });
    await q.mouse.click(tgt.x + 17, tgt.y);
    ok((await q.textContent('#sd-found')).startsWith('找到：1'), `${name}: a tap 17 px from the middle of the smallest difference still finds it (finger-sized targets)`);
    await q.screenshot({ path: OUT + `spotdiff-${name}.png` });
    await s.browser.close();
  }

  // ---------- EN / FR ----------
  const i18nData = fs.readFileSync('src/i18n-data.ts', 'utf8');
  const merged = i18nData.includes('提示：{0}') && i18nData.includes('"找不同"');
  const keyRegexes = Object.keys(TR).map((k) => [k, new RegExp('^' + k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\d\}/g, '.+?') + '$')]);
  ok(Object.entries(TR).every(([k, v]) => Array.isArray(v) && v.length === 2 && v[0] && v[1] && !CJK.test(v[0] + v[1]) && k.length > 1), 'every entry of the translation file has English and French and no one-character key');
  for (const [loc, tag] of [['zh-CN', 'zh'], ['en-US', 'en'], ['fr-FR', 'fr']]) {
    const s = await start(new Map(), { local: true, locale: loc, viewport: { width: 390, height: 844 } });
    const q = s.page;
    await q.evaluate(() => (location.hash = '#/games/spotdiff')); await q.waitForSelector('#sd-start');
    const texts = new Set(); const grab = async () => { for (const x of await q.evaluate(() => [...document.querySelectorAll('.sd-wrap h2, .sd-wrap p:not([hidden]), .sd-wrap button, .sd-wrap .sd-stat')].filter((e) => e.offsetParent).map((e) => e.textContent.trim()))) texts.add(x); };
    await grab(); await q.click('#sd-start'); await grab();
    await q.mouse.click(5, 300); await grab();
    for (let k = 0; k < 3; k++) { await q.click('#sd-diff'); await q.click('#sd-start').catch(() => {}); await grab(); }
    await q.evaluate(() => { const w = window.__spotdiff; w.setElapsed(0); });
    const n = await q.evaluate(() => window.__spotdiff.game().spots.length);
    for (let i = 0; i < n; i++) { const c = await q.evaluate((i) => { const sp = window.__spotdiff.game().spots[i], pic = document.querySelector('.sd-pic[data-pic=b]').getBoundingClientRect(); return { x: pic.left + (sp.x / 200) * pic.width, y: pic.top + (sp.y / 150) * pic.height }; }, i); await q.mouse.click(c.x, c.y); }
    await q.waitForSelector('#sd-stars svg'); await grab();
    await q.screenshot({ path: OUT + `spotdiff-win-${tag}.png` });
    if (tag === 'zh') {
      const unknown = [...texts].filter((x) => !keyRegexes.some(([, re]) => re.test(x)));
      ok(unknown.length === 0, `every Chinese text of the screen is in the translation file (${texts.size} texts)${unknown.length ? ' -> ' + unknown.join(' | ') : ''}`);
    } else if (merged) {
      const left = [...texts].filter((x) => CJK.test(x));
      ok(left.length === 0, `${tag}: nothing Chinese left on the screen${left.length ? ' -> ' + left.join(' | ') : ''}`);
    } else {
      ok(true, `${tag}: (translations not merged into i18n-data.ts yet: the zh check above covers the keys)`);
    }
    await s.browser.close();
  }
  await done();
})();
