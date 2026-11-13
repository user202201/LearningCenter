/**
 * The solar system as a moving model (canvas 2D): the Sun, the 8 planets and (when asked) the 5 dwarf planets on their elliptic orbits with the true relative
 * periods and the true direction (positions from Kepler's equation, see spacemodel.ts), a time-lapse (pause ... 5 years a second) with a date, two ways to show the distances
 * (schematic = true order, evenly spaced and readable; true scale = real distances with zoom and the light-time ruler), the asteroid belt and the Kuiper belt as dots.
 * A tap on a body opens its page. Everything stops when the page is left; with reduced motion nothing moves by itself (the date is stepped by buttons).
 */
import { h } from "./ui";
import { tr } from "./i18n";
import { fit, Loop, reducedMotion, nearest, lightText, fmt, user, sig } from "./spaceui";
import { sprite, RING_PAD } from "./spaceart";
import { type Space, type Body, position, dayOfDate, dateOfDay, SPEEDS, lightSeconds, AU_KM, nameOf, allBodies } from "./spacemodel";
import { todayLocal } from "./model";

export interface OrreryApi { el: HTMLElement; dispose(): void }
const SPEED_LABELS = ["暂停", "1 天 / 秒", "10 天 / 秒", "1 个月 / 秒", "1 个季度 / 秒", "1 年 / 秒", "5 年 / 秒"];
const ZOOMS = [1, 2, 4, 8, 16, 32, 64, 128, 256];

export function mountOrrery(S: Space, open: (id: string) => void): OrreryApi {
  const st = { day: dayOfDate(todayLocal()), speed: 3, mode: "schem" as "schem" | "true", dwarfs: false, zi: 0, light: "earth", dirty: true };
  const cv = h("canvas", { class: "sp-canvas", id: "sp-orrery", role: "img", "aria-label": tr("太阳系模型") });
  const dateEl = h("b", { id: "sp-date" });
  const speedLab = h("span", { id: "sp-speed-lab", class: "muted small" });
  const slider = h("input", { type: "range", min: "0", max: String(SPEEDS.length - 1), step: "1", value: String(st.speed), id: "sp-speed", "aria-label": tr("时间流速") }) as HTMLInputElement;
  const lightBox = h("div", { class: "sp-light", id: "sp-light" });
  const zoomLab = h("span", { class: "muted small", id: "sp-zoom-lab" });
  const mkBtn = (id: string, label: string, click: () => void, aria = label) => h("button", { class: "mopt sp-btn", id, "aria-label": tr(aria), onclick: click }, label);
  let bodies: { b: Body; x: number; y: number; r: number }[] = [];
  const list = (): Body[] => (st.dwarfs ? allBodies(S) : S.planets).slice().sort((a, b) => a.a - b.a);

  const sync = () => {
    dateEl.textContent = dateOfDay(st.day);
    speedLab.textContent = tr(SPEED_LABELS[st.speed]);
    slider.value = String(st.speed);
    cv.style.touchAction = st.mode === "true" ? "none" : "pan-y";
    zoomBtns.style.display = st.mode === "true" ? "" : "none";
    lightBox.style.display = st.mode === "true" ? "" : "none";
    zoomLab.textContent = `${ZOOMS[st.zi]}×`;
    if (st.mode === "true") {
      const b = S.planets.concat(S.dwarfs).find((x) => x.id === st.light) ?? S.planets[2];
      const sec = lightSeconds(b.a * AU_KM);
      lightBox.replaceChildren(h("div", { class: "sp-light-text", id: "sp-light-text" }, ...fmt("光从太阳到{0}需要 {1}", [nameOf(b), tr(lightText(sec))])),
        h("div", { class: "sp-light-pick" }, ...list().map((x) => h("button", { class: "mopt sp-lp" + (x.id === b.id ? " on" : ""), "data-id": x.id, onclick: () => { st.light = x.id; sync(); } }, user(nameOf(x))))));
    }
    st.dirty = true;
    if (!loop.running) redraw();
  };
  const setMode = (m: "schem" | "true") => { st.mode = m; modeChips.forEach((c) => c.classList.toggle("on", c.dataset.v === m)); sync(); };
  const modeChips = [h("button", { class: "mopt on", id: "sp-mode-schem", "data-v": "schem", onclick: () => setMode("schem") }, "示意距离"), h("button", { class: "mopt", id: "sp-mode-true", "data-v": "true", onclick: () => setMode("true") }, "真实距离")];
  const dwarfBtn = h("button", { class: "mopt", id: "sp-dwarfs", "aria-pressed": "false", onclick: () => { st.dwarfs = !st.dwarfs; dwarfBtn.classList.toggle("on", st.dwarfs); dwarfBtn.setAttribute("aria-pressed", String(st.dwarfs)); sync(); } }, "显示矮行星");
  const zoom = (d: number) => { st.zi = Math.max(0, Math.min(ZOOMS.length - 1, st.zi + d)); sync(); };
  const zoomBtns = h("div", { class: "sp-zoom", id: "sp-zoom" }, mkBtn("sp-zoom-out", "−", () => zoom(-1), "缩小"), zoomLab, mkBtn("sp-zoom-in", "＋", () => zoom(1), "放大"));
  slider.addEventListener("input", () => { st.speed = +slider.value; sync(); loop.start(); });
  const step = (days: number) => { st.day += days; sync(); };
  const todayBtn = h("button", { class: "mopt sp-btn", id: "sp-today", onclick: () => { st.day = dayOfDate(todayLocal()); sync(); } }, "回到今天");
  const timeRow = h("div", { class: "sp-time" },
    h("div", { class: "sp-date" }, dateEl, todayBtn),
    h("div", { class: "sp-speedrow" }, mkBtn("sp-back", "‹ 1 个月", () => step(-30)), slider, mkBtn("sp-fwd", "1 个月 ›", () => step(30))),
    speedLab);

  // ---------- drawing ----------
  const layoutSchem = (list0: Body[], R: number): Map<string, number> => {
    const m = new Map<string, number>(), n = list0.length, r0 = 0.12 * R, r1 = 0.86 * R;
    list0.forEach((b, i) => m.set(b.id, r0 + (n > 1 ? (i * (r1 - r0)) / (n - 1) : 0)));
    return m;
  };
  const draw = (t: number) => {
    const { c, w, h: hh } = fit(cv);
    const cx = w / 2, cy = hh / 2, R = Math.min(w, hh) / 2;
    c.clearRect(0, 0, w, hh);
    const bg = c.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(w, hh) / 2); bg.addColorStop(0, "#1c1f4d"); bg.addColorStop(1, "#0b0d26"); c.fillStyle = bg; c.fillRect(0, 0, w, hh);
    for (let i = 0; i < 60; i++) { const k = (i * 7919) % 1000; c.fillStyle = `rgba(255,255,255,${0.15 + (k % 5) * 0.08})`; c.fillRect(((k * 37) % 1000) / 1000 * w, ((k * 91) % 1000) / 1000 * hh, 1.2, 1.2); }
    const L = list(), schem = st.mode === "schem";
    const slots = layoutSchem(L, R);
    const farAU = st.dwarfs ? 70 : 31, zoomK = ZOOMS[st.zi], pxAU = (R * 0.92 / farAU) * zoomK;
    const rad = (b: Body, e = 0): number => (schem ? slots.get(b.id)! : b.a * pxAU * (1 - e * 0));
    const px = (b: Body): [number, number, number] => {
      const p = position(b, st.day);
      const r = schem ? slots.get(b.id)! : p.r * pxAU;
      return [cx + r * Math.cos(p.lon), cy - r * Math.sin(p.lon), r];
    };
    // belts
    const dots = (r0: number, r1: number, n: number, seed: number, col: string) => {
      if (r1 < 3) return;
      c.fillStyle = col;
      for (let i = 0; i < n; i++) { const k = Math.sin(seed + i * 12.9898) * 43758.5453, u = k - Math.floor(k), a = ((i * 0.618033) % 1) * Math.PI * 2, rr = r0 + u * (r1 - r0); c.fillRect(cx + rr * Math.cos(a), cy - rr * Math.sin(a), 1.3, 1.3); }
    };
    if (schem) {
      const ms = L.findIndex((b) => b.a > 2.2 && b.a < 3.2), mars = L.findIndex((b) => b.id === "mars"), jup = L.findIndex((b) => b.id === "jupiter");
      const rb = ms >= 0 ? slots.get(L[ms].id)! : (slots.get(L[mars].id)! + slots.get(L[jup].id)!) / 2;
      const wd = (slots.get(L[jup].id)! - slots.get(L[mars].id)!) * 0.22;
      dots(rb - wd, rb + wd, 320, 3, "rgba(190,170,140,.75)");
      const last = L[L.length - 1], rk = slots.get(last.id)!;
      dots(rk + R * 0.02, rk + R * 0.07 > R * 0.99 ? R * 0.99 : rk + R * 0.07, 260, 9, "rgba(150,190,230,.6)");
    } else {
      dots(2.2 * pxAU, 3.2 * pxAU, 360, 3, "rgba(190,170,140,.75)");
      dots(30 * pxAU, 50 * pxAU, 420, 9, "rgba(150,190,230,.6)");
    }
    // orbits
    c.lineWidth = 1;
    for (const b of L) {
      c.strokeStyle = "rgba(180,190,255,.28)"; c.beginPath();
      if (schem) c.arc(cx, cy, slots.get(b.id)!, 0, 7);
      else for (let i = 0; i <= 120; i++) { const lon = (i / 120) * Math.PI * 2 - b.varpi * Math.PI / 180, nu = lon, r = (b.a * (1 - b.e * b.e)) / (1 + b.e * Math.cos(nu)) * pxAU, a = lon + b.varpi * Math.PI / 180; const X = cx + r * Math.cos(a), Y = cy - r * Math.sin(a); i ? c.lineTo(X, Y) : c.moveTo(X, Y); }
      c.stroke();
    }
    // the Sun
    const sr = schem ? Math.max(8, R * 0.07) : Math.max(4, Math.min(R * 0.06, 0.00465 * pxAU * 6));
    const gl = c.createRadialGradient(cx, cy, 0, cx, cy, sr * 3.2); gl.addColorStop(0, "rgba(255,230,120,.95)"); gl.addColorStop(0.3, "rgba(255,170,40,.5)"); gl.addColorStop(1, "rgba(255,120,0,0)"); c.fillStyle = gl; c.beginPath(); c.arc(cx, cy, sr * 3.2, 0, 7); c.fill();
    const sg = c.createRadialGradient(cx - sr * 0.3, cy - sr * 0.3, 0, cx, cy, sr); sg.addColorStop(0, "#fff7c2"); sg.addColorStop(1, "#ffb300"); c.fillStyle = sg; c.beginPath(); c.arc(cx, cy, sr, 0, 7); c.fill();
    // the light (true scale): a pulse from the Sun to the chosen body
    bodies = [];
    const placed = L.map((b) => ({ b, p: px(b) }));
    if (!schem) {
      const tb = placed.find((q) => q.b.id === st.light) ?? placed.find((q) => q.b.id === "earth")!;
      const [x, y] = tb.p, len = Math.hypot(x - cx, y - cy);
      c.strokeStyle = "rgba(255,230,120,.5)"; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(cx, cy); c.lineTo(x, y); c.stroke(); c.setLineDash([]);
      const f = reducedMotion() ? 0.5 : (t / 2200) % 1; c.fillStyle = "#fff3a0"; c.beginPath(); c.arc(cx + (x - cx) * f, cy + (y - cy) * f, 3.2, 0, 7); c.fill();
      void len;
      // the ruler: a bar of a round number of AU, labelled with the light time
      const units = [100, 10, 1, 0.1, 0.01, 0.001]; const u = units.find((q) => q * pxAU <= w * 0.5 && q * pxAU >= 34) ?? 1;
      const bw = u * pxAU, bx = 12, by = hh - 16;
      c.strokeStyle = "#ffe066"; c.lineWidth = 2; c.beginPath(); c.moveTo(bx, by - 4); c.lineTo(bx, by + 4); c.moveTo(bx, by); c.lineTo(bx + Math.min(bw, w - 24), by); c.moveTo(bx + Math.min(bw, w - 24), by - 4); c.lineTo(bx + Math.min(bw, w - 24), by + 4); c.stroke();
      c.fillStyle = "#fff3bf"; c.font = "600 12px system-ui, sans-serif"; c.textAlign = "left";
      c.fillText(`${tr(`${sig(u, 3)} 个天文单位`)} ≈ ${tr(`光走 ${lightText(lightSeconds(u * AU_KM))}`)}`, bx, by - 9);
    }
    // the bodies
    const scale = Math.max(0.85, Math.min(1.5, R / 180));
    for (const q of placed) {
      const { b, p } = q, [x, y] = p;
      const dwarf = b.kind === "dwarf", r0 = dwarf ? 3.6 * scale : (3.6 + 2.6 * Math.sqrt(b.d / 12742)) * scale * (st.dwarfs ? 0.8 : 1);
      const rr = Math.max(2.4, r0);
      const ringed = b.id === "saturn";
      const sp = sprite(b.id, 64, ringed, false);
      const dw = (ringed ? RING_PAD : 1) * rr * 2;
      if (x > -50 && x < w + 50 && y > -50 && y < hh + 50) {
        const g2 = c.createRadialGradient(x, y, rr * 0.8, x, y, rr * 2.2); g2.addColorStop(0, b.color + "30"); g2.addColorStop(1, b.color + "00"); c.fillStyle = g2; c.beginPath(); c.arc(x, y, rr * 2.2, 0, 7); c.fill();
        c.drawImage(sp, x - dw / 2, y - dw / 2, dw, dw);
        if (R > 130 && (!dwarf || R > 170 || st.light === b.id) && (schem || p[2] > 30 || st.light === b.id)) { c.fillStyle = "rgba(255,255,255,.88)"; c.font = `600 ${st.dwarfs ? 10 : 11}px system-ui, sans-serif`; c.textAlign = "center"; c.fillText(nameOf(b), x, y - rr - (ringed ? rr * 0.5 : 0) - 4); }
      }
      bodies.push({ b, x, y, r: Math.max(rr * (ringed ? 1.8 : 1), 13) });
    }
    if (!schem && ZOOMS[st.zi] >= 1) { /* the zoom is shown by the buttons' label */ }
    void rad;
  };
  // ---------- touch: one finger = tap on a body, two fingers = pinch (true scale) ----------
  const ptrs = new Map<number, { x: number; y: number }>();
  let startD = 0, startZ = 0, moved = 0, downAt: { x: number; y: number } | null = null;
  const local = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * cv.offsetWidth, y: ((e.clientY - r.top) / r.height) * cv.offsetHeight }; };
  cv.addEventListener("pointerdown", (e) => { cv.setPointerCapture?.(e.pointerId); ptrs.set(e.pointerId, local(e)); if (ptrs.size === 1) { downAt = local(e); moved = 0; } if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; startD = Math.hypot(a.x - b.x, a.y - b.y); startZ = st.zi; moved = 99; } });
  cv.addEventListener("pointermove", (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, local(e));
    if (downAt && ptrs.size === 1) moved = Math.max(moved, Math.hypot(local(e).x - downAt.x, local(e).y - downAt.y));
    if (ptrs.size === 2 && st.mode === "true" && startD > 0) { const [a, b] = [...ptrs.values()]; const k = Math.hypot(a.x - b.x, a.y - b.y) / startD; const zi = Math.max(0, Math.min(ZOOMS.length - 1, Math.round(startZ + Math.log2(k)))); if (zi !== st.zi) { st.zi = zi; sync(); } }
  });
  const flyTo = (b: Body, x: number, y: number) => {
    if (reducedMotion()) return open(b.id);
    cv.style.transformOrigin = `${x}px ${y}px`; cv.style.transition = "transform .38s ease-in, opacity .38s"; cv.style.transform = "scale(7)"; cv.style.opacity = ".15";
    setTimeout(() => open(b.id), 380);
  };
  cv.addEventListener("pointerup", (e) => {
    const was = ptrs.size; const p = local(e); ptrs.delete(e.pointerId);
    if (was === 1 && moved < 8) { const hit = nearest(bodies, p.x, p.y, 10); if (hit) flyTo(hit.b, hit.x, hit.y); }
    if (ptrs.size === 0) { downAt = null; startD = 0; }
  });
  cv.addEventListener("pointercancel", (e) => { ptrs.delete(e.pointerId); });
  cv.addEventListener("wheel", (e) => { if (st.mode !== "true") return; e.preventDefault(); zoom(e.deltaY < 0 ? 1 : -1); }, { passive: false });

  const root = h("div", { class: "sp-orrery" },
    h("div", { class: "sp-opts" }, h("div", { class: "mset-opts sp-chips" }, ...modeChips, dwarfBtn)),
    h("div", { class: "sp-stage" }, cv, zoomBtns),
    timeRow, lightBox,
    h("p", { class: "muted small center", id: "sp-orrery-tip" }, "点击行星，进入它的页面。示意距离只保留行星的顺序和方向；真实距离下太阳系几乎是空的。"));

  const loop = new Loop(root, (dt) => {

    if (SPEEDS[st.speed] > 0) { st.day += SPEEDS[st.speed] * dt; dateEl.textContent = dateOfDay(st.day); st.dirty = true; }
    if (st.mode === "true") st.dirty = true;
    if (st.dirty) { draw(performance.now()); st.dirty = false; }
  });
  const redraw = () => { if (!root.isConnected) return; draw(performance.now()); st.dirty = false; };
  const ro = new ResizeObserver(() => { st.dirty = true; if (!loop.running) redraw(); });
  const attach = () => { ro.observe(cv); sync(); redraw(); loop.start(); };
  queueMicrotask(() => requestAnimationFrame(() => { if (root.isConnected) attach(); }));
  // hooks for the tests (and the console): state and the screen position of a body
  const w = window as unknown as { __space?: unknown };
  w.__space = {
    st, bodies: () => bodies.map((q) => ({ id: q.b.id, x: q.x, y: q.y, r: q.r })), redraw, sync, setMode, step,
    clientOf: (id: string) => { const q = bodies.find((z) => z.b.id === id); if (!q) return null; const r = cv.getBoundingClientRect(); return [r.left + (q.x / cv.offsetWidth) * r.width, r.top + (q.y / cv.offsetHeight) * r.height]; },
  };
  return { el: root, dispose: () => { loop.stop(); ro.disconnect(); if ((window as unknown as { __space?: unknown }).__space) delete (window as unknown as { __space?: unknown }).__space; } };
}
