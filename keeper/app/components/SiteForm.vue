<script setup lang="ts">
import type { ConnectionTest, SiteInput } from '#keeper/types/keeper'

// The add and edit forms. On edit the token field starts empty: left empty it keeps
// the stored token, "Remove token" sends '' to delete it.
const props = defineProps<{
  initial?: Partial<SiteInput>
  /** Editing an existing site: its id (tests use its stored token) and whether it has a token. */
  siteId?: string
  hasToken?: boolean
  submitLabel: string
  busy?: boolean
}>()
const emit = defineEmits<{ submit: [input: SiteInput] }>()

const name = ref(props.initial?.name ?? '')
const client = ref(props.initial?.client ?? '')
const url = ref(props.initial?.url ?? '')
const environment = ref<'production' | 'staging'>(props.initial?.environment ?? 'production')
const token = ref('')
const repoUrl = ref(props.initial?.repoUrl ?? '')
const notes = ref(props.initial?.notes ?? '')
const removeToken = ref(false)
const environments = [
  { label: 'Production', value: 'production' },
  { label: 'Staging', value: 'staging' },
]

const testing = ref(false)
const test = ref<ConnectionTest | null>(null)
const testError = ref('')
async function runTest() {
  testing.value = true
  test.value = null
  testError.value = ''
  try {
    test.value = await $fetch<ConnectionTest>('/api/sites/test', {
      method: 'POST',
      body: {
        url: url.value,
        ...(token.value ? { token: token.value } : {}),
        ...(props.siteId && !token.value && !removeToken.value ? { siteId: props.siteId } : {}),
      },
    })
  }
  catch (err) {
    testError.value = errorMessage(err, 'Could not test the connection.')
  }
  finally {
    testing.value = false
  }
}

function toggleRemoveToken() {
  removeToken.value = !removeToken.value
  token.value = ''
}

function submit() {
  const input: SiteInput = {
    name: name.value.trim(),
    client: client.value.trim(),
    url: url.value.trim(),
    environment: environment.value,
    repoUrl: repoUrl.value.trim(),
    notes: notes.value,
  }
  if (removeToken.value) input.token = ''
  else if (token.value.trim()) input.token = token.value.trim()
  // An empty token on a new site: just no token.
  emit('submit', input)
}

const tokenPlaceholder = computed(() => (props.siteId && props.hasToken && !removeToken.value ? 'Stored — leave empty to keep' : 'Paste the site’s NUXT_CMS_STATUS_TOKEN'))
</script>

<template>
  <form class="flex flex-col gap-5" @submit.prevent="submit">
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <UFormField label="Name" name="name" required>
        <UInput v-model="name" required placeholder="Studio Grand" class="w-full" />
      </UFormField>
      <UFormField label="Client" name="client" hint="Optional">
        <UInput v-model="client" placeholder="Grand s.r.o." class="w-full" />
      </UFormField>
    </div>

    <div class="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_12rem]">
      <UFormField label="Address" name="url" required description="The site’s own address, e.g. https://example.com.">
        <UInput v-model="url" type="url" required placeholder="https://example.com" class="w-full font-mono" />
      </UFormField>
      <UFormField label="Environment" name="environment">
        <USelect v-model="environment" :items="environments" class="w-full" />
      </UFormField>
    </div>

    <UFormField
      label="Status token"
      name="token"
      description="The value of NUXT_CMS_STATUS_TOKEN on the site. Without it Keeper checks uptime only."
    >
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <UInput
          v-model="token"
          type="password"
          autocomplete="off"
          :placeholder="tokenPlaceholder"
          :disabled="removeToken"
          class="w-full font-mono"
        />
        <UButton
          v-if="siteId && hasToken"
          :label="removeToken ? 'Keep token' : 'Remove token'"
          :icon="removeToken ? 'i-lucide-undo-2' : 'i-lucide-trash-2'"
          color="neutral"
          variant="ghost"
          class="shrink-0"
          @click="toggleRemoveToken"
        />
      </div>
      <p v-if="removeToken" class="mt-1.5 text-sm text-warning">The token is removed when you save.</p>
    </UFormField>

    <!-- Test the address (and token) before saving. -->
    <div class="k-moment p-4">
      <div class="flex flex-wrap items-center gap-3">
        <UButton
          label="Test connection"
          icon="i-lucide-plug-zap"
          color="neutral"
          variant="outline"
          :loading="testing"
          :disabled="!url"
          @click="runTest"
        />
        <p v-if="!test && !testError" class="text-sm text-muted">Checks the address and reads the status with the token.</p>
      </div>
      <p v-if="testError" class="mt-3 text-sm text-error">{{ testError }}</p>
      <ul v-if="test" class="mt-3 flex flex-col gap-1.5 text-sm">
        <li class="flex items-start gap-2">
          <UIcon :name="test.reachable ? 'i-lucide-circle-check' : 'i-lucide-circle-x'" :class="test.reachable ? 'text-success' : 'text-error'" class="mt-0.5 size-4 shrink-0" />
          <span>
            <span class="text-highlighted">{{ test.reachable ? 'Reachable' : 'Not reachable' }}</span>
            <span v-if="test.responseMs != null" class="text-muted tabular"> · {{ test.responseMs }} ms</span>
            <span class="text-muted"> · {{ test.ready }}</span>
          </span>
        </li>
        <li v-if="test.status" class="flex items-start gap-2">
          <UIcon :name="test.status.ok ? 'i-lucide-circle-check' : 'i-lucide-circle-x'" :class="test.status.ok ? 'text-success' : 'text-error'" class="mt-0.5 size-4 shrink-0" />
          <span v-if="test.status.ok" class="text-highlighted">Status read: tinyzoo <span class="font-mono">{{ test.status.version }}</span></span>
          <span v-else><span class="text-highlighted">Status not read:</span> <span class="text-muted">{{ test.status.error }}</span></span>
        </li>
        <li v-else class="flex items-start gap-2 text-muted">
          <UIcon name="i-lucide-info" class="mt-0.5 size-4 shrink-0" />
          No token, so only uptime is checked.
        </li>
      </ul>
    </div>

    <UFormField label="Repository" name="repoUrl" hint="Optional">
      <UInput v-model="repoUrl" type="url" placeholder="https://github.com/…" class="w-full font-mono" />
    </UFormField>
    <UFormField label="Notes" name="notes" hint="Optional">
      <UTextarea v-model="notes" :rows="3" autoresize placeholder="Hosting, contacts, anything worth remembering" class="w-full" />
    </UFormField>

    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
      <slot name="secondary" />
      <UButton type="submit" :label="submitLabel" :loading="busy" size="lg" class="justify-center sm:ml-auto" />
    </div>
  </form>
</template>
