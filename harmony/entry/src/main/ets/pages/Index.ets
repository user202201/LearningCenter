import { webview } from '@kit.ArkWeb';
import { common, abilityAccessCtrl, Permissions } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { NativeBridge } from '../bridge/NativeBridge';

// The whole app is ONE ArkWeb component. The web build (MOBILE=1, copied into resources/rawfile by scripts/sync-harmony.mjs) is not loaded as file://
// (module scripts and fetch do not work there) but under a made-up https host that this page answers itself from the rawfile folder
// (onInterceptRequest), like the Android WebViewAssetLoader. Everything else (api.github.com) goes to the network as usual.
// NOT compiled in the sandbox that wrote it (no DevEco Studio): see harmony/README.md.
const HOST = 'learning.local';
const START = 'https://' + HOST + '/index.html';

const MIME: Record<string, string> = {
  html: 'text/html', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', json: 'application/json', webmanifest: 'application/manifest+json',
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', woff2: 'font/woff2', woff: 'font/woff',
  txt: 'text/plain', wasm: 'application/wasm', ico: 'image/x-icon', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav'
};

@Entry
@Component
struct Index {
  controller: webview.WebviewController = new webview.WebviewController();
  private context: common.UIAbilityContext = getContext(this) as common.UIAbilityContext;
  private bridge: NativeBridge = new NativeBridge(this.controller, this.context);

  aboutToAppear(): void {
    webview.WebviewController.setWebDebuggingAccess(false);   // set to true while testing: chrome://inspect shows the page
  }

  /** the file behind a request of the virtual host, or null when it is not ours */
  private answer(url: string): WebResourceResponse | null {
    let path = '';
    try {
      const u = new URL(url);
      if (u.hostname !== HOST) return null;
      path = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
    } catch (e) {
      return null;
    }
    const res = new WebResourceResponse();
    try {
      const bytes = this.context.resourceManager.getRawFileContentSync(path);
      const ext = (path.split('.').pop() ?? '').toLowerCase();
      res.setResponseData(bytes.buffer);
      res.setResponseMimeType(MIME[ext] ?? 'application/octet-stream');
      res.setResponseEncoding(ext === 'png' || ext === 'jpg' || ext === 'webp' || ext === 'woff2' ? '' : 'utf-8');
      res.setResponseCode(200);
      res.setReasonMessage('OK');
    } catch (e) {
      res.setResponseData('');
      res.setResponseCode(404);
      res.setReasonMessage('Not Found');
      res.setResponseMimeType('text/plain');
    }
    return res;
  }

  /** the camera is asked for when the page opens it (sign-in QR code, a child's photo) */
  private async askCamera(event: OnPermissionRequestEvent | undefined): Promise<void> {
    if (!event) return;
    try {
      const mgr = abilityAccessCtrl.createAtManager();
      const perms: Permissions[] = ['ohos.permission.CAMERA'];
      const r = await mgr.requestPermissionsFromUser(this.context, perms);
      if (r.authResults[0] === 0) event.request.grant(event.request.getAccessibleResource());
      else event.request.deny();
    } catch (e) {
      event.request.deny();
    }
  }

  build() {
    Column() {
      Web({ src: START, controller: this.controller })
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .fileAccess(false)
        .mixedMode(MixedMode.None)
        .databaseAccess(true)
        .overScrollMode(OverScrollMode.NEVER)
        .javaScriptProxy({
          object: this.bridge,
          name: 'HarmonyBridge',
          methodList: ['printPage', 'saveFile', 'exitApp'],
          controller: this.controller
        })
        .onInterceptRequest((event) => {
          if (!event) return null;
          return this.answer(event.request.getRequestUrl());
        })
        .onPermissionRequest((event) => {
          void this.askCamera(event);
        })
        .onErrorReceive((event) => {
          hilog.error(0x0000, 'LearningCenter', 'web error: %{public}s', event?.error.getErrorInfo());
        })
    }
    .width('100%')
    .height('100%')
  }

  /** the back key: the web app decides (close a dialog, one step back, or leave at the home screen: src/native.ts `__nativeBack`) */
  onBackPress(): boolean | void {
    this.controller.runJavaScript('window.__nativeBack && window.__nativeBack()').catch(() => this.bridge.exitApp());
    return true;
  }
}
