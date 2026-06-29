import { and, desc, sql } from '@my-cms/core'

// GET /api/cms/_media — paginated media library (newest first). Optional ?q= search
// over alt/key/mime, and ?accept= (e.g. "image/*") to filter by MIME so a typed
// picker's count + items match. Powers the media-library picker.
export default defineEventHandler(async (event) => {
  requireCmsUser(event)
  const { db, reg } = useCms()
  const m = reg.cmsMedia

  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(60, Math.max(1, Number(query.limit) || 24))
  const offset = Math.min((page - 1) * limit, 100_000) // bound deep-offset scans
  const q = String(query.q ?? '').trim().slice(0, 100)
  const accept = String(query.accept ?? '').trim()

  const conds: any[] = []
  if (q) {
    // Escape LIKE wildcards so a literal % / _ in the query can't widen the match.
    const esc = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    conds.push(sql`(${m.alt} ilike ${esc} or ${m.key} ilike ${esc} or ${m.mime} ilike ${esc})`)
  }
  if (accept && accept !== '*') {
    const parts = accept.split(',').map((s) => s.trim()).filter(Boolean)
    const mimeConds = parts.map((a) => a.endsWith('/*') ? sql`${m.mime} ilike ${`${a.slice(0, -1)}%`}` : sql`${m.mime} = ${a}`)
    if (mimeConds.length) conds.push(sql`(${sql.join(mimeConds, sql` or `)})`)
  }
  const where = conds.length ? and(...conds) : undefined

  const rows = await db.select().from(m).where(where).orderBy(desc(m.createdAt)).limit(limit).offset(offset)
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(m).where(where)
  return { items: rows, total: count, page, limit }
})
