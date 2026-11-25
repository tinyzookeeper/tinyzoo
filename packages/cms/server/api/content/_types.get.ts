// GET /api/content/_types — the site's own content types (custom types) that are not hidden: their
// labels, address, order and fields, for whatever draws them. Experimental. `{ types: [] }` for a
// site without the feature (and in single mode), so a frontend can ask without knowing. It reads
// what the site's loaded instance holds, never the database.
export default defineEventHandler((event) => {
  assertContentAuth(event)
  setContentCache(event)
  if (!cmsCustomTypes().on) return { types: [] }
  const part = cmsLoadedCustomPart()
  const reg = part?.model?.reg
  // What the instance could not build is not offered: the type must be an entity of its registry, and the field one of its fields.
  const built = (type: string, field: string | null) => {
    const e = reg?.byName.get(type)
    return !!e && (field === null || Object.hasOwn(e.fields, field))
  }
  return { types: publicCustomTypes(part?.doc ?? null, built) }
})
