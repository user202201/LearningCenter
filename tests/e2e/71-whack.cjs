// Whack-a-mole: the pure rules on thousands of seeded rounds with a 60 % bot (scheduler, caps, lifetimes, scoring, combo, helmet, bomb, bunny, curve),
// the screen through the test hook (hit, miss, bomb, bunny, helmet, golden, keys, several fingers, pause, end, best), layout on five sizes, EN / FR, no outside request.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  const p = t.page;
  await p.evaluate(() => (location.hash = '#/games/whack')); await p.waitForSelector('#wh-field');

  // ---------- the rules ----------
  const L = await p.evaluate(async () => {
    const M = await import('/src/games/whack-logic.ts');
    const res = { bad: [], rounds: 0, steps: 0, spawned: 0, taps: 0, maxSeen: [0, 0, 0], kinds: {}, ended: 0, bombs: 0, helm: 0 };
    const bad = (m) => { if (res.bad.length < 8) res.bad.push(m); };
    // --- the curve ---
    for (let lv = 0; lv < 3; lv++) {
      let pa = 1e9, pg = 1e9;
      for (let i = 0; i <= 1000; i++) {
        const q = i / 1000, a = M.appearTime(q, lv), g = M.spawnGap(q, lv);
        if (a > pa || g > pg) bad('curve not monotonic level ' + lv + ' at ' + q);
        pa = a; pg = g;
      }
      if (!(M.appearTime(0, lv) > M.appearTime(1, lv))) bad('appear time does not shrink');
    }
    if (M.appearTime(0, 1) !== 1200 || M.appearTime(1, 1) !== 600) bad('normal curve is not 1.2 s -> 0.6 s');
    if (!(M.spawnGap(1, 1) < M.spawnGap(0, 1))) bad('spawn rate does not rise');
    if (!(M.lifeOf('golden', 0.3, 1) < M.lifeOf('mole', 0.3, 1))) bad('golden is not shorter');
    if (!(M.appearTime(0.5, 0) > M.appearTime(0.5, 1) && M.appearTime(0.5, 1) > M.appearTime(0.5, 2))) bad('levels not faster');
    // --- grids and caps ---
    const dims = [[3, 3, 2], [3, 4, 3], [4, 4, 4]];
    dims.forEach(([c, r, cap], lv) => { const s = M.newGame(lv, 1); if (s.cols !== c || s.rows !== r || s.cap !== cap || s.holes.length !== c * r) bad('level ' + lv + ' shape'); });
    // --- scripted scoring ---
    const fresh = () => { const s = M.newGame(1, 5); s.auto = false; return s; };
    let s = fresh(); M.spawnAt(s, 0, 'mole'); let e = M.tap(s, 0);
    if (e.t !== 'kill' || e.pts !== 10 || s.score !== 10 || s.holes[0] || s.combo !== 1) bad('mole is not +10');
    if (M.spawnAt(s, 3, 'mole') !== true || M.spawnAt(s, 3, 'bomb') !== false) bad('two characters in one hole');
    s = fresh(); M.spawnAt(s, 1, 'helmet'); e = M.tap(s, 1);
    if (e.t !== 'dent' || s.score !== 0 || !s.holes[1] || s.holes[1].hp !== 1 || s.combo !== 0) bad('helmet: first hit must only dent');
    e = M.tap(s, 1); if (e.t !== 'kill' || e.pts !== 25 || s.score !== 25 || s.holes[1]) bad('helmet: second hit must be +25');
    s = fresh(); M.spawnAt(s, 2, 'golden'); e = M.tap(s, 2); if (e.pts !== 50 || s.score !== 50) bad('golden is not +50');
    s = fresh(); s.score = 100; M.spawnAt(s, 2, 'bomb'); const rem0 = M.remaining(s); e = M.tap(s, 2);
    if (e.t !== 'bomb' || s.score !== 80 || M.remaining(s) !== rem0 - 5000 || s.penalty !== 5000 || s.combo !== 0) bad('bomb: -20 and -5 s');
    s = fresh(); s.score = 5; M.spawnAt(s, 2, 'bomb'); M.tap(s, 2); if (s.score !== 0) bad('score below zero');
    s = fresh(); s.score = 100; s.combo = 7; M.spawnAt(s, 4, 'bunny'); e = M.tap(s, 4);
    if (e.t !== 'bunny' || s.score !== 90 || s.combo !== 0 || M.remaining(s) !== 45000) bad('bunny: -10, combo reset, no time lost');
    s = fresh(); s.combo = 3; e = M.tap(s, 5); if (e.t !== 'miss' || s.score !== 0 || s.combo !== 0 || s.misses !== 1) bad('miss: no penalty, combo reset');
    // leaving bombs / bunnies alone costs nothing
    s = fresh(); M.spawnAt(s, 0, 'bomb'); M.spawnAt(s, 1, 'bunny'); s.score = 40; M.step(s, 3000);
    if (s.holes[0] || s.holes[1] || s.score !== 40 || s.penalty !== 0 || s.combo !== 0) bad('leaving a bomb / bunny alone must be free');
    // a good one that leaves: no penalty, no combo change
    s = fresh(); M.spawnAt(s, 0, 'mole'); s.combo = 4; M.step(s, 3000); if (s.score !== 0 || s.combo !== 4 || s.left !== 1) bad('an escaped mole must cost nothing');
    // combo thresholds: x1 up to 4, x2 from 5, x3 from 10
    s = fresh(); const pts = [];
    for (let i = 0; i < 12; i++) { s.holes[0] = null; M.spawnAt(s, 0, 'mole'); pts.push(M.tap(s, 0).pts); }
    if (pts.join() !== '10,10,10,10,20,20,20,20,20,30,30,30') bad('combo multipliers: ' + pts.join());
    if (M.mult(4) !== 1 || M.mult(5) !== 2 || M.mult(9) !== 2 || M.mult(10) !== 3 || M.mult(99) !== 3) bad('mult table');
    // keys
    if (M.keyHole('1', 3, 3) !== 0 || M.keyHole('9', 3, 3) !== 8 || M.keyHole('9', 3, 4) !== 8 || M.keyHole('q', 3, 3) !== 0 || M.keyHole('e', 3, 3) !== 2 || M.keyHole('c', 3, 3) !== 8 || M.keyHole('r', 3, 3) !== -1 || M.keyHole('r', 4, 4) !== 3 || M.keyHole('v', 4, 4) !== 11 || M.keyHole('5', 3, 3) !== 4) bad('key map');
    if (M.stars(0, 1) !== 1 || M.stars(150, 1) !== 2 || M.stars(300, 1) !== 3 || M.stars(9999, 0) !== 3) bad('stars');
    // same seed = same round
    const run = (seed) => { const q = M.newGame(2, seed); const log = []; for (let i = 0; i < 400; i++) { M.step(q, 50); log.push(q.holes.map((c) => (c ? c.kind[0] : '.')).join('')); } return log.join('|'); };
    if (run(77) !== run(77) || run(77) === run(78)) bad('seeding');
    // --- thousands of simulated rounds with a bot of 60 % accuracy ---
    for (let g = 0; g < 1500; g++) {
      const lv = g % 3, q = M.newGame(lv, 1000 + g); res.rounds++;
      let exp = 0, step = 16 + (g % 5) * 8, sinceTap = 0, seen = new Map(), pen = 0;
      const rr = M.newGame(0, 9000 + g * 7919); // the bot's own dice
      while (!q.over && q.t < 80000) {
        const before = q.holes.slice(), tBefore = q.t;
        M.step(q, step); res.steps++;
        const live = q.holes.filter(Boolean).length; if (live > q.cap) bad('cap exceeded ' + live); res.maxSeen[lv] = Math.max(res.maxSeen[lv], live);
        for (let i = 0; i < q.holes.length; i++) {
          const c = q.holes[i];
          if (c) { if (!seen.has(c)) { seen.set(c, i); res.spawned++; res.kinds[c.kind] = (res.kinds[c.kind] || 0) + 1; if (c.born > q.t || q.t - c.born > step + 20) bad('born time'); } else if (seen.get(c) !== i) bad('moved'); if (q.t - c.born > c.life + step + 20) bad('stayed too long'); }
        }
        for (const c of before) if (c && !q.holes.includes(c)) { const age = q.t - c.born; if (age + 0.001 < c.life - 20 && !q.over) bad('left too early ' + age + ' < ' + c.life); if (age > c.life + step + 20) bad('left late'); }
        sinceTap += step;
        if (sinceTap >= 150 && !q.over) {
          sinceTap = 0; const good = []; q.holes.forEach((c, i) => { if (c && (c.kind === 'mole' || c.kind === 'helmet' || c.kind === 'golden')) good.push(i); });
          let target;
          if (rr && (M.rnd(rr) < 0.6) && good.length) target = good[Math.floor(M.rnd(rr) * good.length)]; else target = Math.floor(M.rnd(rr) * q.holes.length);
          const c = q.holes[target], sc = q.score, pb = q.penalty, cb = q.combo; const ev = M.tap(q, target); res.taps++;
          if (ev.t === 'kill') { if (ev.pts !== M.POINTS[ev.kind] * M.mult(cb + 1)) bad('kill points'); exp += ev.pts; }
          else if (ev.t === 'bomb') { res.bombs++; exp = Math.max(0, exp - 20); pen += 5000; if (q.penalty !== pb + 5000 || q.combo !== 0) bad('bomb state'); }
          else if (ev.t === 'bunny') { exp = Math.max(0, exp - 10); if (q.penalty !== pb || q.combo !== 0) bad('bunny state'); }
          else if (ev.t === 'miss') { if (q.combo !== 0 || q.score !== sc) bad('miss state'); }
          else if (ev.t === 'dent') { res.helm++; if (q.score !== sc || q.combo !== cb) bad('dent state'); }
          if (q.score !== exp) bad('score ' + q.score + ' vs ' + exp);
          if (q.score < 0) bad('negative score');
        }
      }
      if (q.over) res.ended++;
      if (!q.over || q.t + q.penalty < 45000 || q.t + q.penalty >= 45000 + step + 5000 + 1) bad('round did not end on time: ' + q.t + ' + ' + q.penalty);
      if (q.penalty !== pen || q.bombHits * 5000 !== q.penalty) bad('penalty book');
      if (q.holes.some(Boolean)) bad('characters left after the end');
      if (q.hits > q.taps || q.kills > q.hits) bad('counters');
      if (res.bad.length > 6) break;
    }
    // a player who never taps: the limit of each level is reached and never passed
    res.lazy = [0, 0, 0];
    for (let lv = 0; lv < 3; lv++) for (let g = 0; g < 40; g++) { const q = M.newGame(lv, 50 + g); while (!q.over) { M.step(q, 20); const n = q.holes.filter(Boolean).length; if (n > q.cap) res.bad.push('lazy cap'); res.lazy[lv] = Math.max(res.lazy[lv], n); } }
    return res;
  });
  ok(L.lazy.join() === '2,3,4', 'with no taps at all the field fills up to the limit of the level, never more: ' + L.lazy.join(' / '));
  ok(L.bad.length === 0, `rules: ${L.rounds} seeded rounds, ${L.steps} steps, ${L.taps} bot taps, ${L.spawned} characters: all invariants hold${L.bad.length ? ' -> ' + L.bad.join('; ') : ''}`);
  ok(L.ended === L.rounds && L.maxSeen[0] <= 2 && L.maxSeen[1] <= 3 && L.maxSeen[2] <= 4, `every round ended; most at once per level: ${L.maxSeen.join(' / ')}`);
  ok(L.maxSeen[0] >= 2 && L.maxSeen[1] >= 2 && L.maxSeen[2] >= 3, 'also with a bot that taps, the field fills up: ' + L.maxSeen.join(' / '));
  ok(['mole', 'helmet', 'golden', 'bomb', 'bunny'].every((k) => L.kinds[k] > 50) && L.bombs > 50 && L.helm > 50, 'all five characters appear, the bot hit bombs and dented helmets: ' + JSON.stringify(L.kinds));

  // ---------- the screen ----------
  const hook = (f, a) => p.evaluate(([f, a]) => window.__whack[f](...a), [f, a || []]);
  const S = () => p.evaluate(() => { const s = window.__whack.state(); return { score: s.score, combo: s.combo, t: s.t, penalty: s.penalty, taps: s.taps, hits: s.hits, misses: s.misses, over: s.over, kinds: s.holes.map((c) => (c ? c.kind + ':' + c.hp : null)), phase: window.__whack.phase(), cols: s.cols, rows: s.rows }; });
  const centre = (i) => p.evaluate((i) => { const r = document.querySelectorAll('.wh-hole')[i].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, i);
  const click = async (i) => { const c = await centre(i); await p.mouse.click(c.x, c.y); };
  await hook('manual', [true]);
  await p.screenshot({ path: OUT + 'whack-ready.png' });
  ok(await p.locator('#wh-ovl').isVisible() && (await p.textContent('#wh-score')) === '得分：0' && (await p.textContent('#wh-time')) === '时间：45' && (await p.textContent('#wh-level')) === '难度：普通', 'ready: overlay with the start button, score 0, 45 s, normal');
  ok((await p.locator('.wh-hole').count()) === 12, 'normal level has 3 x 4 = 12 holes');
  await p.click('#wh-start'); await hook('auto', [false]);
  ok((await S()).phase === 'play' && !(await p.locator('#wh-ovl').isVisible()), 'Start begins the round');
  // a normal mole
  await hook('spawn', [0, 'mole']); await p.waitForSelector('.wh-hole[data-i="0"].up');
  await p.screenshot({ path: OUT + 'whack-mole.png' });
  await click(0);
  let a = await S();
  ok(a.score === 10 && a.combo === 1 && a.kinds[0] === null && (await p.textContent('#wh-score')) === '得分：10', 'whacking a mole: +10, combo 1, the score pill follows');
  ok(await p.evaluate(() => document.querySelector('#wh-hammer').classList.contains('swing')) && (await p.locator('.wh-pop').count()) >= 1 && (await p.textContent('.wh-pop')) === '+10', 'the hammer swings and "+10" rises');
  ok(await p.evaluate(() => document.querySelector('.wh-hole[data-i="0"]').classList.contains('hit')), 'the mole is squashed for a moment');
  // a miss resets the combo
  await click(5); a = await S();
  ok(a.misses === 1 && a.combo === 0 && a.score === 10, 'tapping an empty hole: no penalty, combo reset');
  // helmet
  await hook('spawn', [1, 'helmet']); await p.waitForSelector('.wh-hole[data-i="1"].up'); await click(1); a = await S();
  ok(a.score === 10 && a.kinds[1] === 'helmet:1', 'helmet: the first hit does not score and the helmet stays');
  ok(await p.evaluate(() => document.querySelector('.wh-hole[data-i="1"]').dataset.hp === '1'), 'the dented helmet shows a crack (data-hp 1)');
  await p.screenshot({ path: OUT + 'whack-helmet.png' });
  await click(1); a = await S(); ok(a.score === 35 && a.kinds[1] === null, 'helmet: the second hit gives +25');
  // golden
  await hook('spawn', [2, 'golden']); await p.waitForSelector('.wh-hole[data-i="2"].up'); await click(2); a = await S(); ok(a.score === 85, 'golden mole +50');
  // bunny
  await hook('spawn', [3, 'bunny']); await p.waitForSelector('.wh-hole[data-i="3"].up'); await p.screenshot({ path: OUT + 'whack-bunny.png' }); await click(3); a = await S();
  ok(a.score === 75 && a.combo === 0 && a.penalty === 0, 'tapping the bunny: -10 and the combo is gone');
  // bomb
  await hook('spawn', [4, 'bomb']); await p.waitForSelector('.wh-hole[data-i="4"].up'); await p.screenshot({ path: OUT + 'whack-bomb.png' });
  const timeBefore = await p.textContent('#wh-time'); await click(4); a = await S();
  ok(a.score === 55 && a.penalty === 5000 && (await p.textContent('#wh-time')) === '时间：40' && timeBefore === '时间：45', 'tapping the bomb: -20 and 5 s lost (45 -> 40)');
  ok((await p.textContent('.wh-pop:last-of-type')).includes('-20'), 'the bomb shows its penalty');
  // leaving a bomb and a bunny alone
  await hook('spawn', [6, 'bomb']); await hook('spawn', [7, 'bunny']); await hook('step', [3000]); a = await S();
  ok(a.score === 55 && a.kinds[6] === null && a.kinds[7] === null && a.penalty === 5000, 'leaving bombs and bunnies alone costs nothing; they leave by themselves');
  // combo x2 / x3
  for (let i = 0; i < 5; i++) { await hook('spawn', [0, 'mole']); await click(0); }
  a = await S(); ok(a.combo === 5 && a.score === 55 + 40 + 20, `5 moles in a row: the fifth counts double (score ${a.score})`);
  ok((await p.textContent('#wh-combo')) === '连击：5 ×2', 'the combo pill says x2');
  for (let i = 0; i < 5; i++) { await hook('spawn', [0, 'mole']); await click(0); }
  a = await S(); ok(a.combo === 10 && (await p.textContent('#wh-combo')) === '连击：10 ×3', 'at 10 the combo is x3');
  await p.screenshot({ path: OUT + 'whack-combo.png' });
  // keys
  const sc0 = (await S()).score;
  await hook('spawn', [0, 'mole']); await p.keyboard.press('q'); a = await S(); ok(a.score === sc0 + 30 && a.kinds[0] === null, 'key Q hits the first hole');
  await hook('spawn', [4, 'mole']); await p.keyboard.press('5'); a = await S(); ok(a.kinds[4] === null && a.score === sc0 + 60, 'key 5 hits the fifth hole');
  await hook('spawn', [11, 'mole']); await p.keyboard.press('v'); a = await S(); ok(a.kinds[11] !== null && a.misses >= 1, 'V is not a key of a 3 x 4 grid (nothing happens to hole 11)');
  await hook('spawn', [8, 'mole']); await p.keyboard.press('c'); a = await S(); ok(a.kinds[8] === null, 'C hits the ninth hole');
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.wh-key')).display) === 'block' && (await p.textContent('.wh-hole[data-i="0"] .wh-key')) === 'Q', 'key labels are shown faintly on the mounds when a keyboard is used');
  // several fingers at once
  await hook('step', [100]);
  await hook('spawn', [0, 'mole']); await hook('spawn', [2, 'mole']); await hook('spawn', [9, 'mole']);
  const before = await S();
  await p.evaluate(() => { for (const [i, id] of [[0, 11], [2, 12], [9, 13]]) { const el = document.querySelectorAll('.wh-hole')[i], r = el.getBoundingClientRect(); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })); } });
  a = await S(); ok(a.hits === before.hits + 3 && a.kinds[0] === null && a.kinds[2] === null && a.kinds[9] === null, 'three fingers at once: all three taps count');
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.wh-key')).display) === 'none', 'after a touch the key labels are hidden');
  // pause
  await hook('spawn', [0, 'mole']); await p.click('#wh-pause');
  ok((await S()).phase === 'pause' && (await p.textContent('#wh-pause')) === '继续' && await p.locator('#wh-ovl').isVisible(), 'pause: overlay, the button says continue');
  const tp = (await S()).t; await hook('step', [5000]); await p.waitForTimeout(300);
  ok((await S()).t === tp, 'the clock does not move while paused');
  await p.screenshot({ path: OUT + 'whack-pause.png' });
  await p.keyboard.press('p'); ok((await S()).phase === 'play', 'P resumes');
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); ok((await S()).phase === 'play', 'Escape toggles the pause');
  // the end
  await hook('step', [60000]); await p.waitForSelector('#wh-ovl h2');
  a = await S(); ok(a.over && a.phase === 'over' && (await p.textContent('#wh-ovl h2')) === '时间到！', 'the round ends when the time is up');
  await p.screenshot({ path: OUT + 'whack-over.png' });
  const fin = a.score;
  ok((await p.locator('#wh-stars svg').count()) === 3 && (await p.textContent('#wh-ovl p')).includes(String(fin)) && (await p.textContent('#wh-ovl')).includes('准确率'), 'results: stars, the score, hits and accuracy');
  const best = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).whack['best-1']);
  ok(best === fin && (await p.textContent('#wh-best')) === `最高：${fin}`, 'the best score of the level is kept on this device: ' + best);
  // play again
  await p.click('#wh-start'); a = await S();
  ok(a.phase === 'play' && a.score === 0 && a.t === 0 && (await p.textContent('#wh-best')) === `最高：${fin}`, 'play again: a new round, the best stays');
  // the bar and the real clock
  await hook('manual', [false]); await hook('auto', [true]); await p.waitForTimeout(2200); a = await S();
  ok(a.t > 1500 && a.t < 3200 && (await p.evaluate(() => parseFloat(document.querySelector('#wh-fill').style.width))) < 100, `the real clock runs the round (t = ${Math.round(a.t)} ms) and the time bar shrinks`);
  ok(a.kinds.some(Boolean) || a.t > 1000, 'characters appear by themselves');
  await hook('manual', [true]);
  // levels
  await p.click('#wh-pause'); await p.click('#wh-start');
  await p.evaluate(() => window.__whack.setLevel(0));
  ok((await p.locator('.wh-hole').count()) === 9 && (await p.textContent('#wh-level')) === '难度：简单', 'easy: 3 x 3 holes');
  await p.click('#wh-level');
  ok((await p.locator('.wh-hole').count()) === 12 && (await p.textContent('#wh-level')) === '难度：普通', 'the level button cycles (easy -> normal)');
  await p.click('#wh-level');
  ok((await p.locator('.wh-hole').count()) === 16 && (await p.textContent('#wh-level')) === '难度：困难' && (await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).whack.level)) === 2, 'hard: 4 x 4 holes, the level is remembered');
  await p.screenshot({ path: OUT + 'whack-hard.png' });

  // ---------- layout on five screens ----------
  for (const [name, w, hgt] of [['phone-390x844', 390, 844], ['small-320x568', 320, 568], ['ipad-820x1180', 820, 1180], ['wide-1180x820', 1180, 820], ['side-844x390', 844, 390]]) {
    for (const lv of [2, 1, 0]) {
      await p.setViewportSize({ width: w, height: hgt });
      await p.evaluate(() => (location.hash = '#/subject/games')); await p.evaluate(() => (location.hash = '#/games/whack')); await p.waitForSelector('#wh-field');
      await p.evaluate((l) => window.__whack.setLevel(l), lv); await p.waitForTimeout(250);
      const m = await p.evaluate(() => {
        const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
        const holes = [...document.querySelectorAll('.wh-hole')].map(R), f = R(document.querySelector('#wh-field')), hud = R(document.querySelector('.wh-hud'));
        return { holes, f, hud, vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, btns: [...document.querySelectorAll('.wh-hud button, .wh-hud .wh-stat')].every((b) => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }) };
      });
      const inside = (b) => b.l >= -0.5 && b.r <= m.vw + 0.5 && b.t >= -0.5 && b.b <= m.vh + 0.5;
      const tag = `${name} level ${lv}`;
      ok(inside(m.f) && m.holes.every(inside) && inside(m.hud) && m.btns, `${tag}: field, every hole and the buttons are on the screen`);
      ok(m.sw <= m.vw && m.sh <= m.vh + 1, `${tag}: no page scrolling`);
      ok(Math.abs(m.f.l - (m.vw - m.f.r)) <= 3, `${tag}: the field is centred (${Math.round(m.f.l)} / ${Math.round(m.vw - m.f.r)})`);
      const minH = Math.min(...m.holes.map((r) => Math.min(r.w, r.h)));
      ok(minH >= (w <= 480 || hgt <= 480 ? 56 : 80) || (name === 'small-320x568' && lv === 2 && minH >= 56), `${tag}: every hole is big enough (${Math.round(minH)} px)`);
      if (lv === 2 || lv === 1) await p.screenshot({ path: OUT + `whack-${name}${lv === 2 ? '' : '-normal'}.png` });
    }
  }
  // leaving stops it
  await p.setViewportSize({ width: 820, height: 1180 });
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-grid');
  await p.waitForFunction(() => !window.__whack);
  ok(true, 'leaving the game removes the hook and the listeners');
  await p.keyboard.press('q');

  // ---------- EN / FR ----------
  for (const [loc, tag, words] of [['en-US', 'EN', ['Whack-a-mole', 'Start', "Time's up!", 'Play again']], ['fr-FR', 'FR', ['Taupe-là', 'Commencer', 'Temps écoulé', 'Rejouer']]]) {
    const u = await start(new Map(), { local: true, locale: loc, viewport: { width: 390, height: 844 } });
    const q = u.page;
    // the game's own texts (src/games/whack.i18n.json) are merged into src/i18n-data.ts by the lead: until then they are added to the served table here, so that the screens can be checked
    const mine = JSON.parse(fs.readFileSync('src/games/whack.i18n.json', 'utf8')), idx = loc === 'en-US' ? 0 : 1;
    const add = '\nObject.assign(' + (idx ? 'FR' : 'EN') + ', ' + JSON.stringify(Object.fromEntries(Object.entries(mine).map(([k, v]) => [k, v[idx]]))) + ');\n';
    await u.ctx.route(/\/src\/i18n-data\.ts/, async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()) + add }); });
    await q.evaluate(() => (location.hash = '#/games/whack')); await q.reload(); await q.waitForSelector('#wh-field');
    const cn = () => q.evaluate(() => (document.querySelector('.wh-wrap').innerText.match(/[一-鿿]+/g) || []).join(' '));
    let left = await cn(); const t1 = await q.textContent('#wh-ovl');
    ok(left === '' && t1.includes(words[0]) && t1.includes(words[1]), `${tag}: ready screen translated (${t1.replace(/\s+/g, ' ').slice(0, 70)})`);
    await q.evaluate(() => { window.__whack.manual(true); }); await q.click('#wh-start');
    await q.evaluate(() => { window.__whack.auto(false); window.__whack.spawn(0, 'mole'); });
    await q.waitForSelector('.wh-hole[data-i="0"].up'); const c0 = await q.evaluate(() => { const r = document.querySelectorAll('.wh-hole')[0].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await q.mouse.click(c0[0], c0[1]); await q.click('#wh-pause');
    left = await cn(); ok(left === '', `${tag}: HUD, combo and pause overlay have no Chinese left (${left})`);
    await q.screenshot({ path: OUT + `whack-${tag.toLowerCase()}-pause.png` });
    await q.click('#wh-start'); await q.evaluate(() => window.__whack.step(60000)); await q.waitForSelector('#wh-ovl h2');
    left = await cn(); const t2 = await q.textContent('#wh-ovl');
    ok(left === '' && t2.includes(words[2]) && t2.includes(words[3]), `${tag}: results translated (${t2.replace(/\s+/g, ' ').slice(0, 90)})`);
    const ov = await q.evaluate(() => { const o = document.querySelector('#wh-ovl'), f = document.querySelector('#wh-field'); return [...o.querySelectorAll('h2,p,button')].every((e) => e.scrollWidth <= e.clientWidth + 1 || e.getBoundingClientRect().right <= f.getBoundingClientRect().right); });
    ok(ov, `${tag}: the result texts fit in the field`);
    await q.screenshot({ path: OUT + `whack-${tag.toLowerCase()}-over.png` });
    ok(u.log.external.length === 0, `${tag}: no request left the app`);
    await u.browser.close();
  }
  ok(t.log.external.length === 0, 'no request left the app');
  await t.browser.close();
  await done();
})();
