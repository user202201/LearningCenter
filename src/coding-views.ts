/**
 * 编程 worlds 7-10: what the programs run in, drawn in code (HTML + inline SVG, nothing from outside). A view only SHOWS a state (the logic never waits for it):
 *  - stageView: sprites on a stage, speech bubbles, the variables, the taps of a scripted run as small ripples; taps / keys of the child are reported
 *  - dataView: the lists as boxes or bars, a graph, a balance scale, the tests of a function, the counters (steps, swaps, weighings)
 *  - stackPanel: the call stack of a recursive function while a program runs
 */
import { h } from "./ui";
import { tr } from "./i18n";
import { State, STAGE_W, STAGE_H, StageState, Machine } from "./coding-interp";
import type { StageExt } from "./coding-stage";
import { spriteDataUrl, ROTATES } from "./coding-art2";

export interface StageView {
  el: HTMLElement;
  render(stage: StageState, vars: Record<string, number>): void;
  /** a tap of the scripted run is shown as a ripple */
  ripple(x: number, y: number): void;
  /** the child taps a sprite / the empty stage (live play) */
  onTap: ((inp: { type: "tap"; sprite: string } | { type: "stagetap"; x: number; y: number }) => void) | null;
}
const px = (x: number) => ((x + STAGE_W / 2) / STAGE_W) * 100;
const py = (y: number) => ((STAGE_H / 2 - y) / STAGE_H) * 100;

export function stageView(ext: StageExt): StageView {
  const el = h("div", { class: "sv-stage", id: "sv-stage", role: "img", "aria-label": "舞台" });
  const layer = h("div", { class: "sv-layer" });
  el.append(h("div", { class: "sv-ground" }), layer);
  const nodes = new Map<string, { box: HTMLElement; img: HTMLElement; say: HTMLElement; art: string; cos: number }>();
  for (const sp of ext.sprites) {
    const img = h("div", { class: "sv-img" });
    const say = h("div", { class: "sv-say user", hidden: true });
    const label = h("span", { class: "sv-name" }, sp.label);
    const box = h("div", { class: "sv-sprite", "data-sprite": sp.id }, img, label, say);
    layer.append(box);
    nodes.set(sp.id, { box, img, say, art: sp.art, cos: 0 });
  }
  const vars = h("div", { class: "cs-vars sv-vars", hidden: true });
  el.append(vars);
  const view: StageView = {
    el, onTap: null,
    render(stage, v) {
      for (const sp of stage.sprites) {
        const n = nodes.get(sp.id);
        if (!n) continue;
        const spec = ext.sprites.find((x) => x.id === sp.id);
        n.box.style.left = `${px(sp.x)}%`; n.box.style.top = `${py(sp.y)}%`;
        n.box.style.setProperty("--sz", String(sp.size / 100));
        n.box.dataset.x = String(Math.round(sp.x)); n.box.dataset.y = String(Math.round(sp.y)); n.box.dataset.dir = String(Math.round(sp.dir)); n.box.dataset.costume = String(sp.costume); n.box.dataset.size = String(Math.round(sp.size));
        n.box.hidden = !sp.visible;
        n.img.style.transform = ROTATES.has(sp.art) ? `rotate(${sp.dir}deg)` : "";
        if (n.cos !== sp.costume) { n.cos = sp.costume; n.img.innerHTML = spriteDataUrl(sp.art, sp.costume, spec?.text); }
        const text = sp.say ? ext.texts[sp.say] ?? sp.say : "";
        n.say.hidden = !text; n.say.textContent = text ? tr(text) : "";
        n.box.dataset.say = sp.say;
      }
      const names = Object.keys(v).filter((k) => !ext.vars || ext.vars.includes(k)).sort();
      vars.hidden = names.length === 0;
      vars.replaceChildren(...names.map((k) => { const c = h("div", { class: "cs-var", "data-name": k }); c.append(Object.assign(document.createElement("b"), { textContent: k }), ` = ${v[k]}`); return c; }));
      el.dataset.tick = String(stage.tick);
    },
    ripple(x, y) {
      const r = h("span", { class: "sv-ripple", "aria-hidden": "true" });
      r.style.left = `${px(x)}%`; r.style.top = `${py(y)}%`;
      layer.append(r);
      setTimeout(() => r.remove(), 700);
    },
  };
  // live taps: a sprite, or the empty stage (the position as a fraction of the stage, so a zoom animation changes nothing)
  el.addEventListener("pointerdown", (e) => {
    if (!view.onTap || (e.target as HTMLElement).closest(".sv-vars")) return;
    const hit = (e.target as HTMLElement).closest<HTMLElement>("[data-sprite]");
    if (hit) { view.onTap({ type: "tap", sprite: hit.dataset.sprite! }); return; }
    const r = el.getBoundingClientRect();
    view.onTap({ type: "stagetap", x: Math.round(((e.clientX - r.left) / r.width) * STAGE_W - STAGE_W / 2), y: Math.round(STAGE_H / 2 - ((e.clientY - r.top) / r.height) * STAGE_H) });
  });
  return view;
}

// ---------- data ----------
export interface DataViewOpts {
  view: "list" | "bars" | "graph" | "scale" | "calc";
  /** the names of the lists to show, in order */
  lists: string[];
  /** what the lists / variables must be at the end (shown as a target) */
  target?: { lists: Record<string, number[]>; vars: Record<string, number> };
  /** function tests: the text of every test and the variable that holds the answer */
  tests?: { name: string; text: string }[];
  weights?: number[];
}
export interface DataView { el: HTMLElement; render(s: State, extra?: { steps?: number; marks?: number[]; done?: boolean }): void }
const SVGNS = "http://www.w3.org/2000/svg";
const sv = (tag: string, a: Record<string, string | number> = {}, kids: (Node | string)[] = []): SVGElement => { const e = document.createElementNS(SVGNS, tag); for (const k in a) e.setAttribute(k, String(a[k])); for (const c of kids) e.append(c); return e as SVGElement; };

export function dataView(o: DataViewOpts): DataView {
  const el = h("div", { class: `dv dvv-${o.view}`, id: "dv", role: "img", "aria-label": "数据" });   // (dvv-: the kind of view; not dv-bars / dv-graph, which are parts inside)
  const body = h("div", { class: "dv-body" });
  const info = h("div", { class: "dv-info", id: "dv-info" });
  el.append(body, info);
  const target = o.target;
  const row = (name: string, vals: number[], goal: number[] | undefined, bars: boolean, marks: number[] = []) => {
    const w = h("div", { class: "dv-list", "data-list": name });
    w.append(h("b", { class: "dv-name" }, name));
    if (bars) {
      const mx = Math.max(1, ...vals, ...(goal ?? []));
      const bx = h("div", { class: "dv-bars" + (vals.length > 16 ? " many" : "") });
      vals.forEach((v, i) => { const b = h("div", { class: "dv-bar" + (marks.includes(i + 1) ? " mark" : ""), "data-i": String(i + 1), "data-v": String(v), title: String(v) }, h("i", { style: `height:${Math.max(4, (Math.abs(v) / mx) * 100)}%` }), h("span", {}, String(v))); bx.append(b); });
      w.append(bx);
    } else {
      const bx = h("div", { class: "dv-cells" });
      if (!vals.length) bx.append(h("span", { class: "dv-empty" }, "空列表"));
      vals.forEach((v, i) => bx.append(h("span", { class: "dv-cell" + (marks.includes(i + 1) ? " mark" : ""), "data-i": String(i + 1) }, h("small", {}, String(i + 1)), String(v))));
      w.append(bx);
    }
    if (goal) w.append(h("div", { class: "dv-goal", "data-goal": name }, h("span", {}, "目标"), h("span", { class: "dv-cells small" }, ...(goal.length ? goal.map((v) => h("span", { class: "dv-cell" }, String(v))) : [h("span", { class: "dv-empty" }, "空列表")]))));
    return w;
  };
  const view: DataView = {
    el,
    render(s, extra = {}) {
      body.replaceChildren();
      const lists = s.lists ?? {};
      // the places the program is looking at: the counters i, j, mid, m
      const marks = extra.marks ?? ["i", "j", "mid", "m"].map((k) => s.vars[k]).filter((v) => Number.isInteger(v) && v >= 1);
      if (o.view === "calc") {
        const box = h("div", { class: "dv-tests", id: "dv-tests" });
        for (const t of o.tests ?? []) {
          const got = s.vars[t.name], want = target?.vars[t.name];
          const ran = extra.done;
          box.append(h("div", { class: "dv-test" + (ran ? (got === want ? " ok" : " bad") : ""), "data-test": t.name },
            h("code", {}, t.text), h("span", { class: "dv-arrow" }, "→"), h("b", { class: "dv-got" }, ran ? String(got ?? 0) : "?"), ran && got !== want ? h("span", { class: "dv-want" }, `= ${want}`) : null));
        }
        body.append(box);
      } else if (o.view === "graph" && s.data?.graph) {
        const g = s.data.graph, dist = lists.dist ?? [];
        const svg = sv("svg", { viewBox: "0 0 100 100", class: "dv-graph", id: "dv-graph" });
        for (const [a, b] of g.edges) svg.append(sv("line", { x1: g.pos[a - 1][0], y1: g.pos[a - 1][1], x2: g.pos[b - 1][0], y2: g.pos[b - 1][1], stroke: "#adb5bd", "stroke-width": 1.800, "stroke-linecap": "round" }));
        g.pos.forEach(([x, y], i) => {
          const d = dist[i];
          const known = d !== undefined && d >= 0;
          const g1 = sv("g", { class: "dv-node" + (known ? " known" : ""), "data-node": i + 1 });
          g1.append(sv("circle", { cx: x, cy: y, r: 7.500, fill: known ? "#63e6be" : "#fff", stroke: "#087f5b", "stroke-width": 1.800 }), sv("text", { x, y: y + 2.600, "text-anchor": "middle", "font-size": 7, "font-weight": 800, fill: "#12372a" }, [known ? String(d) : String(i + 1)]));
          if (known) g1.append(sv("text", { x: x + 8, y: y - 6, "font-size": 4.500, fill: "#087f5b", "font-weight": 700 }, [`#${i + 1}`]));
          svg.append(g1);
        });
        body.append(svg);
        for (const n of o.lists) body.append(row(n, lists[n] ?? [], target?.lists[n], false));
      } else if (o.view === "scale") {
        const n = (o.weights ?? s.data?.weights ?? []).length;
        const coins = h("div", { class: "dv-coins", id: "dv-coins" });
        for (let i = 1; i <= n; i++) coins.append(h("span", { class: "dv-coin", "data-coin": String(i) }, String(i)));
        body.append(coins, h("div", { class: "dv-weighs", id: "dv-weighs" }, h("span", {}, "天平"), h("b", {}, String(s.weighs ?? 0))));
        for (const l of o.lists) body.append(row(l, lists[l] ?? [], target?.lists[l], false));
      } else {
        for (const n of o.lists) body.append(row(n, lists[n] ?? [], target?.lists[n], o.view === "bars", marks));
      }
      const names = Object.keys(s.vars).sort();
      const chips = h("div", { class: "dv-vars", id: "dv-vars" });
      if (o.view !== "calc") for (const k of names) {
        const want = target?.vars[k];
        const c = h("span", { class: "dv-var", "data-name": k }); c.append(Object.assign(document.createElement("b"), { textContent: k }), ` = ${s.vars[k]}`);
        if (want !== undefined) c.append(h("small", { class: "dv-want" }, `(${want})`));
        chips.append(c);
      }
      // a variable the program has not set yet but the level wants: shown with its target
      if (o.view !== "calc") for (const [k, want] of Object.entries(target?.vars ?? {})) if (!(k in s.vars)) { const c = h("span", { class: "dv-var", "data-name": k }); c.append(Object.assign(document.createElement("b"), { textContent: k }), " = 0", h("small", { class: "dv-want" }, `(${want})`)); chips.append(c); }
      if (chips.childElementCount) body.append(chips);
      info.replaceChildren(
        h("span", { class: "dv-stat", id: "dv-steps" }, h("span", {}, "步数"), h("b", {}, String(extra.steps ?? 0))),
        ...(s.swaps ? [h("span", { class: "dv-stat", id: "dv-swaps" }, h("span", {}, "交换"), h("b", {}, String(s.swaps)))] : []),
        ...(o.view === "scale" ? [] : (s.weighs ? [h("span", { class: "dv-stat" }, h("span", {}, "天平"), h("b", {}, String(s.weighs)))] : [])));
    },
  };
  return view;
}

/** the call stack: the newest call first, with the values of its parameters, and the depth */
export function stackPanel(): { el: HTMLElement; render(m: Machine | null): void } {
  const el = h("div", { class: "sk", id: "sk", hidden: true });
  return {
    el,
    render(m) {
      const st = m ? m.callStack() : [];
      el.hidden = !m;
      el.replaceChildren(h("div", { class: "sk-head" }, h("b", {}, "调用栈"), h("span", { class: "sk-depth", id: "sk-depth" }, h("span", {}, "深度"), h("b", {}, String(st.length)))),
        ...(st.length ? [...st].reverse().map((f, i) => h("div", { class: "sk-frame" + (i === 0 ? " top" : ""), "data-fn": f.name }, h("code", {}, `${f.name}(${Object.values(f.args).join(", ")})`))) : [h("div", { class: "sk-empty" }, "无调用")]));
    },
  };
}
