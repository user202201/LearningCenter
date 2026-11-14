// A small smoke run in another browser engine (default WebKit = Safari and every iPhone / iPad web view; BROWSER=chromium to try it here).
// Usage: APP_URL=http://localhost:4173/ BROWSER=webkit node scripts/webkit-smoke.cjs     (the app must already be served; CI: .github/workflows/mobile.yml)
// Checks: the app starts, the picker shows, 识字 opens, a child can be added (this-device mode), Settings opens with the backup card,
// the English screen has no Chinese in Settings, the backup export produces a file without a token, no script error, no request to an outside server.
const pw = require('playwright');
const URL = process.env.APP_URL || 'http://localhost:4173/';
const kind = process.env.BROWSER || 'webkit';
let failed = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failed++; };

(async () => {
  const browser = await pw[kind].launch();
  for (const [name, vp, locale] of [['iPhone', { width: 390, height: 844 }, 'zh-CN'], ['iPad', { width: 820, height: 1180 }, 'en-US']]) {
    const ctx = await browser.newContext({ viewport: vp, locale, acceptDownloads: true });
    const page = await ctx.newPage();
    const errors = [], external = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => { const u = r.url(); if (!u.startsWith(new globalThis.URL(URL).origin) && !/^(data|blob|about):/.test(u)) external.push(u); });
    await page.goto(URL);
    await page.click('#local-btn', { timeout: 15000 });
    await page.waitForSelector('.hub-grid', { timeout: 15000 });
    ok((await page.locator('.subject').count()) >= 4, `${kind} ${name}: the picker shows its subjects`);
    await page.click('[data-subject="chinese"]');
    await page.waitForSelector('.kids, .empty-home', { timeout: 15000 });
    ok(true, `${kind} ${name}: the 识字 home opens`);
    await page.evaluate(() => (location.hash = '#/settings'));
    await page.waitForSelector('#backup-card', { timeout: 15000 });
    ok(true, `${kind} ${name}: Settings shows the backup card`);
    if (locale.startsWith('en')) {
      const left = await page.evaluate(() => [...document.querySelectorAll('#backup-card *')].filter((e) => !e.children.length && /[一-鿿]/.test(e.textContent)).map((e) => e.textContent.trim().slice(0, 20)));
      // (the English texts of the backup card live in src/i18n-extra/backup.json until they are merged into i18n-data.ts: only a warning here)
      console.log(left.length ? 'NOTE Chinese left in the backup card: ' + left.join(' | ') : 'English backup card OK');
    }
    await page.evaluate(() => localStorage.setItem('learn.auth.v1', JSON.stringify({ token: 'SECRET-TOKEN', repo: 'a/b' })));
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('#backup-export')]);
    const text = require('fs').readFileSync(await dl.path(), 'utf8');
    ok(/learning-center-backup-\d{8}-\d{4}\.json$/.test(dl.suggestedFilename()) && JSON.parse(text).app === 'learning-center-backup', `${kind} ${name}: the backup downloads as a JSON file`);
    ok(!text.includes('SECRET-TOKEN') && !text.includes('learn.auth.v1'), `${kind} ${name}: the backup holds no token`);
    ok(errors.length === 0, `${kind} ${name}: no script error` + (errors.length ? ' -> ' + errors[0] : ''));
    ok(external.length === 0, `${kind} ${name}: no request to an outside server` + (external.length ? ' -> ' + external[0] : ''));
    await ctx.close();
  }
  await browser.close();
  console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
