# tinyzoo 1.0

tinyzoo 1.0 is the first stable version. This page says what that promises.

In short: an update within 1.x does not break your site.

## What stays stable

These follow [semantic versioning](https://semver.org) since 1.0:

- the content API your website reads, and the types of `@tinyzoo/client`;
- the config API in `cms.config.ts`: `defineEntity`, `f.*`, blocks, presets, seeds and plugins;
- the `cms` options in `nuxt.config.ts` and the `NUXT_CMS_*` variables;
- the publish webhook and the Nitro hooks;
- the `tinyzoo` CLI, with every command and flag;
- the frontend kit: `<CmsBlocks>`, `<CmsImage>`, `<CmsContent>`, `<CmsNav>`, `<CmsHighlight>`, `<CmsForm>`, `useCmsSeo()`, `useCmsSearch()` and `useCmsUiLocale()`;
- the admin's extension points: `cms.fields` in `app.config.ts`.

[The public API](api-surface.md) lists each one by name.

## What that means for you

- **A patch version** (1.0.1) fixes things. It never needs anything from you.
- **A minor version** (1.1) adds things. Your site keeps working without changes.
- **A breaking change** waits for 2.0.
- **Before something is removed**, it is deprecated for at least one minor version. A warning at build or start says what to use instead.

A minor version can still bring a migration of tinyzoo's own tables. `tinyzoo upgrade` applies it, and the changelog says so.

## What is not covered

These are tinyzoo's own and can change in any minor version:

- the admin's screens and its own components;
- the admin's API (`/api/cms/**`);
- the server's internal utilities, and anything marked `@internal`;
- the database tables. tinyzoo migrates them for you.

[The public API](api-surface.md#not-covered) has the full list.

## Moving to 1.0

Coming from a 0.x version? Follow [Upgrading](upgrading.md) one version at a time. Each version has its own section with what you have to do. The last one is [From 0.7 to 1.0](upgrading.md#from-07-to-10).

After 1.0, every update follows the same steps: [On every upgrade](upgrading.md#on-every-upgrade).
