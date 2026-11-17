import { and, eq, gt, inArray, isNull, lte, or, propOf, sql } from 'tinyzoo'

const LOCK = 72_011_004
const KEY = 'scheduler.lastRun'

/**
 * Report every scheduled entry (or, with per-language publishing, translation) whose publish
 * date passed since the last run — a translation only once the default language is live too
 * (it gates every language). One
 * replica at a time (a Postgres advisory lock); the last run is kept in cms_state,
 * so a restart or a missed minute catches up instead of skipping. The very first
 * run starts from now.
 */
export async function announceScheduled(): Promise<number> {
  const { db, reg } = useCms()
  const due: { e: any; id: string; row: any; locale?: string }[] = []
  const ran = await db.transaction(async (tx: any) => {
    const [{ locked }] = (await tx.execute(sql`select pg_try_advisory_xact_lock(${LOCK}) as locked`)).rows
    if (!locked) return false
    const s = reg.cmsState
    const [state] = await tx.select().from(s).where(eq(s.key, KEY))
    const [{ now }] = (await tx.execute(sql`select now() as now`)).rows
    // The very first run looks back ten minutes (an entry going live during a deploy).
    const since = state?.value?.at ? new Date(state.value.at) : new Date(new Date(now).getTime() - 10 * 60_000)
    for (const e of reg.entities) {
      const p = e.publish
      if (!p?.dateField || p.schedule === false) continue
      const date = e.table[propOf(p.dateField, e.fields[p.dateField]!)]
      const status = e.table[propOf(p.field, e.fields[p.field]!)]
      // Only entries saved before their date (scheduled): "publish now" was announced
      // when it was saved — the server stamps that date itself (stampPublishDate),
      // so it never lies after the save. At worst a borderline case is announced twice.
      const rows: any[] = await tx.select().from(e.table)
        .where(and(eq(status, p.publishedValue), gt(date, since), lte(date, new Date(now)), sql`${date} > ${e.table.updatedAt}`))
      for (const row of rows) due.push({ e, id: row.id, row })
      // Publishing per language: a translation with its own date and state goes live on its own. The
      // default language gates: it is live (and announced) only while the entry itself is, so a
      // translation whose date passed while the default language was not live yet waits, and goes
      // live with it, at the later of the two dates.
      const lt = e.localesTable
      if (p.perLocale && lt) {
        const candidates = new Map<string, { parentId: string; locale: string; updatedAt: Date }>()
        const own: any[] = await tx.select({ parentId: lt.parentId, locale: lt.locale, updatedAt: lt.updatedAt }).from(lt)
          .where(and(eq(lt.published, true), gt(lt.publishedAt, since), lte(lt.publishedAt, new Date(now)), sql`${lt.publishedAt} > ${lt.updatedAt}`))
        for (const tr of own) candidates.set(tr.parentId + '#' + tr.locale, tr)
        // The default language going live now takes along the languages that were only waiting for it.
        if (rows.length) {
          const waiting: any[] = await tx.select({ parentId: lt.parentId, locale: lt.locale, updatedAt: lt.updatedAt }).from(lt)
            .where(and(inArray(lt.parentId, rows.map((r) => r.id)), eq(lt.published, true), or(isNull(lt.publishedAt), lte(lt.publishedAt, new Date(now)))))
          for (const tr of waiting) candidates.set(tr.parentId + '#' + tr.locale, tr)
        }
        if (candidates.size) {
          const parents = [...new Set([...candidates.values()].map((c) => c.parentId))]
          const live = new Set((await tx.select({ id: e.table.id }).from(e.table).where(and(inArray(e.table.id, parents), ownPublishedCond(e)))).map((r: any) => r.id))
          for (const tr of candidates.values()) if (live.has(tr.parentId)) due.push({ e, id: tr.parentId, row: { updatedAt: tr.updatedAt }, locale: tr.locale })
        }
      }
    }
    await tx.insert(s).values({ key: KEY, value: { at: new Date(now).toISOString() } })
      .onConflictDoUpdate({ target: s.key, set: { value: { at: new Date(now).toISOString() }, updatedAt: sql`now()` } })
    return true
  })
  if (!ran) return 0
  if (due.length) console.info(`[cms] scheduled: ${due.length} entries went live`)
  for (const { e, id, row, locale } of due) {
    await reportChange(null, { type: 'entry.published', entity: e, id, locale, before: { live: false, paths: [] }, after: row, noRevision: true })
  }
  return due.length
}
