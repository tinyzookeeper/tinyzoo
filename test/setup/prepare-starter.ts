import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot } from './database'

/**
 * Global setup for the unit suites.
 *
 * Specs that import an app's `cms.config.ts` (the starter's, the playground's) or its files (the
 * website's docs, Keeper's shared code) make Vite look up that app's tsconfig, which only points at
 * `.nuxt/tsconfig.*.json` — files `nuxt prepare` (or a dev server) writes. A fresh clone (CI, where
 * the unit tests run in a job of their own, without `pnpm typecheck` before them) has none: prepare
 * each app that lacks them, all at once, as test/setup/build-playground.mjs does for the playground.
 * A developer's existing `.nuxt` is left alone.
 */
const apps = ['packages/cms/starter', 'playground', 'site', 'keeper']

function prepare(dir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['exec', 'nuxt', 'prepare'], { cwd: join(repoRoot, dir), stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`\`nuxt prepare\` failed in ${dir}`))))
  })
}

export default async function setup() {
  const missing = apps.filter((dir) => !existsSync(join(repoRoot, dir, '.nuxt', 'tsconfig.app.json')))
  await Promise.all(missing.map(prepare))
}
