/**
 * `tinyzoo import <file>` — put an archive made by `tinyzoo export` into this site.
 *
 *   tinyzoo import site.tar.gz                    # the target must be empty of content
 *   tinyzoo import site.tar.gz --replace          # delete this site's content first (asks; --yes skips)
 *   tinyzoo import site.tar.gz --merge            # add and update entries by id, delete nothing
 *   tinyzoo import site.tar.gz --allow-mismatch   # the content models differ: skip what doesn't fit
 *   tinyzoo import site.tar.gz --dry-run          # check and report, write nothing
 *
 * Ids are kept, so links between entries and references from pages survive. Order of
 * work: media files → media rows → entries in dependency order (a post after its
 * author; a link that cannot be satisfied in any order — a page's parent — is left
 * empty first and filled in afterwards) → translations → many-to-many links → saved
 * versions. All database changes happen in ONE transaction: a failure leaves the
 * database as it was. Media files are uploaded before it (checked against their
 * hashes); a failed import can leave files in storage that nothing points to, which
 * is harmless. The search index is rebuilt afterwards.
 *
 * `--replace` deletes the content the archive carries. Of the media library it deletes
 * ALL of it for a full archive (the archive brings the whole library back), but for an
 * `--only` archive just the media rows the archive lists that no other content uses
 * (links and pictures inside rich text and blocks are checked, as the server's own
 * clean-up does): the rest of the library — a site logo, pictures of pages that are not
 * in the archive — is never touched. The question asked first says exactly this.
 *
 * Blocks stored at a version newer than this site's definition are refused (the
 * content model section of the report), like any other difference in the model.
 */
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { getTableColumns, getTableName, inArray, ne, sql } from 'drizzle-orm'
import type { CmsEntity, CmsRegistry } from '../src/index'
import { logUpgradeFailure, upgradeStoredRow } from '../src/blocks'
import { extractTarGz, safeArchivePath } from './tar'
import { loadRegistry } from './export'
import {
  ARCHIVE_FILES, ARCHIVE_FORMAT, BATCH, SAFE_NAME, connectDb, databaseName, dependencyOrder, describeDatabase,
  describeSchema, diffSchemas, formatDifferences, hostSettings, layoutOf, newerStoredBlocks, parseArgs, readJsonl, storageFingerprint, storageFromSettings,
  usedMediaIds,
  type Difference, type Entry, type EntityLayout, type FkEdge, type LayoutField, type Manifest, type TransferStorage,
} from './transfer'

export type ImportMode = 'strict' | 'replace' | 'merge'

export interface ImportOptions {
  reg: CmsRegistry
  databaseUrl: string
  /** Where media files are written, and what their public addresses are. */
  storage: TransferStorage
  file: string
  /** `strict` (default): the target must be empty. */
  mode?: ImportMode
  allowMismatch?: boolean
  /** Asked before `replace` deletes anything; return false to stop. Omit to go ahead. */
  confirm?: (summary: string) => Promise<boolean>
  /** Check everything and report; write nothing. */
  dryRun?: boolean
  /** Rebuild the search index afterwards (default true). */
  searchIndex?: boolean
  log?: (message: string) => void
}

export interface ImportReport {
  mode: ImportMode
  dryRun: boolean
  entries: Record<string, { rows: number; translations: number }>
  media: { rows: number; files: number; missingFiles: number }
  relations: number
  revisions: number
  deleted: Record<string, number>
  skipped: { entities: string[]; fields: string[]; translations: number }
  differences: Difference[]
  searchIndex: 'rebuilt' | 'busy' | 'failed' | 'skipped'
  /** Things the person should read even though the import went ahead. */
  warnings: string[]
}

export class ImportRefused extends Error {
  constructor(public code: 'not-empty' | 'mismatch' | 'format' | 'aborted' | 'invalid', message: string, public differences: Difference[] = []) {
    super(message)
    this.name = 'ImportRefused'
  }
}

const invalid = (message: string) => new ImportRefused('invalid', message)

// ── the archive ─────────────────────────────────────────────────────────────────

async function readManifest(dir: string): Promise<Manifest> {
  const path = join(dir, ARCHIVE_FILES.manifest)
  if (!existsSync(path)) throw invalid('This is not a tinyzoo content archive (there is no manifest.json in it).')
  let m: Manifest
  try { m = JSON.parse(await readFile(path, 'utf8')) }
  catch { throw invalid('manifest.json is not valid JSON — is the archive damaged?') }
  if (typeof m.format !== 'number') throw invalid('manifest.json has no format number.')
  if (m.format > ARCHIVE_FORMAT) {
    throw new ImportRefused('format', `This archive is format ${m.format} (made by tinyzoo ${m.tinyzoo}); this tinyzoo reads format ${ARCHIVE_FORMAT}. Upgrade tinyzoo, then import again.`)
  }
  // Archive upgrade hook: a format older than ARCHIVE_FORMAT would be brought up to it
  // here (rewriting `m` and the files in `dir`) before anything is read. There is only
  // format 1 so far.
  if (m.format < 1) throw invalid(`Unknown archive format ${m.format}.`)
  if (!m.schema?.entities || !Array.isArray(m.entities)) throw invalid('manifest.json is incomplete.')
  for (const x of m.entities) if (!SAFE_NAME.test(x.name)) throw invalid(`The archive names content "${x.name}", which is not a valid name.`)
  return m
}

// ── decoding ────────────────────────────────────────────────────────────────────

const JSON_TYPES = new Set(['richtext', 'blocks', 'group'])

/** Point every embedded picture at the file's address in THIS storage. */
function rewriteImages(node: any, urls: Map<string, string>): void {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) { for (const x of node) rewriteImages(x, urls); return }
  if (node.type === 'image' && node.attrs && typeof node.attrs.mediaId === 'string') {
    const url = urls.get(node.attrs.mediaId)
    if (url) node.attrs.src = url
  }
  for (const v of Object.values(node)) if (v && typeof v === 'object') rewriteImages(v, urls)
}

interface Plan {
  reg: CmsRegistry
  manifest: Manifest
  urls: Map<string, string>
  skipFields: Map<string, Set<string>>
  skippedFields: Set<string>
  locales: Set<string> | null
  deferred: Map<string, FkEdge[]>
}

function decodeValue(plan: Plan, e: CmsEntity, f: LayoutField, raw: unknown, id: string): unknown {
  if (raw === null || raw === undefined) return null
  if (f.isDate) {
    const d = new Date(raw as string)
    if (Number.isNaN(d.getTime())) throw invalid(`${e.name} ${id}: "${f.key}" is not a valid date (${JSON.stringify(raw)}).`)
    return d
  }
  const base = f.fld.spec?.base
  if (base?.kind === 'enum' && !base.values.includes(raw as string)) {
    throw invalid(`${e.name} ${id}: "${f.key}" is "${String(raw)}", which is not one of ${base.values.join(', ')} here. Fix the choices or the entry, then import again.`)
  }
  if (JSON_TYPES.has(f.fld.type)) {
    // An archive from an older site may hold blocks, list items or rich text at older
    // versions: bring them to the current ones (as every read does), so what is
    // written is what this site's code expects. A block whose upgrade throws is
    // logged and imported as it was; the admin shows it as needing attention.
    const where = `${e.name} ${id}`
    // Blocks written by a NEWER version of the site cannot be read or saved here.
    if (f.fld.type === 'blocks' && f.fld.blocks) {
      const newer = newerStoredBlocks(raw, f.fld.blocks, [f.key])
      if (newer.length) {
        throw new ImportRefused('mismatch', `${where}: ${newer.slice(0, 3).join('; ')}${newer.length > 3 ? `; and ${newer.length - 3} more` : ''}. The archive comes from a newer version of the content model: update this site first.`)
      }
    }
    raw = upgradeStoredRow({ [f.key]: f.fld }, { [f.key]: raw }, { where, onError: (issue) => logUpgradeFailure(issue, where) })[f.key]
    rewriteImages(raw, plan.urls)
  }
  return raw
}

function decodeEntry(plan: Plan, layout: EntityLayout, entry: Entry) {
  const e = layout.e
  const skip = plan.skipFields.get(e.name)
  const deferredProps = new Set((plan.deferred.get(e.name) ?? []).map((x) => x.prop))
  const row: Record<string, unknown> = { id: entry.id, createdAt: new Date(entry.createdAt), updatedAt: new Date(entry.updatedAt) }
  const fixups: { prop: string; id: string; value: string }[] = []
  for (const [key, raw] of Object.entries(entry.fields ?? {})) {
    const f = layout.byKey.get(key)
    if (!f || skip?.has(key)) { plan.skippedFields.add(`${e.name}.${key}`); continue }
    const value = decodeValue(plan, e, f, raw, entry.id)
    if (deferredProps.has(f.prop) && value != null) { fixups.push({ prop: f.prop, id: entry.id, value: value as string }); row[f.prop] = null }
    else row[f.prop] = value
  }
  const translations: Record<string, unknown>[] = []
  let skippedTranslations = 0
  for (const tr of entry.translations ?? []) {
    if (!e.localesTable || (plan.locales && !plan.locales.has(tr.locale))) { skippedTranslations++; continue }
    const t: Record<string, unknown> = { id: tr.id, parentId: entry.id, locale: tr.locale, createdAt: new Date(tr.createdAt), updatedAt: new Date(tr.updatedAt) }
    for (const key of e.localized) {
      const f = layout.byKey.get(key)
      if (f && key in tr.fields && !skip?.has(key)) t[key] = decodeValue(plan, e, f, tr.fields[key], tr.id)
    }
    translations.push(t)
  }
  return { row, fixups, translations, skippedTranslations }
}

// ── writing ─────────────────────────────────────────────────────────────────────

type Write = 'insert' | 'upsert' | 'ignore'

/** Insert `rows` in batches that stay under Postgres' parameter limit. */
async function writeRows(tx: any, table: any, rows: Record<string, unknown>[], how: Write, target?: any[]): Promise<void> {
  if (!rows.length) return
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  const size = Math.max(1, Math.min(BATCH, Math.floor(30_000 / keys.length)))
  const cols = getTableColumns(table) as Record<string, any>
  const targetNames = new Set((target ?? [table.id]).map((c) => c.name))
  for (let i = 0; i < rows.length; i += size) {
    const q = tx.insert(table).values(rows.slice(i, i + size))
    if (how === 'insert') await q
    else if (how === 'ignore') await q.onConflictDoNothing()
    else {
      const set = Object.fromEntries(keys.filter((k) => cols[k] && !targetNames.has(cols[k].name)).map((k) => [k, sql`excluded.${sql.identifier(cols[k].name)}`]))
      await (Object.keys(set).length ? q.onConflictDoUpdate({ target: target ?? [table.id], set }) : q.onConflictDoNothing())
    }
  }
}

function explain(err: any, doing: string): Error {
  if (err instanceof ImportRefused) return err
  const code = err?.code ?? err?.cause?.code
  const detail = err?.detail ?? err?.cause?.detail ?? ''
  const message = err?.cause?.message ?? err?.message ?? String(err)
  if (code === '42P01') return invalid(`The database has no table for this content (${message}). Run the migrations first (tinyzoo up).`)
  if (code === '23503') return invalid(`${doing}: it points at something that is not there — ${detail || message}. An archive made with --only needs the rest of the content in the target already (use --merge), or export everything.`)
  if (code === '23502') return invalid(`${doing}: a required value is missing — ${message}. Was the archive exported from a different version of the content model?`)
  if (code === '23505') return invalid(`${doing}: ${detail || message}. Something with the same unique value is already there (use --merge to update it by id, or --replace).`)
  return new Error(`${doing}: ${message}`)
}

async function countRows(db: any, table: any): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(table)
  return Number(row?.n ?? 0)
}

/** The archive file holding an entity's entries, or null when it has none. The name comes from the entity, never from the manifest. */
function entryFile(dir: string, e: CmsEntity): string | null {
  const path = join(dir, e.singleton ? ARCHIVE_FILES.global(e.name) : ARCHIVE_FILES.content(e.name))
  return existsSync(path) ? path : null
}

function entriesOf(e: CmsEntity, path: string): AsyncIterable<Entry> {
  return e.singleton
    ? (async function* () { yield JSON.parse(await readFile(path, 'utf8')).entry as Entry })()
    : readJsonl<Entry>(path)
}

// ── the import ──────────────────────────────────────────────────────────────────

export async function importContent(opts: ImportOptions): Promise<ImportReport> {
  const { reg, storage } = opts
  const mode = opts.mode ?? 'strict'
  const log = opts.log ?? (() => {})
  const file = resolve(opts.file)
  if (!existsSync(file)) throw new Error(`${file} does not exist`)

  const tmp = await mkdtemp(join(tmpdir(), 'tinyzoo-import-'))
  const { db, close } = connectDb(opts.databaseUrl, reg)
  try {
    try { await extractTarGz(file, tmp) }
    catch (err: any) { throw invalid(`Could not read the archive: ${err?.message ?? err}`) }
    const manifest = await readManifest(tmp)

    // ── is the archive for this site? ─────────────────────────────────────────
    const archiveNames = new Set(manifest.entities.map((x) => x.name))
    const all = diffSchemas(manifest.schema, describeSchema(reg))
    // Only what the archive carries matters (an --only archive says nothing of the rest).
    const differences: Difference[] = all.filter((d) => !d.entity || archiveNames.has(d.entity))
    const locales = reg.locales ? new Set(reg.locales.locales) : null
    if (manifest.locales && reg.locales) {
      if (manifest.locales.default !== reg.locales.default) {
        throw new ImportRefused('mismatch', `The default language differs: the archive's entries are written in "${manifest.locales.default}", this site's default is "${reg.locales.default}". The entries cannot be mapped, even with --allow-mismatch.`)
      }
      for (const l of manifest.locales.all) if (!locales!.has(l)) differences.push({ scope: 'locales', message: `language "${l}" is in the archive but not configured here (its translations are left out)`, skip: true })
      for (const l of locales!) if (!manifest.locales.all.includes(l)) differences.push({ scope: 'locales', message: `language "${l}" is configured here but not in the archive (nothing to import for it)`, skip: false })
    }
    if (differences.length && !opts.allowMismatch) {
      throw new ImportRefused('mismatch',
        `The archive was exported from a different content model (tinyzoo ${manifest.tinyzoo}, fingerprint ${manifest.fingerprint.slice(0, 12)}):\n${formatDifferences(differences)}\n`
        + 'Bring the content models in line (same version of the site), or import with --allow-mismatch to skip what does not fit.',
        differences)
    }
    const skipEntities = new Set(differences.filter((d) => d.scope === 'entity' && d.skip).map((d) => d.entity!))
    const skipFields = new Map<string, Set<string>>()
    for (const d of differences) if ((d.scope === 'field' || d.scope === 'blocks') && d.skip) skipFields.set(d.entity!, (skipFields.get(d.entity!) ?? new Set()).add(d.field!))

    const planned = manifest.entities.filter((x) => !skipEntities.has(x.name) && reg.byName.has(x.name))
    const included = planned.map((x) => reg.byName.get(x.name)!)
    const { order, deferred } = dependencyOrder(reg, included)
    const mediaFile = join(tmp, ARCHIVE_FILES.media)
    const mediaEntries: Record<string, any>[] = []
    if (existsSync(mediaFile)) for await (const m of readJsonl<Record<string, any>>(mediaFile)) mediaEntries.push(m)
    // A full archive owns the whole media library. An --only archive owns just the files
    // it lists: the rest of the library belongs to content that is not in the archive.
    const fullMedia = manifest.only === null
    const listedMedia = !fullMedia && mediaEntries.length > 0

    const report: ImportReport = {
      mode, dryRun: !!opts.dryRun, entries: {}, media: { rows: 0, files: 0, missingFiles: 0 }, relations: 0, revisions: 0, deleted: {},
      skipped: { entities: [...skipEntities].sort(), fields: [], translations: 0 }, differences, searchIndex: 'skipped', warnings: [],
    }

    // The files may be the very ones another environment serves: say so.
    if (manifest.media.storage && manifest.media.storage === storageFingerprint(storage.identity)) {
      const warning = `The archive's files come from the SAME storage this site writes to (${storage.describe}). Two environments must not share a bucket or folder: deleting a file in one deletes it in the other. Give each environment its own (or its own prefix) and import with the files, or only use --no-media if the target really has its own copy of every file.`
      report.warnings.push(warning)
      log(`\n  !! ${warning}\n`)
    }

    // ── what is in the target ─────────────────────────────────────────────────
    const present: Record<string, number> = {}
    const replacedTables = new Set(order.flatMap((e) => [getTableName(e.table), ...(e.localesTable ? [getTableName(e.localesTable)] : [])]))
    let existingListed: { id: string; key: string }[] = []
    let freeToDelete: string[] = []
    try {
      for (const e of order) present[e.name] = await countRows(db, e.table)
      if (fullMedia) present.media = await countRows(db, reg.cmsMedia)
      else if (listedMedia) {
        const ids = mediaEntries.map((m) => m.id as string)
        for (let at = 0; at < ids.length; at += 1000) {
          existingListed.push(...(await db.select({ id: reg.cmsMedia.id, key: reg.cmsMedia.key }).from(reg.cmsMedia).where(inArray(reg.cmsMedia.id, ids.slice(at, at + 1000)))))
        }
        present.media = existingListed.length
        // With --replace: of those, the ones nothing outside the replaced content uses.
        if (mode === 'replace') {
          const used = await usedMediaIds(db, reg, existingListed, replacedTables)
          freeToDelete = existingListed.filter((m) => !used.has(m.id)).map((m) => m.id)
        }
      }
    }
    catch (err) { throw explain(err, 'Could not read the target') }
    const occupied = Object.entries(present).filter(([, n]) => n > 0)
    const label = (list: [string, number][]) => list.map(([k, n]) => `${k} (${n})`).join(', ')

    if (mode === 'strict' && occupied.length) {
      throw new ImportRefused('not-empty',
        `The target is not empty: ${label(occupied)}.\n`
        + 'Import into an empty database, or use --replace (deletes that content first) or --merge (adds and updates entries by id).')
    }
    // What --replace deletes, said exactly: the entries of the archive's content, and of the
    // media library either all of it (a full archive) or only what the archive lists.
    const contentOccupied = occupied.filter(([k]) => k !== 'media')
    const mediaDeleteText = fullMedia
      ? (present.media ? `, and the whole media library (${present.media} rows; the media files stay in storage)` : '')
      : listedMedia
        ? `, and of the media library only the ${freeToDelete.length} row(s) the archive lists that nothing else uses`
          + `${existingListed.length - freeToDelete.length ? ` (${existingListed.length - freeToDelete.length} more it lists are used by other content and are updated in place)` : ''}; the rest of the library is not touched; the media files stay in storage`
        : ''
    if (mode === 'replace' && (contentOccupied.length || present.media) && opts.confirm && !opts.dryRun) {
      const ok = await opts.confirm(`This deletes ${contentOccupied.length ? label(contentOccupied) : 'no entries'} from ${describeDatabase(opts.databaseUrl)}${mediaDeleteText}, `
        + `then imports ${planned.reduce((n, x) => n + x.rows, 0)} entries`
        + `${manifest.media.rows ? ` and ${manifest.media.rows} media` : ''} from the archive.`)
      if (!ok) throw new ImportRefused('aborted', 'Stopped — nothing was changed.')
    }
    if (mode === 'replace') {
      report.deleted = Object.fromEntries(contentOccupied)
      if (fullMedia && present.media) report.deleted.media = present.media
      else if (listedMedia && freeToDelete.length) report.deleted.media = freeToDelete.length
    }

    for (const d of differences) log(`  ! ${d.message}`)
    if (opts.dryRun) {
      for (const x of planned) report.entries[x.name] = { rows: x.rows, translations: x.translations }
      report.media.rows = manifest.media.rows
      return report
    }

    // ── media files (before the transaction) ──────────────────────────────────
    const urls = new Map<string, string>()
    for (const m of mediaEntries) urls.set(m.id, storage.url(m.key))
    if (manifest.media.included) {
      let next = 0
      await Promise.all(Array.from({ length: Math.min(4, mediaEntries.length) }, async () => {
        while (next < mediaEntries.length) {
          const m = mediaEntries[next++]!
          if (!m.blob) { report.media.missingFiles++; continue }
          const path = join(tmp, ARCHIVE_FILES.mediaDir, safeArchivePath(m.key))
          if (!existsSync(path)) throw invalid(`The archive lists the file ${m.key} but does not contain it.`)
          const body = await readFile(path)
          if (createHash('sha256').update(body).digest('hex') !== m.blob.sha256) throw invalid(`The file ${m.key} in the archive does not match its checksum — is the archive damaged?`)
          await storage.put(m.key, body, m.mime)
          report.media.files++
        }
      }))
    }

    const plan: Plan = { reg, manifest, urls, skipFields, skippedFields: new Set(), locales, deferred }
    const write: Write = mode === 'merge' ? 'upsert' : 'insert'
    // Replacing with an --only archive keeps the media that other content still uses: those rows are updated, not re-created.
    const mediaWrite: Write = mode === 'merge' || (mode === 'replace' && !fullMedia) ? 'upsert' : 'insert'

    // ── one transaction ───────────────────────────────────────────────────────
    await db.transaction(async (tx: any) => {
      if (mode === 'replace') {
        let doing = 'Could not delete the existing content'
        try {
          // A link left empty first, so tables that point at themselves can be emptied.
          for (const edges of deferred.values()) for (const ed of edges) await tx.update(reg.byName.get(ed.entity)!.table).set({ [ed.prop]: null })
          for (const e of [...order].reverse()) { doing = `Could not delete ${e.name}`; await tx.delete(e.table) }
          const names = order.map((e) => e.name)
          if (names.length) {
            await tx.delete(reg.cmsRevisions).where(inArray(reg.cmsRevisions.entity, names))
            // Live-editing state of deleted entries would otherwise outlive them.
            for (const n of names) await tx.delete(reg.cmsCollab).where(sql`starts_with(${reg.cmsCollab.name}, ${n + '/'})`)
          }
          if (fullMedia) { doing = 'Could not delete the media library'; await tx.delete(reg.cmsMedia) }
          else if (listedMedia && existingListed.length) {
            // Only what the archive lists, and only what nothing uses now that the replaced content is gone
            // (checked here, inside the transaction, on the real state).
            doing = 'Could not delete the media the archive replaces'
            const used = await usedMediaIds(tx, reg, existingListed)
            const free = existingListed.filter((m) => !used.has(m.id)).map((m) => m.id)
            for (let at = 0; at < free.length; at += 1000) await tx.delete(reg.cmsMedia).where(inArray(reg.cmsMedia.id, free.slice(at, at + 1000)))
            if (free.length) report.deleted.media = free.length
            else delete report.deleted.media
          }
        }
        catch (err) { throw explain(err, doing) }
      }

      // media rows
      try {
        const cols = getTableColumns(reg.cmsMedia) as Record<string, any>
        const rows = mediaEntries.map((m) => {
          const row: Record<string, unknown> = { url: urls.get(m.id) }
          for (const [k, col] of Object.entries(cols)) {
            if (k === 'url' || k === 'uploadedBy' || !(k in m)) continue
            row[k] = col.dataType === 'date' && m[k] != null ? new Date(m[k]) : m[k]
          }
          return row
        })
        await writeRows(tx, reg.cmsMedia, rows, mediaWrite)
        report.media.rows = rows.length
        if (rows.length) log(`  media: ${rows.length} rows${report.media.files ? `, ${report.media.files} files uploaded` : ''}`)
      }
      catch (err) { throw explain(err, 'Could not write the media library') }

      // entries
      const fixes: { e: CmsEntity; edge: FkEdge; rows: { id: string; v: string }[] }[] = []
      for (const e of order) {
        const layout = layoutOf(reg, e)
        const counts = (report.entries[e.name] = { rows: 0, translations: 0 })
        const path = entryFile(tmp, e)
        if (!path) continue
        const entries = entriesOf(e, path)
        const edges = deferred.get(e.name) ?? []
        const pending = new Map(edges.map((ed) => [ed.prop, { e, edge: ed, rows: [] as { id: string; v: string }[] }]))
        let rows: Record<string, unknown>[] = []
        let trs: Record<string, unknown>[] = []
        const flush = async () => {
          await writeRows(tx, e.table, rows, write)
          if (trs.length) await writeRows(tx, e.localesTable, trs, write === 'upsert' ? 'upsert' : 'insert', write === 'upsert' ? [e.localesTable.parentId, e.localesTable.locale] : undefined)
          counts.rows += rows.length
          counts.translations += trs.length
          rows = []
          trs = []
        }
        try {
          for await (const entry of entries) {
            const d = decodeEntry(plan, layout, entry)
            // A global has one row: the archive's replaces whatever the target has.
            if (e.singleton && mode === 'merge') await tx.delete(e.table).where(ne(e.table.id, entry.id))
            rows.push(d.row)
            trs.push(...d.translations)
            report.skipped.translations += d.skippedTranslations
            for (const fx of d.fixups) pending.get(fx.prop)!.rows.push({ id: fx.id, v: fx.value })
            if (rows.length >= BATCH) await flush()
          }
          await flush()
        }
        catch (err) { throw explain(err, `Could not write ${e.name}`) }
        for (const p of pending.values()) if (p.rows.length) fixes.push(p)
        log(`  ${e.name}: ${counts.rows} ${e.singleton ? 'global' : 'entries'}${counts.translations ? `, ${counts.translations} translations` : ''}`)
      }

      // links that had to wait for their target
      for (const { e, edge, rows } of fixes) {
        try {
          for (let i = 0; i < rows.length; i += 1000) {
            await tx.execute(sql`update ${e.table} set ${sql.identifier(edge.col.name)} = d.v from jsonb_to_recordset(${JSON.stringify(rows.slice(i, i + 1000))}::jsonb) as d(id uuid, v uuid) where ${e.table.id} = d.id`)
          }
        }
        catch (err) { throw explain(err, `Could not link ${e.name}.${edge.key}`) }
      }

      // many-to-many links: read again, now that every entry exists
      for (const e of order) {
        const layout = layoutOf(reg, e)
        const fields = layout.m2m.filter((x) => !skipFields.get(e.name)?.has(x.key))
        const path = entryFile(tmp, e)
        if (!fields.length || !path) continue
        const entries = entriesOf(e, path)
        const owners: Record<string, string[]> = Object.fromEntries(fields.map((x) => [x.key, []]))
        const links: Record<string, Record<string, unknown>[]> = Object.fromEntries(fields.map((x) => [x.key, []]))
        const flush = async () => {
          for (const { key, junction: j } of fields) {
            // Merging sets a field's links to the archive's: the old ones go first.
            if (mode === 'merge' && owners[key]!.length) await tx.delete(j.table).where(inArray(j.table[j.ownerCol], owners[key]!))
            await writeRows(tx, j.table, links[key]!, 'ignore', [j.table[j.ownerCol], j.table[j.targetCol]])
            report.relations += links[key]!.length
            owners[key] = []
            links[key] = []
          }
        }
        try {
          let n = 0
          for await (const entry of entries) {
            for (const { key, junction: j } of fields) {
              const ids = entry.relations?.[key]
              if (!Array.isArray(ids)) continue
              owners[key]!.push(entry.id)
              for (const target of ids) links[key]!.push({ [j.ownerCol]: entry.id, [j.targetCol]: target })
            }
            if (++n % 500 === 0) await flush()
          }
          await flush()
        }
        catch (err) { throw explain(err, `Could not link ${e.name}`) }
      }

      // saved versions
      const revPath = join(tmp, ARCHIVE_FILES.revisions)
      if (manifest.revisions?.included && existsSync(revPath)) {
        const names = new Set(order.map((e) => e.name))
        const cols = getTableColumns(reg.cmsRevisions) as Record<string, any>
        let rows: Record<string, unknown>[] = []
        const flush = async () => { await writeRows(tx, reg.cmsRevisions, rows, mode === 'merge' ? 'ignore' : 'insert'); report.revisions += rows.length; rows = [] }
        try {
          for await (const r of readJsonl<Record<string, any>>(revPath)) {
            if (!names.has(r.entity)) continue
            const row: Record<string, unknown> = {}
            for (const [k, col] of Object.entries(cols)) {
              if (k === 'userId' || !(k in r)) continue
              row[k] = col.dataType === 'date' && r[k] != null ? new Date(r[k]) : r[k]
            }
            rows.push(row)
            if (rows.length >= BATCH) await flush()
          }
          await flush()
        }
        catch (err) { throw explain(err, 'Could not write the saved versions') }
        log(`  revisions: ${report.revisions}`)
      }
    })
    report.skipped.fields = [...plan.skippedFields].sort()

    // ── the search index ──────────────────────────────────────────────────────
    if (opts.searchIndex !== false) {
      try {
        // The server's own index builder. Loaded by path (and not at the top) because it
        // belongs to the Nitro server code, which a plain `tsx` run does not bundle.
        const spec = '../server/utils/cmsSearch'
        const built = await (await import(/* @vite-ignore */ spec)).rebuildSearchIndex(db, reg)
        report.searchIndex = built === null ? 'busy' : 'rebuilt'
        log(built === null ? '  search index: another process is rebuilding it' : `  search index: ${built} rows`)
      }
      catch (err: any) {
        report.searchIndex = 'failed'
        // Next start finds no index state and rebuilds it by itself.
        await db.delete(reg.cmsState).where(sql`${reg.cmsState.key} = 'search.index'`).catch(() => {})
        log(`  ! could not rebuild the search index (${err?.message ?? err}). It is rebuilt when the site next starts, or run: npx nitro task run cms:search-reindex`)
      }
    }
    return report
  }
  finally {
    await close()
    await rm(tmp, { recursive: true, force: true })
  }
}

// ── command line ────────────────────────────────────────────────────────────────

export const IMPORT_USAGE = `usage: tinyzoo import <file.tar.gz> [--replace [--yes] | --merge] [--allow-mismatch] [--dry-run] [--no-search-index]`

async function askToContinue(summary: string, dbName: string): Promise<boolean> {
  if (!process.stdin.isTTY) throw new ImportRefused('aborted', `${summary}\nThis is not a terminal to ask in: pass --yes to go ahead.`)
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await new Promise<string>((done) => rl.question(`${summary}\nType the database name (${dbName}) to continue: `, done))
  rl.close()
  return answer.trim() === dbName
}

export async function runImport(argv: string[], cwd = process.cwd()): Promise<ImportReport> {
  const args = parseArgs(argv, ['database-url', 'uploads'], ['replace', 'merge', 'yes', 'allow-mismatch', 'dry-run', 'no-search-index'])
  const file = args.positional[0]
  if (!file || args.positional.length > 1) throw new Error(IMPORT_USAGE)
  if (args.flags.has('replace') && args.flags.has('merge')) throw new Error('Choose --replace or --merge, not both.')
  // The same settings the running app uses: environment, .env, then nuxt.config.
  const settings = await hostSettings(cwd)
  const databaseUrl = args.values['database-url'] ?? (settings.databaseUrl || null)
  if (!databaseUrl) throw new Error('No database: set DATABASE_URL in the environment or the website\'s .env')
  const reg = await loadRegistry(cwd)
  const storage = storageFromSettings(settings.storage, { dir: args.values.uploads, cwd })
  const mode: ImportMode = args.flags.has('replace') ? 'replace' : args.flags.has('merge') ? 'merge' : 'strict'
  console.log(`Importing ${resolve(cwd, file)} into ${describeDatabase(databaseUrl)} (media to ${storage.describe})`)
  const started = Date.now()
  const report = await importContent({
    reg, databaseUrl, storage, file: resolve(cwd, file), mode,
    allowMismatch: args.flags.has('allow-mismatch'),
    dryRun: args.flags.has('dry-run'),
    searchIndex: !args.flags.has('no-search-index'),
    confirm: args.flags.has('yes') ? undefined : (summary) => askToContinue(summary, databaseName(databaseUrl)),
    log: (m) => console.log(m),
  })
  const rows = Object.values(report.entries).reduce((n, x) => n + x.rows, 0)
  if (report.skipped.entities.length) console.log(`  skipped content: ${report.skipped.entities.join(', ')}`)
  if (report.skipped.fields.length) console.log(`  skipped fields: ${report.skipped.fields.join(', ')}`)
  if (report.skipped.translations) console.log(`  skipped translations: ${report.skipped.translations}`)
  if (report.media.missingFiles) console.log(`  ! ${report.media.missingFiles} media rows had no file in the archive`)
  console.log(`${report.dryRun ? '✓ dry run: nothing written —' : '✓ imported'} ${rows} entries, ${report.media.rows} media${report.relations ? `, ${report.relations} links` : ''} in ${((Date.now() - started) / 1000).toFixed(1)} s`)
  return report
}
