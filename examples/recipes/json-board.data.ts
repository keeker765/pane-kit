/**
 * 配方：文件轮询。另一个进程把 JSON 快照写到工作目录。
 */

import type { Engine } from 'claude-code'

import { parseSnapshot } from '../kit/model'
import type { DataSource } from '../kit/poll'

/** 建数据源；文件来源不使用 `$`。 */
export function createSource(_engine: Engine): DataSource {
  return { kind: 'file', path: 'pane-data.json' }
}

export const parse = parseSnapshot
