import { afterEach, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

afterEach(() => vi.unstubAllEnvs())

it('invalid startup mode visibly refuses configuration before creating a session screen', async () => {
  vi.stubEnv('VITE_API_MODE', '')
  const { default: App } = await import('./App')
  render(<App />)
  expect(screen.getByRole('alert')).toHaveTextContent('La configuración del servicio no es válida.')
  expect(screen.getByRole('heading')).toHaveTextContent('No podemos iniciar el sitio')
  expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
})
