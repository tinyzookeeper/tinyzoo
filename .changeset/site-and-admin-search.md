---
'tinyzoo': minor
'@tinyzoo/client': minor
---

Search for the website and the admin, on Postgres only.

Every entry with an address is indexed (`cms_search`, a `pg_trgm` index with a typo check on top), kept up to date on every save, and rebuilt by the `cms:search-reindex` task. The public API answers `GET /api/content/_search`, the admin has a search box (⌘K), and `@tinyzoo/client` gets `client.search(query, { locale, limit, collections })`, which returns each hit with its `path`, an `excerpt` and highlight ranges.

### Upgrade

1. Run `tinyzoo generate` and commit the new migration. It adds the `cms_search` table and its indexes, and enables the `pg_trgm` extension (in every standard Postgres image; the database user needs the right to run `CREATE EXTENSION`, otherwise ask the database owner to do it once).
2. Apply it with `tinyzoo up`, or let the site do it at start with `NUXT_CMS_MIGRATIONS_ON_START=true`.
3. The index fills by itself on the next start, no manual step.
4. A site that does not want an entity searched sets `content: { search: false }` on it.
