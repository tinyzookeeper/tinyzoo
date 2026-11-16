export default defineEventHandler(async (event) => {
  const { db, reg } = useCms()
  const user = requireCmsUser(event)
  const e = getEntity(reg, getRouterParam(event, 'entity'))
  if (e.singleton) throw createError({ statusCode: 404, statusMessage: 'Use PUT /api/cms/_singleton/:name' })
  authorize(e, 'create', user)

  const body = await readBody(event)
  const data = parseOr422(writeSchema(e, 'create'), body)
  const { values, m2m } = splitPayload(e, data)
  assertPublishAllowed(e, user, values)
  await assertNoRedirectLoop(e, values)
  stampPublishDate(e, values, null)
  values.createdBy = actorId(user)
  values.updatedBy = actorId(user)

  const row = await db.transaction(async (tx: any) => {
    // A page tree: the address under its parent must be free, the tree no deeper than allowed;
    // a new page goes last among its siblings unless a position was asked for.
    if (e.tree) {
      const p = treeProps(e)
      values.id = crypto.randomUUID()
      const { nodes } = await beginTreeWrite(tx, reg, e, { id: values.id, parentId: values[p.parent] ?? null, slug: String(values[p.slug] ?? ''), title: String(values[p.title] ?? '') })
      if (!body || typeof body !== 'object' || !(e.tree.order in body)) values[p.order] = nextPosition(nodes, values[p.parent] ?? null)
    }
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
