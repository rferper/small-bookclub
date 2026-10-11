import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createClubState, createEmptyState } from '../api/mock/fixtures'
import { createMockClient } from '../api/mock/mockClient'
import { holdCalls, trackCalls } from '../test/clients'
import { renderApp } from '../test/renderApp'

const backups = '/administracion/copias', audit = '/administracion/registro'
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
function downloads() {
  let blob: Blob | undefined
  const create = vi.fn((value: Blob) => { blob = value; return 'blob:fictional' })
  vi.stubGlobal('URL', class extends URL { static createObjectURL = create; static revokeObjectURL = vi.fn() })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  return { create, click, blob: () => blob }
}

describe('guarded administrative operations screens', () => {
  it.each(['anonymous', 'denied', 'member', 'curator'] as const)('blocks direct routes with no data calls for %s', async (session) => {
    for (const path of [backups, audit]) {
      const tracked = trackCalls(createMockClient({ session })), app = renderApp({ path, client: tracked.client })
      await screen.findByRole('heading', { level: 1 })
      expect(tracked.clubDataCalls()).toEqual([]); expect(screen.queryByText('Política de copias pendiente de configurar')).not.toBeInTheDocument()
      expect(screen.queryByText('Actividad administrativa')).not.toBeInTheDocument(); app.unmount()
    }
  })
  it('links both routes and displays pending policy without inventing a last backup', async () => {
    const user = userEvent.setup()
    renderApp({ path: '/administracion' })
    await user.click(await screen.findByRole('link', { name: 'Copias y exportación' }))
    await screen.findByText('Política de copias pendiente de configurar')
    expect(screen.queryByText(/Última copia/)).not.toBeInTheDocument()
    expect(screen.getByText(/La papelera mantiene/)).toHaveTextContent('30 días')
    expect(screen.getByText(/La papelera mantiene/)).toHaveTextContent('rotación de copias debe tener un límite')
    await user.click(screen.getByRole('link', { name: 'Volver a Administración' }))
    await user.click(await screen.findByRole('link', { name: 'Registro de actividad' }))
    await screen.findByText('Acceso aprobado'); expect(screen.queryByRole('button', { name: /Editar|Eliminar/ })).not.toBeInTheDocument()
  })
  it('labels an explicitly supplied last backup as simulated', async () => {
    const state = createClubState(); state.lastBackupAt = state.now
    renderApp({ path: backups, client: createMockClient({ state }) })
    expect(await screen.findByText(/Última copia simulada:/)).toBeInTheDocument()
  })
  it.each([[backups, 'getBackupInfo'], [audit, 'getAuditLog']] as const)('shows loading and retries a failure at %s', async (path, method) => {
    const held = holdCalls(createMockClient({ state: createEmptyState(), failures: { [method]: 1 } }), method), tracked = trackCalls(held.client)
    renderApp({ path, client: tracked.client })
    await waitFor(() => expect(tracked.calls).toContain(method)); expect(screen.getByText('Cargando…')).toBeInTheDocument()
    held.release(); fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
    await screen.findByText(path === audit ? 'Todavía no hay actividad administrativa.' : 'Política de copias pendiente de configurar')
  })
  it('renders long metadata literally and never includes private content', async () => {
    const state = createEmptyState()
    state.audit = [{ id: 'safe', action: 'soft_deleted', target: { type: 'book', id: 'b1', label: `<b>${'Título'.repeat(90)}</b>` }, actor: { id: 'm1', displayName: '<i>Ficticia</i>' }, occurredAt: state.now }]
    renderApp({ path: audit, client: createMockClient({ state }) })
    expect(await screen.findByText(/<b>Título/)).toBeInTheDocument(); expect(document.querySelector('b, i')).toBeNull()
  })
})

describe('fictional JSON download confirmation', () => {
  it('cancel and Escape produce no call/file/event and restore keyboard focus', async () => {
    const state = createClubState(), before = structuredClone(state.audit), tracked = trackCalls(createMockClient({ state })), user = userEvent.setup(), download = downloads()
    renderApp({ path: backups, client: tracked.client })
    const exportButton = await screen.findByRole('button', { name: 'Exportar datos' })
    await user.click(exportButton); expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    expect(screen.getByRole('dialog')).toHaveTextContent('registros privados')
    await user.keyboard('{Escape}'); expect(exportButton).toHaveFocus()
    await user.click(exportButton); await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(exportButton).toHaveFocus(); expect(tracked.calls).not.toContain('exportClubData'); expect(download.click).not.toHaveBeenCalled(); expect(state.audit).toEqual(before)
  })
  it('disables duplicate submission in progress, downloads exactly once and reports success', async () => {
    const state = createEmptyState(), held = holdCalls(createMockClient({ state }), 'exportClubData'), tracked = trackCalls(held.client), download = downloads(), user = userEvent.setup()
    renderApp({ path: backups, client: tracked.client })
    const button = await screen.findByRole('button', { name: 'Exportar datos' }); await user.click(button)
    const confirm = screen.getByRole('button', { name: 'Confirmar exportación' })
    fireEvent.click(confirm); fireEvent.click(confirm)
    expect(screen.getByRole('button', { name: 'Exportando…' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(button).toBeDisabled(); expect(download.click).not.toHaveBeenCalled()
    held.release(); await screen.findByText('Exportación de demostración descargada')
    expect(tracked.calls.filter((m) => m === 'exportClubData')).toHaveLength(1)
    expect(download.create).toHaveBeenCalledTimes(1); expect(download.blob()?.type).toBe('application/json;charset=utf-8'); expect(download.click).toHaveBeenCalledTimes(1)
    expect(download.click.mock.instances[0]).toHaveProperty('download', 'club-de-lectura-demostracion.json')
    expect(state.audit).toHaveLength(1); expect(button).toHaveFocus()
  })
  it('failure keeps confirmation retryable without file/event and retry succeeds', async () => {
    const state = createEmptyState(), download = downloads(), user = userEvent.setup(), client = createMockClient({ state, failures: { exportClubData: 1 } })
    renderApp({ path: backups, client })
    await user.click(await screen.findByRole('button', { name: 'Exportar datos' })); await user.click(screen.getByRole('button', { name: 'Confirmar exportación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Vuelve a intentarlo')
    expect(download.click).not.toHaveBeenCalled(); expect(state.audit).toEqual([])
    const confirm = screen.getByRole('button', { name: 'Confirmar exportación' }); expect(confirm).toHaveFocus(); expect(confirm).toBeEnabled()
    await user.click(confirm); await screen.findByText('Exportación de demostración descargada'); expect(download.click).toHaveBeenCalledTimes(1)
  })
  it('409 reauthorisation remains signed in and permits retry but never fabricates a file/event', async () => {
    const state = createEmptyState(), download = downloads(), user = userEvent.setup(), client = createMockClient({ state, exportReauthorisationRequired: true })
    const app = renderApp({ path: backups, client })
    await user.click(await screen.findByRole('button', { name: 'Exportar datos' })); await user.click(screen.getByRole('button', { name: 'Confirmar exportación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Se necesita volver a autorizar la exportación. En esta demostración no se realiza una reautenticación real.')
    expect(screen.getByRole('button', { name: 'Confirmar exportación' })).toBeEnabled()
    expect(state.session).toBe('signedIn'); expect(state.audit).toEqual([]); expect(download.click).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Cancelar' })); await act(() => app.router.navigate(audit))
    await screen.findByText('Todavía no hay actividad administrativa.')
  })
})
