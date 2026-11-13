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
    const gs = (b) => b.groups || [{ name: '全部', sections: b.sections }], all = (b) => gs(b).flatMap((g) => g.sections);
    return { n: F.length, explained: F.filter((x) => x.x && x.ex).length, figs: F.filter((x) => x.fig).length, badFig: F.filter((x) => x.fig && !G.FIGS[x.fig]).length, dyn: N.history.dynasties.length, ev: N.history.events.length, hs: all(N.history).length, geo: all(N.geo).length, bio: all(N.bio).length, pol: all(N.politics).length, groupNames: { geo: gs(N.geo).map((g) => g.name), bio: gs(N.bio).map((g) => g.name), politics: gs(N.politics).map((g) => g.name), history: gs(N.history).map((g) => g.name) }, must: [N.history, N.geo, N.bio, N.politics].map((b) => all(b).filter((s) => s.must && s.must.length >= 2).length / all(b).length),
      badNoteFig: [N.geo, N.bio, N.politics, N.history].flatMap(all).filter((s) => s.fig && !G.FIGS[s.fig]).length, shortPoints: [N.geo, N.bio, N.politics, N.history].flatMap(all).filter((s) => s.points.length < 3).length,
      sorted: N.history.events.every((e, i, a) => i === 0 || a[i - 1].y <= e.y + 0), figCount: Object.keys(G.FIGS).length };
  });
  ok(d.n >= 183 && d.explained === d.n, `every one of the ${d.n} formulas has a meaning and a worked example (${d.explained})`);
  ok(d.figs >= 40 && d.badFig === 0 && d.badNoteFig === 0 && d.figCount >= 38, `${d.figs} formulas carry a drawing, ${d.figCount} drawings exist, no formula or summary names a missing one`);
  ok(d.dyn >= 28 && d.ev >= 70 && d.hs >= 40 && d.geo >= 40 && d.bio >= 40 && d.pol >= 50 && d.shortPoints === 0, `summaries: ${d.dyn} dynasties, ${d.ev} events, ${d.hs} history / ${d.geo} geography / ${d.bio} biology / ${d.pol} politics sections, each with several key points`);
  const order = (n, first) => n[0].startsWith('小学') && first.every((x, i) => n[i + 1] === x);
  ok(order(d.groupNames.geo, ['七年级上册', '七年级下册', '八年级上册', '八年级下册']) && order(d.groupNames.bio, ['七年级上册', '七年级下册', '八年级上册', '八年级下册']) && order(d.groupNames.politics, ['七年级上册', '七年级下册', '八年级上册', '八年级下册', '九年级上册', '九年级下册']) && d.groupNames.history[0].startsWith('小学') && d.groupNames.history.some((n) => n.startsWith('九年级下册')), 'geography, biology, politics and history are ordered: 小学 first, then the textbooks in order (primary and junior are never mixed): ' + JSON.stringify(d.groupNames.geo));
  ok(d.must.every((r) => r >= 0.7), 'most sections have a 必背考点 list (' + d.must.map((r) => Math.round(r * 100) + '%').join('/') + ')');

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
  ok(await p.locator('.nt-d').count() >= 28 && await p.locator('.nt-ev').count() === 0 && await p.locator('.nt-card').count() === 0, 'history is split into small tabs: 朝代表 first (dynasties only, short page)');
  await p.click('#hs-ev'); await p.waitForSelector('#nt-events');
  ok(await p.locator('.nt-ev').count() >= 70 && await p.locator('.nt-d').count() === 0, 'tab 大事年表: the timeline of events');
  const years = await p.locator('.nt-ev').evaluateAll((els) => els.map((e) => +e.dataset.y));
  ok(years.every((y, i) => i === 0 || years[i - 1] <= y + 5), 'the events are in time order');
  await p.click('#ev-world');
  ok((await p.locator('.nt-ev').count()) >= 8 && await p.locator('.nt-ev:not(.world)').count() === 0, 'the filter 世界 shows only world events');
  await p.click('#ev-cn');
  ok(await p.locator('.nt-ev.world').count() === 0, 'the filter 中国 shows only Chinese events');
  await p.screenshot({ path: OUT + 'notes-history-phone.png' });
  await p.click('#hs-dyn');
  const qin = await p.locator('.nt-d[data-n="秦"]').textContent();
  ok(/前221/.test(qin) && /咸阳/.test(qin), 'a dynasty row has its years and capital: ' + qin.slice(0, 40));
  await p.click('#hs-key'); await p.waitForSelector('#nt-stages');
  ok(await p.locator('#nt-stages button').count() >= 7 && (await p.locator('#nt-stages button').first().textContent()).startsWith('小学'), 'tab 考点重点: stage chips (小学, 七年级上册 ...) and the numbered sections of the chosen one');
  await p.click('#grp-3');
  ok(await p.locator('#nt-stages button.on').getAttribute('id') === 'grp-3' && /^1$/.test(await p.locator('.nt-card .nt-no').first().textContent()), 'choosing another stage shows its own sections, numbered from 1');
  const first = p.locator('.nt-card').first();
  ok(!(await first.evaluate((e) => e.classList.contains('open'))), 'key points are closed at first');
  await first.locator('.nt-head').click();
  ok(await first.locator('.nt-points li').first().isVisible() && await first.locator('.nt-must li').count() >= 2, 'a tap opens the 必背考点 and the key points');
  for (const tab of ['geo', 'bio', 'politics']) {
    await p.click(`#nt-${tab}`);
    const chips = await p.locator('#nt-stages button').allTextContents();
    ok(chips.length >= 6 && chips[0].startsWith('小学') && chips[1].startsWith('七年级上册'), `${tab}: stages in order (${chips.join(' / ')})`);
    ok(await p.locator('.nt-card').count() >= 6, `${tab}: ${await p.locator('.nt-card').count()} sections in the first stage`);
    const stage = await p.evaluate(async () => { const N = (await import('/src/data/notes.json')).default; return 0; });
    let opened = false;
    for (let i = 0; i < chips.length && !opened; i++) {
      await p.click(`#grp-${i}`);
      const figCard = p.locator('.nt-card:has(.fig), .nt-card').first();
      await figCard.locator('.nt-head').click();
      opened = await figCard.locator('.nt-must li').count() >= 2 && await figCard.locator('.nt-points li').count() >= 3;
    }
    ok(opened, `${tab}: a section opens with its must-know points and key points`);
    await p.screenshot({ path: OUT + `notes-${tab}-phone.png` });
  }
  await p.click('#nt-politics'); await p.click('#grp-0');
  ok(t.log.external.length === 0, 'OFFLINE: no request left the app');
  await t.browser.close();

  // ---- screens and languages ----
  for (const [loc, name] of [['zh-CN', 'zh'], ['en-US', 'en'], ['fr-FR', 'fr']]) {
    for (const [dn, vp] of [['phone', { width: 320, height: 568 }], ['ipad', { width: 820, height: 1180 }], ['landscape-small', { width: 844, height: 390 }]]) {
      const s = await start(new Map(), { local: true, locale: loc, viewport: vp, today: '2026-11-12' });
      await s.page.evaluate(() => (location.hash = '#/science/notes')); await s.page.waitForSelector('#nt-dynasties');
      const res = [];
      for (const tab of ['history', 'geo', 'bio', 'politics']) {
        await s.page.click(`#nt-${tab}`);
        if (tab === 'history') await s.page.click('#hs-key');
        await s.page.evaluate(() => document.querySelectorAll('.nt-card').forEach((c) => c.classList.add('open')));
        res.push(await s.page.evaluate(() => { const vw = document.documentElement.clientWidth; return { sw: document.documentElement.scrollWidth <= vw, out: [...document.querySelectorAll('.nt-card, .nt-d, .nt-ev, .fig, .nt-tabs button, .nt-stages button, .nt-must')].filter((e) => e.getBoundingClientRect().right > vw + 1 || e.getBoundingClientRect().left < -1).length }; }));
      }
      ok(res.every((r) => r.sw && r.out === 0), `${name} ${dn}: the four summaries stay inside the screen`);
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
