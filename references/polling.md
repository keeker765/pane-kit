# 轮询

三种数据源共用一个轮询器：`kit/poll.ts` 的 `createPoller`。它负责间隔、退避、超时和状态回调，业务只提供取数函数。

## 三种内置源

```ts
// 文件：另一个进程或 agent 写 JSON，面板每轮读整份
export function createSource(_engine: Engine): DataSource {
  return { kind: 'file', path: 'pane-data.json' }
}

// HTTP：经过宿主网络
export function createSource(_engine: Engine): DataSource {
  return { kind: 'http', url: 'http://127.0.0.1:8787/board' }
}

// 子进程：无 shell，按 argv 调起一次
export function createSource(_engine: Engine): DataSource {
  return { kind: 'process', argv: ['python', 'scripts/board.py'] }
}

// 自定义：直接读引擎数据；`$` 留在闭包里
export function createSource(engine: Engine): DataSource {
  return {
    kind: 'custom',
    load: async () => ({ head: '会话', sections: [] }),
  }
}
```

`$` 是引擎的，不作为值传递：工厂接收 `$`，返回的对象里只放引用它的闭包。把 `$` 塞进对象字面量会被 `claude plugin validate` 拒绝。

## 周期与退避

- 默认间隔 3000 ms，可传 `intervalMs`。
- 失败后指数退避：2 秒、4 秒、8 秒，封顶 60 秒；成功一次就复位。
- 每次失败写 `PollStatus`：`stale` 保留上一次的数据，`error` 带错误文本。
- 面板不清空旧数据。失败只把区块标灰，保留最后一份好数据。

## JSON 契约

```json
{
  "updated": 1762300000000,
  "head": "正在跑测试",
  "sections": [
    {
      "id": "tasks",
      "title": "任务",
      "items": [
        { "id": "t1", "label": "跑测试", "state": "doing", "progress": 40, "note": "第 2 轮", "ts": 1762299990000 }
      ]
    }
  ]
}
```

- `id` 必须稳定；重绘靠它对回同一行。
- `state` 取 `done`、`doing`、`blocked`、`todo`；省略按 `todo`。
- `progress` 取 0–100；省略只画状态符号。
- `updated` 与 `ts` 是毫秒时间戳。

## 写方规则

写方可以是脚本、后端或另一个 agent。三条硬规则：

1. **先写 `.tmp` 再 rename**。面板每轮读整份文件，半份文件会解析失败。
2. **整份重写**，不做增量追加。轮询读的是快照，不是日志。
3. **格式变了就提升 `shape`**，见 `kit/model.ts` 的 `PANE_SHAPE`。

```python
import json, os, pathlib
target = pathlib.Path('pane-data.json')
tmp = target.with_suffix('.json.tmp')
tmp.write_text(json.dumps(board, ensure_ascii=False), encoding='utf-8')
os.replace(tmp, target)
```

## 在渲染里不做的事

- 不发请求、不读文件、不写 atom。这些都在 `createPoller` 的定时器回调里做。
- 渲染只读 atom；读 `tick` 会让面板每秒重绘一次，用来刷新时长与数据年龄。

## 超时

`createPoller` 的 `timeoutMs` 默认 15000。超时算一次失败，走退避。`$.http.fetch` 本身没有 timeout 参数，超时由轮询器用 `clock.sleep` 竞速。
