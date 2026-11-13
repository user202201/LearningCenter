/**
 * Breakout: the rules as pure functions (no DOM). The board is 480 x 640 logical units; `step(s, dt, px)` advances the game by dt seconds with the paddle centre at px
 * and returns the events that happened (the screen turns them into sounds and sparkles). A ball is a unit direction (dx, dy) times the speed of the game, so a bounce
 * can never change the speed; every ball moves in sub-steps of at most 3 units, which is far less than a brick (22 units) or the ball (20 units), so nothing tunnels.
 */
export const W = 480, H = 640, COLS = 10, BW = 46, BH = 22, BX0 = 10, BY0 = 64, ROWH = 24;
export const PY = 596, PH = 20, PW = 96, PW_WIDE = 150, BR = 10, MAXLIVES = 5, START_LIVES = 3, MAXV = 560, CAP_R = 13, CAP_V = 130, MAXBALLS = 6;
export const WIDE_TIME = 14, SLOW_TIME = 10, STICKY_CATCHES = 3, STICKY_AUTO = 2.2, MAXANG = (62 * Math.PI) / 180;

export type PowerKind = "wide" | "slow" | "multi" | "life" | "sticky";
export const POWERS: PowerKind[] = ["wide", "slow", "multi", "life", "sticky"];
export interface Brick { c: number; r: number; x: number; y: number; w: number; h: number; hp: number; maxhp: number; gold: boolean; color: number; power: PowerKind | null }
export interface Ball { x: number; y: number; dx: number; dy: number; stuck: boolean; off: number; sticky: boolean }
export interface Cap { x: number; y: number; kind: PowerKind }
export interface State {
  level: number; bricks: Brick[]; balls: Ball[]; caps: Cap[]; px: number; lives: number; score: number; speed: number; base: number;
  wideT: number; slowT: number; sticky: number; stuckT: number; alive: boolean; cleared: boolean; over: boolean; time: number; hits: number; breakable: number;
}
export type Ev =
  | { t: "wall" } | { t: "paddle" } | { t: "launch" } | { t: "hit"; x: number; y: number; color: number } | { t: "break"; x: number; y: number; color: number }
  | { t: "gold"; x: number; y: number } | { t: "catch"; kind: PowerKind } | { t: "drop"; kind: PowerKind } | { t: "lost"; lives: number } | { t: "clear" } | { t: "over" };

/**
 * Brick patterns, 10 columns. '.' nothing; '1'..'6' = a brick that breaks with one hit (colour 1..6); 'A'..'F' = a brick that needs two hits (colour 1..6);
 * 'G' = an unbreakable gold brick (it only bounces the ball; a level is cleared when every other brick is gone).
 */
export const LEVELS: string[][] = [
  ["..........", "1111111111", "2222222222", "3333333333", "4444444444"],
  ["....11....", "...2222...", "..333333..", ".44444444.", "5555555555"],
  ["1.2.3.4.5.", ".2.3.4.5.1", "2.3.4.5.1.", ".3.4.5.1.2", "3.4.5.1.2.", ".4.5.1.2.3"],
  ["1111111111", "..........", "2222222222", "..........", "3333333333", "..........", "4444444444"],
  [".11....11.", "1111..1111", "1111111111", "1111111111", ".11111111.", "..111111..", "...1111...", "....11...."],
  ["..333333..", ".33333333.", "3366333366", "3366333366", "3333333333", "3133333313", "3311111133", ".33111133.", "..333333.."],
  ["AAAAAAAAAA", "2222222222", "3333333333", "4444444444", "5555555555"],
  ["G........G", "G22222222G", "G33333333G", "G.DDDDDD.G", "G.55555..G"],
  ["....GG....", "...3333...", "..BB22BB..", ".33333333.", "..BB22BB..", "...4444...", "....GG...."],
  ["1G2G3G4G5.", "1.2.3.4.5.", "1G2G3G4G5.", "1.2.3.4.5.", "1.2.3.4.5."],
  ["11111.....", ".AAAAA....", "..33333...", "...BBBBB..", "....55555.", ".....CCCCC", "6666......"],
  ["G.A.A.A.AG", ".6.6.6.6..", "A.5.5.5.A.", ".4.4.4.4..", "A.3.3.3.AG", "..2.2.2.2.", "G1.1.1.1.G"],
];
export const LEVEL_COUNT = LEVELS.length;

function mulberry(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const baseSpeed = (level: number) => 300 + 14 * (level - 1);
export const paddleW = (s: State) => (s.wideT > 0 ? PW_WIDE : PW);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function makeBricks(level: number): Brick[] {
  const pat = LEVELS[clamp(level, 1, LEVEL_COUNT) - 1], rnd = mulberry(7919 * level + 13), out: Brick[] = [];
  let life = 0;
  for (let r = 0; r < pat.length; r++) for (let c = 0; c < COLS; c++) {
    const ch = pat[r][c];
    if (!ch || ch === ".") continue;
    const gold = ch === "G", two = ch >= "A" && ch <= "F", color = gold ? 0 : two ? ch.charCodeAt(0) - 64 : Number(ch);
    const b: Brick = { c, r, x: BX0 + c * BW + 1, y: BY0 + r * ROWH + 1, w: BW - 2, h: BH, hp: gold ? 99 : two ? 2 : 1, maxhp: gold ? 99 : two ? 2 : 1, gold, color, power: null };
    if (!gold && rnd() < 0.17) {
      const x = rnd() * 11;
      let kind: PowerKind = x < 3 ? "wide" : x < 5 ? "slow" : x < 8 ? "multi" : x < 10 ? "sticky" : "life";
      if (kind === "life") { if (life >= 1) kind = "multi"; else life++; }
      b.power = kind;
    }
    out.push(b);
  }
  return out;
}

export function newLevel(level: number, lives = START_LIVES, score = 0): State {
  const bricks = makeBricks(level), base = baseSpeed(level);
  const s: State = { level, bricks, balls: [], caps: [], px: W / 2, lives, score, speed: base, base, wideT: 0, slowT: 0, sticky: 0, stuckT: 0, alive: true, cleared: false, over: false, time: 0, hits: 0, breakable: bricks.filter((b) => !b.gold).length };
  s.balls.push(serveBall(s));
  return s;
}
function serveBall(s: State): Ball { return { x: s.px, y: PY - BR - 0.5, dx: 0, dy: -1, stuck: true, off: 0, sticky: false }; }
export const speedNow = (s: State) => Math.min(MAXV, s.speed) * (s.slowT > 0 ? 0.7 : 1);

function fixDir(b: Ball) {
  if (Math.abs(b.dy) < 0.18) { b.dy = b.dy < 0 || b.dy === 0 ? -0.18 : 0.18; }
  const l = Math.hypot(b.dx, b.dy); b.dx /= l; b.dy /= l;
}
/** release every ball that sits on the paddle (a tap / Space) */
export function launch(s: State): Ev[] {
  const ev: Ev[] = [];
  if (!s.alive) return ev;
  for (const b of s.balls) if (b.stuck) {
    const a = Math.abs(b.off) < 0.04 ? 0.18 : b.off * 0.9;
    b.dx = Math.sin(a); b.dy = -Math.cos(a); b.stuck = false; b.sticky = false; ev.push({ t: "launch" });
  }
  return ev;
}
const rotate = (b: Ball, a: number): Ball => { const n: Ball = { ...b, dx: b.dx * Math.cos(a) - b.dy * Math.sin(a), dy: b.dx * Math.sin(a) + b.dy * Math.cos(a), stuck: false, sticky: false }; fixDir(n); return n; };

function applyPower(s: State, kind: PowerKind) {
  if (kind === "wide") s.wideT = WIDE_TIME;
  else if (kind === "slow") s.slowT = SLOW_TIME;
  else if (kind === "life") s.lives = Math.min(MAXLIVES, s.lives + 1);
  else if (kind === "sticky") s.sticky = STICKY_CATCHES;
  else {
    launch(s);
    const src = s.balls.find((b) => !b.stuck);
    if (src) for (const a of [-0.45, 0.45]) if (s.balls.length < MAXBALLS) s.balls.push(rotate(src, a));
  }
}

function brickHit(s: State, b: Ball, ev: Ev[]): boolean {
  let best: Brick | null = null, bd = Infinity, bcx = 0, bcy = 0;
  for (const k of s.bricks) {
    if (b.x < k.x - BR || b.x > k.x + k.w + BR || b.y < k.y - BR || b.y > k.y + k.h + BR) continue;
    const cx = clamp(b.x, k.x, k.x + k.w), cy = clamp(b.y, k.y, k.y + k.h), d2 = (b.x - cx) ** 2 + (b.y - cy) ** 2;
    if (d2 < BR * BR && d2 < bd) { best = k; bd = d2; bcx = cx; bcy = cy; }
  }
  if (!best) return false;
  let nx = b.x - bcx, ny = b.y - bcy;
  if (bd < 1e-9) {   // centre inside the brick (cannot happen with small sub-steps, but never trust it): leave by the nearest side
    const l = b.x - best.x, r = best.x + best.w - b.x, t = b.y - best.y, bo = best.y + best.h - b.y, m = Math.min(l, r, t, bo);
    nx = m === l ? -1 : m === r ? 1 : 0; ny = m === t ? -1 : m === bo ? 1 : 0; if (nx && ny) ny = 0;
    b.x = clamp(b.x + nx * (m + BR), BR, W - BR); b.y += ny * (m + BR);
  } else { const d = Math.sqrt(bd); b.x = bcx + (nx / d) * (BR + 0.01); b.y = bcy + (ny / d) * (BR + 0.01); }
  // flip the axis of the larger part of the normal, only when the ball moves towards the brick
  if (Math.abs(nx) >= Math.abs(ny)) { if (b.dx * nx < 0) b.dx = -b.dx; } else if (b.dy * ny < 0) b.dy = -b.dy;
  b.x = clamp(b.x, BR, W - BR); b.y = Math.max(BR, b.y);
  fixDir(b);
  const cxm = best.x + best.w / 2, cym = best.y + best.h / 2;
  if (best.gold) { ev.push({ t: "gold", x: cxm, y: cym }); return true; }
  best.hp--; s.score += best.hp <= 0 ? 10 : 5;
  if (best.hp <= 0) {
    s.bricks.splice(s.bricks.indexOf(best), 1);
    ev.push({ t: "break", x: cxm, y: cym, color: best.color });
    if (best.power) { s.caps.push({ x: cxm, y: cym, kind: best.power }); ev.push({ t: "drop", kind: best.power }); }
    if (!s.bricks.some((k) => !k.gold)) { s.cleared = true; s.alive = false; s.score += 100 + 50 * s.lives; ev.push({ t: "clear" }); }
  } else ev.push({ t: "hit", x: cxm, y: cym, color: best.color });
  return true;
}

export function step(s: State, dt: number, px: number): Ev[] {
  const ev: Ev[] = [];
  if (!s.alive) return ev;
  s.time += dt;
  const hw = paddleW(s) / 2;
  s.px = clamp(px, hw, W - hw);
  s.wideT = Math.max(0, s.wideT - dt); s.slowT = Math.max(0, s.slowT - dt);
  // balls on the paddle follow it; a sticky one lets go by itself after a moment
  let anySticky = false;
  for (const b of s.balls) if (b.stuck) { b.x = s.px + b.off * hw; b.y = PY - BR - 0.5; if (b.sticky) anySticky = true; }
  if (anySticky) { s.stuckT += dt; if (s.stuckT >= STICKY_AUTO) { s.stuckT = 0; ev.push(...launch(s)); } } else s.stuckT = 0;
  // falling capsules
  for (let i = s.caps.length - 1; i >= 0; i--) {
    const c = s.caps[i]; c.y += CAP_V * dt;
    if (c.y + CAP_R >= PY && c.y - CAP_R <= PY + PH && Math.abs(c.x - s.px) <= hw + CAP_R) { s.caps.splice(i, 1); applyPower(s, c.kind); s.score += 20; ev.push({ t: "catch", kind: c.kind }); }
    else if (c.y > H + CAP_R) s.caps.splice(i, 1);
  }
  { const nhw = paddleW(s) / 2; s.px = clamp(s.px, nhw, W - nhw); }   // a capsule may have just widened the paddle
  const v = speedNow(s);
  for (let i = s.balls.length - 1; i >= 0 && s.alive; i--) {
    const b = s.balls[i];
    if (b.stuck) continue;
    const n = Math.max(1, Math.ceil((v * dt) / 3)), h = dt / n;
    let lost = false;
    for (let k = 0; k < n && s.alive; k++) {
      b.x += b.dx * v * h; b.y += b.dy * v * h;
      let wall = false;
      if (b.x < BR) { b.x = BR; if (b.dx < 0) b.dx = -b.dx; wall = true; } else if (b.x > W - BR) { b.x = W - BR; if (b.dx > 0) b.dx = -b.dx; wall = true; }
      if (b.y < BR) { b.y = BR; if (b.dy < 0) b.dy = -b.dy; wall = true; }
      if (wall) { fixDir(b); ev.push({ t: "wall" }); }
      brickHit(s, b, ev);
      if (b.dy > 0 && b.y + BR >= PY && b.y <= PY + PH * 0.5 && b.x >= s.px - hw - BR * 0.5 && b.x <= s.px + hw + BR * 0.5) {
        const off = clamp((b.x - s.px) / hw, -1, 1), a = off * MAXANG;
        b.dx = Math.sin(a); b.dy = -Math.cos(a); b.y = PY - BR; s.hits++; s.speed = Math.min(s.base + 110, s.speed + 4);
        ev.push({ t: "paddle" });
        if (s.sticky > 0) { s.sticky--; b.stuck = true; b.sticky = true; b.off = off; s.stuckT = 0; break; }
      }
      if (b.y - BR > H) { lost = true; break; }
    }
    if (lost) s.balls.splice(i, 1);
  }
  if (s.alive && s.balls.length === 0) {
    s.lives--; s.caps = []; s.wideT = 0; s.slowT = 0; s.sticky = 0;
    if (s.lives <= 0) { s.alive = false; s.over = true; ev.push({ t: "lost", lives: 0 }, { t: "over" }); }
    else { s.balls.push(serveBall(s)); ev.push({ t: "lost", lives: s.lives }); }
  }
  return ev;
}

// ---------- a deterministic bot (used by the tests to prove that every level can be cleared) ----------
export interface Bot { aim: number; hits: number; seed: number; delay: number }
export const makeBot = (seed = 1): Bot => ({ aim: 0, hits: -1, seed, delay: 0 });
function botRnd(bot: Bot) { bot.seed = (bot.seed * 1664525 + 1013904223) >>> 0; return bot.seed / 4294967296; }
/** where the bot wants the paddle, and whether it taps to launch */
export function botControl(s: State, bot: Bot): { px: number; launch: boolean } {
  if (bot.hits !== s.hits) { bot.hits = s.hits; bot.aim = (botRnd(bot) * 2 - 1) * 0.75; }
  const hw = paddleW(s) / 2;
  let target = s.px, ball: Ball | null = null;
  for (const b of s.balls) if (!b.stuck && b.dy > 0 && (!ball || b.y > ball.y)) ball = b;
  if (ball) {
    const ty = PY - BR, span = W - 2 * BR;
    let x = ball.x + (ball.dx / ball.dy) * (ty - ball.y) - BR;
    x = ((x % (2 * span)) + 2 * span) % (2 * span); if (x > span) x = 2 * span - x;
    target = x + BR - bot.aim * hw;
  } else {
    const free = s.balls.find((b) => !b.stuck);
    if (free) target = free.x;
  }
  const stuck = s.balls.some((b) => b.stuck);
  if (stuck) bot.delay++; else bot.delay = 0;
  return { px: target, launch: stuck && bot.delay > 6 };
}
/** plays one level with the bot; the paddle moves at most `vmax` units a second */
export function simulate(level: number, opt: { seed?: number; vmax?: number; maxTime?: number; lives?: number; check?: (s: State) => void } = {}) {
  const s = newLevel(level, opt.lives ?? START_LIVES), bot = makeBot(opt.seed ?? 1), dt = 1 / 120, vmax = opt.vmax ?? 1100, maxT = opt.maxTime ?? 900;
  let px = s.px, steps = 0, lostBalls = 0; const counts: Record<string, number> = {};
  while (s.alive && s.time < maxT) {
    const c = botControl(s, bot);
    if (c.launch) launch(s);
    const d = clamp(c.px - px, -vmax * dt, vmax * dt); px += d;
    for (const e of step(s, dt, px)) { counts[e.t] = (counts[e.t] || 0) + 1; if (e.t === "lost") lostBalls++; }
    px = s.px; steps++;
    opt.check?.(s);
  }
  return { cleared: s.cleared, over: s.over, time: s.time, steps, lives: s.lives, score: s.score, lostBalls, counts, state: s };
}
