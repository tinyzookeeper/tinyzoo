<script setup lang="ts">
// The ready-made cookie banner and its settings dialog, for the website (needs `consentPlugin()`
// from `tinyzoo/consent`). Optional: it is built on useConsent() only, and a site can build its
// own banner on that instead. Place it once, in app.vue:
//
//   <CmsConsent />                    // texts in the page's language (<html lang>)
//   <CmsConsent locale="en" />
//   <CmsConsent unstyled />           // the markup and its classes, without the default styles
//
// The banner shows until the visitor chooses: "Reject all" and "Accept all" side by side, the
// same size and style, and "Settings" for a switch per category, each with its services and
// cookies. The texts come from the admin (Cookie banner settings), else the standard ones. A
// "Cookie settings" link elsewhere opens the dialog with useConsent().open().
//
// Slots, each given the whole useConsent() (unwrapped, as in a template): `banner` (the banner's
// content), `actions` (its buttons), `settings` (the dialog's content), `category` (one row of
// the settings, also given `category`), `settings-actions` (the dialog's buttons), and `default`
// (everything: nothing of the component's own is drawn).
//
// Plain HTML (a region, a native <dialog>, buttons, checkboxes as switches) with default
// styles in the base layer, themed by CSS variables (--cms-consent-bg, -fg, -button-bg,
// -button-fg, -border, -radius, -font, -width, -z): the site's own CSS wins without fighting,
// and the defaults follow the page's light or dark colours (Canvas, CanvasText).
// Nothing is shown while the page renders on the server, nor in the admin.
import type { UnwrapNestedRefs } from 'vue'
import type { CmsConsentApi, CmsConsentCategory, CmsConsentProps } from '../../src/frontend'
import { initialConsentState, type ConsentRuntime, type ConsentState } from '../app/runtime'

const props = defineProps<CmsConsentProps>()

type Api = UnwrapNestedRefs<CmsConsentApi>
defineSlots<{
  default?: (p: Api) => any
  banner?: (p: Api) => any
  actions?: (p: Api) => any
  settings?: (p: Api) => any
  category?: (p: Api & { category: CmsConsentCategory }) => any
  'settings-actions'?: (p: Api) => any
}>()

const consent = useConsent()
// What the slots get: the same API, its refs unwrapped.
const api = reactive(consent) as Api
const texts = consent.texts
const categories = consent.categories
const saving = consent.saving

const runtime = useNuxtApp().$cmsConsent as ConsentRuntime | undefined
const state = useState<ConsentState>('cms-consent', initialConsentState)
const route = useRoute()
const uid = useId()

const mounted = ref(false)
const inAdmin = computed(() => route.path === '/admin' || route.path.startsWith('/admin/'))
const showBanner = computed(() => mounted.value && !inAdmin.value && consent.bannerVisible.value)
const showDialog = computed(() => mounted.value && !inAdmin.value && categories.value.length > 0)
const styled = computed(() => (props.unstyled ? undefined : 'cms-consent-styled'))

const bannerEl = ref<HTMLElement | null>(null)
const dialogEl = ref<HTMLDialogElement | null>(null)
let returnFocus: HTMLElement | null = null

onMounted(() => {
  mounted.value = true
})

// A language given to the component, rather than the page's.
let askedLocale = ''
watch([() => props.locale, () => state.value.ready], ([locale, ready]) => {
  if (!ready || !locale || locale === askedLocale || inAdmin.value) return
  askedLocale = locale
  if (locale !== state.value.config?.locale) void runtime?.load(locale)
}, { immediate: true })

// The banner, when it appears on a page nobody has started using: focus on it, so a keyboard
// or screen reader reaches it first (without scrolling the page).
watch(showBanner, async (shown) => {
  if (!shown) return
  await nextTick()
  if (!document.activeElement || document.activeElement === document.body) bannerEl.value?.focus({ preventScroll: true })
})

// The dialog: a modal <dialog> (focus stays inside, the page behind is inert); Escape and the
// close button close it without saving; focus goes back where it was.
watch(() => consent.settingsOpen.value && showDialog.value, async (open) => {
  await nextTick()
  const d = dialogEl.value
  if (!d) return
  if (open && !d.open) {
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    d.showModal()
  }
  else if (!open && d.open) {
    d.close()
  }
})
function onDialogClosed() {
  consent.close()
  const back = returnFocus && returnFocus.isConnected ? returnFocus : bannerEl.value
  returnFocus = null
  back?.focus({ preventScroll: true })
}
const toggle = (key: string, e: Event) => consent.set(key, (e.target as HTMLInputElement).checked)
</script>

<template>
  <slot v-if="$slots.default" v-bind="api" />
  <Teleport v-else to="body">
    <div
      v-if="showBanner" ref="bannerEl" class="cms-consent" :class="styled" role="dialog" aria-modal="false"
      :aria-labelledby="$slots.banner ? undefined : `${uid}-title`" :aria-describedby="$slots.banner ? undefined : `${uid}-body`"
      :aria-label="$slots.banner ? texts.title : undefined" tabindex="-1"
    >
      <slot name="banner" v-bind="api">
        <h2 :id="`${uid}-title`" class="cms-consent__title">{{ texts.title }}</h2>
        <p :id="`${uid}-body`" class="cms-consent__body">
          {{ texts.body }}
          <a v-if="texts.privacyUrl" :href="texts.privacyUrl" class="cms-consent__link">{{ texts.privacyLabel }}</a>
        </p>
        <div class="cms-consent__actions">
          <slot name="actions" v-bind="api">
            <!-- the same size and style: neither answer is the easier one -->
            <button type="button" class="cms-consent__btn" :disabled="saving" @click="consent.rejectAll()">{{ texts.rejectAll }}</button>
            <button type="button" class="cms-consent__btn" :disabled="saving" @click="consent.acceptAll()">{{ texts.acceptAll }}</button>
            <button type="button" class="cms-consent__btn cms-consent__btn--quiet" aria-haspopup="dialog" @click="consent.open()">{{ texts.settings }}</button>
          </slot>
        </div>
      </slot>
    </div>

    <dialog
      v-if="showDialog" ref="dialogEl" class="cms-consent__dialog" :class="styled"
      :aria-labelledby="$slots.settings ? undefined : `${uid}-settings`" :aria-label="$slots.settings ? texts.settingsTitle : undefined"
      @cancel.prevent="consent.close()" @close="onDialogClosed"
    >
      <slot name="settings" v-bind="api">
        <form class="cms-consent__form" @submit.prevent="consent.save()">
          <div class="cms-consent__head">
            <h2 :id="`${uid}-settings`" class="cms-consent__title">{{ texts.settingsTitle }}</h2>
            <button type="button" class="cms-consent__close" :aria-label="texts.close" @click="consent.close()">
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <ul class="cms-consent__list">
            <li v-for="c in categories" :key="c.key" class="cms-consent__cat">
              <slot name="category" v-bind="api" :category="c">
                <div class="cms-consent__cat-row">
                  <div class="cms-consent__cat-text">
                    <span :id="`${uid}-${c.key}`" class="cms-consent__cat-label">{{ c.label }}</span>
                    <span v-if="c.description" :id="`${uid}-${c.key}-about`" class="cms-consent__cat-about">{{ c.description }}</span>
                  </div>
                  <div class="cms-consent__cat-control">
                    <span class="cms-consent__toggle">
                      <input
                        type="checkbox" role="switch" class="cms-consent__toggle-input" :name="c.key"
                        :checked="c.required || api.draft[c.key] === true" :disabled="c.required"
                        :aria-labelledby="`${uid}-${c.key}`" :aria-describedby="c.description ? `${uid}-${c.key}-about` : undefined"
                        @change="toggle(c.key, $event)"
                      >
                      <span class="cms-consent__toggle-track" aria-hidden="true" />
                    </span>
                    <span v-if="c.required" class="cms-consent__always">{{ texts.alwaysOn }}</span>
                  </div>
                </div>
                <details v-if="c.services.length" class="cms-consent__services">
                  <summary class="cms-consent__services-toggle">{{ texts.services }} ({{ c.services.length }})</summary>
                  <ul class="cms-consent__service-list">
                    <li v-for="s in c.services" :key="s.name" class="cms-consent__service">
                      <span class="cms-consent__service-name">{{ s.name }}</span>
                      <span v-if="s.purpose" class="cms-consent__service-purpose">{{ s.purpose }}</span>
                      <dl class="cms-consent__facts">
                        <template v-if="s.provider">
                          <dt>{{ texts.provider }}</dt>
                          <dd>{{ s.provider }}</dd>
                        </template>
                        <template v-if="s.cookies.length">
                          <dt>{{ texts.cookies }}</dt>
                          <dd>{{ s.cookies.join(', ') }}</dd>
                        </template>
                        <template v-if="s.duration">
                          <dt>{{ texts.duration }}</dt>
                          <dd>{{ s.duration }}</dd>
                        </template>
                      </dl>
                      <a v-if="s.privacyUrl" :href="s.privacyUrl" class="cms-consent__link" target="_blank" rel="noopener">{{ texts.privacyLabel }}: {{ s.name }}</a>
                    </li>
                  </ul>
                </details>
              </slot>
            </li>
          </ul>
          <div class="cms-consent__foot">
            <p v-if="texts.privacyUrl" class="cms-consent__body">
              <a :href="texts.privacyUrl" class="cms-consent__link">{{ texts.privacyLabel }}</a>
            </p>
            <div class="cms-consent__actions">
              <slot name="settings-actions" v-bind="api">
                <button type="button" class="cms-consent__btn" :disabled="saving" @click="consent.rejectAll()">{{ texts.rejectAll }}</button>
                <button type="button" class="cms-consent__btn" :disabled="saving" @click="consent.acceptAll()">{{ texts.acceptAll }}</button>
                <button type="submit" class="cms-consent__btn cms-consent__btn--quiet" :disabled="saving">{{ texts.save }}</button>
              </slot>
            </div>
          </div>
        </form>
      </slot>
    </dialog>
  </Teleport>
</template>

<style>
/* Defaults only, in the base layer: they beat the browser's and Tailwind's resets, and any class,
   utility or unlayered CSS of the site's own wins over them. They apply under the class
   `cms-consent-styled` only, which `unstyled` leaves out; a slot's markup that uses the
   component's classes (`cms-consent__btn`) gets them too. Theme it with the variables; the
   colours default to the page's own (Canvas / CanvasText), light or dark. */
@layer base {
  .cms-consent-styled {
    --cms-consent-_bg: var(--cms-consent-bg, Canvas);
    --cms-consent-_fg: var(--cms-consent-fg, CanvasText);
    --cms-consent-_border: var(--cms-consent-border, color-mix(in srgb, var(--cms-consent-_fg) 18%, transparent));
    --cms-consent-_button-bg: var(--cms-consent-button-bg, var(--cms-consent-_fg));
    --cms-consent-_button-fg: var(--cms-consent-button-fg, var(--cms-consent-_bg));
    --cms-consent-_radius: var(--cms-consent-radius, 0.75rem);
    box-sizing: border-box;
    color: var(--cms-consent-_fg);
    background: var(--cms-consent-_bg);
    font-family: var(--cms-consent-font, inherit);
    font-size: 1rem;
    line-height: 1.5;
    border: 1px solid var(--cms-consent-_border);
    border-radius: var(--cms-consent-_radius);
    box-shadow: var(--cms-consent-shadow, 0 12px 40px rgb(0 0 0 / 0.18));
  }
  .cms-consent-styled * { box-sizing: border-box; }
  .cms-consent-styled.cms-consent {
    position: fixed;
    z-index: var(--cms-consent-z, 2147483000);
    inset-inline: 1rem;
    bottom: 1rem;
    margin-inline: auto;
    max-width: var(--cms-consent-width, 36rem);
    max-height: calc(100dvh - 2rem);
    overflow: auto;
    padding: 1.25rem;
  }
  .cms-consent-styled.cms-consent:focus { outline: none; }
  .cms-consent-styled.cms-consent:focus-visible { outline: 2px solid var(--cms-consent-_fg); outline-offset: 2px; }
  .cms-consent-styled .cms-consent__title { margin: 0 0 0.5rem; font-size: 1.125rem; font-weight: 700; line-height: 1.3; color: inherit; }
  .cms-consent-styled .cms-consent__body { margin: 0 0 1rem; font-size: 0.9375rem; }
  .cms-consent-styled .cms-consent__link { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
  .cms-consent-styled .cms-consent__link:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; border-radius: 2px; }
  .cms-consent-styled .cms-consent__actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .cms-consent-styled .cms-consent__btn {
    flex: 1 1 9rem;
    min-height: 2.75rem;
    margin: 0;
    padding: 0.625rem 1rem;
    border: 1.5px solid var(--cms-consent-_button-bg);
    border-radius: calc(var(--cms-consent-_radius) * 0.66);
    background: var(--cms-consent-_button-bg);
    color: var(--cms-consent-_button-fg);
    font: inherit;
    font-weight: 600;
    line-height: 1.25;
    cursor: pointer;
  }
  .cms-consent-styled .cms-consent__btn--quiet { background: transparent; color: var(--cms-consent-_fg); border-color: var(--cms-consent-_border); }
  .cms-consent-styled .cms-consent__btn:hover { filter: brightness(1.08); }
  .cms-consent-styled .cms-consent__btn--quiet:hover { filter: none; background: color-mix(in srgb, var(--cms-consent-_fg) 7%, transparent); }
  .cms-consent-styled .cms-consent__btn:focus-visible { outline: 2px solid var(--cms-consent-_fg); outline-offset: 2px; }
  .cms-consent-styled .cms-consent__btn[disabled] { opacity: 0.6; cursor: progress; }

  .cms-consent-styled.cms-consent__dialog {
    width: min(36rem, calc(100vw - 1rem));
    max-width: none;
    max-height: min(88dvh, 48rem);
    margin: auto;
    padding: 0;
    overflow: hidden;
  }
  .cms-consent-styled.cms-consent__dialog::backdrop { background: var(--cms-consent-backdrop, rgb(0 0 0 / 0.45)); }
  .cms-consent-styled .cms-consent__form { display: flex; flex-direction: column; max-height: min(88dvh, 48rem); margin: 0; }
  .cms-consent-styled .cms-consent__head {
    display: flex; align-items: center; justify-content: space-between; gap: 1rem;
    padding: 0.75rem 0.75rem 0.75rem 1.25rem; border-bottom: 1px solid var(--cms-consent-_border);
  }
  .cms-consent-styled .cms-consent__head .cms-consent__title { margin: 0; }
  .cms-consent-styled .cms-consent__close {
    flex: none; width: 2.75rem; height: 2.75rem; margin: 0; padding: 0; border: 0; border-radius: 999px;
    background: transparent; color: inherit; font: inherit; font-size: 1.5rem; line-height: 1; cursor: pointer;
  }
  .cms-consent-styled .cms-consent__close:hover { background: color-mix(in srgb, var(--cms-consent-_fg) 7%, transparent); }
  .cms-consent-styled .cms-consent__close:focus-visible { outline: 2px solid var(--cms-consent-_fg); outline-offset: -2px; }
  .cms-consent-styled .cms-consent__list { list-style: none; margin: 0; padding: 0 1.25rem; overflow-y: auto; }
  .cms-consent-styled .cms-consent__cat { padding: 1rem 0; }
  .cms-consent-styled .cms-consent__cat + .cms-consent__cat { border-top: 1px solid var(--cms-consent-_border); }
  .cms-consent-styled .cms-consent__cat-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
  .cms-consent-styled .cms-consent__cat-text { display: grid; gap: 0.25rem; min-width: 0; }
  .cms-consent-styled .cms-consent__cat-label { font-weight: 600; }
  .cms-consent-styled .cms-consent__cat-about { font-size: 0.875rem; opacity: 0.8; }
  .cms-consent-styled .cms-consent__cat-control { flex: none; display: grid; justify-items: end; gap: 0.25rem; }
  .cms-consent-styled .cms-consent__always { font-size: 0.75rem; opacity: 0.8; white-space: nowrap; }
  .cms-consent-styled .cms-consent__toggle { position: relative; display: inline-flex; width: 2.75rem; height: 1.5rem; }
  .cms-consent-styled .cms-consent__toggle-input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; z-index: 1; }
  .cms-consent-styled .cms-consent__toggle-input:disabled { cursor: not-allowed; }
  .cms-consent-styled .cms-consent__toggle-track {
    position: relative; width: 100%; height: 100%; border-radius: 999px;
    border: 1.5px solid color-mix(in srgb, var(--cms-consent-_fg) 45%, transparent);
    background: transparent; transition: background-color 0.15s;
  }
  .cms-consent-styled .cms-consent__toggle-track::after {
    content: ''; position: absolute; top: 2px; left: 2px; width: calc(1.5rem - 7px); height: calc(1.5rem - 7px);
    border-radius: 999px; background: color-mix(in srgb, var(--cms-consent-_fg) 60%, transparent); transition: transform 0.15s;
  }
  .cms-consent-styled .cms-consent__toggle-input:checked + .cms-consent__toggle-track { background: var(--cms-consent-_button-bg); border-color: var(--cms-consent-_button-bg); }
  .cms-consent-styled .cms-consent__toggle-input:checked + .cms-consent__toggle-track::after { transform: translateX(1.25rem); background: var(--cms-consent-_button-fg); }
  .cms-consent-styled .cms-consent__toggle-input:disabled + .cms-consent__toggle-track { opacity: 0.55; }
  .cms-consent-styled .cms-consent__toggle-input:focus-visible + .cms-consent__toggle-track { outline: 2px solid var(--cms-consent-_fg); outline-offset: 2px; }
  .cms-consent-styled .cms-consent__services { margin-top: 0.5rem; font-size: 0.875rem; }
  .cms-consent-styled .cms-consent__services-toggle {
    display: inline-flex; align-items: center; min-height: 2.75rem; cursor: pointer;
    text-decoration: underline; text-underline-offset: 2px;
  }
  .cms-consent-styled .cms-consent__services-toggle:focus-visible { outline: 2px solid var(--cms-consent-_fg); outline-offset: 2px; border-radius: 2px; }
  .cms-consent-styled .cms-consent__service-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
  .cms-consent-styled .cms-consent__service {
    display: grid; gap: 0.25rem; padding: 0.75rem; border-radius: calc(var(--cms-consent-_radius) * 0.66);
    background: color-mix(in srgb, var(--cms-consent-_fg) 5%, transparent);
  }
  .cms-consent-styled .cms-consent__service-name { font-weight: 600; }
  .cms-consent-styled .cms-consent__service-purpose { opacity: 0.85; }
  .cms-consent-styled .cms-consent__facts { display: grid; grid-template-columns: auto 1fr; gap: 0.125rem 0.75rem; margin: 0.25rem 0 0; }
  .cms-consent-styled .cms-consent__facts dt { opacity: 0.7; }
  .cms-consent-styled .cms-consent__facts dd { margin: 0; overflow-wrap: anywhere; }
  .cms-consent-styled .cms-consent__foot { padding: 1rem 1.25rem; border-top: 1px solid var(--cms-consent-_border); }
  .cms-consent-styled .cms-consent__foot .cms-consent__body { margin-bottom: 0.75rem; }
  @media (max-width: 30rem) {
    .cms-consent-styled.cms-consent { inset-inline: 0.5rem; bottom: 0.5rem; padding: 1rem; max-height: calc(100dvh - 1rem); }
  }
  @media (prefers-reduced-motion: reduce) {
    .cms-consent-styled .cms-consent__toggle-track, .cms-consent-styled .cms-consent__toggle-track::after { transition: none; }
  }
}
</style>
