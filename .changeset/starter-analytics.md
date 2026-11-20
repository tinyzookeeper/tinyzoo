---
'tinyzoo': minor
'create-tinyzoo': minor
---

**New sites count their visits.** `tinyzoo init` and `pnpm create tinyzoo` have a new part, `analytics`, on by default like the others: the site's `cms.config.ts` lists `analyticsPlugin()` (cookieless), the first migration makes its tables, and the README points at the sentence for the privacy policy. `--presets` without `analytics` leaves it out.

### Upgrade

Nothing to do. A site made earlier switches analytics on as in "Switching it on" in `docs/analytics.md`.
