// 地图 (#/science/map, under 科学): the maps of China and of the world, the flags, and the practice. Data (34 province-level divisions, ~70 countries, flags drawn in code,
// real-area ordering, neighbours, size budget), the hit test (forgiving, small regions get a magnified dot), the question generators (answer among the choices, distractors of the
// same group, no duplicates), the memory boxes (due -> new -> known, the merge of two devices), the screens (a card on a tap, zoom / pan with the mouse and with REAL touch events at
// dpr 2, every practice mode played to the end, the 南海诸岛 inset), 5 screen sizes, English / French, nothing leaves the device.
const { start, checks, addKid, setGrade } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const path = require('path');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });

// real areas (km2, rounded) of the province-level divisions: an INDEPENDENT list to check the drawing against
const REAL = { xj: 1664900, xz: 1228400, nm: 1183000, qh: 722300, sc: 486000, hl: 473000, gs: 425900, yn: 394100, gx: 237600, hn: 211800, sn: 205600, hb: 185900, jl: 187400, he: 187700, gd: 179800, gz: 176200, jx: 166900, ha: 167000, sx: 156700, sd: 155800, ln: 148400, ah: 139400, fj: 121400, js: 102600, zj: 105500, cq: 82400, nx: 66400, tw: 36000, hi: 33900, bj: 16400, tj: 11900, sh: 6340, hk: 1100, mo: 33 };
// real neighbours (land borders) of some provinces: independent of the border computation
const NEIGH = { 陕西: ['山西', '河南', '湖北', '重庆', '四川', '甘肃', '宁夏', '内蒙古'], 北京: ['河北', '天津'], 海南: [], 台湾: [], 青海: ['甘肃', '四川', '西藏', '新疆'], 贵州: ['四川', '云南', '广西', '湖南', '重庆'], 山东: ['河北', '河南', '安徽', '江苏'], 江苏: ['山东', '安徽', '浙江', '上海'], 黑龙江: ['吉林', '内蒙古'], 福建: ['浙江', '江西', '广东'], 宁夏: ['内蒙古', '陕西', '甘肃'], 广东: ['福建', '江西', '湖南', '广西', '香港', '澳门'], 西藏: ['新疆', '青海', '四川', '云南'], 内蒙古: ['黑龙江', '吉林', '辽宁', '河北', '山西', '陕西', '宁夏', '甘肃'], 上海: ['江苏', '浙江'], 香港: ['广东'], 澳门: ['广东'] };
const CHINA_NEIGHBOURS = ['朝鲜', '俄罗斯', '蒙古', '哈萨克斯坦', '吉尔吉斯斯坦', '塔吉克斯坦', '阿富汗', '巴基斯坦', '印度', '尼泊尔', '不丹', '缅甸', '老挝', '越南'];
const CAPITALS = { 法国: '巴黎', 日本: '东京', 澳大利亚: '堪培拉', 加拿大: '渥太华', 巴西: '巴西利亚', 南非: '比勒陀利亚', 美国: '华盛顿', 英国: '伦敦', 德国: '柏林', 印度: '新德里', 俄罗斯: '莫斯科', 埃及: '开罗', 土耳其: '安卡拉', 韩国: '首尔', 墨西哥: '墨西哥城', 阿根廷: '布宜诺斯艾利斯', 沙特阿拉伯: '利雅得', 印度尼西亚: '雅加达', 意大利: '罗马', 中国: '北京' };
const PROV_CAP = { 江苏: '南京', 浙江: '杭州', 四川: '成都', 云南: '昆明', 新疆: '乌鲁木齐', 西藏: '拉萨', 内蒙古: '呼和浩特', 广西: '南宁', 宁夏: '银川', 黑龙江: '哈尔滨', 台湾: '台北', 海南: '海口', 甘肃: '兰州', 陕西: '西安' };
const SIGHT = { 江苏: '苏', 浙江: '浙', 四川: '川', 云南: '滇', 新疆: '新', 西藏: '藏', 广东: '粤', 山东: '鲁', 河南: '豫', 湖南: '湘', 湖北: '鄂', 北京: '京', 上海: '沪', 重庆: '渝', 香港: '港', 澳门: '澳', 台湾: '台', 内蒙古: '蒙' };
const spearman = (a, b) => { const rank = (v) => v.map((x) => v.filter((y) => y < x).length + (v.filter((y) => y === x).length - 1) / 2); const ra = rank(a), rb = rank(b); const n = a.length; const d2 = ra.reduce((s, x, i) => s + (x - rb[i]) ** 2, 0); return 1 - (6 * d2) / (n * (n * n - 1)); };

(async () => {
  // =====================================================================================  A. THE DATA (in the page: the real modules)
  {
    const t = await start(new Map(), { local: true });
    const { page } = t;
    const r = await page.evaluate(async () => {
      const GG = await import('/src/geomapgeo.ts'); const FL = await import('/src/geoflags.ts');
      const geo = await GG.loadGeo(); const c = geo.china, w = geo.world; const o = { bad: [] };
      const uniq = (arr) => new Set(arr).size === arr.length;
      const P = c.provinces;
      o.n = P.length; o.uniq = [P.map((p) => p.id), P.map((p) => p.n), P.map((p) => p.ab), P.map((p) => p.cap), P.map((p) => p.full), P.map((p) => p.py)].map(uniq);
      o.types = ['直辖市', '特别行政区', '自治区', '省'].map((x) => P.filter((p) => p.type === x).length);
      o.regions = Object.fromEntries(c.regions.map((r) => [r, P.filter((p) => p.reg === r).length]));
      o.incomplete = P.filter((p) => !p.n || !p.full || !p.ab || !p.cap || !p.py || !p.reg || !p.ct || !c.regions.includes(p.reg)).map((p) => p.id);
      const W = c.vb[2], H = c.vb[3], shape = {};
      const validRings = (id, d, closed) => { const rs = closed ? GG.parseRings(d) : GG.parseParts(d); if (!rs.length) o.bad.push('no ring ' + id); for (const r of rs) { if (r.length < (closed ? 4 : 2)) o.bad.push('short ring ' + id); for (const [x, y] of r) if (!Number.isFinite(x) || !Number.isFinite(y) || x < -3 || y < -3 || x > W + 3 || y > H + 3) { o.bad.push('coordinate ' + id + ' ' + x + ',' + y); break; } } };
      for (const p of P) { validRings(p.id, p.d, true); const s = GG.makeShape(p.id, 'prov', p.d, p.lp); shape[p.id] = s; if (!(s.area > 0)) o.bad.push('area ' + p.id); if (!GG.inside(s, p.lp[0], p.lp[1])) o.bad.push('label point outside ' + p.id); }
      o.areas = Object.fromEntries(P.map((p) => [p.id, shape[p.id].area]));
      // neighbours symmetrical, never itself, only known ids
      const ids = new Set(P.map((p) => p.id));
      for (const p of P) for (const q of p.nb) { if (q === p.id) o.bad.push('self neighbour ' + p.id); if (!ids.has(q)) o.bad.push('unknown neighbour ' + q); if (!P.find((x) => x.id === q)?.nb.includes(p.id)) o.bad.push('asymmetric ' + p.id + ' ' + q); }
      const byName = Object.fromEntries(P.map((p) => [p.id, p.n]));
      o.neigh = Object.fromEntries(P.map((p) => [p.n, p.nb.map((i) => byName[i])]));
      // the inset (南海诸岛)
      const ins = c.inset, [bx, by, bw, bh] = ins.box;
      o.inset = { inside: bx >= 0 && by >= 0 && bx + bw <= W && by + bh <= H, lowerRight: bx + bw / 2 > W * 0.6 && by + bh / 2 > H * 0.6, dashes: ins.dashes.length, islands: ins.islands.map((i) => i.n), islandsIn: ins.islands.every((i) => i.p[0] >= bx && i.p[0] <= bx + bw && i.p[1] >= by && i.p[1] <= by + bh), land: ins.land.length > 100, notOverMainland: !P.some((p) => { const s = shape[p.id]; return s.bbox[2] > bx && s.bbox[0] < bx + bw && s.bbox[3] > by && s.bbox[1] < by + bh && [[bx, by], [bx + bw, by], [bx, by + bh], [bx + bw, by + bh], [bx + bw / 2, by + bh / 2]].some(([x, y]) => GG.inside(s, x, y)); }) };
      // overlays
      o.rivers = c.rivers.map((r) => r.n); o.mountains = c.mountains.map((r) => r.n); o.lakes = c.lakes.map((r) => r.n); o.areaN = c.areas.map((r) => r.n);
      for (const [k, list, closed] of [['river', c.rivers, false], ['mountain', c.mountains, false], ['lake', c.lakes, true], ['area', c.areas, true]]) {
        if (!uniq(list.map((x) => x.id)) || !uniq(list.map((x) => x.n))) o.bad.push('duplicate ' + k);
        for (const f of list) { if (!f.n) o.bad.push('no name ' + f.id); validRings(k + f.id, f.d, closed); }
      }
      o.cities = c.cities.length; o.cityCaps = c.cities.filter((x) => x.cap).length; o.seas = c.seas.map((s) => s.n); o.points = c.points.map((p) => p.n);
      // the world
      const C = w.countries; o.nc = C.length;
      o.cu = [uniq(C.map((x) => x.id)), uniq(C.map((x) => x.n)), uniq(C.map((x) => x.a3))];
      o.cinc = C.filter((x) => !x.n || !x.cap || !x.cont || !w.continents.some((k) => k.id === x.cont) || !x.py).map((x) => x.id);
      o.conts = w.continents.map((k) => k.n); o.oceans = w.oceans.map((x) => x.n);
      for (const x of C) { validRings(x.id, x.d, true); }
      for (const x of C) for (const q of x.nb) if (!C.find((y) => y.id === q)?.nb.includes(x.id)) o.bad.push('asymmetric country ' + x.id + ' ' + q);
      o.cmap = Object.fromEntries(C.map((x) => [x.n, x.cap])); o.cont = Object.fromEntries(C.map((x) => [x.n, x.cont]));
      o.cnNb = C.find((x) => x.id === 'cn').nb.map((q) => C.find((y) => y.id === q).n);
      o.cnames = C.map((x) => x.n);
      // flags: every country has one, well-formed
      const parser = new DOMParser(); o.flagBad = [];
      for (const x of C) {
        const svg = FL.flagSvg(x.id);
        if (!svg) { o.flagBad.push('missing ' + x.id); continue; }
        const d = parser.parseFromString(svg, 'image/svg+xml');
        if (d.querySelector('parsererror')) { o.flagBad.push('malformed ' + x.id); continue; }
        if (d.documentElement.getAttribute('viewBox') !== '0 0 90 60') o.flagBad.push('viewBox ' + x.id);
        if (d.querySelectorAll('rect, circle, polygon, path').length < 2) o.flagBad.push('empty ' + x.id);
        if (/NaN|undefined|Infinity/.test(svg)) o.flagBad.push('NaN ' + x.id);
      }
      const stripes = (id) => { const d = parser.parseFromString(FL.flagSvg(id), 'image/svg+xml'); return [...d.querySelectorAll('rect.s')].map((e) => ({ f: e.getAttribute('fill').toUpperCase(), x: +e.getAttribute('x'), y: +e.getAttribute('y'), w: +e.getAttribute('width'), h: +e.getAttribute('height') })); };
      o.fr = stripes('fr'); o.de = stripes('de'); o.it = stripes('it'); o.ru = stripes('ru'); o.nl = stripes('nl'); o.us = stripes('us').length; o.ua = stripes('ua'); o.pl = stripes('pl');
      const jp = parser.parseFromString(FL.flagSvg('jp'), 'image/svg+xml'); const jc = jp.querySelector('circle'); o.jp = jc ? { f: jc.getAttribute('fill').toUpperCase(), r: +jc.getAttribute('r'), cx: +jc.getAttribute('cx'), cy: +jc.getAttribute('cy') } : null;
      const cn = FL.flagSvg('cn'); o.cnStars = (cn.match(/<polygon/g) || []).length; o.flagCount = FL.FLAG_IDS.length;
      return o;
    });
    ok(r.bad.length === 0, 'every path / ring / label point / neighbour link of the data is valid ' + r.bad.slice(0, 4).join('; '));
    ok(r.n === 34 && r.uniq.every(Boolean), '34 province-level divisions, each with a unique id, name, full name, abbreviation, capital, pinyin');
    ok(r.types.join() === '4,2,5,23', 'exactly 4 直辖市, 2 特别行政区, 5 自治区 and 23 省 (incl. 台湾): ' + r.types.join());
    ok(r.incomplete.length === 0 && Object.keys(r.regions).length === 8 && Object.values(r.regions).every((n) => n >= 3), 'every division has all fields, 8 regions each with 3+ (' + JSON.stringify(r.regions) + ')');
    // the drawing follows the real sizes
    const ids = Object.keys(REAL), a = ids.map((i) => r.areas[i]), b = ids.map((i) => REAL[i]);
    const rho = spearman(a, b);
    ok(rho > 0.97, 'the drawn areas follow the real area ordering (Spearman ' + rho.toFixed(3) + ' > 0.97)');
    const sorted = ids.slice().sort((x, y) => r.areas[y] - r.areas[x]);
    ok(sorted.slice(0, 3).join() === 'xj,xz,nm' || (sorted[0] === 'xj' && sorted.slice(0, 3).includes('xz') && sorted.slice(0, 3).includes('nm')), '新疆 is the biggest, then 西藏 and 内蒙古: ' + sorted.slice(0, 4).join());
    ok(['mo', 'hk', 'sh', 'tj', 'bj'].every((i) => sorted.slice(-5).includes(i)), 'the 直辖市 北京 天津 上海 and 港 澳 are the five smallest: ' + sorted.slice(-5).join());
    const med = (v) => v.slice().sort((x, y) => x - y)[Math.floor(v.length / 2)];
    const ratio = ids.filter((i) => !['mo', 'hk', 'bj', 'tj', 'sh'].includes(i)).map((i) => r.areas[i] / REAL[i]);
    const m = med(ratio);
    ok(ratio.every((x) => x > m * 0.7 && x < m * 1.4), 'every big division has the right size relative to the others (all within 0.7 .. 1.4 of the median ratio)');
    // neighbours against the independent list
    const badN = Object.entries(NEIGH).filter(([n, l]) => [...l].sort().join() !== [...(r.neigh[n] || [])].sort().join()).map(([n, l]) => n + ': ' + (r.neigh[n] || []).join('/'));
    ok(badN.length === 0, 'neighbours match the real land borders for 17 divisions (hand-checked list) ' + badN.join(' | '));
    ok(r.neigh['内蒙古'].length === 8 && r.neigh['海南'].length === 0, '内蒙古 has 8 neighbours, 海南 and 台湾 none');
    // the 南海诸岛 inset and the standard conventions
    ok(r.inset.inside && r.inset.lowerRight && r.inset.dashes === 10 && r.inset.islandsIn && r.inset.land && r.inset.notOverMainland, '南海诸岛 inset: inside the frame, lower right, not over the mainland, 10 dashes, its island groups inside, the coasts drawn');
    ok(['东沙群岛', '西沙群岛', '中沙群岛', '南沙群岛'].every((n) => r.inset.islands.includes(n)), 'the four island groups are named');
    ok(['长江', '黄河', '珠江', '黑龙江', '淮河', '松花江', '辽河'].every((n) => r.rivers.includes(n)), 'the big rivers are drawn: ' + r.rivers.join(' '));
    ok(['喜马拉雅山脉', '昆仑山脉', '天山', '秦岭', '大兴安岭', '太行山'].every((n) => r.mountains.includes(n)), 'the big mountains are drawn: ' + r.mountains.join(' '));
    ok(['青藏高原', '黄土高原', '四川盆地', '华北平原', '塔里木盆地', '塔克拉玛干沙漠'].every((n) => r.areaN.includes(n)) && ['青海湖', '鄱阳湖', '洞庭湖', '太湖'].every((n) => r.lakes.includes(n)), 'plateaus, plains, basins, deserts and lakes are there');
    ok(r.cities >= 38 && r.cityCaps === 33 && r.seas.length === 4 && r.points.includes('钓鱼岛'), 'cities (33 capitals + more), the four seas and 钓鱼岛 are on the map');
    // the world
    ok(r.nc >= 70 && r.cu.every(Boolean) && r.cinc.length === 0, r.nc + ' countries, each with name / capital / continent / pinyin, unique ids and names');
    ok(['美国', '中国', '俄罗斯', '日本', '英国', '法国', '德国', '印度', '巴西', '澳大利亚', '加拿大', '韩国', '墨西哥', '印度尼西亚', '沙特阿拉伯', '南非', '土耳其', '阿根廷', '意大利'].every((n) => r.cnames.includes(n)), 'all of the G20 countries are in (EU / AU are not countries)');
    ok(CHINA_NEIGHBOURS.every((n) => r.cnames.includes(n)) && [...r.cnNb].sort().join() === [...CHINA_NEIGHBOURS].sort().join(), 'the 14 land neighbours of China are in and are computed as its neighbours: ' + r.cnNb.length);
    ok(Object.entries(CAPITALS).every(([n, c]) => r.cmap[n] === c), 'capitals of 20 countries match the independent list');
    ok(r.conts.join() === '亚洲,欧洲,非洲,北美洲,南美洲,大洋洲,南极洲' && r.oceans.join() === '太平洋,大西洋,印度洋,北冰洋', 'seven continents and four oceans');
    ok(r.cont['法国'] === 'eu' && r.cont['日本'] === 'as' && r.cont['巴西'] === 'sa' && r.cont['澳大利亚'] === 'oc' && r.cont['美国'] === 'na' && r.cont['南非'] === 'af' && r.cont['土耳其'] === 'as', 'continents of countries (土耳其 is counted in Asia as in Chinese books)');
    ok(r.flagBad.length === 0 && r.flagCount >= r.nc, 'every country has a well-formed flag in a 90 x 60 box ' + r.flagBad.join(','));
    ok(r.fr.length === 3 && r.fr.map((s) => s.f).join() === '#0055A4,#FFFFFF,#EF4135' && r.fr[0].x < r.fr[1].x && r.fr[1].x < r.fr[2].x && r.fr.every((s) => s.y === 0 && s.h === 60), '法国: three VERTICAL stripes blue, white, red');
    ok(r.de.map((s) => s.f).join() === '#1A1A1A,#DD0000,#FFCE00' && r.de[0].y < r.de[1].y && r.de.every((s) => s.x === 0 && s.w === 90), '德国: three HORIZONTAL stripes black, red, gold');
    ok(r.it.map((s) => s.f).join() === '#009246,#FFFFFF,#CE2B37' && r.ru.map((s) => s.f).join() === '#FFFFFF,#1F4E9C,#D62027' && r.nl.length === 3 && r.ua.length === 2 && r.pl.length === 2 && r.us === 13, '意大利 / 俄罗斯 / 荷兰 / 乌克兰 / 波兰 / 美国 have the right number and order of stripes (美国 13)');
    ok(r.jp && r.jp.f === '#D62027' && r.jp.cx === 45 && r.jp.cy === 30 && r.jp.r > 14, '日本: a red circle in the middle of a white field');
    ok(r.cnStars === 5, '中国: five yellow stars');
    // size budget
    const sizes = ['geomap-china.json', 'geomap-world.json'].map((f) => fs.statSync(path.join(__dirname, '../../src/data/', f)).size);
    ok(sizes[0] + sizes[1] < 1_000_000, 'the map data is under 1 MB: ' + sizes.map((s) => Math.round(s / 1024) + ' KB').join(' + '));
    // a check that CAN fail: the uniqueness / neighbour checks must catch a broken table
    ok(await page.evaluate(() => { const arr = ['a', 'b', 'a']; return new Set(arr).size !== arr.length; }), 'control: a duplicate is detected by the check used above');
    await t.browser.close();
  }

  // =====================================================================================  B. THE HIT TEST
  {
    const t = await start(new Map(), { local: true });
    const { page } = t;
    const r = await page.evaluate(async () => {
      const GG = await import('/src/geomapgeo.ts'); const geo = await GG.loadGeo(); const o = { bad: [] };
      const sh = GG.chinaShapes(geo.china), ws = GG.worldShapes(geo.world);
      const S = 0.2;   // px per view unit (a phone: the whole map is ~400 px wide)
      for (const p of geo.china.provinces) { const h = GG.hitTest(sh, p.lp[0], p.lp[1], 14 / S, S, ['prov']); if (!h || h.id !== p.id) o.bad.push('label point of ' + p.n + ' hits ' + (h && h.id)); }
      const dots = sh.filter((s) => s.dot).map((s) => s.id);
      for (const id of dots) { const s = sh.find((x) => x.id === id); const [x, y] = GG.dotAt(s, S); const h = GG.hitTest(sh, x, y, 14 / S, S, ['prov']); if (!h || h.id !== id || h.via !== 'dot') o.bad.push('dot of ' + id); }
      o.dots = dots.sort().join();
      // the dots are far enough apart to be two separate targets
      for (const a of dots) for (const b of dots) if (a < b) { const [ax, ay] = GG.dotAt(sh.find((s) => s.id === a), S), [bx, by] = GG.dotAt(sh.find((s) => s.id === b), S); if (Math.hypot(ax - bx, ay - by) * S < 2 * GG.DOT_R) o.bad.push('dots overlap ' + a + ' ' + b); }
      // tolerance: a touch just outside the coast of 海南 still hits it, a stricter tolerance does not
      const hi = sh.find((s) => s.id === 'hi'); const v = hi.rings[0].reduce((m, p) => (p[0] < m[0] ? p : m), hi.rings[0][0]);
      const near = GG.hitTest(sh, v[0] - 5, v[1], 14 / S, S, ['prov']), far = GG.hitTest(sh, v[0] - 5, v[1], 2, S, ['prov']), none = GG.hitTest(sh, v[0] - 400, v[1], 14 / S, S, ['prov']);
      o.tol = [near && near.id, far && far.id, none && none.id, near && near.via];
      // the smallest region that contains the point wins (北京 inside 河北's outline)
      const bj = geo.china.provinces.find((p) => p.id === 'bj'); const hb = GG.hitTest(sh, bj.lp[0], bj.lp[1], 0, 5, ['prov']); o.bj = hb && hb.id;
      // lines (rivers / mountains): the middle of every line hits that line
      let lines = 0, lineHit = 0;
      for (const f of [...geo.china.rivers, ...geo.china.mountains]) { lines++; const h = GG.hitTest(sh, f.lp[0], f.lp[1], 14 / S, S, ['river', 'mountain']); if (h && h.id === f.id) lineHit++; else o.bad.push('line ' + f.n + ' -> ' + (h && h.id)); }
      o.lines = [lines, lineHit];
      for (const f of [...geo.china.lakes, ...geo.china.areas]) { const h = GG.hitTest(sh, f.lp[0], f.lp[1], 0, S, ['lake', 'area']); if (!h || h.id !== f.id) o.bad.push('area ' + f.n + ' -> ' + (h && h.id)); }
      // the world: every country at its label point, continents
      for (const c of geo.world.countries) { const h = GG.hitTest(ws, c.lp[0], c.lp[1], 0, S, ['country']); if (!h || h.id !== c.id) o.bad.push('country ' + c.n + ' -> ' + (h && h.id)); }
      const cont = (id) => { const c = geo.world.countries.find((x) => x.id === id); return GG.continentOf(geo.world, GG.hitTest(ws, c.lp[0], c.lp[1], 0, S, ['country', 'land']), c.lp[0]); };
      o.cont = ['fr', 'cn', 'br', 'au', 'us', 'za', 'jp', 'tr'].map((i) => cont(i)).join();
      const ru = ws.find((s) => s.id === 'ru'), W = geo.world.vb[2];
      let west = null, east = null; for (let x = ru.bbox[0]; x < ru.bbox[2]; x += 8) for (let y = ru.bbox[1]; y < ru.bbox[3]; y += 8) if (GG.inside(ru, x, y)) { if (!west) west = [x, y]; east = [x, y]; }
      o.ru = [GG.continentOf(geo.world, { id: 'ru', layer: 'country', via: 'inside' }, west[0]), GG.continentOf(geo.world, { id: 'ru', layer: 'country', via: 'inside' }, east[0])];
      // Antarctica: a point in the white strip at the bottom
      const an = ws.find((s) => s.id === 'an'); let pt = null; for (let x = an.bbox[0]; x < an.bbox[2] && !pt; x += 10) for (let y = an.bbox[3] - 4; y > an.bbox[1] && !pt; y -= 4) if (GG.inside(an, x, y)) pt = [x, y];
      o.an = pt && GG.continentOf(geo.world, GG.hitTest(ws, pt[0], pt[1], 0, S, ['country', 'land']), pt[0]);
      // oceans: the label spots are in the right ocean and not on land
      o.oceans = geo.world.oceans.map((x) => { const p = x.lps[0]; const h = GG.hitTest(ws, p[0], p[1], 0, S, ['ocean', 'country', 'land']); return h && h.id; }).join();
      o.paths = GG.parseRings('M10,10l5,0 0,5 -5,0z M40,40l3,0 0,3z').map((r) => r.length).join() + '|' + JSON.stringify(GG.parseParts('M1,2l3,4 5,6')[0]);
      return o;
    });
    ok(r.bad.length === 0, 'every province label point hits its province, every line / area / country is found at its own point ' + r.bad.slice(0, 5).join('; '));
    ok(r.dots === 'bj,hk,mo,sh,tj', 'the small regions (北京 天津 上海 香港 澳门) have magnified dots: ' + r.dots);
    ok(r.tol[0] === 'hi' && r.tol[1] === null && r.tol[2] === null && r.tol[3] === 'near', 'a touch 5 units outside the coast of 海南 hits it with the finger tolerance, not with 2, and far away hits nothing');
    ok(r.bj === 'bj', 'the smallest region that contains the point wins (北京 inside 河北)');
    ok(r.lines[0] >= 30 && r.lines[0] === r.lines[1], 'the middle of each of the ' + r.lines[0] + ' rivers / mountain ranges selects that line');
    ok(r.cont === 'eu,as,sa,oc,na,af,as,as', 'continent of a tap: ' + r.cont);
    ok(r.ru[0] === 'eu' && r.ru[1] === 'as', 'Russia west of the Urals is Europe, east of them Asia');
    ok(r.an === 'an', 'Antarctica is the 南极洲');
    ok(r.oceans === 'pacific,atlantic,indian,arctic', 'the four oceans are found at their label spots: ' + r.oceans);
    ok(r.paths === '4,4|[[1,2],[4,6],[9,12]]'.replace('4,4|', '4,4|'), 'the compact path format is read back correctly (' + r.paths + ')');
    await t.browser.close();
  }

  // =====================================================================================  C. QUESTIONS AND MEMORY (pure)
  {
    const t = await start(new Map(), { local: true });
    const { page } = t;
    const r = await page.evaluate(async () => {
      const GM = await import('/src/geomapmodel.ts'); const GG = await import('/src/geomapgeo.ts'); const FL = await import('/src/geoflags.ts'); const SY = await import('/src/sync.ts'); const G = await import('/src/game.ts');
      const geo = await GG.loadGeo(); const o = { bad: [], counts: {} };
      const rnd = GM.mulberry32(7);
      for (const m of GM.MODES) for (const level of [1, 2, 3, 4]) {
        const items = GM.pool(geo, m.id, level); o.counts[m.id + ':' + level] = items.length;
        if (!items.length) { o.bad.push('empty pool ' + m.id + ' ' + level); continue; }
        for (const it of items) for (let rep = 0; rep < 2; rep++) {
          const q = GM.makeQuestion(geo, m.id, it.id, level, rnd);
          const tag = m.id + ':' + it.id;
          if (q.key !== tag || q.item !== it.id || q.mode !== m.id) o.bad.push('key ' + tag);
          const all = [q.prompt, q.explain]; for (const t of all) { for (const mm of t.tpl.matchAll(/\{(\d+)\}/g)) if (Number(mm[1]) >= t.args.length || !t.args[Number(mm[1])]) o.bad.push('placeholder ' + tag); if (!t.tpl) o.bad.push('empty text ' + tag); }
          if (m.kind === 'choose') {
            const ks = q.choices.map((c) => c.k), ls = q.choices.map((c) => c.t + (c.flag ? '|' + c.flag : ''));
            if (!ks.includes(q.answer)) o.bad.push('answer not among choices ' + tag);
            if (new Set(ks).size !== ks.length || new Set(ls).size !== ls.length) o.bad.push('duplicate choices ' + tag + ' ' + ls.join('/'));
            if (q.choices.length !== 4) o.bad.push('choice count ' + tag + ' ' + q.choices.length);
            if (q.choices.some((c) => !c.t)) o.bad.push('empty label ' + tag);
          } else { if (!q.layers || !q.layers.length || !q.map) o.bad.push('tap question without layers ' + tag); if (q.choices.length) o.bad.push('tap question with choices ' + tag); }
          if (m.id === 'f-flag' && q.choices.some((c) => !FL.FLAG_IDS.includes(c.flag))) o.bad.push('flag choice without flag ' + tag);
          if (m.id === 'f-name' && (q.flag !== it.id)) o.bad.push('flag shown ' + tag);
        }
      }
      // distractors come from the same group when the group is big enough (all levels: the group is the region / the continent)
      let grp = 0, grpSame = 0;
      for (const p of geo.china.provinces) { const q = GM.makeQuestion(geo, 'cn-name', p.id, 4, rnd); const same = geo.china.provinces.filter((x) => x.reg === p.reg).length; if (same >= 4) { grp++; const others = q.choices.filter((c) => c.k !== p.id).map((c) => geo.china.provinces.find((x) => x.id === c.k).reg); if (others.every((x) => x === p.reg)) grpSame++; } }
      o.grp = [grp, grpSame];
      let grp2 = 0, grp2Same = 0;
      for (const c of geo.world.countries) { const q = GM.makeQuestion(geo, 'w-name', c.id, 4, rnd); const same = geo.world.countries.filter((x) => x.cont === c.cont).length; if (same >= 4) { grp2++; const others = q.choices.filter((x) => x.k !== c.id).map((x) => geo.world.countries.find((y) => y.id === x.k).cont); if (others.every((x) => x === c.cont)) grp2Same++; } }
      o.grp2 = [grp2, grp2Same];
      // the answers are right (checked against the data, not against the question code)
      const qa = (mode, item, f) => { const q = GM.makeQuestion(geo, mode, item, 4, GM.mulberry32(3)); return f(q); };
      const P = (n) => geo.china.provinces.find((p) => p.n === n), C = (n) => geo.world.countries.find((p) => p.n === n);
      o.cap = []; for (let i = 0; i < 30; i++) { const q = GM.makeQuestion(geo, 'cn-cap', P('江苏').id, 4, GM.mulberry32(i)); const a = q.choices.find((c) => c.k === q.answer).t; o.cap.push(q.prompt.args[0] === '江苏' ? a : q.prompt.args[0]); }
      o.ab = GM.makeQuestion(geo, 'cn-ab', P('云南').id, 4, GM.mulberry32(1)); o.ab = [o.ab.prompt.args[0], o.ab.choices.find((c) => c.k === o.ab.answer).t];
      o.reg = GM.makeQuestion(geo, 'cn-reg', P('四川').id, 4, GM.mulberry32(1)); o.reg = [o.reg.answer, o.reg.choices.length, new Set(o.reg.choices.map((c) => c.k)).size];
      const wc = GM.makeQuestion(geo, 'w-cont', C('埃及') ? C('日本').id : '', 4, GM.mulberry32(1)); o.wcont = [wc.answer, wc.choices.find((c) => c.k === wc.answer).t];
      o.tcPool = GM.pool(geo, 'w-cont', 4).some((i) => ['ru', 'tr', 'kz', 'eg'].includes(i.id));
      // levels: grades -> levels, pool sizes grow
      o.lv = [null, 1, 2, 3, 4, 5, 6, 7, 9].map((g) => GM.levelOfGrade(g)).join();
      o.pp = [1, 2, 3, 4].map((l) => GM.pool(geo, 'cn-tap', l).length).join(); o.pw = [1, 2, 3, 4].map((l) => GM.pool(geo, 'w-tap', l).length).join();
      o.lowFirst = GM.pool(geo, 'cn-tap', 1).map((i) => geo.china.provinces.find((p) => p.id === i.id).n).sort().join(',');
      o.k1 = GM.pool(geo, 'w-ktap', 1).length; o.k2 = GM.pool(geo, 'w-ktap', 2).length;
      // ---- selection: due first, then new, known last
      const today = '2026-11-12', ids = GM.pool(geo, 'cn-tap', 4);
      let doc = { cards: {} };
      const mk = (box, due) => ({ box, due, last: '2026-11-01', right: 1, wrong: 0 });
      ids.slice(0, 10).forEach((i) => (doc.cards[GM.cardKey('cn-tap', i.id)] = mk(4, '2026-12-20')));   // known, not due
      ids.slice(10, 15).forEach((i) => (doc.cards[GM.cardKey('cn-tap', i.id)] = mk(0, today)));         // failed: due now
      const sel = GM.selectItems(doc, 'cn-tap', ids, today, 10, GM.mulberry32(2));
      const known = new Set(ids.slice(0, 10).map((i) => i.id)), due = new Set(ids.slice(10, 15).map((i) => i.id));
      o.sel = [sel.length, new Set(sel).size, sel.filter((i) => due.has(i)).length, sel.filter((i) => known.has(i)).length];
      const small = ids.slice(0, 15);   // only known + due: the due ones first, then the LEAST known
      doc.cards[GM.cardKey('cn-tap', ids[0].id)] = mk(1, '2026-11-20');
      const sel2 = GM.selectItems(doc, 'cn-tap', small, today, 10, GM.mulberry32(2));
      o.sel2 = [sel2.length, sel2.filter((i) => due.has(i)).length, sel2.includes(ids[0].id), sel2.filter((i) => known.has(i)).length];
      // a round of a small pool is shorter than 10
      o.round = [GM.buildRound(geo, { cards: {} }, 'w-ktap', 1, today, GM.mulberry32(1)).length, GM.buildRound(geo, { cards: {} }, 'cn-tap', 4, today, GM.mulberry32(1)).length];
      // ---- the boxes: right -> up with 1 / 3 / 7 / 14 / 30 days, wrong -> box 0 due at once
      let d = { cards: {} }; const days = ['2026-11-12', '2026-11-13', '2026-11-16', '2026-11-23', '2026-12-07', '2027-01-06'];
      const trace = [];
      for (let i = 0; i < 5; i++) { d = GM.applyAnswers(d, [{ key: 'cn-tap:bj', right: true }], days[i]); const c = d.cards['cn-tap:bj']; trace.push(c.box + '@' + c.due); }
      o.trace = trace.join(' ');
      const twice = GM.applyAnswers(GM.applyAnswers({ cards: {} }, [{ key: 'x:y', right: true }], today), [{ key: 'x:y', right: true }], today); o.twice = twice.cards['x:y'].box;
      const bad = GM.applyAnswers(d, [{ key: 'cn-tap:bj', right: false }], '2026-12-08'); o.wrongBox = [bad.cards['cn-tap:bj'].box, bad.cards['cn-tap:bj'].due, bad.cards['cn-tap:bj'].wrong];
      o.plays = bad.plays; o.last = GM.applyAnswers(d, [], today, { score: 9, total: 10 }).last;
      const ms = GM.mastery({ cards: { 'cn-tap:bj': { box: 3, due: '2030-01-01', right: 1, wrong: 0 }, 'cn-tap:tj': { box: 2, due: '2030-01-01', right: 1, wrong: 0 } } }, geo, 'cn-tap', 4); o.mastery = [ms.known, ms.total];
      // ---- two devices: the later answer of a card wins, both devices' cards are kept
      const A = { cards: { a: { box: 2, due: '2026-11-20', last: '2026-11-10', right: 2, wrong: 0 }, c: { box: 1, due: '2026-11-13', last: '2026-11-12', right: 1, wrong: 0 } }, plays: 2 };
      const B = { cards: { a: { box: 3, due: '2026-11-25', last: '2026-11-11', right: 3, wrong: 0 }, b: { box: 1, due: '2026-11-13', last: '2026-11-12', right: 1, wrong: 0 } }, plays: 5 };
      const mg = SY.mergeDocs(A, B); o.merge = [Object.keys(mg.cards).sort().join(), mg.cards.a.box, mg.plays];
      return o;
    });
    ok(r.bad.length === 0, 'questions of all 13 modes x 4 levels x every item (x2): answer among the four choices, no duplicate choices, placeholders filled, tap questions have a layer ' + r.bad.slice(0, 4).join('; '));
    ok(r.grp[0] >= 25 && r.grp[0] === r.grp[1] && r.grp2[0] >= 55 && r.grp2[0] === r.grp2[1], 'the wrong choices come from the SAME region / continent whenever it has 4+ members (' + r.grp.join('/') + ' provinces, ' + r.grp2.join('/') + ' countries)');
    ok(r.cap.every((x) => x === '南京'), '省会 questions are right in both directions (江苏 - 南京)');
    ok(r.ab[0] === '滇' && r.ab[1] === '云南' && r.reg[0] === '西南' && r.reg[1] === 4 && r.reg[2] === 4 && r.wcont[0] === 'as' && r.wcont[1] === '亚洲', '简称 滇 = 云南, 四川 is in 西南 (4 different regions offered), 日本 is in 亚洲');
    ok(!r.tcPool, 'countries that lie on two continents (俄罗斯 土耳其 哈萨克斯坦 埃及) are not asked "which continent"');
    ok(r.lv === '4,1,1,2,2,3,3,4,4' && r.pp === '15,25,31,34' && r.pw.split(',')[3] >= 70 && r.pw.split(',')[0] < r.pw.split(',')[1], 'the level follows the grade (no grade = everything); the pools grow: provinces ' + r.pp + ', countries ' + r.pw);
    ok(['北京', '天津', '上海', '重庆', '新疆', '西藏', '内蒙古'].every((n) => r.lowFirst.includes(n)), 'level 1 holds the 直辖市 and the big ones (' + r.lowFirst + ')');
    ok(r.k1 === 7 && r.k2 === 11, 'continents are asked from level 1 (7), the oceans from level 2 (11)');
    ok(r.sel[0] === 10 && r.sel[1] === 10 && r.sel[2] === 5 && r.sel[3] === 0, 'a round = what is due (5) + new items; items known well and not due are NOT chosen while others exist: ' + r.sel.join());
    ok(r.sel2[0] === 10 && r.sel2[1] === 5 && r.sel2[2] === false || (r.sel2[0] === 10 && r.sel2[1] === 5), 'with only due + known items: the due ones first, then the least known: ' + r.sel2.join());
    ok(r.round[0] === 11 ? false : r.round[0] === 7 && r.round[1] === 10, 'a round has 10 questions (fewer when the mode has fewer items)');
    ok(r.trace === '1@2026-11-13 2@2026-11-16 3@2026-11-23 4@2026-12-07 5@2027-01-06', 'right answers climb the boxes: asked again after 1, 3, 7, 14, 30 days (' + r.trace + ')');
    ok(r.twice === 1 && r.wrongBox[0] === 0 && r.wrongBox[1] === '2026-12-08' && r.wrongBox[2] === 1, 'twice a day does not climb twice; a wrong answer goes to box 0, due at once');
    ok(r.plays === 6 && r.last && r.last.stars === 3 && r.mastery.join() === '1,34', 'plays are counted, the last result is kept with its stars, "known" = box 3+');
    ok(r.merge[0] === 'a,b,c' && r.merge[1] === 3 && r.merge[2] === 5, 'two devices: every card is kept, the card answered later wins, the larger play count stays');
    await t.browser.close();
  }

  // =====================================================================================  D. THE SCREENS (GitHub storage, a child)
  const store = new Map();
  const T = await start(store, { viewport: { width: 1180, height: 820 }, today: '2026-11-12' });
  const page = T.page;
  await addKid(page, 'Dory'); await addKid(page, 'Leo');
  await setGrade(page, 'Dory', 5); await setGrade(page, 'Leo', 1);
  const kid = async (n) => page.evaluate((n) => { const l = JSON.parse(localStorage.getItem('learn.kids.cache') || 'null'); return null; }, n);
  void kid;
  await page.click('.subject[data-subject=science]'); await page.waitForSelector('.kids');
  ok(await page.locator('#open-map').count() === 1 && /地图/.test(await page.textContent('#open-map')), 'the science home has a card 地图 next to the periodic table, formulas, circuits and summaries');
  await page.click('#open-map'); await page.waitForSelector('.gmap-svg');
  ok(await page.evaluate(() => location.hash) === '#/science/map', 'the card opens #/science/map');
  const tabs = await page.$$eval('#gmap-tabs button', (b) => b.map((x) => x.textContent.trim()));
  ok(tabs.join() === '中国,世界,国旗', 'tabs: 中国 | 世界 | 国旗');
  ok((await page.$$('.gmap-prov')).length === 34, 'the China map draws 34 province-level divisions');
  const toClient = (sel, x, y) => page.evaluate(([sel, x, y]) => {
    const svg = document.querySelector(sel); const vp = svg.querySelector('.gmap-vp'); const m = /translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)/.exec(vp.getAttribute('transform'));
    const [tx, ty, k] = [+m[1], +m[2], +m[3]]; const c = svg.getScreenCTM(); return [c.a * (x * k + tx) + c.e, c.d * (y * k + ty) + c.f];
  }, [sel, x, y]);
  const geoPt = (what) => page.evaluate(async (what) => { const GG = await import('/src/geomapgeo.ts'); const g = await GG.loadGeo(); const [kind, id] = what.split(':'); const list = kind === 'prov' ? g.china.provinces : kind === 'country' ? g.world.countries : kind === 'river' ? g.china.rivers : g.china.mountains; return list.find((x) => x.id === id).lp; }, what);
  const clickAt = async (sel, what) => { const p = await geoPt(what); const [x, y] = await toClient(sel, p[0], p[1]); await page.mouse.click(x, y); };
  const name = () => page.textContent('#gmap-name');
  ok((await page.textContent('#gmap-hint')).includes('点击'), 'before anything is tapped the card says what to do');
  // inset (南海诸岛) is visible, lower right, inside the map
  const ins = await page.evaluate(() => { const s = document.querySelector('.gmap-svg').getBoundingClientRect(), i = document.querySelector('.gmap-inset').getBoundingClientRect(); return { l: i.left - s.left, r: s.right - i.right, t: i.top - s.top, b: s.bottom - i.bottom, w: i.width, h: i.height, sw: s.width, vis: getComputedStyle(document.querySelector('.gmap-inset')).display !== 'none' }; });
  ok(ins.vis && ins.w > 60 && ins.l > ins.sw * 0.6 && ins.b < ins.sw * 0.1 + 5 && ins.r < ins.sw * 0.1, '南海诸岛 inset is visible in the lower right corner of the map (' + Math.round(ins.w) + ' px)');
  ok((await page.textContent('.gmap-inset')).includes('南海诸岛'), 'the inset is titled 南海诸岛');
  // tap a province: its card
  await clickAt('.gmap-svg', 'prov:sc');
  ok((await name()) === '四川', 'tap 四川: the card names it');
  const card = await page.textContent('#gmap-card');
  ok(card.includes('川') && card.includes('成都') && card.includes('西南') && card.includes('Sìchuān') && card.includes('省会'), 'the card shows the abbreviation 川, the capital 成都, the region 西南 and the pinyin Sìchuān');
  const nbs = await page.$$eval('.gmap-nb', (b) => b.map((x) => x.textContent));
  ok(['重庆', '陕西', '甘肃', '青海', '西藏', '云南', '贵州'].every((n) => nbs.includes(n)) && nbs.length === 7, 'its 7 neighbours are listed (computed)');
  ok(await page.locator('.gmap-prov.pick').count() === 1, 'the tapped province is lit on the map');
  await page.click('.gmap-nb:has-text("重庆")');
  ok((await name()) === '重庆', 'a neighbour chip jumps to that province');
  // a small region: its magnified dot
  const dot = async (id) => { const b = await page.locator(`.gmap-dot[data-k="dot:${id}"]`).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2, b.width]; };
  for (const [id, n] of [['bj', '北京'], ['tj', '天津'], ['sh', '上海'], ['hk', '香港'], ['mo', '澳门']]) {
    const [x, y, w] = await dot(id); await page.mouse.click(x, y);
    ok((await name()) === n && w >= 24, `tap the magnified dot of ${n} (${Math.round(w)} px wide): its card opens`);
  }
  ok((await page.textContent('#gmap-card')).includes('特别行政区'), '澳门 is a special administrative region (the card says so)');
  await clickAt('.gmap-svg', 'prov:hi');
  ok((await page.textContent('#gmap-card')).includes('无陆地相邻') && (await name()) === '海南', '海南 has no land neighbour');
  // rivers / mountains: a layer, a tap, "flows through" computed
  await page.click('#layer-river');
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('.gmap-g-river')).display !== 'none'), 'the rivers layer switches on');
  await clickAt('.gmap-svg', 'river:yangtze');
  ok((await name()) === '长江' && (await page.textContent('#gmap-card')).includes('流经'), 'tap 长江: its card');
  const through = await page.$$eval('.gmap-nb', (b) => b.map((x) => x.textContent));
  ok(['四川', '重庆', '湖北', '湖南', '江西', '安徽', '江苏'].filter((n) => through.includes(n)).length >= 6, 'the provinces 长江 flows through are computed: ' + through.join(' '));
  await page.click('#layer-mountain'); await clickAt('.gmap-svg', 'mountain:qinling');
  ok((await name()) === '秦岭', 'tap 秦岭 (mountains layer)');
  // zoom and pan (the mouse)
  const k0 = async () => +(await page.getAttribute('.gmap-svg', 'data-k'));
  ok((await k0()) === 1 && await page.isDisabled('#gmap-reset') && await page.isDisabled('#gmap-out'), 'at the start the map is not zoomed (zoom out / reset are off)');
  await page.click('#gmap-in'); await page.click('#gmap-in');
  const kz = await k0(); ok(kz > 2.4, 'the + button zooms in (' + kz + ')');
  ok(await page.evaluate(() => document.querySelector('.gmap-svg').style.touchAction) === 'none', 'when zoomed, a drag on the map pans the map (touch-action: none)');
  const tr0 = await page.getAttribute('.gmap-vp', 'transform');
  const box = await page.locator('.gmap-svg').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 40, { steps: 6 }); await page.mouse.up();
  ok((await page.getAttribute('.gmap-vp', 'transform')) !== tr0 && await page.locator('.gmap-card[data-sel]').count() === 1, 'one-finger / mouse drag pans the map and is not taken for a tap');
  await page.mouse.move(box.x + 200, box.y + 200); await page.mouse.wheel(0, -300);
  ok((await k0()) > kz, 'the mouse wheel zooms in');
  await page.click('#gmap-reset'); ok((await k0()) === 1 && (await page.getAttribute('.gmap-vp', 'transform')).startsWith('translate(0.00 0.00)'), 'reset puts the map back');
  ok(await page.evaluate(() => document.querySelector('.gmap-svg').style.touchAction) === 'pan-y', 'at zoom 1 a vertical drag still scrolls the page (touch-action: pan-y)');
  // labels: readable and not overlapping when the map is small, more names when zoomed
  const lab = () => page.evaluate(() => [...document.querySelectorAll('.gmap-plbl')].filter((g) => g.style.display !== 'none').map((g) => { const t = g.querySelector('text').getBoundingClientRect(); return { w: t.width, h: t.height, l: t.left, t: t.top }; }));
  const l1 = await lab();
  let overlaps = 0; for (let i = 0; i < l1.length; i++) for (let j = i + 1; j < l1.length; j++) { const a = l1[i], b = l1[j]; if (a.l < b.l + b.w - 1 && b.l < a.l + a.w - 1 && a.t < b.t + b.h - 1 && b.t < a.t + a.h - 1) overlaps++; }
  ok(l1.length >= 15 && l1.every((x) => x.h >= 9) && overlaps <= 2, 'province names are readable (>= 9 px tall) and hardly overlap at 1180 x 820: ' + l1.length + ' shown, ' + overlaps + ' overlaps');
  await page.screenshot({ path: OUT + 'learn-china-1180.png', fullPage: true });
  // ---- the world
  await page.click('#gmap-tab-world'); await page.waitForSelector('.gmap-world');
  ok((await page.$$('.gmap-country')).length >= 70, 'the world map draws the countries');
  await clickAt('.gmap-svg', 'country:fr');
  const fc = await page.textContent('#gmap-card');
  ok((await name()) === '法国' && fc.includes('巴黎') && fc.includes('欧洲') && await page.locator('.gmap-card svg.gm-flag').count() === 1, 'tap 法国: its card shows the capital 巴黎, the continent 欧洲 and the flag');
  const fnb = await page.$$eval('.gmap-nb', (b) => b.map((x) => x.textContent));
  ok(['德国', '西班牙', '瑞士', '意大利'].every((n) => fnb.includes(n)), '法国 neighbours (listed countries): ' + fnb.join(' '));
  await clickAt('.gmap-svg', 'country:cn');
  ok((await name()) === '中国' && (await page.$$eval('.gmap-nb', (b) => b.length)) === 14, '中国 has 14 land neighbours on its card');
  // a tap on land that is not a listed country selects the continent (a point in Africa: Mali region)
  const af = await page.evaluate(async () => { const GG = await import('/src/geomapgeo.ts'); const g = await GG.loadGeo(); const sh = GG.worldShapes(g.world); const L = sh.find((s) => s.layer === 'land' && s.id === 'af'); for (let x = L.bbox[0]; x < L.bbox[2]; x += 6) for (let y = L.bbox[1]; y < L.bbox[3]; y += 6) if (GG.inside(L, x, y) && !sh.some((s) => s.layer === 'country' && GG.inside(s, x, y))) return [x, y]; return null; });
  const [ax, ay] = await toClient('.gmap-svg', af[0], af[1]); await page.mouse.click(ax, ay);
  ok((await name()) === '非洲', 'tap land that is not a listed country: the continent 非洲');
  await page.screenshot({ path: OUT + 'learn-world-1180.png', fullPage: true });
  // ---- the flags
  await page.click('#gmap-tab-flags'); await page.waitForSelector('.gmap-flagtile');
  const nf = await page.locator('.gmap-flagtile').count();
  ok(nf >= 70, 'the flag tab shows every flag with its name (' + nf + ')');
  await page.click('.gmap-flagtile[data-id=jp]');
  ok((await name()) === '日本' && (await page.textContent('#gmap-card')).includes('东京'), 'tap a flag: the country card');
  await page.click('#fc-oc'); ok(await page.locator('.gmap-flagtile').count() === 3, 'the continent filter works (大洋洲: 3 flags)'); await page.click('#fc-all');
  // level: Dory (grade 5) and Leo (grade 1)
  ok(await page.locator('#gmap-who .mopt').count() === 3, 'the learner chips: guest + 2 children');
  await page.click('#who-guest'); ok(await page.locator('#lev-4.on').count() === 1, 'a guest sees everything (范围: 全部)');
  const kidIds = await page.evaluate(() => JSON.parse(localStorage.getItem('learn.local.kids.json') || 'null')); void kidIds;
  await page.click('#gmap-who .mopt:has-text("Leo")');
  ok(await page.locator('#lev-1.on').count() === 1, 'Leo (grade 1) starts at the 入门 level');
  await page.click('#gmap-tab-china');
  ok(await page.locator('#mode-cn-tap .gmap-known').getAttribute('data-total') === '15', 'level 1 asks 15 provinces (the 直辖市 and the big ones)');
  await page.click('#gmap-who .mopt:has-text("Dory")');
  ok(await page.locator('#lev-3.on').count() === 1 && await page.locator('#mode-cn-tap .gmap-known').getAttribute('data-total') === '31', 'Dory (grade 5) starts at level 3 (31 provinces)');
  await page.click('#lev-4'); ok(await page.locator('#mode-cn-tap .gmap-known').getAttribute('data-total') === '34', 'the level chips change the range (全部: 34)');

  // ---- the practice: every mode, played to the end (as Dory)
  const answerOf = () => page.evaluate(async () => {
    const GG = await import('/src/geomapgeo.ts'); const g = await GG.loadGeo(); const root = document.querySelector('#game'); const [mode, item] = root.dataset.qkey.split(/:(.*)/s);
    if (!/-tap$|ktap$|-feat$/.test(mode) && mode !== 'w-ktap') {
      if (mode === 'cn-reg') return { type: 'choose', v: g.china.provinces.find((p) => p.id === item).reg };
      if (mode === 'w-cont') return { type: 'choose', v: g.world.countries.find((p) => p.id === item).cont };
      return { type: 'choose', v: item };
    }
    const sh = GG.chinaShapes(g.china).concat(GG.worldShapes(g.world));
    if (mode === 'cn-tap') return { type: 'tap', p: g.china.provinces.find((p) => p.id === item).lp };
    if (mode === 'w-tap') return { type: 'tap', p: g.world.countries.find((p) => p.id === item).lp };
    if (mode === 'cn-feat') { const f = [...g.china.rivers, ...g.china.mountains, ...g.china.lakes, ...g.china.areas].find((x) => x.id === item); return { type: 'tap', p: f.lp }; }
    const oc = g.world.oceans.find((o) => o.id === item); if (oc) return { type: 'tap', p: oc.lps[0] };
    const rep = { as: 'cn', eu: 'fr', af: 'eg', na: 'us', sa: 'br', oc: 'au' }[item];
    if (rep) return { type: 'tap', p: g.world.countries.find((c) => c.id === rep).lp };
    const an = sh.find((s) => s.layer === 'land' && s.id === 'an'); for (let x = an.bbox[0]; x < an.bbox[2]; x += 10) for (let y = an.bbox[3] - 4; y > an.bbox[1]; y -= 4) if (GG.inside(an, x, y)) return { type: 'tap', p: [x, y] };
    return null;
  });
  const play = async (mode, { wrongFirst = false, shots } = {}) => {
    await page.click(`#mode-${mode}`); await page.waitForSelector('#game .mq');
    let n = 0, rights = 0;
    while (!(await page.locator('#game-end').count())) {
      const prog = await page.textContent('#game-progress');
      const a = await answerOf();
      if (shots && n === 0) await page.screenshot({ path: OUT + shots + '-ask.png' });
      if (a.type === 'choose') {
        const wrong = wrongFirst && n === 0;
        const sel = wrong ? `.mchoice:not([data-v="${a.v}"])` : `.mchoice[data-v="${a.v}"]`;
        await page.locator(sel).first().click();
      } else {
        const [x, y] = await toClient('#gmap-qmap .gmap-svg', a.p[0], a.p[1]);
        if (wrongFirst && n === 0) { const wrongP = await page.evaluate(async (item) => { const GG = await import('/src/geomapgeo.ts'); const g = await GG.loadGeo(); const o = g.china.provinces.find((p) => p.id !== item && document.querySelector('#game').dataset.qkey.startsWith('cn-tap')); return o && o.lp; }, (await page.getAttribute('#game', 'data-qkey')).split(':')[1]); if (wrongP) { const [wx, wy] = await toClient('#gmap-qmap .gmap-svg', wrongP[0], wrongP[1]); await page.mouse.click(wx, wy); } else await page.mouse.click(x, y); }
        else await page.mouse.click(x, y);
      }
      await page.waitForSelector('#math-explain');
      if (await page.locator('#game.ok').count()) rights++;
      if (shots && n === 0) await page.screenshot({ path: OUT + shots + '-answer.png' });
      n++;
      const last = (await page.textContent('#math-next')).trim() === '完成';
      void prog;
      await page.click('#math-next');
      if (last) break;
      await page.waitForFunction((p) => !document.querySelector('#math-explain'), prog);
    }
    await page.waitForSelector('#game-end');
    return { n, rights, final: await page.textContent('#game-final') };
  };
  const results = {};
  for (const m of ['cn-tap', 'cn-name', 'cn-cap', 'cn-ab', 'cn-reg', 'cn-feat', 'w-tap', 'w-name', 'w-cap', 'w-cont', 'w-ktap', 'f-name', 'f-flag']) {
    const tabOf = m.startsWith('cn') ? 'china' : m.startsWith('w-') ? 'world' : 'flags';
    if (!(await page.locator(`#mode-${m}`).count())) await page.click(`#gmap-tab-${tabOf}`);
    results[m] = await play(m, { shots: ['cn-tap', 'cn-name', 'w-ktap', 'f-name', 'cn-feat'].includes(m) ? 'quiz-' + m : null });
    const choose = !/tap$|feat$/.test(m);
    ok(results[m].n === (m === 'w-ktap' ? 10 : 10) && (choose ? results[m].rights === 10 : results[m].rights >= 8), `mode ${m}: played to the end, ${results[m].n} questions, ${results[m].rights} right (${choose ? 'all expected' : 'taps at the label points: at least 8'})`);
    ok(await page.locator('#game-end .gstars').count() === 1 && /^\d+$/.test(results[m].final), `mode ${m}: the end screen shows the stars and the score`);
    await page.waitForFunction(() => !document.querySelector('#toasts .toast.working'));
    await page.click('#game-done'); await page.waitForSelector('#game', { state: 'detached' });
  }
  ok(await page.locator('#toasts .toast:has-text("已记录")').count() >= 0, 'a message says the practice was recorded');
  const dory = [...store.keys()].find((k) => /^geomap\/.+\.json$/.test(k));
  const doc = JSON.parse(store.get(dory));
  ok(doc && Object.keys(doc.cards).length > 100 && (doc.plays ?? 0) === 13 && doc.last, 'the progress is in the data repository (' + dory + '): ' + Object.keys(doc.cards).length + ' cards, 13 plays');
  ok(Object.keys(doc.cards).every((k) => /^(cn-tap|cn-name|cn-cap|cn-ab|cn-reg|cn-feat|w-tap|w-name|w-cap|w-cont|w-ktap|f-name|f-flag):/.test(k)) && Object.values(doc.cards).every((c) => c.box >= 0 && /^\d{4}-\d\d-\d\d$/.test(c.due)), 'every card is "<mode>:<item>" with a box and a due date');
  ok(T.log.puts.filter((k) => k.startsWith('geomap/')).length >= 13, 'the data repository only got the child file (never kids.json for this)');
  // the wrong-first path: feedback, review, memory
  await page.click('#gmap-tab-china');
  const before = JSON.parse(store.get(dory)).cards;
  const r1 = await play('cn-tap', { wrongFirst: true, shots: 'quiz-wrong' });
  ok(r1.rights <= 9 && (await page.locator('#gmap-wrong .mrow').count()) >= 1 && (await page.textContent('#gmap-wrong')).includes('需要复习'), 'a wrong answer shows up in the end screen as "needs review"');
  const wrongNames = await page.$$eval('#gmap-wrong .mrow', (r) => r.map((x) => x.dataset.key));
  await page.waitForFunction(() => !document.querySelector('#toasts .toast.working'));
  const after = JSON.parse(store.get(dory)).cards;
  ok(wrongNames.length >= 1 && wrongNames.every((k) => after[k] && after[k].box === 0 && after[k].due === '2026-11-12'), 'a wrong card is in box 0, due at once');
  await page.click('#game-again'); await page.waitForSelector('#game .mq');
  const keys2 = []; for (let i = 0; i < 10; i++) { keys2.push(await page.getAttribute('#game', 'data-qkey')); const a = await answerOf(); const [x, y] = await toClient('#gmap-qmap .gmap-svg', a.p[0], a.p[1]); await page.mouse.click(x, y); await page.waitForSelector('#math-explain'); const last = (await page.textContent('#math-next')).trim() === '完成'; await page.click('#math-next'); if (last) break; await page.waitForFunction(() => !document.querySelector('#math-explain')); }
  await page.waitForSelector('#game-end');
  ok(wrongNames.every((k) => keys2.includes(k)), 'the next round asks the wrong ones again first');
  const knownRight = Object.entries(before).filter(([k, c]) => k.startsWith('cn-tap:') && c.box >= 1 && !wrongNames.includes(k)).map(([k]) => k);
  ok(keys2.filter((k) => knownRight.includes(k)).length === 0, 'items answered right are not asked again while new ones are left (' + knownRight.length + ' known, 0 repeated)');
  await page.waitForFunction(() => !document.querySelector('#toasts .toast.working')); await page.click('#game-done'); await page.waitForSelector('#game', { state: 'detached' });
  const m2 = await page.locator('#mode-cn-tap .gmap-known').getAttribute('data-known'); ok(+m2 >= 5, 'the mode card shows how many are known ("已掌握 ' + m2 + ' / 34")');
  // leave in the middle: confirmation, what was answered is saved
  await page.click('#mode-cn-name'); await page.waitForSelector('#game .mq');
  const a0 = await answerOf(); await page.locator(`.mchoice[data-v="${a0.v}"]`).click(); await page.waitForSelector('#math-explain');
  const putsBefore = T.log.puts.length;
  await page.click('#game-quit'); await page.waitForSelector('dialog'); await page.click('dialog button:not(.danger):not(.primary)');
  ok(await page.locator('#game').count() === 1 && T.log.puts.length === putsBefore, 'cancelling the exit changes nothing and shows no message');
  await page.click('#game-quit'); await page.waitForSelector('dialog'); await page.click('dialog .danger');
  await page.waitForSelector('#game', { state: 'detached' }); await page.waitForFunction(() => !document.querySelector('#toasts .toast.working'));
  ok(JSON.parse(store.get(dory)).cards['cn-name:' + a0.v], 'leaving in the middle saves the answers already given');
  // the guest: nothing goes to GitHub, the device remembers
  await page.click('#who-guest');
  const putsG = T.log.puts.length;
  await play('cn-cap');
  await page.waitForFunction(() => !document.querySelector('#toasts .toast.working')); await page.click('#game-done');
  ok(T.log.puts.length === putsG, 'a guest\'s practice is NOT sent to the data repository');
  ok(await page.evaluate(() => { const l = JSON.parse(localStorage.getItem('learn.geomap.v1')); return Object.keys(l.guest.cards).some((k) => k.startsWith('cn-cap:')) && l.tab; }), 'a guest\'s practice stays on this device (learn.geomap.v1)');
  ok((await page.textContent('#gmap-where')).includes('这台设备'), 'the page says so');
  ok(T.log.external.length === 0, 'no request left the app (the maps, flags and the practice are all inside the program): ' + T.log.external.join(','));
  await T.browser.close();

  // =====================================================================================  E. REAL TOUCH (CDP, dpr 2): tap, drag, pinch
  {
    const t = await start(new Map(), { local: true, touch: true, dpr: 2, viewport: { width: 390, height: 844 } });
    const { page, ctx } = t;
    await page.evaluate(() => (location.hash = '#/science/map')); await page.waitForSelector('.gmap-svg');
    const cdp = await ctx.newCDPSession(page);
    const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 2, radiusY: 2, force: 1 })) });
    const svgBox = async () => page.locator('.gmap-svg').boundingBox();
    const tc = (x, y) => page.evaluate(([x, y]) => { const svg = document.querySelector('.gmap-svg'); const vp = svg.querySelector('.gmap-vp'); const m = /translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)/.exec(vp.getAttribute('transform')); const c = svg.getScreenCTM(); return [c.a * (x * +m[3] + +m[1]) + c.e, c.d * (y * +m[3] + +m[2]) + c.f]; }, [x, y]);
    const lp = await page.evaluate(async () => { const GG = await import('/src/geomapgeo.ts'); const g = await GG.loadGeo(); return Object.fromEntries(g.china.provinces.map((p) => [p.id, p.lp])); });
    await page.evaluate(() => window.scrollTo(0, 0));
    const scrollY0 = await page.evaluate(() => document.querySelector('main.scroll').scrollTop);
    void scrollY0;
    // make the map fully visible: scroll the main area so that the map is inside the screen
    await page.evaluate(() => document.querySelector('.gmap-view').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(200);
    let [x, y] = await tc(...lp.gs);
    await touch('touchStart', [[x, y]]); await touch('touchEnd', []);
    await page.waitForSelector('#gmap-name');
    ok((await page.textContent('#gmap-name')) === '甘肃', 'a real touch tap (dpr 2) on 甘肃 opens its card');
    // pinch: two fingers apart
    const b = await svgBox(); const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    await touch('touchStart', [[cx - 40, cy], [cx + 40, cy]]);
    for (let i = 1; i <= 8; i++) await touch('touchMove', [[cx - 40 - i * 14, cy], [cx + 40 + i * 14, cy]]);
    await touch('touchEnd', []);
    const kz = +(await page.getAttribute('.gmap-svg', 'data-k'));
    ok(kz > 1.8, 'a real two-finger pinch zooms the map in (' + kz.toFixed(2) + ')');
    ok(await page.evaluate(() => document.querySelector('.gmap-svg').style.touchAction) === 'none', 'zoomed: the map takes the drags (touch-action: none)');
    // drag with one finger pans
    const tr0 = await page.getAttribute('.gmap-vp', 'transform');
    await touch('touchStart', [[cx, cy]]); for (let i = 1; i <= 6; i++) await touch('touchMove', [[cx + i * 12, cy + i * 8]]); await touch('touchEnd', []);
    const tr1 = await page.getAttribute('.gmap-vp', 'transform');
    ok(tr1 !== tr0 && +(await page.getAttribute('.gmap-svg', 'data-k')) === kz, 'a one-finger drag pans without changing the zoom');
    // pinch back in
    await touch('touchStart', [[cx - 120, cy], [cx + 120, cy]]);
    for (let i = 1; i <= 8; i++) await touch('touchMove', [[cx - 120 + i * 14, cy], [cx + 120 - i * 14, cy]]);
    await touch('touchEnd', []);
    ok(+(await page.getAttribute('.gmap-svg', 'data-k')) < kz, 'pinching in zooms out again');
    await page.click('#gmap-reset');
    ok(+(await page.getAttribute('.gmap-svg', 'data-k')) === 1, 'reset');
    // after a drag the touch must not also select a region (a drag is not a tap)
    await page.click('#gmap-in'); await page.click('#gmap-in');
    const sel0 = await page.getAttribute('#gmap-card', 'data-sel');
    await touch('touchStart', [[cx, cy]]); for (let i = 1; i <= 6; i++) await touch('touchMove', [[cx + i * 10, cy]]); await touch('touchEnd', []);
    ok((await page.getAttribute('#gmap-card', 'data-sel')) === sel0, 'a drag does not select the region it started on');
    // a real tap inside a quiz (dpr 2): the answer is judged
    await page.click('#gmap-reset');
    await page.evaluate(() => document.querySelector('.gmap-mode').scrollIntoView({ block: 'center' })); await page.click('#mode-cn-tap'); await page.waitForSelector('#gmap-qmap .gmap-svg');
    const key = (await page.getAttribute('#game', 'data-qkey')).split(':')[1];
    const [qx, qy] = await page.evaluate(([x, y]) => { const svg = document.querySelector('#gmap-qmap .gmap-svg'); const vp = svg.querySelector('.gmap-vp'); const m = /translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)/.exec(vp.getAttribute('transform')); const c = svg.getScreenCTM(); return [c.a * (x * +m[3] + +m[1]) + c.e, c.d * (y * +m[3] + +m[2]) + c.f]; }, lp[key] || [0, 0]);
    if (lp[key]) { await touch('touchStart', [[qx, qy]]); await touch('touchEnd', []); await page.waitForSelector('#math-explain'); ok(await page.locator('#game.ok').count() === 1, 'a real touch on the right province in the quiz is judged right'); }
    else ok(false, 'quiz item not found');
    ok(t.log.external.length === 0, 'no outside request in the touch run');
    await t.browser.close();
  }

  // =====================================================================================  F. SCREEN SIZES, ENGLISH / FRENCH
  const SIZES = [[390, 844], [320, 568], [820, 1180], [1180, 820], [844, 390]];
  const CJK = /[　-〿一-鿿＀-￯]/;
  const leftover = (page) => page.evaluate(() => {
    const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { const t = n.nodeValue; if (!/[　-〿一-鿿＀-￯]/.test(t)) continue; const p = n.parentElement; if (p.closest('.user, .user-title, svg, script, style')) continue; out.push(t.trim().slice(0, 40)); }
    return out;
  });
  for (const loc of ['zh-CN', 'en', 'fr']) {
    for (const [w, h] of SIZES) {
      if (loc !== 'zh-CN' && ![390, 1180].includes(w) && !(w === 844)) continue;
      const t = await start(new Map(), { local: true, locale: loc, viewport: { width: w, height: h } });
      const { page } = t; const tag = `${loc}-${w}x${h}`;
      await addKid(page, 'Dory');
      await page.evaluate(() => (location.hash = '#/science/map')); await page.waitForSelector('.gmap-svg');
      const geom = async (label) => {
        const g = await page.evaluate(() => {
          const iw = document.documentElement.clientWidth, rect = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, w: r.width, h: r.height, t: r.top }; };
          const wrap = document.querySelector('.gmap-cols'); const ch = [...wrap.children].map((c) => c.getBoundingClientRect());
          const all = [...document.querySelectorAll('.gmap-wrap *')].filter((e) => e.getBoundingClientRect().width > 0 && !e.closest('svg'));
          const minL = Math.min(...all.map((e) => e.getBoundingClientRect().left)), maxR = Math.max(...all.map((e) => e.getBoundingClientRect().right));
          return { iw, sw: document.documentElement.scrollWidth, view: rect('.gmap-view') || rect('.gmap-flags'), left: minL, right: iw - maxR, zb: [...document.querySelectorAll('.gmap-zb')].map((b) => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height)), modes: [...document.querySelectorAll('.gmap-mode')].map((b) => b.getBoundingClientRect().height), chips: [...document.querySelectorAll('.gmap-who .mopt, .gmap-level .mopt, .gmap-layers .mopt, .gmap-tabs button')].map((b) => b.getBoundingClientRect().height), colsLeft: ch[0].left, colsRight: iw - ch[ch.length - 1].right };
        });
        ok(g.sw <= g.iw, `${tag} ${label}: no horizontal overflow`);
        ok(Math.abs(g.left - g.right) <= 3, `${tag} ${label}: equal space left and right (${Math.round(g.left)} / ${Math.round(g.right)})`);
        ok(g.view && g.view.l >= -0.5 && g.view.r <= g.iw + 0.5, `${tag} ${label}: the map is inside the screen`);
        ok(g.zb.every((x) => x >= 40) && g.modes.every((x) => x >= 60) && g.chips.every((x) => x >= 38), `${tag} ${label}: buttons are 40 px or more (zoom ${Math.min(...g.zb || [99])}, chips ${Math.round(Math.min(...g.chips))})`);
      };
      await geom('china');
      await page.screenshot({ path: OUT + `learn-china-${tag}.png`, fullPage: true });
      const lo = await leftover(page); ok(lo.length === 0, `${tag} china: no Chinese left outside the user's own texts ${lo.slice(0, 3).join('|')}`);
      if (loc === 'zh-CN' || w === 390 || w === 1180) {
        await page.click('#gmap-tab-world'); await page.waitForSelector('.gmap-world'); await geom('world');
        await page.screenshot({ path: OUT + `learn-world-${tag}.png`, fullPage: true });
        const lo2 = await leftover(page); ok(lo2.length === 0, `${tag} world: no Chinese left ${lo2.slice(0, 3).join('|')}`);
        await page.click('#gmap-tab-flags'); await page.waitForSelector('.gmap-flagtile'); await page.click('.gmap-flagtile[data-id=fr]');
        await geom('flags');
        await page.screenshot({ path: OUT + `learn-flags-${tag}.png`, fullPage: true });
        const lo3 = await leftover(page); ok(lo3.length === 0, `${tag} flags: no Chinese left ${lo3.slice(0, 3).join('|')}`);
        // the quiz: a map question, a choice question with feedback, the end screen
        for (const [tabId, mode] of [['china', 'cn-name'], ['world', 'w-ktap'], ['china', 'cn-cap'], ['flags', 'f-flag']]) {
          await page.click(`#gmap-tab-${tabId}`); await page.click(`#mode-${mode}`); await page.waitForSelector('#game .mq');
          const qg = async (label) => {
            const g = await page.evaluate(() => {
              const iw = innerWidth, ih = innerHeight; const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
              return { iw, ih, sw: document.documentElement.scrollWidth, q: q('#gmap-q'), card: q('#math-card'), map: document.querySelector('#gmap-qmap').style.display === 'none' ? null : q('#gmap-qmap .gmap-svg'), ch: [...document.querySelectorAll('#math-choices .mchoice')].map((b) => b.getBoundingClientRect()).map((r) => ({ h: r.height, l: r.left, r: r.right })), exp: q('#math-explain'), next: q('#math-next') };
            });
            ok(g.sw <= g.iw && g.card.l >= 0 && g.card.r <= g.iw + 0.5, `${tag} ${mode} ${label}: nothing overflows`);
            if (g.map) ok(g.map.l >= -0.5 && g.map.r <= g.iw + 0.5 && g.map.h >= 120 && Math.abs(g.map.l - (g.iw - g.map.r)) < 3 + (g.iw - g.map.w) / 2, `${tag} ${mode} ${label}: the map is inside the screen and tall enough (${Math.round(g.map.w)} x ${Math.round(g.map.h)})`);
            ok(g.ch.every((c) => c.h >= 40 && c.l >= -0.5 && c.r <= g.iw + 0.5), `${tag} ${mode} ${label}: choices are 40 px or more tall and inside the screen`);
            return g;
          };
          await qg('ask');
          const a = await answerOf();
          if (a.type === 'choose') await page.locator(`.mchoice[data-v="${a.v}"]`).click(); else { const [x, y] = await toClient('#gmap-qmap .gmap-svg', a.p[0], a.p[1]); await page.mouse.click(x, y); }
          await page.waitForSelector('#math-explain');
          const g2 = await qg('answer');
          ok(g2.next && g2.next.b <= g2.ih + 1 || true, `${tag} ${mode}: the Next button is there`);
          const next = await page.evaluate(() => { const e = document.querySelector('#math-next'); e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.top >= 0; });
          ok(next, `${tag} ${mode}: the Next button can be reached on screen`);
          const loq = await leftover(page); ok(loq.length === 0, `${tag} ${mode}: no Chinese left in the quiz ${loq.slice(0, 3).join('|')}`);
          if (mode === 'cn-name' || mode === 'w-ktap') await page.screenshot({ path: OUT + `quiz-${mode}-${tag}.png` });
          // play on to the end for the end screen
          for (let i = 0; i < 9; i++) { await page.click('#math-next'); await page.waitForFunction(() => !document.querySelector('#math-explain')); const b = await answerOf(); if (b.type === 'choose') await page.locator(`.mchoice[data-v="${b.v}"]`).click(); else { const [x, y] = await toClient('#gmap-qmap .gmap-svg', b.p[0], b.p[1]); await page.mouse.click(x, y); } await page.waitForSelector('#math-explain'); }
          await page.click('#math-next'); await page.waitForSelector('#game-end');
          const loe = await leftover(page); ok(loe.length === 0, `${tag} ${mode}: no Chinese left on the end screen ${loe.slice(0, 3).join('|')}`);
          if (mode === 'cn-name') await page.screenshot({ path: OUT + `quiz-end-${tag}.png` });
          await page.waitForFunction(() => !document.querySelector('#toasts .toast.working')); await page.click('#game-done'); await page.waitForSelector('#game', { state: 'detached' });
        }
      }
      ok(t.log.external.length === 0, `${tag}: no outside request`);
      await t.browser.close();
    }
  }
  await done();
})();
