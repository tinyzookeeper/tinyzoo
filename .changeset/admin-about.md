---
'tinyzoo': minor
---

**Admin: an About page that says which version the site runs.**

- **Settings → About** (`/admin/about`) shows the tinyzoo version, since when the server runs (the last deploy or restart), Node.js, the state of the database migrations and the plugins with their versions. Everyone signed in sees it, also an author without any settings.
- **Copy details** puts these facts on the clipboard as plain lines, ready for a message to whoever looks after the website. The editors' guide says so under "When you're stuck".
- A site that turned tinyzoo's signature off (`cms.admin.signature: false`) shows its own name there instead of tinyzoo's.
- `GET /api/cms/_about` answers the page, for anyone signed in. It carries no content and no personal data.

### Upgrade

Nothing to do.
