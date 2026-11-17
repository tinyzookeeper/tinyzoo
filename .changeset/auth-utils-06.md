---
'tinyzoo': minor
---

tinyzoo runs on nuxt-auth-utils 0.6 and Nuxt 4.6 (it needs both now: `nuxt` ^4.6.4, `nuxt-auth-utils` ^0.6.2). nuxt-auth-utils 0.6 seals the admin's sign-in cookie with a key derived from Nuxt's app secret, `NUXT_APP_SECRET`, and no longer reads `NUXT_SESSION_PASSWORD`. **Everyone is signed out once** by this update: the cookie has a new name (`nuxt-auth-session`, was `nuxt-session`) and a new format, so sessions from before it no longer open the admin. Accounts and passwords stay as they are; people sign in again with the same password.

A site that still has only `NUXT_SESSION_PASSWORD` keeps starting and signing people in: until 0.5 its value stands in for `NUXT_APP_SECRET` when that is not set, and the log says once, at start, that the old name is deprecated. nuxt-auth-utils prints its own warning next to it, that `NUXT_SESSION_PASSWORD` "is not used anymore": until you rename the variable, that line can be ignored, as tinyzoo still uses it. The same goes for a `runtimeConfig.session.password` set in `nuxt.config` (0.3 accepted it). A site that already sets `NUXT_APP_SECRET` (for `nuxt-og-image`, say) keeps using it; `NUXT_SESSION_PASSWORD` is then ignored. A production server with no app secret, or with one under 32 characters, does not start and names the variable. `tinyzoo upgrade` now checks the site's `nuxt-auth-utils` version too.

An admin session still ends 14 days (`runtimeConfig.session.maxAge`) after signing in, however often it is written again since: nuxt-auth-utils 0.6 counts a session's age from its last write, so tinyzoo keeps the time of the sign-in in the session and checks it.

Nuxt 4.6 builds with Vite 8 (was 7) and Nitro 2.13.6. On Nuxt 4.6 with tinyzoo 0.3, every anonymous response (content API, pages, media) got a session cookie, because Nuxt 4.6 adds modules' server plugins later than before; with 0.4 such responses carry no cookie again, as with Nuxt 4.4.

### Upgrade

1. In your `package.json`, set `nuxt` to `^4.6.4` and `nuxt-auth-utils` to `^0.6.2`, then run `pnpm install`. If your own `nuxt.config.ts` has Vite or Rollup options, check them against Vite 8's migration guide. If your site uses nuxt-auth-utils itself (member sign-in, OAuth, WebAuthn), read its [migration guide from 0.5](https://github.com/atinux/nuxt-auth-utils#migrate-from-v05) and [0.6.0 release notes](https://github.com/atinux/nuxt-auth-utils/releases/tag/v0.6.0): sessions are read-only in WebSocket handlers, the cookie is renamed, a session's `maxAge` counts from its last write, and the `seal`, `crypto`, `generateId` and session header options are gone.
2. Rename `NUXT_SESSION_PASSWORD` to `NUXT_APP_SECRET` on your platform and in `.env`, **keeping the value**. With the same value nobody is signed out by the rename. If you set `runtimeConfig.session.password` in `nuxt.config.ts`, move that value to `NUXT_APP_SECRET` in the environment and remove it from the config. Recommended now, required from 0.5: until then the old variable keeps working, with a warning in the log.
3. If the site already has a `NUXT_APP_SECRET`, remove `NUXT_SESSION_PASSWORD` and check the length: it must be **at least 32 characters**. A shorter one (enough for `nuxt-og-image`, say) stops the server from starting: replace it with a new one (`openssl rand -base64 32`). Whatever else signs with it changes too: `nuxt-og-image`'s signed image URLs change, and everyone signs in again.
4. Deploy, and tell the people who use the admin that they have to sign in again, once.
