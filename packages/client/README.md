# @tinyzoo/client

A tiny (~2 kB), dependency-free, **strictly-typed** client for the public content
API of a [tinyzoo](https://github.com/tinyzookeeper/tinyzoo) instance. Works in any framework or runtime with
`fetch` (browser, Node 18+, Workers, Deno, Bun).

It carries no knowledge of your specific schema — all types come from a generated
`cms-content.ts`, so this runtime is stable across schema changes.

## Setup (separate frontend app)

1. Generate the typed bindings from your running CMS:

   ```sh
   curl https://cms.example.com/api/content-types.ts -o src/cms-content.ts
   # or, with repo access: `tinyzoo client --stdout > src/cms-content.ts`
   ```

2. Install this runtime:

   ```sh
   npm i @tinyzoo/client
   ```

3. Use it — fully typed, with autocomplete on collections, fields, sort keys and filters:

   ```ts
   import { createClient } from './cms-content'

   const cms = createClient({ baseUrl: 'https://cms.example.com' })

   const { items, total } = await cms.post.list({
     filter: { status: 'published' }, // ← typed: 'draft' | 'published'
     sort: 'publishedAt',             // ← typed to this collection's sort keys
     dir: 'desc',
     limit: 10,
   })
   //     ^? Post[]

   const post = await cms.post.get('hello-world')
   //    ^? Post — post.author.name, post.hero?.url, post.tags[0].slug all typed
   ```

## API

- **`createClient(options)` is what a site uses.** It comes from the generated `cms-content.ts`, and
  is typed for your config: every collection, field, sort key, filter and global.
- **`createCmsClient<Schema, Globals>(options)` is what this package exports.** It is the same client with
  no knowledge of your site: it is typed only as far as the schema you pass. Reach for it in tooling that has
  no generated file, or to wrap it yourself. (`createClient` is `createCmsClient<ContentSchema, GlobalSchema>`
  and nothing more; there is no alias for either.)
- Both take the same `options`, and return the same `CmsClient`:
  - `baseUrl` — CMS origin (use `''` for same-origin in the browser).
  - `token` — sent as `x-api-key` when the content API is gated.
  - `headers`, `fetch` — optional overrides.
- `client.<collection>.list(params?)` → `{ items, total, page, limit }`.
- `client.<collection>.get(slugOrId)` → the item (throws `CmsError` on 404).
- `client.collection(name)` — same, with a runtime name.
- `client.search(query, { locale?, limit?, collections? })` — the website search: published entries of every collection with an address, best first, each with its `path`, an `excerpt` and highlight ranges.
- `client.openapi()` — fetch the OpenAPI 3.1 document.

Non-2xx responses throw `CmsError` (`.status`, `.statusText`, `.url`, `.body`).

## Prefer OpenAPI / another language?

Every CMS also serves an OpenAPI 3.1 document at `/api/openapi.json` (docs UI at
`/api/openapi`). Generate a client in any language from it — e.g.
`npx openapi-typescript https://cms.example.com/api/openapi.json -o cms.d.ts`.

## Documentation and licence

The docs are on GitHub, not in the package: [Getting started](https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/guide/getting-started.md) and
[the content API](https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/guide/content-api.md).
Proprietary, all rights reserved (see `LICENSE`).
