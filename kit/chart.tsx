/**
 * 只读图表：一行折线与纵向柱状。
 *
 * 全部用文字块字符绘制，所以终端、桌面、编辑器与手机面都画得出来；
 * 不用 `Raster`，它只在终端面存在。数据按峰值归一化，负数按 0 处理。
 * 这两组函数不碰 `$`，可以单独测试；`app/view.tsx` 里用 `kit.Sparkline`
 * 与 `kit.Columns` 画。
 */

import type { ElementTable, RenderElement } from 'claude-code'

import { clampInt } from './model'

/** 折线的八级高度，下标即档位。 */
const SPARK_BLOCKS = '▁▂▃▄▅▆▇█'
/** 柱状图的九级：下标 0 是空格，其余与折线同高。 */
const COLUMN_UNITS = ' ▁▂▃▄▅▆▇█'
/** 折线默认宽度，单位格；进度行里也用它。 */
export const SPARK_WIDTH = 12

/** 读一组数字：非有限值与负数都按 0。 */
function readValues(values: readonly number[]): number[] {
  return values.map(one => (Number.isFinite(one) ? Math.max(0, one) : 0))
}

/** 把过长序列压到 `cells` 格：每格取一段的平均值。 */
function reduceTo(values: readonly number[], cells: number): number[] {
  if (values.length <= cells) return [...values]
  return Array.from({ length: cells }, (_unused, index) => {
    const start = Math.floor((index * values.length) / cells)
    const end = Math.floor(((index + 1) * values.length) / cells)
    const slice = values.slice(start, Math.max(start + 1, end))
    return slice.reduce((sum, one) => sum + one, 0) / slice.length
  })
}

/** 把序列铺满 `cells` 格：长了按段平均，短了线性插值。 */
function fitWidth(values: readonly number[], cells: number): number[] {
  if (values.length >= cells) return reduceTo(values, cells)
  const last = Math.max(1, values.length - 1)
  return Array.from({ length: cells }, (_unused, index) => {
    const position = (index / Math.max(1, cells - 1)) * last
    const left = Math.floor(position)
    const right = Math.min(values.length - 1, left + 1)
    const ratio = position - left
    return values[left] * (1 - ratio) + values[right] * ratio
  })
}

/** 画一行折线；`width` 是上限，超长序列按段平均压缩。 */
export function sparkline(values: readonly number[], width: number = SPARK_WIDTH): string {
  const cells = clampInt(width, 4, 120)
  const clean = readValues(values)
  if (clean.length === 0) return ''
  const shown = reduceTo(clean, cells)
  const peak = Math.max(...shown, 1)
  // 每点按峰值折成 0–7 档，负数已在 readValues 里归零
  return shown
    .map(one => SPARK_BLOCKS[clampInt(Math.round((one / peak) * 7), 0, 7)])
    .join('')
}

/** 画纵向柱状图，返回从顶到底的各行；每列一格宽。 */
export function columnChart(values: readonly number[], height: number = 4): readonly string[] {
  const rows = clampInt(height, 1, 12)
  const clean = readValues(values)
  if (clean.length === 0) return []
  const peak = Math.max(...clean, 1)
  // 每列的总高度，单位是八分之一格；从底往上填
  const units = clean.map(one => Math.round((one / peak) * rows * 8))
  return Array.from({ length: rows }, (_unused, index) => {
    // 这一行下面已经占掉的八分之一格数
    const below = (rows - 1 - index) * 8
    return units.map(one => COLUMN_UNITS[clampInt(one - below, 0, 8)]).join('')
  })
}

/** 画整块折线图，返回从顶到底的各行；相邻两点的落差用竖线补连。 */
export function lineChart(values: readonly number[], width: number = 40, height: number = 6): readonly string[] {
  const cells = clampInt(width, 4, 120)
  const rows = clampInt(height, 2, 12)
  const shown = fitWidth(readValues(values), cells)
  if (shown.length === 0) return []
  const peak = Math.max(...shown, 1)
  const grid = Array.from({ length: rows }, () => Array.from({ length: shown.length }, () => ' '))
  // 上一个点所在的行；第一个点从底部起算
  let previous = rows - 1
  shown.forEach((one, x) => {
    const y = clampInt(rows - 1 - Math.round((one / peak) * (rows - 1)), 0, rows - 1)
    // 跳变处补竖线，整条线看起来才连续
    const top = Math.min(previous, y)
    const bottom = Math.max(previous, y)
    for (let fill = top + 1; fill < bottom; fill += 1) grid[fill][x] = '│'
    grid[y][x] = '█'
    previous = y
  })
  return grid.map(row => row.join(''))
}

/** 画整块柱状图；先把序列铺满 `width` 列，再按 `height` 行画。 */
export function bigChart(values: readonly number[], width: number = 40, height: number = 6): readonly string[] {
  const shown = fitWidth(readValues(values), clampInt(width, 4, 120))
  return columnChart(shown, height)
}

/** 整块图表组件的输入。 */
export type ChartProps = {
  /** `line` 折线，`columns` 柱状。 */
  kind: 'line' | 'columns'
  /** 采样值，从左到右。 */
  values: readonly number[]
  /** 宽度，单位格。 */
  width: number
  /** 行数；默认 6。 */
  height?: number
  /** 图下方说明；省略不画。 */
  note?: string
  /** 柱子或折线的颜色；默认 success。 */
  color?: 'success' | 'warning' | 'error' | 'inactive' | 'gray'
}

/** 折线组件的输入。 */
export type SparkProps = {
  /** 采样值，从左到右。 */
  values: readonly number[]
  /** 宽度上限，单位格；默认 12。 */
  width?: number
  /** 左侧说明；省略不画。 */
  label?: string
  /** 颜色；默认 success。 */
  color?: 'success' | 'warning' | 'error' | 'inactive' | 'gray'
}

/** 柱状图组件的输入。 */
export type ColumnsProps = {
  /** 每列一个值。 */
  values: readonly number[]
  /** 行数；默认 4。 */
  height?: number
  /** 顶部标题；省略不画。 */
  label?: string
  /** 颜色；默认 success。 */
  color?: 'success' | 'warning' | 'error' | 'inactive' | 'gray'
}

/** 画一行带说明的折线。 */
export function renderSparkline(table: ElementTable, props: SparkProps): RenderElement {
  const { Box, Text } = table
  return (
    <Box flexDirection="row">
      {props.label !== undefined && <Text dimColor>{props.label} </Text>}
      <Text color={props.color ?? 'success'}>{sparkline(props.values, props.width)}</Text>
    </Box>
  )
}

/** 画整块图表：按 `kind` 选折线或柱子，说明放在最下面。 */
export function renderChart(table: ElementTable, props: ChartProps): RenderElement {
  const { Box, Text } = table
  const rows =
    props.kind === 'line'
      ? lineChart(props.values, props.width, props.height)
      : bigChart(props.values, props.width, props.height)
  return (
    <Box flexDirection="column">
      {rows.map((line, index) => (
        <Text key={`chart-${index}`} color={props.color ?? 'success'}>
          {line}
        </Text>
      ))}
      {props.note !== undefined && <Text dimColor>{props.note}</Text>}
    </Box>
  )
}

/** 画一组纵向柱子；标题在上，柱子在下。 */
export function renderColumns(table: ElementTable, props: ColumnsProps): RenderElement {
  const { Box, Text } = table
  const rows = columnChart(props.values, props.height)
  return (
    <Box flexDirection="column">
      {props.label !== undefined && <Text dimColor>{props.label}</Text>}
      {rows.map((line, index) => (
        <Text key={`column-${index}`} color={props.color ?? 'success'}>
          {line}
        </Text>
      ))}
    </Box>
  )
}
