/**
 * 找不同 (spot the difference): the rules as pure functions, no DOM.
 * A scene is DATA: an array of simple round cartoon pieces on a 200 x 150 canvas. Picture A draws the pieces as they are, picture B draws the same pieces with the
 * level's differences applied (a piece missing, added, another colour / size / pattern, moved). So both pictures come from one description and the place of every
 * difference is known exactly (`diffSpot`: the middle of everything that changed, and a generous hit radius).
 */
export const SW = 200, SH = 150;
export type PieceKind = "c" | "e" | "r" | "t" | "f" | "s";
export interface Piece {
  id: string; k: PieceKind; x: number; y: number; f: string;
  r?: number; rx?: number; ry?: number; w?: number; h?: number;
  s?: string; sw?: number; pat?: "dots" | "stripes"; pc?: string; m?: "smile" | "o";
}
export type DiffKind = "missing" | "added" | "colour" | "size" | "pattern" | "moved";
/** p + set = the piece changes; p alone = the piece is missing in picture B; add = a piece only picture B has */
export interface Diff { id: string; kind: DiffKind; p?: string; set?: Partial<Piece>; add?: Piece }
export interface Scene { id: string; pieces: Piece[]; diffs: Diff[] }
export interface Spot { x: number; y: number; r: number }

// ---------- the little constructors the scene data is written with ----------
type O = Partial<Piece>;
const C = (id: string, x: number, y: number, r: number, f: string, o: O = {}): Piece => ({ id, k: "c", x, y, r, f, ...o });
const E = (id: string, x: number, y: number, rx: number, ry: number, f: string, o: O = {}): Piece => ({ id, k: "e", x, y, rx, ry, f, ...o });
const R = (id: string, x: number, y: number, w: number, h: number, f: string, o: O = {}): Piece => ({ id, k: "r", x, y, w, h, f, ...o });
const T = (id: string, x: number, y: number, w: number, h: number, f: string, o: O = {}): Piece => ({ id, k: "t", x, y, w, h, f, ...o });
const F = (id: string, x: number, y: number, r: number, f: string, o: O = {}): Piece => ({ id, k: "f", x, y, r, f, ...o });
const S = (id: string, x: number, y: number, r: number, f: string, o: O = {}): Piece => ({ id, k: "s", x, y, r, f, ...o });
const miss = (n: string, p: string): Diff => ({ id: n, kind: "missing", p });
const chg = (n: string, kind: DiffKind, p: string, set: O): Diff => ({ id: n, kind, p, set });
const add = (n: string, piece: Piece): Diff => ({ id: n, kind: "added", add: piece });

export const SCENES: Scene[] = [
  { id: "farm", pieces: [
    R("sky", 100, 75, 200, 150, "#d0ebff"), R("ground", 100, 125, 200, 50, "#8ce99a"),
    C("sun", 170, 25, 14, "#ffd43b"), E("cloud", 65, 28, 20, 9, "#fff"),
    R("barn", 45, 82, 44, 36, "#fa5252"), T("roof", 45, 56, 52, 18, "#c92a2a"), R("door", 45, 92, 14, 20, "#fff"),
    R("trunk", 112, 92, 8, 28, "#a9713a"), C("crown", 112, 66, 20, "#40c057"),
    E("cow", 152, 108, 24, 14, "#fff", { pat: "dots", pc: "#495057" }), F("cowhead", 130, 98, 10, "#fff"),
    F("chick", 82, 113, 9, "#ffe066"), C("flower", 22, 122, 5, "#f06595"), C("flower2", 30, 136, 5, "#ffd43b"),
  ], diffs: [
    miss("farm-1", "sun"), chg("farm-2", "pattern", "cow", { pat: "stripes" }), chg("farm-3", "size", "chick", { r: 14 }),
    chg("farm-4", "colour", "door", { f: "#ffd43b" }), add("farm-5", C("apple", 118, 68, 4, "#fa5252")),
    chg("farm-6", "moved", "cloud", { x: 79 }), chg("farm-7", "colour", "flower", { f: "#4dabf7" }),
  ] },
  { id: "sea", pieces: [
    R("water", 100, 75, 200, 150, "#74c0fc"), R("sand", 100, 138, 200, 24, "#ffe8a3"),
    F("puf1", 60, 50, 12, "#ff922b"), F("fish2", 140, 40, 10, "#ffa8a8"),
    F("octo", 100, 92, 16, "#be4bdb"), C("t1", 88, 108, 5, "#be4bdb"), C("t2", 98, 111, 5, "#be4bdb"), C("t3", 108, 111, 5, "#be4bdb"),
    S("star", 40, 128, 11, "#fcc419"), R("weed", 176, 92, 6, 36, "#2f9e44"), R("weed2", 166, 110, 6, 22, "#37b24d"),
    F("crab", 150, 130, 10, "#fa5252"), C("bub0", 30, 28, 4, "#fff", { s: "#a5d8ff" }),
  ], diffs: [
    miss("sea-1", "star"), chg("sea-2", "colour", "puf1", { f: "#69db7c" }), chg("sea-3", "size", "octo", { r: 21 }),
    add("sea-4", C("bub1", 105, 28, 5, "#fff", { s: "#a5d8ff" })), chg("sea-5", "moved", "crab", { x: 164 }),
    chg("sea-6", "pattern", "fish2", { pat: "stripes", pc: "rgba(255,255,255,.8)" }), chg("sea-7", "size", "weed", { h: 22 }),
  ] },
  { id: "space", pieces: [
    R("sky", 100, 75, 200, 150, "#2b2d5e"),
    C("planet", 50, 45, 20, "#ff922b", { pat: "stripes" }), C("moon", 150, 35, 12, "#e9ecef", { pat: "dots", pc: "#ced4da" }),
    E("body", 100, 80, 11, 24, "#f8f9fa"), T("nose", 100, 52, 22, 16, "#fa5252"), C("win", 100, 76, 6, "#74c0fc"),
    T("finL", 86, 98, 12, 16, "#fa5252"), T("finR", 114, 98, 12, 16, "#fa5252"),
    F("alien", 160, 112, 14, "#69db7c"), F("astro", 45, 115, 12, "#fff", { s: "#adb5bd" }),
    S("st1", 20, 18, 5, "#ffd43b"), S("st2", 85, 20, 4, "#ffd43b"), S("st3", 128, 72, 3, "#ffd43b"),
  ], diffs: [
    miss("space-1", "moon"), chg("space-2", "pattern", "planet", { pat: "dots", pc: "#fff3bf" }), chg("space-3", "size", "alien", { r: 19 }),
    chg("space-4", "colour", "nose", { f: "#fcc419" }), add("space-5", E("flame", 100, 112, 6, 9, "#ffa94d")),
    chg("space-6", "colour", "astro", { f: "#ffa94d" }), add("space-7", S("st4", 178, 70, 6, "#ffd43b")),
  ] },
  { id: "kitchen", pieces: [
    R("wall", 100, 60, 200, 120, "#fff3bf"), R("floor", 100, 138, 200, 24, "#e8c39e"), R("counter", 100, 114, 200, 16, "#c98b4e"),
    C("clock", 50, 34, 14, "#fff", { s: "#868e96", sw: 2 }), R("hand1", 50, 29, 2, 10, "#3a2e39"), R("hand2", 55, 34, 10, 2, "#3a2e39"),
    R("window", 150, 38, 40, 34, "#a5d8ff", { s: "#fff", sw: 3 }), R("cross1", 150, 38, 3, 34, "#fff"), R("cross2", 150, 38, 40, 3, "#fff"),
    R("pot", 45, 100, 28, 20, "#868e96"), E("lid", 45, 88, 16, 4, "#adb5bd"),
    R("cake", 100, 102, 26, 18, "#f783ac"), C("cherry", 100, 88, 6, "#fa5252"),
    F("chef", 100, 58, 12, "#ffd8a8"), R("hat", 100, 44, 20, 8, "#fff"), E("hattop", 100, 37, 12, 7, "#fff", { s: "#ced4da" }),
    E("bowl", 160, 106, 16, 8, "#ffa94d"), C("a1", 152, 97, 6, "#fa5252"), C("a2", 166, 97, 6, "#ffd43b"),
  ], diffs: [
    chg("kitchen-1", "colour", "hattop", { f: "#ff8787" }), chg("kitchen-2", "colour", "window", { f: "#ffd8a8" }),
    miss("kitchen-3", "lid"), chg("kitchen-4", "colour", "clock", { f: "#ffe066" }), miss("kitchen-5", "cherry"),
    chg("kitchen-6", "colour", "bowl", { f: "#4dabf7" }), add("kitchen-7", F("mouse", 20, 130, 7, "#adb5bd")),
  ] },
  { id: "park", pieces: [
    R("sky", 100, 50, 200, 100, "#d0ebff"), R("grass", 100, 122, 200, 56, "#8ce99a"),
    R("trunk", 32, 82, 8, 30, "#a9713a"), C("crown", 32, 56, 22, "#40c057"),
    C("balloon", 172, 50, 10, "#fa5252"), R("bstr", 172, 66, 1.5, 18, "#868e96"),
    T("kite", 105, 36, 22, 26, "#fcc419"), R("kstr", 105, 62, 1.5, 24, "#868e96"),
    E("pond", 148, 120, 26, 12, "#74c0fc"), F("duck", 140, 118, 7, "#ffd43b"),
    F("kid", 82, 94, 11, "#ffd8a8"), R("kbody", 82, 114, 16, 18, "#4dabf7"),
    F("dog", 46, 126, 9, "#d9a36a"), R("bench", 118, 92, 26, 8, "#a9713a"), R("bleg", 118, 99, 22, 5, "#7c4a1e"),
  ], diffs: [
    chg("park-1", "colour", "balloon", { f: "#4dabf7" }), miss("park-2", "kite"), chg("park-3", "size", "dog", { r: 13 }),
    chg("park-4", "colour", "kbody", { f: "#f06595" }), add("park-5", C("fruit", 40, 50, 4, "#fa5252")),
    chg("park-6", "colour", "duck", { f: "#fff" }), chg("park-7", "colour", "bench", { f: "#7048e8" }),
  ] },
  { id: "class", pieces: [
    R("wall", 100, 60, 200, 120, "#ffe8cc"), R("floor", 100, 135, 200, 30, "#d9a066"),
    R("board", 100, 40, 100, 48, "#2b8a3e", { s: "#a9713a", sw: 4 }), R("ch1", 82, 32, 40, 2, "#fff"), R("ch2", 80, 42, 30, 2, "#fff"),
    C("globe", 165, 105, 14, "#4dabf7"), C("land", 160, 102, 5, "#69db7c"), R("stand", 165, 123, 4, 10, "#868e96"),
    R("desk", 60, 115, 56, 8, "#c98b4e"), F("kid", 55, 94, 11, "#ffd8a8"),
    R("b1", 110, 114, 24, 8, "#fa5252"), R("b2", 110, 106, 20, 8, "#4dabf7"),
    C("clock", 172, 30, 10, "#fff", { s: "#868e96", sw: 2 }), R("pot", 22, 124, 14, 14, "#e8590c"), C("leaf", 22, 106, 10, "#40c057"),
  ], diffs: [
    chg("class-1", "colour", "board", { f: "#1971c2" }), chg("class-2", "size", "globe", { r: 19 }), miss("class-3", "b2"),
    add("class-4", T("hat", 55, 80, 14, 12, "#fa5252")), chg("class-5", "moved", "clock", { y: 40 }),
    chg("class-6", "pattern", "leaf", { pat: "dots" }), chg("class-7", "colour", "desk", { f: "#7048e8" }),
  ] },
  { id: "snow", pieces: [
    R("sky", 100, 60, 200, 120, "#e7f5ff"), R("snow", 100, 128, 200, 44, "#fff"),
    C("sun", 30, 28, 12, "#ffd43b"),
    C("sb", 100, 112, 22, "#fff", { s: "#ced4da", sw: 2 }), C("sm", 100, 82, 16, "#fff", { s: "#ced4da", sw: 2 }), F("sh", 100, 55, 12, "#fff", { s: "#ced4da" }),
    R("hat", 100, 40, 16, 10, "#343a40"), R("brim", 100, 45, 24, 3, "#343a40"), R("scarf", 100, 70, 24, 6, "#fa5252"),
    C("bt1", 100, 80, 2, "#343a40"), C("bt2", 100, 88, 2, "#343a40"),
    T("tree1", 40, 100, 32, 48, "#2f9e44", { pat: "stripes" }), R("tr1", 40, 128, 6, 10, "#a9713a"),
    T("tree2", 160, 98, 30, 44, "#2f9e44"), R("tr2", 160, 124, 6, 10, "#a9713a"),
  ], diffs: [
    miss("snow-1", "hat"), chg("snow-2", "colour", "scarf", { f: "#4dabf7" }), chg("snow-3", "size", "tree2", { w: 22, h: 32 }),
    chg("snow-4", "colour", "sun", { f: "#ff8787" }), add("snow-5", F("bird", 150, 60, 6, "#fa5252")),
    chg("snow-6", "pattern", "tree1", { pat: "dots" }), add("snow-7", C("flake", 65, 50, 4, "#fff", { s: "#74c0fc" })),
  ] },
  { id: "party", pieces: [
    R("wall", 100, 60, 200, 120, "#ffe3ec"), R("floor", 100, 136, 200, 28, "#ffc9c9"), R("table", 100, 120, 90, 8, "#c98b4e"),
    R("cake", 100, 107, 30, 16, "#f783ac"), R("icing", 100, 98, 30, 6, "#fff"), R("candle", 100, 90, 3, 10, "#4dabf7"), C("flame", 100, 84, 2.5, "#ffd43b"),
    C("b1", 25, 55, 13, "#fa5252"), C("b2", 60, 35, 13, "#4dabf7"), C("b3", 160, 40, 13, "#ffd43b"),
    F("kid1", 45, 104, 13, "#ffd8a8"), T("hat1", 45, 84, 12, 14, "#be4bdb"),
    F("kid2", 155, 104, 13, "#ffd8a8"), T("hat2", 155, 84, 12, 14, "#40c057"),
    R("gift", 150, 130, 18, 16, "#4dabf7"), R("rib", 150, 130, 3, 16, "#fff"),
  ], diffs: [
    miss("party-1", "b3"), chg("party-2", "colour", "b1", { f: "#40c057" }), miss("party-3", "hat2"),
    chg("party-4", "colour", "gift", { f: "#fab005" }), add("party-5", S("conf", 100, 40, 7, "#ffd43b")),
    chg("party-6", "colour", "hat1", { f: "#fa5252" }), chg("party-7", "colour", "candle", { f: "#fa5252" }),
  ] },
  { id: "jungle", pieces: [
    R("sky", 100, 40, 200, 80, "#c5f6fa"), R("ground", 100, 115, 200, 70, "#51cf66"), E("cloud", 95, 22, 18, 7, "#fff"),
    R("tr1", 40, 90, 10, 60, "#a9713a"), C("crown1", 40, 45, 26, "#2f9e44"), R("tr2", 160, 95, 10, 50, "#a9713a"), C("crown2", 160, 50, 24, "#37b24d"),
    F("monkey", 100, 72, 13, "#c08457"), C("ear1", 88, 66, 5, "#c08457"), C("ear2", 112, 66, 5, "#c08457"), E("banana", 125, 80, 8, 4, "#ffd43b"),
    F("parrot", 170, 92, 8, "#fa5252"), F("tiger", 60, 118, 15, "#ff922b", { pat: "stripes", pc: "rgba(58,46,57,.6)" }), F("eleph", 150, 125, 16, "#adb5bd"),
  ], diffs: [
    chg("jungle-1", "colour", "crown1", { f: "#94d82d" }), miss("jungle-2", "cloud"), chg("jungle-3", "size", "eleph", { r: 21 }),
    chg("jungle-4", "pattern", "tiger", { pat: "dots", pc: "rgba(58,46,57,.6)" }), add("jungle-5", T("mhat", 100, 57, 12, 10, "#fa5252")),
    miss("jungle-6", "banana"), chg("jungle-7", "colour", "parrot", { f: "#4dabf7" }),
  ] },
  { id: "street", pieces: [
    R("sky", 100, 50, 200, 100, "#d0ebff"), R("road", 100, 128, 200, 44, "#868e96"), R("l1", 60, 138, 20, 3, "#fff"), R("l2", 140, 138, 20, 3, "#fff"),
    E("cloud", 150, 24, 18, 7, "#fff"),
    R("b1", 35, 68, 40, 80, "#ff8787"), R("w1", 22, 50, 8, 8, "#ffe066"), R("w2", 46, 86, 8, 8, "#ffe066"),
    R("b2", 100, 80, 34, 60, "#74c0fc"), R("w3", 100, 70, 8, 8, "#fff3bf"), R("b3", 165, 62, 44, 76, "#ffd43b"), R("w4", 165, 50, 8, 8, "#fff3bf"),
    R("car", 70, 122, 36, 12, "#fa5252"), C("wh1", 60, 130, 5, "#343a40"), C("wh2", 80, 130, 5, "#343a40"),
    R("pole", 132, 118, 4, 30, "#495057"), C("lamp", 132, 100, 5, "#51cf66"),
  ], diffs: [
    chg("street-1", "colour", "b2", { f: "#b197fc" }), chg("street-2", "colour", "car", { f: "#fab005" }), miss("street-3", "cloud"),
    add("street-4", T("roof", 35, 24, 42, 14, "#c92a2a")), chg("street-5", "colour", "w2", { f: "#4dabf7" }),
    add("street-6", F("bird", 100, 28, 6, "#adb5bd")), chg("street-7", "colour", "lamp", { f: "#fa5252" }),
  ] },
  { id: "room", pieces: [
    R("wall", 100, 60, 200, 120, "#e5dbff"), R("floor", 100, 132, 200, 36, "#ffd8a8"),
    R("bed", 50, 112, 70, 24, "#74c0fc"), E("pillow", 24, 96, 12, 7, "#fff"), R("blanket", 62, 106, 40, 16, "#f783ac", { pat: "dots" }),
    F("teddy", 120, 112, 13, "#c08457"), C("tear1", 110, 102, 5, "#c08457"), C("tear2", 130, 102, 5, "#c08457"),
    R("blk1", 158, 106, 16, 16, "#40c057"), R("blk2", 155, 126, 18, 16, "#fab005"),
    R("window", 150, 40, 36, 40, "#a5d8ff", { s: "#fff", sw: 3 }), C("moon", 150, 40, 8, "#ffe066"),
    R("poster", 60, 35, 34, 28, "#ffc9c9"), S("pstar", 60, 35, 9, "#fab005"), C("ball", 92, 134, 9, "#fa5252", { pat: "stripes" }),
  ], diffs: [
    chg("room-1", "pattern", "blanket", { pat: "stripes" }), miss("room-2", "moon"), chg("room-3", "size", "teddy", { r: 18 }),
    chg("room-4", "colour", "pstar", { f: "#4dabf7" }), chg("room-5", "colour", "blk1", { f: "#fa5252" }),
    miss("room-6", "ball"), add("room-7", S("star2", 100, 50, 7, "#ffd43b")),
  ] },
  { id: "garden", pieces: [
    R("sky", 100, 45, 200, 90, "#d0ebff"), R("grass", 100, 115, 200, 70, "#8ce99a"), E("cloud", 160, 25, 20, 8, "#fff"),
    R("st1", 40, 95, 3, 36, "#2f9e44"), C("sun1", 40, 70, 12, "#ffd43b"), C("sunc", 40, 70, 5, "#a9713a"),
    R("st2", 90, 108, 3, 28, "#2f9e44"), C("tulip", 90, 90, 9, "#f06595"),
    R("st3", 130, 92, 3, 38, "#2f9e44"), C("fl3", 130, 70, 10, "#be4bdb"), R("st4", 170, 110, 3, 30, "#2f9e44"), C("fl4", 170, 95, 9, "#ff922b"),
    C("wingL", 120, 35, 6, "#ff8787"), C("wingR", 132, 35, 6, "#ffa8a8"),
    F("lady", 70, 125, 8, "#fa5252", { pat: "dots", pc: "#343a40" }), E("snail", 150, 128, 14, 8, "#ffe066"), C("shell", 150, 122, 9, "#e8590c"),
  ], diffs: [
    chg("garden-1", "size", "sun1", { r: 17 }), miss("garden-2", "cloud"), chg("garden-3", "colour", "tulip", { f: "#4dabf7" }),
    chg("garden-4", "colour", "wingL", { f: "#4dabf7" }), miss("garden-5", "shell"),
    chg("garden-6", "pattern", "lady", { pat: "stripes", pc: "#343a40" }), add("garden-7", F("bee", 60, 40, 7, "#ffd43b")),
  ] },
];

// ---------- levels ----------
export const DIFFICULTIES = ["easy", "normal", "hard"] as const;
export const DIFF_COUNTS = [3, 5, 7];
export const LEVELS_PER_DIFFICULTY = 4;
export const LEVEL_COUNT = DIFF_COUNTS.length * LEVELS_PER_DIFFICULTY;
export const MAX_HINTS = 3;
export const MISTAKES_FOR_HINT = 3;
export interface LevelInfo { level: number; difficulty: number; scene: Scene; diffs: Diff[]; n: number }
/** level number = difficulty * 4 + k; the scene is the one with the same number; a level shows the first N differences of its scene (the most obvious first) */
export function levelInfo(level: number): LevelInfo {
  const difficulty = Math.floor(level / LEVELS_PER_DIFFICULTY), scene = SCENES[level];
  const n = DIFF_COUNTS[difficulty];
  return { level, difficulty, scene, diffs: scene.diffs.slice(0, n), n };
}
/** a level of that difficulty that was not seen yet; once all four were seen the round starts again (the one just seen is not repeated at once) */
export function pickLevel(difficulty: number, seen: number[], rng: () => number = Math.random): { k: number; seen: number[] } {
  let pool: number[] = [];
  for (let k = 0; k < LEVELS_PER_DIFFICULTY; k++) if (!seen.includes(k)) pool.push(k);
  let seenNow = seen.filter((k) => k >= 0 && k < LEVELS_PER_DIFFICULTY);
  if (!pool.length) {
    const lastK = seen[seen.length - 1];
    pool = [0, 1, 2, 3].filter((k) => k !== lastK);
    seenNow = [];
  }
  const k = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  return { k, seen: [...seenNow, k] };
}

// ---------- drawing (markup strings) ----------
const num = (v: number) => String(Math.round(v * 100) / 100);
function overlay(p: Piece, a: number, b: number): string {
  if (!p.pat) return "";
  const col = p.pc ?? "rgba(255,255,255,.7)";
  if (p.pat === "dots") {
    return [[-0.45, -0.25], [0.3, -0.45], [0.05, 0.4], [0.5, 0.15], [-0.3, 0.3]].map(([dx, dy]) => `<circle cx="${num(p.x + dx * a)}" cy="${num(p.y + dy * b)}" r="${num(Math.max(1.4, Math.min(a, b) * 0.15))}" fill="${col}"/>`).join("");
  }
  return [-0.5, 0, 0.5].map((dy) => `<line x1="${num(p.x - a * 0.6)}" y1="${num(p.y + dy * b)}" x2="${num(p.x + a * 0.6)}" y2="${num(p.y + dy * b)}" stroke="${col}" stroke-width="${num(Math.max(1.4, Math.min(a, b) * 0.14))}" stroke-linecap="round"/>`).join("");
}
export function pieceSvg(p: Piece): string {
  const st = p.s ? ` stroke="${p.s}" stroke-width="${p.sw ?? 1.5}"` : "";
  let body = "";
  switch (p.k) {
    case "c": body = `<circle cx="${num(p.x)}" cy="${num(p.y)}" r="${num(p.r!)}" fill="${p.f}"${st}/>` + overlay(p, p.r!, p.r!); break;
    case "e": body = `<ellipse cx="${num(p.x)}" cy="${num(p.y)}" rx="${num(p.rx!)}" ry="${num(p.ry!)}" fill="${p.f}"${st}/>` + overlay(p, p.rx!, p.ry!); break;
    case "r": body = `<rect x="${num(p.x - p.w! / 2)}" y="${num(p.y - p.h! / 2)}" width="${num(p.w!)}" height="${num(p.h!)}" rx="${num(Math.min(3, p.w! / 3, p.h! / 3))}" fill="${p.f}"${st}/>` + overlay(p, p.w! / 2, p.h! / 2); break;
    case "t": body = `<polygon points="${num(p.x)},${num(p.y - p.h! / 2)} ${num(p.x + p.w! / 2)},${num(p.y + p.h! / 2)} ${num(p.x - p.w! / 2)},${num(p.y + p.h! / 2)}" fill="${p.f}" stroke-linejoin="round"${st || ` stroke="${p.f}" stroke-width="2"`}/>` + overlay(p, p.w! / 3, p.h! / 3); break;
    case "s": {
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) { const rr = i % 2 ? p.r! * 0.45 : p.r!, ang = -Math.PI / 2 + (i * Math.PI) / 5; pts.push(`${num(p.x + rr * Math.cos(ang))},${num(p.y + rr * Math.sin(ang))}`); }
      body = `<polygon points="${pts.join(" ")}" fill="${p.f}" stroke-linejoin="round"${st || ` stroke="${p.f}" stroke-width="1.5"`}/>`; break;
    }
    case "f": {
      const r = p.r!, ink = "#3a2e39", lw = num(Math.max(1, r * 0.09));
      body = `<circle cx="${num(p.x)}" cy="${num(p.y)}" r="${num(r)}" fill="${p.f}"${st}/>` + overlay(p, r, r)
        + `<circle cx="${num(p.x - r * 0.36)}" cy="${num(p.y - r * 0.12)}" r="${num(r * 0.14)}" fill="${ink}"/><circle cx="${num(p.x + r * 0.36)}" cy="${num(p.y - r * 0.12)}" r="${num(r * 0.14)}" fill="${ink}"/>`
        + `<circle cx="${num(p.x - r * 0.56)}" cy="${num(p.y + r * 0.22)}" r="${num(r * 0.13)}" fill="#ff8787" opacity=".55"/><circle cx="${num(p.x + r * 0.56)}" cy="${num(p.y + r * 0.22)}" r="${num(r * 0.13)}" fill="#ff8787" opacity=".55"/>`
        + (p.m === "o" ? `<circle cx="${num(p.x)}" cy="${num(p.y + r * 0.32)}" r="${num(r * 0.12)}" fill="${ink}"/>`
          : `<path d="M${num(p.x - r * 0.25)} ${num(p.y + r * 0.22)} Q${num(p.x)} ${num(p.y + r * 0.5)} ${num(p.x + r * 0.25)} ${num(p.y + r * 0.22)}" fill="none" stroke="${ink}" stroke-width="${lw}" stroke-linecap="round"/>`);
      break;
    }
  }
  return `<g data-p="${p.id}">${body}</g>`;
}
/** the pieces of picture B (or A when no differences are applied) */
export function applyDiffs(scene: Scene, diffs: Diff[]): Piece[] {
  let list = scene.pieces.map((p) => ({ ...p }));
  for (const d of diffs) {
    if (d.add) list.push({ ...d.add });
    else if (d.p && d.set) list = list.map((p) => (p.id === d.p ? { ...p, ...d.set } : p));
    else if (d.p) list = list.filter((p) => p.id !== d.p);
  }
  return list;
}
/** the inner markup of a picture: A = no differences, B = the level's differences */
export function sceneMarkup(scene: Scene, diffs: Diff[]): string { return applyDiffs(scene, diffs).map(pieceSvg).join(""); }

// ---------- where a difference is ----------
export function pieceBox(p: Piece): { x0: number; y0: number; x1: number; y1: number } {
  const hw = p.k === "c" || p.k === "f" || p.k === "s" ? p.r! : p.k === "e" ? p.rx! : p.w! / 2;
  const hh = p.k === "c" || p.k === "f" || p.k === "s" ? p.r! : p.k === "e" ? p.ry! : p.h! / 2;
  return { x0: p.x - hw, y0: p.y - hh, x1: p.x + hw, y1: p.y + hh };
}
export const MIN_SPOT_R = 13, MAX_SPOT_R = 20;
/** the box of everything that is different (the piece before and after) */
export function diffBox(scene: Scene, d: Diff): { x0: number; y0: number; x1: number; y1: number } {
  const boxes: ReturnType<typeof pieceBox>[] = [];
  if (d.add) boxes.push(pieceBox(d.add));
  if (d.p) {
    const p = scene.pieces.find((q) => q.id === d.p);
    if (p) { boxes.push(pieceBox(p)); if (d.set) boxes.push(pieceBox({ ...p, ...d.set })); }
  }
  return { x0: Math.min(...boxes.map((b) => b.x0)), y0: Math.min(...boxes.map((b) => b.y0)), x1: Math.max(...boxes.map((b) => b.x1)), y1: Math.max(...boxes.map((b) => b.y1)) };
}
export function diffSpot(scene: Scene, d: Diff): Spot {
  const b = diffBox(scene, d);
  return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, r: Math.max(MIN_SPOT_R, Math.min(MAX_SPOT_R, Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2 + 3)) };
}

// ---------- one game ----------
export interface Game { level: number; spots: Spot[]; found: boolean[]; mistakes: number; hintsUsed: number }
export type TapResult = { kind: "hit"; i: number } | { kind: "again"; i: number } | { kind: "miss" };
export function newGame(level: number): Game {
  const info = levelInfo(level);
  return { level, spots: info.diffs.map((d) => diffSpot(info.scene, d)), found: info.diffs.map(() => false), mistakes: 0, hintsUsed: 0 };
}
/** a tap at scene coordinates (`minR`: a smallest radius in scene units, so that a small screen still has a finger-sized target): the nearest difference within its radius is found (a found one is not counted twice); anything else is a mistake */
export function tap(g: Game, x: number, y: number, minR = 0): TapResult {
  let best = -1, bd = Infinity;
  g.spots.forEach((s, i) => { const d = Math.hypot(s.x - x, s.y - y); if (d <= Math.max(s.r, minR) && d < bd) { bd = d; best = i; } });
  if (best < 0) { g.mistakes++; return { kind: "miss" }; }
  if (g.found[best]) return { kind: "again", i: best };
  g.found[best] = true;
  return { kind: "hit", i: best };
}
export const foundCount = (g: Game) => g.found.filter(Boolean).length;
export const won = (g: Game) => g.found.every(Boolean);
export const hintsLeft = (g: Game) => MAX_HINTS - g.hintsUsed;
/** the hint button lights up after three mistakes (it can always be used while hints are left; three per picture) */
export const hintLit = (g: Game) => g.mistakes >= MISTAKES_FOR_HINT && hintsLeft(g) > 0 && !won(g);
/** a difference that is not found yet (the first one in the list), or -1 when there is none or the hints are used up */
export function hint(g: Game): number {
  if (hintsLeft(g) <= 0 || won(g)) return -1;
  const i = g.found.findIndex((f) => !f);
  if (i >= 0) g.hintsUsed++;
  return i;
}
/** 1-3 stars: fewer than 2 mistakes and a quick time are 3 */
export function stars(mistakes: number, seconds: number, n: number): number {
  let s = 3;
  if (mistakes > 1) s--;
  if (mistakes > 4) s--;
  if (seconds > n * 20) s--;
  return Math.max(1, s);
}
export function moveCursor(c: { x: number; y: number }, dx: number, dy: number, step = 10): { x: number; y: number } {
  return { x: Math.max(0, Math.min(SW, c.x + dx * step)), y: Math.max(0, Math.min(SH, c.y + dy * step)) };
}
export function fmtTime(sec: number): string { const s = Math.max(0, Math.floor(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
