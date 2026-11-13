/**
 * All data access of the app goes through this file (CLAUDE.md rule 4): `readJson` / `update`.
 * Two places can hold the data: a PRIVATE GitHub repository (default; the browser talks to the GitHub REST API directly
 * with a fine-grained token that only has Contents access to that one repo) or this device (localStorage, no account).
 * OFFLINE FIRST (CLAUDE.md rule 35): the newest copy of every file read or written is kept on this device; without network reads come from it and
 * changes are kept there too, marked "not sent yet", and sent (merged, sync.ts) when the network is back.
 */
import { toast } from "./ui";
import { mergeDocs } from "./sync";
export interface Auth {
  token: string;
  repo: string; // owner/name
  branch?: string;
  user?: string;
}

const AUTH_KEY = "learn.auth.v1";
const MODE_KEY = "learn.storage";
const REPO_KEY = "learn.lastRepo";
const LOCAL_PREFIX = "learn.local.";

// ---------- storage mode: GitHub or this device ----------
export function isLocal(): boolean {
  try { return localStorage.getItem(MODE_KEY) === "local"; } catch { return false; }
}
export function useLocal() {
  try { localStorage.setItem(MODE_KEY, "local"); } catch { /* private mode: works until the tab is closed */ }
  try { void navigator.storage?.persist?.(); } catch { /* ask the browser not to clear it */ }
}
export function leaveLocal() {
  try { localStorage.removeItem(MODE_KEY); } catch { /* ignore */ }
}

// ---------- sign-in ----------
function readAuth(store: Storage): Auth | null {
  try {
    const a = JSON.parse(store.getItem(AUTH_KEY) ?? "null");
    return a?.token && a?.repo ? a : null;
  } catch {
    return null;
  }
}
/** "Stay signed in" lives in localStorage; otherwise only in sessionStorage (gone when the tab closes). */
export const getAuth = (): Auth | null => readAuth(sessionStorage) ?? readAuth(localStorage);
export const isPersistent = (): boolean => readAuth(localStorage) !== null;
export const lastRepo = (): string => { try { return localStorage.getItem(REPO_KEY) ?? ""; } catch { return ""; } };
/** signed in (GitHub) or using this device */
export const isSignedIn = (): boolean => isLocal() || getAuth() !== null;
export function logout() {
  const repo = getAuth()?.repo;
  // the copies kept on this device are removed, except the changes that were not sent yet (they are sent after the next sign in to the same repository)
  if (repo) {
    try {
      const prefix = `learn.sync.v1.${repo}.`;
      for (const k of Object.keys(localStorage)) {
        if (!k.startsWith(prefix) || k === `${prefix}__dirty`) continue;
        try { if (!(JSON.parse(localStorage.getItem(k) ?? "{}") as { dirty?: boolean }).dirty) localStorage.removeItem(k); } catch { localStorage.removeItem(k); }
      }
    } catch { /* ignore */ }
  }
  for (const st of [localStorage, sessionStorage]) {
    try { st.removeItem(AUTH_KEY); } catch { /* ignore */ }
  }
  shas.clear();
  memo.clear();
}

/** A link that signs another device in: the token travels in the URL #fragment (never sent to any server). */
export function makeLoginLink(a: Auth): string {
  const payload = btoa(JSON.stringify({ t: a.token, r: a.repo })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${location.origin}${location.pathname}#/link/${payload}`;
}
export function parseLink(text: string): { token: string; repo: string } | null {
  const m = text.match(/#\/link\/([\w-]+)/);
  if (!m) return null;
  try {
    const o = JSON.parse(atob(m[1].replace(/-/g, "+").replace(/_/g, "/")));
    return o.t && o.r ? { token: o.t, repo: o.r } : null;
  } catch {
    return null;
  }
}

export class AuthExpired extends Error {}
/** An API failure with what GitHub said about it (shown to the user, not swallowed). */
export class ApiError extends Error {
  constructor(message: string, public status: number, public detail = "") {
    super(message);
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** a failure of the NETWORK itself (no connection), not an answer of GitHub */
export const isNetError = (e: unknown): boolean => e instanceof ApiError && e.status === 0;
/** after a failed request the network is not tried again for a few seconds (offline = no waiting on every screen) */
let downUntil = 0;
const DOWN_MS = 15000;

function headers(a: Auth): HeadersInit {
  return { Authorization: `Bearer ${a.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
}

/** GitHub sends the end date of a token in `github-authentication-token-expiration` ("2026-12-01 08:00:00 UTC"); a browser may not be allowed to read it, then nothing is stored */
const EXP_KEY = "learn.token.exp.v1";
function rememberExpiry(res: Response): void {
  try { const v = res.headers.get("github-authentication-token-expiration"); if (v) localStorage.setItem(EXP_KEY, v); } catch { /* not readable / no storage */ }
}
/** the end date of the token of this device (`date` as YYYY-MM-DD, `days` left, negative = expired) or null when it is not known */
export function tokenExpiry(now = Date.now()): { date: string; days: number } | null {
  let raw: string | null = null;
  try { raw = localStorage.getItem(EXP_KEY); } catch { /* no storage */ }
  const m = raw && /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!m) return null;
  const end = Date.parse(`${m[1]}-${m[2]}-${m[3]}T23:59:59`);
  return Number.isFinite(end) ? { date: `${m[1]}-${m[2]}-${m[3]}`, days: Math.ceil((end - now) / 86400000) } : null;
}

async function gh(a: Auth, url: string, init: RequestInit = {}): Promise<Response> {
  let res: Response | undefined;
  let why = "";
  if ((typeof navigator !== "undefined" && navigator.onLine === false) || Date.now() < downUntil) throw new ApiError("没有网络", 0);   // (known to be offline: no waiting)
  // a dropped connection (phone on cellular / flaky Wi-Fi) is retried before giving up
  for (let i = 0; i < 3 && !res; i++) {
    try {
      res = await fetch(url, init);
    } catch (e) {
      why = e instanceof Error ? e.message : String(e);
      if (i < 2) await sleep(400 * (i + 1));
    }
  }
  if (!res) { downUntil = Date.now() + DOWN_MS; throw new ApiError(`网络请求失败（${why || "未知"}）：网络中断或被拦截。`, 0); }
  downUntil = 0;
  rememberExpiry(res);
  if (res.status === 401) {
    logout();
    throw new AuthExpired("登录已失效，请重新登录");
  }
  return res;
}

/** Validate token + repo, then remember them on this device. */
export async function login(token: string, repo: string, remember = true): Promise<Auth> {
  const link = parseLink(token);
  if (link) ({ token, repo } = link);
  repo = repo.trim().replace(/^https:\/\/github\.com\//, "").replace(/\/$/, "");
  token = token.trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("仓库格式应为 owner/name");
  if (!token) throw new Error("请输入令牌");
  const a: Auth = { token, repo };
  const r = await fetch(`https://api.github.com/repos/${repo}`, { headers: headers(a) });
  if (r.status === 401) throw new Error("令牌无效或已过期");
  if (r.status === 404) throw new Error("找不到该仓库，或令牌没有访问它的权限");
  if (!r.ok) throw new Error(`GitHub 返回 ${r.status}`);
  const info = (await r.json()) as { permissions?: { push?: boolean }; default_branch: string; private: boolean };
  if (!info.permissions?.push) throw new Error("令牌没有该仓库的写权限（需要 Contents: Read and write）");
  if (!info.private && !location.hostname.match(/^(localhost|127\.0\.0\.1)$/)) {
    throw new Error("该仓库为公开仓库，学习记录将对所有人可见。请使用私有仓库。");
  }
  a.branch = info.default_branch;
  // not another app's data: the piano app keeps its scores in scores/ inbox/ pdfs/ — this app would mix its files into that repository
  const root = await fetch(`https://api.github.com/repos/${repo}/contents?ref=${encodeURIComponent(a.branch)}`, { headers: headers(a) });
  if (root.ok) {
    const items = (await root.json()) as { name: string; type: string }[];
    if (Array.isArray(items) && items.some((i) => i.type === "dir" && ["scores", "inbox", "pdfs"].includes(i.name))) {
      throw new Error("该仓库为钢琴练习项目的乐谱仓库，不能用于存放识字数据。请改用专用的私有仓库（例如 LearningData）。");
    }
  }
  const u = await fetch("https://api.github.com/user", { headers: headers(a) });
  if (u.ok) a.user = ((await u.json()) as { login: string }).login;
  logout();
  leaveLocal();
  (remember ? localStorage : sessionStorage).setItem(AUTH_KEY, JSON.stringify(a));
  try { localStorage.setItem(REPO_KEY, repo); } catch { /* ignore */ }
  return a;
}

function need(): Auth {
  const a = getAuth();
  if (!a) throw new AuthExpired("请先登录");
  return a;
}
const contentsUrl = (a: Auth, path: string) =>
  `https://api.github.com/repos/${a.repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
const refQ = (a: Auth) => `?ref=${encodeURIComponent(a.branch ?? "main")}`;

// UTF-8 <-> base64 (btoa/atob only handle Latin-1)
function toB64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// the sha of the version we last read, per file (GitHub needs it to accept a change)
const shas = new Map<string, string>();

async function ghRead(path: string): Promise<{ text: string; sha: string } | null> {
  const a = need();
  const r = await gh(a, contentsUrl(a, path) + refQ(a), { headers: headers(a), cache: "no-store" });
  if (r.status === 404) {
    shas.delete(path);
    return null;
  }
  if (!r.ok) throw new ApiError(`读取失败（${r.status}）`, r.status);
  const j = (await r.json()) as { sha: string; content?: string };
  shas.set(path, j.sha);
  return { text: fromB64(j.content ?? ""), sha: j.sha };
}

async function ghWrite(path: string, text: string, sha: string | undefined, message: string): Promise<void> {
  const a = need();
  const body: Record<string, unknown> = { message, content: toB64(text), branch: a.branch ?? "main" };
  if (sha) body.sha = sha;
  const r = await gh(a, contentsUrl(a, path), { method: "PUT", headers: { ...headers(a), "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (r.status === 409 || r.status === 422) throw new ApiError("conflict", r.status);
  if (!r.ok) {
    let detail = "";
    try { detail = ((await r.json()) as { message?: string }).message ?? ""; } catch { /* not JSON */ }
    throw new ApiError(`保存失败（${r.status}）${detail ? `：${detail}` : ""}`, r.status, detail);
  }
  const j = (await r.json().catch(() => ({}))) as { content?: { sha?: string } };
  if (j.content?.sha) shas.set(path, j.content.sha);
}

// ---------- offline-first: the newest copy of every file is kept on this device ----------
/** the copy of a file on this device: what was read / written last, its sha, and whether it holds changes the repository does not have yet (made without network) */
interface Copy { json: unknown; sha?: string; dirty?: boolean; base?: string }
const copyKey = (path: string) => `learn.sync.v1.${getAuth()?.repo ?? "-"}.${path}`;
const dirtyKey = () => `learn.sync.v1.${getAuth()?.repo ?? "-"}.__dirty`;
const loadCopy = (path: string): Copy | null => { try { const s = localStorage.getItem(copyKey(path)); return s ? (JSON.parse(s) as Copy) : null; } catch { return null; } };
const saveCopy = (path: string, c: Copy) => { try { localStorage.setItem(copyKey(path), JSON.stringify(c)); } catch { /* storage full: the next read asks the network again */ } };
const dirtyList = (): string[] => { try { return JSON.parse(localStorage.getItem(dirtyKey()) ?? "[]") as string[]; } catch { return []; } };
const setDirty = (path: string, on: boolean) => { const l = new Set(dirtyList()); if (on) l.add(path); else l.delete(path); try { localStorage.setItem(dirtyKey(), JSON.stringify([...l])); } catch { /* ignore */ } };
/** how many files hold changes that are not in the data repository yet */
export const pendingCount = (): number => dirtyList().length;
/** the data of this session is not asked for again for a few seconds (moving between screens does not call the network each time) */
const memo = new Map<string, { json: unknown; at: number }>();
const MEMO_MS = 8000;
const clone = <T,>(x: T): T => (x === null || x === undefined ? x : (JSON.parse(JSON.stringify(x)) as T));
/** a per-child file that may well not exist yet (made on first use): when offline and never read, "nothing there yet" is the right answer */
const lazyFile = (path: string) => /^(kids|english|french|math|science|poems|dictation|write|geomap)\/[\w-]+(\.review|\.dictation)?\.json$/.test(path);
let noticed = false;
/** told once per offline spell that a change was kept on this device */
function noticeOffline() { if (noticed) return; noticed = true; toast("无网络：已保存在本设备上，联网后将自动同步", 5000); }
/** call when the network may be back (the browser's "online" event) */
export function networkMayBeBack() { downUntil = 0; noticed = false; }

/** sends the changes kept on this device for one file (merged with what another device may have changed meanwhile); returns the file as it is now */
async function flush(path: string): Promise<unknown> {
  const c = loadCopy(path);
  if (!c?.dirty) return c?.json ?? null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const f = await ghRead(path);
    const remote = f ? JSON.parse(f.text) : null;
    const merged = !f || f.sha === c.base ? c.json : mergeDocs(c.json, remote);
    try {
      await ghWrite(path, JSON.stringify(merged, null, 2) + "\n", f?.sha, "sync changes made offline");
    } catch (e) {
      if (e instanceof ApiError && e.message === "conflict" && attempt < 3) { await sleep(300 * (attempt + 1)); continue; }
      throw e;
    }
    saveCopy(path, { json: merged, sha: shas.get(path) });
    setDirty(path, false);
    memo.set(path, { json: merged, at: Date.now() });
    return merged;
  }
  throw new Error("同步失败");
}
/** sends every file with changes made offline; a message says what was done. Quiet when there is nothing to do or there is still no network. */
export async function flushAll(): Promise<number> {
  if (isLocal() || !getAuth()) return 0;
  let n = 0;
  for (const path of dirtyList()) {
    try { await flush(path); n++; } catch (e) { if (isNetError(e)) break; if (e instanceof AuthExpired) break; toast(e instanceof Error ? e.message : String(e), 6000); }
  }
  if (n) { noticed = false; toast("已把离线时保存的内容同步到 GitHub", 4000); }
  return n;
}

// ---------- public API ----------
/** Read one JSON file; `null` when it does not exist yet. Without network: the copy kept on this device. */
export async function readJson<T>(path: string): Promise<T | null> {
  if (isLocal()) {
    try {
      const s = localStorage.getItem(LOCAL_PREFIX + path);
      return s ? (JSON.parse(s) as T) : null;
    } catch {
      return null;
    }
  }
  const m = memo.get(path);
  if (m && Date.now() - m.at < MEMO_MS) return clone(m.json) as T | null;
  const c = loadCopy(path);
  try {
    if (c?.dirty) {
      try { const merged = await flush(path); return clone(merged) as T | null; } catch (e) { if (isNetError(e)) return clone(c.json) as T | null; throw e; }
    }
    const f = await ghRead(path);
    const json = f ? (JSON.parse(f.text) as T) : null;
    saveCopy(path, { json, sha: f?.sha });
    memo.set(path, { json, at: Date.now() });
    return clone(json);
  } catch (e) {
    if (isNetError(e)) {
      if (c) return clone(c.json) as T | null;
      if (lazyFile(path)) return null;
    }
    throw e;
  }
}

/**
 * Read-modify-write one JSON file: reads the newest version (or `init` when there is none), applies `change`, saves.
 * When another device changed the file in between (GitHub answers 409 / 422) it reads again and re-applies `change`,
 * so edits from two devices are merged instead of overwritten. WITHOUT network the change is applied to the copy kept on this
 * device and marked "not sent yet"; it is sent (merged with what other devices did) as soon as there is a network again.
 */
export async function update<T>(path: string, init: T, change: (cur: T) => T, message = "update"): Promise<T> {
  if (isLocal()) {
    const cur = (await readJson<T>(path)) ?? structuredClone(init);
    const next = change(cur);
    try {
      localStorage.setItem(LOCAL_PREFIX + path, JSON.stringify(next));
    } catch {
      throw new Error("本机存储空间已满或被浏览器禁用，数据未保存。");
    }
    return next;
  }
  try {
    if (loadCopy(path)?.dirty) await flush(path);
    for (let attempt = 0; attempt < 4; attempt++) {
      const f = await ghRead(path);
      const cur = f ? (JSON.parse(f.text) as T) : structuredClone(init);
      saveCopy(path, { json: f ? cur : null, sha: f?.sha });
      const next = change(cur);
      try {
        await ghWrite(path, JSON.stringify(next, null, 2) + "\n", f?.sha, message);
        saveCopy(path, { json: next, sha: shas.get(path) });
        memo.set(path, { json: next, at: Date.now() });
        return next;
      } catch (e) {
        if (e instanceof ApiError && e.message === "conflict" && attempt < 3) {
          await sleep(300 * (attempt + 1));
          continue;
        }
        if (e instanceof ApiError && e.message === "conflict") throw new Error("另一台设备正在同时修改，请稍后再试。");
        throw e;
      }
    }
    throw new Error("保存失败");
  } catch (e) {
    if (!isNetError(e)) throw e;
    const c = loadCopy(path);
    const cur = c?.json !== undefined && c?.json !== null ? (clone(c.json) as T) : structuredClone(init);
    const next = change(cur);
    saveCopy(path, { json: next, sha: c?.sha, dirty: true, base: c?.dirty ? c.base : c?.sha });
    setDirty(path, true);
    memo.set(path, { json: next, at: Date.now() });
    noticeOffline();
    return next;
  }
}

/** Delete one file (nothing happens when it does not exist). */
export async function remove(path: string, message = "delete"): Promise<void> {
  if (isLocal()) {
    try { localStorage.removeItem(LOCAL_PREFIX + path); } catch { /* ignore */ }
    return;
  }
  const f = await ghRead(path);
  if (!f) return;
  const a = need();
  const r = await gh(a, contentsUrl(a, path), {
    method: "DELETE",
    headers: { ...headers(a), "Content-Type": "application/json" },
    body: JSON.stringify({ message, sha: f.sha, branch: a.branch ?? "main" }),
  });
  if (!r.ok && r.status !== 404) throw new ApiError(`删除失败（${r.status}）`, r.status);
  shas.delete(path);
  memo.delete(path);
  try { localStorage.removeItem(copyKey(path)); } catch { /* ignore */ }
  setDirty(path, false);
}
