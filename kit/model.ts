/**
 * 面板数据契约与纯格式化函数。
 *
 * 数据形状只在这里定义一次：写方（脚本、后端、另一个 agent）按 `PaneSnapshot`
 * 产出 JSON，面板按同一份类型渲染。本文件不碰 `$`，可以单独测试。
 */

/** 一条条目的四种状态。符号与配色只在下表定义一次。 */
export type Tone = 'done' | 'doing' | 'blocked' | 'todo'

/** 一条进度：计数的分子分母，外加成功率与剩余时间。 */
export type Meter = {
  /** 已完成的数量。 */
  done: number
  /** 总数。 */
  total: number
  /** 其中成功的数量；省略不画成功率。 */
  ok?: number
  /** 预计剩余秒数；省略写「估算中」。 */
  eta?: number
  /** 最近若干个已完成数，用来在进度行尾部画折线；省略不画。 */
  samples?: readonly number[]
}

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
  /** 带计数的进度；有它时多画一行 `████ 37% 700/1886`。 */
  meter?: Meter
  /** 树里的层级，0 是顶层；省略按 0。比自己深的下一行算自己的子节点。 */
  depth?: number
  /** 点这一行要跳到的区块 id；省略则不可点。 */
  target?: string
  /** 第二行的补充说明。 */
  note?: string
  /** 发生时间，毫秒时间戳。 */
  ts?: number
}

/** 整块图表：折线或纵向柱状，占满卡片正文。 */
export type ChartSpec = {
  /** `line` 画折线，`columns` 画柱子。 */
  kind: 'line' | 'columns'
  /** 采样值，从左到右。 */
  values: readonly number[]
  /** 图表下方的灰字说明；省略不画。 */
  note?: string
  /** 行数；省略按卡片高度，夹在 2–12。 */
  height?: number
}

/** 看板的一个区块；每个区块是一个页签。 */
export type Section = {
  id: string
  title: string
  items: readonly Item[]
  /** 给了图表就整块画图，忽略 items。 */
  chart?: ChartSpec
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
export const PANE_SHAPE = 'pane-2'

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

/** 把剩余秒数写成「剩 2 小时 10 分」；只说时长，不给时刻。 */
export function formatEta(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  if (total < 60) return `剩 ${total} 秒`
  if (total < 3600) return `剩 ${Math.floor(total / 60)} 分 ${total % 60} 秒`
  return `剩 ${Math.floor(total / 3600)} 小时 ${Math.floor((total % 3600) / 60)} 分`
}

/** 一条进度的文字：`37% 700/1886 成功 420（60%） 剩 2 小时 10 分`。 */
export function meterText(meter: Meter): string {
  const total = Math.max(0, meter.total)
  const done = clampInt(meter.done, 0, total)
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  const parts = [`${percent}%`, `${done}/${total}`]
  // 成功数与成功率只在这条进度带 ok 时才写
  if (meter.ok !== undefined) {
    const ok = clampInt(meter.ok, 0, done)
    const rate = done > 0 ? Math.round((ok / done) * 100) : 0
    parts.push(`成功 ${ok}（${rate}%）`)
  }
  parts.push(meter.eta === undefined ? '估算中' : formatEta(meter.eta))
  return parts.join('  ')
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

/** 读一条进度；缺 done 或 total 时抛错，其余字段能省则省。 */
function readMeter(value: unknown, index: number): Meter {
  if (!isRecord(value)) throw new Error(`items[${index}].meter 不是对象`)
  if (typeof value.done !== 'number' || typeof value.total !== 'number') {
    throw new Error(`items[${index}].meter 缺少数字 done 或 total`)
  }
  const meter: Meter = {
    done: clampInt(value.done, 0, Math.max(0, value.total)),
    total: Math.max(0, Math.floor(value.total)),
  }
  if (typeof value.ok === 'number') meter.ok = clampInt(value.ok, 0, meter.done)
  if (typeof value.eta === 'number') meter.eta = Math.max(0, Math.floor(value.eta))
  // 采样只留最近 240 个；坏值剔除，负数归零
  if (Array.isArray(value.samples)) {
    const samples = value.samples
      .filter((one): one is number => typeof one === 'number' && Number.isFinite(one))
      .slice(-240)
      .map(one => Math.max(0, one))
    if (samples.length > 0) meter.samples = samples
  }
  return meter
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
  if (isRecord(value.meter)) item.meter = readMeter(value.meter, index)
  if (typeof value.depth === 'number') item.depth = clampInt(value.depth, 0, 12)
  if (typeof value.target === 'string' && value.target !== '') item.target = value.target
  if (typeof value.note === 'string') item.note = value.note
  if (typeof value.ts === 'number') item.ts = value.ts
  return item
}

/** 读整块图表；kind 或 values 不对时抛错。 */
function readChart(value: unknown, index: number): ChartSpec {
  if (!isRecord(value)) throw new Error(`sections[${index}].chart 不是对象`)
  if (value.kind !== 'line' && value.kind !== 'columns') {
    throw new Error(`sections[${index}].chart.kind 只能是 line 或 columns`)
  }
  if (!Array.isArray(value.values)) throw new Error(`sections[${index}].chart.values 不是数组`)
  const values = value.values
    .filter((one): one is number => typeof one === 'number' && Number.isFinite(one))
    .slice(-480)
    .map(one => Math.max(0, one))
  if (values.length === 0) throw new Error(`sections[${index}].chart.values 是空的`)
  const chart: ChartSpec = { kind: value.kind, values }
  if (typeof value.note === 'string') chart.note = value.note
  if (typeof value.height === 'number') chart.height = clampInt(value.height, 2, 12)
  return chart
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
  const section: Section = { id, title, items: value.items.map(readItem) }
  if (isRecord(value.chart)) section.chart = readChart(value.chart, index)
  return section
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
