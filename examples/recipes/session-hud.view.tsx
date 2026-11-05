/**
 * 配方：会话仪表盘的版面。指标块一排 + 上下文进度条。
 */

import type { RenderElement } from 'claude-code'

import type { BoardProps } from '../kit/surface'

/** 画会话仪表盘。 */
export function renderBoard(props: BoardProps): RenderElement {
  const { kit, data } = props
  const section = data.sections[0]
  const items = section?.items ?? []
  const percent = items.find(one => one.id === 'context')?.progress ?? 0
  return (
    <kit.Box flexDirection="column">
      <kit.Text weight="bold">{data.head ?? '会话'}</kit.Text>
      <kit.Box flexDirection="row" marginTop={1}>
        {items.map(one => (
          <kit.StatTile
            key={one.id}
            label={one.label}
            value={one.progress === undefined ? '—' : `${one.progress}%`}
          />
        ))}
      </kit.Box>
      <kit.Card title="上下文" subtitle={`${percent}%`}>
        <kit.Meter done={percent} total={100} width={16} tone={percent > 80 ? 'blocked' : 'doing'} />
      </kit.Card>
    </kit.Box>
  )
}
