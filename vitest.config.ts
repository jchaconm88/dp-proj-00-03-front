import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      WEBHOOK_SECRET: 'dev-webhook-secret',
    },
    include: ['tests/**/*.{test,property,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/lib/**/*.ts'],
    },
    testTimeout: 30000,
  },
})
