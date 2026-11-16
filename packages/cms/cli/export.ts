/**
 * `tinyzoo export <file>` — the site's content in one archive (format: see transfer.ts).
 *
 *   tinyzoo export site.tar.gz
 *   tinyzoo export site.tar.gz --only post,author --no-media
 *
 *   --only a,b           only these entities (and the media they use)
 *   --no-media           media rows without the files (the target already has them)
 *   --with-revisions     saved versions too
 *   --with-submissions   form submissions too (personal data: left out by default, and
 *                        refused by name in --only without this flag)
 *   --force              overwrite an existing file
 *
 * The file is created readable by its owner only (0600), from the first byte.
 *
 * Everything is read in ONE `REPEATABLE READ` read-only transaction, so the archive is
 * a consistent snapshot even while editors keep saving. Tables are read in pages
 * (keyset by id) and written straight to disk, media files one at a time: memory does
 * not grow with the size of the site.
 */
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { asc, getTableColumns, gt, inArray } from 'drizzle-orm'
import { buildRegistry, type CmsEntity, type CmsRegistry } from '../src/index'
import { type TarEntry, writeTarGz } from './tar'
import {
  ARCHIVE_FILES, ARCHIVE_FORMAT, BATCH, JsonlWriter, connectDb, dependencyOrder, describeSchema,
  encodeEntry, fingerprintOf, hostSettings, iso, layoutOf, mediaIdsOfEntry, parseArgs, storageFingerprint, storageFromSettings, tinyzooVersion,
  type Manifest, type ManifestEntity, type TransferStorage,
} from './transfer'

export interface ExportOptions {
  reg: CmsRegistry
  databaseUrl: string
  /** Where the media files are read from; not needed with `media: false`. */
  storage?: TransferStorage | null
  file: string
  only?: string[] | null
  /** Include the media files (default true). */
  media?: boolean
  withRevisions?: boolean
  withSubmissions?: boolean
  /**
   * Identifies the storage the files normally live in (`TransferStorage.identity`),
   * recorded as a fingerprint so an import into the same storage can warn. Defaults to
   * `storage.identity`; pass it with `--no-media`, where there is no storage to read.
   */
  storageIdentity?: string | null
  force?: boolean
  log?: (message: string) => void
}

export interface ExportResult {
  file: string
  bytes: number
  manifest: Manifest
}

/** Entities left out of a full export unless asked for, and why. */
function excludedByDefault(e: CmsEntity): string | null {
  return e.preset === 'form' ? 'form submissions (personal data) — add --with-submissions to include them' : null
}

/** Run `fn` over `items` with at most `limit` in flight. */
async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]!)
  }))
}

export async function exportContent(opts: ExportOptions): Promise<ExportResult> {
  const { reg } = opts
  const log = opts.log ?? (() => {})
  const withMedia = opts.media !== false
  const file = resolve(opts.file)
  if (existsSync(file) && !opts.force) throw new Error(`${file} already exists (use --force to overwrite it)`)
  if (withMedia && !opts.storage) throw new Error('Media files need storage (set NUXT_CMS_STORAGE_*), or export with --no-media')

  // What goes in.
  const only = opts.only?.length ? [...new Set(opts.only)] : null
  const excluded: Manifest['excluded'] = []
  let selected: CmsEntity[]
  if (only) {
    const unknown = only.filter((n) => !reg.byName.has(n))
    if (unknown.length) throw new Error(`Unknown content in --only: ${unknown.join(', ')} (this site has: ${reg.entities.map((e) => e.name).join(', ')})`)
    selected = only.map((n) => reg.byName.get(n)!)
    // Asking for a form by name is not asking for its visitors' messages: say so.
    const forms = selected.filter((e) => excludedByDefault(e))
    if (forms.length && !opts.withSubmissions) {
      throw new Error(`${forms.map((e) => e.name).join(', ')} hold${forms.length === 1 ? 's' : ''} form submissions (personal data): add --with-submissions to export them, or leave ${forms.length === 1 ? 'it' : 'them'} out of --only.`)
    }
  }
  else {
    selected = []
    for (const e of reg.entities) {
      const why = opts.withSubmissions ? null : excludedByDefault(e)
      if (why) excluded.push({ entity: e.name, reason: why })
      else selected.push(e)
    }
  }
  const { order } = dependencyOrder(reg, selected)

  const tmp = await mkdtemp(join(tmpdir(), 'tinyzoo-export-'))
  const { db, close } = connectDb(opts.databaseUrl, reg)
  try {
    await mkdir(join(tmp, 'content'), { recursive: true })
    await mkdir(join(tmp, 'globals'), { recursive: true })
    const manifestEntities: ManifestEntity[] = []
    const usedMedia = new Set<string>()
    const mediaFiles: string[] = []
    const identity = opts.storageIdentity !== undefined ? opts.storageIdentity : opts.storage?.identity ?? null
    const media: Manifest['media'] = { rows: 0, included: withMedia, files: 0, missing: 0, storage: identity ? storageFingerprint(identity) : null }
    let revisionRows = 0

    await db.transaction(async (tx: any) => {
      // ── entries ───────────────────────────────────────────────────────────────
      for (const e of order) {
        const layout = layoutOf(reg, e)
        const info: ManifestEntity = { name: e.name, kind: e.singleton ? 'global' : 'collection', rows: 0, translations: 0, file: null }
        const writer = e.singleton ? null : new JsonlWriter(join(tmp, ARCHIVE_FILES.content(e.name)))
        let last: string | undefined
        let globalEntry: unknown = null
        try {
          for (;;) {
            // A global has one row (the oldest, as the admin reads it); a collection is paged by id.
            const rows: any[] = e.singleton
              ? await tx.select().from(e.table).orderBy(asc(e.table.createdAt)).limit(1)
              : await tx.select().from(e.table).where(last ? gt(e.table.id, last) : undefined).orderBy(asc(e.table.id)).limit(BATCH)
            if (!rows.length) break
            const ids = rows.map((r) => r.id as string)

            const translations = new Map<string, any[]>()
            if (e.localesTable && e.localized.length) {
              const t = e.localesTable
              const trs: any[] = await tx.select().from(t).where(inArray(t.parentId, ids)).orderBy(asc(t.parentId), asc(t.locale))
              for (const tr of trs) translations.set(tr.parentId, [...(translations.get(tr.parentId) ?? []), tr])
            }
            // Many-to-many links, by field: every field is written (an empty list is a statement too).
            const links = new Map<string, Map<string, string[]>>()
            for (const { key, junction: j } of layout.m2m) {
              const jrows: any[] = await tx.select().from(j.table).where(inArray(j.table[j.ownerCol], ids))
              const byOwner = new Map<string, string[]>()
              for (const jr of jrows) byOwner.set(jr[j.ownerCol], [...(byOwner.get(jr[j.ownerCol]) ?? []), jr[j.targetCol]])
              for (const list of byOwner.values()) list.sort()
              links.set(key, byOwner)
            }

            for (const row of rows) {
              const trs = translations.get(row.id) ?? []
              const relations = Object.fromEntries(layout.m2m.map(({ key }) => [key, links.get(key)?.get(row.id) ?? []]))
              const entry = encodeEntry(layout, row, trs, relations)
              if (only) for (const id of mediaIdsOfEntry(layout, entry)) usedMedia.add(id)
              info.rows++
              info.translations += trs.length
              if (writer) await writer.write(entry)
              else globalEntry = entry
            }
            if (e.singleton || rows.length < BATCH) break
            last = ids[ids.length - 1]
          }
        }
        finally {
          await writer?.close().catch(() => {})
        }
        if (e.singleton) {
          if (globalEntry) {
            info.file = ARCHIVE_FILES.global(e.name)
            await writeFile(join(tmp, info.file), JSON.stringify({ entity: e.name, entry: globalEntry }, null, 2) + '\n')
          }
        }
        else info.file = ARCHIVE_FILES.content(e.name)
        manifestEntities.push(info)
        log(`  ${e.name}: ${info.rows} ${e.singleton ? (info.rows ? 'global' : 'globals (not saved yet)') : info.rows === 1 ? 'entry' : 'entries'}${info.translations ? `, ${info.translations} translations` : ''}`)
      }

      // ── media ─────────────────────────────────────────────────────────────────
      const m = reg.cmsMedia
      const mediaCols = Object.keys(getTableColumns(m)).filter((k) => k !== 'url' && k !== 'uploadedBy')
      const writer = new JsonlWriter(join(tmp, ARCHIVE_FILES.media))
      try {
        // With --only, just the pictures and files the exported entries use.
        const wanted = only ? [...usedMedia].sort() : null
        const pages = async function* (): AsyncGenerator<any[]> {
          if (wanted) {
            for (let at = 0; at < wanted.length; at += BATCH) yield await tx.select().from(m).where(inArray(m.id, wanted.slice(at, at + BATCH))).orderBy(asc(m.id))
            return
          }
          let lastId: string | undefined
          for (;;) {
            const rows: any[] = await tx.select().from(m).where(lastId ? gt(m.id, lastId) : undefined).orderBy(asc(m.id)).limit(BATCH)
            if (!rows.length) return
            yield rows
            if (rows.length < BATCH) return
            lastId = rows[rows.length - 1].id
          }
        }
        for await (const rows of pages()) {
          const blobs = new Map<string, { size: number; sha256: string } | null>()
          if (withMedia) {
            await mapLimit(rows, 4, async (row) => {
              const blob = await opts.storage!.get(row.key)
              if (!blob) { blobs.set(row.id, null); return }
              const target = join(tmp, ARCHIVE_FILES.mediaDir, row.key)
              await mkdir(dirname(target), { recursive: true })
              await writeFile(target, blob)
              blobs.set(row.id, { size: blob.length, sha256: createHash('sha256').update(blob).digest('hex') })
            })
          }
          for (const row of rows) {
            const out: Record<string, unknown> = {}
            for (const k of mediaCols) out[k] = iso(row[k])
            const blob = withMedia ? blobs.get(row.id) ?? null : null
            await writer.write({ ...out, blob })
            media.rows++
            if (blob) { media.files++; mediaFiles.push(row.key) }
            else if (withMedia) { media.missing++; log(`  ! the file of media ${row.id} (${row.key}) is not in storage`) }
          }
        }
      }
      finally {
        await writer.close().catch(() => {})
      }
      log(`  media: ${media.rows} rows${withMedia ? `, ${media.files} files` : ' (files left out)'}`)

      // ── saved versions ────────────────────────────────────────────────────────
      if (opts.withRevisions) {
        const r = reg.cmsRevisions
        const cols = Object.keys(getTableColumns(r)).filter((k) => k !== 'userId')
        const names = selected.map((e) => e.name)
        const rw = new JsonlWriter(join(tmp, ARCHIVE_FILES.revisions))
        try {
          let lastId: string | undefined
          for (;;) {
            const rows: any[] = await tx.select().from(r)
              .where(lastId ? gt(r.id, lastId) : undefined).orderBy(asc(r.id)).limit(BATCH)
            if (!rows.length) break
            for (const row of rows) {
              if (!names.includes(row.entity)) continue
              await rw.write(Object.fromEntries(cols.map((k) => [k, iso(row[k])])))
              revisionRows++
            }
            if (rows.length < BATCH) break
            lastId = rows[rows.length - 1].id
          }
        }
        finally { await rw.close().catch(() => {}) }
        log(`  revisions: ${revisionRows}`)
      }
    }, { isolationLevel: 'repeatable read', accessMode: 'read only' })

    // ── manifest and the archive ───────────────────────────────────────────────
    const schema = describeSchema(reg)
    const manifest: Manifest = {
      format: ARCHIVE_FORMAT,
      tinyzoo: tinyzooVersion(),
      exportedAt: new Date().toISOString(),
      fingerprint: fingerprintOf(schema),
      schema,
      locales: reg.locales ? { default: reg.locales.default, all: [...reg.locales.locales] } : null,
      only,
      entities: manifestEntities,
      excluded,
      media,
      revisions: { included: !!opts.withRevisions, rows: revisionRows },
    }
    await writeFile(join(tmp, ARCHIVE_FILES.manifest), JSON.stringify(manifest, null, 2) + '\n')

    const entries: TarEntry[] = [{ name: ARCHIVE_FILES.manifest, path: join(tmp, ARCHIVE_FILES.manifest) }]
    entries.push({ name: ARCHIVE_FILES.media, path: join(tmp, ARCHIVE_FILES.media) })
    for (const key of mediaFiles) entries.push({ name: ARCHIVE_FILES.mediaDir + key, path: join(tmp, ARCHIVE_FILES.mediaDir, key) })
    if (opts.withRevisions) entries.push({ name: ARCHIVE_FILES.revisions, path: join(tmp, ARCHIVE_FILES.revisions) })
    for (const info of manifestEntities) if (info.file) entries.push({ name: info.file, path: join(tmp, info.file) })

    await mkdir(dirname(file), { recursive: true })
    const partial = `${file}.partial`
    try {
      await writeTarGz(partial, entries) // created 0600
      await rename(partial, file)
    }
    catch (err) {
      await rm(partial, { force: true })
      throw err
    }
    return { file, bytes: (await stat(file)).size, manifest }
  }
  finally {
    await close()
    await rm(tmp, { recursive: true, force: true })
  }
}

// ── command line ────────────────────────────────────────────────────────────────

export const EXPORT_USAGE = `usage: tinyzoo export <file.tar.gz> [--only a,b] [--no-media] [--with-revisions] [--with-submissions] [--force]`

/** Load the host's cms.config.ts into a registry. */
export async function loadRegistry(cwd: string): Promise<CmsRegistry> {
  const configPath = resolve(cwd, 'cms.config.ts')
  if (!existsSync(configPath)) throw new Error(`No cms.config.ts in ${cwd} — run this from the website's folder.`)
  return buildRegistry(await import(pathToFileURL(configPath).href))
}

export async function runExport(argv: string[], cwd = process.cwd()): Promise<void> {
  const args = parseArgs(argv, ['only', 'database-url', 'uploads'], ['no-media', 'with-revisions', 'with-submissions', 'force'])
  const file = args.positional[0]
  if (!file || args.positional.length > 1) throw new Error(EXPORT_USAGE)
  // The same settings the running app uses: environment, .env, then nuxt.config.
  const settings = await hostSettings(cwd)
  const databaseUrl = args.values['database-url'] ?? (settings.databaseUrl || null)
  if (!databaseUrl) throw new Error('No database: set DATABASE_URL in the environment or the website\'s .env')
  const reg = await loadRegistry(cwd)
  const noMedia = args.flags.has('no-media')
  const override = { dir: args.values.uploads, cwd }
  const storage = noMedia ? null : storageFromSettings(settings.storage, override)
  // With --no-media there is nothing to read, but the archive still says where the files live.
  let storageIdentity: string | null = storage?.identity ?? null
  if (noMedia) { try { storageIdentity = storageFromSettings(settings.storage, override).identity } catch { storageIdentity = null } }
  console.log(`Exporting to ${resolve(cwd, file)}${storage ? ` (media from ${storage.describe})` : ''}`)
  const started = Date.now()
  const { manifest, bytes, file: written } = await exportContent({
    reg, databaseUrl, storage, storageIdentity, file: resolve(cwd, file),
    only: args.values.only ? args.values.only.split(',').map((s) => s.trim()).filter(Boolean) : null,
    media: !noMedia,
    withRevisions: args.flags.has('with-revisions'),
    withSubmissions: args.flags.has('with-submissions'),
    force: args.flags.has('force'),
    log: (m) => console.log(m),
  })
  for (const x of manifest.excluded) console.log(`  – left out: ${x.entity}, ${x.reason}`)
  console.log(`✓ ${written} (${(bytes / 1024 / 1024).toFixed(1)} MB, ${((Date.now() - started) / 1000).toFixed(1)} s, fingerprint ${manifest.fingerprint.slice(0, 12)})`)
}
