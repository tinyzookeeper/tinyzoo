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
| [Roles and permissions](guide/roles.md) | Roles of your own on top of admin, editor and author, who reads and edits each field, the media library per role, what happens to a removed role, a worked example with a translator |
| [Seeding](guide/seeding.md) | Content a site starts with, written in code and put into a running site with `tinyzoo seed` |
| [Content between environments](guide/content-transfer.md) | `tinyzoo export` and `import`: production to staging, a laptop to a server |
| [The public API](api-surface.md) | What 1.0 freezes: the config API, the `cms` options and environment variables, the content API and client, the webhook and hooks, the CLI, the admin's extension points. Everything else is internal |
| [Plugins](plugins.md) | Adding a feature of your own (collections, admin pages, routes, upgrade steps), and shipping it as a package |
| [Upgrading](upgrading.md) | Moving a site to a newer tinyzoo: the version policy, what to do on every upgrade, 0.1 → 0.2, recipes for renaming and removing, writing upgrade steps |
| [Deploying](deploying.md) | Running a site in production: environment, first run, migrations, backups and restore, privacy, logs, a worked example on Pushbase |
| [AGENTS.md](../packages/cms/starter/AGENTS.md) and [llms.txt](../llms.txt) | For the coding assistant you build with: the guide every new site gets (the content model workflow, commands, what is frozen, what not to touch), and an index of the pages above |

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

Everything above (the editors' guide in its three languages, and the developer pages in the table at the top) is
also on the tinyzoo website: [/dokumentace](https://tinyzoo.pushbase.app/dokumentace),
[/en/docs](https://tinyzoo.pushbase.app/en/docs), [/de/dokumentation](https://tinyzoo.pushbase.app/de/dokumentation).
The Markdown here is the source: the website renders it when it is built (`site/modules/docs`), so a change here
is on the website with the next deploy. What that means when you write:

- **What is published, and in which order**, comes from the lists themselves: the developer pages are the table
  at the top of this file; the editors' chapters are the numbered list in each language's `README.md`. A new page
  goes into that list. The chapters pair up across languages by their place in the list, so the three lists keep
  the same order.
- **Links** between these pages become website addresses (a link to a heading keeps its anchor). Links to
  anything else in the repository go to GitHub.
- **Screenshots** live in `docs/screenshots/`. A page links the Czech one (`../../screenshots/0.6/team.png`); the
  English and German pages link the same file, and the website shows `docs/screenshots/0.6/<lang>/team.png` instead
  when it exists (`en`, `de`). So a translated screenshot needs no change in the Markdown.
- **Clips**, short looping videos without sound, are an HTML comment on a line of its own (GitHub does not show it):

  ```md
  <!-- clip: roles | Short video: inviting a colleague with a role. -->
  ```

  The name before `|` is the file: `site/public/docs/clips/roles.<lang>.mp4`, falling back to `roles.cs.mp4`.
  The text after it says what the clip shows (for screen readers). Until a file exists, the website shows nothing
  in its place.
- `> **Tip:**` and `> **Pozor:**` (`Watch out:`, `Achtung:`) quotes become callouts; a code block's
  `<!-- check: group/file -->` marker gives its file name.

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
