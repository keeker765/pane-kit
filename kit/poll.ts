/**
 * 轮询器：文件、HTTP、子进程、自定义四种数据源。
 *
 * 负责间隔、指数退避、超时与状态回调。渲染只读结果，不在这里写 atom；
 * 写状态的函数由调用方传入（`onData` / `onStatus`）。
 */

import type { Engine } from 'claude-code'

import { parseSnapshot, type PaneSnapshot, type PollStatus } from './model'

/** 数据源；四种形态互斥。 */
export type DataSource =
  | {
      kind: 'file'
      /** 文件路径，相对工作目录或绝对路径。 */
      path: string
    }
  | {
      kind: 'http'
      /** http 或 https 地址；请求走宿主网络。 */
      url: string
      method?: string
      headers?: Record<string, string>
      body?: string
    }
  | {
      kind: 'process'
      /** 命令与参数；无 shell。 */
      argv: readonly string[]
    }
  | {
      kind: 'custom'
      /** 直接读引擎数据的取数函数；`$` 已在工厂里闭包，不再传参。 */
      load: () => Promise<PaneSnapshot>
    }

/** 轮询器的输入。 */
export type PollOptions = {
  /** 数据来源。 */
  source: DataSource
  /** 成功后的间隔，默认 3000 ms。 */
  intervalMs?: number
  /** 单次取数的超时，默认 15000 ms。 */
  timeoutMs?: number
  /** 文本解析器；默认按面板契约校验。 */
  parse?: (text: string) => PaneSnapshot
  /** 取到数据时调用；在这里写快照 atom。 */
  onData: (snapshot: PaneSnapshot) => void | Promise<void>
  /** 每次轮询后调用；在这里写状态 atom。 */
  onStatus: (status: PollStatus) => void | Promise<void>
}

/** 轮询器的句柄。 */
export type Poller = {
  /** 开始轮询；重复调用无效果。 */
  start: () => void
  /** 停止轮询并取消下一次。 */
  stop: () => void
  /** 立刻取一次，不等当前间隔。 */
  refresh: () => void
}

/** 首次失败后的等待时长。 */
const BASE_DELAY_MS = 2000

/** 退避的上限。 */
const MAX_DELAY_MS = 60000

/** 把未知异常变成一行可读文本。 */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** 给一次取数加超时；超时算一次失败。 */
function withTimeout<T>(engine: Engine, work: Promise<T>, timeoutMs: number): Promise<T> {
  const timeout = engine.clock.sleep(timeoutMs).then(() => {
    throw new Error(`超时：${timeoutMs} ms 未返回`)
  })
  return Promise.race([work, timeout])
}

/** 失败次数对应的等待时长，带 ±20% 抖动。 */
function nextDelay(failures: number): number {
  const base = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (failures - 1))
  return Math.round(base * (0.8 + Math.random() * 0.4))
}

/** 建一个轮询器；调用 `start()` 才开始。`$` 作为参数传入，不能塞进对象。 */
export function createPoller(engine: Engine, options: PollOptions): Poller {
  const { source } = options
  const intervalMs = options.intervalMs ?? 3000
  const timeoutMs = options.timeoutMs ?? 15000
  const parse = options.parse ?? parseSnapshot
  let timer: { cancel: () => void } | undefined
  let failures = 0
  let isStopped = true
  let isRunning = false

  /** 按数据源取一次原始结果。 */
  const load = async (): Promise<PaneSnapshot> => {
    switch (source.kind) {
      case 'file': {
        const text = await engine.fs.read(source.path)
        return parse(text)
      }
      case 'http': {
        const response = await engine.http.fetch(source.url, {
          method: source.method,
          headers: source.headers,
          body: source.body,
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return parse(response.text)
      }
      case 'process': {
        const result = await engine.process.run([...source.argv])
        if (result.exitCode !== 0) {
          throw new Error(result.stderr.trim() || `进程退出码 ${result.exitCode}`)
        }
        return parse(result.stdout)
      }
      case 'custom':
        return source.load()
    }
  }

  /** 安排下一次；同一时刻只有一个待触发定时器。 */
  const schedule = (delay: number) => {
    if (isStopped) return
    timer?.cancel()
    timer = engine.clock.after(delay, () => {
      void run()
    })
  }

  /** 取一次，成功写状态、失败退避。 */
  const run = async () => {
    if (isRunning || isStopped) return
    isRunning = true
    try {
      const value = await withTimeout(engine, load(), timeoutMs)
      failures = 0
      await options.onData(value)
      await options.onStatus({ kind: 'ok', updated: Date.now() })
      schedule(intervalMs)
    } catch (error) {
      failures += 1
      // 前两次算「数据陈旧」，第三次起才算错误；都不清空上一份数据
      await options.onStatus({
        kind: failures > 2 ? 'error' : 'stale',
        message: messageOf(error),
      })
      schedule(nextDelay(failures))
    } finally {
      isRunning = false
    }
  }

  return {
    start: () => {
      if (!isStopped) return
      isStopped = false
      void run()
    },
    stop: () => {
      isStopped = true
      timer?.cancel()
      timer = undefined
    },
    refresh: () => {
      if (isStopped) return
      timer?.cancel()
      void run()
    },
  }
}
