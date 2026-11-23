<script setup lang="ts">
import type { SitesView, SiteView } from '#shared/api'
import { lookOf, templateById } from '#shared/templates'

// My websites: the ones made here (a card each, with its state, and the way to another one),
// the ones I run myself and connected to my account, and other people's websites I work on.
const t = useT()
const l = useL()
const { user, account, refresh: refreshAccount } = useAccount()
useHead({ title: () => t('sites.title') })

const { data, refresh } = await useFetch<SitesView>('/api/sites', { key: 'sites' })
const sites = computed(() => data.value?.sites ?? [])
const connected = computed(() => data.value?.connected ?? [])
const member = computed(() => data.value?.member ?? [])
const max = computed(() => data.value?.max ?? account.value.sites.max)
const atLimit = computed(() => sites.value.length >= max.value)
const nothing = computed(() => !sites.value.length && !connected.value.length && !member.value.length)
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

// A role is the website's own word; the common ones are put into the page's language.
const KNOWN_ROLES = { admin: 'role.admin', editor: 'role.editor', author: 'role.author', viewer: 'role.viewer' } as const
const roleName = (role: string) => (role in KNOWN_ROLES ? t(KNOWN_ROLES[role as keyof typeof KNOWN_ROLES]) : role)
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

    <ZEmpty v-if="nothing" class="mt-8" animal="elephant" :title="t('sites.emptyTitle')" :description="t('sites.emptyText')">
      <UButton to="/new" :label="t('home.cta')" size="lg" trailing-icon="i-lucide-arrow-right" />
    </ZEmpty>

    <template v-else>
      <!-- The websites made here. -->
      <h2 v-if="connected.length || member.length" class="z-label mt-8">{{ t('sites.mineTitle') }}</h2>
      <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" :class="connected.length || member.length ? 'mt-3' : 'mt-8'">
        <li v-for="s in sites" :key="s.id" class="site z-card flex h-full flex-col overflow-hidden transition hover:border-(--ui-border-accented)">
          <NuxtLink :to="`/sites/${s.id}`" class="group flex flex-1 flex-col" :data-site="s.slug" :data-status="s.status">
            <!-- The site as it looks: its template's look with its own name. -->
            <div class="relative overflow-hidden border-b border-default">
              <LookShot :template="s.template" :look="s.look" :name="s.name" class="transition-transform duration-500 group-hover:scale-[1.02]" />
              <span class="absolute top-3 left-3 inline-flex items-center gap-2 rounded-full bg-(--z-surface) px-2.5 py-1 text-xs font-medium text-highlighted shadow-sm">
                <span class="size-1.5 rounded-full" :class="{ 'bg-(--z-ok)': stateOf(s).tone === 'ok', 'bg-(--z-warm) animate-pulse': stateOf(s).tone === 'busy', 'bg-(--ui-error)': stateOf(s).tone === 'bad' }" />
                {{ stateOf(s).label }}
              </span>
            </div>
            <div class="flex flex-1 flex-col p-5">
              <h3 class="z-title truncate text-lg text-highlighted">{{ s.name }}</h3>
              <p class="mt-0.5 truncate font-mono text-[0.8125rem] text-muted">{{ hostOf(s.publicUrl) || `${s.slug}${account.siteHost}` }}</p>
              <p class="mt-4 flex items-center justify-between text-sm text-muted">
                <span class="truncate">{{ templateById(s.template) ? l(templateById(s.template)!.name) : s.template }}<template v-if="lookOf(templateById(s.template), s.look) && s.look"> · {{ l(lookOf(templateById(s.template), s.look)!.name) }}</template></span>
                <UIcon name="i-lucide-arrow-right" class="size-4 shrink-0 text-dimmed transition group-hover:translate-x-0.5 group-hover:text-highlighted" />
              </p>
            </div>
          </NuxtLink>
          <!-- Straight into the admin, through the account (which needs a confirmed e-mail: the note above says so). -->
          <a v-if="s.status === 'ready' && s.adminUrl && user?.emailVerified" :href="s.adminUrl" target="_blank" rel="noopener" class="flex items-center justify-between gap-3 border-t border-default px-5 py-3 text-sm font-medium text-highlighted hover:bg-(--ui-bg-elevated)" :data-card-admin="s.slug">
            {{ t('site.openAdmin') }}
            <UIcon name="i-lucide-arrow-up-right" class="size-4 shrink-0 text-dimmed" />
          </a>
        </li>
        <li v-if="!atLimit">
          <NuxtLink to="/new" class="flex h-full min-h-48 flex-col items-center justify-center gap-2 rounded-[0.875rem] border border-dashed border-(--ui-border-accented) p-6 text-center text-muted transition hover:border-(--ui-primary) hover:text-highlighted">
            <span class="inline-flex size-10 items-center justify-center rounded-full bg-(--z-moment-bg)"><UIcon name="i-lucide-plus" class="size-5" /></span>
            <span class="font-medium">{{ sites.length ? t('sites.another') : t('home.cta') }}</span>
          </NuxtLink>
        </li>
      </ul>
      <p v-if="atLimit" class="z-note mt-6 flex items-start gap-3 p-4 text-sm text-pretty" data-limit>
        <UIcon name="i-lucide-info" class="mt-0.5 size-4 shrink-0" />
        <span>{{ t('sites.limit', { max }) }}</span>
      </p>

      <!-- Other people's websites I signed in to through my account: only the way into their admin. -->
      <section v-if="member.length" class="mt-12" data-member-sites>
        <h2 class="z-label">{{ t('sites.memberTitle') }}</h2>
        <p class="mt-0.5 text-sm text-muted">{{ t('sites.memberLead') }}</p>
        <ul class="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <li v-for="m in member" :key="m.id" class="z-card flex flex-col p-5" :data-member-site="m.id">
            <h3 class="z-title truncate text-lg text-highlighted">{{ m.name }}</h3>
            <p class="mt-0.5 truncate font-mono text-[0.8125rem] text-muted">{{ hostOf(m.url) }}</p>
            <p v-if="m.role" class="mt-3 text-sm text-muted" data-role>{{ t('sites.role', { role: roleName(m.role) }) }}</p>
            <UButton :to="m.adminUrl" target="_blank" :label="t('site.openAdmin')" color="neutral" variant="outline" class="mt-4 self-start" trailing-icon="i-lucide-arrow-up-right" />
          </li>
        </ul>
      </section>

      <!-- Websites I run myself and connected to my account. -->
      <section v-if="connected.length" class="mt-12" data-connected-sites>
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 class="z-label">{{ t('sites.connectedTitle') }}</h2>
            <p class="mt-0.5 text-sm text-muted">{{ t('sites.connectedLead') }}</p>
          </div>
          <UButton to="/sites/connect" :label="t('sites.connectedManage')" color="neutral" variant="ghost" size="sm" trailing-icon="i-lucide-arrow-right" />
        </div>
        <ul class="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <li v-for="c in connected" :key="c.id" class="z-card flex flex-col p-5" :data-connected-site="c.id">
            <h3 class="z-title truncate text-lg text-highlighted">{{ c.name }}</h3>
            <p class="mt-0.5 truncate font-mono text-[0.8125rem] text-muted">{{ hostOf(c.url) }}</p>
            <UButton :to="c.adminUrl" target="_blank" :label="t('site.openAdmin')" color="neutral" variant="outline" class="mt-4 self-start" trailing-icon="i-lucide-arrow-up-right" />
          </li>
        </ul>
      </section>
    </template>

    <!-- The way to connect a website that runs elsewhere. -->
    <p v-if="!connected.length" class="mt-10 text-sm text-muted" data-connect-hint>
      {{ t('sites.connectHint') }}
      <NuxtLink to="/sites/connect" class="font-medium text-highlighted underline decoration-(--ui-border-accented) underline-offset-4">{{ t('sites.connectLink') }}</NuxtLink>
    </p>
  </div>
</template>
