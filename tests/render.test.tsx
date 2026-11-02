import { expect, test } from 'claude-code/testing'
import type { Engine, TestBody } from 'claude-code/testing'

import { parsePng } from '../hooks/png'

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

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function pngBytes(width: number, height: number, size = 33): Uint8Array {
  const bytes = new Uint8Array(size)
  const view = new DataView(bytes.buffer)
  bytes.set(SIGNATURE, 0)
  bytes.set([0x49, 0x48, 0x44, 0x52], 12)
  view.setUint32(16, width)
  view.setUint32(20, height)

  return bytes
}

const base64Of = (bytes: Uint8Array) => btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))
const pngBase64 = (width: number, height: number, size?: number) => base64Of(pngBytes(width, height, size))

type Mounted = {
  surface?: 'terminal' | 'desktop'
  tool?: string
  state?: { isRunning?: boolean; isErrored?: boolean; isInterrupted?: boolean }
  output: unknown
  viewport?: { columns: number; rows: number } | undefined
}

async function mountRead($: Engine, on: Parameters<TestBody>[1], mounted: Mounted) {
  on('ui.render', { component: 'ToolUse' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text key="engine">engine row</Text>
  })

  return $.ui.mount({
    plugin: 'image-render',
    surface: mounted.surface ?? 'terminal',
    component: 'ToolUse',
    props: {
      tool_use_id: 'toolu_9',
      tool: mounted.tool ?? 'Read',
      input: { file_path: '/repo/shot.png' },
      isRunning: false,
      isErrored: false,
      isInterrupted: false,
      ...mounted.state,
      output: mounted.output,
    },
    ...('viewport' in mounted ? { viewport: mounted.viewport } : { viewport: VIEWPORT }),
  } as never)
}

const imageOutput = (base64: string, type = 'image/png') => ({ type: 'image', file: { base64, type, originalSize: 1 } })

const sizes: Array<[string, number, number, number, number]> = [
  ['a wide picture is drawn 60 columns wide', 1600, 400, 60, 8],
  ['a tall picture shrinks to the row cap', 400, 1600, 16, 32],
  ['a picture exactly at the row cap keeps the full width', 600, 640, 60, 32],
  ['a picture just above the row cap narrows', 600, 650, 59, 32],
  ['a picture keeps its aspect at 60 columns', 1130, 640, 60, 17],
]

for (const [title, width, height, columns, rows] of sizes) {
  test('a PNG Read draws the picture under the engine row: ' + title, async ($, on) => {
    const base64 = pngBase64(width, height)
    const ui = await mountRead($, on, { output: imageOutput(base64) })
    const drawn = (await ui.findAll({})).filter(node => node.type === 'Text' || node.type === 'Image')

    expect(drawn.map(node => node.type)).toEqual(['Text', 'Image'])
    expect(drawn[0]).toMatchObject({ text: 'engine row' })
    expect(drawn[1]?.props).toMatchObject({ source: { png: base64 }, columns, rows })
    expect(String(drawn[1]?.props.alt)).toContain('shot.png')
  })
}

test('a PNG Read with no viewport draws the picture 60 columns wide', async ($, on) => {
  const ui = await mountRead($, on, { output: imageOutput(pngBase64(100, 40)), viewport: undefined })
  const image = await ui.find({ type: 'Image' })

  expect(image?.props).toMatchObject({ columns: 60, rows: 12 })
})

const narrow: Array<[string, number, number, number]> = [
  ['a viewport leaving exactly 60 columns', 67, 60, 8],
  ['a viewport leaving 59 columns', 66, 59, 7],
  ['a 50-column viewport', 50, 43, 5],
]

for (const [title, viewportColumns, columns, rows] of narrow) {
  test('a PNG Read narrows the picture to the room the terminal leaves: ' + title, async ($, on) => {
    const ui = await mountRead($, on, { output: imageOutput(pngBase64(1600, 400)), viewport: { columns: viewportColumns, rows: 40 } })
    const image = await ui.find({ type: 'Image' })

    expect(image?.props).toMatchObject({ columns, rows })
  })
}

const engineRowOnly: Array<[string, Mounted]> = [
  ['a JPEG Read', { output: imageOutput(pngBase64(10, 10), 'image/jpeg') }],
  ['a running PNG Read', { state: { isRunning: true }, output: imageOutput(pngBase64(10, 10)) }],
  ['an errored PNG Read', { state: { isErrored: true }, output: imageOutput(pngBase64(10, 10)) }],
  ['an interrupted PNG Read', { state: { isInterrupted: true }, output: imageOutput(pngBase64(10, 10)) }],
  ['a Bash ToolUse', { tool: 'Bash', output: imageOutput(pngBase64(10, 10)) }],
  ['a PNG Read off the terminal', { surface: 'desktop', output: imageOutput(pngBase64(10, 10)) }],
  ['a PNG over 2 MiB decoded', { output: imageOutput(pngBase64(10, 10, 2097153)) }],
  ['an output with no file', { output: { type: 'image' } }],
  ['a non-string base64', { output: { type: 'image', file: { base64: 7, type: 'image/png', originalSize: 1 } } }],
  ['bytes without the PNG signature', { output: imageOutput(base64Of(new Uint8Array(33))) }],
  ['a truncated header', { output: imageOutput(base64Of(pngBytes(10, 10).slice(0, 20))) }],
  ['a zero width', { output: imageOutput(pngBase64(0, 10)) }],
  ['a zero height', { output: imageOutput(pngBase64(10, 0)) }],
]

for (const [title, mounted] of engineRowOnly) {
  test(title + ' renders the engine row alone', async ($, on) => {
    const ui = await mountRead($, on, mounted)
    const drawn = await ui.findAll({})

    expect(drawn).toHaveLength(1)
    expect(drawn[0]).toMatchObject({ type: 'Text', text: 'engine row' })
  })
}

test('a PNG of exactly 2 MiB decoded is drawn', async ($, on) => {
  const ui = await mountRead($, on, { output: imageOutput(pngBase64(10, 10, 2097152)) })

  expect(await ui.findAll({ type: 'Image' })).toHaveLength(1)
})

const readInput = { file_path: '/repo/shot.png' }

test('parsePng returns the PNG a Read produced with its size and file name', () => {
  const base64 = pngBase64(1600, 400)

  expect(parsePng(imageOutput(base64), readInput)).toEqual({ base64, width: 1600, height: 400, name: 'shot.png' })
})

test('parsePng reads width and height as unsigned', () => {
  expect(parsePng(imageOutput(pngBase64(0xffffffff, 0xffffffff)), readInput)).toMatchObject({ width: 4294967295, height: 4294967295 })
})

test('parsePng names a PNG image.png when the input has no file path', () => {
  expect(parsePng(imageOutput(pngBase64(10, 10)), {})?.name).toBe('image.png')
})

test('parsePng returns a PNG of exactly 2 MiB decoded', () => {
  expect(parsePng(imageOutput(pngBase64(10, 10, 2097152)), readInput)).toBeDefined()
})

const rejected: Array<[string, unknown]> = [
  ['a non-object output', 'not an object'],
  ['a null output', null],
  ['an output whose type is not image', { ...imageOutput(pngBase64(10, 10)), type: 'text' }],
  ['an output with no file', { type: 'image' }],
  ['a JPEG', imageOutput(pngBase64(10, 10), 'image/jpeg')],
  ['a non-string base64', { type: 'image', file: { base64: 7, type: 'image/png', originalSize: 1 } }],
  ['2 MiB plus one byte decoded', imageOutput(pngBase64(10, 10, 2097153))],
  ['33 zero bytes with no signature', imageOutput(base64Of(new Uint8Array(33)))],
  [
    'a signature with one byte changed',
    imageOutput(base64Of(Uint8Array.from(pngBytes(10, 10), (byte, index) => (index === 7 ? byte ^ 1 : byte)))),
  ],
  ['a header of 20 bytes', imageOutput(base64Of(pngBytes(10, 10).slice(0, 20)))],
  ['a header of 23 bytes with a non-zero height', imageOutput(base64Of(pngBytes(10, 0x01020304).slice(0, 23)))],
  ['a width of zero', imageOutput(pngBase64(0, 10))],
  ['a height of zero', imageOutput(pngBase64(10, 0))],
  ['base64 invalid in its first 32 characters', imageOutput('!'.repeat(32) + pngBase64(10, 10).slice(32))],
  ['an empty base64', imageOutput('')],
]

for (const [title, output] of rejected) {
  test('parsePng returns nothing for ' + title, () => {
    expect(parsePng(output, readInput)?.name).toBeUndefined()
  })
}
