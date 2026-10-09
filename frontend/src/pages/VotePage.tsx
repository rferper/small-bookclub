import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { useApiData } from '../api/hooks'
import { LoadError, Loading } from '../components/Status'
import { ConflictNotice, VoteView } from '../components/VoteView'

const linkClass = 'text-moss underline underline-offset-4 hover:text-forest'

export function VotePage() {
  const { voteId = '' } = useParams()
  // A new id is a new page: start again from «Cargando…» instead of showing the previous vote.
  return <VotePageContent key={voteId} voteId={voteId} />
}

function VotePageContent({ voteId }: { voteId: string }) {
  const vote = useApiData((api) => api.getVote(voteId))
  const [conflict, setConflict] = useState(false)

  if (vote.status === 'loading') return <Loading />
  if (vote.status === 'error') {
    if (vote.error instanceof ApiError && vote.error.status === 404) return <VoteNotFound />
    return <LoadError onRetry={vote.reload} />
  }

  return (
    <div className="grid gap-6">
      <p>
        <BackToVotes />
      </p>
      <h1 className="text-3xl break-words text-forest sm:text-4xl">Votación de {vote.data.curator.displayName}</h1>
      <ConflictNotice shown={conflict} />
      <VoteView
        vote={vote.data}
        headingLevel={2}
        onConflict={() => {
          setConflict(true)
          vote.reload()
        }}
      />
    </div>
  )
}

function BackToVotes() {
  return (
    <Link to="/votaciones" className={linkClass}>
      ← Volver a Votaciones
    </Link>
  )
}

function VoteNotFound() {
  return (
    <section className="rounded-xl border border-wood/30 bg-paper p-6">
      <h1 className="text-3xl text-forest">No encontramos esta votación</h1>
      <p className="mt-2 text-bark">Puede que el enlace no esté bien o que esta votación no exista en el club.</p>
      <p className="mt-3">
        <BackToVotes />
      </p>
    </section>
  )
}
