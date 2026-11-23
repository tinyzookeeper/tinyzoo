<script setup lang="ts">
import type { DomainsView, DomainView } from '#shared/domains'

// A website's own domains: add one, see what its DNS must say while it waits, check it again,
// make it the website's address, take it off. The website's address at the service works
// throughout. A change of the address is told to the page (it shows the address).
const props = defineProps<{ siteId: string }>()
const emit = defineEmits<{ changed: [] }>()
const t = useT()
const errorText = useErrorText()
const toast = useToast()

const { data, refresh } = await useFetch<DomainsView>(`/api/sites/${props.siteId}/domains`, { key: `domains-${props.siteId}` })
const domains = computed(() => data.value?.domains ?? [])
const serviceHost = computed(() => hostOf(data.value?.serviceUrl).replace(/:\d+$/, ''))
const full = computed(() => domains.value.length >= (data.value?.max ?? 5))

const host = ref('')
const adding = ref(false)
const addError = ref('')
async function add() {
  addError.value = ''
  adding.value = true
  try {
    const res = await $fetch<{ domain: DomainView }>(`/api/sites/${props.siteId}/domains`, { method: 'POST', body: { host: host.value } })
    host.value = ''
    await refresh()
    if (res.domain.verified) {
      toast.add({ title: t('domains.verified'), icon: 'i-lucide-check' })
      emit('changed')
    }
  }
  catch (err) { addError.value = errorText(err) }
  finally { adding.value = false }
}

// One thing at a time per domain: the id of the one being worked on.
const busy = ref<string | null>(null)
async function act(domain: DomainView, work: () => Promise<string | null>, changesAddress: boolean) {
  busy.value = domain.id
  try {
    const said = await work()
    await refresh()
    if (said) toast.add({ title: said, icon: 'i-lucide-check' })
    if (changesAddress) emit('changed')
  }
  catch (err) { toast.add({ title: errorText(err), color: 'error' }) }
  finally { busy.value = null }
}
const check = (d: DomainView) => act(d, async () => {
  const res = await $fetch<{ domain: DomainView }>(`/api/sites/${props.siteId}/domains/${d.id}/check`, { method: 'POST' })
  if (!res.domain.verified) { toast.add({ title: t('domains.stillWaiting'), color: 'neutral' }); return null }
  return t('domains.verified')
}, true)
const setMain = (d: DomainView, main: boolean) => act(d, async () => {
  await $fetch(`/api/sites/${props.siteId}/domains/${d.id}/main`, { method: 'POST', body: { main } })
  return t('domains.mainDone', { host: main ? d.host : serviceHost.value })
}, true)
const remove = (d: DomainView) => act(d, async () => {
  await $fetch(`/api/sites/${props.siteId}/domains/${d.id}/remove`, { method: 'POST' })
  return t('domains.removed')
}, d.verified)

/** What a waiting domain must be given in its DNS, in one sentence. */
function dnsLine(d: DomainView): string {
  const target = data.value?.target
  if (target?.cname) return t('domains.dnsCname', { host: d.host, target: target.cname })
  if (target?.ips.length) return t('domains.dnsA', { host: d.host, target: target.ips.join(', ') })
  return t('domains.wait.no_target')
}
const waitLine = (d: DomainView): string => (d.wait === 'unresolved' || d.wait === 'elsewhere' ? t(`domains.wait.${d.wait}`) : '')
</script>

<template>
  <InfoCard :title="t('domains.title')" data-domains>
    <p class="text-sm leading-relaxed text-pretty text-muted">{{ t('domains.lead', { host: serviceHost }) }}</p>

    <ul v-if="domains.length" class="mt-4 divide-y divide-default border-y border-default">
      <li v-for="d in domains" :key="d.id" class="py-3" :data-domain="d.host" :data-domain-state="d.main ? 'main' : d.verified ? 'verified' : 'waiting'">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span class="min-w-0 truncate font-mono text-[0.8125rem] text-highlighted">{{ d.host }}</span>
          <UBadge :label="d.main ? t('domains.main') : d.verified ? t('domains.inUse') : t('domains.waiting')" :color="d.main ? 'primary' : 'neutral'" :variant="d.main ? 'subtle' : 'outline'" size="sm" />
        </div>
        <p v-if="!d.verified" class="mt-1.5 text-sm leading-relaxed text-pretty text-muted" data-domain-dns>
          {{ dnsLine(d) }}
          <template v-if="waitLine(d)">{{ ' ' }}{{ waitLine(d) }}</template>
        </p>
        <div class="mt-2 flex flex-wrap gap-2">
          <UButton v-if="!d.verified" :label="t('domains.check')" size="xs" color="neutral" variant="outline" icon="i-lucide-refresh-cw" :loading="busy === d.id" data-domain-check @click="check(d)" />
          <UButton v-if="d.verified && !d.main" :label="t('domains.makeMain')" size="xs" color="neutral" variant="outline" :loading="busy === d.id" data-domain-main @click="setMain(d, true)" />
          <UButton v-if="d.main" :label="t('domains.unmakeMain', { host: serviceHost })" size="xs" color="neutral" variant="outline" :loading="busy === d.id" data-domain-unmain @click="setMain(d, false)" />
          <UButton :label="t('domains.remove')" size="xs" color="neutral" variant="ghost" :disabled="busy === d.id" data-domain-remove @click="remove(d)" />
        </div>
      </li>
    </ul>

    <form v-if="!full" class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start" @submit.prevent="add">
      <UFormField class="min-w-0 flex-1" :error="addError || undefined" name="host">
        <UInput v-model="host" class="w-full" :placeholder="t('domains.placeholder')" :aria-label="t('domains.label')" autocapitalize="none" autocomplete="off" spellcheck="false" :ui="{ base: 'font-mono' }" data-domain-input />
      </UFormField>
      <UButton type="submit" :label="t('domains.add')" color="neutral" variant="outline" :loading="adding" :disabled="!host.trim()" class="shrink-0" data-domain-add />
    </form>
  </InfoCard>
</template>
