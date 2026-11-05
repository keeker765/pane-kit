/**
 * 配方：文件轮询的版面。页眉 + 页签 + 任务卡片。
 */

import type { RenderElement } from 'claude-code'

import { formatStamp } from '../kit/model'
import type { BoardProps } from '../kit/surface'

/** 页眉右侧的一句话。 */
function statusLine(props: BoardProps): string {
  const { poll } = props
  if (poll.kind === 'ok') {
    return poll.updated === undefined ? '已连接' : `更新于 ${formatStamp(poll.updated)}`
  }
  const reason = poll.message === undefined ? '' : ` · ${poll.message}`
  return poll.kind === 'stale' ? `数据陈旧${reason}` : `错误${reason}`
}

/** 画整块看板。 */
export function renderBoard(props: BoardProps): RenderElement {
  const { kit, data, active, onTab } = props
  const pages = data.sections.map(section => ({ id: section.id, label: section.title }))
  const firstId = pages[0]?.id ?? ''
  const currentId = pages.some(page => page.id === active) ? active : firstId
  const section = data.sections.find(one => one.id === currentId)
  const done = section?.items.filter(one => (one.state ?? 'todo') === 'done').length ?? 0
  const total = section?.items.length ?? 0
  return (
    <kit.Box flexDirection="column">
      <kit.Box flexDirection="row">
        <kit.Text weight="bold">{data.head ?? '面板'}</kit.Text>
        <kit.Text dimColor> {statusLine(props)}</kit.Text>
      </kit.Box>
      {pages.length > 1 && <kit.Tabs pages={pages} active={currentId} onPick={onTab} />}
      {section === undefined ? (
        <kit.Text dimColor>还没有数据。</kit.Text>
      ) : (
        <kit.Card title={section.title} subtitle={`${done}/${total} 完成`}>
          <kit.TaskList items={section.items} />
        </kit.Card>
      )}
    </kit.Box>
  )
}
