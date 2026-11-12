/**
 * The grade (年级), asked ONCE and then remembered on this device for every subject: a default for everybody, and optionally a grade of its own for one child
 * (children of one family are often in different grades). The grade goes up by itself every school year (on 1 September): what is stored is the grade
 * and the day it was set; the grade of today is calculated from them. Grades 1-6 = primary school, 7-9 = junior high (初一-初三); it stops at 9.
 */
import * as M from "./model";

export const GRADE_NAMES = ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级", "初一", "初二", "初三"] as const;
export const MAX_GRADE = GRADE_NAMES.length;
export const gradeName = (g: number): string => GRADE_NAMES[Math.min(MAX_GRADE, Math.max(1, g)) - 1];

interface Stored { grade: number; setOn: string }
interface Profile { def?: Stored; kids?: Record<string, Stored> }
const KEY = "learn.profile.v1";

const load = (): Profile => {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    const ok = (s: unknown): s is Stored => !!s && typeof (s as Stored).grade === "number" && typeof (s as Stored).setOn === "string";
    return { def: ok(p.def) ? p.def : undefined, kids: Object.fromEntries(Object.entries((p.kids ?? {}) as Record<string, unknown>).filter(([, v]) => ok(v))) as Record<string, Stored> };
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

/** has the grade been asked yet? */
export const hasGrade = (): boolean => !!load().def;
/** the default grade of today (null = not asked yet) */
export const defaultGrade = (now?: Date): number | null => { const d = load().def; return d ? advance(d, now) : null; };
/** the grade of a child today: its own if one was set, otherwise the default (null = nothing known yet) */
export function gradeOf(kidId: string, now?: Date): number | null {
  const p = load();
  const s = p.kids?.[kidId];
  return s ? advance(s, now) : p.def ? advance(p.def, now) : null;
}
export const hasOwnGrade = (kidId: string): boolean => !!load().kids?.[kidId];
export function setDefaultGrade(g: number) { const p = load(); p.def = { grade: g, setOn: M.todayLocal() }; save(p); }
export function setKidGrade(kidId: string, g: number) { const p = load(); p.kids = { ...p.kids, [kidId]: { grade: g, setOn: M.todayLocal() } }; save(p); }
export function clearKidGrade(kidId: string) { const p = load(); if (p.kids) delete p.kids[kidId]; save(p); }
