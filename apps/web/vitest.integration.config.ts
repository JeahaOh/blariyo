import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/core-bff.integration.ts'],
    testTimeout: 15000,
    hookTimeout: 120000,
  },
})
