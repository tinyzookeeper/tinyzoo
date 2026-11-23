import { randomUUID } from 'node:crypto'
import { eq, sql } from 'tinyzoo'
import { imageSize } from 'image-size'

// Allowlist of storable types → canonical extension. Deliberately EXCLUDES
// svg / html / xml: those execute script when served inline from our own origin
// (stored-XSS). The stored extension is derived from the validated MIME, never
// from the attacker-supplied filename, so the served Content-Type stays trusted.
const ALLOWED: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'application/pdf': 'pdf',
}

/** What a type is called in "Not a readable …". */
const ALLOWED_KIND: Record<string, string> = {
  'application/pdf': 'PDF',
  'video/mp4': 'video',
  'video/webm': 'video',
  'audio/mpeg': 'audio file',
}

// POST /api/cms/_media — multipart upload. Stores the blob via the StorageDriver
// and records metadata in cms_media. Returns the media record.
export default defineEventHandler(async (event) => {
  const user = requireCmsUser(event)
  assertMediaLibrary(user)
  assertTokenMedia(user)
  const { db, reg } = useCms()
  const storage = useCmsStorage()

  // Rate-limit per user before doing any work.
  if (!(await rateLimit(`upload:${user.id}`, uploadRatePerMin(), 60_000))) {
    throw tooManyRequests(event, 'Too many uploads; slow down.', 60_000)
  }

  const max = maxUploadBytes()
  // Refuse an oversized body from the declared Content-Length before reading any of it
  // (the coarse global guard in cms-limits.ts backs this up). +1MB multipart margin.
  const declared = Number(getHeader(event, 'content-length') || 0)
  if (declared && declared > max + 1024 * 1024) {
    throw createError({ statusCode: 413, statusMessage: 'File too large (max ' + Math.round(max / 1024 / 1024) + 'MB)', data: { code: 'file_too_large', maxMb: Math.round(max / 1024 / 1024) } })
  }

  // The body is read as it arrives, into a temp file; the cap counts the bytes that
  // really come in (chunked bodies have no Content-Length). See cmsUpload.ts.
  const { file, fields } = await receiveUpload(event, { maxBytes: max, tempDir: storage.tempDir })
  try {
    if (!file) {
      throw createError({ statusCode: 400, statusMessage: 'No file uploaded (expected multipart field "file")' })
    }

    const mime = file.type
    const ext = ALLOWED[mime]
    if (!ext) {
      throw createError({ statusCode: 415, statusMessage: `Unsupported media type: ${mime || 'unknown'}` })
    }
    if (!file.size) throw createError({ statusCode: 400, statusMessage: 'The file is empty' })

    // The type says what it is; the first bytes must agree (a renamed text file, a
    // download cut off before its header).
    if (!looksLike(mime, file.head)) {
      throw createError({ statusCode: 415, statusMessage: `Not a readable ${ALLOWED_KIND[mime] ?? 'file'}` })
    }

    // Dimensions for images (best-effort, pure JS, from the first bytes).
    let width: number | null = null
    let height: number | null = null
    if (mime.startsWith('image/')) {
      try {
        const dim = imageSize(new Uint8Array(file.head))
        width = dim.width ?? null
        height = dim.height ?? null
      } catch {
        // Called a picture but isn't one (a renamed text file, a broken download): it
        // would only show as a broken image everywhere.
        throw createError({ statusCode: 415, statusMessage: 'Not a readable image' })
      }
      // Too many pixels to ever resize (and to decode without eating the server's memory):
      // better refused now, with the limit, than uploaded and broken everywhere.
      if (width && height && width * height > MAX_IMAGE_PIXELS) {
        const mp = Math.round(MAX_IMAGE_PIXELS / 1_000_000)
        throw createError({
          statusCode: 422,
          statusMessage: `The picture has too many pixels (${width} × ${height}); at most ${mp} megapixels are allowed`,
          data: { code: 'image_too_many_pixels', maxMegapixels: mp, width, height },
        })
      }
    }

    // Storage limits: the site's total and the per-user quota. Checked here before the file is
    // stored (so an upload that cannot fit does not cost the bucket a write), and again under a
    // lock at the insert, which is the check that counts when uploads arrive together.
    const siteLimit = maxTotalBytes()
    const userQuota = maxBytesPerUser()
    if (siteLimit || userQuota) await assertStorageRoom(db, reg, { siteLimit, userQuota, userId: user.id, size: file.size })

    // Date-prefixed, uuid-named key: tidy directory tree, collision-free, RFC3986-safe.
    const now = new Date()
    const key = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${randomUUID()}.${ext}`

    const stored = await storage.putFile(key, file.path, { size: file.size, sha256: file.sha256, contentType: mime })

    const values = {
      url: stored.url,
      key: stored.key,
      mime,
      size: stored.size,
      width,
      height,
      uploadedBy: user.id,
      name: displayFileName(file.filename),
      folder: cleanFolder(fields.folder),
      // Uploaded in the library (its page or picker): kept there even when no entry uses it.
      inLibrary: fields.library === '1',
      // No default description: a file name ("IMG_2041.jpg") read aloud by a screen
      // reader is worse than none. Editors add it next to the image.
      alt: null,
    }
    let media: any
    if (siteLimit || userQuota) {
      // One check-and-insert at a time per site (its database): the transaction takes an advisory
      // lock, adds up the rows that are there (the ones of uploads that finished before this one
      // got the lock), and inserts only if the file still fits. The lock is held for a sum and an
      // insert, never for the upload itself. A file that no longer fits is removed again.
      try {
        media = await db.transaction(async (tx: any) => {
          await tx.execute(sql`select pg_advisory_xact_lock(${STORAGE_LOCK})`)
          await assertStorageRoom(tx, reg, { siteLimit, userQuota, userId: user.id, size: stored.size })
          return (await tx.insert(reg.cmsMedia).values(values).returning())[0]
        })
      }
      catch (err) {
        await storage.delete(stored.key).catch(() => {})
        throw err
      }
    }
    else {
      media = (await db.insert(reg.cmsMedia).values(values).returning())[0]
    }

    await audit(event, 'media.upload', { recordId: media?.id, meta: { mime, size: stored.size } })
    // Its smaller copies are made now, in the background: ready before a visitor asks for them.
    if (isResizableImage(mime)) kickMediaSizes()
    setResponseStatus(event, 201)
    return media
  }
  finally {
    await discardReceived(file) // already moved on success; a no-op then
  }
})

/** The key of the advisory lock that makes the storage check and the insert one step. Advisory locks belong to a database, and a site has its own. */
const STORAGE_LOCK = 72_011_060

/**
 * Refuses (413) a file that would take the site over `cms.storage.maxBytes` or the uploader
 * over `cms.storage.maxBytesPerUser`. Counts the media rows' sizes, as the status route does.
 * `q` is the database or the transaction that holds the lock.
 */
async function assertStorageRoom(q: any, reg: any, opts: { siteLimit: number; userQuota: number; userId: string; size: number }) {
  const { siteLimit, userQuota, userId, size } = opts
  const total = (where?: any) => q
    .select({ used: sql<string>`coalesce(sum(${reg.cmsMedia.size}), 0)::bigint` })
    .from(reg.cmsMedia)
    .where(where)
    .then((rows: any[]) => Number(rows[0]?.used ?? 0))
  if (siteLimit) {
    const used = await total()
    if (used + size > siteLimit) {
      throw createError({
        statusCode: 413,
        statusMessage: 'There is not enough storage space left for this file.',
        data: { code: 'storage_full', limitBytes: siteLimit, usedBytes: used },
      })
    }
  }
  if (userQuota && (await total(eq(reg.cmsMedia.uploadedBy, userId))) + size > userQuota) {
    throw createError({ statusCode: 413, statusMessage: 'Storage quota exceeded.' })
  }
}

/** The uploaded file's name, for people (no path, no control characters, bounded). */
function displayFileName(name: string | undefined): string | null {
  const base = String(name ?? '').split(/[\\/]/).pop() ?? ''
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200)
  return clean || null
}
