import type { Hook } from 'claude-code'

import { convertFile } from './convert'
import type { ConvertHost } from './convert'
import { isOversizePng, readPng } from './png'
import type { Png } from './png'

type FullHost = Parameters<Hook<'ui.render'>>[0]

/** The host calls that reading a saved picture makes. */
export type SavedHost = ConvertHost & { fs: Pick<FullHost['fs'], 'stat'> }

const SAVED_LINE = /^\[Image: source: (.+)\]$/
const CONVERTED_FORMATS: Readonly<Record<string, string>> = { jpg: 'jpeg', jpeg: 'jpeg', gif: 'gif', webp: 'webp' }

/** The paths that `[Image: source: <path>]` lines of `text` name, in order. */
export function savedPaths(text: string): string[] {
  const paths: string[] = []
  for (const line of text.split('\n')) {
    const path = SAVED_LINE.exec(line)?.[1]
    if (path !== undefined) paths.push(path)
  }

  return paths
}

/**
 * The picture saved at `path`, when it lies in Claude Code's own `tool-results` folders; nothing otherwise, and the file is then never read.
 * The extension picks the format: a PNG is read as it is, unless it is over the size limit, where it is shrunk; the others are converted.
 */
export async function savedPng(host: SavedHost, path: string): Promise<Png | undefined> {
  const extension = /\.([^./]+)$/.exec(path)?.[1]?.toLowerCase()
  const format = extension === undefined ? undefined : CONVERTED_FORMATS[extension]
  if (extension !== 'png' && format === undefined) return undefined
  try {
    const real = await insidePath(host, path)
    if (real === undefined) return undefined
    if (format !== undefined) return await convertFile(host, format, real)
    const base64 = await readBytes(host, real)
    if (base64 === undefined || isOversizePng(base64)) return await convertFile(host, 'png', real)

    return readPng(base64, real.slice(real.lastIndexOf('/') + 1))
  } catch {
    return undefined
  }
}

/** The file's bytes, or nothing when the host refuses the read for any reason (past its own size limit, EIO, EACCES); the file then goes to the converters. */
async function readBytes(host: SavedHost, path: string): Promise<string | undefined> {
  try {
    return (await host.fs.read(path, { as: 'bytes' })).base64
  } catch {
    return undefined
  }
}

/** Where `path` lands, when that is a file in `<config dir>/projects/<project>/<session>/tool-results/`; both are resolved by the host, so a link out of the folder is refused. */
async function insidePath(host: SavedHost, path: string): Promise<string | undefined> {
  const segments = path.split('/').slice(1)
  if (!path.startsWith('/') || segments.some(part => part === '' || part === '.' || part === '..')) return undefined
  const root = await configRoot(host)
  if (root === undefined) return undefined
  const rootReal = (await host.fs.stat(root, { resolve: true })).realPath?.replace(/\/+$/, '')
  if (rootReal === undefined) return undefined
  const real = (await host.fs.stat(path, { resolve: true })).realPath
  if (real === undefined || !real.startsWith(rootReal + '/')) return undefined
  const [projects, project, session, folder, file, ...deeper] = real.slice(rootReal.length + 1).split('/')
  const isSaved = projects === 'projects' && project && session && folder === 'tool-results' && file && deeper.length === 0

  return isSaved ? real : undefined
}

async function configRoot(host: SavedHost): Promise<string | undefined> {
  const config = await host.env.get('CLAUDE_CONFIG_DIR')
  if (config) return config.replace(/\/+$/, '')
  const home = await host.env.get('HOME')

  return home ? home.replace(/\/+$/, '') + '/.claude' : undefined
}
