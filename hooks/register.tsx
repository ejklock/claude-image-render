import type { Register } from 'claude-code'

import { convertedPng } from './convert'
import { parsePng } from './png'

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
    if (e.props.tool !== 'Read' || !('Image' in ui)) return next(e)
    const png = parsePng(e.props.output, e.props.input) ?? (await convertedPng($, e.props.output, e.props.input))
    if (png === undefined) return next(e)

    const { Box, Image } = ui
    const width = Math.min(IMAGE_WIDTH, (e.viewport?.columns ?? 100) - TOOL_INDENT)
    const { columns, rows } = fitImage(png, width, e.viewport?.rows ?? 40)

    return (
      <Box flexDirection="column">
        {await next(e)}
        <Box marginLeft={5} marginTop={1}>
          <Image source={{ png: png.base64 }} columns={columns} rows={rows} alt={png.name} />
        </Box>
      </Box>
    )
  })
}

/** Fills the width it is given, shrinking to the terminal height; a cell is about twice as tall as it is wide. */
function fitImage(png: { width: number; height: number }, width: number, viewportRows: number): { columns: number; rows: number } {
  const cap = Math.min(255, Math.max(3, viewportRows - 8))
  const columns = Math.min(255, Math.max(1, width))
  const rows = Math.max(1, Math.round((columns * png.height) / png.width / 2))
  if (rows <= cap) return { columns, rows }

  return { columns: Math.min(columns, Math.max(1, Math.round((cap * 2 * png.width) / png.height))), rows: cap }
}
