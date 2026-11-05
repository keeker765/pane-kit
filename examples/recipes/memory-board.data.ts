/**
 * 配方：把记忆目录画成看板。
 *
 * 数据直接从磁盘读，不经中间文件：别的会话改了记忆，面板下一轮就能看到。
 * 换机器只改 `MEMORY_DIR` 一行。`$` 只在这个工厂的闭包里使用。
 */

import type { Engine } from 'claude-code'

import { parseSnapshot, type Item } from '../kit/model'
import type { DataSource } from '../kit/poll'

/** 记忆目录；改成你自己的。 */
const MEMORY_DIR = 'C:/Users/29804/Desktop/memory'
/** 总索引文件名。 */
const INDEX = 'MEMORY.md'
/** 枢纽文件名后缀；这些文件是二级索引。 */
const HUB_SUFFIX = '-hub.md'
/** 最多展开几个枢纽，免得每轮读几十个文件。 */
const HUB_LIMIT = 8
/** 每个枢纽最多列几条。 */
const ENTRY_LIMIT = 12

/** 索引里的一条：标题、文件名、钩子。 */
type Entry = {
  title: string
  file: string
  hook: string
}

/** `- [标题](文件.md) — 钩子` 这一行。 */
const LINK = /^\s*[-*]\s*\[([^\]]+)\]\(([^)]+)\)\s*(?:[—-]{1,2}\s*)?(.*)$/

/** 解析一份索引文件里的链接行；顺序保持原样。 */
function parseLinks(text: string): Entry[] {
  const out: Entry[] = []
  for (const line of text.split('\n')) {
    const match = LINK.exec(line)
    if (match === null) continue
    out.push({ title: match[1].trim(), file: match[2].trim(), hook: match[3].trim() })
  }
  return out
}

/** 读一个文件；读不到就给空串，面板照旧显示其余部分。 */
async function readOrEmpty(engine: Engine, path: string): Promise<string> {
  try {
    const { text } = await engine.fs.read(path)
    return text
  } catch {
    // 单个枢纽缺失只让那一段空着，不该让整块看板报错
    return ''
  }
}

/** 把一批条目变成看板的行。 */
function toItems(entries: readonly Entry[]): readonly Item[] {
  return entries.slice(0, ENTRY_LIMIT).map(one => ({
    id: one.file,
    label: one.title,
    note: one.hook === '' ? undefined : one.hook,
  }))
}

/** 建数据源；每轮重读索引与枢纽文件。 */
export function createSource(engine: Engine): DataSource {
  return {
    kind: 'custom',
    load: async () => {
      const indexText = await readOrEmpty(engine, `${MEMORY_DIR}/${INDEX}`)
      const entries = parseLinks(indexText)
      const hubs = entries.filter(one => one.file.endsWith(HUB_SUFFIX))
      // 记忆目录里的全部 markdown，用来算「已收录 / 全部」
      const listing = await engine.fs.list(MEMORY_DIR).catch(() => [])
      const markdown = listing.filter(one => one.kind === 'file' && one.name.endsWith('.md'))
      const indexed = new Set(entries.map(one => one.file))
      // 目录列不出来就只按索引画，覆盖率那一行随之显示 0
      const sections: { id: string; title: string; items: readonly Item[] }[] = []
      for (const hub of hubs.slice(0, HUB_LIMIT)) {
        const hubText = await readOrEmpty(engine, `${MEMORY_DIR}/${hub.file}`)
        const children = parseLinks(hubText).filter(one => !one.file.endsWith(HUB_SUFFIX))
        sections.push({ id: hub.file, title: hub.title, items: toItems(children) })
      }
      // 没挂在任何枢纽下的顶层条目单独成一段，便于发现该补枢纽的主题
      const loose = entries.filter(one => !one.file.endsWith(HUB_SUFFIX))
      sections.unshift({
        id: 'index',
        title: '索引',
        items: [
          {
            id: 'coverage',
            label: `${indexed.size} 条已收录 / ${markdown.length} 个文件`,
            state: 'done' as const,
            meter: { done: indexed.size, total: Math.max(indexed.size, markdown.length) },
          },
          ...toItems(loose.slice(0, ENTRY_LIMIT)),
        ],
      })
      return {
        head: `记忆 ${hubs.length} 个枢纽`,
        sections,
      }
    },
  }
}

/** 与模板一致：坏数据保留上一份。 */
export const parse = parseSnapshot
