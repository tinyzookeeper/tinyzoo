---
'tinyzoo': minor
---

Breaking: table, enum, index and generated many-to-many table names are `snake_case` (`site_settings`, `site_settings_locales`, `site_settings_to_tag`), the way the columns already were. Entity names, API paths and the TypeScript names in `schema.ts` don't change. Entities named with one lowercase word (`post`, `page`) keep their tables as they are.

### Upgrade

1. Run `tinyzoo generate` in a terminal. For every renamed table, drizzle-kit asks whether it was **renamed** from the old one or created: always answer *renamed* (answering *created* drops the old table and its content).
2. Open the new migration. It must contain only `RENAME` statements for these tables. If it contains `DROP` or `CREATE TABLE` for them, delete the migration and write it by hand instead, following `playground/server/db/migrations/0018_snake_case_tables.sql` (tables, enums, primary keys, foreign keys and indexes whose names contain the old table name).
3. Apply it with `tinyzoo up`, or at start with `NUXT_CMS_MIGRATIONS_ON_START=true`.
4. Search the site's own code for raw SQL that names a table or enum by its old camelCase name.
5. Stop the old instances before the new one migrates: the old version doesn't find the renamed tables.
