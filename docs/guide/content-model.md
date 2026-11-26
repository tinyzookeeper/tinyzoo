# Content model

Everything editors can write is defined in one file, `cms.config.ts`, in TypeScript. This page is the reference for that file. To build with it, start with [Getting started](getting-started.md) and [Recipes](recipes.md).

From it, tinyzoo derives the database schema and its migration, the validation, the admin's forms and lists, the public content API and the typed client. No settings screen changes the structure. **Editors change data, developers change structure**, in git, and types follow it from the database to the page.

## Overview

A minimal entity: a blog post with a title, an address part and a body.

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

The sections of this page:

- [The config file](#the-config-file): what it exports, and what to run after a change.
- [Collections](#collections): `defineEntity` and its options.
- [Fields](#fields): every field type and modifier.
- [Relations](#relations): entries that point at other entries.
- [Lists](#lists): repeated rows of the same fields.
- [Groups](#groups): fields kept together as one object.
- [Blocks](#blocks): typed sections editors arrange, and how to change them later.
- [Media fields](#media-fields): pictures and files from the media library.
- [Globals](#globals): single-row records such as site settings.
- [Presets](#presets): pages, menus, redirects, SEO fields and forms.
- [Languages](#languages): translating fields and addresses.
- [Links that follow their page](#links-that-follow-their-page): links that survive a rename.
- [Publishing](#publishing): drafts, scheduling and per-language publishing.
- [Access rules](#access-rules): roles and row-level rules.
- [Reading content](#reading-content): the content API and the typed client.

## The config file

`cms.config.ts` sits in the site's root. tinyzoo reads **every export**:

- an entity (`defineEntity`, `defineSingleton` or a preset) becomes a collection or a global
- `locales` (`defineLocales`) sets the languages
- `plugins` lists the plugins
- anything else is ignored, so helper constants are fine

After every change to this file, run:

```bash
pnpm db:generate     # schema.ts and a migration for the difference: read it
pnpm db:migrate      # apply it
pnpm cms:client      # refresh the typed client
```

Entities are typed **without annotations**. `Row<typeof Post>` is what a row holds. `Insert<typeof Post>` is what you may create it with. Import both with `import type { Row, Insert } from 'tinyzoo'`.

## Collections

`defineEntity(name, options)` makes a collection: many entries, with a list and a form in the admin. `defineSingleton` makes a [global](#globals).

| Option | |
|---|---|
| `name` (first argument) | The entity's identity ([below](#what-the-name-is-used-for)). |
| `label`, `labelSingular`, `description`, `icon` | What the admin calls it ("Posts" / "Post"), a sentence for the list's empty state, and an [Iconify](https://icones.js.org) name (`i-lucide-newspaper`). Each can be one string or one per admin language: `{ en: 'Posts', cs: 'Články' }`. |
| `titleField` | The field that names an entry in lists, links and search. |
| `fields` | The fields ([below](#fields)). |
| `content` | How it is delivered to the website ([reading content](#reading-content)). |
| `publish` | A draft / published workflow ([publishing](#publishing)). |
| `access` | Row-level rules on top of the roles ([access rules](#access-rules)). |
| `admin` | How the admin lays it out: `list` (`columns`, `searchable`, `orderField` to arrange by dragging, `layout`), `editor` (`write`, `form`, `preview`), `sections`, `tabs`. See [the admin](admin.md#how-editors-and-lists-are-arranged). |
| `live` | Every write is live at once (redirects). People who may not publish cannot write it. |

Every row also gets `id` (uuid), `createdAt`, `updatedAt`, `createdBy` and `updatedBy`.

### What the name is used for

The name is the address in the content API (`/api/content/<name>`), the key in the typed client, and the table in `snake_case` (`teamMember` becomes `team_member`).

A name starts with a letter, then letters, digits and `_`. That holds for entities and fields alike. Names that start with `_` are tinyzoo's.

Reserved entity names: `media`, `graph`, `login`, `setup`, `forgot`, `reset`, `invite`, `team`, `account`, `p`, `email`, `privacy`, and any name that starts with `cms`.

Reserved field names: `id`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `parentId`, `locale`, `locales`, `path`, `paths`, `breadcrumbs` and `preview`. A public collection also cannot have a field called `page`, `limit`, `sort`, `dir` or `q`.

`defineEntity` stops with an error on each. The full list is in [the public API](../api-surface.md#names-tinyzoo-keeps).

## Fields

Every field is made by an `f.*` factory, then refined with modifiers. The set is closed: these are all the types.

| Factory | An editor sees | Stored as | Use it for |
|---|---|---|---|
| `f.text(opts)` | a line of text, or a growing box with `multiline: true` | `text` | names, titles, short texts |
| `f.slug({ from, unique })` | a lowercase-and-dashes address part, filled in from `from` until edited | `text` | the part of a web address (`/blog/:slug`) |
| `f.number({ int, min, max })` | a number box | `integer` (`int: false`: `numeric(12,2)`) | counts, positions, prices |
| `f.boolean({ default, mustBeTrue })` | a switch | `boolean`, never null (default `false`) | "Show on the home page", "Open in a new tab" |
| `f.datetime({ default: 'now', allDay })` | a date and time picker in the admin's time zone | `timestamptz` | when something happens or goes live |
| `f.select({ options, default, labels, icons, optionsBy, swatches })` | a choice | a Postgres enum | status, kind, category |
| `f.richtext()` | a rich-text editor: headings, bold, lists, quotes, links, inline pictures | `jsonb` (a TipTap document) | articles and formatted text |
| `f.color()` | a colour picker and a `#rrggbb` box | `text` | a category's colour, an accent |
| `f.media({ accept })` | a picture from the media library, or an upload | a foreign key to the library | one picture |
| `f.file({ accept })` | a file from the library (PDF by default) | a foreign key to the library | a document to download |
| `f.gallery({ accept, max })` | several pictures, in order, each with a caption | `jsonb` `[{ mediaId, caption }]` | albums, photo series |
| `f.relation({ to, kind, … })` | a picker for entries of another collection | a foreign key, or a junction table | author of a post, tags of a post |
| `f.list({ fields, max })` | rows of the same few fields: add, drag, duplicate, remove | `jsonb` | opening hours, a price list, FAQ items |
| `f.group({ fields })` | a fieldset | `jsonb` | an address, a contact |
| `f.blocks({ …blocks })` | an ordered list of different typed sections | `jsonb` | a page built from blocks |

Relations, lists, groups and blocks have their own sections below.

### Modifiers

Modifiers work on any field.

| Modifier | What it does |
|---|---|
| `.optional()` | The value may be empty (`null`). |
| `.localized()` | One value per language, with fallback to the default language. |
| `.unique()` | Adds a unique constraint. |
| `.withDefault(value)` | Sets a database default; new entries start with it. It is also how you add a required field to a collection that has entries ([upgrading](../upgrading.md#adding-a-required-field)). |
| `.label(text)`, `.help(text)` | The admin's label (humanised from the key by default) and a hint under the field. One string, or one per admin language. |
| `.position('sidebar')` | Puts the field in the side panel instead of the main column. |
| `.group(label)` | A heading for fields in the side panel (the SEO fields use it). |
| `.icon(name)` | An icon in front of the field. |
| `.setting()` | On a field of a block or a list item: the field is a setting (an arrangement, a size), not content. The block's form shows it after the content, under "Layout" ([blocks](#settings-of-a-block)). |

```ts
publishedAt: f.datetime().optional().label('Publish date'),
slug: f.slug({ from: 'title', unique: true }).help('Filled in from the title: change it if you like.'),
```

Fields in the admin read as a few titled sections. Name them with `admin.sections` (see [the admin](admin.md#form-sections)).

### Details by type

**Required by default.** Everything is required unless you say otherwise: without `.optional()` the column is `NOT NULL`. `f.text({ required: true })` also refuses an empty string, while a plain `f.text()` accepts `''`. A relation is the exception: it is optional unless you set `required: true`.

**What can be localized.** Text, slug, rich text, blocks, lists and groups. Pictures, numbers, dates and choices are shared by all languages. A field that cannot be localized throws when the config loads.

**Text.** `max` caps the length, and spaces around the value are trimmed. `format` checks the value:

- `'email'`
- `'url'`: a full `https://…` address
- `'path'`: an address on this site, such as `/old-page`
- `'link'`: a page, `https://…`, `mailto:`, `tel:` or an anchor. Only this format can hold a [reference to a page](#links-that-follow-their-page).

**Slug.** `unique: true` adds a unique index. A slug can be `.localized()`. It fills in from its source field until the editor changes it, and never overwrites an existing slug.

**Number.** A whole number is a number everywhere. A decimal (`int: false`) is a **string** in a `Row`, in a select and in the content API (`"19.99"`), because a number could not hold it exactly. Read it with `Number(row.price)`. `Insert` and `Update` take a number or a numeric string.

**Boolean.** `mustBeTrue: true` refuses `false`. Use it for a consent on a [website form](recipes.md#1-a-contact-form) that must be ticked. The form marks it required and tells the visitor, in their language, to tick it.

`confirmOff` is for a switch whose "off" stops something, such as sending e-mails. The admin asks before it saves the switch turned off, with your text: `f.boolean({ default: true, confirmOff: { en: 'No e-mails go out until it is on again.', cs: 'Dokud to znovu nezapnete, žádné e-maily neodejdou.' } })`.

**Datetime.** `allDay: true` adds an "All day" switch and stores the time as 0:00 in the admin's time zone (`cms.admin.timeZone`, `Europe/Prague` unless you set another). The content API sends it in UTC, so a frontend in another zone must format it in the admin's zone. See [all-day dates](content-api-reference.md#all-day-dates).

**Select.** `options` must be `as const`. `labels` give each option a name per admin language, and `icons` give it an icon.

`segments: true` draws two to four options as one row of segments, each with its label and its icon from `icons`. It suits a short choice of how something is laid out:

```ts
arrangement: f.select({ options: ['row', 'stack', 'grid'] as const, icons: { row: 'i-lucide-columns-3', stack: 'i-lucide-rows-3', grid: 'i-lucide-layout-grid' }, segments: true }),
```

The row wraps on a narrow screen, and the arrow keys move the choice. While the value is empty, no segment is chosen. A choice with more than four options is drawn as any other choice. The stored value is the same either way.

`optionsBy` makes the options the admin offers depend on another choice of the same form, such as the colours of the chosen look:

```ts
look: f.select({ options: ['atelier', 'negativ'] as const, default: 'atelier' }),
colors: f.select({
  options: ['bronz', 'oliva', 'mosaz', 'salvej'] as const, default: 'bronz',
  optionsBy: { field: 'look', options: { atelier: ['bronz', 'oliva'], negativ: ['mosaz', 'salvej'] } },
  swatches: { bronz: ['#7a5a3a', '#faf8f4'], oliva: ['#4e5b3a', '#f9f9f3'] },
}),
```

While `look` is `atelier` the admin offers `bronz` and `oliva`. When an editor changes `look` and the chosen colours are no longer offered, the admin moves them to the first option that is. A value of the other field that has no list offers every option. The rule is the admin's: the column and the content API still take any of `options`, so the website decides what a pair that does not match means. `swatches` shows a few hex colours as dots beside an option's name.

**Rich text.** The TipTap document is sanitised on write and at render. Draw it with `<CmsContent :doc="…" />`. Its node and mark names are frozen for 1.x, and a minor release may add new ones ([rich text](content-api-reference.md#rich-text)).

**Media and file.** Use `accept: 'image/*'` for pictures. The API returns `{ id, url, width, height, alt, mime, focal }`, or `null` when there is none. **The generated type is `… | null` also for a required field**, so write `d.photo?.url` (and `d.file?.url` for a file).

**Gallery.** Holds up to 200 pictures unless you set `max`.

## Relations

A relation points an entry at entries of another collection.

```ts
author: f.relation({ to: () => Author, kind: 'many-to-one', required: true, onDelete: 'restrict' }),
tags:   f.relation({ to: () => Tag, kind: 'many-to-many' }),
posts:  f.relation({ to: () => Post, kind: 'one-to-many', inverseOf: 'author' }),   // on Author: the other side
```

`to` is a function, so entities can point at each other. There are three kinds:

| Kind | Stored as | The admin shows |
|---|---|---|
| `many-to-one` | a foreign key column (`author_id`) | a picker |
| `many-to-many` | a junction table (`post_to_tag`; `through: 'name'` names it yourself). Saving writes only the difference. | a multi-picker |
| `one-to-many` | nothing: the virtual other side of a many-to-one, which `inverseOf` names | a read-only list |

`onDelete` for a many-to-one is `restrict`, `set null`, `cascade` or `no action`:

- `restrict` is the default when the relation is required. The author cannot be deleted while a post uses it.
- `set null` is the default when it is optional.
- `cascade` deletes these entries too when the target is deleted.

In the content API, relations resolve into nested objects. `populate` chooses which (all by default), and a target that is not public collapses to `{ id, title }`.

`populate` and `hidden` take the entity's own fields, not a field inside one (`'sister.logo'`). A picture or file inside a group, a list or blocks is always delivered, without `populate`. `tinyzoo generate` stops on a key that is not a field, as the types do.

## Lists

A list holds rows of the same few fields: opening hours, a price list, FAQ items, a row of cards.

```ts
team: f.list({ fields: { name: f.text({ required: true }), role: f.text() }, max: 30 }),
// → [{ id: 'k3j…', type: 'item', name: 'Jana', role: 'Trenérka' }, …]
```

The editor adds, drags into order, duplicates and removes items, with undo.

Options: `fields`, `max`, `itemLabel` (what an item is called, such as "Opening hours"), `itemType` (the stored `type`, default `'item'`), and `version` / `upgrade` for [changing the items later](#changing-a-block-later-version-and-upgrade).

- Items hold the same field types as blocks: text, slug, number, boolean, datetime, select, rich text, media, groups and lists. Lists go two levels deep at most, counted from the block (see [lists inside a block](#lists-inside-a-block)).
- A list can be `.localized()`.
- Each item has a stable `id`, a good `:key` for `v-for`.
- A list lives in one `jsonb` column, so adding or changing a list's fields is not a migration of existing rows.

Menus (`defineNavigation`) are lists of links. See [below](#menus-definenavigation).

## Groups

A group is a named object of fields kept together: an address, a contact, a "where".

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

- **Where.** On an entry or a global, and inside blocks and list items (`f.group` as a block field). The admin draws a fieldset, and the list shows the first filled-in values.
- **Inside.** The field types a block holds (text, slug, number, boolean, datetime, select, rich text, media), more groups, and a list. A list works only directly in a group on an entry, not in a group inside a block, a list item or another group.
- **`.optional()`** lets the whole group be absent (`null`). The admin stores nothing while it is left empty.
- **`.localized()`** gives each language its own whole group. An untranslated or empty one falls back to the default language.

How a group is stored and checked:

- **Stored together** in a single jsonb column, not a column per field, and delivered as one object. Every field is present, `null` when empty, and media is resolved to the public media object. Drizzle's `Row` and the generated client type each field by its own kind.
- **Checked per field**, like a block's. `required: true` fields must be filled in and the rest may be empty. An unknown key is dropped. Each field keeps its own rule: media is a file, rich text is sanitised, `format: 'link'` is a safe link. An error points at the field (`['contact', 'address', 'city']`), and the admin marks it inside the fieldset.
- Media inside a group is protected by media cleanup, text inside is found by the search, and a link inside follows its page ([below](#links-that-follow-their-page)). `content:migrate`, export and import walk it.

To add a group to an existing entity, make it `.optional()`. The new column is nullable, so the migration is safe on existing rows. A required group needs a default first: see ["Adding a required field"](../upgrading.md#adding-a-required-field).

## Blocks

Blocks are an ordered list of typed sections that editors arrange into a page.

```ts
const hero = defineBlock({
  label: { en: 'Hero', cs: 'Úvod' }, icon: 'i-lucide-panel-top',
  fields: { heading: f.text({ required: true }), image: f.media({ accept: 'image/*' }) },
})
sections: f.blocks({ hero, text, gallery })
```

Block fields can be text, slug, number, boolean, datetime, select, rich text, media, groups, and lists two levels deep. Each block is validated against its own type, rich text inside is sanitised, and media inside is resolved by the content API and protected by media cleanup. The typed client gets an exact union per block type.

### Lists inside a block

A block can hold a list (`f.list()` or `f.blocks()`), and an item of that list can hold a list of its own. That is two levels, and the most there is. The items of the inner list hold plain fields and groups.

```ts
const heading = defineBlock({ label: 'Heading', fields: { text: f.text({ required: true }) } })
const picture = defineBlock({ label: 'Picture', fields: { image: f.media({ accept: 'image/*' }) } })
const group = defineBlock({ label: 'Group', fields: { items: f.blocks({ heading, picture }) } })
const layout = defineBlock({ label: 'Layout', fields: { items: f.blocks({ heading, picture, group }) } })
// → { id, type: 'layout', items: [{ id, type: 'heading', text }, { id, type: 'group', items: [{ id, type: 'picture', image }] }] }
```

A third level is refused when the config loads, with the path it found (`sections › items › items`). A group inside a block or a list item holds no list.

The inner list works like the outer one. The admin opens, fills, reorders, adds and removes its items inside the item that holds it, and marks a problem on the item, its list and the block. A write is checked at every level: an inner item of a type that is gone, or one that is behind its `version`, is kept only when the same item is stored there already, and the same id twice in one list is refused. The content API resolves media at every level, media cleanup counts it, the search reads its text, links in it follow their page, and the generated types and OpenAPI give the inner list as an array of its own block types.

### Settings of a block

Mark the fields that say how a block is laid out with `.setting()`. The block's form in the admin shows its content first and its settings after it, under one heading, "Layout", in the order you define them. They are stored and delivered like any other field.

```ts
const layout = defineBlock({
  label: 'Layout',
  fields: {
    items: f.blocks({ heading, picture, group }),
    arrangement: f.select({ options: ['row', 'stack', 'grid'] as const, segments: true }).setting(),
    space: f.select({ options: ['small', 'medium', 'large'] as const }).setting(),
  },
})
```

A block with no settings has a form as before. `.setting()` acts on the fields of a block or a list item; on a field of a collection, a global or a group it changes nothing.

### Changing a block later: `version` and `upgrade`

Stored blocks (and `f.list` items) outlive the code that wrote them. A renamed field, a removed one or a new required one would otherwise drop data on the next save, or make old entries unsaveable.

When a block's stored shape changes, raise its `version` and say how to get from the old shape to the new one:

```ts
const hero = defineBlock({
  label: { en: 'Hero' },
  version: 2,                                   // was 1: `heading` became `title`
  upgrade: ({ heading, ...rest }, from) => ({ ...rest, title: heading }),
  fields: { title: f.text({ required: true }), image: f.media() },
})
// the same on a list: f.list({ version: 2, upgrade, fields: { … } })
```

- `upgrade(data, fromVersion)` turns a block stored at `fromVersion` into `fromVersion + 1`. It is called once per step (1 → 2, then 2 → 3), so each old version only needs its own step.
- `data` is a copy with `id`, `type` and the stored fields. Keep `upgrade` pure: it runs on every read of an old block.
- Stored blocks carry `v`, left out at version 1, so existing data needs no rewrite.
- Old blocks are upgraded **wherever they are read**: the content API, the admin's form, search, history and restore, and translations.
- Writes always store the current version, so nothing has to be run on deploy. A missing `v` on a write means "the current version". What the content API returns has none.

**Update the website's component too.** `upgrade` keeps the *stored* data working, but the website still reads the *new* names.

- The starter types each block component from the generated client: `defineProps<{ block: Extract<Page['sections'][number], { type: 'hero' }> }>()`, with `Page` imported from `~/lib/cms-content`.
- After you rename a field in `cms.config.ts` and run `pnpm cms:client`, `pnpm typecheck` fails in every component that still uses the old name.
- Without the typed props nothing fails. The old name is simply `undefined`, and the heading is missing from a live page.
- Components with hand-typed props (`block: { heading: string }`) get no such check. Switch them to the generated type when you change a block.

#### Rewriting stored data: `content:migrate`

`tinyzoo content:migrate [--dry-run] [--batch <n>]` rewrites the stored copies (entries, translations and saved versions in `cms_revisions`) to the current versions.

- It works in batches inside transactions.
- It reports, per entity and field, what changed and what it could not upgrade. Those blocks stay as stored, and the command exits 1.
- `--dry-run` only reports.
- It uses `DATABASE_URL`, does not touch `updatedAt`, and can be run again at any time.

#### Edge cases

- **A forgotten rename is loud, not silent.** A block that went through `upgrade` is checked strictly against the current fields on save, so an unrecognised key is a validation error. In development, a stored block with keys the definition does not know logs a warning naming the block and the keys.
- **An `upgrade` that throws never takes a page down.** It is logged once (entity, record, block id). The website gets the block as stored. The admin shows it as "could not be brought up to date" with a Remove button.
- **A block whose type was removed from the config is kept, not fatal.** The save still goes through and the block stays in the data. The admin shows "This block no longer exists (type)" with a Remove button. The content API and the search leave it out. Media inside it is not deleted while it stays.
- **Rich text has the same hook at document level.** `richTextUpgrades` (in `tinyzoo`) is a list of idempotent steps applied to stored TipTap documents on read and by `content:migrate`. It is empty today, so a future TipTap node rename is one entry.

## Media fields

`f.media`, `f.file` and `f.gallery` point at the **media library**: one place for every uploaded file, with alt text, a focal point and folders, shared by all fields.

A file is removed from storage only when nothing refers to it any more (fields, blocks, rich text), and never while it is in use.

Types, limits, storage drivers (local disk, S3, Cloudflare R2) and how to draw a picture on the website: [Media](media.md).

## Globals

`defineSingleton(name, options)` makes a **global**: a single-row record like site settings or the home page. It is edited as one form under **Settings** in the admin, with no list, no "new" and no delete.

```ts
export const SiteSettings = defineSingleton('siteSettings', {
  label: 'Site settings', titleField: 'siteName',
  fields: { siteName: f.text({ required: true }), tagline: f.text().optional(), logo: f.media().optional(), ...seo() },
  content: { public: true },          // delivered at GET /api/content/_global/siteSettings
})
```

It takes the same options as `defineEntity`, except `admin.list`.

- Read a global with `GET /api/content/_global/<name>`, or `cms.global('siteSettings')` in the typed client. It answers `null` until it is first saved.
- A global with `admin.preview: '/'` is edited beside the live page.
- `defineEntity` has no `singleton` option (removed in 1.0). Use `defineSingleton`.

## Presets

Presets are ready-made collections for what almost every website has. They are ordinary entities, so you can add fields, labels or access rules.

```ts
export const Page = definePages({ blocks: { hero, text, cta }, localized: true }) // title, address, status, blocks, SEO, preview (+ `tree: true`: pages under pages)
export const Navigation = defineNavigation({ localized: true })                  // main + footer menus as lists of links
export const Redirect = defineRedirects()                                         // old address → new, applied to every page request
```

| Preset | Gives you |
|---|---|
| `definePages({ blocks, localized, path, tree, access })` | `page`: title, address, status, blocks, SEO fields, publishing and preview |
| `defineNavigation({ localized, menus })` | `navigation`, a global with a `main` and a `footer` menu (rename or add menus with `menus`), each a list of links |
| `defineRedirects()` | `redirect`: an old address → a new one (`from`, `to`, `permanent`), applied to every page request. Live at once, so authors cannot edit it. |
| `seo()` | A fragment to spread into any entity or global ([below](#seo-seo)). |
| `defineForm()` / `defineFormSettings()` | Website forms, from the forms plugin ([below](#website-forms)). |

### Translated addresses

When the address itself is translated, give one template per language. This works for `content.path`, `publish.preview` and `definePages({ path })` alike.

```ts
content: { public: true, slug: 'slug', path: { cs: '/aktuality/:slug', en: '/news/:slug' } }
// → /aktuality/zavod-tabor and /en/news/tabor-race (sitemap, webhooks, preview)
```

A language left out of the map has no page for that collection.

### Pages

`definePages({ blocks: { hero, text, cta }, localized: true })` makes a `page` collection whose `sections` field is `f.blocks(blocks)`.

- `localized: true` translates the title, the address and the blocks. It needs `defineLocales`.
- `path` is the page's address on the website: `'/:slug'` by default, or one template per language ([above](#translated-addresses)).
- `tree: true` lets pages sit under pages ([below](#pages-under-pages-the-page-tree)).
- `access: { read: … }` adds [row-level rules](#access-rules).

### Pages under pages: the page tree

`definePages({ …, tree: true })` lets pages sit under each other. It is opt-in: a site that does not set it keeps its flat pages.

Every page gets a **parent** (a relation to the page collection itself) and a **position** among its siblings. Its address is its ancestors' address parts and its own, joined: `/o-nas/tym`, `/o-nas/tym/vedeni`.

```ts
export const Page = definePages({ blocks: { hero, text, cta }, localized: true, tree: true })
// tree: { maxDepth: 6 } for a deeper tree: 4 levels by default, up to 10 (a top-level page is level 1)
```

**Turning it on for an existing site:**

1. Add `tree: true`.
2. Run `tinyzoo generate`. The migration drops the unique constraints on the page address part and adds `parent_id` and `position`. It needs neither `--allow-drop` nor `--allow-risky`.
3. Run `tinyzoo up`.

Existing pages stay at the top level, at the same addresses. See [../upgrading.md](../upgrading.md).

#### On the website

```
GET /api/content/page/o-nas%2Ftym?locale=en   # a page by its whole address: the parts from the top down as one path segment (slashes escaped); or its id
GET /api/content/_tree/page?locale=en       # { items: [{ id, title, path, children: [...] }] } — live pages, in editors' order, for navigation
```

Every page item carries:

- `parent`: the parent's id or `null`
- `position`
- `path`: its address in the language served, language prefix included
- `breadcrumbs`: `[{ title, path }]` from the top of the tree down to the page itself, in the language served. Live pages only; an editor's preview includes drafts.
- `paths` per language, as for any translated collection

`GET /api/content/page?parent=<id>` lists a page's children. In `@tinyzoo/client`, use `cms.page.get('o-nas/tym', { locale })` and `cms.page.tree({ locale })` (typed: `tree()` exists on a tree collection only). The starter's `[...slug].vue` resolves nested addresses and shows the breadcrumbs.

#### In the admin

The pages list is a tree: indented rows with fold / unfold, the whole address under each title, and "hidden" when a page above is a draft.

- Drag a page onto another. The middle puts it *under* that page; the top or bottom edge puts it before or after.
- Or use **Move…** in the row menu: pick the parent (the page and its own subpages are not offered) and the place among its subpages.
- "Move up / Move down" and "Add a subpage" are in the menu too. Phones and touch screens have no drag handle and use the menu.
- The editor's parent picker leaves out the page itself and everything below it.

#### Addresses and rules

- **Addresses per language.** Each language uses its own translated address parts and falls back to the default language's, part by part, as a single slug does. With the English template `{ en: '/pages/:slug' }`, the address is `/en/pages/about/team`, whatever the Czech parts are. A page not translated into a language is still served there, at the address it falls back to (the tree and the item's `path` give it).
- **One address, once.** The address part is unique under its parent: `tym` may exist under `o-nas` and under `kontakt`. The *whole* address must be unique per language, checked on every write (a new page, a move, a changed or translated part). A clash returns 409 and names the page that has it: `code: 'unique'`, `address`, `otherTitle`.
- **No loops.** A page cannot go under itself or its own subpages: 422 `tree_cycle`, naming the loop (`A → B → C → A`).
- **Depth limit.** The tree cannot get deeper than `maxDepth`, counting what the page carries along: 422 `tree_depth`.
- **Deleting a page that has subpages is refused:** 409 `has_children`, listing a few of them. Nothing below a page disappears by accident.
- **A page under an unpublished page is not reachable.** Its address runs through the parent, which answers 404, so the whole branch goes offline. The content API (item, list, tree), the sitemap, the search and the webhooks follow, and everything comes back when the parent is published again. An editor's `?preview` still reads it, with the trail the draft is in.
- **Pages a person may not read** (with `definePages({ access: { read: … } })`). The admin does not tell them the titles:
  - the parent picker's trail shows `…` for such a page
  - the refusals for a taken address or a loop leave its title out
  - the tree list gives no address for pages below it
  - a page cannot be put under a parent they may not read; as far as they can tell, it does not exist

#### Moving or renaming a page

When a page's parent or address part changes, the address of the page and of **every page below it changes, in every language**.

- **Redirects.** The server writes redirects old → new (301) for each of them in the same transaction, through `defineRedirects()`. A site without redirects gets none: the change report still lists every address that moved, and the admin says so, so add `defineRedirects` to your config. Pages that were not on the website (drafts, or under a draft) get none. Redirects that already led to an old address are pointed at the new one, so there are no chains. A redirect *from* an address a page is back at is removed.
- **Positions.** Reordering moves no address. A move writes the moved page only. Positions are spaced 1024 apart, so a page put between two others gets a number between theirs, and the siblings (which may be other people's pages) are not touched. Only when two neighbours have no number between them are the siblings renumbered, and then just their order changes. Their version, last editor and saved versions stay as they were, so nobody who has one open is told it changed.
- **The change report.** The `entry.updated` change of a move, the `cms:change` hook and the publish webhook carry `moved: [{ id, locale, from, to }]` for each address that changed. `paths` lists every old and new address of the page and its subpages (live ones), so a site can purge exactly those from its cache. An unpublish covers the subpages too: they go offline with their parent.

### Menus: `defineNavigation`

Menus are lists of links. A link marked **Under the link above** (`sub: true`) goes into the dropdown of the one before it.

On the website, `cmsMenuTree(nav.main)` from `@tinyzoo/client` nests the links. `<CmsNav :links="nav.main" />` draws them as nested lists, with the class `cms-nav__has-children` on a link with a dropdown. A link picked from the site's pages follows its page ([below](#links-that-follow-their-page)). A link with no address (its page was removed) is left out of the menu.

### Redirects: `defineRedirects`

An old address sends visitors to a new one, with a `301` (permanent, default) or a `302`. It keeps old links and search results alive when a page is renamed or moved. The page tree writes redirects for you when `defineRedirects()` is in the config.

### SEO: `seo()`

`seo()` is a reusable fragment of fields (metaTitle, metaDescription, ogImage). Spread it into any entity or global: `fields: { ...seo(), title: … }`.

### Website forms

Forms come from the first plugin, `tinyzoo/forms`. Register `formsPlugin()` and define each form as an entity.

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

`defineForm` returns an `Entity` typed from the form's fields. `Row<typeof ContactForm>` has `name`, `email`, `message` and the state `status`, with their real types.

**Showing a form.** On a page, use `<CmsForm name="contactForm" />`. It is plain HTML. Its default styles sit in the lowest CSS layer and follow the text colour, so any class of yours wins. Errors appear per field, in the visitor's language. A `f.select` with a `default` opens on it, and a consent is `f.boolean({ mustBeTrue: true })`.

Or post JSON to `POST /api/content/_form/contactForm`. Send `_locale: 'cs'` to get the refused fields' messages in that language; they come back in `data[].message`. `GET` on the same address describes the form.

**Submissions.**

- Each submission becomes an entry with a state: New, Read or Done.
- The people in Forms settings get an email. The fallback is `notify.to` in code, then `cms.forms.notifyTo` / `NUXT_CMS_FORMS_NOTIFY_TO` (an address, a list, or in the variable a comma-separated string).
- Every list can be exported as CSV (`/api/cms/:entity/_export`, the Export button). A cell that starts like a formula gets a leading apostrophe. Phone numbers like `+420 777 123 456` stay as they are.

**Spam protection.** A hidden field, a minimum fill-in time, a rate limit per visitor, a same-site Origin check, and Cloudflare Turnstile when `NUXT_CMS_FORMS_TURNSTILE_SECRET` and `NUXT_PUBLIC_CMS_TURNSTILE_SITE_KEY` are set. Robots get the same `201` as a real message for a post that is thrown away.

`_t` (the milliseconds the form was open) is optional on purpose. A form without JavaScript or a script cannot send it, and dropping their messages in silence would lose real ones. `<CmsForm>` always sends it.

**Who reads the messages.** Messages are personal data of people who are not users of the site. By default only **administrators and editors** can open, list, search and export them, and see the form's place in the menu. **Authors** cannot. The recipients in the Forms settings (`defineFormSettings`) are protected the same way.

A form's `access` widens or narrows that, with the rules entities have everywhere (`read`, `update`, `delete`). A `read` of yours replaces the default.

```ts
export const ContactForm = defineForm('contactForm', {
  // …
  access: { read: ({ user }) => user.role !== 'author' || user.id === '…' }, // e.g. let one author in
})
export const FormSettings = defineFormSettings({ access: { read: ({ user }) => user.role === 'admin' } })
```

A custom role from an external sign-in gets no access by default either, until a `read` rule names it.

Plugins in general (collections, admin pages, routes, field editors, upgrade steps; the forms plugin is one): [Plugins](../plugins.md).

## Languages

Declare the languages once, then mark what is translatable.

```ts
export const locales = defineLocales({ default: 'cs', locales: ['cs', 'en'] })
title: f.text({ required: true }).localized()
```

Text, URL addresses, rich text, blocks, lists and groups can be `.localized()`.

`defineLocales` also takes `prefix`, which says which languages get a `/xx/` in their addresses: `'except-default'` (the default: `/en/about`, but Czech stays `/o-nas`), `'all'` or `'none'`. The sitemap's `hreflang` alternates follow the same rule. `labels` sets how the admin names a language.

### How translations work

- **Storage.** The entry's row holds the default language. Translations live in `<entity>_locales`: the entity name in snake_case, like every table (`siteSettings` becomes `site_settings_locales`). It has typed columns, and URL addresses are unique per language.
- **Fallback.** A translation falls back per field to the default language.
- **In the admin,** the language switcher edits a translation, with the default text shown as reference.
- **In the content API,** `?locale=en` picks the language. Items are found by translated URL addresses, search runs in that language, related items are translated, and each item gets `locale` and `locales`.
- **Publishing** applies to all languages, unless the entity [publishes each language on its own](#publishing-each-language-on-its-own).

## Links that follow their page

A link an editor picks from the site's pages is stored as a **reference**, `cms:<entity>/<id>` (`cms:page/2f6c…`), not as the page's address. Renaming a page, changing its address or translating it never breaks a menu, a button or a link in a text.

Nothing changes in the schema. Link fields (`f.text({ format: 'link' })`, the menus' link block, a block's button), rich-text links and redirect targets stay text.

### What visitors get

Visitors never see a reference. On read, the content API turns each one into the target's **current address in the language asked for**. That covers lists, single items, globals and menus, entries populated into other entries, and rich text, blocks, lists and groups inside entries.

The address follows the website's fallback: a translated address comes from the translation, an untranslated part from the default language, and a collection with no address for that language links to the default language's page.

When the target is **gone, not published (or scheduled for later) or not public**, a link field is `null`, and a rich-text link is taken off its words (the text stays). `?preview` (an editor with a session, or the content token) resolves drafts too.

Addresses typed by hand (`/path`, `https://…`, `mailto:`, `tel:`) are stored and served as typed.

### Contract

Link fields stay strings in the API, but any of them can be `null`, because the target may be gone. The generated types and OpenAPI mark every `format: 'link'` field nullable. `cmsMenuTree` and `<CmsNav>` leave out links with no address. A heading whose dropdown still works stays, without a link.

### In the admin

The link picker stores the reference. A link field and the rich-text link popover show the page's **title and address** (in the language being edited) instead of the reference. They warn when visitors will not get there ("not published yet", "this page no longer exists"). Lists show the page too.

**A page that is linked to cannot be deleted.** The delete answers 409 `in_use`, and the admin names what links to it: a menu, an entry, a block, rich text or a translation. An entry linking to itself does not count.

### Converting existing links

Existing links are not converted for you. `tinyzoo links:convert [--dry-run]` turns a stored address into a reference when it is exactly the current address of **one** published entry **in the language the link is served in**. For an entry's own row that is the default language. For a translation it is its language. It covers fields, lists, blocks, groups and rich text, translations included.

It reports what it could not match, and leaves those as typed:

- no entry has that address
- it is another language's address
- the entry is not published
- two entries share it
- it has a `#anchor` or `?query`

It does not touch `updatedAt` or saved versions, and can be run again. Run `content:migrate` first if the report says some blocks are at an older version.

### Caches and search

- **Browser cache.** A browser's `ETag` follows the resolved answer, so a rename shows at once.
- **CDN cache.** A CDN keeps an answer for five minutes unless it is purged. When the address of an entry changes (or it stops being reachable), the **publish webhook** lists in `paths` the entry's old and new addresses **and the addresses of the entries that link to it**. It names the public **globals** that link to it in `globals` (`["navigation"]`). A menu appears on every page, so purge everything that renders it. Nothing extra is sent when the address did not change.
- **Redirects.** A redirect whose target is a page follows it within seconds.
- **Search** indexes the words of a link, never where it points.

## Publishing

Declare `publish` on an entity and the editor gets Publish and Unpublish buttons, a status badge and a Preview button.

### The workflow

```ts
publish: {
  field: 'status', publishedValue: 'published', draftValue: 'draft',
  dateField: 'publishedAt',   // stamped on publish
  preview: '/blog/:slug',     // opened with ?preview
},
```

### Draft preview

The content API serves a draft only to an authenticated editor, or a caller with the content token, when the request carries `?preview`. Everyone else gets a 404, and previews are sent `no-store`. The frontend forwards the editor's cookie with `useRequestFetch()` and shows a "Draft preview" banner.

### Scheduling

Give `publish.dateField` and an editor can pick **Schedule** instead of publishing now. A date in the future is "scheduled": the entry is live only from that moment on. The content API, the sitemap and the webhooks all follow it.

`schedule: false` turns that off. A date in the future then no longer holds a published entry back.

### Publishing each language on its own

By default the status and the publish date of an entry hold for every language: publish a post and it is live in all of them. Add `perLocale: true` to an entity's `publish` and each translation can have a state and a schedule of its own.

```ts
publish: {
  field: 'status', publishedValue: 'published', draftValue: 'draft',
  dateField: 'publishedAt',
  perLocale: true,
},
```

Turning it on is one migration: [upgrading](../upgrading.md#from-05-to-06). It is not available for page trees (`tree`) yet.

#### How a language gets its state

The default language's state stays on the entry. A translation **follows the default language until someone publishes or unpublishes it on its own**.

- The editor's Publish, Unpublish and Schedule act on the language being edited.
- "Follow the default language again" gives the choice back.
- Switching `perLocale` on changes nothing on the website. That includes entries with no translation at all, which are served in other languages through the fallback.

#### A translation that has never been published is being translated

Start the English translation of a post that is already live, and it is a draft of its own that has never been on the website.

- Visitors keep getting what they got before: the default language through fallback, while that one is live. They get none of the draft's text, address or state.
- It stays like that, however often it is saved, until someone who may publish publishes it. Scheduling it works too: until its date the fallback stays. From then on it is that language's own published state.
- Whoever may edit the entry can start, write and remove such a translation, a role that may not publish included. Nothing visitors see changes.
- A translation of a post that is still a draft follows it, and goes live with it.

#### What visitors get for a language that is not published

A language that is **not published is not there** in that language.

| Where | What visitors get |
|---|---|
| `GET /api/content/<entity>/<slug>?locale=en` | `404`, by the translated address and by the default one |
| the list, `?locale=en` | left out (and from `total`) |
| the item's `locales` and `paths` | only the languages it is live in |
| the sitemap and its `hreflang` alternates | no entry for it, and not among the others' alternates |
| the website search, `?locale=en` | not found |
| links to it (rich text, link fields, menus) | resolve to `null` in that language, like a link to a draft |

Two cases differ:

- **Unpublishing a language** takes it off, also one that had no translation of its own and was served through the default language. That one is a `404` from then on, not being translated.
- **A translation being translated** is not there at all for visitors. They get the default language as if it had no translation: the item by its default address, the lists, the search, the sitemap and the addresses of links, all in the default language's words.

An editor's `?preview` (a signed-in session, or the content token) still sees the draft translation, a translation being translated included. Inside a published translation, a field left empty shows the default language's text.

#### The default language gates every other language

A translation is live only while the default language is live too.

- Unpublish the default language and every language goes off the website, whatever its own state says. The translations keep their own state, and they are back when the default language is published again.
- A language can still be unpublished on its own, and scheduled on its own. It is live from the later of its date and the default language's.
- A language that follows is live exactly when the default language is.

The reason is the untranslated fields: they show the default language's text, so a translation of a draft would show the draft (and its fallback text) to the public.

In the admin, a language that is published but held back says **Waiting for <default language>**, and one being translated says **Being translated**.

#### What editors see

- The top bar names the language and its state (*English · Draft*). Publish…, Update, Unpublish and Schedule act on that language only. On a phone, the language and its state open the language switcher.
- The review step is *Publish the English version*, and says when the default language is still a draft. The menu has *Follow the default language again*.
- The language switcher and the side panel list every language with its state.
- The list's Languages column shows a mark per language: a dot for on the website, a ring for a draft, a clock for scheduled, an hourglass for waiting for the default language, and a languages mark for being translated.
- The dashboard's drafts and the admin's search say *Being translated* too. The review step of one says that visitors see the default language there until now.

The editors' guide explains it in their words: [Překlady](../editors/cs/preklady.md#každý-jazyk-zvlášť).

#### Translators who may not publish

A role with `publish: false` can start the translation of a live post. It is being translated, and an editor publishes it when it is ready.

- It can write a language that is not live: being translated, taken off by an editor, or following a draft.
- It cannot write a language that is live: published on its own, or following a live default language.
- It cannot publish, unpublish or reschedule a language.
- It cannot remove a translation that holds a state of its own, unless that translation is being translated. Removing it would make the language follow the default language again, which can put it on the website.

The [worked example](roles.md#worked-example-a-translator) sets up such a role, a field only editors may change, and `perLocale` together.

#### Schedules and webhooks

- A translation with its own date goes live at that moment. The scheduler announces `entry.published` with that `locale`.
- Publishing or unpublishing one language sends `entry.published` / `entry.unpublished` with its `locale` and `paths` for that language only.
- A change to the default language names every language that is live: `locale: null`, and the addresses of all of them that have a translation or a state of their own. So unpublishing the default language purges the languages that went off with it.
- Publishing a language while the default language is a draft is not public and sends nothing.
- Saving a translation being translated, or removing one, sends nothing public either. Publishing it sends `entry.published` with its `locale`, and `paths` has both its own address and the one visitors read the default language at until then.
- When the default language goes live on its date, the scheduler announces it, and then each language that was only waiting for it.

#### Admin API and data

In the admin API (`PATCH /api/cms/<entity>/<id>?locale=en`), the state is written with the entry's own keys:

- `{ "status": "draft" }`
- `{ "status": "published", "publishedAt": "2026-12-01T09:00:00Z" }`
- `{ "status": null }` to follow the default language again

A date needs its status. A first translation of an entry whose status is published, written without a status, is being translated. Send `"status": null` with it to have it follow the default language (and go live) at once.

The translation table keeps when the language was first on the website in its own right (`first_live_at`; null while it is being translated).

Export and import (`translations[].publish`, `firstLiveAt` included), seeds and the history of a language carry the state. A seed looks like `translations: { en: { title: 'Home', status: 'draft' } }`, and a seed's translation without a status follows the default language.

### Finding what needs translating

The admin's home page has a **Needs translating** list for everyone who may write translations of a collection with `.localized()` fields. It lists entries that are live or scheduled in the default language (status published, any date) whose translation into another language is missing, being translated, or (with `perLocale`) a draft of its own.

The list is newest first, and each row opens that language's editor (`?locale=en`). A translation that already holds text offers *Review* instead of *Translate*. Nothing shows on a site with one language.

**Who sees what.** The list follows what the person may **update**, nothing else:

- the role and the entity's own `update` rule (an author's own entries)
- at least one translated field they may edit
- for a role that may not publish, a language that is not live (the rule the translation write applies)

So a translator sees no live pages of a page tree (all its languages publish together) and no collection it only reads. Globals are left out, because a translation of one is live once saved. People who may publish see the same list.

**Filtering by language.** Every list of such a collection filters by language on the server, counts and pages included. The filters are in its Filter panel: `filter.lang:<code>=<state>`. Give several states comma-separated to match any of them.

| State | Meaning |
|---|---|
| `missing` | nothing translated (per language: and no draft of its own) |
| `translating` | being translated |
| `draft` | taken off on its own, or translated under a draft default language |
| `published` | its translated text is what visitors read in that language |
| `translated` | translated |
| `todo` | the home page's list, narrowed to what this person may update, as above |

A language that is scheduled, or waits for the default language, is in none of the first four.

Whether a language is translated is judged by the translated fields the person may read (`.access({ read })`), so a hidden field never tells them whether it has text. The CSV export takes the same parameters. A page tree filtered by language shows as a flat table.

## Access rules

Three roles come with every site, whatever the config says. A site can add its own and set who reads and edits each field: [Roles and permissions](roles.md).

| Role | Can |
|---|---|
| **Administrator** | everything, plus people (invite, change role, disable, remove), privacy and settings |
| **Editor** | create, edit, publish and delete all content; edit site settings |
| **Author** | create drafts; edit and delete only what they created; never publish, never touch settings |

An entity's `access` adds **row-level rules** on top. Each rule is a function that gets the signed-in person and the table, and returns a Drizzle condition (or `true`). It is AND-ed with the role.

```ts
import { eq, ilike, not } from 'tinyzoo'

access: {
  read: ({ user, table }) => (user.base === 'author' ? not(ilike(table.title, 'Interní%')) : true),
  update: ({ user, table }) => eq(table.authorId, user.id),
},
```

You can give `read`, `create`, `update` and `delete`. `eq`, `ne`, `gt`, `and`, `or`, `not`, `ilike`, `inArray`, `isNull`, `sql` and the rest of Drizzle's helpers are exported from `tinyzoo`.

Rules apply to everything a signed-in person does in the admin: lists, forms, search, the link picker and `?preview`. They do not change the public content API, which serves what `content.published` allows. Every request re-reads the account, so a disabled person or a changed role takes effect at once.

Roles of your own (`defineRoles`), `.access({ read, edit })` per field and the media library per role are in [Roles and permissions](roles.md).

### The `user` object

`user` is a `CmsAccessUser`:

| Property | Value |
|---|---|
| `id`, `email`, `name`, `locale` | The person's details. `email` and `name` are `''` and `locale` is `null` when an external sign-in did not send them. |
| `role` | The role's name as stored for the person. |
| `base` | The built-in role it is or extends: `'admin'`, `'editor'`, `'author'`, or `null` for a role name of an external sign-in that the site did not define. |

Test `base` to hold a custom role to its parent's rules.

With an external sign-in, anything else your sign-in puts on the person is there too, typed `unknown`. Check it before you use it: `typeof user.tenant === 'string'`.

## Reading content

An entity with `content: { public: true }` is served by the public, read-only content API.

```
GET /api/content/<entity>            published list: ?page= ?limit= ?sort= ?dir= ?q= ?locale= ?<field>=
GET /api/content/<entity>/<slug>     one published item by its slug (or id)
GET /api/content/_global/<name>      a global
GET /api/content/_search?q=          the website search
```

The `content` option controls what is served:

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

### The typed client

The typed client is generated from the same config, so the types cannot drift from what the API returns.

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

The compiler checks filters, sort keys and choices.

Filters, preview, caching, the OpenAPI document, the search, the sitemap and the components that draw content (`<CmsImage>`, `<CmsContent>`, `<CmsBlocks>`, `<CmsNav>`, `<CmsForm>`) are in [The content API](content-api.md).
