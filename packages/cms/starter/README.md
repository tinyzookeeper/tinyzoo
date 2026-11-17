# A website with tinyzoo

The website and its CMS in one Nuxt app. Editors work at **/admin**; the pages read
the content from the CMS.

## Start

```bash
pnpm install
cp .env.example .env        # your settings, and a NUXT_APP_SECRET of your own (openssl rand -base64 32)
docker compose up -d        # the database
pnpm db:migrate             # create the tables
pnpm dev                    # → http://localhost:3000/admin
```

The first visit to `/admin` creates the first administrator.

<!-- #if demo -->
**Demo content.** The starter comes with a small bakery's content in Czech and English
(`seed/index.ts`: pages, menus, settings, pictures and whatever else this site has). With `pnpm dev` running, in a
second terminal:

```bash
SEED_EMAIL=you@example.com SEED_PASSWORD='a long password' pnpm seed
```

On a new site this creates the first administrator with those details (after the first
visit to `/admin`, use that account's). Running it again changes nothing. `pnpm seed --dry-run`
shows what it would do, `pnpm seed --reset` removes the demo content and writes it fresh.
Replace the texts and pictures with your own, or delete `seed/` when the site has its real
content.

Without the demo content, make the first content yourself:
<!-- #endif -->
<!-- #if !demo -->
This site starts empty. Make the first content yourself:
<!-- #endif -->

1. **Pages** → create a page with the address `home`. It becomes the home page.
2. **Navigation** → add links to the main menu (pick pages instead of typing addresses).
3. **Site settings** → name, contacts, opening hours.
<!-- #if forms -->
4. **Forms** → who gets an email about messages from the contact form.
<!-- #endif -->

## Change what editors can write

Everything editors can write is in `cms.config.ts`. After a change:

```bash
pnpm db:generate            # writes the SQL for the change (review it)
pnpm db:migrate             # applies it
pnpm cms:client             # the typed client (app/lib/cms-content.ts)
```

The block components are typed from that client: rename a block's field and `pnpm typecheck`
points at every component that still uses the old name.

## Where things are

| | |
|---|---|
| `cms.config.ts` | content model: what editors can write, and the site's languages |
| `app/components/global/Block*.vue` | how each block looks (`hero` → `BlockHero.vue`) |
| `app/pages/[...slug].vue` | every page from the CMS, in each language |
| `app/layouts/default.vue` | header with the menu and the language switcher, footer with contacts and opening hours |
| `app/composables/useSite.ts`, `app/utils/site.ts` | the visitor's language, the site settings and menus, the page being shown, the language switcher; the languages and the few words the website draws itself |
| `server/plugins/sitemap.ts`, `server/routes/robots.txt.get.ts` | the home page as `/` in the sitemap; `robots.txt` |
<!-- #if demo -->
| `seed/index.ts`, `seed/media/` | the demo content and its pictures (`pnpm seed`) |
<!-- #endif -->

Components from the CMS you can use anywhere: `<CmsBlocks>`, `<CmsImage>`,
`<CmsContent>` (rich text), `<CmsNav>`, `<CmsForm>`, and `useCmsSeo()`.
