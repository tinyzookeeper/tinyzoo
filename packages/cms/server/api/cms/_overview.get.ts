import { and, asc, desc, eq, gt, isNull, ne, or, propOf, sql } from '@my-cms/core'

// GET /api/cms/_overview — what the admin home page shows: how many items each
// collection holds, the most recently edited items across all of them, this
// person's own drafts and what is scheduled to go live next. Only what the
// signed-in user may read (entity- and row-level access applied).
const RECENT = 8

export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)

  const counts: Record<string, number> = {}
  type Item = { entity: string; id: string; title: string | null; updatedAt: Date; published: boolean | null; publishAt?: Date | null }
  const recent: Item[] = []
  const drafts: Item[] = []
  const scheduled: Item[] = []

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
  return { counts, recent: recent.slice(0, RECENT), drafts: drafts.slice(0, RECENT), scheduled: scheduled.slice(0, RECENT) }
})
