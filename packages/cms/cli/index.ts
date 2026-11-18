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
 *   tinyzoo links:convert     → turn stored page addresses into links that follow their page (--dry-run reports only)
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
 *                               (--languages cs,en,de  --presets news,forms,redirects,search|none
 *                               --demo|--no-demo  --package-manager npm; see cli/init.mjs)
 * `tinyzoo help` prints the commands and flags (cli/usage.ts holds the list the docs and the tests follow).
 * Run from the host app root (cwd = host). Designed to run under tsx.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildOpenApiDocument, emitContentTypes, emitSchema } from '../src/index'
import { askYesNo, drizzleKitRunner, generateMigration } from './generate'
import { status } from './status'
import { up } from './up'
import { upgrade } from './upgrade'
import { runExport } from './export'
import { runImport } from './import'
import { reportFailure } from './transfer'
import { usage } from './usage'
import { detectPackageManager, INIT_USAGE, InitError, nextSteps, parseInitArgs, resolveOptions, scaffold } from './init.mjs'

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

/**
 * A new website: the starter with the parts and languages asked for (cli/init.mjs, which
 * `create-tinyzoo` runs too, so both make the same site).
 */
function init() {
  try {
    const args = parseInitArgs(process.argv.slice(3))
    if (args.help) { console.log(INIT_USAGE); return }
    if (!args.folder) throw new InitError(INIT_USAGE)
    const choices = resolveOptions(args)
    const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
    const packageManager = args.packageManager ?? detectPackageManager()
    const { dest, regenerate } = scaffold({
      ...choices,
      dest: resolve(cwd, args.folder),
      starterDir: join(pkgDir, 'starter'),
      version: JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).version as string,
      packageManager,
    })
    console.log(`✓ created ${dest}\n${nextSteps({ folder: args.folder, packageManager, demo: choices.demo, regenerate })}`)
  }
  catch (err) {
    if (!(err instanceof InitError)) throw err
    console.error(err.message.startsWith('usage:') ? err.message : `✗ ${err.message}`)
    process.exit(1)
  }
}

switch (cmd) {
  case 'init': init(); break
  case 'generate': process.exit(await generate()); break
  case 'up': process.exit(await up(cwd)); break
  case 'status': process.exit(await status(cwd, { pkgDir: resolve(dirname(fileURLToPath(import.meta.url)), '..') })); break
  case 'upgrade': process.exit(await upgrade(cwd, resolve(dirname(fileURLToPath(import.meta.url)), '..'), { generate, migrationsDir: resolve(cwd, 'server/db/migrations') })); break
  case 'client': await client(); break
  case 'openapi': await openapi(); break
  case 'content:migrate': await (await import('./content-migrate')).contentMigrateCommand(await loadConfig(), process.argv.slice(3)); break
  case 'links:convert': await (await import('./links-convert')).linksConvertCommand(await loadConfig(), process.argv.slice(3)); break
  case 'export': await runExport(process.argv.slice(3)).catch(reportFailure); break
  case 'import': await runImport(process.argv.slice(3)).then(() => {}, reportFailure); break
  case 'seed': await (await import('./seed')).seedCommand(await loadConfig(), process.argv.slice(3)).catch(reportFailure); break
  case 'backup': await (await import('./backup')).backup(process.argv.slice(3)); break
  case 'restore': await (await import('./backup')).restore(process.argv.slice(3)); break
  case 'help': case '--help': case '-h': process.stdout.write(usage()); break
  default:
    console.error(usage())
    process.exit(1)
}
