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
 *                         "fields": { "title": "…", "body": {…} } } ],
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
import { createReadStream, createWriteStream, existsSync, readFileSync, type WriteStream } from 'node:fs'
import { once } from 'node:events'
import { join, resolve, sep } from 'node:path'
import { createInterface } from 'node:readline'
import { getTableColumns } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { mediaIdsInBlocks, propOf, type CmsEntity, type CmsRegistry, type Junction } from '../src/index'

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
  media: { rows: number; included: boolean; files: number; missing: number }
  revisions: { included: boolean; rows: number }
}

// ── the content model: shape, fingerprint, differences ─────────────────────────

export interface FieldShape {
  type: string
  localized?: true
  relation?: { to: string; kind: string }
  values?: string[]
  blocks?: Record<string, Record<string, FieldShape>>
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
    shape.blocks = Object.fromEntries(Object.entries(fld.blocks as Record<string, any>).map(([type, def]) => [
      type,
      Object.fromEntries(Object.entries(def.fields as Record<string, any>).map(([k, f]) => [k, fieldShape(f)])),
    ]))
  }
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

function diffBlocks(path: string, a: FieldShape['blocks'], b: FieldShape['blocks'], entity: string, field: string, out: Difference[]) {
  const mk = (message: string): Difference => ({ scope: 'blocks', entity, field, message: `${path}: ${message}`, skip: false })
  const A = a ?? {}
  const B = b ?? {}
  for (const type of Object.keys(A)) if (!B[type]) out.push(mk(`block "${type}" is in the archive but no longer exists here`))
  for (const type of Object.keys(B)) if (!A[type]) out.push(mk(`block "${type}" is new here (the archive has none)`))
  for (const type of Object.keys(A)) {
    const fa = A[type]
    const fb = B[type]
    if (!fa || !fb) continue
    for (const k of Object.keys(fa)) {
      if (!fb[k]) out.push(mk(`"${type}.${k}" is in the archive but no longer exists here`))
      else if (canonicalJson(fa[k]) !== canonicalJson(fb[k])) out.push(mk(`"${type}.${k}" has changed (${describeChange(fa[k]!, fb[k]!)})`))
    }
    for (const k of Object.keys(fb)) if (!fa[k]) out.push(mk(`"${type}.${k}" is new here`))
  }
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
        else diffBlocks(at, fa.blocks, fb.blocks, name, key, out)
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
  translations: { id: string; locale: string; createdAt: string; updatedAt: string; fields: Record<string, unknown> }[]
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

/** Read the host's `.env` into `env` (what is already set wins), as `nuxt dev` does. */
export function loadDotEnv(cwd: string, env: Record<string, string | undefined> = process.env): void {
  const file = join(cwd, '.env')
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
    if (!m || line.trim().startsWith('#')) continue
    let value = m[2]!
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    else value = value.replace(/\s+#.*$/, '')
    if (env[m[1]!] === undefined) env[m[1]!] = value
  }
}

/** The database the server would use: NUXT_CMS_DATABASE_URL, else DATABASE_URL. */
export function databaseUrlFromEnv(env: Record<string, string | undefined> = process.env): string | null {
  return env.NUXT_CMS_DATABASE_URL || env.DATABASE_URL || null
}

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
  get(key: string): Promise<Buffer | null>
  put(key: string, body: Buffer, contentType: string): Promise<void>
  url(key: string): string
}

/**
 * Storage the way the server resolves it (server/utils/cmsStorage.ts): the driver and
 * its settings from `NUXT_CMS_STORAGE_*`, defaulting to the host's `.cms-uploads`
 * folder. Keep the two in step (key layout, URLs).
 */
export function storageFromEnv(cwd: string, env: Record<string, string | undefined> = process.env, override: { dir?: string } = {}): TransferStorage {
  const driver = env.NUXT_CMS_STORAGE_DRIVER || 'local'
  if (driver === 'local') {
    const dir = resolve(cwd, override.dir || env.NUXT_CMS_STORAGE_LOCAL_DIR || '.cms-uploads')
    const base = (env.NUXT_CMS_STORAGE_LOCAL_PUBLIC_BASE || '/api/cms/_media/raw').replace(/\/$/, '')
    return localStorageAt(dir, base)
  }
  if (driver === 's3' || driver === 'r2') {
    const s = {
      endpoint: env.NUXT_CMS_STORAGE_S3_ENDPOINT,
      region: env.NUXT_CMS_STORAGE_S3_REGION || (driver === 'r2' ? 'auto' : 'us-east-1'),
      bucket: env.NUXT_CMS_STORAGE_S3_BUCKET,
      accessKeyId: env.NUXT_CMS_STORAGE_S3_ACCESS_KEY_ID,
      secretAccessKey: env.NUXT_CMS_STORAGE_S3_SECRET_ACCESS_KEY,
      publicBaseUrl: env.NUXT_CMS_STORAGE_S3_PUBLIC_BASE_URL,
    }
    const missing = (['endpoint', 'bucket', 'accessKeyId', 'secretAccessKey'] as const).filter((k) => !s[k])
    if (missing.length) throw new Error(`Storage driver '${driver}' is missing ${missing.join(', ')} (set NUXT_CMS_STORAGE_S3_* in the environment or the host's .env).`)
    return s3Storage(s as Parameters<typeof s3Storage>[0])
  }
  throw new Error(`Unknown storage driver '${driver}' (NUXT_CMS_STORAGE_DRIVER is 'local', 's3' or 'r2').`)
}

export function localStorageAt(dir: string, publicBase = '/api/cms/_media/raw'): TransferStorage {
  const pathFor = (key: string) => {
    const abs = resolve(dir, key)
    if (!abs.startsWith(dir + sep)) throw new Error(`Invalid storage key: ${key}`)
    return abs
  }
  return {
    describe: `the folder ${dir}`,
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

function s3Storage(cfg: { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string; publicBaseUrl?: string }): TransferStorage {
  let client: any
  const getClient = async () => {
    if (!client) {
      const { AwsClient } = await import('aws4fetch')
      client = new AwsClient({ accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, region: cfg.region, service: 's3' })
    }
    return client
  }
  const encode = (key: string) => key.split('/').map(encodeURIComponent).join('/')
  const objectUrl = (key: string) => `${cfg.endpoint.replace(/\/$/, '')}/${cfg.bucket}/${encode(key)}`
  return {
    describe: `the bucket ${cfg.bucket}`,
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
    url: (key) => `${(cfg.publicBaseUrl?.replace(/\/$/, '') || `${cfg.endpoint.replace(/\/$/, '')}/${cfg.bucket}`)}/${encode(key)}`,
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
