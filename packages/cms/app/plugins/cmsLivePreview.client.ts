// Live preview on the website. Inside the admin's preview panel (an iframe with
// ?preview), the page refetches its content whenever the editor types: the admin has
// already handed the unsaved values to the server, and the content API lays them over
// the entry for that editor's ?preview requests (server/utils/cmsPreviewDraft.ts).
// Any page that loads its content through the content API with ?preview updates
// without code of its own; scroll position and page state stay as they are.
//
// The editor in the preview (NUXT_CMS_BUILDER=on) starts here too: only when the admin sends
// `cms:builder:on` does the page load its overlay (builder/overlay.ts) and mark its blocks.
//
// A site that renders from something else can listen too: the message is
// { type: 'cms:preview', entity, id, locale, data } with the form's values.
import { isCmsBuilderToPage, type CmsBuilderToAdmin } from '../../shared/builder'
import { cmsBuilderOn } from '../builder/state'

export default defineNuxtPlugin(() => {
  if (window.parent === window) return
  if (!new URLSearchParams(location.search).has('preview')) return
  let timer: ReturnType<typeof setTimeout> | undefined
  window.addEventListener('message', (e: MessageEvent) => {
    if (e.origin !== location.origin || e.source !== window.parent) return
    if (isCmsBuilderToPage(e.data)) {
      const message = e.data
      if (message.type === 'cms:builder:on') cmsBuilderOn.value = true
      import('../builder/overlay').then((overlay) => overlay.handleCmsBuilderMessage(message))
      return
    }
    if (e.data?.type !== 'cms:preview') return
    clearTimeout(timer)
    timer = setTimeout(() => { refreshNuxtData() }, 30)
  })
  // The admin cannot tell when this listener exists (the frame's load event can come first).
  window.parent.postMessage({ type: 'cms:builder:ready' } satisfies CmsBuilderToAdmin, location.origin)
})
