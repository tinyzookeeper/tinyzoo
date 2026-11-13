export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const e = getEntity(reg, getRouterParam(event, 'entity'))
  if (e.singleton) throw createError({ statusCode: 404, statusMessage: 'Use PUT /api/cms/_singleton/:name' })
  authorize(e, 'create', user)

  const data = parseOr422(e.insertSchema, await readBody(event))
  const { values, m2m } = splitPayload(e, data)
  assertPublishAllowed(e, user, values)
  stampPublishDate(e, values, null)
  values.createdBy = actorId(user)
  values.updatedBy = actorId(user)

  const row = await db.transaction(async (tx: any) => {
    const [created] = await tx.insert(e.table).values(values).returning()
    await writeM2M(tx, reg, e, created.id, m2m)
    return created
  }).catch((err: unknown) => rethrowDbError(err, e, 'write'))
  await audit(event, 'entry.create', { entity: e.name, recordId: row.id })
  if (publishAction(e, null, row) === 'entry.publish') await audit(event, 'entry.publish', { entity: e.name, recordId: row.id })
  await reportChange(event, { type: 'entry.created', entity: e, id: row.id, after: row })
  setResponseStatus(event, 201)
  return { row }
})
