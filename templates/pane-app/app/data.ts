/**
 * 数据源配置：默认读工作目录下的 pane-data.json。
 *
 * 换来源只改这个文件；`parse` 保留契约校验，除非你自己产出的形状完全可信。
 * 自定义来源在这里拿 `$`：引擎只允许 `$` 留在闭包里，不能作为值传递。
 */

import type { Engine } from 'claude-code'

import { parseSnapshot } from '../kit/model'
import type { DataSource } from '../kit/poll'

/** 建数据源；文件来源不使用 `$`。 */
export function createSource(_engine: Engine): DataSource {
  return { kind: 'file', path: 'pane-data.json' }
}

/** 把文本读成 PaneSnapshot；坏数据抛错，轮询器保留上一份。 */
export const parse = parseSnapshot
