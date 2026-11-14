# 学习乐园：发布与上线手册（packaging）

这份手册告诉你，怎样把「学习乐园」发布到每一个目标：网站、Android、iOS、鸿蒙（HarmonyOS NEXT）。命令都可以直接复制。

> **先看这里：哪些已经做好，哪些没有测过**
>
> | 目标 | 状态 |
> |---|---|
> | 网站（GitHub Pages） | 已上线流程，每次推送自动发布（`.github/workflows/deploy.yml`）。 |
> | Android | 工程已生成（`android/`），CI 可以构建调试版 APK / 未签名或已签名 AAB（`.github/workflows/mobile.yml`）。**写手册的环境没有 Android SDK，从未真正编译或运行过，第一次在 CI 里跑可能要改小问题。** |
> | iOS | 工程已生成（`ios/`），CI 在 macOS 上为模拟器构建（无需 Apple 账号）。**写手册的环境没有 macOS / Xcode，从未编译过；Swift 打印插件（`ios/App/App/AppDelegate.swift` 末尾）第一次编译在 CI。** |
> | 鸿蒙 NEXT | 原生 ArkTS 工程骨架（`harmony/`），**从未在 DevEco Studio 里打开或编译过**；详见 `harmony/README.md`。 |
> | 商店 | 上架文字（`store-listing.md`）、隐私政策（`privacy-policy.md`）已写好；账号、证书、备案都要你本人办理。 |
>
> 凡是涉及法规、商店规则、价格的地方，都以各平台**当天的官方页面**为准；这里写的是撰写时的理解，可能已经变化。

目录

0. 开始之前：改应用 ID、名称、版本号
1. 网站：发布、回滚、版本号
2. 打包流程总览（本地命令与 CI）
3. Android：测试版 APK → 签名 → AAB → Google Play → 国内应用商店（含备案）
4. iOS：没有 Apple 账号时怎样在自己的 iPad 上用 → TestFlight / App Store
5. 鸿蒙 NEXT（原生）
6. 上架文字（见 `store-listing.md`）与隐私政策（见 `privacy-policy.md`）
7. 中国大陆的备案和资质
8. 发布前检查清单
9. 在真机上测试
10. 数据备份与导出

---

## 0. 开始之前：改应用 ID、名称、版本号

仓库里的占位应用 ID 是 `com.example.learningcenter`。**商店不接受 `com.example` 开头的 ID，而且一旦上传就永远不能改**，所以第一次上传之前必须改。

选一个你拥有的反向域名风格 ID，例如 `com.zhang.learningcenter`（只用小写字母、数字、下划线、点）。

```bash
cd LearningCenter
node scripts/set-app-id.mjs com.zhang.learningcenter
npm run cap:sync
```

这条命令一次改好：`capacitor.config.ts`、Android（`applicationId`、`namespace`、`MainActivity` 的包名和目录）、iOS（bundle id）、鸿蒙（`bundleName`）。改完请自己提交。

应用名称（桌面图标下面的字）是「学习乐园」，写在 `capacitor.config.ts` 的 `appName`、`android/app/src/main/res/values/strings.xml`、`ios/App/App/Info.plist`（`CFBundleDisplayName`）、`harmony/entry/src/main/resources/base/element/string.json`。要改名，四处一起改。

**版本号规则**（全平台同一套）：

| 名称 | 例子 | 谁决定 | 规则 |
|---|---|---|---|
| 版本名（给人看） | `1.2.0` | 你，用 git 标签 `v1.2.0` | 大改功能 +1 个中间数，只修错 +1 个末位数 |
| Android `versionCode` | `57` | CI 自动 | 等于 GitHub Actions 的运行序号，只增不减 |
| iOS `CFBundleVersion`（build） | `57` | 上传前设置 | 同一个版本名下每次上传必须增加 |
| 网站构建号 | `2026-11-14 10:30` | 构建时自动 | 显示在设置里的「版本」，也写在 `version.json` |

---

## 1. 网站：发布、回滚、版本号

### 1.1 它怎样发布

`.github/workflows/deploy.yml`：每次推送到 `main`（以及文件里列出的开发分支），GitHub Actions 会

1. 安装依赖（`npm ci`），
2. 运行 `npm run build`（先检查翻译，再 `tsc`，再 `vite build`），
3. 检查 `dist/version.json` 存在，
4. 把 `dist` 发布到 GitHub Pages：`https://<你的用户名>.github.io/LearningCenter/`。

数据不在这个公开仓库里：孩子的数据在你自己的**私有**数据仓库，网站只有代码。

首次开通（只做一次）：GitHub 仓库 → Settings → Pages → Build and deployment → Source 选 **GitHub Actions**。

### 1.2 本地先自检

```bash
npx tsc --noEmit && BASE_PATH=/ npx vite build
```

### 1.3 发布一个新版本

```bash
git checkout main
git pull
git merge <你的分支>          # 或者在 GitHub 上合并 Pull Request
git push origin main          # 推送即自动发布
git tag v1.2.0
git push origin v1.2.0        # 标签用来记录版本，也会触发 mobile.yml（见第 2 节）
```

在 GitHub 网页的 Actions 页面确认 `deploy` 变绿。已经打开的网页会在下次检查更新时看到新版本条（设置里也有「检查更新」）。

### 1.4 回滚

方法 A（最简单，推荐）：撤销有问题的提交，再推送。

```bash
git revert <有问题的提交号>      # 合并提交用：git revert -m 1 <提交号>
git push origin main
```

方法 B（马上恢复，不改历史）：在 GitHub → Actions → `deploy` → 找到**上一个正常**的运行 → 右上角 **Re-run all jobs**。重新运行使用的是那次运行当时的代码，所以网站会回到旧版本。之后再慢慢修代码。

方法 C（用户端）：如果有人一直看到旧版本，设置 → 「强制刷新（清除缓存）」不会退出登录。

回滚之后别忘了：已经发出去的 Android / iOS 应用里是**打包进去的旧代码**，不受网站回滚影响（网站只影响浏览器里用的人）。应用里的问题要出新版本。

---

## 2. 打包流程总览

应用的原生外壳用 **Capacitor**：同一份代码，用 `MOBILE=1`（相对路径、输出到 `dist-app`）构建，再放进 Android / iOS 工程。

### 2.1 本地命令

```bash
npm ci
npm run build:mobile      # 检查翻译 + tsc + MOBILE=1 vite build -> dist-app/
npm run cap:sync          # 先 build:mobile，再把 dist-app 复制进 android/ 和 ios/
npm run icons             # （只在改了 assets/icon/icon.svg 之后）重画网站图标
npm run icons:native      # （同上）重画 iOS / Android 图标和启动画面
npm run sync:harmony      # 把 dist-app 复制进 harmony/ 工程（第 5 节）
```

### 2.2 原生桥（`src/native.ts`）

网页放进 WebView 之后，有几件事浏览器自己能做、WebView 做不到，所以有一座「桥」。它只在原生壳里生效，普通网页完全不变。

| 功能 | 网页 | 原生壳 |
|---|---|---|
| 打印字帖、故事、证书 | `window.print()` | 系统打印窗口（可存为 PDF、分享、打印机）：Android `PrintManager`，iOS `UIPrintInteractionController`，鸿蒙 `print` |
| MIDI、DJ 录音、备份文件 | 下载链接 | 写入缓存目录，再打开系统分享面板（存到「文件」、AirDrop、微信……） |
| Android 返回键 | — | 先关对话框，再后退一步，在首页退出应用 |
| 相机（扫码、头像） | 浏览器询问 | Android `CAMERA` 权限、iOS `NSCameraUsageDescription`、鸿蒙 `ohos.permission.CAMERA` |
| 状态栏 | — | 浅色 |
| 朗读 | Web Speech API | 同左（用设备自带的声音；设备没装中文语音时可能没有声音） |

### 2.3 CI：`.github/workflows/mobile.yml`

**不会**在每次推送时运行（所以不会挡住网站发布）。两种启动方式：

```bash
# 手动，选要跑的任务：all / android / ios / webkit
gh workflow run mobile.yml -f jobs=android
gh run list --workflow=mobile.yml --limit 3
gh run download <运行号> -n learning-center-debug-apk -D out/

# 打版本标签（同时把调试版 APK 作为 GitHub 预发布附件）
git tag v1.2.0 && git push origin v1.2.0
```

三个任务：

| 任务 | 做什么 | 需要的机密 |
|---|---|---|
| `android` | JDK 21 + Android SDK，构建调试版 APK；再构建发布版 AAB / APK（有机密则签名，没有则**未签名**）；上传产物；打标签时把 APK 附在 GitHub 发布页 | 可选：`ANDROID_KEYSTORE_BASE64`、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS`、`ANDROID_KEY_PASSWORD` |
| `ios` | macOS 运行器，为**模拟器**构建（不签名，不需要 Apple 账号），在模拟器里安装、启动、等 15 秒、截图、确认应用没崩溃；上传 `.app` 压缩包 | 无 |
| `webkit` | 用 Playwright 的 WebKit（Safari 的内核）对生产构建跑一组快速冒烟检查（`scripts/webkit-smoke.cjs`） | 无 |

机密在 GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret 里添加（做法见 3.3）。**不要把密钥、证书、密码提交进仓库**（`.gitignore` 已经挡住常见的密钥文件）。

> 诚实说明：`mobile.yml` 写的时候没有地方可以运行它。第一次运行很可能因为版本号、路径或运行器镜像名需要微调。看失败日志，改一两行就行。

---

## 3. Android

### 3.1 测试版 APK（不需要任何账号）

1. GitHub → Actions → **mobile** → Run workflow → jobs 选 `android`（或 `all`）。
2. 跑完后在该次运行页面底部 Artifacts 下载 `learning-center-debug-apk`，解压得到 `app-debug.apk`。打标签 `v*` 的话，同一个 APK 还会出现在 Releases 页面（预发布）。
3. 装到手机或平板：

```bash
# 电脑上装了 adb、手机打开了 USB 调试：
adb install -r app-debug.apk
```

没有电脑：把 APK 发到手机（微信文件传输助手、网盘都行），点开安装；系统会要求允许「安装未知来源应用」，按提示允许。

调试版用的是调试签名，**不能**上架商店，只用来测试。

### 3.2 在自己的电脑上构建（可选）

需要 JDK 21 和 Android Studio（带 SDK）。

```bash
npm run cap:sync
cd android
./gradlew assembleDebug        # 输出 app/build/outputs/apk/debug/
```

### 3.3 签名密钥（上架前做一次，终身保管）

**这把钥匙丢了，就再也不能更新这个应用**（用 Google Play 应用签名可以补救一部分，见 3.4）。备份到至少两个地方（密码管理器 + 加密的 U 盘），不要放进仓库。

```bash
keytool -genkeypair -v -keystore learning-center-release.keystore \
  -alias learningcenter -keyalg RSA -keysize 4096 -validity 10000
```

按提示设置密码和信息。**记下**：密钥库密码、别名（`learningcenter`）、密钥密码。

把它变成 CI 机密（Linux / macOS）：

```bash
base64 -w0 learning-center-release.keystore > keystore.b64      # macOS：base64 -i learning-center-release.keystore -o keystore.b64
gh secret set ANDROID_KEYSTORE_BASE64 < keystore.b64
gh secret set ANDROID_KEYSTORE_PASSWORD
gh secret set ANDROID_KEY_ALIAS
gh secret set ANDROID_KEY_PASSWORD
rm keystore.b64
```

（每条 `gh secret set` 会让你输入值。）

之后 `mobile.yml` 构建的发布版 AAB / APK 就是已签名的。在自己电脑上构建时，把密钥库放在仓库外，建一个 `android/key.properties`（已被 `.gitignore` 忽略）：

```properties
storeFile=/绝对路径/learning-center-release.keystore
storePassword=…
keyAlias=learningcenter
keyPassword=…
```

```bash
cd android && ./gradlew bundleRelease assembleRelease
```

### 3.4 AAB 与 Google Play

1. 注册 Google Play 开发者账号（一次性费用约 25 美元，要实名认证；国内手机和银行卡可能要多试几次）：<https://play.google.com/console>。
2. 创建应用：名称、默认语言、免费、应用类型选「应用」。
3. 左侧「应用完整性 → 应用签名」：选择**使用 Play 应用签名**（推荐）。你上传的 AAB 用上传密钥（3.3 的钥匙）签名，Google 用自己保管的密钥发给用户。这样上传密钥丢失还能申请重置。
4. 把 CI 产出的**已签名** AAB（`learning-center-release-aab-signed` 产物里的 `.aab`）上传到「测试 → 内部测试」，先发给自己和几位朋友试用。
5. **新建的个人开发者账号**通常必须先做「封闭测试」：邀请至少 12 位测试者，连续测试 14 天，之后才能申请正式版（规则以 Play Console 当前提示为准）。
6. 填写「应用内容」里的各项声明（这些必须如实，见第 6 节）：
   - 隐私权政策：填托管后的隐私政策网址（见第 6 节）。
   - 数据安全：本应用自己不收集任何数据；若你使用 GitHub 同步，数据存放在用户自己的私有 GitHub 仓库，不是开发者。按 Play 的问法如实选择。
   - 内容分级（IARC 问卷）：按真实内容回答：没有暴力、没有内购、没有广告、没有用户之间的交流。
   - 目标受众：**按你的决定，本应用定位是家长和老师使用的教育工具，不放进「儿童 / 家庭」类别**。选择面向成人（18 岁以上）。请注意：应用里确实有孩子使用的游戏和学习内容；如果审核认为应用主要吸引儿童，Google 可能要求按「家庭政策」整改。文字上不要把应用说成「儿童应用」，同时也不要误导（见 `store-listing.md`）。
   - 广告：无。
7. 提交审核，通常几天内有结果。以后每次更新：打新标签 → 下载新的签名 AAB → 在 Play Console 创建新版本上传（`versionCode` 自动递增）。

### 3.5 国内主要 Android 应用商店

国内商店不用 Google Play 的 AAB，要的是**已签名的 APK**（`apk/release/*.apk`，同一把密钥签名；每个商店用同一把钥匙，以后更新才不会出问题）。

主要商店：华为应用市场（AppGallery）、小米应用商店、OPPO 软件商店、vivo 应用商店、荣耀应用市场、应用宝（腾讯）。每个都要自己注册开发者账号并实名认证。以下是共同要准备的东西：

| 材料 | 说明 |
|---|---|
| 开发者实名认证 | 个人（身份证）或企业（营业执照）。教育类应用，部分商店对个人开发者有限制，可能要求企业主体 |
| 软件著作权证书（软著） | 多数国内商店要求；自己或通过代理机构申请，周期几周到几个月 |
| 应用备案 | 见第 7 节：自 2023 年起，国内上架的 App 需要完成「移动互联网应用程序（App）备案」，由商店或云服务商协助提交 |
| 隐私政策网址 | 必须是能公开访问的网页；用 `privacy-policy.md` 的中文版 |
| 应用图标、截图、简介 | 图标：`assets/icon/icon-1024.png`；截图自己在真机上截；简介见 `store-listing.md` |
| 签名 | 同一个发布密钥签名的 APK；个别商店要求先做加固（各平台自行说明，通常可选） |
| 个人信息保护说明 | 应用不收集个人信息；相机仅用于扫码和头像，照片不上传。要如实填写权限用途 |

教育类还有一个特殊要求：面向学生的教育类 App 在国内需要向教育行政部门备案（见第 7 节），否则一些商店不给上架或随时下架。

提交的一般流程：注册 → 实名 → 创建应用（填包名，**要和 `applicationId` 一致**）→ 上传 APK → 填应用信息和隐私政策 → 上传软著、备案号 → 提交审核。各商店后台界面不同，名称相近，按页面提示填。

---

## 4. iOS

### 4.1 没有 Apple 账号：方法一（不需要 Mac）：添加到主屏幕

网站本身就是一个可以离线使用的网页应用（Service Worker 把全部文件缓存在设备上）。在 iPad / iPhone 上：

1. 用 **Safari** 打开 `https://<你的用户名>.github.io/LearningCenter/`（第一次需要联网，并等页面完全加载）。
2. 点底部或顶部的**分享**按钮 → **添加到主屏幕** → 添加。
3. 之后从主屏幕图标打开，像普通应用一样全屏运行，断网也能用。

限制：打印字帖要用 Safari 的打印窗口（每次都要重新选择纸张）；设备存储空间紧张时系统可能清理网站数据，所以请定期使用「设置 → 备份与恢复 → 导出备份」（第 10 节）。

### 4.2 没有 Apple 账号：方法二（需要一台 Mac）：用免费 Apple ID 装进自己的 iPad

条件：一台装了 **Xcode** 的 Mac（App Store 里免费下载，很大）、一根数据线、免费的 Apple ID。限制：用免费账号装的应用**每 7 天过期一次**（重新连线再运行一次即可），最多同时 3 个这类应用，不能上架。

```bash
npm ci
npm run cap:sync
npx cap open ios         # 在 Xcode 里打开 ios/App/App.xcodeproj
```

在 Xcode 里：

1. 左侧点最上面的蓝色 **App** 项目 → TARGETS 里选 **App** → **Signing & Capabilities**。
2. 勾选 *Automatically manage signing*，**Team** 选「你的名字（Personal Team）」（没有的话：Xcode → Settings → Accounts → 加号 → 登录你的 Apple ID）。
3. **Bundle Identifier** 必须全球唯一：用第 0 节改过的 ID；如果提示被占用，换一个，例如 `com.zhang.learningcenter.test`。
4. iPad 用数据线接 Mac，iPad 上点「信任此电脑」。iOS 16 以上：设置 → 隐私与安全性 → **开发者模式** → 打开 → 重启。
5. Xcode 顶部设备栏选你的 iPad，点 ▶ 运行。
6. 第一次打开会提示「不受信任的开发者」：iPad 设置 → 通用 → **VPN 与设备管理** → 点你的 Apple ID → 信任。
7. 7 天后应用打不开了：重新连线，在 Xcode 里再点 ▶ 即可，数据保留。

### 4.3 TestFlight / App Store（以后，需要付费账号）

需要 **Apple Developer Program**（每年 99 美元，国内约 688 元），个人或企业。要备案的话见第 7 节。

1. 加入计划：<https://developer.apple.com/programs/>。
2. 在 App Store Connect（<https://appstoreconnect.apple.com>）→ 我的 App → **新 App**：平台 iOS、名称、语言、套装 ID（选第 0 节的 ID）、SKU 随便取。
3. 在 Mac 上用 Xcode：Signing & Capabilities 选付费账号的 Team；设置版本号：

```bash
cd ios/App
xcrun agvtool new-marketing-version 1.2.0     # 对外的版本名
xcrun agvtool new-version -all 57             # build 号：每次上传必须比上一次大
```

4. Xcode 顶部设备选 **Any iOS Device (arm64)** → 菜单 **Product → Archive** → 完成后在 Organizer 点 **Distribute App → App Store Connect → Upload**。
5. 上传后在 App Store Connect 的 **TestFlight** 标签里等处理完成（几分钟到半小时），把自己加入「内部测试」，在 iPad 上装 TestFlight 应用，接收测试版。
6. 准备正式上架：
   - **App 隐私**（营养标签）：本应用自己不收集数据，选「不收集数据」。隐私政策网址填第 6 节托管的网址。
   - **年龄分级**：按真实内容回答问卷。
   - **类别**：主要类别选「教育」。**不要**选「儿童」类别（按你的决定；该类别有额外限制）。
   - 出口合规：`Info.plist` 已设置 `ITSAppUsesNonExemptEncryption = false`（只用系统的 HTTPS）。
   - 截图：6.9 英寸 iPhone 和 13 英寸 iPad 各几张（模拟器或真机截图）。
   - 描述文字：见 `store-listing.md`。
   - 审核备注：写明「家长和老师使用的学习记录工具；登录是可选的，选择「仅在本设备」即可使用全部功能，不需要账号」。**审核员没有你的 GitHub 令牌，所以一定要写这一句**，也可以在备注里写如何进入。
   - 相机用途文字已写入 `Info.plist`（扫码、头像）。
7. 点「提交以供审核」。通常 1–3 天出结果。

自动化（以后可选）：`mobile.yml` 目前只为模拟器构建。要在 CI 里上传 TestFlight，需要 App Store Connect API 密钥（`.p8`）、证书和描述文件，建议用 fastlane；这需要付费账号，所以现在没有做。

---

## 5. 鸿蒙 NEXT（原生）

你要的是**原生鸿蒙**，不是 Android 兼容。工程在 `harmony/`：ArkTS / ArkUI，一个 `Web`（ArkWeb）组件加载打包进应用的网页文件。**完整步骤、文件说明、测试清单都在 `harmony/README.md`。**这里只列要点：

```bash
npm run sync:harmony            # 构建 MOBILE=1 并复制到 harmony/entry/src/main/resources/rawfile
```

然后：

1. 注册华为开发者账号并实名认证：<https://developer.huawei.com/consumer/cn/>。
2. 安装 **DevEco Studio**（5.x 或更新），用它打开 `harmony/` 文件夹，等同步完成。
3. 改 `AppScope/app.json5` 里的 `bundleName`（第 0 节的脚本已经改好）。
4. 调试：File → Project Structure → Signing Configs → 勾选自动签名（需要登录华为账号）→ 连接真机或模拟器 → ▶ 运行。
5. 上架：在 AppGallery Connect（<https://developer.huawei.com/consumer/cn/service/josp/agc/index.html>）创建项目和应用，申请发布证书（`.cer`）和发布描述文件（`.p7b`），DevEco 里用发布签名构建 **APP** 包（不是 HAP），在 AppGallery Connect 上传、填写信息、提交审核。
6. 国内上架需要备案和资质（第 7 节）。
7. 鸿蒙没有 CI：手动按 `harmony/README.md` 的清单测试。

**没有验证的部分**：`harmony/` 里的 ArkTS 代码是照官方文档写的，没有在 DevEco Studio 里编译过；某些接口名或导入路径可能要按 IDE 的提示改。

---

## 6. 上架文字与隐私政策

- **上架文字**：`packaging/store-listing.md`（中文和英文：名称、副标题、简介、关键词、更新说明、分级和类别的说明）。
- **隐私政策**：`packaging/privacy-policy.md`（中文、英文、法文，可直接发布）。

隐私政策必须放在一个**公开的网址**上。最省事的办法：把它放进网站里。

```bash
cp packaging/privacy-policy.md public/privacy-policy.md       # 之后网址是 https://<用户名>.github.io/LearningCenter/privacy-policy.md
```

（Markdown 文件会被浏览器直接显示为文本，商店一般可以接受；想要排版好看，可以另外用 GitHub 仓库页面的网址，例如 `https://github.com/<用户名>/LearningCenter/blob/main/packaging/privacy-policy.md`。）把文件里标着「【请填写】」的联系方式改成你自己的。

**内容必须真实，不能误导**（这也是审核会看的）：

- 应用自己**不收集**任何数据，没有广告，没有统计，没有第三方 SDK；
- 数据只在两个地方：本设备，或者用户自己的私有 GitHub 仓库（用户自己填写令牌和仓库名）；
- 相机只用于扫描登录二维码和给孩子拍头像，照片不上传，不离开设备；
- 应用里有给孩子玩的游戏和学习内容，**但应用本身是给家长和老师用的记录工具**；年龄分级按真实内容填；
- 内容库（成语故事、科学卡片、古诗、地图等）是由模型根据记忆写成的，**还没有经过教师校对**，写进说明里更诚实（见 `store-listing.md` 里的「内容说明」一段）。

---

## 7. 中国大陆的备案和资质

> 我不是律师。下面是撰写时的理解；规则变化快，请以工业和信息化部、教育部、各商店当天的说明为准，必要时咨询商店客服。

| 事项 | 什么时候需要 | 怎么办 |
|---|---|---|
| **网站 ICP 备案** | 网站放在**中国大陆的服务器**上时。GitHub Pages 在境外，本身不需要 ICP 备案；但国内访问 GitHub Pages 可能不稳定 | 如果以后把网站迁到国内服务器，要在服务商处先备案 |
| **App 备案**（移动互联网应用程序备案） | 自 2023 年起，在中国大陆应用商店分发的 App 要完成备案，拿到备案号 | 通过你的**服务提供者**（云服务商或应用商店）提交，要主体信息（个人或企业）、应用名称、包名、签名证书指纹等；一般要 1–3 周。可以先向上架的商店咨询，多数商店有代办入口 |
| **iOS 在中国区上架** | Apple 也要求中国区 App 提供备案号 | 备案通过后，在 App Store Connect 的 App 信息里填写 |
| **软件著作权** | 多数国内安卓商店要求 | 中国版权保护中心申请，也可以委托代理机构 |
| **教育类 App 备案** | 面向学生的教育类 App，教育部规定要向省级教育行政部门备案（《教育移动互联网应用程序备案管理办法》） | 向所在省的教育厅 / 教育行政部门咨询备案平台；建议在上架前先确认，因为一些商店会要求提供 |
| **个人信息保护** | 只要涉及个人信息处理 | 本应用自己不收集，所以只需如实写隐私政策；《未成年人网络保护条例》对面向未成年人的服务有额外要求，请再读一遍 |
| **主体** | 个人开发者 vs 企业开发者 | 教育类 App 在部分商店只允许企业主体；个人主体可能无法上架，需要先问商店 |

---

## 8. 发布前检查清单

每次发布前逐项打勾：

- [ ] `npx tsc --noEmit && BASE_PATH=/ npx vite build` 通过
- [ ] `npm run check:i18n` 通过（英文、法文都有）
- [ ] 测试通过：`npm run test:e2e`（耗时较长）
- [ ] 应用 ID 已按第 0 节改成自己的（不是 `com.example…`）
- [ ] 版本名和版本号已更新（git 标签 `vX.Y.Z`）
- [ ] 网站：Actions 里 `deploy` 是绿色，打开网站检查「设置 → 版本」是新的
- [ ] `mobile` 工作流三个任务都是绿色
- [ ] 在真机上完成第 9 节的清单
- [ ] 隐私政策网址能公开打开，联系方式已填
- [ ] 上架文字没有夸大或误导（`store-listing.md`），分级和类别的回答与真实内容一致
- [ ] 截图是当前版本的
- [ ] 签名密钥已备份在两个地方，没有提交进仓库：`git log --all --stat | grep -i "keystore\|\.jks\|\.p12"` 应该没有输出
- [ ] 备案、软著、教育备案（国内商店）已确认
- [ ] 知道怎样回滚（第 1.4 节）

---

## 9. 在真机上测试

沙箱里没法测试的东西，必须在真机上试一遍。每项试一次，记下机型和系统版本。

| # | 检查 | Android | iPad / iPhone | 鸿蒙 |
|---|---|---|---|---|
| 1 | 应用能打开，图标和启动画面正确 | ☐ | ☐ | ☐ |
| 2 | 选「仅在本设备」，添加孩子，录入本周汉字 | ☐ | ☐ | ☐ |
| 3 | 登录页**扫码**：相机权限弹窗出现，扫到二维码能登录 | ☐ | ☐ | ☐ |
| 4 | 孩子头像：拍照 / 从相册选 | ☐ | ☐ | ☐ |
| 5 | **字帖 → 打印 / 保存为 PDF**：系统打印窗口出现，能存成 PDF，一页 A4，十个字 | ☐ | ☐ | ☐ |
| 6 | **故事打印**、**证书打印**：同上；检查 @media print 样式有没有生效（iOS 的 WebView 可能忽略部分样式，是重点） | ☐ | ☐ | ☐ |
| 7 | 音乐 → 钢琴录音 → 导出 MIDI：分享面板出现，能存到「文件」 | ☐ | ☐ | ☐ |
| 8 | DJ 打碟录音：停止后分享面板出现（iOS 的格式是 .m4a） | ☐ | ☐ | ☐ |
| 9 | 设置 → 导出备份：分享面板出现；再导入同一个文件，提示确认 | ☐ | ☐ | ☐ |
| 10 | **返回键 / 返回手势**：在孩子页面后退一步；在首页（学习乐园）再按一次退出应用；对话框打开时先关对话框 | ☐ | — | ☐ |
| 11 | 朗读（听写、单词、古诗、口诀）：有声音；没有中文语音时的表现 | ☐ | ☐ | ☐ |
| 12 | 横竖屏切换，布局居中，没有横向滚动条 | ☐ | ☐ | ☐ |
| 13 | 全屏按钮（钢琴、DJ、小游戏）：能全屏和退出 | ☐ | ☐ | ☐ |
| 14 | 多指触控：钢琴同时按几个键、DJ 两个唱盘同时搓 | ☐ | ☐ | ☐ |
| 15 | 飞行模式：重新打开应用，所有科目还能用；孩子的数据显示「没有网络：已保存在这台设备上」 | ☐ | ☐ | ☐ |
| 16 | 用 GitHub 登录：数据能读写；杀掉应用重开，数据还在 | ☐ | ☐ | ☐ |
| 17 | 手写汉字（写字）：手指和 Apple Pencil 的笔画判定是否太严或太松（容差是初步猜测，要用孩子试） | ☐ | ☐ | ☐ |
| 18 | 声音：钢琴、鼓、吉他、DJ 的延迟是否可接受 | ☐ | ☐ | ☐ |

**Android 真机调试页面**（看网页错误）：手机开 USB 调试，电脑 Chrome 打开 `chrome://inspect/#devices`。
**iOS**：iPad 设置 → Safari → 高级 → 打开「网页检查器」，Mac 的 Safari → 开发菜单 → 你的设备。
**鸿蒙**：`harmony/README.md` 里说明了怎样打开 `webDebuggingAccess`。

---

## 10. 数据备份与导出

数据分两类，备份方法不同：

| 数据 | 存在哪 | 备份方法 |
|---|---|---|
| 孩子、每周汉字、成语、各科学习记录、词库进度（选了 GitHub 的话） | 你自己的**私有 GitHub 仓库**（`kids.json`、`kids/<id>.json`、`idioms.json` 等） | GitHub 本身保留每次修改的历史；可以随时 `git clone` 整个数据仓库留一份；也可以在仓库的 Insights 里下载 ZIP |
| 孩子的数据（选了「仅在本设备」的话） | 本设备浏览器 / 应用的存储里 | **设置 → 备份与恢复 → 导出备份**（见下） |
| 只存在本设备上的东西：年级、游戏和数学设置、音乐录音、DJ 标记、编程作品、化学 / 物理 / 生物 / 地理进度、PK 对战记录、隐藏彩蛋开关等 | 本设备 | 同上：**导出备份** |

**导出备份**（设置 → 通用 → 备份与恢复）：

1. 点「导出备份」。网页：下载一个 `learning-center-backup-年月日-时分.json`；应用：弹出系统分享面板，选「存储到文件」或发给自己。
2. 文件里有本设备上全部的 `learn.*` 数据；**没有**登录令牌、管理密码、GitHub 数据的离线副本（这几样不会被导出，也不会被导入）。
3. 换设备或重装之后：打开同一个应用，点「导入备份」选择那个文件，先看预览（日期、项数），点「导入」确认，应用会重新加载。导入会覆盖本设备上同名的数据，取消则什么都不改。
4. 换设备后，GitHub 的登录要重新做（扫码或输入令牌），这是故意的：备份文件里没有令牌。

建议：每次大改动、每个学期结束、换设备前，各导出一次，文件放在网盘里。
