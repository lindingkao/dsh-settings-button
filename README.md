# dsh-settings-button

在 DeepSeekRuntime（DSH）Web UI 侧栏底部的账号头像右侧，常驻一个与用户栏同高的「设置」按钮，一点直达设置面板。

**Settings Button** — a persistent Settings button (gear + label, same height as the account row) at the right of the account avatar in the DSH sidebar foot. One click opens the Settings panel.

---

## 效果

<img src="docs/preview.png" width="360" alt="侧栏底部：账号头像右侧是齿轮 + 「设置」按钮">

- 按钮紧贴账号头像（用户栏）右侧，**高度与用户栏一致**，内容是齿轮 + 「设置」文案；
- 图标复用宿主自带的 `IconSettingsOutlineMedium`（与账号菜单里的设置项完全同一份矢量），`currentColor` 随主题着色；
- 点击直接打开设置面板：优先派发宿主自己登记的 `settings.open` 快捷键命令，直达 shell 的 `actions.open()`，不经过任何 DOM 交互；只有在命令不可用（宿主未注册、注册表被收紧）时才回退为短暂打开账号菜单并点其中的「设置」项，菜单在注入的 `dsh-sb-suppress-menu` 下不可见，视觉上设置面板仍然直接出现；
- 侧栏收成 56px 轨道时按钮自动隐藏，此时设置仍可从账号菜单进入；
- 宿主版本若**已经自带**设置触发按钮，则不注入第二个按钮，只把自带按钮排到行尾；
- 卸载插件即移除按钮、样式与临时类。

## 安装

从 GitHub 安装（推荐）：

```bash
dsh plugin --profile <profile> add github:lindingkao/dsh-settings-button
```

等价的完整写法：

```bash
dsh plugin --profile <profile> add https://github.com/lindingkao/dsh-settings-button.git
```

从本地目录安装（开发用）：

```bash
dsh plugin --profile <profile> add /path/to/dsh-settings-button
```

`dsh plugin ... add` 会把依赖写进 profile 的 `package.json`，并自动把声明了 `dsh.bundle` 的依赖加入 `dsh.profile.bundles`；装完重启或刷新页面即可。

> 注意：`dsh plugin ... install` 转发的是 pnpm 的 `install`（安装已有依赖），**不接受包名**，不要写成 `install <包>`；`lindingkao/dsh-settings-button` 这种裸 `owner/repo` 也不是有效目标，必须带 `github:` 前缀或写成完整 git URL。

本地目录安装时，profile 以 `link:`/`file:` 引用该目录，因此**不要删除或移动它**，否则插件会失效。

## 兼容性

打开设置的主路径是宿主自己登记的 `settings.open` 快捷键命令（由 `@deepseek-ai/dsh-client-ui-settings-general` 在 `sidebar.settings` 座位被注入时注册），插件经 `ctx.shortcuts.registry.invoke` 派发它；该命令不可用时自动回退到驱动账号菜单，按钮不会因此失效。

按钮定位只依赖当前 DSH 0.2.x 的两条界面事实：

- 侧栏脚部行是 CSS Modules 产物，类名以 `_triggerRow` 结尾；
- 账号菜单按钮的 `aria-label` 为「账号菜单」（回退路径）。

结构变化时定位失败，插件静默不做改动，不会破坏宿主界面。

## 实现要点

- 按钮**绝对定位**在脚部行右端，不参与 flex 排布；行上用 `padding-right` 预留按钮宽度，因此头像那栏自己收窄、不被覆盖，也不会反复重排。
- 文案取自 `settings` 命名空间的 `trigger` 键，与账号菜单里的设置项逐字一致，跟随界面语言。
- 派发命令前先读当前弹窗名（与宿主键盘派发同一套判定）：只有「没有弹窗」时才调用——该命令在 `modal === "settings"` 时执行的是**关闭**面板，误发会把用户刚打开的设置关掉。命令缺失或派发后 240ms 内面板仍未出现，才回退到菜单驱动。
- `MutationObserver` 合并 120ms 内的重渲染；只有尺寸真正变化时才写布局，避免抖动。
- 「宿主已自带设置按钮」的检测会排除本插件自己的按钮（它的文案同样是「设置」），避免删除-重建循环。

## License

MIT
