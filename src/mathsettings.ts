/** The math settings of this device: the total time of a game (0 = automatic: the sum of what each question is given) and how the child answers. */
export type AnswerMode = "choice" | "keypad";
export interface MathSettings { minutes: number; mode: AnswerMode; /** the scratch paper beside the question */ pad: boolean }
export const MINUTES = [0, 3, 5, 8, 10, 15] as const;
const KEY = "learn.math.v1";
export function loadMathSettings(): MathSettings {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return { minutes: (MINUTES as readonly number[]).includes(s.minutes) ? s.minutes : 0, mode: s.mode === "keypad" ? "keypad" : "choice", pad: s.pad !== false };
  } catch { return { minutes: 0, mode: "choice", pad: true }; }
}
export function saveMathSettings(s: MathSettings) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } }
