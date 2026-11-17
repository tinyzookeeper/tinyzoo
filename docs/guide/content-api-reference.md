# The content API reference

Every route of the public content API, what it takes and what it answers. [The content API](content-api.md) is the guide (how to switch a collection on, the typed client, the frontend kit); this is the page to look things up on. The routes, parameters and answers here are the same for every site; which collections, fields and filters a site has depends on its `cms.config.ts`, and the documentation on the website has a worked example for a small site, generated from [its OpenAPI document](../../test/contracts/openapi.playground.json).

The API is **public and read-only**: `GET` only, JSON, no account. It serves published content, never drafts (except for an editor's [preview](#drafts-and-preview)). The admin's own API (`/api/cms/**`) is a different thing, is not described here and may change in any minor release.

## The routes

| Route | What it returns |
|---|---|
| `GET /api/content/:entity` | the published items of a collection: `{ items, total, page, limit }` |
| `GET /api/content/:entity/:slug` | one published item, by its slug or id: `{ item }` |
| `GET /api/content/_tree/:entity` | a page tree's published pages, nested, for navigation: `{ items }` |
| `GET /api/content/_global/:name` | a global (a single object such as the site settings): `{ item }` |
| `GET /api/content/_search` | the website search: `{ query, items, total }` |
| `GET /api/content/_sitemap` | the site's public addresses: `{ entries }` |
| `GET /api/content/_form/:name`, `POST` the same | a website form's definition and its submission (`tinyzoo/forms`, [content model](content-model.md)) |
| `GET /api/openapi.json` | the OpenAPI 3.1 document of the routes above, for this site |
| `GET /api/openapi` | the same as an interactive reference (Scalar) |
| `GET /api/content-types.ts` | the typed client's bindings for this site |
| `GET /api/health/live`, `GET /api/health/ready` | liveness and readiness: `{ ok: true }`, or `503` |

`:entity` is the collection's name in `cms.config.ts` (`post`, `event`), and `:name` a global's. Only collections and globals with `content.public` are there; any other name is a `404`, as if it did not exist. These routes are frozen from 1.0 ([the public API](../api-surface.md#the-content-api-http)); a name starting with `_` is tinyzoo's, which is why a collection's name cannot start with one.

## A list

`GET /api/content/:entity`

```bash
curl 'https://cms.example.com/api/content/post?limit=2&sort=publishedAt&dir=desc&locale=en'
```

```json
{ "items": [ { "id": "…", "title": "Hello, world", "slug": "hello-world" } ], "total": 14, "page": 1, "limit": 2 }
```

Only published items. `total` counts every match, not just this page.

| Parameter | What it does |
|---|---|
| `page` | The page, from 1 (the default). Deep offsets are capped at 10 000 items: narrow with a filter instead of paging that far |
| `limit` | Items per page: 1 to 100, default 20 |
| `sort` | A field to order by: `createdAt` (the default), `updatedAt`, or any of the collection's own text, number, yes/no, date, choice and slug fields that are not `hidden`. Relations, files, rich text, blocks, lists and groups cannot be sorted by. An unknown key is ignored. A collection that editors arrange by dragging (`admin.list.orderField`) comes in that order unless you ask for another |
| `dir` | `asc` or `desc` (the default). Items with an empty value come last either way; ties keep a fixed order, so no item repeats or is skipped from one page to the next |
| `q` | Words in the title, case-insensitive: `?q=hello` finds "Hello, world" (it is a plain substring match; for a search that ignores accents and forgives typos, use [the website search](#the-website-search)). In a translated language the translation's title matches too |
| `locale` | The language to serve ([languages](#languages-and-paths)) |
| `<field>=` | A filter on one of the collection's fields, below |
| `<field>.from=`, `<field>.to=` | A date range on a date field, below |
| `preview` | An editor's preview ([below](#drafts-and-preview)) |

**Filters** are query parameters named after a field, and several at once all have to match.

- Text, slug and choice fields match exactly: `?status=published`, `?kind=workshop`. In a translated language the translation's text matches too.
- Yes/no fields take `true` or `false`; anything else is ignored.
- A relation to one other item (`author`) takes that item's `id`: `?author=8f2a6c1e-…`.
- Date fields take a range: `?startsAt.from=2026-07-01&startsAt.to=2026-07-31`. A value is an ISO date or date-time; a bare date is a whole day in UTC, so a `to` of `2026-07-31` includes the 31st; a time without an offset is UTC; an offset (`+02:00`, `Z`) is honoured. A value that is not a date is a `400`. Either bound may stand alone.
- A parameter that is not a field of the collection, or names a `hidden` field, is ignored. Values are passed to the database as parameters, never as SQL.

## One item

`GET /api/content/:entity/:slug`

```bash
curl 'https://cms.example.com/api/content/post/hello-world?locale=en'
```

```json
{ "item": { "id": "…", "title": "Hello, world", "slug": "hello-world", "locale": "en", "locales": ["cs", "en"], "paths": { "cs": "/blog/ahoj-svete", "en": "/en/blog/hello-world" } } }
```

`:slug` is looked up in this order, and the first match wins:

1. in a translated language, a **translated slug** (`/en/christmas-cookies` before the default language's `/vanocni-cukrovi`);
2. the collection's `content.slug` field in the default language;
3. the item's **id**, when the value is a UUID. A collection without a slug field is reached by id only.

In a [page tree](content-model.md#pages-under-pages-the-page-tree) the key is the page's whole address, from the top of the tree down: `o-nas/tym`, sent as **one** path segment, so `/api/content/page/o-nas%2Ftym` (the client escapes the slash for you). It is looked up in the language asked for, then in the default one, and a page under an unpublished page is not found.

A draft, an item that is not published and an unknown key are all the same `404`: the API never confirms that a draft exists. With publishing per language, a language that is not published is not found with `?locale=` for it.

## What an item looks like

The shape follows from the collection's fields, and [the typed client](content-api.md#typed-clients--openapi) and [the OpenAPI document](#the-openapi-document-and-the-typed-client) have it exactly. What every item shares:

| | |
|---|---|
| `id` | the item's UUID |
| your fields | one key per field that is not `hidden`, under the name it has in the config. An empty optional field is `null` (a list or a gallery: `[]`), never missing |
| `createdAt`, `updatedAt` | ISO date-times |
| `locale`, `locales`, `paths` | only when the collection has translated fields: [below](#languages-and-paths) |
| `path`, `breadcrumbs` | only in a page tree: the page's address in the language served, and the pages from the top down to it (`{ title, path }` each, live pages only) |

- **Relations and files are resolved**, not left as ids. A relation to a collection that is public (and listed in `content.populate`) comes as a nested item without its own relations; one to a collection that is not public as `{ id, title }`. The raw `…Id` column is dropped.
- A file is `{ id, url, width, height, alt, mime, focal }`: the alt text in the language served, the focal point as percentages (`{ x, y }`) or `null`. A gallery is a list of those, each with a `caption`. The storage key is never in it.
- Rich text is a ProseMirror document (`{ type: 'doc', content: [...] }`): draw it with `<CmsContent :doc="item.body" />`, never as HTML.
- A block list is `[{ id, type, …the block's fields }]`; a list field `[{ id, type, … }]` with the item type from the config; a group an object.
- Links to other pages (`cms:` references, [links that follow their page](content-model.md#links-that-follow-their-page)) arrive as the page's current address in the language served, or `null` when it is gone or unpublished.
- Fields marked `hidden` in `content.hidden`, and fields a role-restricted `access` rule hides, are not in a public answer, on the item or on a relation it embeds.

## A page tree

`GET /api/content/_tree/:entity?locale=`

The published pages of a collection built with `definePages({ tree: true })`, nested, top level first, each level in the order editors arranged it. Made for navigation.

```json
{ "items": [ { "id": "…", "title": "O nás", "path": "/o-nas", "children": [ { "id": "…", "title": "Tým", "path": "/o-nas/tym", "children": [] } ] } ] }
```

Only live pages: a page under an unpublished page is left out with everything below it. A page that is not translated into the language asked for is listed with the default language's title and address. A collection that is not a page tree is a `404`.

## A global

`GET /api/content/_global/:name?locale=` answers `{ "item": { … } }`, the one object of a global (site settings, a home page, a navigation). Before anyone has saved it, `item` is `null` (the answer is still a `200`). A collection is not a global: `/api/content/:entity` on a global is a `404` that points here, and the other way round.

## The website search

`GET /api/content/_search?q=…`

| Parameter | |
|---|---|
| `q` | what to find; fewer than 2 letters answer `{ query, items: [], total: 0 }` and do no work. At most 100 characters are read |
| `locale` | the language to search in: only entries translated into it ([languages](#languages-and-paths)) |
| `limit` | 1 to 50, default 10 |
| `entity` | only these collections, comma-separated: `entity=page,news` |

```json
{ "query": "bazen", "items": [ { "entity": "page", "id": "…", "title": "Bazén", "titleHighlights": [[0, 5]], "excerpt": "…open all year…", "highlights": [[11, 16]], "path": "/en/pool", "locale": "en", "updatedAt": "2026-03-14T09:30:00.000Z" } ], "total": 1 }
```

It searches every public collection with an address (`content.path`), published entries only, never `hidden` fields, best matches first (title matches rank above text matches). Highlights are `[start, end)` character ranges into `title` and `excerpt`; draw them with `<CmsHighlight>`. How it matches (accents, typos, endings) and how to leave a collection out is in [the content API](content-api.md#headless-content-api). It is **rate limited** to 120 searches a minute per visitor; past that the answer is a `429` with `Retry-After`.

## The sitemap as JSON

`GET /api/content/_sitemap` answers `{ "entries": [ … ] }`, the same addresses as `/sitemap.xml` ([the sitemap](content-api.md#the-sitemap)), for a frontend that builds its own:

```json
{ "entries": [ { "loc": "/en/blog/hello-world", "locale": "en", "lastmod": "2026-03-14T09:30:00.000Z", "alternates": [ { "locale": "cs", "loc": "/blog/ahoj-svete" }, { "locale": "en", "loc": "/en/blog/hello-world" } ] } ] }
```

One entry per item and language, published only; `alternates` lists the item's addresses in every language (for `hreflang`); `lastmod` may be `null`. A site adds its own addresses through `cms.sitemap.paths` or the `cms:sitemap` hook. The addresses are paths: put your site's address in front.

## Languages and `paths`

A site with `defineLocales(...)` serves every collection with translated fields in several languages.

- **`?locale=en`** picks the language. Without it the default language is served. The closest language the site has is used, so `en-US` and `EN` both give `en` (a browser's own language works as it is). A language the site does not have is a `400` that lists the ones it has. A site with one language has no `locale` parameter and ignores it.
- **Fallback.** A field that is not translated yet is served in the default language, so an item is never half empty. A translated field only counts as translated when it has text.
- **`locale`** on an item is the language it is served in, **`locales`** the languages it exists in (with publishing per language, only the ones it is live in), and **`paths`** its address in each of them: `{ "cs": "/akce/zavod", "en": "/en/events/race" }`. `paths` is there when the collection has `content.path`; the addresses follow its template (`'/blog/:slug'`, or one template per language) and the site's language prefix rule (`defineLocales({ prefix })`), and use the translated slug where there is one.
- Use `paths` for a language switcher and for `hreflang` links (`useCmsSeo` does both from it); the same addresses are in `/api/content/_sitemap`.
- A page tree's `path` and the tree route follow the same rules, with the ancestors' address parts translated too.

## Drafts and preview

Without `?preview`, nobody sees a draft. `?preview` asks for what an editor sees, and is honoured only for

- someone **signed in to the admin** (their session cookie) whose role can read the entry, with the fields their role may not read left out; or
- a request that carries **the content token** (`cms.content.token`), as `x-api-key`, `Authorization: Bearer …` or `?preview=<token>`.

Anyone else's `?preview` changes nothing. With it, the single-item and global routes also serve **unpublished** entries (the single item adds `"preview": true` to its answer), the values an editor has typed but not saved yet are laid over the entry for **that editor's own requests** (the admin's live preview), and the answer is never cached. A list always serves published items only.

## The token

Left alone, the API is open. `cms.content.token` (`NUXT_CMS_CONTENT_TOKEN`) closes it, `/api/openapi.json` included, to everyone who comes from outside without it:

```bash
curl -H 'x-api-key: <token>' https://cms.example.com/api/content/post
curl -H 'Authorization: Bearer <token>' https://cms.example.com/api/content/post
```

The website's own server-side requests (`useFetch`, `$fetch` while a page renders) are the site and are let through without it; a browser cannot be given the token. A wrong or missing one is a `401`. The details, and what to do about a browser, are in [Content API token](../deploying.md#content-api-token). The forms and the health routes are outside the token.

## Caching

| Answer | `Cache-Control` |
|---|---|
| any content answer (open API) | `public, max-age=0, must-revalidate, s-maxage=300`: a CDN may keep it 5 minutes, a browser asks again every time |
| behind a token, or a preview | `private, no-store` |

Content answers carry a weak `ETag`; send it back as `If-None-Match` and an unchanged answer is a `304` with no body, so checking on every request is cheap and a published change shows at once. `cms.content.cacheControl` replaces the open API's header; purging a CDN sooner is the [publish webhook](../deploying.md#publish-webhooks)'s job. More in [Caching](../deploying.md#caching).

## Errors

Every error is JSON, with the status code and a short message:

```json
{ "url": "/api/content/post/nope", "statusCode": 404, "statusMessage": "Not found", "message": "Not found" }
```

| Status | When |
|---|---|
| `400` | a language the site does not have; a date filter that is not a date |
| `401` | a content token is set and the request has none, or a wrong one |
| `404` | an unknown or non-public collection or global; an item that does not exist or is not published; a tree route on a collection that is not a tree; `/api/openapi` when it is off |
| `429` | the search's limit (and a form's); `Retry-After` says how many seconds to wait |
| `304` | the `ETag` you sent still matches: use what you have |

Anything else is a fault of the server (`500`); a site's error log has the details, the answer has none.

## The OpenAPI document and the typed client

Each site describes its own API:

- **`/api/openapi.json`**: the OpenAPI 3.1 document, a concrete path per public collection, generated from `cms.config.ts` by the same code that projects the answers, so it cannot drift from them. It stays on in production (a token closes it).
- **`/api/openapi`**: the interactive reference (Scalar). On in development; in production only with `cms.content.docs: true` (`NUXT_CMS_CONTENT_DOCS=true`), and never behind a token (a browser cannot send it).
- **`tinyzoo openapi [out]`**: writes the document to a file without a running site, for a code generator or CI (`--stdout` prints it).
- **`tinyzoo client [out]`**, or `/api/content-types.ts`: the typed client's bindings; `@tinyzoo/client` does the fetching.

The website's documentation renders [such a document](../../test/contracts/openapi.playground.json), the one of the playground, as a worked example: every route, parameter and response of a small blog.
