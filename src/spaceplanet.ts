/**
 * One planet (or dwarf planet): `#/science/space/<id>`. A big turning picture with its real axial tilt and spin direction, the data cards, the facts, its moons as a moving
 * mini-system with a card for each moon, the weight scale (体重计), the age counter (年龄计) and the size next to the Earth.
 */
import { h } from "./ui";
import { tr } from "./i18n";
import { subjectArt } from "./hub";
import type { Ctx } from "./english";
import { fit, Loop, reducedMotion, nearest, big, sig, kmText, durText, hoursText, fmt, con, user } from "./spaceui";
import { renderSphereInto, sprite, drawRings, RING_PAD } from "./spaceart";
import { type Space, type Body, type Moon, loadSpace, allBodies, nameOf, moonName, paren, weightOn, ageOn, surfaceSpeedKmh, sizeVsEarth, MOON_G, G_EARTH } from "./spacemodel";

const COLOR = "#7048e8";
const KIND: Record<string, string> = { rock: "岩质行星", gas: "气态巨行星", ice: "冰巨星", dwarf: "矮行星" };

function ringsText(b: Body): string { return b.ring === 2 ? "有，明亮" : b.ring === 1 ? "有，暗淡" : "无"; }
export function dataRows(b: Body, asOf = 2025): [string, (Node | string)[]][] {
  const rel = b.g / G_EARTH, retro = b.rot < 0;
  const rows: [string, (Node | string)[]][] = [
    ["类型", [KIND[b.kind]]],
    ["直径", [`${big(b.d)} 千米`, h("small", { class: "sp-sub" }, `地球的 ${sig(sizeVsEarth(b), 3)} 倍`)]],
    ["质量", [`地球的 ${sig(b.mass, 3)} 倍`]],
    ["与太阳的距离", [`${sig(b.a, 4)} 天文单位`, h("small", { class: "sp-sub" }, kmText(b.a * 149597870.7))]],
    ["公转周期（一年）", [durText(b.P)]],
    ["自转周期", [hoursText(b.rot), ...(retro ? [h("small", { class: "sp-sub" }, "逆行")] : [])]],
  ];
  if (Math.abs(b.sday - Math.abs(b.rot)) / Math.abs(b.rot) > 0.1) rows.push(["昼夜交替一次", [hoursText(b.sday)]]);
  rows.push(["表面温度", [`${b.tmin} ~ ${b.tmax} ℃`, ...(b.tnote ? [h("small", { class: "sp-sub" }, tr(b.tnote))] : [])]]);
  rows.push(["重力", [`地球的 ${sig(rel, 3)} 倍`, h("small", { class: "sp-sub" }, `${sig(b.g, 3)} 米/秒²`)]]);
  rows.push(["平均密度", [`${sig(b.dens, 3)} 克/厘米³`]]);
  rows.push(["赤道自转速度", [`${big(surfaceSpeedKmh(b))} 千米/小时`]]);
  rows.push(["自转轴倾角", [b.tilt === null ? "未知" : `${sig(b.tilt, 3)}°`]]);
  rows.push(["大气", [con(b.atm, "span", "sp-atm")]]);
  rows.push(["卫星", [b.moons === 0 ? "没有" : b.moonsCheck ? `已确认约 ${b.moons} 颗（截至 ${asOf} 年）` : `${b.moons} 颗`]]);
  rows.push(["光环", [ringsText(b)]]);
  return rows;
}

export async function renderPlanet(X: Ctx, id: string): Promise<void> {
  const S = await loadSpace();
  const all = allBodies(S);
  const b = all.find((x) => x.id === id);
  if (!b) { location.hash = "#/science/space"; return; }
  const idx = all.indexOf(b), prev = all[(idx + all.length - 1) % all.length], next = all[(idx + 1) % all.length];
  const moons = S.moons.filter((m) => m.planet === b.id);
  const loops: Loop[] = [];

  // ---------- the turning planet ----------
  const ringed = b.ring === 2;
  const CW = ringed ? 480 : 360, SPH = ringed ? 200 : 300;
  const pc = h("canvas", { class: "sp-planet-cv", id: "sp-planet", width: CW, height: CW, role: "img", "aria-label": nameOf(b), "data-spin": "0" });
  const sphere = document.createElement("canvas"); sphere.width = SPH; sphere.height = SPH;
  const tilt = b.tilt ?? 0;
  const elev = ringed ? 20 : 12;
  let spin = 0.15, mult = 1;
  const drawPlanet = () => {
    const c = pc.getContext("2d")!; c.clearRect(0, 0, CW, CW);
    const cx = CW / 2, cy = CW / 2, R = SPH / 2;
    const gl = c.createRadialGradient(cx, cy, R * 0.95, cx, cy, R * 1.25); gl.addColorStop(0, b.color + "88"); gl.addColorStop(1, b.color + "00"); c.fillStyle = gl; c.beginPath(); c.arc(cx, cy, R * 1.25, 0, 7); c.fill();
    if (ringed) drawRings(c, cx, cy, R, elev, "saturn", "back");
    renderSphereInto(sphere, b.id, -spin, elev, true);
    c.drawImage(sphere, cx - R, cy - R);
    if (ringed) drawRings(c, cx, cy, R, elev, "saturn", "front");
    else if (b.ring === 1) { drawRings(c, cx, cy, R, elev, "faint", "back"); drawRings(c, cx, cy, R, elev, "faint", "front"); }
    pc.dataset.spin = spin.toFixed(3);
  };
  const turnsPerSec = () => (b.rot === 0 ? 0 : (1 / Math.abs(b.rot)) * mult);
  const spinLoop = new Loop(pc, (dt) => { spin = (spin + turnsPerSec() * dt) % 1; drawPlanet(); });
  loops.push(spinLoop);
  const axis = h("div", { class: "sp-axis", "aria-hidden": "true" }, h("i", {}), h("em", {}, "N"));
  const tiltBox = h("div", { class: "sp-tilt", id: "sp-tilt", "data-tilt": String(tilt), style: `transform:rotate(${tilt}deg)` }, pc, axis);
  const speedChips = [1, 10, 100].map((m) => h("button", { class: "mopt" + (m === 1 ? " on" : ""), id: `sp-rot-${m}`, onclick: () => { mult = m; speedChips.forEach((e, i) => e.classList.toggle("on", [1, 10, 100][i] === m)); spinLoop.start(); drawPlanet(); } }, `${m}×`));
  const retro = b.rot < 0;
  const spinInfo = h("div", { class: "sp-spininfo" },
    h("div", {}, h("b", {}, tr("自转方向：")), retro ? "自东向西（逆行）" : "自西向东（顺行）"),
    h("div", {}, h("b", {}, tr("自转轴倾角：")), b.tilt === null ? "未知" : `${sig(b.tilt, 3)}°`),
    h("p", { class: "muted small" }, `1× 表示 1 个地球日 = 24 秒。`),
    h("div", { class: "mset-opts sp-chips" }, ...speedChips));

  // ---------- the data cards and facts ----------
  const rows = dataRows(b, S.moonsAsOf).map(([k, v]) => h("div", { class: "sp-card sp-data", "data-k": k }, h("span", { class: "muted small" }, k), h("b", {}, ...v.map((x) => (typeof x === "string" ? (/[一-鿿]/.test(x) ? x : x) : x)))));
  const facts = h("div", { class: "sp-facts", id: "sp-facts" }, ...b.facts.map((f, i) => h("div", { class: "sp-fact", "data-i": String(i) }, h("i", {}, String(i + 1)), con(f, "p"))));

  // ---------- the moons ----------
  const moonsEl = h("section", { class: "sp-sec", id: "sp-moons" }, h("h2", { class: "sec" }, "卫星"));
  if (!moons.length) moonsEl.append(h("p", { class: "empty" }, ...fmt("{0}没有已知的卫星。", [nameOf(b)])));
  else {
    const mc = h("canvas", { class: "sp-moon-cv", id: "sp-moon-cv", role: "img", "aria-label": tr("卫星系统") });
    const ordered = moons.slice().sort((x, y) => x.a - y.a);
    const ang = ordered.map((_, i) => i * 2.1);
    let day = 0, msel = ""; let msp = 1;
    const base = Math.min(...ordered.map((m) => Math.abs(m.P))) / 4;      // the fastest moon goes round in 4 seconds
    const pos: { m: Moon; x: number; y: number; r: number }[] = [];
    const drawMoons = () => {
      const { c, w, h: hh } = fit(mc); c.clearRect(0, 0, w, hh);
      const g = c.createRadialGradient(w / 2, hh / 2, 0, w / 2, hh / 2, Math.hypot(w, hh) / 2); g.addColorStop(0, "#1c1f4d"); g.addColorStop(1, "#0b0d26"); c.fillStyle = g; c.fillRect(0, 0, w, hh);
      const cx = w / 2, cy = hh / 2, R = Math.min(w, hh) / 2, rp = Math.max(14, Math.min(R * 0.2, 26)) * (ringed ? 0.8 : 1);
      const pr = ringed ? rp * RING_PAD : rp * 2;
      c.drawImage(sprite(b.id, 64, ringed), cx - pr / 2, cy - pr / 2, pr, pr);
      pos.length = 0;
      const r0 = rp * (ringed ? 2.7 : 1.9), r1 = R * 0.9, n = ordered.length;
      ordered.forEach((m, i) => {
        const orr = n === 1 ? (r0 + r1) / 2 : r0 + (i * (r1 - r0)) / (n - 1);
        c.strokeStyle = m.id === msel ? "rgba(255,224,102,.7)" : "rgba(180,190,255,.25)"; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, orr, 0, 7); c.stroke();
        const a = ang[i] + (2 * Math.PI * day) / m.P, mr = Math.max(3.2, Math.min(9, 2.5 + 3.2 * Math.sqrt(m.d / 3475)));
        const x = cx + orr * Math.cos(a), y = cy - orr * Math.sin(a);
        c.drawImage(sprite(m.id, 32), x - mr, y - mr, mr * 2, mr * 2);
        if (m.id === msel) { c.strokeStyle = "#ffe066"; c.lineWidth = 2; c.beginPath(); c.arc(x, y, mr + 3, 0, 7); c.stroke(); }
        pos.push({ m, x, y, r: Math.max(mr, 12) });
      });
    };
    const mloop = new Loop(mc, (dt) => { day += base * msp * dt; drawMoons(); });
    loops.push(mloop);
    (window as unknown as { __spaceMoons?: () => unknown }).__spaceMoons = () => { const r = mc.getBoundingClientRect(); return pos.map((q) => ({ id: q.m.id, x: r.left + (q.x / mc.offsetWidth) * r.width, y: r.top + (q.y / mc.offsetHeight) * r.height })); };
    const cards = h("div", { class: "sp-moon-cards", id: "sp-moon-cards" });
    const select = (id: string, scroll = true) => { msel = id; cards.querySelectorAll<HTMLElement>(".sp-moon").forEach((e) => e.classList.toggle("sel", e.dataset.id === id)); drawMoons(); if (scroll) cards.querySelector<HTMLElement>(`.sp-moon[data-id=${id}]`)?.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" }); };
    mc.addEventListener("pointerup", (e) => { const r = mc.getBoundingClientRect(); const hit = nearest(pos, ((e.clientX - r.left) / r.width) * mc.offsetWidth, ((e.clientY - r.top) / r.height) * mc.offsetHeight, 8); if (hit) select(hit.m.id); });
    for (const m of ordered) {
      const thumb = h("canvas", { class: "sp-moon-thumb", width: 96, height: 96 });
      thumb.getContext("2d")!.drawImage(sprite(m.id, 96), 0, 0);
      cards.append(h("article", { class: "sp-moon", "data-id": m.id, tabindex: "0", onclick: () => select(m.id, false) },
        thumb,
        h("div", { class: "sp-moon-body" },
          h("h3", { class: "user" }, moonName(m)),
          h("div", { class: "sp-moon-rows" },
            h("span", {}, h("small", {}, tr("直径")), `${big(m.d)} 千米`, h("small", { class: "sp-sub" }, `月球的 ${sig(m.d / 3475, 2)} 倍`)),
            h("span", {}, h("small", {}, tr("轨道周期")), durText(m.P), ...(m.P < 0 ? [h("small", { class: "sp-sub" }, tr("逆行"))] : [])),
            h("span", {}, h("small", {}, tr("离行星的距离")), `${big(m.a)} 千米`),
            h("span", {}, h("small", {}, tr("发现者")), con(m.yr ? paren(tr(m.by), m.yr) : m.by))),
          con(m.fact, "p", "sp-moon-fact"))));
    }
    const speeds = [1, 4, 16].map((k) => h("button", { class: "mopt" + (k === 1 ? " on" : ""), id: `sp-ms-${k}`, onclick: () => { msp = k; speeds.forEach((e, i) => e.classList.toggle("on", [1, 4, 16][i] === k)); mloop.start(); } }, `${k}×`));
    moonsEl.append(h("div", { class: "sp-stage sp-moonstage" }, mc), h("div", { class: "mset-opts sp-chips" }, ...speeds),
      h("p", { class: "muted small center" }, "轨道间距为示意，公转周期保持真实比例；最快的卫星约 4 秒转一圈。"),
      ...(b.moons > moons.length ? [h("p", { class: "muted small center", id: "sp-moon-more" }, ...fmt("这里只列出著名的卫星；{0} 共有已确认的卫星约 {1} 颗。", [nameOf(b), String(b.moons)]))] : []),
      cards);
    queueMicrotask(() => requestAnimationFrame(() => { if (mc.isConnected) { drawMoons(); mloop.start(); } }));
  }

  // ---------- weight scale, age counter, size ----------
  const wIn = h("input", { type: "number", min: "1", max: "300", step: "0.5", value: "35", id: "sp-weight", inputMode: "decimal", "aria-label": tr("体重（千克）") }) as HTMLInputElement;
  const worlds = [{ id: "moon", g: MOON_G, n: { zh: "月球", en: "Moon", fr: "Lune" } as { zh: string; en: string; fr: string }, P: 0 }, ...S.planets.map((p) => ({ id: p.id, g: p.g, n: p as { zh: string; en: string; fr: string }, P: p.P })), ...(b.kind === "dwarf" ? [{ id: b.id, g: b.g, n: b as { zh: string; en: string; fr: string }, P: b.P }] : [])];
  const scaleSvg = (frac: number): string => { const a = -75 + Math.max(0, Math.min(1, frac)) * 150; return `<svg viewBox="0 0 60 44" aria-hidden="true"><rect x="4" y="4" width="52" height="36" rx="9" fill="#ffd8a8" stroke="#e8590c" stroke-width="2"/><path d="M12 30 A18 18 0 0 1 48 30" fill="#fff" stroke="#e8590c" stroke-width="1.5"/><line x1="30" y1="30" x2="30" y2="15" stroke="#e03131" stroke-width="2.4" stroke-linecap="round" transform="rotate(${a} 30 30)"/><circle cx="30" cy="30" r="2.6" fill="#495057"/><rect x="18" y="33" width="24" height="3" rx="1.5" fill="#e8590c"/></svg>`; };
  const wList = h("div", { class: "sp-wlist", id: "sp-wlist" });
  const aIn = h("input", { type: "number", min: "0", max: "120", step: "0.5", value: "10", id: "sp-age", inputMode: "decimal", "aria-label": tr("年龄（岁）") }) as HTMLInputElement;
  const aList = h("div", { class: "sp-wlist", id: "sp-alist" });
  const fmtN = (x: number) => (x >= 100 ? big(x) : x >= 10 ? sig(x, 3) : sig(x, 3));
  const redrawTools = () => {
    const kg = Math.max(0, +wIn.value || 0), age = Math.max(0, +aIn.value || 0);
    const ws = worlds.map((w) => ({ w, v: weightOn(kg, w.g) })), mx = Math.max(1, ...ws.map((x) => x.v));
    wList.replaceChildren(...ws.map(({ w, v }) => {
      const sc = h("span", { class: "sp-scale" }); sc.innerHTML = scaleSvg(v / mx);
      const th = h("canvas", { class: "sp-wthumb", width: 72, height: 72 }); th.getContext("2d")!.drawImage(sprite(w.id, 72), 0, 0);
      return h("div", { class: "sp-wrow" + (w.id === b.id ? " cur" : ""), "data-id": w.id }, th, h("b", { class: "user" }, nameOf(w.n)), sc, h("span", { class: "sp-wval" }, h("b", { "data-kg": v.toFixed(2) }, `${fmtN(v)} 千克`)));
    }));
    aList.replaceChildren(...worlds.filter((w) => w.P > 0).map((w) => h("div", { class: "sp-wrow" + (w.id === b.id ? " cur" : ""), "data-id": w.id }, (() => { const th = h("canvas", { class: "sp-wthumb", width: 72, height: 72 }); th.getContext("2d")!.drawImage(sprite(w.id, 72), 0, 0); return th; })(), h("b", { class: "user" }, nameOf(w.n)), h("span", { class: "sp-wval" }, h("b", { "data-age": ageOn(age, w.P).toFixed(4) }, `${sig(ageOn(age, w.P), 3)} 岁`)))));
  };
  wIn.addEventListener("input", redrawTools); aIn.addEventListener("input", redrawTools);
  redrawTools();
  const sizeCv = h("canvas", { class: "sp-size-cv", id: "sp-size", role: "img", "aria-label": tr("与地球的大小比较") });
  const drawSize = () => {
    const { c, w, h: hh } = fit(sizeCv); c.clearRect(0, 0, w, hh);
    const rb = sizeVsEarth(b), maxR = Math.max(1, rb), unit = Math.min(w / 2.4, hh) * 0.45 / maxR;   // pixels for the Earth's radius
    const earthR = Math.max(3, unit), bodyR = Math.max(3, unit * rb);
    const cy = hh / 2, gap = 14, total = earthR * 2 + gap + bodyR * 2, x0 = (w - total) / 2;
    c.drawImage(sprite("earth", 96), x0, cy - earthR, earthR * 2, earthR * 2);
    const pr = bodyR * 2 * (ringed ? RING_PAD : 1);
    c.drawImage(sprite(b.id, 96, ringed), x0 + earthR * 2 + gap + bodyR - pr / 2, cy - pr / 2, pr, pr);
  };
  const tools = h("section", { class: "sp-sec", id: "sp-tools" },
    h("h2", { class: "sec" }, "体重计"),
    h("label", { class: "sp-in" }, h("span", {}, "你的体重（千克）"), wIn), wList,
    h("p", { class: "muted small center" }, "体重 = 质量 × 当地重力。质量不变，重力不同，称出的数字就不同。气态行星按 1 个大气压处计算。"),
    h("h2", { class: "sec" }, "年龄计"),
    h("label", { class: "sp-in" }, h("span", {}, "你的年龄（岁）"), aIn), aList,
    h("p", { class: "muted small center" }, "一年就是绕太阳转一圈：离太阳越远，一年越长，同样的时间里年龄的数字就越小。"),
    h("h2", { class: "sec" }, "和地球比大小"),
    h("div", { class: "sp-stage sp-sizestage" }, sizeCv),
    h("p", { class: "muted small center", id: "sp-size-text" }, ...fmt("{0}的直径是地球的 {1} 倍。", [nameOf(b), sig(sizeVsEarth(b), 3)])));

  const nav = h("div", { class: "sp-pn" },
    h("button", { class: "mopt", id: "sp-prev", onclick: () => (location.hash = `#/science/space/${prev.id}`) }, "‹ ", user(nameOf(prev))),
    h("button", { class: "mopt", id: "sp-next", onclick: () => (location.hash = `#/science/space/${next.id}`) }, user(nameOf(next)), " ›"));
  const page = h("div", { class: "page sp-page", style: `--kid:${COLOR}`, "data-planet": b.id },
    h("header", { class: "top hero home-hero subj-hero" }, X.back("#/science/space", "返回"), h("span", { class: "subj-ico" }, subjectArt("science")), h("div", { class: "hero-text" }, h("h1", { class: "user" }, nameOf(b)), h("p", {}, tr(b.intro))), X.gear(`#/science/space/${b.id}`)),
    h("main", { class: "scroll" }, h("div", { class: "narrow" },
      h("div", { class: "sp-hero-stage" }, h("div", { class: "sp-view" }, tiltBox), spinInfo),
      h("h2", { class: "sec" }, "基本数据"), h("div", { class: "sp-grid", id: "sp-data" }, ...rows),
      h("h2", { class: "sec" }, "趣味知识"), facts,
      moonsEl, tools, nav)));
  X.show(page);
  drawPlanet();
  queueMicrotask(() => requestAnimationFrame(() => { if (page.isConnected) { drawSize(); spinLoop.start(); } }));
  const ro = new ResizeObserver(() => { if (page.isConnected) drawSize(); }); ro.observe(sizeCv);
}
