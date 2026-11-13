/**
 * 编程 worlds 14-16: pictures drawn in code (inline SVG / HTML, nothing from outside): island emblems and medals, the illustrated demos of the mini-lessons
 * (`demoEl`: lamps, flows, pictures of pixels, waves, points, tables, trees, big text lines that appear one after the other) and the figures of quiz questions.
 */
import { h } from "./ui";
import type { Fig } from "./coding-infomodel";
import { toBin } from "./coding-infomodel";

export const INFO_COLOR: Record<number, string> = { 14: "#364fc7", 15: "#087f5b", 16: "#d9480f" };
export const INFO_LIGHT: Record<number, string> = { 14: "#91a7ff", 15: "#63e6be", 16: "#ffa94d" };
const FONT = `font-family="ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif" font-weight="900" text-anchor="middle"`;
const EMB: Record<number, string> = {
  14: `<g fill="none" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"><rect x="8" y="12" width="12" height="16" rx="3"/><rect x="24" y="12" width="12" height="16" rx="3" fill="#fff"/><rect x="40" y="12" width="12" height="16" rx="3"/></g><text x="14" y="52" font-size="14" ${FONT} fill="#fff">1</text><text x="30" y="52" font-size="14" ${FONT} fill="#fff">0</text><text x="46" y="52" font-size="14" ${FONT} fill="#fff">1</text>`,
  15: `<g stroke="#fff" stroke-width="3.5" stroke-linecap="round"><path d="M30 30L12 14M30 30l18-16M30 30L12 48M30 30l18 18"/></g><circle cx="30" cy="30" r="8" fill="#fff"/><g fill="#fff"><circle cx="12" cy="14" r="5"/><circle cx="48" cy="14" r="5"/><circle cx="12" cy="48" r="5"/><circle cx="48" cy="48" r="5"/></g>`,
  16: `<circle cx="30" cy="30" r="11" fill="none" stroke="#fff" stroke-width="5"/><g stroke="#fff" stroke-width="6" stroke-linecap="round"><path d="M30 6v8M30 46v8M6 30h8M46 30h8M13 13l6 6M41 41l6 6M13 47l6-6M41 19l6-6"/></g><circle cx="30" cy="30" r="4" fill="#fff"/>`,
};
export const infoIslandSvg = (w: number): string => `<svg viewBox="0 0 120 110" aria-hidden="true" focusable="false"><ellipse cx="60" cy="96" rx="44" ry="9" fill="#000" opacity=".16"/><ellipse cx="60" cy="88" rx="46" ry="14" fill="${INFO_LIGHT[w]}"/><circle cx="60" cy="52" r="34" fill="#fff" opacity=".28"/><g transform="translate(30 22)">${EMB[w]}</g></svg>`;
export const infoBadgeSvg = (w: number, got: boolean): string => {
  const c = got ? INFO_COLOR[w] : "#adb5bd", l = got ? INFO_LIGHT[w] : "#dee2e6";
  return `<svg viewBox="0 0 76 94" aria-hidden="true" focusable="false"><path d="M22 4h32l-8 30H30z" fill="${got ? "#ff6b6b" : "#ced4da"}"/><circle cx="38" cy="56" r="30" fill="${l}" stroke="${c}" stroke-width="5"/><circle cx="38" cy="56" r="22" fill="${c}"/><g transform="translate(23.500 41.500) scale(.48)">${EMB[w]}</g></svg>`;
};
/** the medal of a world: all worlds have one (certificate) */
export const flagSvg = `<svg viewBox="0 0 120 110" aria-hidden="true"><rect x="22" y="14" width="76" height="82" rx="10" fill="#fff"/></svg>`;

// ---------- the figures of quiz questions ----------
export function figEl(f: Fig): HTMLElement {
  const box = h("div", { class: "ci-fig user", "data-fig": f.t });
  switch (f.t) {
    case "lamps": {
      const n = f.bits.length;
      box.innerHTML = `<div class="ci-lamps">${[...f.bits].map((b, i) => `<span class="ci-lamp${b === "1" ? " on" : ""}"><i></i><b>${2 ** (n - 1 - i)}</b></span>`).join("")}</div>`;
      break;
    }
    case "ascii": {
      const row = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => `<span><b>${String.fromCharCode(a + i)}</b>${a + i}</span>`).join("");
      box.innerHTML = `<div class="ci-ascii">${row(65, 90)}</div>`;
      break;
    }
    case "code": box.innerHTML = `<pre class="ci-code">${f.text.replace(/</g, "&lt;")}</pre>`; break;
    case "swatch": box.innerHTML = `<span class="ci-swatch" style="background:rgb(${f.rgb.join(",")})"></span>`; break;
    case "bytes": box.innerHTML = `<div class="ci-bytes">${f.hex.map((x) => `<span>${x}</span>`).join("")}</div>`; break;
    case "grid": box.append(gridEl(f.rows)); break;
    case "list": box.innerHTML = `<div class="ci-list">${f.items.map((x) => `<span>${x}</span>`).join("")}</div>`; break;
    case "bars": {
      const max = Math.max(...f.values), W = 280, H = 130, bw = W / f.labels.length;
      box.innerHTML = `<svg viewBox="0 0 ${W} ${H + 24}" class="ci-bars" role="img" aria-label="bar chart">${f.values.map((v, i) => { const hh = (v / max) * (H - 16); return `<rect x="${i * bw + 12}" y="${H - hh}" width="${bw - 24}" height="${hh}" rx="6" fill="${["#4dabf7", "#ffa94d", "#69db7c", "#da77f2"][i % 4]}"/><text x="${i * bw + bw / 2}" y="${H - hh - 4}" font-size="13" ${FONT} fill="#495057">${v}</text><text x="${i * bw + bw / 2}" y="${H + 16}" font-size="13" ${FONT} fill="#495057">${f.labels[i]}</text>`; }).join("")}<path d="M4 ${H}H${W - 4}" stroke="#adb5bd" stroke-width="2"/></svg>`;
      break;
    }
  }
  return box;
}
/** a picture of 0 / 1 rows (black = 1) */
export function gridEl(rows: string[], nums = false): HTMLElement {
  const w = rows[0].length;
  const el = h("div", { class: "ci-pix" + (nums ? " nums" : ""), style: `--w:${w}` });
  el.innerHTML = rows.map((r, y) => `<div class="ci-pixrow">${[...r].map((c) => `<i class="${c === "1" ? "on" : ""}"></i>`).join("")}${nums ? `<b>${parseInt(r, 2)}</b>` : ""}</div>`).join("");
  return el;
}

// ---------- the demos of the mini-lessons ----------
export interface DemoSpec { k: string; [key: string]: unknown }
const esc = (s: unknown) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
export function demoEl(d: DemoSpec): HTMLElement {
  const box = h("div", { class: "ci-demo user", "data-demo": d.k });
  switch (d.k) {
    case "text": {
      const lines = (d.lines as string[]) ?? [];
      box.innerHTML = `<div class="ci-textdemo">${lines.map((l, i) => `<div class="ci-dline" style="animation-delay:${0.25 + i * 0.55}s">${esc(l)}</div>`).join("")}</div>`;
      break;
    }
    case "bits": {
      const n = (d.bits as number) ?? 4, v = (d.n as number) ?? 5, b = toBin(v, n);
      box.innerHTML = `<div class="ci-lamps">${[...b].map((c, i) => `<span class="ci-lamp${c === "1" ? " on" : ""}" style="animation-delay:${0.2 + i * 0.35}s"><i></i><b>${2 ** (n - 1 - i)}</b></span>`).join("")}</div><div class="ci-sum">${[...b].map((c, i) => (c === "1" ? 2 ** (n - 1 - i) : null)).filter((x) => x !== null).join(" + ") || "0"} = ${v}</div>`;
      break;
    }
    case "flow": {
      const items = (d.items as string[]) ?? [];
      box.innerHTML = `<div class="ci-flow">${items.map((t, i) => `<span class="ci-fbox" style="animation-delay:${0.2 + i * 0.5}s">${esc(t)}</span>${i < items.length - 1 ? '<em aria-hidden="true">›</em>' : ""}`).join("")}</div>`;
      break;
    }
    case "grid": box.append(gridEl((d.rows as string[]) ?? [], !!d.nums)); break;
    case "wave": {
      const rate = (d.rate as number) ?? 8, W = 240, H = 90, cyc = 2;
      const pts: string[] = [], dots: string[] = [];
      for (let x = 0; x <= W; x += 2) pts.push(`${x},${H / 2 - Math.sin((x / W) * cyc * 2 * Math.PI) * 34}`);
      const n = Math.round(rate * cyc);
      for (let i = 0; i <= n; i++) { const x = (i / n) * W; dots.push(`<circle cx="${x}" cy="${H / 2 - Math.sin((i / n) * cyc * 2 * Math.PI) * 34}" r="4" fill="#e8590c"/>`); }
      box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="ci-wave"><path d="M0 ${H / 2}H${W}" stroke="#ced4da" stroke-width="1.5"/><polyline points="${pts.join(" ")}" fill="none" stroke="#4dabf7" stroke-width="3"/>${dots.join("")}</svg>`;
      break;
    }
    case "points": {
      const k = (d.k2 as number) ?? 3;
      const P: [number, number, number][] = [[20, 25, 0], [32, 40, 0], [15, 55, 0], [40, 22, 0], [70, 70, 1], [82, 55, 1], [60, 82, 1], [88, 80, 1]];
      box.innerHTML = `<svg viewBox="0 0 100 100" class="ci-pts"><rect width="100" height="100" rx="8" fill="#f8f9fa"/>${P.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="${p[2] ? "#ffa94d" : "#4dabf7"}"/>`).join("")}<circle cx="50" cy="50" r="${k === 1 ? 12 : 28}" fill="none" stroke="#868e96" stroke-dasharray="3 3" stroke-width="1.5"/><circle cx="50" cy="50" r="5" fill="#fff" stroke="#212529" stroke-width="2"/></svg>`;
      break;
    }
    case "table": {
      const head = (d.head as string[]) ?? [], rows = (d.rows as (string | number)[][]) ?? [];
      box.innerHTML = `<table class="ci-table"><tr>${head.map((x) => `<th>${esc(x)}</th>`).join("")}</tr>${rows.map((r) => `<tr>${r.map((x) => `<td>${esc(x)}</td>`).join("")}</tr>`).join("")}</table>`;
      break;
    }
    case "tree": {
      type N = { q?: string; yes?: N; no?: N; a?: string };
      const root = d.root as N;
      const draw = (n: N): string => (n.a !== undefined ? `<span class="ci-leaf">${esc(n.a)}</span>` : `<span class="ci-q">${esc(n.q)}</span><div class="ci-kids"><div><small>✓</small>${draw(n.yes!)}</div><div><small>✗</small>${draw(n.no!)}</div></div>`);
      box.innerHTML = `<div class="ci-tree">${draw(root)}</div>`;
      break;
    }
    default: box.textContent = "";
  }
  return box;
}
