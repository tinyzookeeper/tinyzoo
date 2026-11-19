// The analytics plugin's tracker (tracker.ts) for `mode: 'strict'`: it sends nothing until the
// visitor allows statistics in the cookie banner (the consent plugin's store, `$cmsConsent`).
import { startTracker } from './tracker'

interface ConsentStore {
  state: { ready: boolean }
  granted: (category: string) => boolean
  onChange: (cb: () => void) => () => void
}

export default defineNuxtPlugin((nuxtApp) => {
  // Read when needed: the consent plugin's app plugin may run after this one.
  const store = () => (nuxtApp as any).$cmsConsent as ConsentStore | undefined
  startTracker({
    mounted: (cb) => nuxtApp.hook('app:mounted', cb),
    pageFinish: (cb) => nuxtApp.hook('page:finish', cb),
  }, {
    gate: {
      ready: () => !!store()?.state.ready,
      granted: () => !!store()?.granted('analytics'),
      onChange: (cb) => { store()?.onChange(cb) },
    },
  })
})
