// The secret subjects (music, mini-games): hidden at first; 10 quick taps on the mascot (top-left) of the picker show them with a grand entrance (animation class,
// confetti), 10 more hide them; taps during the animation are ignored; slow taps do not count; the state is kept on this device.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const cards = (p) => p.locator('.subject').evaluateAll((e) => e.map((x) => x.dataset.subject));
const tap = async (p, n, gap = 40) => { for (let i = 0; i < n; i++) { await p.locator('.hub-hero .mascot').dispatchEvent('pointerdown', { isPrimary: true }); await p.waitForTimeout(gap); } };

(async () => {
  for (const [dn, vp, motion] of [['iPad', { width: 1180, height: 820 }, true], ['phone', { width: 390, height: 844 }, false]]) {
    const t = await start(new Map(), { local: true, locked: true, motion, today: '2026-11-12', viewport: vp });
    const p = t.page;
    await p.evaluate(() => (location.hash = '#/')); await p.waitForSelector('.hub-grid'); await p.waitForTimeout(500);
    ok((await cards(p)).join() === 'chinese,math,english,science', `${dn}: at first only the four school subjects are shown`);
    const box = await p.locator('.hub-hero .mascot').boundingBox();
    ok(box.x < 60 && box.y < 80, `${dn}: the tap corner is the mascot at the top-left (${Math.round(box.x)}, ${Math.round(box.y)})`);
    await tap(p, 9);
    ok((await cards(p)).length === 4, `${dn}: nine taps are not enough`);
    // a slow tap resets the count
    await p.waitForTimeout(1700); await tap(p, 5); await p.waitForTimeout(1700); await tap(p, 5);
    ok((await cards(p)).length === 4, `${dn}: slow taps (more than 1.5 s apart) do not add up`);
    await p.waitForTimeout(1700);
    await tap(p, 10);
    await p.waitForTimeout(150);
    const arriving = await p.locator('.subject.hub-arrive').count();
    ok((await cards(p)).join() === 'chinese,math,english,science,music,games' && (motion ? arriving === 2 : arriving === 0), `${dn}: ten quick taps show music and games (${motion ? 'the cards fly in with the "arrive" animation' : 'no animation with reduced motion'})`);
    ok(motion ? await p.locator('.confetti').count() >= 20 : true, `${dn}: ${motion ? 'confetti flies out of the new cards' : 'no confetti with reduced motion'}`);
    ok((await p.locator('.toast').allTextContents()).join().includes('隐藏学科出现了'), `${dn}: a message says what happened`);
    if (motion) await p.screenshot({ path: OUT + `secret-reveal-${dn}.png` });
    ok((await p.evaluate(() => localStorage.getItem('learn.hidden.v1'))) === '1', `${dn}: the state is kept on this device`);
    // wild tapping during the animation does nothing
    await tap(p, 40, 10);
    ok((await cards(p)).length === 6, `${dn}: 40 more wild taps during the animation change nothing`);
    await p.waitForTimeout(2700);
    // the new cards work
    await p.reload(); await p.waitForSelector('.hub-grid'); await p.waitForTimeout(1500);
    ok((await cards(p)).length === 6, `${dn}: after a reload they are still shown`);
    // equal space left and right with six cards
    const lr = await p.evaluate(() => { const c = [...document.querySelectorAll('.subject')].map((e) => e.getBoundingClientRect()); return [Math.min(...c.map((r) => r.left)), innerWidth - Math.max(...c.map((r) => r.right)), document.documentElement.scrollWidth <= innerWidth]; });
    ok(Math.abs(lr[0] - lr[1]) <= 2 && lr[2], `${dn}: six cards are centred (${Math.round(lr[0])} / ${Math.round(lr[1])})`);
    // ten more taps hide them again
    await p.waitForTimeout(1800);
    await tap(p, 10);
    await p.waitForTimeout(motion ? 1100 : 200);
    ok((await cards(p)).join() === 'chinese,math,english,science' && (await p.evaluate(() => localStorage.getItem('learn.hidden.v1'))) === '0', `${dn}: ten more quick taps hide them again`);
    ok((await p.locator('.toast').allTextContents()).join().includes('收起来了'), `${dn}: and say so`);
    await tap(p, 30, 10); await p.waitForTimeout(300);
    ok((await cards(p)).length === 4, `${dn}: wild tapping right after hiding does not bring them back`);
    ok(await p.locator('.subject[data-subject=chinese]').count() === 1 && t.log.external.length === 0, `${dn}: the school subjects are untouched, no outside request`);
    await t.browser.close();
  }
  // the four cards on a wide screen fill the row (no empty columns)
  {
    const t = await start(new Map(), { local: true, locked: true, today: '2026-11-12', viewport: { width: 1180, height: 820 } });
    await t.page.evaluate(() => (location.hash = '#/')); await t.page.waitForSelector('.hub-grid'); await t.page.waitForTimeout(400);
    const lr = await t.page.evaluate(() => { const c = [...document.querySelectorAll('.subject')].map((e) => e.getBoundingClientRect()); return [Math.min(...c.map((r) => r.left)), innerWidth - Math.max(...c.map((r) => r.right))]; });
    ok(Math.abs(lr[0] - lr[1]) <= 2, `four cards on a wide screen are centred (${Math.round(lr[0])} / ${Math.round(lr[1])})`);
    await t.browser.close();
  }
  await done();
})();
