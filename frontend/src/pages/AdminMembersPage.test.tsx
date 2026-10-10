import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ApiClient } from '../api/client'
import { createClubState, createEmptyState, type MockState } from '../api/mock/fixtures'
import { createMockClient, type MockOptions } from '../api/mock/mockClient'
import { ADMIN_LIST_CHANGED } from '../lib/admin'
import { holdCalls, trackCalls } from '../test/clients'
import { renderApp } from '../test/renderApp'

// «Miembros y curaduría» (#70) with the default fixtures: seven active
// members (Jordi is the curator, Lucía the signed-in admin) and the revoked
// Tomás. Jordi's vote v2 is open.

const PATH = '/administracion/miembros'

async function openPage(options: MockOptions & { client?: ApiClient } = {}) {
  const state = options.state ?? createClubState()
  const tracked = trackCalls(options.client ?? createMockClient({ random: () => 0, ...options, state }))
  const rendered = renderApp({ path: PATH, client: tracked.client })
  await screen.findByRole('heading', { level: 2, name: 'Miembros' })
  return { ...rendered, state, tracked, calls: (method: string) => tracked.calls.filter((c) => c === method).length }
}

const region = (name: string) => screen.getByRole('region', { name })
const membersRegion = () => region('Miembros')
const activeGroup = () => within(membersRegion()).getByRole('region', { name: 'Con acceso' })
const revokedGroup = () => within(membersRegion()).queryByRole('region', { name: 'Sin acceso' })
// The first line of each entry: name, «(tú)» and labels.
const names = (group: HTMLElement | null) =>
  group ? within(group).getAllByRole('listitem').map((li) => li.querySelector('p')!.textContent) : []
const entry = (name: string) =>
  within(membersRegion())
    .getAllByRole('listitem')
    .find((li) => li.querySelector('p')!.textContent!.split(' (tú)')[0].split(' · ')[0] === name)!
const idField = () => screen.getByRole('textbox', { name: 'ID de Discord' })
const nameField = () => screen.getByRole('textbox', { name: 'Nombre visible' })
const addButton = () => within(region('Añadir un miembro')).getByRole('button')
const curatorSelect = () => screen.getByRole('combobox', { name: 'Persona en la curaduría' })
const saveCurator = () => screen.getByRole('button', { name: 'Guardar curaduría' })
const status = (name: string) => within(region(name)).getAllByRole('status').find((s) => s.textContent)?.textContent

describe('Loading', () => {
  it('shows the page structure: one h1, a link back and three h2 sections', async () => {
    await openPage()
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Miembros y curaduría'])
    expect(screen.getByRole('link', { name: 'Volver a Administración' })).toHaveAttribute('href', '/administracion')
    expect(within(screen.getByRole('main')).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Añadir un miembro',
      'Miembros',
      'Curaduría',
    ])
  })

  it('shows Loading, then an error with «Reintentar» that repeats the call', async () => {
    const user = userEvent.setup()
    const held = holdCalls(createMockClient({ failures: { getAdminMembers: 1 } }), 'getAdminMembers')
    const tracked = trackCalls(held.client)
    renderApp({ path: PATH, client: tracked.client })
    await waitFor(() => expect(tracked.calls.filter((call) => call === 'getAdminMembers')).toHaveLength(1))
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
    held.release()
    expect(await screen.findByText('No se ha podido cargar la lista de miembros.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Miembros' })).toBeInTheDocument()
    expect(tracked.calls.filter((c) => c === 'getAdminMembers')).toHaveLength(2)
  })
})

describe('Member list', () => {
  it('lists the seven active members by name, then Tomás as revoked', async () => {
    await openPage()
    expect(names(activeGroup())).toEqual([
      'Carmen',
      'Elena',
      'Inés',
      'Jordi · Curaduría actual',
      'Lucía (tú) · Administración',
      'Mateo',
      'Pablo',
    ])
    expect(names(revokedGroup())).toEqual(['Tomás'])
    expect(within(activeGroup()).getAllByText('Con acceso', { selector: 'p' })).toHaveLength(7)
    expect(entry('Tomás')).toHaveTextContent('Acceso retirado el 15 de junio de 2026')
  })

  it('shows each Discord id in a monospace style with its label', async () => {
    await openPage()
    expect(entry('Carmen')).toHaveTextContent('ID de Discord: 000000000000000103')
    expect(within(entry('Carmen')).getByText('000000000000000103')).toHaveClass('font-mono')
    expect(entry('Tomás')).toHaveTextContent('ID de Discord: 000000000000000108')
  })

  it('offers «Retirar el acceso» to every active member but the admin, and «Devolver el acceso» to Tomás', async () => {
    await openPage()
    const revokeNames = within(activeGroup())
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'))
    expect(revokeNames).toEqual([
      'Retirar el acceso a Carmen',
      'Retirar el acceso a Elena',
      'Retirar el acceso a Inés',
      'Retirar el acceso a Jordi',
      'Retirar el acceso a Mateo',
      'Retirar el acceso a Pablo',
    ])
    expect(within(entry('Lucía')).queryByRole('button')).not.toBeInTheDocument()
    expect(within(revokedGroup()!).getByRole('button', { name: 'Devolver el acceso a Tomás' })).toBeInTheDocument()
  })

  it('shows only «Lucía (tú)», no revoked group and no curator in the empty club', async () => {
    await openPage({ state: createEmptyState() })
    expect(names(activeGroup())).toEqual(['Lucía (tú) · Administración'])
    expect(revokedGroup()).not.toBeInTheDocument()
    expect(region('Curaduría')).toHaveTextContent('Ahora no hay nadie en la curaduría.')
    expect(within(curatorSelect()).getAllByRole('option').map((o) => o.textContent)).toEqual(['Sin curaduría', 'Lucía'])
  })

  it('shows names with markup literally, creating no element', async () => {
    const state = createClubState()
    state.members.find((m) => m.id === 'm3')!.displayName = '<b>Carmen</b>'
    state.revokedMembers[0].displayName = '<script>alert(1)</script>'
    await openPage({ state })
    expect(within(membersRegion()).getByText('<b>Carmen</b>')).toBeInTheDocument()
    expect(within(membersRegion()).getByText('<script>alert(1)</script>')).toBeInTheDocument()
    expect(screen.getByRole('main').querySelector('b, script')).toBeNull()
    expect(within(curatorSelect()).getByRole('option', { name: '<b>Carmen</b>' })).toBeInTheDocument()
  })
})

describe('Adding a member', () => {
  it('has labelled fields with hints, a numeric keyboard and the name limit', async () => {
    await openPage()
    expect(idField()).toHaveAttribute('inputmode', 'numeric')
    expect(idField()).toBeRequired()
    expect(idField()).toHaveAccessibleDescription(
      'El ID numérico de la cuenta de Discord, de 17 a 20 cifras. Solo esa cuenta podrá entrar al club.',
    )
    expect(nameField()).toHaveAttribute('maxLength', '40')
    expect(nameField()).toBeRequired()
    expect(nameField()).toHaveAccessibleDescription(expect.stringContaining('Mi perfil'))
    expect(addButton()).toHaveTextContent('Añadir miembro')
    expect(addButton()).toHaveClass('bg-forest')
  })

  it('adds a member: listed by name, the form cleared and a polite status', async () => {
    const user = userEvent.setup()
    const { calls } = await openPage()
    await user.type(idField(), ' 123456789012345678 ')
    await user.type(nameField(), 'Nora')
    await user.click(addButton())
    expect(await screen.findByText('Nora ya puede entrar al club con Discord.')).toHaveAttribute('role', 'status')
    expect(names(activeGroup())).toContain('Nora')
    expect(entry('Nora')).toHaveTextContent('ID de Discord: 123456789012345678')
    expect(idField()).toHaveValue('')
    expect(nameField()).toHaveValue('')
    expect(idField()).toHaveFocus()
    expect(calls('addMember')).toBe(1)
    // A new option for the curator too.
    expect(within(curatorSelect()).getByRole('option', { name: 'Nora' })).toBeInTheDocument()
  })

  it('reads «Añadiendo…» and is disabled while the call is in flight', async () => {
    const user = userEvent.setup()
    const held = holdCalls(createMockClient(), 'addMember')
    await openPage({ client: held.client })
    await user.type(idField(), '12345678901234567')
    await user.type(nameField(), 'Nora')
    await user.click(addButton())
    expect(addButton()).toHaveTextContent('Añadiendo…')
    expect(addButton()).toBeDisabled()
    // Only this control: the curator form still works.
    expect(saveCurator()).toBeEnabled()
    held.release()
    expect(await screen.findByText('Nora ya puede entrar al club con Discord.')).toBeInTheDocument()
    expect(addButton()).toBeEnabled()
  })

  it('makes no call for blank fields, describes each error and focuses the first invalid field', async () => {
    const user = userEvent.setup()
    const { calls } = await openPage()
    await user.click(addButton())
    expect(idField()).toHaveFocus()
    expect(idField()).toHaveAttribute('aria-invalid', 'true')
    expect(idField()).toHaveAccessibleDescription(expect.stringContaining('Escribe un ID de Discord de 17 a 20 cifras.'))
    expect(nameField()).toHaveAttribute('aria-invalid', 'true')
    expect(nameField()).toHaveAccessibleDescription(expect.stringContaining('Escribe un nombre.'))
    expect(calls('addMember')).toBe(0)

    // Editing a field clears its error only.
    await user.type(idField(), '1')
    expect(idField()).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByText('Escribe un ID de Discord de 17 a 20 cifras.')).not.toBeInTheDocument()
    expect(nameField()).toHaveAttribute('aria-invalid', 'true')
  })

  it('refuses malformed ids before sending: 16 and 21 digits, letters', async () => {
    const user = userEvent.setup()
    const { calls } = await openPage()
    await user.type(nameField(), 'Nora')
    for (const value of ['1'.repeat(16), '1'.repeat(21), '1234567890123456a']) {
      await user.clear(idField())
      await user.type(idField(), value)
      await user.click(addButton())
      expect(idField()).toHaveFocus()
      expect(idField()).toHaveAccessibleDescription(expect.stringContaining('Escribe un ID de Discord de 17 a 20 cifras.'))
      expect(nameField()).not.toHaveAttribute('aria-invalid')
    }
    expect(calls('addMember')).toBe(0)
  })

  it('refuses a blank or too-long name, focusing the name field', async () => {
    const user = userEvent.setup()
    const { calls } = await openPage()
    await user.type(idField(), '12345678901234567')
    await user.type(nameField(), '   ')
    await user.click(addButton())
    expect(nameField()).toHaveFocus()
    expect(nameField()).toHaveAccessibleDescription(expect.stringContaining('Escribe un nombre.'))
    fireEvent.change(nameField(), { target: { value: 'a'.repeat(41) } })
    expect(nameField()).not.toHaveAttribute('aria-invalid')
    await user.click(addButton())
    expect(nameField()).toHaveAccessibleDescription(expect.stringContaining('como máximo 40 caracteres'))
    expect(calls('addMember')).toBe(0)
  })

  it('keeps the values and says whose id it is for a duplicate active id', async () => {
    const user = userEvent.setup()
    await openPage()
    await user.type(idField(), '000000000000000103')
    await user.type(nameField(), 'Otra Carmen')
    await user.click(addButton())
    await waitFor(() => expect(idField()).toHaveAttribute('aria-invalid', 'true'))
    expect(idField()).toHaveAccessibleDescription(expect.stringContaining('Ese ID de Discord ya está en la lista: es de Carmen.'))
    expect(idField()).toHaveFocus()
    expect(idField()).toHaveValue('000000000000000103')
    expect(nameField()).toHaveValue('Otra Carmen')
    expect(names(activeGroup())).toHaveLength(7)
  })

  it('points to «Devolver el acceso» for a duplicate revoked id', async () => {
    const user = userEvent.setup()
    await openPage()
    await user.type(idField(), '000000000000000108')
    await user.type(nameField(), 'Tomás')
    await user.click(addButton())
    await waitFor(() =>
      expect(idField()).toHaveAccessibleDescription(
        expect.stringContaining('es de Tomás, que ahora no tiene acceso. Puedes usar «Devolver el acceso» en su entrada.'),
      ),
    )
    expect(nameField()).toHaveValue('Tomás')
  })

  it('keeps the values and shows an alert when the call fails, and the button works again', async () => {
    const user = userEvent.setup()
    const { calls } = await openPage({ failures: { addMember: 1 } })
    await user.type(idField(), '12345678901234567')
    await user.type(nameField(), 'Nora')
    await user.click(addButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido añadir a esta persona. Inténtalo de nuevo.')
    expect(idField()).toHaveValue('12345678901234567')
    expect(nameField()).toHaveValue('Nora')
    expect(addButton()).toBeEnabled()
    await user.click(addButton())
    expect(await screen.findByText('Nora ya puede entrar al club con Discord.')).toBeInTheDocument()
    expect(calls('addMember')).toBe(2)
  })

  it('shows an alert for a 400 from the server', async () => {
    const user = userEvent.setup()
    const client = createMockClient()
    // The server's own check refuses what the form let through.
    const strict: ApiClient = new Proxy(client, {
      get(target, property, receiver) {
        if (property === 'addMember') return () => target.addMember({ discordId: 'x', displayName: 'Nora' })
        return Reflect.get(target, property, receiver) as unknown
      },
    })
    await openPage({ client: strict })
    await user.type(idField(), '12345678901234567')
    await user.type(nameField(), 'Nora')
    await user.click(addButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('Algunos datos no son válidos.')
    expect(nameField()).toHaveValue('Nora')
  })
})

describe('Revoking access', () => {
  async function openDialog(name: string, options: MockOptions & { client?: ApiClient } = {}) {
    const user = userEvent.setup()
    const opened = await openPage(options)
    const button = within(entry(name)).getByRole('button', { name: `Retirar el acceso a ${name}` })
    await user.click(button)
    return { ...opened, user, button, dialog: screen.getByRole('dialog', { name: `¿Retirar el acceso a ${name}?` }) }
  }

  it('opens the confirmation with focus on «Cancelar» and explains what happens', async () => {
    const { dialog } = await openDialog('Carmen')
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    expect(dialog).toHaveTextContent('Ya no podrá entrar al club')
    expect(dialog).toHaveTextContent('su sesión abierta se cerrará')
    expect(dialog).toHaveTextContent('Sus votos, valoraciones y asistencias pasadas se quedan en la historia del club.')
    expect(dialog).not.toHaveTextContent('curaduría')
  })

  it('warns that the club will be left without a curator when revoking Jordi', async () => {
    const { dialog } = await openDialog('Jordi')
    expect(dialog).toHaveTextContent('el club se quedará sin nadie en la curaduría')
  })

  it('traps Tab inside the dialog', async () => {
    const { user, dialog } = await openDialog('Carmen')
    const cancel = within(dialog).getByRole('button', { name: 'Cancelar' })
    const confirm = within(dialog).getByRole('button', { name: 'Retirar el acceso' })
    await user.tab()
    expect(confirm).toHaveFocus()
    await user.tab()
    expect(cancel).toHaveFocus()
    await user.tab({ shift: true })
    expect(confirm).toHaveFocus()
  })

  it('closes with Escape or «Cancelar», with no call, and returns focus to the button', async () => {
    const { user, button, calls } = await openDialog('Carmen')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
    await user.click(button)
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
    expect(calls('revokeMember')).toBe(0)
    expect(names(activeGroup())).toContain('Carmen')
  })

  it('calls revokeMember once, disabling both buttons while in flight, then moves Carmen to the revoked group', async () => {
    const held = holdCalls(createMockClient(), 'revokeMember')
    const { user, dialog, calls } = await openDialog('Carmen', { client: held.client })
    await user.click(within(dialog).getByRole('button', { name: 'Retirar el acceso' }))
    await user.click(within(dialog).getByRole('button', { name: 'Retirar el acceso' }))
    for (const button of within(dialog).getAllByRole('button')) expect(button).toBeDisabled()
    held.release()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(calls('revokeMember')).toBe(1)
    expect(names(activeGroup())).not.toContain('Carmen')
    expect(names(revokedGroup())).toEqual(['Carmen', 'Tomás'])
    expect(entry('Carmen')).toHaveTextContent('Acceso retirado el 9 de octubre de 2026')
    expect(status('Miembros')).toBe('Carmen ya no tiene acceso al club. Su historia en el club se mantiene.')
    expect(screen.getByRole('heading', { level: 2, name: 'Miembros' })).toHaveFocus()
    expect(document.activeElement).not.toBe(document.body)
    // No longer an option for the curator.
    expect(within(curatorSelect()).queryByRole('option', { name: 'Carmen' })).not.toBeInTheDocument()
  })

  it('clears the curator when revoking Jordi', async () => {
    const { user, dialog } = await openDialog('Jordi')
    await user.click(within(dialog).getByRole('button', { name: 'Retirar el acceso' }))
    await waitFor(() => expect(region('Curaduría')).toHaveTextContent('Ahora no hay nadie en la curaduría.'))
    expect(curatorSelect()).toHaveValue('')
    expect(names(revokedGroup())).toEqual(['Jordi', 'Tomás'])
  })

  it('shows an alert in the dialog when the call fails, and changes nothing', async () => {
    const { user, dialog } = await openDialog('Carmen', { failures: { revokeMember: 1 } })
    await user.click(within(dialog).getByRole('button', { name: 'Retirar el acceso' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('No se ha podido retirar el acceso a Carmen.')
    expect(within(dialog).getByRole('button', { name: 'Retirar el acceso' })).toHaveFocus()
    expect(names(activeGroup())).toContain('Carmen')
  })
})

describe('Giving access back', () => {
  it('calls restoreMember once with no confirmation and moves Tomás to the active group', async () => {
    const user = userEvent.setup()
    const { calls } = await openPage()
    await user.click(screen.getByRole('button', { name: 'Devolver el acceso a Tomás' }))
    await waitFor(() => expect(names(activeGroup())).toContain('Tomás'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(revokedGroup()).not.toBeInTheDocument()
    expect(status('Miembros')).toBe('Tomás vuelve a tener acceso al club.')
    expect(screen.getByRole('button', { name: 'Retirar el acceso a Tomás' })).toHaveFocus()
    expect(calls('restoreMember')).toBe(1)
  })

  it('shows an alert next to the button when the call fails', async () => {
    const user = userEvent.setup()
    await openPage({ failures: { restoreMember: 1 } })
    await user.click(screen.getByRole('button', { name: 'Devolver el acceso a Tomás' }))
    expect(await within(entry('Tomás')).findByRole('alert')).toHaveTextContent('No se ha podido devolver el acceso a Tomás.')
    expect(names(revokedGroup())).toEqual(['Tomás'])
  })
})

describe('Curaduría', () => {
  it('says who the curator is, with the select pre-selected and a hint', async () => {
    await openPage()
    expect(region('Curaduría')).toHaveTextContent('Ahora la curaduría es de Jordi.')
    expect(curatorSelect()).toHaveValue('m6')
    expect(within(curatorSelect()).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Sin curaduría',
      'Carmen',
      'Elena',
      'Inés',
      'Jordi',
      'Lucía',
      'Mateo',
      'Pablo',
    ])
    expect(curatorSelect()).toHaveAccessibleDescription(expect.stringContaining('sin permisos de administración'))
  })

  it('notes that the open vote keeps its curator in the history', async () => {
    await openPage()
    await waitFor(() => expect(region('Curaduría')).toHaveTextContent('Hay una votación abierta'))
    expect(region('Curaduría')).toHaveTextContent('en el historial seguirá constando con la curaduría de Jordi')
  })

  it('has no vote note in the empty club', async () => {
    const { calls } = await openPage({ state: createEmptyState() })
    await waitFor(() => expect(calls('getVotes')).toBe(1))
    expect(region('Curaduría')).not.toHaveTextContent('Hay una votación abierta')
  })

  it('changes the curator with one call and a polite status', async () => {
    const user = userEvent.setup()
    const { calls, state } = await openPage()
    await user.selectOptions(curatorSelect(), 'Carmen')
    await user.click(saveCurator())
    expect(await screen.findByText('La curaduría es ahora de Carmen.')).toHaveAttribute('role', 'status')
    expect(region('Curaduría')).toHaveTextContent('Ahora la curaduría es de Carmen.')
    expect(names(activeGroup())).toContain('Carmen · Curaduría actual')
    expect(names(activeGroup())).toContain('Jordi')
    expect(saveCurator()).toHaveFocus()
    expect(calls('setCurator')).toBe(1)
    expect(state.curatorId).toBe('m3')
  })

  it('clears the curator with «Sin curaduría»', async () => {
    const user = userEvent.setup()
    const { state } = await openPage()
    await user.selectOptions(curatorSelect(), 'Sin curaduría')
    await user.click(saveCurator())
    expect(await within(region('Curaduría')).findByRole('status')).toHaveTextContent('Ahora no hay nadie en la curaduría.')
    expect(state.curatorId).toBeNull()
    expect(names(activeGroup())).toContain('Jordi')
  })

  it('makes no call when saving the same value', async () => {
    const user = userEvent.setup()
    const { calls } = await openPage()
    await user.click(saveCurator())
    expect(status('Curaduría')).toBe('No hay cambios: la curaduría sigue siendo de Jordi.')
    expect(calls('setCurator')).toBe(0)
    expect(region('Curaduría')).toHaveTextContent('Ahora la curaduría es de Jordi.')
  })

  it('disables only its button while saving, and shows an alert when the call fails', async () => {
    const user = userEvent.setup()
    const held = holdCalls(createMockClient({ failures: { setCurator: 1 } }), 'setCurator')
    await openPage({ client: held.client })
    await user.selectOptions(curatorSelect(), 'Carmen')
    await user.click(saveCurator())
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
    expect(addButton()).toBeEnabled()
    held.release()
    expect(await within(region('Curaduría')).findByRole('alert')).toHaveTextContent('No se ha podido guardar la curaduría.')
    expect(curatorSelect()).toHaveValue('m3')
    expect(region('Curaduría')).toHaveTextContent('Ahora la curaduría es de Jordi.')
  })

  it('lets the admin assign herself in the empty club', async () => {
    const user = userEvent.setup()
    await openPage({ state: createEmptyState() })
    await user.selectOptions(curatorSelect(), 'Lucía')
    await user.click(saveCurator())
    expect(await screen.findByText('La curaduría es ahora de Lucía.')).toBeInTheDocument()
    expect(names(activeGroup())).toEqual(['Lucía (tú) · Administración · Curaduría actual'])
  })
})

describe('When the list changed meanwhile, or access is refused', () => {
  // Changes the shared mock state behind the page's back.
  const revokeBehind = (state: MockState, id: string) => {
    const member = state.members.find((m) => m.id === id)!
    state.members = state.members.filter((m) => m !== member)
    state.revokedMembers.push(member)
    state.accounts[id].revokedAt = state.now
  }

  it('says the list changed and reloads it after a 409 on revoking', async () => {
    const user = userEvent.setup()
    const { state, calls } = await openPage()
    revokeBehind(state, 'm3')
    await user.click(screen.getByRole('button', { name: 'Retirar el acceso a Carmen' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Retirar el acceso' }))
    await waitFor(() => expect(names(revokedGroup())).toEqual(['Carmen', 'Tomás']))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(status('Miembros')).toBe(ADMIN_LIST_CHANGED)
    expect(calls('getAdminMembers')).toBe(2)
    expect(document.activeElement).not.toBe(document.body)
  })

  it('says the list changed and reloads it after a 409 on restoring', async () => {
    const user = userEvent.setup()
    const { state, calls } = await openPage()
    const tomas = state.revokedMembers.pop()!
    state.members.push(tomas)
    await user.click(screen.getByRole('button', { name: 'Devolver el acceso a Tomás' }))
    await waitFor(() => expect(calls('getAdminMembers')).toBe(2))
    await waitFor(() => expect(revokedGroup()).not.toBeInTheDocument())
    expect(status('Miembros')).toBe(ADMIN_LIST_CHANGED)
  })

  it('reloads after a 404 on the curator? No: a revoked choice gives an alert, and the list stays', async () => {
    const user = userEvent.setup()
    const { state } = await openPage()
    revokeBehind(state, 'm3')
    await user.selectOptions(curatorSelect(), 'Carmen')
    await user.click(saveCurator())
    expect(await within(region('Curaduría')).findByRole('alert')).toHaveTextContent('No se ha podido guardar la curaduría.')
    expect(names(activeGroup())).toContain('Carmen')
  })

  it('shows the guard’s message after a 403 on an action', async () => {
    const user = userEvent.setup()
    const { state } = await openPage()
    state.members.find((m) => m.id === 'm1')!.role = 'member'
    await user.selectOptions(curatorSelect(), 'Carmen')
    await user.click(saveCurator())
    const heading = await screen.findByRole('heading', { level: 1, name: 'Sección reservada' })
    expect(screen.getByText('Esta sección es solo para la administración del club.')).toBeInTheDocument()
    expect(heading).toHaveFocus()
    expect(screen.queryByRole('heading', { name: 'Miembros y curaduría' })).not.toBeInTheDocument()
    expect(state.curatorId).toBe('m6')
  })

  it('shows the guard’s message after a 403 on revoking', async () => {
    const user = userEvent.setup()
    const { state } = await openPage()
    state.members.find((m) => m.id === 'm1')!.role = 'member'
    await user.click(screen.getByRole('button', { name: 'Retirar el acceso a Carmen' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Retirar el acceso' }))
    expect(await screen.findByText('Esta sección es solo para la administración del club.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(state.revokedMembers.map((m) => m.id)).toEqual(['m8'])
  })

  it('goes to the sign-in screen after a 401 on an action', async () => {
    const user = userEvent.setup()
    const { state } = await openPage()
    state.session = 'anonymous'
    await user.type(idField(), '12345678901234567')
    await user.type(nameField(), 'Nora')
    await user.click(addButton())
    expect(await screen.findByRole('button', { name: 'Entrar con Discord' })).toBeInTheDocument()
    expect(state.members.map((m) => m.displayName)).not.toContain('Nora')
  })
})

describe('Effects elsewhere, through the UI', () => {
  it('shows a member added here in Miembros', async () => {
    const user = userEvent.setup()
    const { router } = await openPage()
    await user.type(idField(), '12345678901234567')
    await user.type(nameField(), 'Nora')
    await user.click(addButton())
    await screen.findByText('Nora ya puede entrar al club con Discord.')
    await router.navigate('/miembros')
    expect(await screen.findByRole('link', { name: /Nora/ })).toBeInTheDocument()
  })
})
