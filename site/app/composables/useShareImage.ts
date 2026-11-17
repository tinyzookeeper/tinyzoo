/**
 * The page's sharing image (og:image, twitter:image). One uploaded in the admin for this
 * page (its SEO fields) wins; otherwise one is drawn on request from the headline and the
 * description (components/OgImage/Tinyzoo.satori.vue). Call it once the page's content
 * has loaded: the values are read when it is called.
 */
export function useShareImage(opts: {
  title: string
  description?: string | null
  uploaded?: { url?: string | null; alt?: string | null } | null
}) {
  const site = useSiteConfig()
  const host = site.url ? new URL(site.url).host : ''
  const alt = opts.title === site.name ? opts.title : `${opts.title} – ${site.name}`
  if (opts.uploaded?.url) {
    // Absolute: crawlers do not resolve a relative og:image.
    const src = new URL(opts.uploaded.url, site.url).href
    useSeoMeta({ ogImage: src, ogImageAlt: opts.uploaded.alt || alt, twitterImage: src, twitterCard: 'summary_large_image' })
    return
  }
  defineOgImage('Tinyzoo', { title: opts.title, description: opts.description ?? '', host }, { alt })
  useSeoMeta({ twitterCard: 'summary_large_image' })
}
