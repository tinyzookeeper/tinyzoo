---
'tinyzoo': minor
---

Breaking: table, enum, index and generated many-to-many table names are `snake_case` (`site_settings`, `site_settings_locales`, `site_settings_to_tag`), the way the columns already were. Entity names, API paths and the TypeScript names in `schema.ts` don't change. Entities named with one lowercase word (`post`, `page`) keep their tables as they are.

### Upgrade

1. Run `tinyzoo generate` **in a terminal**. For every table and enum whose name changes, drizzle-kit asks whether it was **renamed** from another one or is new. Answer *renamed* every time, and choose the old table or enum whose name matches the new one: `siteSettings` → `site_settings`, `siteSettings_locales` → `site_settings_locales`, `siteSettings_to_tag` → `site_settings_to_tag`, `contactForm_status` → `contact_form_status`. drizzle-kit lists every table that no longer exists as a possible source (for `form_settings` it also offers `siteSettings` and `siteSettings_locales`), and the first entry, *create*, is highlighted: pick the matching one with the arrow keys. Answering *created* drops the old table and its content, and picking the wrong source moves one table's rows into another.
2. Open the new migration. It should contain the renames (`ALTER TABLE "siteSettings" RENAME TO "site_settings"`, `ALTER TYPE … RENAME TO …`), plus for the tables that have foreign keys or unique indexes a `DROP CONSTRAINT` / `ADD CONSTRAINT … FOREIGN KEY` and a `DROP INDEX` / `CREATE UNIQUE INDEX` pair under the new names. That is expected and safe: the rows are not touched. It must **not** contain `DROP TABLE`, `CREATE TABLE` for one of these tables or `DROP COLUMN`. If it does, delete the migration (its `.sql` file, `meta/<number>_snapshot.json` and its entry in `meta/_journal.json`) and start over from step 1.
3. `tinyzoo generate` lists the renames in plain words and asks whether to keep the migration; this is the guard against statements the running version cannot cope with, and here the renames are what you want: answer `y` (`--allow-drop` keeps it without asking). If it lists anything else (a dropped table or column), stop and start over as in step 2.
4. Apply it with `tinyzoo up`, or at start with `NUXT_CMS_MIGRATIONS_ON_START=true`.
5. Search the site's own code for raw SQL that names a table or enum by its old camelCase name.
6. Stop the old instances before the new one migrates: the old version doesn't find the renamed tables.

Writing the migration by hand is possible but does not replace step 1: `drizzle-kit generate --custom` makes an empty migration whose snapshot still describes the old names, so the next `tinyzoo generate` asks the same questions again. Run `tinyzoo generate` in a terminal as above and change the SQL it wrote if you need to.
