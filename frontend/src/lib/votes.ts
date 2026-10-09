import type { VoteStatus } from '../api/types'
import { ApiError } from '../api/client'

export const VOTE_STATUS_LABELS: Record<VoteStatus, string> = {
  draft: 'En preparación',
  open: 'Abierta',
  closed: 'Cerrada',
}

export const votePath = (voteId: string) => `/votaciones/${encodeURIComponent(voteId)}`
export const bookPath = (bookId: string) => `/biblioteca/${encodeURIComponent(bookId)}`

export const VOTE_NO_LONGER_OPEN =
  'Esta votación ya no está abierta, así que tu cambio no se ha guardado. Aquí tienes cómo ha quedado.'

// Shown after a management change is refused because the vote changed in the
// meantime (409) or the user may no longer manage it (403), #91.
export const VOTE_CHANGED_MEANWHILE =
  'La votación ha cambiado mientras tanto, así que tu cambio no se ha guardado. Aquí tienes cómo ha quedado.'

// How a page reacts to a failed vote change: reload calmly, leave it to the
// session gate (401), or show an alert next to the control.
export function voteErrorKind(error: unknown): 'changed' | 'signedOut' | 'failed' {
  const status = error instanceof ApiError ? error.status : null
  if (status === 409 || status === 403) return 'changed'
  if (status === 401) return 'signedOut'
  return 'failed'
}
