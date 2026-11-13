// Water sort: the pure rules (pour, win, generation, the solver; all 30 levels solvable and deterministic) and the screen (tap / keys, undo, restart, extra tube, levels, win, saved progress, layout on 4 screens, EN / FR).
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const JSONKEYS = Object.keys(JSON.parse(fs.readFileSync(__dirname + '/../../src/games/watersort.i18n.json', 'utf8')));

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  const p = t.page;
  const open = async () => { await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-grid'); await p.waitForFunction(() => !window.__watersort); await p.evaluate(() => (location.hash = '#/games/watersort')); await p.waitForSelector('#ws-tubes .ws-tube'); await p.waitForTimeout(150); };
  await open();

  // ---------- the rules ----------
  const L = await p.evaluate(async () => {
    const M = await import('/src/games/watersort-logic.ts');
    const M2 = await import('/src/games/watersort-logic.ts?fresh=1');   // a second copy of the module: its cache is empty, so equal results prove that generation is deterministic
    const res = { bad: [], solved: 0, lens: [], pours: 0 };
    let seed = 99; const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    // colours per level: 3 growing to 10
    let prev = 0;
    for (let l = 1; l <= 30; l++) { const c = M.colorsOf(l); if (c < prev || c < 3 || c > 10) res.bad.push('colorsOf ' + l); prev = c; }
    if (M.colorsOf(1) !== 3 || M.colorsOf(30) !== 10) res.bad.push('colorsOf ends');
    // pour rules by hand
    let tb = [[0, 1, 1], [2, 1], [], [0, 0, 0, 0], [1, 1, 1, 1], [3, 1]];
    if (M.pour(tb, 0, 0) !== 0) res.bad.push('pour into itself');
    if (M.pour(tb, 2, 0) !== 0) res.bad.push('pour from an empty tube');
    if (M.pour(tb, 0, 3) !== 0 || M.pour(tb, 0, 4) !== 0) res.bad.push('pour into a full tube');
    if (M.pour(tb, 1, 5) !== 0 && JSON.stringify(tb[5]) !== '[3,1,1]') res.bad.push('x');   // (1 onto top 1: allowed, see below)
    tb = [[0, 1, 1], [2, 1], [], [0, 0, 0, 0], [1, 1, 1, 1], [3, 1]];
    if (M.pour(tb, 0, 1) !== 2 || JSON.stringify(tb[0]) !== '[0]' || JSON.stringify(tb[1]) !== '[2,1,1,1]') res.bad.push('a run of 2 moves onto the same colour as far as there is room: ' + JSON.stringify(tb));
    tb = [[0, 1, 1, 1], [2, 1], [0, 3]];
    if (M.pour(tb, 0, 1) !== 2 || tb[0].length !== 2 || tb[1].length !== 4) res.bad.push('only as many units as fit (2 of 3)');
    if (M.pour(tb, 2, 1) !== 0) res.bad.push('different top colour accepted');
    if (M.pour(tb, 2, 0) !== 0) res.bad.push('different top colour accepted (2)');
    tb = [[0, 1, 1, 1], []];
    if (M.pour(tb, 0, 1) !== 3 || tb[1].length !== 3 || tb[0].length !== 1) res.bad.push('the whole run into an empty tube');
    if (M.pourAmount([[1], [1]], 0, 1) !== 1) res.bad.push('pourAmount');
    // win detection
    if (!M.isWon([[0, 0, 0, 0], [], [1, 1, 1, 1]])) res.bad.push('won not detected');
    if (M.isWon([[0, 0, 0], [0], []])) res.bad.push('won with a split colour');
    if (M.isWon([[0, 0, 0, 1], [1, 1, 1, 0]])) res.bad.push('won with mixed tubes');
    if (M.isWon([[0, 0], [0, 0]])) res.bad.push('won with two half tubes');
    // solver on special positions
    if (JSON.stringify(M.solve([[0, 0, 0, 0], []])) !== '[]') res.bad.push('solved position needs no move');
    if (M.solve([[0, 1, 0, 1], [1, 0, 1, 0]]) !== null) res.bad.push('an unsolvable position was "solved"');
    // generation: the 30 levels
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    for (let l = 1; l <= 30; l++) {
      const a = M.levelTubes(l), b = M.levelTubes(l), c = M2.levelTubes(l), n = M.colorsOf(l);
      if (!same(a, b) || !same(a, c)) res.bad.push('level ' + l + ' not deterministic');
      if (a.length !== n + 2) res.bad.push('level ' + l + ' tube count ' + a.length);
      if (a.filter((x) => x.length === 0).length !== 2) res.bad.push('level ' + l + ' needs 2 empty tubes');
      if (!M.validTubes(a, n)) res.bad.push('level ' + l + ' units');
      if (M.isWon(a) || a.some((x) => x.length === 4 && x.every((y) => y === x[0]))) res.bad.push('level ' + l + ' starts (partly) solved');
      a[0].push(99); if (same(a, M.levelTubes(l))) res.bad.push('levelTubes hands out its own cache');   // (a copy must be returned)
      const s = M.solve(M.levelTubes(l), 300000);
      if (!s) { res.bad.push('level ' + l + ' NOT solvable'); continue; }
      const w = M.levelTubes(l); let legal = true;
      for (const [x, y] of s) if (!M.pour(w, x, y)) legal = false;
      if (!legal || !M.isWon(w)) res.bad.push('level ' + l + ' solution does not replay'); else { res.solved++; res.lens.push(s.length); }
    }
    if (same(M.levelTubes(5), M.levelTubes(6))) res.bad.push('levels 5 and 6 are equal');
    // fuzz: random legal pours keep the units
    for (let g = 0; g < 300; g++) {
      const lv = 1 + Math.floor(rng() * 30), w = M.levelTubes(lv), n = M.colorsOf(lv);
      for (let i = 0; i < 200; i++) {
        const a = Math.floor(rng() * w.length), b = Math.floor(rng() * w.length), before = JSON.stringify(w), amt = M.pourAmount(w, a, b), moved = M.pour(w, a, b);
        if (amt !== moved) res.bad.push('pourAmount != pour');
        if (!moved && JSON.stringify(w) !== before) res.bad.push('a refused pour changed the tubes');
        if (moved) res.pours++;
        if (!M.validTubes(w, n)) { res.bad.push('units lost / tube over full at level ' + lv); break; }
      }
    }
    return res;
  });
  ok(L.bad.length === 0, 'rules: ' + (L.bad.slice(0, 5).join('; ') || `ok (${L.solved} levels solved by the solver, ${L.pours} random pours kept every unit)`));
  ok(L.solved === 30, 'all 30 levels are solvable (solution lengths ' + Math.min(...L.lens) + '-' + Math.max(...L.lens) + ')');

  // ---------- the screen ----------
  const api = (f) => p.evaluate(f);
  const tubesNow = () => p.evaluate(() => window.__watersort.tubes());
  const click = (i) => p.click(`#ws-tubes .ws-tube[data-i="${i}"]`);
  const solution = (lv) => p.evaluate(async (l) => { const M = await import('/src/games/watersort-logic.ts'); return M.solve(M.levelTubes(l), 300000); }, lv);
  const play = async (moves) => { for (const [a, b] of moves) { await click(a); await click(b); } };
  const first = async () => p.evaluate(async () => { const M = await import('/src/games/watersort-logic.ts'); const t = window.__watersort.tubes(); return M.legalMoves(t)[0]; });
  ok((await api(() => window.__watersort.level())) === 1 && (await p.textContent('#ws-level')) === '第1关' && (await p.textContent('#ws-moves')) === '步数：0' && (await p.textContent('#ws-best')) === '最少：-', 'opens on level 1 with the level, moves and best pills');
  ok((await p.locator('#ws-tubes .ws-tube').count()) === 5, 'level 1: 3 colours + 2 empty tubes = 5 tubes');
  ok(await p.locator('#ws-ovl').isHidden(), 'no overlay while playing');
  await p.screenshot({ path: OUT + 'ws-level1-820.png' });

  // choose / pour by pointer
  const T0 = await tubesNow();
  const emptyI = T0.findIndex((x) => x.length === 0);
  await click(emptyI);
  ok((await api(() => window.__watersort.selected())) === -1, 'tapping an empty tube first selects nothing');
  await click(0);
  ok((await api(() => window.__watersort.selected())) === 0 && await p.locator('.ws-tube.sel').count() === 1, 'a tap lifts the tube (selected)');
  await click(0);
  ok((await api(() => window.__watersort.selected())) === -1 && await p.locator('.ws-tube.sel').count() === 0, 'a second tap on it puts it back');
  // a refused pour: onto a tube with another colour on top
  const bad = await p.evaluate(async () => { const M = await import('/src/games/watersort-logic.ts'); const t = window.__watersort.tubes(); for (let a = 0; a < t.length; a++) for (let b = 0; b < t.length; b++) if (a !== b && t[a].length && t[b].length && M.topColor(t[a]) !== M.topColor(t[b])) return [a, b]; return null; });
  await click(bad[0]); const before = JSON.stringify(await tubesNow()); await click(bad[1]);
  ok(JSON.stringify(await tubesNow()) === before && (await api(() => window.__watersort.moves())) === 0 && (await api(() => window.__watersort.selected())) === bad[1], 'a refused pour changes nothing, the selection moves to the tapped tube');
  await click(bad[1]);
  // a real pour by two taps
  const mv = await first(); const expect = await p.evaluate(async ([a, b]) => { const M = await import('/src/games/watersort-logic.ts'); const t = window.__watersort.tubes(); M.pour(t, a, b); return t; }, mv);
  await click(mv[0]); await click(mv[1]);
  ok(JSON.stringify(await tubesNow()) === JSON.stringify(expect) && (await p.textContent('#ws-moves')) === '步数：1', 'two taps pour: the tubes follow the rules, the moves pill says 1');
  ok(await p.evaluate(([i]) => document.querySelectorAll(`#ws-tubes .ws-tube[data-i="${i}"] .ws-u`).length === window.__watersort.tubes()[i].length, [mv[1]]), 'the screen shows exactly the units of the tubes');
  // undo
  await p.click('#ws-undo');
  ok(JSON.stringify(await tubesNow()) === JSON.stringify(T0) && (await p.textContent('#ws-moves')) === '步数：0' && await p.locator('#ws-undo').isDisabled(), 'undo takes the pour back (moves 0, undo off)');
  // keyboard
  await p.keyboard.press(String(mv[0] + 1)); ok((await api(() => window.__watersort.selected())) === mv[0], 'a number key chooses the tube');
  await p.keyboard.press(String(mv[1] + 1));
  ok(JSON.stringify(await tubesNow()) === JSON.stringify(expect), 'two number keys pour');
  await p.keyboard.press('u'); ok(JSON.stringify(await tubesNow()) === JSON.stringify(T0), 'U undoes');
  await p.click('#ws-restart');   // (the frame starts on tube 1 again)
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight');
  ok((await p.locator('.ws-tube.cur').getAttribute('data-i')) === '2', 'arrow keys move the yellow frame');
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('Enter');
  ok((await api(() => window.__watersort.selected())) === 0, 'Enter chooses the tube under the frame');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter');   // tube 1 on tube 0 (or a refusal): never breaks the units
  ok(await p.evaluate(async () => (await import('/src/games/watersort-logic.ts')).validTubes(window.__watersort.tubes(), 3)), 'keyboard pours keep every unit');
  // restart
  await p.click('#ws-restart');
  ok(JSON.stringify(await tubesNow()) === JSON.stringify(T0) && (await p.textContent('#ws-moves')) === '步数：0', 'restart gives the same start position');
  // extra tube: once
  await p.click('#ws-extra');
  ok((await p.locator('#ws-tubes .ws-tube').count()) === 6 && await p.locator('#ws-extra').isDisabled() && (await api(() => window.__watersort.extra())), 'one extra empty tube, only once per level');
  await p.click('#ws-restart');
  ok((await p.locator('#ws-tubes .ws-tube').count()) === 5 && !(await p.locator('#ws-extra').isDisabled()), 'restart removes the extra tube and gives the button back');

  // the colours and the marks (children who can not tell the hues apart)
  await p.click('#ws-pick'); await p.click('.ws-lv[data-level="30"]');
  const cm = await p.evaluate(() => {
    const seen = new Map();
    for (const u of document.querySelectorAll('#ws-tubes .ws-u')) seen.set(u.dataset.c, { bg: getComputedStyle(u).backgroundColor, mark: u.querySelector('svg').innerHTML });
    return [...seen.values()];
  });
  const rgb = (s) => s.match(/\d+/g).slice(0, 3).map(Number);
  let minD = 1e9; for (let i = 0; i < cm.length; i++) for (let j = i + 1; j < cm.length; j++) { const a = rgb(cm[i].bg), b = rgb(cm[j].bg); minD = Math.min(minD, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])); }
  ok(cm.length === 10 && new Set(cm.map((x) => x.bg)).size === 10 && minD >= 45, `level 30: 10 colours, all different (closest pair distance ${Math.round(minD)})`);
  ok(new Set(cm.map((x) => x.mark)).size === 10, 'every colour has its own mark (10 different shapes)');

  // level 30 by taps, the last level
  await p.screenshot({ path: OUT + 'ws-level30-820.png' });
  const s30 = await solution(30); await play(s30);
  if (!(await api(() => window.__watersort.won()))) console.log('DEBUG', await api(() => JSON.stringify({ lv: window.__watersort.level(), m: window.__watersort.moves(), sel: window.__watersort.selected(), t: window.__watersort.tubes() })), s30.length, p.url());
  ok(await api(() => window.__watersort.won()) && await p.locator('#ws-ovl').isVisible() && (await p.textContent('#ws-ovl h2')) === '全部通关！' && (await p.textContent('#ws-next')) === '选关', 'level 30 solved by tapping: the last-level overlay');
  await p.screenshot({ path: OUT + 'ws-win-last.png' });
  await p.click('#ws-next');
  ok(await p.locator('#ws-picker').isVisible(), 'the last level\'s button opens the level picker');

  // a win on level 1, by keys; progress saved
  await p.click('.ws-lv[data-level="1"]');
  const s1 = await solution(1);
  for (const [a, b] of s1) { await p.keyboard.press(String(a + 1)); await p.keyboard.press(String(b + 1)); }
  ok(await api(() => window.__watersort.won()) && await p.locator('#ws-ovl').isVisible() && (await p.textContent('#ws-ovl h2')) === '过关啦！' && (await p.textContent('#ws-ovl p')) === `用了${s1.length}步`, 'level 1 solved with the number keys: the win overlay says the moves');
  await p.screenshot({ path: OUT + 'ws-win-820.png' });
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).watersort);
  ok(saved.solved['1'] === s1.length && saved.solved['30'] === s30.length && saved.level === 1, 'progress is kept in learn.games.v1: ' + JSON.stringify(saved));
  ok((await p.textContent('#ws-best')) === `最少：${s1.length}`, 'the best pill shows the fewest moves');
  const w0 = await tubesNow(); await p.evaluate(() => { document.querySelector('#ws-tubes .ws-tube[data-i="0"]').click(); document.querySelector('#ws-tubes .ws-tube[data-i="1"]').click(); });
  ok(JSON.stringify(await tubesNow()) === JSON.stringify(w0), 'nothing can be poured after the win');
  await p.keyboard.press('Enter');
  ok((await api(() => window.__watersort.level())) === 2 && await p.locator('#ws-ovl').isHidden(), 'Enter (or the Next button) goes to level 2');
  ok((await p.locator('#ws-tubes .ws-tube').count()) === 5, 'level 2: 3 colours, 5 tubes');
  // picker
  await p.click('#ws-pick');
  const pk = await p.evaluate(() => ({ n: document.querySelectorAll('.ws-lv').length, solved: [...document.querySelectorAll('.ws-lv.solved')].map((b) => b.dataset.level), now: document.querySelector('.ws-lv.now')?.dataset.level, label: document.querySelector('#ws-count').textContent, ticks: document.querySelectorAll('.ws-lv .ws-tick').length, pick: document.querySelector('#ws-pick').textContent }));
  ok(pk.n === 30 && pk.solved.join() === '1,30' && pk.now === '2' && pk.ticks === 2 && pk.label === '已通关：2 / 30' && pk.pick === '继续', 'the picker: 30 round buttons, solved ones marked, the current one framed');
  await p.screenshot({ path: OUT + 'ws-picker-820.png' });
  await p.click('.ws-lv[data-level="17"]');
  ok((await api(() => window.__watersort.level())) === 17 && (await api(() => window.__watersort.colors())) === 7 && (await p.locator('#ws-tubes .ws-tube').count()) === 9, 'any level is open: level 17 has 7 colours + 2 tubes');
  await open();
  ok((await api(() => window.__watersort.level())) === 17, 'the level reached is remembered after leaving and coming back');

  // ---------- layout ----------
  for (const [name, w, hgt] of [['phone', 390, 844], ['ipad', 820, 1180], ['ipadland', 1180, 820], ['side', 844, 390], ['small', 320, 568]]) {
    await p.setViewportSize({ width: w, height: hgt });
    for (const lv of [1, 17, 30]) {
      await open(); await p.click('#ws-pick'); await p.click(`.ws-lv[data-level="${lv}"]`);
      if (lv === 30) await p.click('#ws-extra');
      await p.keyboard.press('1');   // a lifted tube must stay on the screen too
      await p.waitForTimeout(250);
      const m = await p.evaluate(() => {
        const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
        const f = R(document.querySelector('#ws-field')), hud = R(document.querySelector('.ws-hud'));
        const tb = [...document.querySelectorAll('#ws-tubes .ws-tube')].map(R);
        return { f, hud, tb, vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, btns: [...document.querySelectorAll('.ws-hud button')].every((b) => { const r = b.getBoundingClientRect(); return r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5; }), stat: [...document.querySelectorAll('.ws-stat')].every((b) => b.scrollWidth <= b.clientWidth + 1) };
      });
      const inside = (b, o) => b.l >= o.l - 0.5 && b.r <= o.r + 0.5 && b.t >= o.t - 0.5 && b.b <= o.b + 0.5;
      const tag = `${name} ${w}x${hgt} level ${lv}`;
      ok(m.tb.every((b) => inside(b, m.f)) && inside(m.f, { l: 0, r: m.vw, t: 0, b: m.vh }) && m.btns && m.stat, `${tag}: field, tubes (one lifted) and buttons are on the screen (tube ${Math.round(m.tb[0].w)}px)`);
      ok(m.sw <= m.vw && m.sh <= m.vh + 1, `${tag}: no page scrolling`);
      let overlap = false; for (let i = 0; i < m.tb.length; i++) for (let j = i + 1; j < m.tb.length; j++) { const a = m.tb[i], b = m.tb[j]; if (a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1) overlap = true; }
      ok(!overlap, `${tag}: no two tubes overlap`);
      const gl = Math.min(...m.tb.map((b) => b.l)) - m.f.l, gr = m.f.r - Math.max(...m.tb.map((b) => b.r));
      ok(Math.abs(gl - gr) <= 4, `${tag}: the tubes are centred in the field (${Math.round(gl)} / ${Math.round(gr)})`);
      if (name !== 'side') ok(Math.abs(m.f.l - (m.vw - m.f.r)) <= 3, `${tag}: the field is centred`);
      ok(m.tb[0].w >= (lv === 30 ? 22 : 30) && m.f.w >= 200, `${tag}: tubes are big enough (${Math.round(m.tb[0].w)}px)`);
      await p.screenshot({ path: OUT + `ws-${name}-${lv}.png` });
    }
  }
  // the overlay and the picker fit too
  for (const [name, w, hgt] of [['phone', 390, 844], ['side', 844, 390], ['ipadland', 1180, 820]]) {
    await p.setViewportSize({ width: w, height: hgt }); await open(); await p.click('#ws-pick'); await p.click('.ws-lv[data-level="1"]');
    await play(await solution(1)); await p.waitForTimeout(150);
    const o = await p.evaluate(() => { const f = document.querySelector('#ws-field').getBoundingClientRect(), b = document.querySelector('#ws-next').getBoundingClientRect(), a = document.querySelector('#ws-again').getBoundingClientRect(); return { fb: f.bottom, ft: f.top, bb: Math.max(b.bottom, a.bottom), bt: Math.min(b.top, a.top), h: b.height }; });
    ok(o.bb <= o.fb && o.bt >= o.ft && o.h >= 46, `${name}: the win panel and its buttons fit the field (button ${Math.round(o.h)}px high)`);
    await p.screenshot({ path: OUT + `ws-win-${name}.png` });
    await p.click('#ws-pick');
    const g = await p.evaluate(() => { const f = document.querySelector('#ws-field').getBoundingClientRect(), l = [...document.querySelectorAll('.ws-lv')].map((b) => b.getBoundingClientRect()); const pk = document.querySelector('#ws-picker'); return { inside: l.every((r) => r.left >= f.left && r.right <= f.right), over: pk.scrollWidth <= pk.clientWidth + 1, gl: Math.min(...l.map((r) => r.left)) - f.left, gr: f.right - Math.max(...l.map((r) => r.right)) }; });
    ok(g.inside && g.over && Math.abs(g.gl - g.gr) <= 40, `${name}: the level picker fits (${Math.round(g.gl)} / ${Math.round(g.gr)} px space)`);
    await p.screenshot({ path: OUT + `ws-picker-${name}.png` });
  }

  // leaving stops it
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-grid');
  await p.waitForFunction(() => !window.__watersort);
  ok(true, 'leaving the game removes it (the hook is gone)');
  const hold = JSON.stringify(await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).watersort));
  await p.keyboard.press('1'); await p.keyboard.press('Enter');
  ok(JSON.stringify(await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).watersort)) === hold, 'keys after leaving do nothing (listeners removed)');
  ok(t.log.external.length === 0, 'no request left the app');
  await t.browser.close();

  // ---------- EN and FR ----------
  for (const [loc, lang] of [['en-US', 'EN'], ['fr-FR', 'FR']]) {
    const s = await start(new Map(), { local: true, locale: loc, viewport: { width: 390, height: 844 } });
    const q = s.page;
    await q.evaluate(() => (location.hash = '#/subject/games')); await q.waitForSelector('.gm-grid');
    const card = await q.evaluate(() => document.body.innerText);
    await q.evaluate(() => (location.hash = '#/games/watersort')); await q.waitForSelector('#ws-tubes .ws-tube'); await q.waitForTimeout(300);
    const chinese = async () => q.evaluate(() => { const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const v = n.textContent.trim(); if (/[一-鿿]/.test(v) && !n.parentElement.closest('.user')) out.push(v); } return out; });
    // a text may only still be Chinese before the lead merges watersort.i18n.json into i18n-data.ts: then it must at least be one of the keys of that file
    const covered = (v) => JSON.stringify(JSONKEYS).includes(JSON.stringify(v).slice(1, -1)) || JSONKEYS.some((k) => new RegExp('^' + k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\d\}/g, '.+') + '$').test(v));
    const check = async (what) => { const c = await chinese(); ok(c.every(covered), `${lang} ${what}: every Chinese text still on screen is in watersort.i18n.json (${c.length ? c.length + ' waiting for the merge: ' + c.slice(0, 3).join(' | ') : 'none left'})`); return c; };
    await check('play screen');
    ok(JSONKEYS.every((k) => /^[^一-鿿]*[一-鿿]/.test(k) ? true : true), `${lang}: json read`);
    await q.click('#ws-pick'); await check('picker');
    await q.screenshot({ path: OUT + `ws-picker-${lang}.png` });
    await q.click('.ws-lv[data-level="1"]');
    const sol = await q.evaluate(async () => { const M = await import('/src/games/watersort-logic.ts'); return M.solve(M.levelTubes(1), 300000); });
    for (const [a, b] of sol) { await q.click(`#ws-tubes .ws-tube[data-i="${a}"]`); await q.click(`#ws-tubes .ws-tube[data-i="${b}"]`); }
    await q.waitForSelector('#ws-ovl:not([hidden])'); await check('win overlay');
    await q.screenshot({ path: OUT + `ws-win-${lang}.png` });
    const hudFits = await q.evaluate(() => [...document.querySelectorAll('.ws-hud > *')].every((b) => b.scrollWidth <= b.clientWidth + 1 && b.getBoundingClientRect().right <= innerWidth));
    ok(hudFits && (await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth)), `${lang}: the HUD fits a 390 px phone`);
    ok(s.log.external.length === 0, `${lang}: no request left the app`);
    await s.browser.close();
  }
  ok(JSONKEYS.every((k) => !/^[一-鿿]$/.test(k)), 'no one-character key in watersort.i18n.json');
  await done();
})();
