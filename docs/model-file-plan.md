# The developer's side: the detailed design of step 3

**Status (2026-11-25):** the design, written before the build. It is step 3 of `docs/one-app-plan.md` and builds on step 2 (`docs/custom-types-plan.md`), which is on `main` and not released yet. Every claim about the code names its file. Nothing here is built until section 13 says so. The points marked **(owner)** are decisions that are the owner's; each has my pick and the other choices.

**Words.** As in the two plans. New here: the *model file* is a site's own content types written into a file in git. A *registration* is a model file that some running code told the site it was compiled against. A *promise* is what such a file says the content API returns. A model *fits* a registration when it still keeps that promise.

---

## 1. The short read

1. **The model file is `cms.model.json`,** beside `cms.config.ts`. It holds the site's visible custom types, in the format the site stores, and the version of the site it was read at. Removed things are not in it.
2. **Four commands.** `tinyzoo model pull` writes the file from a site. `tinyzoo model push` sends what you changed in the file to the site, through the structure function (`cmsChangeModel`). `tinyzoo model check` is for CI. `tinyzoo model register` tells a site which file a separate frontend was built against.
3. **Types need no network.** `tinyzoo client` reads `cms.model.json` when it is there and writes the custom types into the same generated file as the code-first ones. The same file in git gives the same types every time.
4. **A registration is a lock.** The site keeps each registered file in its own database. A change of structure that would break a registration's promise is refused with 409, and the answer names the registration and what would break. An administrator can remove a registration by hand; that is the way to force a change, and it is logged.
5. **"Fits" is one comparison,** made with the same code that generates the types (`src/content-shape.ts`): every type and field the file knows is still there, of the same kind, and a field that never was empty cannot become empty. Additions always fit. So do new choices of a choice field (section 6 says what that costs).
6. **A single-site app gets the switch.** `NUXT_CMS_CUSTOM_TYPES=on` then works without multi-tenant mode. What stood in the way (a single site's memory lives as long as the process) is solved the way the plan said: with the switch on, the single site's requests are counted like a multi-tenant site's, so its memory can be replaced. With the switch off, not one line runs differently.
7. **A single-site app registers itself.** The build carries its `cms.model.json`; the server registers it when it starts. No token and no command.
8. **Outside callers use a personal access token** with a new right, *Content types*, which only an administrator can give. It reads the model, changes it and registers code. It never deletes for good.

**What differs from the plan.**

| The plan said | What holds |
|---|---|
| CI fails when the live model differs from the file (2.7, step 3) | CI fails when the file no longer *fits* the site: when code built from it would break. An owner who changes a label or adds a field must not turn a developer's CI red. The command says what the site has more, and `--strict` fails on any difference |
| An owner can force a change after being shown what it breaks (2.7, "left open") | There is no force on a change. The owner removes the registration first, in the admin, and then changes what they want. One act, with a name in the audit log, instead of a flag on every change |
| `pull` brings the local database to the same shape (2.7, step 1) | The local server does it when it starts, on request (`NUXT_CMS_MODEL_FILE=follow`), through the structure function. It only adds; it never removes. The CLI changes no database |
| `push` sends a changed file (part 1, step 3) | `push` sends *your changes*: the difference between the file and the version it was pulled at. What the owner changed on the site since then stays. Sending the whole file would hide a type the owner added yesterday |
| A snapshot is "registered on deploy" (2.6) | Two ways, one function: a single-site app registers itself at start; a separate frontend runs `tinyzoo model register` in its deploy |

## 2. Who this is for

| Who | What they have | What step 3 gives |
|---|---|---|
| A developer of a single-site app (a client's website with tinyzoo inside) | `cms.config.ts` in code. The client wants to add simple collections without a release | The switch; the model file; types; the app registers itself, so the client cannot remove what the pages read |
| A developer of a separate frontend that reads a hosted site | A site in the shared app, a frontend somewhere else | `pull`, `check`, `register` with a token. Its types come from the site (section 5) |
| The owner | The structure editor of step 2 | A refusal that names the code which reads a field, and a list of registered code with a way to remove one |

The designs of the shared app need nothing here: they read the design's part of the model, which cannot change at run time.

## 3. The model file

**Name and place.** `cms.model.json`, in the app's root, beside `cms.config.ts`. JSON, because it is data the site writes and a person reads in a diff.

```json
{
  "format": 1,
  "site": "https://kurzy.example",
  "version": 7,
  "types": [
    {
      "name": "custom_course",
      "label": { "cs": "Kurzy", "en": "Courses" },
      "labelSingular": { "cs": "Kurz", "en": "Course" },
      "icon": "i-lucide-graduation-cap",
      "titleField": "title",
      "page": { "prefix": "kurzy", "image": "cover", "summary": "perex" },
      "publish": true,
      "order": { "by": "startsAt", "dir": "asc" },
      "fields": [
        { "key": "title", "type": "text", "label": { "cs": "Název", "en": "Title" }, "required": true },
        { "key": "perex", "type": "text", "long": true, "label": { "cs": "Krátký popis" } },
        { "key": "startsAt", "type": "datetime", "label": { "cs": "Začátek" } },
        { "key": "level", "type": "select", "label": { "cs": "Úroveň" },
          "options": [
            { "value": "beginner", "label": { "cs": "Začátečníci" } },
            { "value": "advanced", "label": { "cs": "Pokročilí" } }
          ] },
        { "key": "cover", "type": "media", "label": { "cs": "Obrázek" } }
      ]
    }
  ]
}
```

- `types` is the stored document of step 2 (`ModelDoc`, `src/model-doc.ts`) with the removed types and fields left out, and without `removedAt` and `removedEmpty`. A removed choice stays, marked `removed`: an entry can still hold it, so the types must know it.
- `version` is the version of the site's model the file was read at. `push` needs it (section 4).
- `site` is the address the file came from, so later commands need no address. `--url` and `TINYZOO_MODEL_URL` go before it.
- **One way to write it.** Keys come in a fixed order, values that are empty or `false` are left out, two spaces, a newline at the end. The site and the CLI write a file with the same function, so two pulls of the same model give the same bytes.
- **Reading it** is strict: an unknown key or a `removedAt` is refused, with the place.
- A file larger than the document's limit (256 KB) is refused.

**In the core** (`src/model-file.ts`, pure): `modelFileOf(doc, { version, site })`, `parseModelFile(value)`, `modelFileDoc(file)` (the document a file stands for), `writeModelFile(file)` (the text), `diffModelFile(base, next)` (the operations that lead from one to the other, or the reasons there are none) and `describeModelOps(ops)` (one plain line per operation, for the CLI).

**What a difference becomes.**

| In the file | The operation |
|---|---|
| A new type | `type.add` with its `name`, then a `field.add` for each field but the title |
| A type left out | `type.remove`: it is hidden, with its content, and can be restored in the admin |
| A new field | `field.add` with its `key`, after the field before it |
| A field left out | `field.remove`: hidden, restorable |
| A label, help text, icon, the list's columns, the order, the page's picture or summary | `type.update` or `field.update` |
| `required`, `long`, `format`, `min`, `max`, `allDay`, a default | `field.update` |
| A new choice, a choice's label, a choice marked `removed` or no longer marked | `field.update` with `addOptions`, `optionLabels`, `removeOptions`, `restoreOptions` |
| The fields in another order | `field.order` |
| A changed `name`, `key`, kind of field, `decimal`, relation target, page address, `publish`, pages on or off | Refused before anything is sent, with the sentence step 2 uses: it cannot be changed after it is made. (A changed `key` reads as "remove one field, add another", and that is what the CLI says it will do) |
| The types in another order | Nothing: the order of types is not something the model keeps |

The site is the judge of every operation. The CLI only writes them down.

## 4. The commands

All four read the token from `TINYZOO_TOKEN`, never from a flag. All four answer with exit code 0 when all is well, 1 when something needs a person, 2 when the command was used wrongly.

### `tinyzoo model pull`

1. Reads the site's model file (`GET /api/cms/_model/file`).
2. When `cms.model.json` exists and holds changes that are not on the site, it stops: "your file has changes the site does not have: push them, or `--force` to drop them". It knows this by asking the site for the file at the version the local file names. When the site no longer keeps that version (it keeps 200), it cannot tell, and stops the same way.
3. Writes the file and says what changed, one line per difference.
4. With no `cms.config.ts` in the folder (a separate frontend), `--types <file>` also saves the site's generated types (`GET /api/content-types.ts`), so that project has types in git without a build of tinyzoo.

### `tinyzoo model push`

1. Reads the file. Asks the site for the file at the version the local file names (the *base*) and for the current one.
2. The operations are the difference between the base and the local file: only what the developer changed.
3. Sends them as a dry run against the site's current version and prints the plan: each operation in a line, how many statements, and what the site made safe on the way. A refusal is printed as the site gave it: the places a field is shown, the registration it would break.
4. Asks (in a terminal) or takes `--yes`, then sends them for real. When the site changed in that moment, it starts again once.
5. Writes the file again from the site, so it now holds the owner's changes and the developer's.

`--dry-run` stops after step 3. A push can hide a type or a field; it can never delete one for good.

### `tinyzoo model check`

For CI. In this order:

1. The file reads. With a `cms.config.ts`: its types build over the app's code-first model with nothing left out (a relation that points at a collection the code no longer has is caught here, before a deploy).
2. The file fits the site (`POST /api/cms/_model/fit`). When not, it prints what the code expects and the site no longer has, and exits 1.
3. When the site has more than the file (a new field, another label), it says so and exits 0. `--strict` exits 1 on any difference.

`--offline` runs step 1 only. The type check itself is the project's own, after `tinyzoo client --check`:

```sh
tinyzoo model check      # the file is valid and the site still keeps what it says
tinyzoo client --check   # the generated types are what the file and the config give
nuxt typecheck           # every line of code fits them
```

`tinyzoo client --check` is new: it writes nothing and exits 1 when the generated file on disk is not what it would write.

### `tinyzoo model register`

For a separate frontend, in its deploy: `tinyzoo model register --name web`. It registers the file under that name (section 6). When the file does not fit the site, it is refused and the deploy fails. `--remove` takes a registration away.

## 5. Types

`tinyzoo client` and `tinyzoo openapi` look for `cms.model.json` in the folder (`--model <file>` names another, `--no-model` ignores it). With a file, its types are built by the mapper of step 2 (`modelEntities`, `src/model-map.ts`) over what `cms.config.ts` exports, and the generated file holds `CustomCourse` beside the code-first types, through the generator that exists (`emitContentTypes`, `src/sdk.ts`). Without a file the output is byte for byte what it is today.

So the types of a custom type come from the same path as the site's own: the site builds its entities from the stored document with the same mapper, and serves the same generator's output at `/api/content-types.ts`. A test holds the two equal: the types generated from a pulled file equal the types the site serves.

**A choice field of a custom type is typed open:** `'beginner' | 'advanced' | (string & {})`. The editor still completes the known values, and the type says the truth: an owner may add a choice at any time (section 6). The OpenAPI document says the same (a string, with the known values named). Code-first choice fields are closed unions as before. Step 2 is not released, so no generated file in use changes.

## 6. Registrations: the lock

**What is stored.** A table in the site's own database, made the first time something registers, as `cms_model` is:

```sql
CREATE TABLE IF NOT EXISTS cms_model_code (
  name       text PRIMARY KEY,           -- 'app', 'web'
  file       jsonb NOT NULL,             -- the model file as it was registered
  version    integer NOT NULL,           -- the site's version when it registered
  source     text NOT NULL,              -- 'app' (the site's own build) or 'token'
  user_id    uuid,
  created_at timestamptz(3) NOT NULL DEFAULT now(),
  updated_at timestamptz(3) NOT NULL DEFAULT now()
)
```

A name is 1 to 40 characters of `a-z`, `0-9` and `-`. A site keeps at most 10. Registering under a name that exists replaces it: the new build is what runs now.

**What a file promises.** The file's types are built over the design's model, and `buildContentModel` (`src/content-shape.ts`) gives what the content API returns for them. That description is the promise. The live model is described the same way, and the two are compared:

| The file knows | The live model must |
|---|---|
| A type | Have it, visible |
| A field of a type | Have it, visible, of the same kind |
| A field that is never empty | Still never be empty. (Required turning optional breaks code that expects a value. So does a text turning into a link, which can come back empty) |
| A field that may be empty | Anything: a value where empty was allowed is fine |
| A relation | Point at the same collection |
| A way to sort or filter a list | Still offer it |
| A choice field's values | Nothing: new choices fit (section 5) |

Everything the file does not know fits: a new type, a new field. A registration stores the file, not the comparison's result, so both sides are always described by the same version of tinyzoo.

**Where it is checked.** In the structure function, inside its transaction, after the operations are applied and before any statement runs. For each registration it asks what does not fit *before* the change and what would not fit *after* it. Only something new is a refusal:

```json
409 { "code": "breaks-code",
      "message": "Code that runs against this site reads what this change would take away. Update that code first, or remove its registration",
      "registrations": [{ "name": "app", "registeredAt": "2026-11-25T10:00:00.000Z",
                          "breaks": [{ "type": "custom_course", "field": "perex", "why": "removed" }] }] }
```

Comparing before and after makes every case one rule. A registration that already does not fit does not freeze the site: only what makes it worse is refused. The server's own deletion of things removed empty takes nothing a registration could still have: such a thing was removed, and removing it was already refused or already allowed.

**What it costs.** Building the description of a model takes under a millisecond for a site of a few types (step 2 measured 0.6 ms for the registry). It runs only when the site has a registration.

**Registering** (`cmsRegisterCode` in a new `server/utils/cmsModelCode.ts`) takes the same lock as a change, so a change and a registration cannot pass each other. It reads the current model and compares. When the file does not fit: refused with 409 `does-not-fit` and the list, unless the caller is the site's own build, which registers anyway (its code is running whether it fits or not) and says so in the log. The admin then shows that registration with what it lacks.

**Removing a registration.** An administrator, in the admin or with a token: `DELETE /api/cms/_model/code/<name>`. The audit log gets a line with the name and who did it. This is the owner's way to force a change, and it is honest about what it does: "the website's code will no longer be asked before a change".

**What is not covered,** as the plan said: somebody changing the database by hand, and a program that never registered.

## 7. Who may call, and the routes

**(owner) The credential.** My pick: a personal access token (`tzp_…`, `server/utils/cmsAccessTokens.ts`) with a new right, `model` ("Content types"). Only an administrator can give it to a token, and it works only while that person is an administrator. Today a token is taken at `/api/mcp` and nowhere else; the routes below become the second place, for a token with this right only. Such a token cannot delete for good (`purge` stays a person's act in the admin). The other choices: one secret per site in its settings (simple, but nobody's name stands in the history, and a hosted owner cannot set it), or a person's e-mail and password as `tinyzoo seed` takes them (no secret a CI should hold).

**The routes.** All answer 404 when the feature is off for the site. All take an administrator's session, or a token with the right.

| Route | |
|---|---|
| `GET /api/cms/_model/file` | the model file of the site now. `?version=N`: as it was at that version, or 404 when it is no longer kept |
| `POST /api/cms/_model` | as in step 2: `{ baseVersion, ops, dryRun? }`. New: it takes a token |
| `POST /api/cms/_model/fit` | `{ file }` → `{ version, fits, breaks }`: would code built from this file work against the site now? Changes nothing |
| `GET /api/cms/_model/code` | the registrations: name, when, by whom, how many types, and what each lacks now |
| `PUT /api/cms/_model/code/<name>` | `{ file }`: register |
| `DELETE /api/cms/_model/code/<name>` | remove a registration |

The audit log gets `model.code.register` and `model.code.remove`. A change made with a token is a `model.change` like any other, with the token's id beside the person.

## 8. The admin

Small, and in the editor that exists (`app/pages/admin/_model`).

- **The refusal.** When a change is refused with `breaks-code`, the dialog says which code reads the thing and since when, in the words of the other refusals: "The website's code reads this field (registered as *app* on 25 November). Its developer has to update the code first." Under it, for an administrator, one quiet link to the list below.
- **The list.** On the first screen of *Content types*, a section "Code that reads these types" (Czech "Kód, který tyto typy čte", German "Code, der diese Typen liest"), shown only when there is a registration: one row each, with its name, when it registered and how many types it reads. A row that lacks something says what. One action per row: *Remove*, behind a confirm dialog that says what it means.
- **The token.** The token dialog (`CmsTokenRights.vue`) gets one more tick, "Content types", shown to administrators on a site with the feature.

The look is the admin's own: `.cms-card`, `CmsConfirmDialog`, no colour bar on a left edge, usable at 390 pixels. Texts in Czech, English and German.

## 9. The single-site switch

**(owner) Whether it belongs to this step.** My pick: yes, as the last part. Without it the developer's flow has one user, a separate frontend of a hosted site, and no such frontend exists yet. With it, a client's website can let its owner add collections, and the developer keeps types and a lock. It is also the part with the most risk, because it touches how a single site holds its memory. So it is built last, in commits of its own, and the parts before it stand without it.

**What stands in the way.** In single mode everything a site keeps in memory lives in one object for the process's life (`SINGLE_INSTANCE` in `server/utils/cmsSite.ts`), and requests are not counted. A change of structure must give the site a fresh memory while requests under way finish with the old one (section 4 of the step 2 design says why swapping in place is wrong).

**The design: the single site becomes countable when the switch is on.**

- `cmsSite.ts` gets one question, "is this site's work counted?": yes in multi-tenant mode, and in single mode when `NUXT_CMS_CUSTOM_TYPES=on`. Every shortcut that says "single mode: do nothing" (`runInCmsSite`, `bindToCmsSite`, `forEachCmsSite`, `cmsPeekInSite`, `cmsHoldSiteUntil`, `cmsRetireCurrentSite`, the checks bound to an instance) asks that question instead. The single site then has an instance that can be retired and made again, as a multi-tenant site has. `useCmsSite()` still answers the one site, with its settings from the environment.
- With the switch off the answer is "no" and the code path is today's, to the line.
- **Requests.** `server/plugins/cms-0-site.ts` wraps the handler for a counted single site too: the request runs inside the current instance and holds it until it has finished, with `event.waitUntil` work. It does nothing about hosts: that stays single mode's.
- **The gates.** Pages and API requests wait for `cmsSiteReady()`, which reads the site's own types once per instance, as in multi-tenant mode. `cmsModel.ts` and `cmsCustomTypes.ts` stop asking for multi-tenant mode and ask whether the site is counted.
- **Sockets** (`cmsSocketSite.ts`) run their hooks inside the instance. The live hub tells its sockets to reconnect when its instance is retired, and the shared-editing engine stores what is pending and starts again, as they do in multi-tenant mode.
- **Start-up work** (`onCmsSiteStart`: migrations, the search index, the setup code) runs once per instance, not once per process. That is what rebuilds the search index after a change of structure.
- **Background work** (the scheduled tasks) runs through `forEachCmsSite`, so it holds its instance until it has finished.
- **Two instances of one app** with a shared store: the `model` channel carries the change, as in multi-tenant mode.
- **The limits** are the defaults (12 types, 30 fields, 30 choices). A single site has no directory row to set its own.

**Every branch on the mode is looked at once,** and put into one of two groups. The build's first task for this part is that list, in this document.

| Group | Follows the switch | Examples (from `grep cmsIsMultiTenant`: 55 places in 30 files) |
|---|---|---|
| How an instance lives | Yes | the request wrapper, the sockets, loading the model, the live hub's stop, the shared-editing engine's stop, start-up work, the tasks |
| What makes many sites safe from each other | No, stays as single mode has it | host names, the session's proof, keys in the shared store, the storage folder rule, the demo account, the sign-in origin rule, the operator's route |

**The build carries the model file.** `module.ts` looks for `cms.model.json` in the app's root and, when it is there, puts it into the server build. No module option is added. At start, a counted single site:

1. with `NUXT_CMS_MODEL_FILE=follow`: adds to its database what the file has and the database lacks, through the structure function. It never removes, so a database that has more keeps it. This is for a developer's own machine and for a CI database: after `pull`, the local site has the live structure.
2. registers the file as the registration `app` (the name can be set with `NUXT_CMS_MODEL_CODE`). When the file does not fit, it registers anyway and logs what the code expects and the site lacks.

`NUXT_CMS_MODEL_FILE=off` ignores the file. In multi-tenant mode a build's own model file is ignored: one build serves many sites.

**Two things a single-site app must know.**

- A custom type may point at a code-first collection. When a later release of the code removes that collection, its migration fails on the custom table's foreign key. `tinyzoo model check` catches it before the deploy (step 1 of the check).
- The generic blocks of step 2 are drawn by the template kit. A single-site app shows its custom types with its own components, written against the generated types. That is what this step is for.

## 10. Isolation

Nothing new is shared between sites.

- A registration lives in the site's own database and is read inside the change's transaction, from that database. Nothing of it is kept in memory.
- A token belongs to a person of one site and is looked up in that site's database.
- The routes act on the current site only.
- A single-site app has one site.

Tested with two sites in one process (the harness of `test/api/tenants-custom.spec.ts`): a registration on A refuses nothing on B; A's file, registrations and tokens answer 404 or 401 on B.

## 11. What is tested, and how

**Unit** (`test/unit`, no database):

- The file: what is written reads back the same; two documents that differ only in removed things give the same file; an unknown key and a `removedAt` are refused.
- The difference: for every kind of change in section 3's table, the operations; applied to the base with `applyModelOps`, they give the other file. The same for a few hundred random pairs of models. Every change that cannot be made is refused with its reason.
- The fit: each row of section 6's table, both ways (what breaks, what fits); "only something new is a refusal".
- The types: a file's types equal the types of the same model written in code, except the open choice.
- The CLI's usage text (`test/contracts/cli-usage.txt` grows by the new commands).

**With a server and a database** (`test/api`, on a Postgres of its own):

- `model-file.spec.ts`, multi-tenant, two sites: pull gives the file; a push of a changed file changes the site and nothing else; a push after the owner changed the site keeps both; a registration refuses the removal of a field it reads and names itself; removing the registration lets the removal through; a new field and a new choice pass a registration; a token without the right, an editor's token and a token on the other site are refused; a token cannot purge; with the switch off every route is 404.
- `single-custom.spec.ts`, single mode with the switch: a type made over the API is served by the next request; a request under way during the change ends well with the model it started with; the search finds an entry of a new type; a live socket is told to reconnect; the app's own file is registered at start, and `follow` adds what is missing and removes nothing.
- The CLI against a running site: `pull`, `push --dry-run`, `push`, `check` (fits, does not fit, `--strict`), `register`, and `client` with a file.
- The generated types of a pulled file equal `/api/content-types.ts` of the site.

**Leaks put in on purpose,** one at a time in a temporary build, each of which must fail a suite: the fit check skipped for one kind of operation; the registrations read once and kept for the process; a token with the right accepted for `purge`; the single site's memory swapped without retiring its instance (a request under way then sees two models).

**Unchanged and still green:** `test/unit/module-state.spec.ts` (unweakened), the contracts in `test/contracts`, the single-site API suites with the switch off, `tenants-custom.spec.ts`.

## 12. Order of work

Each part ends with its own tests green and is useful without the next.

1. **The core** (`src/model-file.ts`, `src/model-fit.ts`, the open choice in `content-shape.ts`, `sdk.ts` and `openapi.ts`). *Useful alone: nothing yet; it is what the rest stands on.*
2. **The server**: the token's right, the routes, the registrations and the check inside the structure function, `model-file.spec.ts`. *Useful alone: a script can read a site's model, change it and lock it.*
3. **The CLI**: the four commands, `client` and `openapi` with a file, `client --check`. *Useful alone: a separate frontend of a hosted site has the whole flow.*
4. **The admin**: the refusal's words, the list of registrations, the token's tick. *Useful alone: the owner sees why a change is refused and can decide.*
5. **The single-site switch**: the list of branches, the countable single site, the model file in the build, registration at start, `follow`, `single-custom.spec.ts`. *Useful alone: a client's website gets custom types with a typed frontend.*
6. **Around it**: the guide for developers, `docs/api-surface.md`, the contracts, the changeset.

## 13. What is built

Nothing yet.
