// 编程 text coding: the CODE EDITOR in the browser (the workshop page): typing with a physical keyboard (auto-indent, auto-close, type-over, Backspace in the indentation,
// Tab / Shift+Tab / Esc Tab, undo / redo, Ctrl+Enter), the symbol toolbar (mouse and REAL touch events through CDP at dpr 2: the focus stays in the text), highlighting classes,
// the error squiggle, the bracket hint, the running line, font sizes (never below 16 px: iOS zooms smaller inputs), the layers stay aligned while scrolling, and a short
// viewport (the on-screen keyboard) with no sideways scroll.
const H = require('./harness.cjs');
const { start, checks, addKid } = H;
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const t = await start(new Map(), { local: true, today: '2026-11-12', viewport: { width: 390, height: 844 }, touch: true, dpr: 2 });
  const page = t.page;
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await addKid(page, 'Dory');
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem('learn.local.kids.json')).kids[0].id);
  await page.evaluate(() => localStorage.setItem('learn.codingtext.v1', JSON.stringify({ seen: [], drafts: {}, snippets: {}, ws: {} })));
  await page.evaluate((i) => (location.hash = `#/coding/${i}/code`), id);
  await page.waitForSelector('#tx-ta');
  await page.waitForTimeout(200);
  const val = () => page.inputValue('#tx-ta');
  const sel = () => page.evaluate(() => { const a = document.querySelector('#tx-ta'); return [a.selectionStart, a.selectionEnd]; });
  const setv = async (v, caret) => { await page.evaluate(([v2, c]) => { const e = window.__codingtext.editor; e.setValue(v2); const a = e.ta; a.focus(); a.setSelectionRange(c ?? v2.length, c ?? v2.length); }, [v, caret]); };
  const press = async (k) => page.keyboard.press(k);
  const key = (label) => page.locator('.tx-keys .tx-key').filter({ hasText: new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first();

  // ---------- typing ----------
  await setv('');
  await page.keyboard.type('print("hi")');
  ok((await val()) === 'print("hi")', 'typing print("hi") with brackets and quotes closing themselves and being typed over gives exactly print("hi"): ' + JSON.stringify(await val()));
  await setv('');
  await page.keyboard.type('print(');
  ok((await val()) === 'print()' && (await sel())[0] === 6, 'typing ( adds the closing ) and puts the caret between');
  await setv('');
  await page.keyboard.type('x = [1, (2');
  ok((await val()) === 'x = [1, (2)]', 'nested brackets close in the right order: ' + JSON.stringify(await val()));
  await setv('');
  await page.keyboard.type("it's");
  ok((await val()) === "it's", "an apostrophe after a letter is not a quote (no pair): " + JSON.stringify(await val()));
  await setv('s = "a');
  await page.keyboard.type("'b");
  ok((await val()) === 's = "a\'b', 'inside a string no pair is added');
  await setv('hello', 0);
  await page.evaluate(() => document.querySelector('#tx-ta').setSelectionRange(0, 5));
  await page.keyboard.type('(');
  ok((await val()) === '(hello)', 'typing ( over a selection wraps it');

  // ---------- auto-indent ----------
  await setv('def f():');
  await press('Enter');
  ok((await val()) === 'def f():\n    ', 'Enter after a colon indents by 4 spaces');
  await page.keyboard.type('x = 1');
  await press('Enter');
  ok((await val()) === 'def f():\n    x = 1\n    ', 'Enter keeps the indentation');
  await page.keyboard.type('return x');
  await press('Enter');
  ok((await val()) === 'def f():\n    x = 1\n    return x\n', 'Enter after return goes one level back');
  await setv('if a:\n    if b:');
  await press('Enter');
  ok((await val()).endsWith('if b:\n        '), 'nested colon: 8 spaces');
  await setv('print()', 6);
  await press('Enter');
  ok((await val()) === 'print(\n    \n)' && (await sel())[0] === 11, 'Enter between () opens the pair on three lines: ' + JSON.stringify(await val()));
  await setv('for i in range(3):  # loop');
  await press('Enter');
  ok((await val()).endsWith('\n    '), 'a comment after the colon does not hide the colon');
  await setv('x = 1  # a: b');
  await press('Enter');
  ok((await val()) === 'x = 1  # a: b\n', 'a colon inside a comment does not indent');

  // ---------- Backspace, Tab ----------
  await setv('if a:\n        x');
  await page.evaluate(() => document.querySelector('#tx-ta').setSelectionRange(14, 14));   // right after the 8 spaces
  await press('Backspace');
  ok((await val()) === 'if a:\n    x', 'Backspace in the indentation removes 4 spaces at a time: ' + JSON.stringify(await val()));
  await setv('abc');
  await press('Tab');
  ok((await val()) === 'abc ', 'Tab inserts spaces up to the next multiple of 4 (one space after 3 letters)');
  await setv('ab', 2);
  await press('Tab');
  ok((await val()) === 'ab  ', 'Tab at column 2 inserts 2 spaces');
  await setv('a\nb\nc');
  await page.evaluate(() => document.querySelector('#tx-ta').setSelectionRange(0, 5));
  await press('Tab');
  ok((await val()) === '    a\n    b\n    c', 'Tab with several lines selected indents all of them');
  await press('Shift+Tab');
  ok((await val()) === 'a\nb\nc', 'Shift+Tab dedents them again');
  await setv('x');
  await press('Escape');
  const before = await page.evaluate(() => document.activeElement.id);
  await press('Tab');
  const after = await page.evaluate(() => document.activeElement.id);
  ok((await val()) === 'x' && before === 'tx-ta' && after !== 'tx-ta', 'Esc then Tab leaves the editor (keyboard users are not trapped): focus moved to ' + after);

  // ---------- undo / redo, run shortcut ----------
  await setv('');
  await page.keyboard.type('abc');
  await page.waitForTimeout(800);
  await page.keyboard.type('def');
  await press('Control+z');
  ok((await val()) === 'abc', 'Ctrl+Z undoes the last burst of typing: ' + JSON.stringify(await val()));
  await press('Control+z');
  ok((await val()) === '', 'Ctrl+Z again goes back to the start');
  await press('Control+Shift+z');
  ok((await val()) === 'abc', 'Ctrl+Shift+Z redoes');
  await press('Control+y');
  ok((await val()) === 'abcdef', 'Ctrl+Y redoes');
  await setv('print(1 + 2)');
  await press('Control+Enter');
  await page.waitForFunction(() => document.querySelector('#tx-out').textContent.trim() === '3');
  ok(true, 'Ctrl+Enter runs the program (output 3)');
  await setv('print(1 + 2)');
  await press('Meta+Enter');
  await page.waitForTimeout(100);
  ok((await page.textContent('#tx-out')).trim() === '3', 'Cmd+Enter runs it too');

  // ---------- the toolbar ----------
  const keys = await page.locator('.tx-keys .tx-key').evaluateAll((els) => els.map((e) => ({ t: e.textContent, w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height, label: e.getAttribute('aria-label') })));
  const wanted = [':', '(', ')', '[', ']', '{', '}', '"', "'", '=', '+', '-', '*', '/', '%', '#', '_'];
  ok(wanted.every((k) => keys.some((x) => x.t === k)) && keys.some((x) => x.t === '⇥') && keys.some((x) => x.t === '⇤') && keys.some((x) => x.t === '↶') && keys.some((x) => x.t === '↷'), 'the toolbar has : ( ) [ ] { } " \' = + - * / % # _ and indent / dedent / undo / redo: ' + keys.map((k) => k.t).join(' '));
  ok(keys.every((k) => k.w >= 40 && k.h >= 40), 'every toolbar key is at least 40 x 40 px (' + Math.min(...keys.map((k) => k.w)) + ' x ' + Math.min(...keys.map((k) => k.h)) + ')');
  await setv('x ');
  await key(':').click();
  ok((await val()) === 'x :', 'tapping : inserts a colon');
  await setv('');
  await key('(').click();
  ok((await val()) === '()' && (await sel())[0] === 1, 'tapping ( inserts () with the caret inside');
  await key(')').click();
  ok((await val()) === '()' && (await sel())[0] === 2, 'tapping ) then moves over the closing bracket (no double )');
  await setv('print(');
  await key('"').click();
  ok((await val()) === 'print("")' || (await val()) === 'print(""', 'tapping " inserts a pair of quotes');
  await setv('a', 0);
  await key('⇥').click();
  ok((await val()) === '    a', 'the indent button works like Tab (a Tab key does not exist on iPad keyboards)');
  await key('⇤').click();
  ok((await val()) === 'a', 'the dedent button removes the indentation');
  await setv('');
  await page.keyboard.type('ab');
  await page.waitForTimeout(800);
  await key('#').click();
  await key('↶').click();
  ok((await val()) === 'ab', 'the undo button undoes the symbol');
  await key('↷').click();
  ok((await val()) === 'ab#', 'the redo button redoes it');
  // the toolbar does not take the focus (the keyboard would close)
  await page.evaluate(() => { document.querySelector('.tx-keys').scrollLeft = 0; document.querySelector('#tx-ta').focus(); });
  const kb = await key(':').boundingBox();
  await page.mouse.move(kb.x + 10, kb.y + 10); await page.mouse.down();
  const during = await page.evaluate(() => document.activeElement.id);
  await page.mouse.up();
  ok(during === 'tx-ta' && (await page.evaluate(() => document.activeElement.id)) === 'tx-ta', 'pressing a toolbar key keeps the focus in the text (the on-screen keyboard stays open)');
  // REAL touch events (CDP) at dpr 2
  const cdp = await page.context().newCDPSession(page);
  const tap = async (x, y) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(80); };
  await setv('');
  await page.evaluate(() => (document.querySelector('.tx-keys').scrollLeft = 0));
  const c1 = await key(':').boundingBox();
  await tap(c1.x + c1.width / 2, c1.y + c1.height / 2);
  ok((await val()) === ':', 'a real touch tap on the : key inserts it: ' + JSON.stringify(await val()));
  const c2 = await key('⇥').boundingBox();
  await page.evaluate(() => document.querySelector('#tx-ta').setSelectionRange(0, 0));
  await tap(c2.x + c2.width / 2, c2.y + c2.height / 2);
  ok((await val()) === '    :', 'a real touch tap on the indent key indents: ' + JSON.stringify(await val()));
  const c3 = await key('(').boundingBox();
  await page.evaluate(() => { const a = document.querySelector('#tx-ta'); a.setSelectionRange(a.value.length, a.value.length); });
  await tap(c3.x + c3.width / 2, c3.y + c3.height / 2);
  ok((await val()) === '    :()', 'a real touch tap on ( inserts the pair');
  ok((await page.evaluate(() => document.activeElement.id)) === 'tx-ta', 'after the touch taps the focus is still in the text');
  // the toolbar row scrolls inside itself (never the page)
  const scr = await page.evaluate(() => { const k = document.querySelector('.tx-keys'); return { sw: k.scrollWidth, cw: k.clientWidth, doc: document.documentElement.scrollWidth, win: innerWidth }; });
  ok(scr.sw > scr.cw && scr.doc <= scr.win, `the key row scrolls inside (${scr.sw} > ${scr.cw}), the page does not (${scr.doc} <= ${scr.win})`);
  await page.evaluate(() => (document.querySelector('.tx-keys').scrollLeft = 9999));
  const last = await page.locator('.tx-keys .tx-key').last().boundingBox();
  ok(last.x + last.width <= 390 + 1, 'the last keys can be reached by scrolling the row');

  // ---------- highlighting, squiggle, bracket hint, running line ----------
  await setv('def f(x):  # note\n    return "s" + str(1.5)\nprint(f(2))');
  const cls = await page.evaluate(() => { const g = (c) => [...document.querySelectorAll('.tx-hl .' + c)].map((e) => e.textContent); return { kw: g('tx-kw'), def: g('tx-def'), str: g('tx-str'), num: g('tx-num'), com: g('tx-com'), bi: g('tx-bi') }; });
  ok(cls.kw.includes('def') && cls.kw.includes('return') && cls.def.join() === 'f' && cls.str.join() === '"s"' && cls.num.join() === '1.5,2' && cls.com.join() === '# note' && cls.bi.includes('str') && cls.bi.includes('print'), 'highlight classes: ' + JSON.stringify(cls));
  const colors = await page.evaluate(() => { const c = (s) => getComputedStyle(document.querySelector('.tx-hl ' + s)).color; return [c('.tx-kw'), c('.tx-str'), c('.tx-num'), c('.tx-com')]; });
  ok(new Set(colors).size === 4, 'keywords, strings, numbers and comments have four different colours: ' + colors.join(' '));
  await setv('x = 1\nprint(y)');
  await page.click('#tx-run');
  await page.waitForSelector('.tx-line.tx-err');
  const sq = await page.evaluate(() => ({ idx: [...document.querySelectorAll('.tx-hl .tx-line')].findIndex((e) => e.classList.contains('tx-err')) + 1, n: document.querySelectorAll('.tx-hl .tx-err').length, g: [...document.querySelectorAll('.tx-gutter span')].findIndex((e) => e.classList.contains('tx-err')) + 1, deco: getComputedStyle(document.querySelector('.tx-line.tx-err')).textDecorationLine, err: document.querySelector('#tx-error').textContent }));
  ok(sq.idx === 2 && sq.n === 1 && sq.g === 2 && /underline/.test(sq.deco) && /print\(y\)|y/.test(sq.err), 'the failing line is underlined (wavy) and its line number is red in the gutter; the message names y: ' + JSON.stringify(sq));
  await page.fill('#tx-ta', 'x = 1\nprint(x)');
  await page.waitForTimeout(50);
  ok((await page.locator('.tx-line.tx-err').count()) === 1, 'the squiggle stays until the next run (a new run clears it)');
  await page.click('#tx-run');
  await page.waitForFunction(() => !document.querySelector('.tx-line.tx-err'));
  ok(true, 'a successful run removes the squiggle');
  await setv('f(a[1])', 7);
  await page.evaluate(() => document.querySelector('#tx-ta').setSelectionRange(7, 7));
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(50);
  const br = await page.evaluate(() => [...document.querySelectorAll('.tx-hl .tx-br')].map((e) => e.textContent).join(''));
  ok(br === '()', 'the caret next to ) marks the matching ( and ): ' + JSON.stringify(br));
  // the running line of the stepper
  await setv('a = 1\nb = a + 1\nprint(b)');
  await page.click('#tx-step');
  await page.waitForSelector('#tx-stepbar:not([hidden])');
  ok((await page.evaluate(() => [...document.querySelectorAll('.tx-hl .tx-line')].findIndex((e) => e.classList.contains('tx-cur')))) === 0, 'stepping: the first line is lit');
  await page.click('#tx-step-next'); await page.click('#tx-step-next');
  ok((await page.evaluate(() => [...document.querySelectorAll('.tx-hl .tx-line')].findIndex((e) => e.classList.contains('tx-cur')))) === 2, 'after two steps line 3 is lit');
  ok((await page.locator('#tx-ta[readonly]').count()) === 1, 'the editor is read-only while stepping');
  const frozen = await val();
  await page.evaluate(() => { document.querySelector('.tx-keys').scrollLeft = 0; });
  await key(':').click(); await key('⇥').click();
  ok((await val()) === frozen, 'the toolbar changes nothing while the editor is read-only (stepping)');
  await page.click('#tx-step-stop');
  ok((await page.locator('.tx-line.tx-cur').count()) === 0 && (await page.locator('#tx-ta[readonly]').count()) === 0, 'stopping gives the editor back');

  // ---------- fonts, alignment, scrolling ----------
  const fsz = [];
  for (const px of [16, 18, 22]) {
    await page.click(`.tx-fsb[data-fs="${px}"]`);
    fsz.push(await page.evaluate(() => ({ ta: parseFloat(getComputedStyle(document.querySelector('#tx-ta')).fontSize), hl: parseFloat(getComputedStyle(document.querySelector('.tx-hl')).fontSize), lh: getComputedStyle(document.querySelector('#tx-ta')).lineHeight, lhh: getComputedStyle(document.querySelector('.tx-hl')).lineHeight, line: document.querySelector('.tx-hl .tx-line').getBoundingClientRect().height, gut: document.querySelector('.tx-gutter span').getBoundingClientRect().height })));
  }
  ok(fsz.every((f, i) => f.ta === [16, 18, 22][i] && f.hl === f.ta && f.lh === f.lhh && Math.abs(f.line - parseFloat(f.lh)) < 0.6 && Math.abs(f.gut - parseFloat(f.lh)) < 0.6), 'three font sizes 16 / 18 / 22: the text, the highlight layer, the line numbers use the same size and line height: ' + JSON.stringify(fsz.map((f) => [f.ta, f.lh, f.line])));
  ok(fsz.every((f) => f.ta >= 16), 'the editor font is never below 16 px (iOS would zoom into the page)');
  ok((await page.evaluate(() => localStorage.getItem('learn.codingtext.font'))) === '22', 'the chosen size is remembered on this device');
  const inputs = await page.evaluate(() => [...document.querySelectorAll('textarea, input')].map((e) => parseFloat(getComputedStyle(e).fontSize)));
  ok(inputs.length >= 2 && inputs.every((s) => s >= 16), 'every text field on the page is at least 16 px: ' + inputs.join(' '));
  await page.click('.tx-fsb[data-fs="16"]');
  const long = Array.from({ length: 60 }, (_, i) => `line_${i} = ${i}` + ' + 1'.repeat(i % 7 === 0 ? 30 : 0)).join('\n');
  await setv(long, 0);
  await page.evaluate(() => { const a = document.querySelector('#tx-ta'); a.scrollTop = 700; a.scrollLeft = 150; a.dispatchEvent(new Event('scroll')); });
  await page.waitForTimeout(50);
  const al = await page.evaluate(() => { const a = document.querySelector('#tx-ta'), h = document.querySelector('.tx-hl'), g = document.querySelector('.tx-gutter'); return { st: a.scrollTop, hs: h.scrollTop, gs: g.scrollTop, sl: a.scrollLeft, hl: h.scrollLeft }; });
  ok(al.st > 0 && Math.abs(al.st - al.hs) <= 1 && Math.abs(al.st - al.gs) <= 1 && al.sl > 0 && Math.abs(al.sl - al.hl) <= 1, 'scrolling the text scrolls the highlight layer and the line numbers with it: ' + JSON.stringify(al));
  const box = await page.evaluate(() => { const e = document.querySelector('.tx-ed').getBoundingClientRect(); return { l: e.left, r: innerWidth - e.right, doc: document.documentElement.scrollWidth, win: innerWidth }; });
  ok(Math.abs(box.l - box.r) <= 1 && box.doc <= box.win, `the editor is centred (${Math.round(box.l)} / ${Math.round(box.r)} px) and 60 long lines do not widen the page (the code area scrolls inside)`);
  // a tab pasted from elsewhere runs like 4 spaces
  await setv('if True:\n\tprint(7)');
  await page.click('#tx-run');
  await page.waitForFunction(() => document.querySelector('#tx-out').textContent.trim() === '7');
  ok(true, 'a Tab character in pasted code counts as 4 spaces');
  // Chinese full-width punctuation: a clear message
  await setv('print（"a"）');
  await page.click('#tx-run');
  await page.waitForSelector('#tx-error:not([hidden])');
  ok(/中文标点/.test(await page.textContent('#tx-error')), 'Chinese punctuation: the message says so');

  // ---------- a short viewport = the on-screen keyboard is open ----------
  await page.setViewportSize({ width: 390, height: 420 });
  await page.waitForTimeout(250);
  await setv('x = 1', 5);
  await page.evaluate(() => document.querySelector('#tx-ta').scrollIntoView({ block: 'center' }));
  const sh = await page.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); const ed = r('.tx-ed'), bar = r('.tx-bar'), ta = r('#tx-ta'); return { barBottom: bar.bottom, barTop: bar.top, ih: innerHeight, taH: ta.height, doc: document.documentElement.scrollWidth, win: innerWidth, edH: ed.height }; });
  ok(sh.taH >= 150 && sh.edH < 420, `with a 420 px high window the editor (${Math.round(sh.edH)} px) fits and the code area is ${Math.round(sh.taH)} px high`);
  ok(sh.doc <= sh.win, 'no sideways scroll of the page in the short window');
  await page.screenshot({ path: OUT + 'tx-editor-short.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + 'tx-editor.png' });
  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  ok(t.log.external.length === 0, 'no request left the app: ' + t.log.external.join(', '));
  await done(t.browser);
})().catch((e) => { console.error(e); process.exit(1); });
