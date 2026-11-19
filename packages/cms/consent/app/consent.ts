// The consent plugin's app plugin: one store of the visitor's choice per app (runtime.ts),
// provided as `$cmsConsent` for <CmsConsent>, useConsent() and the analytics tracker. On the
// server it only provides the empty state; in the browser it reads the cookie once the app is
// mounted, then the texts in the page's language (<html lang>), and again when that changes.
// Nothing is read or asked in the admin.
import { createConsentRuntime, initialConsentState, type ConsentConfig, type ConsentState } from './runtime'

export default defineNuxtPlugin((nuxtApp) => {
  const state = useState<ConsentState>('cms-consent', initialConsentState)
  const runtime = createConsentRuntime(state.value, {
    readCookie: () => (import.meta.client ? document.cookie : ''),
    writeCookie: (c) => { if (import.meta.client) document.cookie = c },
    loadConfig: (locale) => $fetch<ConsentConfig>('/api/content/_consent/config', { query: locale ? { locale } : {} }),
    sendChoice: (body) => $fetch<{ id: string; cookie: string }>('/api/content/_consent/choice', { method: 'POST', body }),
    secure: import.meta.client && location.protocol === 'https:',
  })
  if (import.meta.client) {
    const admin = (path: string) => path === '/admin' || path.startsWith('/admin/')
    const lang = () => document.documentElement.lang || ''
    nuxtApp.hook('app:mounted', () => {
      if (!admin(location.pathname)) void runtime.start(lang())
    })
    // A page in another language (<html lang> is set once the page is in place).
    nuxtApp.hook('page:finish', () => {
      setTimeout(() => {
        if (state.value.ready && !admin(location.pathname) && state.value.config?.locale !== null && lang() && lang() !== state.value.config?.locale) void runtime.load(lang())
      }, 0)
    })
  }
  return { provide: { cmsConsent: runtime } }
})
