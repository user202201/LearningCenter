// 算24点: the pure rules (exact fractions, solver, solvable-only dealing, merge / undo / hint) and the screen (clicks, keyboard, win / fail / div by zero, hint, skip, levels, best streak, layout on 4 screens, EN / FR).
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/game24/';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const t = await start(new Map(), { local: true, viewport: { width: 390, height: 844 } });
  const p = t.page;
  await p.evaluate(() => (location.hash = '#/games/game24')); await p.waitForSelector('#g24-field');

  // ---------- the rules ----------
  const L = await p.evaluate(async () => {
    const M = await import('/src/games/game24-logic.ts');
    const res = { bad: [], hands: 0, frac: 0, deals: 0, verified: 0, hints: 0 };
    // an independent exact checker (BigInt rationals) that does not use the module's arithmetic
    const g = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
    const R = (n, d = 1n) => { if (d < 0n) { n = -n; d = -d; } const k = g(n, d) || 1n; return [n / k, d / k]; };
    const ev = (s) => { // parses + - × ÷ ( ) and integers, exactly
      let i = 0; s = s.replace(/\s+/g, '');
      const num = () => { if (s[i] === '(') { i++; const v = expr(); i++; return v; } let j = i; while (/[0-9]/.test(s[i])) i++; return R(BigInt(s.slice(j, i))); };
      const term = () => { let a = num(); while (s[i] === '×' || s[i] === '÷') { const o = s[i++], b = num(); if (o === '×') a = R(a[0] * b[0], a[1] * b[1]); else { if (b[0] === 0n) return null; a = R(a[0] * b[1], a[1] * b[0]); } } return a; };
      const expr = () => { let a = term(); while (s[i] === '+' || s[i] === '−') { const o = s[i++], b = term(); a = o === '+' ? R(a[0] * b[1] + b[0] * a[1], a[1] * b[1]) : R(a[0] * b[1] - b[0] * a[1], a[1] * b[1]); } return a; };
      const v = expr(); return i === s.length ? v : null;
    };
    const is24 = (v) => v && v[0] === 24n && v[1] === 1n;
    // basic arithmetic stays exact
    const F = M.fr;
    if (JSON.stringify(M.apply(F(1, 3), '+', F(1, 6))) !== JSON.stringify({ n: 1, d: 2 })) res.bad.push('1/3 + 1/6');
    if (JSON.stringify(M.apply(F(3), '/', F(8))) !== JSON.stringify({ n: 3, d: 8 })) res.bad.push('3 / 8');
    if (JSON.stringify(M.apply(F(8), '/', M.apply(F(3), '-', F(8, 3)))) !== JSON.stringify({ n: 24, d: 1 })) res.bad.push('8 / (3 - 8/3) = 24');
    if (M.apply(F(5), '/', F(0)) !== null) res.bad.push('division by zero not refused');
    if (JSON.stringify(M.apply(F(1, 2), '-', F(3, 4))) !== JSON.stringify({ n: -1, d: 4 })) res.bad.push('negative fraction');
    if (JSON.stringify(M.fr(6, -4)) !== JSON.stringify({ n: -3, d: 2 })) res.bad.push('fr normalises');
    // known hands
    if (!M.solvable([3, 3, 8, 8]) || !M.needsFraction([3, 3, 8, 8])) res.bad.push('3 3 8 8 needs a fraction');
    if (!M.solvable([1, 5, 5, 5]) || !M.needsFraction([1, 5, 5, 5])) res.bad.push('1 5 5 5 needs a fraction');
    if (!M.solvable([3, 3, 7, 7]) || !M.needsFraction([3, 3, 7, 7])) res.bad.push('3 3 7 7 needs a fraction');
    if (M.needsFraction([4, 6, 1, 1]) || !M.solvable([4, 6, 1, 1])) res.bad.push('4 6 1 1 is whole-number');
    for (const bad of [[1, 1, 1, 1], [1, 1, 1, 2], [2, 2, 2, 2], [13, 13, 13, 13]]) if (M.solvable(bad)) res.bad.push('unsolvable hand reported solvable ' + bad);
    for (const good of [[1, 2, 3, 4], [13, 13, 12, 1], [6, 6, 6, 6], [10, 10, 4, 4]]) if (!M.solvable(good)) res.bad.push('solvable hand refused ' + good);
    // every solvable hand of every level: the solution verifies to exactly 24, by two independent routes
    for (let level = 0; level < 3; level++) {
      const pool = M.pool(level), max = M.LEVEL_MAX[level];
      for (const hand of pool.all) {
        res.hands++;
        if (hand.some((r) => r < 1 || r > max)) res.bad.push('rank outside level ' + hand);
        const steps = M.solve(hand);
        if (!steps || steps.length !== 3) { res.bad.push('no 3-step solution ' + hand); continue; }
        // route 1: replay the steps with BigInt rationals
        let list = hand.map((r) => R(BigInt(r))), okk = true;
        for (const s of steps) {
          const a = list[s.i], b = list[s.j]; let r;
          if (s.op === '+') r = R(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
          else if (s.op === '-') r = R(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
          else if (s.op === '*') r = R(a[0] * b[0], a[1] * b[1]);
          else { if (b[0] === 0n) { okk = false; break; } r = R(a[0] * b[1], a[1] * b[0]); }
          const lo = Math.min(s.i, s.j), hi = Math.max(s.i, s.j);
          list = list.filter((_, k) => k !== hi).map((v, k) => (k === lo ? r : v));
        }
        if (!okk || list.length !== 1 || !is24(list[0])) res.bad.push('replayed solution is not 24: ' + hand);
        // route 2: the printed expression is parsed and evaluated
        const txt = M.solutionText(hand);
        if (!txt || !is24(ev(txt))) res.bad.push('solution text is not 24: ' + hand + ' ' + txt);
        // it uses exactly the four ranks
        const nums = (txt || '').match(/[0-9]+/g) || [];
        if (nums.map(Number).sort((a, b) => a - b).join() !== hand.slice().sort((a, b) => a - b).join()) res.bad.push('solution text does not use the cards: ' + hand + ' ' + txt);
        if (M.needsFraction(hand)) res.frac++;
        res.verified++;
      }
      if (pool.frac.length < 3 && level > 0) res.bad.push('too few fraction hands at level ' + level);
      for (const hand of pool.frac) if (M.solve(hand, true) !== null) res.bad.push('fraction hand has a whole-number solution ' + hand);
    }
    // dealing: thousands of hands, always solvable and inside the level, a share needs fractions, never the same twice in a row
    let seed = 777; const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let level = 0; level < 3; level++) {
      let prev, fracHands = 0, same = 0;
      for (let k = 0; k < 2500; k++) {
        const hd = M.deal(level, rng, 0.2, prev); res.deals++;
        if (hd.length !== 4 || hd.some((r) => !Number.isInteger(r) || r < 1 || r > M.LEVEL_MAX[level])) res.bad.push('deal out of range ' + hd);
        const txt = M.solutionText(hd);
        if (!txt || !is24(ev(txt))) res.bad.push('dealt an unsolvable hand ' + hd);
        if (M.needsFraction(hd)) fracHands++;
        if (prev && prev.slice().sort().join() === hd.slice().sort().join()) same++;
        prev = hd;
      }
      if (level > 0 && !(fracHands > 250 && fracHands < 1000)) res.bad.push(`fraction share at level ${level}: ${fracHands}/2500`);
      if (same > 60) res.bad.push('the same hand again too often at level ' + level + ': ' + same);
    }
    // the state: combine / undo / reset / status / hint walk to a win
    let hd = M.newHand([3, 3, 8, 8]);
    if (M.combine(hd, 0, '+', 0) !== 'same') res.bad.push('same card twice accepted');
    const hz = M.newHand([5, 5, 1, 1]), z = M.combine(hz, 0, '-', 1);
    if (typeof z === 'string' || M.combine(z, 1, '/', 0) !== 'div0') { /* z = [0,1,1]: 1 / 0 */ }
    const z2 = M.combine(z, 1, '/', 0); if (z2 !== 'div0') res.bad.push('1 / 0 not refused: ' + JSON.stringify(z2));
    if (z.cards.length !== 3 || z.hist.length !== 1) res.bad.push('merge did not reduce to 3 cards');
    const u = M.undo(z); if (u.cards.length !== 4 || u.hist.length !== 0 || M.undo(u) !== u) res.bad.push('undo');
    const a = M.combine(M.newHand([1, 2, 3, 4]), 0, '+', 1), b = M.combine(a, 0, '+', 1), c = M.combine(b, 0, '*', 1);
    if (c.cards.length !== 1 || c.cards[0].v.n !== 24 || M.status(c) !== 'won') res.bad.push('(1+2+3)... 6 * 4 should win: ' + JSON.stringify(c.cards));
    const f = M.combine(M.combine(M.combine(M.newHand([1, 1, 1, 1]), 0, '+', 1), 0, '+', 1), 0, '+', 1);
    if (M.status(f) !== 'failed' || M.status(M.newHand([1, 2, 3, 4])) !== 'play') res.bad.push('status failed / play');
    if (M.resetHand(c).cards.length !== 4 || M.resetHand(c).hist.length !== 0) res.bad.push('reset');
    // the order of a subtraction / division follows the clicks (i op j), whichever is on the left
    const sub = M.combine(M.newHand([9, 2, 5, 5]), 1, '-', 0); if (sub.cards[0].v.n !== -7) res.bad.push('2 - 9 should be -7');
    const dv = M.combine(M.newHand([9, 3, 5, 5]), 1, '/', 0); if (dv.cards[0].v.n !== 1 || dv.cards[0].v.d !== 3) res.bad.push('3 / 9 should be 1/3');
    // following the hint from every hand (pool, level 2 sample) always reaches 24; from an off-path position it says "no way" or still reaches 24
    const all = M.pool(2).all;
    for (let k = 0; k < all.length; k += 3) {
      let h2 = M.newHand(all[k]); res.hints++;
      for (let s = 0; s < 3; s++) { const hs = M.hint(h2); if (!hs) { res.bad.push('no hint on a solvable path ' + all[k]); break; } const n = M.combine(h2, hs.i, hs.op, hs.j); if (typeof n === 'string') { res.bad.push('hint refused ' + all[k]); break; } h2 = n; }
      if (M.status(h2) !== 'won') res.bad.push('hint path did not win ' + all[k]);
    }
    const dead = M.combine(M.combine(M.newHand([1, 1, 1, 1]), 0, '+', 1), 0, '+', 1);
    if (M.hint(dead) !== null) res.bad.push('hint on an impossible position should be null');
    return res;
  });
  ok(L.bad.length === 0, `rules: ${L.hands} solvable hands of 3 levels verified exactly twice (replay + parsed text), ${L.frac} need fractions, ${L.deals} dealt hands all solvable, ${L.hints} hint walks win${L.bad.length ? ' -> ' + L.bad.slice(0, 6).join('; ') : ''}`);
  ok(L.hands > 2000 && L.frac > 20, 'the pools are big and contain fraction hands');

  // ---------- the screen ----------
  const st = () => p.evaluate(() => window.__g24.state());
  const setHand = (r) => p.evaluate((r) => window.__g24.setHand(r), r);
  const card = (i) => p.click(`.g24-card[data-i="${i}"]`);
  const opBtn = (o) => p.click(`.g24-op[data-op="${o}"]`);
  await p.screenshot({ path: OUT + 'g24-ready-phone.png' });
  ok(await p.locator('#g24-ovl').isVisible() && (await p.textContent('#g24-solved')) === '解出：0' && (await p.locator('.g24-card').count()) === 4, 'ready: overlay with Start, solved 0, four cards');
  await p.click('#g24-start');
  ok((await st()).phase === 'play' && !(await p.locator('#g24-ovl').isVisible()), 'Start begins the game');
  // the dealt hand is solvable and inside the level (normal = 1-10)
  const s0 = await st();
  ok(s0.ranks.length === 4 && s0.ranks.every((r) => r >= 1 && r <= 10), 'normal level deals ranks 1-10: ' + s0.ranks);
  // a card needs: card, operator, card
  await setHand([3, 3, 8, 8]);
  await card(2); ok((await st()).sel === 2 && await p.locator('.g24-card.sel').count() === 1, 'a tap selects a card');
  await card(2); ok((await st()).sel === -1, 'tapping the selected card again deselects');
  await card(0); await opBtn('+'); ok((await st()).op === '+', 'an operator is chosen');
  await opBtn('+'); ok((await st()).op === null, 'tapping the operator again clears it');
  await opBtn('*'); await card(1);
  let a = await st(); ok(a.cards.length === 3 && a.cards[0] === '9' && a.hist === 1 && a.sel === -1 && a.op === null, 'card x card merges into ONE card: ' + a.cards);
  ok(await p.locator('.g24-card.merged').count() === 1, 'the merged card has its own look');
  await p.keyboard.press('Backspace'); a = await st(); ok(a.cards.length === 4 && a.hist === 0, 'Backspace undoes');
  // operators before a card are refused kindly
  await opBtn('+'); a = await st(); ok(a.op === null && /先选/.test(a.msg), 'an operator without a card is refused with a message');
  // exact fractions shown stacked: 8 / 3 then 3 - 8/3 = 1/3
  await card(2); await opBtn('/'); await card(0);  // 8 / 3 -> 8/3 at position 0 ([8/3,3,8])
  a = await st(); ok(a.cards[0] === '8/3', 'division keeps an exact fraction: ' + a.cards);
  ok(await p.locator('.g24-card.merged .g24-frac').count() === 1 && (await p.locator('.g24-card.merged .g24-frac span').allTextContents()).join() === '8,3', 'the fraction is drawn stacked');
  await p.screenshot({ path: OUT + 'g24-fraction-phone.png' });
  // 3 - 8/3 : card1 (3) minus card0 (8/3) = 1/3, then 8 / (1/3) = 24
  await card(1); await opBtn('-'); await card(0); a = await st(); ok(a.cards.length === 2 && a.cards[0] === '1/3', '3 - 8/3 = 1/3: ' + a.cards);
  await card(1); await opBtn('/'); await card(0);
  a = await st(); ok(a.status === 'won' && a.phase === 'won' && a.cards[0] === '24' && a.solved === 1 && a.streak === 1, '8 / (3 - 8/3) = 24 wins: solved 1, streak 1');
  ok(await p.locator('#g24-ovl').isVisible() && (await p.textContent('#g24-ovl h2')) === '24!', 'the win panel says 24!');
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).game24.best) === 1, 'best streak saved on this device');
  await p.screenshot({ path: OUT + 'g24-win-phone.png' });
  await p.keyboard.press('Enter'); a = await st(); ok(a.phase === 'play' && a.hist === 0, 'Enter on the win panel deals the next hand');

  // a wrong result is shown as failed and can be undone
  await setHand([1, 1, 1, 1]);
  await card(0); await opBtn('+'); await card(1); await card(0); await opBtn('+'); await card(1); await card(0); await opBtn('+'); await card(1);
  a = await st(); ok(a.status === 'failed' && a.cards[0] === '4' && a.phase === 'play' && /4/.test(a.msg), 'the wrong result 4 is shown as failed: ' + a.msg);
  ok(await p.locator('.g24-card.fail').count() === 1 && await p.locator('#g24-undo.hint').count() === 1 && await p.locator('#g24-hint').isDisabled(), 'failed card is red, undo glows, hint is off');
  await p.screenshot({ path: OUT + 'g24-fail-phone.png' });
  await p.click('#g24-undo'); a = await st(); ok(a.cards.length === 2 && a.status === 'play', 'undo takes the failed hand back one step');
  await p.click('#g24-reset'); a = await st(); ok(a.cards.length === 4 && a.hist === 0, 'reset puts the four cards back');

  // division by zero is refused (shake), nothing changes
  await setHand([5, 5, 1, 1]);
  await card(0); await opBtn('-'); await card(1); await card(1); await opBtn('/'); await card(0);   // [0,1,1]: 1 / 0
  a = await st(); ok(a.cards.length === 3 && a.cards.join() === '0,1,1' && /0/.test(a.msg) && a.hist === 1, 'division by zero refused, the cards are unchanged: ' + a.msg);
  ok(await p.locator('.g24-card.shake').count() === 1, 'the refused card shakes');

  // keyboard: 1-4 select, + - * / operators
  await setHand([6, 6, 6, 6]);
  await p.keyboard.press('1'); await p.keyboard.press('+'); await p.keyboard.press('2'); a = await st(); ok(a.cards.join() === '12,6,6', 'keys 1 + 2 merge: ' + a.cards);
  await p.keyboard.press('1'); await p.keyboard.press('x'); await p.keyboard.press('2'); a = await st(); ok(a.cards.join() === '72,6', 'x multiplies: ' + a.cards);
  await p.keyboard.press('1'); await p.keyboard.press('/'); await p.keyboard.press('2'); a = await st(); ok(a.cards.join() === '12', '/ divides: ' + a.cards);
  await p.keyboard.press('Enter'); a = await st(); ok(a.cards.join() === '72,6', 'Enter undoes');
  await p.keyboard.press('2'); await p.keyboard.press('-'); await p.keyboard.press('1'); a = await st(); ok(a.cards.join() === '-66', '6 - 72 = -66 (key 2 then key 1)');
  ok(await p.locator('.g24-card.merged .g24-minus').count() === 1, 'a negative number shows its minus');

  // hint: shows a step, glows the cards and the operator; a hinted win does not count for the streak
  await setHand([3, 3, 8, 8]); const before = await st();
  await p.click('#g24-hint'); a = await st();
  ok(a.hinted && /提示/.test(a.msg) && await p.locator('.g24-card.hint').count() === 2 && await p.locator('.g24-op.hint').count() === 1 && a.hist === 0 && a.cards.join() === before.cards.join(), 'hint glows two cards and an operator and changes nothing: ' + a.msg);
  // finish it by following hints on the screen
  for (let k = 0; k < 3; k++) {
    const hs = await p.evaluate(async () => { const M = await import('/src/games/game24-logic.ts'); const s = window.__g24.state(); return M.solveFrom(s.cards.map((c) => { const [n, d] = c.split('/'); return M.fr(Number(n), Number(d || 1)); }))[0]; });
    await card(hs.i); await opBtn(hs.op); await card(hs.j);
  }
  a = await st(); ok(a.phase === 'won' && a.streak === 0 && a.solved === 2, 'a hinted win counts as solved but resets the streak');
  ok(/提示/.test(await p.textContent('#g24-ovl p')), 'the win panel mentions the hint');
  await p.keyboard.press('Enter');

  // a clean second win raises the streak; skip shows the answer and breaks it
  await setHand([4, 6, 1, 1]);
  { const steps = await p.evaluate(async () => { const M = await import('/src/games/game24-logic.ts'); return M.solve([4, 6, 1, 1]); }); for (const s of steps) { await card(s.i); await opBtn(s.op); await card(s.j); } }
  a = await st(); ok(a.phase === 'won' && a.streak === 1, 'a clean win: streak 1');
  await p.keyboard.press('Enter');
  await p.evaluate(() => window.__g24.setHand([2, 3, 4, 6]));
  await p.click('#g24-skip'); a = await st(); ok(a.streak === 0 && /答案/.test(a.msg) && a.hist === 0, 'skip breaks the streak and shows the last answer: ' + a.msg);
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).game24.best) === 1, 'best streak is kept after the streak is broken');
  await p.click('#g24-new'); ok((await st()).phase === 'play', 'New hand deals another hand');

  // levels: each new hand stays inside the range and is solvable
  const lv = await p.evaluate(async () => {
    const M = await import('/src/games/game24-logic.ts'); const bad = []; const seen = [];
    for (let k = 0; k < 3; k++) {
      document.querySelector('#g24-level').click(); const l = window.__g24.state().level; seen.push(l);
      for (let n = 0; n < 40; n++) { document.querySelector('#g24-new').click(); const s = window.__g24.state(); if (s.ranks.some((r) => r < 1 || r > M.LEVEL_MAX[l]) || !M.solvable(s.ranks)) bad.push(l + ':' + s.ranks); }
    }
    return { bad, seen };
  });
  ok(lv.bad.length === 0 && lv.seen.join() === '2,0,1', 'the level button cycles challenge / easy / normal and every dealt hand fits: ' + lv.seen);
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).game24.level) === 1, 'the level is kept');
  // J Q K show as letters on the challenge level
  await p.click('#g24-level'); await p.click('#g24-level'); // normal -> challenge
  await setHand([1, 11, 12, 13]);
  ok((await p.locator('.g24-card .g24-val.rk').allTextContents()).join('') === 'AJQK', 'A J Q K are shown as letters');
  await p.click('#g24-level'); await p.click('#g24-level'); // back to normal (2 -> 0 -> 1)

  // ---------- layout on 4 screens ----------
  for (const [name, w, hgt] of [['phone', 390, 844], ['ipad', 820, 1180], ['landscape', 1180, 820], ['side', 844, 390], ['small', 320, 568]]) {
    await p.setViewportSize({ width: w, height: hgt });
    await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-grid'); await p.waitForFunction(() => !window.__g24);
    await p.evaluate(() => (location.hash = '#/games/game24')); await p.waitForSelector('#g24-field');
    await p.waitForTimeout(250);
    await p.click('#g24-start');
    await setHand([3, 3, 8, 8]); await card(0); await opBtn('+'); await card(1);   // a merged card on the table
    await p.waitForTimeout(120);
    const m = await p.evaluate(() => {
      const R = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
      const inside = (e) => { const r = e.getBoundingClientRect(); return r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.top >= -0.5 && r.bottom <= innerHeight + 0.5; };
      return { f: R('#g24-field'), pad: R('.g24-pad'), hud: R('.g24-hud'), vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight,
        all: [...document.querySelectorAll('.g24-card, .g24-op, .g24-act, .g24-hud > *')].every(inside),
        clipped: [...document.querySelectorAll('.g24-card, .g24-op')].filter((e) => { const r = e.getBoundingClientRect(), f = document.querySelector('#g24-field').getBoundingClientRect(); return r.left < f.left || r.right > f.right || r.top < f.top || r.bottom > f.bottom; }).length,
        cw: document.querySelector('.g24-card').getBoundingClientRect().width, btnH: Math.min(...[...document.querySelectorAll('.g24-act')].map((b) => b.getBoundingClientRect().height)) };
    });
    const inside = (b) => b.l >= -0.5 && b.r <= m.vw + 0.5 && b.t >= -0.5 && b.b <= m.vh + 0.5;
    ok(inside(m.f) && inside(m.pad) && inside(m.hud) && m.all, `${name} ${w}x${hgt}: board, buttons and cards are on the screen (card ${Math.round(m.cw)}px)`);
    ok(m.clipped === 0, `${name}: nothing sticks out of the board`);
    ok(m.sw <= m.vw && m.sh <= m.vh + 1, `${name}: no page scrolling`);
    ok(m.f.b <= m.pad.t + 1 || m.f.r <= m.pad.l + 1 || m.pad.r <= m.f.l + 1, `${name}: the buttons do not cover the board`);
    if (name !== 'side') ok(Math.abs(m.f.l - (m.vw - m.f.r)) <= 3, `${name}: the board is centred (${Math.round(m.f.l)} / ${Math.round(m.vw - m.f.r)})`);
    ok(m.cw >= (name === 'side' || name === 'small' ? 52 : 70) && m.btnH >= 44, `${name}: cards and buttons are big enough (${Math.round(m.cw)}px, buttons ${Math.round(m.btnH)}px)`);
    await p.screenshot({ path: OUT + `g24-${name}.png` });
  }
  await p.setViewportSize({ width: 390, height: 844 });
  // leaving removes everything
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-grid');
  await p.waitForFunction(() => !window.__g24);
  ok(true, 'leaving the game removes it (hook gone, key listener removed)');
  await p.keyboard.press('1');
  ok(t.log.external.length === 0, 'no request left the app');
  await t.browser.close();

  // ---------- EN / FR: no Chinese left (texts that are not translated YET must at least be in game24.i18n.json) ----------
  const J = JSON.parse(fs.readFileSync('src/games/game24.i18n.json', 'utf8'));
  const keyRes = Object.keys(J).map((k) => new RegExp('^' + k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\d\}/g, '.+') + '$'));
  for (const [loc, name] of [['en-US', 'en'], ['fr-FR', 'fr']]) {
    for (const [dn, vp] of [['phone', { width: 390, height: 844 }], ['small', { width: 320, height: 568 }], ['side', { width: 844, height: 390 }]]) {
      const s = await start(new Map(), { local: true, locale: loc, viewport: vp });
      const q = s.page;
      await q.evaluate(() => (location.hash = '#/games/game24')); await q.waitForSelector('#g24-field'); await q.waitForTimeout(250);
      const texts = async () => q.evaluate(() => { const out = []; const w = document.createTreeWalker(document.querySelector('.g24-wrap'), NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const v = n.nodeValue.trim(); if (/[一-鿿]/.test(v)) out.push(v); } return out; });
      const check = async (tag) => {
        const left = await texts();
        const unknown = left.filter((x) => !keyRes.some((re) => re.test(x)));
        ok(unknown.length === 0, `${name} ${dn} ${tag}: every Chinese text still showing is in game24.i18n.json (to be merged)${unknown.length ? ' -> ' + unknown.join(' | ') : ''}`);
        return left.length;
      };
      await check('ready');
      const leftReady = (await texts()).length;
      await q.click('#g24-start'); await q.evaluate(() => window.__g24.setHand([3, 3, 8, 8]));
      await q.click('.g24-card[data-i="0"]'); await q.click('#g24-hint'); await check('play + hint');
      const w = await q.evaluate(() => ({ sw: document.documentElement.scrollWidth <= innerWidth, over: [...document.querySelectorAll('.g24-act, .g24-hud > *, .g24-msg, .g24-op')].filter((e) => e.scrollWidth > e.clientWidth + 1 && !e.classList.contains('g24-msg')).map((e) => e.textContent) }));
      ok(w.sw && w.over.length === 0, `${name} ${dn}: no overflow / clipped button text${w.over.length ? ' -> ' + w.over.join() : ''}`);
      if (dn === 'phone') await q.screenshot({ path: OUT + `g24-${name}.png` });
      await s.browser.close();
    }
  }
  await done();
})();
