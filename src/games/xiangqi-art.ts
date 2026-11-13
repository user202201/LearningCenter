/** Drawings of the xiangqi game (inline SVG, made in code): the cartoon wooden-coin pieces, the board lines, the POW burst. */
import { pieceChar, K, A, E, H, R, C, P } from "./xiangqi-logic";

const RED_C = "#e03131", BLACK_C = "#212529";
const FONT = `font-family="'Kaiti SC','STKaiti','KaiTi','Noto Serif CJK SC','Songti SC',serif"`;

/** a round wooden piece with a cute face (eyes, rosy cheeks, smile) and its character; eye sets are switched by CSS classes of the piece (normal, scared, dizzy, happy) */
export function pieceSvg(p: number): string {
  const col = p > 0 ? RED_C : BLACK_C, kind = Math.abs(p);
  const hat =
    kind === K ? `<path d="M30 14 L36 4 L43 12 L50 2 L57 12 L64 4 L70 14 Z" fill="#ffd43b" stroke="#e67700" stroke-width="2.5" stroke-linejoin="round"/>`
    : kind === A ? `<path d="M34 14 Q50 -2 66 14 Z" fill="#74c0fc" stroke="#1c7ed6" stroke-width="2.5" stroke-linejoin="round"/>`
    : kind === E ? `<path d="M36 12 Q40 0 50 8 Q60 0 64 12 Z" fill="#8ce99a" stroke="#2b8a3e" stroke-width="2.5" stroke-linejoin="round"/>`
    : kind === H ? `<path d="M30 16 L33 2 L42 12 Z M70 16 L67 2 L58 12 Z" fill="#c68642" stroke="#7f4f24" stroke-width="2.5" stroke-linejoin="round"/>`
    : kind === R ? `<path d="M34 12 L34 4 L42 4 L42 9 L46 9 L46 4 L54 4 L54 9 L58 9 L58 4 L66 4 L66 12 Z" fill="#adb5bd" stroke="#495057" stroke-width="2.2" stroke-linejoin="round"/>`
    : kind === C ? `<circle cx="50" cy="8" r="6.5" fill="#495057" stroke="#212529" stroke-width="2"/><path d="M54 3 L62 -3" stroke="#f08c00" stroke-width="3" stroke-linecap="round"/>`
    : kind === P ? `<path d="M36 13 Q50 -4 64 13 Z" fill="#ffa94d" stroke="#e8590c" stroke-width="2.5" stroke-linejoin="round"/>` : "";
  const mous = kind === K ? `<path d="M50 44 Q40 44 32 49 M50 44 Q60 44 68 49" stroke="#212529" stroke-width="3" fill="none" stroke-linecap="round"/>` : "";
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<circle cx="50" cy="56" r="45" fill="#a8672a"/>
<circle cx="50" cy="50" r="45" fill="#efb35a" stroke="#8a5522" stroke-width="3"/>
<circle cx="50" cy="50" r="38" fill="#ffe9b8" stroke="${col}" stroke-width="3.5"/>
<ellipse cx="34" cy="22" rx="13" ry="5.5" fill="#fff" opacity=".55" transform="rotate(-28 34 22)"/>
${hat}
<g class="xq-e-n"><ellipse cx="36" cy="32" rx="7.5" ry="9" fill="#fff" stroke="#333" stroke-width="1.6"/><ellipse cx="64" cy="32" rx="7.5" ry="9" fill="#fff" stroke="#333" stroke-width="1.6"/><circle cx="37" cy="34" r="4.6" fill="#222"/><circle cx="63" cy="34" r="4.6" fill="#222"/><circle cx="38.6" cy="32" r="1.6" fill="#fff"/><circle cx="64.6" cy="32" r="1.6" fill="#fff"/></g>
<g class="xq-e-s"><ellipse cx="35" cy="32" rx="9" ry="11" fill="#fff" stroke="#333" stroke-width="1.6"/><ellipse cx="65" cy="32" rx="9" ry="11" fill="#fff" stroke="#333" stroke-width="1.6"/><circle cx="35" cy="33" r="2.6" fill="#222"/><circle cx="65" cy="33" r="2.6" fill="#222"/><path d="M24 18 L44 22 M76 18 L56 22" stroke="#333" stroke-width="2.6" stroke-linecap="round"/></g>
<g class="xq-e-x"><path d="M36 32 m-1.5 0 a1.5 1.5 0 1 1 3 0 a4 4 0 1 1 -7 0 a6.5 6.5 0 1 1 11 0 a9 9 0 1 1 -15 0" fill="none" stroke="#333" stroke-width="2.2" stroke-linecap="round"/><path d="M64 32 m-1.5 0 a1.5 1.5 0 1 1 3 0 a4 4 0 1 1 -7 0 a6.5 6.5 0 1 1 11 0 a9 9 0 1 1 -15 0" fill="none" stroke="#333" stroke-width="2.2" stroke-linecap="round"/></g>
<g class="xq-e-h"><path d="M27 36 Q36 22 45 36 M55 36 Q64 22 73 36" fill="none" stroke="#333" stroke-width="4" stroke-linecap="round"/></g>
<ellipse cx="22" cy="48" rx="7" ry="4.5" fill="#ff8787" opacity=".75"/><ellipse cx="78" cy="48" rx="7" ry="4.5" fill="#ff8787" opacity=".75"/>
<path d="M44 44 Q50 49 56 44" fill="none" stroke="#7a3b12" stroke-width="2.4" stroke-linecap="round"/>
${mous}
<path class="xq-sweat" d="M84 14 Q76 28 84 33 Q92 28 84 14 Z" fill="#74c0fc" stroke="#1c7ed6" stroke-width="2"/>
<text class="user" x="50" y="82" text-anchor="middle" font-size="35" font-weight="900" fill="${col}" ${FONT}>${pieceChar(p)}</text>
</svg>`;
}

/** the grid of the board in units (a point (col, row) is at 0.7 + col, 0.7 + row): lines, river, palaces, marks, bamboo */
export function boardSvg(): string {
  const o = 0.7, ln = (x1: number, y1: number, x2: number, y2: number) => `<path d="M${o + x1} ${o + y1}L${o + x2} ${o + y2}"/>`;
  let g = "";
  for (let r = 0; r < 10; r++) g += ln(0, r, 8, r);
  g += ln(0, 0, 0, 9) + ln(8, 0, 8, 9);
  for (let c = 1; c < 8; c++) g += ln(c, 0, c, 4) + ln(c, 5, c, 9);
  g += ln(3, 0, 5, 2) + ln(5, 0, 3, 2) + ln(3, 7, 5, 9) + ln(5, 7, 3, 9);
  // the little corner marks at the cannon and soldier points
  const mark = (c: number, r: number) => {
    let s = "";
    for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
      if ((c === 0 && dx < 0) || (c === 8 && dx > 0)) continue;
      const x = o + c + dx * 0.1, y = o + r + dy * 0.1;
      s += `<path d="M${x + dx * 0.22} ${y}L${x} ${y}L${x} ${y + dy * 0.22}"/>`;
    }
    return s;
  };
  let marks = "";
  for (const [c, r] of [[1, 2], [7, 2], [1, 7], [7, 7], [0, 3], [2, 3], [4, 3], [6, 3], [8, 3], [0, 6], [2, 6], [4, 6], [6, 6], [8, 6]]) marks += mark(c, r);
  const leaf = (x: number, y: number, rot: number, s = 1) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M0 0 Q0.25 -0.45 0 -0.9 Q-0.25 -0.45 0 0Z" fill="#69db7c" stroke="#2b8a3e" stroke-width="0.05"/></g>`;
  const bamboo = (x: number, y: number, flip: number) => `<g transform="translate(${x} ${y}) scale(${flip} 1)"><path d="M0 0 L0.5 0.25" stroke="#2b8a3e" stroke-width="0.09" stroke-linecap="round"/>${leaf(0.1, 0.05, 60, 0.9)}${leaf(0.3, 0.12, 20, 0.8)}${leaf(0.45, 0.2, 100, 0.7)}</g>`;
  return `<svg class="xq-lines" viewBox="0 0 9.4 10.4" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<rect x="${o - 0.09}" y="${o - 0.09}" width="${8.18}" height="${9.18}" fill="none" stroke="#7a4a1d" stroke-width="0.09" rx="0.05"/>
<g fill="none" stroke="#7a4a1d" stroke-width="0.055" stroke-linecap="round" stroke-linejoin="round">${g}</g>
<g fill="none" stroke="#7a4a1d" stroke-width="0.045" stroke-linecap="round">${marks}</g>
<rect x="${o + 0.05}" y="${o + 4.08}" width="7.9" height="0.84" fill="#fff6d6" opacity=".55"/>
<text class="user" x="${o + 2}" y="${o + 4.72}" text-anchor="middle" font-size="0.62" letter-spacing="0.1">\u695a\u6cb3</text>
<text class="user" x="${o + 6}" y="${o + 4.72}" text-anchor="middle" font-size="0.62" letter-spacing="0.1">\u6c49\u754c</text>
${bamboo(0.05, 0.12, 1)}${bamboo(9.35, 0.12, -1)}${bamboo(0.05, 10.25, 1).replace("scale(1 1)", "scale(1 -1)")}${bamboo(9.35, 10.25, -1).replace("scale(-1 1)", "scale(-1 -1)")}
</svg>`;
}

/** a "POW!" starburst */
export function powSvg(): string {
  let pts = "";
  for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2, r = i % 2 ? 30 : 48; pts += `${(50 + Math.cos(a) * r).toFixed(1)},${(50 + Math.sin(a) * r).toFixed(1)} `; }
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><polygon points="${pts}" fill="#ffd43b" stroke="#f76707" stroke-width="3.5" stroke-linejoin="round"/><text x="50" y="58" text-anchor="middle" font-size="24" font-weight="900" fill="#e03131" stroke="#fff" stroke-width="1" paint-order="stroke" font-family="Arial Black,Arial,sans-serif">POW</text></svg>`;
}

/** the picture on the card of the games list (no text) */
export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
<rect x="8" y="8" width="104" height="104" rx="26" fill="#f6cf86" stroke="#b9772f" stroke-width="5"/>
<path d="M22 30 H98 M22 60 H98 M22 90 H98 M36 18 V102 M84 18 V102" stroke="#a0612a" stroke-width="2.5" opacity=".55"/>
<path d="M92 20 Q100 28 96 38 Q88 32 92 20Z M100 34 Q108 42 102 52 Q94 46 100 34Z" fill="#69db7c" stroke="#2b8a3e" stroke-width="2"/>
<g transform="translate(14 44)"><circle cx="30" cy="34" r="30" fill="#a8672a"/><circle cx="30" cy="30" r="30" fill="#efb35a" stroke="#8a5522" stroke-width="3"/><circle cx="30" cy="30" r="24" fill="#ffe9b8" stroke="#212529" stroke-width="3.5"/>
<ellipse cx="21" cy="25" rx="4.6" ry="6" fill="#fff" stroke="#333" stroke-width="1.5"/><ellipse cx="39" cy="25" rx="4.6" ry="6" fill="#fff" stroke="#333" stroke-width="1.5"/><circle cx="22" cy="27" r="2.8" fill="#222"/><circle cx="38" cy="27" r="2.8" fill="#222"/>
<ellipse cx="12" cy="37" rx="4.5" ry="3" fill="#ff8787" opacity=".8"/><ellipse cx="48" cy="37" rx="4.5" ry="3" fill="#ff8787" opacity=".8"/><path d="M23 40 Q30 48 37 40" fill="none" stroke="#7a3b12" stroke-width="3" stroke-linecap="round"/></g>
<g transform="translate(52 14)"><path d="M12 6 L16 -4 L22 2 L28 -4 L34 2 L38 -4 L42 6Z" fill="#ffd43b" stroke="#e67700" stroke-width="2.5" stroke-linejoin="round"/><circle cx="27" cy="38" r="34" fill="#a8672a"/><circle cx="27" cy="34" r="34" fill="#efb35a" stroke="#8a5522" stroke-width="3"/><circle cx="27" cy="34" r="27" fill="#ffe9b8" stroke="#e03131" stroke-width="4"/>
<ellipse cx="17" cy="28" rx="5.2" ry="6.6" fill="#fff" stroke="#333" stroke-width="1.5"/><ellipse cx="37" cy="28" rx="5.2" ry="6.6" fill="#fff" stroke="#333" stroke-width="1.5"/><circle cx="18" cy="30" r="3" fill="#222"/><circle cx="36" cy="30" r="3" fill="#222"/>
<ellipse cx="8" cy="42" rx="5" ry="3.4" fill="#ff8787" opacity=".8"/><ellipse cx="46" cy="42" rx="5" ry="3.4" fill="#ff8787" opacity=".8"/><path d="M19 46 Q27 55 35 46" fill="none" stroke="#7a3b12" stroke-width="3.2" stroke-linecap="round"/><circle cx="27" cy="58" r="3.4" fill="#e03131"/></g>
</svg>`;
