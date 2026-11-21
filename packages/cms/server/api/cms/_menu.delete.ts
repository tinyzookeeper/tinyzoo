import { eq } from 'tinyzoo'

// DELETE /api/cms/_menu — back to the menu as the site laid it out (the administrator's
// arrangement is forgotten). Administrators only.
export default defineEventHandler(async (event) => {
  const user = requireCmsAdmin(event)
  const { db, reg } = useCms()
  await db.delete(reg.cmsState).where(eq(reg.cmsState.key, CMS_MENU_STATE_KEY))
  await audit(event, 'menu.reset')
  return cmsMenuFor(user)
})
