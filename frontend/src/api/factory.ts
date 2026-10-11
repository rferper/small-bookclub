import type { ApiClient } from './client'
import { createHttpClient } from './httpClient'
import { mockOptionsFromQuery } from './mock/devOptions'
import { createMockClient } from './mock/mockClient'

export const CONFIGURATION_ERROR = 'La configuración del servicio no es válida. Revisa la configuración antes de continuar.'

export function createApiClient(mode: string | undefined, search = ''): ApiClient {
  if (mode === 'http') return createHttpClient()
  if (mode === undefined || mode === 'mock') return createMockClient(mockOptionsFromQuery(search))
  throw new Error(CONFIGURATION_ERROR)
}
