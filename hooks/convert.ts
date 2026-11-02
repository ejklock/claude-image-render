import type { Hook } from 'claude-code'

import { readPng } from './png'
import type { Png } from './png'

type FullHost = Parameters<Hook<'ui.render'>>[0]

/** The host calls the conversion makes, so a caller can hand over only these. */
export type ConvertHost = {
  env: Pick<FullHost['env'], 'get'>
  fs: Pick<FullHost['fs'], 'read' | 'write'>
  process: Pick<FullHost['process'], 'run'>
  session: Pick<FullHost['session'], 'id'>
}

const MIME_FORMATS: Readonly<Record<string, string>> = { 'image/jpeg': 'jpeg', 'image/gif': 'gif', 'image/webp': 'webp' }
// Bounds the picture to what the terminal draws, and the PNG under the size `readPng` accepts.
const LONGEST_SIDE = 1024
const CONVERT_TIMEOUT_MS = 5000
const SCRATCH_FOLDER = 'image-render'

// Keeps overlapping reads in this process from removing each other's files; the session id in the name does the same across sessions sharing a TMPDIR.
let scratchCount = 0

/** A JPEG, GIF or WebP a finished Read returned, converted to a PNG the Image element draws; nothing when it cannot be converted. */
export async function convertedPng(host: ConvertHost, output: unknown, input: unknown): Promise<Png | undefined> {
  const format = readFormat(output)
  const path = readPath(input)
  if (format === undefined || path === undefined) return undefined

  return convertFile(host, format, path)
}

/** The file at `path`, a `jpeg`, `gif` or `webp`, converted to a PNG the Image element draws; nothing when it cannot be converted. */
export async function convertFile(host: ConvertHost, format: string, path: string): Promise<Png | undefined> {
  let scratch: string | undefined
  try {
    scratch = await scratchPath(host)
    // Writing the empty file makes its folder, which the converters do not.
    await host.fs.write(scratch, '')
    if (!(await convert(host, format, path, scratch))) return undefined
    const { base64 } = await host.fs.read(scratch, { as: 'bytes' })

    return readPng(base64, path.split('/').pop() || 'image.png')
  } catch {
    return undefined
  } finally {
    if (scratch !== undefined) await host.process.run(['rm', '-f', scratch]).catch(() => undefined)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readFormat(output: unknown): string | undefined {
  if (!isRecord(output) || output.type !== 'image' || !isRecord(output.file)) return undefined
  const { type } = output.file

  return typeof type === 'string' ? MIME_FORMATS[type] : undefined
}

function readPath(input: unknown): string | undefined {
  if (!isRecord(input)) return undefined

  return typeof input.file_path === 'string' && input.file_path.startsWith('/') ? input.file_path : undefined
}

/** sips prints a warning and exits zero for a file it cannot read, so only its output tells; it has no shrink-only flag, hence the size query. */
async function readSize(host: ConvertHost, path: string): Promise<{ width: number; height: number } | undefined> {
  const ran = await host.process.run(['/usr/bin/sips', '-g', 'pixelWidth', '-g', 'pixelHeight', path], { timeoutMs: CONVERT_TIMEOUT_MS }).catch(() => undefined)
  if (ran === undefined || ran.exitCode !== 0) return undefined
  const width = Number(/^\s*pixelWidth: (\d+)\s*$/m.exec(ran.stdout)?.[1])
  const height = Number(/^\s*pixelHeight: (\d+)\s*$/m.exec(ran.stdout)?.[1])

  return width > 0 && height > 0 ? { width, height } : undefined
}

function sipsArgv(path: string, scratch: string, size: { width: number; height: number } | undefined): string[] | undefined {
  if (size === undefined) return undefined
  const shrink = Math.max(size.width, size.height) > LONGEST_SIDE ? ['-Z', String(LONGEST_SIDE)] : []

  return ['/usr/bin/sips', '-s', 'format', 'png', ...shrink, path, '--out', scratch]
}

function magickArgv(format: string, path: string, scratch: string): string[] {
  return ['/usr/bin/env', 'magick', `${format}:${path}[0]`, '-resize', `${LONGEST_SIDE}x${LONGEST_SIDE}>`, `png:${scratch}`]
}

async function scratchPath(host: ConvertHost): Promise<string> {
  const tmp = ((await host.env.get('TMPDIR')) ?? '/tmp').replace(/\/$/, '')
  const session = (await host.session.id()).replace(/[^A-Za-z0-9-]/g, '-')
  scratchCount += 1

  return `${tmp}/${SCRATCH_FOLDER}/${session}-${scratchCount}.png`
}

/**
 * True when sips or, failing that, magick exits zero; one that cannot start or times out counts as failed.
 * Tried in order: sips ships with macOS, magick is the portable fallback.
 */
async function convert(host: ConvertHost, format: string, path: string, scratch: string): Promise<boolean> {
  const sips = sipsArgv(path, scratch, await readSize(host, path))
  if (sips !== undefined && (await runs(host, sips))) return true

  return !hasGlob(path) && (await runs(host, magickArgv(format, path, scratch)))
}

// ImageMagick reads `*`, `?` and `[` in a name as a glob or a frame, so it never gets such a path.
function hasGlob(path: string): boolean {
  return /[*?[]/.test(path)
}

async function runs(host: ConvertHost, argv: string[]): Promise<boolean> {
  return host.process.run(argv, { timeoutMs: CONVERT_TIMEOUT_MS }).then(
    ran => ran.exitCode === 0,
    () => false,
  )
}
