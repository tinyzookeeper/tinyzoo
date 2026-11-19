<script setup lang="ts">
import type { AccessToken, Member, NewAccessToken, WorkspaceSettings } from '#keeper/types/keeper'

useHead({ title: 'Settings · Keeper' })
const toast = useToast()
const { me, isOwner, refresh: refreshSession } = useKeeperUser()
const now = useNow()

// ── Workspace ──────────────────────────────────────────────────────────────
const { data: workspace, refresh: refreshWorkspace } = await useFetch<WorkspaceSettings>('/api/workspace', { key: 'workspace' })
const ws = reactive({ name: '', alertEmails: '' })
watch(workspace, (w) => {
  if (!w) return
  ws.name = w.name
  ws.alertEmails = w.alertEmails.join(', ')
}, { immediate: true })

const savingWs = ref(false)
async function saveWorkspace() {
  savingWs.value = true
  try {
    const alertEmails = ws.alertEmails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean)
    await $fetch('/api/workspace', { method: 'PATCH', body: { name: ws.name.trim(), alertEmails } })
    await Promise.all([refreshWorkspace(), refreshSession()])
    toast.add({ title: 'Saved', color: 'success', icon: 'i-lucide-check' })
  }
  catch (err) {
    toast.add({ title: 'Could not save', description: errorMessage(err), color: 'error' })
  }
  finally {
    savingWs.value = false
  }
}

// ── Team ───────────────────────────────────────────────────────────────────
const { data: team, refresh: refreshTeam } = await useFetch<Member[]>('/api/team', { key: 'team', default: () => [] })

const addOpen = ref(false)
const adding = ref(false)
const newPerson = reactive({ name: '', email: '' })
const added = ref<{ member: Member; password: string | null } | null>(null)
const copied = ref(false)

function closeAdd() { addOpen.value = false }
function openAdd() {
  newPerson.name = ''
  newPerson.email = ''
  added.value = null
  copied.value = false
  addOpen.value = true
}
async function addPerson() {
  adding.value = true
  try {
    added.value = await $fetch<{ member: Member; password: string | null }>('/api/team', { method: 'POST', body: { name: newPerson.name.trim(), email: newPerson.email.trim() } })
    await refreshTeam()
  }
  catch (err) {
    toast.add({ title: 'Could not add them', description: errorMessage(err), color: 'error' })
  }
  finally {
    adding.value = false
  }
}
async function copyPassword() {
  if (!added.value?.password) return
  try {
    await navigator.clipboard.writeText(added.value.password)
    copied.value = true
  }
  catch {
    toast.add({ title: 'Could not copy: select the password and copy it by hand.', color: 'warning' })
  }
}

const removing = ref<Member | null>(null)
function askRemove(m: Member) { removing.value = m }
function cancelRemove() { removing.value = null }
const removeBusy = ref(false)
const removeOpen = computed({ get: () => !!removing.value, set: (v: boolean) => { if (!v) removing.value = null } })
async function removePerson() {
  if (!removing.value) return
  removeBusy.value = true
  try {
    await $fetch(`/api/team/${removing.value.id}`, { method: 'DELETE' })
    toast.add({ title: `${removing.value.name || removing.value.email} removed`, color: 'success' })
    removing.value = null
    await refreshTeam()
  }
  catch (err) {
    toast.add({ title: 'Could not remove them', description: errorMessage(err), color: 'error' })
  }
  finally {
    removeBusy.value = false
  }
}

// ── Access tokens ──────────────────────────────────────────────────────────
const { data: tokens, refresh: refreshTokens } = await useFetch<AccessToken[]>('/api/tokens', { key: 'tokens', default: () => [] })
const mcpUrl = `${useRequestURL().origin}/mcp`

const scopes = [
  { value: 'read', label: 'Read', description: 'Sees sites, versions, checks and incidents.' },
  { value: 'write', label: 'Read and write', description: 'Can also add, change, check and remove sites.' },
]
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

// ── My password ────────────────────────────────────────────────────────────
const pw = reactive({ current: '', next: '' })
const savingPw = ref(false)
async function changePassword() {
  savingPw.value = true
  try {
    await $fetch('/api/auth/password', { method: 'POST', body: { current: pw.current, next: pw.next } })
    pw.current = ''
    pw.next = ''
    toast.add({ title: 'Password changed', color: 'success', icon: 'i-lucide-check' })
  }
  catch (err) {
    toast.add({ title: 'Could not change the password', description: errorMessage(err), color: 'error' })
  }
  finally {
    savingPw.value = false
  }
}
</script>

<template>
  <AppPage title="Settings" description="Your team, who hears about outages, access tokens and your password.">
    <div class="flex max-w-3xl flex-col gap-6">
      <!-- Workspace -->
      <InfoCard title="Team and alerts">
        <form v-if="isOwner" class="flex flex-col gap-4" @submit.prevent="saveWorkspace">
          <UFormField label="Team name" name="name">
            <UInput v-model="ws.name" required class="w-full" />
          </UFormField>
          <UFormField
            label="Alert e-mails"
            name="alertEmails"
            description="Who hears when a site goes down, comes back, or its certificate is about to expire. Separate with commas. Empty: everyone on the team."
          >
            <UTextarea v-model="ws.alertEmails" :rows="2" autoresize placeholder="ops@example.com, ada@example.com" class="w-full font-mono" />
          </UFormField>
          <div class="flex justify-end">
            <UButton type="submit" label="Save" :loading="savingWs" />
          </div>
        </form>
        <dl v-else-if="workspace" class="flex flex-col gap-3 text-sm">
          <div>
            <dt class="text-muted">Team name</dt>
            <dd class="text-highlighted">{{ workspace.name }}</dd>
          </div>
          <div>
            <dt class="text-muted">Alert e-mails</dt>
            <dd class="font-mono text-xs text-highlighted">{{ workspace.alertEmails.length ? workspace.alertEmails.join(', ') : 'everyone on the team' }}</dd>
          </div>
          <p class="text-xs text-muted">Only an owner can change these.</p>
        </dl>
      </InfoCard>

      <!-- Team -->
      <InfoCard title="People">
        <template #aside>
          <UButton v-if="isOwner" label="Add person" icon="i-lucide-user-plus" color="neutral" variant="outline" size="sm" @click="openAdd" />
        </template>
        <ul class="divide-y divide-default">
          <li v-for="m in team" :key="m.id" class="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <UAvatar :alt="m.name || m.email" size="sm" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm text-highlighted">
                {{ m.name || m.email }}
                <span v-if="m.id === me?.id" class="text-muted">(you)</span>
              </p>
              <p class="truncate text-xs text-muted">
                {{ m.email }} · {{ m.lastLoginAt ? `signed in ${timeAgo(m.lastLoginAt, now)}` : 'not signed in yet' }}
              </p>
            </div>
            <UBadge :label="m.role" :color="m.role === 'owner' ? 'primary' : 'neutral'" variant="subtle" size="sm" />
            <UButton
              v-if="isOwner && m.id !== me?.id"
              icon="i-lucide-user-minus"
              color="neutral"
              variant="ghost"
              size="sm"
              square
              :aria-label="`Remove ${m.name || m.email}`"
              @click="askRemove(m)"
            />
          </li>
        </ul>
      </InfoCard>

      <!-- Access tokens -->
      <InfoCard title="Access tokens">
        <template #aside>
          <UButton label="New token" icon="i-lucide-key-round" color="neutral" variant="outline" size="sm" @click="openToken" />
        </template>
        <div class="flex flex-col gap-4">
          <p class="text-sm text-pretty text-toned">
            For scripts and tools that work with Keeper: the API, and the MCP server at the address below.
            A program that can sign in needs only the address; others take a token made here.
            Either acts as the person who connected it.
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
                  <template v-if="t.createdBy"> · by {{ t.createdBy }}</template>
                </p>
              </div>
              <UButton
                v-if="t.canRevoke"
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

      <!-- My password -->
      <InfoCard title="Your password">
        <form class="grid grid-cols-1 gap-4 sm:grid-cols-2" @submit.prevent="changePassword">
          <UFormField label="Current password" name="current">
            <UInput v-model="pw.current" type="password" autocomplete="current-password" required class="w-full" />
          </UFormField>
          <UFormField label="New password" name="next" hint="At least 10 characters">
            <UInput v-model="pw.next" type="password" autocomplete="new-password" required minlength="10" class="w-full" />
          </UFormField>
          <div class="flex justify-end sm:col-span-2">
            <UButton type="submit" label="Change password" color="neutral" variant="outline" :loading="savingPw" />
          </div>
        </form>
      </InfoCard>
    </div>

    <!-- Add a person; their password is shown once. -->
    <UModal v-model:open="addOpen" :title="added ? 'Added' : 'Add a person'" :dismissible="!added || copied || !added.password">
      <template #body>
        <form v-if="!added" id="add-person" class="flex flex-col gap-4" @submit.prevent="addPerson">
          <UFormField label="Name" name="name">
            <UInput v-model="newPerson.name" required autofocus class="w-full" />
          </UFormField>
          <UFormField label="Email" name="email">
            <UInput v-model="newPerson.email" type="email" required class="w-full" />
          </UFormField>
        </form>
        <div v-else-if="added.password" class="flex flex-col gap-3">
          <p class="text-sm text-toned">
            Give {{ added.member.name || added.member.email }} this password. It is shown only now; they can change it in Settings.
          </p>
          <div class="flex items-center gap-2 rounded-lg bg-elevated p-3">
            <code class="flex-1 select-all break-all font-mono text-sm text-highlighted">{{ added.password }}</code>
            <UButton :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" :label="copied ? 'Copied' : 'Copy'" color="neutral" variant="outline" size="sm" @click="copyPassword" />
          </div>
        </div>
        <p v-else class="text-sm text-toned">
          {{ added.member.name || added.member.email }} already has a Keeper account. They can sign in with their existing password.
        </p>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <template v-if="!added">
            <UButton label="Cancel" color="neutral" variant="ghost" @click="closeAdd" />
            <UButton type="submit" form="add-person" label="Add" :loading="adding" />
          </template>
          <UButton v-else label="Done" @click="closeAdd" />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="removeOpen"
      :title="`Remove ${removing?.name || removing?.email || 'them'}?`"
      description="They lose access to Keeper straight away. Their sites stay."
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton label="Cancel" color="neutral" variant="ghost" @click="cancelRemove" />
          <UButton label="Remove" color="error" :loading="removeBusy" @click="removePerson" />
        </div>
      </template>
    </UModal>
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
  </AppPage>
</template>
