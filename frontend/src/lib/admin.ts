import { ApiError } from '../api/client'

// Allowlist checks for Administración (#70). Pure helpers shared by the mock
// API (which mirrors the backend validation, #8) and the «Añadir un miembro»
// form, so the two always agree. The backend checks everything again.

export const DISCORD_ID_MIN_DIGITS = 17
export const DISCORD_ID_MAX_DIGITS = 20

// ASCII digits only: \d would also be ASCII in JS, but say it plainly.
const DISCORD_ID = /^[0-9]{17,20}$/

export type DiscordIdProblem = 'empty' | 'format'

// Checked after trimming: 17 to 20 ASCII digits, nothing else.
export function discordIdProblem(value: string): DiscordIdProblem | null {
  const trimmed = value.trim()
  if (!trimmed) return 'empty'
  return DISCORD_ID.test(trimmed) ? null : 'format'
}

// How an Administración page reacts to a failed change: reload calmly (409,
// the list changed meanwhile), show the admin-only message (403), leave it to
// the session gate (401), or show an alert next to the control.
export function adminErrorKind(error: unknown): 'changed' | 'forbidden' | 'signedOut' | 'failed' {
  const status = error instanceof ApiError ? error.status : null
  if (status === 409) return 'changed'
  if (status === 403) return 'forbidden'
  if (status === 401) return 'signedOut'
  return 'failed'
}

export const ADMIN_LIST_CHANGED =
  'La lista ha cambiado mientras tanto, así que tu cambio no se ha guardado. Aquí tienes cómo ha quedado.'
