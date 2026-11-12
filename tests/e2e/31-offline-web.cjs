// The WEB version works offline after the first visit: a REAL production build (vite build + vite preview) is opened once, the service worker keeps every
// file of the build, then the network is cut and the page is reloaded: the app opens and English and math work (library, topics, generators are in the
// program). Also: the packaged-app build has no service worker; the update check still asks the network (version.json is not answered from the cache).
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const { chromium } = require('playwright');
const { checks } = require('./harness.cjs');
const { ok, done } = checks();
const OUT = path.resolve(process.env.D || 'tests/out/work/');
const DIST = path.join(OUT, 'dist-offline');
const PORT = 4188;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  execSync(`BASE_PATH=/ BUILD_ID=build-offline npx vite build --outDir "${DIST}" --emptyOutDir`, { stdio: 'pipe' });
  const sw = fs.readFileSync(path.join(DIST, 'sw.js'), 'utf8');
  const list = JSON.parse(sw.match(/const PRECACHE = (\[.*\]);/)[1]);
  ok(list.some((f) => /^assets\/english-words-.*\.js$/.test(f)) && list.some((f) => /^assets\/math-topics-.*\.js$/.test(f)) && list.includes('') && !list.includes('version.json'), 'the build lists every file for the service worker (also the word library and the topics); version.json is not in it: ' + list.length + ' files');
  ok(sw.includes('learning-center-build-offline'), 'the cache is named by the build id (a new build starts a new cache and removes the old one)');
  execSync(`MOBILE=1 BUILD_ID=build-M npx vite build --outDir "${DIST}-app" --emptyOutDir`, { stdio: 'pipe' });
  ok(!fs.existsSync(path.join(DIST + '-app', 'sw.js')), 'the packaged-app build has no service worker (its files are inside the app)');
  const srv = spawn('npx', ['vite', 'preview', '--outDir', DIST, '--port', String(PORT), '--strictPort'], { stdio: 'ignore', env: { ...process.env, BASE_PATH: '/' } });
  const browser = await chromium.launch();
  try {
    for (let i = 0; i < 40; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch {} await sleep(250); }
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN', reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForSelector('#local-btn');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(async () => (await caches.keys()).some((k) => k === 'learning-center-build-offline') && (await (await caches.open('learning-center-build-offline')).keys()).length >= 6, null, { timeout: 15000 });
    const kept = await page.evaluate(async () => (await (await caches.open('learning-center-build-offline')).keys()).map((r) => new URL(r.url).pathname));
    ok(kept.some((f) => /english-words-.*\.js$/.test(f)) && kept.some((f) => /math-topics-.*\.js$/.test(f)) && kept.includes('/'), 'the service worker kept the program, the word library and the topics (' + kept.length + ' files)');
    // the first visit: set things up while online (a child, in "this device" mode)
    await page.click('#local-btn'); await page.waitForSelector('.hub-grid');
    await page.click('.subject[data-subject=chinese]'); await page.waitForSelector('#add-kid-big');
    await page.click('#add-kid-big'); await page.fill('dialog input', 'Dory'); await page.click('dialog button.primary'); await page.waitForSelector('.kname');
    // ---- the network is cut ----
    await ctx.setOffline(true);
    await page.reload();
    await page.waitForSelector('.hub-grid, .kids, .empty-home', { timeout: 10000 });
    ok(true, 'OFFLINE: after a reload with no network the app opens');
    await page.evaluate(() => (location.hash = '#/')); await page.waitForSelector('.hub-grid');
    await page.click('.subject[data-subject=english]'); await page.waitForSelector('.kids');
    await page.click('.kid'); await page.waitForSelector('#grade-dlg'); await page.click('.grade-btn[data-grade="3"]'); await page.waitForSelector('.wrow', { timeout: 10000 });
    ok(await page.locator('.wrow').count() === 20, 'OFFLINE: English opens and makes this week\'s 20 words (the library is in the program)');
    await page.click('#tab-game'); await page.click('#game-start'); await page.waitForSelector('#game-char');
    ok((await page.textContent('#game-char')).length > 0, 'OFFLINE: the English game runs');
    await page.click('#game-quit'); await page.click('dialog button.danger'); await page.waitForSelector('.tabs');
    await page.evaluate(() => (location.hash = '#/')); await page.waitForSelector('.hub-grid');
    await page.click('.subject[data-subject=math]'); await page.waitForSelector('.kids');
    await page.click('.kid'); await page.waitForSelector('.mtcard', { timeout: 10000 });   // (the grade chosen in English is used: it is asked once per child)
    ok(await page.locator('.grade-row').textContent().then((x) => x.includes('三年级')), 'the grade chosen in English (三年级) is used by math, not asked again');
    await page.click('#tab-game'); await page.click('#game-start'); await page.waitForSelector('#math-q');
    ok(await page.locator('.mchoice').count() === 4, 'OFFLINE: math opens, picks the topics and runs a game (the questions are made by the program)');
    // the update check must ask the network (not the kept copy): it fails now, and says so
    const v = await page.evaluate(async () => { try { await fetch(new URL('version.json?t=1', document.baseURI), { cache: 'no-store' }); return 'answered'; } catch (e) { return 'failed'; } });
    ok(v === 'failed', 'offline, version.json is not answered from the cache (the update check asks the network)');
    await ctx.setOffline(false);
    await ctx.close();
  } finally {
    await browser.close();
    srv.kill();
  }
  await done();
})();
