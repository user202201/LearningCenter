// 编程 phase 2 (worlds 7-10), the BLOCK EDITOR extension: the palette split in tabs (only where a level has two or more groups: the old levels are unchanged), event hats with an
// event list, values and conditions built from small blocks (operators, comparisons, and / or / not, list and number reporters, calls with several parameters), lists, functions that
// may call themselves, undo / redo, the size limit, dragging (mouse, and REAL touch events through the browser protocol at dpr 2 and 3), the reference answer as static blocks.
const { start, checks, addKid } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });

const LESSONS = ['stage', 'events', 'anim', 'random', 'broadcast', 'music', 'score', 'params2', 'return', 'recursion', 'base', 'fractal', 'list', 'each', 'agg', 'filter', 'nested', 'search', 'binary', 'sort', 'greedy', 'euclid', 'bfs', 'scale', 'seq', 'loop', 'nest', 'until', 'if', 'ifelse', 'while', 'func', 'param', 'var', 'arith', 'turtle', 'pen'];
const kidId = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('learn.local.kids.json')).kids[0].id);
const open = async (opts = {}) => {
  const t = await start(new Map(), { local: true, today: '2026-11-12', viewport: opts.viewport || { width: 820, height: 1180 }, ...opts });
  await addKid(t.page, 'Dory');
  t.id = await kidId(t.page);
  await t.page.evaluate((l) => localStorage.setItem('learn.coding.v1', JSON.stringify({ seen: l, speed: 'fast', drawings: {} })), LESSONS);
  return t;
};
const clearToasts = (page) => page.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((x) => x.remove()));
const go = async (page, id, lv) => {
  await clearToasts(page);
  await page.evaluate((i) => (location.hash = `#/coding/${i}`), id); await page.waitForSelector('.cl-island');
  await page.evaluate(([i, l]) => (location.hash = `#/coding/${i}/${l}`), [id, lv]); await page.waitForSelector('.cw .cw-pitem');
  await page.waitForTimeout(120);
};
const prog = (page) => page.evaluate(() => import('/src/coding-ast.ts').then((A) => A.toText(window.__coding.editor.program()).replace(/\n\s*/g, ' ').replace(/ \{ /g, ' { ').trim()));
const counter = (page) => page.textContent('#cw-count');
const pal = (page, kind) => page.locator(`.cw-pitem[data-pal="${kind}"]`);
const tab = (page, id) => page.locator(`.cw-tab[data-tab="${id}"]`);
const center = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, b }; };
const toastText = (page) => page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent).join('|'));
/** opens the picker of a control and chooses an item by its text */
const choose = async (page, ctl, text) => {
  await clearToasts(page);
  await ctl.click();
  const item = page.locator('.cw-pop .cw-pi', { hasText: new RegExp('^' + text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first();
  await item.click();
  await page.waitForTimeout(60);
};
const drag = async (page, from, x, y, steps = 8) => {
  await clearToasts(page);
  const c = await center(from);
  await page.mouse.move(c.x, c.y); await page.mouse.down();
  await page.mouse.move(c.x + 12, c.y - 12, { steps: 2 });
  await page.mouse.move(x, y, { steps });
  await page.mouse.up();
  await page.waitForTimeout(60);
};

(async () => {
  const t = await open();
  const page = t.page, id = t.id;
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));

  // ---------- the tabs of the palette ----------
  await go(page, id, 'w1/1');
  ok((await page.locator('#cw-tabs').evaluate((e) => e.hidden)) && (await page.locator('.cw-pitem').evaluateAll((l) => l.map((e) => e.dataset.pal).join())) === 'move,left,right', 'old levels are unchanged: no tabs, the same blocks');
  await go(page, id, 'w3/6');
  ok((await page.locator('#cw-tabs').evaluate((e) => e.hidden)) && (await page.locator('.cw-pitem').count()) === 7, 'level 3-6 (seven mixed blocks) has no tab bar either: only the new worlds split the palette');
  await go(page, id, 'w7/1');
  ok((await page.locator('#cw-tabs').evaluate((e) => e.hidden)) && (await page.locator('.cw-pitem').evaluateAll((l) => l.map((e) => e.dataset.pal).join())) === 'smove,sturn', 'a level whose blocks are all of one group (7-1: move, turn) shows them without tabs');
  await go(page, id, 'w7/13');
  ok(!(await page.locator('#cw-tabs').evaluate((e) => e.hidden)) && (await page.locator('.cw-tab').evaluateAll((l) => l.map((e) => e.dataset.tab + (e.classList.contains('on') ? '*' : '')).join())) === 'events*,vars', 'level 7-13 (say, change): two tabs, the first is open: ' + (await page.locator('.cw-tab').evaluateAll((l) => l.map((e) => e.dataset.tab).join())));
  ok((await page.locator('.cw-pitem').evaluateAll((l) => l.map((e) => e.dataset.pal).join())) === 'say', 'the open tab shows only its blocks');
  await tab(page, 'vars').click();
  ok((await page.locator('.cw-pitem').evaluateAll((l) => l.map((e) => e.dataset.pal).join())) === 'change' && (await tab(page, 'vars').getAttribute('aria-selected')) === 'true', 'another tab shows the other blocks');
  await go(page, id, 'w10/3');
  ok((await page.locator('.cw-tab').evaluateAll((l) => l.map((e) => e.dataset.tab).join())) === 'control,vars,lists', 'level 10-3 (sorting): control / variables / lists');
  await tab(page, 'lists').click(); await pal(page, 'swap').click();
  ok((await prog(page)) === 'swap(xs, 1, 2)', 'a block of another tab is added by a tap: ' + (await prog(page)));
  // a hint for a block in another tab opens that tab
  await tab(page, 'control').click();
  await page.evaluate(() => window.__coding.editor.hint({ needed: 'for', wrongId: null, extraId: null }));
  await tab(page, 'lists').click();
  await page.evaluate(() => window.__coding.editor.hint({ needed: 'for', wrongId: null, extraId: null }));
  ok((await tab(page, 'control').getAttribute('aria-selected')) === 'true' && (await pal(page, 'for').evaluate((e) => e.classList.contains('hint'))), 'the hint for a block in another tab opens that tab and lights the block');

  // ---------- event hats ----------
  await go(page, id, 'w7/5');
  ok((await page.locator('.cw-hat-ev').count()) === 2 && (await page.locator('.cw-hat-ev .cw-sprite').first().textContent()) === '小猫' && (await page.locator('.cw-script').count()) === 2, 'level 7-5 has two event scripts of the cat (the hats), no "start" script');
  ok((await page.locator('.cw-evsel').first().getAttribute('data-on')) === 'start', 'each hat starts with "when started"');
  await page.locator('.cw-evsel').first().click();
  ok((await page.locator('.cw-pop .cw-pi').evaluateAll((l) => l.map((e) => e.textContent).join('|'))) === '开始运行|按下 →|按下 ←', 'the hat offers the events of the level: ' + (await page.locator('.cw-pop .cw-pi').evaluateAll((l) => l.map((e) => e.textContent).join('|'))));
  await page.locator('.cw-pop .cw-pi', { hasText: '按下 →' }).click();
  await choose(page, page.locator('.cw-evsel').nth(1), '按下 ←');
  await page.locator('.cw-hat-ev').first().click();
  await pal(page, 'changex').click();
  ok((await prog(page)) === 'on key(right) cat { changex 10 } on key(left) cat { }', 'the chosen events are in the program, a tap adds the block to the first script: ' + (await prog(page)));
  await page.locator('.cw-hat-ev').nth(1).click();
  await pal(page, 'changex').click();
  ok((await prog(page)) === 'on key(right) cat { changex 10 } on key(left) cat { changex 10 }', 'a click on the second hat selects that script for the next block');
  await page.locator('.cw-ws .cw-script').first().locator('.cw-step[data-d="1"]').first().click();
  ok((await prog(page)).startsWith('on key(right) cat { changex 15 }'), 'the number of a block moves in steps of 5 (changex 10 -> 15)');
  await page.screenshot({ path: OUT + 'editor2-hats.png' });
  // the drag into a script
  await go(page, id, 'w7/1');
  const hatBox = await center(page.locator('.cw-ws .cw-root').first());
  await drag(page, pal(page, 'smove'), hatBox.x + 20, hatBox.y);
  ok((await prog(page)) === 'on start cat { smove 10 }', 'a mouse drag puts a block into the script of the hat');
  await pal(page, 'sturn').click(); await pal(page, 'sturn').click();
  ok((await counter(page)) === '3 / 3', 'the size limit counts the blocks of all scripts (7-1 allows 3)');
  await pal(page, 'sturn').click();
  ok(/最多/.test(await toastText(page)) && (await counter(page)) === '3 / 3', 'a fourth block is refused with a message');

  // ---------- values and conditions made of small blocks ----------
  await go(page, id, 'w8/2');
  ok((await page.locator('.cw-script').count()) === 1 && (await page.textContent('.cw-hat')).includes('double') && (await page.textContent('.cw-hat')).includes('(x)'), 'a function level shows only the function (the tests are fixed): "定义 double (x)"');
  await pal(page, 'return').click();
  ok((await prog(page)) === 'def double(x) { return 0 }', 'return is added to the function: ' + (await prog(page)));
  await page.locator('.cw-ws .cw-val').first().click();
  const items = await page.locator('.cw-pop .cw-pi').evaluateAll((l) => l.map((e) => e.textContent));
  ok(items.includes('x') && items.includes('□ + □') && items.includes('□ × □') && !items.includes('□ ÷ □') && items.includes('5'), 'the value list offers numbers, the parameter x and the operators of the level (+ − ×): ' + items.join(' '));
  await page.locator('.cw-pop .cw-pi', { hasText: '□ × □' }).click();
  ok((await prog(page)) === 'def double(x) { return 0 * 1 }', 'an operator wraps the value: ' + (await prog(page)));
  await choose(page, page.locator('.cw-ws .cw-ex .cw-val').first(), 'x');
  await choose(page, page.locator('.cw-ws .cw-ex .cw-val').nth(1), '2');
  ok((await prog(page)) === 'def double(x) { return x * 2 }', 'the parts are set one by one: ' + (await prog(page)));
  await page.screenshot({ path: OUT + 'editor2-expr.png' });
  await page.click('#cl-run');
  await page.waitForSelector('#cl-result:not([hidden])', { timeout: 8000 });
  ok(await page.evaluate(() => document.querySelector('#cl-result').dataset.stars === '3'), 'and the program made of those blocks wins (3 stars)');
  await page.click('#cl-again');
  await page.locator('.cw-ws .cw-ex-x:not(.cw-ex-w)').first().click();
  ok((await prog(page)) === 'def double(x) { return 0 }', 'the ✕ of a compound value puts a plain number back');
  // undo / redo bring the expression back
  await page.click('#cw-undo');
  ok((await prog(page)) === 'def double(x) { return x * 2 }', 'undo brings back the expression');
  await page.click('#cw-redo'); await page.click('#cw-undo'); await page.click('#cw-undo'); await page.click('#cw-undo');
  ok((await prog(page)) === 'def double(x) { return 0 * 1 }' || (await prog(page)) === 'def double(x) { return 0 }' || (await prog(page)) === 'def double(x) { }', 'undo goes back step by step: ' + (await prog(page)));

  // conditions
  await go(page, id, 'w8/4');
  ok((await page.locator('.cw-tab').evaluateAll((l) => l.map((e) => e.dataset.tab).join())) === 'control,funcs', 'level 8-4: control and function tabs');
  await tab(page, 'control').click(); await pal(page, 'if').click();
  ok((await prog(page)) === 'def bigger(a, b) { if 1 == 1 { } }', 'a new "if" starts with a comparison: ' + (await prog(page)));
  await choose(page, page.locator('.cw-ws .cw-ex .cw-val').first(), 'a');
  await choose(page, page.locator('.cw-ws .cw-ex .cw-val').nth(1), 'b');
  await choose(page, page.locator('.cw-ws .cw-ex-cmp > .cw-op'), '>');
  ok((await prog(page)) === 'def bigger(a, b) { if a > b { } }', 'a comparison is made by choosing both sides and the sign: ' + (await prog(page)));
  await page.locator('.cw-ws .cw-ex-w').first().click();
  const bool = await page.locator('.cw-pop .cw-pi').evaluateAll((l) => l.map((e) => e.textContent));
  ok(bool.includes('并且') && bool.includes('或者') && bool.includes('不是') && bool.includes('□ ≤ □'), 'the "..." of a condition offers and / or / not and the other signs: ' + bool.join(' '));
  await page.locator('.cw-pop .cw-pi', { hasText: '并且' }).click();
  ok((await prog(page)).startsWith('def bigger(a, b) { if a > b and ') && (await page.locator('.cw-ex-logic').count()) === 1, 'and: the old condition is the first part, a new comparison the second: ' + (await prog(page)));
  await page.locator('.cw-ws .cw-ex-logic > .cw-ex-cmp').nth(1).locator('> .cw-ex-xs .cw-ex-w').click();
  await page.locator('.cw-pop .cw-pi', { hasText: '不是' }).click();
  ok(/ and !\(/.test(await prog(page)), 'not wraps a part: ' + (await prog(page)));
  await tab(page, 'funcs').click(); await pal(page, 'return').click();
  await page.screenshot({ path: OUT + 'editor2-cond.png' });

  // the stage conditions: keys and touching
  await go(page, id, 'w7/14');
  ok((await page.locator('.cw-tab').evaluateAll((l) => l.map((e) => e.dataset.tab).join())) === 'motion,events,control,vars', 'level 7-14: motion / events / control / variables');
  await tab(page, 'control').click(); await pal(page, 'forever').click();
  const fev = await page.locator('.cw-ws .cw-inner').first();
  await drag(page, pal(page, 'if'), (await center(fev)).x + 10, (await center(fev)).y);
  ok((await prog(page)) === 'on start basket { forever { if keyDown(right) { } } }', 'a drag puts "if" into "forever"; the condition starts with a key of the level: ' + (await prog(page)));
  await page.locator('.cw-ws .cw-ex-rep .cw-name').first().click();
  ok((await page.locator('.cw-pop .cw-pi').evaluateAll((l) => l.map((e) => e.textContent).join('|'))) === '→|←|↑|↓|空格', 'the key list is the keys of the level');
  await page.locator('.cw-pop .cw-pi', { hasText: '←' }).click();
  await page.locator('.cw-ws .cw-ex-w').first().click();
  const kb = await page.locator('.cw-pop .cw-pi').evaluateAll((l) => l.map((e) => e.textContent));
  ok(kb.includes('碰到 苹果') && kb.includes('按住 →') && kb.includes('碰到 篮子'), 'touching and keys are offered as conditions: ' + kb.join(' '));
  await page.locator('.cw-pop .cw-pi', { hasText: '碰到 苹果' }).click();
  ok((await prog(page)) === 'on start basket { forever { if touching(apple) { } } }', 'touching(apple): ' + (await prog(page)));

  // ---------- lists ----------
  await go(page, id, 'w9/8');
  await tab(page, 'control').click(); await pal(page, 'each').click();
  ok((await prog(page)) === 'each x in xs { }', 'each: the loop variable and the first list: ' + (await prog(page)));
  await choose(page, page.locator('.cw-ws .cw-b[data-kind="each"] .cw-name').nth(1), 'evens');
  ok((await prog(page)) === 'each x in evens { }', 'the list of a block is chosen from the lists of the level');
  ok((await page.locator('.cw-pop').count()) === 0, 'the list closes after a choice');
  await tab(page, 'lists').click(); await pal(page, 'push').click();
  ok((await prog(page)) === 'each x in evens { } add(xs, 1)', 'add(list, value) is added at the end of the script: ' + (await prog(page)));
  await choose(page, page.locator('.cw-ws .cw-b[data-kind="push"] .cw-val').first(), 'x');
  const lit = await page.locator('.cw-ws .cw-b[data-kind="push"] .cw-val').first().click().then(() => page.locator('.cw-pop .cw-pi').evaluateAll((l) => l.map((e) => e.textContent)));
  ok(lit.includes('□ mod □') && lit.includes('□ ÷ □') && !lit.some((x) => /长度|编号/.test(x)), 'the operators of the level are offered (9-8 has + − × ÷ mod) and no reporters (it offers none): ' + lit.join(' '));
  await page.keyboard.press('Escape');
  await go(page, id, 'w10/10');
  await tab(page, 'control').click(); await pal(page, 'while').click();
  await page.locator('.cw-ws .cw-b[data-kind="while"] .cw-val').first().click();
  const rep = await page.locator('.cw-pop .cw-pi').evaluateAll((l) => l.map((e) => e.textContent));
  ok(rep.includes('长度(…)') && rep.includes('编号 □ 的值') && rep.includes('邻居(…)') && rep.includes('邻居数(…)'), 'value reporters of the graph level: length, item, neighbour, number of neighbours: ' + rep.join(' '));
  await page.keyboard.press('Escape');

  // ---------- functions: several parameters, calls of itself ----------
  await go(page, id, 'w8/12');
  await tab(page, 'funcs').click();
  const kb2 = pal(page, 'call:koch');
  ok((await kb2.locator('.cw-par').count()) === 2 && (await kb2.locator('.cw-par').allTextContents()).join() === 'n,len', 'a call of a function with two parameters shows both: n and len');
  await go(page, id, 'w8/6');
  ok((await page.locator('.cw-script').count()) === 2 && (await page.locator('.cw-pitem').evaluateAll((l) => l.map((e) => e.dataset.pal).join())).includes('call:hyp2'), 'level 8-6: two functions sq(n) and hyp2(a, b)');
  await pal(page, 'call:hyp2').click();
  ok(/不能调用/.test(await toastText(page)) && (await prog(page)) === 'def sq(n) { } def hyp2(a, b) { }', 'a function cannot call a later one (hyp2 inside sq): ' + (await toastText(page)));
  await pal(page, 'call:sq').click();
  ok(/不能调用/.test(await toastText(page)), 'nor itself, in a level that is not about recursion');
  await page.locator('.cw-ws .cw-hat[data-script="2"]').click();
  await pal(page, 'call:sq').click();
  ok((await prog(page)) === 'def sq(n) { } def hyp2(a, b) { sq(a) }', 'hyp2 may call sq: the argument starts as its own first parameter: ' + (await prog(page)));
  await go(page, id, 'w8/8');
  await tab(page, 'funcs').click(); await pal(page, 'call:total').click();
  ok((await prog(page)) === 'def total(n) { total(n) }' && !/不能调用/.test(await toastText(page)), 'a level about recursion lets a function call itself: ' + (await prog(page)));
  await go(page, id, 'w10/10');
  ok((await page.locator('.cw-ws .cw-script').count()) === 1 && (await page.locator('.cw-hat').textContent()).includes('开始'), 'an algorithm level has the main script "开始"');

  // ---------- locking while a program runs; the reference as static blocks ----------
  await go(page, id, 'w7/1');
  await pal(page, 'smove').click();
  await page.click('#cl-run');
  ok(await page.locator('.cw').evaluate((e) => e.classList.contains('locked')), 'the editor is locked while the program runs');
  await page.waitForSelector('#cl-result:not([hidden]), #cl-msg.bad', { timeout: 8000 });
  ok(!(await page.locator('.cw').evaluate((e) => e.classList.contains('locked'))), 'and unlocked when it has ended');
  const stat = await page.evaluate(async () => {
    const E = await import('/src/coding-editor.ts'), L = await import('/src/coding-levels.ts'), X = await import('/src/coding-levels2.ts');
    const l = L.levelById('w10-02'); const el = E.programEl(l.sol, { funcs: l.funcs, vars: l.vars, ed: X.edOpts(l) }); document.body.append(el);
    const r = { blocks: el.querySelectorAll('.cw-b').length, ex: el.querySelectorAll('.cw-ex').length, tab: [...el.querySelectorAll('button, [tabindex="0"]')].filter((x) => x.tabIndex >= 0 && x.tagName === 'BUTTON' && !x.disabled).length, text: el.textContent };
    el.remove(); return r;
  });
  ok(stat.blocks === 10 && stat.ex >= 8 && stat.tab === 0 && stat.text.includes('二分') === false, 'the reference answer of a level (10-2) is drawn as static blocks with their nested values (10 blocks), nothing can be edited: ' + stat.blocks + ' blocks, ' + stat.ex + ' value blocks');

  // ---------- targets on a phone ----------
  await t.browser.close();
  const ph = await open({ viewport: { width: 390, height: 844 } });
  await go(ph.page, ph.id, 'w7/14');
  const sizes = await ph.page.evaluate(() => ({
    tabs: [...document.querySelectorAll('.cw-tab')].map((e) => Math.round(e.getBoundingClientRect().height)),
    pal: [...document.querySelectorAll('.cw-pitem')].map((e) => Math.round(e.getBoundingClientRect().height)),
    over: document.documentElement.scrollWidth - innerWidth,
  }));
  ok(sizes.tabs.length === 4 && sizes.tabs.every((h) => h >= 40) && sizes.pal.every((h) => h >= 40) && sizes.over <= 0, 'phone (390 wide): tabs and palette blocks are at least 40 px high, nothing sideways: ' + JSON.stringify(sizes));
  await ph.page.locator('.cw-tab[data-tab="control"]').click(); await ph.page.locator('.cw-pitem[data-pal="forever"]').click(); await ph.page.locator('.cw-tab[data-tab="control"]').click(); await ph.page.locator('.cw-pitem[data-pal="if"]').click();
  const deep = await ph.page.evaluate(() => [...document.querySelectorAll('.cw-ws .cw-b, .cw-ws .cw-ctl, .cw-ws .cw-hat')].map((e) => Math.round(e.getBoundingClientRect().height)));
  ok(deep.length > 5, 'blocks are drawn in the workspace');
  await ph.page.screenshot({ path: OUT + 'editor2-phone.png' });
  await ph.browser.close();

  // ---------- REAL touch events (dpr 2 tablet, dpr 3 phone) ----------
  for (const [name, vp, dpr] of [['tablet', { width: 820, height: 1180 }, 2], ['phone', { width: 390, height: 844 }, 3]]) {
    const tt = await open({ touch: true, dpr, viewport: vp });
    const tp = tt.page; const cdp = await tt.ctx.newCDPSession(tp);
    const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const tap = async (loc) => { await clearToasts(tp); await loc.scrollIntoViewIfNeeded(); const c = await center(loc); await touch('touchStart', c.x, c.y); await touch('touchEnd', c.x, c.y); await tp.waitForTimeout(90); };
    const tdrag = async (from, x, y) => { await clearToasts(tp); await from.scrollIntoViewIfNeeded(); const c = await center(from); await touch('touchStart', c.x, c.y); for (let i = 1; i <= 10; i++) await touch('touchMove', c.x + ((x - c.x) * i) / 10, c.y + ((y - c.y) * i) / 10); await touch('touchEnd', x, y); await tp.waitForTimeout(90); };
    await go(tp, tt.id, 'w7/1');
    ok((await tp.evaluate(() => devicePixelRatio)) === dpr, `${name}: device pixel ratio ${dpr}`);
    const root = await center(tp.locator('.cw-ws .cw-root').first());
    await tdrag(pal(tp, 'smove'), root.x + 20, root.y);
    ok((await prog(tp)) === 'on start cat { smove 10 }', `REAL touch (${name}, dpr ${dpr}): a finger drags "move" into the script of a hat`);
    await tap(tp.locator('.cw-ws .cw-step[data-d="1"]').first());
    ok((await prog(tp)) === 'on start cat { smove 15 }', `REAL touch (${name}): the + of a stepper works with a finger`);
    await tap(tp.locator('.cw-ws .cw-val').first());
    await tap(tp.locator('.cw-pop .cw-pi', { hasText: /^50$/ }));
    ok((await prog(tp)) === 'on start cat { smove 50 }', `REAL touch (${name}): a finger opens the value list and chooses 50`);
    await go(tp, tt.id, 'w7/14');
    await tap(tab(tp, 'control')); await tap(pal(tp, 'forever'));
    ok((await prog(tp)) === 'on start basket { forever { } }', `REAL touch (${name}): a finger changes the tab and adds a block by a tap`);
    const inner = await center(tp.locator('.cw-ws .cw-inner').first());
    await tap(tab(tp, 'events'));
    await tdrag(pal(tp, 'broadcast'), inner.x + 10, inner.y);
    ok((await prog(tp)) === 'on start basket { forever { broadcast caught } }', `REAL touch (${name}): a finger drags a block into the inner slot of "forever"`);
    await tp.locator('.cw-ws .cw-b[data-kind="broadcast"]').scrollIntoViewIfNeeded(); await tp.locator('#cw-bin').scrollIntoViewIfNeeded(); await tp.waitForTimeout(100);
    const bin = await center(tp.locator('#cw-bin'));
    // (a finger on a control of the block, like the message button, does not start a drag: take hold of the block at its left edge)
    const bb = await tp.locator('.cw-ws .cw-b[data-kind="broadcast"]').boundingBox();
    await clearToasts(tp); await touch('touchStart', bb.x + 8, bb.y + bb.height / 2);
    for (let i = 1; i <= 10; i++) await touch('touchMove', bb.x + 8 + ((bin.x - bb.x - 8) * i) / 10, bb.y + bb.height / 2 + ((bin.y - bb.y - bb.height / 2) * i) / 10);
    await touch('touchEnd', bin.x, bin.y); await tp.waitForTimeout(90);
    ok((await prog(tp)) === 'on start basket { forever { } }', `REAL touch (${name}): dragging a block onto the bin deletes it`);
    await tp.screenshot({ path: OUT + `editor2-touch-${name}.png` });
    await tt.browser.close();
  }

  ok(errors.length === 0, 'no script errors' + (errors.length ? ': ' + errors[0] : ''));
  await done();
})();
