import type { BookStatus } from '../api/types'
import { BOOK_STATUS_LABELS } from '../lib/library'

// The book's club status as a small text label (never colour alone).
export function BookStatusLabel({ status }: { status: BookStatus }) {
  return (
    <span className="inline-block rounded-full bg-sage px-2.5 py-0.5 text-xs font-semibold text-forest">
      {BOOK_STATUS_LABELS[status]}
    </span>
  )
}
