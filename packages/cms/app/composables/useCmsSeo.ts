// The page's head from a CMS item: title, description, sharing image, language and the
// address of the page in every language (canonical, hreflang, og:url, og:locale), from
// the seo() fields (metaTitle, metaDescription, ogImage) and the item's `paths`, with
// sensible fallbacks.
//
//   const { data: post } = await useFetch(`/api/content/post/${slug}`)
//   useCmsSeo(() => post.value?.item, { siteName: 'Triatlon Tábor' })
//   useCmsSeo(page, { siteName, fallback: settings })   // the site's own description and image when the page has none
//   useCmsSeo(page, { siteName, defaultLocale: 'cs' })   // hreflang="x-default" points at the Czech version
//
// Addresses are absolute (canonical and hreflang must be): they start with the site's
// address, `cms.publicUrl` (NUXT_CMS_PUBLIC_URL; in development the address you open the
// site at). Without either — a production site that has not set it — the address tags
// are left out rather than guessed from a request header.
export function useCmsSeo(
  item: MaybeRefOrGetter<Record<string, any> | null | undefined>,
  opts: {
    siteName?: string; titleField?: string; descriptionField?: string; imageField?: string
    /** Site-wide defaults (e.g. the site settings with seo()): their metaDescription and ogImage. */
    fallback?: MaybeRefOrGetter<{ metaDescription?: string | null; ogImage?: { url?: string } | null } | null | undefined>
    /** The site's default language: its version is hreflang="x-default" (the first version when not given). */
    defaultLocale?: string
    /** How an address from the content API is written on the website: the home page of a site is `/`, not `/home`. */
    path?: (path: string, locale: string) => string
    /** og:locale per language code when the guess (cs → cs_CZ) is not what you want: { en: 'en_GB' }. */
    ogLocales?: Record<string, string>
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

  // The site's own address, worked out on the server (where the configuration is) and
  // carried to the browser, so client-side navigation writes the same tags.
  const base = useState<string>('cms-seo-base', () => {
    if (!import.meta.server) return ''
    const configured = String((useRuntimeConfig() as any).cms?.publicUrl || '').replace(/\/+$/, '')
    return configured || (import.meta.dev ? useRequestURL().origin : '')
  })
  // This item in every language it exists in: { cs: '/o-nas', en: '/en/about' }.
  const versions = computed(() => {
    const paths = it.value?.paths
    if (!paths || typeof paths !== 'object') return [] as { locale: string; href: string }[]
    return Object.entries(paths as Record<string, string>)
      .filter(([, p]) => typeof p === 'string' && p.startsWith('/'))
      .map(([locale, p]) => ({ locale, href: (opts.path ? opts.path(p, locale) : p) }))
  })
  const locale = computed<string | undefined>(() => it.value?.locale ?? undefined)
  const canonical = computed(() => {
    if (!base.value) return undefined
    // A page shown in a language it has no version in (the default language's text) belongs to the version it is.
    const own = versions.value.find((v) => v.locale === locale.value) ?? versions.value.find((v) => v.locale === opts.defaultLocale) ?? versions.value[0]
    return own ? base.value + own.href : undefined
  })
  const ogLocale = (code: string) => {
    const lang = code.split(/[-_]/)[0]!.toLowerCase()
    return opts.ogLocales?.[code] ?? opts.ogLocales?.[lang] ?? (code.includes('-') || code.includes('_') ? code.replace('-', '_') : OG_TERRITORY[lang] ?? lang)
  }

  useSeoMeta({
    title: () => title.value || undefined,
    ogTitle: () => title.value || undefined,
    description: () => description.value,
    ogDescription: () => description.value,
    ogImage: () => image.value,
    ogUrl: () => canonical.value,
    ogLocale: () => (locale.value ? ogLocale(locale.value) : undefined),
    ogLocaleAlternate: () => (locale.value ? versions.value.filter((v) => v.locale !== locale.value).map((v) => ogLocale(v.locale)) : undefined),
    twitterCard: () => (image.value ? 'summary_large_image' : 'summary'),
  })
  useHead({
    htmlAttrs: { lang: () => locale.value },
    link: () => {
      if (!base.value) return []
      // Each shape spelled out: unhead's link types are a union keyed on `rel`, which a loose { rel: string } does not satisfy.
      const links: ({ rel: 'canonical'; href: string } | { rel: 'alternate'; hreflang: string; href: string })[] = []
      if (canonical.value) links.push({ rel: 'canonical', href: canonical.value })
      // The versions point at each other (itself included); one version alone has nothing to say.
      if (versions.value.length > 1) {
        for (const v of versions.value) links.push({ rel: 'alternate', hreflang: v.locale, href: base.value + v.href })
        const def = versions.value.find((v) => v.locale === opts.defaultLocale) ?? versions.value[0]!
        links.push({ rel: 'alternate', hreflang: 'x-default', href: base.value + def.href })
      }
      return links
    },
  })
  return { title, description, image, canonical }
}

/** og:locale wants language_TERRITORY; the common languages' usual territory (a guess for the rest is the bare language). */
const OG_TERRITORY: Record<string, string> = {
  cs: 'cs_CZ', sk: 'sk_SK', en: 'en_US', de: 'de_DE', pl: 'pl_PL', fr: 'fr_FR', es: 'es_ES', it: 'it_IT', nl: 'nl_NL', pt: 'pt_PT', hu: 'hu_HU', uk: 'uk_UA',
}
