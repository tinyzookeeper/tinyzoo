<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

// Team: who can sign in, with what role. Administrators invite people, change
// roles, disable access or remove someone; the server enforces every guard
// (not yourself, never the last administrator).
definePageMeta({ layout: 'admin' })
const { t } = useCmsI18n()
const toast = useToast()
const { user: me } = useUserSession()
useHead({ title: () => t('team.title') })

const isAdmin = computed(() => me.value?.role === 'admin')
const { data, refresh, error } = await useFetch<{ users: any[] }>('/api/cms/_users', { immediate: isAdmin.value })
const users = computed(() => data.value?.users ?? [])

const ROLES = ['admin', 'editor', 'author'] as const
const roleName = (r: string) => (ROLES as readonly string[]).includes(r) ? t(`roles.${r as typeof ROLES[number]}.name`) : r

// ── invite ──
const inviteOpen = ref(false)
const invite = reactive({ email: '', name: '', role: 'editor' as typeof ROLES[number] })
const inviteErrors = reactive<Record<string, string>>({})
const inviting = ref(false)
const inviteForm = ref<HTMLElement | null>(null)
const inviteFailed = ref('')
const created = ref<{ email: string; role: string; url: string; emailed: boolean } | null>(null)

function openInvite() {
  Object.assign(invite, { email: '', name: '', role: 'editor' })
  Object.keys(inviteErrors).forEach((k) => delete inviteErrors[k])
  created.value = null
  inviteOpen.value = true
}

async function sendInvite() {
  Object.keys(inviteErrors).forEach((k) => delete inviteErrors[k])
  inviteFailed.value = ''
  inviting.value = true
  try {
    const res = await $fetch<{ user: any; inviteUrl: string; emailed: boolean }>('/api/cms/_users', { method: 'POST', body: invite })
    created.value = { email: res.user.email, role: res.user.role, url: res.inviteUrl, emailed: res.emailed }
    refresh()
  }
  catch (err: any) {
    const issues = err?.data?.data
    if (Array.isArray(issues)) for (const i of issues) if (i.path?.[0]) inviteErrors[i.path[0]] = cmsIssueMessage(i, null, t as any)
    // Said in the dialog itself (read out, and the cursor goes there), not in a toast behind it.
    if (!Object.keys(inviteErrors).length) inviteFailed.value = cmsRequestError(err, t as any)
    await cmsFocusInvalid(inviteForm.value)
  }
  finally {
    inviting.value = false
  }
}

const copied = ref(false)
async function copy(url: string) {
  await navigator.clipboard.writeText(url)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

// ── row actions ──
async function act(run: () => Promise<unknown>, success: string) {
  try {
    await run()
    toast.add({ title: success, icon: 'i-lucide-check', color: 'success' })
    refresh()
  }
  catch (err: any) {
    toast.add({ title: t('team.actionFailed'), description: cmsErrorMessage(err, ''), color: 'error', icon: 'i-lucide-x' })
  }
}
const patch = (id: string, body: Record<string, string>) => cmsFetch(`/api/cms/_users/${id}`, { method: 'PATCH', body })

const resent = ref<{ email: string; role: string; url: string; emailed: boolean } | null>(null)
async function resend(u: any) {
  await act(async () => {
    const res = await cmsFetch<{ inviteUrl: string; emailed: boolean }>(`/api/cms/_users/${u.id}/resend`, { method: 'POST' })
    resent.value = { email: u.email, role: u.role, url: res.inviteUrl, emailed: res.emailed }
  }, t('team.resent'))
}

// Someone who never accepted the invitation has only an invitation to take back.
const confirm = useCmsConfirm()
async function remove(u: any) {
  const name = u.name || u.email
  const invited = u.status === 'invited'
  const ok = await confirm({
    title: t(invited ? 'team.cancelInviteTitle' : 'team.removeTitle', { name }),
    description: t(invited ? 'team.cancelInviteBody' : 'team.removeBody'),
    icon: invited ? 'i-lucide-mail-x' : 'i-lucide-user-minus', color: 'error',
    confirmLabel: t(invited ? 'team.cancelInvite' : 'team.remove'),
    cancelLabel: t(invited ? 'team.keepInvite' : 'common.cancel'),
  })
  if (ok) await act(() => cmsFetch(`/api/cms/_users/${u.id}`, { method: 'DELETE' }), t(invited ? 'team.inviteCancelled' : 'team.removed'))
}

// Turning someone's access off signs them out at once and takes their drafts out of reach:
// asked first (it is undone with "Enable access", but not before they have been locked out).
async function disable(u: any) {
  const name = u.name || u.email
  const ok = await confirm({
    title: t('team.disableTitle', { name }), description: t('team.disableBody'),
    icon: 'i-lucide-ban', color: 'error', confirmLabel: t('team.disable'), cancelLabel: t('common.cancel'),
  })
  if (ok) await act(() => patch(u.id, { status: 'disabled' }), t('team.disabled'))
}

function rowMenu(u: any): DropdownMenuItem[][] {
  const groups: DropdownMenuItem[][] = [[{
    label: t('team.changeRole'), icon: 'i-lucide-shield',
    children: ROLES.map((r) => ({
      label: roleName(r), type: 'checkbox' as const, checked: u.role === r,
      onSelect: () => { if (u.role !== r) act(() => patch(u.id, { role: r }), t('team.roleChanged')) },
    })),
  }]]
  if (u.status === 'invited') groups[0]!.push({ label: t('team.resend'), icon: 'i-lucide-send', onSelect: () => resend(u) })
  if (u.status === 'active') groups[0]!.push({ label: t('team.disable'), icon: 'i-lucide-ban', onSelect: () => disable(u) })
  if (u.status === 'disabled') groups[0]!.push({ label: t('team.enable'), icon: 'i-lucide-rotate-ccw', onSelect: () => act(() => patch(u.id, { status: 'active' }), t('team.enabled')) })
  groups.push([u.status === 'invited'
    ? { label: t('team.cancelInvite'), icon: 'i-lucide-mail-x', color: 'error' as const, onSelect: () => remove(u) }
    : { label: t('team.remove'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => remove(u) }])
  return groups
}

const initials = (u: any) => (u.name || u.email).split(/[\s@.]+/).filter(Boolean).map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()
</script>

<template>
  <CmsPage :title="t('team.title')" :description="t('team.description')" :breadcrumbs="[{ label: t('nav.home'), to: '/admin' }, { label: t('team.title') }]">
    <template v-if="isAdmin" #actions>
      <UButton icon="i-lucide-user-plus" @click="openInvite">{{ t('team.invite') }}</UButton>
    </template>

    <div class="cms-card overflow-hidden">
      <CmsEmptyState v-if="!isAdmin" plain icon="i-lucide-lock" :title="t('team.adminsOnly')" />
      <CmsLoadError v-else-if="error" :error="error" @retry="refresh()" />
      <!-- phones: each person is a small card (name, then role and status under it) -->
      <div v-else class="sm:overflow-x-auto">
        <table class="w-full text-sm max-sm:block">
          <thead class="max-sm:hidden">
            <tr class="border-b border-default text-left text-muted">
              <th scope="col" class="font-medium px-4 py-2.5">{{ t('team.person') }}</th>
              <th scope="col" class="font-medium px-4 py-2.5">{{ t('team.role') }}</th>
              <th scope="col" class="font-medium px-4 py-2.5">{{ t('team.status') }}</th>
              <th scope="col" class="font-medium px-4 py-2.5 whitespace-nowrap">{{ t('team.lastActive') }}</th>
              <th class="w-12"><span class="sr-only">{{ t('common.edit') }}</span></th>
            </tr>
          </thead>
          <tbody class="max-sm:block">
            <tr v-for="u in users" :key="u.id" class="border-b border-default last:border-0 max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-x-2 max-sm:gap-y-1 max-sm:px-4 max-sm:py-3">
              <td class="px-4 py-3 max-sm:p-0 max-sm:col-start-1 max-sm:row-start-1">
                <div class="flex items-center gap-3 min-w-0">
                  <span class="size-8 shrink-0 rounded-full bg-(--cms-moment-strong) text-highlighted grid place-items-center text-xs font-medium">{{ initials(u) }}</span>
                  <span class="min-w-0">
                    <span class="flex items-center gap-2">
                      <span class="font-medium text-highlighted truncate">{{ u.name || u.email }}</span>
                      <UBadge v-if="u.id === me?.id" color="neutral" variant="outline" size="sm">{{ t('team.you') }}</UBadge>
                    </span>
                    <span v-if="u.name" class="block text-muted truncate">{{ u.email }}</span>
                  </span>
                </div>
              </td>
              <td class="px-4 py-3 whitespace-nowrap max-sm:col-start-1 max-sm:p-0 max-sm:pl-11 max-sm:text-muted">{{ roleName(u.role) }}</td>
              <td class="px-4 py-3 whitespace-nowrap max-sm:col-start-1 max-sm:p-0 max-sm:pl-11">
                <!-- a dot and a word, as every status in the admin -->
                <span v-if="u.status === 'active'" class="inline-flex items-center gap-2 text-default">
                  <span class="size-2 rounded-full bg-success" aria-hidden="true" />{{ t('team.statusActive') }}
                </span>
                <span v-else-if="u.status === 'invited'" class="inline-flex flex-col">
                  <span class="inline-flex items-center gap-2 text-default">
                    <span class="size-2 rounded-full bg-info" aria-hidden="true" />{{ t('team.statusInvited') }}
                  </span>
                  <span v-if="u.invite?.expiresAt" class="mt-1 text-xs text-muted">{{ t('team.inviteExpires', { time: '' }) }}<CmsTime :value="u.invite.expiresAt" relative /></span>
                  <span v-else class="mt-1 text-xs cms-unsaved">{{ t('team.inviteExpiredBadge') }}</span>
                </span>
                <span v-else class="inline-flex items-center gap-2 text-muted">
                  <span class="size-2 rounded-full ring-[1.5px] ring-inset ring-(--ui-text-dimmed)" aria-hidden="true" />{{ t('team.statusDisabled') }}
                </span>
              </td>
              <td class="px-4 py-3 text-muted whitespace-nowrap max-sm:hidden">
                <CmsTime v-if="u.lastLoginAt" :value="u.lastLoginAt" relative />
                <span v-else>{{ t('team.never') }}</span>
              </td>
              <td class="px-2 py-3 text-right max-sm:p-0 max-sm:col-start-2 max-sm:row-start-1 max-sm:self-center">
                <UDropdownMenu v-if="u.id !== me?.id" :items="rowMenu(u)" :content="{ align: 'end' }">
                  <UButton color="neutral" variant="ghost" icon="i-lucide-ellipsis" size="sm" :aria-label="t('common.edit')" />
                </UDropdownMenu>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Invite -->
    <UModal v-model:open="inviteOpen" :title="created ? t(created.emailed ? 'team.inviteSent' : 'team.inviteCreated', { email: created.email }) : t('team.inviteTitle')">
      <template #body>
        <div v-if="created" class="space-y-4">
          <UAlert v-if="!created.emailed" color="warning" variant="subtle" icon="i-lucide-mail-warning" :title="t('team.inviteNotEmailed')" />
          <UFormField :label="t('team.inviteLink')" :description="t('team.linkNote', { role: roleName(created.role).toLowerCase() })">
            <div class="flex gap-2">
              <UInput :model-value="created.url" readonly class="flex-1 font-mono text-xs" />
              <UButton color="neutral" variant="outline" :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" @click="copy(created.url)">{{ copied ? t('team.copied') : t('team.copyLink') }}</UButton>
            </div>
          </UFormField>
        </div>
        <form v-else id="cms-invite" ref="inviteForm" class="space-y-5" novalidate @submit.prevent="sendInvite">
          <UFormField :label="t('auth.email')" name="email" :error="inviteErrors.email || undefined" required>
            <UInput v-model="invite.email" type="email" autofocus class="w-full" />
            <template #error="{ error }"><span v-if="error" role="alert">{{ error }}</span></template>
          </UFormField>
          <UFormField :label="t('team.inviteName')" name="name">
            <UInput v-model="invite.name" class="w-full" />
          </UFormField>
          <UFormField :label="t('team.role')" name="role">
            <URadioGroup
              v-model="invite.role" variant="card" indicator="start" :aria-label="t('team.role')"
              :ui="{ item: 'has-data-[state=checked]:bg-(--cms-moment-bg) has-data-[state=checked]:border-(--cms-moment-line)' }"
              :items="ROLES.map((r: typeof ROLES[number]) => ({ value: r, label: t(`roles.${r}.name`), description: t(`roles.${r}.description`) }))"
            />
          </UFormField>
          <UAlert v-if="inviteFailed" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="inviteFailed" role="alert" data-cms-error-summary />
        </form>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <template v-if="created">
            <UButton color="neutral" variant="ghost" icon="i-lucide-user-plus" @click="openInvite">{{ t('team.inviteAnother') }}</UButton>
            <UButton @click="inviteOpen = false">{{ t('common.close') }}</UButton>
          </template>
          <template v-else>
            <UButton color="neutral" variant="ghost" @click="inviteOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton type="submit" form="cms-invite" icon="i-lucide-send" :loading="inviting">{{ t('team.sendInvite') }}</UButton>
          </template>
        </div>
      </template>
    </UModal>

    <!-- A resent invitation: show the new link too -->
    <UModal :open="!!resent" :title="resent ? t(resent.emailed ? 'team.inviteSent' : 'team.inviteCreated', { email: resent.email }) : ''" @update:open="(v: boolean) => { if (!v) resent = null }">
      <template #body>
        <div v-if="resent" class="space-y-4">
          <UAlert v-if="!resent.emailed" color="warning" variant="subtle" icon="i-lucide-mail-warning" :title="t('team.inviteNotEmailed')" />
          <UFormField :label="t('team.inviteLink')" :description="t('team.linkNote', { role: roleName(resent.role).toLowerCase() })">
            <div class="flex gap-2">
              <UInput :model-value="resent.url" readonly class="flex-1 font-mono text-xs" />
              <UButton color="neutral" variant="outline" :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" @click="copy(resent.url)">{{ copied ? t('team.copied') : t('team.copyLink') }}</UButton>
            </div>
          </UFormField>
        </div>
      </template>
    </UModal>

  </CmsPage>
</template>
