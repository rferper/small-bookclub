import { useState } from 'react'
import { Link } from 'react-router'
import { useApiData } from '../api/hooks'
import type { MemberSummary, VoteHistoryItem, VotesOverview } from '../api/types'
import { Avatar } from '../components/Avatar'
import { Card, EmptyState } from '../components/Card'
import { LoadError, Loading } from '../components/Status'
import { ConflictNotice, VoteView } from '../components/VoteView'
import { formatLongDate } from '../lib/format'
import { votePath } from '../lib/votes'

// The curator, the current vote in full and every earlier vote, in the
// order the server returns them.
export function VotesPage() {
  const votes = useApiData((api) => api.getVotes())
  const [conflict, setConflict] = useState(false)

  return (
    <div className="grid gap-6">
      <h1 className="text-3xl text-forest sm:text-4xl">Votaciones</h1>
      {votes.status === 'loading' && <Loading />}
      {votes.status === 'error' && <LoadError onRetry={votes.reload} />}
      {votes.status === 'ready' && (
        <VotesContent
          votes={votes.data}
          conflict={conflict}
          onConflict={() => {
            setConflict(true)
            votes.reload()
          }}
        />
      )}
    </div>
  )
}

function VotesContent({
  votes,
  conflict,
  onConflict,
}: {
  votes: VotesOverview
  conflict: boolean
  onConflict: () => void
}) {
  return (
    <>
      <Curator curator={votes.curator} />
      <ConflictNotice shown={conflict} />
      <Card title="Votación actual">
        {votes.current ? (
          <div className="grid gap-4">
            <p className="font-serif text-xl break-words">
              <Link to={votePath(votes.current.id)} className="text-moss underline underline-offset-4 hover:text-forest">
                Votación de {votes.current.curator.displayName}
              </Link>
            </p>
            <VoteView vote={votes.current} headingLevel={3} onConflict={onConflict} />
          </div>
        ) : (
          <EmptyState>Ahora mismo no hay ninguna votación abierta.</EmptyState>
        )}
      </Card>
      <Card title="Votaciones anteriores">
        {votes.history.length === 0 ? (
          <EmptyState>Todavía no hay votaciones anteriores. Cuando se cierre la primera, aparecerá aquí.</EmptyState>
        ) : (
          <ol className="grid gap-3">
            {votes.history.map((item) => (
              <HistoryItem key={item.id} item={item} />
            ))}
          </ol>
        )}
      </Card>
    </>
  )
}

function Curator({ curator }: { curator: MemberSummary | null }) {
  if (!curator) {
    return <EmptyState>Todavía no se ha elegido a nadie para proponer los próximos libros.</EmptyState>
  }
  return (
    <p className="flex min-w-0 items-center gap-3 text-lg">
      <Avatar member={curator} />
      <span className="break-words">
        Curaduría actual: <span className="font-semibold text-forest">{curator.displayName}</span>
      </span>
    </p>
  )
}

// One link per vote, so each is a single Tab stop named by its curator and date.
function HistoryItem({ item }: { item: VoteHistoryItem }) {
  const { outcome } = item
  return (
    <li className="min-w-0">
      <Link
        to={votePath(item.id)}
        className="group block rounded-lg border border-wood/30 p-3 hover:bg-sage/30"
      >
        <span className="block font-serif text-lg break-words text-moss underline underline-offset-4 group-hover:text-forest">
          Votación de {item.curator.displayName}
        </span>
        <span className="block text-bark">
          Cerrada el <time dateTime={item.closedAt}>{formatLongDate(item.closedAt)}</time>
        </span>
        <span className="block break-words text-forest">
          {outcome.status === 'winner' ? `Libro elegido: «${outcome.winner.title}»` : 'Empate pendiente de decidir'}
        </span>
      </Link>
    </li>
  )
}
