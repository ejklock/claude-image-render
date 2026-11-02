import { expect, test } from 'claude-code/testing'
import type { Engine, TestBody } from 'claude-code/testing'
import type { FsBytes, FsReadBytesOptions, FsReadOptions } from 'claude-code'

import { convertedPng } from '../hooks/convert'
import type { ConvertHost } from '../hooks/convert'
import { parsePng, readPng } from '../hooks/png'

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
  input?: unknown
  state?: { isRunning?: boolean; isErrored?: boolean; isInterrupted?: boolean }
  output: unknown
  viewport?: { columns: number; rows: number } | undefined
}

async function mountRead($: Engine, on: Parameters<TestBody>[1], mounted: Mounted) {
  on('ui.render', { component: 'ToolUse' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text key="engine-row">engine row</Text>
  })

  return $.ui.mount({
    plugin: 'image-render',
    surface: mounted.surface ?? 'terminal',
    component: 'ToolUse',
    props: {
      tool_use_id: 'toolu_9',
      tool: mounted.tool ?? 'Read',
      input: mounted.input ?? { file_path: '/repo/shot.png' },
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

const ran = (exitCode: number, stdout = '') => ({ value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })

const sizeLines = (width: number | string, height: number | string) => `/repo/photo.jpg\n  pixelWidth: ${width}\n  pixelHeight: ${height}\n`

type Answer = 'ok' | number | Error

type HostAnswers = {
  tmp?: string
  env?: Error
  session?: Error
  size?: string | Answer
  sips?: Answer
  magick?: Answer
  scratch?: string | Error
  removal?: Error
  write?: Error
}

function runAnswer(given: Answer | undefined, stdout = '') {
  if (given instanceof Error) throw given

  return ran(given === undefined || given === 'ok' ? 0 : given, stdout)
}

/** Answers every run: the sips size query, the converter by its executable, `rm` as `removal` says. A failing `sips` fails its size query too. */
function runnerOf(answers: HostAnswers, argv: readonly string[]) {
  if (argv[0] === 'rm') return runAnswer(answers.removal ?? 'ok')
  if (argv[0] === '/usr/bin/sips' && argv[1] === '-g') {
    if (typeof answers.size === 'string') return runAnswer('ok', answers.size)
    if (answers.size !== undefined) return runAnswer(answers.size)
    if (answers.sips !== undefined && answers.sips !== 'ok') return runAnswer(answers.sips)

    return runAnswer('ok', sizeLines(1600, 900))
  }

  return runAnswer(argv[0] === '/usr/bin/sips' ? answers.sips : answers.magick)
}

/** Stubs the host: converters answer as told, `fs.read` answers the scratch, every run, write and read is recorded. */
function answerHost(on: Parameters<TestBody>[1], answers: HostAnswers = {}) {
  const runs: string[][] = []
  const reads: string[] = []
  const writes: string[] = []
  const limits: Array<number | undefined> = []
  on('env.get', () => {
    if (answers.env !== undefined) throw answers.env

    return { value: answers.tmp }
  })
  on('session.id', () => {
    if (answers.session !== undefined) throw answers.session

    return { value: 'sess/1' }
  })
  on('fs.write', (_, { path }) => {
    if (answers.write !== undefined) throw answers.write
    writes.push(path)

    return { value: undefined }
  })
  on('fs.read', (_, { path }) => {
    reads.push(path)
    if (answers.scratch instanceof Error) throw answers.scratch

    return { value: { base64: answers.scratch ?? pngBase64(1600, 400) } }
  })
  on('process.run', (_, { argv, init }) => {
    runs.push([...argv])
    if (argv[0] !== 'rm') limits.push(init?.timeoutMs)

    return runnerOf(answers, argv)
  })

  return Object.assign(runs, { reads, writes, limits })
}

const converterRuns = (runs: string[][]) => runs.filter(argv => argv[0] !== 'rm')
const removals = (runs: string[][]) => runs.filter(argv => argv[0] === 'rm')
const jpegRead = (file_path = '/repo/photo.jpg') => ({ input: { file_path }, output: imageOutput(base64Of(new Uint8Array(40)), 'image/jpeg') })
const bootFailure = new Error('cannot start')

const converted: Array<[string, string, string, string]> = [
  ['a JPEG', '/repo/photo.jpg', 'image/jpeg', 'jpeg:'],
  ['a GIF', '/repo/photo.gif', 'image/gif', 'gif:'],
  ['a WebP', '/repo/photo.webp', 'image/webp', 'webp:'],
]

for (const [title, path, mime, prefix] of converted) {
  test(title + ' Read draws the sips PNG under the engine row, sized like a PNG Read', async ($, on) => {
    const runs = answerHost(on)
    const ui = await mountRead($, on, { input: { file_path: path }, output: imageOutput(base64Of(new Uint8Array(40)), mime) })
    const drawn = (await ui.findAll({})).filter(node => node.type === 'Text' || node.type === 'Image')
    const scratch = runs.writes[0] ?? ''

    expect(drawn.map(node => node.type)).toEqual(['Text', 'Image'])
    expect(drawn[0]).toMatchObject({ text: 'engine row' })
    expect(drawn[1]?.props).toMatchObject({ source: { png: pngBase64(1600, 400) }, columns: 60, rows: 8 })
    expect(String(drawn[1]?.props.alt)).toContain(path.split('/').pop())
    expect(runs.reads).toEqual([scratch])
    expect(converterRuns(runs)).toEqual([
      ['/usr/bin/sips', '-g', 'pixelWidth', '-g', 'pixelHeight', path],
      ['/usr/bin/sips', '-s', 'format', 'png', '-Z', '1024', path, '--out', scratch],
    ])
  })

  test(title + ' Read falls back to magick with the matching format prefix when sips exits non-zero', async ($, on) => {
    const runs = answerHost(on, { sips: 1 })
    const ui = await mountRead($, on, { input: { file_path: path }, output: imageOutput(base64Of(new Uint8Array(40)), mime) })
    const scratch = runs.writes[0] ?? ''

    expect(await ui.findAll({ type: 'Image' })).toHaveLength(1)
    expect(converterRuns(runs)[1]).toEqual(['/usr/bin/env', 'magick', prefix + path + '[0]', '-resize', '1024x1024>', 'png:' + scratch])
  })
}

test('a Read draws the magick PNG when sips cannot start', async ($, on) => {
  const runs = answerHost(on, { sips: bootFailure })
  const ui = await mountRead($, on, jpegRead())

  expect(await ui.findAll({ type: 'Image' })).toHaveLength(1)
  expect(converterRuns(runs).map(argv => argv[1] ?? argv[0])).toEqual(['-g', 'magick'])
})

test('a path holding spaces reaches the converters as one argv element', async ($, on) => {
  const runs = answerHost(on, { sips: 1 })
  await mountRead($, on, jpegRead('/my repo/a photo.jpg'))
  const [sips, magick] = converterRuns(runs)

  expect(sips?.[5]).toBe('/my repo/a photo.jpg')
  expect(magick?.[2]).toBe('jpeg:/my repo/a photo.jpg[0]')
})

test('each converter runs with a five second limit', async ($, on) => {
  const runs = answerHost(on, { sips: 1 })
  await mountRead($, on, jpegRead())

  expect(runs.limits).toEqual([5000, 5000])
})

const unconverted: Array<[string, HostAnswers]> = [
  ['both converters cannot start', { sips: bootFailure, magick: bootFailure }],
  ['both converters exit non-zero', { sips: 1, magick: 2 }],
  ['sips times out and magick exits non-zero', { sips: new Error('timed out'), magick: 1 }],
  ['the scratch cannot be read', { scratch: new Error('missing') }],
  ['the scratch has no PNG signature', { scratch: base64Of(new Uint8Array(33)) }],
  ['the scratch PNG is over 2 MiB decoded', { scratch: pngBase64(10, 10, 2097153) }],
]

for (const [title, answers] of unconverted) {
  test('a JPEG Read renders the engine row alone when ' + title, async ($, on) => {
    answerHost(on, answers)
    const ui = await mountRead($, on, jpegRead())
    const drawn = await ui.findAll({})

    expect(drawn).toHaveLength(1)
    expect(drawn[0]).toMatchObject({ type: 'Text', text: 'engine row' })
  })
}

test('a JPEG Read renders the engine row alone when the scratch directory cannot be made', async ($, on) => {
  const runs = answerHost(on, { write: new Error('read-only') })
  const ui = await mountRead($, on, jpegRead())

  expect(await ui.findAll({})).toHaveLength(1)
  expect(converterRuns(runs)).toEqual([])
})

const noConversion: Array<[string, Mounted, number]> = [
  ['a relative file path', jpegRead('photo.jpg'), 0],
  ['no file path', { input: {}, output: jpegRead().output }, 0],
  ['a non-string file path', { input: { file_path: 7 }, output: jpegRead().output }, 0],
  ['a BMP', { ...jpegRead(), output: imageOutput(base64Of(new Uint8Array(40)), 'image/bmp') }, 0],
  ['a running JPEG Read', { ...jpegRead(), state: { isRunning: true } }, 0],
  ['an errored JPEG Read', { ...jpegRead(), state: { isErrored: true } }, 0],
  ['an interrupted JPEG Read', { ...jpegRead(), state: { isInterrupted: true } }, 0],
  ['a JPEG Read off the terminal', { ...jpegRead(), surface: 'desktop' }, 0],
  ['a JPEG output of a Bash ToolUse', { ...jpegRead(), tool: 'Bash' }, 0],
  ['a PNG Read', { output: imageOutput(pngBase64(10, 10)) }, 1],
]

for (const [title, mounted, images] of noConversion) {
  test(title + ' runs no process', async ($, on) => {
    const runs = answerHost(on)
    const ui = await mountRead($, on, mounted)

    expect(runs).toEqual([])
    expect(runs.writes).toEqual([])
    expect(await ui.findAll({ type: 'Image' })).toHaveLength(images)
  })
}

test('the scratch PNG lies under the answered TMPDIR', async ($, on) => {
  const runs = answerHost(on, { tmp: '/var/tmp-test/' })
  await mountRead($, on, jpegRead())

  expect(runs.writes[0]).toMatch(/^\/var\/tmp-test\/image-render\/[^/]+\.png$/)
})

test('the scratch path holds no doubled slash when TMPDIR ends in one', async ($, on) => {
  const runs = answerHost(on, { tmp: '/var/tmp-test/' })
  await mountRead($, on, jpegRead())

  expect(runs.writes[0]).not.toContain('//')
})

test('the scratch path the converters and the removal receive holds no doubled slash when TMPDIR ends in one', async ($, on) => {
  const runs = answerHost(on, { tmp: '/var/tmp-test/' })
  await mountRead($, on, jpegRead())

  expect(converterRuns(runs)[1]?.at(-1)).not.toContain('//')
  expect(removals(runs)[0]?.[2]).not.toContain('//')
})

test('the scratch PNG lies under /tmp when TMPDIR is unset', async ($, on) => {
  const runs = answerHost(on)
  await mountRead($, on, jpegRead())

  expect(runs.writes[0]).toMatch(/^\/tmp\/image-render\/[^/]+\.png$/)
})

test('the scratch name keeps the session id to safe characters', async ($, on) => {
  const runs = answerHost(on)
  await mountRead($, on, jpegRead())

  expect(runs.writes[0]).toContain('sess-1')
})

const attempts: Array<[string, HostAnswers]> = [
  ['a drawn conversion', {}],
  ['a conversion that fails', { sips: 1, magick: 1 }],
  ['an unreadable scratch', { scratch: new Error('missing') }],
]

for (const [title, answers] of attempts) {
  test('the scratch is removed with rm -f after ' + title, async ($, on) => {
    const runs = answerHost(on, answers)
    await mountRead($, on, jpegRead())

    expect(removals(runs)).toEqual([['rm', '-f', runs.writes[0] ?? '']])
  })
}

test('a failing scratch removal does not stop the picture', async ($, on) => {
  answerHost(on, { removal: new Error('busy') })
  const ui = await mountRead($, on, jpegRead())

  expect(await ui.findAll({ type: 'Image' })).toHaveLength(1)
})

test('two JPEG Reads mounted in one test use two scratch paths', async ($, on) => {
  const runs = answerHost(on)
  await mountRead($, on, jpegRead())
  await $.ui.mount({
    plugin: 'image-render',
    surface: 'terminal',
    component: 'ToolUse',
    props: { tool_use_id: 'toolu_10', tool: 'Read', isRunning: false, isErrored: false, isInterrupted: false, ...jpegRead() },
    viewport: VIEWPORT,
  } as never)

  expect(runs.writes).toHaveLength(2)
  expect(runs.writes[0]).not.toBe(runs.writes[1])
})

const readPngCases: Array<[string, string, boolean]> = [
  ['a valid 1600x400 PNG', pngBase64(1600, 400), true],
  ['a PNG of exactly 2 MiB decoded', pngBase64(10, 10, 2097152), true],
  ['2 MiB plus one byte decoded', pngBase64(10, 10, 2097153), false],
  ['33 zero bytes with no signature', base64Of(new Uint8Array(33)), false],
  ['a signature with one byte changed', base64Of(Uint8Array.from(pngBytes(10, 10), (byte, index) => (index === 7 ? byte ^ 1 : byte))), false],
  ['a header of 23 bytes with a non-zero height', base64Of(pngBytes(10, 0x01020304).slice(0, 23)), false],
  ['a width of zero', pngBase64(0, 10), false],
  ['a height of zero', pngBase64(10, 0), false],
  ['base64 invalid in its first 32 characters', '!'.repeat(32) + pngBase64(10, 10).slice(32), false],
  ['an empty string', '', false],
]

for (const [title, base64, accepted] of readPngCases) {
  test('readPng ' + (accepted ? 'accepts ' : 'refuses ') + title, () => {
    expect(readPng(base64, 'x.png') !== undefined).toBe(accepted)
  })
}

test('readPng reads width and height as unsigned and carries the name', () => {
  expect(readPng(pngBase64(0xffffffff, 0xffffffff), 'big.png')).toEqual({
    base64: pngBase64(0xffffffff, 0xffffffff),
    width: 4294967295,
    height: 4294967295,
    name: 'big.png',
  })
})
const sizeRows: Array<[string, string, boolean]> = [
  ['1600x900 is shrunk', sizeLines(1600, 900), true],
  ['a longer side of exactly 1024 is left alone', sizeLines(1024, 768), false],
  ['a longer height of exactly 1024 is left alone', sizeLines(768, 1024), false],
  ['300x200 is left alone', sizeLines(300, 200), false],
  ['a width of 1025 is shrunk', sizeLines(1025, 10), true],
  ['a height of 1025 is shrunk', sizeLines(10, 1025), true],
]

for (const [title, size, shrunk] of sizeRows) {
  test('sips converts a picture of ' + title + (shrunk ? ' with -Z 1024' : ' without -Z'), async ($, on) => {
    const runs = answerHost(on, { size })
    await mountRead($, on, jpegRead())
    const scratch = runs.writes[0] ?? ''

    expect(converterRuns(runs)).toEqual([
      ['/usr/bin/sips', '-g', 'pixelWidth', '-g', 'pixelHeight', '/repo/photo.jpg'],
      ['/usr/bin/sips', '-s', 'format', 'png', ...(shrunk ? ['-Z', '1024'] : []), '/repo/photo.jpg', '--out', scratch],
    ])
  })
}

const badSizes: Array<[string, string | Answer]> = [
  ['the missing-file warning', 'Warning: /repo/photo.jpg not a valid file - skipping\n'],
  ['no height line', '/repo/photo.jpg\n  pixelWidth: 300\n'],
  ['no width line', '/repo/photo.jpg\n  pixelHeight: 300\n'],
  ['a non-numeric width', sizeLines('wide', 200)],
  ['a zero width', sizeLines(0, 200)],
  ['a zero height', sizeLines(300, 0)],
  ['a size query that exits non-zero', 1],
  ['a size query that cannot start', bootFailure],
]

for (const [title, size] of badSizes) {
  test('magick runs when sips answers ' + title, async ($, on) => {
    const runs = answerHost(on, { size })
    const ui = await mountRead($, on, jpegRead())
    const scratch = runs.writes[0] ?? ''

    expect(converterRuns(runs)).toEqual([
      ['/usr/bin/sips', '-g', 'pixelWidth', '-g', 'pixelHeight', '/repo/photo.jpg'],
      ['/usr/bin/env', 'magick', 'jpeg:/repo/photo.jpg[0]', '-resize', '1024x1024>', 'png:' + scratch],
    ])
    expect(await ui.findAll({ type: 'Image' })).toHaveLength(1)
  })
}

test('a size query runs with a five second limit', async ($, on) => {
  const runs = answerHost(on)
  await mountRead($, on, jpegRead())

  expect(runs.limits).toEqual([5000, 5000])
})

const escaping: Array<[string, HostAnswers]> = [
  ['env.get throws', { env: new Error('denied') }],
  ['session.id throws', { session: new Error('denied') }],
]

for (const [title, answers] of escaping) {
  test('a JPEG Read runs no process and renders the engine row alone when ' + title, async ($, on) => {
    const runs = answerHost(on, answers)
    const ui = await mountRead($, on, jpegRead())
    const drawn = await ui.findAll({})

    expect(runs).toEqual([])
    expect(runs.writes).toEqual([])
    expect(drawn).toHaveLength(1)
    expect(drawn[0]).toMatchObject({ type: 'Text', text: 'engine row' })
  })
}

/** A plain host of only the calls `convertedPng` makes; each method records that it was called and answers as told. */
function stubHost(answers: { env?: Error; session?: Error } = {}) {
  const calls: string[] = []
  // The declared read is overloaded, so the stub answers each overload.
  function readScratch(path: string): Promise<string>
  function readScratch(path: string, options: FsReadBytesOptions): Promise<FsBytes>
  function readScratch(path: string, options: FsReadOptions): Promise<string | FsBytes>
  async function readScratch(_path: string, options?: FsReadOptions): Promise<string | FsBytes> {
    calls.push('fs.read')

    return options === undefined || options.as === 'text' ? '' : { base64: pngBase64(1600, 400) }
  }
  const host: ConvertHost = {
    env: {
      get: async () => {
        calls.push('env.get')
        if (answers.env !== undefined) throw answers.env

        return undefined
      },
    },
    session: {
      id: async () => {
        calls.push('session.id')
        if (answers.session !== undefined) throw answers.session

        return 'sess-1'
      },
    },
    fs: {
      read: readScratch,
      write: async () => {
        calls.push('fs.write')
      },
    },
    process: {
      run: async argv => {
        calls.push('process.run')

        return ran(0, argv[1] === '-g' ? sizeLines(1600, 900) : '').value
      },
    },
  }

  return { host, calls }
}

const jpegOutput = { type: 'image', file: { type: 'image/jpeg' } }
const jpegInput = { file_path: '/repo/photo.jpg' }

test('convertedPng resolves to undefined when env.get throws, before the session id, a write or a process', async () => {
  const { host, calls } = stubHost({ env: new Error('denied') })

  expect(await convertedPng(host, jpegOutput, jpegInput)).toBeUndefined()
  expect(calls).toEqual(['env.get'])
})

test('convertedPng resolves to undefined when session.id throws, before a write or a process', async () => {
  const { host, calls } = stubHost({ session: new Error('denied') })

  expect(await convertedPng(host, jpegOutput, jpegInput)).toBeUndefined()
  expect(calls).toEqual(['env.get', 'session.id'])
})

test('convertedPng resolves to a Png when every host call answers', async () => {
  const { host, calls } = stubHost()

  expect(await convertedPng(host, jpegOutput, jpegInput)).toMatchObject({ width: 1600, height: 400, name: 'photo.jpg' })
  expect(calls).toContain('process.run')
  expect(calls).toContain('fs.read')
})

test('a JPEG Read removes the scratch it named when the scratch write throws', async ($, on) => {
  const runs = answerHost(on, { write: new Error('read-only') })
  await mountRead($, on, jpegRead())

  expect(converterRuns(runs)).toEqual([])
  expect(removals(runs)).toHaveLength(1)
})

for (const glob of ['*', '?', '[']) {
  test('a file path holding ' + glob + ' never reaches magick but still reaches sips', async ($, on) => {
    const path = `/repo/a${glob}b.jpg`
    const runs = answerHost(on, { sips: 1 })
    const ui = await mountRead($, on, jpegRead(path))

    expect(converterRuns(runs)).toEqual([['/usr/bin/sips', '-g', 'pixelWidth', '-g', 'pixelHeight', path]])
    expect(await ui.findAll({})).toHaveLength(1)
  })

  test('a file path holding ' + glob + ' is converted by sips as one argv element', async ($, on) => {
    const path = `/repo/a${glob}b.jpg`
    const runs = answerHost(on)
    const ui = await mountRead($, on, jpegRead(path))

    expect(converterRuns(runs).map(argv => argv.includes(path))).toEqual([true, true])
    expect(await ui.findAll({ type: 'Image' })).toHaveLength(1)
  })
}

test('a JPEG Read draws the engine row and no Image element when a plugin removes Image from the resolved table', async ($, on) => {
  answerHost(on)
  on('ui.resolve', async ($, e, next) => {
    const { Image: _image, ...table } = (await next(e)) as unknown as Record<string, unknown>

    return table as never
  })
  const ui = await mountRead($, on, jpegRead())

  expect(await ui.find({ text: 'engine row' })).toBeDefined()
  expect(await ui.findAll({ type: 'Image' })).toEqual([])
})

const MCP_TOOL = 'mcp__probe__shot'
const textBlock = (text: string) => ({ type: 'text', text })
const imageBlock = (data: unknown, mediaType: unknown = 'image/png', sourceType: unknown = 'base64') => ({
  type: 'image',
  source: { type: sourceType, media_type: mediaType, data },
})
const mcpMounted = (output: unknown, more: Partial<Mounted> = {}): Mounted => ({ tool: MCP_TOOL, input: {}, output, ...more })
const drawnNodes = async (ui: Awaited<ReturnType<typeof mountRead>>) =>
  (await ui.findAll({})).filter(node => node.type === 'Text' || node.type === 'Image')

test('an MCP tool call returning one PNG block draws the picture under the engine row fitted as a Read of the same size', async ($, on) => {
  const base64 = pngBase64(1600, 400)
  const probe = [textBlock('shot'), imageBlock(base64), textBlock('[Image: source: /cfg/projects/p/s/tool-results/probe-blob-1.png]')]
  const ui = await mountRead($, on, mcpMounted(probe))
  const drawn = await drawnNodes(ui)

  expect(drawn.map(node => node.type)).toEqual(['Text', 'Image'])
  expect(drawn[0]).toMatchObject({ text: 'engine row' })
  expect(drawn[1]?.props).toMatchObject({ source: { png: base64 }, columns: 60, rows: 8 })
  expect(String(drawn[1]?.props.alt)).toContain(MCP_TOOL)
})

test('an MCP tool call returning two PNG blocks draws two pictures in output order, each fitted from its own size', async ($, on) => {
  const first = pngBase64(1600, 400)
  const second = pngBase64(400, 1600)
  const ui = await mountRead($, on, mcpMounted([imageBlock(first), textBlock('between'), imageBlock(second)]))
  const images = await ui.findAll({ type: 'Image' })

  expect(images.map(node => node.props.source)).toEqual([{ png: first }, { png: second }])
  expect(images[0]?.props).toMatchObject({ columns: 60, rows: 8 })
  expect(images[1]?.props).toMatchObject({ columns: 16, rows: 32 })
  expect(images[0]?.props.alt).not.toEqual(images[1]?.props.alt)
})

test('an MCP image block after several text blocks is drawn', async ($, on) => {
  const ui = await mountRead($, on, mcpMounted([textBlock('a'), textBlock('b'), textBlock('c'), imageBlock(pngBase64(10, 10))]))

  expect(await ui.findAll({ type: 'Image' })).toHaveLength(1)
})

const undrawn: Array<[string, unknown]> = [
  ['a text-only array', [textBlock('hello'), textBlock('[Image: source: /x/tool-results/a.png]')]],
  ['an empty array', []],
  ['a string output', 'shot\n[Image: source: /x/tool-results/a.png]'],
  ['an object output with content', { content: [imageBlock(pngBase64(10, 10))] }],
  ['a null output', null],
  ['a JPEG media type', [imageBlock(pngBase64(10, 10), 'image/jpeg')]],
  ['a null media type', [imageBlock(pngBase64(10, 10), null)]],
  ['a url source', [imageBlock(pngBase64(10, 10), 'image/png', 'url')]],
  ['a non-string data', [imageBlock(7)]],
  ['an empty data', [imageBlock('')]],
  ['data that is not base64', [imageBlock('!'.repeat(40))]],
  ['data without the PNG signature', [imageBlock(base64Of(new Uint8Array(33)))]],
  ['data over 2 MiB decoded', [imageBlock(pngBase64(10, 10, 2097153))]],
  ['an image block with no source', [{ type: 'image' }]],
  ['a null block', [null]],
  ['a string block', ['image']],
  ['a number block', [3]],
]

for (const [title, output] of undrawn) {
  test('an MCP tool call with ' + title + ' renders the engine row alone', async ($, on) => {
    const ui = await mountRead($, on, mcpMounted(output))
    const drawn = await ui.findAll({})

    expect(drawn).toHaveLength(1)
    expect(drawn[0]).toMatchObject({ type: 'Text', text: 'engine row' })
  })
}

test('an MCP array mixing drawable and undrawable blocks draws only the drawable ones', async ($, on) => {
  const good = pngBase64(1600, 400)
  const output = [null, imageBlock(good), 'x', imageBlock(pngBase64(10, 10), 'image/jpeg'), imageBlock(''), imageBlock(good)]
  const ui = await mountRead($, on, mcpMounted(output))
  const images = await ui.findAll({ type: 'Image' })

  expect(images.map(node => node.props.source)).toEqual([{ png: good }, { png: good }])
})

test('a Bash tool call with the MCP probe output draws nothing added', async ($, on) => {
  const ui = await mountRead($, on, { tool: 'Bash', input: {}, output: [imageBlock(pngBase64(10, 10))] })

  expect(await ui.findAll({ type: 'Image' })).toEqual([])
  expect(await ui.findAll({})).toHaveLength(1)
})

const mcpEngineRowOnly: Array<[string, Partial<Mounted>]> = [
  ['a running', { state: { isRunning: true } }],
  ['an errored', { state: { isErrored: true } }],
  ['an interrupted', { state: { isInterrupted: true } }],
  ['a desktop', { surface: 'desktop' }],
]

for (const [title, more] of mcpEngineRowOnly) {
  test(title + ' MCP tool call with a PNG block renders the engine row alone', async ($, on) => {
    const ui = await mountRead($, on, mcpMounted([imageBlock(pngBase64(10, 10))], more))
    const drawn = await ui.findAll({})

    expect(drawn).toHaveLength(1)
    expect(drawn[0]).toMatchObject({ type: 'Text', text: 'engine row' })
  })
}

test('an MCP picture narrows to the room a narrow terminal leaves', async ($, on) => {
  const ui = await mountRead($, on, mcpMounted([imageBlock(pngBase64(1600, 400))], { viewport: { columns: 50, rows: 40 } }))
  const image = await ui.find({ type: 'Image' })

  expect(image?.props).toMatchObject({ columns: 43, rows: 5 })
})

test('an MCP tool call draws its pictures without any host call', async ($, on) => {
  const calls: string[] = []
  on('env.get', () => (calls.push('env.get'), { value: undefined }))
  on('session.id', () => (calls.push('session.id'), { value: 'sess' }))
  on('process.run', () => (calls.push('process.run'), ran(0)))
  on('fs.read', () => (calls.push('fs.read'), { value: '' }))
  on('fs.write', () => (calls.push('fs.write'), { value: undefined }))
  on('fs.stat', () => (calls.push('fs.stat'), { value: {} as never }))
  const ui = await mountRead($, on, mcpMounted([imageBlock(pngBase64(1600, 400)), imageBlock(pngBase64(10, 10), 'image/jpeg')]))

  expect(await ui.findAll({ type: 'Image' })).toHaveLength(1)
  expect(calls).toEqual([])
})