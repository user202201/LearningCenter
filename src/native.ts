/**
 * The bridge to the native shell (iOS / Android, Capacitor; CLAUDE.md rule 67). On the web (and in every browser test) NOTHING here changes behaviour:
 * `isNative()` is false and every function falls back to what the page always did (window.print, an <a download> link).
 *
 * Why it exists: a WebView cannot do what a browser does by itself, namely
 *   - window.print()            -> printPage(): native print dialog (Android PrintManager / iOS UIPrintInteractionController: "Save as PDF", share, printers)
 *   - <a download> of a Blob    -> saveFile(): the file goes to the app's cache folder and then to the system share sheet ("Save to Files", AirDrop, WeChat ...)
 *   - the Android back key      -> initNative(): back = one step back in the hash router, at the home screen the app is left
 *   - orientation lock          -> lockOrientation(): screen.orientation.lock where the WebView allows it
 * Plugins are loaded lazily (dynamic import, only on a native platform), so the web bundle does not grow.
 * The code that cannot run here (no Xcode, no Android SDK) is marked in packaging/README.md.
 */

interface CapGlobal { isNativePlatform?: () => boolean; getPlatform?: () => string }
/** the HarmonyOS NEXT shell (harmony/, ArkWeb) hands the page this object (javaScriptProxy): every method returns "ok" or "error: ..." */
interface HarmonyGlobal { printPage(name: string): string; saveFile(name: string, mime: string, base64: string): string; exitApp(): string }
const cap = (): CapGlobal | undefined => (window as unknown as { Capacitor?: CapGlobal }).Capacitor;
const harmony = (): HarmonyGlobal | undefined => { try { return (window as unknown as { HarmonyBridge?: HarmonyGlobal }).HarmonyBridge; } catch { return undefined; } };

/** true only inside the iOS / Android app (Capacitor injects window.Capacitor before the page loads) */
export const isCapacitor = (): boolean => { try { return !!cap()?.isNativePlatform?.(); } catch { return false; } };
export const isHarmony = (): boolean => typeof harmony()?.printPage === "function";
/** inside any native shell (iOS, Android, HarmonyOS) */
export const isNative = (): boolean => isCapacitor() || isHarmony();
export const platform = (): "ios" | "android" | "harmony" | "web" => {
  if (isHarmony()) return "harmony";
  try { const p = cap()?.getPlatform?.(); return p === "ios" || p === "android" ? p : "web"; } catch { return "web"; }
};

export type SaveResult = "shared" | "downloaded" | "cancelled" | "error";

/** Prints the page that is shown (the practice sheet, the story sheets, the certificate: their @media print rules decide what comes out). */
export async function printPage(name = "学习乐园"): Promise<void> {
  if (isHarmony()) { harmony()?.printPage(name); return; }
  if (isCapacitor()) {
    try {
      const { registerPlugin } = await import("@capacitor/core");
      const P = registerPlugin<{ print(o: { name: string }): Promise<void> }>("PrintPage");
      await P.print({ name });
      return;
    } catch { /* the native print plugin is missing (older shell): the browser call below does nothing on iOS, but costs nothing */ }
  }
  window.print();
}

const toBase64 = (bytes: Uint8Array): string => {
  let s = ""; const n = 0x8000;
  for (let i = 0; i < bytes.length; i += n) s += String.fromCharCode(...bytes.subarray(i, i + n));
  return btoa(s);
};

/** Gives the person a file: a download on the web, the system share sheet in the app. */
export async function saveFile(data: Uint8Array | Blob, filename: string, mime = "application/octet-stream"): Promise<SaveResult> {
  const bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data;
  if (isHarmony()) {
    try { return harmony()!.saveFile(filename, mime, toBase64(bytes)) === "ok" ? "shared" : "error"; } catch { return "error"; }
  }
  if (isCapacitor()) {
    try {
      const [{ Filesystem, Directory }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
      const w = await Filesystem.writeFile({ path: filename, data: toBase64(bytes), directory: Directory.Cache, recursive: true });
      try {
        await Share.share({ title: filename, url: w.uri, dialogTitle: filename });
        return "shared";
      } catch (e) {
        // closing the share sheet without choosing anything is not an error
        return /cancel/i.test(String((e as Error)?.message ?? e)) ? "cancelled" : "error";
      }
    } catch { return "error"; }
  }
  try {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.append(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    return "downloaded";
  } catch { return "error"; }
}

/** Orientation lock (works in a WebView only for a full-screen page; errors are ignored: it is a convenience). */
export async function lockOrientation(mode: "portrait" | "landscape" | "any" = "any"): Promise<boolean> {
  try {
    const o = screen.orientation as ScreenOrientation & { lock?: (m: string) => Promise<void> };
    if (mode === "any") { o.unlock?.(); return true; }
    await o.lock?.(mode);
    return !!o.lock;
  } catch { return false; }
}

/** the Android back key with the hash router: close an open dialog, else one step back, else (at the picker) leave the app */
export function backStep(deps: { exit: () => void }): void {
  const dlg = [...document.querySelectorAll("dialog[open]")].pop() as HTMLDialogElement | undefined;
  if (dlg) { dlg.dispatchEvent(new Event("cancel")); dlg.close(); return; }
  const at = location.hash.replace(/^#\/?/, "");
  if (at === "" || history.length <= 1) return deps.exit();
  history.back();
}

let started = false;
/** Called once at start (main.ts). Does nothing on the web. */
export async function initNative(): Promise<void> {
  if (started || !isNative()) return;
  started = true;
  document.documentElement.classList.add("native", `native-${platform()}`);
  if (isHarmony()) {   // the shell's back key asks the page what to do (Index.ets onBackPress)
    (window as unknown as { __nativeBack?: () => void }).__nativeBack = () => backStep({ exit: () => void harmony()?.exitApp() });
    return;
  }
  try {
    const { App } = await import("@capacitor/app");
    await App.addListener("backButton", () => backStep({ exit: () => void App.exitApp() }));
  } catch { /* no app plugin: the system default (leave the app) stays */ }
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Light });
  } catch { /* iOS has no status bar plugin work to do here */ }
}
