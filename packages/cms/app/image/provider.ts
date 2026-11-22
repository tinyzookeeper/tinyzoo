// tinyzoo's provider for @nuxt/image (module.ts makes it the default for a site that uses it).
//
// `<NuxtImg src="/img/team.jpg" sizes="100vw md:50vw">` works as before, but nothing is resized
// on the server while a visitor waits: the copies of the pictures in public/ are made when the
// site is built (src/staticImages.ts), and this only picks the smallest one at least as wide as
// the width @nuxt/image asks for (pick.ts). A picture it does not know (not in public/, an address
// on another site, a CMS file: use <CmsImage> for those) is served as it is.
//
// Only the width is honoured: the copies are WebP at fixed widths, so `fit`, `format` and
// `quality` change nothing. Crop with CSS (object-fit: cover), as with <CmsImage>.
import images from '#build/tinyzoo-static-images.mjs'
import { pickStaticImage } from './pick'

export default () => ({
  getImage(src: string, { modifiers }: { modifiers?: Record<string, unknown> }, ctx?: { options?: { nuxt?: { baseURL?: string } } }) {
    return { url: pickStaticImage(images, src, modifiers, ctx?.options?.nuxt?.baseURL) ?? src }
  },
})
