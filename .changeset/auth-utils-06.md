---
'tinyzoo': minor
---

tinyzoo runs on nuxt-auth-utils 0.6 and Nuxt 4.6 (it needs both now: `nuxt` ^4.6.0, `nuxt-auth-utils` ^0.6.2). nuxt-auth-utils 0.6 seals the admin's sign-in cookie with a key derived from Nuxt's app secret, `NUXT_APP_SECRET`, and no longer reads `NUXT_SESSION_PASSWORD`. **Everyone is signed out once** by this update: the cookie has a new name (`nuxt-auth-session`, was `nuxt-session`) and a new format, so sessions from before it no longer open the admin. Accounts and passwords stay as they are; people sign in again with the same password.

A site that still has only `NUXT_SESSION_PASSWORD` keeps starting and signing people in: until 0.5 its value stands in for `NUXT_APP_SECRET` when that is not set, and the log says once, at start, that the old name is deprecated. A site that already sets `NUXT_APP_SECRET` (for `nuxt-og-image`, say) keeps using it; `NUXT_SESSION_PASSWORD` is then ignored. A production server with neither, or with one under 32 characters, does not start and names the variable. `tinyzoo upgrade` now checks the site's `nuxt-auth-utils` version too.

Nuxt 4.6 builds with Vite 8 (was 7) and Nitro 2.13.6. On Nuxt 4.6 with tinyzoo 0.3, every anonymous response (content API, pages, media) got a session cookie, because Nuxt 4.6 adds modules' server plugins later than before; with 0.4 such responses carry no cookie again, as with Nuxt 4.4.

### Upgrade

1. In your `package.json`, set `nuxt` to `^4.6.0` and `nuxt-auth-utils` to `^0.6.2`, then run `pnpm install`. If your own `nuxt.config.ts` has Vite or Rollup options, check them against Vite 8's migration guide.
2. Rename `NUXT_SESSION_PASSWORD` to `NUXT_APP_SECRET` on your platform and in `.env`, **keeping the value**. With the same value nobody is signed out by the rename. If the site already has a `NUXT_APP_SECRET`, keep it and remove `NUXT_SESSION_PASSWORD`. Recommended now, required from 0.5: until then the old variable keeps working, with a warning in the log.
3. Deploy, and tell the people who use the admin that they have to sign in again, once.
