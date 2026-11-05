/**
 * 套件入口：把当前绘制面的元素表绑成一组组件。
 *
 * 用户只调用 `kit.Card`、`kit.TaskList` 这类名字，不导入 `Box`、`Text`；
 * 元素表由 `$.ui.resolve(e)` 给出，所以同一份代码在终端、桌面、编辑器与手机面
 * 都画得出来（手机面没有的元素，本套件不使用）。
 */

import type { ElementTable, RenderElement } from 'claude-code'

import { renderMeter, type MeterProps } from './bars'
import { renderCard, renderStatTile, type CardProps, type StatTileProps } from './cards'
import type { PaneSnapshot, PollStatus } from './model'
import { renderTaskList, type TaskListProps } from './tasks'
import { renderTabs, type TabsProps } from './tabs'

/** 绑定后的套件；`Box`、`Text`、`Button` 也在里面，方便做布局。 */
export type Kit = {
  Box: ElementTable['Box']
  Text: ElementTable['Text']
  Button: ElementTable['Button']
  Card: (props: CardProps) => RenderElement
  StatTile: (props: StatTileProps) => RenderElement
  Meter: (props: MeterProps) => RenderElement
  TaskList: (props: TaskListProps) => RenderElement
  Tabs: (props: TabsProps) => RenderElement
}

/** 一屏看板的输入；`app/view.tsx` 的 `renderBoard` 收这个。 */
export type BoardProps = {
  /** 绑定好的套件。 */
  kit: Kit
  /** 当前数据快照。 */
  data: PaneSnapshot
  /** 轮询状态。 */
  poll: PollStatus
  /** 当前页签 id；空串表示用第一个区块。 */
  active: string
  /** 切换页签；调用方负责写 atom。 */
  onTab: (id: string) => void
}

/** 按绘制面建套件；每次渲染调用一次即可。 */
export function createKit(table: ElementTable): Kit {
  return {
    Box: table.Box,
    Text: table.Text,
    Button: table.Button,
    Card: props => renderCard(table, props),
    StatTile: props => renderStatTile(table, props),
    Meter: props => renderMeter(table, props),
    TaskList: props => renderTaskList(table, props),
    Tabs: props => renderTabs(table, props),
  }
}
