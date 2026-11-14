/**
 * 编程 graduation: the 创作工坊 (six project templates the child edits and plays; saved on this device only, at most 12 per child, delete asks first) and the
 * certificate (drawn in code, the child's name as user text, printable A4 landscape through window.print). The pure rules of the templates are exported.
 */
import { printPage } from "./native";
import { h, toast, confirmDlg } from "./ui";
import type * as M from "./model";
import * as CM from "./coding-model";
import { paintGrid } from "./coding-infolabs";
import { figEl } from "./coding-infoart";
import { InfoContent, L } from "./coding-infocontent";
import * as I from "./coding-infomodel";

export const MAX_PROJECTS = 12;
export const TEMPLATES = ["guess", "quiz", "pixel", "home", "story", "dashboard"] as const;
export type Tpl = (typeof TEMPLATES)[number];
export interface Project { id: string; tpl: Tpl; name: string; date: string; data: any }

// ---------- pure rules of the templates ----------
export const guessCheck = (secret: number, guess: number): "low" | "high" | "ok" => (guess === secret ? "ok" : guess < secret ? "low" : "high");
export const quizScore = (qs: { a: number }[], answers: number[]): number => qs.filter((q, i) => answers[i] === q.a).length;
export const frameAt = (frames: string[][], t: number, fps: number): string[] => frames[Math.floor((t * fps) / 1000) % frames.length];
export interface Scene { text: string; choices: { t: string; to: number }[] }
/** the scene after a choice (null = the choice leads nowhere) */
export const storyNext = (scenes: Scene[], at: number, choice: number): number | null => { const c = scenes[at]?.choices[choice]; return c && c.to >= 0 && c.to < scenes.length ? c.to : null; };
/** the scenes that can never be reached from the first one */
export function storyUnreachable(scenes: Scene[]): number[] {
  const seen = new Set<number>([0]), q = [0];
  while (q.length) { const x = q.pop()!; for (const c of scenes[x]?.choices ?? []) if (c.to >= 0 && c.to < scenes.length && !seen.has(c.to)) { seen.add(c.to); q.push(c.to); } }
  return scenes.map((_, i) => i).filter((i) => !seen.has(i));
}
export const dashStats = (rows: { value: number }[]) => { const v = rows.map((r) => r.value); return { sum: v.reduce((a, b) => a + b, 0), mean: v.length ? I.mean(v) : 0, max: v.length ? Math.max(...v) : 0, min: v.length ? Math.min(...v) : 0 }; };
/** the made-up day: light from 0 (night) to 100 (noon), temperature in degrees */
export const dayLight = (hour: number): number => Math.max(0, Math.round(100 * Math.sin(((hour - 6) / 12) * Math.PI)));
export const dayTemp = (hour: number): number => Math.round(18 + 10 * Math.sin(((hour - 9) / 24) * 2 * Math.PI));
export const homeState = (r: { lamp: number; heater: number; fan: number }, hour: number) => ({ lamp: dayLight(hour) < r.lamp, heater: dayTemp(hour) < r.heater, fan: dayTemp(hour) > r.fan });

// ---------- storage on this device ----------
const KEY = "learn.coding.projects.v1";
const loadAll = (): Record<string, Project[]> => { try { const j = JSON.parse(localStorage.getItem(KEY) ?? "{}"); return j && typeof j === "object" ? j : {}; } catch { return {}; } };
const saveAll = (a: Record<string, Project[]>) => { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* private window: forgotten on reload */ } };
export const projectsOf = (kid: string): Project[] => loadAll()[kid] ?? [];
export function saveProject(kid: string, p: Project): boolean {
  const all = loadAll(), list = all[kid] ?? [], i = list.findIndex((x) => x.id === p.id);
  if (i < 0 && list.length >= MAX_PROJECTS) return false;
  if (i >= 0) list[i] = p; else list.unshift(p);
  all[kid] = list; saveAll(all); return true;
}
export function deleteProject(kid: string, id: string): void { const all = loadAll(); all[kid] = (all[kid] ?? []).filter((p) => p.id !== id); saveAll(all); }

// ---------- screens ----------
export interface PCtx { c: InfoContent; kid: M.Kid; X: { show(v: HTMLElement): void; back(to: string, label?: string): HTMLElement }; today: string }
const num = (v: string, d: number, lo: number, hi: number) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };

export function renderShelf(x: PCtx): void {
  const list = projectsOf(x.kid.id);
  const grid = h("div", { class: "ci-pgrid", id: "ci-templates" }, ...TEMPLATES.map((t) => h("a", { class: "ci-ptpl", href: `#/coding/${x.kid.id}/projects/new/${t}`, "data-tpl": t }, h("b", { class: "user" }, L(x.c.projects[t].name)), h("span", { class: "user" }, x.c.projects[t].text))));
  const mine = h("div", { class: "ci-pgrid", id: "ci-myprojects" });
  const draw = () => {
    const cur = projectsOf(x.kid.id);
    mine.replaceChildren(...(cur.length ? cur.map((p) => h("div", { class: "ci-pitem", "data-id": p.id }, h("a", { class: "ci-popen", href: `#/coding/${x.kid.id}/projects/${p.id}` }, h("b", { class: "user" }, p.name), h("small", { class: "user" }, `${L(x.c.projects[p.tpl].name)} · ${p.date}`)),
      h("button", { class: "ci-btn danger ci-pdel", type: "button", "data-id": p.id, onclick: async () => { if (!(await confirmDlg("删除这个作品？", "删除后不能恢复。", "删除", true))) return; deleteProject(x.kid.id, p.id); toast("已删除"); draw(); } }, "删除"))) : [h("p", { class: "muted", id: "ci-pempty" }, "暂无作品。")]));
  };
  draw();
  x.X.show(h("div", { class: "page", style: `--kid:${x.kid.color}` }, h("header", { class: "top hero kid-hero" }, x.X.back(`#/coding/${x.kid.id}`, "世界"), h("h1", {}, "创作工坊")),
    h("main", { class: "scroll" }, h("div", { class: "narrow cl-narrow ci-proj" }, h("h2", {}, "新建作品"), grid, h("h2", {}, `我的作品（${list.length} / ${MAX_PROJECTS}）`), mine))));
  void list;
}

/** the editor + player of one project (`p` is a new draft or a saved project) */
export function renderProject(x: PCtx, p: Project, isNew: boolean): void {
  const kidId = x.kid.id;
  const tabEdit = h("button", { class: "ci-btn on", id: "ci-tab-edit", type: "button", onclick: () => show("edit") }, "编辑"), tabRun = h("button", { class: "ci-btn", id: "ci-tab-run", type: "button", onclick: () => show("run") }, "运行");
  const body = h("div", { class: "ci-pbody" }), name = h("input", { class: "ci-input wide user", id: "ci-pname", type: "text", maxlength: "24", value: p.name, "aria-label": "名称", oninput: (e: Event) => { p.name = (e.target as HTMLInputElement).value; } }) as HTMLInputElement;
  let stop = () => {};
  const show = (mode: "edit" | "run") => {
    stop(); stop = () => {}; tabEdit.classList.toggle("on", mode === "edit"); tabRun.classList.toggle("on", mode === "run");
    body.replaceChildren();
    const f = (mode === "edit" ? EDIT : RUN)[p.tpl];
    const r = f(body, p.data, x.c);
    if (typeof r === "function") stop = r;
  };
  const save = () => {
    if (!p.name.trim()) p.name = L(x.c.projects[p.tpl].name);
    p.date = x.today;
    if (!saveProject(kidId, p)) return void toast(`最多保存 ${MAX_PROJECTS} 个作品。请先删除一个。`);
    toast("已保存到这台设备");
    if (isNew) { isNew = false; history.replaceState(null, "", `#/coding/${kidId}/projects/${p.id}`); }
  };
  x.X.show(h("div", { class: "page", style: `--kid:${x.kid.color}` }, h("header", { class: "top hero kid-hero" }, x.X.back(`#/coding/${kidId}/projects`, "创作工坊"), h("h1", { class: "user-title" }, p.name || L(x.c.projects[p.tpl].name))),
    h("main", { class: "scroll" }, h("div", { class: "narrow cl-narrow ci-proj" }, h("div", { class: "ci-row ci-prow" }, name, h("button", { class: "ci-btn primary", id: "ci-psave", type: "button", onclick: save }, "保存")), h("div", { class: "ci-row" }, tabEdit, tabRun), body))));
  show("edit");
  (window as unknown as { __infoProj: unknown }).__infoProj = { project: p, save, show };
}
export const newProject = (c: InfoContent, tpl: Tpl, name = ""): Project => ({  id: `p${Date.now()}${Math.floor(Math.random() * 1000)}`, tpl, name: name || L(c.projects[tpl].name), date: "", data: JSON.parse(JSON.stringify(c.projectDefaults[tpl])) });

type Part = (root: HTMLElement, data: any, c: InfoContent) => void | (() => void);
const field = (label: string, el: HTMLElement) => h("label", { class: "ci-pfield" }, h("span", {}, label), el);
const textIn = (v: string, on: (s: string) => void, id = "", max = 60) => h("input", { class: "ci-input wide user", type: "text", id, maxlength: String(max), value: v, autocomplete: "off", oninput: (e: Event) => on((e.target as HTMLInputElement).value) });
const sel = (opts: [string, string][], v: string, on: (s: string) => void, id = "") => h("select", { class: "ci-sel", id, onchange: (e: Event) => on((e.target as HTMLSelectElement).value) }, ...opts.map(([val, t]) => h("option", { value: val, selected: val === v }, t)));

const EDIT: Record<Tpl, Part> = {
  guess: (root, d) => root.append(field("标题", textIn(d.title, (s) => (d.title = s), "ci-gtitle")), field("数字的范围", sel([["10", "1 – 10"], ["20", "1 – 20"], ["50", "1 – 50"], ["100", "1 – 100"]], String(d.max), (s) => (d.max = num(s, 20, 5, 100)), "ci-gmax")), field("可以猜几次", sel(["3", "4", "5", "6", "7", "8", "10"].map((v) => [v, v] as [string, string]), String(d.tries), (s) => (d.tries = num(s, 6, 2, 12)), "ci-gtries")), field("提示“大了 / 小了”", sel([["1", "开"], ["0", "关"]], d.hints ? "1" : "0", (s) => (d.hints = s === "1"), "ci-ghints"))),
  quiz: (root, d) => {
    const list = h("div", { class: "ci-qlist" });
    const draw = () => {
      list.replaceChildren(...d.qs.map((q: any, i: number) => h("div", { class: "ci-qedit", "data-i": String(i) }, textIn(q.q, (s) => (q.q = s), `ci-q${i}`), ...q.o.map((o: string, k: number) => h("div", { class: "ci-row" }, h("input", { type: "radio", name: `ok${i}`, checked: q.a === k, "aria-label": "正确答案", onchange: () => (q.a = k) }), textIn(o, (s) => (q.o[k] = s), `ci-q${i}o${k}`, 30))), h("button", { class: "ci-btn danger", type: "button", onclick: () => { d.qs.splice(i, 1); draw(); } }, "删除这题"))));
    };
    root.append(field("标题", textIn(d.title, (s) => (d.title = s), "ci-qtitle")), list, h("button", { class: "ci-btn", id: "ci-qadd", type: "button", onclick: () => { if (d.qs.length < 8) { d.qs.push({ q: "", o: ["", "", ""], a: 0 }); draw(); } } }, "添加一题"));
    draw();
  },
  pixel: (root, d) => {
    let cur = 0;
    const strip = h("div", { class: "ci-frames" }), ed = h("div", {});
    const draw = () => {
      strip.replaceChildren(...d.frames.map((_: string[], i: number) => h("button", { class: "ci-btn" + (i === cur ? " on" : ""), type: "button", "data-i": String(i), onclick: () => { cur = i; draw(); } }, String(i + 1))));
      const g = paintGrid(8, () => { d.frames[cur] = g.rows(); });
      g.set(d.frames[cur]); ed.replaceChildren(g.el);
    };
    root.append(strip, ed, h("div", { class: "ci-row" }, h("button", { class: "ci-btn", id: "ci-fadd", type: "button", onclick: () => { if (d.frames.length < 6) { d.frames.push(d.frames[cur].slice()); cur = d.frames.length - 1; draw(); } } }, "添加一帧"), h("button", { class: "ci-btn danger", id: "ci-fdel", type: "button", onclick: () => { if (d.frames.length > 1) { d.frames.splice(cur, 1); cur = Math.max(0, cur - 1); draw(); } } }, "删除这一帧")), field("每秒几帧", sel(["1", "2", "3", "4", "6", "8"].map((v) => [v, v] as [string, string]), String(d.fps), (s) => (d.fps = num(s, 3, 1, 8)), "ci-fps")));
    draw();
  },
  home: (root, d) => {
    const sl = (id: string, label: string, key: string, lo: number, hi: number) => field(label, h("input", { type: "range", id, min: String(lo), max: String(hi), value: String(d[key]), "aria-label": label, oninput: (e: Event) => { d[key] = Number((e.target as HTMLInputElement).value); out.textContent = String(d[key]); } }));
    const out = h("b", {});
    root.append(sl("ci-hlamp", "光线低于几时开灯", "lamp", 0, 100), sl("ci-hheater", "温度低于几度时加热", "heater", 5, 30), sl("ci-hfan", "温度高于几度时开风扇", "fan", 15, 40));
  },
  story: (root, d) => {
    const list = h("div", { class: "ci-qlist" });
    const draw = () => list.replaceChildren(...d.scenes.map((s: Scene, i: number) => h("div", { class: "ci-qedit", "data-i": String(i) }, h("b", {}, `${i + 1}`), textIn(s.text, (v) => (s.text = v), `ci-s${i}`, 120),
      ...s.choices.map((c, k) => h("div", { class: "ci-row" }, textIn(c.t, (v) => (c.t = v), `ci-s${i}c${k}`, 30), h("span", {}, "→"), sel(d.scenes.map((_: Scene, j: number) => [String(j), String(j + 1)] as [string, string]), String(c.to), (v) => (c.to = Number(v)), `ci-s${i}t${k}`))),
      h("div", { class: "ci-row" }, h("button", { class: "ci-btn", type: "button", onclick: () => { if (s.choices.length < 2) { s.choices.push({ t: "", to: 0 }); draw(); } } }, "添加选项"), i > 0 ? h("button", { class: "ci-btn danger", type: "button", onclick: () => { d.scenes.splice(i, 1); for (const sc of d.scenes) sc.choices = sc.choices.filter((c: any) => c.to !== i).map((c: any) => ({ ...c, to: c.to > i ? c.to - 1 : c.to })); draw(); } }, "删除这一幕") : null))));
    root.append(field("标题", textIn(d.title, (s) => (d.title = s), "ci-stitle")), list, h("button", { class: "ci-btn", id: "ci-sadd", type: "button", onclick: () => { if (d.scenes.length < 8) { d.scenes.push({ text: "", choices: [] }); draw(); } } }, "添加一幕"));
    draw();
  },
  dashboard: (root, d) => {
    const list = h("div", { class: "ci-qlist" });
    const draw = () => list.replaceChildren(...d.rows.map((r: { label: string; value: number }, i: number) => h("div", { class: "ci-row", "data-i": String(i) }, textIn(r.label, (s) => (r.label = s), `ci-d${i}`, 8), h("input", { class: "ci-input small user", type: "text", inputmode: "numeric", id: `ci-d${i}v`, value: String(r.value), "aria-label": "数值", oninput: (e: Event) => (r.value = num((e.target as HTMLInputElement).value, 0, 0, 999)) }), h("button", { class: "ci-btn danger", type: "button", onclick: () => { d.rows.splice(i, 1); draw(); } }, "删除"))));
    root.append(field("标题", textIn(d.title, (s) => (d.title = s), "ci-dtitle")), list, h("button", { class: "ci-btn", id: "ci-dadd", type: "button", onclick: () => { if (d.rows.length < 8) { d.rows.push({ label: "", value: 0 }); draw(); } } }, "添加一行"));
    draw();
  },
};

const RUN: Record<Tpl, Part> = {
  guess: (root, d) => {
    let secret = 1 + Math.floor(Math.random() * d.max), left = d.tries, over = false;
    const log = h("div", { class: "ci-glog user", id: "ci-glog" }), inp = h("input", { class: "ci-input user", id: "ci-guess", type: "text", inputmode: "numeric", "aria-label": "数字", autocomplete: "off" }) as HTMLInputElement, info = h("p", { class: "ci-live user", id: "ci-ginfo" });
    const go = () => {
      if (over) return;
      const g = Math.floor(Number(inp.value));
      if (!Number.isFinite(g) || g < 1 || g > d.max) return void (info.textContent = `1 – ${d.max}`);
      left--; const r = guessCheck(secret, g);
      log.append(h("div", {}, `${g}  ${r === "ok" ? "✓" : d.hints ? (r === "low" ? "▲" : "▼") : "✗"}`));
      inp.value = "";
      if (r === "ok") { over = true; info.textContent = "你猜对了。"; } else if (left <= 0) { over = true; info.textContent = `答案是 ${secret}。`; } else info.textContent = `${left}`;
    };
    root.append(h("h2", { class: "user" }, d.title), h("p", { class: "user" }, `1 – ${d.max}`), inp, h("div", { class: "ci-row" }, h("button", { class: "ci-btn primary", id: "ci-gguess", type: "button", onclick: go }, "猜"), h("button", { class: "ci-btn", id: "ci-gagain", type: "button", onclick: () => { secret = 1 + Math.floor(Math.random() * d.max); left = d.tries; over = false; log.replaceChildren(); info.textContent = `${left}`; inp.value = ""; } }, "再玩一次")), info, log);
    info.textContent = `${left}`;
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    (window as unknown as { __guess: unknown }).__guess = { get secret() { return secret; } };
  },
  quiz: (root, d) => {
    let i = 0; const ans: number[] = [];
    const box = h("div", { class: "ci-qrun user", id: "ci-qrun" });
    const draw = () => {
      const qs = d.qs.filter((q: any) => q.q.trim());
      if (!qs.length) return void box.replaceChildren(h("p", {}, "暂无题目。请先在“编辑”里添加。"));
      if (i >= qs.length) return void box.replaceChildren(h("h2", { id: "ci-qscore" }, `${quizScore(qs, ans)} / ${qs.length}`), h("button", { class: "ci-btn primary", type: "button", id: "ci-qagain", onclick: () => { i = 0; ans.length = 0; draw(); } }, "再玩一次"));
      const q = qs[i];
      box.replaceChildren(h("p", { class: "ci-prog" }, `${i + 1} / ${qs.length}`), h("h3", {}, q.q), h("div", { class: "ci-choices col" }, ...q.o.filter((o: string) => o.trim()).map((o: string) => h("button", { class: "ci-btn ci-choice", type: "button", "data-o": o, onclick: () => { ans[i] = q.o.indexOf(o); i++; draw(); } }, o))));
    };
    root.append(h("h2", { class: "user" }, d.title), box); draw();
  },
  pixel: (root, d) => {
    const view = h("div", { class: "ci-animview", id: "ci-anim" }); let t0 = performance.now(), timer = 0;
    const draw = () => { const f = frameAt(d.frames, performance.now() - t0, d.fps); view.innerHTML = ""; const g = h("div", { class: "ci-pix big", style: "--w:8" }); g.innerHTML = f.map((r) => `<div class="ci-pixrow">${[...r].map((c) => `<i class="${c === "1" ? "on" : ""}"></i>`).join("")}</div>`).join(""); view.append(g); };
    draw(); timer = window.setInterval(draw, Math.max(60, 1000 / d.fps / 2));
    root.append(view, h("p", { class: "muted" }, `${d.frames.length} · ${d.fps} fps`));
    return () => clearInterval(timer);
    void t0;
  },
  home: (root, d) => {
    let hour = 12, tm = 0;
    const scene = h("div", { class: "ci-hscene user", id: "ci-hscene" }), sl = h("input", { type: "range", min: "0", max: "23", value: "12", id: "ci-hour", "aria-label": "hour", oninput: (e: Event) => { hour = Number((e.target as HTMLInputElement).value); draw(); } }) as HTMLInputElement;
    const draw = () => { const s = homeState(d, hour); scene.innerHTML = `<b>${String(hour).padStart(2, "0")}:00</b><span>☀ ${dayLight(hour)}</span><span>🌡 ${dayTemp(hour)}°C</span><span class="${s.lamp ? "on" : ""}" data-dev="lamp">💡 ${s.lamp ? "ON" : "OFF"}</span><span class="${s.heater ? "on" : ""}" data-dev="heater">🔥 ${s.heater ? "ON" : "OFF"}</span><span class="${s.fan ? "on" : ""}" data-dev="fan">🌀 ${s.fan ? "ON" : "OFF"}</span>`; };
    root.append(scene, sl, h("button", { class: "ci-btn", id: "ci-hplay", type: "button", onclick: () => { clearInterval(tm); hour = 0; tm = window.setInterval(() => { hour++; if (hour > 23) { clearInterval(tm); hour = 23; } sl.value = String(hour); draw(); }, 350); } }, "播放一天"));
    draw();
    return () => clearInterval(tm);
  },
  story: (root, d) => {
    let at = 0; const box = h("div", { class: "ci-srun user", id: "ci-srun" });
    const draw = () => {
      const s: Scene = d.scenes[at];
      box.replaceChildren(h("p", { class: "ci-stext" }, s.text), ...(s.choices.length ? s.choices.map((c, k) => h("button", { class: "ci-btn ci-choice", type: "button", "data-k": String(k), onclick: () => { const n = storyNext(d.scenes, at, k); if (n !== null) { at = n; draw(); } } }, c.t || "…")) : [h("button", { class: "ci-btn", type: "button", id: "ci-sagain", onclick: () => { at = 0; draw(); } }, "重新开始")]));
    };
    root.append(h("h2", { class: "user" }, d.title), box); draw();
  },
  dashboard: (root, d) => {
    const rows = d.rows.filter((r: any) => r.label.trim());
    const st = dashStats(rows);
    root.append(h("h2", { class: "user" }, d.title));
    if (!rows.length) return void root.append(h("p", {}, "暂无数据。"));
    root.append(figEl({ t: "bars", labels: rows.map((r: any) => r.label), values: rows.map((r: any) => r.value) }), h("div", { class: "ci-stats user", id: "ci-dstats" }, h("span", {}, `Σ ${st.sum}`), h("span", {}, `x̄ ${I.fmtNum(st.mean)}`), h("span", {}, `max ${st.max}`), h("span", {}, `min ${st.min}`)));
  },
};

// ---------- the certificate ----------
export interface Medal { id: string; name: string; got: boolean; svg: string }
export function renderCertificate(x: PCtx, medals: Medal[], today: string): void {
  const got = medals.filter((m) => m.got).length, all = got === medals.length;
  document.getElementById("ci-cert-print")?.remove();
  document.head.append(h("style", { id: "ci-cert-print" }, "@page { size: A4 landscape; margin: 8mm; }"));
  window.addEventListener("hashchange", () => document.getElementById("ci-cert-print")?.remove(), { once: true });
  let preview = false;
  const body = h("div", { class: "ci-certwrap" });
  const draw = () => {
    const show = all || preview;
    const rows = h("div", { class: "ci-medals" }, ...medals.map((m) => { const s = h("span", { class: "cl-trophy" + (m.got ? " got" : ""), "data-medal": m.id, title: m.got ? m.name : "", "aria-label": m.got ? m.name : "未获得" }); s.innerHTML = m.svg; return s; }));
    body.replaceChildren(h("p", { class: "ci-certstat", id: "ci-certstat" }, `${got} / ${medals.length}`), rows,
      show ? h("div", { class: "ci-cert", id: "ci-cert" }, h("div", { class: "ci-certin" }, h("small", {}, preview && !all ? "预览" : ""), h("h2", {}, "编程学习证书"), h("p", {}, "兹证明"), h("p", { class: "ci-certname user", id: "ci-certname" }, x.kid.name), h("p", {}, "完成了编程课程的全部关卡，并获得全部徽章。"), rows.cloneNode(true) as HTMLElement, h("p", { class: "ci-certdate user" }, today))) : h("p", { class: "muted", id: "ci-certlock" }, "完成所有世界，获得全部徽章后，可以领取证书。"),
      h("div", { class: "ci-row" }, !all ? h("button", { class: "ci-btn", id: "ci-certprev", type: "button", onclick: () => { preview = !preview; draw(); } }, preview ? "关闭预览" : "预览") : null, show ? h("button", { class: "ci-btn primary", id: "ci-certprint", type: "button", onclick: () => void printPage() }, "打印 / 保存为 PDF") : null));
  };
  draw();
  x.X.show(h("div", { class: "page cert-page", style: `--kid:${x.kid.color}` }, h("header", { class: "top hero kid-hero" }, x.X.back(`#/coding/${x.kid.id}`, "世界"), h("h1", {}, "证书")), h("main", { class: "scroll" }, h("div", { class: "narrow cl-narrow ci-proj" }, body))));
}
void CM;
