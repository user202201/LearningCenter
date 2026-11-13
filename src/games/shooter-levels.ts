/**
 * Space shooter: the DATA of the twelve levels (four worlds of three), written by hand with a few helpers: waves of the ten enemy kinds, formations
 * (V, circle, line, spiral), environment events (asteroid shower, black hole, comet, storm cloud, gift balloons), a calm moment here and there, a checkpoint in the
 * middle and a boss at the end (a different boss on every third level, a mother ship on the others). Positions are board coordinates (360 x 640).
 */
export type EvKind = "rock" | "flyer" | "zigzag" | "snake" | "diver" | "shield" | "splitter" | "bomber" | "mother" | "swarm" | "stealth" | "comet" | "balloon" | "boss" | "shower" | "hole" | "storm";
export interface Ev { t: number; k: EvKind; x: number; y?: number; size?: number; d?: number; wait?: number; vx?: number; seg?: number }

export const LEVEL_COUNT = 12;
export const BOSS_T = 42;
export const CP_T = 22;
export const worldOf = (level: number) => Math.floor((Math.max(1, Math.min(LEVEL_COUNT, level)) - 1) / 3);
export const bossTypeOf = (level: number) => (level % 3 === 0 ? level / 3 : 0);
export const WORLD_COUNT = 4;

const e = (t: number, k: EvKind, x: number, o: Partial<Ev> = {}): Ev => ({ t, k, x, ...o });
const rocks = (t: number, xs: number[], size: number, gap = 0.8): Ev[] => xs.map((x, i) => e(t + i * gap, "rock", x, { size }));
const line = (t: number, k: EvKind, x: number, n: number, dx: number, gap: number, o: Partial<Ev> = {}): Ev[] => Array.from({ length: n }, (_, i) => e(t + i * gap, k, x + i * dx, o));
const vee = (t: number, k: EvKind, cx: number, n: number, gap: number): Ev[] => {
  const out: Ev[] = [e(t, k, cx)];
  for (let i = 1; i <= n; i++) out.push(e(t + i * gap, k, cx - i * 34), e(t + i * gap, k, cx + i * 34));
  return out;
};
const mirror = (a: Ev[]): Ev[] => a.map((v) => ({ ...v, x: 360 - v.x, vx: v.vx === undefined ? undefined : -v.vx }));
const snake = (t: number, x: number): Ev[] => line(t, "snake", x, 6, 0, 0.2);
/** kamikaze swarms: they enter as one shape, then each dives at the ship */
const swV = (t: number, cx: number, n = 3): Ev[] => { const o: Ev[] = [e(t, "swarm", cx, { y: -20, wait: 1.5 })]; for (let i = 1; i <= n; i++) o.push(e(t, "swarm", cx - i * 26, { y: -20 - i * 22, wait: 1.5 + i * 0.12 }), e(t, "swarm", cx + i * 26, { y: -20 - i * 22, wait: 1.5 + i * 0.12 })); return o; };
const swLine = (t: number, x: number, n = 6): Ev[] => Array.from({ length: n }, (_, i) => e(t, "swarm", x + i * 36, { y: -20, wait: 1.4 + i * 0.1 }));
const swCircle = (t: number, cx: number, n = 8): Ev[] => Array.from({ length: n }, (_, i) => e(t, "swarm", cx + Math.cos((i / n) * 6.2832) * 46, { y: -70 + Math.sin((i / n) * 6.2832) * 46, wait: 1.6 + i * 0.1 }));
const swSpiral = (t: number, cx: number, n = 9): Ev[] => Array.from({ length: n }, (_, i) => e(t, "swarm", cx + Math.cos(i * 0.9) * (14 + i * 6), { y: -60 + Math.sin(i * 0.9) * (14 + i * 6), wait: 1.6 + i * 0.13 }));
const gifts = (t: number, n: number, x = 80): Ev[] => line(t, "balloon", x, n, Math.min(70, 200 / Math.max(1, n - 1)), 0.5);
const comet = (t: number, left = true): Ev => e(t, "comet", left ? 10 : 350, { vx: left ? 150 : -150 });
const shower = (t: number, d = 6): Ev => e(t, "shower", 0, { d });
const hole = (t: number, x: number, y: number, d = 9): Ev => e(t, "hole", x, { y, d });
const storm = (t: number, x: number, d = 12): Ev => e(t, "storm", x, { d });

// every list: waves, a calm moment (nothing new for a few seconds, only the gifts), the checkpoint at CP_T, a second part, the boss at BOSS_T
const L: Ev[][] = [
  // 1 nebula: flyers, rocks, zigzags
  [...rocks(1, [90, 270], 2, 1), ...line(4, "flyer", 80, 3, 100, 0.8), ...rocks(8, [180], 3), ...line(11, "zigzag", 60, 3, 60, 0.9), ...gifts(16, 3, 120), ...rocks(24, [300, 60, 200], 2, 0.9), ...vee(28, "flyer", 180, 2, 0.8), ...line(33, "zigzag", 300, 3, -60, 0.9), ...rocks(37, [120, 240], 3, 1.2)],
  // 2 nebula: snakes, a first shielded enemy, a comet
  [...snake(1, 100), ...snake(5, 260), ...rocks(9, [60, 300], 3, 1), ...line(12, "shield", 120, 2, 120, 1.2), ...gifts(17, 3, 120), comet(24), ...vee(26, "zigzag", 180, 2, 0.9), ...snake(31, 180), ...line(34, "flyer", 40, 5, 70, 0.6), ...rocks(38, [100, 260], 3, 0.8)],
  // 3 nebula: splitters and the first black hole; boss Jelly
  [...rocks(1, [180], 3), ...line(4, "splitter", 100, 2, 160, 1.5), hole(9, 180, 300, 8), ...vee(10, "flyer", 180, 2, 0.8), ...gifts(19, 4, 90), ...snake(24, 120), ...mirror(snake(27, 120)), ...line(31, "shield", 80, 3, 100, 1.1), comet(35, false), ...line(37, "splitter", 260, 2, -100, 1.2)],
  // 4 belt: asteroid shower
  [shower(1, 6), ...rocks(8, [60, 180, 300], 3, 0.8), ...line(11, "zigzag", 60, 4, 70, 0.6), ...gifts(17, 3, 120), ...line(23, "stealth", 100, 2, 160, 1.3), shower(26, 6), ...vee(33, "flyer", 180, 3, 0.7), ...line(36, "bomber", 100, 1, 0, 1)],
  // 5 belt: bombers and stealth ships
  [...line(1, "bomber", 90, 1, 0, 1), ...rocks(3, [200, 300], 3, 1), ...line(7, "stealth", 70, 3, 110, 1), ...snake(12, 280), ...gifts(17, 3, 100), ...line(24, "shield", 100, 3, 80, 0.9), comet(27), hole(29, 90, 280, 8), ...swLine(31, 70, 6), ...rocks(36, [60, 150, 240, 320], 2, 0.5), ...line(39, "bomber", 270, 1, 0, 1)],
  // 6 belt: swarms; boss Robot
  [shower(1, 5), ...swV(4), ...line(10, "bomber", 120, 1, 0, 1), ...rocks(12, [60, 300], 3, 1), ...gifts(17, 4, 90), ...swCircle(24, 180), ...line(29, "stealth", 80, 3, 100, 0.9), ...swLine(33, 60, 7), comet(36, false), ...vee(38, "shield", 180, 1, 1.5)],
  // 7 candy: splitters and swarms
  [...line(1, "splitter", 80, 3, 100, 1.1), ...swV(6), ...snake(11, 100), ...gifts(17, 3, 120), ...line(24, "splitter", 280, 3, -100, 1), ...swCircle(28, 120), ...mirror(snake(31, 100)), ...swSpiral(35, 240), ...rocks(39, [60, 180, 300], 2, 0.4)],
  // 8 candy: storm
  [storm(1, 120, 16), ...line(2, "zigzag", 60, 5, 60, 0.5), ...line(7, "shield", 90, 3, 90, 1), ...gifts(15, 3, 120), ...vee(23, "diver", 180, 3, 0.6), storm(27, 240, 14), ...swCircle(28, 180), hole(33, 180, 320, 8), ...line(33, "splitter", 100, 2, 160, 1.2), ...swSpiral(38, 120)],
  // 9 candy: boss Candy
  [...swV(1, 180, 4), ...line(6, "bomber", 100, 1, 0, 1), ...line(8, "stealth", 60, 4, 80, 0.8), ...gifts(17, 4, 90), comet(24), ...swLine(26, 60, 7), ...mirror(snake(28, 100)), storm(31, 180, 10), ...vee(33, "splitter", 180, 1, 1.4), ...swCircle(38, 180, 10)],
  // 10 station: mother ship
  [...line(1, "mother", 120, 1, 0, 1), ...line(5, "flyer", 40, 6, 56, 0.4), ...snake(9, 180), ...gifts(17, 3, 120), ...swV(24, 180, 4), ...line(28, "shield", 60, 4, 70, 0.8), hole(30, 180, 300, 8), ...line(34, "stealth", 80, 3, 100, 0.8), ...swSpiral(38, 180)],
  // 11 station: lasers of mine layers and comets
  [comet(1), ...line(2, "bomber", 90, 2, 180, 1.4), ...swCircle(7, 180), ...gifts(17, 4, 90), ...line(24, "mother", 240, 1, 0, 1), ...mirror(snake(25, 100)), comet(28, false), ...vee(30, "diver", 180, 3, 0.5), ...swLine(34, 60, 7), ...line(37, "shield", 100, 3, 80, 0.7)],
  // 12 station: the last gauntlet; boss Station core
  [shower(1, 4), ...swV(5, 180, 4), ...line(10, "mother", 80, 1, 0, 1), ...gifts(17, 3, 120), ...snake(24, 100), ...mirror(snake(24.3, 100)), storm(26, 180, 12), ...swSpiral(30, 180, 10), hole(33, 180, 300, 8), ...line(33, "stealth", 70, 3, 110, 0.8), ...swCircle(38, 180, 10)],
].map((a, i) => [...a, e(BOSS_T, "boss", 180, { size: bossTypeOf(i + 1) })].sort((p, q) => p.t - q.t));

export const scriptOf = (level: number, easy = false): Ev[] => {
  const s = L[Math.max(1, Math.min(LEVEL_COUNT, level)) - 1];
  if (!easy) return s;
  // easy: fewer enemies (every third wave member is left out); events, balloons, snakes and the boss stay
  let n = 0;
  return s.filter((v) => { if (v.k === "boss" || v.k === "balloon" || v.k === "shower" || v.k === "hole" || v.k === "storm" || v.k === "snake" || v.k === "swarm" || v.k === "comet") return true; return n++ % 3 !== 2; });
};
export const bossHp = (level: number) => (level % 3 === 0 ? 40 + 10 * level : 18 + 2 * level);
