// Work on one template in the one app: the development server with only that design, and one
// site of it at http://localhost:<port>.
//
//   pnpm --filter tinyzoo-template-app dev photographer [--port 3000]
//
// The one app has no content model of its own, so it runs in multi-tenant mode only. This script
// writes a site directory with one site (its model and design: the template), makes the site's
// database if it is not there yet (`tz_app_<id>_dev` on the Postgres server of DATABASE_URL,
// from the environment or templates/app/.env) and starts `nuxt dev` with it. The first visit of
// /admin asks for the setup code `dev`; the template's demo content comes from its seed:
//
//   SEED_URL=http://localhost:3000 SEED_SETUP_CODE=dev SEED_EMAIL=you@example.com SEED_PASSWORD=… pnpm --filter tinyzoo-template-<id> seed
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { appDir, arg } from './sites.mjs'

const id = process.argv[2]
// The designs of designs.ts, read as text (its imports are written for Nuxt's loader, not Node's).
const designs = [...(/DESIGNS[^=]*=\s*\{([^}]*)\}/.exec(readFileSync(join(appDir, 'designs.ts'), 'utf8'))?.[1] ?? '').matchAll(/^\s*['"]?([a-z][a-z0-9-]*)['"]?\s*[:,]/gm)].map((m) => m[1])
if (!id || !designs.includes(id)) {
  console.error(`usage: pnpm dev <design> [--port 3000]   (the designs of this app: ${designs.join(', ') || 'none yet'})`)
  process.exit(2)
}
const port = Number(arg('port', 3000))

// DATABASE_URL and NUXT_APP_SECRET: the environment wins over .env.
const dotenv = existsSync(join(appDir, '.env'))
  ? Object.fromEntries(readFileSync(join(appDir, '.env'), 'utf8').split('\n').map((l) => /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]))
  : {}
const server = process.env.DATABASE_URL || dotenv.DATABASE_URL
const secret = process.env.NUXT_APP_SECRET || dotenv.NUXT_APP_SECRET
if (!server || !secret) {
  console.error('Set DATABASE_URL (a Postgres server; the site gets a database of its own there) and NUXT_APP_SECRET, in the environment or in templates/app/.env')
  process.exit(2)
}

const database = `tz_app_${id.replace(/-/g, '_')}_dev`
const pg = createRequire(join(appDir, 'package.json'))('pg')
const admin = new pg.Client({ connectionString: server })
await admin.connect()
if (!(await admin.query('select 1 from pg_database where datname = $1', [database])).rowCount) {
  await admin.query(`create database "${database}"`)
  console.log(`made the database ${database}`)
}
await admin.end()
const databaseUrl = new URL(server)
databaseUrl.pathname = `/${database}`

const dataDir = join(appDir, '.data', id)
mkdirSync(dataDir, { recursive: true })
const directoryFile = join(appDir, '.data', `dev-${id}.json`)
writeFileSync(directoryFile, JSON.stringify({
  sites: [{
    id, model: id,
    hosts: ['localhost'], alsoHosts: ['127.0.0.1'],
    publicUrl: `http://localhost:${port}`,
    databaseUrl: databaseUrl.toString(),
    secret: `${secret}-${id}`,
    config: { auth: { setupToken: 'dev' }, storage: { driver: 'local', local: { dir: join(dataDir, 'uploads') } }, mail: { file: { dir: join(dataDir, 'mail') } } },
  }],
}, null, 2))

const child = spawn('pnpm', ['exec', 'nuxt', 'dev', '--port', String(port)], {
  cwd: appDir, stdio: 'inherit',
  env: {
    ...process.env, TZ_DESIGNS: id, NUXT_APP_SECRET: secret,
    NUXT_CMS_TENANCY_MODE: 'multi', NUXT_CMS_TENANCY_FILE: directoryFile, NUXT_CMS_MIGRATIONS_ON_START: 'true', NUXT_CMS_MAIL_TRANSPORT: 'file',
  },
})
const stop = () => child.kill('SIGTERM')
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
child.on('exit', (code) => process.exit(code ?? 0))
