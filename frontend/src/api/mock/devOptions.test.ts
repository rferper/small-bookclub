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

  it('can start with an empty club', () => {
    const options = mockOptionsFromQuery('?mock-data=empty')
    expect(options.state?.books).toEqual([])
    expect(mockOptionsFromQuery('?mock-data=lleno')).toEqual({})
  })

  it('keeps the defaults without parameters or with unknown values', () => {
    expect(mockOptionsFromQuery('')).toEqual({})
    expect(mockOptionsFromQuery('?mock-session=root&mock-sign-in=anonymous&mock-demo=yes')).toEqual({})
    expect(mockOptionsFromQuery('?mock-vote=cerrada')).toEqual({})
  })

  it('can start as the curator', () => {
    expect(mockOptionsFromQuery('?mock-session=curator&mock-sign-in=curator')).toEqual({
      session: 'curator',
      signInResult: 'curator',
    })
  })

  it('can change the current vote of the default club', () => {
    const status = (search: string) => mockOptionsFromQuery(search).state?.votes.find((v) => v.id === 'v2')?.status
    expect(status('?mock-vote=draft')).toBe('draft')
    expect(status('?mock-vote=tie')).toBe('closed')
    const none = mockOptionsFromQuery('?mock-vote=none').state
    expect(none?.votes.map((v) => v.id)).toEqual(['v1', 'v0'])
    expect(none?.curatorId).toBe('m6')
    // The empty club has no votes to change.
    const empty = mockOptionsFromQuery('?mock-data=empty&mock-vote=draft').state
    expect(empty).toMatchObject({ votes: [], curatorId: null, books: [] })
  })

  it('can fill the rubric with placeholders (#67)', () => {
    const rubric = mockOptionsFromQuery('?mock-rubric=ejemplo').state?.rubric
    expect(rubric?.trama[3]).toBe('[Texto de ejemplo] Trama, 3 estrellas')
    expect(rubric?.personajes[3]).toBeNull()
    // It combines with the other options.
    const combined = mockOptionsFromQuery('?mock-rubric=ejemplo&mock-vote=draft&mock-session=member')
    expect(combined.state?.rubric.estilo[2]).toBe('[Texto de ejemplo] Estilo, 2 estrellas')
    expect(combined.state?.votes.find((v) => v.id === 'v2')?.status).toBe('draft')
    expect(combined.session).toBe('member')
    expect(mockOptionsFromQuery('?mock-data=empty&mock-rubric=ejemplo').state).toMatchObject({ books: [] })
    // Without it, or with an unknown value, every anchor stays empty.
    expect(mockOptionsFromQuery('?mock-rubric=real')).toEqual({})
    expect(mockOptionsFromQuery('?mock-vote=draft').state?.rubric.trama[3]).toBeNull()
  })

  it('can keep Jordi’s vote open with a tie at the top (#91)', () => {
    const options = mockOptionsFromQuery('?mock-vote=open-tie&mock-session=curator')
    const vote = options.state?.votes.find((v) => v.id === 'v2')
    expect(vote?.status).toBe('open')
    expect(vote?.candidates.map((c) => c.approverIds.length)).toEqual([5, 5, 0, 1])
    expect(options.session).toBe('curator')
    expect(mockOptionsFromQuery('?mock-data=empty&mock-vote=open-tie').state?.votes).toEqual([])
  })
})
