# Documentation

Three kinds of reader, three sets of pages. Pick yours.

## For people building sites with tinyzoo

Read in this order the first time; come back to any page later.

| | |
|---|---|
| [Getting started](guide/getting-started.md) | From nothing to a running site with content, your first own collection, and the checklist for going live. Half an hour |
| [Content model](guide/content-model.md) | The reference for `cms.config.ts`: every field type, relations, lists, groups, blocks and their versions, globals, presets (pages, the page tree, menus, redirects, SEO, forms), languages, links that follow their page, publishing, access rules |
| [Recipes](guide/recipes.md) | Ten things clients ask for (contact form, news, team page, FAQ, opening hours, photo gallery, downloads, partners, events, menus with dropdowns), each a complete config, the page that shows it, and a note for the editor |
| [The content API](guide/content-api.md) | What the website reads: endpoints, drafts and preview, caching, the website search, the typed client, OpenAPI, the sitemap, the components that draw content |
| [Media](guide/media.md) | Uploads, limits, the storage drivers (local disk, S3, Cloudflare R2), drawing pictures on the website |
| [The admin](guide/admin.md) | Accounts and roles, branding the admin, form layouts, replacing how a field is drawn |
| [Roles and permissions](guide/roles.md) | Roles of your own on top of admin, editor and author, who reads and edits each field, the media library per role, what happens to a removed role |
| [Seeding](guide/seeding.md) | Content a site starts with, written in code and put into a running site with `tinyzoo seed` |
| [Content between environments](guide/content-transfer.md) | `tinyzoo export` and `import`: production to staging, a laptop to a server |
| [The public API](api-surface.md) | What 1.0 freezes: the config API, the `cms` options and environment variables, the content API and client, the webhook and hooks, the CLI, the admin's extension points. Everything else is internal |
| [Plugins](plugins.md) | Adding a feature of your own (collections, admin pages, routes, upgrade steps), and shipping it as a package |
| [Upgrading](upgrading.md) | Moving a site to a newer tinyzoo: the version policy, what to do on every upgrade, 0.1 → 0.2, recipes for renaming and removing, writing upgrade steps |
| [Deploying](deploying.md) | Running a site in production: environment, first run, migrations, backups and restore, privacy, logs, a worked example on Pushbase |

## For editors

The manual for the people who fill the site with content, written in Czech, in plain
language, with the admin's own button names. Hand it to the client.

[**Příručka pro editory**](editors/cs/README.md): přihlášení a účet · úprava stránky a
bloků · překlady · zveřejnění, naplánování a náhled · obrázky a soubory · menu a odkazy ·
zprávy z formulářů · historie a obnovení · soukromí · co dělat, když…

## For people working on tinyzoo

Plans, research and the rules of the project. Not needed to build a site.

| | |
|---|---|
| [Development](development.md) | Repository layout, running the playground, the tests and CI, decisions that shaped the code |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Changesets, version bumps, deprecations, releases, the upgrade test, the docs check |
| [Roadmap](roadmap.md) | The plan to 1.0, with a write-up of every slice as it was finished |
| [Production plan](production-plan.md), [Pilot plan](pilot-plan.md) | The earlier plans (done, or folded into the roadmap) |
| [UI foundation](ui-foundation.md) | The admin's design tokens and rules; the live reference is `/design-system` on the website |
| [Research](research/) | What informed the admin's structure and look |
| [Brand guide](brand/brand-guide.md), [logo and characters](brand/) | Name, voice, logo, the animals |
| [Screenshots](screenshots/) | The pictures used in the README and the roadmap |
