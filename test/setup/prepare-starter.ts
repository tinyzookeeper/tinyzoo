import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot } from './database'

/**
 * Global setup for the unit suites.
 *
 * Specs that import the starter's `cms.config.ts` make Vite look up the starter's
 * tsconfig, which only points at `.nuxt/tsconfig.*.json` — files `nuxt prepare` (or a dev
 * server) writes. A fresh clone (CI) has none: prepare once, as test/setup/build-playground.mjs
 * does for the playground. A developer's existing `.nuxt` is left alone.
 */
export default function setup() {
  const starter = join(repoRoot, 'packages/cms/starter')
  if (existsSync(join(starter, '.nuxt', 'tsconfig.app.json'))) return
  const prep = spawnSync('pnpm', ['exec', 'nuxt', 'prepare'], { cwd: starter, stdio: 'inherit' })
  if (prep.status !== 0) throw new Error('`nuxt prepare` failed in packages/cms/starter')
}
