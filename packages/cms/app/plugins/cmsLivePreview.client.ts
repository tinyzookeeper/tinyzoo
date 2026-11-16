// Live preview on the website. Inside the admin's preview panel (an iframe with
// ?preview), the page refetches its content whenever the editor types: the admin has
// already handed the unsaved values to the server, and the content API lays them over
// the entry for that editor's ?preview requests (server/utils/cmsPreviewDraft.ts).
// Any page that loads its content through the content API with ?preview updates
// without code of its own; scroll position and page state stay as they are.
//
// A site that renders from something else can listen too: the message is
// { type: 'cms:preview', entity, id, locale, data } with the form's values.
export default defineNuxtPlugin(() => {
  if (window.parent === window) return
  if (!new URLSearchParams(location.search).has('preview')) return
  let timer: ReturnType<typeof setTimeout> | undefined
  window.addEventListener('message', (e: MessageEvent) => {
    if (e.origin !== location.origin || e.source !== window.parent) return
    if (e.data?.type !== 'cms:preview') return
    clearTimeout(timer)
    timer = setTimeout(() => { refreshNuxtData() }, 30)
  })
})
