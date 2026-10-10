import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ApiClient } from '../api/client'
import type { CriterionScores } from '../api/types'
import { createClubState, createEmptyState } from '../api/mock/fixtures'
import { createMockClient, type MockOptions } from '../api/mock/mockClient'
import { holdCalls, trackCalls } from '../test/clients'
import { renderApp } from '../test/renderApp'

const png = () => new File([new Uint8Array(16).fill(7)], 'cuadrado.png', { type: 'image/png' })
const flat = (score: number): CriterionScores => ({ disfrute: score, estilo: score, personajes: score, trama: score, huella: score })

async function openPage(options: MockOptions = {}, wrap: (client: ApiClient) => ApiClient = (c) => c) {
  const tracked = trackCalls(createMockClient(options))
  const rendered = renderApp({ path: '/mi-perfil', client: wrap(tracked.client) })
  await screen.findByRole('heading', { level: 1, name: 'Mi perfil' })
  return { ...rendered, tracked, main: screen.getByRole('main') }
}

const region = (name: string) => screen.getByRole('region', { name })
const outline = (main: HTMLElement) => within(main).getAllByRole('heading').map((h) => [h.tagName, h.textContent])
const reviewItems = () => within(region('Mis valoraciones')).getAllByRole('listitem')
const reviewTitles = () => reviewItems().map((item) => within(item).getByRole('heading', { level: 3 }).textContent)

describe('Mi perfil page', () => {
  it('has an h1, a link to the own profile, and two sections, each with its own call', async () => {
    const { main, tracked } = await openPage()
    await screen.findByLabelText('Nombre visible')
    await waitFor(() => expect(reviewItems()).toHaveLength(4))

    expect(screen.getByRole('link', { name: 'Ver mi perfil en Miembros' })).toHaveAttribute('href', '/miembros/m1')
    expect(screen.getByRole('link', { name: 'Mi perfil' })).toHaveAttribute('aria-current', 'page')
    expect(outline(main).filter(([tag]) => tag !== 'H3')).toEqual([
      ['H1', 'Mi perfil'],
      ['H2', 'Tu perfil'],
      ['H2', 'Mis valoraciones'],
    ])
    expect(outline(main).slice(3).every(([tag]) => tag === 'H3')).toBe(true)
    expect(tracked.clubDataCalls().sort()).toEqual(['getMyProfile', 'listMyReviews'])
    expect(screen.queryByText('Esta sección todavía se está preparando.')).not.toBeInTheDocument()
  })

  it('links the default member to his own profile', async () => {
    await openPage({ session: 'member' })
    expect(screen.getByRole('link', { name: 'Ver mi perfil en Miembros' })).toHaveAttribute('href', '/miembros/m2')
  })

  it('loads each section on its own: the reviews can be loading while the form is ready', async () => {
    let held: ReturnType<typeof holdCalls> | undefined
    await openPage({}, (client) => {
      held = holdCalls(client, 'listMyReviews')
      return held.client
    })
    await screen.findByLabelText('Nombre visible')
    expect(within(region('Mis valoraciones')).getByRole('status')).toHaveTextContent('Cargando…')
    held!.release()
    await waitFor(() => expect(reviewItems()).toHaveLength(4))
  })

  it('shows a profile error inside «Tu perfil» only; «Reintentar» repeats only that call', async () => {
    const user = userEvent.setup()
    const { tracked } = await openPage({ failures: { getMyProfile: 1 } })
    const alert = await within(region('Tu perfil')).findByRole('alert')
    expect(alert).toHaveTextContent('No se ha podido cargar tu perfil.')
    await waitFor(() => expect(reviewItems()).toHaveLength(4))

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByLabelText('Nombre visible')).toHaveValue('Lucía')
    expect(tracked.clubDataCalls().filter((m) => m === 'getMyProfile')).toHaveLength(2)
    expect(tracked.clubDataCalls().filter((m) => m === 'listMyReviews')).toHaveLength(1)
    expect(reviewItems()).toHaveLength(4)
  })

  it('shows a reviews error inside «Mis valoraciones» only; «Reintentar» repeats only that call', async () => {
    const user = userEvent.setup()
    const { tracked } = await openPage({ failures: { listMyReviews: 1 } })
    const alert = await within(region('Mis valoraciones')).findByRole('alert')
    expect(alert).toHaveTextContent('No se han podido cargar tus valoraciones.')
    expect(await screen.findByLabelText('Nombre visible')).toBeInTheDocument()

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(reviewItems()).toHaveLength(4))
    expect(tracked.clubDataCalls().filter((m) => m === 'listMyReviews')).toHaveLength(2)
    expect(tracked.clubDataCalls().filter((m) => m === 'getMyProfile')).toHaveLength(1)
  })

  it('goes to the sign-in screen when a section’s call gets a 401', async () => {
    const state = createClubState()
    let held: ReturnType<typeof holdCalls> | undefined
    renderApp({
      path: '/mi-perfil',
      client: (() => {
        held = holdCalls(createMockClient({ state }), 'getMyProfile')
        return held.client
      })(),
    })
    await screen.findByRole('heading', { level: 1, name: 'Mi perfil' })
    state.session = 'anonymous'
    held!.release()
    expect(await screen.findByRole('button', { name: 'Entrar con Discord' })).toBeInTheDocument()
  })
})

describe('Mis valoraciones', () => {
  it('lists the default admin’s four reviews, newest first, with her own data only', async () => {
    await openPage()
    await waitFor(() => expect(reviewItems()).toHaveLength(4))
    expect(reviewTitles()).toEqual([
      'El ingenioso hidalgo don Quijote de la Mancha',
      'El sí de las niñas',
      'Fortunata y Jacinta',
      'Cumbres borrascosas',
    ])

    const cumbres = reviewItems()[3]
    expect(within(cumbres).getByRole('link', { name: /Cumbres borrascosas$/ })).toHaveAttribute('href', '/biblioteca/b2')
    expect(within(cumbres).getByRole('img', { name: 'Portada de «Cumbres borrascosas»' })).toBeInTheDocument()
    expect(within(cumbres).getByText('Tu media: 3,8 / 5')).toBeInTheDocument()
    expect(within(cumbres).getByText('Disfrute 5 · Estilo 4,5 · Personajes 3 · Trama 4 · Huella 2,5')).toBeInTheDocument()
    expect(within(cumbres).getByText('Me atrapó desde el principio, aunque el final se me hizo largo.')).toBeInTheDocument()
    expect(cumbres).toHaveTextContent('Enviada el 2 de diciembre de 2024')
    expect(cumbres).not.toHaveTextContent('editada')
    expect(within(cumbres).getByRole('link', { name: 'Editar mi valoración de «Cumbres borrascosas»' })).toHaveAttribute(
      'href',
      '/biblioteca/b2/valorar',
    )

    // «Fortunata y Jacinta» has no text: no empty box and no "null".
    const fortunata = reviewItems()[2]
    expect(within(fortunata).getAllByRole('paragraph')).toHaveLength(4)
    expect(fortunata.textContent).not.toMatch(/null|undefined|NaN/)
  })

  it('shows nothing about other members or the club', async () => {
    const state = createClubState()
    await openPage({ state })
    await waitFor(() => expect(reviewItems()).toHaveLength(4))
    const section = region('Mis valoraciones')
    for (const member of state.members.filter((m) => m.id !== 'm1')) expect(section).not.toHaveTextContent(member.displayName)
    expect(section).not.toHaveTextContent(/Media del club|\bclub\b|n = \d|Media:/)
    expect(section.textContent).not.toContain('Heathcliff')
    expect(within(section).queryByRole('table')).not.toBeInTheDocument()
    expect(within(section).queryByRole('combobox')).not.toBeInTheDocument()
    expect(section.querySelector('svg')).toBeNull()
  })

  it('lists the default member’s two reviews', async () => {
    await openPage({ session: 'member' })
    await waitFor(() => expect(reviewItems()).toHaveLength(2))
    expect(reviewTitles()).toEqual([
      'El ingenioso hidalgo don Quijote de la Mancha',
      'Niebla',
    ])
  })

  it('shows a calm empty state with no nudge', async () => {
    await openPage({ state: createEmptyState() })
    const section = region('Mis valoraciones')
    expect(await within(section).findByText('Aquí aparecerán tus valoraciones de los libros del club.')).toBeInTheDocument()
    expect(within(section).queryByRole('list')).not.toBeInTheDocument()
    expect(section).not.toHaveTextContent(/todavía no has valorado/i)
  })

  it('shows an edited review first, with its new overall and «editada el …»', async () => {
    const user = userEvent.setup()
    const { router } = await openPage()
    await waitFor(() => expect(reviewItems()).toHaveLength(4))
    await user.click(screen.getByRole('link', { name: 'Editar mi valoración de «Cumbres borrascosas»' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Editar mi valoración de «Cumbres borrascosas»' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/biblioteca/b2/valorar')
    await user.click(within(screen.getByRole('group', { name: 'Huella' })).getByRole('radio', { name: '5 estrellas' }))
    await user.click(screen.getByRole('button', { name: 'Guardar valoración' }))
    expect(await screen.findByText('Tu valoración se ha guardado.')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Mi perfil' }))
    await waitFor(() => expect(reviewItems()).toHaveLength(4))
    const first = reviewItems()[0]
    expect(within(first).getByRole('heading', { level: 3 })).toHaveTextContent('Cumbres borrascosas')
    expect(within(first).getByText('Tu media: 4,3 / 5')).toBeInTheDocument()
    expect(first).toHaveTextContent('Enviada el 2 de diciembre de 2024 · editada el 9 de octubre de 2026')
  })

  it('shows a new rating first', async () => {
    const client = createMockClient()
    await client.setBookFinished('b6', true)
    await client.saveMyReview('b6', { scores: flat(3), text: 'Primera línea.\nSegunda línea.' })
    renderApp({ path: '/mi-perfil', client })
    await waitFor(() => expect(reviewItems()).toHaveLength(5))
    const first = reviewItems()[0]
    expect(within(first).getByRole('heading', { level: 3 })).toHaveTextContent('Ángel Guerra')
    expect(within(first).getByText('Tu media: 3,0 / 5')).toBeInTheDocument()
    expect(within(first).getByText(/Primera línea\./).textContent).toBe('Primera línea.\nSegunda línea.')
    expect(first).toHaveTextContent('Enviada el 9 de octubre de 2026')
  })
})

describe('After saving, the new values show everywhere without a reload', () => {
  it('shows the new name, avatar, bio, quote and favourites on Miembros, the profile and Inicio', async () => {
    const user = userEvent.setup()
    await openPage()
    await screen.findByLabelText('Nombre visible')
    await user.clear(screen.getByLabelText('Nombre visible'))
    await user.type(screen.getByLabelText('Nombre visible'), 'Zoe')
    fireEvent.change(screen.getByLabelText('Sobre mí'), { target: { value: 'Leo de todo.\nSobre todo, clásicos.' } })
    fireEvent.change(screen.getByLabelText('Cita favorita'), { target: { value: 'Una cita nueva.' } })
    await user.click(screen.getByRole('button', { name: 'Bajar «Niebla»' }))
    await user.upload(screen.getByLabelText('Elegir una foto'), png())
    await screen.findByRole('img', { name: 'Vista previa de tu nueva foto' })
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Tu perfil se ha guardado.')).toBeInTheDocument()
    const src = screen.getByRole('img', { name: 'Foto de Zoe' }).getAttribute('src')

    // Miembros: the new name in its alphabetical place, with «(tú)».
    await user.click(screen.getByRole('link', { name: 'Miembros' }))
    await screen.findByRole('heading', { level: 1, name: 'Miembros' })
    const names = within(screen.getByRole('main'))
      .getAllByRole('listitem')
      .map((item) => item.querySelector('span.text-lg')!.textContent)
    expect(names).toEqual(['Carmen', 'Elena', 'Inés', 'Jordi', 'Mateo', 'Pablo', 'Zoe (tú)'])
    expect(screen.getByRole('img', { name: 'Foto de Zoe' })).toHaveAttribute('src', src)

    // The own profile.
    await user.click(screen.getByRole('link', { name: /Zoe/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Zoe' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Foto de Zoe' })).toHaveAttribute('src', src)
    const bio = within(region('Sobre mí')).getAllByRole('paragraph').map((p) => p.textContent)
    expect(bio).toEqual(['Leo de todo.', 'Sobre todo, clásicos.'])
    expect(region('Cita favorita')).toHaveTextContent('«Una cita nueva.»')
    expect(within(region('Libros favoritos')).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      '/biblioteca/b2',
      '/biblioteca/b1',
    ])

    // Inicio's «Cómo va el club esta semana».
    await user.click(screen.getByRole('link', { name: 'Inicio' }))
    const progress = await screen.findByRole('region', { name: 'Cómo va el club esta semana' })
    expect(within(progress).getByText('Zoe')).toBeInTheDocument()
    expect(within(progress).getByRole('img', { name: 'Foto de Zoe' })).toHaveAttribute('src', src)
    expect(progress).not.toHaveTextContent('Lucía')

    // «Valoraciones» on «Cumbres borrascosas»: the comparison names her.
    await user.click(screen.getByRole('link', { name: 'Biblioteca' }))
    await user.click(await screen.findByRole('link', { name: /Cumbres borrascosas/ }))
    const member = await screen.findByLabelText('Miembro')
    expect(within(member).getByRole('option', { selected: true })).toHaveTextContent('Zoe (tú)')
  })

  it('saves and shows markup literally as plain text, creating no element', async () => {
    const user = userEvent.setup()
    const { container } = await openPage()
    await screen.findByLabelText('Nombre visible')
    const name = '<b>Lu</b>'
    const bio = '<script>alert("hola")</script>\n<b>negrita</b>'
    const quote = 'Una <b>cita</b>\nen dos líneas'
    fireEvent.change(screen.getByLabelText('Nombre visible'), { target: { value: name } })
    fireEvent.change(screen.getByLabelText('Sobre mí'), { target: { value: bio } })
    fireEvent.change(screen.getByLabelText('Cita favorita'), { target: { value: quote } })
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Tu perfil se ha guardado.')).toBeInTheDocument()

    expect(screen.getByLabelText('Nombre visible')).toHaveValue(name)
    expect(screen.getByLabelText('Sobre mí')).toHaveValue(bio)
    expect(screen.getByLabelText('Cita favorita')).toHaveValue(quote)
    expect(container.querySelector('main b, main script')).toBeNull()

    await user.click(screen.getByRole('link', { name: 'Miembros' }))
    expect(await screen.findByText(`${name} (tú)`)).toBeInTheDocument()
    expect(container.querySelector('main b, main script')).toBeNull()

    await user.click(screen.getByRole('link', { name: /Lu<\/b>/ }))
    expect(await screen.findByRole('heading', { level: 1, name })).toBeInTheDocument()
    expect(within(region('Sobre mí')).getAllByRole('paragraph').map((p) => p.textContent)).toEqual([
      '<script>alert("hola")</script>',
      '<b>negrita</b>',
    ])
    expect(region('Cita favorita').querySelector('p')!.textContent).toBe('«Una <b>cita</b>\nen dos líneas»')
    expect(container.querySelector('main b, main script')).toBeNull()
  })
})
