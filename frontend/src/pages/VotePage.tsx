import { useLayoutEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { useApiData } from '../api/hooks'
import type { Vote } from '../api/types'
import { LoadError, Loading } from '../components/Status'
import { TieBreakForm } from '../components/TieBreakForm'
import { VoteManagement } from '../components/VoteManagement'
import { VoteNotice, VoteView } from '../components/VoteView'
import { VOTE_CHANGED_MEANWHILE, VOTE_NO_LONGER_OPEN } from '../lib/votes'

const linkClass = 'text-moss underline underline-offset-4 hover:text-forest'

export function VotePage() {
  const { voteId = '' } = useParams()
  // A new id is a new page: start again from «Cargando…» instead of showing the previous vote.
  return <VotePageContent key={voteId} voteId={voteId} />
}

function VotePageContent({ voteId }: { voteId: string }) {
  const vote = useApiData((api) => api.getVote(voteId))

  if (vote.status === 'loading') return <Loading />
  if (vote.status === 'error') {
    if (vote.error instanceof ApiError && vote.error.status === 404) return <VoteNotFound />
    return <LoadError onRetry={vote.reload} />
  }
  return <VoteScreen loaded={vote.data} reload={vote.reload} />
}

// The vote as last returned by the server: from the page's load, the user's
// approvals or a management change (#91). The controls come only from the
// server's flags: `canManage` and `canRecordTieWinner`.
function VoteScreen({ loaded, reload }: { loaded: Vote; reload: () => void }) {
  const [source, setSource] = useState(loaded)
  const [vote, setVote] = useState(loaded)
  if (loaded !== source) {
    setSource(loaded)
    setVote(loaded)
  }
  const [notice, setNotice] = useState<string | null>(null)
  const noticeRef = useRef<HTMLDivElement>(null)
  // Bumped when the notice should take focus, because the control that was
  // used has gone (closing, a tie-break, or a refused change).
  const [focusNotice, setFocusNotice] = useState(0)
  useLayoutEffect(() => {
    if (focusNotice) noticeRef.current?.focus()
  }, [focusNotice])

  const showNotice = (message: string) => {
    setNotice(message)
    setFocusNotice((n) => n + 1)
  }
  const changedMeanwhile = () => {
    showNotice(VOTE_CHANGED_MEANWHILE)
    reload()
  }

  const outcome = vote.status === 'closed' ? vote.outcome : null
  const tiePending = outcome?.status === 'tiePending' ? outcome : null

  return (
    <div className="grid gap-6">
      <p>
        <BackToVotes />
      </p>
      <h1 className="text-3xl break-words text-forest sm:text-4xl">Votación de {vote.curator.displayName}</h1>
      <VoteNotice ref={noticeRef} message={notice} />
      <VoteView
        vote={vote}
        headingLevel={2}
        onVoteChange={setVote}
        onConflict={() => {
          setNotice(VOTE_NO_LONGER_OPEN)
          reload()
        }}
        afterOutcome={
          tiePending &&
          (vote.canRecordTieWinner ? (
            <TieBreakForm
              vote={vote}
              tiedBookIds={tiePending.tiedBookIds}
              onChanged={changedMeanwhile}
              onSaved={(saved) => {
                setVote(saved)
                const winner = saved.outcome?.status === 'winner' ? saved.outcome.winner.title : null
                showNotice(winner ? `Se ha guardado «${winner}» como libro elegido.` : 'Se ha guardado el libro elegido.')
              }}
            />
          ) : (
            vote.curatedByMe && (
              <p className="max-w-prose">Cuando lo acordéis, la administración registrará el libro elegido.</p>
            )
          ))
        }
      />
      {vote.canManage && (
        <VoteManagement
          vote={vote}
          onSaved={setVote}
          onChanged={changedMeanwhile}
          onClosed={(closed) => {
            setVote(closed)
            showNotice(closingMessage(closed))
          }}
        />
      )}
    </div>
  )
}

function closingMessage(vote: Vote): string {
  if (vote.outcome?.status === 'winner') return `Se ha cerrado la votación. Libro elegido: «${vote.outcome.winner.title}».`
  return 'Se ha cerrado la votación con un empate. El club decidirá qué libro se lee.'
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
