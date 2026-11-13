// Gomoku (五子棋): the rules (win detection checked against a plain scan on random boards, six in a row, edges), the computer (wins in one, stops a five, stops an
// open three, makes an open four, never plays on a stone, every game ends, hard beats normal, normal beats easy), the screen (setup, tapping crossings with a real
// pointer, last-move marker, the winning five highlighted, undo of a move pair, restart, who starts, two players), the best record in localStorage, three sizes.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const KEY = 'learn.games.v1';

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  const p = t.page;
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));

  // ---------- pure rules ----------
  const L = await p.evaluate(async () => {
    const G = await import('/src/games/gomoku-logic.ts');
    const res = { bad: [] };
    let seed = 1; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const naive = (b, i) => {   // the longest run through i in a plain scan
      const p = b[i]; if (!p) return 0; const x = i % 15, y = (i / 15) | 0; let best = 0;
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) { let n = 1; for (const s of [1, -1]) for (let k = 1; k < 15; k++) { const a = x + s * dx * k, c = y + s * dy * k; if (a < 0 || c < 0 || a > 14 || c > 14 || b[c * 15 + a] !== p) break; n++; } best = Math.max(best, n); }
      return best;
    };
    // 1. the four directions, at the edges, with 4 / 5 / 6 / 7
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) for (const len of [4, 5, 6, 7]) for (const [sx, sy] of [[0, 0], [14 - (len - 1) * Math.abs(dx), 0], [0, 14 - (len - 1) * Math.abs(dy)], [3, 4], [14 - (len - 1), 14 - (len - 1)]]) {
      const b = G.newBoard(); const cells = [];
      for (let k = 0; k < len; k++) { const x = sx + dx * k, y = (dy === -1 ? Math.max(sy, len - 1) : sy) + dy * k; if (x < 0 || x > 14 || y < 0 || y > 14) { cells.length = 0; break; } cells.push(y * 15 + x); }
      if (!cells.length) continue;
      cells.forEach((c) => (b[c] = 1));
      for (const c of cells) { const w = G.winLine(b, c); if ((w !== null) !== (len >= 5)) res.bad.push(`dir ${dx},${dy} len ${len}: ${w}`); if (w && (w.length !== len || !cells.every((x) => w.includes(x)))) res.bad.push('line cells'); }
    }
    // 2. random boards: winLine agrees with a plain scan for every stone; makesFive agrees with "put it there and look"
    let stonesChecked = 0, fives = 0;
    for (let g = 0; g < 400; g++) {
      const b = G.newBoard(); const n = 10 + Math.floor(rnd() * 120);
      for (let k = 0; k < n; k++) { const i = Math.floor(rnd() * 225); if (!b[i]) b[i] = 1 + (rnd() < 0.5 ? 1 : 0); }
      if (g % 2) for (let k = 0; k < 3; k++) { const i = Math.floor(rnd() * 225), d = [[1, 0], [0, 1], [1, 1]][k % 3]; const p = 1 + (k % 2); for (let m = 0; m < 4; m++) { const x = (i % 15) + d[0] * m, y = ((i / 15) | 0) + d[1] * m; if (x < 15 && y < 15) b[y * 15 + x] = p; } }
      for (let i = 0; i < 225; i++) if (b[i]) { stonesChecked++; const w = G.winLine(b, i), nv = naive(b, i); if ((w !== null) !== (nv >= 5)) res.bad.push('winLine vs scan at ' + i); if (w) fives++; }
      for (let i = 0; i < 225; i += 7) if (!b[i]) for (const p of [1, 2]) { b[i] = p; const w = G.winLine(b, i) !== null; b[i] = 0; if (w !== G.makesFive(b, i, p)) res.bad.push('makesFive at ' + i); }
    }
    res.stonesChecked = stonesChecked; res.fives = fives;
    res.full = (() => { const b = G.newBoard(); const e = G.isFull(b); for (let i = 0; i < 225; i++) b[i] = 1 + (i % 2); return [e, G.isFull(b)]; })();
    res.cand = [G.candidates(G.newBoard()).join(), (() => { const b = G.newBoard(); b[0] = 1; return G.candidates(b).length; })(), (() => { const b = G.newBoard(); b[7 * 15 + 7] = 1; return G.candidates(b).length; })()];
    return res;
  });
  ok(L.bad.length === 0 && L.fives > 100, `win detection: 4 directions at the edges with 4 / 5 / 6 / 7 in a row (six wins), and ${L.stonesChecked} stones of 400 random boards agree with a plain scan (${L.fives} winning ones)` + (L.bad.length ? ': ' + L.bad.slice(0, 4).join('; ') : ''));
  ok(L.full[0] === false && L.full[1] === true && L.cand[0] === '112' && L.cand[1] === 8 && L.cand[2] === 24, 'full board / candidate cells (the middle when empty, the 2-cell ring around stones): ' + JSON.stringify(L.cand));

  // ---------- the computer ----------
  const A = await p.evaluate(async () => {
    const G = await import('/src/games/gomoku-logic.ts');
    const put = (b, s, p) => s.split(' ').forEach((t) => { const [x, y] = t.split(',').map(Number); b[y * 15 + x] = p; });
    const mv = (b, me, lv, r = 0.1) => G.chooseMove(b, me, lv, () => r);
    const res = { bad: [], n: 0 };
    const chk = (c, msg) => { res.n++; if (!c) res.bad.push(msg); };
    const lines = { h: (x, y, k) => [x + k, y], v: (x, y, k) => [x, y + k], d: (x, y, k) => [x + k, y + k], a: (x, y, k) => [x + k, y - k] };
    for (const lv of ['easy', 'normal', 'hard']) for (const me of [1, 2]) for (const dir of Object.keys(lines)) {
      const opp = 3 - me, f = lines[dir], ox = 4, oy = 8;
      // (a) it wins: four own stones with a gap in one of the places  XXXX_ / XX_XX / _XXXX
      for (const gap of [0, 2, 4]) {
        const b = G.newBoard(); const cs = [];
        for (let k = 0; k < 5; k++) { if (k === gap) continue; const [x, y] = f(ox, oy, k); cs.push(x + ',' + y); }
        put(b, cs.join(' '), me); put(b, '0,0 14,14 0,14 14,0', opp);   // far-away stones of the opponent
        const c = mv(b, me, lv);
        chk(G.winningCells(b, me).includes(c), `${lv} ${me} ${dir} wins at gap ${gap}: ${c}`);
      }
      // (b) it must stop a five (also a broken four), and prefers its own win when it has one
      for (const gap of [0, 2, 4]) {
        const b = G.newBoard(); const cs = [];
        for (let k = 0; k < 5; k++) { if (k === gap) continue; const [x, y] = f(ox, oy, k); cs.push(x + ',' + y); }
        put(b, cs.join(' '), opp); put(b, '0,0 14,14', me); put(b, '1,0 13,14', opp);
        const theirWins = G.winningCells(b, opp), c = mv(b, me, lv);
        chk(theirWins.includes(c), `${lv} ${me} ${dir} blocks the four at gap ${gap}: ${c}`);
        // own win and the opponent's four at once: it wins
        put(b, '3,2 4,2 5,2 6,2', me);
        const c2 = mv(b, me, lv); chk(c2 === 2 * 15 + 2 || c2 === 2 * 15 + 7, `${lv} ${me} ${dir} wins first: ${c2}`);
      }
    }
    // (c) an open three of the opponent is answered at an end (or the far point), by normal and hard, in the four directions, in the middle and near an edge
    for (const lv of ['normal', 'hard']) for (const me of [1, 2]) for (const dir of Object.keys(lines)) for (const [ox, oy] of [[5, 8], [6, 7]]) {
      const b = G.newBoard(), f = lines[dir], opp = 3 - me;
      put(b, [1, 2, 3].map((k) => f(ox, oy, k).join()).join(' '), opp);
      const around = [0, 4, -1, 5].map((k) => f(ox, oy, k)).map(([x, y]) => y * 15 + x);
      put(b, '13,1', me);
      const c = mv(b, me, lv);
      chk(around.includes(c), `${lv} ${me} ${dir} open three at ${ox},${oy} answered at ${c % 15},${(c / 15) | 0}`);
    }
    // (d) it makes an open four from its own open three when the opponent has no threat
    for (const lv of ['normal', 'hard']) for (const me of [1, 2]) for (const dir of Object.keys(lines)) {
      const b = G.newBoard(), f = lines[dir], opp = 3 - me;
      put(b, [1, 2, 3].map((k) => f(5, 8, k).join()).join(' '), me); put(b, '0,0 14,14', opp); put(b, '1,13', opp);
      const c = mv(b, me, lv); b[c] = me;
      chk(G.winningCells(b, me).length >= 2, `${lv} ${me} ${dir} makes an open four (win cells ${G.winningCells(b, me).length})`);
    }
    // (e) hard finds a win by a chain of fours (a "four-three" fork): the first move must force a win
    {
      const b = G.newBoard();
      put(b, '4,7 5,7 6,7', 1); put(b, '3,7', 2); put(b, '7,4 7,5 7,6', 1); put(b, '7,3', 2); put(b, '12,12 12,2', 2);
      const v = G.vcf(b, 1, 8);
      chk(v >= 0, 'vcf finds the fork');
      const c = G.chooseMove(b, 1, 'hard', () => 0.1);
      b[c] = 1; const w = G.winningCells(b, 1).length; b[c] = 0;
      chk(w >= 1 || G.vcf(b, 1, 8) >= 0, 'hard plays a forcing move');
      const b2 = G.newBoard(); put(b2, '7,7 8,8', 1); put(b2, '3,3', 2);
      chk(G.vcf(b2, 1, 8) === -1, 'vcf finds nothing where there is nothing');
    }
    // (f) the first moves
    {
      const b = G.newBoard(); chk(G.chooseMove(b, 1, 'hard') === 112, 'first move in the middle');
      const b2 = G.newBoard(); b2[112] = 1; const c = G.chooseMove(b2, 2, 'normal'); chk(!b2[c] && Math.abs((c % 15) - 7) <= 1 && Math.abs(((c / 15) | 0) - 7) <= 1, 'answer next to the first stone');
    }
    return res;
  });
  ok(A.bad.length === 0, `the computer in ${A.n} constructed positions (all levels / both colours / four directions): wins in one (also XX_XX), stops a four, wins before stopping, stops an open three, makes an open four, finds a chain of fours` + (A.bad.length ? ': ' + A.bad.slice(0, 6).join(' | ') : ''));

  // ---------- whole games: always end, never on a stone, strength order ----------
  const S = await p.evaluate(async () => {
    const G = await import('/src/games/gomoku-logic.ts');
    let seed = 9; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const play = (a, c) => { const b = G.newBoard(); let p = 1, n = 0; for (;;) { const m = G.chooseMove(b, p, p === 1 ? a : c, rnd); if (m < 0 || m > 224 || b[m] !== 0) return { err: `occupied ${m} after ${n}` }; b[m] = p; n++; if (G.winLine(b, m)) return { win: p, n }; if (G.isFull(b)) return { win: 0, n }; if (n > 225) return { err: 'too long' }; p = 3 - p; } };
    const out = { errs: [], tally: {}, rand: 0 };
    const t0 = performance.now();
    for (const [a, c, k] of [['easy', 'easy', 12], ['normal', 'normal', 4], ['hard', 'normal', 2], ['normal', 'hard', 2], ['normal', 'easy', 3], ['easy', 'normal', 3], ['hard', 'hard', 1], ['easy', 'hard', 2], ['hard', 'easy', 2]]) {
      const r = [0, 0, 0];
      for (let i = 0; i < k; i++) { const g = play(a, c); if (g.err) out.errs.push(a + c + g.err); else r[g.win]++; }
      out.tally[a + '>' + c] = r.join('/');
    }
    out.ms = Math.round(performance.now() - t0);
    // random players: always legal; the game ends; the winner really has five
    for (let g = 0; g < 60; g++) { const b = G.newBoard(); let p = 1; const free = [...Array(225).keys()]; for (;;) { const k = Math.floor(rnd() * free.length), m = free.splice(k, 1)[0]; b[m] = p; if (G.winLine(b, m)) { out.rand++; break; } if (!free.length) break; p = 3 - p; } }
    return out;
  });
  ok(S.errs.length === 0, `whole games between the computer levels (${S.ms} ms): never a stone on a stone, every game ends` + (S.errs.length ? ': ' + S.errs.join() : ''));
  const T = S.tally;
  const wins = (key, side) => Number(T[key].split('/')[side]);
  ok(wins('normal>easy', 1) === 3 && wins('easy>normal', 2) === 3, 'normal beats easy in every game (as black and as white): ' + T['normal>easy'] + ' / ' + T['easy>normal']);
  ok(wins('hard>easy', 1) === 2 && wins('easy>hard', 2) === 2, 'hard beats easy in every game: ' + T['hard>easy'] + ' / ' + T['easy>hard']);
  ok(wins('hard>normal', 1) + wins('normal>hard', 2) >= 3 && wins('hard>normal', 2) + wins('normal>hard', 1) === 0, 'hard never loses to normal and wins at least 3 of 4 (draws allowed): hard black ' + T['hard>normal'] + ', hard white ' + T['normal>hard']);
  console.log('  tallies (draw/black/white): ' + JSON.stringify(T));

  // ---------- the screen ----------
  await p.evaluate(() => (location.hash = '#/games/gomoku'));
  await p.waitForSelector('#gomoku-setup');
  ok((await p.locator('#gomoku-g-mode .gomoku-opt').count()) === 2 && (await p.locator('#gomoku-g-level .gomoku-opt').count()) === 3 && (await p.locator('#gomoku-g-first .gomoku-opt').count()) === 2, 'setup: mode (2), level (3), who starts (2), start button');
  await p.screenshot({ path: OUT + 'gomoku-setup-ipad.png' });
  const cell = async (x, y) => { const r = await p.locator('#gomoku-board').boundingBox(); return { x: r.x + ((26 + x * 40) / 612) * r.width, y: r.y + ((26 + y * 40) / 612) * r.height }; };
  const tap = async (x, y) => { const c = await cell(x, y); await p.mouse.click(c.x, c.y); };
  const nStones = () => p.locator('#gm-stones .gomoku-stone').count();
  const waitTurn = (turn) => p.waitForFunction((tn) => document.querySelector('#gomoku-status').dataset.turn === String(tn) && !/想/.test(document.querySelector('#gomoku-status').textContent), turn, { timeout: 8000 });

  // vs the computer (normal), I start
  await p.click('#gomoku-g-level .gomoku-opt[data-v=normal]'); await p.click('#gomoku-go'); await p.waitForSelector('#gomoku-board');
  ok((await nStones()) === 0 && (await p.textContent('#gomoku-status')).includes('轮到你了（黑棋）'), 'I start as black: empty board, "轮到你了（黑棋）"');
  ok(await p.locator('#gomoku-board circle[r="4.5"]').count() === 5, 'the board has its five star points');
  await tap(7, 7);
  ok((await nStones()) >= 1 && (await p.locator('#gm-stones .gomoku-stone[data-c="1"]').count()) === 1, 'tapping a crossing puts a black stone there');
  await waitTurn(1);
  ok((await nStones()) === 2 && (await p.locator('#gm-stones .gomoku-stone[data-c="2"]').count()) === 1, 'the computer answers with a white stone, then it is my turn again');
  const lastOk = await p.evaluate(() => { const last = document.querySelector('#gomoku-last'), st = [...document.querySelectorAll('#gm-stones .gomoku-stone')], z = st[st.length - 1].getBoundingClientRect(), r = last.getBoundingClientRect(); return Math.abs(z.x + z.width / 2 - (r.x + r.width / 2)) < 2 && Math.abs(z.y + z.height / 2 - (r.y + r.height / 2)) < 2 && st[st.length - 1].dataset.c === '2'; });
  ok(lastOk, 'the last-move marker sits on the computer\'s last stone');
  await tap(7, 7);
  ok((await nStones()) === 2, 'tapping a stone does nothing');
  await p.screenshot({ path: OUT + 'gomoku-play-ipad.png' });
  await tap(3, 3); await waitTurn(1);
  ok((await nStones()) === 4, 'second round: 4 stones');
  await p.click('#gomoku-undo');
  ok((await nStones()) === 2 && (await p.locator('#gm-stones .gomoku-stone[data-c="1"]').count()) === 1, 'undo takes back the pair (my move and the computer\'s answer)');
  await p.click('#gomoku-undo');
  ok((await nStones()) === 0 && await p.locator('#gomoku-undo').isDisabled(), 'a second undo takes back the first pair; then undo is off');
  await tap(2, 2); await p.click('#gomoku-reset'); await p.waitForTimeout(600);
  ok((await nStones()) === 0, 'restart clears the board (a pending answer of the computer does not come)');

  // the computer starts
  await p.click('#gomoku-setup-btn'); await p.waitForSelector('#gomoku-setup');
  await p.click('#gomoku-g-first .gomoku-opt[data-v="2"]'); await p.click('#gomoku-go'); await p.waitForSelector('#gomoku-board');
  await p.waitForFunction(() => document.querySelectorAll('#gm-stones .gomoku-stone').length === 1);
  const first = await p.evaluate(() => { const s = document.querySelector('#gm-stones .gomoku-stone'); return { c: s.dataset.c, i: s.dataset.i }; });
  ok(first.c === '1' && first.i === '112', 'when the computer starts it plays black in the middle');
  await waitTurn(2);
  ok((await p.textContent('#gomoku-status')).includes('轮到你了（白棋）'), 'and I am white: "轮到你了（白棋）"');
  ok(await p.locator('#gomoku-undo').isDisabled() && (await nStones()) === 1, 'undo is off while there is nothing of mine to take back (the computer\'s opening move stays)');
  // I lose on purpose: far-away stones, the computer builds its five
  const junk = [[0, 0], [14, 14], [0, 14], [14, 0], [7, 0], [0, 7], [14, 7], [7, 14], [3, 0], [0, 3], [11, 14], [14, 11], [11, 0], [0, 11], [14, 3], [3, 14]];
  let lost = false;
  for (const [x, y] of junk) {
    if (await p.locator('#gomoku-status.won').count()) { lost = true; break; }
    await waitTurn(2).catch(() => {});
    if (await p.locator('#gomoku-status.won').count()) { lost = true; break; }
    await tap(x, y);
    await p.waitForTimeout(100);
  }
  await p.waitForSelector('#gomoku-status.won', { timeout: 8000 });
  ok((await p.getAttribute('#gomoku-status', 'data-result')) === '1' && (await p.textContent('#gomoku-status')).includes('电脑赢了'), 'the computer wins by itself when I play far away: "电脑赢了，再来一局吧！"');
  const win = await p.evaluate(() => ({ wins: document.querySelectorAll('#gm-stones .gomoku-stone.win').length, line: !!document.querySelector('#gomoku-winline'), rings: document.querySelectorAll('.gomoku-ring').length }));
  ok(win.wins >= 5 && win.line && win.rings >= 5, `the winning five is highlighted (${win.wins} stones animated, a line, ${win.rings} rings)`);
  const n1 = await nStones(); await tap(7, 3);
  ok((await nStones()) === n1, 'after the end no stone can be placed');
  await p.screenshot({ path: OUT + 'gomoku-lost-ipad.png' });
  const rec = await p.evaluate((k) => JSON.parse(localStorage.getItem(k)).gomoku.stats, KEY);
  ok(rec.normal && rec.normal.l === 1, 'the record (lost 1 at normal) is kept in localStorage learn.games.v1: ' + JSON.stringify(rec));
  // undo after a loss: I can go on
  await p.click('#gomoku-undo');
  ok((await p.locator('#gomoku-status.won').count()) === 0, 'undo after the end reopens the game');

  // two players, white starts
  await p.click('#gomoku-setup-btn'); await p.waitForSelector('#gomoku-setup');
  await p.click('#gomoku-g-mode .gomoku-opt[data-v=two]');
  ok((await p.locator('#gomoku-g-level').count()) === 0 && (await p.locator('#gomoku-g-first .gomoku-opt').allTextContents()).join() === '黑棋先,白棋先', 'two players: no level, "黑棋先 / 白棋先"');
  await p.click('#gomoku-g-first .gomoku-opt[data-v="2"]'); await p.click('#gomoku-go'); await p.waitForSelector('#gomoku-board');
  ok((await p.textContent('#gomoku-status')).includes('轮到白棋'), 'white starts: "轮到白棋"');
  await tap(7, 7);
  ok((await p.locator('#gm-stones .gomoku-stone[data-c="2"]').count()) === 1 && (await p.textContent('#gomoku-status')).includes('轮到黑棋'), 'a white stone, then it is black\'s turn (no computer move)');
  await p.click('#gomoku-undo');
  ok((await nStones()) === 0 && (await p.textContent('#gomoku-status')).includes('轮到白棋'), 'two players: undo takes back one move');
  await p.click('#gomoku-reset');
  // white (first) plays x=3..7 at y=7 while black plays y=8
  for (let k = 0; k < 4; k++) { await tap(3 + k, 7); await tap(3 + k, 8); }
  ok(await p.locator('#gomoku-status.won').count() === 0, 'four in a row is not yet a win');
  await tap(7, 7);
  await p.waitForSelector('#gomoku-status.won');
  ok((await p.getAttribute('#gomoku-status', 'data-result')) === '2' && (await p.textContent('#gomoku-status')).includes('白棋赢了！太棒了！') && (await p.locator('#gm-stones .gomoku-stone.win').count()) === 5, 'five in a row wins: "白棋赢了！太棒了！", five stones highlighted');
  await p.screenshot({ path: OUT + 'gomoku-two-won-ipad.png' });
  await p.click('#gomoku-reset');
  ok((await nStones()) === 0 && (await p.locator('#gomoku-status.won').count()) === 0 && (await p.locator('#gomoku-winline').count()) === 0, 'restart after a win: clean board');
  // black wins with a diagonal (six counts as a win too)
  await p.click('#gomoku-setup-btn'); await p.waitForSelector('#gomoku-setup'); await p.click('#gomoku-g-first .gomoku-opt[data-v="1"]'); await p.click('#gomoku-go'); await p.waitForSelector('#gomoku-board');
  for (let k = 0; k < 4; k++) { await tap(2 + k, 2 + k); await tap(12, k); }
  await tap(6, 6);
  await p.waitForSelector('#gomoku-status.won');
  ok((await p.textContent('#gomoku-status')).includes('黑棋赢了！太棒了！'), 'black wins on a diagonal: "黑棋赢了！太棒了！"');

  // ---------- three sizes ----------
  for (const [name, vp] of [['phone', { width: 320, height: 568 }], ['ipad', { width: 820, height: 1180 }], ['sideways', { width: 844, height: 390 }]]) {
    await p.setViewportSize(vp);
    await p.evaluate(() => (location.hash = '#/subject/games')); await p.evaluate(() => (location.hash = '#/games/gomoku'));
    await p.waitForFunction(() => document.querySelector('#gomoku-setup')); await p.waitForTimeout(300);
    const su = await p.evaluate(() => { const r = document.querySelector('#gomoku-setup').getBoundingClientRect(); return { l: r.left, r: innerWidth - r.right, sw: document.documentElement.scrollWidth, iw: innerWidth }; });
    ok(su.sw <= su.iw && Math.abs(su.l - su.r) <= 3 && su.l >= 0, `${name}: the setup card fits and is centred (${Math.round(su.l)} | ${Math.round(su.r)})`);
    await p.screenshot({ path: OUT + `gomoku-setup-${name}.png` });
    await p.click('#gomoku-g-mode .gomoku-opt[data-v=two]'); await p.click('#gomoku-go'); await p.waitForSelector('#gomoku-board'); await p.waitForTimeout(250);
    await tap(7, 7); await tap(8, 8); await tap(3, 4);
    const m = await p.evaluate(() => {
      const b = document.querySelector('#gomoku-board').getBoundingClientRect(), bs = [...document.querySelectorAll('.gomoku-btns button')].map((x) => x.getBoundingClientRect());
      return { l: b.left, r: innerWidth - b.right, w: b.width, h: b.height, top: b.top, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight, btn: bs.every((x) => x.bottom <= innerHeight + 1 && x.left >= 0 && x.right <= innerWidth), st: document.querySelector('#gomoku-status').getBoundingClientRect().top };
    });
    ok(m.sw <= m.iw && m.sh <= m.ih + 1 && m.btn && m.top >= 0 && m.st >= 0, `${name}: no overflow, no page scrolling, buttons visible (board ${Math.round(m.w)} px)`);
    ok(Math.abs(m.l - m.r) <= 3 && Math.abs(m.w - m.h) <= 1, `${name}: the square board has equal space left and right (${Math.round(m.l)} | ${Math.round(m.r)})`);
    ok(m.w >= (vp.height < 400 ? 170 : 280), `${name}: the board is big enough (${Math.round(m.w)} px for 15 crossings)`);
    await p.screenshot({ path: OUT + `gomoku-play-${name}.png` });
  }
  ok(errors.length === 0, 'no script errors' + (errors.length ? ': ' + errors.join('; ') : ''));
  ok(t.log.external.length === 0, 'OFFLINE: no request left the app: ' + t.log.external.join(', '));

  // ---------- all Chinese texts are in the translations file ----------
  const src = ['gomoku.ts', 'gomoku-logic.ts'].map((f) => fs.readFileSync('src/games/' + f, 'utf8')).join('\n');
  const tr = JSON.parse(fs.readFileSync('src/games/gomoku.i18n.json', 'utf8'));
  const scan = (txt) => {
    let i = 0; const out = [];
    while (i < txt.length) {
      const c = txt[i];
      if (c === '/' && txt[i + 1] === '/') { while (i < txt.length && txt[i] !== '\n') i++; continue; }
      if (c === '/' && txt[i + 1] === '*') { i = txt.indexOf('*/', i) + 2; continue; }
      if (c === '"' || c === "'") { let j = i + 1; while (txt[j] !== c) { if (txt[j] === '\\') j++; j++; } out.push(txt.slice(i + 1, j)); i = j + 1; continue; }
      if (c === '`') { let j = i + 1, s = '', n = 0; while (txt[j] !== '`') { if (txt[j] === '\\') { s += txt[j] + txt[j + 1]; j += 2; continue; } if (txt[j] === '$' && txt[j + 1] === '{') { let d = 1; j += 2; while (d) { if (txt[j] === '{') d++; else if (txt[j] === '}') d--; j++; } s += `{${n++}}`; continue; } s += txt[j++]; } out.push(s); i = j + 1; continue; }
      i++;
    }
    return out;
  };
  const lits = new Set(scan(src).filter((s) => /[一-鿿]/.test(s)));
  const missing = [...lits].filter((s) => !tr[s]);
  ok(missing.length === 0 && Object.values(tr).every((v) => v.length === 2 && v[0] && v[1]) && Object.keys(tr).every((k) => k.length > 1), `every Chinese text of the game (${lits.size}) has an English and a French entry, no one-character keys` + (missing.length ? ': missing ' + missing.join(' | ') : ''));
  await done(t.browser);
})().catch((e) => { console.error(e); process.exit(1); });
