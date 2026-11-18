---
'tinyzoo': patch
---

The folded sidebar stays folded after a reload. The admin did not recognise its own saved choice when the cookie held a plain `1`, and the sidebar could open on the first frame and fold a moment later (or the other way round) on editor pages and after an editor tab was closed. The server and the browser now draw the same sidebar from the start.

### Upgrade

Nothing to do. The admin's sidebar cookie for Nuxt UI was renamed, so a sidebar width someone dragged in the current browser session is forgotten once.
