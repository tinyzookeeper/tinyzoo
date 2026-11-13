// Installability check: pack tinyzoo and @tinyzoo/client, install them from the
// tarballs into a fresh app outside the workspace (no workspace links), generate the
// schema and typed client with the `tinyzoo` CLI, typecheck and production-build the app.
//
//   node scripts/consumer-check.mjs
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const work = mkdtempSync(join(tmpdir(), 'cms-consumer-'))
const packs = join(work, 'packs')
const app = join(work, 'app')
const run = (cmd, args, cwd, env = {}) => execFileSync(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } })

try {
  mkdirSync(packs, { recursive: true })
  run('pnpm', ['pack', '--pack-destination', packs], join(root, 'packages/cms'))
  run('pnpm', ['pack', '--pack-destination', packs], join(root, 'packages/client'))
  const tgz = (prefix) => join(packs, readdirSync(packs).find((f) => f.startsWith(prefix)))

  cpSync(join(root, 'test/consumer'), app, { recursive: true })
  cpSync(join(root, 'playground/cms.config.ts'), join(app, 'cms.config.ts'))
  mkdirSync(join(app, 'server/db'), { recursive: true })
  cpSync(join(root, 'playground/drizzle.config.ts'), join(app, 'drizzle.config.ts'))
  const pg = JSON.parse(readFileSync(join(root, 'playground/package.json'), 'utf8'))
  const dep = (name) => pg.dependencies?.[name] ?? pg.devDependencies?.[name]
  writeFileSync(join(app, 'package.json'), JSON.stringify({
    name: 'cms-consumer-check', private: true, type: 'module',
    dependencies: {
      'tinyzoo': `file:${tgz('tinyzoo-0')}`,
      '@tinyzoo/client': `file:${tgz('tinyzoo-client-')}`,
      ...Object.fromEntries(['@nuxt/ui', 'nuxt', 'nuxt-auth-utils', 'tailwindcss', 'drizzle-orm', 'pg', 'zod'].map((n) => [n, dep(n)])),
    },
    devDependencies: { ...Object.fromEntries(['@iconify-json/lucide', 'drizzle-kit', 'typescript', 'vue-tsc'].map((n) => [n, dep(n)])), '@types/node': '^22.0.0' },
    // One copy of the editor stack, as in the workspace (see pnpm-workspace.yaml).
    pnpm: { overrides: { '@tiptap/core': '3.34.0', '@tiptap/pm': '3.34.0', 'prosemirror-model': '^1.25.13', 'prosemirror-state': '^1.4.4', 'prosemirror-view': '^1.41.0' } },
  }, null, 2))

  run('pnpm', ['install', '--ignore-workspace', '--no-frozen-lockfile'], app)
  // The CLI works from the installed package: schema + typed client.
  run('pnpm', ['exec', 'tinyzoo', 'client', 'app/lib/cms-content.ts'], app)
  run('pnpm', ['exec', 'tsx', '-e', "import * as c from './cms.config.ts'; import { emitSchema } from 'tinyzoo'; import { writeFileSync } from 'node:fs'; writeFileSync('server/db/schema.ts', emitSchema(c))"], app)
  // The layer ships TypeScript source: it must typecheck inside a consumer too.
  run('pnpm', ['exec', 'nuxi', 'typecheck'], app)
  run('pnpm', ['exec', 'nuxi', 'build'], app, { NODE_ENV: 'production' })
  console.log('✓ consumer app installed from tarballs and built')
}
finally {
  if (!process.env.KEEP_CONSUMER) rmSync(work, { recursive: true, force: true })
  else console.log(`kept: ${work}`)
}
