// Profile limits and checks (§3, #94). Pure helpers shared by the mock API
// (which mirrors the backend validation, #9) and the Mi perfil form, so the
// two always agree. The backend checks everything again.

export const DISPLAY_NAME_MAX_LENGTH = 40
export const BIO_MAX_LENGTH = 500
export const QUOTE_MAX_LENGTH = 300
export const FAVOURITE_BOOKS_MAX = 5

// 2 MB; a file of exactly this size is accepted.
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024
// No SVG (it can carry scripts) and no GIF.
export const AVATAR_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp']
export const AVATAR_ACCEPT = AVATAR_TYPES.join(',')

// Line breaks and other control characters, including the Unicode line and
// paragraph separators.
function hasControlCharacter(text: string): boolean {
  for (const char of text) {
    const code = char.codePointAt(0)!
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029) return true
  }
  return false
}

export type DisplayNameProblem = 'empty' | 'tooLong' | 'notOneLine'

// Checked after trimming.
export function displayNameProblem(value: string): DisplayNameProblem | null {
  const trimmed = value.trim()
  if (!trimmed) return 'empty'
  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) return 'tooLong'
  if (hasControlCharacter(trimmed)) return 'notOneLine'
  return null
}

// Whether an optional text is over `max` characters after trimming.
export function isTooLong(value: string | null, max: number): boolean {
  return (value ?? '').trim().length > max
}

export type AvatarProblem = 'type' | 'empty' | 'tooLarge'

// Checked on the declared MIME type and size only; the backend sniffs the
// content and may re-encode (#9).
export function avatarProblem(file: { type: string; size: number }): AvatarProblem | null {
  if (!AVATAR_TYPES.includes(file.type)) return 'type'
  if (file.size === 0) return 'empty'
  if (file.size > AVATAR_MAX_BYTES) return 'tooLarge'
  return null
}

// Reads an image into a data URL, kept in memory: nothing is uploaded.
export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('No se ha podido leer el archivo.'))
    reader.readAsDataURL(file)
  })
}
