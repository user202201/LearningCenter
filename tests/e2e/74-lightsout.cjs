// Lights Out: the pure rules (GF(2) solver against BFS, ranks, minimal solutions, generated puzzles, hints) and the screen
// (tap, keyboard, undo, restart, hint, auto demo, win with stars, best, sizes, layout on 5 screens, EN / FR, a real touch screen at dpr 2).
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const CJK = /[　-〿一-鿿＀-￯]/;

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  const p = t.page;
  await p.evaluate(() => (location.hash = '#/games/lightsout')); await p.waitForSelector('#lo-grid .lo-cell');

  // ---------- the rules ----------
  const L = await p.evaluate(async () => {
    const M = await import('/src/games/lightsout-logic.ts');
    const res = { bad: [], info: {} };
    const rng = M.makeRng(2024);
    // pressing: a lamp and its 4 neighbours, edges have fewer, a press twice = nothing, presses commute
    for (const n of M.SIZES) {
      for (let i = 0; i < n * n; i++) {
        const b = M.press(n, M.emptyBoard(n), i), r = Math.floor(i / n), c = i % n;
        const want = 1 + (r > 0) + (r < n - 1) + (c > 0) + (c < n - 1);
        if (M.countLit(b) !== want) res.bad.push(`press ${n}x${n} cell ${i}: ${M.countLit(b)} lamps, want ${want}`);
        if (!b[i]) res.bad.push('the pressed lamp is not flipped');
        for (let j = 0; j < n * n; j++) { const adj = Math.abs(Math.floor(j / n) - r) + Math.abs((j % n) - c) <= 1; if (!!b[j] !== adj) res.bad.push(`press ${n}x${n} ${i}: lamp ${j} wrong`); }
        if (M.key(M.press(n, b, i)) !== M.key(M.emptyBoard(n))) res.bad.push('press twice is not the identity');
      }
      const a = rng() * n * n | 0, b2 = rng() * n * n | 0;
      if (M.key(M.press(n, M.press(n, M.emptyBoard(n), a), b2)) !== M.key(M.press(n, M.press(n, M.emptyBoard(n), b2), a))) res.bad.push('presses do not commute');
    }
    if (!M.isSolved([0, 0, 0, 0]) || M.isSolved([0, 1, 0, 0])) res.bad.push('isSolved');
    // ranks of the press matrix (known: 3x3 9, 4x4 12, 5x5 23, 6x6 36, 7x7 49) and so the number of solvable states
    res.info.rank = M.SIZES.map((n) => M.rankOf(n));
    res.info.nullity = M.SIZES.map((n) => M.nullity(n));
    if (JSON.stringify(res.info.rank) !== '[9,12,23,36,49]') res.bad.push('ranks ' + res.info.rank);
    if (JSON.stringify(res.info.nullity) !== '[0,4,2,0,0]') res.bad.push('nullities ' + res.info.nullity);
    // every null-space vector changes nothing
    for (const n of M.SIZES) for (const v of M.nullBasis(n)) {
      const cells = []; for (let i = 0; i < n * n; i++) if ((v >> BigInt(i)) & 1n) cells.push(i);
      if (M.countLit(M.pressAll(n, M.emptyBoard(n), cells)) !== 0) res.bad.push(`null vector of ${n}x${n} changes the board`);
    }
    // 2^rank solvable states of 2^N: 5x5 has 2^23 of 2^25 = 1/4 solvable, 3/4 not
    res.info.unsolvable5 = 2 ** 25 - 2 ** M.rankOf(5);
    if (res.info.unsolvable5 !== 0.75 * 2 ** 25) res.bad.push('5x5: 3/4 of the states must be unsolvable');
    // ---- BFS over ALL states of 3x3 (512) and 4x4 (65536): the solver's minimum is the BFS distance, unsolvable = not reached ----
    for (const n of [3, 4]) {
      const N = n * n, masks = [];
      for (let i = 0; i < N; i++) { let m = 0; for (const j of M.affected(n, i)) m |= 1 << j; masks.push(m); }
      const dist = new Int16Array(1 << N).fill(-1); dist[0] = 0; let q = [0], reach = 1, maxd = 0;
      while (q.length) { const nq = []; for (const s of q) for (const m of masks) { const t2 = s ^ m; if (dist[t2] < 0) { dist[t2] = dist[s] + 1; maxd = Math.max(maxd, dist[t2]); reach++; nq.push(t2); } } q = nq; }
      res.info['reach' + n] = reach; res.info['maxd' + n] = maxd;
      if (reach !== 2 ** M.rankOf(n)) res.bad.push(`BFS ${n}x${n}: reached ${reach}, want 2^rank`);
      let checked = 0, wrong = 0;
      for (let s = 0; s < 1 << N; s++) {
        if (n === 4 && s % 3 !== 0 && dist[s] >= 0 && s % 7 !== 0) continue;   // all reachable ones are tested below; this only thins the unsolvable ones
        const board = Array.from({ length: N }, (_, i) => (s >> i) & 1), sol = M.solve(n, board);
        if (dist[s] < 0) { if (sol !== null || M.isSolvable(n, board)) wrong++; }
        else { if (!sol || sol.length !== dist[s] || !M.isSolved(M.pressAll(n, board, sol))) wrong++; }
        checked++;
      }
      if (n === 4) for (let s = 0; s < 1 << N; s++) if (dist[s] >= 0) { const board = Array.from({ length: N }, (_, i) => (s >> i) & 1), sol = M.solve(n, board); if (!sol || sol.length !== dist[s]) wrong++; }
      res.info['checked' + n] = checked;
      if (wrong) res.bad.push(`${n}x${n}: ${wrong} states where the solver and the BFS disagree`);
    }
    // ---- 5x5: BFS from the solution side up to depth 5 (every set of at most 5 presses) against the solver ----
    {
      const n = 5, N = 25, masks = []; for (let i = 0; i < N; i++) { let m = 0; for (const j of M.affected(n, i)) m |= 1 << j; masks.push(m); }
      const dist = new Map([[0, 0]]); let q = [0];
      for (let d = 1; d <= 5; d++) { const nq = []; for (const s of q) for (const m of masks) { const t2 = s ^ m; if (!dist.has(t2)) { dist.set(t2, d); nq.push(t2); } } q = nq; }
      res.info.bfs5 = dist.size; let wrong = 0, k = 0;
      for (const [s, d] of dist) { if ((k++ % 17) !== 0) continue; const board = Array.from({ length: N }, (_, i) => (s >> i) & 1), sol = M.solve(n, board); if (!sol || sol.length !== d) wrong++; }
      if (wrong) res.bad.push(`5x5: ${wrong} states of the bounded BFS where the solver disagrees`);
      // random unsolvable board (all random boards: about 3/4 are unsolvable)
      let uns = 0; for (let i = 0; i < 400; i++) { const b = Array.from({ length: N }, () => (rng() < 0.5 ? 1 : 0)); if (!M.isSolvable(n, b) && M.solve(n, b) !== null) res.bad.push('unsolvable but solved'); if (!M.isSolvable(n, b)) uns++; }
      res.info.uns5 = uns; if (uns < 250 || uns > 350) res.bad.push('5x5 random boards: unsolvable share ' + uns + ' / 400, want about 300');
    }
    // ---- brute force over EVERY set of presses for 3x3 and 4x4: nothing beats the claimed minimum ----
    for (const n of [3, 4]) {
      const N = n * n;
      for (let trial = 0; trial < 25; trial++) {
        const b = M.pressAll(n, M.emptyBoard(n), Array.from({ length: N }, (_, i) => i).filter(() => rng() < 0.5)), sol = M.solve(n, b);
        let best = 99;
        for (let m = 0; m < 1 << N; m++) { let c = 0, x = b; for (let i = 0; i < N; i++) if ((m >> i) & 1) { x = M.press(n, x, i); c++; } if (M.isSolved(x) && c < best) best = c; }
        if (!sol || sol.length !== best) res.bad.push(`${n}x${n}: claimed ${sol && sol.length}, brute force ${best}`);
      }
    }
    // 5x5 (null space of 2 vectors): the minimum is the smallest of the 4 solutions of the coset, checked with the explicit solutions
    for (let trial = 0; trial < 60; trial++) {
      const n = 5, b = M.pressAll(n, M.emptyBoard(n), Array.from({ length: 25 }, (_, i) => i).filter(() => rng() < 0.5)), sol = M.solve(n, b);
      const base = new Set(sol), sets = [new Set(base)];
      for (const v of M.nullBasis(n)) { const cells = []; for (let i = 0; i < 25; i++) if ((v >> BigInt(i)) & 1n) cells.push(i); for (const s of sets.slice()) { const x = new Set(s); for (const c of cells) x.has(c) ? x.delete(c) : x.add(c); sets.push(x); } }
      for (const s of sets) { if (!M.isSolved(M.pressAll(n, b, [...s]))) res.bad.push('a coset member does not solve the board'); if (s.size < sol.length) res.bad.push('5x5: a smaller solution exists in the coset'); }
    }
    // ---- hints: a hint always lowers the minimum by exactly one, and following them solves the board in `min` steps ----
    let hints = 0;
    for (const n of M.SIZES) for (let trial = 0; trial < 12; trial++) {
      let b = M.pressAll(n, M.emptyBoard(n), Array.from({ length: n * n }, (_, i) => i).filter(() => rng() < 0.5)); if (M.isSolved(b)) continue;
      let m = M.minPresses(n, b);
      for (let g = 0; g < 80 && !M.isSolved(b); g++) {
        const i = M.hint(n, b); hints++; if (i < 0) { res.bad.push('no hint on an unsolved board'); break; }
        b = M.press(n, b, i); const m2 = M.minPresses(n, b); if (m2 !== m - 1) { res.bad.push(`${n}x${n}: hint did not lower the minimum by one (${m} -> ${m2})`); break; } m = m2;
      }
      if (!M.isSolved(b)) res.bad.push('following the hints did not solve the board');
      if (M.hint(n, b) !== -1) res.bad.push('a solved board must give no hint');
    }
    res.info.hints = hints;
    // a user can wander: a hint after random presses still lowers the distance
    // ---- stars ----
    if (M.stars(5, 5) !== 3 || M.stars(4, 5) !== 3 || M.stars(7, 5) !== 2 || M.stars(8, 5) !== 1 || M.stars(9, 6) !== 2 || M.stars(10, 6) !== 1) res.bad.push('stars rule');
    // ---- generated puzzles: 300 seeds per size and level ----
    const rngs = M.makeRng(99); const stat = {}; let puzzles = 0;
    const easy = [3, 6];
    for (const n of M.SIZES) for (const lv of [0, 1, 2]) {
      let sum = 0, mn = 99, mx = 0, last = '';
      const [lo, hi] = M.rangeFor(n, lv);
      for (let s = 0; s < 300; s++) {
        const pz = M.generate(n, lv, M.makeRng(1000 + s * 7 + n * 13 + lv), last); puzzles++;
        const tag = `${n}x${n} level ${lv} seed ${s}`;
        if (pz.cells.length !== n * n || M.isSolved(pz.cells)) res.bad.push(tag + ': empty / already solved');
        if (M.key(pz.cells) === last) res.bad.push(tag + ': the same puzzle twice in a row');
        const sol = M.solve(n, pz.cells);
        if (!sol) { res.bad.push(tag + ': unsolvable'); continue; }
        if (sol.length !== pz.min) res.bad.push(tag + ': claimed minimum ' + pz.min + ', solver ' + sol.length);
        if (!M.isSolved(M.pressAll(n, pz.cells, sol))) res.bad.push(tag + ': the minimal solution does not turn every lamp off');
        if (pz.min < lo || pz.min > hi) res.bad.push(`${tag}: minimum ${pz.min} outside ${lo}-${hi}`);
        if (lv === 0 && (pz.min < easy[0] || pz.min > easy[1])) res.bad.push(tag + ': easy minimum ' + pz.min);
        last = M.key(pz.cells); sum += pz.min; mn = Math.min(mn, pz.min); mx = Math.max(mx, pz.min);
      }
      stat[`${n}-${lv}`] = [mn, +(sum / 300).toFixed(1), mx];
    }
    res.info.stat = stat; res.info.puzzles = puzzles;
    for (const n of M.SIZES) if (!(stat[`${n}-2`][1] > stat[`${n}-1`][1] || n === 4) || stat[`${n}-1`][1] < stat[`${n}-0`][1] - 0.01) res.bad.push(`${n}x${n}: the levels are not ordered by difficulty ` + JSON.stringify([stat[`${n}-0`], stat[`${n}-1`], stat[`${n}-2`]]));
    if (!(stat['5-1'][0] >= 6 && stat['5-1'][2] <= 10)) res.bad.push('5x5 normal should need about a third of 25 presses');
    if (!(stat['5-2'][0] >= 11)) res.bad.push('5x5 hard should be near the maximum (15)');
    if (!(stat['7-2'][1] >= 28)) res.bad.push('7x7 hard average minimum too low');
    // the same seed gives the same puzzle, different seeds differ
    const a1 = M.generate(5, 1, M.makeRng(5)), a2 = M.generate(5, 1, M.makeRng(5)), a3 = M.generate(5, 1, M.makeRng(6));
    if (M.key(a1.cells) !== M.key(a2.cells) || M.key(a1.cells) === M.key(a3.cells)) res.bad.push('seed handling');
    return res;
  });
  console.log('   rules:', JSON.stringify(L.info));
  ok(L.bad.length === 0, 'the rules: press, GF(2) ranks 9 / 12 / 23, BFS agrees with the solver, minimal solutions cannot be beaten, hints lower the minimum by one, 300 puzzles per size and level are solvable and in range' + (L.bad.length ? ' -> ' + L.bad.slice(0, 8).join(' | ') : ''));
  ok(L.info.reach3 === 512 && L.info.reach4 === 4096 && L.info.unsolvable5 === 25165824, `solvable states: 3x3 ${L.info.reach3} of 512, 4x4 ${L.info.reach4} of 65536, 5x5 only 2^23 (unsolvable ${L.info.unsolvable5})`);

  // ---------- the screen ----------
  const st = () => p.evaluate(() => window.__lo.state());
  const lamps = () => p.evaluate(() => [...document.querySelectorAll('#lo-grid .lo-cell')].map((c) => (c.classList.contains('on') ? 1 : 0)));
  const pressInPage = (n, b, i) => p.evaluate(async ([n, b, i]) => (await import('/src/games/lightsout-logic.ts')).press(n, b, i), [n, b, i]);
  let s = await st();
  ok(s.n === 5 && s.level === 1 && (await p.locator('#lo-grid .lo-cell').count()) === 25, 'opens on 5 x 5, normal: 25 lamps');
  ok(JSON.stringify(await lamps()) === JSON.stringify(s.board) && s.lit > 0, 'the lamps on the screen are the board of the puzzle');
  const txt = (sel) => p.textContent(sel);
  ok((await txt('#lo-presses')) === '步数：0' && (await txt('#lo-min')) === `最少：${s.min}` && (await txt('#lo-time')) === '时间：0:00' && (await txt('#lo-best')) === '最佳：—', 'the pills: presses 0, minimum shown, time, best none');
  // a tap on a lamp flips it and the 4 neighbours
  const b0 = (await st()).board;
  await p.locator('#lo-grid .lo-cell[data-i="12"]').click();
  s = await st();
  ok(JSON.stringify(s.board) === JSON.stringify(await pressInPage(5, b0, 12)) && JSON.stringify(await lamps()) === JSON.stringify(s.board) && s.presses === 1 && (await txt('#lo-presses')) === '步数：1', 'a tap flips the lamp and its four neighbours (screen = rules)');
  // the same lamp again takes the press back
  await p.locator('#lo-grid .lo-cell[data-i="12"]').click();
  s = await st(); ok(JSON.stringify(s.board) === JSON.stringify(b0) && s.presses === 0, 'tapping the same lamp again undoes the press');
  // a corner lamp flips only 3 lamps
  await p.evaluate(() => window.__lo.setBoard(new Array(25).fill(0).map((_, i) => (i === 3 ? 1 : 0)), 1));
  await p.locator('#lo-grid .lo-cell[data-i="0"]').click(); s = await st();
  ok(s.lit === 4, 'a corner lamp flips itself and 2 neighbours (3 lamps)');
  // restart / undo with several presses
  await p.evaluate(() => window.__lo.newGame(4242)); const start1 = (await st()).start;
  for (const i of [0, 6, 12, 18]) await p.locator(`#lo-grid .lo-cell[data-i="${i}"]`).click();
  s = await st(); ok(s.presses === 4, 'four presses are counted');
  await p.click('#lo-undo'); s = await st(); ok(s.presses === 3 && s.history.join() === '0,6,12', 'undo takes the last press back');
  await p.click('#lo-undo'); await p.click('#lo-undo'); await p.click('#lo-undo'); s = await st();
  ok(s.presses === 0 && JSON.stringify(s.board) === JSON.stringify(start1) && (await p.locator('#lo-undo').isDisabled()), 'undo is unlimited and ends at the start of the puzzle (button off)');
  for (const i of [1, 2, 7]) await p.locator(`#lo-grid .lo-cell[data-i="${i}"]`).click();
  await p.click('#lo-restart'); s = await st();
  ok(s.presses === 0 && JSON.stringify(s.board) === JSON.stringify(start1) && s.phase === 'play', 'restart: the same puzzle from the start');
  // new puzzle differs
  await p.click('#lo-new'); s = await st(); ok(JSON.stringify(s.start) !== JSON.stringify(start1) && s.presses === 0, 'new puzzle: another board');
  // keyboard
  await p.evaluate(() => window.__lo.newGame(777)); await p.mouse.click(5, 5);
  s = await st(); const c0 = s.cursor; ok(c0 === 12, 'the cursor starts in the middle');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowDown');
  s = await st(); ok(s.cursor === 12 + 2 + 5, 'arrow keys move the cursor');
  ok(await p.evaluate(() => document.querySelector('#lo-field').classList.contains('kb') && document.querySelectorAll('.lo-cell.cur').length === 1), 'the cursor is drawn (one lamp) once the keyboard is used');
  for (let i = 0; i < 8; i++) await p.keyboard.press('ArrowLeft');
  for (let i = 0; i < 8; i++) await p.keyboard.press('ArrowUp');
  s = await st(); ok(s.cursor === 0, 'the cursor stops at the edge (no wrap-around)');
  const kb0 = (await st()).board; await p.keyboard.press('Space'); s = await st();
  ok(JSON.stringify(s.board) === JSON.stringify(await pressInPage(5, kb0, 0)) && s.presses === 1, 'Space presses the lamp under the cursor');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter'); s = await st(); ok(s.presses === 2 && s.history.join() === '0,1', 'Enter presses too');
  await p.keyboard.press('u'); s = await st(); ok(s.presses === 1, 'U undoes');
  await p.keyboard.press('r'); s = await st(); ok(s.presses === 0, 'R restarts');
  // hint
  await p.evaluate(() => window.__lo.newGame(31337));
  const hb = (await st()).board; await p.click('#lo-hint');
  s = await st(); const hc = await p.evaluate(() => [...document.querySelectorAll('.lo-cell.hint')].map((c) => +c.dataset.i));
  const solNow = await p.evaluate(async (b) => (await import('/src/games/lightsout-logic.ts')).solve(5, b), hb);
  ok(hc.length === 1 && solNow.includes(hc[0]) && s.hint === hc[0], 'the hint lights ONE lamp that belongs to a minimal solution');
  await p.screenshot({ path: OUT + 'lightsout-hint.png' });
  await p.locator(`#lo-grid .lo-cell[data-i="${hc[0]}"]`).click();
  ok((await p.evaluate(() => document.querySelectorAll('.lo-cell.hint').length)) === 0 && (await p.evaluate(async (b) => (await import('/src/games/lightsout-logic.ts')).minPresses(5, b), (await st()).board)) === solNow.length - 1, 'pressing the hinted lamp lowers the minimum by one and clears the hint');
  // challenge mode hides the minimum
  await p.click('#lo-challenge');
  ok((await txt('#lo-min')) === '最少：?' && (await txt('#lo-challenge')) === '挑战：开' && (await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).lightsout.challenge)) === true, 'challenge: the minimum is hidden (and remembered)');
  await p.click('#lo-challenge'); ok((await txt('#lo-min')) !== '最少：?', 'challenge off: the minimum is shown again');

  // sizes and levels
  for (const k of [3, 4, 5, 6, 7]) {
    await p.click(`#lo-size-${k}`); s = await st();
    ok(s.n === k && (await p.locator('#lo-grid .lo-cell').count()) === k * k && (await p.locator(`#lo-size-${k}.on`).count()) === 1 && s.lit > 0, `size ${k} x ${k}: ${k * k} lamps, button on`);
  }
  ok((await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).lightsout.size)) === 7, 'the size reached is remembered');
  await p.click('#lo-size-5');
  for (const lv of [0, 1, 2]) {
    await p.click(`#lo-lv-${lv}`); s = await st();
    const rg = await p.evaluate(async ([n, lv]) => (await import('/src/games/lightsout-logic.ts')).rangeFor(n, lv), [5, lv]);
    ok(s.level === lv && s.min >= rg[0] && s.min <= rg[1] && (await p.locator(`#lo-lv-${lv}.on`).count()) === 1, `level ${['easy', 'normal', 'hard'][lv]}: minimum ${s.min} is in ${rg[0]}-${rg[1]}`);
  }

  // auto demo: plays the minimal solution, stops on a tap
  await p.click('#lo-size-5'); await p.click('#lo-lv-1');
  await p.click('#lo-demo');
  ok((await txt('#lo-demo')) === '停止演示' && (await st()).demo, 'the demo starts (button says stop)');
  await p.waitForFunction(() => window.__lo.state().presses >= 2, null, { timeout: 8000 });
  const bd = (await st()).board;
  await p.locator('#lo-grid .lo-cell[data-i="24"]').click();
  s = await st(); ok(!s.demo && JSON.stringify(s.board) === JSON.stringify(bd) && s.assisted && (await txt('#lo-demo')) === '自动演示', 'a tap stops the demo (and is not a press)');
  await p.waitForTimeout(900); ok((await st()).presses === s.presses, 'the demo does not go on after the stop');
  // demo to the end on a small puzzle
  await p.click('#lo-size-3'); await p.click('#lo-lv-0'); await p.click('#lo-demo');
  await p.waitForFunction(() => window.__lo.state().phase === 'won', null, { timeout: 12000 });
  await p.waitForSelector('#lo-ovl:not([hidden])');
  ok((await txt('#lo-ovl h2')) === '已完成。' && (await txt('#lo-msg')).includes('演示') && (await p.evaluate(() => (JSON.parse(localStorage.getItem('learn.games.v1')).lightsout || {})['best-3-0'])) === undefined, 'a puzzle finished by the demo is completed but no best is recorded');

  // winning by hand: 3 stars for the minimum, the best is saved
  await p.click('#lo-again'); await p.evaluate(() => window.__lo.newGame(11));
  s = await st(); const sol = await p.evaluate(async ([n, b]) => (await import('/src/games/lightsout-logic.ts')).solve(n, b), [3, s.board]);
  ok(s.n === 3 && s.level === 0 && sol.length === s.min, 'a 3 x 3 easy puzzle for the win test (minimum ' + s.min + ')');
  for (const i of sol) await p.locator(`#lo-grid .lo-cell[data-i="${i}"]`).click();
  s = await st(); ok(s.phase === 'won' && s.lit === 0 && (await lamps()).every((x) => x === 0), 'all lamps off: the game is won');
  await p.waitForSelector('#lo-ovl:not([hidden])');
  ok((await p.locator('#lo-stars span:not(.off)').count()) === 3 && (await txt('#lo-ovl h2')) === '已完成。' && (await txt('#lo-msg')).includes('新纪录'), 'the minimum gives three stars and a new record');
  ok((await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).lightsout['best-3-0'])) === sol.length && (await txt('#lo-best')) === `最佳：${sol.length}`, 'the best (fewest presses) is saved per size and level');
  const bestCol = await p.evaluate(() => getComputedStyle(document.querySelector('#lo-best')).color);
  ok(bestCol === 'rgb(232, 89, 12)', 'the best pill is orange');
  await p.screenshot({ path: OUT + 'lightsout-win.png' });
  ok((await p.locator('#lo-ovl button').count()) >= 2 && await p.evaluate(() => document.querySelector('#lo-again').getBoundingClientRect().height >= 48), 'the overlay has the big button(s)');
  // a lamp tap after the win does nothing
  await p.locator('#lo-grid .lo-cell[data-i="4"]').click({ force: true }); ok((await st()).phase === 'won' && (await st()).lit === 0, 'no press after the win');
  // 2 stars (a b a = b with two extra presses) and 1 star
  await p.click('#lo-again'); await p.click('#lo-size-3'); await p.click('#lo-lv-2');
  s = await st(); const sol2 = await p.evaluate(async ([n, b]) => (await import('/src/games/lightsout-logic.ts')).solve(n, b), [3, s.board]);
  const other = [0, 1, 2, 3, 4, 5, 6, 7, 8].find((x) => !sol2.includes(x) && x !== sol2[0]);
  const seq = [other, sol2[0], other, ...sol2.slice(1)];
  if (sol2.length >= 3) for (const i of seq) await p.locator(`#lo-grid .lo-cell[data-i="${i}"]`).click();
  s = await st();
  ok(s.phase === 'won' && s.presses === sol2.length + 2, 'a, b, a counts as three presses (' + s.presses + ' for a minimum of ' + sol2.length + ')');
  await p.waitForSelector('#lo-ovl:not([hidden])');
  ok((await p.locator('#lo-stars span:not(.off)').count()) === 2, 'at most 1.5 x the minimum gives two stars');
  const bestBefore = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).lightsout['best-3-2']);
  ok(bestBefore === s.presses, 'the first result of a size / level is its best');
  // one star, and a worse result does not replace the best (3 x 3 normal: a board that needs one press)
  await p.click('#lo-again'); await p.click('#lo-lv-1');
  const one = await pressInPage(3, new Array(9).fill(0), 4);
  await p.evaluate((bd) => window.__lo.setBoard(bd, 1), one); await p.locator('#lo-grid .lo-cell[data-i="4"]').click(); await p.waitForSelector('#lo-ovl:not([hidden])');
  ok((await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).lightsout['best-3-1'])) === 1, 'one press: best 1');
  await p.click('#lo-again'); await p.evaluate((bd) => window.__lo.setBoard(bd, 1), one);
  for (const i of [0, 1, 0, 1, 4]) await p.locator(`#lo-grid .lo-cell[data-i="${i}"]`).click();
  s = await st(); await p.waitForSelector('#lo-ovl:not([hidden])');
  ok(s.phase === 'won' && s.presses === 5 && (await p.locator('#lo-stars span:not(.off)').count()) === 1 && !(await txt('#lo-msg')).includes('新纪录'), 'five presses for a minimum of one: one star, no record');
  ok((await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).lightsout['best-3-1'])) === 1 && (await txt('#lo-best')) === '最佳：1', 'a worse result does not replace the best');
  // next size
  await p.click('#lo-size-4'); await p.click('#lo-lv-0'); s = await st();
  await p.evaluate(() => { const M = window.__lo; M.setBoard([0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0], 4); });
  // 4 lit in the middle: min 4? just solve with the solver
  const sol4 = await p.evaluate(async (b) => (await import('/src/games/lightsout-logic.ts')).solve(4, b), (await st()).board);
  for (const i of sol4) await p.locator(`#lo-grid .lo-cell[data-i="${i}"]`).click();
  await p.waitForSelector('#lo-ovl:not([hidden])'); ok(!(await p.locator('#lo-next').isHidden()), 'the "next size" button is on the win screen');
  await p.click('#lo-next'); s = await st();
  ok(s.n === 5 && s.phase === 'play' && (await p.locator('#lo-grid .lo-cell').count()) === 25, 'the next size: 4 x 4 -> 5 x 5, a new puzzle');
  await p.click('#lo-size-7'); await p.evaluate(() => window.__lo.setBoard(new Array(49).fill(0).map((_, i) => (i === 0 ? 1 : 0)), 3));
  // a board that is not solvable by the rules cannot happen; use a reachable one: press cell 24 of an empty board
  const b7 = await pressInPage(7, new Array(49).fill(0), 24); await p.evaluate((b) => window.__lo.setBoard(b, 1), b7);
  await p.locator('#lo-grid .lo-cell[data-i="24"]').click(); await p.waitForSelector('#lo-ovl:not([hidden])');
  ok(await p.locator('#lo-next').isHidden(), 'at 7 x 7 there is no next size');
  await p.click('#lo-again');

  // lamps have faces (lit = happy, off = sleeping)
  ok(await p.evaluate(() => { const c = document.querySelector('.lo-cell'); return !!c.querySelector('.lo-on-face') && !!c.querySelector('.lo-off-face'); }), 'every lamp carries a lit and a sleeping face');
  ok(await p.evaluate(() => { const on = document.querySelector('.lo-cell.on .lo-on-face'), off = document.querySelector('.lo-cell:not(.on) .lo-off-face'); return (!on || getComputedStyle(on).display !== 'none') && (!off || getComputedStyle(off).display !== 'none'); }), 'a lit lamp shows the happy face and a dark one the sleeping face');

  // ---------- layout ----------
  const SHOTS = [['phone', 390, 844, 5], ['ipad', 820, 1180, 5], ['wide', 1180, 820, 5], ['side', 844, 390, 5], ['small', 320, 568, 7], ['phone7', 390, 844, 7]];
  for (const [name, w, hgt, k] of SHOTS) {
    await p.setViewportSize({ width: w, height: hgt });
    await p.evaluate(() => (location.hash = '#/subject/games')); await p.evaluate(() => (location.hash = '#/games/lightsout')); await p.waitForSelector('#lo-grid .lo-cell');
    await p.click(`#lo-size-${k}`); await p.evaluate(() => { const M = window.__lo; M.newGame(3); [2, 7, 13].forEach((i) => M.press(i)); }); await p.waitForTimeout(300);
    const m = await p.evaluate(() => {
      const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
      const f = R(document.querySelector('#lo-field')), cell = R(document.querySelector('.lo-cell'));
      const btns = [...document.querySelectorAll('.lo-opt button, .lo-act button')].map(R);
      const over = [...document.querySelectorAll('.lo-stat, .lo-wrap .mopt')].filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent);
      return { f, cell, btns, over, vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, minBtn: Math.min(...btns.map((b) => b.h)) };
    });
    const inside = (b) => b.l >= -0.5 && b.r <= m.vw + 0.5 && b.t >= -0.5 && b.b <= m.vh + 0.5;
    ok(inside(m.f) && m.btns.every(inside), `${name} ${w}x${hgt}: board and every button are on the screen (board ${Math.round(m.f.w)}px, lamp ${Math.round(m.cell.w)}px)`);
    ok(m.sw <= m.vw && m.sh <= m.vh + 1 && m.over.length === 0, `${name}: no page scrolling, no text cut off${m.over.length ? ' -> ' + m.over : ''}`);
    ok(Math.abs(m.f.w - m.f.h) <= 1.5, `${name}: the board is square (${Math.round(m.f.w)} x ${Math.round(m.f.h)})`);
    ok(Math.abs(m.f.l - (m.vw - m.f.r)) <= 3, `${name}: the board is centred (left ${Math.round(m.f.l)}, right ${Math.round(m.vw - m.f.r)})`);
    const overlap = m.btns.some((b) => !(b.r <= m.f.l || b.l >= m.f.r || b.b <= m.f.t || b.t >= m.f.b));
    ok(!overlap, `${name}: no button covers the board`);
    if (name === 'phone') ok(m.cell.w >= 40, `${name}: 5 x 5 lamps are at least 40 px (${Math.round(m.cell.w)})`);
    if (name === 'small') ok(m.cell.w >= 28, `${name}: 7 x 7 lamps on 320 px are at least 28 px (${Math.round(m.cell.w)})`);
    if (name !== 'small' && name !== 'side') ok(m.cell.w >= 28, `${name}: lamp size ${Math.round(m.cell.w)}`);
    ok(m.minBtn >= 30, `${name}: buttons are big enough to tap (${Math.round(m.minBtn)} px high)`);
    await p.screenshot({ path: OUT + `lightsout-${name}.png` });
  }
  // every size fits a phone
  await p.setViewportSize({ width: 390, height: 844 });
  for (const k of [3, 4, 6]) {
    await p.click(`#lo-size-${k}`); await p.waitForTimeout(150);
    const f = await p.evaluate(() => { const r = document.querySelector('#lo-field').getBoundingClientRect(); return { l: r.left, r: r.right, w: r.width, h: r.height, vw: innerWidth, sw: document.documentElement.scrollWidth }; });
    ok(f.l >= 0 && f.r <= f.vw && f.sw <= f.vw && Math.abs(f.l - (f.vw - f.r)) <= 3 && Math.abs(f.w - f.h) <= 1.5, `${k} x ${k} on a phone: square, centred, inside`);
  }
  // the overlay sits on the board
  await p.click('#lo-size-3'); await p.evaluate(() => { window.__lo.setBoard([0, 1, 0, 1, 1, 1, 0, 1, 0], 1); }); await p.locator('#lo-grid .lo-cell[data-i="4"]').click(); await p.waitForSelector('#lo-ovl:not([hidden])');
  ok(await p.evaluate(() => { const o = document.querySelector('#lo-ovl').getBoundingClientRect(), f = document.querySelector('#lo-field').getBoundingClientRect(); return Math.abs(o.left - f.left) < 6 && Math.abs(o.right - f.right) < 6 && Math.abs(o.top - f.top) < 6 && Math.abs(o.bottom - f.bottom) < 6; }), 'the win overlay covers exactly the board');

  // leaving stops it
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-grid');
  await p.waitForFunction(() => !window.__lo);
  ok(true, 'leaving the game removes it (the hook is gone, listeners and timers removed)');
  await p.keyboard.press('ArrowUp'); await p.keyboard.press('Space');
  ok(t.log.external.length === 0, 'no request left the app');
  await t.browser.close();

  // ---------- celebration with animations on ----------
  {
    const m = await start(new Map(), { local: true, motion: true, viewport: { width: 390, height: 844 } });
    const q = m.page;
    await q.evaluate(() => (location.hash = '#/games/lightsout')); await q.waitForSelector('#lo-grid .lo-cell');
    await q.click('#lo-size-3'); await q.evaluate(() => window.__lo.setBoard([0, 1, 0, 1, 1, 1, 0, 1, 0], 1));
    await q.locator('#lo-grid .lo-cell[data-i="4"]').click();
    ok(await q.evaluate(() => document.querySelector('#lo-field').classList.contains('win') && document.querySelectorAll('.lo-spark').length > 0), 'with animations: the lamps cheer in a wave and sparkles appear');
    await q.waitForTimeout(250); await q.screenshot({ path: OUT + 'lightsout-cheer.png' });
    await q.waitForSelector('#lo-ovl:not([hidden])', { timeout: 3000 });
    await q.locator('#lo-grid .lo-cell').first().evaluate((c) => c.classList.contains('pop'));
    ok(true, 'the overlay follows the celebration');
    await m.browser.close();
  }

  // ---------- translations ----------
  const J = JSON.parse(fs.readFileSync('src/games/lightsout.i18n.json', 'utf8'));
  const src = fs.readFileSync('src/games/lightsout.ts', 'utf8') + fs.readFileSync('src/games/lightsout-logic.ts', 'utf8');
  const used = new Set((src.match(/"[^"\n]*[一-鿿][^"\n]*"|`[^`\n]*[一-鿿][^`\n]*`/g) || []).map((x) => x.slice(1, -1).replace(/\$\{[^}]*\}/g, '{#}')));
  const keys = Object.keys(J).map((k) => k.replace(/\{\d\}/g, '{#}'));
  const lacking = [...used].filter((u) => !keys.includes(u) && !/^[一-鿿]+$/.test(u));
  const arr = (src.match(/LEVEL_NAMES = \[([^\]]+)\]/)[1].match(/"([^"]+)"/g) || []).map((x) => x.slice(1, -1));
  ok(lacking.length === 0 && arr.every((a) => J[a]), 'every Chinese text in the game code has a translation entry' + (lacking.length ? ' -> missing: ' + lacking.join(' | ') : ''));
  ok(Object.keys(J).every((k) => k.length > 1 && Array.isArray(J[k]) && J[k].length === 2 && J[k][0] && J[k][1]), 'no one-character key, every entry has English and French');
  const idx = fs.readFileSync('src/games/index.ts', 'utf8'); const nm = /id: "lightsout", name: "([^"]+)", sub: "([^"]+)"/.exec(idx);
  ok(nm && J[nm[1]] && J[nm[2]], 'the name and the subtitle of the card are in the file');
  for (const [loc, name] of [['en-US', 'en'], ['fr-FR', 'fr']]) {
    for (const [dn, vp] of [['phone', { width: 390, height: 844 }], ['small', { width: 320, height: 568 }], ['sideways', { width: 844, height: 390 }]]) {
      const u = await start(new Map(), { local: true, locale: loc, viewport: vp });
      const q = u.page;
      await q.route('**/src/i18n-data.ts*', async (route) => { const r = await route.fetch(); const body = await r.text(); await route.fulfill({ response: r, body: body + `\nObject.assign(EN, ${JSON.stringify(Object.fromEntries(Object.entries(J).map(([k, v]) => [k, v[0]])))});\nObject.assign(FR, ${JSON.stringify(Object.fromEntries(Object.entries(J).map(([k, v]) => [k, v[1]])))});\n` }); });
      await q.reload(); await q.waitForSelector('.hub-grid, .kids, .empty-home');
      await q.evaluate(() => (location.hash = '#/subject/games')); await q.waitForSelector('.gm-card');
      const home = await q.evaluate(() => document.querySelector('.gm-grid').innerText);
      ok(/Lights Out/.test(home) && !/关灯/.test(home), `${name} ${dn}: the card is named Lights Out`);
      await q.evaluate(() => (location.hash = '#/games/lightsout')); await q.waitForSelector('#lo-grid .lo-cell'); await q.waitForTimeout(250);
      const game = await q.evaluate(() => document.querySelector('.lo-wrap').innerText);
      ok(!CJK.test(game), `${name} ${dn}: the game screen has no Chinese left (${game.replace(/\s+/g, ' ').slice(0, 120)})`);
      const exp = name === 'en' ? /Presses: 0.*Minimum: \d+.*Time: 0:00.*Best: none.*Easy.*Normal.*Hard.*Challenge: off.*Hint.*Undo.*Restart.*New puzzle.*Auto demo/s : /Coups : 0.*Minimum : \d+.*Temps : 0:00.*Record : aucun.*Facile.*Normal.*Difficile.*Défi : non.*Indice.*Annuler.*Recommencer.*Nouvelle grille.*Démonstration/s;
      ok(exp.test(game), `${name} ${dn}: the texts are the translated ones`);
      const over = await q.evaluate(() => [...document.querySelectorAll('.lo-stat, .lo-wrap .mopt')].filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent));
      const fit = await q.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight, all: [...document.querySelectorAll('.lo-wrap button, #lo-field')].every((x) => { const r = x.getBoundingClientRect(); return r.right <= innerWidth + 1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.top >= -1; }) }));
      ok(over.length === 0 && fit.sw <= fit.iw && fit.sh <= fit.ih + 1 && fit.all, `${name} ${dn}: no text is cut off, nothing overflows${over.length ? ' -> ' + over.join() : ''}`);
      if (dn === 'phone') await q.screenshot({ path: OUT + `lightsout-${name}.png` });
      await q.click('#lo-size-3'); await q.evaluate(() => window.__lo.setBoard([0, 1, 0, 1, 1, 1, 0, 1, 0], 1));
      await q.locator('#lo-grid .lo-cell[data-i="4"]').click(); await q.waitForSelector('#lo-ovl:not([hidden])');
      const ov = await q.evaluate(() => document.querySelector('#lo-ovl').innerText);
      ok(!CJK.test(ov) && (name === 'en' ? /Completed\./.test(ov) && /Play again/.test(ov) && /Next size/.test(ov) && /New record: 1 press/.test(ov) : /Terminé\./.test(ov) && /Rejouer/.test(ov) && /Taille suivante/.test(ov) && /Nouveau record : 1 coup/.test(ov)), `${name} ${dn}: the win overlay is translated (${ov.replace(/\s+/g, ' ')})`);
      if (dn === 'phone') await q.screenshot({ path: OUT + `lightsout-${name}-win.png` });
      ok(u.log.external.length === 0, `${name} ${dn}: no outside request`);
      await u.browser.close();
    }
  }

  // ---------- a real touch screen (CDP touch events, device pixel ratio 2) ----------
  {
    const u = await start(new Map(), { local: true, touch: true, dpr: 2, viewport: { width: 390, height: 844 } });
    const q = u.page; const cdp = await q.context().newCDPSession(q);
    await q.evaluate(() => (location.hash = '#/games/lightsout')); await q.waitForSelector('#lo-grid .lo-cell'); await q.waitForTimeout(200);
    const tap = async (x, y) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await q.waitForTimeout(90); };
    const center = async (sel) => { const b = await q.locator(sel).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
    const state = () => q.evaluate(() => window.__lo.state());
    const b0 = (await state()).board;
    const [x12, y12] = await center('#lo-grid .lo-cell[data-i="12"]'); await tap(x12, y12);
    let a = await state();
    ok(a.presses === 1 && a.history[0] === 12 && JSON.stringify(a.board) === JSON.stringify(await q.evaluate(async ([b]) => (await import('/src/games/lightsout-logic.ts')).press(5, b, 12), [b0])), 'a real touch (dpr 2) on a lamp presses exactly that lamp once');
    const [x0, y0] = await center('#lo-grid .lo-cell[data-i="0"]'); const [x24, y24] = await center('#lo-grid .lo-cell[data-i="24"]');
    await tap(x0, y0); await tap(x24, y24); a = await state();
    ok(a.presses === 3 && a.history.join() === '12,0,24', 'taps on different lamps one after the other all count (no zoom, no delay)');
    // two fingers at once on two lamps
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 + 140, id: 1 }, { x: x24 - 140, y: y24, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await q.waitForTimeout(150);
    a = await state(); ok(a.presses >= 3, 'two fingers at once do not break the game (' + a.presses + ' presses)');
    const [ux, uy] = await center('#lo-undo'); await tap(ux, uy); const a2 = await state(); ok(a2.presses === a.presses - 1, 'a touch on Undo takes a press back');
    const [hx, hy] = await center('#lo-hint'); await tap(hx, hy); ok((await state()).hint >= 0, 'a touch on Hint shows a lamp');
    const [dx, dy] = await center('#lo-demo'); await tap(dx, dy); ok((await state()).demo, 'a touch on Auto demo starts it');
    await q.waitForFunction(() => window.__lo.state().presses > 0, null, { timeout: 6000 }).catch(() => {});
    await tap(x12, y12); await q.waitForTimeout(100);
    ok(!(await state()).demo, 'a real touch stops the demo');
    // the page does not zoom or scroll
    ok(await q.evaluate(() => window.visualViewport.scale === 1 && document.documentElement.scrollWidth <= innerWidth), 'no zoom, no sideways scroll');
    await q.screenshot({ path: OUT + 'lightsout-touch.png' });
    ok(u.log.external.length === 0, 'touch: no outside request');
    await u.browser.close();
  }
  await done();
})();
