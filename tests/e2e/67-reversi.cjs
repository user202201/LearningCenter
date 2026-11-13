// Reversi (黑白棋): the pure rules against an independent naive implementation (thousands of random positions, full random games, perft 1-6 of the standard start),
// the computer (always legal, corner bias of easy, hard beats easy, the time cap of hard), the screen (tap, flips, hints, last move, undo, keyboard, pass of either side,
// the end, 6x6, both colours, best score), layout on four sizes, EN / FR, no outside request.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const KEY = 'learn.games.v1';
const CJK = /[　-〿一-鿿＀-￯]/;

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  const p = t.page;
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.evaluate(() => (location.hash = '#/games/reversi')); await p.waitForSelector('#rv-board .rv-cell');

  // ---------- the rules ----------
  const L = await p.evaluate(async () => {
    const R = await import('/src/games/reversi-logic.ts');
    const res = { bad: [], positions: 0, games: 0, moves: 0, passes: 0, ends: 0, rand: 0 };
    let seed = 20261113; const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    // the independent naive implementation: walks every direction with coordinates
    const DX = [-1, 0, 1, -1, 1, -1, 0, 1], DY = [-1, -1, -1, 0, 0, 1, 1, 1];
    const naiveFlips = (g, n, x, y, c) => {
      if (g[y][x] !== 0) return null;
      const out = [];
      for (let d = 0; d < 8; d++) {
        const line = []; let a = x + DX[d], b = y + DY[d];
        while (a >= 0 && b >= 0 && a < n && b < n && g[b][a] === 3 - c) { line.push(b * n + a); a += DX[d]; b += DY[d]; }
        if (line.length && a >= 0 && b >= 0 && a < n && b < n && g[b][a] === c) out.push(...line);
      }
      return out.length ? out : null;
    };
    const toGrid = (b, n) => { const g = []; for (let y = 0; y < n; y++) g.push(Array.from(b.slice(y * n, y * n + n))); return g; };
    const naiveMoves = (b, n, c) => { const g = toGrid(b, n), m = []; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (naiveFlips(g, n, x, y, c)) m.push(y * n + x); return m; };
    const naivePerft = (g, n, c, d) => { if (d === 0) return 1; let t = 0; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const f = naiveFlips(g, n, x, y, c); if (!f) continue; const g2 = g.map((r) => r.slice()); g2[y][x] = c; for (const i of f) g2[(i / n) | 0][i % n] = c; t += naivePerft(g2, n, 3 - c, d - 1); } return t; };
    const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
    const compare = (b, n, tag) => {
      res.positions++;
      const g = toGrid(b, n);
      for (const c of [1, 2]) {
        const a = R.legalMoves(b, n, c), nm = naiveMoves(b, n, c);
        if (!same(a, nm)) res.bad.push(`${tag}: legal moves differ for ${c}: ${a} vs ${nm}`);
        if (R.hasMove(b, n, c) !== (nm.length > 0)) res.bad.push(tag + ': hasMove');
        for (let i = 0; i < n * n; i++) {
          const f = R.flipsAt(b, n, i, c), nf = naiveFlips(g, n, i % n, (i / n) | 0, c);
          if (!same(f.slice().sort((x, y) => x - y), (nf || []).slice().sort((x, y) => x - y))) res.bad.push(`${tag}: flips differ at ${i} for ${c}`);
          if (R.isLegal(b, n, i, c) !== !!nf) res.bad.push(tag + ': isLegal at ' + i);
        }
      }
      if (res.bad.length > 5) throw new Error(res.bad.join(' | '));
    };
    // (a) perft of the standard start: known values, and the naive one agrees (also on 6x6)
    const known = [4, 12, 56, 244, 1396, 8200], got = [];
    for (let d = 1; d <= 6; d++) got.push(R.perft(R.newBoard(8), 8, 1, d));
    if (!same(got, known)) res.bad.push('perft 8x8: ' + got);
    const g6 = toGrid(R.newBoard(6), 6);
    for (let d = 1; d <= 4; d++) { const a = R.perft(R.newBoard(6), 6, 1, d), b = naivePerft(g6, 6, 1, d); if (a !== b) res.bad.push(`perft 6x6 depth ${d}: ${a} vs naive ${b}`); }
    res.perft = got.join(',');
    // (b) the starting positions
    for (const n of [8, 6]) { const b = R.newBoard(n), k = R.counts(b), m = n / 2; if (k.black !== 2 || k.white !== 2 || b[(m - 1) * n + m - 1] !== 2 || b[(m - 1) * n + m] !== 1 || b[m * n + m - 1] !== 1 || b[m * n + m] !== 2) res.bad.push('start ' + n); }
    // (c) full random games, both sizes: every move adds exactly one disc and flips exactly the bracketed lines; the game ends only when neither side can move
    for (let g = 0; g < 400; g++) {
      const n = g % 2 ? 6 : 8, b = R.newBoard(n); let c = 1; res.games++;
      for (let ply = 0; ply < 80; ply++) {
        if (ply % 3 === 0) compare(b, n, `g${g}p${ply}`);
        const nm = naiveMoves(b, n, c);
        if (!nm.length) {
          const other = naiveMoves(b, n, 3 - c);
          if (!other.length) { if (!R.isOver(b, n) || R.nextToMove(b, n, c) !== 0 || R.nextToMove(b, n, 3 - c) !== 0) res.bad.push('end not detected'); res.ends++; break; }
          if (R.isOver(b, n) || R.nextToMove(b, n, 3 - c) !== 3 - c) res.bad.push('pass not detected'); res.passes++;
          c = 3 - c; continue;
        }
        if (R.isOver(b, n)) res.bad.push('isOver while a move exists');
        const m = nm[Math.floor(rng() * nm.length)], before = R.counts(b), g0 = toGrid(b, n), nf = naiveFlips(g0, n, m % n, (m / n) | 0, c);
        const snap = Int8Array.from(b);
        const f = R.applyMove(b, n, m, c), after = R.counts(b);
        res.moves++;
        if (!same(f.slice().sort((x, y) => x - y), nf.slice().sort((x, y) => x - y))) res.bad.push('applyMove flips');
        const mine = c === 1 ? 'black' : 'white', his = c === 1 ? 'white' : 'black';
        if (after.black + after.white !== before.black + before.white + 1 || after[mine] !== before[mine] + 1 + f.length || after[his] !== before[his] - f.length) res.bad.push('disc counts not conserved');
        for (let i = 0; i < b.length; i++) { const should = i === m || f.includes(i) ? c : snap[i]; if (b[i] !== should) { res.bad.push('a square other than the move / its flips changed'); break; } }
        const nx = R.nextToMove(b, n, c); if (nx !== (naiveMoves(b, n, 3 - c).length ? 3 - c : naiveMoves(b, n, c).length ? c : 0)) res.bad.push('nextToMove');
        c = 3 - c;
        if (res.bad.length > 5) break;
      }
      if (R.counts(b).black + R.counts(b).white !== R.counts(b).black + R.counts(b).white || R.counts(b).empty < 0) res.bad.push('count');
      // undo restores
    }
    // (d) illegal moves do nothing
    { const b = R.newBoard(8), s = Int8Array.from(b); if (R.applyMove(b, 8, 0, 1).length || !same(Array.from(b), Array.from(s)) || R.applyMove(b, 8, 27, 1).length) res.bad.push('illegal move changed the board'); }
    // (e) undoMove is the exact inverse
    { const b = R.newBoard(8); const s = Int8Array.from(b); const m = R.legalMoves(b, 8, 1)[0], f = R.applyMove(b, 8, m, 1); R.undoMove(b, m, 1, f); if (!same(Array.from(b), Array.from(s))) res.bad.push('undoMove'); }
    // (f) random scattered positions (not reachable by play: the move generator must still agree)
    for (let k = 0; k < 1500; k++) { const n = k % 2 ? 6 : 8, b = new Int8Array(n * n), fill = 0.15 + rng() * 0.8; for (let i = 0; i < b.length; i++) b[i] = rng() < fill ? 1 + (rng() < 0.5 ? 0 : 1) : 0; compare(b, n, 'rand' + k); res.rand++; }
    // (g) the winner follows the counts
    { const b = new Int8Array(64).fill(1); b[0] = 2; if (R.winner(b) !== 1) res.bad.push('winner black'); b.fill(2); b[0] = 1; if (R.winner(b) !== 2) res.bad.push('winner white'); const d = new Int8Array(64); d.fill(1, 0, 32); d.fill(2, 32); if (R.winner(d) !== 0) res.bad.push('draw'); }
    return res;
  });
  ok(L.bad.length === 0, `rules: ${L.positions} positions compared with a naive implementation (legal moves, flips, isLegal), ${L.games} random games / ${L.moves} moves / ${L.passes} passes / ${L.ends} ends, discs conserved${L.bad.length ? ' -> ' + L.bad.slice(0, 5).join('; ') : ''}`);
  ok(L.positions > 3000 && L.passes > 5 && L.ends > 100, `the fuzz really covered passes and ends (${L.positions} positions, ${L.passes} passes, ${L.ends} ended games)`);
  ok(L.perft === '4,12,56,244,1396,8200', 'perft of the standard start, depth 1-6: ' + L.perft);

  // ---------- the computer ----------
  const A = await p.evaluate(async () => {
    const R = await import('/src/games/reversi-logic.ts');
    const res = { bad: [], n: 0, cornerPicks: 0, cornerTries: 0, tally: {}, hardMax: 0, hardDepth: [], capped: 0 };
    let seed = 777; const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    // positions reached by random play
    const positions = [];
    for (let g = 0; g < 60; g++) { const n = g % 2 ? 6 : 8, b = R.newBoard(n); let c = 1; const stop = 2 + Math.floor(rng() * (n * n - 8)); for (let k = 0; k < stop; k++) { const ms = R.legalMoves(b, n, c); if (!ms.length) { c = 3 - c; if (!R.legalMoves(b, n, c).length) break; continue; } R.applyMove(b, n, ms[Math.floor(rng() * ms.length)], c); c = 3 - c; } if (R.legalMoves(b, n, c).length) positions.push({ b, n, c }); }
    for (const { b, n, c } of positions) for (const lv of ['easy', 'normal', 'hard']) {
      const legal = R.legalMoves(b, n, c), snap = Array.from(b);
      const m = R.chooseMove(b, n, c, lv, { rng, timeMs: 30 }); res.n++;
      if (!legal.includes(m)) res.bad.push(`${lv} played ${m}, not in ${legal}`);
      if (snap.join() !== Array.from(b).join()) res.bad.push(lv + ' changed the board');
    }
    { const b = R.newBoard(8); b.fill(1); if (R.chooseMove(b, 8, 2, 'hard') !== -1 || R.chooseMove(b, 8, 2, 'easy') !== -1) res.bad.push('no move should give -1'); }
    // easy prefers a corner when one is open
    { const b = new Int8Array(64); b[1] = 2; b[2] = 1; b[8] = 2; b[16] = 1; b[27] = 2; b[28] = 1; b[35] = 1; b[36] = 2; // black can take the corner 0 (row and column) or others
      const legal = R.legalMoves(b, 8, 1); if (!legal.includes(0) || legal.length < 4) res.bad.push('corner test position (' + legal + ')');
      for (let k = 0; k < 400; k++) { res.cornerTries++; if (R.chooseMove(b, 8, 1, 'easy', { rng: Math.random }) === 0) res.cornerPicks++; } }
    // whole games
    const play = (n, black, white, s) => {
      let sd = s; const r = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
      const b = R.newBoard(n); let c = 1, over = 0;
      for (let k = 0; k < 200; k++) {
        const m = R.chooseMove(b, n, c, c === 1 ? black : white, { rng: r, timeMs: 40, maxDepth: 4 });
        if (m < 0) { if (R.isOver(b, n)) break; c = 3 - c; continue; }
        if (!R.legalMoves(b, n, c).includes(m)) { res.bad.push('illegal move in a game'); break; }
        R.applyMove(b, n, m, c); c = 3 - c;
      }
      if (!R.isOver(b, n)) res.bad.push('game did not end'); const k = R.counts(b); return k.black - k.white;
    };
    let hw = 0, hl = 0, hd = 0, hn = 0, nn = 0, ne = 0, total = 0, tn = 0;
    for (let s = 1; s <= 6; s++) { const n = s % 3 === 0 ? 6 : 8; const a = play(n, 'hard', 'easy', s * 11), b2 = -play(n, 'easy', 'hard', s * 13); total++; if (a > 0) hw++; else if (a < 0) hl++; if (b2 > 0) hw++; else if (b2 < 0) hl++; total++; hd += a + b2; }
    res.tally.hardVsEasy = { w: hw, l: hl, games: total, discDiff: hd };
    let nw = 0, nl = 0; for (let s = 1; s <= 4; s++) { const a = play(8, 'normal', 'easy', s * 7), b2 = -play(8, 'easy', 'normal', s * 5); if (a > 0) nw++; else if (a < 0) nl++; if (b2 > 0) nw++; else if (b2 < 0) nl++; }
    res.tally.normalVsEasy = { w: nw, l: nl };
    let hn2 = 0, nh = 0, dsum = 0; for (let s = 1; s <= 3; s++) { const a = play(8, 'hard', 'normal', s * 3), b2 = -play(8, 'normal', 'hard', s * 9); dsum += a + b2; if (a > 0) hn2++; if (b2 > 0) hn2++; if (a < 0) nh++; if (b2 < 0) nh++; }
    res.tally.hardVsNormal = { hardWins: hn2, normalWins: nh, discDiff: dsum };
    // the time cap of hard (default 600 ms): mid-game positions of both sizes
    for (const { b, n, c } of positions.slice(0, 24)) { const t0 = performance.now(); R.chooseMove(b, n, c, 'hard'); const ms = performance.now() - t0; res.hardMax = Math.max(res.hardMax, ms); res.hardDepth.push(R.lastInfo.depth); if (R.lastInfo.depth < 1) res.bad.push('hard returned without a finished depth'); }
    // a short cap is respected too
    { const b = R.newBoard(8); const t0 = performance.now(); R.chooseMove(b, 8, 1, 'hard', { timeMs: 50, maxDepth: 12 }); res.short = performance.now() - t0; }
    // deeper = stronger information: hard reaches at least depth 4 in the opening
    { const b = R.newBoard(8); R.chooseMove(b, 8, 1, 'hard'); res.openDepth = R.lastInfo.depth; }
    return res;
  });
  ok(A.bad.length === 0, `the computer (${A.n} moves, easy / normal / hard, 6x6 and 8x8): always a legal move, never touches the board, -1 without a move, every game ends${A.bad.length ? ' -> ' + A.bad.slice(0, 4).join('; ') : ''}`);
  ok(A.cornerPicks / A.cornerTries > 0.5, `easy takes an open corner most of the time (${A.cornerPicks} of ${A.cornerTries})`);
  const he = A.tally.hardVsEasy;
  ok(he.w >= he.games - 1 && he.discDiff > 0, `hard beats easy over ${he.games} seeded games (both colours, 6x6 and 8x8): ${he.w} won, ${he.l} lost, disc difference ${he.discDiff}`);
  ok(A.tally.normalVsEasy.w > A.tally.normalVsEasy.l, `normal beats easy: ${JSON.stringify(A.tally.normalVsEasy)}`);
  ok(A.tally.hardVsNormal.discDiff > 0, `hard is not weaker than normal: ${JSON.stringify(A.tally.hardVsNormal)}`);
  ok(A.hardMax <= 600 + 200, `hard answers within the time cap: slowest ${Math.round(A.hardMax)} ms (cap 600), depths ${A.hardDepth.slice(0, 12).join(',')}`);
  ok(A.short <= 50 + 150, `a cap of 50 ms is respected (${Math.round(A.short)} ms)`);
  ok(A.openDepth >= 4, `hard searches at least 4 plies in the opening (${A.openDepth})`);

  // ---------- the screen ----------
  const st = () => p.evaluate(() => window.__reversi.state());
  const domBoard = () => p.evaluate(() => [...document.querySelectorAll('#rv-board .rv-cell')].map((c) => Number(c.dataset.c)));
  const center = async (i) => { const r = await p.locator(`#rv-board .rv-cell[data-i="${i}"]`).boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
  const tapCell = async (i) => { const c = await center(i); await p.mouse.click(c.x, c.y); };
  const myTurn = () => p.waitForFunction(() => { const s = window.__reversi.state(); return s.turn === s.human && !s.thinking || s.over; }, null, { timeout: 8000 });
  const text = (s) => p.textContent(s);
  // the pass note is only on screen for about a second: a recorder sees it even when the test is slow
  const watchNote = (page) => page.evaluate(() => { window.__notes = []; const el = document.querySelector('#rv-note'); new MutationObserver(() => { if (!el.hidden && el.textContent) window.__notes.push(el.textContent); }).observe(el, { attributes: true, childList: true, characterData: true, subtree: true }); });
  const noteSeen = (page, ms = 6000) => page.waitForFunction(() => window.__notes && window.__notes.length > 0, null, { timeout: ms }).then(() => page.evaluate(() => window.__notes[0]));
  const setSide = async (want) => { const s = await st(); if (s.human !== want) await p.click('#rv-side'); };
  const setLevel = async (lv) => { for (let k = 0; k < 3 && (await st()).level !== lv; k++) await p.click('#rv-level'); };
  const setSize = async (n) => { if ((await st()).n !== n) await p.click('#rv-size'); };
  await p.evaluate((k) => localStorage.removeItem(k), KEY); await p.reload(); await p.waitForSelector('#rv-board .rv-cell');

  let s0 = await st();
  ok(s0.n === 8 && s0.human === 1 && s0.level === 'normal' && (await p.locator('#rv-board .rv-cell').count()) === 64, 'opens on 8x8, I am black, normal level, 64 cells');
  ok((await p.locator('.rv-disc').count()) === 4 && (await p.locator('.rv-disc[data-c="1"]').count()) === 2 && (await p.locator('.rv-disc[data-c="2"]').count()) === 2, 'four discs at the start, two of each colour');
  ok((await text('#rv-you')) === '你：2' && (await text('#rv-cpu')) === '电脑：2' && (await text('#rv-turn')) === '轮到你。' && (await text('#rv-best')) === '最高：0', 'score pills 你：2 / 电脑：2, "轮到你。", best 0');
  ok((await p.locator('.rv-cell.legal').count()) === 4 && (await p.locator('.rv-disc svg.rv-face').count()) === 4, 'four legal-move dots and a face on every disc');
  await p.screenshot({ path: OUT + 'reversi-start-ipad.png' });
  // an illegal tap does nothing
  await tapCell(0);
  ok((await p.locator('.rv-disc').count()) === 4 && (await st()).turn === 1, 'tapping an illegal square does nothing');
  await tapCell(27);
  ok((await p.locator('.rv-disc').count()) === 4, 'tapping a disc does nothing');
  // a legal move: the flips appear at once (animation is off in tests: the logic does not wait for it)
  const legal0 = await p.evaluate(async () => { const R = await import('/src/games/reversi-logic.ts'); const b = Int8Array.from(window.__reversi.state().board); const m = R.legalMoves(b, 8, 1)[0]; return { m, f: R.flipsAt(b, 8, m, 1), all: R.legalMoves(b, 8, 1) }; });
  ok(legal0.all.join() === '19,26,37,44', 'the four first moves of black: ' + legal0.all);
  await tapCell(legal0.m);
  let d = await domBoard();
  ok(d[legal0.m] === 1 && legal0.f.every((i) => d[i] === 1) && d.filter((x) => x === 1).length === 4, 'a tap on a legal square puts a black disc and flips the bracketed disc at once');
  ok((await p.locator('.rv-disc.flip').count()) === legal0.f.length, 'the flipped discs carry the flip animation class (' + legal0.f.length + ')');
  ok((await text('#rv-turn')) === '电脑思考中…', 'then the computer is thinking');
  await tapCell(legal0.all[1]);
  ok((await st()).hist === 1, 'taps while the computer thinks are ignored');
  await myTurn();
  s0 = await st(); d = await domBoard();
  ok(JSON.stringify(d) === JSON.stringify(s0.board) && s0.board.filter((x) => x).length === 6, 'the computer answered with one disc; the screen equals the state (6 discs)');
  ok((await p.locator('.rv-cell.last').count()) === 1 && s0.board[s0.last] === 2, 'the last-move marker sits on the computer\'s disc');
  ok((await text('#rv-you')).startsWith('你：') && Number((await text('#rv-you')).slice(2)) + Number((await text('#rv-cpu')).slice(3)) === 6, 'the two score pills add up to the discs on the board');
  await p.screenshot({ path: OUT + 'reversi-play-ipad.png' });
  // hints toggle
  const hintsOn = await p.locator('.rv-cell.legal').count();
  await p.click('#rv-hints');
  ok(hintsOn > 0 && (await p.locator('.rv-cell.legal').count()) === 0 && (await text('#rv-hints')) === '提示：关', 'the hint switch removes the dots');
  await p.click('#rv-hints');
  ok((await p.locator('.rv-cell.legal').count()) === hintsOn, 'and brings them back');
  // undo takes back my move and the computer's reply
  await p.click('#rv-undo'); s0 = await st();
  ok(s0.board.filter((x) => x).length === 4 && s0.turn === 1 && s0.hist === 0 && await p.locator('#rv-undo').isDisabled(), 'undo takes back my move and the reply; then undo is off');
  // keyboard
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowDown');
  ok((await p.locator('.rv-cell.cur').count()) === 1, 'arrow keys show the cursor');
  const cursor = await p.evaluate(() => Number(document.querySelector('.rv-cell.cur').dataset.i));
  for (let k = 0; k < 20; k++) { const c = await p.evaluate(() => Number(document.querySelector('.rv-cell.cur').dataset.i)); if (c === 19) break; await p.keyboard.press(c % 8 > 3 ? 'ArrowLeft' : c % 8 < 3 ? 'ArrowRight' : c / 8 > 2 ? 'ArrowUp' : 'ArrowDown'); }
  ok((await p.evaluate(() => Number(document.querySelector('.rv-cell.cur').dataset.i))) === 19, 'the cursor walks to square 19 (from ' + cursor + ')');
  await p.keyboard.press('Enter');
  ok((await domBoard())[19] === 1, 'Enter plays at the cursor');
  await myTurn(); await p.keyboard.press('z');
  ok((await st()).hist === 0 && (await domBoard()).filter((x) => x).length === 4, 'Z undoes');
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft');
  await p.keyboard.press('Space');
  ok((await domBoard()).filter((x) => x).length === 4 || (await st()).hist === 1, 'Space on an illegal square is refused or plays');

  // ---------- a pass of the computer: after my move it has nothing to play, I move again ----------
  await p.click('#rv-new');
  const PASS = (() => { const g = new Array(64).fill(0); g[0] = 1; g[1] = 2; g[24] = 1; g[25] = 2; g[63] = 2; return g.join(''); })();
  await p.evaluate((c) => window.__reversi.setup(c, 1), PASS);
  ok((await p.locator('.rv-cell.legal').count()) === 2, 'constructed position: black has two moves');
  await watchNote(p);
  await tapCell(2);
  ok((await noteSeen(p)) === '无子可下，本方跳过。', 'the pass is announced: "无子可下，本方跳过。"');
  await p.screenshot({ path: OUT + 'reversi-pass-ipad.png' });
  await p.waitForFunction(() => document.querySelector('#rv-note').hidden, null, { timeout: 4000 });
  s0 = await st();
  ok(s0.turn === 1 && !s0.over && !s0.thinking && (await text('#rv-turn')) === '轮到你。', 'after the pass it is my turn again (the computer did not move)');
  await tapCell(26);
  await p.waitForSelector('#rv-ovl:not([hidden])');
  ok((await text('#rv-ovl h2')) === '你赢了。' && (await text('#rv-ovl p')) === '最终比分：你 6，电脑 1。', 'the game ends when neither side can move: "你赢了。", final count 6 : 1');
  ok((await text('#rv-turn')) === '对局结束。' && (await p.locator('.rv-cell.legal').count()) === 0, 'no hints and "对局结束。" at the end');
  await p.screenshot({ path: OUT + 'reversi-win-ipad.png' });
  const best1 = await p.evaluate((k) => JSON.parse(localStorage.getItem(k)).reversi['best-8-normal'], KEY);
  ok(best1 === 5 && (await text('#rv-best')) === '最高：5', 'the best margin (5) is kept in learn.games.v1 and shown in the orange pill');
  const n1 = (await st()).board.join(); await tapCell(40);
  ok((await st()).board.join() === n1, 'after the end no disc can be placed');
  await p.click('#rv-again');
  ok(!(await st()).over && (await domBoard()).filter((x) => x).length === 4 && await p.locator('#rv-ovl').isHidden(), 'the button starts a new game');
  // a draw and a loss
  await p.evaluate(() => window.__reversi.setup('1'.repeat(32) + '2'.repeat(32), 1));
  await p.waitForSelector('#rv-ovl:not([hidden])');
  ok((await text('#rv-ovl h2')) === '平局。', 'equal counts: "平局。"');
  await p.evaluate(() => window.__reversi.setup('2'.repeat(40) + '1'.repeat(24), 1));
  await p.waitForSelector('#rv-ovl:not([hidden])');
  ok((await text('#rv-ovl h2')) === '电脑获胜。', 'fewer discs: "电脑获胜。"');
  await p.click('#rv-again');

  // ---------- I am white: the computer opens; a pass of mine is played automatically ----------
  await setSide(2); await p.waitForFunction(() => { const s = window.__reversi.state(); return s.board.filter((x) => x).length === 5; }, null, { timeout: 5000 });
  s0 = await st();
  ok(s0.human === 2 && s0.board.filter((x) => x === 1).length === 4 && s0.turn === 2 && (await text('#rv-side')) === '执白后手', 'as white: the computer (black) opened with one disc and I am to move');
  ok(s0.hist === 0 && await p.locator('#rv-undo').isDisabled(), 'undo is off: the computer\'s opening move stays');
  ok((await text('#rv-you')) === '你：1' && (await text('#rv-cpu')) === '电脑：4', 'my pill counts white (1), the computer\'s black (4)');
  await watchNote(p);
  await p.evaluate((c) => window.__reversi.setup(c, 1), PASS);   // the computer is black and to move; after its move I (white) have nothing
  ok((await noteSeen(p)) === '无子可下，本方跳过。', 'my pass is announced');
  await p.waitForFunction(() => { const s = window.__reversi.state(); return s.over; }, null, { timeout: 8000 });
  ok((await text('#rv-ovl h2')) === '电脑获胜。' || (await text('#rv-ovl h2')) === '你赢了。', 'the computer went on playing for me and the game ended: ' + (await text('#rv-ovl h2')));
  const fin = await st(); const k = { b: fin.board.filter((x) => x === 1).length, w: fin.board.filter((x) => x === 2).length };
  ok(k.b > k.w && (await text('#rv-ovl h2')) === '电脑获胜。', `final: black ${k.b}, white ${k.w}`);
  await p.screenshot({ path: OUT + 'reversi-lose-ipad.png' });
  await p.click('#rv-again'); await setSide(1);

  // ---------- 6x6, levels ----------
  await setSize(6);
  s0 = await st();
  ok(s0.n === 6 && (await p.locator('#rv-board .rv-cell').count()) === 36 && (await p.locator('.rv-disc').count()) === 4 && (await text('#rv-size')) === '棋盘：6×6', '6x6: 36 cells, 4 discs');
  ok((await p.locator('.rv-cell.legal').count()) === 4, '6x6: four legal moves at the start');
  await setLevel('easy'); ok((await text('#rv-level')) === '难度：简单', 'level button: easy');
  await setLevel('hard'); ok((await text('#rv-level')) === '难度：困难', 'level button: hard');
  // a whole 6x6 game against hard by tapping the first legal move each time; the game must end by the rules
  let guard = 0;
  while (!(await st()).over && guard++ < 60) {
    await myTurn(); if ((await st()).over) break;
    const mv = await p.evaluate(() => { const c = document.querySelector('.rv-cell.legal'); return c ? Number(c.dataset.i) : -1; });
    if (mv < 0) { await p.waitForTimeout(300); continue; }
    await tapCell(mv);
  }
  const e6 = await st();
  ok(e6.over && (await p.locator('#rv-ovl').isVisible() || await p.waitForSelector('#rv-ovl:not([hidden])').then(() => true)), `a whole 6x6 game against hard played by tapping to the end (${guard} rounds)`);
  const cnt = await p.evaluate(async () => { const R = await import('/src/games/reversi-logic.ts'); const b = Int8Array.from(window.__reversi.state().board); return { over: R.isOver(b, 6), k: R.counts(b), you: document.querySelector('#rv-you').textContent, cpu: document.querySelector('#rv-cpu').textContent }; });
  ok(cnt.over && cnt.you === `你：${cnt.k.black}` && cnt.cpu === `电脑：${cnt.k.white}`, 'the end is a real end by the rules and the pills show the final count: ' + cnt.you + ' ' + cnt.cpu);
  await p.screenshot({ path: OUT + 'reversi-6x6-end-ipad.png' });
  await p.click('#rv-again'); await setLevel('normal'); await setSize(8);
  const settings = await p.evaluate((k) => JSON.parse(localStorage.getItem(k)).reversi, KEY);
  ok(settings.size === 8 && settings.level === 'normal' && settings.human === 1 && settings.hints === true, 'size, level, side and hints are remembered on this device: ' + JSON.stringify(settings).slice(0, 120));
  // setting changes restart the game
  await tapCell(19); await p.click('#rv-level'); await p.click('#rv-level'); await p.click('#rv-level');
  ok((await domBoard()).filter((x) => x).length === 4, 'changing a setting starts a new game');

  // ---------- layout ----------
  for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['small', { width: 320, height: 568 }], ['ipad', { width: 820, height: 1180 }], ['landscape', { width: 1180, height: 820 }], ['sideways', { width: 844, height: 390 }]]) {
    await p.setViewportSize(vp);
    await p.evaluate(() => (location.hash = '#/subject/games')); await p.evaluate(() => (location.hash = '#/games/reversi'));
    await p.waitForSelector('#rv-board .rv-cell'); await p.waitForTimeout(350);
    await myTurn();
    const m = await p.evaluate(() => {
      const f = document.querySelector('#rv-field').getBoundingClientRect(), bs = [...document.querySelectorAll('.rv-opts button')].map((x) => x.getBoundingClientRect()), pills = [...document.querySelectorAll('.rv-stat')];
      const cell = document.querySelector('.rv-cell').getBoundingClientRect();
      return { l: f.left, r: innerWidth - f.right, w: f.width, h: f.height, top: f.top, bot: f.bottom, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight, btns: bs.every((x) => x.bottom <= innerHeight + 1 && x.top >= 0 && x.left >= 0 && x.right <= innerWidth), minBtn: Math.min(...bs.map((x) => x.height)), cut: pills.filter((q) => q.scrollWidth > q.clientWidth + 1).length, cell: cell.width, discs: [...document.querySelectorAll('.rv-disc')].every((d) => { const a = d.getBoundingClientRect(), c = d.parentElement.getBoundingClientRect(); return a.left >= c.left && a.right <= c.right + 0.5 && a.top >= c.top && a.bottom <= c.bottom + 0.5; }) };
    });
    ok(m.sw <= m.iw && m.sh <= m.ih + 1 && m.btns && m.top >= 0 && m.bot <= m.ih + 1 && m.cut === 0, `${name}: no overflow, no page scrolling, every button inside the screen, no cut-off pill`);
    ok(Math.abs(m.l - m.r) <= 3 && Math.abs(m.w - m.h) <= 1, `${name}: the square board has equal space left and right (${Math.round(m.l)} | ${Math.round(m.r)}, ${Math.round(m.w)} px)`);
    ok(m.cell >= (vp.height < 400 ? 28 : 34) && m.discs, `${name}: cells big enough for a finger (${m.cell.toFixed(1)} px) and every disc inside its cell`);
    ok(m.minBtn >= (vp.height < 400 ? 30 : 36), `${name}: buttons are big enough (${Math.round(m.minBtn)} px)`);
    // tap works at this size
    const lg = await p.evaluate(() => Number(document.querySelector('.rv-cell.legal').dataset.i)); await tapCell(lg);
    ok((await domBoard()).filter((x) => x).length >= 5, `${name}: a tap on a cell plays`);
    await myTurn();
    await p.screenshot({ path: OUT + `reversi-play-${name}.png` });
  }
  ok(errors.length === 0, 'no script errors' + (errors.length ? ': ' + errors.join('; ') : ''));
  ok(t.log.external.length === 0, 'OFFLINE: no request left the app: ' + t.log.external.join(', '));
  ok((await p.evaluate(() => { location.hash = '#/subject/games'; return true; })) && await p.waitForFunction(() => !window.__reversi).then(() => true), 'leaving the game removes it (hook and key listener gone)');
  await t.browser.close();

  // ---------- EN and FR: nothing Chinese left ----------
  const J = JSON.parse(fs.readFileSync('src/games/reversi.i18n.json', 'utf8'));
  ok(Object.keys(J).every((k) => k.length > 1 && Array.isArray(J[k]) && J[k].length === 2 && J[k][0] && J[k][1] && !CJK.test(J[k][0] + J[k][1])), 'reversi.i18n.json: every key has more than one character and a clean EN and FR text');
  const src = fs.readFileSync('src/games/reversi.ts', 'utf8') + fs.readFileSync('src/games/reversi-logic.ts', 'utf8');
  const used = new Set((src.match(/"[^"\n]*[一-鿿][^"\n]*"|`[^`\n]*[一-鿿][^`\n]*`/g) || []).map((x) => x.slice(1, -1).replace(/\$\{[^}]*\}/g, '{#}')));
  const keys = Object.keys(J).map((k) => k.replace(/\{\d\}/g, '{#}'));
  const lacking = [...used].filter((u) => !keys.includes(u));
  ok(lacking.length === 0, 'every Chinese text in the game code has a translation entry' + (lacking.length ? ' -> missing: ' + lacking.join(' | ') : ''));
  const idx = fs.readFileSync('src/games/index.ts', 'utf8'); const nm = /id: "reversi", name: "([^"]+)", sub: "([^"]+)"/.exec(idx);
  ok(nm && J[nm[1]] && J[nm[2]], 'the name and the subtitle of the card are in the file');
  for (const [loc, name] of [['en-US', 'en'], ['fr-FR', 'fr']]) {
    for (const [dn, vp] of [['phone', { width: 390, height: 844 }], ['small', { width: 320, height: 568 }], ['sideways', { width: 844, height: 390 }]]) {
      const s = await start(new Map(), { local: true, locale: loc, viewport: vp, today: '2026-11-12' });
      const q = s.page;
      await q.route('**/src/i18n-data.ts*', async (route) => { const r = await route.fetch(); const body = await r.text(); await route.fulfill({ response: r, body: body + `\nObject.assign(EN, ${JSON.stringify(Object.fromEntries(Object.entries(J).map(([k, v]) => [k, v[0]])))});\nObject.assign(FR, ${JSON.stringify(Object.fromEntries(Object.entries(J).map(([k, v]) => [k, v[1]])))});\n` }); });
      await q.reload(); await q.waitForSelector('.hub-grid, .kids, .empty-home');
      await q.evaluate(() => (location.hash = '#/subject/games')); await q.waitForSelector('.gm-card');
      const homeText = await q.evaluate(() => document.querySelector('.gm-grid').innerText);
      ok(new RegExp(name === 'en' ? 'Reversi' : 'Othello').test(homeText), `${name} ${dn}: the card is named ${name === 'en' ? 'Reversi' : 'Othello'}`);
      await q.evaluate(() => (location.hash = '#/games/reversi')); await q.waitForSelector('#rv-board .rv-cell'); await q.waitForTimeout(250);
      const game = await q.evaluate(() => document.querySelector('.rv-wrap').innerText);
      ok(!CJK.test(game), `${name} ${dn}: the game screen has no Chinese left (${game.replace(/\s+/g, ' ').slice(0, 110)})`);
      const over = await q.evaluate(() => [...document.querySelectorAll('.rv-stat, .rv-opts .mopt')].filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent));
      const fit = await q.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight, all: [...document.querySelectorAll('.rv-opts button')].every((x) => { const r = x.getBoundingClientRect(); return r.right <= innerWidth + 1 && r.left >= -1 && r.bottom <= innerHeight + 1; }) }));
      ok(over.length === 0 && fit.sw <= fit.iw && fit.sh <= fit.ih + 1 && fit.all, `${name} ${dn}: no text is cut off, nothing overflows${over.length ? ' -> ' + over.join() : ''}`);
      await watchNote(q);
      await q.evaluate((c) => window.__reversi.setup(c, 1), PASSBOARD());
      await q.locator('#rv-board .rv-cell[data-i="2"]').click();
      const nt = await noteSeen(q);
      ok(!CJK.test(nt) && /pass/i.test(nt), `${name} ${dn}: the pass message is translated (${nt})`);
      if (dn === 'phone') await q.screenshot({ path: OUT + `reversi-${name}-pass.png` });
      await q.waitForFunction(() => document.querySelector('#rv-note').hidden, null, { timeout: 6000 });
      await q.locator('#rv-board .rv-cell[data-i="26"]').click();
      await q.waitForSelector('#rv-ovl:not([hidden])');
      const ov = await q.evaluate(() => document.querySelector('#rv-ovl').innerText);
      ok(!CJK.test(ov) && /win|gagnez/i.test(ov) && /6/.test(ov), `${name} ${dn}: the end overlay is translated (${ov.replace(/\s+/g, ' ')})`);
      if (dn === 'phone') await q.screenshot({ path: OUT + `reversi-${name}-win.png` });
      ok(s.log.external.length === 0, `${name} ${dn}: no outside request`);
      await s.browser.close();
    }
  }
  await done();
  function PASSBOARD() { const g = new Array(64).fill(0); g[0] = 1; g[1] = 2; g[24] = 1; g[25] = 2; g[63] = 2; return g.join(''); }
})().catch((e) => { console.error(e); process.exit(1); });
