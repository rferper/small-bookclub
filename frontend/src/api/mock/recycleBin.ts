import { ApiError } from '../client'
import type { DeletedType, RecycleBinEntry } from '../types'
import type { DeletionMetadata, MockState, MockWeek } from './fixtures'
import { quoteKey } from '../../lib/literary'
import { bookVisible, hasVisibleBook, meetingVisible } from './visibility'

const types: DeletedType[] = ['book', 'meeting', 'quote', 'week', 'highlight']
const conflict = (message: string): never => { throw new ApiError(409, message) }

export function recycleBin(state: MockState) {
  const check = (type: DeletedType, id: string) => {
    if (!types.includes(type) || typeof id !== 'string' || !id.trim()) throw new ApiError(400, 'Selecciona un tipo y un identificador válidos.')
  }
  const targets = () => [
    ...state.books.map((item) => ({ type: 'book' as const, item, label: `Libro: ${item.title}` })),
    ...state.meetings.map((item) => ({ type: 'meeting' as const, item, label: `Reunión: ${item.startsAt}` })),
    ...state.quotes.map((item) => ({ type: 'quote' as const, item, label: `Cita: ${item.text}` })),
    ...state.weeks.map((item) => ({ type: 'week' as const, item, label: `Semana ${item.weekNumber}: ${state.books.find((b) => b.id === item.bookId)?.title ?? 'Libro retirado'}` })),
    ...state.meetings.flatMap((meeting) => meeting.highlights.map((item) => ({ type: 'highlight' as const, item, label: `Momento destacado: ${item.text.slice(0, 160)}` }))),
  ]
  const find = (type: DeletedType, id: string, deleted: boolean) => {
    check(type, id)
    const target = targets().find((target) => target.type === type && target.item.id === id && Boolean(target.item.deletedAt) === deleted)
    if (!target) throw new ApiError(404, 'Este contenido ya no está disponible en esta lista.')
    return target
  }
  const dependencies = (type: DeletedType, id: string): string[] => {
    if (type === 'book') {
      const weeks = state.weeks.filter((w) => w.bookId === id)
      const meetings = state.meetings.filter((m) => m.bookId === id)
      const votes = state.votes.filter((v) => v.candidates.some((c) => c.bookId === id) || (v.outcome && ('winnerBookId' in v.outcome ? v.outcome.winnerBookId === id : v.outcome.tiedBookIds.includes(id))))
      const book = state.books.find((b) => b.id === id)!
      return [
        `${weeks.length} semanas retenidas${weeks.length ? ` (${weeks.map((w) => `semana ${w.weekNumber}`).join(', ')})` : ''}.`,
        `${weeks.reduce((n, w) => n + (state.completions[w.id]?.length ?? 0), 0)} marcas de lectura semanal; ${state.reviews.filter((r) => r.bookId === id).length} valoraciones; ${state.finished[id]?.length ?? 0} marcas de libro terminado.`,
        `${meetings.length} reuniones retenidas${meetings.length ? ` (${meetings.map((m) => m.startsAt).join(', ')})` : ''}.`,
        `${votes.length} referencias de votación${votes.length ? ` (${votes.map((v) => v.id).join(', ')})` : ''}; ${book.originVote ? `origen: ${book.originVote.id}; ` : ''}${Object.values(state.profiles).filter((p) => p.favouriteBookIds.includes(id)).length} referencias de favoritos.`,
      ]
    }
    if (type === 'meeting') {
      const meeting = state.meetings.find((m) => m.id === id)!
      const weeks = state.weeks.filter((w) => w.meetingId === id)
      return [ `${meeting.attendance?.length ?? 0} asistentes registrados.`, `${meeting.summary ? 1 : 0} resumen; ${meeting.highlights.length} momentos destacados retenidos.`, `Semana vinculada: ${weeks.map((w) => `${w.weekNumber} (${w.id})`).join(', ') || 'ninguna'}.` ]
    }
    if (type === 'week') {
      const week = state.weeks.find((w) => w.id === id)!
      return [`${state.completions[id]?.length ?? 0} marcas de lectura; reunión vinculada: ${week.meetingId ?? 'ninguna'}.`]
    }
    return []
  }
  const list = (): RecycleBinEntry[] => targets().filter(({ item }) => item.deletedAt).map(({ type, item, label }) => ({
    type, id: item.id, label, deletedAt: item.deletedAt!, purgeDueAt: item.purgeDueAt!,
    deletedByName: [...state.members, ...state.revokedMembers].find((m) => m.id === item.deletedBy)?.displayName ?? 'Miembro retirado',
    expired: Date.parse(state.now) >= Date.parse(item.purgeDueAt!), dependencies: dependencies(type, item.id),
  })).sort((a, b) => Date.parse(b.deletedAt) - Date.parse(a.deletedAt) || a.type.localeCompare(b.type) || a.id.localeCompare(b.id))
  const preview = (type: 'book' | 'meeting' | 'quote', id: string) => {
    if (!['book', 'meeting', 'quote'].includes(type)) throw new ApiError(400, 'Este tipo de contenido no admite eliminación aquí.')
    const target = find(type, id, false)
    if (type === 'meeting' && !meetingVisible(state, state.meetings.find((m) => m.id === id)!)) throw new ApiError(404, 'No existe esa reunión activa.')
    return { label: target.label, dependencies: dependencies(type, id) }
  }
  const remove = (type: 'book' | 'meeting' | 'quote', id: string) => {
    preview(type, id)
    Object.assign(find(type, id, false).item, { deletedAt: state.now, deletedBy: state.currentUserId, purgeDueAt: new Date(Date.parse(state.now) + 30 * 86400000).toISOString() })
    return list()
  }
  const validateLink = (week: MockWeek) => {
    if (!hasVisibleBook(state, week.bookId)) conflict('Restaura primero el libro de esta semana.')
    if (week.meetingId === null) return
    const meeting = state.meetings.find((m) => m.id === week.meetingId)
    if (!meeting || !meetingVisible(state, meeting)) conflict('Restaura primero la reunión vinculada.')
    if (meeting!.bookId !== week.bookId || state.weeks.some((w) => w.id !== week.id && w.meetingId === week.meetingId)) conflict('La asociación entre semana y reunión ya no cumple el mismo libro y la relación única. Revisa el enlace antes de restaurar.')
  }
  const restore = (type: DeletedType, id: string) => {
    const target = find(type, id, true)
    if (Date.parse(state.now) >= Date.parse(target.item.purgeDueAt!)) conflict('El plazo de recuperación ha terminado')
    if (type === 'book') {
      const book = state.books.find((b) => b.id === id)!
      if (book.status === 'leyendo' && state.books.some((b) => b.id !== id && bookVisible(b) && b.status === 'leyendo')) conflict('Ya hay otro libro Leyendo. Cambia su estado antes de restaurar este libro.')
    } else if (type === 'meeting') {
      const meeting = state.meetings.find((m) => m.id === id)!
      if (meeting.bookId !== null && !hasVisibleBook(state, meeting.bookId)) conflict('Restaura primero el libro de esta reunión.')
      const links = state.weeks.filter((w) => w.meetingId === id)
      if (links.length > 1 || links.some((w) => w.bookId !== meeting.bookId)) conflict('La asociación entre semana y reunión ya no cumple el mismo libro y la relación única. Revisa el enlace antes de restaurar.')
      // A removed linked week may remain removed: its canonical reservation
      // continues to lock records. Do not create a mutual recovery deadlock.
    } else if (type === 'week') validateLink(state.weeks.find((w) => w.id === id)!)
    else if (type === 'highlight') {
      const meeting = state.meetings.find((m) => m.highlights.some((h) => h.id === id))!
      if (!meetingVisible(state, meeting)) conflict('Restaura primero la reunión y su libro.')
    } else {
      const quote = state.quotes.find((q) => q.id === id)!
      if (state.quotes.some((q) => q.id !== id && quoteKey(q.text) === quoteKey(quote.text))) conflict('Ya existe una cita con este texto. Revisa la cita antes de restaurar.')
    }
    // All checks finish before any target or ordinal changes.
    if (type === 'week') {
      const week = state.weeks.find((w) => w.id === id)!
      const active = state.weeks.filter((w) => w.bookId === week.bookId && !w.deletedAt).sort((a, b) => a.weekNumber - b.weekNumber)
      active.splice(Math.max(0, Math.min(week.weekNumber - 1, active.length)), 0, week)
      active.forEach((w, i) => { w.weekNumber = i + 1 })
    }
    const item: DeletionMetadata = target.item
    delete item.deletedAt; delete item.deletedBy; delete item.purgeDueAt
    return list()
  }
  const purge = (type: DeletedType, id: string) => {
    find(type, id, true)
    let blocked = false
    if (type === 'book') {
      const book = state.books.find((b) => b.id === id)!
      blocked = state.weeks.some((w) => w.bookId === id) || state.meetings.some((m) => m.bookId === id) || state.reviews.some((r) => r.bookId === id) || !!state.finished[id]?.length || Object.values(state.profiles).some((p) => p.favouriteBookIds.includes(id)) || !!book.originVote || state.votes.some((v) => v.candidates.some((c) => c.bookId === id) || (v.outcome && ('winnerBookId' in v.outcome ? v.outcome.winnerBookId === id : v.outcome.tiedBookIds.includes(id))))
    } else if (type === 'meeting') {
      const meeting = state.meetings.find((m) => m.id === id)!
      blocked = state.weeks.some((w) => w.meetingId === id) || !!meeting.attendance?.length || !!meeting.highlights.length
    } else if (type === 'week') {
      blocked = !!state.completions[id]?.length || state.weeks.find((w) => w.id === id)!.meetingId !== null
    }
    if (blocked) conflict(`No se puede eliminar definitivamente: conserva historial o asociaciones dependientes. ${dependencies(type, id).join(' ')} Desvincula lo que proceda o restaura el contenido; no se elimina historial en cascada.`)
    if (type === 'book') state.books = state.books.filter((b) => b.id !== id)
    else if (type === 'meeting') state.meetings = state.meetings.filter((m) => m.id !== id)
    else if (type === 'week') { state.weeks = state.weeks.filter((w) => w.id !== id); delete state.completions[id] }
    else if (type === 'quote') state.quotes = state.quotes.filter((q) => q.id !== id)
    else for (const meeting of state.meetings) meeting.highlights = meeting.highlights.filter((h) => h.id !== id)
    state.tombstones ??= []
    state.tombstones.push({ type, id, purgedAt: state.now, purgedBy: state.currentUserId })
    return list()
  }
  return { list, preview, remove, restore, purge }
}
