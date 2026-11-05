/**
 * 可拖动的滚动条：`Client` 绘制面模块，由 `kit/scroll.tsx` 挂载。
 *
 * 一条竖线，按指针位置换算成首行行号，用 `surface.post` 交给插件去写 atom。
 * 按下后拖动持续生效，松开为止；点一下等于跳到那一点。
 */

import type { ClientSurface } from 'claude-code'

/** 由 `scroll.tsx` 传进来的数据。 */
type BarProps = {
  /** 当前首行行号。 */
  offset: number
  /** 窗口高度，单位屏幕行。 */
  rows: number
  /** 内容总行数。 */
  content: number
}

/** 最近一次收到的 props；指针回调注册得早，读它才拿到新值。 */
let latest: BarProps = { offset: 0, rows: 1, content: 0 }

/** 按下期间的拖动状态；`down` 置真，`up` 置假。 */
let dragging = false

/** 把指针所在行换算成首行行号。 */
function offsetAt(row: number, height: number): number {
  const last = Math.max(0, latest.content - latest.rows)
  if (last === 0) return 0
  const ratio = (row + 0.5) / Math.max(1, height)
  return Math.max(0, Math.min(last, Math.round(ratio * last)))
}

/** 画一条滚动条并处理指针。 */
export default function ClientScrollBar(props: BarProps, surface: ClientSurface) {
  const { Box, Text } = surface.elements
  latest = props
  const height = Math.max(1, surface.rows || props.rows)
  // 指针监听只挂一次：重绘会反复调用本函数，重复注册会叠加
  if (surface.state === undefined) {
    surface.setState({ ready: true })
    surface.onPointer(event => {
      const isLeft = event.button === undefined || event.button === 'left'
      if (!isLeft) return
      // 按下与拖动都跳转；松开只收尾
      if (event.type === 'up') {
        dragging = false
        return
      }
      if (event.type === 'down') dragging = true
      if (event.type !== 'down' && !dragging) return
      surface.post({ offset: offsetAt(event.y, height) })
    })
  }
  const thumb = Math.max(1, Math.min(height, Math.round((props.rows * height) / Math.max(1, props.content))))
  const travel = height - thumb
  const last = Math.max(1, props.content - props.rows)
  const start = Math.round((Math.max(0, Math.min(props.offset, last)) / last) * travel)
  const cells = Array.from({ length: height }, (_unused, index) =>
    index >= start && index < start + thumb ? '█' : '│',
  )
  return (
    <Box flexDirection="column">
      {cells.map((cell, index) => (
        <Text key={`bar-${index}`} dimColor>
          {cell}
        </Text>
      ))}
    </Box>
  )
}
