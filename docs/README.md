# Documentation

Three kinds of reader, three sets of pages. Pick yours.

## For people building sites with tinyzoo

Read in this order the first time; come back to any page later.

Since 1.0, tinyzoo follows semver. [tinyzoo 1.0](stability.md) says what stays stable.

| | |
|---|---|
| [Getting started](guide/getting-started.md) | From nothing to a running site with content, your first collection and the checklist for going live. Half an hour |
| [Content model](guide/content-model.md) | The reference for `cms.config.ts`: fields, relations, blocks, globals, presets (page tree, menus, redirects, SEO, forms), languages, publishing, access rules |
| [Recipes](guide/recipes.md) | Ten things clients ask for (contact form, news, team, FAQ, opening hours, gallery, downloads, partners, events, menus), each complete |
| [The content API](guide/content-api.md) | What the website reads: endpoints, drafts and preview, caching, search, the typed client, OpenAPI, the sitemap, the frontend kit |
| [The content API reference](guide/content-api-reference.md) | Every route to look things up on: parameters, filters, languages, preview, the token, caching and errors |
| [Media](guide/media.md) | Uploads, limits, the storage drivers (local disk, S3, Cloudflare R2) and drawing pictures on the website |
| [The admin](guide/admin.md) | Accounts and roles, branding the admin, form layouts and replacing how a field is drawn |
| [The MCP server](guide/mcp.md) | Programs that read and edit the content over MCP: access tokens, their rights, the tools |
| [Roles and permissions](guide/roles.md) | Roles of your own, who reads and edits each field, media per role, removed roles, a worked example with a translator |
| [Seeding](guide/seeding.md) | Content a site starts with, written in code and put into a running site with `tinyzoo seed` |
| [Content between environments](guide/content-transfer.md) | `tinyzoo export` and `import`: production to staging, a laptop to a server |
| [tinyzoo 1.0](stability.md) | What the 1.0 promise covers, what it does not, and how to get there |
| [The public API](api-surface.md) | What 1.0 freezes: the config API, options and environment variables, content API, client, webhook, hooks, CLI, admin extension points. Everything else is internal |
| [Plugins](plugins.md) | Adding a feature of your own (collections, admin pages, routes, upgrade steps) and shipping it as a package |
| [The plugin API reference](plugin-reference.md) | Every option and hook of `defineCmsPlugin`, with its type |
| [Analytics](analytics.md) | Counting the website's visits in its own admin, without cookies: switching it on, what it shows, privacy and a sentence for the privacy policy, and the modes with a cookie banner |
| [Cookie consent](consent.md) | The cookie banner: categories, `<CmsConsent>`, `useConsent()` to load videos or pixels after a yes, the texts, the cookie, the consent log |
| [Upgrading](upgrading.md) | Moving a site to a newer tinyzoo: the version policy, every upgrade, each version, renaming and removing, upgrade steps |
| [Deploying](deploying.md) | Running a site in production: environment, first run, migrations, backups and restore, privacy, logs, a worked example on Pushbase |
| [AGENTS.md](../packages/cms/starter/AGENTS.md) and [llms.txt](../llms.txt) | For the coding assistant you build with: the guide every new site gets, and an index of the pages above |

## For editors

The manual for the people who fill the site with content, in plain language, with the admin's own button names.
Hand it to the client. In Czech, English and German, with the same chapters and pictures:

- [**Příručka pro editory**](editors/cs/README.md) (Czech): přihlášení a účet · [role a
  oprávnění](editors/cs/role-a-opravneni.md) · úprava stránky a bloků · [překlady](editors/cs/preklady.md) ·
  zveřejnění, naplánování a náhled · obrázky a soubory · menu a odkazy · zprávy z formulářů ·
  historie a obnovení · soukromí · co dělat, když…
- [**Editors' guide**](editors/en/README.md) (English)
- [**Handbuch für die Redaktion**](editors/de/README.md) (German)

## On the website

The editors' guide (in its three languages) and the developer pages in the table at the top are also on the tinyzoo website:

- [/dokumentace](https://tinyzoo.dev/dokumentace) (Czech)
- [/en/docs](https://tinyzoo.dev/en/docs) (English)
- [/de/dokumentation](https://tinyzoo.dev/de/dokumentation) (German)

The developer pages are in English only, at [/en/docs/developers](https://tinyzoo.dev/en/docs/developers). The Czech and German docs link there, with a note in their language.

The Markdown here is the source. The website renders it when it is built (`site/modules/docs`), so a change here is on the website with the next deploy.

What that means when you write:

- **What is published, and in which order**, comes from the lists themselves.
  - The developer pages are the table at the top of this file.
  - The editors' chapters are the numbered list in each language's `README.md`.
  - A new page goes into that list.
  - The chapters pair up across languages by their place in the list, so the three lists keep the same order.
- **Generated pages.** The website adds one developer page that is not Markdown.
  - It is a worked example of the content API, made at build time from the OpenAPI document of the playground ([`test/contracts/openapi.playground.json`](../test/contracts/openapi.playground.json)).
  - It is placed right after [the content API reference](guide/content-api-reference.md).
  - It is not in the table above, so it is only on the website.
- **Links** between these pages become website addresses, and a link to a heading keeps its anchor. Links to anything else in the repository go to GitHub.
- **Screenshots** live in `docs/screenshots/`.
  - A page links the Czech one (`../../screenshots/0.6/team.png`). The English and German pages link the same file.
  - The website shows `docs/screenshots/0.6/<lang>/team.png` instead when it exists (`en`, `de`).
  - So a translated screenshot needs no change in the Markdown.
- **Clips** are short looping videos without sound. A clip is an HTML comment on a line of its own (GitHub does not show it):

  ```md
  <!-- clip: roles | Short video: inviting a colleague with a role. -->
  ```

  - The name before `|` is the file: `site/public/docs/clips/roles.<lang>.mp4`, falling back to `roles.cs.mp4`.
  - The text after it says what the clip shows, for screen readers.
  - Until a file exists, the website shows nothing in its place.
- **Czech text** gets a non-breaking space after a one-letter word (k, s, v, z, o, u, a, i) on the website. Write normal spaces in the Markdown.
- **Callouts.** `> **Tip:**` and `> **Pozor:**` (`Watch out:`, `Achtung:`) quotes become callouts.
- **Code block file names.** A code block's `<!-- check: group/file -->` marker gives its file name.

## For people working on tinyzoo

Plans, research and the rules of the project. Not needed to build a site.

| | |
|---|---|
| [Development](development.md) | Repository layout, running the playground, the tests and CI, decisions that shaped the code |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Changesets, version bumps, deprecations, releases, the upgrade test, the docs check |
| [Roadmap](roadmap.md) | The plan to 1.0 and after, with a write-up of every slice as it was finished |
| [Production plan](production-plan.md), [Pilot plan](pilot-plan.md) | The earlier plans (done, or folded into the roadmap) |
| [UI foundation](ui-foundation.md) | The admin's design tokens and rules; the live reference is `/design-system` on the website |
| [Research](research/) | What informed the admin's structure and look |
| [Brand guide](brand/brand-guide.md), [logo and characters](brand/) | Name, voice, logo, the animals |
| [Screenshots](screenshots/) | The pictures used in the README and the roadmap |
