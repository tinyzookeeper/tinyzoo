// Production-builds the playground for one runtime into node_modules/.cache, so a
// build check never touches playground/.nuxt or playground/.output.
//
//   node scripts/build-check.mjs node   # Node server (Pushbase, Docker, any VM)
//   node scripts/build-check.mjs edge   # Cloudflare Workers (Neon over WebSocket)
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const target = process.argv[2]
const presets = {
  node: { NITRO_PRESET: 'node-server', CMS_DB_DRIVER: 'node' },
  edge: { NITRO_PRESET: 'cloudflare_module', CMS_DB_DRIVER: 'edge' },
}
if (!presets[target]) {
  console.error('usage: build-check.mjs <node|edge>')
  process.exit(2)
}

const root = join(import.meta.dirname, '..')
const cache = join(root, 'node_modules/.cache', `cms-build-${target}`)
const res = spawnSync(process.execPath, [
  join(root, 'test/setup/build-playground.mjs'),
  join(root, 'playground'),
  join(cache, 'nuxt'),
  join(cache, 'output'),
], { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production', ...presets[target] } })
if (res.status === 0) console.log(`✓ ${target} build → ${join(cache, 'output')}`)
process.exit(res.status ?? 1)
