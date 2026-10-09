import { describe, expect, it } from 'vitest'
import { mockOptionsFromQuery } from './devOptions'

describe('mock options from the query string', () => {
  it('reads the session, sign-in result and demo flag', () => {
    expect(mockOptionsFromQuery('?mock-session=denied&mock-sign-in=admin&mock-demo=1')).toEqual({
      session: 'denied',
      signInResult: 'admin',
      demoSignInAvailable: true,
    })
  })

  it('keeps the defaults without parameters or with unknown values', () => {
    expect(mockOptionsFromQuery('')).toEqual({})
    expect(mockOptionsFromQuery('?mock-session=root&mock-sign-in=anonymous&mock-demo=yes')).toEqual({})
  })
})
