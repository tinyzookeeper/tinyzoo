<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'

// The sidebar: the workspace switcher on top, the team switcher below it (a workspace with one
// team has none), the pages of this workspace and team, then the teams with a health dot each.
const { me: user, signOut } = useKeeperUser()
const { me, workspace, team, role, link, swap, everywhere, isGuest } = useScope()
// Settings, password and About live in a workspace: the last one, or the first.
const anyBase = computed(() => scopePath(me.value, useLastScope().value) ?? '')
const colorMode = useColorMode()
const open = ref(false)
const close = () => { open.value = false }
const creating = ref(false)

const items = computed<NavigationMenuItem[]>(() => everywhere.value
  ? [
      { label: 'Overview', icon: 'i-lucide-layout-grid', to: '/home', exact: true, onSelect: close },
      { label: 'Traffic', icon: 'i-lucide-chart-line', to: '/home/traffic', onSelect: close },
      { label: 'Versions', icon: 'i-lucide-git-branch', to: '/home/versions', onSelect: close },
    ]
  : workspace.value && isGuest.value
  ? [{ label: 'Your sites', icon: 'i-lucide-house', to: link(), exact: true, onSelect: close }]
  : workspace.value
  ? [
      { label: 'Sites', icon: 'i-lucide-house', to: link(), exact: true, onSelect: close, badge: String((team.value ?? workspace.value).sites || '') || undefined },
      { label: 'Traffic', icon: 'i-lucide-chart-line', to: link('/traffic'), onSelect: close },
      { label: 'Versions', icon: 'i-lucide-git-branch', to: link('/versions'), onSelect: close },
    ]
  : [])
// On Every workspace: each workspace with its dot. In a workspace: its teams.
const workspaceItems = computed<NavigationMenuItem[]>(() => (everywhere.value
  ? workingWorkspaces(me.value).map((w) => ({ label: w.name, to: `/w/${w.slug}/t/all`, onSelect: close, slot: 'team' as const, health: w }))
  : []))
const teamItems = computed<NavigationMenuItem[]>(() => (workspace.value && !isGuest.value && workspace.value.teams.length > 1
  ? workspace.value.teams.map((t) => ({ label: t.name, to: swap(workspace.value!.slug, t.slug), active: team.value?.id === t.id, onSelect: close, slot: 'team' as const, health: t }))
  : []))
const settingsBase = computed(() => (workspace.value ? link() : anyBase.value))
const footerItems = computed<NavigationMenuItem[]>(() => (workspace.value && !isGuest.value ? [{ label: 'Settings', icon: 'i-lucide-settings-2', to: link('/settings'), onSelect: close }] : []))

const dark = computed(() => colorMode.value === 'dark')
const initials = (text: string | undefined) => (text ?? '').split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || 'K'

const menu = computed<DropdownMenuItem[][]>(() => [
  [{ label: user.value?.email ?? '', type: 'label' }],
  [
    { label: dark.value ? 'Light mode' : 'Dark mode', icon: dark.value ? 'i-lucide-sun' : 'i-lucide-moon', onSelect: () => { colorMode.preference = dark.value ? 'light' : 'dark' } },
    ...(settingsBase.value
      ? [
          { label: 'Password', icon: 'i-lucide-key-round', to: `${settingsBase.value}/settings/password` },
          { label: 'About Keeper', icon: 'i-lucide-info', to: `${settingsBase.value}/settings/about` },
        ]
      : []),
  ],
  [{ label: 'Sign out', icon: 'i-lucide-log-out', onSelect: signOut }],
])
</script>

<template>
  <UDashboardGroup unit="rem" storage="local">
    <UDashboardSidebar
      id="keeper"
      v-model:open="open"
      collapsible
      :default-size="16"
      :min-size="14"
      :max-size="20"
      class="k-sidebar"
      :ui="{ header: 'h-auto flex-col items-stretch gap-1.5 pt-3 pb-1', footer: 'flex-col items-stretch gap-2 border-t border-default py-3' }"
    >
      <template #header="{ collapsed }">
        <WorkspaceSwitcher :collapsed="collapsed" @create="creating = true" />
        <TeamSwitcher :collapsed="collapsed" />
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu :collapsed="collapsed" :items="items" orientation="vertical" tooltip />
        <template v-if="(teamItems.length || workspaceItems.length) && !collapsed">
          <p class="mt-4 px-2.5 text-xs font-medium text-muted">{{ everywhere ? 'Workspaces' : 'Teams' }}</p>
          <UNavigationMenu :items="everywhere ? workspaceItems : teamItems" orientation="vertical">
            <template #team-leading="{ item }">
              <HealthDot :health="(item as any).health" class="mx-1" />
            </template>
          </UNavigationMenu>
        </template>
      </template>

      <template #footer="{ collapsed }">
        <UNavigationMenu v-if="footerItems.length" :collapsed="collapsed" :items="footerItems" orientation="vertical" tooltip />
        <UDropdownMenu :items="menu" :content="{ side: 'top', align: 'start' }" :ui="{ content: 'w-60' }">
          <UButton color="neutral" variant="ghost" block :square="collapsed" class="justify-start gap-2.5 px-2 py-1.5" :aria-label="`${user?.name}, menu`">
            <span class="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-(--k-moment-bg) text-xs font-semibold text-highlighted">{{ initials(user?.name || user?.email) }}</span>
            <span v-if="!collapsed" class="min-w-0 flex-1 text-left">
              <span class="block truncate text-sm font-medium text-highlighted">{{ user?.name || user?.email }}</span>
              <span class="block truncate text-xs text-muted">{{ everywhere ? `${me?.workspaces.length ?? 0} workspaces` : role ? ROLE_LABELS[role] : '' }}<template v-if="role && team?.lead"> · lead of {{ team.name }}</template></span>
            </span>
            <UIcon v-if="!collapsed" name="i-lucide-chevrons-up-down" class="size-4 shrink-0 text-dimmed" />
          </UButton>
        </UDropdownMenu>
        <p v-if="!collapsed" class="px-2">
          <KBrand signature />
          <span class="sr-only">Keeper, part of tinyzoo</span>
        </p>
      </template>
    </UDashboardSidebar>

    <slot />
    <NewWorkspaceModal v-model:open="creating" />
  </UDashboardGroup>
</template>
