# The content API, the typed client and the frontend kit

What the website reads. The content API is public and read-only; the admin API (`/api/cms/**`) is a separate, signed-in one and is not described here.

## Headless content API

A separate, **public, read-only** delivery API for your frontends — distinct from the
auth-gated admin API. Entities opt in from `cms.config.ts`:

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

```
GET /api/content/:entity         # published list — ?page= ?limit= ?sort= ?dir= ?q= ?<field>=
GET /api/content/:entity/:slug   # single published item by slug (or id); in a page tree by its whole address (o-nas%2Ftym)
GET /api/content/_tree/:entity   # a page tree's published pages, nested, for navigation
GET /api/content/_search?q=      # the website search — ?locale= ?limit= ?entity=page,news
```

**Search.** `/api/content/_search` searches every public collection with a `path`:
published entries only, in the requested language (entries translated into it), never
`hidden` fields. It reads what a visitor reads — titles, text, rich text and the text
inside blocks and lists, not addresses, choices or block types — ignores accents and
case, needs every word and **forgives typos**: one in a word of 4–7 letters, two from
8, swapped letters counting as one, the first letter kept ("bazne" and "baezn" find
"bazénu", "sousterdeni" finds "soustředění"); other endings of a word match too
("zima" finds "zimní"). Title matches rank first; each result has its address, a
snippet and the [start, end) ranges of the words found. Leave a collection out with
`content: { search: false }`, or narrow it with `search: { fields: ['title', 'body'] }`.
The admin has its own search (⌘K) over everything the signed-in person may read,
drafts, hidden fields and every language included.

How it works: Postgres only, with the **pg_trgm** extension (in every standard
Postgres image, CloudNativePG's included; the migration enables it, which the
database owner may do). The `cms_search` table holds each entry's text per language,
updated on every save and rebuilt on start whenever the search configuration changes
(or by hand: `cms:search-reindex` task). Trigram indexes find the candidates; the
server then checks each word by edit distance, ranks and cuts the snippet. Upgrading
an existing site: `pnpm db:generate` writes the migration for the table (starting with
`CREATE EXTENSION IF NOT EXISTS pg_trgm`), then `pnpm db:migrate`; the index fills
itself on the next start.

Links to other pages (`cms:…` references, see [Links that follow their page](content-model.md#links-that-follow-their-page)) are replaced
by the page's current address in the requested language — or `null` / an unlinked text when
it is gone or not published.

Responses resolve relations + media into nested objects, drop raw FK ids, and omit
`hidden` fields — on the item **and** on populated relations (a non-public relation target
collapses to `{ id, title }`). Drafts are never served (list excludes them; single → 404).
Responses are CDN-cacheable (`Cache-Control`: a CDN may keep them 5 minutes; browsers
check back every time and get a quick `304` via `ETag` while nothing changed, so a
published change shows at once), or lock the whole API behind a token with
`cms.content.token` / `NUXT_CMS_CONTENT_TOKEN`.

Render stored rich text on the frontend with the shipped `<CmsContent :doc="post.body" />`
(safe — builds VNodes from the structured doc, no `v-html`). The playground's `/blog` and
`/blog/[slug]` pages are a complete consumer demo.

![blog list](../screenshots/blog-list.png)
![blog post](../screenshots/blog-post.png)

## Typed clients & OpenAPI

Two ways for a **separate** frontend (any framework, its own repo — no shared monorepo)
to consume the content API with full types. Both are generated from `cms.config.ts` via a
single IR (`content-shape.ts`) that mirrors the runtime projection exactly, so the types
**cannot drift** from what the API actually returns. Hidden fields (e.g. `author.email`)
never appear; nullability, enums and populated-relation shapes are all precise.

**OpenAPI 3.1 — any language.** A spec with a concrete path per public collection:

```
GET /api/openapi.json    # the document
GET /api/openapi         # interactive reference (Scalar)
```
```bash
npx openapi-typescript https://cms.example.com/api/openapi.json -o cms.d.ts
```

**Typed TS SDK — `@tinyzoo/client`.** A ~2 kB, dependency-free, strictly-typed client.
Generate the bindings, install the runtime, go:

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

Filters match text, choice and relation fields exactly, yes/no fields with `true`/`false`,
and date fields by range — `'publishedAt.from'` / `'publishedAt.to'` (an ISO date or time;
a bare date is a whole day in UTC, a time without an offset is UTC), e.g. upcoming events:
`cms.event.list({ filter: { 'startsAt.from': new Date() }, sort: 'startsAt', dir: 'asc' })`.

Per-collection sort keys, filters and enum values are type-checked; an invalid sort key or
filter value is a compile error. Set `cms.content.publicUrl` to stamp the spec's `servers`
URL (it stays relative otherwise — the request Host is never reflected). The playground's
`/blog/typed` page is a working consumer.

![OpenAPI reference](../screenshots/openapi-docs.png)

## The sitemap

Collections with `content.path` (e.g. `'/blog/:slug'`) appear in **`/sitemap.xml`**
(published only, with `hreflang` alternates; `defineLocales({ prefix })` controls
`/en/…` prefixes) and in `GET /api/content/_sitemap`. A site can replace the XML
route with its own `server/routes/sitemap.xml`.

**Pages that are not entries.** `/sitemap.xml` lists entries with a `content.path`.
For addresses that are not entries (`/aktuality`, `/kontakt`) there are two ways, both
feeding `/sitemap.xml` and `/api/content/_sitemap`:

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

The option is for what never changes and is validated at build time; the hook is for what is
computed. An address in both, or already an entry's, is listed once. `lastmod` may be `null`
(the tag is then left out).

## The frontend kit

| | |
|---|---|
| `<CmsBlocks :blocks="page.sections" />` | each block drawn by the site's `Block<Type>` component |
| `<CmsImage :media="post.hero" />` | alt text, real size, lazy loading, the editor's focal point |
| `<CmsContent :doc="post.body" />` | rich text, sanitised |
| `<CmsNav :links="nav.main" />` | a menu with dropdowns, as nested lists |
| `<CmsForm name="contactForm" />` | a website form (needs `formsPlugin()`) |
| `useCmsSeo(() => item)` | title, description, sharing image from the `seo()` fields |
| `useCmsSearch(() => route.query.q, { locale })` | the website search: results with address and snippet |
| `<CmsHighlight :text="r.excerpt" :ranges="r.highlights" />` | text with the searched words in `<mark>` |
