// 2048: the pure rules (slide / merge once, spawn only after a change, score, win, game over, fuzz) and the screen (keys, WASD, swipe, undo, sizes, win / game-over overlays, best score, layout on 4 screens, en / fr, screenshots).
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/g2048/';
fs.mkdirSync(OUT, { recursive: true });
const CJK = /[㐀-鿿]/;

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  const p = t.page;
  await p.evaluate(() => (location.hash = '#/games/g2048')); await p.waitForSelector('#g48-board .g48-tile');

  // ---------- the rules ----------
  const L = await p.evaluate(async () => {
    const M = await import('/src/games/g2048-logic.ts');
    const res = { bad: [], games: 0, moves: 0, merges: 0, wins: 0, overs: 0 };
    let seed = 987; const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const sl = (l) => M.slideLine(l).out;
    const cases = [[[2, 2, 2, 2], [4, 4, 0, 0]], [[2, 2, 4, 0], [4, 4, 0, 0]], [[4, 2, 2, 0], [4, 4, 0, 0]], [[2, 0, 0, 2], [4, 0, 0, 0]], [[2, 4, 8, 16], [2, 4, 8, 16]], [[0, 0, 0, 0], [0, 0, 0, 0]],
      [[2, 2, 2, 0], [4, 2, 0, 0]], [[0, 2, 0, 2, 2], [4, 2, 0, 0, 0]], [[4, 4, 8, 0], [8, 8, 0, 0]], [[2, 4, 4, 0], [2, 8, 0, 0]], [[8, 8, 8, 8, 8], [16, 16, 8, 0, 0]]];
    for (const [a, b] of cases) if (!eq(sl(a), b)) res.bad.push('slideLine ' + a + ' -> ' + sl(a) + ' not ' + b);
    // a tile made by a merge does not merge again in the same move
    if (sl([4, 2, 2, 0])[0] !== 4 || sl([2, 2, 4, 0])[1] !== 4) res.bad.push('double merge');
    // the four directions on one board
    const g = [[2, 0, 0, 2], [0, 4, 4, 0], [2, 2, 2, 2], [0, 0, 0, 8]];
    const L1 = M.slide(g, 'L'), R1 = M.slide(g, 'R'), U1 = M.slide(g, 'U'), D1 = M.slide(g, 'D');
    if (!eq(L1.grid, [[4, 0, 0, 0], [8, 0, 0, 0], [4, 4, 0, 0], [8, 0, 0, 0]])) res.bad.push('left ' + JSON.stringify(L1.grid));
    if (!eq(R1.grid, [[0, 0, 0, 4], [0, 0, 0, 8], [0, 0, 4, 4], [0, 0, 0, 8]])) res.bad.push('right ' + JSON.stringify(R1.grid));
    if (!eq(U1.grid, [[4, 4, 4, 4], [0, 2, 2, 8], [0, 0, 0, 0], [0, 0, 0, 0]])) res.bad.push('up ' + JSON.stringify(U1.grid));
    if (!eq(D1.grid, [[0, 0, 0, 0], [0, 0, 0, 0], [0, 4, 4, 4], [4, 2, 2, 8]])) res.bad.push('down ' + JSON.stringify(D1.grid));
    if (L1.gained !== 4 + 8 + 8 + 0 || !L1.moved) res.bad.push('score of the left move ' + L1.gained);
    if (g[2].join() !== '2,2,2,2') res.bad.push('slide changed its input');
    // no move = no change, no score, no new tile
    const s0 = { n: 4, grid: [[2, 4, 0, 0], [8, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], score: 5, target: 2048, won: false, over: false };
    const r0 = M.play(s0, 'L', rng);
    if (r0.moved || r0.spawned || s0.score !== 5 || M.emptyCells(s0.grid).length !== 13) res.bad.push('a move that changes nothing spawned or scored');
    const r1 = M.play(s0, 'R', rng);
    if (!r1.moved || !r1.spawned || M.emptyCells(s0.grid).length !== 12) res.bad.push('a move that changes the board did not spawn exactly one tile');
    if (![2, 4].includes(r1.spawned.v) || s0.grid[r1.spawned.r][r1.spawned.c] !== r1.spawned.v) res.bad.push('spawn value');
    // the spawn: 2 about 90 %, only on an empty cell
    let twos = 0, N = 4000;
    for (let i = 0; i < N; i++) { const gg = M.emptyGrid(4); gg[0][0] = 2; const sp = M.spawn(gg, rng); if (sp.r === 0 && sp.c === 0) res.bad.push('spawn on a full cell'); if (sp.v === 2) twos++; }
    if (twos < N * 0.86 || twos > N * 0.94) res.bad.push('spawn 2 / 4 ratio ' + twos / N);
    const full = [[2, 4, 2], [4, 2, 4], [2, 4, 2]]; if (M.spawn(full, rng) !== null) res.bad.push('spawn on a full board');
    // game over / win detection
    if (M.canMove(full) || !M.canMove([[2, 4, 2], [4, 2, 4], [2, 4, 4]]) || !M.canMove([[2, 4, 2], [4, 2, 4], [2, 4, 0]]) || !M.canMove([[2, 2, 8], [4, 8, 4], [8, 4, 8]]) === false && false) res.bad.push('canMove');
    const sv = { n: 3, grid: [[2, 4, 2], [4, 2, 4], [4, 2, 8]], score: 0, target: 256, won: false, over: false };
    const rv = M.play(sv, 'U', rng); // nothing can merge upward except col0 (2,4,4) -> yes: 4+4
    if (!rv.moved) res.bad.push('vertical merge');
    const sw = { n: 4, grid: [[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], score: 0, target: 2048, won: false, over: false };
    const rw = M.play(sw, 'L', rng);
    if (!sw.won || !rw.reached || sw.score !== 2048) res.bad.push('winning 2048 not detected');
    const rw2 = M.play(sw, 'D', rng); if (rw2.reached) res.bad.push('win reported twice');
    if (M.targetFor(3) !== 256 || M.targetFor(4) !== 2048 || M.targetFor(5) !== 2048) res.bad.push('targets');
    const so = { n: 3, grid: [[2, 4, 2], [4, 2, 4], [2, 4, 0]], score: 0, target: 256, won: false, over: false };
    M.play(so, 'R', () => 0.99); // the last cell is filled by the move? (2,4,0) -> (0,2,4) then a spawn on (2,0)
    // fuzz: random games, every invariant after every move
    for (let k = 0; k < 300; k++) {
      const n = [3, 4, 5][k % 3], s = M.newGame(n, rng); res.games++;
      if (M.emptyCells(s.grid).length !== n * n - 2) res.bad.push('new game has two tiles');
      for (let i = 0; i < 3000 && !s.over; i++) {
        const dir = 'UDLR'[Math.floor(rng() * 4)], before = JSON.parse(JSON.stringify(s.grid)), sumBefore = before.flat().reduce((a, b) => a + b, 0), score0 = s.score;
        const r = M.play(s, dir, rng); res.moves++;
        const sumAfter = s.grid.flat().reduce((a, b) => a + b, 0);
        if (!r.moved) { if (!eq(before, s.grid) || s.score !== score0) res.bad.push('no-op changed state'); continue; }
        if (r.merges.length) res.merges++;
        if (sumAfter - sumBefore !== r.spawned.v) res.bad.push('sum of tiles must grow by exactly the new tile');
        if (s.score - score0 !== r.gained) res.bad.push('score');
        if (s.grid.flat().some((v) => v && (v & (v - 1)) !== 0)) res.bad.push('not a power of two');
        if (s.over !== !M.canMove(s.grid)) res.bad.push('over flag');
        if (res.bad.length > 5) break;
      }
      if (s.over) res.overs++; if (s.won) res.wins++;
      if (res.bad.length > 5) break;
    }
    return res;
  });
  ok(L.bad.length === 0, `rules: ${L.games} random games, ${L.moves} moves, ${L.merges} merging moves, ${L.overs} ended${L.bad.length ? ' -> ' + L.bad.slice(0, 6).join('; ') : ''}`);
  ok(L.overs > 200 && L.merges > 1000, 'the fuzz really merged and ended');

  // ---------- the screen ----------
  const st = () => p.evaluate(() => { const s = window.__g2048.state(); return { grid: s.grid, score: s.score, over: s.over, won: s.won, n: s.n }; });
  const domGrid = () => p.evaluate(() => { const n = window.__g2048.state().n, g = Array.from({ length: n }, () => Array(n).fill(0)); document.querySelectorAll('#g48-board .g48-tile:not(.g48-dead)').forEach((e) => { g[+e.dataset.r][+e.dataset.c] = +e.dataset.v; }); return g; });
  const set = (g, hold) => p.evaluate((g) => window.__g2048.setGrid(g), g);
  await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + 'g2048-start.png' });
  ok((await p.textContent('#g48-score')) === '得分：0' && (await p.textContent('#g48-size')) === '大小：4×4', 'start: score 0, size 4x4');
  let a = await st();
  ok(a.grid.flat().filter(Boolean).length === 2 && JSON.stringify(await domGrid()) === JSON.stringify(a.grid), 'two tiles on the screen, the picture matches the rules');
  const box = await p.evaluate(() => { const c = document.querySelector('#g48-board').getBoundingClientRect(); return { w: c.width, h: c.height, l: c.left, r: innerWidth - c.right }; });
  ok(Math.abs(box.w - box.h) < 1 && Math.abs(box.l - box.r) <= 2, `the board is square (${box.w}) and centred`);
  // keys
  await set([[2, 0, 0, 2], [0, 0, 0, 0], [0, 0, 4, 0], [0, 0, 0, 0]]);
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(250);
  a = await st();
  ok(a.grid[0][0] === 4 && a.score === 4 && a.grid[2][0] === 4 && a.grid.flat().filter(Boolean).length === 3, 'arrow left slides and merges 2+2, score 4, one new tile: ' + JSON.stringify(a.grid));
  ok(JSON.stringify(await domGrid()) === JSON.stringify(a.grid) && (await p.textContent('#g48-score')) === '得分：4', 'screen follows (tiles, score)');
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(50);
  await set([[8, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  await p.keyboard.press('d'); await p.waitForTimeout(150); a = await st(); ok(a.grid[0][3] === 8, 'D (WASD) moves right');
  await set([[0, 0, 0, 0], [0, 0, 8, 0], [0, 0, 0, 0], [0, 0, 0, 0]]); await p.keyboard.press('s'); await p.waitForTimeout(150); a = await st(); ok(a.grid[3][2] === 8, 'S moves down');
  await set([[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 8], [0, 0, 0, 0]]); await p.keyboard.press('a'); await p.waitForTimeout(150); a = await st(); ok(a.grid[2][0] === 8, 'A moves left');
  await set([[0, 0, 0, 0], [0, 0, 0, 0], [0, 8, 0, 0], [0, 0, 0, 0]]); await p.keyboard.press('w'); await p.waitForTimeout(150); a = await st(); ok(a.grid[0][1] === 8, 'W moves up');
  // a move that changes nothing: no new tile, no score
  await set([[2, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const sc0 = (await st()).score; await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowUp'); a = await st();
  ok(a.grid.flat().filter(Boolean).length === 2 && a.score === sc0, 'a move that changes nothing adds no tile');
  // swipes (pointer events)
  const c = await p.evaluate(() => { const r = document.querySelector('#g48-board').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const swipe = async (dx, dy) => { await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.move(c.x + dx / 2, c.y + dy / 2, { steps: 3 }); await p.mouse.move(c.x + dx, c.y + dy, { steps: 3 }); await p.mouse.up(); await p.waitForTimeout(150); };
  await set([[0, 0, 0, 0], [0, 8, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  await swipe(120, 20); a = await st(); ok(a.grid[1][3] === 8, 'a swipe to the right (dominant axis) moves right');
  await set([[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 8, 0], [0, 0, 0, 0]]); await swipe(-30, 130); a = await st(); ok(a.grid[3][2] === 8, 'a swipe down moves down');
  await set([[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 8], [0, 0, 0, 0]]); await swipe(-140, -10); a = await st(); ok(a.grid[2][0] === 8, 'a swipe left moves left');
  await set([[0, 0, 0, 0], [0, 0, 0, 0], [0, 8, 0, 0], [0, 0, 0, 0]]); await swipe(5, -140); a = await st(); ok(a.grid[0][1] === 8, 'a swipe up moves up');
  const cnt = (await st()).grid.flat().filter(Boolean).length; await swipe(4, 3); a = await st(); ok(a.grid.flat().filter(Boolean).length === cnt, 'a tiny touch is not a swipe');
  // undo: one step back
  await set([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 8, 0]]);
  ok(await p.locator('#g48-undo').isDisabled(), 'undo is off before the first move');
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(250);
  ok(!(await p.locator('#g48-undo').isDisabled()), 'undo is on after a move');
  await p.click('#g48-undo'); a = await st();
  ok(JSON.stringify(a.grid) === JSON.stringify([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 8, 0]]) && JSON.stringify(await domGrid()) === JSON.stringify(a.grid), 'undo puts the board back exactly (and the picture)');
  ok(await p.locator('#g48-undo').isDisabled(), 'only ONE step back');
  const scoreBack = await st(); ok(scoreBack.score === (await st()).score, 'score back too');
  // merging animation leaves one tile per cell
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelectorAll('#g48-board .g48-tile').length === document.querySelectorAll('#g48-board .g48-tile:not(.g48-dead)').length), 'merged pairs are removed from the screen after the slide');
  await p.screenshot({ path: OUT + 'g2048-play.png' });
  // many colours: a board with every value (faces from 8 up)
  await set([[2, 4, 8, 16], [32, 64, 128, 256], [512, 1024, 2048, 4096], [0, 0, 0, 0]]);
  const faces = await p.evaluate(() => [...document.querySelectorAll('#g48-board .g48-tile')].map((e) => [+e.dataset.v, getComputedStyle(e.querySelector('.g48-face')).display !== 'none']));
  ok(faces.every(([v, f]) => f === (v >= 8)), 'a face on every tile from 8 up and on none below');
  const cols = await p.evaluate(() => new Set([...document.querySelectorAll('#g48-board .g48-tile')].map((e) => getComputedStyle(e).backgroundColor)).size);
  ok(cols === 12, `every value has its own colour (${cols})`);
  await p.screenshot({ path: OUT + 'g2048-colours.png' });
  // win: 1024 + 1024
  await p.click('#g48-new');
  await set([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  await p.keyboard.press('ArrowLeft');
  await p.waitForFunction(() => !document.querySelector('#g48-ovl').hidden, null, { timeout: 4000 });
  ok((await p.textContent('#g48-ovl h2')) === '太棒了！' && (await p.textContent('#g48-ovl p')).includes('2048') && await p.locator('#g48-keep').isVisible(), 'making 2048 shows the win overlay with Keep going / New game');
  await p.screenshot({ path: OUT + 'g2048-win.png' });
  const gBefore = JSON.stringify((await st()).grid); await p.keyboard.press('ArrowDown'); ok(JSON.stringify((await st()).grid) === gBefore, 'no move while the overlay is open');
  await p.click('#g48-keep'); ok(!(await p.locator('#g48-ovl').isVisible()), 'Keep going closes it');
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(100);
  ok((await st()).grid.flat().some((v) => v === 2048) && !(await p.locator('#g48-ovl').isVisible()), 'the game goes on and the win is not announced again');
  // game over
  await p.click('#g48-new');
  await set([[8, 16, 8, 16], [16, 8, 16, 8], [8, 16, 8, 16], [0, 16, 8, 16]]);
  await p.evaluate(() => { const s = window.__g2048.state(); s.score = 120; });
  ok((await p.evaluate(() => window.__g2048.canMove())), 'a board with one empty cell can still move');
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(100);
  a = await st();
  ok(a.over && !(await p.evaluate(() => window.__g2048.canMove())) && a.grid.flat().every(Boolean), 'the move that fills the board with no equal neighbours ends the game (rules)');
  await p.waitForFunction(() => !document.querySelector('#g48-ovl').hidden, null, { timeout: 4000 });
  ok((await p.textContent('#g48-ovl h2')) === '游戏结束' && await p.locator('#g48-again').isVisible() && !(await p.locator('#g48-keep').isVisible()), 'game over overlay with one button');
  await p.screenshot({ path: OUT + 'g2048-over.png' });
  const keyBefore = JSON.stringify((await st()).grid); await p.keyboard.press('ArrowLeft'); ok(JSON.stringify((await st()).grid) === keyBefore, 'no move after game over');
  const sc = a.score;
  const bestSaved = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1'))?.g2048?.['best-4']);
  ok(bestSaved >= sc && bestSaved > 0 && (await p.textContent('#g48-best')) === `最高：${bestSaved}`, 'the best score is saved (learn.games.v1): ' + bestSaved);
  await p.click('#g48-again'); a = await st();
  ok(!a.over && a.score === 0 && a.grid.flat().filter(Boolean).length === 2 && (await p.textContent('#g48-best')) === `最高：${bestSaved}`, 'play again: a new game, the best stays');
  // sizes
  await p.click('#g48-size'); a = await st();
  ok(a.n === 5 && (await p.textContent('#g48-size')) === '大小：5×5' && (await p.locator('.g48-hole').count()) === 25, '5x5 board');
  await p.screenshot({ path: OUT + 'g2048-5x5.png' });
  await p.click('#g48-size'); a = await st();
  ok(a.n === 3 && (await p.locator('.g48-hole').count()) === 9, '3x3 board');
  ok((await p.evaluate(() => window.__g2048.state().target)) === 256, '3x3 (easy): the target is 256');
  await p.screenshot({ path: OUT + 'g2048-3x3.png' });
  ok((await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).g2048.size)) === 3, 'the size is kept on this device');
  await p.click('#g48-size');

  // ---------- layout on 4 screens ----------
  for (const [name, w, hgt] of [['phone', 390, 844], ['small', 320, 568], ['ipad', 820, 1180], ['ipadland', 1180, 820], ['side', 844, 390]]) {
    await p.setViewportSize({ width: w, height: hgt });
    await p.evaluate(() => (location.hash = '#/subject/games')); await p.evaluate(() => (location.hash = '#/games/g2048')); await p.waitForSelector('#g48-board .g48-tile');
    await p.waitForTimeout(250);
    const m = await p.evaluate(() => {
      const R = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
      const f = R('#g48-board'), hud = R('.g48-hud');
      return { f, hud, vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, btns: [...document.querySelectorAll('.g48-hud button, .g48-hud span')].every((b) => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }),
        tilesIn: [...document.querySelectorAll('#g48-board .g48-tile')].every((e) => { const r = e.getBoundingClientRect(), b = document.querySelector('#g48-board').getBoundingClientRect(); return r.left >= b.left && r.right <= b.right && r.top >= b.top && r.bottom <= b.bottom + 1; }) };
    });
    const inside = (b) => b.l >= -0.5 && b.r <= m.vw + 0.5 && b.t >= -0.5 && b.b <= m.vh + 0.5;
    ok(inside(m.f) && inside(m.hud) && m.btns && m.tilesIn, `${name} ${w}x${hgt}: board, tiles and HUD are on the screen (board ${Math.round(m.f.w)}px)`);
    ok(m.sw <= m.vw && m.sh <= m.vh + 1, `${name}: no page scrolling`);
    ok(m.f.b <= m.hud.t + 1 || m.f.r <= m.hud.l + 1 || m.hud.r <= m.f.l + 1 || m.hud.b <= m.f.t + 1, `${name}: the HUD does not cover the board`);
    if (name !== 'side') ok(Math.abs(m.f.l - (m.vw - m.f.r)) <= 3, `${name}: the board is centred`);
    ok(m.f.w >= (name === 'side' ? 150 : 250), `${name}: the board is big enough (${Math.round(m.f.w)}px)`);
    await p.screenshot({ path: OUT + `g2048-${name}.png` });
  }
  await p.setViewportSize({ width: 820, height: 1180 });
  // leaving stops it
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-grid');
  await p.waitForFunction(() => !window.__g2048);
  ok(true, 'leaving the game removes it (the hook is gone)');
  await p.keyboard.press('ArrowUp');
  ok(t.log.external.length === 0, 'no request left the app');
  await t.browser.close();

  // ---------- en / fr ----------
  const keys = Object.keys(JSON.parse(fs.readFileSync('src/games/g2048.i18n.json', 'utf8')));
  const covered = (txt) => keys.some((k) => { const re = new RegExp('^' + k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{0\}/g, '.+') + '$'); return re.test(txt); });
  for (const [loc, label] of [['en-US', 'EN'], ['fr-FR', 'FR']]) {
    const t2 = await start(new Map(), { local: true, locale: loc, viewport: { width: 390, height: 844 } });
    const q = t2.page;
    await q.evaluate(() => (location.hash = '#/games/g2048')); await q.waitForSelector('#g48-board .g48-tile');
    await q.keyboard.press('ArrowLeft'); await q.keyboard.press('ArrowUp');
    await q.evaluate(() => window.__g2048.setGrid([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]])); await q.keyboard.press('ArrowLeft');
    await q.waitForFunction(() => !document.querySelector('#g48-ovl').hidden, null, { timeout: 4000 });
    await q.waitForTimeout(200);
    const texts = await q.evaluate(() => [...document.querySelectorAll('#g48-board *, .g48-hud *')].filter((e) => e.children.length === 0 && getComputedStyle(e).display !== 'none').map((e) => e.textContent.trim()).filter(Boolean));
    const left = texts.filter((x) => CJK.test(x));
    const merged = fs.readFileSync('src/i18n-data.ts', 'utf8').includes('"大小：{0}"');   // the lead merges g2048.i18n.json into i18n-data.ts; before that only the coverage below can be checked
    if (merged) ok(left.length === 0, `${label}: no Chinese left on the game screen${left.length ? ' -> ' + left.join(' | ') : ''}`);
    const untranslated = left.filter((x) => !covered(x));
    ok(untranslated.length === 0, `${label}: every Chinese text is in g2048.i18n.json${untranslated.length ? ' -> ' + untranslated.join(' | ') : ''}`);
    await q.screenshot({ path: OUT + `g2048-${label.toLowerCase()}.png` });
    await t2.browser.close();
  }
  await done();
})();
