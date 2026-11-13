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

// POST /api/cms/_media — multipart upload. Stores the blob via the StorageDriver
// and records metadata in cms_media. Returns the media record.
export default defineEventHandler(async (event) => {
  const user = requireCmsUser(event)
  const { db, reg } = useCms()
  const storage = useCmsStorage()

  // Rate-limit per user before doing any work.
  if (!(await rateLimit(`upload:${user.id}`, uploadRatePerMin(), 60_000))) {
    throw createError({ statusCode: 429, statusMessage: 'Too many uploads; slow down.' })
  }

  const max = maxUploadBytes()
  // Reject oversized uploads from the declared Content-Length BEFORE buffering the
  // body (the coarse global guard in cms-limits.ts backs this up). +1MB multipart margin.
  const declared = Number(getHeader(event, 'content-length') || 0)
  if (declared && declared > max + 1024 * 1024) {
    throw createError({ statusCode: 413, statusMessage: 'File too large (max ' + Math.round(max / 1024 / 1024) + 'MB)' })
  }

  const parts = await readMultipartFormData(event)
  const file = parts?.find((p) => p.name === 'file' && p.filename)
  if (!file) {
    throw createError({ statusCode: 400, statusMessage: 'No file uploaded (expected multipart field "file")' })
  }

  // Inner bound: enforce the real cap on the buffered bytes (covers missing/forged Content-Length).
  if (file.data.length > max) {
    throw createError({ statusCode: 413, statusMessage: 'File too large (max ' + Math.round(max / 1024 / 1024) + 'MB)' })
  }

  const mime = (file.type || '').toLowerCase()
  const ext = ALLOWED[mime]
  if (!ext) {
    throw createError({ statusCode: 415, statusMessage: `Unsupported media type: ${mime || 'unknown'}` })
  }

  // Per-user storage quota.
  const quota = maxBytesPerUser()
  if (quota) {
    const [usage] = await db
      .select({ used: sql<string>`coalesce(sum(${reg.cmsMedia.size}), 0)` })
      .from(reg.cmsMedia)
      .where(eq(reg.cmsMedia.uploadedBy, user.id))
    if (Number(usage?.used ?? 0) + file.data.length > quota) {
      throw createError({ statusCode: 413, statusMessage: 'Storage quota exceeded.' })
    }
  }

  // Dimensions for images (best-effort, pure JS).
  let width: number | null = null
  let height: number | null = null
  if (mime.startsWith('image/')) {
    try {
      const dim = imageSize(new Uint8Array(file.data))
      width = dim.width ?? null
      height = dim.height ?? null
    } catch {
      /* unreadable header — leave dimensions null */
    }
  }

  // Date-prefixed, uuid-named key: tidy directory tree, collision-free, RFC3986-safe.
  const now = new Date()
  const key = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${randomUUID()}.${ext}`

  const stored = await storage.put(key, file.data, mime)

  const [media] = await db
    .insert(reg.cmsMedia)
    .values({
      url: stored.url,
      key: stored.key,
      mime,
      size: stored.size,
      width,
      height,
      uploadedBy: user.id,
      name: displayFileName(file.filename),
      folder: cleanFolder(parts?.find((p) => p.name === 'folder')?.data?.toString('utf8')),
      // No default description: a file name ("IMG_2041.jpg") read aloud by a screen
      // reader is worse than none. Editors add it next to the image.
      alt: null,
    })
    .returning()

  await audit(event, 'media.upload', { recordId: media?.id, meta: { mime, size: stored.size } })
  setResponseStatus(event, 201)
  return media
})

/** The uploaded file's name, for people (no path, no control characters, bounded). */
function displayFileName(name: string | undefined): string | null {
  const base = String(name ?? '').split(/[\\/]/).pop() ?? ''
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200)
  return clean || null
}
