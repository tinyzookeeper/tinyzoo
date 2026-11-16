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

The first visit to `/admin` creates the first administrator. Then:

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

Components from the CMS you can use anywhere: `<CmsBlocks>`, `<CmsImage>`,
`<CmsContent>` (rich text), `<CmsNav>`, `<CmsForm>`, and `useCmsSeo()`.
