// GET /api/cms/_singleton/:name — the single row of a global (or null if not yet
// saved), shaped for the admin form. `_singleton` is underscore-prefixed so it wins
// static routing over /api/cms/[entity].
export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const e = getEntity(reg, getRouterParam(event, 'name'))
  if (!e.singleton) throw createError({ statusCode: 404, statusMessage: `Not a global: ${e.name}` })
  const where = authorize(e, 'read', user)

  const [row] = await db.select().from(e.table).where(where).orderBy(e.table.createdAt).limit(1)
  if (row) await hydrateRowForForm(db, reg, e, row)
  return { row: row ?? null }
})
