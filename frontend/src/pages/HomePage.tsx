import { useState } from 'react'
import { Link } from 'react-router'
import { useApi, useApiData } from '../api/hooks'
import type { HomeData, ReadingWeek } from '../api/types'
import { Avatar } from '../components/Avatar'
import { BookCover } from '../components/BookCover'
import { Card, EmptyState } from '../components/Card'
import { LoadError, Loading } from '../components/Status'
import {
  formatAuthors,
  formatDayMonth,
  formatMeetingDate,
  formatPageRange,
  formatPercentRange,
  formatShortDay,
} from '../lib/format'

export function HomePage() {
  const home = useApiData((api) => api.getHome())

  if (home.status === 'loading') return <Loading />
  if (home.status === 'error') return <LoadError onRetry={home.reload} />

  const { data } = home
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <CurrentBook data={data} />
        {data.currentBook && <ThisWeek week={data.currentWeek} onChanged={home.reload} />}
        {data.currentWeek && <MemberProgressCard data={data} />}
      </div>
      <div className="flex flex-col gap-6">
        <NextMeetingCard data={data} />
        <StatsCard data={data} />
        {data.quote && (
          <figure className="rounded-xl border-l-4 border-soft-green bg-paper p-5">
            <blockquote className="font-serif text-lg whitespace-pre-line text-forest">
              «{data.quote.text.replaceAll(' / ', '\n')}»
            </blockquote>
            {data.quote.source && <figcaption className="mt-2 text-sm text-bark">— {data.quote.source}</figcaption>}
          </figure>
        )}
        <ActivityCard data={data} />
      </div>
    </div>
  )
}

function CurrentBook({ data }: { data: HomeData }) {
  const book = data.currentBook
  if (!book) {
    return (
      <Card title="Leyendo ahora">
        <EmptyState>Todavía no hay un libro en curso. Cuando el club elija uno, aparecerá aquí.</EmptyState>
      </Card>
    )
  }
  return (
    <section aria-labelledby="leyendo-ahora" className="flex gap-5 rounded-xl bg-forest p-5 text-parchment shadow-md">
      <BookCover book={book} className="w-24 shrink-0 sm:w-32" />
      <div className="flex flex-col justify-center gap-1">
        <p id="leyendo-ahora" className="text-sm tracking-wide uppercase opacity-90">
          Leyendo ahora
        </p>
        <h1 className="text-3xl sm:text-4xl">{book.title}</h1>
        <p className="text-lg">{formatAuthors(book.authors)}</p>
        <Link to={`/biblioteca/${book.id}`} className="mt-2 underline underline-offset-4">
          Ver ficha del libro
        </Link>
      </div>
    </section>
  )
}

function ThisWeek({ week, onChanged }: { week: ReadingWeek | null; onChanged: () => void }) {
  const api = useApi()
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  if (!week) {
    return (
      <Card title="Lectura de esta semana">
        <EmptyState>Aún no se ha fijado la lectura de esta semana.</EmptyState>
      </Card>
    )
  }

  const toggle = async () => {
    setSaving(true)
    setFailed(false)
    try {
      await api.setWeekCompleted(week.id, !week.completedByMe)
      onChanged()
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card title="Lectura de esta semana" className="border-2 border-soft-green">
      <p className="font-serif text-lg text-moss">Semana {week.weekNumber}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p className="text-4xl font-semibold text-forest">{formatPercentRange(week.percentStart, week.percentEnd)}</p>
        <p className="text-2xl text-forest">{formatPageRange(week.pageStart, week.pageEnd)}</p>
      </div>
      {week.meetingStartsAt && (
        <p className="mt-2 text-bark">Para la reunión del {formatShortDay(week.meetingStartsAt)}</p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={saving}
          aria-pressed={week.completedByMe}
          className={
            week.completedByMe
              ? 'rounded-lg border-2 border-forest px-4 py-2 font-semibold text-forest hover:bg-sage/50 disabled:opacity-60'
              : 'rounded-lg bg-forest px-4 py-2 font-semibold text-parchment hover:bg-moss disabled:opacity-60'
          }
        >
          {week.completedByMe ? 'Desmarcar' : 'Marcar como leído'}
        </button>
        {week.completedByMe && <p className="text-moss">Has marcado esta semana como leída.</p>}
      </div>
      {failed && (
        <p role="alert" className="mt-2 text-bark">
          No se ha podido guardar. Inténtalo de nuevo.
        </p>
      )}
    </Card>
  )
}

function MemberProgressCard({ data }: { data: HomeData }) {
  const everyoneDone = data.memberProgress.length > 0 && data.memberProgress.every((p) => p.completed)
  return (
    <Card title="Cómo va el club esta semana">
      {everyoneDone && <p className="mb-3 text-moss">Todo el club ha terminado la lectura de esta semana.</p>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {data.memberProgress.map(({ member, completed }) => (
          <li key={member.id} className="flex items-center gap-2">
            <Avatar member={member} />
            <span>
              <span className="block">{member.displayName}</span>
              <span className={`block text-sm ${completed ? 'text-moss' : 'text-bark'}`}>
                {completed ? '✓ Leído' : 'Leyendo'}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function NextMeetingCard({ data }: { data: HomeData }) {
  const meeting = data.nextMeeting
  return (
    <Card title="Próxima reunión">
      {meeting ? (
        <>
          <p className="text-lg first-letter:uppercase">{formatMeetingDate(meeting.startsAt)}</p>
          {meeting.book && (
            <p className="text-bark">
              «{meeting.book.title}»{meeting.weekNumber !== null && ` · semana ${meeting.weekNumber}`}
            </p>
          )}
          <Link to={`/reuniones/${meeting.id}`} className="mt-2 inline-block text-moss underline underline-offset-4">
            Ver reunión
          </Link>
        </>
      ) : (
        <EmptyState>No hay ninguna reunión programada.</EmptyState>
      )}
    </Card>
  )
}

function StatsCard({ data }: { data: HomeData }) {
  const items = [
    { value: data.stats.booksCompleted, label: data.stats.booksCompleted === 1 ? 'libro leído' : 'libros leídos' },
    { value: data.stats.reviews, label: data.stats.reviews === 1 ? 'valoración' : 'valoraciones' },
    { value: data.stats.members, label: data.stats.members === 1 ? 'miembro' : 'miembros' },
  ]
  return (
    <Card title="El club en números">
      <dl className="grid grid-cols-3 gap-2 text-center">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col-reverse">
            <dt className="text-sm text-bark">{item.label}</dt>
            <dd className="font-serif text-3xl text-forest">{item.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function ActivityCard({ data }: { data: HomeData }) {
  return (
    <Card title="Actividad reciente">
      {data.recentActivity.length ? (
        <ul className="flex flex-col gap-3">
          {data.recentActivity.map((event) => (
            <li key={event.id} className="border-l-2 border-sage pl-3">
              <p>{event.text}</p>
              <p className="text-sm text-bark">{formatDayMonth(event.occurredAt)}</p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>Todavía no hay actividad en el club.</EmptyState>
      )}
    </Card>
  )
}
