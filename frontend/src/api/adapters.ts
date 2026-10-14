import { ApiError } from './client'
import type { components, operations } from './generated'
import type { BookInput, ClubExport, ProfileUpdate } from './types'

// Browser File is a multipart byte part, never serialized into metadata JSON.
export function profileMultipart(input: ProfileUpdate): components['schemas']['ProfileMultipart'] {
  const metadata: components['schemas']['ProfileMetadata'] = {
    displayName: input.displayName, bio: input.bio, favouriteQuote: input.favouriteQuote,
    favouriteBookIds: input.favouriteBookIds, avatarAction: input.avatar.action,
  }
  return input.avatar.action === 'replace' ? { metadata, avatar: input.avatar.file } : { metadata }
}

export function bookMultipart(input: BookInput): components['schemas']['BookMultipart'] {
  const { cover, ...fields } = input
  const metadata: components['schemas']['BookMetadataInput'] = {
    ...fields, coverAction: cover.action,
    ...(cover.action === 'metadata' ? { metadataResultId: cover.resultId } : {}),
  }
  return cover.action === 'replace' ? { metadata, cover: cover.file } : { metadata }
}

export function multipartFormData(parts: components['schemas']['ProfileMultipart'] | components['schemas']['BookMultipart']): FormData {
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(parts.metadata)], { type: 'application/json' }))
  if ('avatar' in parts && parts.avatar) form.append('avatar', parts.avatar)
  if ('cover' in parts && parts.cover) form.append('cover', parts.cover)
  return form
}

// Top-level OAuth navigation has no JSON result. Mock resolves void after session simulation.
export type OAuthHandoff = operations['startSignIn']['responses'][302]
export type ProductionExport = operations['exportClubData']['responses'][200]['content']['application/zip']
export function mockDownload(filename: string, json: string): Extract<ClubExport, { json: string }> { return { filename, json } }

// Existing callers may keep constructing ApiError(status,message).
const errorCodes: Record<number, components['schemas']['Error']['code']> = {
  400: 'invalid_input', 401: 'unauthenticated', 403: 'forbidden', 404: 'not_found',
  409: 'conflict', 429: 'rate_limited', 500: 'internal_error', 503: 'service_unavailable',
}
export function errorEnvelope(error: ApiError): components['schemas']['Error'] {
  return { code: error.code ?? errorCodes[error.status] ?? 'internal_error', message: error.message }
}
export function apiError(status: number, body: components['schemas']['Error']): ApiError {
  return new ApiError(status, body.message, body.code)
}
