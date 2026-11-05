/**
 * 配方：HTTP 轮询。一个本地服务按同一份契约返回 JSON。
 */

import type { Engine } from 'claude-code'

import { parseSnapshot } from '../kit/model'
import type { DataSource } from '../kit/poll'

/** 建数据源；HTTP 来源不使用 `$`，请求由轮询器经宿主发出。 */
export function createSource(_engine: Engine): DataSource {
  return { kind: 'http', url: 'http://127.0.0.1:8787/board' }
}

export const parse = parseSnapshot
