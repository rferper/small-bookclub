import type { BookSummary } from '../api/types'
import { formatAuthors } from '../lib/format'

// Shows the cover image, or a cloth-bound placeholder with the title when the
// book has none (free metadata sources often lack Spanish covers). `compact`
// placeholders are too small for text and show only the cloth binding; the
// book is still named by their accessible name.
export function BookCover({
  book,
  className = '',
  compact = false,
}: {
  book: BookSummary
  className?: string
  compact?: boolean
}) {
  const base = `aspect-[2/3] rounded-md shadow-md ${className}`
  if (book.coverUrl) {
    return <img src={book.coverUrl} alt={`Portada de «${book.title}»`} className={`${base} object-cover`} />
  }
  return (
    <div
      role="img"
      aria-label={`Portada de «${book.title}»`}
      className={`${base} flex flex-col justify-between overflow-hidden bg-forest text-parchment ${compact ? 'border-l-4 border-wood' : 'border-l-8 border-wood p-3'}`}
    >
      {!compact && (
        <>
          <span className="font-serif text-base leading-tight break-words">{book.title}</span>
          <span className="text-xs break-words opacity-90">{formatAuthors(book.authors)}</span>
        </>
      )}
    </div>
  )
}
