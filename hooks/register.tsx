import type { Register } from 'claude-code'

import { parsePng } from './png'

// The ToolUse row is indented under its marker.
const TOOL_INDENT = 7

export const register: Register = on => {
  on('ui.render', async ($, e, next) => {
    if (e.component !== 'ToolUse' || e.surface !== 'terminal' || e.props.isRunning || e.props.isErrored || e.props.isInterrupted === true) {
      return next(e)
    }
    const png = e.props.tool === 'Read' ? parsePng(e.props.output, e.props.input) : undefined
    const ui = $.ui.resolve(e)
    if (png === undefined || !('Image' in ui)) return next(e)

    const { Box, Image } = ui
    const { columns, rows } = fitImage(png, (e.viewport?.columns ?? 100) - TOOL_INDENT, e.viewport?.rows ?? 40)

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

/** Fills the width, shrinking to the terminal height; a cell is about twice as tall as it is wide. */
function fitImage(png: { width: number; height: number }, width: number, viewportRows: number): { columns: number; rows: number } {
  const cap = Math.min(255, Math.max(3, viewportRows - 8))
  const columns = Math.min(255, Math.max(1, width))
  const rows = Math.max(1, Math.round((columns * png.height) / png.width / 2))
  if (rows <= cap) return { columns, rows }

  return { columns: Math.min(columns, Math.max(1, Math.round((cap * 2 * png.width) / png.height))), rows: cap }
}
