// Serializable schema graph that drives /admin. Auth-gated and annotated with
// per-entity permissions so the dashboard can hide what the user can't touch. Per person:
// the fields their role may not read are not in it (nor in the list columns, tabs and sections),
// a field they may read but not edit is marked `readOnly`, and the access rules themselves are not sent.
export default defineEventHandler((event) => {
  const { reg } = useCms()
  const user = requireCmsUser(event)
  return reg.graph
    .filter((g) => accessWhere(reg.byName.get(g.name)!, 'read', user).allowed)
    .map((g) => {
      const e = reg.byName.get(g.name)!
      const can: Record<string, boolean> = {
        create: accessWhere(e, 'create', user).allowed,
        update: accessWhere(e, 'update', user).allowed,
        delete: accessWhere(e, 'delete', user).allowed,
        publish: canPublish(user),
      }
      if (!hasFieldRules(e)) return { ...g, can }
      const hidden = unreadableFields(e, user)
      const locked = uneditableFields(e, user)
      const shown = (k: string) => !hidden.has(k)
      // Dragging into order or into another place writes a field of its own.
      if (g.orderField && locked.has(g.orderField)) can.arrange = false
      if (g.tree && (locked.has(g.tree.parent) || locked.has(g.tree.order))) can.move = false
      return {
        ...g,
        can,
        fields: g.fields.filter((f: any) => shown(f.key)).map((f: any) => {
          const { access: _access, ...meta } = f.meta ?? {}
          return { ...f, meta, ...(locked.has(f.key) ? { readOnly: true } : {}) }
        }),
        listColumns: g.listColumns.filter(shown),
        searchable: g.searchable.filter(shown),
        tabs: g.tabs ? g.tabs.map((t: any) => ({ ...t, fields: t.fields.filter(shown) })) : g.tabs,
        sections: g.sections ? g.sections.map((s: any) => ({ ...s, fields: s.fields.filter(shown) })).filter((s: any) => s.fields.length) : g.sections,
      }
    })
})
