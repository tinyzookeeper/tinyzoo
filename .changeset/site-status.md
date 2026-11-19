---
'tinyzoo': minor
---

**`GET /api/health/status`: a summary of the site for a tool that watches many sites.** It answers with the tinyzoo and Node.js versions, whether the database answers and how big it is, the state of start-up migrations, every collection with its entry count and last edit, how many entries wait for a translation, how many accounts are active and signed in lately, media files and their size, webhooks, the server errors of the last 24 hours and the plugins (`CmsStatus`). It holds numbers, dates and versions only: never content, names, emails or secrets.

The route is off (`404`) until `NUXT_CMS_STATUS_TOKEN` (`cms.status.token`) is set, and then asks for that token as `x-api-key` or `Authorization: Bearer`.

### Upgrade

Nothing to do. To use it, set `NUXT_CMS_STATUS_TOKEN` to a long random value. `docs/deploying.md` has the details (Site status).
