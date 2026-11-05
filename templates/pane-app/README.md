# pane-app

用 pane-kit 生成的面板插件。

## 下一步

1. 复制 `pane-data.example.json` 到你的工作目录，改名 `pane-data.json`。
2. 改 `app/data.ts`：换数据源（file / http / process / custom）。
3. 改 `app/view.tsx`：用 `kit.Card`、`kit.TaskList`、`kit.Tabs`、`kit.Meter` 排版。
4. 跑 `python <pane-kit>/scripts/verify.py .`。
5. 新会话里面板自动打开；输入 `/pane-app` 重开。

## 文件

- `hooks/register.tsx`：接线、atom、轮询。只在换方案时改。
- `app/data.ts`：数据从哪来。
- `app/view.tsx`：怎么排版。
- `kit/`：轮子，不要改；要改就改 pane-kit 仓库再重新生成。
