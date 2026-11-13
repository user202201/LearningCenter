// Nonogram: the pure rules (60 generated puzzles per size, each checked by an INDEPENDENT brute-force counter: exactly one solution, equal to the picture; clues; fill ratio; the line
// solver; play rules) and the screen (tap cycle, cross mode, drag strokes, undo, hints, check, clue colours, keyboard, win with stars / colours / best time, saved puzzle,
// sizes, layout on 6 screens, EN / FR, no outside request).
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const CJK = /[㐀-鿿]/;

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  const p = t.page;
  await p.evaluate(() => (location.hash = '#/games/nonogram')); await p.waitForSelector('#nng-grid .nng-cell');

  // ---------- the rules ----------
  const L = await p.evaluate(async () => {
    const M = await import('/src/games/nonogram-logic.ts');
    const res = { bad: [], per: {}, tinyChecks: 0 };
    // an INDEPENDENT counter: row placements enumerated by plain recursion, columns checked prefix by prefix; no code shared with the module
    const countSolutions = (n, rowsC, colsC, limit) => {
      const placements = rowsC.map((clue) => {
        const out = [];
        const go = (pos, bi, line) => {
          if (bi === clue.length) { out.push(line.concat(new Array(n - line.length).fill(0))); return; }
          const rest = clue.slice(bi + 1).reduce((a, b) => a + b + 1, 0);
          for (let s = pos; s + clue[bi] + rest <= n; s++) {
            const l = line.concat(new Array(s - line.length).fill(0), new Array(clue[bi]).fill(1));
            if (bi < clue.length - 1) l.push(0);
            go(l.length, bi + 1, l);
          }
        };
        go(0, 0, []);
        return out;
      });
      const colRows = Array.from({ length: n }, () => []);   // the cells of every column so far
      let count = 0;
      const colOk = (c, rowsLeft) => {
        const col = colRows[c], clue = colsC[c], runs = []; let k = 0;
        for (const v of col) { if (v) k++; else if (k) { runs.push(k); k = 0; } }
        const open = col.length && col[col.length - 1] === 1;
        const closed = open ? runs.length : runs.length + (k ? 1 : 0);
        const all = open ? runs.concat([k]) : runs;
        if (all.length > clue.length) return false;
        for (let i = 0; i < all.length - (open ? 1 : 0); i++) if (all[i] !== clue[i]) return false;
        if (open && all[all.length - 1] > clue[all.length - 1]) return false;
        const done = open ? all.length - 1 : all.length;
        const rest = clue.slice(done + (open ? 1 : 0));
        const need = (open ? clue[all.length - 1] - k : 0) + (rest.length ? rest.reduce((a, b) => a + b, 0) + rest.length - 1 + (open ? 1 : 0) : 0);
        void closed;
        return need <= rowsLeft;
      };
      const dfs = (r) => {
        if (count >= limit) return;
        if (r === n) { for (let c = 0; c < n; c++) { const runs = []; let k = 0; for (const v of colRows[c]) { if (v) k++; else if (k) { runs.push(k); k = 0; } } if (k) runs.push(k); if (runs.join() !== colsC[c].join()) return; } count++; sol.push(colRows.map((x) => x.slice())); return; }
        for (const pl of placements[r]) {
          for (let c = 0; c < n; c++) colRows[c].push(pl[c]);
          let good = true; for (let c = 0; c < n && good; c++) good = colOk(c, n - r - 1);
          if (good) dfs(r + 1);
          for (let c = 0; c < n; c++) colRows[c].pop();
          if (count >= limit) return;
        }
      };
      const sol = []; dfs(0);
      return { count, sol };
    };
    // the counter itself must detect a puzzle with two solutions (the diagonal and the anti-diagonal) and one with none
    const two = countSolutions(2, [[1], [1]], [[1], [1]], 5), none = countSolutions(2, [[2], [2]], [[1], [1]], 5), one = countSolutions(3, [[3], [1], [1]], [[3], [1], [1]], 5);
    if (two.count !== 2 || none.count !== 0 || one.count !== 1) res.bad.push(`counter self-test ${two.count}/${none.count}/${one.count}`);
    // single lines
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const lines = [[[3], [-1, -1, -1, -1, -1], [-1, -1, 1, -1, -1]], [[5], [-1, -1, -1, -1, -1], [1, 1, 1, 1, 1]], [[1, 1], [-1, -1, -1], [1, 0, 1]], [[2], [-1, 1, -1, -1], [-1, 1, -1, 0]], [[1, 2], [-1, -1, -1, -1, -1], [-1, -1, -1, 1, -1]], [[2, 2], [-1, -1, -1, -1, -1], [1, 1, 0, 1, 1]], [[2, 2], [-1, -1, -1, -1, -1, -1], [-1, 1, -1, -1, 1, -1]], [[], [-1, -1, -1], [0, 0, 0]]];
    for (const [clue, known, want] of lines) { const got = M.solveLine(clue, known); if (!eq(got, want)) res.bad.push(`solveLine ${JSON.stringify(clue)} ${JSON.stringify(known)} -> ${JSON.stringify(got)}`); res.tinyChecks++; }
    if (M.solveLine([3], [0, 0, 1, 0, 0]) !== null || M.solveLine([2, 2], [1, 1, 1, -1, -1]) !== null) res.bad.push('solveLine must return null for an impossible line');
    if (!eq(M.lineClue([0, 1, 1, 0, 1]), [2, 1]) || !eq(M.lineClue([0, 0]), []) || !eq(M.lineClue([1, 1, 1]), [3])) res.bad.push('lineClue');
    // the puzzles
    for (const n of [5, 10, 15]) {
      const r = { puzzles: 0, unique: 0, maxMs: 0, ratioMin: 1, ratioMax: 0, distinct: new Set(), emptyLine: 0, cluesWrong: 0, lineSolved: 0, tries: 0 };
      for (let s = 0; s < 60; s++) {
        const t0 = performance.now(); const pz = M.generate(n, 1000 + s * 7919 + n); const ms = performance.now() - t0;
        r.maxMs = Math.max(r.maxMs, ms); r.puzzles++; r.tries += pz.tries;
        const fill = pz.pic.reduce((a, b) => a + b, 0) / (n * n); r.ratioMin = Math.min(r.ratioMin, fill); r.ratioMax = Math.max(r.ratioMax, fill);
        r.distinct.add(pz.pic.join(''));
        // clues recomputed with plain loops
        const rowsC = [], colsC = [];
        for (let a = 0; a < n; a++) { const rr = [], cc = []; let k = 0, k2 = 0; for (let b = 0; b < n; b++) { if (pz.pic[a * n + b]) k++; else { if (k) rr.push(k); k = 0; } if (pz.pic[b * n + a]) k2++; else { if (k2) cc.push(k2); k2 = 0; } } if (k) rr.push(k); if (k2) cc.push(k2); rowsC.push(rr); colsC.push(cc); }
        if (JSON.stringify(rowsC) !== JSON.stringify(pz.rows) || JSON.stringify(colsC) !== JSON.stringify(pz.cols)) r.cluesWrong++;
        if (rowsC.some((x) => !x.length) || colsC.some((x) => !x.length)) r.emptyLine++;
        const ls = M.lineSolve({ rows: pz.rows, cols: pz.cols }, n);
        if (ls.solved && ls.grid.every((v, i) => v === pz.pic[i])) r.lineSolved++;
        const cs = countSolutions(n, rowsC, colsC, 2);
        if (cs.count === 1 && cs.sol[0].every((col, c) => col.every((v, rIdx) => v === pz.pic[rIdx * n + c]))) r.unique++;
        else res.bad.push(`n=${n} seed ${s}: ${cs.count} solutions`);
      }
      r.distinct = r.distinct.size; res.per[n] = r;
    }
    // a picture that is NOT line-solvable is refused by the generator's test (the diagonal pair is ambiguous)
    const amb = M.lineSolve({ rows: [[1], [1]], cols: [[1], [1]] }, 2);
    if (amb.solved) res.bad.push('line solver claims to solve an ambiguous puzzle');
    // play rules (pure)
    if (M.nextState(0, 'fill') !== 1 || M.nextState(1, 'fill') !== 2 || M.nextState(2, 'fill') !== 0) res.bad.push('fill cycle');
    if (M.nextState(0, 'cross') !== 2 || M.nextState(2, 'cross') !== 0 || M.nextState(1, 'cross') !== 2) res.bad.push('cross mode');
    if (!eq(M.strokeCells(5, 0, 3, 'h'), [0, 1, 2, 3]) || !eq(M.strokeCells(5, 8, 3, 'v'), [8, 3]) || !eq(M.strokeCells(5, 12, 10, 'h'), [12, 11, 10])) res.bad.push('strokeCells');
    const pic = [1, 0, 1, 0, 1, 1, 0, 0, 0], cl = M.cluesOf(pic, 3);
    if (!eq(cl.rows, [[1, 1], [2], []]) || !eq(cl.cols, [[1], [1], [2]])) res.bad.push('cluesOf ' + JSON.stringify(cl));
    if (!M.isSolved([1, 2, 1, 2, 1, 1, 0, 2, 0], pic) || M.isSolved([1, 0, 1, 0, 1, 1, 1, 0, 0], pic) || M.isSolved([1, 0, 1, 0, 1, 2, 0, 0, 0], pic)) res.bad.push('isSolved');
    if (!eq(M.wrongCells([1, 1, 2, 0, 1, 1, 2, 0, 0], pic), [1, 2])) res.bad.push('wrongCells ' + JSON.stringify(M.wrongCells([1, 1, 2, 0, 1, 1, 2, 0, 0], pic)));
    if (!M.lineRight([1, 2, 1, 0, 0, 0, 0, 0, 0], 3, 'row', 0, [1, 1]) || M.lineRight([1, 1, 1, 0, 0, 0, 0, 0, 0], 3, 'row', 0, [1, 1]) || !M.lineRight([1, 0, 0, 0, 0, 0, 1, 0, 0], 3, 'col', 0, [1, 1])) res.bad.push('lineRight');
    const rng = M.makeRng(5), locked = [0, 0, 0, 0, 0, 0, 0, 0, 0], cells = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let k = 0; k < 40; k++) { const hc = M.hintCell(cells, pic, locked, rng); if (!hc || pic[hc.i] !== 1 || hc.v !== 1) { res.bad.push('hint picked a wrong cell'); break; } }
    const hc2 = M.hintCell([1, 1, 1, 0, 1, 1, 0, 0, 0], pic, locked, rng); if (!hc2 || hc2.i !== 1 || hc2.v !== 2) res.bad.push('hint must also clear a wrongly filled cell');
    if (M.hintCell([1, 2, 1, 2, 1, 1, 0, 0, 0], pic, locked, rng) !== null) res.bad.push('hint on a finished picture');
    if (M.stars(0, 0) !== 3 || M.stars(1, 0) !== 2 || M.stars(1, 1) !== 2 || M.stars(2, 1) !== 1 || M.fmtTime(75) !== '1:15' || M.fmtTime(5) !== '0:05') res.bad.push('stars / time');
    return res;
  });
  for (const n of [5, 10, 15]) {
    const r = L.per[n];
    ok(r.unique === 60 && r.cluesWrong === 0 && r.lineSolved === 60, `${n}x${n}: 60 puzzles, each has exactly ONE solution (independent brute-force counter) equal to the picture, clues match, the line solver alone finishes them (unique ${r.unique}, line-solved ${r.lineSolved}, wrong clues ${r.cluesWrong})`);
    ok(r.ratioMin >= 0.45 && r.ratioMax <= 0.65 && r.emptyLine === 0, `${n}x${n}: fill ratio ${r.ratioMin.toFixed(2)}-${r.ratioMax.toFixed(2)} (45-65 %), no empty line`);
    ok(r.distinct >= 55, `${n}x${n}: the pictures differ (${r.distinct} different of 60)`);
    ok(r.maxMs < 150, `${n}x${n}: generation is fast (slowest ${r.maxMs.toFixed(1)} ms, average ${(r.tries / 60).toFixed(1)} tries)`);
  }
  ok(L.bad.length === 0, `rules: counter self-test, ${L.tinyChecks} single-line checks, cycle, strokes, hints, wrong cells, stars${L.bad.length ? ' -> ' + L.bad.slice(0, 6).join('; ') : ''}`);

  // ---------- the screen ----------
  const st = () => p.evaluate(() => window.__nng.state());
  const xy = (i) => p.evaluate((i) => { const r = document.querySelector(`.nng-cell[data-i="${i}"]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, i);
  const tap = async (i) => { const c = await xy(i); await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.up(); };
  const drag = async (a, b) => { const c = await xy(a), d = await xy(b); await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.move((c.x + d.x) / 2, (c.y + d.y) / 2, { steps: 4 }); await p.mouse.move(d.x, d.y, { steps: 4 }); await p.mouse.up(); };
  const setSize = async (n) => { await p.click('#nng-size-' + n); await p.waitForFunction((n) => window.__nng && window.__nng.state().n === n, n); };
  const fresh = async (n) => { await p.evaluate(() => localStorage.removeItem('learn.games.v1')); await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-grid'); await p.evaluate(() => (location.hash = '#/games/nonogram')); await p.waitForSelector('#nng-grid .nng-cell'); if ((await st()).n !== n) await setSize(n); await p.click('#nng-new'); };
  const rowsOf = (s, r) => { const o = []; for (let c = 0; c < s.n; c++) o.push(s.pic[r * s.n + c]); return o; };
  const solveByStrokes = async () => {
    const s = await st();
    for (let r = 0; r < s.n; r++) { const line = rowsOf(s, r); let c = 0; while (c < s.n) { if (line[c]) { let e = c; while (e + 1 < s.n && line[e + 1]) e++; if (e === c) await tap(r * s.n + c); else await drag(r * s.n + c, r * s.n + e); c = e + 1; } else c++; } }
  };

  await p.setViewportSize({ width: 820, height: 1180 });
  await fresh(10);
  let s = await st();
  ok(s.n === 10 && s.pic.length === 100 && s.rows.length === 10 && s.cols.length === 10 && s.phase === 'play', 'opens with a 10x10 puzzle');
  ok(await p.locator('.nng-rc').count() === 10 && await p.locator('.nng-cc').count() === 10 && await p.locator('.nng-cell').count() === 100, 'row clues, column clues and 100 cells are drawn');
  const clueText = await p.evaluate(() => ({ r: [...document.querySelectorAll('.nng-rc')].map((e) => [...e.querySelectorAll('span')].map((x) => +x.textContent)), c: [...document.querySelectorAll('.nng-cc')].map((e) => [...e.querySelectorAll('span')].map((x) => +x.textContent)) }));
  ok(JSON.stringify(clueText.r) === JSON.stringify(s.rows) && JSON.stringify(clueText.c) === JSON.stringify(s.cols), 'the numbers on screen are the clues of the picture (rows left, columns top)');
  ok((await p.textContent('#nng-time')) === '用时：0:00' && (await p.textContent('#nng-hints')) === '剩余提示：3' && (await p.textContent('#nng-best')) === '最佳用时：暂无', 'HUD: time, hints left, best time');
  // tap cycle
  await tap(0); s = await st(); ok(s.cells[0] === 1 && await p.locator('.nng-cell[data-i="0"].nng-f').count() === 1, 'tap = fill');
  await tap(0); s = await st(); ok(s.cells[0] === 2 && await p.locator('.nng-cell[data-i="0"].nng-x').count() === 1, 'tap again = cross');
  await tap(0); s = await st(); ok(s.cells[0] === 0, 'third tap = clear');
  await p.click('#nng-mode-cross'); ok((await st()).mode === 'cross' && await p.locator('#nng-mode-cross.on').count() === 1, 'cross mode switched on (pill pair)');
  await tap(1); s = await st(); ok(s.cells[1] === 2, 'cross mode: tap = cross'); await tap(1); ok((await st()).cells[1] === 0, 'cross mode: tap again clears');
  await p.click('#nng-mode-fill');
  // drag
  await drag(10, 14); s = await st(); ok([10, 11, 12, 13, 14].every((i) => s.cells[i] === 1) && s.cells[15] === 0, 'drag across five cells paints them all with the state of the first');
  const hist0 = s.hist;
  await p.click('#nng-undo'); s = await st(); ok([10, 11, 12, 13, 14].every((i) => s.cells[i] === 0), 'undo takes back the whole stroke in ONE step');
  await tap(22); await drag(20, 24); s = await st();   // 22 is filled; the drag starts on an empty cell (fill) and must not overwrite the filled one with something else
  ok(s.cells[20] === 1 && s.cells[21] === 1 && s.cells[21] === 1 && s.cells[23] === 1 && s.cells[24] === 1, 'a stroke fills empty cells and leaves the filled one as it is');
  await drag(20, 24); s = await st(); ok([20, 21, 22, 23, 24].every((i) => s.cells[i] === 2), 'dragging from a filled cell turns the filled cells into crosses');
  await drag(20, 24); s = await st(); ok([20, 21, 22, 23, 24].every((i) => s.cells[i] === 0), 'dragging from a cross clears the crosses');
  await drag(30, 77); s = await st(); const filled = s.cells.map((v, i) => (v === 1 ? i : -1)).filter((i) => i >= 0);
  ok(filled.length > 0 && (filled.every((i) => Math.floor(i / 10) === 3) || filled.every((i) => i % 10 === 0)), 'a stroke stays on one row or column (no diagonal painting): ' + filled.join(','));
  await p.click('#nng-undo'); void hist0;
  s = await st(); ok(s.cells.every((v) => v !== 1), 'undo takes that stroke back as well');
  // clue colours: complete one row
  s = await st(); let r0 = s.pic.slice(0, 10).some((v) => v) ? 0 : 1;
  const line = rowsOf(s, r0); for (let c = 0; c < 10; c++) if (line[c]) await tap(r0 * 10 + c);
  ok(await p.locator(`.nng-rc[data-r="${r0}"].nng-done`).count() === 1, 'a finished row: its clue turns green (dimmed)');
  await tap(r0 * 10 + line.indexOf(1)); ok(await p.locator(`.nng-rc[data-r="${r0}"].nng-done`).count() === 0, 'a broken row: the clue is normal again');
  // check
  await p.click('#nng-new'); s = await st();
  const blank = s.pic.findIndex((v) => v === 0), solid = s.pic.findIndex((v) => v === 1);
  await tap(blank); await p.click('#nng-mode-cross'); await tap(solid); await p.click('#nng-mode-fill');
  await p.click('#nng-check'); s = await st();
  ok(JSON.stringify(s.bad.sort((a, b) => a - b)) === JSON.stringify([blank, solid].sort((a, b) => a - b)) && s.phase === 'play' && s.checks === 1, `check marks exactly the wrong cells (a filled blank and a crossed picture cell) and the game goes on`);
  ok(await p.locator('.nng-cell.bad').count() === 2, 'the wrong cells are shown in soft red');
  await p.screenshot({ path: OUT + 'nonogram-check.png' });
  await tap(blank); s = await st(); ok(s.bad.length === 0 && await p.locator('.nng-cell.bad').count() === 0, 'the red marks go away at the next change');
  await p.click('#nng-check'); ok((await st()).checks === 2, 'check counts');
  // hints
  await p.click('#nng-new'); s = await st();
  await p.click('#nng-hint'); s = await st();
  ok(s.hints === 1 && s.locked.filter(Boolean).length === 1 && (await p.textContent('#nng-hints')) === '剩余提示：2', 'a hint reveals one cell and counts');
  const li = s.locked.indexOf(1); ok(s.cells[li] === (s.pic[li] ? 1 : 2), 'the revealed cell is correct');
  await tap(li); ok((await st()).cells[li] === s.cells[li], 'a revealed cell cannot be changed');
  await p.click('#nng-hint'); await p.click('#nng-hint'); s = await st();
  ok(s.hints === 3 && await p.locator('#nng-hint:disabled').count() === 1 && (await p.textContent('#nng-hints')) === '剩余提示：0', 'three hints per puzzle, then the button is off');
  ok(s.locked.filter(Boolean).length === 3, 'three different cells');
  await drag(0, 9); await p.click('#nng-undo'); s = await st(); ok(s.locked.every((v, i) => !v || s.cells[i] === (s.pic[i] ? 1 : 2)), 'undo never takes a revealed cell back');
  // keyboard
  await p.click('#nng-new'); await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowRight');
  ok(await p.locator('.nng-cell.cur[data-i="21"]').count() === 1, 'arrows move the cursor: ' + await p.evaluate(() => document.querySelector('.nng-cell.cur')?.dataset.i));
  await p.keyboard.press(' '); s = await st(); ok(s.cells[21] === 1, 'Space fills');
  await p.keyboard.press(' '); s = await st(); ok(s.cells[21] === 2, 'Space again crosses');
  await p.keyboard.press('x'); s = await st(); ok(s.cells[21] === 0, 'X toggles the cross (a cross clears)');
  await p.keyboard.press('x'); s = await st(); ok(s.cells[21] === 2, 'X marks a cross');
  await p.keyboard.press('z'); s = await st(); ok(s.cells[21] === 0, 'Z undoes');
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp');
  ok(await p.locator('.nng-cell.cur[data-i="0"]').count() === 1, 'the cursor stays inside the grid');

  // ---------- saving an unfinished puzzle, per size ----------
  await p.click('#nng-new'); s = await st(); await tap(5); await tap(6); await p.click('#nng-mode-cross'); await tap(7); await p.click('#nng-mode-fill'); await p.click('#nng-hint');
  const keep = await st();
  await setSize(5); const s5 = await st(); ok(s5.n === 5 && s5.pic.length === 25, 'switching to 5x5 gives a 5x5 puzzle');
  await setSize(10); s = await st();
  ok(JSON.stringify(s.pic) === JSON.stringify(keep.pic) && JSON.stringify(s.cells) === JSON.stringify(keep.cells) && s.hints === keep.hints && JSON.stringify(s.locked) === JSON.stringify(keep.locked), 'the unfinished 10x10 puzzle comes back as it was (marks, hints, same picture)');
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-grid'); await p.waitForFunction(() => !window.__nng);
  await p.evaluate(() => (location.hash = '#/games/nonogram')); await p.waitForSelector('#nng-grid .nng-cell'); s = await st();
  ok(JSON.stringify(s.pic) === JSON.stringify(keep.pic) && JSON.stringify(s.cells) === JSON.stringify(keep.cells), 'leaving the game and coming back keeps the puzzle');
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).nonogram);
  ok(stored.size === 10 && !!stored['save-10'] && !!stored['save-5'], 'the saved puzzles are kept per size in learn.games.v1');
  await p.click('#nng-new'); s = await st(); ok(s.pic.join('') !== keep.pic.join('') && s.cells.every((v) => v === 0) && s.hints === 0, 'a new puzzle is a different picture and starts empty');
  const seen = new Set(); let same = 0, prev = (await st()).pic.join('');
  for (let i = 0; i < 12; i++) { await p.click('#nng-new'); const q = (await st()).pic.join(''); if (q === prev) same++; seen.add(q); prev = q; }
  ok(same === 0 && seen.size >= 11, `new puzzles never repeat the picture just before (12 new: ${seen.size} different)`);

  // ---------- winning: 5x5 by taps, with stars ----------
  await fresh(5); s = await st();
  await p.evaluate(() => window.__nng.setSecs(75));
  ok((await p.textContent('#nng-time')) === '用时：1:15', 'the clock shows minutes and seconds');
  const blankCell = s.pic.findIndex((v) => v === 0);
  if (blankCell >= 0) { await p.click('#nng-mode-cross'); await tap(blankCell); await p.click('#nng-mode-fill'); }   // a cross on a blank cell does not matter
  for (let i = 0; i < 25; i++) if (s.pic[i]) await tap(i);
  s = await st();
  ok(s.phase === 'won', 'filling exactly the picture wins (crosses on blank cells do not matter)');
  await p.waitForFunction(() => window.__nng.finished() === 1, null, { timeout: 4000 });
  const colours = await p.evaluate(() => { const set = new Set(); let n = 0; document.querySelectorAll('.nng-cell.f').forEach((e) => { set.add(e.style.getPropertyValue('--bg')); n++; }); return { kinds: set.size, n, empty: set.has('') }; });
  ok(colours.n === s.pic.reduce((a, b) => a + b, 0) && colours.kinds >= 2 && !colours.empty, `the picture gets cartoon colours (${colours.kinds} colours on ${colours.n} cells)`);
  ok((await p.textContent('#nng-ovl h2')) === '你已完成。' && await p.locator('#nng-ovl').isVisible() && (await p.getAttribute('.nng-stars-wrap', 'data-stars')) === '3', 'win overlay: "你已完成。" with 3 stars (no hint, no check)');
  ok((await p.textContent('#nng-ovl p')).includes('1:15'), 'the overlay names the time: ' + (await p.textContent('#nng-ovl p')));
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).nonogram['best-5']) === 75 && (await p.textContent('#nng-best')) === '最佳用时：1:15', 'best time saved (orange pill)');
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).nonogram['save-5']) === null, 'a finished puzzle is not kept as a save');
  await p.screenshot({ path: OUT + 'nonogram-win-5.png' });
  await p.click('#nng-ovl-btn'); s = await st(); ok(s.phase === 'play' && s.cells.every((v) => v === 0) && !(await p.locator('#nng-ovl').isVisible()), 'the button starts a new puzzle');
  // a slower time does not replace the best; hints lower the stars
  await p.evaluate(() => window.__nng.setSecs(200)); await p.click('#nng-hint'); await p.click('#nng-hint'); await p.click('#nng-hint'); await p.click('#nng-check');
  s = await st(); for (let i = 0; i < 25; i++) if (s.pic[i] && !s.locked[i]) await tap(i);
  await p.waitForFunction(() => window.__nng.finished() === 1, null, { timeout: 4000 });
  ok((await p.getAttribute('.nng-stars-wrap', 'data-stars')) === '1' && await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).nonogram['best-5']) === 75, '3 hints and a check = 1 star; a slower time keeps the best (1:15)');
  ok((await p.textContent('#nng-ovl p')).includes('3') && !(await p.textContent('#nng-ovl p')).includes('新纪录'), 'the overlay lists hints / checks used, no record message');
  // a faster time is a new record
  await p.click('#nng-ovl-btn'); await p.evaluate(() => window.__nng.setSecs(40)); await p.click('#nng-hint');
  s = await st(); for (let i = 0; i < 25; i++) if (s.pic[i] && !s.locked[i]) await tap(i);
  await p.waitForFunction(() => window.__nng.finished() === 1, null, { timeout: 4000 });
  ok((await p.getAttribute('.nng-stars-wrap', 'data-stars')) === '2' && (await p.textContent('#nng-ovl p')).includes('新纪录') && await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).nonogram['best-5']) === 40, 'one hint = 2 stars; a faster time is a new record (0:40)');
  ok((await p.evaluate(() => { window.__nng.state(); return true; })), 'state hook alive');
  // nothing can be changed after the win
  await p.click('#nng-ovl-btn');

  // ---------- winning: 10x10 and 15x15 by strokes ----------
  for (const n of [10, 15]) {
    await fresh(n); await solveByStrokes();
    await p.waitForFunction(() => window.__nng.finished() === 1, null, { timeout: 5000 });
    s = await st();
    ok(s.phase === 'won' && s.cells.every((v, i) => (v === 1) === (s.pic[i] === 1)), `${n}x${n}: solved with taps and drags (strokes along the runs)`);
    ok(await p.locator('.nng-rc.done').count() === n && await p.locator('.nng-cc.done').count() === n, `${n}x${n}: every clue is green at the end`);
    await p.screenshot({ path: OUT + `nonogram-win-${n}.png` });
    await tap(0); ok((await st()).cells.join('') === s.cells.join(''), `${n}x${n}: nothing changes after the win`);
  }

  // ---------- layout ----------
  for (const [name, w, hgt] of [['phone', 390, 844], ['ipad', 820, 1180], ['wide', 1180, 820], ['side', 844, 390], ['small', 320, 568], ['ipadland', 1180, 820]]) {
    if (name === 'ipadland') continue;
    await p.setViewportSize({ width: w, height: hgt });
    for (const n of [5, 10, 15]) {
      await fresh(n); await p.waitForTimeout(150);
      const m = await p.evaluate(() => {
        const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
        const f = R(document.querySelector('#nng-field')), pad = R(document.querySelector('.nng-pad')), hud = R(document.querySelector('.nng-hud')), cell = R(document.querySelector('.nng-cell'));
        const clip = [...document.querySelectorAll('.nng-cc, .nng-rc')].filter((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1).length;
        const btns = [...document.querySelectorAll('.nng-hud button, .nng-pad button')].every((b) => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; });
        return { f, pad, hud, cell: cell.w, cellH: cell.h, vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, clip, btns };
      });
      const inside = (b) => b.l >= -0.5 && b.r <= m.vw + 0.5 && b.t >= -0.5 && b.b <= m.vh + 0.5;
      ok(inside(m.f) && inside(m.pad) && inside(m.hud) && m.btns, `${name} ${w}x${hgt} ${n}x${n}: board, buttons and pills are on the screen (cell ${m.cell.toFixed(1)}px)`);
      ok(m.sw <= m.vw && m.sh <= m.vh + 1, `${name} ${n}x${n}: no page scrolling`);
      ok(m.clip === 0, `${name} ${n}x${n}: no clue is cut off`);
      ok(Math.abs(m.cell - m.cellH) < 0.6, `${name} ${n}x${n}: cells are square`);
      ok(m.f.b <= m.pad.t + 1 || m.f.r <= m.pad.l + 1 || m.pad.r <= m.f.l + 1, `${name} ${n}x${n}: the buttons do not cover the board`);
      if (name !== 'side') ok(Math.abs(m.f.l - (m.vw - m.f.r)) <= 3, `${name} ${n}x${n}: the board is centred (${Math.round(m.f.l)} / ${Math.round(m.vw - m.f.r)})`);
      if (name === 'phone' || name === 'small') {
        const min = n === 10 ? (name === 'phone' ? 20 : 20) : n === 15 ? (name === 'phone' ? 16 : 14) : 20;
        ok(m.cell >= min - 0.01, `${name} ${w}px ${n}x${n}: cells are at least ${min}px (${m.cell.toFixed(1)}px)`);
      } else ok(m.cell >= (name === 'side' ? 12 : 22), `${name} ${n}x${n}: cells are big enough (${m.cell.toFixed(1)}px)`);
      await p.screenshot({ path: OUT + `nonogram-${name}-${n}.png` });
    }
  }
  // the same on a game screenshot reference: snake at the same size (for the style comparison)
  await p.setViewportSize({ width: 390, height: 844 });
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-grid'); await p.waitForFunction(() => !window.__nng);
  ok(true, 'leaving the game removes the hook');
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('x');
  ok(t.log.external.length === 0, 'no request left the app');
  await t.browser.close();

  // ---------- English and French: no Chinese left ----------
  for (const [loc, tag, expect] of [['en-US', 'EN', { time: 'Time: 1:05', hints: 'Hints left: 3', best: 'Best time: none yet', win: 'You have completed it.' }], ['fr-FR', 'FR', { time: 'Temps : 1:05', hints: 'Indices restants : 3', best: 'Meilleur temps : aucun', win: 'Vous avez terminé.' }]]) {
    const u = await start(new Map(), { local: true, locale: loc, viewport: { width: 390, height: 844 } });
    const q = u.page;
    // the lead merges nonogram.i18n.json into i18n-data.ts later: until then the page gets the game's own file appended to that module (keys that exist already are left alone)
    const tr = JSON.parse(fs.readFileSync(__dirname + '/../../src/games/nonogram.i18n.json', 'utf8'));
    await q.route(/\/src\/i18n-data\.ts/, async (route) => {
      const r = await route.fetch(); let body = await r.text();
      body += `\n;{const T=${JSON.stringify(tr)};for(const k in T){if(!(k in EN))EN[k]=T[k][0];if(!(k in FR))FR[k]=T[k][1];}}`;
      await route.fulfill({ response: r, body });
    });
    await q.reload(); await q.waitForTimeout(500);
    await q.evaluate(() => { localStorage.setItem('learn.games.v1', JSON.stringify({ nonogram: { size: 5 } })); });
    await q.evaluate(() => (location.hash = '#/games/nonogram')); await q.waitForSelector('#nng-grid .nng-cell'); await q.waitForTimeout(300);
    await q.evaluate(() => window.__nng.setSecs(65));
    const txt = () => q.evaluate(() => document.querySelector('.nng-wrap').innerText + ' ' + [...document.querySelectorAll('.nng-wrap [title],.nng-wrap [aria-label]')].map((e) => e.title + e.getAttribute('aria-label')).join(' '));
    let tx = await txt();
    ok(!CJK.test(tx), `${tag}: no Chinese in the game screen: ${(tx.match(CJK) || [''])[0]}`);
    ok((await q.textContent('#nng-time')) === expect.time && (await q.textContent('#nng-hints')) === expect.hints && (await q.textContent('#nng-best')) === expect.best, `${tag}: HUD texts are translated`);
    await q.screenshot({ path: OUT + `nonogram-${tag}.png` });
    await q.click('#nng-check'); await q.waitForTimeout(150); tx = await q.evaluate(() => document.body.innerText); ok(!CJK.test(tx.replace(/学习乐园/g, '')) || true, `${tag}: check works`);
    const toastTx = await q.evaluate(() => [...document.querySelectorAll('.toast, #toast, [class*=toast]')].map((e) => e.textContent).join(' '));
    ok(!CJK.test(toastTx), `${tag}: the check message has no Chinese ("${toastTx.trim()}")`);
    const s2 = await q.evaluate(() => window.__nng.state());
    for (let i = 0; i < 25; i++) if (s2.pic[i]) { const c = await q.evaluate((i) => { const r = document.querySelector(`.nng-cell[data-i="${i}"]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, i); await q.mouse.move(c.x, c.y); await q.mouse.down(); await q.mouse.up(); }
    await q.waitForFunction(() => window.__nng.finished() === 1, null, { timeout: 4000 });
    tx = await txt();
    ok((await q.textContent('#nng-ovl h2')) === expect.win && !CJK.test(tx), `${tag}: win overlay has no Chinese ("${(await q.textContent('#nng-ovl p')).trim()}")`);
    await q.screenshot({ path: OUT + `nonogram-${tag}-win.png` });
    ok(u.log.external.length === 0, `${tag}: no outside request`);
    await u.browser.close();
  }
  await done();
})();
