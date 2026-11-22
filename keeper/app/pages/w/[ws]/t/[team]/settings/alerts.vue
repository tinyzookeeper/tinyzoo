<script setup lang="ts">
import type { MailStatus, WorkspaceSettings } from '#keeper/types/keeper'

// Who hears when a site of this workspace goes down, comes back, restarts, or its certificate runs out
// (owners and admins), and how Keeper sends e-mail.
const toast = useToast()
const { wsSlug, workspace, isManager, link } = useScope()
if (!isManager.value) await navigateTo(link('/settings/general'), { replace: true })
const { data: ws, refresh } = await useFetch<WorkspaceSettings>(() => `/api/w/${wsSlug.value}`, { key: `ws-${wsSlug.value}` })
const { data: mail } = await useFetch<MailStatus>('/api/mail', { key: 'mail' })
const emails = ref((ws.value?.alertEmails ?? []).join(', '))
watch(ws, (w) => { if (w) emails.value = w.alertEmails.join(', ') })

const saving = ref(false)
async function save() {
  saving.value = true
  try {
    const alertEmails = emails.value.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean)
    await $fetch(`/api/w/${wsSlug.value}`, { method: 'PATCH', body: { alertEmails } })
    await refresh()
    toast.add({ title: 'Saved', color: 'success', icon: 'i-lucide-check' })
  }
  catch (err) {
    toast.add({ title: 'Could not save', description: errorMessage(err), color: 'error' })
  }
  finally {
    saving.value = false
  }
}

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
</script>

<template>
  <div class="flex flex-col gap-6">
    <InfoCard title="Alert e-mails">
      <form class="flex flex-col gap-4" @submit.prevent="save">
        <UFormField
          label="Addresses"
          name="alertEmails"
          :description="`Who hears when a site of ${workspace?.name ?? 'this workspace'} goes down, comes back, restarts without a deploy, its certificate is about to expire or its visitors drop. Separate with commas. Empty: everyone here who works on that site (owners, admins and the members of its team; never guests).`"
        >
          <UTextarea v-model="emails" :rows="3" autoresize placeholder="ops@example.com, ada@example.com" class="w-full font-mono" />
        </UFormField>
        <div class="flex justify-end">
          <UButton type="submit" label="Save" :loading="saving" />
        </div>
      </form>
    </InfoCard>

    <InfoCard v-if="mail" title="How Keeper sends e-mail">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <p class="min-w-0 flex-1 text-sm text-pretty text-toned">{{ mailLine }}</p>
        <UButton label="Send a test e-mail" icon="i-lucide-send" color="neutral" variant="outline" size="sm" class="self-start" :loading="testBusy" @click="sendTestMail" />
      </div>
    </InfoCard>
  </div>
</template>
