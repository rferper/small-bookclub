import type { VoteStatus } from '../api/types'

export const VOTE_STATUS_LABELS: Record<VoteStatus, string> = {
  draft: 'En preparación',
  open: 'Abierta',
  closed: 'Cerrada',
}

export const votePath = (voteId: string) => `/votaciones/${encodeURIComponent(voteId)}`
export const bookPath = (bookId: string) => `/biblioteca/${encodeURIComponent(bookId)}`

export const VOTE_NO_LONGER_OPEN =
  'Esta votación ya no está abierta, así que tu cambio no se ha guardado. Aquí tienes cómo ha quedado.'
