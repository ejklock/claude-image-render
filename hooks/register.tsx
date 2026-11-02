import type { Register } from 'claude-code'

import { convertedPng } from './convert'
import type { ConvertHost } from './convert'
import { isMcpTool, mcpPngs } from './mcp'
import { parsePng } from './png'
import type { Png } from './png'

// The ToolUse row is indented under its marker.
const TOOL_INDENT = 7

// A fixed width keeps the transcript readable: a full-width picture dwarfs the text around it.
const IMAGE_WIDTH = 60

export const register: Register = on => {
  on('ui.render', async ($, e, next) => {
    if (e.component !== 'ToolUse' || e.surface !== 'terminal' || e.props.isRunning || e.props.isErrored || e.props.isInterrupted === true) {
      return next(e)
    }
    const ui = $.ui.resolve(e)
    if (!('Image' in ui)) return next(e)
    const pngs = await drawablePngs($, e.props)
    if (pngs.length === 0) return next(e)

    const { Box, Image } = ui
    const width = Math.min(IMAGE_WIDTH, (e.viewport?.columns ?? 100) - TOOL_INDENT)

    return (
      <Box flexDirection="column">
        {await next(e)}
        {pngs.map(png => {
          const { columns, rows } = fitImage(png, width, e.viewport?.rows ?? 40)

          return (
            <Box marginLeft={5} marginTop={1}>
              <Image source={{ png: png.base64 }} columns={columns} rows={rows} alt={png.name} />
            </Box>
          )
        })}
      </Box>
    )
  })
}

/** The pictures a finished row draws: a Read's one image, converted when it is not a PNG, or an MCP call's PNG blocks. */
async function drawablePngs($: ConvertHost, props: { tool: string; input: unknown; output?: unknown }): Promise<Png[]> {
  if (isMcpTool(props.tool)) return mcpPngs(props.output, props.tool)
  if (props.tool !== 'Read') return []
  const png = parsePng(props.output, props.input) ?? (await convertedPng($, props.output, props.input))

  return png === undefined ? [] : [png]
}

/** Fills the width it is given, shrinking to the terminal height; a cell is about twice as tall as it is wide. */
function fitImage(png: { width: number; height: number }, width: number, viewportRows: number): { columns: number; rows: number } {
  const cap = Math.min(255, Math.max(3, viewportRows - 8))
  const columns = Math.min(255, Math.max(1, width))
  const rows = Math.max(1, Math.round((columns * png.height) / png.width / 2))
  if (rows <= cap) return { columns, rows }

  return { columns: Math.min(columns, Math.max(1, Math.round((cap * 2 * png.width) / png.height))), rows: cap }
}
