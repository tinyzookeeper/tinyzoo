---
'tinyzoo': minor
---

**Breaking:** a production server (`NODE_ENV=production`) refuses to start when `NUXT_APP_SECRET` is the example value of the starter's `.env.example`, `change-me-to-a-long-random-string-32-chars-min`. Anyone can read that value, so a site that kept it sealed its sign-in cookies with a key the whole world knows, and anyone could forge an administrator's session. The start check names the variable and says how to make a real one (`openssl rand -base64 32`). A development server still starts and prints a warning. `tinyzoo init` and `pnpm create tinyzoo` now write a `.env` with a random `NUXT_APP_SECRET` of its own, so a new site does not have the problem (`.env.example` stays as the documentation and is no longer copied: the next steps do not tell you to). An existing `.env` is never overwritten.

### Upgrade

1. Look at the `NUXT_APP_SECRET` your server runs with (the platform's environment, not only `.env`). If it is `change-me-to-a-long-random-string-32-chars-min`, **set a new one before you deploy 0.6**: `openssl rand -base64 32`, at least 32 characters. This includes a `NUXT_SESSION_PASSWORD` with that value that you rename to `NUXT_APP_SECRET` for 0.6: keep the value of the old variable only when it is a secret of your own.
2. Changing the secret signs everyone out once; accounts and passwords are not touched. Any other value is accepted as before.
3. In development nothing breaks: if your `.env` was copied from the old `.env.example`, replace its `NUXT_APP_SECRET` to get rid of the warning.
