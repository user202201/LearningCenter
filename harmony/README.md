# 学习乐园：鸿蒙 NEXT 原生工程（harmony/）

ArkTS / ArkUI 原生工程：一个 `Web`（ArkWeb）组件，加载打包进应用的网页文件（`rawfile`），再加一座 JS 桥，提供打印、保存 / 分享文件、返回键。**不是** Android 兼容包。

> ## 诚实说明：这个工程从未被编译或运行过
> 写它的环境里没有 DevEco Studio，也没有鸿蒙 SDK / 模拟器。代码按 HarmonyOS NEXT（API 12）官方文档写成，但：
> - 导入路径、接口名（`@kit.ArkWeb`、`@kit.BasicServicesKit` 的 `print`、`@kit.ShareKit` 等）可能与你安装的 SDK 版本有出入，DevEco 会用红线标出，按提示改；
> - `onInterceptRequest` 用 `getRawFileContentSync` 从 rawfile 供给文件（让网页在 `https://learning.local/` 下运行，ES 模块和 `fetch` 才能工作），这条路径要在真机 / 模拟器上确认；
> - 约 360 个文件、26 MB 放进 rawfile，DevEco 是否接受要实测；
> - 打印、分享、相机权限、返回键、全屏 API 都**没有测过**。
> 下面的清单是手动测试清单（没有 CI）。

## 文件

| 文件 | 作用 |
|---|---|
| `AppScope/app.json5` | 包名 `bundleName`、版本、图标、名称 |
| `build-profile.json5` | 签名配置（只有注释里的占位，**密钥不要提交**）、目标 SDK 5.0.0(12) |
| `entry/src/main/module.json5` | 入口能力、权限（网络、相机）、设备类型（手机、平板、2in1） |
| `entry/src/main/ets/entryability/EntryAbility.ets` | 打开窗口，加载 `pages/Index` |
| `entry/src/main/ets/pages/Index.ets` | `Web` 组件；`onInterceptRequest` 从 rawfile 供给 `https://learning.local/…`；相机权限；返回键 |
| `entry/src/main/ets/bridge/NativeBridge.ets` | 注册为 `window.HarmonyBridge`：`printPage`（系统打印）、`saveFile`（写缓存目录 + 系统分享面板）、`exitApp` |
| `entry/src/main/resources/rawfile/` | 网页文件（由脚本复制进来，不提交） |

网页一侧的代码在 `src/native.ts`：发现 `window.HarmonyBridge` 就走鸿蒙分支。

## 步骤

### 1. 改包名（只做一次，上架前）

```bash
node scripts/set-app-id.mjs com.zhang.learningcenter
```

（它也会改 `harmony/AppScope/app.json5` 里的 `bundleName`。）

### 2. 复制网页文件

```bash
npm ci
npm run sync:harmony          # 构建 MOBILE=1 版本，复制到 harmony/entry/src/main/resources/rawfile
```

每次改了网页代码都要重新运行。

### 3. 用 DevEco Studio 打开

1. 安装 DevEco Studio（<https://developer.huawei.com/consumer/cn/deveco-studio/>，5.x 或更新）和 HarmonyOS NEXT SDK（API 12 或更新；按 IDE 的提示下载）。
2. File → Open → 选 `harmony/` 文件夹。等 Sync 完成（会下载 hvigor 依赖）。
3. 如果 SDK 版本不同，改 `build-profile.json5` 的 `compatibleSdkVersion`。

### 4. 调试运行（签名用自动签名，免费）

1. 注册华为开发者账号并实名认证：<https://developer.huawei.com/consumer/cn/>。
2. DevEco：File → Project Structure → Project → Signing Configs → 勾选 **Automatically generate signature**（登录华为账号）。IDE 会把签名信息写进 `build-profile.json5`（密码已加密）和 `harmony/signing/`。这些文件已被 `.gitignore` 忽略；**不要提交**。
3. 模拟器：Tools → Device Manager → New Emulator（选 Phone / Tablet 的 NEXT 镜像）。真机：打开开发者模式（设置 → 关于本机 → 连点版本号），USB 调试。
4. 选设备，点 ▶ Run 'entry'。

### 5. 打包发布版（上架 AppGallery）

1. AppGallery Connect：<https://developer.huawei.com/consumer/cn/service/josp/agc/index.html> → 我的项目 → 添加项目 → 添加应用（平台选 **HarmonyOS**，包名填 `bundleName`）。
2. 在 DevEco：Build → Generate Key and CSR，得到 `.p12`（私钥，**自己备份好**）和 `.csr`。
3. AppGallery Connect → 证书、App ID 和 Profile → 证书 → 新增证书，上传 `.csr`，下载 `.cer`；再在 Profile 里创建**发布**描述文件，下载 `.p7b`。
4. 把 `.p12`、`.cer`、`.p7b` 放进 `harmony/signing/`（被忽略，不提交），在 Signing Configs 里取消自动签名，填入这三个文件和密码。
5. 菜单 Build → Build Hap(s) / APP(s) → 选 **release** → 生成 `.app` 包（发布用 APP 包，不是 HAP）。
6. AppGallery Connect → 应用 → 版本信息 → 上传 `.app`，填写应用信息、隐私政策网址、截图、分级，提交审核。
7. 国内上架需要备案、资质：见 `packaging/README.md` 第 7 节。

### 6. 查看网页错误

`Index.ets` 里把 `setWebDebuggingAccess(false)` 改成 `true`，用 DevEco 的 Web 调试（或 `hdc` 端口转发后用电脑 Chrome 的 `chrome://inspect`）。发布前改回 `false`。

## 手动测试清单（鸿蒙真机和模拟器各做一遍）

- [ ] 应用打开，显示学习乐园选择页（不是白屏；白屏通常是 `onInterceptRequest` 没供到文件，看 hilog）
- [ ] 点 识字 → 添加孩子 → 录入汉字，杀掉应用重开，数据还在
- [ ] 登录页扫码：相机权限弹窗，扫码成功
- [ ] 字帖 → 打印 / 保存为 PDF：系统打印窗口出现，一页 A4
- [ ] 音乐 → 钢琴录音 → 导出 MIDI：分享面板出现
- [ ] 设置 → 导出备份：分享面板出现；导入同一文件，预览和确认
- [ ] 返回键：关对话框 → 后退一步 → 在首页退出应用
- [ ] 横竖屏、平板、折叠屏展开：布局居中
- [ ] 朗读（听写）有声音；没有中文语音时的表现
- [ ] 飞行模式下重开：各科目还能用
- [ ] 全屏按钮（钢琴、DJ、小游戏）

## 已知限制

- 没有 CI（没有现成的、能在 GitHub Actions 里跑 DevEco 构建的运行器）。
- 全屏 API 在 ArkWeb 里可能需要 `onFullScreenEnter` 处理，没有写。
- 文件选择（`<input type=file>`：Excel 导入、载入音乐、导入备份）依赖 ArkWeb 的默认选择器，没有测。
- 备案和资质见 `packaging/README.md`。
