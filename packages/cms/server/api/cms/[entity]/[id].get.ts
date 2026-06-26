import { eq } from '@my-cms/core'

export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const e = getEntity(reg, getRouterParam(event, 'entity'))
  const rowFilter = authorize(e, 'read', user)
  const id = getRouterParam(event, 'id')!

  const [row] = await db.select().from(e.table).where(both(eq(e.table.id, id), rowFilter))
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  for (const [key, fld] of Object.entries(e.fields)) {
    if (fld.relation?.kind !== 'many-to-many') continue
    const j = reg.junctionByOwnerField.get(`${e.name}.${key}`)!
    const links: any[] = await db.select().from(j.table).where(eq(j.table[j.ownerCol], id))
    row[key] = links.map((l) => l[j.targetCol])
  }

  // Owned FKs (media + to-one relations) live in the row as `${key}Id`, but the
  // edit form (and write contract) is keyed by the field name — alias them back
  // so the form pre-populates. Also attach the resolved media record for preview.
  for (const [key, fld] of Object.entries(e.fields)) {
    const ownsFk = fld.type === 'media' || fld.relation?.kind === 'many-to-one'
    if (!ownsFk) continue
    const fkId = row[`${key}Id`] ?? null
    row[key] = fkId
    if (fld.type === 'media') {
      row[`${key}__media`] = fkId
        ? (await db.select().from(reg.cmsMedia).where(eq(reg.cmsMedia.id, fkId)))[0] ?? null
        : null
    }
  }
  return { row }
})
