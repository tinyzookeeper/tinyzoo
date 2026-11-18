# The content API, the typed client and the frontend kit

This page is about what your website reads. The content API is public and read-only. The admin API (`/api/cms/**`) is a separate, signed-in one and is not described here.

For every route, parameter and error, see [the content API reference](content-api-reference.md).

## Headless content API

The content API is a separate delivery API for your frontends. It is **public and read-only**, unlike the admin API, which needs a sign-in.

Each collection opts in from `cms.config.ts`:

```ts
export const Post = defineEntity('post', {
  /* …fields… */
  content: {
    public: true,
    published: (t) => eq(t.status, 'published'), // only these are served
    slug: 'slug',                                //  → GET /api/content/post/:slug
    populate: ['hero', 'author', 'tags'],        // resolved into the response
  },
})
export const Author = defineEntity('author', {
  /* … */ content: { public: true, hidden: ['email'] }, // never expose email
})
```

### The request a site makes most often

A page asks for one item by its slug. A list page asks for a list. These are the routes:

```
GET /api/content/:entity         # published list — ?page= ?limit= ?sort= ?dir= ?q= ?<field>=
GET /api/content/:entity/:slug   # single published item by slug (or id); in a page tree by its whole address (o-nas%2Ftym)
GET /api/content/_tree/:entity   # a page tree's published pages, nested, for navigation
GET /api/content/_search?q=      # the website search — ?locale= ?limit= ?entity=page,news
```

In a page tree, the item's key is its whole address, for example `o-nas%2Ftym`.

### What comes back

- Relations and media are resolved into nested objects, and the raw foreign-key ids are dropped.
- `hidden` fields are left out, on the item and on populated relations.
- A relation to a collection that is not public collapses to `{ id, title }`.
- Links to other pages (`cms:…` references) become the page's current address in the requested language. If the page is gone or not published, you get `null` or an unlinked text. See [Links that follow their page](content-model.md#links-that-follow-their-page).

### Languages

`?locale=` takes the closest language the site has. `en-US` and `EN` both give `en`. A language the site does not have is a `400`.

### Showing the content

Render stored rich text with the shipped `<CmsContent :doc="post.body" />`. It is safe: it builds VNodes from the structured doc and uses no `v-html`.

If you draw rich text yourself, expect node and mark types you do not know yet: a minor release may add one. Draw an unknown node's children, or skip it ([rich text](content-api-reference.md#rich-text)).

An all-day date arrives as midnight in the admin's time zone, in UTC. Format it in that zone ([all-day dates](content-api-reference.md#all-day-dates)).

The playground's `/blog` and `/blog/[slug]` pages are a complete consumer demo.

![blog list](../screenshots/blog-list.png)
![blog post](../screenshots/blog-post.png)

## Drafts and preview

Drafts are never served. A list leaves them out, and a single item answers `404`.

An editor's preview is the one exception. It needs a signed-in admin session or the content token. [The reference](content-api-reference.md#drafts-and-preview) has the details.

## Caching

Responses are CDN-cacheable:

```
Cache-Control: public, max-age=0, must-revalidate, s-maxage=300
```

- A CDN may keep a response for 5 minutes. That default is tuning and may change in a minor release; set your own with `cms.content.cacheControl`.
- Browsers check back every time. While nothing changed, they get a quick `304` via `ETag`, so a published change shows at once.

More in [Caching](../deploying.md#caching).

### Locking the API with a token

To lock the whole API behind a token, set `cms.content.token` or `NUXT_CMS_CONTENT_TOKEN`.

The website's own server-side requests are let through. A browser's requests are not. See [Content API token](../deploying.md#content-api-token).

## Search

`/api/content/_search` is the website search. It searches every public collection that has a `path`.

- It returns published entries only, in the requested language (entries translated into it).
- It never returns `hidden` fields.
- It reads what a visitor reads: titles, text, rich text and the text inside blocks and lists. It does not read addresses, choices or block types.
- It ignores accents and case, and needs every word.
- Other endings of a word match too: "zima" finds "zimní".
- Title matches rank first.
- Each result has its address, a snippet and the [start, end) ranges of the words found.

### Typos

The search **forgives typos**.

- One typo is allowed in a word of 4–7 letters, and two from 8 letters.
- Swapped letters count as one typo.
- The first letter is kept.

So "bazne" and "baezn" find "bazénu", and "sousterdeni" finds "soustředění".

### Choosing what is searched

Leave a collection out with `content: { search: false }`. Narrow it to some fields with `search: { fields: ['title', 'body'] }`.

The admin has its own search (⌘K). It covers everything the signed-in person may read, drafts, hidden fields and every language included.

### How it works

- It needs Postgres with the **pg_trgm** extension. Every standard Postgres image has it, CloudNativePG's included. The migration enables it, which the database owner may do.
- The `cms_search` table holds each entry's text per language.
- The table is updated on every save. It is rebuilt on start whenever the search configuration changes, or by hand with the `cms:search-reindex` task.
- Trigram indexes find the candidates. The server then checks each word by edit distance, ranks the results and cuts the snippet.

To upgrade an existing site:

1. Run `pnpm db:generate`. It writes the migration for the table, starting with `CREATE EXTENSION IF NOT EXISTS pg_trgm`.
2. Run `pnpm db:migrate`.
3. Start the site. The index fills itself on the next start.

## Typed clients & OpenAPI

There are two ways for a **separate** frontend to read the content API with full types. A separate frontend can be any framework, in its own repo, with no shared monorepo.

Both are generated from `cms.config.ts` through a single IR (`content-shape.ts`) that mirrors the runtime projection exactly. The types **cannot drift** from what the API returns.

Hidden fields (such as `author.email`) never appear. Nullability, enums and populated-relation shapes are all precise.

### The typed client: `@tinyzoo/client`

`@tinyzoo/client` is a ~2 kB, dependency-free, strictly-typed client. Generate the bindings, install the runtime, and go:

```bash
pnpm cms:client                                              # writes app/lib/cms-content.ts
# …or from anywhere with API access:
curl https://cms.example.com/api/content-types.ts -o src/cms-content.ts
npm i @tinyzoo/client
```
```ts
import { createClient } from './cms-content'
const cms = createClient({ baseUrl: 'https://cms.example.com', token: process.env.CMS_TOKEN })

const { items } = await cms.post.list({ filter: { status: 'published' }, sort: 'publishedAt', dir: 'desc' })
//      ^? Post[] — items[0].author.name, .hero?.url, .tags[0].slug are all typed
const post = await cms.post.get('hello-world') // Post, or throws CmsError on 404
const settings = await cms.global('siteSettings', { locale: 'en' }) // SiteSettings | null
```

Sort keys, filters and enum values are type-checked per collection. An invalid sort key or filter value is a compile error.

The client's own methods (`global`, `search`, `openapi`, `collection`) never collide with a collection's name. A collection named like one of them is reached with `cms.collection('search')` ([the reserved names](../api-surface.md#names-tinyzoo-keeps)).

The playground's `/blog/typed` page is a working consumer.

### Filters

- Text, choice and relation fields match exactly.
- Yes/no fields take `true` or `false`.
- Date fields take a range: `'publishedAt.from'` and `'publishedAt.to'`.

A date value is an ISO date or time. A bare date is a whole day in UTC. A time without an offset is UTC.

For example, upcoming events:

`cms.event.list({ filter: { 'startsAt.from': new Date() }, sort: 'startsAt', dir: 'asc' })`.

### `createClient` or `createCmsClient`?

They are the same client. One is typed for your site and the other is not.

| | From | Typed | Use it |
|---|---|---|---|
| `createClient(options)` | your generated `cms-content.ts` (`tinyzoo client`, or `GET /api/content-types.ts`) | **Yes**: every collection, field, sort key, filter and global of *your* config | Always, in a site |
| `createCmsClient<Schema>(options)` | `@tinyzoo/client` | Only as far as the schema you hand it | Rarely: in tooling that has no generated file, or to build your own wrapper. `createClient` is `createCmsClient<ContentSchema, GlobalSchema>` and nothing else |

Both take the same `options` (`baseUrl`, `token`, `headers`, `fetch`) and return the same `CmsClient`. There is no other name for either: the package keeps its `Cms` prefix, the generated file is the site's own.

### OpenAPI 3.1, for any language

The spec has a concrete path per public collection:

```
GET /api/openapi.json    # the document
GET /api/openapi         # interactive reference (Scalar) — development, or cms.content.docs: true
```
```bash
npx openapi-typescript https://cms.example.com/api/openapi.json -o cms.d.ts
```

The spec's `servers` URL is chosen in this order:

1. `cms.content.publicUrl`, when it is set.
2. Otherwise `cms.publicUrl` (`NUXT_CMS_PUBLIC_URL`, the address the emails and the sitemap use).
3. Otherwise it stays relative (`/`). The request Host is never reflected.

![OpenAPI reference](../screenshots/openapi-docs.png)

## The sitemap

Collections with `content.path` (for example `'/blog/:slug'`) appear in **`/sitemap.xml`** and in `GET /api/content/_sitemap`.

- Only published items are listed.
- Each entry has `hreflang` alternates, and `x-default` for the default language.
- `defineLocales({ prefix })` controls the `/en/…` prefixes.

`/sitemap.xml` is served by [`@nuxtjs/sitemap`](https://nuxtseo.com/docs/sitemap). It comes with tinyzoo, so a site does not install it. tinyzoo hands it the entries, and the module adds what it does for any Nuxt site:

- The site's own static pages (`pages/kontakt.vue`) are listed too.
- A page that robots rules keep from search engines is left out, and so is the admin. That means a `robots: false` route rule, or a `Disallow` of [`@nuxtjs/robots`](https://nuxtseo.com/docs/robots).
- A large sitemap can be split with `sitemap: { sitemaps: true, defaultSitemapsChunkSize: … }`. Opening it in a browser shows a readable table.

### Pages that are not entries

Some addresses are drawn from data, not from the site's own `pages/`. Examples are `/aktuality` drawn by a catch-all page, or a shop's sale page. There are two ways to add them, and both feed `/sitemap.xml` and `/api/content/_sitemap`.

```ts
// nuxt.config.ts — fixed pages: a full address (language prefix included), or one object per page with
// its address in each language, which makes them hreflang alternates of each other
cms: { sitemap: { paths: ['/kontakt', { cs: '/aktuality', en: '/en/news' }] } },
```

```ts
// server/plugins/sitemap.ts — addresses that come from data: the `cms:sitemap` Nitro hook gets the
// entries and may push more (it runs when the sitemap is built, at most once a minute per instance)
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('cms:sitemap', async (entries) => {
    entries.push({ loc: '/shop/sale', locale: null, lastmod: null, alternates: [] })
  })
})
```

Use the option for what never changes. It is validated at build time. Use the hook for what is computed.

An address that is in both, or is already an entry's, is listed once. `lastmod` may be `null`, and the tag is then left out.

### Details

- The sitemap is cached for an hour, on the server and in browsers. A content change clears the server's copy at once, so a new page is listed straight away.
- Its addresses start with the site's address: `NUXT_SITE_URL` (or `site.url` in `nuxt.config.ts`) when set, otherwise `NUXT_CMS_PUBLIC_URL`.
- In production without either, `/sitemap.xml` is a `404`. It never uses the address a request names, because a forged one would end up in a cached sitemap.
- Change the module's options with `sitemap: { … }` in `nuxt.config.ts`, for example `sitemap: { exclude: ['/hledat'] }`.
- `sitemap: { enabled: false }` turns `/sitemap.xml` off. `/api/content/_sitemap` stays.
- A site whose content API is behind a token (`NUXT_CMS_CONTENT_TOKEN`) keeps its entries out of the sitemap.

## The frontend kit

These components and composables are what a website draws its content with. They are **frozen from 1.0**, like the config API ([the public API](../api-surface.md#the-frontend-kit)). Their props, slots, events and return values change only in a major release.

Other `Cms*` components belong to the admin and can change in any minor.

| | |
|---|---|
| `<CmsBlocks :blocks="page.sections" />` | each block drawn by the site's `Block<Type>` component (`prefix="Section"` for `<SectionHero>`), which receives `block` and `index` |
| `<CmsImage :media="post.hero" />` | alt text, real size, lazy loading, the editor's focal point (`eager`, `sizes`, `alt`) |
| `<CmsContent :doc="post.body" />` | rich text, sanitised |
| `<CmsNav :links="nav.main" />` | a menu with dropdowns, as nested lists |
| `<CmsForm name="contactForm" />` | a website form (needs `formsPlugin()`); `locale`, event `sent`, slot `success` |
| `useCmsSeo(() => item, { siteName, defaultLocale })` | title, description, sharing image from the `seo()` fields, and the page's `canonical`, `hreflang` alternates (+ `x-default`), `og:url` and `og:locale` from the item's `paths` (absolute: they need `NUXT_CMS_PUBLIC_URL`; `path` option rewrites addresses such as the home page's `/home` → `/`). Returns `{ title, description, image, canonical }` |
| `useCmsSearch(() => route.query.q, { locale })` | the website search: results with address and snippet. Returns `{ items, total, searched, pending, error }` |
| `<CmsHighlight :text="r.excerpt" :ranges="r.highlights" />` | text with the searched words in `<mark>` |
| `useCmsUiLocale()` | Nuxt UI's own words in the admin's language on `/admin` pages: `<UApp :locale="uiLocale">` |

Every prop, slot, event and return value is listed in [the public API](../api-surface.md#the-frontend-kit). The prop types are exported from `tinyzoo`: `CmsImageProps`, `CmsBlocksProps`, and `CmsBlockProps` for your own block components, among others.
