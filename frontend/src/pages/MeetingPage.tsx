import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { useApiData } from '../api/hooks'
import type { MeetingAssignment, MeetingDetail, MeetingHighlight, MeetingRecord, MemberSummary } from '../api/types'
import { Avatar } from '../components/Avatar'
import { Card, EmptyState } from '../components/Card'
import { MeetingReading } from '../components/MeetingReading'
import { LoadError, Loading } from '../components/Status'
import { formatAuthors, formatMeetingDay, formatMeetingTime, formatPageRange } from '../lib/format'

const linkClass = 'text-moss underline underline-offset-4 hover:text-forest'

export function MeetingPage() {
  const { meetingId = '' } = useParams()
  // A new id is a new page: start again from «Cargando…» instead of showing the previous meeting.
  return <MeetingPageContent key={meetingId} meetingId={meetingId} />
}

function MeetingPageContent({ meetingId }: { meetingId: string }) {
  // Only this call: the server leaves out the summary and highlights unless
  // the signed-in member may see them, so nothing gated reaches the page.
  const meeting = useApiData((api) => api.getMeeting(meetingId))

  if (meeting.status === 'loading') return <Loading />
  if (meeting.status === 'error') {
    if (meeting.error instanceof ApiError && meeting.error.status === 404) return <MeetingNotFound />
    return <LoadError onRetry={meeting.reload} />
  }
  return <MeetingView meeting={meeting.data} />
}

function BackToMeetings() {
  return (
    <Link to="/reuniones" className={linkClass}>
      ← Volver a Reuniones
    </Link>
  )
}

function MeetingNotFound() {
  return (
    <section className="rounded-xl border border-wood/30 bg-paper p-6">
      <h1 className="text-3xl text-forest">No encontramos esta reunión</h1>
      <p className="mt-2 text-bark">Puede que el enlace no esté bien o que la reunión ya no esté en el calendario del club.</p>
      <p className="mt-3">
        <BackToMeetings />
      </p>
    </section>
  )
}

// Same page for members and admins: editing meetings, attendance and
// summaries belongs to Administración (#70), and marking past weeks to #90.
function MeetingView({ meeting }: { meeting: MeetingDetail }) {
  const showAttendance = !meeting.upcoming && !meeting.cancelled

  return (
    <div className="grid gap-6">
      <p>
        <BackToMeetings />
      </p>

      <div>
        <h1 className="text-3xl break-words text-forest sm:text-4xl">Reunión del {formatMeetingDay(meeting.startsAt)}</h1>
        {meeting.cancelled && (
          <p className="mt-3 inline-block rounded-lg border-2 border-wood/60 bg-paper px-3 py-1 font-semibold text-forest">
            Reunión cancelada
          </p>
        )}
      </div>

      <div className={meeting.cancelled ? 'grid gap-6' : 'grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start'}>
        <div className="grid min-w-0 gap-6">
          <MeetingFacts meeting={meeting} />
          {showAttendance && <Attendance attendance={meeting.attendance} />}
        </div>
        {!meeting.cancelled && (
          <div className="grid min-w-0 gap-6">
            <Record record={meeting.record} assignment={meeting.assignment} />
          </div>
        )}
      </div>
    </div>
  )
}

function MeetingFacts({ meeting }: { meeting: MeetingDetail }) {
  return (
    <Card title="Detalles">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
        <dt className="text-bark">Fecha</dt>
        <dd>
          <time dateTime={meeting.startsAt}>{formatMeetingDay(meeting.startsAt)}</time>
        </dd>
        <dt className="text-bark">Hora</dt>
        <dd>{formatMeetingTime(meeting.startsAt)}</dd>
        {meeting.book && (
          <>
            <dt className="text-bark">Libro</dt>
            <dd className="break-words">
              <Link to={`/biblioteca/${encodeURIComponent(meeting.book.id)}`} className={linkClass}>
                {meeting.book.title}
              </Link>
            </dd>
          </>
        )}
        {meeting.assignment && (
          <>
            <dt className="text-bark">Lectura</dt>
            <dd>
              <MeetingReading assignment={meeting.assignment} />
            </dd>
          </>
        )}
      </dl>
    </Card>
  )
}

// Read-only; recording attendance is in Administración (#70).
function Attendance({ attendance }: { attendance: MemberSummary[] | null }) {
  return (
    <Card title="Asistencia">
      {attendance === null ? (
        <EmptyState>Todavía no se ha anotado quién vino a esta reunión.</EmptyState>
      ) : attendance.length === 0 ? (
        <EmptyState>No se anotó ninguna asistencia en esta reunión.</EmptyState>
      ) : (
        <ul className="grid gap-2">
          {attendance.map((member) => (
            <li key={member.id} className="flex min-w-0 items-center gap-3">
              <Avatar member={member} size={32} />
              <span className="break-words">{member.displayName}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function Record({ record, assignment }: { record: MeetingRecord; assignment: MeetingAssignment | null }) {
  if (record.status === 'lockedWeekNotRead') {
    // The page range comes from the meeting's own assignment.
    const pages = assignment ? ` (${formatPageRange(assignment.pageStart, assignment.pageEnd)})` : ''
    return (
      <LockedRecord>
        Para evitar spoilers, el resumen y los momentos destacados aparecerán cuando marques como leída la semana{' '}
        {record.weekNumber}
        {pages}.
      </LockedRecord>
    )
  }
  if (record.status === 'lockedNoWeek') {
    return <LockedRecord>El resumen de esta reunión aún no se ha compartido con el club.</LockedRecord>
  }
  return (
    <>
      <Summary summary={record.summary} />
      <Highlights highlights={record.highlights} />
    </>
  )
}

// A calm note, not an alert: nothing is wrong, the content is just not open yet.
function LockedRecord({ children }: { children: ReactNode }) {
  return (
    <Card title="Resumen y momentos destacados">
      <p className="max-w-prose">{children}</p>
    </Card>
  )
}

// Plain text: React escapes it, so markup in a summary is shown, not rendered.
function Summary({ summary }: { summary: string | null }) {
  const paragraphs = (summary ?? '')
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  return (
    <Card title="Resumen">
      {paragraphs.length === 0 ? (
        <EmptyState>Todavía no hay un resumen de esta reunión.</EmptyState>
      ) : (
        <div className="grid max-w-prose gap-3">
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="break-words">
              {paragraph}
            </p>
          ))}
        </div>
      )}
    </Card>
  )
}

function Highlights({ highlights }: { highlights: MeetingHighlight[] }) {
  return (
    <Card title="Momentos destacados">
      {highlights.length === 0 ? (
        <EmptyState>Todavía no hay momentos destacados de esta reunión.</EmptyState>
      ) : (
        <ol className="grid gap-4">
          {highlights.map((highlight) => (
            <li key={highlight.id} className="min-w-0">
              {highlight.kind === 'quote' ? (
                <blockquote className="border-l-4 border-soft-green pl-3 font-serif text-lg break-words text-forest">
                  <p>«{highlight.text}»</p>
                </blockquote>
              ) : (
                <p className="break-words">{highlight.text}</p>
              )}
              {highlight.speakers.length > 0 && (
                <p className="mt-1 text-sm break-words text-bark">
                  — {formatAuthors(highlight.speakers.map((speaker) => speaker.displayName))}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
