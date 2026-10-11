import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

it('keeps focus inside a pending-mounted dialog and focuses Cancel when its controls become ready', async () => {
  const user = userEvent.setup()
  const props = { title: '¿Eliminar Libro ficticio?', confirmLabel: 'Confirmar eliminación', error: null, onCancel: () => {}, onConfirm: () => {}, children: <p>Recuperable durante 30 días.</p> }
  const view = render(<ConfirmDialog {...props} busy />)
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeDisabled()
  expect(dialog).toHaveFocus()
  view.rerender(<ConfirmDialog {...props} busy={false} />)
  expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  await user.tab({ shift: true })
  expect(within(dialog).getByRole('button', { name: 'Confirmar eliminación' })).toHaveFocus()
  await user.tab()
  expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  view.rerender(<ConfirmDialog {...props} busy />)
  view.rerender(<ConfirmDialog {...props} busy={false} error="No se ha podido eliminar. Reintenta." />)
  expect(within(dialog).getByRole('button', { name: 'Confirmar eliminación' })).toHaveFocus()
})
