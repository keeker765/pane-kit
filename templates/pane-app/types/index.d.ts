/**
 * 面板插件的数据形状声明。
 *
 * 与 kit/model.ts 的 PaneSnapshot 保持一致；两处改一处就不一致，
 * 所以结构只在这里声明，kit 那边用结构化类型对齐。
 */

/** 一条条目。 */
export type SnapshotItem = {
  id: string
  label: string
  state?: 'done' | 'doing' | 'blocked' | 'todo'
  progress?: number
  note?: string
  ts?: number
}

/** 一个区块。 */
export type SnapshotSection = {
  id: string
  title: string
  items: readonly SnapshotItem[]
}

/** 整份快照。 */
export type Snapshot = {
  head?: string
  sections: readonly SnapshotSection[]
  updated?: number
}

/** 列表窗口位置。 */
export type ScrollPosition = {
  /** 首行行号。 */
  offset: number
  /** 窗口能看到几行。 */
  bodyRows: number
  /** 整棵树几行。 */
  contentRows: number
}

/** 轮询状态。 */
export type SnapshotStatus = {
  kind: 'ok' | 'stale' | 'error'
  message?: string
  updated?: number
}

declare module 'claude-code' {
  interface PluginState {
    'pane-app': {
      /** 最近一份成功取到的数据。 */
      snapshot: Shaped<Snapshot>
      /** 轮询状态；失败时不清空 snapshot。 */
      status: Shaped<SnapshotStatus>
      /** 当前页签 id。 */
      tab: Shaped<string>
      /** 每秒自增，驱动重绘。 */
      tick: Shaped<number>
      /** 列表窗口位置；`ui.scroll` 钩子写它。 */
      scroll: Shaped<ScrollPosition>
      /** 已收起的树节点 id。 */
      collapsed: Shaped<string[]>
    }
  }
}
