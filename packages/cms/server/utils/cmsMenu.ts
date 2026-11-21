import { z } from 'zod'
import { eq, menuSources, resolveMenu } from 'tinyzoo'
import type { CmsAdminMenuLayout, CmsAdminMenuSaved } from 'tinyzoo'

/** Where an administrator's arrangement of the admin's menu is kept (cms_state): one for the whole site. */
export const CMS_MENU_STATE_KEY = 'admin-menu'

type PluginPage = { to: string; group: 'content' | 'settings'; adminOnly: boolean }
const pluginPages = (): PluginPage[] => ((useRuntimeConfig().public.cmsPlugins as any)?.navItems ?? []) as PluginPage[]

/** Every row the site's menu has (whoever looks), and its forms. */
export function cmsMenuSite() {
  return menuSources(useCms().reg.graph, pluginPages())
}

const keys = z.array(z.string().min(1).max(200)).max(500)
/** What `PUT /api/cms/_menu` takes: the rows of each place, by key. */
export const cmsMenuBody = z.object({ home: keys, groups: z.record(z.string().min(1).max(60), keys), settings: keys })

/** The arrangement an administrator saved, or null when the menu is as the site laid it out. */
export async function readSavedMenu(): Promise<CmsAdminMenuSaved | null> {
  const { db, reg } = useCms()
  const [row] = await db.select().from(reg.cmsState).where(eq(reg.cmsState.key, CMS_MENU_STATE_KEY))
  const parsed = cmsMenuBody.safeParse(row?.value)
  return parsed.success ? parsed.data : null
}

/**
 * The menu as this person sees it: the site's layout with the administrator's arrangement on
 * top, without the rows their role does not open. `customized`: an arrangement is saved.
 */
export async function cmsMenuFor(user: CmsUser): Promise<CmsAdminMenuLayout & { customized: boolean }> {
  const { reg } = useCms()
  const saved = await readSavedMenu()
  const role = roleOf(user)
  // A role the site no longer defines opens nothing.
  if (!role) return { home: [], groups: [], settings: [], forms: [], customized: !!saved }
  const layout = resolveMenu(cmsMenuSite(), reg.menu, saved)
  const pages = new Map(pluginPages().map((p) => [p.to, p]))
  const reads = (name: string) => accessWhere(reg.byName.get(name)!, 'read', user).allowed
  const forms = layout.forms.filter(reads)
  const shown = (key: string) => {
    if (key === '@forms') return forms.length > 0
    if (key === '@media') return role.media !== 'none'
    if (key === '@team' || key === '@privacy') return !!role.manage
    if (key === '@about') return true
    if (key.startsWith('/')) return !pages.get(key)?.adminOnly || !!role.manage
    const e = reg.byName.get(key)
    // Settings someone may not change stay out of their way.
    return !!e && reads(key) && (!e.singleton || accessWhere(e, 'update', user).allowed)
  }
  return {
    home: layout.home.filter(shown),
    // (a group left empty stays: an administrator can drag rows into it)
    groups: layout.groups.map((g) => ({ ...g, items: g.items.filter(shown) })),
    settings: layout.settings.filter(shown),
    forms,
    customized: !!saved,
  }
}
