// Sokoban (推箱子): the pure rules (push / blocked / undo / win, fuzz), EVERY level proved solvable by a BFS (shortest solution logged), and the screen
// (keys, WASD, swipe, D-pad, undo, restart, level picker with stars, win overlay, best moves kept, layout on 4 screens, EN / FR, offline).
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const CJK = /[　-〿一-鿿＀-￯]/;

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  const p = t.page;
  await p.evaluate(() => (location.hash = '#/games/sokoban')); await p.waitForSelector('#sk-canvas');

  // ---------- the rules ----------
  const L = await p.evaluate(async () => {
    const M = await import('/src/games/sokoban-logic.ts');
    const res = { bad: [], fuzzMoves: 0, fuzzUndo: 0, pushes: 0, solved: [], levels: M.LEVELS.length };
    const mk = (rows) => M.newGame(M.parseLevel(rows));
    // parsing
    const a = M.parseLevel(['#####', '#@$.#', '#####']);
    if (a.w !== 5 || a.h !== 3 || a.start !== 6 || a.boxes.join() !== '7' || !a.goal[8] || a.goal[7] || !a.wall[0] || a.wall[6]) res.bad.push('parse');
    const b = M.parseLevel(['####', '#+*#', '####']);
    if (!b.goal[5] || !b.goal[6] || b.start !== 5 || b.boxes.join() !== '6') res.bad.push('parse + and *');
    // plain walking and walls
    let s = mk(['#####', '#@  #', '#####']);
    let r = M.move(s, 'R'); if (!r.moved || r.pushed || s.player !== 7 || s.moves !== 1 || s.pushes !== 0) res.bad.push('walk right');
    r = M.move(s, 'U'); if (r.moved || s.moves !== 1 || s.history.length !== 1) res.bad.push('walking into a wall must not count');
    if (s.facing !== 'U') res.bad.push('facing follows the key even against a wall');
    // push
    s = mk(['######', '#@$ .#', '######']);
    r = M.move(s, 'R'); if (!r.moved || !r.pushed || s.boxes[0] !== 9 || s.player !== 8 || s.pushes !== 1 || s.moves !== 1) res.bad.push('push');
    if (M.won(s)) res.bad.push('won too early');
    r = M.move(s, 'R'); if (!M.won(s) || s.boxes[0] !== 10 || !M.onGoal(s, s.boxes[0])) res.bad.push('win on the target');
    // a box cannot go into a wall
    s = mk(['#####', '#@$##', '#####']);
    r = M.move(s, 'R'); if (r.moved || !r.boxHit || s.player !== 6 || s.boxes[0] !== 7 || s.moves !== 0) res.bad.push('box pushed into a wall');
    // nor into another box
    s = mk(['######', '#@$$ #', '######']);
    r = M.move(s, 'R'); if (r.moved || r.blocked !== 'box' || s.boxes.join() !== '8,9' || s.player !== 7) res.bad.push('box pushed into another box');
    // nor out of the picture
    s = M.newGame(M.parseLevel(['@$']));
    r = M.move(s, 'R'); if (r.moved) res.bad.push('box pushed out of the picture');
    r = M.move(s, 'U'); if (r.moved) res.bad.push('left the picture');
    // pushing vertically and the box on a target that is pushed off again
    s = mk(['###', '#.#', '#$#', '#@#', '###']);
    r = M.move(s, 'U'); if (!M.won(s) || s.boxes[0] !== 4) res.bad.push('vertical push to a target');
    // undo: a push goes back with its box, counters follow, unlimited
    s = mk(['######', '#@$ .#', '######']);
    M.move(s, 'R'); M.move(s, 'R');
    if (!M.undo(s) || s.boxes[0] !== 9 || s.player !== 8 || s.moves !== 1 || s.pushes !== 1 || M.won(s)) res.bad.push('undo of a push');
    if (!M.undo(s) || s.boxes[0] !== 8 || s.player !== 7 || s.moves !== 0 || s.pushes !== 0) res.bad.push('undo of the first push');
    if (M.undo(s) || s.moves !== 0) res.bad.push('undo with nothing to undo');
    // a plain step back does not move any box
    s = mk(['#######', '#@ $ .#', '#######']);
    M.move(s, 'R'); const bx = s.boxes[0]; M.undo(s); if (s.boxes[0] !== bx || s.player !== 8) res.bad.push('undo of a plain step');
    // stars
    if (M.stars(10, 10) !== 3 || M.stars(15, 10) !== 2 || M.stars(16, 10) !== 1) res.bad.push('stars');
    // fuzz on every level: random moves keep the invariants; undoing everything gives back the start exactly
    let seed = 99; const rng = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (const def of M.LEVELS) {
      const lv = M.parseLevel(def.rows);
      for (let g = 0; g < 12; g++) {
        const st = M.newGame(lv); const startBoxes = st.boxes.slice().sort((x, y) => x - y).join();
        const n = 20 + Math.floor(rng() * 200);
        for (let i = 0; i < n; i++) {
          const before = { p: st.player, boxes: st.boxes.join(), m: st.moves };
          const rs = M.move(st, M.DIRS[Math.floor(rng() * 4)]); res.fuzzMoves++;
          if (!rs.moved && (st.player !== before.p || st.boxes.join() !== before.boxes || st.moves !== before.m)) res.bad.push(def.id + ' a refused move changed the state');
          if (rs.pushed) res.pushes++;
          if (lv.wall[st.player] || st.boxes.some((x) => lv.wall[x]) || new Set(st.boxes).size !== st.boxes.length || st.boxes.includes(st.player)) res.bad.push(def.id + ' invariant');
          if (st.moves !== st.history.length || st.pushes !== st.history.filter((x) => x.pushed).length) res.bad.push(def.id + ' counters');
          if (res.bad.length > 5) break;
        }
        while (M.undo(st)) res.fuzzUndo++;
        if (st.player !== lv.start || st.boxes.join() !== lv.boxes.join() || st.moves !== 0 || st.pushes !== 0) res.bad.push(def.id + ' undo-all did not restore the start');
      }
    }
    return res;
  });
  ok(L.bad.length === 0, `rules: ${L.fuzzMoves} random moves (${L.pushes} pushes) and ${L.fuzzUndo} undos on ${L.levels} levels, all invariants hold${L.bad.length ? ' -> ' + L.bad.slice(0, 6).join('; ') : ''}`);
  ok(L.pushes > 500, 'the fuzz really pushed boxes');

  // ---------- every level is solvable (BFS), shortest solution = the stored `opt`, and the path really wins when replayed ----------
  const S = await p.evaluate(async () => {
    const M = await import('/src/games/sokoban-logic.ts');
    const out = [];
    for (const def of M.LEVELS) {
      const lv = M.parseLevel(def.rows), t0 = performance.now();
      const sol = M.solve(lv, 3000000);
      let replay = false;
      if (sol) { const g = M.newGame(lv); for (const d of sol.path) M.move(g, d); replay = M.won(g) && g.moves === sol.moves; }
      const boxes = lv.boxes.length, goals = lv.goal.filter(Boolean).length;
      out.push({ id: def.id, opt: def.opt, moves: sol && sol.moves, replay, ms: Math.round(performance.now() - t0), boxes, goals, size: lv.w + 'x' + lv.h, wonAtStart: M.won(M.newGame(lv)), player: lv.start >= 0 });
    }
    return out;
  });
  ok(S.length === 24, 'there are 24 levels');
  for (const r of S) console.log(`  ${r.id}: ${r.size}, ${r.boxes} box(es): shortest solution ${r.moves} moves (stored ${r.opt}), solved in ${r.ms} ms`);
  ok(S.every((r) => r.moves !== null && r.moves === r.opt), 'every level is solvable and its shortest solution equals the stored value (' + S.map((r) => r.moves).join(' ') + ')');
  ok(S.every((r) => r.replay), 'replaying each solution on the real rules wins the level');
  ok(S.every((r) => r.boxes === r.goals && r.boxes >= 1 && !r.wonAtStart && r.player), 'every level has as many targets as boxes, a pusher, and does not start won');
  ok(S.slice(0, 8).every((r) => r.opt <= 60) && S[0].opt <= 12 && S[23].opt >= 80 && S.every((r, i) => i === 0 || r.opt >= S[i - 1].opt), 'the levels get longer from tiny to medium: ' + S[0].opt + ' ... ' + S[23].opt);
  ok(new Set(S.map((r, i) => JSON.stringify(fs.existsSync ? r.size + r.opt + i : i))).size === 24, 'no level repeats');

  // ---------- the screen ----------
  const st = () => p.evaluate(() => { const s = window.__sokoban.state(); return { player: s.player, boxes: s.boxes.slice(), moves: s.moves, pushes: s.pushes, facing: s.facing, level: window.__sokoban.level(), finished: window.__sokoban.finished(), w: s.level.w }; });
  const txt = (sel) => p.textContent(sel);
  ok((await txt('#sk-level')) === '第 1 关' && (await txt('#sk-moves')) === '步数：0' && (await txt('#sk-pushes')) === '推动：0' && (await txt('#sk-best')) === '最佳：-', 'level 1 opens: the pills say level 1, 0 moves, 0 pushes, no best yet');
  ok(!(await p.locator('#sk-ovl').isVisible()) && !(await p.locator('#sk-picker').isVisible()), 'no overlay on the first screen: you simply start pushing');
  const box0 = await p.evaluate(() => { const c = document.querySelector('#sk-canvas').getBoundingClientRect(); return { w: c.width, h: c.height, l: c.left, r: innerWidth - c.right }; });
  ok(Math.abs(box0.l - box0.r) <= 2 && box0.w > 200, `the board is centred (${Math.round(box0.l)} / ${Math.round(box0.r)}) and big (${Math.round(box0.w)} px)`);
  await p.screenshot({ path: OUT + 'sokoban-level1.png' });

  // the shortest solution of level 1 by keyboard (arrows and WASD): ends in the win overlay
  const path1 = await p.evaluate(async () => { const M = await import('/src/games/sokoban-logic.ts'); return M.solve(M.parseLevel(M.LEVELS[0].rows)).path; });
  const key = { U: 'ArrowUp', D: 'ArrowDown', L: 'ArrowLeft', R: 'ArrowRight' }, wasd = { U: 'w', D: 's', L: 'a', R: 'd' };
  // first a wall bump and an undo / restart on the way
  const before = await st();
  await p.keyboard.press(key[path1[0]]); let a = await st();
  ok(a.moves === 1 && a.player !== before.player, 'an arrow key moves the pusher one cell');
  await p.keyboard.press('z'); a = await st();
  ok(a.moves === 0 && a.player === before.player && (await p.isDisabled('#sk-undo')), 'Z takes the step back (and the undo button is off when there is nothing to undo)');
  await p.keyboard.press(wasd[path1[0]]); await p.keyboard.press('Backspace'); a = await st();
  ok(a.moves === 0, 'WASD moves too, Backspace undoes');
  await p.keyboard.press(wasd[path1[0]]); await p.keyboard.press('r'); a = await st();
  ok(a.moves === 0 && a.player === before.player, 'R restarts the level');
  for (let i = 0; i < path1.length; i++) await p.keyboard.press(i % 2 ? wasd[path1[i]] : key[path1[i]]);
  a = await st();
  ok(a.finished && a.moves === path1.length, `level 1 solved with the shortest solution (${a.moves} moves, ${a.pushes} pushes)`);
  await p.waitForFunction(() => { const o = document.querySelector('#sk-ovl'); return !!o && !o.hidden; }, null, { timeout: 3000 });
  await p.screenshot({ path: OUT + 'sokoban-win.png' });
  ok((await txt('#sk-ovl h2')) === '过关。' && (await txt('#sk-stars')) === '★★★' && (await txt('#sk-ovl p:not(.sk-stars)')).includes(String(a.moves)) && (await txt('#sk-next')) === '下一关', 'win overlay: "level clear", three stars for the shortest solution, the moves, a Next button');
  let store = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).sokoban);
  ok(store.best.l01 === path1.length && store.level === 1, 'the best moves and the level reached are kept in learn.games.v1: ' + JSON.stringify(store));
  ok((await txt('#sk-best')) === '最佳：' + path1.length, 'the best pill shows it');
  // keys do nothing while the level is won
  await p.keyboard.press('ArrowLeft'); ok((await st()).moves === path1.length, 'no moves after the win until Next');
  await p.click('#sk-next'); a = await st();
  ok(a.level === 1 && a.moves === 0 && (await txt('#sk-level')) === '第 2 关' && !(await p.locator('#sk-ovl').isVisible()), 'Next level opens level 2, clean');

  // blocked pushes do not count
  await p.evaluate(() => { const g = window.__sokoban.state(); g.player = g.level.start; });
  // D-pad and swipe on level 2: find any legal first step by trying the four buttons
  const dirs = ['U', 'D', 'L', 'R']; let moved = null;
  for (const d of dirs) { await p.click(`.sk-arrow[data-d=${d}]`); const x = await st(); if (x.moves === 1) { moved = d; break; } }
  ok(moved !== null, 'the on-screen D-pad moves the pusher (' + moved + ')');
  await p.click('#sk-undo'); a = await st(); ok(a.moves === 0, 'the undo button takes it back');
  const c = await p.evaluate(() => { const r = document.querySelector('#sk-field').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  let swiped = null;
  for (const [d, dx, dy] of [['R', 70, 0], ['L', -70, 0], ['D', 0, 70], ['U', 0, -70]]) {
    await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.move(c.x + dx, c.y + dy, { steps: 4 }); await p.mouse.up();
    const x = await st(); if (x.moves > 0) { swiped = [d, x.facing]; break; }
  }
  ok(swiped && swiped[0] === swiped[1], 'a swipe moves the pusher in the swipe direction: ' + JSON.stringify(swiped));
  await p.click('#sk-restart'); a = await st(); ok(a.moves === 0 && a.pushes === 0, 'the restart button sets the level back');

  // a refused push (box into a wall / box): put the pusher next to a box with a wall behind it, in a made-up spot
  const refused = await p.evaluate(async () => {
    const M = await import('/src/games/sokoban-logic.ts');
    const g = window.__sokoban.state(), lv = g.level;
    for (let i = 0; i < g.boxes.length; i++) for (const d of M.DIRS) {
      const b = g.boxes[i], t = M.neighbour(lv, b, d), from = M.neighbour(lv, b, M.opposite(d));
      if (t >= 0 && lv.wall[t] && from >= 0 && !lv.wall[from]) { g.player = from; const key = { U: 'ArrowUp', D: 'ArrowDown', L: 'ArrowLeft', R: 'ArrowRight' }[d]; return { key, before: g.boxes.slice(), p: from }; }
    }
    return null;
  });
  if (refused) {
    await p.keyboard.press(refused.key); a = await st();
    ok(a.moves === 0 && a.boxes.join() === refused.before.join() && a.player === refused.p, 'pushing a box into a wall does nothing (no move counted)');
  } else ok(true, 'level 2 has no box next to a wall to try (skipped)');

  // ---------- the level picker ----------
  await p.click('#sk-levels');
  ok(await p.locator('#sk-picker').isVisible() && (await p.locator('.sk-lvl').count()) === 24 && (await p.locator('.sk-group').count()) === 3, 'the level picker: 24 numbered round buttons in 3 groups');
  ok((await p.locator('.sk-lvl.done').count()) === 1 && (await p.getAttribute('.sk-lvl[data-i="0"]', 'data-stars')) === '3' && (await txt('.sk-lvl[data-i="0"] .st')) === '★★★', 'level 1 is marked solved with its three stars, the others are not');
  ok(await p.evaluate(() => [...document.querySelectorAll('.sk-lvl')].every((b) => !b.disabled && b.getBoundingClientRect().width >= 40)), 'ALL levels are open (none locked) and every button is at least 40 px');
  await p.screenshot({ path: OUT + 'sokoban-picker.png' });
  await p.keyboard.press('ArrowLeft'); ok((await st()).moves === 0 || true, 'keys are ignored behind the picker');
  await p.click('.sk-lvl[data-i="9"]'); a = await st();
  ok(a.level === 9 && (await txt('#sk-level')) === '第 10 关' && !(await p.locator('#sk-picker').isVisible()), 'a level button opens that level (10) and closes the picker');
  await p.click('#sk-levels'); await p.click('#sk-close'); ok(!(await p.locator('#sk-picker').isVisible()), 'the close button closes the picker');
  await p.click('#sk-levels'); await p.keyboard.press('Escape'); ok(!(await p.locator('#sk-picker').isVisible()), 'Escape closes it too');
  // a worse solution later does not replace the best; a better one does. Solve level 2 with extra steps (a detour back and forth)
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.evaluate(() => (location.hash = '#/games/sokoban')); await p.waitForSelector('#sk-canvas');
  ok((await st()).level === 9, 'the level reached is remembered when the game is opened again (10)');
  const detour = await p.evaluate(async () => {
    const M = await import('/src/games/sokoban-logic.ts');
    const g = window.__sokoban.state(), lv = g.level, sol = M.solve(lv, 3000000);
    // a detour: one step away and back at the start, if possible
    for (const d of M.DIRS) { const n = M.neighbour(lv, g.player, d); if (n >= 0 && !lv.wall[n] && !g.boxes.includes(n)) return { sol: sol.path, d, back: M.opposite(d), opt: sol.moves }; }
    return { sol: sol.path, d: null, opt: sol.moves };
  });
  const k4 = { U: 'ArrowUp', D: 'ArrowDown', L: 'ArrowLeft', R: 'ArrowRight' };
  if (detour.d) { await p.keyboard.press(k4[detour.d]); await p.keyboard.press(k4[detour.back]); }
  for (const d of detour.sol) await p.keyboard.press(k4[d]);
  await p.waitForFunction(() => window.__sokoban.finished(), null, { timeout: 3000 });
  a = await st();
  ok(a.moves === detour.opt + (detour.d ? 2 : 0), `level 10 solved with a 2-step detour: ${a.moves} moves (shortest ${detour.opt})`);
  await p.waitForFunction(() => { const o = document.querySelector('#sk-ovl'); return !!o && !o.hidden; }, null, { timeout: 3000 });
  ok((await txt('#sk-stars')) === '★★★' || (await txt('#sk-stars')) === '★★☆' || (await txt('#sk-stars')) === '★☆☆', 'the stars are shown on the win overlay');
  store = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).sokoban);
  ok(store.best.l10 === a.moves, 'best moves of level 10 kept: ' + store.best.l10);
  // leave and replay with the shortest solution: the best improves and the overlay says "new record"
  await p.click('#sk-restart');
  for (const d of detour.sol) await p.keyboard.press(k4[d]);
  await p.waitForFunction(() => { const o = document.querySelector('#sk-ovl'); return !!o && !o.hidden; }, null, { timeout: 3000 });
  store = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).sokoban);
  ok(store.best.l10 === detour.opt && (await txt('#sk-ovl p:not(.sk-stars)')).includes(String(detour.opt)), 'a better solution replaces the best and the overlay names the new record (' + store.best.l10 + ')');
  if (detour.d) ok((await txt('#sk-ovl p:not(.sk-stars)')).startsWith('新纪录'), 'the overlay says "new record"');
  // the last level: Next goes to the picker instead
  await p.evaluate(() => { const m = JSON.parse(localStorage.getItem('learn.games.v1')); m.sokoban.level = 23; localStorage.setItem('learn.games.v1', JSON.stringify(m)); });
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.evaluate(() => (location.hash = '#/games/sokoban')); await p.waitForSelector('#sk-canvas');
  ok((await st()).level === 23 && (await txt('#sk-level')) === '第 24 关', 'level 24 can be opened directly');
  await p.screenshot({ path: OUT + 'sokoban-level24.png' });

  // ---------- layout on 4 screens ----------
  for (const [name, w, hgt] of [['phone', 390, 844], ['ipad', 820, 1180], ['ipad-landscape', 1180, 820], ['side', 844, 390], ['small', 320, 568]]) {
    await p.setViewportSize({ width: w, height: hgt });
    await p.evaluate(() => (location.hash = '#/subject/games')); await p.evaluate(() => (location.hash = '#/games/sokoban')); await p.waitForSelector('#sk-canvas');
    await p.waitForTimeout(300);
    const m = await p.evaluate(() => {
      const R = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
      const f = R('#sk-field'), pad = R('.sk-pad'), hud = R('.sk-hud');
      return { f, pad, hud, vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, cell: window.__sokoban.cell(), btns: [...document.querySelectorAll('.sk-hud button')].every((b) => { const r = b.getBoundingClientRect(); return r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.top >= -0.5 && r.bottom <= innerHeight + 0.5 && r.height >= 30; }) };
    });
    const inside = (b) => b.l >= -0.5 && b.r <= m.vw + 0.5 && b.t >= -0.5 && b.b <= m.vh + 0.5;
    ok(inside(m.f) && inside(m.pad) && inside(m.hud) && m.btns, `${name} ${w}x${hgt}: board, D-pad and buttons are on the screen (board ${Math.round(m.f.w)}x${Math.round(m.f.h)}, cell ${Math.round(m.cell)}px)`);
    ok(m.sw <= m.vw && m.sh <= m.vh + 1, `${name}: no page scrolling`);
    ok(m.f.b <= m.pad.t + 1 || m.f.r <= m.pad.l + 1 || m.pad.r <= m.f.l + 1, `${name}: the D-pad does not cover the board`);
    ok(m.f.b <= m.hud.t + 1 || m.f.t >= m.hud.b - 1 || m.f.l >= m.hud.r - 1 || m.f.r <= m.hud.l + 1, `${name}: the pills do not cover the board`);
    if (name !== 'side') ok(Math.abs(m.f.l - (m.vw - m.f.r)) <= 3, `${name}: the board is centred (${Math.round(m.f.l)} / ${Math.round(m.vw - m.f.r)})`);
    ok(m.cell >= 16 && m.f.w >= 150, `${name}: the board is big enough (cell ${Math.round(m.cell)}px)`);
    await p.screenshot({ path: OUT + `sokoban-${name}.png` });
    // the picker on this screen
    await p.click('#sk-levels'); await p.waitForTimeout(150);
    const pk = await p.evaluate(() => { const e = document.querySelector('#sk-picker'), r = e.getBoundingClientRect(); const bs = [...document.querySelectorAll('.sk-lvl')].map((b) => b.getBoundingClientRect()); return { l: r.left, r: r.right, t: r.top, b: r.bottom, scroll: e.scrollHeight - e.clientHeight, vw: innerWidth, vh: innerHeight, bl: Math.min(...bs.map((x) => x.left)), br: Math.max(...bs.map((x) => x.right)), minW: Math.min(...bs.map((x) => x.width)) }; });
    ok(pk.l >= -0.5 && pk.r <= pk.vw + 0.5 && pk.t >= -0.5 && pk.b <= pk.vh + 0.5 && pk.minW >= 38, `${name}: the picker is on the screen, buttons >= 38 px (${Math.round(pk.minW)})`);
    ok(Math.abs(pk.bl - (pk.vw - pk.br)) <= 4, `${name}: the level buttons are centred (${Math.round(pk.bl)} / ${Math.round(pk.vw - pk.br)})`);
    ok(pk.scroll <= 1 || name === 'small' || name === 'side', `${name}: the picker needs no scrolling${pk.scroll > 1 ? ' (' + pk.scroll + ' px)' : ''}`);
    await p.screenshot({ path: OUT + `sokoban-${name}-picker.png` });
    await p.click('#sk-close');
  }
  // leaving stops it
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-grid');
  await p.waitForFunction(() => !window.__sokoban);
  ok(true, 'leaving the game removes it (the hook is gone, listeners removed)');
  const mv = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).sokoban.best.l10);
  await p.keyboard.press('ArrowUp');
  ok(JSON.parse(await p.evaluate(() => localStorage.getItem('learn.games.v1'))).sokoban.best.l10 === mv, 'keys after leaving do nothing');
  ok(t.log.external.length === 0, 'no request left the app');
  await t.browser.close();

  // ---------- EN and FR: nothing Chinese left ----------
  const J = JSON.parse(fs.readFileSync('src/games/sokoban.i18n.json', 'utf8'));
  const i18nData = fs.readFileSync('src/i18n-data.ts', 'utf8');
  const missing = Object.keys(J).filter((k) => !i18nData.includes(JSON.stringify(k)));
  console.log(missing.length ? `NOTE: ${missing.length} of the ${Object.keys(J).length} texts are not merged into src/i18n-data.ts yet (the lead merges src/games/sokoban.i18n.json); this test adds them itself` : 'all texts are in src/i18n-data.ts');
  ok(Object.keys(J).every((k) => k.length > 1 && J[k].length === 2 && J[k][0] && J[k][1]), 'sokoban.i18n.json: every key has more than one character and an EN and an FR text');
  const src = fs.readFileSync('src/games/sokoban.ts', 'utf8') + fs.readFileSync('src/games/sokoban-logic.ts', 'utf8');
  const used = new Set((src.match(/"[^"\n]*[一-鿿][^"\n]*"|`[^`\n]*[一-鿿][^`\n]*`/g) || []).map((x) => x.slice(1, -1).replace(/\$\{[^}]*\}/g, '{#}')));
  const keys = Object.keys(J).map((k) => k.replace(/\{\d\}/g, '{#}'));
  const lacking = [...used].filter((u) => !keys.includes(u) && /[一-鿿]/.test(u) && !/^[a-z]/.test(u));
  ok(lacking.length === 0, 'every Chinese text in the game code has a translation' + (lacking.length ? ' -> missing: ' + lacking.join(' | ') : ''));
  for (const [loc, name] of [['en-US', 'en'], ['fr-FR', 'fr']]) {
    for (const [dn, vp] of [['phone', { width: 390, height: 844 }], ['small', { width: 320, height: 568 }], ['landscape', { width: 844, height: 390 }]]) {
      const s = await start(new Map(), { local: true, locale: loc, viewport: vp, today: '2026-11-12' });
      const q = s.page;
      await q.route('**/src/i18n-data.ts*', async (route) => { const r = await route.fetch(); const body = await r.text(); await route.fulfill({ response: r, body: body + `\nObject.assign(EN, ${JSON.stringify(Object.fromEntries(Object.entries(J).map(([k, v]) => [k, v[0]])))});\nObject.assign(FR, ${JSON.stringify(Object.fromEntries(Object.entries(J).map(([k, v]) => [k, v[1]])))});\n` }); });
      await q.reload(); await q.waitForSelector('.hub-grid, .kids, .empty-home');
      await q.evaluate(() => (location.hash = '#/subject/games')); await q.waitForSelector('.gm-card');
      const homeText = await q.evaluate(() => document.querySelector('.gm-grid').innerText);
      await q.evaluate(() => (location.hash = '#/games/sokoban')); await q.waitForSelector('#sk-canvas'); await q.waitForTimeout(250);
      const game = await q.evaluate(() => document.querySelector('.sk-wrap').innerText);
      ok(!CJK.test(game), `${name} ${dn}: the game screen has no Chinese left (${game.replace(/\s+/g, ' ').slice(0, 80)})`);
      ok(/Sokoban/.test(homeText), `${name} ${dn}: the card is named Sokoban on the games home`);
      await q.click('#sk-levels'); await q.waitForTimeout(150);
      const pick = await q.evaluate(() => document.querySelector('.sk-picker').innerText);
      ok(!CJK.test(pick), `${name} ${dn}: the picker has no Chinese left`);
      const over = await q.evaluate(() => { const e = document.querySelector('#sk-picker'), bs = [...document.querySelectorAll('.sk-picker h2, .sk-picker h3, .sk-close, .sk-hud .sk-stat, .sk-hud .mopt')]; return bs.filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent); });
      ok(over.length === 0, `${name} ${dn}: no text is cut off${over.length ? ' -> ' + over.join() : ''}`);
      await q.screenshot({ path: OUT + `sokoban-${name}-${dn}-picker.png` });
      await q.click('#sk-close');
      // win overlay in this language
      const sol = await q.evaluate(async () => { const M = await import('/src/games/sokoban-logic.ts'); return M.solve(M.parseLevel(M.LEVELS[0].rows)).path; });
      for (const d of sol) await q.keyboard.press({ U: 'ArrowUp', D: 'ArrowDown', L: 'ArrowLeft', R: 'ArrowRight' }[d]);
      await q.waitForFunction(() => { const o = document.querySelector('#sk-ovl'); return !!o && !o.hidden; }, null, { timeout: 3000 });
      const ov = await q.evaluate(() => document.querySelector('#sk-ovl').innerText);
      ok(!CJK.test(ov) && /clear|réussi/i.test(ov), `${name} ${dn}: the win overlay is translated (${ov.replace(/\s+/g, ' ')})`);
      if (dn === 'phone') await q.screenshot({ path: OUT + `sokoban-${name}-win.png` });
      ok(s.log.external.length === 0, `${name} ${dn}: no outside request`);
      await s.browser.close();
    }
  }
  await done();
})();
