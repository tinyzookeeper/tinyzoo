---
'tinyzoo': minor
'@tinyzoo/client': minor
---

Page tree: `definePages({ tree: true })` lets pages sit under pages (`/o-nas/tym`). Opt-in: a site that does not set it is unchanged, and the content API of its collections does not change. For a collection that turns it on:

- Pages get a `parent` and a `position`; the address is the chain of ancestors' address parts, each language with its own translated parts (falling back to the default). The whole address is unique per language; a loop, a tree deeper than `maxDepth` (4, up to 10) and deleting a page that has subpages are refused (422 / 422 / 409).
- Moving a page or changing its address part changes the address of every page below it, in every language. Redirects old → new are written through `defineRedirects()` (a site without it gets none), and the change report (`cms:change`, publish webhooks) gets `moved: [{ id, locale, from, to }]` and every old and new address in `paths`.
- A page under an unpublished page is not reachable (the content API, the sitemap, search and webhooks follow).
- Content API: items carry `parent`, `position`, `path` and `breadcrumbs`; a page is found by its whole address (`GET /api/content/page/o-nas%2Ftym`); `GET /api/content/_tree/page` returns the published tree. `@tinyzoo/client`: `cms.page.get('o-nas/tym')` and `cms.page.tree()`. The generated types and the OpenAPI document gain these only for a tree collection (additive, not breaking).
- Admin: the pages list is a tree (fold, drag, "Move…", the whole address); the parent picker leaves out the page and its subpages.

Sitemap: `cms.sitemap.paths` (fixed addresses, one per language if wanted) and the `cms:sitemap` Nitro hook add addresses that are not entries to `/sitemap.xml` and `/api/content/_sitemap`; `lastmod` may be `null`.

Also: `localePaths()` gives an address for sites without languages (key `''`); a table that points at itself is emitted with the type annotation TypeScript needs.

### Upgrade

Nothing is needed unless you want the page tree:

1. Add `tree: true` to `definePages({ … })` in `cms.config.ts`.
2. Run `tinyzoo generate` and commit the migration. It drops the unique constraints on the page's address part (`page_slug_unique`, `page_locales_slug_unique`), adds `parent_id` (with a foreign key to the page itself) and `position` (default 0). It contains no `DROP TABLE` / `DROP COLUMN`, so it passes the guard without `--allow-drop`.
3. Apply it with `tinyzoo up` (or at start). Existing pages stay at the top level, at the same addresses. Run `tinyzoo client` if you use the typed client.
4. If you have no `defineRedirects()` yet, add it: without it a moved page's old address stops working.
5. A website that fetches a page by its address passes the **whole** address, slashes escaped as one path segment (`encodeURIComponent('o-nas/tym')`; the client does it). The starter's `[...slug].vue` shows it.
