import type { Ref } from 'vue'
import type { CmsAdminMenuLayout, LocalizedText } from 'tinyzoo'

/** One row of the admin's menu, ready to draw. */
export interface CmsMenuRow {
  /** A collection's or global's name, a built-in row ('@media'…), or a plugin page's address. */
  key: string
  label: string
  icon: string
  to: string
  /** Set on the forms' row: it is the current page on any of the forms. */
  active?: boolean
}

type PluginNavItem = { label: LocalizedText; icon?: string; to: string }

/**
 * The admin's menu for the signed-in person (`GET /api/cms/_menu`: the site's layout, an
 * administrator's arrangement on top, without what their role does not open), as rows to draw:
 * beside Home, in groups, and behind "Settings". `graph` is the admin graph (labels and icons).
 */
export function useCmsMenu(graph: Ref<any[] | null | undefined>) {
  const { t, tl, entityLabel } = useCmsI18n()
  const route = useRoute()
  const request = useFetch<CmsAdminMenuLayout & { customized: boolean; builder?: true }>('/api/cms/_menu', { key: 'cms-menu' })
  const layout = request.data
  const pages = new Map((((useRuntimeConfig().public.cmsPlugins as any)?.navItems ?? []) as PluginNavItem[]).map((i) => [i.to, i]))
  const byName = computed(() => new Map((graph.value ?? []).map((e: any) => [e.name as string, e])))
  /** Whether the address shown is this row's page, or one under it (an entry of the collection). */
  const isAt = (to: string) => (to === '/admin' ? route.path === '/admin' : route.path === to || route.path.startsWith(`${to}/`))
  /** The forms' collections (graph entries), in the order of the messages page. */
  const forms = computed<any[]>(() => (layout.value?.forms ?? []).map((name) => byName.value.get(name)).filter(Boolean))

  const builtin: Record<string, () => Omit<CmsMenuRow, 'key'>> = {
    '@media': () => ({ label: t('media.libraryTitle'), icon: 'i-lucide-images', to: '/admin/media' }),
    // (one type's page, /admin/_model/<name>, is a page of its own: the row stays the current one there)
    '@model': () => ({ label: t('nav.model'), icon: 'i-lucide-shapes', to: '/admin/_model', active: isAt('/admin/_model') }),
    '@team': () => ({ label: t('nav.team'), icon: 'i-lucide-users-round', to: '/admin/team' }),
    '@privacy': () => ({ label: t('nav.privacy'), icon: 'i-lucide-shield-check', to: '/admin/privacy' }),
    '@about': () => ({ label: t('nav.about'), icon: 'i-lucide-info', to: '/admin/about' }),
  }
  function row(key: string): CmsMenuRow | null {
    if (key === '@forms') {
      const all = forms.value
      if (!all.length) return null
      // One form keeps its own name; several share a row, and the page moves between them.
      if (all.length === 1) return { key, label: entityLabel(all[0]), icon: all[0].icon, to: `/admin/${all[0].name}` }
      return { key, label: t('nav.messages'), icon: 'i-lucide-inbox', to: `/admin/${all[0].name}`, active: all.some((f) => isAt(`/admin/${f.name}`)) }
    }
    if (builtin[key]) return { key, ...builtin[key]() }
    if (key.startsWith('/')) {
      const page = pages.get(key)
      return page ? { key, label: tl(page.label), icon: page.icon ?? 'i-lucide-circle', to: page.to } : null
    }
    const e = byName.value.get(key)
    return e ? { key, label: entityLabel(e), icon: e.icon, to: `/admin/${e.name}` } : null
  }
  const rows = (keys: string[] | undefined) => (keys ?? []).map(row).filter((r): r is CmsMenuRow => !!r)
  const groupLabel = (g: { id: string; label: LocalizedText | null }) => (g.label ? tl(g.label, g.id) : g.id === 'content' ? t('nav.content') : g.id === 'website' ? t('nav.website') : g.id)

  const home = computed(() => rows(layout.value?.home))
  /** Every group of the site, the empty ones too (the menu draws only those with rows). */
  const groups = computed(() => (layout.value?.groups ?? []).map((g) => ({ id: g.id, label: groupLabel(g), rows: rows(g.items) })))
  const settings = computed(() => rows(layout.value?.settings))
  const all = computed(() => [...home.value, ...groups.value.flatMap((g) => g.rows), ...settings.value])

  return {
    /** Resolves once the menu is loaded (`await menu.ready`). */
    ready: request as unknown as Promise<unknown>,
    refresh: request.refresh,
    /** An administrator arranged the menu (it is not as the site laid it out). */
    customized: computed(() => !!layout.value?.customized),
    home, groups, settings, all, forms, isAt,
  }
}
