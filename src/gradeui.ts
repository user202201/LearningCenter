/** The window that asks for a grade (big buttons: primary school 1-6, junior high 7-9). `null` = cancelled. */
import { h, modal } from "./ui";
import * as P from "./profile";
import * as M from "./model";

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

/** asks for the grade of a child and remembers it; `null` = cancelled (nothing changes, no message) */
export async function pickKidGrade(k: M.Kid): Promise<number | null> {
  const g = await askGrade(`${k.name}读几年级？`, P.gradeOf(k.id), "只需要选一次，之后每年 9 月会自动升一级。以后想改，在设置的“孩子”里改。");
  if (g === null) return null;
  P.setKidGrade(k.id, g);
  return g;
}
