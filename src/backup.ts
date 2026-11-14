/**
 * Backup / restore of the data that lives ONLY on this device (CLAUDE.md rule 67): every `learn.*` key of localStorage
 * (grade profile, settings, game / music / DJ / coding / chemistry / physics / biology / geography progress, PK records, and the children's data
 * when the app runs in "on this device" mode) goes into one JSON file; the file can be read back on this or another device.
 *
 * NEVER in the file: the sign-in token (`learn.auth.v1`), its end date, the admin password hash, the "this device / GitHub" choice, the last repository,
 * and the offline copies of the GitHub files (`learn.sync.v1.*`: they are copies, the data itself is in the private repository).
 * On import the same rule is applied to the file: a file that carries one of these keys has them ignored, so a hand-made file can not plant a token.
 * Downloads go through native.ts (a file on the web, the share sheet in the iOS / Android app).
 */
import { saveFile } from "./native";
import { toast, confirmDlg } from "./ui";

export const BACKUP_APP = "learning-center-backup";
export const BACKUP_VERSION = 1;
/** keys that are never exported and never imported */
const NEVER = new Set(["learn.auth.v1", "learn.token.exp.v1", "learn.admin.v1", "learn.storage", "learn.lastRepo"]);
export const MAX_BACKUP_BYTES = 40 * 1024 * 1024;

export const isBackupKey = (k: string): boolean => k.startsWith("learn.") && !NEVER.has(k) && !k.startsWith("learn.sync.v1.");

export interface BackupFile { app: string; version: number; created: string; build: string; keys: Record<string, string> }

export function collect(st: Pick<Storage, "length" | "key" | "getItem"> = localStorage): Record<string, string> {
  const keys: Record<string, string> = {};
  for (let i = 0; i < st.length; i++) {
    const k = st.key(i);
    if (!k || !isBackupKey(k)) continue;
    const v = st.getItem(k);
    if (v !== null) keys[k] = v;
  }
  return keys;
}

export const buildBackup = (keys: Record<string, string>, now = new Date(), build = __BUILD__): BackupFile => ({ app: BACKUP_APP, version: BACKUP_VERSION, created: now.toISOString(), build, keys });

/** reads a backup file; throws an Error with a short reason when the file is not one of ours */
export function parseBackup(text: string): { file: BackupFile; keys: Record<string, string>; skipped: number } {
  let o: unknown;
  try { o = JSON.parse(text); } catch { throw new Error("not json"); }
  const f = o as Partial<BackupFile> | null;
  if (!f || typeof f !== "object" || f.app !== BACKUP_APP) throw new Error("not a backup");
  if (typeof f.version !== "number" || f.version > BACKUP_VERSION) throw new Error("newer version");
  if (!f.keys || typeof f.keys !== "object" || Array.isArray(f.keys)) throw new Error("no data");
  const keys: Record<string, string> = {};
  let skipped = 0;
  for (const [k, v] of Object.entries(f.keys)) {
    if (typeof v === "string" && isBackupKey(k)) keys[k] = v; else skipped++;
  }
  if (!Object.keys(keys).length) throw new Error("empty");
  return { file: f as BackupFile, keys, skipped };
}

const pad = (n: number) => String(n).padStart(2, "0");
export const backupName = (d = new Date()): string => `learning-center-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;

export async function exportBackup(): Promise<void> {
  const done = toast("正在导出备份…", 0, true);
  try {
    const keys = collect();
    const name = backupName();
    const res = await saveFile(new TextEncoder().encode(JSON.stringify(buildBackup(keys), null, 1)), name, "application/json");
    done();
    if (res === "cancelled") return;
    if (res === "error") return void toast("无法导出备份。", 4000);
    toast(`备份已导出：${name}（${Object.keys(keys).length} 项）`, 5000);
  } catch { done(); toast("无法导出备份。", 4000); }
}

const pickFile = (): Promise<File | null> => new Promise((resolve) => {
  const input = document.createElement("input");
  input.type = "file"; input.accept = ".json,application/json"; input.style.display = "none"; input.id = "backup-file";
  input.addEventListener("change", () => { resolve(input.files?.[0] ?? null); input.remove(); });
  input.addEventListener("cancel", () => { resolve(null); input.remove(); });
  document.body.append(input);
  input.click();
});

export async function importBackup(file?: File | null): Promise<void> {
  const f = file === undefined ? await pickFile() : file;
  if (!f) return;
  const bad = (): void => void toast("备份文件无效，未做任何更改。", 4500);
  if (f.size > MAX_BACKUP_BYTES) return bad();
  let parsed: ReturnType<typeof parseBackup>;
  try { parsed = parseBackup(await f.text()); } catch { return bad(); }
  const n = Object.keys(parsed.keys).length;
  const kb = Math.max(1, Math.round(Object.values(parsed.keys).reduce((s, v) => s + v.length, 0) / 1024));
  const when = parsed.file.created ? parsed.file.created.slice(0, 16).replace("T", " ") : "-";
  const ok = await confirmDlg("导入备份？", `备份时间：${when}。共 ${n} 项数据，约 ${kb} KB。导入会覆盖本设备上同名的数据，不含登录令牌。`, "导入", true);
  if (!ok) return;   // cancelled: nothing changes and no "done" message (rule 8)
  const done = toast("正在导入备份…", 0, true);
  try {
    for (const [k, v] of Object.entries(parsed.keys)) localStorage.setItem(k, v);
  } catch { done(); return void toast("无法导入：本设备的存储空间不足。", 5000); }
  done();
  toast(`已导入 ${n} 项数据，正在重新载入…`, 2500);
  window.setTimeout(() => location.reload(), 1200);
}
