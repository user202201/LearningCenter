import { webview } from '@kit.ArkWeb';
import { print } from '@kit.BasicServicesKit';
import { common } from '@kit.AbilityKit';
import { fileIo as fs } from '@kit.CoreFileKit';
import { systemShare } from '@kit.ShareKit';
import { uniformTypeDescriptor as utd } from '@kit.ArkData';
import { util } from '@kit.ArkTS';
import { hilog } from '@kit.PerformanceAnalysisKit';

/**
 * The object the web page sees as `window.HarmonyBridge` (registered with javaScriptProxy in pages/Index.ets).
 * src/native.ts calls it: printPage / saveFile / exitApp. Methods are synchronous for the page and return a short string
 * ("ok" or "error: ..."); the dialogs they open (print, share) are shown by the system.
 * NOT compiled in the sandbox that wrote it (no DevEco Studio, no HarmonyOS SDK): API names follow the HarmonyOS NEXT documentation
 * (API 12); fix the imports DevEco underlines, see harmony/README.md.
 */
export class NativeBridge {
  private controller: webview.WebviewController;
  private context: common.UIAbilityContext;

  constructor(controller: webview.WebviewController, context: common.UIAbilityContext) {
    this.controller = controller;
    this.context = context;
  }

  /** window.print() replacement: the system print dialog of the current page (Save as PDF, share, printers) */
  printPage(jobName: string): string {
    try {
      const adapter = this.controller.createWebPrintDocumentAdapter(jobName || 'LearningCenter');
      const attrs: print.PrintAttributes = { copyNumber: 1, pageRange: { startPage: 0, endPage: 0 } };
      print.print(jobName || 'LearningCenter', adapter, attrs, this.context)
        .catch((e: Error) => hilog.error(0x0000, 'LearningCenter', 'print failed: %{public}s', String(e)));
      return 'ok';
    } catch (e) {
      return 'error: ' + String(e);
    }
  }

  /** a file for the person: written to the cache folder, then the share panel opens (Save to Files, send to ...) */
  saveFile(name: string, mime: string, base64: string): string {
    try {
      const safe = name.replace(/[\\/:*?"<>|]/g, '_');
      const path = this.context.cacheDir + '/' + safe;
      const bytes = new util.Base64Helper().decodeSync(base64);
      const file = fs.openSync(path, fs.OpenMode.READ_WRITE | fs.OpenMode.CREATE | fs.OpenMode.TRUNC);
      fs.writeSync(file.fd, bytes.buffer);
      fs.closeSync(file);
      const data = new systemShare.SharedData({
        utd: utd.getUniformDataTypeByFilenameExtension('.' + (safe.split('.').pop() ?? 'bin'), utd.UniformDataType.FILE),
        uri: 'file://' + path.replace(/^\//, '/'),
        title: safe
      });
      const controller = new systemShare.ShareController(data);
      controller.show(this.context, { selectionMode: systemShare.SelectionMode.SINGLE, previewMode: systemShare.SharePreviewMode.DETAIL });
      return 'ok';
    } catch (e) {
      return 'error: ' + String(e);
    }
  }

  /** the back key at the home screen of the web app: leave the app */
  exitApp(): string {
    this.context.terminateSelf();
    return 'ok';
  }
}
