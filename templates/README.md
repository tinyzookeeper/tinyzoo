# Templates of the hosted tinyzoo

A template is a complete tinyzoo website for one field (a photographer, a restaurant…): its content model, its pages, its demo content. The sign-up app (`cloud/`) builds each template once and runs every site made from it out of that one build.

| Folder | |
|---|---|
| `kit/` | what templates share (`tinyzoo-template-kit`): looks and colour presets, the website form without markup, the phone menu's state, texts with one marked part, seed helpers |
| `photographer/` | **Photographer**: galleries by category, albums, packages, testimonials, an enquiry form. Three looks: Ateliér, Negativ, Zápisník |

("Basic website", the other template the cloud offers, is `packages/cms/starter`: it also ships in the npm package as what `create-tinyzoo` copies. Hosted templates live here instead, outside the package.)

## The rules a template follows

- **One template per field, with looks.** One content model, one set of demo content, one build. A look is a design of that template: it decides how a block is drawn, never what it holds, so a site can change its look and keep its content.
- **Nothing of one site in the build.** The look, the colours, the name and the logo come from the site's own settings at run time.
- **The schema is code.** Collections, globals and blocks are declared in `cms.config.ts`; editors change content and arrange blocks.
- **Built from blocks.** Every full-width section is a block of the page; every list (albums, packages, testimonials) comes from a collection.

## How a look works

1. `looks.ts` (beside `cms.config.ts`) lists the looks with `defineLooks` from the kit: an id, a name, and each look's colour presets (CSS variables). The first look and each look's first preset are the defaults.
2. `cms.config.ts` puts two choices into Site settings, `look` and `colors`, with the ids from `looks.ts` as their options.
3. The website's layout reads the settings, resolves them (`looks.resolve(look, colors)`: colours that belong to another look give way to the look's own) and puts them on the page with `useLookHead`: `<html data-look="atelier" data-colors="bronz" style="--brand:…">`. It is rendered on the server, so the first answer is already right.
4. Each look's CSS is one file, `app/assets/css/<look>.css`, written under `html[data-look="<look>"]`. The Tailwind tokens (`bg-paper`, `text-ink`, `font-display`…) are shared and point at CSS variables the look sets.
5. Each part of the site exists once per look with the same props: `app/components/<look>/Hero.vue`, `…/Gallery.vue`, `…/Header.vue`… `<LookPart part="Hero" …>` draws the one of the site's look. The block components (`app/components/global/Block<Type>.vue`) fetch what a block needs (albums, packages) once and hand it to `LookPart`.

The cloud lists the same look ids in `cloud/shared/templates.ts` (with the texts and pictures of the wizard) and writes the chosen one into `look`, and its default colours into `colors`, when it makes a site. `test/unit/cloud-templates.spec.ts` keeps the two lists equal.

## Demo content

`seed/index.ts` (with `defineSeed`) is run by the cloud against the new site: `pnpm seed` in the template's folder, over HTTP, as the service account. Photographs are in `seed/media/` and listed with their alt texts in `seed/photos.ts`. The seed can run twice: entries are found by their address, files by name and size, and Site settings are only written when the site has none (`ifMissing`), so a second run never undoes what the cloud or the owner set.

## Working on a template

```sh
cd templates/photographer
cp .env.example .env                      # a database of its own: tz_tpl_photographer_dev
pnpm dev                                  # http://localhost:3000, the admin at /admin
SEED_EMAIL=you@example.com SEED_PASSWORD='a long password' pnpm seed
pnpm typecheck
pnpm --filter tinyzoo-cloud templates:build photographer   # the build the cloud runs
```

After a change to `cms.config.ts`: `pnpm db:generate` (read the migration), `pnpm cms:client`, `pnpm typecheck`.

## Adding a template

1. Copy `photographer/` to `templates/<id>/`, name the package `tinyzoo-template-<id>`.
2. `looks.ts`: the looks and their presets, from the designs' `window.PRESETS` (the first preset after a `PRESETS.unshift(…)` line is the default).
3. `cms.config.ts`: the collections and blocks of the field. Keep `siteName`, `logo`, `look` and `colors` in Site settings under those names: the cloud writes them.
4. One stylesheet and one folder of components per look, ported from the design's markup. A look written without cascade layers in the design stays without them (see the note at the top of `atelier.css`).
5. `seed/`: the photographs, `photos.ts`, `index.ts`.
6. `pnpm db:generate && pnpm cms:client && pnpm typecheck`.
7. In `cloud/`: the entry in `shared/templates.ts` (`ready: true`, `sourceDir`, `looks`, pictures under `public/templates/`), the line in `scripts/build-templates.mjs` and in `scripts/lib.mjs` (`templateEntries`), and the root `typecheck` script.
