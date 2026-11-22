import { randomBytes } from 'node:crypto'
import { and, eq, ne, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import type { SiteView } from '#shared/api'
import { normalizeSteps } from '#shared/steps'
import { templateById } from '#shared/templates'
import type { SiteRow } from '../db/schema'
import type { HostedSite } from '../hosting/types'

/** What the cloud keeps about a site, encrypted in sites.secrets. */
export interface SiteSecrets {
  /** The site's NUXT_APP_SECRET (seals its sign-in cookies). */
  appSecret: string
  /** The code its /admin/setup asks for (NUXT_CMS_AUTH_SETUP_TOKEN). */
  setupToken: string
  /** The token of GET /api/health/status (NUXT_CMS_STATUS_TOKEN). */
  statusToken: string
  /** The password of the service account the cloud keeps on the site. */
  servicePassword: string
}

const random = (bytes: number) => randomBytes(bytes).toString('base64url')

export function newSiteSecrets(): SiteSecrets {
  return { appSecret: random(36), setupToken: random(24), statusToken: random(32), servicePassword: random(24) }
}

export function readSecrets(row: Pick<SiteRow, 'secrets' | 'slug'>): SiteSecrets {
  const plain = decryptSecret(row.secrets)
  if (!plain) throw new Error(`[cloud] the secrets of "${row.slug}" cannot be read (was NUXT_CLOUD_SECRET changed?)`)
  return JSON.parse(plain) as SiteSecrets
}

/** The site's own environment, the same on every host. */
export function siteEnv(secrets: SiteSecrets): Record<string, string> {
  return {
    NUXT_APP_SECRET: secrets.appSecret,
    NUXT_CMS_AUTH_SETUP_TOKEN: secrets.setupToken,
    NUXT_CMS_STATUS_TOKEN: secrets.statusToken,
    NUXT_CMS_MIGRATIONS_ON_START: 'true',
    // The cloud hands the invitation link over itself; the site's own e-mails are only printed.
    NUXT_CMS_MAIL_TRANSPORT: 'log',
  }
}

/** A site as its hosting driver sees it. */
export function hostedSite(row: SiteRow): HostedSite {
  const template = templateById(row.template)
  if (!template) throw new Error(`[cloud] unknown template "${row.template}" on site ${row.slug}`)
  return {
    siteId: row.id, slug: row.slug, template, env: siteEnv(readSecrets(row)),
    publicUrl: row.publicUrl, internalUrl: row.internalUrl, state: row.driverState ?? null,
  }
}

/** A site as its owner's browser gets it: no secret, and the invitation link only while it is still needed. */
export function toSiteView(row: SiteRow): SiteView {
  const accepted = !!row.ownerAcceptedAt
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    template: row.template,
    status: row.status,
    publicUrl: row.publicUrl,
    adminUrl: row.publicUrl ? `${row.publicUrl}/admin` : null,
    steps: normalizeSteps(row.steps),
    errorDetail: import.meta.dev ? row.error : null,
    inviteUrl: row.status === 'ready' && !accepted ? decryptSecret(row.inviteUrl) : null,
    ownerAccepted: accepted,
    createdAt: row.createdAt.toISOString(),
    readyAt: row.readyAt?.toISOString() ?? null,
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The site in the address (`/api/sites/:id`), if it is the signed-in person's; 404 otherwise, as if it did not exist. */
export async function requireOwnSite(event: H3Event): Promise<{ me: Me; site: SiteRow }> {
  const me = await requireUser(event)
  const id = getRouterParam(event, 'id') ?? ''
  const [site] = UUID.test(id)
    ? await useDb().select().from(schema.sites).where(and(eq(schema.sites.id, id), eq(schema.sites.ownerId, me.id), ne(schema.sites.status, 'removed')))
    : []
  if (!site) throw fail(404, 'site.none', 'No such website')
  return { me, site }
}

/** Whether an address is held by a website (any that is not removed). */
export async function slugTaken(slug: string): Promise<boolean> {
  const [row] = await useDb().select({ id: schema.sites.id }).from(schema.sites).where(and(eq(schema.sites.slug, slug), ne(schema.sites.status, 'removed')))
  return !!row
}

/** How many websites someone has (everything that is not removed counts, also one being made). */
export async function siteCount(ownerId: string): Promise<number> {
  const [row] = await useDb().select({ n: sql<number>`count(*)::int` }).from(schema.sites).where(and(eq(schema.sites.ownerId, ownerId), ne(schema.sites.status, 'removed')))
  return row?.n ?? 0
}
