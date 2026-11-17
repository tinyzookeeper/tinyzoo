<p><img src="docs/brand/logo/logo-primary.svg" alt="tinyzoo" height="48"></p>

*A tiny CMS that lives inside your Nuxt app.*

**tinyzoo** is a code-first CMS for Nuxt 4, shipped as one Nuxt layer and module (`tinyzoo`)
with a typed content client (`@tinyzoo/client`). You define your content once, in TypeScript.
tinyzoo derives the database schema and its migrations, validation, a typed API, and an
admin your clients' editors use to change **data**, never the site's structure. Everything
runs in your own Nuxt app and your own Postgres, on any Node host.

The name is always **tinyzoo**: one word, lowercase. Inside the code the CMS keeps its
`cms` namespace (`cms.config.ts`, `NUXT_CMS_*`, `cms_*` tables, `Cms*` components). Brand
guide, logo and the animal characters: [docs/brand](docs/brand/brand-guide.md).

![the admin: editing a page](docs/screenshots/admin-editor.png)

## Try it

You need Node 22+, pnpm 10 and Docker (for the local database).

```bash
pnpm create tinyzoo my-site      # asks for the languages, the parts of the site and demo content
cd my-site
pnpm install                     # unless the questions installed for you
cp .env.example .env
docker compose up -d && pnpm db:migrate
pnpm dev                                                     # the site, and /admin
# in a second terminal, while `pnpm dev` runs: the demo content and your first administrator
SEED_EMAIL=you@example.com SEED_PASSWORD='a long password' pnpm seed
```

With the defaults, that is a small bakery's website in Czech and English, with pages built from
blocks, news, menus, a contact form and search (`tinyzoo init my-site` makes the same site without questions). [Getting started](docs/guide/getting-started.md) walks
through it step by step, adds a collection of your own, and ends with the checklist for
going live.

## What it looks like

All of a site's content model lives in `cms.config.ts`:

<!-- check: readme/cms.config.ts -->
```ts
import { defineEntity, defineLocales, eq, f } from 'tinyzoo'

export const locales = defineLocales({ default: 'cs', locales: ['cs', 'en'] })

export const Post = defineEntity('post', {
  label: { en: 'Posts', cs: 'Články' },
  titleField: 'title',
  fields: {
    title: f.text({ required: true }).localized(),
    slug: f.slug({ from: 'title', unique: true }).localized(),
    status: f.select({ options: ['draft', 'published'] as const, default: 'draft' }),
    publishedAt: f.datetime().optional(),
    hero: f.media({ accept: 'image/*' }).optional(),
    body: f.richtext().localized(),
  },
  publish: { field: 'status', publishedValue: 'published', draftValue: 'draft', dateField: 'publishedAt', preview: '/blog/:slug' },
  content: { public: true, published: (t) => eq(t.status, 'published'), slug: 'slug', path: '/blog/:slug' },
})
```

`pnpm db:generate` writes the migration, `pnpm db:migrate` applies it, and the admin has the
form. On the website, `pnpm cms:client` generates types that cannot drift from the API:

<!-- check: readme/app/pages/blog-list.ts -->
```ts
import { createClient } from '~/lib/cms-content'

const cms = createClient({ baseUrl: useRequestURL().origin })
const { items } = await cms.post.list({ filter: { status: 'published' }, sort: 'publishedAt', dir: 'desc' })
//      ^? Post[]  (items[0].hero?.url, items[0].title are typed; a wrong sort key does not compile)
```

## What is in it

- **Content model**: text, slugs, numbers, dates, choices, rich text, pictures, files, galleries, relations, lists, groups, blocks (with versions that migrate old content), languages with fallback, page trees, menus, redirects, SEO, forms. [Content model](docs/guide/content-model.md)
- **An admin for non-technical people**: writing, form and live-preview editors, a media library, drafts, scheduling, history, shared editing, Czech and English, phone-friendly. [The admin](docs/guide/admin.md)
- **A public content API** with a website search that forgives typos, an OpenAPI document and a typed client. [Content API](docs/guide/content-api.md)
- **Accounts and access**: invitations, roles, row-level rules, an audit log, a privacy tool for one person's data. [Access rules](docs/guide/content-model.md#access-rules)
- **Safe upgrades**: migrations that stop before they lose data, upgrade steps, versioned content, a tested path from the last release. [Upgrading](docs/upgrading.md)
- **Operations**: backup and restore, content export and import between environments, seeding, error hooks, a plugin API. [Deploying](docs/deploying.md), [Plugins](docs/plugins.md)

## Documentation

| For | Start with |
|---|---|
| **Site developers** | [Getting started](docs/guide/getting-started.md) → [Content model](docs/guide/content-model.md) → [Recipes](docs/guide/recipes.md) · [Upgrading](docs/upgrading.md) · [Deploying](docs/deploying.md) |
| **Editors** (Czech) | [Příručka pro editory](docs/editors/cs/README.md) |
| **People working on tinyzoo** | [Development](docs/development.md) · [CONTRIBUTING.md](CONTRIBUTING.md) · [Roadmap](docs/roadmap.md) |

The full map, with what each page is for, is [docs/README.md](docs/README.md).

## Development

```bash
pnpm install
docker compose up -d       # the playground's Postgres on :5434
pnpm db:migrate
pnpm play                  # the playground app → http://localhost:3000/admin
pnpm check                 # typecheck, unit + API tests (the API tests production-build the playground): what CI runs on every pull request
```

Layout, tests, and the decisions behind the code: [docs/development.md](docs/development.md).
Changes to a package need a changeset: [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

Proprietary. Copyright (c) 2026 Vojtěch Moravec, all rights reserved: the code is public to read, but using it needs the author's permission. See [LICENSE](LICENSE).
