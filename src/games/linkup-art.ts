/** Link-up pictures: 30 round cartoon faces, drawn in code (inline SVG, 64 x 64, no text). 18 animals come from the memory game, 12 more are drawn here. */
import { ANIMAL_ART } from "./memory-art";

const eye = (x: number, y: number, r = 2.8) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#2d2230"/><circle cx="${x + 0.9}" cy="${y - 0.9}" r="${r * 0.35}" fill="#fff"/>`;
const eyes = (y = 36, dx = 8) => eye(32 - dx, y) + eye(32 + dx, y);
const smile = (y = 44) => `<path d="M27 ${y}q5 5 10 0" fill="none" stroke="#2d2230" stroke-width="2" stroke-linecap="round"/>`;
const cheeks = (y = 43, dx = 13) => `<circle cx="${32 - dx}" cy="${y}" r="3.2" fill="#ff9aa8" opacity=".6"/><circle cx="${32 + dx}" cy="${y}" r="3.2" fill="#ff9aa8" opacity=".6"/>`;
const face = (y = 36) => eyes(y) + smile(y + 8) + cheeks(y + 7);

const EXTRA: { name: string; art: string }[] = [
  { name: "apple", art: `<path d="M32 18c-8-6-20-2-20 14 0 12 8 22 14 22 3 0 4-1 6-1s3 1 6 1c6 0 14-10 14-22 0-16-12-20-20-14z" fill="#ff6b6b"/><path d="M32 18c0-5 2-9 6-11" stroke="#8a5a34" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M36 12c5-4 10-2 11 2-5 3-9 2-11-2z" fill="#51cf66"/><ellipse cx="20" cy="28" rx="3" ry="5" fill="#fff" opacity=".35" transform="rotate(20 20 28)"/>${face(36)}` },
  { name: "strawberry", art: `<path d="M10 24c0-8 10-10 22-6 12-4 22-2 22 6 0 16-12 32-22 34C22 56 10 40 10 24z" fill="#ff5c7a"/><path d="M20 16l12 5 12-5-3 9-9-3-9 3z" fill="#51cf66"/><g fill="#ffe066"><ellipse cx="18" cy="30" rx="1.3" ry="2"/><ellipse cx="46" cy="30" rx="1.3" ry="2"/><ellipse cx="22" cy="46" rx="1.3" ry="2"/><ellipse cx="42" cy="46" rx="1.3" ry="2"/><ellipse cx="32" cy="52" rx="1.3" ry="2"/></g>${eyes(34, 8)}${smile(42)}${cheeks(41, 13)}` },
  { name: "sun", art: `<g stroke="#ffa94d" stroke-width="4" stroke-linecap="round"><path d="M32 4v8M32 52v8M4 32h8M52 32h8M12 12l6 6M46 46l6 6M52 12l-6 6M18 46l-6 6"/></g><circle cx="32" cy="32" r="18" fill="#ffd43b"/>${face(31)}` },
  { name: "cloud", art: `<path d="M16 46c-8 0-11-12-3-16 0-9 11-13 17-7 5-6 17-3 17 7 8 2 8 16-2 16z" fill="#e7f5ff" stroke="#a5d8ff" stroke-width="2.5" stroke-linejoin="round"/>${eyes(34, 8)}${smile(40)}${cheeks(40, 14)}` },
  { name: "star", art: `<path d="M32 5l7.500 16 17.500 2-13 12 3.500 17.500L32 44.500 16.500 52.500 20 35 7 23l17.500-2z" fill="#ffd43b" stroke="#fab005" stroke-width="2.500" stroke-linejoin="round"/>${eyes(30, 6)}${smile(36)}` },
  { name: "flower", art: `<g fill="#ff8fb1"><circle cx="32" cy="13" r="10"/><circle cx="51" cy="27" r="10"/><circle cx="44" cy="50" r="10"/><circle cx="20" cy="50" r="10"/><circle cx="13" cy="27" r="10"/></g><circle cx="32" cy="34" r="15" fill="#ffe066"/>${face(33)}` },
  { name: "fish", art: `<path d="M50 32l11-11v22z" fill="#ff922b"/><ellipse cx="29" cy="32" rx="25" ry="19" fill="#ffa94d"/><path d="M26 15q8-8 16 0z" fill="#ff922b"/><circle cx="19" cy="28" r="4.500" fill="#fff"/><circle cx="18" cy="28" r="2.600" fill="#2d2230"/><path d="M13 38q5 5 10 0" fill="none" stroke="#2d2230" stroke-width="2" stroke-linecap="round"/><circle cx="32" cy="38" r="3" fill="#ff9aa8" opacity=".6"/><path d="M36 22q4 10 0 20M42 24q3 8 0 16" fill="none" stroke="#ff922b" stroke-width="2" stroke-linecap="round"/>` },
  { name: "cupcake", art: `<path d="M12 34h40l-5 24H17z" fill="#ffc078"/><path d="M20 34l3 24M32 34v24M44 34l-3 24" stroke="#f08c00" stroke-width="1.500" opacity=".6"/><path d="M10 36c-4-10 4-14 8-14 0-9 8-13 14-13 7 0 14 4 14 13 5 0 12 4 8 14z" fill="#ffb3c8"/><circle cx="32" cy="9" r="5" fill="#fa5252"/>${eyes(35, 9)}${smile(40)}${cheeks(40, 16)}` },
  { name: "mushroom", art: `<path d="M22 36h20v14q0 8-10 8t-10-8z" fill="#fff3d9"/><path d="M5 36C5 16 18 6 32 6s27 10 27 30z" fill="#fa5252"/><g fill="#fff"><circle cx="20" cy="22" r="5"/><circle cx="40" cy="16" r="4"/><circle cx="48" cy="29" r="3.500"/><circle cx="31" cy="30" r="3"/></g>${eyes(46, 5)}${smile(51)}` },
  { name: "ladybug", art: `<path d="M24 12l-5-7M40 12l5-7" stroke="#2d2230" stroke-width="2.500" stroke-linecap="round"/><circle cx="32" cy="36" r="24" fill="#fa5252"/><path d="M32 12v48" stroke="#2d2230" stroke-width="2.500"/><path d="M12 24q20-14 40 0 0-8-8-12-12-6-24 0-8 4-8 12z" fill="#2d2230"/><g fill="#2d2230"><circle cx="19" cy="40" r="4"/><circle cx="45" cy="40" r="4"/><circle cx="24" cy="52" r="3"/><circle cx="40" cy="52" r="3"/></g><circle cx="26" cy="21" r="3.500" fill="#fff"/><circle cx="38" cy="21" r="3.500" fill="#fff"/><circle cx="26" cy="22" r="1.800" fill="#2d2230"/><circle cx="38" cy="22" r="1.800" fill="#2d2230"/>` },
  { name: "balloon", art: `<path d="M32 50q-4 6 0 12" stroke="#868e96" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M28 50l4-3 4 3z" fill="#4dabf7"/><ellipse cx="32" cy="27" rx="21" ry="24" fill="#74c0fc"/><ellipse cx="22" cy="17" rx="4" ry="7" fill="#fff" opacity=".5" transform="rotate(25 22 17)"/>${face(27)}` },
  { name: "moon", art: `<circle cx="32" cy="32" r="26" fill="#ffe066"/><circle cx="46" cy="20" r="4" fill="#fcc419" opacity=".6"/><circle cx="48" cy="44" r="3" fill="#fcc419" opacity=".6"/><circle cx="14" cy="42" r="3.500" fill="#fcc419" opacity=".6"/><path d="M19 32q4-4 8 0M37 32q4-4 8 0" fill="none" stroke="#2d2230" stroke-width="2.500" stroke-linecap="round"/>${smile(41)}${cheeks(40, 15)}` },
  { name: "carrot", art: `<path d="M26 14c-2-6 0-10 4-11 0 5 1 7 3 9 3-4 7-6 10-5-1 5-4 8-9 9z" fill="#51cf66"/><path d="M14 20c8-8 28-6 32 10L36 62C24 58 10 40 14 20z" fill="#ff922b" transform="rotate(-8 30 38)"/><path d="M20 30l6 1M24 44l6 1M34 54l5-1" stroke="#e8590c" stroke-width="2" stroke-linecap="round" opacity=".6"/>${eyes(31, 6)}${smile(37)}` },
];

/** every picture: 18 animals + 12 drawn here (30 in all) */
export const PICTURES: { name: string; art: string }[] = [...ANIMAL_ART, ...EXTRA];

/** the <symbol> sprite of all pictures (ids lk-0 .. lk-29), put once in the page */
export function spriteSvg(): string {
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${PICTURES.map((p, i) => `<symbol id="lk-${i}" viewBox="0 0 64 64">${p.art}</symbol>`).join("")}</defs></svg>`;
}
