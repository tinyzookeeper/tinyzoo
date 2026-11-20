<script setup lang="ts">
import type { MeWorkspace, OverviewResponse, SiteSummary } from '#keeper/types/keeper'

// Every workspace: each site of every workspace I work in, grouped by workspace, trouble first.
// Workspaces with nothing to say fold into one line. The landing page for anyone in several
// workspaces (guests never see it: a workspace where they are a guest is left out).
useHead({ title: 'Every workspace · Keeper' })
const toast = useToast()
const { me: user } = useKeeperUser()
const me = useMe()
const now = useNow()
const { data, status, refresh, error } = await useFetch<OverviewResponse>('/api/sites', {
  key: 'overview-everywhere',
  default: () => ({ sites: [], latest: null }),
})
watch(error, (e) => { if (e) toast.add({ title: 'Could not load the sites', description: errorMessage(e), color: 'error' }) })

// Fresh numbers while the page is open (the checks run every minute).
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { refresh(); refreshMe() }, 60_000) })
onBeforeUnmount(() => clearInterval(timer))

const workspaces = computed(() => workingWorkspaces(me.value))
const sites = computed(() => data.value.sites.filter((s) => workspaces.value.some((w) => w.id === s.workspace.id)))
const CERT_WARN_DAYS = 21

/** What makes a site worth a look: down, its certificate, an unreadable status, a drop in visitors, errors, an old tinyzoo. */
function troubles(s: SiteSummary): string[] {
  const out: string[] = []
  if (s.state === 'down') out.push(`down for ${duration(s.stateSince ?? s.lastCheckAt ?? '', null, now.value)}`)
  const days = daysLeft(s.certExpiresAt, now.value)
  if (days != null && days < CERT_WARN_DAYS) out.push(days < 0 ? 'certificate expired' : `certificate expires in ${days} days`)
  if (s.statusError) out.push('status unreadable')
  if (s.traffic?.drop) out.push('visitors dropped')
  if (s.errors24h > 0) out.push(`${s.errors24h} server error${s.errors24h === 1 ? '' : 's'}`)
  if (s.outdated) out.push(`runs tinyzoo ${s.version}`)
  return out
}

interface Group { ws: MeWorkspace; sites: SiteSummary[]; down: number; behind: number; needs: number }
const ORDER = { down: 0, unknown: 1, up: 2 } as const
const groups = computed<Group[]>(() => workspaces.value
  .map((ws) => {
    const own = sites.value.filter((s) => s.workspace.id === ws.id)
      .sort((a, b) => ORDER[a.state] - ORDER[b.state] || troubles(b).length - troubles(a).length || a.name.localeCompare(b.name))
    return {
      ws,
      sites: own,
      down: own.filter((s) => s.state === 'down').length,
      behind: own.filter((s) => s.outdated).length,
      needs: own.filter((s) => troubles(s).length).length,
    }
  })
  .sort((a, b) => b.down - a.down || b.needs - a.needs || a.ws.name.localeCompare(b.ws.name)))
const loud = computed(() => groups.value.filter((g) => g.needs))
const quiet = computed(() => groups.value.filter((g) => !g.needs))
// Quiet workspaces fold away while others need you; with nothing to say, all show.
const showQuiet = ref(false)
const quietOpen = computed(() => showQuiet.value || !loud.value.length)

// ── the greeting ──
const greeting = computed(() => {
  const h = new Date(now.value).getHours()
  const part = h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  const first = (user.value?.name || '').split(' ')[0]
  return first ? `${part}, ${first}` : part
})
const down = computed(() => sites.value.filter((s) => s.state === 'down'))
const summary = computed(() => {
  const n = sites.value.length
  const w = workspaces.value.length
  if (!n) return `None of your ${w} workspaces has a site yet.`
  const parts: string[] = []
  const inWs = `in ${w} workspaces`
  if (down.value.length === 1) parts.push(`${down.value[0]!.name} (${down.value[0]!.workspace.name}) is down.`)
  else if (down.value.length) parts.push(`${down.value.length} sites are down.`)
  else if (sites.value.every((s) => s.state === 'up')) parts.push(n === 1 ? `Your one site ${inWs} is up.` : `All ${n} sites ${inWs} are up.`)
  else parts.push(`${n} sites ${inWs}, ${sites.value.filter((s) => s.state === 'up').length} of them up.`)
  const behindWs = groups.value.filter((g) => g.behind)
  if (behindWs.length === 1) parts.push(`${behindWs[0]!.ws.name} runs an older tinyzoo.`)
  else if (behindWs.length) parts.push(`${behindWs.length} workspaces run an older tinyzoo.`)
  return parts.join(' ')
})
const downBanner = computed(() => {
  const d = down.value
  if (!d.length) return null
  const first = d[0]!
  if (d.length === 1) {
    return {
      title: `${first.name} is down`,
      text: `For ${duration(first.stateSince ?? first.lastCheckAt ?? '', null, now.value)} · ${first.workspace.name}. Keeper checks it every minute and shows it here as soon as it answers again.`,
      seed: first.id,
      to: siteLink(first),
    }
  }
  const names = d.slice(0, 3).map((s) => s.name)
  const rest = d.length - names.length
  return { title: `${d.length} sites are down`, text: `${names.join(', ')}${rest ? ` and ${rest} more` : ''}. Keeper checks them every minute.`, seed: first.id, to: `/w/${first.workspace.slug}/t/all` }
})

const siteLink = (s: SiteSummary) => `/w/${s.workspace.slug}/t/${s.team.slug}/sites/${s.id}`
const teamsOf = (ws: MeWorkspace) => ws.teams.length
function stateLine(s: SiteSummary): string {
  const t = troubles(s)
  if (t.length) return t.join(' · ')
  if (s.state === 'unknown') return 'Not checked yet'
  return s.stateSince ? `Up for ${duration(s.stateSince, null, now.value)}` : 'Up'
}
const initial = (name: string) => name.trim().charAt(0).toUpperCase()
</script>

<template>
  <AppPage title="Every workspace" :heading="false">
    <KBanner v-if="downBanner" as="h1" :title="downBanner.title" :text="downBanner.text" :seed="downBanner.seed">
      <template #actions>
        <UButton :to="downBanner.to" label="Look" icon="i-lucide-arrow-right" trailing />
      </template>
    </KBanner>

    <section v-else class="k-moment relative flex items-center justify-between gap-6 overflow-hidden p-5 sm:px-8 sm:py-7">
      <div class="min-w-0 pr-16 sm:pr-0">
        <h1 class="k-display text-2xl leading-tight text-highlighted sm:text-[1.75rem]">{{ greeting }}</h1>
        <p class="k-moment__muted mt-1 text-sm text-pretty sm:text-[0.9375rem]">
          <USkeleton v-if="status === 'pending' && !sites.length" class="h-4 w-56" />
          <template v-else>{{ summary }}</template>
        </p>
        <div class="mt-4 flex flex-wrap gap-2">
          <UButton to="/home/versions" icon="i-lucide-git-branch" label="Versions" color="neutral" variant="outline" class="k-on-moment" />
        </div>
      </div>
      <KAnimal name="elephant" class="absolute top-5 right-4 h-10 w-auto shrink-0 sm:static sm:h-24" />
    </section>

    <div v-if="status === 'pending' && !sites.length" class="mt-8 flex flex-col gap-3">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-24 w-full" />
    </div>

    <div v-else class="mt-8 flex flex-col gap-4">
      <template v-for="g in [...loud, ...(quietOpen ? quiet : [])]" :key="g.ws.id">
        <section class="k-card overflow-hidden">
          <NuxtLink :to="`/w/${g.ws.slug}/t/all`" class="flex items-center gap-3 border-b border-(--ui-border-muted) bg-(--ui-bg-muted) px-4 py-2.5 hover:bg-elevated">
            <span class="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-(--k-moment-strong) text-[11px] font-semibold text-highlighted">{{ initial(g.ws.name) }}</span>
            <span class="min-w-0 flex-1 truncate text-sm font-semibold text-highlighted">{{ g.ws.name }}</span>
            <UBadge v-if="g.down" :label="`${g.down} down`" color="error" variant="soft" size="sm" class="shrink-0" />
            <UBadge v-if="g.behind" :label="`${g.behind} behind`" color="warning" variant="soft" size="sm" class="shrink-0" />
            <span class="hidden shrink-0 text-xs text-muted sm:inline">
              <template v-if="teamsOf(g.ws) > 1">{{ teamsOf(g.ws) }} teams · </template>{{ g.sites.length === 1 ? '1 site' : `${g.sites.length} sites` }}
            </span>
          </NuxtLink>
          <ul v-if="g.sites.length" class="divide-y divide-(--ui-border-muted)">
            <li v-for="s in g.sites" :key="s.id" class="relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-elevated/40 sm:gap-4">
              <SiteAnimal :id="s.id" :state="s.state" size="sm" />
              <div class="min-w-0 flex-1">
                <div class="flex min-w-0 items-center gap-2">
                  <NuxtLink :to="siteLink(s)" class="truncate text-sm font-medium text-highlighted after:absolute after:inset-0">{{ s.name }}</NuxtLink>
                  <UBadge v-if="s.environment === 'staging'" label="staging" color="neutral" variant="subtle" size="sm" class="shrink-0" />
                </div>
                <p class="truncate text-xs text-muted">
                  <span :class="s.state === 'down' ? 'font-medium text-error' : troubles(s).length ? 'text-warning' : ''">{{ stateLine(s) }}</span>
                  <template v-if="teamsOf(g.ws) > 1"> · {{ s.team.name }}</template>
                  · <span class="font-mono">{{ hostOf(s.url) }}</span>
                </p>
              </div>
              <dl class="hidden shrink-0 items-center gap-6 text-right md:flex">
                <div class="w-16">
                  <dt class="text-[11px] text-dimmed">Uptime</dt>
                  <dd class="text-sm tabular text-toned">{{ formatUptime(s.uptime30d) }}</dd>
                </div>
                <div class="w-16">
                  <dt class="text-[11px] text-dimmed">Answers</dt>
                  <dd class="text-sm tabular text-toned">{{ s.responseMs != null ? `${s.responseMs} ms` : '—' }}</dd>
                </div>
                <div class="w-20">
                  <dt class="text-[11px] text-dimmed">Visitors, 7 d</dt>
                  <dd class="text-sm tabular text-toned">{{ s.traffic ? s.traffic.week.toLocaleString('en-GB') : '—' }}</dd>
                </div>
              </dl>
              <div class="relative z-10 shrink-0">
                <VersionBadge v-if="s.version" :version="s.version" :outdated="s.outdated" :latest="data.latest" />
              </div>
            </li>
          </ul>
          <p v-else class="px-4 py-3 text-sm text-muted">No sites yet.</p>
        </section>
      </template>

      <button
        v-if="loud.length && quiet.length"
        type="button"
        class="k-card flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-elevated/40"
        :aria-expanded="showQuiet"
        @click="() => { showQuiet = !showQuiet }"
      >
        <span class="min-w-0 flex-1 text-muted">
          <template v-if="showQuiet">Fold the quiet workspaces</template>
          <template v-else>{{ quiet.length === 1 ? '1 more workspace' : `${quiet.length} more workspaces` }}, all up and on the newest tinyzoo</template>
        </span>
        <span class="font-medium text-highlighted">{{ showQuiet ? 'Hide' : 'Show' }}</span>
      </button>

      <p v-if="data.latest" class="text-right text-xs text-muted">Newest tinyzoo: <span class="font-mono">{{ data.latest }}</span></p>
    </div>
  </AppPage>
</template>
