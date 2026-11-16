# tinyzoo

*A tiny CMS that lives inside your Nuxt app.*

**tinyzoo** is a code-first CMS for Nuxt 4, shipped as one Nuxt layer and module. You
define your content once, in TypeScript (`cms.config.ts`); tinyzoo derives the database
schema and its migrations, validation, a typed content API and the admin your clients'
editors use to change **data**, never the site's structure. It runs in your own Nuxt app
and your own Postgres, on any Node host.

## Install

A new website, with demo content in Czech and English (Node 22+, pnpm 10, Docker for the
local database):

```bash
pnpm dlx tinyzoo init my-site
cd my-site
pnpm install
cp .env.example .env
docker compose up -d && pnpm db:migrate
pnpm dev                    # the site, and /admin
# in a second terminal, while `pnpm dev` runs: the demo content and your first administrator
SEED_EMAIL=you@example.com SEED_PASSWORD='a long password' pnpm seed
```

Into an existing Nuxt 4 app: `pnpm add tinyzoo @tinyzoo/client`, then extend the layer in
`nuxt.config.ts` (`extends: ['tinyzoo/layer']`). The steps are in
[Getting started](https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/guide/getting-started.md).

## Documentation

The documentation is not part of the npm package; it lives on GitHub:

- [Getting started](https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/guide/getting-started.md)
- [Recipes](https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/guide/recipes.md): contact form, news, team, FAQ, gallery and more
- [Content model](https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/guide/content-model.md): every field type and option
- [Deploying](https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/deploying.md) and [upgrading](https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/upgrading.md)
- [Changelog](https://github.com/tinyzookeeper/tinyzoo/blob/main/packages/cms/CHANGELOG.md)

Problems and questions: <https://github.com/tinyzookeeper/tinyzoo/issues>.

## Licence

Proprietary, all rights reserved (see `LICENSE`). The package is published so that sites
built with the author's permission can install it; no licence to use, copy, modify or
distribute it is granted without the author's prior written permission.
