// The subject picker (the screen between signing in and a subject): four big cartoon cards (识字 / 数学 / 英语 / 科学), a tap effect (sparkles + ring),
// a curtain that grows from the card and lifts on the next screen, "识字" = the original Learning Chinese app (`#/chinese`), the other subjects a
// "coming soon" page, back buttons and Settings that return to where they were opened. Also: nothing overflows / is clipped on small and large screens,
// and in English / French; with "reduce motion" the effects are skipped but the navigation still works.
const { start, checks, addKid, openKid } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const NAMES = ['识字', '数学', '英语', '科学'];
const IDS = ['chinese', 'math', 'english', 'science'];

/** signs in on this device (no GitHub) and stops at the picker */
const toHub = async (opts) => {
  const t = await start(new Map(), { noLogin: true, ...opts });
  await t.page.click('#local-btn'); await t.page.waitForSelector('.hub-grid');
  await t.page.waitForTimeout(opts.motion ? 1000 : 150);   // (the cards pop in)
  return t;
};
const layout = (page) => page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const cards = [...document.querySelectorAll('.subject')].map((c) => { const r = c.getBoundingClientRect(); return { id: c.dataset.subject, l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height, txt: c.querySelector('.s-name').textContent,
    art: c.querySelector('.s-art svg').getBoundingClientRect().width,
    nameClip: c.querySelector('.s-name').scrollWidth > c.querySelector('.s-name').clientWidth + 1 }; });
  return { vw, sw: document.documentElement.scrollWidth, cards, order: cards.map((c) => c.id) };
});

(async () => {
  // ---- the picker itself, on phones and tablets ----
  for (const [name, vp, min] of [['iPhone SE', { width: 320, height: 568 }, 120], ['iPhone', { width: 390, height: 844 }, 150], ['iPad portrait', { width: 820, height: 1180 }, 300], ['iPad landscape', { width: 1180, height: 820 }, 240], ['desktop', { width: 1440, height: 900 }, 240]]) {
    const { browser, page } = await toHub({ local: true, viewport: vp });
    const L = await layout(page);
    ok(L.order.join() === IDS.join() && L.cards.map((c) => c.txt).join() === NAMES.join(), name + ': four cards in order 识字 / 数学 / 英语 / 科学');
    ok(L.cards.every((c) => c.w >= min && c.h >= min && c.art >= min * 0.6), name + ': the cards are big (' + L.cards.map((c) => Math.round(c.w) + 'x' + Math.round(c.h)).join(', ') + ')');
    ok(L.sw <= L.vw, name + ': no sideways scrolling');
    const left = Math.min(...L.cards.map((c) => c.l)), right = L.vw - Math.max(...L.cards.map((c) => c.r));
    ok(Math.abs(left - right) <= 2, name + ': equal space left and right (' + Math.round(left) + ' / ' + Math.round(right) + ')');
    ok(L.cards.every((c) => !c.nameClip), name + ': the names fit');
    await page.screenshot({ path: OUT + 'hub-' + name.replace(/ /g, '-') + '.png' });
    await browser.close();
  }

  // ---- English / French: names fit, nothing Chinese left on the cards ----
  for (const [loc, names] of [['en-US', ['Characters', 'Math', 'English', 'Science']], ['fr-FR', ['Caractères', 'Maths', 'Anglais', 'Sciences']]]) {
    const { browser, page } = await toHub({ local: true, locale: loc, viewport: { width: 320, height: 568 } });
    const L = await layout(page);
    ok(L.cards.map((c) => c.txt).join() === names.join(), loc + ': the subjects are translated (' + L.cards.map((c) => c.txt).join(', ') + ')');
    ok(L.cards.every((c) => !c.nameClip) && L.sw <= L.vw, loc + ': nothing is cut off on a 320 px phone');
    const text = await page.evaluate(() => document.querySelector('.hub-page').innerText);
    ok(!/[一-鿿]/.test(text), loc + ': no Chinese left on the screen (' + text.replace(/\s+/g, ' ').slice(0, 60) + ')');
    await page.screenshot({ path: OUT + 'hub-' + loc + '.png' });
    await browser.close();
  }

  // ---- the effects (animations ON): sparkles, then the curtain, then the screen; the curtain is gone afterwards ----
  {
    const { browser, page } = await toHub({ local: true, motion: true, viewport: { width: 390, height: 844 } });
    const box = await page.locator('.subject[data-subject=chinese]').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForSelector('.fx-spark', { timeout: 1000 });
    const fx = await page.evaluate(() => ({ sparks: document.querySelectorAll('.fx-spark').length, ring: document.querySelectorAll('.fx-ring').length, boom: document.querySelector('.subject.boom')?.dataset.subject, hash: location.hash }));
    ok(fx.sparks >= 12 && fx.ring === 1 && fx.boom === 'chinese', 'tap: the card squashes and a ring and ' + fx.sparks + ' sparkles fly out');
    ok(fx.hash === '' || fx.hash === '#/', 'the effect comes first: the screen has not changed yet');
    await page.waitForSelector('#curtain', { timeout: 2000 });
    ok(await page.evaluate(() => getComputedStyle(document.getElementById('curtain')).backgroundColor) === 'rgb(247, 103, 7)', 'then a curtain in the card colour (orange) grows over the screen');
    await page.waitForSelector('.kids, .empty-home', { timeout: 5000 });
    ok(await page.evaluate(() => location.hash) === '#/chinese', '识字 opens the Learning Chinese app (#/chinese)');
    await page.waitForFunction(() => !document.getElementById('curtain') && !document.querySelector('.fx-layer'), null, { timeout: 4000 });
    ok(true, 'the curtain and the sparkles are removed again (nothing is left covering the screen)');
    const tappable = await page.evaluate(() => { const b = document.querySelector('#add-kid-big, .kid'); const r = b.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('button') === b; });
    ok(tappable, 'and the screen underneath can be tapped');
    // double tap while the effect runs does not open two things / break
    await page.click('button.back'); await page.waitForSelector('.hub-grid'); await page.waitForTimeout(900);
    const b2 = await page.locator('.subject[data-subject=science]').boundingBox();
    await page.mouse.click(b2.x + 50, b2.y + 50); await page.mouse.click(b2.x + 60, b2.y + 60); await page.mouse.click(b2.x + 70, b2.y + 70);
    await page.waitForSelector('.soon', { timeout: 5000 });
    ok(await page.locator('#curtain').count() <= 1 && await page.evaluate(() => location.hash) === '#/subject/science', 'tapping three times quickly still opens just one subject');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: OUT + 'hub-soon-science.png' });
    await browser.close();
  }

  // ---- navigation (animations off = "reduce motion": same routes, no waiting) ----
  {
    const { browser, page } = await toHub({ local: true, viewport: { width: 390, height: 844 } });
    ok(await page.locator('.hub-page').count() === 1 && /学习乐园/.test(await page.title()), 'after signing in: the subject picker, the app is called 学习乐园');
    // a subject that is not built yet
    for (const [id, nm] of [['math', '数学'], ['science', '科学']]) {
      await page.click(`.subject[data-subject=${id}]`); await page.waitForSelector('.soon');
      const t = await page.evaluate(() => ({ h1: document.querySelector('h1').textContent, h2: document.querySelector('.soon h2').textContent, art: document.querySelector('.soon-art svg').dataset.art, hash: location.hash }));
      ok(t.h1 === nm && t.h2 === '正在建设中' && t.art === id && t.hash === '#/subject/' + id, nm + ': a "coming soon" page with its own colour and picture');
      await page.click('button.back'); await page.waitForSelector('.hub-grid');
    }
    ok((await page.evaluate(() => location.hash)) === '#/', 'back from a subject: the picker');
    await page.evaluate(() => (location.hash = '#/subject/nothing')); await page.waitForSelector('.hub-grid');
    ok(true, 'an unknown subject address shows the picker');
    // Learning Chinese: all of it is still there
    await page.click('.subject[data-subject=chinese]'); await page.waitForSelector('#add-kid-big');
    ok(await page.evaluate(() => document.querySelector('.home-hero h1').textContent) === '识字小助手', '识字: the Learning Chinese home screen (first time: the big +)');
    await page.click('button.back'); await page.waitForSelector('.hub-grid');
    ok(true, 'its back button returns to the picker');
    // children, weeks, characters keep working below the picker
    await page.click('.subject[data-subject=chinese]'); await page.waitForSelector('#add-kid-big');
    await addKid(page, 'Dory'); await openKid(page, 'Dory');
    ok(await page.locator('.weekbar').count() === 1, 'a child can be added and opened below 识字');
    await page.click('button.back'); await page.waitForSelector('.kids');
    ok((await page.evaluate(() => location.hash)) === '#/chinese', "a child's back button returns to the children (not to the picker)");
    // Settings return to where the gear was tapped
    await page.click('.gear-btn'); await page.waitForSelector('#manage-mode'); await page.click('button.back');
    await page.waitForSelector('.kids');
    ok((await page.evaluate(() => location.hash)) === '#/chinese', 'Settings opened from the children: "完成" returns to the children');
    await page.click('button.back'); await page.waitForSelector('.hub-grid');
    await page.click('.gear-btn'); await page.waitForSelector('#manage-mode'); await page.click('button.back');
    await page.waitForSelector('.hub-grid');
    ok((await page.evaluate(() => location.hash)) === '#/', 'Settings opened from the picker: "完成" returns to the picker');
    // direct addresses and reload
    await page.evaluate(() => (location.hash = '#/chinese')); await page.reload(); await page.waitForSelector('.kid');
    ok(true, 'reloading on #/chinese stays in the Learning Chinese app (the data is still there)');
    await page.evaluate(() => (location.hash = '')); await page.reload(); await page.waitForSelector('.hub-grid');
    ok(true, 'the bare address (and a reload) opens the picker');
    await browser.close();
  }

  // ---- signed out: the picker is behind the login ----
  {
    const t = await start(new Map(), { noLogin: true });
    await t.page.waitForSelector('.login');
    ok(await t.page.locator('.hub-grid').count() === 0 && (await t.page.locator('.login h1').textContent()) === '学习乐园', 'before signing in: only the login screen (titled 学习乐园)');
    await t.browser.close();
  }
  await done();
})();
