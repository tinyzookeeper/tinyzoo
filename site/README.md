# The tinyzoo website

The marketing website for tinyzoo, built with tinyzoo itself: Czech (`/`), English
(`/en`) and German (`/de`). Editors work at **/admin**. The same build also runs the
public demo admin (a second deployment with its own database, reset every night).

## Where it runs

| Address | What | Pushbase project |
|---|---|---|
| https://tinyzoo.dev | this website with the documentation | `tinyzoo` |
| https://demo.tinyzoo.site | the public demo (the same image with other settings) | `tinyzoo-demo` |
| https://account.tinyzoo.dev | the account service (`cloud/`, see its README) | `tinyzoo-account` |

tinyzoo's own things live under `tinyzoo.dev`: this website, the account service and Keeper (`keeper.tinyzoo.dev`). `tinyzoo.site` is for websites: a site's starter address is `<name>.tinyzoo.site`, and the demo stays there. The account service and customers' websites are never on the same domain.

Canonical links, the sitemap and links in e-mails use the addresses above (`NUXT_SITE_URL`, `NUXT_CMS_PUBLIC_URL`). The website's earlier addresses redirect to it: `NUXT_CMS_REDIRECT_HOSTS=tinyzoo.pushbase.app,tinyzoo.site` names the bare `tinyzoo.site` only, never a name under it (a host name is matched whole). The projects' first addresses (`tinyzoo-demo.pushbase.app`, `tinyzoo-account.pushbase.app`) still answer.

## Start

```bash
pnpm install
cp .env.example .env
pnpm db:migrate             # create the tables (DATABASE_URL in .env)
pnpm dev                    # → http://localhost:3000
SEED_URL=http://localhost:3000 SEED_EMAIL=admin@example.com SEED_PASSWORD=… pnpm seed
```

`pnpm seed` fills an empty site through the admin API: pages, news, menus, settings,
the pictures and the admin clips (`seed/media`), then the English and German
translations (`seed/translations/<lang>.mjs`). On an empty database it creates the
first administrator with those details.

`pnpm reset` (same variables) deletes every entry and file and seeds again. The demo
deployment runs it every night.

## Plans

The "Plány" page (`/plany`, `/en/roadmap`, `/de/roadmap`) lists the **Plan** collection
(Plány / Roadmap in the admin): title and text per language, a stage (done, now, next,
later), an optional version and an animal (or Keeper's mark). Editors arrange them by dragging ("Seřadit").
The roadmap block (`BlockRoadmap.vue`) draws them as a timeline: Done first, one group per
version (oldest first), then Now (a dark card per plan), Next (per version) and Later (a
grid of cards); within a group, the editors' order. The block itself keeps only its
heading, text and note (its old fixed `items` are dropped on read since block version 2).
When it is the page's first block, its heading is the page's `<h1>`.

The plans the site starts with are in `seed/plans.mjs`. `pnpm seed` adds them, and
`pnpm seed:plans` (same variables, an existing administrator) adds only them. It adds
**only the plans the site is missing** (matched by their Czech title), and the English or
German text of a seeded plan that has none. It never changes or deletes a plan, so a run
that stopped halfway can simply be run again. A plan an editor deleted, or whose Czech title
they changed, counts as missing and comes back, so use it to fill a new site, not later.

## Settings

| Variable | |
|---|---|
| `NUXT_PUBLIC_DEMO_URL`, `NUXT_PUBLIC_DEMO_EMAIL`, `NUXT_PUBLIC_DEMO_PASSWORD` | where the demo admin is and its sign-in, shown on the demo page |
| `NUXT_PUBLIC_CMS_DEMO_EMAIL`, `NUXT_PUBLIC_CMS_DEMO_PASSWORD` | on the demo deployment: the shared demo account (an editor that cannot change its name or password) |
| `NUXT_SITE_URL` | the site's address for canonical links, og:url, schema.org and the sharing images (default `https://tinyzoo.dev`); the demo sets its own |
| `NUXT_SITE_INDEXABLE` | `false` on the demo (the same content as the website): every page gets `noindex`, every response `X-Robots-Tag: noindex`, and `/robots.txt` says `Disallow: /` |

## Search engines and sharing

Nuxt SEO, module by module (`nuxt.config.ts`): `nuxt-site-config`, `@nuxtjs/robots`
(`/robots.txt`), `nuxt-og-image`, `nuxt-schema-org` and `nuxt-seo-utils`. Not the
`@nuxtjs/seo` bundle: it brings `nuxt-ai-ready`, which wants another `drizzle-orm`.
`/sitemap.xml` is `@nuxtjs/sitemap`, which comes with tinyzoo and gets tinyzoo's entries
(`server/plugins/sitemap.ts` writes the home pages as `/`, `/en`, `/de` and adds the news
pages; `sitemap.exclude` keeps the search pages out).

- **Sharing images** are drawn on request by `app/components/OgImage/Tinyzoo.satori.vue`
  from the page's first heading and its description (`useShareImage`); an image uploaded
  in a page's SEO fields wins. They are cached for a day, and their addresses are signed
  with `NUXT_APP_SECRET`.
- **Fonts in the images** (don't revert): `@nuxt/fonts` is in `modules` before
  `nuxt-og-image` and pinned to 1.2.0 in `pnpm-workspace.yaml`. nuxt-og-image looks for
  @nuxt/fonts ≥ 1.0 when it starts; Nuxt UI only brings it in later and asks for 0.14, and
  without either the images fall back to Inter without ť ř č š ž ů. The `latin-ext`
  subset carries the Czech and German letters. After changing fonts, delete
  `node_modules/.cache/nuxt/.nuxt/cache/og-image`.
- **One sharp.** nuxt-og-image and tinyzoo must share one `sharp` version (0.35.5): with two,
  the server cannot load libvips on Linux (`ERR_DLOPEN_FAILED`).

## Documentation

`/dokumentace`, `/en/docs` and `/de/dokumentation` show the Markdown in the repository's `docs/`: the editors'
guide in its three languages and the developer pages. Nothing of it is in the database.

- **Developer pages are English only** (decided for 1.0), at `/en/docs/developers`. The Czech and German contents,
  doors and search lead there, with a note in their language; the old `/dokumentace/pro-vyvojare/…` and
  `/de/dokumentation/entwicklung/…` addresses redirect there (301). They have only an English `hreflang`.
- **Czech text** gets a non-breaking space after a one-letter word (`czechSpaces` in `modules/docs/render.ts`),
  outside code and links.

- **Built, not stored.** `modules/docs` (Nuxt loads it from `modules/` by itself) renders every page once per
  language when the site is built (`marked`, plus a small highlighter) and hands the JSON to Nitro as server assets,
  so it is inside `.output` and read from memory. The pictures the pages show are copied next to it and served
  at `/docs/img/…`. In `pnpm dev` the Markdown, the pictures and the clips are watched and rendered again.
- **Generated pages.** One developer page is not a Markdown file: "Example: the API of one site" (`/en/docs/developers/api-example`)
  is made by `modules/docs/openapi.ts` from `test/contracts/openapi.playground.json`, the OpenAPI document the contract
  tests keep equal to what `buildOpenApiDocument` writes for the playground's config. `GENERATED` in `modules/docs/build.ts`
  says which page it follows (`content-api-reference`); a new generated page is one more entry there.
- **Read by** `server/api/site-docs/` (`page`, `nav`, `search`) and drawn by `app/pages/dokumentace/[...path].vue`
  with `components/DocsSidebar.vue`. The addresses are in `shared/docs.ts`.
- **Search.** The website search (the search page and the ⌘K palette) also asks `/api/site-docs/search`, which
  matches the same way as the content search (accents and small typos forgiven), heading by heading.
- **Clips** are `public/docs/clips/<name>.<lang>.mp4`; how a page places one, and how translated screenshots are
  picked, is in `docs/README.md` ("On the website").
- **Menus.** The header and the footer add a link to the docs right after the link for developers when the menu
  in the admin has none, so the docs are in the menu on every deployment; add the link in the admin to place it
  yourself.

## Change what editors can write

Everything editors can write is in `cms.config.ts`. After a change:

```bash
pnpm db:generate            # writes the SQL for the change (review it)
pnpm db:migrate             # applies it
```

## Where things are

| | |
|---|---|
| `cms.config.ts` | content model: languages, settings, page blocks, news, plans, menus, the feedback form |
| `app/components/global/Block*.vue` | how each block looks (`hero` → `BlockHero.vue`) |
| `app/pages/[...slug].vue` | every address: pages, the news list and news items, in all languages |
| `modules/docs/`, `app/pages/dokumentace/`, `server/api/site-docs/`, `shared/docs.ts` | the documentation, rendered from `docs/` (above) |
| `app/lib/site-i18n.ts` | the languages, their address prefixes and the few texts that live in code |
| `app/layouts/default.vue` | header (menu, language switcher), footer |
| `app/pages/design-system.vue`, `app/lib/design-system-i18n.ts` | the admin's design system in the admin's own look (`/design-system`, `/en/design-system`, `/de/designsystem`): in the footer menu, or right-click (long-press) the logo in the header |
| `scripts/seed.mjs`, `seed/` | the content, its translations and media; `seed/plans.mjs` the starting plans (`scripts/seed-plans.mjs`) |
