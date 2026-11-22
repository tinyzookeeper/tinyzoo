<script setup lang="ts">
import type { SlugCheck } from '#shared/api'
import { SLUG_MAX, slugProblem, suggestSlug, tidySlugInput } from '#shared/slug'
import { FIELDS, fieldsOf, templateById, visibleTemplates, type FieldId } from '#shared/templates'

// Create a website: a template, the site's name and address, and (signed out) an account.
// One route, three steps; what was typed survives a reload (kept in this browser, never the password).
const t = useT()
const l = useL()
const errorText = useErrorText()
const { locale } = useLocale()
const { account, signedIn, refresh } = useAccount()
const config = useRuntimeConfig()
useHead({ title: () => t('new.metaTitle') })

const showPlanned = String(config.public.showPlanned) === 'true'
const templates = visibleTemplates(showPlanned)
const fields = fieldsOf(templates)

interface Draft { step: number; template: string; name: string; slug: string; slugTouched: boolean; personName: string; email: string }
const KEY = 'tz-cloud-new'
const draft = reactive<Draft>({ step: 1, template: templates.find((x) => x.ready)?.id ?? '', name: '', slug: '', slugTouched: false, personName: '', email: '' })
const password = ref('')
const restored = ref(false)

onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Draft> | null
    if (saved && typeof saved === 'object') {
      if (typeof saved.template === 'string' && templateById(saved.template)?.ready) draft.template = saved.template
      if (typeof saved.name === 'string') draft.name = saved.name.slice(0, 80)
      if (typeof saved.slug === 'string') draft.slug = tidySlugInput(saved.slug)
      draft.slugTouched = saved.slugTouched === true
      if (typeof saved.personName === 'string') draft.personName = saved.personName.slice(0, 100)
      if (typeof saved.email === 'string') draft.email = saved.email.slice(0, 254)
      if (Number.isInteger(saved.step)) draft.step = Math.min(Math.max(saved.step!, 1), stepCount.value)
    }
  }
  catch { /* nothing kept */ }
  // Never land on a step whose earlier answers are missing.
  if (draft.step > 1 && !draft.template) draft.step = 1
  if (draft.step > 2 && (!draft.name.trim() || slugProblem(draft.slug))) draft.step = 2
  restored.value = true
  if (draft.slug) void check()
})
watch(draft, () => {
  if (!restored.value) return
  try { localStorage.setItem(KEY, JSON.stringify(draft)) } catch { /* private mode */ }
}, { deep: true })

const stepLabels = computed(() => [t('new.stepTemplate'), t('new.stepSite'), ...(signedIn.value ? [] : [t('new.stepAccount')])])
const stepCount = computed(() => stepLabels.value.length)
const atLimit = computed(() => signedIn.value && account.value.sites.used >= account.value.sites.max)

// ── step 1: the template ──
const field = ref<FieldId | 'all'>('all')
const pills = computed(() => [{ id: 'all' as const, label: t('new.allFields') }, ...fields.map((id) => ({ id, label: l(FIELDS[id]) }))])
const shown = computed(() => templates.filter((x) => field.value === 'all' || x.field === field.value))
const chosen = computed(() => templateById(draft.template))

// ── step 2: the name and the address ──
const slugState = ref<'idle' | 'checking' | 'ok' | 'bad'>('idle')
const slugIssue = ref<string | null>(null)
const slugSuggestion = ref<string | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null
let asked = 0

function onName() {
  if (!draft.slugTouched) draft.slug = suggestSlug(draft.name)
  scheduleCheck()
}
function onSlug(value: string) {
  draft.slug = tidySlugInput(value)
  draft.slugTouched = draft.slug.length > 0
  scheduleCheck()
}
function scheduleCheck() {
  if (timer) clearTimeout(timer)
  slugSuggestion.value = null
  if (!draft.slug) { slugState.value = 'idle'; slugIssue.value = null; return }
  // What the rules alone can tell is said at once; whether it is free is asked a moment later.
  const local = slugProblem(draft.slug.replace(/-+$/, '')) && slugProblem(draft.slug)
  if (local) { slugState.value = 'bad'; slugIssue.value = local; return }
  slugState.value = 'checking'
  timer = setTimeout(check, 280)
}
async function check() {
  const slug = draft.slug
  if (!slug || slugProblem(slug)) { if (slug) { slugState.value = 'bad'; slugIssue.value = slugProblem(slug) } return }
  const mine = ++asked
  slugState.value = 'checking'
  try {
    const res = await $fetch<SlugCheck>('/api/slug', { query: { slug } })
    if (mine !== asked || draft.slug !== slug) return
    slugState.value = res.ok ? 'ok' : 'bad'
    slugIssue.value = res.problem
    slugSuggestion.value = res.suggestion
  }
  catch {
    if (mine === asked) { slugState.value = 'idle'; slugIssue.value = null }
  }
}
function useSuggestion() {
  if (!slugSuggestion.value) return
  draft.slug = slugSuggestion.value
  draft.slugTouched = true
  void check()
}
const slugMessage = computed(() => {
  if (slugState.value !== 'bad' || !slugIssue.value) return ''
  const key = `slug.${slugIssue.value}` as const
  return t(key as any)
})
const address = computed(() => `${draft.slug || t('new.addressPlaceholder')}${account.value.siteHost}`)
const siteStepOk = computed(() => draft.name.trim().length > 0 && slugState.value === 'ok')

// ── step 3 and the end ──
const busy = ref(false)
const error = ref('')
const emailTaken = ref(false)
const accountOk = computed(() => draft.personName.trim().length > 0 && /.+@.+\..+/.test(draft.email) && password.value.length >= 10)

function go(step: number) {
  error.value = ''
  draft.step = step
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}
function next() {
  if (draft.step === 1 && chosen.value?.ready) return go(2)
  if (draft.step === 2 && siteStepOk.value) return signedIn.value ? create() : go(3)
  if (draft.step === 3 && accountOk.value) return create()
}

async function create() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  emailTaken.value = false
  try {
    if (!signedIn.value) {
      try {
        await $fetch('/api/auth/signup', { method: 'POST', body: { name: draft.personName.trim(), email: draft.email.trim(), password: password.value, locale: locale.value } })
      }
      catch (err: any) {
        emailTaken.value = err?.data?.data?.code === 'email.taken'
        throw err
      }
      await refresh()
    }
    const { site } = await $fetch<{ site: { id: string } }>('/api/sites', { method: 'POST', body: { name: draft.name.trim(), slug: draft.slug, template: draft.template } })
    try { localStorage.removeItem(KEY) } catch { /* nothing kept */ }
    restored.value = false
    await refresh()
    await navigateTo(`/sites/${site.id}`)
  }
  catch (err: any) {
    error.value = errorText(err, 'new.failed')
    // The address was taken meanwhile: back to the step where it is chosen.
    if (String(err?.data?.data?.code ?? '').startsWith('slug.')) { draft.step = 2; void check() }
  }
  finally {
    busy.value = false
  }
}

const peekers = computed(() => [
  { animal: chosen.value?.animal ?? 'elephant', up: true, busy: draft.step === 2 },
  { animal: 'chick', up: draft.name.trim().length > 0 },
  { animal: 'panda', up: draft.step === 3 || (signedIn.value && siteStepOk.value) },
])
</script>

<template>
  <div class="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
    <!-- The limit, explained, instead of a wizard that would end in a refusal. -->
    <ZEmpty v-if="atLimit" animal="turtle" :title="t('new.limitTitle', { max: account.sites.max })" :description="t('new.limitText', { max: account.sites.max })">
      <UButton to="/sites" :label="t('nav.sites')" size="lg" />
    </ZEmpty>

    <template v-else>
      <header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 class="z-display text-[1.75rem] leading-tight text-highlighted sm:text-4xl">{{ t('new.title') }}</h1>
        <WizardSteps :steps="stepLabels" :current="draft.step" @go="go" />
      </header>

      <!-- 1 · Template -->
      <section v-if="draft.step === 1" class="mt-8" data-step="template">
        <p class="max-w-2xl text-[0.9375rem] leading-relaxed text-pretty text-muted">{{ t('new.templateLead') }}</p>

        <template v-if="pills.length > 2">
          <!-- Phones: one row of pills to swipe (Embla, through UCarousel). Wider: they wrap. -->
          <nav class="mt-5 sm:hidden" :aria-label="t('new.fieldFilter')">
            <UCarousel v-slot="{ item }" :items="pills" align="start" drag-free contain-scroll="trimSnaps" :ui="{ container: '-ms-1.5', item: 'basis-auto ps-1.5' }">
              <button type="button" class="block rounded-full border px-3 py-1.5 text-sm whitespace-nowrap" :class="field === item.id ? 'border-transparent bg-(--ui-primary) font-medium text-inverted' : 'border-default text-toned'" :aria-pressed="field === item.id" @click="field = item.id">{{ item.label }}</button>
            </UCarousel>
          </nav>
          <nav class="mt-5 hidden flex-wrap gap-1.5 sm:flex" :aria-label="t('new.fieldFilter')">
            <button v-for="item in pills" :key="item.id" type="button" class="rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition" :class="field === item.id ? 'border-transparent bg-(--ui-primary) font-medium text-inverted' : 'border-default text-toned hover:border-(--ui-border-accented) hover:text-highlighted'" :aria-pressed="field === item.id" :data-field="item.id" @click="field = item.id">{{ item.label }}</button>
          </nav>
        </template>

        <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" :aria-label="t('new.stepTemplate')">
          <TemplateCard v-for="x in shown" :key="x.id" :template="x" :selected="draft.template === x.id" @pick="draft.template = $event" />
        </div>
        <p v-if="showPlanned" class="mt-4 text-sm text-dimmed">{{ t('new.plannedNote') }}</p>

        <div class="sticky bottom-0 -mx-4 mt-8 flex items-center justify-between gap-3 border-t border-default bg-(--ui-bg)/90 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <p class="min-w-0 truncate text-sm text-muted"><template v-if="chosen">{{ t('new.picked') }} <span class="font-medium text-highlighted">{{ l(chosen.name) }}</span></template></p>
          <UButton :label="t('new.continue')" size="lg" trailing-icon="i-lucide-arrow-right" :disabled="!chosen?.ready" data-next @click="next" />
        </div>
      </section>

      <!-- 2 · Your site, 3 · Your account: the form on the left, the site taking shape on the right. -->
      <section v-else class="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14">
        <form class="flex max-w-lg flex-col gap-6" novalidate @submit.prevent="next">
          <template v-if="draft.step === 2">
            <div data-step="site">
              <h2 class="z-title text-xl text-highlighted">{{ t('new.siteTitle') }}</h2>
              <p class="mt-1 text-[0.9375rem] text-pretty text-muted">{{ t('new.siteLead') }}</p>
            </div>
            <UFormField :label="t('new.name')" name="name" :help="t('new.nameHelp')">
              <UInput v-model="draft.name" size="xl" maxlength="80" autofocus class="w-full" :placeholder="t('new.namePlaceholder')" data-field-name @update:model-value="onName" />
            </UFormField>
            <UFormField :label="t('new.address')" name="slug" :error="slugMessage || undefined">
              <UInput :model-value="draft.slug" size="xl" :maxlength="SLUG_MAX" class="w-full" autocapitalize="none" autocorrect="off" spellcheck="false" :placeholder="t('new.addressPlaceholder')" :ui="{ base: 'font-mono', trailing: 'pe-3' }" data-field-slug @update:model-value="onSlug(String($event))">
                <template #trailing>
                  <span class="font-mono text-sm text-dimmed">{{ account.siteHost }}</span>
                </template>
              </UInput>
              <template #hint>
                <span v-if="slugState === 'checking'" class="inline-flex items-center gap-1.5 text-muted"><UIcon name="i-lucide-loader-circle" class="size-3.5 animate-spin" />{{ t('new.checking') }}</span>
                <span v-else-if="slugState === 'ok'" class="inline-flex items-center gap-1.5 font-medium text-success" data-slug-ok><UIcon name="i-lucide-check" class="size-3.5" />{{ t('new.free') }}</span>
              </template>
              <template #help>
                <span v-if="slugState !== 'bad'">{{ t('new.addressHelp') }}</span>
              </template>
            </UFormField>
            <p v-if="slugState === 'bad' && slugSuggestion" class="-mt-3 text-sm text-muted">
              {{ t('new.freeIs') }}
              <button type="button" class="font-mono font-medium text-highlighted underline decoration-(--ui-border-accented) underline-offset-4" @click="useSuggestion">{{ slugSuggestion }}</button>
            </p>
          </template>

          <template v-else>
            <div data-step="account">
              <h2 class="z-title text-xl text-highlighted">{{ t('new.accountTitle') }}</h2>
              <p class="mt-1 text-[0.9375rem] text-pretty text-muted">{{ t('new.accountLead') }}</p>
            </div>
            <UFormField :label="t('auth.name')" name="personName">
              <UInput v-model="draft.personName" size="xl" autocomplete="name" maxlength="100" autofocus class="w-full" data-field-person />
            </UFormField>
            <UFormField :label="t('auth.email')" name="email">
              <UInput v-model="draft.email" size="xl" type="email" autocomplete="username" maxlength="254" class="w-full" data-field-email />
            </UFormField>
            <UFormField :label="t('auth.password')" name="password" :help="t('auth.passwordHelp')">
              <UInput v-model="password" size="xl" type="password" autocomplete="new-password" minlength="10" maxlength="200" class="w-full" data-field-password />
            </UFormField>
          </template>

          <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-alert" :description="error" :actions="emailTaken ? [{ label: t('nav.signIn'), to: '/login?next=/new', color: 'neutral', variant: 'outline' }] : undefined" />

          <div class="flex items-center gap-3">
            <UButton :label="t('new.back')" color="neutral" variant="ghost" size="lg" icon="i-lucide-arrow-left" @click="go(draft.step - 1)" />
            <UButton
              type="submit" size="lg" class="ml-auto px-5" :loading="busy" data-next
              :label="draft.step === stepCount ? t('new.create') : t('new.continue')"
              :trailing-icon="draft.step === stepCount ? 'i-lucide-sparkles' : 'i-lucide-arrow-right'"
              :disabled="draft.step === 2 ? !siteStepOk : !accountOk"
            />
          </div>
          <p v-if="draft.step === stepCount" class="-mt-2 text-sm text-dimmed">{{ t('new.createNote') }}</p>
        </form>

        <!-- The site taking shape: its name in the header, its address in the bar. -->
        <aside class="z-moment px-5 pt-4 pb-8 sm:px-10 sm:pt-6 sm:pb-12 lg:sticky lg:top-20">
          <MiniSite :name="draft.name.trim() || t('new.namePlaceholder')" :address="address" :named="true" :peekers="peekers" />
          <dl class="mt-6 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
            <dt class="z-moment-text">{{ t('new.stepTemplate') }}</dt>
            <dd class="truncate text-right font-medium text-highlighted">{{ chosen ? l(chosen.name) : '—' }}</dd>
            <dt class="z-moment-text">{{ t('new.address') }}</dt>
            <dd class="truncate text-right font-mono text-[0.8125rem] text-highlighted">{{ address }}</dd>
          </dl>
        </aside>
      </section>
    </template>
  </div>
</template>
