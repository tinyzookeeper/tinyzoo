---
'tinyzoo': minor
---

Breaking: table and enum names are `snake_case` (`site_settings`, `site_settings_locales`, `post_tag`), the way the columns already were.

The change renames what a site already has and touches no data. Generated names are predictable, with no quoted camelCase identifiers in hand-written SQL.

### Upgrade

1. Run `tinyzoo generate`. The new migration renames the tables, enums, constraints and indexes (`ALTER TABLE … RENAME`); no data is touched or copied.
2. Read the migration once, then apply it with `tinyzoo up` (or at start with `NUXT_CMS_MIGRATIONS_ON_START=true`).
3. Search the site's own code for raw SQL or Drizzle `sql` fragments that mention a table or enum by its old camelCase name, and rename them.
4. Roll the site over in one step: an instance of the old version does not find the renamed tables, so stop the old instances before the migration runs.

<!-- This changeset describes the "snake_case table names" slice of 0.2, which lands on its own branch. Edit the steps above to match what that slice generates, or delete this file if the slice does not ship in 0.2. -->
