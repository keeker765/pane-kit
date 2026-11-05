# 排版配方

面板的视觉规范沿用 11-03 定下的四级格式。新增面板照这里写，不再另立风格。

## 四级格式

1. **一级区块**：`■ 标题` 粗体，上方留一行。
2. **二级卡片**：圆角边框，粗体名字 + 灰字说明 + 进度条 + 内容。
3. **三级任务**：`符号 标签`，一行一条。
4. **四级备注**：下一行灰字 `└ 备注`，接在悬挂缩进的正文下面。

## 状态与配色

| 状态 | 符号 | 主题色 |
|---|---|---|
| 完成 | `✓` | `success` |
| 进行中 | `▶` | `warning` |
| 卡住 | `⏸` | `error` |
| 未开始 | `·` | `inactive` |

符号与颜色只在 `kit/model.ts` 的 `TONE_MARK` 与 `TONE_COLOR` 定义一次。整行同色，已完成的文字不再另外变暗。

## 卡片

```tsx
<kit.Card title="任务" subtitle="3 / 8 完成">
  <kit.Meter done={3} total={8} width={12} />
  <kit.TaskList items={rows} max={15} />
</kit.Card>
```

- 卡片一行一张、整宽。用户 11-03 明确否决两列网格。
- 边框固定 `borderStyle="round"`、`borderColor="gray"`。
- 卡片之间留一行，靠 `marginTop`。

## 任务行

- 未完成的全显示，已完成的只留最近若干条。
- 排序：进行中 → 卡住 → 待做 → 完成。
- 带前缀的行必须悬挂缩进：前缀放 `flexShrink={0}`，正文放 `flexShrink={1}` 加 `wrap="wrap"`。续行才会对齐正文开头。
- 长标签交给 `Text wrap`，不要在代码里自己截断。

## 页签

```tsx
<kit.Tabs pages={pages} active={active} onPick={onTab} />
```

- 页签用 `Button` 画，`plain` 去掉边框，首个页签配数字热键 `1`、`2`……
- 热键只在面板持有键盘时生效。面板没焦点时用鼠标点。
- 多个页签也是多个面板时，引擎自己会把它们排成 tabs；本套件的 `Tabs` 是面板内部的页签。

## 宽度与折行

- 自动打开需要终端 ≥ 144 列；窄于 110 列时面板会停靠或等待。
- 用 `e.viewport?.rows` 限制列表条数，用 `e.props.placement` 区分停靠与行内。
- 进度条宽度夹在 6–24 格。卡宽未知时用固定 12 格。
- 任何 `Box` 里放长文本，都要设 `flexShrink={1}` 与 `Text wrap="wrap"`。

### 行长告警

折行交给 `Text wrap`；**发现**某行过长用 `kit/width.ts`：

- `displayWidth(text)`：东亚宽字符按 2 格算，与终端一致。
- `clipToWidth(text, cells)`：按格子截断并补省略号，不会切断半个宽字符。
- 静态检查：`python scripts/verify.py <工程> --check-lines 60`，扫描 `app/` 下超宽的中文字符串并逐条列出。只告警，不算失败。

## 滚动列表

内容比面板高时用 `kit.ScrollList`，不要自己算行数：

```tsx
<kit.ScrollList items={rows} rows={bodyRows} offset={scroll.offset} columns={48} />
```

它只显示 `offset` 起的一段并画右侧滚动条（拇指 `█`、轨道 `│`）。**列表自己接管滚动**，
所以接线处要挂 `ui.scroll` 且不调 `next`：

```ts
on('ui.scroll', { requestId: PANE }, async ($, e) => {
  const now = await read($, scroll)
  await update($, scroll, () => moveScroll(now, e.by, e.bodyRows, e.contentRows))
  return {}
})
```

⚠ 让引擎自己滚、只在旁边画拇指的做法做不到：拇指随内容滚走，看不到。要常驻的滚动条必须接管。

传了 `onSeek` 时滚动条每格都是 `Button`：**鼠标点哪格就跳到哪**。不传则只显示。
拖动需要 `Client` 元素与一个独立的绘制面模块，比这个重得多，暂不提供。

## 可折叠的计划树

```tsx
<kit.Tree items={rows} collapsed={closed} onToggle={id => toggle(id)} columns={40} />
```

- 层级由每条自己的 `depth` 表达：下一行比自己深，就是自己的子节点。不再单独写父子表。
- 有子节点的行画 `▾`/`▸` 且整行是 `Button`，能点也能用键盘激活；叶子行只是文字。
- `collapsed` 是已收起的 id 数组，由调用方存在 atom 里；`onToggle` 里写它。
- 收起的节点，其后代整段不画，数据一条都不删。

## 页眉

页眉一行：`head` + 轮询状态 + 数据年龄。不要堆标题、副标题、时间三行，占高度。

```tsx
<kit.Box flexDirection="row">
  <kit.Text weight="bold">{data.head ?? '面板'}</kit.Text>
  <kit.Text dimColor>{statusLine(poll)}</kit.Text>
</kit.Box>
```
