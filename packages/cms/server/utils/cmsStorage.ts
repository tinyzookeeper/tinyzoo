import { dirname, extname, resolve, sep } from 'node:path'
import { Readable } from 'node:stream'
import { DEFAULT_MEDIA_BASE, encodeStorageKey, isSafeStorageKey, resolveS3Delivery, storedMediaUrl, type S3Delivery } from '../../shared/storage-delivery'
import { byteRange, etagMatches, singleRange } from './cmsRange'

/** Result of persisting a blob. */
export interface StoredObject {
  key: string
  url: string
  size: number
}

/**
 * Pluggable blob storage. The DB only ever holds metadata (a `cms_media` row);
 * the bytes live behind one of these drivers. This is the runtime-divergence seam:
 * Node dev → LocalDriver; production → S3/R2 (same interface, swapped via config).
 */
export interface StorageDriver {
  /** Persist `body` under `key`. Returns the public URL + byte size. */
  put(key: string, body: Buffer, contentType: string): Promise<StoredObject>
  /** Read the whole file into memory. For small files (picture sizes, a resize's source); serving uses `read`. */
  get(key: string): Promise<{ body: Buffer; contentType: string } | null>
  /**
   * Read as a stream, optionally one byte range: what the serving route sends, so a
   * video is never held in memory. `null` when the file does not exist.
   */
  read(key: string, opts?: StorageReadOptions): Promise<StorageRead | null>
  /** Best-effort removal. */
  delete(key: string): Promise<void>
  /** The address stored in the database and handed to browsers. Never expires. */
  url(key: string): string
  /**
   * A signed address that serves the file straight from the store for `seconds`
   * (`delivery: 'redirect'`). Never stored anywhere. Absent for drivers without one.
   */
  presign?(key: string, seconds: number): Promise<string>
  /** How browsers get the files (S3 only); the raw route redirects under `redirect`. */
  readonly delivery?: S3Delivery
}

export interface StorageReadOptions {
  /** The request's `Range` header (one range; anything else is ignored). */
  range?: string
  /** The request's `If-None-Match` header. */
  ifNoneMatch?: string
}

/** A file being read: whole (200), one range (206), unchanged since the caller's copy (304) or a range outside the file (416). */
export interface StorageRead {
  status: 200 | 206 | 304 | 416
  contentType: string
  /** Bytes in `body`, when the store says. */
  contentLength?: number
  /** The Content-Range header: the bytes sent and the file's size (206), or only the size (416). */
  contentRange?: string
  etag?: string
  lastModified?: string
  /** `null` for 304 and 416. */
  body: ReadableStream<Uint8Array> | null
}

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
}

/** Best-effort content type from a key's extension (for the local serving route). */
export function mimeFromKey(key: string): string {
  return MIME_BY_EXT[extname(key).toLowerCase()] || 'application/octet-stream'
}

/**
 * Local filesystem driver. Stores under an absolute `dir` (outside the build
 * output so uploads survive a redeploy) and serves bytes through a Nitro route
 * at `publicBase`. Path-traversal is blocked in `pathFor`.
 */
class LocalDriver implements StorageDriver {
  constructor(private readonly dir: string, private readonly publicBase: string) {}

  private pathFor(key: string): string {
    const abs = resolve(this.dir, key)
    if (abs !== this.dir && !abs.startsWith(this.dir + sep)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid storage key' })
    }
    return abs
  }

  async put(key: string, body: Buffer): Promise<StoredObject> {
    const { mkdir, writeFile } = await import('node:fs/promises')
    const abs = this.pathFor(key)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, body)
    return { key, url: this.url(key), size: body.length }
  }

  async get(key: string): Promise<{ body: Buffer; contentType: string } | null> {
    try {
      const { readFile } = await import('node:fs/promises')
      const body = await readFile(this.pathFor(key))
      return { body, contentType: mimeFromKey(key) }
    } catch {
      return null
    }
  }

  async read(key: string, opts: StorageReadOptions = {}): Promise<StorageRead | null> {
    const { stat } = await import('node:fs/promises')
    const { createReadStream } = await import('node:fs')
    let abs: string
    let info: Awaited<ReturnType<typeof stat>>
    try {
      abs = this.pathFor(key)
      info = await stat(abs)
    }
    catch {
      return null
    }
    if (!info.isFile()) return null
    const size = info.size
    const contentType = mimeFromKey(key)
    const etag = '"' + size.toString(16) + '-' + Math.floor(info.mtimeMs).toString(16) + '"'
    const lastModified = info.mtime.toUTCString()
    if (etagMatches(opts.ifNoneMatch, etag)) return { status: 304, contentType, etag, lastModified, body: null }
    const range = byteRange(opts.range, size)
    if (range === 'unsatisfiable') return { status: 416, contentType, contentRange: 'bytes */' + size, body: null }
    const [start, end] = range ? [range.start, range.end] : [0, size - 1]
    // An empty file has no byte to start from: createReadStream would read it all, which is nothing.
    const body = size === 0 ? new ReadableStream<Uint8Array>({ start: (c) => c.close() }) : (Readable.toWeb(createReadStream(abs, { start, end })) as ReadableStream<Uint8Array>)
    return {
      status: range ? 206 : 200,
      contentType,
      contentLength: size === 0 ? 0 : end - start + 1,
      contentRange: range ? 'bytes ' + start + '-' + end + '/' + size : undefined,
      etag,
      lastModified,
      body,
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const { unlink } = await import('node:fs/promises')
      await unlink(this.pathFor(key))
    } catch {
      /* already gone — fine */
    }
  }

  url(key: string): string {
    return `${this.publicBase}/${key}`
  }
}

/** The local-disk driver for a folder (`useCmsStorage` builds it from the runtime config; tests build it directly). */
export function createLocalDriver(dir: string, publicBase: string = DEFAULT_MEDIA_BASE): StorageDriver {
  return new LocalDriver(resolve(dir), publicBase)
}

export interface S3Config {
  /** Service endpoint. R2: https://<account>.r2.cloudflarestorage.com — MinIO: http://localhost:9000 */
  endpoint: string
  /** SigV4 region. R2 uses 'auto'; AWS uses e.g. 'us-east-1'. */
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  /** Public URL prefix used to serve objects (CDN / r2.dev / custom domain). Defaults to `${endpoint}/${bucket}`. */
  publicBaseUrl?: string
  /**
   * How browsers get the files: `public` (the stored address is the bucket's own),
   * `proxy` (the app streams them) or `redirect` (the app sends a short-lived signed
   * address). Default `public` when `publicBaseUrl` is set, otherwise `proxy`.
   */
  delivery?: S3Delivery
  /** Where the app serves files from under `proxy` and `redirect` (the local driver's address). */
  appBase?: string
}

/** How long a signed address of `redirect` delivery lives, and how long a browser may keep the redirect (less, so it never follows a dead one). */
export const PRESIGN_SECONDS = 300
export const REDIRECT_CACHE_SECONDS = 240

/** The store answered, but not with a file: the visitor gets 502; the log gets the status, never an address. */
function storageUnavailable(what: string): never {
  throw createError({ statusCode: 502, statusMessage: 'Media storage is not available', cause: new Error(what) })
}

/**
 * S3-compatible driver (AWS S3, Cloudflare R2, MinIO, Pushbase Storage). Requests are
 * signed with SigV4 via `aws4fetch` (`fetch` + Web Crypto). Uses path-style addressing
 * (`endpoint/bucket/key`), which R2, MinIO and Pushbase accept (and always does:
 * a `FORCE_PATH_STYLE` setting from a hosting platform is ignored).
 *
 * `delivery` decides how browsers reach the files:
 * - `public`: straight from the bucket's public URL or a CDN (`publicBaseUrl`); the raw
 *   route is not involved.
 * - `proxy`: the bucket is private; the raw route streams each file from it.
 * - `redirect`: the bucket is private; the raw route redirects to a signed address.
 * Under `proxy` and `redirect` the stored address is the app path, which never expires.
 */
class S3Driver implements StorageDriver {
  private _client: any
  private checkedPublic = false
  readonly delivery: S3Delivery
  constructor(private readonly cfg: S3Config) {
    this.delivery = cfg.delivery ?? (cfg.publicBaseUrl ? 'public' : 'proxy')
  }

  private async client() {
    if (this._client) return this._client
    let AwsClient: any
    try {
      ;({ AwsClient } = await import('aws4fetch'))
    } catch {
      throw createError({
        statusCode: 500,
        statusMessage: "The 's3'/'r2' storage driver requires the 'aws4fetch' package (pnpm add aws4fetch).",
      })
    }
    this._client = new AwsClient({
      accessKeyId: this.cfg.accessKeyId,
      secretAccessKey: this.cfg.secretAccessKey,
      region: this.cfg.region,
      service: 's3',
      // aws4fetch retries 5xx and network errors ten times with growing pauses (half a
      // minute in all): far too long for a visitor waiting for a picture.
      retries: 2,
    })
    return this._client
  }

  // Keys are RFC3986-safe by construction (date / uuid / ext), so per-segment
  // encoding is a no-op here and aws4fetch will not double-encode them. If
  // arbitrary keys are ever allowed, drop this and let aws4fetch own the encoding.
  // A key with `..` would be resolved by the URL and reach another bucket: refused.
  private objectUrl(key: string): string {
    if (!isSafeStorageKey(key)) throw createError({ statusCode: 400, statusMessage: 'Invalid storage key' })
    const endpoint = this.cfg.endpoint.replace(/\/$/, '')
    return endpoint + '/' + this.cfg.bucket + '/' + encodeStorageKey(key)
  }

  async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    const client = await this.client()
    const res = await client.fetch(this.objectUrl(key), {
      method: 'PUT',
      body: new Uint8Array(body),
      headers: { 'content-type': contentType },
    })
    if (!res.ok) {
      throw createError({ statusCode: 502, statusMessage: `S3 upload failed (${res.status} ${res.statusText})` })
    }
    if (this.delivery === 'public') this.checkPublic(key)
    return { key, url: this.url(key), size: body.length }
  }

  /**
   * Once, after the first upload: under `public` delivery the file just stored must be
   * readable without a signature. A 401/403 means the bucket is private and every
   * picture on the site would fail — say so in the log, with the way out.
   */
  private checkPublic(key: string) {
    if (this.checkedPublic) return
    this.checkedPublic = true
    fetch(this.url(key), { method: 'HEAD' }).then((res) => {
      if (res.status === 401 || res.status === 403) {
        console.warn(`[cms] storage delivery is 'public', but a file just uploaded answers ${res.status} to an anonymous request: the bucket is private. `
          + "Set NUXT_CMS_STORAGE_S3_DELIVERY=proxy (or 'redirect'), see https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/deploying.md#media")
      }
    }).catch(() => { /* the public address is not reachable from here (a CDN in front, a firewall): nothing to say */ })
  }

  async get(key: string): Promise<{ body: Buffer; contentType: string } | null> {
    const client = await this.client()
    const res = await client.fetch(this.objectUrl(key))
    if (!res.ok) return null
    const body = Buffer.from(await res.arrayBuffer())
    return { body, contentType: res.headers.get('content-type') || mimeFromKey(key) }
  }

  async read(key: string, opts: StorageReadOptions = {}): Promise<StorageRead | null> {
    const client = await this.client()
    const headers: Record<string, string> = {}
    const range = singleRange(opts.range)
    if (range) headers.range = range
    if (opts.ifNoneMatch) headers['if-none-match'] = opts.ifNoneMatch
    const address = this.objectUrl(key)
    let res: Response
    try {
      res = await client.fetch(address, { headers })
    }
    catch (err: any) {
      // Never the error's own text: the store's address is in some of them.
      return storageUnavailable('S3 read failed: ' + (err?.cause?.code || err?.name || 'network error'))
    }
    const generic = /^(application|binary)\/octet-stream$/i
    const type = res.headers.get('content-type')
    const meta = {
      contentType: type && !generic.test(type) ? type : mimeFromKey(key),
      etag: res.headers.get('etag') ?? undefined,
      lastModified: res.headers.get('last-modified') ?? undefined,
    }
    if (res.status === 404) {
      await res.body?.cancel().catch(() => {})
      return null
    }
    if (res.status === 304) {
      await res.body?.cancel().catch(() => {})
      return { status: 304, ...meta, body: null }
    }
    if (res.status === 416) {
      await res.body?.cancel().catch(() => {})
      // S3 itself leaves out the Content-Range of a 416: the size comes from a HEAD.
      let contentRange = res.headers.get('content-range') ?? undefined
      if (!contentRange) {
        const head = await client.fetch(address, { method: 'HEAD' }).catch(() => null)
        const size = head?.ok ? head.headers.get('content-length') : null
        if (size !== null && size !== undefined) contentRange = 'bytes */' + size
      }
      return { status: 416, ...meta, contentRange, body: null }
    }
    if ((res.status !== 200 && res.status !== 206) || !res.body) {
      await res.body?.cancel().catch(() => {})
      return storageUnavailable('S3 read answered ' + res.status)
    }
    // A stored Content-Encoding would be undone by fetch and the length would no longer fit.
    const length = Number(res.headers.get('content-length'))
    return {
      status: res.status,
      ...meta,
      contentLength: Number.isFinite(length) && length >= 0 && !res.headers.get('content-encoding') ? length : undefined,
      contentRange: res.status === 206 ? res.headers.get('content-range') ?? undefined : undefined,
      body: res.body as ReadableStream<Uint8Array>,
    }
  }

  async presign(key: string, seconds: number): Promise<string> {
    const client = await this.client()
    const url = new URL(this.objectUrl(key))
    url.searchParams.set('X-Amz-Expires', String(seconds))
    const signed = await client.sign(url.toString(), { method: 'GET', aws: { signQuery: true } })
    return signed.url
  }

  async delete(key: string): Promise<void> {
    const client = await this.client()
    const res = await client.fetch(this.objectUrl(key), { method: 'DELETE' })
    // S3/R2 return 204 on success; treat 404 as already-gone (idempotent).
    if (!res.ok && res.status !== 404) {
      throw createError({ statusCode: 502, statusMessage: `S3 delete failed (${res.status} ${res.statusText})` })
    }
  }

  url(key: string): string {
    return storedMediaUrl({ ...this.cfg, delivery: this.delivery }, key)
  }
}

/** The S3 driver for a ready configuration (`useCmsStorage` builds it from the runtime config; tests build it directly). */
export function createS3Driver(cfg: S3Config): StorageDriver {
  return new S3Driver(cfg)
}

/**
 * Fallback for an unknown driver name. Fails loudly so a typo in
 * `cms.storage.driver` never silently swallows uploads.
 */
class UnconfiguredDriver implements StorageDriver {
  constructor(private readonly name: string) {}
  private fail(): never {
    throw createError({
      statusCode: 501,
      statusMessage: `Storage driver '${this.name}' is not implemented yet. Set cms.storage.driver to 'local'.`,
    })
  }
  put(): Promise<StoredObject> {
    return this.fail()
  }
  get(): Promise<{ body: Buffer; contentType: string } | null> {
    return this.fail()
  }
  read(): Promise<StorageRead | null> {
    return this.fail()
  }
  delete(): Promise<void> {
    return this.fail()
  }
  url(): string {
    return this.fail()
  }
}

let _driver: StorageDriver | undefined

/**
 * Resolve the configured storage driver (memoized).
 * NB: NOT named `useStorage` — that's a built-in Nitro (unstorage) helper.
 */
export function useCmsStorage(): StorageDriver {
  if (_driver) return _driver
  const cfg = ((useRuntimeConfig().cms as any)?.storage ?? {}) as {
    driver?: string
    local?: { dir?: string; publicBase?: string }
    s3?: Partial<S3Config> & { delivery?: string }
  }
  const driver = cfg.driver || 'local'
  if (driver === 'local') {
    const dir = resolve(process.cwd(), cfg.local?.dir || '.cms-uploads')
    const publicBase = cfg.local?.publicBase || DEFAULT_MEDIA_BASE
    if (process.env.NODE_ENV === 'production') {
      console.warn(`[cms] media are stored on this server's disk (${dir}). Containers lose it on every deploy — `
        + 'use object storage in production (NUXT_CMS_STORAGE_DRIVER=s3, see https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/deploying.md#media).')
    }
    _driver = new LocalDriver(dir, publicBase)
  } else if (driver === 's3' || driver === 'r2') {
    const s = cfg.s3 ?? {}
    const missing = (['endpoint', 'bucket', 'accessKeyId', 'secretAccessKey'] as const).filter((k) => !s[k])
    if (missing.length) {
      throw createError({
        statusCode: 500,
        statusMessage: `Storage driver '${driver}' is missing config: ${missing.join(', ')} `
          + `(set cms.storage.s3.* or NUXT_CMS_STORAGE_S3_* env vars).`,
      })
    }
    let delivery: S3Delivery
    try { delivery = resolveS3Delivery(s.delivery, s.publicBaseUrl) }
    catch (err: any) { throw createError({ statusCode: 500, statusMessage: err.message }) }
    // NB: do NOT memoize on the misconfigured path above — let it re-throw until fixed.
    _driver = new S3Driver({
      endpoint: s.endpoint!,
      region: s.region || (driver === 'r2' ? 'auto' : 'us-east-1'),
      bucket: s.bucket!,
      accessKeyId: s.accessKeyId!,
      secretAccessKey: s.secretAccessKey!,
      publicBaseUrl: s.publicBaseUrl || undefined,
      delivery,
      appBase: cfg.local?.publicBase || DEFAULT_MEDIA_BASE,
    })
  } else {
    _driver = new UnconfiguredDriver(driver)
  }
  return _driver
}

/** Configured per-file upload ceiling in bytes (default 10MB). */
export function maxUploadBytes(): number {
  const mb = Number((useRuntimeConfig().cms as any)?.storage?.maxSizeMb) || 10
  return mb * 1024 * 1024
}

/** Per-user total storage quota in bytes (0 = unlimited). */
export function maxBytesPerUser(): number {
  return Number((useRuntimeConfig().cms as any)?.storage?.maxBytesPerUser) || 0
}

/** Max uploads per user per minute (0 = unlimited; default 60). */
export function uploadRatePerMin(): number {
  return Number((useRuntimeConfig().cms as any)?.storage?.uploadRatePerMin ?? 60) || 0
}

/** A library folder name: one level, trimmed, bounded; empty = no folder. */
export function cleanFolder(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.replace(/[\u0000-\u001f\u007f/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
  return v || null
}
