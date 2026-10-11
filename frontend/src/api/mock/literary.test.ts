import { describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../client'
import type { LiteraryQuoteInput, RatingRubric } from '../types'
import { withUnauthorizedHandler } from '../unauthorized'
import { createClubState, createEmptyState, emptyRubric } from './fixtures'
import { createMockClient, type MockSession } from './mockClient'

const input = (patch: Partial<LiteraryQuoteInput> = {}): LiteraryQuoteInput => ({ text: '  Cita ficticia\ncon <b>texto</b>  ', author: '  Ada  ', source: '  ', active: true, ...patch })
const calls = [
  (api: ApiClient) => api.listAdminQuotes(),
  (api: ApiClient) => api.addLiteraryQuote(input()),
  (api: ApiClient) => api.updateLiteraryQuote('missing', input()),
  (api: ApiClient) => api.saveRatingRubric(emptyRubric()),
]

describe('literary administration authorization and failures', () => {
  it.each(['anonymous', 'denied', 'member', 'curator'] as MockSession[])('refuses all admin calls before lookup/validation as %s', async (session) => {
    const state = createClubState(), api = createMockClient({ state, session }), before = JSON.stringify(state)
    for (const call of calls) await expect(call(api)).rejects.toMatchObject({ status: ['anonymous', 'denied'].includes(session) ? 401 : 403 })
    expect(JSON.stringify(state)).toBe(before)
    if (['member', 'curator'].includes(session)) expect(await api.getRatingRubric()).toEqual(emptyRubric())
  })
  it('all new methods notify unauthorized and configured failures precede role checks', async () => {
    const unauthorized = vi.fn(), api = withUnauthorizedHandler(createMockClient({ session: 'anonymous' }), unauthorized)
    for (const call of calls) await expect(call(api)).rejects.toMatchObject({ status: 401 })
    expect(unauthorized).toHaveBeenCalledTimes(4)
    const state = createClubState(), failed = createMockClient({ state, session: 'curator', failures: { listAdminQuotes: 1, addLiteraryQuote: 1, updateLiteraryQuote: 1, saveRatingRubric: 1 } }), before = JSON.stringify(state)
    for (const call of calls) await expect(call(failed)).rejects.toMatchObject({ status: 500 })
    expect(JSON.stringify(state)).toBe(before)
  })
  it('failed admin mutations keep all stored text unchanged', async () => {
    const state = createClubState(), api = createMockClient({ state, failures: { addLiteraryQuote: 1, updateLiteraryQuote: 1, saveRatingRubric: 1 } }), before = JSON.stringify(state)
    await expect(api.addLiteraryQuote(input())).rejects.toMatchObject({ status: 500 })
    await expect(api.updateLiteraryQuote('quote-1', input())).rejects.toMatchObject({ status: 500 })
    await expect(api.saveRatingRubric(emptyRubric())).rejects.toMatchObject({ status: 500 })
    expect(JSON.stringify(state)).toBe(before)
  })
})

describe('quote validation and member projection', () => {
  it.each([{ text: '' }, { text: '  ' }, { text: 'x'.repeat(1001) }, { author: 'x'.repeat(201) }, { source: 'x'.repeat(201) }, { active: 'true' }, { text: 1 }, { author: 2 }, { source: false }])('rejects malformed quote without mutation: %j', async (patch) => {
    const state = createClubState(), api = createMockClient({ state }), before = JSON.stringify(state)
    await expect(api.addLiteraryQuote(input(patch as Partial<LiteraryQuoteInput>))).rejects.toMatchObject({ status: 400 })
    await expect(api.updateLiteraryQuote('quote-1', input(patch as Partial<LiteraryQuoteInput>))).rejects.toMatchObject({ status: 400 })
    expect(JSON.stringify(state)).toBe(before)
  })
  it('accepts trimmed boundaries and blank attribution; edits preserve id/order and response copies', async () => {
    const api = createMockClient({ state: createEmptyState() })
    const first = await api.addLiteraryQuote(input({ text: ' x ', author: ' ', source: null }))
    const second = await api.addLiteraryQuote(input({ text: ` ${'y'.repeat(1000)} `, author: 'a'.repeat(200), source: 's'.repeat(200) }))
    expect(first).toMatchObject({ text: 'x', author: null, source: null })
    expect(second.id).not.toBe(first.id)
    await api.updateLiteraryQuote(first.id, input())
    const quotes = await api.listAdminQuotes()
    expect(quotes.map((quote) => quote.id)).toEqual([first.id, second.id])
    expect(quotes[0]).toMatchObject({ text: 'Cita ficticia\ncon <b>texto</b>', author: 'Ada', source: null })
    quotes[0].text = 'tampered'
    expect((await api.listAdminQuotes())[0].text).not.toBe('tampered')
  })
  it('normalizes duplicate whitespace/Spanish case regardless of attribution/activity and permits self edit', async () => {
    const state = createEmptyState(), api = createMockClient({ state })
    const first = await api.addLiteraryQuote(input({ text: ' ÁRBOL\n  leído ', active: false }))
    const second = await api.addLiteraryQuote(input({ text: 'Otro' }))
    await api.updateLiteraryQuote(first.id, input({ text: 'árbol leído' }))
    const before = JSON.stringify(state)
    await expect(api.addLiteraryQuote(input({ text: 'Árbol   leído', author: null }))).rejects.toMatchObject({ status: 409 })
    await expect(api.updateLiteraryQuote(second.id, input({ text: ' ÁRBOL\tLEÍDO ', active: false }))).rejects.toMatchObject({ status: 409 })
    await expect(api.updateLiteraryQuote('missing', input({ text: '' }))).rejects.toMatchObject({ status: 404 })
    expect(JSON.stringify(state)).toBe(before)
  })
  it('selects only active quotes afresh and exposes only text/author/source; none active means null', async () => {
    const state = createClubState(), api = createMockClient({ state, random: () => 0.99 })
    expect((await api.getHome()).quote?.source).toBe('Francisco de Quevedo')
    await api.updateLiteraryQuote('quote-2', { ...state.quotes[1], active: false })
    const home = await api.getHome()
    expect(home.quote).toEqual({ text: state.quotes[0].text, author: null, source: state.quotes[0].source })
    expect(JSON.stringify(home)).not.toContain(state.quotes[1].text)
    await api.updateLiteraryQuote('quote-1', { ...state.quotes[0], active: false })
    expect((await api.getHome()).quote).toBeNull()
  })
})

describe('whole rubric atomic validation', () => {
  it('keeps fixtures null; normalizes every anchor and returns independent saved descriptions only', async () => {
    const state = createClubState(), api = createMockClient({ state }), rubric = emptyRubric()
    expect(state.rubric).toEqual(rubric)
    rubric.disfrute[1] = '  <b>Prueba ficticia</b>\nliteral  '
    rubric.estilo[5] = ' x'.repeat(250).trim()
    rubric.huella[3] = '  '
    const saved = await api.saveRatingRubric(rubric)
    expect(saved.disfrute[1]).toBe('<b>Prueba ficticia</b>\nliteral')
    expect(saved.huella[3]).toBeNull()
    saved.disfrute[1] = 'tampered'
    expect((await api.getRatingRubric()).disfrute[1]).not.toBe('tampered')
    expect(JSON.stringify(await api.getRatingRubric())).not.toMatch(/reviews|scores|member/)
  })
  it.each(['missing criterion', 'extra criterion', 'missing anchor', 'extra anchor', 'long', 'number', 'undefined'])('refuses %s atomically, preserving all 25 anchors', async (kind) => {
    const state = createClubState(), api = createMockClient({ state }), rubric = emptyRubric()
    rubric.disfrute[1] = 'Valid change that must not be saved'
    const raw = rubric as unknown as Record<string, Record<string, unknown>>
    if (kind === 'missing criterion') delete raw.estilo
    if (kind === 'extra criterion') raw.extra = raw.estilo
    if (kind === 'missing anchor') delete raw.huella['5']
    if (kind === 'extra anchor') raw.huella['2.5'] = 'Extra'
    if (kind === 'long') raw.huella['5'] = 'x'.repeat(501)
    if (kind === 'number') raw.huella['5'] = 3
    if (kind === 'undefined') raw.huella['5'] = undefined
    await expect(api.saveRatingRubric(raw as unknown as RatingRubric)).rejects.toMatchObject({ status: 400 })
    expect(state.rubric).toEqual(emptyRubric())
  })
})
