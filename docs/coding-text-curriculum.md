# 编程 (Coding) — text coding, worlds 11-13 (phase 2)

Written by a model from memory; a teacher of 信息科技 / informatics must proofread it (levels, wording, the mapping to the standard). No textbook, workbook or contest text is copied: every task is original.

## 1. Aim

Worlds 1-6 teach *thinking in programs* with blocks. Worlds 11-13 are the **bridge to real written code** for children of about grades 5-9: a small, strict subset of Python 3
("Python 入门", English keywords, indentation blocks) that runs inside the app, offline, with the same results as real Python (the test suite compares 500+ programs with `python3`).
A child writes a program in a touch-friendly editor, runs it with an own input, submits it against hidden tests, steps through it line by line with a variables window,
and ends with small projects (guess the number, bank account, text adventure ...) and a free workshop.

## 2. The language (what a level may use)

| Area | Supported |
|---|---|
| Values | int (any size), float (Python's repr), str, bool, None, list, tuple, dict, set, range |
| Operators | `+ - * / // % **` (floor division and modulo of negatives as in Python), comparisons (also chained), `and or not`, `in`, `not in`, `is`, conditional expression, `+=` etc. |
| Statements | assignment (also `a, b = b, a`), `if / elif / else`, `while`, `for ... in`, `break`, `continue`, `pass`, `def` (default arguments, `return`, recursion, `global`), `import`, `from ... import`, `del`, `assert`, lambda, comprehensions |
| Built-ins | `print` (`sep`, `end`), `input`, `len range int float str bool list tuple dict set abs min max sum sorted reversed enumerate zip map filter any all round pow divmod ord chr isinstance type` |
| Strings | indexing, slicing (also with step), f-strings (format specs `.2f`, `>8`, `05d`, `,`, `%`, `=`), `%` and `.format`, 30 methods (`upper lower split join replace find strip startswith isdigit ...`) |
| Lists / dicts | `append pop insert remove sort reverse index count copy extend`; `get keys values items update setdefault pop`; sets: `add remove union intersection` |
| Modules | `random` (CPython's Mersenne Twister: the same numbers as real Python after `random.seed(n)`), `math`, `turtle` (`forward backward left right penup pendown color goto circle begin_fill ...`, `turtle.Turtle()`, `from turtle import *`) |
| Not taught | classes, `try / except`, files, `with`, generators, decorators, imports of other modules (a clear message says so) |

Errors are friendly Chinese messages with the line number, the kind and a hint: missing colon, `=` instead of `==`, Chinese punctuation, `print` without brackets, bad indentation,
unclosed bracket / quote, undefined name with a "did you mean" suggestion, wrong types (`"a" + 1`, `input()` is text), division by zero, index out of range, missing key, endless loop (step budget), too deep recursion.
Safety: a step budget (statements, loop turns, calls), a call-depth limit of 200, an output limit, size guards for `**` and `*`; no `eval`.

## 3. Mapping to the 2022 义务教育信息科技课程标准 (逻辑主线 and 内容模块)

| Standard | Where it is taught |
|---|---|
| 算法 (5-6 年级: 描述问题解决过程，体验算法; 7-9 年级: 用程序实现算法，变量、数据结构、迭代、分支) | World 11 (sequence, branches, loops, variables), world 12 (functions, lists, dictionaries), world 13 (search, sort, number algorithms) |
| 过程与控制 (3-4 / 5-6 / 7-9: 顺序、分支、循环结构的程序; 用流程控制解决问题) | World 11 levels 8-15, world 12 levels 11-12 |
| 数据与编码 (7-9: 数据类型、变量、数据结构的表示) | World 11 levels 4-7 (types, input), world 12 levels 4-10 (lists, strings, dictionaries), world 13 levels 7-9 (text processing, encoding: Caesar cipher) |
| 跨学科主题 (数学: 数与运算、图形与几何; 程序设计解决数学问题) | World 11 levels 3, 10, 14; world 12 levels 13-17 (polygons, exterior angle 360 / n, star, spiral); world 13 levels 4-6 (primes, gcd, Fibonacci) |
| 项目学习 / 综合实践 (7-9: 设计、编写、调试一个小程序) | World 13 levels 10-16 (guess the number, rock-paper-scissors, bank account, text adventure, to-do list, grade report, factorisation) and the 代码工坊 |
| 调试与测试 (程序的运行与调试) | The three "找错误" levels, the hidden test cases, the stepper (`单步`: current line + variables) |

## 4. How a level works

* **Task** (Chinese, content): statement, input / output format, one example (the first test case). **Starter**: blanks `___`, a bug, or only comments.
* **运行** runs the program with the child's own input (the 输入 box, one line per `input()`), shows the output or the error (the failing line is underlined in the editor).
  **提交** runs every hidden case. Pass / fail is shown per case; for the first failing case the input, the expected and the own output (or the error, or the drawing against the grey target).
  Comparison: line endings unified, spaces at the end of a line and empty lines at the end ignored, everything else exact. Drawing levels compare the drawn segments (`coding-turtle.ts`).
* Some levels add a **call** (code appended after the child's program that calls the child's functions) and some add rules: a **step budget** (efficiency: a correct but slow program fails),
  a **forbidden word** (`sort`, `index`), a function that **must call itself** (recursion).
* **Hints** appear one by one ("提示"); **看答案** is offered after 3 failed submits and limits the level to 1 star.
* **Stars:** 1 = all cases pass, +1 = the program is at most 1.6 x as long as the reference (tokens: comments and layout do not count), +1 = it passed at the first submit. After the reference was shown: 1.
  The shortest size is kept in `coding/<kid>.json` (`blocks[levelId]`, here = tokens). Merged between devices by the larger star count (no change of the merge rule).
* **Mini-lessons** (18, `coding-textlessons.ts`): a short text and a runnable, editable example ("试一试"); the first level that needs a concept opens its lesson, `?` opens it again. The first lesson of world 11 ("先拼积木，再看代码") shows a block program beside its Python text.

## 5. The levels

Notation: kind = 编程 (write), 填空 (blanks), 找错误 (debug), 画图 (draw); ⏱ = step budget (efficiency), 🔒 = a rule.

### World 11 文字编程入门 — 15 levels (colour teal)

| Id | Title | Kind | Concept (Python content of a first course) |
|---|---|---|---|
| t11-01 | 第一行代码 | 填空 | `print`, string literal |
| t11-02 | 三行诗 | 编程 | several `print` calls, one line each |
| t11-03 | 算一算 | 编程 | arithmetic, precedence, `//` `%` `**` |
| t11-04 | 变量 | 填空 | variables, assignment, expressions |
| t11-05 | 交换变量 | 编程 | `input`, `int`, swapping (`a, b = b, a`) |
| t11-06 | 文字拼接 | 编程 | strings, `+`, f-strings |
| t11-07 | 找错误：类型 | 找错误 | `input()` is text: `int()` |
| t11-08 | 谁更大 | 编程 | `if / else`, comparison |
| t11-09 | 成绩等级 | 编程 | `if / elif / else`, boundaries |
| t11-10 | 闰年 | 编程 | `and / or`, modulo |
| t11-11 | 找错误：顺序 | 找错误 | order of `elif` branches (debugging) |
| t11-12 | while 循环 | 编程 | `while`, counter, accumulator |
| t11-13 | for 循环 | 编程 | `for ... in range(a, b)` |
| t11-14 | 循环加判断 | 编程 | loop + condition, sum of multiples |
| t11-15 | 数字三角形 | 编程 | nested loops, building strings (challenge) |

### World 12 函数与列表 — 17 levels (colour indigo)

| Id | Title | Kind | Concept |
|---|---|---|---|
| t12-01 | 第一个函数 | 填空 | `def`, `return` (called by hidden test code) |
| t12-02 | 两个参数 | 编程 | parameters, two functions |
| t12-03 | 返回对错 | 编程 | returning a bool |
| t12-04 | 列表入门 | 编程 | `input().split()`, list of ints, `min max sum` |
| t12-05 | 平均数 | 编程 | function over a list, accumulator, `/` |
| t12-06 | 去掉重复 | 编程 | new list, `not in`, `append`, order kept |
| t12-07 | 找错误：范围 | 找错误 | off-by-one in `range` |
| t12-08 | 数元音 | 编程 | loop over a string, `lower`, `in` |
| t12-09 | 回文 | 编程 | slicing `[::-1]`, `isalnum`, normalising |
| t12-10 | 字典：数单词 | 编程 | `dict`, `get`, `sorted` |
| t12-11 | 嵌套循环：乘法表 | 编程 | nested loops, f-strings, `join` |
| t12-12 | 递归：阶乘 | 编程 🔒 | recursion (the function must call itself) |
| t12-13 | 画正方形 | 画图 | `turtle.forward / right`, loop |
| t12-14 | 多边形函数 | 画图 | function with parameters that draws, angle 360 / n |
| t12-15 | 五角星 | 画图 | angles (144°), loop |
| t12-16 | 方形螺旋 | 画图 | loop variable in the length |
| t12-17 | 花朵 | 画图 | nested loops, rotation (challenge) |

### World 13 算法与小项目 — 16 levels (colour raspberry)

| Id | Title | Kind | Concept |
|---|---|---|---|
| t13-01 | 线性查找 | 编程 | linear search, `break`, first occurrence, -1 |
| t13-02 | 二分查找 | 编程 ⏱🔒 | binary search on 5000 numbers (budget 700 steps; `index` forbidden) |
| t13-03 | 手写排序 | 编程 🔒 | bubble / selection sort (`sort`, `sorted` forbidden) |
| t13-04 | 素数 | 编程 ⏱ | primes up to 5000: trial division to √n or a sieve (budget 400 000 steps) |
| t13-05 | 最大公约数 | 编程 ⏱ | Euclid's algorithm (numbers up to 10⁹, budget 300 steps) |
| t13-06 | 斐波那契 | 编程 ⏱ | iteration instead of double recursion (budget 500 steps) |
| t13-07 | 凯撒密码 | 编程 | `ord / chr`, modulo, encoding of text |
| t13-08 | 变位词 | 编程 | `sorted` on strings, normalising |
| t13-09 | 高频单词 | 编程 | dictionary counting, `sorted` with `key=lambda`, tie rules |
| t13-10 | 猜数字 | 编程 | `random` (seeded in the tests), `while True`, `break` |
| t13-11 | 石头剪刀布 | 编程 | dictionary of rules, tally |
| t13-12 | 银行账户 | 编程 | commands loop, one variable of state (no classes) |
| t13-13 | 文字冒险 | 编程 | dictionary of dictionaries, state machine |
| t13-14 | 待办清单 | 编程 | list as state, `startswith`, slicing, `pop` |
| t13-15 | 成绩单 | 编程 | tuples, `sorted` with `key`, formatting `:.1f` |
| t13-16 | 毕业：质因数分解 | 编程 ⏱ | trial division to √n, inner `while`, output format (budget 900 000 steps) |

## 6. The 代码工坊 (`#/coding/<kid>/code`)

A free editor with a console, an input box, a drawing area, the stepper, 7 templates (hello, input and calculation, guess the number, grade calculator, flower, multiplication table, to-do list),
**up to 20 saved snippets per child on this device** (save, rename by saving again, open, delete with a confirmation) and "积木作品": a saved drawing of the block world is turned into Python (the bridge `coding-textbridge.ts`).

## 7. Not finished / for the teacher

* All 48 tasks, hints, starter codes, the mini-lessons and this mapping are model-written from memory: please check wording, difficulty order, the grade mapping and that every hint helps without giving the answer away.
* The interpreter's error messages are Chinese only (shown in a content box in English / French too).
* Real fingers on the editor (selection handles, the iOS keyboard bar, autocorrect) are not tested; see rule 61.
