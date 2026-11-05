/**
 * 任务列表。
 *
 * 未完成的全显示，已完成的只留最近几条；带前缀的行做悬挂缩进，
 * 长标签交给 `Text wrap` 折行。
 */

import type { ElementTable, RenderElement } from 'claude-code'

import { sparkline } from './chart'
import { byState, meterText, progressBar, stateOf, TONE_MARK, toneColor, type Item } from './model'

/** 任务列表的输入。 */
export type TaskListProps = {
  /** 任务或条目。 */
  items: readonly Item[]
  /** 已完成的条目最多显示几条；默认 5。 */
  doneLimit?: number
}

/** 画一行任务：状态符号 + 悬挂缩进的正文。 */
function renderTaskRow(table: ElementTable, item: Item): RenderElement {
  const { Box, Text } = table
  const tone = stateOf(item)
  return (
    <Box key={item.id} flexDirection="row">
      <Box flexShrink={0}>
        <Text color={toneColor(tone)}>{TONE_MARK[tone]}</Text>
      </Box>
      <Box flexShrink={1} flexDirection="column" marginLeft={1}>
        <Text wrap="wrap">{item.label}</Text>
        {item.meter !== undefined && (
          <Box flexDirection="row">
            <Text color="success">{progressBar(item.meter.done, item.meter.total, 10)}</Text>
            <Text dimColor> {meterText(item.meter)}</Text>
            {item.meter.samples !== undefined && (
              <Text color="success"> {sparkline(item.meter.samples)}</Text>
            )}
          </Box>
        )}
        {item.note !== undefined && (
          <Text dimColor wrap="wrap">
            └ {item.note}
          </Text>
        )}
      </Box>
    </Box>
  )
}

/** 画整份任务列表：排序后截断已完成的尾部。 */
export function renderTaskList(table: ElementTable, props: TaskListProps): RenderElement {
  const { Box } = table
  const doneLimit = props.doneLimit ?? 5
  const sorted = [...props.items].sort(byState)
  const unfinished = sorted.filter(one => stateOf(one) !== 'done')
  const finished = sorted.filter(one => stateOf(one) === 'done').slice(-doneLimit)
  const shown = [...unfinished, ...finished]
  return (
    <Box flexDirection="column">
      {shown.map(one => renderTaskRow(table, one))}
    </Box>
  )
}
