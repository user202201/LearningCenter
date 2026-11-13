/**
 * 编程 world 16 (过程控制与物联网): the screen of a device level: a cartoon scene drawn from the frames of the simulation, the scenarios, the block editor
 * (the phase-1 editor with the sensors / actuators as variables and comparisons as conditions) and the judge (coding-devices.ts, pure). A run animates the chosen
 * scenario; "全部检查" judges every scenario. Same contract as the other labs (`Mount`).
 */
import { h, modal } from "./ui";
import { parse, toText, nextHint, cloneProgram, countBlocks, emptyProgram, Program } from "./coding-ast";
import { createEditor, programEl, Editor } from "./coding-editor";
import { starsFor } from "./coding-levels";
import { DevLevel, Frame, Scenario, judgeAll, runScenario, deviceById, parLevel } from "./coding-devices";
import { Mount, btn, clickEl } from "./coding-infolabs";
import { L } from "./coding-infocontent";

const C = { on: "#ffd43b", off: "#dee2e6", ink: "#343a40", red: "#fa5252", green: "#40c057", yellow: "#fcc419", blue: "#4dabf7" };
const cls = (v: number) => Math.max(0, Math.min(1, v));
/** the scene of a level at one frame, as SVG (300 x 170) */
export function sceneSvg(lv: DevLevel, sc: Scenario, f: Frame | null, frames: Frame[], i: number): string {
  const s = f?.s ?? {}, a = f?.a ?? {}, e = f?.e ?? {};
  const frame = (body: string) => `<svg viewBox="0 0 300 170" class="ci-scenesvg" role="img" aria-label="scene">${body}</svg>`;
  switch (lv.scene) {
    case "lamp": {
      const light = s.light ?? 80, on = a.lamp === 1, sky = `hsl(215 ${40 + (1 - light / 100) * 20}% ${14 + (light / 100) * 70}%)`;
      return frame(`<rect width="300" height="170" fill="${sky}"/><rect y="140" width="300" height="30" fill="#495057"/><rect x="146" y="50" width="8" height="92" rx="3" fill="#868e96"/><path d="M150 50q0-26 34-26" fill="none" stroke="#868e96" stroke-width="8" stroke-linecap="round"/><circle cx="184" cy="34" r="${on ? 26 : 0}" fill="${C.on}" opacity=".35"/><circle cx="184" cy="34" r="12" fill="${on ? C.on : "#adb5bd"}" stroke="#495057" stroke-width="3"/><circle cx="${40 + (1 - light / 100) * 0}" cy="30" r="${10 + light / 8}" fill="${light > 40 ? "#fff3bf" : "#e9ecef"}" opacity="${cls(light / 60)}"/>`);
    }
    case "traffic": {
      const lamp = (cy: number, on: number, col: string) => `<circle cx="150" cy="${cy}" r="20" fill="${on ? col : "#495057"}" stroke="#212529" stroke-width="3"/>${on ? `<circle cx="150" cy="${cy}" r="30" fill="${col}" opacity=".25"/>` : ""}`;
      return frame(`<rect width="300" height="170" fill="#e7f5ff"/><rect y="150" width="300" height="20" fill="#868e96"/><rect x="146" y="120" width="8" height="32" fill="#495057"/><rect x="120" y="12" width="60" height="112" rx="14" fill="#212529"/>${lamp(38, a.red, C.red)}${lamp(72, a.yellow, C.yellow)}${lamp(106, a.green, C.green)}`);
    }
    case "door": {
      const open = a.door === 1, d = s.dist ?? 200;
      return frame(`<rect width="300" height="170" fill="#f1f3f5"/><rect y="140" width="300" height="30" fill="#ced4da"/><rect x="110" y="30" width="80" height="110" fill="#212529"/><rect x="${open ? 70 : 110}" y="30" width="40" height="110" fill="#74c0fc" stroke="#1971c2" stroke-width="3"/><rect x="${open ? 190 : 150}" y="30" width="40" height="110" fill="#74c0fc" stroke="#1971c2" stroke-width="3"/><circle cx="${150 + Math.min(130, d / 1.6)}" cy="118" r="11" fill="#ff922b"/><rect x="${150 + Math.min(130, d / 1.6) - 9}" y="128" width="18" height="22" rx="6" fill="#ff922b"/>`);
    }
    case "thermo": {
      const t = e.temp ?? s.temp ?? 15, h2 = cls(t / 40) * 110;
      return frame(`<rect width="300" height="170" fill="#fff4e6"/><rect x="60" y="20" width="26" height="116" rx="13" fill="#fff" stroke="#495057" stroke-width="3"/><circle cx="73" cy="142" r="17" fill="${C.red}" stroke="#495057" stroke-width="3"/><rect x="66" y="${136 - h2}" width="14" height="${h2 + 6}" fill="${C.red}"/><path d="M92 ${136 - (20 / 40) * 110}h14" stroke="#2f9e44" stroke-width="3"/><text x="115" y="${140 - (20 / 40) * 110}" font-size="14" fill="#2f9e44" font-weight="800">20</text><text x="150" y="60" font-size="28" fill="${C.ink}" font-weight="900">${Math.round(t)}°C</text><path d="M210 140q-22-22 0-44q10 16 22 4q16 22-4 40z" fill="${a.heater === 1 ? "#ff6b6b" : "#ced4da"}" stroke="#495057" stroke-width="3"/>`);
    }
    case "plant": {
      const soil = e.soil ?? s.soil ?? 50, tank = e.tank ?? s.tank ?? 50;
      return frame(`<rect width="300" height="170" fill="#e6fcf5"/><rect x="170" y="110" width="110" height="46" fill="#8d6e63"/><rect x="170" y="${156 - cls(soil / 100) * 46}" width="110" height="${cls(soil / 100) * 46}" fill="#5d4037"/><path d="M225 110v-34M225 92q-24-8-26-30q24 4 26 30M225 84q22-6 26-26q-22 2-26 26" fill="#2f9e44" stroke="#2b8a3e" stroke-width="3"/><rect x="30" y="40" width="50" height="104" rx="8" fill="#fff" stroke="#1971c2" stroke-width="3"/><rect x="33" y="${141 - cls(tank / 100) * 98}" width="44" height="${cls(tank / 100) * 98}" fill="${C.blue}"/><path d="M80 130h60v-60" fill="none" stroke="${a.pump === 1 ? C.blue : "#adb5bd"}" stroke-width="6"/>${a.pump === 1 ? `<circle cx="200" cy="70" r="5" fill="${C.blue}"/><circle cx="215" cy="84" r="4" fill="${C.blue}"/>` : ""}<text x="55" y="30" font-size="12" text-anchor="middle" font-weight="800" fill="#1971c2">${Math.round(tank)}</text><text x="225" y="166" font-size="11" text-anchor="middle" font-weight="800" fill="#fff">${Math.round(soil)}</text>`);
    }
    case "alarm": {
      const ico = (x: number, on: number, t: string) => `<circle cx="${x}" cy="60" r="28" fill="${on ? C.red : "#e9ecef"}" stroke="#495057" stroke-width="3"/><text x="${x}" y="68" font-size="22" text-anchor="middle" font-weight="900" fill="${on ? "#fff" : "#868e96"}">${t}</text>`;
      return frame(`<rect width="300" height="170" fill="#fff5f5"/>${ico(55, s.smoke, "S")}${ico(125, s.motion, "M")}${ico(195, s.door, "D")}<path d="M60 112h180" stroke="#adb5bd" stroke-width="3"/><circle cx="150" cy="140" r="20" fill="${a.alarm === 1 ? C.red : "#ced4da"}" stroke="#495057" stroke-width="3"/>${a.alarm === 1 ? `<circle cx="150" cy="140" r="30" fill="${C.red}" opacity=".3"/>` : ""}`);
    }
    case "belt": {
      const n = frames.slice(0, i + 1).filter((x, k) => x.s.box === 1 && (frames[k - 1]?.s.box ?? 0) === 0).length;
      return frame(`<rect width="300" height="170" fill="#f8f9fa"/><rect x="10" y="110" width="280" height="22" rx="11" fill="#495057"/>${[0, 1, 2, 3, 4, 5, 6].map((k) => `<circle cx="${30 + k * 40 + ((i * 6) % 40)}" cy="121" r="6" fill="#adb5bd"/>`).join("")}${s.box === 1 ? `<rect x="125" y="72" width="50" height="38" rx="5" fill="#e8a45c" stroke="#a4611b" stroke-width="3"/>` : ""}<circle cx="150" cy="40" r="10" fill="${s.box === 1 ? C.red : "#ced4da"}"/><path d="M150 50v14" stroke="#adb5bd" stroke-dasharray="3 3"/><text x="40" y="60" font-size="22" font-weight="900" fill="${C.ink}">${n % 5}/5</text><rect x="220" y="30" width="60" height="30" rx="8" fill="${a.pack === 1 ? C.green : "#e9ecef"}"/>`);
    }
    case "timer": return frame(`<rect width="300" height="170" fill="#e7f5ff"/><rect x="60" y="30" width="180" height="90" rx="14" fill="#212529"/><text x="150" y="98" font-size="58" text-anchor="middle" font-weight="900" fill="#69db7c" font-family="monospace">${a.display ?? 0}</text><circle cx="150" cy="144" r="14" fill="${a.beep === 1 ? C.red : "#ced4da"}"/><circle cx="250" cy="144" r="14" fill="${s.btn === 1 ? C.blue : "#ced4da"}"/>`);
    case "keypad": return frame(`<rect width="300" height="170" fill="#f1f3f5"/>${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => `<rect x="${30 + ((k - 1) % 3) * 56}" y="${16 + Math.floor((k - 1) / 3) * 46}" width="48" height="38" rx="8" fill="${s.key === k ? C.blue : "#fff"}" stroke="#495057" stroke-width="3"/><text x="${54 + ((k - 1) % 3) * 56}" y="${42 + Math.floor((k - 1) / 3) * 46}" font-size="20" text-anchor="middle" font-weight="900" fill="${C.ink}">${k}</text>`).join("")}<rect x="215" y="20" width="62" height="70" rx="8" fill="${a.open === 1 ? C.green : "#adb5bd"}"/><circle cx="246" cy="125" r="16" fill="${a.alarm === 1 ? C.red : "#ced4da"}"/>`);
    case "lift": {
      const fl = e.floor ?? s.floor ?? 1, tg = s.target ?? 0;
      return frame(`<rect width="300" height="170" fill="#f8f9fa"/><rect x="100" y="8" width="100" height="154" fill="#fff" stroke="#495057" stroke-width="3"/>${[1, 2, 3, 4, 5].map((k) => `<path d="M100 ${162 - k * 30.8}h100" stroke="#ced4da"/><text x="84" y="${156 - (k - 1) * 30.8}" font-size="14" text-anchor="end" font-weight="800" fill="${tg === k ? C.red : C.ink}">${k}</text>`).join("")}<rect x="112" y="${130 - (fl - 1) * 30.8}" width="76" height="26" rx="5" fill="#74c0fc" stroke="#1971c2" stroke-width="3"/>${tg ? `<circle cx="222" cy="${143 - (tg - 1) * 30.8}" r="8" fill="${C.red}"/>` : ""}`);
    }
    case "line": {
      const win = 40, from = Math.max(0, i - win + 1), seg = frames.slice(from, i + 1);
      const X = (v: number) => 150 + v * 5, Y = (k: number) => 14 + ((k - from) / win) * 140;
      const lp = seg.map((x, k) => `${X(x.e.c)},${Y(from + k)}`).join(" "), cp = seg.map((x, k) => `${X(x.e.p)},${Y(from + k)}`).join(" ");
      const cur = frames[i];
      return frame(`<rect width="300" height="170" fill="#f1f3f5"/><polyline points="${lp}" fill="none" stroke="#212529" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/><polyline points="${cp}" fill="none" stroke="#fd7e14" stroke-width="2" stroke-dasharray="3 3"/>${cur ? `<rect x="${X(cur.e.p) - 12}" y="${Y(i) - 8}" width="24" height="16" rx="4" fill="#fd7e14" stroke="#c92a2a" stroke-width="2"/><circle cx="${X(cur.e.p) - 10}" cy="${Y(i) + 12}" r="${cur.s.left ? 4 : 2}" fill="${cur.s.left ? C.green : "#868e96"}"/><circle cx="${X(cur.e.p) + 10}" cy="${Y(i) + 12}" r="${cur.s.right ? 4 : 2}" fill="${cur.s.right ? C.green : "#868e96"}"/>` : ""}`);
    }
    case "rover": {
      const lane = e.lane ?? 0, x = e.x ?? 0;
      const ob = (sc.o as [number, number][]) ?? [];
      return frame(`<rect width="300" height="170" fill="#e9ecef"/><rect y="30" width="300" height="48" fill="#868e96"/><rect y="86" width="300" height="48" fill="#868e96"/><path d="M0 82h300" stroke="#fff" stroke-dasharray="10 8" stroke-width="3"/>${ob.map((o) => `<rect x="${6 + (o[0] / 100) * 250}" y="${o[1] ? 98 : 42}" width="22" height="24" rx="4" fill="#e8590c" stroke="#9c3a00" stroke-width="3"/>`).join("")}<rect x="${6 + (x / 100) * 250}" y="${lane ? 98 : 42}" width="30" height="24" rx="6" fill="${e.hit ? C.red : "#228be6"}" stroke="#1864ab" stroke-width="3"/><text x="150" y="156" font-size="14" text-anchor="middle" font-weight="800" fill="${C.ink}">${Math.round(x)} / 100   ${s.dist ?? ""}</text>`);
    }
    case "arm": {
      const ang = ((e.base ?? 0) * Math.PI) / 180, px = 60, py = 140, len = 100;
      const tx = px + Math.cos(-ang) * len, ty = py + Math.sin(-ang) * len;
      const o = ((e.obj ?? 0) * Math.PI) / 180, ox = px + Math.cos(-o) * len, oy = py + Math.sin(-o) * len;
      return frame(`<rect width="300" height="170" fill="#fff9db"/><path d="M${px + len - 12} ${py - 14}a${len} ${len} 0 0 0 ${-(len - 12) * 0}" fill="none"/><circle cx="${px + len}" cy="${py}" r="10" fill="#b2f2bb" stroke="#2f9e44" stroke-width="3"/><circle cx="${px}" cy="${py}" r="10" fill="#495057"/><path d="M${px} ${py}L${tx} ${ty}" stroke="#e8590c" stroke-width="10" stroke-linecap="round"/><circle cx="${tx}" cy="${ty}" r="${a.claw === 1 ? 6 : 11}" fill="none" stroke="#c92a2a" stroke-width="4"/>${e.done ? "" : `<rect x="${ox - 8}" y="${oy - 8}" width="16" height="16" rx="3" fill="#339af0" stroke="#1864ab" stroke-width="3"/>`}${e.done ? `<rect x="${px + len - 8}" y="${py - 8}" width="16" height="16" rx="3" fill="#339af0"/>` : ""}`);
    }
    case "home": {
      const pr = (sc.p as number[]) ?? [];
      return frame(`<rect width="300" height="170" fill="#e3fafc"/><path d="M40 90L150 20l110 70z" fill="#ff8787" stroke="#c92a2a" stroke-width="4"/><rect x="60" y="90" width="180" height="62" fill="#fff4e6" stroke="#e8590c" stroke-width="4"/><rect x="100" y="104" width="50" height="40" rx="8" fill="${a.washer === 1 ? C.blue : "#ced4da"}" stroke="#495057" stroke-width="3"/><circle cx="125" cy="124" r="12" fill="#fff"/><text x="200" y="130" font-size="20" font-weight="900" fill="${s.price === 0 ? "#2f9e44" : "#e03131"}">${s.price === 0 ? "$" : "$$$"}</text>${pr.map((v, k) => `<rect x="${30 + k * 10}" y="158" width="9" height="8" fill="${v === 0 ? "#69db7c" : "#ffa8a8"}" ${k === s.hour ? 'stroke="#212529" stroke-width="2"' : ""}/>`).join("")}<text x="150" y="152" font-size="12" text-anchor="middle" font-weight="800" fill="${C.ink}">${String(s.hour ?? 0).padStart(2, "0")}:00</text>`);
    }
  }
  return frame("");
}

export const device: Mount = (root, io) => {
  const lv = deviceById(io.act.id)!, txt = io.c.dev[io.act.id], par = parLevel(lv), ref = parse(lv.ref);
  let si = 0, frames: Frame[] = [], fi = 0, timer = 0, failures = 0, usedAnswer = false;
  const scene = h("div", { class: "ci-scene user", id: "ci-scene" }), gauges = h("div", { class: "ci-gauges user", id: "ci-gauges" }), res = h("div", { class: "ci-results user", id: "ci-results" });
  const chips = h("div", { class: "ci-choices ci-scs" }, ...lv.scenarios.map((sc, i) => h("button", { class: "ci-btn ci-choice user", type: "button", "data-s": String(i), onclick: () => { si = i; frames = []; fi = 0; clearInterval(timer); chips.querySelectorAll("button").forEach((b, k) => b.classList.toggle("on", k === i)); draw(); } }, txt?.scenarios?.[i] ?? String(i + 1))));
  let editor!: Editor;
  const textBox = h("textarea", { class: "ci-text user", id: "dv-text", rows: "8", spellcheck: false, hidden: true, "aria-label": "code" }) as HTMLTextAreaElement;
  const msg = h("p", { class: "ci-live user", id: "dv-count" });
  editor = createEditor({ palette: lv.palette, vars: lv.vars, conds: lv.conds, max: lv.max, onChange: () => { msg.textContent = `${editor.count()} / ${lv.max}`; editor.hint(null); } });
  const draw = () => {
    const f = frames[fi] ?? null;
    scene.innerHTML = sceneSvg(lv, lv.scenarios[si], f, frames, fi);
    const s = f?.s ?? {}, a = f?.a ?? {};
    gauges.replaceChildren(...[...lv.sensors.map((k) => [k, s[k], "s"] as const), ...lv.acts.map((k) => [k, a[k], "a"] as const)].map(([k, v, t]) => h("span", { class: "ci-gauge " + t }, h("b", {}, k), String(v ?? "–"))), h("span", { class: "ci-gauge" }, h("b", {}, "t"), frames.length ? String(fi) : "–"));
  };
  const runOne = (instant: boolean) => {
    clearInterval(timer);
    const prog = editor.program();
    if (!countBlocks(prog)) return io.say("请先搭一些积木。", "bad");
    const r = runScenario(lv, prog, si);
    if (r.status !== "ok") { io.say("程序停不下来或出错了。", "bad"); frames = r.frames; fi = Math.max(0, frames.length - 1); return draw(); }
    frames = r.frames; fi = 0; draw();
    io.say("", "");
    if (instant) { fi = frames.length - 1; return draw(); }
    timer = window.setInterval(() => { if (fi >= frames.length - 1) return clearInterval(timer); fi++; draw(); }, 90);
  };
  const checkAll = () => {
    clearInterval(timer);
    const prog = editor.program();
    if (!countBlocks(prog)) return io.say("请先搭一些积木。", "bad");
    const v = judgeAll(lv, prog);
    res.replaceChildren(...v.results.map((r, i) => h("div", { class: "ci-res " + (r.ok ? "ok" : "bad"), "data-s": String(i) }, h("b", {}, r.ok ? "✓" : "✗"), h("span", {}, txt?.scenarios?.[i] ?? String(i + 1)), !r.ok ? h("small", {}, r.fail!.msg >= 0 ? `${txt?.msgs[r.fail!.msg] ?? ""} (t=${r.fail!.tick})` : "程序停不下来或出错了。") : null)));
    if (v.ok) { io.say("所有场景都通过了。", "ok"); const blocks = countBlocks(prog); return io.win(usedAnswer ? 1 : starsFor(blocks, par)); }
    io.bad(); failures++; answerBtn.hidden = failures < 3;
    io.say(`有 ${v.results.filter((r) => !r.ok).length} 个场景没有通过。`, "bad");
    si = v.first; chips.querySelectorAll("button").forEach((b, k) => b.classList.toggle("on", k === si));
    runOne(true);
  };
  const toggleText = () => { textBox.hidden = !textBox.hidden; applyBtn.hidden = textBox.hidden; if (!textBox.hidden) textBox.value = toText(editor.program()); };
  const applyBtn = btn("dv-apply", "应用代码", () => { try { editor.setProgram(cloneProgram(parse(textBox.value), true)); io.say("", ""); } catch (e) { io.say(`代码有误：${e instanceof Error ? e.message : ""}`, "bad"); } });
  applyBtn.hidden = true;
  const answerBtn = btn("ci-answer", "看答案", async () => {
    const ok = await modal<boolean>((close) => h("div", { class: "dlg cl-answer" }, h("h2", {}, "参考答案"), h("div", { class: "cl-answer-body" }, programEl(ref, { vars: lv.vars, conds: lv.conds })), h("p", { class: "muted small" }, "使用参考答案后，这一关最多得 1 颗星。"), h("div", { class: "row end" }, h("button", { onclick: () => close(false) }, "关闭"), h("button", { class: "primary", id: "ci-answer-use", onclick: () => close(true) }, "使用这个答案"))));
    if (ok) { usedAnswer = true; io.cheat(); editor.setProgram(cloneProgram(ref, true)); }
  });
  answerBtn.hidden = true;
  chips.firstElementChild?.classList.add("on");
  io.prompt(L(txt?.goal));
  root.append(h("section", { class: "ci-dev" }, h("div", { class: "ci-devleft" }, scene, gauges, chips, h("div", { class: "ci-row" }, btn("dv-run", "运行", () => runOne(false)), btn("dv-check", "全部检查", checkAll, "primary"), btn("dv-text-btn", "文本", toggleText), answerBtn), textBox, applyBtn, res), h("div", { class: "ci-devright" }, msg, editor.el)));
  msg.textContent = `0 / ${lv.max}`;
  draw();
  const setP = (p: Program) => editor.setProgram(cloneProgram(p, true));
  (window as unknown as { __infoDev: unknown }).__infoDev = { lv, editor, run: (src: string, i = 0) => { editor.setProgram(cloneProgram(parse(src), true)); si = i; runOne(true); return frames; }, get frames() { return frames; } };
  return {
    solve: () => { setP(ref); clickEl(root.querySelector("#dv-check")); },
    wrong: () => { setP(parse(lv.naive)); clickEl(root.querySelector("#dv-check")); },
    extraHint: () => { const hh = nextHint(editor.program(), ref); editor.hint(hh); return hh.done ? "积木的顺序已经正确。请检查数字和条件。" : hh.wrongId ? "高亮的积木需要修改。" : hh.extraId ? "多了一块积木。" : "请使用高亮的积木。"; },
  };
};
void emptyProgram;
