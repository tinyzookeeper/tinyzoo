// Apply redirects (defineRedirects) to page requests: GET/HEAD for anything that is
// not the API, the admin or a build asset. Query strings are carried over.
const SKIP = ['/api/', '/admin', '/_nuxt/', '/__nuxt', '/_ipx/', '/favicon']

export default defineEventHandler(async (event) => {
  if (event.method !== 'GET' && event.method !== 'HEAD') return
  const path = event.path || '/'
  if (SKIP.some((p) => path.startsWith(p))) return
  let target
  try {
    target = await findRedirect(path)
  }
  catch (err) {
    console.error('[cms] redirect lookup failed', scrubError(err))
    return
  }
  if (!target) return
  const query = path.includes('?') ? path.slice(path.indexOf('?')) : ''
  const dest = target.to.includes('?') || !query ? target.to : target.to + query
  return sendRedirect(event, locationHeader(dest), target.status)
})
