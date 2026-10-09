import type { MemberSummary } from '../api/types'
import { initials } from '../lib/format'

export function Avatar({ member, size = 40 }: { member: MemberSummary; size?: number }) {
  const style = { width: size, height: size }
  if (member.avatarUrl) {
    return <img src={member.avatarUrl} alt={`Foto de ${member.displayName}`} style={style} className="rounded-full object-cover" />
  }
  return (
    <span
      aria-hidden="true"
      style={style}
      className="inline-flex items-center justify-center rounded-full bg-sage font-serif text-forest"
    >
      {initials(member.displayName)}
    </span>
  )
}
