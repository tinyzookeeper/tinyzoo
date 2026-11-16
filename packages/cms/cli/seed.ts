/**
 * `tinyzoo seed [file]` — put a site's seed content (`seed/index.ts`, written with
 * `defineSeed`) into a running site.
 *
 *   SEED_PASSWORD=… tinyzoo seed --url http://localhost:3000 --email you@example.com
 *
 *   [file]           the seed (default seed/index.ts)
 *   --url            where the site runs (default $SEED_URL, else http://localhost:3000)
 *   --email          the administrator to sign in as ($SEED_EMAIL); the password is
 *                    $SEED_PASSWORD only — never an argument, which would show in `ps`
 *   --name           the first administrator's name when the site has none yet ($SEED_NAME)
 *   --setup-code     the code a new production site asks for before its first account
 *                    (the server's log prints it, or it is NUXT_CMS_AUTH_SETUP_TOKEN).
 *                    Prefer $SEED_SETUP_CODE: an argument shows in `ps` (the command says so)
 *   --dry-run        sign in, read, and say what would be created, changed or uploaded;
 *                    nothing is written
 *   --reset          first remove the entries and files this seed made (found by their
 *                    key / name, and made by the account the seed signs in with: a page
 *                    an editor made with the same address stays), then seed again. It
 *                    lists every entry and file first and asks (`--yes` skips the
 *                    question); if anything would be refused (a page another page still
 *                    links to) it stops before removing anything
 *   --verbose        also list what was already up to date
 *   --wait <sec>     how long to wait for the site to answer (default 30)
 *
 * Why over HTTP and not straight into the database: the seed goes through the admin's own
 * API, so each write is checked, stored and indexed by the same code an editor's save
 * runs (validation, translations, media handling and sizes, the search index, saved
 * versions, webhooks, access rules) — a seeded site cannot differ from one an editor
 * filled in. It also works against a site that is deployed, where the database is not
 * reachable from here, and needs nothing but the site's address and an administrator.
 */
import { existsSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { buildRegistry } from '../src/index'
import { isSeed, type SeedDefinition } from '../src/seed'
import { parseArgs } from './transfer'
import {
  describeReset, planReset, resetDeclared, runSeed, SeedError,
  type MediaRow, type Row, type SeedBackend, type SeedOp,
} from './seed-engine'

export class HttpError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** A readable one-liner out of an error response (validation issues listed by field). */
function errorMessage(status: number, body: any, text: string): string {
  const issues = Array.isArray(body?.data) ? body.data : Array.isArray(body?.data?.issues) ? body.data.issues : []
  const listed = issues.slice(0, 6).map((i: any) => `${Array.isArray(i?.path) && i.path.length ? `${i.path.join('.')}: ` : ''}${i?.message ?? JSON.stringify(i)}`).join('; ')
  const base = body?.statusMessage ?? body?.message ?? (typeof text === 'string' ? text.slice(0, 200) : '')
  return `${status === 0 ? '' : `${status} `}${base}${listed ? ` — ${listed}` : ''}`.trim()
}

/** Cookie-keeping JSON client for the admin API. */
export class SiteClient {
  private cookie = ''
  constructor(readonly base: string) {}

  async request<T = any>(method: string, path: string, body?: unknown, opts: { notFound?: boolean } = {}): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      const headers: Record<string, string> = { accept: 'application/json', origin: this.base }
      if (this.cookie) headers.cookie = this.cookie
      let payload: BodyInit | undefined
      if (body instanceof FormData) payload = body
      else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body) }
      const res = await fetch(this.base + path, { method, headers, body: payload, redirect: 'manual', signal: AbortSignal.timeout(120_000) })
      const set = res.headers.getSetCookie?.() ?? []
      if (set.length) this.cookie = set.map((c) => c.split(';')[0]).join('; ')
      const text = await res.text()
      let json: any = null
      try { json = text ? JSON.parse(text) : null } catch { /* not JSON */ }
      // The upload limit (60 a minute) clears within the minute: wait and go on. The sign-in
      // limits last fifteen minutes; waiting here would only look like a hang.
      if (res.status === 429 && path === '/api/cms/_media' && attempt <= 4) {
        await sleep(Math.min(10 * attempt, 30) * 1000)
        continue
      }
      if (res.status === 404 && opts.notFound) return null as T
      if (res.status >= 300) throw new HttpError(`${method} ${path} → ${errorMessage(res.status, json, text)}`, res.status)
      return json as T
    }
  }
}

const enc = encodeURIComponent

/** The seed's reads and writes as calls to the admin API. */
export function httpBackend(site: SiteClient): SeedBackend {
  return {
    async account() { return (await site.request<{ user: { id?: string } | null }>('GET', '/api/cms/_auth/me')).user?.id ?? null },
    async list(entity) {
      const rows: Row[] = []
      for (let page = 1; ; page++) {
        const r = await site.request<{ rows: Row[]; total: number }>('GET', `/api/cms/${enc(entity)}?limit=100&page=${page}&sort=createdAt&dir=asc`)
        rows.push(...r.rows)
        if (!r.rows.length || rows.length >= r.total) return rows
      }
    },
    async get(entity, id, locale) {
      const r = await site.request<{ row: Row }>('GET', `/api/cms/${enc(entity)}/${enc(id)}${locale ? `?locale=${enc(locale)}` : ''}`, undefined, { notFound: true })
      return r?.row ?? null
    },
    async create(entity, data) { return (await site.request<{ row: Row }>('POST', `/api/cms/${enc(entity)}`, data)).row },
    async update(entity, id, data, locale) {
      return (await site.request<{ row: Row }>('PATCH', `/api/cms/${enc(entity)}/${enc(id)}${locale ? `?locale=${enc(locale)}` : ''}`, data)).row
    },
    async remove(entity, id) { await site.request('DELETE', `/api/cms/${enc(entity)}/${enc(id)}`) },
    async getGlobal(entity, locale) {
      const r = await site.request<{ row: Row | null }>('GET', `/api/cms/_singleton/${enc(entity)}${locale ? `?locale=${enc(locale)}` : ''}`)
      return r.row ?? null
    },
    async putGlobal(entity, data, locale) {
      return (await site.request<{ row: Row }>('PUT', `/api/cms/_singleton/${enc(entity)}${locale ? `?locale=${enc(locale)}` : ''}`, data)).row
    },
    async findMedia(q) {
      for (let page = 1; ; page++) {
        const r = await site.request<{ items: MediaRow[]; total: number }>(
          'GET', `/api/cms/_media?limit=60&page=${page}&q=${enc(q.name.slice(0, 100))}&folder=${enc(q.folder ?? 'none')}`,
        )
        const hit = r.items.find((m) => m.name === q.name && (m.folder ?? null) === q.folder && Number(m.size) === q.size && m.mime === q.mime)
        if (hit) return hit
        if (page * 60 >= r.total) return null
      }
    },
    async uploadMedia(file) {
      const form = new FormData()
      form.append('file', new Blob([file.data as Uint8Array<ArrayBuffer>], { type: file.mime }), file.name)
      if (file.folder) form.append('folder', file.folder)
      if (file.library) form.append('library', '1')
      return site.request<MediaRow>('POST', '/api/cms/_media', form)
    },
    async patchMedia(id, details) { return site.request<MediaRow>('PATCH', `/api/cms/_media/${enc(id)}`, details) },
    async removeMedia(id) { await site.request('DELETE', `/api/cms/_media/${enc(id)}`) },
  }
}

/** A site with nothing in it: what a dry run sees before the first administrator exists. */
export function emptyBackend(): SeedBackend {
  const refuse = () => { throw new Error('read-only run') }
  return {
    account: async () => null, list: async () => [], get: async () => null, getGlobal: async () => null, findMedia: async () => null,
    create: refuse, update: refuse, remove: refuse, putGlobal: refuse, uploadMedia: refuse, patchMedia: refuse, removeMedia: refuse,
  }
}

// ── signing in ──────────────────────────────────────────────────────────────────

interface AuthStatus { mode: string; needsSetup: boolean; needsToken?: boolean; codeIn?: 'config' | 'log' }

async function waitForSite(site: SiteClient, seconds: number): Promise<AuthStatus> {
  const until = Date.now() + seconds * 1000
  let last: unknown
  for (;;) {
    try { return await site.request<AuthStatus>('GET', '/api/cms/_auth/status') }
    catch (err) {
      last = err
      // A refused connection or a start-up error: the site may still be coming up. A real answer (4xx) is final.
      if (err instanceof HttpError && err.status < 500) throw err
      if (Date.now() > until) break
      await sleep(500)
    }
  }
  const reason = last instanceof Error ? ((last as any).cause?.code ?? last.message) : String(last)
  throw new SeedError(`The site at ${site.base} does not answer (${reason}). Start it first (pnpm dev), or pass --url.`)
}

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try { return (await rl.question(question)).trim() }
  finally { rl.close() }
}

export interface SeedConnection {
  email?: string
  password?: string
  name: string
  setupCode?: string
  dryRun: boolean
  /** Whether a person can be asked (a terminal). */
  interactive: boolean
  log: (line: string) => void
}

/** Sign in, or set up the first administrator on a fresh site. Null: a dry run on a site with no account yet. */
export async function connect(site: SiteClient, c: SeedConnection, status: AuthStatus): Promise<'signed-in' | 'created' | null> {
  if (status.mode !== 'builtin') {
    throw new SeedError('This site signs people in with an external provider; the seed needs the CMS\'s own sign-in (it signs in with an email and a password).')
  }
  if (status.needsSetup) {
    if (c.dryRun) return null
    if (!c.email || !c.password) throw new SeedError('The site has no administrator yet. Set SEED_EMAIL (or --email) and SEED_PASSWORD: the seed creates the first account with them.')
    let token = c.setupCode
    if (status.needsToken && !token) {
      const where = status.codeIn === 'log'
        ? 'The server printed it in its log when it started ("No administrator yet. Setup code: …")'
        : 'It is the site\'s NUXT_CMS_AUTH_SETUP_TOKEN'
      if (!c.interactive) throw new SeedError(`This site asks for its setup code before the first account. ${where}. Pass it with --setup-code or SEED_SETUP_CODE.`)
      token = await ask(`Setup code (${where}): `)
    }
    try {
      await site.request('POST', '/api/cms/_auth/setup', { name: c.name, email: c.email, password: c.password, token: token || undefined })
    }
    catch (err) {
      if (err instanceof HttpError && err.status === 403) throw new SeedError('The setup code is missing or wrong.')
      throw err
    }
    c.log(`✓ created the first administrator ${c.email}`)
    return 'created'
  }
  if (!c.email || !c.password) throw new SeedError('Set SEED_EMAIL (or --email) and SEED_PASSWORD: an administrator of the site to sign in as.')
  try {
    await site.request('POST', '/api/cms/_auth/login', { email: c.email, password: c.password })
  }
  catch (err) {
    if (err instanceof HttpError && err.status === 401) throw new SeedError(`Wrong email or password for ${site.base}.`)
    throw err
  }
  return 'signed-in'
}

// ── the command ─────────────────────────────────────────────────────────────────

/** The seed definition a file exports (`export default defineSeed(…)`). */
export async function loadSeed(file: string): Promise<SeedDefinition> {
  const mod = await import(pathToFileURL(file).href)
  const def = mod.default ?? mod.seed
  if (isSeed(def)) return def
  throw new SeedError(`${file} must export a seed: export default defineSeed(async (s) => { … })`)
}

const VERB: Record<string, [string, string]> = {
  created: ['created', 'would create'], updated: ['updated', 'would update'], unchanged: ['unchanged', 'unchanged'],
  kept: ['kept', 'would keep'], uploaded: ['uploaded', 'would upload'],
}

export function formatOp(op: SeedOp, dryRun: boolean): string {
  const [done, would] = VERB[op.action]!
  const verb = (dryRun ? would : done).padEnd(13)
  const mark = op.action === 'unchanged' || op.action === 'kept' ? '·' : '✓'
  return `${mark} ${verb}${op.label}${op.fields?.length && op.action === 'updated' ? ` (${op.fields.join(', ')})` : ''}`
}

export function summarize(ops: SeedOp[], dryRun: boolean): string {
  const n = (a: string, kind?: SeedOp['kind']) => ops.filter((o) => o.action === a && (!kind || o.kind === kind)).length
  const parts = [
    [n('created'), dryRun ? 'to create' : 'created'],
    [n('updated'), dryRun ? 'to update' : 'updated'],
    [n('unchanged'), 'already up to date'],
    [n('kept'), 'left as they are'],
  ].filter(([c]) => c as number > 0).map(([c, w]) => `${c} ${w}`)
  const files = n('uploaded')
  if (files) parts.push(`${files} ${dryRun ? 'files to upload' : files === 1 ? 'file uploaded' : 'files uploaded'}`)
  return parts.length ? parts.join(', ') : 'nothing to do'
}

/** Is this the machine itself: `localhost`, `*.localhost`, 127.0.0.1, ::1? Compared as a whole name, never as the start of one (`localhost.example.com` is somebody else's). */
export function isLocalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return h === 'localhost' || h.endsWith('.localhost') || h === '127.0.0.1' || h === '::1'
}

/** Does this address send the password over the internet unencrypted? (http:// to anything but the machine itself.) */
export function sendsPasswordInTheClear(base: string): boolean {
  const url = new URL(base)
  return url.protocol === 'http:' && !isLocalHostname(url.hostname)
}

export async function seedCommand(config: Record<string, any>, argv: string[], io: { log?: (line: string) => void; env?: NodeJS.ProcessEnv; cwd?: string } = {}): Promise<void> {
  const log = io.log ?? ((line: string) => console.log(line))
  const env = io.env ?? process.env
  const cwd = io.cwd ?? process.cwd()
  const args = parseArgs(argv, ['url', 'email', 'name', 'setup-code', 'wait'], ['reset', 'dry-run', 'yes', 'verbose'])
  const dryRun = args.flags.has('dry-run')
  const reset = args.flags.has('reset')
  const verbose = args.flags.has('verbose')

  const file = resolve(cwd, args.positional[0] ?? ['seed/index.ts', 'seed/index.mjs', 'seed/index.js'].find((f) => existsSync(resolve(cwd, f))) ?? 'seed/index.ts')
  if (!existsSync(file)) {
    throw new SeedError(`No seed file (${file}). Create seed/index.ts with: export default defineSeed(async (s) => { … })`)
  }
  const base = (args.values.url ?? env.SEED_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
  try { new URL(base) } catch { throw new SeedError(`"${base}" is not a web address; pass --url http://localhost:3000.`) }
  if (sendsPasswordInTheClear(base)) {
    log(`! ${base} is not encrypted: the password travels in the clear. Use https:// for a site on the internet.`)
  }
  if (args.values['setup-code']) log('! --setup-code shows in the process list (ps) while the command runs; set SEED_SETUP_CODE in the environment instead.')

  const reg = buildRegistry(config)
  const def = await loadSeed(file)
  const site = new SiteClient(base)
  const status = await waitForSite(site, Number(args.values.wait ?? 30) || 30)
  const connected = await connect(site, {
    email: args.values.email ?? env.SEED_EMAIL,
    password: env.SEED_PASSWORD,
    name: args.values.name ?? env.SEED_NAME ?? 'Admin',
    setupCode: args.values['setup-code'] ?? env.SEED_SETUP_CODE ?? env.SEED_SETUP_TOKEN,
    dryRun,
    interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    log,
  }, status)
  const backend = connected ? httpBackend(site) : emptyBackend()
  if (!connected) log('· The site has no administrator yet: a real run creates the first one. Everything below is new.')

  const print = (op: SeedOp) => { if (verbose || (op.action !== 'unchanged' && op.action !== 'kept')) log(formatOp(op, dryRun)) }

  if (reset) {
    const scanned = (await runSeed(def, { reg, backend, root: cwd, apply: false })).declared
    const plan = await planReset(reg, backend, scanned)
    const files = plan.media.length
    const count = `${plan.entries.length} ${plan.entries.length === 1 ? 'entry' : 'entries'} and ${files} ${files === 1 ? 'file' : 'files'}`
    if (dryRun) {
      log(`· --reset would first remove ${count} the seed made${plan.blocked.length ? ' (but it cannot go through as things are)' : ''}.`)
      for (const line of describeReset(plan, base)) log(line)
    }
    else if (plan.entries.length || plan.media.length || plan.blocked.length) {
      log(`--reset removes ${count} this seed made on ${base}, then seeds again. Everything else stays.`)
      for (const line of describeReset(plan, base)) log(line)
      if (plan.blocked.length) throw new SeedError('Nothing was removed. Change what is listed above, or remove those entries by hand, and run it again.')
      if (!args.flags.has('yes')) {
        if (!process.stdin.isTTY) throw new SeedError('--reset deletes content: add --yes to confirm without a terminal.')
        if (!/^y(es)?$/i.test(await ask('Remove them? [y/N] '))) throw new SeedError('Stopped; nothing was removed.')
      }
      const out = await resetDeclared(backend, plan, log)
      log(`✓ removed ${out.entries} ${out.entries === 1 ? 'entry' : 'entries'} and ${out.media} ${out.media === 1 ? 'file' : 'files'}${out.keptMedia ? ` (${out.keptMedia} still in use stay)` : ''}`)
    }
    else {
      log('· Nothing of this seed is on the site yet; nothing to remove.')
      for (const line of describeReset(plan, base)) log(line)
    }
  }

  const result = await runSeed(def, { reg, backend, root: cwd, apply: !dryRun && Boolean(connected), onOp: print })
  log(dryRun ? `Dry run, nothing written: ${summarize(result.ops, true)}.` : `✓ Seeded ${base}: ${summarize(result.ops, false)}.`)
}
