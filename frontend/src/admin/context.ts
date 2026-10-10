import { createContext, useContext } from 'react'

export interface AdminAccess {
  // Called by an admin page when the server answers 403 (for example, the
  // role changed while the page was open): the guard shows its message.
  forbid: () => void
}

export const AdminAccessContext = createContext<AdminAccess | null>(null)

export function useAdminAccess(): AdminAccess {
  const value = useContext(AdminAccessContext)
  if (!value) throw new Error('useAdminAccess must be used inside <AdminGuard>.')
  return value
}
