import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// RTL auto-cleanup does not reliably register under Vitest without `globals`,
// so unmount between tests explicitly to avoid DOM accumulation across `it`s.
afterEach(() => cleanup())
