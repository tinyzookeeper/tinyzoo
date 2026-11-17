---
'tinyzoo': minor
---

`/sitemap.xml` is now served by `@nuxtjs/sitemap` (Nuxt SEO), which tinyzoo installs itself. tinyzoo hands it the same entries as before: published items at their website address in every language, `cms.sitemap.paths` and what the `cms:sitemap` hook adds. The module adds the site's own static pages, leaves out pages that robots rules keep from search engines (and the admin), can split a large sitemap, and shows a readable table in the browser. The language versions now name the default language as `x-default`. The sitemap is cached for an hour, and a content change clears the server's copy at once. Its addresses start with `NUXT_SITE_URL` (or `site.url`) when set, otherwise `NUXT_CMS_PUBLIC_URL`; in production without either it is a `404`, as before. `/api/content/_sitemap` is unchanged.

### Upgrade

1. If your `nuxt.config.ts` has `sitemap: { enabled: false }` (for example next to `@nuxtjs/seo`, because tinyzoo served the sitemap), remove it: it now turns off the only sitemap. If your site has its own `server/routes/sitemap.xml*`, remove it, or keep it and set `sitemap: { enabled: false }`.
2. Open `/sitemap.xml` on the live site. Your static pages are listed now too; leave one out with `sitemap: { exclude: ['/path'] }` or a `robots: false` route rule.
