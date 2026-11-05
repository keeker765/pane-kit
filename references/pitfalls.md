# 踩过的坑

按严重程度分级：🔴 会产生错误结果或白屏；⚠️ 已知边界；⭐ 可迁移的通则。

## 🔴 渲染期写状态

`ui.render` 里调用 `$.state.set` 会被拒绝，`update` 同样会失败。写状态只放在 `onPress`、`session.start` 和定时器回调里。渲染只读。

## 🔴 atom 的插件名必须是字面量

```ts
atom({ plugin: 'my-plugin', key: 'tick' } as const, 0)   // ✅
const PLUGIN = 'my-plugin'
atom({ plugin: PLUGIN, key: 'tick' } as const, 0)        // ❌ validate 拒绝
```

`claude plugin validate` 会读源码，常量传进去不算。生成器会替换字面量，不要改成常量。

## 🔴 改数据格式不换 shape

atom 存的值换了结构，但 `shape` 没换，热重载后旧值还在，解析立刻失败。改结构就换标签（`snap-1` → `snap-2`）。

## 🔴 半份 JSON

写方直接覆盖文件时，面板可能读到写了一半的内容。写方必须 `.tmp` + rename。面板侧解析失败时保留上一份好数据，不清空。

## ⚠️ 面板宽度门槛

自动打开的面板要终端至少 144 列；手动命令打开是 110 列。终端太窄时面板不显示，不是代码错了。用 `$.ui.panes()` 的 `isPlaced` 判断。

## ⚠️ 热键需要焦点

`Button.hotkey` 只在面板持有键盘时生效。面板默认不抢焦点，提示用户用鼠标点，或先按 `Ctrl+X` 再按 `Tab` 把焦点交给面板。

## ⚠️ 每个会话的 mod 确认

Claude 在会话里现写的 mod，引擎每会话问一次「Turn on the mods Claude writes in this session?」。选 Turn them on 后本会话不再问。装成 marketplace 插件或 skills-dir 插件则不弹。

## ⚠️ `CLAUDE_CODE_PLUGIN_DIRS` 不要用

语义含混，本机 11-03 已撤。用 `--plugin-dir` 或 marketplace。

## ⚠️ Pane 背景色

2.1.310 的 `PaneOpenArgs` 没有 `backgroundColor`；2.1.317 起有。传了不支持的值会被拒绝，面板照样打开。

## ⚠️ 子进程与 shell

`$.process.run` 按 argv 调起，没有 shell。管道、通配符、`&&` 都不解析，要包一层 `cmd /c` 或脚本。

## ⭐ 引擎类型随版本重写

`.claude-plugin/types/claude-code/index.d.ts` 每次加载由引擎重写，不要改，也不要提交。`check.py` 要排除这个目录。

## ⭐ 每秒重绘靠 tick

`clock.every(1000)` 只负责推进一个计数 atom；渲染读它才会重绘。不要在渲染里调用 `setInterval`（环境里也没有）。

## ⭐ 面板与状态栏同源

`$.session.usage()` 与状态栏读同一份数据。要做会话面板，优先用它，不要自己重算 token。
