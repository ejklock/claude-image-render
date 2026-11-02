import { readPng } from './png'
import type { Png } from './png'
import { savedPaths, savedPng } from './saved'
import type { SavedHost } from './saved'

const MCP_PREFIX = 'mcp__'

/** Whether `tool` names a tool reached through an MCP server. */
export function isMcpTool(tool: unknown): tool is string {
  return typeof tool === 'string' && tool.startsWith(MCP_PREFIX)
}

/**
 * The pictures of an MCP call's output, in output order: an image block's PNG bytes, else the saved file the next text block names,
 * and the saved file of every other `[Image: source: <path>]` line; every other block or shape is skipped.
 */
export async function mcpPictures(host: SavedHost, output: unknown, tool: string): Promise<Png[]> {
  const pictures: Png[] = []
  for (const item of items(output, tool)) {
    const png = typeof item === 'string' ? await savedPng(host, item) : item
    if (png !== undefined) pictures.push(png)
  }

  return pictures
}

/** Each picture of the output in order: the PNG of an image block's bytes, else the path of a saved file. */
function items(output: unknown, tool: string): Array<Png | string> {
  if (typeof output === 'string') return savedPaths(output)
  if (!Array.isArray(output)) return []

  return output.flatMap((block, index): Array<Png | string> => {
    if (!isImageBlock(block)) {
      const paths = savedPaths(textOf(block))

      return isImageBlock(output[index - 1]) ? paths.slice(1) : paths
    }
    const bytes = blockPng(block, `${tool} image ${index + 1}`)
    const saved = savedPaths(textOf(output[index + 1]))[0]

    if (bytes !== undefined) return [bytes]

    return saved === undefined ? [] : [saved]
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isImageBlock(block: unknown): block is Record<string, unknown> {
  return isRecord(block) && block.type === 'image'
}

function textOf(block: unknown): string {
  return isRecord(block) && block.type === 'text' && typeof block.text === 'string' ? block.text : ''
}

function blockPng(block: Record<string, unknown>, name: string): Png | undefined {
  const { source } = block
  if (!isRecord(source) || source.type !== 'base64' || source.media_type !== 'image/png') return undefined

  return typeof source.data === 'string' ? readPng(source.data, name) : undefined
}
