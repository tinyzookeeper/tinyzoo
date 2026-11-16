// The page's head from a CMS item: title, description, sharing image and language,
// from the seo() fields (metaTitle, metaDescription, ogImage) with sensible fallbacks.
//
//   const { data: post } = await useFetch(`/api/content/post/${slug}`)
//   useCmsSeo(() => post.value?.item, { siteName: 'Triatlon Tábor' })
//   useCmsSeo(page, { siteName, fallback: settings })   // the site's own description and image when the page has none
export function useCmsSeo(
  item: MaybeRefOrGetter<Record<string, any> | null | undefined>,
  opts: {
    siteName?: string; titleField?: string; descriptionField?: string; imageField?: string
    /** Site-wide defaults (e.g. the site settings with seo()): their metaDescription and ogImage. */
    fallback?: MaybeRefOrGetter<{ metaDescription?: string | null; ogImage?: { url?: string } | null } | null | undefined>
  } = {},
) {
  const it = computed(() => toValue(item) ?? null)
  const title = computed(() => {
    const i = it.value
    const own = i?.metaTitle || (opts.titleField ? i?.[opts.titleField] : i?.title) || ''
    return own && opts.siteName ? `${own} · ${opts.siteName}` : own || opts.siteName || ''
  })
  const site = computed(() => toValue(opts.fallback) ?? null)
  const description = computed(() => it.value?.metaDescription || (opts.descriptionField ? it.value?.[opts.descriptionField] : '') || site.value?.metaDescription || undefined)
  const image = computed(() => it.value?.ogImage?.url || (opts.imageField ? it.value?.[opts.imageField]?.url : undefined) || site.value?.ogImage?.url || undefined)
  useSeoMeta({
    title: () => title.value || undefined,
    ogTitle: () => title.value || undefined,
    description: () => description.value,
    ogDescription: () => description.value,
    ogImage: () => image.value,
    twitterCard: () => (image.value ? 'summary_large_image' : 'summary'),
  })
  // The page's language (hreflang links to the other versions come with the sitemap).
  useHead({ htmlAttrs: { lang: () => it.value?.locale ?? undefined } })
  return { title, description, image }
}
