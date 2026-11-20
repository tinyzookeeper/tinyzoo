<script setup lang="ts">
// Settings, split as in Postyard: this workspace (General, Teams, People, Alerts, Access tokens),
// you (Password) and Keeper (About). People and Alerts are for owners and admins.
const route = useRoute()
const { workspace, isManager, isGuest, link } = useScope()
useHead({ title: 'Settings · Keeper' })

const groups = computed(() => [
  ...(isGuest.value ? [] : [{
    label: workspace.value?.name ?? 'Workspace',
    items: [
      { label: 'General', to: link('/settings/general'), icon: 'i-lucide-building-2' },
      { label: 'Teams', to: link('/settings/teams'), icon: 'i-lucide-layers' },
      ...(isManager.value
        ? [
            { label: 'People', to: link('/settings/people'), icon: 'i-lucide-users' },
            { label: 'Alerts', to: link('/settings/alerts'), icon: 'i-lucide-bell' },
          ]
        : []),
      { label: 'Access tokens', to: link('/settings/tokens'), icon: 'i-lucide-key-round' },
    ],
  }]),
  { label: 'You', items: [{ label: 'Password', to: link('/settings/password'), icon: 'i-lucide-lock' }] },
  { label: 'Keeper', items: [{ label: 'About', to: link('/settings/about'), icon: 'i-lucide-info' }] },
])
const flat = computed(() => groups.value.flatMap((g) => g.items))
const current = computed(() => flat.value.find((i) => route.path === i.to) ?? null)
// The pill of the page you are on stays in view on a phone.
const pills = useTemplateRef<{ emblaApi?: { scrollTo: (i: number, jump?: boolean) => void } }>('pills')
function showCurrent(jump = false) {
  const i = flat.value.findIndex((x) => x.to === route.path)
  if (i >= 0) pills.value?.emblaApi?.scrollTo(i, jump)
}
onMounted(() => nextTick(() => showCurrent(true)))
watch(() => route.path, () => showCurrent())
// /settings alone opens General.
if (route.path === link('/settings')) await navigateTo(link(isGuest.value ? '/settings/password' : '/settings/general'), { replace: true })
</script>

<template>
  <AppPage :title="current?.label ?? 'Settings'" :trail="[{ label: 'Settings', to: link(isGuest ? '/settings/password' : '/settings/general') }]" :heading="false">
    <div class="flex flex-col gap-6 md:flex-row md:gap-10">
      <!-- Phones: one row of pills to swipe (Embla, through UCarousel), the current one in view. -->
      <nav class="md:hidden" aria-label="Settings">
        <UCarousel
          ref="pills"
          v-slot="{ item }"
          :items="flat"
          align="start"
          drag-free
          contain-scroll="trimSnaps"
          :ui="{ container: '-ms-1.5', item: 'basis-auto ps-1.5' }"
        >
          <NuxtLink
            :to="item.to"
            class="block rounded-full border px-3 py-1.5 text-sm whitespace-nowrap"
            :class="route.path === item.to ? 'border-transparent bg-(--k-moment-bg) font-medium text-highlighted' : 'border-default text-toned'"
          >{{ item.label }}</NuxtLink>
        </UCarousel>
      </nav>
      <nav class="hidden w-48 shrink-0 flex-col gap-4 md:flex" aria-label="Settings">
        <div v-for="g in groups" :key="g.label">
          <p class="mb-1 truncate px-2.5 text-[11px] font-medium tracking-wide text-dimmed uppercase">{{ g.label }}</p>
          <NuxtLink
            v-for="i in g.items"
            :key="i.to"
            :to="i.to"
            class="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm"
            :class="route.path === i.to ? 'bg-(--k-moment-bg) font-medium text-highlighted' : 'text-toned hover:bg-elevated hover:text-highlighted'"
          >
            <UIcon :name="i.icon" class="size-4 shrink-0" />{{ i.label }}
          </NuxtLink>
        </div>
      </nav>
      <div class="min-w-0 max-w-3xl flex-1">
        <h1 class="k-display mb-5 text-[1.75rem] leading-tight text-highlighted">{{ current?.label ?? 'Settings' }}</h1>
        <NuxtPage />
      </div>
    </div>
  </AppPage>
</template>
