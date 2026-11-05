# 配方

每个配方是一对文件，覆盖生成工程里的 `app/data.ts` 与 `app/view.tsx`。

| 配方 | 数据源 | 用到的轮子 |
|---|---|---|
| json-board | 文件轮询 | Tabs、Card、TaskList |
| http-board | HTTP 轮询 | Tabs、Card、TaskList |
| session-hud | 引擎会话数据 | StatTile、Card、Meter |

生成并校验全部示例：

```bash
python scripts/make_examples.py
```

产物在 `build/examples/`，不提交。
