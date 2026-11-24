#!/usr/bin/env node
// Deploy the tinyzoo website (or its demo: the same image) to Pushbase by upload,
// from the working tree — no git provider needed.
//
//   node scripts/deploy-site.mjs <project-slug> [--env production]
//
// Another app of the workspace goes the same way with its own Dockerfile, and without the
// folders it does not build from (their package.json files stay: the lockfile names them):
//
//   node scripts/deploy-site.mjs <project-slug> --dockerfile cloud/Dockerfile --without templates
//
// The site is a workspace member built from the repo root, and Pushbase's
// "dockerfile" preset builds the root Dockerfile (which builds the playground). So
// this packs the repo — git-tracked and untracked-not-ignored files, uncommitted
// changes included, never .env files — into a temporary folder with
// site/Dockerfile as its root Dockerfile, and uploads that with the published
// Pushbase CLI (`npx -y pushbase@0.3.0`; PUSHBASE_CLI overrides the version, e.g.
// pushbase@latest). Auth: PUSHBASE_TOKEN or ~/.config/pushbase/config.json.
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [slug, ...rest] = process.argv.slice(2)
if (!slug || slug.startsWith('-')) {
  console.error('usage: node scripts/deploy-site.mjs <project-slug> [--env production] [--dockerfile site/Dockerfile] [--without <folder>]…')
  process.exit(2)
}
const option = (name, fallback) => (rest.includes(name) ? rest[rest.indexOf(name) + 1] : fallback)
const environment = option('--env', 'production')
const dockerfile = option('--dockerfile', 'site/Dockerfile')
const without = rest.flatMap((arg, i) => (arg === '--without' && rest[i + 1] ? [`${rest[i + 1].replace(/\/+$/, '')}/`] : []))
if (!existsSync(join(root, dockerfile))) {
  console.error(`no such Dockerfile: ${dockerfile}`)
  process.exit(2)
}
const cli = process.env.PUSHBASE_CLI || 'pushbase@0.3.0'

const ls = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--deduplicate', '-z'], { cwd: root, encoding: 'utf-8' })
if (ls.status !== 0) throw new Error(`git ls-files failed: ${ls.stderr}`)
const files = ls.stdout.split('\0').filter(Boolean)
  // Never secrets; the playground's root Dockerfile is replaced below.
  .filter((f) => !/(^|\/)\.env(\..*)?$/.test(f) || /\.(example|sample|template)$/.test(f))
  .filter((f) => f !== 'Dockerfile' && existsSync(join(root, f)))
  // A folder left out keeps its package.json files: pnpm's frozen lockfile lists every workspace member.
  .filter((f) => !without.some((dir) => f.startsWith(dir)) || f.endsWith('/package.json'))

const stage = mkdtempSync(join(tmpdir(), 'tinyzoo-site-'))
try {
  for (const f of files) {
    mkdirSync(dirname(join(stage, f)), { recursive: true })
    cpSync(join(root, f), join(stage, f))
  }
  cpSync(join(root, dockerfile), join(stage, 'Dockerfile'))
  console.error(`packed ${files.length} files → ${slug} (${environment})`)
  const run = spawnSync('npx', ['-y', cli, 'deploy', '--project', slug, '--env', environment, '--dir', stage, '--preset', 'dockerfile', '--yes'], { stdio: 'inherit' })
  process.exitCode = run.status ?? 1
}
finally {
  rmSync(stage, { recursive: true, force: true })
}
