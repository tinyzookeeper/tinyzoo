---
'create-tinyzoo': minor
'tinyzoo': minor
---

`pnpm create tinyzoo` makes a new website. It asks for the languages of the content, which parts the site has (news, a contact form, redirects, a search page), whether to add the demo content, and whether to install the dependencies, then copies the starter with those choices. Every question has an option (`--languages cs,en,de`, `--presets news,forms`, `--no-demo`, `--install`, `--package-manager`, `--yes`), so it also runs in CI. `npm create tinyzoo@latest` and `yarn create tinyzoo` work too.

`tinyzoo init <folder>` takes the same options (except installing and `--yes`, which only `create-tinyzoo` has) and makes the same site: `--languages` (the first one is the default), `--presets news,forms,redirects,search` or `none`, `--no-demo`, `--package-manager`. Without options it makes what it always did. Both work in the current folder when it is empty (`pnpm create tinyzoo .`, `tinyzoo init .`): the folder itself is kept, the site is made inside it. A site made with other languages or parts than the starter's own (Czech and English, every part) needs `pnpm db:generate` and `pnpm cms:client` before its first `pnpm db:migrate`; `create-tinyzoo --install` and the next steps `init` prints say so.

The starter's website now takes its languages from `app/utils/site.ts` (with the words it draws itself in Czech, English and German, and English for any other language), and its search page is `app/pages/search.vue`. The demo content is in Czech and English, so a new site gets it only when its first language is Czech or English (`--demo` with any other first language stops with a message).

### Upgrade

Nothing. A site you already have is not changed: the starter's files are yours. To see what a fresh starter looks like now, `pnpm dlx tinyzoo init ../scratch` and compare.
