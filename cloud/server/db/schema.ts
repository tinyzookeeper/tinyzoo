import { sql } from 'drizzle-orm'
import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { Step } from '../../shared/steps'
import type { SiteStatus } from '../../shared/api'
import type { SharedSiteRow, SharedSiteState } from '../../shared/sharedHosting'
import type { Locale } from '../../shared/templates'
import type { SiteExport, SiteImport } from '../../shared/transfer'

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date', precision: 3 })

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Stored lower-cased.
  email: text('email').notNull(),
  name: text('name').notNull().default(''),
  passwordHash: text('password_hash').notNull(),
  // When the address was confirmed (the link in the e-mail); null until then.
  emailVerifiedAt: ts('email_verified_at'),
  // The language of the pages and e-mails.
  locale: text('locale').$type<Locale>().notNull().default('cs'),
  // Bumped on a password change: older sessions stop working.
  sessionVersion: integer('session_version').notNull().default(0),
  lastLoginAt: ts('last_login_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('users_email_unique').on(t.email)])

/**
 * The links sent by e-mail: confirm the address (`verify`), choose a new password (`reset`).
 * Only the SHA-256 of the secret is stored; a link works once and until it expires.
 */
export const emailTokens = pgTable('email_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').$type<'verify' | 'reset'>().notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: ts('expires_at').notNull(),
  usedAt: ts('used_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('email_tokens_hash_unique').on(t.tokenHash), index('email_tokens_user_idx').on(t.userId, t.kind)])

/**
 * A website someone made. `waiting`: its owner has yet to confirm their e-mail. `creating`:
 * the steps are running (or wait to be picked up after a restart). `ready`, `failed` (a step
 * failed; "Try again" resumes from it), `removing`, `removed` (kept as a record; its address is free again).
 */
export const sites = pgTable('sites', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  // The address: <slug>.localhost:<port> locally, <slug>.pushbase.app on Pushbase. Also the database's and the folder's name.
  slug: text('slug').notNull(),
  template: text('template').notNull(),
  // The look of the template chosen in the wizard (shared/templates.ts); null for a template with one design.
  look: text('look'),
  status: text('status').$type<SiteStatus>().notNull().default('creating'),
  // The hosting driver that made it (local, pushbase): it also runs and removes it.
  driver: text('driver').notNull(),
  publicUrl: text('public_url'),
  // Where the cloud itself reaches the site (the same as publicUrl on a real host).
  internalUrl: text('internal_url'),
  // Whatever the driver needs to find the site again (the local one: its port, folder and database).
  driverState: jsonb('driver_state').$type<Record<string, unknown>>(),
  // Encrypted JSON (server/utils/secret.ts): the site's app secret, setup code, status token, the service account's
  // password, and the id and secret of its client at the account service (accountClients below).
  secrets: text('secrets').notNull(),
  // Encrypted: the link where the owner chooses their password for the admin.
  inviteUrl: text('invite_url'),
  inviteSentAt: ts('invite_sent_at'),
  ownerAcceptedAt: ts('owner_accepted_at'),
  steps: jsonb('steps').$type<Step[]>().notNull().default([]),
  // Technical detail of the last failure (the step's own `message` holds the plain-words code).
  error: text('error'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
  readyAt: ts('ready_at'),
  removedAt: ts('removed_at'),
  // The site's plan (shared/plans.ts): what it may store. The numbers go to the site in its row of the site directory.
  plan: text('plan').notNull().default('basic'),
  // What the site does with a request (the shared driver writes it into the site's row): served
  // (`active`), `paused`, `read-only` while it is copied, or `moved` to `movedTo`.
  hostState: text('host_state').$type<SharedSiteState>().notNull().default('active'),
  movedTo: text('moved_to'),
  // A moved site whose database and files were deleted here: its address still redirects.
  dataRemovedAt: ts('data_removed_at'),
  // Moving out (shared/transfer.ts): the steps of the export and the archive's name.
  moveOut: jsonb('move_out').$type<SiteExport>(),
  // A site that came in as an archive: where the upload lies until it is restored, and where the site came from.
  moveIn: jsonb('move_in').$type<SiteImport>(),
}, (t) => [
  // An address belongs to one website at a time; a removed one gives it back.
  uniqueIndex('sites_slug_unique').on(t.slug).where(sql`${t.status} <> 'removed'`),
  index('sites_owner_idx').on(t.ownerId),
])

/**
 * A domain of its owner's own for a website. A name belongs to one website at a time (the
 * unique index). It is used once the DNS was seen to lead to the service (`verifiedAt`); one
 * verified domain may be the site's address (`main`), the others redirect to the address.
 */
export const siteDomains = pgTable('site_domains', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  // Lower case, no port; a name in another script as its punycode.
  host: text('host').notNull(),
  main: boolean('main').notNull().default(false),
  verifiedAt: ts('verified_at'),
  checkedAt: ts('checked_at'),
  // Why the last check said no (shared/domains.ts, DomainWait); null once verified.
  wait: text('wait'),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('site_domains_host_unique').on(t.host), index('site_domains_site_idx').on(t.siteId)])

/**
 * The site directory of the shared driver when it is kept here (NUXT_HOSTING_SHARED_DIRECTORY=postgres):
 * one row per site, read by each template's process (tinyzoo's multi-tenant mode,
 * packages/cms/server/utils/cmsSite.ts) with a role that may only read this table. `row` is
 * the site's row as that process takes it, every secret in it encrypted with the directory
 * key. `updatedAt` changes with every write: it is how the process notices.
 */
export const tenantSites = pgTable('tenant_sites', {
  id: text('id').primaryKey(),
  template: text('template').notNull(),
  row: jsonb('row').$type<SharedSiteRow>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => [index('tenant_sites_template_idx').on(t.template)])

// ── The account service: the cloud as the issuer of sign-in for websites (docs/multi-tenant-plan.md, 2.15) ──

/**
 * A website that may ask the account who a person is: a website the cloud made (`siteId`), or
 * one somebody runs themselves and connected to their account (`siteId` null). The row's id is
 * the `client_id`. Only the SHA-256 of the secret is stored; it is shown once (a cloud-made
 * site's is also kept, encrypted, with the site's other secrets, to hand it over again).
 */
export const accountClients = pgTable('account_clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  // The account the client belongs to. A website's switcher lists only clients of one owner.
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // The cloud-made website this client is for; null for a connected one.
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // The website's address (scheme, host, port): a sign-in comes back to this address and no other.
  // Null until a cloud-made site has its address; such a client cannot be used yet.
  url: text('url'),
  secretHash: text('secret_hash').notNull(),
  // Set when the website was deleted or disconnected: the client stops working and is listed nowhere.
  revokedAt: ts('revoked_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('account_clients_site_unique').on(t.siteId),
  index('account_clients_owner_idx').on(t.ownerId),
])

/**
 * One-time codes of a sign-in: bound to the client, the address the answer goes to, the PKCE
 * challenge and the person. Only the SHA-256 is stored; a code works once and for a minute.
 */
export const accountCodes = pgTable('account_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  codeHash: text('code_hash').notNull(),
  clientId: uuid('client_id').notNull().references(() => accountClients.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  redirectUri: text('redirect_uri').notNull(),
  codeChallenge: text('code_challenge').notNull(),
  expiresAt: ts('expires_at').notNull(),
  usedAt: ts('used_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('account_codes_hash_unique').on(t.codeHash), index('account_codes_expires_idx').on(t.expiresAt)])

/**
 * Who has signed in to which website through the account, with the role the website last
 * reported and whether it still lets them in. Rights are the website's own business: this is
 * only what "My websites" and a website's switcher show. A row is made by a sign-in; it is shown
 * once the website has confirmed the person (`confirmedAt`) and while it lets them in (`active`).
 */
export const accountMembers = pgTable('account_members', {
  clientId: uuid('client_id').notNull().references(() => accountClients.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // As the website last said; null until it has.
  role: text('role'),
  // False once the website said it no longer lets the person in.
  active: boolean('active').notNull().default(true),
  // When the website first said that it lets the person in (their role). A person who only signed
  // in is known here, but listed nowhere until then: the website may have turned them away.
  confirmedAt: ts('confirmed_at'),
  lastSignInAt: ts('last_sign_in_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.clientId, t.userId] }), index('account_members_user_idx').on(t.userId)])

export type UserRow = typeof users.$inferSelect
export type SiteRow = typeof sites.$inferSelect
export type SiteDomainRow = typeof siteDomains.$inferSelect
export type AccountClientRow = typeof accountClients.$inferSelect
export type AccountMemberRow = typeof accountMembers.$inferSelect
