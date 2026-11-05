/**
 * 轮子的纯函数测试：折叠树的可见行、滚动条换算、按格截断。
 *
 * 这些逻辑不进引擎也能验，比只挂一次 Pane 更能挡住回归。
 */

import { expect, test } from 'claude-code/testing'

import { bigChart, columnChart, lineChart, sparkline } from '../kit/chart'
import type { Item } from '../kit/model'
import { scrollBarCells, seekOffset } from '../kit/scroll'
import { buildTree } from '../kit/tree'
import { clipToWidth, displayWidth } from '../kit/width'

/** 一条带层级的条目。 */
function node(id: string, depth: number): Item {
  return { id, label: id, depth }
}

test('折叠根节点后只剩根', async () => {
  const items = [node('a', 0), node('b', 1), node('c', 2), node('d', 0)]
  expect(buildTree(items, []).length).toBe(4)
  expect(buildTree(items, ['a']).length).toBe(2)
})

test('折叠中间节点只隐藏它的后代', async () => {
  const items = [node('a', 0), node('b', 1), node('c', 2), node('d', 1)]
  const rows = buildTree(items, ['b'])
  expect(rows.map(row => row.item.id).join(',')).toBe('a,b,d')
})

test('点滚动条的顶与底落在两端', async () => {
  expect(seekOffset(0, 10, 100)).toBe(0)
  expect(seekOffset(9, 10, 100)).toBe(90)
  expect(seekOffset(5, 10, 5)).toBe(0)
})

test('内容装得下时滚动条整列留空', async () => {
  expect(scrollBarCells(0, 10, 8, 10).every(cell => cell === ' ')).toBe(true)
})

test('中文按两格算，截断不切半个字', async () => {
  expect(displayWidth('中文ab')).toBe(6)
  expect(clipToWidth('中文字', 4)).toBe('中…')
})

test('折线按宽度上限压缩，全零画最低档', async () => {
  const values = Array.from({ length: 40 }, (_unused, index) => index)
  expect(sparkline(values, 10).length).toBe(10)
  expect(sparkline([0, 0, 0, 0])).toBe('▁▁▁▁')
})

test('柱状图峰值列顶行满格，零值列留空', async () => {
  const rows = columnChart([0, 10, 5], 4)
  expect(rows.length).toBe(4)
  expect(rows[0][1]).toBe('█')
  expect(rows[0][0]).toBe(' ')
})

test('整块折线底部起点与顶部峰值对齐', async () => {
  const rows = lineChart([0, 5, 10], 4, 4)
  expect(rows.length).toBe(4)
  expect(rows[3][0]).toBe('█')
  expect(rows[0][3]).toBe('█')
})

test('整块柱状图铺满指定宽度', async () => {
  const rows = bigChart([1, 5, 3], 5, 2)
  expect(rows.length).toBe(2)
  expect(rows[0].length).toBe(5)
})
