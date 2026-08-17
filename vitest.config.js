import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.mjs'],
    // The end-to-end tests spawn openspec and dev-browser; give them room.
    testTimeout: 60_000,
  },
})
