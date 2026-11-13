/**
 * The map drawn as SVG, with zoom (+ / - buttons, the wheel, two fingers) and pan (one finger, the mouse), and the touch -> region step (geomapgeo.hitTest).
 * Nothing in the SVG takes pointer events itself: the page asks `hitTest`, which is forgiving (a touch may miss an edge by 14 pixels, small regions have a
 * round magnified dot). Markers and labels keep their size in pixels when the map is zoomed. Works with touch, pen and mouse (Pointer Events).
 */
import { h } from "./ui";
import { chinaShapes, worldShapes, hitTest, continentOf, DOT_OFFSET, DOT_R, type Geo, type Shape, type Hit, type Pt } from "./geomapgeo";

const NS = "http://www.w3.org/2000/svg";
const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, ...kids: (Node | string)[]): SVGElementTagNameMap[K] => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  e.append(...kids);
  return e;
};
export const REGION_COLORS: Record<string, string> = { 华北: "#ffe0b2", 东北: "#c8e6c9", 华东: "#bbdefb", 华中: "#f8bbd0", 华南: "#e1bee7", 西南: "#fff59d", 西北: "#b2dfdb", 港澳台: "#ffccbc" };
export const CONT_COLORS: Record<string, string> = { as: "#ffe0b2", eu: "#c8e6c9", af: "#fff59d", na: "#f8bbd0", sa: "#e1bee7", oc: "#b2dfdb", an: "#eceff1" };
const AREA_COLORS: Record<string, string> = { 高原: "#b9770e", 平原: "#3a9b3a", 盆地: "#8e5ac8", 沙漠: "#d9a500" };
export const MAX_ZOOM = 14;

export interface ViewOpts {
  kind: "china" | "world";
  geo: Geo;
  /** "learn": names and the colours of the regions; "quiz": plain regions, no names */
  learn: boolean;
  /** quiz: the layers to draw (china: "river", "mountain", "lake", "area"); learn: the ones switched on in the page */
  layers?: string[];
  /** the map sits in a page that scrolls (learn): at zoom 1 a vertical drag scrolls the page; in a quiz the map never scrolls */
  scrollPage?: boolean;
  onTap?: (hit: Hit | null, at: Pt) => void;
}

export class MapView {
  readonly el: HTMLElement;
  readonly svg: SVGSVGElement;
  readonly shapes: Shape[];
  k = 1; tx = 0; ty = 0;
  private vp: SVGGElement;
  private els = new Map<string, SVGElement>();
  private markers: { g: SVGGElement; x: number; y: number; hide?: (s: number) => boolean }[] = [];
  private groups = new Map<string, SVGGElement>();
  private W: number; private H: number;
  private ptrs = new Map<number, Pt>();
  private moved = false; private downAt: Pt = [0, 0]; private startState = { k: 1, tx: 0, ty: 0 }; private pinch: { d: number; cx: number; cy: number } | null = null;
  private raf = 0;
  private ro: ResizeObserver | null = null;
  private opts: ViewOpts;
  /** px per view unit (the map's scale on the screen) */
  get scale(): number { return this.k * this.unit(); }

  constructor(o: ViewOpts) {
    this.opts = o;
    const vb = o.kind === "china" ? o.geo.china.vb : o.geo.world.vb;
    this.W = vb[2]; this.H = vb[3];
    this.shapes = o.kind === "china" ? chinaShapes(o.geo.china) : worldShapes(o.geo.world);
    this.vp = el("g", { class: "gmap-vp" });
    this.svg = el("svg", { class: `gmap-svg gmap-${o.kind}`, viewBox: `0 0 ${this.W} ${this.H}`, preserveAspectRatio: "xMidYMid meet", role: "img", "aria-label": o.kind === "china" ? "中国地图" : "世界地图", "data-kind": o.kind },
      el("rect", { class: "gmap-sea", x: 0, y: 0, width: this.W, height: this.H }), this.vp);
    if (o.kind === "china") this.drawChina(); else this.drawWorld();
    const btn = (id: string, label: string, text: string, fn: () => void) => h("button", { class: "gmap-zb", id, title: label, "aria-label": label, onclick: fn }, text);
    this.el = h("div", { class: "gmap-view", "data-kind": o.kind }, this.svg,
      h("div", { class: "gmap-zoom" }, btn("gmap-in", "放大", "+", () => this.zoomBy(1.6)), btn("gmap-out", "缩小", "−", () => this.zoomBy(1 / 1.6)), btn("gmap-reset", "复位", "⟲", () => this.reset())));
    this.bind();
    this.update();
    this.ro = new ResizeObserver(() => this.update());
    this.ro.observe(this.svg);
  }
  dispose() { this.ro?.disconnect(); cancelAnimationFrame(this.raf); }

  // ---------- drawing ----------
  private g(name: string, cls = ""): SVGGElement { const g = el("g", { class: `gmap-g gmap-g-${name} ${cls}` }); this.groups.set(name, g); this.vp.append(g); return g; }
  private path(layer: string, id: string, d: string, cls: string, style = ""): SVGPathElement {
    const p = el("path", { d, class: cls, "data-k": `${layer}:${id}`, ...(style ? { style } : {}) });
    p.setAttribute("vector-effect", "non-scaling-stroke");
    this.els.set(`${layer}:${id}`, p);
    return p;
  }
  /** a marker keeps its size in pixels: it sits at (x, y) and is scaled by 1 / scale */
  private marker(parent: SVGElement, x: number, y: number, cls: string, hide?: (s: number) => boolean): SVGGElement {
    const g = el("g", { class: `gmap-m ${cls}` });
    parent.append(g);
    this.markers.push({ g, x, y, hide });
    return g;
  }
  private label(parent: SVGElement, text: string, x: number, y: number, cls: string, hide: (s: number) => boolean) {
    const g = this.marker(parent, x, y, "gmap-lbl " + cls, hide);
    const t = el("text", { x: 0, y: 4, "text-anchor": "middle" }, text);
    t.classList.add("user");
    g.append(t);
  }
  private drawChina() {
    const c = this.opts.geo.china, o = this.opts, L = new Set(o.layers ?? []);
    const nb = this.g("nbr");
    for (const n of c.nbrs) nb.append(this.path("nbr", n.id, n.d, "gmap-nbr"));
    const provs = this.g("prov");
    for (const p of c.provinces) provs.append(this.path("prov", p.id, p.d, "gmap-prov", o.learn ? `--c:${REGION_COLORS[p.reg]}` : ""));
    const areas = this.g("area");
    for (const a of c.areas) { const e = this.path("area", a.id, a.d, "gmap-area", `--c:${AREA_COLORS[a.kind ?? ""] ?? "#999"}`); areas.append(e); }
    const lakes = this.g("lake");
    for (const l of c.lakes) lakes.append(this.path("lake", l.id, l.d, "gmap-lake"));
    const rivers = this.g("river");
    for (const r of c.rivers) rivers.append(this.path("river", r.id, r.d, "gmap-river"));
    const mts = this.g("mountain");
    for (const m of c.mountains) mts.append(this.path("mountain", m.id, m.d, "gmap-mountain"));
    for (const [name] of this.groups) { if (["area", "lake", "river", "mountain"].includes(name)) this.groups.get(name)!.style.display = L.has(name) ? "" : "none"; }
    // seas (names) and the island of the Diaoyu: learning only
    if (o.learn) {
      const seas = this.g("sea");
      for (const s of c.seas) this.label(seas, s.n, s.p[0], s.p[1], "gmap-sea-lbl", () => false);
    }
    // cities (points); the names show when the map is zoomed (capitals first)
    const cities = this.g("city");
    for (const ct of c.cities) {
      const g = this.marker(cities, ct.p[0], ct.p[1], "gmap-city" + (ct.cap ? " cap" : ""));
      g.append(el("circle", { r: ct.cap ? 3.2 : 2.6, class: "gmap-cdot" }));
      if (o.learn) { g.append(el("text", { x: 0, y: -6, "text-anchor": "middle", class: "gmap-clbl user" }, ct.n)); g.dataset.lbl = ct.cap ? "2.2" : "3.2"; }
    }
    // the point of 钓鱼岛 and its name
    if (o.learn) for (const pt of c.points) { const g = this.marker(cities, pt.p[0], pt.p[1], "gmap-city gmap-island"); g.append(el("circle", { r: 3, class: "gmap-cdot" }), el("text", { x: 5, y: 3, class: "gmap-clbl user" }, pt.n)); g.dataset.lbl = "1.6"; }
    // labels of the provinces
    if (o.learn) {
      const lbls = this.g("plabel");
      for (const p of c.provinces) {
        if (DOT_OFFSET[p.id]) continue;
        const sh = this.shapes.find((s) => s.layer === "prov" && s.id === p.id)!;
        this.label(lbls, p.n, p.lp[0], p.lp[1], "gmap-plbl", (s) => (sh.bbox[2] - sh.bbox[0]) * s < p.n.length * 12 + 6 || (sh.bbox[3] - sh.bbox[1]) * s < 16);
      }
      // feature names (learn: only when the layer is on and the map is zoomed a little)
      const fl = this.g("flabel");
      const add = (list: { n: string; lp: Pt }[], layer: string, cls: string) => { for (const f of list) this.label(fl, f.n, f.lp[0], f.lp[1], `gmap-flbl ${cls}`, () => this.k < 1.6 || this.groups.get(layer)?.style.display === "none"); };
      add(c.rivers, "river", "r"); add(c.mountains, "mountain", "m"); add(c.lakes, "lake", "l"); add(c.areas, "area", "a");
    }
    // the magnified dots of the small regions
    const dots = this.g("dot");
    for (const p of c.provinces) {
      const off = DOT_OFFSET[p.id]; if (!off) continue;
      const g = this.marker(dots, p.lp[0], p.lp[1], "gmap-dotm");
      g.dataset.id = p.id;
      const circle = el("circle", { cx: off[0], cy: off[1], r: DOT_R, class: "gmap-dot", "data-k": `dot:${p.id}` });
      this.els.set(`dot:${p.id}`, circle);
      g.append(el("line", { x1: 0, y1: 0, x2: off[0], y2: off[1], class: "gmap-leader" }), el("circle", { r: 2.4, class: "gmap-cdot" }), circle);
      if (o.learn) { const t = el("text", { x: off[0], y: off[1] + 4.5, "text-anchor": "middle", class: "gmap-dlbl user" }, p.ab); g.append(t); }
    }
    this.drawInset();
  }
  /** the 南海诸岛 box in the lower right (fixed on the screen: it is outside the zoomed group) */
  private drawInset() {
    const c = this.opts.geo.china, ins = c.inset, [x, y, w, hgt] = ins.box;
    const g = el("g", { class: "gmap-inset", "data-inset": "1" });
    g.append(el("rect", { x, y, width: w, height: hgt, class: "gmap-inset-box" }), el("path", { d: ins.land, class: "gmap-inset-land" }));
    for (const d of ins.dashes) g.append(el("path", { d, class: "gmap-dash" }));
    for (const i of ins.islands) {
      g.append(el("circle", { cx: i.p[0], cy: i.p[1], r: 3.5, class: "gmap-isle" }));
      if (this.opts.learn) g.append(el("text", { x: i.p[0] + 6, y: i.p[1] + 4, class: "gmap-isle-lbl user", style: "font-size:17px" }, i.n));
    }
    g.append(el("text", { x: x + w / 2, y: y + hgt - 8, "text-anchor": "middle", class: "gmap-inset-t user", style: "font-size:20px" }, "南海诸岛"));
    this.svg.append(g);
  }
  private drawWorld() {
    const w = this.opts.geo.world, o = this.opts;
    const oc = this.g("ocean");
    for (const x of w.oceans) oc.append(this.path("ocean", x.id, x.d, "gmap-ocean"));
    const land = this.g("land");
    for (const [k, d] of Object.entries(w.land)) land.append(this.path("land", k, d, "gmap-land", o.learn ? `--c:${CONT_COLORS[k === "ruEu" ? "eu" : k === "ruAs" ? "as" : k] ?? "#eee"}` : ""));
    const cs = this.g("country");
    for (const c of w.countries) cs.append(this.path("country", c.id, c.d, "gmap-country", o.learn ? `--c:${CONT_COLORS[c.cont]}` : ""));
    if (o.learn) {
      const l = this.g("clabel");
      for (const c of w.countries) {
        const sh = this.shapes.find((s) => s.layer === "country" && s.id === c.id)!;
        this.label(l, c.n, c.lp[0], c.lp[1], "gmap-plbl", (s) => (sh.bbox[2] - sh.bbox[0]) * s < c.n.length * 12 + 4 || (sh.bbox[3] - sh.bbox[1]) * s < 14);
      }
      const ol = this.g("olabel");
      for (const x of w.oceans) x.lps.forEach((p) => this.label(ol, x.n, p[0], p[1], "gmap-olbl", () => false));
      const kl = this.g("klabel");
      const kp: Record<string, Pt> = {}; for (const k of w.continents) { const cs2 = w.countries.filter((c) => c.cont === k.id); if (cs2.length) kp[k.id] = [Math.round(cs2.reduce((s, c) => s + c.lp[0], 0) / cs2.length), Math.round(cs2.reduce((s, c) => s + c.lp[1], 0) / cs2.length)]; }
      kp.an = [1000, w.vb[3] - 28]; kp.oc = [1700, 1000]; kp.af = [1010, 640]; kp.eu = [1100, 250]; kp.as = [1480, 330]; kp.na = [430, 330]; kp.sa = [620, 760];
      for (const k of w.continents) if (kp[k.id]) this.label(kl, k.n, kp[k.id][0], kp[k.id][1], "gmap-klbl", () => this.k > 2.6);
    }
    // the line of the Urals (Europe | Asia)
    if (o.learn && w.ural.length) this.vp.append(el("path", { d: `M${w.ural.map((p) => p.join(",")).join("L")}`, class: "gmap-ural", "vector-effect": "non-scaling-stroke" }));
  }

  // ---------- state ----------
  /** px per view unit at zoom 1 (the SVG fits its box: meet) */
  private unit(): number { return this.svg.getScreenCTM()?.a || 1; }
  setLayer(name: string, on: boolean) { const g = this.groups.get(name); if (g) g.style.display = on ? "" : "none"; this.update(); }
  /** lights / marks one region: cls = "lit" | "right" | "wrong" | "pick" */
  mark(layer: string, id: string, cls: string) { this.els.get(`${layer}:${id}`)?.classList.add(cls); this.els.get(`dot:${id}`)?.classList.add(cls); }
  unmark(cls?: string) { for (const e of this.els.values()) { if (cls) e.classList.remove(cls); else e.classList.remove("lit", "right", "wrong", "pick"); } }
  /** hides one region (the quiz of continents hides Russia's outline, which spans two continents) */
  hide(layer: string, id: string, on = true) { const e = this.els.get(`${layer}:${id}`); if (e) e.style.display = on ? "none" : ""; }
  /** the quiz dims everything except the lit region */
  dimOthers(on: boolean) { this.svg.classList.toggle("gmap-dim", on); }
  /** the screen position (px, relative to the map) of a view point */
  center(): Pt { return [this.W / 2, this.H / 2]; }
  private clamp() {
    this.k = Math.max(1, Math.min(MAX_ZOOM, this.k));
    this.tx = Math.max(this.W * (1 - this.k), Math.min(0, this.tx));
    this.ty = Math.max(this.H * (1 - this.k), Math.min(0, this.ty));
  }
  reset() { this.k = 1; this.tx = 0; this.ty = 0; this.update(); }
  /** zoom by factor f round the view point (u, v) (default: the middle) */
  zoomBy(f: number, u = this.W / 2, v = this.H / 2) {
    const k2 = Math.max(1, Math.min(MAX_ZOOM, this.k * f)), r = k2 / this.k;
    this.tx = u - (u - this.tx) * r; this.ty = v - (v - this.ty) * r; this.k = k2;
    this.clamp(); this.update();
  }
  /** zooms and pans so that the view rectangle (x0, y0, x1, y1) fills the map */
  zoomTo(x0: number, y0: number, x1: number, y1: number) {
    const k = Math.min(MAX_ZOOM, 0.8 * Math.min(this.W / Math.max(40, x1 - x0), this.H / Math.max(40, y1 - y0)));
    this.k = Math.max(1, k);
    this.tx = this.W / 2 - ((x0 + x1) / 2) * this.k; this.ty = this.H / 2 - ((y0 + y1) / 2) * this.k;
    this.clamp(); this.update();
  }
  update() {
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => this.draw());
    this.draw();
  }
  private draw() {
    this.vp.setAttribute("transform", `translate(${this.tx.toFixed(2)} ${this.ty.toFixed(2)}) scale(${this.k.toFixed(4)})`);
    const s = this.scale;
    this.svg.dataset.k = this.k.toFixed(2);
    this.svg.style.touchAction = this.k > 1 + 1e-6 || !this.opts.scrollPage ? "none" : "pan-y";   // (at zoom 1 a vertical drag still scrolls the page)
    const zi = this.el?.querySelector<HTMLButtonElement>("#gmap-in"), zo = this.el?.querySelector<HTMLButtonElement>("#gmap-out"), zr = this.el?.querySelector<HTMLButtonElement>("#gmap-reset");
    if (zi) zi.disabled = this.k >= MAX_ZOOM - 1e-6; if (zo) zo.disabled = this.k <= 1 + 1e-6; if (zr) zr.disabled = this.k <= 1 + 1e-6 && this.tx === 0 && this.ty === 0;
    for (const m of this.markers) {
      m.g.setAttribute("transform", `translate(${m.x} ${m.y}) scale(${(1 / s).toFixed(5)})`);
      const lbl = m.g.dataset.lbl ? this.k < Number(m.g.dataset.lbl) : false;
      m.g.classList.toggle("lblhide", lbl);
      const hidden = m.hide ? m.hide(s) : false;
      m.g.style.display = hidden ? "none" : "";
    }
    // the inset is a fixed frame: it is tucked away when the map is zoomed into
    const ins = this.svg.querySelector<SVGElement>(".gmap-inset"); if (ins) ins.style.display = this.k > 1.8 ? "none" : "";
  }

  // ---------- touch / mouse ----------
  /** view point (before the zoom) of a client point */
  toView(cx: number, cy: number): Pt {
    const m = this.svg.getScreenCTM();
    if (!m) return [0, 0];
    const p = this.svg.createSVGPoint(); p.x = cx; p.y = cy;
    const q = p.matrixTransform(m.inverse());
    return [q.x, q.y];
  }
  /** content point (in the map's own coordinates) of a client point */
  toContent(cx: number, cy: number): Pt { const [u, v] = this.toView(cx, cy); return [(u - this.tx) / this.k, (v - this.ty) / this.k]; }
  /** what is at a client point */
  hitAt(cx: number, cy: number, layers?: string[]): { hit: Hit | null; at: Pt } {
    const at = this.toContent(cx, cy), s = this.scale;
    const hit = hitTest(this.shapes, at[0], at[1], 14 / s, s, layers);
    return { hit, at };
  }
  private bind() {
    const svg = this.svg;
    svg.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      svg.setPointerCapture?.(e.pointerId);
      this.ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (this.ptrs.size === 1) { this.moved = false; this.downAt = [e.clientX, e.clientY]; this.startState = { k: this.k, tx: this.tx, ty: this.ty }; }
      if (this.ptrs.size === 2) { this.moved = true; this.pinch = this.pinchState(); this.startState = { k: this.k, tx: this.tx, ty: this.ty }; }
    });
    svg.addEventListener("pointermove", (e) => {
      const prev = this.ptrs.get(e.pointerId);
      if (!prev) return;
      this.ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (this.ptrs.size >= 2 && this.pinch) {
        const now = this.pinchState();
        const [u0, v0] = this.toViewRaw(this.pinch.cx, this.pinch.cy);
        const f = now.d / this.pinch.d;
        const k2 = Math.max(1, Math.min(MAX_ZOOM, this.startState.k * f)), r = k2 / this.startState.k;
        const [u1, v1] = this.toViewRaw(now.cx, now.cy);
        this.tx = u1 - (u0 - this.startState.tx) * r; this.ty = v1 - (v0 - this.startState.ty) * r; this.k = k2;
        this.clamp(); this.update();
        return;
      }
      if (this.ptrs.size === 1) {
        const dx = e.clientX - this.downAt[0], dy = e.clientY - this.downAt[1];
        if (!this.moved && Math.hypot(dx, dy) > 7) this.moved = true;
        if (this.moved && this.k > 1) {
          // one finger pans (the map moves with the finger: client pixels -> view units)
          const m = this.svg.getScreenCTM(); const a = m ? m.a : 1;
          this.tx = this.startState.tx + dx / a; this.ty = this.startState.ty + dy / a;
          this.clamp(); this.update();
        }
      }
    });
    const up = (e: PointerEvent) => {
      if (!this.ptrs.has(e.pointerId)) return;
      const wasTap = !this.moved && this.ptrs.size === 1 && e.type === "pointerup";
      this.ptrs.delete(e.pointerId);
      if (this.ptrs.size < 2) this.pinch = null;
      if (this.ptrs.size === 1) { const [id, p] = [...this.ptrs][0]; void id; this.downAt = p; this.startState = { k: this.k, tx: this.tx, ty: this.ty }; this.moved = true; }
      if (wasTap) { const r = this.hitAt(e.clientX, e.clientY); this.opts.onTap?.(r.hit, r.at); }
    };
    svg.addEventListener("pointerup", up);
    svg.addEventListener("pointercancel", up);
    svg.addEventListener("wheel", (e) => { e.preventDefault(); const [u, v] = this.toView(e.clientX, e.clientY); this.zoomBy(e.deltaY < 0 ? 1.25 : 0.8, u, v); }, { passive: false });
  }
  private toViewRaw(cx: number, cy: number): Pt { return this.toView(cx, cy); }
  private pinchState() {
    const [a, b] = [...this.ptrs.values()];
    return { d: Math.max(10, Math.hypot(a[0] - b[0], a[1] - b[1])), cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2 };
  }
}
export { continentOf };
