// A website form (tinyzoo's `defineForm`) without markup: the fields, the values, what the
// server refused and the sending. <CmsForm> draws one fixed form; a template with several looks
// draws its own fields from this and keeps everything else the same (the hidden field, the time
// the form was open, Cloudflare Turnstile when the site has a key).
//
//   const form = await useSiteForm('enquiry', 'cs')
//   <form :ref="form.el" novalidate @submit.prevent="form.submit">
//     <template v-for="f in form.fields.value" :key="f.key"> … v-model="form.values[f.key]" … </template>
//     <SiteFormExtras :form="form" />   ← the hidden field and Turnstile

export interface SiteFormField {
  key: string
  type: 'text' | 'number' | 'boolean' | 'select' | 'datetime'
  label: string
  help: string | null
  required: boolean
  multiline?: boolean
  format?: string | null
  max?: number | null
  default?: unknown
  options?: { value: string; label: string }[]
}

const MESSAGES = {
  cs: { invalid: 'Zkontrolujte prosím tuto hodnotu.', failed: 'Odeslání se nepovedlo. Zkuste to prosím znovu.', tooMany: 'Odeslali jste toho hodně najednou. Zkuste to prosím za pár minut.' },
  en: { invalid: 'Please check this value.', failed: 'Sending failed. Please try again.', tooMany: 'That was a lot at once. Please try again in a few minutes.' },
}

export async function useSiteForm(name: string, locale: MaybeRefOrGetter<string | undefined>) {
  const lang = computed(() => toValue(locale) || undefined)
  // (asked for now, waited for at the end: what follows has to be set up before the first `await`,
  // while the component that uses the form is still the one being set up)
  const request = useFetch<any>(`/api/content/_form/${name}`, { query: { locale: lang }, key: `site-form-${name}` })
  const schema = request.data

  const values = reactive<Record<string, any>>({})
  watch(schema, (s) => {
    for (const f of s?.fields ?? []) if (f.default != null && values[f.key] === undefined) values[f.key] = f.default
  }, { immediate: true })
  const errors = reactive<Record<string, string>>({})
  const sending = ref(false)
  const sent = ref(false)
  const failure = ref('')
  const el = ref<HTMLFormElement | null>(null)
  let openedAt = 0

  const words = computed(() => MESSAGES[(lang.value ?? schema.value?.locale ?? 'en').split('-')[0] as keyof typeof MESSAGES] ?? MESSAGES.en)

  onMounted(() => {
    openedAt = Date.now()
    const key = schema.value?.turnstileSiteKey
    if (key && !document.querySelector('script[data-cms-turnstile]')) {
      const s = document.createElement('script')
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      s.async = true
      s.defer = true
      s.dataset.cmsTurnstile = ''
      document.head.appendChild(s)
    }
  })

  async function submit(): Promise<void> {
    if (sending.value || !schema.value) return
    failure.value = ''
    for (const k of Object.keys(errors)) delete errors[k]
    const hp = (el.value?.elements.namedItem('website') as HTMLInputElement | null)?.value ?? ''
    const body: Record<string, any> = { _locale: lang.value ?? schema.value.locale, _hp: hp }
    for (const f of schema.value.fields as SiteFormField[]) {
      const v = values[f.key]
      body[f.key] = f.type === 'select' ? (v || null) : v ?? (f.type === 'boolean' ? false : '')
    }
    const turnstile = el.value?.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')
    if (turnstile) body['cf-turnstile-response'] = turnstile.value
    sending.value = true
    try {
      // Someone quick (autofill and Enter) waits a moment instead of looking like a robot.
      const wait = 1600 - (Date.now() - openedAt)
      if (wait > 0) await new Promise((r) => setTimeout(r, wait))
      body._t = Date.now() - openedAt
      await $fetch(`/api/content/_form/${name}`, { method: 'POST', body })
      sent.value = true
    }
    catch (err: any) {
      const issues = Array.isArray(err?.data?.data) ? err.data.data : []
      for (const i of issues) {
        const key = String(i?.path?.[0] ?? '')
        if (key) errors[key] = typeof i?.message === 'string' && i.message ? i.message : words.value.invalid
      }
      if (!issues.length) failure.value = err?.statusCode === 429 ? words.value.tooMany : words.value.failed
      nextTick(() => el.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
    }
    finally {
      sending.value = false
    }
  }

  await request

  return {
    name,
    /** The form element: `<form :ref="form.el">`. */
    el,
    fields: computed<SiteFormField[]>(() => schema.value?.fields ?? []),
    submitLabel: computed<string>(() => schema.value?.submitLabel ?? ''),
    successMessage: computed<string>(() => schema.value?.successMessage ?? ''),
    turnstileSiteKey: computed<string | null>(() => schema.value?.turnstileSiteKey ?? null),
    /** The form could not be read at all. */
    unavailable: computed(() => !!request.error.value || !schema.value),
    values, errors, sending, sent, failure, submit,
    /** An id for a field's input and its label. */
    id: (key: string) => `form-${name}-${key}`,
  }
}

export type SiteForm = Awaited<ReturnType<typeof useSiteForm>>
