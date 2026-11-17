# Getting started

From nothing to a running website with content, your first own collection on it, and the
list of what to do before it goes live. About half an hour.

You will:

1. make a site with `pnpm create tinyzoo`, start its database and open it;
2. fill it with demo content and sign in to the admin;
3. add a collection of your own, **Team members** (a photo, a role, a hand-made order);
4. show it on the website with the typed client;
5. know what to commit, and what to do before launch.

**You need** Node 22 or newer, [pnpm](https://pnpm.io) 10, and [Docker](https://www.docker.com)
for the local database (any Postgres 16+ works instead: see [step 3](#3-the-database)).

## 1. Make the site

```bash
pnpm create tinyzoo my-site
cd my-site
pnpm install        # unless you let the questions install for you
```

`pnpm create tinyzoo` asks a few questions: the **languages** the content is written in (the
first one is the default), which **parts** the site has (news, a contact form, redirects, a
search page), whether to fill it with **demo content**, and whether to install the
dependencies now. Then it copies the **starter**: a small bakery's website with the CMS
inside. By default that is Czech and English with everything on: pages built from blocks
(opening, text, picture, call to action, contact form), news, menus with dropdowns, redirects,
site settings with opening hours, a contact form and a search page. The files are yours from
now on; nothing in them is updated behind your back.

Every question has an option, so it runs without a terminal too (`npm create tinyzoo@latest
my-site -- …` and `yarn create tinyzoo` work the same; with npm the options come after `--`):

```bash
pnpm create tinyzoo my-site --languages de,en --presets news,search --no-demo --yes
```

| Option | |
|---|---|
| `--languages cs,en,de` | the content languages; the **first is the default** (its addresses have no prefix: `/o-nas`, the others have one: `/en/about`). Default `cs,en` |
| `--presets news,forms,redirects,search` | the parts of the site, or `none` / `all`. Pages, menus, site settings and SEO are always there. Default: all |
| `--demo` / `--no-demo` | the demo content (a small bakery, written in Czech and English: it needs `cs` or `en` first). `--no-demo` makes an empty site, without `seed/` |
| `--install` / `--no-install` | install the dependencies right away, and write the typed files the site needs (below) |
| `--package-manager pnpm` | `pnpm`, `npm`, `yarn` or `bun`: the commands it prints and the README use it. Default: the one you ran it with |
| `--yes` | ask nothing: the defaults for what is not given |

`tinyzoo init <folder>` makes the same site with the same options (except the installing),
without asking anything: `pnpm dlx tinyzoo init my-site --languages de,en --no-demo`. It is
what `create-tinyzoo` runs.

**A site that differs from the starter's defaults needs two more commands.** The starter
ships the database schema, its first migration and the typed client for its own choices (cs and
en, every part). For any other choice, `create-tinyzoo --install` writes them for you; without
installing, the next steps it prints include `pnpm db:generate` (the first migration) and
`pnpm cms:client` (the typed client), to run after `pnpm install` and before `pnpm db:migrate`.
More languages than it knows words for (`de` has them; `fr` shows English ones) need an entry in
`app/utils/site.ts`.

`pnpm create` and `pnpm install` may end with a yellow box, *Ignored build scripts: esbuild,
sharp, …*. It is harmless: nothing here needs those scripts.

What is where:

| | |
|---|---|
| `cms.config.ts` | **the content model**: what editors can write. The one file you will change most |
| `app/pages/` | the website's pages. `[...slug].vue` serves every CMS page, the news list and news items |
| `app/components/global/Block<Type>.vue` | how each page block looks (`hero` → `BlockHero.vue`) |
| `app/layouts/default.vue` | header with the menu, footer with contacts and opening hours |
| `app/utils/site.ts` | the website's languages, and the few words it draws itself (headings, buttons, the address of the news list and search) in each |
| `seed/` | the demo content and its pictures (only with demo content) |
| `server/db/` | `schema.ts` and `migrations/`, **generated** from `cms.config.ts`; you commit them, you do not edit them |
| `.env` | your settings on this machine (not committed) |

## 2. Settings

```bash
cp .env.example .env
```

`.env` has two lines you need now: `DATABASE_URL` (where the database is) and
`NUXT_APP_SECRET` (a long secret the admin's sign-in cookie is sealed with; the example
value is fine on your machine, never on a server).

## 3. The database

```bash
docker compose up -d
pnpm db:migrate
```

The first command starts Postgres 16 in a container (user, password and database are all
`site`, on port 5433). The second creates the tables: it applies the migrations in
`server/db/migrations` and tinyzoo's own upgrade steps, and says what it did:

```
✓ ran upgrade steps: enable-pg-trgm
✓ applied migrations on localhost:5433/site: 0000_init, 0001_page_tree
```

> **`Bind for 0.0.0.0:5433 failed: port is already allocated`:** another Postgres on your
> machine has the port. Run `docker compose down`, pick a free port and write it in **two
> places** in `.env`: `SITE_PG_PORT=5455` (which port compose publishes, read by every
> `docker compose` command: without it the next `docker compose up` or `down` falls back
> to 5433 again) and the same port in `DATABASE_URL`
> (`postgres://site:site@localhost:5455/site`). Then `docker compose up -d`.
>
> **Not using Docker?** Create an empty database on any Postgres 16+ and put its address in
> `DATABASE_URL`. The user needs the right to run `CREATE EXTENSION` (once; search uses
> `pg_trgm`), or ask the database owner to.

## 4. Start it

```bash
pnpm dev
```

Nuxt prints the address, `http://localhost:3000` unless the port is taken (then it says
which one it uses instead: **use the address it prints** in everything below). The website
is at `/`, the admin at `/admin`.

The database is empty, so the website has nothing to show and `/admin` offers *Create the
first account*. You could do that by hand. It is quicker to let the demo content do it:

## 5. Demo content and your first sign-in

In a second terminal, in the site's folder:

```bash
SEED_EMAIL=you@example.com SEED_PASSWORD='a long password' pnpm seed
```

(If the dev server is not on port 3000, add `SEED_URL=http://localhost:3003`, using the
address `pnpm dev` printed. **Do not skip this**: the command talks to whatever answers on
the address, and `localhost:3000` may be another project.)

On a site with no administrator yet, this creates the first one with the email and password
you gave, then uploads five pictures and writes three pages (home, about, contact), four
news items (three published, one draft), both menus, the site settings and the form
recipients, in Czech and English. It prints a line for each. Running it again changes
nothing: it recognises what it made. (`pnpm seed --dry-run` shows what it would do;
`pnpm seed --reset` removes the demo content again. [Seeding](seeding.md) says more.)

Now look:

- **The website**: `/` (the home page), `/aktuality` (news), `/o-nas`, `/en` (English).
- **The admin**: `/admin`, sign in with the email and password you gave `pnpm seed`. The
  sidebar's **Content** group has *Pages* (a tree), *News*, *Redirects*, the *Contact
  form*'s messages and the *Media library*; **Settings** has *Site settings*, *Navigation*
  (the menus), *Forms* (who is told about new messages), *Team* (the people who may sign
  in) and *Privacy*. The admin speaks Czech or English by your browser, and you switch it
  under your name.

Change something: open a page, edit a heading in a block, **Save**. The preview beside the
form follows your typing; the website changes when you save.

## 6. Your first collection: team members

The starter has no team page. We will add one: people with a name, a role, a photo and an
order the client can change by dragging. Open `cms.config.ts` and add this at the bottom
(`defineEntity` and `f` are already imported):

<!-- check: getting-started/cms.config.ts append-to-starter -->
```ts
// ── team members ──
export const TeamMember = defineEntity('teamMember', {
  label: { en: 'Team members', cs: 'Lidé z týmu' },
  labelSingular: { en: 'Team member', cs: 'Člen týmu' },
  description: { en: 'The people shown on the Team page.', cs: 'Lidé, které ukazuje stránka Tým.' },
  icon: 'i-lucide-users',
  titleField: 'name',
  // The list can be arranged by dragging; the website gets the members in that order.
  admin: { list: { columns: ['photo', 'name', 'role'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Jméno' }),
    role: f.text({ required: true }).localized().label({ en: 'Role', cs: 'Pozice' }),
    photo: f.media({ accept: 'image/*' }).optional().label({ en: 'Photo', cs: 'Fotka' }),
    bio: f.text({ multiline: true, max: 400 }).optional().localized().label({ en: 'A few words', cs: 'Pár slov' }),
    position: f.number().optional().label({ en: 'Position', cs: 'Pořadí' }),
  },
  content: { public: true },
})
```

What each line does:

- `defineEntity('teamMember', …)` makes a **collection**. The name is also the address of
  its content API (`/api/content/teamMember`) and the key in the typed client; the table is
  `team_member` (SQL names are `snake_case`). Some names are reserved (`team` is: it is the
  admin's own *Team* page); the error tells you.
- `label` / `labelSingular` are what the admin calls it, in each admin language.
- `titleField` names an entry in lists and links.
- `f.text({ required: true })`: **fields are required unless you say `.optional()`**.
- `role` is `.localized()`: the Czech text is the entry's own, English is a translation
  editors add with the language switcher, and where it is missing the website falls back to
  Czech. Names and photos are the same in every language, so they are not.
- `f.media({ accept: 'image/*' })` is a picture from the media library.
- `orderField: 'position'` turns on **Arrange** in the list (drag, then save the order) and
  makes the content API return members in that order. The field itself is hidden from the form.
- `content: { public: true }` is what puts it in the public content API. Without it, a
  collection is admin-only.

Now turn the change into a migration and apply it:

```bash
pnpm db:generate
pnpm db:migrate
```

`db:generate` rewrites `server/db/schema.ts` from your config, then has drizzle-kit write a
migration (`server/db/migrations/0002_<two random words>.sql`, with `CREATE TABLE
"team_member"` and its translations table). **Read it**: it is the change your database
gets. It stops for you when a migration would lose data or fail on existing rows
([upgrading.md](../upgrading.md#the-guard-in-tinyzoo-generate)); this one only adds tables.
`db:migrate` applies it.

> The dev server restarts by itself when `cms.config.ts` changes. In the moment between
> saving the file and `pnpm db:migrate` it may print *could not build the search index — a
> table is missing*. That is true and goes away once you have migrated.

Reload `/admin`: **Team members** is in the sidebar's Content group. Add two people (**Create the first one** on the empty list, then **+ Team member**), give
one a photo from the library (or upload your own), pick the language **English** at the top
and write the English role. Then **Arrange** in the list and drag them into the order you
want.

## 7. Show it on the website

The content API is already serving them: open `/api/content/teamMember`. A website should
not guess at its shape, so generate the **typed client** from your config:

```bash
pnpm cms:client
```

This writes `app/lib/cms-content.ts` (generated, do not edit): a `TeamMember` type with the
fields you defined (`photo` is a media object or `null`, `role` is already in the language
you ask for) and a client that knows every collection. A wrong field name or sort key is
now a compile error. (The starter's block components use the same file for their props, so
renaming a block field in `cms.config.ts` breaks `pnpm typecheck` until the component
follows.) Make `app/pages/tym.vue`:

<!-- check: getting-started/app/pages/tym.vue -->
```vue
<script setup lang="ts">
import { createClient } from '~/lib/cms-content'

// /tym in Czech, /en/team in English. The language comes from the address, as on every page of the starter.
definePageMeta({ alias: ['/en/team'] })
const locale = useSiteLocale()
const cms = createClient({ baseUrl: useRequestURL().origin })

const { data: members } = await useAsyncData(
  'team-members',
  async () => (await cms.teamMember.list({ locale: locale.value })).items,
  { watch: [locale], default: () => [] },
)
useHead({ title: () => (locale.value === 'en' ? 'Team' : 'Tým') })
</script>

<template>
  <section class="mx-auto max-w-5xl px-4 py-12">
    <h1 class="text-3xl font-bold mb-8">{{ locale === 'en' ? 'Our team' : 'Náš tým' }}</h1>
    <ul class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="m in members" :key="m.id">
        <CmsImage v-if="m.photo" :media="m.photo" class="aspect-square w-full rounded-xl object-cover" />
        <h2 class="mt-3 text-lg font-semibold">{{ m.name }}</h2>
        <p class="text-muted">{{ m.role }}</p>
        <p v-if="m.bio" class="mt-1 text-sm">{{ m.bio }}</p>
      </li>
    </ul>
    <p v-if="!members.length" class="text-muted">{{ locale === 'en' ? 'Nobody here yet.' : 'Zatím tu nikdo není.' }}</p>
  </section>
</template>
```

Open `/tym` and `/en/team`. Things worth knowing about the code:

- `createClient({ baseUrl: useRequestURL().origin })` points the client at the site itself,
  on the server and in the browser. A website in its own repo uses the CMS's address.
- `cms.teamMember.list({ locale })` returns `{ items, total, page, limit }`. Try
  `sort: 'nme'`: the compiler stops you.
- A **required** picture or file (`f.media()`, `f.file()` without `.optional()`) is typed
  `… | null` as well, because the API says `null` when there is no file to give. Write
  `d.file?.url`, not `d.file.url`: the strict compiler refuses the second.
- `<CmsImage>` comes with tinyzoo: it draws a media object with its alt text, real size,
  lazy loading and the focal point the editor chose. `<CmsNav>`, `<CmsBlocks>`,
  `<CmsContent>` and `<CmsForm>` are the others
  ([the frontend kit](content-api.md#the-frontend-kit)).
- A page file named after a CMS page (`/tym`) wins over the starter's catch-all
  `[...slug].vue`, so CMS pages and hand-made pages live side by side.

Last, put it in the menu: in the admin open **Navigation** (under Settings), add a link to the main menu
with the address `/tym` (a page that is not a CMS entry has no picker entry, so you type it)
and, in the English tab, `/en/team`. **Save.**

Check that it all still compiles:

```bash
pnpm typecheck
```

## 8. What to commit

```bash
git init
git add -A
git commit -m "My site"
```

`.gitignore` is already right. In the commit:

| Commit | Do not commit |
|---|---|
| `cms.config.ts`, `app/`, `seed/`, `package.json` and the lockfile | `.env` (secrets) |
| `server/db/schema.ts` **and** `server/db/migrations/` (the SQL, the `meta/` snapshots and journal: drizzle-kit needs them to write the next migration) | `.nuxt/`, `.output/` (build results) |
| `app/lib/cms-content.ts` (the typed client; regenerate it with `pnpm cms:client` whenever `cms.config.ts` changes) | `.cms-uploads/` (uploaded files on your machine), `.cms-mail/` |

The habit from now on: **change `cms.config.ts` → `pnpm db:generate` → read the migration →
`pnpm db:migrate` → `pnpm cms:client` → commit them together.**

## Going live

Everything above ran on your machine. A live site needs these set, on the platform's
environment (never in git). The whole list, with the reasons, is in
[deploying.md](../deploying.md); this is the checklist.

| | Do | Why |
|---|---|---|
| ☐ | **Setup code.** Deploy, open the project's log, find `Setup code: XXXX-XXXX-XXXX-XXXX`, open `/admin/setup`, type it, make the first account. Or set `NUXT_CMS_AUTH_SETUP_TOKEN` to a code of your own | a fresh deploy has no administrator; without a code, whoever opens the page first would become one. In production the code is always required |
| ☐ | **`NUXT_APP_SECRET`**: 32+ random characters (`openssl rand -base64 32`) | the sign-in cookie is sealed with a key derived from it (other modules use it too). Changing it signs everyone out. A production server will not start without it |
| ☐ | **`NUXT_CMS_PUBLIC_URL`**: the site's real address (`https://www.example.cz`) | links in emails (invitations, password resets) and the sitemap use it, never the request's `Host` header |
| ☐ | **Storage**: `NUXT_CMS_STORAGE_DRIVER=s3` (or `r2`) and the bucket's `NUXT_CMS_STORAGE_S3_*` variables, one bucket per environment | a container's disk is lost on every deploy; uploads must live in a bucket |
| ☐ | **Email**: `NUXT_CMS_MAIL_TRANSPORT=smtp`, `NUXT_CMS_MAIL_FROM`, `NUXT_CMS_MAIL_SMTP_*` | invitations, password resets and "new message" notifications; `log` only prints them |
| ☐ | **`NUXT_CMS_MIGRATIONS_ON_START=true`** (and `DATABASE_URL`) | the new version applies its migrations and upgrade steps itself when it starts |
| ☐ | **Backups**: Postgres backed up by the platform; the bucket versioned; a `tinyzoo backup` before any deploy that changes the schema; **one restore tried** into a scratch database | a backup nobody has restored is a hope ([the drill](../deploying.md#restore-drill)) |
| ☐ | **Redis** (`REDIS_URL`) if you run more than one instance | rate limits and live updates are shared through it |
| ☐ | **Proxies**: `NUXT_CMS_AUTH_TRUSTED_PROXIES` equal to the number of proxies in front of the app | rate limits must see the visitor, not the proxy |
| ☐ | **Forms**: who is told about messages (**Forms** in the admin, or `NUXT_CMS_FORMS_NOTIFY_TO`), and a `retentionDays` that matches your privacy policy | see [Privacy](../deploying.md#privacy-gdpr) |
| ☐ | **The admin's name**: in `app/app.config.ts` set `cms.admin.name` (and `siteUrl`) to the client's name, per language | the admin's top left, its sign-in page and its tab say whose site it is; the starter says "My website" |
| ☐ | **`robots.txt` and the sitemap**: the starter serves `/robots.txt` (keeps crawlers out of `/admin`, names `/sitemap.xml`); check both on the live address, and add the site's fixed pages to `cms.sitemap.paths` in `nuxt.config.ts` | search engines find the pages; the sitemap needs `NUXT_CMS_PUBLIC_URL` and answers 404 without it |
| ☐ | **Real content**: replace the demo texts and pictures, or delete `seed/` | editors start from your content, not the bakery's |

[deploying.md](../deploying.md#pushbase-step-by-step) walks the same list on Pushbase, and a
deployed site can be seeded from your laptop with `pnpm seed`
([Seeding a deployed site](../deploying.md#seeding-a-deployed-site)).

## Where next

- [Content model](content-model.md): every field type, languages, presets, access rules, the content API.
- [Recipes](recipes.md): contact form, news, team page, FAQ, opening hours, gallery, downloads, partners, events, menus.
- [Upgrading](../upgrading.md): moving the site to a newer tinyzoo.
- [Plugins](../plugins.md): adding a feature of your own.
- The editors' manual in Czech: [docs/editors/cs](../editors/cs/README.md). Hand it to the client.
