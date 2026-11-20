<script setup lang="ts">
import type { GuestGlance, GuestSite } from '#keeper/types/keeper'

// What a client's person sees: their sites in plain words (up or down, outages, visitors, speed,
// certificate), signed by whoever looks after them. No versions, tokens, errors or admin.
const { me: user } = useKeeperUser()
const { wsSlug, workspace, signature } = useScope()
const now = useNow()
const { data, refresh } = await useFetch<GuestGlance>(() => `/api/w/${wsSlug.value}/glance`, { key: `glance-${wsSlug.value}` })
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { refresh() }, 60_000) })
onBeforeUnmount(() => clearInterval(timer))

const sites = computed(() => data.value?.sites ?? [])
const title = computed(() => (data.value?.teams.length === 1 ? data.value.teams[0]! : workspace.value?.name ?? 'Your sites'))
const by = computed(() => (signature.value && signature.value !== title.value ? signature.value : ''))
useHead({ title: () => `${title.value} · Keeper` })

const greeting = computed(() => {
  const h = new Date(now.value).getHours()
  const part = h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  const first = (user.value?.name || '').split(' ')[0]
  return first ? `${part}, ${first}` : part
})
const lastCheck = computed(() => sites.value.map((s) => s.lastCheckAt).filter(Boolean).sort().at(-1) ?? null)
const summary = computed(() => {
  const all = sites.value
  if (!all.length) return 'There are no sites here for you yet.'
  const down = all.filter((s) => s.state === 'down')
  const checked = lastCheck.value ? ` Keeper checked ${all.length === 1 ? 'it' : 'them'} ${timeAgo(lastCheck.value, now.value)}.` : ''
  if (down.length === 1) return `${down[0]!.name} has not answered for ${duration(down[0]!.stateSince ?? '', null, now.value)}. Keeper noticed and told ${signature.value || 'the team'}.`
  if (down.length) return `${down.length} of your sites are not answering. Keeper noticed and told ${signature.value || 'the team'}.`
  if (all.every((s) => s.state === 'up')) return `${all.length === 1 ? 'Your site is up.' : all.length === 2 ? 'Both of your sites are up.' : `All ${all.length} of your sites are up.`}${checked}`
  return `Keeper is checking your sites for the first time.`
})

function outageLine(s: GuestSite): string {
  const o = s.outages
  if (!o.count) return 'No outages in the last 30 days'
  if (o.count === 1 && o.last) {
    const when = new Date(o.last.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    return o.last.endedAt ? `Down ${minutes(o.minutes)} on ${when} · last 30 days` : `Down since ${when}`
  }
  return `${o.count} outages, ${minutes(o.minutes)} in all · last 30 days`
}
const minutes = (m: number) => (m < 60 ? `${Math.max(1, m)} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} days`)
const speed = (ms: number | null) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)} s`)
function certLine(s: GuestSite): string {
  const d = daysLeft(s.certExpiresAt, now.value)
  if (d == null) return '—'
  return d < 0 ? 'Expired' : d === 1 ? '1 day' : `${d} days`
}
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')
</script>

<template>
  <AppPage :title="title" :heading="false">
    <div class="flex flex-col gap-6">
      <div class="flex items-center gap-3.5">
        <span class="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-(--k-moment-strong) text-base font-semibold text-highlighted">{{ initials(title) }}</span>
        <div class="min-w-0">
          <h1 class="k-display truncate text-2xl leading-tight text-highlighted">{{ title }}</h1>
          <p v-if="by" class="text-sm text-muted">looked after by <span class="font-medium text-toned">{{ by }}</span></p>
        </div>
      </div>

      <section class="k-moment flex items-center justify-between gap-6 p-5 sm:px-7 sm:py-6">
        <div class="min-w-0">
          <p class="k-display text-xl leading-tight text-highlighted sm:text-2xl">{{ greeting }}</p>
          <p class="k-moment__muted mt-1 text-sm text-pretty sm:text-[0.9375rem]">{{ summary }}</p>
        </div>
        <KAnimal name="elephant" class="hidden h-16 w-auto shrink-0 sm:block" />
      </section>

      <ul class="flex flex-col gap-3">
        <li v-for="s in sites" :key="s.id" class="k-card flex flex-col gap-3 p-4 sm:p-5">
          <div class="flex items-center gap-3">
            <SiteAnimal :id="s.id" :state="s.state" size="sm" />
            <div class="min-w-0 flex-1">
              <p class="flex min-w-0 items-center gap-2">
                <span class="k-display truncate text-[17px] text-highlighted">{{ s.environment === 'staging' ? `${s.name} · staging` : s.name }}</span>
              </p>
              <p class="truncate text-xs" :class="s.state === 'down' ? 'font-medium text-error' : 'text-muted'">{{ s.state === 'down' ? `Not answering for ${duration(s.stateSince ?? '', null, now)}` : outageLine(s) }}</p>
            </div>
            <StateBadge :state="s.state" />
          </div>
          <dl class="grid grid-cols-3 gap-2">
            <div class="min-w-0 rounded-lg bg-(--ui-bg-muted) px-3 py-2">
              <dt class="text-xs text-muted">Visitors, 30 days</dt>
              <dd class="truncate font-semibold text-highlighted tabular-nums">{{ s.visitors30d != null ? s.visitors30d.toLocaleString('en-GB') : '—' }}</dd>
            </div>
            <div class="min-w-0 rounded-lg bg-(--ui-bg-muted) px-3 py-2">
              <dt class="text-xs text-muted">Speed</dt>
              <dd class="truncate font-semibold text-highlighted tabular-nums">{{ speed(s.responseMs) }}</dd>
            </div>
            <div class="min-w-0 rounded-lg bg-(--ui-bg-muted) px-3 py-2">
              <dt class="text-xs text-muted">Certificate</dt>
              <dd class="truncate font-semibold text-highlighted tabular-nums">{{ certLine(s) }}</dd>
            </div>
          </dl>
          <p class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>{{ s.uptime30d != null ? `Up ${formatUptime(s.uptime30d)} of the last 30 days` : '' }}</span>
            <a :href="s.url" target="_blank" rel="noopener" class="inline-flex items-center gap-1 font-medium text-highlighted hover:underline">{{ hostOf(s.url) }}<UIcon name="i-lucide-arrow-up-right" class="size-3.5" /></a>
          </p>
        </li>
      </ul>

      <p class="flex items-center justify-center gap-2 pt-2 text-xs text-muted">
        <span>Watched by</span><KBrand /><span class="sr-only">Keeper</span>
      </p>
    </div>
  </AppPage>
</template>
