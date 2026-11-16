/**
 * `tinyzoo content:migrate` — rewrite stored JSON (blocks, lists, rich text) to the
 * current versions.
 *
 * Nothing has to be run on deploy: older blocks are upgraded whenever they are read
 * (content API, admin, search, revisions). This rewrites the stored copies, so the
 * `upgrade` functions can be retired and the database matches the code. It walks every
 * entity's blocks and list columns (the entries, their translations) and the saved
 * versions in `cms_revisions`, in batches inside transactions, and reports what it
 * changed and what it could not upgrade (those blocks stay as they are).
 *
 *   tinyzoo content:migrate [--dry-run] [--batch <n>]
 *
 * Connects with DATABASE_URL (or NUXT_CMS_DATABASE_URL). Run from the host app root.
 * Entries' `updatedAt` is not touched: this is not an edit.
 */
import { and, asc, eq, gt, or, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { buildRegistry, propOf, upgradeStoredRow, type CmsEntity, type CmsRegistry, type UpgradeIssue } from '../src/index'

export type MigrateSource = 'entries' | 'translations' | 'revisions'

export interface MigrateFieldReport {
  entity: string
  field: string
  source: MigrateSource
  /** Rows that hold this field with a value. */
  scanned: number
  /** Rows that were (or, in a dry run, would be) rewritten. */
  upgraded: number
  /** Blocks and list items brought to a newer version inside those rows. */
  blocks: number
}

export interface MigrateFailure {
  entity: string
  source: MigrateSource
  recordId: string
  locale: string | null
  field: string
  /** Where inside the field: `[1, 'items', 0]`. */
  path: (string | number)[]
  type: string
  blockId: string | null
  from: number
  to: number
  message: string
}

export interface MigrateReport {
  dryRun: boolean
  fields: MigrateFieldReport[]
  failures: MigrateFailure[]
  rowsScanned: number
  rowsUpgraded: number
  /** Revisions of an entity the config no longer has (left alone). */
  skippedRevisions: number
}

export interface MigrateOptions {
  dryRun?: boolean
  batchSize?: number
  log?: (line: string) => void
}

/** The fields of an entity that hold versioned JSON. */
const jsonFields = (fields: CmsEntity['fields'], only?: readonly string[]) =>
  Object.fromEntries(Object.entries(fields).filter(([k, f]) => (!only || only.includes(k)) && (((f as any).type === 'blocks' && (f as any).blocks) || (f as any).type === 'richtext'))) as CmsEntity['fields']

/**
 * Walk everything and bring stored JSON to the current versions. `db` is a drizzle
 * node-postgres database; every table is reached through the registry.
 */
export async function migrateContent(db: any, reg: CmsRegistry, opts: MigrateOptions = {}): Promise<MigrateReport> {
  const dryRun = !!opts.dryRun
  const batch = Math.max(1, opts.batchSize ?? 200)
  const report: MigrateReport = { dryRun, fields: [], failures: [], rowsScanned: 0, rowsUpgraded: 0, skippedRevisions: 0 }
  const counters = new Map<string, MigrateFieldReport>()
  const counter = (entity: string, field: string, source: MigrateSource) => {
    const key = `${entity}\u0000${source}\u0000${field}`
    let c = counters.get(key)
    if (!c) counters.set(key, c = { entity, field, source, scanned: 0, upgraded: 0, blocks: 0 })
    return c
  }

  /**
   * Upgrade the JSON fields of one row's values. Returns the changed values by field
   * key (empty when nothing changed). Failures are collected, those blocks left as stored.
   */
  function upgradeValues(e: CmsEntity, source: MigrateSource, recordId: string, locale: string | null, fields: CmsEntity['fields'], values: Record<string, any>): Record<string, any> {
    const changed: Record<string, any> = {}
    for (const key of Object.keys(fields)) {
      if (values[key] == null) continue
      const c = counter(e.name, key, source)
      c.scanned++
      const row: Record<string, any> = { [key]: values[key] }
      let blocks = 0
      upgradeStoredRow({ [key]: fields[key] } as any, row, {
        onUpgrade: () => { blocks++ },
        onError: (issue: UpgradeIssue) => report.failures.push({
          entity: e.name, source, recordId, locale, field: key, path: issue.path.slice(1), type: issue.type, blockId: issue.id,
          from: issue.from, to: issue.to, message: (issue.error as Error)?.message ?? String(issue.error),
        }),
      })
      // Rich-text steps clone the document even when nothing changes: compare the content.
      if (row[key] !== values[key] && JSON.stringify(row[key]) !== JSON.stringify(values[key])) {
        changed[key] = row[key]
        c.upgraded++
        c.blocks += blocks
      }
    }
    return changed
  }

  // ── entries and their translations ──
  for (const e of reg.entities) {
    const main = jsonFields(e.fields)
    if (Object.keys(main).length) {
      let after: string | null = null
      for (;;) {
        const done = await db.transaction(async (tx: any) => {
          const rows: any[] = await tx.select().from(e.table).where(after ? gt(e.table.id, after) : undefined).orderBy(asc(e.table.id)).limit(batch).for('update')
          for (const row of rows) {
            report.rowsScanned++
            const changed = upgradeValues(e, 'entries', row.id, null, main, row)
            if (!Object.keys(changed).length) continue
            report.rowsUpgraded++
            if (!dryRun) await tx.update(e.table).set(Object.fromEntries(Object.entries(changed).map(([k, v]) => [propOf(k, e.fields[k]!), v]))).where(eq(e.table.id, row.id))
          }
          after = rows.length ? rows[rows.length - 1].id : after
          return rows.length < batch
        })
        if (done) break
      }
    }

    const t = e.localesTable
    const translated = t && e.localized.length ? jsonFields(e.fields, e.localized) : {}
    if (t && Object.keys(translated).length) {
      type Cursor = { parentId: string; locale: string }
      let last = null as Cursor | null
      for (;;) {
        const cursor = last as Cursor | null
        const done = await db.transaction(async (tx: any) => {
          const where = cursor ? or(gt(t.parentId, cursor.parentId), and(eq(t.parentId, cursor.parentId), gt(t.locale, cursor.locale))) : undefined
          const rows: any[] = await tx.select().from(t).where(where).orderBy(asc(t.parentId), asc(t.locale)).limit(batch).for('update')
          for (const row of rows) {
            report.rowsScanned++
            const changed = upgradeValues(e, 'translations', row.parentId, row.locale, translated, row)
            if (!Object.keys(changed).length) continue
            report.rowsUpgraded++
            if (!dryRun) await tx.update(t).set(changed).where(and(eq(t.parentId, row.parentId), eq(t.locale, row.locale)))
          }
          if (rows.length) last = { parentId: rows[rows.length - 1].parentId, locale: rows[rows.length - 1].locale }
          return rows.length < batch
        })
        if (done) break
      }
    }
  }

  // ── saved versions ──
  const rev = reg.cmsRevisions
  let afterRev: string | null = null
  for (;;) {
    const done = await db.transaction(async (tx: any) => {
      const rows: any[] = await tx.select({ id: rev.id, entity: rev.entity, recordId: rev.recordId, locale: rev.locale, data: rev.data })
        .from(rev).where(afterRev ? gt(rev.id, afterRev) : undefined).orderBy(asc(rev.id)).limit(batch).for('update')
      for (const row of rows) {
        const e = reg.byName.get(row.entity)
        if (!e || !row.data || typeof row.data !== 'object') {
          if (!e) report.skippedRevisions++
          continue
        }
        const fields = jsonFields(e.fields, row.locale ? e.localized : undefined)
        if (!Object.keys(fields).length) continue
        report.rowsScanned++
        const changed = upgradeValues(e, 'revisions', row.recordId, row.locale, fields, row.data)
        if (!Object.keys(changed).length) continue
        report.rowsUpgraded++
        if (!dryRun) await tx.update(rev).set({ data: sql`${JSON.stringify({ ...row.data, ...changed })}::jsonb` }).where(eq(rev.id, row.id))
      }
      afterRev = rows.length ? rows[rows.length - 1].id : afterRev
      return rows.length < batch
    })
    if (done) break
  }

  report.fields = [...counters.values()].filter((c) => c.scanned > 0)
  return report
}

const where = (f: MigrateFailure) => `${f.entity} ${f.recordId}${f.locale ? ` [${f.locale}]` : ''} · ${[f.field, ...f.path].join('.')}`

/** The report as the lines the command prints. */
export function formatReport(r: MigrateReport): string[] {
  const lines: string[] = []
  const rows = r.fields.filter((f) => f.upgraded > 0)
  if (!rows.length && !r.failures.length) lines.push('Everything is already at the current versions.')
  for (const f of rows) {
    lines.push(`${`${f.entity}.${f.field}`.padEnd(34)} ${f.source.padEnd(12)} ${String(f.upgraded).padStart(5)} of ${String(f.scanned).padStart(5)} ${r.dryRun ? 'would be rewritten' : 'rewritten'}${f.blocks ? `  (${f.blocks} block${f.blocks === 1 ? '' : 's'} upgraded)` : ''}`)
  }
  if (r.failures.length) {
    lines.push('', `Could not upgrade ${r.failures.length} block${r.failures.length === 1 ? '' : 's'} (left as stored):`)
    for (const f of r.failures) lines.push(`  ${where(f)} — "${f.type}"${f.blockId ? ` ${f.blockId}` : ''} v${f.from} → v${f.to}: ${f.message}`)
  }
  if (r.skippedRevisions) lines.push('', `${r.skippedRevisions} saved version${r.skippedRevisions === 1 ? '' : 's'} of entities that are no longer in the config were left alone.`)
  lines.push('', `${r.rowsScanned} rows read, ${r.rowsUpgraded} ${r.dryRun ? 'would be rewritten (dry run: nothing was written)' : 'rewritten'}.`)
  return lines
}

/** The command: connect, migrate, print. Exits 1 when something could not be upgraded. */
export async function contentMigrateCommand(config: Record<string, any>, args: string[]): Promise<void> {
  const dryRun = args.includes('--dry-run')
  const bi = args.indexOf('--batch')
  const batchSize = bi >= 0 ? Number(args[bi + 1]) : undefined
  if (bi >= 0 && !(Number.isInteger(batchSize) && batchSize! > 0)) {
    console.error('usage: tinyzoo content:migrate [--dry-run] [--batch <n>]')
    process.exit(1)
  }
  const url = process.env.DATABASE_URL || process.env.NUXT_CMS_DATABASE_URL
  if (!url) {
    console.error('✗ DATABASE_URL is not set')
    process.exit(1)
  }
  const reg = buildRegistry(config)
  const pool = new pg.Pool({ connectionString: url, max: 2 })
  try {
    const report = await migrateContent(drizzle(pool, { schema: reg.schema }), reg, { dryRun, batchSize })
    for (const line of formatReport(report)) console.log(line)
    if (report.failures.length) process.exitCode = 1
  }
  finally {
    await pool.end()
  }
}
