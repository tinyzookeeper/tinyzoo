<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'

const { data: graph, error: graphError } = await useFetch<any[]>('/api/cms/_graph', { key: 'cms-graph' })
const { user, clear } = useUserSession()
const route = useRoute()
const colorMode = useColorMode()
const config = useCmsAdminConfig()
const { t, locale, locales, setLocale, entityLabel } = useCmsI18n()

// The admin's own look (cms-admin.css) applies while this layout is mounted.
const { productName } = useCmsAdminHead()

// The server re-checks the account on every request. If it no longer accepts the
// session (disabled, password changed elsewhere, removed), go back to sign-in.
watch(graphError, async (err) => {
  if (err?.statusCode === 401) {
    await clear()
    await navigateTo({ path: '/admin/login', query: { redirect: route.fullPath } })
  }
}, { immediate: true })

const toNav = (e: any): NavigationMenuItem => ({ label: entityLabel(e), icon: e.icon, to: `/admin/${e.name}` })
const navigation = computed<NavigationMenuItem[][]>(() => {
  const all = graph.value ?? []
  const collections = all.filter((e) => !e.singleton)
  const settings = all.filter((e) => e.singleton)
  const groups: NavigationMenuItem[][] = [[{ label: t('nav.home'), icon: 'i-lucide-house', to: '/admin', exact: true }]]
  if (collections.length) groups.push([{ label: t('nav.content'), type: 'label' }, ...collections.map(toNav), { label: t('media.libraryTitle'), icon: 'i-lucide-images', to: '/admin/media' }])
  const settingsGroup: NavigationMenuItem[] = settings.map(toNav)
  if (user.value?.role === 'admin') settingsGroup.push({ label: t('nav.team'), icon: 'i-lucide-users-round', to: '/admin/team' })
  if (settingsGroup.length) groups.push([{ label: t('nav.settings'), type: 'label' }, ...settingsGroup])
  return groups
})

const initials = computed(() =>
  (user.value?.name ?? '?').split(/\s+/).map((p: string) => p[0]).join('').slice(0, 2).toUpperCase(),
)
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
    { label: t('nav.designSystem'), icon: 'i-lucide-swatch-book', to: '/admin/styleguide' },
  ],
  [{ label: t('user.signOut'), icon: 'i-lucide-log-out', color: 'error' as const, onSelect: logout }],
])
</script>

<template>
  <UDashboardGroup unit="rem" storage="local" storage-key="cms-admin">
    <UDashboardSidebar
      collapsible resizable :default-size="16" :min-size="14" :max-size="20" :collapsed-size="4.25"
      :ui="{ root: 'bg-(--cms-sidebar-bg) border-r border-default', header: 'h-(--ui-header-height)', footer: 'border-t border-default' }"
    >
      <template #header="{ collapsed }">
        <NuxtLink to="/admin" class="flex items-center gap-2.5 min-w-0" :class="collapsed ? 'mx-auto' : ''">
          <span class="size-7 shrink-0 rounded-md bg-inverted text-inverted grid place-items-center text-sm font-semibold leading-none" aria-hidden="true">
            {{ productName.charAt(0) }}
          </span>
          <span v-if="!collapsed" class="truncate font-semibold text-highlighted">{{ productName }}</span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          v-for="(group, i) in navigation" :key="i"
          :items="group" orientation="vertical" :collapsed="collapsed" tooltip
          :ui="{ label: 'text-xs font-medium text-dimmed pt-4', link: 'text-sm py-1.5' }"
        />
        <div class="mt-auto">
          <UNavigationMenu
            :items="[{ label: t('nav.viewSite'), icon: 'i-lucide-globe', to: config.siteUrl, target: '_blank' }]"
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
            <span class="size-7 shrink-0 rounded-full bg-elevated text-highlighted grid place-items-center text-xs font-medium">{{ initials }}</span>
            <span v-if="!collapsed" class="min-w-0 flex-1 text-left">
              <span class="block text-sm font-medium text-highlighted truncate">{{ user?.name }}</span>
              <span class="block text-xs text-muted truncate">{{ roleLabel }}</span>
            </span>
            <UIcon v-if="!collapsed" name="i-lucide-chevrons-up-down" class="size-4 text-dimmed shrink-0" />
          </UButton>
        </UDropdownMenu>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
