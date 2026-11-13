/** The window that asks for a grade (big buttons: primary school 1-6, junior high 7-9). `null` = cancelled. */
import { h, modal } from "./ui";
import * as P from "./profile";
import * as M from "./model";
import * as api from "./api";
import * as W from "./words";
import * as MM from "./mathmodel";
import * as SM from "./sciencemodel";
import { toast } from "./ui";

export const askGrade = (title: string, current: number | null, note = "", extra?: HTMLElement): Promise<number | null> =>
  modal<number>((close) => {
    const btn = (g: number) => h("button", { class: "grade-btn" + (g === current ? " on" : ""), "data-grade": String(g), onclick: () => close(g) }, P.gradeName(g));
    return h("div", { class: "dlg grade-dlg", id: "grade-dlg" },
      h("h2", {}, title),
      note ? h("p", { class: "muted small" }, note) : null,
      h("h3", { class: "grade-sec" }, "小学"), h("div", { class: "grade-grid" }, ...[1, 2, 3, 4, 5, 6].map(btn)),
      h("h3", { class: "grade-sec" }, "初中"), h("div", { class: "grade-grid" }, ...[7, 8, 9].map(btn)),
      extra ?? null,
      h("div", { class: "row end" }, h("button", { onclick: () => close(null) }, "取消")));
  });

/**
 * Asks for the grade of a child and remembers it; `null` = cancelled (nothing changes, no message). Whenever a grade is set or changed, the words of this
 * week and next week that already exist (picked for the old grade, or, in an earlier version, for no grade at all) are picked again for the new grade;
 * past weeks stay. A child that has no words yet is not touched.
 */
export async function pickKidGrade(k: M.Kid): Promise<number | null> {
  const old = P.gradeOf(k.id);
  const g = await askGrade(`请选择${k.name}的年级`, old, "仅需选择一次，此后每年 9 月自动升一级。如需修改，请在设置的“孩子”中修改。");
  if (g === null) return null;
  P.setKidGrade(k.id, g);
  const thisWeek = M.sundayOf(M.todayLocal());
  // the words (English) and the topics (math) of this week and next week were made for the old grade
  for (const path of [`english/${k.id}.json`, `french/${k.id}.json`, MM.mathPath(k.id), SM.sciencePath(k.id)]) {
    try {
      const cur = await api.readJson<M.KidData>(path);
      if (!cur?.weeks.some((w) => w.start >= (/^(math|science)\//.test(path) ? M.todayLocal() : thisWeek))) continue;
      const done = toast("正在按新年级重新选…", 0, true);
      try {
        await api.update(path, M.EMPTY_KID, (c: M.KidData) => W.dropFromWeek(c, /^(math|science)\//.test(path) ? M.todayLocal() : thisWeek), `${path} new grade`);
        done();
        toast("已按新年级重新选取本周和下周的内容", 5000);
      } catch (e) {
        done();
        throw e;
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 6000);
    }
  }
  return g;
}
