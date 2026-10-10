import { useId, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { useApi, useApiData } from '../api/hooks'
import type { BookRatings, Criterion, CriterionScores, RatingRubric } from '../api/types'
import { StarRating } from '../components/StarRating'
import { LoadError, Loading } from '../components/Status'
import {
  CRITERIA,
  CRITERION_HINTS,
  CRITERION_LABELS,
  formatMean,
  NOT_RATABLE_MESSAGE,
  REVIEW_TEXT_MAX_LENGTH,
  reviewOverall,
  type RatingSavedState,
} from '../lib/ratings'
import { bookPath } from '../lib/votes'
import { BookNotFound } from './BookPage'

const linkClass = 'text-moss underline underline-offset-4 hover:text-forest'

export function RatePage() {
  const { bookId = '' } = useParams()
  // A new id is a new page: start again from «Cargando…».
  return <RatePageContent key={bookId} bookId={bookId} />
}

function RatePageContent({ bookId }: { bookId: string }) {
  // Only the user's own data and the rubric: nothing of other members is
  // shown here. «Reintentar» reloads both calls.
  const data = useApiData((api) => Promise.all([api.getBookRatings(bookId), api.getRatingRubric()]))

  if (data.status === 'loading') return <Loading />
  if (data.status === 'error') {
    if (data.error instanceof ApiError && data.error.status === 404) return <BookNotFound />
    return <LoadError onRetry={data.reload} />
  }
  const [ratings, rubric] = data.data
  const title = ratings.myReview
    ? `Editar mi valoración de «${ratings.book.title}»`
    : `Valorar «${ratings.book.title}»`

  return (
    <div className="grid gap-6">
      <h1 className="text-3xl break-words text-forest sm:text-4xl">{title}</h1>
      {!ratings.ratable ? (
        <Notice bookId={bookId}>{NOT_RATABLE_MESSAGE}</Notice>
      ) : !ratings.finishedByMe ? (
        <Notice bookId={bookId}>
          Para valorar este libro, primero márcalo como terminado en su ficha, en «Valoraciones».
        </Notice>
      ) : (
        <RatingForm ratings={ratings} rubric={rubric} />
      )}
    </div>
  )
}

function Notice({ bookId, children }: { bookId: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 rounded-xl border border-wood/30 bg-paper p-5">
      <p className="max-w-prose">{children}</p>
      <p>
        <Link to={bookPath(bookId)} className={linkClass}>
          Ir a la ficha del libro
        </Link>
      </p>
    </section>
  )
}

type SaveError = 'conflict' | 'invalid' | 'failed'

function RatingForm({ ratings, rubric }: { ratings: BookRatings; rubric: RatingRubric }) {
  const api = useApi()
  const navigate = useNavigate()
  const bookId = ratings.book.id
  const [scores, setScores] = useState<Partial<CriterionScores>>(() => ({ ...ratings.myReview?.scores }))
  const [text, setText] = useState(ratings.myReview?.text ?? '')
  // Criteria found missing on the last attempt to save, until given a value.
  const [flagged, setFlagged] = useState<Criterion[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<SaveError | null>(null)
  const textId = useId()
  const hintId = useId()

  const firstInputs = useRef<Partial<Record<Criterion, HTMLInputElement | null>>>({})
  // The first missing group after a refused save, as a new object each time
  // so a second refusal moves focus again.
  const [focusTarget, setFocusTarget] = useState<{ criterion: Criterion } | null>(null)
  useLayoutEffect(() => {
    if (focusTarget) firstInputs.current[focusTarget.criterion]?.focus()
  }, [focusTarget])

  const complete = CRITERIA.every((criterion) => scores[criterion] !== undefined)
  const missing = flagged.filter((criterion) => scores[criterion] === undefined)

  const choose = (criterion: Criterion, value: number) => {
    setScores((current) => ({ ...current, [criterion]: value }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    const nowMissing = CRITERIA.filter((criterion) => scores[criterion] === undefined)
    if (nowMissing.length > 0) {
      setFlagged(nowMissing)
      setSaveError(null)
      setFocusTarget({ criterion: nowMissing[0] })
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      await api.saveMyReview(bookId, { scores: scores as CriterionScores, text })
      const state: RatingSavedState = { ratingSaved: true }
      await navigate(bookPath(bookId), { state })
    } catch (error) {
      const status = error instanceof ApiError ? error.status : null
      // A 401 already sends the visitor to the sign-in screen.
      if (status !== 401) setSaveError(status === 409 ? 'conflict' : status === 400 ? 'invalid' : 'failed')
      setSaving(false)
    }
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-6">
      <p className="max-w-prose">
        Puntúa los cinco criterios de 1 a 5 estrellas; puedes usar medias estrellas. La reseña es opcional, y podrás
        cambiar tu valoración cuando quieras.
      </p>

      <div className="grid gap-6 rounded-xl border border-wood/30 bg-paper p-5 shadow-sm lg:grid-cols-2">
        {CRITERIA.map((criterion) => (
          <StarRating
            key={criterion}
            name={criterion}
            label={CRITERION_LABELS[criterion]}
            hint={CRITERION_HINTS[criterion]}
            value={scores[criterion]}
            onChange={(value) => choose(criterion, value)}
            error={missing.includes(criterion) ? `Elige una puntuación para ${CRITERION_LABELS[criterion]}.` : null}
            anchors={rubric[criterion]}
            firstInputRef={(input) => {
              firstInputs.current[criterion] = input
            }}
          />
        ))}
      </div>

      <p role="status" className="text-lg font-semibold text-forest">
        {complete
          ? `Tu media: ${formatMean(reviewOverall(scores as CriterionScores))} / 5`
          : 'Elige las cinco puntuaciones para ver tu media.'}
      </p>

      <div className="grid max-w-prose gap-1">
        <label htmlFor={textId} className="font-semibold text-forest">
          Reseña (opcional)
        </label>
        <p id={hintId} className="text-sm text-bark">
          Hasta {REVIEW_TEXT_MAX_LENGTH} caracteres. Se mostrará tal cual, como texto.
        </p>
        <textarea
          id={textId}
          aria-describedby={hintId}
          value={text}
          maxLength={REVIEW_TEXT_MAX_LENGTH}
          rows={6}
          onChange={(event) => setText(event.target.value.slice(0, REVIEW_TEXT_MAX_LENGTH))}
          className="w-full rounded-lg border border-wood/60 bg-paper p-3"
        />
      </div>

      {missing.length > 0 && (
        <p role="alert" className="font-semibold text-bark">
          Falta puntuar: {new Intl.ListFormat('es-ES', { type: 'conjunction' }).format(missing.map((c) => CRITERION_LABELS[c]))}.
        </p>
      )}
      {saveError && <SaveErrorMessage error={saveError} bookId={bookId} />}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-forest px-4 py-2 font-semibold text-parchment hover:bg-moss disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar valoración'}
        </button>
        <Link to={bookPath(bookId)} className={linkClass}>
          Cancelar
        </Link>
      </div>
    </form>
  )
}

function SaveErrorMessage({ error, bookId }: { error: SaveError; bookId: string }) {
  return (
    <div role="alert" className="max-w-prose text-bark">
      {error === 'conflict' ? (
        <p>
          No se ha podido guardar tu valoración porque el libro ya no está listo para valorarse.{' '}
          <Link to={bookPath(bookId)} className={linkClass}>
            Volver al libro
          </Link>
        </p>
      ) : error === 'invalid' ? (
        <p>Alguna puntuación no es válida. Revisa los cinco criterios y vuelve a intentarlo.</p>
      ) : (
        <p>No se ha podido guardar tu valoración. Inténtalo de nuevo.</p>
      )}
    </div>
  )
}
