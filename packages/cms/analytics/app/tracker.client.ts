// The analytics plugin's tracker (tracker.ts), for the modes `cookieless` and `consent`: it
// counts every visit the same way, without a cookie of its own.
import { startTracker } from './tracker'

export default defineNuxtPlugin((nuxtApp) => {
  startTracker({
    mounted: (cb) => nuxtApp.hook('app:mounted', cb),
    pageFinish: (cb) => nuxtApp.hook('page:finish', cb),
  })
})
