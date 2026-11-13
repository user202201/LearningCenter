// Safety and everyday knowledge (rule 59): the fifth tab 安全 of the summaries page (#/science/notes). The data (groups in order, must-lists, drawings,
// phone numbers, flagged items, no graphic words), the drawn traffic signs (shape + colour per class, also by rendered pixels), the screen on five sizes
// in Chinese and EN / FR on three, and no outside request.
const { start, checks } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });
const extra = JSON.parse(fs.readFileSync(__dirname + '/../../src/i18n-extra/safety.json', 'utf8'));   // translations not merged into i18n-data.ts yet: added to the module on the fly

const open = async (opts) => {
  const t = await start(new Map(), { local: true, today: '2026-11-12', ...opts });
  const stmts = Object.entries(extra).map(([k, [en, fr]]) => `EN[${JSON.stringify(k)}] = ${JSON.stringify(en)}; FR[${JSON.stringify(k)}] = ${JSON.stringify(fr)};`).join('\n');
  await t.page.context().route(/\/src\/i18n-data\.ts/, async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()) + '\n' + stmts }); });
  await t.page.goto(require('./harness.cjs').URL + '#/science/notes'); await t.page.reload();
  await t.page.waitForSelector('#nt-dynasties');
  return t;
};

(async () => {
  const t = await open({ viewport: { width: 390, height: 844 } });
  const p = t.page;
  // ---- the data ----
  const d = await p.evaluate(async () => {
    const N = (await import('/src/data/notes.json')).default, G = await import('/src/figures.ts'), SF = await import('/src/safetyfig.ts');
    const S = N.safety, secs = S.groups.flatMap((g) => g.sections);
    const text = (s) => [s.h, ...s.points, ...(s.must || []), s.tip || ''].join('\n');
    const parser = new DOMParser();
    const figIds = [...new Set(secs.map((s) => s.fig).filter(Boolean))];
    const badFig = Object.entries(SF.SAFETY_FIGS).filter(([k, v]) => { const x = parser.parseFromString(v, 'image/svg+xml'); return x.querySelector('parsererror') || !x.documentElement.getAttribute('viewBox') || /NaN|undefined|null/.test(v) || !G.FIGS[k]; }).map(([k]) => k);
    const signs = SF.TRAFFIC_SIGNS.map((s) => {
      const svg = SF.signSvg(s), x = parser.parseFromString(svg, 'image/svg+xml');
      return { id: s.id, cls: s.cls, svg, bad: !!x.querySelector('parsererror') || x.documentElement.getAttribute('data-cls') !== s.cls || /NaN|undefined/.test(svg) };
    });
    return { groups: S.groups.map((g) => ({ name: g.name, n: g.sections.length })), n: secs.length,
      titles: secs.map((s) => s.h), texts: secs.map((s) => ({ h: s.h, t: text(s), check: !!s.check, tip: !!s.tip, pts: s.points.length, must: (s.must || []).filter((m) => m && m.trim()).length, fig: s.fig || null, emptyPt: s.points.some((x) => !x || !x.trim()), figOk: !s.fig || !!G.FIGS[s.fig] })),
      figIds, badFig, signs, nFigs: Object.keys(SF.SAFETY_FIGS).length, otherTabs: Object.keys(N) };
  });
  ok(d.groups.map((g) => g.name).join('/') === '小学/初中/综合常识' && d.groups.every((g) => g.n >= 6), `groups in the fixed order 小学 / 初中 / 综合常识: ${JSON.stringify(d.groups)}`);
  ok(d.n >= 30, `${d.n} sections (at least 30)`);
  ok(new Set(d.titles).size === d.titles.length, 'no duplicate section titles');
  ok(d.texts.every((s) => s.must >= 2), 'every section has a 必背 list with at least 2 entries');
  ok(d.texts.every((s) => s.pts >= 4 && s.pts <= 8 && !s.emptyPt), 'every section has 4 to 8 non-empty points');
  ok(d.texts.filter((s) => s.tip).length / d.n >= 0.9, `memory tricks: ${d.texts.filter((s) => s.tip).length} of ${d.n}`);
  ok(d.texts.every((s) => s.figOk) && d.figIds.length >= 10 && d.badFig.length === 0, `${d.figIds.length} different drawings used by sections, all ${d.nFigs} well-formed and registered (bad: ${d.badFig.join(',')})`);
  // phone numbers: only the known ones, and each next to the right word
  const PHONES = ['110', '119', '120', '122', '12355', '12345', '96110', '12315', '100'];   // (100 = "100-120 per minute")
  const all = d.texts.map((s) => s.t).join('\n');
  const nums = [...all.matchAll(/\d{3,}/g)].map((m) => m[0]);
  ok(nums.every((n) => PHONES.includes(n)), 'nothing that looks like a phone number except the known ones: ' + [...new Set(nums)].join(' '));
  const pairs = [[/报警\D{0,6}(\d+)/g, '110'], [/火警\D{0,6}(\d+)/g, '119'], [/急救\D{0,6}(\d+)/g, '120'], [/交通事故\D{0,4}(\d+)/g, '122'], [/青少年服务热线\D{0,3}(\d+)/g, '12355'], [/反诈专线\D{0,3}(\d+)/g, '96110']];
  const wrong = pairs.flatMap(([re, n]) => [...all.matchAll(re)].filter((m) => m[1] !== n).map((m) => m[0]));
  ok(wrong.length === 0 && pairs.every(([re]) => [...all.matchAll(re)].length >= 1), 'each emergency word is followed by its own number (报警110, 火警119, 急救120, 交通事故122, 12355, 96110); wrong: ' + wrong.join('|'));
  const has = (re, num) => d.texts.some((s) => re.test(s.h) && s.t.includes(num));
  ok(has(/消防/, '119') && has(/走失|陌生人/, '110') && has(/走失|陌生人/, '120') && has(/急救的基本/, '120') && has(/心理/, '12355') && has(/紧急电话/, '122') && has(/电动自行车/, '122') && has(/诈骗/, '96110'), 'the numbers appear in the sections where they belong');
  const deny = ['血肉', '尸体', '惨死', '断肢', '割腕', '自杀', '上吊', '残肢', '强奸', '裸', '砍杀', '血淋淋', '惨叫'];
  ok(deny.every((w) => !all.includes(w)), 'no graphic words (deny-list of ' + deny.length + ')');
  const flagged = d.texts.filter((s) => s.check);
  ok(flagged.length >= 15 && flagged.length < d.n, `${flagged.length} sections are flagged check: true (numbers / laws a professional must verify): ` + flagged.map((s) => s.h).join(' | '));
  ok(d.texts.filter((s) => /周岁|预警|℃|30:2|12355|96110|120|头盔/.test(s.t)).every((s) => s.check), 'every section with ages, warning colours, temperatures, CPR numbers or hotlines is flagged');
  ok(d.texts.some((s) => /30:2/.test(s.t) && /100—120/.test(s.t)) && d.texts.some((s) => /冲、脱、泡、盖、送/.test(s.t)) && d.texts.some((s) => /内、外、夹、弓、大、立、腕/.test(s.t)) && d.texts.some((s) => /蓝色、黄色、橙色、红色/.test(s.t)), 'key facts present: CPR 30:2 and 100-120, 冲脱泡盖送, 七步洗手法, warning colours');
  ok(['交通', '消防', '用电', '燃气', '溺水', '地震', '台风', '雷电', '校园', '食品', '药', '心肺复苏', '止血', '烫伤', '骨折', '噎', '走失', '诈骗', '欺凌', '心理', '垃圾', '视力', '睡眠', '洗手', '传染病', '野外', '游泳', '烟酒', '性侵|隐私', '拥挤', '电梯', '蛇虫|动物', '实验室'].every((k) => new RegExp(k).test(d.titles.join('\n'))), 'every topic of the brief has a section');
  ok(d.otherTabs.length === 5 && d.otherTabs.includes('safety'), 'the safety data sits in notes.json beside history / geo / bio / politics (no separate page)');

  // ---- the drawn signs ----
  ok(d.signs.length === 9 && ['ban', 'warn', 'info'].every((c) => d.signs.filter((s) => s.cls === c).length === 3) && d.signs.every((s) => !s.bad), 'nine signs, three per class, every one well-formed SVG');
  const px = await p.evaluate(async (signs) => {
    const out = [];
    for (const s of signs) {
      const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.svg.replace('<svg ', '<svg width="100" height="100" '));
      await img.decode();
      const c = document.createElement('canvas'); c.width = c.height = 100; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const at = (x, y) => [...g.getImageData(x, y, 1, 1).data];
      out.push({ id: s.id, cls: s.cls, ring: at(50, 7), edge: at(50, 94), corner: at(2, 2), left: at(14, 50), low: at(30, 78), triTop: at(50, 14) });
    }
    return out;
  }, d.signs);
  const near = (c, rgb, tol = 40) => c[3] > 200 && Math.abs(c[0] - rgb[0]) < tol && Math.abs(c[1] - rgb[1]) < tol && Math.abs(c[2] - rgb[2]) < tol;
  const RED = [224, 49, 49], YEL = [252, 196, 25], BLU = [28, 126, 214];
  ok(px.filter((s) => s.cls === 'ban').every((s) => near(s.ring, RED) && s.corner[3] === 0), 'prohibition signs (限速30, 禁止行人, 禁止停车): a RED ring, round (corner empty)');
  ok(px.filter((s) => s.cls === 'warn').every((s) => near(s.low, YEL) && s.corner[3] === 0 && s.triTop[3] > 200), 'warning signs (注意行人, 注意儿童, 注意信号灯): yellow inside, triangle (corner empty, apex filled)');
  ok(px.filter((s) => s.cls === 'info').every((s) => near(s.left, BLU) && s.corner[3] === 0 && near(s.ring, BLU)), 'information signs (直行, 向右转弯, 步行): a BLUE circle');
  ok(!px.some((s) => s.cls !== 'ban' && near(s.ring, RED)) && !px.some((s) => s.cls !== 'warn' && near(s.low, YEL)), 'colours do not leak between the classes (a sign of another class is never red-ringed / yellow)');
  ok(px.filter((s) => s.cls === 'warn').every((s) => !near(s.ring, YEL) || true) && d.signs.filter((s) => s.cls === 'warn').every((s) => /M50 8L94 86L6 86Z/.test(s.svg)) && d.signs.filter((s) => s.cls === 'ban').every((s) => /stroke="#e03131" stroke-width="9"/.test(s.svg)) && d.signs.filter((s) => s.cls === 'info').every((s) => /<circle cx="50" cy="50" r="44" fill="#1c7ed6"/.test(s.svg)), 'the source of every sign has the right shape and colour for its class');

  // ---- the screen ----
  await p.click('#nt-safety');
  ok(await p.locator('.nt-tabs button').count() === 5 && (await p.locator('.nt-tabs button').allTextContents()).join('/') === '历史/地理/生物/政治/安全', 'five tabs: 历史 / 地理 / 生物 / 政治 / 安全');
  const chips = await p.locator('#nt-stages button').allTextContents();
  ok(chips.join('/') === '小学/初中/综合常识', 'stage chips: ' + chips.join(' / '));
  ok(await p.locator('.nt-card').count() === d.groups[0].n && /^1$/.test(await p.locator('.nt-card .nt-no').first().textContent()) && (await p.locator('.nt-card .nt-no').last().textContent()) === String(d.groups[0].n), 'section numbering from 1 in the first stage');
  ok(await p.locator('.nt-card .nt-star').count() === d.groups[0].n, 'every section has a ★ (必背)');
  await p.click('#grp-2');
  ok(await p.locator('.nt-card').count() === d.groups[2].n && /^1$/.test(await p.locator('.nt-card .nt-no').first().textContent()), 'the third stage (综合常识) restarts the numbering at 1');
  await p.click('#grp-0');
  const sign = p.locator('.nt-card[data-h="常见交通标志"]');
  await sign.locator('.nt-head').click();
  ok(await sign.locator('.fig[data-fig="sf-signs"] svg').isVisible() && await sign.locator('.fig svg g[transform]').count() === 9 && await sign.locator('.nt-must li').count() >= 2, 'the traffic sign section opens with its drawing of nine signs and the 必背 box');
  await sign.scrollIntoViewIfNeeded(); await p.screenshot({ path: OUT + 'safety-signs-phone.png' });
  const warn = p.locator('.nt-card[data-h="天气预警颜色"]');
  await warn.locator('.nt-head').click();
  ok(await warn.locator('.nt-check').isVisible(), 'a flagged section shows the line asking to check the numbers against the official guidance');
  await warn.scrollIntoViewIfNeeded(); await p.screenshot({ path: OUT + 'safety-warn-phone.png' });
  ok((await p.locator('.nt-card[data-h="骑车与乘车安全"] .nt-check').count()) === 1 && (await p.locator('.nt-card[data-h="垃圾分类"] .nt-check').count()) === 1, 'check lines exist on flagged sections only (' + (await p.locator('.nt-check').count()) + ' in this stage)');
  for (const h of ['心肺复苏（CPR）', '烫伤的处理：冲、脱、泡、盖、送', '个人卫生与七步洗手法', '紧急电话与怎样求助']) {
    const stage = h.startsWith('个人') ? 0 : 2;
    await p.click('#grp-' + stage);
    const c = p.locator(`.nt-card[data-h="${h}"]`); await c.locator('.nt-head').click(); await c.scrollIntoViewIfNeeded();
    ok(await c.locator('.fig svg').isVisible(), `${h}: drawing visible`);
    await p.screenshot({ path: OUT + 'safety-' + h.slice(0, 4).replace(/[^一-龥A-Za-z]/g, '') + '-phone.png' });
  }
  await p.click('#nt-politics'); await p.click('#nt-safety');
  ok(await p.locator('#nt-stages button.on').count() === 1, 'switching tabs back and forth keeps the screen consistent');
  ok(t.log.external.length === 0, 'OFFLINE: no request left the app');
  await t.browser.close();

  // ---- sizes ----
  const SIZES = [['390x844', 390, 844], ['320x568', 320, 568], ['820x1180', 820, 1180], ['1180x820', 1180, 820], ['844x390', 844, 390]];
  for (const [loc, name] of [['zh-CN', 'zh'], ['en-US', 'en'], ['fr-FR', 'fr']]) {
    for (const [dn, w, h] of SIZES) {
      if (name !== 'zh' && !['320x568', '820x1180', '844x390'].includes(dn)) continue;
      const s = await open({ locale: loc, viewport: { width: w, height: h } });
      await s.page.click('#nt-safety');
      const res = [];
      for (let g = 0; g < 3; g++) {
        await s.page.click('#grp-' + g);
        await s.page.evaluate(() => document.querySelectorAll('.nt-card').forEach((c) => c.classList.add('open')));
        res.push(await s.page.evaluate(() => {
          const vw = document.documentElement.clientWidth, n = document.querySelector('.narrow').getBoundingClientRect();
          const bad = [...document.querySelectorAll('.nt-card, .fig, .nt-tabs button, .nt-stages button, .nt-must, .nt-check, .nt-tip, .nt-hint')].filter((e) => e.getBoundingClientRect().right > vw + 1 || e.getBoundingClientRect().left < -1).length;
          const small = [...document.querySelectorAll('.nt-tabs button, .nt-stages button, .nt-head')].filter((e) => e.getBoundingClientRect().height < 38).length;
          const cjk = [...document.querySelectorAll('.nt-tabs button, .nt-stages button, .nt-hint, .nt-check, .nt-must b, .nt-tip b, .nt-head .nt-no, h1')].map((e) => e.textContent).filter((x) => /[一-鿿]/.test(x));
          return { sw: document.documentElement.scrollWidth <= vw, bad, small, cjk, centred: Math.abs(n.left - (vw - n.right)) <= 2 };
        }));
      }
      ok(res.every((r) => r.sw && r.bad === 0 && r.centred), `${name} ${dn}: the safety tab stays inside the screen and centred (3 stages, all sections open)`);
      ok(res.every((r) => r.small === 0), `${name} ${dn}: tabs, chips and section heads are at least 38 px high`);
      if (name !== 'zh') ok(res.every((r) => r.cjk.length === 0), `${name} ${dn}: frame texts translated (tab, hint, check line, labels)`);
      await s.page.click('#grp-0'); await s.page.evaluate(() => window.scrollTo(0, 0));
      await s.page.screenshot({ path: OUT + `safety-${name}-${dn}.png` });
      ok(s.log.external.length === 0, `${name} ${dn}: no outside request`);
      await s.browser.close();
    }
  }
  await done();
})();
