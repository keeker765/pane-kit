---
name: pane-kit
description: 用现成轮子做 Claude Code 终端面板（pane mod）。内置卡片、任务列表、页签、进度条，以及文件 / HTTP / 子进程三种轮询。触发：/pane-kit、做一个终端面板、加个进度看板、写个 pane mod、把状态显示在侧栏。
---

# pane-kit

做一个终端面板，只改两个文件：`app/data.ts`（数据从哪来）和 `app/view.tsx`（怎么排版）。其余由 kit 提供。

## 三步

1. 生成工程：

   ```bash
   python <pane-kit>/scripts/new.py --name my-board --dest <目录>
   ```

2. 改两个文件：

   - `app/data.ts`：选数据源。`file`、`http`、`process`、`custom` 四种。
   - `app/view.tsx`：用 `kit.Card`、`kit.TaskList`、`kit.Tabs`、`kit.Meter` 组版面。

3. 校验并打开：

   ```bash
   python <pane-kit>/scripts/verify.py <目录>
   ```

   新会话自动打开面板；`/<插件名>` 随时重开。

## 必须知道的四条

- `ui.render` 里只读，不写 atom。写操作放 `onPress`、定时器或 `session.start`。
- 数据写方先写 `.tmp` 再 rename。面板可能读到半份文件。
- 改 atom 里存的数据格式时换 `shape` 标签，否则重载后解析旧值会失败。
- 自动打开的面板要终端至少 144 列；`/命令` 打开则任何宽度都行。

## 文件地图

| 想改什么 | 改哪里 |
|---|---|
| 数据源、轮询间隔 | `app/data.ts` |
| 页签、卡片、任务行 | `app/view.tsx` |
| 面板标题、命令名 | `hooks/register.tsx` 顶部常量 |
| 组件样式 | `kit/` |
| 数据形状 | `kit/model.ts` 的 `PaneSnapshot` |

## 参考

- `references/api-cheatsheet.md`：面板会用到的引擎 API。
- `references/layout.md`：卡片、列表、页签、折行的排版配方。
- `references/polling.md`：三种轮询与 JSON 契约。
- `references/pitfalls.md`：我们踩过的坑。
