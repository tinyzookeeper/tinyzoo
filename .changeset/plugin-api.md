---
'tinyzoo': minor
---

Plugin API: `defineCmsPlugin()` lets a package or a folder of the site add collections, admin pages with sidebar entries, server routes, field editors, admin texts, retention and upgrade steps, each under the plugin's own name. Register plugins in `cms.config.ts` with `export const plugins = [...]`. Website forms are now the first plugin, `tinyzoo/forms` (`formsPlugin()`, `defineForm`, `defineFormSettings`; `<CmsForm>`, the form endpoints, spam protection, notifications and retention come with it). The tables, the endpoints and `<CmsForm>` are unchanged. `tinyzoo up` and `tinyzoo status` include the upgrade steps of the registered plugins (recorded as `<plugin>:<id>`). How to write one: `docs/plugins.md`.

`defineForm` and `defineFormSettings` imported from `tinyzoo` are deprecated (removed in 0.4). They keep working and register the forms plugin by themselves.

The module now reads `cms.config.ts` while building (with jiti, as the CLI does) to find the plugins.

### Upgrade

Nothing is required: a site keeps working as it is, and logs one deprecation line per helper. To move forms to the plugin (needed before 0.4):

1. In `cms.config.ts`, import `defineForm` and `defineFormSettings` from `tinyzoo/forms` instead of `tinyzoo`, and import `formsPlugin` from there as well.
2. Add `export const plugins = [formsPlugin()]`.

No migration: the tables do not change (`tinyzoo generate` reports no changes).
