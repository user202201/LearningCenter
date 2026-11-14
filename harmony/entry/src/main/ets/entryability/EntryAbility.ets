import { AbilityConstant, UIAbility, Want } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';
import { hilog } from '@kit.PerformanceAnalysisKit';

// The one ability of the app: it only opens the window and shows pages/Index (the ArkWeb page with the bundled web app).
// NOT compiled in the sandbox that wrote it (no DevEco Studio): see harmony/README.md.
export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    hilog.info(0x0000, 'LearningCenter', 'onCreate');
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        hilog.error(0x0000, 'LearningCenter', 'loadContent failed: %{public}s', JSON.stringify(err));
        return;
      }
    });
  }

  onDestroy(): void {
    hilog.info(0x0000, 'LearningCenter', 'onDestroy');
  }
}
