// The visitor's cookie choice, for the site's own code (needs `consentPlugin()` from
// `tinyzoo/consent`, and <CmsConsent /> on the page to ask):
//
//   const { granted, decided, open, onChange } = useConsent()
//   <iframe v-if="granted('marketing')" src="https://www.youtube-nocookie.com/embed/…" />
//   <button v-else @click="open()">Allow videos</button>
//   <a href="#" @click.prevent="open()">Cookie settings</a>          (in the footer)
//   onChange((choice) => { if (choice?.marketing) loadPixel() })
//
// Reactive. While the page is rendered on the server, and until the browser has read the
// cookie, nothing but `necessary` is granted (`ready` is false): content that needs a consent
// appears in the browser only, so a page cached for everyone never carries one visitor's choice.
import type { CmsConsentApi, CmsConsentChoice } from '../../src/frontend'
import { grantedIn } from '../core/cookie'
import { initialConsentState, type ConsentRuntime, type ConsentState } from '../app/runtime'

export type { CmsConsentApi, CmsConsentChoice }

export function useConsent(): CmsConsentApi {
  const runtime = useNuxtApp().$cmsConsent as ConsentRuntime | undefined
  const state = useState<ConsentState>('cms-consent', initialConsentState)
  const choice = computed<CmsConsentChoice | null>(() => state.value.choice)
  const decided = computed(() => state.value.choice !== null)
  const ready = computed(() => state.value.ready)
  /** Whether the visitor allows a category: `necessary` always, the others once they said yes. */
  const granted = (category: string) => grantedIn(state.value.choice, category)
  /** Opens the settings, with a switch per category (a "Cookie settings" link in the footer). */
  const open = () => runtime?.open()
  /** Runs `cb(choice)` once the choice is known after the page loads, and whenever the visitor changes it; stops with the component. */
  const onChange = (cb: (choice: CmsConsentChoice | null) => void) => {
    const stop = runtime?.onChange(cb) ?? (() => {})
    if (getCurrentScope()) onScopeDispose(stop)
    return stop
  }
  return { choice, decided, ready, granted, open, onChange }
}
