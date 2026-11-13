// Klotski (华容道): the rules and the levels checked with a search written again in this test (a different way: single steps, a 0-1 search that counts the
// consecutive steps of one piece as one move), the level list (locked / unlocked, minimum shown, stars), dragging (also around a corner), tap-then-tap,
// undo / restart / hint, a whole level won in the minimal number of moves through the screen, three screen sizes, and no request leaves the app.
// COUNTING RULE: one move = one piece moved any distance by sliding through free cells, also around corners (a drag with turns). With it 横刀立马 needs 81.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const KEY = 'learn.games.v1';

/** the independent search, run in the page: single steps; a step of the piece that moved last is free; `unit` counts every step */
const INDEP = `(rows, unit) => {
  const W = 4, H = 5, cls = { C: 'C', G: 'G', Z: 'V', R: 'V', M: 'V', H: 'V', s: 's' };
  const g0 = rows.join('').split('').map((c) => (c === '.' ? '.' : cls[c]));
  const pieceCells = (g) => { const seen = new Set(), ps = []; for (let c = 0; c < 20; c++) { if (g[c] === '.' || seen.has(c)) continue; const t = g[c], cs = [c]; if (t === 'C') cs.push(c + 1, c + 4, c + 5); else if (t === 'G') cs.push(c + 1); else if (t === 'V') cs.push(c + 4); cs.forEach((x) => seen.add(x)); ps.push({ t, cs }); } return ps; };
  const goal = (g) => g[17] === 'C' && g[18] === 'C';
  const dist = new Map(), start = g0.join('') + '|-1'; dist.set(start, 0);
  let cur = [start], d = 0;
  while (cur.length) {
    const next = [];
    for (let qi = 0; qi < cur.length; qi++) {
      const st = cur[qi]; if (dist.get(st) !== d) continue;
      const [gs, last] = st.split('|'); const g = gs.split('');
      if (goal(g)) return d;
      for (const p of pieceCells(g)) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (p.cs.some((c) => { const x = (c % W) + dx, y = ((c / W) | 0) + dy; return x < 0 || y < 0 || x >= W || y >= H; })) continue;
          const moved = p.cs.map((c) => c + dx + dy * W), own = new Set(p.cs);
          if (moved.some((c) => g[c] !== '.' && !own.has(c))) continue;
          const ng = g.slice(); p.cs.forEach((c) => (ng[c] = '.')); moved.forEach((c) => (ng[c] = p.t));
          const id = Math.min(...moved);
          // the piece that moved last is named by the place it stands on now: a step of it continues where it ended
          const key = ng.join('') + '|' + id, cost = !unit && String(Math.min(...p.cs)) === last ? 0 : 1;
          const nd = d + cost;
          if (!dist.has(key) || dist.get(key) > nd) { dist.set(key, nd); (cost === 0 ? cur : next).push(key); }
        }
      }
    }
    cur = next; d++;
  }
  return null;
}`;

(async () => {
  let t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  let p = t.page;
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  // ---------- the rules and the levels ----------
  const R = await p.evaluate(async (indep) => {
    const K = await import('/src/games/klotski-logic.ts');
    const f = eval(indep);
    const out = { n: K.LEVELS.length, valid: K.LEVELS.every((l) => K.validLayout(l.rows)), ids: new Set(K.LEVELS.map((l) => l.id)).size, names: new Set(K.LEVELS.map((l) => l.name)).size, mins: {}, indep: {}, bad: [] };
    const t0 = performance.now();
    for (const l of K.LEVELS) out.mins[l.name] = K.minMoves(l.rows);
    out.msBfs = Math.round(performance.now() - t0);
    for (const l of K.LEVELS) if (out.mins[l.name] <= 40) { out.indep[l.name] = f(l.rows, false); }
    out.classic = f(K.LEVELS.find((l) => l.name === '横刀立马').rows, false);
    out.steps = f(K.LEVELS.find((l) => l.name === '横刀立马').rows, true);
    // the shown path really is a sequence of legal moves ending in the goal (replayed with the piece moves of the rules)
    for (const l of K.LEVELS.slice(0, 8)) {
      let ps = K.parseLayout(l.rows); const s = K.solve(ps); let k = 0;
      for (let i = 1; i < s.path.length; i++) {
        let found = false;
        for (const q of ps) { for (const tg of K.reachable(ps, q.id)) { const np = K.moveTo(ps, q.id, tg.x, tg.y); if (K.keyOf(np) === s.path[i]) { ps = np; found = true; break; } } if (found) break; }
        if (!found) { out.bad.push(l.name + ' path step ' + i); break; }
        k++;
      }
      if (!K.solved(ps) || k !== s.moves) out.bad.push(l.name + ' path end');
    }
    // random play: nothing ever overlaps or leaves the board, every move can be taken back by one move, the keys stay the same shape
    let seed = 42; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    let moves = 0;
    for (const l of K.LEVELS) {
      let ps = K.parseLayout(l.rows);
      for (let i = 0; i < 400; i++) {
        const q = ps[Math.floor(rnd() * ps.length)], r = K.reachable(ps, q.id);
        if (!r.length) continue;
        const tg = r[Math.floor(rnd() * r.length)], np = K.moveTo(ps, q.id, tg.x, tg.y);
        const cells = new Set(); let overlap = false;
        for (const z of np) for (let j = 0; j < z.h; j++) for (let a = 0; a < z.w; a++) { const c = (z.y + j) * 4 + z.x + a; if (cells.has(c) || z.x + a > 3 || z.y + j > 4 || z.x < 0 || z.y < 0) overlap = true; cells.add(c); }
        if (overlap || cells.size !== 18) { out.bad.push(l.name + ' overlap'); break; }
        if (!K.reachable(np, q.id).some((z) => z.x === q.x && z.y === q.y)) { out.bad.push(l.name + ' not reversible'); break; }
        if (K.keyOf(np).length !== 20) out.bad.push('key');
        ps = np; moves++;
      }
    }
    out.moves = moves;
    out.stars = [K.starsFor(10, 10), K.starsFor(13, 10), K.starsFor(14, 10), K.starsFor(40, 10), K.starsFor(5, 4), K.starsFor(7, 4)];
    out.bad2 = K.validLayout(['ZCCR', 'ZCCR', 'MGGH', 'MssH', 's..x']) || K.validLayout(['ZCCR', 'ZCCR', 'MGGH', 'MssH', 'sss.']) || K.validLayout(['ZCCR', 'ZCCR', 'MGGH', 'MssH']);
    return out;
  }, INDEP);
  ok(R.n >= 15 && R.valid && R.ids === R.n && R.names === R.n, `${R.n} levels, all valid layouts (10 pieces, 2 empty cells), unique ids and names`);
  ok(R.mins['横刀立马'] === 81 && R.mins['指挥若定'] === 70 && R.mins['齐头并进'] === 34 && R.mins['将拥曹营'] === 72, 'the classic openings have the known minimum (横刀立马 81, 指挥若定 70, 齐头并进 34, 将拥曹营 72): ' + ['横刀立马', '指挥若定', '齐头并进', '将拥曹营'].map((n) => R.mins[n]).join(' '));
  const diff = Object.keys(R.indep).filter((n) => R.indep[n] !== R.mins[n]);
  ok(Object.keys(R.indep).length >= 8 && diff.length === 0, `an independent search (single steps, consecutive steps of one piece = one move) agrees on ${Object.keys(R.indep).length} levels` + (diff.length ? ' DIFFERENT: ' + diff.join() : ''));
  ok(R.classic === 81 && R.steps === 116, `the independent search on 横刀立马: ${R.classic} moves by the rule (one piece, any path = one move), ${R.steps} single steps (the well-known 116)`);
  ok(R.bad.length === 0, `every level is solvable and the shown path is a legal sequence ending in the goal; ${R.moves} random moves never overlapped or left the board and could all be taken back` + (R.bad.length ? ': ' + R.bad.join() : ''));
  ok(R.stars.join() === '3,2,1,1,2,1' && R.bad2 === false, 'stars by moves (min -> 3, up to 30 % (at least 2) more -> 2, else 1) and broken layouts are refused: ' + R.stars.join());
  ok(Object.values(R.mins).every((m, i, a) => m >= 4 && (i === 0 || m >= a[i - 1])), 'the levels go from easy to hard (the minimum never goes down): ' + Object.values(R.mins).join(' '));
  console.log('  (search of all levels: ' + R.msBfs + ' ms)');

  // ---------- the list of levels ----------
  const mins = R.mins;
  await p.evaluate(() => (location.hash = '#/games/klotski'));
  await p.waitForSelector('#klotski-levels');
  ok((await p.locator('.klotski-lv').count()) === R.n, 'the list has a card for every level');
  const open0 = await p.locator('.klotski-lv').evaluateAll((a) => a.map((e) => e.dataset.open));
  ok(open0[0] === '1' && open0.slice(1).every((v) => v === '0'), 'at the beginning only the first level is open');
  await p.click('.klotski-lv[data-level=l03]');
  ok((await p.textContent('#toasts')).includes('通过前一关后') && await p.locator('.klotski-piece').count() === 0, 'a locked level does not open: a message says why');
  await p.waitForFunction(() => ![...document.querySelectorAll('.klotski-min')].some((e) => e.textContent.includes('计算中')), null, { timeout: 30000 });
  const shown = await p.locator('.klotski-min').allTextContents();
  const lv = await p.evaluate(async () => (await import('/src/games/klotski-logic.ts')).LEVELS.map((l) => l.name));
  ok(shown.every((s, i) => s === `最少 ${mins[lv[i]]} 步`), '"最少 N 步" is shown on every card and equals the search: ' + shown.slice(0, 4).join(' | ') + ' ...');
  await p.screenshot({ path: OUT + 'klotski-list-ipad.png' });

  // ---------- one level: the screen ----------
  await p.click('.klotski-lv[data-level=l01]');
  await p.waitForSelector('.klotski-piece');
  ok((await p.locator('.klotski-piece').count()) === 10 && (await p.locator('.klotski-piece .klotski-name').allTextContents()).sort().join() === ['曹操', '关羽', '张飞', '赵云', '马超', '黄忠', '小兵', '小兵', '小兵', '小兵'].sort().join(), '10 pieces: 曹操, 关羽, 张飞, 赵云, 马超, 黄忠 and four 小兵');
  ok((await p.locator('.klotski-piece svg').count()) === 10 && (await p.locator('#klotski-board img').count()) === 0, 'every piece is drawn as an svg face (no image files)');
  await p.waitForFunction(() => document.querySelector('#klotski-min').textContent === '最少 5 步');
  ok((await p.textContent('#klotski-moves')) === '步数 0' && (await p.textContent('#klotski-min')) === '最少 5 步', 'the screen shows the moves (0) and the target ("最少 5 步")');
  await p.screenshot({ path: OUT + 'klotski-play-ipad.png' });

  // ---------- play level 1 through the screen with the hint: the minimum, three stars ----------
  await p.click('#klotski-hint');
  ok(await p.locator('.klotski-ghost.hinted').count() === 1 && await p.locator('.klotski-piece.sel').count() === 1, 'the hint selects a piece and marks where it should go');
  await p.click('.klotski-ghost.hinted');
  ok((await p.textContent('#klotski-moves')) === '步数 1' && (await p.locator('.klotski-piece.sel').count()) === 0, 'tapping the marked place moves the piece (one move)');
  await p.click('#klotski-undo');
  ok((await p.textContent('#klotski-moves')) === '步数 0' && await p.locator('#klotski-undo').isDisabled(), 'undo takes the move back and is off when there is nothing to take back');
  for (let i = 0; i < 5; i++) { await p.click('#klotski-hint'); await p.click('.klotski-ghost.hinted'); }
  await p.waitForSelector('#klotski-win');
  ok((await p.textContent('#klotski-win')).includes('曹操已到达出口') && (await p.locator('#klotski-win .klotski-stars svg path[fill="#ffd43b"]').count()) === 3 && (await p.textContent('#klotski-win')).includes('用了 5 步'), 'winning in the minimal 5 moves: message, three gold stars, "用了 5 步"');
  const saved = await p.evaluate((k) => JSON.parse(localStorage.getItem(k)).klotski, KEY);
  ok(saved.stars.l01 === 3 && saved.best.l01 === 5, 'stars and best moves are kept in localStorage learn.games.v1: ' + JSON.stringify(saved));
  await p.screenshot({ path: OUT + 'klotski-win-ipad.png' });
  await p.click('#klotski-back'); await p.waitForSelector('#klotski-levels');
  ok((await p.locator('.klotski-lv[data-level=l02]').getAttribute('data-open')) === '1' && (await p.locator('.klotski-lv[data-level=l03]').getAttribute('data-open')) === '0', 'level 2 is now open, level 3 still locked (one by one)');
  await p.reload(); await p.waitForSelector('.hub-grid, .gm-card, #klotski-levels', { timeout: 15000 });
  await p.evaluate(() => (location.hash = '#/games/klotski')); await p.waitForSelector('#klotski-levels');
  ok((await p.locator('.klotski-lv[data-level=l02]').getAttribute('data-open')) === '1', 'the progress is still there after a reload');

  // ---------- 横刀立马: dragging, a corner, tap-tap, restart ----------
  await p.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); const st = {}; for (let i = 1; i <= 17; i++) st['l' + String(i).padStart(2, '0')] = 1; s.klotski.stars = st; localStorage.setItem(k, JSON.stringify(s)); }, KEY);
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.evaluate(() => (location.hash = '#/games/klotski')); await p.waitForSelector('#klotski-levels');
  ok((await p.locator('.klotski-lv[data-open="1"]').count()) === 17, 'with every earlier level done all are open');
  await p.click('.klotski-lv[data-level=l17]'); await p.waitForSelector('.klotski-piece');
  await p.waitForFunction(() => document.querySelector('#klotski-min').textContent === '最少 81 步');
  const centre = async (sel) => { const r = await p.locator(sel).boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; };
  const pieceAt = (x, y) => `.klotski-piece[data-x="${x}"][data-y="${y}"]`;
  const cellPx = async () => (await centre(pieceAt(1, 3))).w;         // a soldier is one cell
  const c0 = await cellPx();
  ok(c0 >= 40, 'a cell is at least 40 px: ' + Math.round(c0));
  // a straight drag: the soldier at (0,4) one cell right
  let a = await centre(pieceAt(0, 4));
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(a.x + c0 * 0.6, a.y, { steps: 4 }); await p.mouse.move(a.x + c0 * 1.1, a.y, { steps: 4 }); await p.mouse.up();
  ok(await p.locator(pieceAt(1, 4)).count() === 1 && (await p.textContent('#klotski-moves')) === '步数 1', 'dragging a piece one cell into the free cell moves it (counter 1)');
  // a drag around a corner: the soldier at (1,3) to (2,4) is not a straight line
  a = await centre(pieceAt(1, 3));
  const before = await p.textContent('#klotski-moves');
  // (1,4) is now taken by the soldier; free cells are (0,4) and (2,4): (1,3) -> via (1,4)? taken. So first put things back: undo, then do the corner move
  await p.click('#klotski-undo');
  ok((await p.textContent('#klotski-moves')) === '步数 0' && await p.locator(pieceAt(0, 4)).count() === 1, 'undo puts the soldier back');
  a = await centre(pieceAt(1, 3));
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(a.x, a.y + c0 * 0.5, { steps: 3 }); await p.mouse.move(a.x + c0 * 1.0, a.y + c0 * 1.0, { steps: 6 }); await p.mouse.up();
  ok(await p.locator(pieceAt(2, 4)).count() === 1 && (await p.textContent('#klotski-moves')) === '步数 1', 'dragging around a corner ((1,3) -> (1,4) -> (2,4)) is ONE move');
  // a piece that can not move stays where it is when dragged
  a = await centre(pieceAt(1, 0));
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(a.x, a.y + c0 * 3, { steps: 8 }); await p.mouse.up();
  ok(await p.locator(pieceAt(1, 0)).count() === 1 && (await p.textContent('#klotski-moves')) === '步数 1', '曹操 can not be dragged through other pieces: nothing happens, no move is counted');
  // tap, then tap: select a piece, the dashed frames show where it can go
  a = await centre(pieceAt(2, 4));
  await p.mouse.click(a.x, a.y);
  const nGhost = await p.locator('.klotski-ghost').count();
  const expect = await p.evaluate(async () => { const K = await import('/src/games/klotski-logic.ts'); const els = [...document.querySelectorAll('.klotski-piece')]; const ps = els.map((e) => ({ id: +e.dataset.id, kind: e.dataset.kind, x: +e.dataset.x, y: +e.dataset.y })); const sel = els.find((e) => e.classList.contains('sel')); const big = K.parseLayout(K.LEVELS[16].rows); const cur = big.map((q) => ({ ...q, ...ps.find((z) => z.id === q.id) })); return sel ? K.reachable(cur, +sel.dataset.id).length : -1; });
  ok((await p.locator('.klotski-piece.sel').count()) === 1 && nGhost === expect && nGhost >= 1, `tapping a piece selects it and shows ${nGhost} dashed frames = the places it can reach (${expect})`);
  await p.screenshot({ path: OUT + 'klotski-select-ipad.png' });
  const g0 = await p.locator('.klotski-ghost').first().boundingBox();
  await p.mouse.click(g0.x + g0.width / 2, g0.y + g0.height / 2);
  ok((await p.textContent('#klotski-moves')) === '步数 2' && (await p.locator('.klotski-piece.sel').count()) === 0, 'tapping a dashed frame moves the piece (counter 2)');
  // tapping empty board with a piece selected un-selects
  a = await centre(pieceAt(1, 0)); await p.mouse.click(a.x, a.y);
  ok((await p.locator('.klotski-piece.sel').count()) === 1, 'a piece that can not move can be selected, it has no frames');
  await p.mouse.click(a.x, a.y);
  ok((await p.locator('.klotski-piece.sel').count()) === 0, 'tapping it again un-selects');
  await p.click('#klotski-reset');
  ok((await p.textContent('#klotski-moves')) === '步数 0' && await p.locator(pieceAt(0, 4)).count() === 1 && await p.locator(pieceAt(3, 4)).count() === 1, 'restart: the opening position and counter 0');
  await p.screenshot({ path: OUT + 'klotski-heng-ipad.png' });
  // leave: the pieces go, the list comes back
  await p.click('#klotski-list'); await p.waitForSelector('#klotski-levels');
  ok(await p.locator('.klotski-piece').count() === 0, 'the list button goes back to the levels');

  // ---------- a level won with moves above the minimum: fewer stars ----------
  await p.click('.klotski-lv[data-level=l02]'); await p.waitForSelector('.klotski-piece');
  await p.waitForFunction(() => /最少 \d+ 步/.test(document.querySelector('#klotski-min').textContent));
  const l2 = await p.evaluate(async () => { const K = await import('/src/games/klotski-logic.ts'); return K.minMoves(K.LEVELS[1].rows); });
  // the first move of the hint is made, taken back, made again, and so on: 2 extra moves in the end (hint + wrong move + undo does not count)
  await p.click('#klotski-hint'); await p.click('.klotski-ghost.hinted'); await p.click('#klotski-undo');
  for (let i = 0; i < l2; i++) { await p.click('#klotski-hint'); await p.click('.klotski-ghost.hinted'); }
  await p.waitForSelector('#klotski-win');
  ok((await p.textContent('#klotski-win')).includes(`用了 ${l2} 步`) && (await p.locator('#klotski-next').count()) === 1, 'undo does not cost moves: level 2 done in the minimal ' + l2 + ' (the win window has a next-level button)');
  await p.click('#klotski-next'); await p.waitForSelector('.klotski-piece');
  ok((await p.textContent('.klotski-title')).startsWith('第3关'), 'the next-level button opens level 3');

  // ---------- layout on three screens ----------
  for (const [name, vp] of [['phone', { width: 320, height: 568 }], ['ipad', { width: 820, height: 1180 }], ['sideways', { width: 844, height: 390 }]]) {
    await p.setViewportSize(vp);
    await p.evaluate(() => (location.hash = '#/subject/games')); await p.evaluate(() => (location.hash = '#/games/klotski')); await p.waitForFunction(() => !document.querySelector('.klotski-piece') && document.querySelector('#klotski-levels'));
    const list = await p.evaluate(() => { const r = document.querySelector('.klotski-levels').getBoundingClientRect(), cards = [...document.querySelectorAll('.klotski-lv')].map((e) => e.getBoundingClientRect()); return { left: r.left, right: innerWidth - r.right, sw: document.documentElement.scrollWidth, iw: innerWidth, cardsIn: cards.every((c) => c.left >= -1 && c.right <= innerWidth + 1) }; });
    ok(list.sw <= list.iw && list.cardsIn && Math.abs(list.left - list.right) <= 3, `${name}: the list has no overflow and is centred (${Math.round(list.left)} | ${Math.round(list.right)})`);
    await p.screenshot({ path: OUT + `klotski-list-${name}.png` });
    await p.waitForTimeout(300); await p.click('.klotski-lv[data-level=l17]'); await p.waitForSelector('.klotski-frame'); await p.waitForTimeout(300);
    const m = await p.evaluate(() => {
      const f = document.querySelector('.klotski-frame').getBoundingClientRect(), bs = [...document.querySelectorAll('.klotski-btns button')].map((b) => b.getBoundingClientRect()), pc = document.querySelector('.klotski-piece[data-kind=s]').getBoundingClientRect();
      const lab = document.querySelector('.klotski-exit-label').getBoundingClientRect();
      return { l: f.left, r: innerWidth - f.right, top: f.top, bottom: f.bottom, lab: lab.bottom, ih: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, iw: innerWidth, btnIn: bs.every((b) => b.bottom <= innerHeight + 1 && b.left >= 0 && b.right <= innerWidth), cell: pc.width, bw: document.querySelector('.klotski-board').getBoundingClientRect().width };
    });
    ok(m.sw <= m.iw && m.sh <= m.ih + 1 && m.btnIn && m.lab <= m.ih && m.top >= 0, `${name}: the game screen has no overflow, no page scrolling, buttons visible (cell ${Math.round(m.cell)} px)`);
    ok(Math.abs(m.l - m.r) <= 3, `${name}: the board has equal space left and right (${Math.round(m.l)} | ${Math.round(m.r)})`);
    ok(m.cell >= (vp.height < 400 ? 30 : 40), `${name}: pieces are big enough to touch (${Math.round(m.cell)} px)`);
    await p.screenshot({ path: OUT + `klotski-play-${name}.png` });
  }
  ok(errors.length === 0, 'no script errors' + (errors.length ? ': ' + errors.join('; ') : ''));
  ok(t.log.external.length === 0, 'OFFLINE: no request left the app: ' + t.log.external.join(', '));

  // ---------- all Chinese texts of the game are in the translations file ----------
  const src = ['klotski.ts', 'klotski-logic.ts'].map((f) => fs.readFileSync('src/games/' + f, 'utf8')).join('\n');
  const tr = JSON.parse(fs.readFileSync('src/games/klotski.i18n.json', 'utf8'));
  const lits = new Set();
  // the string literals of the source (a small scanner: comments and nested ${} are skipped), turned into the form of the translation keys ({0} for the variable parts)
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
  for (const s of scan(src)) if (/[一-鿿]/.test(s)) lits.add(s);
  const missing = [...lits].filter((s) => !tr[s]);
  ok(missing.length === 0 && Object.values(tr).every((v) => v.length === 2 && v[0] && v[1]) && Object.keys(tr).every((k) => k.length > 1), `every Chinese text of the game (${lits.size}) has an English and a French entry, no one-character keys` + (missing.length ? ': missing ' + missing.join(' | ') : ''));
  await done(t.browser);
})().catch((e) => { console.error(e); process.exit(1); });
