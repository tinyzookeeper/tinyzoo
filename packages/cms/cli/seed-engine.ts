/**
 * The seed runner's core: what `s.create`, `s.upsert`, `s.translate`, `s.global` and
 * `s.upload` do, written against a small `SeedBackend` (reads, writes, uploads) so it is
 * the same logic whether the backend talks to a site over HTTP (`tinyzoo seed`, see
 * seed.ts) or is a fake in a test.
 *
 * Rules the whole thing rests on:
 *
 *  - An entry is recognised by a KEY (`by`: the address field by default). The entry's
 *    list is read once per entity; a key that is found is the same entry as last time.
 *  - Nothing is written that is already there. Before any update the stored values are
 *    read and compared with the seed's (`changedKeys`): only keys the seed gives are
 *    compared, extras the server added (a block's `v`, defaults) are ignored. A second run
 *    therefore makes no request that changes anything, and no new saved version appears.
 *  - Blocks and list items need an `id`; the seed may leave it out, and a stable one is
 *    made from where the block sits, so the same seed gives the same ids on every run.
 *  - With `apply: false` nothing is written (a dry run, and the scan `--reset` uses to
 *    learn which entries the seed owns); entries and files that do not exist yet get
 *    placeholder ids.
 *  - A link to an entry (`s.link`) is stored as the reference the admin's link picker
 *    stores (`cms:<entity>/<id>`), so a menu follows its page when the page is renamed
 *    or moved; only a placeholder id (a dry run) gets a readable address.
 *  - The seed owns an entry only when it can show it made it: created by the account the
 *    seed signs in with (and, for `s.create`, not changed by anybody else since), see
 *    `ownedBySeed`. `--reset` deletes owned entries only.
 */
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, extname, resolve } from 'node:path'
import { holdsLinks, linkFieldsOf, linkRef, linkRefsOf, mapFieldLinks, parseLinkRef, sitePath, type CmsEntity, type CmsRegistry } from '../src/index'
import { richBuilders, type SeedContext, type SeedDefinition, type SeedEntry, type SeedLink, type SeedLinkOptions, type SeedUploadOptions } from '../src/seed'

export type Row = Record<string, any>

export interface MediaRow {
  id: string
  name: string | null
  folder: string | null
  mime: string
  size: number
  url: string
  alt: string | null
  altLocales: Record<string, string> | null
  focalX: number | null
  focalY: number | null
}

export interface UploadRequest {
  name: string
  mime: string
  data: Uint8Array
  folder: string | null
  library: boolean
}

/** What the engine needs from a site. Reads give the shapes the admin gets (relations as ids). */
export interface SeedBackend {
  /** The id of the account the seed signs in as (null: unknown, so no entry can be shown to be the seed's own). */
  account(): Promise<string | null>
  /** Every entry of a collection (its own columns, `id` included). */
  list(entity: string): Promise<Row[]>
  /** One entry as the editor form gets it; in a translation language, its translated values (`__translated` says whether there are any). */
  get(entity: string, id: string, locale?: string): Promise<Row | null>
  create(entity: string, data: Row): Promise<Row>
  update(entity: string, id: string, data: Row, locale?: string): Promise<Row>
  remove(entity: string, id: string): Promise<void>
  getGlobal(entity: string, locale?: string): Promise<Row | null>
  putGlobal(entity: string, data: Row, locale?: string): Promise<Row>
  /** The library file with this name, folder, size and type, if there is one. */
  findMedia(query: { name: string; folder: string | null; size: number; mime: string }): Promise<MediaRow | null>
  uploadMedia(file: UploadRequest): Promise<MediaRow>
  patchMedia(id: string, details: { alt?: string | null; altLocales?: Record<string, string> | null; focal?: { x: number; y: number } | null }): Promise<MediaRow>
  removeMedia(id: string): Promise<void>
}

export type SeedAction = 'created' | 'updated' | 'unchanged' | 'kept' | 'uploaded'

export interface SeedOp {
  action: SeedAction
  kind: 'entry' | 'translation' | 'global' | 'media'
  /** Entity name (not for media). */
  entity?: string
  /** What a person calls it: `page home`, `news hello (en)`, `desk.jpg`. */
  label: string
  /** The keys that differ, for an update. */
  fields?: string[]
}

/**
 * What the seed owns on the site, in the order the seed declared it: entries found by key
 * that the seed made (see `ownedBySeed`), and files found by name. Entries found by key
 * that the seed did not make are `foreign`: `--reset` leaves them alone. A global cannot
 * be deleted, the seed overwrites it; the ones it writes are `globals` (a menu of the seed
 * is emptied of links to pages that are about to go).
 */
export interface SeedDeclared {
  entries: { entity: string; id: string; label: string }[]
  media: { id: string; label: string }[]
  foreign: { entity: string; id: string; label: string; why: string }[]
  globals: { entity: string; label: string }[]
}

export interface SeedRunOptions {
  reg: CmsRegistry
  backend: SeedBackend
  /** Seed file paths are relative to this folder (the site's root). */
  root: string
  /** False: read and plan only, write nothing. */
  apply: boolean
  /** Called for every step as it happens. */
  onOp?: (op: SeedOp) => void
  /** Reads an uploaded file; default: the disk. */
  readFile?: (path: string) => Promise<Uint8Array>
}

export interface SeedRunResult {
  ops: SeedOp[]
  declared: SeedDeclared
}

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.pdf': 'application/pdf',
}

const PLAN = 'plan:'
export const isPlaceholder = (id: string) => id.startsWith(PLAN)

/** A short stable id for a block or list item, from where it sits. */
export function stableId(scope: string): string {
  return createHash('sha1').update(scope).digest('base64url').slice(0, 10)
}

// ── comparing what is stored with what the seed says ───────────────────────────

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

function sameInstant(a: unknown, b: unknown): boolean | null {
  const asTime = (v: unknown) => (v instanceof Date ? v.getTime() : typeof v === 'string' && ISO.test(v) ? Date.parse(v) : null)
  const ta = asTime(a)
  const tb = asTime(b)
  return ta === null || tb === null ? null : ta === tb
}

/**
 * Does `stored` already say what `wanted` says? Only what the seed gives counts: an
 * object is covered when every key of `wanted` is, extras in `stored` do not matter
 * (the server adds `v` to blocks and fills defaults); an empty value (null, '', [])
 * is covered by anything empty; arrays match item by item; dates by the instant;
 * single-line text after the trimming the server does.
 */
export function covers(stored: unknown, wanted: unknown): boolean {
  if (wanted === undefined) return true
  if (wanted === null || wanted === '' || (Array.isArray(wanted) && wanted.length === 0)) {
    return stored === null || stored === undefined || stored === '' || (Array.isArray(stored) && stored.length === 0)
  }
  const instant = sameInstant(stored, wanted)
  if (instant !== null) return instant
  if (Array.isArray(wanted)) {
    return Array.isArray(stored) && stored.length === wanted.length && wanted.every((w, i) => covers(stored[i], w))
  }
  if (typeof wanted === 'object') {
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return false
    return Object.entries(wanted as Row).every(([k, v]) => covers((stored as Row)[k], v))
  }
  if (typeof wanted === 'string' && typeof stored === 'string') {
    // A reference to an entry is the same wherever it is spelled (the id's case).
    const a = parseLinkRef(stored)
    const b = parseLinkRef(wanted)
    if (a && b) return a.entity === b.entity && a.id === b.id
    return stored === wanted || stored === wanted.trim()
  }
  return stored === wanted
}

/** The keys of `wanted` whose stored value differs (`many-to-many` lists compare as sets). */
export function changedKeys(stored: Row | null | undefined, wanted: Row, setKeys: ReadonlySet<string> = new Set()): string[] {
  if (!stored) return Object.keys(wanted)
  return Object.keys(wanted).filter((k) => {
    const w = wanted[k]
    if (setKeys.has(k) && Array.isArray(w) && Array.isArray(stored[k])) {
      return !(w.length === stored[k].length && new Set(w).size === new Set(stored[k]).size && w.every((x) => stored[k].includes(x)))
    }
    return !covers(stored[k], w)
  })
}

// ── preparing the seed's values ────────────────────────────────────────────────

const isEntryRef = (v: any): v is SeedEntry => !!v && typeof v === 'object' && typeof v.id === 'string' && typeof v.entity === 'string' && 'existed' in v && 'translations' in v

/** Plain JSON: dates as ISO strings, entries (given where an id is wanted) as their id. */
function jsonSafe(v: any): any {
  if (v === undefined) return undefined
  if (v instanceof Date) return v.toISOString()
  if (isEntryRef(v)) return v.id
  if (Array.isArray(v)) return v.map((x) => jsonSafe(x) ?? null)
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, jsonSafe(x)]))
  }
  return v
}

/** Give every block and list item an `id` (and a single-type list its `type`), recursively through block fields. */
function withBlockIds(fld: any, value: unknown, scope: string): unknown {
  if (!Array.isArray(value)) return value
  const types = Object.keys(fld.blocks ?? {})
  const seen = new Set<string>()
  return value.map((raw, i) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw
    const block: Row = { ...raw }
    if (!block.type && types.length === 1) block.type = types[0]
    if (typeof block.id !== 'string' || !block.id || seen.has(block.id)) block.id = stableId(`${scope}/${i}/${block.type}/${block.id ?? ''}`)
    seen.add(block.id)
    const def = fld.blocks?.[block.type]
    if (def) {
      for (const [k, sub] of Object.entries<any>(def.fields)) {
        if (sub.type === 'blocks' && Array.isArray(block[k])) block[k] = withBlockIds(sub, block[k], `${scope}/${i}/${k}`)
      }
    }
    return block
  })
}

/** Can a link point at an entry of this collection? (The server's rule: public, with an address on the website.) */
const isLinkable = (e: CmsEntity) => !e.singleton && !!e.content?.public && !!e.content?.path

const describe = (key: Record<string, string>) => Object.values(key).join(' / ')

export class SeedError extends Error {}

/** Run a seed definition against a backend. */
export async function runSeed(def: SeedDefinition, o: SeedRunOptions): Promise<SeedRunResult> {
  const { reg, backend, apply } = o
  const read = o.readFile ?? (async (p: string) => new Uint8Array(await readFile(p)))
  const ops: SeedOp[] = []
  const declared: SeedDeclared = { entries: [], media: [], foreign: [], globals: [] }
  const lists = new Map<string, Promise<Row[]>>()
  const handled = new Map<string, SeedEntry>()
  const modes = new WeakMap<SeedEntry, 'create' | 'upsert'>()
  const uploads = new Map<string, string>()
  const mediaInfo = new Map<string, { url: string }>()
  let placeholders = 0

  const note = (op: SeedOp) => { ops.push(op); o.onOp?.(op) }
  let account: Promise<string | null> | undefined
  const me = () => (account ??= backend.account().catch(() => null))

  /**
   * Did the seed make this entry (so `--reset` may delete it)? Only an entry the seed's own
   * account created counts: a page an editor made with the same slug is not the seed's, and
   * neither is an entry made before the seed ran. After `s.create` the entry must also be
   * untouched by anybody else (an editor's change is theirs, `create` leaves it alone);
   * `s.upsert` takes the entry over, so later edits do not matter. Null: it is the seed's.
   */
  async function notOwned(row: Row, mode: 'create' | 'upsert'): Promise<string | null> {
    const user = await me()
    if (!user || !row.createdBy || row.createdBy !== user) return 'not made by the account the seed signs in with'
    if (mode === 'create' && row.updatedBy && row.updatedBy !== user) return 'changed by someone else since'
    return null
  }
  const locales = reg.locales
  const defaultLocale = locales?.default ?? null

  /** Wrap a failure with what the seed was doing. */
  async function doing<T>(what: string, fn: () => Promise<T>): Promise<T> {
    try { return await fn() }
    catch (err) {
      if (err instanceof SeedError) throw err
      throw new SeedError(`${what}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  function entityOf(arg: unknown): CmsEntity {
    const name = typeof arg === 'string' ? arg : (arg as any)?.name
    const e = typeof name === 'string' ? reg.byName.get(name) : undefined
    if (!e) {
      throw new SeedError(`No content called ${JSON.stringify(typeof arg === 'string' ? arg : name)} in cms.config.ts (there is ${reg.entities.map((x) => x.name).join(', ')}).`)
    }
    return e
  }

  const listOf = (e: CmsEntity) => {
    let p = lists.get(e.name)
    if (!p) { p = backend.list(e.name); lists.set(e.name, p) }
    return p
  }

  function keyFields(e: CmsEntity, by: string | string[] | undefined): string[] {
    // Default key: the address field (`content.slug`), else the only slug field.
    const slugs = Object.keys(e.fields).filter((k) => e.fields[k]!.type === 'slug')
    const fields = by === undefined ? (e.content?.slug ? [e.content.slug] : slugs.length === 1 ? slugs : []) : Array.isArray(by) ? by : [by]
    if (!fields.length) {
      throw new SeedError(`${e.name}: tell the seed how to recognise this entry on a second run: { by: 'field' } (a field that is different for every entry, such as ${Object.keys(e.fields).find((k) => e.fields[k]!.isUnique) ?? e.titleField}).`)
    }
    for (const k of fields) {
      const fld = e.fields[k]
      if (!fld) throw new SeedError(`${e.name}: "by" names ${JSON.stringify(k)}, which is not a field (fields: ${Object.keys(e.fields).join(', ')}).`)
      if (fld.relation || ['blocks', 'richtext', 'media', 'gallery'].includes(fld.type)) {
        throw new SeedError(`${e.name}: "${k}" cannot be a key (it is ${fld.relation ? 'a relation' : fld.type}); use a text, address, number or choice field.`)
      }
    }
    return fields
  }

  function checkFields(e: CmsEntity, data: Row, what: string) {
    for (const k of Object.keys(data)) {
      const fld = e.fields[k]
      if (!fld) throw new SeedError(`${what}: ${e.name} has no field "${k}" (fields: ${Object.keys(e.fields).join(', ')}).`)
      if (fld.relation?.kind === 'one-to-many') throw new SeedError(`${what}: "${k}" is the other side of a relation; set it on the entries that point here.`)
    }
  }

  function prepare(e: CmsEntity, data: Row, scope: string, what: string, only?: string[]): Row {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new SeedError(`${what}: expected an object of values.`)
    const out = jsonSafe(data) as Row
    checkFields(e, out, what)
    for (const k of Object.keys(out)) {
      if (only && !only.includes(k)) continue
      const fld = e.fields[k]!
      if (fld.type === 'blocks') out[k] = withBlockIds(fld, out[k], `${scope}/${k}`)
    }
    return out
  }

  const setKeysOf = (e: CmsEntity) => new Set(Object.entries(e.fields).filter(([, f]) => f.relation?.kind === 'many-to-many').map(([k]) => k))
  const planId = (e: string) => `${PLAN}${e}:${++placeholders}`

  async function find(e: CmsEntity, key: Record<string, string>): Promise<Row | null> {
    const rows = (await listOf(e)).filter((r) => Object.entries(key).every(([k, v]) => String(r[k] ?? '') === v))
    if (rows.length > 1) throw new SeedError(`${e.name} ${describe(key)}: ${rows.length} entries have this key; the seed cannot tell which is meant.`)
    return rows[0] ?? null
  }

  async function write(mode: 'create' | 'upsert', arg: unknown, data: Row, opts: { by?: string | string[]; translations?: Record<string, Row> } = {}): Promise<SeedEntry> {
    const e = entityOf(arg)
    if (e.singleton) throw new SeedError(`${e.name} is a global: use s.global(${JSON.stringify(e.name)}, { … }).`)
    const fields = keyFields(e, opts.by)
    const key: Record<string, string> = {}
    for (const k of fields) {
      const v = (data as Row)?.[k]
      if (v === undefined || v === null || v === '') throw new SeedError(`${e.name}: the key field "${k}" needs a value in the seed.`)
      key[k] = String(v)
    }
    const label = `${e.name} ${describe(key)}`
    const hash = `${e.name}\0${JSON.stringify(key)}`
    if (handled.has(hash)) throw new SeedError(`${label} is in the seed twice.`)
    const wanted = prepare(e, data, `${e.name}/${describe(key)}`, label)
    for (const k of fields) wanted[k] = (data as Row)[k] // as given (a number key stays a number)

    const entry = await doing(label, async (): Promise<SeedEntry> => {
      const existing = await find(e, key)
      if (!existing) {
        const row = apply ? await backend.create(e.name, wanted) : { id: planId(e.name) }
        if (apply) (await listOf(e)).push(row)
        else (await listOf(e)).push({ ...wanted, id: row.id })
        note({ action: 'created', kind: 'entry', entity: e.name, label })
        return { kind: 'entry', entity: e.name, id: row.id, key, existed: false, data: { ...wanted }, translations: {} }
      }
      if (!isPlaceholder(existing.id)) {
        const why = await notOwned(existing, mode)
        if (why) declared.foreign.push({ entity: e.name, id: existing.id, label, why })
        else declared.entries.push({ entity: e.name, id: existing.id, label })
      }
      if (mode === 'create') {
        note({ action: 'kept', kind: 'entry', entity: e.name, label })
        return { kind: 'entry', entity: e.name, id: existing.id, key, existed: true, data: { ...existing, ...wanted }, translations: {} }
      }
      const stored = isPlaceholder(existing.id) ? null : await backend.get(e.name, existing.id)
      const changed = changedKeys(stored, wanted, setKeysOf(e))
      if (!changed.length && stored) note({ action: 'unchanged', kind: 'entry', entity: e.name, label })
      else {
        if (apply) await backend.update(e.name, existing.id, wanted)
        note({ action: 'updated', kind: 'entry', entity: e.name, label, fields: changed })
      }
      return { kind: 'entry', entity: e.name, id: existing.id, key, existed: true, data: { ...stored, ...wanted }, translations: {} }
    })
    modes.set(entry, mode)
    handled.set(hash, entry)
    for (const [locale, tr] of Object.entries(opts.translations ?? {})) await translate(entry, locale, tr)
    return entry
  }

  async function translate(entry: SeedEntry, locale: string, data: Row): Promise<void> {
    const e = entityOf(entry.entity)
    const label = `${e.name}${entry.kind === 'entry' ? ` ${describe(entry.key)}` : ''} (${locale})`
    if (!locales) throw new SeedError(`${label}: the site has no languages (defineLocales in cms.config.ts).`)
    if (locale === defaultLocale) throw new SeedError(`${label}: ${locale} is the default language; give those values to s.create / s.upsert / s.global itself.`)
    if (!locales.locales.includes(locale)) throw new SeedError(`${label}: ${locale} is not one of the site's languages (${locales.locales.join(', ')}).`)
    if (!e.localized.length) throw new SeedError(`${e.name} has nothing to translate (no field is .localized()).`)
    // With publish.perLocale a language also has a state of its own: the entry's status and publish date, said per language.
    const stateKeys = e.publish?.perLocale ? [e.publish.field, ...(e.publish.dateField ? [e.publish.dateField] : [])] : []
    const wrong = Object.keys(data ?? {}).filter((k) => !e.localized.includes(k) && !stateKeys.includes(k))
    if (wrong.length) throw new SeedError(`${label}: ${wrong.join(', ')} ${wrong.length > 1 ? 'are' : 'is'} not translated per language; translatable fields: ${[...e.localized, ...stateKeys].join(', ')}.`)
    const scope = `${e.name}/${entry.kind === 'entry' ? describe(entry.key) : '-'}/${locale}`
    const wanted = prepare(e, data, scope, label)
    await doing(label, async () => {
      const stored = isPlaceholder(entry.id) ? null
        : entry.kind === 'global' ? await backend.getGlobal(e.name, locale) : await backend.get(e.name, entry.id, locale)
      const translated = !!stored?.__translated
      if (modes.get(entry) === 'create' && translated) {
        note({ action: 'kept', kind: 'translation', entity: e.name, label })
        return
      }
      // A language that follows the default one has no state of its own yet: what the seed says about it is a change,
      // even where the state it follows is the same. A language with a state but no text is a row the seed may fill in.
      const known = translated || !!stored?.__stateOwn
      const compared = known && stored ? { ...stored } : null
      if (compared && !stored!.__stateOwn) for (const k of stateKeys) delete compared[k]
      const changed = changedKeys(compared, wanted)
      if (!changed.length) { note({ action: 'unchanged', kind: 'translation', entity: e.name, label }); return }
      if (apply) {
        if (entry.kind === 'global') await backend.putGlobal(e.name, wanted, locale)
        else {
          // A seed's translation is content as it should be: one without a state of its own follows the default language
          // (a first translation written through the API otherwise starts as being translated: not on the website yet).
          const follows = !!e.publish?.perLocale && !known && !stateKeys.some((k) => k in wanted)
          await backend.update(e.name, entry.id, follows ? { ...wanted, [e.publish!.field]: null } : wanted, locale)
        }
      }
      note({ action: translated ? 'updated' : 'created', kind: 'translation', entity: e.name, label, fields: changed })
    })
    ;(entry.translations as Record<string, Row>)[locale] = wanted
  }

  async function global(arg: unknown, data: Row, opts: { translations?: Record<string, Row>; ifMissing?: boolean } = {}): Promise<SeedEntry> {
    const e = entityOf(arg)
    if (!e.singleton) throw new SeedError(`${e.name} is a collection: use s.create / s.upsert.`)
    const label = `${e.name}`
    if (handled.has(e.name)) throw new SeedError(`${label} is in the seed twice.`)
    const wanted = prepare(e, data, e.name, label)
    if (!opts.ifMissing) declared.globals.push({ entity: e.name, label })
    const entry = await doing(label, async (): Promise<SeedEntry> => {
      const stored = await backend.getGlobal(e.name)
      const id = stored?.id ?? (apply ? '' : planId(e.name))
      if (stored && opts.ifMissing) {
        note({ action: 'kept', kind: 'global', entity: e.name, label })
        return { kind: 'global', entity: e.name, id: stored.id, key: {}, existed: true, data: { ...stored, ...wanted }, translations: {} }
      }
      const changed = changedKeys(stored, wanted, setKeysOf(e))
      if (stored && !changed.length) note({ action: 'unchanged', kind: 'global', entity: e.name, label })
      else {
        const saved = apply ? await backend.putGlobal(e.name, wanted) : null
        note({ action: stored ? 'updated' : 'created', kind: 'global', entity: e.name, label, fields: changed })
        return { kind: 'global', entity: e.name, id: saved?.id ?? id, key: {}, existed: !!stored, data: { ...stored, ...wanted }, translations: {} }
      }
      return { kind: 'global', entity: e.name, id, key: {}, existed: true, data: { ...stored, ...wanted }, translations: {} }
    })
    modes.set(entry, opts.ifMissing ? 'create' : 'upsert')
    handled.set(e.name, entry)
    for (const [locale, tr] of Object.entries(opts.translations ?? {})) await translate(entry, locale, tr)
    return entry
  }

  async function upload(file: string, opts: SeedUploadOptions = {}): Promise<string> {
    const path = resolve(o.root, file)
    const name = opts.name ?? basename(path)
    const folder = opts.folder ?? null
    const cacheKey = `${path}\0${name}\0${folder}`
    const cached = uploads.get(cacheKey)
    if (cached) return cached
    const mime = opts.mime ?? MIME[extname(path).toLowerCase()]
    if (!mime) throw new SeedError(`${file}: cannot tell the file type from its name; pass { mime: 'image/jpeg' }.`)
    const label = file
    return doing(label, async () => {
      let data: Uint8Array
      try { data = await read(path) }
      catch { throw new SeedError(`${file}: no such file (looked for ${path}).`) }
      const found = await backend.findMedia({ name, folder, size: data.byteLength, mime })
      const details: Parameters<SeedBackend['patchMedia']>[1] = {}
      if (found) {
        if (opts.alt !== undefined && (found.alt ?? '') !== opts.alt) details.alt = opts.alt
        if (opts.altLocales && !covers(found.altLocales, opts.altLocales)) details.altLocales = opts.altLocales
        if (opts.focal && (found.focalX !== Math.round(opts.focal.x) || found.focalY !== Math.round(opts.focal.y))) details.focal = opts.focal
        declared.media.push({ id: found.id, label })
        if (Object.keys(details).length) {
          if (apply) await backend.patchMedia(found.id, details)
          note({ action: 'updated', kind: 'media', label, fields: Object.keys(details) })
        }
        else note({ action: 'unchanged', kind: 'media', label })
        uploads.set(cacheKey, found.id)
        mediaInfo.set(found.id, { url: found.url })
        return found.id
      }
      let row: MediaRow | null = null
      if (apply) {
        row = await backend.uploadMedia({ name, mime, data, folder, library: opts.library ?? true })
        const extra: Parameters<SeedBackend['patchMedia']>[1] = {}
        if (opts.alt !== undefined) extra.alt = opts.alt
        if (opts.altLocales) extra.altLocales = opts.altLocales
        if (opts.focal) extra.focal = opts.focal
        if (Object.keys(extra).length) row = await backend.patchMedia(row.id, extra)
      }
      const id = row?.id ?? planId('media')
      note({ action: 'uploaded', kind: 'media', label })
      uploads.set(cacheKey, id)
      mediaInfo.set(id, { url: row?.url ?? `/plan/${name}` })
      return id
    })
  }

  function link(label: string, to: string | SeedEntry, opts: SeedLinkOptions = {}): SeedLink {
    let url: string
    if (typeof to === 'string') url = to
    else {
      const e = entityOf(to.entity)
      if (!e.content?.path) throw new SeedError(`s.link(${JSON.stringify(label)}): ${e.name} has no address on the website (content.path in cms.config.ts); pass an address instead.`)
      // A page the website can link to is stored as a reference, as the admin's link picker
      // does: the link follows the page (renamed, moved under another page, translated).
      const ref = linkRef(e.name, to.id)
      if (isLinkable(e) && !isPlaceholder(to.id) && parseLinkRef(ref)) url = ref
      else {
        // Nothing to refer to yet (a dry run plans an entry without an id), or an entity the
        // website does not link to: a readable address, worked out here.
        const locale = opts.locale ?? defaultLocale
        const values = { ...to.data, ...(locale && locale !== defaultLocale ? to.translations[locale] : {}) }
        const address = sitePath(locales, e.content.path, locale, values)
        if (!address) throw new SeedError(`s.link(${JSON.stringify(label)}): ${e.name} has no address on the website${locale ? ` in ${locale}` : ''} (a value for each :placeholder of content.path); pass an address instead.`)
        url = address
      }
    }
    return { id: stableId(`link/${label}/${url}`), type: 'link', label, url, newTab: opts.newTab ?? false, sub: opts.sub ?? false }
  }

  const s: SeedContext = {
    create: ((entity: unknown, data: Row, opts?: any) => write('create', entity, data, opts)) as SeedContext['create'],
    upsert: ((entity: unknown, data: Row, opts?: any) => write('upsert', entity, data, opts)) as SeedContext['upsert'],
    translate: (entry, locale, data) => translate(entry, locale, data),
    global: ((entity: unknown, data: Row, opts?: any) => global(entity, data, opts)) as SeedContext['global'],
    upload,
    link,
    rich: richBuilders((id) => mediaInfo.get(id)?.url ?? ''),
    locales: locales ? [locales.default, ...locales.locales.filter((l) => l !== locales.default)] : [],
  }
  await def.run(s)
  return { ops, declared }
}

// ── --reset ─────────────────────────────────────────────────────────────────────

export interface ResetPlan {
  /** What goes, in the order to delete it: an entry that links to or points at another goes before it. */
  entries: { entity: string; id: string; label: string }[]
  media: { id: string; label: string }[]
  /** Globals of the seed that link to entries about to go: saved first without those links (the seed writes them again afterwards). */
  clear: { entity: string; label: string; locale: string | null; data: Row }[]
  /** Found by the seed's keys but not made by the seed: they stay. */
  kept: { label: string; why: string }[]
  /** Why a delete would be refused. While there is any, nothing at all is removed. */
  blocked: string[]
}

export interface ResetResult { entries: number; media: number; keptMedia: number; cleared: number }

const refKey = (entity: string, id: string) => `${entity}/${id.toLowerCase()}`

/**
 * Work out a reset before touching anything: which entries go and in which order, which
 * globals first lose their links to them, and whether anything would be refused. The site
 * refuses to delete an entry that a menu, a page or a relation still points at (409), and
 * a reset over HTTP has no transaction to undo a half-way stop, so every reason is looked
 * for here: a link in a global or entry (translations included), a relation (the tree's
 * parent too). Whatever the seed owns itself is ordered or cleared; anything else is a
 * blocker, reported with what to change.
 */
export async function planReset(reg: CmsRegistry, backend: SeedBackend, declared: SeedDeclared): Promise<ResetPlan> {
  const plan: ResetPlan = {
    entries: [], media: [...declared.media].reverse(), clear: [],
    kept: declared.foreign.map((x) => ({ label: x.label, why: x.why })), blocked: [],
  }
  const owned = new Map(declared.entries.filter((x) => !isPlaceholder(x.id)).map((x) => [refKey(x.entity, x.id), x]))
  if (!owned.size) return plan
  const ownedEntities = new Set([...owned.values()].map((x) => x.entity))
  const before = new Map<string, Set<string>>() // entry → the owned entries that must go before it
  const isOwnedRef = (v: string) => { const r = parseLinkRef(v); return !!r && owned.has(refKey(r.entity, r.id)) }
  const dropped = (v: string) => (isOwnedRef(v) ? null : undefined)
  const visitor = { field: dropped, mark: dropped }
  const localesList = reg.locales ? reg.locales.locales.filter((l) => l !== reg.locales!.default) : []

  for (const e of reg.entities) {
    const linkKeys = linkFieldsOf(e.fields as any).map(([k]) => k)
    const relations = Object.entries(e.fields).filter(([, f]) => (f.relation?.kind === 'many-to-one' || f.relation?.kind === 'many-to-many') && ownedEntities.has(f.relation.to().name))
    if (!linkKeys.length && !relations.length) continue

    if (e.singleton) {
      for (const [k] of relations) plan.blocked.push(`${e.name} has a relation (${k}) to content the seed would remove; empty it first.`)
      if (!linkKeys.length) continue
      const mine = declared.globals.some((g) => g.entity === e.name)
      for (const locale of [null, ...localesList]) {
        const keys = locale ? linkKeys.filter((k) => e.localized.includes(k)) : linkKeys
        if (!keys.length) continue
        const row = await backend.getGlobal(e.name, locale ?? undefined)
        if (!row || (locale && !row.__translated)) continue
        const fields = Object.fromEntries(keys.map((k) => [k, e.fields[k]!]))
        const hits = [...linkRefsOf(fields as any, row)].filter(isOwnedRef)
        if (!hits.length) continue
        const label = `${e.name}${locale ? ` (${locale})` : ''}`
        if (!mine) { plan.blocked.push(`${label} links to ${hits.map((h) => owned.get(refKey(parseLinkRef(h)!.entity, parseLinkRef(h)!.id))!.label).join(', ')}, which the seed would remove, and the seed does not write it (it is left as it is: ifMissing); take those links out first.`); continue }
        // Saved as the seed saves it: the whole global (the translated fields only, in a translation), without the links.
        const sendKeys = locale ? e.localized : Object.keys(e.fields)
        const data: Row = {}
        for (const k of sendKeys) {
          if (row[k] === undefined) continue
          const fld = e.fields[k] as any
          data[k] = holdsLinks(fld) ? withoutOwnedLinks(fld, row[k], visitor, isOwnedRef) : row[k]
        }
        plan.clear.push({ entity: e.name, label, locale, data })
      }
      continue
    }

    const rows = await backend.list(e.name)
    const translatedLinks = !!localesList.length && linkKeys.some((k) => e.localized.includes(k))
    for (const row of rows) {
      const self = refKey(e.name, row.id)
      const mine = owned.has(self)
      const found = (target: string, how: string) => {
        if (target === self) return
        if (mine) { if (!before.has(target)) before.set(target, new Set()); before.get(target)!.add(self) }
        else plan.blocked.push(`${e.name} ${row[e.titleField] ?? row.id} (not made by the seed) ${how} ${owned.get(target)!.label}, which the seed would remove; change that first.`)
      }
      const refs = linkRefsOf(Object.fromEntries(linkKeys.map((k) => [k, e.fields[k]!])) as any, row)
      if (translatedLinks) {
        const keys = linkKeys.filter((k) => e.localized.includes(k))
        for (const locale of localesList) {
          const tr = await backend.get(e.name, row.id, locale)
          if (tr?.__translated) linkRefsOf(Object.fromEntries(keys.map((k) => [k, e.fields[k]!])) as any, tr, refs)
        }
      }
      for (const ref of refs) {
        const r = parseLinkRef(ref)
        if (r && owned.has(refKey(r.entity, r.id))) found(refKey(r.entity, r.id), 'links to')
      }
      let form: Row | null | undefined
      for (const [k, f] of relations) {
        let v = row[k] ?? row[`${k}Id`]
        if (v === undefined && f.relation!.kind === 'many-to-many') v = (form ??= await backend.get(e.name, row.id))?.[k]
        const target = f.relation!.to().name
        for (const id of ([] as unknown[]).concat(v ?? [])) {
          if (typeof id === 'string' && owned.has(refKey(target, id))) found(refKey(target, id), `relates (${k}) to`)
        }
      }
    }
  }

  // Entries that point at others go first; otherwise last declared goes first (as before).
  const left = [...declared.entries].reverse().filter((x) => owned.has(refKey(x.entity, x.id)))
  const gone = new Set<string>()
  while (left.length) {
    const i = left.findIndex((x) => [...(before.get(refKey(x.entity, x.id)) ?? [])].every((k) => gone.has(k)))
    if (i < 0) {
      plan.blocked.push(`These link to or point at each other, so none can go first: ${left.map((x) => x.label).join(', ')}.`)
      break
    }
    const [x] = left.splice(i, 1)
    gone.add(refKey(x!.entity, x!.id))
    plan.entries.push(x!)
  }
  return plan
}

/** A field's value without the links to owned entries: a list item that holds one is dropped, a lone link is emptied, a rich-text link keeps its words. */
function withoutOwnedLinks(fld: any, value: unknown, visitor: { field: (v: string) => null | undefined; mark: (v: string) => null | undefined }, isOwnedRef: (v: string) => boolean): unknown {
  if (fld.type === 'blocks' && fld.blocks && Array.isArray(value)) {
    return value.filter((b: any) => {
      const def = fld.blocks[b?.type]
      return !def || ![...linkRefsOf(def.fields, b)].some(isOwnedRef)
    })
  }
  return mapFieldLinks(fld, value, visitor)
}

/** What a plan says goes, as lines a person can read before agreeing to it. */
export function describeReset(plan: ResetPlan, where: string): string[] {
  const out: string[] = []
  if (plan.entries.length) out.push(`  ${plan.entries.length === 1 ? 'Entry' : 'Entries'} that would be removed from ${where}, in this order:`, ...plan.entries.map((x) => `    − ${x.label}`))
  if (plan.media.length) out.push('  Files (a file still in use stays):', ...plan.media.map((m) => `    − ${m.label}`))
  if (plan.clear.length) out.push('  Menus and settings first lose their links to those entries (the seed writes them again):', ...plan.clear.map((c) => `    ~ ${c.label}`))
  if (plan.kept.length) out.push('  Found by the seed\'s keys but not made by the seed, so they stay:', ...plan.kept.map((k) => `    · ${k.label} (${k.why})`))
  if (plan.blocked.length) out.push('  Cannot be removed as things are:', ...plan.blocked.map((b) => `    ! ${b}`))
  return out
}

/**
 * Carry out a plan (see `planReset`). A plan with anything blocked is refused before the
 * first write. Over HTTP there is no transaction: if a step still fails (somebody saved
 * something in between), it stops there and says what was already done; the seed puts
 * the rest back on its next run. Files still in use stay (the seed finds and reuses them).
 */
export async function resetDeclared(backend: SeedBackend, plan: ResetPlan, log: (line: string) => void = () => {}): Promise<ResetResult> {
  if (plan.blocked.length) throw new SeedError(`Nothing was removed. --reset cannot go through:\n${plan.blocked.map((b) => `  ! ${b}`).join('\n')}`)
  const out: ResetResult = { entries: 0, media: 0, keptMedia: 0, cleared: 0 }
  const partway = () => (out.entries || out.cleared ? ` Stopped part-way (${out.cleared} menus cleared, ${out.entries} entries removed); run the seed again to put it all back.` : ' Nothing was removed.')
  for (const c of plan.clear) {
    try { await backend.putGlobal(c.entity, c.data, c.locale ?? undefined); out.cleared++ }
    catch (err) { throw new SeedError(`${c.label}: could not take the links out (${err instanceof Error ? err.message : String(err)}).${partway()}`) }
    log(`  ~ ${c.label}: links to removed entries taken out`)
  }
  for (const x of plan.entries) {
    if (isPlaceholder(x.id)) continue
    try { await backend.remove(x.entity, x.id); out.entries++ }
    catch (err) {
      if ((err as any)?.status === 404) continue
      throw new SeedError(`${x.label}: could not be removed (${err instanceof Error ? err.message : String(err)}).${partway()}`)
    }
    log(`  − ${x.label}`)
  }
  for (const m of plan.media) {
    try { await backend.removeMedia(m.id); out.media++; log(`  − ${m.label}`) }
    catch (err) {
      if ((err as any)?.status === 404) continue
      out.keptMedia++
      log(`  · ${m.label} stays (${err instanceof Error ? err.message : String(err)})`)
    }
  }
  return out
}
