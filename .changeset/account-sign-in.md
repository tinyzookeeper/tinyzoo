---
"tinyzoo": minor
---

Experimental: people can sign in to the admin with their tinyzoo account, next to the site's own password. With `cms.auth.account` (`NUXT_CMS_AUTH_ACCOUNT_ISSUER`, `_CLIENT_ID`, `_CLIENT_SECRET`) the sign-in page gets a button for the account, and the site's name at the top of the admin becomes a menu of the person's other websites of the same owner, with their role in each. Roles and people stay on the site: the account says who the person is, and the site lets in a user connected to that account, or an active or invited user with the account's verified email address. Somebody accepted this way has no password on the site and can set one from their account page. Without the three settings nothing changes. The admin guide describes it; the settings and the behaviour can change in a minor release.
