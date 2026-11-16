# Upgrade check: hooks and documented differences

`scripts/upgrade-check.mjs` moves a seeded site from an older tinyzoo to the current
code and compares what it returns before and after (the steps are listed at the top of
that file; CONTRIBUTING.md says when to run it). This folder holds what it needs.

| File | What |
|---|---|
| `site.mjs` | the HTTP side: setup, seeding, recording, comparing, saving through the admin |
| `workspace.mjs` | what is read from a checkout (lockfile, overrides, release tags) |
| `differences.mjs` | differences between old and new that a release made **on purpose**, each with its reason |
| `<ref>.mjs` | a hook for one baseline (below) |

## Documented differences

The check fails on any difference between the old and the upgraded site, field by field,
in the content API (every collection and setting, every language), in the admin's view of
every entry, in the sitemap, and in the files served. A release that changes the output on
purpose adds a rule to `differences.mjs`, in the same pull request as its changeset:

```js
{ path: 'content.page.*.breadcrumbs', kind: 'added', why: '0.3.0: the content API returns breadcrumbs (changelog, "Page tree")' }
```

`path` is printed in the failure message; `why` names the changelog entry that tells sites.
A rule without a `why` is refused. A rule only one baseline needs goes into that
baseline's hook (`differences`). Rules for a version that every baseline already has are
dead weight: delete them when the oldest baseline moves past the release that made them.

## Hook files

A step that the changelog documents for a release, and that a site really does by hand
after updating, cannot be run by `tinyzoo upgrade` alone. The baseline that needs it gets a
hook, named after the baseline as it is written in `.github/upgrade-baseline`
(`2506403.mjs`, `v0.2.0.mjs`; `/` in a ref becomes `_`; a short or full commit hash also works):

```js
export default {
  // Required: the documented step this stands for, with the changelog entry it comes from.
  description: '0.3.0 "Upgrade" step 2: rename `price` to `amount` (hand-written migration)',

  // Extra arguments for `tinyzoo upgrade` (it passes them to `tinyzoo generate`).
  upgradeArgs: ['--allow-risky'],

  // Differences this baseline alone has (same shape as differences.mjs).
  differences: [],

  // Run in the site folder after the new packages are installed, before and after `tinyzoo upgrade`.
  // ctx: { ref, sha, dirs: { site, work, src, uploads }, siteEnv, sh, note }
  //   sh(label, cmd, args, { cwd, env, allowFail }) runs a command with its output logged.
  async beforeUpgrade(ctx) {},
  async afterUpgrade(ctx) {},

  // Replaces the default seeding of the OLD site (ctx.baseURL). It has to create the
  // administrator with `ACCOUNT` from site.mjs: the check signs in with it after the upgrade.
  // async seed(ctx) {},
}
```

A hook is a way to say "a site does this by hand, and the changelog says so". It is not a way
to make the check pass: if the guard refuses a change and the changelog has no step for it,
the changelog is what is missing.

## Seeding

The default seeding (`seedViaApi` in `site.mjs`) goes through the HTTP API with a few fixed
entries: pages with blocks and a translation, news with images, settings, navigation and a
form message. The recording that follows walks the admin graph instead of a fixed list, so
whatever a seeding step adds is compared too. When `tinyzoo seed` exists at the baselines, a
seeder that runs it goes into `SEEDERS` in `upgrade-check.mjs` and is chosen with `--seed cli`.

## Running it

```sh
UPGRADE_CHECK_DATABASE_URL=postgres://cms:cms@localhost:5432/postgres pnpm check:upgrade
node scripts/upgrade-check.mjs --from 2506403 --keep    # one baseline, keep the folder and database to look at
```

It needs a Postgres server it may create `cms_upcheck_*` databases on (dropped at the end),
the network for `pnpm install`, and about a minute and a half per baseline. Redis is used when
`UPGRADE_CHECK_REDIS_URL` is set (CI does; keys are prefixed with the database name).
