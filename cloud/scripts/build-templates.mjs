// Build the templates the local hosting driver runs. One build of a template serves any
// number of sites (everything per site comes from the environment at start).
//
//   pnpm --filter tinyzoo-cloud templates:build
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
// The ready templates of shared/templates.ts: [id, workspace package, source folder].
const templates = [['basic', 'tinyzoo-starter', 'packages/cms/starter']]

for (const [id, pkg, dir] of templates) {
  console.log(`\n▸ ${id}: pnpm --filter ${pkg} build`)
  const res = spawnSync('pnpm', ['--filter', pkg, 'build'], { cwd: root, stdio: 'inherit' })
  const entry = join(root, dir, '.output', 'server', 'index.mjs')
  if (res.status !== 0 || !existsSync(entry)) {
    console.error(`\n✗ ${id} did not build (${entry} is missing)`)
    process.exit(1)
  }
  console.log(`✓ ${id}: ${entry}`)
}
