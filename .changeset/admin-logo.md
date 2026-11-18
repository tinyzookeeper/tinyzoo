---
'tinyzoo': minor
---

The admin carries the client's logo. Give `cms.admin.logo` a full logo and a square mark (`logo: { full: '/brand/logo.svg', mark: '/brand/mark.svg' }`, files in the site's `public/` folder or `https://` URLs), and optionally `fullDark` and `markDark`. The full logo shows in the open sidebar, the phone's menu and on the sign-in pages; the mark in the folded sidebar, the phone's top bar, the browser tab and the phone's home screen. In dark mode a logo without its dark version, or whose dark version does not load, sits on a small light tile (cream, or the brand's light tint with a hex accent), so it never disappears. A logo that does not load gives way to the mark or the initials. Without a mark the initials stay. `cms.admin.signature: false` hides tinyzoo's quiet signature under the sidebar and on the sign-in pages. In development, tinyzoo warns at start about a logo address it cannot use, a missing file, a mark that is not square, a picture too small to stay sharp and an SVG with text in it (convert the text to outlines: the PNG versions are drawn with the server's fonts).

### Upgrade

Nothing to do. `logo` and `signature` are optional; without them the admin looks as before. Set `name` with a logo: it is the logo's text for screen readers. The server now decides the admin's name, colour and logos and sends them to the admin, so changing `cms.admin` in the browser at run time (`updateAppConfig`) no longer changes them.
