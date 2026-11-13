// Memory cards: the pure rules (deals, matching, moves, win, stars, the miss / third-tap rule), the screen (pointer, keyboard, win, best, restart, sizes), layout on 4 screens, EN / FR.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const T = JSON.parse(fs.readFileSync('src/games/memory.i18n.json', 'utf8'));

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  const p = t.page;
  await p.evaluate(() => (location.hash = '#/games/memory')); await p.waitForSelector('#mem-grid');

  // ---------- the rules ----------
  const L = await p.evaluate(async () => {
    const M = await import('/src/games/memory-logic.ts');
    const A = await import('/src/games/memory-art.ts');
    const res = { bad: [], games: 0, flips: 0, wins: 0 };
    const rng = M.seeded(777);
    if (A.ANIMAL_ART.length < 18 || new Set(A.ANIMAL_ART.map((a) => a.art)).size !== A.ANIMAL_ART.length || A.ANIMAL_ART.length !== M.ANIMAL_TOTAL) res.bad.push('animals: need 18 different drawings');
    if (M.SIZES.map((z) => z.id).join() !== '3x4,4x4,4x5,5x6') res.bad.push('sizes');
    const a1 = M.deal(M.SIZES[1], M.seeded(5)), a2 = M.deal(M.SIZES[1], M.seeded(5)), a3 = M.deal(M.SIZES[1], M.seeded(6));
    if (a1.cards.join() !== a2.cards.join()) res.bad.push('same seed must give the same deal');
    if (a1.cards.join() === a3.cards.join()) res.bad.push('different seeds must give different deals');
    for (const z of M.SIZES) for (let k = 0; k < 40; k++) {
      const s = M.deal(z, rng), cnt = {};
      if (s.cards.length !== z.rows * z.cols) res.bad.push('card count ' + z.id);
      for (const c of s.cards) cnt[c] = (cnt[c] || 0) + 1;
      if (Object.values(cnt).some((n) => n !== 2) || Object.keys(cnt).length !== s.cards.length / 2) res.bad.push('every animal on exactly two cards ' + z.id);
      if (s.cards.some((c) => c < 0 || c >= M.ANIMAL_TOTAL)) res.bad.push('animal range');
    }
    // scripted: match, miss, third tap resolves the miss at once
    const s = M.deal(M.SIZES[0], M.seeded(1));
    const pos = (a, not = -1) => s.cards.findIndex((c, i) => c === a && i !== not);
    const a = s.cards[0], i2 = pos(a, 0), other = s.cards.findIndex((c) => c !== a);
    if (M.flip(s, 0).kind !== 'first' || s.moves !== 0) res.bad.push('first flip');
    if (M.flip(s, 0).kind !== 'ignored') res.bad.push('same card twice must be ignored');
    if (M.flip(s, i2).kind !== 'match' || s.moves !== 1 || !s.matched[0] || !s.matched[i2] || s.pairs !== 1 || s.pending.length) res.bad.push('match');
    if (M.flip(s, 0).kind !== 'ignored') res.bad.push('a matched card is not flipped again');
    const b = s.cards[other], other2 = s.cards.findIndex((c, i) => c !== b && !s.matched[i] && i !== other);
    M.flip(s, other); let r = M.flip(s, other2);
    if (r.kind !== 'miss' || s.moves !== 2 || !s.up[other] || !s.up[other2]) res.bad.push('miss keeps both cards up');
    if (M.flip(s, 0).kind !== 'ignored') res.bad.push('matched ignored during a miss');
    const third = s.cards.findIndex((c, i) => !s.up[i] && !s.matched[i]);
    r = M.flip(s, third);
    if (r.kind !== 'first' || !r.resolved || r.resolved.length !== 2 || s.up[other] || s.up[other2] || !s.up[third] || s.pending.length !== 1) res.bad.push('a third tap turns the pair back and starts a new try');
    if (M.resolve(s).length !== 0) res.bad.push('resolve with one card pending');
    // stars
    if (M.stars(6, 6) !== 3 || M.stars(10, 6) !== 3 || M.stars(11, 6) !== 2 || M.stars(16, 6) !== 2 || M.stars(17, 6) !== 1 || M.stars(100, 6) !== 1) res.bad.push('stars thresholds');
    for (const pairs of [6, 8, 10, 15]) { let prev = 4; for (let m = pairs; m < pairs * 5; m++) { const st = M.stars(m, pairs); if (st > prev) res.bad.push('stars must not rise with more moves'); prev = st; } }
    if (M.fmtTime(65) !== '1:05' || M.fmtTime(9) !== '0:09') res.bad.push('fmtTime');
    // fuzz: random players (with the miss timer replaced by "resolve when asked"), then a perfect player
    for (let g = 0; g < 300; g++) {
      const z = M.SIZES[g % 4], st = M.deal(z, rng); res.games++;
      for (let i = 0; i < 2000 && !st.won; i++) {
        const free = st.cards.map((_, j) => j).filter((j) => !st.matched[j]);
        const j = free[Math.floor(rng() * free.length)], before = st.moves, bp = st.pairs;
        const rr = M.flip(st, j); res.flips++;
        if (rng() < 0.4) M.resolve(st);
        if (st.moves < before || st.moves > before + 1 || st.pairs < bp) res.bad.push('moves / pairs go only up');
        if (st.pending.length > 2) res.bad.push('more than two pending');
        if (rr.kind === 'match' && st.cards.filter((c, k) => st.matched[k]).length !== st.pairs * 2) res.bad.push('matched count');
        if (st.matched.some((m, k) => m && !st.up[k])) res.bad.push('matched but down');
        if (st.up.filter((u, k) => u && !st.matched[k]).length !== st.pending.length) res.bad.push('up cards = matched + pending');
        if (res.bad.length > 5) break;
      }
      if (st.won) res.wins++;
      if (st.won && (st.pairs !== st.cards.length / 2 || !st.matched.every(Boolean))) res.bad.push('won with cards left');
    }
    for (const z of M.SIZES) { const st = M.deal(z, rng), seen = {}; for (let j = 0; j < st.cards.length; j++) { if (seen[st.cards[j]] !== undefined) { M.flip(st, seen[st.cards[j]]); M.flip(st, j); } else seen[st.cards[j]] = j; } if (!st.won || st.moves !== st.cards.length / 2) res.bad.push('a perfect memory wins in exactly n/2 moves ' + z.id + ' ' + st.moves); if (M.flip(st, 0).kind !== 'ignored') res.bad.push('no flip after the win'); }
    return res;
  });
  ok(L.bad.length === 0, `rules: ${L.games} random games, ${L.flips} flips, ${L.wins} won, all invariants hold${L.bad.length ? ' -> ' + L.bad.slice(0, 6).join('; ') : ''}`);
  ok(L.wins === L.games, 'the fuzz players all finish');

  // ---------- the screen ----------
  const st = () => p.evaluate(() => { const s = window.__memory.state(); return { moves: s.moves, pairs: s.pairs, pending: s.pending.slice(), cards: s.cards.slice(), matched: s.matched.slice(), won: s.won, phase: window.__memory.phase(), n: s.cards.length }; });
  const cardsDom = () => p.evaluate(() => [...document.querySelectorAll('.mem-card')].map((c) => c.dataset.state));
  const clickCard = (i) => p.click(`.mem-card[data-i="${i}"]`);
  const pairOf = async () => { const s = await st(); const i = 0; return [i, s.cards.findIndex((c, k) => c === s.cards[0] && k !== 0)]; };
  const wrongPair = async () => { const s = await st(); const j = s.cards.findIndex((c) => c !== s.cards[0]); return [0, j]; };
  ok(await p.locator('#mem-ovl').isVisible() && (await p.textContent('#mem-moves')) === '步数：0' && (await p.textContent('#mem-time')) === '用时：0:00' && (await p.textContent('#mem-best')) === '最少：-', 'ready: overlay with Start, moves 0, time 0:00, no best yet');
  ok((await p.locator('.mem-card').count()) === 12 && (await p.getAttribute('#mem-size-3x4', 'class')).includes('on'), 'the easy size 3x4 = 12 cards is selected first');
  await p.screenshot({ path: OUT + 'memory-ready.png' });
  await p.click('#mem-start');
  ok(!(await p.locator('#mem-ovl').isVisible()) && (await st()).phase === 'play', 'Start hides the overlay');
  // a wrong pair stays up, then flips back by itself
  let [a, b] = await wrongPair();
  await clickCard(a); await clickCard(b);
  let dom = await cardsDom(); let s = await st();
  ok(dom[a] === 'up' && dom[b] === 'up' && s.moves === 1 && s.pending.length === 2, 'two different animals: both stay up for a moment, one move counted');
  ok((await p.textContent('#mem-moves')) === '步数：1', 'the moves pill follows');
  await p.waitForTimeout(1000);
  dom = await cardsDom(); ok(dom[a] === 'down' && dom[b] === 'down' && (await st()).pending.length === 0, 'the wrong pair flips back by itself after about 0.8 s');
  // a third tap resolves the pair at once
  await clickCard(a); await clickCard(b);
  const c3 = (await st()).cards.findIndex((c, k) => k !== a && k !== b);
  await clickCard(c3); dom = await cardsDom(); s = await st();
  ok(dom[a] === 'down' && dom[b] === 'down' && dom[c3] === 'up' && s.pending.length === 1 && s.moves === 2, 'a tap on a third card turns the pair back at once and turns the third up');
  await p.waitForTimeout(1000);
  ok((await cardsDom())[c3] === 'up', 'the timer of the old pair does not turn the new card back');
  // a right pair stays
  const partner = (await st()).cards.findIndex((c, k) => c === s.cards[c3] && k !== c3);
  await clickCard(partner); dom = await cardsDom(); s = await st();
  ok(dom[c3] === 'done' && dom[partner] === 'done' && s.pairs === 1 && s.moves === 3, 'two equal animals are collected (they stay turned up)');
  await clickCard(c3); ok((await st()).moves === 3, 'a tap on a collected card does nothing');
  await p.screenshot({ path: OUT + 'memory-play.png' });
  // keyboard: arrows move, Enter turns
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowDown');
  const cur = await p.evaluate(() => window.__memory.cur()), cols = await p.evaluate(() => window.__memory.cols());
  ok(cur === 1 + cols && await p.locator('.mem-card.cur').count() === 1, 'arrow keys move the yellow frame: card ' + cur);
  // win the game by keyboard + pointer, with the timer
  const tm = await p.textContent('#mem-time');
  const sNow = await st(); const seen = {};
  const order = [];
  sNow.cards.forEach((c, k) => { if (sNow.matched[k]) return; if (seen[c] !== undefined) order.push([seen[c], k]); else seen[c] = k; });
  await p.waitForTimeout(50);
  for (let q = 0; q < order.length - 1; q++) { await clickCard(order[q][0]); await clickCard(order[q][1]); }
  ok((await st()).pairs === 5 && !(await st()).won, 'five pairs done, not won yet');
  // last pair by keyboard
  const [x, y] = order[order.length - 1];
  await clickCard(x);
  // move the frame to y with the keyboard
  const cc = await p.evaluate(() => window.__memory.cols());
  const target = { x: y % cc, y: Math.floor(y / cc) };
  for (let i = 0; i < 12; i++) await p.keyboard.press('ArrowLeft');
  for (let i = 0; i < 12; i++) await p.keyboard.press('ArrowUp');
  for (let i = 0; i < target.x; i++) await p.keyboard.press('ArrowRight');
  for (let i = 0; i < target.y; i++) await p.keyboard.press('ArrowDown');
  ok((await p.evaluate(() => window.__memory.cur())) === y, 'the frame reaches the last card by keys');
  await p.keyboard.press('Enter');
  s = await st(); ok(s.won && s.phase === 'won' && s.pairs === 6, 'the last pair (turned with Enter) wins the game');
  await p.waitForFunction(() => window.__memory.finished() === 1, null, { timeout: 4000 });
  const ov = await p.evaluate(() => ({ h: document.querySelector('#mem-ovl h2').textContent, st: document.querySelectorAll('#mem-stars span:not(.off)').length, all: document.querySelectorAll('#mem-stars span').length, vis: !document.querySelector('#mem-ovl').hidden, txt: document.querySelector('#mem-ovl p').textContent }));
  ok(ov.vis && ov.h === '完成。' && ov.all === 3 && ov.st >= 1 && ov.st <= 3 && ov.txt.includes(String(s.moves)), `win overlay: stars ${ov.st}/3, "${ov.txt}"`);
  await p.screenshot({ path: OUT + 'memory-win.png' });
  const bestV = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).memory['best-3x4']);
  ok(bestV === s.moves && (await p.textContent('#mem-best')) === `最少：${s.moves}`, 'the fewest moves is kept on this device: ' + bestV);
  const time1 = await p.textContent('#mem-time'); await p.waitForTimeout(1300);
  ok((await p.textContent('#mem-time')) === time1, 'the clock stops at the win');
  // play again: a new deal; a worse game does not replace the best
  await p.click('#mem-start');
  s = await st(); ok(s.phase === 'ready' && s.moves === 0 && s.pairs === 0 && (await cardsDom()).every((d) => d === 'down') && (await p.textContent('#mem-best')) === `最少：${bestV}`, 'play again: new cards, all down, the best stays');
  await p.keyboard.press('Enter');
  s = await st(); ok(s.phase === 'play', 'Enter starts');
  [a, b] = await wrongPair(); await clickCard(a); await clickCard(b);
  await p.waitForTimeout(1000);
  await p.click('#mem-new');
  ok((await st()).moves === 0 && (await st()).phase === 'ready', 'Restart makes a new game any time');
  // sizes
  for (const [id, n, cs] of [['4x4', 16], ['4x5', 20], ['5x6', 30], ['3x4', 12]]) {
    await p.click(`#mem-size-${id}`);
    const got = await p.evaluate(() => ({ n: document.querySelectorAll('.mem-card').length, on: document.querySelector('.mem-hud .mopt.on').id, size: JSON.parse(localStorage.getItem('learn.games.v1')).memory.size }));
    ok(got.n === n && got.on === `mem-size-${id}`, `size ${id}: ${n} cards`);
  }
  await p.click('#mem-size-4x5');
  ok((await p.textContent('#mem-best')) === '最少：-', 'every size has its own best');
  await p.click('#mem-size-4x5');
  await p.click('#mem-start');
  // win a whole 4x5 by pointer (a random seed: pair every card), then check best for 4x5
  { const s5 = await st(); const seen5 = {}; for (let k = 0; k < s5.n; k++) { const c = s5.cards[k]; if (seen5[c] !== undefined) { await clickCard(seen5[c]); await clickCard(k); } else seen5[c] = k; }
    ok((await st()).won && (await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).memory['best-4x5'])) === 10, '4x5: a perfect game = 10 moves = the best for that size'); }
  await p.waitForFunction(() => window.__memory.finished() === 1);
  ok((await p.evaluate(() => document.querySelectorAll('#mem-stars span:not(.off)').length)) === 3, 'a perfect game gets three stars');
  await p.click('#mem-size-3x4');
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).memory.size) === 0, 'the chosen size is kept');

  // ---------- layout on 4 screens ----------
  for (const [name, w, hgt] of [['phone', 390, 844], ['ipad', 820, 1180], ['land', 1180, 820], ['side', 844, 390], ['small', 320, 568]]) {
    await p.setViewportSize({ width: w, height: hgt });
    for (const id of ['3x4', '5x6']) {
      await p.evaluate(() => (location.hash = '#/subject/games')); await p.evaluate(() => (location.hash = '#/games/memory')); await p.waitForSelector('#mem-grid');
      await p.click(`#mem-size-${id}`); await p.waitForTimeout(250);
      const m = await p.evaluate(() => {
        const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
        const f = R(document.querySelector('#mem-field')), hud = R(document.querySelector('.mem-hud'));
        const cs = [...document.querySelectorAll('.mem-card')].map(R);
        return { f, hud, vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, minC: Math.min(...cs.map((c) => c.w)), ratio: Math.max(...cs.map((c) => Math.max(c.w / c.h, c.h / c.w))), cellsIn: cs.every((c) => c.l >= f.l && c.r <= f.r && c.t >= f.t && c.b <= f.b), btns: [...document.querySelectorAll('.mem-hud > *')].every((b) => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }) };
      });
      const inside = (b) => b.l >= -0.5 && b.r <= m.vw + 0.5 && b.t >= -0.5 && b.b <= m.vh + 0.5;
      ok(inside(m.f) && inside(m.hud) && m.btns && m.cellsIn, `${name} ${w}x${hgt} ${id}: board, HUD and every card are on the screen (cards ${Math.round(m.minC)}px)`);
      ok(m.sw <= m.vw && m.sh <= m.vh + 1, `${name} ${id}: no page scrolling`);
      ok(m.ratio < 1.1, `${name} ${id}: the cards are square (ratio ${m.ratio.toFixed(2)})`);
      ok(m.f.b <= m.hud.t + 1 || m.f.l >= m.hud.r - 1 || m.hud.l >= m.f.r - 1 || m.hud.b <= m.f.t + 1, `${name} ${id}: the HUD does not cover the board`);
      if (name !== 'side') ok(Math.abs(m.f.l - (m.vw - m.f.r)) <= 3, `${name} ${id}: the board is centred (${Math.round(m.f.l)} / ${Math.round(m.vw - m.f.r)})`);
      ok(m.minC >= (id === '5x6' ? 38 : 60) - (name === 'side' ? 12 : 0), `${name} ${id}: cards big enough for a finger (${Math.round(m.minC)}px)`);
      if (id === '5x6') await p.screenshot({ path: OUT + `memory-${name}-hard.png` });
      else await p.screenshot({ path: OUT + `memory-${name}.png` });
    }
  }
  // leaving removes it
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-grid');
  await p.waitForFunction(() => !window.__memory);
  ok(true, 'leaving the game removes it (the hook is gone)');
  ok(t.log.external.length === 0, 'no request left the app');
  await t.browser.close();

  // ---------- EN / FR ----------
  ok(Object.keys(T).every((k) => k.length > 1 && Array.isArray(T[k]) && T[k].length === 2 && T[k].every((v) => v && !/[一-鿿]/.test(v))), 'memory.i18n.json: every text has a clean EN and FR entry, no one-character keys');
  for (const [loc, name] of [['en-US', 'en'], ['fr-FR', 'fr']]) {
    const e = await start(new Map(), { local: true, locale: loc, viewport: { width: 390, height: 844 } });
    const q = e.page;
    await q.evaluate(() => (location.hash = '#/games/memory')); await q.waitForSelector('#mem-grid'); await q.waitForTimeout(200);
    const cjk = () => q.evaluate(() => /[一-鿿]/.test(document.querySelector('main').textContent));
    ok(!(await cjk()), `${name}: no Chinese left on the start screen`);
    await q.click('#mem-start');
    const s2 = await q.evaluate(() => { const s = window.__memory.state(); return s.cards.slice(); });
    const seen = {};
    for (let k = 0; k < s2.length; k++) { if (seen[s2[k]] !== undefined) { await q.click(`.mem-card[data-i="${seen[s2[k]]}"]`); await q.click(`.mem-card[data-i="${k}"]`); } else seen[s2[k]] = k; }
    await q.waitForFunction(() => window.__memory.finished() === 1, null, { timeout: 4000 });
    ok(!(await cjk()), `${name}: no Chinese left on the win screen, nor in the pills`);
    const wrapped = await q.evaluate(() => [...document.querySelectorAll('.mem-hud > *')].filter((b) => b.scrollWidth > b.clientWidth + 1).length);
    ok(wrapped === 0, `${name}: no pill or button is clipped`);
    await q.screenshot({ path: OUT + `memory-${name}.png` });
    await e.browser.close();
  }
  await done();
})();
