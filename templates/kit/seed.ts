// Helpers for a template's seed (`seed/index.ts`, run by `tinyzoo seed` over HTTP against a
// running site).
import type { SeedContext, SeedEntry } from 'tinyzoo'

export interface SeedPhoto {
  /** The file in the photo folder: `hero.jpg`. */
  file: string
  /** What is in the picture, for people who cannot see it, in the site's language. */
  alt: string
  /** The point to keep in view when the picture is cropped, in percent. */
  focal?: { x: number; y: number }
}

/**
 * Upload a template's photographs into the media library. Returns the id of each by its key,
 * to put into media fields and galleries. A second run uploads nothing (a file is recognised
 * by its name, folder and size).
 *
 *   const photo = await uploadPhotos(s, 'seed/media', { hero: { file: 'hero.jpg', alt: '…' } })
 *   … image: photo.hero …
 */
export async function uploadPhotos<K extends string>(s: SeedContext, dir: string, photos: Record<K, SeedPhoto>): Promise<Record<K, string>> {
  const ids = {} as Record<K, string>
  for (const key of Object.keys(photos) as K[]) {
    const p = photos[key]
    ids[key] = await s.upload(`${dir.replace(/\/+$/, '')}/${p.file}`, { alt: p.alt, ...(p.focal ? { focal: p.focal } : {}) })
  }
  return ids
}

/**
 * A link to an entry the seed made, as the admin's link picker stores it: it follows the
 * entry when it is renamed or moved. For a button or link field of a block.
 */
export const refTo = (s: SeedContext, entry: SeedEntry): string => s.link('', entry).url

/** Items of a gallery field: `gallery([photo.a, 'Caption'], photo.b)`. */
export function gallery(...items: Array<string | [media: string, caption: string]>): Array<{ mediaId: string; caption: string | null }> {
  return items.map((item) => (typeof item === 'string' ? { mediaId: item, caption: null } : { mediaId: item[0], caption: item[1] }))
}
