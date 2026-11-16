# @tinyzoo/client

## 0.1.0

The first version: a tiny, dependency-free, strictly-typed client for the public content API of a tinyzoo site.

- `createClient()` for the generated typed bindings (`tinyzoo client` or `/api/content-types.ts`), `createCmsClient()` for hand-written schemas.
- `client.<collection>.list()` and `.get()` with typed fields, filters and sort keys, plus typed globals.
- `CmsError` for non-2xx responses, a `cmsMenuTree` helper, and the OpenAPI document at `client.openapi()`.
- Works wherever `fetch` does (browser, Node, Workers, Deno, Bun); the published package ships a built `dist` with types.
