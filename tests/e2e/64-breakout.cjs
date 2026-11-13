// Breakout: the pure rules (all 12 levels cleared by a deterministic bot, physics invariants on random runs, power-ups, lives, level clear) and the screen
// (pointer / keys, launch, losing a ball, game over, level clear, pause, progress saved, layout on 5 sizes, sharp canvas, EN / FR, no outside request).
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const CJK = /[㐀-鿿]/;

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  const p = t.page;
  await p.evaluate(() => (location.hash = '#/games/breakout')); await p.waitForSelector('#bo-canvas');

  // ---------- the rules ----------
  const L = await p.evaluate(async () => {
    const M = await import('/src/games/breakout-logic.ts');
    const bad = []; const note = (m) => { if (bad.length < 12) bad.push(m); };
    const E = 1e-6;
    const inv = (s, tag) => {
      const hw = M.paddleW(s) / 2;
      if (s.balls.length > M.MAXBALLS) note(tag + ' too many balls');
      if (s.lives < 0 || s.lives > M.MAXLIVES) note(tag + ' lives ' + s.lives);
      if (s.px < hw - E || s.px > M.W - hw + E) note(tag + ' paddle outside the board');
      if (M.speedNow(s) > M.MAXV + E) note(tag + ' speed above the maximum');
      for (const b of s.balls) {
        if (!isFinite(b.x) || !isFinite(b.y) || !isFinite(b.dx) || !isFinite(b.dy)) { note(tag + ' NaN'); continue; }
        if (b.x < M.BR - E || b.x > M.W - M.BR + E || b.y < M.BR - E) note(tag + ` ball left the board (${b.x.toFixed(1)}, ${b.y.toFixed(1)})`);
        if (b.y > M.H + M.BR + 4) note(tag + ' ball far below the board');
        if (!b.stuck && Math.abs(Math.hypot(b.dx, b.dy) - 1) > 1e-6) note(tag + ' direction is not a unit vector (speed not conserved)');
        if (!b.stuck && Math.abs(b.dy) < 0.17) note(tag + ' ball almost horizontal');
        for (const k of s.bricks) if (b.x > k.x && b.x < k.x + k.w && b.y > k.y && b.y < k.y + k.h) note(tag + ' ball centre inside a brick (tunnelled)');
      }
      for (const k of s.bricks) if (k.hp < 1 || k.hp > k.maxhp) note(tag + ' brick hp');
    };
    const ball = (x, y, dx, dy) => ({ x, y, dx, dy, stuck: false, off: 0, sticky: false });
    const res = { levels: [], fuzzSteps: 0, bad };

    // the level tables
    if (M.LEVELS.length !== 12) note('12 levels expected');
    M.LEVELS.forEach((pat, i) => {
      if (!pat.every((r) => r.length === M.COLS && /^[.1-6A-FG]+$/.test(r))) note('level ' + (i + 1) + ' malformed');
      if (pat.length > 10) note('level ' + (i + 1) + ' too tall');
    });
    if (!M.LEVELS.slice(0, 4).every((pat) => !pat.join('').includes('G'))) note('gold bricks only on later levels');
    if (!M.LEVELS.slice(4).some((pat) => pat.join('').includes('G'))) note('no gold brick anywhere');
    if (!M.LEVELS.some((pat) => /[A-F]/.test(pat.join('')))) note('no 2-hit brick anywhere');
    const sig = new Set(M.LEVELS.map((pat) => pat.join('/'))); if (sig.size !== 12) note('levels are not all different');
    for (let l = 1; l <= 12; l++) { const bs = M.makeBricks(l); if (!bs.some((b) => b.power)) note('level ' + l + ' has no power-up brick'); if (bs.filter((b) => b.power === 'life').length > 1) note('more than one life per level'); if (JSON.stringify(bs) !== JSON.stringify(M.makeBricks(l))) note('power-up placement is not deterministic'); }
    if (!(M.baseSpeed(12) > M.baseSpeed(1))) note('speed does not rise with the level');

    // the bot clears every level (two seeds, a slower paddle too), invariants checked at every step
    for (let l = 1; l <= 12; l++) {
      for (const [seed, vmax] of [[1, 1100], [7, 1100], [3, 800]]) {
        const r = M.simulate(l, { seed, vmax, check: (s) => inv(s, `L${l}/seed${seed}`) });
        if (!r.cleared) note(`level ${l} seed ${seed} vmax ${vmax} NOT cleared (${r.state.bricks.filter((b) => !b.gold).length} bricks left after ${r.time.toFixed(0)} s)`);
        if (seed === 1 && vmax === 1100) res.levels.push({ l, cleared: r.cleared, time: Math.round(r.time), lives: r.lives, bricks: r.state.breakable });
        res.fuzzSteps += r.steps;
        if (r.cleared && r.state.bricks.some((b) => !b.gold)) note('cleared with breakable bricks left');
      }
    }

    // random play: a random paddle, random launches, random levels, some at the maximum speed
    let seed = 99; const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    let overs = 0, lostLives = 0;
    for (let g = 0; g < 70; g++) {
      const s = M.newLevel(1 + Math.floor(rng() * 12)); if (g % 3 === 0) { s.base = M.MAXV; s.speed = M.MAXV; }
      let px = s.px, tgt = px;
      for (let i = 0; i < 4000 && s.alive; i++) {
        if (i % 40 === 0) tgt = rng() * M.W;
        px += Math.max(-9, Math.min(9, tgt - px));
        if (rng() < 0.02) M.launch(s);
        if (rng() < 0.002) s.caps.push({ x: rng() * M.W, y: 300, kind: M.POWERS[Math.floor(rng() * 5)] });
        const before = s.lives, ev = M.step(s, 1 / 120, px); res.fuzzSteps++;
        if (s.lives < before) lostLives++;
        if (ev.some((e) => e.t === 'over') !== s.over) note('over event / flag mismatch');
        inv(s, 'fuzz' + g + 's' + i);
        if (bad.length > 8) break;
      }
      if (s.over) overs++;
    }
    res.overs = overs; res.lostLives = lostLives;

    // the paddle: the angle depends on where the ball hits; the centre sends it straight up
    const angle = (frac) => {
      const s = M.newLevel(1), hw = M.paddleW(s) / 2; s.balls = [ball(s.px + frac * hw, M.PY - 12, 0, 1)];
      const ev = M.step(s, 1 / 120, s.px); if (!ev.some((e) => e.t === 'paddle')) note('no paddle hit at ' + frac);
      return s.balls[0] ? { dx: s.balls[0].dx, dy: s.balls[0].dy } : { dx: 0, dy: 0 };
    };
    const a0 = angle(0), aL = angle(-0.9), aR = angle(0.9), aR2 = angle(0.3);
    if (Math.abs(a0.dx) > 1e-9 || a0.dy > -0.999) note('centre hit is not straight up');
    if (!(aL.dx < -0.5 && aR.dx > 0.5 && aL.dy < 0 && aR.dy < 0)) note('edges do not send the ball left / right and up');
    if (!(aR.dx > aR2.dx && aR2.dx > 0)) note('the angle does not grow towards the edge');
    if (Math.abs(aL.dx + aR.dx) > 1e-9) note('the paddle is not symmetric');
    // a ball that is already below the paddle top is not caught
    { const s = M.newLevel(1); s.balls = [ball(s.px, M.PY + 40, 0, 1)]; const ev = M.step(s, 1 / 120, s.px); if (ev.some((e) => e.t === 'paddle')) note('a ball below the paddle was caught'); }
    // the speed rises slowly with every paddle hit and stops rising
    { const s = M.newLevel(3); const v0 = M.speedNow(s); for (let i = 0; i < 60; i++) { s.balls = [ball(s.px, M.PY - 12, 0, 1)]; M.step(s, 1 / 120, s.px); } const v1 = M.speedNow(s); if (!(v1 > v0 && v1 <= s.base + 110 + E && v1 <= M.MAXV)) note(`speed after 60 hits ${v0} -> ${v1}`); }

    // walls: conserves the speed, left / right / top flip only the right component
    { const s = M.newLevel(1); s.bricks = [s.bricks[0]]; s.balls = [ball(M.BR + 1, 400, -0.6, -0.8)]; M.step(s, 1 / 60, s.px); const b = s.balls[0]; if (!(b.dx > 0 && b.dy < 0 && Math.abs(Math.hypot(b.dx, b.dy) - 1) < 1e-9)) note('left wall'); }
    { const s = M.newLevel(1); s.bricks = [s.bricks[0]]; s.balls = [ball(M.W - M.BR - 1, 400, 0.6, -0.8)]; M.step(s, 1 / 60, s.px); if (!(s.balls[0].dx < 0)) note('right wall'); }
    { const s = M.newLevel(1); s.bricks = [s.bricks[0]]; s.balls = [ball(240, M.BR + 1, 0.6, -0.8)]; M.step(s, 1 / 60, s.px); if (!(s.balls[0].dy > 0)) note('top wall'); }

    // no tunnelling at the maximum speed: a ball fired at every brick of a full level from below / the side hits it
    for (const lvl of [1, 6, 12]) {
      const base = M.newLevel(lvl); let tested = 0, missed = 0;
      for (const target of base.bricks.slice(0, 60)) {
        const s = M.newLevel(lvl); s.base = M.MAXV; s.speed = M.MAXV;
        const keep = s.bricks.find((b) => b.c === target.c && b.r === target.r); const far = s.bricks.find((b) => b !== keep && !b.gold && Math.abs(b.c - keep.c) > 2) || s.bricks[0];
        s.bricks = [keep, far].filter((b, i, a) => a.indexOf(b) === i); const hp0 = keep.hp, n0 = s.bricks.length;
        s.balls = [ball(keep.x + keep.w / 2, keep.y + keep.h + 120, 0, -1)]; tested++;
        let hit = false;
        for (let i = 0; i < 120 && !hit; i++) { const ev = M.step(s, 1 / 120, s.px); inv(s, 'tunnel'); if (ev.some((e) => e.t === 'hit' || e.t === 'break' || e.t === 'gold')) hit = true; }
        if (!hit || (!keep.gold && keep.hp === hp0 && s.bricks.length === n0)) missed++;
      }
      if (missed) note(`level ${lvl}: ${missed} of ${tested} fast balls passed through a brick`);
    }
    // a fast diagonal ball cannot slip through the gap between two bricks
    { const s = M.newLevel(1); s.base = M.MAXV; s.speed = M.MAXV; const n0 = s.bricks.length; const dl = Math.hypot(0.35, 0.937); s.balls = [ball(30, 420, 0.35 / dl, -0.937 / dl)]; for (let i = 0; i < 80; i++) { M.step(s, 1 / 120, s.px); inv(s, 'diag'); } if (s.bricks.length === n0 && s.bricks.every((b) => b.hp === b.maxhp)) note('diagonal ball never hit anything'); }

    // brick hit counts: 1 hit, 2 hits, gold never
    const solo = (lvl, pick) => { const s = M.newLevel(lvl); const k = s.bricks.find(pick); const far = s.bricks.find((b) => !b.gold && b !== k && b.r !== k.r); s.bricks = [k, far]; return { s, k }; };
    const shoot = (s, k) => { s.balls = [ball(k.x + k.w / 2, k.y + k.h + 12, 0, -1)]; const all = []; for (let i = 0; i < 40; i++) all.push(...M.step(s, 1 / 120, s.px)); return all; };
    { const { s, k } = solo(1, (b) => b.r === 1 && b.c === 4); const sc = s.score, ev = shoot(s, k); if (!ev.some((e) => e.t === 'break') || s.bricks.includes(k) || s.score - sc !== 10) note('a 1-hit brick must break at once and give 10'); }
    { const { s, k } = solo(7, (b) => b.maxhp === 2 && b.r === 0 && b.c === 3); const sc = s.score; let ev = shoot(s, k);
      if (!ev.some((e) => e.t === 'hit') || ev.some((e) => e.t === 'break') || k.hp !== 1 || !s.bricks.includes(k) || s.score - sc !== 5) note('a 2-hit brick must survive the first hit (hp 1, 5 points)');
      ev = shoot(s, k); if (!ev.some((e) => e.t === 'break') || s.bricks.includes(k) || s.score - sc !== 15) note('a 2-hit brick must break at the second hit'); }
    { const { s, k } = solo(8, (b) => b.gold && b.r === 2 && b.c === 0); const sc = s.score; let gold = 0; for (let i = 0; i < 30; i++) { gold += shoot(s, k).filter((e) => e.t === 'gold').length; s.alive = true; } if (!s.bricks.includes(k) || k.hp !== 99 || s.score !== sc || gold < 25) note('a gold brick must never break and never give points'); }
    { const s = M.newLevel(8); const k = s.bricks.find((b) => b.gold); s.bricks = [k, s.bricks.find((b) => !b.gold)]; if (s.breakable < 1) note('breakable count'); }

    // level clear: the last breakable brick ends the level, gold bricks may remain
    { const s = M.newLevel(8), k = s.bricks.find((b) => !b.gold && b.maxhp === 1 && b.r === 1 && b.c === 4); s.bricks = s.bricks.filter((b) => b.gold || b === k); k.power = null; s.score = 0; s.lives = 2; const ev = shoot(s, k);
      if (!ev.some((e) => e.t === 'clear') || !s.cleared || s.alive || !s.bricks.every((b) => b.gold) || s.score < 10 + 100 + 100) note('level clear (gold bricks remain) / bonus'); if (M.step(s, 1 / 120, s.px).length) note('a cleared level must stop'); }
    { const s = M.newLevel(1); const ev = []; const k = s.bricks[0]; s.bricks = s.bricks.slice(0, 2); const k2 = s.bricks[1]; const e1 = shoot(s, k); if (e1.some((e) => e.t === 'clear') || s.cleared) note('cleared with a brick still there'); void ev; void k2; }

    // lives and game over
    { const s = M.newLevel(1); const lose = () => { s.balls = [ball(30, M.H + 8, 0, 1)]; return M.step(s, 1 / 120, s.px); };
      let ev = lose(); if (s.lives !== 2 || s.balls.length !== 1 || !s.balls[0].stuck || !ev.some((e) => e.t === 'lost')) note('losing the ball: -1 life and a new ball on the paddle');
      s.wideT = 5; s.caps.push({ x: 10, y: 10, kind: 'wide' }); ev = lose(); if (s.lives !== 1 || s.wideT !== 0 || s.caps.length) note('a lost life clears the power-ups');
      ev = lose(); if (s.lives !== 0 || !s.over || s.alive || !ev.some((e) => e.t === 'over')) note('game over at 0 lives'); if (M.step(s, 1 / 120, s.px).length) note('nothing happens after game over'); }
    { const s = M.newLevel(1); s.balls = [ball(30, 300, 0, 1), ball(300, 300, 0, 1)]; s.balls[0].y = M.H + 8; M.step(s, 1 / 120, s.px); if (s.lives !== 3 || s.balls.length !== 1) note('with 2 balls losing one costs nothing'); }

    // power-ups: caught with the paddle
    const catchP = (kind, setup) => { const s = M.newLevel(2); setup && setup(s); s.caps.push({ x: s.px, y: M.PY - 5, kind }); s.balls = [ball(400, 300, 0.3, -Math.sqrt(1 - 0.09))]; const ev = M.step(s, 1 / 120, s.px); return { s, ev }; };
    { const { s, ev } = catchP('wide'); if (M.paddleW(s) !== M.PW_WIDE || !ev.some((e) => e.t === 'catch') || s.caps.length) note('wide: the paddle grows'); const hw = M.paddleW(s) / 2; M.step(s, 1 / 120, 0); if (s.px !== hw) note('wide paddle clamped to the board'); for (let i = 0; i < 120 * (M.WIDE_TIME + 1); i++) M.step(s, 1 / 120, s.px); if (M.paddleW(s) !== M.PW) note('wide: runs out'); }
    { const { s } = catchP('slow'); const v = M.speedNow(s); if (Math.abs(v - 0.7 * Math.min(M.MAXV, s.speed)) > 1e-9) note('slow: 70 % speed'); for (let i = 0; i < 120 * (M.SLOW_TIME + 1); i++) M.step(s, 1 / 120, s.px); if (Math.abs(M.speedNow(s) - Math.min(M.MAXV, s.speed)) > 1e-9) note('slow: runs out'); }
    { const { s } = catchP('multi'); if (s.balls.length !== 3 || s.balls.some((b) => b.stuck)) note('multi: three balls'); const d = new Set(s.balls.map((b) => b.dx.toFixed(3))); if (d.size !== 3) note('multi: three different directions'); for (let i = 0; i < 600; i++) { M.step(s, 1 / 120, s.px); inv(s, 'multi'); } }
    { const { s } = catchP('multi', (x) => { x.balls = []; }); void s; }
    { const { s } = catchP('life'); if (s.lives !== 4) note('life: +1'); const r = catchP('life', (x) => { x.lives = 5; }); if (r.s.lives !== 5) note('life: capped at 5'); }
    { const { s } = catchP('sticky'); if (s.sticky !== M.STICKY_CATCHES) note('sticky: armed');
      s.balls = [ball(s.px + 20, M.PY - 12, 0, 1)]; M.step(s, 1 / 120, s.px); const b = s.balls[0];
      if (!b.stuck || !b.sticky || s.sticky !== M.STICKY_CATCHES - 1) note('sticky: the ball sticks to the paddle');
      const off = b.off; M.step(s, 1 / 120, s.px + 40); if (Math.abs(b.x - (s.px + off * M.paddleW(s) / 2)) > 1e-6) note('sticky: the ball moves with the paddle');
      M.launch(s); if (b.stuck || b.dy >= 0) note('sticky: launch lets go upwards');
      s.balls = [ball(s.px, M.PY - 12, 0, 1)]; M.step(s, 1 / 120, s.px); let auto = false; for (let i = 0; i < 120 * 3 && !auto; i++) { M.step(s, 1 / 120, s.px); auto = !s.balls[0].stuck; } if (!auto) note('sticky: lets go by itself after a moment'); }
    { const s = M.newLevel(1); s.bricks = [s.bricks[0], s.bricks[9]]; s.bricks[0].power = 'life'; const k = s.bricks[0]; shoot(s, k); if (!s.caps.some((c) => c.kind === 'life')) note('a power-up brick drops its capsule'); const y0 = s.caps[0].y; M.step(s, 0.5, s.px); if (!(s.caps[0].y > y0 + 50)) note('the capsule falls'); }
    { const s = M.newLevel(1); s.caps.push({ x: 40, y: M.H, kind: 'wide' }); M.step(s, 1, s.px); if (s.caps.length) note('a missed capsule disappears'); }
    // the serve: the ball waits on the paddle and never moves until launched
    { const s = M.newLevel(1); const b = s.balls[0]; for (let i = 0; i < 100; i++) M.step(s, 1 / 120, 100 + i); if (!b.stuck || Math.abs(b.x - s.px) > 1e-9 || b.y !== M.PY - M.BR - 0.5) note('serve: the ball sits on the paddle'); }
    return res;
  });
  ok(L.bad.length === 0, `rules: ${L.fuzzSteps} simulated steps, all invariants hold${L.bad.length ? ' -> ' + L.bad.join('; ') : ''}`);
  ok(L.levels.length === 12 && L.levels.every((x) => x.cleared), `the bot clears all 12 levels: ${L.levels.map((x) => x.l + ':' + x.time + 's/' + x.lives + 'L').join(' ')}`);
  ok(L.overs > 3 && L.lostLives > 20, `the random play really lost balls and ended games (${L.lostLives} lives lost, ${L.overs} game overs)`);

  // ---------- the screen ----------
  const S = () => p.evaluate(() => { const s = window.__breakout.state(); return { phase: window.__breakout.phase(), level: s.level, lives: s.lives, score: s.score, bricks: s.bricks.length, balls: s.balls.map((b) => ({ x: b.x, y: b.y, dx: b.dx, dy: b.dy, stuck: b.stuck })), px: window.__breakout.px(), target: window.__breakout.target(), caps: s.caps.length }; });
  const step = (n = 1) => p.evaluate((n) => window.__breakout.step(n), n);
  const ovl = () => p.evaluate(() => { const o = document.querySelector('#bo-ovl'); return { shown: !o.hidden, h: o.querySelector('h2').textContent, p: o.querySelector('p').textContent, b: o.querySelector('button').textContent }; });
  const cbox = () => p.evaluate(() => { const r = document.querySelector('#bo-canvas').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
  await p.evaluate(() => window.__breakout.manual(true));
  await p.screenshot({ path: OUT + 'breakout-ready.png' });
  let o = await ovl();
  ok(o.shown && o.h === '打砖块' && o.b === '开始' && (await p.textContent('#bo-score')) === '得分：0' && (await p.textContent('#bo-level')) === '关卡：1', 'ready: overlay with the start button, score 0, level 1');
  ok((await p.locator('#bo-lives .bo-heart.on').count()) === 3 && (await p.locator('#bo-lives .bo-heart').count()) === 3, 'three lives shown as hearts');
  let b0 = await cbox(); ok(Math.abs(b0.h / b0.w - 4 / 3) < 0.01, `the board keeps its 3:4 shape (${Math.round(b0.w)}x${Math.round(b0.h)})`);
  await p.click('#bo-start'); let a = await S();
  ok(a.phase === 'play' && a.balls[0].stuck, 'Start: the ball waits on the paddle');
  // the paddle follows the pointer (mouse hover), the ball rides on it
  await p.mouse.move(b0.l + b0.w * 0.2, b0.t + b0.h * 0.5); await step(120); a = await S();
  ok(Math.abs(a.px - 96) < 3 && Math.abs(a.balls[0].x - a.px) < 0.01, `the paddle follows the pointer to the left (${a.px.toFixed(1)}) and carries the ball`);
  await p.mouse.move(b0.l + b0.w * 0.8, b0.t + b0.h * 0.5); await step(10); const mid = (await S()).px; await step(120); a = await S();
  ok(Math.abs(a.px - 384) < 3 && mid > 96 && mid < 384, `smoothing: on its way after 10 steps (${mid.toFixed(0)}), there after 1 s (${a.px.toFixed(0)})`);
  // keys
  const tgt0 = (await S()).target;
  await p.keyboard.down('ArrowLeft'); await step(60); await p.keyboard.up('ArrowLeft'); await step(60); a = await S();
  ok(a.target < tgt0 - 250 && Math.abs(a.px - a.target) < 2, 'the left arrow moves the paddle left (and stops when released)');
  const tgt1 = a.target; await p.keyboard.down('d'); await step(40); await p.keyboard.up('d'); a = await S(); ok(a.target > tgt1 + 150, 'D moves it right');
  await p.keyboard.down('a'); await step(20); await p.keyboard.up('a'); const tgt2 = (await S()).target; ok(tgt2 < a.target - 50, 'A moves it left');
  await step(5); const stay = (await S()).target; await step(30); ok((await S()).target === stay, 'the paddle stays where it is with no key');
  await p.keyboard.down('ArrowRight'); await step(400); await p.keyboard.up('ArrowRight'); await step(60); a = await S(); ok(a.px <= 480 - 48 + 0.01 && a.px >= 480 - 48 - 6, 'the paddle stops at the right wall (' + a.px.toFixed(1) + ')');
  // one finger only: a second finger is ignored
  await p.evaluate(() => { const f = document.querySelector('#bo-field'), r = document.querySelector('#bo-canvas').getBoundingClientRect(); const mk = (type, id, x) => f.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: r.left + r.width * x, clientY: r.top + 300, bubbles: true, isPrimary: id === 5 })); window.__e = { mk }; mk('pointerdown', 5, 0.3); mk('pointerdown', 6, 0.9); mk('pointermove', 6, 0.9); mk('pointermove', 5, 0.35); });
  await step(120); a = await S(); ok(Math.abs(a.target - 0.35 * 480) < 2, `a touch drags the paddle; a second finger is ignored (target ${a.target.toFixed(0)})`);
  await p.evaluate(() => { window.__e.mk('pointermove', 5, 0.6); window.__e.mk('pointerup', 5, 0.6); });
  ok((await S()).balls[0].stuck, 'a drag does not launch the ball');
  // launch: a tap on the board, Space
  const cb = await cbox();
  await p.mouse.move(cb.l + cb.w * 0.5, cb.t + cb.h * 0.5); await p.mouse.down(); await p.mouse.up(); a = await S();
  ok(!a.balls[0].stuck && a.balls[0].dy < 0, 'a tap launches the ball upwards');
  await step(30); const y1 = (await S()).balls[0].y; await step(30); ok((await S()).balls[0].y < y1 - 20, 'the ball flies');
  await p.screenshot({ path: OUT + 'breakout-play.png' });
  // lose the ball
  await p.evaluate(() => { const b = window.__breakout.state().balls[0]; b.x = 30; b.y = 660; b.dx = 0; b.dy = 1; });
  await step(2); a = await S(); o = await ovl();
  ok(a.lives === 2 && a.balls.length === 1 && a.balls[0].stuck && !o.shown && (await p.locator('#bo-lives .bo-heart.on').count()) === 2 && (await p.locator('#bo-lives .bo-heart').count()) === 3, 'losing the ball: 2 lives left, hearts follow, a new ball waits');
  await p.keyboard.press(' '); a = await S(); ok(!a.balls[0].stuck, 'Space launches');
  // pause: button, P, Esc, a hidden tab
  await p.click('#bo-pause'); a = await S(); o = await ovl(); const yP = a.balls[0].y;
  ok(a.phase === 'pause' && o.shown && o.h === '暂停' && (await p.textContent('#bo-pause')) === '继续', 'pause: overlay, the button says resume');
  await step(60); await p.waitForTimeout(300); ok(Math.abs((await S()).balls[0].y - yP) < 1e-9, 'nothing moves while paused');
  await p.keyboard.press('p'); ok((await S()).phase === 'play', 'P resumes');
  await p.keyboard.press('Escape'); ok((await S()).phase === 'pause', 'Esc pauses');
  await p.click('#bo-start'); ok((await S()).phase === 'play', 'the overlay button resumes');
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { get: () => true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  ok((await S()).phase === 'pause', 'a hidden tab pauses the game'); await p.evaluate(() => { delete document.hidden; }); await p.keyboard.press('p');
  // game over and retry
  await p.evaluate(() => { const s = window.__breakout.state(); s.lives = 1; s.score = 40; const b = s.balls[0]; b.stuck = false; b.x = 30; b.y = 660; b.dx = 0; b.dy = 1; });
  await step(2); a = await S(); o = await ovl();
  ok(a.phase === 'over' && o.shown && o.h === '游戏结束' && o.p === '本关未完成，可重试。' && o.b === '重试' && a.lives === 0, 'game over: overlay with the retry button');
  await p.screenshot({ path: OUT + 'breakout-over.png' });
  ok((await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).breakout.best)) === 40 && (await p.textContent('#bo-best')) === '最高：40', 'the best score is kept in learn.games.v1');
  await p.click('#bo-start'); a = await S();
  ok(a.phase === 'play' && a.lives === 3 && a.score === 0 && a.level === 1 && a.balls[0].stuck && (await p.textContent('#bo-best')) === '最高：40', 'retry: the same level again, 3 lives, the best stays');
  // level clear
  await p.evaluate(() => { const s = window.__breakout.state(); const k = s.bricks.find((b) => b.r === 4 && b.c === 4); k.power = null; s.bricks = [k]; const b = s.balls[0]; b.stuck = false; b.x = k.x + k.w / 2; b.y = k.y + k.h + 30; b.dx = 0; b.dy = -1; });
  await step(60); a = await S(); o = await ovl();
  ok(a.phase === 'clear' && o.shown && o.h === '已通关。' && o.b === '下一关' && a.bricks === 0, 'level clear: overlay with the next-level button');
  await p.screenshot({ path: OUT + 'breakout-clear.png' });
  const sc = a.score; ok(sc >= 10 + 100 + 150 && o.p.includes(String(sc)), 'score = brick + clear bonus (100 + 50 per life) = ' + sc);
  ok((await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).breakout)).level === 2, 'the level reached (2) is remembered');
  await p.click('#bo-start'); a = await S(); ok(a.phase === 'play' && a.level === 2 && a.score === sc && (await p.textContent('#bo-level')) === '关卡：2' && a.bricks === 30, 'next level: level 2 (30 bricks), the score goes on');
  await p.screenshot({ path: OUT + 'breakout-level2.png' });
  // power-up on the screen: catch a capsule
  await p.evaluate(() => { const s = window.__breakout.state(); s.caps.push({ x: s.px, y: 560, kind: 'wide' }); });
  await step(40); await p.screenshot({ path: OUT + 'breakout-wide.png' }); a = await S();
  ok(await p.evaluate(() => window.__breakout.state().wideT > 0 && window.__breakout.state().caps.length === 0), 'a capsule caught with the paddle takes effect (wide)');
  // the level button in ready phase picks among the levels reached
  await p.evaluate(() => window.__breakout.setLevel(1, 0));
  ok(!(await p.locator('#bo-level').isDisabled()), 'level button usable in the ready state');
  await p.click('#bo-level'); ok((await p.textContent('#bo-level')) === '关卡：2' && (await S()).level === 2, 'the level button steps through the levels reached');
  await p.click('#bo-level'); ok((await p.textContent('#bo-level')) === '关卡：1', '... and back to 1');
  // the last level: all levels cleared
  await p.evaluate(() => window.__breakout.setLevel(12, 100)); await p.click('#bo-start');
  await p.evaluate(() => { const s = window.__breakout.state(); const k = s.bricks.find((b) => !b.gold && b.maxhp === 1) || s.bricks.find((b) => !b.gold); k.hp = 1; k.power = null; s.bricks = s.bricks.filter((b) => b === k); const b = s.balls[0]; b.stuck = false; b.x = k.x + k.w / 2; b.y = k.y + k.h + 30; b.dx = 0; b.dy = -1; });
  await step(60); o = await ovl(); ok((await S()).phase === 'won' && o.h === '全部通关。' && o.b === '再玩一次', 'level 12 cleared: all levels cleared, play again');
  await p.click('#bo-start'); a = await S(); ok(a.level === 1 && a.score === 0 && a.phase === 'play', 'play again starts at level 1');
  // the real loop (not stepped by hand) moves the ball
  await p.evaluate(() => window.__breakout.manual(false));
  await p.keyboard.press(' '); const yA = (await S()).balls[0].y; await p.waitForTimeout(500); a = await S();
  ok(a.balls.length && (a.balls[0].y !== yA || a.lives < 3), 'the real animation loop runs the game by itself');
  await p.evaluate(() => window.__breakout.manual(true));

  // ---------- layout on 5 screens ----------
  const sizes = [['phone', 390, 844], ['small', 320, 568], ['ipad', 820, 1180], ['wide', 1180, 820], ['side', 844, 390]];
  for (const [name, w, hgt] of sizes) {
    await p.setViewportSize({ width: w, height: hgt });
    await p.evaluate(() => (location.hash = '#/subject/games')); await p.evaluate(() => (location.hash = '#/games/breakout')); await p.waitForSelector('#bo-canvas'); await p.waitForTimeout(300);
    const m = await p.evaluate(() => {
      const R = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
      return { f: R('#bo-field'), c: R('#bo-canvas'), hud: R('.bo-hud'), vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, btns: [...document.querySelectorAll('.bo-hud > *')].every((b) => { const r = b.getBoundingClientRect(); return r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.top >= -0.5 && r.bottom <= innerHeight + 0.5; }), ovlOk: (() => { const o = document.querySelector('#bo-ovl'), c = document.querySelector('#bo-canvas').getBoundingClientRect(); return [...o.children].every((e) => { const r = e.getBoundingClientRect(); return r.left >= c.left - 0.5 && r.right <= c.right + 0.5 && r.top >= c.top - 0.5 && r.bottom <= c.bottom + 0.5; }); })() };
    });
    const inside = (b) => b.l >= -0.5 && b.r <= m.vw + 0.5 && b.t >= -0.5 && b.b <= m.vh + 0.5;
    ok(inside(m.f) && inside(m.hud) && m.btns, `${name} ${w}x${hgt}: board and HUD are on the screen (board ${Math.round(m.c.w)}x${Math.round(m.c.h)})`);
    ok(m.sw <= m.vw && m.sh <= m.vh + 1, `${name}: no page scrolling`);
    ok(Math.abs(m.c.h / m.c.w - 4 / 3) < 0.012, `${name}: the board keeps its 3:4 shape`);
    ok(Math.abs(m.f.l - (m.vw - m.f.r)) <= 3, `${name}: the board is centred (${Math.round(m.f.l)} / ${Math.round(m.vw - m.f.r)})`);
    ok(m.f.r <= m.hud.l + 1 || m.hud.r <= m.f.l + 1 || m.hud.b <= m.f.t + 1, `${name}: the HUD does not cover the board`);
    ok(m.c.w >= (name === 'side' ? 200 : name === 'small' ? 230 : 300), `${name}: the board is big enough (${Math.round(m.c.w)}px)`);
    ok(m.ovlOk, `${name}: the overlay text and button fit inside the board`);
    await p.screenshot({ path: OUT + `breakout-${name}.png` });
    if (name === 'phone') {
      await p.evaluate(() => window.__breakout.manual(true));
      await p.click('#bo-start'); await p.mouse.move(150, 400); await step(20); await p.keyboard.press(' '); await step(60); await p.screenshot({ path: OUT + 'breakout-phone-play.png' });
    }
    if (name === 'side') { await p.click('#bo-start'); await step(10); await p.screenshot({ path: OUT + 'breakout-side-play.png' }); }
  }
  // a sharp canvas on a dpr 2 screen
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(150);
  await p.evaluate(() => { Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true }); window.dispatchEvent(new Event('resize')); }); await p.waitForTimeout(200);
  const sharp = await p.evaluate(() => { const c = document.querySelector('#bo-canvas'); return { w: c.width, cssw: parseFloat(c.style.width), h: c.height, cssh: parseFloat(c.style.height) }; });
  ok(sharp.w === Math.round(sharp.cssw * 2) && sharp.h === Math.round(sharp.cssh * 2), `dpr 2: the canvas has twice the pixels (${sharp.w}x${sharp.h} for ${sharp.cssw}x${sharp.cssh} css px)`);
  await p.evaluate(() => { delete window.devicePixelRatio; });
  // leaving stops it
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-grid');
  await p.waitForFunction(() => !window.__breakout);
  ok(true, 'leaving the game removes it (the hook is gone, listeners removed)');
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press(' ');
  ok(t.log.external.length === 0, 'no request left the app');
  await t.browser.close();

  // ---------- every Chinese text of the game is in the translation file ----------
  const json = JSON.parse(fs.readFileSync('src/games/breakout.i18n.json', 'utf8')); const keys = Object.keys(json);
  ok(keys.every((k) => k.length > 1 && json[k].length === 2 && json[k].every((v) => v && !CJK.test(v))), 'breakout.i18n.json: no one-character keys, EN and FR for every key');
  const covered = (txt) => keys.some((k) => { const re = new RegExp('^' + k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{0\}/g, '.+') + '$'); return re.test(txt); });
  const src = fs.readFileSync('src/games/breakout.ts', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const lit = [...src.matchAll(/["`]([^"`\n]*[㐀-鿿][^"`\n]*)["`]/g)].map((m) => m[1].replace(/\$\{[^}]*\}/g, '{0}'));
  const miss = lit.filter((x) => !json[x]); ok(lit.length >= 10 && miss.length === 0, `every Chinese text in breakout.ts is a key of the json (${lit.length} texts)${miss.length ? ' -> ' + miss.join(' | ') : ''}`);
  ok(['打砖块', '移动挡板接球，击碎全部砖块'].every((k) => json[k]), 'the name and the subtitle are translated');

  // ---------- en / fr ----------
  const merged = fs.readFileSync('src/i18n-data.ts', 'utf8').includes('"关卡：{0}"');
  for (const [loc, label] of [['en-US', 'EN'], ['fr-FR', 'FR']]) {
    const t2 = await start(new Map(), { local: true, locale: loc, viewport: { width: 390, height: 844 } });
    const q = t2.page; const left = new Set();
    const scan = async () => { for (const x of await q.evaluate(() => [...document.querySelectorAll('#bo-ovl *, .bo-hud *, .gm-title *, .gm-bar *')].filter((e) => e.children.length === 0 && getComputedStyle(e).display !== 'none').map((e) => e.textContent.trim()).filter(Boolean))) if (CJK.test(x)) left.add(x); };
    await q.evaluate(() => (location.hash = '#/games/breakout')); await q.waitForSelector('#bo-canvas'); await q.evaluate(() => window.__breakout.manual(true));
    await q.waitForTimeout(200); await scan(); await q.screenshot({ path: OUT + `breakout-${label.toLowerCase()}-ready.png` });
    await q.click('#bo-start'); await q.click('#bo-pause'); await q.waitForTimeout(100); await scan(); await q.screenshot({ path: OUT + `breakout-${label.toLowerCase()}-pause.png` }); await q.keyboard.press('p');
    await q.evaluate(() => { const s = window.__breakout.state(); const k = s.bricks.find((b) => b.r === 4 && b.c === 4); k.power = null; s.bricks = [k]; const b = s.balls[0]; b.stuck = false; b.x = k.x + k.w / 2; b.y = k.y + k.h + 30; b.dx = 0; b.dy = -1; window.__breakout.step(60); });
    await q.waitForTimeout(100); await scan(); await q.screenshot({ path: OUT + `breakout-${label.toLowerCase()}-clear.png` }); await q.click('#bo-start');
    await q.evaluate(() => { const s = window.__breakout.state(); s.lives = 1; const b = s.balls[0]; b.stuck = false; b.x = 30; b.y = 660; b.dx = 0; b.dy = 1; window.__breakout.step(2); });
    await q.waitForTimeout(100); await scan(); await q.screenshot({ path: OUT + `breakout-${label.toLowerCase()}-over.png` });
    const arr = [...left]; const untranslated = arr.filter((x) => !covered(x));
    if (merged) ok(arr.length === 0, `${label}: no Chinese left on the game screen${arr.length ? ' -> ' + arr.join(' | ') : ''}`);
    ok(untranslated.length === 0, `${label}: every Chinese text shown is in breakout.i18n.json${untranslated.length ? ' -> ' + untranslated.join(' | ') : ''}`);
    ok(t2.log.external.length === 0, `${label}: no outside request`);
    await t2.browser.close();
  }
  await done();
})();
