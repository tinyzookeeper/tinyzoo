// The pure parts of the shared hosting driver (server/hosting/shared.ts) and of the local one
// (which writes a site directory of one site): names, addresses, and a site's row in its app's
// site directory. Nothing here touches a disk, a database or a process, so all of it is
// covered by unit specs.

import type { PortRange } from './ports'
import { assertSlug } from './slug'

/** The shared driver's own ports: one per APP, beside the local driver's 4300–4399. */
export const SHARED_PORT_RANGE: PortRange = { from: 4400, to: 4419 }

export const SHARED_DATABASE_PREFIX = 'tzs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** The site's id (a uuid, lower case), or an error: it becomes a database name, a role name and a folder. */
export function assertSiteId(id: string): string {
  if (typeof id !== 'string' || !UUID.test(id)) throw new Error(`Not a site id: ${JSON.stringify(id)}`)
  return id
}

/** A template's or an app's id, or an error: it becomes a folder name. */
export function assertTemplateId(id: string): string {
  if (typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || id.length > 40) throw new Error(`Not a template or app id: ${JSON.stringify(id)}`)
  return id
}

/** The prefix from settings, or the default; anything that would not make a safe name is an error. */
export function sharedDatabasePrefix(value: unknown): string {
  const prefix = String(value ?? '').trim() || SHARED_DATABASE_PREFIX
  if (!/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(prefix) || prefix.length > 20) throw new Error(`Not a usable database prefix: ${JSON.stringify(prefix)}`)
  return prefix
}

/**
 * The name of a site's database and of its database user (the two are the same):
 * `<prefix>_<the site's id with underscores>`. Opaque on purpose: every role of a Postgres
 * server can list the names of all databases and roles, so the name says nothing about the
 * site (never the slug).
 */
export function sharedDatabaseNameFor(siteId: string, prefix: string = SHARED_DATABASE_PREFIX): string {
  return `${sharedDatabasePrefix(prefix)}_${assertSiteId(siteId).replace(/-/g, '_')}`
}

/**
 * A text as an SQL string literal. For the one place a value cannot be a parameter: a role's
 * password (`CREATE ROLE … PASSWORD '…'`). Quotes are doubled; a text with a backslash is
 * written as an escape string (E'…'), which reads the same whatever the server's
 * `standard_conforming_strings` says.
 */
export function sqlLiteral(text: string): string {
  if (typeof text !== 'string' || text.includes('\0')) throw new Error('Not a text that can be an SQL literal')
  const quoted = text.replace(/'/g, '\'\'')
  return quoted.includes('\\') ? `E'${quoted.replace(/\\/g, '\\\\')}'` : `'${quoted}'`
}

/** A site's address: its own host name on its app's port. Public and internal alike: the host name chooses the site. */
export function sharedSiteUrl(slug: string, port: number): string {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Not a port: ${port}`)
  return `http://${sharedSiteHost(slug)}:${port}`
}

export const sharedSiteHost = (slug: string): string => `${assertSlug(slug)}.localhost`

/** What follows a site's address at the service itself: `<slug>.localhost`. A domain of a customer's own is never one of these names. */
export const SHARED_SERVICE_HOST = 'localhost'

/**
 * The address of a site at a domain of its own. A `*.localhost` name is this machine (trying
 * the flow locally): plain http on the app's port. Any other name is reached through the
 * platform in front, which holds its certificate: https, no port.
 */
export function sharedDomainUrl(host: string, port: number): string {
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(host)) throw new Error(`Not a host name: ${JSON.stringify(host)}`)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Not a port: ${port}`)
  return host.endsWith('.localhost') ? `http://${host}:${port}` : `https://${host}`
}

/** A database address of the same server with another user, password and database (the directory's reader). */
export function sharedReaderUrl(base: string, database: string, user: string, password: string): string {
  const url = new URL(base)
  url.username = user
  url.password = password
  url.pathname = `/${database}`
  return url.toString()
}

/** The name of the Postgres role an app's process reads the site directory with: `<prefix>_reader_<app id>`. */
export function sharedReaderRole(appId: string, prefix: string = SHARED_DATABASE_PREFIX): string {
  const name = `${sharedDatabasePrefix(prefix)}_reader_${assertTemplateId(appId).replace(/-/g, '_')}`
  if (name.length > 63) throw new Error(`The reader's name is too long: ${name}`)
  return name
}

/** The site's database address: the server of `base` (the cloud's own address), the site's database, user and password. */
export function sharedDatabaseUrl(base: string, name: string, password: string): string {
  const url = new URL(base)
  url.username = name
  url.password = password
  url.pathname = `/${name}`
  return url.toString()
}

/** The password inside a site's database address (as the site directory keeps it), or null. */
export function passwordOfDatabaseUrl(databaseUrl: unknown): string | null {
  try {
    const password = decodeURIComponent(new URL(String(databaseUrl)).password)
    return password || null
  }
  catch {
    return null
  }
}

/** What of a site's environment (server/utils/sites.ts, siteEnv) is the site's own, and what is the same for every site. */
export interface SplitSiteEnv {
  /** The site's own secrets: they go into its row of the site directory. */
  site: { secret: string; setupToken: string; statusToken: string; account: SharedSiteAccount | null }
  /** The rest: settings of the process that serves every site of the app (the mail transport, migrations at start). */
  process: Record<string, string>
}

/** The site's client at the account service (the cloud as the issuer of sign-in): `cms.auth.account` of the site's settings. */
export interface SharedSiteAccount { issuer: string; clientId: string; clientSecret: string }

const SITE_ENV = { NUXT_APP_SECRET: 'secret', NUXT_CMS_AUTH_SETUP_TOKEN: 'setupToken', NUXT_CMS_STATUS_TOKEN: 'statusToken' } as const
const ACCOUNT_ENV = { NUXT_CMS_AUTH_ACCOUNT_ISSUER: 'issuer', NUXT_CMS_AUTH_ACCOUNT_CLIENT_ID: 'clientId', NUXT_CMS_AUTH_ACCOUNT_CLIENT_SECRET: 'clientSecret' } as const

/**
 * Split the environment the cloud decides for a site. With a process per site all of it was
 * that process's environment; with one process for many sites the secrets are the site's row
 * and only what is the same for every site stays in the environment. The site's client at the
 * account service (three values, all or none) is the site's own too.
 */
export function splitSiteEnv(env: Record<string, string>): SplitSiteEnv {
  const site = { secret: '', setupToken: '', statusToken: '' }
  const account: SharedSiteAccount = { issuer: '', clientId: '', clientSecret: '' }
  const rest: Record<string, string> = {}
  for (const [name, value] of Object.entries(env)) {
    if (name in SITE_ENV) site[SITE_ENV[name as keyof typeof SITE_ENV]] = value
    else if (name in ACCOUNT_ENV) account[ACCOUNT_ENV[name as keyof typeof ACCOUNT_ENV]] = value
    else rest[name] = value
  }
  if (site.secret.length < 32) throw new Error('The site\'s app secret must be at least 32 characters')
  const given = Object.values(account).filter(Boolean).length
  if (given !== 0 && given !== 3) throw new Error('The site\'s account settings must come together: the issuer, the client id and the client secret')
  return { site: { ...site, account: given ? account : null }, process: rest }
}

/** What a site does with a request: served, `paused` (503), `read-only` (reads only, while it is moved), `moved` (redirected to where it lives now). */
export type SharedSiteState = 'active' | 'paused' | 'read-only' | 'moved'
export const SHARED_SITE_STATES: readonly SharedSiteState[] = ['active', 'paused', 'read-only', 'moved']

/** A site's row in the site directory (packages/cms/server/utils/cmsSite.ts reads it). */
export interface SharedSiteRow {
  id: string
  /** The first is the site's address; the others redirect to it. */
  hosts: string[]
  /** Served as the site without a redirect: its address at the service, when people use a domain of the site's own. */
  alsoHosts?: string[]
  publicUrl: string
  /** Left out for a site that is simply served (`active`). */
  state?: Exclude<SharedSiteState, 'active'>
  /** Where a `moved` site lives now. */
  movedTo?: string
  databaseUrl: string
  secret: string
  /** The content model the site uses, in an app that carries several (the site is drawn in the design of the same name). Left out for an app with one model of its own. */
  model?: string
  config: SharedSiteConfig
}

/** What a row's `config` holds: the site's own settings. */
export interface SharedSiteConfig {
  auth: { setupToken: string; account?: SharedSiteAccount }
  status: { token: string }
  /** `maxSizeMb`, `maxBytes`: the site's plan (shared/plans.ts): the largest upload, and everything it may store. */
  storage: { driver: 'local'; local: { dir: string }; maxSizeMb?: number; maxBytes?: number }
  mail?: { file: { dir: string } }
  /** The site's own content types (experimental): its plan's limits. Only with CLOUD_CUSTOM_TYPES=on, and only in the one app. */
  customTypes?: SiteCustomTypes
}

/** How many content types of its own a site may make, and how many fields each may have (shared/plans.ts). */
export interface SiteCustomTypes { types: number; fields: number }

/**
 * CLOUD_CUSTOM_TYPES: `on` lets the sites of the one app make content types of their own
 * (experimental). Anything else is off, and then nothing the cloud starts or writes changes.
 */
export const customTypesSetting = (value: unknown): boolean => String(value ?? '').trim() === 'on'

/**
 * What an app's process gets in its environment for the sites' own content types. Only the one
 * app (an app that carries several models): its designs have the blocks that show such types.
 * The Basic website's app does not, and is started without the switch.
 */
export function customTypesEnv(app: { models: boolean }, on: boolean): Record<string, string> {
  return on && app.models ? { NUXT_CMS_CUSTOM_TYPES: 'on' } : {}
}

/** A site's limits for its own content types, or an error: tinyzoo reads whole numbers from 0 to 200. */
function assertCustomTypes(limits: SiteCustomTypes): SiteCustomTypes {
  const ok = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 200
  if (!ok(limits.types) || !ok(limits.fields)) throw new Error('The limits of a site\'s own content types must be whole numbers from 0 to 200')
  return { types: limits.types, fields: limits.fields }
}

/** A site's verified domains of its own: `main` is its address when set, the others redirect to the address. */
export interface SharedSiteDomains { main: string | null; others: string[] }

export interface SharedSiteRowInput {
  siteId: string
  slug: string
  /** The app process's port. */
  port: number
  databaseUrl: string
  /** The site's environment as the cloud decided it (siteEnv). */
  env: Record<string, string>
  /** The site's own folder (absolute): its uploads live under it, and its e-mails when they are written to files. */
  siteDir: string
  /** The site's verified domains of its own. None: the site is at its service address only, as always. */
  domains?: SharedSiteDomains
  /** Default `active`. */
  state?: SharedSiteState
  /** For a `moved` site: the address it lives at now. */
  movedTo?: string | null
  /** The site's plan: the largest upload (MB) and everything it may store (bytes). */
  limits?: { maxSizeMb: number; maxBytes: number }
  /** The content model the site uses in an app that carries several (the template's id). */
  model?: string | null
  /** Its own content types' limits (CLOUD_CUSTOM_TYPES=on). Left out: the row says nothing of them. */
  customTypes?: SiteCustomTypes | null
}

const MODEL = /^[a-z][a-z0-9-]{0,39}$/

/** A model's name, or an error: it is a name of a content model (and of a design) in the app. */
function assertModel(model: string): string {
  if (typeof model !== 'string' || !MODEL.test(model)) throw new Error(`Not a name of a content model: ${JSON.stringify(model)}`)
  return model
}

/** A row's `config` from the site's environment: its sign-in, its status token, where its uploads and e-mails go. */
function siteConfig(split: SplitSiteEnv, dir: string, limits?: { maxSizeMb: number; maxBytes: number }, customTypes?: SiteCustomTypes | null): SharedSiteConfig {
  return {
    auth: { setupToken: split.site.setupToken, ...(split.site.account ? { account: split.site.account } : {}) },
    status: { token: split.site.statusToken },
    storage: { driver: 'local', local: { dir: `${dir}/uploads` }, ...(limits ? { maxSizeMb: limits.maxSizeMb, maxBytes: limits.maxBytes } : {}) },
    // E-mails written to files get a folder per site; any other transport needs nothing here.
    ...(split.process.NUXT_CMS_MAIL_TRANSPORT === 'file' ? { mail: { file: { dir: `${dir}/mail` } } } : {}),
    // Last, so that a row without them is the text it always was.
    ...(customTypes ? { customTypes: assertCustomTypes(customTypes) } : {}),
  }
}

/** The row of one site. The keys are always written in this order, so the same site gives the same text. */
export function sharedSiteRow(input: SharedSiteRowInput): SharedSiteRow {
  if (!input.siteDir.startsWith('/')) throw new Error(`The site's folder must be an absolute path: ${input.siteDir}`)
  const split = splitSiteEnv(input.env)
  const dir = input.siteDir.replace(/\/+$/, '')
  const service = sharedSiteHost(input.slug)
  const state = input.state ?? 'active'
  if (!SHARED_SITE_STATES.includes(state)) throw new Error(`Not a state of a site: ${JSON.stringify(state)}`)
  const movedTo = String(input.movedTo ?? '').replace(/\/+$/, '')
  if (state === 'moved' && !/^https?:\/\/[^/]+$/.test(movedTo)) throw new Error('A moved site needs the address it lives at now')
  // A domain is listed once, and never the service address itself.
  const seen = new Set<string>([service])
  const fresh = (host: string) => (seen.has(host) ? false : !!seen.add(host))
  const main = input.domains?.main && fresh(input.domains.main) ? input.domains.main : null
  const others = (input.domains?.others ?? []).filter(fresh)
  const limits = input.limits
  if (limits && !(limits.maxSizeMb > 0 && Number.isSafeInteger(limits.maxBytes) && limits.maxBytes > 0)) throw new Error('The limits of a site must be positive numbers')
  return {
    id: assertSiteId(input.siteId),
    // With a main domain the site lives there: its other domains redirect to it, and the
    // service address keeps answering as the site (the cloud itself talks to it there).
    hosts: main ? [main, ...others] : [service, ...others],
    ...(main ? { alsoHosts: [service] } : {}),
    publicUrl: main ? sharedDomainUrl(main, input.port) : sharedSiteUrl(input.slug, input.port),
    ...(state !== 'active' ? { state } : {}),
    ...(state === 'moved' ? { movedTo } : {}),
    databaseUrl: input.databaseUrl,
    secret: split.site.secret,
    ...(input.model ? { model: assertModel(input.model) } : {}),
    config: siteConfig(split, dir, limits, input.customTypes),
  }
}

export interface LocalSiteRowInput {
  siteId: string
  /** The site's address as people and the cloud's own pages know it (`http://<slug>.localhost:<port>`, or a pattern's). */
  publicUrl: string
  databaseUrl: string
  env: Record<string, string>
  /** The site's own folder (absolute). */
  siteDir: string
  model?: string | null
  /** Its own content types' limits (CLOUD_CUSTOM_TYPES=on). Left out: the row says nothing of them. */
  customTypes?: SiteCustomTypes | null
}

/**
 * The row of the one site a local process serves (server/hosting/local.ts). The process answers
 * at its public host name, and also at 127.0.0.1: that is where the cloud itself reaches it.
 */
export function localSiteRow(input: LocalSiteRowInput): SharedSiteRow {
  if (!input.siteDir.startsWith('/')) throw new Error(`The site's folder must be an absolute path: ${input.siteDir}`)
  const split = splitSiteEnv(input.env)
  const publicUrl = input.publicUrl.replace(/\/+$/, '')
  const host = new URL(publicUrl).hostname.toLowerCase()
  return {
    id: assertSiteId(input.siteId),
    hosts: [host],
    ...(host !== '127.0.0.1' ? { alsoHosts: ['127.0.0.1'] } : {}),
    publicUrl,
    databaseUrl: input.databaseUrl,
    secret: split.site.secret,
    ...(input.model ? { model: assertModel(input.model) } : {}),
    config: siteConfig(split, input.siteDir.replace(/\/+$/, ''), undefined, input.customTypes),
  }
}

/** The directory's text → its rows (an empty list for a text that is not a directory). */
export function parseSharedDirectory(text: string): SharedSiteRow[] {
  try {
    const parsed = JSON.parse(text)
    const list = Array.isArray(parsed) ? parsed : parsed?.sites
    return Array.isArray(list) ? list.filter((row) => row && typeof row === 'object' && typeof row.id === 'string') : []
  }
  catch {
    return []
  }
}

/** The directory with a site's row put in (in place of its old one, or at the end). `changed` is false when the same row was already there. */
export function withSharedSite(rows: SharedSiteRow[], row: SharedSiteRow): { rows: SharedSiteRow[]; changed: boolean } {
  const at = rows.findIndex((r) => r.id === row.id)
  if (at === -1) return { rows: [...rows, row], changed: true }
  if (JSON.stringify(rows[at]) === JSON.stringify(row)) return { rows, changed: false }
  return { rows: rows.map((r, i) => (i === at ? row : r)), changed: true }
}

/** The directory without a site. */
export function withoutSharedSite(rows: SharedSiteRow[], siteId: string): { rows: SharedSiteRow[]; changed: boolean } {
  const kept = rows.filter((r) => r.id !== siteId)
  return { rows: kept, changed: kept.length !== rows.length }
}

/** The directory as its file holds it. */
export const sharedDirectoryText = (rows: SharedSiteRow[]): string => `${JSON.stringify({ sites: rows }, null, 2)}\n`
