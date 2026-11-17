# The tinyzoo website

The marketing website for tinyzoo, built with tinyzoo itself: Czech (`/`), English
(`/en`) and German (`/de`). Editors work at **/admin**. The same build also runs the
public demo admin (a second deployment with its own database, reset every night).

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

## Settings

| Variable | |
|---|---|
| `NUXT_PUBLIC_DEMO_URL`, `NUXT_PUBLIC_DEMO_EMAIL`, `NUXT_PUBLIC_DEMO_PASSWORD` | where the demo admin is and its sign-in, shown on the demo page |
| `NUXT_PUBLIC_CMS_DEMO_EMAIL`, `NUXT_PUBLIC_CMS_DEMO_PASSWORD` | on the demo deployment: the shared demo account (an editor that cannot change its name or password) |

## Change what editors can write

Everything editors can write is in `cms.config.ts`. After a change:

```bash
pnpm db:generate            # writes the SQL for the change (review it)
pnpm db:migrate             # applies it
```

## Where things are

| | |
|---|---|
| `cms.config.ts` | content model: languages, settings, page blocks, news, menus, the feedback form |
| `app/components/global/Block*.vue` | how each block looks (`hero` → `BlockHero.vue`) |
| `app/pages/[...slug].vue` | every address: pages, the news list and news items, in all languages |
| `app/lib/site-i18n.ts` | the languages, their address prefixes and the few texts that live in code |
| `app/layouts/default.vue` | header (menu, language switcher), footer |
| `app/pages/design-system.vue`, `app/lib/design-system-i18n.ts` | the admin's design system in the admin's own look (`/design-system`, `/en/design-system`, `/de/designsystem`): in the footer menu, or right-click (long-press) the logo in the header |
| `scripts/seed.mjs`, `seed/` | the content, its translations and media |
