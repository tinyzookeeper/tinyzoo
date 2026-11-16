// Publishes tinyzoo and @tinyzoo/client to npm. Run by the release workflow
// (.github/workflows/release.yml) after the "Version packages" pull request is merged.
//
//   node scripts/release.mjs            publish what npm does not have yet
//   node scripts/release.mjs --dry-run  the same steps, but `pnpm publish -r --dry-run`: nothing leaves the machine
//
// Steps: skip when every package version is already on npm (every push to main runs this),
// build @tinyzoo/client (dist), run the consumer check on the packed tarballs of both
// packages, then `changeset publish` (pnpm publish per package, plus the git tags the release action turns into GitHub releases).
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const dry = process.argv.includes('--dry-run')
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit' })

const packages = ['packages/cms', 'packages/client'].map((dir) => {
  const { name, version } = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8'))
  return { name, version }
})

function onNpm({ name, version }) {
  try {
    execFileSync('npm', ['view', `${name}@${version}`, 'version'], { cwd: root, stdio: 'pipe' })
    return true
  }
  catch (err) {
    const out = `${err.stdout ?? ''}${err.stderr ?? ''}`
    if (/E404|404 Not Found|is not in this registry/.test(out)) return false
    throw new Error(`Could not ask npm about ${name}@${version}:\n${out || err.message}`)
  }
}

const missing = packages.filter((p) => !onNpm(p))
if (!missing.length && !dry) {
  console.log(`Nothing to publish: ${packages.map((p) => `${p.name}@${p.version}`).join(', ')} already on npm.`)
  process.exit(0)
}
console.log(`To publish: ${(missing.length ? missing : packages).map((p) => `${p.name}@${p.version}`).join(', ')}${dry ? ' (dry run)' : ''}`)

run('pnpm', ['--filter', '@tinyzoo/client', 'build'])
run('node', ['scripts/consumer-check.mjs'])
if (dry) run('pnpm', ['publish', '-r', '--dry-run', '--no-git-checks'])
else run('pnpm', ['exec', 'changeset', 'publish'])
