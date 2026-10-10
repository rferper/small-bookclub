import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { useApi, useApiData } from '../api/hooks'
import type { BookDetail, BookMeeting, ScheduleWeek } from '../api/types'
import { BookCover } from '../components/BookCover'
import { BookStatusLabel } from '../components/BookStatusLabel'
import { Card, EmptyState } from '../components/Card'
import { RatingsSection } from '../components/RatingsSection'
import { LoadError, Loading } from '../components/Status'
import {
  formatAuthors,
  formatCalendarDate,
  formatMeetingDate,
  formatPageRange,
  formatPercentRange,
  formatReadingDates,
} from '../lib/format'

const linkClass = 'text-moss underline underline-offset-4 hover:text-forest'

export function BookPage() {
  const { bookId = '' } = useParams()
  // A new id is a new page: start again from «Cargando…» instead of showing the previous book.
  return <BookPageContent key={bookId} bookId={bookId} />
}

function BookPageContent({ bookId }: { bookId: string }) {
  // Only the book itself: its meeting summaries (#65) are gated and live on
  // the meeting pages, and its ratings (#67) are gated and loaded by the
  // «Valoraciones» section with their own call.
  const book = useApiData((api) => api.getBook(bookId))

  if (book.status === 'loading') return <Loading />
  if (book.status === 'error') {
    if (book.error instanceof ApiError && book.error.status === 404) return <BookNotFound />
    return <LoadError onRetry={book.reload} />
  }
  return <BookView book={book.data} />
}

function BackToLibrary() {
  return (
    <Link to="/biblioteca" className={linkClass}>
      ← Volver a la biblioteca
    </Link>
  )
}

// Also used by the rating form for an unknown book.
export function BookNotFound() {
  return (
    <section className="rounded-xl border border-wood/30 bg-paper p-6">
      <h1 className="text-3xl text-forest">No encontramos este libro</h1>
      <p className="mt-2 text-bark">
        Puede que el enlace no esté bien o que el libro ya no forme parte de la biblioteca del club.
      </p>
      <p className="mt-3">
        <BackToLibrary />
      </p>
    </section>
  )
}

// Same page for members and admins: editing a book belongs to the admin
// screens (#70). «He terminado el libro» lives in the ratings section.
function BookView({ book }: { book: BookDetail }) {
  const metadata = [
    ['Publicación', book.publicationDate],
    ['Editorial', book.publisher],
    ['ISBN', book.isbn],
    ['Páginas', book.pageCount === null ? null : String(book.pageCount)],
    ['Inicio previsto', book.plannedStartDate ? formatReadingDates(book.plannedStartDate, null, book.datesApproximate) : null],
    ['Fin previsto', book.plannedEndDate ? formatReadingDates(null, book.plannedEndDate, book.datesApproximate) : null],
  ].filter((entry): entry is [string, string] => entry[1] !== null && entry[1] !== '')

  return (
    <div className="grid gap-6">
      <p>
        <BackToLibrary />
      </p>

      <div className="grid gap-6 md:grid-cols-[12rem_minmax(0,1fr)] lg:grid-cols-[15rem_minmax(0,1fr)]">
        <BookCover book={book} className="w-40 md:w-full" />
        <div className="flex min-w-0 flex-col gap-3">
          <h1 className="text-3xl break-words text-forest sm:text-4xl">{book.title}</h1>
          <p className="text-lg break-words">{formatAuthors(book.authors)}</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <BookStatusLabel status={book.status} />
            <span className="text-bark">
              {formatReadingDates(book.readingStartDate, book.readingEndDate, book.datesApproximate)}
            </span>
          </p>
          {book.description && (
            // Plain text: React escapes it, so markup in a description is shown, not rendered.
            <p className="max-w-prose break-words whitespace-pre-line">{book.description}</p>
          )}
          {metadata.length > 0 && (
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
              {metadata.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-bark">{label}</dt>
                  <dd className="break-words">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {book.originVote && (
            <p>
              <Link to={`/votaciones/${encodeURIComponent(book.originVote.id)}`} className={linkClass}>
                Ver la votación en la que se eligió
              </Link>
              <span className="block text-sm break-words text-bark">{book.originVote.label}</span>
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Schedule weeks={book.schedule} />
        <Meetings meetings={book.meetings} />
        <RatingsSection bookId={book.id} />
      </div>
    </div>
  )
}

const meetingPath = (id: string) => `/reuniones/${encodeURIComponent(id)}`

function Schedule({ weeks }: { weeks: ScheduleWeek[] }) {
  if (weeks.length === 0) {
    return (
      <Card title="Plan de lectura" className="lg:col-span-2">
        <EmptyState>Este libro no tiene un plan de lectura semanal.</EmptyState>
      </Card>
    )
  }
  return (
    <Card title="Plan de lectura" className="lg:col-span-2">
      <ol className="grid gap-3">
        {[...weeks]
          .sort((a, b) => a.weekNumber - b.weekNumber)
          .map((week) => {
            const due = formatCalendarDate(week.dueDate)
            return (
              <li key={week.id} className="border-b border-wood/20 pb-3 last:border-b-0 last:pb-0">
                <p className="font-serif text-lg font-semibold text-moss">Semana {week.weekNumber}</p>
                {/* Percent and pages are independent facts, shown exactly as set (§5.2). */}
                <p className="flex flex-wrap gap-x-4 text-forest">
                  <span>{formatPercentRange(week.percentStart, week.percentEnd)}</span>
                  <span>{formatPageRange(week.pageStart, week.pageEnd)}</span>
                </p>
                {week.meeting ? (
                  <p className="text-bark">
                    Para la reunión del{' '}
                    <Link to={meetingPath(week.meeting.id)} className={linkClass}>
                      {formatMeetingDate(week.meeting.startsAt)}
                    </Link>
                  </p>
                ) : (
                  due && <p className="text-bark">Para el {due}</p>
                )}
                {week.notes && <p className="mt-1 text-sm break-words">Nota: {week.notes}</p>}
                <WeekCompletion week={week} />
              </li>
            )
          })}
      </ol>
    </Card>
  )
}

// Each row keeps its last confirmed state and its own request/error. A book
// navigation unmounts it, so a late save cannot change the next book's rows.
function WeekCompletion({ week }: { week: ScheduleWeek }) {
  const api = useApi()
  const [completed, setCompleted] = useState(week.completedByMe)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const inFlight = useRef(false)

  const toggle = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setSaving(true)
    setFailed(false)
    const next = !completed
    try {
      await api.setWeekCompleted(week.id, next)
      setCompleted(next)
    } catch {
      setFailed(true)
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  const action = completed ? 'Desmarcar' : 'Marcar como leído'
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={saving}
          aria-pressed={completed}
          aria-label={`Semana ${week.weekNumber}: ${saving ? 'Guardando…' : action}`}
          className={completed
            ? 'rounded-lg border-2 border-forest px-4 py-2 font-semibold text-forest hover:bg-sage/50 disabled:opacity-60'
            : 'rounded-lg bg-forest px-4 py-2 font-semibold text-parchment hover:bg-moss disabled:opacity-60'}
        >
          {saving ? 'Guardando…' : action}
        </button>
        <p className={completed ? 'text-moss' : 'text-bark'}>
          {completed ? 'Has marcado esta semana como leída.' : 'Aún no has marcado esta semana como leída.'}
        </p>
      </div>
      {failed && <p role="alert" className="mt-2 text-bark">No se ha podido guardar. Inténtalo de nuevo.</p>}
    </div>
  )
}

function Meetings({ meetings }: { meetings: BookMeeting[] }) {
  if (meetings.length === 0) {
    return (
      <Card title="Reuniones">
        <EmptyState>Todavía no hay reuniones sobre este libro.</EmptyState>
      </Card>
    )
  }
  return (
    <Card title="Reuniones">
      <ol className="grid gap-2">
        {[...meetings]
          .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
          .map((meeting) => (
            <li key={meeting.id} className="flex flex-wrap items-baseline gap-x-3">
              <Link to={meetingPath(meeting.id)} className={linkClass}>
                {formatMeetingDate(meeting.startsAt)}
              </Link>
              {meeting.weekNumber !== null && <span className="text-bark">Semana {meeting.weekNumber}</span>}
              {meeting.cancelled && <span className="font-semibold text-bark">Cancelada</span>}
            </li>
          ))}
      </ol>
    </Card>
  )
}
