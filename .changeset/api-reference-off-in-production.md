---
'tinyzoo': minor
---

The interactive API reference at `/api/openapi` is off in production unless `cms.content.docs: true` (`NUXT_CMS_CONTENT_DOCS=true`). It was public on the admin's origin, showed the content model and loaded `@scalar/api-reference@1` from jsDelivr with `'unsafe-inline'` allowed for scripts. It now loads one pinned version (`1.76.0`) checked by its hash (Subresource Integrity), the page's Content-Security-Policy allows scripts only from this origin and that one file, and it stays a `404` behind a content token. In development it is on as before. `/api/openapi.json` is not affected: it describes only what the public content API returns, the docs tell people to feed it to code generators, and a content token closes it.

### Upgrade

If your site publishes the reference on purpose, add `content: { docs: true }` to the `cms` options in `nuxt.config.ts` (or set `NUXT_CMS_CONTENT_DOCS=true`). Otherwise nothing: it is simply no longer there.
