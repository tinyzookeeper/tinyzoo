// The upgrade test: can a site made on an older tinyzoo move to this one?
//
//   node scripts/upgrade-check.mjs                  every baseline in .github/upgrade-baseline
//                                                   (plus the latest release tag, when there is one)
//   node scripts/upgrade-check.mjs --from <ref>     one baseline: a commit, a tag, or `latest-tag`
//   options: --keep           keep the temporary folder and database (paths are printed)
//            --verbose        stream the output of every command (otherwise only a failing one is shown)
//            --logs <dir>     copy the command logs there (CI uploads them when the check fails)
//
// For each baseline:
//   1. Old site. <ref> is checked out into a git worktree, installed and packed; its own
//      `tinyzoo init` makes a site (outside the workspace) whose tinyzoo and @tinyzoo/client are
//      the packed tarballs. It is built, started in production mode with migrations on start
//      against a fresh database, set up through the API and seeded with content (pages with
//      blocks and a translation, news with images, settings, navigation, a form message). What
//      the content API and the admin return is recorded; the server is stopped.
//   2. Upgrade. The CURRENT workspace packages are packed and installed into the same site
//      (replacing the tarballs) and `tinyzoo upgrade` runs without a terminal. A migration the
//      guard refuses (a breaking change without its documented steps) fails the check with the
//      guard's reasons: that is what the check is for.
//   3. New site. Built, started with migrations on start against the SAME database and the SAME
//      environment, except for what the docs tell a site to change (below). Checked: it starts, `tinyzoo status`
//      has nothing pending, the old account signs in (and the session opens the admin API), a
//      browser session from the old site does not break anything, the content API and the admin
//      return the same content field by field (only differences written down in
//      scripts/upgrade-check/differences.mjs or a baseline's hook are allowed), every recorded file
//      is still served, and the admin can open and save every entry unchanged. When the old site
//      ran on NUXT_SESSION_PASSWORD (tinyzoo 0.3 and older), the upgraded site is first started
//      with that environment, as a deploy nobody touched: it must refuse, naming NUXT_APP_SECRET.
//      Then the variable is renamed as docs/upgrading.md says (NUXT_APP_SECRET, same value) and
//      everything above is checked on that site.
//
// A baseline can have a hook file, scripts/upgrade-check/<ref>.mjs, for manual steps its
// changelog documents: see scripts/upgrade-check/README.md. Databases created here are named
// cms_upcheck_*; nothing else in the server is touched, and only servers started here are stopped.
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import pg from 'pg'
import differences from './upgrade-check/differences.mjs'
import { lockfileVersions, newestTag, workspaceOverrides } from './upgrade-check/workspace.mjs'
import { ACCOUNT, applyRules, checkMedia, Client, describe, diff, formatDifference, saveEverything, seedViaApi, signIn, snapshot } from './upgrade-check/site.mjs'

const root = join(import.meta.dirname, '..')
const SETUP_TOKEN = 'upgrade-check-setup-code'
// The site's sign-in secret. A baseline whose starter documents NUXT_APP_SECRET (0.4 and later)
// gets it under that name, an older one as NUXT_SESSION_PASSWORD, as its own docs said; the
// upgraded site gets it as NUXT_APP_SECRET (NUXT_SESSION_PASSWORD is not read from 0.6).
const SITE_SECRET = 'upgrade-check-session-password-at-least-32-characters'
/** Keys that change when an entry is saved; ignored when comparing before and after a save. */
const SAVE_NOISE = ['updatedAt', 'updatedBy', '__version', 'lastmod']

// Seeding plugs in here. `tinyzoo seed` (slice I) gets an entry once the baselines have it:
// a function (ctx) → void that runs it against the old site, selected with `--seed cli`.
const SEEDERS = { api: (ctx) => seedViaApi(ctx.baseURL, { setupToken: SETUP_TOKEN, log: ctx.log }) }

// ── arguments ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const values = (name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : [])).filter(Boolean)
if (flag('--help') || flag('-h')) {
  console.log(readFileSync(import.meta.filename, 'utf8').split('\n').slice(0, 9).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'))
  process.exit(0)
}
const options = {
  keep: flag('--keep'),
  verbose: flag('--verbose'),
  logs: values('--logs')[0],
  seed: values('--seed')[0] ?? 'api',
}
if (!SEEDERS[options.seed]) fail(`unknown --seed ${options.seed} (known: ${Object.keys(SEEDERS).join(', ')})`)

function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(2)
}

// ── small helpers ────────────────────────────────────────────────────────────────

const t0 = Date.now()
const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`
const indent = (text, by = '    ') => String(text).trimEnd().split('\n').map((l) => by + l).join('\n')
const tail = (text, n = 40) => String(text).trimEnd().split('\n').slice(-n).join('\n')
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

class CheckFailure extends Error {
  constructor(message, details) {
    super(message)
    this.details = details
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

// ── baselines ────────────────────────────────────────────────────────────────────

const latestTag = () => newestTag(git('tag', '--list', 'v[0-9]*', 'tinyzoo@[0-9]*').split('\n').filter(Boolean))

function baselineList() {
  const asked = values('--from').flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean)
  if (asked.length) return asked
  const file = join(root, '.github/upgrade-baseline')
  const listed = existsSync(file)
    ? readFileSync(file, 'utf8').split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean)
    : []
  // Once releases exist the latest one is a baseline without anyone adding it.
  return listed.includes('latest-tag') ? listed : [...listed, 'latest-tag']
}

function resolveBaselines() {
  const out = []
  for (const ref of baselineList()) {
    const actual = ref === 'latest-tag' ? latestTag() : ref
    if (!actual) { console.log('· latest-tag: no release tag yet, nothing to check'); continue }
    let sha
    try { sha = git('rev-parse', '--verify', `${actual}^{commit}`) }
    catch { fail(`baseline "${actual}" is not a commit or tag in this clone${process.env.CI ? ' (does the checkout have full history and tags: fetch-depth: 0?)' : ''}`) }
    if (out.some((b) => b.sha === sha)) continue
    out.push({ ref, name: actual, sha })
  }
  return out
}

/** scripts/upgrade-check/<ref>.mjs: by the name the baseline is listed under, its short or full commit. */
async function loadHook(baseline) {
  const names = [...new Set([baseline.name, baseline.ref, git('rev-parse', '--short', baseline.sha), baseline.sha])]
  for (const name of names) {
    const file = join(import.meta.dirname, 'upgrade-check', `${name.replace(/[^\w.@-]+/g, '_')}.mjs`)
    if (!existsSync(file)) continue
    const hook = (await import(pathToFileURL(file))).default ?? {}
    if (!hook.description) throw new CheckFailure(`${file} needs a \`description\`: the documented step it stands for, with the changelog entry it comes from.`)
    return { ...hook, file: file.slice(root.length + 1) }
  }
  return null
}

// ── database ─────────────────────────────────────────────────────────────────────

function adminDatabaseUrl() {
  const source = process.env.UPGRADE_CHECK_DATABASE_URL || process.env.TEST_DATABASE_URL
  if (!source) fail('set UPGRADE_CHECK_DATABASE_URL (or TEST_DATABASE_URL) to a Postgres server; the check creates its own cms_upcheck_* databases there')
  const url = new URL(source)
  url.pathname = '/postgres'
  return url
}

async function withAdmin(fn) {
  const client = new pg.Client({ connectionString: adminDatabaseUrl().toString() })
  await client.connect()
  try { return await fn(client) }
  finally { await client.end() }
}

const databaseUrl = (name) => { const u = adminDatabaseUrl(); u.pathname = `/${name}`; return u.toString() }
const createDatabase = (name) => withAdmin((c) => c.query(`create database "${name}"`))
const dropDatabase = (name) => {
  if (!/^cms_upcheck_[a-z0-9_]+$/.test(name)) throw new Error(`refusing to drop ${name}`)
  return withAdmin((c) => c.query(`drop database if exists "${name}" with (force)`))
}

// ── one baseline ─────────────────────────────────────────────────────────────────

async function checkBaseline(baseline) {
  const work = mkdtempSync(join(tmpdir(), 'tinyzoo-upgrade-'))
  const dirs = { work, src: join(work, 'baseline'), packsOld: join(work, 'packs-old'), packsNew: join(work, 'packs-new'), site: join(work, 'site'), uploads: join(work, 'uploads'), mail: join(work, 'mail'), logs: join(work, 'logs') }
  for (const d of [dirs.packsOld, dirs.packsNew, dirs.uploads, dirs.mail, dirs.logs]) mkdirSync(d, { recursive: true })
  const dbName = `cms_upcheck_${Math.random().toString(36).slice(2, 10)}`
  const steps = []
  const notes = []
  let server = null
  let worktree = false
  let database = false
  let failure = null
  const started = Date.now()
  let logSeq = 0

  const say = (text) => console.log(text)
  const note = (text) => { notes.push(text); const [first, ...rest] = String(text).split('\n'); say([`    · ${first}`, ...rest.map((l) => `      ${l}`)].join('\n')) }

  /** Run a command; its output goes to a log file (and the terminal with --verbose). */
  function sh(label, cmd, cmdArgs, { cwd = root, env = {}, allowFail = false, show = false } = {}) {
    const logFile = join(dirs.logs, `${String(++logSeq).padStart(2, '0')}-${label.replace(/[^\w]+/g, '-')}.log`)
    const res = spawnSync(cmd, cmdArgs, { cwd, env: { ...process.env, ...env }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024, timeout: 15 * 60_000 })
    const output = `${res.stdout ?? ''}${res.stderr ?? ''}`
    writeFileSync(logFile, `$ ${cmd} ${cmdArgs.join(' ')}\n(cwd ${cwd})\n\n${output}`)
    // drizzle-kit lists every table it reads; that is noise here.
    const shown = output.split('\n').filter((l) => !/^\S+ \d+ columns \d+ indexes \d+ fks$|^(No config path provided|Reading config file)/.test(l)).join('\n')
    if (options.verbose || (show && res.status === 0)) say(indent(shown))
    if (res.status !== 0 && !allowFail) {
      throw new CheckFailure(`\`${cmd} ${cmdArgs.join(' ')}\` failed (${res.error?.message ?? `exit ${res.status}`})`, tail(shown, 60))
    }
    return { status: res.status, output: shown }
  }

  async function step(name, fn) {
    const at = Date.now()
    say(`▸ ${name}`)
    try {
      const result = await fn()
      steps.push({ name, ok: true, ms: Date.now() - at })
      say(`  ✓ ${name} (${seconds(Date.now() - at)})`)
      return result
    }
    catch (err) {
      steps.push({ name, ok: false, ms: Date.now() - at })
      say(`  ✗ ${name} (${seconds(Date.now() - at)})`)
      throw err
    }
  }

  // The site's environment: production mode, the one database, a local upload folder shared
  // by both versions (the files are the thing that must survive).
  const siteEnv = {
    DATABASE_URL: databaseUrl(dbName),
    NUXT_CMS_MIGRATIONS_ON_START: 'true',
    NUXT_CMS_AUTH_SETUP_TOKEN: SETUP_TOKEN, // refs before the generated setup code (slice D) honour it too
    NUXT_CMS_STORAGE_DRIVER: 'local',
    NUXT_CMS_STORAGE_LOCAL_DIR: dirs.uploads,
    NUXT_CMS_MAIL_TRANSPORT: 'file',
    NUXT_CMS_MAIL_FILE_DIR: dirs.mail,
    ...(process.env.UPGRADE_CHECK_REDIS_URL ? { NUXT_CMS_REDIS_URL: process.env.UPGRADE_CHECK_REDIS_URL, NUXT_CMS_REDIS_PREFIX: `${dbName}:` } : {}),
  }

  async function startServer(label, { expectRefusal = false } = {}) {
    const port = await freePort()
    const baseURL = `http://127.0.0.1:${port}`
    const logFile = join(dirs.logs, `server-${label}.log`)
    writeFileSync(logFile, '')
    const child = spawn(process.execPath, [join(dirs.site, '.output/server/index.mjs')], {
      cwd: dirs.site,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...siteEnv, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port), NUXT_CMS_PUBLIC_URL: baseURL },
    })
    let output = ''
    const keep = (d) => { output += d; appendFileSync(logFile, d); if (options.verbose) process.stdout.write(indent(d)) }
    child.stdout.on('data', keep)
    child.stderr.on('data', keep)
    const handle = {
      baseURL,
      output: () => output,
      async stop() {
        if (child.exitCode !== null || child.signalCode) return
        child.kill('SIGTERM') // this child's PID only
        const gone = await Promise.race([new Promise((r) => child.once('exit', () => r(true))), new Promise((r) => setTimeout(() => r(false), 10_000))])
        if (!gone) { child.kill('SIGKILL'); await new Promise((r) => child.once('exit', r)) }
      },
    }
    server = handle
    const deadline = Date.now() + 120_000
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        if (expectRefusal) { server = null; return { refused: true, output: () => output } }
        throw new CheckFailure(`the ${label} site exited with ${child.exitCode} while starting`, tail(output, 60))
      }
      try {
        const res = await fetch(`${baseURL}/api/health/ready`)
        if (res.status === 200) {
          if (expectRefusal) { await handle.stop(); server = null; throw new CheckFailure(`the ${label} site started, but it should have refused to`, tail(output, 40)) }
          return handle
        }
      }
      catch { /* not listening yet */ }
      await new Promise((r) => setTimeout(r, 250))
    }
    throw new CheckFailure(`the ${label} site was not ready within 2 minutes`, tail(output, 60))
  }

  /** The site's package.json for one side of the upgrade: tarballs, versions as the ref's lockfile has them. */
  function writeSiteManifest(refRoot, packs) {
    const file = join(dirs.site, 'package.json')
    const pkg = JSON.parse(readFileSync(file, 'utf8'))
    const tarball = (re) => join(packs, readdirSync(packs).find((f) => re.test(f)))
    pkg.dependencies.tinyzoo = `file:${tarball(/^tinyzoo-\d/)}`
    pkg.dependencies['@tinyzoo/client'] = `file:${tarball(/^tinyzoo-client-\d/)}`
    const pins = lockfileVersions(refRoot, 'packages/cms/starter')
    if (!Object.keys(pins).length) note('no starter entry in the lockfile: dependency ranges are left as they are')
    for (const group of [pkg.dependencies, pkg.devDependencies]) {
      for (const name of Object.keys(group ?? {})) if (pins[name] && name !== 'tinyzoo' && name !== '@tinyzoo/client') group[name] = pins[name]
    }
    pkg.pnpm = { ...pkg.pnpm, overrides: workspaceOverrides(refRoot) }
    writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n')
  }

  const ctx = { ref: baseline.name, sha: baseline.sha, dirs, siteEnv, sh, note, say, log: (t) => note(t) }

  say(`\n━━ ${baseline.name} (${baseline.sha.slice(0, 7)}) → current workspace (${git('rev-parse', '--short', 'HEAD')}${git('status', '--porcelain') ? ' + uncommitted changes' : ''}) ━━`)
  try {
    const hook = await loadHook(baseline)
    if (hook) note(`hook ${hook.file}: ${hook.description}`)

    // 1. The old site ────────────────────────────────────────────────────────────
    await step(`check out ${baseline.name}`, () => {
      sh('worktree', 'git', ['worktree', 'add', '--detach', dirs.src, baseline.sha])
      worktree = true
    })
    // The variable the baseline's own docs name for the sign-in secret (see SITE_SECRET).
    const secretVar = /^NUXT_APP_SECRET=/m.test(readFileSync(join(dirs.src, 'packages/cms/starter/.env.example'), 'utf8')) ? 'NUXT_APP_SECRET' : 'NUXT_SESSION_PASSWORD'
    siteEnv[secretVar] = SITE_SECRET
    note(`the site's sign-in secret is ${secretVar}, as the baseline's starter documents it; the upgraded site gets the same environment, except that a baseline on NUXT_SESSION_PASSWORD is first refused and then renamed to NUXT_APP_SECRET, as docs/upgrading.md says`)
    await step('install and pack the baseline', () => {
      sh('baseline-install', 'pnpm', ['install', '--frozen-lockfile'], { cwd: dirs.src })
      sh('baseline-pack-cms', 'pnpm', ['pack', '--pack-destination', dirs.packsOld], { cwd: join(dirs.src, 'packages/cms') })
      sh('baseline-pack-client', 'pnpm', ['pack', '--pack-destination', dirs.packsOld], { cwd: join(dirs.src, 'packages/client') })
    })
    const oldVersion = JSON.parse(readFileSync(join(dirs.src, 'packages/cms/package.json'), 'utf8')).version
    await step('make a site with the baseline\'s `tinyzoo init` and install the tarballs', () => {
      sh('init', 'pnpm', ['exec', 'tsx', 'cli/index.ts', 'init', dirs.site], { cwd: join(dirs.src, 'packages/cms') })
      writeSiteManifest(dirs.src, dirs.packsOld)
      sh('site-install', 'pnpm', ['install', '--ignore-workspace', '--no-frozen-lockfile'], { cwd: dirs.site })
      note(`tinyzoo ${oldVersion} installed from the baseline's tarball`)
    })
    await step('create the database and build the old site', async () => {
      await createDatabase(dbName)
      database = true
      sh('site-build', 'pnpm', ['exec', 'nuxt', 'build'], { cwd: dirs.site, env: { NODE_ENV: 'production' } })
    })

    let before
    let oldCookie = ''
    let account = ACCOUNT
    await step('start the old site (migrations on start), set it up and seed it', async () => {
      const old = await startServer('old')
      const applied = old.output().split('\n').filter((l) => /\[cms\] applied migrations/.test(l))
      if (applied.length) note(applied.join(' ').trim())
      await (hook?.seed ?? SEEDERS[options.seed])({ ...ctx, baseURL: old.baseURL })
      const oldAdmin = await signIn(old.baseURL, account)
      oldCookie = oldAdmin.cookie
      before = await snapshot(old.baseURL, oldAdmin)
      note(`recorded: ${describe(before)}`)
      if (!Object.keys(before.content).length || !Object.keys(before.admin).length) throw new CheckFailure('the seeding left nothing to compare: the site returned no content')
      await old.stop()
      server = null
    })

    // 2. The upgrade ─────────────────────────────────────────────────────────────
    await step('pack the current workspace and install it into the same site', () => {
      sh('current-pack-cms', 'pnpm', ['pack', '--pack-destination', dirs.packsNew], { cwd: join(root, 'packages/cms') })
      sh('current-pack-client', 'pnpm', ['pack', '--pack-destination', dirs.packsNew], { cwd: join(root, 'packages/client') })
      writeSiteManifest(root, dirs.packsNew)
      sh('site-reinstall', 'pnpm', ['install', '--ignore-workspace', '--no-frozen-lockfile'], { cwd: dirs.site })
      const installed = readFileSync(join(dirs.site, 'node_modules/tinyzoo/cli/index.ts'), 'utf8')
      if (installed !== readFileSync(join(root, 'packages/cms/cli/index.ts'), 'utf8')) throw new CheckFailure('the site still has the old tinyzoo: its CLI differs from the workspace\'s')
      const version = JSON.parse(readFileSync(join(dirs.site, 'node_modules/tinyzoo/package.json'), 'utf8')).version
      note(`tinyzoo ${oldVersion} → ${version} (the current build)`)
    })

    await step('`tinyzoo upgrade` (no terminal)', async () => {
      const migrations = join(dirs.site, 'server/db/migrations')
      const known = new Set(readdirSync(migrations))
      await hook?.beforeUpgrade?.({ ...ctx, siteDir: dirs.site })
      const res = sh('upgrade', 'pnpm', ['exec', 'tinyzoo', 'upgrade', ...(hook?.upgradeArgs ?? [])], { cwd: dirs.site, env: { DATABASE_URL: siteEnv.DATABASE_URL }, allowFail: true, show: true })
      if (res.status !== 0) {
        throw new CheckFailure(
          'tinyzoo upgrade stopped, so a site on this baseline cannot upgrade by following the docs',
          `${tail(res.output, 60)}\n\nIf the guard refused a change: the change needs its documented steps (docs/upgrading.md, the Upgrade section of its changeset),\n`
          + `or - for a step the changelog documents and a site really does by hand - a hook file scripts/upgrade-check/${baseline.name.replace(/[^\w.@-]+/g, '_')}.mjs (see scripts/upgrade-check/README.md).`,
        )
      }
      await hook?.afterUpgrade?.({ ...ctx, siteDir: dirs.site })
      const added = readdirSync(migrations).filter((f) => f.endsWith('.sql') && !known.has(f))
      if (!added.length) note('the schema did not change: no migration')
      for (const f of added) note(`migration ${f}:\n${readFileSync(join(migrations, f), 'utf8').trim().split('\n').slice(0, 40).join('\n')}`)
    })

    // 3. The new site ────────────────────────────────────────────────────────────
    await step('build the upgraded site', () => {
      rmSync(join(dirs.site, '.output'), { recursive: true, force: true })
      rmSync(join(dirs.site, '.nuxt'), { recursive: true, force: true })
      sh('site-rebuild', 'pnpm', ['exec', 'nuxt', 'build'], { cwd: dirs.site, env: { NODE_ENV: 'production' } })
    })

    if (secretVar === 'NUXT_SESSION_PASSWORD') {
      // 0.6 no longer reads NUXT_SESSION_PASSWORD: a deploy that still has only it must say what to do, not start.
      await step('the unchanged environment (only NUXT_SESSION_PASSWORD) is refused, naming NUXT_APP_SECRET', async () => {
        const refused = await startServer('refused', { expectRefusal: true })
        const text = refused.output()
        if (!refused.refused) throw new CheckFailure('the upgraded site started with only NUXT_SESSION_PASSWORD set')
        if (!/NUXT_APP_SECRET is not set/.test(text) || !/NUXT_SESSION_PASSWORD is set, but no longer used/.test(text) || !/Rename the variable to NUXT_APP_SECRET/.test(text)) {
          throw new CheckFailure('the upgraded site refused to start, but its message does not say to rename NUXT_SESSION_PASSWORD to NUXT_APP_SECRET', tail(text, 40))
        }
        if (text.includes(SITE_SECRET)) throw new CheckFailure('the refusal printed the secret', tail(text, 40))
        note('refused, naming NUXT_APP_SECRET and the rename')
        // What docs/upgrading.md ("From 0.5 to 0.6") tells a site to do: the same value under the new name.
        delete siteEnv.NUXT_SESSION_PASSWORD
        siteEnv.NUXT_APP_SECRET = SITE_SECRET
        note('NUXT_SESSION_PASSWORD renamed to NUXT_APP_SECRET, same value, as the docs say')
      })
    }

    await step('start the upgraded site against the same database', async () => {
      const now = await startServer('new')
      const lines = now.output().split('\n').filter((l) => /\[cms\] (applied|upgrade|migrat)/i.test(l) || /\[tinyzoo\] deprecated:/.test(l))
      for (const l of lines) note(l.trim())
    })

    await step('`tinyzoo status` has nothing pending', () => {
      const res = sh('status', 'pnpm', ['exec', 'tinyzoo', 'status'], { cwd: dirs.site, env: { DATABASE_URL: siteEnv.DATABASE_URL }, allowFail: true, show: true })
      if (res.status !== 0) throw new CheckFailure(`tinyzoo status exited ${res.status}: the upgraded site left something pending`, tail(res.output, 40))
    })

    const baseURL = server.baseURL
    let admin
    await step('the old account signs in', async () => {
      admin = await signIn(baseURL, account)
      // Signed in for real: the cookie the sign-in set opens the admin API as that account.
      const me = await admin.get('/api/cms/_auth/me')
      if (me.status !== 200 || me.body?.user?.email !== account.email) {
        throw new CheckFailure(`the sign-in answered 200, but its session does not open the admin API (GET /api/cms/_auth/me: ${me.status})`, tail(server.output(), 40))
      }
      note(`signed in as ${account.email}; session cookie ${admin.cookie.split('=')[0]}`)
    })

    await step('a browser session from the old site breaks nothing', async () => {
      const browser = new Client(baseURL)
      browser.cookie = oldCookie
      const me = await browser.get('/api/cms/_auth/me')
      const page = await browser.get('/admin')
      for (const [what, res] of [['GET /api/cms/_auth/me', me], ['GET /admin', page]]) {
        if (res.status >= 500) throw new CheckFailure(`${what} with the old site's session cookie: HTTP ${res.status}`, tail(server.output(), 40))
      }
      note(me.status === 200 ? 'the old session still opens the admin' : `the old session no longer opens the admin (${me.status}): everyone signs in again once`)
    })

    let after
    await step('content API and admin return what they returned before', async () => {
      after = await snapshot(baseURL, admin)
      const rules = [...differences, ...(hook?.differences ?? [])]
      const { allowed, unexpected } = applyRules(diff(before, after), rules)
      note(`compared: ${describe(after)}`)
      if (allowed.length) {
        note(`${allowed.length} difference${allowed.length === 1 ? '' : 's'} allowed by the documented list:`)
        const byReason = Map.groupBy(allowed, (d) => d.why)
        for (const [why, group] of byReason) say(indent(`${group.length}× e.g. ${formatDifference(group[0])}\n↳ ${why}`, '        '))
      }
      if (unexpected.length) {
        throw new CheckFailure(
          `${unexpected.length} unexpected difference${unexpected.length === 1 ? '' : 's'} between the old and the upgraded site`,
          `${unexpected.slice(0, 30).map(formatDifference).join('\n')}${unexpected.length > 30 ? `\n… and ${unexpected.length - 30} more` : ''}\n\n`
          + 'Expected? Then it belongs in the changelog under Upgrade, and in scripts/upgrade-check/differences.mjs with the reason.',
        )
      }
      note('no unexpected difference')
    })

    await step('every file is still served', async () => {
      const problems = await checkMedia(baseURL, before, after)
      if (problems.length) throw new CheckFailure('files that were served before are not served now', problems.join('\n'))
      note(`${Object.keys(before.media).length} files served with identical bytes`)
    })

    await step('the admin opens and saves every entry', async () => {
      const { saved, failures } = await saveEverything(admin, before)
      if (failures.length) throw new CheckFailure(`${failures.length} entr${failures.length === 1 ? 'y' : 'ies'} could not be saved`, failures.join('\n'))
      const perEntity = Map.groupBy(saved, (s) => s.split(' ')[0])
      note(`opened and saved ${saved.length} (${[...perEntity].map(([name, list]) => `${name} ${list.length}`).join(', ')}; translations included)`)
      const resaved = await snapshot(baseURL, admin)
      const { unexpected } = applyRules(diff(after, resaved, { ignoreKeys: SAVE_NOISE }), [...differences, ...(hook?.differences ?? [])])
      if (unexpected.length) throw new CheckFailure('saving entries unchanged changed their content', unexpected.slice(0, 30).map(formatDifference).join('\n'))
      note('saving changed nothing but timestamps')
    })

  }
  catch (err) {
    failure = err
  }
  finally {
    try { await server?.stop() } catch { /* the process is gone */ }
    if (options.logs) {
      mkdirSync(options.logs, { recursive: true })
      cpSync(dirs.logs, join(options.logs, baseline.name.replace(/[^\w.@-]+/g, '_')), { recursive: true })
    }
    if (options.keep) {
      say(`\nkept: ${work}${database ? `\n      database ${dbName} on ${adminDatabaseUrl().host}` : ''}\n      site: ${dirs.site}   logs: ${dirs.logs}`)
    }
    else {
      if (worktree) { try { git('worktree', 'remove', '--force', dirs.src) } catch { /* removed with the folder */ } }
      try { git('worktree', 'prune') } catch { /* nothing to prune */ }
      if (database) { try { await dropDatabase(dbName) } catch (e) { say(`! could not drop ${dbName}: ${e.message}`) } }
      rmSync(work, { recursive: true, force: true })
    }
  }
  return { baseline, ok: !failure, failure, steps, notes, ms: Date.now() - started }
}

// ── main ─────────────────────────────────────────────────────────────────────────

const baselines = resolveBaselines()
if (!baselines.length) {
  console.log('Nothing to check: no baselines.')
  process.exit(0)
}
const results = []
for (const b of baselines) results.push(await checkBaseline(b))

console.log('\n══ Upgrade check ══')
for (const r of results) {
  console.log(`${r.ok ? '✓' : '✗'} ${r.baseline.name} (${r.baseline.sha.slice(0, 7)}) → current: ${r.ok ? 'passed' : 'FAILED'} in ${seconds(r.ms)}`)
  for (const s of r.steps) console.log(`    ${s.ok ? '✓' : '✗'} ${s.name} (${seconds(s.ms)})`)
  if (!r.ok) {
    console.log(`\n  ${r.failure.message}`)
    if (r.failure.details) console.log(indent(r.failure.details, '    '))
    if (!(r.failure instanceof CheckFailure)) console.log(indent(r.failure.stack ?? String(r.failure), '    '))
  }
}
console.log(`total ${seconds(Date.now() - t0)}`)

if (process.env.GITHUB_STEP_SUMMARY) {
  const md = [`## Upgrade check`, '', '| Baseline | Result | Time |', '|---|---|---|']
  for (const r of results) md.push(`| \`${r.baseline.name}\` (${r.baseline.sha.slice(0, 7)}) | ${r.ok ? '✅ passed' : '❌ failed'} | ${seconds(r.ms)} |`)
  for (const r of results.filter((x) => !x.ok)) {
    const failed = r.steps.find((s) => !s.ok)
    md.push('', `### ❌ ${r.baseline.name}: ${failed?.name ?? 'setup'}`, '', r.failure.message, '', '```', r.failure.details ?? r.failure.stack ?? '', '```')
  }
  try { appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md.join('\n')}\n`) } catch { /* summary is optional */ }
}
if (process.env.GITHUB_ACTIONS) {
  for (const r of results.filter((x) => !x.ok)) console.log(`::error title=Upgrade check from ${r.baseline.name} failed::${r.steps.find((s) => !s.ok)?.name ?? 'setup'}: ${r.failure.message}`)
}
process.exit(results.every((r) => r.ok) ? 0 : 1)
