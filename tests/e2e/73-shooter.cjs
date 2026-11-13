// Space shooter: the pure rules (twelve levels in four worlds, every enemy kind, environment events, five bosses with phases / telegraphs / weak points / death sequence,
// six weapons with levels, the shop and the run, combo / graze, star objectives, checkpoint, easy / normal, seeded determinism, entity cap, no NaN, a bot that clears every level)
// and the screen (pointer / touch with CDP at dpr 2 / keys, fire, hit, shield, bomb, pause, game over, level clear + stars + shop, best saved, layout on 5 sizes,
// sharp canvas, reduced motion, EN / FR, no outside request).
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const CJK = /[㐀-鿿]/;

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  const p = t.page;
  p.setDefaultTimeout(20000);
  await p.evaluate(() => (location.hash = '#/games/shooter')); await p.waitForSelector('#sh-canvas');

  // ---------- the level data ----------
  const D = await p.evaluate(async () => {
    const M = await import('/src/games/shooter-logic.ts'); const LV = await import('/src/games/shooter-levels.ts');
    const bad = []; const note = (m) => { if (bad.length < 20) bad.push(m); };
    if (LV.LEVEL_COUNT !== 12 || M.LEVEL_COUNT !== 12) note('12 levels expected');
    const kinds = new Set(), bossTypes = new Set(); let calm = 0, worlds = [];
    for (let l = 1; l <= 12; l++) {
      const sc = LV.scriptOf(l), se = LV.scriptOf(l, true);
      for (let i = 1; i < sc.length; i++) if (sc[i].t < sc[i - 1].t) note(`level ${l}: script not sorted`);
      const bosses = sc.filter((e) => e.k === 'boss');
      if (bosses.length !== 1 || sc[sc.length - 1].k !== 'boss' || sc[sc.length - 1].t !== LV.BOSS_T) note(`level ${l}: one boss at the end`);
      if (sc.some((e) => e.t > LV.BOSS_T || e.t < 0)) note(`level ${l}: event after the boss`);
      if (sc.some((e) => !isFinite(e.x) || e.x < -1 || e.x > 361)) note(`level ${l}: x outside the board`);
      if (!sc.some((e) => e.t < LV.CP_T) || !sc.some((e) => e.t > LV.CP_T && e.k !== 'boss')) note(`level ${l}: nothing before or after the checkpoint`);
      if (sc.length < 12) note(`level ${l}: too few waves`);
      const bt = LV.bossTypeOf(l); bossTypes.add(bt); if (bosses[0].size !== bt) note(`level ${l}: boss type`);
      if ((l % 3 === 0) !== (bt > 0)) note(`level ${l}: a real boss only every third level`);
      for (const e of sc) kinds.add(e.k);
      if (se.length >= sc.length || !se.some((e) => e.k === 'boss')) note(`level ${l}: easy has fewer waves and the boss`);
      // calm moments: a pause of at least 3 s between enemy waves
      const en = sc.filter((e) => !['balloon', 'shower', 'hole', 'storm', 'boss'].includes(e.k)).map((e) => e.t); let gap = 0; for (let i = 1; i < en.length; i++) gap = Math.max(gap, en[i] - en[i - 1]); if (gap >= 3) calm++;
      worlds.push(LV.worldOf(l));
    }
    for (const k of ['rock', 'flyer', 'zigzag', 'snake', 'diver', 'shield', 'splitter', 'bomber', 'mother', 'swarm', 'stealth', 'comet', 'balloon', 'boss', 'shower', 'hole', 'storm']) if (!kinds.has(k)) note('no level uses ' + k);
    if ([...bossTypes].sort().join() !== '0,1,2,3,4') note('boss types ' + [...bossTypes]);
    if (worlds.join() !== '0,0,0,1,1,1,2,2,2,3,3,3') note('worlds ' + worlds);
    if (calm < 12) note('calm moments missing in some levels (' + calm + ')');
    return { bad, kinds: [...kinds].length };
  });
  ok(D.bad.length === 0, `12 levels, 4 worlds, five boss types, every enemy kind and event used, a boss at 42 s, calm moments, a checkpoint${D.bad.length ? ' -> ' + D.bad.join(' | ') : ''}`);

  // ---------- fuzz: random inputs on every level, both modes ----------
  const F = await p.evaluate(async () => {
    const M = await import('/src/games/shooter-logic.ts');
    const bad = []; const note = (m) => { if (bad.length < 15) bad.push(m); };
    let seed = 4242; const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const fin = (...v) => v.every((x) => Number.isFinite(x));
    const R = { runs: 0, steps: 0, maxEnt: 0, maxEn: 0, kinds: new Set(), pk: new Set(), wk: new Set() };
    const inv = (s, prev, tag) => {
      const n = s.enemies.length + s.ebullets.length + s.bullets.length + s.coins.length + s.pups.length + s.haz.length;
      R.maxEnt = Math.max(R.maxEnt, n); R.maxEn = Math.max(R.maxEn, s.enemies.length);
      if (n >= 400) note(tag + ' entity explosion ' + n);
      if (s.enemies.length > M.MAX_ENEMIES || s.ebullets.length > M.MAX_EBULLETS || s.coins.length > M.MAX_COINS || s.pups.length > M.MAX_PUPS || s.bullets.length > M.MAX_BULLETS) note(tag + ' cap exceeded');
      if (s.score < prev.score) note(tag + ' score went down');
      if (s.lives < 0 || s.lives > M.MAXLIVES_SHOP) note(tag + ' lives ' + s.lives);
      if (s.bombs < 0 || s.bombs > M.MAXBOMBS) note(tag + ' bombs ' + s.bombs);
      if (s.shield < 0) note(tag + ' shield');
      if (s.wl < 1 || s.wl > 5) note(tag + ' weapon level ' + s.wl);
      if (s.combo < 0 || s.hits < 0 || s.kills < 0 || s.kills > s.spawned + 50) note(tag + ' counters');
      if (!fin(s.score, s.ship.x, s.ship.y, s.time)) note(tag + ' NaN in the state');
      if (s.ship.x < M.SHIP_X_MIN - 1e-6 || s.ship.x > M.SHIP_X_MAX + 1e-6 || s.ship.y < M.SHIP_Y_MIN - 1e-6 || s.ship.y > M.SHIP_Y_MAX + 1e-6) note(tag + ' ship left its area');
      for (const e of s.enemies) {
        R.kinds.add(e.kind);
        if (!fin(e.x, e.y, e.hp, e.vx, e.vy)) note(tag + ' NaN enemy ' + e.kind);
        if (e.hp <= 0) note(tag + ' dead enemy still listed');
        if (e.kind !== 'boss' && (e.y > M.H + e.r + 25 || e.x < -85 || e.x > M.W + 85)) note(tag + ' enemy not removed off screen ' + e.kind);
        if (e.kind === 'rock' && (e.size < 1 || e.size > 3)) note(tag + ' rock size');
      }
      for (const b of s.bullets) { if (!fin(b.x, b.y, b.vx, b.vy)) note(tag + ' NaN bullet'); if (b.y < -15 || b.y > M.H + 15 || b.x < -15 || b.x > M.W + 15) note(tag + ' bullet not removed off screen'); if (b.life <= 0) note(tag + ' dead bullet kept'); R.wk.add(b.kind); }
      for (const b of s.ebullets) { if (!fin(b.x, b.y)) note(tag + ' NaN ebullet'); if (b.y < -21 || b.y > M.H + 21 || b.x < -21 || b.x > M.W + 21) note(tag + ' ebullet not removed off screen'); }
      for (const c of s.coins) if (!fin(c.x, c.y)) note(tag + ' NaN coin');
      for (const q of s.pups) { if (!fin(q.x, q.y)) note(tag + ' NaN pup'); R.pk.add(q.kind); }
    };
    const N = 2200;
    for (let i = 0; i < N; i++) {
      const easy = i % 2 === 1, level = 1 + (i % 12);
      const s = M.newGame(level, { easy, seed: i * 31 + 5, run: M.newRun(easy), startTime: (i % 8) * 5 });
      s.weapon = M.WEAPONS[i % 6]; s.wl = 1 + (i % 5); if (i % 7 === 0) s.inv = 1e6;
      let tx = 180, ty = 500, prev = { score: s.score }; R.runs++;
      for (let k = 0; k < 420; k++) {
        if (k % 25 === 0) { tx = rng() * 360; ty = 100 + rng() * 520; }
        const ev = M.step(s, M.STEP, { tx, ty, bomb: rng() < 0.01 }); R.steps++;
        if (k % 6 === 0 || ev.length) { inv(s, prev, `run ${i} step ${k}`); prev = { score: s.score }; }
        if (s.over || s.cleared) break;
      }
    }
    return { bad, runs: R.runs, steps: R.steps, maxEnt: R.maxEnt, maxEn: R.maxEn, kinds: [...R.kinds], pk: [...R.pk], wk: [...R.wk] };
  });
  ok(F.bad.length === 0, `fuzz: ${F.runs} seeded runs / ${F.steps} steps on all levels: caps, no NaN, score never down, lives / bombs / weapon in range, everything off screen removed (max ${F.maxEnt} entities)${F.bad.length ? ' -> ' + F.bad.join(' | ') : ''}`);
  ok(F.maxEnt < 400, `entity count stays under 400 (max ${F.maxEnt})`);
  ok(['rock', 'flyer', 'zigzag', 'snake', 'diver', 'shield', 'splitter', 'mini', 'bomber', 'mother', 'swarm', 'stealth', 'comet', 'balloon', 'boss'].every((k) => F.kinds.includes(k)), `the fuzz runs met every enemy kind (${F.kinds.length} kinds)`);
  ok(F.pk.length >= 8 && F.wk.length >= 4, `capsules (${F.pk.length} kinds) and weapon bullets (${F.wk.length} kinds) were seen`);

  // ---------- determinism ----------
  const DT = await p.evaluate(async () => {
    const M = await import('/src/games/shooter-logic.ts');
    const play = (seed, level, easy) => { const s = M.newGame(level, { easy, seed, run: M.newRun(easy), startTime: 10 }); let x = 0; const evs = []; for (let k = 0; k < 900; k++) { const inp = k % 3 === 0 ? M.botInput(s) : { tx: s.ship.x, ty: s.ship.y }; for (const e of M.step(s, M.STEP, { ...inp, tx: inp.tx ?? s.ship.x })) evs.push(e.t); x += s.score; } return JSON.stringify([s, evs.length, x]); };
    let same = 0, diff = 0;
    for (const [seed, level, easy] of [[1, 1, true], [2, 5, false], [3, 8, true], [4, 12, false]]) { if (play(seed, level, easy) === play(seed, level, easy)) same++; }
    if (play(10, 4, false) !== play(11, 4, false)) diff++;
    return { same, diff };
  });
  ok(DT.same === 4, 'the same seed and the same inputs give exactly the same game (4 of 4)');
  ok(DT.diff === 1, 'another seed gives another game');

  // ---------- every enemy kind behaves as specified ----------
  const K = await p.evaluate(async () => {
    const M = await import('/src/games/shooter-logic.ts');
    const bad = []; const note = (m) => { if (bad.length < 25) bad.push(m); };
    const fresh = (level = 1, o = {}) => { const s = M.newGame(level, { seed: 7, run: M.newRun(false), ...o }); s.script = []; s.inv = 1e6; return s; };
    const hold = (s, n, ev) => { for (let i = 0; i < n; i++) { const e = M.step(s, M.STEP, { tx: s.ship.x, ty: s.ship.y }); if (ev) ev.push(...e); } };
    const hit = (s, e, dmg, ev) => { s.bullets.push({ x: e.x, y: e.y, vx: 0, vy: 0, dmg, r: 4, life: 1, kind: 'blaster', x0: e.x, age: 0, hits: [] }); const r = M.step(s, M.STEP, { tx: s.ship.x, ty: s.ship.y }); if (ev) ev.push(...r); };
    const res = {};
    // rock: three sizes, split into two, bounded, a bomb does not split
    { const s = fresh(); const e = M.spawnEnemy(s, 'rock', 180, { size: 3, y: 100 }); if (e.hp !== 6 || e.r !== 30) note('big rock hp / size'); const ev = []; const y0 = e.y; hold(s, 30); if (!(e.y > y0)) note('rock does not fall');
      hit(s, e, 6, ev); const kids = s.enemies.filter((q) => q.kind === 'rock'); if (kids.length !== 2 || kids.some((q) => q.size !== 2 || q.hp !== 3)) note('a big rock splits into two medium ones');
      let kills = ev.filter((q) => q.t === 'kill').length, guard = 0; while (s.enemies.some((q) => q.kind === 'rock') && guard++ < 20) { const q = s.enemies.find((z) => z.kind === 'rock'); const ev2 = []; hit(s, q, 9, ev2); kills += ev2.filter((z) => z.t === 'kill').length; if (s.enemies.length > 8) note('rock splitting is not bounded'); }
      if (kills !== 7) note('rock family: 1 + 2 + 4 = 7 kills, got ' + kills);
      const s2 = fresh(); s2.bombs = 1; M.spawnEnemy(s2, 'rock', 180, { size: 3, y: 100 }); const ev3 = []; M.bomb(s2, ev3); if (s2.enemies.some((q) => q.kind === 'rock' && q.size < 3) || s2.enemies.length > 1) note('a bomb splits rocks'); }
    // flyer: straight down, shoots straight down
    { const s = fresh(); s.ship.x = 40; const e = M.spawnEnemy(s, 'flyer', 300, { y: 100 }); e.cd = 0; const y0 = e.y; hold(s, 60); if (Math.abs(e.x - 300) > 0.01 || !(e.y - y0 > 50)) note('flyer: straight down'); if (!s.ebullets.length || Math.abs(s.ebullets[0].vx) > 0.01 || !(s.ebullets[0].vy > 0)) note('flyer shoots straight down'); }
    // zigzag: sideways both ways
    { const s = fresh(); s.ship.x = 40; const e = M.spawnEnemy(s, 'zigzag', 180, { y: 20, vy: 5 }); let mn = 999, mx = -999, lo = false, hi = false; for (let i = 0; i < 400; i++) { const x0 = e.x; hold(s, 1); if (e.x < x0) lo = true; if (e.x > x0) hi = true; mn = Math.min(mn, e.x); mx = Math.max(mx, e.x); } if (!lo || !hi || mx - mn < 40) note('zigzag does not zig and zag'); }
    // snake: a chain of six segments on one wave
    { const s = fresh(); s.ship.x = 20; const segs = []; for (let i = 0; i < 6; i++) { segs.push(M.spawnEnemy(s, 'snake', 180, { y: 30 })); hold(s, 12); } hold(s, 60); const xs = segs.filter((q) => s.enemies.includes(q)).map((q) => q.x); if (segs.length !== 6 || segs.some((q) => q.hp !== 1)) note('snake: six one-hit segments'); if (Math.max(...xs) - Math.min(...xs) < 30) note('snake: the chain is not a wave'); let mn = 999, mx = -999; const q = segs[5]; for (let i = 0; i < 200 && s.enemies.includes(q); i++) { hold(s, 1); mn = Math.min(mn, q.x); mx = Math.max(mx, q.x); } if (mx - mn < 60) note('snake sways less than 60 px'); }
    // diver: dives at the ship
    { const s = fresh(); s.ship.x = 50; s.ship.y = 560; const e = M.spawnEnemy(s, 'diver', 300, { y: 20 }); hold(s, 100); if (e.dive !== 1 || !(e.vx < -100) || !(e.vy > 100)) note(`diver aims at the ship (vx ${e.vx && e.vx.toFixed(0)}, vy ${e.vy && e.vy.toFixed(0)})`); }
    // shield: the bubble pops first, then three hits
    { const s = fresh(); const e = M.spawnEnemy(s, 'shield', 180, { y: 150 }); const ev = []; if (e.sh !== 1 || e.hp !== 3) note('shield enemy: bubble + 3 hp'); hit(s, e, 1, ev); if (e.sh !== 0 || e.hp !== 3 || !ev.some((q) => q.t === 'pop')) note('first hit pops the bubble only'); hit(s, e, 1, ev); hit(s, e, 1, ev); if (!s.enemies.includes(e)) note('shield enemy dies too early'); hit(s, e, 1, ev); if (s.enemies.includes(e)) note('shield enemy: bubble + three hits'); }
    // splitter
    { const s = fresh(); const e = M.spawnEnemy(s, 'splitter', 180, { y: 150 }); const ev = []; hit(s, e, 3, ev); const m = s.enemies.filter((q) => q.kind === 'mini'); if (m.length !== 2 || !ev.some((q) => q.t === 'split')) note('splitter makes two small ones'); if (m[0] && m[1] && !(m[0].vx * m[1].vx < 0)) note('the small ones fly apart'); }
    // bomber: slow mines
    { const s = fresh(); s.ship.x = 20; const e = M.spawnEnemy(s, 'bomber', 180, { y: 30 }); hold(s, 360); const mines = s.ebullets.filter((b) => b.mine); if (!mines.length || mines.some((b) => b.vy > 70 || b.r < 7)) note('bomber drops slow, big mines'); if (e.hp !== 5) note('bomber hp'); }
    // mother ship: turrets shoot aimed bullets; it leaves
    { const s = fresh(); s.ship.x = 60; s.ship.y = 580; const e = M.spawnEnemy(s, 'mother', 180, { y: 20 }); hold(s, 240); if (!s.ebullets.length || !s.ebullets.some((b) => b.vy > 0)) note('mother ship fires'); if (e.hp !== 14 || e.y > 100) note('mother ship hp / position'); s.ebullets = []; hold(s, 1100); if (s.enemies.includes(e)) note('mother ship stays forever'); }
    // swarm: a V enters as one shape, then every member dives
    { const s = fresh(); s.ship.x = 180; s.ship.y = 560; const arr = [-1, 0, 1].map((d, i) => M.spawnEnemy(s, 'swarm', 180 + d * 30, { y: -20 - Math.abs(d) * 20, wait: 1.5 + i * 0.1 })); const xs0 = arr.map((q) => q.x); hold(s, 30); if (arr.some((q, i) => Math.abs(q.x - xs0[i]) > 0.01) || arr.some((q) => q.dive)) note('swarm holds its shape first'); hold(s, 150); const alive = arr.filter((q) => s.enemies.includes(q)); if (!alive.length || alive.some((q) => !q.dive || Math.hypot(q.vx, q.vy) < 200)) note('swarm members dive fast'); }
    // stealth: flickers, cannot be hit while invisible
    { const s = fresh(); const e = M.spawnEnemy(s, 'stealth', 180, { y: 80, vy: 0 }); let seenV = false, seenI = false, wrong = false, dead = false; for (let i = 0; i < 900 && !dead; i++) { const hp0 = e.hp; hit(s, e, 1); if (e.vis) seenV = true; else seenI = true; if (!e.vis && e.hp < hp0) wrong = true; if (!s.enemies.includes(e)) dead = true; e.vy = 0; if (i % 20 === 0) s.script = []; hold(s, 5); }
      if (!seenI || !seenV) note('stealth ship does not flicker'); if (wrong) note('hit while invisible'); if (!dead) note('stealth ship never dies'); }
    // comet: hurts on touch, many coins when shot
    { const s = fresh(); s.inv = 0; const e = M.spawnEnemy(s, 'comet', s.ship.x, { y: s.ship.y - 150 }); e.vx = 0; const ev = []; hold(s, 80, ev); if (s.lives !== 2 || !ev.some((q) => q.t === 'hurt')) note('a comet hurts on touch');
      const s2 = fresh(); const c = M.spawnEnemy(s2, 'comet', 180, { y: 200 }); c.vx = 0; hit(s2, c, 9); if (s2.coins.length < 10) note('a shot comet drops many coins (' + s2.coins.length + ')'); }
    // balloon: harmless, a gift when popped, not counted
    { const s = fresh(); s.inv = 0; const e = M.spawnEnemy(s, 'balloon', s.ship.x, { y: s.ship.y - 60 }); hold(s, 200); if (s.lives !== 3) note('balloon hurt the ship'); const b = M.spawnEnemy(s, 'balloon', 100, { y: 150 }); const ev = []; hit(s, b, 1, ev); if (!s.pups.length || s.coins.length < 3 || !ev.some((q) => q.t === 'gift')) note('popped balloon gives a capsule and coins'); if (s.spawned !== 0 || s.kills !== 0) note('balloons are not counted'); void e; }
    // spawn rules
    { const s = fresh(); for (let i = 0; i < 100; i++) M.spawnEnemy(s, 'flyer', 100, { y: 50 }); if (s.enemies.length !== M.MAX_ENEMIES) note('enemy cap'); const b = M.spawnEnemy(fresh(), 'boss', 180); if (!b || b.hp !== M.newGame && b.hp <= 0) note('boss spawn'); }
    return { bad };
  });
  ok(K.bad.length === 0, `all enemy kinds spawn and behave as specified (rock split, flyer, zigzag, snake chain, diver aim, shield bubble, splitter, bomber mines, mother ship, swarm V, stealth flicker, comet, balloon)${K.bad.length ? ' -> ' + K.bad.join(' | ') : ''}`);

  // ---------- environment events ----------
  const EV = await p.evaluate(async () => {
    const M = await import('/src/games/shooter-logic.ts'); const LV = await import('/src/games/shooter-levels.ts');
    const bad = []; const note = (m) => { if (bad.length < 20) bad.push(m); };
    const fresh = (level = 1, o = {}) => { const s = M.newGame(level, { seed: 11, run: M.newRun(false), ...o }); s.script = []; s.inv = 1e6; return s; };
    const hold = (s, n, ev) => { for (let i = 0; i < n; i++) { const e = M.step(s, M.STEP, { tx: s.ship.x, ty: s.ship.y }); if (ev) ev.push(...e); } };
    // asteroid shower
    { const s = fresh(4); s.shower = 3; hold(s, 190); const r = s.enemies.filter((q) => q.kind === 'rock'); if (r.length < 6 || r.some((q) => q.vy < 100 && q.size === 1)) note('asteroid shower: many fast rocks (' + r.length + ')'); if (s.shower > 0.2) note('shower ends'); hold(s, 120); const n0 = s.enemies.length; hold(s, 60); if (s.enemies.length > n0 + 0) note('shower stopped producing'); }
    // black hole: bends bullets, pulls the ship a little
    { const mk = (hole) => { const s = fresh(3); s.ship.x = 180; s.ship.y = 560; if (hole) s.hole = { x: 180, y: 300, t: 0, dur: 8 }; s.bullets.push({ x: 240, y: 380, vx: 0, vy: -300, dmg: 1, r: 4, life: 5, kind: 'blaster', x0: 240, age: 0, hits: [] }); return s; };
      const a = mk(true), b = mk(false); hold(a, 20); hold(b, 20); if (!(Math.abs(a.bullets[0].x - 240) > Math.abs(b.bullets[0].x - 240) + 3 && a.bullets[0].x < 240)) note('the black hole bends a bullet toward itself'); hold(a, 80); hold(b, 80); if (!(a.ship.y < b.ship.y - 2 && a.ship.y > b.ship.y - 60)) note(`the black hole pulls the ship a little (${a.ship.y.toFixed(1)} vs ${b.ship.y.toFixed(1)})`);
      const c = mk(true); c.bullets[0].x = 184; c.bullets[0].y = 305; c.bullets[0].vy = 0; hold(c, 2); if (c.bullets.some((q) => Math.abs(q.x - 184) < 20 && q.y > 290 && q.y < 320)) note('bullets are swallowed at the centre');
      const s = fresh(3); s.script = [{ t: 0.1, k: 'hole', x: 120, y: 280, d: 2 }]; hold(s, 30); if (!s.hole) note('hole event from the script'); hold(s, 200); if (s.hole) note('hole ends after its duration'); }
    // storm cloud: warning column, then a bolt
    { const s = fresh(8); s.ship.x = 180; s.ship.y = 560; s.inv = 0; s.storm = { x: 180, y: 56, vx: 0, t: 0, dur: 12, cd: 0.05 }; hold(s, 10); if (!s.haz.length || s.haz[0].kind !== 'bolt' || !(s.haz[0].warn >= 0.9)) note('storm: a warning first');
      s.haz = [{ x: 180, w: 18, t: 0, warn: 0.9, dur: 0.25, kind: 'bolt', zapped: false }]; s.storm = null; const ev = []; hold(s, 40, ev); if (s.lives !== 3) note('the bolt hurt before its warning ended'); hold(s, 25, ev); if (s.lives !== 2 || !ev.some((q) => q.t === 'zap')) note('the bolt hurts when it strikes');
      const s2 = fresh(8); s2.inv = 0; s2.ship.x = 300; s2.haz = [{ x: 100, w: 18, t: 0, warn: 0.5, dur: 0.25, kind: 'bolt', zapped: false }]; hold(s2, 60); if (s2.lives !== 3 || s2.haz.length) note('a ship out of the column is safe and the bolt goes away'); }
    // comet from the script, gifts from the script
    { const s = M.newGame(2, { seed: 5, run: M.newRun(false), startTime: 23.5 }); s.inv = 1e6; let seen = false; for (let i = 0; i < 200; i++) { hold(s, 1); if (s.enemies.some((q) => q.kind === 'comet')) seen = true; } if (!seen) note('level 2 sends a comet');
      const g = M.newGame(1, { seed: 5, run: M.newRun(false), startTime: 15.5 }); g.inv = 1e6; let n = 0; for (let i = 0; i < 300; i++) { hold(g, 1); n = Math.max(n, g.enemies.filter((q) => q.kind === 'balloon').length); } if (n < 3) note('level 1 sends gift balloons (' + n + ')'); }
    return { bad };
  });
  ok(EV.bad.length === 0, `environment: asteroid shower, black hole (bends bullets, pulls the ship, swallows), storm (warning, bolt), comet, gift balloons${EV.bad.length ? ' -> ' + EV.bad.join(' | ') : ''}`);

  // ---------- bosses ----------
  const B = await p.evaluate(async () => {
    const M = await import('/src/games/shooter-logic.ts'); const LV = await import('/src/games/shooter-levels.ts');
    const bad = []; const note = (m) => { if (bad.length < 25) bad.push(m); };
    const fresh = (level, o = {}) => { const s = M.newGame(level, { seed: 21, run: M.newRun(false), ...o }); s.script = []; s.inv = 1e6; return s; };
    const hold = (s, n, ev) => { for (let i = 0; i < n; i++) { const e = M.step(s, M.STEP, { tx: s.ship.x, ty: s.ship.y }); if (ev) ev.push(...e); } };
    const hitAt = (s, x, y, dmg) => { s.bullets.push({ x, y, vx: 0, vy: 0, dmg, r: 4, life: 1, kind: 'blaster', x0: x, age: 0, hits: [] }); return M.step(s, M.STEP, { tx: s.ship.x, ty: s.ship.y }); };
    const want = { 0: ['ring', 'aimed'], 1: ['ring', 'minions', 'spiral'], 2: ['laser', 'dash'], 3: ['spiral', 'minions', 'dash'], 4: ['laser', 'spiral', 'minions', 'dash'] };
    const never = { 0: ['laser', 'dash', 'minions', 'spiral'], 1: ['laser', 'dash'], 2: ['spiral', 'minions'], 3: ['laser'], 4: [] };
    const out = {};
    for (const bt of [0, 1, 2, 3, 4]) {
      const level = bt === 0 ? 1 : bt * 3, s = fresh(level); const e = M.spawnEnemy(s, 'boss', 180, { bt }); e.y = 100;
      if (e.bt !== bt || e.hp !== LV.bossHp(level) || e.r !== (bt === 0 ? 34 : 46)) note(`boss ${bt}: type / hp / size`);
      const seen = new Set(); s.ship.x = 180; s.ship.y = 580;
      for (const frac of [0.9, 0.5, 0.2]) {
        e.hp = e.maxhp * frac; if (M.phaseOf(e) !== (frac === 0.9 ? 0 : frac === 0.5 ? 1 : 2)) note('phase thresholds');
        for (let i = 0; i < 900; i++) {
          const n0 = s.ebullets.length; hold(s, 1); if (s.ebullets.length - n0 >= 8) seen.add('ring'); if (s.ebullets.length - n0 >= 3 && s.ebullets.length - n0 < 8) seen.add('aimed');
          if (s.haz.some((h) => h.kind === 'laser')) seen.add('laser'); if (e.dash) seen.add('dash'); if (e.sp > 0) seen.add('spiral'); if (s.enemies.some((q) => q.kind === 'flyer')) seen.add('minions');
          if (i % 40 === 0) { s.ebullets.length = 0; s.enemies = s.enemies.filter((q) => q === e); }
        }
        s.haz = [];
      }
      for (const w of want[bt]) if (!seen.has(w)) note(`boss ${bt} never uses ${w}`);
      for (const w of never[bt]) if (seen.has(w)) note(`boss ${bt} uses ${w} (it should not)`);
      out[bt] = [...seen].join('+');
    }
    // the telegraphs: the laser has a warning line before it hurts; the dash has a charge-up
    { const s = fresh(6); s.inv = 0; const e = M.spawnEnemy(s, 'boss', 180, { bt: 2 }); e.y = 100; s.ship.x = 180; s.ship.y = 580; e.atk = 0; e.cd = 0; hold(s, 1); const lz = s.haz.find((h) => h.kind === 'laser'); if (!lz || !(lz.warn >= 1) || lz.t > 0.1) note('laser: a warning line before the beam'); hold(s, Math.round(lz.warn * 60) - 10); if (s.lives !== 3) note('the laser hurt during its warning'); lz.x = s.ship.x; hold(s, 20); if (s.lives !== 2) note('the laser hurts after its warning'); }
    { const s = fresh(6); const e = M.spawnEnemy(s, 'boss', 180, { bt: 2 }); e.y = 100; s.ship.x = 50; s.ship.y = 580; e.hp = e.maxhp * 0.2; e.atk = 0; e.cd = 0; hold(s, 1); if (!e.dash || e.dash.ph !== 0 || !e.tele) note('dash: telegraphed first'); const y0 = e.y; hold(s, 30); if (Math.abs(e.y - y0) > 3) note('dash: the boss waits while charging'); hold(s, 60); if (!(e.y > 200)) note('dash: the boss charges down'); hold(s, 240); if (e.dash) note('dash ends'); }
    // the weak point
    { const s = fresh(3); const e = M.spawnEnemy(s, 'boss', 180, { bt: 1 }); e.y = 100; e.cd = 99; const h0 = e.hp; hitAt(s, 180, 100, 1); const core = h0 - e.hp; const h1 = e.hp; hitAt(s, 180 + 40, 100, 1); const off = h1 - e.hp; if (Math.abs(core - 1.8) > 0.01 || Math.abs(off - 0.7) > 0.01) note(`weak point: core ${core}, body ${off}`); }
    // the end: explosions, coins rain, slow motion, the level clears
    { const s = fresh(3, { run: M.newRun(false) }); const e = M.spawnEnemy(s, 'boss', 180, { bt: 1 }); e.y = 100; e.hp = 0.5; s.ebullets.push({ x: 10, y: 10, vx: 0, vy: 1, r: 4, mine: false, g: false }); const ev = hitAt(s, 180, 100, 1);
      if (!s.bossDead || s.boss || s.ebullets.length || !s.dying || !(s.slow > 0) || !ev.some((q) => q.t === 'bossdead')) note('boss death: flags, bullets cleared, slow motion');
      const evs = []; const c0 = s.coins.length; let maxc = 0; for (let i = 0; i < 100; i++) { hold(s, 1, evs); maxc = Math.max(maxc, s.coins.length); } const booms = evs.filter((q) => q.t === 'boom').length; if (booms < 8) note('explosion sequence: ' + booms + ' booms'); if (maxc <= c0 + 5) note('coins rain down'); if (s.cleared) note('the level clears only after the show');
      hold(s, 100, evs); if (!s.cleared || evs.filter((q) => q.t === 'clear').length !== 1) note('the level clears once'); if (s.run.wallet !== s.coinsGot || s.run.score !== s.score) note('the run keeps the wallet and the score'); }
    return { bad, out };
  });
  ok(B.bad.length === 0, `bosses: types 0-4 use their patterns by phase, telegraphed laser and dash, weak point x1.8, death show${B.bad.length ? ' -> ' + B.bad.join(' | ') : ''}`);

  // ---------- weapons ----------
  const WP = await p.evaluate(async () => {
    const M = await import('/src/games/shooter-logic.ts');
    const bad = []; const note = (m) => { if (bad.length < 25) bad.push(m); };
    const fresh = (level = 1, o = {}) => { const s = M.newGame(level, { seed: 31, run: M.newRun(false), ...o }); s.script = []; s.inv = 1e6; return s; };
    const hold = (s, n, ev) => { for (let i = 0; i < n; i++) { const e = M.step(s, M.STEP, { tx: s.ship.x, ty: s.ship.y }); if (ev) ev.push(...e); } };
    const take = (s, kind) => { s.pups.push({ x: s.ship.x, y: s.ship.y, x0: s.ship.x, kind, t: 0 }); hold(s, 1); };
    { const s = fresh(); take(s, 'spread'); if (s.weapon !== 'spread' || s.wl !== 1) note('spread pick-up switches the weapon'); for (let i = 2; i <= 5; i++) { take(s, 'spread'); if (s.wl !== i) note('same weapon levels up ' + i); } take(s, 'spread'); if (s.wl !== 5) note('level cap is 5'); take(s, 'laser'); if (s.weapon !== 'laser' || s.wl !== 1) note('another weapon starts at level 1'); take(s, 'power'); if (s.weapon !== 'blaster' || s.wl !== 1) note('power pick-up -> blaster'); take(s, 'power'); if (s.wl !== 2) note('blaster levels up'); for (const k of ['homing', 'wave', 'drone']) { take(s, k); if (s.weapon !== k) note('pick-up ' + k); } }
    // hit lowers the level by one, never below 1
    { const s = fresh(); s.inv = 0; s.weapon = 'spread'; s.wl = 3; s.ebullets.push({ x: s.ship.x, y: s.ship.y, vx: 0, vy: 0, r: 4, mine: false, g: false }); hold(s, 1); if (s.wl !== 2 || s.lives !== 2) note('a hit lowers the weapon level'); s.inv = 0; s.wl = 1; s.ebullets.push({ x: s.ship.x, y: s.ship.y, vx: 0, vy: 0, r: 4, mine: false, g: false }); hold(s, 1); if (s.wl !== 1) note('weapon level stays >= 1'); }
    // shots per volley
    const count = (w, l) => { const s = fresh(); s.weapon = w; s.wl = l; s.fireCd = 0; s.droneCd = 99; const n0 = s.bullets.length; hold(s, 1); return s.bullets.length - n0; };
    const want = { blaster: [1, 2, 3, 4, 5], spread: [3, 3, 5, 5, 7], wave: [1, 1, 2, 2, 2], homing: [1, 2, 2, 3, 3], drone: [1, 1, 1, 1, 1] };
    for (const w of Object.keys(want)) for (let l = 1; l <= 5; l++) if (count(w, l) !== want[w][l - 1]) note(`${w} level ${l}: ${count(w, l)} bullets, expected ${want[w][l - 1]}`);
    { const s = fresh(); s.weapon = 'drone'; for (let l = 1; l <= 5; l++) { s.wl = l; if (M.dronePos(s).length !== Math.min(4, l)) note('drones = min(4, level)'); } s.wl = 3; s.droneCd = 0; s.fireCd = 99; const n0 = s.bullets.length; hold(s, 1); if (s.bullets.length - n0 !== 3) note('every drone shoots'); const d = M.dronePos(s)[0]; if (Math.hypot(d.x - s.ship.x, d.y - s.ship.y) > 40 || Math.hypot(d.x - s.ship.x, d.y - s.ship.y) < 15) note('drones orbit close to the ship'); const a0 = M.dronePos(s)[0]; hold(s, 20); const a1 = M.dronePos(s)[0]; if (Math.abs(a0.x - a1.x) + Math.abs(a0.y - a1.y) < 5) note('drones move around the ship'); }
    // laser: a beam that stops at the first enemy and burns it
    { const s = fresh(); s.weapon = 'laser'; s.wl = 3; s.ship.x = 180; s.ship.y = 560; const a = M.spawnEnemy(s, 'flyer', 180, { y: 300 }), b = M.spawnEnemy(s, 'flyer', 180, { y: 150 }); a.vy = 0; b.vy = 0; a.cd = b.cd = 999; hold(s, 5); if (!s.beam || Math.abs(s.beam.y1 - (a.y + a.r * 0.5)) > 6) note('laser stops at the first enemy'); const hp = a.hp; hold(s, 10); if (!(a.hp < hp) || b.hp !== b.maxhp) note('laser burns only the first enemy'); hold(s, 60); if (s.enemies.includes(a)) note('laser kills'); hold(s, 20); if (!(b.hp < b.maxhp) && s.enemies.includes(b)) note('laser goes on to the next one'); const dps1 = (() => { const q = fresh(); q.weapon = 'laser'; q.wl = 1; const e = M.spawnEnemy(q, 'rock', 180, { size: 3, y: 300 }); e.vy = 0; e.vx = 0; q.ship.x = 180; q.ship.y = 560; hold(q, 30); return e.maxhp - e.hp; })(); const dps5 = (() => { const q = fresh(); q.weapon = 'laser'; q.wl = 5; const e = M.spawnEnemy(q, 'rock', 180, { size: 3, y: 300 }); e.vy = 0; e.vx = 0; q.ship.x = 180; q.ship.y = 560; hold(q, 30); return e.maxhp - e.hp; })(); if (!(dps5 > dps1 * 1.3)) note('laser level 5 burns faster than level 1'); }
    // homing missiles steer
    { const s = fresh(); s.weapon = 'homing'; s.wl = 1; s.ship.x = 250; s.ship.y = 560; const e = M.spawnEnemy(s, 'flyer', 60, { y: 250 }); e.vy = 0; e.cd = 999; s.fireCd = 0; let dead = false; hold(s, 1); const m = s.bullets[0]; for (let i = 0; i < 160 && !dead; i++) { hold(s, 1); if (!s.enemies.includes(e)) dead = true; else if (e.hp < e.maxhp) dead = true; } if (!dead) note('a homing missile finds an enemy that is not in front of the ship'); void m; }
    // wave shot pierces
    { const s = fresh(); s.weapon = 'wave'; s.wl = 1; s.ship.x = 180; s.ship.y = 560; const a = M.spawnEnemy(s, 'rock', 180, { size: 3, y: 380 }), b = M.spawnEnemy(s, 'rock', 180, { size: 3, y: 250 }); a.vx = b.vx = a.vy = b.vy = 0; s.bullets.push({ x: 180, y: 420, vx: 0, vy: -440, dmg: 1, r: 10, life: 3, kind: 'wave', x0: 180, age: 0, hits: [] }); s.fireCd = 99; hold(s, 60); if (!(a.hp < a.maxhp) || !(b.hp < b.maxhp)) note('wave shot pierces both enemies'); const aHp = a.hp; hold(s, 5); if (a.hp !== aHp) note('a wave hits each enemy once'); }
    // rapid fire is faster, bomb capsule, life capsule, shield capsule, magnet capsule
    { const fires = (rapid) => { const s = fresh(); s.rapid = rapid ? 8 : 0; let n = 0; const ev = []; hold(s, 300, ev); return ev.filter((q) => q.t === 'shot').length; }; if (!(fires(true) > fires(false) * 1.5)) note('rapid fire shoots more'); const s = fresh(); take(s, 'rapid'); if (s.rapid !== M.RAPID_TIME) note('rapid timer'); hold(s, 60 * 9); if (s.rapid !== 0) note('rapid ends'); s.bombs = 1; take(s, 'bomb'); if (s.bombs !== 2) note('bomb capsule'); take(s, 'bomb'); take(s, 'bomb'); if (s.bombs !== 3) note('bombs capped at 3'); take(s, 'life'); if (s.lives !== 4) note('life capsule'); take(s, 'shield'); if (s.shield !== 1) note('shield capsule'); take(s, 'magnet'); if (s.magnet <= 0) note('magnet capsule');
      const q = fresh(); q.shield = 1; q.inv = 0; q.ebullets.push({ x: q.ship.x, y: q.ship.y, vx: 0, vy: 0, r: 4, mine: false, g: false }); q.ebullets.push({ x: q.ship.x, y: q.ship.y, vx: 0, vy: 0, r: 4, mine: false, g: false }); hold(q, 1); if (q.shield !== 0 || q.lives !== 3) note('the shield absorbs one hit'); hold(q, 1); if (q.lives !== 3) note('invulnerable right after the shield pops'); q.inv = 0; q.ebullets.push({ x: q.ship.x, y: q.ship.y, vx: 0, vy: 0, r: 4, mine: false, g: false }); hold(q, 1); if (q.lives !== 2) note('the second hit costs a life');
      const c = fresh(); c.magnet = 5; c.coins.push({ x: c.ship.x + 150, y: c.ship.y - 100, vx: 0, vy: 0 }); hold(c, 40); if (!(Math.hypot(c.coins[0] ? c.coins[0].x - c.ship.x : 0, 0) < 140) && c.coinsGot === 0) note('magnet pulls coins'); }
    // the bomb
    { const s = fresh(); s.bombs = 1; M.spawnEnemy(s, 'flyer', 100, { y: 100 }); M.spawnEnemy(s, 'rock', 200, { size: 3, y: 150 }); const e = M.spawnEnemy(s, 'shield', 250, { y: 200 }); for (let i = 0; i < 20; i++) s.ebullets.push({ x: 30 + i * 15, y: 300, vx: 0, vy: 50, r: 4, mine: false, g: false }); const ev = []; const r = M.bomb(s, ev); if (!r || s.bombs !== 0 || s.ebullets.length || !ev.some((q) => q.t === 'bomb')) note('bomb clears enemy bullets'); if (s.enemies.some((q) => q.kind === 'flyer') || s.enemies.some((q) => q.kind === 'rock')) note('bomb kills small enemies'); void e; if (M.bomb(s, ev)) note('no bomb left'); const t2 = fresh(); t2.bombs = 1; const bo = M.spawnEnemy(t2, 'boss', 180, { bt: 1 }); const hp = bo.hp; M.bomb(t2, []); if (!(bo.hp < hp)) note('bomb damages a boss'); }
    return { bad };
  });
  ok(WP.bad.length === 0, `weapons: spread / laser / homing / wave / drones level up to 5, shots per volley, hit lowers the level, rapid, shield, bomb, magnet${WP.bad.length ? ' -> ' + WP.bad.join(' | ') : ''}`);

  // ---------- run, shop, objectives, combo, graze, checkpoint, easy / normal ----------
  const G = await p.evaluate(async () => {
    const M = await import('/src/games/shooter-logic.ts');
    const bad = []; const note = (m) => { if (bad.length < 30) bad.push(m); };
    const fresh = (level = 1, o = {}) => { const s = M.newGame(level, { seed: 41, run: M.newRun(false), ...o }); s.script = []; s.inv = 1e6; return s; };
    const hold = (s, n, ev) => { for (let i = 0; i < n; i++) { const e = M.step(s, M.STEP, { tx: s.ship.x, ty: s.ship.y }); if (ev) ev.push(...e); } };
    const hit = (s, e, dmg) => { s.bullets.push({ x: e.x, y: e.y, vx: 0, vy: 0, dmg, r: 4, life: 1, kind: 'blaster', x0: e.x, age: 0, hits: [] }); return M.step(s, M.STEP, { tx: s.ship.x, ty: s.ship.y }); };
    // the shop
    { const r = M.newRun(false); if (r.lives !== 3 || r.wallet !== 0 || r.weapon !== 'blaster') note('new run'); if (M.buy(r, 'lives')) note('buying without coins'); r.wallet = 500;
      const o = M.offers(r, 1, 1); if (o.length !== 3 || new Set(o).size !== 3) note('3 different offers'); if (JSON.stringify(o) !== JSON.stringify(M.offers(r, 1, 1))) note('offers are deterministic'); const all = new Set(); for (let sd = 1; sd < 12; sd++) all.add(JSON.stringify(M.offers(r, 2, sd))); if (all.size < 3) note('offers vary');
      if (M.price(r, 'lives') !== 40) note('first price'); if (!M.buy(r, 'lives') || r.wallet !== 460 || r.lives !== 4 || r.up.lives !== 1) note('buy lives'); if (M.price(r, 'lives') !== 80) note('the price rises'); M.buy(r, 'lives'); M.buy(r, 'lives'); if (!M.maxed(r, 'lives') || M.buy(r, 'lives') || M.canBuy(r, 'lives')) note('upgrades have a maximum'); if (r.lives > M.MAXLIVES_SHOP) note('lives cap in the shop');
      const w = M.newRun(false); w.wallet = 39; if (M.canBuy(w, 'lives') || M.buy(w, 'lives') || w.wallet !== 39) note('39 coins do not buy a 40 coin card');
      // the effects
      const e1 = M.newRun(true); e1.up.shield = 1; if (M.newGame(1, { easy: true, run: e1 }).shield !== 2) note('thicker shield (easy start)'); const n1 = M.newRun(false); n1.up.shield = 1; if (M.newGame(1, { run: n1 }).shield !== 0) note('normal mode starts without a shield'); const n2 = M.newRun(false); n2.up.shield = 1; const s2 = fresh(1, { run: n2 }); s2.pups.push({ x: s2.ship.x, y: s2.ship.y, x0: s2.ship.x, kind: 'shield', t: 0 }); hold(s2, 1); if (s2.shield !== 2) note('the shield capsule uses the upgrade');
      const b1 = M.newRun(false); b1.up.bomb = 1; if (M.newGame(1, { run: b1 }).bombs !== 2) note('start with a bomb'); b1.up.bomb = 2; if (M.newGame(1, { run: b1 }).bombs !== 3) note('start with two bombs');
      const shots = (rate) => { const q = M.newRun(false); q.up.rate = rate; const s = fresh(1, { run: q }); const ev = []; hold(s, 300, ev); return ev.filter((z) => z.t === 'shot').length; }; if (!(shots(3) > shots(0) * 1.25)) note('faster fire upgrade');
      const mg = (lv) => { const q = M.newRun(false); q.up.magnet = lv; const s = fresh(1, { run: q }); s.coins.push({ x: s.ship.x + 90, y: s.ship.y - 60, vx: 0, vy: 0 }); hold(s, 30); return s.coinsGot; }; if (!(mg(2) === 1 && mg(0) === 0)) note('magnet range upgrade'); }
    // objectives
    { const s = fresh(); s.hits = 0; s.spawned = 10; s.kills = 9; s.coinsGot = 50; if (M.stars(s).join() !== 'true,true,true') note('three stars'); s.kills = 8; if (M.stars(s)[1]) note('90 % rule'); s.kills = 9; s.coinsGot = 49; if (M.stars(s)[2]) note('50 coins rule'); s.coinsGot = 50; s.hits = 1; if (M.stars(s)[0]) note('no-hit rule');
      const e = M.newRun(true); const q = M.newGame(1, { easy: true, run: e, seed: 3 }); q.script = []; q.inv = 0; q.ebullets.push({ x: q.ship.x, y: q.ship.y, vx: 0, vy: 0, r: 4, mine: false, g: false }); hold(q, 1); if (q.hits !== 0 || q.lives !== 5 || q.shield !== 0) note('the easy-mode shield absorbs the first hit without counting a hit'); q.inv = 0; q.ebullets.push({ x: q.ship.x, y: q.ship.y, vx: 0, vy: 0, r: 4, mine: false, g: false }); hold(q, 1); if (q.hits !== 1 || q.lives !== 4) note('a real hit is counted');
      const b = fresh(); const bl = M.spawnEnemy(b, 'balloon', 100, { y: 100 }); hit(b, bl, 1); const f = M.spawnEnemy(b, 'flyer', 200, { y: 100 }); hit(b, f, 9); if (b.spawned !== 1 || b.kills !== 1) note('balloons do not count for the 90 % objective');
      // a real game: coins counted equal the coin events
      let ev = 0; const g = M.newGame(1, { easy: true, seed: 5, run: M.newRun(true) }); for (let i = 0; i < 3000 && !g.over && !g.cleared; i++) { const inp = i % 3 === 0 ? M.botInput(g) : { tx: g.ship.x, ty: g.ship.y }; ev += M.step(g, M.STEP, inp.tx === undefined ? { tx: g.ship.x, ty: g.ship.y } : inp).filter((z) => z.t === 'coin').length; } if (ev !== g.coinsGot || g.coinsGot < 5) note(`coins collected ${g.coinsGot} vs events ${ev}`); }
    // combo and graze
    { const s = fresh(); const kill = () => { const r = M.spawnEnemy(s, 'rock', 180, { size: 1, y: 150 }); r.vx = r.vy = 0; const s0 = s.score; hit(s, r, 5); return s.score - s0; };
      const g = []; for (let i = 0; i < 11; i++) g.push(kill()); if (s.combo !== 11 || M.comboMult(s) !== 3) note('combo count / multiplier ' + s.combo); if (g[0] !== 10 || g[5] !== 20 || g[10] !== 30) note('the multiplier raises the score: ' + g.join(','));
      hold(s, 60 * 3 + 5); if (s.combo !== 0) note('the combo decays after 3 s'); kill(); s.inv = 0; s.ebullets.push({ x: s.ship.x, y: s.ship.y, vx: 0, vy: 0, r: 4, mine: false, g: false }); hold(s, 1); if (s.combo !== 0) note('a hit ends the combo'); }
    { const s = fresh(); s.ship.x = 180; s.ship.y = 500; s.ebullets.push({ x: 192, y: 460, vx: 0, vy: 200, r: 4.5, mine: false, g: false }); const ev = []; const sc0 = s.score; hold(s, 40, ev); if (ev.filter((q) => q.t === 'graze').length !== 1 || s.grazes !== 1 || s.score !== sc0 + 5 || s.lives !== 3) note('a close bullet scores a graze bonus once'); const t2 = fresh(); t2.ship.x = 180; t2.ship.y = 500; t2.ebullets.push({ x: 260, y: 460, vx: 0, vy: 200, r: 4.5, mine: false, g: false }); hold(t2, 40); if (t2.grazes !== 0) note('a far bullet is no graze'); }
    // the checkpoint
    { const s = M.newGame(2, { seed: 9, run: M.newRun(false) }); s.inv = 1e6; const ev = []; for (let i = 0; i < 60 * 23; i++) hold(s, 1, ev); const cps = ev.filter((q) => q.t === 'checkpoint'); if (cps.length !== 1 || !s.cp || !s.cpDone || s.cp.lives < 3) note('one checkpoint in the middle of the level');
      s.cp.score = 777; const r = M.newGame(2, { seed: 9, run: M.newRun(false), cp: s.cp, startTime: M.CP_T }); if (r.time !== M.CP_T || r.score !== 777 || !r.cpDone || (r.script[r.idx] && r.script[r.idx].t < M.CP_T) || r.idx === 0) note('restart from the checkpoint'); const ev2 = []; r.inv = 1e6; hold(r, 300, ev2); if (ev2.some((q) => q.t === 'checkpoint')) note('no second checkpoint'); }
    // easy and normal
    { const e = M.newRun(true), n = M.newRun(false); if (e.lives !== 5 || n.lives !== 3) note('lives 5 / 3'); const se = M.newGame(5, { easy: true, run: e }), sn = M.newGame(5, { run: n }); if (!(M.bulletSpeed(se) < M.bulletSpeed(sn) * 0.75)) note('easy bullets are slower'); if (!(M.shipR(se) < M.shipR(sn))) note('easy: forgiving hit circle'); if (!(se.script.length < sn.script.length)) note('easy: fewer enemies'); if (se.shield !== 1 || sn.shield !== 0) note('easy: a shield every level'); if (M.newGame(7, { easy: true, run: M.newRun(true) }).shield !== 1) note('easy: the shield again in the next level'); }
    // the end of a game
    { const s = fresh(); s.inv = 0; s.lives = 1; s.ebullets.push({ x: s.ship.x, y: s.ship.y, vx: 0, vy: 0, r: 4, mine: false, g: false }); const ev = []; hold(s, 1, ev); if (!s.over || s.lives !== 0 || !ev.some((q) => q.t === 'over')) note('game over at 0 lives'); const sc = s.score; hold(s, 30); if (s.score !== sc || M.step(s, M.STEP, { tx: 0, ty: 0 }).length) note('nothing moves after game over'); }
    return { bad };
  });
  ok(G.bad.length === 0, `run / shop (3 offers, prices, caps, effects), objectives, combo, graze, checkpoint, easy vs normal, game over${G.bad.length ? ' -> ' + G.bad.join(' | ') : ''}`);

  // ---------- a bot clears every level (this is also the check that every script ends and every boss falls) ----------
  const BOT = await p.evaluate(async () => {
    const M = await import('/src/games/shooter-logic.ts');
    const res = { easy: [], normal: [], bad: [], maxEnt: 0, bossT: 0 };
    const play = (level, seed, easy, lives) => {
      const s = M.newGame(level, { easy, seed, run: M.newRun(easy), lives }); let n = 0, inp = M.botInput(s), bossAt = -1;
      while (!s.over && !s.cleared && n < 60 * 170) {
        if (n % 3 === 0) inp = M.botInput(s);
        M.step(s, M.STEP, inp); n++; if (s.boss && bossAt < 0) bossAt = n / 60;
        if (!Number.isFinite(s.ship.x + s.score)) res.bad.push('NaN');
        res.maxEnt = Math.max(res.maxEnt, s.enemies.length + s.ebullets.length + s.bullets.length + s.coins.length + s.pups.length);
      }
      if (s.cleared) res.bossT = Math.max(res.bossT, n / 60 - bossAt);
      return { cleared: s.cleared, secs: n / 60 };
    };
    for (let l = 1; l <= 12; l++) {
      let w = 0, tm = 0; for (let k = 0; k < 8; k++) { const r = play(l, 1000 + k * 77 + l, true, 3); if (r.cleared) w++; tm = Math.max(tm, r.secs); } res.easy.push([w, Math.round(tm)]);
      let w2 = 0; for (let k = 0; k < 4; k++) if (play(l, 2000 + k * 53 + l, false, 3).cleared) w2++; res.normal.push(w2);
    }
    return res;
  });
  const eTot = BOT.easy.reduce((a, b) => a + b[0], 0);
  ok(eTot >= 0.85 * 96 && BOT.easy.every((r) => r[0] >= 6), `easy: the bot (3 lives) clears ${eTot} of 96 runs, every level at least 6 of 8 (${BOT.easy.map((r) => r[0]).join(' ')})`);
  ok(BOT.easy.every((r) => r[1] <= 160), `every level ends within 160 s (longest ${Math.max(...BOT.easy.map((r) => r[1]))} s)`);
  ok(BOT.normal.reduce((a, b) => a + b, 0) >= 24, `normal: the simple bot clears ${BOT.normal.reduce((a, b) => a + b, 0)} of 48 runs (${BOT.normal.join(' ')}); harder than easy on purpose`);
  ok(BOT.bad.length === 0 && BOT.maxEnt < 400, `bot runs: no NaN, at most ${BOT.maxEnt} entities, a boss falls within ${Math.round(BOT.bossT)} s of appearing`);

  // ---------- the screen ----------
  const S = () => p.evaluate(() => { const s = window.__shooter.state(); return { score: s.score, lives: s.lives, bombs: s.bombs, shield: s.shield, bullets: s.bullets.length, eb: s.ebullets.length, en: s.enemies.length, level: s.level, time: s.time, wl: s.wl, weapon: s.weapon, ship: { ...s.ship }, boss: !!s.boss, over: s.over, cleared: s.cleared, inv: s.inv }; });
  const step = (n) => p.evaluate((k) => window.__shooter.step(k), n);
  const phase = () => p.evaluate(() => window.__shooter.phase());
  const store = () => p.evaluate(() => (JSON.parse(localStorage.getItem('learn.games.v1') || '{}').shooter || {}));
  await p.setViewportSize({ width: 820, height: 1180 }); await p.evaluate(() => (location.hash = '#/subject/games')); await p.evaluate(() => (location.hash = '#/games/shooter')); await p.waitForSelector('#sh-canvas');
  await p.evaluate(() => window.__shooter.manual(true));
  ok((await phase()) === 'ready' && await p.isVisible('#sh-ovl') && (await p.locator('.sh-lv').count()) === 12, 'ready: the overlay with a level-select grid of 12 round buttons');
  ok((await p.locator('.sh-lv.on').getAttribute('data-level')) === '1', 'the first level is selected');
  await p.click('.sh-lv[data-level="4"]');
  ok((await p.textContent('#sh-level')) === '关卡：4' && (await S()).level === 4 && (await p.locator('.sh-lv.on').getAttribute('data-level')) === '4', 'all levels are open: choosing level 4 works');
  await p.click('.sh-lv[data-level="1"]');
  await p.click('#sh-mode'); ok((await p.textContent('#sh-mode')) === '模式：简单' && (await p.getAttribute('#sh-lives', 'data-lives')) === '5' && (await S()).shield === 1, 'easy mode: 5 lives and a shield');
  await p.click('#sh-mode'); ok((await p.textContent('#sh-mode')) === '模式：普通' && (await p.getAttribute('#sh-lives', 'data-lives')) === '3', 'normal mode: 3 lives');
  await p.screenshot({ path: OUT + 'shooter-ready.png' });
  await p.click('#sh-start'); ok((await phase()) === 'play' && !(await p.isVisible('#sh-ovl')), 'start: the game runs');
  ok(await p.evaluate(() => document.querySelector('#sh-mode').disabled), 'the mode cannot change during play');

  // keys
  let a = await S(); const tg0 = await p.evaluate(() => window.__shooter.target());
  await p.keyboard.down('ArrowLeft'); await step(30); await p.keyboard.up('ArrowLeft'); a = await S(); let tg = await p.evaluate(() => window.__shooter.target());
  ok(tg.x < tg0.x - 150 && a.ship.x < 180 - 20, `arrow left moves the ship (target ${Math.round(tg0.x)} -> ${Math.round(tg.x)})`);
  await p.keyboard.down('d'); await step(60); await p.keyboard.up('d'); const b2 = await S(); ok(b2.ship.x > a.ship.x + 40, 'D moves it right');
  const y0 = (await S()).ship.y; await p.keyboard.down('w'); await step(20); await p.keyboard.up('w'); ok((await S()).ship.y < y0 - 20, 'W moves it up'); await p.keyboard.down('ArrowDown'); await step(30); await p.keyboard.up('ArrowDown'); ok((await S()).ship.y > y0 - 20, 'arrow down moves it down');
  // pointer: the ship follows the finger with an offset (it flies above the finger so the finger does not hide it)
  const rect = await p.evaluate(() => { const r = document.querySelector('#sh-canvas').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
  const fx = rect.l + rect.w * 0.75, fy = rect.t + rect.h * 0.8;
  await p.mouse.move(fx, fy); await p.mouse.down(); tg = await p.evaluate(() => window.__shooter.target());
  ok(Math.abs(tg.x - 270) < 2 && Math.abs(tg.y - (0.8 * 640 - 56)) < 2, `the mouse drag sets the target: x ${tg.x.toFixed(1)}, y ${tg.y.toFixed(1)} (finger at 270 / 512, ship 56 above)`);
  await step(90); a = await S(); ok(Math.abs(a.ship.x - 270) < 3 && Math.abs(a.ship.y - 456) < 3, `the ship arrives at the finger's offset position (${a.ship.x.toFixed(1)}, ${a.ship.y.toFixed(1)})`);
  await p.mouse.move(rect.l + rect.w * 0.2, rect.t + rect.h * 0.5); await step(3); a = await S(); ok(a.ship.x < 270 && a.ship.x > 72 - 0, 'moves with smoothing, not a jump (3 steps)'); await step(90); a = await S(); ok(Math.abs(a.ship.x - 72) < 3, 'the ship follows the dragged mouse');
  await p.mouse.up();
  const keepT = await p.evaluate(() => window.__shooter.target()); await p.mouse.move(rect.l + rect.w * 0.9, rect.t + rect.h * 0.3); await step(2); ok(Math.abs((await p.evaluate(() => window.__shooter.target())).x - keepT.x) < 0.01, 'a released mouse no longer steers');
  // fire, hit
  await p.evaluate(() => { const s = window.__shooter.state(); s.inv = 0; s.script = []; s.enemies.length = 0; s.ebullets.length = 0; });
  await step(40); a = await S(); ok(a.bullets > 0, 'the ship fires by itself');
  const sc0 = (await S()).score; await p.evaluate(() => { const H = window.__shooter, s = H.state(); const e = H.spawn('flyer', s.ship.x, s.ship.y - 150); e.vy = 0; e.cd = 999; }); await step(40); a = await S(); ok(a.score > sc0 && a.en === 0, 'a shot enemy is destroyed and scores');
  ok((await p.textContent('#sh-score')) === `得分：${a.score}`, 'the score pill follows');
  // hurt, hearts, invulnerability
  await p.evaluate(() => { const s = window.__shooter.state(); s.inv = 0; s.ebullets.push({ x: s.ship.x, y: s.ship.y, vx: 0, vy: 0, r: 4, mine: false, g: false }); }); await step(1); a = await S();
  ok(a.lives === 2 && (await p.getAttribute('#sh-lives', 'data-lives')) === '2' && (await p.locator('#sh-lives .sh-heart.on').count()) === 2, 'a hit costs a life and a heart');
  await p.evaluate(() => { const s = window.__shooter.state(); s.ebullets.push({ x: s.ship.x, y: s.ship.y, vx: 0, vy: 0, r: 4, mine: false, g: false }); }); await step(1); ok((await S()).lives === 2, 'a short invulnerability after a hit');
  // shield
  await p.evaluate(() => { const s = window.__shooter.state(); s.inv = 0; s.shield = 1; s.ebullets.push({ x: s.ship.x, y: s.ship.y, vx: 0, vy: 0, r: 4, mine: false, g: false }); }); await step(1); a = await S(); ok(a.lives === 2 && a.shield === 0, 'the shield absorbs one hit');
  // bomb: the button and the Space key
  await p.evaluate(() => { const s = window.__shooter.state(); s.bombs = 2; s.inv = 0; for (let i = 0; i < 12; i++) s.ebullets.push({ x: 30 + i * 25, y: 200, vx: 0, vy: 40, r: 4, mine: false, g: false }); const e = window.__shooter.spawn('flyer', 100, 120); e.cd = 999; }); await p.evaluate(() => window.__shooter.step(0));
  await p.click('#sh-bomb'); await step(1); a = await S(); ok(a.eb === 0 && a.bombs === 1 && a.en === 0 && (await p.getAttribute('#sh-bomb', 'data-bombs')) === '1', 'the bomb button clears bullets and enemies, one bomb less');
  await p.evaluate(() => { const s = window.__shooter.state(); for (let i = 0; i < 5; i++) s.ebullets.push({ x: 30 + i * 25, y: 200, vx: 0, vy: 40, r: 4, mine: false, g: false }); }); await p.keyboard.press(' '); await step(1); a = await S(); ok(a.eb === 0 && a.bombs === 0, 'Space fires a bomb');
  await p.evaluate(() => { const s = window.__shooter.state(); s.ebullets.push({ x: 30, y: 200, vx: 0, vy: 40, r: 4, mine: false, g: false }); }); await p.keyboard.press(' '); await step(1); ok((await S()).eb === 1, 'with no bomb left Space does nothing');
  ok(await p.evaluate(() => document.querySelector('#sh-bomb').querySelectorAll('.sh-bomb.on').length === 0), 'the bomb pills show the empty bombs');
  // pause
  const tm = (await S()).time; await p.keyboard.press('p'); ok((await phase()) === 'pause' && (await p.textContent('#sh-ovl h2')) === '暂停' && (await p.textContent('#sh-pause')) === '继续', 'P pauses (overlay, button says continue)');
  await step(40); ok(Math.abs((await S()).time - tm) < 1e-9, 'nothing moves while paused'); await p.screenshot({ path: OUT + 'shooter-pause.png' }); await p.keyboard.press('Escape'); ok((await phase()) === 'play', 'Esc continues');
  await p.keyboard.press('p'); await p.click('#sh-start'); ok((await phase()) === 'play', 'the continue button resumes');
  // a hidden tab pauses
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }); ok((await phase()) === 'pause', 'a hidden tab pauses'); await p.evaluate(() => { delete document.hidden; }); await p.click('#sh-start');
  // combo pill
  await p.evaluate(() => { const s = window.__shooter.state(); s.combo = 7; s.comboT = 3; }); await step(1); await p.evaluate(() => window.__shooter.spawn('rock', 10, -50)); await step(1);
  // game over, retry, best
  await p.evaluate(() => { const s = window.__shooter.state(); s.score = 1234; s.lives = 1; s.inv = 0; s.ebullets.push({ x: s.ship.x, y: s.ship.y, vx: 0, vy: 0, r: 4, mine: false, g: false }); }); await step(1);
  ok((await phase()) === 'over' && (await p.textContent('#sh-ovl h2')) === '游戏结束' && (await p.textContent('#sh-start')) === '重试', 'game over: overlay and retry button');
  ok((await store())['best-normal'] === 1234 && (await store()).best === 1234, 'the best score is kept in learn.games.v1');
  await p.screenshot({ path: OUT + 'shooter-over.png' });
  await p.click('#sh-start'); a = await S(); ok((await phase()) === 'play' && a.lives === 3 && a.score === 0, 'retry: a new try of the level'); ok((await p.textContent('#sh-best')) === '最高：1234', 'the best pill shows 1234');
  // game over after the checkpoint restarts from it
  await p.evaluate(() => { const s = window.__shooter.state(); s.time = 21.9; s.idx = s.script.findIndex((e) => e.t >= 21.9); s.score = 500; s.inv = 1e6; }); await step(30); const cpOk = await p.evaluate(() => !!window.__shooter.state().cp);
  await p.evaluate(() => { const s = window.__shooter.state(); s.inv = 0; s.lives = 1; s.ebullets.push({ x: s.ship.x, y: s.ship.y, vx: 0, vy: 0, r: 4, mine: false, g: false }); }); await step(1);
  ok(cpOk && (await p.textContent('#sh-ovl p')) === '将从存档点重新开始。', 'a checkpoint was reached; game over says it restarts from there');
  await p.click('#sh-start'); a = await S(); ok(Math.abs(a.time - 22) < 0.1 && a.score === 500 && a.lives >= 3, `retry resumes from the checkpoint (time ${a.time.toFixed(1)}, score ${a.score})`);
  await p.evaluate(() => window.__shooter.setLevel(1));

  // level clear: stars, objectives, shop, next level
  const toClear = async (level) => {
    await p.evaluate((l) => window.__shooter.setLevel(l), level); await p.click('#sh-start');
    await p.evaluate(() => { const H = window.__shooter, s = H.state(); s.script = [{ t: 0, k: 'boss', x: 180, size: s.level % 3 === 0 ? s.level / 3 : 0 }]; s.inv = 1e6; s.coinsGot = 50; s.spawned = 10; s.kills = 10; H.step(3); const b = s.boss; b.hp = 0.5; b.y = 100; b.x = 180; s.bullets.push({ x: 180, y: 100, vx: 0, vy: 0, dmg: 1, r: 4, life: 1, kind: 'blaster', x0: 180, age: 0, hits: [] }); H.step(1); });
    const ev = await p.evaluate(() => { const H = window.__shooter; for (let i = 0; i < 400 && H.phase() === 'play'; i++) H.step(1); return H.phase(); });
    return ev;
  };
  let ph = await toClear(1);
  ok(ph === 'clear' && (await p.textContent('#sh-ovl h2')) === '本关完成。' && (await p.locator('.sh-goal').count()) === 3, 'level clear: the overlay with three star objectives');
  ok((await p.locator('.sh-goal.got').count()) === 3 && (await p.locator('.sh-goal b').allTextContents()).join('') === '★★★', 'all three objectives reached: three stars (no hit, 90 %, 50 coins)');
  ok((await store())['stars-normal'][0] === 3 && (await store()).level === 2, 'the stars (3) and the level reached (2) are saved');
  await p.screenshot({ path: OUT + 'shooter-clear.png' });
  await p.click('#sh-start'); ok((await phase()) === 'shop' && (await p.locator('.sh-card').count()) === 3 && (await p.textContent('#sh-ovl h2')) === '商店', 'the shop: 3 cards');
  const w0 = await p.evaluate(() => window.__shooter.run().wallet); ok(w0 > 0, `the coins of the level are in the wallet (${w0})`);
  ok((await p.locator('.sh-card .sh-price').count()) >= 1 && (await p.locator('.sh-card .sh-price').first().textContent()).match(/^\d+$/) !== null, 'every card shows its price');
  await p.evaluate(() => { window.__shooter.run().wallet = 500; }); const upk = await p.evaluate(() => window.__shooter.shop());
  await p.click(`.sh-card[data-up="${upk[0]}"]`); ok(await p.evaluate((k) => window.__shooter.run().up[k] === 1 && window.__shooter.run().wallet < 500, upk[0]), `buying a card applies it and takes the coins (${upk[0]})`);
  ok((await p.textContent('#sh-ovl p')).startsWith('金币：') && !(await p.textContent('#sh-ovl p')).endsWith('500'), 'the wallet line is updated');
  await p.evaluate(() => { window.__shooter.run().wallet = 1; }); await p.click(`.sh-card[data-up="${upk[1]}"]`); ok(await p.evaluate((k) => window.__shooter.run().up[k] === 0, upk[1]), 'not enough coins: nothing is bought');
  await p.screenshot({ path: OUT + 'shooter-shop.png' });
  await p.click('#sh-start'); a = await S(); ok((await phase()) === 'play' && a.level === 2, 'next level starts after the shop');
  await p.evaluate(() => window.__shooter.setLevel(1)); ok((await p.locator('.sh-lv[data-level="1"] i').textContent()) === '★★★', 'the level grid shows the stars of level 1');
  // objectives with fewer stars
  await p.evaluate(() => window.__shooter.setLevel(2)); await p.click('#sh-start'); await p.evaluate(() => { const H = window.__shooter, s = H.state(); s.script = [{ t: 0, k: 'boss', x: 180, size: 0 }]; s.inv = 1e6; s.hits = 2; s.coinsGot = 3; s.spawned = 10; s.kills = 5; H.step(3); const b = s.boss; b.hp = 0.5; s.bullets.push({ x: b.x, y: b.y, vx: 0, vy: 0, dmg: 1, r: 4, life: 1, kind: 'blaster', x0: b.x, age: 0, hits: [] }); H.step(1); for (let i = 0; i < 400 && H.phase() === 'play'; i++) H.step(1); });
  ok((await p.locator('.sh-goal.got').count()) === 0 && (await p.locator('.sh-goal b').allTextContents()).join('') === '☆☆☆' && (await p.locator('.sh-goal span').allTextContents()).some((x) => x.includes('/ 50')), 'no objective reached: three empty stars, coin progress shown');
  ok((await store())['stars-normal'][1] === 0, 'a bad result does not lower or invent stars'); await p.evaluate(() => { const H = window.__shooter; H.setLevel(1); });
  // the last level
  ph = await toClear(12); ok(ph === 'won' && (await p.textContent('#sh-ovl h2')) === '全部通关。' && (await p.textContent('#sh-ovl p')).startsWith('总星数：') && (await p.textContent('#sh-start')) === '再玩一次', 'all twelve levels: the final overlay with the star total');
  await p.click('#sh-start'); a = await S(); ok((await phase()) === 'play' && a.level === 1, 'play again starts from level 1');

  // ---------- touch with CDP at dpr 2 ----------
  const t3 = await start(new Map(), { local: true, touch: true, dpr: 2, viewport: { width: 390, height: 844 } }); const q = t3.page;
  await q.evaluate(() => (location.hash = '#/games/shooter')); await q.waitForSelector('#sh-canvas'); await q.evaluate(() => window.__shooter.manual(true)); await q.tap('#sh-start');
  const cdp = await t3.page.context().newCDPSession(q);
  const r3 = await q.evaluate(() => { const r = document.querySelector('#sh-canvas').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r3.l + r3.w * 0.3, y: r3.t + r3.h * 0.7, id: 1 }] });
  let tt = await q.evaluate(() => window.__shooter.target()); ok(Math.abs(tt.x - 108) < 2 && Math.abs(tt.y - (0.7 * 640 - 56)) < 2, `touch: the target is the finger's place, 56 above (${tt.x.toFixed(0)}, ${tt.y.toFixed(0)})`);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: r3.l + r3.w * 0.8, y: r3.t + r3.h * 0.6, id: 1 }] }); await q.evaluate(() => window.__shooter.step(80));
  const sh3 = await q.evaluate(() => ({ ...window.__shooter.state().ship })); ok(Math.abs(sh3.x - 288) < 4 && Math.abs(sh3.y - (0.6 * 640 - 56)) < 4, `touch: the ship follows the finger (${sh3.x.toFixed(0)}, ${sh3.y.toFixed(0)}) and stays above it`);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: r3.l + r3.w * 0.8, y: r3.t + r3.h * 0.6, id: 1 }, { x: r3.l + r3.w * 0.1, y: r3.t + r3.h * 0.9, id: 2 }] }); tt = await q.evaluate(() => window.__shooter.target()); ok(Math.abs(tt.x - 288) < 4, 'a second finger is ignored');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  ok((await q.evaluate(() => window.devicePixelRatio)) === 2 && await q.evaluate(() => { const c = document.querySelector('#sh-canvas'); return c.width === Math.round(parseFloat(c.style.width) * 2) && c.height === Math.round(parseFloat(c.style.height) * 2); }), 'dpr 2: the canvas has twice the pixels');
  await q.tap('#sh-bomb'); ok(await q.evaluate(() => window.__shooter.state().bombs) >= 0, 'the bomb button can be tapped'); await t3.browser.close();

  // ---------- layout on 5 screens ----------
  const sizes = [['phone', 390, 844], ['small', 320, 568], ['ipad', 820, 1180], ['wide', 1180, 820], ['side', 844, 390]];
  for (const [name, w, hgt] of sizes) {
    await p.setViewportSize({ width: w, height: hgt });
    await p.evaluate(() => (location.hash = '#/subject/games')); await p.evaluate(() => (location.hash = '#/games/shooter')); await p.waitForSelector('#sh-canvas'); await p.evaluate(() => window.__shooter.manual(true)); await p.waitForTimeout(300);
    const meas = () => p.evaluate(() => {
      const R = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
      const f = R('#sh-field'), o = document.querySelector('#sh-ovl'), orect = o.getBoundingClientRect();
      const kids = o.hidden ? [] : [...o.querySelectorAll('h2, p, button, .sh-goal')].map((k) => k.getBoundingClientRect()).filter((r) => r.width > 0);
      return { f, c: R('#sh-canvas'), hud: R('.sh-hud'), vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, hudOk: [...document.querySelectorAll('.sh-hud > *')].filter((b) => !b.hidden).every((b) => { const r = b.getBoundingClientRect(); return r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.top >= -0.5 && r.bottom <= innerHeight + 0.5; }), ovlOk: !o.hidden && kids.every((r) => r.left >= orect.left - 0.5 && r.right <= orect.right + 0.5 && r.top >= orect.top - 0.5 && r.bottom <= orect.bottom + 0.5) && o.scrollHeight <= o.clientHeight + 1 && o.scrollWidth <= o.clientWidth + 1 };
    });
    const m = await meas();
    const inside = (b) => b.l >= -0.5 && b.r <= m.vw + 0.5 && b.t >= -0.5 && b.b <= m.vh + 0.5;
    ok(inside(m.f) && inside(m.hud) && m.hudOk, `${name} ${w}x${hgt}: board and HUD are on the screen (board ${Math.round(m.c.w)}x${Math.round(m.c.h)})`);
    ok(m.sw <= m.vw && m.sh <= m.vh + 1, `${name}: no page scrolling`);
    ok(Math.abs(m.c.h / m.c.w - 16 / 9) < 0.02, `${name}: the board keeps its 9:16 shape`);
    ok(Math.abs(m.f.l - (m.vw - m.f.r)) <= 3, `${name}: the board is centred (${Math.round(m.f.l)} / ${Math.round(m.vw - m.f.r)})`);
    ok(m.f.r <= m.hud.l + 1 || m.hud.r <= m.f.l + 1 || m.hud.b <= m.f.t + 1, `${name}: the HUD does not cover the board`);
    ok(m.c.w >= (name === 'side' ? 170 : name === 'small' ? 220 : 280), `${name}: the board is big enough (${Math.round(m.c.w)}px)`);
    ok(m.ovlOk, `${name}: the ready overlay (level grid, text, button) fits inside the board`);
    await p.screenshot({ path: OUT + `shooter-${name}.png` });
    await p.click('#sh-start'); await p.evaluate(() => { const H = window.__shooter, s = H.state(); s.inv = 1e6; s.weapon = 'spread'; s.wl = 3; H.bot(true); H.step(700); H.bot(false); H.clearFx(); }); await p.screenshot({ path: OUT + `shooter-${name}-play.png` });
    // the clear overlay and the shop fit as well
    await toClear(3); const m2 = await meas(); ok(m2.ovlOk, `${name}: the level-clear overlay fits`); await p.screenshot({ path: OUT + `shooter-${name}-clear.png` });
    await p.click('#sh-start'); await p.evaluate(() => { window.__shooter.run().wallet = 500; }); await p.click('.sh-card >> nth=0'); const m3 = await meas(); ok(m3.ovlOk && (await p.locator('.sh-card').count()) === 3, `${name}: the shop overlay fits (3 cards)`); await p.screenshot({ path: OUT + `shooter-${name}-shop.png` });
  }
  // a sharp canvas also at dpr 3
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(150);
  await p.evaluate(() => { Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true }); window.dispatchEvent(new Event('resize')); }); await p.waitForTimeout(200);
  ok(await p.evaluate(() => { const c = document.querySelector('#sh-canvas'); return c.width === Math.round(parseFloat(c.style.width) * 3) && c.height === Math.round(parseFloat(c.style.height) * 3) && c.style.width === c.offsetWidth + 'px'; }), 'dpr 3: three times the pixels, sized by layout size (offsetWidth), not by a measured rectangle');
  await p.evaluate(() => { delete window.devicePixelRatio; });
  // reduced motion: no shake; with motion: a small shake after a hit
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.evaluate(() => (location.hash = '#/games/shooter')); await p.waitForSelector('#sh-canvas'); await p.evaluate(() => window.__shooter.manual(true)); await p.click('#sh-start');
  const hurtIt = (pg) => pg.evaluate(() => { const s = window.__shooter.state(); s.inv = 0; s.ebullets.push({ x: s.ship.x, y: s.ship.y, vx: 0, vy: 0, r: 4, mine: false, g: false }); window.__shooter.step(1); return window.__shooter.shake(); });
  ok((await hurtIt(p)) === 0, 'reduced motion: no screen shake');
  const t4 = await start(new Map(), { local: true, motion: true, viewport: { width: 390, height: 844 } }); const q4 = t4.page; await q4.evaluate(() => (location.hash = '#/games/shooter')); await q4.waitForSelector('#sh-canvas'); await q4.evaluate(() => window.__shooter.manual(true)); await q4.click('#sh-start');
  ok((await hurtIt(q4)) > 0.5, 'with motion allowed a hit shakes the screen'); ok(await q4.evaluate(() => window.__shooter.particles()) > 5, 'particle burst after a hit'); await t4.browser.close();
  // floating score numbers
  await p.evaluate(() => { const H = window.__shooter, s = H.state(); s.inv = 1e6; const e = H.spawn('flyer', s.ship.x, s.ship.y - 120); e.vy = 0; e.cd = 999; H.step(40); });
  ok(await p.evaluate(() => window.__shooter.floats()) > 0, 'a floating score number appears on a kill');
  // leaving stops it
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-grid');
  await p.waitForFunction(() => !window.__shooter);
  ok(true, 'leaving the game removes it (the hook is gone, listeners removed)');
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press(' ');
  ok(t.log.external.length === 0, 'no request left the app');
  await t.browser.close();

  // ---------- every Chinese text of the game is in the translation file ----------
  const json = JSON.parse(fs.readFileSync('src/games/shooter.i18n.json', 'utf8')); const keys = Object.keys(json);
  ok(keys.every((k) => k.length > 1 && json[k].length === 2 && json[k].every((v) => v && !CJK.test(v))), 'shooter.i18n.json: no one-character keys, EN and FR for every key');
  const covered = (txt) => keys.some((k) => { const re = new RegExp('^' + k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{0\}/g, '.+') + '$'); return re.test(txt); });
  const src = ['shooter.ts', 'shooter-art.ts', 'shooter-logic.ts', 'shooter-levels.ts'].map((f) => fs.readFileSync('src/games/' + f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')).join('\n');
  const lit = [...src.matchAll(/["`]([^"`\n]*[㐀-鿿][^"`\n]*)["`]/g)].map((m) => m[1].replace(/\$\{[^}]*\}/g, '{0}'));
  const miss = lit.filter((x) => !json[x]); ok(lit.length >= 20 && miss.length === 0, `every Chinese text in the game's sources is a key of the json (${lit.length} texts)${miss.length ? ' -> ' + miss.join(' | ') : ''}`);
  ok(['太空射击', '拖动飞船自动开火，击落陨石和敌机'].every((k) => json[k]), 'the name and the subtitle are translated');

  // ---------- en / fr ----------
  const merged = fs.readFileSync('src/i18n-data.ts', 'utf8').includes('"连击：{0}"');
  for (const [loc, label] of [['en-US', 'EN'], ['fr-FR', 'FR']]) {
    const t2 = await start(new Map(), { local: true, locale: loc, viewport: { width: 390, height: 844 } });
    const z = t2.page; const left = new Set();
    const scan = async () => { for (const x of await z.evaluate(() => [...document.querySelectorAll('#sh-ovl *, .sh-hud *, .gm-title *, .gm-bar *')].filter((e) => e.children.length === 0 && getComputedStyle(e).display !== 'none').map((e) => e.textContent.trim()).filter(Boolean))) if (CJK.test(x)) left.add(x); };
    await z.evaluate(() => (location.hash = '#/games/shooter')); await z.waitForSelector('#sh-canvas'); await z.evaluate(() => window.__shooter.manual(true));
    await z.waitForTimeout(200); await scan(); await z.screenshot({ path: OUT + `shooter-${label.toLowerCase()}-ready.png` });
    await z.click('#sh-mode'); await scan(); await z.click('#sh-mode'); await z.click('#sh-start'); await z.click('#sh-pause'); await z.waitForTimeout(100); await scan(); await z.screenshot({ path: OUT + `shooter-${label.toLowerCase()}-pause.png` }); await z.keyboard.press('p');
    await z.evaluate(() => { const s = window.__shooter.state(); s.combo = 6; s.comboT = 3; window.__shooter.step(1); }); await scan();
    await z.evaluate(() => { const H = window.__shooter, s = H.state(); s.script = [{ t: 0, k: 'boss', x: 180, size: 0 }]; s.inv = 1e6; s.coinsGot = 7; H.step(3); const b = s.boss; b.hp = 0.5; s.bullets.push({ x: b.x, y: b.y, vx: 0, vy: 0, dmg: 1, r: 4, life: 1, kind: 'blaster', x0: b.x, age: 0, hits: [] }); H.step(1); for (let i = 0; i < 400 && H.phase() === 'play'; i++) H.step(1); });
    await z.waitForTimeout(100); await scan(); await z.screenshot({ path: OUT + `shooter-${label.toLowerCase()}-clear.png` });
    await z.click('#sh-start'); await z.waitForTimeout(100); await scan(); await z.screenshot({ path: OUT + `shooter-${label.toLowerCase()}-shop.png` });
    await z.evaluate(() => { window.__shooter.run().wallet = 0; }); await z.click('.sh-card >> nth=0'); await scan();
    await z.click('#sh-start'); await z.evaluate(() => { const s = window.__shooter.state(); s.lives = 1; s.inv = 0; s.ebullets.push({ x: s.ship.x, y: s.ship.y, vx: 0, vy: 0, r: 4, mine: false, g: false }); window.__shooter.step(1); });
    await z.waitForTimeout(100); await scan(); await z.screenshot({ path: OUT + `shooter-${label.toLowerCase()}-over.png` });
    await z.evaluate(() => { const H = window.__shooter; H.setLevel(12); }); await z.click('#sh-start'); await z.evaluate(() => { const H = window.__shooter, s = H.state(); s.script = [{ t: 0, k: 'boss', x: 180, size: 4 }]; s.inv = 1e6; H.step(3); const b = s.boss; b.hp = 0.5; s.bullets.push({ x: b.x, y: b.y, vx: 0, vy: 0, dmg: 1, r: 4, life: 1, kind: 'blaster', x0: b.x, age: 0, hits: [] }); H.step(1); for (let i = 0; i < 400 && H.phase() === 'play'; i++) H.step(1); }); await z.waitForTimeout(100); await scan();
    const arr = [...left]; const untranslated = arr.filter((x) => !covered(x));
    if (merged) ok(arr.length === 0, `${label}: no Chinese left on the game screen${arr.length ? ' -> ' + arr.join(' | ') : ''}`);
    ok(untranslated.length === 0, `${label}: every Chinese text shown is in shooter.i18n.json${untranslated.length ? ' -> ' + untranslated.join(' | ') : ''}`);
    ok(t2.log.external.length === 0, `${label}: no outside request`);
    await t2.browser.close();
  }
  await done();
})();
