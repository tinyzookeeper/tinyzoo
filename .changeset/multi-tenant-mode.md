---
"tinyzoo": minor
---

Experimental: one running app can serve many sites that share its content model (`NUXT_CMS_TENANCY_MODE=multi`). Each site is found by its host name and has its own database and database user, its own files, sessions, settings and caches; work that names no site gets an error instead of a default site. The mode is not documented for use yet and may change without notice: `docs/multi-tenant-plan.md` holds its design and what was measured.

- The site directory is a JSON file (`NUXT_CMS_TENANCY_FILE`) or a table in Postgres (`NUXT_CMS_TENANCY_DATABASE_URL`, `NUXT_CMS_TENANCY_TEMPLATE`), reread when it changes. With `NUXT_CMS_TENANCY_KEY` set, the database address and the secret of every site are stored encrypted.
- A site has a main host, hosts that redirect to it and hosts it is served on without a redirect, and a state: active, paused, read-only, or moved (every request is redirected to its new address).
- One cap on the database connections of all sites together (`NUXT_CMS_TENANCY_MAX_CONNECTIONS`), sites that give their memory back after 15 minutes without use (`NUXT_CMS_TENANCY_IDLE_MINUTES`), scheduled tasks that open a site's database only when that site has work due, and a list of the sites for whoever runs the process (`GET /api/health/sites` with `NUXT_CMS_TENANCY_OPERATOR_TOKEN`).

A site that does not set the variable runs as before, with one site per app. Inside the package, everything a site keeps in memory is now declared per site (`cmsSiteScoped`) or shared on purpose (`cmsProcessWide`), and a unit test refuses undeclared module-level state in the server code.
