import { AsyncLocalStorage } from 'node:async_hooks'
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
 * work outside a request names it (`runInSite`, `forEachSite`). Work that has no site
 * gets an error from `useSite()`, and with it from `useCms()`, `useCmsStorage()` and
 * every `siteScoped` value: there is no default site in multi mode.
 *
 * Everything a site owns in memory is declared with `siteScoped`; state shared by the
 * whole process on purpose with `processWide`. A unit test (test/unit/module-state.spec.ts)
 * refuses module-level state that is neither.
 */
export interface CmsSite {
  /** Stable, opaque id: keys this site's state, its rate limits and its messages. */
  id: string
  /** Host names (lower case, no port). The first is the site's own; the others redirect to it. */
  hosts: string[]
  /** The site's public address (an origin, no trailing slash): links in e-mails, the sitemap, canonical addresses. */
  publicUrl: string
  /** `paused`: answers 503. `read-only`: reads work, writes get 503 (while the site is being moved). */
  state: 'active' | 'paused' | 'read-only'
  /** Postgres address with the site's own user, which may open this one database only. */
  databaseUrl: string
  /** The site's own secret: its sessions are bound to it. */
  secret: string
  /** The site's settings, laid over `runtimeConfig.cms` (only the keys in SITE_SETTINGS). */
  config: Record<string, any>
}

export class CmsNoSiteError extends Error {
  readonly statusCode = 500
  constructor(what = 'this work') {
    super(`[tinyzoo] No site for ${what}: in multi-tenant mode every piece of server work belongs to one site. `
      + 'A request gets its site from its host name; work outside a request must run inside runInSite() or forEachSite().')
    this.name = 'CmsNoSiteError'
  }
}

const context = new AsyncLocalStorage<CmsSite>()

let mode: 'single' | 'multi' | undefined
/** `multi` when NUXT_CMS_TENANCY_MODE=multi, otherwise `single`. Read once: a process does not change its mode. */
export function cmsTenancyMode(): 'single' | 'multi' {
  if (!mode) mode = typeof process !== 'undefined' && process.env?.NUXT_CMS_TENANCY_MODE === 'multi' ? 'multi' : 'single'
  return mode
}
export const cmsIsMultiTenant = (): boolean => cmsTenancyMode() === 'multi'

/** The one site of single mode. Its database, files and settings come from the environment, where they always did. */
const SINGLE: CmsSite = Object.freeze({ id: 'default', hosts: [], publicUrl: '', state: 'active', databaseUrl: '', secret: '', config: {} }) as CmsSite

/** The current site. Throws in multi mode when the work has none. */
export function useSite(what?: string): CmsSite {
  if (cmsTenancyMode() === 'single') return SINGLE
  const site = context.getStore()
  if (!site) throw new CmsNoSiteError(what)
  return site
}

/** The current site, or null where there is none (multi mode, outside a request). */
export function currentSite(): CmsSite | null {
  return cmsTenancyMode() === 'single' ? SINGLE : (context.getStore() ?? null)
}

/** Run `fn` with `site` as the current site (and everything it awaits, and the timers it starts). */
export function runInSite<T>(site: CmsSite, fn: () => T): T {
  return cmsTenancyMode() === 'single' ? fn() : context.run(site, fn)
}

/** Run `fn` with no current site: for process-wide work started from inside a request (a shared timer, a shared queue). */
export function outsideSite<T>(fn: () => T): T {
  return cmsTenancyMode() === 'single' ? fn() : context.exit(fn)
}

/**
 * Remember the current site for a callback that runs later, from somewhere else: a job in
 * a shared queue, a listener, a hook. Without it the callback would run in the site of
 * whatever called it (or in none).
 */
export function bindToSite<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  if (cmsTenancyMode() === 'single') return fn
  const site = useSite('a callback bound to its site')
  return (...args: A) => context.run(site, () => fn(...args))
}

// ── per-site memory ────────────────────────────────────────────────────────────

export interface SiteScoped<T> {
  /** The current site's value (made on first use). */
  (): T
  set(value: T): void
  /** Forget the current site's value; the next read makes a new one. */
  reset(): void
}

const states = new Map<string, Map<symbol, unknown>>()
const disposers = new Map<symbol, (value: any) => unknown>()

/**
 * A value per site: a cache, a counter, a connection. Declared at module level, read as
 * `value()`. `dispose` runs when the site is unloaded (its pool is ended, its timer stopped).
 */
export function siteScoped<T>(init: () => T, opts: { dispose?: (value: T) => unknown } = {}): SiteScoped<T> {
  const key = Symbol('siteScoped')
  if (opts.dispose) disposers.set(key, opts.dispose)
  const stateOf = () => {
    const id = useSite('a per-site value').id
    let state = states.get(id)
    if (!state) states.set(id, (state = new Map()))
    return state
  }
  const get = (() => {
    const state = stateOf()
    if (!state.has(key)) state.set(key, init())
    return state.get(key) as T
  }) as SiteScoped<T>
  get.set = (value) => { stateOf().set(key, value) }
  get.reset = () => { stateOf().delete(key) }
  return get
}

/**
 * State the whole process shares on purpose (a log throttle, the picture queue, the Redis
 * connection). The reason is for the reader and for the module-state test; the value is returned as it is.
 */
export function processWide<T>(value: T, _reason: string): T {
  return value
}

/** Forget everything kept for a site (it left the directory, or its row changed). */
async function unloadSite(id: string): Promise<void> {
  const state = states.get(id)
  if (!state) return
  states.delete(id)
  for (const [key, value] of state) {
    try { await disposers.get(key)?.(value) }
    catch (err) { console.error(`[cms] site ${id}: could not release a resource`, (err as Error)?.message ?? err) }
  }
}

/** Release every site's resources (server shutdown). */
export async function unloadAllSites(): Promise<void> {
  await Promise.all([...states.keys()].map(unloadSite))
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
  'status.token',
  'content.token', 'content.publicUrl',
  'webhooks.urls', 'webhooks.secret',
  'forms.notifyTo',
  'storage.driver', 'storage.local.dir',
  'storage.s3.endpoint', 'storage.s3.region', 'storage.s3.bucket', 'storage.s3.accessKeyId', 'storage.s3.secretAccessKey', 'storage.s3.publicBaseUrl', 'storage.s3.delivery',
  'mail.from', 'mail.file.dir',
] as const
/** Of those, the ones that keep the process's value when the site has none (not secrets, not places). */
const SITE_SETTINGS_INHERITED = new Set<string>(['storage.driver', 'storage.s3.region', 'storage.s3.delivery', 'mail.from', 'mail.file.dir'])

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

const siteSettings = siteScoped<Record<string, any>>(() => {
  const site = useSite()
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

interface Directory {
  byId: Map<string, CmsSite>
  /** host → the site and whether this host is its own (or an alias that redirects). */
  byHost: Map<string, { site: CmsSite; main: boolean }>
  /** What the file looked like when it was read: reread when it changes. */
  stamp: string
  checkedAt: number
}

let directory: Directory | undefined
const DIRECTORY_CHECK_MS = 500
const SITE_ID = /^[a-z0-9][a-z0-9_-]{0,62}$/

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

function directoryFile(): string {
  const file = String(process.env.NUXT_CMS_TENANCY_FILE || '')
  if (!file) throw new Error('[tinyzoo] multi-tenant mode needs the site directory: set NUXT_CMS_TENANCY_FILE to its JSON file')
  if (!isAbsolute(file)) throw new Error(`[tinyzoo] NUXT_CMS_TENANCY_FILE must be an absolute path, got ${file}`)
  return file
}

function parseSite(raw: any, index: number): CmsSite {
  const where = `site #${index + 1} of the site directory`
  const id = String(raw?.id ?? '')
  if (!SITE_ID.test(id)) throw new Error(`[tinyzoo] ${where}: "id" must be 1-63 characters of a-z, 0-9, - and _`)
  const hosts = (Array.isArray(raw.hosts) ? raw.hosts : []).map(cmsNormalHost).filter(Boolean)
  if (!hosts.length) throw new Error(`[tinyzoo] site ${id}: "hosts" needs at least one host name`)
  const databaseUrl = String(raw.databaseUrl ?? '')
  if (!/^postgres(ql)?:\/\//.test(databaseUrl)) throw new Error(`[tinyzoo] site ${id}: "databaseUrl" must be a postgres:// address`)
  const secret = String(raw.secret ?? '')
  if (secret.length < 32) throw new Error(`[tinyzoo] site ${id}: "secret" must be at least 32 characters`)
  const publicUrl = String(raw.publicUrl ?? '').replace(/\/+$/, '')
  if (!/^https?:\/\//.test(publicUrl)) throw new Error(`[tinyzoo] site ${id}: "publicUrl" must be the site's address (http:// or https://)`)
  const state = raw.state === 'paused' || raw.state === 'read-only' ? raw.state : 'active'
  const config = raw.config && typeof raw.config === 'object' ? raw.config : {}
  return { id, hosts, publicUrl, state, databaseUrl, secret, config }
}

function readDirectory(file: string, stamp: string): Directory {
  const parsed = JSON.parse(readFileSync(file, 'utf8'))
  const list: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.sites) ? parsed.sites : []
  const byId = new Map<string, CmsSite>()
  const byHost = new Map<string, { site: CmsSite; main: boolean }>()
  list.forEach((raw, index) => {
    const site = parseSite(raw, index)
    if (byId.has(site.id)) throw new Error(`[tinyzoo] the site directory lists the id ${site.id} twice`)
    byId.set(site.id, site)
    site.hosts.forEach((host, i) => {
      if (byHost.has(host)) throw new Error(`[tinyzoo] the site directory lists the host ${host} twice`)
      byHost.set(host, { site, main: i === 0 })
    })
  })
  return { byId, byHost, stamp, checkedAt: Date.now() }
}

/**
 * The directory, reread when its file changed (checked at most twice a second). A site
 * that left it, or whose row changed, is unloaded: its connections are closed and its
 * caches dropped. A file that cannot be read keeps the last good directory and says so.
 */
function useDirectory(): Directory {
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
    next = readDirectory(file, stamp)
  }
  catch (err) {
    if (!directory) throw err
    console.error('[cms] the site directory changed and cannot be used; keeping the previous one:', (err as Error).message)
    directory.checkedAt = now
    return directory
  }
  const previous = directory
  directory = next
  if (previous) {
    for (const [id, old] of previous.byId) {
      const site = next.byId.get(id)
      if (!site || JSON.stringify(site) !== JSON.stringify(old)) void unloadSite(id)
    }
  }
  return next
}

/** The site a host name belongs to (multi mode), and the address to redirect to when the host is an alias. */
export function cmsSiteForHost(host: unknown): { site: CmsSite; main: boolean } | null {
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
export async function forEachSite(fn: (site: CmsSite) => unknown, opts: { concurrency?: number; what?: string } = {}): Promise<{ site: string; error: unknown }[]> {
  const sites = cmsAllSites().filter((s) => s.state !== 'paused')
  const failed: { site: string; error: unknown }[] = []
  let next = 0
  const worker = async () => {
    while (next < sites.length) {
      const site = sites[next++]!
      try {
        await runInSite(site, () => fn(site))
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
const started = siteScoped(() => false)

/**
 * Work a site needs once before it is used: migrations, the search index, the setup code.
 * Single mode: runs now (the server is starting). Multi mode: runs inside each site, the
 * first time the site is used or when the sweep after start reaches it.
 */
export function onSiteStart(fn: () => unknown): void {
  if (cmsTenancyMode() === 'single') { fn(); return }
  startHooks.push(fn)
}

/** Run the start hooks of the current site, once. They start their own work in the background; nothing here waits. */
export function ensureSiteStarted(): void {
  if (cmsTenancyMode() === 'single' || started()) return
  started.set(true)
  const site = useSite()
  for (const hook of startHooks) {
    try { hook() }
    catch (err) { console.error(`[cms] site ${site.id}: start-up work failed:`, (err as Error)?.message ?? err) }
  }
}
