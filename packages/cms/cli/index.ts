#!/usr/bin/env tsx
/**
 * `tinyzoo` CLI — thin wrapper over drizzle-kit + the codegen sinks.
 *   tinyzoo generate          → emit host db/schema.ts from cms.config.ts, then `drizzle-kit generate`
 *   tinyzoo up                → `drizzle-kit migrate`
 *   tinyzoo client [out]      → emit the typed @tinyzoo/client bindings (default cms-content.ts; --stdout)
 *   tinyzoo openapi [out]     → emit the OpenAPI 3.1 document (default openapi.json; --stdout)
 * Run from the host app root (cwd = host). Designed to run under tsx.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
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
  drizzleKit('generate')
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

switch (cmd) {
  case 'generate': await generate(); break
  case 'up': drizzleKit('migrate'); break
  case 'client': await client(); break
  case 'openapi': await openapi(); break
  default:
    console.error('usage: tinyzoo <generate|up|client|openapi> [out] [--stdout]')
    process.exit(1)
}
