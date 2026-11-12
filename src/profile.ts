/**
 * The grade (年级) of every CHILD (children of one family are in different grades): asked once, the first time a child is opened in a subject that needs it,
 * and changed any time in Settings (manage mode) -> Children. Remembered on this device, used by every subject. It goes up by itself every school year
 * (1 September): what is stored is the grade and the day it was set; the grade of today is calculated. Grades 1-6 = primary school, 7-9 = junior high (初一-初三); it stops at 9.
 */
import * as M from "./model";

export const GRADE_NAMES = ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级", "初一", "初二", "初三"] as const;
export const MAX_GRADE = GRADE_NAMES.length;
export const gradeName = (g: number): string => GRADE_NAMES[Math.min(MAX_GRADE, Math.max(1, g)) - 1];

interface Stored { grade: number; setOn: string }
interface Profile { kids?: Record<string, Stored> }
const KEY = "learn.profile.v1";

const load = (): Profile => {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    const ok = (s: unknown): s is Stored => !!s && typeof (s as Stored).grade === "number" && typeof (s as Stored).setOn === "string";
    return { kids: Object.fromEntries(Object.entries((p.kids ?? {}) as Record<string, unknown>).filter(([, v]) => ok(v))) as Record<string, Stored> };
  } catch { return {}; }
};
const save = (p: Profile) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode: asked again next time */ } };

/** the school year a day belongs to: it starts on 1 September (month index 8) */
export const schoolYear = (d: Date): number => (d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1);
/** the grade of `s` today: one more for every 1 September since it was set, at most 初三 */
export function advance(s: Stored, now: Date = new Date()): number {
  const [y, m, d] = s.setOn.split("-").map(Number);
  const years = schoolYear(now) - schoolYear(new Date(y, (m || 1) - 1, d || 1));
  return Math.min(MAX_GRADE, Math.max(1, s.grade + Math.max(0, years)));
}

/** the grade of a child today (null = not chosen yet: the child's English page asks for it the first time) */
export function gradeOf(kidId: string, now?: Date): number | null {
  const s = load().kids?.[kidId];
  return s ? advance(s, now) : null;
}
export function setKidGrade(kidId: string, g: number) { const p = load(); p.kids = { ...p.kids, [kidId]: { grade: g, setOn: M.todayLocal() } }; save(p); }
