<script setup lang="ts">
// Privacy: everything stored about one email address — form messages, a CMS account,
// activity-log entries — to hand over (JSON) or erase. Administrators only; the
// server checks it, rate limits it and audits both actions.
definePageMeta({ layout: 'admin' })
const { t, tl, formatDate } = useCmsI18n()
const toast = useToast()
const confirm = useCmsConfirm()
const { user: me } = useUserSession()
useHead({ title: () => t('privacy.title') })
const isAdmin = computed(() => me.value?.role === 'admin')
// The forms' field labels, to show a choice by its name ("A race") and not by its key ("race").
// Read from the layout's own fetch (same key), not fetched again: a second `useFetch` here made the
// form's generated ids (label `for`, input `id`) differ after hydration, leaving the field unlabelled.
const { data: graph } = useNuxtData<any[]>('cms-graph')

interface Found {
  email: string
  submissions: { form: string; formLabel: any; id: string; createdAt: string; status: string | null; data: Record<string, unknown> }[]
  account: { id: string; email: string; name: string; role: string; status: string; lastLoginAt: string | null; createdAt: string } | null
  audit: { total: number; latest: { id: string; action: string; createdAt: string }[] }
  /** Changes of sign-in address waiting for this one, or ways back to it. */
  emailChanges: number
}

const email = ref('')
const error = ref('')
const found = ref<Found | null>(null)
const searching = ref(false)
const busy = ref<'export' | 'delete' | null>(null)
// Right after an erase the lookup is empty because we emptied it: say so, not "nothing was ever stored".
const justErased = ref(false)

const empty = computed(() => !!found.value && !found.value.submissions.length && !found.value.account && !found.value.audit.total && !found.value.emailChanges)

async function search(keepErased = false) {
  if (!keepErased) justErased.value = false
  error.value = ''
  found.value = null
  searching.value = true
  try {
    found.value = await cmsFetch<Found>('/api/cms/_privacy/lookup', { method: 'POST', body: { email: email.value } })
  }
  catch (err: any) {
    error.value = err?.statusCode === 422 ? t('privacy.invalidEmail') : cmsErrorMessage(err, t('team.actionFailed'))
  }
  finally {
    searching.value = false
  }
}

async function exportJson() {
  if (!found.value) return
  busy.value = 'export'
  try {
    const text = await cmsFetch<string>('/api/cms/_privacy/export', { method: 'POST', body: { email: found.value.email }, responseType: 'text' })
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'personal-data.json'
    a.click()
    URL.revokeObjectURL(url)
    toast.add({ title: t('privacy.exported'), icon: 'i-lucide-check', color: 'success' })
  }
  catch (err: any) {
    toast.add({ title: t('team.actionFailed'), description: cmsErrorMessage(err, ''), color: 'error', icon: 'i-lucide-x' })
  }
  finally {
    busy.value = null
  }
}

async function erase() {
  if (!found.value) return
  const target = found.value.email
  // The question names what this lookup found, so "delete" says what goes.
  const { submissions, account, audit, emailChanges } = found.value
  const lines = [
    submissions.length ? t('privacy.eraseSubmissions', { count: submissions.length }) : '',
    account ? t('privacy.eraseAccount') : '',
    emailChanges ? t('privacy.eraseEmailChanges') : '',
    audit.total ? t('privacy.eraseActivity', { count: audit.total }) : '',
    t('privacy.eraseUndone'),
  ].filter(Boolean)
  const ok = await confirm({
    title: t('privacy.eraseTitle', { email: target }),
    description: lines.join('\n'),
    icon: 'i-lucide-user-x', color: 'error',
    confirmLabel: t('privacy.erase'), cancelLabel: t('common.cancel'),
  })
  if (!ok) return
  busy.value = 'delete'
  try {
    await cmsFetch('/api/cms/_privacy/delete', { method: 'POST', body: { email: target } })
    toast.add({ title: t('privacy.erased'), icon: 'i-lucide-check', color: 'success' })
    justErased.value = true
    await search(true)
  }
  catch (err: any) {
    toast.add({ title: t('team.actionFailed'), description: cmsErrorMessage(err, ''), color: 'error', icon: 'i-lucide-x' })
  }
  finally {
    busy.value = null
  }
}

/**
 * A few values of a submission, for the list: its texts in the form's order, a choice by
 * its label, without the email (it is the address searched for, said in the heading).
 */
function preview(s: Found['submissions'][number]): string {
  const fields: any[] = (graph.value ?? []).find((e: any) => e.name === s.form)?.fields ?? []
  const keys = fields.length ? fields.map((f) => f.key) : Object.keys(s.data)
  const parts: string[] = []
  for (const key of keys) {
    const v = s.data[key]
    const f = fields.find((x) => x.key === key)
    if (typeof v !== 'string' || !v.trim() || f?.meta?.format === 'email') continue
    parts.push(f?.type === 'select' ? tl(f.meta?.labels?.[v], v) : v.trim())
  }
  return parts.slice(0, 3).join(' · ')
}
const roleName = (r: string) => (['admin', 'editor', 'author'] as const).includes(r as any) ? t(`roles.${r as 'admin' | 'editor' | 'author'}.name`) : r
</script>

<template>
  <CmsPage narrow :title="t('privacy.title')" :description="t('privacy.description')" :breadcrumbs="[{ label: t('nav.home'), to: '/admin' }, { label: t('privacy.title') }]">
    <div v-if="!isAdmin" class="cms-card overflow-hidden">
      <CmsEmptyState plain icon="i-lucide-lock" :title="t('privacy.adminsOnly')" />
    </div>

    <template v-else>
      <!-- an empty string would still mark the field invalid (red, aria-invalid): no error is `undefined` -->
      <form class="cms-card cms-touch flex flex-wrap items-end gap-3 p-4" novalidate @submit.prevent="search()">
        <UFormField :label="t('privacy.emailLabel')" name="email" :error="error || undefined" class="min-w-0 flex-1 basis-64 max-sm:basis-full">
          <UInput v-model="email" type="email" autocomplete="off" autofocus icon="i-lucide-at-sign" :placeholder="t('privacy.emailPlaceholder')" class="w-full" />
          <template #error="{ error: message }"><span v-if="message" role="alert">{{ message }}</span></template>
        </UFormField>
        <UButton type="submit" icon="i-lucide-search" class="max-sm:w-full max-sm:justify-center" :loading="searching" :disabled="!email.trim()">{{ t('privacy.search') }}</UButton>
      </form>

      <div v-if="found" class="mt-6 space-y-4" aria-live="polite">
        <div v-if="!empty" class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="min-w-0 truncate text-sm font-medium text-highlighted">{{ t('privacy.storedAbout', { email: found.email }) }}</h2>
          <div class="cms-touch flex flex-wrap gap-2 max-sm:w-full max-sm:flex-col">
            <UButton color="neutral" variant="outline" icon="i-lucide-download" class="max-sm:justify-center" :loading="busy === 'export'" :disabled="!!busy" @click="exportJson">{{ t('privacy.export') }}</UButton>
            <UButton color="error" variant="soft" icon="i-lucide-trash-2" class="max-sm:justify-center" :loading="busy === 'delete'" :disabled="!!busy" @click="erase">{{ t('privacy.erase') }}</UButton>
          </div>
        </div>

        <template v-if="empty">
          <CmsEmptyState
            plain icon="i-lucide-shield-check"
            :title="justErased ? t('privacy.nothingAfter', { email: found.email }) : t('privacy.nothing')" :description="justErased ? undefined : t('privacy.nothingBody')"
          />
          <p v-if="justErased" class="text-center text-xs text-muted">{{ t('privacy.note') }}</p>
        </template>

        <template v-else>
          <section class="cms-card overflow-hidden" :aria-label="t('privacy.submissions')">
            <h3 class="cms-label px-4 pt-3 pb-1.5">{{ t('privacy.submissions') }} <span class="tabular-nums text-muted">{{ found.submissions.length }}</span></h3>
            <p v-if="!found.submissions.length" class="px-4 pb-3 text-sm text-muted">{{ t('privacy.noSubmissions') }}</p>
            <ul v-else>
              <li v-for="s in found.submissions" :key="s.id" class="border-t border-(--ui-border-muted) px-4 py-3">
                <div class="flex items-center justify-between gap-3 text-xs text-muted">
                  <NuxtLink :to="`/admin/${s.form}/${s.id}`" class="font-medium text-highlighted hover:underline pointer-coarse:-my-2 pointer-coarse:py-2">{{ tl(s.formLabel, s.form) }}</NuxtLink>
                  <time :datetime="s.createdAt">{{ formatDate(s.createdAt) }}</time>
                </div>
                <p class="mt-1 line-clamp-2 text-sm text-default">{{ preview(s) }}</p>
              </li>
            </ul>
          </section>

          <section class="cms-card overflow-hidden" :aria-label="t('privacy.account')">
            <h3 class="cms-label px-4 pt-3 pb-1.5">{{ t('privacy.account') }}</h3>
            <p v-if="!found.account" class="px-4 pb-3 text-sm text-muted">{{ t('privacy.noAccount') }}</p>
            <dl v-else class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1 px-4 pb-3 text-sm">
              <dt class="text-muted">{{ t('team.person') }}</dt><dd class="truncate text-highlighted">{{ found.account.name || found.account.email }}</dd>
              <dt class="text-muted">{{ t('team.role') }}</dt><dd>{{ roleName(found.account.role) }}</dd>
              <dt class="text-muted">{{ t('team.status') }}</dt><dd>{{ t(`team.status${found.account.status === 'active' ? 'Active' : found.account.status === 'invited' ? 'Invited' : 'Disabled'}`) }}</dd>
              <dt class="text-muted">{{ t('team.lastActive') }}</dt><dd>{{ found.account.lastLoginAt ? formatDate(found.account.lastLoginAt) : t('team.never') }}</dd>
            </dl>
            <p v-if="found.emailChanges" class="px-4 pb-3 text-sm text-muted">{{ t('privacy.emailChanges') }}</p>
          </section>

          <section class="cms-card overflow-hidden" :aria-label="t('privacy.activity')">
            <h3 class="cms-label px-4 pt-3 pb-1.5">{{ t('privacy.activity') }} <span class="tabular-nums text-muted">{{ found.audit.total }}</span></h3>
            <p v-if="!found.audit.total" class="px-4 pb-3 text-sm text-muted">{{ t('privacy.noActivity') }}</p>
            <p v-else class="px-4 pb-3 text-sm text-muted">{{ t('privacy.activityBody') }}</p>
          </section>

          <p class="text-xs text-muted">{{ t('privacy.note') }}</p>
        </template>
      </div>
    </template>
  </CmsPage>
</template>
