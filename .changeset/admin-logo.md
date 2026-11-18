---
'tinyzoo': minor
---

The admin carries the client's logo. Give `cms.admin.logo` a full logo and a square mark (`logo: { full: '/brand/logo.svg', mark: '/brand/mark.svg' }`, files in the site's `public/` folder or `https://` URLs), and optionally `fullDark` and `markDark`. The full logo shows in the open sidebar, the phone's menu and on the sign-in pages; the mark in the folded sidebar, the phone's top bar, the browser tab and the phone's home screen. In dark mode a logo without its dark version, or whose dark version does not load, sits on a small cream tile, so it never disappears. A logo that does not load gives way to the mark or the initials. Without a mark the initials stay. `cms.admin.signature: false` hides tinyzoo's quiet signature under the sidebar and on the sign-in pages. In development, tinyzoo warns at start about a logo address it cannot use, a missing file, a mark that is not square and a picture too small to stay sharp.

### Upgrade

Nothing to do. `logo` and `signature` are optional; without them the admin looks as before.
