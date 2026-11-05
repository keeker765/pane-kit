/**
 * 卡片与指标块。
 *
 * 卡片一行一张、整宽；这是 11-03 定下的版面，不再排两列。
 */

import type { ElementTable, RenderElement, RenderNode } from 'claude-code'

import { toneColor, type Tone } from './model'

/** 一张圆角卡片。 */
export type CardProps = {
  /** 卡片标题，粗体。 */
  title: string
  /** 标题下的灰字说明。 */
  subtitle?: string
  /** 有值时边框改用状态色；默认灰色。 */
  tone?: Tone
  /** 卡片内容。 */
  children?: RenderNode
}

/** 画一张卡片：圆角边框、标题、说明、内容。 */
export function renderCard(table: ElementTable, props: CardProps): RenderElement {
  const { Box, Text } = table
  const border = props.tone === undefined ? 'gray' : toneColor(props.tone)
  return (
    <Box
      borderStyle="round"
      borderColor={border}
      paddingX={1}
      marginTop={1}
      flexDirection="column"
    >
      <Text weight="bold">{props.title}</Text>
      {props.subtitle !== undefined && <Text dimColor>{props.subtitle}</Text>}
      {props.children}
    </Box>
  )
}

/** 一个小指标块：上方标签、下方数值。 */
export type StatTileProps = {
  /** 指标名。 */
  label: string
  /** 指标值，已格式化好的字符串。 */
  value: string
}

/** 画一个指标块；四块一排，由调用方决定布局。 */
export function renderStatTile(table: ElementTable, props: StatTileProps): RenderElement {
  const { Box, Text } = table
  return (
    <Box
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      marginRight={1}
      minWidth={14}
      flexDirection="column"
    >
      <Text dimColor>{props.label}</Text>
      <Text weight="bold">{props.value}</Text>
    </Box>
  )
}
