import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createClubState } from '../api/mock/fixtures'
import { createMockClient, type MockOptions } from '../api/mock/mockClient'
import type { ApiClient } from '../api/client'
import { holdCalls, trackCalls } from '../test/clients'
import { expectNoClubContent } from '../test/expectations'
import { renderApp } from '../test/renderApp'

const ratingsRegion = () => screen.getByRole('region', { name: 'Valoraciones' })

// Opens a book page and waits until «Valoraciones» has loaded.
async function openRatings(bookId: string, options: MockOptions = {}, wrap: (client: ApiClient) => ApiClient = (c) => c) {
  const tracked = trackCalls(createMockClient(options))
  const { unmount } = renderApp({ path: `/biblioteca/${bookId}`, client: wrap(tracked.client) })
  await screen.findByRole('heading', { level: 1 })
  await waitFor(() => expect(within(ratingsRegion()).queryByText('Cargando…')).not.toBeInTheDocument())
  return { tracked, unmount, region: ratingsRegion() }
}

const OTHER_NAMES = /Lucía|Mateo|Carmen|Pablo|Inés|Jordi|Elena/
// A zero score («0/5», but not «4,0 / 5») or a broken value.
const NEVER_SHOWN = /(^|[^,\d])0 ?\/ ?5|NaN|null|undefined|Infinity/

function expectNothingGated(region: HTMLElement) {
  expect(region.textContent).not.toMatch(/\d|★|[Mm]edia/)
  expect(region.textContent).not.toMatch(OTHER_NAMES)
  expect(within(region).queryByRole('table')).not.toBeInTheDocument()
  expect(within(region).queryByRole('img')).not.toBeInTheDocument()
}

describe('«Valoraciones» on the book page', () => {
  it.each([
    ['b4', 'Pepita Jiménez'],
    ['b5', 'Los pazos de Ulloa'],
  ])('says a book that is not ratable (%s) cannot be rated yet', async (bookId) => {
    const { region } = await openRatings(bookId)
    expect(region).toHaveTextContent('El club todavía no ha leído este libro, así que aún no se puede valorar.')
    expect(within(region).queryByRole('checkbox')).not.toBeInTheDocument()
    expect(within(region).queryByRole('link')).not.toBeInTheDocument()
    expect(region.textContent).not.toMatch(/\d/)
    expect(region.textContent).not.toMatch(OTHER_NAMES)
  })

  it('shows only the finished control and the rule while locked and not finished', async () => {
    const { region } = await openRatings('b3')
    const toggle = within(region).getByRole('checkbox', { name: 'He terminado el libro' })
    expect(toggle).not.toBeChecked()
    expect(region).toHaveTextContent(
      'Cuando hayas terminado el libro y enviado tu valoración, podrás ver las valoraciones del resto del club.',
    )
    expect(within(region).queryByRole('link')).not.toBeInTheDocument()
    expectNothingGated(region)
  })

  it('looks exactly the same for a book nobody rated and one others rated', async () => {
    const regenta = await openRatings('b3')
    const rated = regenta.region.innerHTML
    regenta.unmount()
    const angel = await openRatings('b6')
    expect(angel.region.innerHTML.replace(/_r_\w+_/g, '')).toBe(rated.replace(/_r_\w+_/g, ''))
  })

  it('offers the rating form once finished, and keeps everything else locked', async () => {
    const { region } = await openRatings('b1')
    expect(within(region).getByRole('checkbox', { name: 'He terminado el libro' })).toBeChecked()
    expect(within(region).getByRole('link', { name: 'Valorar el libro' })).toHaveAttribute('href', '/biblioteca/b1/valorar')
    expect(region).toHaveTextContent('podrás ver las valoraciones del resto del club')
    expectNothingGated(region)
  })

  it('marks the book finished with one call and shows the returned state', async () => {
    const user = userEvent.setup()
    const { region, tracked } = await openRatings('b3')

    await user.click(within(region).getByRole('checkbox', { name: 'He terminado el libro' }))

    expect(await within(region).findByRole('link', { name: 'Valorar el libro' })).toHaveAttribute(
      'href',
      '/biblioteca/b3/valorar',
    )
    expect(within(region).getByRole('checkbox', { name: 'He terminado el libro' })).toBeChecked()
    expect(tracked.clubDataCalls().filter((m) => m === 'setBookFinished')).toHaveLength(1)
    expectNothingGated(region)
  })

  it('can undo the finished flag while there is no review', async () => {
    const user = userEvent.setup()
    const { region } = await openRatings('b1')
    await user.click(within(region).getByRole('checkbox', { name: 'He terminado el libro' }))
    await waitFor(() => expect(within(region).queryByRole('link', { name: 'Valorar el libro' })).not.toBeInTheDocument())
    expect(within(region).getByRole('checkbox', { name: 'He terminado el libro' })).not.toBeChecked()
  })

  it('disables the control and shows the new state while saving', async () => {
    const user = userEvent.setup()
    let held: ReturnType<typeof holdCalls> | undefined
    const { region } = await openRatings('b3', {}, (client) => {
      held = holdCalls(client, 'setBookFinished')
      return held.client
    })

    await user.click(within(region).getByRole('checkbox', { name: 'He terminado el libro' }))
    const toggle = within(region).getByRole('checkbox', { name: 'He terminado el libro' })
    expect(toggle).toBeDisabled()
    expect(toggle).toBeChecked()

    held!.release()
    await waitFor(() => expect(within(region).getByRole('checkbox', { name: 'He terminado el libro' })).toBeEnabled())
    expect(within(region).getByRole('link', { name: 'Valorar el libro' })).toBeInTheDocument()
  })

  it('shows a calm message and reloads after a 409', async () => {
    const user = userEvent.setup()
    const state = createClubState()
    let held: ReturnType<typeof holdCalls> | undefined
    const { region, tracked } = await openRatings('b1', { state }, (client) => {
      held = holdCalls(client, 'setBookFinished')
      return held.client
    })

    await user.click(within(region).getByRole('checkbox', { name: 'He terminado el libro' }))
    // Meanwhile, the admin's review arrives from another tab: a rated book stays finished.
    state.reviews.push({
      bookId: 'b1',
      userId: 'm1',
      scores: { disfrute: 4, estilo: 4, personajes: 4, trama: 4, huella: 4 },
      text: null,
      submittedAt: state.now,
      editedAt: null,
    })
    held!.release()

    expect(
      await within(region).findByText(
        'No se ha podido cambiar porque el libro ha cambiado mientras tanto. Aquí tienes cómo está ahora.',
      ),
    ).toBeInTheDocument()
    expect(await within(region).findByText('Has terminado este libro.')).toBeInTheDocument()
    expect(within(region).queryByRole('alert')).not.toBeInTheDocument()
    expect(tracked.clubDataCalls().filter((m) => m === 'getBookRatings')).toHaveLength(2)
  })

  it('puts the control back with an alert when saving fails', async () => {
    const user = userEvent.setup()
    const { region } = await openRatings('b3', { failures: { setBookFinished: 1 } })

    await user.click(within(region).getByRole('checkbox', { name: 'He terminado el libro' }))

    expect(await within(region).findByRole('alert')).toHaveTextContent('No se ha podido guardar. Inténtalo de nuevo.')
    const toggle = within(region).getByRole('checkbox', { name: 'He terminado el libro' })
    expect(toggle).not.toBeChecked()
    expect(toggle).toBeEnabled()
    expect(within(region).queryByRole('link')).not.toBeInTheDocument()
  })

  it('returns to the sign-in screen when the toggle gets a 401', async () => {
    const user = userEvent.setup()
    const state = createClubState()
    let held: ReturnType<typeof holdCalls> | undefined
    const { region } = await openRatings('b3', { state }, (client) => {
      held = holdCalls(client, 'setBookFinished')
      return held.client
    })

    await user.click(within(region).getByRole('checkbox', { name: 'He terminado el libro' }))
    state.session = 'anonymous'
    held!.release()

    expect(await screen.findByRole('button', { name: 'Entrar con Discord' })).toBeInTheDocument()
    expectNoClubContent()
    expect(state.finished.b3).toEqual(['m3'])
  })

  it('shows «Cargando…» inside the section while the ratings load', async () => {
    const held = holdCalls(createMockClient(), 'getBookRatings')
    renderApp({ path: '/biblioteca/b3', client: held.client })

    await screen.findByRole('heading', { level: 1, name: 'La Regenta' })
    expect(within(ratingsRegion()).getByRole('status')).toHaveTextContent('Cargando…')
    held.release()
    expect(await within(ratingsRegion()).findByRole('checkbox', { name: 'He terminado el libro' })).toBeInTheDocument()
  })

  it('shows a load error with retry inside the section only', async () => {
    const user = userEvent.setup()
    const { region, tracked } = await openRatings('b3', { failures: { getBookRatings: 1 } })

    expect(within(region).getByRole('alert')).toHaveTextContent('No se han podido cargar las valoraciones.')
    expect(screen.getByRole('heading', { level: 1, name: 'La Regenta' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Plan de lectura' })).toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(1)

    await user.click(within(region).getByRole('button', { name: 'Reintentar' }))
    expect(await within(ratingsRegion()).findByRole('checkbox', { name: 'He terminado el libro' })).toBeInTheDocument()
    expect(tracked.clubDataCalls().filter((m) => m === 'getBookRatings')).toHaveLength(2)
  })

  it('returns to the sign-in screen when the ratings get a 401', async () => {
    const state = createClubState()
    const held = holdCalls(createMockClient({ state }), 'getBookRatings')
    renderApp({ path: '/biblioteca/b3', client: held.client })

    await screen.findByRole('heading', { level: 1, name: 'La Regenta' })
    state.session = 'anonymous'
    held.release()

    expect(await screen.findByRole('button', { name: 'Entrar con Discord' })).toBeInTheDocument()
    expectNoClubContent()
  })
})

describe('«Valoraciones» once visible', () => {
  it('shows the user’s rating, the club’s means with n and the members’ reviews', async () => {
    const { region } = await openRatings('b2')

    expect(region).toHaveTextContent('Has terminado este libro.')
    expect(within(region).queryByRole('checkbox')).not.toBeInTheDocument()

    const mine = within(region).getByRole('region', { name: 'Tu valoración' })
    expect(mine).toHaveTextContent('Tu media: 3,8 / 5')
    expect(within(mine).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Disfrute: 5',
      'Estilo: 4,5',
      'Personajes: 3',
      'Trama: 4',
      'Huella: 2,5',
    ])
    expect(mine).toHaveTextContent('Me atrapó desde el principio')
    expect(within(mine).getByRole('link', { name: 'Editar mi valoración' })).toHaveAttribute('href', '/biblioteca/b2/valorar')

    const club = within(region).getByRole('region', { name: 'Media del club' })
    expect(club).toHaveTextContent('Media del club: 4,1 / 5')
    expect(club).toHaveTextContent('4 valoraciones')
    const table = within(club).getByRole('table', { name: 'Media del club por criterio (4 valoraciones)' })
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Criterio', 'Media del club'])
    expect(
      within(table)
        .getAllByRole('row')
        .slice(1)
        .map((row) => [within(row).getByRole('rowheader').textContent, within(row).getByRole('cell').textContent]),
    ).toEqual([
      ['Disfrute', '4,0'],
      ['Estilo', '4,3'],
      ['Personajes', '4,1'],
      ['Trama', '4,0'],
      ['Huella', '3,9'],
    ])

    const members = within(region).getByRole('region', { name: 'Valoraciones de los miembros' })
    const reviews = within(members)
      .getAllByRole('listitem')
      .filter((li) => li.parentElement?.parentElement === members)
    expect(reviews.map((li) => li.querySelector('.font-semibold')?.textContent)).toEqual(['Carmen', 'Inés', 'Jordi'])
    expect(reviews[0]).toHaveTextContent('Media: 4,4 / 5')
    expect(within(reviews[0]).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Disfrute: 4',
      'Estilo: 5',
      'Personajes: 4,5',
      'Trama: 3,5',
      'Huella: 5',
    ])
    expect(region.textContent).not.toMatch(NEVER_SHOWN)
  })

  it('shows review texts as plain text with their line breaks', async () => {
    const { region } = await openRatings('b2')
    const text = within(region).getByText(/Heathcliff me pareció/)
    expect(text.textContent).toBe(
      'Heathcliff me pareció <b>insoportable</b> y fascinante a la vez.\n' +
        'El páramo es el mejor personaje del libro.\n' +
        '<script>alert("hola")</script> no es más que texto aquí.',
    )
    expect(text).toHaveClass('whitespace-pre-line')
    expect(region.querySelector('b, script')).toBeNull()
  })

  it('shows no empty box for a review with no text', async () => {
    const { region } = await openRatings('b2')
    const members = within(region).getByRole('region', { name: 'Valoraciones de los miembros' })
    const ines = within(members).getByText('Inés').closest('li')!
    expect(ines.children).toHaveLength(3)
    expect(ines.textContent).not.toMatch(NEVER_SHOWN)
  })

  it('says only the user’s rating is there when n = 1', async () => {
    const state = createClubState()
    state.finished.b6 = ['m1']
    state.reviews.push({
      bookId: 'b6',
      userId: 'm1',
      scores: { disfrute: 4, estilo: 3.5, personajes: 5, trama: 2, huella: 4.5 },
      text: null,
      submittedAt: state.now,
      editedAt: null,
    })
    const { region } = await openRatings('b6', { state })

    expect(region).toHaveTextContent('Media del club: 3,8 / 5')
    expect(region).toHaveTextContent('1 valoración')
    expect(region).toHaveTextContent('Por ahora solo está tu valoración.')
    expect(region.textContent).not.toMatch(NEVER_SHOWN)
  })

  it('shows «Niebla» locked and finished to the admin, and visible to the member', async () => {
    const asAdmin = await openRatings('b1', { session: 'admin' })
    expect(within(asAdmin.region).getByRole('checkbox', { name: 'He terminado el libro' })).toBeChecked()
    expectNothingGated(asAdmin.region)
    asAdmin.unmount()

    const asMember = await openRatings('b1', { session: 'member' })
    expect(asMember.region).toHaveTextContent('Has terminado este libro.')
    expect(asMember.region).toHaveTextContent('Media del club: 3,9 / 5')
    expect(asMember.region).toHaveTextContent('3 valoraciones')
    const members = within(asMember.region).getByRole('region', { name: 'Valoraciones de los miembros' })
    expect(members).toHaveTextContent(/Elena.*Pablo/)
    expect(members.textContent).not.toMatch(/Lucía|Mateo/)
  })

  it('shows the same section to a member and the admin in the same situation', async () => {
    // Neither the admin nor the default member has finished «La Regenta».
    const admin = await openRatings('b3', { session: 'admin' })
    const adminHtml = admin.region.innerHTML.replace(/_r_\w+_/g, '')
    admin.unmount()
    const member = await openRatings('b3', { session: 'member' })
    expect(member.region.innerHTML.replace(/_r_\w+_/g, '')).toBe(adminHtml)
  })
})
