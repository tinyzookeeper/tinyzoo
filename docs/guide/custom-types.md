# Content types made in the admin

**Experimental.** It may change in a minor release.

Most of a site's content model is code: `cms.config.ts`. With this feature, the site's administrators can also add simple collections of their own in the admin, under *Settings › Content types*, with no release. "Courses", "Branches", "References".

This page is the developer's side. It covers:

- switching the feature on
- the model file, which brings those types into your repository
- typed code against them
- the lock that keeps a click in the admin from breaking your pages

## Switch it on

```bash
NUXT_CMS_CUSTOM_TYPES=on
```

Administrators then find *Content types* under *Settings*. What they make there:

- A type is named `custom_` and a key made from its first label: `custom_course`. People see labels only.
- Each type is a real table in the site's database, `custom_course`.
- The admin shows its list and its form. The content API serves it at `/api/content/custom_course`, like any collection.
- A type can have a page per entry (`/courses/<slug>`), drafts and publishing, and a field that points at one of your code-first collections.
- A site can have 12 such types, with 30 fields each.

Removing a type or a field hides it, with its content. It can be restored at any time. Only an administrator deletes it for good, by hand.

The types in `cms.config.ts` stay as they are. Nobody can change them in the admin.

## The model file

The types made in the admin live in the site's database. `tinyzoo model pull` writes them into a file in your repository, `cms.model.json`, beside `cms.config.ts`.

It needs an access token. An administrator makes one in the admin (*Your account › Access tokens*) and ticks *Content types*. Such a token reads the types, changes them and registers code. It can never delete anything for good.

```bash
export TINYZOO_TOKEN=tzp_…
tinyzoo model pull --url https://your-site.example
```

Commit the file. It holds the visible types and fields, the site's address and the version of the site's model it was read at. Later commands take the address from the file.

| Command | What it does |
|---|---|
| `tinyzoo model pull` | Writes `cms.model.json` from the site and says what changed |
| `tinyzoo model push` | Sends what you changed in the file to the site |
| `tinyzoo model check` | For CI: the file is valid and the site still has what it says |
| `tinyzoo model register` | For a separate frontend: tells the site which file its code was built against |

All four read the token from `TINYZOO_TOKEN`. The address is `--url`, else `TINYZOO_MODEL_URL`, else the `site` in the file.

## Typed code

`tinyzoo client` reads `cms.model.json` when it is there. The generated file then holds the custom types beside your own:

```bash
tinyzoo client
```

```ts
const cms = createClient({ baseUrl })
const { items } = await cms.custom_course.list({ sort: 'startsAt' })
items[0].title      // string
items[0].startsAt   // string | null
```

The same file in git gives the same types every time. No network is needed.

A choice field of a custom type is typed as its known values or any other text: `'beginner' | 'advanced' | (string & {})`. An administrator can add a choice at any time, so handle a value your code does not know.

## Your own machine

Your local database does not have the types the live site has. Set this in the local `.env`:

```bash
NUXT_CMS_CUSTOM_TYPES=on
NUXT_CMS_MODEL_FILE=follow
```

When the local server starts, it adds to its database what the file has and the database lacks. It never removes or changes anything. So after a `pull`, the local site has the live structure. The same works for the database of a CI run.

## Change the types from code

Edit `cms.model.json`, then:

```bash
tinyzoo model push --dry-run   # the plan, nothing is sent
tinyzoo model push             # asks, then sends
```

`push` sends only what you changed since your pull. What an administrator changed on the site in the meantime stays, and the file is written again with both.

A type or a field you take out of the file is hidden on the site, with its content. It can be restored in the admin.

Some things cannot be changed after they are made: a type's name, a field's key and kind, a relation's target, the address of a type's pages. Add a new field or type instead.

## The lock

Your pages read fields. An administrator must not be able to remove one of them by accident.

**A site with tinyzoo inside** registers itself. The build carries `cms.model.json`, and the server registers it when it starts, under the name `app`. No command and no token.

**A separate frontend** registers in its deploy:

```bash
tinyzoo model register --name web
```

From then on the site refuses a change that would break registered code:

- removing a type or a field the file has
- making a field optional that the file has as required

The administrator reads why: which code reads the field, and since when. Everything else passes: a new type, a new field, a new choice, another label.

An administrator can remove a registration, on the *Content types* screen. The site then no longer asks that code before a change. The code registers itself again with its next deploy.

`register` is refused when the site no longer has what the file says. Pull, fix the code, deploy again.

## In CI

```bash
tinyzoo model check      # the file is valid, and the site still has what it says
tinyzoo client --check   # the generated types are what the file and the config give
nuxt typecheck           # every line of code fits them
```

Set `TINYZOO_MODEL_URL` and `TINYZOO_TOKEN` in the CI's secrets. In CI the address is never taken from the file: the file is what a pull request wrote.

`check` fails when code built from the file would break: the site lost something the file has. When the site only has more (a new field, another label), `check` says so and passes. `--strict` fails on any difference. `--offline` checks the file alone, with no address and no token.

`check` also catches a release of yours that would break the types: a custom field that points at a collection your `cms.config.ts` no longer has.

## Reference

| Setting | |
|---|---|
| `NUXT_CMS_CUSTOM_TYPES=on` | Switches the feature on |
| `NUXT_CMS_MODEL_FILE` | What the server does with the app's own `cms.model.json` at start. Unset: registers it. `follow`: first adds what it has. `off`: ignores it |
| `NUXT_CMS_MODEL_CODE` | The name the app registers under. Default `app` |
| `TINYZOO_TOKEN` | The access token for `tinyzoo model` |
| `TINYZOO_MODEL_URL` | The site's address for `tinyzoo model` |
| `TINYZOO_CONTENT_TOKEN` | The content API's token, for `tinyzoo model pull --types` on a site that asks for one |

| Flag | |
|---|---|
| `pull --force` | Replaces a local file that has changes the site does not have |
| `pull --types <file>` | Also saves the site's generated types. For a project with no `cms.config.ts` |
| `push --dry-run` | Shows the plan, sends nothing |
| `push --yes` | Does not ask |
| `check --offline` | Checks the file alone |
| `check --strict` | Fails on any difference |
| `register --name <name>` | The name to register under. Default `web` |
| `register --remove` | Removes the registration |
| `client --check` | Writes nothing; fails when the generated file on disk is out of date |
| `client --model <file>`, `--no-model` | Another model file, or none |

`tinyzoo model` exits with 0 when all is well, 1 when something needs a person (a refusal, a file that does not fit) and 2 when the command was used wrongly.

## What to know

- Access tokens need tinyzoo's own sign-in and the MCP server switched on (`cms.mcp`, on by default).
- A custom field may point at a code-first collection. Removing that collection in a later release fails on the custom table. `tinyzoo model check` names it before the deploy.
- `tinyzoo export` and `import` refuse a site with custom types. `tinyzoo backup` and `restore` copy them with the rest of the database.
- The lock covers code that registered. A program that never registered, and a change made in the database by hand, are not covered.
