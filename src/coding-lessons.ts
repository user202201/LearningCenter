/**
 * 编程: the mini-lessons (3-4 short steps, each with a demo program that runs by itself). One per concept (docs/coding-curriculum.md): the first level that uses a
 * concept opens its lesson; the ? button of a level opens it again. Written by a model; a teacher must proofread.
 */
export interface Demo { rows?: string[]; start?: { x: number; y: number; dir: number }; program: string; turtle?: boolean; origin?: { x: number; y: number }; /** worlds 7-10 (coding-lessons2.ts): sprites on a stage, or lists / bars / a graph / a scale */ kind?: "stage" | "data"; ext?: unknown }
export interface Lesson { id: string; title: string; steps: { text: string; demo: Demo }[] }

const CORR = ["########", "#>....F#", "########"];
const LSHAPE = ["######", "#>...#", "####.#", "####.#", "####F#", "######"];
const STAIRS = ["#######", "#####F#", "####..#", "###..##", "##..###", "#>.####", "#######"];
const RING = ["######", "#*..*#", "#.##.#", "#.##.#", "#*..*#", "######"];

export const LESSONS: Record<string, Lesson> = {
  seq: { id: "seq", title: "顺序：一步接一步", steps: [
    { text: "机器人按积木从上到下的顺序，一步一步执行。", demo: { rows: ["######", "#>..F#", "######"], program: "move move move" } },
    { text: "“前进”走一格。“左转”和“右转”只改变方向，不会移动。", demo: { rows: ["#####", "#..F#", "#.###", "#^###", "#####"], program: "move move right move move" } },
    { text: "拿星星和开灯，要先走到那一格。", demo: { rows: ["#######", "#>*LF##", "#######"], program: "move take move light move" } },
    { text: "撞到墙，程序就停止。运行失败时，可以用“提示”或“单步”找出错误。", demo: { rows: ["####", "#>.#", "####"], program: "move move" } },
  ] },
  loop: { id: "loop", title: "循环：重复做同一件事", steps: [
    { text: "同样的积木反复出现时，可以用“重复”积木代替。", demo: { rows: CORR, program: "repeat 5 { move }" } },
    { text: "“重复 ×4”表示里面的积木执行 4 遍。", demo: { rows: STAIRS, program: "repeat 4 { move left move right }" } },
    { text: "数字可以用 + 和 − 修改。重复的积木越少，程序越短，得到的星星越多。", demo: { rows: ["#####", "#>.F#", "#####"], program: "repeat 2 { move }" } },
  ] },
  nest: { id: "nest", title: "循环里面的循环", steps: [
    { text: "一个“重复”里面可以再放一个“重复”。", demo: { rows: RING, start: { x: 1, y: 1, dir: 1 }, program: "repeat 4 { repeat 3 { move } take right }" } },
    { text: "里面的循环走一条边，外面的循环把四条边走完。", demo: { rows: RING, start: { x: 1, y: 1, dir: 1 }, program: "repeat 4 { repeat 3 { move } take right }" } },
  ] },
  until: { id: "until", title: "直到：不知道要重复几次", steps: [
    { text: "不知道要走几步时，用“直到”：条件成立之前，一直重复。", demo: { rows: CORR, program: "until onFlag { move }" } },
    { text: "条件“到达旗子”成立时，循环就停止。", demo: { rows: STAIRS, program: "until onFlag { move left move right }" } },
  ] },
  if: { id: "if", title: "如果：遇到情况再行动", steps: [
    { text: "“如果”积木先检查条件。条件成立，才执行里面的积木。", demo: { rows: ["##########", "#>*.*.*.F#", "##########"], program: "repeat 7 { if starHere { take } move }" } },
    { text: "条件不成立时，里面的积木被跳过，程序继续往下走。", demo: { rows: ["##########", "#>*.*.*.F#", "##########"], program: "repeat 7 { if starHere { take } move }" } },
  ] },
  ifelse: { id: "ifelse", title: "如果……否则……", steps: [
    { text: "条件成立，做上面一部分。条件不成立，做“否则”下面的一部分。", demo: { rows: LSHAPE, program: "until onFlag { if pathAhead { move } else { right } }" } },
    { text: "这个程序在拐弯的地方转弯，其他地方前进。同一个程序可以走不同的路。", demo: { rows: LSHAPE, program: "until onFlag { if pathAhead { move } else { right } }" } },
  ] },
  while: { id: "while", title: "当：条件成立时一直重复", steps: [
    { text: "“当”积木：条件成立时重复，条件不成立就停止。", demo: { rows: LSHAPE, program: "while pathAhead { move } right while pathAhead { move }" } },
    { text: "“当”先检查再执行。条件一开始就不成立，里面的积木一次也不执行。", demo: { rows: LSHAPE, program: "while pathAhead { move } right while pathAhead { move }" } },
  ] },
  func: { id: "func", title: "函数：自己的积木", steps: [
    { text: "把常用的几步放进“定义”，并起一个名字。", demo: { rows: ["######", "#>***#", "######"], program: "def step { move take } step step step" } },
    { text: "用“运行”积木调用它。想用几次，就调用几次。", demo: { rows: ["######", "#>***#", "######"], program: "def step { move take } step step step" } },
    { text: "只要改一次定义，所有的调用都会跟着改变。", demo: { rows: ["######", "#>***#", "######"], program: "def step { move take } step step step" } },
  ] },
  param: { id: "param", title: "带数字的函数", steps: [
    { text: "名字后面的 n 是一个数字。调用时，可以给 n 不同的值。", demo: { rows: ["#####", "#>..#", "###.#", "###.#", "###.#", "#####"], program: "def walk(n) { repeat n { move } } walk(2) right walk(3)" } },
    { text: "walk(2) 走 2 格，walk(3) 走 3 格。定义只写一次。", demo: { rows: ["#####", "#>..#", "###.#", "###.#", "###.#", "#####"], program: "def walk(n) { repeat n { move } } walk(2) right walk(3)" } },
  ] },
  var: { id: "var", title: "变量：会变化的数字", steps: [
    { text: "变量像一个有名字的盒子，里面放着一个数字。", demo: { rows: ["######", "#>..F#", "######"], program: "repeat 3 { move change count by 1 }" } },
    { text: "“改变”让数字增加或减少，“设定”直接给它一个数字。", demo: { rows: ["######", "#>..F#", "######"], program: "repeat 3 { move change count by 1 }" } },
  ] },
  arith: { id: "arith", title: "算一算", steps: [
    { text: "“设定”可以做加法、减法和乘法，例如 s = a + b。", demo: { rows: ["########", "#>....F#", "########"], program: "set a = 2 set b = 3 set s = a + b repeat s { move }" } },
    { text: "变量可以放进“重复”里。这样，程序对不同的数字都有效。", demo: { rows: ["########", "#>....F#", "########"], program: "set a = 2 set b = 3 set s = a + b repeat s { move }" } },
  ] },
  turtle: { id: "turtle", title: "画图：笔跟着积木走", steps: [
    { text: "小海龟带着笔前进，走过的路线就是图画。", demo: { turtle: true, program: "fd 60" } },
    { text: "“右转”按度数转弯。转 90 度就是直角。", demo: { turtle: true, program: "fd 60 tr 90 fd 60" } },
    { text: "正方形有 4 条边，每次转 90 度，重复 4 次。", demo: { turtle: true, program: "repeat 4 { fd 50 tr 90 }" } },
  ] },
  pen: { id: "pen", title: "笔和颜色", steps: [
    { text: "“抬笔”之后移动不会画线，“落笔”之后继续画线。", demo: { turtle: true, origin: { x: -40, y: 15 }, program: "repeat 4 { fd 30 tr 90 } penup tr 90 fd 50 pendown repeat 4 { fd 30 tr 90 }" } },
    { text: "“颜色”积木改变后面画出的线条的颜色。", demo: { turtle: true, origin: { x: -40, y: 15 }, program: "color red repeat 4 { fd 30 tr 90 } penup tr 90 fd 50 pendown color blue repeat 3 { fd 30 tr 120 }" } },
  ] },
};
