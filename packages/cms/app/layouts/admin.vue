<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'

const { data: graph } = await useFetch<any[]>('/api/cms/_graph', { key: 'cms-graph' })
const { user, clear } = useUserSession()
const router = useRouter()
const colorMode = useColorMode()
const config = useCmsAdminConfig()
const { t, tl, locale, locales, setLocale, entityLabel } = useCmsI18n()

const productName = computed(() => tl(config.value.name, 'Content'))

// The admin's own look (cms-admin.css) applies while this layout is mounted.
useHead(() => ({
  htmlAttrs: { 'lang': locale.value, 'data-cms-admin': '', 'data-cms-accent': config.value.accent },
  titleTemplate: (title?: string) => (title ? `${title} · ${productName.value}` : `${t('app.adminTitle')} · ${productName.value}`),
}))

const toNav = (e: any): NavigationMenuItem => ({ label: entityLabel(e), icon: e.icon, to: `/admin/${e.name}` })
const navigation = computed<NavigationMenuItem[][]>(() => {
  const all = graph.value ?? []
  const collections = all.filter((e) => !e.singleton)
  const settings = all.filter((e) => e.singleton)
  const groups: NavigationMenuItem[][] = [[{ label: t('nav.home'), icon: 'i-lucide-house', to: '/admin', exact: true }]]
  if (collections.length) groups.push([{ label: t('nav.content'), type: 'label' }, ...collections.map(toNav)])
  if (settings.length) groups.push([{ label: t('nav.settings'), type: 'label' }, ...settings.map(toNav)])
  return groups
})

const initials = computed(() =>
  (user.value?.name ?? '?').split(/\s+/).map((p: string) => p[0]).join('').slice(0, 2).toUpperCase(),
)
const roleLabel = computed(() => {
  const role = user.value?.role as string | undefined
  return role === 'admin' || role === 'editor' ? t(`user.roles.${role}`) : role
})

async function logout() {
  await $fetch('/api/_cms/logout', { method: 'POST' })
  await clear()
  await router.push('/login')
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
