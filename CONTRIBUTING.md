# Contributing

## Setup and checks

```sh
pnpm install
pnpm check        # typecheck + unit and API tests (needs Postgres, see docs/development.md); the API tests production-build the playground
```

## What CI runs, and when

Every pull request and every push to `main` (`.github/workflows/ci.yml`, about four minutes):

| Job | What |
|---|---|
| `check` | `pnpm typecheck` (the code, the docs' examples and the Vue templates of the admin, playground, starter and website) and `pnpm test:unit` |
| `api` | `pnpm test:api`: the built playground over HTTP against Postgres and Redis. Its production build is the build check |
| `changeset` | pull requests only: a change to a package comes with a changeset |

The slow checks (`.github/workflows/heavy.yml`) run **nightly on `main`**, **on demand**, on the
**"Version packages" pull request** (`changeset-release/main`), and on **any other pull request only
when it touches what they cover**:

| Job | What | Runs on a pull request that changes |
|---|---|---|
| `upgrade` | a site made on an older tinyzoo moves to this one (below) | `packages/cms/{src,cli,server,starter}/**`, `scripts/upgrade-check*`, `.github/upgrade-baseline/**` |
| `consumer` | the packages packed, installed into a fresh app and built; `create-tinyzoo` installed from its tarball makes a site | `packages/*/package.json`, `packages/cms/module.ts`, `packages/cms/nuxt.config.ts`, `packages/cms/cli/init.mjs`, `packages/create-tinyzoo/**`, `scripts/consumer-check*`, `test/consumer/**`, the playground's `package.json`, `cms.config.ts` and `cms-plugins/` |
| `backup (client tools 16 / 17 / 18, server 16)` | `tinyzoo backup` and `restore` with `pg_dump`, `pg_restore` and `psql` of each version; fails where the tools are missing | `packages/cms/cli/backup*`, `cli/tar*`, `src/migrate*`, `.github/actions/pg-client/**`, `test/api/backup.spec.ts` |
| `s3-minio` | the S3 delivery modes against a real MinIO | `server/utils/cmsStorage*`, `server/api/cms/_media/**`, `cli/transfer*`, `test/api/s3-minio.spec.ts` |
| `result` | green when every heavy job that ran passed (skipped ones are nothing relevant) | every pull request |

Changing `heavy.yml` itself runs all of them. To run them by hand on any branch: **Actions → Heavy checks →
Run workflow** (or `gh workflow run heavy.yml --ref <branch>`). `release.yml` still runs the consumer
check on the packed tarballs right before it publishes.

Locally, the same checks:

```sh
pnpm check:upgrade          # needs UPGRADE_CHECK_DATABASE_URL and the network, see "The upgrade test"
pnpm check:consumer         # packs the packages, builds a fresh app from the tarballs, makes a site with create-tinyzoo's
# the starter in four combinations (languages, parts, demo content), each made by the packed package, installed,
# built, started and checked: tinyzoo init, and create-tinyzoo (needs a scratch Postgres database, see docs/development.md)
STARTER_CHECK_DATABASE_URL=postgres://cms:cms@localhost:5434/cms_test_starter pnpm check:starter
pnpm build                  # a plain production build of the playground (the API tests already make one)
# backup: needs pg_dump, pg_restore and psql (or TINYZOO_PG_DUMP / TINYZOO_PG_RESTORE / TINYZOO_PSQL);
# TINYZOO_REQUIRE_PG_TOOLS=1 makes missing tools a failure instead of a skip, as in CI
pnpm exec vitest run --project api test/api/backup.spec.ts
# MinIO: see the head of test/api/s3-minio.spec.ts for the docker command, then
TEST_S3_ENDPOINT=http://localhost:9190 TEST_S3_ACCESS_KEY=minio TEST_S3_SECRET_KEY=minio12345 \
  pnpm exec vitest run --project api test/api/s3-minio.spec.ts
```

The Version packages pull request is opened by the release workflow with `GITHUB_TOKEN`, and GitHub does
not start workflows for pushes made with it: if no checks appear on that pull request, run **Heavy checks**
on `changeset-release/main` by hand before merging (or give `changesets/action` a token of an app or a
personal token).

## Changesets: every change to a package gets one

`tinyzoo`, `@tinyzoo/client` and `create-tinyzoo` are released together, with the same version
number (`fixed` in `.changeset/config.json`). Every pull request that changes something inside
`packages/` adds a changeset (the playground, the website and the starter are not published, so
changes only to them need none; `create-tinyzoo` carries a copy of the starter, so a change to
the starter that sites should hear about gets one on `tinyzoo`):

```sh
pnpm changeset
```

Pick the bump, write one or two sentences for the people who run a tinyzoo site.
The entries end up in each package's `CHANGELOG.md`.

| Change | Bump on 0.x | Bump from 1.0 |
|---|---|---|
| Breaking change (a site stops working, or must edit code or data) | **minor** | major |
| New feature, or a deprecation | minor | minor |
| Fix, no change to what a site sees or has to do | patch | patch |

A breaking change on 0.x is a minor bump. The packages follow the highest bump of them.

### `### Upgrade`: when a site has to do something

If a site must do anything after updating (run a command, edit its
`cms.config.ts`, rename something, change an environment variable), the changeset
has a `### Upgrade` section with the exact steps, in order:

```md
---
'tinyzoo': minor
---

Search for the website and the admin.

### Upgrade

1. Run `tinyzoo generate` and commit the new migration.
2. Apply it with `tinyzoo up`.
```

It appears in the changelog as a bold **Upgrade** block under the entry. A change
that needs nothing from a site has no such section.

## Dependency updates

[Renovate](https://docs.renovatebot.com/) proposes updates on Monday mornings (Prague time),
configured in `renovate.json`. Every pull request it opens updates `pnpm-lock.yaml` with the
`package.json` it changes (deduplicated), so CI's `pnpm install --frozen-lockfile` passes.

| Pull request | What is in it |
|---|---|
| `minor and patch updates` | every patch update, and minor updates of packages at 1.0 or later. Usually only `pnpm-lock.yaml` changes, as the new versions fit the ranges already written |
| one per package (or monorepo) | a major update, and a minor update of a package below 1.0 (`drizzle-orm` 0.44 to 0.45 can break as a major would) |
| `editor stack (TipTap, ProseMirror, Yjs)` | these move together, with the overrides in `pnpm-workspace.yaml` that keep one copy of each |
| `lock file maintenance` | the lockfile refreshed within the existing ranges: newer indirect dependencies |

An npm release is proposed only once it is three days old. Major versions of the Postgres
image are not proposed: the server version tinyzoo is tested against is chosen, not updated.

Handling them:

- **Read the changelog** of each major or 0.x minor before merging, check its breaking
  changes against how tinyzoo uses the package, and run the checks that CI does not run on
  every pull request when they are relevant (`pnpm check:upgrade`, `pnpm check:starter`).
- **A change to a published package needs a changeset** (above), and the `changeset` check
  fails without one. That happens when an update changes `packages/cms/package.json` or
  `packages/client/package.json`: push a changeset to the Renovate branch (Renovate then
  leaves the branch to you). A raised peer dependency range (`nuxt`, `@nuxt/ui`,
  `nuxt-auth-utils`) means sites must update too: minor, with an `### Upgrade` section.
- The **Dependency Dashboard** issue lists what is waiting, what is scheduled and what was
  closed. Closing an update's pull request without merging tells Renovate to skip it (that
  major version, or that one version); to get it back, tick it on the dashboard.

## Deprecations

The API a site's code touches (everything in [docs/api-surface.md](docs/api-surface.md): `cms.config.ts` options, the
`f.*` and `define*` helpers, the `cms` options and `NUXT_CMS_*` variables, `tinyzoo` CLI commands, the content
API, the webhook and hooks) is retired in two steps, never removed at once:

1. Mark it with a `@deprecated` JSDoc line that names the replacement, and call
   `cmsDeprecated(id, message, { removeIn })` at the use site. It prints
   `[tinyzoo] deprecated: …` once per process (not under `NODE_ENV=test`, unless
   `TINYZOO_DEPRECATIONS=1`; `TINYZOO_DEPRECATIONS=0` silences it). Tests can read
   what was hit with `cmsDeprecations()`.
2. Keep it working for **at least one minor release**, then remove it (on 0.x in a minor, from 1.0 in a
   major). The removal is a breaking change: it gets a changeset with an `### Upgrade`
   section. The release that deprecates something says so in its changelog. A deprecated export, option
   or member is listed under "deprecated" in its golden API report, so the diff shows it.

```ts
/** @deprecated Use `slugField` instead. Removed in 0.4. */
export function slugOf(…) {
  cmsDeprecated('slugOf', '`slugOf()` is replaced by `slugField()`.', { removeIn: '0.4.0' })
  …
}
```

## Contracts

The surfaces a site, a plugin or a deploy depends on are written down as golden files in
`test/contracts/`, and a test fails with the lines that differ when the code stops producing them.
**[docs/api-surface.md](docs/api-surface.md)** says in words what is frozen from 1.0 and what is
internal; the golden files are how it is kept true:

| Golden file | Test | A change to it is… |
|---|---|---|
| `openapi.playground.json`, `client-types.playground.ts` | `test/unit/contracts.spec.ts` | a change to the public **content API** as the playground's config produces it |
| `api-tinyzoo.txt`, `api-tinyzoo-forms.txt`, `api-tinyzoo-module.txt`, `api-client.txt` | `test/unit/api-surface.spec.ts` | a change to what an entry point **exports**: every declaration, with `@internal` exports and members left out |
| `module-options.json` | | a change to the `cms` options, their defaults, or the `NUXT_CMS_*` variables that follow |
| `nitro-hooks.d.ts`, `webhook.json` | | a change to the **Nitro hooks** and their arguments, or the webhook's headers and body |
| `cli-usage.txt` | | a change to the **CLI**'s commands and flags (`packages/cms/cli/usage.ts`) |
| `content-routes.txt`, `layer-config.json` | | a new or removed content API route, or something the layer sets up |
| `surface.client-types.ts`, `surface.openapi.json`, `surface.admin-graph.json` | | the content API, the client types and the admin graph (what a field renderer receives) of `test/contracts/surface/cms.config.ts`, a config that uses every field and option |

`test/unit/surface-types.spec.ts` also asserts the types a site's code sees for that config (`Row`, `Insert`,
`Update`, the field kinds, the client): its assertions are checked by `pnpm typecheck`, so a regression fails
there. When you add a field type, an option or an export, add it to `test/contracts/surface/cms.config.ts` and
to `docs/api-surface.md` (a test checks that the page names every public export, command, flag, route, hook
and variable). An export that is only for the server, the admin or the CLI gets `@internal` in its JSDoc and
stays out of the page; do not tag something the docs show a site using.

If a golden file fails because the change is intended, accept it and commit the file:

```sh
pnpm contracts:update
```

A changed golden file in a pull request means a frozen surface changed. The reviewer reads that diff, and the
changeset says whether it **breaks sites**:

- **Breaking** (a major bump from 1.0, so it waits for 2.0): a removed or renamed export, option, field type,
  command, flag, route, hook, webhook key or variable; a narrower type, a stricter filter or validation; a
  changed default; a field that is no longer in a response.
- **Not breaking** (a minor bump): something added (an optional option, a new export, a new route, a new key
  in a response, an optional field), a looser type, a fix that makes the code do what the docs said.
- A change to an `@internal` export shows in `api-tinyzoo.txt` only as its name; it needs a changeset (it
  changes the package) but is never breaking.

## The upgrade test

A change that is fine on its own can still strand a site that is already running. The
`upgrade` job (see "What CI runs, and when"; `scripts/upgrade-check.mjs`) tries it on a real one: it builds a
baseline version (a site made with that version's own `tinyzoo init`, set up and filled
with pages, news, images, settings, a menu and a form message), installs this commit's
packages into the same site, runs `tinyzoo upgrade` with no terminal, starts the site on the
same database and checks that

- the migration `tinyzoo upgrade` writes passes the guard (otherwise the check fails with the
  guard's reasons: a breaking change needs its documented steps),
- the site starts and `tinyzoo status` has nothing pending,
- the old account signs in,
- the content API and the admin return the same content, field by field,
- every file is still served, and the admin can open and save every entry unchanged.

The baselines are listed in `.github/upgrade-baseline` (before the first release a commit,
not a tag); the latest release tag is added by itself once there is one. Run it yourself
(about a minute and a half per baseline, needs Postgres and the network):

```sh
UPGRADE_CHECK_DATABASE_URL=postgres://cms:cms@localhost:5432/postgres pnpm check:upgrade
node scripts/upgrade-check.mjs --from 2506403 --keep   # one baseline; keeps the site and database to look at
```

When it fails, the message says which step and why. The usual causes:

| What it says | What to do |
|---|---|
| The guard refused the migration | The change needs the two-step route or its documented steps (`docs/upgrading.md`), and the changeset an `### Upgrade` section. Do not silence the check. |
| Unexpected differences in the content API or the admin | Intended? Then the changeset says so under `### Upgrade`, and the difference goes into `scripts/upgrade-check/differences.mjs` with its reason. If not, it is a bug. |
| A manual step a site must do (documented in the changelog) | A hook file for that baseline, `scripts/upgrade-check/<ref>.mjs` (see the README there). |

It is not part of `pnpm check`: it needs the network and a real install of two sites. In CI it runs nightly, on the release pull request and when a pull request touches the code it covers.

## The docs check

The code in `docs/guide/` and the README's example is type-checked, so the examples cannot drift from the code.
A fenced block is checked when the line above it is a marker:

```md
<!-- check: news/cms.config.ts -->
```

`<group>/<path>`: blocks of one group form a small site (`cms.config.ts`, `app/**`,
`server/**`); the flag `+` continues a file and `append-to-starter` adds the block to a
copy of the starter's config. `pnpm docs:check` (also part of `pnpm typecheck`) loads each
group's config for real, generates its typed client, type-checks the lot and names the
Markdown file and line of any error. Only the `<script setup>` of a Vue block is checked,
not its template. Details: `test/docs/README.md`.

## Releasing

Merging to `main` makes the release workflow open (or update) a "Version
packages" pull request that bumps the versions and writes the changelogs.
Merging that pull request builds the packages, runs the consumer check (packed
tarballs installed into a fresh app, then built), and publishes `tinyzoo`,
`@tinyzoo/client` and `create-tinyzoo` to npm with provenance. Nothing is
published by hand, except the one-time placeholder of a new package.

### `create-tinyzoo`: how it is made, and its first publish

`create-tinyzoo` (`pnpm create tinyzoo`) does not depend on `tinyzoo`: that would install the whole
CMS (Nuxt, the editor, 700+ packages) to copy a folder. Its `prepack` (`scripts/bundle.mjs`, run by
`pnpm pack` and `pnpm publish`) copies `packages/cms/cli/init.mjs` and `packages/cms/starter` into
`bundle/` (not committed), so the package always carries the init code and the starter of the same
commit, and the version `tinyzoo` has. The code that makes a site is `cli/init.mjs`: `tinyzoo init`
and `create-tinyzoo` both run it. Markers in the starter (`// #if news` … `// #endif`) mark the parts
a site can leave out; the head of `init.mjs` says how they work.

npm trusted publishing is set on the package's page, which exists only once the package does. So
the **first** publish is a placeholder, made by hand once by an owner of the package name:

1. From a clean checkout of `main`, signed in to npm (`npm login`, with the account's second factor):

   ```sh
   pnpm install
   cd packages/create-tinyzoo
   npm publish --access public --ignore-scripts     # publishes 0.0.0 as it is in package.json
   ```

   `--ignore-scripts` skips `prepack`, so the placeholder has no starter inside: it exits with a
   message instead of making a site. (The version stays `0.0.0`; the next release makes it the
   version of the other two, as `fixed` in `.changeset/config.json` says.)
2. On npmjs.com open **create-tinyzoo → Settings → Trusted publisher**, choose **GitHub Actions** and
   fill in: organization or user `tinyzookeeper`, repository `tinyzoo`, workflow filename
   `release.yml`, environment: empty. Save.
3. Do both **before** merging the first "Version packages" pull request that contains
   `create-tinyzoo`: without a trusted publisher (and without the `NPM_TOKEN` secret allowed to
   publish it) that release publishes `tinyzoo` and `@tinyzoo/client` and fails on the third.
   If it did fail, set the publisher, then re-run the failed job: `scripts/release.mjs` publishes
   only what npm does not have yet.
4. After the release, check the package page: the **Provenance** badge, and `pnpm create tinyzoo
   scratch --yes` from an empty folder.

The same applies to any package added to the repository later.
