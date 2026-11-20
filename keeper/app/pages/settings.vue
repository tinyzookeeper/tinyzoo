<script setup lang="ts">
import type { AccessToken, Client, ClientList, Invitation, InviteOutcome, KeeperAbout, MailStatus, Member, MemberRole, NewAccessToken, WorkspaceSettings } from '#keeper/types/keeper'

useHead({ title: 'Settings · Keeper' })
const toast = useToast()
const { me, isOwner, isManager, canWrite, refresh: refreshSession } = useKeeperUser()
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

// ── Clients ────────────────────────────────────────────────────────────────
const { data: clientList, refresh: refreshClients } = await useFetch<ClientList>('/api/clients', { key: 'clients', default: () => ({ clients: [], canCreate: false }) })
const clients = computed(() => clientList.value.clients)
const clientName = (id: string) => clients.value.find((c) => c.id === id)?.name ?? 'A removed client'
const splitEmails = (v: string) => v.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean)

// One dialog adds a client (`editingClient` null) or changes one.
const clientOpen = ref(false)
const clientBusy = ref(false)
const editingClient = ref<Client | null>(null)
const clientForm = reactive({ name: '', alertEmails: '' })
function openClient(c: Client | null) {
  editingClient.value = c
  clientForm.name = c?.name ?? ''
  clientForm.alertEmails = (c?.alertEmails ?? []).join(', ')
  clientOpen.value = true
}
function closeClient() { clientOpen.value = false }
async function saveClient() {
  clientBusy.value = true
  try {
    const body = { name: clientForm.name.trim(), alertEmails: splitEmails(clientForm.alertEmails) }
    if (editingClient.value) await $fetch(`/api/clients/${editingClient.value.id}`, { method: 'PATCH', body })
    else await $fetch('/api/clients', { method: 'POST', body })
    clientOpen.value = false
    await Promise.all([refreshClients(), refreshNuxtData('overview')])
  }
  catch (err) {
    toast.add({ title: 'Could not save the client', description: errorMessage(err), color: 'error' })
  }
  finally {
    clientBusy.value = false
  }
}

const removingClient = ref<Client | null>(null)
const removeClientBusy = ref(false)
const removeClientOpen = computed({ get: () => !!removingClient.value, set: (v: boolean) => { if (!v) removingClient.value = null } })
function askRemoveClient(c: Client) { removingClient.value = c }
function cancelRemoveClient() { removingClient.value = null }
async function removeClient() {
  if (!removingClient.value) return
  removeClientBusy.value = true
  try {
    await $fetch(`/api/clients/${removingClient.value.id}`, { method: 'DELETE' })
    toast.add({ title: `${removingClient.value.name} removed`, color: 'success' })
    removingClient.value = null
    await Promise.all([refreshClients(), refreshTeam(), refreshInvitations(), refreshNuxtData('overview')])
  }
  catch (err) {
    toast.add({ title: 'Could not remove the client', description: errorMessage(err), color: 'error' })
  }
  finally {
    removeClientBusy.value = false
  }
}

// ── Roles and client access (adding and changing a person) ────────────────
const ROLE_HELP: Record<MemberRole, string> = {
  owner: 'Everything, including making and removing owners.',
  admin: 'The team, clients and settings, and every site.',
  member: 'Adds, changes, checks and removes sites.',
  viewer: 'Only looks: status, uptime, versions. For a client’s own people.',
}
const roleItems = computed(() => (['owner', 'admin', 'member', 'viewer'] as const)
  .filter((r) => r !== 'owner' || isOwner.value)
  .map((r) => ({ value: r, label: ROLE_LABELS[r], description: ROLE_HELP[r] })))
const accessItems: { value: 'all' | 'some'; label: string; description: string }[] = [
  { value: 'all', label: 'Every client', description: 'All sites, also those without a client.' },
  { value: 'some', label: 'Only some clients', description: 'Just the sites of the clients picked below.' },
]
const access = reactive({ role: 'member' as MemberRole, scope: 'all' as 'all' | 'some', clientIds: [] as string[] })
const clientOptions = computed(() => clients.value.map((c) => ({ label: c.name, value: c.id })))
const seesEverything = computed(() => access.role === 'owner' || access.role === 'admin')
function resetAccess(m?: Member) {
  access.role = m?.role ?? 'member'
  access.scope = !m || m.allClients ? 'all' : 'some'
  access.clientIds = [...(m?.clientIds ?? [])]
}
const accessBody = () => ({ role: access.role, allClients: seesEverything.value || access.scope === 'all', clientIds: access.scope === 'some' ? access.clientIds : [] })
const accessInvalid = computed(() => !seesEverything.value && access.scope === 'some' && !access.clientIds.length)
function accessLine(m: Pick<Member, 'allClients' | 'clientIds'>): string {
  if (m.allClients) return 'Every client'
  if (!m.clientIds.length) return 'No clients yet'
  return m.clientIds.map(clientName).join(', ')
}
/** Whether I may change or remove this person: not myself, and an admin leaves owners alone. */
const mayManage = (m: Member) => isManager.value && m.id !== me.value?.id && (isOwner.value || m.role !== 'owner')

const editing = ref<Member | null>(null)
const editBusy = ref(false)
const editOpen = computed({ get: () => !!editing.value, set: (v: boolean) => { if (!v) editing.value = null } })
function openEdit(m: Member) {
  resetAccess(m)
  editing.value = m
}
function closeEdit() { editing.value = null }
async function saveEdit() {
  if (!editing.value) return
  editBusy.value = true
  try {
    await $fetch(`/api/team/${editing.value.id}`, { method: 'PATCH', body: accessBody() })
    toast.add({ title: `${editing.value.name || editing.value.email} updated`, color: 'success', icon: 'i-lucide-check' })
    editing.value = null
    await refreshTeam()
  }
  catch (err) {
    toast.add({ title: 'Could not change their access', description: errorMessage(err), color: 'error' })
  }
  finally {
    editBusy.value = false
  }
}

// ── Team ───────────────────────────────────────────────────────────────────
const { data: team, refresh: refreshTeam } = await useFetch<Member[]>('/api/team', { key: 'team', default: () => [] })
// Owners and admins only: the open invitations and how e-mail is sent.
const requestFetch = useRequestFetch()
const { data: invitations, refresh: refreshInvitations } = await useAsyncData('invitations', () => (isManager.value ? requestFetch<Invitation[]>('/api/team/invitations') : Promise.resolve([] as Invitation[])), { default: () => [] as Invitation[] })
const { data: mail } = await useAsyncData('mail', () => (isManager.value ? requestFetch<MailStatus>('/api/mail') : Promise.resolve(null)), { default: () => null })

// Invite: addresses, a role and the clients they see. The result lists each address; a link
// shows when the e-mail did not go out (mail only logged, or it failed), to pass on by hand.
const inviteOpen = ref(false)
const inviteBusy = ref(false)
const inviteEmails = ref<string[]>([])
const outcomes = ref<InviteOutcome[] | null>(null)
const copiedLink = ref('')
const EMAIL_DELIMITER = /[\s,;]+/
function openInvite() {
  inviteEmails.value = []
  resetAccess()
  outcomes.value = null
  copiedLink.value = ''
  inviteOpen.value = true
}
function closeInvite() { inviteOpen.value = false }
async function sendInvites() {
  inviteBusy.value = true
  try {
    const emails = inviteEmails.value.flatMap((e) => e.split(EMAIL_DELIMITER)).map((e) => e.trim()).filter(Boolean)
    if (!emails.length) {
      toast.add({ title: 'Add at least one e-mail address', color: 'warning' })
      return
    }
    const res = await $fetch<{ outcomes: InviteOutcome[] }>('/api/team/invitations', { method: 'POST', body: { emails, ...accessBody() } })
    outcomes.value = res.outcomes
    await refreshInvitations()
  }
  catch (err) {
    toast.add({ title: 'Could not invite them', description: errorMessage(err), color: 'error' })
  }
  finally {
    inviteBusy.value = false
  }
}
async function copyLink(link: string) {
  try {
    await navigator.clipboard.writeText(link)
    copiedLink.value = link
  }
  catch {
    toast.add({ title: 'Could not copy: select the link and copy it by hand.', color: 'warning' })
  }
}
function outcomeLine(o: InviteOutcome): string {
  if (!o.ok) return o.error ?? 'Not invited'
  if (o.mail === 'sent') return 'E-mail sent'
  if (o.mail === 'failed') return 'The e-mail could not be sent. Pass on this link:'
  return 'Pass on this link:'
}
const inviteTitle = computed(() => {
  if (!outcomes.value) return `Invite to ${me.value?.workspaceName ?? 'the team'}`
  const n = outcomes.value.filter((o) => o.ok).length
  return n ? (n === 1 ? 'Invitation ready' : `${n} invitations ready`) : 'Nobody was invited'
})
// While e-mail is only logged, links are shown to copy.
const mailOff = computed(() => mail.value?.transport === 'log')

const inviteBusyId = ref('')
async function resendInvite(inv: Invitation) {
  inviteBusyId.value = inv.id
  try {
    const o = await $fetch<InviteOutcome>(`/api/team/invitations/${inv.id}`, { method: 'POST' })
    await refreshInvitations()
    if (o.link) {
      outcomes.value = [o]
      copiedLink.value = ''
      inviteOpen.value = true
    }
    else toast.add({ title: `Sent to ${inv.email} again`, color: 'success', icon: 'i-lucide-check' })
  }
  catch (err) {
    toast.add({ title: 'Could not send it again', description: errorMessage(err), color: 'error' })
  }
  finally {
    inviteBusyId.value = ''
  }
}
async function cancelInvite(inv: Invitation) {
  inviteBusyId.value = inv.id
  try {
    await $fetch(`/api/team/invitations/${inv.id}`, { method: 'DELETE' })
    await refreshInvitations()
    toast.add({ title: `Invitation for ${inv.email} taken back`, color: 'success' })
  }
  catch (err) {
    toast.add({ title: 'Could not take it back', description: errorMessage(err), color: 'error' })
  }
  finally {
    inviteBusyId.value = ''
  }
}
function invitationLine(inv: Invitation): string {
  const by = inv.invitedBy ? ` · by ${inv.invitedBy}` : ''
  if (inv.expired) return `The link has expired${by}`
  const days = Math.max(1, Math.ceil((new Date(inv.expiresAt).getTime() - now.value) / 86_400_000))
  return `Link works ${days === 1 ? '1 more day' : `${days} more days`}${by}`
}

// A test e-mail to myself, to see the SMTP settings work.
const testBusy = ref(false)
async function sendTestMail() {
  testBusy.value = true
  try {
    const r = await $fetch<{ status: string; to: string }>('/api/mail/test', { method: 'POST' })
    toast.add(r.status === 'sent'
      ? { title: `Sent to ${r.to}`, description: 'Check the inbox (and the spam folder).', color: 'success', icon: 'i-lucide-check' }
      : { title: 'Written to the server log', description: 'E-mail is not sent while NUXT_MAIL_TRANSPORT is log.', color: 'neutral' })
  }
  catch (err) {
    toast.add({ title: 'The test e-mail failed', description: errorMessage(err), color: 'error' })
  }
  finally {
    testBusy.value = false
  }
}
const mailLine = computed(() => {
  const m = mail.value
  if (!m) return ''
  if (m.transport === 'log') return 'Not sent yet: e-mails are only written to the server log, and invitations show their link to pass on. Set NUXT_MAIL_TRANSPORT=smtp and the SMTP settings to send them.'
  if (!m.ready) return 'SMTP is on, but the host or the sender is missing (NUXT_MAIL_SMTP_HOST, NUXT_MAIL_FROM).'
  const sec = m.security === 'tls' ? 'TLS' : m.security === 'starttls' ? 'STARTTLS' : 'STARTTLS when offered'
  return `Sent through ${m.host}:${m.port} (${sec}) from ${m.from}.`
})

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

// A viewer's tokens only read.
const scopes = computed(() => [
  { value: 'read', label: 'Read', description: 'Sees sites, versions, checks and incidents.' },
  ...(canWrite.value ? [{ value: 'write', label: 'Read and write', description: 'Can also add, change, check and remove sites.' }] : []),
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

// ── About ──────────────────────────────────────────────────────────────────
// Keeper's own version comes with the build; the newest tinyzoo release from the database.
const build = useRuntimeConfig().public.keeper as { version: string; builtAt: string }
const { data: about } = await useFetch<KeeperAbout>('/api/about', { key: 'about', default: () => ({ tinyzoo: null }) })

// "About Keeper" in the user menu opens /settings#about. The page scrolls inside its panel,
// not the window, so the router cannot jump there by itself. Scroll that panel only:
// scrollIntoView would also shift the dashboard's own frame and push the sidebar away.
const route = useRoute()
function showHash() {
  if (!route.hash) return
  nextTick(() => {
    const el = document.getElementById(route.hash.slice(1))
    let box = el?.parentElement
    while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement
    if (el && box) box.scrollTo({ top: el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 24 })
  })
}
onMounted(showHash)
watch(() => route.hash, showHash)

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
  <AppPage title="Settings" description="Your team and who you invite, your clients, who hears about outages, access tokens, your password and which Keeper this is.">
    <div class="flex max-w-3xl flex-col gap-6">
      <!-- Workspace -->
      <InfoCard title="Team and alerts">
        <form v-if="isManager" class="flex flex-col gap-4" @submit.prevent="saveWorkspace">
          <UFormField label="Team name" name="name">
            <UInput v-model="ws.name" required class="w-full" />
          </UFormField>
          <UFormField
            label="Alert e-mails"
            name="alertEmails"
            description="Who hears when a site goes down, comes back, or its certificate is about to expire. Separate with commas. Empty: everyone on the team who works on that site. A client can add its own addresses."
          >
            <UTextarea v-model="ws.alertEmails" :rows="2" autoresize placeholder="ops@example.com, ada@example.com" class="w-full font-mono" />
          </UFormField>
          <div class="flex justify-end">
            <UButton type="submit" label="Save" :loading="savingWs" />
          </div>
          <div v-if="mail" class="flex flex-col gap-2 border-t border-default pt-4 sm:flex-row sm:items-start sm:gap-4">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-highlighted">E-mail</p>
              <p class="text-sm text-pretty text-muted">{{ mailLine }}</p>
            </div>
            <UButton label="Send a test e-mail" icon="i-lucide-send" color="neutral" variant="outline" size="sm" class="self-start" :loading="testBusy" @click="sendTestMail" />
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
          <p class="text-xs text-muted">Only an owner or admin can change these.</p>
        </dl>
      </InfoCard>

      <!-- Clients -->
      <InfoCard v-if="isManager" title="Clients">
        <template #aside>
          <UButton label="Add client" icon="i-lucide-folder-plus" color="neutral" variant="outline" size="sm" @click="openClient(null)" />
        </template>
        <p class="mb-3 text-sm text-pretty text-toned">
          Whose sites they are. Filter the sites by client, and give people access to only some clients.
        </p>
        <ul v-if="clients.length" class="divide-y divide-default border-t border-default">
          <li v-for="c in clients" :key="c.id" class="flex items-center gap-3 py-2.5 last:pb-0">
            <div class="min-w-0 flex-1">
              <NuxtLink :to="{ path: '/', query: { client: c.id } }" class="truncate text-sm font-medium text-highlighted hover:underline">{{ c.name }}</NuxtLink>
              <p class="truncate text-xs text-muted">
                {{ c.sites === 1 ? '1 site' : `${c.sites} sites` }}
                <template v-if="c.alertEmails.length"> · alerts also to <span class="font-mono">{{ c.alertEmails.join(', ') }}</span></template>
              </p>
            </div>
            <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="sm" square :aria-label="`Change ${c.name}`" @click="openClient(c)" />
            <UButton icon="i-lucide-trash-2" color="neutral" variant="ghost" size="sm" square :aria-label="`Remove ${c.name}`" @click="askRemoveClient(c)" />
          </li>
        </ul>
        <p v-else class="border-t border-default pt-3 text-sm text-muted">No clients yet. Name one here, or on a site.</p>
      </InfoCard>

      <!-- Team -->
      <InfoCard title="People">
        <template #aside>
          <UButton v-if="isManager" label="Invite" icon="i-lucide-user-plus" color="neutral" variant="outline" size="sm" @click="openInvite" />
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
              <p v-if="m.role !== 'owner' && m.role !== 'admin'" class="truncate text-xs text-muted">{{ accessLine(m) }}</p>
            </div>
            <UBadge :label="ROLE_LABELS[m.role]" :color="m.role === 'owner' || m.role === 'admin' ? 'primary' : 'neutral'" variant="subtle" size="sm" />
            <UButton
              v-if="mayManage(m)"
              icon="i-lucide-user-cog"
              color="neutral"
              variant="ghost"
              size="sm"
              square
              :aria-label="`Change access of ${m.name || m.email}`"
              @click="openEdit(m)"
            />
            <UButton
              v-if="mayManage(m)"
              icon="i-lucide-user-minus"
              color="neutral"
              variant="ghost"
              size="sm"
              square
              :aria-label="`Remove ${m.name || m.email}`"
              @click="askRemove(m)"
            />
          </li>
          <li v-for="inv in invitations" :key="inv.id" class="flex items-center gap-3 py-2.5 last:pb-0">
            <span class="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-(--k-moment-bg) text-(--k-moment-text)">
              <UIcon name="i-lucide-mail" class="size-4" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm text-highlighted">{{ inv.email }}</p>
              <p class="truncate text-xs" :class="inv.expired ? 'text-warning' : 'text-muted'">{{ invitationLine(inv) }}</p>
              <p v-if="inv.role !== 'owner' && inv.role !== 'admin'" class="truncate text-xs text-muted">{{ accessLine(inv) }}</p>
            </div>
            <UBadge :label="ROLE_LABELS[inv.role]" color="neutral" variant="outline" size="sm" class="hidden sm:inline-flex" />
            <UBadge :label="inv.expired ? 'Expired' : 'Invited'" :color="inv.expired ? 'warning' : 'neutral'" variant="subtle" size="sm" />
            <UButton
              icon="i-lucide-send"
              color="neutral"
              variant="ghost"
              size="sm"
              square
              :loading="inviteBusyId === inv.id"
              :aria-label="`Send the invitation to ${inv.email} again`"
              @click="resendInvite(inv)"
            />
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              square
              :disabled="inviteBusyId === inv.id"
              :aria-label="`Take back the invitation to ${inv.email}`"
              @click="cancelInvite(inv)"
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

      <!-- About: which Keeper this is (the user menu links here) -->
      <InfoCard id="about" title="About Keeper">
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-3">
            <KMark class="h-11" />
            <div class="min-w-0">
              <p class="k-display text-xl text-highlighted tabular-nums">Keeper {{ build.version }}</p>
              <p class="text-xs text-muted">Built {{ formatDateTime(build.builtAt) }}</p>
            </div>
          </div>
          <dl class="flex flex-col gap-3 border-t border-default pt-3 text-sm">
            <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
              <dt class="text-muted">Newest tinyzoo</dt>
              <dd v-if="about.tinyzoo" class="text-right text-highlighted">
                <span class="tabular-nums">{{ about.tinyzoo.version }}</span>
                <span class="text-xs text-muted"> · from npm {{ timeAgo(about.tinyzoo.checkedAt, now) }}</span>
              </dd>
              <dd v-else class="text-muted">Not read from npm yet</dd>
            </div>
          </dl>
          <p class="border-t border-default pt-3">
            <KBrand signature />
            <span class="sr-only">Keeper, part of tinyzoo</span>
          </p>
        </div>
      </InfoCard>
    </div>

    <!-- Invite people; when e-mail is not sent, each link is shown to pass on. -->
    <UModal v-model:open="inviteOpen" :title="inviteTitle" :description="outcomes ? undefined : 'They get an e-mail with a link to join.'">
      <template #body>
        <form v-if="!outcomes" id="invite" class="flex flex-col gap-4" @submit.prevent="sendInvites">
          <UFormField label="E-mail" name="emails" description="Press Enter after each address, or paste several.">
            <UInputTags
              v-model="inviteEmails"
              :delimiter="EMAIL_DELIMITER"
              add-on-paste
              add-on-blur
              add-on-tab
              :max="20"
              placeholder="eva@example.com"
              autofocus
              class="w-full"
            />
          </UFormField>
          <MemberAccessFields v-model:role="access.role" v-model:scope="access.scope" v-model:client-ids="access.clientIds" :roles="roleItems" :scopes="accessItems" :clients="clientOptions" />
          <div v-if="mailOff" class="flex gap-2.5 rounded-lg border border-(--k-moment-line) bg-(--k-moment-bg) p-3 text-sm text-pretty text-(--k-moment-text)">
            <UIcon name="i-lucide-mail-question" class="mt-0.5 size-4 shrink-0" />
            <span>E-mail isn’t set up on this Keeper yet, so you’ll get each link to pass on yourself.</span>
          </div>
        </form>
        <ul v-else class="flex flex-col gap-3">
          <li v-for="o in outcomes" :key="o.email" class="flex flex-col gap-1.5">
            <p class="flex min-w-0 items-center gap-2 text-sm">
              <UIcon :name="!o.ok ? 'i-lucide-circle-minus' : o.mail === 'sent' ? 'i-lucide-circle-check' : 'i-lucide-link'" class="size-4 shrink-0" :class="!o.ok ? 'text-muted' : o.mail === 'failed' ? 'text-warning' : 'text-success'" />
              <span class="truncate font-medium text-highlighted">{{ o.email }}</span>
            </p>
            <p class="pl-6 text-xs text-muted">{{ outcomeLine(o) }}</p>
            <div v-if="o.link" class="ml-6 flex min-w-0 items-center gap-2 rounded-lg bg-elevated py-1.5 pr-1.5 pl-3">
              <code class="min-w-0 flex-1 truncate font-mono text-xs text-highlighted select-all">{{ o.link }}</code>
              <UButton
                :icon="copiedLink === o.link ? 'i-lucide-check' : 'i-lucide-copy'"
                :label="copiedLink === o.link ? 'Copied' : 'Copy'"
                color="neutral"
                variant="outline"
                size="xs"
                @click="copyLink(o.link)"
              />
            </div>
          </li>
        </ul>
      </template>
      <template #footer>
        <div class="flex w-full items-center justify-end gap-2">
          <template v-if="!outcomes">
            <span class="mr-auto hidden text-xs text-muted sm:inline">The link works for 7 days.</span>
            <UButton label="Cancel" color="neutral" variant="ghost" @click="closeInvite" />
            <UButton type="submit" form="invite" :label="inviteEmails.length > 1 ? `Send ${inviteEmails.length} invites` : 'Send invite'" :loading="inviteBusy" :disabled="accessInvalid" />
          </template>
          <UButton v-else label="Done" @click="closeInvite" />
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
    <!-- Change a person's role and clients. -->
    <UModal v-model:open="editOpen" :title="`Access of ${editing?.name || editing?.email || 'them'}`" :description="editing && access.role !== editing.role ? 'A new role signs them out once.' : undefined">
      <template #body>
        <form id="edit-access" class="flex flex-col gap-4" @submit.prevent="saveEdit">
          <MemberAccessFields v-model:role="access.role" v-model:scope="access.scope" v-model:client-ids="access.clientIds" :roles="roleItems" :scopes="accessItems" :clients="clientOptions" />
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton label="Cancel" color="neutral" variant="ghost" @click="closeEdit" />
          <UButton type="submit" form="edit-access" label="Save" :loading="editBusy" :disabled="accessInvalid" />
        </div>
      </template>
    </UModal>

    <!-- Add or change a client. -->
    <UModal v-model:open="clientOpen" :title="editingClient ? `Change ${editingClient.name}` : 'Add a client'">
      <template #body>
        <form id="client-form" class="flex flex-col gap-4" @submit.prevent="saveClient">
          <UFormField label="Name" name="name">
            <UInput v-model="clientForm.name" required maxlength="120" autofocus placeholder="Grand s.r.o." class="w-full" />
          </UFormField>
          <UFormField label="Also alert" name="alertEmails" description="Addresses told about this client's sites on top of the team's, e.g. the client's own contact. Separate with commas.">
            <UTextarea v-model="clientForm.alertEmails" :rows="2" autoresize placeholder="it@client.example" class="w-full font-mono" />
          </UFormField>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton label="Cancel" color="neutral" variant="ghost" @click="closeClient" />
          <UButton type="submit" form="client-form" :label="editingClient ? 'Save' : 'Add'" :loading="clientBusy" />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="removeClientOpen"
      :title="`Remove ${removingClient?.name ?? 'this client'}?`"
      description="Its sites stay, without a client. People who see only this client no longer see them."
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton label="Cancel" color="neutral" variant="ghost" @click="cancelRemoveClient" />
          <UButton label="Remove" color="error" :loading="removeClientBusy" @click="removeClient" />
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
