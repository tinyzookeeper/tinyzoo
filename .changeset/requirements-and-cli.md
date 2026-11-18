---
'tinyzoo': minor
'@tinyzoo/client': minor
'create-tinyzoo': minor
---

Requirements written down, and the CLI follows the site's package manager.

- `engines.node` is Nuxt 4.6's: `^22.22.3 || ^24.15.0 || >=26.0.0` (the starter's too).
- `drizzle-orm` is a peer dependency of `tinyzoo` (`^0.45.4`): the site installs it (sites made by `tinyzoo init` always have), so the site and tinyzoo share one copy.
- `tinyzoo status` and `tinyzoo upgrade` check `drizzle-kit` too, against `>=0.31 <1`: tinyzoo 1.x writes migrations with drizzle-kit 0.x, and moves to drizzle 1.0 in 2.0. `tinyzoo status` now names packages that do not fit (a warning; the exit code is unchanged).
- `tinyzoo generate` runs drizzle-kit, and `tinyzoo upgrade` runs `cms:client`, with the site's package manager (told by its lockfile, its `packageManager` field, or the one that started the command), not always pnpm; the commands they print are that package manager's.
- The starter's scripts call the `tinyzoo` bin (`tinyzoo generate`, `tinyzoo up`, `tinyzoo seed`, `tinyzoo client …`) instead of `tsx node_modules/tinyzoo/cli/index.ts …`.

### Upgrade

1. Run Node 22.22.3 or newer (22.x), 24.15.0 or newer (24.x), or 26 or later; Nuxt 4.6 asks for the same.
2. Keep `drizzle-orm` (`^0.45.4`) and `drizzle-kit` (`^0.31.11`) in your `package.json`, as sites made by `tinyzoo init` have them. If `tinyzoo status` warns about drizzle-kit 1.0, go back to 0.x: `pnpm add -D "drizzle-kit@^0.31.11"`.
3. Optional: in `package.json`, change scripts like `tsx node_modules/tinyzoo/cli/index.ts generate` to `tinyzoo generate` (the same for `up`, `seed` and `client`). The old form keeps working.
