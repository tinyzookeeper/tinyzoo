<script setup lang="ts">
// A program asks to connect to Keeper over OAuth (server/utils/oauth.ts). The person signed in
// decides what it may do; the browser then goes back to the program. The page carries only the
// request's id: everything that decides anything is read back from the server.
definePageMeta({ layout: 'bare' })
useHead({ title: 'Connect a program · Keeper' })

interface Pending { client: string; clientUri: string | null; redirectHost: string; scope: 'read' | 'write'; workspace: string }

const route = useRoute()
const { me } = useKeeperUser()
const id = computed(() => (typeof route.query.request === 'string' ? route.query.request : ''))
const pending = ref<Pending | null>(null)
const gone = ref(false)
const form = reactive({ name: '', scope: 'read' as 'read' | 'write' })
const busy = ref<'approve' | 'deny' | null>(null)
const error = ref('')
const redirectTo = ref<string | null>(null)

onMounted(async () => {
  try {
    pending.value = await $fetch<Pending>(`/api/oauth/requests/${encodeURIComponent(id.value)}`)
    form.name = pending.value.client
    form.scope = pending.value.scope
  }
  catch {
    gone.value = true
  }
})

const scopes = computed(() => [
  { value: 'read', label: 'Read', description: 'Sees sites, versions, checks and incidents.' },
  ...(pending.value?.scope === 'write' ? [{ value: 'write', label: 'Read and write', description: 'Can also add, change, check and remove sites.' }] : []),
])

async function decide(approve: boolean) {
  busy.value = approve ? 'approve' : 'deny'
  error.value = ''
  try {
    const res = await $fetch<{ redirectTo: string }>(`/api/oauth/requests/${encodeURIComponent(id.value)}/decision`, {
      method: 'POST',
      body: approve ? { approve, name: form.name.trim() || undefined, scope: form.scope } : { approve },
    })
    if (!approve) return goBack(res.redirectTo)
    // A moment that says it worked, before the program's own page takes over.
    redirectTo.value = res.redirectTo
    setTimeout(() => goBack(res.redirectTo), 1200)
  }
  catch (err) {
    error.value = errorMessage(err, 'Could not answer the request.')
    if ((err as any)?.statusCode === 410) gone.value = true
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
      <KAnimal name="owl" class="mx-auto mb-5 h-20 w-auto" />
      <template v-if="redirectTo">
        <h1 class="k-display text-[1.5rem] leading-tight text-highlighted">Connected</h1>
        <p class="mt-1 text-[0.9375rem] text-(--k-moment-text)">Going back to {{ pending?.client }}…</p>
      </template>
      <template v-else-if="gone">
        <h1 class="k-display text-[1.5rem] leading-tight text-highlighted">This request is no longer open</h1>
        <p class="mt-1 text-[0.9375rem] text-pretty text-(--k-moment-text)">It was answered already, or it waited too long. Connect again from the program.</p>
      </template>
      <template v-else-if="pending">
        <h1 class="k-display text-[1.5rem] leading-tight text-pretty text-highlighted">{{ pending.client }} wants to connect to Keeper</h1>
        <p class="mt-1 text-[0.9375rem] text-pretty text-(--k-moment-text)">
          It will act as you in {{ pending.workspace }}.
        </p>
      </template>
    </div>

    <div v-if="redirectTo" class="text-center">
      <UButton label="Continue" color="neutral" variant="outline" @click="goBack(redirectTo)" />
    </div>

    <form v-else-if="pending && !gone" class="flex flex-col gap-4" @submit.prevent="decide(true)">
      <div class="k-card flex flex-col gap-1 p-4 text-sm">
        <p class="text-muted">Signed in as <span class="text-highlighted">{{ me?.name || me?.email }}</span></p>
        <p class="text-muted">Answers go back to <span class="font-mono text-highlighted">{{ pending.redirectHost }}</span></p>
      </div>
      <UFormField label="Name" name="name" description="How it shows in Settings → Access tokens.">
        <UInput v-model="form.name" maxlength="80" class="w-full" />
      </UFormField>
      <UFormField label="Access" name="scope">
        <URadioGroup v-model="form.scope" :items="scopes" variant="card" class="w-full" />
      </UFormField>
      <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-alert" :description="error" />
      <div class="flex gap-2">
        <UButton label="Decline" color="neutral" variant="outline" block size="lg" class="flex-1" :loading="busy === 'deny'" :disabled="!!busy" @click="decide(false)" />
        <UButton type="submit" label="Allow" block size="lg" class="flex-1" :loading="busy === 'approve'" :disabled="!!busy" />
      </div>
      <p class="text-center text-xs text-pretty text-muted">You can disconnect it any time in Settings → Access tokens.</p>
    </form>
  </div>
</template>
