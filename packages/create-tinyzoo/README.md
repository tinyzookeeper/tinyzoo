# create-tinyzoo

Make a new website with [tinyzoo](https://github.com/tinyzookeeper/tinyzoo), a code-first CMS
for Nuxt 4.

```bash
pnpm create tinyzoo my-site
# or: npm create tinyzoo@latest my-site
# or: yarn create tinyzoo my-site · bun create tinyzoo my-site
```

It asks for the **languages** of the content, which **parts** the site has (news, a contact
form, redirects, a search page), whether to fill it with **demo content**, and whether to
**install** the dependencies. Then it copies tinyzoo's starter into the folder, with the
parts and languages you chose, and tells you what to run next. Every question has an option,
so it also runs without a terminal:

```bash
pnpm create tinyzoo my-site --languages de,en --presets news,search --no-demo --yes
npm create tinyzoo@latest my-site -- --languages de,en --yes     # npm: options after --
```

| Option | |
|---|---|
| `--languages cs,en,de` | the content languages; the first is the default (default: `cs,en`) |
| `--presets news,forms,redirects,search` | the parts of the site, or `none` / `all` (default: all) |
| `--demo` / `--no-demo` | demo content (a small bakery, in Czech and English) or an empty site |
| `--install` / `--no-install` | install the dependencies right away |
| `--package-manager pnpm` | `pnpm`, `npm`, `yarn` or `bun` (default: the one you ran this with) |
| `--yes` | ask nothing |

Ctrl-C at a question stops without writing anything. A folder that is not empty is refused.
The same site, without the questions: `tinyzoo init my-site` with the same options.

This package carries the starter of the matching `tinyzoo` version, so it needs no other
package to make a site (the new site depends on `tinyzoo` and `@tinyzoo/client` at that version).
Documentation: [Getting started](https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/guide/getting-started.md).
