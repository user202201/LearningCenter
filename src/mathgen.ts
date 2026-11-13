/**
 * Math questions, made on the spot (nothing is stored in advance): one small generator per topic of src/data/math-topics.json.
 * A generator returns the question text, the right answer and a boolean JS expression `chk` that must be true when the answer is right (the tests make
 * thousands of questions per topic and evaluate it); `make()` adds the four choices (the right one and three plausible wrong ones, shuffled).
 * No screens, no storage.
 */
import { GEN2 } from "./mathgen2";
export interface Q { topic: string; q: string; a: string; choices: string[]; chk: string; /** an inline SVG shown above the question text (src/mathfig.ts; rule 52) */ fig?: string }
interface Raw { q: string; a: string; chk: string; wrong?: string[]; choices?: string[]; neg?: boolean; dec?: number; fig?: string }
interface Gen { sec: number; make: () => Raw }

const ri = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T,>(l: readonly T[]): T => l[ri(0, l.length - 1)];
const shuffle = <T,>(l: readonly T[]): T[] => { const a = l.slice(); for (let i = a.length - 1; i > 0; i--) { const j = ri(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
/** a number as text, with the real minus sign */
const M = (n: number): string => (n < 0 ? `−${-n}` : `${n}`);
/** a number inside an expression: negative ones in brackets */
const br = (n: number): string => (n < 0 ? `(${n})` : `${n}`);
const sign = (n: number) => (n < 0 ? "−" : "+");
/** "3x", "x", "−x" */
const fx = (c: number): string => (c === 1 ? "x" : c === -1 ? "−x" : `${M(c)}x`);
/** an expression for the screen: × ÷ − and spaces round the operators */
const pretty = (e: string): string => e.replace(/\*/g, " × ").replace(/\//g, " ÷ ").replace(/\+/g, " + ").replace(/([\d)])-/g, "$1 − ").replace(/-/g, "−").replace(/\s+/g, " ").trim();
const num = (expr: string, ans: number, extra: Partial<Raw> = {}): Raw => ({ q: `${pretty(expr)} = ?`, a: M(ans), chk: `Math.abs((${expr})-(${ans}))<1e-9`, ...extra });
const frac = (n: number, d: number): string => { const g = gcd(n, d); n /= g; d /= g; return d === 1 ? `${n}` : `${n}/${d}`; };
const fracVal = (n: number, d: number): string => `${n}/${d}`;
/** plausible wrong fractions for the right answer n/d */
const fracWrong = (n: number, d: number): string[] => {
  const c = [frac(n + 1, d), n > 1 ? frac(n - 1, d) : "", frac(n, d + 1), d > 1 ? frac(n, d - 1) : "", frac(d, n), frac(n + d, d), frac(n * 2, d + 1), frac(n + 2, d)];
  return [...new Set(c.filter((x) => x && x !== frac(n, d)))];
};
/** numbers near the answer, in the same format: the usual slips (one more / less, ten more / less, the digits swapped) */
function nearby(a: string, dec?: number, neg = false): string[] {
  if (/[/√:,，x]/.test(a)) return [];   // (fractions, roots, ratios, lists: the generator gives its own wrong answers)
  const suffix = a.endsWith("%") ? "%" : "";
  const v = parseFloat(a.replace("%", "").replace("−", "-"));
  if (!Number.isFinite(v)) return [];
  const d = dec ?? (a.includes(".") ? (a.split(".")[1] ?? "").replace("%", "").length : 0);
  const unit = Math.pow(10, -d);
  const out: number[] = [];
  const steps = [1, -1, 2, -2, 10, -10, 3, -3, 5, -5, 20, -20, 4, -4, 6, -6, 7, -7, 100, -100];
  for (const k of steps) out.push(v + k * unit);
  if (Number.isInteger(v) && Math.abs(v) >= 10) { const s = String(Math.abs(v)); out.push(Math.sign(v) * +s.split("").reverse().join("")); }
  const fmt = (x: number) => { const r = parseFloat(x.toFixed(d)); return `${M(r)}${suffix}`; };
  return [...new Set(out.filter((x) => (neg || v < 0 || x >= 0) && !(Math.abs(x - v) < 1e-9)).map(fmt).filter((x) => x !== a))];
}
/** four shuffled choices: the answer and three wrong ones (given, topped up with nearby numbers) */
function choices(r: Raw): string[] {
  if (r.choices) return r.choices;
  const wrong = [...new Set((r.wrong ?? []).filter((x) => x !== r.a))];
  const pool = wrong.length >= 3 ? wrong : [...wrong, ...shuffle(nearby(r.a, r.dec, r.neg)).filter((x) => !wrong.includes(x))];
  return shuffle([r.a, ...shuffle(pool).slice(0, 3)]);
}
/** x² + bx + c */
const poly = (b: number, c: number): string => `x²${b ? `${sign(b)}${Math.abs(b) === 1 ? "" : Math.abs(b)}x` : ""}${c ? `${sign(c)}${Math.abs(c)}` : ""}`;
const evalNum = (e: string): number => Function(`return (${e})`)() as number;

// ---------------------------------------------------------------- the generators (one per topic id)
export const GEN: Record<string, Gen> = {
  compare: { sec: 6, make: () => { const a = ri(0, 20), b = ri(0, 20); const s = a > b ? ">" : a < b ? "<" : "="; return { q: `${a} ○ ${b}`, a: s, chk: `${s === "=" ? `${a}===${b}` : `${a}${s}${b}`}`, choices: [">", "<", "="] }; } },
  seq: { sec: 8, make: () => { const s = ri(1, 12), d = pick([1, 2, 2, 3, 5, 10]); const t = [0, 1, 2, 3].map((i) => s + i * d); return { q: `${t.join(", ")}, ?`, a: String(t[3] + d), chk: `${t[3]}+${d}===${t[3] + d}` }; } },
  add10: { sec: 6, make: () => { const a = ri(1, 9), b = ri(0, 10 - a); return num(`${a}+${b}`, a + b); } },
  sub10: { sec: 6, make: () => { const a = ri(1, 10), b = ri(0, a); return num(`${a}-${b}`, a - b); } },
  add20: { sec: 8, make: () => { const a = ri(2, 9), b = ri(10 - a, 9); return num(`${a}+${b}`, a + b); } },
  sub20: { sec: 8, make: () => { const a = ri(11, 18), b = ri((a % 10) + 1, 9); return num(`${a}-${b}`, a - b); } },
  add100: { sec: 10, make: () => { const a = ri(11, 89), b = ri(2, 99 - a); return num(`${a}+${b}`, a + b); } },
  sub100: { sec: 10, make: () => { const a = ri(21, 99), b = ri(2, a - 1); return num(`${a}-${b}`, a - b); } },
  multable: { sec: 8, make: () => { const a = ri(2, 9), b = ri(2, 9); return num(`${a}*${b}`, a * b); } },
  divtable: { sec: 8, make: () => { const a = ri(2, 9), b = ri(2, 9); return num(`${a * b}/${a}`, b); } },
  units: { sec: 10, make: () => {
    const n = ri(2, 9);
    const t: [string, number, number][] = [
      [`${n} 米 = ? 厘米`, 100, n], [`${n} 千米 = ? 米`, 1000, n], [`${n} 千克 = ? 克`, 1000, n], [`${n} 时 = ? 分`, 60, n], [`${n} 分 = ? 秒`, 60, n], [`${n} 元 = ? 角`, 10, n],
    ];
    const i = ri(0, t.length - 1);
    const q = [`${n} 米 = ? 厘米`, `${n} 千米 = ? 米`, `${n} 千克 = ? 克`, `${n} 时 = ? 分`, `${n} 分 = ? 秒`, `${n} 元 = ? 角`][i];
    return { q, a: String(t[i][1] * n), chk: `${n}*${t[i][1]}===${t[i][1] * n}`, wrong: [String(t[i][1] * n * 10), String(t[i][1] * n / 10), String(t[i][1] * (n + 1)), String(t[i][1] * n + t[i][1])] };
  } },
  add3: { sec: 14, make: () => { const a = ri(120, 880), b = ri(110, 999 - a); return num(`${a}+${b}`, a + b); } },
  sub3: { sec: 14, make: () => { const a = ri(300, 999), b = ri(101, a - 1); return num(`${a}-${b}`, a - b); } },
  mul1: { sec: 14, make: () => { const a = ri(12, 999), b = ri(2, 9); return num(`${a}*${b}`, a * b); } },
  div1: { sec: 14, make: () => { const b = ri(2, 9), r = ri(12, 199); return num(`${r * b}/${b}`, r); } },
  rect: { sec: 12, make: () => {
    const l = ri(3, 20), w = ri(2, l);
    const k = ri(0, 2);
    if (k === 0) return { q: `长 ${l}、宽 ${w} 的长方形，面积 = ?`, a: String(l * w), chk: `${l}*${w}===${l * w}`, wrong: [String(2 * (l + w)), String(l + w), String(l * w + l), String(l * w - w)] };
    if (k === 1) return { q: `长 ${l}、宽 ${w} 的长方形，周长 = ?`, a: String(2 * (l + w)), chk: `2*(${l}+${w})===${2 * (l + w)}`, wrong: [String(l * w), String(l + w), String(2 * l + w), String(2 * (l + w) + 2)] };
    return { q: `边长 ${l} 的正方形，面积 = ?`, a: String(l * l), chk: `${l}*${l}===${l * l}`, wrong: [String(4 * l), String(2 * l), String(l * l + l), String(l * (l - 1))] };
  } },
  mul2: { sec: 24, make: () => { const a = ri(12, 99) + (Math.random() < 0.5 ? 0 : ri(1, 4) * 100), b = ri(11, 99); return num(`${a}*${b}`, a * b); } },
  div2: { sec: 24, make: () => { const b = ri(11, 60), r = ri(11, 99); return num(`${b * r}/${b}`, r); } },
  order: { sec: 20, make: () => {
    for (;;) {
      const a = ri(2, 30), b = ri(2, 12), c = ri(2, 12), d = ri(2, 9);
      const e = pick([`(${a}+${b})*${c}`, `${a}+${b}*${c}`, `${a}*${b}-${c}`, `(${a + b}-${b})*${c}`, `${a}*${b}+${c}*${d}`, `${a}+${b}-${c}`, `(${a}-${c})*${d}`, `${a * b}/${b}+${c}`]);
      const v = evalNum(e);
      if (Number.isInteger(v) && v >= 0 && v < 2000) return num(e, v);
    }
  } },
  decaddsub: { sec: 16, make: () => {
    const X = ri(11, 199), Y = ri(11, 199);
    const add = Math.random() < 0.5 || X <= Y;
    const [x, y] = [(X / 10).toFixed(1), (Y / 10).toFixed(1)];
    return num(add ? `${x}+${y}` : `${x}-${y}`, (add ? X + Y : X - Y) / 10, { dec: 1 });
  } },
  angle: { sec: 12, make: () => { const a = ri(20, 90), b = ri(20, 150 - a); return { q: `三角形的两个内角分别是 ${a}° 和 ${b}°，第三个角是多少度？`, a: String(180 - a - b), chk: `${a}+${b}+${180 - a - b}===180` }; } },
  average: { sec: 20, make: () => {
    for (;;) {
      const m = ri(10, 90);
      const l = [0, 1, 2, 3].map(() => m + ri(-8, 8));
      const last = 5 * m - l.reduce((s, x) => s + x, 0);
      if (last > 0) { const all = shuffle([...l, last]); return { q: `${all.join("、")} 的平均数是？`, a: String(m), chk: `(${all.join("+")})/5===${m}` }; }
    }
  } },
  decmul: { sec: 20, make: () => {
    if (Math.random() < 0.5) { let X = ri(12, 99); if (X % 10 === 0) X++; const n = ri(2, 9); return num(`${(X / 10).toFixed(1)}*${n}`, (X * n) / 10, { dec: 1 }); }
    let X = ri(12, 99), Y = ri(12, 99); if (X % 10 === 0) X++; if (Y % 10 === 0) Y++;
    return num(`${(X / 10).toFixed(1)}*${(Y / 10).toFixed(1)}`, (X * Y) / 100, { dec: 2 });
  } },
  decdiv: { sec: 20, make: () => { let R = ri(12, 99); if (R % 10 === 0) R++; const d = ri(2, 9); return num(`${(R * d) / 10}/${d}`, R / 10, { dec: 1 }); } },
  eqsimple: { sec: 16, make: () => {
    const k = ri(0, 2);
    if (k === 0) { const a = ri(2, 40), x = ri(2, 40); return { q: `x + ${a} = ${a + x}，x = ?`, a: String(x), chk: `${x}+${a}===${a + x}` }; }
    if (k === 1) { const a = ri(2, 9), x = ri(2, 20); return { q: `${a}x = ${a * x}，x = ?`, a: String(x), chk: `${a}*${x}===${a * x}` }; }
    const a = ri(2, 40), x = ri(a + 1, a + 40); return { q: `x − ${a} = ${x - a}，x = ?`, a: String(x), chk: `${x}-${a}===${x - a}` };
  } },
  fracsame: { sec: 16, make: () => {
    const d = ri(3, 12), a = ri(2, d - 1), b = ri(1, a - 1 || 1);
    const add = Math.random() < 0.5 && a + b <= d;
    const n = add ? a + b : a - b;
    const ans = frac(n, d);
    return { q: `${fracVal(a, d)} ${add ? "+" : "−"} ${fracVal(b, d)} = ?`, a: ans, chk: `Math.abs(${a}/${d}${add ? "+" : "-"}${b}/${d}-${n}/${d})<1e-9`, wrong: fracWrong(n, d) };
  } },
  fracdiff: { sec: 26, make: () => {
    for (;;) {
      const d1 = pick([2, 3, 4, 5, 6, 8, 10, 12]), d2 = pick([2, 3, 4, 5, 6, 8, 10, 12]);
      if (d1 === d2) continue;
      let a = ri(1, d1 - 1), b = ri(1, d2 - 1);
      let add = Math.random() < 0.6;
      if (!add && a * d2 <= b * d1) add = true;
      const n = add ? a * d2 + b * d1 : a * d2 - b * d1, d = d1 * d2;
      return { q: `${fracVal(a, d1)} ${add ? "+" : "−"} ${fracVal(b, d2)} = ?`, a: frac(n, d), chk: `Math.abs(${a}/${d1}${add ? "+" : "-"}${b}/${d2}-${n}/${d})<1e-9`, wrong: fracWrong(n / gcd(n, d), d / gcd(n, d)) };
    }
  } },
  fracsimp: { sec: 14, make: () => {
    for (;;) {
      const d0 = ri(2, 9), n0 = ri(1, d0 - 1), g = ri(2, 6);
      if (gcd(n0, d0) !== 1) continue;
      return { q: `化简：${n0 * g}/${d0 * g}`, a: `${n0}/${d0}`, chk: `${n0}*${d0 * g}===${d0}*${n0 * g}`, wrong: [...fracWrong(n0, d0), `${n0 * g}/${d0}`, `${n0}/${d0 * g}`].filter((x) => x !== `${n0}/${d0}`) };
    }
  } },
  gcdlcm: { sec: 20, make: () => {
    for (;;) {
      const g = ri(2, 9), a0 = ri(2, 6), b0 = ri(2, 6);
      if (a0 === b0 || gcd(a0, b0) !== 1) continue;
      const a = g * a0, b = g * b0;
      if (Math.random() < 0.5) return { q: `${a} 和 ${b} 的最大公因数是？`, a: String(g), chk: `${gcd(a, b)}===${g}`, wrong: [String(a0), String(b0), String(g * 2), String(g + 1), String(a0 * b0)] };
      return { q: `${a} 和 ${b} 的最小公倍数是？`, a: String(lcm(a, b)), chk: `${lcm(a, b)}%${a}===0&&${lcm(a, b)}%${b}===0`, wrong: [String(a * b), String(g), String(lcm(a, b) * 2), String(lcm(a, b) + g)] };
    }
  } },
  triarea: { sec: 14, make: () => { for (;;) { const b = ri(3, 20), h = ri(3, 20); if ((b * h) % 2 === 0) return { q: `底 ${b}、高 ${h} 的三角形，面积 = ?`, a: String((b * h) / 2), chk: `${b}*${h}/2===${(b * h) / 2}`, wrong: [String(b * h), String(b + h), String((b + h) / 2 | 0), String((b * h) / 2 + b)] }; } } },
  fracmul: { sec: 22, make: () => {
    const b = ri(2, 9), a = ri(1, b - 1 || 1), d = ri(2, 9), c = ri(1, d - 1 || 1);
    const n = a * c, den = b * d;
    return { q: `${fracVal(a, b)} × ${fracVal(c, d)} = ?`, a: frac(n, den), chk: `Math.abs(${a}/${b}*${c}/${d}-${n}/${den})<1e-9`, wrong: [...fracWrong(n / gcd(n, den), den / gcd(n, den)), frac(a * d, b * c), frac(a + c, b + d)].filter((x) => x !== frac(n, den)) };
  } },
  fracdiv: { sec: 24, make: () => {
    const b = ri(2, 9), a = ri(1, b), d = ri(2, 9), c = ri(1, d - 1 || 1);
    const n = a * d, den = b * c;
    return { q: `${fracVal(a, b)} ÷ ${fracVal(c, d)} = ?`, a: frac(n, den), chk: `Math.abs((${a}/${b})/(${c}/${d})-${n}/${den})<1e-9`, wrong: [frac(a * c, b * d), frac(b * c, a * d), ...fracWrong(n / gcd(n, den), den / gcd(n, den))].filter((x) => x !== frac(n, den)) };
  } },
  percent: { sec: 16, make: () => {
    if (Math.random() < 0.5) { const p = pick([5, 10, 20, 25, 30, 40, 50, 60, 75, 80]), N = ri(1, 10) * 20, v = (p * N) / 100; return { q: `${p}% × ${N} = ?`, a: String(v), chk: `Math.abs(${p}/100*${N}-${v})<1e-9` }; }
    const b = ri(1, 10) * 20, p = ri(1, 19) * 5, a = (b * p) / 100;
    return { q: `${a} ÷ ${b} = ?%`, a: `${p}%`, chk: `Math.abs(${a}/${b}*100-${p})<1e-9`, wrong: [`${p + 5}%`, `${p - 5 > 0 ? p - 5 : p + 10}%`, `${p + 10}%`, `${Math.round(p / 2)}%`, `${p * 2}%`] };
  } },
  ratio: { sec: 14, make: () => {
    for (;;) {
      const a0 = ri(1, 9), b0 = ri(1, 9), g = ri(2, 9);
      if (gcd(a0, b0) !== 1 || a0 === b0) continue;
      return { q: `化简比：${a0 * g} : ${b0 * g}`, a: `${a0} : ${b0}`, chk: `${a0}*${b0 * g}===${b0}*${a0 * g}`, wrong: [`${b0} : ${a0}`, `${a0 * g} : ${b0}`, `${a0} : ${b0 * g}`, `${a0 + 1} : ${b0}`] };
    }
  } },
  circle: { sec: 22, make: () => {
    const r = ri(1, 10);
    if (Math.random() < 0.5) return { q: `半径 ${r}（π 取 3.14），圆的周长 = ?`, a: String((628 * r) / 100), chk: `Math.abs(2*3.14*${r}-${(628 * r) / 100})<1e-9`, wrong: [String((314 * r) / 100), String((314 * r * r) / 100), String((628 * r * r) / 100), String((628 * r) / 100 + 3.14)], dec: 2 };
    return { q: `半径 ${r}（π 取 3.14），圆的面积 = ?`, a: String((314 * r * r) / 100), chk: `Math.abs(3.14*${r}*${r}-${(314 * r * r) / 100})<1e-9`, wrong: [String((628 * r) / 100), String((314 * r) / 100), String((628 * r * r) / 100), String((314 * r * r) / 100 + r)], dec: 2 };
  } },
  prop: { sec: 20, make: () => { const a = ri(2, 9), k = ri(2, 6), c = ri(2, 9); const b = a * k, x = c * k; return { q: `${a} : ${b} = ${c} : x，x = ?`, a: String(x), chk: `${a}*${x}===${b}*${c}` }; } },
  ratadd: { sec: 14, make: () => {
    const a = pick([-1, 1]) * ri(1, 12), b = pick([-1, 1]) * ri(1, 12), add = Math.random() < 0.5;
    const e = `${br(a)}${add ? "+" : "-"}${br(b)}`;
    return num(e, add ? a + b : a - b, { neg: true });
  } },
  ratmul: { sec: 16, make: () => {
    const a = pick([-1, 1]) * ri(2, 9), b = pick([-1, 1]) * ri(2, 9);
    if (Math.random() < 0.5) return num(`${br(a)}*${br(b)}`, a * b, { neg: true });
    return num(`${br(a * b)}/${br(b)}`, a, { neg: true });
  } },
  lineq1: { sec: 24, make: () => {
    const a = ri(2, 9), x = pick([-1, 1]) * ri(1, 9), b = pick([-1, 1]) * ri(1, 9), c = a * x + b;
    return { q: `${a}x ${sign(b)} ${Math.abs(b)} = ${M(c)}，x = ?`, a: M(x), chk: `${a}*${x}+${b}===${c}`, neg: true };
  } },
  lineq2: { sec: 30, make: () => {
    for (;;) {
      const a = ri(2, 9), c = ri(1, 8), x = pick([-1, 1]) * ri(1, 8), b = pick([-1, 1]) * ri(1, 9);
      if (a === c) continue;
      const d = (a - c) * x + b;
      if (d === 0) continue;
      return { q: `${a}x ${sign(b)} ${Math.abs(b)} = ${c}x ${sign(d)} ${Math.abs(d)}，x = ?`, a: M(x), chk: `${a}*${x}+${b}===${c}*${x}+${d}`, neg: true };
    }
  } },
  liketerms: { sec: 20, make: () => {
    for (;;) {
      const c = [0, 1, 2].map(() => pick([-1, 1]) * ri(2, 9));
      const s = c[0] + c[1] + c[2];
      if (Math.abs(s) < 2) continue;
      const q = `${fx(c[0])} ${sign(c[1])} ${Math.abs(c[1])}x ${sign(c[2])} ${Math.abs(c[2])}x = ?`;
      return { q, a: fx(s), chk: `${c[0]}+${c[1]}+${c[2]}===${s}`, wrong: [fx(s + 1 === 1 ? s + 2 : s + 1), fx(s - 1 === 1 || s - 1 === -1 ? s - 2 : s - 1), fx(c[0] + c[1] - c[2] || 2), fx(c[0] - c[1] + c[2] || 3)].filter((x) => x !== fx(s)) };
    }
  } },
  polymul: { sec: 30, make: () => {
    const p = pick([-1, 1]) * ri(1, 6), q = pick([-1, 1]) * ri(1, 6);
    const b = p + q, c = p * q;
    return { q: `(x ${sign(p)} ${Math.abs(p)})(x ${sign(q)} ${Math.abs(q)}) = ?`, a: poly(b, c), chk: `(${p}+${q})===${b}&&${p}*${q}===${c}`, wrong: [poly(-b, c), poly(b, -c), poly(p - q || 7, c), poly(c, b), poly(b + 1, c)].filter((x) => x !== poly(b, c)) };
  } },
  sqrt: { sec: 12, make: () => {
    const n = ri(2, 15), k = ri(0, 2);
    if (k === 0) return { q: `√${n * n} = ?`, a: String(n), chk: `${n}*${n}===${n * n}` };
    if (k === 1) return { q: `${n}² = ?`, a: String(n * n), chk: `${n}**2===${n * n}`, wrong: [String(2 * n), String(n * n + n), String(n * (n - 1))] };
    return { q: `(−${n})² = ?`, a: String(n * n), chk: `(-${n})**2===${n * n}`, wrong: [String(-n * n), String(2 * n), String(-2 * n)], neg: true };
  } },
  pythag: { sec: 24, make: () => {
    const [a0, b0, c0] = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41]]);
    const k = ri(1, a0 > 8 ? 1 : 3), a = a0 * k, b = b0 * k, c = c0 * k;
    if (Math.random() < 0.5) return { q: `a = ${a}，b = ${b}，c = ?（直角三角形，c 是斜边）`, a: String(c), chk: `${a}**2+${b}**2===${c}**2` };
    return { q: `a = ${a}，c = ${c}，b = ?（直角三角形，c 是斜边）`, a: String(b), chk: `${a}**2+${b}**2===${c}**2` };
  } },
  linfn: { sec: 24, make: () => {
    const k = pick([-1, 1]) * ri(1, 5), b = ri(-9, 9), t = ri(-3, 5), y = k * t + b;
    return { q: `y = ${fx(k)}${b ? ` ${sign(b)} ${Math.abs(b)}` : ""}，x = ${M(t)}，y = ?`, a: M(y), chk: `${k}*${t}+${b}===${y}`, neg: true };
  } },
  median: { sec: 20, make: () => {
    const n = pick([5, 7]);
    const l = shuffle(Array.from({ length: n }, () => ri(1, 60)));
    const s = [...l].sort((x, y) => x - y), m = s[(n - 1) / 2];
    return { q: `${l.join("、")} 的中位数是？`, a: String(m), chk: `${[...l].sort((x, y) => x - y)[(n - 1) / 2]}===${m}`, wrong: [String(s[(n - 1) / 2 - 1]), String(s[(n - 1) / 2 + 1]), String(Math.round(l.reduce((x, y) => x + y, 0) / n)), String(l[(n - 1) / 2])].filter((x) => x !== String(m)) };
  } },
  quadeq: { sec: 40, make: () => {
    for (;;) {
      const r1 = pick([-1, 1]) * ri(1, 7), r2 = pick([-1, 1]) * ri(1, 7);
      if (r1 === r2) continue;
      const b = -(r1 + r2), c = r1 * r2, fmt = (x: number, y: number) => [x, y].sort((p, q) => p - q).map(M).join(", ");
      return { q: `${poly(b, c)} = 0，x = ?`, a: fmt(r1, r2), chk: `(${r1})**2+(${b})*(${r1})+(${c})===0&&(${r2})**2+(${b})*(${r2})+(${c})===0`, wrong: [fmt(-r1, -r2), fmt(r1, -r2), fmt(-r1, r2), fmt(r1 + 1, r2 - 1)].filter((x) => x !== fmt(r1, r2)) };
    }
  } },
  trig: { sec: 12, make: () => {
    const T: Record<string, string> = { "sin 30°": "1/2", "sin 45°": "√2/2", "sin 60°": "√3/2", "cos 30°": "√3/2", "cos 45°": "√2/2", "cos 60°": "1/2", "tan 30°": "√3/3", "tan 45°": "1", "tan 60°": "√3" };
    const k = pick(Object.keys(T)), a = T[k];
    const pool = ["1/2", "√2/2", "√3/2", "√3/3", "1", "√3"].filter((x) => x !== a);
    const vals: Record<string, number> = { "1/2": 0.5, "√2/2": Math.SQRT2 / 2, "√3/2": Math.sqrt(3) / 2, "√3/3": Math.sqrt(3) / 3, "1": 1, "√3": Math.sqrt(3) };
    const rad = Number(k.split(" ")[1].replace("°", "")) * Math.PI / 180, f = k.startsWith("sin") ? "sin" : k.startsWith("cos") ? "cos" : "tan";
    return { q: `${k} = ?`, a, chk: `Math.abs(Math.${f}(${rad})-${vals[a]})<1e-9`, wrong: shuffle(pool).slice(0, 3) };
  } },
  prob: { sec: 20, make: () => { const r = ri(1, 7), b = ri(1, 8 - r || 1), n = r + b; return { q: `袋中有 ${r} 个红球、${b} 个蓝球，任取一个，是红球的概率是？`, a: frac(r, n), chk: `${r}*${n / gcd(r, n)}===${r / gcd(r, n)}*${n}&&${r}<${n}`, wrong: fracWrong(r / gcd(r, n), n / gcd(r, n)) }; } },
  // ---- word problems (Chinese sentences; the numbers are made on the spot) ----
  wp1: { sec: 14, make: () => {
    if (Math.random() < 0.5) { const a = ri(3, 12), b = ri(2, 20 - a); return { q: `小明有 ${a} 个苹果，又买了 ${b} 个，一共有几个？`, a: String(a + b), chk: `${a}+${b}===${a + b}` }; }
    const a = ri(5, 18), b = ri(1, a - 1); return { q: `树上有 ${a} 只鸟，飞走了 ${b} 只，还剩几只？`, a: String(a - b), chk: `${a}-${b}===${a - b}` };
  } },
  wp2: { sec: 16, make: () => {
    if (Math.random() < 0.5) { const a = ri(2, 9), b = ri(2, 9); return { q: `每盒有 ${a} 支铅笔，${b} 盒一共有多少支？`, a: String(a * b), chk: `${a}*${b}===${a * b}` }; }
    const a = ri(2, 9), b = ri(2, 9); return { q: `${a * b} 个苹果平均分给 ${a} 个小朋友，每人分几个？`, a: String(b), chk: `${a * b}/${a}===${b}` };
  } },
  wp3: { sec: 22, make: () => {
    const k = ri(0, 2);
    if (k === 0) { const v = ri(3, 12) * 10, t = ri(2, 9); return { q: `一辆车每小时行 ${v} 千米，${t} 小时行多少千米？`, a: String(v * t), chk: `${v}*${t}===${v * t}` }; }
    if (k === 1) { const l = ri(5, 30), w = ri(3, l); return { q: `一个长方形花坛，长 ${l} 米，宽 ${w} 米，绕它走一圈是多少米？`, a: String(2 * (l + w)), chk: `2*(${l}+${w})===${2 * (l + w)}`, wrong: [String(l * w), String(l + w), String(2 * l + w)] }; }
    const a = ri(30, 90), b = ri(5, a - 5), c = ri(5, 40); return { q: `商店有 ${a} 个球，卖出 ${b} 个，又进货 ${c} 个，现在有多少个？`, a: String(a - b + c), chk: `${a}-${b}+${c}===${a - b + c}` };
  } },
  wp4: { sec: 26, make: () => {
    const k = ri(0, 2);
    if (k === 0) { const d = ri(2, 9), x = ri(d + 3, d + 30); return { q: `小华今年 ${x} 岁，比弟弟大 ${d} 岁，弟弟几岁？`, a: String(x - d), chk: `${x}-${d}===${x - d}` }; }
    if (k === 1) { const n = ri(2, 9), r = ri(3, 30); return { q: `${n * r} 元买 ${n} 本相同的练习本，每本多少元？`, a: String(r), chk: `${n * r}/${n}===${r}` }; }
    const d = ri(2, 9), n = ri(3, 20); return { q: `一袋大米 ${d * n} 千克，每天吃 ${d} 千克，能吃几天？`, a: String(n), chk: `${d * n}/${d}===${n}` };
  } },
  wp5: { sec: 34, make: () => {
    const k = ri(0, 2);
    if (k === 0) { const p = ri(2, 20) * 10, z = ri(5, 9); return { q: `一件衣服原价 ${p} 元，打 ${z} 折，现价多少元？`, a: String((p * z) / 10), chk: `${p}*${z}/10===${(p * z) / 10}`, wrong: [String(p - z), String((p * (10 - z)) / 10), String(p * z)] }; }
    if (k === 1) { const n = ri(1, 4) * 20, q = ri(1, 15) * 5, v = (n * q) / 100; return { q: `一个班有 ${n} 人，其中女生占 ${q}%，女生有多少人？`, a: String(v), chk: `${n}*${q}/100===${v}` }; }
    const a = ri(1, 5), b = ri(a + 1, 7), g = ri(2, 9); return { q: `糖和水的质量比是 ${a} : ${b}，糖有 ${a * g} 克，水有多少克？`, a: String(b * g), chk: `${a * g}*${b}===${b * g}*${a}` };
  } },
  wp6: { sec: 40, make: () => {
    const k = ri(0, 2);
    if (k === 0) { const m = ri(2, 9), x = ri(2, 15), b = ri(1, 20); return { q: `一个数的 ${m} 倍加 ${b} 等于 ${m * x + b}，这个数是多少？`, a: String(x), chk: `${m}*${x}+${b}===${m * x + b}` }; }
    if (k === 1) { const b = ri(2, 30), d = ri(1, 12) * 2; return { q: `甲乙两数的和是 ${2 * b + d}，甲比乙大 ${d}，甲是多少？`, a: String(b + d), chk: `${b + d}+${b}===${2 * b + d}&&${b + d}-${b}===${d}` }; }
    const a = ri(2, 9), c = ri(2, 9), n = ri(2, 6), m = ri(2, 6); return { q: `买 ${n} 支笔和 ${m} 本本子共 ${n * a + m * c} 元，笔每支 ${a} 元，本子每本多少元？`, a: String(c), chk: `${n}*${a}+${m}*${c}===${n * a + m * c}` };
  } },
  wp7: { sec: 44, make: () => {
    if (Math.random() < 0.5) {
      const [a0, b0, c0] = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17]]); const k = ri(1, 3);
      return { q: `一架 ${c0 * k} 米长的梯子靠在墙上，底端离墙 ${a0 * k} 米，梯子顶端离地面多少米？`, a: String(b0 * k), chk: `${a0 * k}**2+${b0 * k}**2===${c0 * k}**2` };
    }
    const n = ri(3, 20); return { q: `两个连续正整数的积是 ${n * (n + 1)}，较小的数是多少？`, a: String(n), chk: `${n}*${n + 1}===${n * (n + 1)}`, wrong: [String(n + 1), String(n - 1), String(n * 2)] };
  } },
  // ---- more of junior high ----
  absval: { sec: 14, make: () => {
    const a = ri(1, 15), b = ri(1, 15);
    if (Math.random() < 0.5) return num(`Math.abs(-${a})+Math.abs(${b})`, a + b, { q: `|−${a}| + |${b}| = ?`, neg: true });
    return num(`-(-${a})`, a, { q: `−(−${a}) = ?`, neg: true, wrong: [M(-a), M(a + 1), M(-a - 1)] });
  } },
  power: { sec: 18, make: () => {
    const a = ri(2, 6), n = pick([2, 3, 4]), sup = n === 2 ? "²" : n === 3 ? "³" : "⁴", neg = Math.random() < 0.5 && a <= 4;
    const v = (neg ? -a : a) ** n;
    return { q: `${neg ? `(−${a})` : a}${sup} = ?`, a: M(v), chk: `${neg ? `(-${a})` : a}**${n}===${v}`, neg: true, wrong: [M(a * n), M(-v), M(v + a), M((neg ? -a : a) * a)] };
  } },
  ineq: { sec: 30, make: () => {
    const a = ri(2, 6), x = ri(-4, 8), b = pick([-1, 1]) * ri(1, 9), c = a * x + b;
    return { q: `解不等式：${a}x ${sign(b)} ${Math.abs(b)} > ${M(c)}`, a: `x > ${M(x)}`, chk: `${a}*${x}+${b}===${c}`, wrong: [`x < ${M(x)}`, `x > ${M(x + 1)}`, `x < ${M(x - 1)}`, `x > ${M(-x)}`].filter((v) => v !== `x > ${M(x)}`) };
  } },
  sqrtsimp: { sec: 26, make: () => {
    const k = ri(2, 6), m = pick([2, 3, 5, 6, 7]);
    return { q: `√${k * k * m} = ?`, a: `${k}√${m}`, chk: `Math.abs(Math.sqrt(${k * k * m})-${k}*Math.sqrt(${m}))<1e-9`, wrong: [`${k * k}√${m}`, `${m}√${k}`, `${k}√${m + 1}`, `${k + 1}√${m}`] };
  } },
  sqform: { sec: 30, make: () => {
    const a = ri(2, 9);
    if (Math.random() < 0.5) return { q: `(x + ${a})(x − ${a}) = ?`, a: poly(0, -a * a), chk: `(3+${a})*(3-${a})===9-${a * a}`, wrong: [poly(0, a * a), poly(-2 * a, -a * a), poly(2 * a, -a * a), poly(0, -a)] };
    const s = pick([-1, 1]);
    return { q: `(x ${sign(s)} ${a})² = ?`, a: poly(2 * s * a, a * a), chk: `(3+(${s * a}))**2===9+${2 * s * a}*3+${a * a}`, wrong: [poly(0, a * a), poly(2 * s * a, -a * a), poly(s * a, a * a), poly(-2 * s * a, a * a)] };
  } },
  factor: { sec: 40, make: () => {
    for (;;) {
      const p = pick([-1, 1]) * ri(1, 7), q = pick([-1, 1]) * ri(1, 7);
      if (p === q) continue;
      const f = (u: number, v: number) => { const [x, y] = [u, v].sort((m, n) => m - n); return `(x ${sign(x)} ${Math.abs(x)})(x ${sign(y)} ${Math.abs(y)})`; };
      return { q: `因式分解：${poly(p + q, p * q)}`, a: f(p, q), chk: `(${p})*(${q})===${p * q}&&(${p})+(${q})===${p + q}`, wrong: [f(-p, -q), f(p, -q), f(-p, q), f(p + 1, q - 1)].filter((v) => v !== f(p, q)) };
    }
  } },
  invprop: { sec: 24, make: () => {
    const x0 = pick([-1, 1]) * ri(1, 6), y0 = pick([-1, 1]) * ri(1, 6), k = x0 * y0;
    return { q: `y = ${M(k)}/x，x = ${M(x0)}，y = ?`, a: M(y0), chk: `${k}/(${x0})===${y0}`, neg: true, wrong: [M(-y0), M(k * x0), M(k + x0), M(y0 + 1)] };
  } },
  quadvertex: { sec: 30, make: () => {
    const h = pick([-1, 1]) * ri(1, 6), k = pick([-1, 1]) * ri(1, 8);
    const f = (a: number, b: number) => `(${M(a)}, ${M(b)})`;
    return { q: `二次函数 y = (x ${sign(-h)} ${Math.abs(h)})² ${sign(k)} ${Math.abs(k)} 的顶点坐标是？`, a: f(h, k), chk: `((${h})-(${h}))**2+(${k})===${k}&&((${h})+1-(${h}))**2+(${k})>${k}`, wrong: [f(-h, k), f(h, -k), f(k, h), f(-h, -k)] };
  } },
  arc: { sec: 30, make: () => {
    const n = pick([30, 45, 60, 90, 120, 180]), r = (180 / gcd(n, 180)) * ri(1, 3), v = (n * r) / 180;
    return { q: `半径 ${r}，圆心角 ${n}°，弧长 = ?`, a: `${v}π`, chk: `${n}*${r}/180===${v}`, wrong: [`${2 * v}π`, `${v + 1}π`, `${r}π`, `${v * 2 + 1}π`].filter((x) => x !== `${v}π`) };
  } },
};

/** the foundations of primary school and the figures (rule 52) are in mathgen2.ts */
Object.assign(GEN, GEN2);

export const topicIds = (): string[] => Object.keys(GEN);
/** seconds the topic is given per question (the total time of a game is the sum over its questions) */
export const secOf = (topic: string): number => GEN[topic]?.sec ?? 15;

/** one question of a topic, with its four choices */
export function make(topic: string): Q {
  const g = GEN[topic];
  if (!g) throw new Error(`unknown topic ${topic}`);
  const r = g.make();
  return { topic, q: r.q, a: r.a, choices: choices(r), chk: r.chk, ...(r.fig ? { fig: r.fig } : {}) };
}

/** `n` questions for the given topics (round robin, shuffled); the same question text never appears twice in one game */
export function makeSet(topics: string[], n: number): Q[] {
  const out: Q[] = [];
  const seen = new Set<string>();
  const key = (x: Q) => x.q + (x.fig ? `\u0000${x.fig}` : "");   // (the same text with another figure is another question)
  const order = shuffle(Array.from({ length: n }, (_, i) => topics[i % topics.length]));
  for (const t of order) {
    let q = make(t);
    for (let i = 0; i < 12 && seen.has(key(q)); i++) q = make(t);
    seen.add(key(q));
    out.push(q);
  }
  return out;
}
