/**
 * 编程, text coding: the mini-lessons of worlds 11-13. Each lesson = 2-3 steps: a short text and a RUNNABLE example the child can edit ("试一试").
 * Written by a model from memory (original); a teacher must proofread. A step may show the blocks of phase 1 beside their Python text (`blocks`, pseudo-code of coding-ast.ts).
 */
export interface TStep { text: string; code: string; input?: string; /** a block program (phase-1 pseudo-code) whose Python text is the code */ blocks?: string }
export interface TLesson { id: string; title: string; steps: TStep[] }

export const TLESSONS: Record<string, TLesson> = {
  bridge: { id: "bridge", title: "先拼积木，再看代码", steps: [
    { text: "积木程序和文字程序是同一件事的两种写法。左边是积木，右边是同样的 Python 代码。", blocks: "repeat 4 { fd 50 tr 90 }", code: "" },
    { text: "“重复 4 次”变成 for 循环；“前进 50”变成 turtle.forward(50)；“右转 90”变成 turtle.right(90)。缩进（行首的 4 个空格）表示“属于上面那一行”。", blocks: "repeat 4 { fd 50 tr 90 }", code: "" },
    { text: "试着改一改：把 4 改成 3，把 90 改成 120，再点“试一试”。", code: "import turtle\nturtle.setheading(90)\nfor i in range(3):\n    turtle.forward(50)\n    turtle.right(120)\n" },
  ] },
  print: { id: "print", title: "print：让计算机说话", steps: [
    { text: "print(...) 把括号里的内容显示出来。文字要放在英文引号里。", code: "print(\"你好，世界\")\nprint(\"第二行\")\n" },
    { text: "括号、引号、冒号都要用英文输入法输入。每个 print 输出一行。", code: "print(\"1 + 2 =\", 1 + 2)\nprint(\"A\", \"B\", \"C\")\nprint(\"A\", \"B\", sep=\"-\")\n" },
    { text: "程序出错时，计算机会告诉你出错的行号和原因。请先看这一行。", code: "print(\"你好)\n" },
  ] },
  arith: { id: "arith", title: "算术：计算机是计算器", steps: [
    { text: "+ - * / 是加减乘除。先乘除后加减，括号里的先算。// 是整除，% 是余数，** 是乘方。", code: "print(2 + 3 * 4)\nprint((2 + 3) * 4)\nprint(17 // 5, 17 % 5)\nprint(2 ** 10)\n" },
    { text: "/ 的结果是小数。小数的计算有时有很小的误差，这是计算机表示小数的方式造成的。", code: "print(7 / 2)\nprint(0.1 + 0.2)\nprint(round(0.1 + 0.2, 2))\n" },
  ] },
  vars: { id: "vars", title: "变量：有名字的盒子", steps: [
    { text: "变量像一个贴了名字的盒子。用 = 把值放进去，以后用名字取出来。", code: "w = 8\nh = 5\narea = w * h\nprint(area)\n" },
    { text: "变量可以被改变。a += 1 的意思是：把 a 加上 1 再放回 a。", code: "score = 10\nscore += 5\nscore *= 2\nprint(score)\na = 1\nb = 2\na, b = b, a\nprint(a, b)\n" },
  ] },
  strings: { id: "strings", title: "文字：字符串", steps: [
    { text: "用引号括起来的是字符串。+ 把两段文字连起来，* 把文字重复。len() 数一数有几个字。", code: "name = \"小明\"\nprint(\"你好，\" + name + \"！\")\nprint(\"哈\" * 3)\nprint(len(name))\n" },
    { text: "f 字符串：在引号前加 f，花括号 {} 里可以放变量和算式。", code: "name = \"Tom\"\nage = 12\nprint(f\"{name} 今年 {age} 岁，明年 {age + 1} 岁\")\nprint(f\"{3.14159:.2f}\")\n" },
    { text: "文字里的每个字有一个位置，从 0 开始数。s[0] 是第一个，s[-1] 是最后一个，s[1:3] 是切片。", code: "s = \"Python\"\nprint(s[0], s[-1], s[1:4])\nprint(s.upper(), s.lower())\nprint(s[::-1])\n" },
  ] },
  input: { id: "input", title: "输入：input()", steps: [
    { text: "input() 读入一行，得到的是文字。要做计算，先用 int() 或 float() 把它变成数。在下面的“输入”框里写数据，每行对应一次 input()。", code: "a = int(input())\nb = int(input())\nprint(a + b)\n", input: "3\n4" },
    { text: "如果忘了 int()，两个文字相加只是把它们连在一起。", code: "a = input()\nb = input()\nprint(a + b)\n", input: "3\n4" },
  ] },
  if: { id: "if", title: "判断：if / elif / else", steps: [
    { text: "if 后面是条件，条件成立才执行缩进的代码。条件后面要有冒号，缩进用 4 个空格。", code: "x = 7\nif x > 5:\n    print(\"大\")\nelse:\n    print(\"小\")\n" },
    { text: "有多种情况时用 elif，从上往下检查，第一个成立的执行，其余跳过。比较用 ==（相等）、!=、<、>、<=、>=；and、or、not 组合条件。", code: "score = 82\nif score >= 90:\n    print(\"优秀\")\nelif score >= 75:\n    print(\"良好\")\nelse:\n    print(\"继续努力\")\nprint(score > 60 and score < 100)\n" },
  ] },
  while: { id: "while", title: "while：条件成立就重复", steps: [
    { text: "while 后面是条件。条件成立，缩进的代码就执行一遍，然后再检查条件。循环里要改变某个值，否则会永远停不下来。", code: "i = 1\ntotal = 0\nwhile i <= 5:\n    total += i\n    i += 1\nprint(total)\n" },
    { text: "break 立刻结束循环，continue 跳过这一轮的剩余部分。", code: "n = 0\nwhile True:\n    n += 1\n    if n % 2 == 0:\n        continue\n    if n > 7:\n        break\n    print(n)\n" },
  ] },
  for: { id: "for", title: "for：数着数着重复", steps: [
    { text: "for i in range(5) 让 i 依次是 0、1、2、3、4。range(1, 6) 是 1 到 5（不含 6）。range(0, 10, 2) 每次加 2。", code: "for i in range(5):\n    print(i)\nfor i in range(1, 6):\n    print(i * i, end=\" \")\nprint()\n" },
    { text: "for 也可以依次取出文字里的字或列表里的项。", code: "for ch in \"abc\":\n    print(ch)\nfor x in [3, 1, 4]:\n    print(x * 10)\n" },
  ] },
  def: { id: "def", title: "函数：自己的工具", steps: [
    { text: "def 定义函数。括号里是参数，return 把结果交还给调用的地方。定义不会运行，调用以后才运行。", code: "def square(n):\n    return n * n\n\nprint(square(5))\nprint(square(2) + square(3))\n" },
    { text: "函数里的变量只在函数里有效。函数没有 return 时，得到 None。", code: "def greet(name):\n    print(\"你好，\" + name)\n\ngreet(\"小明\")\nresult = greet(\"小红\")\nprint(result)\n" },
  ] },
  lists: { id: "lists", title: "列表：一串数据", steps: [
    { text: "列表用方括号，项之间用逗号。位置从 0 开始。append 在末尾添加，len 数个数。", code: "xs = [5, 3, 8]\nxs.append(1)\nprint(xs, len(xs))\nprint(xs[0], xs[-1], xs[1:3])\n" },
    { text: "for 可以逐项处理列表。sorted 排序，sum / min / max 汇总。列表推导式用一行做出新列表。", code: "xs = [5, 3, 8, 1]\nfor x in xs:\n    print(x * 2)\nprint(sorted(xs), sum(xs), min(xs), max(xs))\nprint([x * x for x in xs if x > 2])\n" },
    { text: "input().split() 把一行文字按空格切成列表。", code: "nums = [int(x) for x in input().split()]\nprint(nums, sum(nums))\n", input: "4 8 15 16 23 42" },
  ] },
  dicts: { id: "dicts", title: "字典：用名字找东西", steps: [
    { text: "字典由“键: 值”组成，用键来查值。d.get(键, 默认值) 在键不存在时不会出错。", code: "ages = {\"小明\": 12, \"小红\": 11}\nages[\"小刚\"] = 13\nprint(ages[\"小明\"], ages.get(\"小丽\", 0))\nprint(len(ages))\nfor name in ages:\n    print(name, ages[name])\n" },
    { text: "数一数每个词出现几次，是字典最常见的用法。", code: "counts = {}\nfor w in [\"a\", \"b\", \"a\", \"c\", \"a\"]:\n    counts[w] = counts.get(w, 0) + 1\nprint(counts)\nfor w, c in counts.items():\n    print(w, c)\n" },
  ] },
  nested: { id: "nested", title: "循环里的循环", steps: [
    { text: "外层循环每走一步，内层循环就完整地走一遍。常用来处理表格：行和列。", code: "for i in range(1, 4):\n    for j in range(1, 4):\n        print(i * j, end=\" \")\n    print()\n" },
  ] },
  recursion: { id: "recursion", title: "递归：函数调用自己", steps: [
    { text: "递归要有两部分：一个“不用再递归”的最简单情况，和一个“把问题变小再调用自己”的步骤。", code: "def factorial(n):\n    if n == 0:\n        return 1\n    return n * factorial(n - 1)\n\nprint(factorial(5))\n" },
    { text: "没有最简单情况的递归永远不会停止，计算机会报告“调用太深”。", code: "def boom(n):\n    return boom(n + 1)\n\nboom(0)\n" },
  ] },
  turtle: { id: "turtle", title: "画图：turtle", steps: [
    { text: "import turtle 以后，用 turtle.forward(距离) 前进，turtle.right(角度) 右转。海龟一开始朝右。", code: "import turtle\nturtle.forward(80)\nturtle.right(90)\nturtle.forward(80)\n" },
    { text: "用循环画图：正方形是 4 次“前进、右转 90 度”。n 边形每次转 360 / n 度。", code: "import turtle\nfor i in range(5):\n    turtle.forward(60)\n    turtle.right(360 / 5)\n" },
    { text: "penup() 抬笔，pendown() 落笔，color(\"red\") 换颜色。", code: "import turtle\nturtle.color(\"red\")\nfor i in range(4):\n    turtle.forward(40)\n    turtle.right(90)\nturtle.penup()\nturtle.forward(70)\nturtle.pendown()\nturtle.color(\"blue\")\nfor i in range(3):\n    turtle.forward(40)\n    turtle.right(120)\n" },
  ] },
  search: { id: "search", title: "查找", steps: [
    { text: "线性查找：从头到尾一个一个看。要找的数在最后，就要看完所有的数。", code: "xs = [4, 8, 15, 16, 23, 42]\nt = 16\nfor i in range(len(xs)):\n    if xs[i] == t:\n        print(i)\n        break\n" },
    { text: "二分查找：数据已经排好序时，每次看中间一个，就能排除一半。1000 个数最多看 10 次。", code: "xs = [2, 4, 6, 8, 10, 12, 14]\nt = 10\nlo, hi = 0, len(xs) - 1\nwhile lo <= hi:\n    mid = (lo + hi) // 2\n    print(\"看\", mid, xs[mid])\n    if xs[mid] == t:\n        break\n    elif xs[mid] < t:\n        lo = mid + 1\n    else:\n        hi = mid - 1\n" },
  ] },
  sort: { id: "sort", title: "排序", steps: [
    { text: "冒泡排序：反复比较相邻的两个数，前面的大就交换。大的数像气泡一样“浮”到后面。", code: "xs = [5, 2, 9, 1]\nn = len(xs)\nfor i in range(n):\n    for j in range(n - 1 - i):\n        if xs[j] > xs[j + 1]:\n            xs[j], xs[j + 1] = xs[j + 1], xs[j]\n    print(xs)\n" },
  ] },
  random: { id: "random", title: "随机数", steps: [
    { text: "import random 以后，random.randint(1, 6) 得到 1 到 6 的随机整数。random.seed(数) 让随机的结果每次都一样，方便检查程序。", code: "import random\nrandom.seed(7)\nfor _ in range(5):\n    print(random.randint(1, 6))\nprint(random.choice([\"石头\", \"剪刀\", \"布\"]))\n" },
  ] },
};
