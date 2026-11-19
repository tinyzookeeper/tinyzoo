// The visitor's cookie choice, for the site's own code, and everything a cookie banner needs
// (needs `consentPlugin()` from `tinyzoo/consent`). It works without <CmsConsent>: a site can
// build its own banner and settings on it, with its own markup and styles.
//
//   const { granted, open, onChange } = useConsent()
//   <iframe v-if="granted('marketing')" src="https://www.youtube-nocookie.com/embed/…" />
//   <button v-else @click="open()">Allow videos</button>
//   onChange((choice) => { if (choice?.marketing) loadPixel() })
//
//   // a banner of the site's own
//   const { bannerVisible, texts, acceptAll, rejectAll, open } = useConsent()
//   <div v-if="bannerVisible">{{ texts.title }} <button @click="rejectAll()">{{ texts.rejectAll }}</button> …</div>
//
//   // its settings
//   const { settingsOpen, categories, draft, save, close } = useConsent()
//   <input v-for="c in categories" v-model="draft[c.key]" type="checkbox" :disabled="c.required"> … <button @click="save()">
//
// Reactive. While the page is rendered on the server, and until the browser has read the
// cookie, nothing but `necessary` is granted (`ready` is false) and the banner is not shown:
// content that needs a consent appears in the browser only, so a page cached for everyone never
// carries one visitor's choice. Nothing is read or asked in the admin.
import type { CmsConsentApi, CmsConsentCategory, CmsConsentChoice, CmsConsentTexts } from '../../src/frontend'
import { grantedIn, NECESSARY } from '../core/cookie'
import { initialConsentState, type ConsentRuntime, type ConsentState } from '../app/runtime'

export type { CmsConsentApi, CmsConsentChoice }

const NO_TEXTS: CmsConsentTexts = {
  title: '', body: '', acceptAll: '', rejectAll: '', settings: '', save: '', settingsTitle: '', privacyLabel: '', privacyUrl: '',
  alwaysOn: '', close: '', services: '', provider: '', cookies: '', duration: '',
}

export function useConsent(): CmsConsentApi {
  const runtime = useNuxtApp().$cmsConsent as ConsentRuntime | undefined
  const state = useState<ConsentState>('cms-consent', initialConsentState)
  const choice = computed<CmsConsentChoice | null>(() => state.value.choice)
  const decided = computed(() => state.value.choice !== null)
  const ready = computed(() => state.value.ready)
  /** Whether the visitor allows a category: `necessary` always, the others once they said yes. */
  const granted = (category: string) => grantedIn(state.value.choice, category)
  /** Runs `cb(choice)` once the choice is known after the page loads, and whenever the visitor changes it; stops with the component. */
  const onChange = (cb: (choice: CmsConsentChoice | null) => void) => {
    const stop = runtime?.onChange(cb) ?? (() => {})
    if (getCurrentScope()) onScopeDispose(stop)
    return stop
  }
  // The runtime only starts outside the admin, in the browser: `ready` covers both.
  const bannerVisible = computed(() => state.value.ready && !!state.value.config && state.value.choice === null)
  const settingsOpen = computed(() => state.value.settingsOpen)
  const texts = computed<CmsConsentTexts>(() => state.value.config?.texts ?? NO_TEXTS)
  const categories = computed<CmsConsentCategory[]>(() => (state.value.config?.categories ?? []).map((c) => ({
    ...c,
    services: c.services ?? [],
    granted: c.key === NECESSARY || state.value.choice?.[c.key] === true,
  })))
  const done = Promise.resolve()
  return {
    choice,
    decided,
    ready,
    granted,
    onChange,
    bannerVisible,
    settingsOpen,
    open: () => runtime?.open(),
    close: () => runtime?.close(),
    texts,
    categories,
    draft: state.value.draft,
    set: (category: string, value: boolean) => runtime?.set(category, value),
    acceptAll: () => runtime?.acceptAll() ?? done,
    rejectAll: () => runtime?.rejectAll() ?? done,
    save: (c?: CmsConsentChoice) => (runtime ? (c ? runtime.save(c) : runtime.saveDraft()) : done),
    saving: computed(() => state.value.saving),
    error: computed(() => state.value.error),
  }
}
