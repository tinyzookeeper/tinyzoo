import { gte, sql } from 'tinyzoo'

// GET /api/cms/_p/events/summary — the numbers on the plugin's admin page.
export default defineEventHandler(async (event) => {
  requireCmsUser(event)
  const { db, reg } = useCms()
  const t = reg.byName.get('events')!.table
  const [counts] = await db.select({
    total: sql<number>`count(*)::int`,
    upcoming: sql<number>`count(*) filter (where ${gte(t.startsAt, sql`now()`)})::int`,
  }).from(t)
  const [next] = await db.select({ id: t.id, title: t.title, startsAt: t.startsAt }).from(t).where(gte(t.startsAt, sql`now()`)).orderBy(t.startsAt).limit(1)
  return { total: counts?.total ?? 0, upcoming: counts?.upcoming ?? 0, next: next ?? null }
})
