/**
 * 面板应用的接线：读数据、按页签画看板。
 *
 * 业务都在 app/ 里：data.ts 决定数据从哪来，view.tsx 决定怎么排版。
 * 这个文件只在换面板方案时改。
 */

import { atom, read, update } from 'claude-code'
import type { Engine, Register } from 'claude-code'

import { createSource, parse } from '../app/data'
import { renderBoard } from '../app/view'
import type { PaneSnapshot, PollStatus } from '../kit/model'
import { createPoller } from '../kit/poll'
import { createKit } from '../kit/surface'

/** 面板 id；同时是 ui.render 的 requestId。 */
const PANE = 'pane-app'
/** 插件名；命令名也用它。 */
const PLUGIN = 'pane-app'

/** 数据到达前的占位，避免首屏空白。 */
const initialSnapshot: PaneSnapshot = { head: '等待数据…', sections: [] }
/** 首屏状态；第一次轮询后覆盖。 */
const initialStatus: PollStatus = { kind: 'stale' }

const snapshot = atom(
  { plugin: 'pane-app', key: 'snapshot' } as const,
  initialSnapshot,
  { shape: 'snapshot-1' },
)
const status = atom(
  { plugin: 'pane-app', key: 'status' } as const,
  initialStatus,
  { shape: 'status-1' },
)
const tab = atom({ plugin: 'pane-app', key: 'tab' } as const, '', { shape: 'tab-1' })
const tick = atom({ plugin: 'pane-app', key: 'tick' } as const, 0, { shape: 'tick-1' })

/** 打开面板；已打开时只重设标题。 */
async function openPane($: Engine): Promise<void> {
  await $.ui.open({ id: PANE, title: '面板', backgroundColor: 'transparent' })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: PLUGIN, description: '打开面板' })
    await openPane($)
    // 每秒推进计数，时长与数据年龄靠它刷新
    $.clock.every(1000, () => void update($, tick, n => n + 1))
    createPoller($, {
      source: createSource($),
      parse,
      onData: async value => {
        await update($, snapshot, () => value)
      },
      onStatus: async value => {
        await update($, status, () => value)
      },
    }).start()
    return next(e)
  })

  on('command.run', { command: PLUGIN }, async $ => {
    await openPane($)
    return { text: '面板已打开。' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    // 读 tick 订阅每秒重绘；渲染只读，不写状态
    await read($, tick)
    const data = await read($, snapshot)
    const poll = await read($, status)
    const active = await read($, tab)
    const kit = createKit($.ui.resolve(e))
    return renderBoard({
      kit,
      data,
      poll,
      active,
      onTab: id => void update($, tab, () => id),
    })
  })
}
