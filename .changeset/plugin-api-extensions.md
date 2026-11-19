---
'tinyzoo': minor
---

**Plugins can bring tables, app plugins, home widgets and editor panels.** Four new options of `defineCmsPlugin`:

- `tables` and `tablesSource`: plain Drizzle tables that are not entries (a log of events, totals per day), named `<plugin>` or `<plugin>_…` like entities. `tinyzoo generate` writes them into the site's `schema.ts`, so they get migrations with the site's own tables, and refuses source that differs from the tables the server queries. On the server they are in `useCms().reg.pluginTables`.
- `appPlugins`: Nuxt app plugins (`defineNuxtPlugin`) for the website and the admin, with `mode: 'client' | 'server' | 'all'`.
- `dashboardWidgets`: cards on the admin's home page, from the plugin's `components`, sorted by `order`, optionally for administrators only. A widget with nothing to show leaves no gap.
- `entityPanels`: panels in the side column of the entry editor, for every collection or the ones named. The component gets `entity`, `id` and `locale`.

New exported types: `CmsPluginAppPlugin`, `CmsDashboardWidget`, `CmsEntityPanel`. `docs/plugins.md` and `docs/plugin-reference.md` describe each option.

### Upgrade

Nothing to do. A site without plugins that use these options gets the same `schema.ts` and the same admin as before.
