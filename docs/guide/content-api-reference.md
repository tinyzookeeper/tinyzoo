# The content API reference

This page lists every route of the public content API, what it takes and what it answers. Use it to look things up.

[The content API](content-api.md) is the guide: how to switch a collection on, the typed client and the frontend kit.

The routes, parameters and answers are the same for every site. Which collections, fields and filters a site has depends on its `cms.config.ts`. The documentation on the website has a worked example for a small site, generated from [its OpenAPI document](../../test/contracts/openapi.playground.json).

The API is **public and read-only**: `GET` only, JSON, no account. It serves published content and never drafts, except for an editor's [preview](#drafts-and-preview).

The admin's own API (`/api/cms/**`) is a different thing. It is not described here and may change in any minor release. Three of its addresses are the exception, because content and emails store them: a file, a picture's smaller copy and the logo's PNG versions ([media and logo addresses](../api-surface.md#media-and-logo-addresses)).

A minor release may add keys to an answer, and new routes and parameters that start with `_`. Ignore what you do not know ([what a minor may add](../api-surface.md#what-a-minor-release-may-add)).

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

`:entity` is the collection's name in `cms.config.ts` (`post`, `event`). `:name` is a global's name.

Only collections and globals with `content.public` are there. Any other name is a `404`, as if it did not exist.

These routes are frozen from 1.0 ([the public API](../api-surface.md#the-content-api-http)). A name starting with `_` is tinyzoo's, which is why a collection's name cannot start with one.

Every error has the same shape, listed under [Errors](#errors).

## A list

**Returns** the published items of a collection, with the total.

**URL:** `GET /api/content/:entity`

```bash
curl 'https://cms.example.com/api/content/post?limit=2&sort=publishedAt&dir=desc&locale=en'
```

| Parameter | What it does |
|---|---|
| `page` | The page, from 1 (the default). Deep offsets are capped at 10,000 items: narrow with a filter instead of paging that far. The cap is [tuning](../api-surface.md#numbers-promised-and-numbers-tuned) and may change in a minor release |
| `limit` | Items per page: 1 to 100, default 20 |
| `sort` | A field to order by: `createdAt` (the default), `updatedAt`, or any of the collection's own text, number, yes/no, date, choice and slug fields that are not `hidden`. Relations, files, rich text, blocks, lists and groups cannot be sorted by. An unknown key is ignored. A collection that editors arrange by dragging (`admin.list.orderField`) comes in that order unless you ask for another |
| `dir` | `asc` or `desc` (the default). Items with an empty value come last either way. Ties keep a fixed order, so no item repeats or is skipped from one page to the next |
| `q` | Words in the title, case-insensitive: `?q=hello` finds "Hello, world". It is a plain substring match. For a search that ignores accents and forgives typos, use [the website search](#the-website-search). In a translated language the translation's title matches too |
| `locale` | The language to serve ([languages](#languages-and-paths)) |
| `<field>=` | A filter on one of the collection's fields, below |
| `<field>.from=`, `<field>.to=` | A date range on a date field, below |
| `preview` | An editor's preview ([below](#drafts-and-preview)) |

```json
{ "items": [ { "id": "…", "title": "Hello, world", "slug": "hello-world" } ], "total": 14, "page": 1, "limit": 2 }
```

Only published items are listed. `total` counts every match, not just this page.

**Errors:** `400` for a language the site does not have or a date filter that is not a date. `401` when a token is required. `404` for an unknown or non-public collection. See [Errors](#errors).

### Filters

Filters are query parameters named after a field. Several at once all have to match.

- Text, slug and choice fields match exactly: `?status=published`, `?kind=workshop`. In a translated language the translation's text matches too.
- Yes/no fields take `true` or `false`. Anything else is ignored.
- A relation to one other item (`author`) takes that item's `id`: `?author=8f2a6c1e-…`.
- Date fields take a range: `?startsAt.from=2026-07-01&startsAt.to=2026-07-31`. Either bound may stand alone.
- A parameter that is not a field of the collection, or names a `hidden` field, is ignored.
- Values are passed to the database as parameters, never as SQL.

A date value follows these rules:

- It is an ISO date or date-time.
- A bare date is a whole day in UTC, so a `to` of `2026-07-31` includes the 31st.
- A time without an offset is UTC.
- An offset (`+02:00`, `Z`) is honoured.
- A value that is not a date is a `400`.

## One item

**Returns** one published item, by its slug or id.

**URL:** `GET /api/content/:entity/:slug`

```bash
curl 'https://cms.example.com/api/content/post/hello-world?locale=en'
```

| Parameter | What it does |
|---|---|
| `:slug` | The item's slug or id, looked up as described below |
| `locale` | The language to serve ([languages](#languages-and-paths)) |
| `preview` | An editor's preview ([below](#drafts-and-preview)) |

```json
{ "item": { "id": "…", "title": "Hello, world", "slug": "hello-world", "locale": "en", "locales": ["cs", "en"], "paths": { "cs": "/blog/ahoj-svete", "en": "/en/blog/hello-world" } } }
```

**Errors:** `404` for a draft, an item that is not published and an unknown key. They are all the same `404`: the API never confirms that a draft exists. `400` for a language the site does not have. `401` when a token is required.

### How `:slug` is looked up

`:slug` is looked up in this order, and the first match wins:

1. In a translated language, a **translated slug** (`/en/christmas-cookies` before the default language's `/vanocni-cukrovi`).
2. The collection's `content.slug` field in the default language.
3. The item's **id**, when the value is a UUID. A collection without a slug field is reached by id only.

### In a page tree

In a [page tree](content-model.md#pages-under-pages-the-page-tree) the key is the page's whole address, from the top of the tree down: `o-nas/tym`.

Send it as **one** path segment: `/api/content/page/o-nas%2Ftym`. The client escapes the slash for you.

The page is looked up in the language asked for, then in the default one. A page under an unpublished page is not found.

With publishing per language, a language that is not published is not found with `?locale=` for it.

## What an item looks like

The shape follows from the collection's fields. [The typed client](content-api.md#typed-clients--openapi) and [the OpenAPI document](#the-openapi-document-and-the-typed-client) have it exactly.

What every item shares:

| | |
|---|---|
| `id` | the item's UUID |
| your fields | one key per field that is not `hidden`, under the name it has in the config. An empty optional field is `null` (a list or a gallery: `[]`), never missing |
| `createdAt`, `updatedAt` | ISO date-times |
| `locale`, `locales`, `paths` | only when the collection has translated fields: [below](#languages-and-paths) |
| `path`, `breadcrumbs` | only in a page tree: the page's address in the language served, and the pages from the top down to it (`{ title, path }` each, live pages only) |

How each kind of field arrives:

- **Relations and files are resolved**, not left as ids. The raw `…Id` column is dropped.
- A relation to a collection that is public (and listed in `content.populate`) comes as a nested item without its own relations. A relation to a collection that is not public comes as `{ id, title }`.
- A file is `{ id, url, width, height, alt, mime, focal }`. The alt text is in the language served. The focal point is in percentages (`{ x, y }`) or `null`. The storage key is never in it.
- A gallery is a list of files, each with a `caption`.
- Rich text is a ProseMirror document (`{ type: 'doc', content: [...] }`). Draw it with `<CmsContent :doc="item.body" />`, never as HTML. See [rich text](#rich-text) below.
- A block list is `[{ id, type, …the block's fields }]`.
- A list field is `[{ id, type, … }]`, with the item type from the config.
- A group is an object.
- An all-day date is midnight in the admin's time zone, sent in UTC. See [all-day dates](#all-day-dates) below.
- Links to other pages (`cms:` references, [links that follow their page](content-model.md#links-that-follow-their-page)) arrive as the page's current address in the language served. They are `null` when the page is gone or unpublished.

Hidden fields are not in a public answer, on the item or on a relation it embeds. That covers fields marked `hidden` in `content.hidden`, and fields a role-restricted `access` rule hides.

### Rich text

A rich-text field is the editor's JSON. These node and mark names are frozen for 1.x:

- nodes: `doc`, `paragraph`, `text`, `heading`, `bulletList`, `orderedList`, `listItem`, `blockquote`, `codeBlock`, `horizontalRule`, `hardBreak`, `image`;
- marks: `bold`, `italic`, `underline`, `strike`, `code`, `link`.

Their attributes are in [the public API](../api-surface.md#rich-text).

A minor release may add a node or mark type. If you draw rich text yourself, draw an unknown node's children (or its text), or skip it. Draw an unknown mark's text without it. `<CmsContent>` does that already.

A name changes only in a major release.

### All-day dates

An all-day date (`f.datetime({ allDay: true })`) is stored as midnight in the admin's time zone, `cms.admin.timeZone`. That is `Europe/Prague` unless the site sets another, for all of 1.x.

The API sends it in UTC. Midnight of 15 July in Prague is `"2026-07-14T22:00:00.000Z"`. Format it in the admin's zone, or a visitor elsewhere sees the day before:

```ts
new Date(item.startsAt).toLocaleDateString('en', { timeZone: 'Europe/Prague' })
```

## A page tree

**Returns** the published pages of a collection built with `definePages({ tree: true })`, nested, top level first. Each level is in the order editors arranged it. It is made for navigation.

**URL:** `GET /api/content/_tree/:entity?locale=`

| Parameter | What it does |
|---|---|
| `:entity` | A collection that is a page tree |
| `locale` | The language to serve ([languages](#languages-and-paths)) |

```json
{ "items": [ { "id": "…", "title": "O nás", "path": "/o-nas", "children": [ { "id": "…", "title": "Tým", "path": "/o-nas/tym", "children": [] } ] } ] }
```

Only live pages are listed. A page under an unpublished page is left out, with everything below it.

A page that is not translated into the language asked for is listed with the default language's title and address.

**Errors:** `404` for an unknown or non-public collection, or one that is not a page tree. `400` for a language the site does not have. `401` when a token is required.

## A global

**Returns** the one object of a global, such as site settings, a home page or a navigation.

**URL:** `GET /api/content/_global/:name?locale=`

| Parameter | What it does |
|---|---|
| `:name` | The global's name |
| `locale` | The language to serve ([languages](#languages-and-paths)) |
| `preview` | An editor's preview ([below](#drafts-and-preview)) |

```json
{ "item": { … } }
```

Before anyone has saved it, `item` is `null`. The answer is still a `200`.

**Errors:** `404` for an unknown or non-public global. A collection is not a global: `/api/content/:entity` on a global is a `404` that points here, and the other way round. `400` for a language the site does not have. `401` when a token is required.

## The website search

**Returns** the best matches for some words, across every public collection with an address (`content.path`).

**URL:** `GET /api/content/_search?q=…`

| Parameter | What it does |
|---|---|
| `q` | What to find. Fewer than 2 letters answer `{ query, items: [], total: 0 }` and do no work. At most 100 characters are read |
| `locale` | The language to search in: only entries translated into it ([languages](#languages-and-paths)) |
| `limit` | 1 to 50, default 10 |
| `entity` | Only these collections, comma-separated: `entity=page,news` |

```json
{ "query": "bazen", "items": [ { "entity": "page", "id": "…", "title": "Bazén", "titleHighlights": [[0, 5]], "excerpt": "…open all year…", "highlights": [[11, 16]], "path": "/en/pool", "locale": "en", "updatedAt": "2026-03-14T09:30:00.000Z" } ], "total": 1 }
```

- Only published entries are searched, and never `hidden` fields.
- The best matches come first. Title matches rank above text matches.
- Highlights are `[start, end)` character ranges into `title` and `excerpt`. Draw them with `<CmsHighlight>`.

How it matches (accents, typos, endings) and how to leave a collection out is in [the content API](content-api.md#search).

**Errors:** `429` when the search is **rate limited**, today to 120 searches a minute per visitor (a [tuned](../api-surface.md#numbers-promised-and-numbers-tuned) number). Queries shorter than 2 letters are not counted. The answer carries `Retry-After`. `400` for a language the site does not have. `401` when a token is required.

## The sitemap as JSON

**Returns** the same addresses as `/sitemap.xml` ([the sitemap](content-api.md#the-sitemap)), for a frontend that builds its own.

**URL:** `GET /api/content/_sitemap`

This route has no parameters.

```json
{ "entries": [ { "loc": "/en/blog/hello-world", "locale": "en", "lastmod": "2026-03-14T09:30:00.000Z", "alternates": [ { "locale": "cs", "loc": "/blog/ahoj-svete" }, { "locale": "en", "loc": "/en/blog/hello-world" } ] } ] }
```

- There is one entry per item and language, published only.
- `alternates` lists the item's addresses in every language, for `hreflang`.
- `lastmod` may be `null`.
- A site adds its own addresses through `cms.sitemap.paths` or the `cms:sitemap` hook.
- The addresses are paths. Put your site's address in front.

**Errors:** `401` when a token is required.

## Languages and `paths`

A site with `defineLocales(...)` serves every collection with translated fields in several languages.

- **`?locale=en`** picks the language. Without it the default language is served.
- The closest language the site has is used, so `en-US` and `EN` both give `en`. A browser's own language works as it is.
- A language the site does not have is a `400` that lists the ones it has.
- A site with one language has no `locale` parameter and ignores it.
- **Fallback.** A field that is not translated yet is served in the default language, so an item is never half empty. A translated field only counts as translated when it has text.

Three keys on an item describe its languages:

| Key | What it is |
|---|---|
| `locale` | The language the item is served in |
| `locales` | The languages it exists in. With publishing per language, only the ones it is live in |
| `paths` | Its address in each of them: `{ "cs": "/akce/zavod", "en": "/en/events/race" }` |

`paths` is there when the collection has `content.path`. The addresses follow its template (`'/blog/:slug'`, or one template per language) and the site's language prefix rule (`defineLocales({ prefix })`). They use the translated slug where there is one.

Use `paths` for a language switcher and for `hreflang` links. `useCmsSeo` does both from it. The same addresses are in `/api/content/_sitemap`.

A page tree's `path` and the tree route follow the same rules, with the ancestors' address parts translated too.

## Drafts and preview

Without `?preview`, nobody sees a draft.

`?preview` asks for what an editor sees. It is honoured only for:

- someone **signed in to the admin** (their session cookie) whose role can read the entry. The fields their role may not read are left out; or
- a request that carries **the content token** (`cms.content.token`), as `x-api-key` or `Authorization: Bearer …`. Only the website's own server-side requests may pass it as `?preview=<token>` instead: a request from outside without the header is refused with `401` before preview is looked at.

Anyone else's `?preview` changes nothing.

With a valid `?preview`:

- The single-item and global routes also serve **unpublished** entries.
- The single item adds `"preview": true` to its answer.
- The values an editor has typed but not saved yet are laid over the entry for **that editor's own requests**. This is the admin's live preview.
- The answer is never cached.

A list always serves published items only.

## The token

Left alone, the API is open. Set `cms.content.token` (`NUXT_CMS_CONTENT_TOKEN`) to close it, `/api/openapi.json` included, to everyone who comes from outside without it:

```bash
curl -H 'x-api-key: <token>' https://cms.example.com/api/content/post
curl -H 'Authorization: Bearer <token>' https://cms.example.com/api/content/post
```

- The website's own server-side requests (`useFetch`, `$fetch` while a page renders) are the site, and are let through without the token.
- A browser cannot be given the token.
- A wrong or missing token is a `401`.
- The forms and the health routes are outside the token.

The details, and what to do about a browser, are in [Content API token](../deploying.md#content-api-token).

## Caching

| Answer | `Cache-Control` |
|---|---|
| any content answer (open API) | `public, max-age=0, must-revalidate, s-maxage=300`: a CDN may keep it 5 minutes, a browser asks again every time |
| behind a token, or a preview | `private, no-store` |

Content answers carry a weak `ETag`. Send it back as `If-None-Match`, and an unchanged answer is a `304` with no body. Checking on every request is cheap, and a published change shows at once.

`cms.content.cacheControl` replaces the open API's header. Purging a CDN sooner is the [publish webhook](../deploying.md#publish-webhooks)'s job. More in [Caching](../deploying.md#caching).

## Errors

Every error is JSON. Two things in it are promised:

- the **status code**;
- **`message`**, a short text that says what went wrong.

Decide on the status. Show or log the `message`.

```json
{ "error": true, "url": "https://cms.example.com/api/content/post/nope", "statusCode": 404, "statusMessage": "Not found", "message": "Not found" }
```

The other keys (`error`, `url`, `statusCode`, `statusMessage`, and `stack` in development) come from the framework, Nitro. They may change with it.

A form's `422` also has `data`: a list with one entry per refused field. Each entry has at least a `path`, which starts with the field's key, and a `message` in the visitor's language:

```json
{ "statusCode": 422, "message": "Validation failed", "data": [ { "path": ["email"], "message": "Please enter a valid email." } ] }
```

Errors are not cached.

| Status | When |
|---|---|
| `400` | a language the site does not have (a site with one language ignores `locale`); a date filter that is not a date |
| `401` | a content token is set and the request has none, or a wrong one |
| `404` | an unknown or non-public collection or global; an item that does not exist or is not published; a tree route on a collection that is not a tree; `/api/openapi` when it is off |
| `422` | a form's submission with a refused field; `data` lists them |
| `429` | the search's limit (and a form's); `Retry-After` says how many seconds to wait |
| `304` | the `ETag` you sent still matches: use what you have |

Anything else is a fault of the server (`500`). A site's error log has the details, and the answer has none.

## The OpenAPI document and the typed client

Each site describes its own API:

- **`/api/openapi.json`**: the OpenAPI 3.1 document, with a concrete path per public collection. It is generated from `cms.config.ts` by the same code that projects the answers, so it cannot drift from them. It stays on in production, and a token closes it.
- **`/api/openapi`**: the interactive reference (Scalar). It is on in development. In production it is on only with `cms.content.docs: true` (`NUXT_CMS_CONTENT_DOCS=true`), and never behind a token, because a browser cannot send it.
- **`tinyzoo openapi [out]`**: writes the document to a file without a running site, for a code generator or CI (`--stdout` prints it).
- **`tinyzoo client [out]`**, or `/api/content-types.ts`: the typed client's bindings. `@tinyzoo/client` does the fetching.

The website's documentation renders [such a document](../../test/contracts/openapi.playground.json), the one of the playground, as a worked example: every route, parameter and response of a small blog.
