import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// scripts/release.mjs run for real, with stand-ins for npm, pnpm, git, gh and node on the PATH that keep
// their state in a JSON file: what is on npm, which tags and releases exist. The point is the re-run
// after a publish that failed halfway: every package that is on npm gets its tag and release.

const root = join(import.meta.dirname, '../..')
const packages = ['packages/cms', 'packages/client', 'packages/create-tinyzoo'].map((dir) => {
  const { name, version } = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8'))
  return `${name}@${version}`
})
const [CMS, CLIENT, CREATE] = packages as [string, string, string]

interface State {
  npm: string[]
  localTags: string[]
  remoteTags: string[]
  releases: string[]
  /** `changeset publish` puts these on npm, in order, and fails (exit 1) when one of them is `FAIL:<name>`. */
  publishes: string[]
  /** npm answers 404 for a version this many more times after it is published (the registry's lag). */
  lag: Record<string, number>
  log: string[]
}

const stub = `#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
const [tool, ...args] = [process.argv[2], ...process.argv.slice(3)]
const file = process.env.RELEASE_STATE
const state = JSON.parse(readFileSync(file, 'utf8'))
const save = () => writeFileSync(file, JSON.stringify(state))
const record = () => state.log.push([tool, ...args].join(' '))
const fail = (message = '', code = 1) => { record(); save(); process.stderr.write(message); process.exit(code) }
const done = (out = '') => { record(); save(); process.stdout.write(out); process.exit(0) }
if (tool === 'npm') {
  const spec = args[1]
  if (state.npm.includes(spec) && state.lag[spec] > 0) { state.lag[spec]--; fail('npm error code E404\\n404 Not Found - GET https://registry.npmjs.org/x') }
  if (state.npm.includes(spec)) done(spec + '\\n')
  fail('npm error code E404\\n404 Not Found - GET https://registry.npmjs.org/x')
}
else if (tool === 'pnpm') {
  if (args[0] === 'exec' && args[1] === 'changeset') {
    for (const entry of state.publishes) {
      if (entry.startsWith('FAIL:')) fail('npm error 403 You may not perform that action with these credentials\\n')
      state.npm.push(entry)
    }
    done()
  }
  done()
}
else if (tool === 'git') {
  if (args[0] === 'ls-remote') done(state.remoteTags.map((t) => 'abc123\\trefs/tags/' + t + '\\n').join(''))
  if (args[0] === 'rev-parse') (state.localTags.includes(args[3].replace('refs/tags/', '')) ? done : fail)('')
  if (args[0] === 'tag') { state.localTags.push(args[1]); done() }
  // the commit that set the version: one stand-in commit, holding the package.json of the work tree
  if (args[0] === 'log') done('v1sha\\n')
  if (args[0] === 'show') done(readFileSync(args[1].replace('v1sha:', ''), 'utf8'))
  if (args[0] === 'push') { state.remoteTags.push(args[2].replace('refs/tags/', '')); done() }
  fail('unexpected git ' + args.join(' '))
}
else if (tool === 'gh') {
  if (args[0] === 'release' && args[1] === 'view') (state.releases.includes(args[2]) ? done : fail)('')
  if (args[0] === 'release' && args[1] === 'create') { state.releases.push(args[2]); done() }
  fail('unexpected gh ' + args.join(' '))
}
else done()
`

let dir: string
let bin: string
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'tinyzoo-release-'))
  bin = join(dir, 'bin')
  mkdirSync(bin)
  writeFileSync(join(dir, 'stub.mjs'), stub)
  for (const tool of ['npm', 'pnpm', 'git', 'gh', 'node']) {
    const wrapper = join(bin, tool)
    writeFileSync(wrapper, `#!/bin/sh\nexec "${process.execPath}" "${join(dir, 'stub.mjs')}" ${tool} "$@"\n`)
    chmodSync(wrapper, 0o755)
  }
})
afterAll(() => { rmSync(dir, { recursive: true, force: true }) })

let n = 0
function release(initial: Partial<State>) {
  const file = join(dir, `state-${++n}.json`)
  writeFileSync(file, JSON.stringify({ npm: [], localTags: [], remoteTags: [], releases: [], publishes: [], lag: {}, log: [], ...initial }))
  const run = spawnSync(process.execPath, [join(root, 'scripts/release.mjs')], {
    cwd: root, encoding: 'utf8', env: { PATH: `${bin}:${process.env.PATH}`, RELEASE_STATE: file, HOME: process.env.HOME, RELEASE_NPM_POLL_MS: '10', RELEASE_NPM_TRIES: '8' },
  })
  const state = JSON.parse(readFileSync(file, 'utf8')) as State
  return { status: run.status, out: run.stdout + run.stderr, state }
}
const created = (state: State) => state.log.filter((l) => l.startsWith('gh release create')).map((l) => l.split(' ')[3])

describe('scripts/release.mjs', () => {
  it('publishes all three, then tags and releases all three', () => {
    const { status, out, state } = release({ publishes: [CMS, CLIENT, CREATE] })
    expect(status, out).toBe(0)
    expect(state.npm).toEqual([CMS, CLIENT, CREATE])
    expect(state.remoteTags.sort()).toEqual([...packages].sort())
    expect(created(state).sort()).toEqual([...packages].sort())
  })

  it('publishes nothing and changes nothing when every package is on npm, tagged and released', () => {
    const { status, out, state } = release({ npm: packages, remoteTags: packages, releases: packages })
    expect(status, out).toBe(0)
    expect(out).toContain('Nothing to publish')
    expect(state.log.filter((l) => /^(pnpm|git (tag|push)|gh release create)/.test(l))).toEqual([])
  })

  it('every package on npm but without tags (a run that lost them): tags the commit that set the version and releases all three', () => {
    const { status, out, state } = release({ npm: packages })
    expect(status, out).toBe(0)
    expect(out).toContain('Nothing to publish')
    expect(state.log.filter((l) => l.startsWith('pnpm'))).toEqual([])
    expect(state.log.filter((l) => l.startsWith('git tag')).sort()).toEqual(packages.map((p) => `git tag ${p} v1sha`).sort())
    expect(state.remoteTags.sort()).toEqual([...packages].sort())
    expect(created(state).sort()).toEqual([...packages].sort())
  })

  it('waits for npm to list what it just published before tagging it (0.6.0 asked too early)', () => {
    const { status, out, state } = release({ publishes: [CMS, CLIENT, CREATE], lag: { [CMS]: 3, [CREATE]: 1 } })
    expect(status, out).toBe(0)
    expect(out).toContain('Waiting for npm')
    expect(state.remoteTags.sort()).toEqual([...packages].sort())
    expect(created(state).sort()).toEqual([...packages].sort())
  })

  it('a version npm never lists in time gets no tag and fails the run, the others are tagged', () => {
    const { status, out, state } = release({ publishes: [CMS, CLIENT, CREATE], lag: { [CREATE]: 1000 } })
    expect(status).not.toBe(0)
    expect(out).toContain(`npm does not list ${CREATE}`)
    expect(state.remoteTags.sort()).toEqual([CMS, CLIENT].sort())
  })

  it('tags and releases what the publish got to npm even when the publish then fails (create-tinyzoo refused)', () => {
    const { status, out, state } = release({ publishes: [CMS, CLIENT, `FAIL:${CREATE}`] })
    expect(status).not.toBe(0)
    expect(state.npm).toEqual([CMS, CLIENT])
    expect(state.remoteTags.sort()).toEqual([CMS, CLIENT].sort())
    expect(created(state).sort()).toEqual([CMS, CLIENT].sort())
    expect(state.remoteTags).not.toContain(CREATE)
  })

  it('the re-run, when only create-tinyzoo is missing and nothing was tagged, tags and releases all three', () => {
    // a first run that died after `changeset publish` put tinyzoo and @tinyzoo/client on npm
    const { status, out, state } = release({ npm: [CMS, CLIENT], publishes: [CREATE] })
    expect(status, out).toBe(0)
    expect(state.npm.sort()).toEqual([...packages].sort())
    expect(state.remoteTags.sort()).toEqual([...packages].sort())
    expect(state.localTags.sort()).toEqual([...packages].sort())
    expect(created(state).sort()).toEqual([...packages].sort())
  })

  it('the re-run after the tagging half-worked skips what exists: no second tag, push or release', () => {
    const { status, out, state } = release({
      npm: [CMS, CLIENT], publishes: [CREATE],
      localTags: [CMS, CLIENT], remoteTags: [CMS, CLIENT], releases: [CMS, CLIENT],
    })
    expect(status, out).toBe(0)
    expect(state.log.filter((l) => l.startsWith('git tag'))).toEqual([`git tag ${CREATE} v1sha`])
    expect(state.log.filter((l) => l.startsWith('git push'))).toEqual([`git push origin refs/tags/${CREATE}`])
    expect(created(state)).toEqual([CREATE])
  })

  it('a tag that is local but was never pushed is pushed', () => {
    const { state } = release({ npm: [CMS, CLIENT], publishes: [CREATE], localTags: [CMS] })
    expect(state.remoteTags.sort()).toEqual([...packages].sort())
    expect(state.log.filter((l) => l.startsWith('git tag'))).toEqual([`git tag ${CLIENT} v1sha`, `git tag ${CREATE} v1sha`])
  })
})
