#!/usr/bin/env tsx
/**
 * `tinyzoo` CLI — thin wrapper over drizzle-kit + the codegen sinks.
 *   tinyzoo generate          → emit host db/schema.ts from cms.config.ts, then `drizzle-kit generate`
 *   tinyzoo up                → `drizzle-kit migrate`
 *   tinyzoo client [out]      → emit the typed @tinyzoo/client bindings (default cms-content.ts; --stdout)
 *   tinyzoo openapi [out]     → emit the OpenAPI 3.1 document (default openapi.json; --stdout)
 *   tinyzoo content:migrate   → rewrite stored blocks/lists/rich text to their current versions (--dry-run reports only)
 *   tinyzoo init <dir>        → a new website with the CMS inside (the starter: pages, news,
 *                               menus, a contact form, cs/en), ready for `pnpm install`
 * Run from the host app root (cwd = host). Designed to run under tsx.
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildOpenApiDocument, emitContentTypes, emitSchema } from '../src/index'

const cmd = process.argv[2]
const cwd = process.cwd()
const configPath = resolve(cwd, 'cms.config.ts')
const schemaOut = resolve(cwd, 'server/db/schema.ts')

function drizzleKit(...args: string[]) {
  execFileSync('pnpm', ['exec', 'drizzle-kit', ...args], { cwd, stdio: 'inherit' })
}

function loadConfig() {
  return import(pathToFileURL(configPath).href)
}

/** Positional output path arg (first non-flag after the command), or a default. */
function outArg(fallback: string): string {
  const arg = process.argv[3]
  return arg && !arg.startsWith('-') ? resolve(cwd, arg) : resolve(cwd, fallback)
}

async function generate() {
  const config = await loadConfig()
  const src = emitSchema(config)
  mkdirSync(dirname(schemaOut), { recursive: true })
  writeFileSync(schemaOut, src)
  console.log(`✓ emitted ${schemaOut}`)
  const migrationsDir = resolve(cwd, 'server/db/migrations')
  const sqlFiles = () => (existsSync(migrationsDir) ? readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')) : [])
  const before = new Set(sqlFiles())
  drizzleKit('generate')
  // Trigram indexes (the search index) need pg_trgm, which drizzle-kit does not enable.
  for (const f of sqlFiles().filter((x) => !before.has(x))) {
    const file = join(migrationsDir, f)
    const sql = readFileSync(file, 'utf8')
    if (sql.includes('gin_trgm_ops') && !sql.includes('CREATE EXTENSION IF NOT EXISTS pg_trgm')) {
      writeFileSync(file, 'CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint\n' + sql)
      console.log(`✓ ${f}: enables pg_trgm (for the search index)`)
    }
  }
}

async function client() {
  const src = emitContentTypes(await loadConfig())
  if (process.argv.includes('--stdout')) { process.stdout.write(src); return }
  const out = outArg('cms-content.ts')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, src)
  console.log(`✓ emitted ${out}`)
}

async function openapi() {
  const doc = buildOpenApiDocument(await loadConfig(), { title: 'Content API' })
  const json = JSON.stringify(doc, null, 2) + '\n'
  if (process.argv.includes('--stdout')) { process.stdout.write(json); return }
  const out = outArg('openapi.json')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, json)
  console.log(`✓ emitted ${out}`)
}

/** Copy the starter into a new folder, with versions instead of workspace links. */
function init() {
  const target = process.argv[3]
  if (!target || target.startsWith('-')) {
    console.error('usage: tinyzoo init <folder>')
    process.exit(1)
  }
  const dest = resolve(cwd, target)
  if (existsSync(dest) && readdirSync(dest).length) {
    console.error(`✗ ${dest} exists and is not empty`)
    process.exit(1)
  }
  const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const starter = join(pkgDir, 'starter')
  const skip = new Set(['node_modules', '.nuxt', '.output', '.env', '.cms-uploads', '.cms-mail', '.data'])
  cpSync(starter, dest, { recursive: true, filter: (src) => !skip.has(basename(src)) })
  renameSync(join(dest, 'gitignore.txt'), join(dest, '.gitignore'))
  const version = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).version as string
  const pkgPath = join(dest, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  pkg.name = basename(dest).toLowerCase().replace(/[^a-z0-9-]+/g, '-')
  for (const deps of [pkg.dependencies, pkg.devDependencies]) {
    for (const [name, v] of Object.entries(deps ?? {})) if (String(v).startsWith('workspace:')) deps[name] = `^${version}`
  }
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  console.log(`✓ created ${dest}\n\n  cd ${target}\n  pnpm install\n  cp .env.example .env\n  docker compose up -d\n  pnpm db:migrate\n  pnpm dev   → http://localhost:3000/admin\n`)
}

switch (cmd) {
  case 'init': init(); break
  case 'generate': await generate(); break
  case 'up': drizzleKit('migrate'); break
  case 'client': await client(); break
  case 'openapi': await openapi(); break
  case 'content:migrate': await (await import('./content-migrate')).contentMigrateCommand(await loadConfig(), process.argv.slice(3)); break
  default:
    console.error('usage: tinyzoo <init|generate|up|client|openapi|content:migrate> [out] [--stdout] [--dry-run]')
    process.exit(1)
}
