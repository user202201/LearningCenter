/**
 * Sokoban (推箱子), pure rules: no DOM, no timer.
 * A level is drawn as text: "#" wall, " " floor, "." target, "$" box, "*" box on a target, "@" pusher, "+" pusher on a target.
 * Cells are numbered y * w + x. The pusher moves one cell; walking into a box pushes it one cell when the cell behind it is free
 * (not a wall, not another box). Every step is kept in `history`, so undo is unlimited.
 */
export type Dir = "U" | "D" | "L" | "R";
export const DIRS: Dir[] = ["U", "D", "L", "R"];
export const VEC: Record<Dir, { x: number; y: number }> = { U: { x: 0, y: -1 }, D: { x: 0, y: 1 }, L: { x: -1, y: 0 }, R: { x: 1, y: 0 } };

export interface LevelDef { id: string; rows: string[]; /** the shortest solution in moves (steps), proved by the BFS in tests/e2e/56-sokoban.cjs */ opt: number }
export interface Level { w: number; h: number; wall: boolean[]; goal: boolean[]; start: number; boxes: number[] }
export interface Step { dir: Dir; pushed: boolean }
export interface SokState { level: Level; player: number; boxes: number[]; facing: Dir; moves: number; pushes: number; history: Step[] }
export interface MoveResult { moved: boolean; pushed: boolean; /** the pushed box: from / to cell */ from?: number; to?: number; blocked?: "wall" | "box"; /** a box was in the way (the push failed), not just a wall */ boxHit?: boolean }

export function parseLevel(rows: string[]): Level {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const wall: boolean[] = [], goal: boolean[] = [], boxes: number[] = [];
  let start = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = rows[y][x] ?? "#", i = y * w + x;
    wall.push(c === "#"); goal.push(c === "." || c === "*" || c === "+");
    if (c === "$" || c === "*") boxes.push(i);
    if (c === "@" || c === "+") start = i;
  }
  return { w, h, wall, goal, start, boxes };
}

export function newGame(level: Level): SokState {
  return { level, player: level.start, boxes: level.boxes.slice(), facing: "D", moves: 0, pushes: 0, history: [] };
}

/** the cell one step from `i` in direction `d`, or -1 when that leaves the picture */
export function neighbour(l: Level, i: number, d: Dir): number {
  const x = (i % l.w) + VEC[d].x, y = Math.floor(i / l.w) + VEC[d].y;
  return x < 0 || y < 0 || x >= l.w || y >= l.h ? -1 : y * l.w + x;
}

export function move(s: SokState, d: Dir): MoveResult {
  const l = s.level, n = neighbour(l, s.player, d);
  s.facing = d;
  if (n < 0 || l.wall[n]) return { moved: false, pushed: false, blocked: "wall" };
  const bi = s.boxes.indexOf(n);
  if (bi < 0) { s.player = n; s.moves++; s.history.push({ dir: d, pushed: false }); return { moved: true, pushed: false }; }
  const t = neighbour(l, n, d);
  if (t < 0 || l.wall[t]) return { moved: false, pushed: false, blocked: "wall", boxHit: true };
  if (s.boxes.includes(t)) return { moved: false, pushed: false, blocked: "box", boxHit: true };
  s.boxes[bi] = t; s.player = n; s.moves++; s.pushes++; s.history.push({ dir: d, pushed: true });
  return { moved: true, pushed: true, from: n, to: t };
}

/** takes the last step back (a pushed box goes back too); false when there is nothing to undo */
export function undo(s: SokState): boolean {
  const st = s.history.pop();
  if (!st) return false;
  const l = s.level, back = neighbour(l, s.player, opposite(st.dir));
  if (st.pushed) { const bi = s.boxes.indexOf(neighbour(l, s.player, st.dir)); s.boxes[bi] = s.player; s.pushes--; }
  s.player = back; s.moves--; s.facing = st.dir;
  return true;
}

export const opposite = (d: Dir): Dir => (d === "U" ? "D" : d === "D" ? "U" : d === "L" ? "R" : "L");
export const onGoal = (s: SokState, box: number): boolean => s.level.goal[box];
export const boxesDone = (s: SokState): number => s.boxes.filter((b) => s.level.goal[b]).length;
export const won = (s: SokState): boolean => s.boxes.length > 0 && s.boxes.every((b) => s.level.goal[b]);

/** 1 to 3 stars from the moves used against the shortest solution */
export function stars(moves: number, opt: number): number { return moves <= opt ? 3 : moves <= Math.ceil(opt * 1.5) ? 2 : 1; }

/** the shortest solution (BFS over pusher + boxes, one move = one step); null when none is found within `maxNodes` states */
export function solve(level: Level, maxNodes = 3_000_000): { moves: number; path: Dir[] } | null {
  const key = (p: number, bs: number[]) => String.fromCharCode(p, ...bs);
  const s0 = newGame(level);
  const goalOk = (bs: number[]) => bs.every((b) => level.goal[b]);
  if (goalOk(s0.boxes)) return { moves: 0, path: [] };
  const sortedStart = s0.boxes.slice().sort((a, b) => a - b);
  const seen = new Map<string, { prev: string; d: Dir }>();
  const k0 = key(s0.player, sortedStart);
  seen.set(k0, { prev: "", d: "U" });
  let frontier: { p: number; bs: number[]; k: string }[] = [{ p: s0.player, bs: sortedStart, k: k0 }];
  while (frontier.length) {
    const next: typeof frontier = [];
    for (const f of frontier) {
      for (const d of DIRS) {
        const n = neighbour(level, f.p, d);
        if (n < 0 || level.wall[n]) continue;
        let bs = f.bs;
        const bi = bs.indexOf(n);
        if (bi >= 0) {
          const t = neighbour(level, n, d);
          if (t < 0 || level.wall[t] || bs.includes(t)) continue;
          bs = bs.slice(); bs[bi] = t; bs.sort((a, b) => a - b);
        }
        const k = key(n, bs);
        if (seen.has(k)) continue;
        seen.set(k, { prev: f.k, d });
        if (bi >= 0 && goalOk(bs)) {
          const path: Dir[] = []; let c = k;
          while (c !== k0) { const r = seen.get(c)!; path.push(r.d); c = r.prev; }
          return { moves: path.length, path: path.reverse() };
        }
        next.push({ p: n, bs, k });
      }
      if (seen.size > maxNodes) return null;
    }
    frontier = next;
  }
  return null;
}

/** the levels, easy to medium, in three groups of eight (入门 / 进阶 / 挑战). Every one is proved solvable by the suite, `opt` = its shortest solution. */
export const LEVELS: LevelDef[] = [
  { id: "l01", opt: 9, rows: ["########", "#      #", "# .##  #", "#      #", "#  $@  #", "###  ###", "########"] },
  { id: "l02", opt: 15, rows: ["########", "##   @##", "# .    #", "# # $# #", "#      #", "# #### #", "########"] },
  { id: "l03", opt: 17, rows: ["#########", "## .   ##", "##     ##", "#   #  @#", "### #$###", "#       #", "#  # #  #", "#########"] },
  { id: "l04", opt: 24, rows: ["#######", "#@    #", "##  $##", "#   $ #", "#  .  #", "# .   #", "#     #", "#######"] },
  { id: "l05", opt: 30, rows: ["#######", "#@    #", "# #$# #", "#  $  #", "#.    #", "#   . #", "#     #", "#######"] },
  { id: "l06", opt: 37, rows: ["#########", "#+  #   #", "#     $ #", "#       #", "#       #", "#   # $ #", "# .###  #", "#########"] },
  { id: "l07", opt: 40, rows: ["#########", "# #.  # #", "#  $# $ #", "#       #", "##     ##", "#   .   #", "#@ # #  #", "#########"] },
  { id: "l08", opt: 48, rows: ["###########", "#        @#", "##       ##", "#  #   #  #", "#.#  .  # #", "#$.$ # $$ #", "#  .      #", "###########"] },
  { id: "l09", opt: 53, rows: ["#########", "## . . ##", "##$ # $##", "##  #  ##", "#       #", "#@   .$ #", "#########"] },
  { id: "l10", opt: 59, rows: ["############", "##    . $ ##", "# $$$##    #", "##    ..  ##", "#  ######  #", "#.         #", "#          #", "#   @      #", "############"] },
  { id: "l11", opt: 65, rows: ["###########", "#    #@   #", "# $#####. #", "# $   .   #", "# $$   . .#", "#    #    #", "###########"] },
  { id: "l12", opt: 66, rows: ["###########", "#  #   #@ #", "# $  #    #", "# #    .#.#", "#      .  #", "## $ # $ ##", "#  #   #  #", "###########"] },
  { id: "l13", opt: 67, rows: ["###########", "##  # #  ##", "#@#   . # #", "# $$#$#  .#", "#    .    #", "#    #    #", "###########"] },
  { id: "l14", opt: 67, rows: ["##########", "# #    # #", "# $$   $ #", "#        #", "#        #", "##  .   ##", "#* ####  #", "#+ .     #", "##########"] },
  { id: "l15", opt: 76, rows: ["##########", "#     @  #", "# ###### #", "# $ $ $. #", "# #   $# #", "#.   .   #", "#.  ##   #", "#        #", "##########"] },
  { id: "l16", opt: 77, rows: ["#########", "#+#   #.#", "#   #   #", "#       #", "# #   # #", "#     $ #", "##$   $##", "#  .    #", "#########"] },
  { id: "l17", opt: 78, rows: ["###########", "##       ##", "#   #$#   #", "##  .$ $ ##", "#  #  .#  #", "## # #$# ##", "# .#.  # @#", "###########"] },
  { id: "l18", opt: 83, rows: ["###########", "#@        #", "#.$ # #  .#", "#$.$ # .  #", "# $       #", "##  # #  ##", "###########"] },
  { id: "l19", opt: 85, rows: ["##########", "#   .  $ #", "#   ##$  #", "#     $ .#", "# # ## #$#", "# . .   @#", "##########"] },
  { id: "l20", opt: 85, rows: ["##########", "# .####  #", "#    @$ $#", "# $$##  .#", "# # ##.#.#", "#        #", "# ##  ## #", "##########"] },
  { id: "l21", opt: 92, rows: ["##########", "#  # .#  #", "#     $$ #", "#  #  #  #", "#@. ##   #", "### $  ###", "# .      #", "##########"] },
  { id: "l22", opt: 97, rows: ["############", "##@#    # ##", "#  $$  $.  #", "# #      #.#", "# #      # #", "# # #### #$#", "#    . .   #", "############"] },
  { id: "l23", opt: 98, rows: ["###########", "## $.   .##", "## #@  # ##", "#  ## ##  #", "##   #   ##", "## . # $ ##", "###    $###", "#         #", "###########"] },
  { id: "l24", opt: 110, rows: ["############", "#  ######  #", "# #@     # #", "#  #    #  #", "# $$ ##    #", "#  #   .#$ #", "#   ####.$ #", "#      .  .#", "############"] },
];
export const GROUPS = 3;
export const PER_GROUP = 8;
