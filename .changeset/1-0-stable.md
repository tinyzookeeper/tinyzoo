---
'tinyzoo': major
---

tinyzoo 1.0: the public API is frozen and follows semver ([docs/stability.md](https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/stability.md)). An update within 1.x does not break your site, and a breaking change waits for 2.0. What is frozen is listed by name in [docs/api-surface.md](https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/api-surface.md): the config API, the content API and `@tinyzoo/client`, the `cms` options and `NUXT_CMS_*` variables, the webhook and the Nitro hooks, the CLI, the frontend kit and the admin's extension points. Before the freeze, 1.0 removes what 0.6 deprecated; the entries below say what.

### Upgrade

Follow "From 0.7 to 1.0" in [docs/upgrading.md](https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/upgrading.md#from-07-to-10), and name the version: `pnpm up tinyzoo@^1.0.0 @tinyzoo/client@^1.0.0`. A site that saw no `[tinyzoo] deprecated:` line on 0.6 or 0.7 only updates its packages. From 1.0 on, a plain `pnpm up tinyzoo @tinyzoo/client` takes every 1.x release.
