// Serializable schema graph that drives /admin. Auth-gated and annotated with
// per-entity permissions so the dashboard can hide what the user can't touch.
export default defineEventHandler((event) => {
  const { reg } = useCms()
  const user = requireCmsUser(event)
  return reg.graph
    .filter((g) => accessWhere(reg.byName.get(g.name)!, 'read', user).allowed)
    .map((g) => {
      const e = reg.byName.get(g.name)!
      return {
        ...g,
        can: {
          create: accessWhere(e, 'create', user).allowed,
          update: accessWhere(e, 'update', user).allowed,
          delete: accessWhere(e, 'delete', user).allowed,
          publish: canPublish(user),
        },
      }
    })
})
