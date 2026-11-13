// Subject shortcuts: the top bar of a child's page (every subject) has three round icons on the right = the OTHER subjects, each leading to the SAME child's page
// there (the grade is asked there the first time); on phones and tablets, in English / French, nothing overflows and the title keeps its room.
const { start, checks, addKid, setGrade } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const ALL = ['chinese', 'math', 'english', 'science', 'coding'];   // (coding = the fifth subject: no grade is asked there)
const route = { chinese: (id) => `#/kid/${id}`, math: (id) => `#/math/${id}`, english: (id) => `#/english/${id}`, science: (id) => `#/science/${id}`, coding: (id) => `#/coding/${id}` };
const kidId = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('learn.local.kids.json')).kids[0].id);
const bar = async (page) => { for (let i = 0; i < 5; i++) { const r = await bar1(page); if (r) return r; await page.waitForTimeout(200); await page.waitForSelector('header.kid-hero .shortcuts'); } return bar1(page); };   // (a page may redraw once while it loads)
const bar1 = (page) => page.evaluate(() => {
  const top = document.querySelector('header.kid-hero'), nav = top && top.querySelector('.shortcuts');
  if (!nav) return null;
  const vw = document.documentElement.clientWidth, t = top.getBoundingClientRect(), b = [...nav.children].map((e) => e.getBoundingClientRect()), h1 = top.querySelector('h1').getBoundingClientRect();
  return { ids: [...nav.children].map((e) => e.id.replace('go-', '')), hrefs: [...nav.children].map((e) => e.getAttribute('href')), round: [...nav.querySelectorAll('.sc-ico')].map((e) => e.getBoundingClientRect()).every((r) => Math.abs(r.width - r.height) < 1 && r.width >= 30), labels: [...nav.querySelectorAll('.sc-name')].map((e) => e.textContent.trim()), labelsOk: [...nav.querySelectorAll('.sc-name')].every((e) => e.scrollWidth <= e.clientWidth + 1 && e.getBoundingClientRect().right <= vw && e.getBoundingClientRect().height > 8), right: vw - Math.max(...b.map((r) => r.right)), left: Math.min(...b.map((r) => r.left)), vw, sw: document.documentElement.scrollWidth, h1w: h1.width, h1right: h1.right, art: [...nav.children].every((e) => e.querySelector('svg')), titles: [...nav.children].map((e) => e.title) };
});

(async () => {
  const t = await start(new Map(), { local: true, today: '2026-11-12', viewport: { width: 390, height: 844 } });
  const page = t.page;
  await addKid(page, 'Dory'); await setGrade(page, 'Dory', 4);
  const id = await kidId(page);
  // from 识字: math, english, science
  await page.evaluate((r) => (location.hash = r), route.chinese(id)); await page.waitForSelector('header.kid-hero .shortcuts');
  let b = await bar(page);
  ok(b && b.ids.join() === 'math,english,science,coding' && b.round && b.art && b.labels.join() === '数学,英语,科学,编程' && b.labelsOk, '识字 child page: four round icons (math, english, science, coding) with their pictures and their NAMES under them');
  ok(b.right >= 8 && b.right <= 16 && b.sw <= b.vw && b.h1right <= b.left, 'right-aligned at the edge, no overflow, the title does not run under them');
  await page.screenshot({ path: OUT + 'shortcuts-chinese.png' });
  // each icon leads to the same child in that subject; there the icons are the other three
  for (const target of ['math', 'english', 'science', 'coding']) {
    await page.evaluate((r) => (location.hash = r), route.chinese(id)); await page.waitForSelector('header.kid-hero .shortcuts');
    await page.click(`#go-${target}`);
    await page.waitForFunction((r) => location.hash === r, route[target](id));
    await page.waitForFunction((x) => document.querySelector('header.kid-hero .shortcuts') && !document.querySelector('#go-' + x), target);   // (the new page, not the one we left)
    const hero = await page.textContent('header.kid-hero h1');
    b = await bar(page);
    ok(hero.includes('Dory') && b.ids.join() === ALL.filter((x) => x !== target).join(), `${target}: the same child (Dory) is open and the icons are now ${b.ids.join(', ')}`);
    ok(b.right >= 8 && b.right <= 16 && b.sw <= b.vw, `${target}: right-aligned, nothing sideways`);
    await page.screenshot({ path: OUT + `shortcuts-${target}.png` });
  }
  // a child with no grade yet: the shortcut asks for the grade there (as opening it does), and cancelling goes back to the list
  await page.evaluate(() => (location.hash = '#/')); await page.waitForSelector('.hub-grid');
  await addKid(page, 'Leo');
  const leo = await page.evaluate(() => JSON.parse(localStorage.getItem('learn.local.kids.json')).kids.find((k) => k.name === 'Leo').id);
  await page.evaluate((r) => (location.hash = r), route.chinese(leo)); await page.waitForSelector('header.kid-hero .shortcuts');
  await page.click('#go-math');
  await page.waitForSelector('dialog');
  ok(await page.locator('dialog').count() === 1, 'a child without a grade: the shortcut to maths asks for the grade first');
  ok(t.log.external.length === 0, 'no request left the app');
  await t.browser.close();

  // ---- screens and languages ----
  for (const [loc, name] of [['zh-CN', 'zh'], ['en-US', 'en'], ['fr-FR', 'fr']]) {
    for (const [dn, vp] of [['phone', { width: 320, height: 568 }], ['ipad', { width: 820, height: 1180 }], ['landscape-small', { width: 844, height: 390 }]]) {
      const s = await start(new Map(), { local: true, locale: loc, viewport: vp, today: '2026-11-12' });
      await addKid(s.page, 'Alexandrina'); await setGrade(s.page, 'Alexandrina', 5);
      const sid = await kidId(s.page);
      for (const subj of ALL) {
        await s.page.evaluate((r) => (location.hash = r), route[subj](sid)); await s.page.waitForSelector('header.kid-hero .shortcuts');
        const m = await bar(s.page);
        ok(m && m.round && m.labelsOk && m.sw <= m.vw && m.right >= 6 && m.h1w >= 60 && m.h1right <= m.left + 1, `${name} ${dn} ${subj}: four round icons right-aligned, no overflow, title keeps ${Math.round(m.h1w)} px`);
        if (name !== 'zh' && subj === 'chinese') ok(m.titles.join() === (name === 'en' ? 'Math,French,Science,Coding' : 'Maths,Anglais,Sciences,Programmation') && m.labels.join() === m.titles.join(), `${name}: the icon names under the icons are translated (${m.labels.join()})`);
      }
      await s.browser.close();
    }
  }
  await done();
})();
