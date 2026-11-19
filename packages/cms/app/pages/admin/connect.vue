<script setup lang="ts">
// A program asks to connect to the MCP server over OAuth (server/utils/cmsOAuth.ts). The person
// signed in chooses what it may do, as for a token they make by hand; the browser then goes back
// to the program. The page carries only the request's id: everything that decides anything is
// read back from the server.
definePageMeta({ layout: 'cms-auth' })
const { t } = useCmsI18n()
const { user } = useUserSession()
const { productName } = useCmsAdminBrand()

interface Pending { client: string; redirectHost: string; write: boolean; can: { publish: boolean; media: boolean }; areas: { name: string; label: unknown; kind: string }[] }

const route = useRoute()
const id = computed(() => (typeof route.query.request === 'string' ? route.query.request : ''))
const pending = ref<Pending | null>(null)
useHead({ title: () => t('connect.title', { client: pending.value?.client ?? '' }) })
const gone = ref(false)
const name = ref('')
const rights = ref<{ write: boolean; publish: boolean; delete: boolean; media: boolean; scope: 'all' | 'some'; entities: string[] }>({ write: false, publish: false, delete: false, media: false, scope: 'all', entities: [] })
const entitiesError = ref('')
const busy = ref<'allow' | 'decline' | null>(null)
const error = ref('')
const redirectTo = ref<string | null>(null)

// Read in the browser: the request is the person's, behind their session.
onMounted(async () => {
  try {
    pending.value = await $fetch<Pending>(`/api/cms/_auth/oauth/${encodeURIComponent(id.value)}`)
    name.value = pending.value.client
  }
  catch {
    gone.value = true
  }
})

async function decide(approve: boolean) {
  entitiesError.value = ''
  if (approve && rights.value.scope === 'some' && !rights.value.entities.length) {
    entitiesError.value = t('account.tokens.scopePick')
    return
  }
  busy.value = approve ? 'allow' : 'decline'
  error.value = ''
  try {
    const r = rights.value
    const res = await $fetch<{ redirectTo: string }>(`/api/cms/_auth/oauth/${encodeURIComponent(id.value)}`, {
      method: 'POST',
      body: approve
        ? {
            approve, name: name.value.trim() || undefined,
            rights: { write: r.write, publish: r.write && r.publish, delete: r.write && r.delete, media: r.write && r.media, entities: r.scope === 'some' ? r.entities : null },
          }
        : { approve },
    })
    if (!approve) return goBack(res.redirectTo)
    // A moment that says it worked, before the program's own page takes over.
    redirectTo.value = res.redirectTo
    setTimeout(() => goBack(res.redirectTo), 1200)
  }
  catch (err: any) {
    if (err?.statusCode === 410 || err?.status === 410) gone.value = true
    else error.value = cmsErrorMessage(err, t('connect.failed'))
  }
  finally {
    busy.value = null
  }
}

function goBack(url: string) {
  window.location.href = url
}
</script>

<template>
  <div>
    <div class="mb-6 text-center">
      <template v-if="redirectTo">
        <h1 class="cms-display text-[1.5rem] leading-tight text-highlighted">{{ t('connect.connected') }}</h1>
        <p class="mt-1 text-sm text-muted text-pretty">{{ t('connect.goingBack', { client: pending?.client ?? '' }) }}</p>
      </template>
      <template v-else-if="gone">
        <h1 class="cms-display text-[1.5rem] leading-tight text-highlighted text-pretty">{{ t('connect.goneTitle') }}</h1>
        <p class="mt-1 text-sm text-muted text-pretty">{{ t('connect.goneBody') }}</p>
      </template>
      <template v-else-if="pending">
        <h1 class="cms-display text-[1.5rem] leading-tight text-highlighted text-pretty">{{ t('connect.title', { client: pending.client }) }}</h1>
        <p class="mt-1 text-sm text-muted text-pretty">{{ t('connect.lead', { site: productName }) }}</p>
      </template>
    </div>

    <div v-if="redirectTo" class="text-center">
      <UButton color="neutral" variant="outline" @click="goBack(redirectTo)">{{ t('connect.continue') }}</UButton>
    </div>

    <form v-else-if="pending && !gone" method="post" class="space-y-5" novalidate @submit.prevent="decide(true)">
      <div class="rounded-lg border border-default bg-default p-3 text-sm text-muted space-y-1">
        <p>{{ t('connect.signedInAs', { name: user?.name || user?.email || '' }) }}</p>
        <p>{{ t('connect.goesBackTo', { host: pending.redirectHost }) }}</p>
      </div>
      <UFormField :label="t('connect.name')" name="name" :help="t('connect.nameHint')">
        <UInput v-model="name" maxlength="80" class="w-full" />
      </UFormField>
      <CmsTokenRights v-model="rights" :can="pending.can" :areas="pending.areas" :write-allowed="pending.write" :entities-error="entitiesError" />
      <p v-if="!pending.write" class="text-sm text-muted">{{ t('connect.readOnlyAsked') }}</p>
      <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :description="error" role="alert" />
      <div class="flex gap-2">
        <UButton color="neutral" variant="outline" block class="flex-1" :loading="busy === 'decline'" :disabled="!!busy" @click="decide(false)">{{ t('connect.decline') }}</UButton>
        <UButton type="submit" block class="flex-1" :loading="busy === 'allow'" :disabled="!!busy">{{ t('connect.allow') }}</UButton>
      </div>
      <p class="text-center text-xs text-muted text-pretty">{{ t('connect.later') }}</p>
    </form>
  </div>
</template>
