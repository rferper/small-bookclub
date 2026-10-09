import { useId, useLayoutEffect, useRef, useState } from 'react'
import { useApi, useApiData } from '../api/hooks'
import type { LibraryBook, Vote, VoteCandidate } from '../api/types'
import { formatAuthors, formatVoteCount } from '../lib/format'
import { voteErrorKind } from '../lib/votes'
import { EmptyState } from './Card'
import { ConfirmDialog } from './ConfirmDialog'

const primaryButton = 'rounded-lg bg-forest px-5 py-2.5 font-semibold text-parchment hover:bg-moss disabled:opacity-60'
const smallButton =
  'rounded-md border border-forest px-3 py-1.5 text-forest hover:bg-sage/50 disabled:cursor-not-allowed disabled:opacity-50'

type Dialog = { kind: 'close' } | { kind: 'remove'; candidate: VoteCandidate }

// The «Gestionar la votación» section of the vote page (#91), shown only when
// the server says the user may manage this vote (`canManage`). The shortlist
// editor, opening and closing. Every rule is the server's; a refused change
// reloads the vote through `onChanged`.
export function VoteManagement({
  vote,
  onSaved,
  onClosed,
  onChanged,
}: {
  vote: Vote
  // A change was saved; the vote as the server returned it.
  onSaved: (vote: Vote) => void
  // The vote was closed; the section disappears with it.
  onClosed: (vote: Vote) => void
  // A change was refused with a 409 or 403: the page reloads the vote.
  onChanged: () => void
}) {
  const api = useApi()
  // The catalogue, to offer the «Propuesto» books that are not candidates yet.
  const books = useApiData((client) => client.listBooks())
  // Keys of the controls whose call is in flight; a ref too, so a double
  // click cannot start the same call twice.
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  const running = useRef(new Set<string>())
  // Control key -> Spanish alert shown next to it.
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState('')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const sectionRef = useRef<HTMLElement>(null)
  // Where keyboard focus goes after the next render, so it never falls back
  // to the page body when the focused control disappears or moves.
  const focusNext = useRef<(() => HTMLElement | null) | null>(null)
  const headingId = useId()
  const shortlistHeadingId = useId()
  const addHeadingId = useId()

  useLayoutEffect(() => {
    const find = focusNext.current
    if (!find) return
    focusNext.current = null
    find()?.focus()
  })

  const query = (selector: string) => sectionRef.current?.querySelector<HTMLElement>(selector) ?? null
  const byKey = (key: string) => query(`[data-key="${CSS.escape(key)}"]`)
  // The first usable button of a shortlist item.
  const firstButtonOf = (bookId: string) => query(`[data-item="${CSS.escape(bookId)}"] button:not([disabled])`)

  const setPendingKey = (key: string, on: boolean) => {
    if (on) running.current.add(key)
    else running.current.delete(key)
    setPending(new Set(running.current))
  }

  // Runs one change. Returns the saved vote; 'failed' after an error that
  // leaves the vote as it was (shown next to the control, or in the dialog
  // when `failure` is null); or null when the page takes over (a 409 or 403
  // reloads the vote, and a 401 already shows the sign-in screen).
  const run = async (key: string, failure: string | null, call: () => Promise<Vote>): Promise<Vote | 'failed' | null> => {
    if (running.current.has(key)) return null
    setPendingKey(key, true)
    setErrors((current) => withoutKey(current, key))
    setStatus('')
    try {
      return await call()
    } catch (error) {
      const kind = voteErrorKind(error)
      if (kind === 'changed') onChanged()
      if (kind !== 'failed') return null
      if (failure) setErrors((current) => ({ ...current, [key]: failure }))
      return 'failed'
    } finally {
      setPendingKey(key, false)
    }
  }

  const candidates = vote.candidates
  const candidateIds = new Set(candidates.map((c) => c.book.id))
  const addable = (books.status === 'ready' ? books.data : []).filter(
    (book) => book.status === 'propuesto' && !candidateIds.has(book.id),
  )
  // An open vote keeps at least two candidates (#91).
  const canRemove = vote.status === 'draft' || candidates.length > 2

  const move = async (candidate: VoteCandidate, direction: 'up' | 'down') => {
    const { id, title } = candidate.book
    const order = candidates.map((c) => c.book.id)
    const from = order.indexOf(id)
    const to = direction === 'up' ? from - 1 : from + 1
    if (to < 0 || to >= order.length) return
    order.splice(from, 1)
    order.splice(to, 0, id)
    const key = `${direction}:${id}`
    const saved = await run(key, `No se ha podido mover «${title}». Inténtalo de nuevo.`, () =>
      api.reorderCandidates(vote.id, order),
    )
    if (!saved || saved === 'failed') return
    const position = saved.candidates.findIndex((c) => c.book.id === id)
    onSaved(saved)
    setStatus(`«${title}» está ahora en el puesto ${position + 1} de ${saved.candidates.length}.`)
    // Stay on the moved book: the same button if it can still be used, otherwise the other one.
    focusNext.current = () => {
      const same = byKey(key)
      return same && !same.hasAttribute('disabled') ? same : firstButtonOf(id)
    }
  }

  const remove = async (candidate: VoteCandidate, inDialog: boolean) => {
    const { id, title } = candidate.book
    const index = candidates.findIndex((c) => c.book.id === id)
    const failure = `No se ha podido quitar «${title}». Inténtalo de nuevo.`
    const saved = await run(`remove:${id}`, inDialog ? null : failure, () => api.removeCandidate(vote.id, id))
    if (saved === 'failed') {
      if (inDialog) setDialogError(failure)
      return
    }
    setDialog(null)
    if (!saved) return
    onSaved(saved)
    setStatus(`Se ha quitado «${title}» de la lista.`)
    // The book that took its place, the one before it, or the list heading.
    const next = saved.candidates[index] ?? saved.candidates[index - 1]
    focusNext.current = () =>
      (next && firstButtonOf(next.book.id)) || document.getElementById(shortlistHeadingId)
  }

  const askToRemove = (candidate: VoteCandidate) => {
    // Removing a candidate also removes its votes, so ask first if it has any.
    if (vote.status === 'open' && candidate.approvals.length > 0) {
      setDialogError(null)
      setDialog({ kind: 'remove', candidate })
    } else {
      void remove(candidate, false)
    }
  }

  const add = async (book: LibraryBook) => {
    const index = addable.findIndex((b) => b.id === book.id)
    const saved = await run(`add:${book.id}`, `No se ha podido añadir «${book.title}». Inténtalo de nuevo.`, () =>
      api.addCandidate(vote.id, book.id),
    )
    if (!saved || saved === 'failed') return
    onSaved(saved)
    setStatus(`Se ha añadido «${book.title}» al final de la lista.`)
    // The next book to add, the one before it, or the «Añadir libros» heading.
    const remaining = addable.filter((b) => b.id !== book.id)
    const next = remaining[index] ?? remaining[index - 1]
    focusNext.current = () => (next && byKey(`add:${next.id}`)) || document.getElementById(addHeadingId)
  }

  const open = async () => {
    const saved = await run('open', 'No se ha podido abrir la votación. Inténtalo de nuevo.', () => api.openVote(vote.id))
    if (!saved || saved === 'failed') return
    onSaved(saved)
    setStatus('La votación está abierta. Ya se puede votar.')
    focusNext.current = () => document.getElementById(headingId)
  }

  const close = async () => {
    const saved = await run('close', null, () => api.closeVote(vote.id))
    if (saved === 'failed') {
      setDialogError('No se ha podido cerrar la votación. Inténtalo de nuevo.')
      return
    }
    setDialog(null)
    if (saved) onClosed(saved)
  }

  const cancelDialog = () => {
    const current = dialog
    setDialog(null)
    setDialogError(null)
    // Back to the control that opened the dialog.
    focusNext.current = () =>
      current?.kind === 'remove' ? byKey(`remove:${current.candidate.book.id}`) : byKey('close')
  }

  const alert = (key: string) =>
    errors[key] && (
      <p role="alert" className="mt-1 text-bark">
        {errors[key]}
      </p>
    )

  return (
    <section
      ref={sectionRef}
      aria-labelledby={headingId}
      className="grid min-w-0 gap-5 rounded-xl border border-wood/30 bg-paper p-5 shadow-sm"
    >
      <h2 id={headingId} tabIndex={-1} className="text-xl text-forest">
        Gestionar la votación
      </h2>
      <p role="status" className={status ? 'text-moss' : 'sr-only'}>
        {status}
      </p>

      <section aria-labelledby={shortlistHeadingId} className="grid min-w-0 gap-3">
        <h3 id={shortlistHeadingId} tabIndex={-1} className="text-lg text-forest">
          Lista de libros
        </h3>
        {candidates.length === 0 ? (
          <EmptyState>Todavía no hay libros en la lista.</EmptyState>
        ) : (
          <ol className="grid gap-3">
            {candidates.map((candidate, index) => {
              const { id, title } = candidate.book
              const removeKey = `remove:${id}`
              return (
                <li
                  key={id}
                  data-item={id}
                  className="grid min-w-0 gap-2 rounded-lg border border-wood/30 bg-parchment/60 p-3"
                >
                  <p className="min-w-0 break-words">
                    <span className="font-semibold text-forest">
                      {index + 1}. {title}
                    </span>
                    {vote.status === 'open' && (
                      <span className="text-bark"> · {formatVoteCount(candidate.approvals.length)}</span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      data-key={`up:${id}`}
                      className={smallButton}
                      disabled={index === 0 || pending.has(`up:${id}`)}
                      onClick={() => void move(candidate, 'up')}
                    >
                      Subir{' '}<span className="sr-only">«{title}»</span>
                    </button>
                    <button
                      type="button"
                      data-key={`down:${id}`}
                      className={smallButton}
                      disabled={index === candidates.length - 1 || pending.has(`down:${id}`)}
                      onClick={() => void move(candidate, 'down')}
                    >
                      Bajar{' '}<span className="sr-only">«{title}»</span>
                    </button>
                    {canRemove && (
                      <button
                        type="button"
                        data-key={removeKey}
                        className={smallButton}
                        disabled={pending.has(removeKey)}
                        onClick={() => askToRemove(candidate)}
                      >
                        Quitar{' '}<span className="sr-only">«{title}»</span>
                      </button>
                    )}
                  </div>
                  {alert(`up:${id}`)}
                  {alert(`down:${id}`)}
                  {alert(removeKey)}
                </li>
              )
            })}
          </ol>
        )}
        {!canRemove && (
          <p className="max-w-prose text-bark">
            Una votación abierta necesita al menos dos libros, así que ahora no se puede quitar ninguno.
          </p>
        )}
      </section>

      <section aria-labelledby={addHeadingId} className="grid min-w-0 gap-3">
        <h3 id={addHeadingId} tabIndex={-1} className="text-lg text-forest">
          Añadir libros
        </h3>
        {books.status === 'loading' && <p className="text-bark">Cargando los libros propuestos…</p>}
        {books.status === 'error' && (
          <div role="alert" className="grid justify-items-start gap-2">
            <p>No se han podido cargar los libros propuestos.</p>
            <button type="button" className={smallButton} onClick={books.reload}>
              Reintentar
            </button>
          </div>
        )}
        {books.status === 'ready' &&
          (addable.length === 0 ? (
            <EmptyState>No quedan libros propuestos en la Biblioteca. La administración puede añadir más.</EmptyState>
          ) : (
            <ul className="grid gap-3">
              {addable.map((book) => {
                const key = `add:${book.id}`
                return (
                  <li key={book.id} className="grid min-w-0 gap-2 rounded-lg border border-wood/30 p-3 sm:flex sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold break-words text-forest">{book.title}</p>
                      <p className="break-words text-bark">{formatAuthors(book.authors)}</p>
                    </div>
                    <div className="sm:shrink-0">
                      <button
                        type="button"
                        data-key={key}
                        className={smallButton}
                        disabled={pending.has(key)}
                        onClick={() => void add(book)}
                      >
                        Añadir{' '}<span className="sr-only">«{book.title}»</span>
                      </button>
                      {alert(key)}
                    </div>
                  </li>
                )
              })}
            </ul>
          ))}
      </section>

      {vote.status === 'draft' &&
        (candidates.length >= 2 ? (
          <div className="grid justify-items-start gap-2">
            <p className="max-w-prose">Cuando la lista esté lista, abre la votación para que todo el club pueda votar.</p>
            <button
              type="button"
              data-key="open"
              className={primaryButton}
              disabled={pending.has('open')}
              onClick={() => void open()}
            >
              Abrir votación
            </button>
            {alert('open')}
          </div>
        ) : (
          <p className="max-w-prose text-bark">Para abrir la votación hacen falta al menos dos libros en la lista.</p>
        ))}

      {vote.status === 'open' && (
        <div className="grid justify-items-start gap-2">
          <p className="max-w-prose">Cuando el club haya tenido tiempo de votar, puedes cerrar la votación.</p>
          <button
            type="button"
            data-key="close"
            className={primaryButton}
            onClick={() => {
              setDialogError(null)
              setDialog({ kind: 'close' })
            }}
          >
            Cerrar votación
          </button>
        </div>
      )}

      {dialog?.kind === 'close' && (
        <ConfirmDialog
          title="¿Cerrar la votación?"
          confirmLabel="Cerrar votación"
          busy={pending.has('close')}
          error={dialogError}
          onCancel={cancelDialog}
          onConfirm={() => void close()}
        >
          <p>Después de cerrarla, nadie podrá cambiar sus votos.</p>
          <p>Si hay un empate, el club decidirá entre todos qué libro se lee.</p>
        </ConfirmDialog>
      )}
      {dialog?.kind === 'remove' && (
        <ConfirmDialog
          title={`¿Quitar «${dialog.candidate.book.title}» de la lista?`}
          confirmLabel="Quitar"
          busy={pending.has(`remove:${dialog.candidate.book.id}`)}
          error={dialogError}
          onCancel={cancelDialog}
          onConfirm={() => void remove(dialog.candidate, true)}
        >
          <p>{removalWarning(dialog.candidate)}</p>
        </ConfirmDialog>
      )}
    </section>
  )
}

function withoutKey(record: Record<string, string>, key: string): Record<string, string> {
  const rest = { ...record }
  delete rest[key]
  return rest
}

function removalWarning({ book, approvals }: VoteCandidate): string {
  const count = approvals.length
  return count === 1 ? `Quitar «${book.title}» borrará su voto.` : `Quitar «${book.title}» borrará sus ${count} votos.`
}
