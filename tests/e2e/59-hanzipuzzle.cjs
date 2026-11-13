// 汉字笔画 (stroke puzzle): the list of characters (every one has a stroke file, the right stroke count for its level), the pure rules (writing order, snapping,
// mistakes), the screen (both modes, tap-tap / drag / keyboard, rounds, stars, best score, "show the order", failed loading), layout on 4 screens, EN / FR.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });

// ---------- the list of characters, read from the files of the app ----------
const CH = JSON.parse(fs.readFileSync('src/games/hanzipuzzle-chars.json', 'utf8'));
const RANGE = { easy: [2, 6], normal: [7, 10], hard: [11, 14] };
const files = {};
const strokesOf = (c) => { const k = (c.codePointAt(0) >> 8).toString(16); files[k] ??= JSON.parse(fs.readFileSync(`public/strokes/${k}.json`, 'utf8')); return files[k][c] || null; };
const DATA = {};   // char -> strokes, for the pure tests
(() => {
  const seen = new Set(); let total = 0;
  for (const lv of Object.keys(RANGE)) {
    const cs = [...CH[lv]]; total += cs.length;
    const bad = []; const dup = [];
    for (const c of cs) {
      const s = strokesOf(c);
      if (!s || s.length < 1) { bad.push(c + ':nofile'); continue; }
      DATA[c] = s;
      if (s.length < RANGE[lv][0] || s.length > RANGE[lv][1]) bad.push(c + ':' + s.length);
      if (seen.has(c)) dup.push(c); seen.add(c);
    }
    ok(bad.length === 0 && dup.length === 0, `${lv}: ${cs.length} characters, each has a stroke file with ${RANGE[lv][0]}-${RANGE[lv][1]} strokes, no duplicates${bad.length ? ' -> bad ' + bad.join() : ''}${dup.length ? ' dup ' + dup.join() : ''}`);
    ok(cs.length >= 20 && cs.every((c) => /[一-鿿]/.test(c)), `${lv}: enough characters (${cs.length}), all Chinese characters`);
  }
  ok(total >= 150, `about 150 or more characters in all (${total})`);
  ok(fs.existsSync('public/strokes/ARPHICPL.TXT'), 'the licence text of the stroke data is still there');
})();

(async () => {
  // ---------- failed loading first (the strokes are blocked): a gentle message, then it works ----------
  {
    const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
    const p = t.page;
    await p.route('**/strokes/*.json', (r) => r.abort());
    await p.evaluate(() => (location.hash = '#/games/hanzipuzzle')); await p.waitForSelector('#hz-field');
    await p.click('#hz-start');
    await p.waitForFunction(() => window.__hanzi.failed());
    ok((await p.evaluate(() => window.__hanzi.phase())) === 'ready' && await p.locator('#hz-ovl').isVisible() && (await p.textContent('#hz-ovl p')).includes('没能加载') && (await p.textContent('#hz-start')) === '再试一次', 'strokes cannot be loaded: a friendly message and a retry button, no crash');
    await p.unroute('**/strokes/*.json');
    await p.click('#hz-start');
    await p.waitForFunction(() => window.__hanzi.phase() === 'play');
    ok(await p.evaluate(() => window.__hanzi.n() >= 2), 'the retry works once the files can be read');
    await t.browser.close();
  }

  const t = await start(new Map(), { local: true, viewport: { width: 820, height: 1180 } });
  const p = t.page;
  await p.evaluate(() => (location.hash = '#/games/hanzipuzzle')); await p.waitForSelector('#hz-field');

  // ---------- the pure rules ----------
  const R = await p.evaluate(async (DATA) => {
    const M = await import('/src/games/hanzipuzzle-logic.ts');
    const res = { bad: [], games: 0, wrongs: 0, drops: 0 };
    let seed = 99; const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const chars = Object.keys(DATA);
    // lists
    for (const lv of M.LEVELS) {
      for (let k = 0; k < 60; k++) {
        const r = M.pickRound(lv, rng);
        if (r.length !== 5 || new Set(r).size !== 5 || r.some((c) => !M.CHARS[lv].includes(c))) res.bad.push('round ' + lv);
      }
    }
    if (M.levelOf(6) !== 'easy' || M.levelOf(7) !== 'normal' || M.levelOf(10) !== 'normal' || M.levelOf(11) !== 'hard' || M.levelOf(14) !== 'hard' || M.levelOf(15) !== null) res.bad.push('levelOf');
    // scramble: a permutation, never the writing order
    for (let n = 2; n <= 14; n++) for (let k = 0; k < 40; k++) {
      const s = M.scramble(n, rng);
      if ([...s].sort((a, b) => a - b).some((v, i) => v !== i) || s.every((v, i) => v === i)) res.bad.push('scramble ' + n);
    }
    // boxes of every character: inside the board, not empty
    const boxes = {};
    for (const c of chars) {
      boxes[c] = DATA[c].map(M.pathBox);
      for (const b of boxes[c]) if (!(b.x1 > b.x0 && b.y1 > b.y0 && b.x0 >= -5 && b.y0 >= -5 && b.x1 <= 1030 && b.y1 <= 1030)) res.bad.push('box ' + c);
    }
    // writing order: the right sequence finishes without a mistake
    for (const c of chars) {
      const n = DATA[c].length, s = M.newOrder(n);
      for (let i = 0; i < n; i++) { if (M.isDone(s)) res.bad.push('done early'); if (M.tryOrder(s, i) !== 'ok') res.bad.push('right stroke refused ' + c); }
      if (!M.isDone(s) || s.mistakes !== 0) res.bad.push('order not done ' + c);
      if (M.tryOrder(s, 0) !== 'ignored') res.bad.push('after the end');
    }
    // random picks: every wrong pick is one mistake and nothing moves; finishing is always possible
    for (let g = 0; g < 400; g++) {
      const n = 2 + Math.floor(rng() * 13), s = M.newOrder(n); let wrong = 0, guard = 0; res.games++;
      while (!M.isDone(s) && guard++ < 500) {
        const i = Math.floor(rng() * n), before = s.next, r = M.tryOrder(s, i);
        if (r === 'wrong') { wrong++; res.wrongs++; if (s.next !== before || i === before) res.bad.push('wrong moved'); }
        if (r === 'ok' && (i !== before || s.next !== before + 1)) res.bad.push('ok but not the next');
        if (r === 'ignored' && !(s.placed[i])) res.bad.push('ignored a free stroke');
      }
      if (!M.isDone(s) || s.mistakes !== wrong) res.bad.push('order game ' + g);
    }
    // tolerance and snapping
    for (const c of chars) for (const b of boxes[c]) {
      const tol = M.tolerance(b), ctr = M.centerOf(b);
      if (tol < 95 || tol > 170) res.bad.push('tolerance');
      if (!M.snaps(b, ctr) || !M.snaps(b, { x: ctr.x + tol * 0.9, y: ctr.y }) || M.snaps(b, { x: ctr.x + tol * 1.2, y: ctr.y }) || M.snaps(b, { x: ctr.x, y: ctr.y - tol * 1.2 })) res.bad.push('snaps ' + c);
    }
    // assemble: any order, jitter inside the tolerance is fine; outside is a mistake; off the board is nothing
    for (const c of chars) {
      const n = DATA[c].length, b = boxes[c], s = M.newAssemble(n);
      const order = M.shuffle(Array.from({ length: n }, (_, i) => i), rng);
      for (const i of order) {
        const ctr = M.centerOf(b[i]), tol = M.tolerance(b[i]);
        // a point that is far from every place (a stroke that looks the same may be put on the other's place, so those are not 'far')
        let pt = null;
        for (let a2 = 0; a2 < 16 && !pt; a2++) for (const dd of [1.6 * tol + 30, 2.5 * tol + 60]) { const q = { x: ctr.x + Math.cos(a2 * 0.4) * dd, y: ctr.y + Math.sin(a2 * 0.4) * dd }; if (!b.some((bb, k) => !s.filled[k] && M.snaps(bb, q))) { pt = q; break; } }
        if (pt) { const far = M.tryAssemble(s, i, pt, b); if (far.r !== 'wrong') res.bad.push('far drop accepted ' + c); else res.wrongs++; }
        if (M.tryAssemble(s, i, null, b).r !== 'ignored') res.bad.push('off board counted');
        const a = rng() * 6.28, d = tol * 0.7 * rng();
        const r = M.tryAssemble(s, i, { x: ctr.x + Math.cos(a) * d, y: ctr.y + Math.sin(a) * d }, b); res.drops++;
        if (r.r !== 'ok') res.bad.push('near drop refused ' + c + i);
        if (M.tryAssemble(s, i, ctr, b).r !== 'ignored') res.bad.push('placed twice');
      }
      if (!M.isDone(s) || !s.filled.every(Boolean) || !s.used.every(Boolean)) res.bad.push('assemble not finished ' + c + ' mistakes ' + s.mistakes);
    }
    // two strokes that look the same may swap places and the pieces still all find a place
    const bx = [{ x0: 100, y0: 100, x1: 400, y1: 130 }, { x0: 100, y0: 500, x1: 405, y1: 528 }, { x0: 600, y0: 600, x1: 640, y1: 900 }];
    const sw = M.newAssemble(3);
    const c1 = M.centerOf(bx[1]);
    const r1 = M.tryAssemble(sw, 0, c1, bx);
    if (r1.r !== 'ok' || r1.home !== 1) res.bad.push('swap not accepted');
    const r2 = M.tryAssemble(sw, 1, M.centerOf(bx[0]), bx);
    if (r2.r !== 'ok' || r2.home !== 0) res.bad.push('swap partner cannot find its place');
    if (M.tryAssemble(sw, 2, M.centerOf(bx[0]), bx).r !== 'wrong') res.bad.push('different shape accepted on a taken place');
    if (M.tryAssemble(sw, 2, M.centerOf(bx[2]), bx).r !== 'ok' || !M.isDone(sw)) res.bad.push('swap game not finished');
    // score
    if (M.stars([0, 1, 0, 0, 2]) !== 3 || M.stars([1, 1]) !== 0 || !M.isBest(3, 2) || M.isBest(2, 2)) res.bad.push('stars / best');
    return res;
  }, DATA);
  ok(R.bad.length === 0, `pure rules: ${R.games} random order games, ${R.wrongs} wrong picks / drops, ${R.drops} drops, every character in order and assemble mode${R.bad.length ? ' -> ' + R.bad.slice(0, 8).join(' | ') : ''}`);

  // ---------- the screen: order mode ----------
  const H = (fn, ...a) => p.evaluate(fn, ...a);
  const nextIdx = () => H(() => window.__hanzi.next());
  const tapPlace = async (i) => { await p.click(`.hz-tile[data-s="${i}"]`); await p.click('#hz-field'); };
  const finishChar = async () => { while ((await H(() => window.__hanzi.phase())) === 'play') { await tapPlace(await nextIdx()); } };
  ok(await p.locator('#hz-ovl').isVisible() && (await p.textContent('#hz-ovl h2')) === '汉字笔画' && (await p.textContent('#hz-start')) === '开始', 'ready: the overlay with the name and a start button');
  ok((await p.textContent('#hz-mode')) === '方式：按笔顺' && (await p.textContent('#hz-level')) === '难度：简单' && (await p.textContent('#hz-score')) === '得分：0' && (await p.textContent('#hz-best')) === '最高：0' && (await p.textContent('#hz-prog')) === '第 1 / 5 个', 'ready: the stat pills and option buttons');
  ok(await p.locator('#hz-count').isHidden(), 'ready: no stroke count yet');
  await p.click('#hz-start'); await p.waitForFunction(() => window.__hanzi.phase() === 'play');
  let a = await H(() => ({ n: window.__hanzi.n(), tray: window.__hanzi.tray(), ch: window.__hanzi.char(), chars: window.__hanzi.chars(), tiles: document.querySelectorAll('.hz-tile').length }));
  ok(a.chars.length === 5 && new Set(a.chars).size === 5 && a.tiles === a.n && a.n >= 2 && a.n <= 6, `play: 5 characters, ${a.n} tiles for ${a.ch} (easy: up to 6 strokes)`);
  ok(a.tray.some((v, i) => v !== i) && [...a.tray].sort((x, y) => x - y).every((v, i) => v === i), 'the tiles are scrambled (not in writing order)');
  ok((await p.textContent('#hz-count')) === `共 ${a.n} 画` && await p.locator('#hz-ovl').isHidden(), 'the stroke count is shown');
  // a wrong stroke: shake, a mistake, nothing placed
  const wrongTile = async () => H(() => { const nx = window.__hanzi.next(); return window.__hanzi.tray().find((s) => s !== nx && !document.querySelector(`.hz-tile[data-s="${s}"]`).classList.contains('gone')); });
  let w = await wrongTile();
  await p.click(`.hz-tile[data-s="${w}"]`); await p.click('#hz-field');
  a = await H(() => ({ m: window.__hanzi.mistakes(), placed: window.__hanzi.placed(), sel: window.__hanzi.selected(), shake: !!document.querySelector('.hz-tile.shake') }));
  ok(a.m === 1 && a.placed === 0 && a.shake && a.sel === -1 && (await p.textContent('#hz-miss')) === '错误：1', 'a wrong stroke: a gentle shake, one mistake, nothing placed');
  w = await wrongTile();
  await p.click(`.hz-tile[data-s="${w}"]`); await p.click(`.hz-tile[data-s="${w}"]`);   // second tap = put it on the board (wrong again)
  ok((await H(() => window.__hanzi.mistakes())) === 2, 'tapping a chosen stroke again puts it on the board (a wrong one counts)');
  // select, then tap the board
  let nx = await nextIdx();
  await p.click(`.hz-tile[data-s="${nx}"]`);
  ok((await H(() => window.__hanzi.selected())) === nx && await p.locator(`.hz-tile.sel[data-s="${nx}"]`).count() === 1, 'a tap chooses a stroke (highlighted)');
  await p.click('#hz-field');
  a = await H(() => ({ placed: window.__hanzi.placed(), next: window.__hanzi.next(), gone: document.querySelectorAll('.hz-tile.gone').length }));
  ok(a.placed === 1 && a.next === 1 && a.gone === 1, 'choose the next stroke, tap the board: it snaps in (placed 1)');
  // drag
  nx = await nextIdx();
  if ((await H(() => window.__hanzi.n())) > 2) {
    const tb = await p.locator(`.hz-tile[data-s="${nx}"]`).boundingBox(), fb = await p.locator('#hz-field').boundingBox();
    await p.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2); await p.mouse.down();
    await p.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2, { steps: 8 });
    ok(await p.locator('.hz-ghost path').count() === 1 && await p.locator(`.hz-tile.drag-src[data-s="${nx}"]`).count() === 1, 'while dragging the stroke follows the finger (ghost)');
    await p.mouse.up();
    ok((await H(() => window.__hanzi.placed())) === 2, 'dragging the next stroke onto the board puts it in');
    // dragged to the empty place under the board: nothing happens
    nx = await nextIdx();
    const tb2 = await p.locator(`.hz-tile[data-s="${nx}"]`).boundingBox(), m0 = await H(() => window.__hanzi.mistakes());
    await p.mouse.move(tb2.x + 10, tb2.y + 10); await p.mouse.down(); await p.mouse.move(tb2.x + 14, tb2.y + 80, { steps: 4 }); await p.mouse.move(tb2.x + 16, tb2.y + 12, { steps: 4 }); await p.mouse.up();
    ok((await H(() => window.__hanzi.placed())) === 2 && (await H(() => window.__hanzi.mistakes())) === m0, 'a drag that ends off the board changes nothing (no mistake)');
  }
  // keyboard: Tab / Enter takes the stroke, Enter puts it down
  nx = await nextIdx();
  await p.focus(`.hz-tile[data-s="${nx}"]`);
  const placed0 = await H(() => window.__hanzi.placed());
  await p.keyboard.press('Enter');
  ok((await H(() => window.__hanzi.selected())) === nx && (await H(() => window.__hanzi.placed())) === placed0, 'keyboard: Enter takes the stroke');
  await p.keyboard.press('Enter');
  ok((await H(() => window.__hanzi.placed())) === placed0 + 1, 'keyboard: Enter again puts it on the board');
  // finish the character
  await finishChar();
  a = await H(() => ({ phase: window.__hanzi.phase(), n: window.__hanzi.n(), placed: window.__hanzi.placed(), r: window.__hanzi.results(), sp: document.querySelectorAll('.hz-spark').length, faint: document.querySelectorAll('.hz-faint path').length }));
  ok(a.phase === 'done' && a.placed === a.n && a.r[0] === 2 && a.sp > 5 && a.faint === 0, 'all strokes in: the character is complete with sparkles, 2 mistakes noted');
  ok(await p.locator('#hz-next').isVisible() && (await p.textContent('#hz-next')) === '下一个' && (await p.textContent('#hz-score')) === '得分：0' && (await p.textContent('#hz-count')) === `共 ${a.n} 画`, 'the next button appears; no star for a character with mistakes; the stroke count stays');
  await p.screenshot({ path: OUT + 'hanzi-done.png' });
  // "show the order" (reduced motion: all at once)
  await p.click('#hz-show');
  ok((await H(() => window.__hanzi.animCount())) === a.n + 0 && await p.locator('.hz-anim path').count() === a.n, 'show me the order (reduced motion): all strokes are shown at once');
  await p.waitForFunction(() => window.__hanzi && window.__hanzi.animCount() === 0, null, { timeout: 4000 });
  ok(!(await p.locator('#hz-show').isDisabled()), '... and it goes away by itself');
  // the rest of the round: clean characters
  await p.click('#hz-next');
  for (let k = 1; k < 5; k++) {
    await p.waitForFunction((k) => window.__hanzi.phase() === 'play' && window.__hanzi.idx() === k, k);
    const info = await H(() => ({ n: window.__hanzi.n(), ch: window.__hanzi.char() }));
    ok(info.n >= 2 && info.n <= 6 && info.n === (DATA[info.ch] || []).length, `character ${k + 1}: ${info.ch} has ${info.n} strokes (matches its file)`);
    if (k === 1) { ok((await p.textContent('#hz-prog')) === '第 2 / 5 个' && (await p.textContent('#hz-miss')) === '错误：0', 'the next character: counter moves on, mistakes back to 0'); }
    await finishChar();
    if (k === 4) ok((await p.textContent('#hz-next')) === '看结果', 'the last character: the button says see result');
    await p.click('#hz-next');
  }
  await p.waitForFunction(() => window.__hanzi.phase() === 'over');
  ok((await p.textContent('#hz-ovl h2')) === '太棒了！' && (await p.textContent('#hz-ovl p')) === '新纪录：4' && await p.locator('#hz-ovl').isVisible(), 'end: 4 stars of 5 (the first character had mistakes): wonderful, new record');
  ok((await p.textContent('#hz-score')) === '得分：4' && (await p.textContent('#hz-best')) === '最高：4', 'end: score 4, best 4');
  const store = () => p.evaluate(() => JSON.parse(localStorage.getItem('learn.games.v1')).hanzipuzzle);
  ok((await store())['best-order-easy'] === 4, 'the best score is kept on this device (learn.games.v1)');
  // a worse round does not lower the best: one mistake on every character = 0 stars
  await p.click('#hz-start'); 
  for (let k = 0; k < 5; k++) {
    await p.waitForFunction((k) => window.__hanzi.phase() === 'play' && window.__hanzi.idx() === k, k);
    const w2 = await wrongTile(); await p.click(`.hz-tile[data-s="${w2}"]`); await p.click('#hz-field');
    await finishChar(); await p.click('#hz-next');
  }
  await p.waitForFunction(() => window.__hanzi.phase() === 'over');
  ok((await p.textContent('#hz-ovl h2')) === '再加油！' && (await p.textContent('#hz-ovl p')) === '得分：0 / 5' && (await store())['best-order-easy'] === 4 && (await p.textContent('#hz-best')) === '最高：4', 'a round with a mistake on every character: 0 stars, keep going, the best stays 4');

  // ---------- levels: the characters have the right number of strokes ----------
  for (const [lv, name, lo, hi] of [['normal', '难度：普通', 7, 10], ['hard', '难度：较难', 11, 14]]) {
    await p.click('#hz-level');
    ok((await p.textContent('#hz-level')) === name && (await H(() => window.__hanzi.phase())) === 'ready', `level button: ${name} (a new game is ready)`);
    await p.click('#hz-start');
    const seen = [];
    for (let k = 0; k < 5; k++) {
      await p.waitForFunction((k) => window.__hanzi.phase() === 'play' && window.__hanzi.idx() === k, k);
      seen.push(await H(() => ({ n: window.__hanzi.n(), ch: window.__hanzi.char(), tiles: document.querySelectorAll('.hz-tile').length })));
      await finishChar(); await p.click('#hz-next');
    }
    await p.waitForFunction(() => window.__hanzi.phase() === 'over');
    ok(seen.every((s) => s.n >= lo && s.n <= hi && s.tiles === s.n), `${lv}: strokes ${seen.map((s) => s.n).join(',')} are within ${lo}-${hi}`);
    ok((await store())[`best-order-${lv}`] === 5 && (await store()).level === lv, `${lv}: a perfect round = 5 stars, saved per level; the level is remembered`);
  }

  // ---------- assemble mode ----------
  await p.click('#hz-level'); // back to easy
  await p.click('#hz-mode');
  ok((await p.textContent('#hz-mode')) === '方式：拼汉字' && (await store()).mode === 'assemble' && (await p.textContent('#hz-ovl p')).includes('拖到田字格'), 'assemble: the mode button, the new instructions, remembered');
  await p.click('#hz-start'); await p.waitForFunction(() => window.__hanzi.phase() === 'play');
  const farAway = async (i) => H((i) => { const b = window.__hanzi.boxes()[i], c = window.__hanzi.home(i), f = document.querySelector('#hz-field').getBoundingClientRect(); const px = (f.width / 1024); const left = c.x - f.left > f.width / 2; return { x: left ? f.left + 20 * px + 6 : f.right - 26 * px, y: f.bottom - 10 }; }, i);
  const dragTo = async (i, pt) => {
    const tb = await p.locator(`.hz-tile[data-s="${i}"]`).boundingBox();
    await p.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2); await p.mouse.down(); await p.mouse.move(pt.x, pt.y, { steps: 6 }); await p.mouse.up();
  };
  const home = (i) => H((i) => window.__hanzi.home(i), i);
  let n = await H(() => window.__hanzi.n());
  let first = await H(() => window.__hanzi.tray()[0]);
  // wrong place on the board -> mistake; ghost gone; tile still there
  const bx = await H(() => window.__hanzi.boxes());
  const fieldB = await p.locator('#hz-field').boundingBox();
  const hc = await home(first);
  const wx = hc.x < fieldB.x + fieldB.width / 2 ? fieldB.x + fieldB.width * 0.92 : fieldB.x + fieldB.width * 0.08, wy = hc.y < fieldB.y + fieldB.height / 2 ? fieldB.y + fieldB.height * 0.92 : fieldB.y + fieldB.height * 0.08;
  await dragTo(first, { x: wx, y: wy });
  a = await H(() => ({ m: window.__hanzi.mistakes(), placed: window.__hanzi.placed(), ghost: document.querySelectorAll('.hz-ghost path').length, shake: !!document.querySelector('.hz-tile.shake') }));
  ok(a.m === 1 && a.placed === 0 && a.ghost === 0 && a.shake, 'assemble: dropping a stroke in the wrong place = a mistake and a shake, the stroke goes back');
  // off board: nothing
  const tb = await p.locator(`.hz-tile[data-s="${first}"]`).boundingBox();
  await p.mouse.move(tb.x + 8, tb.y + 8); await p.mouse.down(); await p.mouse.move(tb.x + 12, tb.y + 60, { steps: 4 }); await p.mouse.up();
  ok((await H(() => window.__hanzi.mistakes())) === 1, 'assemble: dropping off the board is no mistake');
  // right place by drag (any order: take the LAST tile of the tray first)
  const lastTile = await H(() => window.__hanzi.tray().slice(-1)[0]);
  await dragTo(lastTile, await home(lastTile));
  ok((await H(() => window.__hanzi.placed())) === 1 && await p.locator(`.hz-tile.gone[data-s="${lastTile}"]`).count() === 1, 'assemble: a stroke dragged onto its place snaps in (any order)');
  // tap-select, tap its place
  const mid = await H(() => window.__hanzi.tray().filter((s) => !document.querySelector(`.hz-tile[data-s="${s}"]`).classList.contains('gone'))[0]);
  await p.click(`.hz-tile[data-s="${mid}"]`);
  const hm = await home(mid); await p.mouse.click(hm.x + 3, hm.y + 3);
  ok((await H(() => window.__hanzi.placed())) === 2, 'assemble: choose a stroke, tap its place on the board: it snaps in');
  // keyboard: choose, arrows move it, Enter puts it down
  const kb = await H(() => window.__hanzi.tray().filter((s) => !document.querySelector(`.hz-tile[data-s="${s}"]`).classList.contains('gone'))[0]);
  if (kb !== undefined && (await H(() => window.__hanzi.n())) > 2) {
    await p.focus(`.hz-tile[data-s="${kb}"]`); await p.keyboard.press('Enter');
    ok(await p.locator('.hz-ghost path').count() === 1, 'assemble keyboard: Enter takes the stroke (a ghost appears on the board)');
    const target = await H((i) => { const b = window.__hanzi.boxes()[i]; return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }; }, kb);
    let cx = 512, cy = 512;
    for (let g = 0; g < 40 && (Math.abs(cx - target.x) > 20 || Math.abs(cy - target.y) > 20); g++) {
      const key = Math.abs(cx - target.x) > 20 ? (cx < target.x ? 'ArrowRight' : 'ArrowLeft') : (cy < target.y ? 'ArrowDown' : 'ArrowUp');
      await p.keyboard.press(key); cx += key === 'ArrowRight' ? 32 : key === 'ArrowLeft' ? -32 : 0; cy += key === 'ArrowDown' ? 32 : key === 'ArrowUp' ? -32 : 0;
    }
    const pb = await H(() => window.__hanzi.placed());
    await p.keyboard.press('Enter');
    ok((await H(() => window.__hanzi.placed())) === pb + 1, 'assemble keyboard: arrows move the stroke, Enter puts it down in its place');
  }
  // the rest of the character
  const dropAll = async () => {
    for (let g = 0; g < 20 && (await H(() => window.__hanzi.phase())) === 'play'; g++) {
      const s = await H(() => window.__hanzi.tray().find((s) => !document.querySelector(`.hz-tile[data-s="${s}"]`).classList.contains('gone')));
      if (s === undefined) break;
      await dragTo(s, await home(s));
    }
  };
  await dropAll();
  a = await H(() => ({ phase: window.__hanzi.phase(), r: window.__hanzi.results(), placed: window.__hanzi.placed(), n: window.__hanzi.n() }));
  ok(a.phase === 'done' && a.placed === a.n && a.r[0] === 1, 'assemble: all strokes in = done (1 mistake noted)');
  await p.click('#hz-next');
  for (let k = 1; k < 5; k++) { await p.waitForFunction((k) => window.__hanzi.phase() === 'play' && window.__hanzi.idx() === k, k); await dropAll(); await p.click('#hz-next'); }
  await p.waitForFunction(() => window.__hanzi.phase() === 'over');
  ok((await p.textContent('#hz-ovl p')) === '新纪录：4' && (await store())['best-assemble-easy'] === 4, 'assemble: 4 stars saved under its own best');
  // hard + assemble: the silhouette is hidden (harder); "show me the order" still helps
  await p.click('#hz-level'); await p.click('#hz-level');
  ok((await p.textContent('#hz-level')) === '难度：较难', 'level hard');
  await p.click('#hz-start'); await p.waitForFunction(() => window.__hanzi.phase() === 'play');
  ok(await p.locator('.hz-faint path').count() === 0 && await p.locator('.hz-tile').count() >= 11, 'hard assemble: no faint outline, 11-14 loose strokes');
  await p.click('#hz-show');
  ok(await p.locator('.hz-anim path').count() === (await H(() => window.__hanzi.n())), 'show me the order works in assemble mode too');
  // leaving removes the game
  await p.evaluate(() => (location.hash = '#/subject/games')); await p.waitForSelector('.gm-grid');
  await p.waitForFunction(() => !window.__hanzi);
  ok(true, 'leaving the game removes the hook and the listeners');
  ok(await p.locator('#gm-hanzipuzzle').count() === 1 && (await p.locator('#gm-hanzipuzzle svg').count()) >= 1, 'the card in the list of games has its picture');
  ok(t.log.external.length === 0, 'no request left the app');
  await t.browser.close();

  // ---------- "show me the order" with motion: one stroke after the other ----------
  {
    const s = await start(new Map(), { local: true, motion: true, viewport: { width: 820, height: 1180 } });
    const q = s.page;
    await q.evaluate(() => (location.hash = '#/games/hanzipuzzle')); await q.waitForSelector('#hz-field');
    await q.click('#hz-start'); await q.waitForFunction(() => window.__hanzi.phase() === 'play');
    const n = await q.evaluate(() => window.__hanzi.n());
    await q.click('#hz-show');
    const c0 = await q.evaluate(() => window.__hanzi.animCount());
    await q.waitForTimeout(250 + 520 * 1 + 120); const c1 = await q.evaluate(() => window.__hanzi.animCount());
    await q.waitForFunction((n) => window.__hanzi && window.__hanzi.animCount() === n, n, { timeout: 8000 });
    ok(c0 === 0 && c1 >= 1 && c1 < n + 1 && (n < 3 || c1 < n), `show me the order (with motion): 0 strokes at first, ${c1} after a moment, then all ${n}, one by one`);
    ok(await q.locator('#hz-show').isDisabled(), 'while it plays the button is off');
    await q.waitForFunction(() => window.__hanzi && window.__hanzi.animCount() === 0, null, { timeout: 8000 });
    ok(!(await q.locator('#hz-show').isDisabled()) && (await q.evaluate(() => window.__hanzi.phase())) === 'play', 'then the board is back and the game goes on');
    await s.browser.close();
  }

  // ---------- layout on 4 screens, both modes ----------
  const t2 = await start(new Map(), { local: true, viewport: { width: 390, height: 844 } });
  const q = t2.page;
  for (const [name, w, hgt] of [['phone', 390, 844], ['ipad', 820, 1180], ['wide', 1180, 820], ['side', 844, 390], ['small', 320, 568]]) {
    for (const mode of ['order', 'assemble']) {
      await q.setViewportSize({ width: w, height: hgt });
      await q.evaluate((mode) => { localStorage.setItem('learn.games.v1', JSON.stringify({ hanzipuzzle: { mode, level: 'hard' } })); location.hash = '#/subject/games'; }, mode);
      await q.evaluate(() => (location.hash = '#/games/hanzipuzzle')); await q.waitForSelector('#hz-field');
      await q.waitForTimeout(150);
      if (mode === 'order') await q.screenshot({ path: OUT + `hanzi-${name}-ready.png` });
      await q.click('#hz-start'); await q.waitForFunction(() => window.__hanzi.phase() === 'play');
      // a few strokes in, so that the picture shows colours
      if (mode === 'order') { for (let k = 0; k < 3; k++) { const nx = await q.evaluate(() => window.__hanzi.next()); await q.click(`.hz-tile[data-s="${nx}"]`); await q.locator('#hz-field').click({ position: { x: 20, y: 20 } }); } }
      else { for (let k = 0; k < 3; k++) { const s = await q.evaluate(() => window.__hanzi.tray().find((s) => !document.querySelector(`.hz-tile[data-s="${s}"]`).classList.contains('gone'))); const hc = await q.evaluate((i) => window.__hanzi.home(i), s); const tb = await q.locator(`.hz-tile[data-s="${s}"]`).boundingBox(); await q.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2); await q.mouse.down(); await q.mouse.move(hc.x, hc.y, { steps: 5 }); await q.mouse.up(); } }
      await q.waitForTimeout(100);
      const m = await q.evaluate(() => {
        const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
        const f = R(document.querySelector('#hz-field')), hud = R(document.querySelector('.hz-hud')), tray = R(document.querySelector('.hz-tray'));
        const tiles = [...document.querySelectorAll('.hz-tile:not(.gone)')].map(R);
        return { f, hud, tray, tiles, vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, btns: [...document.querySelectorAll('.hz-hud button, .hz-hud span')].every((b) => { const r = b.getBoundingClientRect(); return r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.top >= -0.5 && r.bottom <= innerHeight + 0.5; }) };
      });
      const inside = (b) => b.l >= -0.5 && b.r <= m.vw + 0.5 && b.t >= -0.5 && b.b <= m.vh + 0.5;
      const tag = `${name} ${w}x${hgt} ${mode}`;
      ok(inside(m.f) && inside(m.hud) && m.tiles.every(inside) && m.btns, `${tag}: board, pills, buttons and tiles are on the screen (board ${Math.round(m.f.w)}px, ${m.tiles.length} tiles)`);
      ok(m.sw <= m.vw && m.sh <= m.vh + 1, `${tag}: no page scrolling`);
      ok(m.tiles.every((x) => x.w >= 40 && x.h >= 40), `${tag}: tiles are big enough to touch (${Math.round(Math.min(...m.tiles.map((x) => x.w)))}px)`);
      const overlap = (a, b) => !(a.r <= b.l + 1 || b.r <= a.l + 1 || a.b <= b.t + 1 || b.b <= a.t + 1);
      ok(!overlap(m.f, m.tray) && !overlap(m.f, m.hud) && m.tiles.every((x) => !overlap(m.f, x)), `${tag}: the board, the pills and the tiles do not cover each other`);
      if (name !== 'side') ok(Math.abs(m.f.l - (m.vw - m.f.r)) <= 3, `${tag}: the board is centred (${Math.round(m.f.l)} / ${Math.round(m.vw - m.f.r)})`);
      else ok(m.f.l > 150 && m.vw - m.f.r > 150, `${tag}: pills on one side, tiles on the other`);
      ok(m.f.w >= (name === 'side' ? 140 : name === 'small' ? 150 : 250), `${tag}: the board is big enough (${Math.round(m.f.w)}px)`);
      await q.screenshot({ path: OUT + `hanzi-${name}-${mode}.png` });
    }
  }
  await t2.browser.close();

  // ---------- EN / FR: no Chinese left (texts not merged YET must be in hanzipuzzle.i18n.json) ----------
  const J = JSON.parse(fs.readFileSync('src/games/hanzipuzzle.i18n.json', 'utf8'));
  ok(Object.keys(J).every((k) => k.length > 1 && Array.isArray(J[k]) && J[k].length === 2 && J[k].every((v) => v && !/[一-鿿]/.test(v))), 'hanzipuzzle.i18n.json: every text has a clean EN and FR entry, no one-character keys');
  for (const [loc, name] of [['en-US', 'en'], ['fr-FR', 'fr']]) {
    for (const [dn, vp] of [['phone', { width: 390, height: 844 }], ['small', { width: 320, height: 568 }], ['side', { width: 844, height: 390 }]]) {
      const s = await start(new Map(), { local: true, locale: loc, viewport: vp });
      const r = s.page;
      // the texts of this game are not merged into src/i18n-data.ts yet: add them to the table the page loads (the merge does the same for good)
      const idx = name === 'en' ? 0 : 1;
      const extra = `\nObject.assign(${name === 'en' ? 'EN' : 'FR'}, ${JSON.stringify(Object.fromEntries(Object.entries(J).map(([k, v]) => [k, v[idx]])))});\n`;
      await r.route(/\/src\/i18n-data\.ts/, async (route) => { const resp = await route.fetch(); await route.fulfill({ response: resp, body: (await resp.text()) + extra }); });
      await r.reload(); await r.waitForTimeout(500);
      await r.evaluate(() => (location.hash = '#/games/hanzipuzzle')); await r.waitForSelector('#hz-field'); await r.waitForTimeout(250);
      const texts = async () => r.evaluate(() => { const out = []; const w = document.createTreeWalker(document.querySelector('.hz-wrap'), NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const v = n.nodeValue.trim(); if (/[一-鿿]/.test(v)) out.push(v); } return out; });
      const check = async (tag) => {
        const unknown = await texts();
        ok(unknown.length === 0, `${name} ${dn} ${tag}: no Chinese left on the screen (with this game's EN / FR texts)${unknown.length ? ' -> ' + unknown.join(' | ') : ''}`);
      };
      await check('ready');
      await r.click('#hz-start'); await r.waitForFunction(() => window.__hanzi.phase() === 'play'); await check('play');
      const w = await r.evaluate(() => ({ sw: document.documentElement.scrollWidth <= innerWidth, over: [...document.querySelectorAll('.hz-hud > *, .hz-ovl button, .hz-next')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent) }));
      ok(w.sw && w.over.length === 0, `${name} ${dn}: no overflow / clipped text${w.over.length ? ' -> ' + w.over.join() : ''}`);
      while ((await r.evaluate(() => window.__hanzi.phase())) === 'play') { const nx = await r.evaluate(() => window.__hanzi.next()); await r.click(`.hz-tile[data-s="${nx}"]`); await r.click('#hz-field'); }
      await check('done');
      if (dn === 'phone') await r.screenshot({ path: OUT + `hanzi-${name}.png` });
      await s.browser.close();
    }
  }
  await done();
})();
