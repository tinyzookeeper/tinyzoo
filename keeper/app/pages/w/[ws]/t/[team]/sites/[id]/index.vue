<script setup lang="ts">
import type { SiteDetail } from '#keeper/types/keeper'
import type { Fact } from '../../../../../../../components/FactList.vue'

const route = useRoute()
const id = computed(() => String(route.params.id))
const toast = useToast()
const now = useNow()
const { canWrite, link, workspace, team, isManager } = useScope()
// Simple or Detailed, for every card on the page: the same remembered choice as the Visitors views.
const view = useTrafficView(isManager)
const simple = computed(() => view.value === 'simple')

const { data: site, error, refresh } = await useFetch<SiteDetail>(() => `/api/sites/${id.value}`, { key: `site-${id.value}` })
if (error.value?.statusCode === 404) throw createError({ statusCode: 404, statusMessage: 'Site not found', fatal: true })
// A site of another workspace: open it where it lives.
if (site.value && site.value.workspace.slug !== workspace.value?.slug) await navigateTo(`/w/${site.value.workspace.slug}/t/${site.value.team.slug}/sites/${site.value.id}`, { replace: true })
useHead({ title: () => `${site.value?.name ?? 'Site'} · Keeper` })

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { refresh() }, 60_000) })
onBeforeUnmount(() => clearInterval(timer))

const checking = ref(false)
async function checkNow() {
  checking.value = true
  try {
    site.value = await $fetch<SiteDetail>(`/api/sites/${id.value}/check`, { method: 'POST' })
    toast.add({ title: site.value.state === 'up' ? 'Checked: up' : site.value.state === 'down' ? 'Checked: down' : 'Checked', color: site.value.state === 'down' ? 'error' : 'success', icon: 'i-lucide-refresh-cw' })
  }
  catch (err) {
    toast.add({ title: 'Could not check the site', description: errorMessage(err), color: 'error' })
  }
  finally {
    checking.value = false
  }
}

const s = computed(() => site.value?.status ?? null)

// Just added: a small moment, once.
const added = ref(false)
onMounted(() => {
  if (route.query.added) {
    added.value = true
    navigateTo({ query: {} }, { replace: true })
  }
})
const certDays = computed(() => daysLeft(site.value?.certExpiresAt, now.value))

const tinyzooFacts = computed<Fact[]>(() => {
  const d = site.value!
  return [
    { label: 'Version', value: d.version ?? '—', mono: true, tone: d.outdated ? 'warning' : 'default' },
    { label: 'Newest release', value: d.latest ?? '—', mono: true, tone: 'muted' },
    { label: 'Node.js', value: s.value?.node ?? '—', mono: true },
    { label: 'Instance started', value: s.value ? timeAgo(s.value.instance.startedAt, now.value) : '—' },
    { label: 'Languages', value: s.value?.site.locales?.join(', ') ?? (s.value ? 'one' : '—') },
    { label: 'Sign-in', value: s.value?.site.auth === 'external' ? 'the site’s own' : s.value ? 'tinyzoo' : '—' },
    { label: 'Webhooks', value: s.value ? (s.value.webhooks.urls ? `${s.value.webhooks.urls}${s.value.webhooks.signed ? ', signed' : ', not signed'}` : 'none') : '—', tone: s.value && s.value.webhooks.urls && !s.value.webhooks.signed ? 'warning' : 'default' },
    { label: 'Status read', value: d.statusAt ? timeAgo(d.statusAt, now.value) : '—', tone: 'muted' },
  ]
})
const peopleFacts = computed<Fact[]>(() => {
  const p = s.value!.people
  return [
    { label: 'Active', value: p.active },
    { label: 'Invited', value: p.invited, tone: p.invited ? 'default' : 'muted' },
    { label: 'Disabled', value: p.disabled, tone: 'muted' },
    { label: 'Signed in, last 30 days', value: p.signedInLast30Days },
    { label: 'Last sign-in', value: timeAgo(p.lastSignInAt, now.value) },
  ]
})
const databaseFacts = computed<Fact[]>(() => {
  const db = s.value!.database
  return [
    { label: 'Answers', value: db.ok ? 'yes' : 'no', tone: db.ok ? 'success' : 'error' },
    { label: 'Migrations at start', value: db.migrations, tone: db.migrations === 'failed' ? 'error' : 'default' },
    { label: 'Size', value: formatBytes(db.bytes) },
    { label: 'Media', value: `${s.value!.media.files} files · ${formatBytes(s.value!.media.bytes)}` },
  ]
})
const errorFacts = computed<Fact[]>(() => {
  const e = s.value!.errors
  const tone = (n: number): Fact['tone'] => (n ? 'error' : 'muted')
  return [
    { label: 'Requests', value: e.last24h.request, tone: tone(e.last24h.request) },
    { label: 'Scheduled tasks', value: e.last24h.task, tone: tone(e.last24h.task) },
    { label: 'Webhooks', value: e.last24h.webhook, tone: tone(e.last24h.webhook) },
    { label: 'Last one', value: timeAgo(e.lastAt, now.value), tone: 'muted' },
  ]
})
// The Traffic section: for a site whose status lists the analytics plugin, or that has visits already.
const showTraffic = computed(() => !!site.value && (!!site.value.traffic || !!s.value?.plugins.some((p) => p.name === 'analytics')))
// Simple: the last 30 days, as the strip. Detailed: also the older ones of the last 20.
const incidentList = computed(() => {
  const d = site.value
  if (!d) return []
  if (simple.value) return d.incidents30d
  const seen = new Set(d.incidents30d.map((i) => i.id))
  return [...d.incidents30d, ...d.incidents.filter((i) => !seen.has(i.id))]
})
const collections = computed(() => [...(s.value?.content.collections ?? [])].sort((a, b) => (b.lastEditAt ?? '').localeCompare(a.lastEditAt ?? '')))
</script>

<template>
  <AppPage :title="site?.name ?? 'Site'" :trail="[{ label: team?.name ?? 'Sites', to: link() }]" :heading="false">
    <template #actions>
      <TrafficViewSwitch v-if="site" v-model="view" />
      <UButton v-if="site && canWrite" :to="link(`/sites/${site.id}/edit`)" icon="i-lucide-pencil" label="Edit" color="neutral" variant="ghost" class="hidden sm:inline-flex" />
      <UButton v-if="site && canWrite" :to="link(`/sites/${site.id}/edit`)" icon="i-lucide-pencil" aria-label="Edit" color="neutral" variant="ghost" square class="sm:hidden" />
    </template>

    <div v-if="site" class="flex flex-col gap-8">
      <!-- The site, as a moment: its animal, how it is, the ways in. -->
      <section class="k-moment relative flex items-center justify-between gap-6 overflow-hidden p-5 sm:px-8 sm:py-7">
        <div class="min-w-0 pr-16 sm:pr-0">
          <div class="flex flex-wrap items-center gap-2">
            <StateBadge :state="site.state" :since="site.stateSince" />
            <VersionBadge v-if="site.version" :version="site.version" :outdated="site.outdated" :latest="site.latest" />
            <UBadge v-if="site.environment === 'staging'" label="staging" color="neutral" variant="subtle" />
          </div>
          <h1 class="k-display mt-3 text-2xl leading-tight text-highlighted sm:text-[1.75rem]">{{ site.name }}</h1>
          <p class="k-moment__muted mt-1 text-sm sm:text-[0.9375rem]">
            <template v-if="(workspace?.teams.length ?? 0) > 1">{{ site.team.name }} · </template>
            <a :href="site.url" target="_blank" rel="noopener" class="font-mono text-[0.8125rem] hover:underline">{{ hostOf(site.url) }}</a>
            <template v-if="site.responseMs != null"> · answers in {{ site.responseMs }} ms</template>
          </p>
          <div class="mt-4 flex flex-wrap gap-2">
            <UButton :to="site.adminUrl" target="_blank" rel="noopener" label="Open admin" trailing-icon="i-lucide-arrow-up-right" />
            <UButton :to="site.url" target="_blank" rel="noopener" label="Open site" trailing-icon="i-lucide-arrow-up-right" color="neutral" variant="outline" class="k-on-moment" />
            <UButton v-if="canWrite" label="Check now" icon="i-lucide-refresh-cw" color="neutral" variant="ghost" :loading="checking" @click="checkNow" />
          </div>
          <p class="k-moment__muted mt-3 text-xs">Last checked {{ timeAgo(site.lastCheckAt, now) }}</p>
        </div>
        <KAnimal :seed="site.id" class="absolute top-5 right-4 h-12 w-auto shrink-0 sm:static sm:h-28" />
      </section>

      <!-- Status missing: how to fix it. -->
      <div v-if="!site.hasToken || site.statusError" class="k-card flex gap-3 p-4 text-sm">
        <span class="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-warning/10 text-warning">
          <UIcon name="i-lucide-key-round" class="size-4" />
        </span>
        <div class="min-w-0">
          <p class="font-medium text-highlighted">
            {{ !site.hasToken ? 'Keeper sees uptime only: the site has no status token here.' : 'Keeper could not read the site’s status.' }}
          </p>
          <p v-if="site.statusError" class="mt-0.5 text-muted">{{ site.statusError }}</p>
          <p class="mt-1 text-muted">
            Set <code class="font-mono text-xs">NUXT_CMS_STATUS_TOKEN</code> on the site (tinyzoo 1.1 or newer) to a long random value, redeploy, and paste the same value into
            <NuxtLink :to="link(`/sites/${site.id}/edit`)" class="font-medium text-highlighted underline">Edit</NuxtLink>.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-x-4 gap-y-8 lg:grid-cols-3">
        <UptimeCard :site="site" :simple="simple" class="lg:col-span-2" />
        <IncidentsCard :incidents="incidentList" :simple="simple" />

        <TrafficSection v-if="showTraffic" no-switch :site-id="site.id" :can-check="canWrite" :checking="checking" :site-url="site.url" class="lg:col-span-3" @check="checkNow" />

        <InfoCard v-if="s" title="tinyzoo">
          <FactList :facts="tinyzooFacts" />
          <div v-if="s?.plugins.length" class="mt-3 flex flex-wrap gap-1.5">
            <UBadge v-for="p in s.plugins" :key="p.name" color="neutral" variant="outline" class="font-mono">{{ p.name }} {{ p.version }}</UBadge>
          </div>
        </InfoCard>

        <InfoCard v-if="s" title="Content" class="lg:col-span-2">
          <template #aside>
            <span class="text-sm text-muted">Last edit <span class="text-highlighted">{{ timeAgo(s.content.lastEditAt, now) }}</span></span>
          </template>
          <div class="-mx-1 overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs text-muted">
                  <th class="px-1 pb-2 font-medium">Collection</th>
                  <th class="px-1 pb-2 text-right font-medium">Entries</th>
                  <th class="px-1 pb-2 text-right font-medium">Last edit</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr v-for="c in collections" :key="c.name">
                  <td class="px-1 py-1.5 font-mono text-xs text-highlighted">
                    {{ c.name }}<span v-if="c.kind === 'global'" class="ml-1.5 font-sans text-muted">global</span>
                  </td>
                  <td class="px-1 py-1.5 text-right tabular">{{ c.kind === 'global' ? (c.count ? 'saved' : '—') : c.count }}</td>
                  <td class="px-1 py-1.5 text-right text-muted">{{ timeAgo(c.lastEditAt, now) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="s.content.untranslated" class="mt-3 text-sm text-warning">
            <UIcon name="i-lucide-languages" class="mr-1 size-4 align-[-3px]" />{{ s.content.untranslated === 1 ? '1 entry waits' : `${s.content.untranslated} entries wait` }} for a translation.
          </p>
        </InfoCard>

        <InfoCard v-if="s" title="People">
          <FactList :facts="peopleFacts" />
          <p v-if="s.site.auth === 'external'" class="mt-2 text-xs text-muted">The site signs people in itself, so there are no accounts to count.</p>
        </InfoCard>

        <InfoCard v-if="s" title="Database and media">
          <FactList :facts="databaseFacts" />
        </InfoCard>

        <InfoCard v-if="s" title="Errors, last 24 h">
          <FactList :facts="errorFacts" />
          <p class="mt-2 text-xs text-muted">Counted by the instance that answered; a restart starts again from 0.</p>
        </InfoCard>

        <InfoCard title="Certificate">
          <p v-if="site.certError" class="text-sm" :class="site.url.startsWith('http:') ? 'text-muted' : 'text-error'">{{ site.url.startsWith('http:') ? 'The site is served over plain http, so there is no certificate to watch.' : site.certError }}</p>
          <template v-else-if="site.certExpiresAt">
            <p class="font-display text-2xl font-bold tabular" :class="certDays != null && certDays < 21 ? 'text-warning' : 'text-highlighted'">
              {{ certDays != null && certDays < 0 ? 'Expired' : `${certDays} days` }}
            </p>
            <p class="text-sm text-muted">Expires <ClientOnly>{{ formatDate(site.certExpiresAt) }}</ClientOnly></p>
          </template>
          <p v-else class="text-sm text-muted">Not checked yet.</p>
        </InfoCard>

        <InfoCard v-if="site.notes || site.repoUrl" title="Notes" :class="s ? '' : 'lg:col-span-2'">
          <a v-if="site.repoUrl" :href="site.repoUrl" target="_blank" rel="noopener" class="mb-2 inline-flex items-center gap-1 font-mono text-xs text-highlighted hover:underline">
            <UIcon name="i-lucide-git-branch" class="size-3.5" />{{ site.repoUrl.replace(/^https?:\/\//, '') }}
          </a>
          <p v-if="site.notes" class="whitespace-pre-line text-sm text-toned">{{ site.notes }}</p>
        </InfoCard>
      </div>
    </div>
    <KMoment
      v-if="site"
      v-model:open="added"
      :seed="site.id"
      :title="`Keeper is watching ${site.name}`"
      :description="site.state === 'up' ? `It answered in ${site.responseMs} ms. From now on it is checked every minute.` : 'It is checked every minute from now on; the first results are below.'"
    />
  </AppPage>
</template>
