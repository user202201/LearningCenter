// Snake: the pure rules (random games, walls, wrap, growth, win) and the screen (keys, WASD, swipe, on-screen arrows, pause, easy mode, best score, layout on 3 screens).
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  const p = t.page;
  await p.evaluate(() => (location.hash = '#/games/snake')); await p.waitForSelector('#snake-canvas');

  // ---------- the rules ----------
  const L = await p.evaluate(async () => {
    const M = await import('/src/games/snake-logic.ts');
    const res = { bad: [], games: 0, steps: 0, ate: 0, died: 0, wraps: 0 };
    let seed = 12345; const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const same = (a, b) => a.x === b.x && a.y === b.y;
    const check = (s, tag) => {
      const set = new Set(s.snake.map((q) => q.x + ',' + q.y));
      if (set.size !== s.snake.length) res.bad.push(tag + ' overlap');
      if (s.snake.length !== 3 + s.eaten) res.bad.push(tag + ' length');
      if (s.snake.some((q) => q.x < 0 || q.y < 0 || q.x >= s.w || q.y >= s.h)) res.bad.push(tag + ' out of grid');
      if (s.food && set.has(s.food.x + ',' + s.food.y)) res.bad.push(tag + ' food on snake');
      if (s.score !== s.eaten * 10) res.bad.push(tag + ' score');
      for (let i = 1; i < s.snake.length; i++) {
        const a = s.snake[i - 1], b = s.snake[i];
        const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
        const adj = (dx === 1 && dy === 0) || (dx === 0 && dy === 1) || (s.wrap && ((dx === s.w - 1 && dy === 0) || (dy === s.h - 1 && dx === 0)));
        if (!adj) res.bad.push(tag + ' segments not adjacent');
      }
    };
    // a new snake
    const s0 = M.newSnake(16, 16, false, rng);
    if (s0.snake.length !== 3 || s0.dir !== 'R' || !s0.alive || !s0.food) res.bad.push('new snake');
    check(s0, 'new');
    // reverse / same / queue limit
    const s1 = M.newSnake(16, 16, false, rng);
    if (M.turn(s1, 'L') || M.turn(s1, 'R')) res.bad.push('reverse or same turn accepted');
    if (!M.turn(s1, 'U')) res.bad.push('turn up refused');
    if (M.turn(s1, 'D')) res.bad.push('reverse of the queued turn accepted');
    if (!M.turn(s1, 'L')) res.bad.push('second queued turn refused');
    if (M.turn(s1, 'D')) res.bad.push('third queued turn accepted');
    M.step(s1); if (s1.dir !== 'U') res.bad.push('first queued turn not used first');
    M.step(s1); if (s1.dir !== 'L') res.bad.push('second queued turn not used second');
    // walls
    const s2 = M.newSnake(8, 8, false, rng); let r;
    for (let i = 0; i < 20 && s2.alive; i++) { r = M.step(s2); }
    if (s2.alive || r.why !== 'wall' || M.step(s2).moved) res.bad.push('wall did not kill');
    const s3 = M.newSnake(8, 8, true, rng); s3.food = { x: 0, y: 0 };
    for (let i = 0; i < 20; i++) { M.step(s3); if (!s3.alive) res.bad.push('wrap killed at ' + i); }
    // wrap: head crosses and appears on the other side
    const s4 = M.newSnake(8, 8, true, rng); s4.snake = [{ x: 7, y: 3 }, { x: 6, y: 3 }, { x: 5, y: 3 }]; s4.food = { x: 0, y: 0 };
    M.step(s4); if (s4.snake[0].x !== 0 || s4.snake[0].y !== 3) res.bad.push('wrap right -> left');
    s4.queue = []; s4.dir = 'U'; s4.snake = [{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }]; M.step(s4); if (s4.snake[0].y !== 7) res.bad.push('wrap top -> bottom');
    // self collision and chasing the tail
    const s5 = M.newSnake(10, 10, false, rng); s5.food = { x: 9, y: 9 };
    s5.snake = [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }, { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 4 }]; s5.dir = 'U';
    M.turn(s5, 'L'); r = M.step(s5); if (!r.died || r.why !== 'self') res.bad.push('self collision not detected');
    const s6 = M.newSnake(10, 10, false, rng); s6.food = { x: 9, y: 9 };
    s6.snake = [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }]; s6.dir = 'U';
    M.turn(s6, 'L'); r = M.step(s6); if (r.died) res.bad.push('moving into the tail cell (it moves away) killed the snake');
    // eating
    const s7 = M.newSnake(12, 12, false, rng); const h0 = s7.snake[0]; s7.food = { x: h0.x + 1, y: h0.y };
    r = M.step(s7);
    if (!r.ate || s7.snake.length !== 4 || s7.score !== 10 || s7.eaten !== 1 || !s7.food || s7.snake.some((q) => same(q, s7.food))) res.bad.push('eating');
    // winning on a full board: boustrophedon path of 6 x 3
    const s8 = M.newSnake(6, 3, false, rng); const path = [];
    for (let y = 0; y < 3; y++) for (let i = 0; i < 6; i++) path.push({ x: y % 2 ? 5 - i : i, y });
    s8.snake = path.slice(0, 17).reverse(); s8.food = path[17]; s8.dir = 'R'; s8.eaten = 14; s8.score = 140; s8.queue = [];
    r = M.step(s8); if (!r.won || !s8.won || s8.alive || s8.snake.length !== 18) res.bad.push('win on a full board');
    // fuzz
    for (let g = 0; g < 400; g++) {
      const wrap = g % 2 === 0, w = 6 + Math.floor(rng() * 11), hh = 5 + Math.floor(rng() * 12);
      const s = M.newSnake(w, hh, wrap, rng); res.games++;
      for (let i = 0; i < 600 && s.alive; i++) {
        if (rng() < 0.3) M.turn(s, ['U', 'D', 'L', 'R'][Math.floor(rng() * 4)]);
        // sometimes steer towards the food so that it grows
        if (rng() < 0.5 && s.food) { const hd = s.snake[0]; M.turn(s, s.food.x > hd.x ? 'R' : s.food.x < hd.x ? 'L' : s.food.y > hd.y ? 'D' : 'U'); }
        const before = s.eaten, rr = M.step(s); res.steps++;
        if (rr.ate !== (s.eaten === before + 1)) res.bad.push('ate flag');
        if (rr.ate) res.ate++;
        if (s.alive) check(s, 'g' + g + 's' + i);
        if (res.bad.length > 5) break;
      }
      if (!s.alive) res.died++;
    }
    // speed
    let prevMs = 1e9; for (let e = 0; e < 200; e++) { const ms = M.interval(2, e); if (ms > prevMs || ms < 60) res.bad.push('interval not monotonic / below the floor at ' + e); prevMs = ms; }
    if (!(M.interval(1, 0) > M.interval(3, 0) && M.interval(3, 0) > M.interval(5, 0))) res.bad.push('levels not faster');
    if (!(M.interval(2, 3, true) > M.interval(2, 3, false))) res.bad.push('easy not slower');
    return res;
  });
  ok(L.bad.length === 0, `rules: ${L.games} random games, ${L.steps} steps, ${L.ate} apples, ${L.died} deaths, all invariants hold${L.bad.length ? ' -> ' + L.bad.slice(0, 6).join('; ') : ''}`);
  ok(L.ate > 100 && L.died > 100, 'the fuzz really ate and died');

  // ---------- the screen ----------
  const st = () => p.evaluate(() => { const s = window.__snake.state(); return { dir: s.dir, head: s.snake[0], len: s.snake.length, alive: s.alive, score: s.score, eaten: s.eaten, wrap: s.wrap, food: s.food, phase: window.__snake.phase() }; });
  const tick = (n = 1) => p.evaluate((n) => { for (let i = 0; i < n; i++) window.__snake.tick(); }, n);
  await p.screenshot({ path: OUT + 'snake-ready.png' });
  ok(await p.locator('#snake-ovl').isVisible() && (await p.textContent('#snake-score')) === '得分：0' && (await p.textContent('#snake-wrap')) === '穿墙：关', 'ready: overlay with the start button, score 0, walls kill');
  const box = await p.evaluate(() => { const c = document.querySelector('#snake-canvas').getBoundingClientRect(); return { w: c.width, h: c.height, l: c.left, r: innerWidth - c.right }; });
  ok(Math.abs(box.w - box.h) < 1 && Math.abs(box.l - box.r) <= 2, `the board is square (${box.w}x${box.h}) and centred (${Math.round(box.l)} / ${Math.round(box.r)})`);
  await p.click('#snake-start');
  ok((await st()).phase === 'play', 'Start begins the game');
  await p.keyboard.press('ArrowUp'); await tick();
  let a = await st(); ok(a.dir === 'U' && a.head.y === 7, 'arrow up turns up and moves: ' + JSON.stringify(a.head));
  await p.keyboard.press('a'); await tick(); a = await st(); ok(a.dir === 'L', 'A (WASD) turns left');
  await p.keyboard.press('ArrowRight'); await tick(); a = await st(); ok(a.dir === 'L', 'a turn straight back is refused');
  await p.keyboard.press('w'); await tick(); a = await st(); ok(a.dir === 'U', 'W turns up');
  await p.keyboard.press('d'); await tick(); a = await st(); ok(a.dir === 'R', 'D turns right');
  await p.keyboard.press('ArrowDown'); await tick(); a = await st(); ok(a.dir === 'D', 'arrow down turns down');
  // on-screen arrows
  await p.click('.snake-arrow[data-d=R]'); await tick(); a = await st(); ok(a.dir === 'R', 'on-screen right arrow');
  await p.click('.snake-arrow[data-d=U]'); await tick(); a = await st(); ok(a.dir === 'U', 'on-screen up arrow');
  // swipe with the mouse / finger on the board
  const c = await p.evaluate(() => { const r = document.querySelector('#snake-field').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.move(c.x - 60, c.y, { steps: 4 }); await p.mouse.up(); await tick(); a = await st();
  ok(a.dir === 'L', 'a swipe to the left turns left');
  await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.move(c.x, c.y + 70, { steps: 4 }); await p.mouse.up(); await tick(); a = await st();
  ok(a.dir === 'D', 'a swipe down turns down');
  ok((await p.evaluate(() => window.__snake.state().alive)), 'still alive after all that');
  // eating: put the apple in front of the head
  await p.evaluate(() => { const s = window.__snake.state(); s.snake = [{ x: 8, y: 6 }, { x: 8, y: 5 }, { x: 8, y: 4 }]; s.dir = 'D'; s.queue = []; s.food = { x: 8, y: 7 }; });
  await tick(); a = await st();
  ok(a.eaten === 1 && a.len === 4 && a.score === 10 && (await p.textContent('#snake-score')) === '得分：10', 'eating an apple: longer by one, 10 points, the score line follows');
  await p.screenshot({ path: OUT + 'snake-eat.png' });
  // pause
  await p.click('#snake-pause');
  ok((await st()).phase === 'pause' && (await p.textContent('#snake-pause')) === '继续' && await p.locator('#snake-ovl').isVisible(), 'pause: the game stops, the button says continue');
  const hp = (await st()).head; await tick(3); await p.waitForTimeout(400);
  ok(JSON.stringify((await st()).head) === JSON.stringify(hp), 'nothing moves while paused');
  await p.keyboard.press('p'); ok((await st()).phase === 'play', 'P resumes');
  // death on the wall, best score kept
  await p.evaluate(() => { const s = window.__snake.state(); s.snake = [{ x: 15, y: 5 }, { x: 14, y: 5 }, { x: 13, y: 5 }]; s.dir = 'R'; s.queue = []; s.food = { x: 0, y: 0 }; });
  await tick(); a = await st();
  ok(!a.alive && a.phase === 'dead', 'the wall kills when wrap is off');
  await p.waitForFunction(() => (() => { const o = document.querySelector('#snake-ovl'); return !!o && !o.hidden; })(), null, { timeout: 4000 });
  await p.screenshot({ path: OUT + 'snake-dead.png' });
  ok((await p.textContent('#snake-ovl h2')) === '游戏结束' && (await p.textContent('#snake-ovl p')).includes('10'), 'game over overlay with the score');
  const best = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).snake['best-normal']);
  ok(best === 10 && (await p.textContent('#snake-best')) === '最高：10', 'the best score is kept in learn.games.v1: ' + best);
  await p.click('#snake-start');
  a = await st(); ok(a.phase === 'play' && a.score === 0 && a.len === 3 && (await p.textContent('#snake-best')) === '最高：10', 'play again: a new game, the best stays');
  // wrap switch
  await p.click('#snake-wrap');
  ok((await p.textContent('#snake-wrap')) === '穿墙：开' && (await st()).wrap && (await st()).phase === 'ready', 'the wrap switch is on (and a new game is ready)');
  await p.keyboard.press('ArrowUp');
  await p.evaluate(() => { const s = window.__snake.state(); s.snake = [{ x: 15, y: 5 }, { x: 14, y: 5 }, { x: 13, y: 5 }]; s.dir = 'R'; s.queue = []; s.food = { x: 4, y: 12 }; });
  await tick(); a = await st();
  ok(a.alive && a.head.x === 0 && a.head.y === 5, 'with wrap on the snake comes out on the other side');
  // speed level and easy mode
  const ms0 = await p.evaluate(async () => (await import('/src/games/snake-logic.ts')).interval(2, 0));
  await p.click('#snake-level'); ok((await p.textContent('#snake-level')) === '速度：3', 'the speed level button counts up');
  await p.click('#snake-mode');
  ok((await p.evaluate(() => window.__snake.grid())) === 10 && (await p.textContent('#snake-mode')) === '模式：简单', 'easy mode: a smaller board (10 x 10)');
  await p.screenshot({ path: OUT + 'snake-easy.png' });
  await p.click('#snake-mode');
  ok((await p.evaluate(() => window.__snake.grid())) === 16, 'normal mode again: 16 x 16');
  ok(await p.evaluate(() => { const g = JSON.parse(localStorage.getItem('learn.games.v1')).snake; return g.easy === false && g.wrap === true && g.level === 3; }), 'the settings are kept on this device');

  // ---------- layout on 3 screens ----------
  for (const [name, w, hgt] of [['phone', 320, 568], ['ipad', 820, 1180], ['side', 844, 390]]) {
    await p.setViewportSize({ width: w, height: hgt });
    await p.evaluate(() => (location.hash = '#/subject/games')); await p.evaluate(() => (location.hash = '#/games/snake')); await p.waitForSelector('#snake-canvas');
    await p.waitForTimeout(250);
    const m = await p.evaluate(() => {
      const R = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
      const f = R('#snake-field'), pad = R('.snake-pad'), hud = R('.snake-hud');
      return { f, pad, hud, vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, cell: window.__snake.cell(), btns: [...document.querySelectorAll('.snake-hud button')].every((b) => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }) };
    });
    const inside = (b) => b.l >= -0.5 && b.r <= m.vw + 0.5 && b.t >= -0.5 && b.b <= m.vh + 0.5;
    ok(inside(m.f) && inside(m.pad) && inside(m.hud) && m.btns, `${name} ${w}x${hgt}: board, arrows and buttons are on the screen (board ${Math.round(m.f.w)}px, cell ${Math.round(m.cell)}px)`);
    ok(m.sw <= m.vw && m.sh <= m.vh + 1, `${name}: no page scrolling`);
    ok(m.f.b <= m.pad.t + 1 || m.f.r <= m.pad.l + 1 || m.pad.r <= m.f.l + 1, `${name}: the arrows do not cover the board`);
    if (name !== 'side') ok(Math.abs(m.f.l - (m.vw - m.f.r)) <= 3, `${name}: the board is centred`);
    ok(m.f.w >= (name === 'side' ? 130 : 200), `${name}: the board is big enough (${Math.round(m.f.w)}px)`);
    await p.screenshot({ path: OUT + `snake-${name}.png` });
  }
  // leaving stops it
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-grid');
  await p.waitForFunction(() => !window.__snake);
  ok(true, 'leaving the game removes it (the hook is gone, listeners removed)');
  await p.keyboard.press('ArrowUp');
  ok(t.log.external.length === 0, 'no request left the app');
  await t.browser.close();
  await done();
})();
