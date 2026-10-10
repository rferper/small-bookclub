import { Link } from 'react-router'
import { useApiData } from '../api/hooks'
import type { MemberDirectoryEntry } from '../api/types'
import { Avatar } from '../components/Avatar'
import { EmptyState } from '../components/Card'
import { LoadError, Loading } from '../components/Status'
import { formatWeekStatus } from '../lib/format'

export function MembersPage() {
  // Only this call: the server lists active members and decides each status.
  const directory = useApiData((api) => api.listMembers())

  if (directory.status === 'loading') return <Loading />
  if (directory.status === 'error') return <LoadError onRetry={directory.reload} />

  const { currentWeekNumber, members } = directory.data
  const onlyMe = members.every((entry) => entry.isMe)
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl text-forest sm:text-4xl">Miembros</h1>
        {currentWeekNumber !== null && (
          <p className="mt-2 text-bark">Lectura de esta semana: semana {currentWeekNumber}</p>
        )}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((entry) => (
          <MemberItem key={entry.member.id} entry={entry} />
        ))}
      </ul>
      {onlyMe && <EmptyState>Todavía no hay más miembros en el club.</EmptyState>}
    </div>
  )
}

function MemberItem({ entry }: { entry: MemberDirectoryEntry }) {
  const { member, isMe, completedCurrentWeek } = entry
  return (
    <li className="min-w-0">
      <Link
        to={`/miembros/${encodeURIComponent(member.id)}`}
        className="flex h-full min-w-0 items-center gap-3 rounded-xl border border-wood/30 bg-paper p-4 shadow-sm hover:bg-sage/30"
      >
        <span className="shrink-0">
          <Avatar member={member} size={48} />
        </span>
        <span className="min-w-0">
          <span className="block font-serif text-lg break-words text-forest">
            {member.displayName}
            {isMe && ' (tú)'}
          </span>
          {completedCurrentWeek !== null && (
            <span className={`block text-sm ${completedCurrentWeek ? 'text-moss' : 'text-bark'}`}>
              {formatWeekStatus(completedCurrentWeek)}
            </span>
          )}
        </span>
      </Link>
    </li>
  )
}
