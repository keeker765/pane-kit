/**
 * 配方：自定义数据源。不轮询文件，直接读引擎给出的会话用量。
 *
 * `$` 只在这个工厂的闭包里使用，不能作为值传出去。
 */

import type { Engine } from 'claude-code'

import { formatClock, parseSnapshot } from '../kit/model'
import type { DataSource } from '../kit/poll'

/** 建数据源；load 在每次轮询时读取会话用量。 */
export function createSource(engine: Engine): DataSource {
  return {
    kind: 'custom',
    load: async () => {
      const usage = await engine.session.usage()
      const percent = usage.context.percent ?? 0
      const elapsed = Math.max(0, Math.floor((Date.now() - usage.startedAt) / 1000))
      return {
        head: '本会话',
        sections: [
          {
            id: 'session',
            title: '会话',
            items: [
              { id: 'clock', label: `已用 ${formatClock(elapsed)}`, state: 'doing' },
              {
                id: 'context',
                label: '上下文',
                state: percent > 80 ? 'blocked' : 'done',
                progress: percent,
              },
              {
                id: 'cost',
                label: `成本 $${(usage.cost?.usd ?? 0).toFixed(2)}`,
                state: 'done',
              },
            ],
          },
        ],
      }
    },
  }
}

export const parse = parseSnapshot
