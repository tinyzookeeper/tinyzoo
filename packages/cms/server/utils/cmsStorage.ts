import { dirname, extname, resolve, sep } from 'node:path'

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
  /** Read bytes back. Used by the local serving route; cloud drivers may return null. */
  get(key: string): Promise<{ body: Buffer; contentType: string } | null>
  /** Best-effort removal. */
  delete(key: string): Promise<void>
  /** Public URL for a stored key. */
  url(key: string): string
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
}

/**
 * S3-compatible driver (AWS S3, Cloudflare R2, MinIO). Requests are signed with
 * SigV4 via `aws4fetch` — built on `fetch` + Web Crypto, so it runs unchanged on
 * Node and on Cloudflare Workers (the dual-runtime target). Uses path-style
 * addressing (`endpoint/bucket/key`), which R2 and MinIO accept.
 *
 * Uploaded objects are served straight from their public URL (a public bucket or
 * CDN/custom domain via `publicBaseUrl`) — they do NOT proxy through this app, so
 * the local `raw` serving route is unused under this driver.
 */
class S3Driver implements StorageDriver {
  private _client: any
  constructor(private readonly cfg: S3Config) {}

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
    })
    return this._client
  }

  // Keys are RFC3986-safe by construction (date / uuid / ext), so per-segment
  // encoding is a no-op here and aws4fetch will not double-encode them. If
  // arbitrary keys are ever allowed, drop this and let aws4fetch own the encoding.
  private encodeKey(key: string): string {
    return key.split('/').map(encodeURIComponent).join('/')
  }

  private objectUrl(key: string): string {
    return `${this.cfg.endpoint.replace(/\/$/, '')}/${this.cfg.bucket}/${this.encodeKey(key)}`
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
    return { key, url: this.url(key), size: body.length }
  }

  async get(key: string): Promise<{ body: Buffer; contentType: string } | null> {
    const client = await this.client()
    const res = await client.fetch(this.objectUrl(key))
    if (!res.ok) return null
    const body = Buffer.from(await res.arrayBuffer())
    return { body, contentType: res.headers.get('content-type') || mimeFromKey(key) }
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
    const base = this.cfg.publicBaseUrl?.replace(/\/$/, '') || `${this.cfg.endpoint.replace(/\/$/, '')}/${this.cfg.bucket}`
    return `${base}/${this.encodeKey(key)}`
  }
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
    s3?: Partial<S3Config>
  }
  const driver = cfg.driver || 'local'
  if (driver === 'local') {
    const dir = resolve(process.cwd(), cfg.local?.dir || '.cms-uploads')
    const publicBase = cfg.local?.publicBase || '/api/cms/_media/raw'
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
    // NB: do NOT memoize on the misconfigured path above — let it re-throw until fixed.
    _driver = new S3Driver({
      endpoint: s.endpoint!,
      region: s.region || (driver === 'r2' ? 'auto' : 'us-east-1'),
      bucket: s.bucket!,
      accessKeyId: s.accessKeyId!,
      secretAccessKey: s.secretAccessKey!,
      publicBaseUrl: s.publicBaseUrl || undefined,
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
