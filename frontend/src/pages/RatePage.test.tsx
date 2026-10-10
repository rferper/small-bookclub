import { screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ApiError, type ApiClient } from '../api/client'
import { applyRubricExample, createClubState } from '../api/mock/fixtures'
import { createMockClient, type MockOptions } from '../api/mock/mockClient'
import { holdCalls, trackCalls } from '../test/clients'
import { expectNoClubContent } from '../test/expectations'
import { renderApp } from '../test/renderApp'

const CRITERIA = ['Disfrute', 'Estilo', 'Personajes', 'Trama', 'Huella']
const VALUE_NAMES = [
  '1 estrella',
  '1,5 estrellas',
  '2 estrellas',
  '2,5 estrellas',
  '3 estrellas',
  '3,5 estrellas',
  '4 estrellas',
  '4,5 estrellas',
  '5 estrellas',
]

async function openForm(bookId: string, options: MockOptions = {}, wrap: (client: ApiClient) => ApiClient = (c) => c) {
  const tracked = trackCalls(createMockClient(options))
  const rendered = renderApp({ path: `/biblioteca/${bookId}/valorar`, client: wrap(tracked.client) })
  await screen.findByRole('heading', { level: 1 })
  return { ...rendered, tracked }
}

const group = (name: string) => screen.getByRole('group', { name })
const radio = (criterion: string, value: string) => within(group(criterion)).getByRole('radio', { name: value })
const saveButton = () => screen.getByRole('button', { name: /Guardar valoración|Guardando…/ })

async function rate(user: UserEvent, values: Record<string, string>) {
  for (const [criterion, value] of Object.entries(values)) await user.click(radio(criterion, value))
}

const EXAMPLE = {
  Disfrute: '5 estrellas',
  Estilo: '4,5 estrellas',
  Personajes: '3 estrellas',
  Trama: '4 estrellas',
  Huella: '2,5 estrellas',
}

// Rejects saveMyReview with the given status, as a server that refuses the
// review would; every other call goes to the mock.
function refusingSave(status: number) {
  return (client: ApiClient): ApiClient => ({
    ...client,
    getBookRatings: (id) => client.getBookRatings(id),
    getRatingRubric: () => client.getRatingRubric(),
    getSession: () => client.getSession(),
    saveMyReview: () => Promise.reject(new ApiError(status, 'Rechazado.')),
  })
}

describe('rating form', () => {
  it('rates a new book with five groups of nine half-star values and nothing preselected', async () => {
    await openForm('b1')

    expect(screen.getByRole('heading', { level: 1, name: 'Valorar «Niebla»' })).toBeInTheDocument()
    expect(screen.getAllByRole('group').map((g) => g.querySelector('legend')?.textContent)).toEqual(CRITERIA)
    for (const criterion of CRITERIA) {
      const radios = within(group(criterion)).getAllByRole('radio')
      expect(radios).toHaveLength(9)
      radios.forEach((r, i) => expect(r).toHaveAccessibleName(VALUE_NAMES[i]))
      for (const value of VALUE_NAMES) expect(radio(criterion, value)).not.toBeChecked()
      expect(group(criterion)).toHaveTextContent('Sin puntuar')
    }
    expect(screen.queryByRole('radio', { name: /^0/ })).not.toBeInTheDocument()
    expect(group('Estilo')).toHaveTextContent('Prosa y estilo')
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/biblioteca/b1')
    expect(screen.getByRole('link', { name: 'Biblioteca' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('textbox', { name: 'Reseña (opcional)' })).toHaveValue('')
  })

  it('preselects the saved scores and text when editing, and shows no one else’s data', async () => {
    const { tracked } = await openForm('b2')

    expect(
      screen.getByRole('heading', { level: 1, name: 'Editar mi valoración de «Cumbres borrascosas»' }),
    ).toBeInTheDocument()
    for (const [criterion, value] of Object.entries(EXAMPLE)) expect(radio(criterion, value)).toBeChecked()
    expect(group('Estilo')).toHaveTextContent('4,5 de 5')
    expect(screen.getByRole('textbox', { name: 'Reseña (opcional)' })).toHaveValue(
      'Me atrapó desde el principio, aunque el final se me hizo largo.',
    )
    expect(screen.getByRole('status')).toHaveTextContent('Tu media: 3,8 / 5')
    expect(screen.getByRole('main').textContent).not.toMatch(/Carmen|Inés|Jordi|Heathcliff|Media del club|4,1/)
    expect(tracked.clubDataCalls().sort()).toEqual(['getBookRatings', 'getRatingRubric'])
  })

  it('moves the selection by half a star with the arrow keys, and Tab reaches each criterion once', async () => {
    const user = userEvent.setup()
    await openForm('b1')

    await user.click(radio('Disfrute', '3 estrellas'))
    await user.keyboard('{ArrowRight}')
    expect(radio('Disfrute', '3,5 estrellas')).toBeChecked()
    expect(radio('Disfrute', '3,5 estrellas')).toHaveFocus()
    expect(group('Disfrute')).toHaveTextContent('3,5 de 5')
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(radio('Disfrute', '2,5 estrellas')).toBeChecked()
    await user.keyboard('{ArrowUp}')
    expect(radio('Disfrute', '2 estrellas')).toBeChecked()
    await user.keyboard('{ArrowDown}')
    expect(radio('Disfrute', '2,5 estrellas')).toBeChecked()

    // One Tab stop per criterion, then the review text.
    for (const criterion of CRITERIA.slice(1)) {
      await user.tab()
      expect(group(criterion)).toContainElement(document.activeElement as HTMLElement)
    }
    await user.tab()
    expect(screen.getByRole('textbox', { name: 'Reseña (opcional)' })).toHaveFocus()
  })

  it('picks half and whole values with the left and right halves of each star', async () => {
    const user = userEvent.setup()
    await openForm('b1')
    const halves = (criterion: string, value: number) =>
      group(criterion).querySelectorAll<HTMLElement>(`[data-star-value="${value}"]`)

    await user.click(halves('Trama', 3.5)[0])
    expect(radio('Trama', '3,5 estrellas')).toBeChecked()
    expect(group('Trama')).toHaveTextContent('3,5 de 5')
    await user.click(halves('Trama', 4)[0])
    expect(radio('Trama', '4 estrellas')).toBeChecked()
    // The first star's left half gives 1, as there is no 0.5.
    expect(halves('Trama', 1)).toHaveLength(2)
    await user.click(halves('Trama', 1)[0])
    expect(radio('Trama', '1 estrella')).toBeChecked()
    expect(group('Trama')).toHaveTextContent('1 de 5')
  })

  it('shows the live overall mean only once all five are chosen', async () => {
    const user = userEvent.setup()
    await openForm('b1')
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Elige las cinco puntuaciones para ver tu media.')

    await rate(user, { Disfrute: '5 estrellas', Estilo: '4,5 estrellas', Personajes: '3 estrellas', Trama: '4 estrellas' })
    expect(status).toHaveTextContent('Elige las cinco puntuaciones para ver tu media.')
    expect(status).not.toHaveTextContent(/\d/)

    await rate(user, { Huella: '2,5 estrellas' })
    expect(status).toHaveTextContent('Tu media: 3,8 / 5')
    await rate(user, { Huella: '5 estrellas' })
    expect(status).toHaveTextContent('Tu media: 4,3 / 5')
  })

  it('names the missing criteria, marks them invalid and moves focus to the first, without calling the API', async () => {
    const user = userEvent.setup()
    const { tracked } = await openForm('b1')
    await rate(user, { Disfrute: '5 estrellas', Estilo: '4 estrellas', Personajes: '3 estrellas' })

    await user.click(saveButton())

    expect(screen.getByRole('alert')).toHaveTextContent('Falta puntuar: Trama y Huella.')
    for (const criterion of ['Trama', 'Huella']) {
      expect(group(criterion)).toHaveAttribute('aria-invalid', 'true')
      expect(group(criterion)).toHaveAccessibleDescription(`Elige una puntuación para ${criterion}.`)
    }
    expect(group('Disfrute')).not.toHaveAttribute('aria-invalid')
    expect(group('Trama')).toContainElement(document.activeElement as HTMLElement)
    expect(tracked.clubDataCalls()).not.toContain('saveMyReview')

    await user.click(radio('Trama', '2 estrellas'))
    expect(group('Trama')).not.toHaveAttribute('aria-invalid')
    expect(group('Trama')).not.toHaveTextContent('Elige una puntuación')
    expect(screen.getByRole('alert')).toHaveTextContent('Falta puntuar: Huella.')
    await user.click(radio('Huella', '2 estrellas'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('limits the review to 5000 characters', async () => {
    const user = userEvent.setup()
    await openForm('b1')
    const text = screen.getByRole('textbox', { name: 'Reseña (opcional)' })
    expect(text).toHaveAccessibleDescription(/Hasta 5000 caracteres/)
    expect(text).toHaveAttribute('maxlength', '5000')

    await user.click(text)
    await user.paste('a'.repeat(5010))
    expect((text as HTMLTextAreaElement).value).toHaveLength(5000)
  })

  it('shows no rubric text with the default fixtures', async () => {
    const user = userEvent.setup()
    await openForm('b1')
    await rate(user, EXAMPLE)
    await rate(user, { Trama: '3,5 estrellas' })
    const main = screen.getByRole('main')
    expect(main).not.toHaveTextContent('Texto de ejemplo')
    expect(main).not.toHaveTextContent(/estrellas?:/)
    expect(main).not.toHaveTextContent(/Sin descripción/)
  })

  it('shows the rubric anchors around the chosen value, only where they exist', async () => {
    const user = userEvent.setup()
    await openForm('b1', { state: applyRubricExample(createClubState()) })
    const anchors = (criterion: string) =>
      within(group(criterion))
        .queryAllByRole('listitem')
        .map((li) => li.textContent)

    expect(anchors('Trama')).toEqual([])
    await rate(user, { Trama: '3 estrellas' })
    expect(anchors('Trama')).toEqual(['3 estrellas: [Texto de ejemplo] Trama, 3 estrellas'])
    await rate(user, { Trama: '3,5 estrellas' })
    expect(anchors('Trama')).toEqual([
      '3 estrellas: [Texto de ejemplo] Trama, 3 estrellas',
      '4 estrellas: [Texto de ejemplo] Trama, 4 estrellas',
    ])
    // Partly: only the 4-star anchor exists around 4,5.
    await rate(user, { Trama: '4,5 estrellas' })
    expect(anchors('Trama')).toEqual(['4 estrellas: [Texto de ejemplo] Trama, 4 estrellas'])
    await rate(user, { Trama: '5 estrellas', Personajes: '3 estrellas' })
    expect(anchors('Trama')).toEqual([])
    expect(anchors('Personajes')).toEqual([])
  })

  it('saves a new rating and returns to the unlocked section with focus on its heading', async () => {
    const user = userEvent.setup()
    const { router } = await openForm('b1')
    await rate(user, EXAMPLE)
    await user.type(screen.getByRole('textbox', { name: 'Reseña (opcional)' }), 'Un libro que discute conmigo.')

    await user.click(saveButton())

    expect(await screen.findByText('Tu valoración se ha guardado.')).toHaveAttribute('role', 'status')
    expect(router.state.location.pathname).toBe('/biblioteca/b1')
    const heading = screen.getByRole('heading', { level: 2, name: 'Valoraciones' })
    await waitFor(() => expect(heading).toHaveFocus())
    const region = screen.getByRole('region', { name: 'Valoraciones' })
    expect(region).toHaveTextContent('Tu media: 3,8 / 5')
    expect(region).toHaveTextContent('Un libro que discute conmigo.')
    expect(region).toHaveTextContent('4 valoraciones')
  })

  it('updates the user’s overall and the club’s means after an edit, with the same n', async () => {
    const user = userEvent.setup()
    await openForm('b2')
    await rate(user, { Disfrute: '5 estrellas', Estilo: '5 estrellas', Personajes: '5 estrellas', Trama: '5 estrellas', Huella: '5 estrellas' })

    await user.click(saveButton())

    const region = await screen.findByRole('region', { name: 'Valoraciones' })
    await within(region).findByText('Tu valoración se ha guardado.')
    expect(region).toHaveTextContent('Tu media: 5,0 / 5')
    expect(region).toHaveTextContent('Media del club: 4,4 / 5')
    expect(region).toHaveTextContent('4 valoraciones')
    const rows = within(within(region).getByRole('table'))
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.textContent)
    expect(rows).toEqual(['Disfrute4,0', 'Estilo4,4', 'Personajes4,6', 'Trama4,3', 'Huella4,5'])
  })

  it('disables the button and says «Guardando…» while saving', async () => {
    const user = userEvent.setup()
    let held: ReturnType<typeof holdCalls> | undefined
    await openForm('b2', {}, (client) => {
      held = holdCalls(client, 'saveMyReview')
      return held.client
    })

    await user.click(saveButton())
    expect(saveButton()).toBeDisabled()
    expect(saveButton()).toHaveTextContent('Guardando…')
    held!.release()
    expect(await screen.findByText('Tu valoración se ha guardado.')).toBeInTheDocument()
  })

  it('keeps the values and text with an alert when saving fails', async () => {
    const user = userEvent.setup()
    const { router } = await openForm('b1', { failures: { saveMyReview: 1 } })
    await rate(user, EXAMPLE)
    await user.type(screen.getByRole('textbox', { name: 'Reseña (opcional)' }), 'Primera idea.')

    await user.click(saveButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido guardar tu valoración. Inténtalo de nuevo.')
    for (const [criterion, value] of Object.entries(EXAMPLE)) expect(radio(criterion, value)).toBeChecked()
    expect(screen.getByRole('textbox', { name: 'Reseña (opcional)' })).toHaveValue('Primera idea.')
    expect(saveButton()).toBeEnabled()
    expect(router.state.location.pathname).toBe('/biblioteca/b1/valorar')

    await user.click(saveButton())
    expect(await screen.findByText('Tu valoración se ha guardado.')).toBeInTheDocument()
  })

  it('explains a 409 calmly, with a link back to the book', async () => {
    const user = userEvent.setup()
    const state = createClubState()
    await openForm('b1', { state })
    await rate(user, EXAMPLE)
    // Meanwhile the book stops being ready to rate.
    state.finished.b1 = state.finished.b1.filter((id) => id !== 'm1')

    await user.click(saveButton())

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'No se ha podido guardar tu valoración porque el libro ya no está listo para valorarse.',
    )
    expect(within(alert).getByRole('link', { name: 'Volver al libro' })).toHaveAttribute('href', '/biblioteca/b1')
    expect(radio('Huella', '2,5 estrellas')).toBeChecked()
    expect(state.reviews.some((r) => r.bookId === 'b1' && r.userId === 'm1')).toBe(false)
  })

  it('says a score is not valid on a 400', async () => {
    const user = userEvent.setup()
    await openForm('b1', {}, refusingSave(400))
    await rate(user, EXAMPLE)

    await user.click(saveButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('Alguna puntuación no es válida.')
    expect(saveButton()).toBeEnabled()
  })

  it('returns to the sign-in screen on a 401 while saving', async () => {
    const user = userEvent.setup()
    const state = createClubState()
    let held: ReturnType<typeof holdCalls> | undefined
    await openForm('b1', { state }, (client) => {
      held = holdCalls(client, 'saveMyReview')
      return held.client
    })
    await rate(user, EXAMPLE)

    await user.click(saveButton())
    state.session = 'anonymous'
    held!.release()

    expect(await screen.findByRole('button', { name: 'Entrar con Discord' })).toBeInTheDocument()
    expectNoClubContent()
  })
})

describe('rating form: other states', () => {
  it('asks to mark the book finished first, with no form', async () => {
    await openForm('b3')
    expect(screen.getByRole('heading', { level: 1, name: 'Valorar «La Regenta»' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('primero márcalo como terminado')
    expect(screen.getByRole('link', { name: 'Ir a la ficha del libro' })).toHaveAttribute('href', '/biblioteca/b3')
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar valoración' })).not.toBeInTheDocument()
  })

  it('says a book that is not ratable cannot be rated, with no form', async () => {
    await openForm('b5')
    expect(screen.getByRole('main')).toHaveTextContent(
      'El club todavía no ha leído este libro, así que aún no se puede valorar.',
    )
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a la ficha del libro' })).toHaveAttribute('href', '/biblioteca/b5')
  })

  it('shows the not-found page for an unknown book', async () => {
    await openForm('no-existe')
    expect(screen.getByRole('heading', { level: 1, name: 'No encontramos este libro' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← Volver a la biblioteca' })).toHaveAttribute('href', '/biblioteca')
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })

  it('shows «Cargando…», and a retry that reloads both calls', async () => {
    const user = userEvent.setup()
    const tracked = trackCalls(createMockClient({ failures: { getRatingRubric: 1 } }))
    const held = holdCalls(tracked.client, 'getRatingRubric')
    renderApp({ path: '/biblioteca/b1/valorar', client: held.client })

    await screen.findByRole('navigation', { name: 'Principal' })
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')
    held.release()

    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Valorar «Niebla»' })).toBeInTheDocument()
    expect(tracked.clubDataCalls().sort()).toEqual(['getBookRatings', 'getBookRatings', 'getRatingRubric', 'getRatingRubric'])
  })

  it('returns to the sign-in screen when loading gets a 401', async () => {
    const state = createClubState()
    const held = holdCalls(createMockClient({ state }), 'getBookRatings')
    renderApp({ path: '/biblioteca/b1/valorar', client: held.client })

    await screen.findByRole('navigation', { name: 'Principal' })
    state.session = 'anonymous'
    held.release()

    expect(await screen.findByRole('button', { name: 'Entrar con Discord' })).toBeInTheDocument()
    expectNoClubContent()
  })

  it('takes «Ángel Guerra» from unrated to n = 1, with no weekly plan or meetings', async () => {
    const user = userEvent.setup()
    const { router } = renderApp({ path: '/biblioteca/b6' })
    const region = await screen.findByRole('region', { name: 'Valoraciones' })
    expect(screen.getByRole('region', { name: 'Plan de lectura' })).toHaveTextContent('no tiene un plan de lectura')

    await user.click(await within(region).findByRole('checkbox', { name: 'He terminado el libro' }))
    await user.click(await within(region).findByRole('link', { name: 'Valorar el libro' }))
    await screen.findByRole('heading', { level: 1, name: 'Valorar «Ángel Guerra»' })
    await rate(user, { Disfrute: '4 estrellas', Estilo: '3,5 estrellas', Personajes: '5 estrellas', Trama: '2 estrellas', Huella: '4,5 estrellas' })
    await user.click(saveButton())

    const unlocked = await screen.findByRole('region', { name: 'Valoraciones' })
    await within(unlocked).findByText('Tu valoración se ha guardado.')
    expect(router.state.location.pathname).toBe('/biblioteca/b6')
    expect(unlocked).toHaveTextContent('Media del club: 3,8 / 5')
    expect(unlocked).toHaveTextContent('1 valoración')
    expect(unlocked).toHaveTextContent('Por ahora solo está tu valoración.')
    const rows = within(within(unlocked).getByRole('table'))
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.textContent)
    expect(rows).toEqual(['Disfrute4,0', 'Estilo3,5', 'Personajes5,0', 'Trama2,0', 'Huella4,5'])
  })
})
