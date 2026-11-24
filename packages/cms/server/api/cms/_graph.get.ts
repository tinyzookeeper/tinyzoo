import { CUSTOM_PREFIX } from 'tinyzoo'

// Serializable schema graph that drives /admin. Auth-gated and annotated with
// per-entity permissions so the dashboard can hide what the user can't touch. Per person:
// the fields their role may not read are not in it (nor in the list columns, tabs and sections),
// a field they may read but not edit is marked `readOnly`, and the access rules themselves are not sent.
export default defineEventHandler((event) => {
  const { reg } = useCms()
  const user = requireCmsUser(event)
  const graph = reg.graph
    .filter((g) => accessWhere(reg.byName.get(g.name)!, 'read', user).allowed)
    .map((g) => {
      const e = reg.byName.get(g.name)!
      const locked = hasFieldRules(e) ? uneditableFields(e, user) : new Set<string>()
      // Publishing writes the status (and, scheduling, the date): a role that may not edit those fields cannot publish, whatever its `publish` says.
      const pub = e.publish
      const stateLocked = !!pub && (locked.has(pub.field) || (!!pub.dateField && locked.has(pub.dateField)))
      const can: Record<string, boolean> = {
        create: accessWhere(e, 'create', user).allowed,
        update: accessWhere(e, 'update', user).allowed,
        delete: accessWhere(e, 'delete', user).allowed,
        publish: canPublish(user) && !stateLocked,
      }
      if (!hasFieldRules(e)) return { ...g, can }
      const hidden = unreadableFields(e, user)
      const shown = (k: string) => !hidden.has(k)
      const rules = new Map(fieldRules(e))
      // Dragging into order or into another place writes a field of its own.
      if (g.orderField && locked.has(g.orderField)) can.arrange = false
      if (g.tree && (locked.has(g.tree.parent) || locked.has(g.tree.order))) can.move = false
      return {
        ...g,
        can,
        fields: g.fields.filter((f: any) => shown(f.key)).map((f: any) => {
          const { access: _access, ...meta } = f.meta ?? {}
          // A field this person may read but not change says who can (the roles, named in the admin's words).
          return { ...f, meta, ...(locked.has(f.key) ? { readOnly: true, editableBy: editableBy(rules.get(f.key)) } : {}) }
        }),
        listColumns: g.listColumns.filter(shown),
        searchable: g.searchable.filter(shown),
        tabs: g.tabs ? g.tabs.map((t: any) => ({ ...t, fields: t.fields.filter(shown) })) : g.tabs,
        sections: g.sections ? g.sections.map((s: any) => ({ ...s, fields: s.fields.filter(shown) })).filter((s: any) => s.fields.length) : g.sections,
      }
    })
  // A site with no content type of its own has nothing to show with the blocks that show one, so they are not offered.
  // The answer is a copy for this request: the graph's objects are shared by every site of the design.
  return reg.entities.some((e) => e.name.startsWith(CUSTOM_PREFIX)) ? graph : withoutBindingBlocks(graph)
})
