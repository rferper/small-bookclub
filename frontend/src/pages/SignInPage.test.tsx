import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createMockClient } from '../api/mock/mockClient'
import { holdCalls, trackCalls } from '../test/clients'
import { renderApp } from '../test/renderApp'

const anonymous = (options: Parameters<typeof createMockClient>[0] = {}) =>
  createMockClient({ session: 'anonymous', random: () => 0, ...options })

describe('sign-in screen', () => {
  it('welcomes members warmly with a single way in and no way to sign up', async () => {
    const { container } = renderApp({ client: anonymous() })

    const main = await screen.findByRole('main')
    const heading = within(main).getByRole('heading', { level: 1, name: 'Club de Lectura' })
    expect(heading).toHaveClass('text-3xl')
    expect(main).toHaveTextContent(
      'Te damos la bienvenida a la biblioteca privada del club. Los miembros entran con su cuenta de Discord.',
    )
    expect(within(main).getAllByRole('button').map((b) => b.textContent)).toEqual(['Entrar con Discord'])
    expect(screen.queryAllByRole('link')).toEqual([])
    expect(screen.queryAllByRole('textbox')).toEqual([])
    expect(container.querySelector('form')).toBeNull()
    expect(main).not.toHaveTextContent(/lista|solicit|registr|admin/i)
  })

  it('signs in and shows the club without reloading the page', async () => {
    const user = userEvent.setup()
    const tracked = trackCalls(anonymous())
    renderApp({ path: '/biblioteca', client: tracked.client })

    await user.click(await screen.findByRole('button', { name: 'Entrar con Discord' }))

    const nav = await screen.findByRole('navigation', { name: 'Principal' })
    expect(within(nav).queryByRole('link', { name: 'Administración' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Biblioteca' })).toBeInTheDocument()
    expect(tracked.calls.filter((method) => method === 'startSignIn')).toHaveLength(1)
    // Focus moves to the top of the new page, not to the removed button.
    expect(document.activeElement).toContainElement(nav)
  })

  it('shows the access-denied page when the sign-in is refused', async () => {
    const user = userEvent.setup()
    renderApp({ client: anonymous({ signInResult: 'denied' }) })

    await user.click(await screen.findByRole('button', { name: 'Entrar con Discord' }))

    const heading = await screen.findByRole('heading', { level: 1, name: 'Esta cuenta no tiene acceso al club' })
    expect(heading).toHaveFocus()
  })

  it('keeps the screen and explains gently when the sign-in fails', async () => {
    const user = userEvent.setup()
    renderApp({ client: anonymous({ failures: { startSignIn: 1 } }) })

    await user.click(await screen.findByRole('button', { name: 'Entrar con Discord' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No se ha podido iniciar sesión. Inténtalo de nuevo.')
    expect(alert).not.toHaveTextContent('Error simulado')
    expect(screen.getByRole('heading', { level: 1, name: 'Club de Lectura' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar con Discord' })).toBeEnabled()
  })

  it('disables the button while signing in, so it cannot sign in twice', async () => {
    const user = userEvent.setup()
    const held = holdCalls(anonymous(), 'startSignIn')
    const tracked = trackCalls(held.client)
    renderApp({ client: tracked.client })

    const button = await screen.findByRole('button', { name: 'Entrar con Discord' })
    await user.click(button)
    expect(button).toBeDisabled()
    await user.click(button)
    expect(tracked.calls.filter((method) => method === 'startSignIn')).toHaveLength(1)

    held.release()
    expect(await screen.findByRole('navigation', { name: 'Principal' })).toBeInTheDocument()
  })

  it('works with the keyboard', async () => {
    const user = userEvent.setup()
    renderApp({ client: anonymous() })

    await screen.findByRole('button', { name: 'Entrar con Discord' })
    await user.tab()
    expect(screen.getByRole('button', { name: 'Entrar con Discord' })).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('navigation', { name: 'Principal' })).toBeInTheDocument()
  })

  it('has no demo section unless the session offers it', async () => {
    renderApp({ client: anonymous() })

    await screen.findByRole('button', { name: 'Entrar con Discord' })
    expect(screen.queryByRole('region', { name: 'Versión de demostración' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Entrar con una cuenta de prueba' })).not.toBeInTheDocument()
    expect(screen.queryByText(/datos ficticios/)).not.toBeInTheDocument()
  })

  it('offers the demo sign-in when the session says so', async () => {
    const user = userEvent.setup()
    const tracked = trackCalls(anonymous({ demoSignInAvailable: true }))
    renderApp({ client: tracked.client })

    const demo = await screen.findByRole('region', { name: 'Versión de demostración' })
    expect(demo).toHaveTextContent('Esta es una demo con datos ficticios.')
    const button = within(demo).getByRole('button', { name: 'Entrar con una cuenta de prueba' })
    expect(button).toHaveClass('border-forest')

    // Keyboard: Tab past «Entrar con Discord», then Space.
    await user.tab()
    await user.tab()
    expect(button).toHaveFocus()
    await user.keyboard(' ')

    expect(await screen.findByRole('navigation', { name: 'Principal' })).toBeInTheDocument()
    expect(tracked.calls).toContain('startDemoSignIn')
    expect(tracked.calls).not.toContain('startSignIn')
  })
})
