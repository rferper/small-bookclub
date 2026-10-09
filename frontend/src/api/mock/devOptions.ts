import { applyVoteScenario, createClubState, createEmptyState, type VoteScenario } from './fixtures'
import type { MockOptions, MockSession } from './mockClient'

const SESSIONS: readonly MockSession[] = ['anonymous', 'member', 'admin', 'curator', 'denied']
const VOTE_SCENARIOS: readonly VoteScenario[] = ['draft', 'tie', 'none']

const isSession = (value: string | null): value is MockSession => SESSIONS.includes(value as MockSession)

// Reads the mock's starting state from the page's query string, so a
// developer can open any session in `npm run dev` without editing code:
// ?mock-session=anonymous|member|admin|curator|denied  starting session
// ?mock-sign-in=member|admin|curator|denied            where «Entrar con Discord» leads
// ?mock-demo=1                                         offer the demo sign-in (#75)
// ?mock-data=empty                                     a new club with no books (#64)
// ?mock-vote=draft|tie|none                            change the current vote (#66);
//                                                      ignored with ?mock-data=empty
// Unknown values are ignored and the default applies.
export function mockOptionsFromQuery(search: string): MockOptions {
  const params = new URLSearchParams(search)
  const options: MockOptions = {}
  const session = params.get('mock-session')
  if (isSession(session)) options.session = session
  const signIn = params.get('mock-sign-in')
  if (isSession(signIn) && signIn !== 'anonymous') options.signInResult = signIn
  if (params.get('mock-demo') === '1') options.demoSignInAvailable = true
  const vote = params.get('mock-vote') as VoteScenario | null
  if (params.get('mock-data') === 'empty') options.state = createEmptyState()
  else if (vote && VOTE_SCENARIOS.includes(vote)) options.state = applyVoteScenario(createClubState(), vote)
  return options
}
