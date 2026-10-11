import type { ApiResult } from './client'
import { createTransport } from './transport'

// Compiled but never executed: @ts-expect-error fails if the boundary weakens.
export async function transportBoundaries() {
  const request = createTransport()
  const result: ApiResult<'getHealth'> = await request<'getHealth'>({ method: 'GET', path: '/api/health', successStatus: 200 })
  // @ts-expect-error Health result has no member identity.
  console.log(result.user)
  // @ts-expect-error Required query is controlled by the operation.
  request<'searchBookMetadata'>({ method: 'GET', path: '/api/admin/book-metadata', successStatus: 200 })
  // @ts-expect-error Path ids are required and typed.
  request<'getBook'>({ method: 'GET', path: '/api/books/{bookId}', successStatus: 200, pathParams: { bookId: 42 } })
  // @ts-expect-error Completion is a boolean generated request field.
  request<'setWeekCompleted'>({ method: 'PUT', path: '/api/weeks/{weekId}/completion', pathParams: { weekId: 'fiction' }, successStatus: 204, body: { completed: 'true' } })
  // @ts-expect-error Success status must be declared on the operation.
  request<'getHealth'>({ method: 'GET', path: '/api/health', successStatus: 201 })
  // @ts-expect-error Multipart never serializes Files into JSON metadata.
  request<'updateMyProfile'>({ method: 'PUT', path: '/api/me/profile', successStatus: 200, body: { displayName: 'fiction' } })
  // @ts-expect-error OAuth redirect handoff is not a JSON operation.
  request<'startSignIn'>({ method: 'GET', path: '/api/auth/discord/start', successStatus: 302 })
}
