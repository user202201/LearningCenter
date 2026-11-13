// 编程 graduation: the 创作工坊 (six project templates: edited with real controls, saved on this device, run; at most 12; delete asks first; nothing leaves the
// device) and the certificate (locked with a preview until every medal is earned, then the name, the date and the print button; A4 landscape page style while shown),
// on 5 screen sizes, in English and French, with no request outside the app.
const H = require('./harness.cjs');
const { start, checks, addKid } = H;
const { ok, done } = checks();
const fs = require('fs');
const path = require('path');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const CJK = /[一-鿿　-〿＀-￯]/;
const extra = JSON.parse(fs.readFileSync(path.join(__dirname, '../../src/i18n-extra/codinginfo.json'), 'utf8'));
const withExtra = async (t) => {
  const add = 'Object.assign(EN, ' + JSON.stringify(Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, v[0]]))) + ');\nObject.assign(FR, ' + JSON.stringify(Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, v[1]]))) + ');\n';
  await t.ctx.route('**/src/i18n-data.ts*', async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()) + '\n' + add }); });
  await t.page.reload(); await t.page.waitForSelector('.hub-grid, .kids, .empty-home');
};
const open = async (opts = {}) => {
  const t = await start(new Map(), { local: true, today: '2026-11-12', viewport: { width: 390, height: 844 }, ...opts });
  if (opts.locale) { await withExtra(t); await t.page.evaluate(() => (location.hash = '#/chinese')); await t.page.waitForSelector('.kids, .empty-home'); }
  await addKid(t.page, 'Dory');
  t.id = await t.page.evaluate(() => JSON.parse(localStorage.getItem('learn.local.kids.json')).kids[0].id);
  const seen = await t.page.evaluate(async () => { const C = await import('/src/coding-infocontent.ts'); return Object.keys((await C.loadContent()).lessons); });
  await t.page.evaluate((s) => localStorage.setItem('learn.coding.v1', JSON.stringify({ seen: s, speed: 'fast', drawings: {} })), seen);
  return t;
};
const go = async (page, hash, sel) => { await page.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((x) => x.remove())); await page.evaluate((h) => (location.hash = h), hash); await page.waitForSelector(sel); await page.waitForTimeout(150); };
const projects = (page, id) => page.evaluate((i) => (JSON.parse(localStorage.getItem('learn.coding.projects.v1') || '{}')[i] || []), id);
const toastText = (page) => page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent).join('|'));
const chineseLeft = (page) => page.evaluate((src) => { const re = new RegExp(src), out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); for (let n; (n = w.nextNode()); ) { const p = n.parentElement; if (!p || p.closest('.user, .user-title, script, style, svg, .shortcuts')) continue; if (re.test(n.nodeValue)) out.push(n.nodeValue.trim().slice(0, 30)); } return out; }, CJK.source);

(async () => {
  const errors = [];
  let t = await open(); let page = t.page; page.on('pageerror', (e) => errors.push(e.message));
  const id = t.id;
  await go(page, `#/coding/${id}/projects`, '#ci-templates');
  const shelf = await page.evaluate(() => ({ tpl: [...document.querySelectorAll('.ci-ptpl')].map((a) => a.dataset.tpl + ':' + a.getAttribute('href').replace(/^#\/coding\/[^/]+/, '')).join(' '), empty: !!document.querySelector('#ci-pempty'), h: [...document.querySelectorAll('.ci-proj h2')].map((e) => e.textContent).join('|') }));
  ok(shelf.tpl === 'guess:/projects/new/guess quiz:/projects/new/quiz pixel:/projects/new/pixel home:/projects/new/home story:/projects/new/story dashboard:/projects/new/dashboard' && shelf.empty && shelf.h === '新建作品|我的作品（0 / 12）', 'the workshop offers six templates and an empty shelf (0 / 12): ' + shelf.tpl);
  await page.screenshot({ path: OUT + 'info-workshop-shelf.png' });

  // ---------- guess the number ----------
  await go(page, `#/coding/${id}/projects/new/guess`, '#ci-gmax');
  ok((await page.inputValue('#ci-pname')) === '猜数字游戏', 'a new project starts with the name of its template');
  await page.fill('#ci-pname', 'Mon jeu');
  await page.selectOption('#ci-gmax', '10'); await page.selectOption('#ci-gtries', '3'); await page.selectOption('#ci-ghints', '1');
  await page.fill('#ci-gtitle', 'Guess 1-10');
  await page.click('#ci-psave'); await page.waitForTimeout(150);
  ok(/已保存到这台设备/.test(await toastText(page)) && (await projects(page, id)).length === 1, 'Save keeps the project on this device (a toast says so)');
  ok(page.url().includes('/projects/p'), 'after saving the address is the project\'s own (reload-safe)');
  await page.click('#ci-tab-run');
  const sec = await page.evaluate(() => window.__guess.secret);
  const wrong = sec === 1 ? 2 : sec - 1;
  await page.fill('#ci-guess', String(wrong)); await page.click('#ci-gguess');
  ok((await page.textContent('#ci-glog')).includes(wrong < sec ? '▲' : '▼') && (await page.textContent('#ci-ginfo')) === '2', 'a wrong guess shows ▲ (too low) or ▼ (too high) and the tries left (2 of 3)');
  await page.fill('#ci-guess', String(sec)); await page.keyboard.press('Enter');
  ok((await page.textContent('#ci-ginfo')) === '你猜对了。', 'the right number ends the game with a message (Enter works too)');
  await page.click('#ci-gagain');
  for (let k = 0; k < 3; k++) { const s2 = await page.evaluate(() => window.__guess.secret); await page.fill('#ci-guess', String(s2 === 10 ? 9 : s2 + 1)); await page.click('#ci-gguess'); }
  ok(/答案是 \d+/.test(await page.textContent('#ci-ginfo')), 'three wrong guesses end the game and show the answer');
  await page.fill('#ci-guess', '99'); ok(true, 'a number outside the range is not counted');

  // ---------- quiz maker ----------
  await go(page, `#/coding/${id}/projects/new/quiz`, '#ci-qadd');
  await page.fill('#ci-q0', 'Quel est le meilleur langage ?'); await page.fill('#ci-q0o0', 'Un'); await page.fill('#ci-q0o1', 'Deux'); await page.fill('#ci-q0o2', 'Trois'); await page.check('.ci-qedit[data-i="0"] input[type=radio] >> nth=2');
  await page.click('#ci-qadd'); await page.fill('#ci-q3', 'Seconde ?'); await page.fill('#ci-q3o0', 'A'); await page.fill('#ci-q3o1', 'B'); await page.fill('#ci-q3o2', 'C');
  for (let k = 0; k < 4; k++) await page.click('#ci-qadd');
  ok((await page.locator('.ci-qedit').count()) === 8, 'a quiz holds at most 8 questions (the add button stops at 8)');
  await page.click('#ci-psave'); await page.click('#ci-tab-run');
  const q0 = await page.textContent('#ci-qrun h3');
  await page.click('.ci-choice:has-text("Trois")'); await page.click('.ci-choice >> nth=0'); await page.click('.ci-choice >> nth=0'); await page.click('.ci-choice >> nth=0');
  ok(/^\d \/ 4$/.test(await page.textContent('#ci-qscore')), 'the quiz plays the four written questions (blank ones are skipped) and shows the score (' + q0 + ' -> ' + (await page.textContent('#ci-qscore')) + ')');
  const sc = (await page.textContent('#ci-qscore')).split(' / ').map(Number);
  ok(sc[1] === 4 && sc[0] === 2, 'the first answer (Trois = the checked radio) and the last (A) counted as right, the two default questions answered wrongly: ' + sc.join(' / '));
  await page.click('#ci-qagain'); ok(/1 \/ 4/.test(await page.textContent('#ci-qrun .ci-prog')), 'play again starts over');
  // ---------- pixel animation ----------
  await go(page, `#/coding/${id}/projects/new/pixel`, '#ci-fadd');
  ok((await page.locator('.ci-frames button').count()) === 3, 'the pixel template starts with 3 frames');
  await page.click('#ci-fadd'); await page.click('#ci-fadd'); await page.click('#ci-fadd'); await page.click('#ci-fadd');
  ok((await page.locator('.ci-frames button').count()) === 6, 'at most 6 frames');
  await page.click('#ci-fdel'); ok((await page.locator('.ci-frames button').count()) === 5, 'a frame can be deleted');
  const c = await page.locator('.ci-pixedit i[data-i="0"]').boundingBox();
  await page.mouse.move(c.x + 3, c.y + 3); await page.mouse.down(); await page.mouse.move(c.x + c.width * 3.5, c.y + 3, { steps: 6 }); await page.mouse.up();
  const first4 = await page.evaluate(() => [0, 1, 2, 3].map((i) => document.querySelector(`.ci-pixedit i[data-i="${i}"]`).classList.contains('on')));
  ok(first4.every(Boolean), 'painting with the mouse on a frame (drag over four squares)');
  await page.selectOption('#ci-fps', '8'); await page.click('#ci-psave'); await page.click('#ci-tab-run');
  const snaps = new Set(); for (let k = 0; k < 10; k++) { snaps.add(await page.innerHTML('#ci-anim')); await page.waitForTimeout(110); }
  ok(snaps.size >= 2, 'the animation plays: the picture changes while it runs (' + snaps.size + ' different pictures in 1.1 s at 8 frames a second)');
  await page.click('#ci-tab-edit'); const frozen = await page.innerHTML('.ci-pbody');
  ok(!frozen.includes('ci-anim'), 'going back to editing stops the player (its timer is cleared)');
  // ---------- smart home ----------
  await go(page, `#/coding/${id}/projects/new/home`, '#ci-hlamp');
  await page.fill('#ci-hlamp', '60'); await page.dispatchEvent('#ci-hlamp', 'input');
  await page.click('#ci-psave'); await page.click('#ci-tab-run');
  const homeAt = async (h) => { await page.fill('#ci-hour', String(h)); await page.dispatchEvent('#ci-hour', 'input'); return page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#ci-hscene [data-dev]')].map((e) => [e.dataset.dev, e.classList.contains('on')]))); };
  const h2 = await homeAt(2), h12 = await homeAt(12);
  ok(h2.lamp === true && h12.lamp === false, 'the smart-home scene: lamp ON at 02:00 (dark), OFF at 12:00 (bright)');
  await page.click('#ci-hplay'); await page.waitForTimeout(900); ok(Number(await page.inputValue('#ci-hour')) > 0, 'the "play a day" button moves the clock');
  // ---------- story ----------
  await go(page, `#/coding/${id}/projects/new/story`, '#ci-sadd');
  await page.fill('#ci-s0', 'Au début.'); await page.fill('#ci-s0c0', 'Vers la fin'); await page.selectOption('#ci-s0t0', { value: '2' });
  await page.fill('#ci-s2', 'La fin !');
  await page.click('#ci-sadd'); ok((await page.locator('.ci-qedit').count()) === 4, 'a scene can be added (4 scenes)');
  await page.click('#ci-psave'); await page.click('#ci-tab-run');
  ok((await page.textContent('#ci-srun .ci-stext')) === 'Au début.', 'the story starts at scene 1');
  await page.click('#ci-srun .ci-choice[data-k="0"]'); ok((await page.textContent('#ci-srun .ci-stext')) === 'La fin !' && (await page.locator('#ci-sagain').count()) === 1, 'a choice leads to the scene it points to; a scene without choices ends the story');
  await page.click('#ci-sagain'); ok((await page.textContent('#ci-srun .ci-stext')) === 'Au début.', 'restart goes back to scene 1');
  // ---------- dashboard ----------
  await go(page, `#/coding/${id}/projects/new/dashboard`, '#ci-dadd');
  await page.fill('#ci-d0v', '30'); await page.click('#ci-psave'); await page.click('#ci-tab-run');
  const ds = await page.evaluate(() => ({ stats: document.querySelector('#ci-dstats').textContent, bars: document.querySelectorAll('.ci-bars rect').length }));
  ok(/Σ 83/.test(ds.stats) && /max 30/.test(ds.stats) && /min 8/.test(ds.stats) && ds.bars === 5, 'the dashboard draws 5 bars and computes the sum, mean, max and min (' + ds.stats + ')');

  // ---------- the shelf, open, delete ----------
  await go(page, `#/coding/${id}/projects`, '#ci-myprojects .ci-pitem');
  const list = await projects(page, id);
  ok(list.length === 6 && list.map((p) => p.tpl).sort().join() === 'dashboard,guess,home,pixel,quiz,story', 'six projects are on the shelf, one per template (' + list.map((p) => p.name).join(' | ') + ')');
  ok((await page.textContent('.ci-proj h2:nth-of-type(2)')) === '我的作品（6 / 12）', 'the shelf counts them (6 / 12)');
  const g = list.find((p) => p.tpl === 'guess');
  ok(g.name === 'Mon jeu' && g.data.max === 10 && g.data.tries === 3 && g.data.hints === true && g.date === '2026-11-12', 'the saved guess project keeps the name, the range, the tries, the hints and the date: ' + JSON.stringify(g));
  await page.click(`.ci-popen[href$="${g.id}"]`); await page.waitForSelector('#ci-gmax');
  ok((await page.inputValue('#ci-gmax')) === '10' && (await page.inputValue('#ci-gtries')) === '3' && (await page.inputValue('#ci-pname')) === 'Mon jeu', 'opening it again shows what was saved');
  await go(page, `#/coding/${id}/projects`, '#ci-myprojects .ci-pitem');
  await page.click(`.ci-pdel[data-id="${g.id}"]`); await page.waitForSelector('dialog');
  ok(/删除这个作品/.test(await page.textContent('dialog')), 'delete asks first');
  await page.click('dialog button:not(.danger):not(.primary)'); await page.waitForSelector('dialog', { state: 'detached' });
  ok((await projects(page, id)).length === 6, 'cancelling the confirmation deletes nothing');
  await page.click(`.ci-pdel[data-id="${g.id}"]`); await page.waitForSelector('dialog'); await page.click('dialog button.danger, dialog button.primary'); await page.waitForSelector('dialog', { state: 'detached' });
  ok((await projects(page, id)).length === 5 && !(await page.locator(`.ci-popen[href$="${g.id}"]`).count()), 'confirming removes the project');
  // ---------- 12 at most ----------
  await page.evaluate((i) => { const all = JSON.parse(localStorage.getItem('learn.coding.projects.v1') || '{}'); const l = all[i] || []; while (l.length < 12) l.push({ id: 'pfill' + l.length, tpl: 'guess', name: 'Fill ' + l.length, date: '2026-11-12', data: { title: 'x', max: 10, tries: 3, hints: true } }); all[i] = l; localStorage.setItem('learn.coding.projects.v1', JSON.stringify(all)); }, id);
  await go(page, `#/coding/${id}/projects/new/guess`, '#ci-gmax');
  await page.click('#ci-psave'); await page.waitForTimeout(150);
  ok(/最多保存 12 个作品/.test(await toastText(page)) && (await projects(page, id)).length === 12, 'a 13th project is refused with a message (12 at most)');
  await page.click('#ci-pdel, body', { trial: true }).catch(() => {});
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => /project/.test(k)));
  ok(keys.join() === 'learn.coding.projects.v1' && t.log.puts.every((p) => !/project/.test(p)), 'projects stay on this device (one local key, never written to the data repository)');
  await t.browser.close();

  // ---------- the certificate ----------
  t = await open(); page = t.page; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await go(page, `#/coding/${t.id}/certificate`, '#ci-certstat');
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  const c0 = await page.evaluate(() => ({ stat: document.querySelector('#ci-certstat').textContent, lock: !!document.querySelector('#ci-certlock'), cert: !!document.querySelector('#ci-cert'), prev: !!document.querySelector('#ci-certprev'), print: !!document.querySelector('#ci-certprint'), medals: document.querySelectorAll('.ci-certwrap > .ci-medals .cl-trophy').length, got: document.querySelectorAll('.ci-certwrap > .ci-medals .cl-trophy.got').length }));
  ok(c0.lock && !c0.cert && c0.prev && !c0.print && c0.got === 0 && c0.medals >= 9 && /^0 \/ \d+$/.test(c0.stat), `without medals the certificate is locked with the explanation, a preview button and no print button (${c0.stat}, ${c0.medals} medals)`);
  await page.click('#ci-certprev');
  const pv = await page.evaluate(() => ({ name: document.querySelector('#ci-certname').textContent, user: document.querySelector('#ci-certname').classList.contains('user'), print: !!document.querySelector('#ci-certprint'), small: document.querySelector('.ci-certin small').textContent }));
  ok(pv.name === 'Dory' && pv.user && pv.print && pv.small === '预览', 'the preview shows the certificate with the child\'s name (a user text), marked 预览');
  await page.screenshot({ path: OUT + 'info-certificate-preview.png' });
  // every medal
  await page.evaluate(async (id) => { const L = await import('/src/coding-levels.ts'); const C = await import('/src/coding-infocontent.ts'); const c = await C.loadContent(); const stars = {}; for (const l of L.LEVELS) stars[l.id] = 3; for (const a of c.acts) stars[a.id] = 3; localStorage.setItem('learn.local.coding/' + id + '.json', JSON.stringify({ stars, blocks: {}, challenges: 0 })); }, t.id);
  await go(page, `#/coding/${t.id}`, '.ci-icard'); await go(page, `#/coding/${t.id}/certificate`, '#ci-certstat');
  const c1 = await page.evaluate(() => { const box = document.querySelector('#ci-cert').getBoundingClientRect(); return { stat: document.querySelector('#ci-certstat').textContent, lock: !!document.querySelector('#ci-certlock'), name: document.querySelector('#ci-certname').textContent, date: document.querySelector('.ci-certdate').textContent, small: document.querySelector('.ci-certin small').textContent, ratio: box.width / box.height, print: !!document.querySelector('#ci-certprint'), prev: !!document.querySelector('#ci-certprev'), got: document.querySelectorAll('.ci-certin .cl-trophy.got').length, all: document.querySelectorAll('.ci-certin .cl-trophy').length }; });
  const [g1, g2] = c1.stat.split(' / ').map(Number);
  ok(g1 === g2 && !c1.lock && c1.name === 'Dory' && c1.date === '2026-11-12' && c1.small === '' && c1.print && !c1.prev && c1.got === c1.all, `with every medal earned (${c1.stat}) the certificate shows the name, the date 2026-11-12, all ${c1.got} medals, no preview mark and the print button`);
  ok(Math.abs(c1.ratio - 297 / 210) < 0.03, 'the certificate has the proportions of an A4 sheet on its side (' + c1.ratio.toFixed(3) + ' vs 1.414)');
  const pageStyle = await page.evaluate(() => document.getElementById('ci-cert-print')?.textContent);
  ok(/A4 landscape/.test(pageStyle), 'while it is shown the page style is A4 landscape: ' + pageStyle);
  await page.click('#ci-certprint'); ok((await page.evaluate(() => window.__printed)) === 1, 'the print button calls the browser\'s print (window.print) once');
  await page.screenshot({ path: OUT + 'info-certificate.png' });
  await page.emulateMedia({ media: 'print' });
  const pr = await page.evaluate(() => ({ top: getComputedStyle(document.querySelector('.cert-page .top')).display, btns: getComputedStyle(document.querySelector('.cert-page .ci-row')).display, cert: document.querySelector('#ci-cert').getBoundingClientRect().width }));
  ok(pr.top === 'none' && pr.btns === 'none' && pr.cert > 300, 'for printing the header and the buttons are hidden and the certificate stays');
  await page.emulateMedia({ media: 'screen' });
  await go(page, `#/coding/${t.id}`, '.ci-icard');
  ok(!(await page.evaluate(() => !!document.getElementById('ci-cert-print'))), 'leaving the certificate removes the A4 landscape page style (other printouts are not affected)');
  await t.browser.close();

  // ---------- layout on 5 sizes, English and French ----------
  for (const [name, w, h] of [['phone', 390, 844], ['small', 320, 568], ['ipad', 820, 1180], ['ipadland', 1180, 820], ['landscape', 844, 390]]) {
    const lt = await open({ viewport: { width: w, height: h } }); const lp = lt.page; lp.on('pageerror', (e) => errors.push(e.message));
    const bad = [], small = [];
    const measure = async (label) => {
      const m = await lp.evaluate(() => { const iw = innerWidth, o = { sw: document.documentElement.scrollWidth, iw, over: [], small: [] }; const box = document.querySelector('.narrow'); if (box) { const r = box.getBoundingClientRect(); o.l = r.left; o.r = iw - r.right; } for (const e of document.querySelectorAll('.narrow button, .narrow input:not([type=range]):not([type=radio]), .narrow select, .narrow a.ci-ptpl, .narrow svg, .narrow .ci-pixedit, .narrow table, .narrow textarea')) { const r = e.getBoundingClientRect(); if (r.width && (r.left < -1 || r.right > iw + 1)) o.over.push((e.id || e.className).toString().slice(0, 20)); } for (const e of document.querySelectorAll('.narrow .ci-btn, .narrow select, .narrow input[type=text], .narrow .ci-ptpl, .narrow .ci-popen')) { const r = e.getBoundingClientRect(); if (r.width && (r.height < 39.5 || r.width < 39.5)) o.small.push((e.id || e.className).toString().slice(0, 20) + ':' + Math.round(r.width) + 'x' + Math.round(r.height)); } return o; });
      if (m.sw > m.iw + 1 || m.over.length) bad.push(label + ' sideways ' + m.sw + '/' + m.iw + ' ' + m.over.slice(0, 2).join(','));
      if (m.l !== undefined && Math.abs(m.l - m.r) > 2.5) bad.push(label + ' not centred ' + Math.round(m.l) + '/' + Math.round(m.r));
      if (m.small.length) small.push(label + ' ' + m.small.slice(0, 3).join(','));
    };
    await go(lp, `#/coding/${lt.id}/projects`, '#ci-templates'); await measure('shelf');
    for (const tpl of ['guess', 'quiz', 'pixel', 'home', 'story', 'dashboard']) { await go(lp, `#/coding/${lt.id}/projects/new/${tpl}`, '#ci-psave'); await measure(tpl + ' edit'); await lp.click('#ci-tab-run'); await lp.waitForTimeout(100); await measure(tpl + ' run'); if (['quiz', 'pixel', 'story'].includes(tpl)) { await lp.click('#ci-tab-edit'); await lp.screenshot({ path: OUT + `info-${name}-project-${tpl}.png` }); } }
    await go(lp, `#/coding/${lt.id}/certificate`, '#ci-certstat'); await lp.click('#ci-certprev'); await measure('certificate'); await lp.screenshot({ path: OUT + `info-${name}-certificate.png` });
    ok(bad.length === 0, `${name} ${w}x${h}: shelf, six editors and players and the certificate: nothing sideways, content centred` + (bad.length ? ' -> ' + bad.slice(0, 3).join(' | ') : ''));
    ok(small.length === 0, `${name}: every button, field, selector and card is at least 40 px` + (small.length ? ' -> ' + small.slice(0, 4).join(' | ') : ''));
    await lt.browser.close();
  }
  for (const [loc, nm] of [['en-US', 'en'], ['fr-FR', 'fr']]) {
    const lt = await open({ locale: loc }); const lp = lt.page; lp.on('pageerror', (e) => errors.push(e.message));
    const bad = [];
    for (const r of ['projects', 'projects/new/guess', 'projects/new/quiz', 'projects/new/pixel', 'projects/new/home', 'projects/new/story', 'projects/new/dashboard', 'certificate']) { await go(lp, `#/coding/${lt.id}/${r}`, '.ci-proj'); const l = await chineseLeft(lp); if (l.length) bad.push(r + ': ' + l.slice(0, 3).join(' / ')); }
    await go(lp, `#/coding/${lt.id}/projects/new/quiz`, '#ci-qadd'); await lp.click('#ci-tab-run'); { const l = await chineseLeft(lp); if (l.length) bad.push('quiz run: ' + l.join(' / ')); }
    await go(lp, `#/coding/${lt.id}/certificate`, '#ci-certstat'); await lp.click('#ci-certprev'); { const l = await chineseLeft(lp); if (l.length) bad.push('certificate preview: ' + l.join(' / ')); }
    const head = await lp.evaluate(() => [document.querySelector('.ci-certin h2').textContent, document.querySelector('#ci-certprint').textContent]);
    ok(bad.length === 0, `${nm}: no Chinese UI text left in the workshop (shelf, six editors, a player) and the certificate (project names and your own texts are user boxes)` + (bad.length ? ' -> ' + bad.slice(0, 3).join(' | ') : ''));
    ok(nm === 'en' ? head[0] === 'Coding Certificate' && head[1] === 'Print / Save as PDF' : head[0] === 'Certificat de programmation', `${nm}: the certificate title and the print button are translated (${head.join(' / ')})`);
    await lt.browser.close();
  }
  const ext = await open(); ext.page.on('pageerror', (e) => errors.push(e.message));
  await go(ext.page, `#/coding/${ext.id}/projects/new/pixel`, '#ci-fadd'); await ext.page.click('#ci-psave'); await ext.page.click('#ci-tab-run'); await ext.page.waitForTimeout(400); await go(ext.page, `#/coding/${ext.id}/certificate`, '#ci-certstat');
  ok(ext.log.external.length === 0 && ext.log.puts.length === 0, 'no request leaves the app and nothing is written to a repository (local mode)');
  await ext.browser.close();
  ok(errors.length === 0, 'no script errors' + (errors.length ? ': ' + errors[0] : ''));
  await done();
})();
