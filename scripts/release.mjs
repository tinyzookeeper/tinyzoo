// Publishes tinyzoo, @tinyzoo/client and create-tinyzoo to npm. Run by the release workflow
// (.github/workflows/release.yml) after the "Version packages" pull request is merged.
//
//   node scripts/release.mjs            publish what npm does not have yet
//   node scripts/release.mjs --dry-run  the same steps, but `pnpm publish -r --dry-run`: nothing leaves the machine
//
// Steps: skip when every package version is already on npm (every push to main runs this),
// build @tinyzoo/client (dist), run the consumer check on the packed tarballs (create-tinyzoo
// is packed with the starter of tinyzoo inside), then `changeset publish` (pnpm publish per
// package, with provenance when NPM_CONFIG_PROVENANCE=true), then the git tags and GitHub
// releases (tagAndRelease) of every package that is on npm at its version, also when the
// publish failed halfway (a re-run publishes what is missing and tags what has no tag yet).
// After a publish it waits up to ten minutes for npm to list the new versions (waitForNpm): asked at once,
// npm still answered 404 for 0.6.0, and the run passed without tags. The "Nothing to
// publish" path (every push to main) also tags what has no tag yet, so a run that lost its
// tags is repaired by the next push. A tag goes on the commit that set the version, not on HEAD.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const dry = process.argv.includes('--dry-run')
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit' })
const sh = (cmd, args) => execFileSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

const packages = ['packages/cms', 'packages/client', 'packages/create-tinyzoo'].map((dir) => {
  const { name, version } = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8'))
  return { dir, name, version }
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
  // Repairs a release whose tags or GitHub releases are missing; a no-op when they exist.
  tagAndRelease(packages)
  process.exit()
}
console.log(`To publish: ${(missing.length ? missing : packages).map((p) => `${p.name}@${p.version}`).join(', ')}${dry ? ' (dry run)' : ''}`)

run('pnpm', ['--filter', '@tinyzoo/client', 'build'])
run('node', ['scripts/consumer-check.mjs'])
if (dry) run('pnpm', ['publish', '-r', '--dry-run', '--no-git-checks'])
else {
  try { run('pnpm', ['exec', 'changeset', 'publish']) }
  finally {
    // Not only what this run published: a run that died after `changeset publish` put tinyzoo
    // and @tinyzoo/client on npm, but before create-tinyzoo, left them without a tag, and the
    // re-run has only create-tinyzoo missing. Whatever npm has at this version gets its tag and release.
    try {
      const listed = waitForNpm(missing)
      tagAndRelease(packages.filter((p) => listed.includes(p) || (!missing.includes(p) && onNpm(p))))
    }
    catch (err) {
      console.error(`Could not tag or release: ${err.message}`)
      process.exitCode = 1
    }
  }
}

/**
 * The packages of `wanted` that npm lists, asking again every 5 seconds for up to ten minutes
 * while some are missing: the registry lists a version some time after `npm publish` returns
 * (0.7.0: about three minutes for tinyzoo), and a 404 asked too early would leave it untagged.
 */
function waitForNpm(wanted, { tries = 120, pauseMs = Number(process.env.RELEASE_NPM_POLL_MS) || 5000 } = {}) {
  let left = wanted
  for (let i = 0; ; i++) {
    left = left.filter((p) => !onNpm(p))
    if (!left.length || i === tries - 1) break
    console.log(`Waiting for npm to list ${left.map((p) => `${p.name}@${p.version}`).join(', ')}…`)
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, pauseMs)
  }
  if (left.length) {
    console.error(`npm does not list ${left.map((p) => `${p.name}@${p.version}`).join(', ')}: no tag or release for it. The next push to main tags it once npm does.`)
    process.exitCode = 1
  }
  return wanted.filter((p) => !left.includes(p))
}

/**
 * The commit that set a package's current version: the oldest commit on main's first-parent
 * line, among those that touched a `version` line of its package.json, that already holds it
 * (the merge of the Version packages pull request). Null when HEAD holds another version.
 */
function versionCommit({ dir, version }) {
  const file = `${dir}/package.json`
  const shas = sh('git', ['log', '--first-parent', '--format=%H', '-G', '"version"', 'HEAD', '--', file]).split('\n').filter(Boolean)
  // Newest first: walk back while the version is still this one; the last such commit set it.
  let found = null
  for (const sha of shas) {
    if (JSON.parse(sh('git', ['show', `${sha}:${file}`])).version !== version) break
    found = sha
  }
  return found
}

/**
 * Pushes the tag of every package that is on npm and makes its GitHub release from the
 * CHANGELOG. The release action does this only when the publish output has "New tag:"
 * lines, which @changesets/cli 3 no longer prints: 0.2.0 and 0.2.1 went to npm without
 * either. Skips a tag the remote has and a release that exists, so it never doubles up.
 */
function tagAndRelease(published) {
  const remote = sh('git', ['ls-remote', '--tags', 'origin'])
  let failed = false
  for (const p of published) {
    const tag = `${p.name}@${p.version}`
    try {
      if (!remote.includes(`refs/tags/${tag}\n`)) {
        try { sh('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`]) }
        catch {
          const sha = versionCommit(p)
          if (!sha) throw new Error(`no commit on main sets ${p.dir}/package.json to ${p.version}`)
          run('git', ['tag', tag, sha])
        }
        run('git', ['push', 'origin', `refs/tags/${tag}`])
      }
      try { sh('gh', ['release', 'view', tag]); continue }
      catch { /* no release yet */ }
      // "Latest" on GitHub goes to the CMS itself, not to whichever release was made last.
      run('gh', ['release', 'create', tag, '--verify-tag', '--title', tag, `--latest=${p.name === 'tinyzoo'}`, '--notes', changelogOf(p) || `Published to npm as ${tag}.`])
    }
    catch (err) {
      failed = true
      console.error(`Could not tag or release ${tag}: ${err.message}`)
    }
  }
  if (failed) process.exitCode = 1
}

/** The CHANGELOG section of one version, without its heading ('' when there is none, as for a package's first, unversioned publish). */
function changelogOf({ dir, version }) {
  let log
  try { log = readFileSync(join(root, dir, 'CHANGELOG.md'), 'utf8') }
  catch (err) {
    if (err.code === 'ENOENT') return ''
    throw err
  }
  const start = log.indexOf(`\n## ${version}\n`)
  if (start === -1) return ''
  const body = log.slice(start + `\n## ${version}\n`.length)
  const end = body.search(/\n## /)
  return (end === -1 ? body : body.slice(0, end)).trim()
}
