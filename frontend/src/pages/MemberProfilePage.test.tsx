import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createClubState, createEmptyState } from '../api/mock/fixtures'
import { createMockClient, type MockOptions } from '../api/mock/mockClient'
import { holdCalls, trackCalls } from '../test/clients'
import { expectNoClubContent } from '../test/expectations'
import { renderApp } from '../test/renderApp'

const BACK = '← Volver a Miembros'
const COMPARE = 'Compara vuestras valoraciones en Estadísticas'
const EDIT = 'Editar mi perfil'
const ACTIVE = [
  ['m1', 'Lucía'],
  ['m2', 'Mateo'],
  ['m3', 'Carmen'],
  ['m4', 'Pablo'],
  ['m5', 'Inés'],
  ['m6', 'Jordi'],
  ['m7', 'Elena'],
] as const

async function openProfile(memberId: string, options: MockOptions = {}) {
  const tracked = trackCalls(createMockClient(options))
  const rendered = renderApp({ path: `/miembros/${memberId}`, client: tracked.client })
  await screen.findByRole('link', { name: BACK })
  return { ...rendered, tracked, main: screen.getByRole('main') }
}

const region = (name: string) => screen.getByRole('region', { name })
const queryRegion = (name: string) => screen.queryByRole('region', { name })
const outline = (main: HTMLElement) => within(main).getAllByRole('heading').map((h) => [h.tagName, h.textContent])

function expectNoBrokenValues(main: HTMLElement) {
  expect(main.textContent).not.toMatch(/null|undefined|NaN|[Ss]emana 0/)
}

// No rating figure of any kind: no ratings heading, mean, score, stars or
// number formatted as a score (e.g. «4,4» or «3.8»).
function expectNoRatings(main: HTMLElement) {
  expect(main.textContent).not.toMatch(/Valoraciones|Media|\bnota\b|puntuaci|estrella|★|☆/)
  expect(main.textContent).not.toMatch(/\d[,.]\d/)
  expect(within(main).queryByRole('radio')).not.toBeInTheDocument()
  expect(within(main).queryByRole('slider')).not.toBeInTheDocument()
  expect(within(main).queryByRole('radiogroup')).not.toBeInTheDocument()
  expect(within(main).queryByRole('table')).not.toBeInTheDocument()
}

describe('Member profile', () => {
  it('shows Carmen’s full profile: bio paragraphs, quote, three favourites and this week', async () => {
    const { main, tracked } = await openProfile('m3')

    expect(outline(main)).toEqual([
      ['H1', 'Carmen'],
      ['H2', 'Sobre mí'],
      ['H2', 'Cita favorita'],
      ['H2', 'Esta semana'],
      ['H2', 'Libros favoritos'],
    ])
    const bio = within(region('Sobre mí')).getAllByRole('paragraph')
    expect(bio.map((p) => p.textContent)).toEqual([
      'Leo por las noches, con té y una lámpara pequeña.',
      'Me gustan las novelas largas y escribir <b>en negrita</b> no funciona aquí: <script>alert("hola")</script>',
    ])
    const quote = region('Cita favorita').querySelector('blockquote')!
    expect(quote).toHaveTextContent('Sea lo que sea de lo que estén hechas nuestras almas, la suya y la mía son iguales.')
    expect(quote.querySelector('p')!.textContent).toContain('almas,\nla suya')
    expect(quote.querySelector('p')).toHaveClass('whitespace-pre-line')
    expect(region('Esta semana')).toHaveTextContent('Semana 3: ✓ Leído')
    expect(tracked.clubDataCalls()).toEqual(['getMemberProfile'])
    expect(screen.getByRole('link', { name: 'Miembros' })).toHaveAttribute('aria-current', 'page')
    expectNoBrokenValues(main)
  })

  it('shows literal markup as text and creates no b or script element', async () => {
    const { main } = await openProfile('m3')

    expect(within(region('Sobre mí')).getByText(/<b>en negrita<\/b>/)).toBeInTheDocument()
    expect(main.querySelector('b')).toBeNull()
    expect(main.querySelector('script')).toBeNull()
  })

  it('lists the favourite books in order, each with its cover, title and authors, linking to the book', async () => {
    const { main } = await openProfile('m3')

    const links = within(region('Libros favoritos')).getAllByRole('link')
    expect(links.map((link) => [link.getAttribute('href'), link.textContent])).toEqual([
      ['/biblioteca/b2', 'Cumbres borrascosasEmily Brontë'],
      ['/biblioteca/b12', 'Fortunata y JacintaBenito Pérez Galdós'],
      ['/biblioteca/b14', 'El ingenioso hidalgo don Quijote de la ManchaMiguel de Cervantes'],
    ])
    expect(within(links[0]).getByRole('img', { name: 'Portada de «Cumbres borrascosas»' })).toBeInTheDocument()
    // No status or reading date.
    expect(region('Libros favoritos').textContent).not.toMatch(/Terminado|Archivado|Leyendo|20\d\d/)
    expectNoRatings(main)
  })

  it('shows Inés’s long bio and a calm empty state for her missing quote', async () => {
    const { main } = await openProfile('m5')

    const [bio] = within(region('Sobre mí')).getAllByRole('paragraph')
    expect(bio.textContent!.length).toBeGreaterThanOrEqual(400)
    expect(bio).toHaveClass('break-words')
    expect(region('Cita favorita')).toHaveTextContent('Todavía no hay una cita favorita.')
    expect(region('Cita favorita').querySelector('blockquote')).toBeNull()
    expect(region('Esta semana')).toHaveTextContent('Semana 3: Leyendo')
    expectNoBrokenValues(main)
  })

  it('shows Pablo’s empty profile with an empty state in every section', async () => {
    const { main } = await openProfile('m4')

    expect(region('Sobre mí')).toHaveTextContent('Todavía no hay nada escrito aquí.')
    expect(region('Cita favorita')).toHaveTextContent('Todavía no hay una cita favorita.')
    expect(region('Libros favoritos')).toHaveTextContent('Todavía no hay libros favoritos.')
    expect(main.querySelector('blockquote')).toBeNull()
    expect(within(region('Libros favoritos')).queryByRole('list')).not.toBeInTheDocument()
    expectNoBrokenValues(main)
  })

  it('treats a blank bio or quote as empty', async () => {
    const state = createClubState()
    state.profiles.m3.bio = '  \n  '
    state.profiles.m3.favouriteQuote = ' '
    await openProfile('m3', { state })

    expect(region('Sobre mí')).toHaveTextContent('Todavía no hay nada escrito aquí.')
    expect(region('Cita favorita')).toHaveTextContent('Todavía no hay una cita favorita.')
    expect(screen.getByRole('main').querySelector('blockquote')).toBeNull()
  })

  it('shows the larger initials avatar hidden from screen readers, and an image avatar with its alt text', async () => {
    const first = await openProfile('m3')
    const initials = first.main.querySelector('[aria-hidden="true"]')!
    expect(initials).toHaveTextContent('C')
    expect(initials).toHaveStyle({ width: '96px', height: '96px' })
    first.unmount()

    const state = createClubState()
    state.members.find((m) => m.id === 'm3')!.avatarUrl = '/avatars/carmen.png'
    const { main } = await openProfile('m3', { state })
    expect(within(main).getByRole('img', { name: 'Foto de Carmen' })).toHaveAttribute('src', '/avatars/carmen.png')
  })

  it('links another member’s profile to Estadísticas, and nothing else about tastes', async () => {
    const { main } = await openProfile('m3')

    expect(screen.getByRole('link', { name: COMPARE })).toHaveAttribute('href', '/estadisticas')
    expect(screen.queryByRole('link', { name: EDIT })).not.toBeInTheDocument()
    expect(main.textContent).not.toMatch(/Gustos|afín|compatib|diferencia/i)
  })

  it('links the viewer’s own profile to «Editar mi perfil», with no Estadísticas link', async () => {
    const user = userEvent.setup()
    const { router } = await openProfile('m1')

    expect(screen.getByRole('heading', { level: 1, name: 'Lucía' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: COMPARE })).not.toBeInTheDocument()
    expect(within(screen.getByRole('main')).queryByRole('link', { name: /Estadísticas/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: EDIT }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Mi perfil' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/mi-perfil')
  })

  it('shows the default member his own profile with the edit link', async () => {
    await openProfile('m2', { session: 'member' })

    expect(screen.getByRole('heading', { level: 1, name: 'Mateo' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: EDIT })).toHaveAttribute('href', '/mi-perfil')
  })

  it('has no «Esta semana» section when there is no current week', async () => {
    const state = createClubState()
    state.books.find((b) => b.id === 'b3')!.status = 'terminado'
    const { main } = await openProfile('m3', { state })

    expect(queryRegion('Esta semana')).not.toBeInTheDocument()
    expect(main.textContent).not.toMatch(/Semana|Leído|Leyendo/)
    expectNoBrokenValues(main)
  })

  it('shows the admin’s empty profile in the empty club', async () => {
    const { main } = await openProfile('m1', { state: createEmptyState() })

    expect(outline(main)).toEqual([
      ['H1', 'Lucía'],
      ['H2', 'Sobre mí'],
      ['H2', 'Cita favorita'],
      ['H2', 'Libros favoritos'],
    ])
    expectNoBrokenValues(main)
  })

  it.each([
    ['an unknown id', 'no-existe'],
    ['the revoked member', 'm8'],
  ])('shows the same not-found page for %s', async (_case, memberId) => {
    const { main } = await openProfile(memberId)

    expect(screen.getByRole('heading', { level: 1, name: 'No encontramos a este miembro' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: BACK })).toHaveAttribute('href', '/miembros')
    expect(screen.getByRole('link', { name: 'Miembros' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    expect(main).not.toHaveTextContent('Tomás')
    expect(main.textContent).toBe(
      'No encontramos a este miembroPuede que el enlace no esté bien o que este perfil ya no esté disponible.← Volver a Miembros',
    )
  })

  it('shows a loading message, and a retry that calls getMemberProfile again', async () => {
    const user = userEvent.setup()
    const tracked = trackCalls(createMockClient({ failures: { getMemberProfile: 1 } }))
    const held = holdCalls(tracked.client, 'getMemberProfile')
    renderApp({ path: '/miembros/m3', client: held.client })

    await screen.findByRole('navigation', { name: 'Principal' })
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')
    held.release()

    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Carmen' })).toBeInTheDocument()
    expect(tracked.clubDataCalls()).toEqual(['getMemberProfile', 'getMemberProfile'])
  })

  it('returns to the sign-in screen when getMemberProfile gets a 401', async () => {
    const state = createClubState()
    const held = holdCalls(createMockClient({ state }), 'getMemberProfile')
    renderApp({ path: '/miembros/m3', client: held.client })

    await screen.findByRole('navigation', { name: 'Principal' })
    state.session = 'anonymous'
    held.release()

    expect(await screen.findByRole('button', { name: 'Entrar con Discord' })).toBeInTheDocument()
    expectNoClubContent()
    expect(screen.queryByText('Carmen', { exact: false })).not.toBeInTheDocument()
  })

  it('reaches every link with Tab in reading order', async () => {
    const user = userEvent.setup()
    const { main } = await openProfile('m3')

    const links = within(main).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/miembros',
      '/estadisticas',
      '/biblioteca/b2',
      '/biblioteca/b12',
      '/biblioteca/b14',
    ])
    screen.getByRole('link', { name: 'Miembros' }).focus()
    // Past «Mi perfil», «Administración» and «Cerrar sesión».
    await user.tab()
    await user.tab()
    await user.tab()
    for (const link of links) {
      await user.tab()
      expect(link).toHaveFocus()
    }
  })

  it('opens a profile from Miembros and goes back', async () => {
    const user = userEvent.setup()
    const { router } = renderApp({ path: '/miembros' })

    await user.click(await screen.findByRole('link', { name: /Pablo/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Pablo' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/miembros/m4')
    await user.click(screen.getByRole('link', { name: BACK }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Miembros' })).toBeInTheDocument()
  })
})

describe('No ratings on profiles', () => {
  it('shows Carmen’s profile with no rating data to the member, who has not unlocked «Cumbres borrascosas», and to the admin', async () => {
    for (const session of ['member', 'admin'] as const) {
      const { main, unmount } = await openProfile('m3', { session })
      expect(within(region('Libros favoritos')).getByText('Cumbres borrascosas')).toBeInTheDocument()
      expectNoRatings(main)
      unmount()
    }
  })

  it.each((['admin', 'member'] as const).flatMap((session) => ACTIVE.map(([id, name]) => [session, name, id] as const)))(
    'shows no rating data to the %s on %s’s profile',
    async (session, name, id) => {
      const { main } = await openProfile(id, { session })
      expect(screen.getByRole('heading', { level: 1, name })).toBeInTheDocument()
      expectNoRatings(main)
    },
  )
})
