import { readPng } from './png'
import type { Png } from './png'

const MCP_PREFIX = 'mcp__'

/** Whether `tool` names a tool reached through an MCP server. */
export function isMcpTool(tool: unknown): tool is string {
  return typeof tool === 'string' && tool.startsWith(MCP_PREFIX)
}

/** The PNG image blocks of an MCP call's output, in output order; every other block or shape is skipped. */
export function mcpPngs(output: unknown, tool: string): Png[] {
  if (!Array.isArray(output)) return []
  const pngs: Png[] = []
  for (const block of output) {
    const png = blockPng(block, `${tool} image ${pngs.length + 1}`)
    if (png !== undefined) pngs.push(png)
  }

  return pngs
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function blockPng(block: unknown, name: string): Png | undefined {
  if (!isRecord(block) || block.type !== 'image') return undefined
  const { source } = block
  if (!isRecord(source) || source.type !== 'base64' || source.media_type !== 'image/png') return undefined

  return typeof source.data === 'string' ? readPng(source.data, name) : undefined
}
