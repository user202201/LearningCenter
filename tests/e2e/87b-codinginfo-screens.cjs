// 编程 worlds 14-16, part 2: the SCREENS. The world map section (three worlds, the workshop, the certificate, the three medals on the shelf), the level lists,
// every one of the 82 activities opened and solved through its own controls' check (the lab's reference answer; a wrong answer first counts a mistake and does not
// win), the stars rule (mistakes / hints / the shown answer), the mini-lessons (shown once, again with ?), the hint ladder, progress saved in coding/<kid>.json and
// shown again, the medal of a finished world, two devices writing at once (a 409), layout on 5 screen sizes (nothing sideways, centred, targets >= 40 px, the
// screenshots are saved), English and French with no Chinese left outside `user` boxes, and no request outside the app.
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

const kidIds = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('learn.local.kids.json')).kids.map((k) => k.id));
const allLessons = (page) => page.evaluate(async () => { const C = await import('/src/coding-infocontent.ts'); return Object.keys((await C.loadContent()).lessons); });
const open = async (opts = {}) => {
  const t = await start(new Map(), { local: true, today: '2026-11-12', viewport: { width: 390, height: 844 }, ...opts });
  if (opts.locale) await withExtra(t);
  if (opts.locale) { await t.page.evaluate(() => (location.hash = '#/chinese')); await t.page.waitForSelector('.kids, .empty-home'); }
  await addKid(t.page, 'Dory');
  t.id = (await kidIds(t.page))[0];
  const seen = opts.lessons === true ? [] : await allLessons(t.page);
  await t.page.evaluate((s) => localStorage.setItem('learn.coding.v1', JSON.stringify({ seen: s, speed: 'fast', drawings: {} })), seen);
  return t;
};
const clearToasts = (page) => page.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((x) => x.remove()));
const go = async (page, hash, sel) => { await clearToasts(page); await page.evaluate((h) => (location.hash = h), hash); await page.waitForSelector(sel); await page.waitForTimeout(120); };
const goAct = async (t, aid, dismiss = true) => { const m = /^i(\d+)-(\d+)$/.exec(aid); await go(t.page, `#/coding/${t.id}`, '.ci-icard'); await clearToasts(t.page); await t.page.evaluate((h) => (location.hash = h), `#/coding/${t.id}/i${m[1]}/${Number(m[2])}`); await t.page.waitForFunction((id) => window.__info && window.__info.act.id === id, aid); await t.page.waitForTimeout(60); if (dismiss && (await t.page.locator('#cl-lesson').count())) { await t.page.click('#cl-lesson-close'); await t.page.waitForSelector('#cl-lesson', { state: 'detached' }); } };
const doc = (page, id) => page.evaluate((i) => { const s = localStorage.getItem('learn.local.coding/' + i + '.json'); return s ? JSON.parse(s) : null; }, id);
const chineseLeft = (page, rootSel = 'body') => page.evaluate(([src, rootSel]) => {
  const re = new RegExp(src), out = [], rootEl = document.querySelector(rootSel) || document.body;
  const w = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode()); ) { const p = n.parentElement; if (!p || p.closest('.user, .user-title, script, style, svg, .shortcuts, .shortcut')) continue; if (re.test(n.nodeValue)) out.push(n.nodeValue.trim().slice(0, 30)); }
  for (const e of rootEl.querySelectorAll('[title],[aria-label],[placeholder]')) { if (e.closest('.user, .user-title, .shortcuts, svg')) continue; for (const a of ['title', 'aria-label', 'placeholder']) { const v = e.getAttribute(a); if (v && re.test(v)) out.push(a + ':' + v.slice(0, 30)); } }
  return out;
}, [CJK.source, rootSel]);

(async () => {
  const errors = [];
  // ================= the map, the worlds =================
  let t = await open();
  let page = t.page;
  page.on('pageerror', (e) => errors.push(e.message));
  const acts = await page.evaluate(async () => { const C = await import('/src/coding-infocontent.ts'); return (await C.loadContent()).acts.map((a) => ({ id: a.id, world: a.world, no: a.no, kind: a.kind, boss: !!a.boss })); });
  await go(page, `#/coding/${t.id}`, '.ci-icard');
  await page.waitForSelector('.ci-trophy');
  const map = await page.evaluate(() => ({
    cards: [...document.querySelectorAll('.ci-icard')].map((e) => (e.dataset.iworld || e.id) + ':' + e.querySelector('.isl-name').textContent + ':' + (e.querySelector('.isl-stars')?.textContent || '') + ':' + (e.querySelector('.isl-prog')?.textContent || '')),
    trophies: document.querySelectorAll('.ci-trophy').length, got: document.querySelectorAll('.ci-trophy.got').length, total: document.querySelector('#cl-total').textContent, h: document.querySelector('.ci-sech').textContent,
    blockIslands: document.querySelectorAll('.cl-island:not(.free)').length, links: [...document.querySelectorAll('.ci-icard')].map((e) => e.getAttribute('href').replace(/^#\/coding\/[^/]+/, '')),
  }));
  ok(map.cards.length === 5 && map.cards[0].startsWith('14:数据与编码:★ 0 / 111:0 / 37') && map.cards[1].startsWith('15:网络、安全与人工智能:★ 0 / 87:0 / 29') && map.cards[2].startsWith('16:过程控制与物联网:★ 0 / 48:0 / 16') && map.cards[3].startsWith('ci-projects:创作工坊') && map.cards[4].startsWith('ci-certificate:证书'), 'the world map has a section 信息科技 with three world cards (37, 29 and 16 levels), the workshop and the certificate: ' + map.cards.join(' | '));
  ok(map.trophies === 3 && map.got === 0 && map.h === '信息科技' && map.links.join() === '/i14,/i15,/i16,/projects,/certificate', 'three more medals on the shelf (none earned), the links go to i14 / i15 / i16 / projects / certificate');
  ok(map.blockIslands >= 6, 'the islands of the block worlds are still there (' + map.blockIslands + ') and the section sits below them');
  await page.evaluate(() => { document.querySelectorAll('#toasts .toast').forEach((x) => x.remove()); document.querySelector('.scroll').scrollTop = 99999; });
  await page.waitForTimeout(250);
  await page.screenshot({ path: OUT + 'info-map-section.png' });
  for (const [w, n, bosses] of [[14, 37, 'i14-37'], [15, 29, ''], [16, 16, 'i16-16']]) {
    await go(page, `#/coding/${t.id}/i${w}`, '.cl-lvl');
    const wp = await page.evaluate(() => ({ n: document.querySelectorAll('.cl-lvl').length, nums: [...document.querySelectorAll('.lvl-no')].map((e) => e.textContent).join(), boss: [...document.querySelectorAll('.cl-lvl.boss')].map((e) => e.dataset.level).join(), stars: document.querySelector('#cl-wstars').textContent, round: [...document.querySelectorAll('.lvl-no')].every((e) => Math.abs(e.getBoundingClientRect().width - e.getBoundingClientRect().height) < 1 && e.getBoundingClientRect().width >= 40), medal: document.querySelectorAll('#cl-medal.got').length, hrefs: [...document.querySelectorAll('.cl-lvl')].every((a, i) => a.getAttribute('href').endsWith(`/i${location.hash.match(/i(\d+)$/)[1]}/${i + 1}`)) }));
    ok(wp.n === n && wp.nums === Array.from({ length: n }, (_, i) => i + 1).join() && wp.boss === bosses && wp.stars === `★ 0 / ${n * 3}` && wp.round && wp.medal === 0 && wp.hrefs, `world ${w}: ${n} numbered round level buttons (boss ${bosses || 'none'}), 0 / ${n * 3} stars, no medal yet, every link goes to its level`);
  }
  await go(page, `#/coding/${t.id}/i14`, '.cl-lvl'); await page.screenshot({ path: OUT + 'info-world14.png' });
  await go(page, `#/coding/${t.id}/i15`, '.cl-lvl'); await page.screenshot({ path: OUT + 'info-world15.png' });
  await go(page, `#/coding/${t.id}/i16`, '.cl-lvl'); await page.screenshot({ path: OUT + 'info-world16.png' });

  // ================= every activity: a wrong answer does not win, the reference answer does =================
  const rows = [];
  for (const a of acts) {
    await goAct(t, a.id);
    const s0 = await page.evaluate(() => ({ prompt: document.querySelector('#ci-prompt').textContent.length, root: document.querySelector('#ci-root').children.length, title: document.querySelector('#cl-title').textContent, hint: !!document.querySelector('#ci-hint'), lesson: !!document.querySelector('#cl-lesson-btn') }));
    await page.evaluate(() => window.__info.wrong());
    const s1 = await page.evaluate(() => window.__info.state);
    await page.evaluate(() => window.__info.solve());
    await page.waitForFunction(() => !document.querySelector('#ci-result').hidden, null, { timeout: 5000 }).catch(() => {});
    const s2 = await page.evaluate(() => ({ st: window.__info.state, stars: document.querySelector('#ci-result').dataset.stars, shown: !document.querySelector('#ci-result').hidden }));
    rows.push({ id: a.id, kind: a.kind, s0, s1, s2 });
  }
  const bad0 = rows.filter((r) => !(r.s0.root > 0 && r.s0.hint && r.s0.lesson && r.s0.title.startsWith(r.id.slice(1).replace(/-0?/, '-'))));
  const bad1 = rows.filter((r) => r.s1.solved || r.s1.mistakes < 1);
  const bad2 = rows.filter((r) => !r.s2.st.solved || !r.s2.shown || !['1', '2', '3'].includes(r.s2.stars));
  ok(bad0.length === 0, `all ${rows.length} activities open with a task, controls, a hint button and a lesson button, and the title starts with their number` + (bad0.length ? ' -> ' + bad0.map((r) => r.id).join(',') : ''));
  ok(bad1.length === 0, `a wrong answer is a mistake and does not win in all ${rows.length} activities (${[...new Set(rows.map((r) => r.kind))].length} kinds)` + (bad1.length ? ' -> ' + bad1.map((r) => r.id).join(',') : ''));
  ok(bad2.length === 0, `the reference answer wins in all ${rows.length} activities and shows the result with stars` + (bad2.length ? ' -> ' + bad2.map((r) => r.id).join(',') : ''));
  await page.waitForTimeout(500);
  const saved = await doc(page, t.id);
  const ids = acts.map((a) => a.id);
  ok(ids.every((id) => saved.stars[id] >= 1 && saved.blocks[id] !== undefined) && Object.keys(saved.stars).filter((k) => /^i1[4-6]/.test(k)).length === 82, 'progress is saved in coding/<kid>.json under the ids i14-01 ... i16-16 (82 results, stars and mistakes / blocks): ' + JSON.stringify(Object.fromEntries(Object.entries(saved.stars).slice(0, 4))));
  const ex = await page.evaluate(async () => { const M = await import('/src/coding-model.ts'); return { stars: Object.keys(JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('learn.local.coding/')))).stars).length }; });
  void ex;

  // ================= the map and the lists after all of that =================
  await go(page, `#/coding/${t.id}`, '.ci-icard'); await page.waitForTimeout(300);
  const m2 = await page.evaluate(() => ({ got: [...document.querySelectorAll('.ci-trophy.got')].map((e) => e.dataset.iworld).join(), done: [...document.querySelectorAll('.ci-icard.done')].map((e) => e.dataset.iworld).join(), stars: [...document.querySelectorAll('.ci-icard .isl-stars')].map((e) => e.textContent).join(' ') }));
  ok(m2.got === '14,15,16' && m2.done === '14,15,16', 'after solving everything the three medals are on the shelf and the three world cards are marked done: ' + m2.stars);
  await go(page, `#/coding/${t.id}/i14`, '.cl-lvl');
  const l2 = await page.evaluate(() => ({ solved: document.querySelectorAll('.cl-lvl.solved').length, medal: document.querySelectorAll('#cl-medal.got').length, rows: [...document.querySelectorAll('.cl-lvl')].every((e) => Number(e.dataset.stars) >= 1 && e.querySelectorAll('.lvl-stars svg').length === 3) }));
  ok(l2.solved === 37 && l2.medal === 1 && l2.rows, 'the list of world 14 shows 37 solved levels with their stars and the medal');
  await page.screenshot({ path: OUT + 'info-world14-done.png' });

  // ================= the stars rule, the hint ladder, the mini-lesson, the best result is kept =================
  t.browser.close();
  t = await open({ lessons: true }); page = t.page; page.on('pageerror', (e) => errors.push(e.message));
  await goAct(t, 'i14-01', false);
  await page.waitForSelector('#cl-lesson');
  const les = await page.evaluate(() => ({ title: document.querySelector('#cl-lesson h2').textContent, steps: document.querySelectorAll('.cl-dots i').length, demo: document.querySelector('#cl-demo [data-demo]')?.dataset.demo, lamps: document.querySelectorAll('#cl-demo .ci-lamp').length, text: document.querySelector('#cl-lesson-text').textContent.length > 10, prevDisabled: document.querySelector('#cl-lesson-prev').disabled }));
  ok(les.title === '二进制' && les.steps === 3 && les.demo === 'bits' && les.lamps === 4 && les.text && les.prevDisabled, 'the first level of an idea opens its mini-lesson (3 steps, an illustrated demo with 4 lamps, text, previous disabled on the first step)');
  await page.click('#cl-lesson-next'); await page.click('#cl-lesson-next');
  ok((await page.textContent('#cl-lesson-next')) === '完成', 'the last step says 完成');
  await page.click('#cl-lesson-next'); await page.waitForSelector('#cl-lesson', { state: 'detached' });
  const seen = await page.evaluate(() => JSON.parse(localStorage.getItem('learn.coding.v1')).seen);
  ok(seen.includes('bin'), 'finishing the lesson remembers on this device that it was seen');
  await goAct(t, 'i14-02'); await page.waitForTimeout(400);
  ok((await page.locator('#cl-lesson').count()) === 0, 'a level that uses the same lesson does not open it again');
  await page.click('#cl-lesson-btn'); await page.waitForSelector('#cl-lesson'); await page.click('#cl-lesson-close'); await page.waitForSelector('#cl-lesson', { state: 'detached' });
  ok(true, 'the ? button opens the lesson again');
  // the ladder: three texts, then (device) the next block; each counts
  await goAct(t, 'i14-05');
  await page.click('#ci-hint'); await page.click('#ci-hint'); await page.click('#ci-hint');
  const hh = await page.evaluate(() => ({ n: document.querySelectorAll('#ci-hints li').length, st: window.__info.state }));
  ok(hh.n === 3 && hh.st.hints === 3, 'the hint button shows the three hints one after the other and counts them (3)');
  await page.click('#ci-hint'); ok((await page.locator('#ci-hints li').count()) === 3 && (await page.evaluate(() => window.__info.state.hints)) === 3, 'a fourth press adds nothing and counts nothing');
  const star = async (aid, before) => { await goAct(t, aid); if (before) await page.evaluate(before); await page.evaluate(() => window.__info.solve()); await page.waitForSelector('#ci-result:not([hidden])'); return Number(await page.getAttribute('#ci-result', 'data-stars')); };
  const s3 = await star('i14-02'); const s2 = await star('i14-05', () => window.__info.wrong()); const s1 = await star('i14-06', async () => { window.__info.wrong(); window.__info.wrong(); window.__info.wrong(); });
  const sh = await star('i14-07', async () => { document.querySelector('#ci-hint').click(); document.querySelector('#ci-hint').click(); });
  ok(s3 === 3 && s2 === 2 && s1 === 1 && sh === 1, `stars: no mistake and no hint = 3 (${s3}), one mistake = 2 (${s2}), three mistakes = 1 (${s1}), two hints = 1 (${sh})`);
  await page.waitForTimeout(400);
  let d = await doc(page, t.id);
  ok(d.stars['i14-02'] === 3 && d.stars['i14-05'] === 2 && d.stars['i14-06'] === 1 && d.blocks['i14-05'] === 1 && d.blocks['i14-06'] === 3, 'the stars and the number of mistakes are saved: ' + JSON.stringify(d.stars) + ' ' + JSON.stringify(d.blocks));
  const again = await star('i14-02', () => window.__info.wrong()); await page.waitForTimeout(400);
  d = await doc(page, t.id);
  ok(again === 2 && d.stars['i14-02'] === 3, 'a worse second attempt (2 stars) does not lower the saved 3 stars');
  await goAct(t, 'i14-02'); await page.screenshot({ path: OUT + 'info-activity-quiz.png' });
  ok(await page.evaluate(() => /^[\d]+ \/ 4$/.test(document.querySelector('.ci-prog').textContent)), 'a quiz shows its progress (1 / 4)');

  // ================= a device level with the real controls =================
  await goAct(t, 'i16-03');
  const dv = await page.evaluate(() => ({ chips: document.querySelectorAll('.ci-scs .ci-choice').length, scene: !!document.querySelector('#ci-scene svg'), gauges: document.querySelectorAll('#ci-gauges .ci-gauge').length, pal: document.querySelectorAll('.cw-pitem').length, answer: !document.querySelector('#ci-answer').hidden }));
  ok(dv.chips === 10 && dv.scene && dv.gauges === 3 && dv.pal >= 3 && !dv.answer, 'the street lamp level: 10 scenarios, a drawn scene, gauges (sensor, actuator, time), the block palette, no "see the answer" yet');
  await page.click('#dv-check'); ok((await page.textContent('#ci-msg')).length > 0 && (await page.locator('#ci-result:not([hidden])').count()) === 0, 'checking with an empty program says so and does not win');
  await page.evaluate(() => window.__infoDev.editor.setProgram(window.__infoDev.editor.program()));
  const progOf = async (txt) => page.evaluate(async (s) => { const A = await import('/src/coding-ast.ts'); window.__infoDev.editor.setProgram(A.cloneProgram(A.parse(s), true)); }, txt);
  await progOf('if light < 40 { set lamp = 1 } else { set lamp = 0 }');
  for (let k = 0; k < 3; k++) { await page.click('#dv-check'); await page.waitForTimeout(80); }
  const fail = await page.evaluate(() => ({ rows: document.querySelectorAll('#ci-results .ci-res.bad').length, okRows: document.querySelectorAll('#ci-results .ci-res.ok').length, answer: !document.querySelector('#ci-answer').hidden, result: document.querySelector('#ci-result').hidden, mistakes: window.__info.state.mistakes, chipOn: document.querySelector('.ci-scs .on')?.dataset.s }));
  ok(fail.rows > 0 && fail.okRows > 0 && fail.answer && fail.result && fail.mistakes === 3, `a naive program passes some scenarios and fails others (${fail.okRows} ok / ${fail.rows} wrong, each with its message), counts 3 mistakes and offers "看答案" after 3 failed checks`);
  await page.click('#dv-run'); await page.waitForTimeout(300);
  ok((await page.evaluate(() => document.querySelector('#ci-gauges').textContent)).includes('lamp'), 'a run plays the failing scenario in the scene');
  await page.click('#dv-text-btn'); const txt = await page.inputValue('#dv-text'); ok(/light < 40/.test(txt), 'the text mode shows the program as pseudo-code (' + txt.replace(/\n\s*/g, ' ') + ')');
  await page.fill('#dv-text', 'if light < 30 { set lamp = 1 }\nif light > 50 { set lamp = 0 }'); await page.click('#dv-apply');
  ok((await page.evaluate(() => window.__infoDev.editor.count())) === 4, 'text typed in the text mode becomes blocks (4 blocks)');
  await page.click('#dv-check'); await page.waitForSelector('#ci-result:not([hidden])');
  const win = await page.evaluate(() => ({ stars: document.querySelector('#ci-result').dataset.stars, rows: document.querySelectorAll('#ci-results .ci-res.ok').length }));
  ok(win.rows === 10 && win.stars === '3', 'the right program passes all 10 scenarios with 3 stars (4 blocks = par)');
  await page.waitForTimeout(400);
  await goAct(t, 'i16-04'); await progOf('set door = 1'); for (let k = 0; k < 3; k++) await page.click('#dv-check');
  await page.click('#ci-answer'); await page.waitForSelector('#cl-answer-dlg, .cl-answer'); await page.click('#ci-answer-use'); await page.waitForSelector('.cl-answer', { state: 'detached' });
  await page.click('#dv-check'); await page.waitForSelector('#ci-result:not([hidden])');
  ok((await page.getAttribute('#ci-result', 'data-stars')) === '1', 'a device level solved after looking at the reference answer gives at most 1 star');
  // the last step of the hint ladder lights the next block
  await goAct(t, 'i16-01'); for (let k = 0; k < 3; k++) await page.click('#ci-hint');
  ok((await page.locator('.cw-hint, .cw-b.hint, [class*=hint]').count()) > 0 || (await page.textContent('#ci-msg')).length > 0, 'the hint ladder of a device level ends with the editor\'s next-block hint');
  await page.screenshot({ path: OUT + 'info-activity-device.png' });

  // ================= the medal of a finished world =================
  await page.evaluate(async (id) => { const M = await import('/src/coding-model.ts'); const C = await import('/src/coding-infocontent.ts'); const c = await C.loadContent(); const stars = {}; for (const a of c.acts.filter((x) => x.world === 16 && x.no < 16)) stars[a.id] = 3; localStorage.setItem('learn.local.coding/' + id + '.json', JSON.stringify({ stars, blocks: {}, challenges: 0 })); void M; }, t.id);
  await goAct(t, 'i16-16'); await page.evaluate(() => window.__info.solve());
  await page.waitForSelector('#cl-medal-dlg', { timeout: 8000 });
  ok((await page.textContent('#cl-medal-dlg')).includes('过程控制与物联网') && (await page.locator('#cl-medal-dlg svg').count()) > 0, 'finishing the last level of a world opens the medal window with the medal drawn');
  await page.screenshot({ path: OUT + 'info-medal.png' });
  await page.click('#cl-medal-ok'); await page.waitForSelector('#cl-medal-dlg', { state: 'detached' });
  await go(page, `#/coding/${t.id}`, '.ci-icard'); await page.waitForTimeout(300);
  ok((await page.evaluate(() => [...document.querySelectorAll('.ci-trophy.got')].map((e) => e.dataset.iworld).join())) === '16', 'the medal of world 16 is on the shelf');

  // ================= merge: two devices writing at once (a 409) =================
  await t.browser.close();
  const store2 = new Map(); let first = true, id2 = '';
  const g2 = await start(store2, { today: '2026-11-12', viewport: { width: 390, height: 844 }, beforePut: (key, st, version) => { if (key.startsWith('coding/') && first && id2) { first = false; st.set(key, JSON.stringify({ stars: { 'i14-01': 1, 'i14-02': 3 }, blocks: { 'i14-01': 5, 'i14-02': 0 }, challenges: 4 })); version.set(key, (version.get(key) || 0) + 1); } } });
  await g2.page.evaluate(() => { location.hash = '#/chinese'; }); await H.addKid(g2.page, 'Dory');
  id2 = JSON.parse(store2.get('kids.json')).kids[0].id; g2.id = id2;
  await g2.page.evaluate(async () => { const C = await import('/src/coding-infocontent.ts'); localStorage.setItem('learn.coding.v1', JSON.stringify({ seen: Object.keys((await C.loadContent()).lessons), speed: 'fast', drawings: {} })); });
  store2.set(`coding/${id2}.json`, JSON.stringify({ stars: { 'i14-01': 1 }, blocks: { 'i14-01': 5 }, challenges: 0 }));
  await g2.page.evaluate((i) => (location.hash = '#/coding/' + i), id2); await g2.page.waitForSelector('.ci-icard');
  await g2.page.evaluate((i) => (location.hash = '#/coding/' + i + '/i14/1'), id2); await g2.page.waitForFunction(() => window.__info && window.__info.act.id === 'i14-01');
  await g2.page.evaluate(() => window.__info.solve()); await g2.page.waitForSelector('#ci-result:not([hidden])'); await g2.page.waitForTimeout(900);
  const m3 = JSON.parse(store2.get(`coding/${id2}.json`));
  ok(!first && m3.stars['i14-01'] === 3 && m3.stars['i14-02'] === 3 && m3.blocks['i14-01'] === 0 && m3.challenges === 4, 'two devices at once (a 409 on the first write): both results are kept, the larger stars and the fewer mistakes win: ' + JSON.stringify(m3.stars) + ' ' + JSON.stringify(m3.blocks));
  const mc = await g2.page.evaluate(async () => { const M = await import('/src/coding-model.ts'); return M.mergeCoding({ stars: { 'i15-03': 2, 'w1-01': 3 }, blocks: {}, challenges: 1 }, { stars: { 'i15-03': 3, 'i16-01': 1 }, blocks: {}, challenges: 0 }).stars; });
  ok(mc['i15-03'] === 3 && mc['i16-01'] === 1 && mc['w1-01'] === 3, 'mergeCoding keeps the info ids next to the block levels: ' + JSON.stringify(mc));
  await g2.browser.close();

  // ================= layout on 5 sizes =================
  const SIZES = [['phone', 390, 844], ['small', 320, 568], ['ipad', 820, 1180], ['ipadland', 1180, 820], ['landscape', 844, 390]];
  const SAMPLE = ['i14-01', 'i14-02', 'i14-04', 'i14-09', 'i14-11', 'i14-14', 'i14-15', 'i14-19', 'i14-17', 'i14-20', 'i14-23', 'i14-25', 'i14-27', 'i14-30', 'i14-33', 'i14-36', 'i15-01', 'i15-02', 'i15-03', 'i15-08', 'i15-11', 'i15-16', 'i15-17', 'i15-18', 'i15-27', 'i15-19', 'i15-20', 'i15-22', 'i15-24', 'i15-25', 'i16-03', 'i16-05', 'i16-10', 'i16-12', 'i16-15'];
  for (const [name, w, h] of SIZES) {
    const lt = await open({ viewport: { width: w, height: h } }); const lp = lt.page; lp.on('pageerror', (e) => errors.push(e.message));
    const bad = [], small = [], off = [];
    const measure = async (label) => {
      const m = await lp.evaluate(() => {
        const iw = innerWidth, out = { sw: document.documentElement.scrollWidth, iw, bodySw: document.body.scrollWidth, over: [], small: [] };
        const main = document.querySelector('#ci-main, .scroll'); out.mainOver = main ? main.scrollWidth - main.clientWidth : 0;
        const box = document.querySelector('.ci-box, .narrow'); if (box) { const r = box.getBoundingClientRect(); out.left = r.left; out.right = iw - r.right; }
        const root = document.querySelector('#ci-root') || document.body;
        for (const e of root.querySelectorAll('button, input, select, textarea, svg, .ci-pixedit, .ci-net, .ci-plane, table')) { const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue; if (r.left < -1 || r.right > iw + 1) out.over.push((e.id || e.className || e.tagName).toString().slice(0, 25)); }
        for (const e of root.querySelectorAll('.ci-btn, .ci-sw, .ci-node, .ci-bit, .ci-sc, .ci-choice, .ci-orow, .ci-th, select, input[type=text]')) { const r = e.getBoundingClientRect(); if (!r.width || e.closest('[hidden]') || e.disabled) continue; if (r.height < 39.5 || r.width < 39.5) out.small.push((e.id || e.className).toString().slice(0, 20) + ':' + Math.round(r.width) + 'x' + Math.round(r.height)); }
        return out;
      });
      if (m.sw > m.iw + 1 || m.bodySw > m.iw + 1 || m.mainOver > 1) bad.push(label + ' sideways ' + m.sw + '/' + m.iw);
      if (m.over.length) off.push(label + ' ' + m.over.slice(0, 3).join(','));
      if (m.left !== undefined && Math.abs(m.left - m.right) > 2.5) bad.push(label + ' not centred ' + Math.round(m.left) + '/' + Math.round(m.right));
      if (m.small.length) small.push(label + ' ' + m.small.slice(0, 3).join(','));
    };
    await go(lp, `#/coding/${lt.id}`, '.ci-icard'); await measure('map');
    await lp.evaluate(() => { document.querySelector('.scroll').scrollTop = 99999; }); await lp.waitForTimeout(150); await lp.screenshot({ path: OUT + `info-${name}-map.png` });
    for (const wd of [14, 15, 16]) { await go(lp, `#/coding/${lt.id}/i${wd}`, '.cl-lvl'); await measure('world' + wd); }
    await go(lp, `#/coding/${lt.id}/projects`, '#ci-templates'); await measure('projects');
    await go(lp, `#/coding/${lt.id}/certificate`, '#ci-certstat'); await measure('certificate');
    for (const aid of SAMPLE) { await goAct(lt, aid); await lp.waitForTimeout(80); await measure(aid); if (['i14-04', 'i14-11', 'i15-01', 'i15-11', 'i15-19', 'i16-03', 'i16-12'].includes(aid)) await lp.screenshot({ path: OUT + `info-${name}-${aid}.png` }); }
    ok(bad.length === 0, `${name} ${w}x${h}: ${SAMPLE.length + 6} screens (map, 3 worlds, workshop, certificate, ${SAMPLE.length} activities of every kind): nothing sideways, content centred with equal space left and right` + (bad.length ? ' -> ' + bad.slice(0, 3).join(' | ') : ''));
    ok(off.length === 0, `${name}: no control or picture sticks out of the screen` + (off.length ? ' -> ' + off.slice(0, 3).join(' | ') : ''));
    ok(small.length === 0, `${name}: every button, switch, node, card and field a child touches is at least 40 px` + (small.length ? ' -> ' + small.slice(0, 4).join(' | ') : ''));
    await lt.browser.close();
  }

  // ================= English and French =================
  for (const [loc, nm, wantTitle] of [['en-US', 'en', 'Binary switches'], ['fr-FR', 'fr', 'Interrupteurs binaires']]) {
    for (const [dn, vp] of [['phone', { width: 390, height: 844 }], ['ipad', { width: 820, height: 1180 }]]) {
      const lt = await open({ locale: loc, viewport: vp, lessons: true }); const lp = lt.page; lp.on('pageerror', (e) => errors.push(e.message));
      const bad = [];
      const left = async (label, root) => { const l = await chineseLeft(lp, root); if (l.length) bad.push(label + ': ' + l.slice(0, 3).join(' / ')); };
      await go(lp, `#/coding/${lt.id}`, '.ci-icard'); await lp.waitForTimeout(250); await left('map section', '.ci-section'); await left('shelf', '.cl-shelf');
      const secTitle = await lp.textContent('.ci-sech'); const cards = await lp.$$eval('.ci-icard .isl-no', (e) => e.map((x) => x.textContent));
      await go(lp, `#/coding/${lt.id}/i14`, '.cl-lvl'); await left('world 14');
      const firstTitle = await lp.textContent('.cl-lvl .lvl-title');
      await go(lp, `#/coding/${lt.id}/i14/1`, '#cl-lesson'); await left('lesson'); await lp.click('#cl-lesson-close');
      await left('activity 14-1');
      const acts = ['i14-02', 'i14-11', 'i14-15', 'i14-19', 'i14-23', 'i14-27', 'i14-30', 'i14-33', 'i14-36', 'i15-01', 'i15-03', 'i15-08', 'i15-11', 'i15-16', 'i15-17', 'i15-19', 'i15-21', 'i15-24', 'i15-25', 'i16-01', 'i16-10'];
      for (const aid of acts) { await goAct(lt, aid); await lp.evaluate(() => window.__info.wrong()); await lp.waitForTimeout(50); await left(aid); }
      await goAct(lt, 'i14-05'); await lp.evaluate(() => window.__info.solve()); await lp.waitForSelector('#ci-result:not([hidden])'); await left('result');
      await lp.screenshot({ path: OUT + `info-${nm}-${dn}-result.png` });
      for (const r of ['projects', 'projects/new/guess', 'projects/new/quiz', 'projects/new/pixel', 'projects/new/home', 'projects/new/story', 'projects/new/dashboard', 'certificate']) { await go(lp, `#/coding/${lt.id}/${r}`, '.ci-proj'); await lp.waitForTimeout(100); await left(r); }
      ok(bad.length === 0, `${nm} ${dn}: no Chinese UI text left on the map section, a world page, the lesson window, ${acts.length + 2} activities after a wrong answer, the result, the workshop (shelf + 6 editors) and the certificate (lesson texts, task cards, scenario cards and project contents are user boxes)` + (bad.length ? ' -> ' + bad.slice(0, 4).join(' | ') : ''));
      ok(firstTitle === wantTitle && (nm === 'en' ? secTitle === 'Information technology' && cards[0] === 'World 14' : secTitle === "Technologies de l'information" && /Monde 14/.test(cards[0])), `${nm} ${dn}: the section title, the world number and the level titles are translated (${secTitle} / ${cards[0]} / ${firstTitle})`);
      await lt.browser.close();
    }
  }

  // ================= no request outside the app; no script errors =================
  const ext = await open(); ext.page.on('pageerror', (e) => errors.push(e.message));
  for (const a of ['i14-20', 'i15-17', 'i16-12', 'i14-10', 'i15-25']) { await goAct(ext, a); await ext.page.evaluate(() => window.__info.solve()); await ext.page.waitForTimeout(150); }
  await go(ext.page, `#/coding/${ext.id}/certificate`, '#ci-certstat');
  ok(ext.log.external.length === 0, 'no request leaves the app (sound, pictures, the content and the models are all part of the program)' + (ext.log.external.length ? ' -> ' + ext.log.external[0] : ''));
  await ext.browser.close();
  ok(errors.length === 0, 'no script errors' + (errors.length ? ': ' + errors[0] : ''));
  await done();
})();
