// What the admin knows about a library file: its kind, a small copy to draw in a grid, and
// uploading several files in turns (the server takes a limited number a minute).

export type CmsMediaKind = 'image' | 'video' | 'audio' | 'pdf' | 'file'

export function cmsMediaKind(m: { mime?: string | null } | null | undefined): CmsMediaKind {
  const mime = String(m?.mime ?? '')
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime === 'application/pdf') return 'pdf'
  return 'file'
}
export const cmsMediaIcon = (m: { mime?: string | null } | null | undefined) => ({
  image: 'i-lucide-image', video: 'i-lucide-film', audio: 'i-lucide-music', pdf: 'i-lucide-file-text', file: 'i-lucide-file',
})[cmsMediaKind(m)]

// The kinds the server makes smaller WebP copies of (server/utils/cmsImageSizes.ts); a GIF
// (it would stop moving) or an SVG has only its original.
const RESIZABLE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
const WIDTHS = [320, 640, 960, 1280, 1920]

/**
 * What to put in an `<img>` that shows the file small: the matching smaller copy
 * (`/api/cms/_media/img/<id>/320.webp`, a few kB) when there is one, else the original —
 * a picture already that small, or a kind with no copies. A grid of 24 tiles that loads the
 * originals is 10 MB; this is a few hundred kB.
 */
export function cmsThumbUrl(m: { id?: string; url: string; mime?: string | null; width?: number | null } | null | undefined, width = 320): string {
  if (!m) return ''
  if (!m.id || !RESIZABLE.has(String(m.mime)) || !WIDTHS.includes(width)) return m.url
  if (m.width && m.width <= width) return m.url
  return `/api/cms/_media/img/${m.id}/${width}.webp`
}

/** `@error` of a thumbnail: if its smaller copy is not there (yet), show the original, once. */
export function cmsThumbFallback(e: Event, original: string) {
  const img = e.target as HTMLImageElement
  if (img.dataset.fallback) return
  img.dataset.fallback = '1'
  img.src = original
}

/**
 * Upload one file. When the server says "too many uploads" (429) it is not a failure of the
 * file: wait the time the server names (Retry-After, else a few seconds) and try again, up to
 * a couple of minutes. `onWait` says so once, so 60 files make one message, not 60 errors.
 */
export async function cmsUploadFile(form: FormData, { onWait, signal }: { onWait?: (seconds: number) => void; signal?: AbortSignal } = {}): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await $fetch('/api/cms/_media', { method: 'POST', body: form, signal })
    }
    catch (err: any) {
      const status = err?.statusCode ?? err?.status ?? err?.response?.status
      if (status !== 429 || attempt >= 12) throw err
      const header = Number(err?.response?.headers?.get?.('retry-after'))
      const seconds = Math.min(30, Math.max(3, Number.isFinite(header) && header > 0 ? header : 6 + attempt * 2))
      onWait?.(seconds)
      await new Promise((r) => setTimeout(r, seconds * 1000))
    }
  }
}
