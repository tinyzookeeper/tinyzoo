import { BRAND_SOURCE_MAX_BYTES, TINYZOO_MARK_SVG, brandFileSource, isBrandSourceAddress, renderBrandFile } from './cmsBrandFiles'
import type { CmsAdminTheme, CmsBrandFile } from 'tinyzoo'

// Loads the client's logo for GET /api/cms/_brand/<file> and keeps the PNGs made from it.
//
// Only the logos in the theme (cmsAdminTheme) are ever read, never an address from the
// request: the request only says which of the five files it wants.
//  - `/brand/logo.svg`: one of the site's public files, read through the server's own
//    static file handler (an internal request, no network), so it works the same in
//    development and in a production build (.output/public).
//  - `https://…`: downloaded with a short timeout and at most 2 MB.
// A logo that cannot be read or drawn answers 404 and is logged once; it is tried again
// a minute later (the file may have been fixed), not on every request.

const REMOTE_TIMEOUT_MS = 5000
const RETRY_AFTER_MS = 60_000
/** Made files kept in memory: five per logo, a few logos (a theme change leaves the old ones until they fall out). */
const MAX_CACHED = 40

type Made = { png: Buffer } | { failed: number }
const made = new Map<string, Made>()
const inflight = new Map<string, Promise<Buffer | null>>()
const logged = new Set<string>()

async function readCapped(body: ReadableStream<Uint8Array> | null, declared: number): Promise<Buffer> {
  if (declared > BRAND_SOURCE_MAX_BYTES) throw new Error(`the file is larger than ${BRAND_SOURCE_MAX_BYTES} bytes`)
  if (!body) throw new Error('the response has no body')
  const chunks: Uint8Array[] = []
  let size = 0
  const reader = body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > BRAND_SOURCE_MAX_BYTES) {
      await reader.cancel().catch(() => {})
      throw new Error(`the file is larger than ${BRAND_SOURCE_MAX_BYTES} bytes`)
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

/** The bytes of a configured logo. Throws with a short reason when it cannot be read. */
async function loadBrandSource(event: any, address: string): Promise<Buffer> {
  if (!isBrandSourceAddress(address)) throw new Error('the address is neither a path on this site (/…) nor an https:// URL')
  if (address.startsWith('https:')) {
    const res = await fetch(address, { signal: AbortSignal.timeout(REMOTE_TIMEOUT_MS), redirect: 'follow' })
    if (!res.ok) throw new Error(`the server answered ${res.status}`)
    return readCapped(res.body, Number(res.headers.get('content-length') || 0))
  }
  // A public file: through the app itself (Nitro serves .output/public in production), and
  // in development, where public files are served in front of the app, from this server's own address.
  const path = address.split('#')[0]!
  try {
    const res = await (globalThis as any).$fetch.raw(path, { responseType: 'arrayBuffer', ignoreResponseError: true, timeout: REMOTE_TIMEOUT_MS })
    if (res.status === 200 && res._data) {
      const data = Buffer.from(res._data as ArrayBuffer)
      if (data.byteLength > BRAND_SOURCE_MAX_BYTES) throw new Error(`the file is larger than ${BRAND_SOURCE_MAX_BYTES} bytes`)
      if (!/text\/html/i.test(String(res.headers.get('content-type') || ''))) return data
    }
    if (!import.meta.dev) throw new Error(`the site answered ${res.status} for ${path}`)
  }
  catch (err) {
    if (!import.meta.dev) throw err
  }
  const res = await fetch(new URL(path, getRequestURL(event).origin), { signal: AbortSignal.timeout(REMOTE_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`the site answered ${res.status} for ${path}`)
  return readCapped(res.body, Number(res.headers.get('content-length') || 0))
}

function remember(key: string, value: Made) {
  made.delete(key)
  made.set(key, value)
  while (made.size > MAX_CACHED) made.delete(made.keys().next().value!)
}

/**
 * One PNG version of the theme's logo, or `null` (404): no logo of that kind (the full
 * logo for the email), or one that cannot be read or drawn. Without a mark, the mark
 * files are tinyzoo's own.
 */
export async function brandFilePng(event: any, file: CmsBrandFile, theme: CmsAdminTheme): Promise<Buffer | null> {
  const source = brandFileSource(file, theme)
  if (!source && file === 'full-email.png') return null
  const key = `${file}\n${source ?? ''}`
  const hit = made.get(key)
  if (hit && 'png' in hit) return hit.png
  if (hit && Date.now() - hit.failed < RETRY_AFTER_MS) return null
  let job = inflight.get(key)
  if (!job) {
    job = (async () => {
      try {
        const input = source ? await loadBrandSource(event, source) : Buffer.from(TINYZOO_MARK_SVG)
        const png = await renderBrandFile(file, input)
        // In development the logo file may change under a running server: draw it again each time.
        if (!import.meta.dev || !source) remember(key, { png })
        return png
      }
      catch (err) {
        remember(key, { failed: Date.now() })
        if (!logged.has(key)) {
          logged.add(key)
          console.warn(`[cms] the admin logo ${JSON.stringify(source)} could not be made into ${file}: ${err instanceof Error ? err.message : String(err)}. Check cms.admin.logo in app.config.`)
        }
        return null
      }
    })().finally(() => inflight.delete(key))
    inflight.set(key, job)
  }
  return job
}
