// English reading, follow-along: the passage is read sentence by sentence, the sentence being read is lit, the speed can be chosen (and is kept),
// a tap on a sentence starts the reading there, and a full-screen reading view makes the text big.
const { start, checks, addKid, setGrade } = require('./harness.cjs');
const { speechInit } = require('./speechstub.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const t = await start(new Map(), { local: true, today: '2026-11-12', viewport: { width: 390, height: 844 }, init: speechInit, initArg: { voices: [{ lang: 'en-US' }], dur: 250 } });
  const p = t.page;
  await addKid(p, 'Dory'); await setGrade(p, 'Dory', 4);
  const id = await p.evaluate(() => JSON.parse(localStorage.getItem('learn.local.kids.json')).kids[0].id);
  await p.evaluate((i) => (location.hash = '#/english/' + i), id); await p.waitForSelector('.wrow');
  await p.waitForSelector('#read-card'); await p.click('#read-card'); await p.waitForSelector('#rd-text');

  const nSent = await p.locator('.rd-s').count();
  ok(nSent >= 3, 'the text is cut into sentences: ' + nSent);
  const joined = (await p.locator('.rd-s').allTextContents()).join(' ').replace(/\s+/g, ' ').trim();
  const whole = (await p.textContent('#rd-text')).replace(/\s+/g, ' ').trim();
  ok(joined === whole, 'the sentences together are the whole text');

  // ---- speed ----
  ok(await p.locator('.rd-speed-b').count() === 3, 'three speeds');
  ok((await p.locator('.rd-speed-b[aria-pressed="true"]').getAttribute('data-rate')) === '0.68', 'the default is the slower speed (0.68)');
  await p.click('.rd-speed-b[data-rate="0.5"]');
  ok((await p.evaluate(() => localStorage.getItem('learn.reading.rate'))) === '0.5', 'the choice is kept on the device');
  ok((await p.locator('.rd-speed-b[aria-pressed="true"]').getAttribute('data-rate')) === '0.5', 'the chosen speed is marked');

  // ---- sentence by sentence, the lit one follows ----
  await p.click('#rd-speak');
  await p.waitForFunction(() => document.querySelector('.rd-s.now'));
  ok((await p.locator('.rd-s.now').count()) === 1 && (await p.getAttribute('.rd-s.now', 'data-s')) === '0', 'the first sentence is lit while it is read');
  const says = async () => p.evaluate(() => window.__says.map((x) => x[0]));
  await p.waitForFunction(() => window.__says.length >= 1);
  const first = (await p.locator('.rd-s').first().textContent()).trim();
  ok((await says())[0] === first, 'only that sentence is spoken: ' + first.slice(0, 40));
  await p.waitForFunction(() => document.querySelector('.rd-s.now') && document.querySelector('.rd-s.now').dataset.s === '1', null, { timeout: 5000 });
  ok(true, 'the light moves on to the second sentence when the first has been read');
  ok((await p.locator('.rd-s.now').count()) === 1, 'one sentence is lit at a time');
  ok((await p.evaluate(() => window.__says.every((x) => x[1] === 'en-US'))), 'spoken in English (en-US)');
  const rateUsed = await p.evaluate(() => window.__says.length);
  ok(rateUsed >= 2, 'the next sentence follows by itself');
  ok((await p.textContent('#rd-speak')) === '停止朗读', 'the button says stop while reading');

  // ---- a new speed starts again from the sentence being read ----
  const before = await p.getAttribute('.rd-s.now', 'data-s');
  await p.click('.rd-speed-b[data-rate="0.85"]');
  await p.waitForTimeout(100);
  ok((await p.getAttribute('.rd-s.now', 'data-s')) === before, 'a new speed goes on from the same sentence (' + before + ')');

  // ---- stop clears the light ----
  await p.click('#rd-speak');
  ok((await p.locator('.rd-s.now').count()) === 0 && (await p.textContent('#rd-speak')) === '朗读全文', 'stop clears the light');

  // ---- a tap on a sentence starts there; a tap on a glossed word only shows its meaning ----
  await p.evaluate(() => { window.__says.length = 0; });
  const last = nSent - 1;
  await p.locator(".rd-s").nth(last).evaluate((el) => el.click());
  await p.waitForFunction(() => document.querySelector('.rd-s.now'));
  ok((await p.getAttribute('.rd-s.now', 'data-s')) === String(last), 'a tap on a sentence starts the reading there');
  await p.waitForTimeout(700);
  ok((await p.locator('.rd-s.now').count()) === 0 && (await p.textContent('#rd-speak')) === '朗读全文', 'after the last sentence the light goes out and the button is back');
  await p.evaluate(() => { window.__says.length = 0; });
  await p.locator('.rw-gl').first().click();
  await p.waitForTimeout(150);
  ok((await p.evaluate(() => window.__says.length)) === 0 && (await p.locator('.rd-s.now').count()) === 0, 'a tap on a glossed word does not start the reading');

  // ---- full screen ----
  const fs0 = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.rd-p')).fontSize));
  await p.click('#rd-full');
  const box = await p.evaluate(() => { const r = document.querySelector('#rd-reader').getBoundingClientRect(); return [r.x, r.y, r.width, r.height, innerWidth, innerHeight]; });
  ok(box[0] === 0 && box[1] === 0 && box[2] === box[4] && box[3] === box[5], 'the reader covers the whole screen');
  const fs1 = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.rd-p')).fontSize));
  ok(fs1 >= 26 && fs1 > fs0, `the text is bigger (${fs0}px -> ${fs1}px)`);
  ok((await p.textContent('#rd-full')) === '退出全屏', 'the button now leaves full screen');
  await p.click('#rd-speak');
  await p.waitForFunction(() => document.querySelector('.rd-s.now'));
  ok(await p.evaluate(() => { const r = document.querySelector('.rd-s.now').getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }), 'the lit sentence is on the screen in full screen');
  await p.screenshot({ path: OUT + 'reading-follow-fullscreen-phone.png' });
  const fit = await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  ok(fit, 'nothing sideways in full screen');
  await p.click('#rd-speak');
  await p.keyboard.press('Escape');
  ok(await p.evaluate(() => !document.querySelector('#rd-reader').classList.contains('rd-fs')), 'Esc leaves full screen');
  await p.click('#rd-full'); await p.click('#rd-full');
  ok(await p.evaluate(() => !document.querySelector('#rd-reader').classList.contains('rd-fs')), 'the button toggles');

  // ---- leaving the page stops the voice ----
  await p.click('#rd-speak');
  await p.waitForFunction(() => document.querySelector('.rd-s.now'));
  await p.evaluate((i) => (location.hash = '#/english/' + i), id); await p.waitForSelector('.wrow');
  await p.evaluate(() => { window.__says.length = 0; });
  await p.waitForTimeout(700);
  ok((await p.evaluate(() => window.__says.length)) === 0, 'leaving the page stops the reading');
  ok(await p.evaluate(() => !document.documentElement.classList.contains('rd-fs-on')), 'the page is not left locked');

  // ---- no voice on the device: nothing lights, nothing hangs ----
  const nv = await start(new Map(), { local: true, today: '2026-11-12', viewport: { width: 390, height: 844 }, init: speechInit, initArg: { voices: null } });
  const q = nv.page;
  await addKid(q, 'Dory'); await setGrade(q, 'Dory', 4);
  const id2 = await q.evaluate(() => JSON.parse(localStorage.getItem('learn.local.kids.json')).kids[0].id);
  await q.evaluate((i) => (location.hash = '#/english/' + i), id2); await q.waitForSelector('#read-card'); await q.click('#read-card'); await q.waitForSelector('#rd-text');
  await q.click('#rd-speak'); await q.waitForTimeout(300);
  ok((await q.locator('.rd-s.now').count()) === 0 && (await q.textContent('#rd-speak')) === '朗读全文', 'no speech on this device: no light, the button stays usable');

  // ---- EN / FR ----
  for (const [loc, a, b] of [['en-US', 'Full-screen reading', 'Very slow'], ['fr-FR', 'Lecture en plein écran', 'Très lent']]) {
    const s = await start(new Map(), { local: true, locale: loc, today: '2026-11-12', viewport: { width: 390, height: 844 } });
    await addKid(s.page, 'Dory'); await setGrade(s.page, 'Dory', 4);
    const kid = await s.page.evaluate(() => JSON.parse(localStorage.getItem('learn.local.kids.json')).kids[0].id);
    await s.page.evaluate((i) => (location.hash = '#/english/' + i), kid);
    // the English screen teaches French (no passages): only the French screen has the page
    if (loc === 'fr-FR') {
      await s.page.waitForSelector('#read-card'); await s.page.click('#read-card'); await s.page.waitForSelector('#rd-text');
      ok((await s.page.textContent('#rd-full')) === a && (await s.page.textContent('.rd-speed-b[data-rate="0.5"]')) === b, 'FR: ' + a + ' / ' + b);
      ok(!/[一-鿿]/.test((await s.page.textContent('.rd-tools')) + (await s.page.textContent('#rd-speed'))), 'no Chinese in the controls');
    }
    await s.browser.close();
  }
  await nv.browser.close();
  await t.browser.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
