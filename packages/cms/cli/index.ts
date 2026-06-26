#!/usr/bin/env tsx
/**
 * `cms` CLI — thin wrapper over drizzle-kit.
 *   cms generate  → emit host db/schema.ts from cms.config.ts, then `drizzle-kit generate`
 *   cms up        → `drizzle-kit migrate`
 * Run from the host app root (cwd = host). Designed to run under tsx.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { emitSchema } from '../src/index'

const cmd = process.argv[2]
const cwd = process.cwd()
const configPath = resolve(cwd, 'cms.config.ts')
const schemaOut = resolve(cwd, 'server/db/schema.ts')

function drizzleKit(...args: string[]) {
  execFileSync('pnpm', ['exec', 'drizzle-kit', ...args], { cwd, stdio: 'inherit' })
}

async function generate() {
  const config = await import(pathToFileURL(configPath).href)
  const src = emitSchema(config)
  mkdirSync(dirname(schemaOut), { recursive: true })
  writeFileSync(schemaOut, src)
  console.log(`✓ emitted ${schemaOut}`)
  drizzleKit('generate')
}

switch (cmd) {
  case 'generate':
    await generate()
    break
  case 'up':
    drizzleKit('migrate')
    break
  default:
    console.error('usage: cms <generate|up>')
    process.exit(1)
}
