// Maze: the generators (random perfect mazes, three algorithms, four sizes), the drawing rules (pure), the screen (mouse, a real touch screen through the browser's
// protocol at dpr 2, keyboard, hints, answer, undo, best time), layout on five screens, EN / FR, no outside request.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/maze/';
fs.mkdirSync(OUT, { recursive: true });

// the texts of the game in the other languages: every Chinese text that is shown must be in maze.i18n.json (or already in the app's tables once the lead has merged it)
const TABLE = JSON.parse(fs.readFileSync(__dirname + '/../../src/games/maze.i18n.json', 'utf8'));
const cjk = /[　-〿一-鿿＀-￯]/;
const pats = Object.keys(TABLE).filter((k) => /\{\d+\}/.test(k)).map((k) => ({ k, re: new RegExp('^' + k.split(/\{\d+\}/).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('([\\s\\S]*?)') + '$') }));
const covered = (s) => {
  s = s.trim();
  if (!cjk.test(s) || TABLE[s]) return true;
  return pats.some((p) => { const m = p.re.exec(s); return m && m.slice(1).every(covered); });
};

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  const p = t.page;
  await p.evaluate(() => (location.hash = '#/games/maze')); await p.waitForSelector('#mz-canvas');

  // ================= 1. the generators and the drawing rules (pure) =================
  const L = await p.evaluate(async () => {
    const M = await import('/src/games/maze-logic.ts');
    const res = { bad: [], mazes: 0, minShare: 9, shortest: {}, perAlgo: {}, notes: [] };
    const hash = (m) => { let a = 2166136261; for (const b of m.open) a = Math.imul(a ^ b, 16777619) >>> 0; return a + ':' + m.start + ':' + m.exit; };
    const sameOpen = (a, b) => a.open.length === b.open.length && a.open.every((v, i) => v === b.open[i]);
    for (const algo of M.ALGOS) for (const sz of M.SIZES) {
      const n = sz.n; let deadEnds = 0, solLen = 0;
      for (let s = 0; s < 210; s++) {
        const seed = 1000 + s * 7919 + n, m = M.generateMaze(n, n, seed, algo); res.mazes++;
        const v = M.verify(m); if (v.length) res.bad.push(`${algo}${n} #${s}: ${v[0]}`);
        const sol = M.solve(m, m.start, m.exit);
        if (!sol.length || sol[0] !== m.start || sol[sol.length - 1] !== m.exit || !M.isRoute(m, sol)) res.bad.push(`${algo}${n} #${s}: no valid solution`);
        if (sol.length < 1.5 * n) res.bad.push(`${algo}${n} #${s}: solution too short (${sol.length})`);
        res.minShare = Math.min(res.minShare, sol.length / (n * n)); solLen += sol.length;
        res.shortest[algo + n] = Math.min(res.shortest[algo + n] ?? 1e9, sol.length);
        if (m.algo !== algo) res.bad.push('algo name');
        // start and exit on opposite sides
        if ((m.startSide + 2) % 4 !== m.exitSide) res.bad.push(`${algo}${n} #${s}: sides not opposite`);
        if (!M.sideCells(n, n, m.startSide).includes(m.start) || !M.sideCells(n, n, m.exitSide).includes(m.exit)) res.bad.push(`${algo}${n} #${s}: ends not on their sides`);
        for (let c = 0; c < n * n; c++) { let k = 0; for (let d = 0; d < 4; d++) if (m.open[c] & M.DIRS[d].bit) k++; if (k === 1) deadEnds++; }
        // the same seed makes the same maze, another seed another one
        if (s < 15) {
          if (!sameOpen(m, M.generateMaze(n, n, seed, algo))) res.bad.push(`${algo}${n}: same seed, other maze`);
          if (sameOpen(m, M.generateMaze(n, n, seed + 1, algo))) res.bad.push(`${algo}${n}: other seed, same maze`);
        }
      }
      (res.perAlgo[algo] ??= {})[n] = { dead: deadEnds / 210 / (n * n), sol: solLen / 210 };
    }
    // the algorithm chosen by the seed: all three turn up
    const seen = new Set(); for (let s = 0; s < 60; s++) seen.add(M.generateMaze(14, 14, s).algo);
    if (seen.size !== 3) res.bad.push('the algorithm is not varied: ' + [...seen]);
    // 20 mazes in a row (random seeds) are never identical
    const hs = new Set(); for (let i = 0; i < 20; i++) hs.add(hash(M.generateMaze(14, 14, Math.floor(Math.random() * 4294967296))));
    if (hs.size !== 20) res.bad.push('20 mazes in a row had duplicates');
    // the two families look different: the backtracker has long winding corridors (long solution, few dead ends); Prim has many short branches
    const A = res.perAlgo; for (const n of [14, 22, 30]) {
      if (!(A.backtracker[n].sol > A.prim[n].sol * 1.5)) res.bad.push('backtracker solutions not clearly longer than Prim at ' + n);
      if (!(A.backtracker[n].dead < A.prim[n].dead)) res.bad.push('backtracker does not have fewer dead ends than Prim at ' + n);
    }
    // the checker can fail: a maze with one passage more (a loop) or one cut away is refused
    const g = M.generateMaze(8, 8, 5, 'prim'), loop = { ...g, open: g.open.slice() };
    outer: for (let c = 0; c < 64; c++) for (let d = 0; d < 4; d++) { const o = M.neighbour(8, 8, c, d); if (o >= 0 && !(loop.open[c] & M.DIRS[d].bit)) { loop.open[c] |= M.DIRS[d].bit; loop.open[o] |= M.DIRS[d].opp; break outer; } }
    if (!M.verify(loop).length) res.bad.push('verify accepts a maze with a loop');
    const cut = { ...g, open: g.open.slice() }; cut.open[0] = 0; if (!M.verify(cut).length) res.bad.push('verify accepts an isolated cell');
    // sizes on a screen
    if (M.fitDim(30, 288) !== 26 || M.fitDim(8, 288) !== 8 || M.fitDim(14, 1000) !== 14 || M.fitDim(30, 20) < 6) res.bad.push('fitDim');

    // ---- drawing ----
    const ctr = (m, c) => [(c % m.w) + 0.5, Math.floor(c / m.w) + 0.5];
    const follow = (m, path, cells, jump) => {   // the finger goes through the centres of the cells (`jump`: only every n-th centre: a fast finger)
      let cur = path, [x, y] = ctr(m, cur[cur.length - 1]), last;
      for (let i = 0; i < cells.length; i += jump) { const c = cells[Math.min(cells.length - 1, i + jump - 1)]; const [nx, ny] = ctr(m, c); last = M.drawSegment(m, cur, x, y, nx, ny); cur = last.path; x = nx; y = ny; }
      return { path: cur, last };
    };
    let r;
    for (const jump of [1, 3, 8, 1000]) {
      for (let s = 0; s < 40; s++) {
        const m = M.generateMaze(14, 14, 500 + s), sol = M.solve(m, m.start, m.exit);
        const out = follow(m, [m.start], sol.slice(1), jump);
        // a very fast finger (jump = 8 / 1000) cuts straight across: the line may stop at a wall, but it is always a valid route
        if (!M.isRoute(m, out.path)) res.bad.push(`follow jump ${jump}: not a route`);
        if (jump === 1 && (!out.last.won || out.path.length !== sol.length || out.path.some((c, i) => c !== sol[i]))) res.bad.push('following the solution did not reach the exit');
      }
    }
    // a wall blocks, also at full speed
    let wallsTried = 0;
    for (let s = 0; s < 60; s++) {
      const m = M.generateMaze(14, 14, 900 + s), sol = M.solve(m, m.start, m.exit), c = sol[3];
      for (let d = 0; d < 4; d++) {
        const o = M.neighbour(14, 14, c, d); if (o < 0 || (m.open[c] & M.DIRS[d].bit)) continue;
        const base = sol.slice(0, 4), [ax, ay] = ctr(m, c), [bx, by] = ctr(m, o);
        r = M.drawSegment(m, base, ax, ay, bx, by); wallsTried++;
        if (!r.blocked || r.path.length !== 4 || r.path.some((v, i) => v !== base[i])) res.bad.push('a wall did not block');
        // a single huge move across several walls: from the head to the far corner and the exit
        for (const [tx, ty] of [[0.1, 0.1], [13.9, 13.9], ctr(m, m.exit), [ax + 5.5, ay], [ax, ay + 6.5]]) {
          r = M.drawSegment(m, base, ax, ay, tx, ty);
          if (!M.isRoute(m, r.path)) res.bad.push('huge move made a bad line');
        }
        break;
      }
    }
    if (wallsTried < 40) res.bad.push('too few wall checks: ' + wallsTried);
    // fuzz: 3000 random segments on random mazes never make an illegal line
    let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    let fz = 0, extended = 0;
    for (let g2 = 0; g2 < 60; g2++) {
      const w = 6 + Math.floor(rnd() * 20), m = M.generateMaze(w, w, 3000 + g2); let path = [m.start], x = ctr(m, m.start)[0], y = ctr(m, m.start)[1];
      for (let i = 0; i < 50; i++) {
        let nx = Math.max(-1, Math.min(w + 1, x + (rnd() - 0.5) * (i % 5 === 0 ? 12 : 2))), ny = Math.max(-1, Math.min(w + 1, y + (rnd() - 0.5) * (i % 5 === 0 ? 12 : 2)));
        if (rnd() < 0.6) { const sol = M.solve(m, path[path.length - 1], m.exit); if (sol.length > 1) { [nx, ny] = ctr(m, sol[1 + Math.floor(rnd() * Math.min(3, sol.length - 1))]); nx += (rnd() - 0.5) * 0.4; ny += (rnd() - 0.5) * 0.4; } }
        const before = path.length; r = M.drawSegment(m, path, x, y, nx, ny); path = r.path; x = nx; y = ny; fz++;
        if (path.length > before) extended++;
        if (!M.isRoute(m, path)) { res.bad.push('fuzz made a bad line'); break; }
      }
    }
    res.fz = fz; res.extended = extended;
    // retract: forward 12 along the solution, then back over 5 cells
    { const m = M.generateMaze(14, 14, 77), sol = M.solve(m, m.start, m.exit);
      const f = follow(m, [m.start], sol.slice(1, 13), 1); if (f.path.length !== 13) res.bad.push('forward 12');
      const back = follow(m, f.path, sol.slice(7, 12).reverse(), 1); if (back.path.length !== 8 || !back.last.retracted) res.bad.push('retract over the line: ' + back.path.length);
      // a fast move back along the line cuts it there
      const fast = follow(m, f.path, sol.slice(4, 12).reverse(), 2); if (!M.isRoute(m, fast.path) || fast.path.length >= 13) res.bad.push('fast retract ' + fast.path.length);
      // lifting and continuing: the next touch on the end of the line (or near it) continues, elsewhere nothing, on the start begins again
      const hx = ctr(m, sol[12]); if (M.touchTarget(m, f.path, hx[0] + 0.3, hx[1] - 0.2) !== 'head') res.bad.push('touch on the end');
      if (M.touchTarget(m, f.path, ...ctr(m, sol[6])) !== null) res.bad.push('touch in the middle of the line must do nothing');
      if (M.touchTarget(m, f.path, ...ctr(m, m.start)) !== 'start') res.bad.push('touch on the start');
      if (M.touchTarget(m, [m.start], ...ctr(m, m.start)) !== 'head') res.bad.push('touch on the start of a line that is only the start');
      // keyboard
      let k = [m.start]; for (let i = 1; i < 6; i++) { const a = sol[i - 1], b = sol[i]; const d = M.DIRS.findIndex((D, di) => M.neighbour(14, 14, a, di) === b); k = M.stepDir(m, k, d).path; }
      if (k.length !== 6) res.bad.push('keyboard forward');
      const dBack = M.DIRS.findIndex((D, di) => M.neighbour(14, 14, sol[5], di) === sol[4]); k = M.stepDir(m, k, dBack); if (k.path.length !== 5 || !k.retracted) res.bad.push('keyboard back');
      let wallDir = -1; for (let d = 0; d < 4; d++) if (!(m.open[sol[4]] & M.DIRS[d].bit)) wallDir = d; k = M.stepDir(m, k.path, wallDir); if (!k.blocked || k.path.length !== 5) res.bad.push('keyboard wall');
      // undo by 10 cells, hints, stars
      if (M.undoCells(sol.slice(0, 25)).length !== 15 || M.undoCells(sol.slice(0, 4)).length !== 1 || M.undoCells([m.start]).length !== 1) res.bad.push('undoCells');
      const hc = M.hintCells(m, sol.slice(0, 5)); if (hc.length !== 6 || hc.some((c, i) => c !== sol[5 + i])) res.bad.push('hintCells follow the solution');
      const hc2 = M.hintCells(m, sol.slice(0, sol.length - 3)); if (hc2.length !== 3) res.bad.push('hint near the end');
      if (M.starsFor(0, false) !== 3 || M.starsFor(1, false) !== 2 || M.starsFor(3, false) !== 1 || M.starsFor(0, true) !== 0) res.bad.push('starsFor');
      if (M.fmtTime(65000) !== '1:05') res.bad.push('fmtTime');
    }
    return res;
  });
  ok(L.bad.length === 0, `generators + rules: ${L.mazes} mazes (3 algorithms x 4 sizes x 210), ${L.fz} fuzz moves; all invariants hold${L.bad.length ? ' -> ' + [...new Set(L.bad)].slice(0, 8).join('; ') : ''}`);
  ok(L.minShare >= 0.05 && L.extended > 200, `the routes are long (shortest ${(L.minShare * 100).toFixed(1)} % of the cells) and the fuzz really drew (${L.extended} extensions)`);
  console.log('   avg solution length  backtracker/prim/kruskal @30:', Math.round(L.perAlgo.backtracker[30].sol), Math.round(L.perAlgo.prim[30].sol), Math.round(L.perAlgo.kruskal[30].sol));

  // ================= 2. the screen with the mouse and the keyboard =================
  const api = {
    load: (w, h, seed, algo) => p.evaluate(([w, h, seed, algo]) => window.__maze.load(w, h, seed, algo), [w, h, seed, algo]),
    info: () => p.evaluate(async () => {
      const M = await import('/src/games/maze-logic.ts'), z = window.__maze, m = z.maze(), c = document.querySelector('#mz-canvas').getBoundingClientRect();
      return { sol: M.solve(m, m.start, m.exit), path: z.path(), phase: z.phase(), cell: z.cell(), pad: z.pad(), left: c.left, top: c.top, w: m.w, route: M.isRoute(m, z.path()), exit: m.exit, start: m.start, open: [...m.open] };
    }),
  };
  const xy = (I, c) => [I.left + I.pad + ((c % I.w) + 0.5) * I.cell, I.top + I.pad + (Math.floor(c / I.w) + 0.5) * I.cell];
  const mouseFollow = async (I, cells, down = true, up = true) => {
    const [x0, y0] = xy(I, cells[0]); await p.mouse.move(x0, y0); if (down) await p.mouse.down();
    for (const c of cells.slice(1)) { const [x, y] = xy(I, c); await p.mouse.move(x, y, { steps: 2 }); }
    if (up) await p.mouse.up();
  };
  const pathNow = () => p.evaluate(() => window.__maze.path());

  await api.load(14, 14, 4242, 'backtracker');
  let I = await api.info();
  ok(I.path.length === 1 && I.phase === 'play' && I.sol.length > 40, `a maze is on the screen (14 x 14, solution ${I.sol.length} cells)`);
  ok((await p.textContent('#mz-time')) === '时间：0:00' && (await p.textContent('#mz-hints')) === '提示：0 / 3' && (await p.textContent('#mz-best')) === '最快：-', 'pills: time 0:00, hints 0 / 3, no best time yet');
  ok(await p.evaluate(() => window.__maze.themes >= 6), 'at least 6 colour themes');
  const themes = new Set(); for (let i = 0; i < 24; i++) { await p.evaluate(() => document.querySelector('#mz-new').click()); themes.add(await p.evaluate(() => window.__maze.theme())); }
  ok(themes.size >= 5, `new mazes use varying colour themes (${themes.size} different in 24)`);
  await api.load(14, 14, 4242, 'backtracker'); I = await api.info();
  await p.screenshot({ path: OUT + 'maze-ready.png' });

  // a touch on the middle of nothing does nothing; a wall stops the line even at full speed
  await p.mouse.move(...xy(I, I.sol[5])); await p.mouse.down(); await p.mouse.move(...xy(I, I.sol[7]), { steps: 3 }); await p.mouse.up();
  ok((await pathNow()).length === 1, 'a touch away from the start character draws nothing');
  let wi = 3, wallTarget = -1;
  for (; wi < I.sol.length && wallTarget < 0; wi++) { const c3 = I.sol[wi]; for (let d = 0; d < 4; d++) { const o = [c3 - I.w, c3 + 1, c3 + I.w, c3 - 1][d]; const nx = o % I.w, in2 = o >= 0 && o < I.w * I.w && Math.abs(nx - (c3 % I.w)) <= 1; if (in2 && !(I.open[c3] & [1, 2, 4, 8][d])) { wallTarget = o; break; } } }
  wi--; const L1 = wi + 1;
  await mouseFollow(I, I.sol.slice(0, L1), true, false);
  ok((await pathNow()).length === L1 && wallTarget >= 0, `the line follows the finger through the corridor (${L1} cells)`);
  const [wx, wy] = xy(I, wallTarget); await p.mouse.move(wx, wy, { steps: 1 });
  ok((await pathNow()).length === L1, 'the line stops at the wall: the finger goes into the next cell through a wall, the line stays');
  const [ex, ey] = xy(I, I.exit); await p.mouse.move(ex, ey, { steps: 1 });   // one huge move across many walls
  let a = await api.info(); ok(a.route && a.phase === 'play', 'one huge move across the board does not cut through walls (still a valid route, no win): ' + a.path.length + ' cells');
  await p.mouse.up();
  // lift and continue
  await api.load(14, 14, 4242, 'backtracker'); I = await api.info();
  await mouseFollow(I, I.sol.slice(0, 15));
  ok((await pathNow()).length === 15, 'lifting the finger keeps the line');
  await p.mouse.move(...xy(I, I.sol[9])); await p.mouse.down(); await p.mouse.move(...xy(I, I.sol[11]), { steps: 3 }); await p.mouse.up();
  ok((await pathNow()).length === 15, 'a touch in the middle of the line does nothing');
  await mouseFollow(I, I.sol.slice(14, 26));
  ok((await pathNow()).length === 26, 'the next touch on the end of the line continues it');
  await mouseFollow(I, [I.sol[25], I.sol[24], I.sol[23], I.sol[22], I.sol[21], I.sol[20]]);
  ok((await pathNow()).length === 21, 'moving back over the line takes it back (retracts)');
  await mouseFollow(I, [I.sol[0]], true, true); await p.mouse.move(...xy(I, I.sol[0]));
  ok((await pathNow()).length === 1, 'a touch on the start begins again');

  // keyboard: arrows move the head along the line
  await api.load(14, 14, 4242, 'backtracker'); I = await api.info();
  const keyFor = (a, b) => (b === a - I.w ? 'ArrowUp' : b === a + 1 ? 'ArrowRight' : b === a + I.w ? 'ArrowDown' : 'ArrowLeft');
  for (let i = 1; i <= 8; i++) await p.keyboard.press(keyFor(I.sol[i - 1], I.sol[i]));
  ok((await pathNow()).length === 9, 'arrow keys move along the corridor');
  await p.keyboard.press(keyFor(I.sol[8], I.sol[7])); await p.keyboard.press(keyFor(I.sol[7], I.sol[6]));
  ok((await pathNow()).length === 7, 'the opposite arrow takes the line back');
  let wk = null; for (const [k, d] of [['ArrowUp', 1], ['ArrowRight', 2], ['ArrowDown', 4], ['ArrowLeft', 8]]) if (!(I.open[I.sol[6]] & d)) wk = k;
  await p.keyboard.press(wk); ok((await pathNow()).length === 7, 'an arrow into a wall does nothing');

  // undo (10 cells), erase, hints
  await p.click('#mz-undo'); ok((await pathNow()).length === 1, 'undo takes back up to 10 cells (7 -> start)');
  for (let i = 1; i <= 30; i++) await p.keyboard.press(keyFor(I.sol[i - 1], I.sol[i]));
  await p.click('#mz-undo'); ok((await pathNow()).length === 21, 'undo: 31 cells -> 21');
  await p.click('#mz-reset'); ok((await pathNow()).length === 1, 'erase and restart clears the line');
  ok(await p.locator('#mz-undo').isDisabled() && await p.locator('#mz-reset').isDisabled(), 'undo and erase are off when there is nothing to take back');
  for (let i = 1; i <= 5; i++) await p.keyboard.press(keyFor(I.sol[i - 1], I.sol[i]));
  await p.click('#mz-hint');
  let hs = await p.evaluate(() => window.__maze.hints());
  ok(hs.length === 6 && hs.every((c, i) => c === I.sol[6 + i]) && (await p.textContent('#mz-hints')) === '提示：1 / 3', 'a hint shows the next 6 cells of the route and counts');
  await p.screenshot({ path: OUT + 'maze-hint.png' });
  await p.keyboard.press(keyFor(I.sol[5], I.sol[6]));
  ok((await p.evaluate(() => window.__maze.hints())).length === 0, 'the hint disappears when the line moves');
  await p.click('#mz-hint'); await p.click('#mz-hint');
  ok((await p.textContent('#mz-hints')) === '提示：3 / 3' && await p.locator('#mz-hint').isDisabled(), 'at most 3 hints per maze, then the button is off');
  // the answer
  await p.click('#mz-answer');
  const ans = await p.evaluate(() => window.__maze.answer());
  ok(ans && ans.length === I.sol.length && ans.every((c, i) => c === I.sol[i]) && (await p.textContent('#mz-answer')) === '隐藏答案', 'the answer shows the whole solution');
  await p.screenshot({ path: OUT + 'maze-answer.png' });
  // win with the answer shown: 0 stars, no best time
  for (let i = 7; i < I.sol.length; i++) await p.keyboard.press(keyFor(I.sol[i - 1], I.sol[i]));
  await p.waitForFunction(() => !document.querySelector('#mz-ovl').hidden, null, { timeout: 4000 });
  ok((await p.getAttribute('#mz-stars', 'data-stars')) === '0' && !(await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1') || '{}').maze?.['best-normal'])), 'a win after showing the answer: no star, no best time');

  // a clean win with the mouse: gold line, overlay, stars, best time kept; slower later does not replace it
  await api.load(14, 14, 4243, 'kruskal'); I = await api.info();
  await mouseFollow(I, I.sol);
  await p.waitForFunction(() => !document.querySelector('#mz-ovl').hidden, null, { timeout: 4000 });
  a = await api.info();
  ok(a.phase === 'won' && a.path.length === I.sol.length && a.path.at(-1) === I.exit, 'following the route with the mouse reaches the exit: win');
  ok((await p.textContent('#mz-ovl h2')) === '迷宫完成。' && /^用时 \d+:\d\d$/.test(await p.textContent('#mz-ovl p')) && (await p.getAttribute('#mz-stars', 'data-stars')) === '3' && (await p.textContent('#mz-ovl button')) === '再来一个', 'the overlay: title, time, 3 stars, another one');
  await p.screenshot({ path: OUT + 'maze-win.png' });
  const best1 = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).maze['best-normal']);
  ok(best1 > 0 && (await p.textContent('#mz-best')).startsWith('最快：') && (await p.textContent('#mz-best')) !== '最快：-', 'the best time is kept per size on this device: ' + best1 + ' ms');
  await p.mouse.move(...xy(I, I.sol[3])); await p.mouse.down(); await p.mouse.move(...xy(I, I.sol[5]), { steps: 3 }); await p.mouse.up();
  ok((await pathNow()).length === I.sol.length, 'after the win the line can not be changed');
  await p.click('#mz-next');
  a = await api.info(); ok(a.phase === 'play' && a.path.length === 1 && await p.locator('#mz-ovl').isHidden(), '"another one" makes a new maze');
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('learn.games.v1')); s.maze['best-normal'] = 1; localStorage.setItem('learn.games.v1', JSON.stringify(s)); });
  await api.load(14, 14, 4244, 'prim'); I = await api.info(); await p.waitForTimeout(1200);
  for (let i = 1; i < I.sol.length; i++) await p.keyboard.press(keyFor(I.sol[i - 1], I.sol[i]));
  await p.waitForFunction(() => !document.querySelector('#mz-ovl').hidden, null, { timeout: 4000 });
  ok((await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).maze['best-normal'])) === 1 && await p.locator('#mz-note').isHidden(), 'a slower win does not replace the best time');
  // one hint = 2 stars
  await api.load(14, 14, 4245, 'backtracker'); I = await api.info(); await p.click('#mz-hint');
  for (let i = 1; i < I.sol.length; i++) await p.keyboard.press(keyFor(I.sol[i - 1], I.sol[i]));
  await p.waitForFunction(() => !document.querySelector('#mz-ovl').hidden, null, { timeout: 4000 });
  ok((await p.getAttribute('#mz-stars', 'data-stars')) === '2', 'one hint costs a star (2 stars)');
  await p.keyboard.press('Enter'); a = await api.info(); ok(a.phase === 'play' && a.path.length === 1, 'Enter after a win starts a new maze');

  // size and new maze buttons
  await p.setViewportSize({ width: 820, height: 1180 }); await p.waitForTimeout(150);
  const sizes = [];
  for (let i = 0; i < 4; i++) { await p.click('#mz-size'); sizes.push((await p.textContent('#mz-sizelabel')).trim() + ' ' + await p.evaluate(() => window.__maze.maze().w)); }
  ok(sizes.join('|') === '困难 22×22 22|专家 30×30 30|简单 8×8 8|普通 14×14 14', 'the size button goes through easy / normal / hard / expert: ' + sizes.join(', '));
  const seeds = new Set(); for (let i = 0; i < 20; i++) { await p.click('#mz-new'); seeds.add(await p.evaluate(() => window.__maze.maze().seed)); }
  ok(seeds.size === 20, '"new maze" 20 times in a row: 20 different mazes');
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).maze.size === 'normal'), 'the chosen size is kept on this device');

  // ================= 3. a real touch screen (protocol touch events) at dpr 2 =================
  await t.browser.close();
  const t2 = await start(new Map(), { local: true, viewport: { width: 390, height: 844 }, touch: true, dpr: 2 });
  const q = t2.page;
  await q.evaluate(() => (location.hash = '#/games/maze')); await q.waitForSelector('#mz-canvas');
  const cdp = await q.context().newCDPSession(q);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  await q.evaluate(() => window.__maze.load(14, 14, 31337, 'prim'));
  const info2 = () => q.evaluate(async () => {
    const M = await import('/src/games/maze-logic.ts'), z = window.__maze, m = z.maze(), c = document.querySelector('#mz-canvas'), r = c.getBoundingClientRect();
    return { sol: M.solve(m, m.start, m.exit), path: z.path(), phase: z.phase(), cell: z.cell(), pad: z.pad(), left: r.left, top: r.top, w: m.w, exit: m.exit, ow: c.offsetWidth, oh: c.offsetHeight, cw: c.width, ch: c.height, sw: c.style.width, dpr: devicePixelRatio, open: [...m.open] };
  });
  let J = await info2();
  ok(J.dpr === 2 && J.cw === Math.round(J.ow * 2) && J.ch === Math.round(J.oh * 2) && J.sw === J.ow + 'px', `the canvas is crisp at dpr 2: ${J.cw}x${J.ch} backing pixels for ${J.ow}x${J.oh} css px (layout size)`);
  const pt = (c, id = 0) => { const [x, y] = [J.left + J.pad + ((c % J.w) + 0.5) * J.cell, J.top + J.pad + (Math.floor(c / J.w) + 0.5) * J.cell]; return { x, y, id }; };
  // a second finger is ignored
  const far = J.sol[Math.floor(J.sol.length / 2)];
  await touch('touchStart', [pt(J.sol[0], 0)]);
  await touch('touchStart', [pt(J.sol[0], 0), pt(far, 1)]);
  for (let i = 1; i <= 6; i++) await touch('touchMove', [pt(J.sol[i], 0), pt(far, 1)]);
  await q.waitForTimeout(80);
  ok((await q.evaluate(() => window.__maze.path())).length === 7, 'touch: the first finger draws');
  for (let i = 1; i <= 6; i++) await touch('touchMove', [pt(J.sol[6], 0), pt(J.sol[Math.min(J.sol.length - 1, Math.floor(J.sol.length / 2) + i)], 1)]);
  await q.waitForTimeout(80);
  ok((await q.evaluate(() => window.__maze.path())).length === 7, 'a second finger moving on the board is ignored');
  await touch('touchEnd', []);
  // continue from the end with a fresh touch, follow the solution to the exit
  await touch('touchStart', [pt(J.sol[6], 0)]);
  for (let i = 7; i < J.sol.length; i++) { const a0 = pt(J.sol[i - 1]), b0 = pt(J.sol[i]); await touch('touchMove', [{ x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2, id: 0 }]); await touch('touchMove', [b0]); }
  await touch('touchEnd', []); await q.waitForTimeout(80);
  await q.waitForFunction(() => window.__maze.phase() === 'won', null, { timeout: 3000 }).catch(() => {});
  J = await info2(); ok(J.phase === 'won' && J.path.length === J.sol.length, 'touch: lifting and continuing along the solution reaches the exit');
  await q.waitForFunction(() => !document.querySelector('#mz-ovl').hidden, null, { timeout: 4000 });
  await q.screenshot({ path: OUT + 'maze-touch-win.png' });
  // a touch swipe through walls at full speed
  await q.evaluate(() => window.__maze.load(14, 14, 31338, 'backtracker')); J = await info2();
  await touch('touchStart', [pt(J.sol[0])]); await touch('touchMove', [pt(J.exit)]); await touch('touchMove', [{ x: J.left + 3, y: J.top + J.ow - 3, id: 0 }]); await touch('touchEnd', []); await q.waitForTimeout(80);
  ok(await q.evaluate(async () => { const M = await import('/src/games/maze-logic.ts'); return M.isRoute(window.__maze.maze(), window.__maze.path()) && window.__maze.phase() === 'play'; }), 'touch: a fast swipe through the walls leaves a valid route and no win');

  // ================= 4. layout on five screens =================
  const shots = [['phone-390x844', 390, 844], ['ipad-820x1180', 820, 1180], ['ipad-land-1180x820', 1180, 820], ['side-844x390', 844, 390], ['small-320x568', 320, 568]];
  for (const [name, w, hgt] of shots) {
    await q.setViewportSize({ width: w, height: hgt });
    await q.evaluate(() => (location.hash = '#/subject/games')); await q.evaluate(() => (location.hash = '#/games/maze')); await q.waitForSelector('#mz-canvas');
    for (const sz of ['normal', 'expert']) {
      await q.evaluate((sz) => { const s = JSON.parse(localStorage.getItem('learn.games.v1') || '{}'); (s.maze ??= {}).size = sz; localStorage.setItem('learn.games.v1', JSON.stringify(s)); location.hash = '#/subject/games'; location.hash = '#/games/maze'; }, sz);
      await q.waitForFunction((sz) => window.__maze && window.__maze.size() === sz, sz); await q.waitForTimeout(250);
      const m = await q.evaluate(() => {
        const R = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
        const c = document.querySelector('#mz-canvas');
        return { f: R('#mz-field'), pad: R('.mz-pad'), hud: R('.mz-hud'), vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, cell: window.__maze.cell(), dim: window.__maze.maze().w,
          btns: [...document.querySelectorAll('.mz-pad button, .mz-hud span')].every((b) => { const r = b.getBoundingClientRect(); return r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.top >= -0.5 && r.bottom <= innerHeight + 0.5; }),
          cw: c.width, ow: c.offsetWidth, oh: c.offsetHeight, dpr: devicePixelRatio, size: window.__maze.size() };
      });
      const inside = (b) => b.l >= -0.5 && b.r <= m.vw + 0.5 && b.t >= -0.5 && b.b <= m.vh + 0.5;
      const tag = `${name} ${sz} (${m.dim}x${m.dim}, cell ${m.cell}px)`;
      ok(inside(m.f) && inside(m.pad) && inside(m.hud) && m.btns, `${tag}: board, pills and buttons are on the screen`);
      ok(m.sw <= m.vw && m.sh <= m.vh + 1, `${tag}: no page scrolling`);
      ok(Math.abs(m.f.w - m.f.h) <= 1 && Math.abs(m.f.l - (m.vw - m.f.r)) <= 3, `${tag}: the board is square and centred (${Math.round(m.f.l)} / ${Math.round(m.vw - m.f.r)})`);
      ok(m.f.b <= m.pad.t + 1 || m.f.r <= m.pad.l + 1 || m.pad.r <= m.f.l + 1, `${tag}: the buttons do not cover the board`);
      ok(m.cell >= 11, `${tag}: cells are at least 11 px`);
      ok(m.cw === Math.round(m.ow * m.dpr), `${tag}: the canvas backing size follows its layout size`);
      if (sz === 'expert' && w !== 320) ok(m.f.w > Math.min(w, hgt) * 0.5, `${tag}: the board uses the room (${Math.round(m.f.w)}px)`);
      if (sz === 'expert') console.log(`   expert on ${w}x${hgt}: ${m.dim} x ${m.dim} cells of ${m.cell} px`);
      if (sz === 'normal') await q.screenshot({ path: OUT + `maze-${name}.png` });
      if (sz === 'expert') await q.screenshot({ path: OUT + `maze-${name}-expert.png` });
    }
  }
  await t2.browser.close();

  // ================= 5. English and French =================
  for (const [loc, tag] of [['en-US', 'en'], ['fr-FR', 'fr']]) {
    const t3 = await start(new Map(), { local: true, locale: loc, viewport: { width: 820, height: 1180 } });
    const r = t3.page;
    await r.evaluate(() => (location.hash = '#/games/maze')); await r.waitForSelector('#mz-canvas');
    await r.evaluate(() => window.__maze.load(8, 8, 99, 'prim'));
    const left = () => r.evaluate(() => {
      const bad = [], cjk = /[　-〿一-鿿＀-￯]/, w = document.createTreeWalker(document.querySelector('#gm-stage'), NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) { if (!n.parentElement.closest('[hidden]') && cjk.test(n.nodeValue)) bad.push(n.nodeValue.trim()); }
      for (const e of document.querySelectorAll('#gm-stage [aria-label], #gm-stage [title]')) for (const a of ['aria-label', 'title']) if (e.getAttribute(a) && cjk.test(e.getAttribute(a))) bad.push(e.getAttribute(a));
      return bad;
    });
    // every text the game shows (also after a hint, the answer and a win) is either translated already or in maze.i18n.json
    await r.click('#mz-hint'); await r.click('#mz-answer');
    let bad = await left(); const toast = await r.evaluate(() => [...document.querySelectorAll('.toast, #toast')].map((e) => e.textContent).join(' '));
    const uncovered = [...bad, ...(toast && cjk.test(toast) ? [toast] : [])].filter((s) => !covered(s));
    ok(uncovered.length === 0, `${tag}: every text of the game has a translation (${uncovered.slice(0, 3).join(' | ')})`);
    await r.evaluate(async () => {
      const M = await import('/src/games/maze-logic.ts'), m = window.__maze.maze(), sol = M.solve(m, m.start, m.exit);
      for (let i = 1; i < sol.length; i++) { const d = [m.w * -1, 1, m.w, -1].findIndex((o) => sol[i - 1] + o === sol[i]); document.dispatchEvent(new KeyboardEvent('keydown', { key: ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'][d] })); }
    });
    await r.waitForFunction(() => !document.querySelector('#mz-ovl').hidden, null, { timeout: 4000 });
    bad = await left(); const un2 = bad.filter((s) => !covered(s));
    ok(un2.length === 0, `${tag}: the win overlay is covered by translations`);
    ok(/Maze|Labyrinthe/.test(await r.textContent('.gm-hero h1')) || bad.includes('迷宫'), `${tag}: the title is there`);
    const stageText = await r.textContent('#gm-stage');
    if (tag === 'en' && !/Chinese/.test('')) ok(!cjk.test(stageText) || un2.length === 0, 'en: screen text checked');
    await r.screenshot({ path: OUT + `maze-${tag}.png` });
    // the buttons do not overflow in the other languages on a phone
    await r.setViewportSize({ width: 320, height: 568 }); await r.waitForTimeout(200);
    const ov = await r.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: innerWidth, out: [...document.querySelectorAll('.mz-pad button, .mz-hud span')].filter((b) => { const x = b.getBoundingClientRect(); return x.left < -0.5 || x.right > innerWidth + 0.5; }).length }));
    ok(ov.sw <= ov.vw && ov.out === 0, `${tag}: 320 px phone, nothing sticks out`);
    await r.screenshot({ path: OUT + `maze-${tag}-320.png` });
    ok(t3.log.external.length === 0, `${tag}: no request left the app`);
    await t3.browser.close();
  }

  // ================= 6. leaving, no outside request =================
  const t4 = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  const z = t4.page;
  await z.evaluate(() => (location.hash = '#/games/maze')); await z.waitForSelector('#mz-canvas');
  await z.evaluate(() => (location.hash = '#/subject/games')); await z.waitForSelector('.gm-grid');
  await z.waitForFunction(() => !window.__maze);
  ok(true, 'leaving the game removes it (the hook is gone)');
  await z.keyboard.press('ArrowUp');
  ok(t4.log.external.length === 0 && t.log.external.length === 0 && t2.log.external.length === 0, 'no request left the app');
  await t4.browser.close();
  await done();
})();
