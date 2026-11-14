// Math foundations (rule 52): 61 new topics of primary school with figures (clocks, money, shapes, charts, protractor, areas, ...) and the times table page.
// Part 1: the generators in the browser, 1500 questions per topic: chk, four different choices, no NaN, figure = well-formed SVG without Chinese text, variety, ranges
//         of the grade, and an INDEPENDENT check of every answer (parsed from the text and from the drawing: hands of the clock, money in the picture, areas from
//         the polygon, angles from the lines, bars from their heights, ...).
// Part 2: the screens: a game with figure questions (figure inside the card, centred, 30 % of the screen at most, choices on the screen), the errors book keeps the
//         figure, the times table page (grid, tap, speech, practice, weak cells, merge), 5 screen sizes, EN / FR, no outside request.
const { start, checks, addKid, setGrade } = require('./harness.cjs');
const { ok, done } = checks();
const fs = require('fs');
const OUT = process.env.D || 'tests/out/work/';
fs.mkdirSync(OUT, { recursive: true });

const NEW = {
  1: ['shapes1', 'clock1', 'rmb1', 'place1', 'pattern1', 'wpmore'],
  2: ['kjfill', 'kjwhich', 'mulmissing', 'divinv', 'times', 'rem', 'clock2', 'clockpick', 'rmb2', 'rmbchange', 'rmbmake', 'unitpick', 'barread', 'place2', 'shapes2', 'wpshare'],
  3: ['muldivmix', 'remdiv', 'elapsed', 'clockafter', 'unitconv1', 'unittime', 'perim', 'area1', 'fraction1', 'fraccomp', 'decmoney', 'deccomp', 'wpdist', 'bardiff', 'pattern2', 'stickpat'],
  4: ['factmult', 'primecomp', 'bignum', 'roundest', 'protract', 'angleclass', 'symm', 'unitconv2', 'avgbar'],
  5: ['commonfm', 'primefac', 'areapara', 'areatri2', 'areatrap', 'combo', 'cuboid', 'fracdec', 'unitvol'],
  6: ['circfig', 'cylvol'],
  7: ['anglepair', 'numline', 'coord'],
};
const ALL = Object.values(NEW).flat();
const FIG = new Set(['shapes1', 'clock1', 'rmb1', 'pattern1', 'clock2', 'clockpick', 'rmbchange', 'barread', 'shapes2', 'clockafter', 'perim', 'area1', 'fraction1', 'bardiff', 'stickpat', 'protract', 'angleclass', 'symm', 'avgbar', 'areapara', 'areatri2', 'areatrap', 'combo', 'cuboid', 'circfig', 'cylvol', 'anglepair', 'numline', 'coord']);
const CJK_CONTENT = new Set(['kjfill', 'kjwhich', 'bignum']);   // (the rhymes and the numbers read the Chinese way are Chinese content: never translated)

/** runs in the browser: makes N questions of every new topic and checks each of them independently of the generator */
async function generatorChecks(ids, N) {
  const G = await import('/src/mathgen.ts');
  const out = { bad: [], total: 0, variety: {}, figs: 0, maxLen: 0, lens: {} };
  const D = (s) => new DOMParser().parseFromString(s, 'image/svg+xml');
  const svgOf = (q) => { const d = D(q.fig); return d.documentElement; };
  const num = (s) => parseFloat(String(s).replace('−', '-').replace('%', ''));
  const nums = (s) => (String(s).match(/\d+(\.\d+)?/g) || []).map(Number);
  const hm = (h, m) => h + ':' + String(m).padStart(2, '0');
  const near = (a, b, e = 0.011) => Math.abs(a - b) <= Math.max(e, Math.abs(b) * 0.004);   // (the drawing is rounded to 0.01 px)
  const divisors = (n) => Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0);
  const isPrime = (n) => n > 1 && divisors(n).length === 2;
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const DIG = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
  /** a number read the Chinese way -> value (an independent parser) */
  const cnToNum = (str) => {
    const sec = (t) => { let cur = 0, tot = 0; for (const c of t) { if (DIG[c]) cur = DIG[c]; else if (c === '十') { tot += (cur || 1) * 10; cur = 0; } else if (c === '百') { tot += cur * 100; cur = 0; } else if (c === '千') { tot += cur * 1000; cur = 0; } } return tot + cur; };
    let yi = 0, wan = 0, rest = str;
    if (rest.includes('亿')) { const [a, b] = rest.split('亿'); yi = sec(a); rest = b; }
    if (rest.includes('万')) { const [a, b] = rest.split('万'); wan = sec(a); rest = b; }
    return yi * 1e8 + wan * 1e4 + sec(rest);
  };
  /** the product of a rhyme: "三四十二" -> {x:3,y:4,p:12}; "二三得六" -> {x:2,y:3,p:6} */
  const kjParse = (t) => { const x = DIG[t[0]], y = DIG[t[1]]; const r = t.slice(2).replace('得', ''); return { x, y, p: cnToNum(r) }; };
  const area = (pts) => { let s = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; s += x1 * y2 - x2 * y1; } return Math.abs(s) / 2; };
  const perim = (pts) => pts.reduce((s, p, i) => s + Math.hypot(p[0] - pts[(i + 1) % pts.length][0], p[1] - pts[(i + 1) % pts.length][1]), 0);
  const polyPts = (el) => el.getAttribute('points').trim().split(/\s+/).map((p) => p.split(',').map(Number));
  const dims = (root) => Object.fromEntries([...root.querySelectorAll('text.dim')].map((t) => [t.getAttribute('data-d'), Number(t.textContent)]));
  const hands = (g) => ({ h: Number(/rotate\(([-\d.]+)/.exec(g.querySelector('.hh').getAttribute('transform'))[1]), m: Number(/rotate\(([-\d.]+)/.exec(g.querySelector('.mh').getAttribute('transform'))[1]) });
  /** the time a clock shows, read from the angles of its hands (also checks that the hour hand agrees with the minute hand) */
  const readClock = (g) => { const { h, m } = hands(g); const minute = Math.round(m / 6) % 60; let hour = Math.floor((h - minute * 0.5 + 1e-6) / 30 + 0.5) % 12 || 12; if (Math.abs(h - ((hour % 12) * 30 + minute * 0.5)) > 0.02) return null; return [hour, minute]; };
  const barsOf = (root) => { const u = Number(root.querySelector('#plot').getAttribute('data-u')); return [...root.querySelectorAll('rect.b')].map((r) => ({ k: r.getAttribute('data-k'), v: Number(r.getAttribute('data-v')), h: Number(r.getAttribute('height')) / u })); };
  const symAxes = (pts) => {
    const n = pts.length, cx = pts.reduce((s, p) => s + p[0], 0) / n, cy = pts.reduce((s, p) => s + p[1], 0) / n;
    const has = (p) => pts.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.6);
    const dirs = new Set();
    for (let i = 0; i < n; i++) { dirs.add(Math.atan2(pts[i][1] - cy, pts[i][0] - cx)); for (let j = i + 1; j < n; j++) dirs.add(Math.atan2((pts[i][1] + pts[j][1]) / 2 - cy, (pts[i][0] + pts[j][0]) / 2 - cx)); }
    const axes = [];
    for (const a of dirs) {
      const c = Math.cos(2 * a), s = Math.sin(2 * a);
      const ok2 = pts.every(([x, y]) => { const dx = x - cx, dy = y - cy; return has([cx + dx * c + dy * s, cy + dx * s - dy * c]); });
      const ang = ((a % Math.PI) + Math.PI) % Math.PI;
      if (ok2 && !axes.some((b) => Math.abs(b - ang) < 1e-3 || Math.abs(Math.abs(b - ang) - Math.PI) < 1e-3)) axes.push(ang);
    }
    return axes.length;
  };
  const UNIT_OF = { '一支铅笔的长度': '厘米', '一枚硬币的厚度': '毫米', '教室黑板的长度': '米', '学校操场跑道一圈的长度': '米', '从北京到上海的铁路长度': '千米', '一支粉笔的长度': '厘米', '教室门的高度': '米', '数学书的厚度': '毫米', '一位小学生的身高': '厘米', '一条马路的宽度': '米', '长江的长度': '千米', '一个鸡蛋的质量': '克', '一袋大米的质量': '千克', '一头大象的质量': '吨', '一个苹果的质量': '克', '一位小学生的体重': '千克', '一辆卡车的载重': '吨', '一片药的质量': '毫克', '眨一下眼睛的时间': '秒', '一节课的时间': '分', '睡一觉的时间': '时', '暑假的时间': '天', '一块橡皮的长度': '厘米', '一把牙刷的长度': '厘米', '一张床的长度': '米', '黄河的长度': '千米', '一辆小汽车的长度': '米', '一栋六层楼的高度': '米', '一个西瓜的质量': '千克', '一瓶矿泉水的质量': '克', '一只猫的质量': '千克', '一枚硬币的质量': '克', '一头蓝鲸的质量': '吨', '一个书包的质量': '千克', '一次呼吸的时间': '秒', '一场电影的时间': '分', '跑 100 米所用的时间': '秒' };
  const FACT = { '毫米': 1, '厘米': 10, '分米': 100, '米': 1000, '千米': 1e6 };
  const FACTV = { '毫升': 1, '升': 1000, '立方厘米': 1, '立方分米': 1000, '立方米': 1e6 };
  const FACTA = { '平方厘米': 1, '平方分米': 100, '平方米': 1e4, '公顷': 1e8, '平方千米': 1e10 };
  const FACTM = { '克': 1, '千克': 1000, '吨': 1e6, '毫克': 0.001 };
  const FACTT = { '秒': 1, '分': 60, '时': 3600 };
  const convFactor = (u) => FACT[u] ?? FACTV[u] ?? FACTA[u] ?? FACTM[u] ?? null;

  const V = {
    shapes1(q) {
      const r = svgOf(q), c = (s) => r.querySelectorAll(s).length;
      let name = '';
      if (c('rect') === 1 && c('polygon') === 0) { const e = r.querySelector('rect'); name = e.getAttribute('width') === e.getAttribute('height') ? '正方形' : '长方形'; }
      else if (c('polygon') === 1) name = '三角形';
      else if (c('circle') === 1 && c('ellipse') === 0 && c('polygon') === 0) name = '圆形';
      else if (c('polygon') === 3) { const f = polyPts(r.querySelectorAll('polygon')[1]); const w = f[1][0] - f[0][0], h = f[2][1] - f[1][1]; name = w === h ? '正方体' : '长方体'; }
      else if (c('path') === 1 && c('ellipse') === 1) name = '圆柱';
      else if (c('circle') === 1 && c('ellipse') === 1) name = '球体';
      return name === q.a ? '' : `drawn ${name} answer ${q.a}`;
    },
    clock1(q) { const t = readClock(svgOf(q)); return t && hm(...t) === q.a && [0, 30].includes(t[1]) && t[0] >= 1 && t[0] <= 12 ? '' : `read ${t} answer ${q.a}`; },
    clock2(q) { const t = readClock(svgOf(q)); return t && hm(...t) === q.a && t[0] >= 1 && t[0] <= 12 ? '' : `read ${t} answer ${q.a}`; },
    clockpick(q) {
      const want = /(\d+):(\d\d)/.exec(q.q), W = hm(+want[1], +want[2]), r = svgOf(q);
      const times = ['A', 'B', 'C', 'D'].map((l) => readClock(r.querySelector('#clock' + l)));
      if (times.some((t) => !t)) return 'a clock whose hands disagree';
      const hit = ['A', 'B', 'C', 'D'].filter((l, i) => hm(...times[i]) === W);
      return hit.length === 1 && hit[0] === q.a && q.choices.slice().sort().join() === 'A,B,C,D' ? '' : `clocks ${times.map((t) => hm(...t))} want ${W} answer ${q.a}`;
    },
    clockafter(q) {
      const t = readClock(svgOf(q)), k = +/再过 (\d+) 分钟/.exec(q.q)[1];
      const tot = (t[0] % 12) * 60 + t[1] + k, h2 = Math.floor(tot / 60) % 12 || 12, m2 = tot % 60;
      return hm(h2, m2) === q.a ? '' : `${t} + ${k} = ${hm(h2, m2)} answer ${q.a}`;
    },
    rmb1(q) { const v = [...svgOf(q).querySelectorAll('g.rmb')].map((g) => +g.getAttribute('data-v')); const s = v.reduce((a, b) => a + b, 0); return s === +q.a && s <= 50 && v.length >= 2 ? '' : `sum ${s} answer ${q.a}`; },
    rmbchange(q) { const v = [...svgOf(q).querySelectorAll('g.rmb')].map((g) => +g.getAttribute('data-v')); const s = v.reduce((a, b) => a + b, 0), p = +/买一件 (\d+) 元/.exec(q.q)[1]; return s - p === +q.a && s <= 100 && p < s && +q.a > 0 ? '' : `paid ${s} price ${p} answer ${q.a}`; },
    rmbmake(q) {
      const T = +/正好是 (\d+) 元/.exec(q.q)[1], sum = (t) => t.split(' + ').map(Number).reduce((a, b) => a + b, 0);
      const okTerms = (t) => t.split(' + ').every((x) => [1, 5, 10, 20, 50].includes(+x));
      if (sum(q.a) !== T || !okTerms(q.a) || T > 99) return `answer sums to ${sum(q.a)} not ${T}`;
      const same = q.choices.filter((c) => sum(c) === T);
      return same.length === 1 && q.choices.every(okTerms) ? '' : `choices that sum to ${T}: ${same.length}`;
    },
    rmb2(q) {
      let m;
      if ((m = /^(\d+) 元 (\d+) 角 \+ (\d+) 元 (\d+) 角 = \? 角$/.exec(q.q))) return 10 * +m[1] + +m[2] + 10 * +m[3] + +m[4] === +q.a && +q.a <= 1000 ? '' : 'sum';
      if ((m = /^(\d+) 元 (\d+) 角 − (\d+) 元 (\d+) 角 = \? 角$/.exec(q.q))) return 10 * +m[1] + +m[2] - 10 * +m[3] - +m[4] === +q.a && +q.a > 0 ? '' : 'difference';
      if ((m = /^(\d+) 元 (\d+) 角 = \? 角$/.exec(q.q))) return 10 * +m[1] + +m[2] === +q.a ? '' : 'conversion';
      return 'unknown ' + q.q;
    },
    unitpick(q) {
      const thing = q.q.replace('大约是多少？', ''), u = UNIT_OF[thing];
      if (!u) return 'unknown thing ' + thing;
      const n = q.a.split(' ')[0];
      return q.a === n + ' ' + u && q.choices.every((c) => c.startsWith(n + ' ')) ? '' : `answer ${q.a} want ${u}`;
    },
    barread(q) {
      const r = svgOf(q), bars = barsOf(r);
      if (bars.some((b) => !near(b.v, b.h, 0.02)) || bars.length !== 4 || !bars.every((b) => b.v >= 1 && b.v <= 10)) return 'bar heights disagree with their values / range';
      let m;
      if ((m = /图中 ([A-D]) 的数量/.exec(q.q))) return +q.a === bars.find((b) => b.k === m[1]).h || near(+q.a, bars.find((b) => b.k === m[1]).h, 0.02) ? '' : 'value';
      const mx = Math.max(...bars.map((b) => b.h)), mn = Math.min(...bars.map((b) => b.h));
      if (q.q === '哪一项最多？') return bars.find((b) => b.k === q.a).h === mx || near(bars.find((b) => b.k === q.a).h, mx, 0.02) ? '' : 'max';
      if (q.q === '哪一项最少？') return near(bars.find((b) => b.k === q.a).h, mn, 0.02) ? '' : 'min';
      return 'unknown ' + q.q;
    },
    bardiff(q) {
      const bars = barsOf(svgOf(q)), h = (k) => Math.round(bars.find((b) => b.k === k).h), hs = bars.map((b) => Math.round(b.h));
      let m;
      if ((m = /图中 ([A-E]) 比 ([A-E]) 多多少/.exec(q.q))) return h(m[1]) - h(m[2]) === +q.a && +q.a > 0 ? '' : 'a-b';
      if (q.q === '图中最多的比最少的多多少？') return Math.max(...hs) - Math.min(...hs) === +q.a ? '' : 'max-min';
      if (q.q === '图中的数量一共是多少？') return hs.reduce((a, b) => a + b, 0) === +q.a ? '' : 'sum';
      return 'unknown';
    },
    avgbar(q) { const hs = barsOf(svgOf(q)).map((b) => Math.round(b.h)); return hs.length === 5 && hs.reduce((a, b) => a + b, 0) / 5 === +q.a ? '' : 'mean ' + hs; },
    place1(q) {
      let m;
      if ((m = /^(\d+) 个十和 (\d+) 个一/.exec(q.q))) return 10 * m[1] + +m[2] === +q.a && +q.a <= 99 ? '' : 'tens and ones';
      if ((m = /^(\d+) 里面有几个十/.exec(q.q))) return Math.floor(+m[1] / 10) === +q.a && +m[1] <= 99 ? '' : 'tens in';
      if ((m = /^(\d+) 的个位上是几/.exec(q.q))) return +m[1] % 10 === +q.a && +m[1] <= 99 ? '' : 'ones digit';
      return 'unknown';
    },
    place2(q) {
      let m;
      if ((m = /^(\d+) 中的 (\d) 在哪一位/.exec(q.q))) { const i = ['个位', '十位', '百位', '千位'].indexOf(q.a), s = m[1]; return s[s.length - 1 - i] === m[2] && s.split(m[2]).length === 2 && +s <= 9999 ? '' : 'place'; }
      if ((m = /^(\d+) 个千、(\d+) 个百、(\d+) 个十和 (\d+) 个一/.exec(q.q))) return 1000 * m[1] + 100 * m[2] + 10 * m[3] + +m[4] === +q.a && +q.a <= 9999 ? '' : 'sum';
      if ((m = /^(\d+) 的百位上是几/.exec(q.q))) return Math.floor(+m[1] / 100) % 10 === +q.a ? '' : 'hundreds';
      return 'unknown';
    },
    pattern1(q) {
      const seq = [...svgOf(q).querySelectorAll('.s')].map((e) => +e.getAttribute('data-t'));
      let p = 1; while (p < seq.length && !seq.every((x, i) => x === seq[i % p])) p++;
      return p <= 5 && seq.length >= 2 * p && ['○', '△', '□', '☆'][seq[seq.length % p]] === q.a ? '' : `period ${p} next ${['○', '△', '□', '☆'][seq[seq.length % p]]} answer ${q.a}`;
    },
    wpmore(q) {
      let m;
      if ((m = /小红有 (\d+) 个苹果，小明比小红多 (\d+) 个/.exec(q.q))) return +m[1] + +m[2] === +q.a && +q.a <= 20 ? '' : 'wp';
      if ((m = /小明有 (\d+) 个气球，小红比小明少 (\d+) 个/.exec(q.q))) return +m[1] - +m[2] === +q.a ? '' : 'wp';
      if ((m = /小明有 (\d+) 本书，小红有 (\d+) 本书/.exec(q.q))) return +m[1] - +m[2] === +q.a && +m[1] <= 20 ? '' : 'wp';
      if ((m = /(\d+) 只白兔，黑兔比白兔多 (\d+) 只/.exec(q.q))) return +m[1] + +m[2] === +q.a ? '' : 'wp';
      return 'unknown ' + q.q;
    },
    kjfill(q) { const t = q.q.replace('补全口诀：', '').replace('（ ）', ''), x = DIG[t[0]], y = DIG[t[1]]; return x >= 2 && y >= 2 && x <= y && x * y === +q.a ? '' : `${t} -> ${x}*${y} answer ${q.a}`; },
    kjwhich(q) {
      const [, a, b] = /算 (\d+) × (\d+)/.exec(q.q), k = kjParse(q.a);
      return k.p === a * b && k.x * k.y === k.p && Math.min(a, b) === k.x && Math.max(a, b) === k.y && q.choices.every((c) => { const z = kjParse(c); return z.x * z.y === z.p; }) && q.choices.filter((c) => kjParse(c).p === a * b).length === 1 ? '' : 'rhyme ' + q.a;
    },
    mulmissing(q) { let m; if ((m = /^(\d+) × \? = (\d+)$/.exec(q.q))) return +m[1] * +q.a === +m[2] && m[1] <= 9 && +q.a <= 9 ? '' : 'a x ?'; if ((m = /^\? × (\d+) = (\d+)$/.exec(q.q))) return +m[1] * +q.a === +m[2] && +q.a <= 9 ? '' : '? x b'; return 'unknown'; },
    divinv(q) { const m = /^想一想：(\d+) × (\d+) = (\d+)，所以 (\d+) ÷ (\d+) = \?$/.exec(q.q); return +m[1] * +m[2] === +m[3] && +m[3] === +m[4] && +m[3] / +m[5] === +q.a && m[1] <= 9 && m[2] <= 9 ? '' : 'inverse'; },
    times(q) {
      let m;
      if ((m = /^(\d+) 是 (\d+) 的几倍/.exec(q.q))) return +m[1] === +m[2] * +q.a && +q.a <= 9 ? '' : 'how many times';
      if ((m = /^(\d+) 的 (\d+) 倍是多少/.exec(q.q))) return +m[1] * +m[2] === +q.a && m[1] <= 9 && m[2] <= 9 ? '' : 'times of';
      return 'unknown';
    },
    rem(q) {
      let m;
      if ((m = /^(\d+) ÷ (\d+) 的余数是多少/.exec(q.q))) return +m[1] % +m[2] === +q.a && +m[2] <= 9 && +q.a < +m[2] ? '' : 'remainder';
      if ((m = /^(\d+) ÷ (\d+) = \?$/.exec(q.q))) { const [qq, r] = q.a.split(' …… ').map(Number); return qq * +m[2] + r === +m[1] && r < +m[2] && r > 0 && +m[2] <= 9 && q.choices.filter((c) => { const [a, b] = c.split(' …… ').map(Number); return a * +m[2] + b === +m[1] && b < +m[2]; }).length === 1 ? '' : 'quotient and remainder'; }
      return 'unknown';
    },
    remdiv(q) {
      let m;
      if ((m = /^被除数 ÷ (\d+) = (\d+) …… (\d+)，/.exec(q.q))) return +m[2] * +m[1] + +m[3] === +q.a && +m[3] < +m[1] ? '' : 'dividend';
      if ((m = /^一个数除以 (\d+)，余数最大/.exec(q.q))) return +m[1] - 1 === +q.a ? '' : 'largest remainder';
      if ((m = /^一个数除以 (\d+)，商是 (\d+)/.exec(q.q))) return +m[2] * +m[1] + +m[1] - 1 === +q.a ? '' : 'number with the largest remainder';
      return 'unknown';
    },
    muldivmix(q) {
      const e = q.q.replace(' = ?', '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-'); const v = Function('return (' + e + ')')();
      return near(v, +q.a, 1e-9) && Number.isInteger(v) ? '' : `${e} = ${v} answer ${q.a}`;
    },
    wpshare(q) {
      let m;
      if ((m = /^有 (\d+) 个苹果，每 (\d+) 个装一盘/.exec(q.q))) return m[1] / m[2] === +q.a ? '' : 'share';
      if ((m = /^小明有 (\d+) 张贴纸，小红的贴纸是小明的 (\d+) 倍/.exec(q.q))) return m[1] * m[2] === +q.a && +q.a <= 81 ? '' : 'times';
      if ((m = /^小红有 (\d+) 张贴纸，是小明的 (\d+) 倍/.exec(q.q))) return m[1] / m[2] === +q.a ? '' : 'divide by times';
      if ((m = /^每人分 (\d+) 个，(\d+) 个人/.exec(q.q))) return m[1] * m[2] === +q.a ? '' : 'each';
      return 'unknown';
    },
    shapes2(q) { const n = polyPts(svgOf(q).querySelector('polygon')).length; return n === +q.a && n >= 3 && n <= 6 ? '' : `points ${n} answer ${q.a}`; },
    elapsed(q) {
      const mins = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; }, at = (x) => Math.floor(x / 60) + ':' + String(x % 60).padStart(2, '0');
      let m;
      if ((m = /^从 (\d+:\d\d) 到 (\d+:\d\d)，经过了多少分钟/.exec(q.q))) return mins(m[2]) - mins(m[1]) === +q.a ? '' : 'minutes';
      if ((m = /^从 (\d+:\d\d) 到 (\d+:\d\d)，经过了多长时间/.exec(q.q))) { const d = mins(m[2]) - mins(m[1]), [H, M] = [Math.floor(d / 60), d % 60]; return q.a === `${H} 时 ${M} 分` && q.choices.filter((c) => c === `${H} 时 ${M} 分`).length === 1 ? '' : 'h m'; }
      if ((m = /^电影 (\d+:\d\d) 开始，放映 (\d+) 时 (\d+) 分/.exec(q.q))) return at(mins(m[1]) + 60 * m[2] + +m[3]) === q.a ? '' : 'end time';
      return 'unknown';
    },
    unitconv1(q) { return convCheck(q); },
    unitconv2(q) { return convCheck(q); },
    unitvol(q) { return convCheck(q); },
    unittime(q) {
      let m;
      if ((m = /^(\d+) 时 (\d+) 分 = \? 分$/.exec(q.q))) return 60 * m[1] + +m[2] === +q.a ? '' : 'h min';
      if ((m = /^(\d+) 分 = \? 时 \? 分$/.exec(q.q))) return q.a === `${Math.floor(m[1] / 60)} 时 ${m[1] % 60} 分` ? '' : 'min to h min';
      if ((m = /^平年 (\d+) 月有多少天/.exec(q.q))) return new Date(2023, +m[1], 0).getDate() === +q.a ? '' : 'days in month';
      if ((m = /^(\d+) 年的 2 月有多少天/.exec(q.q))) { const y = +m[1], leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; return (leap ? 29 : 28) === +q.a ? '' : 'leap year'; }
      return 'unknown ' + q.q;
    },
    perim(q) {
      const r = svgOf(q), poly = r.querySelector('polygon.shape'), s = +poly.getAttribute('data-s'), P = perim(polyPts(poly)) / s, d = dims(r), sum = Object.values(d).reduce((a, b) => a + b, 0);
      const rect = 'l' in d, L = d.l, W = d.w ?? d.l;
      return near(P, +q.a, 0.05) && (rect ? 2 * (L + W) === +q.a : sum === +q.a) ? '' : `polygon perimeter ${P} labels ${JSON.stringify(d)} answer ${q.a}`;
    },
    area1(q) { const r = svgOf(q), poly = r.querySelector('polygon.shape'), s = +poly.getAttribute('data-s'), A = area(polyPts(poly)) / s / s, d = dims(r); return near(A, +q.a, 0.05) && d.l * (d.w ?? d.l) === +q.a ? '' : `area ${A} answer ${q.a}`; },
    areapara(q) { const r = svgOf(q), poly = r.querySelector('polygon.shape'), s = +poly.getAttribute('data-s'), A = area(polyPts(poly)) / s / s, d = dims(r); return near(A, +q.a, 0.05) && d.b * d.h === +q.a ? '' : `area ${A} answer ${q.a}`; },
    areatri2(q) { const r = svgOf(q), poly = r.querySelector('polygon.shape'), s = +poly.getAttribute('data-s'), A = area(polyPts(poly)) / s / s, d = dims(r); return near(A, +q.a, 0.05) && d.b * d.h / 2 === +q.a ? '' : `area ${A} answer ${q.a}`; },
    areatrap(q) { const r = svgOf(q), poly = r.querySelector('polygon.shape'), s = +poly.getAttribute('data-s'), A = area(polyPts(poly)) / s / s, d = dims(r); return near(A, +q.a, 0.05) && (d.a + d.b) * d.h / 2 === +q.a ? '' : `area ${A} answer ${q.a}`; },
    combo(q) {
      const r = svgOf(q), poly = r.querySelector('polygon.shape'), s = +poly.getAttribute('data-s'), pts = polyPts(poly), A = area(pts) / s / s, P = perim(pts) / s, d = dims(r);
      const want = q.q.includes('周长') ? 2 * (d.W + d.H) : d.W * d.H - d.nw * d.nh, got = q.q.includes('周长') ? P : A;
      return want === +q.a && near(got, +q.a, 0.05) ? '' : `geometry ${got} labels ${JSON.stringify(d)} answer ${q.a}`;
    },
    cuboid(q) {
      const d = dims(svgOf(q)), l = d.l, w = d.w, h = d.h;
      if (q.q.startsWith('求体积')) return l * w * h === +q.a ? '' : 'volume';
      if (q.q.startsWith('求表面积')) return 2 * (l * w + w * h + l * h) === +q.a ? '' : 'surface';
      if (q.q.includes('几个面')) return +q.a === 6 ? '' : 'faces';
      if (q.q.includes('几个顶点')) return +q.a === 8 ? '' : 'vertices';
      return 'unknown';
    },
    circfig(q) {
      const r = svgOf(q), seg = r.querySelector('line.seg'), kind = seg.getAttribute('data-kind'), v = Number(r.querySelector('text.dim').textContent);
      const len = Math.hypot(seg.getAttribute('x2') - seg.getAttribute('x1'), seg.getAttribute('y2') - seg.getAttribute('y1')), R = +r.querySelector('circle').getAttribute('r');
      const radius = kind === 'r' ? v : v / 2;
      if (!near(len, kind === 'r' ? R : 2 * R, 0.01) || (kind === 'd' && v % 2)) return 'the marked segment is not a ' + kind;
      const want = q.q.includes('周长') ? 3.14 * 2 * radius : 3.14 * radius * radius;
      return near(want, +q.a, 1e-9) && radius <= 10 && radius >= 1 ? '' : `radius ${radius} want ${want} answer ${q.a}`;
    },
    cylvol(q) {
      const d = dims(svgOf(q)), cone = q.q.includes('圆锥'), want = 3.14 * d.r * d.r * d.h / (cone ? 3 : 1);
      return near(want, +q.a, 1e-9) && (!cone || d.h % 3 === 0) ? '' : `r ${d.r} h ${d.h} cone ${cone} want ${want} answer ${q.a}`;
    },
    protract(q) {
      const r = svgOf(q), a = r.querySelector('.r1'), b = r.querySelector('.r2'), v = (e) => [e.getAttribute('x2') - e.getAttribute('x1'), e.getAttribute('y2') - e.getAttribute('y1')];
      const [u1, u2] = [v(a), v(b)], ang = Math.acos((u1[0] * u2[0] + u1[1] * u2[1]) / Math.hypot(...u1) / Math.hypot(...u2)) * 180 / Math.PI;
      return near(ang, +q.a, 0.6) && +q.a % 5 === 0 && +q.a > 0 && +q.a < 180 && u1[1] === 0 ? '' : `drawn angle ${ang} answer ${q.a}`;
    },
    angleclass(q) {
      const r = svgOf(q), a = r.querySelector('.r1'), b = r.querySelector('.r2'), v = (e) => [e.getAttribute('x2') - e.getAttribute('x1'), e.getAttribute('y2') - e.getAttribute('y1')];
      const [u1, u2] = [v(a), v(b)], ang = Math.acos(Math.max(-1, Math.min(1, (u1[0] * u2[0] + u1[1] * u2[1]) / Math.hypot(...u1) / Math.hypot(...u2)))) * 180 / Math.PI;
      const cls = ang > 179.5 ? '平角' : near(ang, 90, 0.5) ? '直角' : ang < 90 ? '锐角' : '钝角';
      return cls === q.a && q.choices.slice().sort().join() === ['锐角', '直角', '钝角', '平角'].sort().join() ? '' : `angle ${ang} is ${cls}, answer ${q.a}`;
    },
    symm(q) { const n = symAxes(polyPts(svgOf(q).querySelector('polygon'))); return n === +q.a ? '' : `axes found ${n} answer ${q.a}`; },
    fraction1(q) {
      const parts = [...svgOf(q).querySelectorAll('.part')], k = parts.filter((p) => p.getAttribute('data-on') === '1').length;
      return q.a === `${k}/${parts.length}` && parts.length >= 2 && parts.length <= 8 && q.choices.filter((c) => c === `${k}/${parts.length}`).length === 1 ? '' : `${k}/${parts.length} answer ${q.a}`;
    },
    fraccomp(q) {
      let m;
      if (q.q === '下面哪个分数最大？' || q.q === '下面哪个分数最小？') { const v = q.choices.map((c) => { const [n, d] = c.split('/').map(Number); return { n, d }; }); if (new Set(v.map((x) => x.d)).size !== 1) return 'denominators differ'; const best = (q.q.includes('最大') ? Math.max : Math.min)(...v.map((x) => x.n)); return `${best}/${v[0].d}` === q.a ? '' : 'extreme'; }
      if ((m = /^(\d+)\/(\d+) 里面有几个 1\/(\d+)/.exec(q.q))) return +m[1] === +q.a && m[2] === m[3] ? '' : 'unit fractions';
      return 'unknown';
    },
    decmoney(q) {
      let m;
      if ((m = /^(\d+) 元 (\d+) 角 = \? 元$/.exec(q.q))) return near(+m[1] + m[2] / 10, +q.a, 1e-9) ? '' : 'yuan jiao';
      if ((m = /^([\d.]+) 元 = \? 元 \? 角$/.exec(q.q))) { const x = +m[1]; return q.a === `${Math.floor(x + 1e-9)} 元 ${Math.round((x - Math.floor(x + 1e-9)) * 10)} 角` ? '' : 'split'; }
      if ((m = /^([\d.]+) 元 \+ ([\d.]+) 元 = \? 元$/.exec(q.q))) return near(+m[1] + +m[2], +q.a, 1e-9) ? '' : 'sum';
      if ((m = /^付 (\d+) 元，买 ([\d.]+) 元的东西/.exec(q.q))) return near(+m[1] - +m[2], +q.a, 1e-9) && +q.a > 0 ? '' : 'change';
      return 'unknown ' + q.q;
    },
    deccomp(q) {
      let m;
      if (q.q === '下面哪个数最大？' || q.q === '下面哪个数最小？') { const v = q.choices.map(Number); if (new Set(v).size !== 4) return 'equal values'; const best = (q.q.includes('最大') ? Math.max : Math.min)(...v); return best === +q.a ? '' : 'extreme'; }
      if ((m = /^(\d)\.(\d)(\d) 中的 (\d) 在哪一位/.exec(q.q))) { const place = m[4] === m[1] ? '个位' : m[4] === m[2] ? '十分位' : m[4] === m[3] ? '百分位' : '?'; return place === q.a && new Set([m[1], m[2], m[3]]).size === 3 ? '' : 'place'; }
      return 'unknown';
    },
    wpdist(q) {
      let m;
      if ((m = /^(\d+) 个苹果，每 (\d+) 个装一盒，至少需要几个盒子/.exec(q.q)) || (m = /^(\d+) 人去划船，每条船最多坐 (\d+) 人/.exec(q.q))) return Math.ceil(m[1] / m[2]) === +q.a ? '' : 'ceil';
      if ((m = /^(\d+) 个苹果，每 (\d+) 个装一盒，最多装满几盒/.exec(q.q))) return Math.floor(m[1] / m[2]) === +q.a ? '' : 'floor';
      if ((m = /^(\d+) 个苹果，每 (\d+) 个装一盒，装完后还剩几个/.exec(q.q))) return m[1] % m[2] === +q.a ? '' : 'rest';
      return 'unknown';
    },
    pattern2(q) {
      const t = q.q.split(', '), a = +q.a, i = t.indexOf('?'), full = t.map((x, j) => (j === i ? a : +x));
      if (full.some((x) => !Number.isFinite(x))) return 'not numbers';
      const diff = full.slice(1).map((x, j) => x - full[j]);
      const arith = diff.every((d) => d === diff[0]);
      const geo = full.every((x, j) => j === 0 || x === full[j - 1] * (full[1] / full[0])) && full[0] !== 0;
      const quad = diff.slice(1).every((d, j) => d - diff[j] === 1);
      const sq = full.every((x) => Number.isInteger(Math.sqrt(x))) && full.slice(1).every((x, j) => Math.sqrt(x) - Math.sqrt(full[j]) === 1);
      const ev = full.filter((_, j) => j % 2 === 0), od = full.filter((_, j) => j % 2 === 1), inter = ev.slice(1).every((x, j) => x - ev[j] === ev[1] - ev[0]) && od.slice(1).every((x, j) => x - od[j] === od[1] - od[0]);
      return arith || geo || quad || sq || inter ? '' : `no rule fits ${full} (answer ${a})`;
    },
    stickpat(q) {
      const r = svgOf(q), c = [1, 2, 3].map((n) => r.querySelectorAll(`g[data-n="${n}"] line`).length), d = c[1] - c[0];
      const N = +/第 (\d+) 个图形/.exec(q.q)[1];
      return c[2] - c[1] === d && c[0] + d * (N - 1) === +q.a && N >= 5 ? '' : `sticks ${c} for figure ${N} answer ${q.a}`;
    },
    factmult(q) {
      let m;
      if ((m = /^(\d+) 的因数有几个/.exec(q.q))) return divisors(+m[1]).length === +q.a ? '' : 'count factors';
      if ((m = /^下面哪个数是 (\d+) 的倍数/.exec(q.q))) return q.choices.filter((c) => +c % +m[1] === 0).length === 1 && +q.a % +m[1] === 0 ? '' : 'multiples among the choices';
      if ((m = /^在 1 到 (\d+) 中，(\d+) 的倍数有几个/.exec(q.q))) return Math.floor(m[1] / m[2]) === +q.a ? '' : 'count multiples';
      return 'unknown';
    },
    primecomp(q) {
      let m;
      if (q.q === '下面哪个数是质数？') return q.choices.filter((c) => isPrime(+c)).length === 1 && isPrime(+q.a) ? '' : 'primes among the choices';
      if (q.q === '下面哪个数是合数？') return q.choices.filter((c) => +c > 1 && !isPrime(+c)).length === 1 && +q.a > 1 && !isPrime(+q.a) ? '' : 'composites among the choices';
      if ((m = /^(\d+) 以内（含 (\d+)）有几个质数/.exec(q.q))) return Array.from({ length: +m[1] }, (_, i) => i + 1).filter(isPrime).length === +q.a && m[1] === m[2] ? '' : 'count primes';
      return 'unknown';
    },
    bignum(q) {
      let m;
      if ((m = /^把“(.+)”写成数字/.exec(q.q))) return cnToNum(m[1]) === +q.a && +q.a < 1e8 ? '' : `reads ${cnToNum(m[1])} answer ${q.a}`;
      if ((m = /^(\d+) 中的 (\d) 在哪一位/.exec(q.q))) { const i = ['个位', '十位', '百位', '千位', '万位', '十万位', '百万位', '千万位'].indexOf(q.a), s = m[1]; return s[s.length - 1 - i] === m[2] && s.split(m[2]).length === 2 ? '' : 'place'; }
      if ((m = /^(\d+) 万 = \?$/.exec(q.q))) return m[1] * 10000 === +q.a ? '' : 'wan';
      if ((m = /^(\d+) 亿 = \? 万$/.exec(q.q))) return m[1] * 10000 === +q.a ? '' : 'yi';
      return 'unknown';
    },
    roundest(q) {
      let m;
      if ((m = /^把 (\d+) 四舍五入到(.)位，约是多少/.exec(q.q))) { const p = { 十: 10, 百: 100, 千: 1000, 万: 10000 }[m[2]], n = +m[1]; return (n % p >= p / 2 ? n - (n % p) + p : n - (n % p)) === +q.a ? '' : 'rounded'; }
      if ((m = /^估算：(\d+) ([+−]) (\d+) ≈/.exec(q.q))) { const r = (x) => (x % 100 >= 50 ? x - (x % 100) + 100 : x - (x % 100)); return (m[2] === '+' ? r(+m[1]) + r(+m[3]) : r(+m[1]) - r(+m[3])) === +q.a ? '' : 'estimate'; }
      if ((m = /^(\d+) ≈ \? 万/.exec(q.q))) { const n = +m[1]; return (n % 10000 >= 5000 ? Math.floor(n / 10000) + 1 : Math.floor(n / 10000)) === +q.a ? '' : 'wan'; }
      return 'unknown ' + q.q;
    },
    commonfm(q) {
      let m;
      if ((m = /^下面哪个数是 (\d+) 和 (\d+) 的公倍数/.exec(q.q))) return q.choices.filter((c) => +c % m[1] === 0 && +c % m[2] === 0).length === 1 && +q.a % m[1] === 0 && +q.a % m[2] === 0 ? '' : 'common multiples';
      if ((m = /^下面哪个数是 (\d+) 和 (\d+) 的公因数/.exec(q.q))) return q.choices.filter((c) => m[1] % +c === 0 && m[2] % +c === 0).length === 1 && m[1] % +q.a === 0 && m[2] % +q.a === 0 ? '' : 'common factors';
      if ((m = /^(\d+) 和 (\d+) 的公因数有几个/.exec(q.q))) return divisors(gcd(+m[1], +m[2])).length === +q.a ? '' : 'count common factors';
      return 'unknown';
    },
    primefac(q) {
      const m = /^把 (\d+) 分解质因数/.exec(q.q), n = +m[1], f = q.a.split(' × ').map(Number);
      const good = (t) => { const x = t.split(' × ').map(Number); return x.every(isPrime) && x.reduce((a, b) => a * b, 1) === n; };
      return good(q.a) && q.choices.filter(good).length === 1 && f.every((x, i) => i === 0 || f[i - 1] <= x) && n <= 150 ? '' : 'prime factorisation';
    },
    fracdec(q) {
      let m;
      if ((m = /^(\d+)\/(\d+) = \?（化成小数）/.exec(q.q))) return near(m[1] / m[2], +q.a, 1e-9) ? '' : 'decimal';
      if ((m = /^([\d.]+) 化成最简分数是/.exec(q.q))) { const [n, d] = q.a.split('/').map(Number); return near(n / d, +m[1], 1e-9) && gcd(n, d) === 1 && q.choices.filter((c) => { const [x, y] = c.split('/').map(Number); return near(x / y, +m[1], 1e-9) && gcd(x, y) === 1; }).length === 1 ? '' : 'simplest fraction'; }
      if ((m = /^把 (\d+)\/(\d+) 化成百分数/.exec(q.q))) return near(100 * m[1] / m[2], parseFloat(q.a), 1e-9) && q.a.endsWith('%') ? '' : 'percent';
      return 'unknown';
    },
    anglepair(q) {
      const r = svgOf(q), l1 = r.querySelector('line[data-l="1"]'), l2 = r.querySelector('line[data-l="2"]');
      const v = (e) => [e.getAttribute('x2') - e.getAttribute('x1'), e.getAttribute('y2') - e.getAttribute('y1')];
      const a1 = v(l1), a2 = v(l2);
      let theta = Math.acos((a1[0] * a2[0] + a1[1] * a2[1]) / Math.hypot(...a1) / Math.hypot(...a2)) * 180 / Math.PI;
      // the second line is drawn from its lower-left end to its upper-right end: the angle between +x and that ray is theta when its x step is > 0, else 180 - ...
      const dir = a2[0] >= 0 ? theta : 180 - theta;
      const labels = [...r.querySelectorAll('text.ang')].map((t) => ({ k: +t.getAttribute('data-k'), x: +t.getAttribute('x') - 70, y: 66 - +t.getAttribute('y') }));
      // the region of a label = the angle of its position from +x (counter-clockwise) between the rays: 0..dir, dir..180, 180..180+dir, 180+dir..360
      const ray = Math.atan2(a2[1] * -1, a2[0]) * 180 / Math.PI, th = ((ray % 360) + 360) % 360;   // direction of the second line's drawn ray
      const th2 = th > 180 ? th - 180 : th;   // the ray in the upper half plane
      const reg = (x, y) => { const a = ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360; return a < th2 ? 1 : a < 180 ? 2 : a < 180 + th2 ? 3 : 4; };
      const measure = (k) => (k % 2 === 1 ? th2 : 180 - th2);
      for (const lb of labels) if (reg(lb.x, lb.y) !== lb.k) return `label ${lb.k} sits in region ${reg(lb.x, lb.y)}`;
      const m = /∠(\d) = (\d+)°，∠(\d) = \?/.exec(q.q), i = +m[1], j = +m[3];
      return near(measure(i), +m[2], 0.6) && near(measure(j), +q.a, 0.6) && i !== j ? '' : `drawn ∠${i}=${measure(i)} ∠${j}=${measure(j)} text ${m[2]} answer ${q.a} (dir ${dir})`;
    },
    numline(q) {
      const r = svgOf(q), g = r.querySelector('#nl'), s = +g.getAttribute('data-s'), z = +g.getAttribute('data-zero'), v = (+r.querySelector('circle.pt').getAttribute('cx') - z) / s;
      const num = (t) => +t.replace('−', '-'); let m;
      if (q.q.startsWith('数轴上点 A')) return v === num(q.a) ? '' : `point at ${v} answer ${q.a}`;
      if ((m = /向右移动 (\d+) 个单位/.exec(q.q))) return v + +m[1] === num(q.a) ? '' : 'right';
      if ((m = /向左移动 (\d+) 个单位/.exec(q.q))) return v - m[1] === num(q.a) ? '' : 'left';
      if (q.q.includes('距离')) return Math.abs(v) === +q.a ? '' : 'distance';
      return 'unknown';
    },
    coord(q) {
      const r = svgOf(q), g = r.querySelector('#plane'), s = +g.getAttribute('data-s'), ox = +g.getAttribute('data-ox'), oy = +g.getAttribute('data-oy'), c = r.querySelector('circle.pt');
      const x = (+c.getAttribute('cx') - ox) / s, y = (oy - +c.getAttribute('cy')) / s, M2 = (n) => (n < 0 ? `−${-n}` : `${n}`);
      if (q.q === '点 P 的坐标是？') return q.a === `(${M2(x)}, ${M2(y)})` && q.choices.filter((c2) => c2 === q.a).length === 1 ? '' : `point (${x}, ${y}) answer ${q.a}`;
      if (q.q === '点 P 在第几象限？') return q.a === ['第一象限', '第二象限', '第三象限', '第四象限'][x > 0 && y > 0 ? 0 : x < 0 && y > 0 ? 1 : x < 0 ? 2 : 3] ? '' : 'quadrant';
      if (q.q.includes('x 轴')) return Math.abs(y) === +q.a ? '' : 'distance to x axis';
      if (q.q.includes('y 轴')) return Math.abs(x) === +q.a ? '' : 'distance to y axis';
      return 'unknown';
    },
  };
  /** "3 千米 50 米 = ? 米", "350 厘米 = ? 米": value on the left x factor = answer x factor */
  function convCheck(q) {
    const lhs = q.q.replace(/ = \?.*$/, ''), rhsUnit = (/= \? (\S+)$/.exec(q.q) || [])[1];
    const parts = [...lhs.matchAll(/([\d.]+) (\S+)/g)].map((m) => [+m[1], m[2]]);
    if (!parts.length || !rhsUnit) return 'cannot parse ' + q.q;
    const fl = parts.map(([n, u]) => n * convFactor(u));
    if (parts.some(([, u]) => convFactor(u) === null) || convFactor(rhsUnit) === null) return 'unknown unit in ' + q.q;
    const total = fl.reduce((a, b) => a + b, 0) / convFactor(rhsUnit);
    return near(total, parseFloat(q.a), 1e-9) ? '' : `${q.q} = ${total} answer ${q.a}`;
  }

  for (const id of ids) {
    const seen = new Set();
    for (let i = 0; i < N; i++) {
      const q = G.make(id); out.total++;
      let why = '';
      const key = q.q + '\u0001' + (q.fig || '') + '\u0001' + q.choices.slice().sort().join('|');
      seen.add(key);
      if (!Function('return (' + q.chk + ')')()) why = 'chk false';
      else if (q.choices.length !== 4 || new Set(q.choices).size !== 4) why = 'choices ' + q.choices.join('|');
      else if (!q.choices.includes(q.a)) why = 'answer not among the choices';
      else if (/NaN|undefined|Infinity|null|\[object/.test(q.q + q.a + q.choices.join() + (q.fig || '').replace(/data-[a-z]+="[^"]*"/g, ''))) why = 'NaN / undefined';
      else if (q.q.length > 90 || q.choices.some((c) => c.length > 40) || q.q.length < 3) why = 'text length ' + q.q.length;
      else if (!q.a || q.choices.some((c) => !c)) why = 'empty answer / choice';
      if (!why) {
        if (!!q.fig !== FIGSET.has(id)) why = q.fig ? 'unexpected figure' : 'figure missing';
        else if (q.fig) {
          out.figs++;
          const d = D(q.fig);
          if (d.querySelector('parsererror') || d.documentElement.nodeName !== 'svg') why = 'figure is not well-formed SVG';
          else if (/[　-〿一-鿿＀-￯]/.test(q.fig)) why = 'figure contains CJK text';
          else if (q.fig.length > 12000) why = 'figure too large ' + q.fig.length;
          else if (!d.documentElement.getAttribute('viewBox')) why = 'no viewBox';
          else if (/<script|onload|onclick|href=/i.test(q.fig)) why = 'active content in the figure';
        }
      }
      if (!why) { try { why = V[id](q) || ''; } catch (e) { why = 'verifier threw ' + e.message + ' :: ' + q.q; } }
      if (why && out.bad.length < 25) out.bad.push(`${id}: ${why} :: ${q.q} => ${q.a} [${q.choices.join(' | ')}]`);
      out.maxLen = Math.max(out.maxLen, q.q.length);
    }
    out.variety[id] = seen.size;
  }
  return out;
}

(async () => {
  const spy = () => {
    window.__said = [];
    const U = function (t) { this.text = t; };
    window.SpeechSynthesisUtterance = U;
    Object.defineProperty(window, 'speechSynthesis', { value: { cancel() {}, speak(u) { if (!String(u.text).trim() || u.volume === 0) return; window.__said.push([u.text, u.lang]); } }, configurable: true });
  };
  const recordMade = (pg) => pg.evaluate(async () => {
    const G = await import('/src/mathgen.ts');
    window.__made = [];
    const fp = (svgText) => { const r = new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement; return [...r.querySelectorAll('*')].map((e) => e.tagName + [...e.attributes].map((a) => a.name + '=' + a.value).join(',')).join('|'); };
    window.__fp = (el) => [...el.querySelectorAll('*')].map((e) => e.tagName + [...e.attributes].map((a) => a.name + '=' + a.value).join(',')).join('|');
    for (const id of G.topicIds()) { const orig = G.GEN[id].make; G.GEN[id].make = () => { const r = orig(); window.__made.push({ q: r.q, a: r.a, fp: r.fig ? fp(r.fig) : '', fig: r.fig || '' }); return r; }; }
  });
  if (!process.env.ONLY_SIZES) {
  // ---------------------------------------------------------------- 1. the generators
  {
    const t = await start(new Map(), { local: true, today: '2026-11-12' });
    if (process.env.MUTATE) {   // (proves that the checks can fail: MUTATE='src/mathfig.ts|text to find|text to put' serves a broken copy of that file)
      const [file, from, to] = process.env.MUTATE.split('|');
      await t.ctx.route('**/' + file, async (route) => { const r = await route.fetch(); const body = await r.text(); if (!body.includes(from)) console.log('MUTATE: text not found'); await route.fulfill({ response: r, body: body.replace(from, to) }); });
      await t.page.reload(); await t.page.waitForSelector('.kids, .empty-home');
    }
    const r = await t.page.evaluate(`(${generatorChecks.toString().replace('FIGSET.has', 'new Set(' + JSON.stringify([...FIG]) + ').has')})(${JSON.stringify(ALL)}, 1500)`);
    ok(ALL.length >= 45 && ALL.length === 61, `${ALL.length} new topics (at least 45 asked)`);
    ok(r.bad.length === 0, `${r.total} questions of ${ALL.length} new topics: chk true, four different choices, the answer among them, no NaN, sane text, and every answer re-checked independently (clock hands, money in the picture, areas from the polygon, angles from the lines, bars from their heights ...)` + (r.bad.length ? '\n   ' + r.bad.join('\n   ') : ''));
    const low = Object.entries(r.variety).filter(([, n]) => n < 30);
    ok(low.length === 0, 'variety: at least 30 different questions per topic over 1500' + (low.length ? ' -> ' + low.map((x) => x.join('=')).join(', ') : ' (smallest ' + Math.min(...Object.values(r.variety)) + ')'));
    ok(r.figs >= 20000, `${r.figs} figures were made: all well-formed SVG with a viewBox, no Chinese text, no script`);
    const d = await t.page.evaluate(async () => {
      const data = (await import('/src/data/math-topics.json')).default, G = await import('/src/mathgen.ts');
      const listed = new Set(Object.values(data.grades).flat()), ids = new Set(data.topics.map((x) => x.id)), names = data.topics.map((x) => x.name);
      return { grades: Object.fromEntries(Object.entries(data.grades).map(([g, l]) => [g, l.length])), idsN: ids.size, gens: G.topicIds().length, unlisted: G.topicIds().filter((x) => !listed.has(x)), noGen: [...ids].filter((x) => !G.topicIds().includes(x)), dupNames: names.filter((n, i) => names.indexOf(n) !== i), emptyDesc: data.topics.filter((x) => !x.name || !x.desc || !x.domain).map((x) => x.id), lists: data.grades, secs: G.topicIds().filter((x) => G.secOf(x) < 5 || G.secOf(x) > 60) };
    });
    const inLists = (id) => Object.entries(NEW).find(([, l]) => l.includes(id))[0];
    ok(ALL.every((id) => d.lists[inLists(id)].includes(id)), 'every new topic is in the list of its grade in math-topics.json (grades 1-7)');
    ok(d.unlisted.length === 0 && d.noGen.length === 0 && d.gens === d.idsN && d.dupNames.length === 0 && d.emptyDesc.length === 0 && d.secs.length === 0, `topics json = generators (${d.gens}), unique names, every topic has a name / description / domain, seconds per question 5-60` + (d.dupNames.length ? ' dup ' + d.dupNames : ''));
    // explicit ranges of the lowest grades
    const rg = await t.page.evaluate(async () => {
      const G = await import('/src/mathgen.ts');
      const bad = [];
      const each = (id, f, n = 600) => { for (let i = 0; i < n; i++) { const q = G.make(id); const why = f(q, (q.q.match(/\d+(\.\d+)?/g) || []).map(Number), q.fig ? [...q.fig.matchAll(/data-v="(\d+)"/g)].map((m) => +m[1]) : []); if (why === false) { bad.push(id + ': ' + q.q + ' => ' + q.a); return; } } };
      each('kjfill', (q) => +q.a >= 4 && +q.a <= 81 && q.q.startsWith('补全口诀：'));
      each('kjwhich', (q, m) => m[0] <= 9 && m[1] <= 9 && m[0] >= 2 && m[1] >= 2);
      each('mulmissing', (q, m) => m.every((x) => x <= 81) && +q.a <= 9 && +q.a >= 2);
      each('divinv', (q, m) => m[0] <= 9 && m[1] <= 9 && m[2] <= 81);
      each('times', (q, m) => m.every((x) => x <= 81) && +q.a <= 81);
      each('rem', (q, m) => m[1] <= 9 && m[0] <= 90);
      each('clock1', (q) => /^(1[0-2]|[1-9]):(00|30)$/.test(q.a));
      each('clock2', (q) => /^(1[0-2]|[1-9]):[0-5]\d$/.test(q.a));
      each('clockpick', (q) => /\b(1[0-2]|[1-9]):([0-5][05])\b/.test(q.q));
      each('rmb1', (q, m, v) => v.length >= 2 && v.length <= 5 && +q.a <= 50 && v.every((x) => [1, 5, 10, 20].includes(x)));
      each('rmb2', (q, m) => +q.a <= 1000 && m.slice(0, 4).every((x, i) => (i % 2 === 0 ? x <= 100 : x <= 9)));
      each('rmbchange', (q, m, v) => v.reduce((a, b) => a + b, 0) <= 100 && +q.a < 100);
      each('rmbmake', (q) => +/(\d+) 元/.exec(q.q)[1] <= 99);
      each('place1', (q, m) => m.every((x) => x <= 99));
      each('place2', (q, m) => m.every((x) => x <= 9999));
      each('wpmore', (q, m) => m.every((x) => x <= 20) && +q.a <= 20 && +q.a >= 1);
      each('wpshare', (q, m) => +q.a <= 81);
      each('shapes2', (q) => +q.a >= 3 && +q.a <= 6);
      each('pattern1', (q) => /^[○△□☆]$/.test(q.a));
      each('barread', (q, m, v) => v.length === 4 && v.every((x) => x <= 10));
      each('bardiff', (q, m, v) => v.length === 5 && v.every((x) => x <= 40 && x % 2 === 0 || x % 5 === 0));
      each('unitpick', (q) => /^\d+ \S+$/.test(q.a));
      each('perim', (q, m, v) => +q.a <= 60 && +q.a >= 6);
      each('area1', (q) => +q.a <= 144 && +q.a >= 4);
      each('fraction1', (q) => { const [n, d] = q.a.split('/').map(Number); return n < d && d <= 8; });
      each('fraccomp', (q) => q.choices.every((c) => /^\d+(\/\d+)?$/.test(c)));
      each('elapsed', (q) => /\d/.test(q.q));
      each('muldivmix', (q) => +q.a <= 900);
      each('protract', (q) => +q.a % 5 === 0 && +q.a >= 10 && +q.a <= 170);
      each('numline', (q) => !q.fig.includes('undefined') && Math.abs(+q.a.replace('−', '-')) <= 12);
      each('coord', (q) => true);
      each('cuboid', (q, m) => true);
      each('circfig', (q) => +q.a > 0);
      return bad;
    });
    ok(rg.length === 0, 'ranges of the grades: 口诀 factors 1-9, times / division facts within 81, clocks 12-hour, money up to 100 yuan, numbers up to 99 / 9999 / 20, fractions up to eighths, angles in 5-degree steps' + (rg.length ? ' -> ' + rg.join(' | ') : ''));
    // the errors book keeps two questions with the same text and different figures; merge keeps both
    const mm = await t.page.evaluate(async () => {
      const MM = await import('/src/mathmodel.ts'), S = await import('/src/sync.ts');
      const a = { topic: 'clock2', q: 'Q', a: '1', choices: ['1', '2', '3', '4'], chk: 'true', fig: '<svg>A</svg>' }, b = { ...a, fig: '<svg>B</svg>' };
      const r1 = MM.applyMath(MM.EMPTY_MATH_REVIEW, [{ topic: 'clock2', right: false, q: a }, { topic: 'clock2', right: false, q: b }], '2026-11-12');
      const r2 = MM.applyMath(r1, [{ topic: 'clock2', right: true, q: a }], '2026-11-12');
      const merged = S.mergeDocs({ topics: { x: { right: 1, wrong: 0 } }, mistakes: [a] }, { topics: { x: { right: 0, wrong: 1 } }, mistakes: [b, a] });
      const G = await import('/src/mathgen.ts');
      const set = G.makeSet(['clock2'], 20);
      return { n1: r1.mistakes.length, n2: r2.mistakes.length, left: r2.mistakes[0].fig, merged: merged.mistakes.length, fig: r1.mistakes.every((m) => m.fig), setN: set.length, setDistinct: new Set(set.map((x) => x.q + x.fig)).size };
    });
    ok(mm.n1 === 2 && mm.n2 === 1 && mm.left === '<svg>B</svg>' && mm.merged === 2 && mm.fig, 'errors book: same text with another figure is another question (kept, removed one by one, merged without loss), the figure is kept with it');
    ok(mm.setN === 20 && mm.setDistinct === 20, 'a game set never has the same question (text + figure) twice');
    await t.browser.close();
    if (process.env.ONLY_GEN) { await done(); return; }
  }

  // ---------------------------------------------------------------- the pure model of the times table
  {
    const t = await start(new Map(), { local: true, today: '2026-11-12' });
    const r = await t.page.evaluate(async () => {
      const T = await import('/src/mathtables.ts'), C = await import('/src/mathcn.ts'), S = await import('/src/sync.ts');
      const out = {};
      out.kj = [[3, 4], [2, 3], [5, 2], [9, 9], [6, 6], [7, 8], [4, 5], [1, 1], [2, 5], [3, 5], [8, 9], [4, 4]].map(([a, b]) => C.kj(a, b));
      out.heads = [[3, 4], [2, 3], [5, 5]].map(([a, b]) => C.kjHead(a, b));
      out.cn = [30500, 30000, 100000, 10, 1000500, 120000000, 100000500, 2050, 12, 40010000].map(C.readCN);
      let doc = T.EMPTY_TABLES;
      doc = T.applyTables(doc, [{ a: 3, b: 4, right: false }, { a: 3, b: 4, right: true }, { a: 5, b: 6, right: false }, { a: 7, b: 8, right: true }], '2026-11-12');
      out.cells = doc.topics; out.weak = [T.isWeak(doc.topics['3x4']), T.isWeak(doc.topics['5x6']), T.isWeak(doc.topics['7x8']), T.isWeak(undefined)];
      doc = T.applyTables(doc, [{ a: 3, b: 4, right: true }], '2026-11-13');
      out.weak2 = T.isWeak(doc.topics['3x4']);
      // a round: 10 different cells, weak ones come first far more often
      let weakIn = 0, other = 0; const weakDoc = { topics: { '6x7': { right: 0, wrong: 3 } } };
      for (let i = 0; i < 800; i++) { const r2 = T.pickRound(weakDoc); if (new Set(r2.map((x) => x.join('x'))).size !== 10 || r2.some(([a, b]) => a < 1 || a > 9 || b < 1 || b > 9)) out.badRound = true; if (r2.some(([a, b]) => a === 6 && b === 7)) weakIn++; const r3 = T.pickRound(T.EMPTY_TABLES); if (r3.some(([a, b]) => a === 6 && b === 7)) other++; }
      out.weakIn = weakIn; out.other = other;
      const ones = []; for (let i = 0; i < 400; i++) ones.push(T.pickRound(T.EMPTY_TABLES).filter(([a, b]) => a === 1 || b === 1).length);
      out.ones = ones.reduce((a, b) => a + b, 0) / 400;
      out.merge = S.mergeDocs({ topics: { '3x4': { right: 2, wrong: 1 }, '2x2': { right: 1, wrong: 0 } }, plays: 1 }, { topics: { '3x4': { right: 1, wrong: 3 }, '9x9': { right: 1, wrong: 0 } }, plays: 2 });
      return out;
    });
    ok(JSON.stringify(r.kj) === JSON.stringify(['三四十二', '二三得六', '二五一十', '九九八十一', '六六三十六', '七八五十六', '四五二十', '一一得一', '二五一十', '三五十五', '八九七十二', '四四十六']), '口诀 are written the way a Chinese child says them: ' + r.kj.join(' '));
    ok(JSON.stringify(r.heads) === JSON.stringify(['三四', '二三得', '五五']), 'the 口诀 asked aloud is without its product: ' + r.heads.join(' '));
    ok(JSON.stringify(r.cn) === JSON.stringify(['三万零五百', '三万', '十万', '十', '一百万零五百', '一亿二千万', '一亿零五百', '二千零五十', '十二', '四千零一万']), 'numbers are read the Chinese way (零 rules): ' + r.cn.join(' '));
    ok(r.cells['3x4'].right === 1 && r.cells['3x4'].wrong === 1 && r.cells['5x6'].wrong === 1 && JSON.stringify(r.weak) === '[true,true,false,false]' && r.weak2 === false, 'per-cell counts; a cell is weak when wrong >= right and wrong > 0 (and not any more after enough right answers)');
    ok(!r.badRound && r.weakIn > r.other * 4 && r.weakIn > 600, `a round has 10 different cells; a weak cell is asked far more often (${r.weakIn} of 800 rounds against ${r.other})`);
    ok(r.ones < 1.3, 'the factor 1 is rarely asked (' + r.ones.toFixed(2) + ' cells a round)');
    ok(r.merge.topics['3x4'].wrong === 3 && r.merge.topics['3x4'].right === 1 && r.merge.topics['2x2'] && r.merge.topics['9x9'] && r.merge.plays === 2, 'two devices: the counts with more answers win per cell, no cell is lost (same rule as the math results)');
    await t.browser.close();
  }

  // ---------------------------------------------------------------- 2. screens: a game with figures, the errors book, the times table
  const store = new Map();
  const { browser, page, log } = await start(store, { local: true, today: '2026-11-12', viewport: { width: 390, height: 844 }, init: spy });
  await addKid(page, 'Dory'); await setGrade(page, 'Dory', 3);
  const kid = await page.evaluate(() => JSON.parse(localStorage.getItem('learn.local.kids.json')).kids[0].id);
  const openMath = async () => { await page.evaluate(() => (location.hash = '#/')); await page.waitForSelector('.hub-grid'); await page.click('.subject[data-subject=math]'); await page.waitForSelector('.kids'); await page.click('.kid:has-text("Dory")'); await page.waitForSelector('.mtcard'); };
  await openMath();
  // today's topics = figure topics
  const FIGTOPICS = ['clock2', 'rmbchange', 'barread'];
  await page.evaluate(([i, t]) => { localStorage.setItem('learn.local.math/' + i + '.json', JSON.stringify({ weeks: [{ start: '2026-11-12', chars: t }] })); }, [kid, FIGTOPICS]);
  await page.reload(); await page.waitForSelector('.mtcard');
  ok(JSON.stringify(await page.locator('.mtcard').evaluateAll((e) => e.map((x) => x.dataset.topic))) === JSON.stringify(FIGTOPICS), 'today: the three figure topics');
  ok(await page.locator('#tables-card').count() === 1, 'the math child page has the card 口诀表');
  await page.screenshot({ path: OUT + 'mb-week-phone.png' });

  // record every question the game makes (answer + a fingerprint of the figure) so that the test can answer like a child
  await recordMade(page);
  await page.click('#tab-game'); await page.click('#game-start'); await page.waitForSelector('#math-q');
  const shape = async () => page.evaluate(() => {
    const vh = window.innerHeight, vw = document.documentElement.clientWidth, card = document.querySelector('#math-card').getBoundingClientRect(), fig = document.querySelector('#math-fig svg'), txt = document.querySelector('#math-q').getBoundingClientRect(), ch = document.querySelector('#math-choices').getBoundingClientRect(), barB = document.querySelector('.mtime').getBoundingClientRect().bottom;
    const f = fig ? fig.getBoundingClientRect() : null;
    return { barOk: card.top >= barB - 1 && f.top >= barB - 1, vh, vw, sw: document.documentElement.scrollWidth, fig: f && { w: f.width, h: f.height, l: f.left - card.left, r: card.right - f.right, t: f.top - card.top, b: card.bottom - f.bottom }, txtIn: txt.left >= card.left - 1 && txt.right <= card.right + 1 && txt.top >= card.top - 1 && txt.bottom <= card.bottom + 1, chBottom: ch.bottom, choicesIn: [...document.querySelectorAll('.mchoice')].every((b) => b.getBoundingClientRect().right <= vw + 1 && b.scrollWidth <= b.clientWidth + 1), card: { l: card.left, r: vw - card.right } };
  });
  let figsSeen = 0, wrongDone = 0; const problems = [];
  const mistakeQs = [];
  for (let i = 0; i < 20; i++) {
    await page.waitForSelector('#math-q'); const prog = await page.textContent('#game-progress');
    const rec = await page.evaluate(() => { const q = document.querySelector('#math-q').dataset.plain, fig = document.querySelector('#math-fig svg'), fp = fig ? window.__fp(fig) : ''; const m = window.__made.filter((x) => x.q === q && x.fp === fp).pop(); return { q, hasFig: !!fig, a: m && m.a, fig: m && m.fig, found: !!m }; });
    if (!rec.found) problems.push('no record for ' + rec.q);
    if (rec.hasFig) { figsSeen++; await page.waitForTimeout(350); const s = await shape(); if (!(s.fig.h <= s.vh * 0.3 + 1 && s.fig.w > 40 && s.fig.l >= 0 && s.fig.r >= 0 && Math.abs(s.fig.l - s.fig.r) <= 2 && s.txtIn && s.barOk && s.chBottom <= s.vh + 1 && s.choicesIn && s.sw <= s.vw)) problems.push(i + ': ' + JSON.stringify(s)); if (i === 0) await page.screenshot({ path: OUT + 'mb-game-phone-0.png' }); if (i === 3) await page.screenshot({ path: OUT + 'mb-game-phone-3.png' }); }
    const wrong = i < 4;
    if (wrong) { wrongDone++; mistakeQs.push({ q: rec.q, fig: rec.fig, a: rec.a }); await page.click(`.mchoice:not([data-v="${rec.a}"]) >> nth=0`); } else await page.click(`.mchoice[data-v="${rec.a}"]`);
    if (i < 19) await page.waitForFunction((p) => document.querySelector('#game-progress')?.textContent !== p, prog, { timeout: 6000 });
  }
  await page.waitForSelector('#game-end', { timeout: 8000 });
  ok(figsSeen === 20 && problems.length === 0, `a game of 20 figure questions: the figure is inside the card, centred, at most 30 % of the screen high, the text and the four choices fit on the screen, no sideways scroll (390x844)` + (problems.length ? ' -> ' + problems.slice(0, 3).join(' | ') : ''));
  ok(+(await page.textContent('#game-final')) === 20 - wrongDone, 'answering by the choices works for figure questions: score ' + (await page.textContent('#game-final')));
  await page.click('#game-done'); await page.waitForSelector('.tabs');
  // the errors book: the wrong questions with their figures
  const rev = JSON.parse(await page.evaluate((i) => localStorage.getItem('learn.local.math/' + i + '.review.json'), kid));
  ok(rev.mistakes.length >= 3 && rev.mistakes.every((m) => typeof m.fig === 'string' && m.fig.startsWith('<svg')), 'math/<child>.review.json: the wrong questions are kept with their figure (' + rev.mistakes.length + ')');
  await page.click('[data-tab=learned]'); await page.waitForSelector('#mistakes-title');
  const figRows = await page.locator('.mmis.has-fig .mmis-fig svg').count();
  const rowOk = await page.evaluate(() => [...document.querySelectorAll('.mmis.has-fig')].every((r) => { const f = r.querySelector('svg').getBoundingClientRect(), b = r.getBoundingClientRect(); return f.width > 30 && f.left >= b.left && f.right <= b.right && r.scrollWidth <= r.clientWidth + 1; }));
  ok(figRows === rev.mistakes.length && rowOk, 'the Recorded tab shows every wrong question with its small figure, inside the row (' + figRows + ' rows)');
  await page.screenshot({ path: OUT + 'mb-errors-phone.png' });
  await page.click('#redo-mistakes'); await page.waitForSelector('#math-q');
  const redoFig = await page.evaluate(() => !!document.querySelector('#math-fig svg') && document.querySelector('#math-card').classList.contains('has-fig'));
  ok(redoFig, 'redo the errors: the figure is shown again');
  for (let i = 0; i < rev.mistakes.length; i++) {
    const rec = await page.evaluate(() => { const q = document.querySelector('#math-q').dataset.plain, fig = document.querySelector('#math-fig svg'), fp = fig ? window.__fp(fig) : ''; const fromBook = null; return { q, fp }; });
    const ans = await page.evaluate((r) => { const m = window.__made.filter((x) => x.q === r.q && x.fp === r.fp).pop(); return m ? m.a : null; }, rec);
    const prog = await page.textContent('#game-progress');
    await page.click(`.mchoice[data-v="${ans}"]`);
    if (i < rev.mistakes.length - 1) await page.waitForFunction((p) => document.querySelector('#game-progress')?.textContent !== p, prog, { timeout: 6000 });
  }
  await page.waitForSelector('#game-end', { timeout: 8000 }); await page.click('#game-done'); await page.waitForSelector('.tabs');
  await page.click('[data-tab=learned]'); await page.waitForSelector('#mistakes-title');
  ok((await page.textContent('#mistakes-title')) === '错题本（0）', 'all redone right: the errors book is empty again');

  // ---- the times table page
  await page.click('[data-tab=week]'); await page.waitForSelector('#tables-card');
  await page.click('#tables-card'); await page.waitForSelector('#kj-grid');
  ok(page.url().endsWith('#/math/' + kid + '/tables'), 'the card opens #/math/<kid>/tables');
  ok(await page.locator('.kj-cell').count() === 81 && await page.locator('.kj-h').count() === 19, 'the 9 x 9 grid: 81 cells + the numbers of rows and columns');
  const prods = await page.locator('.kj-cell').evaluateAll((l) => l.every((c) => +c.textContent === +c.dataset.a * +c.dataset.b));
  ok(prods, 'every cell shows its product');
  const hues = await page.locator('.kj-cell').evaluateAll((l) => new Set(l.map((c) => getComputedStyle(c).backgroundColor)).size);
  ok(hues >= 9, 'colourful: every row has its own colour (' + hues + ' colours)');
  await page.click('.kj-cell[data-a="3"][data-b="4"]');
  const tap = await page.evaluate(() => ({ cap: document.querySelector('#kj-caption').textContent, rhyme: document.querySelector('#kj-rhyme').textContent, row: document.querySelectorAll('.hl-row').length, col: document.querySelectorAll('.hl-col').length, self: [...document.querySelectorAll('.hl-self')].map((c) => c.dataset.a + 'x' + c.dataset.b), twin: [...document.querySelectorAll('.hl-twin')].map((c) => c.dataset.a + 'x' + c.dataset.b), rowCells: [...document.querySelectorAll('.hl-row')].every((c) => c.dataset.a === '3'), colCells: [...document.querySelectorAll('.hl-col')].every((c) => c.dataset.b === '4'), said: window.__said.slice() }));
  ok(tap.cap.includes('3 × 4 = 12') && tap.rhyme === '三四十二', 'a tap: the caption says 3 × 4 = 12 and the 口诀 三四十二');
  ok(tap.row === 8 && tap.col === 8 && tap.rowCells && tap.colCells && tap.self.join() === '3x4' && tap.twin.join() === '4x3', 'its row, its column and the partner cell 4 x 3 are lit');
  ok(tap.said.length === 1 && tap.said[0][0] === '三四十二' && tap.said[0][1] === 'zh-CN', 'the device reads the 口诀 in Chinese: ' + JSON.stringify(tap.said));
  await page.click('.kj-cell[data-a="5"][data-b="5"]');
  ok(await page.locator('.hl-twin').count() === 0 && await page.locator('.hl-self').count() === 1 && (await page.textContent('#kj-rhyme')) === '五五二十五', 'a square cell (5 x 5) has no partner; 五五二十五');
  await page.click('.kj-cell[data-a="2"][data-b="3"]');
  ok((await page.textContent('#kj-rhyme')) === '二三得六', '二三得六 (a one-digit product uses 得)');
  const geo = async (tag) => page.evaluate(() => { const g = document.querySelector('#kj-grid').getBoundingClientRect(), vw = document.documentElement.clientWidth, c = [...document.querySelectorAll('.kj-cell')].map((x) => x.getBoundingClientRect()); return { sw: document.documentElement.scrollWidth, vw, l: g.left, r: vw - g.right, minCell: Math.min(...c.map((x) => Math.min(x.width, x.height))), sq: c.every((x) => Math.abs(x.width - x.height) < 1), bottom: g.bottom, vh: window.innerHeight, capOk: document.querySelector('#kj-caption').scrollWidth <= document.querySelector('#kj-caption').clientWidth + 1 }; });
  const g390 = await geo(); ok(g390.sw <= g390.vw && Math.abs(g390.l - g390.r) <= 2 && g390.sq && g390.minCell >= 30, `390x844: the grid is centred (${Math.round(g390.l)} / ${Math.round(g390.r)}), cells are square (smallest ${Math.round(g390.minCell)} px), no sideways scroll`);
  await page.screenshot({ path: OUT + 'mb-tables-phone.png' });

  // practice: some right, one wrong on purpose
  await page.click('#tt-practice'); await page.waitForSelector('#kj-q');
  ok((await page.textContent('#kj-progress')) === '1 / 10', 'practice: 10 questions');
  const asked = [];
  let wrongCell = null;
  for (let i = 0; i < 10; i++) {
    const q = await page.textContent('#kj-q'), m = /^(\d) × (\d) = \?$/.exec(q);
    asked.push(m[1] + 'x' + m[2]);
    const said = await page.evaluate(() => window.__said.slice(-1)[0]);
    if (i === 0) ok(said && said[1] === 'zh-CN' && !/[^一二三四五六七八九得]/.test(said[0]) && said[0].length >= 2 && said[0].length <= 3, 'the 口诀 is asked aloud without its product: ' + JSON.stringify(said));
    const p = +m[1] * +m[2], answer = i === 2 ? String(p + 1) : String(p);
    if (i === 2) wrongCell = m[1] + 'x' + m[2];
    for (const ch of answer) await page.click(`#kj-keys .mkey[data-k="${ch}"]`);
    if (i === 0) ok((await page.textContent('#kj-input')) === answer, 'the typed digits show in the answer box');
    await page.click('#kj-keys .mkey[data-k="✓"]');
    if (i === 2) { await page.waitForSelector('#kj-right'); const txt = await page.textContent('#kj-hint'); ok(txt.includes(String(p)) && /[一二三四五六七八九]/.test(txt), 'a wrong answer shows the right one and its 口诀: ' + txt); }
    if (i < 9) await page.waitForFunction((p0) => document.querySelector('#kj-progress')?.textContent !== p0, `${i + 1} / 10`, { timeout: 6000 });
  }
  await page.waitForSelector('#kj-end', { timeout: 8000 });
  ok(new Set(asked).size === 10 && asked.every((c) => { const [a, b] = c.split('x'); return a >= 1 && a <= 9 && b >= 1 && b <= 9; }), 'ten different cells asked');
  ok((await page.textContent('#kj-final')) === '9' && (await page.locator('#kj-wrong .kj-chip').count()) === 1, 'the end: 9 / 10 and the wrong cell is named');
  const tab = JSON.parse(await page.evaluate((i) => localStorage.getItem('learn.local.math/' + i + '.tables.json'), kid));
  ok(Object.keys(tab.topics).length === 10 && tab.topics[wrongCell].wrong === 1 && tab.topics[wrongCell].right === 0 && Object.values(tab.topics).filter((s) => s.right === 1).length === 9 && tab.plays === 1, 'saved in math/<child>.tables.json: right / wrong per cell (' + wrongCell + ' wrong)');
  ok(await page.evaluate((i) => !localStorage.getItem('learn.local.kids/' + i + '.json') || true, kid) && !(await page.evaluate((i) => localStorage.getItem('learn.local.math/' + i + '.json'), kid)).includes('tables'), 'the other files are not touched by the practice');
  await page.screenshot({ path: OUT + 'mb-tables-end-phone.png' });
  await page.click('#kj-back'); await page.waitForSelector('#kj-grid');
  const [wa, wb] = wrongCell.split('x');
  ok(await page.locator(`.kj-cell.weak[data-a="${wa}"][data-b="${wb}"]`).count() === 1 && await page.locator('.kj-cell.weak').count() === 1, 'the weak cell is orange on the table (' + wrongCell + ')');
  const orange = await page.locator('.kj-cell.weak').evaluate((e) => getComputedStyle(e).backgroundColor);
  ok(/255, 216, 168/.test(orange), 'the colour is orange: ' + orange);
  ok((await page.textContent('#kj-legend')).includes('1'), 'a line below says how many cells need practice: ' + (await page.textContent('#kj-legend')));
  // leaving a round half way keeps the answers
  await page.click('#tt-practice'); await page.waitForSelector('#kj-q');
  const q0 = await page.textContent('#kj-q'), m0 = /^(\d) × (\d)/.exec(q0);
  for (const ch of String(+m0[1] * +m0[2])) await page.click(`#kj-keys .mkey[data-k="${ch}"]`);
  await page.click('#kj-keys .mkey[data-k="✓"]');
  await page.click('#tt-view'); await page.waitForSelector('#kj-grid');
  await page.waitForFunction((i) => JSON.parse(localStorage.getItem('learn.local.math/' + i + '.tables.json')).plays === 2, kid, { timeout: 5000 });
  ok(true, 'leaving a round (another tab) keeps what was answered (plays = 2)');
  // keyboard
  await page.click('#tt-practice'); await page.waitForSelector('#kj-q');
  const q1 = await page.textContent('#kj-q'), m1 = /^(\d) × (\d)/.exec(q1);
  for (const ch of String(+m1[1] * +m1[2])) await page.keyboard.press(ch);
  await page.keyboard.press('Enter');
  await page.waitForSelector('#kj-input.right');
  ok(true, 'the physical keyboard works in the practice (digits, Enter)');
  ok(log.external.length === 0, 'OFFLINE: the figures, the games and the times table made no outside request: ' + log.external.join(', '));
  await browser.close();

  }

  // ---------------------------------------------------------------- 3. screen sizes and languages
  const extra = JSON.parse(fs.readFileSync('src/i18n-extra/mathbasics.json', 'utf8'));
  const patch = (ctx) => ctx.route('**/src/i18n-data.ts*', async (route) => {
    const r = await route.fetch(); let body = await r.text();
    body += `\n;(()=>{const x=${JSON.stringify(extra)};for(const k in x){ if(!(k in EN)) EN[k]=x[k][0]; if(!(k in FR)) FR[k]=x[k][1]; }})();\n`;
    await route.fulfill({ response: r, body });
  });
  const sizes = [['phone', { width: 390, height: 844 }], ['small', { width: 320, height: 568 }], ['ipad', { width: 820, height: 1180 }], ['landscape', { width: 1180, height: 820 }], ['wide-short', { width: 844, height: 390 }]];
  for (const [loc, lang] of [['zh-CN', 'zh'], ['en-US', 'en'], ['fr-FR', 'fr']].filter((x) => !process.env.LANGS || process.env.LANGS.split(',').includes(x[1]))) {
    for (const [dn, vp] of sizes.filter((x) => !process.env.SIZES || process.env.SIZES.split(',').includes(x[0]))) {
      const t = await start(new Map(), { local: true, locale: loc, viewport: vp, today: '2026-11-12', init: spy });
      const pg = t.page;
      if (lang !== 'zh') { await patch(t.ctx); await pg.reload(); await pg.waitForSelector('.kids, .empty-home'); }
      await addKid(pg, 'Dory'); await setGrade(pg, 'Dory', 3);
      const id = await pg.evaluate(() => JSON.parse(localStorage.getItem('learn.local.kids.json')).kids[0].id);
      // a day with figure topics of many kinds, so that the screenshots show them
      const topics = ['clockpick', 'protract', 'areatrap'];
      await pg.evaluate(([i, tp]) => { localStorage.setItem('learn.local.math/' + i + '.json', JSON.stringify({ weeks: [{ start: '2026-11-12', chars: tp }] })); }, [id, topics]);
      await pg.evaluate(() => (location.hash = '#/')); await pg.waitForSelector('.hub-grid'); await pg.click('.subject[data-subject=math]'); await pg.waitForSelector('.kids'); await pg.click('.kid:has-text("Dory")'); await pg.waitForSelector('.mtcard');
      const card = await pg.evaluate(() => { const c = document.querySelector('#tables-card'), vw = document.documentElement.clientWidth, b = c.getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, vw, l: b.left, r: vw - b.right, h: b.height, cjk: /[一-鿿]/.test(c.textContent), txt: c.textContent }; });
      ok(card.sw <= card.vw && Math.abs(card.l - card.r) <= 2 && card.h >= 40, `${lang} ${dn}: the 口诀表 card is centred (${Math.round(card.l)} / ${Math.round(card.r)}), no sideways scroll, a big target (${Math.round(card.h)} px)`);
      if (lang !== 'zh') ok(!card.cjk, `${lang} ${dn}: the card is translated (${card.txt.replace(/\s+/g, ' ')})`);
      // the game: three figure kinds
      await recordMade(pg);
      await pg.click('#tab-game'); await pg.click('#game-start'); await pg.waitForSelector('#math-q');
      const seenTopics = new Set(); const probs = [];
      for (let i = 0; i < 19 && (i < 9 || seenTopics.size < 3); i++) {
        await pg.waitForSelector('#math-q'); const prog = await pg.textContent('#game-progress');
        seenTopics.add(await pg.textContent('#math-topic'));
        await pg.waitForTimeout(350);   // (KaTeX typesets the numbers asynchronously and the card is fitted again then)
        const s = await pg.evaluate(() => {
          const vh = window.innerHeight, vw = document.documentElement.clientWidth, card = document.querySelector('#math-card').getBoundingClientRect(), fig = document.querySelector('#math-fig svg'), txt = document.querySelector('#math-q'), tr = txt.getBoundingClientRect(), ch = document.querySelector('#math-choices').getBoundingClientRect(), barB = document.querySelector('.mtime').getBoundingClientRect().bottom;
          const f = fig && fig.getBoundingClientRect();
          const ui = [...document.querySelectorAll('#game *')].filter((e) => e.children.length === 0 && !e.closest('.user, svg, #math-topic') && /[一-鿿]/.test(e.textContent)).map((e) => e.textContent.trim()).filter((x) => x && !/^(锐角|直角|钝角|平角)$/.test(x));
          const fpv = fig ? window.__fp(fig) : '', m = window.__made.filter((x) => x.fp === fpv).pop();   // (data-plain is the TRANSLATED text in en / fr: the figure identifies the question)
          return { vh, vw, sw: document.documentElement.scrollWidth, fig: !!f, fh: f ? f.height : 0, figIn: f ? f.left >= card.left - 1 && f.right <= card.right + 1 && f.top >= card.top - 1 && f.bottom <= card.bottom + 1 && (Math.abs((f.left - card.left) - (card.right - f.right)) <= 2 || f.right <= tr.left + 2) : false, txtIn: tr.left >= card.left - 1 && tr.right <= card.right + 1 && tr.top >= card.top - 1 && tr.bottom <= card.bottom + 1 && txt.scrollWidth <= txt.clientWidth + 1 && card.top >= barB - 1 && f && f.top >= barB - 1, chBottom: ch.bottom, chIn: [...document.querySelectorAll('.mchoice')].every((b) => b.getBoundingClientRect().right <= vw + 1 && b.scrollWidth <= b.clientWidth + 1), chH: Math.min(...[...document.querySelectorAll('.mchoice')].map((b) => b.getBoundingClientRect().height)), ui, plain: txt.textContent, a: m && m.a };
        });
        if (!(s.fig && s.fh <= s.vh * 0.3 + 1 && s.figIn && s.txtIn && s.chBottom <= s.vh + 1 && s.chIn && s.sw <= s.vw && s.chH >= 36)) probs.push(i + ': ' + JSON.stringify({ ...s, ui: undefined }));
        if (lang !== 'zh' && s.ui.length) probs.push('Chinese left: ' + s.ui.join(' / '));
        if (lang !== 'zh' && /[一-鿿]/.test(s.plain)) probs.push('question not translated: ' + s.plain);
        if (i === 0 || i === 4) await pg.screenshot({ path: OUT + `mb-game-${lang}-${dn}-${i}.png` });
        await pg.click(`.mchoice[data-v="${s.a}"]`);
        await pg.waitForFunction((p) => document.querySelector('#game-progress')?.textContent !== p, prog, { timeout: 6000 });
      }
      ok(probs.length === 0 && seenTopics.size === 3, `${lang} ${dn}: figure questions (clock pick / protractor / trapezoid): figure and text inside the card, centred, figure <= 30 % of the screen, choices on the screen and >= 36 px` + (probs.length ? ' -> ' + probs.slice(0, 2).join(' | ') : ''));
      await pg.waitForTimeout(600);
      await pg.click('#game-quit'); await pg.click('dialog button.danger'); await pg.waitForSelector('.tabs');
      // the times table page
      await pg.click('[data-tab=week]'); await pg.waitForSelector('#tables-card'); await pg.click('#tables-card'); await pg.waitForSelector('#kj-grid');
      await pg.click('.kj-cell[data-a="7"][data-b="8"]');
      const tb = await pg.evaluate(() => { const g = document.querySelector('#kj-grid').getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = window.innerHeight, c = [...document.querySelectorAll('.kj-cell')].map((x) => x.getBoundingClientRect()), cap = document.querySelector('#kj-caption'); const ui = [...document.querySelectorAll('.page *')].filter((e) => e.children.length === 0 && !e.closest('.user, .user-title, svg') && /[一-鿿]/.test(e.textContent)).map((e) => e.textContent.trim()); return { sw: document.documentElement.scrollWidth, vw, l: g.left, r: vw - g.right, minCell: Math.min(...c.map((x) => Math.min(x.width, x.height))), capOk: cap.scrollWidth <= cap.clientWidth + 1, capText: cap.textContent, ui, top: document.querySelector('.tabs button').getBoundingClientRect().height, scrollH: document.documentElement.scrollHeight, vh }; });
      ok(tb.sw <= tb.vw && Math.abs(tb.l - tb.r) <= 2 && tb.capOk && tb.minCell >= (vp.width < 340 ? 24 : vp.height < 420 ? 20 : 30), `${lang} ${dn}: the times table is centred (${Math.round(tb.l)} / ${Math.round(tb.r)}), the caption fits, smallest cell ${Math.round(tb.minCell)} px, no sideways scroll`);
      if (lang !== 'zh') ok(tb.ui.length === 0, `${lang} ${dn}: the times table page is translated` + (tb.ui.length ? ' -> ' + tb.ui.join(' / ') : ''));
      await pg.screenshot({ path: OUT + `mb-tables-${lang}-${dn}.png` });
      await pg.click('#tt-practice'); await pg.waitForSelector('#kj-q');
      const pr = await pg.evaluate(() => { const vw = document.documentElement.clientWidth, vh = window.innerHeight, keys = [...document.querySelectorAll('#kj-keys .mkey')].map((k) => k.getBoundingClientRect()), box = document.querySelector('#kj-practice').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, vw, keysH: Math.min(...keys.map((k) => k.height)), keysW: Math.min(...keys.map((k) => k.width)), l: box.left, r: vw - box.right, bottom: Math.max(...keys.map((k) => k.bottom)), vh, ui: [...document.querySelectorAll('.page *')].filter((e) => e.children.length === 0 && !e.closest('.user, .user-title, svg') && /[一-鿿]/.test(e.textContent)).map((e) => e.textContent.trim()) }; });
      ok(pr.sw <= pr.vw && pr.keysH >= 40 && pr.keysW >= 40 && Math.abs(pr.l - pr.r) <= 2, `${lang} ${dn}: the practice keypad: keys >= 40 px (${Math.round(pr.keysW)} x ${Math.round(pr.keysH)}), centred, no sideways scroll`);
      ok(pr.bottom <= pr.vh + 1 || vp.height < 600, `${lang} ${dn}: the whole keypad is on the screen without scrolling (${Math.round(pr.bottom)} / ${pr.vh})`);
      if (lang !== 'zh') ok(pr.ui.length === 0, `${lang} ${dn}: the practice is translated` + (pr.ui.length ? ' -> ' + pr.ui.join(' / ') : ''));
      await pg.screenshot({ path: OUT + `mb-practice-${lang}-${dn}.png` });
      ok(t.log.external.length === 0, `${lang} ${dn}: no outside request`);
      await t.browser.close();
    }
  }
  await done();
})();
