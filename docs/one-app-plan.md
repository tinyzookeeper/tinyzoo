# One app for every hosted site, with content types as data: options and a recommendation

**Status (2026-11-24):** an exploration. Nothing here is built into the product and nothing is decided. The experiments were throwaway: they ran on this machine against a Postgres 16.16 of their own, and their temporary changes were removed afterwards (2.14 says what each one showed). Where a number is an estimate, it says so.

**Update (2026-11-24):** step 0 and the server's half of step 1 are now built on the branch `feat/one-app` (not released), and the designs of all 20 hosted templates are in one app there. 2.16 and 2.17 say what exists and what it costs. The cloud runs that one app since 2.18.

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

## 2.16 What is built: the model of the current site

Built on the branch `feat/one-app`, local only: nothing is released or deployed. This is step 0 and the server's half of step 1. A site whose `cms.config.ts` does not export `defineModels` runs as before; the single-site API tests pass unchanged.

**How a build declares its models.** The app's `cms.config.ts` exports them (`defineModels` is a new export of `tinyzoo`, marked experimental):

```ts
import { defineModels } from 'tinyzoo'
import * as photographer from '../templates/photographer/cms.config'
import * as restaurant from '../templates/restaurant/cms.config'

export const models = defineModels({
  photographer: { config: photographer, migrations: '../templates/photographer/server/db/migrations' },
  restaurant: { config: restaurant, migrations: '../templates/restaurant/server/db/migrations' },
})
```

- `config` is what the model's own `cms.config.ts` exports. `migrations` is its migrations folder, relative to the app's root folder.
- A name is 1 to 40 characters of `a-z`, `0-9` and `-`, starting with a letter. `default` is taken.
- The app's own exports are one more model, `default`, when they define at least one entity. An app with only `models` has no `default`.
- No module option was added. The multi-tenant mode itself stays an environment setting.

**The site's row.** It has a new optional field, `model`, the same in the JSON file and in the `row` of `tenant_sites`. A row without it uses `default`. A row that names a model the build does not have (or names none when there is no `default`) is refused like any other bad row: the last good directory stays and the log says why. Changing a site's `model` in its row reloads the site like any change of its row. Its database is not converted.

**One place decides.** `cmsSiteModel()` (`server/utils/cmsModel.ts`) gives the current site's model: its name, its config and its registry. It is the only server file that reads the build's `cms.config.ts`. Step 2 lays a site's own types over the model there. Sites of one model share one registry (it holds structure, never content).

**What follows the site's model:** `useCms().reg` and with it every route, the admin graph, `/api/content-types.ts`, `/api/openapi.json`, the site search, the sitemap, the forms (`defineForm` forms are entities of the model), the plugins' options and hooks, the upgrade steps, the scheduled work and the MCP tools. The caches that said "the same for every site" are now kept by model, or their reason was corrected where they never depended on the model.

**Migrations.** Each named model's folder is bundled with the build under its own name (`cms-migrations-<name>`; `default` keeps `cms-migrations`). Each site is migrated with its own model's migrations when it is first used. A folder that does not exist stops the build.

**Plugins.** The build registers the plugins' pages, routes, components and texts once, so every model must have the same plugins, with the same options, in the same order. The build checks it, and so does the server when it starts, with a message that names the two models. Options that do not change what the build registers (the analytics plugin's country database file, for example) may differ, and each site reads its own model's. All 20 templates use `forms` only, which has no options, so they meet this rule.

**Tests.**

- Unit: `test/unit/models.spec.ts` (24 tests: `defineModels`, which models a config has, the plugin check, the relation tables) and 5 more in `test/unit/cms-site.spec.ts` (the row's `model`).
- `test/api/tenants-models.spec.ts` (25 tests): two sites with different models in one process. Site A has the playground's model and site B has a small second model, `shop` (`playground/models/shop`). Both have a `post` and a `tag` of different shapes, and a relation table `post_to_tag`. The suite shows these things:
  - Every admin and content route called with one model's type name on the other site answers 404, in both directions.
  - The admin graph, the generated types, the OpenAPI document, the search and the sitemap of a site name nothing of the other model.
  - Each database holds only its own model's tables and migrations.
  - A write on one site changes nothing on the other.
  - Each site has only its own forms.
  - A row naming an unknown model is refused while both sites keep running.
- Three leaks were put into a temporary build one at a time, and the new suite failed each time: a registry kept once for the whole process, the generated types kept once for the whole process, and every site migrated with the `default` model's migrations.

**Found on the way.**

- `_junctionCache` (`src/entity.ts`) kept relation tables by name for the whole process. Two models with `post_to_tag` would have shared one table object whose foreign keys point at the first model's tables. It is now kept by the pair of entity tables.
- The analytics plugin's country database was one slot for the whole process. With two models naming different files it would have been read again at every switch. It is now kept by file.

**Limits to know.**

- A single-mode server whose build has no `default` model refuses to start: such a build is meant for multi-tenant mode.
- `cms.admin.nameFrom` in `app.config` names a global of one model. On a site whose model does not have it, the admin shows `cms.admin.name`.
- The CLI (`tinyzoo generate`, `client`, `seed`, `export`) still reads one `cms.config.ts`. A template's model and migrations are made in the template's own folder, as today.
- A plugin's `entityPanels` names collections, so every model must have those collections.

**For the hosted app (the rest of step 1).** The app's `cms.config.ts` imports every template's `cms.config.ts` and lists them in `defineModels`, each with its migrations folder. The app needs no model of its own. The cloud's shared driver writes `model: '<template id>'` into each site's row, and one process serves every template, started like today's template process: `NUXT_CMS_TENANCY_MODE=multi` with the directory's settings. Not built yet: the merged frontend (2.3), the cloud's driver writing `model`, and one process for all templates in the cloud.

## 2.17 What is built: the designs in one app, and what it costs

Built on the branch `feat/one-app`, local only. All 20 hosted templates are in the one app: Photographer, Wedding and Restaurant first, then the other 17. Each template still builds on its own as well, and the cloud still runs the templates' own builds.

**What is built.**

- `templates/app/` (package `tinyzoo-template-app`): the one app. It extends the kit and tinyzoo as a template does. `designs.ts` lists its designs (their typefaces), `cms.config.ts` the same ids as content models (`defineModels`). It has no model of its own, so it runs in multi-tenant mode only. A site is drawn in the design its model names.
- The kit's module (`templates/kit/module.ts`) builds in two ways. In a template's own build nothing changes for the template. In the one app it keeps each design's names its own: inside `templates/photographer`, `wordsOf`, `<LookAlbum>` and `<AtelierHero>` are Photographer's, as in its own build. Blocks are registered as `<Id>Block<Type>` (`PhotographerBlockHero`) and `<CmsBlocks>` gets the prefix. A design's server handlers answer only on its own sites (Wedding's `POST /api/gift/:id/reserve` answers 404 on a Photographer site). Before a build it checks that look ids are unique, that every look has its stylesheet, and that no two designs answer the same address.
- At run time a design is one object, `useDesign()`: its words, entry pages, looks, block prefix, look parts and look stylesheets. The server takes the design from the site's content model (`cmsSiteModel().name`, in the kit's `server/middleware/design.ts`); the browser gets it with the page. It never comes from the request. `packages/cms` is unchanged.
- Each look part is a chunk of its own, loaded when a page of its look needs it, on the server and in the browser before the page is drawn. The admin's live preview changes the look in place: the new look's parts and stylesheet load and take over.
- Each look's stylesheet is a file of its own, linked after the main stylesheet only on that look's pages. It holds the look's `@font-face` rules: in the one app no design's typeface is global, so the HTML no longer carries every family's rules. (The admin's three families stay global, as before.) The look's file goes through the same CSS steps as before, when it was part of `main.css`.
- One main stylesheet for all designs, with the utilities of all 20: 430 KB, 63 KB gzipped, against 37 to 43 KB gzipped (40 KB in the middle) of a template's own build today. That is 20 to 26 KB more, under the 40 KB limit of the plan, so there is no stylesheet per design. A design's own base rules and its theme values that differ from the shared ones are in its `design.css`, under `html[data-design="<id>"]`. Tailwind's own theme counts as shared: Individual, Studio and Software give `--font-mono` a value of their own, and it is in their `design.css`, not in the app's theme. A theme value that names one of the design's web fonts is not in `design.css` (its `@font-face` rules would go into the main stylesheet); every look that reads one sets it itself.
- Type checks: one TypeScript project per design (`templates/app/scripts/typecheck.mjs <id>`, about 7 seconds), as strict as the template's own. The design's helpers are declared before Nuxt's and Nitro's, so its names win as in its own build (Event's `useEvent` is not Nitro's). A broken field in Photographer's generated client fails Photographer's check only. A moved template's `pnpm typecheck` runs both its own check and the one app's.
- Scripts in `templates/app/scripts`: `relative-imports.mjs` and `theme-diff.mjs` (the two mechanical steps of moving a template), `dev.mjs` (`pnpm --filter tinyzoo-template-app dev <id>`: the development server with that design and one site of it), and `sites.mjs`, `serve.mjs`, `shots.mjs`, `compare-shots.mjs`, `measure.mjs` (sites made by hand for a built server, pictures of every look, their comparison, and the numbers below). `shots.mjs` takes the browser's clock as `--now` and records it with the day the sites were seeded; `compare-shots.mjs` warns when two runs differ in either.

**Every look renders as before.** Pictures of every look of the 20 templates (each look's home page at 1440 and 390 pixels wide, its two other colour presets, one page of each kind of entry the template gives an address, each look's 404 page, and a picture of its own for a form below the end of a long page) were taken from each template's own build on `main` and from the one app with all 20 designs, with the same seed on the same day and the browser's clock fixed at one moment (Wednesday 9.40). Every template's pictures include its forms, so Construction, Development, Office, Trades, Individual and Software each show their own `EnquiryFields`, `ContactFields` or `SiteLink`, which share names but not code; Development's own `LookEntry` draws its flat pages.

- 376 pictures: 368 identical to the pixel, 8 within the tolerance (`compare-shots.mjs`: at most 0.1 % of the pixels differ by more than 24 of 255), none failing.
- In 7 of the 8 the difference is inside photographs: a block of a photograph whose pixels changed by a few of 255, with 1 to 10 of them just over 24 (at most 29). The page, its styles, the box of every element and the image files are the same. Which pictures show it changes between two runs of the same build (Construction, Studio and Photographer in one run; Photographer, Wedding, Trades, Sports club, Studio, Development and Construction in another), so it is how the browser draws a scaled photograph, not the build.
- One is not inside a photograph: Photographer's Zápisník at 390 pixels, 12 pixels at the lower edge of two handwritten captions (Caveat) on tilted cards, the same in three runs. The page's elements, their computed styles (pseudo-elements included), their boxes, the font files and the `@font-face` rules are the same as on `main`. The one app with Photographer alone draws it as on `main`; with all 20 designs it does not. The cause was not found.
- Calibration: every template's pictures from `main` were taken twice, and the two runs were identical to the pixel (376 of 376).
- Font files: every build used one download folder of @nuxt/fonts (each build's `node_modules/.cache/nuxt/fonts` pointed to the same folder). The builds of `main` downloaded the files; the one app's build downloaded none, so it used the same files. (Google can answer the same request with other files at another time, which alone made two builds of `main` differ by up to 0.16 % of the pixels in the pilot.) A family shared by several designs with different settings (the merged ones) gave the same pictures as before.
- No look needed a line of its own for a typeface. Blog's Čtvrthodinka and Trades' Mistr never read `--font-display` and `--font-cond`; their pictures are identical.
- A template's own build on this branch draws as on `main` too (the kit's look parts load lazily there as well): Blog, Development, Event and Office, 73 pictures, all identical.

**The numbers.** One machine (Apple silicon, 16 cores, 64 GB), Node 24, production builds, one build at a time. "Today" is the 20 templates each built on its own (build time and size: the sum of the 20 builds). For memory, five templates (Photographer, Wedding, Blog, Sports club, Development) ran as separate processes at the same time, each serving one site per look; the column for 20 is that average times 20, an estimate. "One app" carries all 20 designs in one process serving one site per look of all of them (52 sites).

| | Today: 20 templates | One app, 1 design | One app, 20 designs |
|---|---|---|---|
| Build, warm font cache | 16.5–17.2 s each, 5.6 min in all | 18.8 s | 34.7 s and 34.8 s |
| Build, cold | 17.0–19.5 s each, 6.1 min in all | 20.7 s | 44.9 s |
| Peak memory of a build | 4.0–4.6 GB each | 4.5–4.6 GB | 6.4–6.5 GB warm, 6.0 GB cold |
| `.output` | 55–57 MB each, 1 118 MB in all | 63 MB | 102 MB |
| Browser files (`_nuxt`) | 241–247 JS + 8–9 CSS each | 300 JS + 14 CSS | 1 372 JS + 63 CSS |
| Main stylesheet | 250–295 KB, 37–43 KB gzipped (with its looks) | 430 KB, 63 KB gzipped | 430 KB, 63 KB gzipped (no looks) |
| Process answers after start | 1.0–1.2 s each | | 1.1 s |
| Memory 30 s after start | 300–302 MB each; about 6.0 GB for 20 | | 507 MB |
| Memory after the warm-up | 581–671 MB each (604 MB on average); about 12.1 GB for 20 | | 1 443 MB |
| Memory 60 s later | 263–671 MB each | | 1 443 MB |
| First answer of a site after start | 212–247 ms for each template's first site, 67–126 ms for the others | | 284 ms for the first site; 126–219 ms (161 ms in the middle) for the first site of each other design; 92–165 ms for the rest |
| Home page, 200 in a row (median / 95th percentile, middle of the 14 looks measured both ways) | 56 ms / 63 ms | | 46 ms / 52 ms |
| Development server, first page | 8.4–9.5 s (Photographer) | 8.8–9.1 s | 9.3–10.1 s |

The warm-up was, for every site, 50 rounds of its home page, its entry pages, a missing address, `/sitemap.xml`, `/robots.txt` and `/admin/login`. Each further design added about 45 MB to the one process, its two or three sites included (28 MB in the pilot's measurement with three designs). Sites use memory of their own too; a process with hundreds of sites needs its own measurement.

What a visitor downloads for a look's home page with an empty cache (pictures left out, gzipped), on average over the 14 looks measured both ways: the HTML 35 → 31 KB (no design's `@font-face` rules in it), the stylesheets 1 file of 40 KB → 3 files of 67 KB (the main stylesheet with every design's utilities, the look's own file, and a small one), the scripts about the same (293 → 292 KB), the typefaces exactly the same files. In all 561 → 583 KB, 4 % more, nearly all of it the bigger main stylesheet. (In the pilot with three designs a page was 12 KB smaller; the main stylesheet has grown by 22 KB since.)

**Against the plan's rules.**

- CSS: the main stylesheet with all 20 designs is 20 to 26 KB gzipped more than a template's own today, under the limit of 40 KB. One stylesheet stays.
- Memory: the rule was written for three designs (at most 1.3 times one template); the pilot met it with 1.2. With 20 designs the one process needs 1 443 MB after the warm-up: 2.4 times one template's 604 MB, and about an eighth of the 12 GB that 20 template processes need. It grows by about 45 MB per design. That passes in the sense the rule was meant (one app must not cost more than the processes it replaces); it is not 1.3 times one template, and a size for the cloud's process has to be chosen with it.
- Build: 35 s warm and 45 s cold for all 20 designs, far under 10 minutes, against 5.6 minutes for the 20 templates' own builds. A build needs 6.5 GB of memory at its peak, 2 GB more than a template's.

**Not done yet.**

- (Done in 2.18.) The cloud still runs each template's own build. The local driver starts a template's server for one site in single mode; the one app runs in multi-tenant mode only, so the driver (or a new one) must write a directory row with the site's `model`, as the shared driver does. `templates:build`, `pictures --real` and `e2e --templates` work with the templates' own builds; the pictures above were taken with `templates/app/scripts/shots.mjs`.
- After the cloud has switched: the templates' own `nuxt.config.ts`, `main.css` and build scripts go, and so does the kit's way of building one template.

**Moving a template** (`<id>`), from the repository's root (how all 17 were moved):

1. `node templates/app/scripts/relative-imports.mjs <id>`
2. Move the `fonts` families of `templates/<id>/nuxt.config.ts` into `templates/<id>/fonts.ts` (without `global`) and set `fonts: ownFonts(designFonts)` in `nuxt.config.ts`.
3. `node templates/app/scripts/theme-diff.mjs <id> --write`, then add its `design.css` `@import` and an `@source "../../../../<id>";` line to `templates/app/app/assets/css/main.css`. If the script lists a look under d (it reads a web-font token of its template without setting it), add the line it names to that look's stylesheet; no template needs one today.
4. Add the design to `templates/app/designs.ts` and the model to `templates/app/cms.config.ts`, in the order of `cloud/scripts/lib.mjs`.
5. Set the template's `typecheck` script to `node ../kit/scripts/typecheck.mjs && node ../app/scripts/typecheck.mjs <id>` and run it.
6. Build both, take the pictures of both with `shots.mjs` (the same `--now`, seeded on the same day) and compare them with `compare-shots.mjs`.

## 2.18 What is built: the cloud runs the one app

Built on the branch `feat/one-app`, local only: nothing is released or deployed, and nothing changed on Pushbase or on the account service that is live. `packages/cms` did not change.

**An app serves a set of templates.** `cloud/shared/templates.ts` lists the apps (`APPS`), and each template names the app that serves it:

| App | Folder | Templates | Its site's row |
|---|---|---|---|
| `templates` | `templates/app`, the one app | the 20 hosted templates | `model: '<template id>'` |
| `basic` | `packages/cms/starter` | the Basic website | no `model` (the app has a model of its own) |

The Basic website is not in the one app: it is not built on the template kit, and it ships in the npm package. It stays an app of its own, and the code has one path for both: everything that was per template is per app.

**The shared driver** starts one process per app: one for all 20 templates, one for the Basic website. Its folder is `<data>/<app id>/` (`app.json`, `sites.json`, `server.log`, a folder per site), its marker argument is `--app-dir=<folder>`, and its port is one per app. Each site keeps its own database and its own database user, as before. A site's row carries `model` for an app that has several.

**The directory in Postgres.** The column `template` of `tenant_sites` now holds the **app's** id, and an app's process reads its rows with `NUXT_CMS_TENANCY_TEMPLATE=<app id>`. This is the smallest change: the column and the variable stay, only what they name changes, and the site's template is in its row (`model`). The reader is one per app (`<prefix>_reader_<app id>`). Until now a reader could `SELECT` every row of the table, of every template (the secrets in them are encrypted, but every process holds the key); the process only asked for its own. Now row-level security limits each reader to its own app's rows: the driver turns it on for the table and gives each reader a policy of its own (`template = '<app id>'`). The cloud's own user owns the table and is not limited, so it must be the user that runs the cloud's migrations.

**The local driver** (one process per site, for development) could not run a hosted template any more: the one app has no model of its own, so it does not run in single mode. Every site, of either app, now runs in multi-tenant mode with a site directory of that one site, `sites.json` in the site's folder (mode 0600, written before every start). The row lists `127.0.0.1` as another host name of the site, because the cloud reaches a local site at `http://127.0.0.1:<port>`. The rest of what the driver promises stays: a process, a port, a database `tzc_<slug>` and a folder per site, and the same addresses.

**The build.** `templates:build` builds the two apps one after the other, not 21 apps. With names (`templates:build photographer,wedding`) it builds the one app with only those designs (`TZ_DESIGNS`), which is quicker. The build writes which designs it holds into `templates/app/.output/tinyzoo-designs.json`; both drivers refuse a site of a template that is not in it, with the command that builds it. The whole build took 49.6 s on this machine (the one app and the starter, warm font cache), with the 15 expected warnings about looks that lack some parts.

**Fonts are kept between builds.** @nuxt/fonts keeps what it downloads in `node_modules/.cache/nuxt/fonts/` of the app it builds: Google's answers for a week, the font files without end. `templates:build` makes that folder of both apps a link to one folder that stays: `node_modules/.cache/tinyzoo-fonts` of the repository, or `TZ_FONTS_CACHE`. Whatever an app's own folder held is copied into it first. The first build after the change downloaded no font: every file was in the folder already. A build machine must keep that folder from one build to the next (a cache mount, with `TZ_FONTS_CACHE` pointing at it); without it every build downloads the fonts again and may get other files.

**What only makes sense now, checked** (`e2e:shared`, `e2e:ops`): two sites of different templates (Photographer and Wedding) are served by the same process, on the same port; each has its own database and user (refused on the other's), only its own model's tables and its own model's migrations; each page carries `data-design` of its own template and exactly one look stylesheet, its own look's, after the main one; a collection of one template answers 404 on a site of the other, for reading and for writing, in the content API and in the admin's; Wedding's `POST /api/gift/:id/reserve` answers 404 on a Photographer site and on a Basic site and changes nothing; the Basic site is served by the other process; deleting a site leaves the rows, databases, sessions and content of the others as they were. With the directory in Postgres, the `templates` reader sees exactly the two kit sites' rows and none of Basic's, and the `basic` reader only its own.

**What the platform in front must provide now** (in place of 2.14's "one long-running process per template"):

1. **Two long-running processes**, not one per template: the one app for all hosted templates, and the Basic website's app. Each is started with the directory's address and key, restarted on a release, and has the health routes that need no site (`/api/health/live`, `/api/health/ready`). The one app with one site of each of its 52 looks held 1 443 MB after a warm-up (2.17); `e2e:shared` measured 722 MB with three sites just made, and 366 MB for the Basic website's process with one.
2. **Routing by host** to the process of the site's app: every service address and every verified domain of a hosted template goes to the one app's process, those of a Basic website to the other. The host name alone does not say which; the platform needs the site's app from the cloud (the site's row, or a list the cloud gives it). One process for every site would need the Basic website in the one app.
3. **A build machine with about 6.5 GB of memory** for the one app's build (it peaks there), and the kept font folder above. The build of both apps takes under a minute.
4. Everything else of 2.14 stays: the certificates, a storage key per site, `postgres:close` once per server.

**Checks run** (Postgres 16 of its own, one build at a time; the numbers are this run's): the cloud's unit specs (10 files, 183 tests), the specs of the designs and of module state, the cloud's type-check and the repository's, the build; `e2e:shared` 120 checks in 31 s; `e2e:ops` 178 checks in 49 s (its last part, `postgres:close`, needs a Postgres server of its own and was left out); `e2e:account` 163 checks in 17 s; `e2e:signin` 88 checks in 75 s; `e2e` (the local driver) with all 20 hosted templates in every look and palette, 676 checks; the whole `e2e` (Basic websites, the wizard, Photographer's own section, then all 20 templates), 750 checks, each site made in 1.7 to 2.2 s; `pictures --real` for Basic, Photographer and Wedding (the files were compared and put back: 24 of the 28 pictures came out the same to the byte; Wedding's Večer and Magazín card and thumb pictures differed, by 3 of 255 on average, and the cause was not found); `walkthrough --quick`.

**Left open.**

- Whether to remove the templates' own builds (their `nuxt.config.ts`, `main.css`, build scripts and the kit's way of building one template). The cloud no longer uses them. A website that moves out of shared hosting is run by `e2e:ops` on the one app with a site directory of that one site, as the local driver runs a site; whether a customer gets that, or a template's own build, is not decided.
- Sites made with the shared driver before this change (per-template folders and rows) are not carried over. No such site exists outside development machines.
- Basic websites in the one app, which would leave one process for every site.
