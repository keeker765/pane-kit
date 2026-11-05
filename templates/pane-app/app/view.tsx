/**
 * 版面：页眉 + 页签 + 一张任务卡片。
 *
 * 换排版只改这个文件；组件从 `props.kit` 取，不导入 Box / Text。
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

/** 区块里只要有一条带层级，就整块按树画。 */
function isTree(items: readonly { depth?: number }[]): boolean {
  return items.some(one => (one.depth ?? 0) > 0)
}

/** 画整块看板。 */
export function renderBoard(props: BoardProps): RenderElement {
  const { kit, data, active, onTab, scroll } = props
  const pages = data.sections.map(section => ({ id: section.id, label: section.title }))
  const firstId = pages[0]?.id ?? ''
  const currentId = pages.some(page => page.id === active) ? active : firstId
  const section = data.sections.find(one => one.id === currentId)
  const done = section?.items.filter(one => (one.state ?? 'todo') === 'done').length ?? 0
  const total = section?.items.length ?? 0
  const columns = Math.max(24, props.columns ?? 60)
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
        <kit.Card
          title={section.title}
          subtitle={
            section.chart === undefined
              ? `${done}/${total} 完成`
              : `${section.chart.kind === 'line' ? '折线' : '柱状'} · ${section.chart.values.length} 点`
          }
        >
          {/* 区块带 chart 就整块画图；其余按树或列表画 */}
          {section.chart !== undefined ? (
            <kit.Chart
              kind={section.chart.kind}
              values={section.chart.values}
              width={columns - 6}
              height={section.chart.height ?? Math.min(12, Math.max(2, scroll.rows - 2))}
              note={section.chart.note}
            />
          ) : isTree(section.items) ? (
            <kit.Tree
              items={section.items}
              collapsed={props.collapsed}
              onToggle={props.onToggle}
              columns={44}
            />
          ) : (
            <kit.ScrollList
              items={section.items}
              rows={scroll.rows}
              offset={scroll.offset}
              onSeek={props.onSeek}
              draggable
            />
          )}
        </kit.Card>
      )}
    </kit.Box>
  )
}
