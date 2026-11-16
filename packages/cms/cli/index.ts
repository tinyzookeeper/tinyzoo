#!/usr/bin/env tsx
/**
 * `tinyzoo` CLI — thin wrapper over drizzle-kit + the codegen sinks.
 *   tinyzoo generate          → emit host db/schema.ts from cms.config.ts, then `drizzle-kit generate`;
 *                               stops on migrations that lose data (--allow-drop keeps them) or may fail
 *                               on existing rows (--allow-risky keeps them)
 *   tinyzoo up                → apply migrations + upgrade steps to DATABASE_URL (same runner as the app's start)
 *   tinyzoo status            → what DATABASE_URL has applied / has pending (exit 1 when something is pending)
 *   tinyzoo upgrade           → after updating tinyzoo: check versions, generate, regenerate the client, show status
 *   tinyzoo client [out]      → emit the typed @tinyzoo/client bindings (default cms-content.ts; --stdout)
 *   tinyzoo openapi [out]     → emit the OpenAPI 3.1 document (default openapi.json; --stdout)
 *   tinyzoo content:migrate   → rewrite stored blocks/lists/rich text to their current versions (--dry-run reports only)
 *   tinyzoo export <file>     → the site's content (entries, translations, links, globals, media files)
 *                               in one .tar.gz archive (--only a,b  --no-media  --with-revisions …)
 *   tinyzoo import <file>     → put such an archive into this site (empty target; --replace, --merge,
 *                               --allow-mismatch, --dry-run). Both are described in cli/export.ts / import.ts
 *   tinyzoo backup [file]     → database (pg_dump) + media in one tar archive
 *   tinyzoo restore <file>    → put such an archive back (--yes skips the question, --force replaces a database that has accounts)
 *   tinyzoo seed [file]       → put the site's seed content (seed/index.ts, `defineSeed`) into a running site
 *                               through the admin API (--url --email, password in $SEED_PASSWORD; --dry-run, --reset)
 *   tinyzoo init <dir>        → a new website with the CMS inside (the starter: pages, news,
 *                               menus, a contact form, cs/en), ready for `pnpm install`
 * Run from the host app root (cwd = host). Designed to run under tsx.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildOpenApiDocument, emitContentTypes, emitSchema } from '../src/index'
import { askYesNo, drizzleKitRunner, generateMigration } from './generate'
import { status } from './status'
import { up } from './up'
import { upgrade } from './upgrade'
import { runExport } from './export'
import { runImport } from './import'
import { reportFailure } from './transfer'

const cmd = process.argv[2]
const cwd = process.cwd()
const configPath = resolve(cwd, 'cms.config.ts')
const schemaOut = resolve(cwd, 'server/db/schema.ts')

function loadConfig() {
  return import(pathToFileURL(configPath).href)
}

/** Positional output path arg (first non-flag after the command), or a default. */
function outArg(fallback: string): string {
  const arg = process.argv[3]
  return arg && !arg.startsWith('-') ? resolve(cwd, arg) : resolve(cwd, fallback)
}

/** Emit schema.ts, then let drizzle-kit write the migration (returns an exit code). */
async function generate(): Promise<number> {
  const config = await loadConfig()
  const src = emitSchema(config)
  mkdirSync(dirname(schemaOut), { recursive: true })
  writeFileSync(schemaOut, src)
  console.log(`✓ emitted ${schemaOut}`)
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY)
  return generateMigration({
    migrationsDir: resolve(cwd, 'server/db/migrations'),
    allowDrop: process.argv.includes('--allow-drop'),
    allowRisky: process.argv.includes('--allow-risky'),
    interactive,
    runDrizzleKit: drizzleKitRunner(cwd, interactive),
    confirm: askYesNo,
  })
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
  console.log(`✓ created ${dest}\n\n  cd ${target}\n  pnpm install\n  cp .env.example .env\n  docker compose up -d\n  pnpm db:migrate\n  pnpm dev   → http://localhost:3000/admin\n\n  Demo content (Czech and English), while \`pnpm dev\` runs in another terminal:\n  SEED_EMAIL=you@example.com SEED_PASSWORD='a long password' pnpm seed\n  (creates the first administrator with those details; run it again any time, it changes nothing twice)\n`)
}

switch (cmd) {
  case 'init': init(); break
  case 'generate': process.exit(await generate()); break
  case 'up': process.exit(await up(cwd)); break
  case 'status': process.exit(await status(cwd)); break
  case 'upgrade': process.exit(await upgrade(cwd, resolve(dirname(fileURLToPath(import.meta.url)), '..'), { generate })); break
  case 'client': await client(); break
  case 'openapi': await openapi(); break
  case 'content:migrate': await (await import('./content-migrate')).contentMigrateCommand(await loadConfig(), process.argv.slice(3)); break
  case 'export': await runExport(process.argv.slice(3)).catch(reportFailure); break
  case 'import': await runImport(process.argv.slice(3)).then(() => {}, reportFailure); break
  case 'seed': await (await import('./seed')).seedCommand(await loadConfig(), process.argv.slice(3)).catch(reportFailure); break
  case 'backup': await (await import('./backup')).backup(process.argv.slice(3)); break
  case 'restore': await (await import('./backup')).restore(process.argv.slice(3)); break
  default:
    console.error('usage: tinyzoo <init|generate|up|status|upgrade|client|openapi|content:migrate|export|import|seed|backup|restore> [out] [--stdout] [--allow-drop] [--allow-risky] [--dry-run]\n'
      + '       tinyzoo export <file.tar.gz> [--only a,b] [--no-media] [--with-revisions] [--with-submissions] [--force]\n'
      + '       tinyzoo import <file.tar.gz> [--replace [--yes] | --merge] [--allow-mismatch] [--dry-run]\n'
      + '       tinyzoo seed [file] [--url u] [--email e] [--dry-run] [--reset [--yes]]   (password: $SEED_PASSWORD)\n'
      + '       tinyzoo backup [file]  ·  tinyzoo restore <file> [--yes] [--force]')
    process.exit(1)
}
