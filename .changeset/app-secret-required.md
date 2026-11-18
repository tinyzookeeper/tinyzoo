---
'tinyzoo': minor
---

**Breaking:** `NUXT_SESSION_PASSWORD` no longer stands in for `NUXT_APP_SECRET`: the server needs `NUXT_APP_SECRET` (at least 32 characters) and refuses to start without it. 0.4 and 0.5 used the old variable (or `runtimeConfig.session.password` in `nuxt.config.ts`) as the app secret when no other was set, and warned; that stand-in is removed, with the Rollup transform that did it. A site that has only the old variable now stops at start with a message that says `NUXT_APP_SECRET is not set`, names the old variable, and says to rename it. The value is never printed.

### Upgrade

1. If the log of your deploy shows `[tinyzoo] deprecated: NUXT_SESSION_PASSWORD is used as the app secret…`, or your site has `NUXT_SESSION_PASSWORD` and no `NUXT_APP_SECRET`: **before you deploy 0.6**, rename the variable on your platform and in `.env`, keeping its value: `NUXT_SESSION_PASSWORD=…` becomes `NUXT_APP_SECRET=…`. Nobody is signed out.
2. If you set `runtimeConfig.session.password` in `nuxt.config.ts`, move the value to `NUXT_APP_SECRET` in the environment and remove it from the config.
3. If your site already sets `NUXT_APP_SECRET`, there is nothing to do; delete the old `NUXT_SESSION_PASSWORD`, which is ignored now.
4. The value must be at least 32 characters (`openssl rand -base64 32` makes one).
