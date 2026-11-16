/**
 * `tinyzoo links:convert` — turn links stored as addresses into links that follow
 * their target.
 *
 * A link an editor picked in an older version is stored as the page's address
 * (`/o-nas`), so renaming the page breaks it. Links picked now are stored as a
 * reference (`cms:page/<id>`) and follow the page. Nothing is converted for you: this
 * command walks every link field and every link in rich text (entries, their
 * translations, globals, menus; lists, blocks and groups inside them) and turns a
 * stored address into a reference when it is exactly the current address of ONE entry
 * (in any language, as the website serves it). Everything else is left as it is and
 * reported: addresses no entry has, addresses two entries share, addresses with a
 * `?query` or `#anchor`. External links, `mailto:`, `tel:` and references are not
 * touched. Saved versions in History are not rewritten.
 *
 *   tinyzoo links:convert [--dry-run] [--batch <n>]
 *
 * Connects with DATABASE_URL (or NUXT_CMS_DATABASE_URL). Run from the host app root.
 * Entries' `updatedAt` is not touched (this is not an edit), so a cache that keys on
 * it, and the website's, must be purged by hand once the command has run.
 */
import { and, asc, eq, gt, or } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { buildRegistry, linkFieldsOf, linkRef, mapRowLinks, propOf, type CmsEntity, type CmsRegistry } from '../src/index'
import { entryAddresses, addressKeys, isLinkable } from '../server/utils/cmsLinkAddress'

export type LinkSource = 'entries' | 'translations'
export type UnmatchedReason = 'no-page' | 'several-pages' | 'anchor-or-query'

export interface ConvertFieldReport {
  entity: string
  field: string
  source: LinkSource
  /** Rows that hold this field with a value. */
  scanned: number
  /** Links turned (or, in a dry run, that would be turned) into references. */
  converted: number
}

export interface UnmatchedLink {
  /** The stored address. */
  value: string
  reason: UnmatchedReason
  /** How many times it is stored. */
  count: number
  /** Where, for the first few: `page 3f2a… · sections.0.url`. */
  places: string[]
  /** For `several-pages`: the entries that have this address. */
  candidates?: string[]
}

export interface ConvertReport {
  dryRun: boolean
  fields: ConvertFieldReport[]
  unmatched: UnmatchedLink[]
  rowsScanned: number
  rowsChanged: number
  linksConverted: number
  /** Blocks stored at an older version than their definition: left alone (run `content:migrate` first). */
  skippedStaleBlocks: number
}

export interface ConvertOptions {
  dryRun?: boolean
  batchSize?: number
}

/** An address as compared: decoded, no trailing slash (except "/"). */
export function normalizeAddress(address: string): string {
  let p = address
  try { p = decodeURI(p) } catch { /* compare as stored */ }
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p
}

/** The entries of every linkable collection by their addresses, in every language: `normalized address → entity/id`. */
export async function addressIndex(db: any, reg: CmsRegistry, batch = 500): Promise<Map<string, Set<string>>> {
  const index = new Map<string, Set<string>>()
  for (const e of reg.entities) {
    if (!isLinkable(e)) continue
    const cols: Record<string, any> = { id: e.table.id }
    for (const k of addressKeys(e)) cols[k] = (e.table as any)[k]
    for (let after: string | null = null; ;) {
      const rows: any[] = await db.select(cols).from(e.table).where(after ? gt(e.table.id, after) : undefined).orderBy(asc(e.table.id)).limit(batch)
      if (!rows.length) break
      for (const locale of reg.locales?.locales ?? [null]) {
        for (const [id, address] of await entryAddresses(db, reg, e, rows, locale)) {
          if (!address) continue
          const key = normalizeAddress(address)
          const set = index.get(key) ?? new Set<string>()
          set.add(linkRef(e.name, id))
          index.set(key, set)
        }
      }
      after = rows[rows.length - 1].id
      if (rows.length < batch) break
    }
  }
  return index
}

/** A stored value that is an address on this site (`/…`), not an external link or a protocol-relative `//host`. */
const isSiteAddress = (v: string) => v.startsWith('/') && !v.startsWith('//')

/**
 * Walk everything and turn stored addresses into references. `db` is a drizzle
 * node-postgres database; every table is reached through the registry.
 */
export async function convertLinks(db: any, reg: CmsRegistry, opts: ConvertOptions = {}): Promise<ConvertReport> {
  const dryRun = !!opts.dryRun
  const batch = Math.max(1, opts.batchSize ?? 200)
  const report: ConvertReport = { dryRun, fields: [], unmatched: [], rowsScanned: 0, rowsChanged: 0, linksConverted: 0, skippedStaleBlocks: 0 }
  const index = await addressIndex(db, reg)
  const counters = new Map<string, ConvertFieldReport>()
  const unmatched = new Map<string, UnmatchedLink>()
  const label = (e: CmsEntity, id: string, locale: string | null) => `${e.name} ${id}${locale ? ` [${locale}]` : ''}`

  /** The links of one row's values turned into references; the changed values by field key. */
  function convertValues(e: CmsEntity, source: LinkSource, id: string, locale: string | null, fields: CmsEntity['fields'], values: Record<string, any>): Record<string, any> {
    for (const key of Object.keys(fields)) {
      if (values[key] == null) continue
      const k = `${e.name}\u0000${source}\u0000${key}`
      let c = counters.get(k)
      if (!c) counters.set(k, c = { entity: e.name, field: key, source, scanned: 0, converted: 0 })
      c.scanned++
    }
    let current = ''
    const convert = (stored: string): string | undefined => {
      if (!isSiteAddress(stored)) return undefined
      const note = (reason: UnmatchedReason, candidates?: string[]) => {
        const u = unmatched.get(`${reason}\u0000${stored}`) ?? { value: stored, reason, count: 0, places: [], candidates }
        u.count++
        if (u.places.length < 3) u.places.push(`${label(e, id, locale)} · ${current}`)
        unmatched.set(`${reason}\u0000${stored}`, u)
        return undefined
      }
      if (/[?#]/.test(stored)) return note('anchor-or-query')
      const found = index.get(normalizeAddress(stored))
      if (!found?.size) return note('no-page')
      if (found.size > 1) return note('several-pages', [...found].sort())
      const ref = [...found][0]!
      report.linksConverted++
      const c = counters.get(`${e.name}\u0000${source}\u0000${current}`)
      if (c) c.converted++
      return ref
    }
    const changed: Record<string, any> = {}
    for (const key of Object.keys(fields)) {
      if (values[key] == null) continue
      current = key
      const one = mapRowLinks({ [key]: fields[key] as any }, values, { field: convert, mark: convert, skipStale: true, onStale: () => { report.skippedStaleBlocks++ } })
      if (key in one) changed[key] = one[key]
    }
    return changed
  }

  for (const e of reg.entities) {
    const own = Object.fromEntries(linkFieldsOf(e.fields as any)) as CmsEntity['fields']
    if (!Object.keys(own).length) continue

    let after: string | null = null
    for (;;) {
      const done = await db.transaction(async (tx: any) => {
        const rows: any[] = await tx.select().from(e.table).where(after ? gt(e.table.id, after) : undefined).orderBy(asc(e.table.id)).limit(batch).for('update')
        for (const row of rows) {
          report.rowsScanned++
          const changed = convertValues(e, 'entries', row.id, null, own, row)
          if (!Object.keys(changed).length) continue
          report.rowsChanged++
          if (!dryRun) await tx.update(e.table).set(Object.fromEntries(Object.entries(changed).map(([k, v]) => [propOf(k, e.fields[k]!), v]))).where(eq(e.table.id, row.id))
        }
        after = rows.length ? rows[rows.length - 1].id : after
        return rows.length < batch
      })
      if (done) break
    }

    const t = e.localesTable
    const translated = Object.fromEntries(Object.entries(own).filter(([k]) => e.localized.includes(k))) as CmsEntity['fields']
    if (t && Object.keys(translated).length) {
      type Cursor = { parentId: string; locale: string }
      let last = null as Cursor | null
      for (;;) {
        const cursor = last as Cursor | null
        const done = await db.transaction(async (tx: any) => {
          const cond = cursor ? or(gt(t.parentId, cursor.parentId), and(eq(t.parentId, cursor.parentId), gt(t.locale, cursor.locale))) : undefined
          const rows: any[] = await tx.select().from(t).where(cond).orderBy(asc(t.parentId), asc(t.locale)).limit(batch).for('update')
          for (const row of rows) {
            report.rowsScanned++
            const changed = convertValues(e, 'translations', row.parentId, row.locale, translated, row)
            if (!Object.keys(changed).length) continue
            report.rowsChanged++
            if (!dryRun) await tx.update(t).set(changed).where(and(eq(t.parentId, row.parentId), eq(t.locale, row.locale)))
          }
          if (rows.length) last = { parentId: rows[rows.length - 1].parentId, locale: rows[rows.length - 1].locale }
          return rows.length < batch
        })
        if (done) break
      }
    }
  }

  report.fields = [...counters.values()].filter((c) => c.scanned > 0)
  report.unmatched = [...unmatched.values()].sort((a, b) => a.reason.localeCompare(b.reason) || b.count - a.count || a.value.localeCompare(b.value))
  return report
}

const REASONS: Record<UnmatchedReason, string> = {
  'no-page': 'no entry has this address (left as it is)',
  'several-pages': 'more than one entry has this address (left as it is)',
  'anchor-or-query': 'has a #anchor or ?query, which a reference cannot carry (left as it is)',
}

/** The report as the lines the command prints. */
export function formatConvertReport(r: ConvertReport): string[] {
  const lines: string[] = []
  const rows = r.fields.filter((f) => f.converted > 0)
  for (const f of rows) {
    lines.push(`${`${f.entity}.${f.field}`.padEnd(34)} ${f.source.padEnd(12)} ${String(f.converted).padStart(5)} link${f.converted === 1 ? '' : 's'} ${r.dryRun ? 'would be converted' : 'converted'}`)
  }
  if (!rows.length) lines.push('No stored address matches exactly one entry: nothing to convert.')
  if (r.unmatched.length) {
    lines.push('', `${r.unmatched.length} stored address${r.unmatched.length === 1 ? '' : 'es'} could not be converted:`)
    for (const u of r.unmatched) {
      lines.push(`  ${u.value} — ${REASONS[u.reason]}${u.count > 1 ? `, stored ${u.count} times` : ''}`)
      for (const p of u.places) lines.push(`      ${p}`)
      if (u.candidates) lines.push(`      could be: ${u.candidates.join(', ')}`)
    }
    lines.push('', 'Pick those pages again in the link picker (or give the entries different addresses) to make the links follow their pages.')
  }
  if (r.skippedStaleBlocks) lines.push('', `${r.skippedStaleBlocks} block${r.skippedStaleBlocks === 1 ? ' is' : 's are'} stored at an older version than the code: left alone. Run \`tinyzoo content:migrate\` first, then this command again.`)
  lines.push('', `${r.rowsScanned} rows read, ${r.linksConverted} link${r.linksConverted === 1 ? '' : 's'} ${r.dryRun ? 'would be converted (dry run: nothing was written)' : `converted in ${r.rowsChanged} row${r.rowsChanged === 1 ? '' : 's'}`}.`)
  if (!r.dryRun && r.linksConverted) lines.push('Purge the website’s cache: the content API answers have changed.')
  return lines
}

/** The command: connect, convert, print. */
export async function linksConvertCommand(config: Record<string, any>, args: string[]): Promise<void> {
  const dryRun = args.includes('--dry-run')
  const bi = args.indexOf('--batch')
  const batchSize = bi >= 0 ? Number(args[bi + 1]) : undefined
  if (bi >= 0 && !(Number.isInteger(batchSize) && batchSize! > 0)) {
    console.error('usage: tinyzoo links:convert [--dry-run] [--batch <n>]')
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
    const report = await convertLinks(drizzle(pool, { schema: reg.schema }), reg, { dryRun, batchSize })
    for (const line of formatConvertReport(report)) console.log(line)
  }
  finally {
    await pool.end()
  }
}
