/**
 * Math questions, part 2 (rule 52): the foundations of primary school that the first generators did not cover: the times table (口诀), clocks, money (人民币), units,
 * shapes, angles, charts, patterns, place value, factors and multiples, the first fractions and decimals, areas and volumes with a figure, and the first junior-high
 * pictures (number line, plane, crossing lines). Same contract as mathgen.ts: a generator returns the text, the right answer and `chk` (a JS expression that must be
 * true when the answer is right); a question may carry `fig`, an inline SVG (src/mathfig.ts: digits / Latin letters only, no Chinese text inside).
 * Every Chinese sentence is a plain string or template literal so that `check:i18n` finds it.
 */
import * as G from "./mathfig";
import { kj, kjHead, readCN } from "./mathcn";

export interface Raw { q: string; a: string; chk: string; wrong?: string[]; choices?: string[]; neg?: boolean; dec?: number; fig?: string }
export interface Gen2 { sec: number; make: () => Raw }

const ri = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T,>(l: readonly T[]): T => l[ri(0, l.length - 1)];
const shuffle = <T,>(l: readonly T[]): T[] => { const a = l.slice(); for (let i = a.length - 1; i > 0; i--) { const j = ri(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const M = (n: number): string => (n < 0 ? `−${-n}` : `${n}`);
const dec = (n: number, d: number): string => String(parseFloat(n.toFixed(d)));
const pad = (n: number) => String(n).padStart(2, "0");
const hm = (h: number, m: number) => `${h}:${pad(m)}`;
const wrap12 = (h: number) => ((((h - 1) % 12) + 12) % 12) + 1;
const isPrime = (n: number) => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
const divisors = (n: number) => Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0);
const pretty = (e: string): string => e.replace(/\*/g, " × ").replace(/\//g, " ÷ ").replace(/\+/g, " + ").replace(/([\d)])-/g, "$1 − ").replace(/\s+/g, " ").trim();
/** the right answer and (at least) three different wrong ones -> four shuffled choices; `top` makes more wrong ones when there are too few */
function four(a: string, wrongs: string[], top: () => string): string[] {
  const w: string[] = [];
  for (const x of wrongs) if (x !== a && !w.includes(x)) w.push(x);
  const pool = shuffle(w).slice(0, 3);
  for (let i = 0; pool.length < 3 && i < 200; i++) { const x = top(); if (x !== a && !pool.includes(x)) pool.push(x); }
  return shuffle([a, ...pool]);
}
const NEG = /−/g;

const PLACES = ["个位", "十位", "百位", "千位", "万位", "十万位", "百万位", "千万位"];
const NAMES: Record<string, string> = { square: "正方形", rectangle: "长方形", triangle: "三角形", circle: "圆形", cube: "正方体", cuboid: "长方体", cylinder: "圆柱", sphere: "球体" };

// length / mass / time things: [thing, number, right unit, the wrong units] (the units are keys of `unitText`, so that every phrase is a translatable template)
type UK = "mm" | "cm" | "dm" | "m" | "km" | "mg" | "g" | "kg" | "t" | "s" | "min" | "h" | "d";
const unitText = (n: number): Record<UK, string> => ({ mm: `${n} 毫米`, cm: `${n} 厘米`, dm: `${n} 分米`, m: `${n} 米`, km: `${n} 千米`, mg: `${n} 毫克`, g: `${n} 克`, kg: `${n} 千克`, t: `${n} 吨`, s: `${n} 秒`, min: `${n} 分`, h: `${n} 时`, d: `${n} 天` });
const THINGS: [string, number, UK, UK[]][] = [
  ["一支铅笔的长度", 18, "cm", ["mm", "m", "km"]], ["一枚硬币的厚度", 2, "mm", ["cm", "dm", "m"]], ["教室黑板的长度", 4, "m", ["cm", "dm", "km"]],
  ["学校操场跑道一圈的长度", 400, "m", ["cm", "km", "mm"]], ["从北京到上海的铁路长度", 1300, "km", ["m", "dm", "cm"]], ["一支粉笔的长度", 8, "cm", ["mm", "m", "km"]],
  ["教室门的高度", 2, "m", ["cm", "mm", "km"]], ["数学书的厚度", 7, "mm", ["cm", "dm", "m"]], ["一位小学生的身高", 135, "cm", ["mm", "m", "km"]],
  ["一条马路的宽度", 20, "m", ["cm", "km", "mm"]], ["长江的长度", 6300, "km", ["m", "cm", "dm"]],
  ["一个鸡蛋的质量", 50, "g", ["mg", "kg", "t"]], ["一袋大米的质量", 5, "kg", ["mg", "g", "t"]], ["一头大象的质量", 5, "t", ["mg", "g", "kg"]],
  ["一个苹果的质量", 200, "g", ["mg", "kg", "t"]], ["一位小学生的体重", 30, "kg", ["mg", "g", "t"]], ["一辆卡车的载重", 10, "t", ["mg", "g", "kg"]], ["一片药的质量", 100, "mg", ["g", "kg", "t"]],
  ["一块橡皮的长度", 4, "cm", ["mm", "m", "km"]], ["一把牙刷的长度", 18, "cm", ["mm", "m", "km"]], ["一张床的长度", 2, "m", ["cm", "mm", "km"]], ["黄河的长度", 5464, "km", ["m", "cm", "dm"]],
  ["一辆小汽车的长度", 4, "m", ["cm", "mm", "km"]], ["一栋六层楼的高度", 20, "m", ["cm", "mm", "km"]],
  ["一个西瓜的质量", 5, "kg", ["mg", "g", "t"]], ["一瓶矿泉水的质量", 500, "g", ["mg", "kg", "t"]], ["一只猫的质量", 4, "kg", ["mg", "g", "t"]], ["一枚硬币的质量", 6, "g", ["mg", "kg", "t"]],
  ["一头蓝鲸的质量", 100, "t", ["mg", "g", "kg"]], ["一个书包的质量", 3, "kg", ["mg", "g", "t"]],
  ["一次呼吸的时间", 3, "s", ["min", "h", "d"]], ["一场电影的时间", 120, "min", ["s", "h", "d"]], ["跑 100 米所用的时间", 15, "s", ["min", "h", "d"]],
  ["眨一下眼睛的时间", 1, "s", ["min", "h", "d"]], ["一节课的时间", 40, "min", ["s", "h", "d"]], ["睡一觉的时间", 9, "h", ["s", "min", "d"]], ["暑假的时间", 60, "d", ["s", "min", "h"]],
];

export const GEN2: Record<string, Gen2> = {
  // ============================================================ grade 1
  shapes1: { sec: 10, make: () => {
    const kind = pick([...G.FLAT, ...G.SOLID]), flat = (G.FLAT as readonly string[]).includes(kind);
    const set = flat ? [...G.FLAT] : [...G.SOLID], a = NAMES[kind];
    return { q: flat ? "这是什么图形？" : "这是什么立体图形？", a, fig: G.shapeFig(kind, pick([0, 40, 80, 120, 160, 200, 240, 300])), choices: shuffle(set.map((k) => NAMES[k])), chk: `${JSON.stringify(NAMES)}[${JSON.stringify(kind)}]===${JSON.stringify(a)}` };
  } },
  clock1: { sec: 10, make: () => {
    const h = ri(1, 12), m = pick([0, 30]), a = hm(h, m);
    const wr = [hm(h, m ? 0 : 30), hm(wrap12(h + 1), m), hm(wrap12(h - 1), m), hm(wrap12(m ? h + 6 : h + 5), m ? 0 : 30)];
    return { q: "钟表上显示的是几时几分？", a, fig: G.clockFig(h, m), choices: four(a, wr, () => hm(ri(1, 12), pick([0, 30]))), chk: `${h % 12}*30+${m}*0.5===${G.hourAngle(h, m)}&&${m}*6===${G.minuteAngle(m)}` };
  } },
  rmb1: { sec: 12, make: () => {
    for (;;) {
      const n = ri(2, 5), vals = Array.from({ length: n }, () => pick([1, 1, 5, 5, 10, 10, 20]));
      const t = vals.reduce((s, x) => s + x, 0);
      if (t > 50) continue;
      return { q: "图中一共有多少元？", a: String(t), fig: G.rmbFig(vals), chk: `${vals.join("+")}===${t}` };
    }
  } },
  place1: { sec: 8, make: () => {
    const t = ri(1, 9), o = ri(0, 9), n = t * 10 + o, k = ri(0, 2);
    if (k === 0) return { q: `${t} 个十和 ${o} 个一合起来是多少？`, a: String(n), chk: `${t}*10+${o}===${n}` };
    if (k === 1) return { q: `${n} 里面有几个十？`, a: String(t), chk: `Math.floor(${n}/10)===${t}`, wrong: [String(o), String(t + 1), String(t - 1 < 0 ? t + 2 : t - 1), String(n)] };
    return { q: `${n} 的个位上是几？`, a: String(o), chk: `${n}%10===${o}`, wrong: shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => x !== o)).map(String) };
  } },
  pattern1: { sec: 14, make: () => {
    const ty = shuffle([0, 1, 2, 3]), [a, b, c] = ty;
    const base = pick([[a, b], [a, a, b], [a, b, c], [a, b, b], [a, b, c, c]]), p = base.length, shown = p * 2 + ri(0, p - 1);
    const seq = Array.from({ length: shown }, (_, i) => base[i % p]), next = base[shown % p];
    return { q: "按规律，问号处应该是什么图形？", a: G.PAT_SYMBOLS[next], fig: G.patFig(seq), choices: shuffle(G.PAT_SYMBOLS), chk: `${JSON.stringify(base)}[${shown}%${p}]===${next}` };
  } },
  wpmore: { sec: 16, make: () => {
    const k = ri(0, 4);
    if (k === 0) { const a = ri(3, 12), d = ri(1, 20 - a > 8 ? 8 : 20 - a || 1); return { q: `小红有 ${a} 个苹果，小明比小红多 ${d} 个，小明有几个？`, a: String(a + d), chk: `${a}+${d}===${a + d}` }; }
    if (k === 1) { const a = ri(6, 18), d = ri(1, a - 2); return { q: `小明有 ${a} 个气球，小红比小明少 ${d} 个，小红有几个？`, a: String(a - d), chk: `${a}-${d}===${a - d}` }; }
    if (k === 2) { const b = ri(3, 10), d = ri(1, 9), a = b + d; return { q: `小明有 ${a} 本书，小红有 ${b} 本书，小明比小红多几本？`, a: String(d), chk: `${a}-${b}===${d}` }; }
    if (k === 3) { const b = ri(3, 10), d = ri(1, 9), a = b + d; return { q: `小明有 ${a} 本书，小红有 ${b} 本书，小红比小明少几本？`, a: String(d), chk: `${a}-${b}===${d}` }; }
    const a = ri(5, 12), d = ri(2, 7); return { q: `草地上有 ${a} 只白兔，黑兔比白兔多 ${d} 只，黑兔有几只？`, a: String(a + d), chk: `${a}+${d}===${a + d}` };
  } },

  // ============================================================ grade 2
  kjfill: { sec: 10, make: () => {
    const a = ri(2, 9), b = ri(2, 9), p = a * b;
    return { q: `补全口诀：${kjHead(a, b)}（ ）`, a: String(p), chk: `${a}*${b}===${p}`, wrong: [String(a * (b + 1)), String(a * (b - 1)), String((a + 1) * b), String((a - 1) * b), String(a + b)] };
  } },
  kjwhich: { sec: 12, make: () => {
    const a = ri(2, 9), b = ri(2, 9), ans = kj(a, b);
    const near = [[a, b + 1], [a, b - 1], [a + 1, b], [a - 1, b], [b + 1, a + 1]].filter(([x, y]) => x >= 1 && x <= 9 && y >= 1 && y <= 9).map(([x, y]) => kj(x, y));
    return { q: `算 ${a} × ${b}，应该用哪句口诀？`, a: ans, choices: four(ans, near, () => kj(ri(2, 9), ri(2, 9))), chk: `${a}*${b}===${a * b}` };
  } },
  mulmissing: { sec: 12, make: () => {
    const a = ri(2, 9), b = ri(2, 9), p = a * b;
    return Math.random() < 0.5 ? { q: `${a} × ? = ${p}`, a: String(b), chk: `${a}*${b}===${p}`, wrong: [String(b + 1), String(b - 1), String(a), String(p - a)] } : { q: `? × ${b} = ${p}`, a: String(a), chk: `${a}*${b}===${p}`, wrong: [String(a + 1), String(a - 1), String(b), String(p - b)] };
  } },
  divinv: { sec: 12, make: () => {
    const a = ri(2, 9), b = ri(2, 9), p = a * b;
    return Math.random() < 0.5 ? { q: `想一想：${a} × ${b} = ${p}，所以 ${p} ÷ ${a} = ?`, a: String(b), chk: `${a}*${b}===${p}`, wrong: [String(a), String(b + 1), String(p - a)] } : { q: `想一想：${a} × ${b} = ${p}，所以 ${p} ÷ ${b} = ?`, a: String(a), chk: `${a}*${b}===${p}`, wrong: [String(b), String(a + 1), String(p - b)] };
  } },
  times: { sec: 14, make: () => {
    const m = ri(2, 9), k = ri(2, 9), n = m * k, v = ri(0, 2);
    if (v === 0) return { q: `${n} 是 ${m} 的几倍？`, a: String(k), chk: `${m}*${k}===${n}`, wrong: [String(k + 1), String(k - 1), String(n - m), String(m)] };
    if (v === 1) return { q: `${m} 的 ${k} 倍是多少？`, a: String(n), chk: `${m}*${k}===${n}`, wrong: [String(m + k), String(n + m), String(n - m), String(k)] };
    return { q: `${n} 是 ${k} 的几倍？`, a: String(m), chk: `${m}*${k}===${n}`, wrong: [String(m + 1), String(m - 1), String(n - k), String(k)] };
  } },
  rem: { sec: 16, make: () => {
    const d = ri(2, 9), q = ri(1, 9), r = ri(1, d - 1), n = d * q + r, k = ri(0, 1);
    if (k === 1) return { q: `${n} ÷ ${d} 的余数是多少？`, a: String(r), chk: `${n}%${d}===${r}`, wrong: shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8].filter((x) => x !== r)).map(String) };
    const a = `${q} …… ${r}`;
    return { q: `${n} ÷ ${d} = ?`, a, choices: four(a, [`${r} …… ${q}`, `${q + 1} …… ${r}`, `${q} …… ${r + 1}`, `${q - 1} …… ${r + d}`, `${q} …… ${r > 1 ? r - 1 : r + 2}`], () => `${ri(1, 9)} …… ${ri(1, d - 1)}`), chk: `${d}*${q}+${r}===${n}&&${r}<${d}` };
  } },
  clock2: { sec: 14, make: () => {
    const h = ri(1, 12), m = ri(0, 59), a = hm(h, m);
    const wr = [hm(h, (m + 5) % 60), hm(h, (m + 55) % 60), hm(wrap12(h + 1), m), hm(wrap12(h - 1), m), hm(wrap12(Math.round(m / 5) || 12), (h % 12) * 5), hm(h, (m + 30) % 60)];
    return { q: "钟表上显示的是几时几分？", a, fig: G.clockFig(h, m), choices: four(a, wr, () => hm(ri(1, 12), ri(0, 59))), chk: `${h % 12}*30+${m}*0.5===${G.hourAngle(h, m)}&&${m}*6===${G.minuteAngle(m)}` };
  } },
  clockpick: { sec: 16, make: () => {
    const h = ri(1, 12), m = pick([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
    const cand: [number, number][] = [[wrap12(h + 1), m], [h, (m + 30) % 60], [wrap12(Math.round(m / 5) || 12), (h % 12) * 5], [wrap12(h - 1), m], [h, (m + 15) % 60], [h, (m + 45) % 60], [wrap12(h + 6), m]];
    const key = (t: [number, number]) => `${t[0]}:${t[1]}`, seen = new Set([key([h, m])]), wrongs: [number, number][] = [];
    for (const t of shuffle(cand)) if (!seen.has(key(t)) && wrongs.length < 3) { seen.add(key(t)); wrongs.push(t); }
    const times = shuffle<[number, number]>([[h, m], ...wrongs]), idx = times.findIndex((t) => t[0] === h && t[1] === m), letter = "ABCD"[idx];
    const angles = times.map(([x, y]) => [G.hourAngle(x, y), G.minuteAngle(y)]);
    return { q: `哪个钟表显示的是 ${hm(h, m)}？`, a: letter, fig: G.clocksFig(times), choices: ["A", "B", "C", "D"], chk: `${JSON.stringify(angles)}["ABCD".indexOf(${JSON.stringify(letter)})][0]===${G.hourAngle(h, m)}&&${JSON.stringify(angles)}["ABCD".indexOf(${JSON.stringify(letter)})][1]===${G.minuteAngle(m)}` };
  } },
  rmb2: { sec: 18, make: () => {
    const k = ri(0, 2), a = ri(1, 30), b = ri(1, 9), c = ri(1, 30), d = ri(1, 9);
    if (k === 0) { const t = 10 * (a + c) + b + d; return { q: `${a} 元 ${b} 角 + ${c} 元 ${d} 角 = ? 角`, a: String(t), chk: `10*${a}+${b}+10*${c}+${d}===${t}` }; }
    if (k === 1) { const big = 10 * a + b + 10 * c + d, small = 10 * c + d, t = big; return { q: `${Math.floor(t / 10)} 元 ${t % 10} 角 − ${Math.floor(small / 10)} 元 ${small % 10} 角 = ? 角`, a: String(t - small), chk: `${t}-${small}===${t - small}` }; }
    return { q: `${a} 元 ${b} 角 = ? 角`, a: String(a * 10 + b), chk: `${a}*10+${b}===${a * 10 + b}`, wrong: [String(a * 100 + b), String(a + b), String(a * 10 + b + 10), String(a * 10)] };
  } },
  rmbchange: { sec: 16, make: () => {
    for (;;) {
      const n = ri(1, 2), vals = Array.from({ length: n }, () => pick([5, 10, 20, 50, 100])), V = vals.reduce((s, x) => s + x, 0);
      if (V > 100 || V < 6) continue;
      const p = ri(1, V - 1);
      return { q: `买一件 ${p} 元的东西，付了图中的钱，应找回多少元？`, a: String(V - p), fig: G.rmbFig(vals), chk: `${vals.join("+")}-${p}===${V - p}` };
    }
  } },
  rmbmake: { sec: 18, make: () => {
    const dn = [50, 20, 10, 5, 1], txt = (l: number[]) => [...l].sort((x, y) => y - x).join(" + ");
    const rnd = () => Array.from({ length: ri(2, 4) }, () => pick(dn));
    let right = rnd(), T = right.reduce((s, x) => s + x, 0);
    while (T < 6 || T > 99) { right = rnd(); T = right.reduce((s, x) => s + x, 0); }
    const a = txt(right), wrongs: string[] = [];
    for (let i = 0; i < 80 && wrongs.length < 3; i++) { const c = rnd(), t2 = c.reduce((s, x) => s + x, 0); if (t2 !== T && t2 <= 120 && !wrongs.includes(txt(c)) && Math.abs(t2 - T) <= 15) wrongs.push(txt(c)); }
    return { q: `哪种付法正好是 ${T} 元？`, a, choices: four(a, wrongs, () => txt([...right, pick([1, 5])])), chk: `${right.join("+")}===${T}` };
  } },
  unitpick: { sec: 16, make: () => {
    const [thing, n, u, others] = pick(THINGS), t = unitText(n), a = t[u];
    return { q: `${thing}大约是多少？`, a, choices: shuffle([a, ...others.map((x) => t[x])]), chk: `${JSON.stringify(thing)}.length>0&&${n}>0` };
  } },
  barread: { sec: 14, make: () => {
    const vals: number[] = []; while (vals.length < 4) vals.push(ri(1, 10));
    const k = ri(0, 2), fig = G.barFig(vals, 1), idx = ri(0, 3);
    if (k === 0) return { q: `图中 ${"ABCD"[idx]} 的数量是多少？`, a: String(vals[idx]), fig, chk: `${JSON.stringify(vals)}[${idx}]===${vals[idx]}` };
    const mx = Math.max(...vals), mn = Math.min(...vals);
    if (k === 1 && vals.filter((v) => v === mx).length === 1) return { q: "哪一项最多？", a: "ABCD"[vals.indexOf(mx)], fig, choices: ["A", "B", "C", "D"], chk: `Math.max(...${JSON.stringify(vals)})===${JSON.stringify(vals)}["ABCD".indexOf(${JSON.stringify("ABCD"[vals.indexOf(mx)])})]` };
    if (vals.filter((v) => v === mn).length === 1) return { q: "哪一项最少？", a: "ABCD"[vals.indexOf(mn)], fig, choices: ["A", "B", "C", "D"], chk: `Math.min(...${JSON.stringify(vals)})===${JSON.stringify(vals)}["ABCD".indexOf(${JSON.stringify("ABCD"[vals.indexOf(mn)])})]` };
    return { q: `图中 ${"ABCD"[idx]} 的数量是多少？`, a: String(vals[idx]), fig, chk: `${JSON.stringify(vals)}[${idx}]===${vals[idx]}` };
  } },
  place2: { sec: 14, make: () => {
    const k = ri(0, 2), a = ri(1, 9), b = ri(0, 9), c = ri(0, 9), e = ri(0, 9), n = a * 1000 + b * 100 + c * 10 + e;
    if (k === 0) {
      const ds = [e, c, b, a], cand = ds.map((d, i) => ({ d, i })).filter((x) => ds.filter((y) => y === x.d).length === 1 && (x.i < 3 || true));
      if (cand.length) { const { d, i } = pick(cand), names = PLACES.slice(0, 4); return { q: `${n} 中的 ${d} 在哪一位？`, a: names[i], choices: shuffle(names), chk: `Math.floor(${n}/${10 ** i})%10===${d}` }; }
    }
    if (k === 1) return { q: `${a} 个千、${b} 个百、${c} 个十和 ${e} 个一合起来是多少？`, a: String(n), chk: `${a}*1000+${b}*100+${c}*10+${e}===${n}` };
    return { q: `${n} 的百位上是几？`, a: String(b), chk: `Math.floor(${n}/100)%10===${b}`, wrong: shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => x !== b)).map(String) };
  } },
  shapes2: { sec: 12, make: () => {
    const key = pick(Object.keys(G.POLYS)), n = G.POLYS[key].sides, np = G.POLYS[key].pts.length;
    return { q: pick(["这个图形有几条边？", "这个图形有几个角？"]), a: String(n), fig: G.polyFig(key, ri(0, G.COLOR_COUNT - 1), pick([0, 0, 15, 30, 45, 60, 75])), wrong: ["3", "4", "5", "6", "7"].filter((x) => x !== String(n)), chk: `${n}===${np}` };
  } },
  wpshare: { sec: 18, make: () => {
    const m = ri(2, 9), k = ri(2, 9), n = m * k, v = ri(0, 3);
    if (v === 0) return { q: `有 ${n} 个苹果，每 ${m} 个装一盘，可以装几盘？`, a: String(k), chk: `${n}/${m}===${k}` };
    if (v === 1) return { q: `小明有 ${m} 张贴纸，小红的贴纸是小明的 ${k} 倍，小红有几张？`, a: String(n), chk: `${m}*${k}===${n}`, wrong: [String(m + k), String(n + m), String(k)] };
    if (v === 2) return { q: `小红有 ${n} 张贴纸，是小明的 ${k} 倍，小明有几张？`, a: String(m), chk: `${m}*${k}===${n}`, wrong: [String(n - k), String(m + 1), String(k)] };
    return { q: `每人分 ${m} 个，${k} 个人，一共要准备多少个？`, a: String(n), chk: `${m}*${k}===${n}`, wrong: [String(m + k), String(n + m), String(n - k)] };
  } },

  // ============================================================ grade 3
  muldivmix: { sec: 20, make: () => {
    for (;;) {
      const a = ri(2, 12), b = ri(2, 9), c = ri(2, 9), d = ri(2, 20);
      const e = pick([`${a * c}*${b}/${c}`, `${a * b}/${b}*${c}`, `${a * b * c}/${b}/${c}`, `${a}*${b}*${c}`, `${a * b}/${b}+${c}*${d}`, `${d}+${a * b}/${b}*${c}`, `${a * b}/${c === b ? a : b}*${c}`]);
      let v: number;
      try { v = Function(`return (${e})`)() as number; } catch { continue; }
      if (Number.isInteger(v) && v > 1 && v <= 900) return { q: `${pretty(e)} = ?`, a: String(v), chk: `Math.abs((${e})-(${v}))<1e-9` };
    }
  } },
  remdiv: { sec: 18, make: () => {
    const d = ri(3, 9), q = ri(2, 12), r = ri(1, d - 1), k = ri(0, 2);
    if (k === 0) return { q: `被除数 ÷ ${d} = ${q} …… ${r}，被除数是多少？`, a: String(d * q + r), chk: `${d}*${q}+${r}===${d * q + r}&&${r}<${d}`, wrong: [String(d * q), String(q + r), String(d * q - r), String(d * q + d)] };
    if (k === 1) return { q: `一个数除以 ${d}，余数最大可能是多少？`, a: String(d - 1), chk: `${d}-1===${d - 1}`, wrong: [String(d), String(d + 1), String(d - 2 > 0 ? d - 2 : d + 2), "1"] };
    return { q: `一个数除以 ${d}，商是 ${q}，余数最大时，这个数是多少？`, a: String(d * q + d - 1), chk: `${d}*${q}+${d}-1===${d * q + d - 1}`, wrong: [String(d * q + d), String(d * q), String(d * q + 1), String(d * q + d - 2)] };
  } },
  elapsed: { sec: 24, make: () => {
    const v = ri(0, 2), S = ri(6 * 12, 17 * 12) * 5, dur = v === 1 ? ri(13, 40) * 5 : ri(2, 34) * 5, E = S + dur;
    const t = (x: number) => hm(Math.floor(x / 60), x % 60);
    if (v === 0) return { q: `从 ${t(S)} 到 ${t(E)}，经过了多少分钟？`, a: String(dur), chk: `(${E})-(${S})===${dur}` };
    if (v === 1 && dur % 60) { const H = Math.floor(dur / 60), Mi = dur % 60, a = `${H} 时 ${Mi} 分`; return { q: `从 ${t(S)} 到 ${t(E)}，经过了多长时间？`, a, choices: four(a, [`${H + 1} 时 ${Mi} 分`, `${H} 时 ${(Mi + 10) % 60} 分`, `${H} 时 ${Mi + 30 > 59 ? Mi - 30 || 5 : Mi + 30} 分`, `${Math.max(1, H - 1)} 时 ${Mi} 分`], () => `${ri(1, 4)} 时 ${ri(1, 11) * 5} 分`), chk: `${H}*60+${Mi}===(${E})-(${S})` }; }
    const dd = Math.max(10, dur), E2 = S + dd, Hh = Math.floor(dd / 60), Mm = dd % 60;
    return { q: `电影 ${t(S)} 开始，放映 ${Hh} 时 ${Mm} 分，几时几分结束？`, a: t(E2), choices: four(t(E2), [t(E2 + 10), t(E2 - 10), t(E2 + 60), t(E2 - 60), t(E2 + 5)], () => t(E2 + ri(-6, 6) * 5 + 5)), chk: `(${S})+${Hh}*60+${Mm}===${E2}` };
  } },
  clockafter: { sec: 20, make: () => {
    const h = ri(1, 12), m = pick([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]), k = pick([10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 75, 80, 90, 100, 120]);
    const tot = (h % 12) * 60 + m + k, h2 = wrap12(Math.floor(tot / 60) % 12 || 12), m2 = tot % 60, a = hm(h2, m2);
    const wr = [hm(h2, (m2 + 10) % 60), hm(wrap12(h2 + 1), m2), hm(wrap12(h2 - 1), m2), hm(h, (m + k) % 60), hm(h2, (m2 + 5) % 60)];
    return { q: `现在的时间如图，再过 ${k} 分钟是几时几分？`, a, fig: G.clockFig(h, m), choices: four(a, wr, () => hm(ri(1, 12), ri(0, 11) * 5)), chk: `((${h}%12)*60+${m}+${k})%720===(${h2}%12)*60+${m2}` };
  } },
  unitconv1: { sec: 18, make: () => {
    const n = ri(2, 9), a = ri(1, 9), b = ri(1, 99), k = ri(0, 10);
    const T: [string, number][] = [
      [`${a} 米 ${b} 厘米 = ? 厘米`, a * 100 + b], [`${n} 千米 = ? 米`, n * 1000], [`${n} 吨 = ? 千克`, n * 1000], [`${a} 千克 ${b} 克 = ? 克`, a * 1000 + b], [`${n} 分米 = ? 厘米`, n * 10],
      [`${n} 厘米 = ? 毫米`, n * 10], [`${n} 米 = ? 分米`, n * 10], [`${n}000 米 = ? 千米`, n], [`${n}000 克 = ? 千克`, n], [`${n} 千克 = ? 克`, n * 1000], [`${n} 米 = ? 厘米`, n * 100],
    ];
    const [q, v] = T[k];
    return { q, a: String(v), wrong: [String(v * 10), String(v / 10 >= 1 && Number.isInteger(v / 10) ? v / 10 : v * 100), String(v + 100), String(v - 10 > 0 ? v - 10 : v + 10), String(v * 100)], chk: `${v}>0` };
  } },
  unittime: { sec: 18, make: () => {
    const k = ri(0, 3);
    if (k === 0) { const h = ri(1, 5), m = ri(1, 11) * 5; return { q: `${h} 时 ${m} 分 = ? 分`, a: String(h * 60 + m), chk: `${h}*60+${m}===${h * 60 + m}`, wrong: [String(h * 100 + m), String(h + m), String(h * 60), String(h * 60 + m + 10)] }; }
    if (k === 1) { const n = ri(7, 23) * 10 + 5 * ri(0, 1), H = Math.floor(n / 60), Mi = n % 60, a = `${H} 时 ${Mi} 分`; if (Mi) return { q: `${n} 分 = ? 时 ? 分`, a, choices: four(a, [`${H + 1} 时 ${Mi} 分`, `${H} 时 ${(Mi + 10) % 60 || 5} 分`, `${Mi} 时 ${H} 分`, `${Math.max(1, H - 1)} 时 ${Mi} 分`], () => `${ri(1, 4)} 时 ${ri(1, 11) * 5} 分`), chk: `${H}*60+${Mi}===${n}` }; }
    if (k === 2) { const mo = pick([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1]; return { q: `平年 ${mo} 月有多少天？`, a: String(days), choices: ["28", "29", "30", "31"].includes(String(days)) ? ["28", "29", "30", "31"] : [], chk: `[31,28,31,30,31,30,31,31,30,31,30,31][${mo - 1}]===${days}` }; }
    const y = pick([1900, 2000, 2020, 2023, 2024, 2025, 2026, 2028, 2100, 1996, 2008, 2012, 2019, 2200, 1800, 2400]), leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return { q: `${y} 年的 2 月有多少天？`, a: leap ? "29" : "28", choices: ["28", "29", "30", "31"], chk: `(((${y}%4===0&&${y}%100!==0)||${y}%400===0)?29:28)===${leap ? 29 : 28}` };
  } },
  perim: { sec: 16, make: () => {
    const k = ri(0, 2);
    if (k === 0) { const l = ri(3, 15), w = ri(2, 12); const L = l === w ? l + 1 : l; return { q: "求图形的周长（单位：厘米）。", a: String(2 * (L + w)), fig: G.rectFig(L, w), wrong: [String(L * w), String(L + w), String(2 * L + w), String(2 * (L + w) + 2)], chk: `2*(${L}+${w})===${2 * (L + w)}` }; }
    if (k === 1) { const s = ri(2, 12); return { q: "求图形的周长（单位：厘米）。", a: String(4 * s), fig: G.rectFig(s, s), wrong: [String(s * s), String(2 * s), String(3 * s), String(4 * s + 4)], chk: `4*${s}===${4 * s}` }; }
    for (;;) { const a = ri(3, 14), b = ri(3, 14), c = ri(3, 14); if (a + b > c + 1 && a + c > b + 1 && b + c > a + 1) return { q: "求图形的周长（单位：厘米）。", a: String(a + b + c), fig: G.triSidesFig(a, b, c), wrong: [String(a * b), String(a + b), String(a + b + c + 1), String(a + b + c - 1)], chk: `${a}+${b}+${c}===${a + b + c}` }; }
  } },
  area1: { sec: 16, make: () => {
    if (Math.random() < 0.6) { const l = ri(3, 12), w = ri(2, 10), L = l === w ? l + 1 : l; return { q: "求图形的面积（单位：平方厘米）。", a: String(L * w), fig: G.rectFig(L, w), wrong: [String(2 * (L + w)), String(L + w), String(L * w + L), String(L * w - w)], chk: `${L}*${w}===${L * w}` }; }
    const s = ri(2, 12); return { q: "求图形的面积（单位：平方厘米）。", a: String(s * s), fig: G.rectFig(s, s), wrong: [String(4 * s), String(2 * s), String(s * s + s), String(s * (s - 1))], chk: `${s}*${s}===${s * s}` };
  } },
  fraction1: { sec: 14, make: () => {
    const n = ri(2, 8), k = ri(1, n - 1), a = `${k}/${n}`;
    const wr = [`${n - k}/${n}`, `${k}/${n + 1}`, `${k}/${Math.max(2, n - 1)}`, `${n}/${k}`, `${k + 1}/${n}`].filter((x) => x !== a);
    return { q: "涂色部分是整个图形的几分之几？", a, fig: G.fracFig(n, k, Math.random() < 0.5), choices: four(a, wr, () => `${ri(1, 7)}/${ri(2, 9)}`), chk: `${k}<${n}&&${k}>0` };
  } },
  fraccomp: { sec: 16, make: () => {
    const d = ri(5, 12), k = ri(0, 2);
    if (k === 2) { const a = ri(2, d - 1); return { q: `${a}/${d} 里面有几个 1/${d}？`, a: String(a), chk: `Math.abs(${a}/${d}-${a}*(1/${d}))<1e-9`, wrong: [String(a + 1), String(a - 1), String(d), String(d - a)] }; }
    const nums = shuffle(Array.from({ length: d - 1 }, (_, i) => i + 1)).slice(0, 4), t = k === 0 ? Math.max(...nums) : Math.min(...nums);
    return { q: k === 0 ? "下面哪个分数最大？" : "下面哪个分数最小？", a: `${t}/${d}`, choices: nums.map((x) => `${x}/${d}`), chk: `${k === 0 ? "Math.max" : "Math.min"}(${nums.join(",")})===${t}` };
  } },
  decmoney: { sec: 18, make: () => {
    const k = ri(0, 3), a = ri(1, 30), b = ri(1, 9);
    if (k === 0) return { q: `${a} 元 ${b} 角 = ? 元`, a: dec(a + b / 10, 1), chk: `Math.abs(${a}+${b}/10-${dec(a + b / 10, 1)})<1e-9`, dec: 1, wrong: [dec(a + b, 1), dec(a * 10 + b, 0), dec(a + b / 100, 2), dec(b + a / 10, 1)] };
    if (k === 1) { const x = a + b / 10, ans = `${a} 元 ${b} 角`; return { q: `${dec(x, 1)} 元 = ? 元 ? 角`, a: ans, choices: four(ans, [`${b} 元 ${a % 10} 角`, `${a} 元 ${b + 1 > 9 ? b - 1 : b + 1} 角`, `${a + 1} 元 ${b} 角`, `${Math.max(1, a - 1)} 元 ${b} 角`], () => `${ri(1, 30)} 元 ${ri(1, 9)} 角`), chk: `${a}*10+${b}===${a * 10 + b}` }; }
    if (k === 2) { const c = ri(1, 30), d = ri(1, 9), t = (10 * a + b + 10 * c + d) / 10; return { q: `${dec(a + b / 10, 1)} 元 + ${dec(c + d / 10, 1)} 元 = ? 元`, a: dec(t, 1), chk: `Math.abs(${a + b / 10}+${c + d / 10}-${dec(t, 1)})<1e-9`, dec: 1 }; }
    const pay = pick([5, 10, 20, 50]), x = ri(2, pay * 10 - 1) / 10, ch = (pay * 10 - Math.round(x * 10)) / 10;
    return { q: `付 ${pay} 元，买 ${dec(x, 1)} 元的东西，应找回多少元？`, a: dec(ch, 1), chk: `Math.abs(${pay}-${dec(x, 1)}-${dec(ch, 1)})<1e-9`, dec: 1 };
  } },
  deccomp: { sec: 18, make: () => {
    const k = ri(0, 2);
    if (k === 2) {
      const ds = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 3), n = `${ds[0]}.${ds[1]}${ds[2]}`, t = ri(0, 2), names = ["个位", "十分位", "百分位", "十位"];
      return { q: `${n} 中的 ${ds[t]} 在哪一位？`, a: names[t], choices: shuffle(names), chk: `"${n}".replace(".","")[${t}]==="${ds[t]}"` };
    }
    const vals: string[] = []; const set = new Set<number>();
    while (vals.length < 4) { const v = ri(1, 99); const x = Math.random() < 0.5 && v % 10 === 0 ? v / 10 * 10 : v; if (!set.has(x)) { set.add(x); vals.push(dec(x / 100, 2)); } }
    const nums = vals.map(Number), t = k === 0 ? Math.max(...nums) : Math.min(...nums);
    return { q: k === 0 ? "下面哪个数最大？" : "下面哪个数最小？", a: dec(t, 2), choices: vals, chk: `${k === 0 ? "Math.max" : "Math.min"}(${nums.join(",")})===${t}` };
  } },
  wpdist: { sec: 22, make: () => {
    const d = ri(3, 9), n = d * ri(2, 9) + ri(1, d - 1), q = Math.floor(n / d), r = n % d, k = ri(0, 3);
    if (k === 0) return { q: `${n} 个苹果，每 ${d} 个装一盒，至少需要几个盒子？`, a: String(q + 1), chk: `Math.ceil(${n}/${d})===${q + 1}`, wrong: [String(q), String(q + 2), String(r), String(d)] };
    if (k === 1) return { q: `${n} 人去划船，每条船最多坐 ${d} 人，至少要租几条船？`, a: String(q + 1), chk: `Math.ceil(${n}/${d})===${q + 1}`, wrong: [String(q), String(q + 2), String(r), String(d)] };
    if (k === 2) return { q: `${n} 个苹果，每 ${d} 个装一盒，最多装满几盒？`, a: String(q), chk: `Math.floor(${n}/${d})===${q}`, wrong: [String(q + 1), String(q - 1), String(r), String(d)] };
    return { q: `${n} 个苹果，每 ${d} 个装一盒，装完后还剩几个？`, a: String(r), chk: `${n}%${d}===${r}`, wrong: [String(q), String(r + 1), String(d - r), String(d)] };
  } },
  bardiff: { sec: 22, make: () => {
    const step = pick([2, 5]), vals: number[] = [];
    while (vals.length < 5) { const v = ri(1, step === 2 ? 10 : 8) * step; if (!vals.includes(v)) vals.push(v); }
    const fig = G.barFig(vals, step), k = ri(0, 2);
    if (k === 0) { const i = ri(0, 4); let j = ri(0, 4); while (j === i) j = ri(0, 4); const [x, y] = vals[i] > vals[j] ? [i, j] : [j, i]; return { q: `图中 ${"ABCDE"[x]} 比 ${"ABCDE"[y]} 多多少？`, a: String(vals[x] - vals[y]), fig, chk: `${vals[x]}-${vals[y]}===${vals[x] - vals[y]}` }; }
    if (k === 1) return { q: "图中最多的比最少的多多少？", a: String(Math.max(...vals) - Math.min(...vals)), fig, chk: `Math.max(${vals})-Math.min(${vals})===${Math.max(...vals) - Math.min(...vals)}` };
    const t = vals.reduce((s, x) => s + x, 0); return { q: "图中的数量一共是多少？", a: String(t), fig, chk: `${vals.join("+")}===${t}` };
  } },
  pattern2: { sec: 18, make: () => {
    const k = ri(0, 5);
    if (k === 0) { const s = ri(1, 30), d = pick([2, 3, 4, 5, 6, 7, 8, 9, 10]), up = Math.random() < 0.7; const sg = up ? 1 : -1, st = up ? s : s + 5 * d + ri(0, 5); return { q: `${[0, 1, 2, 3, 4].map((i) => st + sg * d * i).join(", ")}, ?`, a: String(st + sg * d * 5), chk: `${st}+${sg * d}*5===${st + sg * d * 5}` }; }
    if (k === 1) { const s = ri(1, 20), d = ri(2, 9), i = ri(1, 3), l = [0, 1, 2, 3, 4].map((x) => (x === i + 1 ? "?" : String(s + d * x))); return { q: l.join(", "), a: String(s + d * (i + 1)), chk: `${s}+${d}*${i + 1}===${s + d * (i + 1)}` }; }
    if (k === 2) { const s = ri(1, 4), m = pick([2, 3]), l = [0, 1, 2, 3].map((x) => s * m ** x); return { q: `${l.join(", ")}, ?`, a: String(s * m ** 4), chk: `${s}*${m}**4===${s * m ** 4}` }; }
    if (k === 3) { const s = ri(1, 9), l = [0, 1, 2, 3, 4].map((x) => s + (x * (x + 1)) / 2); return { q: `${l.join(", ")}, ?`, a: String(s + 15), chk: `${s}+5*6/2===${s + 15}` }; }
    if (k === 4) { const a = ri(1, 9), b = ri(10, 40), d = ri(1, 3), e = ri(1, 5); const l = [a, b, a + d, b + e, a + 2 * d, b + 2 * e]; return { q: `${l.join(", ")}, ?`, a: String(a + 3 * d), chk: `${a}+3*${d}===${a + 3 * d}` }; }
    const n = ri(2, 6); return { q: `${[1, 2, 3, 4].map((x) => (x + n - 1) ** 2).join(", ")}, ?`, a: String((n + 4) ** 2), chk: `(${n}+4)**2===${(n + 4) ** 2}` };
  } },
  stickpat: { sec: 24, make: () => {
    const kind = pick(["sq", "tri"] as const), N = ri(5, 25), a = kind === "sq" ? 3 * N + 1 : 2 * N + 1;
    return { q: `照这样摆下去，第 ${N} 个图形需要多少根小棒？`, a: String(a), fig: G.stickFig(kind), wrong: kind === "sq" ? [String(3 * N), String(3 * N + 3), String(4 * N), String(3 * N + 2)] : [String(2 * N), String(2 * N + 2), String(3 * N), String(2 * N + 3)], chk: `${kind === "sq" ? 3 : 2}*${N}+1===${a}` };
  } },

  // ============================================================ grade 4
  factmult: { sec: 22, make: () => {
    const k = ri(0, 2);
    if (k === 0) { const n = pick([12, 16, 18, 20, 24, 28, 30, 32, 36, 40, 42, 45, 48, 50, 54, 60]), c = divisors(n).length; return { q: `${n} 的因数有几个？`, a: String(c), chk: `${divisors(n).length}===${c}`, wrong: [String(c + 1), String(c - 1), String(c + 2), String(c - 2)] }; }
    if (k === 1) {
      const m = ri(3, 9), right = m * ri(2, Math.floor(99 / m)), wrongs: number[] = [];
      while (wrongs.length < 3) { const x = ri(10, 99); if (x % m !== 0 && !wrongs.includes(x)) wrongs.push(x); }
      return { q: `下面哪个数是 ${m} 的倍数？`, a: String(right), choices: shuffle([right, ...wrongs].map(String)), chk: `${right}%${m}===0` };
    }
    const m = ri(3, 9), N = ri(30, 100), c = Math.floor(N / m); return { q: `在 1 到 ${N} 中，${m} 的倍数有几个？`, a: String(c), chk: `Math.floor(${N}/${m})===${c}`, wrong: [String(c + 1), String(c - 1), String(N - m), String(c + 2)] };
  } },
  primecomp: { sec: 18, make: () => {
    const k = ri(0, 2);
    if (k === 2) { const N = pick([10, 20, 30, 40, 50]), c = Array.from({ length: N }, (_, i) => i + 1).filter(isPrime).length; return { q: `${N} 以内（含 ${N}）有几个质数？`, a: String(c), chk: `${c}===${c}`, wrong: [String(c + 1), String(c - 1), String(c + 2), String(N / 2)] }; }
    const primes = Array.from({ length: 59 }, (_, i) => i + 2).filter(isPrime), comps = Array.from({ length: 59 }, (_, i) => i + 2).filter((x) => !isPrime(x));
    if (k === 0) { const p = pick(primes); return { q: "下面哪个数是质数？", a: String(p), choices: shuffle([p, ...shuffle(comps).slice(0, 3)].map(String)), chk: `${p}>1&&${p}%2!==0||${p}===2` }; }
    const c = pick(comps); return { q: "下面哪个数是合数？", a: String(c), choices: shuffle([c, ...shuffle(primes).slice(0, 3)].map(String)), chk: `${divisors(c).length}>2` };
  } },
  bignum: { sec: 24, make: () => {
    const k = ri(0, 3);
    if (k === 0) { const wan = ri(1, 9999), rest = pick([0, ri(1, 999), ri(1000, 9999)]), n = wan * 10000 + rest; return { q: `把“${readCN(n)}”写成数字。`, a: String(n), chk: `${wan}*10000+${rest}===${n}`, wrong: [String(wan * 1000 + rest), String(wan * 100000 + rest), String(wan * 10000 + rest * 10), String(wan * 10000 + Math.floor(rest / 10))] }; }
    if (k === 1) {
      const len = ri(6, 8); let n = 0; const ds: number[] = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, len);
      if (ds[0] === 0) { const z = ds.findIndex((x) => x !== 0); [ds[0], ds[z]] = [ds[z], ds[0]]; }
      n = Number(ds.join("")); const i = ri(0, len - 1), pos = len - 1 - i, names = shuffle(PLACES.slice(0, len).filter((_, x) => x !== pos)).slice(0, 3);
      return { q: `${n} 中的 ${ds[i]} 在哪一位？`, a: PLACES[pos], choices: shuffle([PLACES[pos], ...names]), chk: `Math.floor(${n}/${10 ** pos})%10===${ds[i]}` };
    }
    if (k === 2) { const n = ri(2, 9999); return { q: `${n} 万 = ?`, a: String(n * 10000), chk: `${n}*10000===${n * 10000}`, wrong: [String(n * 1000), String(n * 100000), String(n * 100), String(n * 10)] }; }
    const n = ri(2, 99); return { q: `${n} 亿 = ? 万`, a: String(n * 10000), chk: `${n}*10000===${n * 10000}`, wrong: [String(n * 1000), String(n * 100000), String(n * 100), String(n * 100000000)] };
  } },
  roundest: { sec: 22, make: () => {
    const k = ri(0, 2);
    if (k === 0) {
      const p = pick([10, 100, 1000, 10000]), n = ri(p === 10000 ? 10001 : 101, p === 10000 ? 99999 : 99999), up = Math.round(n / p) * p, down = Math.floor(n / p) * p, name = p === 10 ? "十位" : p === 100 ? "百位" : p === 1000 ? "千位" : "万位";
      if (up === down) return GEN2.roundest.make();
      return { q: `把 ${n} 四舍五入到${name}，约是多少？`, a: String(up), chk: `Math.round(${n}/${p})*${p}===${up}`, wrong: [String(down), String(down + p), String(Math.round(n / (p * 10)) * p * 10), String(Math.round(n / (p / 10 || 1)) * (p / 10 || 1))] };
    }
    if (k === 1) { const a = ri(120, 899), b = ri(120, 899), add = Math.random() < 0.6 || a < b, ra = Math.round(a / 100) * 100, rb = Math.round(b / 100) * 100, v = add ? ra + rb : ra - rb; return { q: `估算：${a} ${add ? "+" : "−"} ${b} ≈ ?（先把每个数看作整百数）`, a: String(v), chk: `Math.round(${a}/100)*100${add ? "+" : "-"}Math.round(${b}/100)*100===${v}`, wrong: [String(v + 100), String(v - 100), String(add ? a + b : a - b), String(v + 200)] }; }
    const n = ri(20001, 999999), w = Math.round(n / 10000); return { q: `${n} ≈ ? 万（省略万位后面的尾数）`, a: String(w), chk: `Math.round(${n}/10000)===${w}`, wrong: [String(w + 1), String(w - 1 > 0 ? w - 1 : w + 2), String(Math.floor(n / 10000)), String(Math.round(n / 1000))] };
  } },
  protract: { sec: 22, make: () => {
    const theta = ri(2, 34) * 5, mirror = Math.random() < 0.5;
    return { q: "量得这个角是多少度？", a: String(theta), fig: G.protractorFig(theta, mirror), wrong: [String(180 - theta), String(theta + 5), String(theta - 5), String(theta + 10), String(theta - 10)], chk: `${theta}>0&&${theta}<180&&${theta}%5===0` };
  } },
  angleclass: { sec: 14, make: () => {
    const t = pick([0, 1, 2, 3]), theta = t === 0 ? ri(3, 17) * 5 : t === 1 ? 90 : t === 2 ? ri(19, 35) * 5 : 180, names = ["锐角", "直角", "钝角", "平角"];
    return { q: "这是什么角？", a: names[t], fig: G.angleFig(theta, ri(0, 11) * 30), choices: shuffle(names), chk: `${theta}${t === 0 ? "<90" : t === 1 ? "===90" : t === 2 ? ">90&&" + theta + "<180" : "===180"}` };
  } },
  symm: { sec: 20, make: () => {
    const key = pick(Object.keys(G.POLYS)), ax = G.POLYS[key].axes, pool = [0, 1, 2, 3, 4, 5, 6].filter((x) => x !== ax);
    return { q: "这个图形有几条对称轴？（不是轴对称图形，填 0）", a: String(ax), fig: G.polyFig(key, ri(0, G.COLOR_COUNT - 1), pick([0, 0, 15, 30, 45, 60, 90, 120])), choices: shuffle([String(ax), ...shuffle(pool).slice(0, 3).map(String)]), chk: `${ax}>=0&&${ax}<=6` };
  } },
  unitconv2: { sec: 24, make: () => {
    const k = ri(0, 8), a = ri(1, 9), b = ri(1, 19) * 50, n = ri(1, 99);
    const T: [string, number, number][] = [
      [`${a} 千米 ${b} 米 = ? 米`, a * 1000 + b, 0], [`${n * 5} 厘米 = ? 米`, (n * 5) / 100, 2], [`${n * 50} 米 = ? 千米`, (n * 50) / 1000, 3], [`${dec(a + ri(1, 9) / 10, 1)} 千克 = ? 克`, 0, 0],
      [`${a} 千克 ${b} 克 = ? 千克`, a + b / 1000, 3], [`${n} 平方米 = ? 平方分米`, n * 100, 0], [`${a} 公顷 = ? 平方米`, a * 10000, 0], [`${n} 平方千米 = ? 公顷`, n * 100, 0], [`${n * 10} 平方厘米 = ? 平方分米`, n / 10, 1],
    ];
    if (k === 3) { const x = a + ri(1, 9) / 10; return { q: `${dec(x, 1)} 千克 = ? 克`, a: String(Math.round(x * 1000)), chk: `Math.round(${dec(x, 1)}*1000)===${Math.round(x * 1000)}` }; }
    const [q, v, d] = T[k];
    return { q, a: dec(v, d), chk: `${v}>0`, dec: d, wrong: [dec(v * 10, d), dec(v / 10, Math.max(d, 1) + 1), dec(v * 100, d), dec(v / 100, d + 2), dec(v * 1000, d)] };
  } },
  avgbar: { sec: 26, make: () => {
    for (;;) {
      const step = pick([2, 5]), vals = Array.from({ length: 5 }, () => ri(1, step === 2 ? 12 : 8) * step), t = vals.reduce((s, x) => s + x, 0);
      if (t % 5) continue;
      return { q: "图中数据的平均数是多少？", a: String(t / 5), fig: G.barFig(vals, step), chk: `(${vals.join("+")})/5===${t / 5}` };
    }
  } },

  // ============================================================ grade 5
  commonfm: { sec: 24, make: () => {
    const k = ri(0, 2);
    if (k === 2) { const g = ri(2, 12), x = ri(2, 5), y = ri(2, 5); if (x === y || gcd(x, y) !== 1) return GEN2.commonfm.make(); const a = g * x, b = g * y, c = divisors(gcd(a, b)).length; return { q: `${a} 和 ${b} 的公因数有几个？`, a: String(c), chk: `${divisors(gcd(a, b)).length}===${c}`, wrong: [String(c + 1), String(c - 1 > 0 ? c - 1 : c + 2), String(c + 2), String(2 * c)] }; }
    for (;;) {
      const a = ri(4, 24), b = ri(4, 24);
      if (a === b) continue;
      if (k === 0) {
        const l = (a / gcd(a, b)) * b, right = l * ri(1, Math.max(1, Math.floor(200 / l))); if (right > 200) continue;
        const wrongs: number[] = []; for (let i = 0; i < 300 && wrongs.length < 3; i++) { const x = ri(8, 200); if (x % a !== 0 || x % b !== 0) { if ((x % a === 0 || x % b === 0 || i > 100) && !wrongs.includes(x)) wrongs.push(x); } }
        if (wrongs.length < 3) continue;
        return { q: `下面哪个数是 ${a} 和 ${b} 的公倍数？`, a: String(right), choices: shuffle([right, ...wrongs].map(String)), chk: `${right}%${a}===0&&${right}%${b}===0` };
      }
      const g = gcd(a, b); if (g < 2) continue;
      const right = pick(divisors(g)), wrongs = shuffle(divisors(a).concat(divisors(b)).filter((x) => g % x !== 0 || false)).filter((x, i, l) => l.indexOf(x) === i).filter((x) => a % x !== 0 || b % x !== 0);
      const extra = [a + 1, b + 1, g + 1, g * 2].filter((x) => !(a % x === 0 && b % x === 0));
      const w = [...new Set([...wrongs, ...extra])].filter((x) => x !== right).slice(0, 3);
      if (w.length < 3) continue;
      return { q: `下面哪个数是 ${a} 和 ${b} 的公因数？`, a: String(right), choices: shuffle([right, ...w].map(String)), chk: `${a}%${right}===0&&${b}%${right}===0` };
    }
  } },
  primefac: { sec: 26, make: () => {
    for (;;) {
      const ps = [2, 3, 5, 7, 11], len = ri(2, 4), fs = Array.from({ length: len }, () => pick(ps.slice(0, 4))).sort((x, y) => x - y), n = fs.reduce((s, x) => s * x, 1);
      if (n < 12 || n > 150) continue;
      const txt = (l: number[]) => l.join(" × "), a = txt(fs), wr: string[] = [];
      if (fs.length >= 3) wr.push(txt([fs[0] * fs[1], ...fs.slice(2)].sort((x, y) => x - y)));
      else wr.push(txt([1, ...fs]));
      const alt = fs.slice(); alt[0] = alt[0] === 2 ? 3 : 2; wr.push(txt(alt.sort((x, y) => x - y)));
      const alt2 = fs.slice(); alt2.push(2); wr.push(txt(alt2.sort((x, y) => x - y)));
      const alt3 = fs.slice(0, -1); if (alt3.length) wr.push(txt(alt3));
      return { q: `把 ${n} 分解质因数：${n} = ?`, a, choices: four(a, wr, () => txt([2, pick([3, 5, 7])])), chk: `${fs.join("*")}===${n}` };
    }
  } },
  areapara: { sec: 22, make: () => {
    const b = ri(3, 14), h = ri(2, 10), off = ri(1, Math.min(3, b - 1));
    return { q: "求图形的面积（单位：平方厘米）。", a: String(b * h), fig: G.paraFig(b, h, off), wrong: [String((b * h) / 2 === Math.floor((b * h) / 2) ? (b * h) / 2 : b * h + b), String(2 * (b + h)), String(b + h), String(b * h + b)], chk: `${b}*${h}===${b * h}` };
  } },
  areatri2: { sec: 22, make: () => {
    for (;;) { const b = ri(3, 16), h = ri(3, 12); if ((b * h) % 2) continue; return { q: "求图形的面积（单位：平方厘米）。", a: String((b * h) / 2), fig: G.triFig(b, h, ri(0, b)), wrong: [String(b * h), String(b + h), String((b * h) / 2 + b), String(2 * (b + h))], chk: `${b}*${h}/2===${(b * h) / 2}` }; }
  } },
  areatrap: { sec: 26, make: () => {
    for (;;) {
      const a = ri(2, 10), B = ri(a + 2, 16), h = ri(2, 10);
      if (((a + B) * h) % 2) continue;
      const ar = ((a + B) * h) / 2;
      return { q: "求图形的面积（单位：平方厘米）。", a: String(ar), fig: G.trapFig(a, B, h, ri(0, B - a)), wrong: [String((a + B) * h), String(((a + B) * h) / 2 + h), String(a * h), String(B * h)], chk: `(${a}+${B})*${h}/2===${ar}` };
    }
  } },
  combo: { sec: 28, make: () => {
    const W = ri(6, 14), H = ri(5, 12), nw = ri(2, W - 3), nh = ri(2, H - 3), perim = Math.random() < 0.4;
    if (perim) return { q: "求图形的周长（单位：厘米）。", a: String(2 * (W + H)), fig: G.lshapeFig(W, H, nw, nh), wrong: [String(2 * (W + H) + 2 * (nw + nh)), String(W + H), String(2 * (W + H) - 2 * (nw + nh)), String(W * H - nw * nh)], chk: `2*(${W}+${H})===${2 * (W + H)}` };
    return { q: "求图形的面积（单位：平方厘米）。", a: String(W * H - nw * nh), fig: G.lshapeFig(W, H, nw, nh), wrong: [String(W * H), String(W * H + nw * nh), String(2 * (W + H)), String(W * H - nw - nh)], chk: `${W}*${H}-${nw}*${nh}===${W * H - nw * nh}` };
  } },
  cuboid: { sec: 26, make: () => {
    const cube = Math.random() < 0.3, l = ri(2, 9), w = cube ? l : ri(2, 9), h = cube ? l : ri(2, 9), fig = G.cuboidFig(l, w, h), k = ri(0, 4);
    if (k === 0) return { q: "求体积（单位：厘米，体积单位：立方厘米）。", a: String(l * w * h), fig, wrong: [String(l * w + w * h + l * h), String(2 * (l * w + w * h + l * h)), String(l + w + h), String(l * w * h + l)], chk: `${l}*${w}*${h}===${l * w * h}` };
    if (k === 1 || k === 2) { const s = 2 * (l * w + w * h + l * h); return { q: "求表面积（单位：厘米，面积单位：平方厘米）。", a: String(s), fig, wrong: [String(l * w * h), String(l * w + w * h + l * h), String(s + 2 * l), String(4 * (l + w + h))], chk: `2*(${l}*${w}+${w}*${h}+${l}*${h})===${s}` }; }
    const q = k === 3 ? ["这个立体图形有几个面？", 6] : ["这个立体图形有几个顶点？", 8];
    return { q: q[0] as string, a: String(q[1]), fig, choices: shuffle(["4", "6", "8", "10", "12"].filter((x) => x !== String(q[1])).slice(0, 3).concat([String(q[1])])), chk: `${q[1]}===${q[1] === 6 ? 6 : 8}` };
  } },
  fracdec: { sec: 24, make: () => {
    const k = ri(0, 2);
    if (k === 0) { const d = pick([2, 4, 5, 8, 10, 20, 25]), n = ri(1, d - 1), v = n / d; return { q: `${n}/${d} = ?（化成小数）`, a: dec(v, 3), chk: `Math.abs(${n}/${d}-${dec(v, 3)})<1e-9`, dec: 3, wrong: [dec(n / (d * 10), 4), dec(d / n, 3), dec(v * 10, 3), dec(v + 0.1, 3)] }; }
    if (k === 1) {
      const d = pick([2, 4, 5, 8, 10, 20, 25]), n = ri(1, d - 1), g = gcd(n, d), ans = `${n / g}/${d / g}`, x = dec(n / d, 3);
      return { q: `${x} 化成最简分数是？`, a: ans, choices: four(ans, [`${n / g + 1}/${d / g}`, `${x.replace("0.", "")}/10`, `${d / g}/${n / g}`, `${n / g}/${d / g + 1}`, `${n}/${d * 10}`], () => `${ri(1, 9)}/${ri(2, 20)}`), chk: `Math.abs(${n / g}/${d / g}-${x})<1e-9` };
    }
    const d = pick([2, 4, 5, 10, 20, 25]), n = ri(1, d - 1), p = (n * 100) / d; return { q: `把 ${n}/${d} 化成百分数是？`, a: `${p}%`, chk: `Math.abs(${n}/${d}*100-${p})<1e-9`, wrong: [`${p / 10}%`, `${p * 10}%`, `${100 - p}%`, `${p + 5}%`] };
  } },
  unitvol: { sec: 22, make: () => {
    const k = ri(0, 5), n = ri(1, 99), a = ri(1, 9), b = ri(1, 19) * 50;
    const T: [string, number, number][] = [[`${n} 升 = ? 毫升`, n * 1000, 0], [`${n * 50} 毫升 = ? 升`, (n * 50) / 1000, 3], [`${n} 立方分米 = ? 升`, n, 0], [`${n} 立方米 = ? 立方分米`, n * 1000, 0], [`${a} 升 ${b} 毫升 = ? 毫升`, a * 1000 + b, 0], [`${n} 立方厘米 = ? 毫升`, n, 0]];
    const [q, v, d] = T[k];
    return { q, a: dec(v, d), chk: `${v}>0`, dec: d, wrong: [dec(v * 10, d), dec(v / 10, d + 1), dec(v * 100, d), dec(v / 100, d + 2), dec(v * 1000, d)] };
  } },

  // ============================================================ grade 6 and 7
  circfig: { sec: 28, make: () => {
    const kind = pick(["r", "d"] as const), r = ri(1, 10), v = kind === "r" ? r : 2 * r, area = Math.random() < 0.5;
    const c = dec(3.14 * 2 * r, 2), s = dec(3.14 * r * r, 2);
    return area ? { q: "求圆的面积（π 取 3.14，单位：厘米）。", a: s, fig: G.circFig(v, kind), dec: 2, wrong: [c, dec(3.14 * v * v, 2), dec(3.14 * r, 2), dec(2 * 3.14 * r * r, 2)], chk: `Math.abs(3.14*${r}*${r}-${s})<1e-9&&${v}===${kind === "r" ? r : 2 * r}` }
      : { q: "求圆的周长（π 取 3.14，单位：厘米）。", a: c, fig: G.circFig(v, kind), dec: 2, wrong: [s, dec(3.14 * r, 2), dec(3.14 * v * v, 2), dec(3.14 * 4 * r, 2)], chk: `Math.abs(3.14*2*${r}-${c})<1e-9&&${v}===${kind === "r" ? r : 2 * r}` };
  } },
  cylvol: { sec: 30, make: () => {
    const cone = Math.random() < 0.4, r = ri(1, 6), h = cone ? 3 * ri(1, 4) : ri(2, 10), V = (3.14 * r * r * h) / (cone ? 3 : 1), a = dec(V, 2);
    return { q: `求${cone ? "圆锥" : "圆柱"}的体积（π 取 3.14，单位：厘米）。`, a, fig: G.cylFig(r, h, cone), dec: 2, wrong: [dec(3.14 * r * h, 2), dec(cone ? 3.14 * r * r * h : (3.14 * r * r * h) / 3, 2), dec(2 * 3.14 * r * h, 2), dec(V + 3.14, 2)], chk: `Math.abs(3.14*${r}*${r}*${h}/${cone ? 3 : 1}-${a})<1e-9` };
  } },
  anglepair: { sec: 24, make: () => {
    const theta = pick([30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150]), val = (k: number) => (k % 2 === 1 ? theta : 180 - theta);
    const i = ri(1, 4), opp = ((i + 1) % 4) + 1, adj = i % 4 + 1, adj2 = ((i + 2) % 4) + 1;
    const useOpp = Math.random() < 0.5, j = useOpp ? opp : Math.random() < 0.5 ? adj : adj2;
    return { q: `如图，两条直线相交，∠${i} = ${val(i)}°，∠${j} = ?`, a: String(val(j)), fig: G.crossFig(theta), wrong: [String(180 - val(j)), String(90 - (val(i) % 90 || 10)), String(val(j) + 10), String(val(j) - 10 > 0 ? val(j) - 10 : val(j) + 20)], chk: `${useOpp ? val(i) : 180 - val(i)}===${val(j)}` };
  } },
  numline: { sec: 18, make: () => {
    const v = ri(-6, 6) || 3, k = ri(0, 3);
    if (k === 0) return { q: "数轴上点 A 表示的数是多少？", a: M(v), fig: G.numlineFig(v), neg: true, wrong: [M(-v), M(v + 1), M(v - 1), M(v * 2 > 7 ? v - 2 : v * 2)], chk: `${v}===${v}` };
    if (k === 1) { const s = ri(1, 5); return { q: `点 A 向右移动 ${s} 个单位后，表示的数是多少？`, a: M(v + s), fig: G.numlineFig(v), neg: true, wrong: [M(v - s), M(-v - s), M(v + s + 1), M(-v + s)], chk: `${v}+${s}===${v + s}` }; }
    if (k === 2) { const s = ri(1, 5); return { q: `点 A 向左移动 ${s} 个单位后，表示的数是多少？`, a: M(v - s), fig: G.numlineFig(v), neg: true, wrong: [M(v + s), M(-v + s), M(v - s - 1), M(-v - s)], chk: `${v}-${s}===${v - s}` }; }
    return { q: "点 A 到原点的距离是多少？", a: String(Math.abs(v)), fig: G.numlineFig(v), wrong: [M(-Math.abs(v)), String(Math.abs(v) + 1), String(Math.abs(v) - 1 || 2), String(Math.abs(v) * 2)], chk: `Math.abs(${v})===${Math.abs(v)}` };
  } },
  coord: { sec: 22, make: () => {
    const px = pick([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]), py = pick([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]), k = ri(0, 3), P = (x: number, y: number) => `(${M(x)}, ${M(y)})`, fig = G.coordFig(px, py);
    if (k === 0) { const a = P(px, py); return { q: "点 P 的坐标是？", a, fig, choices: four(a, [P(py, px), P(-px, py), P(px, -py), P(-px, -py), P(px + 1, py)], () => P(ri(-5, 5), ri(-5, 5))), chk: `${px}===${px}&&${py}===${py}` }; }
    if (k === 1) { const names = ["第一象限", "第二象限", "第三象限", "第四象限"], q = px > 0 && py > 0 ? 0 : px < 0 && py > 0 ? 1 : px < 0 ? 2 : 3; return { q: "点 P 在第几象限？", a: names[q], fig, choices: shuffle(names), chk: `(${px}>0&&${py}>0?0:${px}<0&&${py}>0?1:${px}<0?2:3)===${q}` }; }
    if (k === 2) return { q: "点 P 到 x 轴的距离是多少？", a: String(Math.abs(py)), fig, wrong: [String(Math.abs(px)), M(py), String(Math.abs(py) + 1), String(Math.abs(px) + Math.abs(py))], chk: `Math.abs(${py})===${Math.abs(py)}` };
    return { q: "点 P 到 y 轴的距离是多少？", a: String(Math.abs(px)), fig, wrong: [String(Math.abs(py)), M(px), String(Math.abs(px) + 1), String(Math.abs(px) + Math.abs(py))], chk: `Math.abs(${px})===${Math.abs(px)}` };
  } },
};
void NEG;
