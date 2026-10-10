import { CLUB_TIMEZONE } from './format'

export function meetingLocalValues(iso: string, timeZone = CLUB_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso))
  const part = (type: string) => parts.find((p) => p.type === type)!.value
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` }
}

// Derive zone offsets from Intl, never the browser timezone. Sampling both
// sides of the local date also detects the two possible instants at a DST fold.
export function meetingInstant(date: string, time: string, timeZone = CLUB_TIMEZONE): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error('Introduce una fecha y una hora válidas.')
  const wall = Date.parse(`${date}T${time}:00Z`)
  if (!Number.isFinite(wall) || date.startsWith('0000') || new Date(wall).toISOString().slice(0, 16) !== `${date}T${time}`) throw new Error('Introduce una fecha y una hora válidas.')
  const offsets = new Set<number>()
  for (const hours of [-36, -12, 0, 12, 36]) {
    const sample = wall + hours * 3600000
    const local = meetingLocalValues(new Date(sample).toISOString(), timeZone)
    offsets.add(Date.parse(`${local.date}T${local.time}:00Z`) - sample)
  }
  const matches = [...offsets].map((offset) => wall - offset).filter((instant) => {
    const local = meetingLocalValues(new Date(instant).toISOString(), timeZone)
    return local.date === date && local.time === time
  })
  if (!matches.length) throw new Error('Esta hora no existe por el cambio de horario. Elige otra hora.')
  if (matches.length > 1) throw new Error('Esta hora es ambigua por el cambio de horario. Elige otra hora.')
  return new Date(matches[0]).toISOString()
}
