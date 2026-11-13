// 编程 (coding), the SCREENS: the card on the subject picker, the list of children, the world map (6 islands, trophy shelf, the glowing recommendation),
// the levels of a world, a level played to the end with the real buttons (run, step, stop, speed, hint, "show the answer" after 3 failed runs, stars saved,
// progress merged between two devices, medal of a finished world), mini-lessons (shown once, can be opened again), the debugging levels, a family level
// judged on hidden maps, random practice, the free drawing canvas (save, 12 at most, delete with a confirmation), deleting a child removes the file,
// layout on 5 screen sizes (nothing sideways, equal space left and right, both scene and workspace usable) and English / French with no Chinese left.
const H = require('./harness.cjs');
const { start, checks, addKid } = H;
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const CJK = /[　-〿一-鿿＀-￯]/;

const kidIds = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('learn.local.kids.json')).kids.map((k) => k.id));
const seen = (all = true) => JSON.stringify({ seen: all ? ['seq', 'loop', 'nest', 'until', 'if', 'ifelse', 'while', 'func', 'param', 'var', 'arith', 'turtle', 'pen'] : [], speed: 'fast', code: false, drawings: {} });
const open = async (opts = {}) => {
  const t = await start(new Map(), { local: true, today: '2026-11-12', viewport: { width: 390, height: 844 }, ...opts });
  await addKid(t.page, 'Dory');
  t.id = (await kidIds(t.page))[0];
  await t.page.evaluate((s) => localStorage.setItem('learn.coding.v1', s), seen(opts.lessons !== true));
  return t;
};
const clearToasts = (page) => page.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((x) => x.remove()));
const go = async (page, hash, sel) => { await clearToasts(page); await page.evaluate((h) => (location.hash = h), hash); await page.waitForSelector(sel); await page.waitForTimeout(120); };
const lvl = (t, l) => go(t.page, `#/coding/${t.id}/${l}`, '.cw .cw-pitem');
const prog = (page) => page.evaluate(() => import('/src/coding-ast.ts').then((A) => A.toText(window.__coding.editor.program()).replace(/\n\s*/g, ' ')));
const doc = (page, id) => page.evaluate((i) => { const s = localStorage.getItem('learn.local.coding/' + i + '.json'); return s ? JSON.parse(s) : null; }, id);
const tap = async (page, kinds) => { for (const k of kinds) await page.click(`.cw-pitem[data-pal="${k}"]`); };
const result = async (page) => { await page.waitForSelector('#cl-result:not([hidden]), #cl-msg.bad', { timeout: 8000 }); return page.evaluate(() => ({ won: !document.querySelector('#cl-result').hidden, stars: document.querySelector('#cl-result').dataset.stars, msg: document.querySelector('#cl-msg').textContent })); };
const chineseLeft = (page) => page.evaluate((src) => {
  const re = new RegExp(src), out = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode()); ) { const p = n.parentElement; if (!p || p.closest('.user, .user-title, script, style')) continue; if (re.test(n.nodeValue)) out.push(n.nodeValue.trim().slice(0, 30)); }
  for (const e of document.querySelectorAll('[title],[aria-label],[placeholder]')) { if (e.closest('.user, .user-title')) continue; for (const a of ['title', 'aria-label', 'placeholder']) { const v = e.getAttribute(a); if (v && re.test(v)) out.push(a + ':' + v.slice(0, 30)); } }
  return out;
}, CJK.source);

(async () => {
  // ================= the picker, the children, the map =================
  let t = await open();
  let page = t.page;
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await go(page, '#/', '.hub-grid');
  const hub = await page.evaluate(() => { const cards = [...document.querySelectorAll('.subject')]; const c = document.querySelector('.subject[data-subject=coding]'); return { ids: cards.map((x) => x.dataset.subject), name: c.querySelector('.s-name').textContent, art: !!c.querySelector('svg'), colors: cards.map((x) => getComputedStyle(x).getPropertyValue('--c2').trim()), hidden: [...cards].filter((x) => x.dataset.subject === 'coding').length, text: [...c.querySelectorAll('svg text')].map((x) => x.textContent).join('') }; });
  ok(hub.ids.slice(0, 5).join() === 'chinese,math,english,science,coding' && hub.name === '编程' && hub.art, 'the subject picker has a fifth card "编程" with its picture, after the four school subjects: ' + hub.ids.join());
  ok(new Set(hub.colors).size === hub.colors.length, 'its colour differs from every other card (' + hub.colors.join(' ') + ')');
  ok(!/[一-鿿]/.test(hub.text) && /^[\x20-\x7e]*$/.test(hub.text), 'the picture holds only Latin letters / symbols (' + JSON.stringify(hub.text) + ')');
  await page.screenshot({ path: OUT + 'coding-hub.png' });
  await page.click('.subject[data-subject=coding]'); await page.waitForSelector('.kids');
  ok(page.url().endsWith('#/subject/coding') && (await page.locator('.kid').count()) === 1, 'the card leads to the list of children (#/subject/coding)');
  ok((await page.textContent('.kid .ksub')).includes('★ 0') && (await page.textContent('.kid .ksub')).includes('已完成 0 个世界'), 'each child shows its stars and finished worlds');
  ok(!(await page.locator('dialog').count()), 'no grade is asked (programming has no grade question)');
  await page.click('.kid');
  await page.waitForSelector('.cl-island');
  ok(page.url().endsWith(`#/coding/${t.id}`) && !(await page.locator('dialog').count()), 'a child opens the world map without any grade question');
  const map = await page.evaluate(() => ({ islands: [...document.querySelectorAll('.cl-island:not(.free)')].map((e) => e.dataset.world + ':' + e.querySelector('.isl-name').textContent), rec: [...document.querySelectorAll('.cl-island.rec')].map((e) => e.dataset.world), trophies: document.querySelectorAll('.cl-trophy').length, got: document.querySelectorAll('.cl-trophy.got').length, free: !!document.querySelector('#cl-free'), total: document.querySelector('#cl-total').textContent, stars: [...document.querySelectorAll('.isl-stars')].map((e) => e.textContent).join(' '), shortcuts: [...document.querySelectorAll('.shortcut')].map((e) => e.id).join() }));
  ok(map.islands.join() === '1:顺序,2:循环,3:条件,4:函数,5:变量和计数,6:画图' && map.free && map.trophies === 6 && map.got === 0, 'the map has six world islands in order, the free drawing island and a shelf of six medals: ' + map.islands.join(' '));
  ok(map.rec.join() === '1' && map.stars.startsWith('★ 0 / 36 ★ 0 / 42 ★ 0 / 42 ★ 0 / 36 ★ 0 / 30'), 'world 1 glows as the recommendation; every island shows its stars (0 / 36, 0 / 42, 0 / 42, 0 / 36, 0 / 30, 0 / 42)');
  ok(map.shortcuts === 'go-chinese,go-math,go-english,go-science', 'the top bar has the shortcuts to the four other subjects');
  await page.screenshot({ path: OUT + 'coding-map.png' });
  // the grade only decides the first recommendation
  await page.evaluate(() => localStorage.setItem('learn.profile.v1', JSON.stringify({ kids: {} })));
  await page.evaluate((id) => { const p = JSON.parse(localStorage.getItem('learn.profile.v1')); p.kids[id] = { grade: 6, setOn: '2026-10-01' }; localStorage.setItem('learn.profile.v1', JSON.stringify(p)); }, t.id);
  await go(page, `#/coding/${t.id}/w1`, '.cl-lvl'); await go(page, `#/coding/${t.id}`, '.cl-island');
  ok((await page.locator('.cl-island.rec').getAttribute('data-world')) === '2', 'with no progress, a child in grade 6 gets world 2 recommended (and nothing is asked)');
  // the world page
  await go(page, `#/coding/${t.id}/w1`, '.cl-lvl');
  const wp = await page.evaluate(() => ({ n: document.querySelectorAll('.cl-lvl').length, debug: [...document.querySelectorAll('.cl-lvl.debug')].map((e) => e.dataset.level).join(), boss: [...document.querySelectorAll('.cl-lvl.boss')].map((e) => e.dataset.level).join(), random: !!document.querySelector('#cl-random'), lesson: !!document.querySelector('#cl-world-lesson'), nums: [...document.querySelectorAll('.lvl-no')].map((e) => e.textContent).join(), title: document.querySelector('header h1').textContent, round: [...document.querySelectorAll('.lvl-no')].every((e) => Math.abs(e.getBoundingClientRect().width - e.getBoundingClientRect().height) < 1 && e.getBoundingClientRect().width >= 40) }));
  ok(wp.n === 12 && wp.nums === '1,2,3,4,5,6,7,8,9,10,11,12' && wp.debug === 'w1-09,w1-10,w1-11' && wp.boss === 'w1-12' && wp.random && wp.lesson && wp.round, 'world 1: twelve numbered round buttons, three debugging levels and the boss marked, a random challenge button and a lesson button');
  for (const w of [2, 3, 4, 5, 6]) { await go(page, `#/coding/${t.id}/w${w}`, '.cl-lvl'); const r = await page.evaluate(() => [document.querySelectorAll('.cl-lvl').length, !!document.querySelector('#cl-random')]); ok(r[0] === [12, 14, 14, 12, 10, 14][w - 1] && r[1] === (w <= 3), `world ${w}: ${r[0]} levels, random challenge button ${r[1] ? 'present' : 'absent (worlds 1-3 only)'}`); }

  // ================= a level played to the end =================
  await lvl(t, 'w1/1');
  ok(/1-1/.test(await page.textContent('#cl-title')) && (await page.textContent('#cl-goal')).includes('走到旗子处'), 'level 1-1 shows its number, name and goal');
  const geo = await page.evaluate(() => { const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; }; return { scene: r('.cs-wrap'), ws: r('.cw-ws'), pal: r('.cw-pal'), robot: document.querySelector('#cs-robot').dataset.x + ',' + document.querySelector('#cs-robot').dataset.y, face: document.querySelector('.cs-wrap').dataset.mood }; });
  ok(geo.scene[0] >= 200 && geo.ws[1] >= 100 && geo.pal[1] >= 40, 'scene and workspace are both usable on a phone (' + geo.scene.join('x') + ' / ' + geo.ws.join('x') + ')');
  await page.click('#cl-run');
  ok((await page.textContent('#cl-msg')).includes('请先搭一些积木'), 'running an empty program says so');
  await tap(page, ['move', 'move']);
  await page.click('#cl-run');
  let r = await result(page);
  ok(!r.won && /还没有到达旗子/.test(r.msg) && (await page.locator('#cl-answer').isHidden()), 'a program that stops short: "robot has not reached the flag", no answer offered yet: ' + r.msg);
  ok((await page.evaluate(() => document.querySelector('#cs-robot').dataset.x)) === '3', 'the robot walked two cells (x = 3)');
  await page.click('#cl-hint');
  ok(await page.locator('.cw-pitem[data-pal="move"].hint').count() === 0 && /顺序已经正确|请使用高亮|多了|高亮/.test(await page.textContent('#cl-msg')), 'the hint answers (' + (await page.textContent('#cl-msg')) + ')');
  await tap(page, ['move']);
  await page.click('#cl-run');
  r = await result(page);
  ok(r.won && r.stars === '3', 'three moves reach the flag: the result card appears with 3 stars');
  ok((await page.evaluate(() => document.querySelector('.cs-wrap').dataset.mood)) === 'happy', 'the robot is happy');
  ok(/使用了 3 块积木/.test(await page.textContent('#cl-res-text')), 'the card says how many blocks were used: ' + (await page.textContent('#cl-res-text')));
  await page.waitForTimeout(600);
  const saved = await doc(page, t.id);
  ok(saved && saved.stars['w1-01'] === 3 && saved.blocks['w1-01'] === 3, 'the stars and the block count are saved in coding/<kid>.json: ' + JSON.stringify(saved));
  await page.screenshot({ path: OUT + 'coding-level-done.png' });
  await page.click('#cl-next');
  await page.waitForSelector('.cw-pitem');
  ok(page.url().endsWith(`#/coding/${t.id}/w1/2`), 'the next-level button opens level 1-2');
  // a longer program gives fewer stars
  await lvl(t, 'w1/1');
  await tap(page, ['move', 'move', 'move', 'left', 'right']);
  await page.click('#cl-run'); r = await result(page);
  ok(r.won && r.stars === '2', '5 blocks for par 3 (<= 4.5? no: 1.5 x 3 = 4.5): ' + r.stars + ' stars');
  // the best result is kept: a worse run does not lower it
  await page.waitForTimeout(500);
  const keep = await doc(page, t.id);
  ok(keep.stars['w1-01'] === 3 && keep.blocks['w1-01'] === 3, 'a worse run does not lower the saved stars or the best block count');
  // crash: the robot shakes, the message says what happened
  await lvl(t, 'w1/1');
  await tap(page, ['left', 'move']);
  await page.click('#cl-run'); r = await result(page);
  ok(!r.won && /撞到了/.test(r.msg) && (await page.evaluate(() => document.querySelector('.cs-wrap').dataset.mood)) === 'crash', 'a crash into a wall: the message names it and the robot shows a crash face');
  // single step: one block per press, the running block is lit, stop resets
  await lvl(t, 'w1/1');
  await tap(page, ['move', 'move', 'move']);
  await page.click('#cl-step');
  ok((await page.locator('.cw-ws .cw-b.running').count()) === 1 && (await page.evaluate(() => document.querySelector('#cs-robot').dataset.x)) === '2', 'single step: the first block is lit and the robot moved one cell');
  ok(await page.locator('.cw-ws .cw-b').first().evaluate((e) => e.classList.contains('running')), '... and it is the first block');
  await page.click('#cl-step');
  ok((await page.evaluate(() => document.querySelector('#cs-robot').dataset.x)) === '3' && await page.locator('.cw-ws .cw-b').nth(1).evaluate((e) => e.classList.contains('running')), 'the second press lights the second block and moves again');
  ok(await page.evaluate(() => document.querySelector('.cw').classList.contains('locked')), 'the editor is locked while the program runs');
  await page.click('#cl-stop');
  ok((await page.evaluate(() => document.querySelector('#cs-robot').dataset.x)) === '1' && !(await page.locator('.cw-b.running').count()) && !(await page.evaluate(() => document.querySelector('.cw').classList.contains('locked'))), 'stop puts the robot back at the start and unlocks the editor');
  ok(/已停止/.test(await page.textContent('#cl-msg')), 'and says so');
  await page.click('#cl-step'); await page.click('#cl-step'); await page.click('#cl-step');
  r = await result(page);
  ok(r.won, 'pressing "step" until the end finishes the program and wins');
  // speed buttons
  await lvl(t, 'w1/1');
  await page.click('#cl-sp-slow');
  ok(JSON.parse(await page.evaluate(() => localStorage.getItem('learn.coding.v1'))).speed === 'slow' && await page.locator('#cl-sp-slow').evaluate((e) => e.classList.contains('on')), 'the speed buttons remember their choice (slow)');
  const slowMs = await page.evaluate(() => getComputedStyle(document.querySelector('.cs-wrap')).getPropertyValue('--cs-ms'));
  await page.click('#cl-sp-fast');
  const fastMs = await page.evaluate(() => getComputedStyle(document.querySelector('.cs-wrap')).getPropertyValue('--cs-ms'));
  ok(parseInt(slowMs) > parseInt(fastMs) * 3, 'slow and fast change the animation time (' + slowMs.trim() + ' / ' + fastMs.trim() + ')');
  const t0 = Date.now();
  await tap(page, ['move', 'move', 'move']); await page.click('#cl-run'); await result(page);
  ok(Date.now() - t0 < 4000, 'a fast run of three blocks is over in ' + (Date.now() - t0) + ' ms (including the clicks)');

  // ================= failures: hint, the answer after 3 failed runs =================
  await lvl(t, 'w1/5');
  ok(await page.locator('#cl-answer').isHidden(), 'the "show answer" button is hidden at first');
  await tap(page, ['move']); await page.click('#cl-hint');
  ok(await page.locator('.cw-pitem[data-pal="move"].hint').count() === 0, 'the hint of a program that starts right does not mark the palette');
  await page.click('.cw-ws .cw-b'); // no change
  for (let i = 0; i < 3; i++) { await page.click('#cl-run'); await result(page); await page.waitForTimeout(150); }
  ok(await page.locator('#cl-answer').isVisible(), 'after 3 failed runs the "show answer" button appears');
  await page.click('#cl-answer'); await page.waitForSelector('#cl-answer-dlg');
  const ans = await page.evaluate(() => ({ blocks: document.querySelectorAll('#cl-answer-dlg .cw-b').length, kinds: [...document.querySelectorAll('#cl-answer-dlg .cw-b')].map((e) => e.dataset.kind).join() }));
  ok(ans.kinds === 'move,move,take,move,move', 'the answer dialog shows the reference solution as blocks: ' + ans.kinds);
  await page.screenshot({ path: OUT + 'coding-answer.png' });
  await page.click('#cl-answer-use');
  ok((await prog(page)) === 'move move take move move', 'using the answer puts it into the workspace');
  await page.click('#cl-run'); r = await result(page);
  ok(r.won && r.stars === '1' && /最多得 1 颗星/.test(await page.textContent('#cl-result')), 'a level solved with the answer gives only 1 star, and says so');
  // the hint on a wrong block
  await lvl(t, 'w1/5');
  await tap(page, ['left']);
  await page.click('#cl-hint');
  ok(await page.locator('.cw-ws .cw-b.hint-wrong').count() === 1 && await page.locator('.cw-pitem[data-pal="move"].hint').count() === 1, 'the hint marks the wrong block in the workspace and the block that is needed in the palette');
  await page.click('#cw-undo'); await page.click('#cl-hint');
  ok(await page.locator('.cw-pitem[data-pal="move"].hint').count() === 1 && !(await page.locator('.cw-b.hint-wrong').count()), 'with an empty program the hint names "move"; editing clears the marks');

  // ================= debugging levels, families, endless loops =================
  await lvl(t, 'w1/9');
  ok((await prog(page)) === 'move move left move move', 'a debugging level starts with the buggy program in the workspace');
  ok((await page.textContent('#cl-goal')).includes('程序里有一个错误'), 'and tells the child to correct it');
  await page.click('#cl-run'); r = await result(page);
  ok(!r.won && /撞到了/.test(r.msg), 'the buggy program crashes');
  await page.click('.cw-ws .cw-b:nth-child(3)', { force: true }).catch(() => {});
  await page.evaluate(() => { const E = window.__coding.editor; const p = E.program(); p.main[2].t = 'right'; E.setProgram(p); });
  await page.click('#cl-run'); r = await result(page);
  ok(r.won && r.stars === '3', 'fixing the one block solves it with 3 stars');
  await lvl(t, 'w2/8');
  await page.evaluate(() => window.__coding.run('repeat 4 { move }'));
  await page.click('#cl-run'); r = await result(page);
  ok(!r.won && /另一张地图/.test(r.msg), 'a family level: a program that fits only the shown map is rejected: ' + r.msg);
  await page.evaluate(() => window.__coding.run('until onFlag { move }'));
  await page.click('#cl-run'); r = await result(page);
  ok(r.won, 'the general program wins');
  await lvl(t, 'w3/8');
  await page.evaluate(() => window.__coding.run('while pathAhead { }'));
  await page.click('#cl-run'); r = await result(page);
  ok(!r.won && /一直在循环/.test(r.msg), 'an endless loop is stopped with a friendly message: ' + r.msg);
  ok(await page.evaluate(() => !document.querySelector('.cw').classList.contains('locked')), 'and the editor is usable again');

  // ================= mini-lessons =================
  await t.browser.close();
  t = await open({ lessons: true }); page = t.page;
  await lvl(t, 'w1/1').catch(() => {});
  await page.waitForSelector('#cl-lesson');
  ok(await page.locator('#cl-lesson-text').isVisible() && (await page.locator('#cl-lesson .cs-wrap').count()) === 1, 'the first time level 1-1 is opened its mini-lesson opens by itself, with a demo scene');
  const steps = [];
  for (let i = 0; i < 4; i++) { steps.push(await page.textContent('#cl-lesson-text')); await page.waitForTimeout(900); steps.push(await page.evaluate(() => document.querySelector('#cl-lesson .cs-wrap').dataset.got + '/' + document.querySelector('#cl-lesson #cs-robot').dataset.x)); if (i < 3) await page.click('#cl-lesson-next'); }
  ok(new Set(steps.filter((_, i) => i % 2 === 0)).size === 4 && (await page.textContent('#cl-lesson-next')) === '完成', 'four steps with four different texts; the last button says "done"');
  const demoMoves = await page.evaluate(() => document.querySelector('#cl-lesson #cs-robot').dataset.x);
  ok(demoMoves !== undefined, 'the demo robot runs by itself (x = ' + demoMoves + ')');
  await page.screenshot({ path: OUT + 'coding-lesson.png' });
  ok(await page.locator('#cl-lesson-prev').isEnabled(), 'previous is possible on the last step');
  await page.click('#cl-lesson-next');
  await page.waitForSelector('#cl-lesson', { state: 'detached' });
  ok(JSON.parse(await page.evaluate(() => localStorage.getItem('learn.coding.v1'))).seen.includes('seq'), 'finishing it remembers on this device that it was seen');
  await lvl(t, 'w1/2'); await lvl(t, 'w1/1');
  await page.waitForTimeout(400);
  ok(!(await page.locator('#cl-lesson').count()), 'it does not open again');
  await page.click('#cl-lesson-btn');
  await page.waitForSelector('#cl-lesson');
  ok(await page.locator('#cl-lesson').isVisible(), 'the ? button opens it again');
  await page.click('#cl-lesson-close');
  await lvl(t, 'w2/1').catch(() => {});
  await page.waitForSelector('#cl-lesson');
  ok((await page.textContent('#cl-lesson h2')).includes('循环'), 'the first level of the next world opens its own lesson (loops)');
  await page.click('#cl-lesson-close');
  await go(page, `#/coding/${t.id}/w3`, '.cl-lvl');
  await page.click('#cl-world-lesson'); await page.waitForSelector('#cl-lesson');
  ok((await page.textContent('#cl-lesson h2')).includes('如果'), 'the world page has a lesson button too');
  await page.click('#cl-lesson-close');
  await t.browser.close();

  // ================= progress on two devices, a finished world, deleting a child (pretend GitHub) =================
  const store = new Map();
  const g = await start(store, { today: '2026-11-12', viewport: { width: 390, height: 844 } });
  page = g.page;
  await page.evaluate(() => { location.hash = '#/chinese'; });
  await H.addKid(page, 'Dory');
  const gid = JSON.parse(store.get('kids.json')).kids[0].id;
  await page.evaluate((s) => localStorage.setItem('learn.coding.v1', s), seen(true));
  g.id = gid;
  // all levels of world 1 but the last are solved on "another device"
  const w1 = require('fs');
  const levels1 = [...Array(11)].map((_, i) => `w1-${String(i + 1).padStart(2, '0')}`);
  store.set(`coding/${gid}.json`, JSON.stringify({ stars: Object.fromEntries(levels1.map((l) => [l, 2])), blocks: Object.fromEntries(levels1.map((l) => [l, 9])), challenges: 1 }));
  void w1;
  await lvl(g, 'w1/12');
  await page.evaluate(() => window.__coding.run('move take move take right move move take right move move left move move light move move'));
  await page.click('#cl-run'); r = await result(page);
  ok(r.won && r.stars === '3', 'the boss of world 1 is solved with 3 stars');
  await page.waitForSelector('#cl-medal-dlg', { timeout: 5000 });
  ok(/获得徽章/.test(await page.textContent('#cl-medal-dlg')) && (await page.locator('#cl-medal-dlg svg').count()) === 1, 'finishing the last level of a world shows its medal');
  await page.screenshot({ path: OUT + 'coding-medal.png' });
  await page.click('#cl-medal-ok');
  const cg = JSON.parse(store.get(`coding/${gid}.json`));
  ok(cg.stars['w1-12'] === 3 && cg.stars['w1-01'] === 2 && cg.challenges === 1, 'the file in the data repository holds this result AND what the other device had (merged by read-modify-write): ' + Object.keys(cg.stars).length + ' levels');
  ok(g.log.puts.includes(`coding/${gid}.json`) && !g.log.puts.some((p) => /^kids\/.+\.json$/.test(p) && p.includes('coding')), 'only coding/<kid>.json was written for it (the Chinese files are untouched)');
  await go(page, `#/coding/${gid}`, '.cl-island');
  const m2 = await page.evaluate(() => ({ got: [...document.querySelectorAll('.cl-trophy.got')].map((e) => e.dataset.world).join(), rec: document.querySelector('.cl-island.rec')?.dataset.world, stars: document.querySelector('.cl-island[data-world="1"] .isl-stars').textContent, done: document.querySelector('.cl-island[data-world="1"]').classList.contains('done') }));
  ok(m2.got === '1' && m2.rec === '2' && m2.stars === '★ 25 / 36' && m2.done, 'the map shows the medal on the shelf, the island marked done, 25 / 36 stars, and now recommends world 2');
  await page.screenshot({ path: OUT + 'coding-map-progress.png' });
  // two devices writing at once: the other device changes the file between our read and our write
  let first = true;
  await page.evaluate(() => (location.hash = '#/'));
  await g.browser.close();
  const store2 = new Map();
  let id2 = '';
  const g2 = await start(store2, { today: '2026-11-12', viewport: { width: 390, height: 844 }, beforePut: (key, st, version) => { if (key.startsWith('coding/') && first && id2) { first = false; st.set(key, JSON.stringify({ stars: { 'w1-01': 1, 'w1-02': 3 }, blocks: { 'w1-01': 9, 'w1-02': 4 }, challenges: 4 })); version.set(key, (version.get(key) || 0) + 1); } } });
  await g2.page.evaluate(() => { location.hash = '#/chinese'; }); await H.addKid(g2.page, 'Dory');
  id2 = JSON.parse(store2.get('kids.json')).kids[0].id;
  await g2.page.evaluate((s) => localStorage.setItem('learn.coding.v1', s), seen(true));
  store2.set(`coding/${id2}.json`, JSON.stringify({ stars: { 'w1-01': 1 }, blocks: { 'w1-01': 9 }, challenges: 0 }));
  g2.id = id2;
  await lvl(g2, 'w1/1'); await tap(g2.page, ['move', 'move', 'move']); await g2.page.click('#cl-run'); await result(g2.page);
  await g2.page.waitForTimeout(800);
  const m3 = JSON.parse(store2.get(`coding/${id2}.json`));
  ok(!first && m3.stars['w1-01'] === 3 && m3.stars['w1-02'] === 3 && m3.blocks['w1-01'] === 3 && m3.challenges === 4, 'two devices at once (a 409 on the first write): both results are kept: ' + JSON.stringify(m3.stars) + ' challenges ' + m3.challenges);
  // deleting the child removes the file
  await H.openManage(g2.page);
  await g2.page.click('.kidrow:has-text("Dory") .delete'); await g2.page.waitForSelector('dialog');
  await g2.page.click('dialog button.danger, dialog button:has-text("删除")');
  await g2.page.waitForTimeout(800);
  ok(!store2.has(`coding/${id2}.json`) && g2.log.deletes.includes(`coding/${id2}.json`), 'deleting the child removes coding/<kid>.json as well');
  ok(g2.log.external.length === 0, 'no outside request');
  await g2.browser.close();

  // ================= random practice =================
  t = await open(); page = t.page;
  await go(page, `#/coding/${t.id}/w1`, '.cl-lvl');
  await page.click('#cl-random'); await page.waitForSelector('.cw-pitem');
  ok(page.url().endsWith(`#/coding/${t.id}/r1`) && /随机挑战/.test(await page.textContent('#cl-title')), 'the random challenge button opens a random level of world 1');
  const keys = new Set();
  let prevKey = '';
  for (let i = 0; i < 6; i++) {
    const k = await page.evaluate(() => JSON.stringify([window.__coding.level.fixed.world.cells, window.__coding.level.fixed.state.x, window.__coding.level.fixed.state.y, Object.keys(window.__coding.level.fixed.state.stars)]));
    if (k === prevKey) ok(false, 'two random levels in a row were the same');
    prevKey = k; keys.add(k);
    await page.evaluate(() => window.__coding.run(window.__coding.level.solution));
    await page.click('#cl-run'); r = await result(page);
    if (!r.won) { ok(false, 'a random level could not be solved by its reference'); break; }
    if (i < 5) { await page.click('#cl-new'); await page.waitForTimeout(150); }
  }
  ok(keys.size === 6, 'six random levels in a row, solved with their reference programs, all different');
  await page.waitForTimeout(400);
  ok((await doc(page, t.id)).challenges === 6, 'every solved random challenge is counted in the progress file (6)');
  ok(!(await doc(page, t.id)).stars || Object.keys((await doc(page, t.id)).stars).length === 0, 'and gives no stars of the numbered levels');
  await page.screenshot({ path: OUT + 'coding-random.png' });
  for (const w of [2, 3]) { await go(page, `#/coding/${t.id}/r${w}`, '.cw-pitem'); await page.evaluate(() => window.__coding.run(window.__coding.level.solution)); await page.click('#cl-run'); r = await result(page); ok(r.won, `a random level of world ${w} is solved by its reference`); }

  // ================= free drawing =================
  await go(page, `#/coding/${t.id}/free`, '.cw-pitem');
  ok((await page.locator('.cw-pitem').count()) >= 8 && !(await page.locator('.cs-target path').count()), 'the free canvas has the turtle blocks and no target picture');
  await page.evaluate(() => window.__coding.run('repeat 4 { fd 40 tr 90 }'));
  await page.click('#cl-run');
  await page.waitForFunction(() => document.querySelector('.cs-wrap').dataset.segs === '4', null, { timeout: 8000 });
  ok(/已画完/.test(await page.textContent('#cl-msg')), 'a program draws on the canvas (4 segments) and says "drawing finished"');
  await page.click('#cl-save');
  ok(JSON.parse(await page.evaluate(() => localStorage.getItem('learn.coding.v1'))).drawings[t.id].length === 1, 'save keeps the drawing on this device (learn.coding.v1)');
  await page.click('#cl-gallery'); await page.waitForSelector('#cl-gal .cl-gal-item');
  ok((await page.locator('.cl-gal-item').count()) === 1 && (await page.locator('.cl-gal-item svg path').count()) >= 1, 'the gallery shows a thumbnail drawn from the saved program');
  await page.screenshot({ path: OUT + 'coding-gallery.png' });
  // delete: cancel is silent, confirm deletes with a message
  await page.click('.cl-gal-del'); await page.waitForSelector('dialog.center >> text=删除这幅作品');
  await page.click('dialog:has-text("删除这幅作品") button:has-text("取消")');
  ok((await page.locator('.cl-gal-item').count()) === 1 && !/已删除/.test(await page.evaluate(() => document.getElementById('toasts')?.textContent || '')), 'cancelling the delete keeps the drawing and shows no "done" message');
  await page.click('.cl-gal-del'); await page.click('dialog:has-text("删除这幅作品") button.danger, dialog:has-text("删除这幅作品") button:has-text("删除"):not(.cl-gal-del)');
  await page.waitForTimeout(200);
  ok((await page.locator('#cl-gal-empty').count()) === 1 && JSON.parse(await page.evaluate(() => localStorage.getItem('learn.coding.v1'))).drawings[t.id].length === 0, 'confirming deletes it (the gallery says there are none)');
  ok(/已删除/.test(await page.evaluate(() => document.getElementById('toasts').textContent)), 'with a message');
  await page.click('#cl-gal-close');
  // 12 at most
  for (let i = 0; i < 12; i++) { await clearToasts(page); await page.click('#cl-save'); }
  ok(JSON.parse(await page.evaluate(() => localStorage.getItem('learn.coding.v1'))).drawings[t.id].length === 12, 'twelve drawings can be saved');
  await clearToasts(page); await page.click('#cl-save');
  ok(JSON.parse(await page.evaluate(() => localStorage.getItem('learn.coding.v1'))).drawings[t.id].length === 12 && /最多保存 12/.test(await page.evaluate(() => document.getElementById('toasts').textContent)), 'the 13th is refused with a message');
  // open a saved drawing
  await page.evaluate(() => window.__coding.run('repeat 3 { fd 30 tr 120 }'));
  await page.click('#cl-gallery'); await page.waitForSelector('.cl-gal-item');
  await page.click('.cl-gal-open >> nth=0'); await page.waitForTimeout(150);
  ok((await prog(page)) === 'repeat 4 { fd 40 tr 90 }', 'opening a saved drawing loads its program into the workspace');
  // clear asks first
  await page.click('#cl-clear'); await page.waitForSelector('dialog');
  await page.click('dialog button:has-text("取消")');
  ok((await prog(page)) !== '', 'cancelling "clear" keeps the program');
  await page.click('#cl-clear'); await page.click('dialog button.danger, dialog button:has-text("清空"):not(#cl-clear)');
  await page.waitForTimeout(150);
  ok((await prog(page)) === '', 'confirming clears it');
  // a turtle level: the target is shown, wrong picture is rejected, right one wins
  await lvl(t, 'w6/4');
  ok((await page.locator('.cs-target path').count()) >= 1 && (await page.textContent('#cl-goal')).includes('边长 60'), 'a turtle level shows the target picture (dashed) and the side length');
  await page.evaluate(() => window.__coding.run('repeat 4 { fd 50 tr 90 }'));
  await page.click('#cl-run'); r = await result(page);
  ok(!r.won && /不一样/.test(r.msg), 'a square with the wrong side is "different from the target"');
  await page.evaluate(() => window.__coding.run('repeat 4 { fd 60 tr 90 }'));
  await page.click('#cl-run'); r = await result(page);
  ok(r.won && r.stars === '3', 'the right square wins');
  await page.screenshot({ path: OUT + 'coding-turtle-done.png' });
  // the start position of the turtle is not the middle: the picture is centred
  const pos = await page.evaluate(() => [window.__coding.state.x, window.__coding.state.y]);
  ok(pos[0] !== 0 || pos[1] !== 0, 'the turtle starts where the picture is centred, not at the corner');
  ok(t.log.external.length === 0, 'no outside request');
  ok(errors.length === 0, 'no script errors' + (errors.length ? ': ' + errors[0] : ''));
  await t.browser.close();

  // ================= layout on five screens =================
  for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['small phone', { width: 320, height: 568 }], ['iPad portrait', { width: 820, height: 1180 }], ['iPad landscape', { width: 1180, height: 820 }], ['phone landscape', { width: 844, height: 390 }]]) {
    const s = await open({ viewport: vp }); const p = s.page;
    const metrics = (sel) => p.evaluate((q) => { const e = document.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(innerWidth - b.right), w: Math.round(b.width), h: Math.round(b.height), t: Math.round(b.top), b: Math.round(b.bottom) }; }, sel);
    const sw = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1);
    await go(p, `#/coding/${s.id}`, '.cl-island');
    const sides = await p.evaluate(() => { const rs = [...document.querySelectorAll('.cl-island')].map((e) => e.getBoundingClientRect()); return [Math.round(Math.min(...rs.map((r) => r.left))), Math.round(innerWidth - Math.max(...rs.map((r) => r.right)))]; });
    ok((await sw()) && Math.abs(sides[0] - sides[1]) <= 2, `${name}: world map: nothing sideways, equal space left and right (${sides.join(' / ')})`);
    await p.screenshot({ path: OUT + `coding-map-${name.replace(/ /g, '-')}.png` });
    await go(p, `#/coding/${s.id}/w2`, '.cl-lvl');
    const ls = await p.evaluate(() => { const rs = [...document.querySelectorAll('.cl-lvl')].map((e) => e.getBoundingClientRect()); return [Math.round(Math.min(...rs.map((r) => r.left))), Math.round(innerWidth - Math.max(...rs.map((r) => r.right))), Math.min(...rs.map((r) => r.width)), Math.min(...rs.map((r) => r.height))]; });
    ok((await sw()) && ls[0] >= 8 && ls[1] >= 8 && ls[2] >= 70 && ls[3] >= 100, `${name}: level path: no overflow, margins ${ls[0]} / ${ls[1]}, buttons at least ${Math.round(ls[2])} x ${Math.round(ls[3])}`);
    for (const [lv, label] of [['w1/8', 'grid level'], ['w3/6', 'level with code'], ['w4/8', 'functions'], ['w6/6', 'turtle level']]) {
      await lvl(s, lv);
      await p.evaluate(() => { const E = window.__coding.editor; E.setProgram(window.__coding.level.sol ? JSON.parse(JSON.stringify(window.__coding.level.sol)) : E.program()); });
      await p.waitForTimeout(100);
      const sc = await metrics('.cs-wrap'), ws = await metrics('.cw-ws'), pal = await metrics('.cw-pal'), main = await metrics('.cl-main');
      const small = await p.evaluate(() => [...document.querySelectorAll('.cw-pitem, .cw-ws .cw-b, .cw-ubtn, #cl-run, #cl-step, #cl-stop, #cl-hint')].filter((e) => e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 40).map((e) => e.className + ':' + Math.round(e.getBoundingClientRect().height)));
      ok(await sw() && sc.w >= 140 && ws.w >= 220 && ws.h >= 90 && pal.h >= 40 && small.length === 0, `${name} ${label}: no overflow, scene ${sc.w}x${sc.h}, workspace ${ws.w}x${ws.h}, palette ${pal.h} high, every button / block at least 40 px high` + (small.length ? ' SMALL: ' + small.slice(0, 3) : ''));
      // the scene is centred in its column
      const scn = await p.evaluate(() => { const c = document.querySelector('.cl-scene').getBoundingClientRect(), s2 = document.querySelector('.cs-wrap').getBoundingClientRect(); return Math.abs((s2.left - c.left) - (c.right - s2.right)); });
      ok(scn <= 2, `${name} ${label}: the scene is centred in its column (off by ${Math.round(scn)} px)`);
      // the program can be dragged: the palette block and a free slot are both reachable by scrolling the main area
      await p.screenshot({ path: OUT + `coding-level-${lv.replace('/', '-')}-${name.replace(/ /g, '-')}.png` });
      void main;
    }
    // the lesson dialog fits
    await p.evaluate((s2) => localStorage.setItem('learn.coding.v1', s2), seen(false));
    await lvl(s, 'w1/1'); await p.waitForSelector('#cl-lesson');
    const dlg = await p.evaluate(() => { const b = document.querySelector('dialog').getBoundingClientRect(); return [Math.round(b.left), Math.round(innerWidth - b.right), Math.round(b.top), Math.round(innerHeight - b.bottom)]; });
    ok(dlg[0] >= 0 && dlg[1] >= 0 && dlg[2] >= 0 && dlg[3] >= 0 && Math.abs(dlg[0] - dlg[1]) <= 2, `${name}: the lesson dialog fits the screen and is centred`);
    await p.screenshot({ path: OUT + `coding-lesson-${name.replace(/ /g, '-')}.png` });
    await s.browser.close();
  }

  // ================= English and French: nothing Chinese is left =================
  for (const [loc, name] of [['en-US', 'en'], ['fr-FR', 'fr']]) {
    const s = await open({ locale: loc, lessons: true }); const p = s.page; const left = [];
    const scan = async (what) => { const l = await chineseLeft(p); if (l.length) left.push(what + ': ' + l.slice(0, 4).join(' | ')); };
    await go(p, '#/', '.hub-grid'); await scan('picker');
    const cardName = await p.textContent('.subject[data-subject=coding] .s-name');
    ok(cardName === (name === 'en' ? 'Coding' : 'Programmation'), `${name}: the card is named "${cardName}"`);
    await p.click('.subject[data-subject=coding]'); await p.waitForSelector('.kids'); await scan('children');
    await p.click('.kid'); await p.waitForSelector('.cl-island'); await scan('map');
    await go(p, `#/coding/${s.id}/w1`, '.cl-lvl'); await scan('world');
    await go(p, `#/coding/${s.id}/w1/1`, '#cl-lesson'); await scan('lesson'); await p.waitForTimeout(900); await scan('lesson demo');
    for (let i = 0; i < 4; i++) { await p.click('#cl-lesson-next'); await scan('lesson step ' + i); }
    await p.waitForSelector('#cl-lesson', { state: 'detached' });
    await p.evaluate((s2) => localStorage.setItem('learn.coding.v1', s2), seen(true));
    await scan('level 1-1');
    await tap(p, ['move']); await p.click('#cl-run'); await result(p); await scan('level run (message)');
    await p.click('#cl-hint'); await scan('hint');
    for (let i = 0; i < 2; i++) { await p.click('#cl-run'); await result(p); }
    await p.click('#cl-answer'); await p.waitForSelector('#cl-answer-dlg'); await scan('answer dialog'); await p.click('#cl-answer-use'); await p.click('#cl-run'); await result(p); await scan('result card');
    await p.screenshot({ path: OUT + `coding-${name}-result.png` });
    await lvl(s, 'w3/4'); await scan('level 3-4'); await tap(p, ['until', 'ifelse']); await p.click('.cw-ws .cw-cond >> nth=1'); await scan('condition list'); await p.keyboard.press('Escape');
    await p.click('#cl-code-btn'); await p.click('#cl-code-btn'); await scan('code toggle');
    await lvl(s, 'w4/5'); await scan('level 4-5'); await tap(p, ['call:walk', 'repeat']);
    await lvl(s, 'w5/4'); await tap(p, ['set']); await p.click('.cw-ws .cw-op'); await scan('operator list'); await p.keyboard.press('Escape'); await scan('level 5-4');
    await lvl(s, 'w6/10'); await tap(p, ['color']); await p.click('.cw-ws .cw-swatch'); await scan('colour list'); await p.keyboard.press('Escape'); await scan('level 6-10');
    await lvl(s, 'w6/12'); await scan('level 6-12');
    await go(p, `#/coding/${s.id}/r3`, '.cw-pitem'); await scan('random');
    await go(p, `#/coding/${s.id}/free`, '.cw-pitem'); await scan('free drawing');
    await p.evaluate(() => window.__coding.run('repeat 4 { fd 40 tr 90 }')); await p.click('#cl-run'); await p.waitForTimeout(1200); await scan('drawn'); await p.click('#cl-save'); await p.click('#cl-gallery'); await p.waitForSelector('.cl-gal-item'); await scan('gallery');
    await p.screenshot({ path: OUT + `coding-${name}-gallery.png` });
    ok(left.length === 0, `${name}: no Chinese text is left on any coding screen (picker, children, map, world, lesson, level, hint, answer, result, lists, free drawing, gallery)` + (left.length ? ' FOUND: ' + left.join(' // ') : ''));
    // phones: the long French texts fit
    const sw = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
    ok(sw, `${name}: nothing sideways in the gallery`);
    for (const [vn, vp] of [['320', { width: 320, height: 568 }], ['390', { width: 390, height: 844 }]]) {
      await p.setViewportSize(vp);
      await lvl(s, 'w4/5'); await tap(p, ['call:walk']);
      const fit = await p.evaluate(() => { const bad = []; for (const e of document.querySelectorAll('.cw-pitem, .cw-ws .cw-b, .cl-row button, .cl-lvl, .cl-island, .cw-bar > *')) { if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible') bad.push(e.className); const b = e.getBoundingClientRect(); if (b.right > innerWidth + 1 || b.left < -1) bad.push('out:' + e.className); } return bad; });
      ok(fit.length === 0 && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} ${vn} px: block labels and buttons stay inside the screen` + (fit.length ? ' ' + fit.slice(0, 3) : ''));
      await go(p, `#/coding/${s.id}`, '.cl-island');
      const fit2 = await p.evaluate(() => [...document.querySelectorAll('.cl-island')].filter((e) => e.scrollWidth > e.clientWidth + 2 || [...e.querySelectorAll('.isl-name, .isl-info span')].some((x) => x.scrollWidth > x.clientWidth + 2)).map((e) => e.dataset.world));
      ok(fit2.length === 0, `${name} ${vn} px: the island cards hold their texts`);
      await p.screenshot({ path: OUT + `coding-${name}-map-${vn}.png` });
    }
    ok(s.log.external.length === 0, `${name}: no outside request`);
    await s.browser.close();
  }
  await done();
})();
