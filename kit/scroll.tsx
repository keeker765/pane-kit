/**
 * 带右侧滚动条的定高列表。
 *
 * 列表自己决定显示哪一段，所以引擎不能同时滚同一棵树：`ui.render` 的接线里
 * 要挂 `ui.scroll` 钩子，把 `by` 交给 `moveScroll` 并**不调 `next`**。
 * 滚动条按**屏幕行**画在最右列：带计数进度的条目多占一行，那一行也有格。
 */

import type { ElementTable, RenderElement } from 'claude-code'

import { sparkline } from './chart'
import { clampInt, meterText, progressBar, stateOf, TONE_MARK, toneColor, type Item } from './model'
import { clipToWidth } from './width'

/** 滚动位置；`ui.scroll` 钩子每收到一次就更新一次。 */
export type ScrollState = {
  /** 首行行号。 */
  offset: number
  /** 窗口能看到几行；引擎在事件里给。 */
  bodyRows: number
  /** 整棵树几行；引擎在事件里给。 */
  contentRows: number
}

/** 首次打开时的位置：顶部，尚未知道树高。 */
export const INITIAL_SCROLL: ScrollState = { offset: 0, bodyRows: 0, contentRows: 0 }

/** 把首行夹到合法范围；整棵树装得下时只有 0。 */
export function clampOffset(offset: number, rows: number, content: number): number {
  const last = Math.max(0, content - rows)
  return clampInt(offset, 0, last)
}

/** 按引擎给的位移算出新位置；PageUp/Down 与 Home/End 的步长由引擎折成 `by`。 */
export function moveScroll(state: ScrollState, by: number, rows: number, content: number): ScrollState {
  const bodyRows = rows > 0 ? rows : state.bodyRows
  const contentRows = content > 0 ? content : state.contentRows
  return { offset: clampOffset(state.offset + by, bodyRows, contentRows), bodyRows, contentRows }
}

/** 每行一格的滚动条：拇指 `█`、轨道 `│`；装得下时整列留空。 */
export function scrollBarCells(offset: number, rows: number, content: number, height: number): readonly string[] {
  if (height <= 0) return []
  // 内容装得下就没有滚动条，留空保持对齐
  if (content <= rows || rows <= 0) return Array.from({ length: height }, () => ' ')
  const thumb = clampInt(Math.round((rows * height) / content), 1, height)
  const travel = height - thumb
  const last = Math.max(1, content - rows)
  const start = Math.round((clampOffset(offset, rows, content) / last) * travel)
  return Array.from({ length: height }, (_unused, index) =>
    index >= start && index < start + thumb ? '█' : '│',
  )
}

/** 一条在屏幕上占几行：带计数进度的多占一行。 */
function rowHeight(item: Item): number {
  return item.meter === undefined ? 1 : 2
}

/** 点在滚动条第 `line` 格时应该跳到的首行行号。 */
export function seekOffset(line: number, rows: number, content: number): number {
  const last = Math.max(0, content - rows)
  // 只有一格可点或内容装得下：只可能停在顶部
  if (last === 0 || rows <= 1) return 0
  return clampInt(Math.round((line / (rows - 1)) * last), 0, last)
}

/** 定高列表的输入。 */
export type ScrollListProps = {
  /** 整份条目，由本组件按 `offset` 截取。 */
  items: readonly Item[]
  /** 窗口高度，单位屏幕行。 */
  rows: number
  /** 首行行号。 */
  offset: number
  /** 文字可用列数，含行首符号；默认 40。 */
  columns?: number
  /** 是否画滚动条；默认画。 */
  bar?: boolean
  /** 点滚动条某一格时调用，参数是那一格对应的首行行号；不传则滚动条只显示不可点。 */
  onSeek?: (offset: number) => void
  /** 换成可拖动的滚动条；接了 `ui.message` 才能收到拖出来的位置。 */
  draggable?: boolean
}

/** 画一行：状态符号 + 定宽截断的标签。 */
function renderRow(table: ElementTable, item: Item, textWidth: number): RenderElement {
  const { Box, Text } = table
  const tone = stateOf(item)
  return (
    <Box key={item.id} flexDirection="row">
      <Text color={toneColor(tone)}>{TONE_MARK[tone]}</Text>
      <Text>{clipToWidth(` ${item.label}`, textWidth)}</Text>
    </Box>
  )
}

/** 画一条计数进度：绿色进度条 + 灰字说明。 */
function renderMeterRow(table: ElementTable, item: Item, textWidth: number): RenderElement {
  const { Box, Text } = table
  const meter = item.meter
  if (meter === undefined) return <Box key={`${item.id}-meter`} />
  // 有采样点时行尾多画 13 格（前导空格 + 12 格折线），说明文字相应让位
  const spark = meter.samples === undefined ? '' : ` ${sparkline(meter.samples)}`
  const detailWidth = Math.max(8, textWidth - 12 - spark.length)
  return (
    <Box key={`${item.id}-meter`} flexDirection="row">
      <Text> </Text>
      <Text color="success">{progressBar(meter.done, meter.total, 10)}</Text>
      <Text dimColor> {clipToWidth(meterText(meter), detailWidth)}</Text>
      {spark !== '' && <Text color="success">{spark}</Text>}
    </Box>
  )
}

/** 画整块定高列表；行数不足时用空行补齐，滚动条才对得齐。 */
export function renderScrollList(table: ElementTable, props: ScrollListProps): RenderElement {
  const { Box, Text, Button, Client } = table
  const columns = Math.max(8, props.columns ?? 40)
  const rows = Math.max(1, props.rows)
  // 首行按**条目**夹，不按行数：窗口是行、条目是条，两条刻度不同，
  // 用 `长度 - 窗口` 夹会停在中间，最后几条永远滚不到
  const offset = clampInt(props.offset, 0, Math.max(0, props.items.length - 1))
  // 滚动条按屏幕行算：带进度的条目占两行，所以内容总行数不等于条目数
  const contentLines = props.items.reduce((sum, item) => sum + rowHeight(item), 0)
  const passedLines = props.items.slice(0, offset).reduce((sum, item) => sum + rowHeight(item), 0)
  const bars = props.bar === false ? [] : scrollBarCells(passedLines, rows, contentLines, rows)
  // 拖动的滚动条单独占一列，所以左侧文字宽度要给它留一格
  const textWidth = columns - 3
  const showBar = props.bar !== false
  const nodes: RenderElement[] = []
  const barNodes: RenderElement[] = []
  // 滚动条的一格：给了 onSeek 就做成按钮，鼠标点哪格就跳到哪
  const cellAt = (at: number): RenderElement => {
    const mark = bars[at] ?? ' '
    if (props.onSeek === undefined) return <Text dimColor> {mark}</Text>
    return (
      <Button key={`seek-${at}`} plain onPress={() => props.onSeek?.(seekOffset(at, rows, contentLines))}>
        <Text dimColor> {mark}</Text>
      </Button>
    )
  }
  // 拖动模式下滚动条由 Client 自己画，这里只把行留住
  const pushBar = (at: number) => {
    if (!showBar || props.draggable === true) return
    barNodes.push(
      <Box key={`bar-${at}`} flexDirection="row">
        {cellAt(at)}
      </Box>,
    )
  }
  // line 是已占用的屏幕行；带进度的条目一次吃掉两行
  let line = 0
  for (const item of props.items.slice(offset)) {
    const cost = rowHeight(item)
    if (line + cost > rows) break
    nodes.push(<Box key={`${item.id}-row`} flexDirection="row">{renderRow(table, item, textWidth)}</Box>)
    pushBar(line)
    if (cost === 2) {
      nodes.push(
        <Box key={`${item.id}-meter-line`} flexDirection="row">
          {renderMeterRow(table, item, textWidth)}
        </Box>,
      )
      pushBar(line + 1)
    }
    line += cost
  }
  // 余下的行留空，卡片高度与滚动条格数才对得上
  for (let index = line; index < rows; index += 1) {
    nodes.push(
      <Box key={`blank-${index}`} flexDirection="row">
        <Text> </Text>
      </Box>,
    )
    pushBar(index)
  }
  const bar =
    props.draggable === true ? (
      <Client
        key="scrollbar"
        module="./scrollbar.tsx"
        props={{ offset, rows, content: contentLines }}
        width={1}
        height={rows}
      />
    ) : (
      <Box flexDirection="column">{barNodes}</Box>
    )
  // 文字列吃掉剩余宽度，滚动条固定在卡片最右边
  return (
    <Box flexDirection="row">
      <Box flexDirection="column" flexGrow={1}>
        {nodes}
      </Box>
      {showBar && <Box flexShrink={0}>{bar}</Box>}
    </Box>
  )
}
