<script setup lang="ts">
import { accountEnvLines } from '#shared/account'
import type { ClientCredentials, ConnectedSiteView } from '#shared/api'

// Connect a website I already run (a tinyzoo site on its own server, not one made here): its
// name and address in, the three settings for that website out. The secret is on screen once;
// afterwards a connected website can only get a new one, or be disconnected.
const t = useT()
const errorText = useErrorText()
const { locale } = useLocale()
const toast = useToast()
useHead({ title: () => t('connect.title') })

const { data, refresh } = await useFetch<{ clients: ConnectedSiteView[]; max: number }>('/api/clients', { key: 'clients' })
const clients = computed(() => data.value?.clients ?? [])

const form = reactive({ name: '', url: '' })
const busy = ref(false)
const error = ref('')
// What was just made (or given a new secret): shown until the person says they saved it.
const shown = ref<{ name: string; credentials: ClientCredentials } | null>(null)
const lines = computed(() => (shown.value ? accountEnvLines(shown.value.credentials) : ''))

async function connect() {
  busy.value = true
  error.value = ''
  try {
    const made = await $fetch<{ client: ConnectedSiteView; credentials: ClientCredentials }>('/api/clients', { method: 'POST', body: { name: form.name.trim(), url: form.url.trim() } })
    shown.value = { name: made.client.name, credentials: made.credentials }
    form.name = ''
    form.url = ''
    await refresh()
  }
  catch (err) { error.value = errorText(err) }
  finally { busy.value = false }
}

async function copy() {
  await navigator.clipboard.writeText(lines.value).catch(() => {})
  toast.add({ title: t('connect.copied'), icon: 'i-lucide-check' })
}

// A new secret, or disconnecting: asked once more, since both stop sign-ins that work now.
const asking = ref<{ kind: 'secret' | 'remove'; client: ConnectedSiteView } | null>(null)
const askOpen = computed({ get: () => !!asking.value, set: (open) => { if (!open) asking.value = null } })
const acting = ref(false)
const ask = (kind: 'secret' | 'remove', client: ConnectedSiteView) => { asking.value = { kind, client } }
const closeAsk = () => { asking.value = null }
const saved = () => { shown.value = null }
async function confirm() {
  const ask = asking.value
  if (!ask) return
  acting.value = true
  try {
    if (ask.kind === 'secret') {
      const res = await $fetch<{ credentials: ClientCredentials }>(`/api/clients/${ask.client.id}/secret`, { method: 'POST' })
      shown.value = { name: ask.client.name, credentials: res.credentials }
    }
    else {
      await $fetch(`/api/clients/${ask.client.id}/remove`, { method: 'POST' })
      if (shown.value?.credentials.clientId === ask.client.id) shown.value = null
      toast.add({ title: t('connect.disconnected'), icon: 'i-lucide-check' })
    }
    asking.value = null
    await refresh()
  }
  catch (err) { toast.add({ title: errorText(err), color: 'error' }) }
  finally { acting.value = false }
}
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
    <nav class="mb-3 flex items-center gap-1.5 text-sm" :aria-label="t('nav.where')">
      <NuxtLink to="/sites" class="text-muted hover:text-highlighted">{{ t('nav.sites') }}</NuxtLink>
      <UIcon name="i-lucide-chevron-right" class="size-4 text-dimmed" />
      <span class="truncate font-medium text-highlighted">{{ t('connect.title') }}</span>
    </nav>
    <h1 class="z-display text-[1.75rem] leading-tight text-balance text-highlighted sm:text-4xl">{{ t('connect.title') }}</h1>
    <p class="mt-1.5 max-w-2xl text-[0.9375rem] text-pretty text-muted">{{ t('connect.lead') }}</p>

    <div class="mt-8 flex flex-col gap-8">
      <!-- The settings of the website just connected (or given a new secret). On screen once. -->
      <section v-if="shown" class="z-note p-4 sm:p-5" data-credentials>
        <h2 class="z-title text-lg text-highlighted">{{ t('connect.credsTitle', { name: shown.name }) }}</h2>
        <p class="z-moment-text mt-1 text-sm text-pretty">{{ t('connect.credsText') }}</p>
        <pre class="mt-4 overflow-x-auto rounded-lg bg-(--z-surface) p-3.5 font-mono text-[0.8125rem] leading-relaxed text-highlighted" data-env-lines>{{ lines }}</pre>
        <div class="mt-4 flex flex-wrap items-center gap-2">
          <UButton :label="t('connect.copy')" icon="i-lucide-copy" data-copy @click="copy" />
          <UButton :label="t('connect.done')" color="neutral" variant="ghost" data-done @click="saved" />
        </div>
      </section>

      <InfoCard :title="t('connect.formTitle')">
        <form class="flex flex-col gap-4" @submit.prevent="connect">
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField :label="t('connect.name')" name="name">
              <UInput v-model="form.name" size="lg" maxlength="80" required class="w-full" :placeholder="t('connect.namePlaceholder')" data-field-name />
            </UFormField>
            <UFormField :label="t('connect.url')" name="url" :help="t('connect.urlHelp')">
              <UInput v-model="form.url" size="lg" maxlength="300" required class="w-full" inputmode="url" autocapitalize="none" autocomplete="off" spellcheck="false" :placeholder="t('connect.urlPlaceholder')" :ui="{ base: 'font-mono' }" data-field-url />
            </UFormField>
          </div>
          <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-alert" :description="error" />
          <div class="flex justify-end">
            <UButton type="submit" :label="t('connect.submit')" size="lg" :loading="busy" :disabled="!form.name.trim() || !form.url.trim()" data-submit />
          </div>
        </form>
      </InfoCard>

      <InfoCard :title="t('connect.listTitle')" :padded="false">
        <p v-if="!clients.length" class="p-4 text-sm text-muted sm:p-5" data-none>{{ t('connect.none') }}</p>
        <ul v-else class="divide-y divide-default">
          <li v-for="c in clients" :key="c.id" class="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:p-5" :data-client="c.id">
            <div class="min-w-0 flex-1 basis-48">
              <p class="truncate font-medium text-highlighted">{{ c.name }}</p>
              <p class="truncate font-mono text-[0.8125rem] text-muted">{{ hostOf(c.url) }}</p>
              <p class="mt-0.5 text-xs text-dimmed">{{ t('connect.since', { date: formatDate(c.createdAt, locale) }) }}</p>
            </div>
            <div class="flex flex-wrap items-center gap-1">
              <UButton :to="c.adminUrl" target="_blank" :label="t('site.openAdmin')" color="neutral" variant="outline" size="sm" trailing-icon="i-lucide-arrow-up-right" />
              <UButton :label="t('connect.newSecret')" color="neutral" variant="ghost" size="sm" icon="i-lucide-key-round" data-new-secret @click="ask('secret', c)" />
              <UButton :label="t('connect.disconnect')" color="error" variant="ghost" size="sm" icon="i-lucide-unplug" data-disconnect @click="ask('remove', c)" />
            </div>
          </li>
        </ul>
      </InfoCard>
    </div>

    <UModal
      v-model:open="askOpen"
      :title="asking ? t(asking.kind === 'secret' ? 'connect.newSecretTitle' : 'connect.disconnectTitle', { name: asking.client.name }) : ''"
      :description="asking ? t(asking.kind === 'secret' ? 'connect.newSecretText' : 'connect.disconnectText') : ''"
      :ui="{ footer: 'justify-end' }"
    >
      <template #footer>
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="closeAsk" />
        <UButton :label="asking?.kind === 'secret' ? t('connect.newSecretNow') : t('connect.disconnectNow')" :color="asking?.kind === 'secret' ? 'primary' : 'error'" :loading="acting" data-confirm @click="confirm" />
      </template>
    </UModal>
  </div>
</template>
