import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { and, asc, eq, isNotNull, isNull, lt, ne, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { adminThroughAccount, clientAddress, codeTtlMs, isAccountId, isPkceVerifier, memberRole, parseBasicAuth } from '#shared/account'
import type { ClientCredentials, ConnectedSiteView, MemberSiteView } from '#shared/api'
import type { AccountClientRow, SiteRow } from '../db/schema'

// The account service: the cloud as the issuer of sign-in for websites (docs/multi-tenant-plan.md,
// 2.15). A website (a client) sends a person's browser to /oauth/authorize, gets a one-time code
// back and exchanges it, server to server, for who the person is. What is kept: the clients,
// the codes, and who signed in where (the members). Secrets and codes are kept as SHA-256 only.

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')

/** Two texts compared in constant time (their SHA-256, so the lengths never differ). */
export function sameText(a: string, b: string): boolean {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest())
}

/** A new client secret: 32 random bytes. */
export const newClientSecret = (): string => randomBytes(32).toString('base64url')

/** The issuer's address: the cloud's own public address. */
export const issuerUrl = (event?: H3Event): string => publicUrl(event)

/** What a website is told about the issuer: its three settings. */
export function clientCredentials(clientId: string, clientSecret: string): ClientCredentials {
  return { issuer: issuerUrl(), clientId, clientSecret }
}

/** How long a code works: a minute, or the shorter NUXT_ACCOUNT_CODE_TTL_SECONDS (for the checks). */
export const accountCodeTtlMs = (): number => codeTtlMs(useRuntimeConfig().accountCodeTtlSeconds)

/** An answer of the server-to-server routes when something is refused: `{ error }`, never cached. */
export function oauthRefusal(event: H3Event, status: number, error: string, opts: { basic?: boolean } = {}): { error: string } {
  setResponseStatus(event, status)
  setResponseHeader(event, 'cache-control', 'no-store')
  // The routes that take the client's secret in the Authorization header say so.
  if (status === 401 && opts.basic) setResponseHeader(event, 'www-authenticate', 'Basic realm="tinyzoo account"')
  return { error }
}

// ── clients ─────────────────────────────────────────────────────────────────────

/** A client by its id, also a revoked one; null for an id that is not one. */
export async function findClient(clientId: unknown): Promise<AccountClientRow | null> {
  if (!isAccountId(clientId)) return null
  const [row] = await useDb().select().from(schema.accountClients).where(eq(schema.accountClients.id, clientId))
  return row ?? null
}

// What an unknown client's secret is compared with, so that an unknown id takes as long as a wrong secret.
const NO_HASH = sha256('no such client')

/** The client that `clientId` and `secret` belong to: known, not revoked, the secret right. Null otherwise. */
export async function authenticateClient(clientId: unknown, secret: unknown): Promise<AccountClientRow | null> {
  const client = await findClient(clientId)
  const given = sha256(typeof secret === 'string' ? secret : '')
  const right = sameText(given, client?.secretHash ?? NO_HASH)
  return client && right && !client.revokedAt && typeof secret === 'string' && secret.length > 0 ? client : null
}

/** Failed tries within ten minutes before an address, or a client's bad codes, are refused for a while. (The app's limiter remembers fifty tries per key.) */
const OAUTH_IP_FAILURES = 50
const OAUTH_CLIENT_FAILURES = 30
const ipKey = (event: H3Event) => `oauth:ip:${clientIp(event)}`
const clientKey = (clientId: string) => `oauth:client:${clientId}`

/**
 * The limits of the server-to-server routes, in memory as the app's other limits. Failed tries
 * of one address count whatever they named (a wrong secret, an unknown client, a bad code);
 * bad codes sent with the RIGHT secret also count against that client. A wrong secret is not
 * counted against the client it names: the client id is public (it is in every sign-in's
 * address), and anybody could then lock a website's sign-in out.
 */
export const oauthLimits = {
  ipLimited: (event: H3Event) => isLimited(ipKey(event), OAUTH_IP_FAILURES),
  clientLimited: (clientId: string) => isLimited(clientKey(clientId), OAUTH_CLIENT_FAILURES),
  noteIp: (event: H3Event) => noteFailure(ipKey(event)),
  noteClient: (clientId: string) => noteFailure(clientKey(clientId)),
}

/** The client of a server-to-server request with `Authorization: Basic`, or null (the failure is counted against the address). */
export async function clientOfRequest(event: H3Event): Promise<AccountClientRow | null> {
  const basic = parseBasicAuth(getRequestHeader(event, 'authorization'))
  const client = await authenticateClient(basic?.id, basic?.secret)
  if (!client) oauthLimits.noteIp(event)
  return client
}

// ── codes ───────────────────────────────────────────────────────────────────────

/** A one-time code for a signed-in person, bound to the client, the address it goes to and the PKCE challenge. */
export async function issueCode(input: { clientId: string; userId: string; redirectUri: string; codeChallenge: string }): Promise<string> {
  const db = useDb()
  const code = randomBytes(32).toString('base64url')
  // Codes nobody came for are of no use after they expire.
  await db.delete(schema.accountCodes).where(lt(schema.accountCodes.expiresAt, new Date(Date.now() - 60 * 60_000)))
  await db.insert(schema.accountCodes).values({ ...input, codeHash: sha256(code), expiresAt: new Date(Date.now() + accountCodeTtlMs()) })
  return code
}

const challengeOf = (verifier: string) => createHash('sha256').update(verifier).digest('base64url')

/**
 * Use a code: whose it was, or null. The code is spent by the first try of its own client,
 * whatever else is wrong with that try (the address, the verifier, its age), so nobody gets a
 * second guess. Another client's try does not touch it.
 */
export async function redeemCode(client: AccountClientRow, input: { code: unknown; redirectUri: unknown; codeVerifier: unknown }): Promise<string | null> {
  if (typeof input.code !== 'string' || !input.code || input.code.length > 200) return null
  const now = new Date()
  const [row] = await useDb().update(schema.accountCodes).set({ usedAt: now })
    .where(and(eq(schema.accountCodes.codeHash, sha256(input.code)), eq(schema.accountCodes.clientId, client.id), isNull(schema.accountCodes.usedAt)))
    .returning()
  if (!row) return null
  const fresh = row.expiresAt.getTime() > now.getTime()
  const sameAddress = typeof input.redirectUri === 'string' && sameText(input.redirectUri, row.redirectUri)
  const proven = isPkceVerifier(input.codeVerifier) && sameText(challengeOf(input.codeVerifier), row.codeChallenge)
  return fresh && sameAddress && proven ? row.userId : null
}

// ── members ─────────────────────────────────────────────────────────────────────

/**
 * A person signed in to a website through the account: they are a member of it from now on.
 * The issuer cannot know what the website did with them (it may have found nobody of that
 * e-mail and turned them away), so a member is LISTED, in "My websites" and in the switcher of
 * the owner's other websites, only once the website has said that it lets them in (`membership`
 * with a role; a website does that right after it opens its session). Whether a website that
 * said it no longer lets them in changed its mind is for the website to say too, so `active` is
 * left as it is for somebody already known.
 */
export async function noteSignIn(clientId: string, userId: string): Promise<void> {
  const now = new Date()
  await useDb().insert(schema.accountMembers).values({ clientId, userId, lastSignInAt: now })
    .onConflictDoUpdate({ target: [schema.accountMembers.clientId, schema.accountMembers.userId], set: { lastSignInAt: now, updatedAt: now } })
}

/** A member the website has confirmed and still lets in: the ones that are shown. */
const shown = (member: { active: boolean; confirmedAt: Date | null } | null | undefined): boolean => !!member?.active && !!member.confirmedAt

/** What a website says about a person: their role there, or that it no longer lets them in. False when the person never signed in to it. */
export async function reportMembership(clientId: string, userId: string, report: { role: unknown; active: boolean }): Promise<boolean> {
  const role = memberRole(report.role)
  const now = new Date()
  const rows = await useDb().update(schema.accountMembers)
    .set({
      active: report.active, ...(role ? { role } : {}), updatedAt: now,
      // The first time the website lets the person in: from now on they are listed.
      ...(report.active ? { confirmedAt: sql`coalesce(${schema.accountMembers.confirmedAt}, ${now})` } : {}),
    })
    .where(and(eq(schema.accountMembers.clientId, clientId), eq(schema.accountMembers.userId, userId)))
    .returning({ clientId: schema.accountMembers.clientId })
  if (rows.length && report.active) await noteOwnerEntered(clientId, userId, now)
  return rows.length > 0
}

/**
 * A cloud-made site said that it lets its OWNER in: the owner has been in the admin. The cloud
 * otherwise learns that by asking the site whether anybody is still waiting on an invitation
 * (provision.ts, noteAcceptance), which stops being true the moment the owner invites a colleague.
 * The invitation link is of no use any more and is forgotten.
 */
async function noteOwnerEntered(clientId: string, userId: string, at: Date): Promise<void> {
  const db = useDb()
  const [client] = await db.select({ siteId: schema.accountClients.siteId, ownerId: schema.accountClients.ownerId }).from(schema.accountClients).where(eq(schema.accountClients.id, clientId))
  if (!client?.siteId || client.ownerId !== userId) return
  await db.update(schema.sites).set({ ownerAcceptedAt: at, inviteUrl: null, updatedAt: at })
    .where(and(eq(schema.sites.id, client.siteId), eq(schema.sites.ownerId, userId), isNull(schema.sites.ownerAcceptedAt)))
}

/** Whether a client can be listed and opened: not revoked, with an address, and its cloud-made site (if it is one) ready. */
const usable = (client: AccountClientRow, site: Pick<SiteRow, 'status'> | null): boolean =>
  !client.revokedAt && !!client.url && (!client.siteId || site?.status === 'ready')

export interface SwitcherSite { id: string; name: string; url: string; role: string | null; current: boolean }

/**
 * A person's websites as one website's switcher may show them: the clients OF THE SAME OWNER
 * as the asking client that the person is a member of (or owns), the asking one marked. A
 * person who never signed in to the asking website, or whom it no longer lets in (and who does
 * not own it), gets nothing. The other websites are listed once they confirmed the person.
 */
export async function switcherSites(asking: AccountClientRow, userId: string): Promise<SwitcherSite[]> {
  const db = useDb()
  const owns = asking.ownerId === userId
  const rows = await db.select({ client: schema.accountClients, site: schema.sites, member: schema.accountMembers })
    .from(schema.accountClients)
    .leftJoin(schema.sites, eq(schema.sites.id, schema.accountClients.siteId))
    .leftJoin(schema.accountMembers, and(eq(schema.accountMembers.clientId, schema.accountClients.id), eq(schema.accountMembers.userId, userId)))
    .where(and(eq(schema.accountClients.ownerId, asking.ownerId), isNull(schema.accountClients.revokedAt)))
    .orderBy(asc(schema.accountClients.createdAt))
  const here = rows.find((r) => r.client.id === asking.id)
  if (!here || !(owns || here.member?.active)) return []
  return rows
    // The asking website is running and lets the person in (it is asking for them), whatever the cloud knows of it.
    .filter((r) => (r.client.id === asking.id ? !!r.client.url : usable(r.client, r.site) && (owns || shown(r.member))))
    .map((r) => ({ id: r.client.id, name: r.site?.name ?? r.client.name, url: r.client.url!, role: r.member?.active ? r.member.role : null, current: r.client.id === asking.id }))
}

// ── "My websites": connected websites, and other people's websites the person may edit ──

function toConnectedView(client: AccountClientRow): ConnectedSiteView {
  return { id: client.id, name: client.name, url: client.url!, adminUrl: adminThroughAccount(client.url!), createdAt: client.createdAt.toISOString() }
}

/** The websites somebody runs themselves and connected to their account. */
export async function connectedSites(ownerId: string): Promise<ConnectedSiteView[]> {
  const rows = await useDb().select().from(schema.accountClients)
    .where(and(eq(schema.accountClients.ownerId, ownerId), isNull(schema.accountClients.siteId), isNull(schema.accountClients.revokedAt)))
    .orderBy(asc(schema.accountClients.createdAt))
  return rows.filter((r) => !!r.url).map(toConnectedView)
}

/** The websites of other owners the person signed in to through the account, which confirmed them and still let them in. */
export async function memberSites(userId: string): Promise<MemberSiteView[]> {
  const rows = await useDb().select({ client: schema.accountClients, site: schema.sites, member: schema.accountMembers })
    .from(schema.accountMembers)
    .innerJoin(schema.accountClients, eq(schema.accountClients.id, schema.accountMembers.clientId))
    .leftJoin(schema.sites, eq(schema.sites.id, schema.accountClients.siteId))
    .where(and(eq(schema.accountMembers.userId, userId), eq(schema.accountMembers.active, true), isNotNull(schema.accountMembers.confirmedAt), ne(schema.accountClients.ownerId, userId)))
    .orderBy(asc(schema.accountMembers.createdAt))
  return rows.filter((r) => usable(r.client, r.site))
    .map((r) => ({ id: r.client.id, name: r.site?.name ?? r.client.name, url: r.client.url!, role: r.member.role, adminUrl: adminThroughAccount(r.client.url!) }))
}

/** How many websites one account may connect (they do not count against the limit of websites made here). */
export const MAX_CONNECTED_SITES = 50

/** Connect a website somebody runs themselves: a client of its own. The secret is in the answer and nowhere else. */
export async function connectSite(owner: Me, input: { name: string; url: string }): Promise<{ client: ConnectedSiteView; credentials: ClientCredentials }> {
  const url = clientAddress(input.url)
  if (!url) throw fail(422, 'client.address', 'Not a website address', { field: 'url' })
  const db = useDb()
  const mine = await db.select({ url: schema.accountClients.url }).from(schema.accountClients)
    .where(and(eq(schema.accountClients.ownerId, owner.id), isNull(schema.accountClients.siteId), isNull(schema.accountClients.revokedAt)))
  if (mine.some((c) => c.url === url)) throw fail(409, 'client.exists', 'This website is already connected')
  if (mine.length >= MAX_CONNECTED_SITES) throw fail(403, 'client.limit', `An account can connect ${MAX_CONNECTED_SITES} websites`, { max: MAX_CONNECTED_SITES })
  const secret = newClientSecret()
  const [row] = await db.insert(schema.accountClients).values({ ownerId: owner.id, name: input.name, url, secretHash: sha256(secret) }).returning()
  if (!row) throw fail(500, 'unexpected', 'Could not save the website')
  return { client: toConnectedView(row), credentials: clientCredentials(row.id, secret) }
}

/** The connected website in the address (`/api/clients/:id`), if it is the signed-in person's; 404 otherwise. */
export async function requireOwnClient(event: H3Event): Promise<{ me: Me; client: AccountClientRow }> {
  const me = await requireUser(event)
  const client = await findClient(getRouterParam(event, 'id'))
  if (!client || client.ownerId !== me.id || client.siteId || client.revokedAt) throw fail(404, 'client.none', 'No such connected website')
  return { me, client }
}

/** A new secret for a connected website: the old one stops working at once. */
export async function renewClientSecret(client: AccountClientRow): Promise<ClientCredentials> {
  const secret = newClientSecret()
  await useDb().update(schema.accountClients).set({ secretHash: sha256(secret), updatedAt: new Date() }).where(eq(schema.accountClients.id, client.id))
  return clientCredentials(client.id, secret)
}

/** A client stops working: its website was disconnected or deleted. Codes that were on their way go with it. */
export async function revokeClient(clientId: string): Promise<void> {
  const db = useDb()
  await db.update(schema.accountClients).set({ revokedAt: new Date(), updatedAt: new Date() }).where(and(eq(schema.accountClients.id, clientId), isNull(schema.accountClients.revokedAt)))
  await db.delete(schema.accountCodes).where(eq(schema.accountCodes.clientId, clientId))
}

// ── the client of a website the cloud makes ─────────────────────────────────────

/**
 * Make sure a cloud-made site has its client, before the site starts: the id and the secret are
 * kept with the site's other secrets (so a retry or a restart hands the same ones over), the
 * client's row holds the secret's hash, the owner and, once the site has one, its address.
 * Returns the site's secrets as they are now.
 */
export async function ensureSiteClient(site: SiteRow): Promise<SiteSecrets> {
  const db = useDb()
  let secrets = readSecrets(site)
  if (!secrets.accountClientId || !secrets.accountClientSecret) {
    secrets = { ...secrets, ...newAccountClientSecrets() }
    await db.update(schema.sites).set({ secrets: encryptSecret(JSON.stringify(secrets)), updatedAt: new Date() }).where(eq(schema.sites.id, site.id))
  }
  const url = site.publicUrl ? new URL(site.publicUrl).origin : null
  const values = { ownerId: site.ownerId, siteId: site.id, name: site.name, secretHash: sha256(secrets.accountClientSecret!) }
  await db.insert(schema.accountClients).values({ id: secrets.accountClientId!, ...values, url })
    .onConflictDoUpdate({ target: schema.accountClients.id, set: { ...values, ...(url ? { url } : {}), revokedAt: null, updatedAt: new Date() } })
  return secrets
}

/** The site has its address now: its client may be used. */
export async function setSiteClientAddress(siteId: string, publicUrl: string): Promise<void> {
  await useDb().update(schema.accountClients).set({ url: new URL(publicUrl).origin, updatedAt: new Date() }).where(eq(schema.accountClients.siteId, siteId))
}

/** The site is being deleted: its client stops working. */
export async function revokeSiteClient(siteId: string): Promise<void> {
  const [client] = await useDb().select({ id: schema.accountClients.id }).from(schema.accountClients).where(eq(schema.accountClients.siteId, siteId))
  if (client) await revokeClient(client.id)
}
