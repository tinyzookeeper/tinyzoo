# create-tinyzoo

## 1.15.0

No changes in this release.

## 1.14.0

No changes in this release.

## 1.13.0

No changes in this release.

## 1.12.0

No changes in this release.

## 1.11.0

No changes in this release.

## 1.10.0

No changes in this release.

## 1.9.0

No changes in this release.

## 1.8.0

No changes in this release.

## 1.7.0

No changes in this release.

## 1.6.0

No changes in this release.

## 1.5.0

No changes in this release.

## 1.4.0

### Minor Changes

- **New sites count their visits.** `tinyzoo init` and `pnpm create tinyzoo` have a new part, `analytics`, on by default like the others: the site's `cms.config.ts` lists `analyticsPlugin()` (cookieless), the first migration makes its tables, and the README points at the sentence for the privacy policy. `--presets` without `analytics` leaves it out.

  **Upgrade**

  Nothing to do. A site made earlier switches analytics on as in "Switching it on" in `docs/analytics.md`.

## 1.3.0

No changes in this release.

## 1.2.0

No changes in this release.

## 1.1.1

No changes in this release.

## 1.1.0

No changes in this release.

## 1.0.1

No changes in this release.

## 1.0.0

### Minor Changes

- Requirements written down, and the CLI follows the site's package manager.

  - `engines.node` is Nuxt 4.6's: `^22.22.3 || ^24.15.0 || >=26.0.0` (the starter's too).
  - `drizzle-orm` is a peer dependency of `tinyzoo` (`^0.45.4`): the site installs it (sites made by `tinyzoo init` always have), so the site and tinyzoo share one copy.
  - `tinyzoo status` and `tinyzoo upgrade` check `drizzle-kit` too, against `>=0.31 <1`: tinyzoo 1.x writes migrations with drizzle-kit 0.x, and moves to drizzle 1.0 in 2.0. `tinyzoo status` now names packages that do not fit (a warning; the exit code is unchanged).
  - `tinyzoo generate` runs drizzle-kit, and `tinyzoo upgrade` runs `cms:client`, with the site's package manager (told by its lockfile, its `packageManager` field, or the one that started the command), not always pnpm; the commands they print are that package manager's.
  - The starter's scripts call the `tinyzoo` bin (`tinyzoo generate`, `tinyzoo up`, `tinyzoo seed`, `tinyzoo client …`) instead of `tsx node_modules/tinyzoo/cli/index.ts …`.

  **Upgrade**

  1. Run Node 22.22.3 or newer (22.x), 24.15.0 or newer (24.x), or 26 or later; Nuxt 4.6 asks for the same.
  2. Keep `drizzle-orm` (`^0.45.4`) and `drizzle-kit` (`^0.31.11`) in your `package.json`, as sites made by `tinyzoo init` have them. If `tinyzoo status` warns about drizzle-kit 1.0, go back to 0.x: `pnpm add -D "drizzle-kit@^0.31.11"`.
  3. Optional: in `package.json`, change scripts like `tsx node_modules/tinyzoo/cli/index.ts generate` to `tinyzoo generate` (the same for `up`, `seed` and `client`). The old form keeps working.

### Patch Changes

- A new site with the Search part keeps its search page out of `/sitemap.xml`. The page says `noindex`, but the sitemap listed it. `tinyzoo init` and `pnpm create tinyzoo` now write `sitemap: { exclude: [...] }` in `nuxt.config.ts` with the search page's address in each language.

  **Upgrade**

  Nothing to do for a new site. An existing site with the starter's search page adds the exclusion itself, with the page's address in every language (`sitemap: { exclude: ['/hledat', '/en/search'] }` for a Czech and English site), as step 6 of "From 0.4 to 0.5" in `docs/upgrading.md` says.

## 0.7.0

No changes in this release.

## 0.6.0

### Minor Changes

- `pnpm create tinyzoo` makes a new website. It asks for the languages of the content, which parts the site has (news, a contact form, redirects, a search page), whether to add the demo content, and whether to install the dependencies, then copies the starter with those choices. Every question has an option (`--languages cs,en,de`, `--presets news,forms`, `--no-demo`, `--install`, `--package-manager`, `--yes`), so it also runs in CI. `npm create tinyzoo@latest` and `yarn create tinyzoo` work too.

  `tinyzoo init <folder>` takes the same options (except installing and `--yes`, which only `create-tinyzoo` has) and makes the same site: `--languages` (the first one is the default), `--presets news,forms,redirects,search` or `none`, `--no-demo`, `--package-manager`. Without options it makes what it always did. Both work in the current folder when it is empty (`pnpm create tinyzoo .`, `tinyzoo init .`): the folder itself is kept, the site is made inside it. A site made with other languages or parts than the starter's own (Czech and English, every part) needs `pnpm db:generate` and `pnpm cms:client` before its first `pnpm db:migrate`; `create-tinyzoo --install` and the next steps `init` prints say so.

  The starter's website now takes its languages from `app/utils/site.ts` (with the words it draws itself in Czech, English and German, and English for any other language), and its search page is `app/pages/search.vue`. The demo content is in Czech and English, so a new site gets it only when its first language is Czech or English (`--demo` with any other first language stops with a message).

  **Upgrade**

  Nothing. A site you already have is not changed: the starter's files are yours. To see what a fresh starter looks like now, `pnpm dlx tinyzoo init ../scratch` and compare.
