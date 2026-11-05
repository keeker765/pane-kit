/**
 * 可折叠的计划树。
 *
 * 层级靠每条自己的 `depth` 描述，不另建父子表：下一行比自己深就算子节点。
 * 折叠只影响显示，不改数据 —— 展开状态由调用方存在 atom 里，重绘不丢。
 * 有子节点的行是 `Button`，能点也能用键盘激活；叶子行只是文字。
 */

import type { ElementTable, RenderElement } from 'claude-code'

import { stateOf, TONE_MARK, toneColor, type Item } from './model'
import { clipToWidth } from './width'

/** 折叠后的一行：条目、层级、有没有子节点、当前是否展开。 */
export type TreeRow = {
  /** 原始条目。 */
  item: Item
  /** 缩进层级，0 是顶层。 */
  depth: number
  /** 下一行是否更深；有子节点的行才画三角。 */
  hasChildren: boolean
  /** 是否处于展开状态；叶子恒为真。 */
  open: boolean
}

/** 展开与折叠的三角。 */
const OPEN_MARK = '▾'
const CLOSED_MARK = '▸'

/** 按折叠集合算出该显示哪些行；被折叠节点的后代整段跳过。 */
export function buildTree(items: readonly Item[], collapsed: readonly string[]): readonly TreeRow[] {
  const closed = new Set(collapsed)
  const rows: TreeRow[] = []
  // 非空时表示正处在一个折叠节点内部，记录那个节点的层级
  let hidingBelow: number | null = null
  items.forEach((item, index) => {
    const depth = Math.max(0, item.depth ?? 0)
    // 比折叠节点更深的一律不画；回到同层或更浅就退出折叠区
    if (hidingBelow !== null) {
      if (depth > hidingBelow) return
      hidingBelow = null
    }
    const next = items[index + 1]
    const hasChildren = next !== undefined && Math.max(0, next.depth ?? 0) > depth
    const open = !closed.has(item.id)
    rows.push({ item, depth, hasChildren, open })
    // 有子节点又收起时，从这里开始藏后代
    if (hasChildren && !open) hidingBelow = depth
  })
  return rows
}

/** 树组件的输入。 */
export type TreeProps = {
  /** 整份条目，顺序即显示顺序，靠 `depth` 表达层级。 */
  items: readonly Item[]
  /** 已收起的节点 id。 */
  collapsed: readonly string[]
  /** 点一下三角时调用；调用方负责写 atom。 */
  onToggle: (id: string) => void
  /** 文字可用列数，含缩进与符号；默认 40。 */
  columns?: number
}

/** 画一行：缩进 + 三角 + 状态符号 + 标签。 */
function renderTreeRow(
  table: ElementTable,
  row: TreeRow,
  columns: number,
  onToggle: (id: string) => void,
): RenderElement {
  const { Box, Text, Button } = table
  const tone = stateOf(row.item)
  const text = clipToWidth(` ${row.item.label}`, Math.max(8, columns - row.depth * 2 - 4))
  // Button 只收字符串与 Text，所以三段落子元素各自带 key，不包 Fragment
  const triangle = (
    <Text key="triangle" color="gray">
      {row.hasChildren ? (row.open ? OPEN_MARK : CLOSED_MARK) : ' '}
    </Text>
  )
  const mark = (
    <Text key="mark" color={toneColor(tone)}>
      {TONE_MARK[tone]}
    </Text>
  )
  const label = <Text key="label">{text}</Text>
  // 有子节点的行整行可点；叶子行没有可折叠的东西，不做成按钮
  if (row.hasChildren) {
    return (
      <Box key={row.item.id} marginLeft={row.depth * 2}>
        <Button key={row.item.id} plain onPress={() => onToggle(row.item.id)}>
          {triangle}
          {mark}
          {label}
        </Button>
      </Box>
    )
  }
  return (
    <Box key={row.item.id} flexDirection="row" marginLeft={row.depth * 2}>
      {triangle}
      {mark}
      {label}
    </Box>
  )
}

/** 画整棵树。 */
export function renderTree(table: ElementTable, props: TreeProps): RenderElement {
  const { Box } = table
  const columns = Math.max(16, props.columns ?? 40)
  const rows = buildTree(props.items, props.collapsed)
  return (
    <Box flexDirection="column">
      {rows.map(row => renderTreeRow(table, row, columns, props.onToggle))}
    </Box>
  )
}
