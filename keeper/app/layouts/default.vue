<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { me, signOut } = useKeeperUser()
const colorMode = useColorMode()
const open = ref(false)

const items: NavigationMenuItem[] = [
  { label: 'Sites', icon: 'i-lucide-layout-grid', to: '/', onSelect: () => { open.value = false } },
  { label: 'Versions', icon: 'i-lucide-git-branch', to: '/versions', onSelect: () => { open.value = false } },
  { label: 'Settings', icon: 'i-lucide-settings', to: '/settings', onSelect: () => { open.value = false } },
]

function toggleDark() { dark.value = !dark.value }
const dark = computed({
  get: () => colorMode.value === 'dark',
  set: (v: boolean) => { colorMode.preference = v ? 'dark' : 'light' },
})
</script>

<template>
  <UDashboardGroup unit="rem" storage="local">
    <UDashboardSidebar
      id="keeper"
      v-model:open="open"
      collapsible
      :default-size="15"
      :min-size="13"
      :max-size="20"
      :ui="{ footer: 'border-t border-default' }"
    >
      <template #header="{ collapsed }">
        <KeeperMark :collapsed="collapsed" />
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="items"
          orientation="vertical"
          tooltip
        />
      </template>

      <template #footer="{ collapsed }">
        <div class="flex w-full flex-col gap-1">
          <div v-if="!collapsed && me" class="px-2 pb-1 min-w-0">
            <p class="text-sm font-medium text-highlighted truncate">{{ me.name || me.email }}</p>
            <p class="text-xs text-muted truncate">{{ me.workspaceName }}</p>
          </div>
          <UButton
            :icon="dark ? 'i-lucide-sun' : 'i-lucide-moon'"
            :label="collapsed ? undefined : (dark ? 'Light mode' : 'Dark mode')"
            color="neutral"
            variant="ghost"
            block
            :square="collapsed"
            class="justify-start"
            @click="toggleDark"
          />
          <UButton
            icon="i-lucide-log-out"
            :label="collapsed ? undefined : 'Sign out'"
            color="neutral"
            variant="ghost"
            block
            :square="collapsed"
            class="justify-start"
            @click="signOut"
          />
        </div>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
