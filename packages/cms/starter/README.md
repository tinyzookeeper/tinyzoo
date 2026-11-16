# A website with tinyzoo

The website and its CMS in one Nuxt app. Editors work at **/admin**; the pages read
the content from the CMS.

## Start

```bash
pnpm install
cp .env.example .env
docker compose up -d        # the database
pnpm db:migrate             # create the tables
pnpm dev                    # → http://localhost:3000/admin
```

The first visit to `/admin` creates the first administrator.

**Demo content.** The starter comes with a small bakery's content in Czech and English
(`seed/index.ts`: pages, news, menus, settings, pictures). With `pnpm dev` running, in a
second terminal:

```bash
SEED_EMAIL=you@example.com SEED_PASSWORD='a long password' pnpm seed
```

On a new site this creates the first administrator with those details (after the first
visit to `/admin`, use that account's). Running it again changes nothing; `pnpm seed
--dry-run` shows what it would do and `pnpm seed --reset` removes the demo content and
writes it fresh. Replace the texts and pictures with your own, or delete `seed/` when the
site has its real content.

Without the demo content, make the first content yourself:

1. **Pages** → create a page with the address `home`. It becomes the home page.
2. **Navigation** → add links to the main menu (pick pages instead of typing addresses).
3. **Site settings** → name, contacts, opening hours.
4. **Forms** → who gets an email about messages from the contact form.

## Change what editors can write

Everything editors can write is in `cms.config.ts`. After a change:

```bash
pnpm db:generate            # writes the SQL for the change (review it)
pnpm db:migrate             # applies it
```

## Where things are

| | |
|---|---|
| `cms.config.ts` | content model: settings, pages and their blocks, news, menus, forms |
| `app/components/global/Block*.vue` | how each block looks (`hero` → `BlockHero.vue`) |
| `app/pages/[...slug].vue` | pages, the news list and news items, in Czech and English |
| `app/layouts/default.vue` | header with the menu, footer with contacts and opening hours |
| `seed/index.ts`, `seed/media/` | the demo content and its pictures (`pnpm seed`) |

Components from the CMS you can use anywhere: `<CmsBlocks>`, `<CmsImage>`,
`<CmsContent>` (rich text), `<CmsNav>`, `<CmsForm>`, and `useCmsSeo()`.
