# Contributing

## Setup and checks

```sh
pnpm install
pnpm check        # typecheck, tests (needs Postgres, see docs/development.md), production build
```

## Changesets: every change to a package gets one

`tinyzoo` and `@tinyzoo/client` are released together, with the same version
number. Every pull request that changes something inside `packages/` adds a
changeset (the playground, the website and the starter are not published, so
changes only to them need none):

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

A breaking change on 0.x is a minor bump. Both packages follow the higher bump of
the two.

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

## Deprecations

The API a site's code touches (`cms.config.ts` options, the `f.*` and `define*`
helpers, `tinyzoo` CLI commands, the content API) is retired in two steps, never
removed at once:

1. Mark it with a `@deprecated` JSDoc line that names the replacement, and call
   `cmsDeprecated(id, message, { removeIn })` at the use site. It prints
   `[tinyzoo] deprecated: …` once per process (not under `NODE_ENV=test`, unless
   `TINYZOO_DEPRECATIONS=1`; `TINYZOO_DEPRECATIONS=0` silences it). Tests can read
   what was hit with `cmsDeprecations()`.
2. Keep it working for **at least one minor release**, then remove it. The
   removal is a breaking change: it gets a changeset with an `### Upgrade`
   section. The release that deprecates something says so in its changelog.

```ts
/** @deprecated Use `slugField` instead. Removed in 0.4. */
export function slugOf(…) {
  cmsDeprecated('slugOf', '`slugOf()` is replaced by `slugField()`.', { removeIn: '0.4.0' })
  …
}
```

## Contracts

The public content API is what site frontends depend on, so its shape is guarded
by two committed files in `test/contracts/`, both made from
`playground/cms.config.ts`:

- `openapi.playground.json`: the OpenAPI document of the content API.
- `client-types.playground.ts`: the types generated for `@tinyzoo/client`.

`test/unit/contracts.spec.ts` fails with the lines that differ when either one
changes. If the change is intended, accept it and commit the file:

```sh
pnpm contracts:update
```

A changed golden file in a pull request means the public content API changed.
The reviewer reads that diff, and the changeset says whether it **breaks sites**
(a removed or renamed field, a changed type, a stricter filter: breaking; a new
optional field or a new route: not).

## The upgrade test

A change that is fine on its own can still strand a site that is already running. The
`upgrade` job in CI (`scripts/upgrade-check.mjs`) tries it on a real one: it builds a
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

It is not part of `pnpm check`: it needs the network and a real install of two sites.

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
packages" pull request that bumps both versions and writes the changelogs.
Merging that pull request builds the packages, runs the consumer check (packed
tarballs installed into a fresh app, then built), and publishes both packages to
npm with provenance. Nothing is published by hand.
