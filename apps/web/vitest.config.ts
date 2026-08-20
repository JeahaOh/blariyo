import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'tests/admin-auth.unit.test.ts',
      'tests/admin-post.unit.test.ts',
      'tests/public-bff.e2e.test.ts',
    ],
    testTimeout: 15000,
    hookTimeout: 120000,
  },
})
