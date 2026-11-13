/**
 * 编程, text coding: the LEVELS of worlds 11-13 as DATA (written by a model from memory, original tasks; a 信息科技 / informatics teacher must proofread).
 * A level = a task, a starter code (blanks `___` or a bug), a reference solution, naive WRONG solutions (the tests must catch them), hidden test cases
 * (an input and / or a call that is appended to the code) and optional rules: a step budget (efficiency), words that must not be used, a function that
 * must call itself. The expected output of a case is whatever the reference prints (tests check it against real python3 where possible).
 * Worlds: 11 文字编程入门 (print ... for), 12 函数与列表 (def, lists, dicts, recursion, turtle drawing), 13 算法与小项目 (search, sort, primes ... projects).
 */
import { run } from "./coding-textrun";
export type TKind = "code" | "debug" | "fill" | "draw";
export interface TCase { input?: string; seed?: number; /** code appended after the child's program (a test that calls the child's functions) */ call?: string }
export interface TLevel {
  id: string; world: 11 | 12 | 13; no: number; title: string; kind: TKind; task: string; lesson?: string;
  starter: string; ref: string; wrong: string[]; cases: TCase[];
  /** step limit for EVERY case (an efficiency challenge: a slow solution runs out of steps) */
  budget?: number;
  /** names that must not appear in the program (the task says so) */
  forbid?: string[];
  /** the function that has to call itself (recursion levels) */
  recursive?: string;
  hints: string[]; boss?: boolean;
}
export const TEXT_WORLDS = [
  { id: 11, name: "文字编程入门", sub: "print、变量、判断、循环" },
  { id: 12, name: "函数与列表", sub: "函数、列表、字典、递归、画图" },
  { id: 13, name: "算法与小项目", sub: "查找、排序、素数和小项目" },
] as const;

// ---------- helpers that make test inputs ----------
const lines = (...xs: (string | number)[]) => xs.join("\n");
const seq = (a: number, b: number, step = 1): number[] => { const r: number[] = []; for (let i = a; step > 0 ? i <= b : i >= b; i += step) r.push(i); return r; };
const lcg = (seed: number) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const ints = (n: number, lo: number, hi: number, seed: number): number[] => { const r = lcg(seed); return Array.from({ length: n }, () => lo + Math.floor(r() * (hi - lo + 1))); };

const L: TLevel[] = [];
function lv(world: 11 | 12 | 13, no: number, title: string, kind: TKind, task: string, o: { lesson?: string; starter: string; ref: string; wrong: string[]; cases: TCase[]; hints: string[]; budget?: number; forbid?: string[]; recursive?: string; boss?: boolean }) {
  L.push({ id: `t${world}-${String(no).padStart(2, "0")}`, world, no, title, kind, task, ...o });
}

// =====================================================================================================
// WORLD 11  文字编程入门
// =====================================================================================================
lv(11, 1, "第一行代码", "fill", "让计算机显示一行文字：你好，世界\n\nprint(...) 的括号里放要显示的内容。文字要用英文引号括起来。", {
  lesson: "print", starter: `print(___)`,
  ref: `print("你好，世界")`, wrong: [`print("你好 世界")`, `print("你好，世界！")`],
  cases: [{}], hints: ["括号里要放一段文字，文字两边要有英文引号 \" \"。", "要显示的文字是：你好，世界（逗号是中文逗号）。", "答案：print(\"你好，世界\")"],
});
lv(11, 2, "三行诗", "code", "输出下面三行文字，每行用一个 print：\n春眠不觉晓\n处处闻啼鸟\n夜来风雨声", {
  starter: `# 用三个 print 输出三行诗\n`,
  ref: `print("春眠不觉晓")\nprint("处处闻啼鸟")\nprint("夜来风雨声")`, wrong: [`print("春眠不觉晓处处闻啼鸟夜来风雨声")`, `print("春眠不觉晓")\nprint("处处闻啼鸟")`],
  cases: [{}], hints: ["每个 print 输出一行，会自动换行。", "写三行 print(\"...\")。", "第一行：print(\"春眠不觉晓\")"],
});
lv(11, 3, "算一算", "code", "依次输出下面五个算式的结果，每个结果占一行：\n7 + 3 * 2\n(7 + 3) * 2\n17 // 5（整除）\n17 % 5（余数）\n2 ** 10（2 的 10 次方）", {
  lesson: "arith", starter: `print(7 + 3 * 2)\n`,
  ref: `print(7 + 3 * 2)\nprint((7 + 3) * 2)\nprint(17 // 5)\nprint(17 % 5)\nprint(2 ** 10)`, wrong: [`print(7 + 3 * 2)\nprint(7 + 3 * 2)\nprint(17 / 5)\nprint(17 % 5)\nprint(2 * 10)`, `print(13)\nprint(20)\nprint(3)\nprint(2)`],
  cases: [{}], hints: ["// 是整除，% 是余数，** 是乘方。", "括号里的先算。", "print(17 // 5) 输出 3。"],
});
lv(11, 4, "变量", "fill", "长方形的宽 w = 8，高 h = 5。先把面积存进变量 area，把周长存进变量 perimeter，再依次输出它们（各占一行）。", {
  lesson: "vars", starter: `w = 8\nh = 5\narea = ___\nperimeter = ___\nprint(area)\nprint(perimeter)`,
  ref: `w = 8\nh = 5\narea = w * h\nperimeter = 2 * (w + h)\nprint(area)\nprint(perimeter)`, wrong: [`w = 8\nh = 5\narea = w + h\nperimeter = w * h\nprint(area)\nprint(perimeter)`, `w = 8\nh = 5\narea = w * h\nperimeter = 2 * w + h\nprint(area)\nprint(perimeter)`],
  cases: [{}], hints: ["变量名 = 算式，例如 area = w * h。", "周长 = 2 乘以（宽加高）。", "perimeter = 2 * (w + h)"],
});
lv(11, 5, "交换变量", "code", "输入两行，分别是整数 a 和整数 b。交换它们的值后，先输出 a，再输出 b（各占一行）。\n\n提示：直接写 a = b 会丢掉 a 原来的值，可以借助第三个变量，或者写 a, b = b, a。", {
  starter: `a = int(input())\nb = int(input())\n# 在这里交换 a 和 b\nprint(a)\nprint(b)`,
  ref: `a = int(input())\nb = int(input())\na, b = b, a\nprint(a)\nprint(b)`, wrong: [`a = int(input())\nb = int(input())\na = b\nb = a\nprint(a)\nprint(b)`, `a = int(input())\nb = int(input())\nprint(a)\nprint(b)`],
  cases: [{ input: lines(3, 8) }, { input: lines(-5, 12) }, { input: lines(0, 0) }, { input: lines(100, 1) }],
  hints: ["先把 a 存到第三个变量 t 里。", "t = a，a = b，b = t。", "或者一行：a, b = b, a"],
});
lv(11, 6, "文字拼接", "code", "输入一行：一个名字。输出：你好，名字！\n例如输入 小明，输出：你好，小明！\n\n文字可以用 + 连起来，也可以用 f\"...{变量}...\"。", {
  lesson: "strings", starter: `name = input()\n`,
  ref: `name = input()\nprint("你好，" + name + "！")`, wrong: [`name = input()\nprint("你好，name！")`, `name = input()\nprint("你好，" + name)`],
  cases: [{ input: "小明" }, { input: "Tom" }, { input: "王小花" }, { input: "A" }],
  hints: ["input() 读到的是文字，直接放进变量 name。", "print(\"你好，\" + name + \"！\")", "也可以：print(f\"你好，{name}！\")"],
});
lv(11, 7, "找错误：类型", "debug", "输入两行，分别是两个整数，输出它们的和。\n下面的程序输出的结果不对（例如 3 和 4 得到 34）。请修改它。", {
  lesson: "input", starter: `a = input()\nb = input()\nprint(a + b)`,
  ref: `a = int(input())\nb = int(input())\nprint(a + b)`, wrong: [`a = input()\nb = input()\nprint(a + b)`, `a = int(input())\nb = int(input())\nprint(a - b)`],
  cases: [{ input: lines(3, 4) }, { input: lines(10, 25) }, { input: lines(-5, 8) }, { input: lines(0, 0) }],
  hints: ["input() 得到的是文字，文字相加是把它们连在一起。", "用 int() 把文字变成整数。", "a = int(input())"],
});
lv(11, 8, "谁更大", "code", "输入两行，分别是两个整数 a 和 b。输出较大的那个数。如果相等，输出这个数。", {
  lesson: "if", starter: `a = int(input())\nb = int(input())\nif a > b:\n    print(a)\n`,
  ref: `a = int(input())\nb = int(input())\nif a > b:\n    print(a)\nelse:\n    print(b)`, wrong: [`a = int(input())\nb = int(input())\nprint(a)`, `a = int(input())\nb = int(input())\nif a > b:\n    print(b)\nelse:\n    print(a)`],
  cases: [{ input: lines(3, 8) }, { input: lines(9, 2) }, { input: lines(5, 5) }, { input: lines(-4, -9) }],
  hints: ["用 if 比较 a 和 b。", "if 的下一行要缩进 4 个空格。", "else 写在和 if 对齐的位置，后面也要有冒号。"],
});
lv(11, 9, "成绩等级", "code", "输入一行：一个整数分数（0 到 100）。输出等级：\n90 分及以上：优秀\n75 到 89 分：良好\n60 到 74 分：及格\n低于 60 分：不及格", {
  starter: `score = int(input())\n`,
  ref: `score = int(input())\nif score >= 90:\n    print("优秀")\nelif score >= 75:\n    print("良好")\nelif score >= 60:\n    print("及格")\nelse:\n    print("不及格")`,
  wrong: [`score = int(input())\nif score > 90:\n    print("优秀")\nelif score > 75:\n    print("良好")\nelif score > 60:\n    print("及格")\nelse:\n    print("不及格")`, `score = int(input())\nif score >= 60:\n    print("及格")\nelif score >= 75:\n    print("良好")\nelif score >= 90:\n    print("优秀")\nelse:\n    print("不及格")`],
  cases: [{ input: "95" }, { input: "90" }, { input: "89" }, { input: "75" }, { input: "74" }, { input: "60" }, { input: "59" }, { input: "0" }, { input: "100" }],
  hints: ["从高到低依次检查：if、elif、elif、else。", "“90 分及以上”写成 score >= 90。", "先检查最高的等级，因为 95 分也满足 >= 60。"],
});
lv(11, 10, "闰年", "code", "输入一行：一个年份。如果是闰年，输出 闰年，否则输出 平年。\n闰年的规则：能被 4 整除但不能被 100 整除，或者能被 400 整除。", {
  starter: `year = int(input())\n`,
  ref: `year = int(input())\nif (year % 4 == 0 and year % 100 != 0) or year % 400 == 0:\n    print("闰年")\nelse:\n    print("平年")`,
  wrong: [`year = int(input())\nif year % 4 == 0:\n    print("闰年")\nelse:\n    print("平年")`, `year = int(input())\nif year % 4 == 0 and year % 100 != 0:\n    print("闰年")\nelse:\n    print("平年")`],
  cases: [{ input: "2024" }, { input: "2023" }, { input: "1900" }, { input: "2000" }, { input: "2100" }, { input: "1600" }, { input: "2026" }],
  hints: ["要同时用到 and 和 or，注意加括号。", "能被 4 整除：year % 4 == 0。", "(year % 4 == 0 and year % 100 != 0) or year % 400 == 0"],
});
lv(11, 11, "找错误：顺序", "debug", "输入一行：整数 n。从 1 数到 n，每个数输出一行：\n是 3 的倍数输出 Fizz，是 5 的倍数输出 Buzz，同时是 3 和 5 的倍数输出 FizzBuzz，其他输出数字本身。\n下面的程序在 n 不小于 15 时出错。请修改它。", {
  starter: `n = int(input())\nfor i in range(1, n + 1):\n    if i % 3 == 0:\n        print("Fizz")\n    elif i % 5 == 0:\n        print("Buzz")\n    elif i % 15 == 0:\n        print("FizzBuzz")\n    else:\n        print(i)`,
  ref: `n = int(input())\nfor i in range(1, n + 1):\n    if i % 15 == 0:\n        print("FizzBuzz")\n    elif i % 3 == 0:\n        print("Fizz")\n    elif i % 5 == 0:\n        print("Buzz")\n    else:\n        print(i)`,
  wrong: [`n = int(input())\nfor i in range(1, n + 1):\n    if i % 3 == 0:\n        print("Fizz")\n    elif i % 5 == 0:\n        print("Buzz")\n    elif i % 15 == 0:\n        print("FizzBuzz")\n    else:\n        print(i)`],
  cases: [{ input: "5" }, { input: "15" }, { input: "30" }, { input: "1" }],
  hints: ["if / elif 是从上往下检查的，第一个成立的就执行，后面的会被跳过。", "15 的倍数同时满足 % 3 和 % 5，应该先检查它。", "把 i % 15 == 0 这一段移到最前面。"],
});
lv(11, 12, "while 循环", "code", "输入一行：整数 n（n ≥ 1）。用 while 循环计算 1 + 2 + 3 + ... + n，输出结果。", {
  lesson: "while", starter: `n = int(input())\ntotal = 0\ni = 1\n`,
  ref: `n = int(input())\ntotal = 0\ni = 1\nwhile i <= n:\n    total += i\n    i += 1\nprint(total)`,
  wrong: [`n = int(input())\ntotal = 0\ni = 1\nwhile i < n:\n    total += i\n    i += 1\nprint(total)`, `n = int(input())\ntotal = 0\ni = 1\nwhile i <= n:\n    total += i\nprint(total)`],
  cases: [{ input: "1" }, { input: "10" }, { input: "100" }, { input: "7" }],
  hints: ["while 后面是条件：i <= n 成立就继续。", "循环里要让 i 增加，否则循环永远停不下来。", "total += i 和 i += 1 都要缩进。"],
});
lv(11, 13, "for 循环", "code", "输入一行：整数 n。用 for 循环依次输出 1 到 n 的平方，每个数一行。\n例如 n = 3 时输出 1、4、9。", {
  lesson: "for", starter: `n = int(input())\n`,
  ref: `n = int(input())\nfor i in range(1, n + 1):\n    print(i * i)`, wrong: [`n = int(input())\nfor i in range(n):\n    print(i * i)`, `n = int(input())\nfor i in range(1, n):\n    print(i * i)`],
  cases: [{ input: "3" }, { input: "1" }, { input: "6" }, { input: "10" }],
  hints: ["range(1, 4) 得到 1、2、3，不包括 4。", "要包括 n，应该写 range(1, n + 1)。", "for i in range(1, n + 1):"],
});
lv(11, 14, "循环加判断", "code", "输入一行：整数 n。输出 1 到 n 中，所有 3 的倍数或 5 的倍数的和（n = 10 时是 3 + 5 + 6 + 9 + 10 = 33）。", {
  starter: `n = int(input())\ntotal = 0\n`,
  ref: `n = int(input())\ntotal = 0\nfor i in range(1, n + 1):\n    if i % 3 == 0 or i % 5 == 0:\n        total += i\nprint(total)`,
  wrong: [`n = int(input())\ntotal = 0\nfor i in range(1, n + 1):\n    if i % 3 == 0 and i % 5 == 0:\n        total += i\nprint(total)`, `n = int(input())\ntotal = 0\nfor i in range(1, n):\n    if i % 3 == 0 or i % 5 == 0:\n        total += i\nprint(total)`],
  cases: [{ input: "10" }, { input: "1" }, { input: "15" }, { input: "100" }, { input: "999" }],
  hints: ["循环里面可以再放 if。", "“3 的倍数或 5 的倍数”：i % 3 == 0 or i % 5 == 0。", "满足条件时执行 total += i。"],
});
lv(11, 15, "数字三角形", "code", "输入一行：整数 n。输出 n 行：第 i 行是 1 到 i 的数字，数字之间用一个空格隔开。\n例如 n = 4：\n1\n1 2\n1 2 3\n1 2 3 4\n\nprint(x, end=\" \") 输出 x 后不换行，而是输出一个空格。", {
  starter: `n = int(input())\n`, boss: true,
  ref: `n = int(input())\nfor i in range(1, n + 1):\n    row = ""\n    for j in range(1, i + 1):\n        row += str(j) + " "\n    print(row.strip())`,
  wrong: [`n = int(input())\nfor i in range(1, n + 1):\n    for j in range(1, i + 1):\n        print(j)`, `n = int(input())\nfor i in range(1, n + 1):\n    row = ""\n    for j in range(1, i + 1):\n        row += str(j)\n    print(row)`],
  cases: [{ input: "4" }, { input: "1" }, { input: "7" }, { input: "10" }],
  hints: ["外层循环控制行，内层循环控制每一行的数字。", "每一行里，用一个文字变量把数字连起来，最后用 print 输出。", "也可以在内层写 print(j, end=\" \")，每行结束时再写一个 print()。"],
});

// =====================================================================================================
// WORLD 12  函数与列表
// =====================================================================================================
lv(12, 1, "第一个函数", "fill", "写一个函数 square(n)，返回 n 的平方。程序最后会自动调用你的函数来检查结果。\n\nreturn 把结果交还给调用的地方；只用 print 显示结果是不够的。", {
  lesson: "def", starter: `def square(n):\n    return ___\n`,
  ref: `def square(n):\n    return n * n`, wrong: [`def square(n):\n    print(n * n)`, `def square(n):\n    return n + n`],
  cases: [{ call: "print(square(5))" }, { call: "print(square(-3))" }, { call: "print(square(0))" }, { call: "print(square(2.5))" }],
  hints: ["return 后面写要交还的值。", "n 的平方是 n * n。", "return n * n"],
});
lv(12, 2, "两个参数", "code", "写两个函数：\nrect_area(w, h) 返回长方形的面积，\nrect_perimeter(w, h) 返回长方形的周长。", {
  starter: `def rect_area(w, h):\n    pass\n\ndef rect_perimeter(w, h):\n    pass\n`,
  ref: `def rect_area(w, h):\n    return w * h\n\ndef rect_perimeter(w, h):\n    return 2 * (w + h)`, wrong: [`def rect_area(w, h):\n    return w * h\n\ndef rect_perimeter(w, h):\n    return w + h`, `def rect_area(w, h):\n    return w + h\n\ndef rect_perimeter(w, h):\n    return 2 * (w + h)`],
  cases: [{ call: "print(rect_area(8, 5))\nprint(rect_perimeter(8, 5))" }, { call: "print(rect_area(3, 3))\nprint(rect_perimeter(3, 3))" }, { call: "print(rect_area(2.5, 4))\nprint(rect_perimeter(2.5, 4))" }, { call: "print(rect_area(0, 9))\nprint(rect_perimeter(0, 9))" }],
  hints: ["函数名后面括号里的 w、h 叫参数。", "周长是 2 * (w + h)。", "两个函数各写一个 return。"],
});
lv(12, 3, "返回对错", "code", "写函数 is_even(n)：n 是偶数时返回 True，否则返回 False。\n注意：返回的是布尔值 True / False，不是文字。", {
  starter: `def is_even(n):\n    pass\n`,
  ref: `def is_even(n):\n    return n % 2 == 0`, wrong: [`def is_even(n):\n    if n % 2 == 0:\n        return "even"\n    return "odd"`, `def is_even(n):\n    return n % 2 == 1`],
  cases: [{ call: "print(is_even(4))" }, { call: "print(is_even(7))" }, { call: "print(is_even(0))" }, { call: "print(is_even(-3))" }, { call: "print(is_even(-8))" }],
  hints: ["n % 2 == 0 本身就是 True 或 False。", "可以直接 return 这个比较的结果。", "return n % 2 == 0"],
});
lv(12, 4, "列表入门", "code", "输入一行：若干个整数，用空格隔开。依次输出三行：最小值、最大值、总和。", {
  lesson: "lists", starter: `nums = [int(x) for x in input().split()]\n`,
  ref: `nums = [int(x) for x in input().split()]\nprint(min(nums))\nprint(max(nums))\nprint(sum(nums))`, wrong: [`nums = [int(x) for x in input().split()]\nprint(max(nums))\nprint(min(nums))\nprint(sum(nums))`, `nums = [int(x) for x in input().split()]\nprint(min(nums))\nprint(max(nums))\nprint(len(nums))`],
  cases: [{ input: "5 3 9 1 7" }, { input: "42" }, { input: "-3 -8 -1" }, { input: "10 20 30 40 50 60" }],
  hints: ["input().split() 把一行文字按空格切成一个列表。", "min()、max()、sum() 都可以直接用在列表上。", "第一行已经把每一项变成了整数。"],
});
lv(12, 5, "平均数", "code", "写函数 average(xs)：xs 是一个数字列表，返回它们的平均数（总和除以个数）。\n用 for 循环把数加起来。", {
  starter: `def average(xs):\n    total = 0\n    # 在这里加上每一项\n    return total / len(xs)\n`,
  ref: `def average(xs):\n    total = 0\n    for x in xs:\n        total += x\n    return total / len(xs)`, wrong: [`def average(xs):\n    total = 0\n    for x in xs:\n        total += x\n    return total // len(xs)`, `def average(xs):\n    total = 0\n    for x in xs:\n        total += x\n    return total`],
  cases: [{ call: "print(average([1, 2, 3, 4]))" }, { call: "print(average([10]))" }, { call: "print(average([1, 2]))" }, { call: "print(round(average([1, 2, 2]), 2))" }, { call: "print(average([-4, 4]))" }],
  hints: ["for x in xs: 依次取出列表里的每一项。", "在循环里写 total += x。", "最后的 / 是普通除法，得到小数。"],
});
lv(12, 6, "去掉重复", "code", "写函数 unique(xs)：返回一个新列表，去掉重复的项，其余项保持第一次出现的顺序。\n例如 unique([3, 1, 3, 2, 1]) 得到 [3, 1, 2]。", {
  starter: `def unique(xs):\n    result = []\n    return result\n`,
  ref: `def unique(xs):\n    result = []\n    for x in xs:\n        if x not in result:\n            result.append(x)\n    return result`, wrong: [`def unique(xs):\n    return sorted(set(xs))`, `def unique(xs):\n    return xs`],
  cases: [{ call: "print(unique([1, 2, 2, 3, 1]))" }, { call: "print(unique([3, 1, 3, 2, 1]))" }, { call: "print(unique([]))" }, { call: "print(unique([\"a\", \"b\", \"a\"]))" }, { call: "print(unique([5, 5, 5]))" }],
  hints: ["用一个新的空列表 result 来收集。", "x not in result 检查 x 是不是已经收集过。", "没有收集过就 result.append(x)。"],
});
lv(12, 7, "找错误：范围", "debug", "函数 sum_to(n) 应该返回 1 + 2 + ... + n，但是它的结果总是不对。请修改它。", {
  starter: `def sum_to(n):\n    total = 0\n    for i in range(n):\n        total += i\n    return total`,
  ref: `def sum_to(n):\n    total = 0\n    for i in range(1, n + 1):\n        total += i\n    return total`, wrong: [`def sum_to(n):\n    total = 0\n    for i in range(n):\n        total += i\n    return total`],
  cases: [{ call: "print(sum_to(1))" }, { call: "print(sum_to(10))" }, { call: "print(sum_to(100))" }, { call: "print(sum_to(0))" }],
  hints: ["range(n) 是从 0 到 n - 1。", "我们想要 1 到 n。", "range(1, n + 1)"],
});
lv(12, 8, "数元音", "code", "写函数 count_vowels(s)：返回文字 s 里元音字母 a e i o u 的个数，大写小写都算。", {
  starter: `def count_vowels(s):\n    count = 0\n    return count\n`,
  ref: `def count_vowels(s):\n    count = 0\n    for ch in s.lower():\n        if ch in "aeiou":\n            count += 1\n    return count`, wrong: [`def count_vowels(s):\n    count = 0\n    for ch in s:\n        if ch in "aeiou":\n            count += 1\n    return count`, `def count_vowels(s):\n    return len(s)`],
  cases: [{ call: "print(count_vowels(\"Hello World\"))" }, { call: "print(count_vowels(\"PYTHON\"))" }, { call: "print(count_vowels(\"\"))" }, { call: "print(count_vowels(\"rhythm\"))" }, { call: "print(count_vowels(\"AEIOU aeiou\"))" }],
  hints: ["for ch in s: 可以一个字母一个字母地检查。", "s.lower() 把大写字母变成小写，这样只需要检查小写。", "ch in \"aeiou\" 检查 ch 是不是元音。"],
});
lv(12, 9, "回文", "code", "写函数 is_palindrome(s)：判断文字 s 是不是回文。忽略空格和大小写，只看字母和数字。\n例如 \"Never odd or even\" 是回文。返回 True 或 False。", {
  starter: `def is_palindrome(s):\n    pass\n`,
  ref: `def is_palindrome(s):\n    t = ""\n    for ch in s.lower():\n        if ch.isalnum():\n            t += ch\n    return t == t[::-1]`, wrong: [`def is_palindrome(s):\n    return s == s[::-1]`, `def is_palindrome(s):\n    t = s.replace(" ", "")\n    return t == t[::-1]`],
  cases: [{ call: "print(is_palindrome(\"Madam\"))" }, { call: "print(is_palindrome(\"Never odd or even\"))" }, { call: "print(is_palindrome(\"hello\"))" }, { call: "print(is_palindrome(\"A\"))" }, { call: "print(is_palindrome(\"A man, a plan, a canal: Panama\"))" }],
  hints: ["s[::-1] 是倒过来的文字。", "先把 s 整理成只有小写字母和数字的文字 t。", "ch.isalnum() 检查 ch 是不是字母或数字。"],
});
lv(12, 10, "字典：数单词", "code", "输入一行英文句子（只有字母和空格）。统计每个单词出现的次数（不分大小写），按单词的字母顺序输出，每行：单词 次数。\n例如输入 the cat the Dog，输出：\ncat 1\ndog 1\nthe 2", {
  lesson: "dicts", starter: `words = input().lower().split()\ncounts = {}\n`,
  ref: `words = input().lower().split()\ncounts = {}\nfor w in words:\n    counts[w] = counts.get(w, 0) + 1\nfor w in sorted(counts):\n    print(w, counts[w])`,
  wrong: [`words = input().lower().split()\ncounts = {}\nfor w in words:\n    counts[w] = counts.get(w, 0) + 1\nfor w in counts:\n    print(w, counts[w])`, `words = input().split()\ncounts = {}\nfor w in words:\n    counts[w] = counts.get(w, 0) + 1\nfor w in sorted(counts):\n    print(w, counts[w])`],
  cases: [{ input: "the cat the Dog" }, { input: "one" }, { input: "b a b a b" }, { input: "To be or not to be" }, { input: "zeta Alpha zeta alpha beta" }],
  hints: ["字典 counts 的键是单词，值是出现的次数。", "counts.get(w, 0) 在 w 还没出现过时得到 0。", "sorted(counts) 得到按字母排序的键。"],
});
lv(12, 11, "嵌套循环：乘法表", "code", "输入一行：整数 n。输出 n 行：第 i 行有 i 个算式，格式 j*i=积，j 从 1 到 i，算式之间用一个空格隔开。\nn = 3 时：\n1*1=1\n1*2=2 2*2=4\n1*3=3 2*3=6 3*3=9", {
  lesson: "nested", starter: `n = int(input())\n`,
  ref: `n = int(input())\nfor i in range(1, n + 1):\n    items = []\n    for j in range(1, i + 1):\n        items.append(f"{j}*{i}={j * i}")\n    print(" ".join(items))`,
  wrong: [`n = int(input())\nfor i in range(1, n + 1):\n    items = []\n    for j in range(1, i + 1):\n        items.append(f"{i}*{j}={j * i}")\n    print(" ".join(items))`, `n = int(input())\nfor i in range(1, n + 1):\n    for j in range(1, i + 1):\n        print(f"{j}*{i}={j * i}")`],
  cases: [{ input: "3" }, { input: "1" }, { input: "5" }, { input: "9" }],
  hints: ["外层循环是行 i，内层循环是 j。", "先把每一行的算式放进列表，再用 \" \".join(列表) 连起来。", "f\"{j}*{i}={j * i}\""],
});
lv(12, 12, "递归：阶乘", "code", "写函数 factorial(n)：返回 n! = 1 * 2 * ... * n，规定 0! = 1。\n要求：函数要调用它自己（递归），不能用循环。", {
  lesson: "recursion", starter: `def factorial(n):\n    if n == 0:\n        return 1\n    # 其他情况：n 乘以更小的阶乘\n`, recursive: "factorial",
  ref: `def factorial(n):\n    if n == 0:\n        return 1\n    return n * factorial(n - 1)`, wrong: [`def factorial(n):\n    result = 1\n    for i in range(1, n + 1):\n        result *= i\n    return result`, `def factorial(n):\n    if n == 0:\n        return 1\n    return n * factorial(n)`],
  cases: [{ call: "print(factorial(0))" }, { call: "print(factorial(1))" }, { call: "print(factorial(5))" }, { call: "print(factorial(10))" }, { call: "print(factorial(20))" }],
  hints: ["递归需要两部分：停下来的条件和“更小的同样的问题”。", "n! = n * (n - 1)!", "return n * factorial(n - 1)"],
});
lv(12, 13, "画正方形", "draw", "用海龟画一个边长 80 的正方形：从原点出发，先向右（默认方向）画一条边，每次向右转 90 度。\n\n海龟画出的线条会和标准图形比较。", {
  lesson: "turtle", starter: `import turtle\n\nfor i in range(___):\n    turtle.forward(80)\n    turtle.right(90)\n`,
  ref: `import turtle\nfor i in range(4):\n    turtle.forward(80)\n    turtle.right(90)`, wrong: [`import turtle\nfor i in range(4):\n    turtle.forward(60)\n    turtle.right(90)`, `import turtle\nfor i in range(3):\n    turtle.forward(80)\n    turtle.right(120)`],
  cases: [{}], hints: ["正方形有 4 条边。", "每条边走 80，然后右转 90 度。", "for i in range(4):"],
});
lv(12, 14, "多边形函数", "draw", "写函数 polygon(n, size)：画一个有 n 条边、边长为 size 的正多边形。每次转的角度是 360 / n。\n程序最后会用不同的 n 和 size 调用它。", {
  starter: `import turtle\n\ndef polygon(n, size):\n    pass\n`,
  ref: `import turtle\ndef polygon(n, size):\n    for i in range(n):\n        turtle.forward(size)\n        turtle.right(360 / n)`, wrong: [`import turtle\ndef polygon(n, size):\n    for i in range(n):\n        turtle.forward(size)\n        turtle.right(90)`, `import turtle\ndef polygon(n, size):\n    for i in range(4):\n        turtle.forward(size)\n        turtle.right(360 / n)`],
  cases: [{ call: "polygon(3, 70)" }, { call: "polygon(5, 50)" }, { call: "polygon(6, 40)" }, { call: "polygon(8, 30)" }],
  hints: ["多边形有 n 条边，所以循环 n 次。", "走完一周要转 360 度，平均到 n 个角，每次转 360 / n。", "turtle.right(360 / n)"],
});
lv(12, 15, "五角星", "draw", "画一个五角星：边长 100，一共 5 条线，每次向右转 144 度。", {
  starter: `import turtle\n\n`,
  ref: `import turtle\nfor i in range(5):\n    turtle.forward(100)\n    turtle.right(144)`, wrong: [`import turtle\nfor i in range(5):\n    turtle.forward(100)\n    turtle.right(72)`, `import turtle\nfor i in range(5):\n    turtle.forward(90)\n    turtle.right(144)`],
  cases: [{}], hints: ["五角星是一笔画成的：5 次“前进、转弯”。", "转的角度比 90 度大：144 度。", "for i in range(5): 里写 forward(100) 和 right(144)。"],
});
lv(12, 16, "方形螺旋", "draw", "画一个方形螺旋：第 i 条线（i 从 1 到 24）的长度是 i * 3，每画完一条线向右转 90 度。", {
  starter: `import turtle\n\n`,
  ref: `import turtle\nfor i in range(1, 25):\n    turtle.forward(i * 3)\n    turtle.right(90)`, wrong: [`import turtle\nfor i in range(24):\n    turtle.forward(i * 3)\n    turtle.right(90)`, `import turtle\nfor i in range(1, 25):\n    turtle.forward(i * 3)\n    turtle.right(89)`],
  cases: [{}], hints: ["线越来越长：长度用循环变量 i 算出来。", "range(1, 25) 里 i 从 1 到 24。", "turtle.forward(i * 3)"],
});
lv(12, 17, "花朵", "draw", "画一朵花：画一个边长 50 的正方形，向右转 30 度，再画一个……一共 12 个正方形。", {
  starter: `import turtle\n\n`, boss: true,
  ref: `import turtle\nfor i in range(12):\n    for j in range(4):\n        turtle.forward(50)\n        turtle.right(90)\n    turtle.right(30)`, wrong: [`import turtle\nfor i in range(10):\n    for j in range(4):\n        turtle.forward(50)\n        turtle.right(90)\n    turtle.right(30)`, `import turtle\nfor i in range(12):\n    for j in range(4):\n        turtle.forward(50)\n        turtle.right(90)\n    turtle.right(45)`],
  cases: [{}], hints: ["循环里面再放一个循环：外层画 12 个，内层画一个正方形的 4 条边。", "12 个正方形转一圈：12 × 30 = 360 度。", "每画完一个正方形，再 turtle.right(30)。"],
});

// =====================================================================================================
// WORLD 13  算法与小项目
// =====================================================================================================
const big5000 = seq(1, 5000).map((x) => x * 2);   // 2, 4, ... 10000 (sorted)
lv(13, 1, "线性查找", "code", "输入两行：第一行是若干个整数（用空格隔开），第二行是要找的数 t。输出 t 第一次出现的位置（从 0 开始数）；找不到输出 -1。", {
  lesson: "search", starter: `xs = [int(x) for x in input().split()]\nt = int(input())\n`,
  ref: `xs = [int(x) for x in input().split()]\nt = int(input())\nanswer = -1\nfor i in range(len(xs)):\n    if xs[i] == t:\n        answer = i\n        break\nprint(answer)`,
  wrong: [`xs = [int(x) for x in input().split()]\nt = int(input())\nanswer = -1\nfor i in range(len(xs)):\n    if xs[i] == t:\n        answer = i\nprint(answer)`, `xs = [int(x) for x in input().split()]\nt = int(input())\nfor i in range(len(xs)):\n    if xs[i] == t:\n        print(i)`],
  cases: [{ input: lines("4 8 15 16 23 42", 15) }, { input: lines("4 8 15 16 23 42", 5) }, { input: lines("7 7 7", 7) }, { input: lines("1 2 3 2 1", 2) }, { input: lines("9", 9) }, { input: lines("3 1 2", 4) }],
  hints: ["用 for i in range(len(xs)) 依次检查每个位置。", "找到以后用 break 停止，这样得到的是第一次出现的位置。", "先写 answer = -1，找到了再改掉。"],
});
lv(13, 2, "二分查找", "code", "输入两行：第一行是从小到大排好序的整数（最多 5000 个），第二行是要找的数 t。输出 t 的位置（从 0 开始数）；找不到输出 -1。\n挑战：程序的运行步数有限制，一个一个地找会超出限制。要用二分查找：每次和中间的数比较，一次排除一半。\n（不要使用 index。）", {
  starter: `xs = [int(x) for x in input().split()]\nt = int(input())\nlo = 0\nhi = len(xs) - 1\n`, budget: 700, forbid: ["index"],
  ref: `xs = [int(x) for x in input().split()]\nt = int(input())\nlo = 0\nhi = len(xs) - 1\nanswer = -1\nwhile lo <= hi:\n    mid = (lo + hi) // 2\n    if xs[mid] == t:\n        answer = mid\n        break\n    elif xs[mid] < t:\n        lo = mid + 1\n    else:\n        hi = mid - 1\nprint(answer)`,
  wrong: [`xs = [int(x) for x in input().split()]\nt = int(input())\nanswer = -1\nfor i in range(len(xs)):\n    if xs[i] == t:\n        answer = i\n        break\nprint(answer)`, `xs = [int(x) for x in input().split()]\nt = int(input())\nlo = 0\nhi = len(xs) - 1\nanswer = -1\nwhile lo <= hi:\n    mid = (lo + hi) // 2\n    if xs[mid] < t:\n        lo = mid + 1\n    else:\n        hi = mid - 1\nprint(answer)`],
  cases: [{ input: lines(big5000.join(" "), 6000) }, { input: lines(big5000.join(" "), 2) }, { input: lines(big5000.join(" "), 10000) }, { input: lines(big5000.join(" "), 7) }, { input: lines("1 3 5 7 9", 9) }, { input: lines("1 3 5 7 9", 4) }],
  hints: ["lo 和 hi 是还没有排除的范围，mid 是中间位置。", "xs[mid] 比 t 小，说明 t 在右半边：lo = mid + 1。", "xs[mid] 比 t 大，说明 t 在左半边：hi = mid - 1。"],
});
lv(13, 3, "手写排序", "code", "输入一行：若干个整数。从小到大排序后输出，数字之间用空格隔开。\n要求：自己写排序（冒泡排序或选择排序），不能使用 sort 或 sorted。", {
  lesson: "sort", starter: `xs = [int(x) for x in input().split()]\nn = len(xs)\n`, forbid: ["sort", "sorted"],
  ref: `xs = [int(x) for x in input().split()]\nn = len(xs)\nfor i in range(n):\n    for j in range(n - 1 - i):\n        if xs[j] > xs[j + 1]:\n            xs[j], xs[j + 1] = xs[j + 1], xs[j]\nprint(" ".join(str(x) for x in xs))`,
  wrong: [`xs = [int(x) for x in input().split()]\nn = len(xs)\nfor i in range(n):\n    for j in range(n - 1 - i):\n        if xs[j] < xs[j + 1]:\n            xs[j], xs[j + 1] = xs[j + 1], xs[j]\nprint(" ".join(str(x) for x in xs))`, `xs = [int(x) for x in input().split()]\nprint(" ".join(str(x) for x in sorted(xs)))`],
  cases: [{ input: "5 2 9 1 5 6" }, { input: "1" }, { input: "3 2 1" }, { input: "-4 10 0 -4 7" }, { input: ints(30, -50, 50, 7).join(" ") }, { input: "1 2 3 4" }],
  hints: ["冒泡排序：反复比较相邻的两个数，前面的比后面的大就交换。", "外层循环 n 次，内层循环比较 xs[j] 和 xs[j + 1]。", "交换：xs[j], xs[j + 1] = xs[j + 1], xs[j]"],
});
lv(13, 4, "素数", "code", "输入一行：整数 n（n ≤ 5000）。输出 2 到 n 之间一共有多少个素数。\n挑战：运行步数有限制。判断 i 是不是素数时，只需要试到 i 的平方根；或者使用筛法。", {
  starter: `n = int(input())\ncount = 0\n`, budget: 400000,
  ref: `n = int(input())\ncount = 0\nfor i in range(2, n + 1):\n    prime = True\n    d = 2\n    while d * d <= i:\n        if i % d == 0:\n            prime = False\n            break\n        d += 1\n    if prime:\n        count += 1\nprint(count)`,
  wrong: [`n = int(input())\ncount = 0\nfor i in range(2, n + 1):\n    prime = True\n    for d in range(2, i):\n        if i % d == 0:\n            prime = False\n            break\n    if prime:\n        count += 1\nprint(count)`, `n = int(input())\ncount = 0\nfor i in range(1, n + 1):\n    prime = True\n    d = 2\n    while d * d <= i:\n        if i % d == 0:\n            prime = False\n            break\n        d += 1\n    if prime:\n        count += 1\nprint(count)`],
  cases: [{ input: "30" }, { input: "2" }, { input: "1" }, { input: "100" }, { input: "5000" }],
  hints: ["素数：大于 1，除了 1 和它自己，没有别的因数。", "如果 i 有因数，一定有一个不大于 i 的平方根：试 d * d <= i 的 d。", "找到一个因数就 break，不用再试了。"],
});
lv(13, 5, "最大公约数", "code", "输入一行：两个正整数 a 和 b（最大到十亿），用空格隔开。输出它们的最大公约数。\n挑战：运行步数有限制，从大到小一个一个试会超出限制。试试辗转相除法：gcd(a, b) = gcd(b, a % b)。", {
  starter: `a, b = [int(x) for x in input().split()]\n`, budget: 300,
  ref: `a, b = [int(x) for x in input().split()]\nwhile b != 0:\n    a, b = b, a % b\nprint(a)`,
  wrong: [`a, b = [int(x) for x in input().split()]\nd = min(a, b)\nwhile d > 1:\n    if a % d == 0 and b % d == 0:\n        break\n    d -= 1\nprint(d)`, `a, b = [int(x) for x in input().split()]\nwhile b != 0:\n    a, b = b, a % b\nprint(b)`],
  cases: [{ input: "12 18" }, { input: "17 5" }, { input: "100 75" }, { input: "1000000000 999999999" }, { input: "832040 514229" }, { input: "48 180" }],
  hints: ["辗转相除：用 a % b 代替较大的数，直到余数是 0。", "a, b = b, a % b 一次完成交换和取余。", "当 b 变成 0 时，a 就是答案。"],
});
lv(13, 6, "斐波那契", "code", "输入一行：整数 n（0 ≤ n ≤ 90）。输出第 n 个斐波那契数：F(0) = 0，F(1) = 1，之后每个数是前两个数的和。\n挑战：运行步数有限制，直接递归会重复计算很多次，要用循环。", {
  starter: `n = int(input())\n`, budget: 500,
  ref: `n = int(input())\na, b = 0, 1\nfor _ in range(n):\n    a, b = b, a + b\nprint(a)`,
  wrong: [`def fib(k):\n    if k < 2:\n        return k\n    return fib(k - 1) + fib(k - 2)\nn = int(input())\nprint(fib(n))`, `n = int(input())\na, b = 0, 1\nfor _ in range(n):\n    a, b = b, a + b\nprint(b)`],
  cases: [{ input: "0" }, { input: "1" }, { input: "10" }, { input: "30" }, { input: "90" }],
  hints: ["只需要记住最近的两个数 a 和 b。", "每一步：a 变成 b，b 变成 a + b。", "循环 n 次后，a 就是 F(n)。"],
});
lv(13, 7, "凯撒密码", "code", "输入两行：第一行是整数 k（可以是负数），第二行是一段文字。把文字里的每个英文字母向后移动 k 位（z 后面是 a，大小写保持不变），其他字符不变，输出加密后的文字。", {
  starter: `k = int(input())\ntext = input()\nresult = ""\n`,
  ref: `k = int(input())\ntext = input()\nresult = ""\nfor ch in text:\n    if ch.isalpha():\n        base = ord("A") if ch.isupper() else ord("a")\n        result += chr((ord(ch) - base + k) % 26 + base)\n    else:\n        result += ch\nprint(result)`,
  wrong: [`k = int(input())\ntext = input()\nresult = ""\nfor ch in text:\n    if ch.isalpha():\n        result += chr(ord(ch) + k)\n    else:\n        result += ch\nprint(result)`, `k = int(input())\ntext = input()\nresult = ""\nfor ch in text:\n    result += chr((ord(ch) - ord("a") + k) % 26 + ord("a"))\nprint(result)`],
  cases: [{ input: lines(3, "Hello, World!") }, { input: lines(5, "xyz XYZ") }, { input: lines(-3, "Khoor, Zruog!") }, { input: lines(0, "same") }, { input: lines(13, "Why did the chicken cross the road?") }, { input: lines(26, "abc") }],
  hints: ["ord(ch) 得到字符的编号，chr(编号) 变回字符。", "先减去起点（大写是 \"A\"，小写是 \"a\"），加 k，再对 26 取余，最后加回起点。", "不是字母的字符原样放进结果。"],
});
lv(13, 8, "变位词", "code", "输入两行文字。如果它们是变位词（字母相同，只是顺序不同；忽略空格和大小写），输出 是，否则输出 否。\n例如 Listen 和 Silent 是变位词。", {
  starter: `a = input()\nb = input()\n`,
  ref: `a = input()\nb = input()\nx = sorted(a.replace(" ", "").lower())\ny = sorted(b.replace(" ", "").lower())\nif x == y:\n    print("是")\nelse:\n    print("否")`,
  wrong: [`a = input()\nb = input()\nif a.lower() == b.lower():\n    print("是")\nelse:\n    print("否")`, `a = input()\nb = input()\nif len(a) == len(b):\n    print("是")\nelse:\n    print("否")`],
  cases: [{ input: lines("Listen", "Silent") }, { input: lines("abc", "abd") }, { input: lines("dormitory", "dirty room") }, { input: lines("aab", "abb") }, { input: lines("a", "a") }, { input: lines("School master", "The classroom") }],
  hints: ["变位词排好序以后是一样的。", "sorted(文字) 得到排好序的字母列表。", "先用 replace(\" \", \"\") 去掉空格，用 lower() 变成小写。"],
});
lv(13, 9, "高频单词", "code", "输入一行英文句子，单词之间用空格隔开，可能有标点 . , ! ?。把字母变成小写、去掉单词两端的标点后统计次数，输出出现次数最多的前 3 个单词，每行：单词 次数。\n次数相同时，按字母顺序。不足 3 个就全部输出。", {
  starter: `words = input().lower().split()\ncounts = {}\n`,
  ref: `words = input().lower().split()\ncounts = {}\nfor w in words:\n    w = w.strip(".,!?")\n    if w != "":\n        counts[w] = counts.get(w, 0) + 1\nitems = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))\nfor w, c in items[:3]:\n    print(w, c)`,
  wrong: [`words = input().lower().split()\ncounts = {}\nfor w in words:\n    counts[w] = counts.get(w, 0) + 1\nitems = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))\nfor w, c in items[:3]:\n    print(w, c)`, `words = input().lower().split()\ncounts = {}\nfor w in words:\n    w = w.strip(".,!?")\n    counts[w] = counts.get(w, 0) + 1\nitems = sorted(counts.items(), key=lambda kv: kv[0])\nfor w, c in items[:3]:\n    print(w, c)`],
  cases: [{ input: "the cat and the dog and the bird" }, { input: "Hello, hello! Hello? world." }, { input: "a b c d" }, { input: "It is what it is, and what it is, is it." }, { input: "one" }],
  hints: ["先统计：和“数单词”一样用字典。", "w.strip(\".,!?\") 去掉两端的标点。", "sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])) 先按次数从大到小，再按字母顺序。"],
});

// the guess-the-number tests: the secret comes from the seeded random of the test, the guesses are a binary search (so the input always matches the secret)
function guessInput(secret: number): string {
  const g: number[] = []; let lo = 1, hi = 100;
  for (;;) { const m = Math.floor((lo + hi) / 2); g.push(m); if (m === secret) break; if (m < secret) lo = m + 1; else hi = m - 1; }
  return g.join("\n");
}
/** the secret number of level 13-10 for a seed (the same Mersenne Twister as CPython, so the guesses in the test input always fit) */
const secretFor = (seed: number): number => {
  const r = run("import random\nprint(random.randint(1, 100))", { seed });
  return Number(r.stdout.trim());
};

lv(13, 10, "猜数字", "code", "电脑用 random 想一个 1 到 100 的整数 secret。程序反复读入玩家的猜测（每行一个整数）：\n猜小了输出 太小了，猜大了输出 太大了，猜对了输出 猜对了，用了 N 次（N 是猜测的次数）并结束。\n（测试时 random 用固定的种子，所以电脑每次想的数是确定的。）", {
  lesson: "random", starter: `import random\n\nsecret = random.randint(1, 100)\ntries = 0\n`,
  ref: `import random\n\nsecret = random.randint(1, 100)\ntries = 0\nwhile True:\n    guess = int(input())\n    tries += 1\n    if guess < secret:\n        print("太小了")\n    elif guess > secret:\n        print("太大了")\n    else:\n        print(f"猜对了，用了{tries}次")\n        break`,
  wrong: [`import random\n\nsecret = random.randint(1, 100)\ntries = 0\nwhile True:\n    guess = int(input())\n    tries += 1\n    if guess < secret:\n        print("太大了")\n    elif guess > secret:\n        print("太小了")\n    else:\n        print(f"猜对了，用了{tries}次")\n        break`, `import random\n\nsecret = random.randint(1, 50)\ntries = 0\nwhile True:\n    guess = int(input())\n    tries += 1\n    if guess < secret:\n        print("太小了")\n    elif guess > secret:\n        print("太大了")\n    else:\n        print(f"猜对了，用了{tries}次")\n        break`],
  cases: [1, 2, 3, 4, 5].map((seed) => ({ seed, input: guessInput(seed === 0 ? 1 : secretFor(seed)) })),
  hints: ["secret = random.randint(1, 100) 已经写好了。", "用 while True 反复读入，猜对了用 break 结束。", "tries 每读一次加 1。"],
});
lv(13, 11, "石头剪刀布", "code", "输入：第一行是整数 n（回合数），之后 n 行，每行两个词 a b，是甲和乙的出拳（rock 石头、scissors 剪刀、paper 布）。\n每回合输出：甲胜 / 乙胜 / 平局。最后输出一行：甲 x : 乙 y（x、y 是两人赢的回合数）。\n规则：石头胜剪刀，剪刀胜布，布胜石头。", {
  starter: `n = int(input())\nbeats = {"rock": "scissors", "scissors": "paper", "paper": "rock"}\nwins_a = 0\nwins_b = 0\n`,
  ref: `n = int(input())\nbeats = {"rock": "scissors", "scissors": "paper", "paper": "rock"}\nwins_a = 0\nwins_b = 0\nfor _ in range(n):\n    a, b = input().split()\n    if a == b:\n        print("平局")\n    elif beats[a] == b:\n        print("甲胜")\n        wins_a += 1\n    else:\n        print("乙胜")\n        wins_b += 1\nprint(f"甲 {wins_a} : 乙 {wins_b}")`,
  wrong: [`n = int(input())\nbeats = {"rock": "scissors", "scissors": "paper", "paper": "rock"}\nwins_a = 0\nwins_b = 0\nfor _ in range(n):\n    a, b = input().split()\n    if a == b:\n        print("平局")\n    elif beats[b] == a:\n        print("甲胜")\n        wins_a += 1\n    else:\n        print("乙胜")\n        wins_b += 1\nprint(f"甲 {wins_a} : 乙 {wins_b}")`, `n = int(input())\nbeats = {"rock": "scissors", "scissors": "paper", "paper": "rock"}\nwins_a = 0\nwins_b = 0\nfor _ in range(n):\n    a, b = input().split()\n    if a == b:\n        print("平局")\n    elif beats[a] == b:\n        print("甲胜")\n        wins_a += 1\n    else:\n        print("乙胜")\n        wins_b += 1\nprint(f"甲 {wins_a} : 乙 {wins_a}")`],
  cases: [{ input: lines(3, "rock scissors", "paper scissors", "paper paper") }, { input: lines(1, "scissors rock") }, { input: lines(4, "rock paper", "rock rock", "paper rock", "scissors paper") }, { input: lines(0) }, { input: lines(5, "paper paper", "paper paper", "rock paper", "rock scissors", "scissors rock") }],
  hints: ["用字典记下“谁赢谁”：beats[a] 是 a 能赢的出拳。", "beats[a] == b 说明甲赢。", "平局、甲胜、乙胜三种情况各自处理。"],
});
lv(13, 12, "银行账户", "code", "模拟一个账户，余额一开始是 0。每行一条命令，直到 quit：\ndeposit 金额：存钱。\nwithdraw 金额：取钱；如果余额不够，输出 余额不足，余额不变。\nbalance：输出当前余额。\n不用 class，用一个变量保存余额。", {
  starter: `balance = 0\nwhile True:\n    line = input()\n    if line == "quit":\n        break\n`,
  ref: `balance = 0\nwhile True:\n    line = input()\n    if line == "quit":\n        break\n    parts = line.split()\n    if parts[0] == "deposit":\n        balance += int(parts[1])\n    elif parts[0] == "withdraw":\n        amount = int(parts[1])\n        if amount > balance:\n            print("余额不足")\n        else:\n            balance -= amount\n    elif parts[0] == "balance":\n        print(balance)`,
  wrong: [`balance = 0\nwhile True:\n    line = input()\n    if line == "quit":\n        break\n    parts = line.split()\n    if parts[0] == "deposit":\n        balance += int(parts[1])\n    elif parts[0] == "withdraw":\n        balance -= int(parts[1])\n    elif parts[0] == "balance":\n        print(balance)`, `balance = 0\nwhile True:\n    line = input()\n    if line == "quit":\n        break\n    parts = line.split()\n    if parts[0] == "deposit":\n        balance = int(parts[1])\n    elif parts[0] == "withdraw":\n        amount = int(parts[1])\n        if amount > balance:\n            print("余额不足")\n        else:\n            balance -= amount\n    elif parts[0] == "balance":\n        print(balance)`],
  cases: [{ input: lines("deposit 100", "balance", "withdraw 30", "balance", "quit") }, { input: lines("withdraw 5", "balance", "quit") }, { input: lines("deposit 50", "deposit 25", "withdraw 75", "balance", "withdraw 1", "balance", "quit") }, { input: lines("quit") }],
  hints: ["line.split() 把命令切成两部分：命令词和金额。", "用 if / elif 判断命令词。", "取钱前先检查 amount > balance。"],
});
lv(13, 13, "文字冒险", "code", "一个小冒险：房间之间有路，你从 大厅 出发。每行一条命令，直到 quit：\ngo 方向：如果这个方向有路，输出 你来到了房间名，并移动；否则输出 这个方向没有路。\nlook：输出 你在房间名。\n房间已经写在 rooms 里（方向：north、south、east、west）。", {
  starter: `rooms = {\n    "大厅": {"north": "厨房", "east": "书房"},\n    "厨房": {"south": "大厅"},\n    "书房": {"west": "大厅", "north": "花园"},\n    "花园": {"south": "书房"},\n}\nroom = "大厅"\nwhile True:\n    line = input()\n    if line == "quit":\n        break\n`,
  ref: `rooms = {\n    "大厅": {"north": "厨房", "east": "书房"},\n    "厨房": {"south": "大厅"},\n    "书房": {"west": "大厅", "north": "花园"},\n    "花园": {"south": "书房"},\n}\nroom = "大厅"\nwhile True:\n    line = input()\n    if line == "quit":\n        break\n    parts = line.split()\n    if parts[0] == "go":\n        nxt = rooms[room].get(parts[1])\n        if nxt:\n            room = nxt\n            print("你来到了" + room)\n        else:\n            print("这个方向没有路")\n    elif parts[0] == "look":\n        print("你在" + room)`,
  wrong: [`rooms = {\n    "大厅": {"north": "厨房", "east": "书房"},\n    "厨房": {"south": "大厅"},\n    "书房": {"west": "大厅", "north": "花园"},\n    "花园": {"south": "书房"},\n}\nroom = "大厅"\nwhile True:\n    line = input()\n    if line == "quit":\n        break\n    parts = line.split()\n    if parts[0] == "go":\n        nxt = rooms[room].get(parts[1])\n        if nxt:\n            print("你来到了" + nxt)\n        else:\n            print("这个方向没有路")\n    elif parts[0] == "look":\n        print("你在" + room)`],
  cases: [{ input: lines("look", "go north", "look", "go west", "go south", "quit") }, { input: lines("go east", "go north", "look", "go south", "go west", "look", "quit") }, { input: lines("go up", "quit") }, { input: lines("quit") }],
  hints: ["rooms[room] 是当前房间的出口字典。", "出口字典的 .get(方向) 没有这个方向时得到 None。", "移动以后，别忘了更新 room。"],
});
lv(13, 14, "待办清单", "code", "做一个待办清单。每行一条命令，直到 quit：\nadd 事情：加入一件事（事情可以有空格）。\ndone 编号：完成（删除）第 编号 件事，编号从 1 开始；编号不存在时输出 没有这一项。\nlist：按顺序输出，每行 编号. 事情；清单是空的就输出 清单是空的。", {
  starter: `todo = []\nwhile True:\n    line = input()\n    if line == "quit":\n        break\n`,
  ref: `todo = []\nwhile True:\n    line = input()\n    if line == "quit":\n        break\n    if line.startswith("add "):\n        todo.append(line[4:])\n    elif line.startswith("done "):\n        k = int(line[5:])\n        if 1 <= k <= len(todo):\n            todo.pop(k - 1)\n        else:\n            print("没有这一项")\n    elif line == "list":\n        if len(todo) == 0:\n            print("清单是空的")\n        for i in range(len(todo)):\n            print(f"{i + 1}. {todo[i]}")`,
  wrong: [`todo = []\nwhile True:\n    line = input()\n    if line == "quit":\n        break\n    if line.startswith("add "):\n        todo.append(line[4:])\n    elif line.startswith("done "):\n        k = int(line[5:])\n        if 1 <= k <= len(todo):\n            todo.pop(k)\n        else:\n            print("没有这一项")\n    elif line == "list":\n        if len(todo) == 0:\n            print("清单是空的")\n        for i in range(len(todo)):\n            print(f"{i + 1}. {todo[i]}")`, `todo = []\nwhile True:\n    line = input()\n    if line == "quit":\n        break\n    if line.startswith("add "):\n        todo.append(line.split()[1])\n    elif line.startswith("done "):\n        k = int(line[5:])\n        if 1 <= k <= len(todo):\n            todo.pop(k - 1)\n        else:\n            print("没有这一项")\n    elif line == "list":\n        if len(todo) == 0:\n            print("清单是空的")\n        for i in range(len(todo)):\n            print(f"{i + 1}. {todo[i]}")`],
  cases: [{ input: lines("list", "add buy milk", "add do homework", "list", "done 1", "list", "quit") }, { input: lines("add a", "done 2", "done 0", "done 1", "list", "quit") }, { input: lines("add read a book", "add walk the dog", "add sleep", "done 2", "list", "quit") }, { input: lines("quit") }],
  hints: ["line.startswith(\"add \") 检查一行是不是以 add 开头。", "line[4:] 是 \"add \" 后面的全部文字。", "todo.pop(k - 1) 删除第 k 项（编号从 1 开始，位置从 0 开始）。"],
});
lv(13, 15, "成绩单", "code", "输入：第一行是整数 n，之后 n 行，每行 姓名 分数（分数是整数）。\n按分数从高到低输出，每行：名次. 姓名 分数（名次从 1 开始；分数相同的保持输入顺序）。最后一行输出：平均分：x（保留 1 位小数）。", {
  starter: `n = int(input())\nstudents = []\nfor _ in range(n):\n    name, score = input().split()\n    students.append((name, int(score)))\n`,
  ref: `n = int(input())\nstudents = []\nfor _ in range(n):\n    name, score = input().split()\n    students.append((name, int(score)))\nranked = sorted(students, key=lambda s: -s[1])\ntotal = 0\nfor i in range(len(ranked)):\n    print(f"{i + 1}. {ranked[i][0]} {ranked[i][1]}")\n    total += ranked[i][1]\nprint(f"平均分：{total / n:.1f}")`,
  wrong: [`n = int(input())\nstudents = []\nfor _ in range(n):\n    name, score = input().split()\n    students.append((name, int(score)))\nranked = sorted(students, key=lambda s: s[1])\ntotal = 0\nfor i in range(len(ranked)):\n    print(f"{i + 1}. {ranked[i][0]} {ranked[i][1]}")\n    total += ranked[i][1]\nprint(f"平均分：{total / n:.1f}")`, `n = int(input())\nstudents = []\nfor _ in range(n):\n    name, score = input().split()\n    students.append((name, int(score)))\nranked = sorted(students, key=lambda s: -s[1])\ntotal = 0\nfor i in range(len(ranked)):\n    print(f"{i + 1}. {ranked[i][0]} {ranked[i][1]}")\n    total += ranked[i][1]\nprint(f"平均分：{total / n}")`],
  cases: [{ input: lines(3, "Ann 90", "Bo 85", "Cy 95") }, { input: lines(1, "Zed 70") }, { input: lines(4, "A 80", "B 90", "C 80", "D 90") }, { input: lines(5, "a 61", "b 62", "c 63", "d 64", "e 65") }, { input: lines(3, "Ann 90", "Bo 85", "Cy 88") }],
  hints: ["sorted(列表, key=lambda s: -s[1]) 按分数从高到低排序，分数相同的保持原来的顺序。", "名次是位置加 1。", "f\"{total / n:.1f}\" 保留 1 位小数。"],
});
lv(13, 16, "毕业：质因数分解", "code", "输入一行：整数 n（2 ≤ n ≤ 10^10）。输出它的质因数分解，格式：因数^次数，用 * 连接，从小到大；次数是 1 时只写因数。\n例如 360 = 2^3 * 3^2 * 5；17 输出 17。\n挑战：n 可能很大，运行步数有限制。只需要试到 √n，并且每找到一个因数就把它除干净。", {
  starter: `n = int(input())\nparts = []\n`, boss: true, budget: 900000,
  ref: `n = int(input())\nparts = []\nd = 2\nwhile d * d <= n:\n    k = 0\n    while n % d == 0:\n        n //= d\n        k += 1\n    if k == 1:\n        parts.append(str(d))\n    elif k > 1:\n        parts.append(f"{d}^{k}")\n    d += 1\nif n > 1:\n    parts.append(str(n))\nprint(" * ".join(parts))`,
  wrong: [`n = int(input())\nparts = []\nfor d in range(2, n + 1):\n    k = 0\n    while n % d == 0:\n        n //= d\n        k += 1\n    if k == 1:\n        parts.append(str(d))\n    elif k > 1:\n        parts.append(f"{d}^{k}")\nprint(" * ".join(parts))`, `n = int(input())\nparts = []\nd = 2\nwhile d * d <= n:\n    k = 0\n    while n % d == 0:\n        n //= d\n        k += 1\n    if k == 1:\n        parts.append(str(d))\n    elif k > 1:\n        parts.append(f"{d}^{k}")\n    d += 1\nprint(" * ".join(parts))`],
  cases: [{ input: "360" }, { input: "17" }, { input: "2" }, { input: "1024" }, { input: "9999999967" }, { input: "9876543210" }, { input: "60" }, { input: "49" }],
  hints: ["从 d = 2 开始试，能整除就一直除，数出除了几次。", "d * d > n 时停止：剩下的 n 如果大于 1，它本身就是一个质因数。", "把每一项做成文字放进列表 parts，最后用 \" * \".join(parts) 连起来。"],
});

export const LEVELS: TLevel[] = L;
export const levelsOfText = (world: number): TLevel[] => LEVELS.filter((l) => l.world === world);
export const textLevelById = (id: string): TLevel | undefined => LEVELS.find((l) => l.id === id);
