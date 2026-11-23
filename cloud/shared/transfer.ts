// Moving a website out of shared hosting and into it (docs/multi-tenant-plan.md, 2.10).
// Pure data and functions: the steps of an export as they are written down, the small file
// that travels inside the archive, and the checks before an archive is taken in.

// ── the steps of an export ──────────────────────────────────────────────────────
//
//   readonly   the site answers reads only: nothing changes while it is copied
//   backup     `tinyzoo backup`: the database and every file in one archive
//   reopen     the site is served as before
//
// Written down before and after, like the steps of making a site (shared/steps.ts): a failure
// says where it was, and asking again goes on from there.

export const EXPORT_STEP_IDS = ['readonly', 'backup', 'reopen'] as const
export type ExportStepId = typeof EXPORT_STEP_IDS[number]
export type TransferStepState = 'pending' | 'running' | 'done' | 'failed'

export interface ExportStep {
  id: ExportStepId
  state: TransferStepState
  startedAt: string | null
  finishedAt: string | null
  /** Why it failed: a code the pages put into words (`move.fail.<code>`). */
  message: string | null
}

/** What the cloud keeps about a site's export (sites.move_out). */
export interface SiteExport {
  steps: ExportStep[]
  requestedAt: string
  /** The archive's name inside the site's `exports` folder; never a path. */
  file: string | null
  bytes: number | null
  /** When the archive was finished. */
  madeAt: string | null
}

const iso = (now: Date | string) => (typeof now === 'string' ? now : now.toISOString())
const blank = (id: ExportStepId): ExportStep => ({ id, state: 'pending', startedAt: null, finishedAt: null, message: null })
const patch = (steps: ExportStep[], id: ExportStepId, change: Partial<ExportStep>): ExportStep[] => steps.map((s) => (s.id === id ? { ...s, ...change } : s))
const STATES: ReadonlySet<string> = new Set(['pending', 'running', 'done', 'failed'])

export function newExport(now: Date | string = new Date()): SiteExport {
  return { steps: EXPORT_STEP_IDS.map(blank), requestedAt: iso(now), file: null, bytes: null, madeAt: null }
}

/** An export as stored, made whole (or null for something that is not one). */
export function normalizeExport(raw: unknown): SiteExport | null {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as any).steps)) return null
  const r = raw as Partial<SiteExport>
  const steps = EXPORT_STEP_IDS.map((id) => {
    const s = (r.steps as any[]).find((x) => x && x.id === id) as Partial<ExportStep> | undefined
    if (!s) return blank(id)
    return {
      id, state: STATES.has(String(s.state)) ? s.state as TransferStepState : 'pending',
      startedAt: typeof s.startedAt === 'string' ? s.startedAt : null,
      finishedAt: typeof s.finishedAt === 'string' ? s.finishedAt : null,
      message: typeof s.message === 'string' ? s.message : null,
    }
  })
  return {
    steps,
    requestedAt: typeof r.requestedAt === 'string' ? r.requestedAt : '',
    file: typeof r.file === 'string' && isArchiveName(r.file) ? r.file : null,
    bytes: typeof r.bytes === 'number' && Number.isFinite(r.bytes) ? r.bytes : null,
    madeAt: typeof r.madeAt === 'string' ? r.madeAt : null,
  }
}

export const beginExportStep = (steps: ExportStep[], id: ExportStepId, now: Date | string = new Date()): ExportStep[] =>
  patch(steps, id, { state: 'running', startedAt: iso(now), finishedAt: null, message: null })
export const completeExportStep = (steps: ExportStep[], id: ExportStepId, now: Date | string = new Date()): ExportStep[] =>
  patch(steps, id, { state: 'done', finishedAt: iso(now), message: null })
export const failExportStep = (steps: ExportStep[], id: ExportStepId, message: string, now: Date | string = new Date()): ExportStep[] =>
  patch(steps, id, { state: 'failed', finishedAt: iso(now), message })

/** Ready to go on after a failure or a restart: what is done stays done, the rest waits again. */
export const resumeExportSteps = (steps: ExportStep[]): ExportStep[] =>
  steps.map((s) => (s.state === 'done' ? s : { ...s, state: 'pending', finishedAt: null, message: null }))

/** The whole export in one word. */
export function exportState(steps: ExportStep[]): TransferStepState {
  if (steps.every((s) => s.state === 'done')) return 'done'
  if (steps.some((s) => s.state === 'failed')) return 'failed'
  return steps.some((s) => s.state !== 'pending') ? 'running' : 'pending'
}

export const exportStepDone = (steps: ExportStep[], id: ExportStepId): boolean => steps.find((s) => s.id === id)?.state === 'done'

/** An export as its owner's browser gets it: no path, the archive only by its link. */
export interface ExportView {
  state: TransferStepState
  steps: Pick<ExportStep, 'id' | 'state' | 'message'>[]
  /** The archive is there to download. */
  ready: boolean
  bytes: number | null
  madeAt: string | null
}

export function toExportView(stored: SiteExport | null, archiveThere: boolean): ExportView | null {
  if (!stored) return null
  return {
    state: exportState(stored.steps),
    steps: stored.steps.map(({ id, state, message }) => ({ id, state, message })),
    ready: archiveThere && !!stored.file && exportStepDone(stored.steps, 'backup'),
    bytes: stored.bytes,
    madeAt: stored.madeAt,
  }
}

// ── the archive ─────────────────────────────────────────────────────────────────

/** The archive's name: `tinyzoo-<address>-<time>.tar`, nothing that could be a path. */
export function archiveName(slug: string, now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/\.\d+Z$/, '').replace(/[-:]/g, '').replace('T', '-')
  return `tinyzoo-${slug}-${stamp}.tar`
}
export const isArchiveName = (name: string): boolean => /^tinyzoo-[a-z0-9]+(?:-[a-z0-9]+)*-\d{8}-\d{6}\.tar$/.test(name)

/**
 * `site.json`, inside the archive beside `tinyzoo backup`'s own files: what the new home needs
 * besides the data. The site's secret and status token are here in plain text, as the
 * database dump holds the password hashes: the archive is as private as the database.
 */
export interface SiteFile {
  format: 'tinyzoo-site'
  version: 1
  exportedAt: string
  name: string
  /** The template the site was made from (shared/templates.ts) and its look. */
  template: string
  look: string | null
  /** The tinyzoo the site ran on: the new home must run this one or a newer one. */
  tinyzooVersion: string
  /** The site's address, then every other name it answered at (its other domains, its address at the service). */
  publicUrl: string
  hosts: string[]
  /** The site's own secret (its sessions were bound to it): NUXT_APP_SECRET of a server of its own. */
  secret: string
  /** NUXT_CMS_STATUS_TOKEN: the token monitoring tools ask its status with. */
  statusToken: string
  /**
   * The site's client at the account service. Its secret is not here: at the new home the
   * site is connected again ("Connect a website you already run") and gets a new one.
   */
  account: { issuer: string; clientId: string } | null
  plan: string
}

const text = (v: unknown, max = 500): string | null => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null)

/** `site.json` as read from an archive, or null when it is not one. */
export function parseSiteFile(raw: string): SiteFile | null {
  let v: any
  try { v = JSON.parse(raw) }
  catch { return null }
  if (!v || v.format !== 'tinyzoo-site' || v.version !== 1) return null
  const template = text(v.template, 40)
  const secret = text(v.secret, 500)
  const publicUrl = text(v.publicUrl)
  if (!template || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(template) || !secret || secret.length < 32 || !publicUrl) return null
  const account = v.account && text(v.account.issuer) && text(v.account.clientId, 80) ? { issuer: v.account.issuer as string, clientId: v.account.clientId as string } : null
  return {
    format: 'tinyzoo-site', version: 1,
    exportedAt: text(v.exportedAt, 40) ?? '',
    name: text(v.name, 80) ?? '',
    template,
    look: text(v.look, 40),
    tinyzooVersion: text(v.tinyzooVersion, 40) ?? '',
    publicUrl,
    hosts: Array.isArray(v.hosts) ? v.hosts.filter((h: unknown) => typeof h === 'string' && h.length <= 253).slice(0, 20) : [],
    secret,
    statusToken: text(v.statusToken) ?? '',
    account,
    plan: text(v.plan, 40) ?? '',
  }
}

/** The part of `manifest.json` (`tinyzoo backup`) the cloud looks at before it takes an archive in. */
export interface ArchiveManifest { tinyzooVersion: string; createdAt: string; media: number }

export function parseArchiveManifest(raw: string): ArchiveManifest | null {
  let v: any
  try { v = JSON.parse(raw) }
  catch { return null }
  if (!v || v.format !== 'tinyzoo-backup' || v.version !== 1 || typeof v.tinyzooVersion !== 'string') return null
  return { tinyzooVersion: v.tinyzooVersion.slice(0, 40), createdAt: typeof v.createdAt === 'string' ? v.createdAt.slice(0, 40) : '', media: Array.isArray(v.media) ? v.media.length : 0 }
}

/**
 * Compare two versions by their numbers (`1.11.0` against `1.9.3`): negative, zero or
 * positive. What follows a `-` (a pre-release) is not looked at; a text with no number in it
 * counts as 0.
 */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => String(v).split('-')[0]!.split('.').map((n) => Number.parseInt(n, 10) || 0)
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d) return d
  }
  return 0
}

/** Why an archive is not taken in (the dictionary's `error.import.<code>`), or null when it may be. */
export function importProblem(input: { site: SiteFile | null; manifest: ArchiveManifest | null; templateReady: boolean; buildVersion: string }): 'archive' | 'template' | 'newer' | null {
  if (!input.site || !input.manifest) return 'archive'
  if (!input.templateReady) return 'template'
  // The site's own database is migrated forwards by the new home, never backwards.
  if (compareVersions(input.manifest.tinyzooVersion, input.buildVersion) > 0) return 'newer'
  return null
}

/** What the cloud keeps about a site that came in as an archive (sites.move_in). */
export interface SiteImport {
  /** The uploaded archive (an absolute path in the cloud's own folder); null once it was restored and removed. */
  file: string | null
  /** Where it came from: its address and name there, and the tinyzoo it ran on. */
  from: { publicUrl: string; name: string; tinyzooVersion: string; exportedAt: string }
}
