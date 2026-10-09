import type { MeetingAssignment } from '../api/types'
import { formatPageRange, formatPercentRange } from '../lib/format'

// The reading assigned for a meeting. Percent and pages are independent
// facts, shown exactly as returned (§5.2).
export function MeetingReading({ assignment }: { assignment: MeetingAssignment }) {
  return (
    <span className="flex flex-wrap gap-x-3">
      <span className="font-semibold text-moss">Semana {assignment.weekNumber}</span>
      <span>{formatPercentRange(assignment.percentStart, assignment.percentEnd)}</span>
      <span>{formatPageRange(assignment.pageStart, assignment.pageEnd)}</span>
    </span>
  )
}
