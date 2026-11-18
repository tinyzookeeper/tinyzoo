---
'tinyzoo': minor
---

Emails carry the client's logo and colour; the admin can be added to a phone's home screen. Invitations, password resets and the emails about a changed sign-in address show the full logo at the top (as a PNG, since Gmail and Outlook do not show SVG), or the site's name when there is no full logo. Their button is in the accent colour, and the link under it is now readable. They never carry tinyzoo's signature. tinyzoo makes PNG versions of the logo on the server (`/api/cms/_brand/full-email.png`, `mark-32.png`, `mark-180.png`, `mark-192.png`, `mark-512.png`) and a web manifest for the admin (`/api/cms/_brand/admin.webmanifest`). Without a mark, or with one that cannot be read, the icons are tinyzoo's own; a full logo that cannot be read leaves the name in the emails. The files' addresses carry a hash of the logo file, so they can be cached for a year and change as soon as the logo does, even under the same name; tinyzoo reads each logo again every 15 minutes. An `https://` logo is downloaded only from hosts on the public internet, with at most two redirects, each to `https://`.

### Upgrade

Nothing to do. The logo in emails is loaded from `NUXT_CMS_PUBLIC_URL`, which production already needs for the links in them. A logo in `public/` must be a picture file (`.svg`, `.png`, `.webp`, `.jpg`, `.jpeg` or `.avif`); a logo on a server inside your own network cannot be made into the PNG versions, so put it in `public/`.
