---
'tinyzoo': patch
---

A visitor who is not signed in no longer gets a `nuxt-session` cookie. Every anonymous response (the public content API, `/sitemap.xml`, the website's pages, media files, even 404s) carried `Set-Cookie: nuxt-session=…`, so a CDN would not cache it and a cookie banner became necessary. Two things caused it: nuxt-auth-utils adds a Nitro plugin when WebSockets are on (the admin's live socket is one) that reads the session on every request, which creates one; the layer now removes that plugin (the admin socket checks the session itself, and only when the request has one), and the built-in session middleware only looks at the session when the request carries the cookie. Signing in sets the cookie exactly as before.
