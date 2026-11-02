import { expect, test } from 'claude-code/testing'

const VIEWPORT = { columns: 120, rows: 40 }

test('a finished Read mounted on the terminal renders what the engine draws', async ($, on) => {
  on('ui.render', { component: 'ToolUse' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text key="engine-row">engine row</Text>
  })
  const ui = await $.ui.mount({
    plugin: 'image-render',
    surface: 'terminal',
    component: 'ToolUse',
    props: {
      tool_use_id: 'toolu_1',
      tool: 'Read',
      input: { file_path: '/repo/notes.txt' },
      isRunning: false,
      isErrored: false,
      isInterrupted: false,
      output: { type: 'text', file: { filePath: '/repo/notes.txt', content: 'hello', numLines: 1, startLine: 1, totalLines: 1 } },
    },
    viewport: VIEWPORT,
  })

  expect(await ui.find({ text: 'engine row' })).toBeDefined()
  const drawn = await ui.findAll({})
  expect(drawn).toHaveLength(1)
  expect(drawn[0]).toMatchObject({ type: 'Text', text: 'engine row' })
})

test('a finished Bash mounted on the terminal renders what the engine draws', async ($, on) => {
  on('ui.render', { component: 'ToolUse' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text key="engine-row">engine row</Text>
  })
  const ui = await $.ui.mount({
    plugin: 'image-render',
    surface: 'terminal',
    component: 'ToolUse',
    props: {
      tool_use_id: 'toolu_2',
      tool: 'Bash',
      input: { command: 'echo hello' },
      isRunning: false,
      isErrored: false,
      isInterrupted: false,
      output: { stdout: 'hello', stderr: '', interrupted: false },
    },
    viewport: VIEWPORT,
  })

  expect(await ui.find({ text: 'engine row' })).toBeDefined()
  const drawn = await ui.findAll({})
  expect(drawn).toHaveLength(1)
  expect(drawn[0]).toMatchObject({ type: 'Text', text: 'engine row' })
})
