/**
 * Space shooter: the pure rules (no screen, no timer). A fixed board W x H, fixed steps, one seeded random generator in the state, so a game is a function of
 * (seed, level, inputs). `step(s, dt, input)` moves everything and returns the events of that step (the screen turns them into sounds and sparks).
 * The levels are data (`shooter-levels.ts`); this file holds the enemies (fourteen kinds), the environment (black hole, storm, comet, shower, gifts), the bosses,
 * the weapons (blaster, spread, laser, homing, wave, drones; level 1-5), the combo / graze scores, the run (coins, shop) and the star objectives.
 */
import { scriptOf, bossHp, bossTypeOf, CP_T, LEVEL_COUNT, type Ev } from "./shooter-levels";
export { LEVEL_COUNT, CP_T, bossTypeOf };
export const W = 360;
export const H = 640;
export const STEP = 1 / 60;
export const MAXLIVES = 5;
export const MAXLIVES_SHOP = 7;
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
export const MAX_ENEMIES = 70;
export const MAX_EBULLETS = 150;
export const MAX_COINS = 90;
export const MAX_PUPS = 10;
export const MAX_BULLETS = 120;
export const WCAP = 5;
const ROCK_R = [0, 12, 20, 30];
const ROCK_HP = [0, 1, 3, 6];
const ROCK_SCORE = [0, 10, 25, 50];

export type EKind = "rock" | "flyer" | "zigzag" | "snake" | "diver" | "shield" | "splitter" | "mini" | "bomber" | "mother" | "swarm" | "stealth" | "comet" | "balloon" | "boss";
export const ENEMY_KINDS: EKind[] = ["rock", "flyer", "zigzag", "snake", "diver", "shield", "splitter", "mini", "bomber", "mother", "swarm", "stealth", "comet", "balloon", "boss"];
export type WKind = "blaster" | "spread" | "laser" | "homing" | "wave" | "drone";
export const WEAPONS: WKind[] = ["blaster", "spread", "laser", "homing", "wave", "drone"];
export type PKind = "power" | "spread" | "laser" | "homing" | "wave" | "drone" | "shield" | "rapid" | "bomb" | "life" | "magnet";
export const PKINDS: PKind[] = ["power", "spread", "laser", "homing", "wave", "drone", "shield", "rapid", "bomb", "life", "magnet"];
const PWEIGHT: Record<PKind, number> = { power: 14, spread: 9, laser: 8, homing: 8, wave: 8, drone: 8, shield: 14, rapid: 12, bomb: 10, life: 3, magnet: 10 };

const CFG: Record<Exclude<EKind, "rock" | "boss">, { r: number; hp: number; score: number; vy: number }> = {
  flyer: { r: 14, hp: 2, score: 60, vy: 72 }, zigzag: { r: 14, hp: 2, score: 70, vy: 68 }, snake: { r: 11, hp: 1, score: 40, vy: 85 }, diver: { r: 14, hp: 2, score: 80, vy: 82 },
  shield: { r: 17, hp: 3, score: 120, vy: 46 }, splitter: { r: 19, hp: 3, score: 100, vy: 58 }, mini: { r: 9, hp: 1, score: 30, vy: 100 }, bomber: { r: 21, hp: 5, score: 150, vy: 18 },
  mother: { r: 30, hp: 14, score: 300, vy: 0 }, swarm: { r: 10, hp: 1, score: 50, vy: 90 }, stealth: { r: 14, hp: 2, score: 110, vy: 50 }, comet: { r: 15, hp: 4, score: 80, vy: 270 }, balloon: { r: 18, hp: 1, score: 0, vy: 42 },
};

export interface Enemy { id: number; kind: EKind; x: number; y: number; vx: number; vy: number; r: number; hp: number; maxhp: number; size: number; t: number; x0: number; ph: number; cd: number; dive: number; spin: number; hurt: number; atk: number; sh: number; wait: number; grp: number; bt: number; dash: { ph: number; t: number; tx: number } | null; sp: number; tele: number; vis: boolean }
export interface PB { x: number; y: number; vx: number; vy: number; dmg: number; r: number; life: number; kind: WKind; x0: number; age: number; hits: number[] }
export interface EB { x: number; y: number; vx: number; vy: number; r: number; mine: boolean; g: boolean }
export interface Coin { x: number; y: number; vx: number; vy: number }
export interface Pup { x: number; y: number; x0: number; kind: PKind; t: number }
export interface Haz { x: number; w: number; t: number; warn: number; dur: number; kind: "laser" | "bolt"; zapped: boolean }
export interface Hole { x: number; y: number; t: number; dur: number }
export interface Storm { x: number; y: number; vx: number; t: number; dur: number; cd: number }
export interface Up { lives: number; shield: number; rate: number; magnet: number; bomb: number }
export interface Run { lives: number; score: number; weapon: WKind; wl: number; wallet: number; up: Up }
export interface Cp { score: number; lives: number; weapon: WKind; wl: number; bombs: number }

export interface State {
  rs: number; level: number; easy: boolean; time: number; script: Ev[]; idx: number; nextId: number;
  score: number; lives: number; bombs: number; weapon: WKind; wl: number; rapid: number; magnet: number; shield: number;
  ship: { x: number; y: number; vx: number }; inv: number; fireCd: number; missCd: number; droneA: number; droneCd: number; beam: { x: number; y0: number; y1: number } | null; beamHitT: number;
  bullets: PB[]; ebullets: EB[]; enemies: Enemy[]; coins: Coin[]; pups: Pup[]; haz: Haz[]; hole: Hole | null; storm: Storm | null; shower: number; showerAcc: number;
  boss: Enemy | null; dying: { x: number; y: number; bt: number; t: number; boomT: number; rainT: number } | null; bossDead: boolean; clearT: number; cleared: boolean; over: boolean;
  bombFlash: number; slow: number; kills: number; spawned: number; coinsGot: number; hits: number; combo: number; comboT: number; bestCombo: number; grazes: number;
  run: Run; cp: Cp | null; cpDone: boolean;
}
export type Event = { t: "shot" } | { t: "hit"; x: number; y: number } | { t: "kill"; x: number; y: number; kind: EKind; size: number } | { t: "split"; x: number; y: number }
  | { t: "pickup"; kind: PKind } | { t: "coin" } | { t: "hurt"; x: number; y: number } | { t: "shield" } | { t: "bomb" } | { t: "boss" } | { t: "bossdead"; x: number; y: number }
  | { t: "clear" } | { t: "over" } | { t: "life" } | { t: "shoot"; x: number; y: number } | { t: "pop"; x: number; y: number } | { t: "graze" } | { t: "warn" } | { t: "zap" }
  | { t: "checkpoint" } | { t: "boom"; x: number; y: number } | { t: "combo"; n: number } | { t: "hole" } | { t: "storm" } | { t: "gift"; x: number; y: number };
export interface Input { tx: number; ty: number; bomb?: boolean }

export function rnd(s: { rs: number }): number {
  s.rs = (s.rs + 0x6d2b79f5) >>> 0;
  let t = s.rs;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- the run and the shop
export const newRun = (easy = false): Run => ({ lives: easy ? EASY_LIVES : START_LIVES, score: 0, weapon: "blaster", wl: 1, wallet: 0, up: { lives: 0, shield: 0, rate: 0, magnet: 0, bomb: 0 } });
export type UpKind = keyof Up;
export const UPGRADES: { kind: UpKind; base: number; max: number }[] = [
  { kind: "lives", base: 40, max: 3 }, { kind: "shield", base: 35, max: 2 }, { kind: "rate", base: 40, max: 3 }, { kind: "magnet", base: 30, max: 3 }, { kind: "bomb", base: 35, max: 2 },
];
export const owned = (run: Run, k: UpKind) => run.up[k];
export const price = (run: Run, k: UpKind) => (UPGRADES.find((u) => u.kind === k)!.base) * (1 + run.up[k]);
export const maxed = (run: Run, k: UpKind) => run.up[k] >= UPGRADES.find((u) => u.kind === k)!.max;
export const canBuy = (run: Run, k: UpKind) => !maxed(run, k) && run.wallet >= price(run, k);
export function buy(run: Run, k: UpKind): boolean {
  if (!canBuy(run, k)) return false;
  run.wallet -= price(run, k); run.up[k]++;
  if (k === "lives") run.lives = Math.min(MAXLIVES_SHOP, run.lives + 1);
  return true;
}
/** three different offers for a visit, the same for the same (run state, level, seed) */
export function offers(run: Run, level: number, seed = 1): UpKind[] {
  const g = { rs: (seed * 7919 + level * 104729 + run.wallet) >>> 0 };
  const pool = UPGRADES.filter((u) => !maxed(run, u.kind)).map((u) => u.kind);
  const out: UpKind[] = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rnd(g) * pool.length), 1)[0]);
  return out;
}

// ---------------------------------------------------------------- creating
export interface Opts { easy?: boolean; seed?: number; run?: Run; lives?: number; score?: number; weapon?: WKind; wl?: number; bombs?: number; startTime?: number; cp?: Cp }
export function newGame(level: number, o: Opts = {}): State {
  const easy = !!o.easy;
  level = clamp(Math.round(level), 1, LEVEL_COUNT);
  const run = o.run ?? newRun(easy);
  const c = o.cp;
  const script = scriptOf(level, easy), t0 = o.startTime ?? 0;
  let idx = 0; while (idx < script.length && script[idx].t < t0) idx++;
  return {
    rs: (o.seed ?? 12345) >>> 0, level, easy, time: t0, script, idx, nextId: 1,
    score: c?.score ?? o.score ?? run.score, lives: c?.lives ?? o.lives ?? run.lives, bombs: c?.bombs ?? o.bombs ?? Math.min(MAXBOMBS, 1 + run.up.bomb), weapon: c?.weapon ?? o.weapon ?? run.weapon, wl: c?.wl ?? o.wl ?? run.wl,
    rapid: 0, magnet: 0, shield: easy ? 1 + run.up.shield : 0,
    ship: { x: W / 2, y: H - 110, vx: 0 }, inv: 1.2, fireCd: 0, missCd: 0, droneA: 0, droneCd: 0, beam: null, beamHitT: 0,
    bullets: [], ebullets: [], enemies: [], coins: [], pups: [], haz: [], hole: null, storm: null, shower: 0, showerAcc: 0,
    boss: null, dying: null, bossDead: false, clearT: 0, cleared: false, over: false, bombFlash: 0, slow: 0, kills: 0, spawned: 0, coinsGot: 0, hits: 0, combo: 0, comboT: 0, bestCombo: 0, grazes: 0,
    run, cp: null, cpDone: t0 >= CP_T,
  };
}

export const shipR = (s: State) => (s.easy ? 4.5 : 6.5);
export const bulletSpeed = (s: State) => (100 + s.level * 8) * (s.easy ? 0.68 : 1);
export const comboMult = (s: State) => Math.min(5, 1 + Math.floor(s.combo / 5));
const fireGap = (s: State) => (s.easy ? 1.5 : 1) * (2.7 - s.level * 0.1);
export const stars = (s: State): [boolean, boolean, boolean] => [s.hits === 0, s.spawned === 0 || s.kills >= 0.9 * s.spawned, s.coinsGot >= 50];

export function spawnEnemy(s: State, kind: EKind, x: number, o: { size?: number; vy?: number; y?: number; vx?: number; wait?: number; grp?: number; bt?: number } = {}): Enemy | null {
  if (kind === "boss" ? !!s.boss : s.enemies.length >= MAX_ENEMIES) return null;
  const L = s.level;
  const e: Enemy = { id: s.nextId++, kind, x, y: 0, vx: o.vx ?? 0, vy: 0, r: 14, hp: 1, maxhp: 1, size: 0, t: 0, x0: x, ph: rnd(s) * 6.28, cd: 0.6 + rnd(s) * 1.2, dive: 0, spin: (rnd(s) - 0.5) * 2, hurt: 0, atk: 0, sh: 0, wait: o.wait ?? 1.5, grp: o.grp ?? 0, bt: o.bt ?? 0, dash: null, sp: 0, tele: 0, vis: true };
  if (kind === "rock") {
    const sz = clamp(o.size ?? 2, 1, 3);
    e.size = sz; e.r = ROCK_R[sz]; e.hp = e.maxhp = ROCK_HP[sz]; e.vy = o.vy ?? [0, 90, 72, 56][sz] + L * 3; if (!o.vx) e.vx = (rnd(s) - 0.5) * 50;
  } else if (kind === "boss") {
    e.bt = o.bt ?? bossTypeOf(L); e.r = e.bt === 0 ? 34 : 46; e.hp = e.maxhp = bossHp(L); e.size = L; e.cd = 2; e.vy = 80; s.boss = e;
  } else {
    const c = CFG[kind];
    e.r = c.r; e.hp = e.maxhp = c.hp + (kind === "flyer" || kind === "zigzag" ? (L >= 6 ? 1 : 0) : 0); e.vy = o.vy ?? c.vy + (kind === "bomber" || kind === "mother" ? 0 : L * 2);
    if (kind === "zigzag") e.vx = rnd(s) < 0.5 ? 80 : -80;
    if (kind === "shield") e.sh = 1;
    if (kind === "comet") { e.vy = 260; e.vx = o.vx ?? 150; }
    if (kind === "mini") e.vx = o.vx ?? 0;
  }
  e.y = o.y ?? -e.r - 4;
  if (kind !== "balloon" && kind !== "boss") s.spawned++;
  s.enemies.push(e);
  return e;
}

// ---------------------------------------------------------------- helpers of one step
function addScore(s: State, n: number) { s.score += Math.round(n * comboMult(s)); }
function addCoins(s: State, x: number, y: number, n: number) {
  for (let i = 0; i < n && s.coins.length < MAX_COINS; i++) s.coins.push({ x: x + (rnd(s) - 0.5) * 16, y: y + (rnd(s) - 0.5) * 16, vx: (rnd(s) - 0.5) * 90, vy: -90 - rnd(s) * 60 });
}
function dropPup(s: State, x: number, y: number, kinds?: PKind[]) {
  if (s.pups.length >= MAX_PUPS) return;
  const list = kinds ?? PKINDS;
  let tot = 0; for (const k of list) tot += PWEIGHT[k];
  let r = rnd(s) * tot, kind: PKind = list[0];
  for (const k of list) { r -= PWEIGHT[k]; if (r <= 0) { kind = k; break; } }
  if (kind === "life" && s.lives >= MAXLIVES) kind = "shield";
  s.pups.push({ x, y, x0: x, kind, t: 0 });
}
const WEAPON_OF: Partial<Record<PKind, WKind>> = { spread: "spread", laser: "laser", homing: "homing", wave: "wave", drone: "drone" };
function pickup(s: State, kind: PKind, evs: Event[]) {
  s.score += 20; evs.push({ t: "pickup", kind });
  const w = WEAPON_OF[kind];
  if (kind === "power") { if (s.weapon === "blaster") s.wl = Math.min(WCAP, s.wl + 1); else { s.weapon = "blaster"; s.wl = 1; } }
  else if (w) { if (s.weapon === w) s.wl = Math.min(WCAP, s.wl + 1); else { s.weapon = w; s.wl = 1; } }
  else if (kind === "shield") s.shield = 1 + s.run.up.shield;
  else if (kind === "rapid") s.rapid = RAPID_TIME;
  else if (kind === "bomb") s.bombs = Math.min(MAXBOMBS, s.bombs + 1);
  else if (kind === "life") { s.lives = Math.min(MAXLIVES_SHOP, s.lives + 1); evs.push({ t: "life" }); }
  else s.magnet = MAGNET_TIME;
}
function kill(s: State, e: Enemy, evs: Event[], byBomb: boolean) {
  const i = s.enemies.indexOf(e); if (i < 0) return;
  s.enemies.splice(i, 1);
  if (e.kind === "balloon") { evs.push({ t: "gift", x: e.x, y: e.y }); dropPup(s, e.x, e.y); addCoins(s, e.x, e.y, 3); return; }
  s.kills++; s.combo++; s.comboT = 3; s.bestCombo = Math.max(s.bestCombo, s.combo);
  if (s.combo % 5 === 0) evs.push({ t: "combo", n: s.combo });
  evs.push({ t: "kill", x: e.x, y: e.y, kind: e.kind, size: e.size });
  const mine = s.easy ? 1.3 : 1;
  if (e.kind === "rock") {
    addScore(s, ROCK_SCORE[e.size]);
    addCoins(s, e.x, e.y, e.size === 3 ? 2 : e.size === 2 ? 1 : rnd(s) < 0.5 ? 1 : 0);
    if (e.size > 1 && !byBomb) {
      evs.push({ t: "split", x: e.x, y: e.y });
      for (const d of [-1, 1]) {
        const c = spawnEnemy(s, "rock", e.x + d * e.r * 0.6, { size: e.size - 1, y: e.y });
        if (c) { c.vx = d * (35 + rnd(s) * 30); c.vy = Math.max(40, e.vy * (0.9 + rnd(s) * 0.3)); }
      }
    }
    if (rnd(s) < (e.size === 3 ? 0.12 : e.size === 2 ? 0.05 : 0.02) * mine) dropPup(s, e.x, e.y);
  } else if (e.kind === "boss") {
    addScore(s, 500 * s.level);
    s.bossDead = true; s.clearT = 2.4; s.boss = null; s.ebullets.length = 0; s.haz.length = 0; s.inv = Math.max(s.inv, 6); s.slow = 0.45;
    s.dying = { x: e.x, y: e.y, bt: e.bt, t: 0, boomT: 0, rainT: 0 };
    evs.push({ t: "bossdead", x: e.x, y: e.y });
    for (const o of s.enemies.slice()) { s.enemies.splice(s.enemies.indexOf(o), 1); evs.push({ t: "kill", x: o.x, y: o.y, kind: o.kind, size: o.size }); addCoins(s, o.x, o.y, 1); }
    s.enemies.length = 0;
    addCoins(s, e.x, e.y, 10); dropPup(s, e.x, e.y, ["life", "bomb", "power", "shield"]);
  } else {
    addScore(s, CFG[e.kind].score);
    addCoins(s, e.x, e.y, e.kind === "comet" ? 12 : e.kind === "mother" ? 5 : e.kind === "shield" || e.kind === "bomber" ? 3 : e.kind === "splitter" ? 2 : 1);
    if (e.kind === "splitter") {
      evs.push({ t: "split", x: e.x, y: e.y });
      for (const d of [-1, 1]) spawnEnemy(s, "mini", e.x + d * 10, { y: e.y, vx: d * 75 });
    }
    const chance = e.kind === "comet" ? 0 : e.kind === "mother" || e.kind === "bomber" ? 0.6 : e.kind === "shield" || e.kind === "stealth" ? 0.3 : e.kind === "mini" || e.kind === "swarm" || e.kind === "snake" ? 0.04 : 0.17;
    if (rnd(s) < chance * mine) dropPup(s, e.x, e.y);
  }
}
function damage(s: State, e: Enemy, dmg: number, evs: Event[], byBomb = false, px = e.x, py = e.y) {
  if (e.kind === "boss") {
    const d = Math.hypot(px - e.x, py - e.y);
    dmg *= d < 28 ? 1.8 : 0.7;
  } else if (e.sh > 0) { e.sh = 0; e.hurt = 0.12; evs.push({ t: "pop", x: e.x, y: e.y }); return; }
  e.hp -= dmg; e.hurt = 0.12;
  if (e.hp <= 0) kill(s, e, evs, byBomb); else evs.push({ t: "hit", x: e.x, y: e.y });
}
function hurt(s: State, evs: Event[]) {
  if (s.inv > 0 || s.over || s.bossDead) return;
  s.combo = 0; s.comboT = 0;
  if (s.shield > 0) { s.shield--; s.inv = 1; evs.push({ t: "shield" }); return; }
  s.hits++;
  s.lives = Math.max(0, s.lives - 1); if (s.wl > 1) s.wl--; s.bombs = Math.max(s.bombs, 1); s.inv = 2.2;
  evs.push({ t: "hurt", x: s.ship.x, y: s.ship.y });
  s.ebullets = s.ebullets.filter((b) => Math.hypot(b.x - s.ship.x, b.y - s.ship.y) > 110);
  if (s.lives <= 0) { s.over = true; evs.push({ t: "over" }); }
}
function eShoot(s: State, x: number, y: number, evs: Event[], ang: number, speed: number, r = 4.5) {
  if (s.ebullets.length >= MAX_EBULLETS) return;
  s.ebullets.push({ x, y, vx: Math.sin(ang) * speed, vy: Math.cos(ang) * speed, r, mine: false, g: false });
  evs.push({ t: "shoot", x, y });
}
export const phaseOf = (e: Enemy) => (e.hp > e.maxhp * 0.66 ? 0 : e.hp > e.maxhp * 0.33 ? 1 : 2);
const ATT: Record<number, string[][]> = {
  0: [["aimed", "ring"], ["aimed", "curtain", "ring"], ["aimed", "curtain", "ring"]],
  1: [["ring", "aimed"], ["ring", "minions", "aimed"], ["spiral", "minions", "ring"]],
  2: [["laser", "aimed"], ["laser", "ring", "aimed"], ["dash", "laser", "aimed"]],
  3: [["spiral", "aimed"], ["minions", "spiral", "curtain"], ["dash", "spiral", "minions", "ring"]],
  4: [["laser", "ring"], ["laser", "spiral", "minions"], ["dash", "laser", "spiral", "ring"]],
};
function bossAttack(s: State, e: Enemy, evs: Event[]) {
  const bs = bulletSpeed(s), L = s.level, ph = phaseOf(e), list = ATT[e.bt][ph], a = list[e.atk++ % list.length];
  let wait = (1.8 - L * 0.05) * (s.easy ? 1.35 : 1) * (ph === 2 ? 0.85 : 1);
  if (a === "ring") { const n = 8 + Math.floor(L / 2) - (s.easy ? 3 : 0), off = rnd(s) * 6.28; for (let i = 0; i < n; i++) eShoot(s, e.x, e.y + 20, evs, off + (i * 6.2832) / n, bs * 0.85); }
  else if (a === "aimed") { const aim = Math.atan2(s.ship.x - e.x, s.ship.y - e.y), n = L >= 6 ? 5 : 3; for (let i = 0; i < n; i++) eShoot(s, e.x, e.y + 20, evs, aim + (i - (n - 1) / 2) * 0.22, bs * 1.05); }
  else if (a === "curtain") { const n = 5 - (s.easy ? 1 : 0), o = rnd(s) < 0.5 ? 0 : 0.5; for (let i = 0; i < n; i++) if (s.ebullets.length < MAX_EBULLETS) s.ebullets.push({ x: 40 + ((W - 80) * (i + o)) / n, y: e.y + 20, vx: 0, vy: bs * 0.8, r: 4.5, mine: false, g: false }); evs.push({ t: "shoot", x: e.x, y: e.y }); }
  else if (a === "spiral") { e.sp = 1.8; wait += 1.8; }
  else if (a === "minions") { for (const d of [-1, 1]) spawnEnemy(s, "flyer", e.x + d * 40, { y: e.y + 10 }); evs.push({ t: "shoot", x: e.x, y: e.y }); }
  else if (a === "laser") {
    const xs = ph === 0 ? [s.ship.x] : [s.ship.x - 60, s.ship.x + 60];
    for (const x of xs) s.haz.push({ x: clamp(x, 20, W - 20), w: 14, t: 0, warn: s.easy ? 1.3 : 1, dur: 0.5, kind: "laser", zapped: false });
    evs.push({ t: "warn" }); wait += 1.2;
  } else if (a === "dash") { e.dash = { ph: 0, t: 0, tx: s.ship.x }; e.tele = 1; evs.push({ t: "warn" }); wait += 3; }
  e.cd = wait;
}
function bossMove(s: State, e: Enemy, dt: number, evs: Event[]) {
  if (e.y < 100 && !e.dash) { e.y += 80 * dt; return; }
  if (e.dash) {
    const d = e.dash; d.t += dt;
    const wob = s.easy ? 1.3 : 1;
    if (d.ph === 0) { e.tele = 1; e.x += Math.sin(d.t * 60) * 0.6; if (d.t > 0.9 * wob) { d.ph = 1; d.t = 0; } }
    else if (d.ph === 1) { e.tele = 0; const sp = s.easy ? 400 : 520; e.x += clamp(d.tx - e.x, -sp * dt * 0.5, sp * dt * 0.5); e.y += sp * dt; if (e.y > H - 190) { d.ph = 2; d.t = 0; } }
    else { const sp = 300; e.y -= sp * dt; e.x += clamp(W / 2 - e.x, -120 * dt, 120 * dt); if (e.y <= 100) { e.y = 100; e.dash = null; e.t = Math.asin(clamp((e.x - W / 2) / (100 + s.level * 6), -1, 1)) / 0.7; } }
    return;
  }
  const wide = 100 + s.level * 6;
  e.x = W / 2 + Math.sin(e.t * 0.7) * wide; e.y = 100 + Math.sin(e.t * 1.1) * 14;
  if (e.sp > 0) { e.sp -= dt; const k = Math.floor(e.sp / 0.1), k0 = Math.floor((e.sp + dt) / 0.1); if (k !== k0) eShoot(s, e.x, e.y + 20, evs, e.sp * 6 + e.atk, bulletSpeed(s) * 0.8); }
  e.cd -= dt;
  if (e.cd <= 0 && !s.bossDead) bossAttack(s, e, evs);
}

export function bomb(s: State, evs: Event[]): boolean {
  if (s.bombs <= 0 || s.over || s.cleared || s.bossDead) return false;
  s.bombs--; s.bombFlash = 1; s.inv = Math.max(s.inv, 0.7); s.ebullets.length = 0; s.haz = [];
  evs.push({ t: "bomb" });
  for (const e of s.enemies.slice()) if (e.y > -e.r && e.kind !== "balloon") damage(s, e, BOMB_DMG, evs, true, e.x, e.y);
  return true;
}

function pb(s: State, kind: WKind, x: number, y: number, ang: number, v: number, dmg: number, r: number, life: number, o: Partial<PB> = {}) {
  if (s.bullets.length >= MAX_BULLETS) return;
  s.bullets.push({ x, y, vx: Math.sin(ang) * v, vy: -Math.cos(ang) * v, dmg, r, life, kind, x0: x, age: 0, hits: [], ...o });
}
function nearestTarget(s: State, x: number, y: number): Enemy | null {
  let best: Enemy | null = null, bd = 1e9;
  for (const e of s.enemies) { if (e.y < 10 || e.kind === "balloon" || !e.vis) continue; const d = Math.hypot(e.x - x, e.y - y); if (d < bd) { bd = d; best = e; } }
  return best;
}
function fire(s: State, dt: number, evs: Event[]) {
  const { x, y } = s.ship, wl = s.wl, v = 640;
  const rate = (s.rapid > 0 ? 0.55 : 1) * (s.easy ? 0.92 : 1) * (1 - 0.1 * s.run.up.rate);
  s.fireCd -= dt; s.beam = null;
  if (s.weapon === "laser") {
    const bw = 5 + wl, dps = 8 + 3.4 * wl; let tgt: Enemy | null = null;
    for (const e of s.enemies) if (e.y < y - 10 && e.y > -e.r * 0.3 && e.kind !== "balloon" && e.vis && Math.abs(e.x - x) < e.r + bw && (!tgt || e.y > tgt.y)) tgt = e;
    s.beam = { x, y0: y - 16, y1: tgt ? tgt.y + tgt.r * 0.5 : -10 };
    if (tgt) {
      const d = dps * dt * (s.rapid > 0 ? 1.4 : 1);
      if (tgt.sh > 0) { s.beamHitT -= dt; if (s.beamHitT <= 0) { damage(s, tgt, 1, evs, false, x, tgt.y); s.beamHitT = 0.25; } }
      else { tgt.hp -= tgt.kind === "boss" ? d * (Math.abs(x - tgt.x) < 28 ? 1.8 : 0.7) : d; tgt.hurt = 0.1; s.beamHitT -= dt; if (tgt.hp <= 0) kill(s, tgt, evs, false); else if (s.beamHitT <= 0) { evs.push({ t: "hit", x: tgt.x, y: tgt.y }); s.beamHitT = 0.12; } }
    }
    return;
  }
  if (s.fireCd <= 0) {
    const base = s.weapon === "spread" ? 0.26 : s.weapon === "wave" ? 0.3 : s.weapon === "homing" ? 0.2 : s.weapon === "drone" ? 0.21 : [0.21, 0.19, 0.18, 0.17, 0.16][wl - 1];
    s.fireCd += base * rate; if (s.fireCd < 0) s.fireCd = 0;
    if (s.weapon === "blaster" || s.weapon === "drone") {
      const n = s.weapon === "drone" ? 1 : [1, 2, 3, 4, 5][wl - 1];
      if (n === 1) pb(s, "blaster", x, y - 18, 0, v, 1, 4, 2);
      else if (n === 2) { pb(s, "blaster", x - 7, y - 16, 0, v, 1, 4, 2); pb(s, "blaster", x + 7, y - 16, 0, v, 1, 4, 2); }
      else for (const a of n === 3 ? [0, -0.13, 0.13] : n === 4 ? [-0.06, 0.06, -0.2, 0.2] : [0, -0.12, 0.12, -0.24, 0.24]) pb(s, "blaster", x + a * 50, y - 16, a, v, 1, 4, 2);
    } else if (s.weapon === "spread") {
      const n = [3, 3, 5, 5, 7][wl - 1];
      for (let i = 0; i < n; i++) pb(s, "spread", x, y - 14, (i - (n - 1) / 2) * 0.17, 560, 0.8, 4, 0.75);
    } else if (s.weapon === "wave") {
      pb(s, "wave", x, y - 16, 0, 440, 1 + (wl >= 4 ? 0.5 : 0), 9 + wl, 3, { hits: [] });
      if (wl >= 3) pb(s, "wave", x, y - 16, 0, 440, 1, 9 + wl, 3, { age: 0.35 });
    } else if (s.weapon === "homing") {
      const n = 1 + Math.floor(wl / 2);
      for (let i = 0; i < n; i++) pb(s, "homing", x + (i - (n - 1) / 2) * 12, y - 12, (i - (n - 1) / 2) * 0.5, 420, 2, 5, 2.4);
    }
    evs.push({ t: "shot" });
  }
  if (s.weapon === "drone") {
    s.droneA += dt * 3; s.droneCd -= dt;
    if (s.droneCd <= 0) { s.droneCd = 0.5 * rate; const n = Math.min(4, wl); for (let i = 0; i < n; i++) { const a = s.droneA + (i * 6.2832) / n; pb(s, "blaster", x + Math.cos(a) * 34, y + Math.sin(a) * 20, 0, v, 0.8, 3, 2); } }
  }
}
export const dronePos = (s: State): { x: number; y: number }[] => { const n = Math.min(4, s.wl); return s.weapon === "drone" ? Array.from({ length: n }, (_, i) => { const a = s.droneA + (i * 6.2832) / n; return { x: s.ship.x + Math.cos(a) * 34, y: s.ship.y + Math.sin(a) * 20 }; }) : []; };

export function step(s: State, dt: number, inp: Input): Event[] {
  const evs: Event[] = [];
  if (s.over || s.cleared) return evs;
  s.time += dt;
  if (s.bombFlash > 0) s.bombFlash = Math.max(0, s.bombFlash - dt / 0.5);
  if (s.slow > 0) s.slow = Math.max(0, s.slow - dt);
  if (s.comboT > 0) { s.comboT -= dt; if (s.comboT <= 0) s.combo = 0; }
  // the ship: smooth, speed-limited; the black hole pulls a little
  const tx = clamp(inp.tx, SHIP_X_MIN, SHIP_X_MAX), ty = clamp(inp.ty, SHIP_Y_MIN, SHIP_Y_MAX);
  const dx = tx - s.ship.x, dy = ty - s.ship.y, d = Math.hypot(dx, dy), ox = s.ship.x;
  if (d > 1e-6) { const m = Math.min(d, Math.min(d * 14, SHIP_SPEED) * dt); s.ship.x += (dx / d) * m; s.ship.y += (dy / d) * m; }
  if (s.hole) { const hx = s.hole.x - s.ship.x, hy = s.hole.y - s.ship.y, hd = Math.hypot(hx, hy) || 1; if (hd < 220) { const pull = 38 * (1 - hd / 220); s.ship.x += (hx / hd) * pull * dt; s.ship.y += (hy / hd) * pull * dt; } }
  s.ship.x = clamp(s.ship.x, SHIP_X_MIN, SHIP_X_MAX); s.ship.y = clamp(s.ship.y, SHIP_Y_MIN, SHIP_Y_MAX);
  s.ship.vx = (s.ship.x - ox) / dt;
  if (inp.bomb) bomb(s, evs);
  if (s.inv > 0) s.inv = Math.max(0, s.inv - dt);
  if (s.rapid > 0) s.rapid = Math.max(0, s.rapid - dt);
  if (s.magnet > 0) s.magnet = Math.max(0, s.magnet - dt);
  if (!s.bossDead) fire(s, dt, evs); else s.beam = null;
  if (!s.cpDone && s.time >= CP_T) { s.cpDone = true; s.cp = { score: s.score, lives: Math.max(s.lives, s.easy ? EASY_LIVES : START_LIVES), weapon: s.weapon, wl: s.wl, bombs: Math.max(1, s.bombs) }; evs.push({ t: "checkpoint" }); }
  // the script
  while (s.idx < s.script.length && s.script[s.idx].t <= s.time) {
    const w = s.script[s.idx++];
    if (w.k === "boss") { if (spawnEnemy(s, "boss", w.x, { bt: w.size })) evs.push({ t: "boss" }); }
    else if (w.k === "shower") s.shower = w.d ?? 5;
    else if (w.k === "hole") { s.hole = { x: w.x, y: w.y ?? 300, t: 0, dur: w.d ?? 8 }; evs.push({ t: "hole" }); }
    else if (w.k === "storm") { s.storm = { x: w.x, y: 56, vx: 22, t: 0, dur: w.d ?? 12, cd: 1.2 }; evs.push({ t: "storm" }); }
    else spawnEnemy(s, w.k, w.x, { size: w.size, vy: undefined, y: w.y, vx: w.vx, wait: w.wait, grp: Math.floor(w.t) });
  }
  // environment
  if (s.shower > 0) { s.shower -= dt; s.showerAcc += dt; const gap = s.easy ? 0.4 : 0.26; while (s.showerAcc >= gap) { s.showerAcc -= gap; spawnEnemy(s, "rock", 20 + rnd(s) * (W - 40), { size: rnd(s) < 0.7 ? 1 : 2, vy: 170 + rnd(s) * 80, vx: (rnd(s) - 0.5) * 40 }); } }
  if (s.hole) { s.hole.t += dt; if (s.hole.t > s.hole.dur) s.hole = null; }
  if (s.storm) {
    const st = s.storm; st.t += dt; st.x += st.vx * dt; if (st.x < 50 || st.x > W - 50) st.vx = -st.vx; st.cd -= dt;
    if (st.cd <= 0 && st.t < st.dur - 1) { st.cd = s.easy ? 3.2 : 2.3; s.haz.push({ x: clamp(s.ship.x + (rnd(s) - 0.5) * 60, 20, W - 20), w: 18, t: 0, warn: s.easy ? 1.2 : 0.9, dur: 0.25, kind: "bolt", zapped: false }); evs.push({ t: "warn" }); }
    if (st.t > st.dur) s.storm = null;
  }
  for (const h of s.haz) {
    h.t += dt;
    if (!h.zapped && h.t >= h.warn) { h.zapped = true; evs.push({ t: "zap" }); }
    if (h.t >= h.warn && Math.abs(s.ship.x - h.x) < h.w + shipR(s)) hurt(s, evs);
  }
  s.haz = s.haz.filter((h) => h.t < h.warn + h.dur);
  // enemies
  const bs = bulletSpeed(s);
  for (const e of s.enemies.slice()) {
    e.t += dt; if (e.hurt > 0) e.hurt = Math.max(0, e.hurt - dt);
    const k = e.kind;
    if (k === "rock") { e.x += e.vx * dt; e.y += e.vy * dt; }
    else if (k === "boss") bossMove(s, e, dt, evs);
    else if (k === "snake") { e.y += e.vy * dt; e.x = clamp(e.x0 + Math.sin(e.t * 2.2) * 80, 14, W - 14); }
    else if (k === "zigzag") { e.y += e.vy * dt; e.x += e.vx * dt; if (e.x < 20 || e.x > W - 20) { e.vx = -e.vx; e.x = clamp(e.x, 20, W - 20); } if (Math.floor(e.t / 0.9) !== Math.floor((e.t - dt) / 0.9)) e.vx = -e.vx; }
    else if (k === "diver" || k === "swarm") {
      if (e.dive === 0) {
        e.y += (k === "swarm" ? 90 : 82) * dt;
        if (k === "swarm" ? e.t >= e.wait : e.y >= 90 || e.t > 1.4) { e.dive = 1; const a = Math.atan2(s.ship.x - e.x, s.ship.y - e.y), sp = ((k === "swarm" ? 250 : 230) + s.level * 8) * (s.easy ? 0.78 : 1); e.vx = Math.sin(a) * sp; e.vy = Math.cos(a) * sp; }
      } else { e.x += e.vx * dt; e.y += e.vy * dt; }
    } else if (k === "shield" || k === "stealth") {
      e.y += e.vy * dt; e.x = clamp(e.x0 + Math.sin(e.t * (k === "stealth" ? 1.4 : 0.9) + e.ph) * (k === "stealth" ? 90 : 40), 20, W - 20);
      if (k === "stealth") e.vis = Math.sin(e.t * 3 + e.ph) > -0.25;
    } else if (k === "splitter") { e.y += e.vy * dt; e.x = clamp(e.x0 + Math.sin(e.t * 1.2 + e.ph) * 30, 20, W - 20); }
    else if (k === "mini") { e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= 0.995; }
    else if (k === "comet") { e.x += e.vx * dt; e.y += e.vy * dt; }
    else if (k === "balloon") { e.y += e.vy * dt; e.x = clamp(e.x0 + Math.sin(e.t * 1.6 + e.ph) * 18, 20, W - 20); }
    else if (k === "bomber") {
      if (e.t < 12) { e.y = Math.min(e.y + 60 * dt, 90); e.x += (e.vx || 60) * dt; if (e.vx === 0) e.vx = 60; if (e.x < 40 || e.x > W - 40) { e.vx = -e.vx; e.x = clamp(e.x, 40, W - 40); } }
      else e.y += 110 * dt;
      e.cd -= dt;
      if (e.cd <= 0 && e.y > 40 && e.t < 12 && s.ebullets.length < MAX_EBULLETS) { e.cd = (s.easy ? 2.8 : 1.9); s.ebullets.push({ x: e.x, y: e.y + 12, vx: 0, vy: 52, r: 8, mine: true, g: false }); evs.push({ t: "shoot", x: e.x, y: e.y }); }
    } else if (k === "mother") {
      if (e.t < 15) { e.y = Math.min(e.y + 50 * dt, 95); e.x = W / 2 + Math.sin(e.t * 0.6 + e.ph) * 110; } else e.y -= 120 * dt;
      e.cd -= dt;
      if (e.cd <= 0 && e.t < 15 && e.y > 40) { e.cd = fireGap(s) * 0.8; e.atk++; const tx0 = e.x + (e.atk % 2 ? -20 : 20); eShoot(s, tx0, e.y + 12, evs, Math.atan2(s.ship.x - tx0, Math.max(40, s.ship.y - e.y)), bs); }
    } else if (k === "flyer") { e.y += e.vy * dt; }
    if ((k === "flyer" || k === "shield" || k === "stealth") && e.y > 20 && e.y < H * 0.68 && e.vis) {
      e.cd -= dt;
      if (e.cd <= 0) { eShoot(s, e.x, e.y + 8, evs, k === "flyer" ? 0 : Math.atan2(s.ship.x - e.x, Math.max(30, s.ship.y - e.y)), k === "flyer" ? bs * 0.9 : bs); e.cd = fireGap(s) * (k === "flyer" ? 1.5 : 1) * (0.8 + rnd(s) * 0.4); }
    }
    if (k === "mother" ? e.y < -e.r - 30 && e.t > 15 : k !== "boss" && (e.y > H + e.r + 20 || e.x < -80 || e.x > W + 80 || e.y < -260)) { const i = s.enemies.indexOf(e); if (i >= 0) s.enemies.splice(i, 1); }
  }
  // the player's bullets (the black hole bends them)
  for (const b of s.bullets) {
    b.age += dt; b.life -= dt;
    if (b.kind === "homing") { const t = nearestTarget(s, b.x, b.y); if (t) { const sp = Math.hypot(b.vx, b.vy) || 420, cur = Math.atan2(b.vx, -b.vy), want = Math.atan2(t.x - b.x, -(t.y - b.y)); let da = want - cur; while (da > Math.PI) da -= 6.2832; while (da < -Math.PI) da += 6.2832; const na = cur + clamp(da, -5 * dt, 5 * dt); b.vx = Math.sin(na) * sp; b.vy = -Math.cos(na) * sp; } }
    if (s.hole) { const hx = s.hole.x - b.x, hy = s.hole.y - b.y, hd = Math.hypot(hx, hy) || 1; if (hd < 150) { const a = 900 * (1 - hd / 150) * dt; b.vx += (hx / hd) * a; b.vy += (hy / hd) * a; } if (hd < 12) b.life = -1; }
    if (b.kind === "wave") { b.y += b.vy * dt; b.x = b.x0 + Math.sin(b.age * 9) * (24 + s.wl * 3); } else { b.x += b.vx * dt; b.y += b.vy * dt; }
  }
  for (const b of s.bullets) {
    if (b.life <= 0) continue;
    for (const e of s.enemies) {
      if (e.y < -e.r * 0.3 || !e.vis || b.hits.includes(e.id)) continue;
      if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + b.r) { if (b.kind === "wave") b.hits.push(e.id); else b.life = -1; damage(s, e, b.dmg, evs, false, b.x, b.y); if (b.kind !== "wave") break; }
    }
  }
  s.bullets = s.bullets.filter((b) => b.life > 0 && b.y > -14 && b.x > -14 && b.x < W + 14 && b.y < H + 14);
  // enemy bullets and bodies against the ship
  const sr = shipR(s);
  for (const b of s.ebullets) {
    if (s.hole) { const hx = s.hole.x - b.x, hy = s.hole.y - b.y, hd = Math.hypot(hx, hy) || 1; if (hd < 150) { const a = 700 * (1 - hd / 150) * dt; b.vx += (hx / hd) * a; b.vy += (hy / hd) * a; } if (hd < 12) b.y = H + 99; }
    b.x += b.vx * dt; b.y += b.vy * dt;
  }
  for (const b of s.ebullets) {
    if (b.y > H + 20) continue;
    const dd = Math.hypot(b.x - s.ship.x, b.y - s.ship.y);
    if (dd < sr + b.r) { if (s.inv <= 0 && !s.over) { b.y = H + 99; hurt(s, evs); } }
    else if (!b.g && dd < sr + b.r + 16 && !s.over) { b.g = true; s.grazes++; s.score += 5; evs.push({ t: "graze" }); }
  }
  s.ebullets = s.ebullets.filter((b) => b.y > -20 && b.y < H + 20 && b.x > -20 && b.x < W + 20);
  if (s.inv <= 0 && !s.over) {
    for (const e of s.enemies.slice()) {
      if (e.y < -e.r * 0.3 || e.kind === "balloon" || !e.vis) continue;
      if (Math.hypot(e.x - s.ship.x, e.y - s.ship.y) < e.r * 0.8 + sr) { hurt(s, evs); if (e.kind !== "boss") damage(s, e, 4, evs); break; }
    }
  }
  // coins and capsules
  const mr = s.magnet > 0 ? 9999 : s.run.up.magnet > 0 ? 60 + 50 * s.run.up.magnet : 0;
  for (const c of s.coins) {
    const dd = Math.hypot(s.ship.x - c.x, s.ship.y - c.y) || 1;
    if (dd < mr) { c.x += ((s.ship.x - c.x) / dd) * 420 * dt; c.y += ((s.ship.y - c.y) / dd) * 420 * dt; }
    else { c.vy = Math.min(120, c.vy + 300 * dt); c.vx *= 0.985; c.x += c.vx * dt; c.y += c.vy * dt; }
  }
  const keep: Coin[] = [];
  for (const c of s.coins) { if (Math.hypot(c.x - s.ship.x, c.y - s.ship.y) < 24) { s.score += 10; s.coinsGot++; evs.push({ t: "coin" }); } else if (c.y < H + 12 && c.x > -20 && c.x < W + 20) keep.push(c); }
  s.coins = keep;
  const keepP: Pup[] = [];
  for (const p of s.pups) {
    p.t += dt; p.y += 75 * dt; p.x = clamp(p.x0 + Math.sin(p.t * 2) * 14, 16, W - 16);
    if (Math.hypot(p.x - s.ship.x, p.y - s.ship.y) < 26) pickup(s, p.kind, evs);
    else if (p.y < H + 16) keepP.push(p);
  }
  s.pups = keepP;
  // the end of a level: the boss falls apart (explosions, coins rain), then the level is cleared
  if (s.bossDead && !s.over) {
    const dy = s.dying!;
    dy.t += dt; dy.boomT += dt; dy.rainT += dt;
    while (dy.boomT >= 0.12) { dy.boomT -= 0.12; evs.push({ t: "boom", x: dy.x + (rnd(s) - 0.5) * 80, y: dy.y + (rnd(s) - 0.5) * 60 }); }
    while (dy.rainT >= 0.1) { dy.rainT -= 0.1; if (s.coins.length < MAX_COINS) s.coins.push({ x: 20 + rnd(s) * (W - 40), y: -8, vx: 0, vy: 60 }); }
    s.clearT -= dt;
    if (s.clearT <= 0) {
      s.cleared = true; s.run.wallet += s.coinsGot; s.run.score = s.score; s.run.lives = s.lives; s.run.weapon = s.weapon; s.run.wl = s.wl;
      evs.push({ t: "clear" });
    }
  }
  return evs;
}

/** a simple bot (tests and demos): stand under the lowest enemy (the boss core), keep away from bullets, bodies, lasers and bolts, take capsules, bomb when surrounded */
export function botInput(s: State): Input {
  const sx = s.ship.x;
  let gx = W / 2, low = -1e9;
  for (const e of s.enemies) if (e.y > -10 && e.y < s.ship.y - 30 && e.y > low && e.kind !== "mother") { low = e.y; gx = e.x; }
  if (s.boss) gx = s.boss.x;
  for (const p of s.pups) if (p.y > H * 0.3 && Math.abs(p.x - sx) < 140) gx = p.x;
  const ys = [H - 150, H - 100, H - 60];
  let bx = sx, by = s.ship.y, bc = 1e18;
  for (let cx = 20; cx <= W - 20; cx += 10) {
    for (const cy of ys) {
      let cost = Math.abs(cx - gx) * 0.05 + Math.abs(cx - sx) * 0.03 + Math.abs(cy - s.ship.y) * 0.01;
      const reach = Math.hypot(cx - sx, cy - s.ship.y) / 480;
      for (const tau of [0.12, 0.25, 0.4, 0.55]) {
        if (tau < reach * 0.6) continue;
        for (const b of s.ebullets) { const rr = 26 + b.r, dd = Math.hypot(b.x + b.vx * tau - cx, b.y + b.vy * tau - cy); if (dd < rr) cost += (rr - dd) * (rr - dd); }
        for (const e of s.enemies) { if (e.kind === "balloon") continue; const rr = e.r + 20, dd = Math.hypot(e.x + e.vx * tau - cx, e.y + e.vy * tau - cy); if (dd < rr) cost += (rr - dd) * (rr - dd) * 0.6; }
      }
      for (const h of s.haz) { const rem = h.warn + h.dur - h.t; if (rem > 0 && Math.abs(cx - h.x) < h.w + 14) cost += 60000; }
      if (s.boss && s.boss.dash) { if (Math.abs(cx - s.boss.dash.tx) < 60) cost += 30000; }
      if (cost < bc) { bc = cost; bx = cx; by = cy; }
    }
  }
  let near = 0;
  for (const b of s.ebullets) if (Math.hypot(b.x - sx, b.y - s.ship.y) < 45) near++;
  return { tx: bx, ty: by, bomb: near >= 3 || (s.boss !== null && s.boss.hp < s.boss.maxhp * 0.2 && s.bombs >= 2) };
}
