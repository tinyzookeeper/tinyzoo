---
'tinyzoo': patch
'create-tinyzoo': patch
---

A new site with the Search part keeps its search page out of `/sitemap.xml`. The page says `noindex`, but the sitemap listed it. `tinyzoo init` and `pnpm create tinyzoo` now write `sitemap: { exclude: [...] }` in `nuxt.config.ts` with the search page's address in each language.

### Upgrade

Nothing to do for a new site. An existing site with the starter's search page adds the exclusion itself, with the page's address in every language (`sitemap: { exclude: ['/hledat', '/en/search'] }` for a Czech and English site), as step 6 of "From 0.4 to 0.5" in `docs/upgrading.md` says.
