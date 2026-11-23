import { execFile, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { promisify } from 'node:util'
import { and, asc, eq, isNotNull } from 'drizzle-orm'
import type { H3Event } from 'h3'
import pg from 'pg'
import { movedAddress } from '#shared/domains'
import { sharedSiteHost } from '#shared/sharedHosting'
import {
  archiveName, beginExportStep, completeExportStep, exportState, exportStepDone, failExportStep, newExport, normalizeExport, parseArchiveManifest,
  parseSiteFile, resumeExportSteps, type ArchiveManifest, type ExportStepId, type SiteExport, type SiteFile,
} from '#shared/transfer'
import type { SiteRow } from '../db/schema'
import { HostingError, useHosting, type SiteAccess } from '../hosting'
import { sharedDataDir } from '../hosting/shared'

// Moving a website out of shared hosting, and into it (docs/multi-tenant-plan.md, 2.10).
//
// Out: the site answers reads only, `tinyzoo backup` copies its database and its files into
// one archive, the site is served again. The archive stays in the site's own folder, outside
// anything that is served, and only its owner can download it. When the owner says the site
// now lives elsewhere, its row becomes `moved`: every request to its address here is sent on
// to the new one. After that its data here can be deleted; the address keeps redirecting
// until the website itself is deleted.
//
// In: an uploaded archive becomes a new site of the archive's template: a database, a user
// and a folder as for any site, with its row `paused` until `tinyzoo restore` has put the
// archive into them (server/utils/provision.ts runs that as the site's `content` step).
//
// tinyzoo's command line is run from the template's own source folder's packages, with a
// clean environment: the site's own database address and its own upload folder, and nothing
// of the cloud's. It needs pg_dump, pg_restore and psql; where the machine has none, the
// cloud's TINYZOO_PG_DUMP / TINYZOO_PG_RESTORE / TINYZOO_PSQL name wrapper programs
// (scripts/pg-tools) and are handed on.

const run = promisify(execFile)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** A failure of a move, with the dictionary's code (`move.fail.<code>`) and the detail for the log. */
class MoveError extends Error {
  constructor(readonly code: string, readonly detail: string) { super(`${code}: ${detail}`) }
}

async function loadSite(id: string): Promise<SiteRow | null> {
  const [row] = await useDb().select().from(schema.sites).where(eq(schema.sites.id, id))
  return row ?? null
}
const saveSite = (id: string, change: Partial<SiteRow>) => useDb().update(schema.sites).set({ ...change, updatedAt: new Date() }).where(eq(schema.sites.id, id))

// ── tinyzoo's command line ──────────────────────────────────────────────────────

/** The settings of the Postgres tools the cloud was started with, handed on to the command line as they are. */
function toolEnv(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const name of ['TINYZOO_PG_DUMP', 'TINYZOO_PG_RESTORE', 'TINYZOO_PSQL', 'TINYZOO_PG_CONTAINER', 'TINYZOO_PG_CONTAINER_PORT', 'TINYZOO_MAX_ARCHIVE_BYTES']) {
    if (process.env[name]) out[name] = process.env[name]!
  }
  return out
}

/**
 * Run `tinyzoo <args>` for one site: with the site's own database address and upload folder in
 * the child's environment (never as arguments), from a folder that holds no settings of its
 * own. Resolves to what it printed.
 */
function runCli(access: SiteAccess, args: string[], cwd: string): Promise<string> {
  const tsx = join(access.sourceDir, 'node_modules', '.bin', 'tsx')
  const entry = join(access.sourceDir, 'node_modules', 'tinyzoo', 'cli', 'index.ts')
  if (!existsSync(tsx) || !existsSync(entry)) throw new MoveError('tools_missing', `tinyzoo's command line is not installed in ${access.sourceDir}`)
  return new Promise((done, reject) => {
    const child = spawn(tsx, [entry, ...args], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        PATH: process.env.PATH ?? '',
        HOME: process.env.HOME ?? '',
        ...(process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {}),
        ...toolEnv(),
        NUXT_CMS_DATABASE_URL: access.databaseUrl,
        NUXT_CMS_STORAGE_DRIVER: 'local',
        NUXT_CMS_STORAGE_LOCAL_DIR: access.uploadsDir,
      },
    })
    let output = ''
    const keep = (d: Buffer) => { output = (output + String(d)).slice(-4000) }
    child.stdout.on('data', keep)
    child.stderr.on('data', keep)
    const timer = setTimeout(() => { child.kill('SIGTERM') }, 60 * 60_000)
    child.on('error', (err) => { clearTimeout(timer); reject(new MoveError('tools_missing', `could not run tinyzoo ${args[0]}: ${err.message}`)) })
    child.on('exit', (code) => {
      clearTimeout(timer)
      if (code === 0) return done(output)
      // The password is in the child's environment only; what it printed names the database, never the password.
      const missing = /was not found|could not start/.test(output)
      reject(new MoveError(missing ? 'tools_missing' : `${args[0]}_failed`, `tinyzoo ${args[0]} ended with ${code ?? 'a signal'}:\n${output.trim()}`))
    })
  })
}

// ── out ─────────────────────────────────────────────────────────────────────────

/** Moving is for a site on a driver that can say where the site's data is and change its state (the shared one). */
function requireMovable(site: SiteRow) {
  const driver = useHosting(site.driver)
  if (!driver.access || !driver.refresh || !driver.removeData) throw fail(409, 'move.unavailable', 'This website cannot be moved from here')
  return driver as typeof driver & Required<Pick<typeof driver, 'access' | 'refresh' | 'removeData'>>
}

/** The folder a site's archives are kept in: inside the site's own folder, beside its uploads, never under them. */
const exportsDir = (site: Pick<SiteRow, 'driverState'>): string | null => (typeof site.driverState?.dir === 'string' ? join(site.driverState.dir, 'exports') : null)

/** The site's archive on the disk, when there is one. */
export function archivePathOf(site: Pick<SiteRow, 'driverState' | 'moveOut' | 'dataRemovedAt'>): string | null {
  const stored = normalizeExport(site.moveOut)
  const dir = exportsDir(site)
  if (!stored?.file || !dir || site.dataRemovedAt || !exportStepDone(stored.steps, 'backup')) return null
  const path = join(dir, stored.file)
  return existsSync(path) ? path : null
}

/** Change what the site does with requests, and wait until its process does so. */
async function setHostState(site: SiteRow, state: SiteRow['hostState']): Promise<SiteRow> {
  await saveSite(site.id, { hostState: state })
  const next = { ...site, hostState: state }
  await requireMovable(next).refresh(hostedSite(next))
  return next
}

/** `site.json` of an archive: what the new home needs besides the data (shared/transfer.ts). */
async function siteFileOf(site: SiteRow, access: SiteAccess): Promise<SiteFile> {
  const secrets = readSecrets(site)
  const domains = await useDb().select({ host: schema.siteDomains.host }).from(schema.siteDomains)
    .where(and(eq(schema.siteDomains.siteId, site.id), isNotNull(schema.siteDomains.verifiedAt))).orderBy(asc(schema.siteDomains.createdAt))
  const main = site.publicUrl ? new URL(site.publicUrl).hostname : sharedSiteHost(site.slug)
  const hosts = [...new Set([main, ...domains.map((d) => d.host), sharedSiteHost(site.slug)])]
  return {
    format: 'tinyzoo-site', version: 1, exportedAt: new Date().toISOString(),
    name: site.name, template: site.template, look: site.look, tinyzooVersion: access.tinyzooVersion,
    publicUrl: site.publicUrl ?? '', hosts,
    secret: secrets.appSecret, statusToken: secrets.statusToken,
    account: secrets.accountClientId ? { issuer: publicUrl(), clientId: secrets.accountClientId } : null,
    plan: site.plan,
  }
}

/** Put `site.json` into the archive, beside what `tinyzoo backup` wrote (a plain tar: one more file at its end). */
async function addSiteFile(archive: string, file: SiteFile): Promise<void> {
  const staging = mkdtempSync(join(tmpdir(), 'tinyzoo-cloud-site-'))
  try {
    writeFileSync(join(staging, 'site.json'), `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 })
    await run('tar', ['-rf', archive, '-C', staging, 'site.json'])
  }
  finally {
    rmSync(staging, { recursive: true, force: true })
  }
}

const exporting = new Set<string>()

/** Go on with a site's export in the background. Safe to call twice. */
export function continueExport(siteId: string): void {
  if (exporting.has(siteId)) return
  exporting.add(siteId)
  void withSiteLock(siteId, () => runExport(siteId))
    .catch((err) => console.error('[cloud] an export crashed', siteId, err?.message ?? err))
    .finally(() => exporting.delete(siteId))
}

async function runExport(siteId: string): Promise<void> {
  const loaded = await loadSite(siteId)
  const stored = loaded && normalizeExport(loaded.moveOut)
  if (!loaded || !stored || loaded.status !== 'ready' || exportState(stored.steps) === 'done') return
  let site: SiteRow = loaded
  let out: SiteExport = { ...stored, steps: resumeExportSteps(stored.steps) }
  const save = async () => { await saveSite(site.id, { moveOut: out }) }
  /** Run one step: written down as running, then done; a step already done is skipped. */
  const step = async (id: ExportStepId, work: () => Promise<void>) => {
    if (exportStepDone(out.steps, id)) return
    out = { ...out, steps: beginExportStep(out.steps, id) }
    await save()
    await work()
    out = { ...out, steps: completeExportStep(out.steps, id) }
    await save()
  }
  await save()
  try {
    const driver = requireMovable(site)
    await step('readonly', async () => {
      if (site.hostState !== 'active' && site.hostState !== 'read-only') throw new MoveError('readonly_failed', `the site is ${site.hostState}`)
      site = await setHostState(site, 'read-only')
      // Writes that began before the site turned read-only finish first.
      await sleep(1000)
    })
    await step('backup', async () => {
      const access = await driver.access(hostedSite(site))
      const dir = join(access.dir, 'exports')
      mkdirSync(dir, { recursive: true, mode: 0o700 })
      // One archive per site: an earlier one makes room.
      for (const old of readdirSync(dir)) rmSync(join(dir, old), { recursive: true, force: true })
      const file = archiveName(site.slug)
      const archive = join(dir, file)
      await runCli(access, ['backup', archive], dir)
      await addSiteFile(archive, await siteFileOf(site, access))
      out = { ...out, file, bytes: statSync(archive).size, madeAt: new Date().toISOString() }
    })
    await step('reopen', async () => {
      if (site.hostState === 'read-only') site = await setHostState(site, 'active')
    })
    console.info(`[cloud] ${site.slug} was exported (${out.bytes} bytes)`)
  }
  catch (err: any) {
    const code = err instanceof MoveError || err instanceof HostingError ? err.code : 'unexpected'
    const detail = err instanceof MoveError || err instanceof HostingError ? err.detail : String(err?.stack ?? err?.message ?? err)
    const at = out.steps.find((s) => s.state === 'running')?.id ?? 'backup'
    out = { ...out, steps: failExportStep(out.steps, at, code) }
    await saveSite(site.id, { moveOut: out, error: `export failed at "${at}": ${detail}`.slice(0, 4000) })
    console.error(`[cloud] the export of ${site.slug} failed at "${at}" (${code}): ${detail}`)
    // Whatever failed, the site does not stay read-only.
    if (at !== 'reopen' && site.hostState === 'read-only') {
      await setHostState(site, 'active').catch((e) => console.error(`[cloud] ${site.slug} could not be reopened after a failed export: ${e?.message ?? e}`))
    }
  }
}

/** Start an export of a site (or go on with one that failed). */
export async function startExport(site: SiteRow): Promise<SiteRow> {
  requireMovable(site)
  if (site.status !== 'ready') throw fail(409, 'site.notReady', 'The website is not ready')
  if (site.hostState === 'moved') throw fail(409, 'move.moved', 'This website has already moved')
  const stored = normalizeExport(site.moveOut)
  const state = stored ? exportState(stored.steps) : null
  if (state !== 'running' && state !== 'pending') {
    // A new export, or one more try after a failure: what is done of a failed one stays done.
    const next: SiteExport = state === 'failed' && stored ? { ...stored, steps: resumeExportSteps(stored.steps) } : newExport()
    await saveSite(site.id, { moveOut: next, error: null })
  }
  continueExport(site.id)
  return (await loadSite(site.id))!
}

/** The owner says the site lives elsewhere now: every request to its address here is sent on to `input`. */
export async function markMoved(site: SiteRow, input: unknown): Promise<SiteRow> {
  requireMovable(site)
  if (site.status !== 'ready') throw fail(409, 'site.notReady', 'The website is not ready')
  if (site.hostState !== 'active') throw fail(409, site.hostState === 'moved' ? 'move.moved' : 'move.busy', 'The website cannot be marked as moved right now')
  const stored = normalizeExport(site.moveOut)
  if (!stored || exportState(stored.steps) !== 'done') throw fail(409, 'move.exportFirst', 'Download the website\'s archive first')
  const address = movedAddress(input)
  if (!address) throw fail(422, 'move.address', 'Not a website address', { field: 'url' })
  // Its own address at the service would send every visitor round in a circle.
  if (site.internalUrl && new URL(site.internalUrl).origin === address) throw fail(422, 'move.same', 'This is the website\'s address here', { field: 'url' })
  let moved: SiteRow | undefined
  const ran = await withSiteLock(site.id, async () => {
    const now = await loadSite(site.id)
    if (!now || now.status !== 'ready' || now.hostState !== 'active') return
    // Its own domains go with it (they lead to the new home now), and nobody signs in to it here any more.
    await releaseDomains(now.id)
    await revokeSiteClient(now.id)
    await saveSite(now.id, { hostState: 'moved', movedTo: address })
    const next = { ...now, hostState: 'moved' as const, movedTo: address }
    const { publicUrl: here } = await requireMovable(next).refresh(hostedSite(next))
    await saveSite(now.id, { publicUrl: here, inviteUrl: null })
    moved = { ...next, publicUrl: here, inviteUrl: null }
    console.info(`[cloud] ${now.slug} moved to ${address}`)
  })
  if (!ran || !moved) throw fail(409, 'move.busy', 'The website is busy; try again in a moment')
  return moved
}

/** A site that moved away: delete its database, its database user and its files here. Its address keeps sending visitors on. */
export async function removeMovedData(site: SiteRow): Promise<SiteRow> {
  const driver = requireMovable(site)
  if (site.hostState !== 'moved') throw fail(409, 'move.notMoved', 'Only a website that has moved can have its data deleted here')
  if (site.dataRemovedAt) return site
  let done: SiteRow | undefined
  const ran = await withSiteLock(site.id, async () => {
    const now = await loadSite(site.id)
    if (!now || now.hostState !== 'moved' || now.dataRemovedAt) { done = now ?? undefined; return }
    await driver.removeData(hostedSite(now))
    const removedAt = new Date()
    const stored = normalizeExport(now.moveOut)
    await saveSite(now.id, { dataRemovedAt: removedAt, moveOut: stored ? { ...stored, file: null, bytes: null } : null })
    done = { ...now, dataRemovedAt: removedAt }
    console.info(`[cloud] the data of ${now.slug} was deleted here; its address keeps redirecting to ${now.movedTo}`)
  })
  if (!ran || !done) throw fail(409, 'move.busy', 'The website is busy; try again in a moment')
  return done
}

// ── in ──────────────────────────────────────────────────────────────────────────

/** The largest archive that is taken in: NUXT_HOSTING_IMPORT_MAX_MB (default 2048). */
export function importMaxBytes(): number {
  const mb = Number((useRuntimeConfig().hosting as any)?.importMaxMb)
  return (Number.isFinite(mb) && mb > 0 ? mb : 2048) * 1024 * 1024
}

class TooLarge extends Error {}

/**
 * Take the request's body as an archive: streamed into a file of the cloud's own (readable by
 * its owner only, in a folder nothing is served from), never held in memory, and cut off at
 * the limit. Resolves to the file.
 */
export async function receiveArchive(event: H3Event): Promise<string> {
  const max = importMaxBytes()
  const declared = Number(getRequestHeader(event, 'content-length'))
  if (Number.isFinite(declared) && declared > max) throw fail(413, 'import.large', 'The archive is too large', { maxMb: Math.round(max / 1048576) })
  const dir = join(sharedDataDir(), '_imports')
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  const file = join(dir, `${randomUUID()}.tar`)
  let size = 0
  const limit = new Transform({
    transform(chunk: Buffer, _encoding, next) {
      size += chunk.length
      next(size > max ? new TooLarge() : null, chunk)
    },
  })
  try {
    await pipeline(event.node.req, limit, createWriteStream(file, { mode: 0o600, flags: 'wx' }))
  }
  catch (err) {
    rmSync(file, { force: true })
    if (err instanceof TooLarge) throw fail(413, 'import.large', 'The archive is too large', { maxMb: Math.round(max / 1048576) })
    throw fail(400, 'import.upload', 'The upload did not arrive whole')
  }
  if (!size) {
    rmSync(file, { force: true })
    throw fail(422, 'import.archive', 'This is not an archive of a tinyzoo website')
  }
  return file
}

/** One named file of a tar archive as text, or null (not there, not a plain file, too long). Nothing is unpacked to the disk. */
async function memberOf(archive: string, name: string, maxBytes: number): Promise<string | null> {
  try {
    return (await run('tar', ['-xOf', archive, name], { maxBuffer: maxBytes, encoding: 'utf8' })).stdout
  }
  catch {
    return null
  }
}

/** What an uploaded archive says about itself: `tinyzoo backup`'s manifest and the cloud's `site.json`. */
export async function inspectArchive(archive: string): Promise<{ site: SiteFile | null; manifest: ArchiveManifest | null }> {
  const [manifest, site] = await Promise.all([memberOf(archive, 'manifest.json', 64 * 1024 * 1024), memberOf(archive, 'site.json', 256 * 1024)])
  return { manifest: manifest ? parseArchiveManifest(manifest) : null, site: site ? parseSiteFile(site) : null }
}

/** Remove an upload (it is inside the cloud's own folder of uploads, and nowhere else). */
export function discardUpload(file: string | null | undefined): void {
  const dir = join(sharedDataDir(), '_imports')
  if (file && file.startsWith(dir + '/')) rmSync(file, { force: true })
}

/** The account the cloud keeps on every site, written into a site's own database: made when it is not there, given the cloud's password when it is. */
async function writeServiceAccount(databaseAddress: string, email: string, password: string): Promise<void> {
  const hash = await hashPassword(password)
  const client = new pg.Client({ connectionString: databaseAddress })
  await client.connect()
  try {
    await client.query(
      `insert into cms_users (email, name, role, status, password_hash) values ($1, 'tinyzoo', 'admin', 'active', $2)
       on conflict (email) do update set role = 'admin', status = 'active', password_hash = excluded.password_hash, session_version = cms_users.session_version + 1, updated_at = now()`,
      [email, hash],
    )
  }
  finally {
    await client.end().catch(() => {})
  }
}

/**
 * The `content` step of a site that came in as an archive: `tinyzoo restore` into the site's
 * new database and folder while its row is paused, then the site is served (its own app
 * applies any newer migrations), and the cloud's service account is put into it.
 * Safe to run again: the restore replaces whatever an earlier try left.
 */
export async function restoreImported(site: SiteRow): Promise<void> {
  const driver = requireMovable(site)
  const access = await driver.access(hostedSite(site))
  const upload = site.moveIn?.file
  if (upload) {
    if (!existsSync(upload)) throw new MoveError('archive_gone', `${upload} is not there any more`)
    await runCli(access, ['restore', upload, '--yes', '--force'], access.dir)
    await saveSite(site.id, { moveIn: { ...site.moveIn!, file: null } })
    discardUpload(upload)
  }
  const served = { ...site, hostState: 'active' as const }
  await saveSite(site.id, { hostState: 'active' })
  await driver.refresh(hostedSite(served))
  await writeServiceAccount(access.databaseUrl, serviceEmail(), readSecrets(site).servicePassword)
}

/** A move's failure as a step of making a site reports it: its code and its detail. */
export const moveFailure = (err: unknown): { code: string; detail: string } | null => (err instanceof MoveError ? { code: err.code, detail: err.detail } : null)
