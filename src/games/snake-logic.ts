/** Snake: the pure rules (no screen, no timer). The grid is w x h, the snake is a list of cells, the head first. */
export type Dir = "U" | "D" | "L" | "R";
export interface Pt { x: number; y: number }
export const VEC: Record<Dir, Pt> = { U: { x: 0, y: -1 }, D: { x: 0, y: 1 }, L: { x: -1, y: 0 }, R: { x: 1, y: 0 } };
export const OPPOSITE: Record<Dir, Dir> = { U: "D", D: "U", L: "R", R: "L" };
export type Rng = () => number;
export interface SnakeState {
  w: number; h: number; wrap: boolean;
  snake: Pt[]; dir: Dir; queue: Dir[]; food: Pt | null;
  score: number; eaten: number; alive: boolean; won: boolean;
  rng: Rng;
}
export interface StepResult { moved: boolean; ate: boolean; died: boolean; won: boolean; why?: "wall" | "self" }

export function newSnake(w: number, h: number, wrap: boolean, rng: Rng = Math.random, len = 3): SnakeState {
  if (w < len + 3 || h < 3) throw new Error("grid too small");
  const y = Math.floor(h / 2), hx = Math.floor(w / 2) + 1;
  const snake: Pt[] = [];
  for (let i = 0; i < len; i++) snake.push({ x: hx - i, y });
  const s: SnakeState = { w, h, wrap, snake, dir: "R", queue: [], food: null, score: 0, eaten: 0, alive: true, won: false, rng };
  s.food = placeFood(s);
  return s;
}

export const freeCells = (s: SnakeState): Pt[] => {
  const taken = new Set(s.snake.map((p) => p.y * s.w + p.x)), out: Pt[] = [];
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (!taken.has(y * s.w + x)) out.push({ x, y });
  return out;
};
export function placeFood(s: SnakeState): Pt | null {
  const free = freeCells(s);
  return free.length ? free[Math.min(free.length - 1, Math.floor(s.rng() * free.length))] : null;
}

/** asks for a turn; a turn straight back (or the same way) is refused; at most two turns wait (so two quick swipes make a U-turn in two steps) */
export function turn(s: SnakeState, d: Dir): boolean {
  if (!s.alive) return false;
  const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
  if (d === last || d === OPPOSITE[last] || s.queue.length >= 2) return false;
  s.queue.push(d);
  return true;
}

export function step(s: SnakeState): StepResult {
  if (!s.alive) return { moved: false, ate: false, died: false, won: s.won };
  if (s.queue.length) s.dir = s.queue.shift()!;
  const v = VEC[s.dir], head = s.snake[0];
  let nx = head.x + v.x, ny = head.y + v.y;
  if (nx < 0 || ny < 0 || nx >= s.w || ny >= s.h) {
    if (!s.wrap) { s.alive = false; return { moved: false, ate: false, died: true, won: false, why: "wall" }; }
    nx = (nx + s.w) % s.w; ny = (ny + s.h) % s.h;
  }
  const ate = !!s.food && s.food.x === nx && s.food.y === ny;
  const body = ate ? s.snake : s.snake.slice(0, -1);   // the tail moves away when nothing is eaten
  if (body.some((p) => p.x === nx && p.y === ny)) { s.alive = false; return { moved: false, ate: false, died: true, won: false, why: "self" }; }
  s.snake.unshift({ x: nx, y: ny });
  if (ate) {
    s.eaten++; s.score += 10;
    s.food = placeFood(s);
    if (!s.food) { s.won = true; s.alive = false; return { moved: true, ate: true, died: false, won: true }; }
  } else s.snake.pop();
  return { moved: true, ate, died: false, won: false };
}

/** milliseconds between two steps: level 1..5 is the speed chosen, every apple makes it a little faster (never below 60 ms) */
export const BASE_MS = [300, 240, 190, 150, 115];
export function interval(level: number, eaten: number, easy = false): number {
  const base = BASE_MS[Math.max(0, Math.min(BASE_MS.length - 1, level - 1))];
  return Math.round(Math.max(60, base * Math.pow(0.975, eaten)) * (easy ? 1.5 : 1));
}
