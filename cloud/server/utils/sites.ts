import { randomBytes, randomUUID } from 'node:crypto'
import { and, eq, ne, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { adminThroughAccount } from '#shared/account'
import type { SiteStorage, SiteView } from '#shared/api'
import { planById } from '#shared/plans'
import { parseReservedSlugs, slugProblem, type SlugProblem } from '#shared/slug'
import { normalizeSteps } from '#shared/steps'
import { templateById } from '#shared/templates'
import { normalizeExport, toExportView } from '#shared/transfer'
import type { SiteRow } from '../db/schema'
import { useHosting } from '../hosting'
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
  /**
   * The site's client at the account service (server/utils/account.ts): its id and its secret,
   * handed to the site as NUXT_CMS_AUTH_ACCOUNT_CLIENT_ID and _CLIENT_SECRET. A site made before
   * the account service has none until it is next seen to.
   */
  accountClientId?: string
  accountClientSecret?: string
}

const random = (bytes: number) => randomBytes(bytes).toString('base64url')

/** A new client for the account service: its id (the client_id, a uuid) and its secret. */
export const newAccountClientSecrets = (): Required<Pick<SiteSecrets, 'accountClientId' | 'accountClientSecret'>> =>
  ({ accountClientId: randomUUID(), accountClientSecret: random(32) })

export function newSiteSecrets(): SiteSecrets {
  return { appSecret: random(36), setupToken: random(24), statusToken: random(32), servicePassword: random(24), ...newAccountClientSecrets() }
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
    // Sign-in through the account: the cloud is the issuer, the site is its client.
    ...(secrets.accountClientId && secrets.accountClientSecret
      ? { NUXT_CMS_AUTH_ACCOUNT_ISSUER: publicUrl(), NUXT_CMS_AUTH_ACCOUNT_CLIENT_ID: secrets.accountClientId, NUXT_CMS_AUTH_ACCOUNT_CLIENT_SECRET: secrets.accountClientSecret }
      : {}),
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

/** How long a site's invitation works (tinyzoo's own rule: 7 days). */
const INVITE_TTL_MS = 7 * 24 * 60 * 60_000

/** A site as its owner's browser gets it: no secret, and the invitation link only while it is still needed. */
export function toSiteView(row: SiteRow): SiteView {
  const accepted = !!row.ownerAcceptedAt
  const moved = row.hostState === 'moved'
  const inviteUrl = row.status === 'ready' && !accepted && !moved ? decryptSecret(row.inviteUrl) : null
  const operable = canOperate(row.driver)
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    template: row.template,
    look: row.look,
    status: row.status,
    publicUrl: row.publicUrl,
    // A site that moved away has its admin at its new home.
    adminUrl: row.publicUrl && !moved ? adminThroughAccount(row.publicUrl) : null,
    adminPasswordUrl: row.publicUrl && !moved ? `${row.publicUrl}/admin` : null,
    steps: normalizeSteps(row.steps),
    errorDetail: import.meta.dev ? row.error : null,
    inviteUrl,
    inviteExpired: !!inviteUrl && !!row.inviteSentAt && Date.now() - row.inviteSentAt.getTime() > INVITE_TTL_MS,
    ownerAccepted: accepted,
    createdAt: row.createdAt.toISOString(),
    readyAt: row.readyAt?.toISOString() ?? null,
    plan: planById(row.plan).id,
    hostState: row.hostState,
    movedTo: moved ? row.movedTo : null,
    dataRemoved: !!row.dataRemovedAt,
    operable,
    imported: !!row.moveIn,
    export: toExportView(normalizeExport(row.moveOut), !!archivePathOf(row)),
  }
}

/** Whether a site's hosting keeps its row outside the site's own process: then it can have domains, a plan's limits, and be moved (the shared driver). */
function canOperate(driverName: string): boolean {
  try {
    const driver = useHosting(driverName)
    return !!driver.refresh && !!driver.access
  }
  catch {
    return false
  }
}

// What a site says it stores, kept for a few seconds: its page asks every time it is looked at.
const storageSeen = new Map<string, { at: number; storage: SiteStorage }>()

/**
 * How much a site stores against its plan: asked of the site itself (GET /api/health/status
 * with the site's status token: `media.bytes`, and `media.limitBytes` as the site applies
 * it). Null when the site does not answer in a moment.
 */
export async function siteStorage(row: SiteRow): Promise<SiteStorage | null> {
  // Only where the plan's limits reach the site (its row of the site directory): elsewhere the page is as it was.
  if (!canOperate(row.driver) || row.status !== 'ready' || !row.internalUrl || row.hostState === 'moved' || row.hostState === 'paused') return null
  const seen = storageSeen.get(row.id)
  if (seen && Date.now() - seen.at < 5000) return seen.storage
  try {
    const status = await new SiteClient(row.internalUrl).get<{ database?: { ok?: boolean }; media?: { bytes?: number; limitBytes?: number } }>('/api/health/status', {
      headers: { authorization: `Bearer ${readSecrets(row).statusToken}` }, timeoutMs: 3000,
    })
    // A site that is just checking its database (after its row changed) reports no figures yet: not "nothing stored".
    if (status.database?.ok !== true || typeof status.media?.bytes !== 'number') return null
    const storage: SiteStorage = { usedBytes: status.media.bytes, limitBytes: typeof status.media.limitBytes === 'number' ? status.media.limitBytes : null, maxUploadMb: planById(row.plan).storage.maxSizeMb }
    storageSeen.set(row.id, { at: Date.now(), storage })
    if (storageSeen.size > 5000) storageSeen.clear()
    return storage
  }
  catch {
    return null
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

/** NUXT_RESERVED_SLUGS: names no new website may take, on top of the built-in ones (shared/slug.ts). */
export function reservedSlugs(): ReadonlySet<string> {
  return parseReservedSlugs(useRuntimeConfig().reservedSlugs)
}

/** What is wrong with the address of a website that is about to be made, or null: the rules, and the deployment's reserved names. */
export function newSlugProblem(slug: string): SlugProblem | null {
  return slugProblem(slug, reservedSlugs())
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
