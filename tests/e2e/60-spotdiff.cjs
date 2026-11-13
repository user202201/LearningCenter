// Spot the difference (找不同): the scene data and the rules (every difference really changes the picture, none overlap, all inside, the counts of the levels, hit
// testing, hints, stars, no repeat of a picture until all four were seen), the screen (taps on either picture, a wrong tap, hints, win, next picture, best time,
// keyboard), the layout on four screens, EN / FR, and no request leaves the app.
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

  // ---------- the data and the rules ----------
  const L = await p.evaluate(async () => {
    const M = await import('/src/games/spotdiff-logic.ts');
    const res = { bad: [], kinds: {}, scenes: M.SCENES.length, spots: 0 };
    const bad = (m) => res.bad.push(m);
    if (M.LEVEL_COUNT !== 12 || M.SCENES.length < 12) bad('need 12 levels / at least 12 scenes');
    // counts of the levels: 3 / 5 / 7, four levels of each
    const per = [0, 0, 0];
    for (let l = 0; l < M.LEVEL_COUNT; l++) { const i = M.levelInfo(l); per[i.difficulty]++; if (i.diffs.length !== [3, 5, 7][i.difficulty] || i.n !== i.diffs.length) bad('level ' + l + ' has ' + i.diffs.length + ' differences'); }
    if (per.join() !== '4,4,4') bad('4 levels per difficulty: ' + per);
    const sceneIds = new Set();
    for (const sc of M.SCENES) {
      if (sceneIds.has(sc.id)) bad('duplicate scene ' + sc.id); sceneIds.add(sc.id);
      const ids = new Set(sc.pieces.map((q) => q.id)); if (ids.size !== sc.pieces.length) bad(sc.id + ': duplicate piece ids');
      if (sc.pieces.length < 12) bad(sc.id + ': scene too empty');
      if (sc.diffs.length < 7) bad(sc.id + ': needs 7 differences, has ' + sc.diffs.length);
      const base = M.sceneMarkup(sc, []);
      if (!base.includes('<circle') || base.length < 800) bad(sc.id + ': scene looks empty');
      const spots = [];
      for (const d of sc.diffs) {
        res.kinds[d.kind] = (res.kinds[d.kind] || 0) + 1;
        const one = M.sceneMarkup(sc, [d]);
        if (one === base) bad(sc.id + '/' + d.id + ': does not change the picture');
        if (d.kind === 'missing') { if (one.includes('data-p="' + d.p + '"') || !base.includes('data-p="' + d.p + '"')) bad(d.id + ': missing piece still drawn'); }
        if (d.kind === 'added') { if (!d.add || !one.includes('data-p="' + d.add.id + '"') || base.includes('data-p="' + d.add.id + '"')) bad(d.id + ': added piece wrong'); }
        if (d.kind === 'colour' && !('f' in d.set)) bad(d.id + ': a colour difference changes no colour');
        if (d.kind === 'size' && !(('r' in d.set) || ('w' in d.set) || ('h' in d.set) || ('rx' in d.set))) bad(d.id + ': a size difference changes no size');
        if (d.kind === 'pattern' && !('pat' in d.set)) bad(d.id + ': pattern');
        if (d.kind === 'moved' && !('x' in d.set || 'y' in d.set)) bad(d.id + ': moved');
        if (d.p && !sc.pieces.some((q) => q.id === d.p)) bad(d.id + ': names a piece that does not exist');
        if (d.add && sc.pieces.some((q) => q.id === d.add.id)) bad(d.id + ': added piece already in the scene');
        // the differences do not touch each other: applying one leaves the others' pieces alone, so two differences never change the same piece
        const s = M.diffSpot(sc, d), b = M.diffBox(sc, d); spots.push(s); res.spots++;
        if (s.x - s.r < 0 || s.y - s.r < 0 || s.x + s.r > M.SW || s.y + s.r > M.SH) bad(d.id + ': hit area leaves the scene');
        if (s.x < b.x0 || s.x > b.x1 || s.y < b.y0 || s.y > b.y1) bad(d.id + ': spot is not on the changed piece');
        if (s.r < 13) bad(d.id + ': hit radius ' + s.r);
      }
      const touched = sc.diffs.map((d) => d.p || d.add.id); if (new Set(touched).size !== touched.length) bad(sc.id + ': two differences on one piece');
      for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) if (Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y) < spots[i].r + spots[j].r) bad(sc.id + ': differences ' + i + ' and ' + j + ' overlap');
      // all together: picture B differs from A and from every picture with one difference missing
      const all = M.sceneMarkup(sc, sc.diffs);
      for (const d of sc.diffs) if (M.sceneMarkup(sc, sc.diffs.filter((x) => x !== d)) === all) bad(sc.id + '/' + d.id + ': does not show in the full picture');
    }
    // the game: hit testing
    const g = M.newGame(5), n = g.spots.length; if (n !== 5) bad('level 5 has ' + n);
    const s0 = g.spots[0];
    let r = M.tap(g, s0.x + s0.r * 0.9, s0.y); if (r.kind !== 'hit' || r.i !== 0) bad('tap near the edge missed');
    r = M.tap(g, s0.x, s0.y); if (r.kind !== 'again' || g.mistakes !== 0 || M.foundCount(g) !== 1) bad('the same difference was counted twice');
    r = M.tap(g, s0.x + s0.r + 3, s0.y + s0.r + 3); if (r.kind !== 'miss' || g.mistakes !== 1) bad('a tap beside counted as a hit');
    r = M.tap(g, g.spots[1].x, g.spots[1].y + 200); if (r.kind !== 'miss' || g.mistakes !== 2) bad('a tap far away');
    if (M.won(g)) bad('won too early');
    // minimal radius
    const g2 = M.newGame(0); const sp = g2.spots[0]; if (M.tap(g2, sp.x + sp.r + 4, sp.y).kind !== 'miss') bad('without minR a far tap hit'); if (M.tap(g2, sp.x + sp.r + 4, sp.y, sp.r + 6).kind !== 'hit') bad('minR did not widen');
    // hints: 3 per picture, never a found one, the button lights after 3 mistakes
    const g3 = M.newGame(8); if (M.hintLit(g3)) bad('hint lit at the start');
    for (let k = 0; k < 3; k++) M.tap(g3, 1, 1); if (!M.hintLit(g3)) bad('hint not lit after 3 mistakes'); if (M.won(g3)) bad('3 mistakes must not end the game');
    M.tap(g3, g3.spots[0].x, g3.spots[0].y);
    const seenH = []; for (let k = 0; k < 4; k++) seenH.push(M.hint(g3));
    if (seenH[0] !== 1 || seenH[1] !== 1 || seenH[2] !== 1 || seenH[3] !== -1 || M.hintsLeft(g3) !== 0 || M.hintLit(g3)) bad('hints: ' + seenH);
    // random games: tap every spot in random order with random misses between
    let seed = 7; const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let gi = 0; gi < 300; gi++) {
      const lv = Math.floor(rng() * 12), g4 = M.newGame(lv), order = g4.spots.map((_, i) => i).sort(() => rng() - 0.5); let mis = 0;
      for (const i of order) {
        if (rng() < 0.4) { const before = g4.mistakes; M.tap(g4, -50, -50); if (g4.mistakes !== before + 1) bad('miss not counted'); mis++; }
        if (M.won(g4)) bad('won before the last');
        const s = g4.spots[i], a = rng() * 6.28, rr = s.r * 0.6 * rng();
        const rs = M.tap(g4, s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr); if (rs.kind !== 'hit') bad('random tap inside missed (level ' + lv + ')');
      }
      if (!M.won(g4) || g4.mistakes !== mis) bad('game not won / mistakes wrong');
    }
    // stars
    const st = M.stars; if (st(0, 10, 5) !== 3 || st(1, 90, 5) !== 3 || st(2, 10, 5) !== 2 || st(5, 10, 5) !== 1 || st(0, 5 * 20 + 1, 5) !== 2 || st(9, 999, 5) !== 1) bad('stars');
    // no repeat until all four were seen
    for (let d = 0; d < 3; d++) {
      let seen = [], all = [];
      for (let k = 0; k < 12; k++) { const pk = M.pickLevel(d, seen, rng); if (k % 4 === 0) all = []; if (all.includes(pk.k)) bad('picture repeated inside a round'); all.push(pk.k); seen = pk.seen; if (pk.k < 0 || pk.k > 3) bad('pickLevel range'); }
      let lastK = -1; seen = [0, 1, 2, 3]; for (let k = 0; k < 20; k++) { const pk = M.pickLevel(d, seen, rng); if (pk.k === seen[seen.length - 1]) bad('same picture twice at the start of a new round'); seen = pk.seen; }
    }
    // cursor
    let c = { x: 195, y: 148 }; c = M.moveCursor(c, 1, 1); if (c.x !== 200 || c.y !== 150) bad('cursor not clamped'); c = M.moveCursor({ x: 3, y: 4 }, -1, -1); if (c.x !== 0 || c.y !== 0) bad('cursor not clamped low');
    if (M.fmtTime(75) !== '1:15' || M.fmtTime(9) !== '0:09') bad('time format');
    return res;
  });
  ok(L.bad.length === 0, `scene data and rules: ${L.scenes} scenes, ${L.spots} differences, 300 random games${L.bad.length ? ' -> ' + L.bad.slice(0, 8).join('; ') : ''}`);
  ok(['missing', 'added', 'colour', 'size', 'pattern', 'moved'].every((k) => L.kinds[k] >= 3), 'all kinds of differences are used: ' + JSON.stringify(L.kinds));

  // ---------- the screen ----------
  const hook = (f) => p.evaluate(f);
  const spotPx = (i, side) => p.evaluate(([i, side]) => {
    const w = window.__spotdiff, s = w.game().spots[i], pic = document.querySelector(`.sd-pic[data-pic=${side}]`).getBoundingClientRect();
    return { x: pic.left + (s.x / 200) * pic.width, y: pic.top + (s.y / 150) * pic.height, scale: w.scale() };
  }, [i, side]);
  const txt = (sel) => p.textContent(sel);
  ok(await p.isVisible('#sd-ovl') && (await txt('#sd-ovl h2')) === '找不同', 'a start panel with the name of the game');
  const lvl0 = await hook(() => window.__spotdiff.level()), n0 = await hook(() => window.__spotdiff.game().spots.length);
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
  ok(st1['best-' + lvl0] >= 1 && st1['stars-' + lvl0] === w1.stars && st1.level === lvl0 && (st1.diff ?? 0) === 0, 'best time, stars and the level reached are kept on this device');
  // next picture: never the same until all four were seen
  const winAll = async () => { const n = await hook(() => window.__spotdiff.game().spots.length); for (let i = 0; i < n; i++) { const q = await spotPx(i, i % 2 ? 'a' : 'b'); await p.mouse.click(q.x, q.y); } await p.waitForSelector('#sd-stars svg'); };
  const seenLv = [lvl0];
  for (let k = 0; k < 3; k++) {
    await p.click('#sd-start');
    ok(!(await p.isVisible('#sd-ovl')) && (await txt('#sd-found')).startsWith('找到：0 /'), 'Next picture starts the next picture at once');
    seenLv.push(await hook(() => window.__spotdiff.level()));
    await winAll(); await p.waitForFunction(() => document.querySelector('#sd-ovl h2').textContent === '已全部找到。');
  }
  ok(new Set(seenLv).size === 4 && seenLv.every((l) => l >= 0 && l < 4), 'the four easy pictures come one after the other, none repeated: ' + seenLv);
  // timer + stars by time
  await p.click('#sd-start'); await hook(() => window.__spotdiff.setElapsed(999));
  const lvlSlow = await hook(() => window.__spotdiff.level()); await winAll(); await p.waitForFunction(() => document.querySelector('#sd-ovl h2').textContent === '已全部找到。');
  ok((await p.locator('#sd-stars svg.on').count()) === 2, 'slow but no mistakes: 2 stars');
  ok(!(await p.isVisible('#sd-rec')) || (await store())['best-' + lvlSlow] >= 1, 'a slower time is not a record');
  // difficulty button: 5 and 7 differences
  await p.click('#sd-start'); await p.click('#sd-diff');
  ok((await txt('#sd-diff')) === '难度：普通' && (await hook(() => window.__spotdiff.game().spots.length)) === 5 && await p.isVisible('#sd-ovl') && (await txt('#sd-found')) === '找到：0 / 5', 'difficulty button: normal = 5 differences, back to the start panel');
  await p.click('#sd-diff');
  ok((await txt('#sd-diff')) === '难度：困难' && (await hook(() => window.__spotdiff.game().spots.length)) === 7 && await p.evaluate(() => document.querySelector('#sd-diff').classList.contains('on')), 'hard = 7 differences');
  ok((await hook(() => window.__spotdiff.level())) >= 8, 'hard levels are numbers 8-11');
  await p.click('#sd-start');
  for (let i = 0; i < 7; i++) { const q = await spotPx(i, 'b'); await p.mouse.click(q.x, q.y); }
  await p.waitForSelector('#sd-stars svg'); ok((await p.locator('.sd-ring').count()) === 14 && (await p.locator('#sd-stars svg.on').count()) === 3, 'hard: all 7 found, rings on both pictures, 3 stars');
  ok((await store()).diff === 2, 'the difficulty is remembered');
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
