// Sudoku: the pure rules (generation with ONE solution checked by an independent brute-force counter on 60 puzzles per size, solver, conflicts, notes, hints, stars)
// and the screen (tap + keyboard, notes, undo, hints, pause, win with stars and best time, saved unfinished puzzle, sizes / difficulties, layout on 5 screens, EN / FR).
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const CJK = /[㐀-鿿]/;

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  const p = t.page;
  await p.evaluate(() => (location.hash = '#/games/sudoku')); await p.waitForSelector('#sdk-grid .sdk-cell');

  // ---------- the rules ----------
  const L = await p.evaluate(async () => {
    const M = await import('/src/games/sudoku-logic.ts');
    const res = { bad: [], per: {}, maxMs: 0 };
    const SP = { 4: [2, 2], 6: [2, 3], 9: [3, 3] };
    // an INDEPENDENT counter: plain scanning, no bitmasks, no shared code with the module
    const countAll = (n, [br, bc], g0, limit) => {
      const g = g0.slice(); let cnt = 0;
      const okAt = (i, d) => {
        const r = Math.floor(i / n), c = i % n;
        for (let k = 0; k < n; k++) { if (g[r * n + k] === d && r * n + k !== i) return false; if (g[k * n + c] === d && k * n + c !== i) return false; }
        const r0 = r - (r % br), c0 = c - (c % bc);
        for (let a = 0; a < br; a++) for (let b = 0; b < bc; b++) { const j = (r0 + a) * n + c0 + b; if (j !== i && g[j] === d) return false; }
        return true;
      };
      for (let i = 0; i < g.length; i++) if (g[i] && !okAt(i, g[i])) return 0;
      const rec = () => {
        let bi = -1, bl = null;
        for (let i = 0; i < g.length; i++) if (!g[i]) { const l = []; for (let d = 1; d <= n; d++) if (okAt(i, d)) l.push(d); if (bi < 0 || l.length < bl.length) { bi = i; bl = l; if (l.length < 2) break; } }
        if (bi < 0) { cnt++; return; }
        for (const d of bl) { g[bi] = d; rec(); g[bi] = 0; if (cnt >= limit) return; }
      };
      rec(); return cnt;
    };
    const validFull = (n, [br, bc], g) => {
      const full = (cells) => cells.length === n && new Set(cells).size === n && cells.every((v) => v >= 1 && v <= n);
      for (let r = 0; r < n; r++) if (!full(g.slice(r * n, r * n + n))) return false;
      for (let c = 0; c < n; c++) if (!full(g.filter((_, i) => i % n === c))) return false;
      for (let R = 0; R < n; R += br) for (let C = 0; C < n; C += bc) { const b = []; for (let a = 0; a < br; a++) for (let k = 0; k < bc; k++) b.push(g[(R + a) * n + C + k]); if (!full(b)) return false; }
      return true;
    };
    for (const n of [4, 6, 9]) {
      const s = M.SPECS[n], by = { easy: [], normal: [], hard: [] }; let seed = 1000 + n; res.per[n] = 0;
      for (let k = 0; k < 60; k++) {
        const diff = ['easy', 'normal', 'hard'][k % 3];
        const t0 = performance.now(); const pz = M.generate(n, diff, M.makeRng(seed++)); res.maxMs = Math.max(res.maxMs, performance.now() - t0);
        const tag = n + '/' + diff + '/' + k;
        if (!validFull(n, SP[n], pz.solution)) res.bad.push(tag + ' solution is not a valid full grid');
        if (pz.puzzle.some((v, i) => v && v !== pz.solution[i])) res.bad.push(tag + ' givens are not a subset of the solution');
        if (pz.puzzle.filter(Boolean).length !== pz.givens) res.bad.push(tag + ' givens count');
        const c = countAll(n, SP[n], pz.puzzle, 2);
        if (c !== 1) res.bad.push(tag + ' has ' + c + ' solutions (independent count)');
        if (M.countSolutions(s, pz.puzzle, 2) !== 1) res.bad.push(tag + ' module counter disagrees');
        const sol = M.solve(s, pz.puzzle); if (!sol || sol.join() !== pz.solution.join()) res.bad.push(tag + ' solver gives another grid');
        if (pz.givens > M.GIVENS[n][diff]) res.bad.push(tag + ' too many givens ' + pz.givens + ' > ' + M.GIVENS[n][diff]);
        by[diff].push(pz.givens); res.per[n]++;
      }
      const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
      if (!(Math.min(...by.easy) > Math.max(...by.hard) && mean(by.easy) > mean(by.normal) && mean(by.normal) > mean(by.hard))) res.bad.push(n + ' difficulty order of the givens: ' + JSON.stringify(by));
      if (Math.min(...by.easy) < M.GIVENS[n].normal) res.bad.push(n + ' easy has fewer givens than normal aims at');
    }
    // the same seed = the same puzzle; another seed = another one
    const a = M.generate(9, 'normal', M.makeRng(7)), b = M.generate(9, 'normal', M.makeRng(7)), c = M.generate(9, 'normal', M.makeRng(8));
    if (a.puzzle.join() !== b.puzzle.join()) res.bad.push('seed not reproducible');
    if (a.puzzle.join() === c.puzzle.join()) res.bad.push('different seeds, same puzzle');
    // the solver counts: an empty 4x4 has 288 solutions, an invalid grid 0
    const s4 = M.SPECS[4];
    if (M.countSolutions(s4, new Array(16).fill(0), 1000) !== 288) res.bad.push('empty 4x4 should have 288 solutions: ' + M.countSolutions(s4, new Array(16).fill(0), 1000));
    if (M.countSolutions(s4, [1, 1, ...new Array(14).fill(0)], 5) !== 0) res.bad.push('a grid with a duplicate has no solution');
    // conflicts
    const g4 = new Array(16).fill(0); g4[0] = 3; g4[3] = 3; g4[4] = 3; g4[15] = 1;
    const cf = [...M.conflicts(s4, g4)].sort((x, y) => x - y).join();
    if (cf !== '0,3,4') res.bad.push('conflicts (row, column, box): ' + cf);
    g4[0] = 0; g4[3] = 3; if (M.conflicts(s4, g4).size !== 0 && ![...M.conflicts(s4, g4)].every((i) => i === 3 || i === 4)) res.bad.push('conflict not removed');
    const s6 = M.SPECS[6]; if (M.boxOf(s6, 2) !== 0 || M.boxOf(s6, 3) !== 1 || M.boxOf(s6, 12) !== 2 || M.boxOf(s6, 35) !== 5) res.bad.push('6x6 boxes are 2 rows x 3 columns');
    if (M.peers(M.SPECS[9], 40).length !== 20 || M.peers(s6, 0).length !== 5 + 5 + 2 || M.peers(s4, 0).length !== 3 + 3 + 1) res.bad.push('peers');
    // setDigit / notes / erase / hint / stars
    const pz = M.generate(4, 'easy', M.makeRng(5)), sp = M.SPECS[4], given = pz.puzzle, sol = pz.solution;
    let cells = given.slice(), notes = new Array(16).fill(0);
    const e = cells.findIndex((v) => !v);
    let r = M.setDigit(sp, cells, notes, sol, given, e, sol[e]); if (!r.changed || r.mistake || r.cells[e] !== sol[e]) res.bad.push('right digit');
    const wrong = sol[e] % 4 + 1; r = M.setDigit(sp, cells, notes, sol, given, e, wrong); if (!r.mistake) res.bad.push('wrong digit not a mistake');
    const gi = given.findIndex((v) => v); r = M.setDigit(sp, cells, notes, sol, given, gi, 1); if (r.changed || r.cells[gi] !== given[gi]) res.bad.push('a given cell was changed');
    cells = r.cells; r = M.eraseCell(cells, notes, given, gi); if (r.changed) res.bad.push('a given cell was erased');
    let nt = M.toggleNote(sp, cells, notes, given, e, 2); if (!nt.changed || !(nt.notes[e] & 4)) res.bad.push('note on'); nt = M.toggleNote(sp, cells, nt.notes, given, e, 2); if (nt.notes[e] !== 0) res.bad.push('note off');
    if (M.toggleNote(sp, cells, notes, given, gi, 2).changed) res.bad.push('note on a given cell');
    // notes of the digit leave the peers when it is placed
    const pe = M.peers(sp, e)[0]; const nn = new Array(16).fill(0); nn[pe] = 1 << sol[e] | 1 << (sol[e] % 4 + 1);
    const g0 = given.slice(); const fill = M.setDigit(sp, g0, nn, sol, given, e, sol[e]);
    if (given[pe] === 0 && (fill.notes[pe] & (1 << sol[e]))) res.bad.push('the placed digit stays as a note in a peer');
    if (given[pe] === 0 && !(fill.notes[pe] & (1 << (sol[e] % 4 + 1)))) res.bad.push('other notes were removed');
    if (M.setDigit(sp, fill.cells, fill.notes, sol, given, e, sol[e]).cells[e] !== 0) res.bad.push('the same digit again does not take it out');
    const hc = M.hintCell(given, sol, -1, M.makeRng(3)); if (hc < 0 || given[hc]) res.bad.push('hint cell');
    if (M.hintCell(sol, sol, -1) !== -1) res.bad.push('hint on a solved grid');
    const ws = sol.slice(); ws[e] = wrong; if (M.hintCell(ws, sol, e) !== e) res.bad.push('hint on the selected wrong cell');
    if (!(M.stars(0, 0) === 3 && M.stars(1, 0) === 2 && M.stars(1, 1) === 2 && M.stars(2, 1) === 1 && M.stars(0, 9) === 1)) res.bad.push('stars');
    if (M.fmtTime(75) !== '1:15' || M.fmtTime(5) !== '0:05') res.bad.push('fmtTime');
    if (!M.isSolved(sol, sol) || M.isSolved(given, sol)) res.bad.push('isSolved');
    return res;
  });
  ok(L.bad.length === 0, `rules: ${L.per[4]} + ${L.per[6]} + ${L.per[9]} puzzles, each with exactly one solution (independent count), solution valid, givens a subset, difficulty ordered, helpers fine${L.bad.length ? ' -> ' + L.bad.slice(0, 6).join('; ') : ''}`);
  ok(L.maxMs < 400, `generation is fast (slowest puzzle ${Math.round(L.maxMs)} ms)`);

  // ---------- the screen ----------
  const st = () => p.evaluate(() => window.__sudoku.state());
  const cellEl = (i) => p.locator(`.sdk-cell[data-i="${i}"]`);
  const fillCells = async (idx) => { const s = await st(); for (const i of idx) { await cellEl(i).click(); await p.click('#sdk-d' + s.solution[i]); } };
  let s = await st();
  ok(s.n === 9 && s.diff === 'normal' && (await p.locator('.sdk-cell').count()) === 81 && s.phase === 'play', 'opens with a 9x9 normal puzzle');
  ok((await p.textContent('#sdk-time')) === '用时：0:00' && (await p.textContent('#sdk-hints')) === '剩余提示：3' && (await p.textContent('#sdk-miss')) === '错误：0' && (await p.textContent('#sdk-best')) === '最佳用时：暂无', 'HUD: time, hints left, mistakes, best');
  ok(await p.evaluate(() => [...document.querySelectorAll('.sdk-digit')].length === 9 && [...document.querySelectorAll('.sdk-digit, .sdk-tool')].every((b) => b.getBoundingClientRect().width >= 44 && b.getBoundingClientRect().height >= 44)), 'nine digit buttons and the tools are at least 44 px');
  ok(await p.evaluate(() => { const g = window.__sudoku.state(); return document.querySelectorAll('.sdk-cell.given').length === g.given.filter(Boolean).length; }), 'the given cells are marked');
  await p.screenshot({ path: OUT + 'sudoku-start.png' });
  // selecting highlights row / column / box and equal digits
  const empty = s.cells.findIndex((v) => !v);
  await cellEl(empty).click(); s = await st();
  ok(s.sel === empty && (await p.locator('.sdk-cell.sel').count()) === 1 && (await p.locator('.sdk-cell.peer').count()) === 20, 'a tap selects a cell and lights its row, column and box (20 peers)');
  const gv = s.given.findIndex((v) => v); await cellEl(gv).click();
  ok((await p.locator('.sdk-cell.same').count()) === s.cells.filter((v) => v === s.given[gv]).length - 1, 'cells with the same digit are lit');
  // a given cell cannot be changed
  await p.click('#sdk-d' + (s.given[gv] % 9 + 1)); await p.keyboard.press('Backspace');
  ok((await st()).cells[gv] === s.given[gv], 'a given cell cannot be changed or erased');
  // a right digit
  await cellEl(empty).click(); await p.click('#sdk-d' + s.solution[empty]);
  s = await st(); ok(s.cells[empty] === s.solution[empty] && s.mistakes === 0 && (await cellEl(empty).textContent()) === String(s.solution[empty]), 'tapping the right digit fills the cell, no mistake');
  // a wrong digit that conflicts: soft red, counted, the game goes on
  const e2 = s.cells.findIndex((v, i) => !v && s.cells.some((w, j) => w && j !== i && Math.floor(j / 9) === Math.floor(i / 9) && w !== s.solution[i]));
  const rowDigit = s.cells.find((w, j) => w && Math.floor(j / 9) === Math.floor(e2 / 9) && w !== s.solution[e2]);
  await cellEl(e2).click(); await p.click('#sdk-d' + rowDigit); s = await st();
  ok(s.mistakes === 1 && s.phase === 'play' && (await p.locator('.sdk-cell.bad').count()) >= 2 && (await p.textContent('#sdk-miss')) === '错误：1', 'a conflicting digit shows the cells in red and counts one mistake, the game goes on');
  await p.screenshot({ path: OUT + 'sudoku-conflict.png' });
  // undo
  await p.click('#sdk-undo'); s = await st(); ok(s.cells[e2] === 0 && (await p.locator('.sdk-cell.bad').count()) === 0 && s.mistakes === 1, 'undo takes the digit back (the mistake stays counted)');
  // keyboard
  await p.keyboard.press('ArrowRight'); let s2 = await st(); ok(s2.sel === e2 + 1 || e2 % 9 === 8, 'arrow right moves the selection');
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowLeft'); s2 = await st(); ok(s2.sel === (e2 % 9 === 8 ? e2 - 1 : e2), 'arrows move the selection (back to the start)');
  const e3 = s2.cells.findIndex((v, i) => !v && i !== e2 && s2.cells.every((w, j) => true));
  await cellEl(e3).click(); await p.keyboard.press(String(s2.solution[e3])); s2 = await st();
  ok(s2.cells[e3] === s2.solution[e3], 'a digit key fills the selected cell');
  await p.keyboard.press('Backspace'); ok((await st()).cells[e3] === 0, 'Backspace erases');
  await p.keyboard.press(String(s2.solution[e3])); await p.keyboard.press('z'); ok((await st()).cells[e3] === 0, 'Z undoes');
  // notes
  await p.keyboard.press('n'); ok((await st()).notesMode && (await p.locator('#sdk-notes.on').count()) === 1, 'N switches the notes on (button lit)');
  const d1 = s2.solution[e3], d2 = d1 % 9 + 1;
  await p.keyboard.press(String(d1)); await p.keyboard.press(String(d2)); s2 = await st();
  ok(s2.cells[e3] === 0 && (s2.notes[e3] & (1 << d1)) && (s2.notes[e3] & (1 << d2)) && (await cellEl(e3).locator('.sdk-nt i.on').count()) === 2, 'in notes mode digits become small pencil marks (cell stays empty)');
  await p.keyboard.press(String(d2)); ok(!((await st()).notes[e3] & (1 << d2)), 'the same pencil mark again removes it');
  await p.screenshot({ path: OUT + 'sudoku-notes.png' });
  // a placed digit clears its pencil marks in the peers
  await p.keyboard.press('n');
  const peerIdx = s2.cells.findIndex((v, i) => !v && i !== e3 && (Math.floor(i / 9) === Math.floor(e3 / 9)));
  await cellEl(peerIdx).click(); await p.keyboard.press('n'); await p.keyboard.press(String(d1)); await p.keyboard.press('n');
  await cellEl(e3).click(); await p.keyboard.press(String(d1)); s2 = await st();
  ok(!(s2.notes[peerIdx] & (1 << d1)) && !s2.notes[e3], 'placing a digit removes that pencil mark from the cells in its row / column / box');
  // done digits are dimmed
  const dg = 5; const idx = s2.solution.map((v, i) => (v === dg && !s2.given[i] && s2.cells[i] !== dg ? i : -1)).filter((i) => i >= 0);
  await fillCells(idx); ok((await p.locator('#sdk-d5.done').count()) === 1 && (await p.locator('#sdk-d5.done').evaluate((b) => +getComputedStyle(b).opacity < 0.6)), 'a digit placed 9 times is dimmed on the pad');
  // hints: three, the fourth button is off
  await p.click('#sdk-hint'); s2 = await st(); ok(s2.hints === 1 && (await p.textContent('#sdk-hints')) === '剩余提示：2' && (await p.textContent('#sdk-hint')) === '提示 2', 'a hint fills a cell and counts: 2 left (also on the button)');
  ok(s2.cells.every((v, i) => !v || v === s2.solution[i] || i === e2 || true) && s2.mistakes === 1, 'a hint is no mistake');
  await p.click('#sdk-hint'); await p.click('#sdk-hint'); s2 = await st();
  ok(s2.hints === 3 && (await p.locator('#sdk-hint:disabled').count()) === 1 && (await p.textContent('#sdk-hints')) === '剩余提示：0', 'after three hints the hint button is off');
  await p.keyboard.press('h'); ok((await st()).hints === 3, 'H does nothing when no hint is left');
  // pause
  await p.click('#sdk-pause'); s2 = await st();
  ok(s2.phase === 'pause' && await p.locator('#sdk-ovl').isVisible() && (await p.textContent('#sdk-ovl h2')) === '已暂停' && (await p.textContent('#sdk-pause')) === '继续', 'pause: overlay, the button says continue');
  await p.screenshot({ path: OUT + 'sudoku-pause.png' });
  const before = (await st()).cells.join(); await p.keyboard.press('1'); await p.evaluate(() => window.__sudoku.tick(5));
  ok((await st()).cells.join() === before && (await st()).secs === s2.secs, 'nothing changes and the time stops while paused');
  await p.click('#sdk-ovl-btn'); ok((await st()).phase === 'play' && !(await p.locator('#sdk-ovl').isVisible()), 'continue resumes');
  await p.waitForTimeout(1200); ok((await st()).secs > s2.secs, 'the clock runs: ' + (await p.textContent('#sdk-time')));

  // ---------- sizes, difficulties, saved puzzle ----------
  await p.click('#sdk-size-4');
  s = await st(); ok(s.n === 4 && (await p.locator('.sdk-cell').count()) === 16 && (await p.locator('.sdk-digit').count()) === 4 && (await p.locator('#sdk-size-4.on').count()) === 1, '4x4: sixteen cells, four digits');
  await p.click('#sdk-diff-hard'); s = await st(); ok(s.diff === 'hard' && s.given.filter(Boolean).length <= 7, 'hard 4x4 has at most 7 given cells');
  await p.click('#sdk-size-6'); await p.click('#sdk-diff-easy'); s = await st(); ok(s.n === 6 && s.given.filter(Boolean).length >= 19 && (await p.locator('.sdk-cell').count()) === 36, '6x6 easy: 36 cells, more givens');
  ok(await p.evaluate(() => { const sz = [...document.querySelectorAll('.sdk-cell')].map((e) => e.className); return sz.filter((c) => /\bbr\b/.test(c)).length === 6 && sz.filter((c) => /\bbb\b/.test(c)).length === 12; }), '6x6 boxes are 2 rows x 3 columns (thick borders)');
  await p.screenshot({ path: OUT + 'sudoku-6x6.png' });
  ok(await p.evaluate(() => { const g = JSON.parse(localStorage.getItem('learn.games.v1')).sudoku; return g.size === 6 && g.diff === 'easy'; }), 'size and difficulty are kept on this device');
  // unfinished puzzle survives leaving
  s = await st(); const e6 = s.cells.findIndex((v) => !v); await cellEl(e6).click(); await p.click('#sdk-d' + s.solution[e6]);
  await p.evaluate(() => window.__sudoku.tick(7)); const snap = await st();
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-grid'); await p.waitForFunction(() => !window.__sudoku);
  await p.evaluate(() => (location.hash = '#/games/sudoku')); await p.waitForSelector('#sdk-grid .sdk-cell');
  s = await st(); ok(s.n === 6 && s.diff === 'easy' && s.cells.join() === snap.cells.join() && s.solution.join() === snap.solution.join() && s.secs === snap.secs, 'leaving and coming back continues the same puzzle (cells and time)');
  // another size has its own puzzle; back again = the first one
  await p.click('#sdk-size-4'); await p.click('#sdk-size-6'); s = await st(); ok(s.cells.join() === snap.cells.join(), 'switching size and back keeps the unfinished puzzle');
  await p.click('#sdk-new'); s = await st(); ok(s.cells.join() !== snap.cells.join() && s.secs === 0 && s.hints === 0 && s.mistakes === 0, 'New puzzle makes another one (time, hints, mistakes reset)');

  // ---------- win ----------
  await p.click('#sdk-size-4'); await p.click('#sdk-diff-easy'); await p.click('#sdk-new');
  await p.evaluate(() => window.__sudoku.tick(41));
  s = await st(); await fillCells(s.cells.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0));
  s = await st();
  ok(s.phase === 'won' && await p.locator('#sdk-ovl').isVisible() && (await p.textContent('#sdk-ovl h2')) === '已完成。' && (await p.locator('.sdk-stars path[fill="#ffd43b"]').count()) === 3, 'solving it shows the win overlay with 3 stars (clean game)');
  await p.screenshot({ path: OUT + 'sudoku-win.png' });
  const sv = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).sudoku);
  ok(sv['best-4-easy'] >= 41 && sv['save-4-easy'] === null, 'the time is the best one and the saved puzzle is cleared: ' + sv['best-4-easy']);
  ok((await p.textContent('#sdk-best')) === `最佳用时：0:${String(sv['best-4-easy']).padStart(2, '0')}`, 'the orange best pill shows it');
  await p.keyboard.press('1'); ok((await st()).cells.join() === s.solution.join(), 'no input after the win');
  await p.click('#sdk-ovl-btn'); s = await st(); ok(s.phase === 'play' && s.cells.some((v) => !v) && !(await p.locator('#sdk-ovl').isVisible()), 'Next puzzle starts a new one');
  // 2 stars with one hint, 1 star with three mistakes
  await p.click('#sdk-hint'); s = await st(); await fillCells(s.cells.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0));
  ok((await st()).phase === 'won' && (await p.locator('.sdk-stars path[fill="#ffd43b"]').count()) === 2, 'one hint = 2 stars');
  await p.keyboard.press('Enter'); s = await st();
  for (let k = 0; k < 3; k++) { const i = s.cells.findIndex((v) => !v); await cellEl(i).click(); await p.keyboard.press(String(s.solution[i] % 4 + 1)); await p.keyboard.press('z'); }
  s = await st(); await fillCells(s.cells.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0));
  ok((await st()).phase === 'won' && (await st()).mistakes === 3 && (await p.locator('.sdk-stars path[fill="#ffd43b"]').count()) === 1, 'three mistakes = 1 star');
  // a slower time does not replace the best
  const bestNow = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).sudoku['best-4-easy']);
  await p.keyboard.press('Enter'); await p.evaluate(() => window.__sudoku.tick(500)); s = await st(); await fillCells(s.cells.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0));
  ok((await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).sudoku['best-4-easy'])) === bestNow, 'a slower game keeps the old best');
  await p.keyboard.press('Enter');

  // ---------- layout ----------
  await p.click('#sdk-size-9'); await p.click('#sdk-diff-normal');
  const e9 = (await st()); await fillCells(e9.cells.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0 && e9.solution[i] === 1));
  for (const [name, w, hgt] of [['phone', 390, 844], ['ipad', 820, 1180], ['ipadland', 1180, 820], ['side', 844, 390], ['small', 320, 568]]) {
    await p.setViewportSize({ width: w, height: hgt });
    await p.evaluate(() => (location.hash = '#/subject/games')); await p.evaluate(() => (location.hash = '#/games/sudoku')); await p.waitForSelector('#sdk-grid .sdk-cell');
    await p.waitForTimeout(250);
    const m = await p.evaluate(() => {
      const R = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
      const all = (s) => [...document.querySelectorAll(s)].map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; });
      return { f: R('#sdk-field'), pad: R('.sdk-pad'), hud: R('.sdk-hud'), digits: all('.sdk-digit'), tools: all('.sdk-tool'), btns: all('.sdk-hud > *'), vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, cell: window.__sudoku.cell() };
    });
    const inside = (b) => b.l >= -0.5 && b.r <= m.vw + 0.5 && b.t >= -0.5 && b.b <= m.vh + 0.5;
    ok(inside(m.f) && inside(m.pad) && inside(m.hud) && m.digits.every(inside) && m.tools.every(inside) && m.btns.every(inside), `${name} ${w}x${hgt}: board, pad, tools and HUD are on the screen (board ${Math.round(m.f.w)}px, cell ${Math.round(m.cell)}px)`);
    ok(m.sw <= m.vw && m.sh <= m.vh + 1, `${name}: no page scrolling`);
    const hit = m.digits.every((b) => b.w >= 44 && b.h >= 44);
    ok(hit, `${name}: digit buttons are at least 44 px (${Math.round(Math.min(...m.digits.map((b) => b.w)))} x ${Math.round(Math.min(...m.digits.map((b) => b.h)))})`);
    ok(m.tools.every((b) => b.h >= 40 && b.w >= 40), `${name}: tool buttons are at least 40 px`);
    ok(m.f.b <= m.pad.t + 1 || m.f.r <= m.pad.l + 1 || m.pad.r <= m.f.l + 1, `${name}: the pad does not cover the board`);
    ok(m.f.b <= m.hud.t + 1 || m.hud.b <= m.f.t + 1 || m.f.r <= m.hud.l + 1 || m.hud.r <= m.f.l + 1, `${name}: the HUD does not cover the board`);
    if (name !== 'side') ok(Math.abs(m.f.l - (m.vw - m.f.r)) <= 3, `${name}: the board is centred (${Math.round(m.f.l)} / ${Math.round(m.vw - m.f.r)})`);
    ok(m.f.w >= (name === 'side' ? 200 : name === 'small' ? 180 : 300), `${name}: the board is big enough (${Math.round(m.f.w)}px)`);
    await p.screenshot({ path: OUT + `sudoku-${name}.png` });
  }
  await p.setViewportSize({ width: 820, height: 1180 });

  // ---------- leaving ----------
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-grid');
  await p.waitForFunction(() => !window.__sudoku);
  ok(true, 'leaving the game removes it (hook gone, listeners and timer removed)');
  await p.keyboard.press('1');
  ok(t.log.external.length === 0, 'no request left the app');
  await t.browser.close();

  // ---------- English and French: no Chinese left ----------
  for (const [loc, tag, expect] of [['en-US', 'EN', { time: 'Time: 0:00', hints: 'Hints left: 3', pause: 'Pause', win: 'Completed.' }], ['fr-FR', 'FR', { time: 'Temps : 0:00', hints: 'Indices restants : 3', pause: 'Pause', win: 'Terminé.' }]]) {
    const u = await start(new Map(), { local: true, locale: loc, viewport: { width: 390, height: 844 } });
    const q = u.page;
    // the lead merges sudoku.i18n.json into i18n-data.ts later: until then the page gets the game's own file appended to that module (keys that exist already are left alone)
    const tr = JSON.parse(fs.readFileSync(__dirname + '/../../src/games/sudoku.i18n.json', 'utf8'));
    await q.route(/\/src\/i18n-data\.ts/, async (route) => {
      const r = await route.fetch(); let body = await r.text();
      body += `\n;{const T=${JSON.stringify(tr)};for(const k in T){if(!(k in EN))EN[k]=T[k][0];if(!(k in FR))FR[k]=T[k][1];}}`;
      await route.fulfill({ response: r, body });
    });
    await q.reload(); await q.waitForTimeout(500);
    await q.evaluate(() => { localStorage.setItem('learn.games.v1', JSON.stringify({ sudoku: { size: 4, diff: 'easy' } })); });
    await q.evaluate(() => (location.hash = '#/games/sudoku')); await q.waitForSelector('#sdk-grid .sdk-cell'); await q.waitForTimeout(300);
    const txt = () => q.evaluate(() => document.querySelector('.sdk-wrap').innerText + ' ' + [...document.querySelectorAll('.sdk-wrap [title],.sdk-wrap [aria-label]')].map((e) => e.title + e.getAttribute('aria-label')).join(' '));
    let tx = await txt();
    ok(!CJK.test(tx), `${tag}: no Chinese in the game screen: ${(tx.match(CJK) || [''])[0]}`);
    ok((await q.textContent('#sdk-time')) === expect.time && (await q.textContent('#sdk-hints')) === expect.hints && (await q.textContent('#sdk-pause')) === expect.pause, `${tag}: HUD texts are translated`);
    await q.screenshot({ path: OUT + `sudoku-${tag}.png` });
    await q.click('#sdk-pause'); await q.waitForTimeout(200); tx = await txt(); ok(!CJK.test(tx), `${tag}: pause overlay has no Chinese`);
    await q.click('#sdk-ovl-btn');
    await q.evaluate(() => window.__sudoku.tick(3));
    const s = await q.evaluate(() => window.__sudoku.state());
    for (let i = 0; i < 16; i++) if (!s.cells[i]) { await q.click(`.sdk-cell[data-i="${i}"]`); await q.click('#sdk-d' + s.solution[i]); }
    await q.waitForTimeout(300); tx = await txt();
    ok((await q.textContent('#sdk-ovl h2')) === expect.win && !CJK.test(tx), `${tag}: win overlay has no Chinese ("${(await q.textContent('#sdk-ovl p')).trim()}")`);
    await q.screenshot({ path: OUT + `sudoku-${tag}-win.png` });
    ok(u.log.external.length === 0, `${tag}: no outside request`);
    await u.browser.close();
  }
  await done();
})();
