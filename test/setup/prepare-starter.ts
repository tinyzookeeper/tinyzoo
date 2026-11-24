import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot } from './database'

/**
 * Global setup for the unit suites.
 *
 * Specs that import an app's `cms.config.ts` (the starter's, the playground's) or its files (the
 * website's docs, Keeper's shared code) make Vite look up that app's tsconfig, which only points at
 * `.nuxt/tsconfig.*.json` — files `nuxt prepare` (or a dev server) writes. A fresh clone (CI, where
 * the unit tests run in a job of their own, without `pnpm typecheck` before them) has none: prepare
 * each app that lacks them, a few at a time, as test/setup/build-playground.mjs does for the playground.
 * A developer's existing `.nuxt` is left alone.
 *
 * The hosted templates are apps too (templates/<id>, each with such a tsconfig): the specs of the
 * cloud's registry and of the templates' kit load every template's looks.ts.
 */
const templates = readdirSync(join(repoRoot, 'templates'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(repoRoot, 'templates', entry.name, 'tsconfig.json')))
  .map((entry) => `templates/${entry.name}`)
const apps = ['packages/cms/starter', 'playground', 'site', 'keeper', 'cloud', ...templates]
/** How many `nuxt prepare` run at once: each is a Node process of a few hundred MB. */
const AT_ONCE = 6

function prepare(dir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['exec', 'nuxt', 'prepare'], { cwd: join(repoRoot, dir), stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`\`nuxt prepare\` failed in ${dir}`))))
  })
}

export default async function setup() {
  const missing = apps.filter((dir) => !existsSync(join(repoRoot, dir, '.nuxt', 'tsconfig.app.json')))
  const next = missing[Symbol.iterator]()
  await Promise.all(Array.from({ length: AT_ONCE }, async () => {
    for (const dir of next) await prepare(dir)
  }))
}
