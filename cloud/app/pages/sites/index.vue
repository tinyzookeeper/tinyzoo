<script setup lang="ts">
import type { SiteView } from '#shared/api'
import { templateById } from '#shared/templates'

// My websites: a card each, with its state, and the way to another one.
const t = useT()
const l = useL()
const { user, account, refresh: refreshAccount } = useAccount()
useHead({ title: () => t('sites.title') })

const { data, refresh } = await useFetch<{ sites: SiteView[]; max: number }>('/api/sites', { key: 'sites' })
const sites = computed(() => data.value?.sites ?? [])
const max = computed(() => data.value?.max ?? account.value.sites.max)
const atLimit = computed(() => sites.value.length >= max.value)
const firstName = computed(() => (user.value?.name ?? '').trim().split(/\s+/)[0] ?? '')

// Something is being made or removed: keep the list current.
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  void refreshAccount()
  timer = setInterval(() => { if (sites.value.some((s) => s.status === 'creating' || s.status === 'removing')) void refresh() }, 1500)
})
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

const stateOf = (s: SiteView) => ({
  ready: { label: t('sites.stateReady'), tone: 'ok' },
  creating: { label: t('sites.stateCreating'), tone: 'busy' },
  waiting: { label: t('sites.stateWaiting'), tone: 'busy' },
  failed: { label: t('sites.stateFailed'), tone: 'bad' },
  removing: { label: t('sites.stateRemoving'), tone: 'busy' },
  removed: { label: '', tone: 'busy' },
}[s.status])
</script>

<template>
  <div class="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="z-display text-[1.75rem] leading-tight text-highlighted sm:text-4xl">{{ firstName ? t('sites.hello', { name: firstName }) : t('sites.title') }}</h1>
        <p class="mt-1.5 text-[0.9375rem] text-muted">{{ sites.length ? t('sites.count', { used: sites.length, max }) : t('sites.none') }}</p>
      </div>
      <UButton v-if="sites.length && !atLimit" to="/new" :label="t('sites.another')" icon="i-lucide-plus" size="lg" data-another />
    </header>

    <VerifyNote class="mt-6" />

    <ZEmpty v-if="!sites.length" class="mt-8" animal="elephant" :title="t('sites.emptyTitle')" :description="t('sites.emptyText')">
      <UButton to="/new" :label="t('home.cta')" size="lg" trailing-icon="i-lucide-arrow-right" />
    </ZEmpty>

    <template v-else>
      <ul class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="s in sites" :key="s.id">
          <NuxtLink :to="`/sites/${s.id}`" class="site group z-card flex h-full flex-col overflow-hidden transition hover:border-(--ui-border-accented)" :data-site="s.slug" :data-status="s.status">
            <div class="flex h-28 items-end justify-between bg-(--z-moment-bg) px-5">
              <span class="mb-4 inline-flex items-center gap-2 rounded-full bg-(--z-surface) px-2.5 py-1 text-xs font-medium text-highlighted">
                <span class="size-1.5 rounded-full" :class="{ 'bg-(--z-ok)': stateOf(s).tone === 'ok', 'bg-(--z-warm) animate-pulse': stateOf(s).tone === 'busy', 'bg-(--ui-error)': stateOf(s).tone === 'bad' }" />
                {{ stateOf(s).label }}
              </span>
              <ZAnimal :seed="s.id" class="h-20 w-auto translate-y-px transition-transform duration-300 group-hover:-translate-y-1" />
            </div>
            <div class="flex flex-1 flex-col p-5">
              <h2 class="z-title truncate text-lg text-highlighted">{{ s.name }}</h2>
              <p class="mt-0.5 truncate font-mono text-[0.8125rem] text-muted">{{ hostOf(s.publicUrl) || `${s.slug}${account.siteHost}` }}</p>
              <p class="mt-4 flex items-center justify-between text-sm text-muted">
                <span class="truncate">{{ templateById(s.template) ? l(templateById(s.template)!.name) : s.template }}</span>
                <UIcon name="i-lucide-arrow-right" class="size-4 shrink-0 text-dimmed transition group-hover:translate-x-0.5 group-hover:text-highlighted" />
              </p>
            </div>
          </NuxtLink>
        </li>
        <li v-if="!atLimit">
          <NuxtLink to="/new" class="flex h-full min-h-48 flex-col items-center justify-center gap-2 rounded-[0.875rem] border border-dashed border-(--ui-border-accented) p-6 text-center text-muted transition hover:border-(--ui-primary) hover:text-highlighted">
            <span class="inline-flex size-10 items-center justify-center rounded-full bg-(--z-moment-bg)"><UIcon name="i-lucide-plus" class="size-5" /></span>
            <span class="font-medium">{{ t('sites.another') }}</span>
          </NuxtLink>
        </li>
      </ul>
      <p v-if="atLimit" class="z-note mt-6 flex items-start gap-3 p-4 text-sm text-pretty" data-limit>
        <UIcon name="i-lucide-info" class="mt-0.5 size-4 shrink-0" />
        <span>{{ t('sites.limit', { max }) }}</span>
      </p>
    </template>
  </div>
</template>
