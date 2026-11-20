#!/usr/bin/env node
// Deploy the tinyzoo website (or its demo: the same image) to Pushbase by upload,
// from the working tree — no git provider needed.
//
//   node scripts/deploy-site.mjs <project-slug> [--env production]
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
  console.error('usage: node scripts/deploy-site.mjs <project-slug> [--env production]')
  process.exit(2)
}
const envIdx = rest.indexOf('--env')
const environment = envIdx !== -1 ? rest[envIdx + 1] : 'production'
const cli = process.env.PUSHBASE_CLI || 'pushbase@0.3.0'

const ls = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--deduplicate', '-z'], { cwd: root, encoding: 'utf-8' })
if (ls.status !== 0) throw new Error(`git ls-files failed: ${ls.stderr}`)
const files = ls.stdout.split('\0').filter(Boolean)
  // Never secrets; the playground's root Dockerfile is replaced below.
  .filter((f) => !/(^|\/)\.env(\..*)?$/.test(f) || /\.(example|sample|template)$/.test(f))
  .filter((f) => f !== 'Dockerfile' && existsSync(join(root, f)))

const stage = mkdtempSync(join(tmpdir(), 'tinyzoo-site-'))
try {
  for (const f of files) {
    mkdirSync(dirname(join(stage, f)), { recursive: true })
    cpSync(join(root, f), join(stage, f))
  }
  cpSync(join(root, 'site/Dockerfile'), join(stage, 'Dockerfile'))
  console.error(`packed ${files.length} files → ${slug} (${environment})`)
  const run = spawnSync('npx', ['-y', cli, 'deploy', '--project', slug, '--env', environment, '--dir', stage, '--preset', 'dockerfile', '--yes'], { stdio: 'inherit' })
  process.exitCode = run.status ?? 1
}
finally {
  rmSync(stage, { recursive: true, force: true })
}
