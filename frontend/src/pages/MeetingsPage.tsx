import { Link } from 'react-router'
import { useApiData } from '../api/hooks'
import type { MeetingList, MeetingListItem } from '../api/types'
import { Card, EmptyState } from '../components/Card'
import { MeetingReading } from '../components/MeetingReading'
import { LoadError, Loading } from '../components/Status'
import { formatMeetingDateWithYear } from '../lib/format'

const meetingPath = (id: string) => `/reuniones/${encodeURIComponent(id)}`

// Upcoming and past meetings, in the order and split the server returns:
// the frontend never compares dates with the browser clock.
export function MeetingsPage() {
  const meetings = useApiData((api) => api.listMeetings())

  return (
    <div className="grid gap-6">
      <h1 className="text-3xl text-forest sm:text-4xl">Reuniones</h1>
      {meetings.status === 'loading' && <Loading />}
      {meetings.status === 'error' && <LoadError onRetry={meetings.reload} />}
      {meetings.status === 'ready' && <MeetingsContent meetings={meetings.data} />}
    </div>
  )
}

function MeetingsContent({ meetings }: { meetings: MeetingList }) {
  if (meetings.upcoming.length === 0 && meetings.past.length === 0) {
    return (
      <EmptyState>
        Todavía no hay reuniones en el calendario del club. Cuando se programe la primera, aparecerá aquí.
      </EmptyState>
    )
  }
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <Card title="Próximas reuniones">
        {meetings.upcoming.length === 0 ? (
          <EmptyState>Por ahora no hay ninguna reunión programada.</EmptyState>
        ) : (
          <MeetingItems meetings={meetings.upcoming} />
        )}
      </Card>
      <Card title="Reuniones anteriores">
        {meetings.past.length === 0 ? (
          <EmptyState>Todavía no se ha celebrado ninguna reunión. Después de la primera, la verás aquí.</EmptyState>
        ) : (
          <MeetingItems meetings={meetings.past} />
        )}
      </Card>
    </div>
  )
}

function MeetingItems({ meetings }: { meetings: MeetingListItem[] }) {
  return (
    <ol className="grid gap-3">
      {meetings.map((meeting) => (
        <li key={meeting.id} className="min-w-0 border-b border-wood/20 pb-3 last:border-b-0 last:pb-0">
          <p className="flex flex-wrap items-baseline gap-x-3">
            <Link
              to={meetingPath(meeting.id)}
              className="font-semibold text-moss underline underline-offset-4 hover:text-forest"
            >
              <time dateTime={meeting.startsAt}>{formatMeetingDateWithYear(meeting.startsAt)}</time>
            </Link>
            {meeting.cancelled && <span className="font-semibold text-bark">Cancelada</span>}
          </p>
          {meeting.book && <p className="font-serif text-lg break-words text-forest">{meeting.book.title}</p>}
          {meeting.assignment && (
            <p className="text-forest">
              <MeetingReading assignment={meeting.assignment} />
            </p>
          )}
        </li>
      ))}
    </ol>
  )
}
