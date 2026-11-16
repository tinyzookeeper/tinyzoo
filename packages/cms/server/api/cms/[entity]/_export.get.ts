import { and, desc, inArray, propOf, resolveText } from 'tinyzoo'

// GET /api/cms/:entity/_export — the list as a CSV file for Excel or Sheets (form
// submissions, a price list): the same search, filters and status tab as the list on
// screen (same query), every plain field, the name of each related item (author),
// and when it was created; newest first; only what the signed-in user may read. UTF-8 with a BOM, so Excel
// opens Czech letters correctly.
const PLAIN = new Set(['text', 'slug', 'number', 'boolean', 'select', 'datetime'])
const MAX_ROWS = 10_000

/** A date as Excel reads it, in the admin's time zone: 2026-11-15 10:59. */
function localTime(d: Date, timeZone: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).map((x) => [x.type, x.value]))
  return p.year + '-' + p.month + '-' + p.day + ' ' + p.hour + ':' + p.minute
}

export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const e = getEntity(reg, getRouterParam(event, 'entity'))
  if (e.singleton) throw createError({ statusCode: 404, statusMessage: 'Globals have no list to export' })
  const rowFilter = authorize(e, 'read', user)

  const cols = (Object.entries(e.fields) as [string, any][])
    .filter(([, f]) => (PLAIN.has(f.type) && !f.relation) || f.relation?.kind === 'many-to-one')
    .map(([k, f]) => ({ key: k, prop: f.relation ? `${k}Id` : propOf(k, f), target: f.relation ? (f.relation.to() as any) : null }))
  const conds = listConditions(e, reg, getQuery(event), rowFilter)
  const rows: any[] = await db.select().from(e.table).where(conds.length ? and(...conds) : undefined).orderBy(desc(e.table.createdAt)).limit(MAX_ROWS)

  // Related items by their title, not their id.
  const names = new Map<string, Map<string, string>>()
  for (const c of cols) {
    if (!c.target) continue
    const ids = [...new Set(rows.map((r) => r[c.prop]).filter(Boolean))] as string[]
    const t = c.target
    const found: any[] = ids.length ? await db.select({ id: t.table.id, title: t.table[t.titleField] }).from(t.table).where(inArray(t.table.id, ids)) : []
    names.set(c.key, new Map(found.map((x) => [x.id, String(x.title ?? '')])))
  }
  const value = (r: any, c: (typeof cols)[number]) => (c.target ? names.get(c.key)?.get(r[c.prop]) ?? r[c.prop] : r[c.prop])

  // In the admin's language: column names as labelled, choices by their names, yes/no,
  // local dates; Czech and German Excel expect ";" between columns.
  const admin = ((useAppConfig() as any)?.cms?.admin ?? {}) as Record<string, any>
  const locale = String(getCookie(event, 'cms_admin_locale') || admin.defaultLocale || 'en')
  const lang = locale.toLowerCase().split('-')[0]
  const timeZone = String(admin.timeZone || 'Europe/Prague')
  const sep = lang === 'cs' || lang === 'de' ? ';' : ','
  const yes = lang === 'cs' ? 'ano' : lang === 'de' ? 'ja' : 'yes'
  const no = lang === 'cs' ? 'ne' : lang === 'de' ? 'nein' : 'no'
  const show = (v: unknown, c?: (typeof cols)[number]): string => {
    if (v === null || v === undefined) return ''
    if (v instanceof Date) return localTime(v, timeZone)
    if (typeof v === 'boolean') return v ? yes : no
    const f = c ? (e.fields[c.key] as any) : null
    if (f?.type === 'select') return resolveText(f.meta?.labels?.[String(v)], locale) || String(v)
    return String(v)
  }
  const label = (key: string) => resolveText((e.fields[key] as any)?.meta?.label, locale) || key
  const header = [...cols.map((c) => label(c.key)), lang === 'cs' ? 'Vytvořeno' : lang === 'de' ? 'Erstellt' : 'Created'].map(csvCell).join(sep)
  const lines = rows.map((r) => [...cols.map((c) => show(value(r, c), c)), show(r.createdAt)].map(csvCell).join(sep))
  await audit(event, 'entry.export', { entity: e.name, meta: { rows: rows.length } })

  const day = new Date().toISOString().slice(0, 10)
  setResponseHeader(event, 'content-type', 'text/csv; charset=utf-8')
  setResponseHeader(event, 'content-disposition', 'attachment; filename="' + e.name + '-' + day + '.csv"')
  setResponseHeader(event, 'cache-control', 'no-store')
  return '﻿' + [header, ...lines].join('\r\n') + '\r\n'
})
