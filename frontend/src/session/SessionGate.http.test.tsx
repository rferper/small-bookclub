import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createHttpClient } from '../api/httpClient'
import type { Session } from '../api/types'
import { expectNoClubContent } from '../test/expectations'
import { renderApp } from '../test/renderApp'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
})
const anonymous: Session = { status: 'anonymous', demoSignInAvailable: false }
const signedIn: Session = {
  status: 'signedIn', user: { id: 'fictional-website-7', displayName: 'Alba ficticia', avatarUrl: null, role: 'member' },
}

// Inject a real central HTTP client at the component boundary. The offline sender
// exercises its adapters; provider authentication is covered by backend integration.
describe('session gate using the HTTP session adapters', () => {
  it.each(['anonymous', 'denied'] as const)('shows the Spanish %s gate and navigates sign-in without club requests', async status => {
    const user = userEvent.setup()
    const send = vi.fn<typeof fetch>(async () => json({ status, demoSignInAvailable: false }))
    const navigate = vi.fn()
    const { router } = renderApp({ path: '/biblioteca', client: createHttpClient({ fetch: send, navigate }) })
    expect(await screen.findByRole('heading', { level: 1, name: status === 'denied' ? 'Esta cuenta no tiene acceso al club' : 'Club de Lectura' })).toBeVisible()
    expectNoClubContent()
    expect(screen.queryByRole('button', { name: /demo/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Entrar con Discord' }))
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/api/auth/discord/start')
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2))
    expect(send.mock.calls.map(([url]) => url)).toEqual(['/api/session', '/api/session'])
    expect(router.state.location.pathname).toBe('/biblioteca')
    expectNoClubContent()
  })

  it('retries a failed HTTP session lookup and shows anonymous without fictional fallback', async () => {
    const user = userEvent.setup()
    const send = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('Offline'))
      .mockImplementation(async () => json(anonymous))
    renderApp({ client: createHttpClient({ fetch: send }) })
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No hemos podido conectar con el club.')
    expectNoClubContent()
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('button', { name: 'Entrar con Discord' })).toBeVisible()
    expect(send.mock.calls.map(([url]) => url)).toEqual(['/api/session', '/api/session'])
    expectNoClubContent()
  })

  it('keeps the member shell when the native homepage fails, then logs out and rechecks session', async () => {
    const user = userEvent.setup()
    let session: Session = signedIn
    const send = vi.fn<typeof fetch>(async (url, init) => {
      if (url === '/api/session') return json(session)
      if (url === '/api/home') return json({ code: 'service_unavailable', message: 'El servicio no está disponible. Inténtalo de nuevo.' }, 503)
      if (url === '/api/auth/logout' && init?.method === 'POST') {
        session = anonymous
        return new Response(null, { status: 204 })
      }
      throw new Error('Unexpected request')
    })
    renderApp({ client: createHttpClient({ fetch: send, cookie: () => `csrftoken=${'a'.repeat(32)}` }) })
    expect(await screen.findByRole('navigation', { name: 'Principal' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Administración' })).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeVisible()
    expect(screen.queryByText('La Regenta')).not.toBeInTheDocument()
    expect(send.mock.calls.map(([url]) => url)).toEqual(['/api/session', '/api/home'])
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('button', { name: 'Entrar con Discord' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Has cerrado sesión. ¡Hasta pronto!')
    expect(send.mock.calls.map(([url]) => url)).toEqual(['/api/session', '/api/home', '/api/auth/logout', '/api/session'])
    expect(new Headers(send.mock.calls[2][1]?.headers).get('X-CSRFToken')).toBe('a'.repeat(32))
    expectNoClubContent()
  })

  it('keeps the signed-in shell on safe CSRF logout failure', async () => {
    const user = userEvent.setup()
    const send = vi.fn<typeof fetch>(async url => url === '/api/session'
      ? json(signedIn)
      : json({ code: 'forbidden', message: 'No tienes permiso para realizar esta acción.' }, 403))
    renderApp({ path: '/no-existe', client: createHttpClient({ fetch: send }) })
    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido cerrar la sesión. Inténtalo de nuevo.')
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeVisible()
    expect(screen.queryByText(/Has cerrado sesión/)).not.toBeInTheDocument()
    expect(send.mock.calls.map(([url]) => url)).toEqual(['/api/session', '/api/auth/logout'])
  })
})
