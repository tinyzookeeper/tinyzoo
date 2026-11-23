import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { and, eq, inArray } from 'drizzle-orm'
import { beginStep, completeStep, failStep, initialSteps, isDone, nextStep, normalizeSteps, resumeSteps, type Step, type StepId } from '#shared/steps'
import { lookOf, templateById, type LookDef, type TemplateDef } from '#shared/templates'
import type { SiteRow } from '../db/schema'
import { HostingError, hostingDriverName, useHosting } from '../hosting'

// Making a website, start to finish. A small state machine kept in sites.steps (shared/steps.ts):
//
//   database, start   the hosting driver: infrastructure, until the site answers
//   content           the template's seed, run against the site: it creates the service
//                     account "tinyzoo" and fills the demo content
//   account           the cloud signs in as the service account, writes the site's name (and
//                     the look chosen in the wizard) into its settings and invites the owner
//                     as an administrator; the link is kept for their page
//
// It runs in the background, never inside a request. Each step is written down before and
// after, so a failure shows where it was, "Try again" goes on from there, and a restart of the
// server picks unfinished sites up again (server/plugins/1.resume.ts). A Postgres advisory lock
// per site keeps two runs from working on the same one.

const running = new Set<string>()

/** A failure of a step, with the dictionary's `fail.*` code and the detail for the log. */
class StepError extends Error {
  constructor(readonly code: string, readonly detail: string) { super(`${code}: ${detail}`) }
}

async function loadSite(id: string): Promise<SiteRow | null> {
  const [row] = await useDb().select().from(schema.sites).where(eq(schema.sites.id, id))
  return row ?? null
}

async function saveSite(id: string, change: Partial<SiteRow>): Promise<void> {
  await useDb().update(schema.sites).set({ ...change, updatedAt: new Date() }).where(eq(schema.sites.id, id))
}

/** One run per site across processes: a session-level advisory lock on a connection of its own. */
async function withSiteLock(siteId: string, work: () => Promise<void>): Promise<boolean> {
  const client = await usePool().connect()
  try {
    const got = await client.query<{ ok: boolean }>('select pg_try_advisory_lock(hashtext($1)) as ok', [`tinyzoo-cloud:site:${siteId}`])
    if (!got.rows[0]?.ok) return false
    try { await work() }
    finally { await client.query('select pg_advisory_unlock(hashtext($1))', [`tinyzoo-cloud:site:${siteId}`]).catch(() => {}) }
    return true
  }
  finally {
    client.release()
  }
}

/** Start (or go on) making a site, in the background. Safe to call twice. */
export function startProvision(siteId: string): void {
  if (running.has(siteId)) return
  running.add(siteId)
  void withSiteLock(siteId, () => provision(siteId))
    .catch((err) => console.error('[cloud] provisioning crashed', siteId, err?.message ?? err))
    .finally(() => running.delete(siteId))
}

async function provision(siteId: string): Promise<void> {
  const loaded = await loadSite(siteId)
  if (!loaded || loaded.status !== 'creating') return
  let site: SiteRow = loaded
  let steps = resumeSteps(normalizeSteps(site.steps))
  await saveSite(site.id, { steps, error: null })

  const mark = async (next: Step[]) => { steps = next; await saveSite(site.id, { steps }) }
  /** Run one step: written down as running, then done; a step already done is skipped. */
  const step = async (id: StepId, work: () => Promise<void>) => {
    if (isDone(steps, id)) return
    await mark(beginStep(steps, id))
    await work()
    await mark(completeStep(steps, id))
  }

  try {
    const template = templateById(site.template)
    if (!template?.ready) throw new StepError('template_not_built', `template "${site.template}" cannot be used`)
    const driver = useHosting(site.driver)
    const secrets = readSecrets(site)

    // database + start: the driver's part. It reports both steps as it goes.
    if (!isDone(steps, 'database') || !isDone(steps, 'start')) {
      const made = await driver.provision({ siteId: site.id, slug: site.slug, template, env: siteEnv(secrets) }, async (id, state) => {
        if (isDone(steps, id)) return
        await mark(state === 'running' ? beginStep(steps, id) : completeStep(steps, id))
      })
      // A driver that reported nothing still ends with both steps done.
      for (const id of ['database', 'start'] as const) {
        if (!isDone(steps, id)) await mark(completeStep(beginStep(steps, id), id))
      }
      await saveSite(site.id, { publicUrl: made.publicUrl, internalUrl: made.internalUrl, driverState: made.state })
      site = { ...site, publicUrl: made.publicUrl, internalUrl: made.internalUrl, driverState: made.state }
    }
    else {
      // Going on after a restart: the site was up once; make sure it still is.
      await driver.ensureRunning(hostedSite(site))
    }
    const internalUrl = site.internalUrl!

    await step('content', () => seedSite(template, internalUrl, secrets))

    await step('account', async () => {
      const [owner] = await useDb().select().from(schema.users).where(eq(schema.users.id, site.ownerId))
      if (!owner) throw new StepError('account_failed', 'the owner\'s account is gone')
      const handed = await handOver(internalUrl, secrets, { name: site.name, look: lookOf(template, site.look) }, owner)
      await saveSite(site.id, {
        inviteUrl: handed.inviteUrl ? encryptSecret(handed.inviteUrl) : null,
        inviteSentAt: handed.inviteUrl ? new Date() : site.inviteSentAt,
        ownerAcceptedAt: handed.accepted ? (site.ownerAcceptedAt ?? new Date()) : null,
      })
    })

    await saveSite(site.id, { status: 'ready', readyAt: new Date(), error: null })
    console.info(`[cloud] ${site.slug} is ready at ${site.publicUrl}`)
    void notifyReady(site).catch(() => {})
  }
  catch (err: any) {
    const code = err instanceof HostingError || err instanceof StepError ? err.code : 'unexpected'
    const detail = err instanceof HostingError || err instanceof StepError ? err.detail : String(err?.stack ?? err?.message ?? err)
    const at = steps.find((s) => s.state === 'running')?.id ?? nextStep(steps) ?? 'account'
    steps = failStep(steps, at, code)
    await saveSite(site.id, { status: 'failed', steps, error: detail.slice(0, 4000) })
    console.error(`[cloud] ${site.slug} failed at "${at}" (${code}): ${detail}`)
  }
}

async function notifyReady(site: SiteRow): Promise<void> {
  const [owner] = await useDb().select().from(schema.users).where(eq(schema.users.id, site.ownerId))
  if (!owner || !site.publicUrl) return
  await sendMail(siteReadyEmail(owner, { name: site.name, publicUrl: site.publicUrl }, `${publicUrl()}/sites/${site.id}`))
}

// ── content: the template's seed ────────────────────────────────────────────────

/** The repository's root: the nearest folder upwards with a pnpm-workspace.yaml (or NUXT_HOSTING_LOCAL_ROOT). */
function repoRoot(): string {
  const configured = String((useRuntimeConfig().hosting as any)?.local?.root || '')
  if (configured) return resolve(configured)
  let dir = resolve(process.cwd())
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    const up = dirname(dir)
    if (up === dir) return resolve(process.cwd(), '..')
    dir = up
  }
}

/**
 * Run the template's seed (`pnpm seed` in its source folder) against the running site. On a
 * fresh site it makes the first account (the service account) with the setup code, then fills
 * the demo content; run again, it signs in and leaves what is already there alone.
 */
function seedSite(template: TemplateDef, internalUrl: string, secrets: SiteSecrets): Promise<void> {
  if (!template.seed || !template.sourceDir) return ensureServiceAccount(internalUrl, secrets)
  const cwd = join(repoRoot(), template.sourceDir)
  if (!existsSync(join(cwd, 'seed'))) throw new StepError('seed_failed', `${cwd}/seed is missing`)
  return new Promise((done, reject) => {
    const child = spawn('pnpm', ['seed'], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      // A clean environment: the password travels here, never as an argument.
      env: {
        PATH: process.env.PATH ?? '',
        HOME: process.env.HOME ?? '',
        SEED_URL: internalUrl,
        SEED_EMAIL: serviceEmail(),
        SEED_PASSWORD: secrets.servicePassword,
        SEED_NAME: 'tinyzoo',
        SEED_SETUP_TOKEN: secrets.setupToken,
      },
    })
    let output = ''
    const keep = (d: Buffer) => { output = (output + String(d)).slice(-3000) }
    child.stdout.on('data', keep)
    child.stderr.on('data', keep)
    const timer = setTimeout(() => { child.kill('SIGTERM') }, 5 * 60_000)
    child.on('error', (err) => { clearTimeout(timer); reject(new StepError('seed_failed', `could not run the seed: ${err.message}`)) })
    child.on('exit', (code) => {
      clearTimeout(timer)
      if (code === 0) done()
      else reject(new StepError('seed_failed', `the seed ended with ${code ?? 'a signal'}:\n${output.trim()}`))
    })
  })
}

/** A template without demo content still gets the service account: the first account, made with the setup code. */
async function ensureServiceAccount(internalUrl: string, secrets: SiteSecrets): Promise<void> {
  const client = new SiteClient(internalUrl)
  try {
    const status = await client.get<{ needsSetup: boolean }>('/api/cms/_auth/status')
    if (status.needsSetup) await client.post('/api/cms/_auth/setup', { name: 'tinyzoo', email: serviceEmail(), password: secrets.servicePassword, token: secrets.setupToken })
  }
  catch (err: any) {
    throw new StepError('seed_failed', String(err?.message ?? err))
  }
}

// ── account: the name, and the way in for the owner ─────────────────────────────

const META = new Set(['id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'])

/** A singleton's row as its PUT takes it back: without bookkeeping, `<field>Id` twins and populated media. */
export function writableRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (META.has(key) || key.endsWith('__media')) continue
    if (key.endsWith('Id') && key.slice(0, -2) in row) continue
    out[key] = value
  }
  return out
}

async function serviceClient(internalUrl: string, secrets: SiteSecrets): Promise<SiteClient> {
  const client = new SiteClient(internalUrl)
  await client.signIn(serviceEmail(), secrets.servicePassword)
  return client
}

interface SiteUser { id: string; email: string; status: string }

/** A fresh invitation link for the owner, or `accepted` when they already chose their password. */
async function inviteOwner(client: SiteClient, owner: { email: string; name: string }): Promise<{ inviteUrl: string | null; accepted: boolean }> {
  try {
    const made = await client.post<{ inviteUrl: string }>('/api/cms/_users', { email: owner.email, name: owner.name, role: 'admin' })
    return { inviteUrl: made.inviteUrl, accepted: false }
  }
  catch (err) {
    if (!(err instanceof SiteHttpError) || err.status !== 409) throw err
  }
  // They are on the site already (an earlier try got this far): a new link, or nothing to do.
  const { users } = await client.get<{ users: SiteUser[] }>('/api/cms/_users')
  const existing = users.find((u) => u.email.toLowerCase() === owner.email.toLowerCase())
  if (!existing) throw new StepError('account_failed', `${owner.email} cannot be invited and is not on the site`)
  if (existing.status !== 'invited') return { inviteUrl: null, accepted: true }
  const again = await client.post<{ inviteUrl: string }>(`/api/cms/_users/${existing.id}/resend`)
  return { inviteUrl: again.inviteUrl, accepted: false }
}

async function handOver(internalUrl: string, secrets: SiteSecrets, site: { name: string; look: LookDef | null }, owner: { email: string; name: string; locale: string }): Promise<{ inviteUrl: string | null; accepted: boolean }> {
  try {
    const client = await serviceClient(internalUrl, secrets)
    // The site's name and look are content: read the settings, change them, write them back
    // whole. Every template with looks keeps the choice in the same two fields: `look`, and
    // `colors` (the look's default colours, so the two agree from the start).
    const mine = { siteName: site.name, ...(site.look ? { look: site.look.id, ...(site.look.colors ? { colors: site.look.colors } : {}) } : {}) }
    const settings = await client.get<{ row: Record<string, unknown> | null }>('/api/cms/_singleton/siteSettings')
    if (!settings.row) {
      await client.put('/api/cms/_singleton/siteSettings', mine)
    }
    else if (Object.entries(mine).some(([key, value]) => settings.row![key] !== value)) {
      await client.put('/api/cms/_singleton/siteSettings', { ...writableRow(settings.row), ...mine })
    }
    // The invitation e-mail (printed by the site) and page follow the inviter's language.
    await client.request('PATCH', '/api/cms/_auth/me', { locale: owner.locale }).catch(() => {})
    return await inviteOwner(client, owner)
  }
  catch (err: any) {
    if (err instanceof StepError) throw err
    throw new StepError('account_failed', String(err?.message ?? err))
  }
}

/** A fresh invitation link (the old one stops working), for an owner whose link expired. */
export async function refreshInvite(site: SiteRow): Promise<SiteRow> {
  if (site.status !== 'ready' || !site.internalUrl) throw fail(409, 'site.notReady', 'The website is not ready')
  const [owner] = await useDb().select().from(schema.users).where(eq(schema.users.id, site.ownerId))
  if (!owner) throw fail(404, 'site.none', 'No such website')
  await useHosting(site.driver).ensureRunning(hostedSite(site))
  const client = await serviceClient(site.internalUrl, readSecrets(site))
  const handed = await inviteOwner(client, owner)
  await saveSite(site.id, {
    inviteUrl: handed.inviteUrl ? encryptSecret(handed.inviteUrl) : null,
    inviteSentAt: handed.inviteUrl ? new Date() : site.inviteSentAt,
    ownerAcceptedAt: handed.accepted ? (site.ownerAcceptedAt ?? new Date()) : null,
  })
  return (await loadSite(site.id))!
}

// Whether the owner has used their invitation: asked of the site itself, at most every few seconds.
const lastAsked = new Map<string, number>()

/**
 * Note that the owner chose their password, once the site says nobody is waiting on an
 * invitation any more (GET /api/health/status: people.invited). Returns the row as it is now.
 */
export async function noteAcceptance(site: SiteRow): Promise<SiteRow> {
  if (site.status !== 'ready' || site.ownerAcceptedAt || !site.internalUrl) return site
  const now = Date.now()
  if (now - (lastAsked.get(site.id) ?? 0) < 4000) return site
  lastAsked.set(site.id, now)
  try {
    const status = await new SiteClient(site.internalUrl).get<{ people?: { active: number; invited: number } }>('/api/health/status', {
      headers: { authorization: `Bearer ${readSecrets(site).statusToken}` }, timeoutMs: 4000,
    })
    if (status.people && status.people.invited === 0 && status.people.active >= 2) {
      await saveSite(site.id, { ownerAcceptedAt: new Date(), inviteUrl: null })
      lastAsked.delete(site.id)
      return (await loadSite(site.id))!
    }
  }
  catch { /* the site does not answer right now: ask again later */ }
  return site
}

// ── making, retrying, removing ──────────────────────────────────────────────────

/** A new website for someone. It starts at once, or waits until its owner confirms their e-mail. */
export async function createSite(owner: Me, input: { name: string; slug: string; template: string; look: string | null }): Promise<SiteRow> {
  const waits = requireVerifiedEmail() && !owner.emailVerifiedAt
  let row: SiteRow | undefined
  try {
    ;[row] = await useDb().insert(schema.sites).values({
      ownerId: owner.id,
      name: input.name,
      slug: input.slug,
      template: input.template,
      look: input.look,
      status: waits ? 'waiting' : 'creating',
      driver: hostingDriverName(),
      secrets: encryptSecret(JSON.stringify(newSiteSecrets())),
      steps: initialSteps(),
    }).returning()
  }
  catch (err: any) {
    // Someone took the address between the check and the save.
    if (err?.code === '23505' || err?.cause?.code === '23505') throw fail(409, 'slug.taken', 'This address is taken')
    throw err
  }
  if (!row) throw fail(500, 'unexpected', 'Could not save the website')
  if (!waits) startProvision(row.id)
  return row
}

/** Go on from the step that failed. */
export async function retrySite(site: SiteRow): Promise<SiteRow> {
  if (site.status !== 'failed') return site
  await saveSite(site.id, { status: 'creating', steps: resumeSteps(normalizeSteps(site.steps)), error: null })
  startProvision(site.id)
  return (await loadSite(site.id))!
}

/** The e-mail was confirmed: the websites that waited for it start. */
export async function startWaitingSites(ownerId: string): Promise<string[]> {
  const rows = await useDb().update(schema.sites).set({ status: 'creating', updatedAt: new Date() })
    .where(and(eq(schema.sites.ownerId, ownerId), eq(schema.sites.status, 'waiting'))).returning({ id: schema.sites.id })
  for (const r of rows) startProvision(r.id)
  return rows.map((r) => r.id)
}

/** Stop a website and remove its data, in the background. The row stays as a record; its address is free again. */
export async function removeSite(site: SiteRow): Promise<void> {
  await saveSite(site.id, { status: 'removing' })
  void finishRemoval(site.id).catch((err) => console.error('[cloud] removal crashed', site.slug, err?.message ?? err))
}

export async function finishRemoval(siteId: string): Promise<void> {
  await withSiteLock(siteId, async () => {
    const site = await loadSite(siteId)
    if (!site || site.status !== 'removing') return
    try {
      await useHosting(site.driver).remove(hostedSite(site))
      await saveSite(site.id, { status: 'removed', removedAt: new Date(), inviteUrl: null, error: null })
      console.info(`[cloud] ${site.slug} was removed`)
    }
    catch (err: any) {
      const detail = err instanceof HostingError ? err.detail : String(err?.message ?? err)
      await saveSite(site.id, { error: `removal failed: ${detail}`.slice(0, 4000) })
      console.error(`[cloud] removing ${site.slug} failed: ${detail}`)
    }
  })
}

/**
 * After the server starts: go on with the sites that were being made or removed, and bring
 * the ready ones up again if they are down (a restart of the machine, say).
 */
export async function resumeSites(): Promise<void> {
  const db = useDb()
  const rows = await db.select().from(schema.sites).where(inArray(schema.sites.status, ['creating', 'removing', 'ready']))
  for (const site of rows.filter((s) => s.status === 'creating')) startProvision(site.id)
  for (const site of rows.filter((s) => s.status === 'removing')) void finishRemoval(site.id).catch(() => {})
  for (const site of rows.filter((s) => s.status === 'ready')) {
    try {
      await useHosting(site.driver).ensureRunning(hostedSite(site))
    }
    catch (err: any) {
      console.error(`[cloud] ${site.slug} could not be started again: ${err instanceof HostingError ? err.detail : err?.message ?? err}`)
    }
  }
  if (rows.length) console.info(`[cloud] ${rows.filter((s) => s.status === 'ready').length} site(s) checked, ${rows.filter((s) => s.status === 'creating').length} being made`)
}

