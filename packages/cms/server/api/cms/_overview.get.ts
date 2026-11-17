import { and, asc, desc, eq, gt, gte, isNull, listLayout, ne, or, propOf, sql } from 'tinyzoo'

// GET /api/cms/_overview — what the admin home page shows: how many items each
// collection holds, the most recently edited items across all of them, this
// person's own drafts, what is scheduled to go live next and what is coming up in
// dated collections (events: the next ones by their date). Only what the
// signed-in user may read (entity- and row-level access applied).
const RECENT = 8

export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)

  const counts: Record<string, number> = {}
  type Item = { entity: string; id: string; title: string | null; updatedAt: Date; published: boolean | null; publishAt?: Date | null; locale?: string; translating?: true }
  const recent: Item[] = []
  const drafts: Item[] = []
  const scheduled: Item[] = []
  const upcoming: { entity: string; id: string; title: string | null; at: Date }[] = []

  for (const e of reg.entities) {
    const { allowed, where } = accessWhere(e, 'read', user)
    if (!allowed) continue

    if (e.singleton) {
      const [row] = await db.select({ updatedAt: e.table.updatedAt }).from(e.table).where(where).limit(1)
      counts[e.name] = row ? 1 : 0
      continue
    }

    const [counted] = await db.select({ count: sql<number>`count(*)::int` }).from(e.table).where(where)
    counts[e.name] = counted?.count ?? 0

    const titleCol = e.table[e.titleField]
    const statusCol = e.publish ? e.table[propOf(e.publish.field, e.fields[e.publish.field]!)] : undefined
    const dateCol = e.publish?.dateField ? e.table[propOf(e.publish.dateField, e.fields[e.publish.dateField]!)] : undefined
    const rows: any[] = await db
      .select({ id: e.table.id, title: titleCol, updatedAt: e.table.updatedAt, ...(statusCol ? { status: statusCol } : {}), ...(dateCol ? { date: dateCol } : {}) })
      .from(e.table).where(where).orderBy(desc(e.table.updatedAt)).limit(RECENT)
    // My drafts, and what goes live next (collections with a publish workflow).
    const p = e.publish
    if (p && statusCol) {
      const base = { id: e.table.id, title: titleCol, updatedAt: e.table.updatedAt, ...(dateCol ? { date: dateCol } : {}) }
      const me = actorId(user)
      const mine: any[] = me
        ? await db.select(base).from(e.table)
          .where(both(where, and(or(isNull(statusCol), ne(statusCol, p.publishedValue)), or(eq(e.table.createdBy, me), eq(e.table.updatedBy, me)))))
          .orderBy(desc(e.table.updatedAt)).limit(RECENT)
        : []
      for (const r of mine) drafts.push({ entity: e.name, id: r.id, title: r.title == null ? null : String(r.title), updatedAt: r.updatedAt, published: false })
      const sched = scheduleCond(e)
      if (sched && dateCol) {
        const next: any[] = await db.select(base).from(e.table)
          .where(both(where, and(eq(statusCol, p.publishedValue), gt(dateCol, sql`now()`))))
          .orderBy(asc(dateCol)).limit(RECENT)
        for (const r of next) scheduled.push({ entity: e.name, id: r.id, title: r.title == null ? null : String(r.title), updatedAt: r.updatedAt, published: true, publishAt: r.date })
      }
      // Publishing per language: a language with a state of its own is a draft, or goes live, on its own.
      const lt = e.localesTable
      if (p.perLocale && lt && reg.locales) {
        const tbase = { id: e.table.id, title: titleCol, updatedAt: lt.updatedAt, locale: lt.locale, date: lt.publishedAt, translating: sql<boolean>`coalesce(not (${lt.firstLiveAt} <= now()), true)` }
        const draftIn: any[] = me
          ? await db.select(tbase).from(lt).innerJoin(e.table, eq(e.table.id, lt.parentId))
            .where(both(where, and(eq(lt.published, false), or(eq(e.table.createdBy, me), eq(e.table.updatedBy, me)))))
            .orderBy(desc(lt.updatedAt)).limit(RECENT)
          : []
        // A draft that was never on the website is a translation being worked on (visitors see the default language meanwhile).
        for (const r of draftIn) drafts.push({ entity: e.name, id: r.id, title: r.title == null ? null : String(r.title), updatedAt: r.updatedAt, published: false, locale: r.locale, ...(r.translating ? { translating: true } : {}) })
        // Scheduled by its own date while the default language is live (a language held back by the default language is not scheduled: it waits for it).
        const sched = scheduleCond(e)
        if (sched && dateCol) {
          const nextIn: any[] = await db.select(tbase).from(lt).innerJoin(e.table, eq(e.table.id, lt.parentId))
            .where(both(where, and(eq(lt.published, true), gt(lt.publishedAt, sql`now()`), ownPublishedCond(e))))
            .orderBy(asc(lt.publishedAt)).limit(RECENT)
          for (const r of nextIn) scheduled.push({ entity: e.name, id: r.id, title: r.title == null ? null : String(r.title), updatedAt: r.updatedAt, published: true, publishAt: r.date, locale: r.locale })
        }
      }
    }
    // Dated collections (no drafts, a date column): the next few by their date.
    if (listLayout(e) === 'dated') {
      const columns = e.admin?.list?.columns ?? Object.keys(e.fields).slice(0, 4)
      const hidden = unreadableFields(e, user)
      const key = columns.find((k) => e.fields[k]?.type === 'datetime' && !hidden.has(k))
      const col = key ? e.table[propOf(key, e.fields[key]!)] : undefined
      if (col) {
        const next: any[] = await db.select({ id: e.table.id, title: titleCol, at: col }).from(e.table)
          .where(both(where, gte(col, sql`now()`))).orderBy(asc(col)).limit(RECENT)
        for (const r of next) upcoming.push({ entity: e.name, id: r.id, title: r.title == null ? null : String(r.title), at: r.at })
      }
    }
    for (const r of rows) {
      recent.push({
        entity: e.name,
        id: r.id,
        title: r.title == null ? null : String(r.title),
        updatedAt: r.updatedAt,
        published: e.publish ? r.status === e.publish.publishedValue : null,
        publishAt: r.date ?? null,
      })
    }
  }

  recent.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  drafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  scheduled.sort((a, b) => new Date(a.publishAt!).getTime() - new Date(b.publishAt!).getTime())
  upcoming.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  return { counts, recent: recent.slice(0, RECENT), drafts: drafts.slice(0, RECENT), scheduled: scheduled.slice(0, RECENT), upcoming: upcoming.slice(0, RECENT) }
})
