import { AsyncLocalStorage } from 'node:async_hooks'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { isAbsolute } from 'node:path'

/**
 * The site a piece of server work belongs to.
 *
 * `single` mode (the default): one process serves one site, as always. There is one
 * site, built from the environment, and it is the current site everywhere.
 *
 * `multi` mode (NUXT_CMS_TENANCY_MODE=multi; experimental): one process serves many
 * sites that share this build's content model. Each has its own database, files and
 * secrets (the site directory, NUXT_CMS_TENANCY_FILE). The current site is carried by
 * the async context: a request gets it from its host name (server/plugins/cms-0-site.ts),
 * work outside a request names it (`runInCmsSite`, `forEachCmsSite`). Work that has no site
 * gets an error from `useCmsSite()`, and with it from `useCms()`, `useCmsStorage()` and
 * every `cmsSiteScoped` value: there is no default site in multi mode.
 *
 * Everything a site owns in memory is declared with `cmsSiteScoped`; state shared by the
 * whole process on purpose with `cmsProcessWide`. A unit test (test/unit/module-state.spec.ts)
 * refuses module-level state that is neither.
 */
export interface CmsSite {
  /** Stable, opaque id: keys this site's state, its rate limits and its messages. */
  id: string
  /** Host names (lower case, no port). The first is the site's own; the others redirect to it. */
  hosts: string[]
  /**
   * Host names that are served as the site without a redirect: the address the platform
   * itself reaches the site at when visitors use a domain of the site's own.
   */
  alsoHosts: string[]
  /** The site's public address (an origin, no trailing slash): links in e-mails, the sitemap, canonical addresses. */
  publicUrl: string
  /**
   * `paused`: answers 503. `read-only`: reads work, writes get 503 (while the site is being
   * moved). `moved`: it lives somewhere else now; every request is redirected to `movedTo`.
   */
  state: 'active' | 'paused' | 'read-only' | 'moved'
  /** Where a `moved` site went (an origin, no trailing slash). */
  movedTo?: string
  /** Postgres address with the site's own user, which may open this one database only. */
  databaseUrl: string
  /** The site's own secret: its sessions are bound to it. */
  secret: string
  /**
   * The content model the site uses, by its name in the build's `defineModels` (experimental).
   * `default` (a row without `model`) is the model of the app's own cms.config.ts.
   */
  model: string
  /** The site's settings, laid over `runtimeConfig.cms` (only the keys in SITE_SETTINGS). */
  config: Record<string, any>
}

export class CmsNoSiteError extends Error {
  readonly statusCode = 500
  constructor(what = 'this work') {
    super(`[tinyzoo] No site for ${what}: in multi-tenant mode every piece of server work belongs to one site. `
      + 'A request gets its site from its host name; work outside a request must run inside runInCmsSite() or forEachCmsSite().')
    this.name = 'CmsNoSiteError'
  }
}

/**
 * A site as it is loaded in this process: its row, and what is kept in memory for it (its
 * database pool, its caches, its sockets). Work runs inside an instance and keeps it until
 * it has finished. When the site's row changes or leaves the directory the instance is
 * retired: new work gets a new instance made from the new row, the work under way finishes
 * with what it started with (the old settings, the old pool), and then the old instance is
 * released. So a request is never cut off by a change of the directory, and work that began
 * under the old row cannot make the site's new memory from it.
 */
interface SiteInstance {
  site: CmsSite
  state: Map<symbol, unknown>
  /** Pieces of work running inside it now: requests, socket hooks, bound callbacks, background runs. */
  active: number
  /** Its row changed or left the directory: nothing new starts in it. */
  retired: boolean
  /** It left the directory altogether: its database and its files may be gone already. */
  left: boolean
  releasing: boolean
  /** Its memory is gone: nothing can be kept for it any more. */
  released: boolean
  whenIdle?: () => void
  /** When a request or a socket last ran in it (background sweeps do not count). */
  usedAt: number
}
const newInstance = (site: CmsSite): SiteInstance => ({ site, state: new Map(), active: 0, retired: false, left: false, releasing: false, released: false, usedAt: Date.now() })

const context = new AsyncLocalStorage<SiteInstance>()
/** The instance new work of a site starts in, by site id. */
const instances = new Map<string, SiteInstance>()
/** Retired instances whose work is still finishing. */
const retiring = new Set<SiteInstance>()
/** How long a retired instance waits for its work before it is released regardless. */
const DRAIN_MS = Number(process.env.CMS_TEST_SITE_DRAIN_MS) || 30_000

let mode: 'single' | 'multi' | undefined
/** `multi` when NUXT_CMS_TENANCY_MODE=multi, otherwise `single`. Read once: a process does not change its mode. */
export function cmsTenancyMode(): 'single' | 'multi' {
  if (!mode) mode = typeof process !== 'undefined' && process.env?.NUXT_CMS_TENANCY_MODE === 'multi' ? 'multi' : 'single'
  return mode
}
export const cmsIsMultiTenant = (): boolean => cmsTenancyMode() === 'multi'

/** The one site of single mode. Its database, files and settings come from the environment, where they always did. */
const SINGLE: CmsSite = Object.freeze({ id: 'default', hosts: [], alsoHosts: [], publicUrl: '', state: 'active', databaseUrl: '', secret: '', model: 'default', config: {} }) as CmsSite
const SINGLE_INSTANCE = newInstance(SINGLE)

/**
 * The instance the current work runs in, or undefined outside any site. Work that outlived
 * its instance (something left running after the response, long after the site's row
 * changed) goes on in the site as it is loaded now. Work of a site that left the directory
 * has nowhere to go on: it fails.
 */
function currentInstance(): SiteInstance | undefined {
  const instance = context.getStore()
  if (!instance || !instance.released) return instance
  if (instance.left) throw new CmsNoSiteError(`late work of site ${instance.site.id}, which left the site directory`)
  return instanceFor(instance.site)
}

/** The current site. Throws in multi mode when the work has none. */
export function useCmsSite(what?: string): CmsSite {
  if (cmsTenancyMode() === 'single') return SINGLE
  const instance = currentInstance()
  if (!instance) throw new CmsNoSiteError(what)
  return instance.site
}

/** The current site, or null where there is none (multi mode, outside a request). */
export function currentCmsSite(): CmsSite | null {
  return cmsTenancyMode() === 'single' ? SINGLE : (currentInstance()?.site ?? null)
}

/**
 * Keep the current site's memory until `work` has finished: for work that goes on after the
 * response was sent (an e-mail, a webhook). The request wrapper hands every `event.waitUntil`
 * promise here, so a change of the site's row does not close the database under it.
 */
export function cmsHoldSiteUntil(work: unknown): void {
  if (cmsTenancyMode() === 'single') return
  const instance = context.getStore()
  if (!instance || instance.released || !work || typeof (work as any).then !== 'function') return
  instance.active++
  ;(work as Promise<unknown>).then(() => leave(instance), () => leave(instance))
}

/**
 * Has the current site left the directory since this work began? Its database and files may
 * be gone: background work stops, and nothing is written into its folder any more.
 */
export function cmsSiteHasLeft(): boolean {
  return cmsTenancyMode() === 'multi' && !!context.getStore()?.left
}
/** The same question, for something that outlives this call (the site's storage driver asks before every write). */
export function cmsSiteLeftCheck(): () => boolean {
  if (cmsTenancyMode() === 'single') return () => false
  const instance = context.getStore()
  if (!instance) throw new CmsNoSiteError('a check bound to its site')
  return () => instance.left
}

/** Is any work of the current site under way right now, other than the caller? For something that outlives this call (the connection cap asks it later). */
export function cmsSiteQuietCheck(): () => boolean {
  if (cmsTenancyMode() === 'single') return () => false
  const instance = context.getStore()
  if (!instance) throw new CmsNoSiteError('a check bound to its site')
  return () => instance.active <= 0
}

/** The instance new work of `site` starts in. A row held from before the directory changed still names its site. */
function instanceFor(site: CmsSite): SiteInstance {
  const loaded = instances.get(site.id)
  if (loaded) return loaded
  const row = directory ? directory.byId.get(site.id) : site
  if (!row) throw new CmsNoSiteError(`site ${site.id}, which is not in the site directory`)
  const made = newInstance(row)
  instances.set(row.id, made)
  return made
}

/** Run `fn` inside an instance and count it as that instance's work until it has finished (a promise: until it settles). */
function enter<T>(instance: SiteInstance, fn: () => T, background = false): T {
  instance.active++
  if (!background) instance.usedAt = Date.now()
  let result: T
  try {
    result = context.run(instance, fn)
  }
  catch (err) {
    leave(instance)
    throw err
  }
  if (result && typeof (result as any).then === 'function') (result as any).then(() => leave(instance), () => leave(instance))
  else leave(instance)
  return result
}
function leave(instance: SiteInstance): void {
  instance.active--
  if (instance.retired && instance.active <= 0) instance.whenIdle?.()
}

/** Run `fn` with `site` as the current site (and everything it awaits, and the timers it starts). */
export function runInCmsSite<T>(site: CmsSite, fn: () => T): T {
  return cmsTenancyMode() === 'single' ? fn() : enter(instanceFor(site), fn)
}

/** Run `fn` with no current site: for process-wide work started from inside a request (a shared timer, a shared queue). */
export function outsideCmsSite<T>(fn: () => T): T {
  return cmsTenancyMode() === 'single' ? fn() : context.exit(fn)
}

/**
 * Remember the current site for a callback that runs later, from somewhere else: a job in
 * a shared queue, a listener, a hook. Without it the callback would run in the site of
 * whatever called it (or in none). When the site's row changed in the meantime the callback
 * runs in the site as it is loaded now; when the site left, in what is left of it, where
 * its files can no longer be written.
 */
export function bindToCmsSite<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  if (cmsTenancyMode() === 'single') return fn
  const bound = context.getStore()
  if (!bound) throw new CmsNoSiteError('a callback bound to its site')
  return (...args: A) => enter(bound.retired && !bound.left ? instanceFor(bound.site) : bound, () => fn(...args))
}

// ── per-site memory ────────────────────────────────────────────────────────────

export interface CmsSiteScoped<T> {
  /** The current site's value (made on first use). */
  (): T
  set(value: T): void
  /** Forget the current site's value; the next read makes a new one. */
  reset(): void
  /** The current site's value if it was made already, without making it. */
  peek(): T | undefined
}

const disposers = new Map<symbol, (value: any) => unknown>()
const keepers = new Map<symbol, (value: any) => boolean>()

/**
 * A value per site: a cache, a counter, a connection. Declared at module level, read as
 * `value()`. `dispose` runs when the site is unloaded (its pool is ended, its timer stopped).
 * `inUse` says that the value holds something live (open sockets): a site with such a value
 * is not unloaded for being idle.
 */
export function cmsSiteScoped<T>(init: () => T, opts: { dispose?: (value: T) => unknown; inUse?: (value: T) => boolean } = {}): CmsSiteScoped<T> {
  const key = Symbol('cmsSiteScoped')
  if (opts.dispose) disposers.set(key, opts.dispose)
  if (opts.inUse) keepers.set(key, opts.inUse)
  const stateOf = () => {
    const instance = cmsTenancyMode() === 'single' ? SINGLE_INSTANCE : currentInstance()
    if (!instance) throw new CmsNoSiteError('a per-site value')
    return instance.state
  }
  const get = (() => {
    const state = stateOf()
    if (!state.has(key)) state.set(key, init())
    return state.get(key) as T
  }) as CmsSiteScoped<T>
  get.set = (value) => { stateOf().set(key, value) }
  get.reset = () => { stateOf().delete(key) }
  get.peek = () => stateOf().get(key) as T | undefined
  return get
}

/**
 * State the whole process shares on purpose (a log throttle, the picture queue, the Redis
 * connection). The reason is for the reader and for the module-state test; the value is returned as it is.
 */
export function cmsProcessWide<T>(value: T, _reason: string): T {
  return value
}

/** Release what an instance holds, newest first: what was made later (an editing engine, a buffer) may still need what was made earlier (the database pool) to finish. */
async function releaseInstance(instance: SiteInstance): Promise<void> {
  if (instance.releasing) return
  instance.releasing = true
  for (const [key, value] of [...instance.state].reverse()) {
    const dispose = disposers.get(key)
    if (!dispose) continue
    try { await context.run(instance, () => dispose(value)) }
    catch (err) { console.error(`[cms] site ${instance.site.id}: could not release a resource`, (err as Error)?.message ?? err) }
  }
  instance.released = true
  instance.state.clear()
  retiring.delete(instance)
}

/**
 * The site's row changed (`left` false) or left the directory (`left` true): no new work
 * starts in this instance. It is released once the work under way has finished, or after
 * DRAIN_MS when something never does.
 */
function retireInstance(instance: SiteInstance, left: boolean): void {
  if (instance.retired) return
  instance.retired = true
  instance.left = left
  if (instances.get(instance.site.id) === instance) instances.delete(instance.site.id)
  retiring.add(instance)
  const release = () => { void releaseInstance(instance) }
  if (instance.active <= 0) { release(); return }
  instance.whenIdle = release
  const timer = setTimeout(release, DRAIN_MS)
  timer.unref?.()
}

/** Release every site's resources (server shutdown). */
export async function unloadAllCmsSites(): Promise<void> {
  const all = [...instances.values(), ...retiring]
  instances.clear()
  if (remote.timer) clearInterval(remote.timer)
  await Promise.all(all.map(releaseInstance))
  await remote.pool?.end?.().catch(() => {})
}

/**
 * Unload the sites nobody has used for `idleMs`: their caches are dropped and their pool is
 * ended; the next request makes them again (its migration check and the rest of the start-up
 * work run once more, a few milliseconds). A site with work under way, or with something
 * live in its memory (open sockets: `inUse` of a per-site value), stays. Returns how many went.
 */
export function cmsUnloadIdleSites(idleMs: number): number {
  if (cmsTenancyMode() === 'single') return 0
  const before = Date.now() - idleMs
  let unloaded = 0
  for (const instance of [...instances.values()]) {
    if (instance.active > 0 || instance.usedAt > before) continue
    let live = false
    for (const [key, value] of instance.state) {
      const inUse = keepers.get(key)
      if (inUse) { try { if (inUse(value)) { live = true; break } } catch { live = true; break } }
    }
    if (live) continue
    retireInstance(instance, false)
    unloaded++
  }
  return unloaded
}

/** What the operator's status route lists per site (multi mode): no content, no secrets. */
export function cmsSitesOverview(): { id: string; hosts: string[]; alsoHosts: string[]; state: CmsSite['state']; loaded: boolean; active: number; idleSeconds: number | null }[] {
  return cmsAllSites().map((site) => {
    const instance = instances.get(site.id)
    return { id: site.id, hosts: site.hosts, alsoHosts: site.alsoHosts, state: site.state, loaded: !!instance, active: instance?.active ?? 0, idleSeconds: instance ? Math.round((Date.now() - instance.usedAt) / 1000) : null }
  })
}

/** Run `fn` in a site only if it is loaded here, without making it "used": for looking at a site's state (the operator's route). */
export function cmsPeekInSite<T>(site: CmsSite, fn: () => T): T | undefined {
  const instance = instances.get(site.id)
  return instance ? enter(instance, fn, true) : undefined
}

// ── the site's settings ────────────────────────────────────────────────────────

/**
 * Settings that belong to a site. In multi mode none of them is taken from the process's
 * environment (a token or a folder shared by every site would be a leak): each is the
 * site's own, or empty.
 */
const SITE_SETTINGS = [
  'publicUrl',
  'auth.setupToken',
  // Sign-in with the account (the cloud app): each site is a client of its own.
  'auth.account.issuer', 'auth.account.clientId', 'auth.account.clientSecret',
  'status.token',
  'content.token', 'content.publicUrl',
  'webhooks.urls', 'webhooks.secret',
  'forms.notifyTo',
  'storage.driver', 'storage.local.dir',
  'storage.s3.endpoint', 'storage.s3.region', 'storage.s3.bucket', 'storage.s3.accessKeyId', 'storage.s3.secretAccessKey', 'storage.s3.publicBaseUrl', 'storage.s3.delivery',
  // A place of its own inside a shared bucket, and the site's plan: the largest upload and how much it may store in all.
  'storage.s3.prefix', 'storage.maxSizeMb', 'storage.maxBytes',
  'mail.from', 'mail.file.dir',
] as const
/** Of those, the ones that keep the process's value when the site has none (not secrets, not places). */
const SITE_SETTINGS_INHERITED = new Set<string>(['storage.driver', 'storage.s3.region', 'storage.s3.delivery', 'storage.maxSizeMb', 'storage.maxBytes', 'mail.from', 'mail.file.dir'])

function readPath(from: any, path: string): unknown {
  let at = from
  for (const part of path.split('.')) at = at?.[part]
  return at
}
function writePath(into: any, path: string, value: unknown): void {
  const parts = path.split('.')
  let at = into
  for (const part of parts.slice(0, -1)) at = (at[part] = { ...(at[part] ?? {}) })
  at[parts.at(-1)!] = value
}

const siteSettings = cmsSiteScoped<Record<string, any>>(() => {
  const site = useCmsSite()
  const merged: Record<string, any> = { ...(useRuntimeConfig().cms as Record<string, any> | undefined) }
  for (const path of SITE_SETTINGS) {
    const own = readPath(site.config, path)
    if (own !== undefined && own !== null && own !== '') writePath(merged, path, own)
    else if (!SITE_SETTINGS_INHERITED.has(path)) writePath(merged, path, '')
  }
  merged.publicUrl = site.publicUrl
  return merged
})

/**
 * `runtimeConfig.cms` as it holds for the current site. Single mode: the runtime config
 * itself. Multi mode: the same with the site's own settings in place of the per-site ones.
 */
export function cmsSettings(): Record<string, any> {
  if (cmsTenancyMode() === 'single') return (useRuntimeConfig().cms ?? {}) as Record<string, any>
  return siteSettings()
}

// ── the site directory (multi mode) ────────────────────────────────────────────
//
// Where the sites of this process are listed. Two sources:
//   - a JSON file (NUXT_CMS_TENANCY_FILE): `{ "sites": [ row, … ] }`, reread when it changes;
//   - a table in Postgres (NUXT_CMS_TENANCY_DATABASE_URL, with NUXT_CMS_TENANCY_TEMPLATE
//     naming which rows are this app's): `tenant_sites (id text primary key, template text,
//     row jsonb, updated_at timestamptz)`, read with a role that may only read it, and looked
//     at again every second (NUXT_CMS_TENANCY_POLL_MS).
// A row is `id`, `hosts`, `alsoHosts`, `publicUrl`, `state`, `movedTo`, `databaseUrl`, `secret`,
// `model` (the content model the site uses: a name from the build's `defineModels`, or `default`
// for the app's own cms.config.ts when the row has none) and `config`; the same in the JSON file
// and in the `row` jsonb of `tenant_sites`.
// A row's secrets (`databaseUrl`, `secret`, and any text inside `config`) may be encrypted
// (`enc:v1:…`, AES-256-GCM with a key made from NUXT_CMS_TENANCY_KEY). With the key set,
// `databaseUrl` and `secret` MUST be encrypted, and the Postgres source needs the key: a
// database that many can read never holds a site's password in plain text.

type HostEntry = {
  site: CmsSite
  /** The site's own host (`hosts[0]`). */
  main: boolean
  /** Served as the site: its own host or one of `alsoHosts`. Any other host of the site redirects to its own. */
  served: boolean
}

interface Directory {
  byId: Map<string, CmsSite>
  byHost: Map<string, HostEntry>
  /** What the source looked like when it was read: read again when it changes. */
  stamp: string
  checkedAt: number
}

let directory: Directory | undefined
const DIRECTORY_CHECK_MS = 500
const SITE_ID = /^[a-z0-9][a-z0-9_-]{0,62}$/
/** A content model's name (the same rule as `defineModels`; this file loads without the package). */
const MODEL_NAME = /^[a-z][a-z0-9-]{0,39}$/
/** The names of the content models this build carries, once the server has told the directory (`cmsKnowSiteModels`): a row naming another is refused. */
const knownModels: { names: string[] | null } = { names: null }

/**
 * Tell the directory which content models this build carries, before it is first read: a row
 * that names another model, or names none when the build has no `default`, is refused like any other bad row.
 */
export function cmsKnowSiteModels(names: string[]): void {
  knownModels.names = [...names]
}

/** A host name as the directory holds it: lower case, no port, no trailing dot. */
export function cmsNormalHost(value: unknown): string {
  let host = String(value ?? '').trim().toLowerCase()
  if (!host) return ''
  // [::1]:3000 → [::1]; example.com:3000 → example.com
  const bracket = host.startsWith('[') ? host.indexOf(']') : -1
  if (bracket > 0) host = host.slice(0, bracket + 1)
  else {
    const colon = host.lastIndexOf(':')
    if (colon > 0) host = host.slice(0, colon)
  }
  return host.replace(/\.$/, '')
}

/**
 * The host a request names. X-Forwarded-Host is read only when the deployment says a proxy
 * in front sets it (NUXT_CMS_TENANCY_FORWARDED_HOST=true): otherwise a client could send
 * one host to the proxy and name another site in the header.
 */
export function cmsRequestHost(headers: { host?: unknown; forwarded?: unknown }): string {
  if (process.env.NUXT_CMS_TENANCY_FORWARDED_HOST === 'true' && headers.forwarded) {
    return cmsNormalHost(String(headers.forwarded).split(',')[0])
  }
  return cmsNormalHost(headers.host)
}

/** Is `host` one the site is reached at (its own, a redirecting one, or one it is also served at)? */
export function cmsSiteOwnsHost(site: CmsSite, host: unknown): boolean {
  const name = cmsNormalHost(host)
  return !!name && (site.hosts.includes(name) || site.alsoHosts.includes(name))
}

// The secrets of a row.
const ENCRYPTED = 'enc:v1:'
function directoryKey(): Buffer | null {
  const key = String(process.env.NUXT_CMS_TENANCY_KEY || '')
  if (!key) return null
  if (key.length < 32) throw new Error('[tinyzoo] NUXT_CMS_TENANCY_KEY must be at least 32 characters')
  return createHash('sha256').update(key, 'utf8').digest()
}

/** Encrypt a secret of a directory row (what writes the directory uses the same): `enc:v1:` + base64url(iv | tag | ciphertext). */
export function cmsEncryptDirectorySecret(plain: string, key: string = String(process.env.NUXT_CMS_TENANCY_KEY || '')): string {
  if (key.length < 32) throw new Error('[tinyzoo] the directory key must be at least 32 characters')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(key, 'utf8').digest(), iv)
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return ENCRYPTED + Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url')
}

function decryptSecret(value: string, key: Buffer | null, what: string): string {
  if (!value.startsWith(ENCRYPTED)) return value
  if (!key) throw new Error(`[tinyzoo] ${what} is encrypted, and NUXT_CMS_TENANCY_KEY is not set`)
  try {
    const raw = Buffer.from(value.slice(ENCRYPTED.length), 'base64url')
    const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12))
    decipher.setAuthTag(raw.subarray(12, 28))
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')
  }
  catch {
    throw new Error(`[tinyzoo] ${what} cannot be decrypted with NUXT_CMS_TENANCY_KEY`)
  }
}

function decryptDeep(value: unknown, key: Buffer | null, what: string): unknown {
  if (typeof value === 'string') return decryptSecret(value, key, what)
  if (Array.isArray(value)) return value.map((v) => decryptDeep(v, key, what))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decryptDeep(v, key, `${what}.${k}`)]))
  return value
}

function parseSite(raw: any, index: number, key: Buffer | null): CmsSite {
  const where = `site #${index + 1} of the site directory`
  const id = String(raw?.id ?? '')
  if (!SITE_ID.test(id)) throw new Error(`[tinyzoo] ${where}: "id" must be 1-63 characters of a-z, 0-9, - and _`)
  const hosts = (Array.isArray(raw.hosts) ? raw.hosts : []).map(cmsNormalHost).filter(Boolean)
  if (!hosts.length) throw new Error(`[tinyzoo] site ${id}: "hosts" needs at least one host name`)
  const alsoHosts = (Array.isArray(raw.alsoHosts) ? raw.alsoHosts : []).map(cmsNormalHost).filter(Boolean)
  // With a key, a password in plain text is a mistake of whatever wrote the row: refused, not served.
  for (const field of ['databaseUrl', 'secret'] as const) {
    if (key && typeof raw[field] === 'string' && !raw[field].startsWith(ENCRYPTED)) throw new Error(`[tinyzoo] site ${id}: "${field}" must be encrypted (NUXT_CMS_TENANCY_KEY is set)`)
  }
  const databaseUrl = decryptSecret(String(raw.databaseUrl ?? ''), key, `site ${id}: "databaseUrl"`)
  if (!/^postgres(ql)?:\/\//.test(databaseUrl)) throw new Error(`[tinyzoo] site ${id}: "databaseUrl" must be a postgres:// address`)
  const secret = decryptSecret(String(raw.secret ?? ''), key, `site ${id}: "secret"`)
  if (secret.length < 32) throw new Error(`[tinyzoo] site ${id}: "secret" must be at least 32 characters`)
  const publicUrl = String(raw.publicUrl ?? '').replace(/\/+$/, '')
  if (!/^https?:\/\//.test(publicUrl)) throw new Error(`[tinyzoo] site ${id}: "publicUrl" must be the site's address (http:// or https://)`)
  // A word that is not one of the four is refused, not read as "active": a typo must not open a paused site.
  const state = raw.state === undefined || raw.state === null ? 'active' : raw.state
  if (state !== 'active' && state !== 'paused' && state !== 'read-only' && state !== 'moved') throw new Error(`[tinyzoo] site ${id}: "state" must be active, paused, read-only or moved, got ${JSON.stringify(raw.state)}`)
  const movedTo = String(raw.movedTo ?? '').replace(/\/+$/, '')
  if (state === 'moved' && !/^https?:\/\//.test(movedTo)) throw new Error(`[tinyzoo] site ${id}: a moved site needs "movedTo", the address it lives at now`)
  const named = raw.model === undefined || raw.model === null ? 'default' : raw.model
  if (typeof named !== 'string' || (named !== 'default' && !MODEL_NAME.test(named))) throw new Error(`[tinyzoo] site ${id}: "model" must be the name of a content model (a-z, 0-9 and -), got ${JSON.stringify(raw.model)}`)
  const have = knownModels.names
  if (have) {
    if (raw.model === undefined || raw.model === null) {
      if (!have.includes('default')) throw new Error(`[tinyzoo] site ${id}: this build has no content model of its own: "model" must name one of: ${have.join(', ')}`)
    }
    else if (!have.includes(named)) throw new Error(`[tinyzoo] site ${id}: "model" names "${named}", which this build does not have (it has: ${have.join(', ')})`)
  }
  const config = (raw.config && typeof raw.config === 'object' ? decryptDeep(raw.config, key, `site ${id}: config`) : {}) as Record<string, any>
  return { id, hosts, alsoHosts, publicUrl, state, ...(state === 'moved' ? { movedTo } : {}), databaseUrl, secret, model: named, config }
}

function buildDirectory(list: unknown[], stamp: string): Directory {
  const key = directoryKey()
  const byId = new Map<string, CmsSite>()
  const byHost = new Map<string, HostEntry>()
  list.forEach((raw, index) => {
    const site = parseSite(raw, index, key)
    if (byId.has(site.id)) throw new Error(`[tinyzoo] the site directory lists the id ${site.id} twice`)
    byId.set(site.id, site)
    const add = (host: string, entry: Omit<HostEntry, 'site'>) => {
      if (byHost.has(host)) throw new Error(`[tinyzoo] the site directory lists the host ${host} twice`)
      byHost.set(host, { site, ...entry })
    }
    site.hosts.forEach((host, i) => add(host, { main: i === 0, served: i === 0 }))
    site.alsoHosts.forEach((host) => add(host, { main: false, served: true }))
  })
  return { byId, byHost, stamp, checkedAt: Date.now() }
}

/** Take a newly read directory into use. A site that left it, or whose row changed, is retired (see SiteInstance). */
function adoptDirectory(next: Directory): Directory {
  const previous = directory
  directory = next
  if (previous) {
    for (const [id, old] of previous.byId) {
      const site = next.byId.get(id)
      if (site && JSON.stringify(site) === JSON.stringify(old)) continue
      const loaded = instances.get(id)
      // A site that moved away has nothing here any more either.
      if (loaded) retireInstance(loaded, !site || site.state === 'moved')
    }
  }
  return next
}

function directorySource(): 'file' | 'postgres' {
  return process.env.NUXT_CMS_TENANCY_DATABASE_URL ? 'postgres' : 'file'
}

function directoryFile(): string {
  const file = String(process.env.NUXT_CMS_TENANCY_FILE || '')
  if (!file) throw new Error('[tinyzoo] multi-tenant mode needs the site directory: set NUXT_CMS_TENANCY_FILE to its JSON file (or NUXT_CMS_TENANCY_DATABASE_URL to its database)')
  if (!isAbsolute(file)) throw new Error(`[tinyzoo] NUXT_CMS_TENANCY_FILE must be an absolute path, got ${file}`)
  return file
}

/**
 * The directory. From a file: reread when the file changed (checked at most twice a
 * second); a file that cannot be read keeps the last good directory and says so. From
 * Postgres: the copy kept in memory by `cmsDirectoryReady()` and its poll.
 */
function useDirectory(): Directory {
  if (directorySource() === 'postgres') {
    if (!directory) throw new Error('[tinyzoo] the site directory has not been read from its database yet')
    return directory
  }
  const now = Date.now()
  if (directory && now - directory.checkedAt < DIRECTORY_CHECK_MS) return directory
  const file = directoryFile()
  let stamp: string
  try {
    const info = statSync(file)
    stamp = `${info.mtimeMs}:${info.size}`
  }
  catch (err) {
    if (directory) { directory.checkedAt = now; return directory }
    throw new Error(`[tinyzoo] the site directory ${file} cannot be read: ${(err as Error).message}`)
  }
  if (directory && directory.stamp === stamp) { directory.checkedAt = now; return directory }
  let next: Directory
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    next = buildDirectory(Array.isArray(parsed) ? parsed : Array.isArray(parsed?.sites) ? parsed.sites : [], stamp)
  }
  catch (err) {
    if (!directory) throw err
    console.error('[cms] the site directory changed and cannot be used; keeping the previous one:', (err as Error).message)
    directory.checkedAt = now
    return directory
  }
  return adoptDirectory(next)
}

// The directory in Postgres.
const remote: { pool: any; ready: Promise<void> | null; timer: ReturnType<typeof setInterval> | null; reading: Promise<void> | null; failedAt: number; failure: string } = { pool: null, ready: null, timer: null, reading: null, failedAt: 0, failure: '' }

async function readRemoteDirectory(): Promise<void> {
  const template = String(process.env.NUXT_CMS_TENANCY_TEMPLATE || '')
  if (!template) throw new Error('[tinyzoo] NUXT_CMS_TENANCY_TEMPLATE must name which rows of the site directory are this app\'s')
  if (!directoryKey()) throw new Error('[tinyzoo] the site directory in a database needs NUXT_CMS_TENANCY_KEY: its rows hold the sites\' secrets encrypted')
  if (!remote.pool) {
    const { Pool } = await import('pg')
    remote.pool = new Pool({ connectionString: process.env.NUXT_CMS_TENANCY_DATABASE_URL, max: 1, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 })
    remote.pool.on('error', (err: Error) => console.error('[cms] the connection to the site directory failed while idle:', err?.message ?? err))
  }
  // Cheap first: has anything changed? The rows are read only when it has.
  const { rows: [mark] } = await remote.pool.query(`select count(*)::int as n, coalesce(md5(string_agg(id || ':' || updated_at::text, ',' order by id)), '') as mark from tenant_sites where template = $1`, [template])
  const stamp = `${mark.n}:${mark.mark}`
  if (directory && directory.stamp === stamp) { directory.checkedAt = Date.now(); return }
  const { rows } = await remote.pool.query('select row from tenant_sites where template = $1 order by id', [template])
  adoptDirectory(buildDirectory(rows.map((r: { row: unknown }) => r.row), stamp))
}

/** Read the directory in Postgres again now (the poll does it every second by itself). One read at a time. */
export function cmsReloadDirectory(): Promise<void> {
  if (cmsTenancyMode() === 'single' || directorySource() === 'file') { if (cmsTenancyMode() === 'multi') useDirectory(); return Promise.resolve() }
  remote.reading ??= readRemoteDirectory().finally(() => { remote.reading = null })
  return remote.reading
}

/**
 * Resolves when the directory can be used. A file: at once (or throws what is wrong with
 * it). Postgres: after the first read, tried again every two seconds until it works; from
 * then on the directory is read again every second, and a read that fails keeps the last
 * good one (each reason is logged once, and again after a minute).
 */
export function cmsDirectoryReady(): Promise<void> {
  if (cmsTenancyMode() === 'single') return Promise.resolve()
  if (directorySource() === 'file') { useDirectory(); return Promise.resolve() }
  remote.ready ??= context.exit(() => (async () => {
    for (;;) {
      try { await cmsReloadDirectory(); break }
      catch (err) {
        console.error('[cms] the site directory cannot be read from its database yet:', (err as Error)?.message ?? err)
        await new Promise((r) => setTimeout(r, 2_000))
      }
    }
    remote.timer = setInterval(() => {
      cmsReloadDirectory().then(() => { remote.failure = '' }, (err) => {
        // Said once per reason (and again after a minute): the poll comes round every second.
        const reason = String((err as Error)?.message ?? err)
        if (reason === remote.failure && Date.now() - remote.failedAt < 60_000) return
        remote.failure = reason
        remote.failedAt = Date.now()
        console.error('[cms] the site directory could not be read again; keeping the last one:', reason)
      })
    }, Math.max(200, Number(process.env.NUXT_CMS_TENANCY_POLL_MS) || 1_000))
    remote.timer.unref?.()
  })())
  return remote.ready
}

/** Is the directory in memory (always, for a file; after the first read, for Postgres)? */
export function cmsDirectoryLoaded(): boolean {
  return cmsTenancyMode() === 'single' || directorySource() === 'file' || !!directory
}

/** The site a host name belongs to (multi mode), and the address to redirect to when the host is an alias. */
export function cmsSiteForHost(host: unknown): { site: CmsSite; main: boolean; served: boolean } | null {
  const name = cmsNormalHost(host)
  return name ? (useDirectory().byHost.get(name) ?? null) : null
}

export function cmsSiteById(id: string): CmsSite | null {
  if (cmsTenancyMode() === 'single') return id === SINGLE.id ? SINGLE : null
  return useDirectory().byId.get(id) ?? null
}

/** Every site of this process: the one site in single mode, the directory's in multi mode. */
export function cmsAllSites(): CmsSite[] {
  return cmsTenancyMode() === 'single' ? [SINGLE] : [...useDirectory().byId.values()]
}

/**
 * Run `fn` once in every site that is not paused, a few at a time. A failure in one site is
 * logged with its id and does not stop the others; the failures are returned.
 */
export async function forEachCmsSite(fn: (site: CmsSite) => unknown, opts: { concurrency?: number; what?: string; readOnly?: boolean } = {}): Promise<{ site: string; error: unknown }[]> {
  // A read-only site is being moved: background work (publishing on time, retention) leaves its
  // database as it is. `readOnly: true` is for work such a site still needs (its migrations).
  const sites = cmsAllSites().filter((s) => s.state === 'active' || (s.state === 'read-only' && opts.readOnly))
  const failed: { site: string; error: unknown }[] = []
  let next = 0
  const worker = async () => {
    while (next < sites.length) {
      const site = sites[next++]!
      try {
        // Background work: it does not count as somebody using the site (an idle site stays idle).
        await (cmsTenancyMode() === 'single' ? fn(site) : enter(instanceFor(site), () => fn(site), true))
      }
      catch (error) {
        failed.push({ site: site.id, error })
        if (cmsTenancyMode() === 'single') throw error
        console.error(`[cms] site ${site.id}: ${opts.what ?? 'background work'} failed:`, (error as Error)?.message ?? error)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.concurrency ?? 10, sites.length)) }, worker))
  return failed
}

// ── what runs when a site is first used ────────────────────────────────────────

const startHooks: (() => unknown)[] = []
const started = cmsSiteScoped(() => false)

/**
 * Work a site needs once before it is used: migrations, the search index, the setup code.
 * Single mode: runs now (the server is starting). Multi mode: runs inside each site, the
 * first time the site is used or when the sweep after start reaches it.
 */
export function onCmsSiteStart(fn: () => unknown): void {
  if (cmsTenancyMode() === 'single') { fn(); return }
  startHooks.push(fn)
}

/** Run the start hooks of the current site, once. They start their own work in the background; nothing here waits. */
export function ensureCmsSiteStarted(): void {
  if (cmsTenancyMode() === 'single' || started()) return
  started.set(true)
  const site = useCmsSite()
  for (const hook of startHooks) {
    try { hook() }
    catch (err) { console.error(`[cms] site ${site.id}: start-up work failed:`, (err as Error)?.message ?? err) }
  }
}
