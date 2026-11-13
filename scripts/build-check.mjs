// Production-builds the playground into node_modules/.cache, so a build check never
// touches playground/.nuxt or playground/.output.
//
//   node scripts/build-check.mjs
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const cache = join(root, 'node_modules/.cache', 'cms-build-node')
const res = spawnSync(process.execPath, [
  join(root, 'test/setup/build-playground.mjs'),
  join(root, 'playground'),
  join(cache, 'nuxt'),
  join(cache, 'output'),
], { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production', NITRO_PRESET: 'node-server' } })
if (res.status === 0) console.log(`✓ build → ${join(cache, 'output')}`)
process.exit(res.status ?? 1)
