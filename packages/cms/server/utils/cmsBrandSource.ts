import { readFile, stat } from 'node:fs/promises'
import type { CmsAdminTheme, CmsBrandFile } from 'tinyzoo'
import { cmsImageJob } from './cmsImageQueue'
import { BRAND_SOURCE_MAX_BYTES, TINYZOO_MARK_SVG, brandFileSource, brandFileVersion, brandSourcePath, checkLogoBytes, publicFilePath, renderBrandFile } from './cmsBrandFiles'
import { fetchRemoteLogo } from './cmsRemoteLogo'

// Reads the client's logos for the theme (their versions, cmsAdminTheme) and for
// GET /api/cms/_brand/<file>, and keeps the PNGs made from them.
//
// Only the logos in the theme are ever read, never an address from the request: the request
// only says which of the five files it wants.
//  - `/brand/logo.svg`: one of the site's public files (a picture, outside /api/:
//    brandSourcePath). In a production build, read through the app's own static file
//    handler (an internal request, no network, no Host header), which serves .output/public;
//    in development, from the site's public/ folder on disk (runtimeConfig.cms.devPublicDir).
//  - `https://…`: downloaded with a short timeout, at most 2 MB, only from public addresses
//    (cmsRemoteLogo.ts).
//
// What was read is kept with its version (a hash of the bytes, brandFileVersion), and the
// PNGs are kept by file and version, so a changed logo is a new version and never an old
// picture under a new address. In production a logo is read again every 15 minutes (a file
// replaced at the same address, a remote logo that changed); in development on every use.
// A logo that cannot be read is logged once and left out (the emails show the name, the
// icons are tinyzoo's mark); it is tried again a minute later.

const REMOTE_TIMEOUT_MS = 5000
const RETRY_AFTER_MS = 60_000
/** How long a logo read in production is used before it is read again. */
export const BRAND_REFRESH_MS = 15 * 60_000
/** Logos and made files kept in memory (a few logos, five files each; old versions fall out). */
const MAX_SOURCES = 20
const MAX_FILES = 40

/** A logo as read: its bytes and their version. */
export interface CmsBrandSourceRead { bytes: Buffer; version: string }

interface SourceEntry {
  /** The last good read (kept when a later read fails, so a network blip does not swap the icons). */
  read: CmsBrandSourceRead | null
  /** When to read it again. */
  until: number
}

// Per site: two sites can use the same relative logo address for different files.
const state = cmsSiteScoped(() => ({
  sources: new Map<string, SourceEntry>(),
  reading: new Map<string, Promise<CmsBrandSourceRead | null>>(),
  files: new Map<string, Buffer | { failed: true }>(),
  drawing: new Map<string, Promise<Buffer | null>>(),
  logged: new Set<string>(),
}))

const tinyzooMark = cmsProcessWide<{ read: CmsBrandSourceRead | null }>({ read: null }, 'tinyzoo\'s own mark, the same for every site')
/** tinyzoo's own mark: the icons without a client's mark, or when it cannot be read. */
export function tinyzooMarkSource(): CmsBrandSourceRead {
  tinyzooMark.read ??= { bytes: Buffer.from(TINYZOO_MARK_SVG), version: brandFileVersion(TINYZOO_MARK_SVG) }
  return tinyzooMark.read
}

function keep<V>(map: Map<string, V>, key: string, value: V, max: number) {
  map.delete(key)
  map.set(key, value)
  while (map.size > max) map.delete(map.keys().next().value!)
}

function warnOnce(key: string, message: string) {
  if (state().logged.has(key)) return
  state().logged.add(key)
  console.warn(message)
}

const isDev = () => !!import.meta.dev

/** The bytes of a configured logo. Throws with a short reason when it cannot be read. */
async function loadLogo(address: string): Promise<Buffer> {
  if (/^https:\/\//i.test(address)) return fetchRemoteLogo(address, { timeoutMs: REMOTE_TIMEOUT_MS, maxBytes: BRAND_SOURCE_MAX_BYTES })
  const path = brandSourcePath(address)
  if (!path) throw new Error('it is neither a picture on this site (a /… path to an .svg, .png, .webp, .jpg or .avif file, not under /api/) nor an https:// URL')
  // Development: the site's public/ folder on disk (module.ts passes its path, in development
  // only). Not over HTTP: the dev server may be exposed, behind a proxy or on https.
  const dir = String((useRuntimeConfig().cms as any)?.devPublicDir || '')
  if (dir || isDev()) {
    const file = publicFilePath(dir, path)
    if (!file) throw new Error('the site’s public folder is not known')
    const size = await stat(file).then((s) => s.size, () => -1)
    if (size < 0) throw new Error(`there is no file public${path}`)
    if (size > BRAND_SOURCE_MAX_BYTES) throw new Error(`the file is larger than ${BRAND_SOURCE_MAX_BYTES} bytes`)
    return readFile(file)
  }
  // Production: through the app itself, whose static handler serves .output/public.
  const res = await (globalThis as any).$fetch.raw(encodeURI(path), { responseType: 'arrayBuffer', ignoreResponseError: true, timeout: REMOTE_TIMEOUT_MS })
  const html = /text\/html/i.test(String(res.headers.get('content-type') || ''))
  if (res.status !== 200 || !res._data || html) throw new Error(`the site has no file at ${path} (it answered ${res.status}${html ? ' with a page' : ''})`)
  const data = Buffer.from(res._data as ArrayBuffer)
  if (data.byteLength > BRAND_SOURCE_MAX_BYTES) throw new Error(`the file is larger than ${BRAND_SOURCE_MAX_BYTES} bytes`)
  return data
}

function readAgain(address: string): Promise<CmsBrandSourceRead | null> {
  let job = state().reading.get(address)
  if (job) return job
  job = (async () => {
    const before = state().sources.get(address)?.read ?? null
    try {
      const bytes = await loadLogo(address)
      const version = brandFileVersion(bytes)
      if (version !== before?.version) await checkLogoBytes(bytes)
      const read = version === before?.version ? before : { bytes, version }
      keep(state().sources, address, { read, until: Date.now() + (isDev() ? 0 : BRAND_REFRESH_MS) }, MAX_SOURCES)
      return read
    }
    catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      warnOnce(`${address}\n${reason}`, `[cms] the admin logo ${JSON.stringify(address)} (cms.admin.logo) cannot be read: ${reason}. ${before ? 'The last good copy is used until it can.' : 'Until it can, the emails show the site’s name and the tab and home-screen icons are tinyzoo’s mark.'}`)
      keep(state().sources, address, { read: before, until: Date.now() + (isDev() ? 0 : RETRY_AFTER_MS) }, MAX_SOURCES)
      return before
    }
  })().finally(() => state().reading.delete(address))
  state().reading.set(address, job)
  return job
}

/**
 * A configured logo as read, or `null` when it cannot be read. A copy older than
 * `BRAND_REFRESH_MS` is used while it is read again in the background (production);
 * development reads the file every time.
 */
export async function brandSource(address: string): Promise<CmsBrandSourceRead | null> {
  const entry = state().sources.get(address)
  if (entry && Date.now() < entry.until) return entry.read
  if (entry?.read && !isDev()) {
    void readAgain(address)
    return entry.read
  }
  return readAgain(address)
}

/** The versions of the PNG files for a theme's logos (`CmsAdminTheme['logo']['files']`), reading the logos as needed. */
export async function brandLogoFiles(logo: Pick<CmsAdminTheme['logo'], 'full' | 'mark'>): Promise<NonNullable<CmsAdminTheme['logo']['files']>> {
  const [full, mark] = await Promise.all([logo.full ? brandSource(logo.full) : null, logo.mark ? brandSource(logo.mark) : null])
  return { full: full?.version ?? null, mark: (mark ?? tinyzooMarkSource()).version, markFallback: !mark }
}

function draw(file: CmsBrandFile, source: CmsBrandSourceRead, address: string): Promise<Buffer | null> {
  const key = `${file}\n${source.version}`
  const hit = state().files.get(key)
  if (hit) return Promise.resolve(Buffer.isBuffer(hit) ? hit : null)
  let job = state().drawing.get(key)
  if (!job) {
    // Drawn in the picture queue: never side by side with a photo being resized.
    job = cmsImageJob(() => renderBrandFile(file, source.bytes)).then((png) => {
      keep(state().files, key, png, MAX_FILES)
      return png
    }, (err) => {
      // The same bytes fail the same way: remembered for this version, a changed file is a new one.
      keep(state().files, key, { failed: true }, MAX_FILES)
      warnOnce(key, `[cms] the admin logo ${JSON.stringify(address)} could not be made into ${file}: ${err instanceof Error ? err.message : String(err)}. Check cms.admin.logo in app.config.`)
      return null
    }).finally(() => state().drawing.delete(key))
    state().drawing.set(key, job)
  }
  return job
}

/**
 * One PNG version of the theme's logo with the version it was made from, or `null` (404): no
 * full logo for the email, or one that cannot be read or drawn. The mark files are always
 * there: without a mark, or with one that cannot be read or drawn, they are tinyzoo's own.
 */
export async function brandFilePng(file: CmsBrandFile, theme: Pick<CmsAdminTheme, 'logo'>): Promise<{ png: Buffer; version: string } | null> {
  const address = brandFileSource(file, theme as CmsAdminTheme)
  const read = address ? await brandSource(address) : null
  if (read) {
    const png = await draw(file, read, address!)
    if (png) return { png, version: read.version }
  }
  if (file === 'full-email.png') return null
  const own = tinyzooMarkSource()
  const png = await draw(file, own, 'tinyzoo')
  return png ? { png, version: own.version } : null
}

/** Forgets everything read and made (tests). @internal */
export function resetBrandSources() {
  state().sources.clear()
  state().files.clear()
  state().logged.clear()
}
