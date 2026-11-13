/**
 * 编程 world 15 (网络与信息安全 + 人工智能启蒙): the interactive labs that are not plain quizzes: a packet journey through routers, a password meter, k nearest
 * neighbours (train / test, overfitting), a decision tree built by hand, rule against learning, an inverted index, a biased data set, a tiny digit recogniser.
 * Same contract as coding-infolabs.ts. Everything is small and runs in the page; the digit model is trained from samples made by code at first use.
 */
import { h } from "./ui";
import * as I from "./coding-infomodel";
import { Mount, btn, clickEl } from "./coding-infolabs";
import { L, Tri } from "./coding-infocontent";

// ---------- a packet journey ----------
interface Net { nodes: { id: string; x: number; y: number; label?: string }[]; edges: [string, string][] }
export const route: Mount = (root, io) => {
  const s = io.act.spec as { net: Net; from: string; to: string; ttl: number; msg: string; size: number; blocked?: Record<number, [string, string]> };
  const g: I.Graph = {}; for (const n of s.net.nodes) g[n.id] = [];
  for (const [a, b] of s.net.edges) { g[a].push(b); g[b].push(a); }
  const packets = I.splitMessage(s.msg, s.size);
  let pi = 0, path = [s.from], phase: "route" | "order" = "route", got: number[] = [];
  const arrival = I.shuffle(packets, I.rng(io.seed + 4));
  const map = h("div", { class: "ci-net user" }), info = h("p", { class: "ci-live user" }), pk = h("div", { class: "ci-packets user" }), line = h("div", { class: "ci-msg user" });
  root.append(info, map, pk, line, btn("ci-reset", "重新走", () => { path = [s.from]; draw(); }));
  io.prompt(L(io.act.prompt));
  const blockedNow = (a: string, b: string) => { const bl = s.blocked?.[pi]; return !!bl && ((bl[0] === a && bl[1] === b) || (bl[0] === b && bl[1] === a)); };
  const draw = () => {
    const blk = s.blocked?.[pi];
    map.innerHTML = `<svg viewBox="0 0 300 190" class="ci-netsvg" aria-hidden="true">${s.net.edges.map(([a, b]) => { const A = s.net.nodes.find((n) => n.id === a)!, B = s.net.nodes.find((n) => n.id === b)!; const bk = blk && blockedNow(a, b); const used = path.some((p, i) => i > 0 && ((path[i - 1] === a && p === b) || (path[i - 1] === b && p === a))); return `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="${bk ? "#fa5252" : used ? "#f76707" : "#adb5bd"}" stroke-width="${used ? 5 : 3}" ${bk ? 'stroke-dasharray="4 5"' : ""}/>`; }).join("")}</svg>`;
    for (const n of s.net.nodes) {
      const here = path[path.length - 1] === n.id;
      map.append(h("button", { class: "ci-btn ci-node" + (here ? " here" : "") + (n.id === s.to ? " server" : "") + (n.id === s.from ? " client" : ""), type: "button", "data-n": n.id, style: `left:${(n.x / 300) * 100}%;top:${(n.y / 190) * 100}%`, "aria-label": n.id, onclick: () => step(n.id) }, n.label ?? n.id));
    }
    if (phase === "route") { info.textContent = `${pi + 1} / ${packets.length}   TTL ${s.ttl - (path.length - 1)}`; pk.replaceChildren(h("span", { class: "ci-pk cur" }, `#${packets[pi].seq} ${packets[pi].data}`)); }
  };
  const step = (id: string) => {
    if (phase !== "route") return;
    const cur = path[path.length - 1];
    if (!g[cur].includes(id) || blockedNow(cur, id)) { io.bad(); return io.say(blockedNow(cur, id) ? "这条线路堵住了。请换一条。" : "这两个节点之间没有连线。", "bad"); }
    path.push(id);
    if (path.length - 1 > s.ttl) { io.bad(); io.say("TTL 用完了，数据包被丢弃。请重新走。", "bad"); path = [s.from]; return draw(); }
    if (id === s.to) {
      pi++; path = [s.from];
      if (pi >= packets.length) { phase = "order"; io.say("所有数据包都到达了。它们的顺序被打乱了。", "ok"); return orderPhase(); }
      io.say("数据包已到达。", "ok");
    }
    draw();
  };
  const orderPhase = () => {
    map.hidden = true; info.textContent = ""; line.textContent = "";
    pk.replaceChildren(...arrival.map((p) => h("button", { class: "ci-btn ci-pk", type: "button", "data-seq": String(p.seq), onclick: () => tapPk(p.seq) }, `#${p.seq} ${p.data}`)));
    io.prompt(L(io.c.genPrompts.reassemble));
  };
  const tapPk = (seq: number) => {
    if (got.includes(seq)) return;
    if (seq !== got.length + 1) { io.bad(); return io.say("顺序不对。请按编号 1、2、3 …… 依次点击。", "bad"); }
    got.push(seq); line.textContent = got.map((q) => packets[q - 1].data).join("");
    pk.querySelector(`[data-seq="${seq}"]`)?.setAttribute("disabled", "true");
    if (got.length === packets.length) { io.say("信息已还原。", "ok"); io.win(); }
  };
  draw();
  return {
    solve: () => {
      for (let k = 0; k < packets.length; k++) {
        const bl = s.blocked?.[pi];
        const gg: I.Graph = {}; for (const n of Object.keys(g)) gg[n] = g[n].filter((m) => !(bl && ((bl[0] === n && bl[1] === m) || (bl[1] === n && bl[0] === m))));
        const p = I.shortestPath(gg, s.from, s.to)!;
        for (const n of p.slice(1)) clickEl(map.querySelector(`[data-n="${n}"]`));
      }
      for (let q = 1; q <= packets.length; q++) clickEl(pk.querySelector(`[data-seq="${q}"]`));
    },
    wrong: () => { const far = s.net.nodes.find((n) => n.id !== s.from && !g[s.from].includes(n.id) && n.id !== s.from)!; clickEl(map.querySelector(`[data-n="${far.id}"]`)); },
  };
};

// ---------- passwords ----------
export const password: Mount = (root, io) => {
  const s = io.act.spec as { tasks: { level: number; p: string; forbid?: string[] }[] };
  let ti = 0;
  const inp = h("input", { class: "ci-input wide user", id: "ci-pw", type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: false, "aria-label": "password", maxlength: "40" }) as HTMLInputElement;
  const meter = h("div", { class: "ci-meter" }, ...[0, 1, 2, 3, 4].map((i) => h("i", { "data-i": String(i) }))), bits = h("p", { class: "ci-live user" }), task = h("p", { class: "ci-task user" }), prog = h("div", { class: "ci-prog" });
  const time = h("p", { class: "ci-time" });
  root.append(prog, task, inp, meter, bits, time, btn("ci-check", "检查", () => check(), "primary"));
  const upd = () => {
    const pw = inp.value, b = I.entropyBits(pw), lv = pw ? I.strengthLevel(pw) : -1;
    meter.querySelectorAll("i").forEach((e, i) => { e.className = i <= lv ? "on l" + lv : ""; });
    const t = I.humanTime(I.crackSeconds(b));
    bits.textContent = `${Math.round(b)} bits`;
    time.textContent = !pw ? "" : t.unit === "s" && t.v === 0 ? "不到 1 秒" : `约 ${t.v} ${({ s: "秒", min: "分钟", h: "小时", d: "天", y: "年", ky: "千年", my: "百万年以上" })[t.unit]}`;
  };
  inp.addEventListener("input", upd);
  const show = () => { prog.textContent = `${ti + 1} / ${s.tasks.length}`; task.textContent = s.tasks[ti].p; io.prompt(L(io.act.prompt)); inp.value = ""; upd(); };
  const check = () => {
    const t = s.tasks[ti], pw = inp.value;
    if (!pw) return io.say("请先输入密码。", "bad");
    if (t.forbid?.some((f) => pw.toLowerCase().includes(f.toLowerCase()))) { io.bad(); return io.say("密码里不能包含个人信息或简单的数字串。", "bad"); }
    if (I.strengthLevel(pw) < t.level) { io.bad(); return io.say("密码还不够强。请加长，并混合大小写字母、数字和符号。", "bad"); }
    ti++;
    if (ti >= s.tasks.length) { io.say("全部正确。", "ok"); return io.win(); }
    io.say("正确。", "ok"); show();
  };
  show();
  const GOOD = "Tr33#Rocket!Moon_47";
  return { solve: () => { for (let k = 0; k < s.tasks.length; k++) { inp.value = GOOD; upd(); check(); } }, wrong: () => { inp.value = "123456"; upd(); check(); } };
};

// ---------- k nearest neighbours ----------
const A_COL = "#4dabf7", B_COL = "#ffa94d";
export const knnLab: Mount = (root, io) => {
  const s = io.act.spec as { task: "find" | "k"; names: Tri[]; per: number; flip: number; spread: number; tasks?: { goal: "train" | "test"; p: string }[]; goals?: number };
  const train = I.makeBlobs(io.seed % 50 + 1, 2, s.per, s.spread, s.flip), test = I.makeBlobs(io.seed % 50 + 101, 2, 100, s.spread, s.flip);
  const KS = [1, 3, 5, 9, 15, 25];
  let k = s.task === "find" ? 3 : 1, ti = 0, found = 0, want = 1, probe: { x: number; y: number } | null = null;
  const plane = h("div", { class: "ci-plane", id: "ci-plane" }), info = h("p", { class: "ci-live user" }), task = h("p", { class: "ci-task user" });
  const chips = h("div", { class: "ci-choices" }, ...KS.map((v) => h("button", { class: "ci-btn ci-choice", type: "button", "data-k": String(v), onclick: () => { k = v; draw(); } }, `k = ${v}`)));
  root.append(task, plane, info);
  if (s.task === "k") root.append(chips, btn("ci-check", "检查", () => check(), "primary"));
  const accs = KS.map((kk) => I.knnAccuracy(train, test, kk));
  const bestK = KS[accs.indexOf(Math.max(...accs))];
  const draw = () => {
    const b = s.task === "k" ? I.boundary(train, k, 20, 20) : I.boundary(train, k, 20, 20);
    const cells = b.map((row, j) => row.map((c, i) => `<rect x="${i * 5}" y="${j * 5}" width="5.1" height="5.1" fill="${c ? B_COL : A_COL}" opacity=".22"/>`).join("")).join("");
    const pts = train.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="2.4" fill="${p.c ? B_COL : A_COL}" stroke="#495057" stroke-width=".5"/>`).join("");
    const tpts = s.task === "k" && ti === 1 ? test.slice(0, 60).concat(test.slice(100, 160)).map((p) => `<path d="M${p.x - 1.6} ${p.y - 1.6}l3.2 3.2m0-3.2l-3.2 3.2" stroke="${p.c ? "#e8590c" : "#1971c2"}" stroke-width=".9"/>`).join("") : "";
    const pr = probe ? `<circle cx="${probe.x}" cy="${probe.y}" r="3.4" fill="#fff" stroke="#212529" stroke-width="1.2"/><circle cx="${probe.x}" cy="${probe.y}" r="6.5" fill="none" stroke="${I.knn(train, probe, k) ? B_COL : A_COL}" stroke-width="1.6"/>` : "";
    plane.innerHTML = `<svg viewBox="0 0 100 100" class="ci-planesvg" role="img" aria-label="plane">${cells}${pts}${tpts}${pr}</svg>`;
    chips.querySelectorAll("button").forEach((c) => c.classList.toggle("on", Number((c as HTMLElement).dataset.k) === k));
    if (s.task === "k") info.textContent = `k = ${k}   ${L(["训练准确率", "Training accuracy", "Précision d'entraînement"])} ${Math.round(I.knnAccuracy(train, train, k) * 100)}%   ${L(["测试准确率", "Test accuracy", "Précision de test"])} ${Math.round(I.knnAccuracy(train, test, k) * 100)}%`;
    else info.textContent = `${found} / ${s.goals ?? 3}`;
  };
  const nameOf = (c: number) => L(s.names[c]);
  const askFind = () => { want = found % 2; task.textContent = `${L(io.act.prompt)} ${nameOf(want)}`; io.prompt(task.textContent); };
  const askK = () => { task.textContent = s.tasks![ti].p; io.prompt(L(io.act.prompt)); };
  if (s.task === "find") {
    plane.addEventListener("click", (e) => {
      const r = plane.querySelector("svg")!.getBoundingClientRect();
      probe = { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
      const c = I.knn(train, probe, k);
      if (c === want) { found++; io.say("机器的判断和目标一致。", "ok"); if (found >= (s.goals ?? 3)) { draw(); return io.win(); } askFind(); } else { io.bad(); io.say(`机器判断它是 ${nameOf(c)}。请换一个位置。`, "bad"); }
      draw();
    });
    askFind();
  } else askK();
  const check = () => {
    const g = s.tasks![ti].goal;
    const ok = g === "train" ? I.knnAccuracy(train, train, k) === 1 : accs[KS.indexOf(k)] === Math.max(...accs);
    if (!ok) { io.bad(); return io.say(g === "train" ? "训练准确率还没有达到 100%。" : "还有测试准确率更高的 k。", "bad"); }
    ti++;
    if (ti >= s.tasks!.length) { io.say("全部正确。", "ok"); return io.win(); }
    io.say("正确。", "ok"); askK(); draw();
  };
  draw();
  const clickAt = (c: number) => {
    const pts = train.filter((p) => p.c === c && I.knn(train, p, k) === c); const p = pts[0] ?? train.find((q) => q.c === c)!;
    const r = plane.querySelector("svg")!.getBoundingClientRect();
    plane.dispatchEvent(new MouseEvent("click", { clientX: r.left + (p.x / 100) * r.width, clientY: r.top + (p.y / 100) * r.height, bubbles: true }));
  };
  return {
    solve: () => { if (s.task === "find") { for (let n = 0; n < (s.goals ?? 3); n++) clickAt(want); } else { for (let n = 0; n < s.tasks!.length; n++) { k = s.tasks![ti].goal === "train" ? 1 : bestK; draw(); check(); } } },
    wrong: () => { if (s.task === "find") { clickAt(1 - want); } else { k = s.tasks![ti].goal === "train" ? 25 : (bestK === 1 ? 25 : 1); draw(); check(); } },
  };
};

// ---------- a decision tree, built by hand ----------
export const treeLab: Mount = (root, io) => {
  const s = io.act.spec as { feats: Tri[]; classes: Tri[] };
  const rows: I.Row[] = I.KIND_ROWS.map((r) => ({ f: [...r.f, 1], y: r.y }));
  const featN = s.feats.length, classes = s.classes.length;
  interface TN { rows: I.Row[]; used: number[]; feat?: number; yes?: TN; no?: TN }
  const top: TN = { rows, used: [] };
  const tree = h("div", { class: "ci-dtree user" }), info = h("p", { class: "ci-live user" });
  io.prompt(L(io.act.prompt));
  root.append(info, tree);
  const pure = (n: TN) => I.countsOf(n.rows, classes).filter((c) => c > 0).length <= 1;
  const impure = (n: TN): TN[] => (n.feat !== undefined ? [...impure(n.yes!), ...impure(n.no!)] : pure(n) ? [] : [n]);
  const questions = (n: TN): number => (n.feat === undefined ? 0 : 1 + questions(n.yes!) + questions(n.no!));
  const split = (n: TN, f: number) => {
    const g = I.infoGain(n.rows, f, classes);
    if (g < 1e-9) { io.bad(); return io.say("这个问题没有帮助：所有动物的答案都一样。", "bad"); }
    n.feat = f;
    n.yes = { rows: n.rows.filter((r) => r.f[f] === 1), used: [...n.used, f] };
    n.no = { rows: n.rows.filter((r) => r.f[f] !== 1), used: [...n.used, f] };
    io.say(`${L(["信息增益", "Information gain", "Gain d'information"])} ${g.toFixed(2)}`, "ok");
    draw();
    if (!impure(top).length) { const mt = I.buildTree(rows, [...Array(featN).keys()], classes); info.textContent = `${questions(top)} / ${I.treeQuestions(mt)}`; io.say("每个分支都已分清。", "ok"); io.win(); }
  };
  const nodeEl = (n: TN, label: string): HTMLElement => {
    const c = I.countsOf(n.rows, classes);
    const head = h("div", { class: "ci-tcounts" }, label ? h("small", {}, label) : null, ...c.map((v, i) => (v ? h("span", { class: "ci-tc c" + i }, `${L(s.classes[i])} ${v}`) : null)));
    if (n.feat !== undefined) return h("div", { class: "ci-tnode" }, head, h("div", { class: "ci-tq" }, L(s.feats[n.feat]) + "?"), h("div", { class: "ci-tkids" }, nodeEl(n.yes!, "✓"), nodeEl(n.no!, "✗")));
    if (pure(n)) return h("div", { class: "ci-tnode leaf" }, head, h("div", { class: "ci-tleaf" }, n.rows.length ? L(s.classes[n.rows[0].y]) : "—"));
    return h("div", { class: "ci-tnode open", "data-open": "1" }, head, h("div", { class: "ci-tfeats" }, ...s.feats.map((f, i) => (n.used.includes(i) ? null : h("button", { class: "ci-btn ci-tf", type: "button", "data-f": String(i), onclick: () => split(n, i) }, L(f))))));
  };
  const draw = () => { tree.replaceChildren(nodeEl(top, "")); info.textContent = `${questions(top)}`; };
  draw();
  const best = (n: TN) => { let b = -1, g = -1; for (let f = 0; f < featN; f++) if (!n.used.includes(f)) { const x = I.infoGain(n.rows, f, classes); if (x > g + 1e-12) { g = x; b = f; } } return b; };
  return {
    solve: () => { for (let guard = 0; guard < 40; guard++) { const open = impure(top); if (!open.length) break; split(open[0], best(open[0])); } },
    wrong: () => split(top, featN - 1),
  };
};

// ---------- rule against learning ----------
export const rulesLab: Mount = (root, io) => {
  const s = io.act.spec as { data: "easy" | "diag"; names: Tri[] };
  const r = I.rng(io.seed + 21), pts: I.Pt[] = [];
  for (let i = 0; i < 80; i++) { const x = I.rint(r, 2, 98), y = I.rint(r, 2, 98); let c = s.data === "easy" ? (x >= 50 ? 1 : 0) : x + y >= 100 ? 1 : 0; if (r() < 0.04) c = 1 - c; pts.push({ x, y, c }); }
  let ax = 50, ay = 50, mode: "x" | "and" | "or" = "x", tried = false, learned = false, rulesAcc = 0, mlAcc = 0;
  const plane = h("div", { class: "ci-plane" }), info = h("p", { class: "ci-live user" }), ctl = h("div", { class: "ci-rulectl user" }), ask = h("div", { class: "ci-choices", hidden: true });
  const sl = (id: string, name: string, val: number, on: (v: number) => void) => h("label", { class: "ci-slide user" }, name, h("input", { type: "range", min: "0", max: "100", step: "5", value: String(val), id, "aria-label": name, oninput: (e: Event) => { on(Number((e.target as HTMLInputElement).value)); tried = true; draw(); } }));
  const modeSel = h("select", { class: "ci-sel", id: "ci-mode", "aria-label": "rule", onchange: () => { mode = modeSel.value as typeof mode; tried = true; draw(); } }, ...[["x", "只看 x"], ["and", "x 并且 y"], ["or", "x 或者 y"]].map(([v, t]) => h("option", { value: v }, t))) as HTMLSelectElement;
  ctl.append(sl("ci-ax", "x ≥", ax, (v) => (ax = v)), sl("ci-ay", "y ≥", ay, (v) => (ay = v)), modeSel);
  root.append(plane, info, ctl, btn("ci-learn", "让机器学习", () => { learned = true; tried = true; draw(); }));
  if (s.data === "easy") root.append(btn("ci-check", "检查", () => check(), "primary"));
  root.append(ask);
  io.prompt(L(io.act.prompt));
  const rule = (p: I.Pt): number => { const a = p.x >= ax ? 1 : 0, b = p.y >= ay ? 1 : 0; return mode === "x" ? a : mode === "and" ? a & b : a | b; };
  const loo = (k = 5): number => pts.filter((p, i) => I.knn(pts.filter((_, j) => j !== i), p, k) === p.c).length / pts.length;
  const draw = () => {
    rulesAcc = pts.filter((p) => rule(p) === p.c).length / pts.length;
    mlAcc = loo();
    const shade = learned ? I.boundary(pts, 5, 20, 20).map((row, j) => row.map((c, i) => `<rect x="${i * 5}" y="${j * 5}" width="5.1" height="5.1" fill="${c ? B_COL : A_COL}" opacity=".22"/>`).join("")).join("") : "";
    plane.innerHTML = `<svg viewBox="0 0 100 100" class="ci-planesvg" role="img" aria-label="plane">${shade}<path d="M${ax} 0V100" stroke="#e03131" stroke-width="1" stroke-dasharray="3 2"/>${mode !== "x" ? `<path d="M0 ${ay}H100" stroke="#e03131" stroke-width="1" stroke-dasharray="3 2"/>` : ""}${pts.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="2.4" fill="${p.c ? B_COL : A_COL}" stroke="#495057" stroke-width=".5"/>`).join("")}</svg>`;
    info.textContent = `${L(["规则的准确率", "Rule accuracy", "Précision de la règle"])} ${Math.round(rulesAcc * 100)}%` + (learned ? `   ${L(["机器学习的准确率", "Learned accuracy", "Précision apprise"])} ${Math.round(mlAcc * 100)}%` : "");
    ask.hidden = !(s.data === "diag" && learned);
    if (!ask.hidden && !ask.children.length) ask.append(...(["rule", "learn", "same"] as const).map((v) => h("button", { class: "ci-btn ci-choice", type: "button", "data-v": v, onclick: () => answer(v) }, v === "rule" ? "规则" : v === "learn" ? "机器学习" : "一样")));
  };
  const answer = (v: string) => {
    const r2 = Math.round(rulesAcc * 100), m2 = Math.round(mlAcc * 100), right = r2 > m2 ? "rule" : m2 > r2 ? "learn" : "same";
    if (v === right) { io.say("正确。", "ok"); io.win(); } else { io.bad(); io.say("请对照两个准确率再判断。", "bad"); }
  };
  const check = () => { if (rulesAcc >= 0.9) { io.say("规则已经足够准确。", "ok"); io.win(); } else { io.bad(); io.say("准确率还没有达到 90%。请调整分界线。", "bad"); } };
  draw();
  const setSlider = (id: string, v: number) => { const el = root.querySelector<HTMLInputElement>("#" + id)!; el.value = String(v); el.dispatchEvent(new Event("input")); };
  return {
    solve: () => {
      if (s.data === "easy") { let bestA = 50, bestV = -1; for (let a = 0; a <= 100; a += 5) { const v = pts.filter((p) => (p.x >= a ? 1 : 0) === p.c).length; if (v > bestV) { bestV = v; bestA = a; } } setSlider("ci-ax", bestA); check(); }
      else { clickEl(root.querySelector("#ci-learn")); const r2 = Math.round(rulesAcc * 100), m2 = Math.round(mlAcc * 100); answer(r2 > m2 ? "rule" : m2 > r2 ? "learn" : "same"); }
    },
    wrong: () => { if (s.data === "easy") { setSlider("ci-ax", 95); check(); } else { clickEl(root.querySelector("#ci-learn")); const r2 = Math.round(rulesAcc * 100), m2 = Math.round(mlAcc * 100); answer(r2 > m2 ? "learn" : "rule"); } },
  };
};

// ---------- an inverted index ----------
export const search: Mount = (root, io) => {
  const s = io.act.spec as { docs: string[]; queries: string[][] };
  const docs = s.docs.map((d) => d.split(" ")), index = I.buildIndex(docs);
  let qi = 0; const chosen = new Set<number>();
  const list = h("div", { class: "ci-docs" }), qbox = h("p", { class: "ci-task user", id: "ci-query" }), idx = h("div", { class: "ci-index user", hidden: true }), prog = h("div", { class: "ci-prog" });
  root.append(prog, qbox, list, idx, btn("ci-check", "检查", () => check(), "primary"));
  const draw = () => list.replaceChildren(...s.docs.map((d, i) => h("button", { class: "ci-btn ci-doc user" + (chosen.has(i) ? " sel" : ""), type: "button", "data-i": String(i), "aria-pressed": String(chosen.has(i)), onclick: () => { chosen.has(i) ? chosen.delete(i) : chosen.add(i); draw(); } }, h("b", {}, String(i + 1)), d)));
  const show = () => { chosen.clear(); prog.textContent = `${qi + 1} / ${s.queries.length}`; qbox.textContent = s.queries[qi].join(" + "); io.prompt(L(io.act.prompt)); idx.hidden = true; draw(); };
  const check = () => {
    const want = I.searchAll(index, s.queries[qi]), mine = [...chosen].sort((a, b) => a - b);
    if (want.join() !== mine.join()) { io.bad(); return io.say("结果不对。请检查每个文档是否包含全部词语。", "bad"); }
    idx.hidden = false; idx.textContent = s.queries[qi].map((w) => `${w} → ${(index.get(w) ?? []).map((d) => d + 1).join(", ")}`).join("   ");
    qi++;
    if (qi >= s.queries.length) { io.say("全部正确。", "ok"); return io.win(); }
    io.say("正确。", "ok"); show();
  };
  show();
  return { solve: () => { for (let k = 0; k < s.queries.length; k++) { chosen.clear(); I.searchAll(index, s.queries[qi]).forEach((d) => chosen.add(d)); draw(); check(); } }, wrong: () => { chosen.clear(); chosen.add(I.searchAll(index, s.queries[qi])[0] === 0 ? 1 : 0); draw(); check(); } };
};

// ---------- a biased data set ----------
export const biasLab: Mount = (root, io) => {
  const data = I.biasedHistory((io.act.spec.seed as number) ?? 3);
  const on = new Set<I.BiasFeat>(["score", "group", "district"]);
  const names: Record<I.BiasFeat, string> = { score: "分数", group: "组别", district: "地区" };
  const stat = h("div", { class: "ci-biasstat user" }), res = h("div", { class: "ci-biasres user" }), boxes = h("div", { class: "ci-feats" });
  io.prompt(L(io.act.prompt));
  const rate = (g: number, lo: number, hi: number) => { const rs = data.filter((p) => p.group === g && p.score >= lo && p.score <= hi); return Math.round((rs.filter((p) => p.yes).length / Math.max(1, rs.length)) * 100); };
  stat.innerHTML = `<table class="ci-table"><tr><th></th><th>5-7</th></tr><tr><th>A</th><td>${rate(0, 5, 7)}%</td></tr><tr><th>B</th><td>${rate(1, 5, 7)}%</td></tr></table>`;
  for (const f of ["score", "group", "district"] as I.BiasFeat[]) boxes.append(h("label", { class: "ci-feat user" }, h("input", { type: "checkbox", "data-f": f, checked: true, onchange: (e: Event) => { (e.target as HTMLInputElement).checked ? on.add(f) : on.delete(f); } }), names[f]));
  root.append(stat, boxes, btn("ci-train", "训练", () => train()), res, btn("ci-check", "检查", () => check(), "primary"));
  let acc = 0, gap = 1, trained = false;
  const train = () => { const m = I.trainBias(data, [...on]); acc = I.biasAccuracy(m, data); gap = I.biasGap(m); trained = true; res.innerHTML = `<p>${L(["准确率", "Accuracy", "Précision"])} ${Math.round(acc * 100)}%</p><p>${L(["两组之间的差距", "Gap between the groups", "Écart entre les groupes"])} ${Math.round(gap * 100)}%</p><div class="ci-gapbar"><i style="width:${Math.round(gap * 100)}%"></i></div>`; };
  const check = () => {
    if (!trained) train();
    if (gap <= 0.2 && acc >= 0.85) { io.say("正确。这个模型对两组一视同仁，而且仍然准确。", "ok"); io.win(); } else { io.bad(); io.say(gap > 0.2 ? "两组之间的差距仍然很大。" : "准确率太低了。分数是必需的信息。", "bad"); }
  };
  const set = (fs: I.BiasFeat[]) => { on.clear(); fs.forEach((f) => on.add(f)); boxes.querySelectorAll<HTMLInputElement>("input").forEach((i) => (i.checked = on.has(i.dataset.f as I.BiasFeat))); };
  return { solve: () => { set(["score"]); train(); check(); }, wrong: () => { set(["score", "group", "district"]); train(); check(); } };
};

// ---------- a tiny digit recogniser ----------
let digitModel: I.DigitModel | null = null;
const getModel = (): I.DigitModel => (digitModel ??= I.trainDigits());
export const digit: Mount = (root, io) => {
  const s = io.act.spec as { mode: "draw" | "unsure"; targets?: number[] };
  const cells = Array(64).fill(0), grid = h("div", { class: "ci-pixedit big", style: "--w:8", id: "ci-digit" }), out = h("div", { class: "ci-digitout user" }), note = h("p", { class: "ci-note" }, "这是一个很小的演示模型：它只认识 8 × 8 的数字，也会出错。");
  grid.innerHTML = Array.from({ length: 64 }, (_, i) => `<i data-i="${i}"></i>`).join("");
  let ti = 0, paint = -1, pid = -1;
  const refresh = () => grid.querySelectorAll("i").forEach((c, i) => c.classList.toggle("on", !!cells[i]));
  const at = (e: PointerEvent): number => { const t = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null; return t && grid.contains(t) && t.dataset.i ? Number(t.dataset.i) : -1; };
  grid.addEventListener("pointerdown", (e) => { const i = at(e); if (i < 0) return; pid = e.pointerId; try { grid.setPointerCapture(pid); } catch { /* ignore */ } paint = cells[i] ? 0 : 1; cells[i] = paint; refresh(); e.preventDefault(); });
  grid.addEventListener("pointermove", (e) => { if (e.pointerId !== pid) return; const i = at(e); if (i >= 0 && cells[i] !== paint) { cells[i] = paint; refresh(); } });
  const up = (e: PointerEvent) => { if (e.pointerId === pid) pid = -1; };
  grid.addEventListener("pointerup", up); grid.addEventListener("pointercancel", up);
  const prog = h("div", { class: "ci-prog" });
  root.append(prog, grid, h("div", { class: "ci-row" }, btn("ci-clear", "清除", () => { cells.fill(0); refresh(); out.textContent = ""; }), btn("ci-check", "识别", () => check(), "primary")), out, note);
  const show = () => { prog.textContent = s.mode === "draw" ? `${ti + 1} / ${s.targets!.length}` : ""; io.prompt(s.mode === "draw" ? `${L(io.act.prompt)} ${s.targets![ti]}` : L(io.act.prompt)); cells.fill(0); refresh(); out.textContent = ""; };
  const check = () => {
    if (cells.reduce((a: number, b: number) => a + b, 0) < 6) return io.say("请先画一个数字。", "bad");
    const r = I.recogniseDigit(getModel(), cells);
    const top = r.scores.map((v, d) => [d, v] as const).sort((a, b) => b[1] - a[1]).slice(0, 3);
    out.innerHTML = top.map(([d, v]) => `<div class="ci-conf"><b>${d}</b><i style="width:${Math.round(v * 100)}%"></i><span>${Math.round(v * 100)}%</span></div>`).join("");
    if (s.mode === "draw") {
      if (r.digit === s.targets![ti] && r.confidence >= 0.5) { ti++; if (ti >= s.targets!.length) { io.say("全部正确。", "ok"); return io.win(); } io.say("机器认出来了。", "ok"); return show(); }
      io.bad(); io.say(r.digit === s.targets![ti] ? "机器认出来了，但把握不大。请画得更清楚。" : `机器认为这是 ${r.digit}。请再画一次。`, "bad");
    } else if (r.confidence < 0.4) { io.say("机器没有把握。", "ok"); io.win(); } else { io.bad(); io.say("机器很有把握。请画一个更含糊的图形。", "bad"); }
  };
  show();
  const set = (g: number[]) => { g.forEach((v, i) => (cells[i] = v)); refresh(); };
  const blur = () => { const a = I.digitGrid(1), b = I.digitGrid(7); return a.map((v, i) => (i % 2 ? v : b[i])).map((v, i) => (i < 8 ? 0 : v)); };
  return {
    solve: () => { if (s.mode === "draw") { for (let k = 0; k < s.targets!.length; k++) { set(I.digitGrid(s.targets![ti])); check(); } } else { for (let seed = 1; seed < 400 && !(io as unknown as { done?: boolean }).done; seed++) { const g = I.noisyDigit(seed % 10, seed, 14, true); if (I.recogniseDigit(getModel(), g).confidence < 0.4 && g.reduce((a, b) => a + b, 0) >= 6) { set(g); check(); return; } } set(blur()); check(); } },
    wrong: () => { if (s.mode === "draw") { set(I.digitGrid((s.targets![ti] + 1) % 10)); check(); } else { set(I.digitGrid(8)); check(); } },
  };
};
