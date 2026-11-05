# pane-kit

Claude Code 终端面板（pane mod）的脚手架与组件库。复制模板后只改两个文件，就能得到一个带卡片、任务列表、页签、进度条和轮询的面板。

## 它给你什么

- **模板**：`templates/pane-app/` 是一份能运行的面板插件。`scripts/new.py` 把它和 `kit/` 复制到目标目录。
- **轮子**：`kit/` 里是卡片、指标块、任务列表、页签、进度条、格式化函数和三种轮询器。
- **契约**：数据统一成 `PaneSnapshot`。写方按它产出 JSON，面板按它渲染。
- **校验**：`scripts/verify.py` 跑 manifest 校验、结构闸和可选的插件测试。

## 快速开始

```bash
python scripts/new.py --name my-board --dest D:/py_projects/my-board
cd D:/py_projects/my-board
# 改 app/data.ts（数据从哪来）和 app/view.tsx（怎么排版）
python D:/py_projects/pane-kit/scripts/verify.py .
```

新会话里面板随 `session.start` 自动打开，也可以输入 `/my-board` 重开。

## 仓库结构

```
pane-kit/
├── SKILL.md                  # skill 入口与三步走
├── kit/                      # 轮子（复制进每个面板）
│   ├── model.ts              # 数据契约 + 纯格式化
│   ├── surface.tsx           # createKit：绑定当前绘制面
│   ├── cards.tsx             # 卡片、指标块
│   ├── tasks.tsx             # 任务列表
│   ├── tabs.tsx              # 页签
│   ├── bars.tsx              # 进度条
│   └── poll.ts               # 文件 / HTTP / 子进程轮询
├── templates/pane-app/       # 可运行的面板模板
├── examples/recipes/         # 三个数据源配方
├── scripts/                  # 生成、校验、示例构建
└── references/               # API 速查、排版、轮询、坑
```

## 数据契约

```json
{
  "head": "当前在做的事",
  "sections": [
    {
      "id": "tasks",
      "title": "任务",
      "items": [
        { "id": "t1", "label": "跑测试", "state": "doing", "progress": 40, "note": "第 2 轮" }
      ]
    }
  ]
}
```

`state` 取 `done` / `doing` / `blocked` / `todo`。`progress` 取 0–100。写方先写 `.tmp` 再 rename，面板每轮读整份文件。

## 安装方式

- **本会话热载**：把插件目录放到 `~/.claude/dev-mods/<会话 id>/`，引擎弹一次「Turn on the mods」，选 Turn them on。
- **指定启动**：`claude --plugin-dir <插件目录>`。
- **常驻**：发布到 marketplace 后 `/plugin install`。

不要用 `CLAUDE_CODE_PLUGIN_DIRS`。

## 许可

MIT
