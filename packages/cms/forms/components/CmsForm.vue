<script setup lang="ts">
// A website form from the CMS (defineForm), for the host site's pages:
//
//   <CmsForm name="contactForm" />                 // fields, labels and messages from cms.config
//   <CmsForm name="contactForm" locale="en" class="my-form" />
//
// Plain HTML (label, input, textarea, select, a button) with default styles in the base
// layer that follow the text colour (light or dark page), so the site's own CSS wins without
// fighting. Required fields carry a *, a choice with a default starts on it. Errors show per
// field, in the visitor's language (the server words them); the thank-you message replaces
// the form (slot `success`).
// Spam: a hidden field, the time the form was open, and Cloudflare Turnstile when the
// site key is configured.
const props = defineProps<{ name: string; locale?: string }>()
const emit = defineEmits<{ sent: [] }>()

// The site's language for this form (the CMS's default language when not given).
const locale = computed(() => props.locale || undefined)
const { data: schema, error: loadError } = await useFetch<any>(() => `/api/content/_form/${props.name}`, {
  query: { locale }, key: `cms-form-${props.name}-${props.locale ?? ''}`,
})

const values = reactive<Record<string, any>>({})
// A choice with a default starts on it (and has no empty option to go back to).
watch(schema, (s) => {
  for (const f of s?.fields ?? []) if (f.default != null && values[f.key] === undefined) values[f.key] = f.default
}, { immediate: true })
const errors = reactive<Record<string, string>>({})
const sending = ref(false)
const sent = ref(false)
const failure = ref('')
const openedAt = ref(0)
const formEl = ref<HTMLFormElement | null>(null)
onMounted(() => {
  openedAt.value = Date.now()
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

// The form's own messages in the website's language (Czech, English or German; English otherwise).
// What is wrong with a field comes from the server, already in the visitor's language.
const MESSAGES = {
  cs: {
    invalid: 'Zkontrolujte prosím tuto hodnotu.',
    failed: 'Odeslání se nepovedlo. Zkuste to prosím znovu.', tooMany: 'Odeslali jste toho hodně najednou. Zkuste to prosím za pár minut.',
  },
  en: {
    invalid: 'Please check this value.',
    failed: 'Sending failed. Please try again.', tooMany: 'That was a lot at once. Please try again in a few minutes.',
  },
  de: {
    invalid: 'Bitte prüfen Sie diesen Wert.',
    failed: 'Das Senden hat nicht geklappt. Bitte versuchen Sie es noch einmal.', tooMany: 'Das war viel auf einmal. Bitte versuchen Sie es in ein paar Minuten noch einmal.',
  },
}
const lang = computed(() => (locale.value ?? schema.value?.locale ?? 'en').split('-')[0] as keyof typeof MESSAGES)
const msg = (k: keyof typeof MESSAGES.en) => (MESSAGES[lang.value] ?? MESSAGES.en)[k]

const fid = (key: string) => `cms-form-${props.name}-${key}`

async function submit() {
  if (sending.value || !schema.value) return
  failure.value = ''
  for (const k of Object.keys(errors)) delete errors[k]
  const body: Record<string, any> = { _locale: lang.value, _t: Date.now() - openedAt.value, _hp: (formEl.value?.elements.namedItem('website') as HTMLInputElement | null)?.value ?? '' }
  for (const f of schema.value.fields) {
    const v = values[f.key]
    // An unchosen option is "nothing", not an empty text (which no option matches).
    body[f.key] = f.type === 'select' ? (v || null) : v ?? (f.type === 'boolean' ? false : '')
  }
  const turnstile = formEl.value?.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')
  if (turnstile) body['cf-turnstile-response'] = turnstile.value
  sending.value = true
  try {
    // Someone quick (autofill + Enter) waits a moment instead of looking like a robot.
    const wait = 1600 - (Date.now() - openedAt.value)
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    body._t = Date.now() - openedAt.value
    await $fetch(`/api/content/_form/${props.name}`, { method: 'POST', body })
    sent.value = true
    emit('sent')
  }
  catch (err: any) {
    const issues = Array.isArray(err?.data?.data) ? err.data.data : []
    for (const i of issues) {
      const key = String(i?.path?.[0] ?? '')
      if (!key) continue
      errors[key] = typeof i?.message === 'string' && i.message ? i.message : msg('invalid')
    }
    if (!issues.length) failure.value = err?.statusCode === 429 ? msg('tooMany') : msg('failed')
    nextTick(() => formEl.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
  }
  finally {
    sending.value = false
  }
}
</script>

<template>
  <div v-if="schema" class="cms-form">
    <div v-if="sent" class="cms-form__success" role="status">
      <slot name="success" :message="schema.successMessage">
        <p>{{ schema.successMessage }}</p>
      </slot>
    </div>
    <form v-else ref="formEl" novalidate :aria-label="schema.label" @submit.prevent="submit">
      <div v-for="f in schema.fields" :key="f.key" class="cms-form__field" :class="`cms-form__field--${f.type}`">
        <template v-if="f.type === 'boolean'">
          <label class="cms-form__check">
            <input :id="fid(f.key)" v-model="values[f.key]" type="checkbox" :name="f.key" :required="f.required" :aria-required="f.required || undefined" :aria-invalid="!!errors[f.key]" :aria-describedby="errors[f.key] ? `${fid(f.key)}-error` : undefined">
            <span>{{ f.label }}<span v-if="f.required" aria-hidden="true"> *</span></span>
          </label>
        </template>
        <template v-else>
          <label :for="fid(f.key)" class="cms-form__label">{{ f.label }}<span v-if="f.required" aria-hidden="true"> *</span></label>
          <textarea
            v-if="f.type === 'text' && f.multiline" :id="fid(f.key)" v-model="values[f.key]" :name="f.key" rows="5" :required="f.required" :maxlength="f.max ?? undefined"
            :aria-invalid="!!errors[f.key]" :aria-describedby="errors[f.key] ? `${fid(f.key)}-error` : f.help ? `${fid(f.key)}-help` : undefined"
          />
          <select
            v-else-if="f.type === 'select'" :id="fid(f.key)" v-model="values[f.key]" :name="f.key" :required="f.required"
            :aria-invalid="!!errors[f.key]" :aria-describedby="errors[f.key] ? `${fid(f.key)}-error` : f.help ? `${fid(f.key)}-help` : undefined"
          >
            <!-- a choice with a default has no empty option; a required one has an empty one nobody can send; an optional one may stay empty -->
            <option v-if="f.default == null" value="" :disabled="f.required" :selected="!values[f.key]">—</option>
            <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
          <input
            v-else :id="fid(f.key)" v-model="values[f.key]" :name="f.key" :required="f.required" :maxlength="f.max ?? undefined"
            :type="f.type === 'number' ? 'number' : f.type === 'datetime' ? 'date' : f.format === 'email' ? 'email' : f.format === 'url' ? 'url' : 'text'"
            :autocomplete="f.format === 'email' ? 'email' : f.key === 'name' ? 'name' : f.key === 'phone' ? 'tel' : undefined"
            :aria-invalid="!!errors[f.key]" :aria-describedby="errors[f.key] ? `${fid(f.key)}-error` : f.help ? `${fid(f.key)}-help` : undefined"
          >
        </template>
        <p v-if="f.help && !errors[f.key]" :id="`${fid(f.key)}-help`" class="cms-form__help">{{ f.help }}</p>
        <p v-if="errors[f.key]" :id="`${fid(f.key)}-error`" class="cms-form__error">{{ errors[f.key] }}</p>
      </div>
      <!-- people never see or fill this; robots do -->
      <div class="cms-form__hp" aria-hidden="true">
        <label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label>
      </div>
      <div v-if="schema.turnstileSiteKey" class="cf-turnstile" :data-sitekey="schema.turnstileSiteKey" />
      <p v-if="failure" class="cms-form__error" role="alert">{{ failure }}</p>
      <button type="submit" class="cms-form__submit" :disabled="sending" :aria-busy="sending">{{ schema.submitLabel }}</button>
    </form>
  </div>
  <p v-else-if="loadError" class="cms-form__error">{{ msg('failed') }}</p>
</template>

<style>
/* Defaults only, in the base layer: they beat the browser's and Tailwind's resets (one
   class), and any class, utility or unlayered CSS of the site's own wins over them. Colours
   follow the text colour (currentColor), so the form reads on a light and on a dark page. */
@layer base {
  .cms-form form { display: grid; gap: 1rem; }
  .cms-form__field { display: grid; gap: 0.375rem; }
  .cms-form__label { font-weight: 500; }
  .cms-form input:not([type='checkbox']), .cms-form textarea, .cms-form select {
    width: 100%; padding: 0.5rem 0.75rem; border: 1px solid color-mix(in srgb, currentColor 35%, transparent); border-radius: 0.375rem;
    font: inherit; background: transparent; color: inherit;
  }
  .cms-form option { background: Canvas; color: CanvasText; }
  .cms-form :is(input, textarea, select):focus-visible { outline: 2px solid currentColor; outline-offset: 1px; }
  /* More specific than the field rule above (which also matches an input), so a refused field is red. */
  .cms-form .cms-form__field [aria-invalid='true'] { border-color: var(--cms-form-error, color-mix(in srgb, #d93025 75%, currentColor)); }
  .cms-form .cms-form__field input[type='checkbox'][aria-invalid='true'] { outline: 2px solid var(--cms-form-error, color-mix(in srgb, #d93025 75%, currentColor)); outline-offset: 2px; }
  .cms-form__check { display: flex; gap: 0.5rem; align-items: flex-start; }
  .cms-form__help { font-size: 0.875em; opacity: 0.75; }
  .cms-form__error { font-size: 0.875em; color: var(--cms-form-error, color-mix(in srgb, #d93025 75%, currentColor)); }
  .cms-form__submit {
    justify-self: start; padding: 0.625rem 1.25rem; border: 1.5px solid currentColor; border-radius: 0.375rem;
    background: color-mix(in srgb, currentColor 8%, transparent); color: inherit; font: inherit; font-weight: 600; cursor: pointer;
  }
  .cms-form__submit:hover { background: color-mix(in srgb, currentColor 16%, transparent); }
  .cms-form__submit:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
  .cms-form__submit[disabled] { opacity: 0.6; cursor: progress; }
  .cms-form__hp { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }
}
</style>
