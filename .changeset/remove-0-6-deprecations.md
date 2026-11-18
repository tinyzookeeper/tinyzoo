---
'tinyzoo': major
---

What 0.6 deprecated is removed. Each one now stops the build or the config with a message that says what to write instead.

- **`cms.databaseUrl`** in `nuxt.config.ts` is gone. The build stops if it is still set. The database address comes from `DATABASE_URL` (or `NUXT_CMS_DATABASE_URL`) in the environment, at runtime. The CLI no longer reads it from `nuxt.config.ts` either.
- **`defineEntity(name, { singleton: true })`** is gone. It is a type error, and `defineEntity` throws. `defineSingleton(name, { … })` stays.
- **`FormOptions` from `tinyzoo`** is gone. Import it from `tinyzoo/forms`.
- **`CMS_SCHEDULER_CRON` and `CMS_RETENTION_CRON`** are no longer read. The build stops if one is set, and names the option to use.
- **A field named `page`, `limit`, `sort`, `dir` or `q`** in a public collection is now an error, not a warning.

### Upgrade

1. In `nuxt.config.ts`, delete `cms.databaseUrl`. Set `DATABASE_URL` (or `NUXT_CMS_DATABASE_URL`) where the site runs, and in `.env` for the CLI.
2. In `cms.config.ts`, change `defineEntity('x', { singleton: true, … })` to `defineSingleton('x', { … })`. Same table, same address, same admin.
3. Change `import type { FormOptions } from 'tinyzoo'` to `from 'tinyzoo/forms'`.
4. If your build sets `CMS_SCHEDULER_CRON` or `CMS_RETENTION_CRON`, write `cms: { scheduler: { cron: '…' }, retention: { cron: '…' } }` in `nuxt.config.ts` instead, and remove the variables.
5. Rename a field called `page`, `limit`, `sort`, `dir` or `q` in a public collection. A rename is a migration: see "Renaming a field" in `docs/upgrading.md`.
6. Run `pnpm typecheck` and build. Both name anything left over.

A site that saw no deprecation warning on 0.6 or 0.7 has nothing to do.
