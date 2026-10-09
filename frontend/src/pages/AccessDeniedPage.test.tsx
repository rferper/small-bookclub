import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createClubState } from '../api/mock/fixtures'
import { createMockClient } from '../api/mock/mockClient'
import { holdCalls, trackCalls } from '../test/clients'
import { expectNoClubContent } from '../test/expectations'
import { renderApp } from '../test/renderApp'

describe('access-denied page', () => {
  it('explains kindly that the club is private, without club or account details', async () => {
    const { container } = renderApp({ client: createMockClient({ session: 'denied' }) })

    const main = await screen.findByRole('main')
    expect(within(main).getByRole('heading', { level: 1, name: 'Esta cuenta no tiene acceso al club' })).toBeInTheDocument()
    expect(main).toHaveTextContent(
      'Este club de lectura es privado: solo pueden entrar los miembros que ha añadido la persona que lo administra.',
    )
    expect(main).toHaveTextContent('Si crees que se trata de un error, puedes preguntárselo a quien administra el club.')

    expectNoClubContent()
    for (const member of createClubState().members) expect(main).not.toHaveTextContent(member.displayName)
    // No error codes, counts or account IDs.
    expect(main).not.toHaveTextContent(/\d/)
    expect(screen.queryAllByRole('link')).toEqual([])
    expect(container.querySelector('form')).toBeNull()
    expect(within(main).getAllByRole('button').map((b) => b.textContent)).toEqual(['Entrar con Discord'])
  })

  it('lets the person try again with Discord', async () => {
    const user = userEvent.setup()
    renderApp({ client: createMockClient({ session: 'denied', random: () => 0 }) })

    await user.click(await screen.findByRole('button', { name: 'Entrar con Discord' }))
    expect(await screen.findByRole('navigation', { name: 'Principal' })).toBeInTheDocument()
  })

  it('disables the button while signing in and explains a failure gently', async () => {
    const user = userEvent.setup()
    const held = holdCalls(createMockClient({ session: 'denied', failures: { startSignIn: 1 } }), 'startSignIn')
    const tracked = trackCalls(held.client)
    renderApp({ client: tracked.client })

    const button = await screen.findByRole('button', { name: 'Entrar con Discord' })
    await user.click(button)
    expect(button).toBeDisabled()
    await user.click(button)
    held.release()

    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido iniciar sesión. Inténtalo de nuevo.')
    expect(button).toBeEnabled()
    expect(tracked.calls.filter((method) => method === 'startSignIn')).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Esta cuenta no tiene acceso al club' })).toBeInTheDocument()
  })
})
