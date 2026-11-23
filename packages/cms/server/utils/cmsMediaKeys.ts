import { eq } from 'tinyzoo'
import { CMS_IMAGE_WIDTHS } from './cmsImageSizes'

// Which stored objects may the raw media route serve? Only those that belong to a
// cms_media row (or are the resized copy of one). A bucket is often shared with other
// tools; without this, anyone could read every object in it through /_media/raw/<key>.
//
// The answer is cached for a minute in memory (a page shows many pictures, each asked
// for again by every visitor), the misses for half a minute (probes for keys that do
// not exist should not each cost a query). A key is a random uuid made at upload, so
// nobody asks for one before its row exists; a deleted file simply loses its object.

export interface ServedMedia {
  name: string | null
  mime: string
}

const POSITIVE_MS = 60_000
const NEGATIVE_MS = 30_000
const MAX_ENTRIES = 5000
// Per site: the same key can name different files in two sites.
const cache = siteScoped(() => new Map<string, { value: ServedMedia | null; until: number }>())

/** `_w/640/2026/01/<uuid>.png.webp` → `2026/01/<uuid>.png` (a resized copy's original), else the key itself. */
export function originalKeyOf(key: string): string | null {
  if (!key.startsWith('_w/')) return key
  const m = /^_w\/(\d+)\/(.+)\.webp$/.exec(key)
  if (!m || !(CMS_IMAGE_WIDTHS as readonly number[]).includes(Number(m[1]))) return null
  return m[2]!
}

/** The media row a stored key belongs to (its name and type), or null when the key is not one of ours. */
export async function servedMedia(key: string): Promise<ServedMedia | null> {
  const original = originalKeyOf(key)
  if (!original) return null
  const hit = cache().get(original)
  if (hit && hit.until > Date.now()) return hit.value
  const { db, reg } = useCms()
  const [row] = await db.select({ name: reg.cmsMedia.name, mime: reg.cmsMedia.mime }).from(reg.cmsMedia).where(eq(reg.cmsMedia.key, original)).limit(1)
  const value = row ? { name: row.name ?? null, mime: row.mime } : null
  if (cache().size >= MAX_ENTRIES) cache().clear()
  cache().set(original, { value, until: Date.now() + (value ? POSITIVE_MS : NEGATIVE_MS) })
  return value
}

/** Forget a key (its file was just deleted). Other instances' copies expire by themselves. */
export function forgetServedMedia(key: string): void {
  cache().delete(key)
}

/**
 * The Content-Disposition of a served file: `inline`, and for a PDF the file's own name
 * (`filename` for old clients, `filename*` with the real characters), so "Save as" does
 * not offer a uuid. Never an attachment: the pages embed these.
 */
export function contentDispositionFor(media: ServedMedia): string {
  if (media.mime !== 'application/pdf') return 'inline'
  const base = (media.name ?? '').replace(/[\u0000-\u001f\u007f"\\/]/g, '').trim().replace(/\.pdf$/i, '').slice(0, 150) || 'document'
  const name = base + '.pdf'
  const ascii = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '_').replace(/[%;]/g, '_')
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
  return 'inline; filename="' + ascii + '"; filename*=UTF-8\'\'' + encoded
}
