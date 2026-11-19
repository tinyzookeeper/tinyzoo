#!/usr/bin/env node
// Hand this Keeper to a deployment of it: pack the layer and put the tarball into
// that project's vendor/ folder, pointing its `tinyzoo-keeper` dependency at it.
//
//   pnpm --filter tinyzoo-keeper pack:to ~/Coding/VSCodeProjects/keeper
//
// The project then runs `pnpm install` and deploys as usual. It is packed from this
// working copy, uncommitted changes included, so pack from the branch you mean to ship.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const keeperDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = process.argv[2] ? resolve(process.argv[2].replace(/^~(?=\/)/, process.env.HOME ?? '~')) : null
if (!target || !existsSync(join(target, 'package.json'))) {
  console.error('usage: pnpm --filter tinyzoo-keeper pack:to <folder of a Keeper deployment, with its package.json>')
  process.exit(2)
}

const out = mkdtempSync(join(tmpdir(), 'keeper-pack-'))
execFileSync('pnpm', ['pack', '--pack-destination', out], { cwd: keeperDir, stdio: ['ignore', 'ignore', 'inherit'] })
const file = readdirSync(out).find((f) => f.endsWith('.tgz'))
if (!file) throw new Error('pnpm pack made no tarball')

const vendor = join(target, 'vendor')
mkdirSync(vendor, { recursive: true })
for (const old of readdirSync(vendor)) if (old.startsWith('tinyzoo-keeper-') && old.endsWith('.tgz')) rmSync(join(vendor, old))
renameSync(join(out, file), join(vendor, file))
rmSync(out, { recursive: true, force: true })

const pkgPath = join(target, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
pkg.dependencies = { ...pkg.dependencies, 'tinyzoo-keeper': `file:vendor/${file}` }
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

let commit = ''
try { commit = execFileSync('git', ['log', '-1', '--format=%h %s'], { cwd: keeperDir, encoding: 'utf8' }).trim() }
catch { /* not a git checkout */ }
console.log(`Packed ${file}${commit ? ` (${commit})` : ''} into ${vendor}.\nNext, in ${target}: pnpm install, then deploy.`)
