import { screen } from '@testing-library/react'
import { expect } from 'vitest'

const NAV_LABELS = ['Inicio', 'Biblioteca', 'Reuniones', 'Votaciones', 'Estadísticas', 'Miembros', 'Mi perfil', 'Administración']

// Nothing of the signed-in club is on the page.
export function expectNoClubContent() {
  expect(screen.queryByRole('navigation', { name: 'Principal' })).not.toBeInTheDocument()
  for (const label of NAV_LABELS) expect(screen.queryByText(label)).not.toBeInTheDocument()
  expect(screen.queryByText('La Regenta', { exact: false })).not.toBeInTheDocument()
  expect(screen.queryByText('Lucía', { exact: false })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument()
}
