import { createHash } from 'node:crypto'
import { and, desc, eq, indexTree, inArray, or, pathTemplateKeys, propOf, sitePath, sql, entryTexts, foldSearchText, isSearchableField, matchEntry, highlightRanges } from 'tinyzoo'
import type { CmsEntity, CmsRegistry } from 'tinyzoo'
import { hasTranslatedText, mergeTranslation } from './cmsLocales'
// Explicit (not Nitro's auto-import): the CLI's import rebuilds the index outside Nitro.
import { upgradedCopy } from './cmsBlocks'

/**
 * Search, typos included, on Postgres alone (the pg_trgm extension).
 *
 * The index (`cms_search`) holds what each entry says as plain text — one row per
 * entry and language — kept up to date by reportChange and rebuilt when the search
 * configuration changes. A search runs in two steps:
 *
 *  1. Postgres finds candidates: every word is in the entry, exactly or close to a
 *     word in it (trigram word similarity, through GIN indexes), so a typo is not missed;
 *  2. each candidate's text is checked word by word (src/search.ts: within one typo
 *     for words of 4–7 letters, two for longer ones, a swap counting as one), which
 *     drops lookalikes ("bazar" is not "bazén"), ranks the rest and cuts a snippet.
 *
 * Used by the website search (`/api/content/_search`) and the admin's search (`/api/cms/_search`).
 */

/** Bump when what goes into the index changes: every site rebuilds it once. */
const INDEX_VERSION = 1
const STATE_KEY = 'search.index'
const LOCK = 72_011_005
/** Trigram word similarity a candidate needs (lenient: step 2 decides). */
const THRESHOLD = 0.3
/** Most candidates read per collection, best first. */
const CANDIDATES = 100
const BATCH = 500

// ── what goes into the index ──────────────────────────────────────────────────

interface SearchDoc { title: string; body: string; extra: string }

/**
 * An entry's text: `body` is what visitors may read (no hidden fields; only
 * `content.search.fields` when set); `extra` the rest, for the admin only —
 * hidden or left-out prose and the list's searchable fields (an email address).
 */
function documentOf(e: CmsEntity, source: Record<string, any>, unreadable?: ReadonlySet<string>): SearchDoc {
  // Read blocks in their current shape (a renamed field is still found).
  const row = upgradedCopy(e, source)
  const cfg = e.content?.search
  const picked = cfg && typeof cfg === 'object' && Array.isArray(cfg.fields) ? new Set<string>(cfg.fields) : null
  const hidden = new Set<string>(e.content?.hidden ?? [])
  const publicFields: Record<string, any> = {}
  const privateFields: Record<string, any> = {}
  for (const [k, fld] of Object.entries(e.fields)) {
    if (k === e.titleField || unreadable?.has(k)) continue
    if (hidden.has(k) || (picked && !picked.has(k))) privateFields[k] = fld
    else publicFields[k] = fld
  }
  const extra = entryTexts(privateFields, row)
  for (const k of e.admin?.list?.searchable ?? []) {
    if (unreadable?.has(k)) continue
    const fld = e.fields[k]
    if (k !== e.titleField && fld && !fld.relation && !isSearchableField(fld) && row[k] != null && row[k] !== '') extra.push(String(row[k]))
  }
  const title = row[e.titleField]
  return { title: typeof title === 'string' ? title : title == null ? '' : String(title), body: entryTexts(publicFields, row).join('\n'), extra: extra.join('\n') }
}

/** Index rows of one entry: one per language it exists in, or one ('') without translations. */
function indexRows(reg: CmsRegistry, e: CmsEntity, row: Record<string, any>, translations: any[]): any[] {
  const out: any[] = []
  const add = (locale: string, values: Record<string, any>, path: string | null) => {
    const d = documentOf(e, values)
    out.push({
      entity: e.name, recordId: row.id, locale,
      title: d.title, body: d.body, extra: d.extra,
      titleFolded: foldSearchText(d.title), bodyFolded: foldSearchText(d.body), extraFolded: foldSearchText(d.extra),
      path, updatedAt: new Date(),
    })
  }
  // A page tree's address depends on its ancestors, who can change without this entry
  // being saved: it is worked out when searching, not stored.
  const pathOf = (locale: string | null, values: Record<string, any>) => (e.tree ? null : sitePath(reg.locales, e.content?.path, locale, values))
  if (reg.locales && e.localized.length) {
    const def = reg.locales.default
    add(def, row, pathOf(def, row))
    for (const tr of translations) {
      if (tr.locale === def || !reg.locales.locales.includes(tr.locale)) continue
      // A row that only holds a language's publish state is not a translation: nothing to find in it.
      if (e.publish?.perLocale && !hasTranslatedText(e, tr)) continue
      const merged = mergeTranslation(e, { ...row }, tr)
      add(tr.locale, merged, pathOf(tr.locale, merged))
    }
  }
  else add('', row, null)
  return out
}

async function insertRows(db: any, reg: CmsRegistry, rows: any[]) {
  const s = reg.cmsSearch
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.insert(s).values(rows.slice(i, i + BATCH)).onConflictDoUpdate({
      target: [s.entity, s.recordId, s.locale],
      set: {
        title: sql`excluded.title`, body: sql`excluded.body`, extra: sql`excluded.extra`,
        titleFolded: sql`excluded.title_folded`, bodyFolded: sql`excluded.body_folded`, extraFolded: sql`excluded.extra_folded`,
        path: sql`excluded.path`, updatedAt: sql`excluded.updated_at`,
      },
    })
  }
}

const indexable = (e: CmsEntity) => !e.singleton

/** Bring one entry's index rows up to date (all its languages); removes them when it is gone. */
export async function indexEntry(db: any, reg: CmsRegistry, e: CmsEntity, id: string): Promise<void> {
  if (!indexable(e)) return
  const s = reg.cmsSearch
  await db.transaction(async (tx: any) => {
    const [row] = await tx.select().from(e.table).where(eq(e.table.id, id))
    await tx.delete(s).where(and(eq(s.entity, e.name), eq(s.recordId, id)))
    if (!row) return
    const translations = e.localesTable && e.localized.length
      ? await tx.select().from(e.localesTable).where(eq(e.localesTable.parentId, id))
      : []
    await insertRows(tx, reg, indexRows(reg, e, row, translations))
  })
}

/** Keep the index in step with a reported change (called by reportChange). */
export async function syncSearchIndex(e: CmsEntity, id: string, type: string): Promise<void> {
  if (!indexable(e)) return
  const { db, reg } = useCms()
  if (type === 'entry.deleted') {
    const s = reg.cmsSearch
    await db.delete(s).where(and(eq(s.entity, e.name), eq(s.recordId, id)))
  }
  else await indexEntry(db, reg, e, id)
}

/** What the index is built from: when it changes, the index is rebuilt. */
export function searchIndexSignature(reg: CmsRegistry): string {
  const fieldShape = (fields: Record<string, any>): any => Object.entries(fields).map(([k, f]) => [
    k, f.type, f.meta?.format ?? null,
    f.blocks ? Object.fromEntries(Object.entries(f.blocks as Record<string, any>).map(([t, b]) => [t, fieldShape(b.fields)])) : null,
    // Only groups add an element: the signature of a site without one stays what it was.
    ...(f.fields ? [fieldShape(f.fields)] : []),
  ])
  const shape = reg.entities.filter(indexable).map((e) => ({
    name: e.name, title: e.titleField, localized: e.localized, fields: fieldShape(e.fields),
    hidden: e.content?.hidden ?? [], search: e.content?.search ?? null, searchable: e.admin?.list?.searchable ?? [],
    path: e.content?.path ?? null, tree: e.tree ?? null,
  }))
  return createHash('sha256').update(JSON.stringify({ v: INDEX_VERSION, locales: reg.locales, shape })).digest('hex')
}

/**
 * Rebuild the whole index (one replica at a time; the others skip). Readers keep
 * the old index until it is done. Returns the number of index rows, or null when
 * another replica is already at it.
 */
export async function rebuildSearchIndex(db: any, reg: CmsRegistry): Promise<number | null> {
  const s = reg.cmsSearch
  const signature = searchIndexSignature(reg)
  return db.transaction(async (tx: any) => {
    const [{ locked }] = (await tx.execute(sql`select pg_try_advisory_xact_lock(${LOCK}) as locked`)).rows
    if (!locked) return null
    await tx.delete(s)
    let count = 0
    for (const e of reg.entities.filter(indexable)) {
      for (let offset = 0; ; offset += BATCH) {
        const rows: any[] = await tx.select().from(e.table).orderBy(e.table.id).limit(BATCH).offset(offset)
        if (!rows.length) break
        const byParent = new Map<string, any[]>()
        if (e.localesTable && e.localized.length) {
          const trs: any[] = await tx.select().from(e.localesTable).where(inArray(e.localesTable.parentId, rows.map((r) => r.id)))
          for (const tr of trs) byParent.set(tr.parentId, [...(byParent.get(tr.parentId) ?? []), tr])
        }
        const out = rows.flatMap((row) => indexRows(reg, e, row, byParent.get(row.id) ?? []))
        await insertRows(tx, reg, out)
        count += out.length
        if (rows.length < BATCH) break
      }
    }
    const st = reg.cmsState
    const value = { signature, at: new Date().toISOString(), rows: count }
    await tx.insert(st).values({ key: STATE_KEY, value }).onConflictDoUpdate({ target: st.key, set: { value, updatedAt: sql`now()` } })
    return count
  })
}

/** Rebuild the index when it was built from another configuration (or never). Called on start. */
export async function ensureSearchIndex(): Promise<void> {
  const { db, reg } = useCms()
  const st = reg.cmsState
  const [state] = await db.select().from(st).where(eq(st.key, STATE_KEY))
  if ((state?.value as any)?.signature === searchIndexSignature(reg)) return
  const started = Date.now()
  const rows = await rebuildSearchIndex(db, reg)
  if (rows !== null) console.info(`[cms] search index built: ${rows} entries and translations in ${Date.now() - started} ms`)
}

// ── searching ─────────────────────────────────────────────────────────────────

/**
 * Every word is in one of `cols` exactly (LIKE), or close to a word in it (pg_trgm
 * `<%`, index-assisted); words under three letters only exactly.
 */
function termsCond(cols: any[], terms: string[]): any {
  return and(...terms.map((term) => {
    const like = '%' + term.replace(/[\\%_]/g, (c) => '\\' + c) + '%'
    const exact = cols.map((c) => sql`${c} like ${like}`)
    const near = term.length >= 3 ? cols.map((c) => sql`${term} <% ${c}`) : []
    return or(...exact, ...near)
  }))
}

/** How close the words are, for picking the best candidates (title weighs double). */
function closeness(title: any, others: any[], terms: string[]): any {
  const parts = terms.map((t) => sql`greatest(word_similarity(${t}, ${title}) * 2, ${sql.join(others.map((c) => sql`word_similarity(${t}, ${c})`), sql`, `)})`)
  return sql`(${sql.join(parts, sql` + `)})`
}

/** Run `fn` with the lenient similarity threshold, for this transaction only. */
function withThreshold<T>(db: any, fn: (tx: any) => Promise<T>): Promise<T> {
  return db.transaction(async (tx: any) => {
    await tx.execute(sql`select set_config('pg_trgm.word_similarity_threshold', ${String(THRESHOLD)}, true)`)
    return fn(tx)
  })
}

export interface PublicSearchItem {
  entity: string
  id: string
  title: string
  titleHighlights: [number, number][]
  excerpt: string
  highlights: [number, number][]
  /** The entry's address on the website, in the language searched (null if it has none there). */
  path: string | null
  locale: string | null
  updatedAt: string
  score: number
}

/** Collections the website search covers: public, at an address, not opted out. */
export function publicSearchEntities(reg: CmsRegistry): CmsEntity[] {
  return reg.entities.filter((e) => e.content?.public && !e.singleton && e.content.path && e.content.search !== false)
}

/**
 * The website search: published entries of public collections with an address, in
 * the visitor's language (an entry not translated into it is left out), never
 * matching fields hidden from the public.
 */
export async function searchPublic(db: any, reg: CmsRegistry, terms: string[], query: string, locale: string | null, only?: Set<string>): Promise<PublicSearchItem[]> {
  const s = reg.cmsSearch
  const out: PublicSearchItem[] = []
  await withThreshold(db, async (tx) => {
    for (const e of publicSearchEntities(reg)) {
      if (only && !only.has(e.name)) continue
      // A collection with translations has a row per language; one without, a row for all.
      const langs = locale && reg.locales && e.localized.length ? [locale] : ['']
      const pathCols: Record<string, any> = {}
      for (const k of pathTemplateKeys(e.content!.path)) if (e.table[k]) pathCols[k] = e.table[k]
      const score = closeness(s.titleFolded, [s.bodyFolded], terms)
      const conds = [eq(s.entity, e.name), inArray(s.locale, langs), termsCond([s.titleFolded, s.bodyFolded], terms), publishedCond(e, liveLocale(reg, locale))]
      const rows: any[] = await tx.select({ id: s.recordId, title: s.title, body: s.body, path: s.path, updatedAt: e.table.updatedAt, rank: score, ...pathCols })
        .from(s).innerJoin(e.table, eq(e.table.id, s.recordId))
        .where(and(...conds.filter(Boolean))).orderBy(desc(score)).limit(CANDIDATES)
      const treeIndex = e.tree && rows.length ? indexTree(await loadTreeNodes(tx, reg, e)) : null
      for (const r of rows) {
        const match = matchEntry(r.title, [r.body], terms, query)
        if (!match) continue
        out.push({
          entity: e.name,
          id: r.id,
          title: r.title,
          titleHighlights: highlightRanges(r.title, terms),
          excerpt: match.excerpt,
          highlights: match.highlights,
          path: treeIndex ? treePathIn(reg, e, treeIndex, r.id, locale) : r.path ?? sitePath(reg.locales, e.content!.path, locale ?? reg.locales?.default ?? null, r),
          locale,
          updatedAt: new Date(r.updatedAt).toISOString(),
          score: match.score,
        })
      }
    }
  })
  return out.sort(byScore)
}

export interface AdminSearchItem {
  entity: string
  id: string
  title: string
  titleHighlights: [number, number][]
  excerpt: string
  highlights: [number, number][]
  /** 'published' | 'scheduled' | 'draft' for collections with publishing, else null. */
  status: string | null
  updatedAt: string
  score: number
}

/**
 * The admin's search: entries of every collection this person may read (their row
 * rules apply), drafts included, in every language — an editor may remember the
 * English title of a Czech page — and the admin-only text (hidden fields, an email).
 */
export async function searchAdmin(db: any, reg: CmsRegistry, user: any, terms: string[], query: string, perEntity: number): Promise<AdminSearchItem[]> {
  const s = reg.cmsSearch
  const out: AdminSearchItem[] = []
  await withThreshold(db, async (tx) => {
    for (const e of reg.entities) {
      if (!indexable(e)) continue
      const access = accessWhere(e, 'read', user)
      if (!access.allowed) continue
      const p = e.publish
      const due = scheduleCond(e)
      const score = closeness(s.titleFolded, [s.bodyFolded, s.extraFolded], terms)
      const rows: any[] = await tx.select({
        id: s.recordId, locale: s.locale, title: s.title, body: s.body, extra: s.extra, rank: score,
        ownTitle: e.table[e.titleField], updatedAt: e.table.updatedAt,
        status: p ? e.table[propOf(p.field, e.fields[p.field]!)] : sql`null`,
        due: due ? sql<boolean>`coalesce(${due}, false)` : sql<boolean>`true`,
      }).from(s).innerJoin(e.table, eq(e.table.id, s.recordId))
        .where(both(and(eq(s.entity, e.name), termsCond([s.titleFolded, s.bodyFolded, s.extraFolded], terms)), access.where))
        .orderBy(desc(score)).limit(CANDIDATES)

      // The index holds all of an entry's text, a field this person may not read included. It only
      // finds candidates: for a collection with such a field the texts are made again from the
      // fields they may read, so an entry that matches through the other one is dropped (and no
      // excerpt shows it).
      const unreadable = unreadableFields(e, user)
      if (unreadable.size && rows.length) await readableTexts(tx, reg, e, rows, unreadable)

      // One result per entry, read across its languages.
      const byId = new Map<string, any[]>()
      for (const r of rows) byId.set(r.id, [...(byId.get(r.id) ?? []), r])
      const found: AdminSearchItem[] = []
      for (const [id, versions] of byId) {
        const first = versions[0]
        const title = String(first.ownTitle ?? first.title ?? '')
        const titles = [...new Set([title, ...versions.map((v) => v.title)])].filter(Boolean).join(' · ')
        const match = matchEntry(titles, versions.flatMap((v) => [v.body, v.extra]).filter(Boolean), terms, query)
        if (!match) continue
        found.push({
          entity: e.name,
          id,
          title,
          titleHighlights: highlightRanges(title, terms),
          excerpt: match.excerpt,
          highlights: match.highlights,
          status: !p ? null : first.status !== p.publishedValue ? 'draft' : first.due ? 'published' : 'scheduled',
          updatedAt: new Date(first.updatedAt).toISOString(),
          score: match.score,
        })
      }
      out.push(...found.sort(byScore).slice(0, perEntity))
    }
  })
  return out.sort(byScore)
}

/** Replace each candidate's indexed text by the text of the fields `unreadable` leaves (title, body, extra), in its language. */
async function readableTexts(db: any, reg: CmsRegistry, e: CmsEntity, rows: any[], unreadable: ReadonlySet<string>): Promise<void> {
  const ids = [...new Set(rows.map((r) => r.id))]
  const sources = new Map<string, any>((await db.select().from(e.table).where(inArray(e.table.id, ids)) as any[]).map((r) => [r.id, r]))
  const trs = new Map<string, any>()
  if (e.localesTable && e.localized.length) {
    for (const tr of await db.select().from(e.localesTable).where(inArray(e.localesTable.parentId, ids)) as any[]) trs.set(`${tr.parentId}:${tr.locale}`, tr)
  }
  for (const r of rows) {
    const row = sources.get(r.id)
    if (!row) { r.title = ''; r.body = ''; r.extra = ''; continue }
    const tr = r.locale && reg.locales && r.locale !== reg.locales.default ? trs.get(`${r.id}:${r.locale}`) : null
    const d = documentOf(e, tr ? mergeTranslation(e, { ...row }, tr) : row, unreadable)
    r.title = d.title; r.body = d.body; r.extra = d.extra
  }
}

const byScore = (a: { score: number; updatedAt: string }, b: { score: number; updatedAt: string }) =>
  b.score - a.score || b.updatedAt.localeCompare(a.updatedAt)
