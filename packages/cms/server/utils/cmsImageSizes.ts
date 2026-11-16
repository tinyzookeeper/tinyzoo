import sharp from 'sharp'

// Smaller copies of uploaded pictures, made when a page first asks for them and kept
// in storage next to the original: a phone photo shown 300 px wide should not cost
// the visitor 4 MB. Only these widths exist (nobody can make the server produce
// thousands of sizes); <CmsImage> lists them in srcset and the browser picks one.
export const CMS_IMAGE_WIDTHS = [320, 640, 960, 1280, 1920] as const
const RESIZABLE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])

export const isResizableImage = (mime: string | null | undefined) => !!mime && RESIZABLE.has(mime)
const variantKey = (key: string, width: number) => `_w/${width}/${key}.webp`

// One resize per picture and width at a time, even when many visitors ask at once.
const inflight = new Map<string, Promise<Buffer | null>>()

/** The picture `key` at `width` px as WebP: from storage, or made now and stored. */
export async function imageVariant(key: string, width: number): Promise<Buffer | null> {
  const storage = useCmsStorage()
  const vk = variantKey(key, width)
  const stored = await storage.get(vk)
  if (stored) return stored.body
  let job = inflight.get(vk)
  if (!job) {
    job = (async () => {
      const original = await storage.get(key)
      if (!original) return null
      const out = await sharp(original.body, { failOn: 'none', limitInputPixels: 80_000_000 })
        .rotate() // honour the camera's orientation
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer()
      await storage.put(vk, out, 'image/webp')
      return out
    })().finally(() => inflight.delete(vk))
    inflight.set(vk, job)
  }
  return job
}

/** Remove the smaller copies of a picture (with the original). Missing ones are fine. */
export async function deleteImageVariants(key: string): Promise<void> {
  const storage = useCmsStorage()
  await Promise.all(CMS_IMAGE_WIDTHS.map((w) => storage.delete(variantKey(key, w)).catch(() => {})))
}
