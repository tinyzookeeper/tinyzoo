<script setup lang="ts">
import type { Invitation, InviteOutcome, MailStatus, Member, WorkspaceRole } from '#keeper/types/keeper'

// The workspace's people (owners and admins): their roles and teams, invitations to send, send
// again or take back. Colleagues and the client's guests are listed apart.
const toast = useToast()
const { me: user } = useKeeperUser()
const { wsSlug, workspace, isOwner, isManager, link } = useScope()
if (!isManager.value) await navigateTo(link('/settings/general'), { replace: true })
const now = useNow()

const { data: members, refresh: refreshMembers } = await useFetch<Member[]>(() => `/api/w/${wsSlug.value}/members`, { key: `members-${wsSlug.value}`, default: () => [] })
const { data: invitations, refresh: refreshInvitations } = await useFetch<Invitation[]>(() => `/api/w/${wsSlug.value}/invitations`, { key: `invitations-${wsSlug.value}`, default: () => [] })
const { data: mail } = await useFetch<MailStatus>('/api/mail', { key: 'mail' })

const teams = computed(() => workspace.value?.teams ?? [])
const teamItems = computed(() => teams.value.map((t) => ({ label: t.name, value: t.id })))
const teamName = (id: string) => teams.value.find((t) => t.id === id)?.name ?? 'A removed team'
const colleagues = computed(() => members.value.filter((m) => m.role !== 'guest'))
const guests = computed(() => members.value.filter((m) => m.role === 'guest'))

// ── Role and teams (inviting and changing someone) ──
const roleItems = computed(() => (['owner', 'admin', 'member', 'guest'] as const)
  .filter((r) => r !== 'owner' || isOwner.value)
  .map((r) => ({ value: r, label: ROLE_LABELS[r], description: ROLE_HELP[r] })))
const access = reactive({ role: 'member' as WorkspaceRole, teamIds: [] as string[] })
const seesAll = computed(() => access.role === 'owner' || access.role === 'admin')
const accessInvalid = computed(() => access.role === 'guest' && !access.teamIds.length)
function teamsLine(m: { role: WorkspaceRole; teamIds: string[]; leadTeamIds?: string[] }): string {
  if (m.role === 'owner' || m.role === 'admin') return 'Every team'
  if (!m.teamIds.length) return 'No team yet: sees no sites'
  return m.teamIds.map((id) => `${teamName(id)}${m.leadTeamIds?.includes(id) ? ' (lead)' : ''}`).join(', ')
}
const mayManage = (m: Member) => m.id !== user.value?.id && (isOwner.value || m.role !== 'owner')

// ── Invite ──
const inviteOpen = ref(false)
const inviteBusy = ref(false)
const inviteEmails = ref<string[]>([])
const outcomes = ref<InviteOutcome[] | null>(null)
const copiedLink = ref('')
const EMAIL_DELIMITER = /[\s,;]+/
function openInvite(role: WorkspaceRole = 'member') {
  inviteEmails.value = []
  access.role = role
  access.teamIds = teams.value.length === 1 ? [teams.value[0]!.id] : []
  outcomes.value = null
  copiedLink.value = ''
  inviteOpen.value = true
}
async function sendInvites() {
  const emails = inviteEmails.value.flatMap((e) => e.split(EMAIL_DELIMITER)).map((e) => e.trim()).filter(Boolean)
  if (!emails.length) {
    toast.add({ title: 'Add at least one e-mail address', color: 'warning' })
    return
  }
  inviteBusy.value = true
  try {
    const res = await $fetch<{ outcomes: InviteOutcome[] }>(`/api/w/${wsSlug.value}/invitations`, { method: 'POST', body: { emails, role: access.role, teamIds: seesAll.value ? [] : access.teamIds } })
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
async function copyLink(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    copiedLink.value = value
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
  if (!outcomes.value) return `Invite to ${workspace.value?.name ?? 'the workspace'}`
  const n = outcomes.value.filter((o) => o.ok).length
  return n ? (n === 1 ? 'Invitation ready' : `${n} invitations ready`) : 'Nobody was invited'
})
const mailOff = computed(() => mail.value?.transport === 'log')
const guestNote = computed(() => {
  const picked = access.teamIds.map(teamName)
  const whose = picked.length ? picked.join(', ') : 'their teams'
  return `They will see whether ${whose} sites are up, their uptime and visits. They can’t change anything, and see no tokens or settings.`
})

const inviteBusyId = ref('')
async function resendInvite(inv: Invitation) {
  inviteBusyId.value = inv.id
  try {
    const o = await $fetch<InviteOutcome>(`/api/w/${wsSlug.value}/invitations/${inv.id}`, { method: 'POST' })
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
    await $fetch(`/api/w/${wsSlug.value}/invitations/${inv.id}`, { method: 'DELETE' })
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

// ── Change someone ──
const editing = ref<Member | null>(null)
const editOpen = computed({ get: () => !!editing.value, set: (v: boolean) => { if (!v) editing.value = null } })
const editBusy = ref(false)
function openEdit(m: Member) {
  access.role = m.role
  access.teamIds = [...m.teamIds]
  editing.value = m
}
async function saveEdit() {
  if (!editing.value) return
  editBusy.value = true
  try {
    await $fetch(`/api/w/${wsSlug.value}/members/${editing.value.id}`, { method: 'PATCH', body: { role: access.role, teamIds: access.teamIds } })
    toast.add({ title: `${editing.value.name || editing.value.email} updated`, color: 'success', icon: 'i-lucide-check' })
    editing.value = null
    await Promise.all([refreshMembers(), refreshMe()])
  }
  catch (err) {
    toast.add({ title: 'Could not change their access', description: errorMessage(err), color: 'error' })
  }
  finally {
    editBusy.value = false
  }
}

// ── Remove someone ──
const removing = ref<Member | null>(null)
const removeOpen = computed({ get: () => !!removing.value, set: (v: boolean) => { if (!v) removing.value = null } })
const removeBusy = ref(false)
async function removePerson() {
  if (!removing.value) return
  removeBusy.value = true
  try {
    await $fetch(`/api/w/${wsSlug.value}/members/${removing.value.id}`, { method: 'DELETE' })
    toast.add({ title: `${removing.value.name || removing.value.email} removed`, color: 'success' })
    removing.value = null
    await refreshMembers()
  }
  catch (err) {
    toast.add({ title: 'Could not remove them', description: errorMessage(err), color: 'error' })
  }
  finally {
    removeBusy.value = false
  }
}
const initials = (text: string) => text.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-center gap-3">
      <p class="min-w-0 flex-1 text-sm text-pretty text-toned">Who is in {{ workspace?.name }}. Your colleagues work on the sites; the client’s people come in as guests and only look.</p>
      <div class="flex gap-2">
        <UButton label="Invite a guest" icon="i-lucide-eye" color="neutral" variant="ghost" size="sm" @click="openInvite('guest')" />
        <UButton label="Invite" icon="i-lucide-user-plus" color="neutral" variant="outline" size="sm" @click="openInvite()" />
      </div>
    </div>

    <template v-for="group in [{ label: 'Members', list: colleagues }, { label: 'Guests', list: guests }]" :key="group.label">
      <InfoCard v-if="group.list.length || group.label === 'Members'" :title="group.label" :padded="false">
        <ul class="divide-y divide-(--ui-border-muted)">
          <li v-for="m in group.list" :key="m.id" class="flex items-center gap-3 px-4 py-3">
            <span class="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold" :class="m.role === 'guest' ? 'bg-(--k-moment-bg) text-highlighted' : 'bg-inverted text-inverted'">{{ initials(m.name || m.email) }}</span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm text-highlighted">{{ m.name || m.email }} <span v-if="m.id === user?.id" class="text-muted">(you)</span></p>
              <p class="truncate text-xs text-muted">{{ m.email }} · {{ m.lastLoginAt ? `signed in ${timeAgo(m.lastLoginAt, now)}` : 'not signed in yet' }}</p>
              <p v-if="teams.length > 1 || !m.teamIds.length" class="truncate text-xs text-muted">{{ teamsLine(m) }}</p>
            </div>
            <UBadge :label="ROLE_LABELS[m.role]" :color="m.role === 'owner' || m.role === 'admin' ? 'primary' : 'neutral'" variant="subtle" size="sm" />
            <UButton v-if="mayManage(m)" icon="i-lucide-user-cog" color="neutral" variant="ghost" size="sm" square :aria-label="`Change access of ${m.name || m.email}`" @click="openEdit(m)" />
            <UButton v-if="mayManage(m)" icon="i-lucide-user-minus" color="neutral" variant="ghost" size="sm" square :aria-label="`Remove ${m.name || m.email}`" @click="() => { removing = m }" />
          </li>
        </ul>
      </InfoCard>
    </template>

    <InfoCard v-if="invitations.length" title="Invited" :padded="false">
      <ul class="divide-y divide-(--ui-border-muted)">
        <li v-for="inv in invitations" :key="inv.id" class="flex items-center gap-3 px-4 py-3">
          <span class="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-(--k-moment-bg) text-(--k-moment-text)">
            <UIcon name="i-lucide-mail" class="size-4" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm text-highlighted">{{ inv.email }}</p>
            <p class="truncate text-xs" :class="inv.expired ? 'text-warning' : 'text-muted'">{{ invitationLine(inv) }}</p>
            <p v-if="teams.length > 1 && inv.role !== 'owner' && inv.role !== 'admin'" class="truncate text-xs text-muted">{{ inv.teamIds.length ? inv.teamIds.map(teamName).join(', ') : 'The default team' }}</p>
          </div>
          <UBadge :label="ROLE_LABELS[inv.role]" color="neutral" variant="outline" size="sm" class="hidden sm:inline-flex" />
          <UBadge :label="inv.expired ? 'Expired' : 'Invited'" :color="inv.expired ? 'warning' : 'neutral'" variant="subtle" size="sm" />
          <UButton icon="i-lucide-send" color="neutral" variant="ghost" size="sm" square :loading="inviteBusyId === inv.id" :aria-label="`Send the invitation to ${inv.email} again`" @click="resendInvite(inv)" />
          <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="sm" square :disabled="inviteBusyId === inv.id" :aria-label="`Take back the invitation to ${inv.email}`" @click="cancelInvite(inv)" />
        </li>
      </ul>
    </InfoCard>

    <!-- Invite people; when e-mail is not sent, each link is shown to pass on. -->
    <UModal v-model:open="inviteOpen" :title="inviteTitle" :description="outcomes ? undefined : 'They get an e-mail with a link to join.'">
      <template #body>
        <form v-if="!outcomes" id="invite" class="flex flex-col gap-4" @submit.prevent="sendInvites">
          <UFormField label="E-mail" name="emails" description="Press Enter after each address, or paste several.">
            <UInputTags v-model="inviteEmails" :delimiter="EMAIL_DELIMITER" add-on-paste add-on-blur add-on-tab :max="20" placeholder="eva@example.com" autofocus class="w-full" />
          </UFormField>
          <UFormField label="Role" name="role">
            <URadioGroup v-model="access.role" :items="roleItems" variant="card" class="w-full" />
          </UFormField>
          <UFormField v-if="!seesAll && teams.length" label="Teams" name="teamIds" :description="access.role === 'guest' ? undefined : 'Empty: the default team.'">
            <USelectMenu v-model="access.teamIds" :items="teamItems" value-key="value" multiple placeholder="Pick teams" class="w-full" />
          </UFormField>
          <div v-if="access.role === 'guest'" class="rounded-lg border border-(--k-moment-line) bg-(--k-moment-bg) p-3 text-sm text-pretty text-(--k-moment-text)">{{ guestNote }}</div>
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
              <UButton :icon="copiedLink === o.link ? 'i-lucide-check' : 'i-lucide-copy'" :label="copiedLink === o.link ? 'Copied' : 'Copy'" color="neutral" variant="outline" size="xs" @click="copyLink(o.link)" />
            </div>
          </li>
        </ul>
      </template>
      <template #footer>
        <div class="flex w-full items-center justify-end gap-2">
          <template v-if="!outcomes">
            <span class="mr-auto hidden text-xs text-muted sm:inline">The link works for 7 days.</span>
            <UButton label="Cancel" color="neutral" variant="ghost" @click="() => { inviteOpen = false }" />
            <UButton type="submit" form="invite" :label="inviteEmails.length > 1 ? `Send ${inviteEmails.length} invites` : 'Send invite'" :loading="inviteBusy" :disabled="accessInvalid" />
          </template>
          <UButton v-else label="Done" @click="() => { inviteOpen = false }" />
        </div>
      </template>
    </UModal>

    <!-- Change someone's role and teams. -->
    <UModal v-model:open="editOpen" :title="`Access of ${editing?.name || editing?.email || 'them'}`">
      <template #body>
        <form id="edit-access" class="flex flex-col gap-4" @submit.prevent="saveEdit">
          <UFormField label="Role" name="role">
            <URadioGroup v-model="access.role" :items="roleItems" variant="card" class="w-full" />
          </UFormField>
          <UFormField v-if="teams.length" label="Teams" name="teamIds" :description="seesAll ? 'Owners and admins see every team; being on one makes them a member of it too.' : undefined">
            <USelectMenu v-model="access.teamIds" :items="teamItems" value-key="value" multiple placeholder="Pick teams" class="w-full" />
          </UFormField>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton label="Cancel" color="neutral" variant="ghost" @click="() => { editing = null }" />
          <UButton type="submit" form="edit-access" label="Save" :loading="editBusy" :disabled="accessInvalid" />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="removeOpen" :title="`Remove ${removing?.name || removing?.email || 'them'}?`" :description="`They lose access to ${workspace?.name} straight away. Its sites stay.`">
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton label="Cancel" color="neutral" variant="ghost" @click="() => { removing = null }" />
          <UButton label="Remove" color="error" :loading="removeBusy" @click="removePerson" />
        </div>
      </template>
    </UModal>
  </div>
</template>
