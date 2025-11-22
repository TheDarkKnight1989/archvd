// @ts-nocheck
/**
 * Vitest Test Setup
 * Global test configuration and mocks
 */

import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock Next.js environment
global.fetch = fetch
