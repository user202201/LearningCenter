// Tetris: the pure rules (pieces, 7-bag, rotation + wall kicks, line clears and scores, levels, hold, ghost, game over, random games) and the screen (keys, buttons, swipes, tap, pause, best score, layout on 3 screens).
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  const p = t.page;
  await p.evaluate(() => (location.hash = '#/games/tetris')); await p.waitForSelector('#tetris-canvas');

  // ---------- the rules ----------
  const L = await p.evaluate(async () => {
    const M = await import('/src/games/tetris-logic.ts');
    const bad = [];
    let seed = 987; const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const r = { shapes: 0, bag: 0, kicks: 0, lines: {}, games: 0, actions: 0 };
    // shapes: 4 cells in every rotation, four turns come back, inside a 4 x 4 box
    for (const k of M.KINDS) for (let rot = 0; rot < 4; rot++) {
      const c = M.shape(k, rot); r.shapes++;
      if (c.length !== 4 || new Set(c.map((q) => q.join())).size !== 4 || c.some(([x, y]) => x < 0 || y < 0 || x > 3 || y > 3)) bad.push(k + rot + ' shape');
      if (JSON.stringify(M.shape(k, rot + 4)) !== JSON.stringify(c)) bad.push(k + ' period');
    }
    const norm = (c) => { const mx = Math.min(...c.map((q) => q[0])), my = Math.min(...c.map((q) => q[1])); return c.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).join(';'); };
    const has = (k, rot, pts) => norm(M.shape(k, rot)) === norm(pts);
    if (!has('I', 0, [[0, 0], [1, 0], [2, 0], [3, 0]]) || !has('I', 1, [[0, 0], [0, 1], [0, 2], [0, 3]])) bad.push('I shape');
    if (!has('O', 0, [[0, 0], [1, 0], [0, 1], [1, 1]]) || norm(M.shape('O', 0)) !== norm(M.shape('O', 1))) bad.push('O shape');
    if (!has('T', 0, [[1, 0], [0, 1], [1, 1], [2, 1]]) || !has('T', 1, [[0, 0], [0, 1], [1, 1], [0, 2]])) bad.push('T shape');
    if (!has('S', 0, [[1, 0], [2, 0], [0, 1], [1, 1]]) || !has('Z', 0, [[0, 0], [1, 0], [1, 1], [2, 1]])) bad.push('S/Z shape');
    if (!has('L', 0, [[2, 0], [0, 1], [1, 1], [2, 1]]) || !has('J', 0, [[0, 0], [0, 1], [1, 1], [2, 1]])) bad.push('J/L shape');
    // the 7-bag: every group of seven is a permutation of the seven kinds
    const s = M.newTetris(rng), seq = [s.cur.t];
    for (let i = 0; i < 700; i++) { s.board = M.emptyBoard(); M.hardDrop(s); seq.push(s.cur.t); if (s.over) bad.push('over on an empty board'); }
    for (let i = 0; i + 7 <= seq.length; i += 7) { r.bag++; if (new Set(seq.slice(i, i + 7)).size !== 7) bad.push('bag ' + i + ': ' + seq.slice(i, i + 7).join('')); }
    if (s.queue.length < 7) bad.push('queue short');
    if (M.nextKinds(M.newTetris(rng), 3).length !== 3) bad.push('next preview');
    // spawn
    const sp = M.newTetris(rng); if (sp.cur.r !== 0 || sp.cur.y !== 0 || M.collides(sp.board, sp.cur)) bad.push('spawn');
    // moves and walls
    const m = M.newTetris(rng); m.cur = { t: 'O', r: 0, x: 3, y: 5 };
    for (let i = 0; i < 12; i++) M.move(m, -1); if (m.cur.x !== -1 + 0 && Math.min(...M.cellsOf(m.cur).map((q) => q[0])) !== 0) bad.push('left wall');
    for (let i = 0; i < 12; i++) M.move(m, 1); if (Math.max(...M.cellsOf(m.cur).map((q) => q[0])) !== 9) bad.push('right wall');
    if (M.move(m, 0, 40)) bad.push('moved through the floor');
    // gravity / drops / ghost / scores
    const g = M.newTetris(rng); g.cur = { t: 'T', r: 0, x: 3, y: 0 }; const gy = M.ghostY(g);
    if (gy !== 18) bad.push('ghost of T on an empty board ' + gy);
    const sc0 = g.score; for (let i = 0; i < 3; i++) M.softDrop(g); if (g.score !== sc0 + 3) bad.push('soft drop 1 point per row');
    const y0 = g.cur.y, sc1 = g.score; M.hardDrop(g); if (g.score !== sc1 + 2 * (18 - y0)) bad.push('hard drop 2 points per row'); if (g.board[19].filter(Boolean).length !== 3 || g.board[18].filter(Boolean).length !== 1) bad.push('hard drop did not lock T on the floor');
    // rotation: four turns come back; wall kicks near the walls and floor; blocked rotations change nothing
    for (const k of M.KINDS) for (const dir of [1, -1]) {
      const q = M.newTetris(rng); q.cur = { t: k, r: 0, x: 3, y: 8 };
      for (let i = 0; i < 4; i++) if (!M.rotate(q, dir)) bad.push(k + ' cannot rotate in the open');
      if (q.cur.r !== 0 || q.cur.x !== 3 || q.cur.y !== 8) bad.push(k + ' four turns do not return');
    }
    for (const k of ['T', 'S', 'Z', 'J', 'L', 'I']) {
      for (const [x0, side] of [[-1, 'left'], [8, 'right']]) {
        // push the vertical piece against the wall, then rotate: must succeed by a kick and stay inside
        const q = M.newTetris(rng); q.cur = { t: k, r: 1, x: k === 'I' ? (side === 'left' ? -2 : 7) : (side === 'left' ? -1 : 8), y: 8 };
        if (M.collides(q.board, q.cur)) { q.cur.x += side === 'left' ? 1 : -1; if (M.collides(q.board, q.cur)) continue; }
        const ok1 = M.rotate(q, 1); r.kicks++;
        if (!ok1 || M.collides(q.board, q.cur)) bad.push(k + ' wall kick ' + side);
      }
    }
    { // T-spin style kick into a slot, and a rotation that is really blocked
      const q = M.newTetris(rng); q.cur = { t: 'I', r: 0, x: 3, y: 18 }; q.board = M.emptyBoard();
      // boxed in: vertical needs 4 rows; floor at row 20 and filled cells above
      for (let x = 0; x < 10; x++) { q.board[17][x] = 1; }
      q.board[19].fill(0); q.cur = { t: 'I', r: 0, x: 3, y: 18 };
      const before = JSON.stringify(q.cur); const res = M.rotate(q, 1);
      if (res !== false || JSON.stringify(q.cur) !== before) bad.push('a blocked rotation changed the piece');
    }
    // line clears and points: 1, 2, 3, 4 lines at level 1, and level multiplies
    for (const n of [1, 2, 3, 4]) for (const level of [1, 3]) {
      const q = M.newTetris(rng, level); q.board = M.emptyBoard();
      for (let i = 0; i < n; i++) for (let x = 1; x < 10; x++) q.board[19 - i][x] = 2;
      q.cur = { t: 'I', r: 1, x: -2, y: 0 };
      const before = q.score, res = M.hardDrop(q);
      const expect = [0, 100, 300, 500, 800][n] * level;
      r.lines[n] = res.cleared.length;
      if (res.cleared.length !== n || res.points !== expect || q.score !== before + 2 * (16 - 0) + expect) bad.push(`clear ${n} at level ${level}: ${res.cleared.length} lines, ${res.points} points`);
      if (n < 4 && q.board[19][0] === 0) bad.push('leftover of the I piece lost');
      if (q.lines !== n) bad.push('lines counter');
    }
    { // rows above a cleared row fall down by one
      const q = M.newTetris(rng); q.board = M.emptyBoard();
      for (let x = 1; x < 10; x++) q.board[19][x] = 3; q.board[18][4] = 5;
      q.cur = { t: 'I', r: 1, x: -2, y: 0 }; M.hardDrop(q);
      if (q.board[19][4] !== 5 || q.board.some((row) => row.length !== 10) || q.board.length !== 20) bad.push('rows did not fall');
    }
    { // levels every 10 lines and faster gravity
      const q = M.newTetris(rng); q.board = M.emptyBoard(); q.lines = 9;
      for (let x = 1; x < 10; x++) q.board[19][x] = 3;
      q.cur = { t: 'I', r: 1, x: -2, y: 0 }; const res = M.hardDrop(q);
      if (q.level !== 2 || !res.levelUp) bad.push('level 2 at 10 lines');
      let prev = 1e9; for (let lv = 1; lv < 30; lv++) { const ms = M.dropMs(lv); if (ms > prev || ms < 50) bad.push('dropMs'); prev = ms; }
      if (M.levelFor(0) !== 1 || M.levelFor(9) !== 1 || M.levelFor(10) !== 2 || M.levelFor(39) !== 4) bad.push('levelFor');
    }
    { // hold: first hold stores and takes the next piece; no second hold before a lock; then the stored one comes back
      const q = M.newTetris(rng); const first = q.cur.t, nxt = q.queue[0];
      if (!M.holdPiece(q) || q.hold !== first || q.cur.t !== nxt || q.canHold) bad.push('first hold');
      if (M.holdPiece(q)) bad.push('second hold allowed');
      M.hardDrop(q); if (!q.canHold) bad.push('hold not allowed again after a lock');
      const cur = q.cur.t; if (!M.holdPiece(q) || q.cur.t !== first || q.hold !== cur || q.cur.r !== 0 || q.cur.y !== 0) bad.push('swap hold');
    }
    { // game over: the spawn is blocked
      const q = M.newTetris(rng); q.board = M.emptyBoard(); for (let y = 0; y < 3; y++) for (let x = 0; x < 9; x++) q.board[y][x] = 4;
      q.cur = { t: 'O', r: 0, x: 3, y: 10 }; const res = M.hardDrop(q);
      if (!q.over || !res.over) bad.push('game over not detected');
      const sc = q.score; M.move(q, 1); M.rotate(q, 1); M.hardDrop(q); if (q.score !== sc || M.holdPiece(q)) bad.push('moves after game over');
    }
    // random games: invariants
    for (let gm = 0; gm < 120; gm++) {
      const q = M.newTetris(rng, 1 + (gm % 4)); r.games++;
      let locked = 0, linesSeen = 0, scoreSeen = 0;
      for (let i = 0; i < 400 && !q.over; i++) {
        const a = rng(); r.actions++;
        let res = null;
        if (a < 0.2) M.move(q, -1); else if (a < 0.4) M.move(q, 1); else if (a < 0.55) M.rotate(q, rng() < 0.5 ? 1 : -1);
        else if (a < 0.7) M.softDrop(q); else if (a < 0.78) M.holdPiece(q);
        else if (a < 0.88) { res = M.hardDrop(q); } else res = M.gravity(q);
        if (res) { locked++; linesSeen += res.cleared.length; }
        const filled = q.board.flat().filter(Boolean).length;
        if (filled !== 4 * locked - 10 * linesSeen) bad.push('cell count g' + gm + ' i' + i);
        if (q.lines !== linesSeen) bad.push('lines g' + gm);
        if (q.score < scoreSeen) bad.push('score went down'); scoreSeen = q.score;
        if (q.board.some((row) => row.some((c) => c < 0 || c > 7))) bad.push('bad cell');
        if (!q.over && M.collides(q.board, q.cur)) bad.push('piece inside blocks g' + gm);
        if (q.level < 1 + gm % 4 || q.level !== Math.max(q.level, M.levelFor(q.lines, q.startLevel))) bad.push('level');
        if (bad.length > 5) break;
      }
    }
    return { bad, r };
  });
  ok(L.bad.length === 0, `rules: ${L.r.shapes} shapes, ${L.r.bag} bags of seven, ${L.r.kicks} wall kicks, ${L.r.games} random games (${L.r.actions} actions), line clears 1-4 at two levels${L.bad.length ? ' -> ' + L.bad.slice(0, 6).join('; ') : ''}`);

  // ---------- the screen ----------
  const S = () => p.evaluate(() => { const s = window.__tetris.state(); return { x: s.cur.x, y: s.cur.y, r: s.cur.r, t: s.cur.t, score: s.score, lines: s.lines, level: s.level, over: s.over, hold: s.hold, canHold: s.canHold, pieces: s.pieces, phase: window.__tetris.phase() }; });
  const flat = () => p.evaluate(() => { const s = window.__tetris.state(); s.cur = { t: 'T', r: 0, x: 3, y: 4 }; window.__tetris.state().queue; return true; });
  await p.screenshot({ path: OUT + 'tetris-ready.png' });
  ok(await p.locator('#tetris-ovl').isVisible() && (await p.textContent('#tetris-score')) === '得分：0', 'ready: overlay with the start button');
  const box = await p.evaluate(() => { const c = document.querySelector('#tetris-canvas').getBoundingClientRect(); return { w: c.width, h: c.height, l: c.left, r: innerWidth - c.right }; });
  ok(Math.abs(box.w * 2 - box.h) < 2 && Math.abs(box.l - box.r) <= 2, `the board is 10 x 20 (${box.w}x${box.h}) and centred`);
  await p.click('#tetris-start'); ok((await S()).phase === 'play', 'Start begins the game');
  // freeze gravity for the checks: put the piece high up and work quickly
  await p.evaluate(() => { const s = window.__tetris.state(); s.cur = { t: 'T', r: 0, x: 3, y: 2 }; });
  await p.keyboard.press('ArrowLeft'); let a = await S(); ok(a.x === 2, 'left arrow moves left');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); a = await S(); ok(a.x === 4, 'right arrow moves right');
  await p.keyboard.press('a'); await p.keyboard.press('d'); a = await S(); ok(a.x === 4, 'A / D also move');
  await p.keyboard.press('x'); a = await S(); ok(a.r === 1, 'X rotates clockwise');
  await p.keyboard.press('z'); a = await S(); ok(a.r === 0, 'Z rotates the other way');
  await p.keyboard.press('ArrowUp'); a = await S(); ok(a.r === 1, 'arrow up rotates');
  const y1 = (await S()).y; await p.keyboard.press('ArrowDown'); a = await S(); ok(a.y >= y1 + 1 && a.score >= 1, 'arrow down is a soft drop (+1 point per row)');
  // hold
  await p.keyboard.press('c'); a = await S(); ok(a.hold === 'T' && !a.canHold, 'C holds the piece');
  await p.keyboard.press('c'); a = await S(); ok(a.hold === 'T', 'a second hold in a row does nothing');
  // hard drop with space
  const pcs = (await S()).pieces, sc = (await S()).score; await p.keyboard.press(' '); a = await S();
  ok(a.pieces === pcs + 1 && a.score >= sc + 2 && a.canHold, 'space drops the piece at once (+2 per row), the next one comes, hold is allowed again');
  // pause
  await p.keyboard.press('p'); a = await S(); ok(a.phase === 'pause' && await p.locator('#tetris-ovl').isVisible() && (await p.textContent('#tetris-pause')) === '继续', 'P pauses');
  const before = await S(); await p.keyboard.press('ArrowLeft'); await p.keyboard.press(' '); await p.waitForTimeout(300);
  ok(JSON.stringify(await S()) === JSON.stringify(before), 'nothing moves while paused');
  await p.click('#tetris-pause'); ok((await S()).phase === 'play', 'the pause button resumes');
  // on-screen buttons
  await p.evaluate(() => { window.__tetris.state().cur = { t: 'L', r: 0, x: 3, y: 2 }; });
  await p.click('#tetris-left'); a = await S(); ok(a.x === 2, 'on-screen left');
  await p.click('#tetris-right'); a = await S(); ok(a.x === 3, 'on-screen right');
  await p.click('#tetris-rot'); a = await S(); ok(a.r === 1, 'on-screen rotate');
  await p.click('#tetris-down'); a = await S(); ok(a.y >= 3, 'on-screen soft drop');
  await p.click('#tetris-hold'); a = await S(); ok(a.hold === 'L' || a.hold === 'T', 'on-screen hold key');
  // auto repeat: holding the left button keeps moving
  await p.evaluate(() => { window.__tetris.state().cur = { t: 'O', r: 0, x: 5, y: 2 }; });
  const lb = await p.locator('#tetris-left').boundingBox();
  await p.mouse.move(lb.x + 10, lb.y + 10); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up(); a = await S();
  ok(a.x <= 2, 'holding the left button repeats (x = ' + a.x + ')');
  const dropBtn = await S(); const pc2 = dropBtn.pieces; await p.click('#tetris-drop'); ok((await S()).pieces === pc2 + 1, 'on-screen hard drop');
  // swipe + tap on the board
  await p.evaluate(() => { window.__tetris.state().cur = { t: 'T', r: 0, x: 3, y: 2 }; });
  const c = await p.evaluate(() => { const r = document.querySelector('#tetris-field').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, cell: window.__tetris.cell() }; });
  await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.move(c.x + c.cell * 2.5, c.y, { steps: 6 }); await p.mouse.up();
  a = await S(); ok(a.x === 5, 'a swipe right of 2.5 cells moves 2 columns (x = ' + a.x + ')');
  await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.move(c.x - c.cell * 3.2, c.y, { steps: 6 }); await p.mouse.up();
  a = await S(); ok(a.x === 2, 'a swipe left moves left');
  await p.evaluate(() => { window.__tetris.state().cur = { t: 'T', r: 0, x: 3, y: 2 }; });
  await p.mouse.click(c.x, c.y); a = await S(); ok(a.r === 1, 'a tap rotates');
  const yy = (await S()).y; await p.mouse.move(c.x, c.y - 100); await p.mouse.down(); await p.mouse.move(c.x, c.y - 100 + c.cell * 2.2, { steps: 5 }); await p.mouse.up(); a = await S();
  ok(a.y >= yy + 2, 'a drag down is a soft drop');
  // a line clear through the screen: score by level, the sparkle (screenshot) and the best score
  await p.evaluate(() => { const s = window.__tetris.state(); s.board = s.board.map(() => new Array(10).fill(0)); for (let i = 0; i < 4; i++) for (let x = 1; x < 10; x++) s.board[19 - i][x] = 1 + (x % 7); s.cur = { t: 'I', r: 1, x: -2, y: 0 }; s.score = 0; s.lines = 0; s.level = 1; });
  await p.keyboard.press(' ');
  await p.waitForTimeout(120); await p.screenshot({ path: OUT + 'tetris-clear.png' });
  a = await S(); ok(a.lines === 4 && a.score === 800 + 32 && (await p.textContent('#tetris-lines')) === '行数：4' && (await p.textContent('#tetris-score')) === '得分：832', 'four lines at once: 800 points (+ the drop), the lines and score show: ' + a.score);
  // level up toast through 10 lines
  await p.evaluate(() => { const s = window.__tetris.state(); s.lines = 9; s.board = s.board.map(() => new Array(10).fill(0)); for (let x = 1; x < 10; x++) s.board[19][x] = 2; s.cur = { t: 'I', r: 1, x: -2, y: 0 }; });
  await p.keyboard.press(' '); a = await S(); ok(a.level === 2 && (await p.textContent('#tetris-level')) === '等级：2', 'level 2 after 10 lines');
  // game over
  await p.evaluate(() => { const s = window.__tetris.state(); s.board = s.board.map(() => new Array(10).fill(0)); for (let y = 0; y < 3; y++) for (let x = 0; x < 9; x++) s.board[y][x] = 3; s.cur = { t: 'O', r: 0, x: 4, y: 10 }; });
  await p.keyboard.press(' ');
  a = await S(); ok(a.over && a.phase === 'over', 'the stack reaches the top: game over');
  await p.waitForFunction(() => !document.querySelector('#tetris-ovl').hidden, null, { timeout: 4000 });
  await p.screenshot({ path: OUT + 'tetris-over.png' });
  const best = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).tetris.best);
  ok((await p.textContent('#tetris-ovl h2')) === '游戏结束' && best > 800 && (await p.textContent('#tetris-best')) === `最高：${best}`, 'game over overlay, best score kept in learn.games.v1: ' + best);
  await p.click('#tetris-start'); a = await S(); ok(a.phase === 'play' && a.score === 0 && a.lines === 0 && a.level === 1 && !a.over, 'play again: a fresh game');
  await p.click('#tetris-new'); await p.waitForTimeout(50); a = await S(); ok(a.phase === 'play' && a.score === 0, 'restart button');
  // gravity really runs (real time)
  const gy0 = (await S()).y; await p.waitForTimeout(1900); const gy1 = (await S()).y;
  ok(gy1 > gy0 || (await S()).pieces > 1, 'gravity pulls the piece down by itself');
  await p.screenshot({ path: OUT + 'tetris-play.png' });

  // ---------- layout on 3 screens ----------
  for (const [name, w, hgt] of [['phone', 320, 568], ['ipad', 820, 1180], ['side', 844, 390]]) {
    await p.setViewportSize({ width: w, height: hgt });
    await p.evaluate(() => (location.hash = '#/subject/games')); await p.evaluate(() => (location.hash = '#/games/tetris')); await p.waitForSelector('#tetris-canvas');
    await p.waitForTimeout(250);
    await p.click('#tetris-start');
    const m = await p.evaluate(() => {
      const R = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
      const ids = ['#tetris-field', '#tetris-hold', '#tetris-next', '#tetris-left', '#tetris-down', '#tetris-right', '#tetris-hold', '#tetris-rot', '#tetris-drop', '#tetris-pause', '#tetris-new', '#tetris-score', '#tetris-best'];
      const all = ids.map((i) => [i, R(i)]);
      return { all, vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, cell: window.__tetris.cell(), f: R('#tetris-field'),
        clip: ['#tetris-score', '#tetris-lines', '#tetris-level', '#tetris-best'].map((i) => { const e = document.querySelector(i); return e.scrollWidth <= e.clientWidth + 1; }).every(Boolean) };
    });
    const bad = m.all.filter(([, b]) => b.l < -0.5 || b.r > m.vw + 0.5 || b.t < -0.5 || b.b > m.vh + 0.5).map(([i]) => i);
    ok(bad.length === 0, `${name} ${w}x${hgt}: everything is on the screen (cell ${m.cell}px)${bad.length ? ' -> ' + bad.join() : ''}`);
    ok(m.sw <= m.vw && m.sh <= m.vh + 1, `${name}: no page scrolling`);
    const keys = m.all.filter(([i]) => /left|down|right|rot|drop/.test(i)).map(([, b]) => b);
    ok(keys.every((k) => !(k.l < m.f.r && k.r > m.f.l && k.t < m.f.b && k.b > m.f.t)), `${name}: the keys do not cover the board`);
    ok(m.cell >= (name === 'side' ? 8 : 12) && m.clip, `${name}: the board is big enough (cell ${m.cell}px), the numbers are not clipped`);
    ok(Math.abs(m.f.l - (m.vw - m.f.r)) <= 3, `${name}: the board is centred`);
    await p.screenshot({ path: OUT + `tetris-${name}.png` });
  }
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-grid');
  await p.waitForFunction(() => !window.__tetris);
  ok(true, 'leaving the game removes it');
  await p.keyboard.press(' ');
  ok(t.log.external.length === 0, 'no request left the app');
  await t.browser.close();
  await done();
})();
