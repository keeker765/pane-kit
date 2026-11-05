---
name: pane-kit
description: 用现成轮子做 Claude Code 终端面板（pane mod）。内置卡片、任务列表、带滚动条的长列表、页签、进度条、行宽计算，以及文件 / HTTP / 子进程三种轮询；另带一个命令行入口，一条命令导入清单、筛选条目、更新进度。触发：/pane-kit、做一个终端面板、加个进度看板、写个 pane mod、把状态显示在侧栏。
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
   - `app/view.tsx`：用 `kit.Card`、`kit.TaskList`、`kit.ScrollList`、`kit.Tabs`、`kit.Meter` 组版面。

   模板已经把 `ScrollList` 与 `ui.scroll` 接好：页面高度按 `e.viewport.rows - 9` 算，
   换页签回到顶部。只换数据就不用碰这两处。

3. 校验并打开：

   ```bash
   python <pane-kit>/scripts/verify.py <目录> --check-lines 60
   ```

   新会话自动打开面板；`/<插件名>` 随时重开。

## 用命令推进度

`scripts/push.py` 三段式：导入清单、筛选、写进度或直接打印一行进度。

```bash
python <pane-kit>/scripts/push.py --from tasks.md --file pane-data.json
python <pane-kit>/scripts/push.py --file pane-data.json --where state=todo --stats
python <pane-kit>/scripts/push.py --file pane-data.json \
    --section tasks --item t2 --state done --done 700 --total 1886 --ok 420 --eta 7800
```

`--stats` 只打印 `█████░░░░░ 50% 2/4  done 2 todo 2`，不写文件；`--where` 支持
`state=`、`label~`、`progress>=` 等。

## 不开面板也能看

```bash
python <pane-kit>/scripts/preview.py pane-data.json --rows 30 --columns 70
python <pane-kit>/scripts/preview.py pane-data.json --tree --collapsed m0,m1
```

按模板的版面把面板画成终端文字：页眉、页签、卡片、定高列表、滚动条、进度行。
`--tree` 按折叠树画。改版面前后各跑一次，能直接看出行数、对齐与滚动条格数对不对。

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
| 行宽计算、截断 | `kit/width.ts` |
| 长列表与滚动条 | `kit/scroll.tsx` |

## 参考

- `references/api-cheatsheet.md`：面板会用到的引擎 API。
- `references/layout.md`：卡片、列表、页签、折行的排版配方。
- `references/polling.md`：三种轮询与 JSON 契约。
- `references/pitfalls.md`：我们踩过的坑。
