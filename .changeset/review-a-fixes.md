---
'tinyzoo': patch
---

Fixes before 1.0.

- **A global may have a field named `page`, `limit`, `sort`, `dir` or `q`.** 1.0 stops at such a field in a public collection, because those are parameters of the content API's list. It stopped at a public global too, which has no list. 0.6 and 0.7 warned about a global by mistake as well.
- **The search treats a non-breaking space as a space.** A title written with one (Czech typography, or text pasted from a word processor) now ranks as high as the same title with plain spaces when a visitor types it.
- **`tinyzoo backup`, `restore`, `export` and `import` say when `cms.databaseUrl` is still in `nuxt.config.ts`.** It was removed in 1.0 and is not read. Without `DATABASE_URL`, the message now says so and links the upgrade guide, instead of only "No database".

### Upgrade

Nothing to do. A global you renamed after the 0.6 or 0.7 warning can stay as it is.
