// The most a `{ png }` image source accepts, decoded.
const PNG_LIMIT = 2097152
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
// The signature plus the IHDR length, type, width and height: 24 bytes, 32 base64 characters.
const HEADER_BASE64_LENGTH = 32

export type Png = { base64: string; width: number; height: number; name: string }

/** The PNG a finished Read returned, or nothing when the output is not a drawable PNG. */
export function parsePng(output: unknown, input: unknown): Png | undefined {
  const base64 = pngBase64(output)

  return base64 === undefined ? undefined : readPng(base64, fileName(input))
}

/** The PNG held in `base64`, or nothing when it is over the size limit, lacks the signature or has no size. */
export function readPng(base64: string, name: string): Png | undefined {
  if (decodedSize(base64) > PNG_LIMIT) return undefined
  const size = pngSize(base64)

  return size === undefined ? undefined : { base64, ...size, name }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function pngBase64(output: unknown): string | undefined {
  if (!isRecord(output) || output.type !== 'image') return undefined
  const { file } = output
  if (!isRecord(file) || file.type !== 'image/png') return undefined

  return typeof file.base64 === 'string' ? file.base64 : undefined
}

function fileName(input: unknown): string {
  const path = isRecord(input) && typeof input.file_path === 'string' ? input.file_path : ''

  return path.split('/').pop() || 'image.png'
}

/** Width and height from the PNG's own IHDR header, big-endian after the 8-byte signature. */
function pngSize(base64: string): { width: number; height: number } | undefined {
  let header: string
  try {
    header = atob(base64.slice(0, HEADER_BASE64_LENGTH))
  } catch {
    return undefined
  }
  if (header.length < 24 || PNG_SIGNATURE.some((byte, index) => header.charCodeAt(index) !== byte)) return undefined
  const word = (offset: number) =>
    ((header.charCodeAt(offset) << 24) | (header.charCodeAt(offset + 1) << 16) | (header.charCodeAt(offset + 2) << 8) | header.charCodeAt(offset + 3)) >>> 0
  const width = word(16)
  const height = word(20)

  return width > 0 && height > 0 ? { width, height } : undefined
}

function decodedSize(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0

  return (base64.length * 3) / 4 - padding
}
