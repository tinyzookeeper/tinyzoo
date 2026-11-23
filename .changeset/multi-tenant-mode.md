---
"tinyzoo": minor
---

Experimental: one running app can serve many sites that share its content model (`NUXT_CMS_TENANCY_MODE=multi` with a site directory, `NUXT_CMS_TENANCY_FILE`). Each site is found by its host name and has its own database and database user, its own files, sessions, settings and caches; work that names no site gets an error instead of a default site. The mode is not documented for use yet and may change without notice: `docs/multi-tenant-plan.md` holds its design.

A site that does not set the variable runs as before, with one site per app. Inside the package, everything a site keeps in memory is now declared per site (`cmsSiteScoped`) or shared on purpose (`cmsProcessWide`), and a unit test refuses undeclared module-level state in the server code.
