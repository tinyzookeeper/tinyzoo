import { defineConfig } from 'vitest/config'

// Two projects:
//  - unit: pure functions of tinyzoo (descriptors, codegen, sanitiser, …). No DB, fast.
//  - api:  the built playground served over HTTP against its own `<db>_test` Postgres.
//          Files run one at a time — they share that database and truncate it.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/unit/**/*.spec.ts'],
          environment: 'node',
          globalSetup: ['test/setup/prepare-starter.ts'],
          // Server files loaded directly call Nitro's auto-imported site helpers as globals.
          setupFiles: ['test/setup/site-globals.ts'],
        },
      },
      {
        test: {
          name: 'api',
          include: ['test/api/**/*.spec.ts'],
          environment: 'node',
          globalSetup: ['test/setup/server.ts'],
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
})
