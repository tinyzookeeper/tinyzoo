---
'tinyzoo': minor
---

The public API is written down before 1.0 ([docs/api-surface.md](https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/api-surface.md)): the config API, the `cms` options and `NUXT_CMS_*` variables, the content API and client, the webhook and the Nitro hooks, the CLI, and the admin's extension points. They follow semver from 1.0; everything else is internal and can change in any minor. Nothing in the content API or the generated client types changes.

- Exports of `tinyzoo` that only the server, the admin and the CLI use (the tree, search, link and migration helpers, the system tables, `buildRegistry`, `snake`, `buildColumn`…) are tagged `@internal`. They are still exported and still work, but are not promised: use what the page above lists.
- New types: `CmsWebhookPayload` and `CMS_WEBHOOK_HEADERS` (the body and headers of a publish webhook), `CmsAdminField`, `CmsFieldEditProps` and `CmsFieldCellProps` (what a custom field renderer in `cms.fields` receives). `SqlRunner`, the type of an upgrade step's `ctx.run`, is now documented as public.
- `tinyzoo help` (also `--help` and `-h`) prints every command and flag.
- The contract snapshots grew from the two files of the content API to the whole frozen surface (what each entry point exports, the `cms` options with their defaults, the hooks, the webhook, the CLI, a typed config that uses every field): a change to any of them fails a test until it is accepted on purpose, and its changeset says whether it breaks sites.
- Deprecated, removed in 1.0 (a warning at build or start names each): `cms.databaseUrl` in `nuxt.config.ts` (it writes the database address, password included, into the build: set `DATABASE_URL` in the environment); importing the `FormOptions` type from `tinyzoo` (import it from `tinyzoo/forms`); a field named `page`, `limit`, `sort`, `dir` or `q` in a collection of the public content API (it has the name of a parameter of the list, so it cannot be a filter: rename the field).

### Upgrade

Nothing is required. During 0.6, change what the warnings name, so 1.0 does not stop your site:

1. Delete `cms.databaseUrl` from `nuxt.config.ts` and set `DATABASE_URL` (or `NUXT_CMS_DATABASE_URL`) in the environment.
2. Replace `import type { FormOptions } from 'tinyzoo'` with `import type { FormOptions } from 'tinyzoo/forms'`.
3. Rename a field called `page`, `limit`, `sort`, `dir` or `q` in a public collection (a rename needs a migration: see "Renaming a field" in docs/upgrading.md).
4. If your code imports an `@internal` name from `tinyzoo`, use the documented API instead, or tell us what is missing.
