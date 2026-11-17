/**
 * What `tinyzoo export` and `tinyzoo import` share: the archive layout, how a site's
 * content model is described and compared, how rows become archive entries and back,
 * the order tables can be filled in, and how the CLI finds the database and storage.
 *
 * ── The archive ─────────────────────────────────────────────────────────────────
 * One `.tar.gz` (format 1). Everything is JSON, so it can be read without tinyzoo.
 *
 *   manifest.json              format, tinyzoo version, when, the content model's
 *                              fingerprint and shape, languages, what is inside
 *   content/<entity>.jsonl     one entry per line (collections)
 *   globals/<name>.json        the one row of a global (settings, menus, home page)
 *   media.jsonl                the media library's rows, one per line
 *   media/<storage key>        the files themselves
 *   revisions.jsonl            saved versions (only with `--with-revisions`)
 *
 * An entry is keyed by FIELD names (not columns), so it survives a column rename:
 *
 *   { "id": "…", "createdAt": "…", "updatedAt": "…",
 *     "fields":       { "title": "…", "author": "<id>", "hero": "<media id>", "body": {…} },
 *     "translations": [ { "id": "…", "locale": "en", "createdAt": "…", "updatedAt": "…",
 *                         "fields": { "title": "…", "body": {…} },
 *                         "publish": { "published": true, "publishedAt": "…" } } ],  // only with publish.perLocale; null follows the default language
 *     "relations":    { "tags": ["<id>", …] } }          // many-to-many, by field
 *
 * Not in the archive, on purpose: accounts (users, invitation and reset links),
 * sessions, the audit log, live-editing state and the search index. People and their
 * history belong to an environment — a copy of production must not carry its people
 * into staging — and the search index is rebuilt from the content on import. Saved
 * versions (revisions) come with `--with-revisions`; form submissions (personal
 * data) with `--with-submissions`. Who created or last changed a row is dropped for
 * the same reason (it points at accounts).
 */
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, type WriteStream } from 'node:fs'
import { readFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { once } from 'node:events'
import { join, resolve, sep } from 'node:path'
import { createInterface } from 'node:readline'
import { getTableColumns, getTableName, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { mediaIdsInBlocks, mediaIdsInFields, propOf, type CmsEntity, type CmsRegistry, type Junction } from '../src/index'
import { blockVersion, storedBlockVersion } from '../src/blocks'
import { loadSettings, settingsFrom, type StorageSettings } from './backup'
import { encodeStorageKey, resolveS3Delivery, storedMediaUrl } from '../shared/storage-delivery'

export const ARCHIVE_FORMAT = 1

export const ARCHIVE_FILES = {
  manifest: 'manifest.json',
  media: 'media.jsonl',
  revisions: 'revisions.jsonl',
  mediaDir: 'media/',
  content: (entity: string) => `content/${entity}.jsonl`,
  global: (entity: string) => `globals/${entity}.json`,
}

/** Entity names become file names: only plain identifiers are accepted from an archive. */
export const SAFE_NAME = /^[A-Za-z0-9_-]+$/

/** Rows read or written per query. */
export const BATCH = 500

// ── manifest ────────────────────────────────────────────────────────────────────

export interface ManifestEntity {
  name: string
  kind: 'collection' | 'global'
  rows: number
  translations: number
  file: string | null
}

export interface Manifest {
  format: number
  tinyzoo: string
  exportedAt: string
  fingerprint: string
  schema: SchemaShape
  locales: { default: string; all: string[] } | null
  /** The entities asked for with `--only`, or null for everything. */
  only: string[] | null
  entities: ManifestEntity[]
  excluded: { entity: string; reason: string }[]
  media: {
    rows: number; included: boolean; files: number; missing: number
    /**
     * A fingerprint (sha256) of the storage the files were exported from — never the
     * bucket name or a path. An import into the SAME storage warns: two environments
     * must not share one, or deleting a file in one deletes it in the other.
     */
    storage?: string | null
  }
  revisions: { included: boolean; rows: number }
}

// ── the content model: shape, fingerprint, differences ─────────────────────────

export interface FieldShape {
  type: string
  localized?: true
  relation?: { to: string; kind: string }
  values?: string[]
  blocks?: Record<string, Record<string, FieldShape>>
  /** A group's own fields. */
  fields?: Record<string, FieldShape>
  /** Block types (or list items) whose definition is at a version above 1. */
  blockVersions?: Record<string, number>
}

export interface SchemaShape {
  entities: Record<string, { singleton: boolean; fields: Record<string, FieldShape> }>
}

function fieldShape(fld: any): FieldShape {
  const shape: FieldShape = { type: fld.type }
  if (fld.isLocalized) shape.localized = true
  if (fld.relation) shape.relation = { to: (fld.relation.to() as CmsEntity).name, kind: fld.relation.kind }
  if (fld.spec?.base.kind === 'enum') shape.values = [...fld.spec.base.values]
  if (fld.blocks) {
    const defs = fld.blocks as Record<string, any>
    shape.blocks = Object.fromEntries(Object.entries(defs).map(([type, def]) => [
      type,
      Object.fromEntries(Object.entries(def.fields as Record<string, any>).map(([k, f]) => [k, fieldShape(f)])),
    ]))
    // Stored blocks carry `v` once their definition is above 1: an archive at v2 does
    // not fit a site still at v1. Left out at 1, so sites without versions keep their fingerprint.
    const versions = Object.fromEntries(Object.entries(defs).filter(([, def]) => blockVersion(def) > 1).map(([type, def]) => [type, blockVersion(def)]))
    if (Object.keys(versions).length) shape.blockVersions = versions
  }
  if (fld.type === 'group' && fld.fields) shape.fields = Object.fromEntries(Object.entries(fld.fields as Record<string, any>).map(([k, f]) => [k, fieldShape(f)]))
  return shape
}

/** Entity and field names, types and block definitions — what the content is made of. */
export function describeSchema(reg: CmsRegistry): SchemaShape {
  return {
    entities: Object.fromEntries(reg.entities.map((e) => [e.name, {
      singleton: !!e.singleton,
      fields: Object.fromEntries(Object.entries(e.fields).map(([k, f]) => [k, fieldShape(f)])),
    }])),
  }
}

/** JSON with every object's keys sorted: the same model always serializes the same. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson((value as any)[k])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

export function fingerprintOf(schema: SchemaShape): string {
  return createHash('sha256').update(canonicalJson(schema)).digest('hex')
}

export interface Difference {
  scope: 'entity' | 'field' | 'blocks' | 'locales'
  entity?: string
  field?: string
  message: string
  /** Under `--allow-mismatch` the import leaves this entity / field out. */
  skip: boolean
}

/** A field's shape without block versions (what the structure comparison looks at). */
function withoutVersions(shape: FieldShape): FieldShape {
  const { blockVersions: _v, ...rest } = shape
  if (!rest.blocks) return rest
  return { ...rest, blocks: Object.fromEntries(Object.entries(rest.blocks).map(([type, fields]) => [type, Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, withoutVersions(f)]))])) }
}

/** Block types (at any depth) the archive has at a NEWER version than this site's definition. */
function newerBlockVersions(path: string, a: FieldShape, b: FieldShape, out: string[]): void {
  for (const type of Object.keys(a.blocks ?? {})) {
    const fb = b.blocks?.[type]
    if (!fb) continue
    const av = a.blockVersions?.[type] ?? 1
    const bv = b.blockVersions?.[type] ?? 1
    if (av > bv) out.push(`"${type}" is at version ${av} in the archive but this site's definition is at ${bv} (update this site first)`)
    for (const [k, fa] of Object.entries(a.blocks![type]!)) if (fb[k]) newerBlockVersions(`${path}: "${type}.${k}"`, fa, fb[k]!, out)
  }
}

function diffBlocks(path: string, fa: FieldShape, fb: FieldShape, entity: string, field: string, out: Difference[]) {
  const mk = (message: string, skip = false): Difference => ({ scope: 'blocks', entity, field, message: `${path}: ${message}`, skip })
  const a = fa.blocks ?? {}
  const b = fb.blocks ?? {}
  for (const type of Object.keys(a)) if (!b[type]) out.push(mk(`block "${type}" is in the archive but no longer exists here`))
  for (const type of Object.keys(b)) if (!a[type]) out.push(mk(`block "${type}" is new here (the archive has none)`))
  for (const type of Object.keys(a)) {
    const xa = a[type]
    const xb = b[type]
    if (!xa || !xb) continue
    for (const k of Object.keys(xa)) {
      if (!xb[k]) out.push(mk(`"${type}.${k}" is in the archive but no longer exists here`))
      else if (canonicalJson(withoutVersions(xa[k]!)) !== canonicalJson(withoutVersions(xb[k]!))) out.push(mk(`"${type}.${k}" has changed (${describeChange(xa[k]!, xb[k]!)})`))
    }
    for (const k of Object.keys(xb)) if (!xa[k]) out.push(mk(`"${type}.${k}" is new here`))
  }
  // Older blocks in the archive are brought up to date on import; newer ones cannot be read.
  // The field is left out under --allow-mismatch.
  const newer: string[] = []
  newerBlockVersions(path, fa, fb, newer)
  for (const message of newer) out.push(mk(message, true))
}

function describeChange(a: FieldShape, b: FieldShape): string {
  if (a.type !== b.type) return `${a.type} → ${b.type}`
  if (!!a.localized !== !!b.localized) return a.localized ? 'no longer translated' : 'now translated'
  if (a.relation?.to !== b.relation?.to || a.relation?.kind !== b.relation?.kind) return `links to ${a.relation?.to}/${a.relation?.kind} → ${b.relation?.to}/${b.relation?.kind}`
  if (canonicalJson(a.values) !== canonicalJson(b.values)) return `choices ${(a.values ?? []).join('|')} → ${(b.values ?? []).join('|')}`
  return 'its blocks have changed'
}

/**
 * What differs between the content model an archive was made from and this site's.
 * Entities and fields missing on either side, changed types, choices and blocks.
 */
export function diffSchemas(archive: SchemaShape, target: SchemaShape): Difference[] {
  const out: Difference[] = []
  const names = [...new Set([...Object.keys(archive.entities), ...Object.keys(target.entities)])].sort()
  for (const name of names) {
    const a = archive.entities[name]
    const b = target.entities[name]
    if (a && !b) { out.push({ scope: 'entity', entity: name, message: `"${name}" is in the archive but this site has no such content`, skip: true }); continue }
    if (!a && b) { out.push({ scope: 'entity', entity: name, message: `"${name}" exists here but not in the archive (it stays empty)`, skip: false }); continue }
    if (!a || !b) continue
    if (a.singleton !== b.singleton) {
      out.push({ scope: 'entity', entity: name, message: `"${name}" is ${a.singleton ? 'a global' : 'a collection'} in the archive but ${b.singleton ? 'a global' : 'a collection'} here`, skip: true })
      continue
    }
    const keys = [...new Set([...Object.keys(a.fields), ...Object.keys(b.fields)])].sort()
    for (const key of keys) {
      const fa = a.fields[key]
      const fb = b.fields[key]
      const at = `${name}.${key}`
      if (fa && !fb) out.push({ scope: 'field', entity: name, field: key, message: `${at} is in the archive but this site has no such field`, skip: true })
      else if (!fa && fb) out.push({ scope: 'field', entity: name, field: key, message: `${at} exists here but not in the archive (it stays empty)`, skip: false })
      else if (fa && fb && canonicalJson(fa) !== canonicalJson(fb)) {
        const structural = fa.type !== fb.type || !!fa.localized !== !!fb.localized
          || fa.relation?.to !== fb.relation?.to || fa.relation?.kind !== fb.relation?.kind
        if (structural) out.push({ scope: 'field', entity: name, field: key, message: `${at} has changed (${describeChange(fa, fb)})`, skip: true })
        else if (canonicalJson(fa.values) !== canonicalJson(fb.values)) out.push({ scope: 'field', entity: name, field: key, message: `${at} has other choices (${describeChange(fa, fb)})`, skip: false })
        else diffBlocks(at, fa, fb, name, key, out)
      }
    }
  }
  return out
}

export function formatDifferences(list: Difference[]): string {
  return list.map((d) => `  • ${d.message}${d.skip ? '  [left out with --allow-mismatch]' : ''}`).join('\n')
}

// ── rows ↔ entries ──────────────────────────────────────────────────────────────

export interface LayoutField {
  key: string
  /** The row's property (FK fields end in `Id`). */
  prop: string
  fld: any
  col: any
  isDate: boolean
}

export interface EntityLayout {
  e: CmsEntity
  fields: LayoutField[]
  byKey: Map<string, LayoutField>
  /** Many-to-many fields (they own no column). */
  m2m: { key: string; junction: Junction }[]
  /** Translated field keys → their column in the translations table. */
  localeCols: Record<string, any>
}

export function layoutOf(reg: CmsRegistry, e: CmsEntity): EntityLayout {
  const columns = getTableColumns(e.table) as Record<string, any>
  const fields: LayoutField[] = []
  for (const [key, fld] of Object.entries(e.fields)) {
    if (!fld.spec) continue
    const prop = propOf(key, fld)
    const col = columns[prop]
    if (!col) continue
    fields.push({ key, prop, fld, col, isDate: col.dataType === 'date' })
  }
  const m2m: EntityLayout['m2m'] = []
  for (const [key, fld] of Object.entries(e.fields)) {
    if (fld.relation?.kind !== 'many-to-many') continue
    const junction = reg.junctionByOwnerField.get(`${e.name}.${key}`)
    if (junction) m2m.push({ key, junction })
  }
  const localeCols = e.localesTable ? (getTableColumns(e.localesTable) as Record<string, any>) : {}
  return { e, fields, byKey: new Map(fields.map((x) => [x.key, x])), m2m, localeCols }
}

export const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v ?? null)

export interface Entry {
  id: string
  createdAt: string
  updatedAt: string
  fields: Record<string, unknown>
  translations: {
    id: string; locale: string; createdAt: string; updatedAt: string; fields: Record<string, unknown>
    /** Per-language publishing (`publish.perLocale`): this language's own state; `published: null` follows the default language. Left out for entities without it. */
    publish?: { published: boolean | null; publishedAt: string | null }
  }[]
  relations: Record<string, string[]>
}

export function encodeEntry(layout: EntityLayout, row: any, translations: any[], relations: Record<string, string[]>): Entry {
  const fields: Record<string, unknown> = {}
  for (const f of layout.fields) fields[f.key] = iso(row[f.prop])
  return {
    id: row.id,
    createdAt: iso(row.createdAt) as string,
    updatedAt: iso(row.updatedAt) as string,
    fields,
    translations: translations.map((t) => ({
      id: t.id,
      locale: t.locale,
      createdAt: iso(t.createdAt) as string,
      updatedAt: iso(t.updatedAt) as string,
      fields: Object.fromEntries(layout.e.localized.map((k) => [k, iso(t[k])])),
      ...(layout.e.publish?.perLocale ? { publish: { published: t.published ?? null, publishedAt: (iso(t.publishedAt) as string | null) ?? null } } : {}),
    })),
    relations,
  }
}

/** Embedded pictures of a rich-text document (image nodes carry the media id). */
function embeddedIds(doc: any, out: string[]): void {
  if (!doc || typeof doc !== 'object') return
  if (typeof doc.attrs?.mediaId === 'string') out.push(doc.attrs.mediaId)
  if (Array.isArray(doc.content)) for (const child of doc.content) embeddedIds(child, out)
}

/** Media ids one field value refers to (a picture, a gallery, blocks, rich text). */
export function mediaIdsOfValue(fld: any, value: unknown, out: string[] = []): string[] {
  if (value == null) return out
  if (fld.type === 'media') { if (typeof value === 'string') out.push(value) }
  else if (fld.type === 'gallery') { if (Array.isArray(value)) for (const g of value) if (typeof g?.mediaId === 'string') out.push(g.mediaId) }
  else if (fld.type === 'blocks') mediaIdsInBlocks(value, fld.blocks ?? {}, out)
  else if (fld.type === 'group') { if (typeof value === 'object') mediaIdsInFields(fld.fields ?? {}, value as Record<string, any>, out) }
  else if (fld.type === 'richtext') embeddedIds(value, out)
  return out
}

/** Media ids an entry uses, in its own row and in its translations. */
export function mediaIdsOfEntry(layout: EntityLayout, entry: Entry): string[] {
  const out: string[] = []
  for (const f of layout.fields) mediaIdsOfValue(f.fld, entry.fields[f.key], out)
  for (const t of entry.translations) for (const k of layout.e.localized) mediaIdsOfValue(layout.e.fields[k], t.fields[k], out)
  return out
}

// ── who uses a media file ───────────────────────────────────────────────────────

/** Field types whose JSON can hold media ids (rich text images, blocks, galleries). */
const JSON_MEDIA_TYPES = new Set(['richtext', 'blocks', 'gallery', 'group'])

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

/**
 * Which of these media rows are still used by content: as a link in ANY table that has
 * a foreign key to the media library, or inside the JSON of rich text, blocks and
 * galleries — matched by id AND by storage key, as the server's own clean-up does
 * (an embedded picture whose id was lost still carries its address). Tables in
 * `exceptTables` (by name) are not looked at: the rows about to be replaced.
 */
export async function usedMediaIds(db: any, reg: CmsRegistry, media: { id: string; key: string }[], exceptTables: Set<string> = new Set()): Promise<Set<string>> {
  const used = new Set<string>()
  if (!media.length) return used
  const mediaTable = getTableName(reg.cmsMedia)

  // Links: every foreign key that points at the media library, whoever declared it.
  const fks: { schema: string; tbl: string; col: string }[] = (await db.execute(sql`
    select n.nspname as schema, c.relname as tbl, a.attname as col
    from pg_constraint k
    join pg_class c on c.oid = k.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any (k.conkey)
    where k.contype = 'f' and k.confrelid = to_regclass(${`"${mediaTable}"`})`)).rows
  const ids = media.map((m) => m.id)
  for (let at = 0; at < ids.length; at += 1000) {
    const batch = JSON.stringify(ids.slice(at, at + 1000))
    for (const fk of fks) {
      if (exceptTables.has(fk.tbl)) continue
      const res = await db.execute(sql`select distinct ${sql.identifier(fk.col)}::text as id from ${sql.identifier(fk.schema)}.${sql.identifier(fk.tbl)}
        where ${sql.identifier(fk.col)} in (select jsonb_array_elements_text(${batch}::jsonb)::uuid)`)
      for (const r of res.rows) used.add(r.id)
    }
  }

  // JSON: a column that can hold pictures, in the entity and in its translations.
  const columns: { table: any; name: string; key: string }[] = []
  for (const e of reg.entities) {
    for (const [key, fld] of Object.entries(e.fields as Record<string, any>)) {
      if (!JSON_MEDIA_TYPES.has(fld.type)) continue
      columns.push({ table: e.table, name: getTableName(e.table), key })
      if (fld.isLocalized && e.localesTable) columns.push({ table: e.localesTable, name: getTableName(e.localesTable), key })
    }
  }
  for (let at = 0; at < media.length; at += 200) {
    const batch = media.slice(at, at + 200)
    const patterns = JSON.stringify(batch.flatMap((m) => [`%${escapeLike(m.id)}%`, `%${escapeLike(m.key)}%`]))
    for (const { table, name, key } of columns) {
      if (exceptTables.has(name)) continue
      const col = (table as any)[key]
      const res = await db.execute(sql`select cast(${col} as text) as t from ${table}
        where cast(${col} as text) ilike any (array(select jsonb_array_elements_text(${patterns}::jsonb)))`)
      for (const r of res.rows) {
        const text = String(r.t).toLowerCase()
        for (const m of batch) if (!used.has(m.id) && (text.includes(m.id.toLowerCase()) || text.includes(m.key.toLowerCase()))) used.add(m.id)
      }
    }
  }
  return used
}

/**
 * Blocks (at any depth) stored at a version NEWER than this site's definition of the
 * type: the site could neither read nor save them. One line per block, naming where.
 */
export function newerStoredBlocks(value: unknown, defs: Record<string, any>, path: (string | number)[] = [], out: string[] = []): string[] {
  if (!Array.isArray(value)) return out
  value.forEach((b, i) => {
    if (!b || typeof b !== 'object' || typeof b.type !== 'string' || !Object.hasOwn(defs, b.type)) return
    const def = defs[b.type]
    const have = storedBlockVersion(b)
    if (have > blockVersion(def)) out.push(`the "${b.type}" block${typeof b.id === 'string' ? ` ${b.id}` : ''} at ${[...path, i].join('.')} is stored at version ${have}, this site's definition is at ${blockVersion(def)}`)
    for (const [key, fld] of Object.entries(def.fields as Record<string, any>)) if (fld.type === 'blocks' && fld.blocks) newerStoredBlocks(b[key], fld.blocks, [...path, i, key], out)
  })
  return out
}

// ── the order tables can be filled in ───────────────────────────────────────────

export interface FkEdge { entity: string; key: string; prop: string; col: any; to: string; required: boolean }

/**
 * Dependency order of `entities` by their many-to-one links (a post needs its author
 * first). A link that cannot be satisfied in any order — a page's parent, two
 * entities pointing at each other — is *deferred*: its column is left empty while
 * rows are inserted and filled in afterwards. A required link in a cycle cannot be
 * deferred and is an error.
 */
export function dependencyOrder(reg: CmsRegistry, entities: CmsEntity[]): { order: CmsEntity[]; deferred: Map<string, FkEdge[]> } {
  const byName = new Map(entities.map((e) => [e.name, e]))
  const edges = new Map<string, FkEdge[]>()
  for (const e of entities) {
    const layout = layoutOf(reg, e)
    const list: FkEdge[] = []
    for (const f of layout.fields) {
      if (f.fld.relation?.kind !== 'many-to-one') continue
      const to = (f.fld.relation.to() as CmsEntity).name
      if (byName.has(to)) list.push({ entity: e.name, key: f.key, prop: f.prop, col: f.col, to, required: !!f.col.notNull })
    }
    edges.set(e.name, list)
  }
  const placed = new Set<string>()
  const remaining = new Set([...byName.keys()].sort())
  const order: CmsEntity[] = []
  const deferred = new Map<string, FkEdge[]>()
  const unmet = (n: string) => (edges.get(n) ?? []).filter((x) => !placed.has(x.to))
  while (remaining.size) {
    const names = [...remaining]
    let pick = names.find((n) => unmet(n).length === 0)
    if (!pick) {
      pick = names.filter((n) => unmet(n).every((x) => !x.required)).sort((a, b) => unmet(a).length - unmet(b).length)[0]
      if (!pick) {
        const cycle = names.filter((n) => unmet(n).some((x) => x.required))
        throw new Error(`Required links form a cycle (${cycle.join(', ')}); content like this cannot be imported in any order.`)
      }
      deferred.set(pick, unmet(pick))
    }
    remaining.delete(pick)
    placed.add(pick)
    order.push(byName.get(pick)!)
  }
  return { order, deferred }
}

// ── files: JSON lines ───────────────────────────────────────────────────────────

export class JsonlWriter {
  private out: WriteStream
  private failure: Error | null = null
  count = 0
  constructor(path: string) {
    this.out = createWriteStream(path)
    this.out.on('error', (err) => { this.failure = err })
  }
  async write(value: unknown): Promise<void> {
    if (this.failure) throw this.failure
    this.count++
    if (!this.out.write(JSON.stringify(value) + '\n')) await once(this.out, 'drain')
  }
  async close(): Promise<void> {
    if (this.failure) throw this.failure
    await new Promise<void>((resolveClose, reject) => { this.out.once('error', reject); this.out.end(resolveClose) })
  }
}

export async function* readJsonl<T = any>(path: string): AsyncGenerator<T> {
  const lines = createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity })
  let n = 0
  for await (const line of lines) {
    n++
    if (!line.trim()) continue
    try { yield JSON.parse(line) as T }
    catch { throw new Error(`${path.split(sep).slice(-2).join('/')}: line ${n} is not valid JSON — is the archive damaged?`) }
  }
}

// ── the host: database and storage, as the server finds them ───────────────────

/** `host:port/name` of a connection string — never its password. */
export function describeDatabase(url: string): string {
  try {
    const u = new URL(url)
    return `${u.host}${u.pathname}`
  }
  catch { return 'the database' }
}

export function databaseName(url: string): string {
  try { return new URL(url).pathname.replace(/^\//, '') }
  catch { return '' }
}

export function connectDb(url: string, reg: CmsRegistry) {
  const pool = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 10_000 })
  const db = drizzle(pool, { schema: reg.schema })
  return { db, pool, close: () => pool.end() }
}

/** Blob storage as the CLI needs it: read, write, and the public URL of a key. */
export interface TransferStorage {
  describe: string
  /**
   * What identifies the place the files live in — the folder (on this machine), or the
   * endpoint and bucket. Never printed or stored as it is: see `storageFingerprint`.
   */
  identity: string
  get(key: string): Promise<Buffer | null>
  put(key: string, body: Buffer, contentType: string): Promise<void>
  url(key: string): string
}

/** A fingerprint of a storage's identity, safe to put in an archive (no path, no bucket name). */
export function storageFingerprint(identity: string): string {
  return createHash('sha256').update(identity).digest('hex').slice(0, 32)
}

/**
 * The host's database and storage settings, found the way the running app finds them:
 * the environment, the host's `.env`, then the `cms:` options of nuxt.config
 * (`loadSettings` of backup.ts — the same code `tinyzoo backup` uses).
 */
export async function hostSettings(cwd: string, env: Record<string, string | undefined> = process.env) {
  return loadSettings(cwd, env as NodeJS.ProcessEnv)
}

/**
 * Storage the way the server resolves it (server/utils/cmsStorage.ts): the driver and
 * its settings from `NUXT_CMS_STORAGE_*` or the `cms.storage` options, defaulting to the
 * host's `.cms-uploads` folder. Keep the two in step (key layout, URLs).
 */
export function storageFromSettings(storage: StorageSettings, override: { dir?: string; cwd?: string } = {}): TransferStorage {
  const driver = storage.driver
  if (driver === 'local') {
    const dir = override.dir ? resolve(override.cwd ?? process.cwd(), override.dir) : storage.localDir
    return localStorageAt(dir, (storage.localPublicBase || '/api/cms/_media/raw').replace(/\/$/, ''))
  }
  if (driver === 's3' || driver === 'r2') {
    const s = { ...storage.s3, publicBaseUrl: storage.s3.publicBaseUrl || undefined, appBase: storage.localPublicBase }
    const missing = (['endpoint', 'bucket', 'accessKeyId', 'secretAccessKey'] as const).filter((k) => !s[k])
    if (missing.length) throw new Error(`Storage driver '${driver}' is missing ${missing.join(', ')} (set NUXT_CMS_STORAGE_S3_* in the environment, the host's .env, or cms.storage.s3 in nuxt.config).`)
    return s3Storage({ ...s, delivery: resolveS3Delivery(s.delivery, s.publicBaseUrl) })
  }
  throw new Error(`Unknown storage driver '${driver}' (NUXT_CMS_STORAGE_DRIVER is 'local', 's3' or 'r2').`)
}

/** Settings from the environment and module options as plain data (for tests and `hostSettings`). */
export function storageFromEnv(cwd: string, env: Record<string, string | undefined> = process.env, override: { dir?: string } = {}, cms: unknown = {}): TransferStorage {
  return storageFromSettings(settingsFrom(cwd, env as NodeJS.ProcessEnv, cms).storage, { ...override, cwd })
}

export function localStorageAt(dir: string, publicBase = '/api/cms/_media/raw'): TransferStorage {
  const pathFor = (key: string) => {
    const abs = resolve(dir, key)
    if (!abs.startsWith(dir + sep)) throw new Error(`Invalid storage key: ${key}`)
    return abs
  }
  return {
    describe: `the folder ${dir}`,
    // Another machine's folder with the same path is not the same files.
    identity: `local:${hostname()}:${dir}`,
    async get(key) {
      try { return await (await import('node:fs/promises')).readFile(pathFor(key)) }
      catch { return null }
    },
    async put(key, body) {
      const { mkdir, writeFile } = await import('node:fs/promises')
      const abs = pathFor(key)
      await mkdir(resolve(abs, '..'), { recursive: true })
      await writeFile(abs, body)
    },
    url: (key) => `${publicBase}/${key}`,
  }
}

function s3Storage(cfg: { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string; publicBaseUrl?: string; delivery: 'public' | 'proxy' | 'redirect'; appBase?: string }): TransferStorage {
  let client: any
  const getClient = async () => {
    if (!client) {
      const { AwsClient } = await import('aws4fetch')
      client = new AwsClient({ accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, region: cfg.region, service: 's3' })
    }
    return client
  }
  const encode = encodeStorageKey
  const objectUrl = (key: string) => `${cfg.endpoint.replace(/\/$/, '')}/${cfg.bucket}/${encode(key)}`
  return {
    describe: `the bucket ${cfg.bucket}`,
    identity: `s3:${cfg.endpoint.replace(/\/$/, '').toLowerCase()}/${cfg.bucket}`,
    async get(key) {
      const res = await (await getClient()).fetch(objectUrl(key))
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`Could not read ${key} from the bucket (${res.status} ${res.statusText})`)
      return Buffer.from(await res.arrayBuffer())
    },
    async put(key, body, contentType) {
      const res = await (await getClient()).fetch(objectUrl(key), { method: 'PUT', body: new Uint8Array(body), headers: { 'content-type': contentType } })
      if (!res.ok) throw new Error(`Could not write ${key} to the bucket (${res.status} ${res.statusText})`)
    },
    // What the running app stores for a new upload: the bucket's own address under `public`, the app's path otherwise.
    url: (key) => storedMediaUrl(cfg, key),
  }
}

// ── command line ────────────────────────────────────────────────────────────────

export interface ParsedArgs {
  positional: string[]
  values: Record<string, string>
  flags: Set<string>
}

/** `--flag`, `--name value` / `--name=value`, and positional words. Unknown flags are an error. */
export function parseArgs(argv: string[], valueFlags: string[], boolFlags: string[]): ParsedArgs {
  const out: ParsedArgs = { positional: [], values: {}, flags: new Set() }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (!arg.startsWith('--')) { out.positional.push(arg); continue }
    const [name, inline] = arg.slice(2).split(/=(.*)/s, 2) as [string, string | undefined]
    if (valueFlags.includes(name)) {
      const value = inline ?? argv[++i]
      if (value === undefined || value.startsWith('--')) throw new Error(`--${name} needs a value`)
      out.values[name] = value
    }
    else if (boolFlags.includes(name)) out.flags.add(name)
    else throw new Error(`Unknown option --${name}`)
  }
  return out
}

/** The tinyzoo version, from the package this file ships in. */
export function tinyzooVersion(): string {
  try { return JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'package.json'), 'utf8')).version as string }
  catch { return 'unknown' }
}

/** What a command line run does with a failure: one clear line, a non-zero exit. */
export function reportFailure(err: unknown): void {
  console.error(`✗ ${err instanceof Error ? err.message : String(err)}`)
  process.exitCode = 1
}
