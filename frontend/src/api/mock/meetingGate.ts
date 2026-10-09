// The spoiler gate for meeting summaries and highlights (§5.3, §5.8). It
// mirrors the backend gating function (#29): the mock calls it on every
// request, for the signed-in user, and leaves locked data out of responses.

export type MeetingGate =
  | { visible: true }
  | { visible: false; reason: 'weekNotRead'; weekNumber: number }
  | { visible: false; reason: 'noWeek' }

export interface MeetingGateInput {
  // The reading week linked to the meeting, if any.
  week: { id: string; weekNumber: number } | null
  // Whether the admin marked a meeting without a linked week as safe.
  markedSafe: boolean
  // weekId -> ids of the members who marked it read.
  completions: Record<string, string[]>
  userId: string
}

// The admin gets the same answer as a member in the same situation: on
// member-facing pages nobody bypasses the gate (docs/decisions.md, #65).
export function meetingGate({ week, markedSafe, completions, userId }: MeetingGateInput): MeetingGate {
  if (week) {
    return (completions[week.id] ?? []).includes(userId)
      ? { visible: true }
      : { visible: false, reason: 'weekNotRead', weekNumber: week.weekNumber }
  }
  return markedSafe ? { visible: true } : { visible: false, reason: 'noWeek' }
}
