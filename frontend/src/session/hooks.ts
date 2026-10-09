import { useContext, useLayoutEffect, useState, type RefObject } from 'react'
import { SessionContext, type SessionContextValue } from './context'

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside <SessionGate>.')
  return value
}

// Moves keyboard focus to `ref` once, when a screen replaces another one.
// A layout effect, so focus moves in the same commit that shows the screen
// (a passive effect could run after code that already sees the new screen).
export function useFocusOnMount(ref: RefObject<HTMLElement | null>) {
  const { focusOnMount } = useSession()
  const [shouldFocus] = useState(focusOnMount)
  useLayoutEffect(() => {
    if (shouldFocus) ref.current?.focus()
  }, [ref, shouldFocus])
}
