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
import { INITIAL_SCROLL } from '../kit/scroll'
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
const scroll = atom({ plugin: 'pane-app', key: 'scroll' } as const, INITIAL_SCROLL, {
  shape: 'scroll-1',
})
const collapsed = atom({ plugin: 'pane-app', key: 'collapsed' } as const, [] as string[], {
  shape: 'collapsed-1',
})

/** 窄终端补开只做一次：会话起手没开成，就在第一条消息提交时补。 */
let promptOpened = false
/** 轮询与计时只启动一次；热重载会重置这个变量，于是自动重来一遍。 */
let running = false

/** 当前页签的条目数；滚动上限按它算。 */
async function countOf($: Engine): Promise<number> {
  const data = await read($, snapshot)
  const active = await read($, tab)
  const section = data.sections.find(one => one.id === active) ?? data.sections[0]
  return section?.items.length ?? 0
}

/** 打开面板；已打开时只重设标题。 */
async function openPane($: Engine): Promise<void> {
  await $.ui.open({ id: PANE, title: '面板', backgroundColor: 'transparent' })
}

/** 起计时与轮询。会话中途加载的 mod 收不到 session.start，所以打开命令也要调它。 */
function ensureRunning($: Engine): void {
  if (running) return
  running = true
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
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: PLUGIN, description: '打开面板' })
    await openPane($)
    ensureRunning($)
    return next(e)
  })

  // 自动打开要 144 列；窄终端下引擎拒绝，面板就无处可画。
  // prompt.submit 算「被要求打开」，任何宽度都能显示，所以这里补一次。
  on('prompt.submit', async ($, e, next) => {
    // 热重载后轮询可能已经停了；每条消息都补一次启动，代价只是一次布尔判断
    ensureRunning($)
    if (!promptOpened) {
      promptOpened = true
      const panes = await $.ui.panes()
      if (!panes.some(pane => pane.id === PANE)) await openPane($)
    }
    return next(e)
  })

  on('command.run', { command: PLUGIN }, async $ => {
    ensureRunning($)
    await openPane($)
    return { text: '面板已打开。' }
  })

  // 拖动滚动条时 Client 模块把目标行号 post 上来，这里写进 atom
  on('ui.message', async ($, e) => {
    const data: unknown = e.data
    const offset =
      typeof data === 'object' && data !== null && 'offset' in data
        ? Number((data as { offset: unknown }).offset)
        : Number.NaN
    if (Number.isFinite(offset)) {
      void update($, scroll, now => ({ ...now, offset }))
    }
    return {}
  })

  // 列表自己接管滚动：写 atom 后不调 next，引擎就不会再滚同一棵树。
  // 上限按**条目数**算，不能用 e.contentRows —— 我们只画了一屏，引擎量到的树高
  // 就是屏高，减完窗口等于 0，滚轮滚不动。
  on('ui.scroll', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const total = await countOf($)
    await update($, scroll, now => ({
      ...now,
      offset: Math.max(0, Math.min(Math.max(0, total - 1), now.offset + e.by)),
      bodyRows: e.bodyRows,
      contentRows: total,
    }))
    return {}
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    // 读 tick 订阅每秒重绘；渲染只读，不写状态
    await read($, tick)
    const data = await read($, snapshot)
    const poll = await read($, status)
    const active = await read($, tab)
    const position = await read($, scroll)
    const closed = await read($, collapsed)
    const kit = createKit($.ui.resolve(e))
    // 按面板正文排版，不能按终端尺寸：终端列数包含左侧对话区，
    // 照它画图会超出面板并被折行
    const bodyColumns = e.props.bodyColumns
    const bodyRows = e.props.scroll?.bodyRows ?? e.viewport?.rows ?? 24
    // 页眉、页签、卡片边框与标题占了固定几行，剩下的才是列表窗口
    const rows = Math.max(3, bodyRows - 6)
    // 换页签时回到列表顶部，否则新页签会停在上一个页签的滚动位置
    const switchTab = (id: string) => {
      void update($, tab, () => id)
      void update($, scroll, () => INITIAL_SCROLL)
    }
    return renderBoard({
      kit,
      data,
      poll,
      active,
      onTab: switchTab,
      onJump: switchTab,
      columns: bodyColumns,
      scroll: { offset: position.offset, rows },
      // 点滚动条第几格就跳到哪一行；拖动走 Client 的 ui.message
      onSeek: target => {
        void update($, scroll, now => ({ ...now, offset: target }))
      },
      collapsed: closed,
      onToggle: id => {
        void update($, collapsed, list =>
          list.includes(id) ? list.filter(one => one !== id) : [...list, id],
        )
      },
    })
  })
}
