# Content model

Everything editors can write is defined in one file, `cms.config.ts`, in TypeScript. From it
tinyzoo derives the database schema (and the migration), the validation, the admin's forms
and lists, the public content API and the typed client for your website. There is no
settings screen that changes the structure: **editors change data, developers change
structure**, in git, and types follow it from the database to the page.

This page is the reference for that file. To build with it, start with
[Getting started](getting-started.md) and [Recipes](recipes.md).

**Contents:** [the config file](#the-config-file) · [collections](#collections) ·
[fields](#fields) · [relations](#relations) · [lists](#lists) · [groups](#groups) · [blocks](#blocks) ·
[media fields](#media-fields) · [globals](#globals) · [presets](#presets) (pages, the page tree, menus,
redirects, SEO, forms) · [languages](#languages) · [links that follow their page](#links-that-follow-their-page) ·
[publishing](#publishing) · [access rules](#access-rules) · [reading content](#reading-content)

## The config file

`cms.config.ts` sits in the site's root. tinyzoo reads **every export**: an entity
(`defineEntity`, `defineSingleton` or a preset) becomes a collection or a global, `locales`
(`defineLocales`) sets the languages, and `plugins` lists the plugins. Other exports are
ignored, so helper constants are fine.

<!-- check: content-model/cms.config.ts -->
```ts
import { defineEntity, defineLocales, f } from 'tinyzoo'

export const locales = defineLocales({ default: 'cs', locales: ['cs', 'en'] })

export const Post = defineEntity('post', {
  label: 'Posts',
  titleField: 'title',
  fields: {
    title: f.text({ required: true }),
    slug: f.slug({ from: 'title', unique: true }),
    body: f.richtext(),
  },
  content: { public: true, slug: 'slug', path: '/blog/:slug' },
})
```

After every change to this file:

```bash
pnpm db:generate     # schema.ts and a migration for the difference: read it
pnpm db:migrate      # apply it
pnpm cms:client      # refresh the typed client
```

Entities are typed **without annotations**: `Row<typeof Post>` is what a row holds,
`Insert<typeof Post>` what you may create it with (`import type { Row, Insert } from 'tinyzoo'`).

## Collections

`defineEntity(name, options)` makes a collection: many entries, a list and a form in the
admin. `defineSingleton` makes a [global](#globals).

| Option | |
|---|---|
| `name` (first argument) | the entity's identity: the address in the content API (`/api/content/<name>`), the key in the typed client, the table (`snake_case` of it: `teamMember` → `team_member`). Names starting with `_` and `media`, `graph`, `login`, `setup`, `forgot`, `reset`, `invite`, `team`, `account`, `p` are reserved, and so are the field names `id`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `parentId`, `locale`, `locales` |
| `label`, `labelSingular`, `description`, `icon` | what the admin calls it ("Posts" / "Post"), a sentence for the list's empty state, an [Iconify](https://icones.js.org) name (`i-lucide-newspaper`). Each can be one string or one per admin language: `{ en: 'Posts', cs: 'Články' }` |
| `titleField` | the field that names an entry in lists, links and search |
| `fields` | the fields ([below](#fields)) |
| `content` | how it is delivered to the website ([reading content](#reading-content)) |
| `publish` | a draft / published workflow ([publishing](#publishing)) |
| `access` | row-level rules on top of the roles ([access rules](#access-rules)) |
| `admin` | how the admin lays it out: `list` (`columns`, `searchable`, `orderField` to arrange by dragging, `layout`), `editor` (`write`, `form`, `preview`), `sections`, `tabs` ([the admin](admin.md#admin-look--language)) |
| `live` | every write is live at once (redirects); people who may not publish cannot write it |

Every row also gets `id` (uuid), `createdAt`, `updatedAt`, `createdBy` and `updatedBy`.

## Fields

Every field is made by an `f.*` factory, then refined with modifiers. The set is closed:
these are all the types.

| Factory | An editor sees | Stored as | Use it for |
|---|---|---|---|
| `f.text(opts)` | a line of text (or a growing box with `multiline: true`) | `text` | names, titles, short texts. `max` caps the length. `format: 'email'`, `'url'` (a full `https://…` address), `'path'` (an address on this site, `/old-page`) or `'link'` (a page, `https://…`, `mailto:`, `tel:` or an anchor; the only one that can hold a [reference to a page](#links-that-follow-their-page)) checks the value. Spaces around it are trimmed |
| `f.slug({ from, unique })` | a lowercase-and-dashes address part, filled in from the `from` field until edited | `text` | the part of a web address (`/blog/:slug`). `unique: true` adds a unique index. Can be `.localized()` |
| `f.number({ int, min, max })` | a number box | `integer` (`int: false`: `numeric(12,2)`) | counts, positions, prices. **A decimal (`int: false`) is a string** in a `Row`, in a select and in the content API (`"19.99"`: a number could not hold it exactly): read it with `Number(row.price)`. `Insert` and `Update` take a number or a numeric string. A whole number is a number everywhere |
| `f.boolean({ default, mustBeTrue })` | a switch | `boolean`, never null (default `false`) | "Show on the home page", "Open in a new tab". `mustBeTrue: true` refuses `false`: a consent on a [website form](recipes.md#1-a-contact-form) that must be ticked (the form marks it required and tells the visitor, in their language, to tick it) |
| `f.datetime({ default: 'now', allDay })` | a date and time picker in the admin's time zone; `allDay: true` adds an "All day" switch (stored at 0:00) | `timestamptz` | when something happens or goes live |
| `f.select({ options, default, labels, icons })` | a choice | a Postgres enum | status, kind, category. `options` must be `as const`; `labels` give each option a name per admin language, `icons` an icon |
| `f.richtext()` | a rich-text editor: headings, bold, lists, quotes, links, inline pictures | `jsonb` (a TipTap document, sanitised on write and at render) | articles and text that needs formatting. Draw it with `<CmsContent :doc="…" />` |
| `f.color()` | a colour picker and a `#rrggbb` box | `text` | a category's colour, an accent |
| `f.media({ accept })` | a picture from the media library, or an upload | a foreign key to the library | one picture (`accept: 'image/*'`). The API returns `{ id, url, width, height, alt, mime, focal }`, or `null` when there is none: **the generated type is `… \| null` also for a required field**, so write `d.photo?.url` |
| `f.file({ accept })` | a file from the library (PDF by default) | a foreign key to the library | a document to download. Typed `… \| null` like `f.media`: `d.file?.url` |
| `f.gallery({ accept, max })` | several pictures, in order, each with a caption | `jsonb` `[{ mediaId, caption }]` (up to 200) | albums, photo series |
| `f.relation({ to, kind, … })` | a picker for entries of another collection | a foreign key, or a junction table | author of a post, tags of a post |
| `f.list({ fields, max })` | rows of the same few fields: add, drag, duplicate, remove | `jsonb` | opening hours, a price list, FAQ items |
| `f.group({ fields })` | a fieldset | `jsonb` | an address, a contact: fields that belong together |
| `f.blocks({ …blocks })` | an ordered list of different typed sections | `jsonb` | a page built from blocks |

**Modifiers**, on any field:

| | |
|---|---|
| `.optional()` | the value may be empty (`null`). **Everything is required unless you say so**: without it the column is `NOT NULL`. (`f.text({ required: true })` additionally refuses an empty string; a plain `f.text()` accepts `''`.) A relation is the exception: optional unless `required: true` |
| `.localized()` | one value per language, with fallback to the default language. Only text, slug, rich text, blocks, lists and groups can be translated; pictures, numbers, dates and choices are shared by all languages (a field that cannot be localized throws when the config loads) |
| `.unique()` | a unique constraint |
| `.withDefault(value)` | a database default; new entries start with it. Also how to add a required field to a collection that has entries ([upgrading](../upgrading.md#adding-a-required-field)) |
| `.label(text)`, `.help(text)` | the admin's label (humanised from the key by default) and a hint under the field; one string or per admin language |
| `.position('sidebar')` | put the field in the side panel instead of the main column |
| `.group(label)` | a heading for fields in the side panel (the SEO fields use it) |
| `.icon(name)` | an icon in front of the field |

```ts
publishedAt: f.datetime().optional().label('Publish date'),
slug: f.slug({ from: 'title', unique: true }).help('Filled in from the title: change it if you like.'),
```

Slugs fill in from their source field until the editor changes them, and never overwrite an
existing slug. Fields in the admin read as a few titled sections: name them with
`admin.sections` (see [the admin](admin.md#admin-look--language)).

## Relations

```ts
author: f.relation({ to: () => Author, kind: 'many-to-one', required: true, onDelete: 'restrict' }),
tags:   f.relation({ to: () => Tag, kind: 'many-to-many' }),
posts:  f.relation({ to: () => Post, kind: 'one-to-many', inverseOf: 'author' }),   // on Author: the other side
```

- `to` is a function, so entities can point at each other.
- **many-to-one** is a foreign key column (`author_id`) and a picker. `onDelete` is `restrict`
  (default when required: the author cannot be deleted while a post uses it) or `set null`
  (default when optional), `cascade` (deleting the target deletes these entries too) or `no action`.
- **many-to-many** is a junction table (`post_to_tag`; `through: 'name'` names it yourself)
  and a multi-picker. Saving writes only the difference.
- **one-to-many** is the virtual other side of a many-to-one (`inverseOf` names that field):
  no column, shown as a read-only list.
- The content API resolves relations into nested objects (`populate` chooses which; all by
  default) and a non-public target collapses to `{ id, title }`.

## Lists

Rows of the same few fields: opening hours, a price list, FAQ items, a row of cards.

```ts
team: f.list({ fields: { name: f.text({ required: true }), role: f.text() }, max: 30 }),
// → [{ id: 'k3j…', type: 'item', name: 'Jana', role: 'Trenérka' }, …]
```

The editor adds, drags into order, duplicates and removes items (with undo). Items hold the
same field types as blocks (text, slug, number, boolean, datetime, select, rich text, media,
groups) and the list can be `.localized()`. Options: `max`, `itemLabel` (what an item is
called: "Opening hours"), `itemType` (the stored `type`, default `'item'`), and `version` /
`upgrade` for [changing the items later](#changing-a-block-later-version-and-upgrade). Each
item has a stable `id`, a good `:key` for `v-for`. A list lives in one `jsonb` column, so
adding or changing a list's fields is not a migration of existing rows.

Menus (`defineNavigation`) are lists of links ([below](#menus-definenavigation)).

## Groups

A named object of fields kept together: an address, a contact, a "where":

```ts
contact: f.group({
  fields: {
    phone: f.text(),
    email: f.text({ format: 'email' }).optional(),
    address: f.group({ fields: { street: f.text({ required: true }), city: f.text({ required: true }), zip: f.text() } }),
    photo: f.media({ accept: 'image/*' }).optional(),
  },
}).optional(),
// stored: one jsonb column      → { phone: '+420 123', address: { street: 'Dlouhá 1', city: 'Tábor' } }
// content API / client: object  → { phone, email: null, address: { street, city, zip: null }, photo: <media> | null }
// Row / Insert: contact: { phone?: string | null; … address?: { street?: …; city?: … } | null } | null
```

- **Stored together** in a single jsonb column (not a column per field) and delivered as
  one object: every field is present, `null` when empty, media resolved to the public
  media object. Drizzle's `Row` and the generated client type each field by its own kind.
- **Checked per field**, like a block's: `required: true` fields must be filled in, the
  rest may be empty; an unknown key is dropped; each field keeps its own rule (media is a
  file, rich text is sanitised, `format: 'link'` is a safe link). An error points at the
  field (`['contact', 'address', 'city']`) and the admin marks it inside the fieldset.
- **`.optional()`** lets the whole group be absent (`null`, and the admin stores nothing
  while it is left empty); **`.localized()`** gives each language its own whole group
  (untranslated, or an empty one, falls back to the default language).
- **Inside:** the field types a block holds (text, slug, number, boolean, datetime,
  select, rich text, media), more groups, and a list — a list only directly in a group
  on an entry, not in a group inside a block, a list item or another group.
- **Where:** on an entry or a global, and inside blocks and list items (`f.group` as a
  block field). The admin draws a fieldset; the list shows the first filled-in values.
- Media inside a group is protected by media cleanup, text inside is found by the search,
  a link inside follows its page (below), and `content:migrate` / export / import walk it.
- Adding one to an existing entity: make it `.optional()` (the new column is nullable, so
  the migration is safe on existing rows); a required group needs a default first (see
  ["Adding a required field"](../upgrading.md#adding-a-required-field)).

## Blocks

An ordered list of typed sections that editors arrange into a page:

```ts
const hero = defineBlock({
  label: { en: 'Hero', cs: 'Úvod' }, icon: 'i-lucide-panel-top',
  fields: { heading: f.text({ required: true }), image: f.media({ accept: 'image/*' }) },
})
sections: f.blocks({ hero, text, gallery })
```

Each block is validated against its own type; rich text inside is sanitised; media
inside is resolved by the content API and protected by media cleanup. The typed
client gets an exact union per block type. Block fields: text, slug, number,
boolean, datetime, select, rich text, media, groups, and one level of lists.

### Changing a block later: `version` and `upgrade`

Stored blocks (and `f.list`
items) outlive the code that wrote them. A renamed field, a removed one or a new
required one would otherwise drop data on the next save or make old entries
unsaveable. When a block's stored shape changes, raise its `version` and say how
to get from the old one to the new:

```ts
const hero = defineBlock({
  label: { en: 'Hero' },
  version: 2,                                   // was 1: `heading` became `title`
  upgrade: ({ heading, ...rest }, from) => ({ ...rest, title: heading }),
  fields: { title: f.text({ required: true }), image: f.media() },
})
// the same on a list: f.list({ version: 2, upgrade, fields: { … } })
```

- `upgrade(data, fromVersion)` turns a block stored at `fromVersion` into
  `fromVersion + 1` and is called once per step (1 → 2, then 2 → 3), so every old
  version only needs its own step. `data` is a copy with `id`, `type` and the
  stored fields; keep `upgrade` pure (it runs on every read of an old block).
- Stored blocks carry `v` (left out at version 1, so existing data needs no
  rewrite). Old ones are brought up to date **wherever they are read**: the content
  API, the admin's form, search, history and restore, translations. Writes always
  store the current version, so nothing has to be run on deploy. A missing `v` on a
  write means "the current version" (what the content API returns has none).
- **Update the website's component too.** `upgrade` keeps the *stored* data working; the
  website still reads the *new* names. The starter types each block component from the
  generated client (`defineProps<{ block: Extract<Page['sections'][number], { type: 'hero' }> }>()`
  with `Page` imported from `~/lib/cms-content`), so after you rename a field in
  `cms.config.ts` and run `pnpm cms:client`, `pnpm typecheck` fails in every component that
  still uses the old name. Without the typed props nothing fails: the old name is simply
  `undefined`, and the heading is missing from a live page. Components written with
  hand-typed props (`block: { heading: string }`) do not get this check: switch them to the
  generated type when you change a block.
- A forgotten rename is loud, not silent: a block that went through `upgrade` is
  checked strictly against the current fields on save (an unrecognised key is a
  validation error), and in development a stored block with keys the definition
  does not know logs a warning naming the block and the keys.
- An `upgrade` that throws never takes a page down: it is logged once (entity,
  record, block id), the website gets the block as stored, and the admin shows it as
  "could not be brought up to date" with a Remove button.
- **A block whose type was removed from the config** is kept, not fatal: the save
  still goes through and the block stays in the data, the admin shows "This block no
  longer exists (type)" with a Remove button, and the content API and the search
  leave it out. Media inside it is not deleted while it stays.
- `tinyzoo content:migrate [--dry-run] [--batch <n>]` rewrites the stored copies
  (entries, translations and saved versions in `cms_revisions`) to the current
  versions, in batches inside transactions, and reports per entity and field what
  changed and what it could not upgrade (those blocks stay as stored; the command
  exits 1). `--dry-run` only reports. It uses `DATABASE_URL`, does not touch
  `updatedAt`, and can be run again at any time.
- Rich text has the same hook at document level: `richTextUpgrades` (in `tinyzoo`)
  is a list of idempotent steps applied to stored TipTap documents on read and by
  `content:migrate`; empty today, so a future TipTap node rename is one entry.


## Media fields

`f.media`, `f.file` and `f.gallery` point at the **media library**: one place for every
uploaded file, with alt text, a focal point and folders, shared by all fields. A file is
removed from storage only when nothing refers to it any more (fields, blocks, rich text),
and never while it is in use. Types, limits, storage drivers (local disk, S3, Cloudflare R2)
and how to draw a picture on the website: [Media](media.md).

## Globals

`defineSingleton(name, options)` makes a **global**: a single-row record like site settings or
the home page, edited as one form under **Settings** in the admin (no list, no "new", no delete). It takes the
same options as `defineEntity` except `admin.list`. (The `singleton` option of `defineEntity` makes the same thing
but is deprecated and warns at start: use `defineSingleton`.)

```ts
export const SiteSettings = defineSingleton('siteSettings', {
  label: 'Site settings', titleField: 'siteName',
  fields: { siteName: f.text({ required: true }), tagline: f.text().optional(), logo: f.media().optional(), ...seo() },
  content: { public: true },          // delivered at GET /api/content/_global/siteSettings
})
```

A global is read with `GET /api/content/_global/<name>` (`cms.global('siteSettings')` in the typed client), which
answers `null` until it is first saved. A global with `admin.preview: '/'` is edited beside the live page.

## Presets

Ready-made collections for what almost every website has. They are ordinary entities: you
can add fields, labels or access rules.

```ts
export const Page = definePages({ blocks: { hero, text, cta }, localized: true }) // title, address, status, blocks, SEO, preview (+ `tree: true`: pages under pages)
export const Navigation = defineNavigation({ localized: true })                  // main + footer menus as lists of links
export const Redirect = defineRedirects()                                         // old address → new, applied to every page request
```

| Preset | Gives you |
|---|---|
| `definePages({ blocks, localized, path, tree, access })` | `page`: title, address, status, blocks, SEO fields, publishing and preview |
| `defineNavigation({ localized, menus })` | `navigation`, a global with a `main` and a `footer` menu (rename or add menus with `menus`), each a list of links |
| `defineRedirects()` | `redirect`: an old address → a new one (`from`, `to`, `permanent`), applied to every page request. Live at once, so authors cannot edit it |
| `seo()` | a fragment to spread into any entity or global (below) |
| `defineForm()` / `defineFormSettings()` | website forms, from the forms plugin ([below](#website-forms)) |

When the address itself is translated, give one template per language — for
`content.path`, `publish.preview` and `definePages({ path })` alike:

```ts
content: { public: true, slug: 'slug', path: { cs: '/aktuality/:slug', en: '/news/:slug' } }
// → /aktuality/zavod-tabor and /en/news/tabor-race (sitemap, webhooks, preview)
```

A language left out of the map has no page for that collection.

### Pages

`definePages({ blocks: { hero, text, cta }, localized: true })` makes a `page` collection whose
`sections` field is `f.blocks(blocks)`. `localized: true` translates the title, the address
and the blocks (needs `defineLocales`). `path` is the page's address on the website
(`'/:slug'` by default, or one per language, as above). Put `access: { read: … }` on it for
[row-level rules](#access-rules).

### Pages under pages: the page tree

`definePages({ …, tree: true })` (opt-in: a site that does not set it keeps its flat pages)
lets pages sit under each other. Every page gets a **parent** (a relation to the page
collection itself) and a **position** among its siblings, and its address is its
ancestors' address parts and its own, joined: `/o-nas/tym`, `/o-nas/tym/vedeni`.

```ts
export const Page = definePages({ blocks: { hero, text, cta }, localized: true, tree: true })
// tree: { maxDepth: 6 } for a deeper tree: 4 levels by default, up to 10 (a top-level page is level 1)
```

- **Addresses per language.** Each language uses its own translated address parts and
  falls back to the default language's, part by part, as a single slug already does:
  `/en/pages/about/team` with the English template `{ en: '/pages/:slug' }`, whatever
  the Czech parts are. A page not translated into a language is still served there at the
  address it falls back to (the tree and the item's `path` give it).
- **One address, once.** The address part is unique under its parent (not globally any more:
  `tym` may exist under `o-nas` and under `kontakt`); the *whole* address must be unique
  per language, checked on every write (a new page, a move, a changed or translated part)
  with a 409 that names the page that has it (`code: 'unique'`, `address`, `otherTitle`).
  A page cannot go under itself or its own subpages (422 `tree_cycle`, naming the loop:
  `A → B → C → A`), and the tree cannot get deeper than `maxDepth` counting what the page
  carries along (422 `tree_depth`). **Deleting a page that has subpages is refused** (409
  `has_children`, listing a few of them): nothing below it disappears by accident.
- **Pages a person may not read.** With a row-level read rule (`definePages({ access: { read: … } })`),
  the admin does not tell them the titles of pages they cannot read: the parent picker's trail shows
  `…` for such a page, the refusals for a taken address or a loop leave its title out, the tree list gives
  no address for pages below it, and a page cannot be put under a parent they may not read (as far as
  they can tell it does not exist).
- **Moving or renaming.** When a page's parent or address part changes, the address of the
  page and of **every page below it changes, in every language**. The server writes
  redirects old → new (301) for each of them in the same transaction, through
  `defineRedirects()` (a site without redirects gets none: the change report still lists
  every address that moved, and the admin says so; add `defineRedirects` to your config). Pages
  that were not on the website (drafts, or under a draft) get none, redirects that already
  led to an old address are pointed at the new one (no chains), and a redirect *from* an
  address a page is back at is removed. Reordering moves no address. A move writes the
  moved page only: positions are spaced 1024 apart, so a page put between two others gets a
  number between theirs and the siblings (which may be other people's pages) are not
  touched. Only when two neighbours have no number between them are the siblings
  renumbered, and then just their order: their version, last editor and saved versions stay
  as they were, so nobody who has one open is told it changed.
- **The change report names every address.** The `entry.updated` change of a move, the
  `cms:change` hook and the publish webhook carry `moved: [{ id, locale, from, to }]` for
  each address that changed, and `paths` lists every old and new address of the page and
  its subpages (live ones), so a site can purge exactly those from its cache. An unpublish
  covers the subpages too: they go offline with their parent.
- **A page under an unpublished page is not reachable.** Its address runs through the
  parent, which answers 404, so the whole branch goes offline with it: the content API
  (item, list, tree), the sitemap, the search and the webhooks follow. Everything comes back
  when the parent is published again. An editor's `?preview` still reads it, with the
  trail the draft is in.

On the website:

```
GET /api/content/page/o-nas%2Ftym?locale=en   # a page by its whole address: the parts from the top down as one path segment (slashes escaped); or its id
GET /api/content/_tree/page?locale=en       # { items: [{ id, title, path, children: [...] }] } — live pages, in editors' order, for navigation
```

Every page item carries **`parent`** (the parent's id or `null`), **`position`**, **`path`**
(its address in the language served, language prefix included) and **`breadcrumbs`**
(`[{ title, path }]` from the top of the tree down to the page itself, in the language
served; live pages only, drafts included in an editor's preview), and `paths` per language
as for any translated collection. `GET /api/content/page?parent=<id>` lists a page's
children. In `@tinyzoo/client`: `cms.page.get('o-nas/tym', { locale })` and
`cms.page.tree({ locale })` (typed: `tree()` exists on a tree collection only). The starter's
`[...slug].vue` resolves nested addresses and shows the breadcrumbs.

**In the admin** the pages list is a tree: indented rows with fold / unfold, the whole
address under each title, "hidden" when a page above is a draft. Drag a page onto another
(its middle puts it *under* that page, its top or bottom edge before or after), or use
**Move…** in the row menu: a dialog with the parent (the page and its own subpages are
not offered) and the place among its subpages. "Move up / Move down" and "Add a subpage"
are in the menu too; phones and touch screens have no drag handle and use the menu. The
parent picker in the editor leaves out the page itself and everything below it.

**Turning it on for an existing site:** add `tree: true`, run `tinyzoo generate` (the
migration drops the unique constraints on the page address part, adds `parent_id` and
`position`; it needs neither `--allow-drop` nor `--allow-risky`) and `tinyzoo up`.
Existing pages stay at the top level, at the same addresses. See [../upgrading.md](../upgrading.md).

### Menus: `defineNavigation`

Menus are lists of links. A link marked **Under the link above** (`sub: true`) goes into
the dropdown of the one before it. On the website, `cmsMenuTree(nav.main)` from
`@tinyzoo/client` nests them and `<CmsNav :links="nav.main" />` draws them as nested
lists (class `cms-nav__has-children` on a link with a dropdown). A link picked from the site's
pages follows its page ([below](#links-that-follow-their-page)); a link with no address (its
page was removed) is left out of the menu.

### Redirects: `defineRedirects`

An old address sends visitors to a new one, with a `301` (permanent, default) or a `302`.
It is what keeps old links and search results alive when a page is renamed or moved, and
the page tree writes them for you when `defineRedirects()` is in the config.

### SEO: `seo()`

`seo()` is a reusable fields fragment (metaTitle / metaDescription /
ogImage) you spread into any entity or global: `fields: { ...seo(), title: … }`.

### Website forms

Forms are the first plugin (`tinyzoo/forms`): register `formsPlugin()` and define each form as an entity.

```ts
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'

export const plugins = [formsPlugin()]
export const ContactForm = defineForm('contactForm', {
  label: { en: 'Contact form', cs: 'Kontaktní formulář' },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Jméno' }),
    email: f.text({ required: true, format: 'email' }).label({ en: 'Email', cs: 'E-mail' }),
    message: f.text({ required: true, multiline: true, max: 5000 }).label({ en: 'Message', cs: 'Zpráva' }),
  },
})
export const FormSettings = defineFormSettings() // editors set who gets the emails
```

> `defineForm` and `defineFormSettings` imported from `tinyzoo` still work (same tables,
> same endpoints, same `<CmsForm>`) and register the plugin by themselves, but are
> deprecated and removed in 0.4: import them from `tinyzoo/forms` and add `formsPlugin()`.
> No migration is needed.

On a page: `<CmsForm name="contactForm" />` (plain HTML; default styles in the lowest CSS
layer that follow the text colour, so any class of yours wins; errors per field in the
visitor's language). A `f.select` with a `default` opens on it, a consent is
`f.boolean({ mustBeTrue: true })`. Or post JSON to `POST /api/content/_form/contactForm`
(send `_locale: 'cs'` for the refused fields' messages in that language; they come back in
`data[].message`); `GET` on the same address describes the form.
Each submission becomes an entry (state New / Read / Done) and the people in Forms
settings get an email (fallback: `notify.to` in code, then `cms.forms.notifyTo` / `NUXT_CMS_FORMS_NOTIFY_TO`: an address, a list, or in the variable a comma-separated string).
`defineForm` returns an `Entity` typed from the form's fields, so `Row<typeof ContactForm>` has `name`, `email`, `message` and the state `status` with their real types.
Spam protection: a hidden field, a minimum fill-in time, a rate limit per visitor,
same-site Origin, and Cloudflare Turnstile when `NUXT_CMS_FORMS_TURNSTILE_SECRET` and
`NUXT_PUBLIC_CMS_TURNSTILE_SITE_KEY` are set. Robots get the same `201` as a real
message for a post that is thrown away. `_t` (milliseconds the form was open) is optional on
purpose: a form without JavaScript or a script cannot send it, and dropping their
messages in silence would lose real ones — `<CmsForm>` always sends it. Every list can be
exported as CSV (`/api/cms/:entity/_export`, the Export button; a cell that starts like a
formula gets a leading apostrophe, phone numbers like `+420 777 123 456` stay as they are).

**Who reads the messages.** They are personal data of people who are not users of the site, so
by default only **administrators and editors** can open, list, search and export them — and
see the form's place in the menu; **authors** cannot. The recipients in the Forms settings
(`defineFormSettings`) are protected the same way. A form's `access` widens or narrows that,
with the rules entities have everywhere (`read`, `update`, `delete`; a `read` of yours
replaces the default):

```ts
export const ContactForm = defineForm('contactForm', {
  // …
  access: { read: ({ user }) => user.role !== 'author' || user.id === '…' }, // e.g. let one author in
})
export const FormSettings = defineFormSettings({ access: { read: ({ user }) => user.role === 'admin' } })
```

A custom role from an external sign-in gets no access by default either, until a `read`
rule names it.

Plugins in general (collections, admin pages, routes, field editors, upgrade steps; the forms
plugin is one): [Plugins](../plugins.md).

## Languages

Declare the languages once, then mark what is translatable:

```ts
export const locales = defineLocales({ default: 'cs', locales: ['cs', 'en'] })
title: f.text({ required: true }).localized()
```

Text, URL addresses, rich text, blocks, lists and groups can be `.localized()`. The entry's row
holds the default language; translations live in `<entity>_locales` (the entity name in
snake_case, like every table: `siteSettings` → `site_settings_locales`; typed columns,
URL addresses unique per language) and fall back per field to the default. The
admin edits a translation with the language switcher (default text shown as
reference). The content API takes `?locale=en`, finds items by translated URL
addresses, searches in the language, translates related items, and adds `locale` +
`locales` to each item. Publishing applies to all languages, unless the entity
[publishes each language on its own](#publishing-each-language-on-its-own).

`defineLocales` also takes `prefix`, which says which languages get a `/xx/` in their addresses:
`'except-default'` (the default: `/en/about`, but Czech stays `/o-nas`), `'all'` or `'none'`, and
`labels` for how the admin names a language. The sitemap's `hreflang` alternates follow the same rule.

## Links that follow their page

A link an editor picks from the site's pages is stored as a **reference**,
`cms:<entity>/<id>` (`cms:page/2f6c…`), not as the page's address — so renaming a page,
changing its address or translating it never breaks a menu, a button or a link in a
text. Nothing changes in the schema: link fields (`f.text({ format: 'link' })`, the
menus' link block, a block's button), rich-text links and redirect targets stay text.

- **Visitors never see a reference.** On read, the content API (lists, single items,
  globals and menus, entries populated into other entries, rich text inside entries, blocks,
  lists and groups) turns each one into the target's **current address in the language
  asked for** — with the same fallback as the website: a translated address comes from the
  translation, an untranslated part from the default language, and a collection with no
  address for that language links to the default language's page. When the target is
  **gone, not published (or scheduled for later) or not public**, a link field is `null`
  and a rich-text link is taken off its words (the text stays). `?preview` (an editor with
  a session, or the content token) resolves drafts too.
  Addresses typed by hand (`/path`, `https://…`, `mailto:`, `tel:`) are stored and served
  as typed.
- **Contract.** Link fields stay strings in the API, but any of them can now be `null`
  (the target may be gone), so the generated types and OpenAPI mark every
  `format: 'link'` field nullable — see the changeset. `cmsMenuTree` and `<CmsNav>` leave
  out links with no address (a heading whose dropdown still works stays, without a link).
- **In the admin** the link picker stores the reference; a link field and the rich-text
  link popover then show the page's **title and address** (in the language being edited)
  instead of the reference, with a warning when visitors will not get there ("not published
  yet", "this page no longer exists"). Lists show the page too.
- **A page that is linked to cannot be deleted**: the delete answers 409 `in_use` and the
  admin names what links to it (a menu, an entry, a block, rich text, a translation).
  An entry linking to itself does not count.
- **Existing links** are not converted for you. `tinyzoo links:convert [--dry-run]` turns
  a stored address into a reference when it is exactly the current address of **one**
  published entry **in the language the link is served in** (an entry's own row: the default
  language; a translation: its language) — links in fields, lists, blocks, groups and rich
  text, translations included. It reports what it could not match (no entry has that
  address, it is another language's address, the entry is not published, two entries share
  it, or it has a `#anchor`/`?query`), leaves those as typed, does not
  touch `updatedAt` or saved versions, and can be run again. Run `content:migrate` first
  if the report says some blocks are at an older version.
- **Caches.** A browser's `ETag` follows the resolved answer, so a rename shows at once. A
  CDN keeps an answer for five minutes unless it is purged: when the address of an entry
  changes (or it stops being reachable) the **publish webhook** lists, in `paths`, the
  entry's old and new addresses **and the addresses of the entries that link to it**, and
  names the public **globals** that link to it in `globals` (`["navigation"]`) — a menu
  appears on every page, so purge everything that renders it. Nothing extra is sent when
  the address did not change. A redirect whose target is a page follows it within seconds.
- **Search** indexes the words of a link, never where it points.

## Publishing

### The workflow

Declare `publish` and the editor gets Publish and Unpublish buttons, a status badge and a Preview button:

```ts
publish: {
  field: 'status', publishedValue: 'published', draftValue: 'draft',
  dateField: 'publishedAt',   // stamped on publish
  preview: '/blog/:slug',     // opened with ?preview
},
```

### Draft preview

the content API serves a draft only to an authenticated editor (or a
caller with the content token) when the request carries `?preview`; everyone else gets a
404, and previews are sent `no-store`. The frontend forwards the editor's cookie with
`useRequestFetch()` and shows a "Draft preview" banner.

### Scheduling

Give `publish.dateField` and an editor can pick **Schedule** instead of publishing now: a
date in the future is "scheduled", and the entry is live only from that moment on (the
content API, the sitemap and the webhooks all follow it). `schedule: false` turns that
off: a date in the future no longer holds a published entry back.

### Publishing each language on its own

By default the status and the publish date of an entry hold for every language: publish a post and
it is live in all of them. Add `perLocale: true` to an entity's `publish` and each translation
can have a state and a schedule of its own:

```ts
publish: {
  field: 'status', publishedValue: 'published', draftValue: 'draft',
  dateField: 'publishedAt',
  perLocale: true,
},
```

The default language's state stays on the entry. A translation **follows the default language
until someone publishes or unpublishes it on its own** (the editor's Publish, Unpublish and
Schedule act on the language being edited; "Follow the default language again" gives the choice
back). So switching `perLocale` on changes nothing on the website, including for entries that have
no translation at all and are served in other languages through the fallback.

**A translation that has never been published is being translated.** Start the English translation of
a post that is already live, and it is a draft of its own that has never been on the website: visitors
keep getting exactly what they got before, the default language through fallback (while that one is
live), and none of the draft's text, address or state. It stays like that, however often it is saved,
until someone who may publish publishes it (or schedules it: until its date the fallback stays); from
then on it is that language's own published state. Whoever may edit the entry can start, write and remove
such a translation, a role that may not publish included, because nothing visitors see changes. A
translation of a post that is still a draft follows it, as before, and goes live with it.

A language that is **not published is not there** in that language:

| Where | What visitors get |
|---|---|
| `GET /api/content/<entity>/<slug>?locale=en` | `404`, by the translated address and by the default one |
| the list, `?locale=en` | left out (and from `total`) |
| the item's `locales` and `paths` | only the languages it is live in |
| the sitemap and its `hreflang` alternates | no entry for it, and not among the others' alternates |
| the website search, `?locale=en` | not found |
| links to it (rich text, link fields, menus) | resolve to `null` in that language, like a link to a draft |

Unpublishing a language takes it off, also one that had no translation of its own and was served
through the default language: that one is a `404` from then on, not being translated. A translation
being translated is different: for visitors it is not there at all, so they get the default language
as if it had no translation (the item by its default address, the lists, the search, the sitemap
and the addresses of links, all in the default language's words).

An editor's `?preview` (a signed-in session, or the content token) still sees the draft
translation, a translation being translated included. Inside a published translation the per-field fallback to the default language
applies as before: a field left empty shows the default language's text.

**The default language gates every other language.** A translation is live only while the default
language is live too. Unpublish the default language and every language goes off the website, whatever
its own state says; the translation's own state is kept, and it is back when the default language is
published again. A language can still be unpublished on its own, and scheduled on its own: it is live
from the later of its date and the default language's. A language that follows is live exactly when the
default language is. The reason is the translation's untranslated fields: they show the default
language's text, so a translation of a draft would show the draft (and its fallback text) to the public.
In the admin a language that is published but held back says **Waiting for <default language>**, and one being
translated says **Being translated**.

**What editors see.** The editor's top bar names the language and its state (*English · Draft*), and Publish…,
Update, Unpublish and Schedule act on that language only; its review step is *Publish the English version* and says
when the default language is still a draft. The menu has *Follow the default language again*. The language switcher and
the side panel list every language with its state, and the list's Languages column shows a mark per language (a dot
on the website, a ring for a draft, a clock when scheduled, an hourglass when waiting for the default language, a
languages mark when being translated). The dashboard's drafts and the admin's search say *Being translated* too, and the
review step of one says that visitors see the default language there until now. On a phone the language and its state in the top bar open the language switcher. The editors' guide explains it in their
words: [Překlady](../editors/cs/preklady.md#každý-jazyk-zvlášť).

**Translators who may not publish.** A role with `publish: false` can start the translation of a live post: it is
being translated, and an editor publishes it when it is ready. It can write a language that is not live (being
translated, or taken off by an editor, or following a draft), not one that is live (published on its own, or a
translation that follows a live default language). The [worked example](roles.md#worked-example-a-translator) sets up
such a role, a field only editors may change, and `perLocale` together.

**Schedules and webhooks follow.** A translation with its own date goes live at that moment (the
scheduler announces `entry.published` with that `locale`). Publishing or unpublishing one language
sends `entry.published` / `entry.unpublished` with its `locale` and `paths` for that language
only. A change to the default language names every language that is live (`locale: null`, the
addresses of all of them that have a translation or a state of their own), so unpublishing the
default language purges the languages that went off with it; publishing a language while the default
language is a draft is not public and sends nothing. Saving a translation being translated, or removing
one, sends nothing public either (visitors see no change); publishing it sends `entry.published` with its
`locale`, and `paths` both its own address and the one visitors read the default language at until then.
When the default language goes live on its date
the scheduler announces it, and then each language that was only waiting for it. Those who may not
publish cannot publish, unpublish or reschedule a language, cannot remove a translation that holds a
state of its own (the language would follow the default language again, which can put it on the
website) unless it is being translated, and cannot change a language that is marked published (or follows
a live default language).

In the admin API (`PATCH /api/cms/<entity>/<id>?locale=en`) the state is written with the entry's
own keys: `{ "status": "draft" }`, `{ "status": "published", "publishedAt": "2026-12-01T09:00:00Z" }`,
or `{ "status": null }` to follow the default language again. A date needs its status. A first
translation of an entry whose status is published, written without a status, is being translated;
send `"status": null` with it to have it follow the default language (and go live) at once. The
translation table keeps when the language was first on the website in its own right
(`first_live_at`; null while it is being translated). Export and import (`translations[].publish`,
`firstLiveAt` included), seeds (`translations: { en: { title: 'Home', status: 'draft' } }`; a seed's
translation without a status follows the default language) and the history of a language carry the
state. Not available for page trees (`tree`) yet.

Turning it on is one migration: [upgrading](../upgrading.md#from-05-to-06).

### Finding what needs translating

The admin's home page has a **Needs translating** list for everyone who may write translations of a collection with
`.localized()` fields: entries that are live or scheduled in the default language (status published, any date) whose
translation into another language is missing, being translated, or (`perLocale`) a draft of its own, newest first,
each opening that language's editor (`?locale=en`). It follows what the person may **update**, nothing else: the
role and the entity's own `update` rule (an author's own entries), at least one translated field they may edit, and,
for a role that may not publish, a language that is not live (the rule the translation write applies). So a
translator sees no live pages of a page tree (all its languages publish together) and no collection it only reads.
Globals are left out (a translation of one is live once saved). People who may publish see the same list; a
translation that already holds text offers *Review* instead of *Translate*. Nothing shows on a site with one language.

Every list of such a collection filters by language on the server (counts and pages included), with the language
filters in its Filter panel: `filter.lang:<code>=<state>` (several states comma-separated: any of them), where the
state is `missing` (nothing translated; per language: and no draft of its own), `translating`, `draft` (taken off on
its own, or translated under a draft default language), `published` (its translated text is what visitors read in that
language), `translated`, or `todo` (the home page's list, narrowed to what this person may update, as above). A
language that is scheduled, or waits for the default language, is in none of the first four. Whether a language is
translated is judged by the translated fields the person may read (`.access({ read })`), so a hidden field never tells
them whether it has text. The CSV export takes the same parameters. A page tree filtered by language shows as a flat table.

## Access rules

Three roles come with every site, whatever the config says (a site can add its own, and set who
reads and edits each field: [Roles and permissions](roles.md)):

| Role | Can |
|---|---|
| **Administrator** | everything, plus people (invite, change role, disable, remove), privacy and settings |
| **Editor** | create, edit, publish and delete all content; edit site settings |
| **Author** | create drafts; edit and delete only what they created; never publish, never touch settings |

An entity's `access` adds **row-level rules** on top. Each is a function that gets the
signed-in person and the table and returns a Drizzle condition (or `true`); it is AND-ed with the role:

```ts
import { eq, ilike, not } from 'tinyzoo'

access: {
  read: ({ user, table }) => (user.base === 'author' ? not(ilike(table.title, 'Interní%')) : true),
  update: ({ user, table }) => eq(table.authorId, user.id),
},
```

`read`, `create`, `update` and `delete` can each be given; `eq`, `ne`, `gt`, `and`, `or`,
`not`, `ilike`, `inArray`, `isNull`, `sql` and the rest of Drizzle's helpers are exported
from `tinyzoo`. `user` is a `CmsAccessUser`: `id`, `email`, `name`, `locale`, `role` (the role's name as stored for the
person) and `base` (the built-in role it is or extends: `'admin'`, `'editor'`, `'author'`, or `null` for a role name of an
external sign-in that the site did not define). Test `base` to hold a custom role to its parent's rules. With an external
sign-in, anything else your sign-in puts on the person is there too, typed `unknown`: check it before you use it
(`typeof user.tenant === 'string'`); `email` and `name` are `''` and `locale` is `null` when it did not send them. Rules apply to everything a signed-in person does in the admin (lists, forms, search, the
link picker, `?preview`); they do not change the public content API, which serves what
`content.published` allows. Every request re-reads the
account, so a disabled person or a changed role takes effect at once. Roles of your own
(`defineRoles`), `.access({ read, edit })` per field and the media library per role are in
[Roles and permissions](roles.md).

## Reading content

An entity with `content: { public: true }` is served by the public, read-only content API:

```
GET /api/content/<entity>            published list: ?page= ?limit= ?sort= ?dir= ?q= ?locale= ?<field>=
GET /api/content/<entity>/<slug>     one published item by its slug (or id)
GET /api/content/_global/<name>      a global
GET /api/content/_search?q=          the website search
```

```ts
content: {
  public: true,
  published: (t) => eq(t.status, 'published'),   // only these rows are served (omit: all rows)
  slug: 'slug',                                  // single items are found by this field
  path: '/blog/:slug',                           // the item's address: sitemap, webhooks, search, preview
  populate: ['hero', 'author', 'tags'],          // relations and media resolved into the response
  hidden: ['email'],                             // never in the response, also when populated elsewhere
  search: false,                                 // leave it out of the website search
},
```

From the same config the **typed client** is generated, so the types cannot drift from what
the API returns:

```bash
pnpm cms:client          # writes app/lib/cms-content.ts
```

```ts
import { createClient } from '~/lib/cms-content'

const cms = createClient({ baseUrl: useRequestURL().origin })
const { items } = await cms.post.list({ filter: { status: 'published' }, sort: 'publishedAt', dir: 'desc', limit: 10 })
const post = await cms.post.get('hello-world')      // throws CmsError on 404
const settings = await cms.global('siteSettings', { locale: 'en' })
```

Filters, sort keys and choices are checked by the compiler. Filters, preview, caching, the
OpenAPI document, the search, the sitemap and the components that draw content
(`<CmsImage>`, `<CmsContent>`, `<CmsBlocks>`, `<CmsNav>`, `<CmsForm>`): [The content API](content-api.md).
