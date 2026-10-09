import type { BookSummary } from '../api/types'
import { formatAuthors } from '../lib/format'

// Shows the cover image, or a cloth-bound placeholder with the title when the
// book has none (free metadata sources often lack Spanish covers).
export function BookCover({ book, className = '' }: { book: BookSummary; className?: string }) {
  const base = `aspect-[2/3] rounded-md shadow-md ${className}`
  if (book.coverUrl) {
    return <img src={book.coverUrl} alt={`Portada de «${book.title}»`} className={`${base} object-cover`} />
  }
  return (
    <div
      role="img"
      aria-label={`Portada de «${book.title}»`}
      className={`${base} flex flex-col justify-between border-l-8 border-wood bg-forest p-3 text-parchment`}
    >
      <span className="font-serif text-base leading-tight">{book.title}</span>
      <span className="text-xs opacity-90">{formatAuthors(book.authors)}</span>
    </div>
  )
}
