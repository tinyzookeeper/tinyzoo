// GET /api/cms/_menu — the admin's menu for the signed-in person: the rows beside Home, the
// groups and what sits behind "Settings", each row by its key (a collection's or global's name,
// a built-in row such as '@media', or the admin address of a plugin's page), and the forms in
// the order of the messages page. Where things go: the site's `defineAdminMenu` and, on top, what
// an administrator arranged in the admin.
export default defineEventHandler(async (event) => {
  const user = requireCmsAccount(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  const menu = await cmsMenuFor(user)
  // The editor in the preview (experimental): the admin learns of the switch here, and only when it is on.
  return cmsBuilderSwitch() ? { ...menu, builder: true as const } : menu
})
