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
  vars?: Record<string, string | Error>
  stat?: Record<string, string | null | Error>
  files?: Record<string, string | Error>
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

/** Stubs `env.get` and `fs.stat`; answers the paths asked of `fs.stat` in the list it returns. */
function answerEnvironment(on: Parameters<TestBody>[1], answers: HostAnswers) {
  const stats: string[] = []
  on('env.get', (_, { name }) => {
    if (answers.env !== undefined) throw answers.env
    const given = answers.vars?.[name]
    if (given instanceof Error) throw given

    return { value: name === 'TMPDIR' ? answers.tmp : given }
  })
  on('fs.stat', (_, { path, resolve }) => {
    stats.push(path)
    const given = answers.stat?.[path]
    if (given === undefined || given instanceof Error) throw given ?? new Error('ENOENT: ' + path)
    expect(resolve).toBe(true)

    return { value: { kind: 'file', size: 1, mtimeMs: 0, isLink: false, ...(given === null ? {} : { realPath: given }) } }
  })

  return stats
}

/** Stubs the host: converters answer as told, `fs.read` answers the scratch, every run, write and read is recorded. */
function answerHost(on: Parameters<TestBody>[1], answers: HostAnswers = {}) {
  const runs: string[][] = []
  const reads: string[] = []
  const writes: string[] = []
  const limits: Array<number | undefined> = []
  const stats = answerEnvironment(on, answers)
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
    const file = answers.files?.[path]
    if (file instanceof Error) throw file
    if (file !== undefined) return { value: { base64: file } }
    if (answers.scratch instanceof Error) throw answers.scratch

    return { value: { base64: answers.scratch ?? pngBase64(1600, 400) } }
  })
  on('process.run', (_, { argv, init }) => {
    runs.push([...argv])
    if (argv[0] !== 'rm') limits.push(init?.timeoutMs)

    return runnerOf(answers, argv)
  })

  return Object.assign(runs, { reads, writes, limits, stats })
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
const CONFIG = '/cfg'
const SAVED_DIR = '/cfg/projects/p/s/tool-results'
const SAVED = SAVED_DIR + '/probe-blob-1.png'
const savedLine = (path: string) => '[Image: source: ' + path + ']'
const savedHost = (on: Parameters<TestBody>[1], answers: HostAnswers = {}) =>
  answerHost(on, { vars: { CLAUDE_CONFIG_DIR: CONFIG }, stat: { [CONFIG]: CONFIG, [SAVED]: SAVED }, files: { [SAVED]: pngBase64(300, 100) }, ...answers })
const imageSources = async (ui: Awaited<ReturnType<typeof mountRead>>) => (await ui.findAll({ type: 'Image' })).map(node => node.props.source)

test('a direct MCP image block drawn from its bytes never touches its saved file', async ($, on) => {
  const host = savedHost(on)
  const bytes = pngBase64(1600, 400)
  const ui = await mountRead($, on, mcpMounted([textBlock('shot'), imageBlock(bytes), textBlock(savedLine(SAVED))]))

  expect(await imageSources(ui)).toEqual([{ png: bytes }])
  expect([host.reads, [...host], host.stats]).toEqual([[], [], []])
})

test('an MCP image block with a JPEG media type is drawn from its saved PNG file', async ($, on) => {
  const host = savedHost(on)
  const ui = await mountRead($, on, mcpMounted([textBlock('shot'), imageBlock(pngBase64(10, 10), 'image/jpeg'), textBlock(savedLine(SAVED))]))

  expect(await imageSources(ui)).toEqual([{ png: pngBase64(300, 100) }])
  expect(host.reads).toEqual([SAVED])
})

test('an MCP image block with a JPEG media type is drawn from its converted saved JPEG file', async ($, on) => {
  const jpg = SAVED_DIR + '/probe-blob-2.jpg'
  const host = savedHost(on, { stat: { [CONFIG]: CONFIG, [jpg]: jpg } })
  const ui = await mountRead($, on, mcpMounted([imageBlock(pngBase64(10, 10), 'image/jpeg'), textBlock(savedLine(jpg))]))
  const scratch = host.writes[0] ?? ''

  expect(await imageSources(ui)).toEqual([{ png: pngBase64(1600, 400) }])
  expect(converterRuns(host)[1]).toEqual(['/usr/bin/sips', '-s', 'format', 'png', '-Z', '1024', jpg, '--out', scratch])
})

const bytesNotDrawn: Array<[string, unknown]> = [
  ['over 2 MiB', imageBlock(pngBase64(10, 10, 2097153))],
  ['not base64', imageBlock('!'.repeat(40))],
  ['without the PNG signature', imageBlock(base64Of(new Uint8Array(33)))],
]

for (const [title, block] of bytesNotDrawn) {
  test('an MCP image block with bytes ' + title + ' is drawn from its saved file', async ($, on) => {
    const host = savedHost(on)
    const ui = await mountRead($, on, mcpMounted([block, textBlock(savedLine(SAVED))]))

    expect(await imageSources(ui)).toEqual([{ png: pngBase64(300, 100) }])
    expect(host.reads).toEqual([SAVED])
  })
}

test('a codemode string output naming a saved file draws that file', async ($, on) => {
  const host = savedHost(on)
  const ui = await mountRead($, on, { tool: 'mcp__codemode__codemode', input: {}, output: 'shot\n' + savedLine(SAVED) })
  const drawn = await drawnNodes(ui)

  expect(drawn.map(node => node.type)).toEqual(['Text', 'Image'])
  expect(drawn[1]?.props).toMatchObject({ source: { png: pngBase64(300, 100) }, columns: 60, rows: 10 })
  expect(String(drawn[1]?.props.alt)).toContain('probe-blob-1.png')
  expect(host.reads).toEqual([SAVED])
})

test('a string output with two saved lines draws two pictures in order', async ($, on) => {
  const second = SAVED_DIR + '/probe-blob-2.png'
  savedHost(on, { stat: { [CONFIG]: CONFIG, [SAVED]: SAVED, [second]: second }, files: { [SAVED]: pngBase64(300, 100), [second]: pngBase64(100, 300) } })
  const ui = await mountRead($, on, mcpMounted('a\n' + savedLine(SAVED) + '\nb\n' + savedLine(second)))

  expect(await imageSources(ui)).toEqual([{ png: pngBase64(300, 100) }, { png: pngBase64(100, 300) }])
})

test('a saved line in a text block that follows no image block is a picture of its own', async ($, on) => {
  savedHost(on)
  const ui = await mountRead($, on, mcpMounted([textBlock('a'), textBlock(savedLine(SAVED)), textBlock('b')]))

  expect(await imageSources(ui)).toEqual([{ png: pngBase64(300, 100) }])
})

test('a saved line after a text block that follows an image block is a picture of its own', async ($, on) => {
  savedHost(on)
  const bytes = pngBase64(1600, 400)
  const ui = await mountRead($, on, mcpMounted([imageBlock(bytes), textBlock('between'), textBlock(savedLine(SAVED))]))

  expect(await imageSources(ui)).toEqual([{ png: bytes }, { png: pngBase64(300, 100) }])
})

test('pictures keep output order across bytes and files', async ($, on) => {
  const second = SAVED_DIR + '/probe-blob-2.png'
  const third = SAVED_DIR + '/probe-blob-3.png'
  const [a, b, c, d] = [pngBase64(10, 10), pngBase64(20, 20), pngBase64(30, 30), pngBase64(40, 40)]
  const stat = { [CONFIG]: CONFIG, [SAVED]: SAVED, [second]: second, [third]: third }
  savedHost(on, { stat, files: { [SAVED]: a, [second]: b, [third]: c } })
  const output = [imageBlock(d), textBlock(savedLine(SAVED)), textBlock(savedLine(second)), imageBlock(pngBase64(10, 10), 'image/jpeg'), textBlock(savedLine(third))]
  const ui = await mountRead($, on, mcpMounted(output))

  expect(await imageSources(ui)).toEqual([{ png: d }, { png: b }, { png: c }])
})

test('a saved file that cannot be read is left out and the other pictures are drawn', async ($, on) => {
  const second = SAVED_DIR + '/probe-blob-2.png'
  savedHost(on, { stat: { [CONFIG]: CONFIG, [SAVED]: SAVED, [second]: second }, files: { [SAVED]: new Error('EIO'), [second]: pngBase64(20, 20) }, sips: 1, magick: 1 })
  const ui = await mountRead($, on, mcpMounted(savedLine(SAVED) + '\n' + savedLine(second)))

  expect(await imageSources(ui)).toEqual([{ png: pngBase64(20, 20) }])
})

test('a saved line in a Bash tool output adds nothing and touches no file', async ($, on) => {
  const host = savedHost(on)
  const ui = await mountRead($, on, { tool: 'Bash', input: {}, output: savedLine(SAVED) })

  expect(await ui.findAll({ type: 'Image' })).toEqual([])
  expect([host.reads, host.stats]).toEqual([[], []])
})

test('a saved line on a desktop surface touches no file', async ($, on) => {
  const host = savedHost(on)
  const ui = await mountRead($, on, mcpMounted(savedLine(SAVED), { surface: 'desktop' }))

  expect(await ui.findAll({ type: 'Image' })).toEqual([])
  expect([host.reads, host.stats]).toEqual([[], []])
})

// The host hands `fs.stat` the normalized path, so a spelling with dots or doubled slashes is observable only as the path it collapses to.
const NORMALIZED = SAVED_DIR + '/a.png'
const collapsesInside: HostAnswers = { stat: { [CONFIG]: CONFIG, [NORMALIZED]: SAVED } }
const itself = (path: string): HostAnswers => ({ stat: { [CONFIG]: CONFIG, [path]: path } })

const refused: Array<[string, string, HostAnswers]> = [
  ['a relative path', 'projects/p/s/tool-results/a.png', {}],
  ['a dot-dot segment that resolves inside', SAVED_DIR + '/../tool-results/a.png', collapsesInside],
  ['a dot segment that resolves inside', SAVED_DIR + '/./a.png', collapsesInside],
  ['an empty segment that resolves inside', SAVED_DIR + '//a.png', collapsesInside],
  ['another root', '/other/projects/p/s/tool-results/a.png', itself('/other/projects/p/s/tool-results/a.png')],
  ['a wrong first segment under the root', '/cfg/other/p/s/tool-results/a.png', itself('/cfg/other/p/s/tool-results/a.png')],
  ['a session folder but not tool-results', '/cfg/projects/p/s/a.png', itself('/cfg/projects/p/s/a.png')],
  ['a session subfolder other than tool-results', '/cfg/projects/p/s/other/a.png', itself('/cfg/projects/p/s/other/a.png')],
  ['a folder below tool-results', SAVED_DIR + '/deeper/a.png', itself(SAVED_DIR + '/deeper/a.png')],
  ['a project folder directly', '/cfg/projects/p/tool-results/a.png', itself('/cfg/projects/p/tool-results/a.png')],
  ['a symbolic link that lands outside', SAVED, { stat: { [CONFIG]: CONFIG, [SAVED]: '/etc/hosts.png' } }],
  ['a link that lands in a sibling folder sharing the root prefix', SAVED, { stat: { [CONFIG]: CONFIG, [SAVED]: '/cfg-evil/projects/p/s/tool-results/probe-blob-1.png' } }],
  ['a link that lands in a folder whose name only starts with the root', SAVED, { stat: { [CONFIG]: CONFIG, [SAVED]: '/cfgXprojects/p/s/tool-results/f.png' } }],
  ['no realPath', SAVED, { stat: { [CONFIG]: CONFIG, [SAVED]: null } }],
  ['a stat that rejects for the file', SAVED, { stat: { [CONFIG]: CONFIG, [SAVED]: new Error('EACCES') } }],
  ['a stat that rejects for the root', SAVED, { stat: { [CONFIG]: new Error('EACCES'), [SAVED]: SAVED } }],
  ['a missing file', SAVED, { stat: { [CONFIG]: CONFIG } }],
  ['an env.get that rejects', SAVED, { vars: { CLAUDE_CONFIG_DIR: new Error('denied') } }],
  ['no config dir and no home', SAVED, { vars: {} }],
]

for (const [title, path, answers] of refused) {
  test('a saved line naming ' + title + ' is never read', async ($, on) => {
    const host = savedHost(on, answers)
    const ui = await mountRead($, on, mcpMounted('shot\n' + savedLine(path)))

    expect(await ui.findAll({})).toHaveLength(1)
    expect([host.reads, [...host]]).toEqual([[], []])
  })
}

test('the folder root falls back to the home folder .claude when no config dir is set', async ($, on) => {
  const home = '/home/me/.claude/projects/p/s/tool-results/a.png'
  const host = savedHost(on, { vars: { HOME: '/home/me' }, stat: { '/home/me/.claude': '/home/me/.claude', [home]: home }, files: { [home]: pngBase64(20, 20) } })
  const ui = await mountRead($, on, mcpMounted(savedLine(home)))

  expect(await imageSources(ui)).toEqual([{ png: pngBase64(20, 20) }])
  expect(host.reads).toEqual([home])
})

test('a config dir spelled with a trailing slash still draws a saved file', async ($, on) => {
  const host = savedHost(on, { vars: { CLAUDE_CONFIG_DIR: '/cfg/' } })
  const ui = await mountRead($, on, mcpMounted(savedLine(SAVED)))

  expect(await imageSources(ui)).toEqual([{ png: pngBase64(300, 100) }])
  expect(host.reads).toEqual([SAVED])
})

test('a path whose spelling is outside but whose realPath is inside is read from its realPath', async ($, on) => {
  const alias = '/alias/projects/p/s/tool-results/a.png'
  const host = savedHost(on, { stat: { [CONFIG]: CONFIG, [alias]: SAVED } })
  const ui = await mountRead($, on, mcpMounted(savedLine(alias)))

  expect(await imageSources(ui)).toEqual([{ png: pngBase64(300, 100) }])
  expect(host.reads).toEqual([SAVED])
})

test('a root whose realPath differs from its spelling guards by the realPath', async ($, on) => {
  const real = '/real/cfg/projects/p/s/tool-results/probe-blob-1.png'
  const host = savedHost(on, { stat: { [CONFIG]: '/real/cfg', [SAVED]: real }, files: { [real]: pngBase64(20, 20) } })
  const ui = await mountRead($, on, mcpMounted(savedLine(SAVED)))

  expect(await imageSources(ui)).toEqual([{ png: pngBase64(20, 20) }])
  expect(host.reads).toEqual([real])
})

test('a PNG file with an upper case extension is drawn', async ($, on) => {
  const upper = SAVED_DIR + '/a.PNG'
  savedHost(on, { stat: { [CONFIG]: CONFIG, [upper]: upper }, files: { [upper]: pngBase64(20, 20) } })
  const ui = await mountRead($, on, mcpMounted(savedLine(upper)))

  expect(await imageSources(ui)).toEqual([{ png: pngBase64(20, 20) }])
})

const unreadable: Array<[string, NonNullable<HostAnswers['files']>]> = [
  ['without the PNG signature', { [SAVED]: base64Of(new Uint8Array(40)) }],
]

for (const [title, files] of unreadable) {
  test('a saved PNG ' + title + ' is left undrawn', async ($, on) => {
    const host = savedHost(on, { files })
    const ui = await mountRead($, on, mcpMounted(savedLine(SAVED)))

    expect(await ui.findAll({})).toHaveLength(1)
    expect(host.reads).toEqual([SAVED])
    expect([...host]).toEqual([])
  })
}

for (const path of [SAVED_DIR + '/a.txt', SAVED_DIR + '/a', SAVED_DIR + '/a.png.txt']) {
  test('a saved file named ' + path.split('/').pop() + ' is neither stat-ed nor read', async ($, on) => {
    const host = savedHost(on)
    const ui = await mountRead($, on, mcpMounted(savedLine(path)))

    expect(await ui.findAll({})).toHaveLength(1)
    expect([host.reads, host.stats, [...host]]).toEqual([[], [], []])
  })
}

const savedFormats: Array<[string, string, string]> = [
  ['jpg', 'jpeg', 'jpeg:'],
  ['JPEG', 'jpeg', 'jpeg:'],
  ['gif', 'gif', 'gif:'],
  ['webp', 'webp', 'webp:'],
]

for (const [extension, , prefix] of savedFormats) {
  test('a saved .' + extension + ' file is converted by sips and drawn', async ($, on) => {
    const path = SAVED_DIR + '/a.' + extension
    const host = savedHost(on, { stat: { [CONFIG]: CONFIG, [path]: path } })
    const ui = await mountRead($, on, mcpMounted(savedLine(path)))
    const scratch = host.writes[0] ?? ''

    expect(await imageSources(ui)).toEqual([{ png: pngBase64(1600, 400) }])
    expect(converterRuns(host)).toEqual([
      ['/usr/bin/sips', '-g', 'pixelWidth', '-g', 'pixelHeight', path],
      ['/usr/bin/sips', '-s', 'format', 'png', '-Z', '1024', path, '--out', scratch],
    ])
  })

  test('a saved .' + extension + ' file falls back to magick with the ' + prefix + ' prefix', async ($, on) => {
    const path = SAVED_DIR + '/a.' + extension
    const host = savedHost(on, { stat: { [CONFIG]: CONFIG, [path]: path }, sips: 1 })
    const ui = await mountRead($, on, mcpMounted(savedLine(path)))
    const scratch = host.writes[0] ?? ''

    expect(await imageSources(ui)).toEqual([{ png: pngBase64(1600, 400) }])
    expect(converterRuns(host).at(-1)).toEqual(['/usr/bin/env', 'magick', prefix + path + '[0]', '-resize', '1024x1024>', 'png:' + scratch])
  })
}

test('a saved JPEG that neither converter converts is left out', async ($, on) => {
  const path = SAVED_DIR + '/a.jpg'
  savedHost(on, { stat: { [CONFIG]: CONFIG, [path]: path }, sips: 1, magick: 1 })
  const ui = await mountRead($, on, mcpMounted(savedLine(path)))

  expect(await ui.findAll({})).toHaveLength(1)
})

test('a document block holding a valid PNG source draws nothing', async ($, on) => {
  const ui = await mountRead($, on, mcpMounted([{ type: 'document', source: { type: 'base64', media_type: 'image/png', data: pngBase64(10, 10) } }]))

  expect(await ui.findAll({})).toHaveLength(1)
})

const THREE = ['a', 'b', 'c'].map(name => SAVED_DIR + '/' + name + '.png')
const threeFiles = { a: pngBase64(10, 10), b: pngBase64(20, 20), c: pngBase64(30, 30) }
const threeHost = (on: Parameters<TestBody>[1]) =>
  savedHost(on, {
    stat: { [CONFIG]: CONFIG, ...Object.fromEntries(THREE.map(path => [path, path])) },
    files: Object.fromEntries(THREE.map((path, index) => [path, [threeFiles.a, threeFiles.b, threeFiles.c][index] ?? ''])),
  })
const threeLines = () => textBlock(THREE.map(savedLine).join('\n'))

test('an image block whose bytes do not draw takes its first saved line as its file and draws every further line after it', async ($, on) => {
  const host = threeHost(on)
  const ui = await mountRead($, on, mcpMounted([imageBlock('!'.repeat(40)), threeLines()]))

  expect(await imageSources(ui)).toEqual([{ png: threeFiles.a }, { png: threeFiles.b }, { png: threeFiles.c }])
  expect(host.reads).toEqual(THREE)
})

test('an image block whose bytes draw is followed by every saved line but the first, each drawn in order', async ($, on) => {
  const host = threeHost(on)
  const bytes = pngBase64(1600, 400)
  const ui = await mountRead($, on, mcpMounted([imageBlock(bytes), threeLines()]))

  expect(await imageSources(ui)).toEqual([{ png: bytes }, { png: threeFiles.b }, { png: threeFiles.c }])
  expect(host.reads).toEqual([THREE[1], THREE[2]])
})

const OVER = 2097153
const oversizeBase64 = (width = 4000, height = 3000, size = OVER) => pngBase64(width, height, size)
const oversizeRead = (file_path = '/repo/full.png', width = 4000, height = 3000) => ({ input: { file_path }, output: imageOutput(oversizeBase64(width, height)) })
const sipsPng = (path: string, scratch: string, shrink: string[]) => ['/usr/bin/sips', '-s', 'format', 'png', ...shrink, path, '--out', scratch]
const magickPng = (path: string, scratch: string) => ['/usr/bin/env', 'magick', 'png:' + path + '[0]', '-resize', '1024x1024>', 'png:' + scratch]

const oversizeSaved: Array<[string, NonNullable<HostAnswers['files']>]> = [
  ['over 2 MiB decoded', { [SAVED]: oversizeBase64() }],
  ['that fs.read rejects', { [SAVED]: new Error('file too large') }],
]

for (const [title, files] of oversizeSaved) {
  test('a saved PNG ' + title + ' is shrunk by sips from its checked path and drawn', async ($, on) => {
    const host = savedHost(on, { files, size: sizeLines(4000, 3000) })
    const ui = await mountRead($, on, mcpMounted(savedLine(SAVED)))
    const scratch = host.writes[0] ?? ''

    expect(await imageSources(ui)).toEqual([{ png: pngBase64(1600, 400) }])
    expect(converterRuns(host)).toEqual([['/usr/bin/sips', '-g', 'pixelWidth', '-g', 'pixelHeight', SAVED], sipsPng(SAVED, scratch, ['-Z', '1024'])])
    expect(host.reads).toEqual([SAVED, scratch])
    expect(removals(host)).toEqual([['rm', '-f', scratch]])
  })
}

for (const [title, files] of oversizeSaved) {
  test('a saved PNG ' + title + ' named by an alias spelling is shrunk from its real path only', async ($, on) => {
    const alias = '/alias/projects/p/s/tool-results/a.png'
    const host = savedHost(on, { stat: { [CONFIG]: CONFIG, [alias]: SAVED }, files, size: sizeLines(4000, 3000) })
    const ui = await mountRead($, on, mcpMounted(savedLine(alias)))
    const scratch = host.writes[0] ?? ''

    expect(await imageSources(ui)).toEqual([{ png: pngBase64(1600, 400) }])
    expect(converterRuns(host)).toEqual([['/usr/bin/sips', '-g', 'pixelWidth', '-g', 'pixelHeight', SAVED], sipsPng(SAVED, scratch, ['-Z', '1024'])])
    expect(host.reads).toEqual([SAVED, scratch])
  })
}

test('a saved PNG over 2 MiB that is 1024x768 is converted without a shrink flag', async ($, on) => {
  const host = savedHost(on, { files: { [SAVED]: oversizeBase64(1024, 768) }, size: sizeLines(1024, 768) })
  const ui = await mountRead($, on, mcpMounted(savedLine(SAVED)))

  expect(await ui.findAll({ type: 'Image' })).toHaveLength(1)
  expect(converterRuns(host)[1]).toEqual(sipsPng(SAVED, host.writes[0] ?? '', []))
})

test('a saved PNG over 2 MiB falls back to magick with the png prefix when sips fails', async ($, on) => {
  const host = savedHost(on, { files: { [SAVED]: oversizeBase64() }, sips: 1 })
  const ui = await mountRead($, on, mcpMounted(savedLine(SAVED)))

  expect(await imageSources(ui)).toEqual([{ png: pngBase64(1600, 400) }])
  expect(converterRuns(host).at(-1)).toEqual(magickPng(SAVED, host.writes[0] ?? ''))
})

test('a saved PNG of exactly 2 MiB decoded is drawn from its bytes with no process', async ($, on) => {
  const exact = oversizeBase64(300, 100, OVER - 1)
  const host = savedHost(on, { files: { [SAVED]: exact } })
  const ui = await mountRead($, on, mcpMounted(savedLine(SAVED)))

  const drawn = (await imageSources(ui)).flatMap(source => (typeof source === 'object' && source !== null && 'png' in source && typeof source.png === 'string' ? [source.png.length] : []))

  expect(drawn).toEqual([exact.length])
  expect([...host]).toEqual([])
})

test('a saved PNG under the limit without the PNG signature is not converted', async ($, on) => {
  const host = savedHost(on, { files: { [SAVED]: base64Of(new Uint8Array(40)) } })
  const ui = await mountRead($, on, mcpMounted(savedLine(SAVED)))

  expect(await ui.findAll({})).toHaveLength(1)
  expect([...host]).toEqual([])
})

test('a saved PNG whose converted result is still over 2 MiB draws nothing while the other pictures of the row are drawn', async ($, on) => {
  const [first, second, third] = THREE
  const host = savedHost(on, {
    stat: { [CONFIG]: CONFIG, ...Object.fromEntries(THREE.map(path => [path, path])) },
    files: { [first ?? '']: oversizeBase64(), [second ?? '']: threeFiles.b, [third ?? '']: threeFiles.c },
    scratch: oversizeBase64(),
  })
  const ui = await mountRead($, on, mcpMounted([threeLines()]))

  expect(await imageSources(ui)).toEqual([{ png: threeFiles.b }, { png: threeFiles.c }])
  expect(converterRuns(host).length).toBeGreaterThan(0)
})

test('a path outside the saved folders runs no process even when its PNG would be over 2 MiB', async ($, on) => {
  const outside = '/elsewhere/big.png'
  const host = savedHost(on, { stat: { [CONFIG]: CONFIG, [outside]: outside }, files: { [outside]: oversizeBase64() } })
  const ui = await mountRead($, on, mcpMounted(savedLine(outside)))

  expect(await ui.findAll({})).toHaveLength(1)
  expect([...host]).toEqual([])
})

test('a PNG Read over 2 MiB is shrunk by sips from its file path and drawn under the engine row', async ($, on) => {
  const runs = answerHost(on, { size: sizeLines(4000, 3000) })
  const ui = await mountRead($, on, oversizeRead())
  const drawn = (await ui.findAll({})).filter(node => node.type === 'Text' || node.type === 'Image')
  const scratch = runs.writes[0] ?? ''

  expect(drawn.map(node => node.type)).toEqual(['Text', 'Image'])
  expect(drawn[1]?.props).toMatchObject({ source: { png: pngBase64(1600, 400) }, columns: 60, rows: 8 })
  expect(converterRuns(runs)).toEqual([['/usr/bin/sips', '-g', 'pixelWidth', '-g', 'pixelHeight', '/repo/full.png'], sipsPng('/repo/full.png', scratch, ['-Z', '1024'])])
  expect(runs.reads).toEqual([scratch])
  expect(removals(runs)).toEqual([['rm', '-f', scratch]])
})

test('a PNG Read over 2 MiB falls back to magick with the png prefix when sips fails', async ($, on) => {
  const runs = answerHost(on, { sips: 1 })
  await mountRead($, on, oversizeRead())

  expect(converterRuns(runs).at(-1)).toEqual(magickPng('/repo/full.png', runs.writes[0] ?? ''))
})

test('a PNG Read of exactly 2 MiB decoded is drawn from its bytes with no process', async ($, on) => {
  const runs = answerHost(on)
  const ui = await mountRead($, on, { output: imageOutput(pngBase64(10, 10, 2097152)) })

  expect(await ui.findAll({ type: 'Image' })).toHaveLength(1)
  expect(runs).toEqual([])
})

const oversizeNoProcess: Array<[string, Mounted]> = [
  ['a relative file path', oversizeRead('full.png')],
  ['no file path', { input: {}, output: oversizeRead().output }],
  ['bytes over 2 MiB with no PNG signature', { output: imageOutput(base64Of(new Uint8Array(OVER))) }],
  ['bytes under 2 MiB with no PNG signature', { output: imageOutput(base64Of(new Uint8Array(40))) }],
  ['a PNG over 2 MiB off the terminal', { ...oversizeRead(), surface: 'desktop' }],
]

for (const [title, mounted] of oversizeNoProcess) {
  test('a PNG Read with ' + title + ' runs no process', async ($, on) => {
    const runs = answerHost(on)
    const ui = await mountRead($, on, mounted)

    expect(runs).toEqual([])
    expect(runs.writes).toEqual([])
    expect(await ui.findAll({ type: 'Image' })).toHaveLength(0)
  })
}

test('a PNG Read over 2 MiB renders the engine row alone and removes its scratch when both converters fail', async ($, on) => {
  const runs = answerHost(on, { sips: 1, magick: 1 })
  const ui = await mountRead($, on, oversizeRead())
  const drawn = await ui.findAll({})

  expect(drawn).toHaveLength(1)
  expect(drawn[0]).toMatchObject({ type: 'Text', text: 'engine row' })
  expect(removals(runs)).toEqual([['rm', '-f', runs.writes[0] ?? '']])
})

test('a PNG Read over 2 MiB whose converted result is still over 2 MiB renders the engine row alone', async ($, on) => {
  answerHost(on, { scratch: oversizeBase64() })
  const ui = await mountRead($, on, oversizeRead())

  expect(await ui.findAll({})).toHaveLength(1)
})

test('a PNG Read over 2 MiB whose path holds a glob character is never given to magick', async ($, on) => {
  const runs = answerHost(on, { sips: 1 })
  await mountRead($, on, oversizeRead('/repo/full[1].png'))

  expect(converterRuns(runs).map(argv => argv[0])).toEqual(['/usr/bin/sips'])
})
