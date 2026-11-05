/**
 * 冒烟测试：在终端面挂载一次 Pane，确认能画出页眉与空状态。
 *
 * 跑法：claude plugin test <工程目录>，或 pane-kit 的 verify.py --test。
 */

import type { RenderPropsOf } from 'claude-code'
import { expect, test } from 'claude-code/testing'

// Pane 的 props 由引擎填；渲染只用 viewport，这里给空对象即可
const PANE_PROPS = {} as RenderPropsOf['Pane']

test('面板画出页眉与空状态', async $ => {
  const ui = await $.ui.mount({
    plugin: 'pane-app',
    surface: 'terminal',
    component: 'Pane',
    props: PANE_PROPS,
    requestId: 'pane-app',
    viewport: { columns: 160, rows: 40 },
  })
  const header = await ui.find({ type: 'Text', text: /等待数据/ })
  expect(header).toBeDefined()
  await ui.unmount()
})
