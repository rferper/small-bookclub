import type { MockOptions, MockSession } from './mockClient'

const SESSIONS: readonly MockSession[] = ['anonymous', 'member', 'admin', 'denied']

const isSession = (value: string | null): value is MockSession => SESSIONS.includes(value as MockSession)

// Reads the mock's starting state from the page's query string, so a
// developer can open any session in `npm run dev` without editing code:
// ?mock-session=anonymous|member|admin|denied  starting session
// ?mock-sign-in=member|admin|denied            where «Entrar con Discord» leads
// ?mock-demo=1                                 offer the demo sign-in (#75)
// Unknown values are ignored and the default applies.
export function mockOptionsFromQuery(search: string): MockOptions {
  const params = new URLSearchParams(search)
  const options: MockOptions = {}
  const session = params.get('mock-session')
  if (isSession(session)) options.session = session
  const signIn = params.get('mock-sign-in')
  if (isSession(signIn) && signIn !== 'anonymous') options.signInResult = signIn
  if (params.get('mock-demo') === '1') options.demoSignInAvailable = true
  return options
}
