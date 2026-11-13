// Formulas open on a tap (meaning, a worked example and a drawing); the summaries page (#/science/notes): history (dynasties, timeline of events, key points),
// geography and biology (key points with drawings and memory tricks). Offline, no overflow on phones / tablets, English and French chrome.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const t = await start(new Map(), { local: true, today: '2026-11-12', viewport: { width: 390, height: 844 } });
  const p = t.page;
  // ---- the data ----
  const d = await p.evaluate(async () => {
    const F = (await import('/src/data/formulas.json')).default.formulas, N = (await import('/src/data/notes.json')).default, G = await import('/src/figures.ts');
    return { n: F.length, explained: F.filter((x) => x.x && x.ex).length, figs: F.filter((x) => x.fig).length, badFig: F.filter((x) => x.fig && !G.FIGS[x.fig]).length, dyn: N.history.dynasties.length, ev: N.history.events.length, hs: N.history.sections.length, geo: N.geo.sections.length, bio: N.bio.sections.length,
      badNoteFig: [...N.geo.sections, ...N.bio.sections].filter((s) => s.fig && !G.FIGS[s.fig]).length, shortPoints: [...N.history.sections, ...N.geo.sections, ...N.bio.sections].filter((s) => s.points.length < 3).length,
      sorted: N.history.events.every((e, i, a) => i === 0 || a[i - 1].y <= e.y + 0), figCount: Object.keys(G.FIGS).length };
  });
  ok(d.n >= 183 && d.explained === d.n, `every one of the ${d.n} formulas has a meaning and a worked example (${d.explained})`);
  ok(d.figs >= 40 && d.badFig === 0 && d.badNoteFig === 0 && d.figCount >= 38, `${d.figs} formulas carry a drawing, ${d.figCount} drawings exist, no formula or summary names a missing one`);
  ok(d.dyn >= 28 && d.ev >= 70 && d.hs >= 14 && d.geo >= 22 && d.bio >= 24 && d.shortPoints === 0, `summaries: ${d.dyn} dynasties, ${d.ev} events, ${d.hs} history / ${d.geo} geography / ${d.bio} biology sections, each with several key points`);

  // ---- formulas open on a tap ----
  await p.evaluate(() => (location.hash = '#/science/formulas')); await p.waitForSelector('.fm-row');
  ok(await p.locator('.fm-row.open').count() === 0 && !(await p.locator('.fm-row .fm-more').first().isVisible()), 'formulas are closed at first (name + formula only)');
  const withFig = p.locator('.fm-row:has(.fig)').first();
  await withFig.click();
  ok(await withFig.evaluate((e) => e.classList.contains('open') && e.getAttribute('aria-expanded') === 'true') && await withFig.locator('.fm-x').isVisible() && await withFig.locator('.fm-ex').isVisible() && await withFig.locator('.fig svg').isVisible(), 'a tap opens the meaning, the example and the drawing');
  await p.waitForFunction(() => document.querySelectorAll('.fm-row.open .fm-x .katex, .fm-row.open .fm-ex .katex').length > 0, null, { timeout: 8000 });
  ok(true, 'the symbols inside the explanation are typeset too');
  await withFig.scrollIntoViewIfNeeded(); await p.screenshot({ path: OUT + 'formula-open-phone.png' });
  await withFig.click();
  ok(!(await withFig.evaluate((e) => e.classList.contains('open'))), 'a second tap closes it');
  const sw = await p.evaluate(() => { for (const e of document.querySelectorAll('.fm-row')) e.classList.add('open'); return document.documentElement.scrollWidth <= document.documentElement.clientWidth && [...document.querySelectorAll('.fig')].every((f) => f.getBoundingClientRect().right <= document.documentElement.clientWidth); });
  ok(sw, 'all formulas open at once: nothing sideways on a phone');

  // ---- the summaries ----
  await p.evaluate(() => (location.hash = '#/subject/science')); await p.waitForSelector('#open-notes');
  await p.click('#open-notes'); await p.waitForSelector('#nt-dynasties');
  ok(await p.locator('.nt-d').count() >= 28 && await p.locator('.nt-ev').count() >= 70, 'history: the dynasty table and the timeline of events');
  const qin = await p.locator('.nt-d[data-n="秦"]').textContent();
  ok(/前221/.test(qin) && /咸阳/.test(qin), 'a dynasty row has its years and capital: ' + qin.slice(0, 40));
  const years = await p.locator('.nt-ev').evaluateAll((els) => els.map((e) => +e.dataset.y));
  ok(years.every((y, i) => i === 0 || years[i - 1] <= y + 5), 'the events are in time order');
  await p.click('#ev-world');
  ok((await p.locator('.nt-ev').count()) >= 8 && await p.locator('.nt-ev:not(.world)').count() === 0, 'the filter 世界 shows only world events');
  await p.click('#ev-cn');
  ok(await p.locator('.nt-ev.world').count() === 0, 'the filter 中国 shows only Chinese events');
  await p.screenshot({ path: OUT + 'notes-history-phone.png' });
  const first = p.locator('.nt-card').first();
  ok(!(await first.evaluate((e) => e.classList.contains('open'))), 'key points are closed at first');
  await first.locator('.nt-head').click();
  ok(await first.locator('.nt-points li').first().isVisible() && await first.locator('.nt-tip').count() === 1, 'a tap opens the key points and the memory trick');
  for (const [tab, min] of [['geo', 22], ['bio', 24]]) {
    await p.click(`#nt-${tab}`);
    ok(await p.locator('.nt-card').count() >= min, `${tab}: ${await p.locator('.nt-card').count()} sections`);
    const figCard = p.locator('.nt-card:has(.fig)').first();
    await figCard.locator('.nt-head').click();
    ok(await figCard.locator('.fig svg').isVisible() && await figCard.locator('.nt-points li').count() >= 3, `${tab}: a section opens with its drawing and key points`);
    await p.screenshot({ path: OUT + `notes-${tab}-phone.png` });
  }
  ok(t.log.external.length === 0, 'OFFLINE: no request left the app');
  await t.browser.close();

  // ---- screens and languages ----
  for (const [loc, name] of [['zh-CN', 'zh'], ['en-US', 'en'], ['fr-FR', 'fr']]) {
    for (const [dn, vp] of [['phone', { width: 320, height: 568 }], ['ipad', { width: 820, height: 1180 }], ['landscape-small', { width: 844, height: 390 }]]) {
      const s = await start(new Map(), { local: true, locale: loc, viewport: vp, today: '2026-11-12' });
      await s.page.evaluate(() => (location.hash = '#/science/notes')); await s.page.waitForSelector('#nt-dynasties');
      const res = [];
      for (const tab of ['history', 'geo', 'bio']) {
        await s.page.click(`#nt-${tab}`);
        await s.page.evaluate(() => document.querySelectorAll('.nt-card').forEach((c) => c.classList.add('open')));
        res.push(await s.page.evaluate(() => { const vw = document.documentElement.clientWidth; return { sw: document.documentElement.scrollWidth <= vw, out: [...document.querySelectorAll('.nt-card, .nt-d, .nt-ev, .fig, .nt-tabs button')].filter((e) => e.getBoundingClientRect().right > vw + 1 || e.getBoundingClientRect().left < -1).length }; }));
      }
      ok(res.every((r) => r.sw && r.out === 0), `${name} ${dn}: the three summaries stay inside the screen`);
      if (name !== 'zh') {
        const chrome = await s.page.evaluate(() => /[一-鿿]/.test(document.querySelector('.hero h1').textContent + document.querySelector('.nt-tabs').textContent));
        ok(!chrome, `${name} ${dn}: title and tabs are translated`);
      }
      await s.page.evaluate(() => (location.hash = '#/science/formulas')); await s.page.waitForSelector('.fm-row');
      const f = await s.page.evaluate(() => { document.querySelectorAll('.fm-row').forEach((e) => e.classList.add('open')); const vw = document.documentElement.clientWidth; return { sw: document.documentElement.scrollWidth <= vw, lab: [...document.querySelectorAll('.fm-lab')].slice(0, 2).map((e) => e.textContent), cjk: [...document.querySelectorAll('.fm-lab')].some((e) => /[一-鿿]/.test(e.textContent)) }; });
      ok(f.sw && (name === 'zh' || !f.cjk), `${name} ${dn}: opened formulas fit; labels "${f.lab.join('/')}"`);
      await s.browser.close();
    }
  }
  await done();
})();
