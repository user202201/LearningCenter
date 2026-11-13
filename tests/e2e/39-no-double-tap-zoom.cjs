// No double-tap zoom: the page is not scalable (viewport meta), every element has touch-action manipulation (or none on the instruments), and a second quick tap on
// plain text is cancelled while controls (buttons) still get both taps. Real iPhone / iPad Safari behaviour can not be tested here.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();

(async () => {
  const t = await start(new Map(), { local: true, today: '2026-11-12', viewport: { width: 390, height: 844 }, touch: true });
  const p = t.page;
  const meta = await p.evaluate(() => document.querySelector('meta[name=viewport]').content);
  ok(/maximum-scale=1/.test(meta) && /user-scalable=no/.test(meta), 'the viewport is not scalable: ' + meta);
  for (const hash of ['#/', '#/subject/music', '#/music/theory', '#/music/piano', '#/music/drums', '#/chinese']) {
    await p.evaluate((h) => (location.hash = h), hash); await p.waitForSelector('.page, .hub-grid');
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => {
      const bad = [...document.querySelectorAll('body *')].filter((e) => !['manipulation', 'none', 'pan-y', 'pan-x', 'pinch-zoom'].includes(getComputedStyle(e).touchAction) || getComputedStyle(e).touchAction === 'auto').length;
      return { html: getComputedStyle(document.documentElement).touchAction, body: getComputedStyle(document.body).touchAction, bad };
    });
    ok(r.html === 'manipulation' && r.body === 'manipulation' && r.bad === 0, `${hash}: touch-action manipulation on every element (auto on ${r.bad})`);
  }
  // a quick second tap on plain text is cancelled; on a button it is not
  await p.evaluate(() => (location.hash = '#/music/theory')); await p.waitForSelector('.th-ch');
  await p.evaluate(() => { window.__tp = []; document.addEventListener('touchend', (e) => setTimeout(() => window.__tp.push([e.target.closest('button') ? 'button' : 'text', e.defaultPrevented]), 0), true); });
  const lead = await p.locator('#th-progress').boundingBox();
  await p.touchscreen.tap(lead.x + 20, lead.y + 5); await p.touchscreen.tap(lead.x + 20, lead.y + 5);
  await p.waitForTimeout(100);
  const tp = await p.evaluate(() => window.__tp.slice());
  ok(tp.length === 2 && tp[0][1] === false && tp[1][1] === true, 'two quick taps on plain text: the second one is cancelled (no zoom): ' + JSON.stringify(tp));
  ok(t.log.external.length === 0, 'no request left the app');
  await t.browser.close();
  await done();
})();
