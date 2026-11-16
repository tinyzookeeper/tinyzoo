---
'tinyzoo': minor
---

A production server that cannot work now refuses to start, and says which variable is wrong, instead of answering "ready" and failing the first request: `NUXT_SESSION_PASSWORD` missing or shorter than 32 characters (the first sign-in used to answer 500), and no database address (the message now names `DATABASE_URL` and `NUXT_CMS_DATABASE_URL`, not `cms.databaseUrl`). A missing `NUXT_CMS_PUBLIC_URL` is one clear warning at start (the sitemap and the links in emails need it). Development is unchanged.

### Upgrade

A site that already signs people in has a long enough `NUXT_SESSION_PASSWORD` and a database address, and needs nothing. If a deploy now stops at start with `[tinyzoo] the server cannot start`, set the variable it names (`openssl rand -base64 32` makes a session password) and deploy again; changing the password signs everyone out once.
