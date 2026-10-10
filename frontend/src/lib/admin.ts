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
