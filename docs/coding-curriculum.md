# 编程 (Coding) — curriculum, phase 1

Written by a model from memory; a teacher of 信息科技 must proofread it. No textbook or workbook text is copied: every level is original.

## 1. Aim and shape

A child learns to *think in programs*: give a machine a precise list of steps, repeat steps, decide, name a recipe, remember a number, and finally draw with code.
Phase 1 is a level-by-level adventure (闯关) with **block programming** (6 worlds, 76 levels, plus random practice and a free drawing canvas).
Phase 2 (not built yet) adds **text coding** and **algorithm worlds** on the same engine: the block program is a plain AST, it is shown as text
(`toText`, the same syntax that `parse` reads), levels are data with a reference solution, and a world is a list of levels plus a palette of allowed blocks.
A text-coding world only needs a text editor that calls `parse`, the same interpreter and the same judging.

Everything runs inside the app (no network): the interpreter, the levels, the generators, the pictures.

## 2. Mapping to the 2022 义务教育信息科技课程标准

| Standard (逻辑主线 / 内容模块) | Where it is taught |
|---|---|
| 过程与控制 (3-4 年级: 体验顺序、循环、分支结构的程序) | World 1 sequence, World 2 loops, World 3 conditions (grades 1-4 introduction, 3-4 core) |
| 过程与控制 (5-6 年级: 简单算法、用流程控制解决问题, 自动化) | World 3 (while, sensors, general programs), World 4 functions |
| 算法 (5-6 年级: 描述问题解决过程, 体验算法; 7-9: 变量、数据结构、迭代) | World 5 variables and counting, generality levels (one program for many maps), the step-by-step debugger |
| 数据与编码 (数的表示、变量; 7-9) | World 5 (number variables, arithmetic), World 6 (angles, coordinates, repeat of repeats) |
| 跨学科 (数学: 图形与几何) | World 6: regular polygons, exterior angle 360 / n, star polygons, circles as many short sides |

Grades: worlds 1-2 suit grades 1-4, world 3 grades 3-6, worlds 4-5 grades 5-8, world 6 grades 4-9 (the geometry grows with the child).
A child can enter any world. The world map only *recommends* an order (a glow on the first world that is not finished; with no progress, the child's grade is used when known: grades 1-4 world 1, 5-6 world 2, 7-9 world 3).

## 3. The programming concepts

| Concept id | Word | First shown |
|---|---|---|
| `seq` | sequence: steps run in order, one after the other; a bug = a wrong, missing or misplaced step | World 1 |
| `loop` | repeat N times (a pattern) | World 2 level 1 |
| `until` | repeat until a condition holds (unknown length) | World 2 level 8 |
| `nest` | a loop inside a loop | World 2 level 7 |
| `if` | if a sensor says yes, do something | World 3 level 1 |
| `ifelse` | if / else, chains of decisions | World 3 level 3 |
| `while` | repeat while a condition holds | World 3 level 8 |
| `general` | one program must work on every map of a family | World 3 |
| `func` | define a block of your own, call it many times | World 4 level 1 |
| `param` | a function with a number parameter | World 4 level 5 |
| `var` | a variable: set, change, compare, a score | World 5 |
| `arith` | arithmetic with variables (+ - ×) | World 5 level 4 |
| `turtle` | the pen draws: forward n, turn a degrees | World 6 |
| `pen` | pen up / down, colour | World 6 level 9 |

Mini-lessons (3-4 illustrated steps with a running demo) open each world and each concept the first time a level uses it (they can be opened again with the ? button).

## 4. Rules of every level

* **Mistakes:** the robot crashes when it walks into a wall, and also when it takes a star or lights a lamp where there is none (so that “if there is a star here” has a reason to exist). The message says which.
* A level is data: a map (or a target picture), the allowed blocks, the maximum number of blocks, the reference solution (written in the pseudo-code syntax), the goal.
* **Stars:** 3 stars = the program uses at most `par` blocks (par = the blocks of the reference solution; for the small levels of worlds 1-2 a brute-force search over every shorter program proves that none exists; in world 3 the search found cleverer shorter programs for five levels, the teaching solution stays par there), 2 stars = at most 1.5 x par, otherwise 1 star.
  A level solved after "看答案" (the reference was shown) gives at most 1 star. The best block count is kept.
* **Block count:** every block counts 1, also loops, conditions, calls, `set` / `change`; the header of a definition does not count.
* **Hints:** "提示" lights the next block the reference needs (or marks a wrong / extra block); "看答案" is offered after 3 failed runs and shows the reference as blocks.
* **Failing is information:** a crash shows where (the block lights up, the robot shakes); an endless program is stopped with a message (a step budget plus an exact repeat-of-state detector).
* Generality levels (marked ⚙) are judged on the shown map and on five hidden maps of the same family: the program must solve them all.
* No flattery texts. A finished world gives a medal (drawn in code) on the trophy shelf of the world map.

## 5. The levels

Notation: pseudo-code of the reference. `n / max` = blocks used / allowed.

### World 1 顺序 (sequence) — blocks: move, left, right, take, light — 12 levels

| # | Title | Goal | Concept |
|---|---|---|---|
| 1 | 出发 | walk 3 steps to the flag | commands run in order |
| 2 | 转弯 | turn right at a corner | turning is a command |
| 3 | 向左转 | turn left | left vs right |
| 4 | 楼梯 | zig-zag up a staircase | long sequences (prepares loops) |
| 5 | 拿星星 | pick up a star on the way | take |
| 6 | 两颗星 | two stars in an L | order of take and move |
| 7 | 开灯 | switch on a lamp, then the flag | light |
| 8 | 星星和灯 | star, lamp and flag in a U | planning |
| 9 | 找错误 | debugging: a left that should be a right | bug = wrong step |
| 10 | 少了一步 | debugging: the takes are missing | bug = missing step |
| 11 | 顺序错了 | debugging: light comes too early | bug = wrong order |
| 12 | 总复习 | three stars, a lamp, a long winding path | boss |

### World 2 循环 (loops) — adds repeat (and until from level 8) — 14 levels

| # | Title | Reference | Concept |
|---|---|---|---|
| 1 | 重复走 | `repeat 6 { move }` | repeat |
| 2 | 绕一圈 | `repeat 4 { move move take right }` | a pattern with a turn |
| 3 | 楼梯 | `repeat 4 { move left move right }` | the staircase of W1-4 with a loop |
| 4 | 收集一排 | `repeat 5 { move take }` `move` | take inside a loop |
| 5 | 隔一格拿星星 | `repeat 3 { move move take }` `move` | the unit can be longer |
| 6 | 两个循环 | `repeat 3 { move }` `right` `repeat 2 { move }` | two loops in a row |
| 7 | 方形一圈 | `repeat 4 { repeat 3 { move } take right }` | nested loops |
| 8 ⚙ | 直到终点 | `until onFlag { move }` (length 3-9) | repeat until |
| 9 ⚙ | 不知道几级台阶 | `until onFlag { move left move right }` (2-6 steps) | until with a pattern |
| 10 ⚙ | 一路拿星星 | `until onFlag { take move }` | until with take |
| 11 | 两行星星 | `repeat 2 { repeat 3 { take move } take right move right }` | nested loops, a snake |
| 12 | 星星楼梯 | `repeat 4 { move take left move right }` | loop with several commands |
| 13 | 绕圈拿星 | `repeat 4 { repeat 2 { move take } right }` | the whole ring |
| 14 | 循环大挑战 | `repeat 3 { move left move right }` `light` `repeat 3 { move }` | boss |

### World 3 条件 (conditions) — adds if, if-else, while, sensors — 14 levels

Sensors: 前方有路, 左边有路, 右边有路, 脚下有星星, 脚下有灯, 在终点, 脚下是红色 / 绿色, and "没有" (not) of each.

| # | Title | Family (random each time, ⚙) | Reference | Concept |
|---|---|---|---|---|
| 1 | 有路就走 | a corridor of 3-7 cells | `repeat 8 { if pathAhead { move } }` | if keeps the robot from crashing |
| 2 | 有星星就拿 | a corridor with stars in random cells | `repeat 6 { if starHere { take } move }` | if on a sensor |
| 3 | 只右转 | a spiral with right turns | `until onFlag { ifelse pathAhead { move } { right } }` | if-else |
| 4 | 左右都行 | a winding corridor | `until onFlag { ifelse pathAhead { move } { ifelse pathLeft { left } { right } } }` | chained decisions |
| 5 | 颜色路标 | a corridor, red corner = turn right, green = left | `until onFlag { move if colorIs(r) { right } if colorIs(g) { left } }` | a colour sensor |
| 6 | 拐弯收集 | a winding corridor with stars | (4 + a star check) | two decisions per step |
| 7 | 迷宫 | a 3 x 3 perfect maze | `until onFlag { ifelse pathRight { right move } { ifelse pathAhead { move } { left } } }` | the right-hand rule |
| 8 | 走到尽头 | two straight pieces | `while pathAhead { move } right while pathAhead { move }` | while |
| 9 | 星星串 | a run of 2-6 stars, then the flag | `while starHere { take move }` | while on a sensor |
| 10 | 路灯 | lamps in random cells | `repeat 6 { if lightHere { light } move }` | if with another sensor |
| 11 | 两段路 | two pieces of random length | `while pathAhead { move } left while pathAhead { move }` | one program, many maps |
| 12 | 更大的迷宫 | a 4 x 4 perfect maze | right-hand rule | generality |
| 13 | 星星和灯 | a winding corridor with stars and lamps | 10 blocks | combining decisions |
| 14 | 终极迷宫 | a 4 x 4 maze, stars on the way out | right-hand rule + take | boss |

### World 4 函数 (functions) — adds define / call (parameter of one number from level 5; no recursion yet) — 12 levels

Function names are Latin (the code bridge). The palette of the first levels has no `repeat`, so that a function is the shortest way.

| # | Title | Idea |
|---|---|---|
| 1 | 第一个积木 | `step = move take`, called three times |
| 2 | 调用多次 | `corner = move move take right`, four calls make a ring of stars |
| 3 | 积木里的循环 | a function that contains a loop |
| 4 | 拐角收集 | calls separated by turns |
| 5 | 带数字的积木 | `walk(n)`: one parameter |
| 6 | 数字参数二 | `line(n)` collects n stars |
| 7 | 不同的长度 | `walk(n)` with growing n |
| 8 | 螺旋 | a function that calls a function |
| 9 | 函数调用函数 | two functions, nested calls |
| 10 | 把一段做成积木 | find the repeated piece yourself |
| 11 | 积木复用 | three rooms, one function |
| 12 | 函数大挑战 | boss |

### World 5 变量和计数 (variables) — adds set / change / compare, arithmetic — 10 levels

| # | Title | Idea |
|---|---|---|
| 1 | 计数 | count steps with a variable |
| 2 | 数星星 | `while count < 4 { take change count by 1 move }` |
| 3 | 分数 | each star is 2 points |
| 4 | 加法 | `set s = a + b`, walk s steps |
| 5 | 乘法 | `set s = a * b` |
| 6 | 倒数 | count down to zero |
| 7 ⚙ | 拿够就停 | take exactly 3 of a random row of stars |
| 8 | 够了才点灯 | `if count >= 5 { light }` |
| 9 | 加倍 | `n = n * 2` |
| 10 | 综合 | `repeat 4 { move take change score by 2 } move if score >= 8 { light } move` (boss) |

### World 6 画图 (turtle graphics) — adds fd, turn, pen, colour — 14 levels

The canvas is 200 x 200 units, the pen starts in the middle looking up. A picture is judged by comparing the **drawn segments** with those of the reference solution:
every point of one drawing must lie within 3 units of the other drawing (and the colours must match when the level asks for colours).

| # | Title | Reference | Concept |
|---|---|---|---|
| 1 | 画一条线 | `fd 80` | forward n |
| 2 | 画直角 | `fd 60 tr 90 fd 60` | turn by degrees |
| 3 | 正方形 | 4 x (`fd 60 tr 90`) without loop | long program |
| 4 | 用循环画正方形 | `repeat 4 { fd 60 tr 90 }` | loop = shorter |
| 5 | 三角形 | `repeat 3 { fd 60 tr 120 }` | exterior angle 360 / 3 |
| 6 | 正五边形 | `repeat 5 { fd 50 tr 72 }` | 360 / 5 |
| 7 | 正六边形 | `repeat 6 { fd 50 tr 60 }` | 360 / 6 |
| 8 | 圆 | `repeat 36 { fd 6 tr 10 }` | many short sides |
| 9 | 两个正方形 | squares joined by `penup fd 70 pendown` | pen up / down |
| 10 | 彩色图形 | a red square and a blue triangle | colour |
| 11 | 五角星 | `repeat 5 { fd 80 tr 144 }` | star polygon (turn 720 / 5) |
| 12 | 螺旋 | `set n = 5 repeat 16 { fd n tl 90 change n by 5 }` | variable in a drawing |
| 13 | 花 | `def square(s) {...}` `repeat 12 { square(40) tr 30 }` | function + loop of a loop |
| 14 | 旋转的三角形 | `repeat 8 { repeat 3 { fd 40 tr 120 } tr 45 }` | boss |

**创作 (free drawing):** any program; "保存" keeps up to 12 drawings on this device (thumbnails; deleting asks first).

## 6. Random practice (worlds 1-3, "随机挑战")

Always solvable, never trivial (the reference needs at least 3 blocks / commands), never the same level twice in a row.
* World 1: a random room (random walls, start, flag, 0-3 stars, 0-1 lamp); a breadth-first search over (position, direction, stars taken, lamps lit) gives the shortest command list (= par) and proves it is solvable.
* World 2: a random pattern `repeat k { unit }` is generated first; the map is made by walking the route; the generated program is the reference.
* World 3: a random member of a family of maps (corridors, spirals, colour paths, mazes, stars, lamps); the family's general program is the reference and is run on the map.

## 7. Engine and data (for phase 2)

* `coding-ast.ts`: `Program { main, funcs }`, blocks with ids, `parse(text)` / `toText(program)` (the pseudo-code), `countBlocks`, `nextHint`.
* `coding-interp.ts`: `Machine` (explicit stack, one block per `step()`, step budget, exact repeat-of-state detection, recursion limit), grid world and turtle world, `judge`.
* `coding-turtle.ts`: segment comparison and drawing helpers.
* `coding-levels.ts`: all levels as data, the map families and the random generators.
* A new world = more `LEVELS` entries with `world: 7`; a text-coding world = a level with `editor: "text"` (phase 2) whose solution is already in `parse` syntax.

## 8. Phase 2, block extension: worlds 7-10 (event stories, functions and recursion, lists, algorithms)

Written by a model from memory; a 信息科技 teacher must proofread it. 56 new levels (14 per world), all original, on the engine of phase 1 (the block program is still a plain AST, `toText` / `parse` write and read it).
Same rules as section 4 (stars by par, hints, answer after three failures, no flattery); the mini-lessons are in `src/coding-lessons2.ts` (24 lessons).

| Standard (逻辑主线) | Where it is taught |
|---|---|
| 过程与控制 (事件、并发的程序, 交互) | World 7 (events, sprites, messages, waiting, a step clock) |
| 算法 (函数、参数、返回值、递归、分治) | World 8 |
| 数据与编码 (列表、遍历、统计、数据结构) | World 9 |
| 算法 (查找、排序、贪心、图、效率比较; 7-9 年级) | World 10 |

New kinds of level (registered in `coding-levels.ts` `KINDS`): `stage` (judged on scripted taps / keys: the states of the sprites at given ticks are compared with the reference's, within a tolerance; random positions are judged by ranges on three seeds)
and `data` (the program runs on the shown instance and five hidden random ones; the named variables / lists must equal what the reference leaves; some levels also judge the number of steps: at most 1.5 x the reference's + 12, the weighings of the balance scale or the swaps).
The robot (worlds 8-10) and the turtle (world 8) levels use the old kinds with a family of maps / a picture.

### World 7 事件与故事 (stage; blocks: event hats, go / turn / go to, say, wait, note, costume, size, broadcast, repeat, forever, if, variables)
1 出发 (go 100) · 2 说话 · 3 等一等 (wait 1 s) · 4 点一下 (tap hat) · 5 按键 (key hats) · 6 走路动画 (repeat + costume) · 7 时钟 (forever) · 8 随机跳 (random number, judged by ranges) · 9 两个朋友 (broadcast / receive) · 10 小故事 (three scripts, say for seconds) · 11 音乐 (notes and beats) · 12 宠物跟着点击 (tap position) · 13 小测验 (score) · 14 接苹果 (a catch game: keys held, touching, a message).
Time: one tick = 1/20 s; a loop gives the other scripts their turn at the end of every round; `wait 1` = 20 ticks.

### World 8 函数进阶与递归 (blocks: functions with several parameters, return, calls inside values, recursion)
1 两个数字 (turtle: rect(a, b)) · 2 返回数字 · 3 三个参数 · 4 较大的数 · 5 偶数吗 · 6 函数调用函数 · 7 自己调用自己 (robot) · 8 停止条件 (sum 1..n) · 9 阶乘 · 10 斐波那契 · 11 画一棵树 · 12 雪花曲线 · 13 三角形里的三角形 (Sierpinski) · 14 递归大挑战 (power, digit sum).
The function levels show the tests of the function (fixed main program, hidden tests with other numbers) and, while stepping, the call stack with its depth. The recursion limit is 400 frames ("积木调用得太深").

### World 9 列表与数据 (blocks: add, set item, for, for each, values built from lists)
1 建立列表 · 2 第几项 · 3 有多长 · 4 求和 · 5 最大值 · 6 最小值 · 7 计数 · 8 筛选偶数 · 9 查找 · 10 地板上的数字 (numbers on the tiles, `floorNum`) · 11 平均数 · 12 出现最多的数 · 13 购物清单 · 14 凑十游戏 (loop in a loop).

### World 10 算法
1 顺序查找 (steps limit) · 2 二分查找 (64 sorted numbers, steps limit) · 3 选择排序 · 4 冒泡排序 · 5 插入排序 · 6 少换几次 (swaps limit) · 7 贪心找零 · 8 最大公约数 (Euclid, steps limit) · 9 质数吗 (steps limit) · 10 最短路线 (BFS on a graph) · 11 沿着左墙走 (left-hand rule) · 12 天平找最重 (≤ 7 weighings) · 13 天平排序 (≤ 10) · 14 合并两个队伍 (merge, steps limit).

### Engine additions (pure, all in `src/`)
`coding-ast.ts`: lists (`add(xs, v)`, `setItem`, `removeItem`, `swap`, `clear`, `len / sum / max / min / has / count / indexOf / item`), `for i = a to b`, `each x in xs`, `forever`, `return`, calls with several arguments inside values (`f(a, b)`), `/` `%` `and` `or`, `floor / abs / sqrt / round / rand / minOf / maxOf`, graph and scale reporters (`deg`, `nbr`, `heavier`), stage blocks (`smove`, `sturn`, `goto`, `changex`, `changey`, `say`, `sayfor`, `costume`, `nextcostume`, `size`, `show`, `hide`, `note`, `broadcast`, `wait`, `waitUntil`), event scripts (`on start cat { ... }`, `on key(left) cat`, `on recv(go) dog`, `on tap`, `on stagetap`).
`coding-interp.ts`: a call inside a value is a call of its own that is shown on the stack (the machine runs the call first, one step each); `return` leaves the function; short-circuit `and` / `or`; faults (division by 0, a missing item) stop the program with a message; the exact endless-loop detector includes the lists and the sprites.
`coding-stage.ts`: the clock, the threads (a `Machine` each, sharing the stage), the scripted inputs and the judge. `coding-levels2.ts`: the levels, the generators of instances, the judges. `coding-play2.ts`: the screen of both kinds, the free story stage (12 stories on this device). `coding-views.ts`, `coding-art2.ts`: the pictures.
