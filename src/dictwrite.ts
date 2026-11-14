/** 听写 and 写字 (rule 51): what main.ts and english.ts use of them. The code is in dwshell.ts, dictation.ts, spell.ts, writeui.ts (rules: dictlogic.ts, writelogic.ts). */
import { h } from "./ui";
import type * as M from "./model";
import { setWeek, unlockSpeech } from "./dwshell";
export { initDictWrite, clearWeek } from "./dwshell";
export { renderDictation } from "./dictation";
export { renderSpelling } from "./spell";
export { renderWrite } from "./writeui";

/** the two buttons under the characters of a week (识字): dictation and finger writing; same look as the 字帖 button */
export function weekTools(k: M.Kid, week: string, hasItems: boolean): HTMLElement {
  const go = (to: string) => () => { setWeek(week); location.hash = to; };
  return h("div", { class: "dw-tools", id: "dw-tools" },
    hasItems ? h("button", { class: "sheet-btn", id: "dict-btn", onclick: go(`#/dictation/${k.id}`) }, "听写") : null,
    h("button", { class: "sheet-btn", id: "write-btn", onclick: go(`#/write/${k.id}`) }, "写字"));
}
/** the dictation button of the Languages subject's week page */
export const spellButton = (k: M.Kid): HTMLElement => h("button", { class: "sheet-btn", id: "dict-btn", onclick: () => { unlockSpeech(); location.hash = `#/english/${k.id}/dictation`; } }, "听写");
