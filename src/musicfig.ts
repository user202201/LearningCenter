/**
 * Drawings of the music course, made in code (inline SVG, nothing from outside): a piano keyboard strip, staves with notes / rests / clefs / key and time
 * signatures / chords / repeat signs, one-line rhythm staves, the circle of fifths, a small table and a big sign. The course data (`music-theory.json`) describes
 * a drawing as a small object (`Fig`), see `figure()`. Pitch names are scientific ("C4" = middle C, "F#4", "Bb3").
 */
export type Fig =
  | { t: "keys"; from: string; to: string; hl?: string[]; names?: boolean }
  | { t: "staff"; clef: "treble" | "bass" | "grand"; notes: StaffItem[]; time?: string; key?: string; names?: boolean }
  | { t: "rhythm"; notes: { d: string }[]; time?: string }
  | { t: "circle5" }
  | { t: "table"; head: string[]; rows: string[][] }
  | { t: "text"; s: string };
export type StaffItem = { p?: string | string[]; d?: string; n?: boolean; bar?: boolean; repeat?: "start" | "end" };

import { tr } from "./i18n";
const INK = "#2d2230", ACC = "#e8590c", HL = "#ffd43b";
const LETTER: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const PITCH = /^([A-G])([#b]?)(\d)$/;
const parse = (p: string) => { const m = PITCH.exec(p); if (!m) return null; return { letter: m[1], acc: m[2], oct: +m[3], idx: +m[3] * 7 + LETTER[m[1]], midi: (+m[3] + 1) * 12 + SEMI[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) }; };
const NS = "http://www.w3.org/2000/svg";
const svgWrap = (w: number, h: number, inner: string, cls = "mfig-svg") => `<svg viewBox="0 0 ${w} ${h}" xmlns="${NS}" class="${cls}" role="img" aria-hidden="true" style="max-width:${Math.round(w * 1.6)}px"><g fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" font-family="system-ui, 'Times New Roman', serif">${inner}</g></svg>`;
const txt = (x: number, y: number, s: string, size = 12, anchor = "middle", fill = INK, weight = 700) => `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" fill="${fill}" stroke="none" font-weight="${weight}">${s}</text>`;

// ---------- keyboard ----------
const isBlackMidi = (m: number) => [1, 3, 6, 8, 10].includes(m % 12);
const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
function keys(f: Extract<Fig, { t: "keys" }>): string {
  const a = parse(f.from), b = parse(f.to);
  if (!a || !b) return "";
  const hl = new Set((f.hl ?? []).map((p) => parse(p)?.midi).filter((x): x is number => x !== undefined));
  const whites: number[] = [];
  for (let m = a.midi; m <= b.midi; m++) if (!isBlackMidi(m)) whites.push(m);
  const W = 22, H = 80, BW = 13, BH = 48, pad = 4;
  let inner = "";
  whites.forEach((m, i) => {
    inner += `<rect x="${pad + i * W}" y="${pad}" width="${W}" height="${H}" rx="3" fill="${hl.has(m) ? HL : "#fff"}"/>`;
    if (f.names) inner += txt(pad + i * W + W / 2, pad + H - 7, NOTE_NAMES[m % 12] + (m % 12 === 0 ? String(Math.floor(m / 12) - 1) : ""), 10, "middle", "#6b5d66", 800);
  });
  whites.forEach((m, i) => {
    const next = m + 1;
    if (next <= b.midi && isBlackMidi(next) && i < whites.length) inner += `<rect x="${pad + (i + 1) * W - BW / 2}" y="${pad}" width="${BW}" height="${BH}" rx="2" fill="${hl.has(next) ? ACC : INK}"/>`;
  });
  return svgWrap(whites.length * W + pad * 2, H + pad * 2, inner);
}

// ---------- staff ----------
const KEYSIG: Record<string, number> = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, "F#": 6, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5 };
const SHARP_IDX = [38, 35, 39, 36, 33, 37, 34], FLAT_IDX = [34, 37, 33, 36, 32, 35, 31];   // treble positions: F C G D A E B / B E A D G C F
const DUR_W: Record<string, number> = { w: 46, h: 38, q: 30, e: 27, s: 25 };

/** the treble (G) clef: a spiral round the G line, a long stroke and a tail (drawn with its centre on the G line) */
const TREBLE = `<path d="M3 -37C9 -33 11 -24 7 -15C3 -6 -6 0 -6 9C-6 18 1 22 8 20C15 18 14 8 7 5C0 2 -9 7 -9 16C-9 25 -3 30 -3 36C-3 41 -7 43 -10 40" stroke-width="2.2"/><path d="M4 -37L-1 20" stroke-width="1.8"/><circle cx="-8" cy="39" r="2.6" fill="${INK}" stroke="none"/>`;
const BASS = `<path d="M-9 -9C-1 -13 9 -9 9 0C9 12 -1 22 -14 28" stroke-width="2.4"/><circle cx="-9" cy="-9" r="3.6" fill="${INK}" stroke="none"/><circle cx="14" cy="-14" r="1.9" fill="${INK}" stroke="none"/><circle cx="14" cy="-4" r="1.9" fill="${INK}" stroke="none"/>`;

function staff(f: Extract<Fig, { t: "staff" | "rhythm" }>): string {
  const rhythm = f.t === "rhythm";
  const clef = rhythm ? "perc" : (f as Extract<Fig, { t: "staff" }>).clef;
  const items: StaffItem[] = rhythm ? (f as Extract<Fig, { t: "rhythm" }>).notes.map((n) => ({ p: "perc", d: n.d })) : (f as Extract<Fig, { t: "staff" }>).notes;
  const key = rhythm ? undefined : (f as Extract<Fig, { t: "staff" }>).key;
  const grand = clef === "grand";
  const T = 44;                                   // y of the top line of the (upper) staff
  const staffTops = grand ? [T, T + 84] : [T];
  const baseOf = (kind: "treble" | "bass") => (kind === "treble" ? 30 : 18);   // the index of the bottom line (E4 / G2)
  const yOf = (idx: number, kind: "treble" | "bass", top: number) => top + 40 - (idx - baseOf(kind)) * 5;
  const lineYs = (top: number) => [0, 10, 20, 30, 40].map((d) => top + d);
  let x = 10, inner = "";
  const total = staffTops.length;
  // clefs
  const kinds: ("treble" | "bass")[] = grand ? ["treble", "bass"] : clef === "bass" ? ["bass"] : ["treble"];
  const right = { v: 0 };
  const parts: string[] = [];
  const drawLines = (width: number) => staffTops.map((top) => (clef === "perc" ? `<path d="M6 ${top + 20}H${width}" />` : lineYs(top).map((y) => `<path d="M6 ${y}H${width}"/>`).join(""))).join("");
  if (clef !== "perc") {
    kinds.forEach((k, i) => { const top = staffTops[i]; parts.push(`<g transform="translate(${x + 14} ${k === "treble" ? top + 30 : top + 10})">${k === "treble" ? TREBLE : BASS}</g>`); });
    x += 36;
    if (key && KEYSIG[key]) {
      const n = KEYSIG[key], sharp = n > 0;
      kinds.forEach((k, i) => {
        const top = staffTops[i];
        for (let j = 0; j < Math.abs(n); j++) {
          const idx = (sharp ? SHARP_IDX : FLAT_IDX)[j] - (k === "bass" ? 14 : 0);
          parts.push(txt(x + j * 9 + 4, yOf(idx, k, top) + 5, sharp ? "♯" : "♭", 18, "middle", INK, 400));
        }
      });
      x += Math.abs(n) * 9 + 8;
    }
  } else x += 8;
  const time = (f as { time?: string }).time;
  if (time && /^\d+\/\d+$/.test(time)) {
    const [a, b] = time.split("/");
    staffTops.forEach((top) => { parts.push(txt(x + 8, top + 19, a, 22, "middle", INK, 900), txt(x + 8, top + 39, b, 22, "middle", INK, 900)); });
    x += 26;
  }
  x += 14;
  const names: string[] = [];
  let minY = T - 8, maxY = (grand ? T + 84 : T) + 48;
  for (const it of items) {
    if (it.bar) { staffTops.forEach((top, i) => { if (i === 0 || !grand || true) parts.push(`<path d="M${x} ${top}V${top + 40}"/>`); }); if (grand) parts.push(`<path d="M${x} ${T}V${T + 124}"/>`); x += 14; continue; }
    if (it.repeat) {
      staffTops.forEach((top) => {
        const thick = `<path d="M${x} ${top}V${top + 40}" stroke-width="4"/>`, thin = `<path d="M${x + (it.repeat === "start" ? 6 : -6)} ${top}V${top + 40}" stroke-width="1.4"/>`;
        const dx = it.repeat === "start" ? 12 : -12;
        parts.push(thick, thin, `<circle cx="${x + dx}" cy="${top + 14}" r="2" fill="${INK}" stroke="none"/><circle cx="${x + dx}" cy="${top + 26}" r="2" fill="${INK}" stroke="none"/>`);
      });
      x += it.repeat === "start" ? 22 : 12; continue;
    }
    const d = it.d ?? "q", base = d.replace(".", ""), dotted = d.includes(".");
    const w = DUR_W[base] ?? 30;
    const cx = x + w / 2;
    const pitches = Array.isArray(it.p) ? it.p : it.p ? [it.p] : [];
    if (it.p === "r") {                              // a rest, drawn on the upper staff
      const top = staffTops[0];
      parts.push(rest(cx, top, base));
      if (dotted) parts.push(`<circle cx="${cx + 10}" cy="${top + 18}" r="1.8" fill="${INK}" stroke="none"/>`);
    } else if (it.p === "perc" || pitches.length) {
      const heads = pitches.map((p) => {
        if (p === "perc") return { kind: "treble" as const, top: staffTops[0], y: staffTops[0] + 20, idx: 0, acc: "", label: "" };
        const q = parse(p);
        if (!q) return null;
        const kind: "treble" | "bass" = grand ? (q.idx >= 28 ? "treble" : "bass") : clef === "bass" ? "bass" : "treble";
        const top = grand ? (kind === "treble" ? staffTops[0] : staffTops[1]) : staffTops[0];
        return { kind, top, y: yOf(q.idx, kind, top), idx: q.idx, acc: q.acc, label: q.letter + (q.acc === "#" ? "♯" : q.acc === "b" ? "♭" : "") };
      }).filter((h): h is NonNullable<typeof h> => !!h);
      if (!heads.length) { x += w; continue; }
      const ys = heads.map((h) => h.y), lowY = Math.max(...ys), highY = Math.min(...ys), mid = heads[0].top + 20;
      const up = (lowY + highY) / 2 >= mid;           // notes below the middle line have stems up
      heads.forEach((h) => {
        // ledger lines
        const top = h.top;
        if (h.y < top - 1) for (let ly = top - 10; ly >= h.y - 1; ly -= 10) parts.push(`<path d="M${cx - 10} ${ly}H${cx + 10}"/>`);
        if (h.y > top + 41) for (let ly = top + 50; ly <= h.y + 1; ly += 10) parts.push(`<path d="M${cx - 10} ${ly}H${cx + 10}"/>`);
        if (grand && h.kind === "treble" && h.y > top + 41 === false && false) parts.push("");
        const filled = base !== "w" && base !== "h";
        parts.push(`<ellipse cx="${cx}" cy="${h.y}" rx="6.6" ry="4.7" transform="rotate(-20 ${cx} ${h.y})" fill="${filled ? INK : "#fff"}" stroke-width="${filled ? 1 : 1.8}"/>`);
        if (h.acc) parts.push(txt(cx - 17, h.y + 5, h.acc === "#" ? "♯" : "♭", 17, "middle", INK, 400));
        if (dotted) parts.push(`<circle cx="${cx + 12}" cy="${(h.y - top) % 10 === 0 ? h.y - 3 : h.y}" r="1.8" fill="${INK}" stroke="none"/>`);
        if (f.t === "staff" && (f.names || it.n) && h.label) names.push(txt(cx, 0, h.label, 11, "middle", ACC, 800));
        minY = Math.min(minY, h.y - 10); maxY = Math.max(maxY, h.y + 12);
      });
      if (base !== "w") {
        const sx = up ? cx + 6 : cx - 6, y0 = up ? lowY : highY, y1 = up ? highY - 33 : lowY + 33;
        parts.push(`<path d="M${sx} ${y0}V${y1}" stroke-width="1.4"/>`);
        if (base === "e" || base === "s") {
          const fy = y1, dir = up ? 1 : -1;
          parts.push(`<path d="M${sx} ${fy}c${6 * dir} ${6 * dir} ${9 * dir} ${12 * dir} ${5 * dir} ${20 * dir}" stroke-width="1.6"/>`);
          if (base === "s") parts.push(`<path d="M${sx} ${fy + 7 * dir}c${6 * dir} ${6 * dir} ${9 * dir} ${12 * dir} ${5 * dir} ${20 * dir}" stroke-width="1.6"/>`);
        }
        minY = Math.min(minY, y1 - 4); maxY = Math.max(maxY, y1 + 4);
      }
      if (names.length) names[names.length - 1] = names[names.length - 1].replace(`y="0"`, `y="${(grand ? T + 84 : T) + 62}"`);
    }
    x += w;
  }
  const width = Math.max(x + 12, 90);
  inner = drawLines(width) + (grand ? `<path d="M6 ${T}V${T + 124}" stroke-width="2"/>` : "") + parts.join("") + names.join("");
  const bottom = Math.max(maxY, (grand ? T + 84 : T) + (names.length ? 70 : 50));
  const topShift = Math.min(0, minY - 6);
  return svgWrap(width, bottom - topShift + 8, `<g transform="translate(0 ${-topShift})">${inner}</g>`);
}
function rest(cx: number, top: number, d: string): string {
  const k = `fill="${INK}" stroke="none"`;
  if (d === "w") return `<rect x="${cx - 7}" y="${top + 10}" width="14" height="5" ${k}/>`;
  if (d === "h") return `<rect x="${cx - 7}" y="${top + 15}" width="14" height="5" ${k}/>`;
  if (d === "q") return `<path d="M${cx - 3} ${top + 6}l7 9l-6 7l6 8q-8 -2 -4 9" stroke-width="2.4"/>`;
  const one = (dy: number) => `<circle cx="${cx - 3}" cy="${top + 14 + dy}" r="2.4" ${k}/><path d="M${cx - 1} ${top + 15 + dy}q5 0 6 -5l-7 20" stroke-width="1.8"/>`;
  return d === "s" ? one(-3) + one(7) : one(0);
}

// ---------- circle of fifths ----------
function circle5(): string {
  const maj = ["C", "G", "D", "A", "E", "B", "F♯/G♭", "D♭", "A♭", "E♭", "B♭", "F"], min = ["Am", "Em", "Bm", "F♯m", "C♯m", "G♯m", "E♭m", "B♭m", "Fm", "Cm", "Gm", "Dm"];
  const sig = ["0", "1♯", "2♯", "3♯", "4♯", "5♯", "6♯/6♭", "5♭", "4♭", "3♭", "2♭", "1♭"];
  let inner = `<g transform="translate(14 14)"><circle cx="110" cy="110" r="100" fill="#fff8e6"/><circle cx="110" cy="110" r="64" fill="#fff"/><circle cx="110" cy="110" r="38" fill="#f3f0ff"/>`;
  for (let i = 0; i < 12; i++) {
    const a = (i * 30 - 90) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    inner += txt(110 + c * 82, 110 + s * 82 + 4, maj[i], i === 6 ? 9 : 13, "middle", INK, 900);
    inner += txt(110 + c * 52, 110 + s * 52 + 3, min[i], 9, "middle", "#5f3dc4", 700);
    inner += txt(110 + c * 108, 110 + s * 108 + 3, sig[i], 8, "middle", ACC, 700);
  }
  inner += txt(110, 108, tr("五度圈"), 12, "middle", INK, 900) + txt(110, 123, tr("顺时针升五度"), 7, "middle", "#6b5d66", 700) + "</g>";
  return svgWrap(248, 248, inner, "mfig-svg circle5");
}

/** a drawing of the course (null when the spec is unknown) */
export function figure(f: Fig | null | undefined): HTMLElement | null {
  if (!f) return null;
  const d = document.createElement("div");
  d.className = "mfig user";
  d.dataset.fig = f.t;
  switch (f.t) {
    case "keys": d.innerHTML = keys(f); break;
    case "staff": case "rhythm": d.innerHTML = staff(f); break;
    case "circle5": d.innerHTML = circle5(); break;
    case "table": {
      const t = document.createElement("table"); t.className = "mfig-table";
      const mk = (cells: string[], tag: "th" | "td") => { const tr = document.createElement("tr"); cells.forEach((c) => { const e = document.createElement(tag); e.textContent = c; tr.append(e); }); return tr; };
      const head = document.createElement("thead"); head.append(mk(f.head, "th"));
      const body = document.createElement("tbody"); f.rows.forEach((r) => body.append(mk(r, "td")));
      t.append(head, body); d.append(t); break;
    }
    case "text": { const s = document.createElement("div"); s.className = "mfig-text"; s.textContent = f.s; d.append(s); break; }
    default: return null;
  }
  return d;
}
