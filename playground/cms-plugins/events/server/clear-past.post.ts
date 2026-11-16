import { lt, sql } from 'tinyzoo'

// POST /api/cms/_p/events/clear-past — remove events that are over (administrators only:
// declared with `access: 'admin'`, checked before this runs).
export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const t = reg.byName.get('events')!.table
  const removed = await db.delete(t).where(lt(t.startsAt, sql`now()`)).returning({ id: t.id })
  await audit(event, 'events.clear_past', { meta: { count: removed.length } })
  return { removed: removed.length }
})
