import type { GameCtx } from "./ctx";
import "./shooter.css";
import { W, H, STEP, LEVEL_COUNT, CP_T, MAXBOMBS, UPGRADES, newGame, newRun, step, stars, comboMult, spawnEnemy, offers, buy, canBuy, price, owned, maxed, type State, type Event, type Run, type UpKind, type EKind, type Opts } from "./shooter-logic";
import { worldOf } from "./shooter-levels";
import { drawBackground, drawShip, drawEnemies, drawBoss, drawPickup, drawCoin, drawEBullet, drawPB, drawBeam, drawHazards, drawStorm, drawHole, banner, weaponIcon } from "./shooter-art";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="100" height="100" rx="26" fill="#3b2f8f"/><circle cx="26" cy="30" r="2.5" fill="#fff"/><circle cx="52" cy="22" r="1.8" fill="#fff"/><circle cx="92" cy="58" r="2" fill="#fff"/><circle cx="30" cy="62" r="1.8" fill="#fff"/><circle cx="84" cy="34" r="14" fill="#adb5bd" stroke="#495057" stroke-width="3.5"/><circle cx="79" cy="32" r="2" fill="#3a2e39"/><circle cx="89" cy="32" r="2" fill="#3a2e39"/><path d="M80 40 Q84 37 88 40" fill="none" stroke="#3a2e39" stroke-width="2" stroke-linecap="round"/><path d="M52 92 Q60 112 68 92 Z" fill="#ff922b"/><path d="M42 80 Q36 90 40 98 L52 90 Z M78 80 Q84 90 80 98 L68 90 Z" fill="#fa5252" stroke="#c92a2a" stroke-width="3" stroke-linejoin="round"/><ellipse cx="60" cy="72" rx="16" ry="23" fill="#fff" stroke="#087f5b" stroke-width="4"/><path d="M46 62 Q60 30 74 62 Q60 56 46 62 Z" fill="#12b886" stroke="#087f5b" stroke-width="4" stroke-linejoin="round"/><circle cx="54" cy="72" r="3.4" fill="#3a2e39"/><circle cx="66" cy="72" r="3.4" fill="#3a2e39"/><path d="M55 81 Q60 86 65 81" fill="none" stroke="#3a2e39" stroke-width="2.4" stroke-linecap="round"/><path d="M30 46 L33 52 L39 53 L34 57 L36 63 L30 60 L24 63 L26 57 L21 53 L27 52 Z" fill="#ffd43b" stroke="#e67700" stroke-width="2" stroke-linejoin="round"/></svg>`;

type Phase = "ready" | "play" | "pause" | "clear" | "shop" | "over" | "won";
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number; ring?: boolean }
interface Float { x: number; y: number; txt: string; life: number; big: boolean }
const HEART = "M9 15 C2 10 1 6 3 3.5 C5 1.5 8 2 9 4.5 C10 2 13 1.5 15 3.5 C17 6 16 10 9 15 Z";
const KCOL: Record<string, string> = { rock: "#adb5bd", flyer: "#51cf66", zigzag: "#ffd43b", snake: "#51cf66", diver: "#9775fa", shield: "#74c0fc", splitter: "#ff8787", mini: "#ff8787", bomber: "#ffa94d", mother: "#ced4da", swarm: "#fa5252", stealth: "#5c7cfa", comet: "#ffd43b", boss: "#ff922b", balloon: "#ff6b9d" };
const OFFY = 56;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const UP_ICON: Record<UpKind, string> = {
  lives: `<svg viewBox="0 0 18 17"><path d="${HEART}" fill="#fa5252" stroke="#c92a2a" stroke-width="2" stroke-linejoin="round"/></svg>`,
  shield: `<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5" fill="rgba(99,230,190,.35)" stroke="#12b886" stroke-width="2.5"/></svg>`,
  rate: `<svg viewBox="0 0 20 20"><path d="M3 5 L10 10 L3 15 M10 5 L17 10 L10 15" fill="none" stroke="#e67700" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  magnet: `<svg viewBox="0 0 20 20"><path d="M4 4 V11 A6 6 0 0 0 16 11 V4" fill="none" stroke="#e64980" stroke-width="4" stroke-linecap="round"/></svg>`,
  bomb: `<svg viewBox="0 0 20 20"><circle cx="10" cy="12" r="6.5" fill="#495057" stroke="#212529" stroke-width="2"/><path d="M13 6 L16 2" stroke="#fa5252" stroke-width="2.5" stroke-linecap="round"/></svg>`,
};
const UP_NAME = (k: UpKind) => (k === "lives" ? "增加生命" : k === "shield" ? "加厚护盾" : k === "rate" ? "提升射速" : k === "magnet" ? "扩大磁力范围" : "初始炸弹");

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let easy = ctx.store.get<boolean>("easy", false);
  let reached = Math.max(1, Math.min(LEVEL_COUNT, ctx.store.get<number>("level", 1)));
  let selLevel = reached;
  const bestKey = () => (easy ? "best-easy" : "best-normal");
  const best = () => ctx.store.get<number>(bestKey(), 0);
  const starsOf = (): number[] => { const a = ctx.store.get<number[]>(easy ? "stars-easy" : "stars-normal", []); return Array.from({ length: LEVEL_COUNT }, (_, i) => Math.max(0, Math.min(3, a[i] | 0))); };

  const levelEl = h("span", { class: "sh-stat", id: "sh-level" }, "");
  const modeBtn = h("button", { class: "mopt", id: "sh-mode", onclick: () => { if (phase !== "ready") return; easy = !easy; ctx.store.set("easy", easy); ctx.sfx("tap"); run = newRun(easy); setup(selLevel); } }, "");
  const scoreEl = h("span", { class: "sh-stat", id: "sh-score" }, "");
  const bestEl = h("span", { class: "sh-stat best", id: "sh-best" }, "");
  const livesEl = h("span", { class: "sh-stat", id: "sh-lives" });
  const bombEl = h("button", { class: "sh-stat", id: "sh-bomb", onclick: () => { bombReq = true; } });
  const comboEl = h("span", { class: "sh-stat", id: "sh-combo" }, "");
  comboEl.hidden = true;
  const pauseBtn = h("button", { class: "mopt", id: "sh-pause", onclick: () => togglePause() }, "暂停");
  root.append(h("div", { class: "sh-wrap" }, h("div", { class: "sh-hud", id: "sh-hud" }, levelEl, scoreEl, bestEl, livesEl, bombEl, comboEl, modeBtn, pauseBtn)));
  const canvas = h("canvas", { id: "sh-canvas" });
  const title = h("h2", {}, ""), msg = h("p", {}, ""), extra = h("div", { class: "sh-extra", id: "sh-extra" });
  const action = h("button", { class: "primary", id: "sh-start", onclick: () => { ctx.sfx("tap"); primary(); } }, "开始");
  const ovl = h("div", { class: "sh-ovl", id: "sh-ovl" }, title, msg, extra, action);
  const field = h("div", { class: "sh-field", id: "sh-field" }, canvas, ovl);
  const board = h("div", { class: "sh-board" }, field);
  root.querySelector(".sh-wrap")!.append(board);

  let run: Run = newRun(easy), runSnap: Run = clone(run), offerList: UpKind[] = [], shopSeed = 1;
  let s!: State, phase: Phase = "ready", lastStars: [boolean, boolean, boolean] = [false, false, false], lastCp = false;
  let tx = W / 2, ty = H - 110 - OFFY, keyX = 0, keyY = 0, bombReq = false, manual = false, last = 0, acc = 0, raf = 0, now = 0, sc = 0, shake = 0, bannerT = 0, bannerTxt = "", bannerSub = "", flashT = 0, sfxAt = 0, grazeAt = 0;
  let parts: Particle[] = [], floats: Float[] = [], cw = 300, ch = 533, dpr = 1;

  const setOvl = (t: string, m: string, b: string, show: boolean) => { title.textContent = t; msg.textContent = m; action.textContent = b; ovl.hidden = !show; if (!show) extra.replaceChildren(); };
  const hearts = () => { livesEl.replaceChildren(); const n = Math.max(easy ? 5 : 3, s.lives); for (let i = 0; i < n; i++) livesEl.insertAdjacentHTML("beforeend", `<svg class="sh-heart${i < s.lives ? " on" : ""}" viewBox="0 0 18 17"><path d="${HEART}"/></svg>`); livesEl.dataset.lives = String(s.lives); };
  const bombs = () => { bombEl.replaceChildren(); for (let i = 0; i < MAXBOMBS; i++) bombEl.insertAdjacentHTML("beforeend", `<svg class="sh-bomb${i < s.bombs ? " on" : ""}" viewBox="0 0 20 20"><circle cx="10" cy="12" r="6.5"/><path d="M13 6 L16 2"/></svg>`); bombEl.dataset.bombs = String(s.bombs); bombEl.disabled = phase !== "play"; };
  const refreshHud = () => {
    levelEl.textContent = `关卡：${s.level}`;
    scoreEl.textContent = `得分：${s.score}`; bestEl.textContent = `最高：${Math.max(best(), s.score)}`; hearts(); bombs();
    modeBtn.textContent = easy ? "模式：简单" : "模式：普通"; modeBtn.classList.toggle("on", easy); modeBtn.disabled = phase !== "ready";
    pauseBtn.textContent = phase === "pause" ? "继续" : "暂停"; pauseBtn.disabled = phase !== "play" && phase !== "pause";
    comboEl.hidden = s.combo < 2; comboEl.textContent = `连击：${s.combo}`; comboEl.dataset.mult = String(comboMult(s));
  };
  function levelGrid() {
    const st = starsOf(), grid = h("div", { class: "sh-levels", id: "sh-levels" });
    for (let i = 1; i <= LEVEL_COUNT; i++) grid.append(h("button", { class: "sh-lv" + (i === selLevel ? " on" : ""), "data-level": i, onclick: () => { ctx.sfx("tap"); selLevel = i; run = newRun(easy); setup(i); } }, String(i), h("i", {}, "★".repeat(st[i - 1]) + "☆".repeat(3 - st[i - 1]))));
    return grid;
  }
  function setup(level: number, o: Opts = {}) {
    runSnap = clone(run);
    s = newGame(level, { easy, seed: Math.floor(Math.random() * 1e9) + 1, run, ...o });
    tx = s.ship.x; ty = s.ship.y; parts = []; floats = []; shake = 0; flashT = 0; phase = "ready"; bannerT = 0; lastCp = false;
    setOvl("太空射击", "拖动手指移动飞船，飞船自动开火。点击炸弹图标或按空格键使用炸弹。", "开始", true);
    extra.replaceChildren(levelGrid()); refreshHud(); layout();
  }
  function begin() { if (phase !== "ready") return; phase = "play"; setOvl("", "", "", false); last = performance.now(); acc = 0; bannerT = 2; bannerTxt = `LEVEL ${s.level}`; bannerSub = ""; refreshHud(); }
  function togglePause() {
    if (phase === "play") { phase = "pause"; setOvl("暂停", "点击继续。", "继续", true); }
    else if (phase === "pause") { phase = "play"; setOvl("", "", "", false); last = performance.now(); acc = 0; }
    refreshHud();
  }
  function showShop() {
    phase = "shop"; offerList = offers(run, s.level, shopSeed++);
    const cards = h("div", { class: "sh-shop", id: "sh-shop" });
    const render = () => {
      cards.replaceChildren();
      msg.textContent = `金币：${run.wallet}`;
      for (const k of offerList) {
        const dis = maxed(run, k), no = !dis && !canBuy(run, k);
        const icon = h("span", {}); icon.innerHTML = UP_ICON[k];
        const card = h("button", { class: "sh-card" + (dis || no ? " no" : ""), "data-up": k, onclick: () => { if (dis) return; if (!buy(run, k)) { ctx.sfx("bad"); ctx.toast("金币不足。", 1200); return; } ctx.sfx("good"); ctx.toast("已购买。", 1000); runSnap = clone(run); render(); } },
          icon, h("span", {}, UP_NAME(k), h("small", {}, `${owned(run, k)} / ${UPGRADES.find((u) => u.kind === k)!.max}`)), dis ? h("span", {}, "已满级") : h("span", { class: "sh-price" }, String(price(run, k))));
        cards.append(card);
      }
    };
    setOvl("商店", "", "下一关", true); extra.replaceChildren(cards); render();
  }
  function primary() {
    if (phase === "ready") begin();
    else if (phase === "pause") togglePause();
    else if (phase === "clear") showShop();
    else if (phase === "shop") { selLevel = s.level + 1; setup(selLevel); begin(); }
    else if (phase === "won") { run = newRun(easy); selLevel = 1; setup(1); begin(); }
    else if (phase === "over") {
      run = clone(runSnap);
      if (lastCp && s.cp) setup(s.level, { cp: s.cp, startTime: CP_T }); else setup(s.level);
      begin();
    }
  }
  function saveBest() { if (s && s.score > best()) ctx.store.set("best", s.score), ctx.store.set(bestKey(), s.score); }
  function rank(): number { return lastStars.filter(Boolean).length; }
  function onClear() {
    lastStars = stars(s);
    const st = starsOf(), r = rank(); if (r > st[s.level - 1]) { st[s.level - 1] = r; ctx.store.set(easy ? "stars-easy" : "stars-normal", st); }
    reached = Math.max(reached, Math.min(LEVEL_COUNT, s.level + 1)); ctx.store.set("level", reached);
    const rec = s.score > best(); saveBest(); ctx.sfx("win"); refreshHud();
    const won = s.level >= LEVEL_COUNT; phase = won ? "won" : "clear";
    const goals = h("div", { class: "sh-goals", id: "sh-goals" });
    const lines: [string, string][] = [["未被击中", ""], ["击落九成以上的敌机", ""], ["收集 50 枚金币", ` ${s.coinsGot}`]];
    lines.forEach(([t, extraTxt], i) => goals.append(h("div", { class: "sh-goal" + (lastStars[i] ? " got" : ""), "data-got": lastStars[i] ? "1" : "0" }, h("b", {}, lastStars[i] ? "★" : "☆"), h("span", {}, t + extraTxt))));
    const m = rec ? `新纪录：${s.score}` : `得分：${s.score}`;
    setOvl(won ? "全部通关。" : "本关完成。", m, won ? "再玩一次" : "商店", true);
    if (won) { const total = starsOf().reduce((a, b) => a + b, 0); msg.textContent = `总星数：${total} / 36`; }
    extra.replaceChildren(goals);
    for (let i = 0; i < 40; i++) pop(Math.random() * W, 80 + Math.random() * 200, ["#ffd43b", "#51cf66", "#ff6b9d", "#74c0fc"][i % 4], 1);
  }
  function onOver() {
    phase = "over"; saveBest(); ctx.sfx("lose"); refreshHud(); lastCp = !!s.cp;
    setOvl("游戏结束", lastCp ? "将从存档点重新开始。" : "本关未完成，可重试。", "重试", true);
    ctx.toast(`得分：${s.score}`, 1500);
  }

  const pop = (x: number, y: number, color: string, n = 10, big = false) => {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * (big ? 260 : 140); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, life: 0, max: 0.35 + Math.random() * (big ? 0.7 : 0.35), color, r: 2 + Math.random() * (big ? 5 : 3) }); }
  };
  function handle(evs: Event[], delta: number) {
    const kinds = new Set<string>(); let lastKill: { x: number; y: number } | null = null, coinSnd = false;
    for (const e of evs) {
      if (e.t === "kill") { kinds.add("pop"); pop(e.x, e.y, KCOL[e.kind] ?? "#fff", e.kind === "boss" ? 30 : 12); parts.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0, max: 0.35, color: "#fff", r: 6, ring: true }); lastKill = e; }
      else if (e.t === "hit") { kinds.add("tap"); pop(e.x, e.y, "#fff3bf", 3); }
      else if (e.t === "pop") { kinds.add("tap"); pop(e.x, e.y, "#a5d8ff", 8); }
      else if (e.t === "split") pop(e.x, e.y, "#fff", 6);
      else if (e.t === "pickup") kinds.add("good");
      else if (e.t === "gift") { kinds.add("good"); pop(e.x, e.y, "#ffd43b", 14); }
      else if (e.t === "coin") coinSnd = true;
      else if (e.t === "hurt") { kinds.add("bad"); shake = reduced ? 0 : 1; flashT = 1; pop(e.x, e.y, "#fa5252", 18, true); refreshHud(); }
      else if (e.t === "shield") { kinds.add("check"); flashT = 0.4; }
      else if (e.t === "bomb") { kinds.add("drop"); shake = reduced ? 0 : 0.8; refreshHud(); }
      else if (e.t === "boss") { kinds.add("check"); bannerT = 2; bannerTxt = "BOSS"; bannerSub = ""; }
      else if (e.t === "bossdead") { kinds.add("capture"); shake = reduced ? 0 : 1; }
      else if (e.t === "boom") { kinds.add("pop"); pop(e.x, e.y, ["#ffd43b", "#ff922b", "#fa5252", "#fff"][Math.floor(Math.random() * 4)], 14, true); parts.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0, max: 0.4, color: "#ffd43b", r: 8, ring: true }); shake = reduced ? 0 : Math.max(shake, 0.4); }
      else if (e.t === "checkpoint") { kinds.add("good"); bannerT = 1.6; bannerTxt = "CHECKPOINT"; bannerSub = ""; }
      else if (e.t === "combo") kinds.add("line");
      else if (e.t === "warn") kinds.add("swap");
      else if (e.t === "zap") { kinds.add("capture"); shake = reduced ? 0 : Math.max(shake, 0.3); }
      else if (e.t === "graze") { if (now - grazeAt > 150) { grazeAt = now; kinds.add("move"); } }
      else if (e.t === "life") kinds.add("good");
      else if (e.t === "hole" || e.t === "storm") kinds.add("check");
      else if (e.t === "clear") onClear();
      else if (e.t === "over") onOver();
    }
    if (lastKill && delta > 0) floats.push({ x: lastKill.x, y: lastKill.y - 10, txt: `+${delta}`, life: 0, big: comboMult(s) > 1 });
    if (s.cleared || s.over) kinds.clear();
    if (coinSnd && now - sfxAt > 90) { sfxAt = now; kinds.add("place"); }
    if (kinds.has("pop") || kinds.has("bad")) kinds.delete("tap");
    kinds.forEach((k) => ctx.sfx(k as never));
    if (evs.some((e) => e.t === "coin" || e.t === "pickup" || e.t === "life" || e.t === "bomb" || e.t === "kill")) refreshHud();
  }

  function advance(dt: number) {
    if (phase !== "play") return;
    if (keyX || keyY) { tx = Math.max(0, Math.min(W, tx + keyX * 420 * dt)); ty = Math.max(0, Math.min(H, ty + keyY * 420 * dt)); }
    const before = s.score;
    const evs = step(s, dt, { tx, ty, bomb: bombReq }); bombReq = false;
    handle(evs, s.score - before);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.4);
    if (flashT > 0) flashT = Math.max(0, flashT - dt / 0.5);
    if (bannerT > 0) bannerT = Math.max(0, bannerT - dt);
  }

  // ---- drawing ----
  function layout() {
    const w = board.clientWidth, hh = board.clientHeight;
    cw = Math.max(120, Math.floor(Math.min(w - 8, ((hh - 10) * 9) / 16))); ch = Math.round((cw * 16) / 9); dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = `${cw}px`; canvas.style.height = `${ch}px`; field.style.width = `${cw}px`; field.style.height = `${ch}px`; field.style.setProperty("--u", String(cw / W));
    draw();
  }
  function draw() {
    const g = canvas.getContext("2d"); if (!g || !s) return;
    const k = (cw * dpr) / W; g.setTransform(k, 0, 0, k, 0, 0);
    const t = now / 1000, sx = shake > 0 ? Math.sin(now / 25) * 5 * shake : 0, sy = shake > 0 ? Math.cos(now / 31) * 4 * shake : 0; g.translate(sx, sy);
    const world = worldOf(s.level);
    drawBackground(g, world, sc);
    drawHole(g, s, t); drawStorm(g, s, t); drawHazards(g, s, t);
    for (const c of s.coins) drawCoin(g, c.x, c.y, t);
    for (const p of s.pups) drawPickup(g, p.x, p.y, p.kind);
    drawEnemies(g, s, world, t);
    if (s.dying) { const dy = s.dying; drawBoss(g, { x: dy.x, y: dy.y, r: dy.bt === 0 ? 34 : 46, bt: dy.bt, hp: 0, maxhp: 1, hurt: 1, tele: 0, dash: null } as never, world, t, dy.t); }
    for (const b of s.ebullets) drawEBullet(g, b, t);
    for (const b of s.bullets) drawPB(g, b);
    drawBeam(g, s, t);
    const near = s.ebullets.some((b) => Math.hypot(b.x - s.ship.x, b.y - s.ship.y) < 40);
    drawShip(g, s, t, s.inv > 1.5 && !s.bossDead ? "hurt" : near ? "shock" : "happy");
    for (const q of parts) { g.globalAlpha = Math.max(0, 1 - q.life / q.max); if (q.ring) { g.strokeStyle = q.color; g.lineWidth = 3; g.beginPath(); g.arc(q.x, q.y, 8 + (q.life / q.max) * 36, 0, 7); g.stroke(); } else { g.fillStyle = q.color; g.fillRect(q.x - q.r / 2, q.y - q.r / 2, q.r, q.r); } }
    g.globalAlpha = 1;
    g.textAlign = "center"; g.textBaseline = "middle";
    for (const f of floats) { g.globalAlpha = Math.max(0, 1 - f.life / 0.9); g.font = `900 ${f.big ? 18 : 14}px system-ui, sans-serif`; g.lineWidth = 4; g.strokeStyle = "#087f5b"; g.strokeText(f.txt, f.x, f.y - f.life * 40); g.fillStyle = f.big ? "#ffd43b" : "#fff"; g.fillText(f.txt, f.x, f.y - f.life * 40); }
    g.globalAlpha = 1;
    if (s.bombFlash > 0) { g.fillStyle = `rgba(255,255,255,${s.bombFlash * 0.8})`; g.fillRect(-12, -12, W + 24, H + 24); }
    if (flashT > 0) { g.fillStyle = `rgba(250,82,82,${flashT * 0.3})`; g.fillRect(-12, -12, W + 24, H + 24); }
    // on-board status: weapon, timers, the boss
    g.setTransform(k, 0, 0, k, 0, 0);
    weaponIcon(g, 32, 24, s.weapon, s.wl);
    let ex = 70;
    for (const [kind, fr] of [["rapid", s.rapid / 8], ["magnet", s.magnet / 10]] as const) if (fr > 0) { drawPickup(g, ex + 14, 22, kind, 0.7); g.fillStyle = "rgba(255,255,255,.3)"; g.fillRect(ex, 36, 28, 4); g.fillStyle = "#63e6be"; g.fillRect(ex, 36, 28 * fr, 4); ex += 40; }
    if (s.boss) { const f = Math.max(0, s.boss.hp / s.boss.maxhp), bx = W / 2 - 80; g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.roundRect(bx - 3, 7, 166, 14, 7); g.fill(); g.fillStyle = f > 0.66 ? "#51cf66" : f > 0.33 ? "#ffd43b" : "#fa5252"; g.beginPath(); g.roundRect(bx, 10, 160 * f, 8, 4); g.fill(); g.fillStyle = "rgba(255,255,255,.6)"; g.fillRect(bx + 160 * 0.33 - 1, 9, 2, 10); g.fillRect(bx + 160 * 0.66 - 1, 9, 2, 10); }
    if (bannerT > 0) banner(g, bannerTxt, bannerT, bannerSub);
  }
  function frame(ts: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(100, ts - (last || ts)); last = ts; now = ts;
    const sec = dt / 1000;
    if (!manual && phase === "play") { acc += sec * (s.slow > 0 ? 0.35 : 1); let guard = 0; while (acc >= STEP && guard++ < 8 && phase === "play") { acc -= STEP; advance(STEP); } }
    if (phase === "play" || phase === "ready") sc += sec;
    for (const q of parts) { q.life += sec; q.x += q.vx * sec; q.y += q.vy * sec; q.vy += 300 * sec; }
    parts = parts.filter((q) => q.life < q.max);
    for (const f of floats) f.life += sec;
    floats = floats.filter((f) => f.life < 0.9);
    draw();
  }

  // ---- input ----
  const toBoard = (cx: number, cy: number) => { const r = canvas.getBoundingClientRect(); return { x: ((cx - r.left) / r.width) * W, y: ((cy - r.top) / r.height) * H }; };
  let pid = -1;
  const follow = (e: PointerEvent) => { if (phase !== "play") return; const p = toBoard(e.clientX, e.clientY); tx = Math.max(0, Math.min(W, p.x)); ty = Math.max(0, Math.min(H, p.y - OFFY)); };
  const onDown = (e: PointerEvent) => {
    if (e.target instanceof HTMLButtonElement) return;
    if (pid !== -1) return;   // one finger
    pid = e.pointerId;
    try { field.setPointerCapture(e.pointerId); } catch { /* ok */ }
    follow(e);
  };
  const onMove = (e: PointerEvent) => { if (e.pointerId === pid) follow(e); };
  const onUp = (e: PointerEvent) => { if (e.pointerId === pid) pid = -1; };
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === "ArrowLeft" || k === "a" || k === "A") { e.preventDefault(); keyX = -1; return; }
    if (k === "ArrowRight" || k === "d" || k === "D") { e.preventDefault(); keyX = 1; return; }
    if (k === "ArrowUp" || k === "w" || k === "W") { e.preventDefault(); keyY = -1; return; }
    if (k === "ArrowDown" || k === "s" || k === "S") { e.preventDefault(); keyY = 1; return; }
    if (k === "p" || k === "P" || k === "Escape") { e.preventDefault(); if (phase === "play" || phase === "pause") togglePause(); return; }
    if (k === " " || k === "Enter") {
      if (e.target instanceof HTMLButtonElement && k === "Enter") return;
      e.preventDefault();
      if (phase === "play") bombReq = true; else primary();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    const k = e.key;
    if (["ArrowLeft", "a", "A", "ArrowRight", "d", "D"].includes(k)) keyX = 0;
    if (["ArrowUp", "w", "W", "ArrowDown", "s", "S"].includes(k)) keyY = 0;
  };
  const onVis = () => { if (document.hidden && phase === "play") togglePause(); };
  document.addEventListener("keydown", onKey); document.addEventListener("keyup", onKeyUp); document.addEventListener("visibilitychange", onVis);
  field.addEventListener("pointerdown", onDown); field.addEventListener("pointermove", onMove); field.addEventListener("pointerup", onUp); field.addEventListener("pointercancel", onUp);
  window.addEventListener("resize", layout);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layout()) : null; ro?.observe(board);

  setup(selLevel);
  raf = requestAnimationFrame(frame);
  const hook = {
    state: () => s, phase: () => phase, target: () => ({ x: tx, y: ty }), cw: () => cw, ch: () => ch, particles: () => parts.length, floats: () => floats.length, shake: () => shake, run: () => run, easy: () => easy,
    manual: (on: boolean) => { manual = on; },
    /** advance n fixed steps (1/60 s) by hand */
    step: (n = 1) => { for (let i = 0; i < n; i++) advance(STEP); },
    spawn: (kind: EKind, x: number, y?: number) => spawnEnemy(s, kind, x, { y }),
    seed: (n: number) => { s.rs = n >>> 0; },
    setLevel: (l: number, score = 0) => { selLevel = l; run = newRun(easy); setup(l, { score }); },
    bomb: () => { bombReq = true; },
    shop: () => offerList,
  };
  (window as unknown as Record<string, unknown>).__shooter = hook;
  return () => {
    saveBest(); cancelAnimationFrame(raf); ro?.disconnect();
    document.removeEventListener("keydown", onKey); document.removeEventListener("keyup", onKeyUp); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("resize", layout);
    delete (window as unknown as Record<string, unknown>).__shooter;
  };
}
