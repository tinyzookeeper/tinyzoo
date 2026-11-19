# tinyzoo 1.0

tinyzoo 1.0 is the first stable version. This page says what that promises.

In short: an update within 1.x does not break your site.

## What stays stable

These follow [semantic versioning](https://semver.org) since 1.0:

- the content API your website reads, and the types of `@tinyzoo/client`;
- the config API in `cms.config.ts`: `defineEntity`, `f.*`, blocks, presets, seeds and plugins;
- the `cms` options in `nuxt.config.ts` and the `NUXT_CMS_*` variables;
- the publish webhook and the Nitro hooks;
- the two server helpers for plugins: `useCms()` and `requireCmsUser(event)`;
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

You can skip minor versions: 1.1 straight to 1.4 is safe. Within 1.x, tinyzoo's own tables only ever gain things ([why](upgrading.md#skipping-minor-versions)).

## What is not covered

These are tinyzoo's own and can change in any minor version:

- the admin's screens and its own components;
- the admin's API (`/api/cms/**`);
- the server's other utilities, and anything marked `@internal`;
- the SQL tables and their column names (an entity's `table` object is frozen for reading, see [the public API](api-surface.md#types)). tinyzoo migrates them for you. Its own `cms_*` tables only gain things within 1.x ([why](upgrading.md#skipping-minor-versions)).

Also not promised:

- the text the CLI prints. Its commands, flags and exit codes are promised, its wording is not. A script should read the exit code, not the output;
- how the admin looks;
- performance numbers, and the limits listed as tuning in [the public API](api-surface.md#numbers-promised-and-numbers-tuned).

[The public API](api-surface.md#not-covered) has the full list.

## What a minor version may add

Your code must expect more than it knows today. A minor version may add keys to answers, new values to the lists you receive (webhook change types, form statuses, roles, field kinds) and new routes, hooks and flags.

So ignore what you do not know. A `switch` over such a value needs a `default`. [What a minor release may add](api-surface.md#what-a-minor-release-may-add) has the full list.

## Platform and dependencies

**Nuxt, Nuxt UI, Nitro and nuxt-auth-utils.** tinyzoo is built on them.

- A new major of Nuxt, Nuxt UI or Nitro comes with a new major of tinyzoo.
- So does a new 0.x minor of nuxt-auth-utils (0.6 to 0.7), since that is how it marks a breaking change.
- tinyzoo 2.0 is expected with Nuxt 5.

**1.x after 2.0.** When 2.0 is out, 1.x still gets fixes for 6 months. That is the window planned for Nuxt 4 after Nuxt 5, so a site can move both together.

**Node.** 1.x runs on the Node lines that both Node.js and the `nuxt` it needs support. Today that is `^22.22.3 || ^24.15.0 || >=26.0.0` (`engines.node`).

- A line that has reached its end of life can be dropped in a minor version.
- The minor before says so in its changelog.
- Node 22 reaches its end of life on 2027-04-30 ([endoflife.date](https://endoflife.date/nodejs)).

**Postgres.** 16 or later, for all of 1.x.

**Drizzle.** 1.x stays on `drizzle-orm` 0.x and on drizzle's migration folder format (`server/db/migrations` with `meta/_journal.json`). drizzle 1.0 comes with tinyzoo 2.0.

- `drizzle-orm` is a peer dependency: your site lists it in its own `package.json`. `tinyzoo upgrade` checks that its version fits.
- Keep `drizzle-kit` on 0.x too. `tinyzoo status` and `tinyzoo upgrade` warn when the site has drizzle-kit 1.0.
- A new drizzle-orm 0.x minor can come with a tinyzoo minor. Its changelog then says so, with an **Upgrade** section for the code that has to change.

**Drizzle's types.** An entity's `table`, the query helpers (`eq`, `and`, `sql` and the rest) and the `db` of `useCms()` come from `drizzle-orm`. Their names and what they do are frozen. Their TypeScript types come from drizzle-orm and follow it.

**`useCms().db` is drizzle's.** Its whole query API (`select`, `insert`, `transaction` and the rest) is drizzle's own. tinyzoo promises that `db` is a drizzle database for Postgres with the entities' tables. It does not promise more than drizzle does.

**The driver is not promised.** Today `db` runs on node-postgres (`pg`), and `db.$client` is its `Pool`. That can change in a minor version. Use drizzle's API, not `$client`.

## Moving to 1.0

Coming from a 0.x version? Follow [Upgrading](upgrading.md) one version at a time. Each version has its own section with what you have to do. The last one is [From 0.7 to 1.0](upgrading.md#from-07-to-10).

After 1.0, every update follows the same steps: [On every upgrade](upgrading.md#on-every-upgrade).
