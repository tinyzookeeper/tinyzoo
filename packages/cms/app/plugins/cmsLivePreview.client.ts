// Live preview on the website. Inside the admin's preview panel (an iframe with
// ?preview), the page refetches its content whenever the editor types: the admin has
// already handed the unsaved values to the server, and the content API lays them over
// the entry for that editor's ?preview requests (server/utils/cmsPreviewDraft.ts).
// Any page that loads its content through the content API with ?preview updates
// without code of its own; scroll position and page state stay as they are.
//
// The editor in the preview (NUXT_CMS_BUILDER=on) starts here too: only when the admin sends
// `cms:builder:on` does the page load its overlay (builder/overlay.ts) and mark its blocks, and
// keep what it loads through the content API (builder/sources.ts, since 2f).
//
// A site that renders from something else can listen too: the message is
// { type: 'cms:preview', entity, id, locale, data } with the form's values.
import { cmsBuilderNames, isCmsBuilderToPage, type CmsBuilderToAdmin } from '../../shared/builder'
import { cmsBuilderDraft, cmsBuilderHold, cmsBuilderOn, cmsBuilderWords } from '../builder/state'

export default defineNuxtPlugin((nuxtApp) => {
  if (window.parent === window) return
  if (!new URLSearchParams(location.search).has('preview')) return
  let timer: ReturnType<typeof setTimeout> | undefined
  // The admin may answer `ready` while the page is still hydrating: the switch (and what a site draws
  // with useCmsEditing()) turns on only once the page matches what the server drew.
  const hydrated = new Promise<void>((done) => {
    if (!nuxtApp.isHydrating) done()
    else nuxtApp.hooks.hookOnce('app:suspense:resolve', () => done())
  })
  window.addEventListener('message', (e: MessageEvent) => {
    if (e.origin !== location.origin || e.source !== window.parent) return
    if (isCmsBuilderToPage(e.data)) {
      const message = e.data
      void hydrated.then(() => {
        if (message.type === 'cms:builder:on') {
          cmsBuilderWords.value = { names: cmsBuilderNames(message.labels, message.lists), blank: message.texts.blank ?? '',
            texts: { chooseField: message.texts.chooseField ?? '', fieldMissing: message.texts.fieldMissing ?? '', fieldUnfit: message.texts.fieldUnfit ?? '', emptyCard: message.texts.emptyCard ?? '', sampleCard: message.texts.sampleCard ?? '' },
          }
          cmsBuilderOn.value = true
          // What the page loads through the content API is kept while the tools are on (since 2f).
          return import('../builder/sources').then((sources) => sources.recordCmsContent(nuxtApp)).then(() => import('../builder/overlay'))
        }
        return import('../builder/overlay')
      }).then((overlay) => overlay.handleCmsBuilderMessage(message))
      return
    }
    if (e.data?.type !== 'cms:preview') return
    cmsBuilderDraft.data = e.data.data
    for (const listener of cmsBuilderDraft.listeners) listener(e.data.data)
    // A text is being typed in the page (the editor in the preview): the refetch waits until it ends.
    if (cmsBuilderHold.count > 0) {
      cmsBuilderHold.missed = true
      return
    }
    clearTimeout(timer)
    timer = setTimeout(() => { refreshNuxtData() }, 30)
  })
  cmsBuilderHold.refresh = () => {
    clearTimeout(timer)
    return refreshNuxtData()
  }
  // The admin cannot tell when this listener exists (the frame's load event can come first).
  window.parent.postMessage({ type: 'cms:builder:ready' } satisfies CmsBuilderToAdmin, location.origin)
})
