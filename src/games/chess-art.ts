/** The twelve cartoon chess pieces, drawn in code (viewBox 100 x 100): round outlines, big eyes, rosy cheeks, crowns and hats. White = cream / pastel, black = deep purple-grey. */
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
export type Mood = "normal" | "scared" | "dizzy" | "happy";

const SK = { w: { fill: "#fff3d2", fill2: "#ffe4a3", line: "#5b4670", acc: "#ffd43b", acc2: "#ff8fab", eye: "#3b2f4a" }, b: { fill: "#5c5470", fill2: "#7a6f93", line: "#1d1829", acc: "#b197fc", acc2: "#f783ac", eye: "#1d1829" } };

const face = (cx: number, cy: number, dx: number, mood: Mood, s = 1): string => {
  const r = 6.2 * s, e = "#fff";
  let eyes = "", mouth = "";
  const cheeks = `<ellipse cx="${cx - dx - 4 * s}" cy="${cy + 8 * s}" rx="${4.4 * s}" ry="${2.8 * s}" fill="#ff7f9e" opacity=".75"/><ellipse cx="${cx + dx + 4 * s}" cy="${cy + 8 * s}" rx="${4.4 * s}" ry="${2.8 * s}" fill="#ff7f9e" opacity=".75"/>`;
  const eyeAt = (x: number, pupil: number, px = 0, py = 1) => `<circle cx="${x}" cy="${cy}" r="${r}" fill="${e}" stroke="#2b2236" stroke-width="2"/><circle cx="${x + px}" cy="${cy + py}" r="${pupil}" fill="#2b2236"/><circle cx="${x + px + pupil * 0.35}" cy="${cy + py - pupil * 0.4}" r="${pupil * 0.36}" fill="#fff"/>`;
  const spiral = (x: number) => { let d = `M${x} ${cy}`; for (let a = 0; a < 3.2 * Math.PI; a += 0.45) { const rr = 0.9 + a * 0.95 * s; d += ` L${(x + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`; } return `<path d="${d}" fill="none" stroke="#2b2236" stroke-width="1.9" stroke-linecap="round"/>`; };
  if (mood === "normal") {
    eyes = eyeAt(cx - dx, 3.1 * s) + eyeAt(cx + dx, 3.1 * s);
    mouth = `<path d="M${cx - 4 * s} ${cy + 9 * s} Q${cx} ${cy + 14 * s} ${cx + 4 * s} ${cy + 9 * s}" fill="none" stroke="#2b2236" stroke-width="2.4" stroke-linecap="round"/>`;
  } else if (mood === "scared") {
    eyes = eyeAt(cx - dx, 1.9 * s, 0, 0) + eyeAt(cx + dx, 1.9 * s, 0, 0) +
      `<path d="M${cx - dx - 6 * s} ${cy - 10 * s} L${cx - dx + 4 * s} ${cy - 7 * s} M${cx + dx + 6 * s} ${cy - 10 * s} L${cx + dx - 4 * s} ${cy - 7 * s}" stroke="#2b2236" stroke-width="2.2" stroke-linecap="round"/>`;
    mouth = `<ellipse cx="${cx}" cy="${cy + 11 * s}" rx="${3.2 * s}" ry="${4 * s}" fill="#7a2a3c" stroke="#2b2236" stroke-width="2"/>`;
  } else if (mood === "dizzy") {
    eyes = spiral(cx - dx) + spiral(cx + dx);
    mouth = `<path d="M${cx - 5 * s} ${cy + 11 * s} Q${cx - 2.5 * s} ${cy + 8 * s} ${cx} ${cy + 11 * s} T${cx + 5 * s} ${cy + 11 * s}" fill="none" stroke="#2b2236" stroke-width="2.2" stroke-linecap="round"/>`;
  } else {
    eyes = `<path d="M${cx - dx - 5 * s} ${cy + 2 * s} Q${cx - dx} ${cy - 6 * s} ${cx - dx + 5 * s} ${cy + 2 * s}" fill="none" stroke="#2b2236" stroke-width="2.8" stroke-linecap="round"/><path d="M${cx + dx - 5 * s} ${cy + 2 * s} Q${cx + dx} ${cy - 6 * s} ${cx + dx + 5 * s} ${cy + 2 * s}" fill="none" stroke="#2b2236" stroke-width="2.8" stroke-linecap="round"/>`;
    mouth = `<path d="M${cx - 6 * s} ${cy + 7 * s} Q${cx} ${cy + 18 * s} ${cx + 6 * s} ${cy + 7 * s} Z" fill="#7a2a3c" stroke="#2b2236" stroke-width="2" stroke-linejoin="round"/>`;
  }
  return `<g class="chess-face">${cheeks}${eyes}${mouth}</g>`;
};

const base = (c: typeof SK.w) => `<path d="M20 88 Q20 79 31 79 H69 Q80 79 80 88 Q80 95 70 95 H30 Q20 95 20 88Z" fill="${c.acc}" stroke="${c.line}" stroke-width="4.5" stroke-linejoin="round"/>`;
const shine = (d: string) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity=".55"/>`;

export function pieceSVG(type: PieceType, color: "w" | "b", mood: Mood = "normal"): string {
  const c = SK[color];
  const S = `fill="${c.fill}" stroke="${c.line}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"`;
  const A = `fill="${c.acc}" stroke="${c.line}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
  const B = `fill="${c.acc2}" stroke="${c.line}" stroke-width="3.5" stroke-linejoin="round"`;
  let body = "";
  switch (type) {
    case "p":
      body = `${base(c)}<path d="M29 80 Q28 50 50 41 Q72 50 71 80Z" ${S}/><ellipse cx="50" cy="41" rx="17" ry="5.5" ${A}/><circle cx="50" cy="26" r="14" ${S}/>${shine("M41 22 Q43 17 48 16")}${face(50, 63, 9, mood)}`;
      break;
    case "r":
      body = `${base(c)}<path d="M29 80 L33 47 H67 L71 80Z" ${S}/><path d="M26 48 V20 H39 V30 H44 V20 H56 V30 H61 V20 H74 V48 Z" ${S}/><rect x="24" y="43" width="52" height="9" rx="4" ${A}/>${shine("M33 26 V38")}${face(50, 64, 10, mood)}`;
      break;
    case "b":
      body = `${base(c)}<path d="M33 80 Q33 62 40 58 H60 Q67 62 67 80Z" ${S}/><path d="M50 18 Q73 33 67 54 Q64 62 50 62 Q36 62 33 54 Q27 33 50 18Z" ${S}/><path d="M53 24 L63 38" stroke="${c.line}" stroke-width="4.5" stroke-linecap="round"/><circle cx="50" cy="13" r="7" ${A}/><ellipse cx="50" cy="60" rx="17" ry="5" ${A}/>${shine("M38 40 Q40 32 45 28")}${face(48, 45, 8, mood, 0.92)}`;
      break;
    case "q":
      body = `${base(c)}<path d="M30 80 Q32 60 37 49 H63 Q68 60 70 80Z" ${S}/><path d="M26 52 L20 22 L37 38 L50 14 L63 38 L80 22 L74 52 Z" ${S}/><circle cx="20" cy="20" r="5" ${B}/><circle cx="50" cy="12" r="5.5" ${B}/><circle cx="80" cy="20" r="5" ${B}/><rect x="26" y="46" width="48" height="9" rx="4.5" ${A}/>${shine("M33 41 L28 29")}${face(50, 67, 9, mood, 0.95)}`;
      break;
    case "k":
      body = `${base(c)}<path d="M28 80 Q27 58 36 49 H64 Q73 58 72 80Z" ${S}/><path d="M30 50 Q29 27 50 27 Q71 27 70 50Z" ${S}/><rect x="46.5" y="6" width="7" height="22" rx="3" ${B}/><rect x="40" y="12" width="20" height="7" rx="3" ${B}/><rect x="27" y="46" width="46" height="9" rx="4.5" ${A}/>${shine("M38 40 Q40 33 46 31")}${face(50, 66, 9, mood, 0.95)}`;
      break;
    case "n":
      body = `${base(c)}<path d="M28 80 Q26 54 40 40 Q36 31 41 22 L43 8 L53 19 Q73 18 83 38 Q88 48 84 55 Q78 60 70 56 Q62 61 61 69 Q64 75 68 80Z" ${S}/><path d="M42 40 Q31 38 28 54 M39 28 Q27 26 25 42" fill="none" stroke="${c.acc2}" stroke-width="6" stroke-linecap="round"/><path d="M43 9 L47 20 L50 18Z" fill="${c.acc2}" stroke="${c.line}" stroke-width="2.5" stroke-linejoin="round"/>${shine("M50 26 Q62 24 71 33")}`;
      {
        const eyeSVG = mood === "dizzy" ? face(66, 36, 0, "dizzy", 0.8).slice(0, 0) : "";
        void eyeSVG;
        const ex = 62, ey = 36;
        let eye = `<circle cx="${ex}" cy="${ey}" r="7.5" fill="#fff" stroke="#2b2236" stroke-width="2.2"/><circle cx="${ex + 1.5}" cy="${ey + 1}" r="3.8" fill="#2b2236"/><circle cx="${ex + 2.6}" cy="${ey - 0.6}" r="1.4" fill="#fff"/>`;
        let mouth = `<path d="M70 62 Q79 63 83 56" fill="none" stroke="#2b2236" stroke-width="2.4" stroke-linecap="round"/>`;
        if (mood === "scared") { eye = `<circle cx="${ex}" cy="${ey}" r="8.4" fill="#fff" stroke="#2b2236" stroke-width="2.2"/><circle cx="${ex}" cy="${ey}" r="2.2" fill="#2b2236"/><path d="M${ex - 8} ${ey - 11} L${ex + 5} ${ey - 8}" stroke="#2b2236" stroke-width="2.2" stroke-linecap="round"/>`; mouth = `<ellipse cx="77" cy="59" rx="3" ry="3.6" fill="#7a2a3c" stroke="#2b2236" stroke-width="2"/>`; }
        else if (mood === "dizzy") { let d = `M${ex} ${ey}`; for (let a = 0; a < 3.2 * Math.PI; a += 0.45) { const rr = 1 + a * 1.05; d += ` L${(ex + Math.cos(a) * rr).toFixed(1)} ${(ey + Math.sin(a) * rr).toFixed(1)}`; } eye = `<path d="${d}" fill="none" stroke="#2b2236" stroke-width="2" stroke-linecap="round"/>`; mouth = `<path d="M69 60 Q73 56 76 60 T83 58" fill="none" stroke="#2b2236" stroke-width="2.2" stroke-linecap="round"/>`; }
        else if (mood === "happy") { eye = `<path d="M${ex - 6} ${ey + 3} Q${ex} ${ey - 7} ${ex + 6} ${ey + 3}" fill="none" stroke="#2b2236" stroke-width="3" stroke-linecap="round"/>`; mouth = `<path d="M68 59 Q76 70 84 57Z" fill="#7a2a3c" stroke="#2b2236" stroke-width="2" stroke-linejoin="round"/>`; }
        body += `${eye}<circle cx="79" cy="47" r="1.8" fill="#2b2236"/><ellipse cx="62" cy="50" rx="5" ry="3" fill="#ff7f9e" opacity=".75"/>${mouth}`;
      }
      break;
  }
  const flip = type === "n" && color === "b" ? ` transform="translate(100 0) scale(-1 1)"` : "";
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g${flip}>${body}</g></svg>`;
}
