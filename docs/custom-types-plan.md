# Custom content types: the detailed design of step 2

**Status (2026-11-24):** a design, written before the build. It is step 2 of `docs/one-app-plan.md` and builds on what steps 0 and 1 put on `main`. Every claim about the code names its file. Numbers are measured on this machine (Apple silicon, Node 24, Postgres 16 in a container of its own) unless they are marked as estimates. The experiments were throwaway and ran outside the product code; section 12 says what each showed. Section 14 records what is built, as it is built.

**Words.** As in the plan: a *site*, an *app*, a *model*, a *design*, a *code-first type*, a *custom type*. New here: a *binding* says which type a block shows and which field goes to which place. The *structure function* is the one server function that changes a site's custom types.

---

## 1. The short read

1. **A site's own types are one document in its own database.** The document says what `defineEntity` and `f.*` say, without functions. A mapper turns it into tinyzoo's own entities, so the admin, the API, search, the sitemap and the generated types serve a custom type with the code that exists.
2. **Each custom type is a real table,** made and changed by statements the site's own database user runs. The statements are read from the same table objects the engine queries with, so the two cannot disagree. Only additions run at once. A removal hides first and deletes later.
3. **A change of structure gives the site a fresh memory.** The mechanism is the one that already handles a changed site row (`retireInstance` in `server/utils/cmsSite.ts`): requests under way finish with the model they started with, new requests get the new one. No cache has to be listed and cleared by hand.
4. **One function changes structure.** The admin's editor, and later the model file of step 3 and the MCP tools, all call it. It holds the lock, checks the version, asks the guard, runs the statements and writes the new version in one transaction.
5. **The guard reads the pages.** A block stores its binding as data. Before a field or a type goes, the server reads every stored block and refuses while one shows it, with the list of places. No index table is kept: reading 2 000 pages takes 6 ms.
6. **Two generic blocks and an entry page,** drawn once in the kit. They take their look from what all 52 looks really share. That is not colour tokens: no CSS variable is defined by every look. It is the look's own text styles (`.prose-look`, in 52 of 52) and the colour and typeface the page inherits. A prototype drawn this way reads right in a light and in a dark look.
7. **This step is for the hosted app** (multi-tenant mode). Single-site apps get the switch with step 3, as the plan's order says. A site without the switch runs as today: no query, no table, no code path.

**What differs from the plan.**

| The plan said | What holds |
|---|---|
| Every look shares tokens (`bg-paper`, `text-ink`, `font-display`), so the kit can style generic blocks through them (2.11) | No variable is in all 52 looks: `--font-sans` in 50, `--ink` and `--brand` in 45, `--paper` in 35, `--line` in 25. Section 8 gives the footing that does hold |
| The server keeps an index of bindings, as it keeps the search index (2.6) | The pages are read when a change needs it. Nothing can drift from the truth, and it is fast enough (section 7) |
| The model is read where a request waits for migrations, and a change is announced to other instances (2.4) | Kept. Added: the model never changes inside a loaded site; a change retires the site's memory (section 4) |
| The first editor only adds (part 1, step 2) | Adding, changing labels, hiding, restoring and the later deletion are all in, because hiding is what makes removal safe |

## 2. The model document

**Where.** A table `cms_model` in the site's own database:

```sql
CREATE TABLE IF NOT EXISTS cms_model (
  version    integer PRIMARY KEY,
  doc        jsonb NOT NULL,          -- the whole document at this version
  ops        jsonb NOT NULL,          -- the operations that made it from the version before
  user_id    uuid,
  created_at timestamptz(3) NOT NULL DEFAULT now()
)
```

The server makes it itself the first time a site changes its structure, as it makes `cms_upgrades` (`src/upgrades.ts`, lines 11 to 17 say why such bookkeeping is not in a site's `schema.ts`). So no site and no template needs a migration for this feature, and a site that never adds a type has no extra table. The current model is the row with the highest version. The history is the rows; the newest 200 are kept.

**The format** (`format: 1`):

```json
{
  "format": 1,
  "types": [{
    "name": "x_course",
    "label": { "cs": "Kurzy", "en": "Courses" },
    "labelSingular": { "cs": "Kurz", "en": "Course" },
    "description": null,
    "icon": "i-lucide-graduation-cap",
    "titleField": "title",
    "page": { "prefix": "kurzy", "image": "cover", "summary": "perex" },
    "publish": true,
    "order": { "by": "startsAt", "dir": "asc" },
    "listColumns": ["title", "startsAt", "level"],
    "removedAt": null,
    "fields": [
      { "key": "title", "type": "text", "label": { "cs": "Název", "en": "Title" }, "required": true },
      { "key": "perex", "type": "text", "long": true, "label": { "cs": "Krátký popis" } },
      { "key": "startsAt", "type": "datetime", "label": { "cs": "Začátek" } },
      { "key": "level", "type": "select", "label": { "cs": "Úroveň" },
        "options": [{ "value": "beginner", "label": { "cs": "Začátečníci" } }, { "value": "advanced", "label": { "cs": "Pokročilí" } }] },
      { "key": "cover", "type": "media", "label": { "cs": "Obrázek" } },
      { "key": "category", "type": "relation", "to": "category", "label": { "cs": "Kategorie" } },
      { "key": "old", "type": "text", "label": { "cs": "Staré pole" }, "removedAt": "2026-11-24T10:00:00.000Z" }
    ]
  }]
}
```

- `name` and every `key` never change. Everything a person reads is a label, and labels change freely.
- `page`: the type has a page per entry at `/<prefix>/<slug>`. The mapper then adds a `slug` field (from the title, unique) and `content: { public, slug, path }`. `image` and `summary` name the fields used for sharing and for search engines.
- `publish: true`: drafts and publishing. The mapper adds a `status` field (`draft`, `published`) and the same `publish` and `content.published` that `definePages` sets (`src/presets.ts`).
- `order`: the order the website shows by default: by a field, or `"manual"` (the mapper adds a `position` field and `admin.list.orderField`, so the admin's list is arranged by dragging).
- `removedAt` on a field or a type: it is hidden (section 6).

**The kinds of field in the first version.**

| `type` | Options | Becomes |
|---|---|---|
| `text` | `long`, `format` (`email`, `url`, `link`), `max`, `required` | `f.text` |
| `richtext` | | `f.richtext` |
| `number` | `decimal`, `min`, `max` | `f.number` |
| `boolean` | `default` | `f.boolean` |
| `datetime` | `allDay` | `f.datetime` |
| `select` | `options` (`value`, `label`, `removed`), `default` | `f.select` |
| `media` | | `f.media({ accept: 'image/*' })` |
| `file` | | `f.file` |
| `gallery` | | `f.gallery` |
| `color` | | `f.color` |
| `relation` | `to`: a code-first collection of the design, or a custom type | `f.relation`, many-to-one |

Every field also has `label`, optional `help`, and `required` where the kind has it. A field is optional unless it says `required`. A picture, a file and a relation are always optional: a required one would hold on to its target in the database (`ON DELETE restrict`), also while the field is hidden, and deleting a picture would then be refused because of a field nobody sees.

**What the mapper refuses to express,** because it is a function in code: access rules, hooks, a block's `upgrade`, a custom `content.published`. Roles work as for any collection: administrators, editors and authors by the built-in rules (`server/utils/cmsCrud.ts`); a site's own roles from `defineRoles` see a custom type only when the role lists it, which code cannot do for a name that does not exist yet. Per-field access is not in the first version.

**Relations** go from a custom type to a code-first collection or to another custom type. Code never points at a custom type.

**Limits** (checked by the structure function; the numbers are defaults a site's row can lower or raise, `config.customTypes` in the site directory):

| | Default |
|---|---|
| Custom types per site, hidden ones included | 12 |
| Fields per type, hidden ones included | 30 |
| Choices per choice field | 30 |
| A label | 80 characters; a help text 300 |
| The document | 256 KB |
| Versions kept | 200 |

## 3. Names

- **A custom type's name is `x_` and a key:** `x_course`. The key is made from the first label (lower case, no accents, `a-z0-9_`, a letter first). The table is `x_course`, the API is `/api/content/x_course` and `/api/cms/x_course`, the generated type is `XCourse`. Editors see labels only.
- **Why a prefix:** a design may add a type `course` in a later release. Without a prefix that release would fail on every site that made its own `course`.
- **How the prefix is kept free.** `defineEntity` does not refuse `x_` names today, and the public surface only grows (`docs/api-surface.md`), so it stays that way. Instead: the one app's build refuses a design whose model has an `x_` type (`templates/kit/module.ts` already checks look ids and addresses before a build); a server with custom types switched on refuses to load them for a site whose code-first model has one, and says so. No template, the playground or the starter has such a name today (checked).
- **A field key** is made from the first label in lower camel case (`startsAt`). It cannot be a name tinyzoo uses (`RESERVED_FIELD_NAMES` and `LIST_PARAMS` in `src/entity.ts`), nor `slug`, `status` or `position`, which the mapper makes.
- **A page prefix** is one address part (`kurzy`). It cannot be the first part of another type's address (`content.path` of any type of the site), nor `admin`, `api`, `home`, or a name starting with `_`.
- **Lengths.** Postgres cuts names at 63 bytes. A type's table name is at most 26 characters and a field's column at most 30, so every table, column and choice type fits uncut. Constraint and index names may be cut; the planner cuts them the way Postgres does and refuses two that would become equal.
- **Generic block types** are `x_entries` and `x_chosen`: the same prefix, so a design's own block can never have the name (114 block names exist; none starts with `x_`).

## 4. Loading the model, and how a change spreads

**The rule: a loaded site never changes its model.** Each site loaded in a process is an instance: its row and what is kept in memory for it (`SiteInstance` in `server/utils/cmsSite.ts`). The site's custom model becomes one more thing an instance holds, read once before the instance serves anything.

**When it is read.** In multi-tenant mode every API request waits for its site's migrations (`server/middleware/cms-0-migrate-gate.ts`) and every page does too (`server/plugins/cms-0-site.ts`, line 93). The custom model is read in the same promise, after the migrations: `to_regclass('cms_model')`, then the newest row. The mapper builds the entities, and `cmsSiteModel()` (`server/utils/cmsModel.ts`) from then on answers with a config that is the design's exports plus the custom entities, and a registry built from it. `useCms()` stays synchronous.

- The design's entities are shared by every site of the design, as today. Only the custom entities and the registry's lists are the site's own. Measured: 13 KB for a registry over the shared design, about 630 KB for a site with two custom types of 8 and 4 fields (about 50 KB a field, as the plan measured), built in 0.6 ms.
- A site with no custom type keeps the design's shared registry and costs nothing more.
- The site's name for its model (`cmsSiteModel().name`) stays the design's: migrations (`server/utils/cmsMigrate.ts`) and the kit's design (`templates/kit/server/middleware/design.ts`) read it.
- What is kept "by model" is kept by the config or the entity object (`content-types.ts.get.ts`, `cmsRoles.ts`), so a site's own config gets its own entries without a change.
- Everything that can read the registry before the gate (the live and shared-editing sockets, `server/utils/cmsLive.ts`, `cmsCollab.ts`) waits for the same promise. A test names each entry point.

**A change.** After its transaction commits, the structure function:

1. retires the current site's instance (a new export beside `retireInstance`): nothing new starts in it, the work under way finishes with the old model and the old pool, then it is released, or after 30 s (`DRAIN_MS`);
2. publishes `{ origin, site, version }` on a new channel of the shared store, `model`. Another instance retires that site's instance if it has it loaded (the pattern of `server/plugins/cms-changes.ts`);
3. the next request of the site makes a fresh instance, which reads the new model.

Why this and not swapping the model in place: a request calls `useCms()` many times (about 180 call sites). Swapping in place lets one request see two models. The multi-tenant build found exactly these bugs when a site's row changed (`docs/multi-tenant-plan.md`, 2.14, numbers 3 and 4), and the instance is what fixed them. Per-site caches that follow the model (`openapi.json.get.ts`, the sitemap, the scheduler, the search signature) need no list: they die with the instance.

**What a retired site costs,** as when the cloud changes its row: its pool is replaced, its live sockets are told to reconnect (`cmsLive.ts`, line 94) and its shared-editing engine stores what is pending and starts again. The search index is checked on start and rebuilt when the model's signature changed (`ensureSearchIndex` in `server/utils/cmsSearch.ts`): the whole index of that site, in the background, with the old one answering meanwhile.

**Requests under way are safe** because of what runs at once and what does not:

- Additions do not hurt the old model: its queries name their columns.
- Hiding keeps the column and the table, so a write of the old model still lands.
- The real deletion comes at least an hour after the hiding, when no instance with the old model is left.

**Other instances.** With a shared store (Redis, which two instances need anyway) the message arrives in milliseconds. An instance that misses it serves the older model until the site is unloaded (15 minutes idle) or the process restarts. It lacks what was added and breaks nothing. When somebody tries to change the structure on it, the version check fails, it retires the site and answers "reload".

**The admin's open tabs** read the model from `GET /api/cms/_graph`, which each page asks for again on navigation (no cache is set on the `cms-graph` fetches in `app/`). The editor's own tab asks again after each change. Other tabs get the "reconnect" of their live socket and ask again then.

## 5. The statements

**Who writes them.** A planner of about 110 lines (`src/model-ddl.ts`). It takes two descriptions of the site's custom tables, before and after, each read from the drizzle table objects with `getTableConfig`: tables, columns, defaults, keys, foreign keys, indexes, and the choice types from each entity's `enums`. It returns the statements that lead from one to the other, or the reasons it refuses.

Reading the table objects, not the document, settles three things the plan left open. Translations (`<type>_locales`), a many-to-many relation's table and the choice types come out without a line of their own: in the experiment a type with two translated fields, a choice, a picture, a relation to a code-first collection and a many-to-many relation needed 13 statements, the same 13 drizzle-kit makes (they differ in spelling only: `"public".`, spaces). The plan's finding that the registry's schema lacks the choice types is answered by `entity.enums`.

**The allowed list.** Nothing else can be planned, and a second check refuses any statement that does not match one of these shapes with a name under the prefix:

| Statement | When |
|---|---|
| `CREATE TYPE "x_…" AS ENUM (…)` | a new choice field |
| `ALTER TYPE "x_…" ADD VALUE '…'` | a new choice |
| `CREATE TABLE "x_…" (…)` | a new type, its translations, a relation table |
| `ALTER TABLE "x_…" ADD COLUMN …` | a new field: optional, or with a default |
| `ALTER TABLE "x_…" ADD CONSTRAINT … FOREIGN KEY … REFERENCES …` | a picture, a file, a relation. Only here may another table be named, and only as the target |
| `CREATE [UNIQUE] INDEX … ON "x_…"` | on a table made in the same change |
| `ALTER TABLE "x_…" ALTER COLUMN … DROP NOT NULL` | hiding a field; a required field made optional |
| `ALTER TABLE "x_…" ALTER COLUMN … SET NOT NULL` | an optional field made required, after a count shows that no entry lacks a value |
| `ALTER TABLE "x_…" DROP COLUMN …`, `DROP TABLE "x_…"`, `DROP TYPE "x_…"` | only the later deletion of something hidden long enough (section 6) |

Refused whatever asks for them: a changed column type, a renamed column or table, a removed choice, a new unique rule on a table with entries, anything on a table without the prefix.

**How they run.** In one transaction, as the site's own database user, on the site's own pool:

1. `pg_advisory_xact_lock` on a number of its own, so two changes of one site take turns.
2. `SET LOCAL lock_timeout = '2s'`.
3. `CREATE TABLE IF NOT EXISTS cms_model`, then the newest version. A change names the version it was made against; another one is refused with 409.
4. The guard (section 7).
5. The statements.
6. The new row of `cms_model`, and a line in `cms_audit`.

Postgres runs these statements inside a transaction, a new choice included: a failure at any point leaves the tables and the document as they were.

**Measured.** Two new types with their translations and relation table: 16 ms. Six new fields and a new choice on a type with entries: 8 ms. A new column on 20 000 entries: 0.9 ms, the same for dropping one. A change that meets a transaction still open on the same table waits for its lock, and readers that arrive queue behind it: with the 2 s limit the change is refused after 2 s ("busy, try again") and the readers go on. tinyzoo's requests hold no transaction open across a response, so this is the rare case.

## 6. Removing: hidden first

**Hiding.** Removing a field or a type sets `removedAt` on it in the document. The mapper leaves hidden things out, so they are gone from the admin, the API, search, the sitemap and the generated types at the next request. The column or the table stays. The one statement hiding needs: `DROP NOT NULL` on a hidden required column, because a write that no longer knows the field would otherwise be refused by the database (seen in the experiment: 23502).

**Restoring.** Until the deletion, one click brings it back with its content. A restored required field comes back optional when entries were written without it meanwhile.

**The deletion.** A hidden field or type is deleted for good:

- 30 days after it was hidden; or
- after one hour, when it held no content at the moment it was hidden (a field added by mistake).

It runs when the site is loaded and then once a day while it stays loaded, through the structure function (so under the same lock, with a version of its own). A site nobody opens keeps its hidden columns a little longer, which costs nothing. No job walks every database: 2.3 of the multi-tenant plan forbids that for a reason.

**Names stay taken** until the deletion, so a new field cannot silently take over an old field's column.

## 7. The guard: what happens on each change

The guard runs inside the structure function, in the transaction, before any statement. It answers from four places: the document, the registry, the entries, and the stored blocks.

**Finding bindings.** For every blocks field of every type of the site (translations too), the server selects the rows whose value holds a block type that has a binding (`sections @> '[{"type":"x_entries"}]'`), and walks those blocks. Measured with 12 blocks a page and one page in 50 bound: 200 pages 1.6 ms, 2 000 pages 6.3 ms, 20 000 pages 57 ms.

| Change | What happens |
|---|---|
| Add a type | Runs at once. Refused over a limit, or when a name or a page prefix is taken |
| Add a field | Runs at once. On a type with entries the field is optional, or has a default (a switch, a choice with a default) |
| Change a label, a help text, an icon, the list's columns, the default order | The document only. No statement |
| Add a choice | Runs at once |
| Rename a choice | Its label changes; its value never does |
| Remove a choice | The choice is marked removed: it is not offered any more, entries that hold it keep it and show it. No statement |
| Make a required field optional | Runs at once |
| Make an optional field required | Refused while an entry has no value, with the count |
| Change a field's kind | Not offered: add a new field. (Copying values over is a later step) |
| Reorder fields | The document only |
| Remove a field | Refused when it is the title, or made by the mapper (`slug`, `status`, `position`). Refused while a block shows it or orders by it, with the places: "Home › Courses". Otherwise hidden; where the type itself used it (list columns, the default order, the page's picture or summary), that use is cleared in the same change and the answer says so |
| Remove a type | Refused while a block shows it, while another type's field points at it, or while content links to one of its entries (`linksTo` in `server/utils/cmsLinks.ts`), each with its places. Otherwise hidden |
| Restore | Runs at once |
| Change a type's page prefix, switch pages or publishing on or off later | Not in the first version (section 13) |
| Anything on a type of the design | Refused. The editor shows these types as part of the design, with no control to change them |

A refusal answers 409 with `{ code, message, places: [{ entity, id, title, field, block, locale, admin }] }`, so the editor can link to each place. With `dryRun` the function answers what would happen and changes nothing.

**Drawing never fails.** The guard keeps a binding from breaking; drawing does not rely on it. A block whose type is gone draws nothing. A place whose field is gone is left out. The content API never returns a hidden field, so a block cannot show one by accident.

**A block reports itself** in two places: in its own form, where the binding's control marks a type or a field that no longer exists; and on the editor's first screen, which lists the blocks that need attention (the same walk as above, looking for bindings that name something missing).

## 8. The generic blocks

**What exists.**

- **Entries** (`x_entries`): a list of a type's entries, newest or in the type's order, with a limit.
- **Chosen entries** (`x_chosen`): entries picked by hand, in the picked order.
- **The page of one entry,** at the type's address. It is not a block on a page: the type's `page` in the document is its binding.

**How a design gets the blocks.** `customTypeBlocks()`, a new experimental export of `tinyzoo`, returns the two block definitions. Each template's `cms.config.ts` adds them to its `definePages({ blocks })`. Blocks are JSON in one column, so no template needs a migration; each template's generated client is made again. The admin's block picker leaves them out on a site that has no custom type with entries to show (`server/api/cms/_graph.get.ts` already shapes the graph per person).

**The binding** is the value of one field of the block, of a new kind `binding` (allowed inside blocks only, made by `customTypeBlocks()`, not part of `f.*` yet):

```json
{ "type": "x_course",
  "show": { "image": "cover", "text": "perex", "date": "startsAt", "label": "level", "more": ["price"] },
  "order": { "by": "startsAt", "dir": "asc" },
  "limit": 6,
  "entries": ["0b7c…", "9f1e…"] }
```

The title is always the type's title field. `order` and `limit` belong to the list, `entries` (at most 12) to the chosen entries. Beside it the block has ordinary fields: a heading, a short text, and `layout` (`cards` or `rows`).

The server checks a binding's shape when a page is saved (strings, lengths, ids). Whether its type and fields exist is not a property of the block definition, which every site of a design shares; it is checked where the model is known: in the admin's control, in the guard, and when the block is drawn.

**The admin's control** (`CmsFieldBinding`): the type as a choice of the site's custom types; then one choice per place, each offering only the fields of a fitting kind (a picture for the image, a date for the date); the order and the limit; for chosen entries a picker that searches the type (`/api/cms/<type>/options`, as `CmsFieldRelationMany` does).

**Where the data comes from.** The block's component asks the public content API, as every block of a template does (`useSiteList` in `templates/kit/app/composables/useSite.ts`): `/api/content/x_course?limit=6&sort=startsAt&dir=asc` for the list, `/api/content/x_course/<id>` for each chosen entry. So drafts, hidden fields and the content token follow the rules that exist. Labels of fields and choices come from a new public route, `GET /api/content/_types`: the site's public custom types with their labels, page prefix and fields (kind, label, choices). The name starts with `_`, which no type can.

**The page of an entry.** The kit's server middleware puts the site's custom page prefixes on the request beside the design (`templates/kit/server/middleware/design.ts`), so `useSitePage` knows without another request that `/kurzy/python` is an entry. The kit draws it with one component: the title, the picture, the short facts (dates, numbers, choices, relations) as a list, the texts, the gallery, the file as a download. The order is the type's field order. The address is in the sitemap and in the site search because the type has `content.path`.

**How they take the look.** Measured over the 52 look stylesheets: no CSS variable is in all of them, and there is no radius or spacing token at all. What all looks share:

| Shared by | What |
|---|---|
| 52 of 52 | `.prose-look`: the look's own headings, paragraphs, links and lists |
| every page | the text colour and the typeface the look sets on the page, which any element inherits |
| 51 of 52 | `.wrap`, the look's page width (Photographer's Negativ has `.pad`) |
| 50 of 52 | `.btn` |

So the kit's components are built from these, in this order:

1. Headings and texts sit in `.prose-look`, so they are the look's.
2. Colours are inherited. Lines and quiet text are made from the text colour (`color-mix(in oklab, currentColor 16%, transparent)`, opacity), so they fit a light and a dark look alike.
3. Widths and spacing are the kit's own, fluid.
4. A look may set a few variables to refine the result (`--x-radius`, `--x-line`, `--x-gap`). Each has a fallback, so no look has to.

**Seen in a browser.** A prototype of both layouts, drawn with exactly these rules and injected into a seeded Photographer site: in Atelier (light, serif headings) and in Negativ (dark, condensed capitals, and none of `--ink`, `--paper`, `--line`), at 1280 and 390 pixels. Headings took each look's type, text and lines sat right on both grounds. The build's first task for this part is the same check on all 52 looks, as pictures, before any look gets a line of its own.

**The kit's module** registers the two block components under each design's block prefix (`PhotographerBlockXEntries`, …), because `CmsBlocks` looks a block up as `<prefix><Type>` and today only a design's own files are registered that way (`templates/kit/module.ts`, lines 124 to 129: the loop over a design's own block files).

## 9. The structure editor

**Who.** People who manage the site: `requireCmsAdmin` (`server/utils/cmsCrud.ts`, line 279), the rule of Team and of the menu's arrangement. The page says so to anyone else.

**Where.** A row "Content types" (Czech "Typy obsahu", German "Inhaltstypen") under Settings, with key `@model` in the menu (`src/menu.ts`), shown when the site has the feature. The pages are `/admin/_model` and `/admin/_model/<name>`. The address starts with `_`, which no type's name can, so it can never be taken by a site's type (`/admin/model` could: `model` is a valid type name).

**The routes** (all for administrators, all answering 404 when the feature is off):

| Route | |
|---|---|
| `GET /api/cms/_model` | the document with hidden things, the design's types (read-only), the limits and how much is used, entry counts |
| `POST /api/cms/_model` | `{ baseVersion, ops, dryRun? }`: the structure function |
| `GET /api/cms/_model/usage?type=…&field=…` | where a type or a field is shown |
| `GET /api/cms/_model/attention` | blocks whose binding names something missing |
| `GET /api/cms/_model/history` | the versions: who, when, what |

**Screen 1: the list.**

```
Settings › Content types                                   [ New content type ]

  YOUR TYPES
  ┌────────────────────────────────────────────────────────────────────┐
  │ 🎓  Courses        6 fields · 14 entries · has pages /kurzy       › │
  │ 📍  Branches       4 fields · 3 entries                           › │
  └────────────────────────────────────────────────────────────────────┘

  NEEDS ATTENTION                       (only when there is something)
  │ Home › "Upcoming courses" shows a field that no longer exists      › │

  HIDDEN                                (only when there is something)
  │ Old price list   will be deleted on 24 December       [ Restore ]   │

  PART OF THE DESIGN
  │ 🔒 Albums, Categories, Packages, Testimonials, Pages…               │
  │    These come with your website's design and cannot be changed here.│
```

With no custom type yet, the page is one calm empty state with an animal, a sentence on what a content type is ("Courses, references, branches: anything your website lists"), and the one button.

**Screen 2: a new type** (a dialog; a full page on a phone). Three questions, each a plain sentence:

1. *What do you call them?* The name in the plural ("Courses") and for one ("Course"), and an icon from a short set.
2. *Does each one have a page of its own on the website?* A switch; when on, the address shows as it will be: `/courses/…`, editable once.
3. *Do you want to prepare them as drafts before they show?* A switch, on when there are pages.

It starts with a Title field. Under the questions: "Start with:" and a few ticks (Picture, Short description, Text, Date), so a first useful type is one screen.

**Screen 3: a type.** Its name as the heading; under it its fields, one row each, in the form's order:

```
Courses                                                    [ Add a field ]

  ⠿  T   Title              Text · required                              ›
  ⠿  ¶   Short description  Long text                                    ›
  ⠿  📅  Starts             Date and time     shown on 2 pages           ›
  ⠿  ◉   Level              Choice · 3 options                           ›
  ⠿  🖼   Picture            Picture                                      ›

  Settings   name, icon, the list's columns, the order on the website
  Remove this type
```

Rows drag to reorder (arrows on a phone, as in the menu editor, `CmsMenuEditor.vue`). "shown on 2 pages" comes from the usage route.

**Screen 4: a field.** Adding starts with the kind, as a grid of eleven tiles, each an icon, a name and one line ("Choice: one of a few options"). Then the label, an optional help text, "required", and what the kind needs (the options of a choice, whole or decimal for a number, which type a relation points at). The key is shown once, small, under "For developers", and can be changed before the field is made.

**Removing.** The dialog says what will happen in the order a person cares about: where it is shown now (with links, and then the removal is not offered), how many entries hold a value, that it is hidden now and deleted on a date, and that it can be restored until then.

**The look.** The admin's own: `CmsPage`, `.cms-card`, `CmsEmptyState`, `CmsConfirmDialog` through `useCmsConfirm`, toasts as in `team.vue`; one primary action a screen; no colour bar on the left edge of anything; a row of tiles that overflows on a phone is `UCarousel`. Texts in Czech, English and German (`app/i18n`, where a test keeps the three equal).

## 10. Isolation

**By construction.**

- The custom model lives in the site's own database and is held in the site's own instance (`cmsSiteScoped`). No table and no memory shared between sites holds a custom type.
- The statements run on the site's own pool, as the site's own database user, which can open no other database.
- A structure change retires one site's instance. Another site's instance is not touched.
- The channel message names its site and is applied inside it; a message for an unknown site is dropped.
- The design's entities are shared, and hold structure only. A custom entity points at them; they never point back.

**Proven by tests** (`test/api/tenants-custom.spec.ts`, on the harness of `test/api/tenants-models.spec.ts`): two sites of the same design in one process, A with `x_course` and B with `x_recipe`.

- Every admin and content route with A's type on B answers 404, and the other way round.
- B's admin graph, generated types, OpenAPI document, public types route, search and sitemap name nothing of A's.
- Each database holds only its own custom tables and its own `cms_model`.
- A change on A leaves B's instance as it was (B's instance is the same one before and after; a request to B during A's change is not delayed).
- A request to A that is under way during A's change ends well, with the model it started with.
- The site's own database user cannot run a statement outside the allowed list through the function.
- With the switch off: no route, no table, no query.

**Leaks put in on purpose,** one at a time in a temporary build, each of which must fail the suite: the custom model kept once for the process instead of per site; a change announced without its site, so every site reloads the last one's model; the statements run on another site's pool; the public types route answering from a process-wide cache.

## 11. Order of work

Each part ends with its own tests green and is useful without the next.

1. **The core, without the server** (`src/`): the document's format and its operations, the mapper, the planner and the allowed list. Unit tests: the mapper's types give the same admin graph as the same types written in code; the planner's statements against drizzle-kit's; every refusal.
2. **The server.** Loading, retiring, the channel, the structure function with the guard's document, relation and link checks, hiding, restoring and the later deletion, the routes, the isolation suite and the leaks. *Useful alone: a site's types can be made through the API, and the unchanged admin shows their lists and forms.*
3. **The editor's screens.** *Useful alone: an owner adds "Courses", fills them in the admin, and reads them from the API.*
4. **The generic blocks.** The binding kind, the two blocks, the control, the guard's reading of pages, the public types route, the kit's components and the entry page, all 20 templates, pictures of all 52 looks. *Useful alone: the owner shows "Courses" on the website without a developer.*
5. **Around it.** The cloud's plans carry the limits and its driver switches the feature on; `e2e:shared` gets a site with a custom type; moving a site refuses one with custom types; the documentation and the changeset.

## 12. The experiments

All were throwaway, in a scratch folder outside the repository, against a Postgres 16 in a container of its own, which is removed.

1. **Can the statements be read from the table objects, with translations, a many-to-many relation and a choice?** Two custom types built through `defineEntity`, one with two translated fields, a choice, a picture, a relation to a code-first collection and a many-to-many relation. A planner of 110 lines over `getTableConfig`. Result: 13 statements in 0.7 ms, the same 13 as drizzle-kit (`generateMigration`), run by a database user without special rights in 16 ms; the engine's own inserts and selects worked on the tables, a relation to a missing entry and a choice that does not exist were refused by Postgres. Then six more fields and one more choice: 9 statements, 8 ms, again the same as drizzle-kit; entries made before read the new fields with their defaults. Seven changes that are not additions were all refused. *It showed: one small planner covers what the plan listed as unexplored, and it needs no code per kind of field.*
2. **What does a change meet when work is under way?** A new column while a transaction that had read the table stayed open: the change waited, and a reader that arrived meanwhile waited behind it, until the 1.5 s limit refused the change; the open transaction went on reading. With nothing open: 0.9 ms. An insert that leaves out a hidden required column: refused by Postgres until `DROP NOT NULL`. *It showed: a short lock limit is needed, and hiding needs one statement.*
3. **What does finding bindings by reading the pages cost?** Section 7's numbers. *It showed: no index table is needed.*
4. **What does a registry per site cost with the design shared?** Section 4's numbers. *It showed: only the custom types cost memory, about 50 KB a field.*
5. **Do the looks share tokens?** A count over the 52 look stylesheets and the 20 templates' themes. *It showed: no.* Then the prototype of section 8 in a browser. *It showed: the look's own text styles and inherited colour are enough for a calm result in a light and a dark look.*

## 13. What the first version leaves out, and why

| Left out | Why | What it would take |
|---|---|---|
| Single-site apps | A loaded single site has no instance to retire: its memory is one object for the process's life (`SINGLE_INSTANCE` in `cmsSite.ts`). The plan puts their switch in step 3 | Requests of a single site counted like a multi-tenant site's, so its memory can be replaced |
| Translated custom fields | Every hosted design has one language. The planner and the engine handle them (experiment 1); the editor does not offer them | A tick on text fields when the design has more languages, and a rule that it is set when the field is made |
| Many-to-many relations | Works in the planner (experiment 1). Left out of the editor to keep the first version's guard small: a relation table belongs to two types and goes when either does | The editor's choice "several entries", and the deletion of relation tables |
| Lists, groups and blocks as custom fields | They nest definitions, and the editor would need screens for fields inside fields | A design of its own |
| Custom fields on a design's type | The design's table belongs to the design's migrations, and no component of the design would show the field | A prefix for columns, and the generic blocks reading design types |
| Changing a type's page prefix; switching pages or publishing on or off later | Each changes every entry: new addresses need redirects, new pages need an address part for every entry, publishing needs a state for every entry | An operation that also writes entries |
| Changing a field's kind | A new column and a copy of the values | An operation "copy to a new field" |
| A site's own roles for custom types | Roles are code and name types | Roles as data: step 3 or later |
| The model as a file, the registered snapshot, the CI check | Step 3. The structure function is built so that step 3 calls it | |
| The structure function as an MCP tool | The function is ready; a tool that changes structure needs its own decision on rights | |
| `tinyzoo export`, `import` and moving a site, for custom types | They read one `cms.config.ts` (`cli/export.ts`, `cli/transfer.ts`). Moving a site with custom types is refused with a clear message instead of leaving them behind. `tinyzoo backup` takes everything: it is `pg_dump` of the whole database (`cli/backup.ts`) | The CLI reading the model document |
| Rebuilding only one type's part of the search index | The whole index of the site is rebuilt after a change, in the background | A rebuild by type |
| A check that wakes an instance which missed a change | Section 4 says what such an instance does | A version in the site directory |

## 14. What is built

Built on the branch `feat/custom-types`, local only: nothing is released or deployed. The feature is off unless `NUXT_CMS_CUSTOM_TYPES=on` in multi-tenant mode; with it off the server runs no line of it.

### Part 1: the core (`packages/cms/src`)

- `model-doc.ts`: the document (`parseModelDoc`), the operations (`applyModelOps`), names made from labels, the limits, and what is due for deletion (`modelPurgeDue`). A refusal is a `ModelProblem` with a stable code.
- `model-map.ts`: `modelEntities(doc, design)` builds the types through `defineEntity` and `f.*`. It never throws: a type or a field that cannot be built is left out and named.
- `model-ddl.ts`: `customShape`, `planModelDdl` and `assertAllowedStatement`.
- All of it is internal (not part of the public surface). 167 unit tests, among them: a document's types give the same admin graph as the same types written in code; the planner's statements equal drizzle-kit's for new types (with translations and a many-to-many relation), new fields and a new choice; every refusal; a list of hostile statements the allowed list turns away.

**Decided while building.**

- A picture, a file and a relation are always optional (section 2).
- A removed choice stays a value of its field. The mapper names it in the field's `meta.removedOptions`, and the admin's choice control stops offering it.
- Leaving manual order is refused: it would drop the `position` column.
- A required field can be added to a type that has no entries. The column is added optional and made required in the same transaction.
- A switch and a gallery always hold a value, so a hidden one waits the full 30 days.
- `order: { by }` reaches no entity (`defineEntity` has no default order). The generic blocks read it from the document.

### Part 2: the server

- `server/utils/cmsCustomTypes.ts`: the switch (`NUXT_CMS_CUSTOM_TYPES=on`, multi-tenant mode only) and a site's own settings in its directory row (`config.customTypes`: `enabled`, `types`, `fields`, `options`).
- `server/utils/cmsModel.ts`: a site's own types are read once per instance, after its migrations, and laid over the design's shared model. `cmsSiteReady()` is what both gates wait for now. Every other way into a site waits for it too: the sockets (`cmsSocketSite.ts`), the live hub and the shared-editing engine, the scheduled tasks, the search index, the status route.
- `server/utils/cmsModelChange.ts`: `cmsChangeModel`, the structure function, as section 5 describes it; `linksToType` for the guard; the `model` channel between instances.
- `server/utils/cmsSite.ts`: `cmsRetireCurrentSite`, `cmsRetireSite`, and a count of each site's loads.
- Routes for administrators: `GET` and `POST /api/cms/_model`, `GET /api/cms/_model/usage`, `GET /api/cms/_model/history`. The operator's `GET /api/health/sites` names each site's `loads` and the version of its own types.
- The later deletion runs when a site is loaded and every six hours while it stays loaded.

**Measured** (the playground, two sites, on this machine):

| | |
|---|---|
| A change of structure over HTTP | 12 ms in the middle (7 to 30 ms) |
| The first request after it, which makes the fresh instance | 16 ms (2 ms on a warm instance) |
| From one instance to the other | 19 ms |
| A change that meets a locked row of the same table | refused as busy after 2.0 s; the site answers on |
| The search index after a change | 10 ms, with a handful of entries; a large site was not measured |

**Tests.** `test/api/tenants-custom.spec.ts`: two sites with types of their own in one process. It covers what section 10 lists, and a fresh process that must wait for a site's types before its first answer. Four leaks were put into a temporary build one at a time, and the suite failed each time:

| Leak | Tests that failed |
|---|---|
| The loaded types kept once for the process | 22 to 27 of 31, the isolation tests among them |
| A change announced to every site, not its own | the two-instance test: the other site's model was gone there |
| The statements run on another site's pool | 27 of 30 |
| The API gate not waiting for the types | the fresh-process test, which was added because nothing failed at first |

**Found on the way.**

- A type or field name from a request could reach an inherited key of an object (`__proto__`). Names from a request now only pick things that exist, by their own keys.
- The routes ask for a session first (401), then whether the site has the feature (404), then for an administrator (403). The other order changed what an address of that shape answered before the feature existed.
- A line of the audit log can now be written inside a transaction, so it is kept or rolled back with the change.
- Scheduled tasks load every site on each round before they ask whether it has work. The new count of loads shows it; it was so before.
