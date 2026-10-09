import { SESSION_METHODS, type ApiClient } from '../api/client'

type Method = keyof ApiClient

// Test-only wrapper that records every method called on `client`, so tests
// can check that no club data was requested.
export function trackCalls(client: ApiClient): { client: ApiClient; calls: Method[]; clubDataCalls: () => Method[] } {
  const calls: Method[] = []
  const tracked = new Proxy(client, {
    get(target, property, receiver) {
      const value: unknown = Reflect.get(target, property, receiver)
      if (typeof value !== 'function') return value
      return (...args: unknown[]) => {
        calls.push(property as Method)
        return (value as (...a: unknown[]) => unknown).apply(target, args)
      }
    },
  })
  return { client: tracked, calls, clubDataCalls: () => calls.filter((method) => !SESSION_METHODS.includes(method)) }
}

// Test-only wrapper that makes `method` wait until `release()` is called
// before running the real call, to inspect in-flight states.
export function holdCalls(client: ApiClient, method: Method): { client: ApiClient; release: () => void } {
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const held = new Proxy(client, {
    get(target, property, receiver) {
      const value: unknown = Reflect.get(target, property, receiver)
      if (property !== method || typeof value !== 'function') return value
      return (...args: unknown[]) => gate.then(() => (value as (...a: unknown[]) => unknown).apply(target, args))
    },
  })
  return { client: held, release: () => release() }
}
