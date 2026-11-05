/**
 * 面板内的页签。
 *
 * 页签用 `Button` 画：`plain` 去掉边框，首个页签配数字热键。
 * 热键只在面板持有键盘时生效，鼠标点击始终可用。
 */

import type { ElementTable, RenderElement } from 'claude-code'

/** 一个页签。 */
export type TabPage = {
  /** 区块 id，切换时回传。 */
  id: string
  /** 页签文字。 */
  label: string
}

/** 页签栏的输入。 */
export type TabsProps = {
  /** 全部页签，按显示顺序。 */
  pages: readonly TabPage[]
  /** 当前页签的 id。 */
  active: string
  /** 点按或热键切换时调用。 */
  onPick: (id: string) => void
}

/** 画页签栏；第 1–9 个页签带数字热键。 */
export function renderTabs(table: ElementTable, props: TabsProps): RenderElement {
  const { Box, Button } = table
  return (
    <Box flexDirection="row" gap={1}>
      {props.pages.map((page, index) => (
        <Button
          key={page.id}
          plain
          dimColor={page.id !== props.active}
          hotkey={index < 9 ? String(index + 1) : undefined}
          onPress={() => props.onPick(page.id)}
        >
          {page.label}
        </Button>
      ))}
    </Box>
  )
}
