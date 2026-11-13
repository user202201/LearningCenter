/**
 * Chinese numerals for the math questions (rule 52): the times-table rhymes (口诀: "三四十二", "二三得六") and numbers read the Chinese way (三万零五百). These are
 * CONTENT (what a Chinese child reads and says), not interface text, so this file is skipped by `check:i18n` (the single characters can not be translation keys).
 */
// ---------------------------------------------------------------- the times table (口诀): "三四十二", "二三得六"
const D = "一二三四五六七八九";
const cn = (n: number): string => (n < 10 ? D[n - 1] : n < 20 ? `十${n % 10 ? D[(n % 10) - 1] : ""}` : `${D[Math.floor(n / 10) - 1]}十${n % 10 ? D[(n % 10) - 1] : ""}`);
/** the first part of a 口诀 (without the product) and the whole 口诀: smaller factor first; "得" when the product has one digit; 二五一十 */
export const kjHead = (a: number, b: number): string => { const [x, y] = a <= b ? [a, b] : [b, a]; return `${D[x - 1]}${D[y - 1]}${x * y < 10 ? "得" : ""}`; };
export const kj = (a: number, b: number): string => { const p = a * b; return `${kjHead(a, b)}${p < 10 ? D[p - 1] : p === 10 ? "一十" : cn(p)}`; };

/** a number up to 9 digits read the Chinese way (三万零五百, 一亿零五十) */
export function readCN(n: number): string {
  const sec = (v: number, first: boolean): string => {
    let out = "", zero = false;
    ([[1000, "千"], [100, "百"], [10, "十"], [1, ""]] as [number, string][]).forEach(([u, name]) => {
      const d = Math.floor(v / u) % 10;
      if (d === 0) { if (out) zero = true; return; }
      if (zero) { out += "零"; zero = false; }
      out += (first && name === "十" && d === 1 && !out ? "" : D[d - 1]) + name;
    });
    return out;
  };
  const yi = Math.floor(n / 1e8), wan = Math.floor(n / 1e4) % 1e4, rest = n % 1e4;
  let out = "";
  if (yi) out += `${sec(yi, true)}亿`;
  if (wan) out += `${yi && wan < 1000 ? "零" : ""}${sec(wan, !yi)}万`;
  if (rest) out += `${(yi || wan) && rest < 1000 ? "零" : ""}${sec(rest, !yi && !wan)}`;
  return out;
}
