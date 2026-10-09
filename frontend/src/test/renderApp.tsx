import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { ApiProvider } from '../api/ApiContext'
import type { ApiClient } from '../api/client'
import { createMockClient } from '../api/mock/mockClient'
import { routes } from '../routes'

// Renders the real routes at `path` with the given API client. Returns the
// router too, so tests can check the current URL.
export function renderApp({ path = '/', client = createMockClient({ random: () => 0 }) }: { path?: string; client?: ApiClient } = {}) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const result = render(
    <ApiProvider client={client}>
      <RouterProvider router={router} />
    </ApiProvider>,
  )
  return { ...result, router }
}
