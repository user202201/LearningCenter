/** The window that asks for a grade (big buttons: primary school 1-6, junior high 7-9). `null` = cancelled. */
import { h, modal } from "./ui";
import * as P from "./profile";

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
