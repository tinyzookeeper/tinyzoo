<script setup lang="ts">
import type { OverviewResponse, SiteSummary } from '#shared/types/keeper'

useHead({ title: 'Sites · Keeper' })

const toast = useToast()
const { data, status, refresh, error } = await useFetch<OverviewResponse>('/api/sites', {
  key: 'overview',
  default: () => ({ sites: [], latest: null }),
})
watch(error, (e) => { if (e) toast.add({ title: 'Could not load the sites', description: errorMessage(e), color: 'error' }) })

// Fresh numbers while the page is open (the checks run every minute).
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { refresh() }, 60_000) })
onBeforeUnmount(() => clearInterval(timer))

const now = useNow()
const CERT_WARN_DAYS = 21

const q = ref('')
const client = ref('all')
const clients = computed(() => {
  const names = [...new Set(data.value.sites.map((s) => s.client).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  return [{ label: 'All clients', value: 'all' }, ...names.map((n) => ({ label: n, value: n }))]
})

const ORDER = { down: 0, unknown: 1, up: 2 } as const
const sites = computed<SiteSummary[]>(() => {
  const needle = q.value.trim().toLowerCase()
  return data.value.sites
    .filter((s) => client.value === 'all' || s.client === client.value)
    .filter((s) => !needle || [s.name, s.client, s.url].some((v) => v.toLowerCase().includes(needle)))
    .sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.name.localeCompare(b.name))
})

const certDays = (s: SiteSummary) => daysLeft(s.certExpiresAt, now.value)
const summary = computed(() => {
  const all = data.value.sites
  return {
    up: all.filter((s) => s.state === 'up').length,
    down: all.filter((s) => s.state === 'down').length,
    outdated: all.filter((s) => s.outdated).length,
    certs: all.filter((s) => { const d = certDays(s); return d != null && d < CERT_WARN_DAYS }).length,
  }
})
</script>

<template>
  <AppPage title="Sites">
    <template #actions>
      <UButton to="/sites/new" icon="i-lucide-plus" label="Add site" class="hidden sm:inline-flex" />
      <UButton to="/sites/new" icon="i-lucide-plus" aria-label="Add site" square class="sm:hidden" />
    </template>

    <div v-if="status === 'pending' && !data.sites.length" class="flex flex-col gap-3">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-16 w-full" />
      <USkeleton class="h-16 w-full" />
    </div>

    <!-- Nothing yet: how to add the first site. -->
    <div v-else-if="!data.sites.length" class="moment rounded-2xl px-6 py-10 sm:px-10 sm:py-14 text-center">
      <img src="/favicon.svg" alt="" class="mx-auto size-12">
      <h2 class="mt-4 text-xl font-bold text-highlighted">No sites yet</h2>
      <p class="mt-1 text-muted">Add a tinyzoo site and Keeper starts watching it within a minute.</p>
      <ol class="mx-auto mt-6 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
        <li class="rounded-xl bg-default p-4">
          <p class="text-xs font-semibold text-muted">1</p>
          <p class="mt-1 text-sm text-highlighted">Set <code class="font-mono text-xs">NUXT_CMS_STATUS_TOKEN</code> on the site to a long random value.</p>
        </li>
        <li class="rounded-xl bg-default p-4">
          <p class="text-xs font-semibold text-muted">2</p>
          <p class="mt-1 text-sm text-highlighted">Add the site here with its address and that token.</p>
        </li>
        <li class="rounded-xl bg-default p-4">
          <p class="text-xs font-semibold text-muted">3</p>
          <p class="mt-1 text-sm text-highlighted">Done. Uptime, versions and activity show up on their own.</p>
        </li>
      </ol>
      <UButton to="/sites/new" label="Add your first site" icon="i-lucide-plus" size="lg" class="mt-8" />
    </div>

    <template v-else>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Up" :value="summary.up" icon="i-lucide-circle-check" tone="success" />
        <StatTile label="Down" :value="summary.down" icon="i-lucide-circle-x" :tone="summary.down ? 'error' : 'neutral'" />
        <StatTile label="Behind on tinyzoo" :value="summary.outdated" icon="i-lucide-arrow-up-circle" :tone="summary.outdated ? 'warning' : 'neutral'" />
        <StatTile label="Certificates expiring" :value="summary.certs" icon="i-lucide-shield-alert" :tone="summary.certs ? 'warning' : 'neutral'" />
      </div>

      <div class="mt-6 flex flex-col gap-2 sm:flex-row">
        <UInput v-model="q" icon="i-lucide-search" placeholder="Search sites" class="sm:w-72" aria-label="Search sites" />
        <USelect v-if="clients.length > 2" v-model="client" :items="clients" class="sm:w-56" aria-label="Client" />
        <p v-if="data.latest" class="text-sm text-muted sm:ml-auto sm:self-center">
          Newest tinyzoo: <span class="font-mono text-toned">{{ data.latest }}</span>
        </p>
      </div>

      <div class="mt-4 overflow-hidden rounded-xl border border-default">
        <!-- Column heads (wide screens only; phones get cards). -->
        <div class="hidden lg:grid lg:grid-cols-[minmax(0,2.4fr)_6.5rem_5.5rem_5rem_7rem_6.5rem_8rem] gap-4 border-b border-default bg-muted px-4 py-2 text-xs font-medium text-muted">
          <span>Site</span><span>tinyzoo</span><span>Uptime 30d</span><span>Response</span><span>Last edit</span><span>Certificate</span><span class="sr-only">Actions</span>
        </div>

        <ul class="divide-y divide-default">
          <li
            v-for="s in sites"
            :key="s.id"
            class="relative grid gap-x-4 gap-y-2 px-4 py-3.5 transition-colors hover:bg-muted/60 grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,2.4fr)_6.5rem_5.5rem_5rem_7rem_6.5rem_8rem] lg:items-center"
            :class="{ 'bg-error/5': s.state === 'down' }"
          >
            <!-- Site -->
            <div class="flex min-w-0 items-start gap-3">
              <StateDot :state="s.state" class="mt-1.5" />
              <div class="min-w-0">
                <NuxtLink :to="`/sites/${s.id}`" class="font-medium text-highlighted after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-offset-[-2px]">
                  {{ s.name }}
                </NuxtLink>
                <p class="truncate text-sm text-muted">
                  <span v-if="s.client">{{ s.client }} · </span><span class="font-mono text-xs">{{ hostOf(s.url) }}</span>
                  <UBadge v-if="s.environment === 'staging'" label="staging" color="neutral" variant="subtle" size="sm" class="ml-1 align-middle" />
                </p>
                <p v-if="s.state === 'down' && s.stateSince" class="text-sm font-medium text-error">Down for {{ duration(s.stateSince, null, now) }}</p>
                <p v-else-if="s.statusError" class="text-sm text-warning">
                  <UIcon name="i-lucide-triangle-alert" class="mr-0.5 size-3.5 align-[-2px]" />Status unreadable
                </p>
                <p v-else-if="!s.hasToken" class="text-sm text-dimmed">No status token</p>
              </div>
            </div>

            <!-- Phones: version and admin button on the right of the name. -->
            <div class="relative z-10 flex items-start gap-2 lg:contents">
              <div class="relative z-10">
                <VersionBadge :version="s.version" :outdated="s.outdated" :latest="data.latest" />
              </div>
            </div>

            <!-- Facts: a wrapped line on phones, columns on wide screens. -->
            <dl class="col-span-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted lg:col-span-1 lg:contents">
              <div class="flex gap-1 lg:block">
                <dt class="lg:sr-only">Uptime</dt>
                <dd class="tabular text-toned">{{ formatUptime(s.uptime30d) }}</dd>
              </div>
              <div class="flex gap-1 lg:block">
                <dt class="lg:sr-only">Response</dt>
                <dd class="tabular text-toned">{{ s.responseMs != null ? `${s.responseMs} ms` : '—' }}</dd>
              </div>
              <div class="flex gap-1 lg:block">
                <dt class="lg:sr-only">Last edit</dt>
                <dd class="text-toned">{{ timeAgo(s.lastEditAt, now) }}</dd>
              </div>
              <div class="flex gap-1 lg:block">
                <dt class="lg:sr-only">Certificate</dt>
                <dd
                  class="tabular"
                  :class="certDays(s) != null && certDays(s)! < CERT_WARN_DAYS ? 'font-medium text-warning' : 'text-toned'"
                >
                  {{ certDays(s) == null ? '—' : certDays(s)! < 0 ? 'expired' : `${certDays(s)} days` }}
                </dd>
              </div>
              <div v-if="s.errors24h > 0" class="flex gap-1 text-error lg:hidden">
                <dt>Errors 24h</dt><dd class="tabular">{{ s.errors24h }}</dd>
              </div>
            </dl>

            <div class="relative z-10 col-span-2 flex items-center gap-2 lg:col-span-1 lg:justify-end">
              <UTooltip v-if="s.errors24h > 0" :text="`${s.errors24h} server errors in the last 24 hours`">
                <UBadge color="error" variant="soft" icon="i-lucide-bug" class="hidden tabular lg:inline-flex">{{ s.errors24h }}</UBadge>
              </UTooltip>
              <UButton
                :to="s.adminUrl"
                target="_blank"
                rel="noopener"
                label="Open admin"
                trailing-icon="i-lucide-arrow-up-right"
                color="neutral"
                variant="outline"
                size="sm"
              />
            </div>
          </li>
        </ul>

        <p v-if="!sites.length" class="px-4 py-8 text-center text-sm text-muted">No site matches.</p>
      </div>
    </template>
  </AppPage>
</template>
