---
"tinyzoo": minor
---

Experimental: one build can carry several content models, and in multi-tenant mode each site uses the model its directory row names. The app's `cms.config.ts` exports `models = defineModels({ shop: { config: shop, migrations: 'models/shop/server/db/migrations' } })`, where `config` is what a model's own `cms.config.ts` exports and `migrations` is its migrations folder. A site's row gets the field `model` (in the JSON file and in the `row` of `tenant_sites`); a row without it uses the app's own `cms.config.ts`, and a row naming a model the build does not have is refused like any other bad row. `defineModels` may change in a minor release.

- `useCms().reg`, the admin graph, `/api/content-types.ts`, `/api/openapi.json`, the search, the sitemap and the forms follow the site's model. Sites of one model share one registry.
- Each model's migrations are bundled with the build, and each site is migrated with its own model's.
- Every model of a build must register the same plugins with the same options, in the same order: the build registers their pages, routes and texts once. When they differ, the build stops with a message that names the models, and so does a server start in production.
- Two models may now have a relation table of the same name: each gets its own table object, with foreign keys to its own tables.

A site whose `cms.config.ts` does not export `defineModels` runs as before.
