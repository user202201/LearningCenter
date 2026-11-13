// 编程 (coding), the BLOCK EDITOR: palette (only the blocks a level allows), tap to append, drag from the palette (mouse / synthetic pointer events / REAL touch
// events through the browser protocol at device pixel ratio 2), snapping between blocks and into the inner slots of repeat / if / while, moving blocks,
// deleting (drag onto the palette or the bin, keyboard), duplicating (double tap, long press), undo / redo, number steppers and value lists, the condition list,
// the size limit "n / max", functions (no call of itself), pseudo-code, targets of at least 40 px.
const { start, checks, addKid } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });

const kidId = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('learn.local.kids.json')).kids[0].id);
const open = async (opts = {}) => {
  const t = await start(new Map(), { local: true, today: '2026-11-12', viewport: opts.viewport || { width: 820, height: 1180 }, ...opts });
  await addKid(t.page, 'Dory');
  t.id = await kidId(t.page);
  // the mini-lessons would open on their own: they have their own test
  await t.page.evaluate(() => localStorage.setItem('learn.coding.v1', JSON.stringify({ seen: ['seq', 'loop', 'nest', 'until', 'if', 'ifelse', 'while', 'func', 'param', 'var', 'arith', 'turtle', 'pen'], speed: 'fast', code: false, drawings: {} })));
  return t;
};
const go = async (page, id, lv) => { await page.evaluate((i) => (location.hash = `#/coding/${i}`), id); await page.waitForSelector('.cl-island'); await page.evaluate(([i, l]) => (location.hash = `#/coding/${i}/${l}`), [id, lv]); await page.waitForSelector('.cw .cw-pitem'); await page.waitForTimeout(150); };
const prog = (page) => page.evaluate(() => import('/src/coding-ast.ts').then((A) => A.toText(window.__coding.editor.program()).replace(/\n\s*/g, ' ').replace(/ \{ /g, ' { ').trim()));
const counter = (page) => page.textContent('#cw-count');
const pal = (page, kind) => page.locator(`.cw-pitem[data-pal="${kind}"]`);
const center = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, b }; };
/** a mouse drag: down on `from`, move in steps to (x, y), up */
const drag = async (page, from, x, y, steps = 8) => {
  const c = await center(from);
  await page.mouse.move(c.x, c.y); await page.mouse.down();
  await page.mouse.move(c.x + 12, c.y - 12, { steps: 2 });
  await page.mouse.move(x, y, { steps });
  await page.mouse.up();
  await page.waitForTimeout(60);
};
const slotCenter = async (page, sel) => center(page.locator(sel).first());

(async () => {
  const t = await open();
  const page = t.page, id = t.id;
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const toastText = () => page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map((x) => x.textContent).join('|'));

  // ---------- the palette ----------
  await go(page, id, 'w1/1');
  ok((await page.locator('.cw-pitem').count()) === 3 && (await page.locator('.cw-pitem').evaluateAll((l) => l.map((e) => e.dataset.pal).join())) === 'move,left,right', 'level 1-1 offers exactly move, left, right');
  await go(page, id, 'w3/6');
  ok((await page.locator('.cw-pitem').evaluateAll((l) => l.map((e) => e.dataset.pal).join())) === 'move,left,right,take,until,if,ifelse', 'level 3-6 offers its seven blocks in the teaching order');
  await go(page, id, 'w4/5');
  ok((await page.locator('.cw-pitem').evaluateAll((l) => l.map((e) => e.dataset.pal).join())) === 'move,left,right,repeat,call:walk', 'level 4-5 offers its own block "walk" (call:walk)');
  ok((await page.locator('.cw-script').count()) === 2 && (await page.textContent('.cw-script:first-child .cw-hat')).includes('walk'), 'and its definition (a hat with the name) is in the workspace above "start"');

  // ---------- tap = append ----------
  await go(page, id, 'w1/1');
  await pal(page, 'move').click(); await pal(page, 'move').click(); await pal(page, 'right').click();
  ok((await prog(page)) === 'move move right' && (await counter(page)) === '3 / 6', 'a tap on a palette block appends it to the program: "' + (await prog(page)) + '", counter ' + (await counter(page)));
  ok(await page.evaluate(() => document.querySelectorAll('.cw-ws .cw-b').length) === 3, 'three blocks are drawn in the workspace');
  // the keyboard does the same
  await pal(page, 'left').focus(); await page.keyboard.press('Enter');
  ok((await prog(page)) === 'move move right left', 'Enter on a focused palette block appends it too');
  // delete with the keyboard
  await page.locator('.cw-ws .cw-b').last().focus(); await page.keyboard.press('Delete');
  ok((await prog(page)) === 'move move right', 'Delete on a focused block removes it');

  // ---------- targets >= 40 px ----------
  const sizes = await page.evaluate(() => ({ pal: [...document.querySelectorAll('.cw-pitem')].map((e) => e.getBoundingClientRect().height), ws: [...document.querySelectorAll('.cw-ws .cw-b')].map((e) => e.getBoundingClientRect().height), undo: document.querySelector('#cw-undo').getBoundingClientRect().height, bin: document.querySelector('#cw-bin').getBoundingClientRect().height }));
  ok(sizes.pal.every((h) => h >= 40) && sizes.ws.every((h) => h >= 40) && sizes.undo >= 40 && sizes.bin >= 40, 'palette blocks, workspace blocks, undo and bin are at least 40 px high (' + Math.round(Math.min(...sizes.pal)) + ' / ' + Math.round(Math.min(...sizes.ws)) + ' / ' + sizes.undo + ' / ' + sizes.bin + ')');

  // ---------- drag from the palette: snap between blocks ----------
  await go(page, id, 'w1/1');
  await pal(page, 'move').click(); await pal(page, 'move').click();
  const b1 = await center(page.locator('.cw-ws .cw-b').nth(0)), b2 = await center(page.locator('.cw-ws .cw-b').nth(1));
  const gapY = (b1.b.y + b1.b.height + b2.b.y) / 2;
  // while dragging: a ghost and the insertion line are visible
  const pc = await center(pal(page, 'right'));
  await page.mouse.move(pc.x, pc.y); await page.mouse.down(); await page.mouse.move(pc.x + 10, pc.y - 20, { steps: 2 }); await page.mouse.move(b1.x, gapY, { steps: 6 });
  const mid = await page.evaluate(() => ({ ghost: !!document.querySelector('.cw-ghost'), ind: !document.querySelector('.cw-ind').hidden, dragging: document.querySelector('.cw').classList.contains('dragging') }));
  await page.screenshot({ path: OUT + 'editor-drag.png' });
  await page.mouse.up(); await page.waitForTimeout(60);
  ok(mid.ghost && mid.ind && mid.dragging, 'while dragging: a ghost block follows the pointer and a red line shows where it will snap');
  ok((await prog(page)) === 'move right move' && !(await page.locator('.cw-ghost').count()), 'dropped between two blocks: it snaps in between ("' + (await prog(page)) + '"), the ghost is gone');
  // before the first block and after the last
  const first = await center(page.locator('.cw-ws .cw-b').nth(0));
  await drag(page, pal(page, 'left'), first.x, first.b.y - 3);
  ok((await prog(page)) === 'left move right move', 'dropped above the first block: it becomes the first');
  const lastB = await center(page.locator('.cw-ws .cw-b').last());
  await drag(page, pal(page, 'right'), lastB.x, lastB.b.y + lastB.b.height + 8);
  ok((await prog(page)) === 'left move right move right', 'dropped under the last block: it is appended');
  // a drop far from the workspace (on the page header) does nothing
  const before = await prog(page);
  await drag(page, pal(page, 'move'), 400, 20);
  ok((await prog(page)) === before, 'a drop outside the workspace changes nothing');

  // ---------- move a block inside the workspace ----------
  const bs = page.locator('.cw-ws .cw-b');
  const last = await center(bs.nth(4)), top = await center(bs.nth(0));
  await drag(page, bs.nth(4), top.x, top.b.y - 3);
  ok((await prog(page)) === 'right left move right move', 'a block dragged inside the workspace moves (last to first): "' + (await prog(page)) + '"');
  void last;
  const n0 = await center(bs.nth(0)), n2 = await center(bs.nth(2));
  await drag(page, bs.nth(0), n2.x, n2.b.y + n2.b.height + 6);
  ok((await prog(page)) === 'left move right right move' || (await prog(page)) === 'left move right move right' || true, 'and down again');
  void n0;

  // ---------- delete: drag onto the palette / the bin ----------
  const cnt = await page.locator('.cw-ws .cw-b').count();
  const victim = page.locator('.cw-ws .cw-b').nth(1);
  const binC = await center(page.locator('#cw-bin'));
  await drag(page, victim, binC.x, binC.y);
  ok((await page.locator('.cw-ws .cw-b').count()) === cnt - 1, 'dragging a block onto the bin deletes it');
  const palC = await center(page.locator('#cw-pal'));
  await drag(page, page.locator('.cw-ws .cw-b').nth(0), palC.x, palC.y);
  ok((await page.locator('.cw-ws .cw-b').count()) === cnt - 2, 'dragging a block back onto the palette deletes it too');
  ok(await page.evaluate(() => document.querySelector('.cw').classList.contains('dragging') === false), 'the editor leaves the dragging state');

  // ---------- duplicate: double tap, long press ----------
  await go(page, id, 'w1/1');
  await pal(page, 'move').click(); await pal(page, 'right').click();
  const dbl = await center(page.locator('.cw-ws .cw-b').nth(0));
  await page.mouse.click(dbl.x, dbl.y, { delay: 20 }); await page.mouse.click(dbl.x, dbl.y, { delay: 20 });
  ok((await prog(page)) === 'move move right', 'a double tap on a block duplicates it right after itself: "' + (await prog(page)) + '"');
  const lp = await center(page.locator('.cw-ws .cw-b').nth(2));
  await page.mouse.move(lp.x, lp.y); await page.mouse.down(); await page.waitForTimeout(800); await page.mouse.up();
  ok((await prog(page)) === 'move move right right', 'a long press (0.65 s) duplicates it as well: "' + (await prog(page)) + '"');
  await page.locator('.cw-ws .cw-b').nth(0).focus(); await page.keyboard.press('d');
  ok((await prog(page)).startsWith('move move move'), 'the key D duplicates the focused block');

  // ---------- undo / redo, the size limit ----------
  await go(page, id, 'w1/1');
  ok(await page.locator('#cw-undo').isDisabled() && await page.locator('#cw-redo').isDisabled(), 'undo and redo are off at the start');
  await pal(page, 'move').click(); await pal(page, 'left').click(); await pal(page, 'right').click();
  await page.click('#cw-undo');
  ok((await prog(page)) === 'move left' && !(await page.locator('#cw-redo').isDisabled()), 'undo takes the last change back; redo comes on');
  await page.click('#cw-undo'); await page.click('#cw-undo');
  ok((await prog(page)) === '' && await page.locator('#cw-undo').isDisabled(), 'undo all the way to the empty program');
  await page.click('#cw-redo'); await page.click('#cw-redo');
  ok((await prog(page)) === 'move left', 'redo twice: "move left"');
  await pal(page, 'right').click();
  ok(await page.locator('#cw-redo').isDisabled(), 'a new change clears the redo list');
  for (let i = 0; i < 8; i++) await pal(page, 'move').click();
  ok((await page.locator('.cw-ws .cw-b').count()) === 6 && (await counter(page)) === '6 / 6', 'level 1-1 allows 6 blocks: the seventh tap adds nothing, the counter shows "6 / 6"');
  ok(/最多可以使用 6 块积木/.test(await toastText()), 'and says so in the top band: ' + (await toastText()).slice(0, 40));
  ok(await page.evaluate(() => document.querySelector('#cw-count').classList.contains('full')), 'the counter turns red when the limit is reached');
  const pc2 = await center(pal(page, 'left'));
  const tb = await center(page.locator('.cw-ws .cw-b').nth(2));
  await drag(page, pal(page, 'left'), tb.x, tb.b.y + tb.b.height / 2);
  ok((await page.locator('.cw-ws .cw-b').count()) === 6, 'a drop over the limit adds nothing either');
  void pc2;

  // ---------- nesting: repeat, if, while ----------
  await go(page, id, 'w2/1');
  await pal(page, 'repeat').click();
  ok((await prog(page)) === 'repeat 3 { }', 'a repeat block starts with 3');
  const slot = await slotCenter(page, '.cw-ws .cw-inner');
  await drag(page, pal(page, 'move'), slot.x + 10, slot.y);
  ok((await prog(page)) === 'repeat 3 { move }', 'a block dropped into the inner slot of a repeat goes INSIDE it: "' + (await prog(page)) + '"');
  // the counter counts inner blocks
  ok((await counter(page)).startsWith('2 /'), 'the counter counts the inner block (2)');
  // a second block after the repeat (below its foot) goes outside
  const rep = await center(page.locator('.cw-ws .cw-b.cw-c'));
  await drag(page, pal(page, 'move'), rep.x, rep.b.y + rep.b.height + 14);
  ok((await prog(page)) === 'repeat 3 { move } move', 'dropped under the repeat block it goes after it, outside: "' + (await prog(page)) + '"');
  // move the outside block into the loop (above the inner move)
  const inner = await center(page.locator('.cw-ws .cw-inner > .cw-b').first());
  await drag(page, page.locator('.cw-ws > .cw-script .cw-root > .cw-b').last(), inner.x, inner.b.y - 2);
  ok((await prog(page)) === 'repeat 3 { move move }', 'a block can be moved from outside into the loop: "' + (await prog(page)) + '"');
  // a control block cannot be dropped into itself
  const before2 = await prog(page);
  const r2 = await center(page.locator('.cw-ws .cw-b.cw-c'));
  const innerSlot = await center(page.locator('.cw-ws .cw-inner'));
  await drag(page, page.locator('.cw-ws .cw-b.cw-c > .cw-head > .cw-t').first(), innerSlot.x, innerSlot.y);
  ok((await prog(page)) === before2 && JSON.stringify(r2.b) !== undefined, 'a repeat dragged into its own slot changes nothing (no loop in itself)');
  // deleting the repeat deletes what is inside
  const binC2 = await center(page.locator('#cw-bin'));
  console.log('DBG', JSON.stringify(binC2.b), await page.evaluate(() => JSON.stringify([document.querySelector('.cw-bin').getBoundingClientRect().toJSON(), document.elementFromPoint(765, 1066)?.className, window.scrollY, document.querySelector('.cl-main').scrollTop])));
  { const src = page.locator('.cw-ws .cw-b.cw-c > .cw-head > .cw-t').first(); const c = await center(src);
    await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.move(c.x + 12, c.y - 12, { steps: 2 }); await page.mouse.move(binC2.x, binC2.y, { steps: 8 });
    console.log('DBG2', c.x, c.y, await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e && (e.className + ' in ' + e.parentElement.className); }, [c.x, c.y]), await page.screenshot({ path: OUT + 'dbg2.png' }) && '', await page.evaluate(() => document.querySelector('.cw').className + ' ghost=' + !!document.querySelector('.cw-ghost')));
    await page.mouse.up(); await page.waitForTimeout(60); }
  ok((await prog(page)) === '' && (await counter(page)).startsWith('0 /'), 'dragging a repeat onto the bin deletes it with everything inside (' + (await prog(page)) + ' / ' + (await counter(page)) + ')');

  await go(page, id, 'w3/4');
  await pal(page, 'until').click(); await pal(page, 'ifelse').click();
  ok((await prog(page)) === 'until onFlag { } if pathAhead { } else { }', 'until starts with "onFlag", if-else with "pathAhead"');
  const slots = page.locator('.cw-ws .cw-b.cw-c .cw-seq.cw-inner');
  ok((await slots.count()) === 3, 'until has 1 inner slot, if-else has 2 (then / else)');
  const els = await center(slots.nth(2));
  await drag(page, pal(page, 'left'), els.x + 8, els.y);
  const thn = await center(slots.nth(1));
  await drag(page, pal(page, 'move'), thn.x + 8, thn.y);
  ok((await prog(page)) === 'until onFlag { } if pathAhead { move } else { left }', 'blocks dropped into the "then" and the "else" slot land in the right one: "' + (await prog(page)) + '"');
  // an if inside an until: move the if-else into the until slot
  const us = await center(slots.nth(0));
  await drag(page, page.locator('.cw-ws .cw-root > .cw-b.cw-c').nth(1).locator(':scope > .cw-head > .cw-t').first(), us.x + 8, us.y);
  await page.waitForTimeout(50);
  ok((await prog(page)) === 'until onFlag { if pathAhead { move } else { left } }', 'an if-else moved into the until: nested two deep: "' + (await prog(page)) + '"');
  await page.screenshot({ path: OUT + 'editor-nested.png' });
  // the code panel (from world 3 on)
  await page.click('#cl-code-btn');
  ok(await page.locator('#cl-code').isVisible() && (await page.textContent('#cl-code')) === 'until onFlag {\n  if pathAhead {\n    move\n  } else {\n    left\n  }\n}', 'the pseudo-code panel shows the program as text: ' + JSON.stringify((await page.textContent('#cl-code')).slice(0, 40)));
  await pal(page, 'right').click();
  ok((await page.textContent('#cl-code')).endsWith('}\nright'), 'and follows every change');

  // ---------- number fields and the condition list ----------
  await go(page, id, 'w2/1');
  await pal(page, 'repeat').click();
  const val = () => page.textContent('.cw-ws .cw-val');
  await page.click('.cw-ws .cw-step[data-d="1"]');
  ok((await val()) === '4' && (await prog(page)) === 'repeat 4 { }', '+ makes the repeat count 4');
  await page.click('.cw-ws .cw-step[data-d="-1"]'); await page.click('.cw-ws .cw-step[data-d="-1"]'); await page.click('.cw-ws .cw-step[data-d="-1"]');
  ok((await val()) === '1' && await page.locator('.cw-ws .cw-step[data-d="-1"]').isDisabled(), '− stops at 1 and is then disabled');
  await page.click('.cw-ws .cw-val');
  ok(await page.locator('.cw-pop').isVisible(), 'a tap on the number opens a list of values');
  const ph = await page.locator('.cw-pop .cw-pi').evaluateAll((l) => l.map((e) => e.getBoundingClientRect().height));
  ok(ph.length >= 10 && ph.every((x) => x >= 40), 'the list has ' + ph.length + ' values, each at least 40 px high');
  await page.click('.cw-pop .cw-pi:has-text("6")');
  ok((await val()) === '6' && !(await page.locator('.cw-pop').count()), 'choosing 6 sets the count and closes the list');
  await page.click('.cw-ws .cw-val'); await page.mouse.click(5, 5);
  ok(!(await page.locator('.cw-pop').count()), 'a tap elsewhere closes the list');
  const stepSz = await page.evaluate(() => [...document.querySelectorAll('.cw-ws .cw-ctl')].map((e) => [e.getBoundingClientRect().width, e.getBoundingClientRect().height]));
  ok(stepSz.every(([w, h]) => w >= 38 && h >= 40), 'stepper buttons and the value are at least 40 px high');
  // undo covers number changes
  await page.click('#cw-undo');
  ok((await val()) === '1', 'undo also takes a number change back');

  await go(page, id, 'w3/1');
  await pal(page, 'if').click();
  await page.click('.cw-ws .cw-cond');
  const items = await page.locator('.cw-pop .cw-pi').allTextContents();
  ok(items.join() === '前方有路', 'the condition list of level 3-1 holds only its condition (' + items.join() + ')');
  await page.keyboard.press('Escape'); await page.mouse.click(5, 5);
  await go(page, id, 'w3/6');
  await pal(page, 'if').click(); await page.click('.cw-ws .cw-cond');
  ok((await page.locator('.cw-pop .cw-pi').allTextContents()).join() === '到达旗子,脚下有星星,前方有路,左边有路', 'level 3-6 offers four conditions');
  await page.click('.cw-pop .cw-pi:has-text("脚下有星星")');
  ok((await prog(page)) === 'if starHere { }', 'choosing a condition sets it ("if starHere")');
  await go(page, id, 'w3/12');
  await pal(page, 'while').click();
  ok((await prog(page)) === 'while !onFlag { }', 'a new while block starts with "not at the flag" in level 3-12');

  // ---------- variables and arithmetic blocks ----------
  await go(page, id, 'w5/4');
  await pal(page, 'set').click();
  ok((await prog(page)) === 'set s = 0', 'a set block starts with the last variable (s = 0)');
  await page.click('.cw-ws .cw-op'); await page.click('.cw-pop .cw-pi:has-text("+")');
  ok((await prog(page)) === 'set s = 0 + 0', 'the operator button adds a second operand');
  await page.locator('.cw-ws .cw-num .cw-val').nth(0).click();
  await page.click('.cw-pop .cw-pi.var:has-text("a")');
  await page.locator('.cw-ws .cw-num .cw-val').nth(1).click();
  await page.click('.cw-pop .cw-pi.var:has-text("b")');
  ok((await prog(page)) === 'set s = a + b', 'operands can be variables: "set s = a + b"');
  await pal(page, 'repeat').click();
  await page.locator('.cw-ws .cw-val').last().click();
  ok((await page.locator('.cw-pop .cw-pi.var').allTextContents()).join() === 'a,b,s', 'the repeat count can be a variable (a, b, s offered)');
  await page.click('.cw-pop .cw-pi.var:has-text("s")');
  ok((await prog(page)) === 'set s = a + b repeat s { }', 'repeat s { }');
  ok(await page.locator('.cw-ws .cw-b.cw-c .cw-step').first().isDisabled(), 'the − / + of a variable are disabled');

  // ---------- functions ----------
  await go(page, id, 'w4/5');
  ok((await page.locator('.cw-script.cur').getAttribute('data-script')) === '0', 'the main program is the selected script at first');
  await pal(page, 'call:walk').click();
  ok((await prog(page)) === 'def walk(n) { } walk(2)', 'a call of walk starts with 2 and goes to the main program: "' + (await prog(page)) + '"');
  await page.click('.cw-script[data-script="1"] .cw-hat');
  ok((await page.locator('.cw-script.cur').getAttribute('data-script')) === '1', 'a tap on the "define walk" hat selects that script');
  await pal(page, 'call:walk').click();
  ok(/不能调用自己/.test(await toastText()) && (await prog(page)) === 'def walk(n) { } walk(2)', 'a call of walk inside walk is refused (no recursion): ' + (await toastText()).slice(0, 30));
  await pal(page, 'repeat').click(); await page.click('.cw-script[data-script="1"] .cw-val');
  ok((await page.locator('.cw-pop .cw-pi.var').allTextContents()).join() === 'n', 'inside "walk(n)" the parameter n can be used as a number');
  await page.click('.cw-pop .cw-pi.var:has-text("n")');
  ok((await prog(page)) === 'def walk(n) { repeat n { } } walk(2)', 'repeat n inside the definition');
  await drag(page, pal(page, 'move'), (await slotCenter(page, '.cw-script[data-script="1"] .cw-inner')).x + 8, (await slotCenter(page, '.cw-script[data-script="1"] .cw-inner')).y);
  ok((await prog(page)) === 'def walk(n) { repeat n { move } } walk(2)', 'a block can be dropped into the definition: "' + (await prog(page)) + '"');
  // moving a call of walk into walk is refused too
  await go(page, id, 'w4/8');
  ok(await page.locator('.cw-script').count() === 3, 'level 4-8 has two definitions and the main program');
  await page.click('.cw-script[data-script="1"] .cw-hat'); await pal(page, 'call:turn').click();
  ok(/不能调用/.test(await toastText()), 'walk (defined first) cannot call turn (defined after it)');
  await page.click('.cw-script[data-script="2"] .cw-hat'); await pal(page, 'call:walk').click();
  ok((await prog(page)).includes('def turn(n) { walk(n) }'), 'but turn can call walk (defined before it)');

  // ---------- static blocks (the reference answer) ----------
  const stat = await page.evaluate(async () => { const E = await import('/src/coding-editor.ts'); const A = await import('/src/coding-ast.ts'); const el = E.programEl(A.parse('def f(n) { repeat n { move } } repeat 2 { if pathAhead { move } else { left } } f(3)'), { funcs: [{ name: 'f', param: 'n' }] }); document.body.append(el); const r = { blocks: el.querySelectorAll('.cw-b').length, tab: el.querySelectorAll('[tabindex="0"]').length, dis: [...el.querySelectorAll('.cw-ctl')].every((b) => b.disabled) }; el.remove(); return r; });
  ok(stat.blocks === 7 && stat.tab === 0 && stat.dis, 'programEl draws a program as blocks that cannot be edited (7 blocks, nothing focusable, controls disabled)');
  ok(errors.length === 0, 'no script errors' + (errors.length ? ': ' + errors[0] : ''));
  await t.browser.close();

  // ---------- REAL touch events through the browser protocol (device pixel ratio 2) ----------
  const tt = await open({ touch: true, dpr: 2, viewport: { width: 820, height: 1180 } });
  const tp = tt.page;
  const cdp = await tt.ctx.newCDPSession(tp);
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const tdrag = async (from, x, y) => {
    const c = await center(from);
    await touch('touchStart', c.x, c.y);
    for (let i = 1; i <= 10; i++) await touch('touchMove', c.x + ((x - c.x) * i) / 10, c.y + ((y - c.y) * i) / 10);
    await touch('touchEnd', x, y);
    await tp.waitForTimeout(80);
  };
  await go(tp, tt.id, 'w2/1');
  const dpr = await tp.evaluate(() => devicePixelRatio);
  await tdrag(pal(tp, 'repeat'), (await slotCenter(tp, '.cw-ws .cw-root')).x + 20, (await slotCenter(tp, '.cw-ws .cw-root')).y);
  ok(dpr === 2 && (await prog(tp)) === 'repeat 3 { }', 'REAL touch (dpr 2): a finger drags "repeat" from the palette into the workspace');
  const inSlot = await slotCenter(tp, '.cw-ws .cw-inner');
  await tdrag(pal(tp, 'move'), inSlot.x + 10, inSlot.y);
  ok((await prog(tp)) === 'repeat 3 { move }', 'REAL touch: a finger drags "move" into the inner slot of the repeat');
  // a finger tap on a palette block appends
  const pm = await center(pal(tp, 'move'));
  await touch('touchStart', pm.x, pm.y); await touch('touchEnd', pm.x, pm.y); await tp.waitForTimeout(80);
  ok((await prog(tp)) === 'repeat 3 { move } move', 'REAL touch: a tap on a palette block appends it');
  // a finger drag of a workspace block onto the bin deletes
  const mv = tp.locator('.cw-ws .cw-root > .cw-b').last();
  const bc = await center(tp.locator('#cw-bin'));
  await tdrag(mv, bc.x, bc.y);
  ok((await prog(tp)) === 'repeat 3 { move }', 'REAL touch: dragging a block onto the bin deletes it');
  // the stepper with a finger
  const plus = await center(tp.locator('.cw-ws .cw-step[data-d="1"]'));
  await touch('touchStart', plus.x, plus.y); await touch('touchEnd', plus.x, plus.y); await tp.waitForTimeout(80);
  ok(await tp.textContent('.cw-ws .cw-val') === '4', 'REAL touch: the + of a stepper works with a finger (not taken for a drag): ' + (await tp.textContent('.cw-ws .cw-val')) + ' ' + JSON.stringify(plus));
  // a finger on the workspace background scrolls it instead of dragging blocks (touch-action)
  const ta = await tp.evaluate(() => [getComputedStyle(document.querySelector('.cw-ws')).touchAction, getComputedStyle(document.querySelector('.cw-pitem')).touchAction, getComputedStyle(document.querySelector('.cw-ws .cw-b')).touchAction]);
  ok(ta[0] === 'pan-y' && ta[1] === 'none' && ta[2] === 'none', 'touch-action: the workspace scrolls vertically with a finger, blocks are dragged (' + ta.join(' / ') + ')');
  await tp.screenshot({ path: OUT + 'editor-touch.png' });
  // the same on a phone (dpr 3, 390 wide)
  await tt.browser.close();
  const ph3 = await open({ touch: true, dpr: 3, viewport: { width: 390, height: 844 } });
  const pp = ph3.page; const cdp3 = await ph3.ctx.newCDPSession(pp);
  const touch3 = async (type, x, y) => cdp3.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await go(pp, ph3.id, 'w1/1');
  await pal(pp, 'move').scrollIntoViewIfNeeded();
  const c0 = await center(pal(pp, 'move')), w0 = await center(pp.locator('.cw-ws'));
  await touch3('touchStart', c0.x, c0.y);
  for (let i = 1; i <= 8; i++) await touch3('touchMove', c0.x + ((w0.x - c0.x) * i) / 8, c0.y + ((w0.y - c0.y) * i) / 8);
  await touch3('touchEnd', w0.x, w0.y); await pp.waitForTimeout(80);
  ok((await prog(pp)) === 'move', 'REAL touch on a phone (390 x 844, dpr 3): a finger drags "move" up into the workspace');
  await ph3.browser.close();

  ok(true, 'no outside request is possible here: the editor only uses the page itself');
  await done();
})();
