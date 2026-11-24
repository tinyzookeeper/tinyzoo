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

/**
 * The look a site is being made in, for a seed whose demo content is worded per look: the
 * cloud says it in `SEED_LOOK` (by hand: `SEED_LOOK=vecer pnpm seed`). An unknown or missing
 * one is the template's first look.
 */
export function seedLook<Id extends string>(looks: { ids: readonly Id[] }): Id {
  const asked = process.env.SEED_LOOK
  return looks.ids.find((id) => id === asked) ?? looks.ids[0]!
}

/** A demo's texts with some of them replaced: every key optional, at any depth; a list is replaced whole. */
export type DemoOverride<T> = T extends readonly unknown[] ? T : T extends object ? { [K in keyof T]?: DemoOverride<T[K]> } : T

/**
 * A template's demo content as one look words it: the shared texts with that look's own laid
 * over them (`demoByLook` in the template's texts). Each design of a template was written with
 * its own headings and lines; a site made in a look reads as that look's design does.
 *
 *   const d = demoFor(demo, demoByLook, seedLook(looks))
 */
export function demoFor<T extends object>(base: T, byLook: Partial<Record<string, DemoOverride<T>>>, look: string): T {
  const merge = (a: any, b: any): any => {
    if (b === undefined) return a
    if (Array.isArray(b) || b === null || typeof b !== 'object' || typeof a !== 'object' || a === null || Array.isArray(a)) return b
    const out: Record<string, unknown> = { ...a }
    for (const key of Object.keys(b)) out[key] = merge(a[key], b[key])
    return out
  }
  return merge(base, byLook[look])
}
