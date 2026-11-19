<script setup lang="ts">
import type { Member, WorkspaceSettings } from '#shared/types/keeper'

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
  <AppPage title="Settings" description="Your team, who hears about outages, and your password.">
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
  </AppPage>
</template>
