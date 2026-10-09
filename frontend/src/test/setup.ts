import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// Role queries with an accessible name walk the whole page in jsdom, which is
// slow on a cold or busy machine; the 1000 ms default made findBy* flaky.
configure({ asyncUtilTimeout: 5000 })

afterEach(() => cleanup())
