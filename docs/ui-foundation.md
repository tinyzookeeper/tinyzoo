# UI foundation — tinyzoo's admin

Playful, calm, simple (docs/brand/brand-guide.md), for non-technical editors and
small business owners. A white workspace that stays out of the way of the client's
content; the brand speaks only in **moments**. Light and dark are equal citizens,
and every screen works on a phone. Live reference: `/design-system` on the tinyzoo
website (`site/app/pages/design-system.vue`).

Research: `docs/research/admin-ux-references.md` (structure),
`docs/research/admin-ux-calm.md` (calm screens), `docs/research/admin-brand-references.md`
(brand personality, warm dark mode). Mockups and decisions: November 2026 redesign.

*History: a warm "editorial" look (beige paper greys, serif titles) was rejected; a
neutral Geist version followed; this brand-led version replaced it (2026-11-13). The
cream stays out of the workspace on purpose.*

## Where things live

| What | Where |
|---|---|
| Tokens (colour, type, radius, surfaces, editor layouts) | `packages/cms/app/assets/css/cms-admin.css` |
| Branding & languages (host-overridable) | `cms.admin` in `app.config.ts` (defaults in the layer's `app/app.config.ts`) |
| The resolved theme (name, colour, logos, animals) | `packages/cms/src/theme.ts`, `src/themeLogo.ts`, `src/themeAnimals.ts`; on the server `server/utils/cmsAdminTheme.ts` (`GET /api/cms/_theme`); PNG logos and the manifest `server/utils/cmsBrandFiles.ts`, `cmsBrandSource.ts` (`GET /api/cms/_brand/<file>`) |
| Fonts | `fonts.families` in `packages/cms/nuxt.config.ts` (@nuxt/fonts, self-hosted at build) |
| Brand assets, animals | `packages/cms/app/assets/brand`, `app/utils/cmsBrand.ts` (`cmsCharacter('owl')`) |
| Interface strings | `packages/cms/app/i18n/{en,cs}.ts`, used through `useCmsI18n()` |
| Editor / list arrangement rules | `editorLayout()` / `listLayout()` in `packages/cms/src/entity.ts` |

## Scoping: the admin never fights the website

The CMS runs inside the client's own Nuxt app, which has its own theme. All admin
tokens are scoped to `html[data-cms-admin]`, which the admin layout sets on
`<html>` (with `lang` and `data-cms-accent`). Scoping on `<html>` rather than
a wrapper div also covers what Nuxt UI teleports to `<body>` (modals, menus,
toasts). Nuxt UI reads `--ui-color-*` and the role variables (`--ui-primary`,
`--ui-text-muted`, …); the admin overrides them at a higher specificity than
Nuxt UI's `:root`. The website's pages are untouched.

## Colour

**Light** — a white workspace:
- True greys (OKLCH chroma 0), ink `#131313` for headings and important text.
- **Charcoal `#2E3035`** for the one primary action per screen (white text).
- **Cream `#F9F5EF`** only for moments: the sign-in background, the home welcome,
  the current page in the sidebar, hints. Never as the page or card background.

**Dark — "charcoal night"**: every grey is tinted toward the mascot's charcoal
(page `#18191C`, cards `#1E1F23`, moments and the current page `#2E3035`), text is
cream, and the primary flips to a **cream button with ink text** — the reversed logo
as an interface. No pure black or white.

Status is the only other colour: Draft = grey ring, On the website = green,
Scheduled = blue clock, warnings = amber, errors = red.

**One word per state, everywhere** (the editor's bar, the language menu, the list, the home page, the
search): *Draft*, *On the website* (cs *Na webu*, de *Auf der Website*), *Scheduled*, for a
translation held back by the default language *Waiting for Czech*, and for a translation that has never
been on the website *Being translated* (cs *Překládá se*, de *Wird übersetzt*; a muted languages mark,
with "Visitors see the Czech version until an editor publishes this one." in its tooltip). With content languages the state
names its language: "English · Draft" (on a phone the bar has room for the mark and the code only, "○ EN ▾"; the words are the menu's lines and the button's name).

Client accents: `cms.admin.accent` = `indigo`, `blue`, `violet` or `emerald` replaces
charcoal, or the client's brand colour as a hex (below). The colour presets fill solid buttons with
their 600 shade (emerald 700) and white text in light mode, and with their 400 shade and ink text in
dark mode (6:1 or more; white there was 1.9–3.1:1).

### Brand colours

`cms.admin.accent: '#B4532A'` is resolved by `resolveAdminTheme()` (`packages/cms/src/theme.ts`),
on the server at runtime. The admin sets `data-cms-accent="brand"` and writes the variables in a
`<style>` scoped to `html[data-cms-admin][data-cms-accent='brand']` (light and `.dark`). The five built-in
accents are drawn by `cms-admin.css` as before; `src/theme.ts` carries their hexes for the emails, and
a test checks the two agree.

How the colours are derived, in OKLCH:

- **Shades 50…950** (`--ui-color-primary-*`): the lightness of each shade as in the built-in ramps
  (97 % … 28 %), the hue kept, the chroma tapering toward both ends. The shade nearest the brand
  colour's own lightness is the brand colour itself.
- **Light mode** has two roles. The **fill** of solid buttons and badges (`--cms-accent-fill`) is the
  brand colour, with white or ink text (`--cms-accent-on-fill`), whichever reads better.
  The **text shade** (`--ui-primary`) is used for links, the active menu item, focus rings, checked
  boxes, switches and selected borders. It is the brand colour when that reads on white, otherwise
  a darker shade of it. `cms-admin.css` points solid buttons and badges (`[data-slot='base'].bg-primary`)
  at the fill. Everything else uses `--ui-primary`.
- **Dark mode**: one lighter colour for both roles. It is the 400 shade, or the brand colour when that is
  lighter still, with ink text.
- **Under the pointer** (and pressed) a solid button takes `--cms-accent-fill-hover`, not Nuxt UI's fill
  at 75 % (which took white text down to 2.9:1): one step (0.06 OKLCH lightness) away from its text,
  darker under white and lighter under ink, so the text reads better rather than worse. A fill with no
  room that way (black, cream, a pale yellow that would vanish) steps the other way as far as its text
  still reads at 4.5:1. The presets use their next shade (light: 700, emerald 800; dark: 300; mono
  `#1E1F23` and `#EEEAE4`). The rule matches Nuxt UI's `hover:bg-primary/75` and
  `active:bg-primary/75` classes, so it covers every accent.
- **Focus rings** are `--cms-accent-ring`: the text shade in light mode, the dark colour in dark mode,
  never the fill (a yellow brand's ring is its dark yellow), declared on `<html>` so a solid button that
  re-points `--ui-primary` keeps it. Every Nuxt UI focus outline (its `focus-visible:outline-3`, 25 %
  of the accent, 1.1–1.6:1 on white) is redrawn at full strength: 2 px, 2 px off the control, so it
  sits on the page; text fields hug theirs (2 px, or 1 px against the field's own 1 px ring); the
  menu's links draw it around their highlight. A plain link keeps the browser's own ring, in
  `--cms-accent-ring` (only `outline-color` is set, so nothing that had no ring gains one).
- **Menu items** (dropdowns, selects, select menus, the search) draw the ring 2 px inside their highlight
  when the keyboard reaches them; Nuxt UI's highlight alone (`bg-elevated/50`) is 1.04:1 on the menu (1.09:1
  in dark mode). A dropdown or a plain select moves the focus to the item (`:focus-visible`); a select menu
  and the search keep it in their search box and mark the item with `data-highlighted`, as the pointer
  does, so the admin layout notes whether the keyboard was the last thing used (`data-cms-keys` on
  `<html>`, `cmsTrackKeys`: set by a key, cleared when the pointer moves or presses). Under the pointer an
  item looks as before.
- **Borderless text** (the big title, the summary under it) and a **rich-text field** take the ring when
  they have the cursor, from a click too, as every field does: the title and summary 2 px, 0.375 rem off the
  text; a rich-text field's own line turns the accent with 1 px of outline on it (2 px in all); in the
  writing column, where the text has no box, 2 px round the text and its toolbar.

**The contrast guard** checks the hexes the admin draws (WCAG 2 ratios):

| What | On | Bar |
|---|---|---|
| Text on a solid button | the fill, and the hover fill | 4.5:1 |
| The text shade | white, the brand's own light moment (in place of cream), the hover grey `#F5F5F5`, its own tint up to 20 % over white | 4.5:1 |
| The dark colour | `#18191C`, `#1E1F23`, `#2E3035`, the brand's own dark moment, its own tint up to 20 % over the page and cards | 4.5:1 |
| Focus rings, borders | every surface (the stronger cream `#F1EADF` and dark `#383B41` included) | 3:1 (follows from the text bar) |
| A button that shows | white and cream | 1.25:1 (not a WCAG bar; it stops a white brand from drawing invisible buttons) |

The tint is Nuxt UI's: soft buttons at 10 %, their hover and the search's matched letters at 15 %, the
calendar's hovered "today" at 20 %. Accent text does not sit on the stronger cream (`#F1EADF`), the
pressed grey (neutral-200), or a tint over cream or charcoal anywhere in the admin, so the guard does not
check those; a site's own component that puts it there is not covered. The five built-in accents are
not run through the guard. With Nuxt UI's 15–20 %, blue, violet and emerald (and indigo in dark mode) read
3.9–4.4:1 as text on their own tint, so `cms-admin.css` draws those tints lighter for them
(`--cms-accent-tint`, `-hover`, `-strong`, set with each preset): each as strong as it can be with the
text at 4.5:1 on white (light) or on the page and cards (dark), half a point to spare, never stronger than
Nuxt UI's; where the hover would then sit less than 3 points above the rest, the rest steps down too.

| Preset | Light: rest / hover / strong | Dark |
|---|---|---|
| mono, a brand colour | 10 / 15 / 20 % (Nuxt UI's) | 10 / 15 / 20 % |
| indigo | 10 / 15 / 20 % | 7.5 / 10.5 / 10.5 % |
| blue | 6.5 / 9.5 / 9.5 % | 10 / 15 / 18.5 % |
| violet | 10 / 15 / 16 % | 10 / 15 / 15.5 % |
| emerald | 8.5 / 11.5 / 11.5 % | 10 / 15 / 20 % |

The rules match Nuxt UI's classes (`bg-primary/10` with `hover:bg-primary/15`, `active:bg-primary/15`,
`[&>mark]:bg-primary/15`, the calendar's `data-highlighted:` and `hover:not-data-selected:bg-primary/20`), so
a soft or subtle button, the search's matched letters and the calendar's hovered day follow them.

A colour that fails moves to the nearest one that passes, by OKLCH lightness only: the hue stays and
the chroma stays as far as sRGB allows. The fill may go either way, the text shade only darker, the dark
colour only lighter. A colour the guard produced passes as it is, so resolving it again changes nothing.
What changed goes into the theme's `notes`, printed in development (the server log at start, the browser
console once per browser session, again when the notes change) and dropped in production. Tests: `test/unit/admin-accent.spec.ts` (a few hundred colours)
and `test/unit/admin-contrast.spec.ts` (against the stylesheet's real surfaces).

### Brand moments and animals

With a brand colour the whole look follows it (decided 2026-11-18): where tinyzoo draws cream (light) and
charcoal (dark), a brand draws calm paper with a hint of itself. `brandMoments()` in `src/theme.ts` derives
every token the stylesheet sets for the moments, light and dark, and `adminAccentCss` writes them in the same
`<style>` as the accent: `--cms-moment-bg`, `--cms-moment-strong`, `--cms-moment-line`, `--cms-moment-text`,
`--cms-nav-active`, `--cms-auth-bg`, and the animals' `--cms-animal-body` and `--cms-animal-face`.

- **Hue and chroma.** The brand's OKLCH hue, and 7 % of its chroma, capped at 0.009 in light mode (cream's
  own chroma; 0.02 read as peach for a terracotta) and 0.008 in dark mode (charcoal is 0.0094; more read as
  brown). The stronger tint and the line keep cream's ratios (1.8× and 2.6× the chroma), the dark ones
  charcoal's. A near-grey brand gives near-grey moments.
- **Lightness.** Cream's and charcoal's: light `0.975` (strong `0.94`, line `0.90`, quiet text `0.517`), dark
  `0.309` (strong `0.352`, line `0.394`, quiet text `0.752`). Two clamps by WCAG luminance: a light moment is
  never darker than the hover grey `#F5F5F5`, a dark one never lighter than charcoal `#2E3035`. Every text
  role and the accent already read at 4.5:1 on those, so they read on the moments too, and the accent a
  colour gets is the same with or without them (the guard stays idempotent). The quiet text inside a moment
  is checked on its own and moves by lightness until it reads at 4.5:1.
- **What stays cream.** Dark mode's highlighted text (`--ui-text-highlighted`) and inverted surfaces
  (`--ui-bg-inverted`), and the light end of the dark grey ramp, stay tinyzoo's cream: they are text and
  the reversed primary of mono, not moments, and tinting every heading toward the brand would colour the
  workspace, which stays neutral.
- **The logo's tile.** In dark mode a light logo without its dark version sits on a small light tile
  (`CmsBrandLogo`). With a brand colour the tile is the brand's light moment (`--cms-logo-plate`, written
  in both schemes by `adminAccentCss`), so the logo reads as on the brand's own paper; otherwise cream.
- **Animals.** Every animal file (`app/assets/brand/characters/{muted,bright}`) is drawn in exactly two
  colours: a body and a near-white face (`#F9F7F3`, `#F9F7F4`, `#F9F8F4`; a test fails if a new animal breaks
  this). A brand admin draws them inline (`CmsAnimal`, `src/themeAnimals.ts`) with those two fills replaced
  by classes coloured from the two variables, so the server renders them in colour and they follow light
  and dark. The body is one muted shade of the brand: lightness around the family's `0.68` (it follows the
  brand a little, `0.65`–`0.74`; a yellow stays light), chroma at most `0.09` (70 % of the brand's), `0.04`
  lighter in dark mode; the face is a near-white tint (`0.977`, chroma at most `0.006`). The bright six on the
  first-run setup take the same shade. The drawings are loaded lazily (one small chunk each, only in a brand
  admin), before the first render; tinyzoo's own look and the built-in accents keep the `<img>`.
- **`cms.admin.animals: false`** (`theme.animals`) leaves every animal out, for any accent; each place closes
  up around it (an empty place shows its plain icon tile).

Mono and the four colour presets have no `moments` and write no `<style>`: cream, charcoal and the colourful
family, exactly as before.

## Type

- **Manrope** (the wordmark's face), bold with tight tracking, for page titles (28 px),
  entry titles (30–36 px), greetings and moments — the `.cms-display` class.
- **Inter** for everything you operate: navigation, labels, fields, tables, buttons;
  body 14–15 px, meta 12–13 px, `tabular-nums` for counts and dates.
- **Geist Mono** for web addresses.

## Shape & surfaces

- Radius 8 px for controls, 12 px for cards (`.cms-card`), 16 px for moments.
- Flat: hairline borders, no shadows — except a moment that arrives (the success card).
- `.cms-page` owns the gutters and the width (72 rem; `narrow` 48 rem for settings,
  `wide` for the Preview arrangement).

## Moments — where the brand speaks

One animal, a Manrope line, one sentence, at most two actions. At most one playful
sentence per screen; labels, errors and delete confirmations stay plain.

| Moment | Animal | Where |
|---|---|---|
| Sign-in, reset, invitation | hedgehog (setup: the bright six) | `layouts/cms-auth.vue` — cream (a brand's tint), no card |
| Welcome | owl | home page, with the quick-add buttons |
| Empty place | a muted animal per collection (always the same) | `CmsEmptyState` (80 px) |
| Before publishing | bird | `CmsPublishReview` |
| Live / scheduled | whale / turtle | `CmsMoment` (corner card, leaves by itself) |

"No results" and errors get no animal. Every animal is a `CmsAnimal` behind `useCmsAnimals()`
(`cms.admin.animals`); with a brand colour it is drawn in the brand's muted shade (see Brand moments and animals).

## Shell

`UDashboardGroup` + `UDashboardSidebar` (16 rem, resizable, collapsible to icons, a
slide-over menu on phones). The client's brand leads at the top (`CmsBrandLogo`: the full
logo, else the mark and the name, else the initials and the name; folded: the mark or the
initials; on phones the top bar carries the mark too); the current page sits on cream (a brand's tint);
**tinyzoo signs** under the account button (`signature: false` hides it). In dark mode a
light logo without its dark version sits on a small cream tile (a brand's light tint). Groups: Home, Content,
Settings, then View website and the account menu (appearance, language, sign out).

The Write and Preview editors **fold the sidebar to icons** (`useCmsFocus`); leaving
them restores what the person chose (kept apart in `localStorage`).

## The top bar

- Lists and settings: breadcrumbs, then the page's actions.
- **Editors: one bar for every arrangement** — `‹ Back · status · saved` on the left;
  language, history, Details (Write), Preview, the primary action and "…" on the right.
  Words for the actions that matter ("Preview", "Publish…", "Details"); icon-only only
  for secondary tools (history).
- With content languages the status names whose it is ("English · Draft"); on a phone the status is also
  the language switcher, drawn as the state's mark and the language's code ("○ EN ▾", "● EN ▾", a clock, an
  hourglass or the languages mark for scheduled, waiting and being translated): the words would be cut off, so
  they are the button's accessible name and the lines of the menu it opens (tap it for the other languages and
  their states). "Saved … ago" is the translation's own time, never the original's.
- Phones: back, status, the primary action and "…" (which then also holds Save draft,
  Preview, History and Language).

## Editors — three arrangements, picked from the content

The same parts (title, fields, details) arranged for the job. Editors never switch
modes; developers can override with `admin.editor` in `defineEntity`.

| Arrangement | When (default rule) | Layout |
|---|---|---|
| **Write** | a rich-text body and a page on the website (news) | sidebar folded; one centred column as the reader meets it: cover photo ("Change photo" on it), title, summary as large unboxed text, the text with a quiet sticky toolbar line and no box; details beside it (toggle "Details"): quiet label/value rows, then `admin.tabs` after the first and `.group()` fields as folded groups saying what is filled in |
| **Form** | facts to fill in (events, partners, settings) | every field in titled sections in one centred column; a details column on the right (where it is on the website, created, languages) |
| **Preview** | the layout is the point: blocks, or a global with `admin.preview` (the home page) | the same sections beside the live page; a full-screen sheet on phones |

The editor is one full-height grid (`.cms-editor`): the details column's divider runs
from the top bar to the bottom of the window, at any length of form.

### Forms — sections as questions

`CmsFormSections` lays out the form and preview editors and every global:

- **Sections** from `admin.sections` (label, icon, description, fields, `columns: 2`
  for short fields side by side), best named as plain questions: *What is it? When?
  Where?* Each heading has a cream icon tile. Fields no section lists follow, grouped
  by kind; without any configuration a form of six fields or more is grouped by kind,
  a shorter one has no headings.
- **"+ Add …"**: optional fields still empty wait behind a dashed button at the end of
  their section (never a whole section, never switches or text bodies, never a field
  with an error; a field once filled stays). Sectioned forms do not say *Optional*.
- **Folded groups**: `.group()` fields (e.g. *Search & sharing*) fold away at the end
  with a one-line summary ("1 of 3 filled in").
- **Section menu** beside the column when there are four sections or more and ten
  fields or more, and the room for it (a container query on the editor's main area).
- **Controls**: an icon inside the box for the kind of value (dates, links, e-mails, or
  the developer's `.icon()`); a link can be opened from its box; dates are picked from a
  calendar in the admin's language and typed times, with *All day* for
  `f.datetime({ allDay: true })`; a choice of up to five options is a row of buttons
  (with `f.select({ icons })`) in the content column, a dropdown elsewhere; a switch is
  one row whose help text is its sentence; a new entry starts with the fields' defaults.

The live page follows the typing (a quarter of a second after it stops): the unsaved
values are laid over the entry for this editor's `?preview` requests, and the page
refetches its content in place, keeping its scroll. The live page is available as **Preview** wherever there is a page; it is on by
default only in the Preview arrangement, and each collection remembers the choice.

**A field someone may not change** (`.access({ edit })`) looks locked: the raised grey as its fill, a lock
inside it, and one sentence under it naming who can change it ("Only Editor and Administrator can change
this", the roles by their labels). No "Read only" tag beside the label: it is said once.

**Translating.** An empty translated field shows the default language's text greyed inside it (the
placeholder of a text, the original behind an empty rich text). That is said **once**, in one line at the top
of the form while any field is empty ("Empty fields show the Czech text in grey until you translate them."),
and each empty field keeps only its action, "Use it as a start" (above a text body, under a short field). A
field already translated shows the original quietly under it ("Czech: …"). On 1280 px and wider the main text can show
the original beside it ("Show the original beside it", remembered in the browser).

**An address that is not live** (a draft, a scheduled or a waiting language) is never drawn as a link: it
says "Not on the website yet" and offers the preview. "View on the website" appears only for a live page.

**Publishing** goes through `CmsPublishReview`: what is ready, what is missing (the
text body, the main picture, other languages — each with the fix), now or scheduled.
Warnings never block; the form's validation still does. Afterwards `CmsMoment`
confirms it ("It's on the website.") with "View on the website". Settings (globals)
have no drafts: **Save** puts them on the website and says so.
For one language (publishing per language) the review is titled for it ("Publish the English version";
"The other languages stay as they are"); an empty translated field says visitors see the default
language's text there (a warning with "Translate", never blocking, a required field included); and while
the default language is a draft it says first that this version goes live together with it, "Right now"
says so too, and the moment after is "Ready to go." (the turtle), not "It's on the website."

**Roles in words.** The Team page names each role with one sentence (the invitation's cards, the "Change
role" menu): the built-ins' own, a site role's `description`, or one made from its definition ("Edits Posts
and Pages. Only reads Authors… Cannot publish: drafts only. Changes only the files they uploaded.").
**What can each role do?** (Team's top bar and the invitation) shows them side by side, built-ins included:
changes, only reads, publishes, files, and how many people have each; one card per role on a phone.

### An item beside its list (peek)

The media library opens a file in a panel **docked** on the right, never over the page
(as Plane opens an issue): the list stays usable, clicking another file switches the
panel (saving the open one's changes first), Esc or × closes it, and the address keeps
`?file=…` so it can be linked. Drag the panel's edge (or use the arrow keys on it) to
resize it; the width is remembered, a double-click resets it. On phones the panel is a
page of its own with "‹ Media library". Overlays (`UModal`, `USlideover`) are for short
decisions only — confirmations, pickers — not for editing.
Questions ("Leave without saving?", "Discard changes?", "Delete …?") use the
admin's own dialog (`await useCmsConfirm()({ title, description, confirmLabel, … })`),
never `window.confirm`: a cream tile and the usual dark button, red only for deleting
for good; the safe answer has the focus, so Enter or Esc loses nothing. Only closing
the browser tab with unsaved changes still gets the browser's own prompt.

## Lists — three looks, picked from the content

Override with `admin.list.layout`.

- **Language filters** (content with translations): the Filter panel has one choice per other language, in the
  state words (*Needs translating*, *Not translated*, *Being translated*, *Draft*, *On the website*); the chip reads
  "English: Not translated". The home page's **Needs translating** (after "Waiting for you", the same rows: the
  language and its state, *Translate*, or *Review* for someone who publishes a translation with text) links to the
  list filtered by *Needs translating* ("View all", one link per collection and language when there are several).
- **Table** (default). Above it, an **"In progress"** strip with drafts and scheduled
  entries (unfiltered first page), each with its verb (Finish / Edit). Rows: thumbnail,
  title and address; columns from `admin.list.columns`; languages say only what is
  missing ("EN missing"), or, publishing per language, each language's state as a code and
  a mark ("EN ●"; a languages mark when being translated) with its words in a tooltip and for screen readers. Phones: title, status,
  time and the languages' marks in one cell.
- **Grid** when the first column is a picture and there is no text body (albums,
  partner logos). Content pictures fill the card; logos sit whole on a light tile; with
  no picture the name stands in.
- **Dated** (Upcoming / Past, by month, a calendar leaf first) for content without
  drafts whose columns include a date (events).

## Calm screens (still the rules)

- **Say it once.** Status appears once per screen (the editor's top bar; the details
  panel only adds "since when").
- **One primary action per screen.** Drafts: *Publish…* (with *Save draft* beside it);
  live: *Update*; *Unpublish* behind "…". Lists: *+ New*.
- **The title is the heading** — a large borderless field, with the address under it.
- **Fields:** required ones carry no marker; optional ones say *Optional* (sectioned
  forms put empty optional fields behind "+ Add …" instead). Help under the control in
  the main column, behind an info icon in the side panel.
- **No box around single things.** Cards frame groups of rows.

## Mobile

Every screen is checked at 390 px: the sidebar becomes a slide-over, toolbars wrap,
tables collapse to one cell, secondary actions move into "…", the preview opens as a
sheet, the welcome animal shrinks into the corner. The admin can be added to the home
screen: its web manifest (`/api/cms/_brand/admin.webmanifest`) opens `/admin/` as an app,
with the client's mark as the icon.

## Emails

Emails are plain on purpose: one white card on a light grey page, system fonts, no tables
for layout. At the top, the client's full logo as a PNG 160 px wide (`full-email.png`), or
the site's name in bold. One main button in the accent's light colour with its text colour.
The written-out link under it is a real link in the accent's text colour (the shade that
reads on white, darker than the button for a light brand colour), under a line in a readable
grey (#525252). They ask mail apps for light mode (`color-scheme: light`), so a dark logo on
transparent stays on white. No tinyzoo signature.

## Building blocks

| Component | Use |
|---|---|
| `CmsPage` | Every admin page. Props `title`, `description`, `breadcrumbs`, `back` (editors), `narrow`, `wide`; slots `actions`, `status` (editors), `badge`, `meta`, default |
| `CmsSection` | A titled card. `flush` for lists |
| `CmsEmptyState` | `first-use` (with its animal), `no-results`, `error` (with retry) |
| `CmsStatusBadge` | Draft / On the website / Scheduled as a dot and a word |
| `CmsTime` | Absolute on the server, relative after mount, full date on hover |
| `CmsLoadError` | A list or page that did not load: a refusal (403) says so and offers no retry |
| `CmsMediaThumb` / `CmsMediaPreview` | A library file small (its smaller copy, or an icon for a video/sound/document) / opened (a picture, a `<video controls>`, an `<audio controls>`, a file card) |
| `CmsPublishReview` | The step before going live (checks, now or scheduled) |
| `CmsMoment` | A small success card with an animal, in the corner |
| `CmsPreviewPanel` | The live page beside the form (`sheet` on phones) |
| `CmsFormSections` | A form as titled sections, "+ Add …", folded groups and the section menu; the page renders each field through the `field` slot |
| `useCmsFocus(on)` | Fold the sidebar while a page needs the room |

## Language

- **Admin interface languages** (not content localization): Czech, English and German. `useCmsI18n()` — `t(key, params)` with Intl plural rules (Czech has
  1 / 2–4 / 5+ forms), `tl(text)` for labels written in `cms.config.ts`,
  `formatDate`/`formatRelative`/`formatNumber`.
- Locale: the `cms_admin_locale` cookie → the browser's `Accept-Language` →
  `cms.admin.defaultLocale`. Switchable from the account menu.
- Not `@nuxtjs/i18n`, so the CMS cannot collide with the website's own i18n.
- Nuxt UI's built-in words follow the same language, **if the site's `app.vue` passes it**:
  `const uiLocale = useCmsUiLocale()` and `<UApp :locale="uiLocale">` (the starter and the playground do).
  It is `undefined` on the website's own pages, so the site's choice holds there. It has to be `UApp`'s
  prop: Nuxt UI keeps one language for all its components and takes it from the first one that asks (the
  notifications area inside `UApp`), so a provider set in a layout is never read.
- Anything a developer writes in `cms.config.ts` that the admin shows (entity
  `label`, `labelSingular`, `description`, field `.label()`/`.help()`, select
  option `labels`) takes one string or a per-locale map:
  `label: { en: 'Posts', cs: 'Články' }`.
- Copy rules: verbs on buttons, consequences in confirmations, no jargon ("URL
  address", not "slug"; "Settings", not "Globals"). Czech uses „…“ quotes and avoids
  declining interpolated nouns ("Zatím tu nic není" instead of "Žádné {label}").
- **Dates** are shown *and edited* in one configured zone (`cms.admin.timeZone`,
  default Europe/Prague), never the server's or the browser's: the server render
  and the hydrated page agree, and "9:00" means the same moment for every editor.

## Accessibility

**Contrast.** Every text role is AA (4.5:1) in both themes, on white **and on cream** (the sign-in, the
current page in the sidebar, hints) and on the hover grey. Light: `text-dimmed` 54 % grey (5.0:1 on white,
4.6:1 on cream), `text-muted` 50 %, toned 43.9 %, text 30 %; dark: dimmed `#A09D97`, muted `#B2AEA7`
(4.9:1 and 6:1 on charcoal, the current page). **`text-dimmed` is the quietest *text*, not a decoration:**
placeholders, "Optional", counts, the date placeholder. Words are never lighter than that; a hairline or an
icon with no words beside it may use the neutral ramp directly. Error text is red-700 in light (6.5:1 on
white), the other status colours (green, amber, blue) are one or two shades deeper in light mode than
Nuxt UI's default 500 (1.8–3:1) so they read as text, on their own 10 % tint and under a solid button's
white text. `test/unit/admin-contrast.spec.ts` reads `cms-admin.css` and fails when a token pair drops
under 4.5:1 — change a token, run it.

**Landmarks and headings.** Every admin screen is one `<main id="cms-main">` (`CmsPage` renders it) with
a "Skip to content" link as the first stop of the keyboard (the admin layout), so the sidebar's links are
not 18 tab stops on every page. One `<h1>` per page: the page's title — or, where the screen draws its own
big title (the editors' title field, the media library), a screen-reader-only `heading` on `CmsPage`.
The top bar is not a heading: the breadcrumb is a labelled `nav` (`aria-current` on the last item).
Every `nav` has a name (the sidebar "Main menu", the breadcrumb, the form's sections); a `radiogroup`
has a name; a rich-text field's text box is a labelled `textbox` (the field's label).

**Errors are read out and found.** A field's message is `role="alert"` (`#error` slot, `v-if` the message);
a form-wide message is a `UAlert` with `role="alert"` (or an always-present live region of fixed height, as
the sign-in's, so a wrong password does not push the button down). After a failed submit the cursor goes to
the first invalid field (`cmsFocusInvalid(form)`: `aria-invalid="true"`, else the error summary), and a field
whose message sits elsewhere (the title input, the redirect "From") points at it with `aria-describedby`.
A validation error is never a bare "Validation failed" toast: it marks the field and says what is wrong in
the page's language (`cmsIssueMessage`).

**Touch targets.** On `pointer: coarse` every control is at least **44 px**: one block in `cms-admin.css`
(`@media (pointer: coarse)`) raises buttons, link-buttons, tabs, menu items, options, summaries and fields
to a 44 px minimum, and an icon-only button (it has an `aria-label`) to a 44 px square. A desktop keeps its
28–32 px controls. Opt a control out with `.cms-dense` only when it sits inside a line of text or a chip, and
then widen its tap area with `.cms-hit` (an invisible 44 px square). A list row's title is a stretched
link over the row, not a 20 px line. The sidebar's slide-over rows use `pointer-coarse:py-3`
(Tailwind's variant, the same media query) because they are not buttons. Components never add a size for
touch by hand — if a control comes out smaller than 44 px on a phone, the rule has a gap; fix the rule.
`.cms-touch` (sign-in, setup) is the same rule scoped to one form and stays for those pages.

- A field with no error passes `undefined`, never `''`, to `UFormField`'s `error` (an empty string still
  marks the field invalid: red ring, `aria-invalid="true"`).
- A page that needs the layout's data reads it with `useNuxtData('cms-graph')`; a second `useFetch` under the
  same key made the form's generated ids differ after hydration (label `for` ≠ input `id`: an unlabelled
  field).
- Focus rings: Nuxt UI's, redrawn by `cms-admin.css` at full strength in `--cms-accent-ring` (2 px,
  3:1 or more on every surface, light and dark; see Brand colours), menu items, the title and rich text
  included. The editor-side resize handle's line turns the accent from the keyboard.
  `prefers-reduced-motion` turns transitions and the moment's rise off.
- Keyboard focus stays on screen: a dialog's focus trap (Reka) moves the focus without scrolling when Tab
  wraps round, so while the keyboard is in use the admin scrolls a control that takes the focus entirely
  out of view to the nearest edge (`cmsTrackKeys`; the publish review on a phone).
- A hand-made radio group (the review's "when") is one Tab stop, the chosen card; the arrow keys change
  the choice. Its focus ring sits 2 px off the card, so it never looks like the chosen card's border.
- Icon-only buttons carry translated, full `aria-label`s ("Export CSV", "New post" — not "Post"); toggles
  (Details, Preview) carry `aria-pressed`; sortable headers are buttons with `aria-sort` on the column.
- The review's "when" choice is a `radiogroup`; the success card is `role="status"`.
- **Nuxt UI's own words** ("Close", "Notifications", "Previous month", "Show password") follow the admin
  language: the site's `<UApp>` gets `:locale="useCmsUiLocale()"` (see Language). What Nuxt UI hard-codes
  is overridden by the admin: Reka's "Show popup" on a select (the field's label) and the notifications
  area's name "Notifications (F8)" (set by the admin layout).

## First frame: the server and the browser draw the same

A hydration mismatch is a bug (the console says so, and the page can flash or break). Rules: nothing that
differs between the server and the browser in the **first** frame — no `localStorage`, `window.matchMedia`,
`Date.now()` or locale-dependent text read while rendering. The sidebar's width and fold are kept by Nuxt UI
in a **cookie** (`UDashboardGroup storage="cookie"`), which the server reads too; times render absolute
(`CmsTime`: the admin's time zone) and turn relative after mount; anything that only the browser knows
(a phone's pointer, a stored width) is applied in `onMounted`.

## When the account stops working under an open admin

A disabled, removed or password-changed account, or an expired session, gets a 401 on the next read.
`plugins/cmsSignedOut.client.ts` sends the person to sign-in with "You were signed out" and, after signing in,
back to the page they were on. Only reads of the admin's own API are taken over — a refused save keeps the
page (the editor holds the unsaved text) and says so. A refusal (403) says "You don't have permission for this"
(`CmsLoadError`) and offers no "Try again", which could not change the answer.
