---
'tinyzoo': minor
---

tinyzoo now runs on drizzle-orm 0.45 (was 0.44) and drizzle-kit 0.31.11. drizzle-orm 0.45 escapes the names passed to `sql.identifier()` and `sql.as()` properly; before, a name with a double quote in it could break out of the SQL (tinyzoo only passes its own column and collation names there, but your own code may not). Your schema and migrations do not change: `tinyzoo generate` writes no new migration after the update, and the migration history stays readable by both versions.

### Upgrade

1. In your `package.json`, set `drizzle-orm` to `^0.45.4` and `drizzle-kit` to `^0.31.11`, then run `pnpm install`. Until you do, `tinyzoo upgrade` warns that drizzle-orm 0.44 does not fit, and your site ends up with two copies of drizzle-orm.
