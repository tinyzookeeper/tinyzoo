<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'
import mascot from '../assets/brand/logo/mascot.svg?url'
import mascotReversed from '../assets/brand/logo/mascot-reversed.svg?url'

const { me, signOut } = useKeeperUser()
const colorMode = useColorMode()
const open = ref(false)
const close = () => { open.value = false }

const items: NavigationMenuItem[] = [
  { label: 'Sites', icon: 'i-lucide-house', to: '/', onSelect: close },
  { label: 'Versions', icon: 'i-lucide-git-branch', to: '/versions', onSelect: close },
  { label: 'Settings', icon: 'i-lucide-settings-2', to: '/settings', onSelect: close },
]

const dark = computed(() => colorMode.value === 'dark')
const initials = (text: string | undefined) => (text ?? '').split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || 'K'

const menu = computed<DropdownMenuItem[][]>(() => [
  [{ label: me.value?.email ?? '', type: 'label' }],
  [
    { label: dark.value ? 'Light mode' : 'Dark mode', icon: dark.value ? 'i-lucide-sun' : 'i-lucide-moon', onSelect: () => { colorMode.preference = dark.value ? 'light' : 'dark' } },
    { label: 'Settings', icon: 'i-lucide-settings-2', to: '/settings' },
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
      :ui="{ footer: 'flex-col items-stretch gap-2 border-t border-default py-3' }"
    >
      <template #header="{ collapsed }">
        <NuxtLink to="/" class="flex min-w-0 items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2" :aria-label="`${me?.workspaceName ?? 'Keeper'}, all sites`">
          <span class="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-inverted text-[11px] font-semibold text-inverted">{{ initials(me?.workspaceName) }}</span>
          <span v-if="!collapsed" class="k-display truncate text-[17px] text-highlighted">{{ me?.workspaceName ?? 'Keeper' }}</span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu :collapsed="collapsed" :items="items" orientation="vertical" tooltip />
      </template>

      <template #footer="{ collapsed }">
        <UDropdownMenu :items="menu" :content="{ side: 'top', align: 'start' }" :ui="{ content: 'w-60' }">
          <UButton color="neutral" variant="ghost" block :square="collapsed" class="justify-start gap-2.5 px-2 py-1.5" :aria-label="`${me?.name}, menu`">
            <span class="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-(--k-moment-bg) text-xs font-semibold text-highlighted">{{ initials(me?.name || me?.email) }}</span>
            <span v-if="!collapsed" class="min-w-0 flex-1 text-left">
              <span class="block truncate text-sm font-medium text-highlighted">{{ me?.name || me?.email }}</span>
              <span class="block truncate text-xs text-muted">{{ me ? ROLE_LABELS[me.role] : '' }}</span>
            </span>
            <UIcon v-if="!collapsed" name="i-lucide-chevrons-up-down" class="size-4 shrink-0 text-dimmed" />
          </UButton>
        </UDropdownMenu>
        <div v-if="!collapsed" class="flex items-center gap-1.5 px-2 text-xs font-semibold text-muted">
          <img :src="mascot" alt="" class="h-3.5 w-auto dark:hidden">
          <img :src="mascotReversed" alt="" class="hidden h-3.5 w-auto dark:inline">
          <span>Keeper</span><span class="font-normal text-dimmed">· tinyzoo</span>
        </div>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
