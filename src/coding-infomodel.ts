/**
 * 编程 phase 2, 信息科技 side: the PURE models of the labs of worlds 14 (数据与编码) and 15 (网络与信息安全 + 人工智能启蒙). No screens, no storage, no clock,
 * no Math.random (every generator takes a seed): binary / hex, UTF-8, run-length coding, Huffman, ciphers, check digits, a mini spreadsheet, statistics, a packet
 * network, password strength, k-nearest-neighbours, a decision tree, an inverted index, a biased data set, a tiny digit recogniser.
 * Written by a model from memory; a 信息科技 teacher must proofread the content that uses it.
 */
export function rng(seed: number): () => number {
  let a = seed | 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const rint = (r: () => number, a: number, b: number): number => a + Math.floor(r() * (b - a + 1));
export function shuffle<T>(xs: T[], r: () => number): T[] { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const pick = <T>(xs: T[], r: () => number): T => xs[Math.floor(r() * xs.length)];

// ---------- binary and hexadecimal ----------
export const toBin = (n: number, bits = 0): string => n.toString(2).padStart(bits, "0");
export const fromBin = (s: string): number => parseInt(s, 2);
export const toHex = (n: number, w = 2): string => n.toString(16).toUpperCase().padStart(w, "0");
export const capacity = (bits: number): number => 2 ** bits;
/** the sum of two bit strings, written by the school method (carry from the right), without using Number addition */
export function addBinary(a: string, b: string): { sum: string; carries: string } {
  const n = Math.max(a.length, b.length);
  a = a.padStart(n, "0"); b = b.padStart(n, "0");
  let carry = 0, sum = "", carries = "";
  for (let i = n - 1; i >= 0; i--) {
    const t = Number(a[i]) + Number(b[i]) + carry;
    sum = String(t % 2) + sum; carry = t >> 1; carries = String(carry) + carries;
  }
  return { sum: carry ? "1" + sum : sum, carries };
}

// ---------- text encoding ----------
export const asciiCode = (ch: string): number => ch.charCodeAt(0);
export const utf8Bytes = (s: string): number[] => [...new TextEncoder().encode(s)];
export const utf8Hex = (s: string): string[] => utf8Bytes(s).map((b) => toHex(b));
/** what a program shows when UTF-8 bytes are read with the wrong table (windows-1252): 乱码 */
export const mojibake = (s: string): string => new TextDecoder("windows-1252").decode(new Uint8Array(utf8Bytes(s)));
export const utf8Length = (ch: string): number => utf8Bytes(ch).length;

// ---------- run-length coding ----------
export function rleEncode(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; ) { let j = i; while (j < s.length && s[j] === s[i]) j++; out += `${j - i}${s[i]}`; i = j; }
  return out;
}
export function rleDecode(s: string): string {
  let out = "";
  for (const m of s.matchAll(/(\d+)(\D)/g)) out += m[2].repeat(Number(m[1]));
  return out;
}

// ---------- Huffman ----------
export interface HNode { id: number; w: number; sym?: string; l?: HNode; r?: HNode }
export const hInit = (freq: Record<string, number>): HNode[] => Object.keys(freq).sort().map((s, i) => ({ id: i, w: freq[s], sym: s }));
/** merges the nodes at positions i and j (a new node with the summed weight, children in the order given) */
export function hMerge(nodes: HNode[], i: number, j: number, id: number): HNode[] {
  const a = nodes[i], b = nodes[j];
  return [...nodes.filter((_, k) => k !== i && k !== j), { id, w: a.w + b.w, l: a, r: b }];
}
/** is merging i and j a correct Huffman step? (their weights must be the two smallest; ties are free) */
export function hValid(nodes: HNode[], i: number, j: number): boolean {
  if (i === j || !nodes[i] || !nodes[j]) return false;
  const ws = nodes.map((n) => n.w).sort((a, b) => a - b);
  return nodes[i].w + nodes[j].w === ws[0] + ws[1] && Math.max(nodes[i].w, nodes[j].w) <= ws[1];
}
export function huffman(freq: Record<string, number>): { codes: Record<string, string>; cost: number; root: HNode } {
  let nodes = hInit(freq), id = nodes.length;
  if (nodes.length === 1) return { codes: { [nodes[0].sym!]: "0" }, cost: nodes[0].w, root: nodes[0] };
  while (nodes.length > 1) {
    const idx = nodes.map((_, i) => i).sort((p, q) => nodes[p].w - nodes[q].w || nodes[p].id - nodes[q].id);
    nodes = hMerge(nodes, idx[0], idx[1], id++);
  }
  const codes: Record<string, string> = {};
  const go = (n: HNode, p: string) => { if (n.sym !== undefined) codes[n.sym] = p; else { go(n.l!, p + "0"); go(n.r!, p + "1"); } };
  go(nodes[0], "");
  const cost = Object.entries(freq).reduce((s, [k, f]) => s + f * codes[k].length, 0);
  return { codes, cost, root: nodes[0] };
}
export const freqOf = (s: string): Record<string, number> => { const f: Record<string, number> = {}; for (const c of s) f[c] = (f[c] ?? 0) + 1; return f; };
export const huffEncode = (s: string, codes: Record<string, string>): string => [...s].map((c) => codes[c]).join("");
export function huffDecode(bits: string, codes: Record<string, string>): string {
  const inv = new Map(Object.entries(codes).map(([k, v]) => [v, k]));
  let out = "", cur = "";
  for (const b of bits) { cur += b; const c = inv.get(cur); if (c !== undefined) { out += c; cur = ""; } }
  return out;
}

// ---------- ciphers ----------
export function caesar(s: string, k: number): string {
  return s.replace(/[a-z]/gi, (c) => { const base = c <= "Z" ? 65 : 97; return String.fromCharCode(((((c.charCodeAt(0) - base + k) % 26) + 26) % 26) + base); });
}
export function makeSubst(seed: number): string {
  const r = rng(seed), A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  for (let t = 0; t < 100; t++) { const p = shuffle(A, r); if (p.every((c, i) => c !== A[i])) return p.join(""); }
  return A.slice(1).concat(A[0]).join("");
}
export const substApply = (s: string, key: string): string => s.replace(/[A-Z]/g, (c) => key[c.charCodeAt(0) - 65]);
export const substInvert = (key: string): string => { const o = Array(26).fill("?"); [...key].forEach((c, i) => (o[c.charCodeAt(0) - 65] = String.fromCharCode(65 + i))); return o.join(""); };
export function letterFreq(s: string): number[] { const f = Array(26).fill(0); for (const c of s.toUpperCase()) if (c >= "A" && c <= "Z") f[c.charCodeAt(0) - 65]++; return f; }
export const xorBits = (a: string, b: string): string => [...a].map((c, i) => (c === b[i] ? "0" : "1")).join("");

// ---------- check digits and error correction ----------
export const parityBit = (bits: string, even = true): string => { const ones = [...bits].filter((c) => c === "1").length; return String((ones % 2 === 0) === even ? 0 : 1); };
export const parityOk = (bitsWithParity: string, even = true): boolean => [...bitsWithParity].filter((c) => c === "1").length % 2 === (even ? 0 : 1);
/** a grid of data bits with a parity column and a parity row (even parity); the one flipped bit is where the odd row and the odd column cross */
export function addParity2d(data: number[][]): number[][] {
  const rows = data.map((r) => [...r, r.reduce((a, b) => a + b, 0) % 2]);
  rows.push(rows[0].map((_, c) => rows.reduce((a, r) => a + r[c], 0) % 2));
  return rows;
}
export function locateError2d(g: number[][]): [number, number] | null {
  const r = g.findIndex((row) => row.reduce((a, b) => a + b, 0) % 2 === 1);
  const c = g[0].findIndex((_, ci) => g.reduce((a, row) => a + row[ci], 0) % 2 === 1);
  return r < 0 || c < 0 ? null : [r, c];
}
/** Hamming(7,4): the bits d1..d4 go to positions 3, 5, 6, 7; the parity bits are positions 1, 2, 4 */
export function hamEncode(d: number[]): number[] {
  const w = [0, 0, d[0], 0, d[1], d[2], d[3]];
  w[0] = (w[2] + w[4] + w[6]) % 2; w[1] = (w[2] + w[5] + w[6]) % 2; w[3] = (w[4] + w[5] + w[6]) % 2;
  return w;
}
/** 0 = no error, otherwise the (1-based) position of the flipped bit */
export function hamSyndrome(w: number[]): number {
  const s1 = (w[0] + w[2] + w[4] + w[6]) % 2, s2 = (w[1] + w[2] + w[5] + w[6]) % 2, s3 = (w[3] + w[4] + w[5] + w[6]) % 2;
  return s1 + 2 * s2 + 4 * s3;
}
export function hamFix(w: number[]): number[] { const p = hamSyndrome(w), o = w.slice(); if (p) o[p - 1] ^= 1; return o; }
export const hamData = (w: number[]): number[] => [w[2], w[4], w[5], w[6]];
export function isbn13Check(d12: string): number { const s = [...d12].reduce((a, c, i) => a + Number(c) * (i % 2 ? 3 : 1), 0); return (10 - (s % 10)) % 10; }
export const isbn13Valid = (d13: string): boolean => d13.length === 13 && isbn13Check(d13.slice(0, 12)) === Number(d13[12]);
const IDW = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
export const idCheck = (d17: string): string => "10X98765432"[[...d17].reduce((a, c, i) => a + Number(c) * IDW[i], 0) % 11];
export const idValid = (d18: string): boolean => d18.length === 18 && idCheck(d18.slice(0, 17)) === d18[17].toUpperCase();

// ---------- statistics ----------
export const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
export function median(xs: number[]): number { const s = xs.slice().sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
export function modes(xs: number[]): number[] {
  const c = new Map<number, number>(); for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  const best = Math.max(...c.values());
  return [...c].filter(([, n]) => n === best).map(([v]) => v).sort((a, b) => a - b);
}
export const fmtNum = (v: number): string => String(Math.round(v * 10000) / 10000);

// ---------- a mini spreadsheet ----------
export type Cell = number | string;
const COLS = "ABCDEF";
const refRe = /^([A-F])([1-9]\d?)$/;
/** evaluates a sheet: `cells` maps "A1" to what was typed (a number, text, or a formula starting with "="); errors are texts starting with # */
export function evalSheet(cells: Record<string, string>): Record<string, Cell> {
  const out: Record<string, Cell> = {}, busy = new Set<string>();
  const get = (k: string): Cell => {
    if (k in out) return out[k];
    if (busy.has(k)) return "#REF!";
    busy.add(k);
    const raw = (cells[k] ?? "").trim();
    let v: Cell = raw === "" ? "" : raw[0] === "=" ? formula(raw.slice(1)) : raw !== "" && !isNaN(Number(raw)) ? Number(raw) : raw;
    busy.delete(k);
    out[k] = v;
    return v;
  };
  const range = (a: string, b: string): Cell[] => {
    const m1 = refRe.exec(a), m2 = refRe.exec(b);
    if (!m1 || !m2) return [];
    const c1 = Math.min(COLS.indexOf(m1[1]), COLS.indexOf(m2[1])), c2 = Math.max(COLS.indexOf(m1[1]), COLS.indexOf(m2[1]));
    const r1 = Math.min(+m1[2], +m2[2]), r2 = Math.max(+m1[2], +m2[2]);
    const o: Cell[] = [];
    for (let c = c1; c <= c2; c++) for (let r = r1; r <= r2; r++) o.push(get(COLS[c] + r));
    return o;
  };
  function formula(src: string): Cell {
    const toks = src.toUpperCase().match(/[A-Z]+\d*|\d+\.?\d*|\.\d+|[-+*/(),:]/g);
    if (!toks || toks.join("") !== src.toUpperCase().replace(/\s+/g, "")) return "#ERR";
    let i = 0;
    const err = (m: string): never => { throw new Error(m); };
    const list = (): Cell[] => {
      // arguments: a range, a cell or an expression
      const vals: Cell[] = [];
      for (;;) {
        if (refRe.test(toks[i] ?? "") && toks[i + 1] === ":") { vals.push(...range(toks[i], toks[i + 2] ?? "")); i += 3; }
        else vals.push(expr());
        if (toks[i] === ",") { i++; continue; }
        return vals;
      }
    };
    const num = (c: Cell): number => { if (typeof c === "string") { if (c === "") return 0; if (c.startsWith("#")) err(c); err("#VALUE!"); } return c as number; };
    function atom(): number {
      const t = toks![i++];
      if (t === undefined) return err("#ERR");
      if (t === "(") { const v = expr(); if (toks![i++] !== ")") err("#ERR"); return num(v); }
      if (t === "-") return -atom();
      if (/^[\d.]/.test(t)) return Number(t);
      if (toks![i] === "(") {
        i++;
        const args = list();
        if (toks![i++] !== ")") err("#ERR");
        const nums = args.filter((c): c is number => typeof c === "number");
        for (const c of args) if (typeof c === "string" && c.startsWith("#")) err(c);
        switch (t) {
          case "SUM": return nums.reduce((a, b) => a + b, 0);
          case "AVERAGE": return nums.length ? mean(nums) : err("#DIV/0!");
          case "MAX": return nums.length ? Math.max(...nums) : 0;
          case "MIN": return nums.length ? Math.min(...nums) : 0;
          case "COUNT": return nums.length;
          default: return err("#NAME?");
        }
      }
      if (refRe.test(t)) return num(get(t));
      return err("#NAME?");
    }
    function term(): number { let a = atom(); while (toks![i] === "*" || toks![i] === "/") { const op = toks![i++]; const b = atom(); if (op === "/" && b === 0) err("#DIV/0!"); a = op === "*" ? a * b : a / b; } return a; }
    function expr(): number { let a = term(); while (toks![i] === "+" || toks![i] === "-") { const op = toks![i++]; const b = term(); a = op === "+" ? a + b : a - b; } return a; }
    try { const v = expr(); if (i < toks.length) return "#ERR"; return v; } catch (e) { return e instanceof Error && e.message.startsWith("#") ? e.message : "#ERR"; }
  }
  for (const k of Object.keys(cells)) get(k);
  return out;
}
export const cellName = (c: number, r: number): string => `${COLS[c]}${r + 1}`;

// ---------- a packet network ----------
export interface Packet { seq: number; total: number; data: string }
export const splitMessage = (msg: string, size: number): Packet[] => {
  const parts: string[] = []; for (let i = 0; i < msg.length; i += size) parts.push(msg.slice(i, i + size));
  return parts.map((data, i) => ({ seq: i + 1, total: parts.length, data }));
};
export type Graph = Record<string, string[]>;
export function shortestPath(g: Graph, from: string, to: string): string[] | null {
  const prev = new Map<string, string | null>([[from, null]]), q = [from];
  while (q.length) { const x = q.shift()!; if (x === to) break; for (const y of g[x] ?? []) if (!prev.has(y)) { prev.set(y, x); q.push(y); } }
  if (!prev.has(to)) return null;
  const path = [to]; while (prev.get(path[0]) != null) path.unshift(prev.get(path[0])!);
  return path;
}
/** every packet takes the shortest path; it is dropped when the TTL (the number of hops it may make) is used up; the packets arrive in a shuffled order (seeded) */
export function simulateNetwork(g: Graph, from: string, to: string, packets: Packet[], ttl: number, seed: number): { arrived: Packet[]; dropped: Packet[]; hops: number } {
  const path = shortestPath(g, from, to);
  const hops = path ? path.length - 1 : Infinity;
  if (!path || hops > ttl) return { arrived: [], dropped: packets.slice(), hops };
  return { arrived: shuffle(packets, rng(seed)), dropped: [], hops };
}
export function reassemble(arrived: Packet[]): string | null {
  if (!arrived.length) return null;
  const total = arrived[0].total, by = new Map(arrived.map((p) => [p.seq, p.data]));
  let out = ""; for (let s = 1; s <= total; s++) { if (!by.has(s)) return null; out += by.get(s); }
  return out;
}
export const isIpv4 = (s: string): boolean => /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(s) && s.split(".").every((x) => +x <= 255 && String(+x) === x);

// ---------- passwords ----------
export const COMMON_PASSWORDS = ["123456", "password", "qwerty", "12345678", "111111", "abc123", "iloveyou", "admin", "letmein", "dragon", "monkey", "000000", "123123", "password1", "welcome", "12345", "1234567", "123456789", "qwerty123", "sunshine"];
export function poolSize(pw: string): number { return (/[a-z]/.test(pw) ? 26 : 0) + (/[A-Z]/.test(pw) ? 26 : 0) + (/\d/.test(pw) ? 10 : 0) + (/[^A-Za-z\d]/.test(pw) ? 33 : 0); }
/** a rough guess of the strength in bits: length x log2(pool); a password from the list of common ones is found at once */
export function entropyBits(pw: string): number {
  if (!pw) return 0;
  const i = COMMON_PASSWORDS.indexOf(pw.toLowerCase());
  if (i >= 0) return Math.log2(i + 1) + 1;
  return pw.length * Math.log2(poolSize(pw));
}
export const crackSeconds = (bits: number, perSecond = 1e10): number => 2 ** Math.max(0, bits - 1) / perSecond;
export function strengthLevel(pw: string): 0 | 1 | 2 | 3 | 4 { const b = entropyBits(pw); return b < 28 ? 0 : b < 40 ? 1 : b < 60 ? 2 : b < 80 ? 3 : 4; }
export type TimeUnit = "s" | "min" | "h" | "d" | "y" | "ky" | "my";
export function humanTime(sec: number): { v: number; unit: TimeUnit } {
  if (sec < 1) return { v: 0, unit: "s" };
  const t: [number, TimeUnit][] = [[60, "s"], [3600, "min"], [86400, "h"], [31557600, "d"], [31557600 * 1000, "y"], [31557600 * 1e6, "ky"]];
  const div = [1, 60, 3600, 86400, 31557600, 31557600 * 1000, 31557600 * 1e6];
  for (let k = 0; k < t.length; k++) if (sec < t[k][0]) return { v: Math.floor(sec / div[k]), unit: t[k][1] };
  return { v: Math.floor(sec / div[6]), unit: "my" };
}

// ---------- classification (k nearest neighbours) ----------
export interface Pt { x: number; y: number; c: number }
export function makeBlobs(seed: number, classes: number, per: number, spread: number, flip = 0): Pt[] {
  const r = rng(seed), out: Pt[] = [];
  const centres = [[25, 25], [75, 70], [25, 75], [75, 25]];
  const g = () => { let s = 0; for (let i = 0; i < 6; i++) s += r(); return (s - 3) * 2; };   // roughly normal
  for (let c = 0; c < classes; c++) for (let i = 0; i < per; i++) {
    const x = Math.max(0, Math.min(100, centres[c][0] + g() * spread * 8)), y = Math.max(0, Math.min(100, centres[c][1] + g() * spread * 8));
    out.push({ x, y, c: r() < flip ? (c + 1) % classes : c });
  }
  return out;
}
export function knn(train: Pt[], p: { x: number; y: number }, k: number): number {
  const d = train.map((t) => ({ d: (t.x - p.x) ** 2 + (t.y - p.y) ** 2, c: t.c })).sort((a, b) => a.d - b.d).slice(0, Math.min(k, train.length));
  const votes = new Map<number, number>(); for (const t of d) votes.set(t.c, (votes.get(t.c) ?? 0) + 1);
  let best = d[0].c, bn = 0;
  for (const t of d) { const n = votes.get(t.c)!; if (n > bn) { bn = n; best = t.c; } }
  return best;
}
export const knnAccuracy = (train: Pt[], test: Pt[], k: number): number => test.filter((t) => knn(train, t, k) === t.c).length / test.length;
/** the class of every cell of a w x h picture of the plane (the decision boundary) */
export const boundary = (train: Pt[], k: number, w = 20, h = 20): number[][] => Array.from({ length: h }, (_, j) => Array.from({ length: w }, (_, i) => knn(train, { x: ((i + 0.5) * 100) / w, y: ((j + 0.5) * 100) / h }, k)));

// ---------- a decision tree ----------
export interface Row { f: number[]; y: number }
export const entropy = (counts: number[]): number => { const n = counts.reduce((a, b) => a + b, 0); return n ? -counts.filter((c) => c).reduce((s, c) => s + (c / n) * Math.log2(c / n), 0) : 0; };
export const countsOf = (rows: Row[], classes: number): number[] => { const c = Array(classes).fill(0); for (const r of rows) c[r.y]++; return c; };
export function infoGain(rows: Row[], feat: number, classes: number): number {
  const yes = rows.filter((r) => r.f[feat] === 1), no = rows.filter((r) => r.f[feat] !== 1);
  const n = rows.length; if (!n) return 0;
  return entropy(countsOf(rows, classes)) - (yes.length / n) * entropy(countsOf(yes, classes)) - (no.length / n) * entropy(countsOf(no, classes));
}
export interface Tree { feat?: number; yes?: Tree; no?: Tree; leaf?: number; n: number }
export function buildTree(rows: Row[], feats: number[], classes: number, maxDepth = 9): Tree {
  const c = countsOf(rows, classes), top = c.indexOf(Math.max(...c));
  if (c.filter((x) => x > 0).length <= 1 || !feats.length || maxDepth === 0) return { leaf: top, n: rows.length };
  let best = -1, bg = 1e-9;
  for (const f of feats) { const g = infoGain(rows, f, classes); if (g > bg + 1e-12) { bg = g; best = f; } }
  if (best < 0) return { leaf: top, n: rows.length };
  const rest = feats.filter((f) => f !== best);
  return { feat: best, n: rows.length, yes: buildTree(rows.filter((r) => r.f[best] === 1), rest, classes, maxDepth - 1), no: buildTree(rows.filter((r) => r.f[best] !== 1), rest, classes, maxDepth - 1) };
}
export const predictTree = (t: Tree, f: number[]): number => (t.leaf !== undefined ? t.leaf : predictTree(f[t.feat!] === 1 ? t.yes! : t.no!, f));
export const treeQuestions = (t: Tree): number => (t.leaf !== undefined ? 0 : 1 + treeQuestions(t.yes!) + treeQuestions(t.no!));
export const treeAccuracy = (t: Tree, rows: Row[]): number => rows.filter((r) => predictTree(t, r.f) === r.y).length / rows.length;
/** the animals of the guessing game: features are legs4, flies, swims, fur, eggs, big (1 = yes) and the class is the animal */
export const ANIMAL_FEATS = ["legs4", "flies", "swims", "fur", "eggs", "big"] as const;
export const ANIMALS: { name: string; f: number[] }[] = [
  { name: "dog", f: [1, 0, 0, 1, 0, 0] }, { name: "cat", f: [1, 0, 0, 1, 0, 0] }, { name: "horse", f: [1, 0, 0, 1, 0, 1] }, { name: "cow", f: [1, 0, 0, 1, 0, 1] },
  { name: "eagle", f: [0, 1, 0, 0, 1, 0] }, { name: "duck", f: [0, 1, 1, 0, 1, 0] }, { name: "fish", f: [0, 0, 1, 0, 1, 0] }, { name: "whale", f: [0, 0, 1, 0, 0, 1] },
  { name: "frog", f: [1, 0, 1, 0, 1, 0] }, { name: "snake", f: [0, 0, 0, 0, 1, 0] }, { name: "bat", f: [0, 1, 0, 1, 0, 0] }, { name: "elephant", f: [1, 0, 0, 0, 0, 1] },
];
/** the guessing game with groups: the classes are kinds (0 = mammal, 1 = bird, 2 = fish / water, 3 = reptile / amphibian) */
export const KIND_ROWS: Row[] = [
  { f: [1, 0, 0, 1, 0, 0], y: 0 }, { f: [1, 0, 0, 1, 0, 1], y: 0 }, { f: [1, 0, 0, 0, 0, 1], y: 0 }, { f: [0, 1, 0, 1, 0, 0], y: 0 }, { f: [0, 0, 1, 0, 0, 1], y: 0 },
  { f: [0, 1, 0, 0, 1, 0], y: 1 }, { f: [0, 1, 1, 0, 1, 0], y: 1 }, { f: [0, 1, 0, 0, 1, 1], y: 1 },
  { f: [0, 0, 1, 0, 1, 0], y: 2 }, { f: [0, 0, 1, 0, 1, 1], y: 2 },
  { f: [1, 0, 1, 0, 1, 0], y: 3 }, { f: [0, 0, 0, 0, 1, 0], y: 3 }, { f: [1, 0, 0, 0, 1, 0], y: 3 },
];
/** noisy data for overfitting: two features x, y in 0..9 turned into the 0/1 features "x > t" for the thresholds 1..8 and the same for y */
export function noisyRows(seed: number, n: number, noise: number): Row[] {
  const r = rng(seed), out: Row[] = [];
  for (let i = 0; i < n; i++) {
    const x = rint(r, 0, 9), y = rint(r, 0, 9);
    let c = x + y > 9 ? 1 : 0; if (r() < noise) c = 1 - c;
    out.push({ f: [...[1, 2, 3, 4, 5, 6, 7, 8].map((t) => (x > t ? 1 : 0)), ...[1, 2, 3, 4, 5, 6, 7, 8].map((t) => (y > t ? 1 : 0))], y: c });
  }
  return out;
}

// ---------- the inverted index ----------
export function buildIndex(docs: string[][]): Map<string, number[]> {
  const m = new Map<string, number[]>();
  docs.forEach((d, i) => { for (const w of new Set(d)) { if (!m.has(w)) m.set(w, []); m.get(w)!.push(i); } });
  return m;
}
/** the documents that hold ALL the words of the query */
export function searchAll(index: Map<string, number[]>, words: string[]): number[] {
  if (!words.length) return [];
  let res = index.get(words[0]) ?? [];
  for (const w of words.slice(1)) { const s = new Set(index.get(w) ?? []); res = res.filter((d) => s.has(d)); }
  return res.slice().sort((a, b) => a - b);
}

// ---------- bias ----------
export interface Person { group: number; district: number; score: number; yes: number }
/** a made-up history of decisions: the people of group 1 were accepted only with a higher score; the district is nearly the same as the group */
export function biasedHistory(seed: number, n = 400): Person[] {
  const r = rng(seed), out: Person[] = [];
  for (let i = 0; i < n; i++) {
    const group = r() < 0.5 ? 0 : 1, district = r() < 0.9 ? group : 1 - group, score = rint(r, 0, 10);
    out.push({ group, district, score, yes: score >= (group === 0 ? 5 : 8) ? 1 : 0 });
  }
  return out;
}
export type BiasFeat = "score" | "group" | "district";
/** a model that remembers the most common decision for each combination of the chosen features */
export function trainBias(data: Person[], feats: BiasFeat[]): (p: Person) => number {
  const key = (p: Person) => feats.map((f) => (f === "score" ? p.score : p[f])).join("|");
  const m = new Map<string, [number, number]>();
  for (const p of data) { const c = m.get(key(p)) ?? [0, 0]; c[p.yes]++; m.set(key(p), c); }
  const all = data.filter((p) => p.yes).length / data.length;
  return (p) => { const c = m.get(key(p)); return c ? (c[1] / (c[0] + c[1]) >= 0.5 ? 1 : 0) : all >= 0.5 ? 1 : 0; };
}
export const biasAccuracy = (model: (p: Person) => number, data: Person[]): number => data.filter((p) => model(p) === p.yes).length / data.length;
/** the largest difference between the two groups, over all scores, in the decision for people of the SAME score (the district of a person is that of the group nine times out of ten): 0 = equal treatment */
export function biasGap(model: (p: Person) => number): number {
  let worst = 0;
  for (let s = 0; s <= 10; s++) {
    const acc = (g: number) => 0.9 * model({ group: g, district: g, score: s, yes: 0 }) + 0.1 * model({ group: g, district: 1 - g, score: s, yes: 0 });
    worst = Math.max(worst, Math.abs(acc(0) - acc(1)));
  }
  return worst;
}

// ---------- a tiny digit recogniser (8 x 8) ----------
export const DIGITS: string[][] = [
  ["00111100", "01100110", "11000011", "11000011", "11000011", "11000011", "01100110", "00111100"],
  ["00011000", "00111000", "00011000", "00011000", "00011000", "00011000", "00011000", "01111110"],
  ["00111100", "01100110", "00000110", "00001100", "00011000", "00110000", "01100000", "01111110"],
  ["00111100", "01100110", "00000110", "00011100", "00000110", "00000110", "01100110", "00111100"],
  ["00001100", "00011100", "00101100", "01001100", "11111110", "00001100", "00001100", "00001100"],
  ["01111110", "01100000", "01111100", "00000110", "00000110", "00000110", "01100110", "00111100"],
  ["00111100", "01100000", "11000000", "11111100", "11000110", "11000110", "01100110", "00111100"],
  ["01111110", "00000110", "00001100", "00011000", "00110000", "00110000", "00110000", "00110000"],
  ["00111100", "01100110", "01100110", "00111100", "01100110", "01100110", "01100110", "00111100"],
  ["00111100", "01100110", "01100110", "00111110", "00000110", "00000110", "00001100", "00111000"],
];
export const digitGrid = (d: number): number[] => DIGITS[d].join("").split("").map(Number);
/** a hand-drawn digit with `flips` random pixels turned over and, sometimes, moved by one pixel */
export function noisyDigit(d: number, seed: number, flips: number, shift = true): number[] {
  const r = rng(seed * 7919 + d), g = digitGrid(d);
  let o = g.slice();
  if (shift && r() < 0.5) { const dx = rint(r, -1, 1), dy = rint(r, -1, 1); o = o.map((_, i) => { const x = (i % 8) - dx, y = ((i / 8) | 0) - dy; return x >= 0 && x < 8 && y >= 0 && y < 8 ? g[y * 8 + x] : 0; }); }
  for (let k = 0; k < flips; k++) { const i = rint(r, 0, 63); o[i] = 1 - o[i]; }
  return o;
}
export interface DigitModel { samples: { g: number[]; d: number }[] }
/** "training": the bundled samples are made by code (seeded, with a few turned pixels and shifts); the model remembers them (nearest neighbours) */
export function trainDigits(seed = 11, per = 30, flips = 1): DigitModel {
  const samples: { g: number[]; d: number }[] = [];
  for (let d = 0; d < 10; d++) for (let i = 0; i < per; i++) samples.push({ g: noisyDigit(d, seed * 1000 + i, flips), d });
  return { samples };
}
/** the five nearest remembered pictures vote; the confidence is the share of the vote of the winner */
export function recogniseDigit(m: DigitModel, g: number[], k = 5): { digit: number; confidence: number; scores: number[] } {
  const near = m.samples.map((x) => ({ d: x.d, e: x.g.reduce((s, v, i) => s + (v - g[i]) ** 2, 0) })).sort((a, b) => a.e - b.e || a.d - b.d).slice(0, k);
  const w = Array(10).fill(0);
  for (const n of near) w[n.d] += Math.exp(-n.e / 4);
  const sum = w.reduce((a, b) => a + b, 0) || 1, scores = w.map((x) => x / sum);
  const digit = scores.indexOf(Math.max(...scores));
  return { digit, confidence: scores[digit], scores };
}

// ---------- pictures ----------
export const PICS: Record<string, string[]> = {
  heart: ["00000000", "01100110", "11111111", "11111111", "11111111", "01111110", "00111100", "00011000"],
  smile: ["00111100", "01000010", "10100101", "10000001", "10100101", "10011001", "01000010", "00111100"],
  house: ["00011000", "00111100", "01111110", "11111111", "11111111", "11100111", "11100111", "11100111"],
  arrow: ["00011000", "00111100", "01111110", "11111111", "00011000", "00011000", "00011000", "00011000"],
  tree: ["00011000", "00111100", "01111110", "00111100", "01111110", "11111111", "00011000", "00011000"],
  cup: ["00000000", "11111110", "11111111", "11111101", "11111101", "11111110", "01111100", "00000000"],
};
export const rowNumbers = (pic: string[]): number[] => pic.map((r) => fromBin(r));
export const picFromNumbers = (nums: number[], w = 8): string[] => nums.map((n) => toBin(n, w));
export const imageBytes = (w: number, h: number, bitsPerPixel: number): number => (w * h * bitsPerPixel) / 8;
export const rgbHex = (r: number, g: number, b: number): string => "#" + [r, g, b].map((v) => toHex(v)).join("");
export const colorDist = (a: number[], b: number[]): number => Math.max(...a.map((v, i) => Math.abs(v - b[i])));

// ---------- sound ----------
/** the sine wave of `freq` Hz sampled `rate` times a second for `dur` seconds */
export const sampleWave = (freq: number, rate: number, dur: number): number[] => Array.from({ length: Math.floor(rate * dur) + 1 }, (_, i) => Math.sin((2 * Math.PI * freq * i) / rate));
/** how far the dots joined by straight lines are from the real wave (0 = perfect) */
export function waveError(freq: number, rate: number, dur = 4 / freq): number {
  const s = sampleWave(freq, rate, dur), N = 400;
  let e = 0;
  for (let i = 0; i < N; i++) {
    const t = (i / (N - 1)) * dur, x = t * rate, k = Math.min(Math.floor(x), s.length - 2), f = x - k;
    const rec = s[k] * (1 - f) + s[k + 1] * f;
    e += (rec - Math.sin(2 * Math.PI * freq * t)) ** 2;
  }
  return Math.sqrt(e / N);
}
/** the frequency that is heard when `freq` is sampled too slowly (aliasing) */
export function aliasFreq(freq: number, rate: number): number { const f = freq % rate; return Math.min(f, rate - f); }
export const nyquistOk = (freq: number, rate: number): boolean => rate > 2 * freq;

// ---------- questions made by code (the quiz kind) ----------
export type Fig = { t: "lamps"; bits: string } | { t: "ascii" } | { t: "code"; text: string } | { t: "bars"; labels: string[]; values: number[] } | { t: "swatch"; rgb: number[] } | { t: "bytes"; hex: string[] } | { t: "grid"; rows: string[] } | { t: "list"; items: (string | number)[] };
export interface Q { args: (string | number)[]; answer: string | string[]; choices?: string[]; fig?: Fig }
type Spec = Record<string, unknown> & { gen: string };
const num = (s: Spec, k: string, d: number): number => (typeof s[k] === "number" ? (s[k] as number) : d);
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const WORDS = ["CAT", "DOG", "SUN", "MAP", "BOX", "ICE", "CODE", "DATA", "BYTE", "BIT", "WEB", "LOOP", "STAR", "MOON", "TREE", "FISH"];
const NAMES = ["小明", "小红", "小华", "小丽", "小强", "小芳"];
const CHARS = ["你", "好", "中", "文", "学", "编", "码", "爱", "天", "水", "火", "山", "人", "大", "小"];
const uniq = (xs: string[]) => [...new Set(xs)];
/** three wrong choices around the right number */
function numChoices(ans: number, r: () => number, spread = 4): string[] {
  const s = new Set<number>([ans]);
  let guard = 0;
  while (s.size < 4 && guard++ < 200) { const v = ans + rint(r, -spread, spread) * (r() < 0.5 ? 1 : 2); if (v >= 0 && v !== ans) s.add(v); }
  while (s.size < 4) s.add(ans + s.size + 10);
  return shuffle([...s].map(String), r);
}
export function makeQuestion(spec: Spec, seed: number): Q {
  const r = rng(seed);
  switch (spec.gen) {
    case "binRead": { const bits = num(spec, "bits", 4); const n = rint(r, 1, 2 ** bits - 1); return { args: [], answer: String(n), fig: { t: "lamps", bits: toBin(n, bits) } }; }
    case "binWrite": { const bits = num(spec, "bits", 4); const n = rint(r, 1, 2 ** bits - 1); return { args: [n], answer: toBin(n, bits) }; }
    case "binAdd": { const bits = num(spec, "bits", 4); const a = rint(r, 1, 2 ** bits - 2), b = rint(r, 1, 2 ** bits - 1 - a); return { args: [toBin(a, bits), toBin(b, bits)], answer: addBinary(toBin(a, bits), toBin(b, bits)).sum.replace(/^0+(?=.)/, "").padStart(bits, "0") }; }
    case "binShift": { const n = rint(r, 1, 30); return { args: [toBin(n), n * 2], answer: toBin(n * 2) }; }   // x2 appends a 0
    case "capacity": { const bits = rint(r, 2, 10); const kind = num(spec, "kind", 0); return kind === 0 ? { args: [bits], answer: String(2 ** bits), choices: numChoices(2 ** bits, r, 3) } : { args: [bits], answer: String(2 ** bits - 1) }; }
    case "bitsFor": { const n = pick([5, 9, 17, 30, 60, 100, 200, 255, 256, 1000], r); const need = Math.max(1, Math.ceil(Math.log2(n + 1))); return { args: [n], answer: String(need) }; }
    case "hexRead": { const n = rint(r, 16, 255); return { args: [toHex(n)], answer: String(n) }; }
    case "hexWrite": { const n = rint(r, 16, 255); return { args: [n], answer: toHex(n) }; }
    case "hexBin": { const n = rint(r, 1, 15); return { args: [toHex(n, 1)], answer: toBin(n, 4) }; }
    case "asciiCode": { const c = LETTERS[rint(r, 0, 25)]; return { args: [c], answer: String(asciiCode(c)), fig: { t: "ascii" } }; }
    case "asciiChar": { const n = rint(r, 65, 90); return { args: [n], answer: String.fromCharCode(n), fig: { t: "ascii" } }; }
    case "asciiCase": { const c = LETTERS[rint(r, 0, 25)]; return { args: [c], answer: String(asciiCode(c) + 32) }; }
    case "encodeWord": { const w = pick(WORDS.filter((x) => x.length <= num(spec, "max", 4)), r); return { args: [w], answer: [...w].map((c) => String(asciiCode(c))), fig: { t: "ascii" } }; }
    case "decodeWord": { const w = pick(WORDS.filter((x) => x.length <= 4), r); return { args: [[...w].map((c) => asciiCode(c)).join(" ")], answer: w, fig: { t: "ascii" } }; }
    case "utf8Len": { const c = pick(CHARS.concat(["A", "z", "7"]), r); return { args: [c], answer: String(utf8Length(c)), choices: ["1", "2", "3", "4"] }; }
    case "utf8Hex": { const c = pick(CHARS, r); return { args: [c], answer: utf8Hex(c) }; }
    case "utf8First": { const c = pick(CHARS, r); return { args: [c, utf8Hex(c).join(" ")], answer: utf8Hex(c)[0] }; }
    case "imgSize": { const w = pick([8, 16, 32, 64], r), h = pick([8, 16, 32, 64], r), bpp = pick([1, 8, 24], r); return { args: [w, h, bpp], answer: String(imageBytes(w, h, bpp)) }; }
    case "colorName": { const t: [number[], string][] = [[[255, 0, 0], "red"], [[0, 255, 0], "green"], [[0, 0, 255], "blue"], [[255, 255, 0], "yellow"], [[0, 0, 0], "black"], [[255, 255, 255], "white"], [[0, 255, 255], "cyan"], [[255, 0, 255], "magenta"]]; const [rgb, name] = pick(t, r); return { args: [rgb.join(", ")], answer: name, choices: shuffle(uniq([name, ...shuffle(t.map((x) => x[1]).filter((x) => x !== name), r).slice(0, 3)]), r) }; }
    case "rleEnc": { const k = rint(r, 3, 5), letters = LETTERS.slice(0, 3); let s = "", prev = ""; for (let i = 0; i < k; i++) { let c = pick([...letters], r); if (c === prev) c = letters[(letters.indexOf(c) + 1) % 3]; s += c.repeat(rint(r, 1, 5)); prev = c; } return { args: [s], answer: rleEncode(s) }; }
    case "rleDec": { const k = rint(r, 2, 4), letters = LETTERS.slice(0, 3); let enc = "", prev = ""; for (let i = 0; i < k; i++) { let c = pick([...letters], r); if (c === prev) c = letters[(letters.indexOf(c) + 1) % 3]; enc += `${rint(r, 1, 6)}${c}`; prev = c; } return { args: [enc], answer: rleDecode(enc) }; }
    case "rleSize": {
      for (let tries = 0; tries < 50; tries++) {
        const runs = rint(r, 2, 4), longRuns = r() < 0.5, letters = LETTERS.slice(0, 4); let s = "", prev = "";
        for (let i = 0; i < runs; i++) { let c = pick([...letters], r); if (c === prev) c = letters[(letters.indexOf(c) + 1) % 4]; s += c.repeat(longRuns ? rint(r, 3, 7) : rint(r, 1, 2)); prev = c; }
        const enc = rleEncode(s);
        if (enc.length !== s.length) return { args: [s, enc], answer: enc.length < s.length ? "shorter" : "longer", choices: ["shorter", "longer"] };
      }
      return { args: ["AAAAAA", "6A"], answer: "shorter", choices: ["shorter", "longer"] };
    }
    case "caesarDec": { const k = rint(r, 1, 25), w = pick(WORDS, r); return { args: [caesar(w, k), k], answer: w }; }
    case "caesarBreak": { const k = rint(r, 1, 25), w = pick(WORDS, r); return { args: [caesar(w, k)], answer: w }; }
    case "caesarKey": { const k = rint(r, 1, 25), w = pick(WORDS, r); return { args: [w, caesar(w, k)], answer: String(k) }; }
    case "caesarEnc": { const k = rint(r, 1, 6), w = pick(WORDS.filter((x) => x.length <= 4), r); return { args: [w, k], answer: caesar(w, k) }; }
    case "xor": { const a = rint(r, 0, 15), b = rint(r, 0, 15); return { args: [toBin(a, 4), toBin(b, 4)], answer: xorBits(toBin(a, 4), toBin(b, 4)) }; }
    case "xorBack": { const a = rint(r, 0, 15), k = rint(r, 1, 15); return { args: [toBin(a ^ k, 4), toBin(k, 4)], answer: toBin(a, 4) }; }
    case "parity": { const bits = Array.from({ length: 7 }, () => rint(r, 0, 1)).join(""); return { args: [bits], answer: parityBit(bits, true), choices: ["0", "1"] }; }
    case "parityCheck": { const bits = Array.from({ length: 7 }, () => rint(r, 0, 1)).join(""); const full = bits + parityBit(bits, true); const bad = r() < 0.5; const send = bad ? full.slice(0, 3) + (full[3] === "1" ? "0" : "1") + full.slice(4) : full; return { args: [send], answer: bad ? "error" : "ok", choices: ["ok", "error"] }; }
    case "isbn": { let d = ""; for (let i = 0; i < 12; i++) d += rint(r, 0, 9); return { args: [d], answer: String(isbn13Check(d)) }; }
    case "idcard": { let d = ""; for (let i = 0; i < 17; i++) d += rint(r, 0, 9); return { args: [d], answer: idCheck(d) }; }
    case "mean": { const n = rint(r, 4, 6), a = Array.from({ length: n }, () => rint(r, 2, 9)); const s = a.reduce((x, y) => x + y, 0); const fix = (n - (s % n)) % n; a[0] += fix; return { args: [], answer: fmtNum(mean(a)), fig: { t: "list", items: a } }; }
    case "median": { const n = pick([5, 7], r), a = Array.from({ length: n }, () => rint(r, 1, 20)); return { args: [], answer: fmtNum(median(a)), fig: { t: "list", items: a } }; }
    case "mode": { const a = Array.from({ length: 8 }, () => rint(r, 1, 6)); const m = modes(a); if (m.length > 1) { a.push(m[0]); } return { args: [], answer: String(modes(a)[0]), fig: { t: "list", items: a } }; }
    case "barRead": { const labels = shuffle(NAMES, r).slice(0, 4), values = labels.map(() => rint(r, 2, 9)); const i = rint(r, 0, 3); return { args: [labels[i]], answer: String(values[i]), fig: { t: "bars", labels, values } }; }
    case "barMax": { const labels = shuffle(NAMES, r).slice(0, 4); let values = labels.map(() => rint(r, 2, 9)); while (new Set(values).size < 4) values = labels.map(() => rint(r, 2, 9)); return { args: [], answer: labels[values.indexOf(Math.max(...values))], choices: labels, fig: { t: "bars", labels, values } }; }
    case "barDiff": { const labels = shuffle(NAMES, r).slice(0, 4), values = labels.map(() => rint(r, 2, 9)); return { args: [labels[0], labels[1]], answer: String(Math.abs(values[0] - values[1])), fig: { t: "bars", labels, values } }; }
    case "ip": { const bad = r() < 0.5; const o = [rint(r, 1, 254), rint(r, 0, 255), rint(r, 0, 255), rint(r, 1, 254)]; const s = bad ? `${o[0]}.${o[1]}.${rint(r, 256, 999)}.${o[3]}` : o.join("."); return { args: [s], answer: isIpv4(s) ? "yes" : "no", choices: ["yes", "no"] }; }
    case "entropy": { const len = rint(r, 4, 12), pool = pick([10, 26, 52, 62], r); return { args: [len, pool], answer: String(Math.round(len * Math.log2(pool))) }; }
    default: throw new Error("unknown generator " + spec.gen);
  }
}
/** the answer a child typed, brought to the form of the stored answer (spaces, capitals) */
export const norm = (s: string): string => s.trim().replace(/\s+/g, " ").toUpperCase();
export const sameAnswer = (given: string | string[], q: Q): boolean => {
  const a = Array.isArray(q.answer) ? q.answer : [q.answer], g = Array.isArray(given) ? given : [given];
  return a.length === g.length && a.every((x, i) => norm(x) === norm(g[i] ?? ""));
};
