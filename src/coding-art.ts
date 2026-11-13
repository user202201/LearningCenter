/** 编程: pictures drawn in code (inline SVG, nothing from outside): the card of the subject picker, the medals of the worlds, the emblems of the world islands. Only digits / Latin letters inside. */
const FONT = `font-family="ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif" font-weight="900" text-anchor="middle"`;

/** the card: a friendly robot with an antenna holding a code window ({ } and a cursor) */
export const CODING_CARD_ART = `<ellipse cx="60" cy="111" rx="36" ry="6" fill="#000" opacity=".16"/>
  <path d="M60 20V9" stroke="#0b7285" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="8" r="6" fill="#ff6b6b" stroke="#fff" stroke-width="2"/>
  <rect x="26" y="20" width="68" height="58" rx="18" fill="#fff"/><rect x="26" y="20" width="68" height="58" rx="18" fill="none" stroke="#0b7285" stroke-width="3.500"/>
  <rect x="34" y="28" width="52" height="38" rx="12" fill="#e3fafc"/>
  <circle cx="48" cy="45" r="5" fill="#2d2230"/><circle cx="72" cy="45" r="5" fill="#2d2230"/><circle cx="49.500" cy="43.500" r="1.800" fill="#fff"/><circle cx="73.500" cy="43.500" r="1.800" fill="#fff"/>
  <circle cx="40" cy="57" r="4.500" fill="#ff8fa3" opacity=".6"/><circle cx="80" cy="57" r="4.500" fill="#ff8fa3" opacity=".6"/>
  <path d="M52 56q8 8 16 0" fill="none" stroke="#2d2230" stroke-width="3" stroke-linecap="round"/>
  <rect x="14" y="40" width="9" height="20" rx="4.500" fill="#0b7285"/><rect x="97" y="40" width="9" height="20" rx="4.500" fill="#0b7285"/>
  <rect x="38" y="80" width="44" height="26" rx="7" fill="#0b2e3a"/><rect x="38" y="80" width="44" height="26" rx="7" fill="none" stroke="#22b8cf" stroke-width="2.500"/>
  <text x="52" y="100" font-size="17" ${FONT} fill="#66d9e8">{</text><text x="68" y="100" font-size="17" ${FONT} fill="#66d9e8">}</text><rect x="58.500" y="88" width="3" height="12" rx="1.500" fill="#ffd43b"/>
  <path transform="translate(16 82) scale(8)" d="M0-1 .28-.28 1 0 .28.28 0 1-.28.28-1 0-.28-.28z" fill="#fff3bf"/><path transform="translate(104 24) scale(7)" d="M0-1 .28-.28 1 0 .28.28 0 1-.28.28-1 0-.28-.28z" fill="#fff3bf"/>`;

/** (exported so that coding-art2.ts can add the colours and emblems of worlds 7+) */
export const COLOR = ["#1971c2", "#e8590c", "#7048e8", "#d6336c", "#2b8a3e", "#0b7285"];
export const LIGHT = ["#74c0fc", "#ffa94d", "#b197fc", "#faa2c1", "#8ce99a", "#66d9e8"];
export const worldColor = (w: number) => COLOR[(w - 1) % COLOR.length];
export const worldLight = (w: number) => LIGHT[(w - 1) % LIGHT.length];

/** the emblem of a world (what it teaches), 60 x 60 */
export const EMBLEM: Record<number, string> = {
  1: `<g fill="#fff"><circle cx="14" cy="42" r="6"/><circle cx="30" cy="30" r="6"/><circle cx="46" cy="18" r="6"/></g><path d="M18 38l8-6M34 26l8-6" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 5"/>`,
  2: `<path d="M44 22a16 16 0 1 0 3 12" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M36 14l12 6-8 10z" fill="#fff"/>`,
  3: `<path d="M30 52V32M30 32L14 14M30 32l16-18" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><circle cx="14" cy="12" r="5" fill="#fff"/><circle cx="46" cy="12" r="5" fill="#fff"/>`,
  4: `<rect x="10" y="14" width="40" height="32" rx="9" fill="none" stroke="#fff" stroke-width="5"/><text x="30" y="38" font-size="22" ${FONT} fill="#fff">f(x)</text>`,
  5: `<text x="30" y="38" font-size="30" ${FONT} fill="#fff">x=7</text>`,
  6: `<path d="M30 8l7 15 16 2-12 11 3 16-14-8-14 8 3-16L7 25l16-2z" fill="none" stroke="#fff" stroke-width="4.500" stroke-linejoin="round"/>`,
};
/** a round island for the world map */
export const islandSvg = (w: number): string => `<svg viewBox="0 0 120 110" aria-hidden="true" focusable="false">
  <ellipse cx="60" cy="98" rx="46" ry="9" fill="#000" opacity=".14"/>
  <path d="M8 60q0 34 52 34t52-34z" fill="#b08968"/><path d="M8 60q0 12 14 20 18 8 38 8t38-8q14-8 14-20z" fill="#9c6f4a" opacity=".6"/>
  <ellipse cx="60" cy="58" rx="52" ry="22" fill="#74c69d"/><ellipse cx="60" cy="54" rx="46" ry="17" fill="#95d5b2"/>
  <circle cx="60" cy="40" r="30" fill="${worldColor(w)}" stroke="#fff" stroke-width="4"/>
  <g transform="translate(30 10)">${EMBLEM[w] ?? ""}</g></svg>`;

/** a cartoon medal at the end of a world (a trophy shelf slot); `got` = earned */
export const badgeSvg = (w: number, got: boolean): string => {
  const c = got ? worldColor(w) : "#ced4da", l = got ? worldLight(w) : "#e9ecef";
  return `<svg viewBox="0 0 80 100" aria-hidden="true" focusable="false">
    <path d="M22 4l14 34h8L58 4z" fill="${got ? "#e03131" : "#adb5bd"}"/><path d="M30 4l10 34" stroke="#fff" stroke-width="2" opacity=".5"/>
    <circle cx="40" cy="64" r="30" fill="${got ? "#ffd43b" : "#dee2e6"}" stroke="${got ? "#f59f00" : "#adb5bd"}" stroke-width="4"/>
    <circle cx="40" cy="64" r="22" fill="${c}" stroke="#fff" stroke-width="3"/><circle cx="40" cy="64" r="22" fill="${l}" opacity=".25"/>
    ${got ? `<g transform="translate(18 42) scale(.73)">${EMBLEM[w] ?? ""}</g>` : `<text x="40" y="74" font-size="26" ${FONT} fill="#fff">${w}</text>`}
    ${got ? '<path transform="translate(63 38) scale(7)" d="M0-1 .28-.28 1 0 .28.28 0 1-.28.28-1 0-.28-.28z" fill="#fff3bf"/>' : ""}</svg>`;
};
