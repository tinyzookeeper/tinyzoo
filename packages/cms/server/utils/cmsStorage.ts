import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
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
    const abs = this.pathFor(key)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, body)
    return { key, url: this.url(key), size: body.length }
  }

  async get(key: string): Promise<{ body: Buffer; contentType: string } | null> {
    try {
      const body = await readFile(this.pathFor(key))
      return { body, contentType: mimeFromKey(key) }
    } catch {
      return null
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.pathFor(key))
    } catch {
      /* already gone — fine */
    }
  }

  url(key: string): string {
    return `${this.publicBase}/${key}`
  }
}

/**
 * Placeholder for S3-compatible object stores (AWS S3, Cloudflare R2). The seam
 * is ready — wire `@aws-sdk/client-s3` or `aws4fetch` here and select it with
 * `cms.storage.driver = 's3' | 'r2'`. Until then it fails loudly, never silently.
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
  }
  const driver = cfg.driver || 'local'
  if (driver === 'local') {
    const dir = resolve(process.cwd(), cfg.local?.dir || '.cms-uploads')
    const publicBase = cfg.local?.publicBase || '/api/cms/_media/raw'
    _driver = new LocalDriver(dir, publicBase)
  } else {
    _driver = new UnconfiguredDriver(driver)
  }
  return _driver
}

/** Configured upload ceiling in bytes (default 10MB). */
export function maxUploadBytes(): number {
  const mb = Number((useRuntimeConfig().cms as any)?.storage?.maxSizeMb) || 10
  return mb * 1024 * 1024
}
