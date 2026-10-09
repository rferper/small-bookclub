import type { CurrentUser, HomeData } from './types'

// The only way components talk to the backend. Today the app uses the mock
// implementation; an HTTP implementation will replace it once the backend
// exists, without changing any component.
export interface ApiClient {
  getCurrentUser(): Promise<CurrentUser>
  getHome(): Promise<HomeData>
  setWeekCompleted(weekId: string, completed: boolean): Promise<void>
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
