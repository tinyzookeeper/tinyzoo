// Mark the document once the app is interactive (hydrated). The Playwright scripts wait for
// it before they click: a server-rendered button is on screen a moment before it works.
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:suspense:resolve', () => { document.documentElement.setAttribute('data-app-ready', '') })
})
