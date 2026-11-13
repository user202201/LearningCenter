/**
 * The games subject (`#/subject/games`): no child and no account. The home is a grid of cartoon cards (one per game of `src/games/index.ts`); a game opens inside a
 * stage (`#/games/<id>`) with a sound switch and a full-screen button. Games are modules (see `src/games/ctx.ts`); what they remember (best scores, levels) stays on
 * this device in `learn.games.v1`.
 */
import { h, toast, oneLine } from "./ui";
import { subjectArt } from "./hub";
import { GAMES } from "./games/index";
import type { GameCtx, GameModule, SfxKind } from "./games/ctx";
import { sfx, setMuted, isMuted } from "./games/sfx";
import { unlock } from "./musicaudio";
import type { Ctx } from "./english";

let X!: Ctx;
export const initGames = (c: Ctx) => { X = c; };
const COLOR = "#12b886";

const KEY = "learn.games.v1";
const readAll = (): Record<string, Record<string, unknown>> => { try { const v = JSON.parse(localStorage.getItem(KEY) ?? "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; } };
const storeFor = (id: string): GameCtx["store"] => ({
  get<T>(key: string, def: T): T { const v = readAll()[id]?.[key]; return v === undefined ? def : (v as T); },
  set(key: string, value: unknown) { try { const all = readAll(); (all[id] ??= {})[key] = value; localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* private window: nothing is kept */ } },
});
const hero = (title: string, back: string, backLabel: string, gearBack: string) =>
  h("header", { class: "top hero home-hero subj-hero", style: `--kid:${COLOR}` }, X.back(back, backLabel), h("span", { class: "subj-ico" }, subjectArt("games")), h("div", { class: "hero-text" }, h("h1", {}, title)), X.gear(gearBack));

export async function renderGames() {
  const my = X.epoch();
  X.showLoading();
  const mods = await Promise.all(GAMES.map((g) => g.load().catch(() => null)));
  if (my !== X.epoch()) return;
  const page = h("div", { class: "page", style: `--kid:${COLOR}` }, hero("小游戏", "#/", "选择学科", "#/subject/games"),
    h("main", { class: "scroll" }, h("div", { class: "narrow gm-narrow" },
      h("p", { class: "muted small center mus-lead" }, "不用登录，也不用联网：动动脑，动动手。"),
      h("div", { class: "gm-grid" }, ...GAMES.map((g, i) => {
        const icon = h("span", { class: "gm-art" });
        icon.innerHTML = mods[i]?.ICON ?? "";
        return h("button", { class: "gm-card", id: `gm-${g.id}`, "data-game": g.id, onclick: () => { unlock(); sfx("tap"); location.hash = `#/games/${g.id}`; } }, icon, h("b", {}, g.name), h("span", { class: "muted small" }, g.sub));
      })))));
  X.show(page);
  oneLine([...page.querySelectorAll<HTMLElement>(".gm-card b")], 11);
}

export async function renderGame(id: string) {
  const info = GAMES.find((g) => g.id === id);
  if (!info) return void (location.hash = "#/subject/games");
  const my = X.epoch();
  X.showLoading();
  let mod: GameModule;
  try { mod = await info.load(); } catch { toast("这个游戏打不开。"); return void (location.hash = "#/subject/games"); }
  if (my !== X.epoch()) return;
  const stage = h("div", { class: "gm-stage", id: "gm-stage" });
  const ctx: GameCtx = { id, h, toast, sfx: (k: SfxKind) => sfx(k), store: storeFor(id), exit: () => (location.hash = "#/subject/games") };
  const soundLabel = () => (isMuted() ? "音效：关" : "音效：开");
  const snd = h("button", { class: "gm-ib" + (isMuted() ? "" : " on"), id: "gm-sound", onclick: () => { setMuted(!isMuted()); syncSnd(); ctx.sfx("tap"); try { localStorage.setItem("learn.games.muted", isMuted() ? "1" : "0"); } catch { /* ok */ } } }, "♪");
  const syncSnd = () => { snd.classList.toggle("on", !isMuted()); snd.title = soundLabel(); snd.setAttribute("aria-label", soundLabel()); snd.setAttribute("aria-pressed", String(!isMuted())); };
  let full = false;
  const fullBtn = h("button", { class: "gm-ib", id: "gm-full", title: "全屏", "aria-label": "全屏", onclick: () => setFull(!full) }, "⛶");
  // a compact title band (the games need the room): back, title, sound, full screen
  const root: HTMLElement = h("div", { class: "page gm-page", style: `--kid:${COLOR}` },
    h("header", { class: "top hero gm-hero", style: `--kid:${COLOR}` }, X.back("#/subject/games", "小游戏"), h("h1", {}, info.name), snd, fullBtn),
    h("main", { class: "gm-main" }, stage));
  const setFull = (v: boolean) => {
    full = v; root.classList.toggle("gm-full", v); fullBtn.textContent = v ? "✕" : "⛶"; fullBtn.title = v ? "退出全屏" : "全屏"; fullBtn.setAttribute("aria-label", fullBtn.title);
    try { if (v) void (root.requestFullscreen?.() ?? Promise.resolve()).catch(() => { /* the page-wide mode is enough */ }); else if (document.fullscreenElement) void document.exitFullscreen(); } catch { /* same */ }
    window.setTimeout(() => window.dispatchEvent(new Event("resize")), 80);
  };
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && full && root.isConnected) setFull(false); });
  try { setMuted(localStorage.getItem("learn.games.muted") === "1"); } catch { /* ok */ }
  syncSnd();
  X.show(root);
  let stop: (() => void) | null = null;
  try { stop = mod.default(stage, ctx); } catch (e) { toast(`这个游戏出错了：${e instanceof Error ? e.message : String(e)}`, 6000); }
  const watch = new MutationObserver(() => { if (!root.isConnected) { try { stop?.(); } catch { /* ok */ } stop = null; watch.disconnect(); } });
  watch.observe(document.body, { childList: true, subtree: true });
}
