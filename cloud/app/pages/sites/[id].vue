<script setup lang="ts">
import type { SiteRuntime, SiteView } from '#shared/api'
import { templateById } from '#shared/templates'
import type { Fact } from '~/components/FactList.vue'

// One website. While it is being made: the steps, live. Then its own page: its address, the
// way into its admin, what it was made from, and its removal.
const route = useRoute()
const t = useT()
const l = useL()
const errorText = useErrorText()
const { locale } = useLocale()
const { account, refresh: refreshAccount } = useAccount()
const toast = useToast()
const id = String(route.params.id)

const { data, error: loadError, refresh } = await useFetch<{ site: SiteView; runtime: SiteRuntime | null }>(`/api/sites/${id}`, { key: `site-${id}`, query: { runtime: 1 } })
if (loadError.value || !data.value) throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })
const site = computed(() => data.value!.site)
const runtime = computed(() => data.value?.runtime ?? null)
useHead({ title: () => site.value.name })

// Opened while it was being made: the making stays on screen until it has shown its end.
const watching = ref(site.value.status !== 'ready' && site.value.status !== 'removing')
const justMade = ref(false)
function finished() {
  watching.value = false
  justMade.value = true
}

// Live: every second while something is happening, every few seconds while waiting for the
// owner to choose their password, and whenever the tab gets the focus back.
let timer: ReturnType<typeof setTimeout> | null = null
const gone = ref(false)
async function poll() {
  timer = null
  if (gone.value) return
  await refresh()
  if (loadError.value) {
    // Removed (here or in another tab): back to the list.
    gone.value = true
    await refreshAccount()
    await navigateTo('/sites')
    return
  }
  schedule()
}
function schedule() {
  if (timer || gone.value) return
  const s = site.value.status
  const wait = s === 'creating' || s === 'removing' ? 1000 : s === 'waiting' ? 3000 : s === 'ready' && !site.value.ownerAccepted ? 4000 : 0
  if (wait) timer = setTimeout(poll, wait)
}
const onFocus = () => { if (!timer && !gone.value) void poll() }
onMounted(() => { schedule(); window.addEventListener('focus', onFocus) })
onBeforeUnmount(() => { gone.value = true; if (timer) clearTimeout(timer); window.removeEventListener('focus', onFocus) })

const busy = ref(false)
async function retry() {
  busy.value = true
  try {
    await $fetch(`/api/sites/${id}/retry`, { method: 'POST' })
    await refresh()
    schedule()
  }
  catch (err) { toast.add({ title: errorText(err), color: 'error' }) }
  finally { busy.value = false }
}

// ── the admin ──
const linking = ref(false)
async function freshLink() {
  linking.value = true
  try {
    const res = await $fetch<{ site: SiteView }>(`/api/sites/${id}/invite`, { method: 'POST' })
    data.value = { site: res.site, runtime: runtime.value }
    toast.add({ title: res.site.ownerAccepted ? t('site.alreadyAccepted') : t('site.freshLinkDone'), icon: 'i-lucide-check' })
  }
  catch (err) { toast.add({ title: errorText(err), color: 'error' }) }
  finally { linking.value = false }
}

// ── confirm the e-mail (a site that waits for it) ──
const resending = ref(false)
async function resendVerification() {
  resending.value = true
  try {
    await $fetch('/api/auth/verify-resend', { method: 'POST' })
    await refreshAccount()
    toast.add({ title: t('verify.sent'), icon: 'i-lucide-check' })
  }
  catch (err) { toast.add({ title: errorText(err), color: 'error' }) }
  finally { resending.value = false }
}

// ── removal ──
const removing = ref(false)
const confirmOpen = ref(false)
const confirmText = ref('')
const removeError = ref('')
const askRemove = () => { confirmText.value = ''; removeError.value = ''; confirmOpen.value = true }
const closeRemove = () => { confirmOpen.value = false }
async function remove() {
  removing.value = true
  removeError.value = ''
  try {
    await $fetch(`/api/sites/${id}/remove`, { method: 'POST', body: { confirm: confirmText.value } })
    confirmOpen.value = false
    await refresh()
    schedule()
  }
  catch (err) { removeError.value = errorText(err) }
  finally { removing.value = false }
}

const template = computed(() => templateById(site.value.template))
const facts = computed<Fact[]>(() => [
  { label: t('site.address'), value: hostOf(site.value.publicUrl), mono: true, to: site.value.publicUrl ?? undefined },
  { label: t('site.template'), value: template.value ? l(template.value.name) : site.value.template },
  { label: t('site.created'), value: formatDateTime(site.value.readyAt ?? site.value.createdAt, locale.value) },
  ...(runtime.value ? [{ label: t('site.state'), value: runtime.value.running ? t('site.running') : t('site.stopped') }] : []),
])
</script>

<template>
  <div class="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
    <!-- Being made (or it failed, or it waits for the e-mail to be confirmed). -->
    <template v-if="watching">
      <BuildScene :site="site" :busy="busy" @finished="finished" @retry="retry">
        <template #waiting>
          <DevMailNote :url="account.devVerifyUrl" :label="t('verify.open')" />
          <UButton v-if="!account.devVerifyUrl" :label="t('verify.resend')" color="neutral" variant="outline" :loading="resending" icon="i-lucide-mail" @click="resendVerification" />
        </template>
      </BuildScene>
      <div v-if="site.status === 'failed' || site.status === 'waiting'" class="mt-4 flex justify-end">
        <UButton :label="t('site.delete')" color="neutral" variant="ghost" size="sm" icon="i-lucide-trash-2" @click="askRemove" />
      </div>
    </template>

    <!-- Being removed. -->
    <ZEmpty v-else-if="site.status === 'removing'" animal="snail" :title="t('site.removingTitle')" :description="t('site.removingText')" />

    <!-- The site's own page. -->
    <template v-else>
      <nav class="mb-3 flex items-center gap-1.5 text-sm" :aria-label="t('nav.where')">
        <NuxtLink to="/sites" class="text-muted hover:text-highlighted">{{ t('nav.sites') }}</NuxtLink>
        <UIcon name="i-lucide-chevron-right" class="size-4 text-dimmed" />
        <span class="truncate font-medium text-highlighted">{{ site.name }}</span>
      </nav>

      <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-8">
        <!-- The website: what it looks like right now, and the way to it. -->
        <section class="z-moment p-5 sm:p-8" :class="justMade ? 'z-rise' : ''">
          <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div class="min-w-0">
              <p class="mb-2 inline-flex items-center gap-2 text-sm font-medium text-highlighted">
                <span class="size-2 rounded-full bg-(--z-ok) shadow-[0_0_0_4px_color-mix(in_oklab,var(--z-ok)_20%,transparent)]" />
                {{ justMade ? t('site.justMade') : t('site.live') }}
              </p>
              <h1 class="z-display text-[2rem] leading-[1.1] text-balance text-highlighted sm:text-[2.75rem]" data-site-name>{{ site.name }}</h1>
            </div>
            <UButton v-if="site.publicUrl" :to="site.publicUrl" target="_blank" :label="t('site.open')" size="lg" trailing-icon="i-lucide-arrow-up-right" data-open-site />
          </div>
          <div class="mt-6">
            <SitePreview v-if="site.publicUrl" :url="site.publicUrl" :label="t('site.open')" />
          </div>
        </section>

        <div class="flex flex-col gap-6" :class="justMade ? 'z-rise z-rise-2' : ''">
          <!-- The admin: the first time, the way in is the invitation; afterwards, a plain link. -->
          <section v-if="!site.ownerAccepted" class="z-card overflow-hidden" data-admin="invite">
            <div class="flex items-end justify-between gap-4 bg-(--z-moment-bg) px-5 pt-5 sm:px-6">
              <p class="pb-4 text-sm font-semibold text-highlighted">{{ t('site.adminKicker') }}</p>
              <ZAnimal name="panda" class="h-16 w-auto translate-y-px" />
            </div>
            <div class="p-5 sm:p-6">
              <h2 class="z-title text-xl leading-snug text-highlighted">{{ t('site.setPasswordTitle') }}</h2>
              <p class="mt-1.5 text-[0.9375rem] leading-relaxed text-pretty text-muted">{{ t('site.setPasswordText') }}</p>
              <UButton v-if="site.inviteUrl" :to="site.inviteUrl" target="_blank" :label="t('site.setPassword')" size="lg" block class="mt-5" trailing-icon="i-lucide-key-round" data-invite />
              <p class="mt-4 text-sm text-muted">
                {{ t('site.linkValid') }}
                <button type="button" class="font-medium text-highlighted underline decoration-(--ui-border-accented) underline-offset-4 disabled:opacity-60" :disabled="linking" data-fresh-link @click="freshLink">{{ linking ? t('site.freshLinkBusy') : t('site.freshLink') }}</button>
              </p>
            </div>
          </section>
          <section v-else class="z-card p-5 sm:p-6" data-admin="open">
            <h2 class="z-title text-xl leading-snug text-highlighted">{{ t('site.adminTitle') }}</h2>
            <p class="mt-1.5 text-[0.9375rem] leading-relaxed text-pretty text-muted">{{ t('site.adminText') }}</p>
            <UButton v-if="site.adminUrl" :to="site.adminUrl" target="_blank" :label="t('site.openAdmin')" size="lg" block class="mt-5" trailing-icon="i-lucide-arrow-up-right" data-open-admin />
          </section>

          <InfoCard :title="t('site.about')">
            <FactList :facts="facts" />
          </InfoCard>

          <section class="flex items-center justify-between gap-4 px-1">
            <p class="text-sm text-pretty text-muted">{{ t('site.deleteHint') }}</p>
            <UButton :label="t('site.delete')" color="error" variant="ghost" icon="i-lucide-trash-2" class="shrink-0" data-delete @click="askRemove" />
          </section>
        </div>
      </div>
    </template>

    <!-- Delete, with the address typed out. -->
    <UModal v-model:open="confirmOpen" :title="t('site.deleteTitle', { name: site.name })" :description="t('site.deleteText')" :ui="{ footer: 'justify-end' }">
      <template #body>
        <form id="remove-site" class="flex flex-col gap-3" @submit.prevent="remove">
          <UFormField :label="t('site.deleteConfirm', { slug: site.slug })" name="confirm">
            <UInput v-model="confirmText" size="lg" class="w-full" autocapitalize="none" autocomplete="off" spellcheck="false" :placeholder="site.slug" :ui="{ base: 'font-mono' }" data-confirm />
          </UFormField>
          <UAlert v-if="removeError" color="error" variant="soft" icon="i-lucide-circle-alert" :description="removeError" />
        </form>
      </template>
      <template #footer>
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="closeRemove" />
        <UButton type="submit" form="remove-site" :label="t('site.deleteNow')" color="error" :loading="removing" :disabled="confirmText.trim().toLowerCase() !== site.slug" data-confirm-delete />
      </template>
    </UModal>
  </div>
</template>
