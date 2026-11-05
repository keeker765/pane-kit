/**
 * 面板数据契约与纯格式化函数。
 *
 * 数据形状只在这里定义一次：写方（脚本、后端、另一个 agent）按 `PaneSnapshot`
 * 产出 JSON，面板按同一份类型渲染。本文件不碰 `$`，可以单独测试。
 */

/** 一条条目的四种状态。符号与配色只在下表定义一次。 */
export type Tone = 'done' | 'doing' | 'blocked' | 'todo'

/** 看板的一行：任务、指标或任意条目。 */
export type Item = {
  /** 稳定标识；重绘后按它对回同一行。 */
  id: string
  /** 行首显示的文字。 */
  label: string
  /** 状态；省略按 todo 画。 */
  state?: Tone
  /** 0–100 的完成度；省略只画状态符号。 */
  progress?: number
  /** 第二行的补充说明。 */
  note?: string
  /** 发生时间，毫秒时间戳。 */
  ts?: number
}

/** 看板的一个区块；每个区块是一个页签。 */
export type Section = {
  id: string
  title: string
  items: readonly Item[]
}

/** 轮询状态，决定页眉的一句话与颜色。 */
export type PollStatus = {
  kind: 'ok' | 'stale' | 'error'
  message?: string
  updated?: number
}

/** 面板的整份数据，读写两方共用。 */
export type PaneSnapshot = {
  head?: string
  sections: readonly Section[]
  updated?: number
  status?: PollStatus
}

/** 数据契约版本；结构变了就换标签。 */
export const PANE_SHAPE = 'pane-1'

/** 状态符号。整行同色，已完成的文字不再另行变暗。 */
export const TONE_MARK: Record<Tone, string> = {
  done: '✓',
  doing: '▶',
  blocked: '⏸',
  todo: '·',
}

/** 状态到主题色的映射；键名与引擎主题一致。 */
export const TONE_COLOR: Record<Tone, 'success' | 'warning' | 'error' | 'inactive'> = {
  done: 'success',
  doing: 'warning',
  blocked: 'error',
  todo: 'inactive',
}

/** 状态对应的主题色。 */
export function toneColor(tone: Tone): 'success' | 'warning' | 'error' | 'inactive' {
  return TONE_COLOR[tone]
}

/** 条目的状态，省略时按未开始。 */
export function stateOf(item: Item): Tone {
  return item.state ?? 'todo'
}

/** 排序权重：进行中 → 卡住 → 待做 → 完成。 */
const RANK: Record<Tone, number> = { doing: 0, blocked: 1, todo: 2, done: 3 }

/** 按状态排序；同状态保持原顺序。 */
export function byState(left: Item, right: Item): number {
  return RANK[stateOf(left)] - RANK[stateOf(right)]
}

/** 把数字夹在上下界之间，非整数向下取整。 */
export function clampInt(value: number, low: number, high: number): number {
  const whole = Number.isFinite(value) ? Math.floor(value) : low
  return Math.max(low, Math.min(high, whole))
}

/** 画一条进度条；宽度夹在 4–24 格。 */
export function progressBar(done: number, total: number, width: number): string {
  const cells = clampInt(width, 4, 24)
  const safeTotal = Math.max(0, total)
  const safeDone = clampInt(done, 0, safeTotal)
  const ratio = safeTotal > 0 ? safeDone / safeTotal : 0
  const filled = Math.round(ratio * cells)
  return '█'.repeat(filled) + '░'.repeat(cells - filled)
}

/** 把秒数写成 3h 12m 或 12m 05s；一小时以内保留秒。 */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m ${String(total % 60).padStart(2, '0')}s`
}

/** 把毫秒时长写成 3s / 2m / 1h 20m。 */
export function formatAge(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

/** 时间戳写成 HH:MM:SS。 */
export function formatStamp(milliseconds: number): string {
  const date = new Date(milliseconds)
  const parts = [date.getHours(), date.getMinutes(), date.getSeconds()]
  return parts.map(one => String(one).padStart(2, '0')).join(':')
}

/** 判断一个 JSON 值是不是普通对象。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 把未知值读成四种状态之一；不认识的值按 todo。 */
function readTone(value: unknown): Tone {
  if (value === 'done' || value === 'doing' || value === 'blocked' || value === 'todo') return value
  return 'todo'
}

/** 读一条条目；缺少 id 或 label 时抛错。 */
function readItem(value: unknown, index: number): Item {
  if (!isRecord(value)) throw new Error(`items[${index}] 不是对象`)
  const id = value.id
  const label = value.label
  if (typeof id !== 'string' || typeof label !== 'string') {
    throw new Error(`items[${index}] 缺少字符串 id 或 label`)
  }
  const item: Item = { id, label, state: readTone(value.state) }
  if (typeof value.progress === 'number') item.progress = clampInt(value.progress, 0, 100)
  if (typeof value.note === 'string') item.note = value.note
  if (typeof value.ts === 'number') item.ts = value.ts
  return item
}

/** 读一个区块；缺少 id 或 title 时抛错。 */
function readSection(value: unknown, index: number): Section {
  if (!isRecord(value)) throw new Error(`sections[${index}] 不是对象`)
  const id = value.id
  const title = value.title
  if (typeof id !== 'string' || typeof title !== 'string') {
    throw new Error(`sections[${index}] 缺少字符串 id 或 title`)
  }
  if (!Array.isArray(value.items)) throw new Error(`sections[${index}].items 不是数组`)
  return { id, title, items: value.items.map(readItem) }
}

/** 解析并校验一份面板 JSON；坏数据抛错，调用方保留上一份。 */
export function parseSnapshot(text: string): PaneSnapshot {
  const raw: unknown = JSON.parse(text)
  if (!isRecord(raw)) throw new Error('面板数据不是 JSON 对象')
  if (!Array.isArray(raw.sections)) throw new Error('面板数据缺少 sections 数组')
  const snapshot: PaneSnapshot = { sections: raw.sections.map(readSection) }
  if (typeof raw.head === 'string') snapshot.head = raw.head
  if (typeof raw.updated === 'number') snapshot.updated = raw.updated
  if (isRecord(raw.status) && typeof raw.status.kind === 'string') {
    snapshot.status = { kind: raw.status.kind as PollStatus['kind'] }
  }
  return snapshot
}
