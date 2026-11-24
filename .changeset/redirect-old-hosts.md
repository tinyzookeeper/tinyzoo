---
"tinyzoo": minor
---

A site that moves to another address can redirect its old one. Name the old host names in `cms.redirectHosts` (`NUXT_CMS_REDIRECT_HOSTS`, separated by commas): a page asked for on one of them is redirected for good (301) to the same path and query on `cms.publicUrl`. The API, build assets and `/.well-known/` still answer on the old name, so a monitor or a connected tool that calls it with a token keeps working.
