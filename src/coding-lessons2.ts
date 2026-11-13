/**
 * 编程 worlds 7-10: the mini-lessons of the new concepts (2-4 steps, each with a demo that runs by itself). The demos are of two new kinds: sprites on a stage
 * and lists / bars / a graph / a balance scale; the others are the robot and the turtle of phase 1. The first level that needs a concept opens its lesson,
 * the ? button of a level opens it again. Written by a model; a teacher must proofread.
 */
import { parse } from "./coding-ast";
import { Machine, State, LevelData, makeTurtle } from "./coding-interp";
import type { Demo, Lesson } from "./coding-lessons";
import { StageRun, StageExt, SpriteSpec, Input } from "./coding-stage";
import { stageView, dataView } from "./coding-views";

export interface StageDemo { sprites: SpriteSpec[]; texts?: Record<string, string>; msgs?: Record<string, string>; inputs?: Input[]; ticks?: number; vars?: string[] }
export interface DataDemo { lists: Record<string, number[]>; vars?: Record<string, number>; view?: "list" | "bars" | "graph" | "scale"; data?: LevelData }

const CAT: SpriteSpec = { id: "cat", art: "cat", x: -70, y: -10, label: "小猫" };
const DOG: SpriteSpec = { id: "dog", art: "dog", x: 70, y: -10, label: "小狗" };
const BIRD: SpriteSpec = { id: "bird", art: "bird", x: 0, y: -10, label: "小鸟" };
const TEXTS = { hi: "你好！", hi2: "你好，小猫！", meow: "喵！", ok: "答对了！" };
const sd = (program: string, sprites: SpriteSpec[], o: Partial<StageDemo> = {}): Demo => ({ kind: "stage", program, ext: { sprites, texts: TEXTS, ...o } satisfies StageDemo });
const dd = (program: string, lists: Record<string, number[]>, o: Partial<DataDemo> = {}): Demo => ({ kind: "data", program, ext: { lists, ...o } satisfies DataDemo });
const tap = (tick: number, sprite = "cat"): Input => ({ tick, type: "tap", sprite });
const CORR = ["########", "#>....F#", "########"];
const GRAPH: LevelData = { graph: { n: 6, edges: [[1, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 6]], pos: [[50, 12], [20, 36], [80, 36], [20, 70], [80, 70], [50, 90]] } };
const BFS = "setItem(dist, 1, 0) add(q, 1) set head = 1 while head <= len(q) { set u = item(q, head) change head by 1 for k = 1 to deg(u) { set v = nbr(u, k) if item(dist, v) == -1 { setItem(dist, v, item(dist, u) + 1) add(q, v) } } }";
const SORT = "for i = 1 to 4 { set m = i for j = i + 1 to 5 { if item(xs, j) < item(xs, m) { set m = j } } swap(xs, i, m) }";
const BUBBLE = "for i = 1 to 4 { for j = 1 to 5 - i { if item(xs, j) > item(xs, j + 1) { swap(xs, j, j + 1) } } }";
const BIN = "set lo = 1 set hi = len(xs) set pos = 0 while lo <= hi and pos == 0 { set mid = floor((lo + hi) / 2) if item(xs, mid) == 11 { set pos = mid } else { if item(xs, mid) < 11 { set lo = mid + 1 } else { set hi = mid - 1 } } }";

export const LESSONS2: Record<string, Lesson> = {
  stage: { id: "stage", title: "舞台和角色", steps: [
    { text: "舞台上有角色。每个角色都可以有自己的程序。", demo: sd("on start cat { smove 60 }", [CAT]) },
    { text: "“当开始运行”的程序，在点“运行”时开始。", demo: sd("on start cat { smove 60 say hi }", [CAT]) },
    { text: "“走”让角色移动，“说”让角色说话。", demo: sd("on start cat { smove 40 sturn 90 say hi }", [CAT]) },
  ] },
  events: { id: "events", title: "事件：等一件事发生", steps: [
    { text: "事件是发生的一件事：角色被点击、按下一个键、收到一条消息。", demo: sd("on tap cat { say meow }", [CAT], { inputs: [tap(24)], ticks: 70 }) },
    { text: "选择积木上方的事件，程序就在这件事发生时开始。", demo: sd("on key(right) cat { changex 30 }", [CAT], { inputs: [{ tick: 20, type: "key", key: "right" }, { tick: 45, type: "key", key: "right" }], ticks: 80 }) },
    { text: "事件没有发生时，这段程序不会运行。", demo: sd("on tap cat { say meow }", [CAT], { inputs: [tap(60)], ticks: 100 }) },
  ] },
  anim: { id: "anim", title: "动画：重复和等待", steps: [
    { text: "重复“走”和“下一个造型”，角色就像在走路。", demo: sd("on start cat { repeat 8 { smove 10 nextcostume } }", [CAT], { ticks: 60 }) },
    { text: "每重复一次，角色会停一小会儿，所以动作一格一格地出现。", demo: sd("on start cat { repeat 8 { smove 10 nextcostume } }", [CAT], { ticks: 60 }) },
    { text: "“一直重复”不会停下。时钟的秒针就是这样转的。", demo: sd("on start hand { forever { wait 0.5 sturn 6 } }", [{ id: "hand", art: "hand", x: 0, y: 0, dir: 0, label: "秒针" }], { ticks: 130 }) },
  ] },
  random: { id: "random", title: "随机数", steps: [
    { text: "“随机数 a 到 b”每次给出 a 和 b 之间的一个数。", demo: sd("on tap cat { goto(rand(-80, 80), rand(-50, 50)) }", [CAT], { inputs: [tap(20), tap(50), tap(80)], ticks: 110 }) },
    { text: "用了随机数，每次点击，角色都会去不同的地方。", demo: sd("on tap cat { goto(rand(-80, 80), rand(-50, 50)) }", [CAT], { inputs: [tap(20), tap(50), tap(80)], ticks: 110 }) },
  ] },
  broadcast: { id: "broadcast", title: "广播消息", steps: [
    { text: "角色可以广播一条消息。别的角色收到消息，就开始行动。", demo: sd("on start cat { say hi broadcast hello } on recv(hello) dog { say hi2 }", [CAT, DOG], { msgs: { hello: "问候" }, ticks: 70 }) },
    { text: "消息像传话：一个角色说完，另一个角色接着说。", demo: sd("on start cat { say hi wait 1 broadcast hello } on recv(hello) dog { say hi2 }", [CAT, DOG], { msgs: { hello: "问候" }, ticks: 70 }) },
  ] },
  music: { id: "music", title: "音乐：音符和拍数", steps: [
    { text: "“弹音符”给出音高和拍数。1 是“多”，2 是“来”，3 是“咪”。", demo: sd("on start bird { note(60, 1) changey 20 note(62, 1) changey 20 note(64, 2) }", [BIRD], { ticks: 80 }) },
    { text: "“重复”可以让同一个音符弹好几遍。", demo: sd("on start bird { repeat 3 { note(60, 1) changey 12 } }", [BIRD], { ticks: 80 }) },
  ] },
  score: { id: "score", title: "分数：变量和碰到", steps: [
    { text: "变量可以记分。每答对一次，分数增加 1。", demo: sd("on tap a { say ok change score by 1 }", [{ id: "a", art: "btn", text: "✓", x: 0, y: -10, label: "对" }], { vars: ["score"], inputs: [tap(20, "a"), tap(50, "a")], ticks: 80 }) },
    { text: "“碰到”和“按住某个键”可以放进“如果”里使用。", demo: sd("on start cat { forever { if keyDown(right) { changex 8 } } }", [CAT], { inputs: [{ tick: 10, type: "key", key: "right", hold: 18 }], ticks: 50 }) },
  ] },
  params2: { id: "params2", title: "有两个数字的函数", steps: [
    { text: "函数可以有几个数字，名字后面的括号里写出它们。", demo: { turtle: true, origin: { x: -30, y: 15 }, program: "def rect(a, b) { repeat 2 { fd a tr 90 fd b tr 90 } } rect(60, 30)" } },
    { text: "调用时按顺序给出每个数字：先 a，再 b。", demo: { turtle: true, origin: { x: -30, y: 15 }, program: "def rect(a, b) { repeat 2 { fd a tr 90 fd b tr 90 } } rect(60, 30) rect(30, 15)" } },
  ] },
  return: { id: "return", title: "返回值", steps: [
    { text: "有些函数会算出一个结果。“返回”把结果交给调用的地方。", demo: dd("def double(x) { return x * 2 } set r = double(4)", {}) },
    { text: "调用的地方可以直接使用这个结果，例如放进变量。", demo: dd("def sum3(a, b, c) { return a + b + c } set r = sum3(1, 2, 3) * 2", {}) },
  ] },
  recursion: { id: "recursion", title: "函数调用自己", steps: [
    { text: "函数可以调用自己。每调用一次，就把同样的事再做一遍。", demo: { rows: CORR, program: "def go { if pathAhead { move go } } go" } },
    { text: "“如果前方有路”是停止的条件：没有路时，不再调用自己。", demo: { rows: CORR, program: "def go { if pathAhead { move go } } go" } },
  ] },
  base: { id: "base", title: "停止条件", steps: [
    { text: "递归一定要有停止条件，否则会一直调用下去。", demo: dd("def total(n) { if n == 0 { return 0 } return n + total(n - 1) } set r = total(3)", {}) },
    { text: "total(3) 等于 3 加 total(2)。一层一层算下去，再一层一层返回。", demo: dd("def total(n) { if n == 0 { return 0 } return n + total(n - 1) } set r = total(4)", {}) },
  ] },
  fractal: { id: "fractal", title: "递归画图", steps: [
    { text: "树枝上长出两个更小的树枝，小树枝上再长更小的。", demo: { turtle: true, origin: { x: 0, y: 40 }, program: "def tree(n) { if n > 8 { fd n tl 30 tree(n / 2) tr 60 tree(n / 2) tl 30 fd 0 - n } } tree(36)" } },
    { text: "每个小树枝的长度是上一级的一半，小于 8 就不再画。", demo: { turtle: true, origin: { x: 0, y: 40 }, program: "def tree(n) { if n > 8 { fd n tl 30 tree(n / 2) tr 60 tree(n / 2) tl 30 fd 0 - n } } tree(36)" } },
  ] },
  list: { id: "list", title: "列表：一排有编号的盒子", steps: [
    { text: "列表像一排盒子，每个盒子里有一个数，盒子从 1 开始编号。", demo: dd("add(xs, 4) add(xs, 8) add(xs, 15)", { xs: [] }) },
    { text: "“加入”把一个数放到列表的最后。", demo: dd("add(xs, 4) add(xs, 8) add(xs, 15)", { xs: [] }) },
    { text: "“第 □ 项”读出第几个盒子里的数，“长度”说明有几个盒子。", demo: dd("set a = item(xs, 2) set n = len(xs)", { xs: [4, 8, 15] }) },
  ] },
  each: { id: "each", title: "对每一项", steps: [
    { text: "“对每一项”让列表里的数一个一个轮流出现。", demo: dd("each x in xs { change s by x }", { xs: [3, 5, 2, 6] }) },
    { text: "把每一项都加起来，就得到总和。", demo: dd("each x in xs { change s by x }", { xs: [3, 5, 2, 6] }) },
  ] },
  agg: { id: "agg", title: "最大值：比较和记住", steps: [
    { text: "先假设第 1 项最大，再逐项比较：更大的数换成新的最大值。", demo: dd("set m = item(xs, 1) each x in xs { if x > m { set m = x } }", { xs: [4, 9, 3, 7] }, { view: "bars" }) },
    { text: "比较完所有的数，m 就是最大值。", demo: dd("set m = item(xs, 1) each x in xs { if x > m { set m = x } }", { xs: [4, 9, 3, 7] }, { view: "bars" }) },
  ] },
  filter: { id: "filter", title: "筛选", steps: [
    { text: "把“如果”放进“对每一项”，就可以只挑出需要的数。", demo: dd("each x in xs { if x % 2 == 0 { add(evens, x) } }", { xs: [3, 8, 5, 6, 2], evens: [] }) },
    { text: "x mod 2 等于 0，说明 x 是偶数。", demo: dd("each x in xs { if x % 2 == 0 { add(evens, x) } }", { xs: [3, 8, 5, 6, 2], evens: [] }) },
  ] },
  nested: { id: "nested", title: "循环里的循环", steps: [
    { text: "外层循环选一个数，内层循环让它和后面的每个数比较。", demo: dd("for i = 1 to 3 { for j = i + 1 to 4 { if item(xs, i) + item(xs, j) == 10 { change pairs by 1 } } }", { xs: [3, 7, 4, 6] }) },
    { text: "这样每一对数只会比较一次。", demo: dd("for i = 1 to 3 { for j = i + 1 to 4 { if item(xs, i) + item(xs, j) == 10 { change pairs by 1 } } }", { xs: [3, 7, 4, 6] }) },
  ] },
  search: { id: "search", title: "顺序查找", steps: [
    { text: "从第 1 项开始一个一个地看，直到找到要找的数。", demo: dd("set pos = 0 set i = 1 while i <= len(xs) and pos == 0 { if item(xs, i) == 7 { set pos = i } change i by 1 }", { xs: [4, 9, 7, 3, 8] }, { view: "bars" }) },
    { text: "找到以后马上停下来，用的步数更少。“步数”会显示出来。", demo: dd("set pos = 0 set i = 1 while i <= len(xs) and pos == 0 { if item(xs, i) == 7 { set pos = i } change i by 1 }", { xs: [4, 9, 7, 3, 8] }, { view: "bars" }) },
  ] },
  binary: { id: "binary", title: "二分查找", steps: [
    { text: "排好顺序的列表，每次看中间的数，就能去掉一半。", demo: dd(BIN, { xs: [1, 3, 4, 6, 8, 9, 11, 13, 15, 16, 18, 20, 22, 25, 27] }, { view: "bars" }) },
    { text: "64 个数最多看 7 次，顺序查找最多要看 64 次。", demo: dd(BIN, { xs: [1, 3, 4, 6, 8, 9, 11, 13, 15, 16, 18, 20, 22, 25, 27] }, { view: "bars" }) },
  ] },
  sort: { id: "sort", title: "排序", steps: [
    { text: "选择排序：每一轮找出最小的数，换到最前面。", demo: dd(SORT, { xs: [5, 2, 8, 1, 9] }, { view: "bars" }) },
    { text: "冒泡排序：相邻的两个数，左边大就交换。", demo: dd(BUBBLE, { xs: [5, 2, 8, 1, 9] }, { view: "bars" }) },
    { text: "“交换”的次数也会显示出来。", demo: dd(SORT, { xs: [5, 2, 8, 1, 9] }, { view: "bars" }) },
  ] },
  greedy: { id: "greedy", title: "贪心：每次选最大的", steps: [
    { text: "找零钱时，每次先用面值最大的硬币。", demo: dd("each c in coins { while amt >= c { change amt by 0 - c change n by 1 } }", { coins: [25, 10, 5, 1] }, { vars: { amt: 41 } }) },
    { text: "n 记下用了几枚硬币。", demo: dd("each c in coins { while amt >= c { change amt by 0 - c change n by 1 } }", { coins: [25, 10, 5, 1] }, { vars: { amt: 41 } }) },
  ] },
  euclid: { id: "euclid", title: "辗转相除", steps: [
    { text: "求最大公约数：用 a 除以 b 的余数代替 b，直到 b 是 0。", demo: dd("while b != 0 { set t = b set b = a % b set a = t } set g = a", {}, { vars: { a: 48, b: 18 } }) },
    { text: "步骤很少，数字再大也很快。", demo: dd("while b != 0 { set t = b set b = a % b set a = t } set g = a", {}, { vars: { a: 48, b: 18 } }) },
  ] },
  bfs: { id: "bfs", title: "最短路线：一圈一圈地找", steps: [
    { text: "先处理离出发点近的地点，再处理远的，像水波一圈一圈扩大。", demo: dd(BFS, { dist: [-1, -1, -1, -1, -1, -1], q: [] }, { view: "graph", data: GRAPH }) },
    { text: "dist 记录每个地点到出发点的最少步数。", demo: dd(BFS, { dist: [-1, -1, -1, -1, -1, -1], q: [] }, { view: "graph", data: GRAPH }) },
  ] },
  scale: { id: "scale", title: "天平：用最少的次数比较", steps: [
    { text: "天平一次只能比较两个硬币。比较一次，就用掉一次。", demo: dd("set best = 1 for i = 2 to 5 { if heavier(i, best) { set best = i } }", {}, { view: "scale", data: { weights: [30, 55, 20, 80, 40] } }) },
    { text: "找最重的硬币：每个硬币和目前最重的比一次，一共 n − 1 次。", demo: dd("set best = 1 for i = 2 to 5 { if heavier(i, best) { set best = i } }", {}, { view: "scale", data: { weights: [30, 55, 20, 80, 40] } }) },
  ] },
};

// ---------- the runner of the new demos ----------
export function demoRunner2(box: HTMLElement, demo: Demo): () => void {
  let timer = 0, dead = false;
  const build = () => {
    const prog = parse(demo.program);
    if (demo.kind === "stage") {
      const e = demo.ext as StageDemo;
      const ext: StageExt = { sprites: e.sprites, slots: [], inputs: e.inputs ?? [], ticks: e.ticks ?? 70, checks: [], texts: e.texts ?? {}, msgs: e.msgs, vars: e.vars ?? ["score"] };
      const view = stageView(ext);
      const run = new StageRun(prog, ext);
      box.replaceChildren(view.el);
      view.render(run.state.stage!, run.state.vars);
      const tick = () => {
        if (dead) return;
        const t = run.tick;
        run.step();
        for (const i of ext.inputs.filter((q) => q.tick === t)) {
          if (i.type === "tap") { const s = run.state.stage!.sprites.find((q) => q.id === i.sprite); if (s) view.ripple(s.x, s.y); }
        }
        view.render(run.state.stage!, run.state.vars);
        timer = window.setTimeout(run.status === "running" && run.tick < ext.ticks ? tick : build, run.status === "running" && run.tick < ext.ticks ? 50 : 1600);
      };
      timer = window.setTimeout(tick, 600);
    } else {
      const e = demo.ext as DataDemo;
      const t = makeTurtle().state;
      const state: State = { ...t, vars: { ...(e.vars ?? {}) }, lists: JSON.parse(JSON.stringify(e.lists)), data: e.data ? JSON.parse(JSON.stringify(e.data)) : undefined, seed: 1 };
      const m = new Machine(prog, { kind: "data" }, state, { maxDepth: 200 });
      const view = dataView({ view: e.view ?? "list", lists: Object.keys(e.lists), weights: e.data?.weights });
      box.replaceChildren(view.el);
      view.render(m.state, { steps: 0 });
      const tick = () => {
        if (dead) return;
        const info = m.step();
        view.render(m.state, { steps: m.steps });
        timer = window.setTimeout(info && m.status === "running" ? tick : build, info && m.status === "running" ? 330 : 1700);
      };
      timer = window.setTimeout(tick, 600);
    }
  };
  build();
  return () => { dead = true; clearTimeout(timer); };
}
