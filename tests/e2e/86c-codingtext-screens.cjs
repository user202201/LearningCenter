// 编程 text coding, the SCREENS: the new section on the world map (three worlds + workshop), a world's levels, levels played with the real buttons (run with an own input,
// wrong and right submits, the results panel with the first failing case, error messages with the line, hints, "show answer" after 3 failures, stars, progress saved and merged),
// call levels, bug levels, a blank level, a drawing level, an efficiency level and a rule level, the stepper with the variables window, reset, drafts, mini-lessons (blocks next to
// Python, runnable examples), the workshop (templates, 20 snippets at most, save / open / delete with a confirmation, block drawings -> Python), layout on 5 screens, EN / FR, no outside request.
const H = require('./harness.cjs');
const { start, checks, addKid } = H;
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const CJK = /[　-〿一-鿿＀-￯]/;
const ALL_LESSONS = ['print', 'bridge', 'arith', 'vars', 'strings', 'input', 'if', 'while', 'for', 'def', 'lists', 'dicts', 'nested', 'recursion', 'turtle', 'search', 'sort', 'random'];

const kidIds = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('learn.local.kids.json')).kids.map((k) => k.id));
const open = async (opts = {}) => {
  const t = await start(new Map(), { today: '2026-11-12', viewport: { width: 390, height: 844 }, local: true, ...opts });
  await addKid(t.page, 'Dory');
  t.id = (await kidIds(t.page))[0];
  await t.page.evaluate((s) => localStorage.setItem('learn.codingtext.v1', s), JSON.stringify({ seen: opts.lessons ? [] : ALL_LESSONS, drafts: {}, snippets: {}, ws: {} }));
  return t;
};
const go = async (page, hash, sel) => { await page.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((x) => x.remove())); await page.evaluate((h) => (location.hash = h), hash); await page.waitForSelector(sel); await page.waitForTimeout(150); };
const doc = (page, id) => page.evaluate((i) => { const s = localStorage.getItem('learn.local.coding/' + i + '.json'); return s ? JSON.parse(s) : null; }, id);
const chineseLeft = (page) => page.evaluate((src) => {
  const re = new RegExp(src), out = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode()); ) { const p = n.parentElement; if (!p || p.closest('.user, .user-title, script, style, textarea, svg, .tx-hl')) continue; if (re.test(n.nodeValue)) out.push(n.nodeValue.trim().slice(0, 30)); }
  for (const e of document.querySelectorAll('[title],[aria-label],[placeholder]')) { if (e.closest('.user, .user-title')) continue; for (const a of ['title', 'aria-label', 'placeholder']) { const v = e.getAttribute(a); if (v && re.test(v)) out.push(a + ':' + v.slice(0, 30)); } }
  return out;
}, CJK.source);
const submit = async (page, code) => { await page.fill('#tx-ta', code); await page.click('#tx-submit'); await page.waitForSelector('#tx-result:not([hidden])'); await page.waitForTimeout(120); };
const resultInfo = (page) => page.evaluate(() => ({ passed: document.querySelector('#tx-result').dataset.passed, stars: document.querySelector('#tx-result').dataset.stars, chips: [...document.querySelectorAll('#tx-chips .tx-chip')].map((c) => c.classList.contains('ok') ? 1 : 0).join(''), title: document.querySelector('.tx-res-title').textContent, caseText: document.querySelector('#tx-case')?.textContent || '' }));

(async () => {
  // ================= the map, the world, a level =================
  let t = await open();
  let page = t.page;
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await go(page, `#/coding/${t.id}`, '#tx-section');
  const sec = await page.evaluate(() => ({ cards: [...document.querySelectorAll('.tx-island')].map((e) => (e.dataset.world || 'ws') + ':' + (e.querySelector('.tx-isl-name')?.textContent || '')), stars: [...document.querySelectorAll('.tx-isl-stars')].map((e) => e.textContent).join('|'), islands: document.querySelectorAll('.cl-island').length, after: document.querySelector('#tx-section').previousElementSibling?.className }));
  ok(sec.cards.join() === '11:文字编程入门,12:函数与列表,13:算法与小项目,ws:代码工坊', 'the world map has a section with the worlds 11, 12, 13 and the workshop: ' + sec.cards.join());
  ok(sec.stars.startsWith('★ 0 / 45 · 0 / 15|★ 0 / 51 · 0 / 17|★ 0 / 48 · 0 / 16'), 'each world shows its stars and levels: ' + sec.stars);
  ok(sec.islands >= 7 && /cl-trail/.test(sec.after), 'the block worlds (islands) and the free drawing island are still there, the new section comes after them (' + sec.islands + ' islands)');
  await page.screenshot({ path: OUT + 'tx-map.png' });
  await page.locator('.tx-island[data-world="11"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: OUT + 'tx-map-section.png' });
  await page.click('.tx-island[data-world="11"]');
  await page.waitForSelector('.tx-lvl');
  ok(page.url().endsWith(`#/coding/${t.id}/w11`), 'a world card opens the levels of the world (#/coding/<kid>/w11)');
  const wp = await page.evaluate(() => ({ n: document.querySelectorAll('.tx-lvl').length, titles: [...document.querySelectorAll('.tx-lvl .lvl-title')].slice(0, 3).map((e) => e.textContent), tags: [...document.querySelectorAll('.tx-lvl .lvl-tag')].map((e) => e.textContent), cls: [...document.querySelectorAll('.tx-lvl')].map((e) => e.className.includes('boss') ? 'B' : e.className.includes('debug') ? 'D' : '.').join(''), head: document.querySelector('#tx-wstars').textContent, buttons: [...document.querySelectorAll('.cl-wtools button')].map((b) => b.id) }));
  ok(wp.n === 15 && wp.titles.join() === '第一行代码,三行诗,算一算' && wp.cls === '......D...D...B' && wp.head === '★ 0 / 45', `world 11 lists 15 levels in order (debug levels 7 and 11, a challenge at 15): ${wp.cls}`);
  ok(wp.buttons.join() === 'tx-world-lesson,tx-first-lesson', 'the world page has the lessons "先拼积木，再看代码" and the first lesson');
  await page.screenshot({ path: OUT + 'tx-world.png' });
  await go(page, `#/coding/${t.id}/w11/9`, '#tx-ta');
  const lv = await page.evaluate(() => ({ title: document.querySelector('#tx-title').textContent.trim(), st: document.querySelector('#tx-statement').textContent, exin: document.querySelector('#tx-ex-in').textContent, exout: document.querySelector('#tx-ex-out').textContent, statementUser: !!document.querySelector('#tx-statement.user'), btns: [...document.querySelectorAll('#tx-btns button')].map((b) => b.id), answerHidden: document.querySelector('#tx-answer').hidden, input: document.querySelector('#tx-input').value, code: document.querySelector('#tx-ta').value }));
  ok(lv.title === '11-9 成绩等级' && /90 分及以上/.test(lv.st) && lv.statementUser && lv.exin === '95' && lv.exout === '优秀', 'a level shows its number and title, the task (a content box), an example input and output: ' + lv.title);
  ok(lv.btns.join() === 'tx-run,tx-submit,tx-step,tx-hint,tx-answer,tx-reset' && lv.answerHidden && lv.input === '95' && lv.code.startsWith('score = int(input())'), 'buttons: run, submit, step, hint, (answer hidden), reset; the input box holds the example input; the starter code is in the editor');
  // run with an own input
  await page.fill('#tx-input', '82');
  await page.fill('#tx-ta', 'score = int(input())\nprint(score + 1)');
  await page.click('#tx-run');
  await page.waitForFunction(() => document.querySelector('#tx-out').textContent.trim() === '83');
  ok((await page.locator('#tx-result:not([hidden])').count()) === 0, '运行 runs with the own input (82 -> 83) and does not judge');
  // an error: message with the line and a hint
  await page.fill('#tx-ta', 'score = int(input())\nprint(scor)');
  await page.click('#tx-run');
  await page.waitForSelector('#tx-error:not([hidden])');
  const er = await page.evaluate(() => ({ kind: document.querySelector('.tx-err-kind').textContent, msg: document.querySelector('.tx-err-msg').textContent, hint: document.querySelector('.tx-err-hint').textContent, line: [...document.querySelectorAll('.tx-hl .tx-line')].findIndex((e) => e.classList.contains('tx-err')) + 1 }));
  ok(er.kind === '名字错误' && /第 2 行/.test(er.msg) && /score/.test(er.hint) && er.line === 2, 'an error shows its kind, the line, the did-you-mean hint and underlines the line: ' + JSON.stringify(er));
  // a wrong submit: the first failing case with input, expected and got
  await submit(page, 'score = int(input())\nif score >= 90:\n    print("优秀")\nelse:\n    print("x")');
  let ri = await resultInfo(page);
  ok(ri.passed === '0' && /^1{1}0+/.test(ri.chips) && /第 2 组测试没有通过/.test(ri.title) && ri.chips.length === 9, 'a wrong submit: one chip per case (9), the first is green, the first failing case is named: ' + ri.chips + ' ' + ri.title);
  ok(/输入/.test(ri.caseText) && /90/.test(ri.caseText) === false && /期望的输出/.test(ri.caseText) && /你的输出/.test(ri.caseText), 'the failing case shows the input, the expected and the own output');
  const detail = await page.evaluate(() => ({ input: document.querySelector('#tx-case .tx-pre')?.textContent, exp: document.querySelector('#tx-case .exp')?.textContent, got: document.querySelector('#tx-case .got')?.textContent }));
  ok(detail.input === '90' && detail.exp === '优秀' && detail.got === 'x', 'case 2: input 90, expected 优秀, got x: ' + JSON.stringify(detail));
  await page.screenshot({ path: OUT + 'tx-fail.png' });
  // hints one by one
  await page.click('#tx-hint');
  let hn = await page.evaluate(() => ({ n: document.querySelectorAll('#tx-hints p').length, head: document.querySelector('#tx-hints .tx-label').textContent, shown: !document.querySelector('#tx-hints').hidden }));
  ok(hn.n === 1 && hn.shown && /1 \/ 3/.test(hn.head), 'the first hint appears alone (1 / 3)');
  await page.click('#tx-hint'); await page.click('#tx-hint');
  hn = await page.evaluate(() => document.querySelectorAll('#tx-hints p').length);
  ok(hn === 3, 'two more presses show all three hints');
  // the answer after 3 failed submits
  ok(await page.locator('#tx-answer').isHidden(), 'the answer is not offered after one failed submit');
  await page.click('#tx-submit'); await page.waitForTimeout(100); await page.click('#tx-submit'); await page.waitForTimeout(100);
  ok(await page.locator('#tx-answer').isVisible(), 'after 3 failed submits 看答案 appears');
  await page.click('#tx-answer');
  await page.waitForSelector('#tx-answer-dlg');
  const refTxt = await page.textContent('#tx-ref');
  ok(/score >= 90/.test(refTxt) && (await page.locator('#tx-ref .tx-kw').count()) > 2, 'the reference answer is shown highlighted');
  await page.click('#tx-answer-use');
  await page.waitForSelector('#tx-answer-dlg', { state: 'detached' });
  ok((await page.inputValue('#tx-ta')) === 'score = int(input())\nif score >= 90:\n    print("优秀")\nelif score >= 75:\n    print("良好")\nelif score >= 60:\n    print("及格")\nelse:\n    print("不及格")', 'using the answer puts it in the editor');
  await page.click('#tx-submit'); await page.waitForSelector('#tx-result[data-stars]');
  ri = await resultInfo(page);
  ok(ri.passed === '1' && ri.stars === '1' && /^1+$/.test(ri.chips), 'the reference passes all cases but earns only 1 star after it was shown');
  await page.waitForFunction((i) => !!localStorage.getItem('learn.local.coding/' + i + '.json'), t.id);
  let d = await doc(page, t.id);
  ok(d.stars['t11-09'] === 1 && d.blocks['t11-09'] > 0, 'the result is saved in coding/<kid>.json: stars 1, size ' + d.blocks['t11-09'] + ' tokens');
  ok((await page.locator('#tx-next').count()) === 1, 'a solved level offers 下一关');
  // a fresh visit, correct at the first submit = 3 stars; a shorter / equal result never lowers the stars
  await go(page, `#/coding/${t.id}/w11`, '.tx-lvl');
  await go(page, `#/coding/${t.id}/w11/9`, '#tx-ta');
  await page.fill('#tx-ta', 'score = int(input())\nif score >= 90:\n    print("优秀")\nelif score >= 75:\n    print("良好")\nelif score >= 60:\n    print("及格")\nelse:\n    print("不及格")');
  await page.click('#tx-submit'); await page.waitForSelector('#tx-result[data-stars]');
  ri = await resultInfo(page);
  ok(ri.stars === '3', 'passing at the first submit with a short program = 3 stars');
  await page.waitForFunction((i) => JSON.parse(localStorage.getItem('learn.local.coding/' + i + '.json')).stars['t11-09'] === 3, t.id);
  await submit(page, 'score = int(input())\nprint("x")');
  await page.waitForTimeout(300);
  d = await doc(page, t.id);
  ok(d.stars['t11-09'] === 3, 'a later failed or weaker attempt never lowers the stars');
  await page.click('#tx-next');
  await page.waitForSelector('#tx-ta');
  ok(page.url().endsWith('/w11/10'), '下一关 opens the next level (11-10)');
  await go(page, `#/coding/${t.id}/w11`, '.tx-lvl');
  ok((await page.getAttribute('.tx-lvl[data-level="t11-09"]', 'data-stars')) === '3' && (await page.textContent('#tx-wstars')) === '★ 3 / 45', 'the world page shows the 3 stars and the total');

  // ================= other kinds of levels =================
  // fill in the blank: the message says so
  await go(page, `#/coding/${t.id}/w11/1`, '#tx-ta');
  await page.click('#tx-run');
  await page.waitForSelector('#tx-error:not([hidden])');
  ok(/___/.test(await page.textContent('#tx-error')) && /还有空白/.test(await page.textContent('.tx-err-kind')), 'a blank ___ is reported, not a mystery error');
  ok((await page.locator('.tx-hl .tx-blank').count()) >= 1, 'the blank is highlighted in the editor');
  await submit(page, 'print("你好，世界")');
  ok((await resultInfo(page)).passed === '1', '11-1: print("你好，世界") passes');
  // debug level: the starter fails, the fix passes
  await go(page, `#/coding/${t.id}/w11/7`, '#tx-ta');
  const starter = await page.inputValue('#tx-ta');
  await page.click('#tx-submit'); await page.waitForSelector('#tx-result:not([hidden])');
  ok((await resultInfo(page)).passed === '0' && /input\(\)/.test(starter), '11-7 (debug): the starter code is submitted and fails');
  await submit(page, 'a = int(input())\nb = int(input())\nprint(a + b)');
  ok((await resultInfo(page)).passed === '1', '11-7: the fix passes');
  // a call level: hidden test code is appended
  await go(page, `#/coding/${t.id}/w12/1`, '#tx-ta');
  const exCall = await page.textContent('#tx-example');
  ok(/print\(square\(5\)\)/.test(exCall) && /25/.test(exCall), '12-1: the example shows the test code print(square(5)) and its output 25');
  await submit(page, 'def square(n):\n    print(n * n)');
  ri = await resultInfo(page);
  ok(ri.passed === '0' && /测试代码/.test(ri.caseText) && /None/.test(await page.textContent('#tx-case')), '12-1: a function that prints but does not return fails and the failing test code is shown: ' + ri.caseText.slice(0, 80));
  await submit(page, 'def square(n):\n    return n * n');
  ok((await resultInfo(page)).passed === '1', '12-1: return n * n passes');
  // a rule level (recursion)
  await go(page, `#/coding/${t.id}/w12/12`, '#tx-ta');
  await submit(page, 'def factorial(n):\n    r = 1\n    for i in range(1, n + 1):\n        r *= i\n    return r');
  ri = await resultInfo(page);
  ok(ri.passed === '0' && /ri/.test('ri') && /调用它自己/.test(await page.textContent('.tx-rule')), '12-12: right numbers without recursion are refused with the rule');
  // an efficiency level
  await go(page, `#/coding/${t.id}/w13/2`, '#tx-ta');
  ok((await page.locator('.tx-kind.budget').count()) === 1, '13-2: a "限制步数" label');
  await submit(page, 'xs = [int(x) for x in input().split()]\nt = int(input())\nanswer = -1\nfor i in range(len(xs)):\n    if xs[i] == t:\n        answer = i\n        break\nprint(answer)');
  ri = await resultInfo(page);
  ok(ri.passed === '0' && /运行步数超过了限制/.test(ri.caseText) && /700/.test(ri.caseText), '13-2: a correct but slow program fails on the step limit and the limit (700) is named');
  // a drawing level
  await go(page, `#/coding/${t.id}/w12/13`, '#tx-ta');
  ok((await page.locator('#tx-canvas svg').count()) === 1 && (await page.locator('#tx-canvas path[stroke="#adb5bd"]').count()) === 1, '12-13: the drawing area shows the grey target');
  await page.fill('#tx-ta', 'import turtle\nfor i in range(3):\n    turtle.forward(80)\n    turtle.right(120)');
  await page.click('#tx-run');
  await page.waitForTimeout(100);
  ok((await page.locator('#tx-canvas path[stroke="#2d2230"]').count()) === 1, 'running draws the own picture over the target');
  await submit(page, 'import turtle\nfor i in range(3):\n    turtle.forward(80)\n    turtle.right(120)');
  ok((await resultInfo(page)).passed === '0' && (await page.locator('#tx-case .tx-canvas svg').count()) === 1, 'a wrong drawing fails and the case shows both pictures');
  await page.screenshot({ path: OUT + 'tx-draw-fail.png' });
  await submit(page, 'import turtle\nfor i in range(4):\n    turtle.forward(80)\n    turtle.right(90)');
  ok((await resultInfo(page)).passed === '1', 'the right square passes');
  // the stepper
  await go(page, `#/coding/${t.id}/w11/12`, '#tx-ta');
  await page.fill('#tx-input', '3');
  await page.fill('#tx-ta', 'n = int(input())\ntotal = 0\ni = 1\nwhile i <= n:\n    total += i\n    i += 1\nprint(total)');
  await page.click('#tx-step');
  await page.waitForSelector('#tx-stepbar:not([hidden])');
  const w0 = await page.evaluate(() => ({ info: document.querySelector('#tx-stepinfo').textContent, watch: document.querySelector('#tx-watch').textContent }));
  ok(/1 \//.test(w0.info) && /第 1 行/.test(w0.watch), 'stepping starts at the first line: ' + w0.info);
  for (let i = 0; i < 12; i++) await page.click('#tx-step-next');
  const w1 = await page.evaluate(() => ({ vars: [...document.querySelectorAll('#tx-watch .tx-vars tr')].map((r) => r.textContent).join('|'), line: document.querySelector('#tx-watch .tx-watch-line b').textContent, out: document.querySelector('#tx-out').textContent }));
  ok(/n3/.test(w1.vars) && /total\d/.test(w1.vars) && /i\d/.test(w1.vars), 'the variables window shows n, total and i with their current values: ' + w1.vars);
  await page.screenshot({ path: OUT + 'tx-step.png' });
  for (let i = 0; i < 40; i++) { if (await page.locator('#tx-step-next:disabled').count()) break; await page.click('#tx-step-next'); }
  ok((await page.textContent('#tx-out')).trim() === '6' && /total6/.test(await page.textContent('#tx-watch')), 'at the last step the output is 6 and total is 6');
  await page.click('#tx-step-prev');
  ok(/步骤/.test(await page.textContent('#tx-stepinfo')), 'the previous-step button goes back');
  await page.click('#tx-step-play'); await page.waitForTimeout(100); await page.click('#tx-step-play');
  await page.click('#tx-step-stop');
  ok(await page.locator('#tx-stepbar').isHidden(), 'stop leaves the stepper');
  // function frames in the watch window
  await page.fill('#tx-ta', 'def f(a):\n    b = a * 2\n    return b\nprint(f(4))');
  await page.click('#tx-step');
  await page.waitForSelector('#tx-stepbar:not([hidden])');
  for (let i = 0; i < 4; i++) await page.click('#tx-step-next');
  ok((await page.locator('#tx-watch .tx-scope').count()) === 2 && /a4/.test(await page.textContent('#tx-watch')), 'inside a function the window shows the global scope and the call with its parameter a = 4');
  await page.click('#tx-step-stop');
  // reset asks; drafts are kept
  await page.fill('#tx-ta', 'print("mine")');
  await page.reload(); await page.waitForSelector('#tx-ta');
  await page.waitForTimeout(150);
  ok((await page.inputValue('#tx-ta')) === 'print("mine")', 'the code is kept as a draft on this device (after a reload)');
  await page.click('#tx-reset');
  await page.waitForSelector('dialog');
  await page.click('dialog button:not(.danger)');   // cancel
  await page.waitForSelector('dialog', { state: 'detached' });
  ok((await page.inputValue('#tx-ta')) === 'print("mine")', 'cancelling the reset keeps the code (and says nothing)');
  await page.click('#tx-reset');
  await page.waitForSelector('dialog');
  await page.click('dialog button.danger');
  await page.waitForSelector('dialog', { state: 'detached' });
  ok((await page.inputValue('#tx-ta')).startsWith('n = int(input())') && !(await page.inputValue('#tx-ta')).includes('mine'), 'confirming the reset brings back the starter code');

  // ================= lessons =================
  await t.browser.close();
  t = await open({ lessons: true });
  page = t.page; page.on('pageerror', (e) => errors.push(e.message));
  await go(page, `#/coding/${t.id}/w11/1`, '#tx-lesson');
  const ls = await page.evaluate(() => ({ title: document.querySelector('#tx-lesson h2').textContent, text: document.querySelector('#tx-lesson-text').textContent, code: document.querySelector('#tx-lesson-ta').value }));
  ok(/print/.test(ls.title) && /print\(/.test(ls.code), 'the first level opens its mini-lesson once (print) with an example');
  await page.click('#tx-lesson-try');
  await page.waitForFunction(() => document.querySelector('#tx-lesson-out').textContent.includes('你好，世界'));
  ok(true, '试一试 runs the example in the lesson');
  await page.fill('#tx-lesson-ta', 'print("changed", 1 + 2)');
  await page.click('#tx-lesson-try');
  ok((await page.textContent('#tx-lesson-out')).trim() === 'changed 3', 'the example can be edited and run again');
  await page.click('#tx-lesson-next'); await page.click('#tx-lesson-next');
  ok((await page.textContent('#tx-lesson-text')).includes('出错') && true, 'the third step of the print lesson shows an error on purpose');
  await page.click('#tx-lesson-try');
  ok(/引号|没有结束/.test(await page.textContent('#tx-lesson-out')), 'the error in the lesson is explained in the console');
  await page.click('#tx-lesson-next');
  await page.waitForSelector('#tx-lesson', { state: 'detached' });
  ok(JSON.parse(await page.evaluate(() => localStorage.getItem('learn.codingtext.v1'))).seen.includes('print'), 'finishing remembers on this device that the lesson was seen');
  await go(page, `#/coding/${t.id}/w11/2`, '#tx-ta');
  ok((await page.locator('#tx-lesson').count()) === 0, 'a level without a new concept opens no lesson');
  await page.click('#tx-lesson-btn').catch(() => {});
  await go(page, `#/coding/${t.id}/w11`, '#tx-world-lesson');
  await page.click('#tx-world-lesson');
  await page.waitForSelector('#tx-lesson-blocks:not([hidden])');
  const br = await page.evaluate(() => ({ blocks: document.querySelectorAll('#tx-lesson-blocks .cw-block, #tx-lesson-blocks [class*=cw-]').length, code: document.querySelector('#tx-lesson-ta').value }));
  ok(br.blocks > 0 && /for i in range\(4\):/.test(br.code) && /turtle\.forward\(50\)/.test(br.code) && /setheading\(90\)/.test(br.code), 'the bridge lesson shows the block program and, beside it, the Python code the blocks stand for');
  await page.click('#tx-lesson-try');
  await page.waitForTimeout(100);
  ok((await page.locator('#tx-lesson-out').textContent()).includes('没有输出'), 'the converted code runs (it draws, no text)');
  await page.screenshot({ path: OUT + 'tx-lesson.png' });
  await page.click('#tx-lesson-close');

  // ================= the workshop =================
  await go(page, `#/coding/${t.id}/code`, '#tx-ta');
  ok((await page.locator('#tx-btns button').evaluateAll((b) => b.map((x) => x.id).join())) === 'tx-run,tx-step,tx-save,tx-templates,tx-mine,tx-import,tx-clear', 'the workshop has run, step, save, templates, my code, block works, clear');
  await page.fill('#tx-input', '6\n7');
  await page.click('#tx-templates');
  await page.waitForSelector('#tx-tpls');
  ok((await page.locator('.tx-tpl').count()) === 7, 'seven templates');
  await page.click('.tx-tpl[data-i="1"]');
  await page.waitForSelector('#tx-tpls', { state: 'detached' });
  await page.click('#tx-run');
  await page.waitForFunction(() => /42/.test(document.querySelector('#tx-out').textContent));
  ok(/6 \+ 7 = 13/.test(await page.textContent('#tx-out')), 'the template "输入和计算" runs with its own input (6 + 7 = 13)');
  await page.click('.tx-tpl', { trial: true }).catch(() => {});
  await page.click('#tx-templates'); await page.click('.tx-tpl[data-i="4"]');
  await page.click('#tx-run');
  await page.waitForTimeout(150);
  ok((await page.locator('#tx-canvas path').count()) >= 3, 'the flower template draws in the workshop (red lines on the canvas)');
  await page.screenshot({ path: OUT + 'tx-workshop-flower.png' });
  // save / open / delete
  await page.click('#tx-save');
  await page.waitForSelector('dialog input');
  await page.fill('dialog input', 'Flower');
  await page.click('dialog button.primary');
  await page.waitForSelector('dialog', { state: 'detached' });
  let sn = await page.evaluate(() => JSON.parse(localStorage.getItem('learn.codingtext.v1')).snippets);
  const kid = Object.keys(sn)[0];
  ok(sn[kid].length === 1 && sn[kid][0].name === 'Flower' && /import turtle/.test(sn[kid][0].code), 'save keeps the code under its name on this device');
  await page.click('#tx-clear'); await page.waitForSelector('dialog'); await page.click('dialog button.danger'); await page.waitForSelector('dialog', { state: 'detached' });
  ok((await page.inputValue('#tx-ta')) === '', 'clear (confirmed) empties the editor');
  await page.click('#tx-mine'); await page.waitForSelector('#tx-snips');
  ok((await page.locator('.tx-snip').count()) === 1 && /Flower/.test(await page.textContent('.tx-snip')), 'my code lists the saved snippet');
  await page.click('.tx-snip-open');
  await page.waitForSelector('#tx-snips', { state: 'detached' });
  ok(/import turtle/.test(await page.inputValue('#tx-ta')), 'opening a snippet puts its code in the editor');
  await page.click('#tx-mine'); await page.waitForSelector('#tx-snips');
  await page.click('.tx-snip-del');
  await page.waitForSelector('dialog.center >> text=删除后不能恢复。');
  await page.click('dialog.center:last-of-type button:not(.danger)');   // cancel
  await page.waitForTimeout(200);
  ok((await page.locator('.tx-snip').count()) === 1, 'cancelling the delete keeps the snippet');
  await page.click('.tx-snip-del'); await page.waitForSelector('dialog.center >> text=删除后不能恢复。'); await page.click('dialog.center:last-of-type button.danger');
  await page.waitForSelector('#tx-snips-empty');
  ok((await page.locator('.tx-snip').count()) === 0, 'confirming deletes it');
  await page.click('#tx-snips-close');
  // the 20-snippet limit
  await page.evaluate((k) => { const l = JSON.parse(localStorage.getItem('learn.codingtext.v1')); l.snippets[k] = Array.from({ length: 20 }, (_, i) => ({ id: 's' + i, name: 'n' + i, code: 'print(' + i + ')', input: '', date: '2026-11-12' })); localStorage.setItem('learn.codingtext.v1', JSON.stringify(l)); }, kid);
  await page.fill('#tx-ta', 'print(99)');
  await page.click('#tx-save');
  await page.waitForTimeout(250);
  ok((await page.locator('dialog').count()) === 0 && /最多保存 20 段代码/.test(await page.textContent('#toasts')), 'with 20 snippets a 21st is refused with a message (no dialog)');
  // block drawings -> Python
  await page.evaluate((k) => localStorage.setItem('learn.coding.v1', JSON.stringify({ seen: [], speed: 'fast', code: null, drawings: { [k]: [{ id: 'd1', date: '2026-11-10', prog: { main: [{ id: 'b1', t: 'repeat', n: { k: 'n', v: 3 }, body: [{ id: 'b2', t: 'fd', n: { k: 'n', v: 40 } }, { id: 'b3', t: 'tr', n: { k: 'n', v: 120 } }] }], funcs: [] } }] } })), kid);
  await page.click('#tx-import'); await page.waitForSelector('#tx-blocks-list');
  ok((await page.locator('.tx-block-item').count()) === 1, 'the block works of the creation canvas are listed');
  await page.click('.tx-block-item'); await page.waitForSelector('#tx-blocks-list', { state: 'detached' });
  const conv = await page.inputValue('#tx-ta');
  ok(/for i in range\(3\):/.test(conv) && /turtle\.forward\(40\)/.test(conv) && /turtle\.right\(120\)/.test(conv), 'a block drawing becomes Python code in the editor');
  await page.click('#tx-run'); await page.waitForTimeout(150);
  ok((await page.locator('#tx-canvas path').count()) >= 1, 'and the code draws the triangle');
  await page.screenshot({ path: OUT + 'tx-workshop.png' });
  await page.evaluate(() => (location.hash = '#/coding/x'));

  // ================= GitHub storage: progress is a normal file, merged by the larger star count =================
  await t.browser.close();
  const store = new Map();
  t = await start(store, { today: '2026-11-12', viewport: { width: 390, height: 844 } });
  page = t.page; page.on('pageerror', (e) => errors.push(e.message));
  await addKid(page, 'Dory');
  const gid = JSON.parse(store.get('kids.json')).kids[0].id;
  await page.evaluate((s) => localStorage.setItem('learn.codingtext.v1', s), JSON.stringify({ seen: ALL_LESSONS, drafts: {}, snippets: {}, ws: {} }));
  await go(page, `#/coding/${gid}/w11/1`, '#tx-ta');
  await submit(page, 'print("你好，世界")');
  await page.waitForFunction(() => !document.querySelector('#toasts .toast.working'));
  await page.waitForTimeout(400);
  const f1 = JSON.parse(store.get(`coding/${gid}.json`) || '{}');
  ok(f1.stars && f1.stars['t11-01'] >= 2 && f1.blocks['t11-01'] > 0, 'the progress is written to coding/<kid>.json in the data repository: ' + JSON.stringify(f1));
  // another device saved a better result and a result of another world meanwhile: both are kept
  const merged = await page.evaluate(async () => { const M = await import('/src/coding-model.ts'); return M.mergeCoding({ stars: { 't11-01': 3, 't12-01': 1 }, blocks: { 't11-01': 5, 't12-01': 9 }, challenges: 0 }, { stars: { 't11-01': 2, 't13-01': 2, w1: 3 }, blocks: { 't11-01': 7, 't13-01': 20 }, challenges: 2 }); });
  ok(merged.stars['t11-01'] === 3 && merged.blocks['t11-01'] === 5 && merged.stars['t12-01'] === 1 && merged.stars['t13-01'] === 2 && merged.stars.w1 === 3 && merged.challenges === 2, 'merging two devices keeps the larger stars, the shorter program and every other level: ' + JSON.stringify(merged.stars));
  store.set(`coding/${gid}.json`, JSON.stringify({ stars: { 't12-01': 3, 'w1-1': 2 }, blocks: { 't12-01': 6 }, challenges: 0 }));
  await go(page, `#/coding/${gid}/w11/2`, '#tx-ta');
  await submit(page, 'print("春眠不觉晓")\nprint("处处闻啼鸟")\nprint("夜来风雨声")');
  await page.waitForFunction(() => !document.querySelector('#toasts .toast.working'));
  await page.waitForTimeout(400);
  const f2 = JSON.parse(store.get(`coding/${gid}.json`));
  ok(f2.stars['t12-01'] === 3 && f2.stars['t11-02'] >= 2 && f2.stars['w1-1'] === 2, 'a result saved while another device had written the file: nothing of the other device is lost: ' + JSON.stringify(f2.stars));
  ok(t.log.external.length === 0, 'no request left the app (the interpreter, levels and lessons are inside): ' + t.log.external.join(', '));
  await t.browser.close();

  // ================= layout on 5 screens =================
  const sizes = [[390, 844], [320, 568], [820, 1180], [1180, 820], [844, 390]];
  t = await open();
  page = t.page; page.on('pageerror', (e) => errors.push(e.message));
  for (const [w, hh] of sizes) {
    await page.setViewportSize({ width: w, height: hh });
    const pages = [[`#/coding/${t.id}`, '#tx-section', 'map'], [`#/coding/${t.id}/w12`, '.tx-lvl', 'world'], [`#/coding/${t.id}/w13/9`, '#tx-ta', 'level'], [`#/coding/${t.id}/w12/13`, '#tx-ta', 'draw'], [`#/coding/${t.id}/code`, '#tx-ta', 'workshop']];
    for (const [hash, sel, name] of pages) {
      await go(page, hash, sel);
      await page.waitForTimeout(150);
      const m = await page.evaluate(() => {
        const main = document.querySelector('.tx-main, .tx-section, .cl-levels');
        const r = (main.closest('.tx-main') || main).getBoundingClientRect();
        const small = [...document.querySelectorAll('.tx-btns button, .tx-key, .tx-lvl, .tx-island')].filter((e) => e.offsetParent).map((e) => { const b = e.getBoundingClientRect(); return Math.min(b.width, b.height); });
        const ta = document.querySelector('#tx-ta')?.getBoundingClientRect();
        return { doc: document.documentElement.scrollWidth, win: innerWidth, l: r.left, rr: innerWidth - r.right, minTarget: small.length ? Math.min(...small) : 99, taH: ta ? ta.height : null, taW: ta ? ta.width : null };
      });
      ok(m.doc <= m.win, `${w}x${hh} ${name}: no sideways overflow (${m.doc} <= ${m.win})`);
      ok(Math.abs(m.l - m.rr) <= 2, `${w}x${hh} ${name}: content is centred (${Math.round(m.l)} / ${Math.round(m.rr)})`);
      ok(m.minTarget >= 40, `${w}x${hh} ${name}: buttons, keys and cards are at least 40 px (${Math.round(m.minTarget)})`);
      if (m.taH !== null) ok(m.taH >= 120 && m.taW >= 150, `${w}x${hh} ${name}: the code area is usable (${Math.round(m.taW)} x ${Math.round(m.taH)})`);
      if (name === 'level' || name === 'workshop' || name === 'map') await page.screenshot({ path: OUT + `tx-${name}-${w}x${hh}.png` });
    }
  }
  await t.browser.close();

  // ================= English / French =================
  for (const loc of ['en', 'fr']) {
    t = await open({ locale: loc });
    page = t.page; page.on('pageerror', (e) => errors.push(e.message));
    const left = [];
    for (const [hash, sel, name] of [[`#/coding/${t.id}`, '#tx-section', 'map'], [`#/coding/${t.id}/w11`, '.tx-lvl', 'world'], [`#/coding/${t.id}/w11/9`, '#tx-ta', 'level'], [`#/coding/${t.id}/w13/2`, '#tx-ta', 'efficiency'], [`#/coding/${t.id}/w12/13`, '#tx-ta', 'draw'], [`#/coding/${t.id}/code`, '#tx-ta', 'workshop']]) {
      await go(page, hash, sel);
      await page.waitForTimeout(250);
      for (const x of await chineseLeft(page)) left.push(`${name}: ${x}`);
      if (name === 'level') {
        await page.fill('#tx-ta', 'score = int(input())\nprint(scor)'); await page.click('#tx-run'); await page.waitForSelector('#tx-error:not([hidden])');
        await page.click('#tx-submit'); await page.waitForSelector('#tx-result:not([hidden])'); await page.click('#tx-hint'); await page.waitForTimeout(250);
        for (const x of await chineseLeft(page)) left.push(`level-result: ${x}`);
        await page.screenshot({ path: OUT + `tx-level-${loc}.png` });
        await page.click('#tx-step'); await page.waitForTimeout(200); await page.click('#tx-step-next');
        for (const x of await chineseLeft(page)) left.push(`stepper: ${x}`);
        await page.click('#tx-step-stop');
      }
      if (name === 'workshop') {
        for (const b of ['#tx-templates', '#tx-mine', '#tx-import']) { await page.click(b); await page.waitForSelector('dialog'); await page.waitForTimeout(150); for (const x of await chineseLeft(page)) left.push(`dialog ${b}: ${x}`); await page.keyboard.press('Escape'); await page.waitForSelector('dialog', { state: 'detached' }); }
      }
    }
    ok(left.length === 0, `${loc.toUpperCase()}: no Chinese left outside the content boxes on the map, world, level, result, stepper and workshop` + (left.length ? ': ' + [...new Set(left)].slice(0, 12).join(' | ') : ''));
    const en = await page.evaluate(() => ({ btn: [...document.querySelectorAll('#tx-btns button')].map((b) => b.textContent).join('|') }));
    console.log('# ' + loc + ' buttons: ' + en.btn);
    await t.browser.close();
  }
  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await done();
})().catch((e) => { console.error(e); process.exit(1); });
