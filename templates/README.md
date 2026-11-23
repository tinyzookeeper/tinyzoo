# Templates of the hosted tinyzoo

A template is a complete tinyzoo website for one field (a photographer, a restaurant…): its content model, its pages, its demo content. The sign-up app (`cloud/`) builds each template once and runs every site made from it out of that one build.

| Folder | |
|---|---|
| `kit/` | what templates share (`tinyzoo-template-kit`): the website's frame (pages, layout, error page, robots.txt), the settings and the page of a visit (`useSite`, `useSitePage`), looks and colour presets, `<LookPart>`, the website form without markup, the phone menu's state, texts with one marked part, helpers for addresses, prices and dates, seed helpers, the type check |
| `photographer/` | **Photographer**: galleries by category, albums, packages, testimonials, an enquiry form. Three looks: Ateliér, Negativ, Zápisník |
| `wedding/` | **Wedding**: one page for the guests: the invitation, the story, the programme, the place and the way there, where to stay, a reply form, a gift list guests reserve from, questions, contacts. Three looks: Oznámení, Večer, Magazín |

("Basic website", the other template the cloud offers, is `packages/cms/starter`: it also ships in the npm package as what `create-tinyzoo` copies. Hosted templates live here instead, outside the package.)

## The rules a template follows

- **One template per field, with looks.** One content model, one set of demo content, one build. A look is a design of that template: it decides how a block is drawn, never what it holds, so a site can change its look and keep its content.
- **Nothing of one site in the build.** The look, the colours, the name and the logo come from the site's own settings at run time. The admin's name too: `cms.admin.nameFrom: 'siteSettings.siteName'` in `app/app.config.ts`.
- **The schema is code.** Collections, globals and blocks are declared in `cms.config.ts`; editors change content and arrange blocks.
- **Built from blocks.** Every full-width section is a block of the page; every list (albums, packages, testimonials) comes from a collection.

## How a look works

1. `looks.ts` (beside `cms.config.ts`) lists the looks with `defineLooks` from the kit: an id, a name, and each look's colour presets (CSS variables). The first look and each look's first preset are the defaults.
2. `cms.config.ts` puts two choices into Site settings: `look: f.select(looks.fields.look)` and `colors: f.select(looks.fields.colors)`. The colours offer only the chosen look's presets, each with its colours as dots, and follow the look when it changes (`f.select({ optionsBy, swatches })`).
3. The website's layout (the kit's) reads the settings, resolves them (`looks.resolve(look, colors)`: colours that belong to another look give way to the look's own) and puts them on the page with `useLookHead`: `<html data-look="atelier" data-colors="bronz" style="--brand:…">`. It is rendered on the server, so the first answer is already right.
4. Each look's CSS is one file, `app/assets/css/<look>.css`, written under `html[data-look="<look>"]`. The Tailwind tokens (`bg-paper`, `text-ink`, `font-display`…) are shared and point at CSS variables the look sets.
5. Each part of the site exists once per look with the same props: `app/components/<look>/Hero.vue`, `…/Gallery.vue`, `…/Header.vue`… `<LookPart part="Hero" …>` (the kit's) draws the one of the site's look: every folder under `app/components/` except `global/` is a look. The block components (`app/components/global/Block<Type>.vue`) fetch what a block needs (albums, packages) once and hand it to `LookPart`. Every look has `Header`, `Footer`, `Message` (the error page) and a part per block.

The cloud lists the same look ids in `cloud/shared/templates.ts` (with the texts of the wizard) and writes the chosen one into `look`, and its default colours into `colors`, when it makes a site. `test/unit/cloud-templates.spec.ts` keeps the two lists equal.

A few things let one set of content serve looks that differ a lot:

- **A photograph for dark looks.** The opening block holds its photographs and, optionally, one more for looks that lay the heading over the picture (Photographer's `darkImage`, Wedding's `nightImage`). Which looks those are is the template's own list (`openingPhoto`, `invitationPhoto` in `app/utils/site.ts`); they fall back to the first photograph.
- **One list of photographs, taken from differently.** Where designs place photographs differently, a block holds a list and each look takes its part of it (Wedding's `programmePhotos`, `placePhotos`: the first, the last, both). The rules are in one place, `app/utils/site.ts`, and the field's help says them to the editor. A gallery leaves out what the page already shows in that look, so no picture shows twice.
- **One behaviour, drawn per look.** A part that behaves the same everywhere is one component whose looks are only styles: `PhotoLightbox.vue` (an album's photograph opened large: arrows, swipe, Escape) is drawn by the `.lb…` rules of each look's stylesheet; Wedding's `RsvpFields.vue` (the reply form's fields) by each look's `.field`, `.choice` and `.check`.
- **Rows that are swiped on a phone** are Nuxt UI's `UCarousel` (Embla), never a scrolling box with a scrollbar.

## Texts and languages

A template's own Czech texts are in one file, `texts/cs.ts`: the website's words that are not content ("Kdy", "Rezervovat", the anchors of the sections) and the demo content the seed puts in. Another language is a file beside it with the same exports. The words every template shares ("Menu", the error page) are the kit's (`kit/app/utils/kitWords.ts`, Czech and English). The admin's labels are in `cms.config.ts`, in both of the admin's languages. (Photographer, the pilot, still keeps its words in `app/utils/site.ts` and its demo content in `seed/index.ts`.)

Demo content is invented: people, places, phone numbers (Czech numbers do not start with 1: `123 456 781`), e-mail and web addresses (`.example`), account numbers (bank code `0000`), and no real product names.

The pictures of a look in the cloud's wizard come from a real site of it: mark where the look writes the site's name with `data-wordmark` (the look's `Wordmark.vue`), so `pnpm --filter tinyzoo-cloud pictures --real` can measure it and leave it out of the picture the typed name is written into.

## Demo content

`seed/index.ts` (with `defineSeed`) is run by the cloud against the new site: `pnpm seed` in the template's folder, over HTTP, as the service account. Photographs are in `seed/media/` and listed with their alt texts in `seed/photos.ts`. The seed can run twice: entries are found by their address, files by name and size, and Site settings are only written when the site has none (`ifMissing`), so a second run never undoes what the cloud or the owner set.

## Working on a template

```sh
cd templates/photographer
cp .env.example .env                      # a database of its own: tz_tpl_photographer_dev
pnpm dev                                  # http://localhost:3000, the admin at /admin
SEED_EMAIL=you@example.com SEED_PASSWORD='a long password' pnpm seed
pnpm typecheck                            # the template's own files and the kit's
pnpm --filter tinyzoo-cloud templates:build photographer   # the build the cloud runs
```

After a change to `cms.config.ts`: `pnpm db:generate` (read the migration), `pnpm cms:client`, `pnpm typecheck`.

## Adding a template

1. Make `templates/<id>/` with what Wedding has outside `app/`: `package.json` (named `tinyzoo-template-<id>`), `nuxt.config.ts` (the looks' typefaces), `tsconfig.json`, `drizzle.config.ts`, `.env.example`, `.gitignore`. The pages, the layout and the error page come from the kit.
2. `looks.ts`: the looks and their presets, from the designs' `window.PRESETS` (the first preset after a `PRESETS.unshift(…)` line is the default). Ids are unique across the template. A design's `--muted` is `--quiet` here: `muted` is Nuxt UI's own name, which the admin uses.
3. `cms.config.ts`: the collections and blocks of the field. Keep `siteName`, `logo`, `look` and `colors` in Site settings under those names (the cloud writes them), with `admin.preview: '/'` so a look or colours can be tried before they are saved.
4. `texts/cs.ts`: the website's words and the demo content. `app/utils/site.ts`: `DEFAULT_LANGUAGE`, `wordsOf`, `ENTRY_PAGES` (the addresses that lead to an entry instead of a page from blocks: `/album/<slug>`; empty when there are none), `BlockOf`, and the template's own helpers. `app/assets/css/main.css`: the looks' tokens.
5. One stylesheet and one folder of components per look, ported from the design's markup, in the cascade layers the design was written in (`@layer base`, `@layer components`, or none: see the notes at the top of `oznameni.css` and `atelier.css`).
6. `seed/`: the photographs (the design's own, `template-designs/_photos/<id>/`), `photos.ts`, `index.ts`.
7. `pnpm install`, then in the template's folder `pnpm db:generate` (name the migration `0000_init`), `pnpm cms:client`, `pnpm typecheck`.
8. In `cloud/`: the entry in `shared/templates.ts` (`hosted(…)`, each look with its default colours), the line in `scripts/lib.mjs` (`BUILT_TEMPLATES`), its checks in `scripts/e2e-templates.mjs`, its looks in `test/unit/cloud-templates.spec.ts` (`HOSTED_LOOKS`); then `pnpm --filter tinyzoo-cloud templates:build <id>`, `pictures --real --only <id>` and `e2e --templates <id>`.
9. Compare every look with its design, section by section, on a desktop and a phone, in all three palettes.
