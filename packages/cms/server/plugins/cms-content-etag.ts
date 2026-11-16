import { createHash } from 'node:crypto'

// Public content answers (marked by setContentCache) carry an ETag: a fingerprint of
// the answer. Browsers check back on every request (max-age=0) and send it as
// If-None-Match; when the content has not changed they get "304 Not Modified" with no
// body, so checking every time stays cheap and a published change shows at once.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', (event: any, response: { body?: unknown }) => {
    if (!event.context?.cmsContentEtag) return
    if (event.method !== 'GET' && event.method !== 'HEAD') return
    if (getResponseStatus(event) !== 200 || response.body === null || response.body === undefined) return
    const text = typeof response.body === 'string' ? response.body : JSON.stringify(response.body)
    const etag = `W/"${createHash('sha1').update(text).digest('base64url')}"`
    setResponseHeader(event, 'ETag', etag)
    const sent = getRequestHeader(event, 'if-none-match')
    if (sent && sent.split(',').some((t) => t.trim() === etag || t.trim() === '*')) {
      setResponseStatus(event, 304)
      response.body = null
    }
  })
})
