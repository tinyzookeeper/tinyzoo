# tinyzoo

## 0.2.2

### Patch Changes

- Image sizes are made with sharp 0.35 (was 0.34), which brings a newer libvips with its security fixes. A site that also uses `nuxt-og-image` (or anything else on sharp 0.35) now ends up with one sharp instead of two. With two, the server build put each in its own folder and sharp's Linux binary could not find libvips, so the server stopped on start with `ERR_DLOPEN_FAILED`. Sites that pinned sharp to 0.34.5 to avoid that can drop the pin. sharp 0.35 needs Node 20.9 or later; tinyzoo already needs 22.

## 0.2.1

### Patch Changes

- Uploads are parsed with `@fastify/busboy`, the Fastify team's maintained fork of `busboy` (also what Node's own `fetch` uses), instead of `busboy` 1.6, which has had no release since 2022. Its types are built in, so `@types/busboy` is gone. The upload size cap is enforced by tinyzoo's own byte count, independent of the parser. Nothing changes for sites.
- An upload on a server whose temporary folder cannot be created (a read-only container filesystem with no writable `/tmp`) now logs what to do, once: point `TMPDIR` at a writable volume, or at `/dev/shm` for small files. The upload itself answers 500 "The server has no writable folder for uploads" instead of a bare server error. The deploy guide's Media and Pushbase sections describe the setting.

## 0.2.0

### Minor Changes

- The interactive API reference at `/api/openapi` is off in production unless `cms.content.docs: true` (`NUXT_CMS_CONTENT_DOCS=true`). It was public on the admin's origin, showed the content model and loaded `@scalar/api-reference@1` from jsDelivr with `'unsafe-inline'` allowed for scripts. It now loads one pinned version (`1.76.0`) checked by its hash (Subresource Integrity), the page's Content-Security-Policy allows scripts only from this origin and that one file, and it stays a `404` behind a content token. In development it is on as before. `/api/openapi.json` is not affected: it describes only what the public content API returns, the docs tell people to feed it to code generators, and a content token closes it.

  **Upgrade**

  If your site publishes the reference on purpose, add `content: { docs: true }` to the `cms` options in `nuxt.config.ts` (or set `NUXT_CMS_CONTENT_DOCS=true`). Otherwise nothing: it is simply no longer there.
- Form messages are personal data, so by default only administrators and editors can read them. Authors could list, open and export (CSV) every message of every form, and read the recipients in the Forms settings. Now `defineForm` and `defineFormSettings` (from `tinyzoo/forms`) give `read` access to administrators and editors only: the list, a message, its history, the CSV export, search and the form's entry in the admin menu are closed to authors. `defineForm('x', { access })` widens or narrows that with the usual entity rules (`read`, `update`, `delete`; a `read` of yours replaces the default), `defineFormSettings({ access })` likewise. Documented in the forms docs and in the editors' manual (`zpravy-z-formularu.md`, `prihlaseni-a-ucet.md`).

  **Upgrade**

  If authors (or a custom role of an external sign-in) must keep reading a form's messages, say so in that form: `defineForm('contactForm', { …, access: { read: () => true } })`, or a rule that names who. Nothing else changes for administrators and editors.
- `tinyzoo generate` also stops on statements that may fail on rows that already exist: a required column without a default, `SET NOT NULL`, a new unique constraint or unique index, a new `CHECK`. The new version would otherwise fail to migrate at start and restart in a loop. Keep such a migration with `--allow-risky` (`--allow-drop` still covers statements that lose data, and does not cover these). See "Adding a required field" in `docs/upgrading.md`, which also says why `drizzle-kit push` is not supported on a tinyzoo site and how to fix an out-of-order migration that already ran in production.

  The `cms:error` report's `error` is now a scrubbed `Error` (the message and causes without the bound values of a failed database query, stack frames kept); the error as thrown moved to `report.rawError`, which can contain personal data and should not be sent to a tracker. A webhook address in the report and in the log is its origin plus a short hash of the path (Slack and Discord keep their secret in the path).

  Erasing a person in Settings → Privacy no longer strips other people's details from the audit entries they appear on: an administrator's `user.invite` entries keep the invitees' addresses.

  **Upgrade**

  If your `cms:error` plugin sends `report.error` to a tracker, nothing changes except that it is now safe to do so. Code that read the thrown error's own properties (`statusCode`, `data`) from `report.error` should read them from `report.rawError`.
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
- Plugin API: `defineCmsPlugin()` lets a package or a folder of the site add collections, admin pages with sidebar entries, server routes, field editors, admin texts, retention and upgrade steps, each under the plugin's own name. Register plugins in `cms.config.ts` with `export const plugins = [...]`. Website forms are now the first plugin, `tinyzoo/forms` (`formsPlugin()`, `defineForm`, `defineFormSettings`; `<CmsForm>`, the form endpoints, spam protection, notifications and retention come with it). The tables, the endpoints and `<CmsForm>` are unchanged. `tinyzoo up` and `tinyzoo status` include the upgrade steps of the registered plugins (recorded as `<plugin>:<id>`). How to write one: `docs/plugins.md`.

  `defineForm` and `defineFormSettings` imported from `tinyzoo` are deprecated (removed in 0.4). They keep working and register the forms plugin by themselves.

  The module now reads `cms.config.ts` while building (with jiti, as the CLI does) to find the plugins.

  **Upgrade**

  Nothing is required: a site keeps working as it is, and logs one deprecation line per helper. To move forms to the plugin (needed before 0.4):

  1. In `cms.config.ts`, import `defineForm` and `defineFormSettings` from `tinyzoo/forms` instead of `tinyzoo`, and import `formsPlugin` from there as well.
  2. Add `export const plugins = [formsPlugin()]`.

  No migration: the tables do not change (`tinyzoo generate` reports no changes).
- Private S3 buckets: `cms.storage.s3.delivery` (env `NUXT_CMS_STORAGE_S3_DELIVERY`) says how browsers get the files — `'public'` (straight from a public bucket or CDN, as before), `'proxy'` (the app streams them from a private bucket) or `'redirect'` (the app answers 302 to a signed address valid five minutes). Made for Pushbase Storage, whose objects are private; works with any S3-compatible store.

  - Under `proxy` and `redirect` the stored address is the app's own `/api/cms/_media/raw/<key>` — the local driver's, so moving from local disk to S3 keeps old rows working — and a signed address is made per request and never stored, returned by an API or put in cached HTML. Picture sizes stay `/api/cms/_media/img/<id>/<width>.webp`.
  - The raw route streams (S3 and local disk): `Range` / `206` / `Content-Range` / `Accept-Ranges` (Safari plays video), `ETag` / `If-None-Match` / `304`, `HEAD`, never the whole file in memory. A missing object is 404, any other answer of the bucket 502 without its address or credentials. The safety headers (`nosniff`, sandboxing CSP, inline, immutable caching) are unchanged. `redirect` answers with `Cache-Control: private, max-age=240`.
  - `StorageDriver` gains `read(key, { range, ifNoneMatch })` (a stream) next to `get()`, and optionally `presign(key, seconds)`.
  - Storage keys that would leave the bucket (`..`, empty segments) are refused. Requests to the bucket are retried twice, not ten times, so a failing bucket does not hold a visitor for half a minute.
  - `NUXT_CMS_STORAGE_S3_FORCE_PATH_STYLE` (injected by Pushbase) is accepted and ignored: addresses are always path-style.
  - Under `public` with a bucket that is in fact private, the first upload logs one line saying so.
  - `tinyzoo export` / `import` write the address the running app would (app path for `proxy` / `redirect`); `backup` / `restore` and the seed already read and wrote with signed requests.
  - Docs: "Pushbase / private buckets" in `docs/deploying.md`; the storage section of the README.

  **Upgrade**

  Sites on `driver: 's3'` / `'r2'` **with** `publicBaseUrl` change nothing: delivery stays `public`.

  Sites on S3/R2 **without** `publicBaseUrl` now default to `proxy` (before, the stored address was `<endpoint>/<bucket>/<key>`, which only works for a public bucket). New uploads get the app path and are served through the app; rows made earlier keep their bucket address. To keep serving straight from a public bucket, set `delivery: 'public'` (or `NUXT_CMS_STORAGE_S3_DELIVERY=public`).

  On a private bucket (Pushbase): link the storage with `--key NUXT_CMS_STORAGE_S3`, set `NUXT_CMS_STORAGE_DRIVER=s3` and nothing else.
- Seeding: `tinyzoo seed` puts the content a site starts with, written in `seed/index.ts` with `defineSeed`, into a running site.

  ```ts
  export default defineSeed(async (s) => {
    const hero = await s.upload('seed/media/hero.jpg', { alt: 'The shop front' })
    const home = await s.upsert(Page, { title: 'Home', slug: 'home', status: 'published', sections: [] }, { translations: { en: { title: 'Home' } } })
    await s.global(Navigation, { main: [s.link('Home', home)], footer: [] })
  })
  ```

  The seed goes through the admin's own API with an administrator's session, so every write meets the rules an editor's save does (validation, translations, media sizes, the search index, saved versions) and it works against a deployed site. Running it twice changes nothing: an entry is recognised by a key field (the address field by default, or `by`), a file by its name, folder and size, and only a real difference is written. `s.create` leaves an existing entry as editors have it, `s.upsert` brings it up to the seed; `--dry-run` reports what would change, `--reset` first removes what the seed owns, and a site with no account yet gets its first administrator from `SEED_EMAIL` / `SEED_PASSWORD` (and `SEED_SETUP_CODE` in production). Typed from `cms.config.ts` when you pass the entity.

  `tinyzoo init` now includes demo content for the starter (a small bakery in Czech and English, with pictures) and a `pnpm seed` script; its next steps mention it.

  `defineSeed` and its types are exported from `tinyzoo`. Nothing in the content API, the typed client or the config changes.
- Search for the website and the admin, on Postgres only.

  Every entry with an address is indexed (`cms_search`, a `pg_trgm` index with a typo check on top), kept up to date on every save, and rebuilt by the `cms:search-reindex` task. The public API answers `GET /api/content/_search`, the admin has a search box (⌘K), and `@tinyzoo/client` gets `client.search(query, { locale, limit, collections })`, which returns each hit with its `path`, an `excerpt` and highlight ranges.

  **Upgrade**

  1. Run `tinyzoo generate` and commit the new migration. It adds the `cms_search` table and its indexes, and enables the `pg_trgm` extension (in every standard Postgres image; the database user needs the right to run `CREATE EXTENSION`, otherwise ask the database owner to do it once).
  2. Apply it with `tinyzoo up`, or let the site do it at start with `NUXT_CMS_MIGRATIONS_ON_START=true`.
  3. The index fills by itself on the next start, no manual step.
  4. A site that does not want an entity searched sets `content: { search: false }` on it.
- Breaking: table, enum, index and generated many-to-many table names are `snake_case` (`site_settings`, `site_settings_locales`, `site_settings_to_tag`), the way the columns already were. Entity names, API paths and the TypeScript names in `schema.ts` don't change. Entities named with one lowercase word (`post`, `page`) keep their tables as they are.

  **Upgrade**

  1. Run `tinyzoo generate` **in a terminal**. For every table and enum whose name changes, drizzle-kit asks whether it was **renamed** from another one or is new. Answer *renamed* every time, and choose the old table or enum whose name matches the new one: `siteSettings` → `site_settings`, `siteSettings_locales` → `site_settings_locales`, `siteSettings_to_tag` → `site_settings_to_tag`, `contactForm_status` → `contact_form_status`. drizzle-kit lists every table that no longer exists as a possible source (for `form_settings` it also offers `siteSettings` and `siteSettings_locales`), and the first entry, *create*, is highlighted: pick the matching one with the arrow keys. Answering *created* drops the old table and its content, and picking the wrong source moves one table's rows into another.
  2. Open the new migration. It should contain the renames (`ALTER TABLE "siteSettings" RENAME TO "site_settings"`, `ALTER TYPE … RENAME TO …`), plus for the tables that have foreign keys or unique indexes a `DROP CONSTRAINT` / `ADD CONSTRAINT … FOREIGN KEY` and a `DROP INDEX` / `CREATE UNIQUE INDEX` pair under the new names. That is expected and safe: the rows are not touched. It must **not** contain `DROP TABLE`, `CREATE TABLE` for one of these tables or `DROP COLUMN`. If it does, delete the migration (its `.sql` file, `meta/<number>_snapshot.json` and its entry in `meta/_journal.json`) and start over from step 1.
  3. `tinyzoo generate` lists the renames in plain words and asks whether to keep the migration; this is the guard against statements the running version cannot cope with, and here the renames are what you want: answer `y` (`--allow-drop` keeps it without asking). If it lists anything else (a dropped table or column), stop and start over as in step 2.
  4. Apply it with `tinyzoo up`, or at start with `NUXT_CMS_MIGRATIONS_ON_START=true`.
  5. Search the site's own code for raw SQL that names a table or enum by its old camelCase name.
  6. Stop the old instances before the new one migrates: the old version doesn't find the renamed tables.

  Writing the migration by hand is possible but does not replace step 1: `drizzle-kit generate --custom` makes an empty migration whose snapshot still describes the old names, so the next `tinyzoo generate` asks the same questions again. Run `tinyzoo generate` in a terminal as above and change the SQL it wrote if you need to.
- A production server that cannot work now refuses to start, and says which variable is wrong, instead of answering "ready" and failing the first request: `NUXT_SESSION_PASSWORD` missing or shorter than 32 characters (the first sign-in used to answer 500), and no database address (the message now names `DATABASE_URL` and `NUXT_CMS_DATABASE_URL`, not `cms.databaseUrl`). A missing `NUXT_CMS_PUBLIC_URL` is one clear warning at start (the sitemap and the links in emails need it). Development is unchanged.

  **Upgrade**

  A site that already signs people in has a long enough `NUXT_SESSION_PASSWORD` and a database address, and needs nothing. If a deploy now stops at start with `[tinyzoo] the server cannot start`, set the variable it names (`openssl rand -base64 32` makes a session password) and deploy again; changing the password signs everyone out once.
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

### Patch Changes

- Admin shell, accessibility, phone layout and the media library (final 0.2 audit):

  - **Language.** Nuxt UI's own words (close, previous month, show password, the notifications area) follow the admin language. **One line in the site's `app.vue`:** `const uiLocale = useCmsUiLocale()` and `<UApp :locale="uiLocale">` (the starter does it; a site made from an earlier starter adds it, and without it those words stay English as before). More strings in the page's language: the invitation page's password rule, the account page's empty name (the field is marked, not a "Validation failed" toast), the select boxes' names, the breadcrumb, the design-system page's headings. The design system page is for administrators only (a link typed by anyone else goes home); "správci" and "administrátoři" are one word now.
  - **Screen readers and the keyboard.** Every admin screen is a `<main>` with a "Skip to content" link, one `<h1>` (the page's title; the editor's title field gets a hidden one), named `nav` landmarks, a named text box for every rich-text field and a named role choice in the invite dialog. Form errors are announced (`role="alert"`) and, after a failed submit, the cursor goes to the first wrong field (sign-in, setup, invitation, reset, account, invite dialog, the editor's Save); the editor's title and the redirect's "From" point at their error. Date fields no longer repeat an `id` on the page.
  - **Contrast.** `text-dimmed` (placeholders, "Optional", counts) is AA in light (54 % grey, was 2.6:1) and dark (`#A09D97`, was 3.8:1) — words are never lighter than that; `text-muted` is a step darker. Green, amber and blue status colours read as text and under white button text in light mode. `test/unit/admin-contrast.spec.ts` checks the pairs.
  - **Touch.** On a phone every control is at least 44 px: one `pointer: coarse` rule in `cms-admin.css` (`.cms-dense` opts out, `.cms-hit` widens a tap area) instead of a class per button.
  - **First frame.** The sidebar's width and fold live in a cookie instead of localStorage, so the server and the browser draw the same page (the hydration warnings on the editors and lists are gone).
  - **Signed out under an open admin.** A disabled or removed account, a changed role or password, an expired session: the next list that fails with 401 sends the person to sign-in ("You were signed out") and back to the same page afterwards; a refusal (403) says "You don't have permission for this" without a useless "Try again".
  - **Phone lists** show every row's state (new / read / done on form messages; draft, hidden, published and the missing language in the page tree); the "In progress" strip no longer repeats the rows on a phone; the bulk-action bar stays in view while scrolling; "Disable access" asks first.
  - **Navigation rows** name the page they link to (title and address) instead of `cms:page/<id>`.
  - **Media library.** Video and audio get real players (`<video controls>`, `<audio controls>`) in the panel and in media fields, and the type filter offers Video and Audio. Tiles load the 320 px copy, not the original. Gallery controls are always visible and 44 px on touch; removing a photo has "Undo". The focal point can be set with the keyboard (arrow keys; Shift for small steps). Search finds a file by its description in any language. "Too large" names the limit; uploads over the server's rate limit wait and continue (one message, not one error per file); the English "still in use" message uses English quotes; an empty library on a phone says "Upload", not "Drag".
- The sign-in form (and setup, password-reset request and reset, invitation and the account's name and password forms) is a `method="post"` form. Submitted before the page had hydrated, a form without a method is a native GET: the browser put the password in the address (`/admin/login?email=…&password=…`), the history and any proxy's or server's log. Now such a submit sends its fields in the body and the page ignores them.
- Installs cleanly into a fresh app: the type declarations for `busboy` now come with the package, and the SEO links and the API reference setting typecheck under a site's own Nuxt types. Left-over text from a closed tab is also recognised with several replicas on Redis: each replica lists the documents it has open in Redis (expiring after 90 seconds if it dies), so the last tab leaving any replica marks the document idle straight away, and an editor who opens an entry while its old copy is still waiting to be unloaded gets the current one instead of being refused.
- `tinyzoo links:convert` and `tinyzoo content:migrate` now find `DATABASE_URL` in the site's `.env`, as `tinyzoo up`, `status` and `upgrade` already did (they only read the environment and answered "DATABASE_URL is not set" on a site whose database address lives in `.env`). The development server's search index no longer fails with a bare "relation … does not exist" between saving a new collection in `cms.config.ts` and running `pnpm db:migrate`: the line now says a table is missing and what to run.
- With `NUXT_CMS_CONTENT_TOKEN` set, the website's own pages no longer render empty. The site's server-side `useFetch('/api/content/…')` got `401` and nothing was logged. Requests Nitro answers inside the server (server rendering: `useFetch`, `$fetch`, `event.$fetch`; no network hop, built from Nitro's own request object, which a request over a socket can never be) are the site itself and are let through, so the token never has to be in the site's code, its HTML or a browser; an outside request without the token still gets `401`, and `?preview` still needs the token or a session. A refusal for a missing or wrong token is logged as one line at most once a minute (with a count and what to do). A browser that calls the API itself (client-side navigation) is outside and has no token: see "Content API token" in `docs/deploying.md`.
- Text typed in a tab that closed or crashed without saving no longer turns up in the next editor's form as "Unsaved changes". When someone opens an entry and nobody else is in it, the shared document starts from the saved entry, and the left-over text waits aside with who typed it and when: a notice offers Keep (into the form as their own unsaved change) or Discard. The publish review lists unsaved shared text it would publish, and says when left-over text is still waiting for a decision. A published entry no longer opens as "unsaved" because the editor added an empty paragraph after a last heading or list, or filled in attribute defaults. Uses two side rows in `cms_collab` (names ending `~by` and `~unsaved`); no migration needed.
- Editor, history and search fixes:

  - Pasting from Word: bullet and numbered paragraphs (`mso-list`) become real lists, with nested levels; a table becomes one readable line per row (cells apart, nothing run together); pictures with a `file://`, `data:` or missing source are dropped with a notice to use the media library, instead of empty image nodes.
  - On a phone a draft with unsaved changes shows Save in the top bar (Publish moves into the menu then).
  - History shows files and related entries by name (and a thumbnail), never by id; list items stay on their own lines in the text comparison, and a one-line legend explains the highlight and strike-through.
  - Admin list search matches every word in any order, ignoring accents, and forgives a typo in longer words (trigram word similarity, as the admin search). Filters, sort and paging are unchanged.
  - The link picker searches the titles and addresses of the language being edited (and still the default language's), and puts a title that is exactly what was typed first.
  - "Take it off the website" in the editor and the page tree names how many pages under it go offline too.
- Forms a person cannot save now open read-only, with the reason. The entry and settings endpoints tell the form whether this person may save (`can: { update, why }`, the same rules a save applies: the role, someone else's entry, an entry that is live); an author opening someone else's post, the site settings, navigation, a redirect or a new tag sees a lock badge and a sentence ("Only its author or an editor can change this.") instead of fields that cannot be saved, and no Save button. A refused save shows a message in the admin's language for any status (not found, conflict, invalid, refused), never the server's English.

  Saving an empty translation no longer makes the language count as translated ("Missing: EN" and the publish warning stay); a translation emptied entirely is removed. Language names inside sentences come in the admin's own language and are phrased so no declension is needed ("Remove the translation: English?"). The German "saved … ago" no longer runs together. Switching the language on Navigation or Site settings reloads that language's values and version (no false conflict on Save translation); "The other fields are shared" shows only when there are other fields.
- Smaller editing fixes: the slug in the details panel wraps instead of being cut off; a group, list or block shows a field's problem once, on the field itself; a decimal in a whole-number field says a whole number is expected; publishing several entries from the list asks first and names them; an invitation the mail transport could not really send (`cms.mail.transport` "log") says "Invitation link for …" and shows the link (`sendCmsMail` now returns whether it was sent); removing a translation no longer toasts your own change back at you; the first item of a menu no longer offers "under the link above" (`f.boolean({ needsPrevious: true })` hides a switch on the first block of a list); the parent picker leaves out pages with no room under them; a save that changed an address says how many redirects it left (`redirects` in the save answer, `__redirects` for a translation); a redirect from the address of a live page warns in the form.
- Fixes in links that follow their target:

  - A redirect whose target is a page no longer loops when that page takes over the redirect's own address (renaming a page to the address of a redirect that led to it answered `301` to itself, forever). Such a redirect is skipped, and a redirect that leaves from an address an entry goes live at is removed when the entry is saved (any collection with an address, a translation too, or when a scheduled entry goes live), as moving a page in a tree already did.
  - A redirect whose target is a page now leads to the page in the language of the old address: `/en/old` goes to the English page, not the Czech one (by the site's `defineLocales` prefix rule; the default language otherwise). The loop check on saving a redirect uses the same rule.
  - `tinyzoo links:convert` converts an address only when it is the address of one published entry in the language the link is served in (an entry's own row: the default language; a translation: its language). Another language's address and the address of an entry that is not published are left as typed and reported (`other-language`, `draft`), instead of changing which version a link points to or turning it into nothing.
  - The publish webhook also names the pages and menus that link to the pages below a page that was moved, renamed or unpublished in a page tree (`paths`, `globals`), not only those that link to the page itself.
  - A preview (`?preview`) of a signed-in person resolves a link to a draft only when that person may read the draft; a row-level `access.read` rule is respected.
  - The link details the admin asks for no longer tell an entry that exists but may not be read from one that is gone (both are `missing`; the `restricted` state is removed), and refusing a delete because something still uses the entry names only the entries the person may read and counts the rest (`hidden` in the 409 answer).
- Invitation and password-reset mails are written in the right language. They came out in the site's default (Czech for the playground) for anyone who had not saved a language, even with an English browser. Now: the recipient's saved language; otherwise the language of the request that caused the mail (the language chosen in the admin, else the browser's `Accept-Language`) — for an invitation that is the inviting administrator's, for a reset the person asking's; only then the site's default. The invitation now names the role ("…as an editor" / "…jako editor" / "…als Redakteur"), also when it is sent again. (The language is not stored on the invitation: a re-sent invitation uses the language of whoever re-sends it.)
- A visitor who is not signed in no longer gets a `nuxt-session` cookie. Every anonymous response (the public content API, `/sitemap.xml`, the website's pages, media files, even 404s) carried `Set-Cookie: nuxt-session=…`, so a CDN would not cache it and a cookie banner became necessary. Two things caused it: nuxt-auth-utils adds a Nitro plugin when WebSockets are on (the admin's live socket is one) that reads the session on every request, which creates one; the layer now removes that plugin (the admin socket checks the session itself, and only when the request has one), and the built-in session middleware only looks at the session when the request carries the cookie. Signing in sets the cookie exactly as before.
- Security: `/api/cms/_media/raw/<key>` served any object in the storage bucket, including ones other tools had put there (with a shared bucket, anyone could read them anonymously; redirect delivery even signed them). It now serves only keys that belong to a `cms_media` row, and the resized copies of those; everything else is a `404`. PDFs are now served with their file name (`Content-Disposition: inline; filename="…"`, also in the signed address of `redirect` delivery) instead of the uuid of the stored key.
- Page tree fixes from review:

  - Moving a page no longer rewrites other people's pages. Positions are now spaced 1024 apart, so a move writes the moved page only; when two neighbours have no number between them the siblings are renumbered, and only their order changes (their version, author and saved versions stay as they were, so an open editor gets no conflict). An author can move their own draft among live pages.
  - `tinyzoo import` checks every page tree it wrote (no loops, not deeper than allowed, one page per address in each language) in the same transaction and refuses a broken tree with the pages named; with `--merge` only problems that involve imported pages count.
  - A rename or move that lands between a request reading a page and taking the tree lock can no longer slip a duplicate address through: what the request does not set is read under the lock (move, edit and translation writes).
  - A page below a draft is no longer served, listed or put in the sitemap and search when it sits deeper than `maxDepth` allows today (the limit was lowered after it was made): the whole chain of ancestors is checked, and a visitor's breadcrumbs only name live pages.
  - Titles of pages a person may not read (row-level `access.read`) are left out of parent-picker labels and of the loop and "address taken" refusals; addresses of such pages are left out of the admin tree. A page cannot be put under a parent the person may not read.
  - A visitor asking for a page by address in a language is no longer answered 404 because a draft has that address as its translation: only live pages are matched.
  - `definePages({ access })` passes row-level rules to the pages entity.
- Security: a plugin route declared `access: 'admin'` could be called by any signed-in person by adding a trailing slash to its address (the router reaches the same handler; the access check compared the exact address). The check now reads the address the way the router does, supports `**` routes, and an address in a plugin's namespace that no route declares gets the strictest rule that plugin uses anywhere.
- `tinyzoo restore` now works when the PostgreSQL client tools are newer than the database server, as they usually are on a laptop or a CI runner. A backup made by `pg_dump` 17 or 18 starts with `SET transaction_timeout = 0;`, which a PostgreSQL 16 server rejects: the restore stopped there, after it had already emptied the database. The restore now turns the dump into SQL with `pg_restore -f -`, leaves out the session settings the server does not know (and prints which), and runs it through `psql`, with the dropping of the old schemas and the loading of the backup in one transaction. If anything fails, the database is exactly as it was before, instead of empty.

  Before it changes anything, the restore now also checks that `psql` is installed (`TINYZOO_PSQL` points at another binary, like `TINYZOO_PG_DUMP` and `TINYZOO_PG_RESTORE`), and refuses a backup made by a newer `pg_dump` than the `pg_restore` it has, saying which version to install. `docs/deploying.md` ("Backups and restore") has the table of which tool version works with which server.
- `s.link(label, entry)` in a seed now stores a reference to the entry (`cms:<entity>/<id>`), as the admin's link picker does, instead of an address worked out when the seed ran. A menu made by the seed follows its page when the page is renamed or moved under another, a page under a page gets its real address (`/o-nas/tym`), and running the seed again after `tinyzoo links:convert` no longer writes plain addresses back over the references. The comparison that keeps a second run quiet treats a stored reference and the seed's as the same link. A dry run still shows a readable address for a page that does not exist yet. A seed that ran before this stores addresses in its menus: the next run brings them over to references once.

  `tinyzoo seed --reset` only removes entries the seed made: it needs proof (the entry was created by the account the seed signs in with, and after `s.create` not changed by anybody else), so a page an editor made with the same slug, or one that existed before the seed, stays. It lists every entry and file by name before it asks. It no longer stops half-way: menus and settings the seed writes lose their links to the pages that go first, entries are removed in an order the site accepts (an entry that links to or points at another goes first), and when something would still be refused, such as a page you made by hand that links to one of the seed's pages, it says which and removes nothing.

  `tinyzoo seed` warns about an `http://` address only when it really is not the machine itself: the hostname is compared whole (`localhost`, `*.localhost`, `127.0.0.1`, `::1`), so `http://localhost.example.com` and `http://127.attacker.example` are no longer taken for local. Passing the setup code as `--setup-code` prints a line saying it shows in the process list; `SEED_SETUP_CODE` is the way to give it.
- Smaller fixes from the 0.2 audit:

  - Signing in successfully no longer counts towards the sign-in limits (only failed attempts do; an office behind one address could lock itself out). Every `429` of the CMS (sign-in, forms, uploads, resets, search…) now carries `Retry-After`.
  - A form's honeypot and "too fast" answers are the same `201` as a stored message, so a robot cannot tell. `_t` stays optional, documented why.
  - CSV export: a phone number like `+420 777 123 456` is no longer prefixed with `'`; `=`, `@`, a leading tab or CR, and `+`/`-` that are not followed by a number are still neutralised.
  - The content API takes `?locale=en-US` or `EN` for the closest language the site has (`en`) instead of `400`; a language it does not have is still `400`.
  - A `404` of an unmatched route (a signed-in probe of `/api/cms/_p/…`, or a page that throws a fatal 404) is one info line without a stack, not `level: error`.
  - `tinyzoo backup` streams each media file to disk instead of reading it whole (a 400 MB video took 1.5 GB of memory).
  - Reading a file from disk for a slow visitor no longer queues the whole file in memory (`Readable.toWeb` counts its queue in chunks, so 64 KB meant 4 GB), and an upload to a bucket is sent with a plain pipe instead of `fetch`, whose request stream (undici) read most of a 300 MB file ahead of the socket.
  - `defineEntity` refuses a name that is not letters, digits and underscores (a name with a space or a dash made the generated `schema.ts` fail to compile).
- Uploads no longer pass through the server's memory. A 9.9 MB file used to cost 426 MB of RAM (about 33 times its size, so one video or a few parallel uploads killed a 256 MiB pod), and a chunked upload without `Content-Length` skipped the size cap altogether (100 MB took 1.6 GB and ended in a 500). The body is now parsed as it arrives (`busboy`), written to a temporary file and moved or streamed on to the store (local disk: a rename; S3: one signed streaming PUT). The cap counts the bytes that really come in and answers `413` as soon as it is crossed, chunked or not. The upload's quota, rate limit and type checks are unchanged.

  Also: the first bytes of a PDF, MP4, WebM or MP3 are checked like pictures were (a renamed text file called `video/mp4` is refused with 415); a picture over 80 megapixels is refused at upload with a message that states the limit (it used to upload and then answer 500 at every resized size), and a stored one that cannot be resized now answers with the original; a media field's `accept` is enforced when saving (422).
- A server error no longer reaches the log through Nitro's own dump: in production an unhandled error is hushed before Nitro sees it (the message becomes the plain "Server Error" the client already got, the causes are scrubbed copies, and it is no longer marked unhandled, which is what makes Nitro print it), so the only line written is tinyzoo's JSON line. That dump carried a failed query's bound values (emails, form text, password hashes) and the request URL with its query string. The answer to the client is unchanged; `report.rawError` of `cms:error` is a copy of the original taken first. Other `console.error(err)` calls in the package print scrubbed errors too, and a failed mail logs `<email>` instead of the address a mail server repeats. In `nuxt dev` Nitro's output stays. "Logs" in `docs/deploying.md` says what can still appear.

  Admin: the "block no longer exists" and "could not be brought up to date" cards show what the block holds, name the block when removing it, and a block removed for good asks first; the server's refusal of a whole block (newer version, unknown fields, unknown type) is shown on the block itself and unknown keys read as a sentence; the Privacy page no longer starts with an invalid-looking email field, the delete question lists what this lookup found, choices read by their label; the setup page's errors are in the page's language, its code field has the cursor and a format hint; muted and error text meet AA contrast (also on the cream sign-in page); sign-in, setup and Privacy controls are 44 px tall on touch screens.

## 0.1.0

The first version, used on the first client site. What exists:

- **Code-first content model.** `defineEntity`, `defineSingleton`, `defineBlock` and the `f.*` field factories (text, rich text, numbers, dates, select, media, gallery, relations, lists, localized fields). One definition drives the database schema, validation, the content API and the admin, with no runtime schema editor.
- **Database.** Drizzle on Postgres. `tinyzoo generate` writes `server/db/schema.ts` and the migration, `tinyzoo up` applies it, and migrations can run at start (`NUXT_CMS_MIGRATIONS_ON_START`).
- **Admin.** An automatic `/admin` with lists (search, filters, bulk actions, manual order), forms with tabs and live preview, dashboard, media library, revisions with compare and restore, scheduled publishing, dark mode, and Czech, English and German interface languages.
- **Editing.** TipTap rich text with co-editing, presence and overwrite protection in the admin.
- **Accounts.** First-run setup, invitations, password reset, admin / editor / author roles, entity- and row-level access rules, API tokens and an audit log.
- **Pages and sites.** Pages with blocks, navigation, redirects, SEO, forms with submissions, several languages with an address per language, and globals.
- **Media.** Upload with a pluggable storage driver (local disk or S3-compatible), image previews and focal points.
- **Content API.** A public, read-only content API for the site's frontend, an OpenAPI 3.1 document, and generated TypeScript types for `@tinyzoo/client`.
- **CLI.** `tinyzoo generate`, `up`, `client`, `openapi` and `init` (a new website from the starter).
- **Runs on Node 22+** (Pushbase, Docker or any VM).
