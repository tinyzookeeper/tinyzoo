import { randomUUID } from 'node:crypto'
import { extname } from 'node:path'

// Sensible extension fallback when the upload has no filename extension.
const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'application/pdf': 'pdf',
}

// POST /api/cms/_media — multipart upload. Stores the blob via the StorageDriver
// and records metadata in cms_media. Returns the media record.
export default defineEventHandler(async (event) => {
  requireCmsUser(event)
  const { db, reg } = useCms()
  const storage = useCmsStorage()

  const parts = await readMultipartFormData(event)
  const file = parts?.find((p) => p.name === 'file' && p.filename)
  if (!file) {
    throw createError({ statusCode: 400, statusMessage: 'No file uploaded (expected multipart field "file")' })
  }

  const max = maxUploadBytes()
  if (file.data.length > max) {
    throw createError({ statusCode: 413, statusMessage: `File too large (max ${Math.round(max / 1024 / 1024)}MB)` })
  }

  const mime = file.type || 'application/octet-stream'
  const extFromName = extname(file.filename || '').replace('.', '').toLowerCase()
  const ext = extFromName || EXT_BY_MIME[mime] || 'bin'

  // Date-prefixed, uuid-named key: tidy directory tree, collision-free.
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
      // default the alt text to the original filename — editable later
      alt: file.filename ?? null,
    })
    .returning()

  setResponseStatus(event, 201)
  return media
})
