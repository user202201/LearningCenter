// 编程 phase 2 (worlds 7-10), the SCREENS: the world map with ten worlds (readable on 5 screen sizes, scrolling down is fine, nothing sideways), the levels of the new worlds, a level of
// every kind played with the real buttons (stage: scripted run, wrong programs with their message, live play with a tap / the on-screen keys; data: the function tests, the call stack
// while stepping, bars, graph, balance scale; the efficiency message), the answer after three failures, the mini-lessons with their demos, the medal of a finished world, the free
// story stage (12 saved stories, deleting asks first), English and French with no Chinese left, layout of the new screens on 5 sizes, no outside request.
const H = require('./harness.cjs');
const { start, checks, addKid } = H;
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const CJK = /[　-〿一-鿿＀-￯]/;
const ALL = ['stage', 'events', 'anim', 'random', 'broadcast', 'music', 'score', 'params2', 'return', 'recursion', 'base', 'fractal', 'list', 'each', 'agg', 'filter', 'nested', 'search', 'binary', 'sort', 'greedy', 'euclid', 'bfs', 'scale', 'seq', 'loop', 'nest', 'until', 'if', 'ifelse', 'while', 'func', 'param', 'var', 'arith', 'turtle', 'pen'];
const kidIds = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('learn.local.kids.json')).kids.map((k) => k.id));
const open = async (opts = {}) => {
  const t = await start(new Map(), { local: true, today: '2026-11-12', viewport: { width: 390, height: 844 }, ...opts });
  await addKid(t.page, 'Dory');
  t.id = (await kidIds(t.page))[0];
  await t.page.evaluate((s) => localStorage.setItem('learn.coding.v1', s), JSON.stringify({ seen: opts.lessons ? [] : ALL, speed: 'fast', drawings: {} }));
  return t;
};
const clearToasts = (page) => page.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((x) => x.remove()));
const go = async (page, hash, sel) => { await clearToasts(page); await page.evaluate((h) => (location.hash = h), hash); await page.waitForSelector(sel); await page.waitForTimeout(150); };
const lvl = async (t, l) => { await go(t.page, `#/coding/${t.id}`, '.cl-island'); await go(t.page, `#/coding/${t.id}/${l}`, '.cw .cw-pitem'); };
const prog = (page) => page.evaluate(() => import('/src/coding-ast.ts').then((A) => A.toText(window.__coding.editor.program()).replace(/\n\s*/g, ' ')));
const doc = (page, id) => page.evaluate((i) => { const s = localStorage.getItem('learn.local.coding/' + i + '.json'); return s ? JSON.parse(s) : null; }, id);
const setProg = (page, src) => page.evaluate((s) => (window.__coding.set ?? window.__coding.run)(s), src);
const result = async (page) => { await page.waitForSelector('#cl-result:not([hidden]), #cl-msg.bad', { timeout: 15000 }); return page.evaluate(() => ({ won: !document.querySelector('#cl-result').hidden, stars: document.querySelector('#cl-result').dataset.stars, msg: document.querySelector('#cl-msg').textContent })); };
const chineseLeft = (page) => page.evaluate((src) => {
  const re = new RegExp(src), out = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode()); ) { const p = n.parentElement; if (!p || p.closest('.user, .user-title, script, style')) continue; if (re.test(n.nodeValue)) out.push(n.nodeValue.trim().slice(0, 30)); }
  for (const e of document.querySelectorAll('[title],[aria-label],[placeholder]')) { if (e.closest('.user, .user-title')) continue; for (const a of ['title', 'aria-label', 'placeholder']) { const v = e.getAttribute(a); if (v && re.test(v)) out.push(a + ':' + v.slice(0, 30)); } }
  return out;
}, CJK.source);
const center = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
/** a level solved with its reference solution: the buttons of the page do the rest */
const solve = async (page, id) => { const src = await page.evaluate((i) => import('/src/coding-levels.ts').then((L) => L.levelById(i).solution), id); await setProg(page, src); await page.click('#cl-run'); return result(page); };

(async () => {
  let t = await open();
  let page = t.page;
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));

  // ================= the map with ten worlds =================
  await go(page, `#/coding/${t.id}`, '.cl-island');
  const map = await page.evaluate(() => ({
    islands: [...document.querySelectorAll('.cl-island:not(.free)')].map((e) => e.dataset.world + ':' + e.querySelector('.isl-name').textContent), trophies: document.querySelectorAll('.cl-trophy').length, got: document.querySelectorAll('.cl-trophy.got').length,
    stars: [...document.querySelectorAll('.isl-stars')].map((e) => e.textContent), stage: !!document.querySelector('#cl-stage'), rec: [...document.querySelectorAll('.cl-island.rec')].map((e) => e.dataset.world),
  }));
  ok(map.islands.slice(0, 10).join() === '1:顺序,2:循环,3:条件,4:函数,5:变量和计数,6:画图,7:事件与故事,8:函数进阶与递归,9:列表与数据,10:算法' && map.trophies >= 10 && map.got === 0, 'the map has ten world islands in order and a medal for each (world 7: 事件与故事, 8: 函数进阶与递归, 9: 列表与数据, 10: 算法): ' + map.islands.slice(6, 10).join(' '));
  ok(map.stars.slice(6, 10).join() === '★ 0 / 42,★ 0 / 42,★ 0 / 42,★ 0 / 42' && map.stage && map.rec.join() === '1', 'each new island shows its stars (14 levels = 42), the story stage is next to the drawing island, world 1 still glows');
  await page.screenshot({ path: OUT + 'c2-map-390.png', fullPage: true });
  for (const [w, h] of [[390, 844], [320, 568], [820, 1180], [1180, 820], [844, 390]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(150);
    const m = await page.evaluate(() => { const n = document.querySelector('.cl-narrow').getBoundingClientRect(); const isl = [...document.querySelectorAll('.cl-island')].map((e) => e.getBoundingClientRect()); return { over: document.documentElement.scrollWidth - innerWidth, left: Math.round(n.left), right: Math.round(innerWidth - n.right), minH: Math.min(...isl.map((r) => r.height)), minW: Math.min(...isl.map((r) => r.width)), n: isl.length, names: [...document.querySelectorAll('.isl-name')].every((e) => e.scrollWidth <= e.clientWidth + 1 || getComputedStyle(e).whiteSpace !== 'nowrap') }; });
    ok(m.over <= 0 && Math.abs(m.left - m.right) <= 2 && m.minH >= 80 && m.minW >= Math.min(w - 40, 240) && m.n >= 11, `map ${w} x ${h}: ${m.n} islands, nothing sideways, equal space left and right (${m.left} / ${m.right}), every island at least 80 px high`);
  }
  await page.setViewportSize({ width: 390, height: 844 });

  // ================= the levels of the new worlds =================
  for (const [w, names] of [[7, '出发,说话,等一等,点一下,按键,走路动画,时钟,随机跳,两个朋友,小故事,音乐,宠物跟着点击,小测验,接苹果'], [8, '两个数字,返回数字,三个参数,较大的数,偶数吗,函数调用函数,自己调用自己,停止条件,阶乘,斐波那契数列,画一棵树,雪花曲线,三角形里的三角形,递归大挑战'], [9, '建立列表,第几项,有多长,求和,最大值,最小值,计数,筛选偶数,查找,地板上的数字,平均数,出现最多的数,购物清单,凑十游戏'], [10, '顺序查找,二分查找,选择排序,冒泡排序,插入排序,少换几次,贪心找零,最大公约数,质数吗,最短路线,沿着左墙走,天平找最重,天平排序,合并两个队伍']]) {
    await go(page, `#/coding/${t.id}/w${w}`, '.cl-lvl');
    const r = await page.evaluate(() => ({ n: document.querySelectorAll('.cl-lvl').length, titles: [...document.querySelectorAll('.lvl-title')].map((e) => e.textContent).join(), nums: [...document.querySelectorAll('.lvl-no')].map((e) => e.textContent).join(), boss: [...document.querySelectorAll('.cl-lvl.boss')].map((e) => e.dataset.level).join(), lesson: !!document.querySelector('#cl-world-lesson'), medal: !!document.querySelector('#cl-medal'), over: document.documentElement.scrollWidth - innerWidth }));
    ok(r.n === 14 && r.titles === names && r.nums === '1,2,3,4,5,6,7,8,9,10,11,12,13,14' && r.boss.includes(`w${w}-14`) && r.lesson && r.medal && r.over <= 0, `world ${w}: fourteen numbered levels with their titles, the last is a challenge, a lesson button and a medal${r.titles === names ? '' : ': ' + r.titles}`);
  }
  await page.screenshot({ path: OUT + 'c2-world10.png' });

  // ================= a stage level, played with the real buttons =================
  await lvl(t, 'w7/1');
  const s1 = await page.evaluate(() => ({ stage: !!document.querySelector('#sv-stage'), sprites: [...document.querySelectorAll('.sv-sprite')].map((e) => e.dataset.sprite + ':' + e.dataset.x), goal: document.querySelector('#cl-goal').textContent, time: document.querySelector('#sv-time').textContent, hat: document.querySelectorAll('.cw-hat-ev').length, over: document.documentElement.scrollWidth - innerWidth }));
  ok(s1.stage && s1.sprites.join() === 'cat:-80' && s1.goal.includes('100 步') && s1.hat === 1 && s1.over <= 0, 'level 7-1: the stage with the cat at x -80, the goal, one event script: ' + JSON.stringify(s1));
  await page.screenshot({ path: OUT + 'c2-stage-390.png' });
  await setProg(page, 'on start cat { smove 40 }');
  await page.click('#cl-run');
  let r = await result(page);
  ok(!r.won && r.msg.includes('第 1 秒：小猫的位置不对。') && (await page.locator('#cl-msg.bad').count()) === 1, 'a wrong program (40 steps) gets a message with the second and the sprite: ' + r.msg);
  ok(await page.evaluate(() => document.querySelector('.sv-sprite[data-sprite=cat]').dataset.x === '-40'), 'the stage shows what the program did (x -80 + 40 = -40)');
  await page.click('#cl-run'); await result(page); await page.click('#cl-run'); await result(page);
  await page.waitForTimeout(300);
  ok(await page.locator('#cl-answer').isVisible(), 'after three failed runs the answer button appears');
  await page.click('#cl-answer'); await page.waitForSelector('#cl-answer-dlg');
  ok((await page.locator('#cl-answer-dlg .cw-static .cw-hat').count()) === 1 && (await page.locator('#cl-answer-dlg .cw-static .cw-sprite').textContent()) === '小猫' && (await page.locator('#cl-answer-dlg .cw-b').count()) === 1, 'the answer is drawn as blocks with the event hat and the name of the sprite');
  await page.click('#cl-answer-use');
  ok((await prog(page)).includes('on start cat { smove 100 }'), 'the answer is put into the workspace: ' + (await prog(page)));
  await page.click('#cl-run'); r = await result(page);
  ok(r.won && r.stars === '1', 'a level solved after the answer gives one star');
  // a new try without the answer: 3 stars, saved
  await lvl(t, 'w7/1');
  await setProg(page, 'on start cat { repeat 5 { smove 20 } }');
  await page.click('#cl-run'); r = await result(page);
  ok(r.won && r.stars === '1', 'another program that gets there with twice the blocks of par gets 1 star');
  await lvl(t, 'w7/1');
  await setProg(page, 'on start cat { smove 100 }');
  await page.click('#cl-run'); r = await result(page);
  const d1 = await doc(page, t.id);
  ok(r.won && r.stars === '3' && d1.stars['w7-01'] === 3 && d1.blocks['w7-01'] === 1, 'the shortest program gives 3 stars; progress is saved as coding/<kid>.json (w7-01 -> 3 stars, 1 block)');
  ok((await page.locator('#cl-next').count()) === 1, 'there is a "next level" button');

  // live play: a tap, the on-screen keys
  await lvl(t, 'w7/4');
  await setProg(page, 'on tap cat { say meow }');
  await page.click('#cl-play');
  ok((await page.textContent('#cl-play')) === '停止试玩', 'the play button turns into "stop"');
  ok(await page.locator('.cw.locked').count() === 1, 'the editor is locked while playing');
  await page.waitForTimeout(150);
  ok(await page.locator('.sv-say').first().isHidden(), 'nothing is said before the tap');
  const cat = await center(page.locator('.sv-sprite[data-sprite=cat]'));
  await page.mouse.click(cat.x, cat.y);
  await page.waitForTimeout(350);
  ok(await page.locator('.sv-sprite[data-sprite=cat] .sv-say').isVisible() && (await page.textContent('.sv-sprite[data-sprite=cat] .sv-say')) === '喵！', 'a tap on the cat makes it say "喵！" (a speech bubble)');
  await page.click('#cl-play'); await page.waitForTimeout(100);
  ok(await page.locator('.cw.locked').count() === 0 && (await page.locator('.sv-sprite[data-sprite=cat] .sv-say').isHidden()), 'stopping puts the stage back to its start');
  await lvl(t, 'w7/5');
  ok((await page.locator('#sv-keys .sv-key').count()) === 5 && (await page.locator('#sv-keys .sv-key').first().evaluate((e) => e.getBoundingClientRect().height)) >= 40, 'the on-screen keys are there (left, right, up, down, space) and at least 40 px high');
  await setProg(page, 'on key(right) cat { changex 30 } on key(left) cat { changex -30 }');
  await page.click('#cl-play'); await page.waitForTimeout(120);
  const kb = await center(page.locator('.sv-key[data-key="right"]'));
  await page.mouse.move(kb.x, kb.y); await page.mouse.down(); await page.waitForTimeout(120); await page.mouse.up(); await page.waitForTimeout(200);
  ok((await page.locator('.sv-sprite[data-sprite=cat]').getAttribute('data-x')) === '-50', 'the on-screen "right" key moves the cat 30 steps (x -80 -> -50)');
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(150); await page.keyboard.up('ArrowLeft'); await page.waitForTimeout(150);
  ok((await page.locator('.sv-sprite[data-sprite=cat]').getAttribute('data-x')) === '-80', 'the keyboard arrow keys work too (left: back to -80)');
  await page.click('#cl-play');
  // the quiz, the catch game, the clock
  await lvl(t, 'w7/13');
  r = await solve(page, 'w7-13');
  ok(r.won && (await page.locator('.cs-vars .cs-var[data-name=score], .sv-vars .cs-var[data-name=score]').count()) === 1, 'the quiz (7-13) is won: the scripted taps give the score; the variable score is shown on the stage');
  await lvl(t, 'w7/14');
  r = await solve(page, 'w7-14');
  ok(r.won, 'the catch game (7-14) is won with its reference: ' + r.msg);
  await page.screenshot({ path: OUT + 'c2-catch.png' });
  await lvl(t, 'w7/7');
  r = await solve(page, 'w7-07');
  ok(r.won && (await page.locator('.sv-sprite[data-sprite=hand]').getAttribute('data-dir')) === '30', 'the clock (7-7): the second hand has turned 30 degrees (5 turns of 6 degrees) after 6 seconds');

  // ================= data levels =================
  await lvl(t, 'w8/9');
  const c0 = await page.evaluate(() => ({ tests: [...document.querySelectorAll('.dv-test code')].map((e) => e.textContent).join(), tabs: [...document.querySelectorAll('.cw-tab')].map((e) => e.dataset.tab).join(), hat: document.querySelector('.cw-hat').textContent, sk: document.querySelector('#sk').hidden }));
  ok(c0.tests === 'fact(3),fact(5),fact(1)' && c0.hat.includes('fact') && c0.sk, 'level 8-9: the three tests of fact are listed, the function is the only script, the call stack is hidden until a run starts: ' + JSON.stringify(c0));
  await setProg(page, 'def fact(n) { if n == 0 { return 1 } return n * fact(n - 1) }');
  await page.click('#cl-step');
  ok(await page.locator('#sk').isVisible() && (await page.textContent('#sk-depth')).includes('1'), 'step by step: the call stack appears; after the first step fact(3) is on it (depth 1)');
  let depth = 0, frames = '';
  for (let i = 0; i < 40; i++) { await page.click('#cl-step'); const d = Number((await page.textContent('#sk-depth b')) || 0); if (d > depth) { depth = d; frames = await page.locator('#sk .sk-frame code').allTextContents().then((l) => l.join(' > ')); } }
  ok(depth >= 4 && frames.startsWith('fact(0)') && frames.includes('fact(3)'), 'the stack grows one call per level (fact(3) > fact(2) > fact(1) > fact(0), newest on top): depth ' + depth + ' ' + frames);
  await page.click('#cl-stop');
  await page.click('#cl-run'); r = await result(page);
  ok(r.won && (await page.locator('.dv-test.ok').count()) === 3 && (await page.locator('.dv-got').allTextContents()).join() === '6,120,1', 'a run solves the level: the three tests turn green with 6, 120 and 1');
  await page.screenshot({ path: OUT + 'c2-calc.png' });
  await lvl(t, 'w8/9');
  await setProg(page, 'def fact(n) { return n }');
  await page.click('#cl-run'); r = await result(page);
  ok(!r.won && (await page.locator('.dv-test.bad').count()) >= 1 && (await page.locator('.dv-test.bad .dv-want').first().textContent()).includes('= 6'), 'a wrong function shows the wrong tests in red with the right answer: ' + r.msg);
  await lvl(t, 'w8/10');
  await setProg(page, 'def fib(n) { return fib(n - 1) + fib(n - 2) }');
  await page.click('#cl-run'); r = await result(page);
  ok(!r.won && /调用得太深/.test(r.msg), 'a recursion without a stop condition is stopped: ' + r.msg);
  await lvl(t, 'w9/5');
  const b0 = await page.evaluate(() => ({ bars: document.querySelectorAll('.dv-bar').length, vars: [...document.querySelectorAll('.dv-var')].map((e) => e.textContent).join(), goal: document.querySelector('.dv-want')?.textContent }));
  ok(b0.bars >= 5 && b0.bars <= 8 && /m = 0/.test(b0.vars) && /\(\d+\)/.test(b0.goal), 'level 9-5: the list as bars, the variable m with the value it must get as a target: ' + JSON.stringify(b0));
  r = await solve(page, 'w9-05');
  ok(r.won && (await page.locator('.dv-bar.mark, .dv-bar').count()) >= 5, 'the maximum level is solved');
  await page.screenshot({ path: OUT + 'c2-bars.png' });
  await lvl(t, 'w9/10');
  const fl = await page.evaluate(() => ({ nums: [...document.querySelectorAll('.cs-num')].map((e) => e.textContent).join(''), robot: !!document.querySelector('#cs-robot') }));
  ok(/^\d{3,6}$/.test(fl.nums) && fl.robot, 'level 9-10: the numbers lie on the floor tiles of the map: ' + fl.nums);
  r = await solve(page, 'w9-10');
  ok(r.won && (await page.locator('.cs-var.cs-list').count()) === 1 && (await page.textContent('.cs-var.cs-list')).includes('xs = ['), 'the robot collects them: the list xs is shown on the map and the level is won');
  await page.screenshot({ path: OUT + 'c2-floor.png' });
  await lvl(t, 'w10/10');
  const g0 = await page.evaluate(() => ({ nodes: document.querySelectorAll('.dv-node').length, known: document.querySelectorAll('.dv-node.known').length }));
  r = await solve(page, 'w10-10');
  const g1 = await page.evaluate(() => ({ known: document.querySelectorAll('.dv-node.known').length, labels: [...document.querySelectorAll('.dv-node text:first-of-type')].map((e) => e.textContent).join('') }));
  ok(g0.nodes === 7 && g0.known === 0 && r.won && g1.known === 7, 'level 10-10: a graph of 7 places; after the run every place shows its distance from place 1: ' + JSON.stringify([g0, g1]));
  await page.screenshot({ path: OUT + 'c2-graph.png' });
  await lvl(t, 'w10/12');
  const s0 = await page.locator('.dv-coin').count();
  r = await solve(page, 'w10-12');
  ok(s0 === 8 && r.won && (await page.textContent('#dv-weighs b')) === '7', 'level 10-12: eight coins; the balance scale counts 7 weighings');
  await lvl(t, 'w10/12');
  await setProg(page, 'set best = 1 for i = 1 to 8 { for j = 1 to 8 { if heavier(i, j) and heavier(i, best) { set best = i } } }');
  await page.click('#cl-run'); r = await result(page);
  ok(!r.won && /天平/.test(r.msg), 'too many weighings: ' + r.msg);
  await lvl(t, 'w10/2');
  ok((await page.locator('.dv-bars.many').count()) === 1 && (await page.locator('.dv-bar').count()) === 64, 'level 10-2: 64 sorted numbers as bars (the numbers on the bars are hidden when there are many)');
  await setProg(page, 'set pos = 0 set i = 1 while i <= len(xs) and pos == 0 { if item(xs, i) == t { set pos = i } change i by 1 }');
  await page.click('#cl-run'); r = await result(page);
  ok(!r.won && /步数/.test(r.msg), 'linear search is too slow for the step limit and says so: ' + r.msg);
  ok(((await page.textContent('#dv-steps')) || '').includes('步数'), 'the number of steps is shown');
  r = await solve(page, 'w10-02');
  ok(r.won, 'binary search is accepted');
  await lvl(t, 'w10/3');
  r = await solve(page, 'w10-03');
  ok(r.won && (await page.locator('#dv-swaps').count()) === 1, 'selection sort: the list is sorted, the number of swaps is shown');
  // old kinds of level with the new editor: turtle with two parameters, robot with recursion
  await lvl(t, 'w8/1');
  r = await solve(page, 'w8-01');
  ok(r.won && (await page.locator('.cs-turtle-wrap').count()) === 1, 'level 8-1 (a function with two parameters draws two rectangles) uses the turtle screen and is won');
  await lvl(t, 'w8/7');
  r = await solve(page, 'w8-07');
  ok(r.won, 'level 8-7 (the robot walks by calling itself) is won on the map of a family');
  await lvl(t, 'w8/12');
  r = await solve(page, 'w8-12');
  ok(r.won, 'the snowflake (recursion with two parameters and a loop) is won');
  await page.screenshot({ path: OUT + 'c2-koch.png' });
  await lvl(t, 'w8/13');
  r = await solve(page, 'w8-13');
  ok(r.won, 'the triangle in a triangle (three recursive calls) is won');
  ok(errors.length === 0, 'no script errors so far' + (errors.length ? ': ' + errors[0] : ''));

  // ================= the lessons =================
  await t.browser.close();
  t = await open({ lessons: true }); page = t.page; page.on('pageerror', (e) => errors.push(e.message));
  for (const [lv, kind, id] of [['w7/1', '.sv-stage', 'stage'], ['w8/2', '.dv', 'return'], ['w9/1', '.dv', 'list'], ['w10/2', '.dv-bars', 'binary'], ['w10/10', '.dv-graph', 'bfs'], ['w10/12', '.dv-coins', 'scale']]) {
    await go(page, `#/coding/${t.id}`, '.cl-island'); await page.evaluate(([i, l]) => (location.hash = `#/coding/${i}/${l}`), [t.id, lv]);
    // the first level that needs a lesson opens it by itself (the seen-list is empty)
    await page.waitForSelector('#cl-lesson');
    const l0 = await page.evaluate((k) => ({ title: document.querySelector('#cl-lesson h2').textContent, text: document.querySelector('#cl-lesson-text').textContent, demo: !!document.querySelector('#cl-demo ' + k), steps: document.querySelectorAll('.cl-dots i').length }), kind);
    ok(l0.title.length > 3 && l0.text.length > 5 && l0.steps >= 2 && l0.steps <= 4, `lesson "${id}" opens by itself on level ${lv}: "${l0.title}", ${l0.steps} steps`);
    await page.waitForTimeout(1600);
    const demo = await page.evaluate((k) => !!document.querySelector('#cl-demo ' + k), kind);
    ok(demo || id === 'stage', `the demo of "${id}" is drawn (${kind}) and runs by itself`);
    if (id === 'stage') ok(await page.locator('#cl-demo .sv-sprite').count() === 1 && (await page.locator('#cl-demo .sv-sprite').getAttribute('data-x')) !== '-70', 'the stage demo moves the cat by itself: ' + (await page.locator('#cl-demo .sv-sprite').getAttribute('data-x')));
    while ((await page.textContent('#cl-lesson-next')) !== '完成') await page.click('#cl-lesson-next');
    await page.click('#cl-lesson-next');
    await page.waitForSelector('#cl-lesson', { state: 'detached' });
  }
  await go(page, `#/coding/${t.id}/w9`, '.cl-lvl');
  await page.click('#cl-world-lesson'); await page.waitForSelector('#cl-lesson');
  ok((await page.textContent('#cl-lesson h2')).includes('列表'), 'the world page opens the lesson of the world');
  await page.click('#cl-lesson-close');
  ok(((await doc(page, t.id)) ?? {}) !== null, 'closing a lesson leaves the progress as it was');
  await page.evaluate((i) => (location.hash = `#/coding/${i}/w10/1`), t.id);
  await page.waitForSelector('#cl-lesson');
  await page.screenshot({ path: OUT + 'c2-lesson.png' });
  await page.click('#cl-lesson-close');
  await t.browser.close();

  // ================= the medal of a finished world =================
  for (const [w, last] of [[7, 'w7-14'], [10, 'w10-14']]) {
    const tm = await open(); const pm = tm.page; pm.on('pageerror', (e) => errors.push(e.message));
    await pm.evaluate(([id, wn]) => import('/src/coding-levels.ts').then((L) => { const stars = {}; for (const l of L.levelsOf(wn)) if (l.no < 14) stars[l.id] = 3; localStorage.setItem('learn.local.coding/' + id + '.json', JSON.stringify({ stars, blocks: {}, challenges: 0 })); }), [tm.id, w]);
    await lvl(tm, `w${w}/14`);
    r = await solve(pm, last);
    await pm.waitForSelector('#cl-medal-dlg', { timeout: 8000 });
    ok(r.won && (await pm.textContent('#cl-medal-dlg h2')).startsWith('获得徽章：') && (await pm.locator('#cl-medal-dlg svg').count()) === 1, `finishing the last level of world ${w} gives a medal dialog with the picture of the medal: ` + (await pm.textContent('#cl-medal-dlg h2')));
    await pm.screenshot({ path: OUT + `c2-medal-${w}.png` });
    await pm.click('#cl-medal-ok');
    await go(pm, `#/coding/${tm.id}`, '.cl-island');
    ok((await pm.locator(`.cl-trophy.got[data-world="${w}"]`).count()) === 1 && (await pm.locator(`.cl-island.done[data-world="${w}"]`).count()) === 1, `the medal of world ${w} is on the shelf and the island is marked as finished`);
    await tm.browser.close();
  }

  // ================= the free story stage =================
  t = await open(); page = t.page; page.on('pageerror', (e) => errors.push(e.message));
  await go(page, `#/coding/${t.id}`, '.cl-island');
  await page.click('#cl-stage'); await page.waitForSelector('.cw .cw-pitem');
  const f0 = await page.evaluate(() => ({ hats: document.querySelectorAll('.cw-hat-ev').length, tabs: [...document.querySelectorAll('.cw-tab')].map((e) => e.dataset.tab).join(), sprites: [...document.querySelectorAll('.sv-sprite')].map((e) => e.dataset.sprite).join(), run: !!document.querySelector('#cl-play') }));
  ok(f0.hats === 6 && f0.tabs === 'motion,events,control,vars' && f0.sprites === 'cat,dog,bird' && f0.run, 'the story stage: three characters, six event scripts, all the stage blocks in four tabs, a play button: ' + JSON.stringify(f0));
  await setProg(page, 'on start cat { say hi } on start dog { say bye }');
  await page.click('#cl-run'); await page.waitForTimeout(400);
  ok((await page.locator('.sv-sprite[data-sprite=cat] .sv-say').textContent()) === '你好！' && (await page.locator('#cl-result').isHidden()), 'a run shows the story (no judging, no stars)');
  for (let i = 0; i < 12; i++) { await clearToasts(page); await page.click('#cl-save'); }
  await clearToasts(page); await page.click('#cl-save');
  ok(/最多保存 12/.test(await page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent).join('|'))), 'the 13th story is refused with a message (12 at most)');
  await page.click('#cl-gallery'); await page.waitForSelector('#cl-gal');
  ok((await page.locator('.cl-gal-item').count()) === 12, 'the gallery lists 12 stories');
  await page.locator('.cl-gal-del').first().click(); await page.waitForSelector('dialog[open]:has-text("删除"), .dlg');
  await page.locator('button:has-text("取消")').first().click(); await page.waitForTimeout(200);
  ok((await page.locator('.cl-gal-item').count()) === 12, 'cancelling the confirmation deletes nothing');
  await page.locator('.cl-gal-del').first().click(); await page.waitForTimeout(150);
  await page.locator('button.danger:has-text("删除")').last().click(); await page.waitForTimeout(250);
  ok((await page.locator('.cl-gal-item').count()) === 11, 'confirming deletes one story (11 left)');
  await page.locator('.cl-gal-open').first().click(); await page.waitForTimeout(200);
  ok((await prog(page)).includes('on start cat { say hi }'), 'opening a story puts its blocks back in the workspace');
  await page.screenshot({ path: OUT + 'c2-story.png' });
  ok(errors.length === 0, 'no script errors' + (errors.length ? ': ' + errors[0] : ''));
  await t.browser.close();

  // ================= layout of the new screens on 5 sizes =================
  t = await open(); page = t.page; page.on('pageerror', (e) => errors.push(e.message));
  for (const [w, h] of [[390, 844], [320, 568], [820, 1180], [1180, 820], [844, 390]]) {
    await page.setViewportSize({ width: w, height: h });
    for (const lv of ['w7/13', 'w8/9', 'w10/10', 'w9/5']) {
      await lvl(t, lv);
      await page.waitForTimeout(100);
      const m = await page.evaluate(() => {
        const sc = document.querySelector('#cl-scene').getBoundingClientRect(), ed = document.querySelector('.cw').getBoundingClientRect(), pal = document.querySelector('.cw-pal').getBoundingClientRect();
        const wide = innerWidth >= 700;
        return { over: document.documentElement.scrollWidth - innerWidth, sceneW: Math.round(sc.width), sceneH: Math.round(sc.height), edW: Math.round(ed.width), edH: Math.round(ed.height), palH: Math.round(pal.height), left: Math.round(sc.left), right: Math.round(innerWidth - sc.right), wide, clipped: [...document.querySelectorAll('.cl-left, .cl-right, .dv, .sv-stage')].some((e) => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX === 'visible') };
      });
      ok(m.over <= 0 && m.sceneW >= 140 && m.sceneH >= 90 && m.edW >= 240 && m.edH >= 200 && !m.clipped, `${lv} on ${w} x ${h}: nothing sideways, scene ${m.sceneW} x ${m.sceneH}, workspace ${m.edW} x ${m.edH}${m.over > 0 ? ' (over by ' + m.over + ')' : ''}`);
      if (!m.wide) ok(Math.abs(m.left - m.right) <= 3, `${lv} on ${w}: the scene is centred (${m.left} / ${m.right})`);
    }
    await page.screenshot({ path: OUT + `c2-layout-${w}x${h}.png` });
  }
  await t.browser.close();

  // ================= English and French: nothing Chinese is left =================
  for (const [loc, name] of [['en-US', 'en'], ['fr-FR', 'fr']]) {
    const s = await open({ locale: loc }); const p = s.page; const left = [];
    p.on('pageerror', (e) => errors.push(e.message));
    const scan = async (what) => { const l = await chineseLeft(p); if (l.length) left.push(what + ': ' + l.slice(0, 5).join(' | ')); };
    await go(p, `#/coding/${s.id}`, '.cl-island'); await scan('map');
    const names = await p.evaluate(() => [...document.querySelectorAll('.isl-name')].slice(6, 10).map((e) => e.textContent).join(' / '));
    await go(p, `#/coding/${s.id}/w7`, '.cl-lvl'); await scan('world 7');
    for (const lv of ['w7/13', 'w7/5', 'w8/9', 'w9/10', 'w10/10', 'w10/12', 'w8/12']) {
      await lvl(s, lv); await scan(lv);
      if (lv === 'w7/13' || lv === 'w8/9') {
        await p.locator('.cw-tab').last().click().catch(() => {}); await scan(lv + ' tab');
        const first = p.locator('.cw-ws .cw-val, .cw-ws .cw-evsel, .cw-ws .cw-text').first();
        if (await first.count()) { await first.click().catch(() => {}); await scan(lv + ' popup'); await p.keyboard.press('Escape'); }
      }
    }
    await lvl(s, 'w7/5'); await p.evaluate(() => window.__coding.set('on key(right) cat { changex 30 }')); await p.click('#cl-run'); await p.waitForSelector('#cl-msg.bad, #cl-result:not([hidden])'); await scan('failed run');
    await lvl(s, 'w10/12'); await p.evaluate(() => window.__coding.set('set best = 1')); await p.click('#cl-run'); await p.waitForSelector('#cl-msg.bad, #cl-result:not([hidden])'); await scan('failed data run');
    await p.click('#cl-hint'); await scan('hint');
    await go(p, `#/coding/${s.id}/stage`, '.cw-pitem'); await scan('story stage');
    await p.evaluate(() => window.__coding.set('on start cat { say hi }')); await p.click('#cl-run'); await p.waitForTimeout(300); await scan('story run');
    const bubble = await p.locator('.sv-sprite[data-sprite=cat] .sv-say').textContent();
    ok(left.length === 0, `${name}: nothing Chinese is left on the new screens (map, world, 7 levels, popups, a failed run, hint, story stage)` + (left.length ? ': ' + left.join(' // ') : ''));
    ok(/[A-Za-z]/.test(names) && (name === 'en' ? /Events and stories/.test(names) : /Événements/.test(names)) && !CJK.test(bubble), `${name}: the island names and the speech bubble are in the language: ${names} / ${bubble}`);
    // the lessons
    for (const lv of ['w7/1', 'w10/10']) {
      await go(p, `#/coding/${s.id}`, '.cl-island'); await p.evaluate(([i, l]) => (location.hash = `#/coding/${i}/${l}`), [s.id, lv]);
    }
    await go(p, `#/coding/${s.id}/w7`, '.cl-lvl'); await p.click('#cl-world-lesson'); await p.waitForSelector('#cl-lesson'); await p.waitForTimeout(900); await scan('lesson'); await p.click('#cl-lesson-close');
    await p.screenshot({ path: OUT + `c2-${name}.png` });
    await s.browser.close();
  }

  ok(t.log.external.length === 0, 'no outside request: ' + t.log.external.join(', '));
  ok(errors.length === 0, 'no script errors' + (errors.length ? ': ' + errors[0] : ''));
  await done();
})();
