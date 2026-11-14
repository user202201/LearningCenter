// Translated CONTENT (rule 65): the formulas and the summaries (history / geography / biology / politics / safety, with their drawings) follow the screen language.
// Source of truth: src/data/trans/<lang>.json (made from parts/ by scripts/make-trans.mjs). Checks: coverage by scripts/check-trans.mjs (nothing missing, TeX untouched),
// no Chinese left on the pages in en / fr (the original name may stay in brackets), nothing sideways and no label outside its drawing on 320 / 390 / 820 px,
// Chinese unchanged in zh, a language switch in the app, no outside request.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const { execFileSync } = require('child_process');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  // ---- coverage (node) ----
  const res = JSON.parse(execFileSync('node', ['scripts/check-trans.mjs', '--json'], { encoding: 'utf8', maxBuffer: 1 << 28 }));
  for (const lang of ['en', 'fr']) {
    const r = res[lang];
    ok(r.total >= 4000, `${lang}: ${r.total} Chinese source strings (formulas ${r.byGroup.formulas.total}, summaries ${r.byGroup.notes.total}, drawing labels ${r.byGroup.figures.total})`);
    ok(r.missing.length === 0, `${lang}: nothing without a translation` + (r.missing.length ? ` -> ${r.missing.length} missing, e.g. ${r.missing.slice(0, 3).map((m) => `[${m.group}] ${m.text.slice(0, 20)}`).join(' | ')}` : ''));
    ok(r.badTex.length === 0 && r.leftover.length === 0 && r.empty.length === 0, `${lang}: TeX untouched, no Chinese left in a translation, none empty` + (r.badTex.length ? ' tex:' + r.badTex[0].src.slice(0, 30) : '') + (r.leftover.length ? ' left:' + r.leftover[0].src.slice(0, 30) : ''));
  }
  // frame texts (titles, tabs, chips) of these pages
  const extra = JSON.parse(fs.readFileSync('src/i18n-extra/scienceinfo.json', 'utf8'));
  ok(Object.entries(extra).every(([k, v]) => Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'string' && x.trim() && !/[一-鿿]/.test(x)) && [...k].length > 1), `src/i18n-extra/scienceinfo.json: ${Object.keys(extra).length} frame texts, each with an English and a French text, no one-character key`);

  const CJK_SCAN = () => {
    const out = [];
    const strip = (s) => s.replace(/\([^()]*\)|（[^（）]*）/g, '');
    const w = document.createTreeWalker(document.querySelector('main') || document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { if (/[一-鿿]/.test(strip(n.nodeValue))) out.push(n.nodeValue.trim().slice(0, 30)); }
    for (const e of document.querySelectorAll('main [title], main [aria-label]')) for (const a of ['title', 'aria-label']) { const v = e.getAttribute(a); if (v && /[一-鿿]/.test(strip(v))) out.push(a + ':' + v.slice(0, 30)); }
    return out;
  };
  const LAYOUT = () => {
    const vw = document.documentElement.clientWidth;
    const bad = [];
    if (document.documentElement.scrollWidth > vw) bad.push('page scrolls sideways');
    for (const e of document.querySelectorAll('.nt-card, .nt-d, .nt-ev, .fig, .fm-row, .nt-tabs button, .nt-stages button, .nt-must, .nt-sub button, .pt-filter button')) { const r = e.getBoundingClientRect(); if (r.width && (r.right > vw + 1 || r.left < -1)) bad.push('outside:' + e.className + ':' + (e.textContent || '').trim().slice(0, 20)); }
    // a label of a drawing must stay inside its drawing
    for (const svg of document.querySelectorAll('.fig svg')) {
      const vb = svg.viewBox.baseVal;
      for (const t of svg.querySelectorAll('text')) { if (!t.textContent.trim()) continue; let b; try { b = t.getBBox(); } catch (e) { continue; } if (b.x < vb.x - 1.5 || b.x + b.width > vb.x + vb.width + 1.5) bad.push('label out of drawing:' + t.textContent.slice(0, 20) + ` (${Math.round(b.x)}..${Math.round(b.x + b.width)})`); }
    }
    return bad;
  };

  // ---- the two languages, three screens ----
  for (const [loc, nm, idx] of [['en-US', 'en', 0], ['fr-FR', 'fr', 1]]) {
    for (const [dn, vp] of [['phone320', { width: 320, height: 568 }], ['phone390', { width: 390, height: 844 }], ['ipad', { width: 820, height: 1180 }]]) {
      const t = await start(new Map(), { local: true, locale: loc, today: '2026-11-12', viewport: vp });
      // the lead merges src/i18n-extra/scienceinfo.json into src/i18n-data.ts; until then the test adds the texts to the module the app loads
      const patch = '\n' + Object.entries(extra).map(([k, v]) => `if (!(${JSON.stringify(k)} in ${nm.toUpperCase()})) ${nm.toUpperCase()}[${JSON.stringify(k)}] = ${JSON.stringify(v[idx])};`).join('\n') + '\n';
      await t.ctx.route('**/src/i18n-data.ts*', async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()) + patch }); });
      await t.page.reload(); await t.page.waitForSelector('.hub-grid, .kids, .empty-home');
      const p = t.page;
      // formulas
      await p.evaluate(() => (location.hash = '#/science/formulas')); await p.waitForSelector('.fm-row');
      await p.waitForFunction(() => document.querySelector('.fm-name') && !/[一-鿿]/.test(document.querySelector('.fm-name').textContent), null, { timeout: 8000 });
      await p.evaluate(() => document.querySelectorAll('.fm-row').forEach((e) => e.classList.add('open')));
      await p.waitForFunction(() => document.querySelectorAll('.fm-row .katex').length > 100, null, { timeout: 20000 }).catch(() => {});
      let left = await p.evaluate(CJK_SCAN);
      ok(left.length === 0, `${nm} ${dn}: formulas page has no Chinese left (${left.length}: ${left.slice(0, 3).join(' | ')})`);
      let lay = await p.evaluate(LAYOUT);
      ok(lay.length === 0, `${nm} ${dn}: formulas fit the screen` + (lay.length ? ' -> ' + lay.slice(0, 3).join(' | ') : ''));
      const names = await p.locator('.fm-name').allTextContents();
      ok(names.length === 183 && names.every((n) => n.trim().length > 3), `${nm} ${dn}: 183 formula names (${names[0]} / ${names[100]})`);
      if (nm === 'en' && dn === 'phone390') {
        await p.locator('.fm-row:has(.fig)').first().scrollIntoViewIfNeeded(); await p.screenshot({ path: OUT + `content-formulas-${nm}-${dn}.png` });
        await p.locator('.chem, .fm-group[data-k="化学"]').first().scrollIntoViewIfNeeded(); await p.screenshot({ path: OUT + `content-formulas-chem-${nm}-${dn}.png` });
      }
      // summaries
      await p.evaluate(() => (location.hash = '#/subject/science')); await p.waitForSelector('#open-notes');
      await p.click('#open-notes'); await p.waitForSelector('#nt-dynasties');
      const tabsText = (await p.locator('.nt-tabs button').allTextContents()).join('|');
      ok(!/[一-鿿]/.test(tabsText) && !/[一-鿿]/.test(await p.locator('.hero h1').textContent()), `${nm} ${dn}: title and tabs translated (${tabsText})`);
      const problems = [];
      const visit = async (label) => {
        await p.evaluate(() => document.querySelectorAll('.nt-card').forEach((c) => c.classList.add('open')));
        const l = await p.evaluate(CJK_SCAN); const y = await p.evaluate(LAYOUT);
        if (l.length) problems.push(`${label}: Chinese "${l.slice(0, 2).join(' | ')}"`);
        if (y.length) problems.push(`${label}: ${y.slice(0, 2).join(' | ')}`);
      };
      await visit('history/dynasties');
      await p.click('#hs-ev'); await visit('history/events');
      await p.click('#ev-world'); await visit('history/events-world'); await p.click('#ev-cn'); await visit('history/events-cn');
      await p.click('#hs-key');
      for (const tab of ['history', 'geo', 'bio', 'politics', 'safety']) {
        await p.click(`#nt-${tab}`); if (tab === 'history') await p.click('#hs-key');
        const n = await p.locator('#nt-stages button').count();
        const chipTxt = (await p.locator('#nt-stages button').allTextContents()).join(' / ');
        if (/[一-鿿]/.test(chipTxt.replace(/\([^()]*\)|（[^（）]*）/g, ''))) problems.push(`${tab}: stage chips have Chinese: ${chipTxt}`);
        for (let i = 0; i < Math.max(n, 1); i++) { if (n) await p.click(`#grp-${i}`); await visit(`${tab}/${i}`); }
        if (dn === 'phone320' || dn === 'phone390') { await p.locator('.nt-card:has(.fig)').first().scrollIntoViewIfNeeded().catch(() => {}); if (nm === 'en' || tab === 'safety') await p.screenshot({ path: OUT + `content-notes-${tab}-${nm}-${dn}.png` }); }
      }
      ok(problems.length === 0, `${nm} ${dn}: every summary tab, stage and section is in the screen language and fits` + (problems.length ? ` -> ${problems.length} problems: ${problems.slice(0, 4).join(' || ')}` : ''));
      // the original keys stay in data attributes (tests and links use them)
      await p.click('#nt-history'); await p.click('#hs-dyn');
      ok(await p.locator('.nt-d[data-n="秦"]').count() === 1, `${nm} ${dn}: data attributes keep the Chinese source key`);
      ok(t.log.external.length === 0, `${nm} ${dn}: no request left the app`);
      await t.browser.close();
    }
  }

  // ---- Chinese unchanged, and a language switch in the app ----
  {
    const t = await start(new Map(), { local: true, locale: 'zh-CN', today: '2026-11-12', viewport: { width: 390, height: 844 } });
    const p = t.page;
    const src = await p.evaluate(async () => { const F = (await import('/src/data/formulas.json')).default.formulas; const N = (await import('/src/data/notes.json')).default; return { names: F.map((f) => f.n), dyn: N.history.dynasties[3].n, tip: N.geo.groups[0].sections[0].tip, h: N.geo.groups[0].sections[0].h }; });
    await p.evaluate(() => (location.hash = '#/science/formulas')); await p.waitForSelector('.fm-row');
    const names = await p.locator('.fm-name').allTextContents();
    ok(names.length === src.names.length && names.every((n, i) => n === src.names[i]), 'zh: the 183 formula names are the Chinese source texts, unchanged');
    await p.evaluate(() => (location.hash = '#/subject/science')); await p.waitForSelector('#open-notes');
    await p.click('#open-notes'); await p.waitForSelector('#nt-dynasties');
    ok((await p.locator('.nt-d b').nth(3).textContent()) === src.dyn, 'zh: the dynasties are the Chinese source texts');
    ok(await p.locator('svg text[data-zh]').count() === 0, 'zh: drawing labels are not touched');
    await p.click('#nt-geo'); await p.locator('.nt-card').first().locator('.nt-head').click();
    ok((await p.locator('.nt-card').first().locator('.nt-title').textContent()) === src.h && (await p.locator('.nt-card').first().locator('.nt-tip span').textContent()) === src.tip, 'zh: section title and memory trick unchanged');
    // switch to English in Settings (the way a user does), come back to the page: it is translated
    await p.evaluate(async () => { const m = await import('/src/i18n.ts'); m.setLang('en'); location.hash = '#/science/formulas'; });
    await p.waitForSelector('.fm-row');
    await p.waitForFunction(() => !/[一-鿿]/.test(document.querySelector('.fm-name').textContent), null, { timeout: 8000 });
    ok(true, 'switching the language in the app translates the formulas page at once when it is opened');
    await p.evaluate(async () => { const m = await import('/src/i18n.ts'); m.setLang('zh'); location.hash = '#/subject/science'; });
    await p.waitForSelector('#open-notes'); await p.evaluate(() => (location.hash = '#/science/formulas')); await p.waitForSelector('.fm-row');
    await p.waitForTimeout(200);
    ok((await p.locator('.fm-name').first().textContent()) === src.names[0], 'switching back to Chinese restores the source texts');
    ok(t.log.external.length === 0, 'zh: no request left the app');
    await t.browser.close();
  }
  await done();
})();
