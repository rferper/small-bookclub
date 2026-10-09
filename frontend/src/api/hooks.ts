import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ApiClient } from './client'
import { ApiContext } from './context'

export function useApi(): ApiClient {
  const client = useContext(ApiContext)
  if (!client) throw new Error('useApi must be used inside <ApiProvider>.')
  return client
}

export type Loadable<T> =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; data: T }

// Loads data through the API client and exposes a reload for after mutations.
export function useApiData<T>(load: (api: ApiClient) => Promise<T>): Loadable<T> & { reload: () => void } {
  const api = useApi()
  const [state, setState] = useState<Loadable<T>>({ status: 'loading' })
  const [version, setVersion] = useState(0)
  // Pages pass an inline function; keep the latest one without refetching on every render.
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    let cancelled = false
    loadRef.current(api).then(
      (data) => !cancelled && setState({ status: 'ready', data }),
      (error: Error) => !cancelled && setState({ status: 'error', error }),
    )
    return () => {
      cancelled = true
    }
  }, [api, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { ...state, reload }
}
