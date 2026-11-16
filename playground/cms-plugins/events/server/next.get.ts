import { gte, sql } from 'tinyzoo'

// GET /api/cms/_p/events/next and /api/content/_events/next — the next event, for the website.
// Public (`access: 'public'`), so it hands out only what a visitor may see.
export default defineEventHandler(async () => {
  const { db, reg } = useCms()
  const t = reg.byName.get('events')!.table
  const [next] = await db.select({ title: t.title, startsAt: t.startsAt, place: t.place }).from(t).where(gte(t.startsAt, sql`now()`)).orderBy(t.startsAt).limit(1)
  return { next: next ?? null }
})
