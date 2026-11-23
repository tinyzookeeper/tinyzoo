<script setup lang="ts">
// Your own account: name, interface language, sign-in email, password.
definePageMeta({ layout: 'admin' })
const { t, locale, locales, setLocale } = useCmsI18n()
const toast = useToast()
const { user, fetch: refreshSession } = useUserSession()
useHead({ title: () => t('account.title') })

const profile = reactive({ name: user.value?.name ?? '', locale: user.value?.locale ?? locale.value })
// The shared demo account (cms.demo) keeps its name and password; only the language changes.
const demo = useRuntimeConfig().public.cmsDemo as { email?: string } | undefined
const isDemo = computed(() => !!demo?.email && user.value?.email?.toLowerCase() === demo.email.trim().toLowerCase())
const savingProfile = ref(false)
const profileErrors = reactive<Record<string, string>>({})
const profileForm = ref<HTMLElement | null>(null)
async function saveProfile() {
  Object.keys(profileErrors).forEach((k) => delete profileErrors[k])
  savingProfile.value = true
  try {
    await $fetch('/api/cms/_auth/me', { method: 'PATCH', body: isDemo.value ? { locale: profile.locale } : profile })
    await refreshSession()
    setLocale(profile.locale)
    toast.add({ title: t('account.saved'), icon: 'i-lucide-check', color: 'success' })
  }
  catch (err: any) {
    // A field that is wrong is marked and read out ("Please fill this in"), not a bare "Validation failed" toast.
    const issues = err?.data?.data
    if (Array.isArray(issues)) for (const i of issues) if (i.path?.[0]) profileErrors[i.path[0]] = cmsIssueMessage(i, null, t as any)
    if (Object.keys(profileErrors).length) await cmsFocusInvalid(profileForm.value)
    else toast.add({ title: t('team.actionFailed'), description: cmsRequestError(err, t as any), color: 'error', icon: 'i-lucide-x' })
  }
  finally {
    savingProfile.value = false
  }
}

// ── sign-in email: asked for with the password, made when the link sent to the new address is opened ──
interface PendingEmail { email: string; expiresAt: string }
// Read in the browser after the page is shown: an async load in setup shifts the ids Nuxt UI gives this
// page's labels and fields between the server and the browser (every label pointed at nothing).
const pendingEmail = ref<PendingEmail | null>(null)
// Where people sign in with the tinyzoo account: one line saying whether this user is connected to
// one (the admin's layout asked already: `_auth/me` says the account is on, the list of websites who is linked).
const { data: access } = useNuxtData<{ account?: { enabled: boolean } }>('cms-access')
const { state: accountSites } = useCmsAccountSites()
async function refreshEmailState() {
  try {
    pendingEmail.value = (await $fetch<{ pending: PendingEmail | null }>('/api/cms/_auth/email')).pending
  }
  catch {
    pendingEmail.value = null // nothing to show; asking again still works
  }
}
onMounted(refreshEmailState)
const emailChange = reactive({ email: '', password: '' })
const emailErrors = reactive<Record<string, string>>({})
const emailForm = ref<HTMLElement | null>(null)
const savingEmail = ref(false)
const cancellingEmail = ref(false)
async function requestEmailChange() {
  Object.keys(emailErrors).forEach((k) => delete emailErrors[k])
  savingEmail.value = true
  try {
    const res = await $fetch<{ pending: PendingEmail }>('/api/cms/_auth/email', { method: 'POST', body: emailChange })
    pendingEmail.value = res.pending
    Object.assign(emailChange, { email: '', password: '' })
    toast.add({ title: t('account.emailSent'), description: res.pending.email, icon: 'i-lucide-mail-check', color: 'success' })
  }
  catch (err: any) {
    const issues = err?.data?.data
    if (Array.isArray(issues)) for (const i of issues) if (i.path?.[0]) emailErrors[i.path[0]] = cmsIssueMessage(i, null, t as any)
    if (Object.keys(emailErrors).length) await cmsFocusInvalid(emailForm.value)
    else toast.add({ title: t('team.actionFailed'), description: cmsRequestError(err, t as any), color: 'error', icon: 'i-lucide-x' })
  }
  finally {
    savingEmail.value = false
  }
}
async function cancelEmailChange() {
  cancellingEmail.value = true
  try {
    await $fetch('/api/cms/_auth/email', { method: 'DELETE' })
    await refreshEmailState()
    toast.add({ title: t('account.emailChangeCancelled'), icon: 'i-lucide-check', color: 'success' })
  }
  catch (err: any) {
    toast.add({ title: t('team.actionFailed'), description: cmsRequestError(err, t as any), color: 'error', icon: 'i-lucide-x' })
  }
  finally {
    cancellingEmail.value = false
  }
}

const pw = reactive({ current: '', password: '' })
const pwErrors = reactive<Record<string, string>>({})
const pwForm = ref<HTMLElement | null>(null)
const savingPw = ref(false)
async function changePassword() {
  Object.keys(pwErrors).forEach((k) => delete pwErrors[k])
  savingPw.value = true
  try {
    await $fetch('/api/cms/_auth/password', { method: 'POST', body: pw })
    Object.assign(pw, { current: '', password: '' })
    toast.add({ title: t('account.passwordChanged'), icon: 'i-lucide-check', color: 'success' })
  }
  catch (err: any) {
    const issues = err?.data?.data
    if (Array.isArray(issues)) for (const i of issues) if (i.path?.[0]) pwErrors[i.path[0]] = cmsIssueMessage(i, null, t as any)
    if (Object.keys(pwErrors).length) await cmsFocusInvalid(pwForm.value)
    else toast.add({ title: t('team.actionFailed'), description: cmsRequestError(err, t as any), color: 'error', icon: 'i-lucide-x' })
  }
  finally {
    savingPw.value = false
  }
}
// ── access tokens (the MCP server): made here, shown once, revoked here ──
interface TokenRights { write: boolean; publish: boolean; delete: boolean; media: boolean; entities: string[] | null }
interface AccessToken { id: string; name: string; prefix: string; origin: 'manual' | 'oauth'; client: string | null; rights: TokenRights; createdAt: string; expiresAt: string | null; lastUsedAt: string | null }
interface TokenState { tokens: AccessToken[]; can: { publish: boolean; media: boolean }; areas: { name: string; label: unknown; kind: string }[]; max: number }
const { entityLabel, formatDateWith } = useCmsI18n()
const confirm = useCmsConfirm()
// Read in the browser (like the email state above). Null: tokens are off here (or this is the demo account).
const tokenState = ref<TokenState | null>(null)
async function refreshTokens() {
  try {
    tokenState.value = await $fetch<TokenState>('/api/cms/_auth/tokens')
  }
  catch {
    tokenState.value = null
  }
}
onMounted(refreshTokens)
const mcpAddress = computed(() => import.meta.client ? new URL(`${useRuntimeConfig().app.baseURL.replace(/\/$/, '')}/api/mcp`, window.location.origin).href : '')
const areaLabel = (name: string) => {
  const a = tokenState.value?.areas.find((x) => x.name === name)
  return a ? entityLabel(a as any) : name
}

const tokenOpen = ref(false)
const tokenBusy = ref(false)
const tokenErrors = reactive<Record<string, string>>({})
const newToken = reactive({ name: '', write: false, publish: false, delete: false, media: false, scope: 'all' as 'all' | 'some', entities: [] as string[], expires: '90' })
const madeToken = ref<string | null>(null)
const tokenCopied = ref(false)
const addressCopied = ref(false)
function openToken() {
  Object.assign(newToken, { name: '', write: false, publish: false, delete: false, media: false, scope: 'all', entities: [], expires: '90' })
  Object.keys(tokenErrors).forEach((k) => delete tokenErrors[k])
  madeToken.value = null
  tokenCopied.value = false
  tokenOpen.value = true
}
function closeToken() {
  tokenOpen.value = false
}
// The value lives only in the dialog: forgotten when it closes.
watch(tokenOpen, (open) => { if (!open) madeToken.value = null })
const expiryItems = computed(() => [
  { value: '30', label: t('account.tokens.days30') },
  { value: '90', label: t('account.tokens.days90') },
  { value: '365', label: t('account.tokens.days365') },
  { value: 'never', label: t('account.tokens.never') },
])
async function makeToken() {
  Object.keys(tokenErrors).forEach((k) => delete tokenErrors[k])
  if (!newToken.name.trim()) {
    tokenErrors.name = t('validation.required')
    return
  }
  if (newToken.scope === 'some' && !newToken.entities.length) {
    tokenErrors.entities = t('account.tokens.scopePick')
    return
  }
  tokenBusy.value = true
  try {
    const res = await $fetch<{ value: string }>('/api/cms/_auth/tokens', {
      method: 'POST',
      body: {
        name: newToken.name.trim(),
        rights: {
          write: newToken.write,
          publish: newToken.write && newToken.publish,
          delete: newToken.write && newToken.delete,
          media: newToken.write && newToken.media,
          entities: newToken.scope === 'some' ? newToken.entities : null,
        },
        expiresInDays: newToken.expires === 'never' ? null : Number(newToken.expires),
      },
    })
    madeToken.value = res.value
    await refreshTokens()
  }
  catch (err: any) {
    toast.add({ title: t('account.tokens.failed'), description: cmsRequestError(err, t as any), color: 'error', icon: 'i-lucide-x' })
  }
  finally {
    tokenBusy.value = false
  }
}
async function copyText(value: string, which: 'address' | 'token') {
  const done = which === 'address' ? addressCopied : tokenCopied
  try {
    await navigator.clipboard.writeText(value)
    done.value = true
    setTimeout(() => { done.value = false }, 2000)
  }
  catch {
    toast.add({ title: t('account.tokens.copyFailed'), color: 'warning', icon: 'i-lucide-clipboard-x' })
  }
}
async function revokeToken(token: AccessToken) {
  const ok = await confirm({ title: t('account.tokens.revokeTitle', { name: token.name }), description: t('account.tokens.revokeBody'), confirmLabel: t('account.tokens.revoke'), color: 'error' })
  if (!ok) return
  try {
    await $fetch(`/api/cms/_auth/tokens/${token.id}`, { method: 'DELETE' })
    toast.add({ title: t('account.tokens.revoked'), icon: 'i-lucide-check', color: 'success' })
    await refreshTokens()
  }
  catch (err: any) {
    toast.add({ title: t('team.actionFailed'), description: cmsRequestError(err, t as any), color: 'error', icon: 'i-lucide-x' })
  }
}
/** What a token may do, in a few words. */
function rightBadges(r: TokenRights): string[] {
  if (!r.write) return [t('account.tokens.readOnly')]
  return [t('account.tokens.edit'), ...(r.publish ? [t('account.tokens.publishBadge')] : []), ...(r.delete ? [t('account.tokens.deleteBadge')] : []), ...(r.media ? [t('account.tokens.filesBadge')] : [])]
}
</script>

<template>
  <CmsPage :title="t('account.title')" narrow :breadcrumbs="[{ label: t('nav.home'), to: '/admin' }, { label: t('account.title') }]">
    <!-- the same sections as every form: a cream tile, a heading, the fields -->
    <div class="cms-form max-w-[40rem]">
      <div class="cms-form__body">
        <section class="cms-section !pt-2 !border-t-0" aria-labelledby="account-profile">
          <header class="cms-section__head">
            <span class="cms-section__tile"><UIcon name="i-lucide-user-round" class="size-4" /></span>
            <div class="min-w-0">
              <h2 id="account-profile" class="cms-section__title">{{ t('account.profile') }}</h2>
              <p class="text-sm text-muted text-pretty">{{ t('account.profileDescription') }}</p>
            </div>
          </header>
          <form method="post" ref="profileForm" class="cms-section__fields" novalidate @submit.prevent="saveProfile">
            <UFormField :label="t('auth.name')" name="name" :error="profileErrors.name || undefined">
              <UInput v-model="profile.name" autocomplete="name" :disabled="isDemo" class="w-full" />
              <template #error="{ error }"><span v-if="error" role="alert">{{ error }}</span></template>
            </UFormField>
            <UFormField :label="t('account.language')" name="locale">
              <USelect v-model="profile.locale" icon="i-lucide-languages" :items="locales.map((code: string) => ({ value: code, label: CMS_ADMIN_LOCALES[code] ?? code }))" class="w-full sm:w-60" />
            </UFormField>
            <div>
              <UButton type="submit" :loading="savingProfile">{{ t('common.save') }}</UButton>
            </div>
          </form>
        </section>

        <section class="cms-section" aria-labelledby="account-email">
          <header class="cms-section__head">
            <span class="cms-section__tile"><UIcon name="i-lucide-mail" class="size-4" /></span>
            <div class="min-w-0">
              <h2 id="account-email" class="cms-section__title">{{ t('account.signInEmail') }}</h2>
              <p class="text-sm text-muted text-pretty">{{ t('account.signInEmailDescription') }}</p>
            </div>
          </header>
          <div class="cms-section__fields">
            <UFormField :label="t('account.currentEmail')" name="currentEmail">
              <UInput :model-value="user?.email ?? ''" disabled icon="i-lucide-mail" class="w-full" />
            </UFormField>
            <p v-if="access?.account?.enabled && accountSites.loaded" class="flex items-start gap-2 text-sm text-muted text-pretty" data-cms-account-link>
              <UIcon :name="accountSites.linked ? 'i-lucide-link' : 'i-lucide-unlink'" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{{ accountSites.linked ? t('account.accountConnected') : t('account.accountNotConnected') }}</span>
            </p>
            <UAlert v-if="isDemo" color="neutral" variant="subtle" icon="i-lucide-info" :title="t('account.demoTitle')" :description="t('account.demoEmail')" />
            <template v-else>
              <!-- a change waiting for its link: what was sent where, what to do if it does not arrive -->
              <UAlert
                v-if="pendingEmail" color="info" variant="subtle" icon="i-lucide-mail-check" role="status"
                :title="t('account.emailPendingTitle', { email: pendingEmail.email })"
              >
                <template #description>
                  <p class="text-pretty">{{ t('account.emailPendingBody') }}</p>
                  <p class="mt-2 text-pretty">{{ t('account.emailNotArrived') }}</p>
                  <UButton class="mt-3" color="neutral" variant="outline" size="sm" icon="i-lucide-x" :loading="cancellingEmail" @click="cancelEmailChange">{{ t('account.cancelEmailChange') }}</UButton>
                </template>
              </UAlert>
              <form method="post" ref="emailForm" class="space-y-5" novalidate @submit.prevent="requestEmailChange">
                <UFormField :label="t('account.newEmail')" name="email" :error="emailErrors.email || undefined" required>
                  <UInput v-model="emailChange.email" type="email" autocomplete="email" inputmode="email" class="w-full" />
                  <template #error="{ error }"><span v-if="error" role="alert">{{ error }}</span></template>
                </UFormField>
                <UFormField :label="t('account.passwordToConfirm')" name="password" :help="t('account.passwordToConfirmHint')" :error="emailErrors.password || undefined" required>
                  <CmsPasswordInput v-model="emailChange.password" autocomplete="current-password" />
                  <template #error="{ error }"><span v-if="error" role="alert">{{ error }}</span></template>
                </UFormField>
                <div>
                  <UButton type="submit" color="neutral" variant="outline" icon="i-lucide-send" :loading="savingEmail">{{ t('account.changeEmail') }}</UButton>
                </div>
              </form>
            </template>
          </div>
        </section>

        <section class="cms-section" aria-labelledby="account-password">
          <header class="cms-section__head">
            <span class="cms-section__tile"><UIcon name="i-lucide-key-round" class="size-4" /></span>
            <div class="min-w-0">
              <h2 id="account-password" class="cms-section__title">{{ t('account.password') }}</h2>
              <p class="text-sm text-muted text-pretty">{{ t('account.passwordDescription') }}</p>
            </div>
          </header>
          <UAlert v-if="isDemo" color="neutral" variant="subtle" icon="i-lucide-info" :title="t('account.demoTitle')" :description="t('account.demoBody')" />
          <form v-else method="post" ref="pwForm" class="cms-section__fields" novalidate @submit.prevent="changePassword">
            <UFormField :label="t('account.currentPassword')" name="current" :error="pwErrors.current || undefined">
              <CmsPasswordInput v-model="pw.current" autocomplete="current-password" />
              <template #error="{ error }"><span v-if="error" role="alert">{{ error }}</span></template>
            </UFormField>
            <UFormField :label="t('account.newPassword')" name="password" :help="t('auth.passwordHint')" :error="pwErrors.password || undefined">
              <CmsPasswordInput v-model="pw.password" autocomplete="new-password" />
              <template #error="{ error }"><span v-if="error" role="alert">{{ error }}</span></template>
            </UFormField>
            <div>
              <UButton type="submit" color="neutral" variant="outline" :loading="savingPw">{{ t('account.changePassword') }}</UButton>
            </div>
          </form>
        </section>
        <section v-if="tokenState && !isDemo" class="cms-section" aria-labelledby="account-tokens">
          <header class="cms-section__head">
            <span class="cms-section__tile"><UIcon name="i-lucide-plug" class="size-4" /></span>
            <div class="min-w-0 flex-1">
              <h2 id="account-tokens" class="cms-section__title">{{ t('account.tokens.title') }}</h2>
              <p class="text-sm text-muted text-pretty">{{ t('account.tokens.description') }}</p>
            </div>
          </header>
          <div class="cms-section__fields">
            <UFormField :label="t('account.tokens.address')" name="mcpAddress">
              <UInput :model-value="mcpAddress" readonly class="w-full font-mono" :ui="{ trailing: 'pe-1' }">
                <template #trailing>
                  <UButton
                    color="neutral" variant="link" size="sm" :icon="addressCopied ? 'i-lucide-check' : 'i-lucide-copy'"
                    :aria-label="t('account.tokens.copyAddress')" @click="copyText(mcpAddress, 'address')"
                  />
                </template>
              </UInput>
            </UFormField>
            <ul v-if="tokenState.tokens.length" class="divide-y divide-default rounded-lg border border-default">
              <li v-for="tk in tokenState.tokens" :key="tk.id" class="flex items-start gap-3 px-3 py-2.5">
                <div class="min-w-0 flex-1">
                  <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span class="truncate font-medium text-highlighted">{{ tk.name }}</span>
                    <UBadge v-for="b in rightBadges(tk.rights)" :key="b" :label="b" color="neutral" variant="subtle" size="sm" />
                  </p>
                  <p class="mt-0.5 text-xs text-muted">
                    <template v-if="tk.origin === 'oauth'">{{ t('account.tokens.signedInFrom', { client: tk.client ?? '' }) }}</template>
                    <span v-else class="font-mono">{{ tk.prefix }}…</span>
                    · <template v-if="tk.lastUsedAt"><CmsTime :value="tk.lastUsedAt" relative v-slot="{ text }">{{ t('account.tokens.usedAt', { time: text }) }}</CmsTime></template>
                    <template v-else>{{ t('account.tokens.neverUsed') }}</template>
                    <template v-if="tk.expiresAt"> · {{ t('account.tokens.until', { date: formatDateWith(tk.expiresAt, { dateStyle: 'medium' }) }) }}</template>
                  </p>
                  <p v-if="tk.rights.entities" class="mt-0.5 text-xs text-muted text-pretty">
                    {{ t('account.tokens.only', { list: tk.rights.entities.map(areaLabel).join(', ') }) }}
                  </p>
                </div>
                <UButton color="neutral" variant="ghost" size="sm" :aria-label="`${t('account.tokens.revoke')}: ${tk.name}`" @click="revokeToken(tk)">{{ t('account.tokens.revoke') }}</UButton>
              </li>
            </ul>
            <p v-else class="text-sm text-muted">{{ t('account.tokens.none') }}</p>
            <div>
              <UButton color="neutral" variant="outline" icon="i-lucide-plus" :disabled="tokenState.tokens.length >= tokenState.max" @click="openToken">{{ t('account.tokens.new') }}</UButton>
            </div>
          </div>
        </section>
      </div>
    </div>

    <UModal v-model:open="tokenOpen" :title="madeToken ? t('account.tokens.madeTitle') : t('account.tokens.new')" :dismissible="!madeToken || tokenCopied">
      <template #body>
        <form v-if="!madeToken && tokenState" id="new-token" method="post" class="space-y-5" novalidate @submit.prevent="makeToken">
          <UFormField :label="t('account.tokens.name')" name="name" :help="t('account.tokens.nameHint')" :error="tokenErrors.name || undefined" required>
            <UInput v-model="newToken.name" maxlength="80" autofocus :placeholder="t('account.tokens.namePlaceholder')" class="w-full" />
            <template #error="{ error }"><span v-if="error" role="alert">{{ error }}</span></template>
          </UFormField>
          <CmsTokenRights v-model="newToken" :can="tokenState.can" :areas="tokenState.areas" :entities-error="tokenErrors.entities" />
          <UFormField :label="t('account.tokens.expires')" name="expires">
            <USelect v-model="newToken.expires" :items="expiryItems" class="w-full sm:w-60" />
          </UFormField>
        </form>
        <div v-else-if="madeToken" class="space-y-3">
          <p class="text-sm text-toned text-pretty">{{ t('account.tokens.madeBody') }}</p>
          <div class="flex items-center gap-2 rounded-lg bg-elevated p-3">
            <code class="min-w-0 flex-1 select-all break-all font-mono text-sm text-highlighted">{{ madeToken }}</code>
            <UButton
              color="neutral" variant="outline" size="sm" :icon="tokenCopied ? 'i-lucide-check' : 'i-lucide-copy'"
              @click="copyText(madeToken, 'token')"
            >{{ tokenCopied ? t('account.tokens.copied') : t('account.tokens.copy') }}</UButton>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <template v-if="!madeToken">
            <UButton color="neutral" variant="ghost" @click="closeToken">{{ t('common.cancel') }}</UButton>
            <UButton type="submit" form="new-token" :loading="tokenBusy">{{ t('account.tokens.create') }}</UButton>
          </template>
          <UButton v-else @click="closeToken">{{ t('account.tokens.done') }}</UButton>
        </div>
      </template>
    </UModal>
  </CmsPage>
</template>
