<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'
import type { CmsMenuRow } from '../composables/useCmsMenu'

const { data: graph, error: graphError } = await useFetch<any[]>('/api/cms/_graph', { key: 'cms-graph' })
// What the person's role is called, and whether the site still defines it.
// `account`: people sign in with the tinyzoo account here, so the site's name may become the website switcher.
const { data: me } = await useFetch<{ access: { removed: boolean; role: string; label?: any; custom?: boolean }; account?: { enabled: boolean } }>('/api/cms/_auth/me', { key: 'cms-access' })
// A role the site no longer defines: signed in, but no access (the server answers 403 `role-removed`).
const roleRemoved = computed(() => !!me.value?.access?.removed || (graphError.value as any)?.data?.data?.code === 'role-removed')
const { user, clear } = useUserSession()
const route = useRoute()
const colorMode = useColorMode()
const config = useCmsAdminConfig()
const { t, tl, locale, locales, setLocale } = useCmsI18n()
// The menu: what sits beside Home, the groups, and what is behind "Settings". The site lays it out
// (defineAdminMenu), an administrator can rearrange it for everyone; the server leaves out what this
// person's role does not open, and nothing at all for a role the site no longer defines.
const menu = useCmsMenu(graph)
await menu.ready
// Since 2f: an editor shown in the sheet beside a page's preview (the editor in the preview) has none of the admin
// around it, and leaves the sidebar's cookies alone (the admin around the sheet reads them too).
const embedded = useCmsEmbedded()

// The admin's own look (cms-admin.css) applies while this layout is mounted.
const { unbranded, signature } = useCmsAdminHead()

// Focus mode (the Write and Preview editors) folds the sidebar to icons. The
// person's own choice is kept apart, so leaving an editor brings back what they had.
const focus = useCmsFocus()
// The person's own choice lives in a cookie, so the server draws the same sidebar the
// browser will (no jump, no hydration mismatch). Focus folds it on top, after load.
const pref = useCookie<string | number | boolean | null>('cms_sidebar_folded', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', path: '/' })
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
const startFolded = useState('cms-sidebar-start-folded', () => cmsSidebarFolded(pref.value) || (editorFolds.value && !mobileHint))
const collapsed = ref(startFolded.value)
// Nuxt UI keeps the sidebar's width and fold in a cookie of its own (for the browser session)
// and draws the fold it holds. Left alone it can disagree with the choice above (a tab closed
// in an editor's focus mode), and the page jumps once the browser takes over: start it from ours.
const sidebarLayout = useCookie<{ size?: number; collapsed?: boolean } | null>(CMS_SIDEBAR_LAYOUT_COOKIE)
if (!embedded.value && sidebarLayout.value && typeof sidebarLayout.value === 'object' && !!sidebarLayout.value.collapsed !== startFolded.value) {
  sidebarLayout.value = { ...sidebarLayout.value, collapsed: startFolded.value }
}
// A select menu's or the search's option reached with the arrow keys shows the focus ring (cms-admin.css);
// keyboard focus that lands off screen (Tab wrapping round a dialog) is scrolled into view.
cmsTrackKeysWhileMounted()

// The person's websites (the switcher at the top of the menu, the line on the account page): asked
// once the page is shown, and only where people sign in with the tinyzoo account.
onMounted(() => { if (me.value?.account?.enabled) void useCmsAccountSites().load() })

onMounted(() => {
  watch(focus, (on) => { collapsed.value = on || cmsSidebarFolded(pref.value) }, { immediate: true })
  watch(collapsed, (v) => {
    if (focus.value || embedded.value) return
    pref.value = v ? '1' : '0'
  })
})

// The server re-checks the account on every request. If it no longer accepts the
// session (disabled, role or password changed elsewhere, removed), go back to sign-in.
// While rendering on the server: redirect at once (the response also drops the cookie,
// see cms-session); awaiting anything first would lose the page's context.
watch(graphError, (err) => {
  if (err?.statusCode !== 401) return
  const to = { path: '/admin/login', query: { redirect: route.fullPath, reason: 'signedOut' } }
  if (import.meta.server) {
    void navigateTo(to)
    return
  }
  clear().finally(() => navigateTo(to))
}, { immediate: true })

// Every link carries its name, also when the sidebar is folded to icons.
const toNav = (r: CmsMenuRow): NavigationMenuItem => ({ label: r.label, icon: r.icon, to: r.to, 'aria-label': r.label, ...(r.active === undefined ? {} : { active: r.active }) } as NavigationMenuItem)
const homeItem = computed(() => ({ label: t('nav.home'), icon: 'i-lucide-house', to: '/admin', exact: true, 'aria-label': t('nav.home') } as NavigationMenuItem))
// "Settings" is one row: it swaps the menu for the settings' pages, with a way back. The menu
// shows them by itself while one of them is open, and the main menu again on any other page of it
// (a page outside the menu, the account, leaves it as it was).
const onSettingsPage = () => menu.settings.value.some((r) => menu.isAt(r.to))
const inSettings = ref(onSettingsPage())
watch(() => route.path, () => {
  if (onSettingsPage()) inSettings.value = true
  else if (route.path === '/admin' || menu.all.value.some((r) => menu.isAt(r.to))) inSettings.value = false
})
// An administrator arranges the menu for the whole site (CmsMenuEditor).
const arranging = ref(false)
const navigation = computed<NavigationMenuItem[][]>(() => {
  if (inSettings.value && menu.settings.value.length) {
    return [
      [{ label: t('nav.mainMenu'), icon: 'i-lucide-arrow-left', 'aria-label': t('nav.mainMenu'), onSelect: () => { inSettings.value = false } } as NavigationMenuItem],
      [{ label: t('nav.settings'), type: 'label' }, ...menu.settings.value.map(toNav)],
      ...(user.value?.role === 'admin' ? [[{ label: t('menu.arrange'), icon: 'i-lucide-arrow-down-up', 'aria-label': t('menu.arrange'), onSelect: () => { arranging.value = true } } as NavigationMenuItem]] : []),
    ]
  }
  return [
    [homeItem.value, ...menu.home.value.map(toNav)],
    ...menu.groups.value.filter((g) => g.rows.length).map((g) => [{ label: g.label, type: 'label' } as NavigationMenuItem, ...g.rows.map(toNav)]),
  ]
})
// Under the list, always in sight: "Settings" (while the main menu shows) and the website.
const pinned = computed<NavigationMenuItem[]>(() => {
  const first = menu.settings.value[0]
  return [
    ...(first && !inSettings.value ? [{ label: t('nav.settings'), icon: 'i-lucide-settings', to: first.to, trailingIcon: 'i-lucide-chevron-right', 'aria-label': t('nav.settings'), onSelect: () => { inSettings.value = true } } as NavigationMenuItem] : []),
    { label: t('nav.viewSite'), icon: 'i-lucide-globe', to: config.value.siteUrl, target: '_blank', 'aria-label': t('nav.viewSite') } as NavigationMenuItem,
  ]
})

// The search's "Go to" list: every place in the menu, plus the account.
const places = computed(() => [
  { label: t('nav.home'), icon: 'i-lucide-house', to: '/admin' },
  ...menu.all.value.map((r) => ({ label: r.label, icon: r.icon, to: r.to })),
  { label: t('nav.account'), icon: 'i-lucide-user-round', to: '/admin/account' },
])

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '?'
const initials = computed(() => initialsOf(user.value?.name ?? '?'))
const roleLabel = computed(() => {
  const role = user.value?.role as string | undefined
  if (role === 'admin' || role === 'editor' || role === 'author') return t(`roles.${role}.name`)
  // A role the site defined has its own, translated name; one it no longer has shows as stored.
  return me.value?.access?.custom ? tl(me.value.access.label, role ?? '') : role
})

// Nuxt UI names the notifications area "Notifications (F8)" in English whatever its locale
// (the label is not part of it): the admin names it in its own language.
onMounted(() => {
  const name = () => t('app.notifications', { hotkey: 'F8' })
  const apply = () => document.querySelector('[role="region"]:has(> ol[data-slot="viewport"])')?.setAttribute('aria-label', name())
  // The area is teleported to <body> when Nuxt UI mounts its toaster; name it as soon as it exists,
  // and again when the language changes.
  const watcher = new MutationObserver(apply)
  watcher.observe(document.body, { childList: true })
  watch(locale, apply, { immediate: true })
  onBeforeUnmount(() => watcher.disconnect())
})

/** The skip link: focus the page's <main> (a plain #hash would also push a route). */
function focusMain() {
  const main = document.getElementById('cms-main')
  main?.focus({ preventScroll: false })
  main?.scrollIntoView?.({ block: 'start' })
}

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
  ],
  [{ label: t('user.signOut'), icon: 'i-lucide-log-out', color: 'error' as const, onSelect: logout }],
])
</script>

<template>
  <!-- the sidebar's width and fold are kept in a cookie, not localStorage: the server reads it too, so both draw the same first frame -->
  <!-- in the sheet beside a page (since 2f) the sizes are kept apart, so the admin around it never reads them -->
  <UDashboardGroup unit="rem" :storage="embedded ? 'local' : 'cookie'" storage-key="cms-admin">
    <!-- the first stop for the keyboard: past the sidebar's links, to the page -->
    <a
      v-if="!embedded" href="#cms-main" class="cms-skip-link" @click.prevent="focusMain"
    >{{ t('app.skipToContent') }}</a>
    <UDashboardSidebar
      v-if="!embedded"
      id="main" v-model:collapsed="collapsed"
      collapsible resizable :default-size="16" :min-size="14" :max-size="20" :collapsed-size="4.25"
      class="cms-sidebar"
      :ui="{ root: 'bg-(--cms-sidebar-bg) border-r border-default', header: 'h-(--ui-header-height)', footer: 'border-t border-default flex-col items-stretch gap-0 py-2' }"
    >
      <template #header="{ collapsed }">
        <!-- the client's brand: the full logo, the mark with the name, or the initials (CmsBrandLogo);
             for someone with other websites in their tinyzoo account, a menu of them (CmsSiteSwitcher) -->
        <CmsSiteSwitcher :collapsed="collapsed" :enabled="!!me?.account?.enabled" />
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton
          :collapsed="collapsed" :label="t('search.button')" :tooltip="collapsed ? { text: t('search.button') } : false"
          variant="outline" class="ring-default bg-default" :class="collapsed ? '' : 'w-full'"
        />
        <!-- one landmark, named; the groups are its lists -->
        <UNavigationMenu
          :items="navigation" orientation="vertical" :collapsed="collapsed" tooltip :aria-label="t('nav.mainMenu')"
          :ui="{ label: 'text-xs font-medium text-muted pt-4', link: 'text-sm py-1.5 pointer-coarse:py-3 data-active:font-medium' }"
        />
      </template>

      <template #footer="{ collapsed }">
        <!-- "Settings" and the website stay in sight, under the list that scrolls -->
        <UNavigationMenu
          :items="pinned" orientation="vertical" :collapsed="collapsed" tooltip :aria-label="t('nav.viewSite')"
          class="mb-2 pb-2 border-b border-default" :ui="{ link: 'text-sm py-1.5 pointer-coarse:py-3 text-muted' }"
        />
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
        <!-- tinyzoo signs the admin, quietly (the client's name leads at the top); `signature: false` hides it -->
        <div v-if="signature && !unbranded && !collapsed" class="flex items-center gap-1.5 px-2.5 pt-2 pb-0.5 opacity-70">
          <CmsMascot class="h-3 w-auto" />
          <CmsWordmark class="h-2.5 w-auto" />
          <span class="sr-only">{{ cmsBrand.name }}</span>
        </div>
      </template>
    </UDashboardSidebar>

    <CmsRoleRemoved v-if="roleRemoved && !route.path.startsWith('/admin/account')" :role="String(user?.role ?? '')" />
    <slot v-else />
    <CmsSearch v-if="!embedded" :graph="graph ?? []" :places="places" />
    <CmsMenuEditor v-if="user?.role === 'admin' && !embedded" v-model:open="arranging" :graph="graph ?? []" />
    <CmsConfirmDialog />
  </UDashboardGroup>
</template>
