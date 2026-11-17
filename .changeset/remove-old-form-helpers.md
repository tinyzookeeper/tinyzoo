---
'tinyzoo': minor
---

`defineForm` and `defineFormSettings` are no longer exported from `tinyzoo`. They were deprecated in 0.2, when forms moved to the forms plugin, and printed a deprecation line since; import them from `tinyzoo/forms` instead. Nothing changes in the tables, the endpoints or `<CmsForm>`.

### Upgrade

1. Only if your `cms.config.ts` still has `import { defineForm, defineFormSettings } from 'tinyzoo'` (`pnpm typecheck` tells you): import them from `tinyzoo/forms`, together with `formsPlugin`, and add `export const plugins = [formsPlugin()]` next to your entities. No migration.
