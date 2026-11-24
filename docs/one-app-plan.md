# One app for every hosted site, with content types as data: options and a recommendation

**Status (2026-11-24):** an exploration. Nothing here is built into the product and nothing is decided. The experiments were throwaway: they ran on this machine against a Postgres 16.16 of their own, and their temporary changes were removed afterwards (2.14 says what each one showed). Where a number is an estimate, it says so.

Part 1 is the short read with the recommendation and the decisions to make. Part 2 holds the details behind it.

**Words.** A *site* is one website with its own content, people and files. An *app* is one running build. A site's *model* is its content types: collections, globals, fields, blocks. A *design* is what draws a site: a template's pages and components in one of its looks. A *code-first type* is written in `cms.config.ts`. A *custom type* is stored as data and made in the admin. A *contract* is the list of types and fields that some code or some block reads.

---

# Part 1: the short read

## The answer

1. **One app for all templates is possible, and it does not need dynamic content types.** It needs the app to ask "which model does this site have?" for each site, where today the answer is fixed in the build. That question is asked in one place, `useCms()`, and only four server files read the build's model directly. The 20 hosted templates cannot share one model: 21 type names (`service`, `page`, `siteSettings`, `enquiry`…) mean different things in different templates. So each site gets the model of its own design, and the build carries all of them.

2. **Content types as data work with the engine tinyzoo already has.** In the experiment a type "Courses" existed only as JSON in a site's database. With only the source of the model changed in `useCms()`, the unchanged admin showed its menu entry, list and form; the unchanged API validated, saved, published and served it, with a relation to a code-first collection; the site search and the admin search found it; the sitemap listed it; and `/api/content-types.ts` served its generated TypeScript types. The form description the admin receives was byte for byte the same as for the same type written in code.

3. **A site's model should have two parts.** The *design's part* is code: the types the design's components read. It is compiled together with those components and cannot be edited in the admin. The *site's own part* is data: custom types and fields the owner adds. It is shown through generic blocks, or through code a developer writes against generated types. This split is what keeps pages from breaking: nothing that code reads can be changed by a click.

4. **Storage: a real table per custom type, in the site's own database.** Each site already has its own database, so a custom type is just one more table there. Measured with 1 000 site databases: five custom types cost 0.3 MB more per site (8.7 MB before), making a type takes 5 ms, and queries are as fast as with JSON rows. The reason to choose tables is not speed. It is that lists, filters, relations, translations, publishing, versions, search and backups then work through the code that exists, as the experiment showed.

5. **No broken pages, by three rules.** The design's part is locked. A generic block stores which type and fields it shows, so the server knows where a field is used and refuses to remove it while it is used. Code written by a developer registers the snapshot of the model it was compiled against, and the live site refuses changes that do not fit a registered snapshot. Removing something never deletes at once: it is hidden first and deleted later.

6. **Types.** A site's model can be pulled into a file, and the client types are generated from that file, by a developer or in CI. The compile-time guarantee that was the reason against a dynamic schema on 2026-11-13 comes back through rule 5: the snapshot is not only a copy, it is a lock on the live site.

7. **The frontend grows in levels, each useful alone:** generic blocks that show any collection; then colours and type as data; then sections and layout as data, which is the builder. The 52 finished looks stay code.

8. **Custom server code stays out of a shared app.** The view that custom code inside a shared app is unsafe holds (2.10). A shared app can offer custom types, custom blocks' settings, rules written as data, webhooks, and custom HTML and CSS on the site's own pages. Real custom logic gets its own app, and moving a site out is already built.

## The recommendation, question by question

| Question | Recommendation |
|---|---|
| One app: the models | The build carries every design's model; each site's row names its design; `useCms()` answers with that model (2.2) |
| One app: the designs | All 52 looks stay code, in one build, chosen per site at run time as looks already are. Design becomes data later, level by level (2.3, 2.11) |
| Where the guard gets its knowledge | From three places: the design's part is code and locked; generic blocks store their bindings as data; developer code registers its snapshot. Checked in the one server function that changes structure, and in CI for developer code (2.6) |
| Storage | A real table per custom type in the site's own database (2.5) |
| What type safety means | Exact at compile time for the design's part; validated at run time for custom types shown by generic blocks; compile time against a locked snapshot for developer code (2.7) |
| `cms.config.ts` | Stays. The custom part sits beside it and uses the same engine. Off by default; the nine client sites and the website change nothing (2.8) |
| Isolation | Unchanged: own database, own user. The model of a site is reached only through the current site, like every cache. Structure changes run as the site's own database user. New tests with two sites of different models (2.9) |
| Custom code | None in a shared app. Own app for custom logic (2.10) |
| The 21 templates | They move into one app as they are. "A change only adds or fixes" becomes a check in CI (2.12) |

## Order of work

Each step can be released alone and is useful alone. The estimates are rough.

0. **The model of the current site** (no change in behaviour). `useCms()` gives the model of the current site; a build still has one model. The caches that say "the same for every site" become per model. About 2 to 4 days.
1. **One hosted app.** All designs in one build; the site's row names its design; one process in the cloud's shared driver; the two-site test suite gets a second kind: two sites with different models. Memory and build time are measured with three templates first. *Useful alone: the hosted product is one app, and the platform in front needs no router by template.* About 3 to 4 weeks, most of it merging the frontends and comparing the 52 looks.
2. **Custom types and generic blocks.** The model document, the structure editor (adding only at first), the tables made at run time, three generic blocks, the check on bindings. *Useful alone: an owner adds "Courses" and shows them on the site without a developer.* About 4 to 6 weeks.
3. **The developer's side.** The model as a file (`pull`, `push`), types generated from it, the registered snapshot, the CI check, and the switch for single-site apps. *Useful alone: a developer builds a custom frontend against a model that is edited live, and stays type-safe.* About 2 to 3 weeks. It can come before step 2's screens, since both use the same server function.
4. **Colours and type as data.** 5. **Sections and layout as data: the builder.** Each needs a design of its own.

## The cost, honestly

Running one app per template is not expensive: about 300 MB each, so about 6 GB for 21, plus half a megabyte per site in use. **One app does not fix a cost problem.** What it gives:

- about 5 GB of memory back (an estimate: one app instead of 21);
- one thing to deploy, watch and scale, and no router by template in front of it: every host name goes to the same app;
- a new template is no new process;
- a home for sites that do not come from a template. This is the real reason: a site made in the builder has no template, so with one app per template it has nowhere to run.

What it makes harder:

- **One deploy for everyone.** A change to the Restaurant design redeploys the Photographer sites too.
- **A bigger blast radius.** A crash or a memory leak hits every site, not one template's sites. Two instances and a small group of sites that get a new build first limit this; they do not remove it.
- **One large build.** 1 071 components, 0.5 MB of CSS and 89 typefaces in one build. How long it takes and how much memory the process needs was not measured.
- **Structure changes at run time** are a new kind of operation in a product whose migrations were always reviewed by a person.

## Decisions to make

1. **One app now, or later?** My pick: do steps 0 and 1 before the first outside customer. No hosted site exists yet, so nothing has to be moved.
2. **Storage:** real tables (my pick) or JSON rows.
3. **Two parts of the model:** the design's part locked and the site's own part free (my pick), or everything editable.
4. **Removing a field or a type:** hidden first, deleted after 30 days (my pick); or always refused; or deleted at once after a warning.
5. **Custom code:** none on the server in a shared app (my pick). Custom HTML, CSS and scripts on the site's own pages, for the owner only, can come later.
6. **The developer's flow:** the model as a file in git with `pull`, `push` and a locked snapshot (my pick), for sites that switch custom types on.
7. **How far the frontend goes now:** generic blocks with step 2 (my pick); tokens, sections and the builder later, each with its own design.

---

# Part 2: the details

## 2.1 What the code says today

- **One seam for the model.** `useCms()` in `packages/cms/server/utils/cmsDb.ts` returns `{ db, reg }`. `db` is already per site. `reg` (the registry) is built from `#cms/config`, an alias the module points at the build's `cms.config.ts` (`module.ts`). There are about 180 calls of `useCms()`, and only four server files import `#cms/config` themselves: `cmsDb.ts`, `server/plugins/cms-plugins.ts`, `server/api/content-types.ts.get.ts`, `server/api/openapi.json.get.ts`.
- **The admin knows no type at build time.** Its pages are `app/pages/admin/[entity]/…`, and it draws menus, lists and forms from `GET /api/cms/_graph`, which is `reg.graph` filtered by the person's rights. The routes under `server/api/cms/[entity]/` find the type with `reg.byName`.
- **A field is already a plain description.** `f.text()`, `f.select()`… return a descriptor with the column (`ColumnSpec`), the validation and the admin's control (`src/descriptor.ts`, `src/fields.ts`). `defineEntity` makes the table object, the translation table and the validation from the descriptors when it is called (`src/entity.ts`). Nothing in it needs a build.
- **Search and versions are already shared tables.** `cms_search` and `cms_revisions` hold rows for every type, named by the type (`src/system.ts`).
- **Blocks are already data with a definition beside it.** A page's blocks are one JSON array, checked against `defineBlock` definitions, with versions and upgrades (`src/blocks.ts`).
- **A guard for breaking changes exists.** `cli/breaking.ts` reads a migration and names what loses data (a dropped column, a changed type, a rename) and what may fail on existing rows (a new required column, a new unique rule). `tinyzoo generate` stops on them.
- **The generated types exist.** `tinyzoo client` writes them, and a running site serves them at `/api/content-types.ts` (`src/sdk.ts`, `src/content-shape.ts`).
- **What is fixed at build time:** the model, the migrations (one folder bundled as `cms-migrations`), the plugins (their routes and pages are registered by `module.ts`), and the frontend.

## 2.2 One app: the models

The 20 templates in `templates/` were loaded and compared (the Basic website, `packages/cms/starter`, is the 21st):

- 232 types in all, 89 different names.
- 24 names are used by more than one template. Only three have the same shape everywhere (`formSettings`, `redirect`, `question`). The other 21 differ: `service` in 8 templates has 8 shapes, `enquiry` in 9 has 9, `page` and `siteSettings` differ in all 20.
- Every template uses the same plugin (`forms`) and has 23 to 27 tables.

**Options**

| | What it is | Cost | Verdict |
|---|---|---|---|
| A. One merged model | Every site's database holds every template's types | Impossible as the names stand; after renaming, about 230 types and over 100 extra tables in every site, and every editor would see them | No |
| B. A model per site, from the build | The build carries each design's `cms.config.ts`; the site's row in the directory names its design; `useCms()` answers with that model | Small and local (list below). Everything stays code and typed | **Yes, step 0 and 1** |
| C. Every model as data | A template's model is copied into each new site's database | The designs' components would read types that are data, so their compile-time safety would depend on a guard. Updating a template means changing a document in every site | Not for the designs' part. Yes for the site's own part (2.4) |

**What B changes in the core**

- `cmsDb.ts`: the registry comes from the current site (its design's model), kept in per-site memory (`cmsSiteScoped`) like the pool.
- The three other files that import `#cms/config`.
- The caches declared "the same for every site" (`cmsProcessWide` in `content-types.ts.get.ts`, `cmsRoles.ts`, `cmsAdminTheme.ts`) become per model.
- Migrations: one folder per design in the build instead of one (`module.ts` bundles `cms-migrations`; `cmsMigrate.ts` already migrates each site by itself on first use).
- `_junctionCache` in `src/entity.ts` is keyed by table name for the whole process; two models with a relation table of the same name must not share it.
- The site directory's row gets one more field, the design (`tenant_sites` in `cmsSite.ts`).
- Plugins must be the same for every model of a build. They are today.

Sites of the same design can share one registry: it holds structure, no content. Measured: a registry over shared types costs 12 KB.

## 2.3 One app: the designs

Design is code too: 1 071 Vue components (2.2 MB of source), 0.5 MB of CSS, 89 typefaces, in 52 looks.

**Options**

| | What it is | Verdict |
|---|---|---|
| A. All designs as code in one build | The site's design and look choose the components at run time | **Yes, step 1** |
| B. Design as data first | Rebuild the 52 looks as data for a builder | No: it throws finished work away, and a builder able to express those designs is the largest piece of this whole direction |
| C. A few apps, by group of templates | | No: all the work of A, little of its gain |

**Why A is mostly mechanical.** The kit already made the templates alike:

- Every template has the same pages and layout, the kit's (`templates/kit/app/pages/index.vue`, `[...slug].vue`, `layouts/default.vue`).
- The look is already chosen at run time from the site's settings (`LookPart.vue`, `useLookHead`), and each look's CSS is already written under `html[data-look="…"]`.
- The 52 look ids are unique across all templates.

**What collides and has to change:**

1. Block components are global and named by block: there are 20 `BlockText.vue` and 12 `BlockOpening.vue` (114 block names, 30 of them with different shapes). A block must be found through the site's design, the way `LookPart` finds a look's part.
2. Each template exports helpers under the same names (`ENTRY_PAGES`, `wordsOf`, `BlockOf`, `DEFAULT_LANGUAGE` in `app/utils/site.ts`), and Nuxt imports them automatically. They become one lookup by design.
3. `#site` is an alias for one template's folder (`templates/kit/nuxt.config.ts`).
4. `LookPart` loads every look of the template at once (`import.meta.glob(…, { eager: true })`). Right for three looks, wrong for 52: each look must load only when a site uses it.
5. CSS: one build would send all looks' styles to every visitor unless each look's stylesheet is its own file, linked by `useLookHead`. `main.css` differs in all 20 templates.
6. Typefaces: 89 families in one configuration.

**Not measured:** the memory of one process with all designs and the time of one build. The first task of step 1 is to put three templates into one app and measure both.

## 2.4 Content types as data: the model document

The site's own part of the model is one JSON document in the site's own database, with a version number and its history. It says what `defineEntity` and `f.*` say, without functions:

```json
{ "name": "course", "label": { "cs": "Kurzy", "en": "Courses" }, "titleField": "title",
  "fields": [
    { "key": "title", "type": "text", "required": true },
    { "key": "slug", "type": "slug", "from": "title", "unique": true },
    { "key": "price", "type": "number", "int": false, "optional": true },
    { "key": "category", "type": "relation", "to": "category", "kind": "many-to-one" }
  ],
  "content": { "public": true, "slug": "slug", "path": "/kurzy/:slug" },
  "publish": { "field": "status", "publishedValue": "published", "draftValue": "draft" } }
```

In the experiment a mapper of 60 lines turned such a document into tinyzoo's own descriptors for eleven kinds of field. From there on everything was the existing code.

- **What cannot be data:** functions. Access rules (`access`), the condition of `content.published`, a block's `upgrade`, hooks, plugins. The document gets data forms of the common cases (who may write, by role; "published" taken from `publish`) and leaves the rest to code.
- **Relations** go from a custom type to a code-first type or to another custom type, never from code to a custom type: code cannot name something that may not exist.
- **Names.** A custom type must not take a name the design uses now or may use later. The simple rule: custom types live under their own prefix in the database and in the API, and editors only ever see labels.
- **Both ways.** The same document can be written out as `cms.config.ts` source. With real tables the database already has the shape code-first expects, so a site that outgrows the shared app moves out with its model as code.
- **When it is loaded.** `useCms()` is synchronous. In multi mode a request already waits for its site's migrations before anything else; the model is read at the same point. A change is announced to other instances through the channel that already carries changes.

## 2.5 Storage

Isolation is not in question: every option below lives inside the site's own database.

| | A real table per type | Rows in shared tables (JSON) |
|---|---|---|
| The engine | The existing one. Lists, filters, sorting, relations, trees, publishing work unchanged (shown over HTTP) | A second engine for all of it, beside the first |
| Disk, empty | about 60 KB per type per site (measured) | 115 KB per site, whatever the number of types (measured) |
| Speed | The same. An entry by its address: 0.04 ms both. Sorted by a custom field over 20 000 entries: 6.1 ms against 6.6 ms without an index, 0.10 against 0.11 ms with one | |
| Search (pg_trgm) | The same in both: `cms_search` is one table for every type. The experiment's type was found by the site search and the admin search | |
| Versions | The same in both: `cms_revisions` keeps JSON snapshots by type name | |
| Translations | The `<type>_locales` table tinyzoo makes today | To be written again |
| Drafts, scheduled publishing | Unchanged | To be written again |
| Relations | Real foreign keys: Postgres itself refused a relation to a missing entry | No check in the database; a link table and checks of our own |
| Backups, moving a site | `pg_dump` of the site's database takes everything. Moving out to an own app: the model is written out as code and the database already fits | `pg_dump` too. Moving out to code-first needs a conversion of the data |
| Changing the structure | A statement at run time, run by the site's own user. Adding a field to 20 000 entries: 0.6 ms. Changing a column's type rewrites the table: 97 ms | Nothing to run when a field is added. Removing one rewrites every row: 220 ms |
| The risk | Changing tables at run time is new for tinyzoo | Stored rows drift from the definition, as old blocks do; needs versions and upgrades |

**Measured at 1 000 sites** (each a database made from the Photographer template's tables): 8.70 GB before; 9.00 GB with five custom types as real tables, two of them translated (seven tables); 8.82 GB with the shared JSON tables. So a table per type per site costs 0.3 GB at 1 000 sites.

**Recommendation: real tables.** One engine instead of two is worth far more than 0.2 GB.

**Who writes the statements.** In the experiment drizzle-kit's generator made them at run time in 10 ms. Two things speak against using it in the server: it is a 2.9 MB development tool that is not in the server build today, and it guesses renames. Recommended: a small generator of tinyzoo's own for the few allowed operations (make a type, add a field, add a choice, hide, delete), built on the column description tinyzoo already has (`ColumnSpec`, `serializeColumn`). Each operation then has a name the guard knows. A test compares its output with drizzle-kit's. Code-first migrations stay as they are: generated, read by a person, bundled.

## 2.6 No broken pages: the guard

**The contract.** To refuse a breaking change, something must know what is read. There are three kinds of reader, and each gets its knowledge differently:

| Who reads | Where the knowledge comes from | What happens on a change |
|---|---|---|
| The design's components (code in the shared app) | They read the design's part of the model, which is code and compiled with them | Nothing can happen: that part is not editable. In the editor it shows as "part of the design" |
| Generic blocks (2.11) | Each block on a page stores its binding: which type, which field in which place | The server keeps an index of bindings, as it keeps the search index. Removing a field that is shown somewhere is refused with the list of places: "shown on: Home › Courses" |
| Developer code (a custom frontend, a separate app) | The snapshot of the model it was compiled against, registered with the site on deploy | A change that does not fit a registered snapshot is refused and names the snapshot |

**Where it is checked.** In the one server function that changes structure. The admin, the API and the MCP tools all go through it, so there is no way around it. CI is the second place, for developer code only: it compares the model file in git with the live site and then type-checks the code (2.7).

**What counts as breaking.** The classification of `cli/breaking.ts` fits as it is. In the experiment it was run on six changes of the stored type:

| Change | Result |
|---|---|
| Add an optional field | safe: `ADD COLUMN` |
| Add a choice to a select | safe: `ADD VALUE` |
| Remove a field | refused: its content is lost |
| Turn a date into a text | refused: changes the column's type |
| Add a required field without a default | refused: fails on existing entries |
| Make an optional field required | refused: fails on entries that have no value |

For readers one more rule applies: what the site now returns must still fit what the snapshot promised. A field that turns from required to optional breaks code that expects a value. The generated types already hold this information (`src/content-shape.ts`), so the check is a comparison of two such descriptions.

**Made safe instead of refused.**

- *Renaming* for editors is a change of the label. The key never changes, so nothing breaks.
- *Removing* hides first: the field leaves the forms and the API, its column stays for 30 days and can be brought back, then it is deleted. This is the two-step rule tinyzoo already asks of developers during rolling deploys, done in time instead of in releases.
- *Changing a type* is a new field and a copy of the values.
- *Drawing never fails.* A generic block whose field is gone draws nothing in that place and reports itself in the admin. A visitor never sees an error because of a structure change.

## 2.7 What type safety means, precisely

| Code | Guarantee | How |
|---|---|---|
| A custom site with its model in `cms.config.ts` | Compile time, exact | As today |
| The designs of the shared app reading the design's part | Compile time, exact, and nothing can drift | Types and components are built together; that part cannot be edited at run time |
| Generic blocks reading custom types | No compile time: no code was compiled against these types. At run time: every write is validated against the definition (the experiment refused a bad entry with four issues), bindings are checked on every structure change, drawing cannot fail | |
| Developer code against a model that is edited live | Compile time against a snapshot. The snapshot is registered, so the live site cannot move away from it in a breaking way | Below |
| Somebody else's program using the API without registering | What the API promises today (OpenAPI), and no more | |

**The developer's flow** (fetch the model from the live site and develop against what is really there):

1. `tinyzoo model pull https://site` writes the site's own part of the model into a file in the repository, `cms.model.json`. The local database is brought to the same shape, so local development has the live structure.
2. `tinyzoo client` generates the types from that file. It needs no network and gives the same result every time.
3. CI runs `tinyzoo model pull --check`: it fails when the live model differs from the file in git. The developer pulls, and the type check then names every line of code that no longer fits.
4. On deploy the build registers its snapshot with the site. From then on rule 2.6 holds: the live site refuses a change that breaks it.
5. A change made by the developer goes the other way: edit the file, `tinyzoo model push`, through the same guard.

**Why this answers the objection of 2026-11-13.** A dynamic schema was rejected then because types from a snapshot lose the compile-time guarantee: the code compiles against yesterday's structure. That is true of a snapshot that is only a copy. Here the snapshot is also a lock: "the code compiles against S" and "the live model may only change in ways that still fit S" together mean the code is correct against the live model.

**What is left open, honestly:** an owner who forces a change after being shown what it breaks (it should exist, be logged, and be rare); somebody changing the database by hand; a program that never registered.

## 2.8 `cms.config.ts` and the sites that exist

- **Beside, not instead.** The registry of a site is its code-first types plus its custom types. Both go through the same `defineEntity`, so there is one engine and one set of rules.
- **Both can live in one site.** In the experiment the custom "Courses" pointed at the template's code-first "Categories", and the content API returned the category inside the course.
- **Off by default.** A site without the switch behaves as today. The nine client sites and tinyzoo's own website change nothing and need no migration. Like multi mode, the switch starts as an experimental environment setting, because the list of module options is part of the frozen surface.
- **The frozen surface stays.** `useCms()` keeps returning `{ db, reg }`; the content API gets more types under the same routes; the CLI gets new commands. Nothing listed in `docs/api-surface.md` changes its meaning.
- **When a client site would switch it on:** when the client wants to add simple collections without a release. The developer then works with the flow of 2.7. For a site whose developer is always at hand, code-first stays the better way.

## 2.9 Isolation

What was decided stays: each site has its own database and its own database user in one Postgres. Nothing here needs a schema per site or row-level security.

**By construction:**

- The model of a site is reached only through `useCms()`, which answers from the current site. A request without a site has no model, as it has no database.
- The custom part lives in the site's own database. No table shared between sites holds anything of a model.
- A structure change runs as the site's own database user inside its own database. In the experiment the site's user made its table itself. That user cannot connect to any other database.
- A registry shared by sites of the same design holds structure only, never content, and never a custom part.
- `test/unit/module-state.spec.ts` already refuses new module-level state that is not declared per site or process-wide. The three caches that are process-wide today "because the model is the same for every site" must change in step 0.

**Proven by tests** (to add in step 1 and 2):

- Two sites with *different* models in one process. Every route called with site A's type name on site B answers 404. B's admin graph, generated types, OpenAPI document, search and sitemap name nothing of A.
- A structure change on A does not rebuild or delay B.
- As with the two-instance tests, leaks are put into a temporary build on purpose, and the suite must fail.

## 2.10 Custom code

**The claim holds.** Custom code running inside a shared app is not safe:

- The process holds the key that opens every site's database address and secret (`NUXT_CMS_TENANCY_KEY`), and its own environment.
- Node has no wall inside one process. Its `vm` module says of itself that it is not a security mechanism.
- Even code that could read nothing shares the processor: one site's loop stalls every site.

**What a shared app can still offer as "custom":**

- custom types, fields and the settings of blocks (data);
- rules written as data: who may write, what is required, when a field shows, "when this form is sent, e-mail that address";
- webhooks out and the API and MCP in: the customer's own logic runs on the customer's side and talks to the site with a token;
- custom HTML, CSS and scripts on the site's own public pages. This runs in the visitor's browser on the site's own address, so it can reach only that site. It can act as a signed-in editor of that site who visits the page, so only the owner may add it;
- moving out: a site that needs real custom logic becomes its own app. Moving out and in is built (2.14 of the multi-tenant plan).

Later, custom functions could run in a separate service that holds no secret and gets one site's token. That is "its own instance" in a smaller form, not code inside the shared app.

## 2.11 The dynamic frontend, in levels

Each level is useful by itself, and each needs the one before.

1. **Generic blocks.** Three blocks every look has: *a list of entries* (as cards, rows or a table), *chosen entries*, and *the page of one entry* at the type's address. A block's binding is data: which type, which field is the title, the picture, the text, the date, the label; the filter, the order, how many. The looks already share tokens that point at CSS variables (`bg-paper`, `text-ink`, `font-display`), so the kit can draw these blocks once and every look styles them through its tokens. Today the addresses that lead to an entry are a list in each template's code (`ENTRY_PAGES`); for custom types the address comes from the type.
2. **Colours and type as data.** A look's colour presets are already close to data (`defineLooks`). An owner changes colours, typefaces, corners and spacing; a look is the starting point.
3. **Sections as data.** A page is already a list of blocks. A library of blocks that belong to no template, each with variants and its own background, spacing and columns.
4. **The builder.** Layout as a tree, the header and footer, the page of an entry, all edited in the admin. The page editor with the live preview is its base. This is the largest piece and needs its own design.

## 2.12 The path for the 21 templates

- **Step 1 moves them as they are:** same content model, same looks, same demo content, one build. No hosted site exists, so no data moves.
- **"A change only adds or fixes; a redesign ships as a new look" stays, and a machine checks it.** Today it is a sentence in `templates/README.md`. With step 1, CI compares each design's model with the last release using the same classification as 2.6 and refuses a removal, a rename or a changed type. Custom types may point at the design's types, which is one more reason they cannot go away.
- **A site keeps its design's part for life.** Changing the look inside a template works as today. Changing the template does not: the models differ.
- **Later, new templates can be data:** a model document, pages built from the block library, demo content. Adding one then needs no release. The 52 looks of today stay code.

## 2.13 Cost

Covered in part 1. The numbers behind it:

- Per-template apps: about 300 MB each to start, half a megabyte per site in use; 300 sites ran in 400 to 470 MB (multi-tenant plan, 2.14).
- A custom type in memory: about 0.4 MB for a type of eight fields while its site is loaded, so about 40 to 50 KB per field (measured). Most of it is made eagerly when the type is built; where exactly it goes was not profiled. A site with five custom types costs about 2 MB while loaded and gives it back when it is unloaded after 15 minutes. If this matters, the validation can be built on first use.
- A custom type on disk: about 60 KB per type per site.
- Building a registry: 1 ms for the Photographer model, 0.3 ms more per custom type.

## 2.14 The experiments

All were throwaway. They ran in a scratch folder outside the repository against a Postgres 16.16 in a container of its own, which is removed. The product code was changed only for experiment 3, and that change is reverted.

**1. What does a table per type per site cost at 1 000 sites?** Three sets of 1 000 databases, each made from the Photographer template's 23 tables: as they are; with five custom types as real tables (two translated); with the same types as rows of three shared JSON tables. Result: 8.70, 9.00 and 8.82 GB. Then one database of each kind with 500 and with 20 000 entries, and eight kinds of query: no difference worth naming (2.5). *It showed: the cost of real tables is small, and speed does not decide between the two.*

**2. Can a type stored as data go through tinyzoo's own engine?** A site database with its own user. The definition stored in `cms_state` and read back. Then, with the existing functions only:

- the registry with the stored type, built in 1.3 ms;
- the admin's form description: identical (2 162 bytes) to the one of the same type written in code;
- the table: four statements generated in 10 ms, run by the site's own user in 5 ms;
- validation from the definition: a good entry passes, a bad one is refused with four issues;
- a write and a read with a join to a code-first collection; a relation to a missing entry refused by Postgres;
- the generated client types, with the new type;
- six structure changes, classified by the existing guard (2.6).

*It showed: yes. One finding: the registry's schema object holds tables but not the select fields' types (only the generated `schema.ts` has them), so a generator at run time must add them.*

**3. Does the unchanged admin show it?** The Photographer template ran in development with one temporary change: `useCms()` and the route that serves the types took their model from a helper that laid the stored type over the build's model. (The definition was read from a file holding the same JSON as experiment 2 stored in the database; its table was made by experiment 2's script.) Over HTTP, with nothing else changed:

- `GET /api/cms/_graph` listed "Courses" with its eight fields and controls;
- the admin showed it in the menu, with its list and its form (seen in a browser);
- a save, a refusal of a bad entry (422), a publish, two versions kept;
- the public API returned the course with its category inside; a draft was not served;
- the site search and the admin search found it (pg_trgm); the sitemap listed its address;
- `/api/content-types.ts` served the types with `Course` in them.

`/api/openapi.json` still described the build's model: it is one of the four files that read the build's model themselves. *It showed: the admin and the API are ready; the model's source is the only thing fixed at build time.*

**4. How far apart are the 20 templates?** All 20 models loaded and compared; the frontends counted (2.2, 2.3). *It showed: one merged model is impossible, one model per site is needed; the look ids do not collide, the block and helper names do.*

**5. What does a registry per site cost?** 300 registries of several kinds (2.13). *It showed: sharing a design's types between sites makes the registry itself almost free (12 KB); custom types cost about 0.4 MB each while loaded.*

## 2.15 Not explored

- The memory and the build time of one app with all 52 looks.
- Custom types with translations, with a many-to-many relation, or with a blocks field, made at run time. The experiment's type had none of them.
- Roles and per-field access for custom types.
- How the MCP tools, shared editing, `tinyzoo backup` and the upgrade steps of `src/upgrades.ts` behave with a model that differs per site.
- Requests that are under way when a site's model changes. The multi-tenant build found two bugs of this kind when a site's row changed (2.14 there, numbers 3 and 4); the same care is needed here.
- The structure editor's screens, and what the generic blocks look like in each look.
- Any real traffic.
