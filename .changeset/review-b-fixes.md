---
'tinyzoo': patch
---

Errors about what 1.0 removed link the upgrade guide on GitHub. The build error for `cms.databaseUrl` or an old cron variable, and the error for `singleton: true` on `defineEntity`, used to name `docs/upgrading.md`, a path that leads nowhere from a site's terminal. They now give the address of "From 0.7 to 1.0". The error for a field named like a list parameter links "Renaming a field". The `AGENTS.md` of a new site says how to update within 1.x: `pnpm up tinyzoo @tinyzoo/client`, and to a new major only by naming it, never with `--latest`.

### Upgrade

Nothing to do. A site made before keeps its own `AGENTS.md`. To update it, replace `--latest` in its "After updating tinyzoo" paragraph as the starter's now says.
