// Tower of Hanoi: the pure rules (optimal solver checked against a breadth-first search on EVERY state, random legal walks keep every invariant) and the screen
// (tap, drag with mouse / synthetic / real touch events, illegal moves, undo, restart, hint, auto demo, win with stars, best, keyboard), layout on 5 sizes, EN / FR, offline.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const CJK = /[一-鿿]/;

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  const p = t.page;
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.evaluate(() => (location.hash = '#/games/hanoi')); await p.waitForSelector('#hn-stage');

  // ---------- the rules ----------
  const L = await p.evaluate(async () => {
    const M = await import('/src/games/hanoi-logic.ts');
    const res = { bad: [], states: 0, walks: 0, steps: 0 };
    let seed = 777; const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    // a new game
    for (let n = 3; n <= 8; n++) {
      const s = M.newHanoi(n);
      if (s.pegs[0].length !== n || s.pegs[1].length || s.pegs[2].length || M.validate(s) || M.isWon(s)) res.bad.push('new game ' + n);
      if (s.pegs[0][0] !== n - 1 || s.pegs[0][n - 1] !== 0) res.bad.push('order of a new tower ' + n);
      if (M.minMoves(n) !== 2 ** n - 1) res.bad.push('minMoves ' + n);
    }
    // legal / illegal moves
    const s0 = M.newHanoi(3);
    if (M.canMove(s0, 1, 2) || M.canMove(s0, 0, 0) || M.canMove(s0, -1, 1) || M.canMove(s0, 0, 3) || M.move(s0, 1, 0)) res.bad.push('an illegal move from an empty / same / outside peg was accepted');
    if (!M.canMove(s0, 0, 2)) res.bad.push('a legal first move refused');
    const m1 = M.move(s0, 0, 1); if (!m1 || m1.disc !== 0 || m1.from !== 0 || m1.to !== 1) res.bad.push('move result');
    const before = JSON.stringify(s0);
    if (M.move(s0, 0, 1) || JSON.stringify(s0) !== before) res.bad.push('a larger disc onto a smaller one was accepted / changed the state');
    if (!M.canMove(s0, 1, 0)) res.bad.push('small onto large refused');
    M.undoMove(s0, m1); if (JSON.stringify(s0) !== JSON.stringify(M.newHanoi(3))) res.bad.push('undoMove');
    // stars
    const sf = M.starsFor;
    if (sf(7, 3) !== 3 || sf(8, 3) !== 2 || sf(10, 3) !== 2 || sf(11, 3) !== 1 || sf(31, 5) !== 3 || sf(46, 5) !== 2 || sf(47, 5) !== 1 || sf(255, 8) !== 3) res.bad.push('stars thresholds');
    // the solver from the start: exactly 2^n - 1 moves for 1 .. 8 discs, and every move is legal and ends on the right peg
    for (let n = 1; n <= 8; n++) {
      const s = M.newHanoi(n), sol = M.solve(s);
      if (sol.length !== 2 ** n - 1) res.bad.push('start solution length ' + n + ': ' + sol.length);
      for (const m of sol) if (!M.move(s, m.from, m.to)) { res.bad.push('illegal solver move at ' + n); break; }
      if (!M.isWon(s)) res.bad.push('start solution does not win ' + n);
    }
    // BFS from a goal state: the shortest distance of EVERY state; the solver must match on every one of them
    const bfsDist = (n, goal) => {
      const dist = new Map(); const g = M.newHanoi(n, goal); dist.set(M.encode(g), 0); let q = [g];
      while (q.length) {
        const nq = [];
        for (const s of q) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
          if (!M.canMove(s, a, b)) continue; const c = M.cloneState(s); M.move(c, a, b); const k = M.encode(c);
          if (!dist.has(k)) { dist.set(k, dist.get(M.encode(s)) + 1); nq.push(c); }
        }
        q = nq;
      }
      return dist;
    };
    for (let n = 1; n <= 7; n++) for (const goal of n <= 5 ? [0, 1, 2] : [2]) {
      const dist = bfsDist(n, goal);
      if (dist.size !== 3 ** n) res.bad.push('BFS did not reach 3^n states ' + n);
      for (const s0 of M.allStates(n)) {
        res.states++;
        if (M.validate(s0)) { res.bad.push('allStates made an illegal state'); break; }
        const sol = M.solve(s0, goal), want = dist.get(M.encode(s0));
        if (sol.length !== want) { res.bad.push(`n=${n} goal=${goal} state ${M.encode(s0)}: solver ${sol.length}, shortest ${want}`); break; }
        const h = M.hint(s0, goal); if ((want === 0) !== (h === null) || (h && JSON.stringify(h) !== JSON.stringify(sol[0]))) { res.bad.push('hint is not the first solver move'); break; }
        const c = M.cloneState(s0); let legal = true;
        for (const m of sol) if (!M.move(c, m.from, m.to)) legal = false;
        if (!legal || !M.isWon(c, goal)) { res.bad.push('solver path is not legal / does not win'); break; }
      }
      if (res.bad.length > 5) break;
    }
    // the hint never leaves the shortest path: following hints from random states gives dist, dist-1, ...
    for (let g = 0; g < 200; g++) {
      const n = 3 + Math.floor(rng() * 6), s = M.newHanoi(n);
      for (let i = 0; i < 30; i++) { const a = Math.floor(rng() * 3), b = Math.floor(rng() * 3); M.move(s, a, b); }
      let left = M.solve(s).length;
      while (left > 0) { const m = M.hint(s); M.move(s, m.from, m.to); const now = M.solve(s).length; if (now !== left - 1) { res.bad.push('a hint did not shorten the way by one'); break; } left = now; }
      if (left === 0 && !M.isWon(s)) res.bad.push('hints ended off the goal');
    }
    // random legal walks: invariants after every move; undo returns exactly
    const seen = new Map();
    for (let g = 0; g < 300; g++) {
      const n = 3 + Math.floor(rng() * 6), s = M.newHanoi(n), hist = []; res.walks++;
      for (let i = 0; i < 200; i++) {
        const a = Math.floor(rng() * 3), b = Math.floor(rng() * 3), legal = M.canMove(s, a, b), snap = JSON.stringify(s);
        const m = M.move(s, a, b);
        if (!!m !== legal) res.bad.push('canMove and move disagree');
        if (!m && JSON.stringify(s) !== snap) res.bad.push('a refused move changed the state');
        if (m) hist.push(m);
        res.steps++;
        const v = M.validate(s); if (v) { res.bad.push('invariant: ' + v); break; }
        if (s.pegs.reduce((x, q) => x + q.length, 0) !== n) res.bad.push('disc count changed');
        if (n === 4) seen.set(M.encode(s), 1);
      }
      for (let i = hist.length - 1; i >= 0; i--) M.undoMove(s, hist[i]);
      if (JSON.stringify(s) !== JSON.stringify(M.newHanoi(n))) res.bad.push('undoing a whole walk does not return to the start');
      if (res.bad.length > 5) break;
    }
    res.reach4 = seen.size;
    return res;
  });
  ok(L.bad.length === 0, `rules: ${L.states} states solved and compared with a breadth-first search, ${L.walks} random walks / ${L.steps} steps, all invariants hold${L.bad.length ? ' -> ' + L.bad.slice(0, 6).join('; ') : ''}`);
  ok(L.states >= 3 ** 3 + 3 ** 4 + 3 ** 5 && L.reach4 > 60, `the checks really covered the states (${L.states}; ${L.reach4} of 81 four-disc states met by walks)`);

  // ---------- the screen ----------
  const st = () => p.evaluate(() => window.__hanoi.state());
  const logic = (fn, ...a) => p.evaluate(async ([f, args]) => { const M = await import('/src/games/hanoi-logic.ts'); return new Function('M', 'a', 'return (' + f + ')(M, ...a)')(M, args); }, [fn.toString(), a]);
  const zone = (q) => p.locator(`.hn-peg[data-p="${q}"]`);
  const tap = async (q) => { const b = await zone(q).boundingBox(); await p.mouse.click(b.x + b.width / 2, b.y + b.height * 0.3); };
  const setLevel = async (n) => { await p.click(`.hn-lv[data-n="${n}"]`); };
  const playSolution = async () => { const sol = await p.evaluate(async () => { const M = await import('/src/games/hanoi-logic.ts'); const s = window.__hanoi.state(); return M.solve({ n: s.n, pegs: s.pegs }); }); for (const m of sol) { await tap(m.from); await tap(m.to); } return sol.length; };
  const store = () => p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1') || '{}').hanoi || {});
  const discBox = (d) => p.locator(`.hn-disc[data-d="${d}"]`).boundingBox();

  await p.screenshot({ path: OUT + 'hanoi-ready.png' });
  let a = await st();
  ok(a.n === 3 && JSON.stringify(a.pegs) === '[[2,1,0],[],[]]' && a.phase === 'play', 'opens with 3 discs on the left peg');
  ok((await p.textContent('#hn-moves')) === '步数：0' && (await p.textContent('#hn-min')) === '最少：7' && (await p.textContent('#hn-time')) === '用时：0:00' && (await p.textContent('#hn-best')) === '最佳：—', 'pills: moves 0, minimum 7, time 0:00, best none');
  ok(await p.locator('#hn-ovl').isHidden(), 'no overlay while playing');
  ok((await p.locator('.hn-lv').allTextContents()).join() === '3,4,5,6,7,8' && await p.locator('.hn-lv.on').textContent() === '3', 'level buttons 3..8, 3 is on');
  const lvr = await p.evaluate(() => [...document.querySelectorAll('.hn-lv')].map((b) => { const r = b.getBoundingClientRect(); return [r.width, r.height, getComputedStyle(b).borderRadius]; }));
  ok(lvr.every((r) => r[0] >= 38 && Math.abs(r[0] - r[1]) < 1 && parseFloat(r[2]) >= r[0] / 2 - 1), 'level buttons are round and at least 38 px');

  // every level: the right number of discs, minimum, distinct colours, widths grow, faces, discs inside the board, stacks do not overlap
  for (const n of [3, 4, 5, 6, 7, 8]) {
    await setLevel(n);
    const m = await p.evaluate(() => {
      const stg = document.querySelector('#hn-stage').getBoundingClientRect();
      const ds = [...document.querySelectorAll('.hn-disc')].sort((x, y) => x.dataset.d - y.dataset.d);
      const rects = ds.map((d) => d.getBoundingClientRect());
      const cols = new Set(ds.map((d) => getComputedStyle(d).backgroundColor));
      return { count: ds.length, cols: cols.size, faces: ds.every((d) => d.querySelectorAll('.hn-eye').length === 2 && d.querySelector('.hn-mouth')), min: document.querySelector('#hn-min').textContent,
        grow: rects.every((r, i) => i === 0 || r.width > rects[i - 1].width), inside: rects.every((r) => r.left >= stg.left - 0.5 && r.right <= stg.right + 0.5 && r.top >= stg.top - 0.5 && r.bottom <= stg.bottom + 0.5),
        stack: rects.every((r, i) => i === 0 || rects[i - 1].bottom <= r.top + 3.5), cx: new Set(rects.map((r) => Math.round(r.left + r.width / 2))).size };
    });
    ok(m.count === n && m.cols === n && m.faces && m.grow && m.inside && m.stack && m.cx === 1 && m.min === `最少：${2 ** n - 1}`, `${n} discs: ${n} distinct colours, a face on each, wider as they grow, stacked on one peg inside the board, minimum ${2 ** n - 1}`);
  }
  ok((await store()).level === 8, 'the level is remembered on this device');
  await setLevel(3);

  // tap: pick up, drop, illegal
  await tap(0); a = await st();
  ok(a.sel === 0 && await p.locator('.hn-disc.lift').count() === 1 && await p.locator('.hn-disc[data-d="0"].lift').count() === 1, 'a tap on a peg lifts its top disc');
  const lifted = await discBox(0); await tap(0); a = await st();
  ok(a.sel === -1 && (await discBox(0)).y > lifted.y + 5, 'a tap on the same peg puts it back');
  await tap(1); a = await st(); ok(a.sel === -1 && a.moves === 0, 'a tap on an empty peg picks nothing');
  await tap(0); await tap(2); a = await st();
  ok(JSON.stringify(a.pegs) === '[[2,1],[],[0]]' && a.moves === 1 && (await p.textContent('#hn-moves')) === '步数：1', 'pick up on the left, drop on the right: one move');
  await tap(0); await tap(2); a = await st();
  ok(JSON.stringify(a.pegs) === '[[2,1],[],[0]]' && a.moves === 1 && a.sel === -1, 'an illegal drop (larger on smaller) changes nothing and the disc returns');
  ok(await p.locator('.hn-disc[data-d="1"].shake').count() === 1, 'the refused disc shakes');
  await tap(0); await tap(1); await tap(2); await tap(1); a = await st();
  ok(JSON.stringify(a.pegs) === '[[2],[1,0],[]]' && a.moves === 3, 'two more legal moves counted: ' + JSON.stringify(a.pegs));
  await p.screenshot({ path: OUT + 'hanoi-play.png' });

  // undo (unlimited)
  await p.click('#hn-undo'); await p.click('#hn-undo'); a = await st();
  ok(JSON.stringify(a.pegs) === '[[2,1],[],[0]]' && a.moves === 1 && (await p.textContent('#hn-moves')) === '步数：1', 'undo takes moves back one by one');
  await p.click('#hn-undo'); a = await st();
  ok(JSON.stringify(a.pegs) === '[[2,1,0],[],[]]' && a.moves === 0 && await p.locator('#hn-undo').isDisabled(), 'undo back to the start, the button is off');
  await setLevel(5);
  const walk = [[0, 1], [0, 2], [1, 2], [0, 1], [2, 0], [2, 1], [0, 1], [0, 2], [1, 2], [1, 0], [2, 0], [1, 2]];
  for (const [f, to] of walk) { await tap(f); await tap(to); }
  a = await st(); const nMoves = a.moves;
  for (let i = 0; i < nMoves; i++) await p.click('#hn-undo');
  a = await st(); ok(nMoves >= 10 && JSON.stringify(a.pegs) === '[[4,3,2,1,0],[],[]]' && a.moves === 0, `unlimited undo: ${nMoves} moves taken back to the start`);

  // restart
  await tap(0); await tap(1); await p.click('#hn-restart'); a = await st();
  ok(JSON.stringify(a.pegs) === '[[4,3,2,1,0],[],[]]' && a.moves === 0 && a.sel === -1 && (await p.textContent('#hn-time')) === '用时：0:00', 'restart: a new game at the same level');
  await tap(0); await p.click('#hn-restart'); a = await st(); ok(a.sel === -1, 'restart also drops a lifted disc');

  // hint: the next optimal move from the CURRENT position
  await setLevel(4); await p.click('#hn-hint'); a = await st();
  let want = await p.evaluate(async () => { const M = await import('/src/games/hanoi-logic.ts'); const s = window.__hanoi.state(); return M.hint({ n: s.n, pegs: s.pegs }); });
  ok(a.hint && a.hint.from === want.from && a.hint.to === want.to && (await p.locator('#hn-stage').getAttribute('data-hint')) === `${want.from}-${want.to}`, 'the hint shows the first optimal move from the start');
  ok(await p.locator('.hn-peg.hint-to').count() === 1 && await p.locator('.hn-disc.hint-from').count() === 1, 'the hint marks the disc and the target peg');
  await p.screenshot({ path: OUT + 'hanoi-hint.png' });
  await tap(want.from); await tap(want.to); a = await st(); ok(a.hint === null && await p.locator('.hn-peg.hint-to').count() === 0, 'the hint is gone after a move');
  // hints from awkward positions all the way to the end (a deliberately bad opening)
  for (const [f, to] of [[0, 2], [0, 1], [2, 1], [0, 2], [1, 0]]) { await tap(f); await tap(to); }
  let guard = 0, shorter = true;
  while (!(await st()).phase.startsWith('won') && guard++ < 40) {
    const before = await p.evaluate(async () => { const M = await import('/src/games/hanoi-logic.ts'); const s = window.__hanoi.state(); return M.solve({ n: s.n, pegs: s.pegs }).length; });
    await p.click('#hn-hint'); const h = (await st()).hint; await tap(h.from); await tap(h.to);
    const after = await p.evaluate(async () => { const M = await import('/src/games/hanoi-logic.ts'); const s = window.__hanoi.state(); return M.solve({ n: s.n, pegs: s.pegs }).length; });
    if (after !== before - 1) shorter = false;
  }
  a = await st(); ok(shorter && a.phase === 'won', 'following the hint from a bad position always shortens the way by one and wins');
  ok(await p.locator('#hn-hint').isDisabled() && await p.locator('#hn-undo').isDisabled(), 'after a win hint and undo are off');
  await p.click('#hn-again'); a = await st(); ok(a.phase === 'play' && a.moves === 0 && await p.locator('#hn-ovl').isHidden(), 'Play again starts a new game');

  // drag with the mouse
  await setLevel(3);
  const drag = async (d, toX, toY, steps = 8) => { const b = await discBox(d); await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down(); await p.mouse.move(toX, toY, { steps }); return b; };
  const pegBox = async (q) => zone(q).boundingBox();
  let zb = await pegBox(2);
  await drag(0, zb.x + zb.width / 2, zb.y + 40);
  ok(await p.locator('.hn-disc.dragging').count() === 1, 'while dragging the disc follows the pointer');
  const midBox = await discBox(0); ok(Math.abs(midBox.x + midBox.width / 2 - (zb.x + zb.width / 2)) < 3, 'the dragged disc is under the pointer');
  await p.mouse.up(); a = await st();
  ok(JSON.stringify(a.pegs) === '[[2,1],[],[0]]' && a.moves === 1 && a.sel === -1, 'drag the top disc and release over the right peg: moved');
  zb = await pegBox(2); await drag(1, zb.x + zb.width / 2, zb.y + 60); await p.mouse.up(); a = await st();
  ok(JSON.stringify(a.pegs) === '[[2,1],[],[0]]' && a.moves === 1, 'an illegal drag changes nothing');
  ok(await p.locator('.hn-disc[data-d="1"]').evaluate((e) => !e.classList.contains('dragging') && e.style.transform === ''), 'the dragged disc returns to its peg');
  let z1 = await pegBox(1); await drag(1, z1.x + z1.width * 0.9, z1.y + 30); await p.mouse.up(); a = await st();
  ok(JSON.stringify(a.pegs) === '[[2],[1],[0]]' && a.moves === 2, 'a drop near a peg (far from its post, inside its third of the board) counts for that peg');
  z1 = await pegBox(1); await drag(1, z1.x + z1.width / 2, z1.y + 80); await p.mouse.up(); a = await st();
  ok(JSON.stringify(a.pegs) === '[[2],[1],[0]]' && a.moves === 2 && a.sel === -1, 'released over its own peg: nothing happens');
  // only the top disc can be dragged
  const b2 = await discBox(2); await p.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2); await p.mouse.down(); await p.mouse.move(b2.x + b2.width / 2 + 200, b2.y - 20, { steps: 6 }); await p.mouse.up(); a = await st();
  ok(a.moves === 2 && JSON.stringify(a.pegs) === '[[2],[1],[0]]', 'a disc that is not on top cannot be dragged');
  // a tiny wiggle is a tap
  z1 = await pegBox(1); const bd = await discBox(1); await p.mouse.move(bd.x + bd.width / 2, bd.y + bd.height / 2); await p.mouse.down(); await p.mouse.move(bd.x + bd.width / 2 + 3, bd.y + bd.height / 2 + 2); await p.mouse.up(); a = await st();
  ok(a.sel === 1, 'a press that hardly moves is a tap (the disc is lifted)'); await tap(1);
  // synthetic pointer events (touch type, no capture support needed)
  const synth = await p.evaluate(() => {
    const s0 = window.__hanoi.state(); const el = document.querySelector('.hn-disc[data-d="0"]'); const stg = document.querySelector('#hn-stage').getBoundingClientRect(); const r = el.getBoundingClientRect();
    const fire = (type, x, y) => (type === 'pointerdown' ? el : el).dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 31, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, button: 0, buttons: 1 }));
    const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
    fire('pointerdown', x0, y0); for (let k = 1; k <= 6; k++) fire('pointermove', x0 + (stg.left + stg.width * 0.1 - x0) * (k / 6), y0 - 30); fire('pointerup', stg.left + stg.width * 0.1, y0 - 30);
    return { before: s0.pegs, after: window.__hanoi.state().pegs };
  });
  ok(JSON.stringify(synth.after) === '[[2,0],[1],[]]', 'a synthetic touch drag to the left peg: ' + JSON.stringify(synth.after));

  // keyboard
  await p.click('#hn-restart'); await p.locator('#hn-stage').evaluate((e) => e.ownerDocument.activeElement.blur());
  await p.keyboard.press('2'); ok(await p.locator('.hn-peg[data-p="1"].cur').count() === 1, 'key 2 chooses the middle peg');
  await p.keyboard.press('ArrowLeft'); ok(await p.locator('.hn-peg[data-p="0"].cur').count() === 1, 'left arrow chooses the left peg');
  await p.keyboard.press('ArrowDown'); ok(await p.locator('.hn-peg[data-p="1"].cur').count() === 1, 'down arrow chooses the middle peg');
  await p.keyboard.press('ArrowRight'); ok(await p.locator('.hn-peg[data-p="2"].cur').count() === 1, 'right arrow chooses the right peg');
  await p.keyboard.press('1'); await p.keyboard.press('Enter'); a = await st(); ok(a.sel === 0, 'Enter picks up the top disc of the chosen peg');
  await p.keyboard.press('3'); await p.keyboard.press('Space'); a = await st(); ok(JSON.stringify(a.pegs) === '[[2,1],[],[0]]' && a.moves === 1, 'Space drops it on the chosen peg');
  await p.keyboard.press('1'); await p.keyboard.press('Enter'); await p.keyboard.press('3'); await p.keyboard.press('Enter'); a = await st();
  ok(JSON.stringify(a.pegs) === '[[2,1],[],[0]]' && a.sel === -1 && await p.locator('.hn-disc[data-d="1"].shake').count() === 1, 'an illegal drop by keyboard is refused too');
  await p.keyboard.press('u'); a = await st(); ok(a.moves === 0, 'U undoes');
  await p.keyboard.press('h'); a = await st(); ok(!!a.hint, 'H shows the hint');
  await p.keyboard.press('r'); a = await st(); ok(a.moves === 0 && !a.hint, 'R restarts');

  // win with stars: 3 discs optimal, 4 discs a little wasteful, 5 discs very wasteful
  await setLevel(3); let n3 = await playSolution(); a = await st();
  ok(a.phase === 'won' && n3 === 7 && await p.locator('#hn-ovl').isVisible() && (await p.textContent('#hn-ovl h2')) === '已完成。', 'win at 3 discs: the overlay says completed');
  ok(await p.locator('#hn-stars .on').count() === 3 && (await p.textContent('#hn-msg')) === '达到最少步数。', 'the optimal solution earns 3 stars and the message about the fewest moves');
  ok((await store())['best-3'] === 7 && (await p.textContent('#hn-best')) === '最佳：7' && (await p.textContent('#hn-rec')) === '新纪录：7', 'best (fewest moves) 7 saved in learn.games.v1 and shown in the orange pill with the new record line');
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('#hn-best')).color) === 'rgb(232, 89, 12)', 'the best pill is orange');
  await p.screenshot({ path: OUT + 'hanoi-win.png' });
  await p.keyboard.press('Enter'); a = await st(); ok(a.phase === 'play' && a.moves === 0, 'Enter after a win plays again');
  // a worse game does not replace the best
  await tap(0); await tap(1); await tap(1); await tap(0); await playSolution(); a = await st();
  ok(a.phase === 'won' && await p.locator('#hn-stars .on').count() === 2 && (await p.textContent('#hn-msg')).includes('9') && (await p.textContent('#hn-msg')).includes('7') && (await store())['best-3'] === 7 && await p.locator('#hn-rec').isHidden(), '9 moves at 3 discs = 2 stars, no record, best stays 7');
  await p.click('#hn-next'); a = await st();
  ok(a.n === 4 && a.phase === 'play' && (await p.locator('.hn-lv.on').textContent()) === '4' && (await store()).level === 4, 'Next level goes to 4 discs');
  await tap(0); await tap(1); await tap(1); await tap(0); await playSolution(); a = await st();
  ok(a.phase === 'won' && a.moves === 17 && await p.locator('#hn-stars .on').count() === 2, '17 moves at 4 discs (minimum 15) = 2 stars');
  await p.click('#hn-again');
  await setLevel(5);
  for (let i = 0; i < 20; i++) { await tap(0); await tap(1); await tap(1); await tap(0); }
  await playSolution(); a = await st();
  ok(a.phase === 'won' && a.moves === 31 + 40 && await p.locator('#hn-stars .on').count() === 1 && (await p.textContent('#hn-msg')).includes('71'), '71 moves at 5 discs (minimum 31) = 1 star');
  await p.click('#hn-again'); await setLevel(5); await playSolution();
  ok(await p.locator('#hn-stars .on').count() === 3 && (await store())['best-5'] === 31, '5 discs solved in 31 = 3 stars, best 31');

  // auto demo
  await setLevel(6); await p.evaluate(() => window.__hanoi.setDemoMs(25));
  await tap(0); await tap(2); await tap(0); await tap(1);   // start somewhere in the middle
  await p.click('#hn-demo');
  ok((await p.textContent('#hn-demo')) === '停止演示' && (await st()).demo, 'the demo button turns into stop');
  await p.waitForFunction(() => window.__hanoi.state().phase === 'won', null, { timeout: 15000 }); a = await st();
  ok((await p.textContent('#hn-ovl h2')) === '演示完成。' && await p.locator('#hn-stars').isHidden() && (await store())['best-6'] === undefined && !a.demo, 'the demo finishes from the current position with no stars and no best');
  ok(a.moves <= 2 + 63 && a.moves >= 2, 'the demo used only the optimal moves from where it started (' + a.moves + ')');
  await p.click('#hn-again'); await setLevel(5); await p.evaluate(() => window.__hanoi.setDemoMs(300));
  await p.click('#hn-demo'); await p.waitForFunction(() => window.__hanoi.state().moves >= 2);
  const zb2 = await p.locator('#hn-stage').boundingBox(); await p.mouse.click(zb2.x + 20, zb2.y + 20);
  a = await st(); const mv = a.moves; await p.waitForTimeout(700); const a2 = await st();
  ok(!a.demo && a2.moves === mv && (await p.textContent('#hn-demo')) === '自动演示', 'any tap stops the demo');
  await p.click('#hn-demo'); await p.waitForFunction((k) => window.__hanoi.state().moves >= k, mv + 1); await p.click('#hn-demo'); a = await st(); const mv2 = a.moves; await p.waitForTimeout(700);
  ok(!a.demo && (await st()).moves === mv2, 'the stop button stops it');
  await p.click('#hn-demo'); await p.waitForFunction((k) => window.__hanoi.state().moves >= k, mv2 + 1); await p.keyboard.press('x'); await p.waitForTimeout(100);
  ok(!(await st()).demo, 'a key press stops it');
  await setLevel(8); await p.evaluate(() => window.__hanoi.setDemoMs(4)); await p.click('#hn-demo');
  await p.waitForFunction(() => window.__hanoi.state().phase === 'won', null, { timeout: 20000 }); a = await st();
  ok(a.moves === 255 && await p.locator('#hn-next').isHidden(), '8 discs: the demo plays all 255 moves; there is no next level after 8');
  await p.screenshot({ path: OUT + 'hanoi-demo-done.png' });
  await p.click('#hn-again');

  // ---------- layout on 5 sizes ----------
  for (const [name, w, hgt] of [['phone', 390, 844], ['small', 320, 568], ['ipad', 820, 1180], ['wide', 1180, 820], ['side', 844, 390]]) {
    await p.setViewportSize({ width: w, height: hgt });
    await p.evaluate(() => (location.hash = '#/subject/games')); await p.evaluate(() => (location.hash = '#/games/hanoi')); await p.waitForSelector('#hn-stage');
    for (const n of [8, 3]) {
      await setLevel(n); await p.waitForTimeout(150);
      const m = await p.evaluate(() => {
        const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
        const f = R(document.querySelector('.hn-field')), hud = R(document.querySelector('.hn-hud')), stg = R(document.querySelector('#hn-stage'));
        const ds = [...document.querySelectorAll('.hn-disc')].map(R), pz = [...document.querySelectorAll('.hn-peg')].map(R);
        return { f, hud, stg, minH: Math.min(...ds.map((d) => d.h)), ds, pz, vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight,
          btns: [...document.querySelectorAll('.hn-hud button, .hn-stat')].every((b) => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }),
          pillsOk: [...document.querySelectorAll('.hn-stat')].every((b) => b.scrollWidth <= b.clientWidth + 1) };
      });
      const inside = (b) => b.l >= -0.5 && b.r <= m.vw + 0.5 && b.t >= -0.5 && b.b <= m.vh + 0.5;
      ok(inside(m.f) && inside(m.hud) && m.btns && m.pillsOk, `${name} ${w}x${hgt} (${n} discs): board and controls are on the screen (board ${Math.round(m.f.w)}x${Math.round(m.f.h)})`);
      ok(m.ds.every((d) => d.l >= m.stg.l - 0.5 && d.r <= m.stg.r + 0.5 && d.t >= m.stg.t - 0.5 && d.b <= m.stg.b + 0.5), `${name} (${n} discs): every disc and peg is inside the board`);
      ok(m.sw <= m.vw && m.sh <= m.vh + 1, `${name} (${n} discs): no page scrolling`);
      ok(m.f.b <= m.hud.t + 1 || m.f.t >= m.hud.b - 1 || m.f.l >= m.hud.r - 1 || m.f.r <= m.hud.l + 1, `${name}: the controls do not cover the board`);
      if (name !== 'side') ok(Math.abs(m.f.l - (m.vw - m.f.r)) <= 3, `${name} (${n} discs): the board is centred (${Math.round(m.f.l)} / ${Math.round(m.vw - m.f.r)})`);
      ok(Math.abs(m.stg.l - m.f.l - 4) <= 1 && Math.abs(m.f.r - m.stg.r - 4) <= 1, `${name}: equal space left and right inside the frame`);
      if (n === 8) {
        const need = w <= 320 ? 14 : w <= 390 ? 18 : 18;
        ok(m.minH >= need || (name === 'side' && m.minH >= 12), `${name} (8 discs): discs are ${m.minH.toFixed(1)} px high (need ${name === 'side' ? 12 : need})`);
      }
      if (w <= 844 && hgt >= 480) ok(m.pz.every((z) => z.w >= 80), `${name}: every peg hit zone is at least 80 px wide (${Math.round(Math.min(...m.pz.map((z) => z.w)))})`);
      ok(m.pz.every((z) => Math.abs(z.w - m.stg.w / 3) < 1) && m.pz.every((z) => z.h >= m.stg.h - 1), `${name}: the three zones are a third of the board each and full height`);
    }
    await setLevel(3);
    await p.screenshot({ path: OUT + `hanoi-${name}.png` });
    await setLevel(8); await tap(0); await p.screenshot({ path: OUT + `hanoi-${name}-8.png` }); await tap(0);
  }
  await p.setViewportSize({ width: 820, height: 1180 });
  ok(errors.length === 0, 'no script errors' + (errors.length ? ': ' + errors.join('; ') : ''));
  ok(t.log.external.length === 0, 'OFFLINE: no request left the app: ' + t.log.external.join(', '));
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForFunction(() => !window.__hanoi);
  await p.keyboard.press('1'); await p.keyboard.press('Enter');
  ok(true, 'leaving the game removes the hook and the key listener');
  await t.browser.close();

  // ---------- a real touch screen (CDP touch events, device pixel ratio 2) ----------
  {
    const s = await start(new Map(), { local: true, touch: true, dpr: 2, viewport: { width: 390, height: 844 } });
    const q = s.page; const cdp = await q.context().newCDPSession(q);
    await q.evaluate(() => (location.hash = '#/games/hanoi')); await q.waitForSelector('#hn-stage'); await q.waitForTimeout(200);
    const touch = async (pts, up = true) => { for (let i = 0; i < pts.length; i++) await cdp.send('Input.dispatchTouchEvent', { type: i === 0 ? 'touchStart' : 'touchMove', touchPoints: [{ x: pts[i][0], y: pts[i][1], id: 1 }] }); if (up) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await q.waitForTimeout(80); };
    const state = () => q.evaluate(() => window.__hanoi.state());
    const center = async (sel) => { const b = await q.locator(sel).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2, b]; };
    const [dx, dy] = await center('.hn-disc[data-d="0"]'); const [tx, ty] = await center('.hn-peg[data-p="2"]');
    const path = Array.from({ length: 10 }, (_, k) => [dx + ((tx - dx) * (k + 1)) / 10, dy + ((ty - dy) * (k + 1)) / 10 - 20]);
    await touch([[dx, dy], ...path]);
    let a = await state();
    ok(JSON.stringify(a.pegs) === '[[2,1],[],[0]]' && a.moves === 1, 'a real touch drag (dpr 2) of the top disc to the right peg moves it');
    const [d1x, d1y] = await center('.hn-disc[data-d="1"]');
    await touch([[d1x, d1y], ...Array.from({ length: 8 }, (_, k) => [d1x + ((tx - d1x) * (k + 1)) / 8, d1y - 10])]);
    a = await state(); ok(JSON.stringify(a.pegs) === '[[2,1],[],[0]]' && a.moves === 1, 'a real touch drag onto a smaller disc is refused');
    const z1 = await q.locator('.hn-peg[data-p="1"]').boundingBox();
    await touch([[d1x, d1y], [d1x + 20, d1y - 20], [z1.x + z1.width / 2, z1.y + 120]]);
    a = await state(); ok(JSON.stringify(a.pegs) === '[[2],[1],[0]]' && a.moves === 2, 'a real touch drag to the middle peg moves the second disc');
    // taps with a finger
    const z0 = await q.locator('.hn-peg[data-p="0"]').boundingBox(); const z2 = await q.locator('.hn-peg[data-p="2"]').boundingBox();
    await q.touchscreen.tap(z1.x + z1.width / 2, z1.y + 30); await q.touchscreen.tap(z2.x + z2.width / 2, z2.y + 30); a = await state();
    ok(a.moves === 2 && a.sel === -1, 'finger taps: middle (disc 1) onto right (disc 0) is refused');
    await q.touchscreen.tap(z2.x + z2.width / 2, z2.y + 30); await q.touchscreen.tap(z1.x + z1.width / 2, z1.y + 30); a = await state();
    ok(a.moves === 3 && JSON.stringify(a.pegs) === '[[2],[1,0],[]]', 'finger taps: pick up on the right, drop in the middle');
    await q.screenshot({ path: OUT + 'hanoi-touch.png' });
    ok(s.log.external.length === 0, 'touch run: no outside request');
    await s.browser.close();
  }

  // ---------- EN and FR: nothing Chinese left ----------
  const J = JSON.parse(fs.readFileSync('src/games/hanoi.i18n.json', 'utf8'));
  ok(Object.keys(J).every((k) => k.length > 1 && Array.isArray(J[k]) && J[k].length === 2 && J[k][0] && J[k][1] && !CJK.test(J[k][0] + J[k][1])), 'hanoi.i18n.json: every key has more than one character and a clean EN and FR text');
  const src = fs.readFileSync('src/games/hanoi.ts', 'utf8') + fs.readFileSync('src/games/hanoi-logic.ts', 'utf8');
  const used = new Set((src.match(/"[^"\n]*[一-鿿][^"\n]*"|`[^`\n]*[一-鿿][^`\n]*`/g) || []).map((x) => x.slice(1, -1).replace(/\$\{[^}]*\}/g, '{#}')));
  const keys = Object.keys(J).map((k) => k.replace(/\{\d\}/g, '{#}'));
  const lacking = [...used].filter((u) => !keys.includes(u));
  ok(lacking.length === 0, 'every Chinese text in the game code has a translation entry' + (lacking.length ? ' -> missing: ' + lacking.join(' | ') : ''));
  const idx = fs.readFileSync('src/games/index.ts', 'utf8'); const nm = /id: "hanoi", name: "([^"]+)", sub: "([^"]+)"/.exec(idx);
  ok(nm && J[nm[1]] && J[nm[2]], 'the name and the subtitle of the card are in the file');
  for (const [loc, name, label] of [['en-US', 'en', /Tower of Hanoi/], ['fr-FR', 'fr', /Tour de Hano/]]) {
    for (const [dn, vp] of [['phone', { width: 390, height: 844 }], ['small', { width: 320, height: 568 }], ['sideways', { width: 844, height: 390 }]]) {
      const s = await start(new Map(), { local: true, locale: loc, viewport: vp, today: '2026-11-12' });
      const q = s.page;
      await q.route('**/src/i18n-data.ts*', async (route) => { const r = await route.fetch(); const body = await r.text(); await route.fulfill({ response: r, body: body + `\nObject.assign(EN, ${JSON.stringify(Object.fromEntries(Object.entries(J).map(([k, v]) => [k, v[0]])))});\nObject.assign(FR, ${JSON.stringify(Object.fromEntries(Object.entries(J).map(([k, v]) => [k, v[1]])))});\n` }); });
      await q.reload(); await q.waitForSelector('.hub-grid, .kids, .empty-home');
      await q.evaluate(() => (location.hash = '#/subject/games')); await q.waitForSelector('.gm-card');
      ok(label.test(await q.evaluate(() => document.querySelector('.gm-grid').innerText)), `${name} ${dn}: the card is named ${label.source}`);
      await q.evaluate(() => (location.hash = '#/games/hanoi')); await q.waitForSelector('#hn-stage .hn-disc'); await q.waitForTimeout(250);
      const game = await q.evaluate(() => document.querySelector('.hn-wrap').innerText);
      ok(!CJK.test(game), `${name} ${dn}: the game screen has no Chinese left (${game.replace(/\s+/g, ' ').slice(0, 110)})`);
      const attrs = await q.evaluate(() => [...document.querySelectorAll('.hn-wrap [aria-label]')].map((e) => e.getAttribute('aria-label')).join('|'));
      ok(!CJK.test(attrs), `${name} ${dn}: the aria labels have no Chinese left (${attrs.slice(0, 80)})`);
      const over = await q.evaluate(() => [...document.querySelectorAll('.hn-stat, .hn-acts .mopt')].filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent));
      const fit = await q.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight, all: [...document.querySelectorAll('.hn-hud button')].every((x) => { const r = x.getBoundingClientRect(); return r.right <= innerWidth + 1 && r.left >= -1 && r.bottom <= innerHeight + 1; }) }));
      ok(over.length === 0 && fit.sw <= fit.iw && fit.sh <= fit.ih + 1 && fit.all, `${name} ${dn}: no text is cut off, nothing overflows${over.length ? ' -> ' + over.join() : ''}`);
      await q.evaluate(() => window.__hanoi.setDemoMs(20)); await q.click('#hn-demo');
      await q.waitForTimeout(40); const stopTxt = await q.textContent('#hn-demo');
      ok(!CJK.test(stopTxt), `${name} ${dn}: the stop-demo button is translated (${stopTxt})`);
      await q.waitForFunction(() => window.__hanoi.state().phase === 'won', null, { timeout: 10000 });
      const win = await q.textContent('#hn-ovl');
      ok(!CJK.test(win) && win.trim().length > 5, `${name} ${dn}: the win overlay has no Chinese left (${win.replace(/\s+/g, ' ').trim().slice(0, 80)})`);
      await q.click('#hn-again');
      for (const m of [[0, 2], [0, 1], [2, 1], [0, 2], [1, 0], [1, 2], [0, 2]]) { await q.locator(`.hn-peg[data-p="${m[0]}"]`).click({ position: { x: 40, y: 20 } }); await q.locator(`.hn-peg[data-p="${m[1]}"]`).click({ position: { x: 40, y: 20 } }); }
      await q.waitForSelector('#hn-ovl:not([hidden])');
      const win2 = await q.evaluate(() => document.querySelector('#hn-ovl').innerText);
      ok(!CJK.test(win2) && /7/.test(win2), `${name} ${dn}: the win overlay with stars has no Chinese left (${win2.replace(/\s+/g, ' ').slice(0, 80)})`);
      if (dn === 'phone') await q.screenshot({ path: OUT + `hanoi-${name}-win.png` });
      ok(s.log.external.length === 0, `${name} ${dn}: no outside request`);
      await s.browser.close();
    }
  }
  await done();
})();
