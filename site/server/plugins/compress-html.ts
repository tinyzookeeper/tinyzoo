import { brotliCompressSync, constants, gzipSync } from 'node:zlib'

// Pages leave the server compressed (brotli, else gzip): about a fifth of the bytes.
// Built assets are pre-compressed at build time (nitro.compressPublicAssets); API
// answers stay as they are. A proxy in front leaves compressed responses alone.
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('render:response', (response, { event }) => {
    const body = response.body
    if (typeof body !== 'string' || body.length < 1024 || response.headers?.['content-encoding']) return
    // Error pages are rendered internally (/__nuxt_error) and passed on as text by
    // Nuxt's error handler: compressing them here would corrupt them. They are small.
    if ((response.statusCode ?? 200) >= 400 || event.path.startsWith('/__nuxt_error')) return
    const accepts = String(getRequestHeader(event, 'accept-encoding') ?? '')
    const br = /\bbr\b/.test(accepts)
    if (!br && !/\bgzip\b/.test(accepts)) return
    response.body = br
      ? brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } })
      : gzipSync(body, { level: 6 })
    response.headers = { ...response.headers, 'content-encoding': br ? 'br' : 'gzip', 'vary': 'Accept-Encoding' }
  })
})
