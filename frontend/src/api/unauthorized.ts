import { ApiError, SESSION_METHODS, type ApiClient } from './client'

// Wraps a client so that a 401 from any club-data call (session expired or
// member revoked, #7) calls `onUnauthorized` before the call rejects as usual.
export function withUnauthorizedHandler(client: ApiClient, onUnauthorized: () => void): ApiClient {
  return new Proxy(client, {
    get(target, property, receiver) {
      const value: unknown = Reflect.get(target, property, receiver)
      if (typeof value !== 'function' || SESSION_METHODS.includes(property as keyof ApiClient)) return value
      return (...args: unknown[]) =>
        (value as (...a: unknown[]) => Promise<unknown>).apply(target, args).catch((error: unknown) => {
          if (error instanceof ApiError && error.status === 401) onUnauthorized()
          throw error
        })
    },
  })
}
