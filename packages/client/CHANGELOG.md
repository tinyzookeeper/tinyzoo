# @tinyzoo/client

## 0.5.0

No changes in this release.

## 0.4.0

No changes in this release.

## 0.3.0

No changes in this release.

## 0.2.2

No changes in this release.

## 0.2.1

No changes in this release.

## 0.2.0

### Minor Changes

- `f.group({ fields })`: a named object of fields kept together (an address, a contact) in one jsonb column, drawn as a fieldset in the admin, checked field by field, typed in `Row` / `Insert` and in the generated client, and delivered by the content API as one object with every field present (`null` when empty, media resolved). It supports `.optional()` and `.localized()` (each language has its own whole group), works inside blocks and list items, and can hold a list when it sits directly on an entry. Media, search, `content:migrate`, export and import cover it.

  Links follow their target. The link picker now stores a picked page or entry as a reference, `cms:<entity>/<id>`, instead of its address, in link fields (`format: 'link'`, menus, a block's button), in rich-text links and in redirect targets, so renaming a page or changing its address no longer breaks a menu or a link. Visitors never see a reference: the content API (lists, single items, globals and menus, entries populated into other entries, rich text, lists, blocks and groups) turns each one into the target's current address in the language asked for, with the website's language fallback, or into `null` (a link field) / an unlinked text (rich text) when the target is gone, not published or not public. Addresses typed by hand (`/path`, `https://…`, `mailto:`, `tel:`) work as before. The admin shows the target's title and address next to a link and warns when it is broken. A page that is linked to cannot be deleted (409 `in_use`, naming what links to it). `tinyzoo links:convert [--dry-run]` turns existing stored addresses that match exactly one entry into references and reports the rest. The publish webhook now also lists, in `paths`, the entries that link to an entry whose address changed (or that stopped being reachable) and names the public globals that link to it in the new optional `globals` field. `cmsMenuTree` (`@tinyzoo/client`) and `<CmsNav>` leave out menu links without an address.

  **Breaking for TypeScript, not at run time:** every `format: 'link'` field can be `null` in the content API (its target may be gone), so the generated types and the OpenAPI document change from `string` to `string | null` for a required link field (the menus' `url`; optional link fields already were). `CmsMenuLink.url` is `string | null`. The shape of the response is otherwise unchanged, and a site that never uses a reference gets a string exactly as before.

  **Upgrade**

  1. Run `tinyzoo client` (or `pnpm cms:client`) to regenerate the typed client, and fix the type errors it points at: a menu link's `url` (and any required link field you render) is now `string | null`. Render a link only when it has an address; `cmsMenuTree(nav.main)` and `<CmsNav>` already skip links without one.
  2. Nothing else is needed for the new links to work, and nothing is converted for you: links picked from now on follow their page. To convert the addresses already stored, run `tinyzoo links:convert --dry-run`, read what it would change and what it could not match (it leaves those as they are), then run it without `--dry-run` and purge the website's cache. Run `tinyzoo content:migrate` first if it reports blocks stored at an older version.
  3. If a CDN caches the content API, follow the webhook: when an entry's address changes it lists the addresses of the entries that link to it in `paths`, and names the public globals that link to it (menus, settings) in the new `globals` array. A menu is on every page, so purge everything that renders a global named there.
  4. Adding an `f.group` to an existing entity: make it `.optional()` so the new column is nullable and the migration is safe on existing rows; a required group needs a default first ("Adding a required field" in `docs/upgrading.md`).
- Page tree: `definePages({ tree: true })` lets pages sit under pages (`/o-nas/tym`). Opt-in: a site that does not set it is unchanged, and the content API of its collections does not change. For a collection that turns it on:

  - Pages get a `parent` and a `position`; the address is the chain of ancestors' address parts, each language with its own translated parts (falling back to the default). The whole address is unique per language; a loop, a tree deeper than `maxDepth` (4, up to 10) and deleting a page that has subpages are refused (422 / 422 / 409).
  - Moving a page or changing its address part changes the address of every page below it, in every language. Redirects old → new are written through `defineRedirects()` (a site without it gets none), and the change report (`cms:change`, publish webhooks) gets `moved: [{ id, locale, from, to }]` and every old and new address in `paths`.
  - A page under an unpublished page is not reachable (the content API, the sitemap, search and webhooks follow).
  - Content API: items carry `parent`, `position`, `path` and `breadcrumbs`; a page is found by its whole address (`GET /api/content/page/o-nas%2Ftym`); `GET /api/content/_tree/page` returns the published tree. `@tinyzoo/client`: `cms.page.get('o-nas/tym')` and `cms.page.tree()`. The generated types and the OpenAPI document gain these only for a tree collection (additive, not breaking).
  - Admin: the pages list is a tree (fold, drag, "Move…", the whole address); the parent picker leaves out the page and its subpages.

  Sitemap: `cms.sitemap.paths` (fixed addresses, one per language if wanted) and the `cms:sitemap` Nitro hook add addresses that are not entries to `/sitemap.xml` and `/api/content/_sitemap`; `lastmod` may be `null`.

  Also: `localePaths()` gives an address for sites without languages (key `''`); a table that points at itself is emitted with the type annotation TypeScript needs.

  **Upgrade**

  Nothing is needed unless you want the page tree:

  1. Add `tree: true` to `definePages({ … })` in `cms.config.ts`.
  2. Run `tinyzoo generate` and commit the migration. It drops the unique constraints on the page's address part (`page_slug_unique`, `page_locales_slug_unique`), adds `parent_id` (with a foreign key to the page itself) and `position` (default 0). It contains no `DROP TABLE` / `DROP COLUMN`, so it passes the guard without `--allow-drop`.
  3. Apply it with `tinyzoo up` (or at start). Existing pages stay at the top level, at the same addresses. Run `tinyzoo client` if you use the typed client.
  4. If you have no `defineRedirects()` yet, add it: without it a moved page's old address stops working.
  5. A website that fetches a page by its address passes the **whole** address, slashes escaped as one path segment (`encodeURIComponent('o-nas/tym')`; the client does it). The starter's `[...slug].vue` shows it.
- Search for the website and the admin, on Postgres only.

  Every entry with an address is indexed (`cms_search`, a `pg_trgm` index with a typo check on top), kept up to date on every save, and rebuilt by the `cms:search-reindex` task. The public API answers `GET /api/content/_search`, the admin has a search box (⌘K), and `@tinyzoo/client` gets `client.search(query, { locale, limit, collections })`, which returns each hit with its `path`, an `excerpt` and highlight ranges.

  **Upgrade**

  1. Run `tinyzoo generate` and commit the new migration. It adds the `cms_search` table and its indexes, and enables the `pg_trgm` extension (in every standard Postgres image; the database user needs the right to run `CREATE EXTENSION`, otherwise ask the database owner to do it once).
  2. Apply it with `tinyzoo up`, or let the site do it at start with `NUXT_CMS_MIGRATIONS_ON_START=true`.
  3. The index fills by itself on the next start, no manual step.
  4. A site that does not want an entity searched sets `content: { search: false }` on it.
- Starter site (what `tinyzoo init` creates), from the 0.2 audit:

  - **Languages and search engines.** `useCmsSeo()` writes `<link rel="canonical">`, `hreflang` alternates (with `x-default`), `og:url` and `og:locale` from the item's `paths` (new options `defaultLocale`, `path`, `ogLocales`); addresses start with `cms.publicUrl`, in development with the address the site is opened at. The starter's header has a language switcher that goes to the same page in the other language, else that language's home.
  - **Sitemap and robots.** The home page is `/` (and `/en`) in `/sitemap.xml`, not `/home`; the news list is in it (`cms.sitemap.paths`); `/robots.txt` keeps crawlers out of `/admin` and names the sitemap.
  - **Draft preview of the home page.** `/home?preview` keeps `?preview` when it redirects to `/`.
  - **Header and footer.** A menu with more than five links gets its own row instead of squeezing the header; nested footer links are a small column each. Menu links and buttons to the home page lead to `/`, not `/home`.
  - **Pictures.** The hero, picture block, news list and news cover say how wide they show (`sizes`), so a phone no longer downloads a 1600 px copy for a 480 px slot.
  - **Opening hours are per language.** The seeded list is `.localized()` (migration `0002_opening_hours_per_language`), with Czech and English texts; before, both languages were written into every row.
  - **Block components are typed from the generated client** (`app/lib/cms-content.ts`, now shipped in the starter): rename or remove a block field in `cms.config.ts`, run `pnpm cms:client`, and the component that still uses the old name fails `pnpm typecheck` instead of silently showing nothing. The starter's `pnpm typecheck` is now `scripts/typecheck.mjs` with vue-tsc 3: `nuxt typecheck` with vue-tsc 2 did not check templates at all (a planted error in a template passed), and vue-tsc 3 also reports findings in the CMS's own admin components, so the script keeps only this site's files.
  - The seed writes buttons to its own pages as references (they follow the page, and a second run no longer writes a typed address over a link `links:convert` converted).

  `<CmsForm>` and website forms:

  - A choice with a `default` starts on it (no empty option); a required choice has a required marker. The server words every refused field in the visitor's language (`_locale`, sent by `<CmsForm>`): "Vyberte jednu z možností." instead of "Zkontrolujte prosím tuto hodnotu.". A choice sent as `null` counts as not given: its default applies.
  - A refused field gets its red border (the rule was out-ranked by the input's own); the defaults follow the text colour, so the form reads on a dark page too (the submit button was dark on dark).
  - `f.boolean({ mustBeTrue: true })`: a consent that must be ticked. A form refuses it unticked with "Pro odeslání je potřeba toto políčko zaškrtnout." and marks it required.

  Messages that cite the docs (`tinyzoo generate`, `status`, `upgrade`, `backup`, `restore`, the migration order error and two storage warnings) give the address on GitHub, since the npm package carries no docs; a guarded column type change links the `USING` cast recipe. `tinyzoo links:convert` says fixed pages (the home page, a list) are not entries and can stay as typed. `tinyzoo` and `@tinyzoo/client` now ship a README.

  **Upgrade**

  Nothing is needed for an existing site. A site made from the starter can copy what it wants from the new starter; to type its block components from the client, import the block's type from `~/lib/cms-content` as the starter does.

## 0.1.0

The first version: a tiny, dependency-free, strictly-typed client for the public content API of a tinyzoo site.

- `createClient()` for the generated typed bindings (`tinyzoo client` or `/api/content-types.ts`), `createCmsClient()` for hand-written schemas.
- `client.<collection>.list()` and `.get()` with typed fields, filters and sort keys, plus typed globals.
- `CmsError` for non-2xx responses, a `cmsMenuTree` helper, and the OpenAPI document at `client.openapi()`.
- Works wherever `fetch` does (browser, Node, Workers, Deno, Bun); the published package ships a built `dist` with types.
