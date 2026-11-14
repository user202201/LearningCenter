// Backup / restore of the data kept on this device (Settings -> 备份与恢复, src/backup.ts) and the native bridge (src/native.ts):
// the export has every learn.* key but NEVER the token / admin hash / offline copies, the import restores them (preview + confirmation, cancel changes nothing),
// a wrong or hostile file is refused or has its dangerous keys dropped, EN / FR, 3 screen sizes, and the bridge to the shells (a pretend HarmonyBridge receives
// print + file; back key steps). NOT tested: the real iOS / Android share sheet and print dialog (needs the native shells), a real GitHub account.
const fs = require('fs');
const path = require('path');
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });

const SEED = {
  'learn.profile.v1': JSON.stringify({ kids: { k1: { grade: 4, setOn: '2026-11-01' } } }),
  'learn.math.v1': JSON.stringify({ secs: 300, keypad: true }),
  'learn.music.takes.v1': JSON.stringify([{ id: 't1', name: 'Demo', date: '2026-11-01', ms: 1000, events: [] }]),
  'learn.chem.v1': JSON.stringify({ level: 2, plays: 3 }),
  'learn.local.kids.json': JSON.stringify({ kids: [{ id: 'k1', name: 'Dory' }] }),
};
const DANGER = {
  'learn.auth.v1': JSON.stringify({ token: 'SECRET-TOKEN-123', repo: 'a/b' }),
  'learn.admin.v1': 'HASH-SECRET', 'learn.token.exp.v1': '2027-01-01', 'learn.storage': 'local', 'learn.lastRepo': 'a/b',
  'learn.sync.v1.a/b.kids.json': '{"copy":true}',
};
const put = (page, o) => page.evaluate((o) => { for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v); }, o);
const get = (page, k) => page.evaluate((k) => localStorage.getItem(k), k);
const openSettings = async (page) => { await page.evaluate(() => (location.hash = '#/settings')); await page.waitForSelector('#backup-card'); };
const exportFile = async (page, name) => {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#backup-export')]);
  const f = path.join(OUT, name); await dl.saveAs(f);
  return { name: dl.suggestedFilename(), text: fs.readFileSync(f, 'utf8'), path: f };
};
const importFile = async (page, file) => {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#backup-import')]);
  await fc.setFiles(file);
};
const write = (name, content) => { const f = path.join(OUT, name); fs.writeFileSync(f, typeof content === 'string' ? content : JSON.stringify(content)); return f; };
const toastText = (page) => page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map((t) => t.textContent).join(' | '));

(async () => {
  // ---------- export ----------
  let t = await start(new Map(), { local: true, today: '2026-11-10' });
  let { page } = t;
  await put(page, { ...SEED, ...DANGER });
  await openSettings(page);
  ok((await page.textContent('#backup-card h3')) === '备份与恢复', 'Settings has the card "备份与恢复" with an export and an import button');
  const ex = await exportFile(page, 'backup-1.json');
  ok(/^learning-center-backup-\d{8}-\d{4}\.json$/.test(ex.name), `the file is named with the date and time (${ex.name})`);
  const j = JSON.parse(ex.text);
  ok(j.app === 'learning-center-backup' && j.version === 1 && !!j.created && !!j.build, 'the file says what it is: app, version, date, build');
  ok(Object.keys(SEED).every((k) => j.keys[k] === SEED[k]), 'every device-only key is in the file, byte for byte (grades, settings, music takes, progress, this-device children)');
  ok(Object.keys(DANGER).every((k) => !(k in j.keys)), 'the token, its end date, the admin hash, the storage choice, the last repository and the offline copies are NOT in the file');
  ok(!ex.text.includes('SECRET-TOKEN-123') && !ex.text.includes('HASH-SECRET'), 'no secret appears anywhere in the file text');
  ok(/导出|备份已导出/.test(await toastText(page)), 'a message tells that the backup was made: ' + (await toastText(page)).slice(0, 60));

  // ---------- import: cancel, then confirm ----------
  await put(page, { 'learn.math.v1': JSON.stringify({ secs: 60 }), 'learn.chem.v1': '{"level":1}' });
  await page.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((x) => x.remove()));
  await importFile(page, ex.path);
  await page.waitForSelector('dialog.center');
  const dlgText = await page.textContent('dialog.center');
  ok(/导入备份？/.test(dlgText) && /共 \d+ 项/.test(dlgText) && /不含登录令牌/.test(dlgText), 'a preview asks first: date, number of items and "no token" are named: ' + dlgText.replace(/\s+/g, ' ').slice(0, 90));
  await page.click('dialog.center button:has-text("取消")'); await page.waitForSelector('dialog', { state: 'detached' });
  ok((await get(page, 'learn.chem.v1')) === '{"level":1}' && (await get(page, 'learn.math.v1')) === JSON.stringify({ secs: 60 }), 'cancelling changes nothing');
  ok(!/已导入/.test(await toastText(page)), 'cancelling gives no "done" message (rule 8)');
  await importFile(page, ex.path); await page.waitForSelector('dialog.center');
  await page.click('dialog.center button.danger');
  await page.waitForFunction(() => /已导入/.test(document.body.innerText) || performance.now() > 0);
  await page.waitForLoadState('load'); await page.waitForTimeout(2200);   // (it reloads itself)
  ok((await get(page, 'learn.chem.v1')) === SEED['learn.chem.v1'] && (await get(page, 'learn.math.v1')) === SEED['learn.math.v1'] && (await get(page, 'learn.music.takes.v1')) === SEED['learn.music.takes.v1'], 'confirming restores the keys of the file');
  ok((await get(page, 'learn.auth.v1')) === DANGER['learn.auth.v1'] && (await get(page, 'learn.admin.v1')) === 'HASH-SECRET', 'the sign-in and the admin password of this device are left as they were');

  // ---------- refused / hostile files ----------
  const before = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
  for (const [label, f] of [
    ['not JSON', write('bad-1.json', 'hello {')],
    ['another app', write('bad-2.json', { app: 'something-else', version: 1, keys: { 'learn.x': '1' } })],
    ['a newer version', write('bad-3.json', { app: 'learning-center-backup', version: 99, keys: { 'learn.x': '1' } })],
    ['no data', write('bad-4.json', { app: 'learning-center-backup', version: 1, keys: {} })],
    ['only foreign / forbidden keys', write('bad-5.json', { app: 'learning-center-backup', version: 1, keys: { 'evil.key': 'x', 'learn.auth.v1': '{"token":"PLANTED","repo":"x/y"}', 'learn.sync.v1.a/b.f': 'x' } })],
  ]) {
    await page.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((x) => x.remove()));
    await openSettings(page); await importFile(page, f); await page.waitForTimeout(500);
    ok((await page.locator('dialog.center').count()) === 0 && /无效/.test(await toastText(page)), `refused: ${label} (message, no question)`);
  }
  ok((await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()))) === before, 'after five refused files nothing in the storage changed');
  // a good file that ALSO carries dangerous keys: the good keys come in, the dangerous ones are dropped
  const mixed = write('mixed.json', { app: 'learning-center-backup', version: 1, created: '2026-11-01T10:00:00Z', build: 'x', keys: { 'learn.bio.v1': '{"done":1}', 'learn.auth.v1': '{"token":"PLANTED","repo":"x/y"}', 'evil.key': 'x', 'learn.admin.v1': 'PLANTED' } });
  await openSettings(page); await importFile(page, mixed); await page.waitForSelector('dialog.center');
  ok(/1 项/.test(await page.textContent('dialog.center')), 'the preview counts only the keys that will be used (1 of 4)');
  await page.click('dialog.center button.danger'); await page.waitForTimeout(2600);
  ok((await get(page, 'learn.bio.v1')) === '{"done":1}' && (await get(page, 'evil.key')) === null && !(await get(page, 'learn.auth.v1')).includes('PLANTED') && (await get(page, 'learn.admin.v1')) === 'HASH-SECRET', 'a hand-made file can not plant a token, an admin hash or a foreign key');
  await t.browser.close();

  // ---------- the bridge to the native shells (a pretend HarmonyBridge; the web must be unchanged without it) ----------
  t = await start(new Map(), { local: true, today: '2026-11-10', init: () => { window.__bridge = { calls: [] }; if (window.__stub) window.HarmonyBridge = { printPage: (n) => { window.__bridge.calls.push(['print', n]); return 'ok'; }, saveFile: (n, m, b) => { window.__bridge.calls.push(['save', n, m, b]); return 'ok'; }, exitApp: () => { window.__bridge.calls.push(['exit']); return 'ok'; } }; } });
  page = t.page;
  const web = await page.evaluate(async () => { const N = await import('/src/native.ts'); return { native: N.isNative(), platform: N.platform() }; });
  ok(web.native === false && web.platform === 'web', 'without a shell isNative() is false (the web keeps its own behaviour)');
  let printed = 0; await page.evaluate(() => { window.__p = 0; window.print = () => { window.__p++; }; });
  await page.evaluate(async () => { const N = await import('/src/native.ts'); await N.printPage(); }); printed = await page.evaluate(() => window.__p);
  ok(printed === 1, 'on the web printPage() is the browser print (window.print once)');
  const r = await page.evaluate(async () => { const N = await import('/src/native.ts'); return N.saveFile(new TextEncoder().encode('abc'), 'x.txt', 'text/plain'); });
  ok(r === 'downloaded', 'on the web saveFile() is a download');
  await t.browser.close();

  t = await start(new Map(), { local: true, today: '2026-11-10', init: () => { window.__stub = true; window.__bridge = { calls: [] }; window.HarmonyBridge = { printPage: (n) => { window.__bridge.calls.push(['print', n]); return 'ok'; }, saveFile: (n, m, b) => { window.__bridge.calls.push(['save', n, m, b]); return 'ok'; }, exitApp: () => { window.__bridge.calls.push(['exit']); return 'ok'; } }; } });
  page = t.page;
  await put(page, { ...SEED, ...DANGER });
  const h = await page.evaluate(async () => { const N = await import('/src/native.ts'); return { native: N.isNative(), platform: N.platform() }; });
  ok(h.native && h.platform === 'harmony', 'a HarmonyOS shell is recognised');
  await page.evaluate(async () => { const N = await import('/src/native.ts'); await N.printPage('字帖'); });
  ok(JSON.stringify(await page.evaluate(() => window.__bridge.calls)) === JSON.stringify([['print', '字帖']]), 'printPage() goes to the shell (and does not call window.print)');
  await openSettings(page); await page.click('#backup-export'); await page.waitForFunction(() => window.__bridge.calls.some((c) => c[0] === 'save'));
  const sv = (await page.evaluate(() => window.__bridge.calls)).find((c) => c[0] === 'save');
  const body = Buffer.from(sv[3], 'base64').toString('utf8');
  ok(/^learning-center-backup-.*\.json$/.test(sv[1]) && sv[2] === 'application/json' && JSON.parse(body).keys['learn.profile.v1'] === SEED['learn.profile.v1'] && !body.includes('SECRET-TOKEN-123'), 'the backup goes to the shell as a file (name, type, base64 of the JSON, no token)');
  // back key: dialog first, then history, then leave at the picker
  await page.evaluate(() => { location.hash = '#/chinese'; }); await page.waitForSelector('.kids, .empty-home');
  const steps = await page.evaluate(async () => {
    const N = await import('/src/native.ts'); const out = [];
    const exit = () => out.push('exit');
    const d = document.createElement('dialog'); document.body.append(d); d.showModal();
    N.backStep({ exit }); out.push('dialog:' + document.querySelectorAll('dialog[open]').length);
    location.hash = '#/settings'; await new Promise((r) => setTimeout(r, 200));
    N.backStep({ exit }); await new Promise((r) => setTimeout(r, 300)); out.push('hash:' + location.hash);
    location.hash = '#/'; await new Promise((r) => setTimeout(r, 200));
    N.backStep({ exit }); out.push('at picker');
    return out;
  });
  ok(steps.join(',') === 'dialog:0,hash:#/chinese,exit,at picker', 'back key: closes a dialog, then one step back, at the picker it leaves: ' + steps.join(','));
  await t.browser.close();

  // ---------- English / French (the texts come from src/i18n-extra/backup.json until they are merged into i18n-data.ts) ----------
  const extra = JSON.parse(fs.readFileSync('src/i18n-extra/backup.json', 'utf8'));
  for (const [loc, nm, idx] of [['en-US', 'EN', 0], ['fr-FR', 'FR', 1]]) {
    t = await start(new Map(), { local: true, locale: loc, today: '2026-11-10', viewport: { width: 390, height: 844 } });
    page = t.page;
    const patch = '\n' + Object.entries(extra).map(([k, v]) => `if (!(${JSON.stringify(k)} in ${nm})) ${nm}[${JSON.stringify(k)}] = ${JSON.stringify(v[idx])};`).join('\n') + '\n';
    await t.ctx.route('**/src/i18n-data.ts*', async (route) => { const rr = await route.fetch(); await route.fulfill({ response: rr, body: (await rr.text()) + patch }); });
    await page.reload(); await page.waitForSelector('.hub-grid, .kids, .empty-home');
    await put(page, SEED); await openSettings(page);
    const cjk = () => page.evaluate(() => { const out = []; const w = document.createTreeWalker(document.querySelector('#backup-card') || document.body, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (/[一-鿿]/.test(n.nodeValue)) out.push(n.nodeValue.trim().slice(0, 24)); return out; });
    ok(!(await cjk()).length, `${nm}: the backup card has no Chinese left`);
    const title = await page.textContent('#backup-card h3');
    ok(title === (nm === 'EN' ? 'Backup and restore' : 'Sauvegarde et restauration'), `${nm}: title "${title}"`);
    const exp = await exportFile(page, `backup-${nm}.json`);
    const tt = await toastText(page);
    ok(!/[一-鿿]/.test(tt) && /Backup exported|Sauvegarde exportée/.test(tt), `${nm}: export message translated: ${tt.slice(0, 60)}`);
    await importFile(page, exp.path); await page.waitForSelector('dialog.center');
    const dt = await page.textContent('dialog.center');
    ok(!/[一-鿿]/.test(dt) && /\b\d+ (items|éléments)/.test(dt), `${nm}: the import question is translated and names the count: ${dt.replace(/\s+/g, ' ').slice(0, 70)}`);
    await page.click('dialog.center button:first-child'); await page.waitForSelector('dialog', { state: 'detached' });
    await page.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((x) => x.remove()));
    await importFile(page, write('bad-x.json', 'nope')); await page.waitForTimeout(400);
    ok(!/[一-鿿]/.test(await toastText(page)) && /not valid|n'est pas valide/.test(await toastText(page)), `${nm}: the refusal is translated: ${(await toastText(page)).slice(0, 60)}`);
    await t.browser.close();
  }

  // ---------- 3 screen sizes ----------
  for (const [name, vp] of [['iPhone SE', { width: 320, height: 568 }], ['iPhone', { width: 390, height: 844 }], ['iPad', { width: 820, height: 1180 }]]) {
    t = await start(new Map(), { local: true, today: '2026-11-10', viewport: vp, touch: true });
    page = t.page; await openSettings(page);
    await page.locator('#backup-card').scrollIntoViewIfNeeded();
    const m = await page.evaluate(() => {
      const c = document.querySelector('#backup-card').getBoundingClientRect(), vw = document.documentElement.clientWidth;
      const b = [...document.querySelectorAll('#backup-card button')].map((x) => { const r = x.getBoundingClientRect(); return { h: r.height, l: r.left, r: r.right, clip: x.scrollWidth > x.clientWidth + 1 }; });
      return { vw, sw: document.documentElement.scrollWidth, l: c.left, r: c.right, b, pc: (() => { const p = document.querySelector('#backup-card p'); return p.scrollWidth <= p.clientWidth + 1; })() };
    });
    ok(m.sw <= m.vw && m.l >= 0 && m.r <= m.vw + 0.5, `${name}: the card fits the screen, no sideways scroll`);
    ok(Math.abs(m.l - (m.vw - m.r)) < 2, `${name}: equal space left and right (${m.l.toFixed(1)} / ${(m.vw - m.r).toFixed(1)})`);
    ok(m.b.length === 2 && m.b.every((x) => x.h >= 40 && !x.clip && x.l >= 0 && x.r <= m.vw), `${name}: both buttons are at least 40 px high, not clipped (${m.b.map((x) => x.h.toFixed(0)).join('/')})`);
    await page.screenshot({ path: path.join(OUT, `92-backup-${name.replace(/ /g, '-')}.png`) });
    await t.browser.close();
  }
  done();
})().catch((e) => { console.error(e); process.exit(1); });
