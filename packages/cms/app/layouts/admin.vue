<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'

const { data: graph, error: graphError } = await useFetch<any[]>('/api/cms/_graph', { key: 'cms-graph' })
const { user, clear } = useUserSession()
const route = useRoute()
const colorMode = useColorMode()
useCmsUiLocale()
const config = useCmsAdminConfig()
const { t, tl, locale, locales, setLocale, entityLabel } = useCmsI18n()

// The admin's own look (cms-admin.css) applies while this layout is mounted.
const { productName, unbranded } = useCmsAdminHead()

// Focus mode (the Write and Preview editors) folds the sidebar to icons. The
// person's own choice is kept apart, so leaving an editor brings back what they had.
const focus = useCmsFocus()
// The person's own choice lives in a cookie, so the server draws the same sidebar the
// browser will (no jump, no hydration mismatch). Focus folds it on top, after load.
const pref = useCookie<string | null>('cms_sidebar_folded', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', path: '/' })
// The Write and Preview editors fold it (on wide screens, where the sidebar shows):
// start folded there already, so the page does not jump once the editor mounts.
const editorFolds = computed(() => {
  const id = route.params.id
  if (!id) return false
  const e = (graph.value ?? []).find((x: any) => x.name === route.params.entity)
  return !!e && !e.singleton && (e.editor === 'write' || e.editor === 'preview')
})
// Decided once, on the server, and handed to the browser in the payload, so both
// draw the same sidebar. Phones get the sidebar as a drawer (never folded): there
// the browser's own "mobile" hint keeps the editor from pre-folding it.
const mobileHint = (() => {
  if (!import.meta.server) return false
  const h = useRequestHeaders(['sec-ch-ua-mobile', 'user-agent'])
  return h['sec-ch-ua-mobile'] === '?1' || /Mobi|Android|iPhone|iPad/i.test(h['user-agent'] ?? '')
})()
const startFolded = useState('cms-sidebar-start-folded', () => pref.value === '1' || (editorFolds.value && !mobileHint))
const collapsed = ref(startFolded.value)
onMounted(() => {
  watch(focus, (on) => { collapsed.value = on || pref.value === '1' }, { immediate: true })
  watch(collapsed, (v) => {
    if (focus.value) return
    pref.value = v ? '1' : '0'
  })
})

// The server re-checks the account on every request. If it no longer accepts the
// session (disabled, role or password changed elsewhere, removed), go back to sign-in.
// While rendering on the server: redirect at once (the response also drops the cookie,
// see cms-session); awaiting anything first would lose the page's context.
watch(graphError, (err) => {
  if (err?.statusCode !== 401) return
  const to = { path: '/admin/login', query: { redirect: route.fullPath } }
  if (import.meta.server) {
    void navigateTo(to)
    return
  }
  clear().finally(() => navigateTo(to))
}, { immediate: true })

// Every link carries its name, also when the sidebar is folded to icons.
const toNav = (e: any): NavigationMenuItem => ({ label: entityLabel(e), icon: e.icon, to: `/admin/${e.name}`, 'aria-label': entityLabel(e) } as NavigationMenuItem)
// Entries plugins add to the sidebar (defineCmsPlugin `navItems`), by where they go.
type PluginNavItem = { label: any; icon?: string; to: string; group: 'content' | 'settings'; adminOnly: boolean }
const pluginNavItems = ((useRuntimeConfig().public.cmsPlugins as any)?.navItems ?? []) as PluginNavItem[]
const pluginNav = (group: PluginNavItem['group']): NavigationMenuItem[] => pluginNavItems
  .filter((i) => i.group === group && (!i.adminOnly || user.value?.role === 'admin'))
  .map((i) => ({ label: tl(i.label), icon: i.icon, to: i.to, 'aria-label': tl(i.label) } as NavigationMenuItem))
const navigation = computed<NavigationMenuItem[][]>(() => {
  const all = graph.value ?? []
  const collections = all.filter((e) => !e.singleton)
  // Settings someone may not change (an author and the site settings) stay out of their way.
  const settings = all.filter((e) => e.singleton && e.can?.update !== false)
  const groups: NavigationMenuItem[][] = [[{ label: t('nav.home'), icon: 'i-lucide-house', to: '/admin', exact: true, 'aria-label': t('nav.home') } as NavigationMenuItem]]
  const contentExtra = pluginNav('content')
  if (collections.length || contentExtra.length) groups.push([{ label: t('nav.content'), type: 'label' }, ...collections.map(toNav), ...contentExtra, { label: t('media.libraryTitle'), icon: 'i-lucide-images', to: '/admin/media', 'aria-label': t('media.libraryTitle') } as NavigationMenuItem])
  const settingsGroup: NavigationMenuItem[] = [...settings.map(toNav), ...pluginNav('settings')]
  if (user.value?.role === 'admin') {
    settingsGroup.push({ label: t('nav.team'), icon: 'i-lucide-users-round', to: '/admin/team', 'aria-label': t('nav.team') } as NavigationMenuItem)
    settingsGroup.push({ label: t('nav.privacy'), icon: 'i-lucide-shield-check', to: '/admin/privacy', 'aria-label': t('nav.privacy') } as NavigationMenuItem)
  }
  if (settingsGroup.length) groups.push([{ label: t('nav.settings'), type: 'label' }, ...settingsGroup])
  return groups
})

// The search's "Go to" list: every place in the menu, plus the account.
const places = computed(() => [
  ...navigation.value.flat().filter((i) => i.type !== 'label').map((i) => ({ label: String(i.label), icon: i.icon as string, to: i.to as string })),
  { label: t('nav.account'), icon: 'i-lucide-user-round', to: '/admin/account' },
])

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '?'
const initials = computed(() => initialsOf(user.value?.name ?? '?'))
const roleLabel = computed(() => {
  const role = user.value?.role as string | undefined
  return role === 'admin' || role === 'editor' || role === 'author' ? t(`roles.${role}.name`) : role
})

async function logout() {
  await $fetch('/api/cms/_auth/logout', { method: 'POST' })
  await clear()
  await navigateTo('/admin/login')
}

const userMenu = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: user.value?.name, description: user.value?.email } as DropdownMenuItem],
  [
    {
      label: t('user.appearance'),
      icon: colorMode.value === 'dark' ? 'i-lucide-moon' : 'i-lucide-sun',
      children: (['light', 'dark', 'system'] as const).map((mode) => ({
        label: t(`user.${mode}`),
        icon: mode === 'light' ? 'i-lucide-sun' : mode === 'dark' ? 'i-lucide-moon' : 'i-lucide-monitor',
        type: 'checkbox' as const,
        checked: colorMode.preference === mode,
        onSelect: (e: Event) => { e.preventDefault(); colorMode.preference = mode },
      })),
    },
    {
      label: t('user.language'),
      icon: 'i-lucide-languages',
      children: locales.value.map((code) => ({
        label: CMS_ADMIN_LOCALES[code] ?? code,
        type: 'checkbox' as const,
        checked: locale.value === code,
        onSelect: (e: Event) => { e.preventDefault(); setLocale(code) },
      })),
    },
    { label: t('nav.account'), icon: 'i-lucide-user-round', to: '/admin/account' },
    // The admin's building blocks: for whoever runs the site, not for every editor.
    ...(user.value?.role === 'admin' ? [{ label: t('nav.designSystem'), icon: 'i-lucide-swatch-book', to: '/admin/styleguide' }] : []),
  ],
  [{ label: t('user.signOut'), icon: 'i-lucide-log-out', color: 'error' as const, onSelect: logout }],
])
</script>

<template>
  <UDashboardGroup unit="rem" storage="local" storage-key="cms-admin">
    <UDashboardSidebar
      v-model:collapsed="collapsed"
      collapsible resizable :default-size="16" :min-size="14" :max-size="20" :collapsed-size="4.25"
      class="cms-sidebar"
      :ui="{ root: 'bg-(--cms-sidebar-bg) border-r border-default', header: 'h-(--ui-header-height)', footer: 'border-t border-default flex-col items-stretch gap-0 py-2' }"
    >
      <template #header="{ collapsed }">
        <NuxtLink to="/admin" class="flex items-center gap-2.5 min-w-0" :class="collapsed ? 'mx-auto' : ''">
          <CmsMascot v-if="unbranded" class="h-6 w-auto shrink-0" />
          <span v-else class="size-7 shrink-0 rounded-lg bg-inverted text-inverted grid place-items-center text-xs font-bold leading-none cms-display tracking-normal" aria-hidden="true">
            {{ initialsOf(productName) }}
          </span>
          <span v-if="!collapsed" class="truncate font-semibold text-highlighted">{{ productName }}</span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton
          :collapsed="collapsed" :label="t('search.button')" :tooltip="collapsed ? { text: t('search.button') } : false"
          variant="outline" class="ring-default bg-default" :class="collapsed ? '' : 'w-full'"
        />
        <UNavigationMenu
          v-for="(group, i) in navigation" :key="i"
          :items="group" orientation="vertical" :collapsed="collapsed" tooltip
          :ui="{ label: 'text-xs font-medium text-muted pt-4', link: 'text-sm py-1.5 data-active:font-medium' }"
        />
        <div class="mt-auto">
          <UNavigationMenu
            :items="[{ label: t('nav.viewSite'), icon: 'i-lucide-globe', to: config.siteUrl, target: '_blank', 'aria-label': t('nav.viewSite') }]"
            orientation="vertical" :collapsed="collapsed" tooltip :ui="{ link: 'text-sm py-1.5 text-muted' }"
          />
        </div>
      </template>

      <template #footer="{ collapsed }">
        <UDropdownMenu :items="userMenu" :content="{ align: 'start', side: collapsed ? 'right' : 'top' }" class="w-full">
          <UButton
            color="neutral" variant="ghost" class="w-full p-1.5" :class="collapsed ? 'justify-center' : ''"
            :aria-label="t('user.account')"
          >
            <span class="size-7 shrink-0 rounded-full bg-(--cms-moment-strong) text-highlighted grid place-items-center text-xs font-semibold">{{ initials }}</span>
            <span v-if="!collapsed" class="min-w-0 flex-1 text-left">
              <span class="block text-sm font-medium text-highlighted truncate">{{ user?.name }}</span>
              <span class="block text-xs text-muted truncate">{{ roleLabel }}</span>
            </span>
            <UIcon v-if="!collapsed" name="i-lucide-chevrons-up-down" class="size-4 text-dimmed shrink-0" />
          </UButton>
        </UDropdownMenu>
        <!-- tinyzoo signs the admin, quietly (the client's name leads at the top) -->
        <div v-if="!unbranded && !collapsed" class="flex items-center gap-1.5 px-2.5 pt-2 pb-0.5 opacity-70">
          <CmsMascot class="h-3 w-auto" />
          <CmsWordmark class="h-2.5 w-auto" />
          <span class="sr-only">{{ cmsBrand.name }}</span>
        </div>
      </template>
    </UDashboardSidebar>

    <slot />
    <CmsSearch :graph="graph ?? []" :places="places" />
    <CmsConfirmDialog />
  </UDashboardGroup>
</template>
