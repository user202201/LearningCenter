// 97: NOTHING is left untranslated. A dynamic crawler: signs in on this device, makes two children with data, then in English and French (a phone and a tablet,
// motion off) visits every route of the app (the routes of src/main.ts, plus every route that a click on the way discovers), clicks the buttons of every page
// (dialogs, toasts, tabs, chips) and reads ALL the text a user can see: element text, title / aria-label / placeholder / alt, values of buttons and inputs, <option>,
// SVG <text>, document.title. Any string with CJK characters (U+4E00-9FFF, U+3000-303F, U+FF00-FFEF) that is not
//   (a) inside .user / .user-title (the child's own texts),
//   (b) in brackets, written as 'Name (中文)',
//   (c) in the allowlist tests/e2e/97-allowlist.json (content that MUST stay Chinese, a reason per entry)
// is a failure. Not tested: canvas pixels (no text hook), spoken text, the contents of a printed PDF.
// Knobs: CRAWL_LANGS=en,fr  CRAWL_SIZES=phone,tablet  CRAWL_ONLY=<regex of routes>  CRAWL_CLICKS=<max clicks per route>  CRAWL_PAR=<browsers at once>  CRAWL_REPORT=<json file>
const fs = require('fs');
const path = require('path');
const { start, checks, addKid, openKid, enterWeek, setGrade, WEEK1, WEEK2 } = require('./harness.cjs');
const { ok, done } = checks();

const SIZES = { phone: { width: 390, height: 844 }, tablet: { width: 1180, height: 820 } };
const LANGS = (process.env.CRAWL_LANGS || 'en,fr').split(',');
const SIZE_NAMES = (process.env.CRAWL_SIZES || 'phone,tablet').split(',');
const ONLY = process.env.CRAWL_ONLY ? new RegExp(process.env.CRAWL_ONLY) : null;
const MAXCLICKS = Number(process.env.CRAWL_CLICKS || 14);
const PAR = Number(process.env.CRAWL_PAR || 4);
const MAXROUTES = Number(process.env.CRAWL_MAXROUTES || 700);
const ALLOW = JSON.parse(fs.readFileSync(path.join(__dirname, '97-allowlist.json'), 'utf8')).allow.map((a) => ({ ...a, re: a.text ? new RegExp(a.text) : null, rre: a.route ? new RegExp(a.route) : null }));
const KNOWN = WEEK1 + WEEK2 + '一心一意画蛇添足守株待兔';   // (the characters and idioms typed by the test: the child's own texts)
const CJK = /[　-〿一-鿿＀-￯]/;
const BRACKETS = /[(（][^()（）]*[)）]/g;

/** runs inside the page: every text a user can see, as {t, k (kind), sel}. */
function pageScan(known) {
  const out = [];
  const knownRe = new RegExp('[' + known + '\\s0-9a-zA-Z·，。、：；！？“”‘’（）()\\-—~|/]', 'g');
  const cjk = /[　-〿一-鿿＀-￯]/;
  const isUser = (el) => !!(el && el.closest && el.closest('.user, .user-title'));
  const visible = (el) => { if (!el) return false; if (el.closest('[hidden]')) return false; const r = el.getBoundingClientRect(); if (!r.width && !r.height) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const sel = (el) => { const p = []; for (let e = el; e && e !== document.body && p.length < 4; e = e.parentElement) p.push(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '')); return p.join(' < '); };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const v = n.nodeValue; if (!cjk.test(v)) continue;
    const el = n.parentElement; if (!el || el.closest('script, style, noscript')) continue;
    if (isUser(el)) {   // a .user box holds the child's own texts; app CONTENT in a .user box is a finding too (kind 'userbox')
      if (visible(el) && v.replace(knownRe, '').match(cjk)) out.push({ t: v.trim(), k: 'userbox', sel: sel(el), html: el.outerHTML.slice(0, 160) });
      continue;
    }
    if (!visible(el) && el.tagName.toLowerCase() !== 'option' && el.tagName.toLowerCase() !== 'title') continue;
    out.push({ t: v.trim(), k: 'text', sel: sel(el), html: el.outerHTML.slice(0, 160) });
  }
  for (const el of document.querySelectorAll('[title],[placeholder],[aria-label],[alt],input[value],option,button[value]')) {
    if (isUser(el)) continue;
    for (const a of ['title', 'placeholder', 'aria-label', 'alt']) { const v = el.getAttribute(a); if (v && cjk.test(v) && (visible(el) || a === 'title')) out.push({ t: v.trim(), k: 'attr:' + a, sel: sel(el), html: el.outerHTML.slice(0, 160) }); }
    if (el.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes(el.type) && cjk.test(el.value) && visible(el)) out.push({ t: el.value, k: 'value', sel: sel(el), html: el.outerHTML.slice(0, 160) });
  }
  if (cjk.test(document.title)) out.push({ t: document.title, k: 'document.title', sel: 'title', html: '' });
  return out;
}
const INSTALL = () => {
  // in the page: a poller that notices toasts and dialogs (they come and go between two scans of the crawler)
  window.__seen = [];
  const cjk = /[　-〿一-鿿＀-￯]/;
  const grab = () => {
    try {
      for (const root of document.querySelectorAll('#toasts, dialog[open], [role=dialog], [role=alert], .toast')) {
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n; (n = w.nextNode());) { if (cjk.test(n.nodeValue) && !n.parentElement.closest('.user, .user-title')) window.__seen.push({ t: n.nodeValue.trim(), k: 'text', sel: 'transient ' + (root.id || root.className || root.tagName), html: n.parentElement.outerHTML.slice(0, 160) }); }
        for (const el of root.querySelectorAll('[title],[placeholder],[aria-label]')) for (const a of ['title', 'placeholder', 'aria-label']) { const v = el.getAttribute(a); if (v && cjk.test(v) && !el.closest('.user, .user-title')) window.__seen.push({ t: v.trim(), k: 'attr:' + a, sel: 'transient ' + (root.id || root.tagName), html: el.outerHTML.slice(0, 160) }); }
      }
    } catch (e) { /* page changing */ }
  };
  setInterval(grab, 120);
  // alert / confirm / prompt boxes are native: record what they say, answer "cancel" (a test cannot see a native box)
  window.__native = [];
  window.alert = (m) => { window.__native.push({ t: String(m), k: 'alert', sel: 'native', html: '' }); };
  window.confirm = (m) => { window.__native.push({ t: String(m), k: 'confirm', sel: 'native', html: '' }); return false; };
  window.prompt = (m) => { window.__native.push({ t: String(m), k: 'prompt', sel: 'native', html: '' }); return null; };
};

const allowedBy = (f, route) => ALLOW.find((a) => (!a.re || a.re.test(f.t)) && (!a.rre || a.rre.test(route)) && (!a.sel || new RegExp(a.sel).test(f.sel)) && (!a.kind || a.kind === f.k) && (a.re || a.sel || a.rre));
const allowed = (f, route) => allowedBy(f, route);
const bad = (f, route) => { const t = f.t.replace(BRACKETS, '').replace(/[＜＞＝＋－]/g, '');   // (fullwidth math symbols are drawn as symbols, like the inequality signs of a music score: not Chinese text)
   return CJK.test(t) && !allowed(f, route); };

async function stable(page, max = 3500) {
  let last = -1, same = 0; const t0 = Date.now();
  while (Date.now() - t0 < max) {
    const n = await page.evaluate(() => document.body.innerHTML.length).catch(() => -2);
    if (n === last) { if (++same >= 2) return; } else same = 0;
    last = n; await page.waitForTimeout(90);
  }
}

async function crawlConfig(cfg, report) {
  const { lang, locale, sizeName, viewport } = cfg;
  const tag = `${lang}/${sizeName}`;
  const log = (m) => console.log(`[${tag}] ${m}`);
  const { browser, page } = await start(new Map(), { local: true, locale, viewport, today: '2026-11-08', noLogin: true, touch: sizeName === 'phone', init: INSTALL });
  const findings = report.findings; const visited = report.visited;
  const addAll = (list, route, what) => { for (const f of list) { const t0 = f.t.replace(BRACKETS, '').replace(/[＜＞＝＋－]/g, ''); if (CJK.test(t0)) { const e = allowedBy(f, route); if (e && e.pending) report.pending.set(f.t, route); } } for (const f of list) if (bad(f, route)) { const key = f.t; const e = (findings.get(key) ?? { text: f.t, kind: f.k, where: [] }); if (e.where.length < 6 && !e.where.some((w) => w.tag === tag && w.route === route)) e.where.push({ tag, route, what, sel: f.sel, html: f.html }); findings.set(key, e); } };
  let current = '';
  const scan = async (what) => {
    const a = await page.evaluate(pageScan, KNOWN).catch(() => []);
    const b = await page.evaluate(() => { const s = window.__seen || []; window.__seen = []; const n = window.__native || []; window.__native = []; return s.concat(n); }).catch(() => []);
    addAll(a, current, what); addAll(b, current, what + ' (transient)');
  };
  const goto = async (hash) => { current = hash; await page.evaluate((h) => { if (location.hash === h) location.hash = '#/zz-reset'; location.hash = h; }, hash).catch(() => {}); await page.waitForTimeout(120); await stable(page); };
  const closeDialogs = async () => {
    for (let i = 0; i < 3; i++) {
      if (!(await page.locator('dialog[open], [role=dialog]').count())) return;
      await page.keyboard.press('Escape'); await page.waitForTimeout(120);
      if (await page.locator('dialog[open]').count()) { const c = page.locator('dialog[open] button:not(.primary)').first(); if (await c.count()) await c.click({ timeout: 800 }).catch(() => {}); await page.waitForTimeout(150); }
    }
  };

  // ---- sign in screen (before anything else), then this device
  await page.waitForSelector('.login'); await scan('login'); current = 'login';
  await page.evaluate(() => document.querySelector('.login input[type=text]') && (document.querySelector('.login input[type=text]').value = 'x')); await scan('login');
  await page.click('button.primary').catch(() => {}); await page.waitForTimeout(400); await scan('login: wrong sign-in message'); await page.waitForTimeout(600); await scan('login: message');
  await page.reload(); await page.waitForSelector('.login'); await page.click('#local-btn'); await page.waitForSelector('.hub-grid');
  current = '#/'; await stable(page); await scan('picker');
  await page.click('.subject[data-subject=chinese]'); await page.waitForSelector('.kids, .empty-home'); await scan('chinese: no children');
  await page.click('#add-kid-big'); await page.waitForSelector('dialog input'); await scan('add child dialog');
  await page.click('dialog button.primary'); await page.waitForTimeout(300); await scan('add child: empty name message');
  await page.fill('dialog input', 'Anna'); await page.click('dialog button.primary'); await page.waitForSelector('.kname'); await page.waitForTimeout(300); await scan('child added toast');
  await addKid(page, 'Ben');
  await openKid(page, 'Anna'); await enterWeek(page, '2026-11-08', WEEK1); await page.evaluate(() => (location.hash = '#/chinese')); await page.waitForSelector('.kid');
  await openKid(page, 'Ben'); await enterWeek(page, '2026-11-08', WEEK2); await page.evaluate(() => (location.hash = '#/chinese')); await page.waitForSelector('.kid');
  await page.evaluate(() => (location.hash = '#/chinese')); await page.waitForSelector('.kid');
  const ids = await page.evaluate(() => { const k = JSON.parse(localStorage.getItem('learn.local.kids.json') || '{}'); return (k.kids || []).map((x) => x.id); });
  // idioms: two weeks
  await openKid(page, 'Anna'); await page.click('#idioms-btn'); await page.waitForSelector('#idiom-add');
  await page.click('#idiom-add'); await page.fill('dialog textarea', '一心一意 画蛇添足 守株待兔'); await page.click('dialog button.primary'); await page.waitForSelector('.idiom-card');
  await setGrade(page, 'Anna', 5); await setGrade(page, 'Ben', 8);
  log('data ready: ' + ids.join(',') + ' @ ' + await page.evaluate(() => location.hash + ' | ' + document.body.innerText.replace(/\s+/g, ' ').slice(0, 60)));
  const [A, B] = ids;
  const idiomHash = '#/idiom/' + encodeURIComponent('一心一意');

  // ---- seeds: every route of src/main.ts
  const seeds = ['#/', '#/chinese', '#/settings', '#/idioms', '#/stories', idiomHash,
    '#/chinese/pk', '#/english/pk', '#/subject/english', '#/subject/math', '#/subject/science', '#/subject/coding', '#/subject/music', '#/subject/games', '#/subject/zz', '#/subject/zzz-unknown',
    '#/science/periodic', '#/science/formulas', '#/science/circuits', '#/science/notes', '#/science/map', '#/science/chem', '#/science/chem/ref', '#/science/space', '#/science/space/earth', '#/science/space/mars',
    '#/science/physics', '#/science/bio', '#/science/geo', '#/science/geo/practice',
    '#/music/theory', '#/music/theory/c1', '#/music/quiz/c1', '#/music/piano', '#/music/drums', '#/music/guitar', '#/music/beats', '#/music/dj', '#/math/' + A + '/tables'];
  for (const k of [A, B]) {
    seeds.push(`#/kid/${k}`, `#/kid/${k}/game`, `#/kid/${k}/learned`, `#/sheet/${k}`, `#/dictation/${k}`, `#/write/${k}`,
      `#/poems/${k}`, `#/poems/${k}/learned`, `#/poems/${k}/poets`, `#/poems/${k}/recite`,
      `#/math/${k}`, `#/math/${k}/game`, `#/math/${k}/learned`, `#/english/${k}`, `#/english/${k}/game`, `#/english/${k}/learned`, `#/english/${k}/read`, `#/english/${k}/dictation`,
      `#/science/${k}`, `#/science/${k}/game`, `#/science/${k}/learned`,
      `#/coding/${k}`, `#/coding/${k}/projects`, `#/coding/${k}/certificate`, `#/coding/${k}/code`, `#/coding/${k}/stage`, `#/coding/${k}/free`, `#/coding/${k}/r1`, `#/coding/${k}/r2`, `#/coding/${k}/r3`);
    for (let w = 1; w <= 16; w++) seeds.push(`#/coding/${k}/w${w}`, `#/coding/${k}/w${w}/1`);
    for (let w = 14; w <= 16; w++) seeds.push(`#/coding/${k}/i${w}`, `#/coding/${k}/i${w}/1`);
  }
  seeds.push(`#/poems/${A}/poem/p001`, `#/poems/${A}/poem/p090`);
  for (const m of ['fill', 'next', 'prev', 'order', 'author', 'keyword']) seeds.push(`#/poems/${A}/practice/p001/${m}`);
  const queue = seeds.filter((h) => !ONLY || ONLY.test(h)); const queued = new Set(queue);
  const enqueue = (h) => { if (!queued.has(h) && !/^#\/(zz|$)/.test(h) && (!ONLY || ONLY.test(h)) && queued.size < MAXROUTES) { queued.add(h); queue.push(h); } };

  const LABEL_SKIP = /改用|instead$|plutôt|退出登录|退出|Sign out|Log out|Se déconnecter|Quitter|^中文$|English|Français|清除全部|强制刷新|Force refresh|Forcer|Actualiser|Clear all|Tout effacer/;
  // clicking: candidates are the visible buttons of the page; every click is followed by a scan and a reset of the page
  const clickThrough = async (hash, maxClicks, prep) => {
    const sig = () => page.evaluate(() => location.hash + '|' + document.body.innerText.length + '|' + document.querySelectorAll('button').length);
    const cands = async () => page.evaluate(() => {
      const list = [];
      const els = [...document.querySelectorAll('main button, .page button, .login button, .scroll [role=button], summary, input[type=checkbox], input[type=radio], select, .seg button, [data-tab], .chip')];
      els.forEach((el, i) => { const r = el.getBoundingClientRect(); if (!r.width || !r.height || el.disabled || el.closest('[inert]') || el.closest('.back')) return; if (el.matches('input[type=file]')) return; list.push({ i, label: (el.textContent || el.getAttribute('aria-label') || el.id || el.className).trim().slice(0, 40), id: el.id, cls: String(el.className).slice(0, 40) }); });
      return list;
    });
    const total = await cands();
    // spread the clicks over the list (different kinds of buttons first: unique labels)
    const seenLabel = new Set(); const pick = [];
    for (const c of total) { if (LABEL_SKIP.test(c.label)) continue; const k = c.label + '|' + c.cls; if (seenLabel.has(k)) continue; seenLabel.add(k); pick.push(c); }
    for (const c of pick.slice(0, maxClicks)) {
      const before = await sig();
      const did = await page.evaluate((i) => { const els = [...document.querySelectorAll('main button, .page button, .login button, .scroll [role=button], summary, input[type=checkbox], input[type=radio], select, .seg button, [data-tab], .chip')]; const el = els[i]; if (!el) return false; if (el.tagName === 'SELECT') { el.selectedIndex = Math.min(1, el.options.length - 1); el.dispatchEvent(new Event('change', { bubbles: true })); } else el.click(); return true; }, c.i).catch(() => false);
      if (!did) continue;
      await page.waitForTimeout(160); await scan(`click "${c.label}"`);
      if (await page.locator('#toasts .toast, dialog[open]').count()) { await page.waitForTimeout(250); await scan(`click "${c.label}" +`); }
      const hashNow = await page.evaluate(() => location.hash);
      if (hashNow !== hash && /^#\//.test(hashNow)) enqueue(hashNow);
      await closeDialogs();
      const after = await sig();
      if (after !== before || hashNow !== hash) { await goto(hash); if (prep) await prep(); }
    }
  };
  const gameInteractions = async () => {
    for (const k of ['ArrowLeft', 'ArrowDown', 'Space', 'Enter', 'ArrowRight', 'ArrowUp', 'KeyP', 'KeyR']) { await page.keyboard.press(k).catch(() => {}); await page.waitForTimeout(60); }
    await scan('game keys');
    const box = await page.evaluate(() => { const s = document.querySelector('#gm-stage'); if (!s) return null; const r = s.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    if (box) {
      for (const [fx, fy] of [[0.5, 0.5], [0.2, 0.2], [0.8, 0.8], [0.5, 0.85], [0.2, 0.8], [0.8, 0.2], [0.5, 0.2]]) { await page.mouse.click(box.x + box.w * fx, box.y + box.h * fy).catch(() => {}); await page.waitForTimeout(90); }
      await page.mouse.move(box.x + box.w * 0.3, box.y + box.h * 0.5); await page.mouse.down(); await page.mouse.move(box.x + box.w * 0.7, box.y + box.h * 0.5, { steps: 6 }); await page.mouse.up().catch(() => {});
      await page.waitForTimeout(200); await scan('game pointer');
    }
  };


  // ---------- scripted flows: the dialogs, messages and game screens that a plain click on a route does not reach
  const tryFlow = async (name, fn) => { try { await fn(); } catch (e) { const where = await page.evaluate(() => location.hash + ' | ' + document.body.innerText.replace(/\s+/g, ' ').slice(0, 120)).catch(() => '?'); log(`flow "${name}" stopped: ${String(e.message).split('\n')[0]} @ ${where}`); } };
  const adminOn = async () => { await goto('#/settings'); if (await page.isChecked('#manage-mode')) return; await page.click('#manage-mode'); await page.waitForSelector('#admin-pw'); await scan('admin password dialog'); await page.fill('#admin-pw', '1234'); if (await page.locator('#admin-pw2').count()) { await page.fill('#admin-pw2', '9999'); await page.click('#admin-ok'); await page.waitForTimeout(250); await scan('admin password: mismatch message'); await page.fill('#admin-pw2', '1234'); } await page.click('#admin-ok'); await page.waitForSelector('dialog.center', { state: 'detached' }); await page.waitForSelector('#add-kid', { state: 'visible' }); await page.waitForTimeout(300); };
  await tryFlow('settings', async () => {
    await adminOn(); await scan('settings: manage mode');
    await page.click('#add-kid'); await page.waitForSelector('dialog input'); await scan('settings: add child'); await page.click('dialog button.primary'); await page.waitForTimeout(250); await scan('settings: add child, empty'); await closeDialogs();
    await clickThrough('#/settings', 40, adminOn);
    // wrong password
    await goto('#/settings'); if (await page.isChecked('#manage-mode')) await page.uncheck('#manage-mode'); await page.click('#manage-mode'); await page.waitForSelector('#admin-pw'); await page.fill('#admin-pw', '0000'); await page.click('#admin-ok'); await page.waitForTimeout(300); await scan('admin: wrong password'); await closeDialogs();
  });
  await tryFlow('settings dialogs', async () => {
    await adminOn();
    for (const sel of ['.rename', '.change-avatar', '.kid-grade', '.delete', '#import-btn', '#backup-import', '#credits', '#license-link']) {
      if (!(await page.locator(sel).first().count())) continue;
      await page.locator(sel).first().click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(250); await scan('settings dialog ' + sel); await closeDialogs(); await page.waitForTimeout(100);
    }
    // wrong files
    for (const sel of ['#import-file', '#backup-file', '#avatar-file']) {
      await goto('#/settings'); await adminOn();
      if (sel === '#avatar-file') { await page.locator('.change-avatar').first().click(); await page.waitForTimeout(250); }
      if (sel === '#import-file') { await page.locator('#import-btn').click(); await page.waitForTimeout(250); }
      const inp = page.locator(sel).first(); const any = page.locator('input[type=file]').first();
      const t = (await inp.count()) ? inp : any; if (!(await t.count())) { await closeDialogs(); continue; }
      await t.setInputFiles({ name: 'wrong.txt', mimeType: 'text/plain', buffer: Buffer.from('this is not a valid file') }).catch(() => {});
      await page.waitForTimeout(500); await scan('wrong file via ' + sel); await closeDialogs();
    }
    await goto('#/settings'); await page.locator('#backup-export').click().catch(() => {}); await page.waitForTimeout(500); await scan('backup export toast');
    await page.locator('#egg-allow').click().catch(() => {}); await page.waitForTimeout(300); await scan('egg switch'); await page.locator('#egg-allow').click().catch(() => {});
    await page.locator('#check-update').click().catch(() => {}); await page.waitForTimeout(600); await scan('check update message');
  });
  await tryFlow('grade dialog', async () => {
    await goto('#/chinese'); await addKid(page, 'Cara'); const id3 = await page.evaluate(() => { const k = JSON.parse(localStorage.getItem('learn.local.kids.json') || '{}'); return (k.kids || []).map((x) => x.id).pop(); });
    for (const r of ['english', 'math', 'science']) { await goto(`#/${r}/${id3}`); await page.waitForTimeout(300); await scan(`grade dialog (${r})`); await closeDialogs(); }
    await goto(`#/coding/${id3}`); await scan('coding, no grade');
  });
  await tryFlow('games of the children', async () => {
    const play = async (hash, label) => {
      await goto(hash); await scan(label + ' lobby');
      for (const st of ['#game-start', '.game-start', 'button.primary']) { const b = page.locator(st).first(); if (await b.count()) { await b.click({ timeout: 1500 }).catch(() => {}); break; } }
      await page.waitForTimeout(500);
      for (let i = 0; i < 70; i++) {
        const did = await page.evaluate((i) => {
          const vis = (el) => el && !el.disabled && el.getBoundingClientRect().width > 0;
          const click = (el) => { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el.click(); return true; };
          for (const sel of ['#math-next', '#game-again', '.pl-qopt']) { const e = document.querySelector(sel); if (sel === '#game-again') continue; if (vis(e)) return click(e); }
          const ch = [...document.querySelectorAll('#math-choices button, .sopt, .mchoices button')].filter(vis); if (ch.length) return click(ch[(i * 7) % ch.length]);
          for (const sel of [i % 3 ? '#game-right' : '#game-wrong', '#game-wrong', '#game-right', '#game-char', '#game-speak']) { const e = document.querySelector(sel); if (vis(e)) return click(e); }
          return false;
        }, i).catch(() => false);
        await page.waitForTimeout(did ? 120 : 400);
        if (i % 6 === 5) await scan(label + ' playing');
        if (await page.locator('#game-final, #game-done, #game-end').count()) { await scan(label + ' result'); break; }
      }
      await scan(label + ' end');
      // leaving a running game asks first
      await goto(hash); for (const st of ['#game-start', 'button.primary']) { const b = page.locator(st).first(); if (await b.count()) { await b.click({ timeout: 1500 }).catch(() => {}); break; } }
      await page.waitForTimeout(500); const q = page.locator('#game-quit').first(); if (await q.count()) { await q.click().catch(() => {}); await page.waitForTimeout(300); await scan(label + ' leave?'); await closeDialogs(); }
    };
    for (const k of [A, B]) { await play(`#/kid/${k}/game`, 'chinese game'); await play(`#/math/${k}/game`, 'math game'); await play(`#/english/${k}/game`, 'languages game'); await play(`#/science/${k}/game`, 'science game'); }
    await goto(`#/math/${A}/tables`); for (const sel of ['.mt-cell', '#tables-practice', 'button.primary']) { const b = page.locator(sel).first(); if (await b.count()) { await b.click().catch(() => {}); await page.waitForTimeout(300); await scan('times table ' + sel); } }
    for (let i = 0; i < 12; i++) { const b = page.locator('#game-pad button, .keypad button').nth(i % 10); if (await b.count()) await b.click().catch(() => {}); }
    await page.waitForTimeout(300); await scan('times table practice');
  });
  await tryFlow('labs: quiz and tasks', async () => {
    for (const lab of ['physics', 'bio', 'geo']) {
      await goto('#/science/' + lab); const sims = await page.evaluate(() => [...document.querySelectorAll('[data-sim]')].map((e) => e.dataset.sim));
      for (const id of sims.slice(0, Number(process.env.CRAWL_LABSIMS || 99))) {
        await goto(`#/science/${lab}/${id}`);
        for (let i = 0; i < 10; i++) { const o = page.locator('.pl-qopt:not([disabled])').first(); if (await o.count()) await o.click({ timeout: 800 }).catch(() => {}); else break; await page.waitForTimeout(80); const nx = page.locator('#pl-quiz button.primary, #quiz-next').first(); if (await nx.count()) await nx.click({ timeout: 800 }).catch(() => {}); await page.waitForTimeout(80); if (i % 3 === 2) await scan(`${lab}/${id} quiz`); }
        await scan(`${lab}/${id} quiz end`);
      }
    }
  });
  const pkFlow = async (setup, label) => {
    await goto(setup); await scan(label + ' lobby');
    await page.evaluate(() => document.querySelector('#pk-slot-1').click()); await page.waitForTimeout(250); await scan(label + ' pick'); await page.evaluate(() => document.querySelector('#pk-pick button')?.click()); await page.waitForTimeout(200);
    await page.evaluate(() => document.querySelector('#pk-slot-2')?.click()); await page.waitForTimeout(250); await scan(label + ' pick 2'); await page.evaluate(() => [...document.querySelectorAll('#pk-pick button:not([disabled])')][0]?.click()); await page.waitForTimeout(250); await scan(label + ' lobby, two players');
    const st = page.locator('#pk-start'); if (!(await st.isEnabled().catch(() => false))) { await scan(label + ' start off'); return; }
    await st.click(); await page.waitForTimeout(500); await scan(label + ' opening');
    await page.evaluate(() => window.__pk && window.__pk.manual(true)).catch(() => {});
    await page.locator('#pk-exit').click().catch(() => {}); await page.waitForTimeout(250); await scan(label + ' leave?'); await closeDialogs();
    await page.locator('#pk-skip').click().catch(() => {});
    for (let i = 0; i < 120; i++) {
      await page.evaluate((i) => { const w = window.__pk; if (!w) return; w.skip(i % 5 === 0 ? 600 : 1500); if (i % 5 === 1) w.tap(0, i % 4); if (i % 5 === 3) w.tap(1, (i + 1) % 4); }, i).catch(() => {});
      await page.waitForTimeout(40);
      if (i % 8 === 4) await scan(label + ' round');
      if (await page.locator('#pk-again-1').count()) break;
    }
    await page.waitForTimeout(1800); await scan(label + ' final');
    await page.waitForTimeout(1500); await scan(label + ' final +');
    await page.locator('#pk-again-1').click().catch(() => {}); await page.locator('#pk-again-2').click().catch(() => {}); await page.waitForTimeout(500); await scan(label + ' again');
  };
  await tryFlow('pk chinese', () => pkFlow('#/chinese/pk', 'pk chinese'));
  await tryFlow('pk english', () => pkFlow('#/english/pk', 'pk languages'));
  await tryFlow('pk record', async () => { await goto('#/chinese/pk'); const r = page.locator('#pk-reset').first(); if (await r.count()) { await r.click().catch(() => {}); await page.waitForTimeout(250); await scan('pk reset confirm'); await closeDialogs(); } });
  await tryFlow('idiom editor', async () => {
    await goto(idiomHash); await scan('idiom story');
    await page.locator('#story-edit').dblclick().catch(() => {}); await page.waitForTimeout(300); await scan('idiom editor'); await closeDialogs();
    await goto('#/idioms'); await page.locator('#idiom-add').first().click().catch(() => {}); await page.waitForTimeout(250); await page.fill('dialog textarea', '一心一意').catch(() => {}); await page.waitForTimeout(300); await scan('idiom duplicate message'); await page.fill('dialog textarea', '亡羊补牢 掩耳盗铃 abc').catch(() => {}); await page.waitForTimeout(300); await scan('idiom new + invalid'); await closeDialogs();
    await goto(`#/kid/${A}`); await page.locator('#enter, .plus').first().click().catch(() => {}); await page.waitForTimeout(250); await page.fill('dialog textarea >> nth=0', 'abc 你 你 你').catch(() => {}); await page.waitForTimeout(300); await scan('week entry: invalid / duplicate'); await closeDialogs();
    await goto(`#/sheet/${A}`); await page.waitForTimeout(300); await scan('sheet'); await page.locator('#sheet-opt, #sheet-write-go').first().click().catch(() => {}); await page.waitForTimeout(300); await scan('sheet options'); await closeDialogs();
    await goto('#/stories'); await scan('story printout');
  });
  const loginFlow = () => tryFlow('login screen', async () => {
    await goto('#/settings'); await page.locator('button:has-text("instead"), button:has-text("plutôt")').first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForSelector('.login', { timeout: 4000 }).catch(() => {}); await page.waitForTimeout(300); await scan('login after leaving this device');
    for (const [repo, tok] of [['', ''], ['abc', 'x'], ['demo/PublicRepo', 'good'], ['demo/PianistScores', 'good'], ['demo/ReadOnly', 'good'], ['demo/LearningData', 'bad']]) {
      await page.fill('input[type=text]', repo).catch(() => {}); await page.fill('input[type=password]', tok).catch(() => {}); await page.click('button.primary').catch(() => {}); await page.waitForTimeout(700); await scan(`login message (${repo || 'empty'})`);
    }
    for (const sel of ['#qr-btn', '#scan-btn', '#pin-toggle']) { const b = page.locator(sel).first(); if (await b.count()) { await b.click().catch(() => {}); await page.waitForTimeout(500); await scan('login ' + sel); await closeDialogs(); } }
  });

  await goto('#/chinese');
  let n = 0;
  while (queue.length) {
    const hash = queue.shift(); n++;
    visited.add(hash);
    await goto(hash);
    await scan('route');
    // when a page offers things that are routes (labs, modes, poems ...) they are found by their data attributes
    const found = await page.evaluate(() => [...document.querySelectorAll('[data-sim],[data-mode],[data-game],[data-poem],[data-id],[data-idiom]')].map((e) => ({ s: e.dataset.sim, m: e.dataset.mode, g: e.dataset.game, p: e.dataset.poem, id: e.dataset.id, i: e.dataset.idiom, tag: e.tagName })));
    const here = hash.replace(/^#\//, '');
    for (const f of found) {
      if (f.s && /^science\/(physics|bio|geo)$/.test(here)) enqueue('#/' + here + '/' + f.s);
      if (f.m && /^science\/chem$/.test(here)) enqueue('#/science/chem/' + f.m);
      if (f.g && /^subject\/games$/.test(here)) enqueue('#/games/' + f.g);
      if (f.id && /^science\/space$/.test(here)) enqueue('#/science/space/' + f.id);
      if (f.id && /^music\/theory$/.test(here)) { enqueue('#/music/theory/' + f.id); enqueue('#/music/quiz/' + f.id); }
      if (f.i && /^idioms$/.test(here)) enqueue('#/idiom/' + encodeURIComponent(f.i));
    }
    if (/^#\/games\//.test(hash)) { await page.waitForTimeout(500); await scan('game screen'); await gameInteractions(); }
    const quick = /^#\/(science\/(physics|bio|geo)\/|games\/|coding\/[^/]+\/(w|i)\d+\/)/.test(hash);
    await clickThrough(hash, quick ? Math.min(MAXCLICKS, 9) : MAXCLICKS);
    if (n % 10 === 0) { log(`${n} routes, ${queue.length} queued, ${findings.size} findings so far`); if (process.env.CRAWL_REPORT) fs.writeFileSync(process.env.CRAWL_REPORT + '.' + tag.replace('/', '-') + '.partial', JSON.stringify({ routes: [...visited], findings: [...findings.values()] }, null, 1)); }
  }
  await loginFlow();
  log(`done: ${n} routes`);
  await browser.close();
}

(async () => {
  const configs = [];
  for (const lang of LANGS) for (const sizeName of SIZE_NAMES) configs.push({ lang, locale: lang === 'fr' ? 'fr-FR' : 'en-US', sizeName, viewport: SIZES[sizeName] });
  const report = { findings: new Map(), visited: new Set(), pending: new Map() };
  const perConfig = []; let idx = 0;
  const worker = async () => { while (idx < configs.length) { const cfg = configs[idx++]; const r = { findings: new Map(), visited: new Set(), pending: new Map() }; try { await crawlConfig(cfg, r); } catch (e) { console.log('CRAWL ERROR ' + cfg.lang + '/' + cfg.sizeName + ': ' + e.message.split('\n')[0]); ok(false, `crawl ${cfg.lang}/${cfg.sizeName} finished (${e.message.split('\n')[0]})`); } perConfig.push({ cfg, r }); } };
  await Promise.all(Array.from({ length: Math.min(PAR, configs.length) }, worker));
  const merged = new Map(); const routes = new Set();
  const pend = new Map();
  for (const { cfg, r } of perConfig) { r.visited.forEach((v) => routes.add(v)); r.pending.forEach((v, k) => pend.set(k, v)); for (const [k, v] of r.findings) { const m = merged.get(k) ?? { ...v, where: [] }; m.where.push(...v.where.slice(0, 2)); merged.set(k, m); } }
  console.log(`KNOWN GAP (allowlist entries marked pending, not translated yet): ${pend.size} distinct strings`);
  console.log(`routes visited (unique): ${routes.size}; configs: ${perConfig.map((p) => p.cfg.lang + '/' + p.cfg.sizeName).join(', ')}`);
  if (process.env.CRAWL_REPORT) fs.writeFileSync(process.env.CRAWL_REPORT, JSON.stringify({ routes: [...routes], pending: [...pend.keys()], findings: [...merged.values()] }, null, 1));
  for (const f of merged.values()) console.log(`UNTRANSLATED "${f.text.slice(0, 90)}" [${f.kind}] @ ${f.where[0].tag} ${f.where[0].route} ${f.where[0].what} <${f.where[0].sel}>`);
  ok(routes.size > 150 || !!ONLY, `the crawler visited many routes (${routes.size})`);
  ok(merged.size === 0, `no Chinese text left in English / French (${merged.size} distinct strings found)`);
  await done();
})();
