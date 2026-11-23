// Production-builds the playground into a scratch dir, so the API suites run against
// the same Nitro output a deploy would ship — without touching playground/.nuxt or
// playground/.output (a developer's own dev server or build stays as it was).
//
//   node test/setup/build-playground.mjs <rootDir> <buildDir> <outputDir>
//
// Runs in its own process: Nuxt's build pulls in Vite, which does not belong
// inside the Vitest process that will run the specs.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'

const [rootDir, buildDir, outputDir] = process.argv.slice(2)
if (!rootDir || !buildDir || !outputDir) {
  console.error('usage: build-playground.mjs <rootDir> <buildDir> <outputDir>')
  process.exit(2)
}

// Tailwind's CSS resolver looks packages up relative to the working directory, so the
// build must run from inside the app, exactly as `nuxt build` would.
process.chdir(rootDir)

// The app's tsconfig.json points at .nuxt/tsconfig.*.json, which the build reads (Vue's
// TypeScript support parses it) but only `nuxt prepare` or a dev server writes. On a fresh
// clone (CI) they don't exist yet: prepare once. A developer's existing .nuxt is left alone.
if (!existsSync(join(rootDir, '.nuxt', 'tsconfig.server.json'))) {
  const prep = spawnSync('pnpm', ['exec', 'nuxt', 'prepare'], { cwd: rootDir, stdio: 'inherit' })
  if (prep.status !== 0) process.exit(prep.status ?? 1)
}

// Resolve Nuxt from the host app, not from here — the root workspace does not depend on it.
const require = createRequire(join(rootDir, 'package.json'))
const { loadNuxt, buildNuxt } = await import(pathToFileURL(require.resolve('nuxt/kit')).href)

// The scheduled tasks' cron is a build-time option; the tests run them every second or so
// (test/setup/timers.ts, BUILD_CRON). Unset, the playground's own (the defaults) stay.
const cron = (name) => (process.env[name] ? { cron: process.env[name] } : undefined)

// The smaller-copies task has no cron option (it is every minute); the tests add it on a short one of its own.
const mediaCron = process.env.CMS_TEST_MEDIA_SIZES_CRON

const nuxt = await loadNuxt({
  cwd: rootDir,
  dev: false,
  overrides: {
    buildDir,
    nitro: { output: { dir: outputDir }, ...(mediaCron ? { scheduledTasks: { [mediaCron]: ['cms:media-sizes'] } } : {}) },
    devtools: { enabled: false },
    cms: { scheduler: cron('CMS_TEST_SCHEDULER_CRON'), retention: cron('CMS_TEST_RETENTION_CRON') },
  },
})
await buildNuxt(nuxt)
await nuxt.close()
