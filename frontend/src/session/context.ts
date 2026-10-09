import { createContext } from 'react'
import type { ApiClient } from '../api/client'
import type { Session } from '../api/types'

export interface SessionContextValue {
  // The current session, or null while it is loading or failed to load.
  session: Session | null
  // True after this visit signed out, until the next sign-in.
  signedOut: boolean
  // True when the current screen replaced another one during this visit, so
  // it should take keyboard focus (the first screen keeps the browser default).
  focusOnMount: boolean
  // Runs a sign-in call, then loads the new session. Rejects if the call fails.
  signIn: (start: (api: ApiClient) => Promise<void>) => Promise<void>
  // Signs out, then loads the new session. Rejects if signing out fails.
  signOut: () => Promise<void>
}

export const SessionContext = createContext<SessionContextValue | null>(null)
