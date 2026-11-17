// Installability check: pack tinyzoo and @tinyzoo/client, install them from the
// tarballs into a fresh app outside the workspace (no workspace links), generate the
// schema and typed client with the `tinyzoo` CLI, typecheck and production-build the app.
// Then create-tinyzoo, packed too: installed on its own into an empty folder (what `pnpm
// create tinyzoo` does), it makes a site with its flags, and refuses a folder that is not empty.
// (The sites it makes are built by `pnpm check:starter`.)
//
//   node scripts/consumer-check.mjs
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
  run('pnpm', ['pack', '--pack-destination', packs], join(root, 'packages/create-tinyzoo'))
  const tgz = (prefix) => join(packs, readdirSync(packs).find((f) => f.startsWith(prefix)))

  cpSync(join(root, 'test/consumer'), app, { recursive: true })
  cpSync(join(root, 'playground/cms.config.ts'), join(app, 'cms.config.ts'))
  // The config registers the example plugin: its handlers and page are built from the app's own folder.
  cpSync(join(root, 'playground/cms-plugins'), join(app, 'cms-plugins'), { recursive: true })
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

  // ── create-tinyzoo, as `pnpm create tinyzoo` gets it: the tarball and its own dependencies, nothing else ──
  const launcher = join(work, 'launcher')
  mkdirSync(launcher)
  writeFileSync(join(launcher, 'package.json'), JSON.stringify({ name: 'launcher', private: true, dependencies: { 'create-tinyzoo': `file:${tgz('create-tinyzoo-')}` } }))
  run('pnpm', ['install', '--ignore-workspace'], launcher)
  const installed = join(launcher, 'node_modules/create-tinyzoo')
  const packedJson = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'))
  const fail = (message) => { throw new Error(`create-tinyzoo: ${message}`) }
  if (Object.keys(packedJson.dependencies ?? {}).join() !== '@clack/prompts') fail(`should depend on @clack/prompts alone (not on tinyzoo and its 700 packages), has ${Object.keys(packedJson.dependencies ?? {})}`)
  for (const file of ['bundle/init.mjs', 'bundle/tinyzoo.json', 'bundle/starter/cms.config.ts', 'bundle/starter/gitignore.txt', 'bundle/starter/.env.example', 'bundle/starter/seed/media/hero.jpg']) {
    if (!existsSync(join(installed, file))) fail(`the package has no ${file}`)
  }
  if (existsSync(join(installed, 'bundle/starter/node_modules')) || existsSync(join(installed, 'bundle/starter/.nuxt'))) fail('the bundled starter has installed or built files')
  const version = JSON.parse(readFileSync(join(root, 'packages/cms/package.json'), 'utf8')).version
  if (JSON.parse(readFileSync(join(installed, 'bundle/tinyzoo.json'), 'utf8')).version !== version) fail(`the bundle is not tinyzoo ${version}`)

  // Run through the package manager, as `pnpm create` does (it sets npm_config_user_agent), and without a terminal.
  const made = join(work, 'made/my-site')
  run('pnpm', ['exec', 'create-tinyzoo', made, '--languages', 'de,en', '--presets', 'news,forms', '--no-demo', '--yes'], launcher)
  const site = (path) => readFileSync(join(made, path), 'utf8')
  const sitePkg = JSON.parse(site('package.json'))
  if (sitePkg.name !== 'my-site' || sitePkg.dependencies.tinyzoo !== `^${version}` || sitePkg.dependencies['@tinyzoo/client'] !== `^${version}`) fail(`package.json of the new site: ${JSON.stringify(sitePkg.dependencies)}`)
  if (JSON.stringify(sitePkg).includes('workspace:') || sitePkg.scripts.seed) fail('the new site has a workspace link or a seed script')
  if (!site('cms.config.ts').includes("defineLocales({ default: 'de', locales: ['de', 'en'] })")) fail('cms.config.ts has not the languages asked for')
  if (!existsSync(join(made, '.gitignore')) || existsSync(join(made, 'seed')) || existsSync(join(made, 'server/db/schema.ts'))) fail('the new site has the wrong files')
  // a folder that is not empty is refused, and left as it was
  const refused = spawnSync('pnpm', ['exec', 'create-tinyzoo', made, '--yes'], { cwd: launcher, encoding: 'utf8' })
  if (refused.status === 0 || !/not empty/.test(`${refused.stdout}${refused.stderr}`)) fail('did not refuse a folder that is not empty')
  console.log('✓ create-tinyzoo installed from its tarball, made a site, and refused a full folder')
}
finally {
  if (!process.env.KEEP_CONSUMER) rmSync(work, { recursive: true, force: true })
  else console.log(`kept: ${work}`)
}
