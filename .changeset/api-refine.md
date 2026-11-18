---
'tinyzoo': minor
---

**Breaking:** a decimal (`f.number({ int: false })`) is typed `string` in `Row`, as the database and the content API have always returned it (`"19.99"`); `Insert` and `Update` take `number | string`. Typed code that read a decimal as a number stops compiling: use `Number(row.price)`. The column, the content API, the OpenAPI document and the generated client types do not change, and a decimal sent to a write may now be a number or a numeric string (the admin used to fail on one it had not touched).

API refinements before the 1.0 freeze (what each is, and why, in `docs/roadmap.md`, "0.6 P"):

- The frontend kit is part of the frozen API: `<CmsBlocks>`, `<CmsImage>`, `<CmsContent>`, `<CmsNav>`, `<CmsHighlight>`, `<CmsForm>`, `useCmsSeo()`, `useCmsSearch()` and `useCmsUiLocale()` are listed with their props, slots, events and return values in `docs/api-surface.md` and guarded by a golden file (`frontend-kit.txt`). Their props are exported types (`CmsImageProps`, `CmsBlocksProps`, `CmsBlockProps` for a site's own block components, `CmsContentProps`, `CmsNavProps`, `CmsHighlightProps`, `CmsFormProps`…). Every other `Cms*` component is the admin's and internal.
- `createClient` (generated, typed for your config) and `createCmsClient` (the untyped runtime of `@tinyzoo/client`) keep their names, and the docs now say which is which.
- `cms.content.publicUrl` falls back to `cms.publicUrl` for the OpenAPI `servers[].url`.
- New options `cms.retention.cron` (and `cms.scheduler.cron`, which existed) for the build-time cron of the scheduled tasks. `CMS_SCHEDULER_CRON` and `CMS_RETENTION_CRON` still work as deprecated aliases (a warning names them; removed in 1.0). They are read at build time.
- `defineEntity(name, { singleton: true })` is deprecated (a warning at start; removed in 1.0): use `defineSingleton(name, …)`.
- `defineForm` returns an `Entity` typed from the form's fields and its `status`, so `Row<typeof ContactForm>` is no longer loose (new type `FormStatusField`).
- `cms.forms.notifyTo` also takes a list of addresses.
- An `access` rule's `user` is typed `CmsAccessUser` (`id`, `email`, `name`, `role`, `base`, `locale`, and what an external sign-in adds as `unknown`), exported from `tinyzoo`. With external sign-in, `email`, `name` and `locale` are `''`, `''` and `null` where the sign-in sent none.
- `NUXT_CMS_AUTH_SETUP_TOKEN` stays an environment variable only (a secret: an option would be written into the build) and `CMS_ALLOW_REQUEST_ORIGIN` is documented, both with their reasons. The guides write `Entity`; `CmsEntity` is for plugin hooks only.
- One line in the roles guide: publish rights are role-wide, so a role cannot be allowed to publish one language only.

### Upgrade

1. **Run your type check after updating** (`tsc`, `nuxt typecheck`) and wrap every decimal you read as a number: `Number(row.price)`, `Number(price).toFixed(2)`. A decimal inside a block, list or group is typed `string` too; items saved before 0.6 may still hold a number there, which `Number(...)` also covers. A `.withDefault()` on a decimal takes a string (`.withDefault('0')`). Nothing changes at run time, and there is no migration.
2. Replace `defineEntity('name', { singleton: true, … })` with `defineSingleton('name', { … })` (same options, same table).
3. Replace the variables `CMS_SCHEDULER_CRON` / `CMS_RETENTION_CRON` with `cms: { scheduler: { cron }, retention: { cron } }` in `nuxt.config.ts`. They are still build time: a change needs a rebuild.
4. If an `access` rule reads a claim your external sign-in adds to the person, it is `unknown` now: check it (`typeof user.tenant === 'string'`) before you use it. Rules that read `id`, `email`, `name`, `role`, `base` or `locale` compile unchanged.
5. Nothing else needs a change: the rest is documentation, types and fallbacks. See "From 0.5 to 0.6", steps 8 to 11, in docs/upgrading.md.
