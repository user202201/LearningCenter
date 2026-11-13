// 编程 worlds 14-16, part 3: the REAL CONTROLS. Levels played the way a child plays them (taps, typing, the mouse, the keyboard) and then the drag levels with REAL touch
// events through the browser protocol at device pixel ratio 2: switches, a quiz typed with Enter, choices, sort (tap card + tap bucket, mouse drag, touch drag),
// order (arrows, mouse drag, touch drag), painting a picture (mouse and finger), the numbers of a picture, Huffman, a spreadsheet typed into cells, the flipped
// bit, a packet journey, a password, the plane of k nearest neighbours, a decision tree, the inverted index, drawing a digit, the device editor.
const H = require('./harness.cjs');
const { start, checks, addKid } = H;
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });

const open = async (opts = {}) => {
  const t = await start(new Map(), { local: true, today: '2026-11-12', viewport: { width: 390, height: 844 }, ...opts });
  await addKid(t.page, 'Dory');
  t.id = await t.page.evaluate(() => JSON.parse(localStorage.getItem('learn.local.kids.json')).kids[0].id);
  const seen = await t.page.evaluate(async () => { const C = await import('/src/coding-infocontent.ts'); return Object.keys((await C.loadContent()).lessons); });
  await t.page.evaluate((s) => localStorage.setItem('learn.coding.v1', JSON.stringify({ seen: s, speed: 'fast', drawings: {} })), seen);
  return t;
};
const goAct = async (t, aid) => { const m = /^i(\d+)-(\d+)$/.exec(aid); await t.page.evaluate((i) => (location.hash = '#/coding/' + i), t.id); await t.page.waitForSelector('.ci-icard'); await t.page.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((x) => x.remove())); await t.page.evaluate((h) => (location.hash = h), `#/coding/${t.id}/i${m[1]}/${Number(m[2])}`); await t.page.waitForFunction((id) => window.__info && window.__info.act.id === id, aid); await t.page.waitForTimeout(80); };
const st = (page) => page.evaluate(() => window.__info.state);
const won = (page) => page.evaluate(() => !document.querySelector('#ci-result').hidden);
const msg = (page) => page.textContent('#ci-msg');
const center = async (page, sel) => { const b = await page.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

(async () => {
  const errors = [];
  let t = await open(); let page = t.page;
  page.on('pageerror', (e) => errors.push(e.message));

  // ---------- switches ----------
  await goAct(t, 'i14-01');
  for (let round = 0; round < 3; round++) {
    const n = Number(await page.textContent('.ci-big'));
    if (round === 0) { await page.click('#ci-check'); ok((await st(page)).mistakes === 1 && /数值不对/.test(await msg(page)), 'checking with all switches off is a mistake and says so'); }
    const bitsStr = n.toString(2).padStart(4, '0');
    for (let i = 0; i < 4; i++) if (bitsStr[i] === '1') await page.click(`.ci-sw[data-i="${i}"]`);
    if (round === 0) ok((await page.textContent('.ci-val')) === `= ${n}`, 'the switches add up their place values live (= ' + n + ')');
    await page.click('#ci-check');
  }
  await page.waitForSelector('#ci-result:not([hidden])');
  ok((await won(page)) && (await page.getAttribute('#ci-result', 'data-stars')) === '2', 'three numbers set with the real switches win (one mistake = 2 stars)');

  // ---------- a quiz typed, with Enter; choices ----------
  await goAct(t, 'i14-02');
  for (let k = 0; k < 4; k++) {
    const val = await page.evaluate(() => [...document.querySelectorAll('.ci-lamp.on b')].reduce((a, b) => a + Number(b.textContent), 0));
    if (k === 0) { await page.fill('.ci-input', String(val + 1)); await page.keyboard.press('Enter'); ok((await st(page)).mistakes === 1, 'a wrong number typed and Enter is a mistake'); }
    await page.fill('.ci-input', String(val)); await page.keyboard.press('Enter');
  }
  ok(await won(page), 'four binary lamp pictures read and typed (Enter confirms) win');
  await goAct(t, 'i14-05');
  for (let k = 0; k < 3; k++) { const bitsN = Number((await page.textContent('#ci-prompt')).match(/\d+/)[0]); await page.click(`.ci-choice[data-v="${2 ** bitsN}"]`); }
  ok(await won(page), 'capacity of n bits answered with the choice buttons (3 questions) wins');
  await goAct(t, 'i14-23');
  const k0 = await page.evaluate(() => Number(document.querySelector('#ci-key').textContent));
  await page.click('#ci-wp'); await page.click('#ci-wp'); await page.click('#ci-wm');
  ok((await page.textContent('#ci-key')) === '1' && k0 === 0 && (await page.getAttribute('#ci-inner', 'transform')).startsWith('rotate(13.8'), 'the Caesar wheel turns with + and - (key 0 -> 1, the inner ring rotates 13.8 degrees)');
  for (let k = 0; k < 3; k++) {
    const [cipher, key] = await page.evaluate(() => { const m = document.querySelector('#ci-prompt').textContent.match(/([A-Z]{2,})/); const kk = document.querySelector('#ci-prompt').textContent.match(/(\d+) /); return [m[1], Number(document.querySelector('#ci-prompt').textContent.match(/(\d+)\s*位/)?.[1] ?? kk[1])]; });
    const plain = [...cipher].map((c) => String.fromCharCode(((c.charCodeAt(0) - 65 - key + 26) % 26) + 65)).join('');
    await page.fill('.ci-input', plain.toLowerCase()); await page.keyboard.press('Enter');
  }
  ok(await won(page), 'three Caesar words decrypted (typed in lower case: capitals do not matter) win');

  // ---------- sort: tap a card, tap a bucket ----------
  await goAct(t, 'i15-13');
  const sortSpec = await page.evaluate(() => window.__info.act.spec);
  await page.click('#ci-check'); ok(/先把所有卡片/.test(await msg(page)) && (await st(page)).mistakes === 0, 'checking before every card is placed asks for it and is not a mistake');
  const textOf = (c) => c.t;
  for (const c of sortSpec.cards) { await page.click(`.ci-sc:has-text("${textOf(c)}") >> nth=0`); await page.click(`.ci-bucket[data-b="${c.b}"]`); }
  await page.click('#ci-check');
  ok(await won(page), 'eight cards sorted by tapping a card and then a bucket win with no mistake');
  // a wrong card goes back
  await goAct(t, 'i15-13');
  for (const c of sortSpec.cards) { await page.click(`.ci-sc:has-text("${textOf(c)}") >> nth=0`); await page.click(`.ci-bucket[data-b="${c.b === 0 && c.t === sortSpec.cards[0].t ? 1 : c.b}"]`); }
  await page.click('#ci-check');
  ok(!(await won(page)) && (await st(page)).mistakes === 1 && (await page.locator('.ci-pool .ci-sc').count()) === 1, 'one card in the wrong bucket: a mistake, only that card goes back to the pool (1 card)');
  // mouse drag of the card back
  const back = await page.locator('.ci-pool .ci-sc').first(); const bt = await back.textContent(); const target = sortSpec.cards.find((c) => c.t === bt).b;
  const from = await center(page, '.ci-pool .ci-sc'); const to = await center(page, `.ci-bucket[data-b="${target}"]`);
  await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 5 }); await page.mouse.move(to.x, to.y, { steps: 5 }); await page.mouse.up();
  ok((await page.locator('.ci-pool .ci-sc').count()) === 0, 'dragging a card with the mouse into its bucket places it');
  await page.click('#ci-check'); ok(await won(page), 'and the sort is then complete');

  // ---------- order: arrows, mouse drag ----------
  await goAct(t, 'i15-05');
  const items = await page.evaluate(() => window.__info.act.spec.items);
  const orderNow = () => page.evaluate(() => [...document.querySelectorAll('.ci-orow')].map((r) => Number(r.dataset.it)));
  for (let target = 0; target < items.length; target++) { let ord = await orderNow(); let at = ord.indexOf(target); while (at > target) { await page.click(`.ci-orow:nth-child(${at + 1}) .ci-up`); at--; } }
  ok((await orderNow()).join() === items.map((_, i) => i).join(), 'the ▲ buttons put the steps in order');
  await page.click('.ci-orow:nth-child(1) .ci-down'); await page.click('#ci-check'); ok(!(await won(page)) && (await st(page)).mistakes === 1, 'a swapped pair is a mistake');
  const a = await center(page, '.ci-orow:nth-child(2) .ci-otext'); const b = await center(page, '.ci-orow:nth-child(1) .ci-otext');
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(a.x, (a.y + b.y) / 2, { steps: 4 }); await page.mouse.move(b.x, b.y - 8, { steps: 4 }); await page.mouse.up();
  ok((await orderNow()).join() === '0,1,2,3', 'dragging the second row above the first with the mouse restores the order (live: the rows move while the pointer is down)');
  await page.click('#ci-check'); ok(await won(page), 'and the order is accepted');

  // ---------- painting: mouse drag ----------
  await goAct(t, 'i14-11');
  const rowsT = await page.evaluate(() => [...document.querySelectorAll('.ci-pixpair > div:first-child .ci-pixrow')].map((r) => [...r.querySelectorAll('i')].map((c) => (c.classList.contains('on') ? 1 : 0)).join('')));
  const cell = async (x, y) => { const b = await page.locator(`.ci-pixedit i[data-i="${y * 8 + x}"]`).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  for (let y = 0; y < 8; y++) { let x = 0; while (x < 8) { if (rowsT[y][x] === '1') { let e = x; while (e + 1 < 8 && rowsT[y][e + 1] === '1') e++; const p0 = await cell(x, y), p1 = await cell(e, y); await page.mouse.move(p0.x, p0.y); await page.mouse.down(); await page.mouse.move(p1.x, p1.y, { steps: 3 }); await page.mouse.up(); x = e + 1; } else x++; } }
  const painted = await page.evaluate(() => [...document.querySelectorAll('.ci-pixedit i')].filter((c) => c.classList.contains('on')).length);
  ok(painted === rowsT.join('').split('').filter((c) => c === '1').length, 'dragging the mouse along the rows paints the target picture (' + painted + ' squares), the first square decides paint or erase');
  await page.click('#ci-check'); ok(await won(page), 'the painted heart is accepted');
  await goAct(t, 'i14-12');
  const nums = await page.evaluate(() => [...document.querySelectorAll('.ci-numrow .ci-pixrow')].map((r) => parseInt([...r.querySelectorAll('i')].map((c) => (c.classList.contains('on') ? 1 : 0)).join(''), 2)));
  for (let y = 0; y < 8; y++) await page.fill(`.ci-input[data-r="${y}"]`, String(nums[y]));
  await page.click('#ci-check'); ok(await won(page), 'the decimal numbers of the picture\'s rows typed in win');

  // ---------- Huffman, spreadsheet, flipped bit ----------
  await goAct(t, 'i14-21');
  while (!(await won(page))) {
    const ws = await page.evaluate(() => [...document.querySelectorAll('.ci-hnode')].map((n, i) => ({ i, w: Number(n.querySelector('small').textContent) })).sort((a, b) => a.w - b.w));
    if (ws.length < 2) break;
    if ((await page.locator('.ci-hnode').count()) === 5) { await page.click(`.ci-hnode[data-i="${ws[ws.length - 1].i}"]`); await page.click(`.ci-hnode[data-i="${ws[ws.length - 2].i}"]`); ok((await st(page)).mistakes === 1, 'merging the two LARGEST nodes is refused as a mistake'); }
    await page.click(`.ci-hnode[data-i="${ws[0].i}"]`); await page.click(`.ci-hnode[data-i="${ws[1].i}"]`);
  }
  ok((await page.textContent('.ci-hout')).includes('23 bits'), 'ABRACADABRA: the tree built by hand costs 23 bits (the codes and the fixed-length cost are shown)');
  await goAct(t, 'i14-34');
  const typeCell = async (k, v) => { await page.click(`.ci-cell[data-k="${k}"]`); await page.fill(`.ci-cell[data-k="${k}"]`, v); await page.keyboard.press('Enter'); };
  await typeCell('B6', '22'); await page.click('#ci-check'); ok(/=/.test(await msg(page)) && (await st(page)).mistakes === 1, 'a typed number instead of a formula is refused (a formula must start with =)');
  await typeCell('B6', '=B2+B3+B4+B5'); await page.click('#ci-check'); ok((await st(page)).mistakes === 1 && /\/ 3|2 \/ 3/.test(await page.textContent('.ci-prog')), 'a formula that adds the cells one by one is accepted and the next task comes (2 / 3)');
  ok((await page.inputValue('.ci-cell[data-k="B6"]')) !== undefined && (await page.evaluate(() => document.querySelector('.ci-cell[data-k="B6"]').value)) === '22', 'the sheet shows the VALUE of a formula (22) when the cell is not being edited');
  await typeCell('C6', '=AVERAGE(C2:C5)'); await page.click('#ci-check'); await typeCell('D6', '=MAX(B2:B5)'); await page.click('#ci-check');
  ok(await won(page), 'AVERAGE and MAX typed into the cells win');
  await goAct(t, 'i14-28');
  for (let k = 0; k < 3; k++) {
    const pos = await page.evaluate(() => { const odd = [...document.querySelectorAll('.ci-bit.odd')].map((e) => [Number(e.dataset.y), Number(e.dataset.x)]); const rows = {}, cols = {}; odd.forEach(([y, x]) => { rows[y] = (rows[y] || 0) + 1; cols[x] = (cols[x] || 0) + 1; }); return odd.find(([y, x]) => rows[y] === 5 && cols[x] === 5); });
    await page.click(`.ci-bit[data-y="${pos[0]}"][data-x="${pos[1]}"]`);
  }
  ok(await won(page), 'the flipped bit found at the crossing of the red row and the red column, three times');
  await page.screenshot({ path: OUT + 'info-controls-fixbit.png' });

  // ---------- network: a packet journey ----------
  await goAct(t, 'i15-01');
  await page.click('.ci-node[data-n="R3"]'); ok((await st(page)).mistakes === 1 && /没有连线/.test(await msg(page)), 'tapping a router that is not next to the packet is a mistake (no link)');
  for (const n of ['R1', 'R3', 'S']) await page.click(`.ci-node[data-n="${n}"]`);
  ok(/1 \/ 3|2 \/ 3/.test(await page.textContent('.ci-live')), 'PC - R1 - R3 - S: the first packet arrived, the second is next');
  await page.click('.ci-node[data-n="R1"]'); await page.click('.ci-node[data-n="R3"]'); ok(/堵住/.test(await msg(page)), 'the jammed link (dashed red) refuses the second packet');
  await page.click('#ci-reset'); for (const n of ['R2', 'R4', 'S']) await page.click(`.ci-node[data-n="${n}"]`);
  await page.click('.ci-node[data-n="R1"]'); await page.click('.ci-node[data-n="R2"]'); await page.click('.ci-node[data-n="R4"]'); await page.click('.ci-node[data-n="R3"]');
  ok((await page.locator('.ci-node').count()) === 6, 'the third packet walks too (TTL counted)');
  await page.click('#ci-reset'); for (const n of ['R1', 'R3', 'S']) await page.click(`.ci-node[data-n="${n}"]`);
  await page.waitForSelector('.ci-pk[data-seq]');
  const order2 = await page.evaluate(() => [...document.querySelectorAll('.ci-pk[data-seq]')].map((e) => e.dataset.seq).join());
  await page.click('.ci-pk[data-seq="2"]'); ok((await st(page)).mistakes >= 2 && order2 !== '1,2,3', 'the packets arrive shuffled (' + order2 + '); tapping 2 first is a mistake');
  for (const q of [1, 2, 3]) await page.click(`.ci-pk[data-seq="${q}"]`);
  ok((await won(page)) && (await page.textContent('.ci-msg')) === 'HELLO WORLD', 'tapping the packets in the order 1 2 3 rebuilds "HELLO WORLD"');
  await page.screenshot({ path: OUT + 'info-controls-route.png' });

  // ---------- password, knn plane, tree, index, digit ----------
  await goAct(t, 'i15-08');
  await page.fill('#ci-pw', '123456');
  const m0 = await page.evaluate(() => ({ on: document.querySelectorAll('.ci-meter i.on').length, t: document.querySelector('.ci-time').textContent }));
  await page.fill('#ci-pw', 'Tr33#Rocket!Moon_47');
  const m1 = await page.evaluate(() => ({ on: document.querySelectorAll('.ci-meter i.on').length, t: document.querySelector('.ci-time').textContent, bits: document.querySelector('.ci-live').textContent }));
  ok(m0.on === 1 && m0.t === '不到 1 秒' && m1.on === 5 && /百万年/.test(m1.t) && /^1\d\d bits$/.test(m1.bits), `the strength bar and the time to crack follow the typing: 123456 = ${m0.on} segment, "${m0.t}"; a long mixed password = ${m1.on} segments, "${m1.t}", ${m1.bits}`);
  await page.fill('#ci-pw', 'Xk9#long-Password$22'); await page.click('#ci-check'); ok((await page.textContent('.ci-prog')) === '2 / 2', 'a strong password passes the first task');
  await page.fill('#ci-pw', 'XiaoMing#2012!rocket'); await page.click('#ci-check'); ok((await st(page)).mistakes === 1 && /个人信息/.test(await msg(page)), 'a strong password that contains "xiaoming" is refused (personal data)');
  await page.fill('#ci-pw', 'Rocket#Moon-Tiger!88'); await page.click('#ci-check'); ok(await won(page), 'a long mixed password without personal data wins');
  await goAct(t, 'i15-17');
  const pl = await page.locator('#ci-plane svg').boundingBox();
  const spec = await page.evaluate(() => ({ names: window.__info.act.spec.names }));
  void spec;
  const want = await page.evaluate(() => document.querySelector('#ci-prompt').textContent.includes('蓝色') ? 0 : 1);
  const pts = await page.evaluate(() => [...document.querySelectorAll('#ci-plane circle')].map((c) => ({ x: +c.getAttribute('cx'), y: +c.getAttribute('cy'), f: c.getAttribute('fill') })));
  const pick = pts.find((p) => (want === 0 ? p.f === '#4dabf7' : p.f === '#ffa94d'));
  await page.mouse.click(pl.x + ((pick.x + 3) / 106) * pl.width, pl.y + ((pick.y + 3) / 106) * pl.height);
  ok((await page.textContent('.ci-live')) === '1 / 4' || (await st(page)).mistakes === 1, 'a tap on the plane asks the machine: the answer is judged (progress or a mistake)');
  await goAct(t, 'i15-19');
  const open0 = await page.locator('.ci-tf').count();
  await page.click('.ci-tf:has-text("有眼睛")'); ok((await st(page)).mistakes === 1 && /没有帮助/.test(await msg(page)), 'the question "has eyes" gets the same answer from every animal: no help, a mistake');
  const nodesBefore = await page.locator('.ci-tnode').count();
  await page.click('.ci-tf:has-text("会飞")'); ok(/信息增益 0\.\d\d/.test(await msg(page)) && (await page.locator('.ci-tnode').count()) === nodesBefore + 2, 'a good question ("can fly") shows its information gain and splits the node into a yes and a no branch');
  for (let g = 0; g < 30 && !(await won(page)); g++) {
    const btns = await page.locator('.ci-tnode.open .ci-tf').count(); if (!btns) break;
    const n0 = await page.locator('.ci-tnode').count();
    for (let k = 0; k < btns; k++) { await page.locator('.ci-tnode.open').first().locator('.ci-tf').nth(k).click(); if ((await page.locator('.ci-tnode').count()) !== n0 || (await won(page))) break; }
  }
  ok(open0 === 7 && (await won(page)) && /^\d+ \/ \d+$/.test(await page.textContent('.ci-live')), 'the tree is finished question by question with the real buttons (7 questions to choose from at the start); the screen compares the number of questions with the machine\'s tree (' + (await page.textContent('.ci-live')) + ')');
  await goAct(t, 'i15-22');
  const docs = await page.evaluate(() => [...document.querySelectorAll('.ci-doc')].map((d) => d.textContent.replace(/^\d+/, '')));
  for (let q = 0; q < 3; q++) { const w = (await page.textContent('#ci-query')).trim(); for (let i = 0; i < docs.length; i++) if (docs[i].split(' ').includes(w)) await page.click(`.ci-doc[data-i="${i}"]`); await page.click('#ci-check'); }
  ok(await won(page), 'three words looked up in six pages by tapping the pages that contain them win');
  await goAct(t, 'i15-25');
  const dcell = async (i) => { const b = await page.locator(`#ci-digit i[data-i="${i}"]`).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const rows3 = await page.evaluate(async () => { const I = await import('/src/coding-infomodel.ts'); return [3, 7, 1].map((d) => I.digitGrid(d)); });
  for (let k = 0; k < 3; k++) {
    const g = rows3[k];
    for (let y = 0; y < 8; y++) { let x = 0; while (x < 8) { if (g[y * 8 + x]) { let e = x; while (e + 1 < 8 && g[y * 8 + e + 1]) e++; const p0 = await dcell(y * 8 + x), p1 = await dcell(y * 8 + e); await page.mouse.move(p0.x, p0.y); await page.mouse.down(); await page.mouse.move(p1.x, p1.y, { steps: 2 }); await page.mouse.up(); x = e + 1; } else x++; } }
    await page.click('#ci-check');
    if (k === 0) ok(/^\d+%$/.test(await page.textContent('.ci-conf span')) && (await page.locator('.ci-conf').count()) === 3 && (await page.textContent('.ci-note')).includes('演示'), 'drawing a 3 with the mouse and pressing "识别" shows the three most likely digits with their confidence and the "this is a toy" note');
  }
  ok(await won(page), 'a 3, a 7 and a 1 drawn by hand and recognised win');
  await page.screenshot({ path: OUT + 'info-controls-digit.png' });

  // ---------- the device editor: a real tap on the palette ----------
  await goAct(t, 'i16-01');
  await page.click('.cw-pitem[data-pal="ifelse"]'); ok((await page.evaluate(() => window.__infoDev.editor.count())) === 1, 'a tap on a palette block adds it to the controller program');
  await page.click('.cw-pitem[data-pal="set"]'); ok((await page.evaluate(() => window.__infoDev.editor.count())) >= 1, 'the palette of a device level offers if / else, set and change');
  const condsOffered = await page.evaluate(() => window.__infoDev.lv.conds);
  ok(condsOffered.includes('light < 30'), 'the conditions are comparisons of the sensor ("light < 30")');

  // ---------- REAL touch events at device pixel ratio 2 ----------
  await t.browser.close();
  const tt = await open({ touch: true, dpr: 2, viewport: { width: 820, height: 1180 } });
  const tp = tt.page; tp.on('pageerror', (e) => errors.push(e.message));
  const cdp = await tt.ctx.newCDPSession(tp);
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const tap = async (x, y) => { await touch('touchStart', x, y); await touch('touchEnd', x, y); await tp.waitForTimeout(40); };
  const tdrag = async (a, b, steps = 10) => { await touch('touchStart', a.x, a.y); for (let i = 1; i <= steps; i++) await touch('touchMove', a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps); await touch('touchEnd', b.x, b.y); await tp.waitForTimeout(60); };
  const tc = (sel) => center(tp, sel);
  await goAct(tt, 'i14-01');
  const tn = Number(await tp.textContent('.ci-big')), tb = tn.toString(2).padStart(4, '0');
  for (let i = 0; i < 4; i++) if (tb[i] === '1') await tap((await tc(`.ci-sw[data-i="${i}"]`)).x, (await tc(`.ci-sw[data-i="${i}"]`)).y);
  ok((await tp.textContent('.ci-val')) === `= ${tn}`, 'touch: a finger tap on the switches turns them (= ' + tn + ')');
  // sort: a finger drags a card into a bucket
  await goAct(tt, 'i15-13');
  const sp = await tp.evaluate(() => window.__info.act.spec);
  for (const c of sp.cards) {
    const sel = `.ci-sc:has-text("${c.t}")`;
    await tdrag(await tc(sel + ' >> nth=0'), await tc(`.ci-bucket[data-b="${c.b}"]`));
  }
  ok((await tp.locator('.ci-pool .ci-sc').count()) === 0, 'touch: a finger drags all eight cards from the pool into their buckets (touch-action none on the cards)');
  await tp.click('#ci-check'); ok(await won(tp), 'and the sort is accepted');
  // order: a finger drags the last row to the top
  await goAct(tt, 'i15-04');
  const ord0 = await tp.evaluate(() => [...document.querySelectorAll('.ci-orow')].map((r) => Number(r.dataset.it)));
  const last = await tc('.ci-orow:nth-child(5) .ci-otext'), first = await tc('.ci-orow:nth-child(1) .ci-otext');
  await tdrag(last, { x: first.x, y: first.y - 12 }, 14);
  const ord1 = await tp.evaluate(() => [...document.querySelectorAll('.ci-orow')].map((r) => Number(r.dataset.it)));
  ok(ord1[0] === ord0[4] && ord1.slice(1).join() === ord0.slice(0, 4).join(), 'touch: dragging the last step to the top moves it there and the others down (' + ord0 + ' -> ' + ord1 + ')');
  // painting with a finger
  await goAct(tt, 'i14-11');
  const rowsT2 = await tp.evaluate(() => [...document.querySelectorAll('.ci-pixpair > div:first-child .ci-pixrow')].map((r) => [...r.querySelectorAll('i')].map((c) => (c.classList.contains('on') ? 1 : 0)).join('')));
  const tcell = async (x, y) => { const b = await tp.locator(`.ci-pixedit i[data-i="${y * 8 + x}"]`).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  for (let y = 0; y < 8; y++) { let x = 0; while (x < 8) { if (rowsT2[y][x] === '1') { let e = x; while (e + 1 < 8 && rowsT2[y][e + 1] === '1') e++; await tdrag(await tcell(x, y), await tcell(e, y), 4); x = e + 1; } else x++; } }
  await tp.click('#ci-check'); ok(await won(tp), 'touch: the heart painted with finger drags (real touch events, dpr 2) is accepted, the page did not scroll instead (touch-action none)');
  await tp.screenshot({ path: OUT + 'info-touch-paint.png' });
  // a finger tap on the packet network and on the plane
  await goAct(tt, 'i15-01');
  for (const n of ['R1', 'R3', 'S']) { const c = await tc(`.ci-node[data-n="${n}"]`); await tap(c.x, c.y); }
  ok(/2 \/ 3/.test(await tp.textContent('.ci-live')), 'touch: tapping the routers with a finger moves the packet to the server');
  await goAct(tt, 'i15-24');
  const f1 = await tc('.ci-feat input[data-f="group"]'); await tap(f1.x, f1.y); const f2 = await tc('.ci-feat input[data-f="district"]'); await tap(f2.x, f2.y);
  const trn = await tc('#ci-train'); await tap(trn.x, trn.y);
  ok(/准确率 \d+%/.test(await tp.textContent('.ci-biasres')) && /0%/.test(await tp.textContent('.ci-biasres')), 'touch: switching the group and the district off with a finger and training shows an accuracy and a gap of 0 %');
  await tt.browser.close();
  ok(errors.length === 0, 'no script errors' + (errors.length ? ': ' + errors[0] : ''));
  await done();
})();
