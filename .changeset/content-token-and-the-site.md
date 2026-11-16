---
'tinyzoo': patch
---

With `NUXT_CMS_CONTENT_TOKEN` set, the website's own pages no longer render empty. The site's server-side `useFetch('/api/content/…')` got `401` and nothing was logged. Requests Nitro answers inside the server (server rendering: `useFetch`, `$fetch`, `event.$fetch`; no network hop, built from Nitro's own request object, which a request over a socket can never be) are the site itself and are let through, so the token never has to be in the site's code, its HTML or a browser; an outside request without the token still gets `401`, and `?preview` still needs the token or a session. A refusal for a missing or wrong token is logged as one line at most once a minute (with a count and what to do). A browser that calls the API itself (client-side navigation) is outside and has no token: see "Content API token" in `docs/deploying.md`.
