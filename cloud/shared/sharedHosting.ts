// The pure parts of the shared hosting driver (server/hosting/shared.ts): names, addresses,
// and a site's row in its template's site directory. Nothing here touches a disk, a database
// or a process, so all of it is covered by unit specs.

import type { PortRange } from './ports'
import { assertSlug } from './slug'

/** The shared driver's own ports: one per template, beside the local driver's 4300–4399. */
export const SHARED_PORT_RANGE: PortRange = { from: 4400, to: 4419 }

export const SHARED_DATABASE_PREFIX = 'tzs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** The site's id (a uuid, lower case), or an error: it becomes a database name, a role name and a folder. */
export function assertSiteId(id: string): string {
  if (typeof id !== 'string' || !UUID.test(id)) throw new Error(`Not a site id: ${JSON.stringify(id)}`)
  return id
}

/** A template's id, or an error: it becomes a folder name. */
export function assertTemplateId(id: string): string {
  if (typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || id.length > 40) throw new Error(`Not a template id: ${JSON.stringify(id)}`)
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

/** A site's address: its own host name on its template's port. Public and internal alike: the host name chooses the site. */
export function sharedSiteUrl(slug: string, port: number): string {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Not a port: ${port}`)
  return `http://${sharedSiteHost(slug)}:${port}`
}

export const sharedSiteHost = (slug: string): string => `${assertSlug(slug)}.localhost`

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
  /** The rest: settings of the process that serves every site of the template (the mail transport, migrations at start). */
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

/** A site's row in the site directory (packages/cms/server/utils/cmsSite.ts reads it). */
export interface SharedSiteRow {
  id: string
  hosts: string[]
  publicUrl: string
  databaseUrl: string
  secret: string
  config: {
    auth: { setupToken: string; account?: SharedSiteAccount }
    status: { token: string }
    storage: { driver: 'local'; local: { dir: string } }
    mail?: { file: { dir: string } }
  }
}

export interface SharedSiteRowInput {
  siteId: string
  slug: string
  /** The template process's port. */
  port: number
  databaseUrl: string
  /** The site's environment as the cloud decided it (siteEnv). */
  env: Record<string, string>
  /** The site's own folder (absolute): its uploads live under it, and its e-mails when they are written to files. */
  siteDir: string
}

/** The row of one site. The keys are always written in this order, so the same site gives the same text. */
export function sharedSiteRow(input: SharedSiteRowInput): SharedSiteRow {
  if (!input.siteDir.startsWith('/')) throw new Error(`The site's folder must be an absolute path: ${input.siteDir}`)
  const split = splitSiteEnv(input.env)
  const dir = input.siteDir.replace(/\/+$/, '')
  return {
    id: assertSiteId(input.siteId),
    hosts: [sharedSiteHost(input.slug)],
    publicUrl: sharedSiteUrl(input.slug, input.port),
    databaseUrl: input.databaseUrl,
    secret: split.site.secret,
    config: {
      auth: { setupToken: split.site.setupToken, ...(split.site.account ? { account: split.site.account } : {}) },
      status: { token: split.site.statusToken },
      storage: { driver: 'local', local: { dir: `${dir}/uploads` } },
      // E-mails written to files get a folder per site; any other transport needs nothing here.
      ...(split.process.NUXT_CMS_MAIL_TRANSPORT === 'file' ? { mail: { file: { dir: `${dir}/mail` } } } : {}),
    },
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
