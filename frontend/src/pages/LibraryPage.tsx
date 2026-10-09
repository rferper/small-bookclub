import { useId } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useApiData } from '../api/hooks'
import type { BookStatus, LibraryBook } from '../api/types'
import { BookCover } from '../components/BookCover'
import { BookStatusLabel } from '../components/BookStatusLabel'
import { EmptyState } from '../components/Card'
import { LoadError, Loading } from '../components/Status'
import { formatAuthors, formatReadingDates } from '../lib/format'
import { BOOK_STATUSES, BOOK_STATUS_LABELS, groupByYear, isBookStatus, sortByReadingDate, sortByTitle } from '../lib/library'

type View = 'estanteria' | 'cronologia'
type Order = 'fecha' | 'titulo'

// View, filter and sort live in the query string (?vista=, ?estado=, ?orden=)
// so that going back from a book restores them. Unknown values fall back to
// the default, and defaults are left out of the URL.
function useLibraryParams() {
  const [params, setParams] = useSearchParams()
  const view: View = params.get('vista') === 'cronologia' ? 'cronologia' : 'estanteria'
  const estado = params.get('estado')
  const status: BookStatus | null = isBookStatus(estado) ? estado : null
  const order: Order = params.get('orden') === 'titulo' ? 'titulo' : 'fecha'

  const set = (key: string, value: string, defaultValue: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value === defaultValue) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )

  return {
    view,
    status,
    order,
    setView: (value: View) => set('vista', value, 'estanteria'),
    setStatus: (value: string) => set('estado', value, 'todos'),
    setOrder: (value: Order) => set('orden', value, 'fecha'),
  }
}

export function LibraryPage() {
  // One request for the whole catalogue (about 10–50 books, §5.1); the view,
  // filter and sort are applied here and never reload it.
  const books = useApiData((api) => api.listBooks())
  const { view, status, order, setView, setStatus, setOrder } = useLibraryParams()
  const statusId = useId()
  const orderId = useId()

  return (
    <div className="grid gap-6">
      <h1 className="text-3xl text-forest sm:text-4xl">Biblioteca</h1>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div role="group" aria-label="Vista" className="flex gap-2">
          {(
            [
              ['estanteria', 'Estantería'],
              ['cronologia', 'Cronología'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => setView(value)}
              className={`rounded-lg border-2 border-forest px-4 py-2 font-semibold ${
                view === value ? 'bg-forest text-parchment' : 'text-forest hover:bg-sage/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={statusId} className="text-sm text-bark">
            Estado
          </label>
          <select
            id={statusId}
            value={status ?? 'todos'}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-md border border-wood/60 bg-paper px-3 py-2 text-forest"
          >
            <option value="todos">Todos</option>
            {BOOK_STATUSES.map((value) => (
              <option key={value} value={value}>
                {BOOK_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        {/* The timeline is always chronological, so sorting only applies to the shelf. */}
        {view === 'estanteria' && (
          <div className="flex flex-col gap-1">
            <label htmlFor={orderId} className="text-sm text-bark">
              Ordenar por
            </label>
            <select
              id={orderId}
              value={order}
              onChange={(event) => setOrder(event.target.value === 'titulo' ? 'titulo' : 'fecha')}
              className="rounded-md border border-wood/60 bg-paper px-3 py-2 text-forest"
            >
              <option value="fecha">Fecha de lectura</option>
              <option value="titulo">Título</option>
            </select>
          </div>
        )}
      </div>

      {books.status === 'loading' && <Loading />}
      {books.status === 'error' && <LoadError onRetry={books.reload} />}
      {books.status === 'ready' && <LibraryContent books={books.data} view={view} status={status} order={order} />}
    </div>
  )
}

function LibraryContent({
  books,
  view,
  status,
  order,
}: {
  books: LibraryBook[]
  view: View
  status: BookStatus | null
  order: Order
}) {
  if (books.length === 0) {
    return (
      <EmptyState>
        Todavía no hay libros en la biblioteca del club. Cuando se añadan las lecturas, pasadas o nuevas, aparecerán aquí.
      </EmptyState>
    )
  }
  const shown = status ? books.filter((book) => book.status === status) : books
  if (shown.length === 0) {
    return (
      <EmptyState>
        Ahora mismo ningún libro tiene el estado «{BOOK_STATUS_LABELS[status!]}». Elige «Todos» para ver toda la biblioteca.
      </EmptyState>
    )
  }
  return view === 'cronologia' ? <Timeline books={shown} /> : <Shelf books={order === 'titulo' ? sortByTitle(shown) : sortByReadingDate(shown)} />
}

const bookPath = (book: LibraryBook) => `/biblioteca/${encodeURIComponent(book.id)}`

function Shelf({ books }: { books: LibraryBook[] }) {
  return (
    <ul aria-label="Estantería" className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {books.map((book) => (
        <li key={book.id} className="min-w-0">
          <Link to={bookPath(book)} className="group flex h-full flex-col gap-2 rounded-lg p-1 hover:bg-sage/30">
            <BookCover book={book} className="w-full" />
            <span className="font-serif text-lg leading-tight font-semibold break-words text-forest group-hover:underline">
              {book.title}
            </span>
            <span className="text-sm break-words text-bark">{formatAuthors(book.authors)}</span>
            <span>
              <BookStatusLabel status={book.status} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function Timeline({ books }: { books: LibraryBook[] }) {
  return (
    <div className="grid gap-8">
      {groupByYear(books).map((group) => (
        <TimelineYear key={group.heading} heading={group.heading} books={group.books} />
      ))}
    </div>
  )
}

function TimelineYear({ heading, books }: { heading: string; books: LibraryBook[] }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-3 text-2xl text-forest">
        {heading}
      </h2>
      <ol className="grid gap-3 border-l-2 border-soft-green pl-4">
        {books.map((book) => (
          <li key={book.id}>
            <Link
              to={bookPath(book)}
              className="group flex gap-4 rounded-xl border border-wood/30 bg-paper p-3 shadow-sm hover:bg-sage/30"
            >
              <BookCover book={book} compact className="w-14 shrink-0 self-start" />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-sm text-bark">
                  {formatReadingDates(book.readingStartDate, book.readingEndDate, book.datesApproximate)}
                </span>
                <span className="font-serif text-lg leading-tight font-semibold break-words text-forest group-hover:underline">
                  {book.title}
                </span>
                <span className="text-sm break-words text-bark">{formatAuthors(book.authors)}</span>
                <span>
                  <BookStatusLabel status={book.status} />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
