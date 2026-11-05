# 面板 API 速查

只列面板会用到的部分。完整类型由引擎写在插件目录的 `.claude-plugin/types/claude-code/index.d.ts`，随版本更新。本页按 Claude Code 2.1.317 的类型整理。

## 入口

```tsx
import { atom, read, update } from 'claude-code'
import type { Engine, Register } from 'claude-code'

export const register: Register = on => {
  on('session.start', async ($, e, next) => { /* … */ return next(e) })
  on('ui.render', { component: 'Pane', requestId: 'my-pane' }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    return <Box><Text>hi</Text></Box>
  })
}
```

- `h` 与 `Fragment` 是全局，不要导入，也不要自己写 `@jsx` pragma。
- 元素只能从 `$.ui.resolve(e)` 取，不能当全局用。
- `atom` 的 `plugin` 与 `key` 必须是源码里的字符串字面量，`claude plugin validate` 会检查。

## `$` 上可用的服务

| 服务 | 用途 |
|---|---|
| `$.ui` | 开面板、渲染、日志、提示、焦点、滚动 |
| `$.state` | 跨热重载的状态；渲染期 `get` 会自动订阅重绘 |
| `$.clock` | `now`、`sleep`、`after`、`every` |
| `$.fs` | `read`（4 MiB 上限）、`write`、`list`、`stat`、`exists` |
| `$.http` | `fetch(url, init)`，走宿主网络 |
| `$.process` | `run(argv, init)`、`spawn`，无 shell |
| `$.session` | 会话信息、`usage()`、`root()`、`compact()` |
| `$.agent` | `list()`、`spawn()` |
| `$.store` | 跨会话的键值存储 |
| `$.settings` | 只读设置快照 |
| `$.env` | 读环境变量（名字须字面量） |

## 开面板

```ts
await $.ui.open({
  id: 'my-pane',          // 1–64 位字母、数字、_、-
  title: '我的面板',
  backgroundColor: 'transparent', // 2.1.317 起支持
  focus: true,            // 请求焦点，不是保证
  closeOnEscape: true,
  rows: 20,               // inline 模式想要的高度
  columns: 60,            // dock 模式想要的宽度
})
```

- 自动打开要终端 ≥ 144 列；命令或按键触发则任何宽度都行。
- 同一 id 再 open 只换标题，不会开第二个。
- `$.ui.panes()` 查自己的面板状态；`$.ui.close({ id })` 关闭。

## 元素

| 元素 | 关键 props |
|---|---|
| `Box` | `flexDirection`、`gap`、`width/minWidth`、`padding`、`borderStyle`、`borderColor`、`backgroundColor`、`flexShrink`、`flexWrap`、`display` |
| `Text` | `dimColor`、`weight="bold"`、`color`、`wrap="wrap"`、`backgroundColor` |
| `Button` | `key`、`label`、`onPress`、`hotkey`（单个数字或小写字母）、`plain`、`dimColor`、`variant`、`autoFocus` |
| `Input` | `key`、`value`、`onInput`、`onSubmit` |
| `Select` | `key`、`options`、`value`、`onSelect` |
| `Raster` / `Image` | 像素或图片；只在部分 surface 可用 |
| `Client` | 带自己模块的交互区域 |

`Button.hotkey` 只在该面板持有键盘时生效。面板没焦点时，热键不响应。

## 渲染参数

- `e.viewport?.rows` / `e.viewport?.columns`：当前视口尺寸。
- `e.props.placement`：`dock` 或 `inline`。
- `e.surface`：`terminal`、`desktop`、`vscode`、`mobile`。元素表按它选择。

## 状态

```ts
const tick = atom({ plugin: 'my-plugin', key: 'tick' } as const, 0, { shape: 'tick-1' })
await update($, tick, n => n + 1)
const value = await read($, tick)
```

- `shape` 是格式版本。改了值的结构就换一个标签，旧值会被当作不存在。
- `read` 在 `ui.render` 里调用会自动订阅。
- `$.state.set` 在渲染期被拒绝。

## 会话用量

```ts
const usage = await $.session.usage()
usage.startedAt   // 毫秒时间戳
usage.context.percent
usage.cost?.usd
```
