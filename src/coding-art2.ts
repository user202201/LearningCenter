/** 编程 worlds 7-10: pictures drawn in code (inline SVG, nothing from outside): the emblems / medals of the worlds and the sprites of the stage. Only digits / Latin letters / symbols inside the pictures. */
import { COLOR, LIGHT, EMBLEM } from "./coding-art";

const FONT = `font-family="ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif" font-weight="900" text-anchor="middle"`;
// colours of worlds 7-10 (the list of coding-art.ts is indexed by the world number)
COLOR[6] = "#c2255c"; LIGHT[6] = "#f783ac";
COLOR[7] = "#5f3dc4"; LIGHT[7] = "#b197fc";
COLOR[8] = "#e67700"; LIGHT[8] = "#ffd43b";
COLOR[9] = "#087f5b"; LIGHT[9] = "#63e6be";
Object.assign(EMBLEM, {
  // 7 events and stories: a flag (when started) and a speech bubble
  7: `<path d="M16 50V12" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M16 12l24 8-24 8z" fill="#fff"/><rect x="30" y="32" width="26" height="16" rx="7" fill="#fff"/><path d="M36 46l-4 8 10-8z" fill="#fff"/>`,
  // 8 functions and recursion: nested squares (a picture inside itself)
  8: `<rect x="8" y="8" width="44" height="44" rx="6" fill="none" stroke="#fff" stroke-width="4.500"/><rect x="18" y="18" width="24" height="24" rx="4" fill="none" stroke="#fff" stroke-width="4"/><rect x="25" y="25" width="10" height="10" rx="2" fill="#fff"/>`,
  // 9 lists: a row of boxes with numbers
  9: `<g fill="none" stroke="#fff" stroke-width="3.500"><rect x="4" y="22" width="16" height="16" rx="3"/><rect x="22" y="22" width="16" height="16" rx="3"/><rect x="40" y="22" width="16" height="16" rx="3"/></g><text x="12" y="35" font-size="12" ${FONT} fill="#fff">3</text><text x="30" y="35" font-size="12" ${FONT} fill="#fff">7</text><text x="48" y="35" font-size="12" ${FONT} fill="#fff">1</text>`,
  // 10 algorithms: bars being sorted
  10: `<g fill="#fff"><rect x="8" y="30" width="9" height="22" rx="2"/><rect x="21" y="18" width="9" height="34" rx="2"/><rect x="34" y="38" width="9" height="14" rx="2"/><rect x="47" y="10" width="9" height="42" rx="2"/></g>`,
});

const eyes = (c: number, y = -3, dx = 7) =>
  c === 2 ? `<path d="M${-dx - 3} ${y + 1}q3-5 6 0M${dx - 3} ${y + 1}q3-5 6 0" fill="none" stroke="#2d2230" stroke-width="2.200" stroke-linecap="round"/>`
  : c === 3 ? `<path d="M${-dx - 3} ${y}h6M${dx - 3} ${y}h6" stroke="#2d2230" stroke-width="2.200" stroke-linecap="round"/>`
  : `<circle cx="${-dx}" cy="${y}" r="2.800" fill="#2d2230"/><circle cx="${dx}" cy="${y}" r="2.800" fill="#2d2230"/><circle cx="${-dx + 1}" cy="${y - 1}" r=".9" fill="#fff"/><circle cx="${dx + 1}" cy="${y - 1}" r=".9" fill="#fff"/>`;
const mouth = (c: number, y = 7) => (c === 2 ? `<path d="M-5 ${y}q5 8 10 0z" fill="#c92a2a"/>` : c === 3 ? `<path d="M-3 ${y + 2}h6" stroke="#2d2230" stroke-width="2" stroke-linecap="round"/>` : `<path d="M-5 ${y}q2.500 4 5 0q2.500 4 5 0" fill="none" stroke="#2d2230" stroke-width="1.800" stroke-linecap="round"/>`);

/** the inside of a 48 x 48 picture (viewBox -24 -24 48 48) of a sprite; `c` = the costume 1-3 */
export function spriteSvg(art: string, c = 1): string {
  switch (art) {
    case "cat": return `<ellipse cx="0" cy="20" rx="14" ry="3.500" fill="#000" opacity=".15"/><path d="M-17-6L-15-22-4-13zM17-6L15-22 4-13z" fill="#f08c00" stroke="#d9480f" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="0" cy="3" r="19" fill="#ffa94d" stroke="#d9480f" stroke-width="2.200"/><path d="M-6-14l1 5M0-16v6M6-14l-1 5" stroke="#d9480f" stroke-width="2" stroke-linecap="round"/>
      ${eyes(c, -1)}<path d="M-2 4h4l-2 3z" fill="#ff8787"/>${mouth(c, 8)}<path d="M-19 5l-9-2M-19 9l-9 2M19 5l9-2M19 9l9 2" stroke="#d9480f" stroke-width="1.500" stroke-linecap="round"/>`;
    case "dog": return `<ellipse cx="0" cy="20" rx="14" ry="3.500" fill="#000" opacity=".15"/><path d="M-16-12q-9 4-6 18 7 1 9-6zM16-12q9 4 6 18-7 1-9-6z" fill="#8d5a2b" stroke="#5c3a1a" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="0" cy="3" r="18" fill="#d9a066" stroke="#5c3a1a" stroke-width="2.200"/><ellipse cx="0" cy="9" rx="9" ry="7" fill="#f3d9b1"/>${eyes(c, -2, 8)}<ellipse cx="0" cy="5" rx="3.500" ry="2.500" fill="#2d2230"/>${c === 2 ? '<path d="M-4 11q4 7 8 0z" fill="#c92a2a"/>' : '<path d="M-4 10q2 3 4 0q2 3 4 0" fill="none" stroke="#2d2230" stroke-width="1.600" stroke-linecap="round"/>'}`;
    case "bird": return `<ellipse cx="0" cy="20" rx="12" ry="3" fill="#000" opacity=".15"/><ellipse cx="0" cy="4" rx="16" ry="14" fill="#ffd43b" stroke="#e67700" stroke-width="2.200"/>
      <path d="M-14 2q${c === 2 ? "-6 -14 4 -14" : "-8 8 2 12"}q8 -2 8 -10z" fill="#fab005" stroke="#e67700" stroke-width="2" stroke-linejoin="round"/><path d="M14 0l11 4-11 4z" fill="#ff922b" stroke="#e8590c" stroke-width="1.800" stroke-linejoin="round"/>
      <circle cx="7" cy="-3" r="2.800" fill="#2d2230"/><circle cx="8" cy="-4" r=".9" fill="#fff"/><path d="M-6 -12q-2-6 2-8M-1 -13q0-6 4-7" stroke="#e67700" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    case "robot": return `<ellipse cx="0" cy="21" rx="14" ry="3.500" fill="#000" opacity=".15"/><path d="M0-14v-6" stroke="#495057" stroke-width="2.500" stroke-linecap="round"/><circle cx="0" cy="-21" r="3.200" fill="#845ef7"/>
      <rect x="-17" y="-14" width="34" height="32" rx="10" fill="#4dabf7" stroke="#1971c2" stroke-width="2.200"/><rect x="-13" y="-10" width="26" height="19" rx="7" fill="#fff"/>${eyes(c, -2, 6)}${mouth(c, 4)}<rect x="-21" y="-2" width="4" height="10" rx="2" fill="#1971c2"/><rect x="17" y="-2" width="4" height="10" rx="2" fill="#1971c2"/>`;
    case "apple": return `<ellipse cx="0" cy="20" rx="10" ry="2.500" fill="#000" opacity=".15"/><circle cx="-6" cy="3" r="13" fill="#fa5252" stroke="#c92a2a" stroke-width="2.200"/><circle cx="6" cy="3" r="13" fill="#fa5252" stroke="#c92a2a" stroke-width="2.200"/><circle cx="-6" cy="3" r="11" fill="#fa5252"/>
      <path d="M0-8q0-8 4-12" stroke="#5c3a1a" stroke-width="2.500" fill="none" stroke-linecap="round"/><path d="M3-14q8-6 13 0q-7 5-13 0z" fill="#51cf66" stroke="#2b8a3e" stroke-width="1.800" stroke-linejoin="round"/><path d="M-12-1q0-5 4-6" stroke="#fff" stroke-width="2.500" fill="none" opacity=".7" stroke-linecap="round"/>`;
    case "basket": return `<ellipse cx="0" cy="20" rx="18" ry="3.500" fill="#000" opacity=".15"/><path d="M-14-6q0-16 14-16t14 16" fill="none" stroke="#8d5a2b" stroke-width="3.500" stroke-linecap="round"/>
      <path d="M-20-6h40l-5 24h-30z" fill="#c68642" stroke="#8d5a2b" stroke-width="2.200" stroke-linejoin="round"/><path d="M-17 2h34M-15 10h30M-8-6l2 24M0-6v24M8-6l-2 24" stroke="#8d5a2b" stroke-width="1.500" opacity=".8"/>`;
    case "hand": return `<circle cx="0" cy="0" r="22" fill="#fffdf5" stroke="#adb5bd" stroke-width="2.500"/><g stroke="#868e96" stroke-width="2" stroke-linecap="round"><path d="M0-22v4M0 22v-4M-22 0h4M22 0h-4"/></g><path d="M0 4V-19" stroke="#e03131" stroke-width="3" stroke-linecap="round"/><circle cx="0" cy="0" r="3.500" fill="#2d2230"/>`;
    case "btn": return `<ellipse cx="0" cy="19" rx="16" ry="3" fill="#000" opacity=".15"/><circle cx="0" cy="0" r="19" fill="#74c0fc" stroke="#1971c2" stroke-width="2.500"/><circle cx="0" cy="-3" r="14" fill="#a5d8ff" opacity=".7"/>`;
    default: return `<circle cx="0" cy="0" r="16" fill="#ced4da" stroke="#868e96" stroke-width="2.200"/>`;
  }
}
/** arts that turn when the sprite turns (the others stay upright: a face upside down is hard to read) */
export const ROTATES = new Set(["hand"]);
export const spriteDataUrl = (art: string, c = 1, text?: string): string => `<svg viewBox="-26 -26 52 52" aria-hidden="true" focusable="false">${spriteSvg(art, c)}${text ? `<text x="0" y="7" font-size="20" ${FONT} fill="#1864ab">${text}</text>` : ""}</svg>`;
