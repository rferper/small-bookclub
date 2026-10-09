import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router'
import { ApiProvider } from '../api/ApiContext'
import { useApi } from '../api/hooks'
import type { Session } from '../api/types'
import { withUnauthorizedHandler } from '../api/unauthorized'
import { Loading } from '../components/Status'
import { AccessDeniedPage } from '../pages/AccessDeniedPage'
import { SessionErrorPage } from '../pages/SessionErrorPage'
import { SignInPage } from '../pages/SignInPage'
import { SessionContext, type SessionContextValue } from './context'

type GateState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; session: Session }

// Shows the requested page only to a signed-in member; everyone else gets the
// sign-in or access-denied screen at the same URL.
//
// This gating is cosmetic: it keeps the UI honest, but the backend must refuse
// every club-data request from anonymous, denied or revoked users (#4, #5, #7).
export function SessionGate() {
  const api = useApi()
  const [state, setState] = useState<GateState>({ status: 'loading' })
  // How many times a session result (or failure) has been shown this visit.
  const [results, setResults] = useState(0)
  const [signedOut, setSignedOut] = useState(false)
  // Bumped to ask the backend again who is signed in.
  const [request, setRequest] = useState(0)

  useEffect(() => {
    let cancelled = false
    const show = (next: GateState) => {
      if (cancelled) return
      setState(next)
      setResults((n) => n + 1)
    }
    api.getSession().then(
      (session) => show({ status: 'ready', session }),
      () => show({ status: 'error' }),
    )
    return () => {
      cancelled = true
    }
  }, [api, request])

  // Hides the current screen at once (so no stale club data or generic error
  // stays visible) and loads the session again.
  const reloadSession = useCallback(() => {
    setState({ status: 'loading' })
    setRequest((n) => n + 1)
  }, [])

  // Club pages get a client that returns to the gate on any 401.
  const shellApi = useMemo(() => withUnauthorizedHandler(api, reloadSession), [api, reloadSession])

  const value = useMemo<SessionContextValue>(
    () => ({
      session: state.status === 'ready' ? state.session : null,
      signedOut,
      focusOnMount: results > 1,
      signIn: async (start) => {
        await start(api)
        setSignedOut(false)
        reloadSession()
      },
      signOut: async () => {
        await api.signOut()
        setSignedOut(true)
        reloadSession()
      },
    }),
    [api, reloadSession, results, signedOut, state],
  )

  let screen
  if (state.status === 'loading') {
    screen = (
      <div className="mx-auto max-w-md px-4 py-10">
        <Loading />
      </div>
    )
  } else if (state.status === 'error') {
    screen = <SessionErrorPage onRetry={reloadSession} />
  } else if (state.session.status === 'anonymous') {
    screen = <SignInPage />
  } else if (state.session.status === 'denied') {
    screen = <AccessDeniedPage />
  } else {
    screen = (
      <ApiProvider client={shellApi}>
        <Outlet />
      </ApiProvider>
    )
  }

  return <SessionContext.Provider value={value}>{screen}</SessionContext.Provider>
}
