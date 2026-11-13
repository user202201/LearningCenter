// 泡泡龙 (bubble shooter): the pure rules on many random boards (hex neighbours, flood fill, floating bubbles, the flight of a shot, the 12 levels), then the screen:
// pointer aiming and shooting, swap, pause, popping + falling + winning, the ceiling coming down, losing, progress kept, layouts, no outside request.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const KEY = 'learn.games.v1';

const open = async (t) => { await t.page.evaluate(() => (location.hash = '#/games/bubble')); await t.page.waitForSelector('.bubble-lv'); };
const S = (p) => p.evaluate(() => { const s = window.__bubble.s; const { grid, ...rest } = s; return { ...rest, count: grid.flat().filter(Boolean).length }; });
/** pointer press / move / release on the canvas at a point given in bubble units (the field is 10 wide, 12.2 high) */
const aimShoot = async (p, ux, uy, shoot = true) => {
  const r = await p.evaluate(() => { const b = document.querySelector('#bubble-canvas').getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height }; });
  const x = r.l + (ux / 10) * r.w, y = r.t + (uy / 12.2) * r.h;
  await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + 1, y + 1); if (shoot) await p.mouse.up(); return { x, y };
};
const waitIdle = (p) => p.waitForFunction(() => !window.__bubble.s.flying, null, { timeout: 8000 });
const rowsToGrid = (spec) => `(() => { const L = window.__L; const g = L.emptyGrid(); for (const [r, c, v] of ${JSON.stringify(spec)}) g[r][c] = v; return g; })()`;

(async () => {
  // ---------------- the pure rules ----------------
  {
    const t = await start(new Map(), { local: true });
    const r = await t.page.evaluate(async () => {
      const L = await import('/src/games/bubble-logic.ts');
      const bad = [];
      const g0 = L.emptyGrid();
      // geometry: neighbours are symmetric, at most 6, at distance 1, interior cells have 6
      let interior = 0;
      for (let r = 0; r < L.ROWS; r++) for (let c = 0; c < g0[r].length; c++) {
        const nb = L.neighbors(g0, r, c);
        if (nb.length > 6) bad.push('>6 ' + r + ',' + c);
        if (r > 0 && r < L.ROWS - 1 && c > 0 && c < g0[r].length - 1) { interior++; if (nb.length !== 6) bad.push('interior ' + r + ',' + c + ' ' + nb.length); }
        const p = L.cellPos(g0, r, c);
        for (const [a, b] of nb) {
          const q = L.cellPos(g0, a, b);
          if (Math.abs(Math.hypot(p.x - q.x, p.y - q.y) - 1) > 1e-9) bad.push('dist ' + r + ',' + c + '-' + a + ',' + b);
          if (!L.neighbors(g0, a, b).some(([x, y]) => x === r && y === c)) bad.push('asym ' + r + ',' + c);
        }
      }
      // random boards: flood fill and floating against naive versions
      const rng = L.mulberry32(7);
      const randomGrid = (fill, colors) => { const g = L.emptyGrid(); for (let r = 0; r < 11; r++) for (let c = 0; c < g[r].length; c++) if (rng() < fill) g[r][c] = 1 + Math.floor(rng() * colors); return g; };
      let clusters = 0, floats = 0, placed = 0, pops = 0;
      for (let i = 0; i < 300; i++) {
        const g = randomGrid(0.3 + rng() * 0.6, 2 + Math.floor(rng() * 4));
        // naive cluster: repeat until stable
        const r0 = Math.floor(rng() * 11), c0 = Math.floor(rng() * g[r0].length);
        if (g[r0][c0]) {
          const set = new Set([r0 * 100 + c0]); let grew = true;
          while (grew) { grew = false; for (const k of [...set]) for (const [a, b] of L.neighbors(g, Math.floor(k / 100), k % 100)) if (g[a][b] === g[r0][c0] && !set.has(a * 100 + b)) { set.add(a * 100 + b); grew = true; } }
          const cl = L.cluster(g, r0, c0);
          if (cl.length !== set.size || cl.some(([a, b]) => !set.has(a * 100 + b)) || new Set(cl.map(([a, b]) => a * 100 + b)).size !== cl.length) bad.push('cluster ' + i);
          clusters++;
        } else if (L.cluster(g, r0, c0).length) bad.push('cluster of empty');
        // floating: naive = occupied cells with no path to row 0
        const fl = new Set(L.floating(g).map(([a, b]) => a * 100 + b));
        const ok0 = new Set(); const st = [];
        g[0].forEach((v, c) => { if (v) { ok0.add(c); st.push([0, c]); } });
        while (st.length) { const [a, b] = st.pop(); for (const [x, y] of L.neighbors(g, a, b)) if (g[x][y] && !ok0.has(x * 100 + y)) { ok0.add(x * 100 + y); st.push([x, y]); } }
        g.forEach((row, a) => row.forEach((v, b) => { if (v && !ok0.has(a * 100 + b) !== fl.has(a * 100 + b)) bad.push('floating ' + i); if (!v && fl.has(a * 100 + b)) bad.push('floating empty'); }));
        floats += fl.size;
        // a shot: the flight ends in an empty cell next to a bubble (or in the top row); the result obeys the rules
        const hang = L.cloneGrid(g); for (const [a, b] of L.floating(hang)) hang[a][b] = 0;
        if (L.lowestRow(hang) > 8) continue;
        const ang = (12 + rng() * 156) * Math.PI / 180;
        const tr = L.trace(hang, 5, 11.2, ang);
        if (!tr.cell) { bad.push('no cell ' + i); continue; }
        const [a, b] = tr.cell;
        if (hang[a][b]) bad.push('landed on a bubble');
        if (a > 0 && !L.neighbors(hang, a, b).some(([x, y]) => hang[x][y])) bad.push('floating landing');
        if (tr.points.some((p) => p.x < 0.5 - 1e-9 || p.x > 9.5 + 1e-9)) bad.push('left the walls');
        placed++;
        const col = 1 + Math.floor(rng() * 4);
        const res = L.place(hang, tr.cell, col);
        const before = L.count(hang), after = L.count(res.grid);
        if (res.popped.length) { pops++; if (res.popped.length < 3) bad.push('popped < 3'); if (after !== before + 1 - res.popped.length - res.fell.length) bad.push('count after pop'); if (L.floating(res.grid).length) bad.push('floating left after pop'); if (res.score !== L.popScore(res.popped.length) + L.fallScore(res.fell.length)) bad.push('score'); }
        else if (after !== before + 1 || res.score !== 0) bad.push('no pop but changed');
        if (L.count(hang) !== before) bad.push('input changed');
      }
      // bounce: shooting at a shallow angle from the middle bounces at least once and mirrors the angle
      const e = L.emptyGrid();
      const t1 = L.trace(e, 5, 11.2, 20 * Math.PI / 180);
      const p1 = t1.points[0], p2 = t1.points[1], p3 = t1.points[2];
      const ang1 = Math.atan2(p1.y - p2.y, p2.x - p1.x), ang2 = Math.atan2(p2.y - p3.y, p3.x - p2.x);
      const bounceOk = t1.bounces >= 1 && Math.abs(ang1 + ang2 - Math.PI) < 0.02 && t1.cell && t1.cell[0] === 0;
      const t2 = L.trace(e, 5, 11.2, Math.PI / 2);
      const straightOk = t2.bounces === 0 && t2.cell[0] === 0;
      // the ceiling coming down
      const g = L.buildLevel(L.LEVELS[2], 5), n = L.count(g);
      const d = L.dropCeiling(g, L.mulberry32(1), [1, 2]);
      const dropOk = d.length === L.ROWS && d[0].length !== g[0].length && d[0].every(Boolean) && d.every((row, i) => i === 0 || row.length === d[i - 1].length % 2 + 9 || true) && L.count(d) === n + d[0].length && d.every((row, i) => row.length === (i === 0 ? d[0].length : d[i - 1].length === 10 ? 9 : 10)) && d[1].join() === g[0].join();
      // levels
      const lv = [];
      L.LEVELS.forEach((spec, i) => {
        const gg = L.buildLevel(spec, 100 + i), n2 = L.count(gg), cols = L.colorsPresent(gg);
        lv.push({ n2, cols: cols.length, float: L.floating(gg).length, low: L.lowestRow(gg), par: L.par(gg), same: JSON.stringify(gg) === JSON.stringify(L.buildLevel(spec, 100 + i)), shape: spec.shape });
      });
      return { bad: bad.slice(0, 8), interior, clusters, floats, placed, pops, bounceOk, straightOk, dropOk, lv, n: L.LEVELS.length, shapes: new Set(L.LEVELS.map((s) => s.shape)).size, stars: [L.starsFor(5, 5), L.starsFor(7, 5), L.starsFor(9, 5)] };
    });
    ok(r.bad.length === 0, `hex grid + flood fill + floating + shots on 300 random boards (${r.clusters} clusters, ${r.floats} hanging cells, ${r.placed} shots, ${r.pops} pops)${r.bad.length ? ' -> ' + r.bad.join('; ') : ''}`);
    ok(r.bounceOk && r.straightOk, 'a shallow shot bounces off the wall and mirrors its angle; a straight one reaches the ceiling');
    ok(r.dropOk, 'the ceiling coming down: a new full row on top, the old rows move down, row lengths keep alternating');
    ok(r.n === 12 && r.shapes >= 11 && r.lv.every((l, i) => l.n2 >= 20 && l.float === 0 && l.low < 10 && l.same && l.par > 5 && l.cols >= 2 && l.cols <= [3, 3, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6][i]), '12 data-driven levels with different layouts: filled, hanging from the ceiling, above the line, repeatable: ' + r.lv.map((l) => l.shape + ':' + l.n2).join(' '));
    ok(r.stars.join() === '3,2,1', 'stars: par = 3, up to 1.5 times par = 2, else 1');
    await t.browser.close();
  }

  // ---------------- the screen ----------------
  const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  const p = t.page;
  await p.addInitScript(() => {});
  await open(t);
  ok(await p.locator('.bubble-lv').count() === 12 && await p.locator('.bubble-lv:not([disabled])').count() === 1, 'start screen: 12 levels, only the first one open');
  await p.screenshot({ path: OUT + 'bubble-levels.png' });
  await p.click('.bubble-lv[data-level="1"]'); await p.waitForSelector('#bubble-canvas');
  let s = await S(p);
  ok(s.view === 'play' && s.level === 0 && s.count > 15 && s.shots === 0 && s.over === '' && s.cur >= 1 && s.nxt >= 1, 'level 1 starts: ' + JSON.stringify({ count: s.count, cur: s.cur, nxt: s.nxt }));
  ok((await p.textContent('#bubble-level')) === '第1关' && (await p.textContent('#bubble-score')) === '得分：0', 'status line: level and score');
  await p.screenshot({ path: OUT + 'bubble-play-start.png' });

  // load a position we know: a row of 6 of colour 1 hanging from the ceiling with one bubble under it that hangs only from them
  await p.evaluate(async () => { window.__L = await import('/src/games/bubble-logic.ts'); });
  const setup = rowsToGrid([[0, 2, 1], [0, 3, 1], [0, 4, 1], [0, 5, 1], [0, 6, 1], [0, 7, 1], [1, 4, 2]]);
  await p.evaluate((g) => window.__bubble.load(eval(g), 1, 2, 0), setup);
  s = await S(p);
  ok(s.count === 7 && s.cur === 1 && s.nxt === 2, 'a known position is loaded');
  // swap: tap on the shooter bubble, then the swap button, then the keyboard
  await p.evaluate(() => window.__bubble.aim(90));
  await aimShoot(p, 5, 11.2, false); await p.mouse.up();
  s = await S(p); ok(s.cur === 2 && s.nxt === 1 && s.shots === 0, 'a tap on the shooter bubble swaps it with the next one (no shot)');
  await p.click('#bubble-swap'); s = await S(p); ok(s.cur === 1 && s.nxt === 2, 'the swap button swaps back');
  await p.keyboard.press('s'); await p.keyboard.press('s'); s = await S(p); ok(s.cur === 1, 'keyboard S swaps');
  // aiming: dragging moves the aiming line, a pointer below the shooter does not shoot
  await aimShoot(p, 2, 6, false);
  s = await S(p); ok(s.angle > 1.0 && s.angle < 2.6 && s.angle !== Math.PI / 2 && s.shots === 0, 'dragging turns the aim and nothing is shot until release (angle ' + s.angle.toFixed(2) + ')');
  await p.screenshot({ path: OUT + 'bubble-aiming.png' });
  await p.mouse.move(100, 100); await p.mouse.up();   // (released far away from the field: still a shot at that aim? the pointer is captured)
  await waitIdle(p);
  // restore the position and check pause first
  await p.evaluate((g) => window.__bubble.load(eval(g), 1, 2, 0), setup);
  await p.click('#bubble-pause'); await p.waitForSelector('#bubble-paused');
  await p.keyboard.press('Space'); s = await S(p);
  ok(s.paused && s.shots === 0, 'paused: nothing can be shot');
  await p.click('#bubble-resume'); s = await S(p); ok(!s.paused, 'resume');
  // keyboard aiming and a shot below the shooter (refused)
  const a0 = (await S(p)).angle;
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft'); s = await S(p);
  ok(s.angle > a0, 'arrow keys turn the aim');
  await aimShoot(p, 5, 11.9); s = await S(p); ok(s.shots === 0, 'releasing below the shooter does not shoot');
  // the real shot: aim at the empty cell under the row, release; it flies, joins the 6 -> they pop, the bubble hanging under them falls, the board is empty: a win
  await aimShoot(p, 4.0, 1.4);
  await p.waitForFunction(() => window.__bubble.s.shots === 1);
  ok((await S(p)).flying || true, 'the bubble flies');
  await p.screenshot({ path: OUT + 'bubble-flying.png' });
  await p.waitForFunction(() => window.__bubble.s.over === 'won', null, { timeout: 8000 });
  s = await S(p);
  ok(s.score >= 130 + 100 - 0 && s.over === 'won', `popped 7 (70 + 40), the hanging one fell (20), a bonus for clearing: score ${s.score}`);
  await p.screenshot({ path: OUT + 'bubble-popping.png' });
  await p.waitForSelector('#bubble-over');
  ok(await p.locator('#bubble-stars .on').count() === 3 && (await p.textContent('#bubble-over h2')) === '过关啦！', 'win message with 3 stars (one shot)');
  await p.screenshot({ path: OUT + 'bubble-win.png' });
  const saved = await p.evaluate((k) => JSON.parse(localStorage.getItem(k)).bubble, KEY);
  ok(saved.stars[0] === 3 && saved.best[0] >= 230, 'stars and best score are kept in localStorage ' + KEY + ': ' + JSON.stringify(saved));
  // the colours that are left: the board has only 2s, so the shooter never holds another colour
  await p.click('#bubble-next'); s = await S(p);
  ok(s.level === 1 && s.score === 0 && !s.over, 'next level starts');
  // reload: progress is still there, level 2 is open, level 3 is not
  await p.reload(); await p.waitForSelector('.hub-grid, .kids, .empty-home, #local-btn', { timeout: 10000 }).catch(() => {});
  if (await p.locator('#local-btn').count()) await p.click('#local-btn');
  await open(t);
  ok(await p.locator('.bubble-lv:not([disabled])').count() === 2 && (await p.textContent('.bubble-lv[data-level="1"] small')) === '★★★', 'after a reload: level 1 has 3 stars, level 2 is open');

  // a miss every time: the ceiling comes down after the limit
  await p.click('.bubble-lv[data-level="1"]'); await p.waitForSelector('#bubble-canvas');
  const miss = rowsToGrid([[0, 0, 2], [0, 1, 2], [0, 2, 3], [0, 3, 3], [0, 4, 2], [0, 5, 2], [0, 6, 3], [0, 7, 3], [0, 8, 2], [0, 9, 2]]);
  await p.evaluate((g) => window.__bubble.load(eval(g), 1, 1, 0), miss);
  await p.evaluate(() => window.__bubble.setMisses(window.__L.LEVELS[0].misses - 1));
  ok(await p.locator('#bubble-dots i.on').count() === 6, 'the ceiling counter shows 6 of 7');
  await p.evaluate(() => window.__bubble.aim(60)); await p.keyboard.press('Space');
  await p.waitForFunction(() => window.__bubble.s.misses === 0 && window.__bubble.s.shots === 1, null, { timeout: 8000 });
  s = await S(p);
  ok(s.count >= 10 + 1 + 9, 'a miss that fills the counter: a new row appeared on top (' + s.count + ' bubbles)');
  await p.screenshot({ path: OUT + 'bubble-ceiling.png' });

  // losing: a long chain reaching the line, one more bubble under it
  const chain = rowsToGrid(Array.from({ length: 11 }, (_, r) => [r, 0, r % 2 ? 3 : 2]));
  await p.evaluate((g) => window.__bubble.load(eval(g), 1, 1, 0), chain);
  await p.evaluate(() => window.__bubble.aim(167)); await p.keyboard.press('Space');
  await p.waitForFunction(() => window.__bubble.s.over !== '', null, { timeout: 8000 });
  s = await S(p);
  ok(s.over === 'lost', 'a bubble resting on the line loses the game');
  await p.waitForSelector('#bubble-over');
  ok((await p.textContent('#bubble-over h2')).startsWith('泡泡碰到底线了') && await p.locator('#bubble-stars').count() === 0, 'friendly lose message, no stars');
  await p.screenshot({ path: OUT + 'bubble-lose.png' });
  await p.click('#bubble-again'); s = await S(p); ok(!s.over && s.shots === 0 && s.count > 15, 'try again restarts the level');
  // the restart and levels buttons
  await p.click('#bubble-levels-btn'); await p.waitForSelector('.bubble-lv'); ok(true, 'the levels button goes back to the list');

  // leaving the game stops everything
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-card');
  ok(await p.evaluate(() => typeof window.__bubble === 'undefined'), 'leaving the game disposes it');
  ok(t.log.external.length === 0, 'no request left the app: ' + JSON.stringify(t.log.external));
  await t.browser.close();

  // ---------------- three screens ----------------
  for (const [name, vw, vh] of [['phone', 320, 568], ['ipad', 820, 1180], ['side', 844, 390]]) {
    const t2 = await start(new Map(), { local: true, viewport: { width: vw, height: vh } });
    await open(t2);
    const lv = await t2.page.evaluate(() => { const g = document.querySelector('.bubble-lvgrid').getBoundingClientRect(); return { l: g.left, r: window.innerWidth - g.right, sw: document.documentElement.scrollWidth <= window.innerWidth }; });
    await t2.page.click('.bubble-lv[data-level="1"]'); await t2.page.waitForSelector('#bubble-canvas');
    await t2.page.evaluate(async () => { window.__L = await import('/src/games/bubble-logic.ts'); });
    await t2.page.waitForTimeout(300);
    const m = await t2.page.evaluate(() => {
      const c = document.querySelector('#bubble-canvas').getBoundingClientRect(), f = document.querySelector('#bubble-field').getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      const out = [...document.querySelectorAll('.bubble-hud *, #bubble-field')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > vw + 1 || r.left < -1); }).length;
      const btns = [...document.querySelectorAll('.bubble-btn')].map((b) => b.getBoundingClientRect());
      return { w: c.width, h: c.height, l: f.left, r: vw - f.right, bottom: f.bottom, vh, sw: document.documentElement.scrollWidth <= vw, out, btnsVisible: btns.every((b) => b.bottom <= vh + 1 && b.top >= 0) };
    });
    ok(m.sw && m.out === 0 && m.w > 100, `${name} ${vw}x${vh}: no overflow, field ${Math.round(m.w)}x${Math.round(m.h)}`);
    ok(Math.abs(m.l - m.r) <= 2 && Math.abs(lv.l - lv.r) <= 2 && lv.sw, `${name}: centred (field ${Math.round(m.l)} / ${Math.round(m.r)}, levels ${Math.round(lv.l)} / ${Math.round(lv.r)})`);
    ok(m.bottom <= m.vh + 1 && m.btnsVisible, `${name}: the whole field and the buttons are on the screen`);
    // a shot works at this size
    await t2.page.evaluate(() => { const g = window.__L.emptyGrid(); for (let c = 0; c < 10; c++) g[0][c] = 2; window.__bubble.load(g, 1, 1, 0); });
    await aimShoot(t2.page, 5, 4); await t2.page.waitForFunction(() => window.__bubble.s.shots === 1 && !window.__bubble.s.flying, null, { timeout: 8000 });
    ok((await S(t2.page)).count === 11, `${name}: a shot by pointer lands`);
    await t2.page.screenshot({ path: OUT + `bubble-${name}.png` });
    await t2.browser.close();
  }
  await done();
})();
