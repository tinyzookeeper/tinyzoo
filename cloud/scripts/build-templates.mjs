// Build the templates the local hosting driver runs. One build of a template serves any
// number of sites (everything per site comes from the environment at start).
//
//   pnpm --filter tinyzoo-cloud templates:build
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { BUILT_TEMPLATES, repoRoot as root } from './lib.mjs'

// The ready templates of shared/templates.ts: [id, workspace package, source folder].
const all = BUILT_TEMPLATES.map((t) => [t.id, t.pkg, t.dir])
// `templates:build photographer` builds only the ones named.
const only = process.argv.slice(2)
const templates = only.length ? all.filter(([id]) => only.includes(id)) : all
if (!templates.length) {
  console.error(`No such template: ${only.join(', ')} (there are: ${all.map(([id]) => id).join(', ')})`)
  process.exit(2)
}

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
