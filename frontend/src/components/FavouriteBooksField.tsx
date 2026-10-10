import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { BookSummary } from '../api/types'
import { formatAuthors } from '../lib/format'
import { FAVOURITE_BOOKS_MAX } from '../lib/profile'
import { EmptyState } from './Card'

const smallButton =
  'rounded-md border border-forest px-3 py-1.5 text-forest hover:bg-sage/50 disabled:cursor-not-allowed disabled:opacity-50'

// «Libros favoritos» on Mi perfil (#94): up to five club books, picked from
// the server's `favouriteOptions` (never free text) and ordered with buttons.
// Nothing is sent until the whole form is saved.
export function FavouriteBooksField({
  chosen,
  options,
  onChange,
}: {
  chosen: BookSummary[]
  options: BookSummary[]
  onChange: (books: BookSummary[]) => void
}) {
  const [status, setStatus] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const listRef = useRef<HTMLFieldSetElement>(null)
  // Where keyboard focus goes after the next render, so it never falls back
  // to the page body when the focused control moves or disappears.
  const focusNext = useRef<(() => HTMLElement | null) | null>(null)
  const hintId = useId()
  const selectId = useId()

  useLayoutEffect(() => {
    const find = focusNext.current
    if (!find) return
    focusNext.current = null
    find()?.focus()
  })

  const byKey = (key: string) => listRef.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`) ?? null
  const addControl = () => listRef.current?.querySelector<HTMLElement>('select') ?? null

  const chosenIds = new Set(chosen.map((b) => b.id))
  const available = options.filter((b) => !chosenIds.has(b.id))
  const atLimit = chosen.length >= FAVOURITE_BOOKS_MAX
  const selected = available.find((b) => b.id === selectedId) ?? available[0] ?? null

  const move = (book: BookSummary, direction: 'up' | 'down') => {
    const from = chosen.findIndex((b) => b.id === book.id)
    const to = direction === 'up' ? from - 1 : from + 1
    if (from < 0 || to < 0 || to >= chosen.length) return
    const next = [...chosen]
    next.splice(from, 1)
    next.splice(to, 0, book)
    onChange(next)
    setStatus(`${book.title}: posición ${to + 1} de ${next.length}.`)
    // Stay on the moved book: the same button if it can still be used, otherwise the other one.
    const key = `${direction}:${book.id}`
    const other = `${direction === 'up' ? 'down' : 'up'}:${book.id}`
    focusNext.current = () => {
      const same = byKey(key)
      return same && !same.hasAttribute('disabled') ? same : byKey(other)
    }
  }

  const remove = (book: BookSummary) => {
    const index = chosen.findIndex((b) => b.id === book.id)
    const next = chosen.filter((b) => b.id !== book.id)
    onChange(next)
    setStatus(`Se ha quitado «${book.title}» de tus libros favoritos.`)
    // The next book's «Quitar», the previous one's, or the add control.
    const neighbour = next[index] ?? next[index - 1]
    focusNext.current = () => (neighbour && byKey(`remove:${neighbour.id}`)) || addControl()
  }

  const add = () => {
    if (!selected || atLimit) return
    const next = [...chosen, selected]
    onChange(next)
    setStatus(`Se ha añadido «${selected.title}»: posición ${next.length} de ${next.length}.`)
    // With the list full the add controls are disabled, so stay on the new book.
    if (next.length >= FAVOURITE_BOOKS_MAX) focusNext.current = () => byKey(`remove:${selected.id}`)
  }

  return (
    <fieldset ref={listRef} aria-describedby={hintId} className="grid min-w-0 gap-3">
      <legend className="font-semibold text-forest">Libros favoritos</legend>
      <p id={hintId} className="-mt-2 text-sm text-bark">
        Hasta 5 libros que el club haya leído, en el orden que prefieras.
      </p>
      <p role="status" className={status ? 'text-moss' : 'sr-only'}>
        {status}
      </p>

      {chosen.length === 0 ? (
        <EmptyState>Aún no hay libros favoritos.</EmptyState>
      ) : (
        <ol className="grid gap-3">
          {chosen.map((book, index) => (
            <li key={book.id} className="grid min-w-0 gap-2 rounded-lg border border-wood/30 bg-parchment/60 p-3">
              <p className="min-w-0 break-words">
                <span className="font-semibold text-forest">
                  {index + 1}. {book.title}
                </span>
                <span className="block text-sm text-bark">{formatAuthors(book.authors)}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  data-key={`up:${book.id}`}
                  className={smallButton}
                  disabled={index === 0}
                  onClick={() => move(book, 'up')}
                >
                  Subir{' '}<span className="sr-only">«{book.title}»</span>
                </button>
                <button
                  type="button"
                  data-key={`down:${book.id}`}
                  className={smallButton}
                  disabled={index === chosen.length - 1}
                  onClick={() => move(book, 'down')}
                >
                  Bajar{' '}<span className="sr-only">«{book.title}»</span>
                </button>
                <button type="button" data-key={`remove:${book.id}`} className={smallButton} onClick={() => remove(book)}>
                  Quitar{' '}<span className="sr-only">«{book.title}»</span>
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {options.length === 0 ? (
        <EmptyState>El club aún no ha terminado ningún libro. Cuando lo haga, podrás elegir aquí tus favoritos.</EmptyState>
      ) : available.length === 0 && !atLimit ? (
        <p className="text-bark">Ya has elegido todos los libros que ha leído el club.</p>
      ) : (
        <div className="grid min-w-0 gap-2">
          <label htmlFor={selectId} className="font-semibold text-forest">
            Añadir un libro favorito
          </label>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <select
              id={selectId}
              value={selected?.id ?? ''}
              disabled={atLimit}
              onChange={(event) => setSelectedId(event.target.value)}
              className="w-full min-w-0 rounded-lg border border-wood/60 bg-paper p-2 text-forest disabled:opacity-60 sm:w-auto sm:max-w-full"
            >
              {available.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title}
                </option>
              ))}
            </select>
            <button type="button" className={smallButton} disabled={atLimit || !selected} onClick={add}>
              Añadir
            </button>
          </div>
          {atLimit && <p className="text-bark">Ya tienes 5 libros favoritos, que es el máximo. Quita uno si quieres añadir otro.</p>}
        </div>
      )}
    </fieldset>
  )
}
