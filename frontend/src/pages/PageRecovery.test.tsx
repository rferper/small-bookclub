import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { render } from '@testing-library/react'
import { createMockClient } from '../api/mock/mockClient'
import { renderApp } from '../test/renderApp'
import { routes } from '../routes'

describe('Page recovery', () => {
  it('shows loading during a retry and restores the page when it succeeds', async () => {
    const user = userEvent.setup(), client = createMockClient()
    let release = () => {}, calls = 0
    const gate = new Promise<void>((resolve) => { release = resolve })
    const getHome = client.getHome.bind(client)
    client.getHome = () => ++calls === 1
      ? Promise.reject(new Error('private server details'))
      : gate.then(getHome)
    renderApp({ client })
    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    await act(async () => release())
    expect(await screen.findByRole('heading', { name: 'La Regenta' })).toBeInTheDocument()
    expect(calls).toBe(2)
    expect(screen.queryByText('private server details')).not.toBeInTheDocument()
  })

  it('uses the configured crash fallback without displaying the error or stack', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    function BrokenPage(): never { throw new Error('SECRET fictional review /private/path') }
    try {
      const router = createMemoryRouter([{ ...routes[0], element: <BrokenPage />, children: undefined }])
      render(<RouterProvider router={router} />)
      expect(await screen.findByRole('heading', { name: 'No hemos podido abrir esta página' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/')
      expect(screen.queryByText(/SECRET|private\/path|Unexpected Application Error/)).not.toBeInTheDocument()
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    } finally { log.mockRestore() }
  })

  it('provides the styled missing-page screen and recovery link for an unknown URL', async () => {
    renderApp({ path: '/pagina-inexistente' })
    expect(await screen.findByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/')
  })

  it('provides the reserved-section screen to a member at an admin URL', async () => {
    renderApp({ path: '/administracion/registro', client: createMockClient({ session: 'member' }) })
    expect(await screen.findByRole('heading', { name: 'Sección reservada' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/')
  })
})
