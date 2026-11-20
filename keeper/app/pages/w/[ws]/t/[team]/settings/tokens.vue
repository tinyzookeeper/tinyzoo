<script setup lang="ts">
import type { AccessToken, NewAccessToken } from '#keeper/types/keeper'

// My access tokens and OAuth connections: personal, acting as me in all my workspaces.
const toast = useToast()
const now = useNow()
const { me } = useScope()
const { data: tokens, refresh: refreshTokens } = await useFetch<AccessToken[]>('/api/tokens', { key: 'tokens', default: () => [] })
const mcpUrl = `${useRequestURL().origin}/mcp`

// A guest's token only reads (and wherever its maker is a guest, a write token reads too).
const canWrite = computed(() => (me.value?.workspaces ?? []).some((w) => w.role !== 'guest'))
const scopes = computed(() => [
  { value: 'read', label: 'Read', description: 'Sees sites, versions, checks and incidents.' },
  ...(canWrite.value ? [{ value: 'write', label: 'Read and write', description: 'Can also add, change, check and remove sites, where your role allows it.' }] : []),
])
const tokenOpen = ref(false)
const tokenBusy = ref(false)
const newToken = reactive({ name: '', scope: 'read' as 'read' | 'write' })
const madeToken = ref<NewAccessToken | null>(null)
const tokenCopied = ref(false)

function openToken() {
  newToken.name = ''
  newToken.scope = 'read'
  madeToken.value = null
  tokenCopied.value = false
  tokenOpen.value = true
}
function closeToken() {
  tokenOpen.value = false
}
// The value lives only in the dialog: forget it once the dialog is closed.
watch(tokenOpen, (open) => { if (!open) madeToken.value = null })

async function makeToken() {
  tokenBusy.value = true
  try {
    madeToken.value = await $fetch<NewAccessToken>('/api/tokens', { method: 'POST', body: { name: newToken.name.trim(), scope: newToken.scope } })
    await refreshTokens()
  }
  catch (err) {
    toast.add({ title: 'Could not make the token', description: errorMessage(err), color: 'error' })
  }
  finally {
    tokenBusy.value = false
  }
}
async function copyToken() {
  if (!madeToken.value) return
  try {
    await navigator.clipboard.writeText(madeToken.value.value)
    tokenCopied.value = true
  }
  catch {
    toast.add({ title: 'Could not copy: select the token and copy it by hand.', color: 'warning' })
  }
}
const mcpCopied = ref(false)
async function copyMcpUrl() {
  try {
    await navigator.clipboard.writeText(mcpUrl)
    mcpCopied.value = true
    setTimeout(() => { mcpCopied.value = false }, 2000)
  }
  catch {
    toast.add({ title: 'Could not copy the address.', color: 'warning' })
  }
}

const revoking = ref<AccessToken | null>(null)
const revokeBusy = ref(false)
const revokeOpen = computed({ get: () => !!revoking.value, set: (v: boolean) => { if (!v) revoking.value = null } })
function askRevoke(t: AccessToken) { revoking.value = t }
function cancelRevoke() { revoking.value = null }
async function revokeToken() {
  if (!revoking.value) return
  revokeBusy.value = true
  try {
    await $fetch(`/api/tokens/${revoking.value.id}`, { method: 'DELETE' })
    toast.add({ title: `${revoking.value.name} disconnected`, color: 'success' })
    revoking.value = null
    await refreshTokens()
  }
  catch (err) {
    toast.add({ title: 'Could not revoke it', description: errorMessage(err), color: 'error' })
  }
  finally {
    revokeBusy.value = false
  }
}

</script>

<template>
  <div class="flex flex-col gap-6">
    <InfoCard title="Your tokens and connections">
      <template #aside>
        <UButton label="New token" icon="i-lucide-key-round" color="neutral" variant="outline" size="sm" @click="openToken" />
      </template>
      <div class="flex flex-col gap-4">
        <p class="text-sm text-pretty text-toned">
          For scripts and tools that work with Keeper: the API, and the MCP server at the address below.
          A program that can sign in needs only the address; others take a token made here.
          Either acts as you, in every workspace you are in.
        </p>
        <div class="flex min-w-0 items-center gap-2 rounded-lg bg-elevated py-1.5 pr-1.5 pl-3">
          <span class="shrink-0 text-xs text-muted">MCP</span>
          <code class="min-w-0 flex-1 truncate font-mono text-sm text-highlighted">{{ mcpUrl }}</code>
          <UButton
            :icon="mcpCopied ? 'i-lucide-check' : 'i-lucide-copy'"
            color="neutral"
            variant="ghost"
            size="sm"
            square
            :aria-label="mcpCopied ? 'Copied' : 'Copy the MCP address'"
            @click="copyMcpUrl"
          />
        </div>
        <ul v-if="tokens.length" class="divide-y divide-default border-t border-default">
          <li v-for="t in tokens" :key="t.id" class="flex items-center gap-3 py-2.5 last:pb-0">
            <div class="min-w-0 flex-1">
              <p class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-highlighted">
                <span class="truncate font-medium">{{ t.name }}</span>
                <UBadge :label="t.scope === 'write' ? 'Read and write' : 'Read'" :color="t.scope === 'write' ? 'primary' : 'neutral'" variant="subtle" size="sm" />
              </p>
              <p class="mt-0.5 truncate text-xs text-muted">
                <template v-if="t.origin === 'oauth'">Signed in from {{ t.client }}</template>
                <span v-else class="font-mono">{{ t.prefix }}…</span>
                · {{ t.lastUsedAt ? `used ${timeAgo(t.lastUsedAt, now)}` : 'never used' }}
              </p>
            </div>
            <UButton
              label="Revoke"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-label="`Revoke ${t.name}`"
              @click="askRevoke(t)"
            />
          </li>
        </ul>
        <p v-else class="border-t border-default pt-3 text-sm text-muted">No tokens yet.</p>
      </div>
    </InfoCard>

    <!-- A new access token; its value is shown once. -->
    <UModal v-model:open="tokenOpen" :title="madeToken ? 'Your new token' : 'New access token'" :dismissible="!madeToken || tokenCopied">
      <template #body>
        <form v-if="!madeToken" id="new-token" class="flex flex-col gap-4" @submit.prevent="makeToken">
          <UFormField label="Name" name="name" description="Where it will be used, so you can tell tokens apart.">
            <UInput v-model="newToken.name" required maxlength="80" autofocus placeholder="Laptop, deploy script…" class="w-full" />
          </UFormField>
          <UFormField label="Access" name="scope">
            <URadioGroup v-model="newToken.scope" :items="scopes" variant="card" class="w-full" />
          </UFormField>
        </form>
        <div v-else class="flex flex-col gap-3">
          <p class="text-sm text-toned">
            Copy it now: it is shown only this once. Send it as <code class="font-mono text-xs text-highlighted">Authorization: Bearer …</code>
          </p>
          <div class="flex items-center gap-2 rounded-lg bg-elevated p-3">
            <code class="min-w-0 flex-1 select-all break-all font-mono text-sm text-highlighted">{{ madeToken.value }}</code>
            <UButton :icon="tokenCopied ? 'i-lucide-check' : 'i-lucide-copy'" :label="tokenCopied ? 'Copied' : 'Copy'" color="neutral" variant="outline" size="sm" @click="copyToken" />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <template v-if="!madeToken">
            <UButton label="Cancel" color="neutral" variant="ghost" @click="closeToken" />
            <UButton type="submit" form="new-token" label="Make token" :loading="tokenBusy" />
          </template>
          <UButton v-else label="Done" @click="closeToken" />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="revokeOpen"
      :title="`Revoke ${revoking?.name ?? 'this token'}?`"
      description="Whatever uses it loses access straight away. This cannot be undone."
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton label="Cancel" color="neutral" variant="ghost" @click="cancelRevoke" />
          <UButton label="Revoke" color="error" :loading="revokeBusy" @click="revokeToken" />
        </div>
      </template>
    </UModal>
  </div>
</template>
