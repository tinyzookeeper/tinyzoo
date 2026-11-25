# Templates of the hosted tinyzoo

A template is a complete tinyzoo website for one field (a photographer, a restaurant…): its content model, its pages, its demo content. All twenty are designs of **one app**, `app/` (package `tinyzoo-template-app`): one build holds every template's pages and every template's content model, and each site is drawn in the design its content model names. The sign-up app (`cloud/`) builds that one app and runs every site of every template out of it (*How the cloud builds and runs the templates*, below).

| Folder | |
|---|---|
| `app/` | **the one app**: `designs.ts` (the designs and their typefaces), `cms.config.ts` (the same ids as content models, `defineModels`), `scripts/` (`dev`, `typecheck`, and the scripts that make sites, pictures and measurements by hand). It has no content model of its own, so it runs in tinyzoo's multi-tenant mode only |
| `kit/` | what templates share (`tinyzoo-template-kit`): the website's frame (pages, layout, error page, robots.txt), the settings and the page of a visit (`useSite`, `useSitePage`), looks and colour presets, `<LookPart>`, the website form without markup, the phone menu's state, texts with one marked part, helpers for addresses, prices and dates, seed helpers, the type check |
| `photographer/` | **Photographer**, the pilot: galleries by category, albums, packages, testimonials, an enquiry form |
| `wedding/` | **Wedding**: one page for the guests, with a reply form and a gift list guests reserve from |
| `<id>/` | the other eighteen, one folder per field: `individual`, `blog`, `trades`, `car-service`, `salon`, `medical`, `office`, `restaurant`, `accommodation`, `sports-club`, `studio`, `event`, `association`, `realty`, `development`, `construction`, `shop`, `software` |

Each template's looks (one to three, 52 in all) are its approved designs; their names and one-line descriptions are in `cloud/shared/templates.ts`.

("Basic website", the other template the cloud offers, is `packages/cms/starter`: it also ships in the npm package as what `create-tinyzoo` copies. Hosted templates live here instead, outside the package.)

## The rules a template follows

- **One template per field, with looks.** One content model, one set of demo content, one design of the one app. A look is a design of that template: it decides how a block is drawn, never what it holds, so a site can change its look and keep its content.
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

## A site's own content types

A site can make content types of its own in the admin (courses, events…: `docs/custom-types-plan.md`). Two blocks show them on a page, and every template has both: `...customTypeBlocks()` from tinyzoo at the end of the blocks of its `definePages`.

- **Entries** (`x_entries`): a list of one type's entries, as cards or as rows. **Chosen entries** (`x_chosen`): entries picked by hand, in the picked order.
- **The page of one entry**, at the type's address (`/kurzy/python`): the title, the picture, the short facts as one list, then the texts, the gallery and the files.

The kit draws them, the same markup for every look (`KitEntries.vue`, `KitCustomEntry.vue`; what they decide is in `app/utils/customTypes.ts`). A template brings nothing for them. A block that has nothing to show (no type chosen, a type the site does not have, no entries, a request that failed) draws nothing, and the page stands.

They take the look from what every look shares:

1. Headings and texts sit in `.prose-look`, so they are the look's.
2. Colours are inherited; lines and quiet text are made from the text colour.
3. Widths, spacing and grids are the kit's own, fluid.
4. A look may refine them with `--x-radius` (the pictures' corners), `--x-line` (the lines) and `--x-gap` (the space between cards), or a few lines of its own on the kit's `x-…` classes. Each property has a fallback, so no look has to set any.

`templates/app/scripts/custom-shots.mjs` makes a site of every look with such a type and takes pictures of both blocks and of an entry's page, with contact sheets of each template's looks side by side.

## Texts and languages

A template's own Czech texts are in one file, `texts/cs.ts`: the website's words that are not content ("Kdy", "Rezervovat", the anchors of the sections) and the demo content the seed puts in. Another language is a file beside it with the same exports. The words every template shares ("Menu", the error page) are the kit's (`kit/app/utils/kitWords.ts`, Czech and English). The admin's labels are in `cms.config.ts`, in both of the admin's languages. (Photographer, the pilot, still keeps its words in `app/utils/site.ts` and its demo content in `seed/index.ts`.)

Demo content is invented: people, places, phone numbers (Czech numbers do not start with 1: `123 456 781`), e-mail and web addresses (`.example`), account numbers (bank code `0000`), and no real product names.

The pictures of a look in the cloud's wizard come from a real site of it: mark where the look writes the site's name with `data-wordmark` (the look's `Wordmark.vue`), so `pnpm --filter tinyzoo-cloud pictures --real` can measure it and leave it out of the picture the typed name is written into.

## Demo content

**One content model, demo content worded per look.** Each design of a template was written with its own headings, lines and section order. A site made in a look gets that look's wording: `texts/cs.ts` exports `demo` (the shared texts: the first look's design) and `demoByLook` (what each other look's design words differently), and the seed lays them together (`seedLook`, `demoFor` from `tinyzoo-template-kit/seed`) and builds the home page with the sections that look's design has, in its order. The cloud tells the seed the look (`SEED_LOOK`). The content model stays one: every look draws every block, so a site that changes its look keeps its content (in the wording it was made with).


`seed/index.ts` (with `defineSeed`) is run by the cloud against the new site: `pnpm seed` in the template's folder, over HTTP, as the service account. Photographs are in `seed/media/` and listed with their alt texts in `seed/photos.ts`. The seed can run twice: entries are found by their address, files by name and size, and Site settings are only written when the site has none (`ifMissing`), so a second run never undoes what the cloud or the owner set.

## Working on a template

A template is worked on in the one app, with only its own design in the development server:

```sh
cp templates/app/.env.example templates/app/.env          # DATABASE_URL: a Postgres server; NUXT_APP_SECRET
pnpm --filter tinyzoo-template-app dev photographer       # http://localhost:3000, the admin at /admin (setup code: dev)
                                                          # --port 3001: another port; --all: every design in the server
SEED_URL=http://localhost:3000 SEED_SETUP_CODE=dev SEED_EMAIL=you@example.com SEED_PASSWORD='a long password' \
  pnpm --filter tinyzoo-template-photographer seed        # the demo content; SEED_LOOK=<look>: in that look's wording (into an empty database)
pnpm --filter tinyzoo-template-photographer typecheck     # the template's own files and the kit's, and its design in the one app
pnpm --filter tinyzoo-cloud templates:build photographer  # the one app with only this design, as the cloud runs it (a quick build)
```

`dev` makes the site's database (`tz_app_photographer_dev` on the server of `DATABASE_URL`) the first time, writes a site directory with that one site (its model and design: the template) and starts the development server with it. The template's files stay in `templates/<id>/`; the one app reads them from there.

After a change to `cms.config.ts`: in the template's folder `pnpm db:generate` (read the migration), `pnpm cms:client`, `pnpm typecheck`. The one app picks the model and the migrations up from there.

A template can still be built and run as an app of its own (`cd templates/<id> && pnpm dev`, `pnpm build`): the kit builds both ways. The cloud no longer uses those builds.

## Adding a template

1. Make `templates/<id>/` with what Wedding has outside `app/`: `package.json` (named `tinyzoo-template-<id>`, its `typecheck` script as Wedding's), `fonts.ts` (the looks' typefaces), `nuxt.config.ts`, `tsconfig.json`, `drizzle.config.ts`, `.env.example`, `.gitignore`. The pages, the layout and the error page come from the kit.
2. `looks.ts`: the looks and their presets, from the designs' `window.PRESETS` (the first preset after a `PRESETS.unshift(…)` line is the default). Ids are unique across the template. A design's `--muted` is `--quiet` here: `muted` is Nuxt UI's own name, which the admin uses.
3. `cms.config.ts`: the collections and blocks of the field. Keep `siteName`, `logo`, `look` and `colors` in Site settings under those names (the cloud writes them), with `admin.preview: '/'` so a look or colours can be tried before they are saved.
4. `texts/cs.ts`: the website's words and the demo content. `app/utils/site.ts`: `DEFAULT_LANGUAGE`, `wordsOf`, `ENTRY_PAGES` (the addresses that lead to an entry instead of a page from blocks: `/album/<slug>`; empty when there are none), `BlockOf`, and the template's own helpers. `app/assets/css/main.css`: the looks' tokens.
5. One stylesheet and one folder of components per look, ported from the design's markup, in the cascade layers the design was written in (`@layer base`, `@layer components`, or none: see the notes at the top of `oznameni.css` and `atelier.css`).
6. `seed/`: the photographs (the design's own, `template-designs/_photos/<id>/`), `photos.ts`, `index.ts`.
7. Add it to the one app: its design to `app/designs.ts`, its model to `app/cms.config.ts` (with its migrations folder), its `design.css` `@import` and an `@source` line to `app/app/assets/css/main.css` (`docs/one-app-plan.md`, 2.17, *Moving a template*, has the steps and the scripts that do the mechanical part).
8. `pnpm install`, then in the template's folder `pnpm db:generate` (name the migration `0000_init`), `pnpm cms:client`, `pnpm typecheck`.
9. In `cloud/`: the entry in `shared/templates.ts` (`hosted(…)`, each look with its default colours), the line in `scripts/lib.mjs` (`BUILT_TEMPLATES`), its checks as `scripts/e2e/<id>.mjs`. `test/unit/cloud-templates.spec.ts` keeps the cloud's list, `app/designs.ts`, `app/cms.config.ts` and each template's looks equal. Then `pnpm --filter tinyzoo-cloud templates:build <id>`, `pictures --real --only <id>` and `e2e --templates <id>`.
10. Compare every look, seeded in its own wording, with its design, section by section, on a desktop and a phone, in all three palettes.

What depends on the time (open now, today's lessons, the next match, a countdown) is worked out after the page is mounted, from a neutral first drawing, so the server's answer and the browser's agree whatever their clocks; a seed writes such demo dates relative to the day it runs.

## How the cloud builds and runs the templates

- **One build for all twenty.** `pnpm --filter tinyzoo-cloud templates:build` builds the one app (about 40 s, 6.5 GB of memory at its peak) and then the Basic website (`packages/cms/starter`), one after the other. With names (`templates:build photographer,wedding`) it builds the one app with only those designs, which is quicker; `app/.output/tinyzoo-designs.json` says which designs a build holds, and the cloud refuses a site of a template that is not in it. The fonts the build downloads are kept in one folder between builds (`cloud/README.md`, *Templates*).
- **One process for all twenty.** With the cloud's shared driver one process of the one app serves every site of every template; the Basic websites have a process of their own. Each site has its own database, its own database user and a row in the site directory; the row's `model` is the template's id, which chooses the site's content model and its design. With the local driver (one process per site, for development) each site is a process of the one app with a site directory of that one site.
- **What a site of one template cannot reach on another.** A content type of one template (its content and admin routes), a server route of one design (Wedding's `POST /api/gift/:id/reserve`) answers 404 on a site of another template; each site's database holds only its own model's tables. `pnpm --filter tinyzoo-cloud e2e:shared` checks it with real sites.
