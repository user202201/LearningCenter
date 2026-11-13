/**
 * Space shooter: the pure rules (no screen, no timer). A fixed board W x H, fixed steps, one seeded random generator in the state, so a game is a function of
 * (seed, level, inputs). `step(s, dt, input)` moves everything and returns the events of that step (the screen turns them into sounds and sparks).
 * Ten levels, every one a hand-designed script of waves (rocks, saucers, bugs, divers) that ends with a boss; destroying the boss clears the level.
 */
export const W = 360;
export const H = 640;
export const STEP = 1 / 60;
export const LEVEL_COUNT = 10;
export const MAXLIVES = 5;
export const START_LIVES = 3;
export const EASY_LIVES = 5;
export const MAXBOMBS = 3;
export const RAPID_TIME = 8;
export const MAGNET_TIME = 10;
export const SHIP_Y_MIN = 50;
export const SHIP_Y_MAX = H - 34;
export const SHIP_X_MIN = 16;
export const SHIP_X_MAX = W - 16;
export const SHIP_SPEED = 560;
export const BOMB_DMG = 14;
export const MAX_ENEMIES = 60;
export const MAX_EBULLETS = 140;
export const MAX_COINS = 80;
export const MAX_PUPS = 10;
export const MAX_BULLETS = 90;
const ROCK_R = [0, 12, 20, 30];
const ROCK_HP = [0, 1, 3, 6];
const ROCK_SCORE = [0, 10, 25, 50];

export type EKind = "rock" | "saucer" | "bug" | "diver" | "boss";
export type Pat = "straight" | "zigzag" | "sine" | "dive";
export type PKind = "double" | "triple" | "shield" | "rapid" | "bomb" | "life" | "magnet";
export const PKINDS: PKind[] = ["double", "triple", "shield", "rapid", "bomb", "life", "magnet"];
const PWEIGHT: Record<PKind, number> = { double: 18, triple: 10, shield: 16, rapid: 16, bomb: 12, life: 4, magnet: 12 };

export interface Enemy { id: number; kind: EKind; x: number; y: number; vx: number; vy: number; r: number; hp: number; maxhp: number; size: number; pat: Pat; t: number; x0: number; ph: number; cd: number; dive: number; spin: number; hurt: number; atk: number }
export interface Bullet { x: number; y: number; vx: number; vy: number }
export interface Coin { x: number; y: number; vx: number; vy: number }
export interface Pup { x: number; y: number; x0: number; kind: PKind; t: number }
export interface Ev { t: number; kind: EKind; x: number; size?: number; pat?: Pat; vy?: number }

export interface State {
  rs: number; level: number; easy: boolean; time: number;
  score: number; lives: number; bombs: number; weapon: number; rapid: number; magnet: number; shield: boolean;
  ship: { x: number; y: number }; inv: number; fireCd: number;
  bullets: Bullet[]; ebullets: Bullet[]; enemies: Enemy[]; coins: Coin[]; pups: Pup[];
  script: Ev[]; idx: number; nextId: number;
  boss: Enemy | null; bossDead: boolean; clearT: number; cleared: boolean; over: boolean;
  bombFlash: number; kills: number;
}
export type Event = { t: "shot" } | { t: "hit"; x: number; y: number } | { t: "kill"; x: number; y: number; kind: EKind; size: number } | { t: "split"; x: number; y: number }
  | { t: "pickup"; kind: PKind } | { t: "coin" } | { t: "hurt"; x: number; y: number } | { t: "shield" } | { t: "bomb" } | { t: "boss" } | { t: "bossdead"; x: number; y: number }
  | { t: "clear" } | { t: "over" } | { t: "life" } | { t: "shoot"; x: number; y: number };
export interface Input { tx: number; ty: number; bomb?: boolean }

export function rnd(s: { rs: number }): number {
  s.rs = (s.rs + 0x6d2b79f5) >>> 0;
  let t = s.rs;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- the ten scripts
const ev = (t: number, kind: EKind, x: number, o: Partial<Ev> = {}): Ev => ({ t, kind, x, ...o });
const rocks = (t: number, xs: number[], size: number, gap = 0.8): Ev[] => xs.map((x, i) => ev(t + i * gap, "rock", x, { size }));
const line = (t: number, kind: EKind, x: number, n: number, dx: number, gap: number, pat?: Pat): Ev[] => Array.from({ length: n }, (_, i) => ev(t + i * gap, kind, x + i * dx, { pat }));
const col = (t: number, kind: EKind, x: number, n: number, gap: number, pat?: Pat): Ev[] => line(t, kind, x, n, 0, gap, pat);
/** a V: the leader first, then pairs on both sides */
const vee = (t: number, kind: EKind, cx: number, n: number, gap: number, pat?: Pat): Ev[] => {
  const out: Ev[] = [ev(t, kind, cx, { pat })];
  for (let i = 1; i <= n; i++) { out.push(ev(t + i * gap, kind, cx - i * 34, { pat }), ev(t + i * gap, kind, cx + i * 34, { pat })); }
  return out;
};
const mirror = (a: Ev[]): Ev[] => a.map((e) => ({ ...e, x: W - e.x }));

const BOSS_T = 36;
const SCRIPTS: Ev[][] = [
  // 1: rocks and a few bugs
  [...rocks(1, [90, 270], 2, 1), ...rocks(5, [180], 3), ...line(8, "bug", 60, 3, 60, 0.9), ...rocks(13, [300, 60, 200], 2, 0.9), ...line(17, "bug", 300, 3, -60, 0.9), ...rocks(21, [120, 240], 3, 1.2), ...col(25, "saucer", 180, 2, 2, "straight"), ...rocks(28, [40, 320, 180], 1, 0.6), ...vee(31, "bug", 180, 2, 0.8)],
  // 2: saucers join
  [...rocks(1, [60, 300], 3, 1.2), ...col(5, "saucer", 110, 3, 1.4, "sine"), ...rocks(10, [220, 140, 300], 2, 0.8), ...line(14, "bug", 40, 4, 70, 0.7), ...rocks(19, [90, 270], 3, 1), ...vee(23, "saucer", 180, 1, 1.2, "sine"), ...rocks(27, [40, 120, 200, 280], 1, 0.5), ...line(30, "bug", 320, 4, -70, 0.7)],
  // 3: first divers
  [...rocks(1, [180], 3), ...col(4, "diver", 80, 3, 1.1), ...rocks(9, [60, 300, 180], 2, 0.9), ...vee(13, "bug", 180, 2, 0.8), ...col(18, "saucer", 260, 3, 1.3, "sine"), ...col(22, "diver", 280, 3, 1.1), ...rocks(27, [100, 200, 300], 3, 1), ...line(31, "bug", 60, 5, 60, 0.5)],
  // 4: rock fields
  [...rocks(1, [40, 120, 200, 280, 330], 2, 0.5), ...rocks(5, [90, 260], 3, 1), ...col(8, "saucer", 130, 2, 1.5, "sine"), ...col(8.5, "saucer", 230, 2, 1.5, "sine"), ...rocks(13, [60, 160, 260], 3, 0.8), ...vee(17, "bug", 180, 3, 0.7), ...col(22, "diver", 100, 4, 0.9), ...rocks(26, [320, 240, 160, 80], 2, 0.5), ...line(30, "saucer", 60, 3, 120, 0.4, "straight")],
  // 5: waves from both sides
  [...line(1, "bug", 40, 5, 60, 0.6), ...mirror(line(1.3, "bug", 40, 5, 60, 0.6)), ...rocks(6, [90, 270, 180], 3, 0.9), ...col(10, "saucer", 180, 4, 1, "sine"), ...vee(15, "diver", 180, 2, 0.6), ...rocks(19, [60, 140, 220, 300], 2, 0.5), ...line(22, "saucer", 60, 3, 120, 0.5, "straight"), ...col(26, "diver", 60, 3, 0.8), ...mirror(col(26.4, "diver", 60, 3, 0.8)), ...vee(30, "bug", 180, 4, 0.5)],
  // 6: crowded
  [...rocks(1, [60, 180, 300], 3, 0.7), ...vee(4, "saucer", 180, 2, 1, "sine"), ...line(9, "bug", 40, 6, 56, 0.5), ...rocks(13, [100, 220, 300, 40], 2, 0.4), ...col(16, "diver", 200, 4, 0.7), ...vee(20, "saucer", 120, 2, 1.1, "straight"), ...rocks(24, [60, 120, 180, 240, 300], 2, 0.4), ...mirror(line(27, "bug", 40, 5, 60, 0.5)), ...col(30, "diver", 100, 3, 0.7), ...col(30.3, "diver", 260, 3, 0.7)],
  // 7: saucer formations
  [...line(1, "saucer", 60, 4, 80, 0.5, "sine"), ...rocks(6, [180, 90, 270], 3, 0.8), ...vee(10, "bug", 180, 4, 0.5), ...col(14, "saucer", 80, 3, 0.9, "straight"), ...col(14.4, "saucer", 280, 3, 0.9, "straight"), ...rocks(19, [60, 150, 250, 320], 2, 0.4), ...vee(22, "diver", 180, 3, 0.5), ...line(26, "saucer", 320, 4, -80, 0.5, "sine"), ...rocks(29, [100, 180, 260], 3, 0.6), ...col(32, "bug", 180, 5, 0.4)],
  // 8: dive bombers and rocks together
  [...col(1, "diver", 70, 4, 0.6), ...mirror(col(1.3, "diver", 70, 4, 0.6)), ...rocks(5, [180, 100, 260], 3, 0.6), ...vee(8, "saucer", 180, 2, 1, "sine"), ...line(12, "bug", 40, 6, 56, 0.4), ...rocks(15, [60, 140, 220, 300], 2, 0.4), ...vee(18, "diver", 180, 4, 0.5), ...col(22, "saucer", 100, 3, 0.8, "straight"), ...col(22.3, "saucer", 260, 3, 0.8, "straight"), ...rocks(26, [320, 250, 180, 110, 40], 2, 0.4), ...vee(29, "bug", 180, 5, 0.4)],
  // 9: dense
  [...rocks(1, [60, 180, 300], 3, 0.5), ...vee(3, "saucer", 180, 3, 0.8, "sine"), ...line(8, "bug", 40, 7, 46, 0.4), ...mirror(line(8.2, "bug", 40, 7, 46, 0.4)), ...rocks(12, [90, 160, 230, 300], 3, 0.5), ...vee(15, "diver", 180, 4, 0.4), ...col(19, "saucer", 70, 4, 0.7, "straight"), ...col(19.3, "saucer", 290, 4, 0.7, "straight"), ...rocks(23, [40, 100, 160, 220, 280, 330], 2, 0.3), ...vee(26, "bug", 180, 5, 0.4), ...col(29, "diver", 60, 4, 0.5), ...mirror(col(29.2, "diver", 60, 4, 0.5))],
  // 10: the last gauntlet
  [...rocks(1, [60, 180, 300], 3, 0.4), ...vee(2, "saucer", 180, 3, 0.7, "sine"), ...line(6, "bug", 40, 7, 46, 0.35), ...vee(9, "diver", 180, 4, 0.4), ...rocks(12, [100, 180, 260], 3, 0.4), ...col(14, "saucer", 70, 4, 0.6, "straight"), ...col(14.3, "saucer", 290, 4, 0.6, "straight"), ...rocks(18, [40, 100, 160, 220, 280, 330], 2, 0.3), ...mirror(line(20, "bug", 40, 7, 46, 0.35)), ...vee(23, "saucer", 180, 4, 0.6, "sine"), ...col(26, "diver", 60, 4, 0.5), ...mirror(col(26.2, "diver", 60, 4, 0.5)), ...rocks(29, [60, 120, 180, 240, 300], 3, 0.4), ...vee(31, "bug", 180, 5, 0.35)],
].map((a, i) => [...a, ev(BOSS_T, "boss", 180, { size: i + 1 })].sort((p, q) => p.t - q.t));

export const scriptOf = (level: number): Ev[] => SCRIPTS[clamp(level, 1, LEVEL_COUNT) - 1];
export const bossHp = (level: number) => 50 + 25 * level;

// ---------------------------------------------------------------- creating
export interface Opts { easy?: boolean; seed?: number; lives?: number; score?: number; weapon?: number; bombs?: number }
export function newGame(level: number, o: Opts = {}): State {
  const easy = !!o.easy;
  level = clamp(Math.round(level), 1, LEVEL_COUNT);
  return {
    rs: (o.seed ?? 12345) >>> 0, level, easy, time: 0, score: o.score ?? 0, lives: o.lives ?? (easy ? EASY_LIVES : START_LIVES), bombs: o.bombs ?? 1, weapon: o.weapon ?? 1, rapid: 0, magnet: 0, shield: false,
    ship: { x: W / 2, y: H - 110 }, inv: 1.2, fireCd: 0, bullets: [], ebullets: [], enemies: [], coins: [], pups: [], script: scriptOf(level), idx: 0, nextId: 1,
    boss: null, bossDead: false, clearT: 0, cleared: false, over: false, bombFlash: 0, kills: 0,
  };
}

export const shipR = (s: State) => (s.easy ? 4.5 : 6.5);
export const bulletSpeed = (s: State) => (100 + s.level * 10) * (s.easy ? 0.72 : 1);
const fireGap = (s: State) => (s.easy ? 1.4 : 1) * (2.6 - s.level * 0.14);

export function spawnEnemy(s: State, kind: EKind, x: number, o: { size?: number; pat?: Pat; vy?: number; y?: number } = {}): Enemy | null {
  if (kind === "boss" ? !!s.boss : s.enemies.length >= MAX_ENEMIES) return null;
  const L = s.level;
  const e: Enemy = { id: s.nextId++, kind, x, y: o.y ?? 0, vx: 0, vy: 0, r: 14, hp: 1, maxhp: 1, size: 0, pat: o.pat ?? "straight", t: 0, x0: x, ph: rnd(s) * 6.28, cd: 0.6 + rnd(s) * 1.2, dive: 0, spin: (rnd(s) - 0.5) * 2, hurt: 0, atk: 0 };
  if (kind === "rock") {
    const sz = clamp(o.size ?? 2, 1, 3);
    e.size = sz; e.r = ROCK_R[sz]; e.hp = e.maxhp = ROCK_HP[sz]; e.vy = o.vy ?? [0, 90, 72, 56][sz] + L * 3; e.vx = (rnd(s) - 0.5) * 50;
  } else if (kind === "saucer") {
    e.r = 17; e.hp = e.maxhp = L >= 8 ? 5 : L >= 5 ? 4 : 3; e.pat = o.pat ?? "sine"; e.vy = o.vy ?? 52 + L * 3;
  } else if (kind === "bug") {
    e.r = 14; e.hp = e.maxhp = L >= 6 ? 3 : 2; e.pat = o.pat ?? "zigzag"; e.vy = o.vy ?? 68 + L * 3; e.vx = rnd(s) < 0.5 ? 80 : -80;
  } else if (kind === "diver") {
    e.r = 14; e.hp = e.maxhp = 2; e.pat = "dive"; e.vy = 82;
  } else {
    e.r = 46; e.hp = e.maxhp = bossHp(L); e.size = L; e.pat = "sine"; e.cd = 2; e.vy = 80; s.boss = e;
  }
  e.y = o.y ?? -e.r - 4;
  s.enemies.push(e);
  return e;
}

// ---------------------------------------------------------------- helpers of one step
function addCoins(s: State, x: number, y: number, n: number) {
  for (let i = 0; i < n && s.coins.length < MAX_COINS; i++) s.coins.push({ x: x + (rnd(s) - 0.5) * 16, y: y + (rnd(s) - 0.5) * 16, vx: (rnd(s) - 0.5) * 90, vy: -90 - rnd(s) * 60 });
}
function dropPup(s: State, x: number, y: number, force = false) {
  if (s.pups.length >= MAX_PUPS) return;
  let tot = 0; for (const k of PKINDS) tot += PWEIGHT[k];
  let r = rnd(s) * tot, kind: PKind = "double";
  for (const k of PKINDS) { r -= PWEIGHT[k]; if (r <= 0) { kind = k; break; } }
  if (!force && kind === "life" && s.lives >= MAXLIVES) kind = "shield";
  s.pups.push({ x, y, x0: x, kind, t: 0 });
}
function kill(s: State, e: Enemy, evs: Event[], byBomb: boolean) {
  const i = s.enemies.indexOf(e); if (i < 0) return;
  s.enemies.splice(i, 1);
  s.kills++;
  evs.push({ t: "kill", x: e.x, y: e.y, kind: e.kind, size: e.size });
  if (e.kind === "rock") {
    s.score += ROCK_SCORE[e.size];
    addCoins(s, e.x, e.y, e.size === 3 ? 2 : e.size === 2 ? 1 : rnd(s) < 0.4 ? 1 : 0);
    if (e.size > 1 && !byBomb) {
      evs.push({ t: "split", x: e.x, y: e.y });
      for (const d of [-1, 1]) {
        const c = spawnEnemy(s, "rock", e.x + d * e.r * 0.6, { size: e.size - 1, y: e.y });
        if (c) { c.vx = d * (35 + rnd(s) * 30); c.vy = Math.max(40, e.vy * (0.9 + rnd(s) * 0.3)); }
      }
    }
    if (rnd(s) < (e.size === 3 ? 0.12 : e.size === 2 ? 0.05 : 0.02) * (s.easy ? 1.3 : 1)) dropPup(s, e.x, e.y);
  } else if (e.kind === "boss") {
    s.score += 500 * s.level;
    addCoins(s, e.x, e.y, 14);
    dropPup(s, e.x, e.y, true);
    s.bossDead = true; s.clearT = 1.6; s.boss = null; s.ebullets.length = 0; s.inv = Math.max(s.inv, 3);
    evs.push({ t: "bossdead", x: e.x, y: e.y });
    for (const o of s.enemies.slice()) { s.enemies.splice(s.enemies.indexOf(o), 1); evs.push({ t: "kill", x: o.x, y: o.y, kind: o.kind, size: o.size }); addCoins(s, o.x, o.y, 1); s.score += 20; }
  } else {
    s.score += e.kind === "saucer" ? 100 : e.kind === "diver" ? 80 : 60;
    addCoins(s, e.x, e.y, e.kind === "saucer" ? 2 : 1);
    if (rnd(s) < (e.kind === "saucer" ? 0.22 : 0.16) * (s.easy ? 1.3 : 1)) dropPup(s, e.x, e.y);
  }
}
function damage(s: State, e: Enemy, dmg: number, evs: Event[], byBomb = false) {
  e.hp -= dmg; e.hurt = 0.12;
  if (e.hp <= 0) kill(s, e, evs, byBomb); else evs.push({ t: "hit", x: e.x, y: e.y });
}
function hurt(s: State, evs: Event[]) {
  if (s.inv > 0 || s.over || s.bossDead) return;
  if (s.shield) { s.shield = false; s.inv = 1; evs.push({ t: "shield" }); return; }
  s.lives = Math.max(0, s.lives - 1); s.weapon = Math.max(1, s.weapon - 1); s.bombs = Math.max(s.bombs, 1); s.inv = 2.2;
  evs.push({ t: "hurt", x: s.ship.x, y: s.ship.y });
  s.ebullets = s.ebullets.filter((b) => Math.hypot(b.x - s.ship.x, b.y - s.ship.y) > 110);
  if (s.lives <= 0) { s.over = true; evs.push({ t: "over" }); }
}
function eShoot(s: State, e: Enemy, evs: Event[], ang: number, speed: number) {
  if (s.ebullets.length >= MAX_EBULLETS) return;
  s.ebullets.push({ x: e.x, y: e.y + e.r * 0.5, vx: Math.sin(ang) * speed, vy: Math.cos(ang) * speed });
  evs.push({ t: "shoot", x: e.x, y: e.y });
}
function bossAttack(s: State, e: Enemy, evs: Event[]) {
  const bs = bulletSpeed(s), k = e.atk++ % 3, L = s.level;
  if (k === 0) { const n = 8 + L - (s.easy ? 3 : 0), off = rnd(s) * 6.28; for (let i = 0; i < n; i++) eShoot(s, e, evs, off + (i * 6.2832) / n, bs * 0.85); }
  else if (k === 1) { const aim = Math.atan2(s.ship.x - e.x, s.ship.y - e.y), n = L >= 6 ? 5 : 3; for (let i = 0; i < n; i++) eShoot(s, e, evs, aim + (i - (n - 1) / 2) * 0.22, bs * 1.05); }
  else { const n = 5 - (s.easy ? 1 : 0); for (let i = 0; i < n; i++) { const b = { x: 40 + ((W - 80) * (i + (rnd(s) < 0.5 ? 0 : 0.5))) / n, y: e.y + 20, vx: 0, vy: bs * 0.8 }; if (s.ebullets.length < MAX_EBULLETS) s.ebullets.push(b); } evs.push({ t: "shoot", x: e.x, y: e.y }); }
}

export function bomb(s: State, evs: Event[]): boolean {
  if (s.bombs <= 0 || s.over || s.cleared || s.bossDead) return false;
  s.bombs--; s.bombFlash = 1; s.inv = Math.max(s.inv, 0.7); s.ebullets.length = 0;
  evs.push({ t: "bomb" });
  for (const e of s.enemies.slice()) if (e.y > -e.r) damage(s, e, BOMB_DMG, evs, true);
  return true;
}

export function step(s: State, dt: number, inp: Input): Event[] {
  const evs: Event[] = [];
  if (s.over || s.cleared) return evs;
  s.time += dt;
  if (s.bombFlash > 0) s.bombFlash = Math.max(0, s.bombFlash - dt / 0.5);
  // the ship: smooth, speed-limited
  const tx = clamp(inp.tx, SHIP_X_MIN, SHIP_X_MAX), ty = clamp(inp.ty, SHIP_Y_MIN, SHIP_Y_MAX);
  const dx = tx - s.ship.x, dy = ty - s.ship.y, d = Math.hypot(dx, dy);
  if (d > 1e-6) { const m = Math.min(d, Math.min(d * 14, SHIP_SPEED) * dt); s.ship.x += (dx / d) * m; s.ship.y += (dy / d) * m; }
  s.ship.x = clamp(s.ship.x, SHIP_X_MIN, SHIP_X_MAX); s.ship.y = clamp(s.ship.y, SHIP_Y_MIN, SHIP_Y_MAX);
  if (inp.bomb) bomb(s, evs);
  if (s.inv > 0) s.inv = Math.max(0, s.inv - dt);
  if (s.rapid > 0) s.rapid = Math.max(0, s.rapid - dt);
  if (s.magnet > 0) s.magnet = Math.max(0, s.magnet - dt);
  // automatic fire
  s.fireCd -= dt;
  if (s.fireCd <= 0 && !s.bossDead) {
    const gap = [0.21, 0.19, 0.17][s.weapon - 1] * (s.rapid > 0 ? 0.55 : 1) * (s.easy ? 0.92 : 1);
    s.fireCd += gap; if (s.fireCd < 0) s.fireCd = 0;
    const { x, y } = s.ship, v = 640;
    if (s.bullets.length < MAX_BULLETS - 3) {
      if (s.weapon === 1) s.bullets.push({ x, y: y - 18, vx: 0, vy: -v });
      else if (s.weapon === 2) s.bullets.push({ x: x - 7, y: y - 16, vx: 0, vy: -v }, { x: x + 7, y: y - 16, vx: 0, vy: -v });
      else s.bullets.push({ x, y: y - 20, vx: 0, vy: -v }, { x: x - 9, y: y - 14, vx: -Math.sin(0.14) * v, vy: -Math.cos(0.14) * v }, { x: x + 9, y: y - 14, vx: Math.sin(0.14) * v, vy: -Math.cos(0.14) * v });
      evs.push({ t: "shot" });
    }
  }
  // the script
  while (s.idx < s.script.length && s.script[s.idx].t <= s.time) {
    const w = s.script[s.idx++];
    if (w.kind === "boss") { if (spawnEnemy(s, "boss", w.x)) evs.push({ t: "boss" }); }
    else spawnEnemy(s, w.kind, w.x, { size: w.size, pat: w.pat, vy: w.vy });
  }
  // enemies
  const bs = bulletSpeed(s);
  for (const e of s.enemies.slice()) {
    e.t += dt; if (e.hurt > 0) e.hurt = Math.max(0, e.hurt - dt);
    if (e.kind === "rock") { e.x += e.vx * dt; e.y += e.vy * dt; }
    else if (e.kind === "boss") {
      if (e.y < 100) e.y += 80 * dt;
      else {
        const bt = e.t, wide = 100 + s.level * 6;
        e.x = W / 2 + Math.sin(bt * 0.7) * wide; e.y = 100 + Math.sin(bt * 1.1) * 14;
        e.cd -= dt;
        if (e.cd <= 0 && !s.bossDead) { bossAttack(s, e, evs); e.cd = (1.8 - s.level * 0.07) * (s.easy ? 1.3 : 1) * (e.hp < e.maxhp / 2 ? 0.75 : 1); }
      }
    } else {
      if (e.pat === "sine") { e.y += e.vy * dt; e.x = clamp(e.x0 + Math.sin(e.t * 1.8 + e.ph) * 70, 20, W - 20); }
      else if (e.pat === "zigzag") { e.y += e.vy * dt; e.x += e.vx * dt; if (e.x < 20 || e.x > W - 20) { e.vx = -e.vx; e.x = clamp(e.x, 20, W - 20); } if (Math.floor(e.t / 0.9) !== Math.floor((e.t - dt) / 0.9)) e.vx = -e.vx; }
      else if (e.pat === "dive") {
        if (e.dive === 0) { e.y += 82 * dt; if (e.y >= 90 || e.t > 1.4) { e.dive = 1; const a = Math.atan2(s.ship.x - e.x, s.ship.y - e.y), sp = (230 + s.level * 8) * (s.easy ? 0.8 : 1); e.vx = Math.sin(a) * sp; e.vy = Math.cos(a) * sp; } }
        else { e.x += e.vx * dt; e.y += e.vy * dt; }
      } else { e.y += e.vy * dt; }
      if ((e.kind === "saucer" || e.kind === "bug") && e.y > 20 && e.y < H * 0.68) {
        e.cd -= dt;
        if (e.cd <= 0) {
          const ang = e.kind === "saucer" ? Math.atan2(s.ship.x - e.x, Math.max(30, s.ship.y - e.y)) : 0;
          eShoot(s, e, evs, ang, e.kind === "saucer" ? bs : bs * 0.9);
          e.cd = fireGap(s) * (e.kind === "bug" ? 1.5 : 1) * (0.8 + rnd(s) * 0.4);
        }
      }
    }
    if (e.kind !== "boss" && (e.y > H + e.r + 20 || e.x < -80 || e.x > W + 80 || e.y < -260)) { const i = s.enemies.indexOf(e); if (i >= 0) s.enemies.splice(i, 1); }
  }
  // the player's bullets
  for (const b of s.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
  for (const b of s.bullets) {
    for (const e of s.enemies) {
      if (e.y < -e.r * 0.3) continue;
      if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + 4) { b.y = -999; damage(s, e, 1, evs); break; }
    }
  }
  s.bullets = s.bullets.filter((b) => b.y > -12 && b.x > -12 && b.x < W + 12 && b.y < H + 12);
  // enemy bullets and bodies against the ship
  const sr = shipR(s);
  for (const b of s.ebullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
  for (const b of s.ebullets) if (b.y < H + 20 && Math.hypot(b.x - s.ship.x, b.y - s.ship.y) < sr + 4.5) { if (s.inv <= 0 && !s.over) { b.y = H + 99; hurt(s, evs); } }
  s.ebullets = s.ebullets.filter((b) => b.y > -20 && b.y < H + 20 && b.x > -20 && b.x < W + 20);
  if (s.inv <= 0 && !s.over) {
    for (const e of s.enemies.slice()) {
      if (e.y < -e.r * 0.3) continue;
      if (Math.hypot(e.x - s.ship.x, e.y - s.ship.y) < e.r * 0.8 + sr) { hurt(s, evs); if (e.kind !== "boss") damage(s, e, 4, evs); break; }
    }
  }
  // coins and capsules
  for (const c of s.coins) {
    if (s.magnet > 0) { const d = Math.hypot(s.ship.x - c.x, s.ship.y - c.y) || 1; c.x += ((s.ship.x - c.x) / d) * 420 * dt; c.y += ((s.ship.y - c.y) / d) * 420 * dt; }
    else { c.vy = Math.min(120, c.vy + 300 * dt); c.vx *= 0.985; c.x += c.vx * dt; c.y += c.vy * dt; }
  }
  const keep: Coin[] = [];
  for (const c of s.coins) { if (Math.hypot(c.x - s.ship.x, c.y - s.ship.y) < 24) { s.score += 10; evs.push({ t: "coin" }); } else if (c.y < H + 12 && c.x > -20 && c.x < W + 20) keep.push(c); }
  s.coins = keep;
  const keepP: Pup[] = [];
  for (const p of s.pups) {
    p.t += dt; p.y += 75 * dt; p.x = clamp(p.x0 + Math.sin(p.t * 2) * 14, 16, W - 16);
    if (Math.hypot(p.x - s.ship.x, p.y - s.ship.y) < 26) {
      s.score += 20; evs.push({ t: "pickup", kind: p.kind });
      if (p.kind === "double") s.weapon = Math.max(s.weapon, 2);
      else if (p.kind === "triple") s.weapon = 3;
      else if (p.kind === "shield") s.shield = true;
      else if (p.kind === "rapid") s.rapid = RAPID_TIME;
      else if (p.kind === "bomb") s.bombs = Math.min(MAXBOMBS, s.bombs + 1);
      else if (p.kind === "life") { s.lives = Math.min(MAXLIVES, s.lives + 1); evs.push({ t: "life" }); }
      else s.magnet = MAGNET_TIME;
    } else if (p.y < H + 16) keepP.push(p);
  }
  s.pups = keepP;
  // the end of a level
  if (s.bossDead && !s.over) { s.clearT -= dt; if (s.clearT <= 0) { s.cleared = true; evs.push({ t: "clear" }); } }
  return evs;
}

/** a simple bot (tests and demos): stand under the lowest enemy, keep away from bullets and bodies, bomb when surrounded */
export function botInput(s: State): Input {
  const sx = s.ship.x;
  let gx = W / 2, low = -1e9;
  for (const e of s.enemies) if (e.y > -10 && e.y < s.ship.y - 30 && e.y > low) { low = e.y; gx = e.x; }
  for (const p of s.pups) if (p.y > H * 0.35 && Math.abs(p.x - sx) < 120) gx = p.x;
  const ys = [H - 150, H - 100, H - 60];
  let bx = sx, by = s.ship.y, bc = 1e18;
  for (let cx = 20; cx <= W - 20; cx += 10) {
    for (const cy of ys) {
      let cost = Math.abs(cx - gx) * 0.05 + Math.abs(cx - sx) * 0.03 + Math.abs(cy - s.ship.y) * 0.01;
      const reach = Math.hypot(cx - sx, cy - s.ship.y) / 480;
      for (const tau of [0.12, 0.25, 0.4, 0.55]) {
        if (tau < reach * 0.6) continue;
        for (const b of s.ebullets) { const dd = Math.hypot(b.x + b.vx * tau - cx, b.y + b.vy * tau - cy); if (dd < 30) cost += (30 - dd) * (30 - dd); }
        for (const e of s.enemies) { const rr = e.r + 20, dd = Math.hypot(e.x + e.vx * tau - cx, e.y + e.vy * tau - cy); if (dd < rr) cost += (rr - dd) * (rr - dd) * 0.6; }
      }
      if (cost < bc) { bc = cost; bx = cx; by = cy; }
    }
  }
  let near = 0;
  for (const b of s.ebullets) if (Math.hypot(b.x - sx, b.y - s.ship.y) < 45) near++;
  return { tx: bx, ty: by, bomb: near >= 3 || (s.boss !== null && s.boss.hp < s.boss.maxhp * 0.2 && s.bombs >= 2) };
}
