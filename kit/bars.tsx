/**
 * 进度条与指标条。
 *
 * 只用 `Box` 与 `Text`，颜色走主题键，终端与桌面面同形。
 */

import type { ElementTable, RenderElement } from 'claude-code'

import { clampInt, progressBar, toneColor, type Tone } from './model'

/** 一条指标条的输入。 */
export type MeterProps = {
  /** 已完成的数量。 */
  done: number
  /** 总数；为 0 时画空条。 */
  total: number
  /** 条宽，夹在 6–24 格；默认 12。 */
  width?: number
  /** 状态色；默认进行中。 */
  tone?: Tone
  /** 条前面的标签。 */
  label?: string
}

/** 画一行 `████░░ 3/8`。 */
export function renderMeter(table: ElementTable, props: MeterProps): RenderElement {
  const { Box, Text } = table
  const total = Math.max(0, props.total)
  const done = clampInt(props.done, 0, total)
  const width = clampInt(props.width ?? 12, 6, 24)
  const tone = props.tone ?? 'doing'
  return (
    <Box flexDirection="row">
      {props.label !== undefined && <Text dimColor>{props.label} </Text>}
      <Text color={toneColor(tone)}>{progressBar(done, total, width)}</Text>
      <Text dimColor>
        {' '}
        {done}/{total}
      </Text>
    </Box>
  )
}
