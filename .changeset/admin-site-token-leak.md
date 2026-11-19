---
'tinyzoo': patch
---

**The admin keeps its own colours when the site sets Nuxt UI's.** A site whose stylesheet sets `--ui-bg` (or another Nuxt UI role) for its own pages no longer changes the admin. Before, a cream page colour turned the admin's page cream too, and the cream welcome card and the current page in the sidebar disappeared into it. The admin now declares every Nuxt UI role itself and paints `<html>` with its own page colour. A site's `:root.dark` no longer changes the admin's radius in dark mode either.

### Upgrade

Nothing to do.
