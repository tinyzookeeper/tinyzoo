<script setup lang="ts">
import type { OverviewResponse, SiteSummary } from '#keeper/types/keeper'

const toast = useToast()
const { me } = useKeeperUser()
const { workspace, team, wsSlug, teamSlug, canWrite, isGuest, link } = useScope()
const { data, status, refresh, error } = await useFetch<OverviewResponse>('/api/sites', {
  key: `overview-${wsSlug.value}-${teamSlug.value}`,
  query: { workspace: wsSlug, team: teamSlug },
  default: () => ({ sites: [], latest: null }),
  // A guest gets the guest view (GuestOverview) instead.
  immediate: !isGuest.value,
})
useHead({ title: () => `${team.value?.name ?? workspace.value?.name ?? 'Sites'} · Keeper` })
// The team of each site is worth saying on "All teams" of a workspace with several.
const teamOf = (s: SiteSummary) => (!team.value && (workspace.value?.teams.length ?? 0) > 1 ? s.team.name : '')
watch(error, (e) => { if (e) toast.add({ title: 'Could not load the sites', description: errorMessage(e), color: 'error' }) })

// Fresh numbers while the page is open (the checks run every minute).
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { if (!isGuest.value) timer = setInterval(() => { refresh() }, 60_000) })
onBeforeUnmount(() => clearInterval(timer))

const now = useNow()
const CERT_WARN_DAYS = 21
const certDays = (s: SiteSummary) => daysLeft(s.certExpiresAt, now.value)

// ── the greeting ──
const greeting = computed(() => {
  const h = new Date(now.value).getHours()
  const part = h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  const first = (me.value?.name || '').split(' ')[0]
  return first ? `${part}, ${first}` : part
})
const all = computed(() => data.value.sites)
const down = computed(() => all.value.filter((s) => s.state === 'down'))
const outdated = computed(() => all.value.filter((s) => s.outdated))
const summary = computed(() => {
  const n = all.value.length
  if (!n) return canWrite.value ? 'Add your first site and Keeper starts watching it within a minute.' : 'There are no sites for you to see yet.'
  const parts: string[] = []
  if (down.value.length === 1) parts.push(`${down.value[0]!.name} is down.`)
  else if (down.value.length) parts.push(`${down.value.length} sites are down.`)
  else if (all.value.every((s) => s.state === 'up')) parts.push(n === 1 ? 'Your site is up.' : n === 2 ? 'Both sites are up.' : `All ${n} sites are up.`)
  else parts.push(n === 1 ? 'Your site is not checked yet.' : `${n} sites, ${all.value.filter((s) => s.state === 'up').length} of them up.`)
  if (outdated.value.length) parts.push(outdated.value.length === 1 ? `${outdated.value[0]!.name} runs an older tinyzoo.` : `${outdated.value.length} run an older tinyzoo.`)
  return parts.join(' ')
})

// The overview's opening card. A site that is down outranks the greeting (one site: its name
// and how long; more: how many and which), and a workspace with nothing to watch yet opens on
// Keeper itself. Otherwise the cream greeting.
const downBanner = computed(() => {
  const d = down.value
  if (!d.length) return null
  const first = d[0]!
  if (d.length === 1) {
    return {
      title: `${first.name} is down`,
      text: `For ${duration(first.stateSince ?? first.lastCheckAt ?? '', null, now.value)}${teamOf(first) ? ' · ' + teamOf(first) : ''}. Keeper checks it every minute and shows it here as soon as it answers again.`,
      seed: first.id, to: link(`/sites/${first.id}`), action: 'Look',
    }
  }
  const names = d.slice(0, 3).map((s) => s.name)
  const rest = d.length - names.length
  return {
    title: `${d.length} sites are down`,
    text: `${names.join(', ')}${rest ? ` and ${rest} more` : ''}. Keeper checks them every minute.`,
    seed: first.id, to: '#needs', action: 'See which',
  }
})
const firstRun = computed(() => status.value !== 'pending' && !all.value.length)

// ── what needs someone ──
interface Need { site: SiteSummary; title: string; detail: string; tone: 'error' | 'warning' | 'neutral'; action: { label: string; to: string; external?: boolean } }
const needs = computed<Need[]>(() => {
  const out: Need[] = []
  for (const s of all.value) {
    if (s.state === 'down') out.push({ site: s, tone: 'error', title: `${s.name} is down`, detail: `For ${duration(s.stateSince ?? s.lastCheckAt ?? '', null, now.value)}${teamOf(s) ? ' · ' + teamOf(s) : ''}`, action: { label: 'Look', to: link(`/sites/${s.id}`) } })
    const days = certDays(s)
    if (days != null && days < CERT_WARN_DAYS) out.push({ site: s, tone: 'warning', title: days < 0 ? `${s.name}: certificate expired` : `${s.name}: certificate expires in ${days} days`, detail: hostOf(s.url), action: { label: 'Look', to: link(`/sites/${s.id}`) } })
    if (s.statusError) out.push({ site: s, tone: 'warning', title: `${s.name}: status unreadable`, detail: s.statusError, action: { label: 'Fix token', to: link(`/sites/${s.id}/edit`) } })
    if (s.traffic?.drop) {
      const d = s.traffic.drop
      const fell = d.baselinePerDay ? Math.round((1 - d.perDay / d.baselinePerDay) * 100) : 0
      out.push({ site: s, tone: 'warning', title: `${s.name}: visitors down by ${fell} %`, detail: `${d.perDay} a day over the last 7 days, usually ${d.baselinePerDay}`, action: { label: 'Look', to: link(`/sites/${s.id}#traffic`) } })
    }
    if (s.errors24h > 0) out.push({ site: s, tone: 'neutral', title: `${s.name}: ${s.errors24h} server error${s.errors24h === 1 ? '' : 's'}`, detail: 'Reported by the site in the last 24 hours', action: { label: 'Look', to: link(`/sites/${s.id}`) } })
    if (s.restarts24h > 0) out.push({ site: s, tone: 'warning', title: `${s.name}: restarted ${s.restarts24h === 1 ? 'once' : `${s.restarts24h} times`} without a deploy`, detail: s.lastRestart?.hint ? `In the last 24 hours; before the last one, its ${s.lastRestart.hint}` : 'In the last 24 hours', action: { label: 'Look', to: link(`/sites/${s.id}`) } })
    else if (s.memory?.percent != null && s.memory.percent >= 80) out.push({ site: s, tone: 'neutral', title: `${s.name}: memory at ${s.memory.percent} % of its limit`, detail: 'The host stops a site that goes over it', action: { label: 'Look', to: link(`/sites/${s.id}`) } })
  }
  const rank = { error: 0, warning: 1, neutral: 2 }
  return out.sort((a, b) => rank[a.tone] - rank[b.tone])
})

// ── the list ──
const q = ref('')
const ORDER = { down: 0, unknown: 1, up: 2 } as const
const sites = computed<SiteSummary[]>(() => {
  const needle = q.value.trim().toLowerCase()
  return all.value
    .filter((s) => !needle || [s.name, s.team.name, s.url].some((v) => v.toLowerCase().includes(needle)))
    .sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.name.localeCompare(b.name))
})

/** This week's visitors against last week's: "+12 %", "−8 %", or '' without a last week. */
function weekChange(s: SiteSummary): string {
  const t = s.traffic
  if (!t || !t.previousWeek) return ''
  const pct = Math.round(((t.week - t.previousWeek) / t.previousWeek) * 100)
  return pct === 0 ? '±0 %' : pct > 0 ? `+${pct} %` : `−${Math.abs(pct)} %`
}

function stateLine(s: SiteSummary): string {
  if (s.state === 'down') return `Down for ${duration(s.stateSince ?? '', null, now.value)}`
  if (s.state === 'unknown') return 'Not checked yet'
  return s.stateSince ? `Up for ${duration(s.stateSince, null, now.value)}` : 'Up'
}
</script>

<template>
  <GuestOverview v-if="isGuest" />
  <AppPage v-else :title="team?.name ?? workspace?.name ?? 'Sites'" :heading="false">
    <template #actions>
      <template v-if="canWrite">
        <UButton :to="link('/sites/new')" icon="i-lucide-plus" label="Add site" class="hidden sm:inline-flex" />
        <UButton :to="link('/sites/new')" icon="i-lucide-plus" aria-label="Add site" square class="sm:hidden" />
      </template>
    </template>

    <!-- A site is down: the dark banner takes the greeting's place, with the site's own animal. -->
    <KBanner v-if="downBanner" as="h1" :title="downBanner.title" :text="downBanner.text" :seed="downBanner.seed">
      <template #actions>
        <UButton :to="downBanner.to" :label="downBanner.action" icon="i-lucide-arrow-right" trailing />
      </template>
    </KBanner>

    <!-- Nothing to watch yet: the dark banner, with Keeper's own mark. -->
    <KBanner v-else-if="firstRun" as="h1" :title="greeting" :text="summary" mark>
      <template v-if="canWrite" #actions>
        <UButton :to="link('/sites/new')" icon="i-lucide-plus" label="Add your first site" />
      </template>
    </KBanner>

    <!-- The greeting: who is up, who needs you. -->
    <section v-else class="k-moment relative flex items-center justify-between gap-6 overflow-hidden p-5 sm:px-8 sm:py-7">
      <div class="min-w-0 pr-16 sm:pr-0">
        <h1 class="k-display text-2xl leading-tight text-highlighted sm:text-[1.75rem]">{{ greeting }}</h1>
        <p class="k-moment__muted mt-1 text-sm text-pretty sm:text-[0.9375rem]">
          <USkeleton v-if="status === 'pending' && !all.length" class="h-4 w-56" />
          <template v-else>{{ summary }}</template>
        </p>
        <div class="mt-4 flex flex-wrap gap-2">
          <UButton v-if="canWrite" :to="link('/sites/new')" icon="i-lucide-plus" label="Add site" />
          <UButton v-if="all.length" :to="link('/versions')" icon="i-lucide-git-branch" label="Versions" color="neutral" variant="outline" class="k-on-moment" />
        </div>
      </div>
      <KAnimal name="elephant" class="absolute top-5 right-4 h-10 w-auto shrink-0 sm:static sm:h-24" />
    </section>

    <div v-if="status === 'pending' && !all.length" class="mt-8 flex flex-col gap-3">
      <USkeleton class="h-16 w-full" />
      <USkeleton class="h-16 w-full" />
    </div>

    <!-- Nothing yet: how to add the first site. -->
    <section v-else-if="!all.length && canWrite" class="mt-8">
      <h2 class="k-label mb-2">Three steps to your first site</h2>
      <ol class="k-card divide-y divide-(--ui-border-muted)">
        <li v-for="(step, i) in [
          ['On the site', 'Set NUXT_CMS_STATUS_TOKEN to a long random value (openssl rand -hex 32) and redeploy. It needs tinyzoo 1.1 or newer.'],
          ['Here', 'Add the site with its address and the same token. Test connection tells you whether both work.'],
          ['That’s it', 'Uptime, versions, content and sign-ins show up within a minute. Without a token Keeper still watches uptime.'],
        ]" :key="i" class="flex items-start gap-3 px-4 py-3.5">
          <span class="k-tile size-7 text-xs font-semibold text-highlighted">{{ i + 1 }}</span>
          <div class="min-w-0">
            <p class="text-sm font-medium text-highlighted">{{ step[0] }}</p>
            <p class="text-sm text-muted">{{ step[1] }}</p>
          </div>
        </li>
      </ol>
    </section>

    <div v-else class="mt-8 flex flex-col gap-8">
      <!-- What needs someone. -->
      <section v-if="needs.length" id="needs" class="scroll-mt-20">
        <h2 class="k-label mb-2 flex items-center gap-2">Needs you <span class="k-count">{{ needs.length }}</span></h2>
        <ul class="k-card divide-y divide-(--ui-border-muted)">
          <li v-for="(n, i) in needs" :key="i" class="relative flex items-center gap-3 px-4 py-3">
            <SiteAnimal :id="n.site.id" :state="n.site.state" :logo="n.site.logo" size="sm" />
            <div class="min-w-0 flex-1">
              <NuxtLink :to="n.action.to" class="block truncate text-sm font-medium after:absolute after:inset-0" :class="n.tone === 'error' ? 'text-error' : 'text-highlighted'">{{ n.title }}</NuxtLink>
              <p class="truncate text-xs text-muted">{{ n.detail }}</p>
            </div>
            <UButton :to="n.action.to" :label="n.action.label" color="neutral" variant="outline" size="sm" class="relative shrink-0 max-sm:hidden" />
          </li>
        </ul>
      </section>

      <!-- Every site. -->
      <section>
        <div class="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 class="k-label flex items-center gap-2">All sites <span class="k-count">{{ all.length }}</span></h2>
          <div class="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
            <UInput v-model="q" icon="i-lucide-search" placeholder="Search…" variant="ghost" size="sm" class="min-w-0 flex-1 sm:w-48" aria-label="Search sites" />
          </div>
        </div>

        <ul v-if="sites.length" class="k-card divide-y divide-(--ui-border-muted)">
          <li v-for="s in sites" :key="s.id" class="relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-elevated/40 sm:gap-4">
            <SiteAnimal :id="s.id" :state="s.state" :logo="s.logo" />
            <div class="min-w-0 flex-1">
              <div class="flex min-w-0 items-center gap-2">
                <NuxtLink :to="link(`/sites/${s.id}`)" class="truncate font-medium text-highlighted after:absolute after:inset-0">{{ s.name }}</NuxtLink>
                <UBadge v-if="s.environment === 'staging'" label="staging" color="neutral" variant="subtle" size="sm" class="shrink-0" />
              </div>
              <p class="truncate text-xs text-muted">
                <span :class="s.state === 'down' ? 'font-medium text-error' : ''">{{ stateLine(s) }}</span>
                <template v-if="teamOf(s)"> · {{ teamOf(s) }}</template>
                · <span class="font-mono">{{ hostOf(s.url) }}</span>
              </p>
            </div>

            <dl class="hidden shrink-0 items-center gap-6 text-right md:flex">
              <div class="hidden w-40 xl:block">
                <template v-if="s.traffic">
                  <dt class="text-[11px] text-dimmed">Visitors, 7 days</dt>
                  <dd class="flex items-center justify-end gap-2.5">
                    <TrafficSparkline :values="s.traffic.spark" :width="72" :height="22" :label="`Visitors a day over the last 30 days, ${s.traffic.week} in the last 7`" />
                    <span class="text-sm tabular text-toned">{{ s.traffic.week.toLocaleString('en-GB') }}</span>
                  </dd>
                  <dd v-if="weekChange(s)" class="text-[11px] tabular text-dimmed">{{ weekChange(s) }} on the week before</dd>
                </template>
              </div>
              <div class="w-16">
                <dt class="text-[11px] text-dimmed">Uptime</dt>
                <dd class="text-sm tabular text-toned">{{ formatUptime(s.uptime30d) }}</dd>
              </div>
              <div class="w-16">
                <dt class="text-[11px] text-dimmed">Answers</dt>
                <dd class="text-sm tabular text-toned">{{ s.responseMs != null ? `${s.responseMs} ms` : '—' }}</dd>
              </div>
              <div class="w-24">
                <dt class="text-[11px] text-dimmed">Last edit</dt>
                <dd class="text-sm text-toned">{{ timeAgo(s.lastEditAt, now) }}</dd>
              </div>
            </dl>

            <div class="relative z-10 flex shrink-0 items-center gap-2">
              <VersionBadge v-if="s.version" :version="s.version" :outdated="s.outdated" :latest="data.latest" />
              <UButton :to="s.adminUrl" target="_blank" rel="noopener" label="Admin" trailing-icon="i-lucide-arrow-up-right" color="neutral" variant="outline" size="sm" class="max-sm:hidden" />
            </div>
          </li>
        </ul>
        <div v-else class="k-card">
          <KEmpty title="No site matches" description="Try another name, address or team." />
        </div>
        <p v-if="data.latest" class="mt-2 text-right text-xs text-muted">Newest tinyzoo: <span class="font-mono">{{ data.latest }}</span></p>
      </section>
    </div>
  </AppPage>
</template>
