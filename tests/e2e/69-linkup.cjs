// Link-up (连连看): the pure rules (path finder checked against an independent brute force on thousands of boards, moves, no-move detection, generator, shuffle,
// a greedy solver that plays boards out) and the screen (select, mismatch, match with the line, combo, hint, shuffle, auto shuffle, timer, win, game over, pause,
// best score, keyboard, layout on 5 screen sizes, EN / FR, no outside request).
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const CJK = /[一-鿿]/;

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  const p = t.page;
  await p.evaluate(() => (location.hash = '#/games/linkup')); await p.waitForSelector('#lk-grid .lk-tile');

  // ---------- the rules ----------
  const R = await p.evaluate(async () => {
    const M = await import('/src/games/linkup-logic.ts');
    const A = await import('/src/games/linkup-art.ts');
    const res = { bad: [], boards: 0, pairsChecked: 0, linked: 0, notLinked: 0, movesBoards: 0, gens: 0, solved: 0, shuffleUsed: 0, maxShuffle: 0, shuffles: 0 };
    let seed = 987654; const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const mk = (rows, cols) => ({ rows, cols, g: Array.from({ length: rows + 2 }, () => new Array(cols + 2).fill(0)) });
    // independent brute force: enumerate every 0-, 1-, 2-turn path
    const clearSeg = (b, p, q, a, c) => {            // cells strictly between p and q empty (p, q are checked by the caller)
      if (p.r !== q.r && p.c !== q.c) return false;
      const dr = Math.sign(q.r - p.r), dc = Math.sign(q.c - p.c);
      let r = p.r + dr, cc = p.c + dc;
      while (r !== q.r || cc !== q.c) { if (b.g[r][cc] !== 0) return false; r += dr; cc += dc; }
      return true;
    };
    const H = (b) => b.rows + 2, W = (b) => b.cols + 2;
    const free = (b, q, a, c) => q.r >= 0 && q.c >= 0 && q.r < H(b) && q.c < W(b) && (b.g[q.r][q.c] === 0 || (q.r === a.r && q.c === a.c) || (q.r === c.r && q.c === c.c));
    const brute = (b, a, c) => {
      if (a.r === c.r && a.c === c.c) return -1;
      if (clearSeg(b, a, c)) return 0;
      let best = 99;
      const lineCells = (q) => { const o = []; for (let r = 0; r < H(b); r++) o.push({ r, c: q.c }); for (let cc = 0; cc < W(b); cc++) o.push({ r: q.r, c: cc }); return o; };
      // one turn
      for (const k of [{ r: a.r, c: c.c }, { r: c.r, c: a.c }]) {
        if (b.g[k.r][k.c] !== 0) continue;
        if (clearSeg(b, a, k) && clearSeg(b, k, c)) best = Math.min(best, 1);
      }
      // two turns
      for (const k1 of lineCells(a)) {
        if (k1.r === a.r && k1.c === a.c) continue;
        if (b.g[k1.r][k1.c] !== 0 || !clearSeg(b, a, k1)) continue;
        for (const k2 of lineCells(c)) {
          if (k2.r === c.r && k2.c === c.c) continue;
          if (b.g[k2.r][k2.c] !== 0 || !clearSeg(b, c, k2)) continue;
          if (k1.r === k2.r && k1.c === k2.c) continue;
          if ((k1.r === k2.r || k1.c === k2.c) && clearSeg(b, k1, k2)) best = Math.min(best, 2);
        }
      }
      return best === 99 ? -1 : best;
    };
    const validPath = (b, a, c, path) => {
      if (!path || path.length < 2 || path.length > 4) return 'length ' + (path && path.length);
      if (path[0].r !== a.r || path[0].c !== a.c || path[path.length - 1].r !== c.r || path[path.length - 1].c !== c.c) return 'ends';
      for (let i = 1; i < path.length - 1; i++) { const q = path[i]; if (q.r < 0 || q.c < 0 || q.r >= H(b) || q.c >= W(b) || b.g[q.r][q.c] !== 0) return 'corner not empty / outside'; }
      for (let i = 1; i < path.length; i++) {
        if (path[i].r !== path[i - 1].r && path[i].c !== path[i - 1].c) return 'segment not straight';
        if (!clearSeg(b, path[i - 1], path[i])) return 'segment blocked';
      }
      return '';
    };
    // scripted cases
    { const b = mk(4, 4); b.g[2][2] = 1; b.g[2][3] = 1;
      if (M.turnsOf(M.findPath(b, { r: 2, c: 2 }, { r: 2, c: 3 })) !== 0) res.bad.push('adjacent tiles: 0 turns'); }
    { const b = mk(4, 4); b.g[1][1] = 1; b.g[4][4] = 1;
      const pth = M.findPath(b, { r: 1, c: 1 }, { r: 4, c: 4 }); if (!pth || M.turnsOf(pth) !== 1) res.bad.push('corner to corner: one turn'); }
    { const b = mk(3, 3); for (let r = 1; r <= 3; r++) for (let c = 1; c <= 3; c++) b.g[r][c] = 9; b.g[2][2] = 1; b.g[1][1] = 1;
      b.g[1][2] = 8; b.g[2][1] = 7;                 // (2,2) is shut in: nothing can reach it
      if (M.findPath(b, { r: 2, c: 2 }, { r: 1, c: 1 })) res.bad.push('a shut-in tile was linked'); }
    { // the ring: two tiles on the top row of a full board reach each other round the outside (3 segments, 2 turns)
      const b = mk(3, 5); for (let r = 1; r <= 3; r++) for (let c = 1; c <= 5; c++) b.g[r][c] = 9; b.g[1][1] = 1; b.g[1][5] = 1;
      const pth = M.findPath(b, { r: 1, c: 1 }, { r: 1, c: 5 });
      if (!pth || M.turnsOf(pth) !== 2 || validPath(b, { r: 1, c: 1 }, { r: 1, c: 5 }, pth)) res.bad.push('round the outside with 2 turns: ' + JSON.stringify(pth));
      b.g[1][1] = 9; b.g[1][5] = 9; b.g[2][1] = 1; b.g[2][5] = 1;   // from the middle row it takes 4 turns: refused
      if (M.findPath(b, { r: 2, c: 1 }, { r: 2, c: 5 })) res.bad.push('a path with 4 turns was accepted');
      // a Z needing 3 turns is refused
      const b2 = mk(5, 5); for (let r = 1; r <= 5; r++) for (let c = 1; c <= 5; c++) b2.g[r][c] = 9;
      b2.g[1][1] = 0; b2.g[2][1] = 0; b2.g[2][2] = 0; b2.g[2][3] = 0; b2.g[3][3] = 0; b2.g[4][3] = 0; b2.g[4][4] = 0; b2.g[3][1] = 1; b2.g[4][5] = 1; b2.g[4][4] = 0;
      b2.g[4][5] = 1;
      // from (3,1): up (2,1), right (2,2),(2,3), down (3,3),(4,3), right (4,4) then (4,5): 4 turns -> but the ring is blocked by 9s? ring is free: check against brute force instead
      const a = { r: 3, c: 1 }, c = { r: 4, c: 5 };
      const want = brute(b2, a, c), got = M.findPath(b2, a, c);
      if ((want >= 0) !== !!got) res.bad.push('scripted maze mismatch'); }
    // random boards against the brute force
    for (let n = 0; n < 3500; n++) {
      const rows = 2 + Math.floor(rng() * 9), cols = 2 + Math.floor(rng() * 9), dens = 0.15 + rng() * 0.8, kinds = 1 + Math.floor(rng() * 5);
      const b = mk(rows, cols); res.boards++;
      for (let r = 1; r <= rows; r++) for (let c = 1; c <= cols; c++) if (rng() < dens) b.g[r][c] = 1 + Math.floor(rng() * kinds);
      const ts = M.tiles(b);
      const pairs = [];
      if (ts.length <= 14) { for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) pairs.push([ts[i], ts[j]]); }
      else for (let i = 0; i < 25; i++) pairs.push([ts[Math.floor(rng() * ts.length)], ts[Math.floor(rng() * ts.length)]]);
      for (const [a, c] of pairs) {
        res.pairsChecked++;
        const want = brute(b, a, c), got = M.findPath(b, a, c);
        if (want < 0 !== !got) { res.bad.push(`board ${n}: finder ${got ? 'found' : 'missed'} a path (brute ${want}) ${JSON.stringify([a, c])}`); continue; }
        if (got) { res.linked++; const why = validPath(b, a, c, got); if (why) res.bad.push(`board ${n}: invalid path (${why})`); if (M.turnsOf(got) > 2) res.bad.push('more than 2 turns'); if (M.turnsOf(got) !== want) res.bad.push(`board ${n}: turns ${M.turnsOf(got)} vs brute ${want}`); }
        else res.notLinked++;
        const cl = M.canLink(b, a, c);
        const same = b.g[a.r][a.c] === b.g[c.r][c.c] && !(a.r === c.r && a.c === c.c);
        if (!!cl !== (same && !!got)) res.bad.push('canLink: kind check');
      }
      // moves: all pairs of equal kind that the brute force links
      const mv = M.allMoves(b);
      let cnt = 0;
      for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) if (b.g[ts[i].r][ts[i].c] === b.g[ts[j].r][ts[j].c] && brute(b, ts[i], ts[j]) >= 0) cnt++;
      if (mv.length !== cnt) res.bad.push(`board ${n}: ${mv.length} moves, brute force ${cnt}`);
      if (M.hasMove(b) !== (cnt > 0)) res.bad.push(`board ${n}: hasMove wrong`);
      const st = M.status(b); const exp = ts.length === 0 ? 'won' : cnt > 0 ? 'playing' : 'stuck';
      if (st !== exp) res.bad.push(`board ${n}: status ${st} vs ${exp}`);
      if (cnt > 0) res.movesBoards++;
      for (const m of mv.slice(0, 3)) { const why = validPath(b, m.a, m.b, m.path); if (why) res.bad.push('move path invalid ' + why); }
      // removing a pair empties exactly those two cells
      if (mv.length) { const b2 = M.cloneBoard(b), m = mv[0]; if (!M.removePair(b2, m.a, m.b) || M.remaining(b2) !== ts.length - 2 || b2.g[m.a.r][m.a.c] !== 0) res.bad.push('removePair'); }
    }
    // a pair that cannot be linked is not removed
    { const b = mk(3, 3); for (let r = 1; r <= 3; r++) for (let c = 1; c <= 3; c++) b.g[r][c] = 9; b.g[2][2] = 1; b.g[1][1] = 1; if (M.removePair(b, { r: 2, c: 2 }, { r: 1, c: 1 }) || M.remaining(b) !== 9) res.bad.push('removePair removed an unlinkable pair'); }
    // the generator
    const greedy = (b0) => {
      const b = M.cloneBoard(b0); let shuffles = 0, guard = 0;
      while (M.remaining(b) > 0 && guard++ < 2000) {
        const mv = M.allMoves(b, true)[0];
        if (!mv) { if (!M.shuffle(b, rng)) return { ok: false, shuffles }; shuffles++; if (!M.hasMove(b)) return { ok: false, shuffles }; continue; }
        if (!M.removePair(b, mv.a, mv.b)) return { ok: false, shuffles };
      }
      return { ok: M.remaining(b) === 0, shuffles };
    };
    for (const d of M.DIFFS) for (let s = 1; s <= 70; s++) {
      const wide = s % 2 === 0, rows = wide ? d.cols : d.rows, cols = wide ? d.rows : d.cols;
      const b = M.makeBoard(rows, cols, d.kinds, M.mulberry(s * 7919 + d.kinds)); res.gens++;
      if (!M.hasMove(b)) res.bad.push(`${d.id} #${s}: no move at the start`);
      const cnt = new Map(); for (const q of M.tiles(b)) cnt.set(b.g[q.r][q.c], (cnt.get(b.g[q.r][q.c]) || 0) + 1);
      if (M.remaining(b) !== rows * cols || cnt.size !== d.kinds || [...cnt.values()].some((v) => v % 2)) res.bad.push(`${d.id} #${s}: tiles are not pairs / wrong number of kinds (${cnt.size})`);
      for (let r = 0; r < rows + 2; r++) for (let c = 0; c < cols + 2; c++) if ((r === 0 || c === 0 || r === rows + 1 || c === cols + 1) && b.g[r][c] !== 0) res.bad.push('ring not empty');
      const g = greedy(b);
      if (!g.ok) res.bad.push(`${d.id} #${s}: greedy play-out did not clear the board`); else { res.solved++; res.shuffleUsed += g.shuffles; res.maxShuffle = Math.max(res.maxShuffle, g.shuffles); }
    }
    // shuffle: same tiles, always a move, from many half-played boards
    for (let n = 0; n < 300; n++) {
      const d = M.DIFFS[n % 3]; const b = M.makeBoard(d.rows, d.cols, d.kinds, rng);
      const k = Math.floor(rng() * (d.rows * d.cols / 2 - 2)); for (let i = 0; i < k; i++) { const mv = M.pickMove(b, rng); if (!mv) break; M.removePair(b, mv.a, mv.b); }
      const before = M.tiles(b).map((q) => b.g[q.r][q.c]).sort((x, y) => x - y).join(), pos = M.tiles(b).map((q) => q.r + ':' + q.c).join();
      const okS = M.shuffle(b, rng); res.shuffles++;
      const after = M.tiles(b).map((q) => b.g[q.r][q.c]).sort((x, y) => x - y).join();
      if (!okS || !M.hasMove(b) && M.remaining(b) > 0) res.bad.push('shuffle left no move');
      if (before !== after || pos !== M.tiles(b).map((q) => q.r + ':' + q.c).join()) res.bad.push('shuffle changed the set of tiles / cells');
    }
    // a two-tile board can always be shuffled
    { const b = mk(6, 8); b.g[3][3] = 4; b.g[5][7] = 4; if (!M.shuffle(b, rng) || !M.hasMove(b)) res.bad.push('two tiles'); }
    // combo and score
    if (M.nextCombo(0, null) !== 1 || M.nextCombo(1, 1000) !== 2 || M.nextCombo(3, M.COMBO_WINDOW_MS + 1) !== 1 || M.nextCombo(2, 100) !== 3) res.bad.push('combo');
    if (M.pairScore(1) !== 10 || M.pairScore(2) !== 15 || M.pairScore(4) !== 25 || M.pairScore(99) !== 60) res.bad.push('pairScore');
    if (M.timeBonusSec(1) !== 0 || M.timeBonusSec(2) !== 1 || M.timeBonusSec(9) !== 3) res.bad.push('timeBonus');
    if (M.totalMs(10, 8) !== 80 * 1600 || M.DIFFS.map((d) => d.cols + 'x' + d.rows + ':' + d.kinds).join() !== '6x8:12,8x10:20,10x12:28') res.bad.push('levels');
    // pictures
    const names = A.PICTURES.map((q) => q.name);
    res.pictures = A.PICTURES.length;
    if (new Set(names).size !== names.length || A.PICTURES.length < 28) res.bad.push('pictures: fewer than 28 or duplicate names');
    for (const q of A.PICTURES) { const d = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${q.art}</svg>`, 'image/svg+xml'); if (d.querySelector('parsererror') || !d.querySelector('circle,path,ellipse')) res.bad.push('picture not valid svg: ' + q.name); if (/<text|[一-鿿]/.test(q.art)) res.bad.push('text in picture ' + q.name); }
    return res;
  });
  ok(R.bad.length === 0, `the rules: ${R.boards} random boards, ${R.pairsChecked} pairs against the brute force (${R.linked} linked / ${R.notLinked} not), moves, status, generator, shuffle` + (R.bad.length ? ': ' + R.bad.slice(0, 5).join(' | ') : ''));
  ok(R.linked > 3000 && R.notLinked > 3000 && R.movesBoards > 1500, `the random boards cover both linked and unlinked pairs (${R.linked} / ${R.notLinked}, ${R.movesBoards} boards with a move)`);
  ok(R.solved === 210 && R.gens === 210, `${R.gens} generated boards (3 levels, both orientations): each has a move at the start and a greedy solver clears all of them (${R.solved}); shuffles needed in total ${R.shuffleUsed}, at most ${R.maxShuffle} on one board`);
  ok(R.maxShuffle <= 40, `no board needs an absurd number of shuffles (${R.maxShuffle})`);
  ok(R.pictures >= 28, `${R.pictures} different pictures, all valid SVG without text`);

  // ---------- the screen ----------
  let sc00 = 0;
  const hook = (fn, arg) => p.evaluate(fn, arg);
  const st = () => hook(() => window.__linkup.state());
  const logic = `import('/src/games/linkup-logic.ts')`;
  const box = (r, c) => hook(({ r, c }) => { const q = document.querySelector(`.lk-tile[data-r="${r}"][data-c="${c}"]`).getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; }, { r, c });
  const tap = async (r, c) => { const q = await box(r, c); await p.mouse.click(q.x, q.y); };
  // a board of our own: cells = [[r, c, kind], ...]; everything else empty
  const setBoard = (cells) => hook((cs) => { const b = window.__linkup.board(); for (let r = 0; r <= b.rows + 1; r++) for (let c = 0; c <= b.cols + 1; c++) b.g[r][c] = 0; for (const [r, c, k] of cs) b.g[r][c] = k; window.__linkup.refresh(); }, cells);
  const best = () => hook(() => { try { return JSON.parse(localStorage.getItem('learn.games.v1')).linkup || {}; } catch (e) { return {}; } });

  ok(await p.locator('#lk-ovl').isVisible() && (await p.textContent('#lk-ovl h2')) === '连连看' && (await p.textContent('#lk-start')) === '开始', 'ready: the overlay with the name and the start button');
  let s = await st();
  ok(s.phase === 'ready' && s.diff === 'normal' && s.rows === 10 && s.cols === 8 && s.kinds === 20 && s.timed, `normal level on a portrait screen: 8 x 10, 20 kinds (${s.cols} x ${s.rows}, ${s.kinds})`);
  ok(await p.locator('.lk-tile').count() === 80, '80 tiles on the board');
  ok((await p.textContent('#lk-score')) === '得分：0' && (await p.textContent('#lk-best')) === '最高：0' && (await p.textContent('#lk-time')) === `时间：${Math.ceil(80 * 1.6)}` && (await p.textContent('#lk-hint')) === '提示：5' && (await p.textContent('#lk-shuffle')) === '洗牌：3', 'the HUD: score, best, time (1.6 s a tile), 5 hints, 3 shuffles');
  await p.screenshot({ path: OUT + 'linkup-ready-820.png' });
  await p.click('#lk-start');
  ok((await st()).phase === 'play' && !(await p.locator('#lk-ovl').isVisible()), 'Start begins the game');
  await p.screenshot({ path: OUT + 'linkup-play-820.png' });

  // select, unselect, mismatch
  const pr = await hook(async () => { const M = await import('/src/games/linkup-logic.ts'); const b = window.__linkup.board(); const mv = M.allMoves(b)[0]; const ts = M.tiles(b); const other = ts.find((q) => b.g[q.r][q.c] !== b.g[mv.a.r][mv.a.c]); return { a: mv.a, b: mv.b, other }; });
  await tap(pr.a.r, pr.a.c);
  s = await st(); ok(s.sel && s.sel.r === pr.a.r && s.sel.c === pr.a.c && await p.locator(`.lk-tile.sel[data-r="${pr.a.r}"][data-c="${pr.a.c}"]`).count() === 1, 'a tap selects a tile (ring + pop)');
  await tap(pr.a.r, pr.a.c); s = await st(); ok(!s.sel && await p.locator('.lk-tile.sel').count() === 0, 'tapping the selected tile again unselects it');
  await tap(pr.a.r, pr.a.c); await tap(pr.other.r, pr.other.c); s = await st();
  ok(s.left === 80 && s.sel && s.sel.r === pr.other.r && s.sel.c === pr.other.c && s.score === 0, 'a different picture: nothing is removed, the second tile becomes the selection');
  // same picture, no path: shut-in tiles
  const wall = []; for (let r = 1; r <= 10; r++) for (let c = 1; c <= 8; c++) wall.push([r, c, 3 + ((r * 3 + c * 7) % 18)]);
  const shut = wall.filter(([r, c]) => !(r === 4 && c === 4) && !(r === 7 && c === 5)); shut.push([4, 4, 1], [7, 5, 1]);
  await setBoard(shut); await tap(4, 4); await tap(7, 5);
  s = await st();
  ok(s.left === 80 && s.sel && s.sel.r === 7 && s.sel.c === 5 && s.score === 0 && await p.locator('.lk-tile.shake').count() === 1, 'the same picture without a path: nothing happens, a gentle shake, the second tile is selected');

  // a match: line, sparkles, points, combo, time bonus
  await setBoard([[1, 1, 1], [1, 3, 1], [5, 5, 2], [7, 5, 2], [9, 2, 3], [9, 8, 3]]);
  await hook(() => window.__linkup.tick(10000));
  const rem0 = (await st()).remMs, wall0 = Date.now();
  await tap(1, 1); await tap(1, 3);
  s = await st();
  ok(s.score === 10 && s.combo === 1 && s.left === 4 && await p.locator('.lk-tile.gone').count() >= 2 && await p.locator('.lk-tile.sel').count() === 0, 'a match: the pair disappears, 10 points, combo 1');
  ok(await p.locator('.lk-line').count() === 1 && (await p.getAttribute('.lk-line', 'points')).split(' ').length >= 2 && await p.locator('.lk-spark').count() >= 10, 'the crayon line and the sparkles are there');
  await p.screenshot({ path: OUT + 'linkup-match-820.png' });
  await tap(5, 5); await tap(7, 5);
  s = await st();
  ok(s.score === 25 && s.combo === 2 && s.remMs >= rem0 + 1000 - (Date.now() - wall0) - 150 && (await p.textContent('#lk-combo')) === '连击：2' && (await p.textContent('#lk-score')) === '得分：25', `a quick second match: combo 2, 15 points, one second added (${Math.round(s.remMs - rem0)} ms, ${Date.now() - wall0} ms passed)`);
  await p.waitForFunction(() => document.querySelectorAll('.lk-line').length === 0, null, { timeout: 3000 });
  ok(true, 'the line disappears by itself');
  // the combo runs out
  await hook(() => window.__linkup.tick(4500)); s = await st(); ok(s.combo === 0 && (await p.textContent('#lk-combo')) === '连击：0', 'the combo ends after 4 seconds without a match');
  // win: last pair, finish bonus, best saved
  const remBefore = (await st()).remMs;
  await tap(9, 2); await tap(9, 8);
  s = await st();
  ok(s.phase === 'won' && s.left === 0 && s.score === 25 + 10 + Math.floor(s.remMs / 1000) * 2, `the last pair wins: 10 + the time left (${s.score})`);
  await p.waitForSelector('#lk-ovl:not([hidden])');
  ok((await p.textContent('#lk-ovl h2')) === '全部消除。' && (await p.textContent('#lk-ovl p')).includes(`得分：${s.score}`) && (await p.textContent('#lk-start')) === '再玩一次', 'win overlay: text, score, play again ' + (await p.textContent('#lk-ovl h2')) + ' | ' + (await p.textContent('#lk-ovl p')) + ' | ' + s.score);
  await p.screenshot({ path: OUT + 'linkup-win-820.png' });
  let bs = await best();
  ok(bs['best-normal'] === s.score && (await p.textContent('#lk-best')) === `最高：${s.score}`, `the best score is kept in learn.games.v1 (${bs['best-normal']}) and shown`);
  const winScore = s.score;
  await p.click('#lk-start');
  s = await st(); ok(s.phase === 'play' && s.score === 0 && s.left === 80 && (await p.textContent('#lk-best')) === `最高：${winScore}`, 'play again: a new board, score 0, the best stays');

  // hints
  await p.click('#lk-hint');
  s = await st();
  const hv = await hook(async () => { const M = await import('/src/games/linkup-logic.ts'); const h = window.__linkup.state().hint; return h ? !!M.canLink(window.__linkup.board(), h.a, h.b) : null; });
  ok(s.hints === 4 && hv === true && await p.locator('.lk-tile.hint').count() === 2 && await p.locator('.lk-line.hintline').count() === 1 && (await p.textContent('#lk-hint')) === '提示：4', 'hint: a connectable pair pulses and its path is shown, 4 hints left');
  await p.screenshot({ path: OUT + 'linkup-hint-820.png' });
  await tap(s.hint.a.r, s.hint.a.c);
  ok(await p.locator('.lk-tile.hint').count() === 0 && await p.locator('.lk-line.hintline').count() === 0, 'a tap clears the hint');
  for (let i = 0; i < 4; i++) await p.click('#lk-hint');
  ok((await st()).hints === 0 && await p.locator('#lk-hint').isDisabled(), 'five hints a game, then the button is off');
  // manual shuffle
  const tilesOf = () => hook(() => { const b = window.__linkup.board(); return b.g.flat().filter(Boolean).sort((a, c) => a - c).join(','); });
  const t0 = await tilesOf(), g0 = await hook(() => JSON.stringify(window.__linkup.board().g));
  await p.click('#lk-shuffle');
  s = await st();
  ok(s.shuffles === 2 && (await tilesOf()) === t0 && (await hook(() => JSON.stringify(window.__linkup.board().g))) !== g0 && (await p.textContent('#lk-shuffle')) === '洗牌：2' && await hook(async () => (await import('/src/games/linkup-logic.ts')).hasMove(window.__linkup.board())), 'shuffle: same tiles, other places, a move left, 2 shuffles left');
  await p.click('#lk-shuffle'); await p.click('#lk-shuffle');
  ok((await st()).shuffles === 0 && await p.locator('#lk-shuffle').isDisabled(), 'three shuffles a game, then the button is off');

  // auto shuffle when no move is left
  await p.click('#lk-start').catch(() => {});
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.evaluate(() => (location.hash = '#/games/linkup')); await p.waitForSelector('#lk-grid .lk-tile');
  await p.click('#lk-start');
  // kind 1 pair side by side; kind 2 tiles shut in by 4 single tiles each (kinds 3..10)
  const stuck = [[1, 1, 1], [1, 2, 1], [3, 3, 2], [6, 6, 2], [2, 3, 3], [4, 3, 4], [3, 2, 5], [3, 4, 6], [5, 6, 7], [7, 6, 8], [6, 5, 9], [6, 7, 10]];
  await setBoard(stuck);
  const pre = await hook(async () => { const M = await import('/src/games/linkup-logic.ts'); const b = M.cloneBoard(window.__linkup.board()); M.removePair(b, { r: 1, c: 1 }, { r: 1, c: 2 }); return { has: M.hasMove(b), status: M.status(b) }; });
  ok(!pre.has && pre.status === 'stuck', 'set up: after the first pair there would be no move left');
  await tap(1, 1); await tap(1, 2);
  s = await st();
  ok(s.autoShuffles === 1 && s.phase === 'play' && s.left === 10 && await hook(async () => (await import('/src/games/linkup-logic.ts')).hasMove(window.__linkup.board())), 'no move left: the tiles are shuffled by themselves and a move exists');
  ok(await p.locator('#toasts .toast', { hasText: '无可连接的图案，已自动洗牌。' }).count() === 1, 'a short message says so');
  ok((await st()).shuffles === 3, 'the automatic shuffle does not use up the 3 shuffles');

  // keyboard
  await setBoard([[1, 1, 1], [1, 3, 1], [5, 5, 2], [7, 5, 2], [9, 2, 3], [9, 8, 3]]);
  for (let i = 0; i < 12; i++) await p.keyboard.press('ArrowUp'); for (let i = 0; i < 12; i++) await p.keyboard.press('ArrowLeft');
  s = await st(); ok(s.cur.r === 1 && s.cur.c === 1 && await p.locator('.lk-tile.cur').count() === 1, 'arrows move a cursor (stops at the edge)');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('Space');
  s = await st(); sc00 = s.score; ok(s.sel && s.sel.r === 1 && s.sel.c === 1, 'Space selects the tile under the cursor');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter');
  s = await st(); ok(s.score > sc00 && s.left === 4 && !s.sel, 'Enter on the second one makes the match');
  const sc0 = sc00, h0 = s.hints; await p.keyboard.press('h'); s = await st(); ok(s.hints === h0 - 1 && s.hint, 'H shows a hint');
  const sh0 = s.shuffles; await p.keyboard.press('s'); s = await st(); ok(s.shuffles === sh0 - 1, 'S shuffles');
  // pause
  await p.keyboard.press('p');
  s = await st(); ok(s.phase === 'pause' && await p.locator('#lk-ovl').isVisible() && (await p.textContent('#lk-ovl h2')) === '已暂停' && (await p.textContent('#lk-pause')) === '继续', 'P pauses: the overlay covers the board');
  const rp = s.remMs; await hook(() => window.__linkup.tick(5000)); await p.waitForTimeout(350);
  ok(Math.abs((await st()).remMs - rp) < 1 && (await p.locator('.lk-tile.sel').count()) === 0, 'the clock stands still while paused');
  await tap(5, 5); ok((await st()).sel === null, 'tiles cannot be played while paused');
  await p.click('#lk-start'); ok((await st()).phase === 'play', 'the button continues');

  // timer and game over
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.evaluate(() => (location.hash = '#/games/linkup')); await p.waitForSelector('#lk-grid .lk-tile');
  await p.click('#lk-start');
  s = await st(); const tot = s.totMs;
  await hook(() => window.__linkup.tick(5000)); s = await st();
  ok(s.remMs <= tot - 5000 && s.remMs > tot - 8000 && (await p.textContent('#lk-time')) === `时间：${Math.ceil(s.remMs / 1000)}`, 'the clock runs down and the time pill follows');
  const wBar = await p.evaluate(() => document.querySelector('#lk-bar i').getBoundingClientRect().width / document.querySelector('#lk-bar').getBoundingClientRect().width);
  ok(wBar < 0.99 && wBar > 0.8, 'the bar shrinks (' + wBar.toFixed(2) + ')');
  await hook((tt) => window.__linkup.tick(tt), tot); s = await st();
  ok(s.phase === 'lost' && s.remMs === 0, 'time is up: game over');
  await p.waitForSelector('#lk-ovl:not([hidden])');
  ok((await p.textContent('#lk-ovl h2')) === '时间到。' && (await p.textContent('#lk-start')) === '重试' && (await p.textContent('#lk-ovl p')).includes('剩余图案：80'), 'overlay: time is up, remaining tiles, retry button');
  await p.screenshot({ path: OUT + 'linkup-lost-820.png' });
  await p.click('#lk-start'); s = await st(); ok(s.phase === 'play' && s.left === 80 && s.remMs >= s.totMs - 1500, 'retry: a new board, the full time');
  // relaxed mode
  await p.click('#lk-timed');
  s = await st(); ok(!s.timed && s.phase === 'ready' && (await p.textContent('#lk-timed')) === '计时：关' && (await p.textContent('#lk-time')) === '时间：不限', 'relaxed mode: no time, a new game is ready');
  await p.click('#lk-start'); await hook(() => window.__linkup.tick(900000)); s = await st();
  ok(s.phase === 'play' && s.remMs === s.totMs, 'relaxed mode: the game never ends by time');
  await setBoard([[1, 1, 1], [1, 3, 1]]); await tap(1, 1); await tap(1, 3);
  await p.waitForSelector('#lk-ovl:not([hidden])'); s = await st();
  ok(s.phase === 'won' && s.score === 10, 'relaxed mode: no time bonus at the end');
  bs = await best(); ok(bs['best-normal-relaxed'] === 10 && bs['best-normal'] === winScore, 'relaxed games keep their own best score');
  await p.click('#lk-timed');   // back to timed

  // levels
  const lv = {};
  for (let i = 0; i < 3; i++) {
    await p.click('#lk-diff'); await p.waitForTimeout(80);
    s = await st(); const uses = await p.evaluate(() => new Set([...document.querySelectorAll('.lk-tile use')].map((u) => u.getAttribute('href'))).size);
    lv[s.diff] = { cols: s.cols, rows: s.rows, kinds: s.kinds, uses, label: await p.textContent('#lk-diff'), tiles: await p.locator('.lk-tile').count() };
  }
  ok(lv.hard && lv.hard.cols === 10 && lv.hard.rows === 12 && lv.hard.kinds === 28 && lv.hard.uses === 28 && lv.hard.tiles === 120 && lv.hard.label === '难度：困难', 'hard: 10 x 12, 28 kinds of pictures');
  ok(lv.easy && lv.easy.cols === 6 && lv.easy.rows === 8 && lv.easy.kinds === 12 && lv.easy.uses === 12 && lv.easy.tiles === 48 && lv.easy.label === '难度：简单', 'easy: 6 x 8, 12 kinds of pictures');
  ok(lv.normal && lv.normal.cols === 8 && lv.normal.rows === 10 && lv.normal.kinds === 20 && lv.normal.uses === 20 && lv.normal.label === '难度：普通', 'normal: 8 x 10, 20 kinds of pictures');
  ok((await best()).diff === 1 && (await best()).timed === true, 'the level and the timer switch are remembered on this device');

  // ---------- layout ----------
  const sizes = [[390, 844, 'phone'], [320, 568, 'small'], [820, 1180, 'ipad-up'], [1180, 820, 'ipad-side'], [844, 390, 'short']];
  const minTile = { phone: { easy: 30, normal: 30, hard: 24 }, small: { easy: 26, normal: 20, hard: 16 }, 'ipad-up': { easy: 40, normal: 40, hard: 30 }, 'ipad-side': { easy: 40, normal: 40, hard: 30 }, short: { easy: 26, normal: 24, hard: 20 } };
  for (const [w, hgt, name] of sizes) {
    await p.setViewportSize({ width: w, height: hgt });
    for (const [di, dn] of [[0, 'easy'], [1, 'normal'], [2, 'hard']]) {
      await p.evaluate((d) => { const g = JSON.parse(localStorage.getItem('learn.games.v1') || '{}'); g.linkup = { ...(g.linkup || {}), diff: d, timed: true }; localStorage.setItem('learn.games.v1', JSON.stringify(g)); }, di);
      await p.evaluate(() => (location.hash = '#/subject/games')); await p.evaluate(() => (location.hash = '#/games/linkup')); await p.waitForSelector('#lk-grid .lk-tile');
      await p.waitForTimeout(250);
      const m = await p.evaluate(() => {
        const Rr = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
        const tl = document.querySelector('.lk-tile').getBoundingClientRect();
        return { f: Rr('#lk-field'), hud: Rr('.lk-hud'), vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, tile: tl.width, st: window.__linkup.state(), btns: [...document.querySelectorAll('.lk-hud button')].every((b) => { const r = b.getBoundingClientRect(); return r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 && r.height >= 30; }) };
      });
      const inside = (q) => q.l >= -0.5 && q.r <= m.vw + 0.5 && q.t >= -0.5 && q.b <= m.vh + 0.5;
      const label = `${name} ${w}x${hgt} ${dn} (${m.st.cols}x${m.st.rows}, tile ${Math.round(m.tile)}px)`;
      ok(inside(m.f) && inside(m.hud) && m.btns, `${label}: board, HUD and buttons are on the screen`);
      ok(m.sw <= m.vw && m.sh <= m.vh + 1, `${label}: no page scrolling`);
      if (name !== 'short') ok(Math.abs(m.f.l - (m.vw - m.f.r)) <= 3, `${label}: the board is centred (${Math.round(m.f.l)} / ${Math.round(m.vw - m.f.r)})`);
      if (name === 'ipad-side') ok(Math.abs(m.f.l - (m.vw - m.f.r)) <= 3 && m.st.cols > m.st.rows, `${label}: a landscape screen turns the board (${m.st.cols} wide, ${m.st.rows} high)`);
      if (name === 'ipad-up' || name === 'phone') ok(m.st.rows > m.st.cols, `${label}: a portrait screen keeps it upright`);
      ok(m.tile >= minTile[name][dn], `${label}: tiles are big enough (${Math.round(m.tile)} >= ${minTile[name][dn]})`);
      if (dn === 'normal' || name === 'phone' || name === 'small') await p.screenshot({ path: OUT + `linkup-${name}-${dn}.png` });
    }
  }
  // hit areas: a tap near the edge of a cell still counts (cell, not only the picture)
  await p.setViewportSize({ width: 390, height: 844 });
  await p.evaluate(() => { const g = JSON.parse(localStorage.getItem('learn.games.v1')); g.linkup.diff = 1; localStorage.setItem('learn.games.v1', JSON.stringify(g)); });
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.evaluate(() => (location.hash = '#/games/linkup')); await p.waitForSelector('#lk-grid .lk-tile');
  await p.click('#lk-start');
  { const q = await p.evaluate(() => { const r = document.querySelector('.lk-tile[data-r="3"][data-c="3"]').getBoundingClientRect(); return { x: r.left + 1, y: r.top + 1 }; }); await p.mouse.click(q.x, q.y); const s2 = await st(); ok(s2.sel && s2.sel.r === 3 && s2.sel.c === 3, 'a tap on the very corner of a cell selects it'); }
  // a touch screen: tap with a finger
  { const tt = await start(new Map(), { local: true, viewport: { width: 390, height: 844 }, touch: true });
    const pp = tt.page; await pp.evaluate(() => (location.hash = '#/games/linkup')); await pp.waitForSelector('#lk-grid .lk-tile'); await pp.tap('#lk-start'); await pp.waitForSelector('.lk-tile[data-r="2"][data-c="2"]');
    const q = await pp.evaluate(() => { const r = document.querySelector('.lk-tile[data-r="2"][data-c="2"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await pp.touchscreen.tap(q.x, q.y);
    const s3 = await pp.evaluate(() => window.__linkup.state());
    ok(s3.phase === 'play' && s3.sel && s3.sel.r === 2 && s3.sel.c === 2, 'a finger tap selects a tile');
    ok(await pp.evaluate(() => getComputedStyle(document.querySelector('#lk-field')).touchAction === 'manipulation'), 'no double-tap zoom on the board');
    await tt.browser.close(); }

  // leaving stops it
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-grid');
  await p.waitForFunction(() => !window.__linkup);
  ok(true, 'leaving the game removes it (the hook is gone)');
  await p.keyboard.press('ArrowUp'); await p.keyboard.press('h');
  ok(t.log.external.length === 0, 'no request left the app');
  await t.browser.close();

  // ---------- EN / FR ----------
  for (const [loc, lang] of [['en-US', 'en'], ['fr-FR', 'fr']]) {
    const tl = await start(new Map(), { local: true, locale: loc, viewport: { width: 390, height: 844 } });
    // the lead merges linkup.i18n.json into src/i18n-data.ts; until then the module is served with the game's own texts added (and does nothing once they are in)
    const own = JSON.parse(fs.readFileSync('src/games/linkup.i18n.json', 'utf8'));
    await tl.ctx.route(/\/src\/i18n-data\.ts/, async (route) => {
      const r = await route.fetch(); let body = await r.text();
      const add = (name, i) => `\nfor (const [k, v] of Object.entries(${JSON.stringify(Object.fromEntries(Object.entries(own).map(([k, v]) => [k, v[i]])))})) { if (!(k in ${name})) ${name}[k] = v; }\n`;
      await route.fulfill({ response: r, body: body + add('EN', 0) + add('FR', 1) });
    });
    const q = tl.page;
    await q.reload(); await q.waitForLoadState('load');
    const text = () => q.evaluate(() => document.querySelector('.lk-wrap').innerText + '\n' + [...document.querySelectorAll('#toasts .toast')].map((x) => x.innerText).join('\n'));
    const noCjk = async (what) => { const tx = await text(); ok(!CJK.test(tx), `${lang}: ${what} has no Chinese left` + (CJK.test(tx) ? ': ' + tx.replace(/\s+/g, ' ').slice(0, 200) : '')); return tx; };
    await q.evaluate(() => (location.hash = '#/games/linkup')); await q.waitForSelector('#lk-grid .lk-tile');
    const stq = () => q.evaluate(() => window.__linkup.state());
    let tx = await noCjk('the ready screen');
    ok(lang === 'en' ? /Link-up|Connect/i.test(tx) && /Start/.test(tx) && /Score/.test(tx) && /Hint/.test(tx) : /Commencer|Démarrer/.test(tx) && /Score/.test(tx) && /Indice/.test(tx), `${lang}: the texts are translated (${tx.replace(/\s+/g, ' ').slice(0, 120)})`);
    await q.screenshot({ path: OUT + `linkup-ready-${lang}.png` });
    await q.click('#lk-start'); await noCjk('the board');
    await q.click('#lk-hint'); await noCjk('a hint');
    await q.click('#lk-shuffle'); await noCjk('a shuffle (message)');
    await q.keyboard.press('p'); tx = await noCjk('the pause overlay'); await q.screenshot({ path: OUT + `linkup-pause-${lang}.png` }); await q.keyboard.press('p');
    // automatic shuffle message + win overlay
    const setB = (cells) => q.evaluate((cs) => { const b = window.__linkup.board(); for (let r = 0; r <= b.rows + 1; r++) for (let c = 0; c <= b.cols + 1; c++) b.g[r][c] = 0; for (const [r, c, k] of cs) b.g[r][c] = k; window.__linkup.refresh(); }, cells);
    const tapq = async (r, c) => { const bb = await q.evaluate(({ r, c }) => { const e = document.querySelector(`.lk-tile[data-r="${r}"][data-c="${c}"]`).getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + e.height / 2 }; }, { r, c }); await q.mouse.click(bb.x, bb.y); };
    await setB([[1, 1, 1], [1, 2, 1], [3, 3, 2], [6, 6, 2], [2, 3, 3], [4, 3, 4], [3, 2, 5], [3, 4, 6], [5, 6, 7], [7, 6, 8], [6, 5, 9], [6, 7, 10]]);
    await tapq(1, 1); await tapq(1, 2);
    tx = await noCjk('the automatic shuffle message');
    ok(lang === 'en' ? /reshuffled|shuffled/i.test(tx) : /mélang/i.test(tx), `${lang}: the automatic shuffle message is there (${tx.replace(/\s+/g, ' ').slice(-90)})`);
    await setB([[1, 1, 1], [1, 3, 1]]); await tapq(1, 1); await tapq(1, 3);
    await q.waitForSelector('#lk-ovl:not([hidden])'); tx = await noCjk('the win overlay'); await q.screenshot({ path: OUT + `linkup-win-${lang}.png` });
    await q.click('#lk-start'); await q.evaluate(() => window.__linkup.tick(1e9));
    await q.waitForSelector('#lk-ovl:not([hidden])'); tx = await noCjk('the game over overlay');
    ok(lang === 'en' ? /Time is up/i.test(tx) && /Retry|Try again/i.test(tx) : /temps/i.test(tx), `${lang}: game over text (${tx.replace(/\s+/g, ' ').slice(0, 100)})`);
    await q.click('#lk-start'); await q.click('#lk-timed'); await noCjk('relaxed mode'); await q.click('#lk-diff'); await noCjk('another level');
    const m = await q.evaluate(() => { const f = document.querySelector('#lk-field').getBoundingClientRect(); return { l: f.left, r: innerWidth - f.right, sw: document.documentElement.scrollWidth, vw: innerWidth, btns: [...document.querySelectorAll('.lk-hud button')].every((b) => b.scrollWidth <= b.clientWidth + 1 && b.getBoundingClientRect().right <= innerWidth + 0.5) }; });
    ok(m.sw <= m.vw && Math.abs(m.l - m.r) <= 3 && m.btns, `${lang}: nothing overflows on a phone (labels fit their buttons)`);
    ok(tl.log.external.length === 0, `${lang}: no outside request`);
    await tl.browser.close();
  }
  await done();
})();
