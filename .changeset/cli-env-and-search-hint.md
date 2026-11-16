---
'tinyzoo': patch
---

`tinyzoo links:convert` and `tinyzoo content:migrate` now find `DATABASE_URL` in the site's `.env`, as `tinyzoo up`, `status` and `upgrade` already did (they only read the environment and answered "DATABASE_URL is not set" on a site whose database address lives in `.env`). The development server's search index no longer fails with a bare "relation … does not exist" between saving a new collection in `cms.config.ts` and running `pnpm db:migrate`: the line now says a table is missing and what to run.
