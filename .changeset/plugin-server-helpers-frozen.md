---
'tinyzoo': minor
---

Two server helpers for plugins are now part of the frozen API: `useCms()` and `requireCmsUser(event)`. A plugin's route uses them to reach the database and the signed-in person, so a plugin with `"tinyzoo": "^1.0.0"` can rely on them.

- `useCms()` returns at least `{ db, reg }`: the site's drizzle database and the `CmsRegistry`.
- `requireCmsUser(event)` returns the signed-in person (`id`, `role`, `email`, `name`, `locale`). It throws 401 when nobody is signed in, and 403 `role-removed` when the person's role is no longer in the config.

The other server helpers (`audit`, `parseOr422`, `rateLimit`, `clientIp`, `sendCmsMail` and the rest) stay internal.

**Drizzle's types follow drizzle-orm.** The query helpers (`eq`, `and`, `sql` and the rest), the columns of an entity's `table` and the `db` of `useCms()` are drizzle's. Their names and what they do are frozen. Their TypeScript types come from drizzle-orm, which is still 0.x. When tinyzoo moves to a new drizzle major, the changelog says so, with an Upgrade section.

### Upgrade

Nothing to do. Plugins that call these two helpers keep working, and now within semver.
