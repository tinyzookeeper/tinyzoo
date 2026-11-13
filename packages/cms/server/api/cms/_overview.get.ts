import { desc, sql } from '@my-cms/core'

// GET /api/cms/_overview — what the admin home page shows: how many items each
// collection holds and the most recently edited items across all of them. Only
// what the signed-in user may read (entity- and row-level access applied).
const RECENT = 8

export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)

  const counts: Record<string, number> = {}
  const recent: { entity: string; id: string; title: string | null; updatedAt: Date; published: boolean | null }[] = []

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
    const statusCol = e.publish ? e.table[e.publish.field] : undefined
    const rows: any[] = await db
      .select({ id: e.table.id, title: titleCol, updatedAt: e.table.updatedAt, ...(statusCol ? { status: statusCol } : {}) })
      .from(e.table).where(where).orderBy(desc(e.table.updatedAt)).limit(RECENT)
    for (const r of rows) {
      recent.push({
        entity: e.name,
        id: r.id,
        title: r.title == null ? null : String(r.title),
        updatedAt: r.updatedAt,
        published: e.publish ? r.status === e.publish.publishedValue : null,
      })
    }
  }

  recent.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  return { counts, recent: recent.slice(0, RECENT) }
})
