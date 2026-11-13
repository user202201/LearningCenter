// The scratch paper (演草纸) of the math game: beside the question on wide / landscape screens, under it on tall ones; written on with the mouse (the same
// pointer events as a finger / pencil); undo, eraser, clear; a fresh sheet for every question; the top-bar button hides / shows it and the choice is remembered;
// the answers stay usable, nothing overflows, nothing leaves the device.
const { start, checks, addKid, setGrade } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });

const open = async (vp, pre, extra = {}) => {
  const t = await start(new Map(), { local: true, today: '2026-11-12', viewport: vp, ...extra });
  if (pre) await t.page.evaluate(pre);
  const { page } = t;
  await addKid(page, 'Dory');
  await page.evaluate(() => (location.hash = '#/')); await page.waitForSelector('.hub-grid');
  await page.click('.subject[data-subject=math]'); await page.waitForSelector('.kids');
  await page.click('.kid:has-text("Dory")'); await page.waitForSelector('#grade-dlg');
  await page.click('.grade-btn[data-grade="5"]'); await page.waitForSelector('.mtcard');
  await page.click('#tab-game'); await page.click('#game-start'); await page.waitForSelector('#math-q');
  return t;
};
const rects = (page) => page.evaluate(() => {
  const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  return { pad: r('#pad'), q: r('#math-q'), grid: r('.mchoice'), sheet: r('#pad-canvas'), sw: document.documentElement.scrollWidth, iw: innerWidth };
});
const draw = async (page, pts) => {
  const b = await page.locator('#pad-canvas').boundingBox();
  await page.mouse.move(b.x + pts[0][0] * b.width, b.y + pts[0][1] * b.height); await page.mouse.down();
  for (const [x, y] of pts.slice(1)) await page.mouse.move(b.x + x * b.width, b.y + y * b.height, { steps: 4 });
  await page.mouse.up();
};
const ink = (page) => page.evaluate(() => { const c = document.querySelector('#pad-canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
const strokes = (page) => page.evaluate(() => +document.querySelector('#pad-canvas').dataset.strokes);

(async () => {
  // ---- wide / landscape: beside the question ----
  {
    const { browser, page, log } = await open({ width: 1180, height: 820 });
    const r = await rects(page);
    ok(r.pad && r.pad.w > 150 && r.pad.h > 150, 'the scratch paper is there (' + Math.round(r.pad.w) + ' x ' + Math.round(r.pad.h) + ')');
    ok(r.pad.l >= r.q.r - 1 && r.pad.l >= r.grid.r - 1, 'landscape: the paper is BESIDE the question and the choices');
    ok(r.sw <= r.iw, 'no horizontal overflow');
    ok(await ink(page) === 0, 'a fresh sheet is empty');
    await draw(page, [[0.2, 0.2], [0.5, 0.5], [0.8, 0.3]]);
    ok(await ink(page) > 50 && await strokes(page) === 1, 'writing with the pointer leaves ink (1 stroke)');
    await draw(page, [[0.2, 0.8], [0.8, 0.8]]);
    ok(await strokes(page) === 2, 'a second stroke');
    await page.click('#pad-undo');
    ok(await strokes(page) === 1, 'undo takes the last stroke back');
    const before = await ink(page);
    await page.click('#pad-eraser');
    await draw(page, [[0.1, 0.2], [0.9, 0.2], [0.9, 0.5], [0.1, 0.5]]);
    ok(await ink(page) < before, 'the eraser removes ink (' + before + ' -> ' + (await ink(page)) + ')');
    await page.click('#pad-pen'); await page.click('#pad-color-1');
    await draw(page, [[0.3, 0.7], [0.7, 0.9]]);
    ok(await page.evaluate(() => document.querySelector('#pad-color-1').classList.contains('on')), 'the second pen colour is chosen');
    await page.click('#pad-clear');
    ok(await ink(page) === 0 && await strokes(page) === 0, 'clear empties the sheet');
    // a fresh sheet for every question; the answers still work with the paper shown
    await draw(page, [[0.2, 0.2], [0.8, 0.8]]);
    const prog = await page.textContent('#game-progress');
    await page.click('.mchoice >> nth=0');
    await page.waitForFunction((p) => document.querySelector('#game-progress')?.textContent !== p, prog, { timeout: 5000 });
    ok(await ink(page) === 0, 'the next question comes with an empty sheet');
    // hide / show, remembered
    await page.click('#game-pad');
    ok(await page.evaluate(() => !document.querySelector('#game').classList.contains('with-pad')) && !(await page.locator('#pad').isVisible()), 'the ✎ button hides the paper');
    ok(JSON.parse(await page.evaluate(() => localStorage.getItem('learn.math.v1'))).pad === false, 'and the choice is remembered (learn.math.v1)');
    const r2 = await rects(page);
    ok(r2.sw <= r2.iw, 'hidden: no overflow');
    await page.click('#game-pad');
    ok(await page.locator('#pad').isVisible() && JSON.parse(await page.evaluate(() => localStorage.getItem('learn.math.v1'))).pad === true, 'shown again and remembered');
    await page.screenshot({ path: OUT + 'scratchpad-landscape.png' });
    ok(log.external.length === 0, 'no outside request: ' + log.external.join(', '));
    await browser.close();
  }
  // ---- a real touch screen (touch events through the browser's protocol, device pixel ratio 2 and 3): the ink is where the finger is, to its very end ----
  for (const [n, vp, dpr] of [['ipad touch', { width: 820, height: 1180 }, 2], ['phone touch', { width: 390, height: 844 }, 3]]) {
    const { browser, page } = await open(vp, null, { touch: true, dpr });
    await page.waitForTimeout(600);
    const b = await page.locator('#pad-canvas').boundingBox();
    const cdp = await page.context().newCDPSession(page);
    const path = [[0.15, 0.25], [0.3, 0.45], [0.5, 0.6], [0.7, 0.45], [0.85, 0.25]].map(([x, y]) => ({ x: b.x + x * b.width, y: b.y + y * b.height }));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [path[0]] });
    for (const q of path.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [q] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(150);
    const bb = await page.evaluate(() => { const c = document.querySelector('#pad-canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 0) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { x0, y0, x1, y1, k: c.width / c.getBoundingClientRect().width }; });
    const css = { x0: bb.x0 / bb.k, y0: bb.y0 / bb.k, x1: bb.x1 / bb.k, y1: bb.y1 / bb.k };
    const want = { x0: 0.15 * b.width, x1: 0.85 * b.width, y0: 0.25 * b.height, y1: 0.6 * b.height };
    const err = Math.max(Math.abs(css.x0 - want.x0), Math.abs(css.x1 - want.x1));   // (the two ends of the path are its left and right extremes; the curve rounds off the corners in between, so y is not compared)
    ok(bb.x1 > 0 && err <= 6, n + ': the ink starts and ENDS where the finger did (largest difference ' + err.toFixed(1) + ' px, the canvas is ' + bb.k + 'x the CSS size)');
    await browser.close();
  }
  // ---- a browser whose coalesced events carry wrong coordinates must not put the line away from the finger ----
  {
    const { browser, page } = await open({ width: 820, height: 1180 });
    const r = await page.evaluate(() => {
      const c = document.querySelector('#pad-canvas'), b = c.getBoundingClientRect();
      const mk = (type, x, y, extra) => new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true, buttons: 1, ...extra });
      const x0 = b.left + 100, y0 = b.top + 100;
      c.dispatchEvent(mk('pointerdown', x0, y0, {}));
      for (let i = 1; i <= 6; i++) {
        const ev = mk('pointermove', x0 + i * 40, y0 + i * 10, {});
        // the "browser" reports the coalesced points shifted by (+300, +300): wrong coordinate system
        Object.defineProperty(ev, 'getCoalescedEvents', { value: () => [mk('pointermove', x0 + i * 40 - 20 + 300, y0 + i * 10 - 5 + 300, {}), mk('pointermove', x0 + i * 40 + 300, y0 + i * 10 + 300, {})] });
        c.dispatchEvent(ev);
      }
      c.dispatchEvent(mk('pointerup', x0 + 240, y0 + 60, {}));
      const k = c.width / b.width, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let x1 = -1, y1 = -1; for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 0) { x1 = Math.max(x1, x / k); y1 = Math.max(y1, y / k); }
      return { x1, y1, wantX: 340, wantY: 160 };
    });
    ok(r.x1 > 0 && r.x1 <= r.wantX + 6 && r.y1 <= r.wantY + 6, 'wrong coalesced coordinates are ignored: the ink stays on the finger path (right end ' + Math.round(r.x1) + ' / ' + r.wantX + ', bottom ' + Math.round(r.y1) + ' / ' + r.wantY + ')');
    await browser.close();
  }
  // ---- tall screens: under the question; small phone; remembered hidden state on a new game ----
  for (const [n, vp] of [['phone', { width: 390, height: 844 }], ['small', { width: 320, height: 568 }], ['ipad', { width: 820, height: 1180 }]]) {
    const { browser, page } = await open(vp);
    const r = await rects(page);
    ok(r.pad && r.pad.t >= r.grid.b - 1 && r.sw <= r.iw, n + ': the paper is UNDER the choices, no overflow');
    ok(r.pad.w > 150 && r.pad.h > 60 && r.pad.b <= vp.height + 1, n + ': the paper is usable (' + Math.round(r.pad.w) + ' x ' + Math.round(r.pad.h) + ') and on the screen');
    const choice = await page.locator('.mchoice >> nth=0').boundingBox();
    ok(choice && choice.y + choice.height <= vp.height, n + ': the choices are still on the screen');
    await draw(page, [[0.2, 0.3], [0.8, 0.6]]);
    ok(await ink(page) > 0, n + ': writing works');
    await page.screenshot({ path: OUT + 'scratchpad-' + n + '.png' });
    await browser.close();
  }
  {
    const { browser, page } = await open({ width: 390, height: 844 });
    await page.click('#game-pad');
    await page.reload(); await page.evaluate(() => (location.hash = '#/')); await page.waitForSelector('.hub-grid'); await page.click('.subject[data-subject=math]');
    await page.waitForSelector('.kids'); await page.click('.kid:has-text("Dory")'); await page.waitForSelector('.mtcard');
    await page.click('#tab-game'); await page.click('#game-start'); await page.waitForSelector('#math-q');
    ok(!(await page.locator('#pad').isVisible()), 'a new game starts with the paper hidden when it was hidden');
    await browser.close();
  }
  done();
})().catch((e) => { console.error(e); process.exit(1); });
