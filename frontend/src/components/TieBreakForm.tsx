import { useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { useApi } from '../api/hooks'
import type { Vote } from '../api/types'
import { voteErrorKind } from '../lib/votes'

const NOTE_MAX_LENGTH = 1000

// The admin's form to record the book the club chose after a tie (#91),
// shown only when the server says so (`canRecordTieWinner`). It offers only
// the tied books and picks none; the server checks every rule.
export function TieBreakForm({
  vote,
  tiedBookIds,
  onSaved,
  onChanged,
}: {
  vote: Vote
  tiedBookIds: string[]
  onSaved: (vote: Vote) => void
  // Refused with a 409 or 403: the page reloads the vote.
  onChanged: () => void
}) {
  const api = useApi()
  const [bookId, setBookId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [missingChoice, setMissingChoice] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const running = useRef(false)
  const firstRadio = useRef<HTMLInputElement>(null)
  const [focusChoice, setFocusChoice] = useState(0)
  const headingId = useId()
  const errorId = useId()
  const noteId = useId()
  const noteHintId = useId()
  const tied = tiedBookIds.flatMap((id) => vote.candidates.find((c) => c.book.id === id)?.book ?? [])

  useLayoutEffect(() => {
    if (focusChoice) firstRadio.current?.focus()
  }, [focusChoice])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (running.current) return
    if (!bookId) {
      setMissingChoice(true)
      setFocusChoice((n) => n + 1)
      return
    }
    running.current = true
    setBusy(true)
    setFailed(false)
    try {
      onSaved(await api.recordTieWinner(vote.id, bookId, note))
    } catch (error) {
      const kind = voteErrorKind(error)
      if (kind === 'changed') onChanged()
      else if (kind === 'failed') setFailed(true)
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby={headingId} className="grid min-w-0 gap-4 rounded-xl border border-wood/30 bg-paper p-5 shadow-sm">
      <h3 id={headingId} className="text-lg text-forest">
        Registrar el libro elegido
      </h3>
      <form noValidate onSubmit={(event) => void submit(event)} className="grid min-w-0 gap-4">
        <fieldset className="grid min-w-0 gap-2" aria-describedby={missingChoice ? errorId : undefined}>
          <legend className="mb-1 font-semibold text-forest">¿Qué libro ha elegido el club?</legend>
          {tied.map((book, index) => (
            <label key={book.id} className="flex min-w-0 items-start gap-2">
              <input
                ref={index === 0 ? firstRadio : undefined}
                type="radio"
                name={`tie-break-${vote.id}`}
                value={book.id}
                checked={bookId === book.id}
                onChange={() => {
                  setBookId(book.id)
                  setMissingChoice(false)
                }}
                className="mt-1 size-5 shrink-0 accent-forest"
              />
              <span className="break-words">{book.title}</span>
            </label>
          ))}
          {missingChoice && (
            <p id={errorId} role="alert" className="text-bark">
              Elige el libro que ha decidido el club.
            </p>
          )}
        </fieldset>
        <div className="grid min-w-0 gap-1">
          <label htmlFor={noteId} className="font-semibold text-forest">
            Nota del desempate (opcional)
          </label>
          <textarea
            id={noteId}
            value={note}
            maxLength={NOTE_MAX_LENGTH}
            rows={4}
            aria-describedby={noteHintId}
            onChange={(event) => setNote(event.target.value)}
            className="w-full min-w-0 rounded-lg border border-wood/60 bg-parchment p-2"
          />
          <p id={noteHintId} className="text-sm text-bark">
            Por ejemplo, cómo lo decidisteis. Hasta {NOTE_MAX_LENGTH} caracteres.
          </p>
        </div>
        <div className="grid justify-items-start gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-forest px-5 py-2.5 font-semibold text-parchment hover:bg-moss disabled:opacity-60"
          >
            Guardar libro elegido
          </button>
          {failed && (
            <p role="alert" className="text-bark">
              No se ha podido guardar el libro elegido. Inténtalo de nuevo.
            </p>
          )}
        </div>
      </form>
    </section>
  )
}
