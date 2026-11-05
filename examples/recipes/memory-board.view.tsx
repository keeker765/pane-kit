/**
 * 版面：页眉 + 页签 + 一张卡片。
 *
 * 与模板不同之处只在副标题：记忆条目没有「完成」的概念，写条数更有意义。
 */

import type { RenderElement } from 'claude-code'

import { formatStamp } from '../kit/model'
import type { BoardProps } from '../kit/surface'

/** 页眉右侧的一句话：更新于几点，或陈旧的提示。 */
function statusLine(props: BoardProps): string {
  const { poll } = props
  if (poll.kind === 'ok') {
    return poll.updated === undefined ? '已连接' : `更新于 ${formatStamp(poll.updated)}`
  }
  // 陈旧与错误都保留旧数据，只在页眉提示
  const reason = poll.message === undefined ? '' : ` · ${poll.message}`
  return poll.kind === 'stale' ? `数据陈旧${reason}` : `错误${reason}`
}

/** 画整块看板。 */
export function renderBoard(props: BoardProps): RenderElement {
  const { kit, data, active, onTab, scroll } = props
  const pages = data.sections.map(section => ({ id: section.id, label: section.title }))
  const firstId = pages[0]?.id ?? ''
  const currentId = pages.some(page => page.id === active) ? active : firstId
  const section = data.sections.find(one => one.id === currentId)
  return (
    <kit.Box flexDirection="column">
      <kit.Box flexDirection="row">
        <kit.Text weight="bold">{data.head ?? '记忆'}</kit.Text>
        <kit.Text dimColor> {statusLine(props)}</kit.Text>
      </kit.Box>
      {pages.length > 1 && <kit.Tabs pages={pages} active={currentId} onPick={onTab} />}
      {section === undefined ? (
        <kit.Text dimColor>还没有数据。</kit.Text>
      ) : (
        <kit.Card title={section.title} subtitle={`${section.items.length} 条`}>
          <kit.ScrollList items={section.items} rows={scroll.rows} offset={scroll.offset} />
        </kit.Card>
      )}
    </kit.Box>
  )
}
