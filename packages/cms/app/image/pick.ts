// Which copy of a picture in public/ a <NuxtImg> gets (app/image/provider.ts). No imports: the
// unit tests call it as it is.

export interface StaticImageEntry { h: string; width: number; height: number; w: number[] }

/** The path a page wrote, without query or fragment, with its characters as in the file name. */
function pathOf(src: string): string {
  const path = src.split(/[?#]/, 1)[0] ?? ''
  try { return decodeURI(path) }
  catch { return path }
}

/**
 * The address of the smallest copy at least as wide as asked (`width`, or the width that goes
 * with `height`), the largest when none is; the picture's own width when no size is asked.
 * `null` for a picture that has no copies (not in public/, too small, another site's address).
 */
export function pickStaticImage(manifest: Record<string, StaticImageEntry>, src: string, modifiers: Record<string, unknown> = {}, baseURL = '/'): string | null {
  const image = manifest[pathOf(src)]
  if (!image) return null
  let wanted = Number(modifiers.width) || 0
  if (!wanted && Number(modifiers.height)) wanted = Math.ceil(Number(modifiers.height) * image.width / image.height)
  const width = wanted ? (image.w.find((w) => w >= wanted) ?? image.w[image.w.length - 1]!) : image.width
  return `${baseURL.replace(/\/+$/, '')}/_tz/img/${image.h}/${width}.webp`
}
