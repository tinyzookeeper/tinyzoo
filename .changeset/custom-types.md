---
"tinyzoo": minor
---

Experimental: in multi-tenant mode a site can have content types of its own (`NUXT_CMS_CUSTOM_TYPES=on`). Its administrators make and change them in the admin, under *Settings › Content types*, and each type is a real table in the site's own database. A site's directory row may switch them off for that site or set its limits (`config.customTypes`). The feature may change in a minor release.

- `customTypeBlocks()` gives a design's pages two blocks that show such types: a list of entries and entries picked by hand. Spread it into the blocks of `definePages`. What the blocks store is typed as `CmsBinding`.
- A type with pages gives each entry its own address, in the sitemap and the site search.
- `GET /api/content/_types` lists a site's own types with their labels and fields; `{ types: [] }` for every other site. `GET /api/health/sites` names each site's `loads` and the version of its own types.
- Removing a field or a type hides it, with its content, for good: it leaves the admin, the API, search, the sitemap and the generated types, and can be restored at any time. An administrator deletes a removed thing for good, by hand, in the admin (*Delete for good*) or with `POST /api/cms/_model` and the operation `purge`, at the earliest a minute after it was removed. The server deletes by itself only what held nothing when it was removed, after an hour. Removed things do not count toward the limits; a site keeps at most as many removed types as its type limit, a type at most as many removed fields as its field limit.
- `tinyzoo export` and `import` refuse a site with types of its own; `tinyzoo backup` and `restore` copy them with the rest of the database.

A site without the switch runs as before.
