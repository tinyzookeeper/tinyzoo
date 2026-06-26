<script setup lang="ts">
const { data: graph } = await useFetch('/api/cms/_graph', { key: 'cms-graph' })
const { user, clear } = useUserSession()
const route = useRoute()
const router = useRouter()
const colorMode = useColorMode()

const icons: Record<string, string> = {
  post: 'i-lucide-file-text', author: 'i-lucide-users', tag: 'i-lucide-tag', cms_media: 'i-lucide-image',
}
const nav = computed(() =>
  (graph.value ?? []).map((e: any) => ({ label: e.label, to: `/admin/${e.name}`, icon: icons[e.name] ?? 'i-lucide-database' })),
)
const isActive = (to: string) => route.path === to || route.path.startsWith(to + '/')

const initials = computed(() =>
  (user.value?.name ?? '?').split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase(),
)

async function logout() {
  await $fetch('/api/_cms/logout', { method: 'POST' })
  await clear()
  await router.push('/login')
}

const isDark = computed(() => colorMode.value === 'dark')
const userMenu = computed(() => [
  [{
    label: isDark.value ? 'Light mode' : 'Dark mode',
    icon: isDark.value ? 'i-lucide-sun' : 'i-lucide-moon',
    onSelect: () => { colorMode.preference = isDark.value ? 'light' : 'dark' },
  }],
  [{ label: 'Sign out', icon: 'i-lucide-log-out', color: 'error' as const, onSelect: logout }],
])

const navItem = 'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition'
</script>

<template>
  <div class="min-h-screen flex bg-muted/30">
    <aside class="w-64 shrink-0 border-r border-default bg-default flex flex-col fixed inset-y-0">
      <NuxtLink to="/admin" class="h-16 flex items-center gap-2.5 px-5 border-b border-default">
        <div class="size-7 rounded-lg bg-primary flex items-center justify-center text-inverted font-bold text-sm">C</div>
        <span class="font-semibold">my-cms</span>
      </NuxtLink>

      <nav class="flex-1 p-3 space-y-0.5 overflow-y-auto">
        <NuxtLink to="/admin" :class="[navItem, route.path === '/admin' ? 'bg-primary/10 text-primary font-medium' : 'text-muted hover:text-default hover:bg-elevated']">
          <UIcon name="i-lucide-layout-dashboard" class="size-4" /> Dashboard
        </NuxtLink>

        <p class="px-3 pt-5 pb-1.5 text-xs font-semibold text-dimmed uppercase tracking-wider">Collections</p>
        <NuxtLink
          v-for="item in nav" :key="item.to" :to="item.to"
          :class="[navItem, isActive(item.to) ? 'bg-primary/10 text-primary font-medium' : 'text-muted hover:text-default hover:bg-elevated']"
        >
          <UIcon :name="item.icon" class="size-4" /> {{ item.label }}
        </NuxtLink>
      </nav>

      <div class="p-3 border-t border-default">
        <UDropdownMenu :items="userMenu" :content="{ align: 'start', side: 'top' }" class="w-full">
          <button class="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-elevated transition text-left">
            <div class="size-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">{{ initials }}</div>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium truncate">{{ user?.name }}</div>
              <div class="text-xs text-muted capitalize">{{ user?.role }}</div>
            </div>
            <UIcon name="i-lucide-chevrons-up-down" class="size-4 text-dimmed shrink-0" />
          </button>
        </UDropdownMenu>
      </div>
    </aside>

    <main class="flex-1 min-w-0 pl-64">
      <slot />
    </main>
  </div>
</template>
