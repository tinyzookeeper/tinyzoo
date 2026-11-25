# The developer's side: the detailed design of step 3

**Status (2026-11-25):** the design, and since then the build: every part of section 12 is built on the branch `feat/model-file`, local only, not released (section 13). It is step 3 of `docs/one-app-plan.md` and builds on step 2 (`docs/custom-types-plan.md`), which was released as 1.15.0 while this was built. The design below is as it was written before the build, corrected where the build showed otherwise; section 13 records what is built. Every claim about the code names its file. The points marked **(owner)** are decisions that are the owner's; each has my pick and the other choices.

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
- `site` is the address the file came from, so later commands need no address. `--url` and `TINYZOO_MODEL_URL` go before it. In CI (`CI` set) the address is never taken from the file: the file is what a pull request wrote, and the token must not travel to an address somebody put there. CI sets `TINYZOO_MODEL_URL`.
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

**A choice field of a custom type is typed open:** `'beginner' | 'advanced' | (string & {})`. The editor still completes the known values, and the type says the truth: an owner may add a choice at any time (section 6). The OpenAPI document says the same (a string, with the known values named). Code-first choice fields are closed unions as before. Step 2 was released (1.15.0) with closed unions for custom types too, as an experimental feature that is off unless switched on; the changeset names the change.

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

**Every branch on the mode is looked at once,** and put into one of two groups. The list below is every line of `packages/cms/server` that asks for the mode (`cmsIsMultiTenant()` or `cmsTenancyMode()`, 72 branches: 48 in 30 files and 24 in `cmsSite.ts`, besides the two lines there that define the mode). Each was decided by reading the code. *Follows* means it now asks `cmsSiteCounted()` (or runs only for a counted site): a counted single site behaves there as a multi-tenant site does. *Stays* means single mode keeps its own answer whatever the switch. Line numbers are those of the commit before this part.

**In `cmsSite.ts`** (the shortcuts of single mode):

| Line | What it does | Group |
|---|---|---|
| 104, 108 | `cmsTenancyMode`, `cmsIsMultiTenant`: the mode, read once | (the definitions) |
| 129 `useCmsSite` | single: the one site, from the environment | Stays: it is the one site whatever its instance |
| 137 `currentCmsSite` | single: the one site, never null | Stays. So the request wrapper cannot use it to see a request made from inside a request: a new question, `cmsInSiteWork()`, says whether the caller runs inside an instance |
| 146 `cmsHoldSiteUntil` | single: does nothing | Follows |
| 158 `cmsSiteHasLeft` | multi only: the site left the directory | Stays: the one site never leaves (its instance is retired with `left: false`) |
| 162 `cmsSiteLeftCheck` | single: never left | Stays, for the same reason |
| 170 `cmsSiteQuietCheck` | single: never quiet | Stays: only the connection cap of many sites asks it |
| 211 `runInCmsSite` | single: calls the function | Follows |
| 216 `outsideCmsSite` | single: calls the function | Follows: process-wide work started in a request does not keep the instance alive |
| 227 `bindToCmsSite` | single: the callback as it is | Follows. Bound outside any instance, it binds the site's current one |
| 259 `cmsSiteScoped` | single: the one `SINGLE_INSTANCE` | Follows. Work outside any instance reads the site's current instance (`currentInstance` makes it) |
| 323 `cmsRetireCurrentSite` | single: does nothing | Follows |
| 330 `cmsRetireSite` | single: false | Follows |
| 339 `cmsSiteRetiredCheck` | single: never retired | Follows |
| 361 `cmsUnloadIdleSites` | single: unloads nothing | Stays: unloading gives memory back to other sites; the one site has none to give it to, and would only run its start-up work again |
| 446 `cmsSettings` | single: `runtimeConfig.cms` | Stays: the settings come from the environment |
| 709, 721, 748 | reading the directory, waiting for it, "is it loaded" | Stays: there is no directory |
| 758 `cmsSiteById`, 764 `cmsAllSites` | single: the one site | Stays |
| 782 `forEachCmsSite` | single: calls the function | Follows: background work runs in the instance and holds it until it has finished |
| 786 `forEachCmsSite` | single: a failure is thrown, not logged | Stays: the one site's task reports its own failure, as before |
| 806 `onCmsSiteStart` | single: runs the work now | Both. Counted: it still runs now, in the first instance, so a failed migration stops a production start as always; it is also kept, and runs again in each fresh instance |
| 812 `ensureCmsSiteStarted` | single: nothing to do | Follows |

`cmsPeekInSite` has no branch: it looks at the loaded instances, which a counted single site now has. `unloadAllCmsSites` has none either; the request wrapper of a counted single site calls it when the server closes.

**Elsewhere:**

| File:line | What it does | Group |
|---|---|---|
| `plugins/cms-0-site.ts:25` | the request wrapper of multi mode | Both. Counted single: a wrapper of its own (`countSingleSite`) runs each request inside the current instance, holds it with its `waitUntil` work, keeps a request made from inside a request in its caller's instance, runs the start-up work of a fresh instance, and makes pages wait for `cmsSiteReady()`. Hosts, states and the directory stay multi's |
| `utils/cmsSocketSite.ts:27` | a socket finds its site at the upgrade, every hook runs in it | Both. Counted single: every hook in the current instance, the first ones after the site's types are read. The host lookup stays multi's |
| `plugins/cms-changes.ts:17` | single: the shared-editing engine starts with the server | Both. Not counted: as before. Counted single: a start hook, so each fresh instance starts one (the old engine stops with its instance) |
| `utils/cmsCollabServer.ts:514` | an engine unloaded while starting is stopped once up | Follows: a counted single site can be unloaded too |
| `utils/cmsLive.ts:138` | a fresh hub asks the other instances who is here | Follows: a change of structure gives a counted single site a fresh hub |
| `utils/cmsLive.ts:363` | a hub with no socket stops itself | Stays: memory economy for many sites; the one hub runs on |
| `plugins/cms-model.ts:9` | single: an info line, the `model` channel not listened to | Follows: with the switch on the plugin listens in single mode too. The info line is gone; multi mode has a new one for a build's own model file |
| `utils/cmsModel.ts:51` | which design model: `default`, or the row's | Stays: where the model comes from |
| `utils/cmsModel.ts:71, 232, 250, 260, 269, 275` | the site's own types: laid over the design, loaded once per instance, waited for, read | Follow. `cmsSiteReady` of a counted single site also waits for the app's model file, once per process |
| `utils/cmsCustomTypes.ts:24` | the feature is on | Follows: on for a counted site with the switch; the one site has no row, so its limits are the defaults |
| `tasks/cms/scheduled.ts:14`, `tasks/cms/media-sizes.ts:15` | single: every site through `forEachCmsSite`; multi: only the due sites | Both. The branch stays single's (no memory of what is due); the work inside now waits for the site's types (`cmsAfterSiteReady`, at once when not counted), so a fresh instance does not announce over the design's types alone and move the last run past a custom type's entry |
| `tasks/cms/scheduled.ts:22`, `media-sizes.ts:23`, `retention.ts:18` | the shape of the task's result | Stays |
| `utils/cmsScheduler.ts:18` | multi: forget what is due after a change | Stays: single mode keeps no such memory |
| `utils/cmsMigrate.ts:55` | a failed migration: one site of many answers 503; single: exit in production | Stays. A fresh instance runs the migrations again (they find nothing to do); a failure there exits too, which is how a single site has always said it cannot serve |
| `utils/cmsMigrate.ts:96` | the log line of migrations | Stays |
| `utils/cmsDb.ts:13` | the database address: the row's, with the cap, or the environment's | Stays: where the database address comes from. The pool is per instance already, so a fresh instance has a fresh pool |
| `utils/cmsStore.ts:81` | keys in the shared store named by site | Stays |
| `utils/cmsChanges.ts:34, 39` | a channel message names its site; a received one is for that site | Stays. A single-mode message names no site and is the one site's: the `model` channel works with it |
| `utils/cmsSession.ts:97` | a session is bound to its site by a proof | Stays |
| `utils/cmsSession.ts:157` | the origin of a socket must be the site's host | Stays |
| `utils/cmsAuth.ts:132` | the session names its site | Stays |
| `utils/cmsAuth.ts:148`, `utils/cmsAccount.ts:72` | links in e-mails may use the request's origin outside production | Stays: the sign-in origin rule |
| `utils/cmsAccount.ts:140` | the account sign-in is bound to the site's secret | Stays |
| `utils/cmsOAuth.ts:26` | the MCP's address from the request when none is set | Stays |
| `utils/cmsDemo.ts:12` | the demo account | Stays |
| `utils/cmsStorage.ts:540, 545` | the storage folder rule; the warning about a local disk | Stays |
| `utils/cmsStorage.ts:581` | writes refused once the site left | Stays: the one site never leaves |
| `utils/cmsSetupCode.ts:70` | the setup code's log line names the site | Stays |
| `plugins/cms-0-config-check.ts:59, 68` | the database address is required; request origins refused | Stays |
| `plugins/cms-plugins.ts:13` | a build with no model of its own needs multi mode | Stays |
| `plugins/cms-logo-check.ts:10`, `plugins/cms-theme-notes.ts:7` | development checks of the one site at start | Stays |
| `plugins/cms-errors.ts:29` | an error report names its site | Stays |
| `middleware/cms-0-hosts.ts:8`, `middleware/cms-sitemap-address.ts:24` | old host names redirect; the sitemap needs an address | Stays |
| `api/health/sites.get.ts:18` | the operator's route | Stays |

In numbers: 26 branches follow the switch (11 in `cmsSite.ts`, 15 elsewhere, of which 6 are *both*: the part about an instance follows, the part about hosts or a task's shape stays), and 46 stay (13 in `cmsSite.ts`, 33 elsewhere). Without the switch every one of them takes the path it took before: each new question is `cmsSiteCounted()`, which is false exactly when the old one said "single".

**The build carries the model file.** `module.ts` looks for `cms.model.json` in the app's root and, when it is there, puts it into the server build. No module option is added. At start, a counted single site:

1. with `NUXT_CMS_MODEL_FILE=follow`: adds to its database what the file has and the database lacks, through the structure function. It never removes, so a database that has more keeps it. This is for a developer's own machine and for a CI database: after `pull`, the local site has the live structure.
2. registers the file as the registration `app` (the name can be set with `NUXT_CMS_MODEL_CODE`). When the file does not fit, it registers anyway and logs what the code expects and the site lacks.

`NUXT_CMS_MODEL_FILE=off` ignores the file. In multi-tenant mode a build's own model file is ignored: one build serves many sites.

**What the build changed in this section** (part 5; section 13 says what exists):

- *Start-up work* runs at boot as before (a failed migration still stops a production start) and again in each fresh instance, the first time it is used; not "once per instance instead of once per process". The shared-editing engine, which single mode starts with the server, became start-up work of a counted single site.
- *The app's model file* is taken in once per process, inside `cmsSiteReady()`: after the migrations and before the site's types are read, so no request is served before it. `follow` runs through `cmsChangeModelBeforeLoad` (the instance has not served yet, so it is not retired) and tells the other instances, which may have served the older model.
- *The scheduled tasks* of a single site also wait for the site's types (`cmsAfterSiteReady`). Running through `forEachCmsSite` holds the instance, but a fresh instance would otherwise announce over the design's types alone and move the last run past an entry of a custom type.
- *The request wrapper* needs its own question: `currentCmsSite()` always answers the one site in single mode, so it cannot tell a request made from inside a request. `cmsInSiteWork()` does.
- A file that is the one registered already (same text, source `app`) is not registered again at a restart: nothing is written, so the audit log gets no line per restart. What the site lacks of it is logged again.

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

**Part 1, the core** (`src/model-file.ts`, `src/model-fit.ts`, the open choice in `content-shape.ts`, `sdk.ts`, `openapi.ts`; exported from `tinyzoo` as `@internal`; tests in `test/unit/model-file.spec.ts`, `model-fit.spec.ts`, `model-types.spec.ts`). What it adds to the design above:

- `parseModelFile` refuses with the code `invalid-file` only; a broken rule of the document keeps `parseModelDoc`'s message.
- `diffModelFile` also refuses, as `not-changeable`: a choice deleted or moved (choices are only ever added at the end or marked removed), a new type whose title field is not `title` (`type.add` always makes that one), and a type arranged by hand going back to an order by a field.
- A type or field that the base file does not have is always a `type.add` or `field.add`, also when the site keeps a removed one of that name: the site then refuses it (`name-taken`), and the owner restores it in the admin. The same for a new type that takes the page address of a removed one (`prefix-taken`).
- The file keeps the types in the document's order, but the difference does not: a type added by a push comes last.
- `customModelConfig(design, doc)` is the one way to lay a site's own types over its design (`custom:<name>` keys), for the CLI now and for the server's `readCustomPart` in part 2.
- An open choice is `open: true` on the scalar kind of `ContentFieldType` and on `FilterParam`, decided by the entity (a `custom_` name, and not its publish field), not by the field's `meta`. In OpenAPI it is `{ type: 'string', examples: [...] }`.

**Part 2, the server** (`server/utils/cmsModelCode.ts`, the check in `cmsModelChange.ts`, the token's right in `cmsAccessTokens.ts`, six routes under `server/api/cms/_model`; tests in `test/api/model-file.spec.ts`, 27 tests on two sites in one process). What exists:

- **The right.** `CmsTokenRights.model` ("Content types"), optional, so stored tokens need nothing. `clampTokenRights` keeps it only for a person whose role manages, on a site with the feature on; otherwise the key is left out. A client signed in over OAuth gets it only when the connect page sent it and the same rule allows it, and never with the read scope.
- **Who may call** (`requireModelCaller`, used by every route below). With `Authorization: Bearer …`: the token's person (`requireTokenUser`: 401, and its count of wrong tokens), then 404 when the feature is off for the site, then 403 `token-cannot-model` without the right, then 403 unless the person's own role manages now (`roleOf({ role })`, as `roleOf` narrows a token's role to `manage: false`). The token's user becomes the request's user, so `cms_model.user_id` and the audit line name the person, and the audit line carries `via: 'token'` and the token's id. Without a bearer: 401, 404, 403, as before. No middleware changed: the session middleware leaves a request without a cookie anonymous and the CSRF guard lets JSON through, so every other admin route answers a bearer request 401 as it did.
- **The routes.** `GET /api/cms/_model/file[?version=N]` (the file read from the database, not the instance's memory; `site` is the site's public address; version 0 is the empty model; 404 `version-not-kept` for a version the site does not keep, or does not have yet). `POST /api/cms/_model/fit { file }` → `{ version, fits, breaks }`. `GET /api/cms/_model/code` → `{ registrations: [{ name, registeredAt, updatedAt, source, by, version, types, breaks }] }`. `PUT /api/cms/_model/code/<name> { file }` → the registration as listed. `DELETE /api/cms/_model/code/<name>` → `{ removed }`. `POST /api/cms/_model` takes the token. All `no-store`.
- **Registering.** One transaction under `MODEL_LOCK`: the table is made, the count checked (422 `limit-code` over 10, a name that exists not counted), the newest model read, `modelMisfits`; 409 `does-not-fit` with `version` and `breaks` unless `force`; an upsert that keeps `created_at`; the audit line. A refusal rolls the table back too, so a site that never registered has no table after one. 422 `invalid-name`, `invalid-file`; 503 `busy` on the lock timeout.
- **The check.** In `changeModel`, after the guard of the stored content and before the statements: `cmsRegistrationsBrokenBy` reads the registrations with the change's own transaction (one `to_regclass` for a site without them) and refuses with 409 `breaks-code` and `registrations: [{ name, registeredAt, updatedAt, source, breaks }]`. A dry run and the server's own sweep pass through it. A stored file that cannot be read is skipped with a log line.
- **A token never purges.** `changeModel` refuses a `purge` from a request whose user is a token's with 403 `token-cannot-purge`, before the transaction. It sits in the function, not the route, so any later caller with a token meets it too.

What I decided where this design was silent:

- `registeredAt` is when the name was first registered and `updatedAt` when the file in force was; both are in the list and in a `breaks-code` refusal. `version` of a registration is the site's version when it registered, not the file's.
- `source` is `app`, `token` or `session` (a person signed in, from the admin).
- `GET /api/cms/_model`, `/usage`, `/attention` and `/history` stay for a session only. They are the editor's views (places in pages, people's names); the developer's flow needs the file, the fit, the change and the registrations. They answer a token 401, as before.
- `limit-code` is 422, like the model's other limits. A wrong name on `DELETE` is 404 `no-registration`.
- With `cms.mcp: false` or an external sign-in, a bearer request to these routes is 401: there are no tokens then.
- `readCustomPart` was left as it is: using `customModelConfig` there changes no behaviour but needs a second way to tell "no custom entity", which is not simpler.

**Measured** (over HTTP on a laptop, a label change of one type, median of 20): 12 ms with no registration, 14 ms with one registration of one type.

**Leaks put in on purpose,** one at a time, each reverted:

| Leak | Failed in `model-file.spec.ts` |
|---|---|
| The fit check skipped when the operations hold a `field.remove` | 5: "refuses removing a field it reads, also as a dry run", "lifts the refusal when the registration is removed", "does not let a registration that already does not fit block what it did not make worse", "a registration made on one instance refuses a change made on the other", "compares 20 changes …" |
| The registrations read once and kept for the process | 10: the first is "refuses removing a field it reads, also as a dry run"; with it the type and required-to-optional refusals, the two-instance test and those that follow on the same state |
| A token with the right accepted for `purge` | 1: "a token cannot purge, even a purge that is valid when a person does it" |

**Part 3, the command line** (`cli/model.ts`, `cli/client.ts`, wired in `cli/index.ts`, listed in `cli/usage.ts`; tests in `test/unit/model-cli.spec.ts` (60), `test/unit/client-cli.spec.ts` (21), `test/api/model-cli.spec.ts` (18, on two sites in one process)). What exists:

- `tinyzoo model pull [--force] [--types <file>]`, `push [--dry-run] [--yes]`, `check [--offline] [--strict]`, `register [--name <name>] [--remove]`, each with `--url <address>` and `--file <path>`. `modelCommand(argv, io)` returns the exit code (0, 1 a refusal or a misfit, 2 a wrong use) and takes the folder, the environment, `fetch` and where to print, so the tests call it in-process.
- The token is `TINYZOO_TOKEN`, sent as `Authorization: Bearer`, no cookie. Redirects are not followed, so the token never travels to another address. A plain `http://` address that is not this machine gets a warning.
- A refusal is printed as the site gave it: its message, then the places (`in-use`), each registration with its name, when it registered and what it reads (`breaks-code`), what the site lacks (`does-not-fit`), the reasons (`not-allowed`), the operation a 422 names. 401, 403 and 404 get the sentences about the token and the switch.
- `tinyzoo client` and `tinyzoo openapi` lay `cms.model.json` (or `--model <file>`) over `cms.config.ts` with `customModelConfig`; `--no-model` leaves it out. Without a file the output is the same bytes as before (a test compares with the frozen contracts). `tinyzoo client --check` writes nothing and exits 1 when the file on disk differs.
- The types `tinyzoo client` builds from a pulled file over the playground's config are the text the site serves at `/api/content-types.ts` (`model-cli.spec.ts`, the last test).

What I decided where this design was silent:

- `pull --types` reads `/api/content-types.ts`, a route of the content API: it takes the content token, not the access token. The CLI sends `TINYZOO_CONTENT_TOKEN` as `x-api-key` when it is set, and never sends `TINYZOO_TOKEN` there.
- A local file read from another site (its `site` differs from the site's) stops `pull` and `push`; `pull --force` replaces it.
- A site with no public address gives a file without `site`; the CLI writes the address it used, so the next command needs none.
- `push` also starts again once when the dry run meets `stale-version`. A person who answers "no" gets exit 1; no terminal and no `--yes` is exit 2.
- After a push, the lines of what the owner changed on the site since the pull are printed: the difference between the local file and the file written.
- `pull` says what changed with `describeModelOps`. When the difference cannot be written as operations (the site removed something and made it again in another form), it says which type or field "was made anew".
- `client` and `openapi` still ignore flags they do not know, as before. `openapi` accepts `--check` too; only `client --check` is listed.
- In `cli/usage.ts` the four subcommands are four entries (`model pull`, …); the test that compares the list with the dispatcher reads the first word.

What was wrong in this design, or is a risk:

- **The address in the file.** `site` in `cms.model.json` is a value in git. When a CI job runs `tinyzoo model check` with no address, a pull request that changes `site` makes the job send `TINYZOO_TOKEN` to that address. The CLI says which address it took from the file, but the guide must tell a CI to set `TINYZOO_MODEL_URL` (or `--url`) always. A later part could refuse a token for an address that came from the file when `CI` is set.
- **The frozen usage text.** A new flag longer than a command's flags re-aligns that command's existing flag lines. `--model <file>` did that to the `--stdout` line of `client` and `openapi` in `cli-usage.txt` (whitespace only; no flag removed or renamed).
- The design's `pull` step 4 limits `--types` to a folder without `cms.config.ts`. The CLI does not check: in an app with a config the saved file is simply the site's types, and the last line still names `tinyzoo client`.

**Part 4, the admin** (`app/pages/admin/_model/index.vue`, `CmsModelCodeRefusal.vue`, the three dialogs that change the types, `CmsTokenRights.vue`, `account.vue`; the words are plain functions in `app/utils/cmsModel.ts`, tested in `test/unit/admin-model.spec.ts`). What exists:

- **The refusal.** `cmsModelProblem` reads `breaks-code` as its own kind with the registrations, and `useCmsModel().change` turns it into words with the labels on screen (`cmsModelCodeRefusalText`): "The website's code reads this field. It is registered as "app" since November 25. Its developer has to update the code first." "This field" or "this type" when the change was about that one thing; "counts on this field always being filled in" for required turned optional; else the labels ("Courses › Short description"); several registrations in one sentence. Never the keys, the `why` codes or the server's English, except a key whose label the site no longer has (a field deleted for good). The remove dialog shows it where it shows "still used" (and offers only Close); the field and settings dialogs where they show their other refusals. Under it one quiet link to `/admin/_model#cms-model-code`; the page scrolls to the section itself, because the admin scrolls a panel and the router does not reach it.
- **The list.** "Code that reads these types" (cs "Kód, který tyto typy čte", de "Code, der diese Typen liest"), loaded with the page and read again after each change of the types, shown only with a registration. A row: the name; who (the website itself for `app`, else the person) · when the file in force was registered · how many types; a line with what the site lacks (`cmsModelCodeRow`), or that the file is of a newer version. Remove behind `useCmsConfirm`, a toast, the list reloads. It sits after *Your types* and *Needs attention*, before *Removed* and *Part of the design*: it is about the types in use now, and the removed things and the design are the quiet tail of the screen.
- **The tick.** "Content types" in the token dialog, offered when the admin's menu holds the row `@model` (the menu has it exactly for a person who manages a site with the feature; `cmsMenuHasRow` in `cmsSidebar.ts`), so no route changed. It sends `rights.model: true`; the list shows the badge "Content types". The connect page does not offer it (its `can` has no `model`). The command line's sentence (`admin, your account, Access tokens`, the right "Content types") names the admin as it is, so it stays.

What I saw in a browser (a dev server in multi-tenant mode on a database of its own, at 1280 and 390 pixels, light and dark, Czech and English) and fixed:

- The link from the refusal landed on the list without scrolling to the section on a short screen: fixed as above.
- The token dialog of the account page never offered "Create and edit" and its three rights, since the sign-in with OAuth came (1cebd8ab, 19 November): `writeAllowed` is a boolean prop, and Vue makes a boolean prop that is left out `false`. It now defaults to `true`; the connect page still sets it.
- English dates are the admin's own ("November 25"), as everywhere else in the admin.

**Part 5, the single-site switch** (`server/utils/cmsSite.ts`, `plugins/cms-0-site.ts`, `utils/cmsSocketSite.ts`, `utils/cmsModel.ts`, `utils/cmsCustomTypes.ts`, `plugins/cms-changes.ts`, `plugins/cms-model.ts`, `utils/cmsLive.ts`, `utils/cmsCollabServer.ts`, two tasks; the model file in `module.ts`, `utils/cmsAppModelFile.ts`, `mergeModelFileAdditions` in `src/model-file.ts`; tests in `test/api/single-custom.spec.ts` (17), `test/unit/cms-site.spec.ts` (12 more), `test/unit/single-site-switch.spec.ts`, `test/unit/model-file-build.spec.ts`). What exists:

- **The question.** `cmsSiteCounted()` in `cmsSite.ts`: true in multi mode, and in single mode when `NUXT_CMS_CUSTOM_TYPES=on`, read once from the environment. Every branch of section 9's first group asks it. Work of a counted single site that runs in no instance (a plugin at start, a timer started outside a request) runs in the site's current instance. `cmsInSiteWork()` says whether the caller runs inside one.
- **Requests** of a counted single site run inside the current instance through the wrapper `countSingleSite` in `cms-0-site.ts` (holding it with their `waitUntil` work; a request made from inside a request stays in its caller's instance), run the start-up work of a fresh instance, and pages wait for `cmsSiteReady()`.
- **Sockets** run every hook inside the current instance, the first ones after the site's types are read. The live hub and the shared-editing engine stop with their instance (sockets get 4000 "Reconnect"; pending documents are stored); the engine is start-up work, so a fresh instance gets one; a fresh hub asks the other instances who is here.
- **Start-up work** runs at boot inside the first instance and again in each fresh one. After a change of structure the log shows "database is up to date" and "search index built" once more.
- **The tasks** `cms:scheduled` and `cms:media-sizes` of a single site wait for its types; all tasks hold their instance through `forEachCmsSite`.
- **The model file.** `module.ts` adds `cms.model.json` (beside `cms.config.ts`) to the server build as the server asset `cms-model-file`, only when it is there; in development its path is in `nuxt.options.watch`, so a change restarts the server. No module option; `module-options.json` and `layer-config.json` did not change (`api-tinyzoo.txt` gained the internal `MODEL_FILE_ASSET` and `mergeModelFileAdditions`). `cmsAppModelFile.ts` takes it in once per process inside `cmsSiteReady()`: `NUXT_CMS_MODEL_FILE` unset registers, `follow` adds first, `off` ignores; `NUXT_CMS_MODEL_CODE` names the registration. The test knob `CMS_TEST_MODEL_FILE=<path>` reads that file instead of the bundled one.
- **The switch off** is today's path: each new question is false exactly where the old one said "single". The unit tests prove it for the seam (`cmsSiteScoped` is one object for the process's life; both retirements do nothing; `runInCmsSite` returns its function's own value in the same tick; `bindToCmsSite` returns the function; start-up work runs once) and for the plugin (the handler is the same function, no hook). The whole api project passes.

**Measured** (over HTTP on a laptop, one single-site server with Redis, a field added; `single-custom.spec.ts`, "timings"): a change of structure, median of 20: 11 ms (9 to 20). The first request after it, which makes the fresh instance: median 15 ms (13 to 18). The same request warm: 2 ms. Resident memory of the server: 359 MB before the 20 changes, 392 MB after (other runs: 361 to 428, 356 to 446; the retired instances are released, what remains is the heap's growth). A change on one of two servers served by the other: 31 to 46 ms, the change included.

**Leaks put in on purpose,** one at a time, each reverted:

| Leak | Failed in `single-custom.spec.ts` |
|---|---|
| The single site's model swapped in place, the instance not retired (the custom part forgotten after the commit and read again by the next request, in the same instance) | 4: "sees one model from its start to its end" (the request under way saw a second model), "is served by the next request on every route that knows types" (the OpenAPI document of the old instance), "stops finding a word of a hidden field…" (no rebuild of the index), "is told to reconnect (4000)…". The test modelled on the multi-tenant one (a PATCH held on a row lock) did NOT fail: its request reads nothing of the model after it waited. The probe test was added for it: a route of the playground (`playground/server/api/test-model-probe.get.ts`, a 404 unless `CMS_TEST_MODEL_PROBE=1`) reads the site's types, waits for an advisory lock the test holds, and reads them again |
| The start-up work not run for a fresh instance | 1: "stops finding a word of a hidden field, and finds it again once the field is restored" |
| `follow` allowed to remove and change (the file sent as it is) | 1: "`follow` adds what the file has and the database lacks, and never removes or changes" (the changed label came back) |

What I decided where this design was silent, or found wrong:

- An identical file is not registered again at a restart (see the list in section 9): the audit log would otherwise get a line per restart, which a person sees.
- The request wrapper of a counted single site does not unload the instances when the server closes. The first version did, as multi mode does, and the whole-run check found `cms:media-sizes` failing with "Cannot use a pool after calling end on the pool": the task of every second was still running. Single mode never ended its pool at close; the process ends it.
- Unknown values of `NUXT_CMS_MODEL_FILE` are one warning and count as unset (the file is registered, nothing added).
- In multi mode with the switch on, a build that carries a model file says one info line at start; nothing else reads it.

Left open:

- When the shared-editing engine of a retired instance stops, the Redis extension of Hocuspocus logs "Error: Connection is closed." for each document it unloads after its connections were closed (`afterUnloadDocument` unsubscribes on a client `onDestroy` already disconnected). Harmless, and the same path as a multi-tenant site's retirement; a fix belongs in how `stopCollab` orders the two, not in this part.
- A search rebuild still running when its instance is released can lose its pool between its first query and its transaction (one error line; the next instance rebuilds). Multi mode is spared by the connection cap, which answers a closed pool with the site's current one; a counted single site has no cap.
- A fresh instance whose migrations fail (they find nothing to do, so only the connection can fail) exits the process in production, as a single site always has.
- The guide for developers, the changeset and the contracts' notes are part 6.
