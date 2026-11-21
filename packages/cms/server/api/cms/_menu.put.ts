// PUT /api/cms/_menu { home, groups: { <id>: [...] }, settings } — an administrator arranges
// the menu, for everyone on this site. Rows are named by key; the groups are the site's own
// (a row sent under a group the site does not have keeps the place it had). Administrators only.
export default defineEventHandler(async (event) => {
  const user = requireCmsAdmin(event)
  const body = parseOr422(cmsMenuBody, await readBody(event))
  const { db, reg } = useCms()
  const known = new Set(cmsMenuSite().sources.map((s) => s.key))
  const unknown = [...body.home, ...Object.values(body.groups).flat(), ...body.settings].find((k) => !known.has(k))
  if (unknown) throw createError({ statusCode: 422, statusMessage: 'Validation failed', data: [{ path: ['home'], code: 'unknown', message: `The menu has no row "${unknown}"` }] })
  const s = reg.cmsState
  await db.insert(s).values({ key: CMS_MENU_STATE_KEY, value: body })
    .onConflictDoUpdate({ target: s.key, set: { value: body, updatedAt: new Date() } })
  await audit(event, 'menu.update')
  return cmsMenuFor(user)
})
