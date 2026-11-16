# UI foundation — tinyzoo's admin

Playful, calm, simple (docs/brand/brand-guide.md), for non-technical editors and
small business owners. A white workspace that stays out of the way of the client's
content; the brand speaks only in **moments**. Light and dark are equal citizens,
and every screen works on a phone. Live reference: `/admin/styleguide`.

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

Client accents: `cms.admin.accent` = `indigo`, `blue`, `violet` or `emerald` replaces
charcoal; or override `--ui-color-primary-*` under `html[data-cms-admin]`.

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
| Sign-in, reset, invitation | hedgehog (setup: the bright six) | `layouts/cms-auth.vue` — cream, no card |
| Welcome | owl | home page, with the quick-add buttons |
| Empty place | a muted animal per collection (always the same) | `CmsEmptyState` (80 px) |
| Before publishing | bird | `CmsPublishReview` |
| Live / scheduled | whale / turtle | `CmsMoment` (corner card, leaves by itself) |

"No results" and errors get no animal.

## Shell

`UDashboardGroup` + `UDashboardSidebar` (16 rem, resizable, collapsible to icons, a
slide-over menu on phones). The client's name leads at the top; the current page sits
on cream; **tinyzoo signs** under the account button. Groups: Home, Content,
Settings, then View website and the account menu (appearance, language, design
system, sign out).

The Write and Preview editors **fold the sidebar to icons** (`useCmsFocus`); leaving
them restores what the person chose (kept apart in `localStorage`).

## The top bar

- Lists and settings: breadcrumbs, then the page's actions.
- **Editors: one bar for every arrangement** — `‹ Back · status · saved` on the left;
  language, history, Details (Write), Preview, the primary action and "…" on the right.
  Words for the actions that matter ("Preview", "Publish…", "Details"); icon-only only
  for secondary tools (history).
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

**Publishing** goes through `CmsPublishReview`: what is ready, what is missing (the
text body, the main picture, other languages — each with the fix), now or scheduled.
Warnings never block; the form's validation still does. Afterwards `CmsMoment`
confirms it ("It's on the website.") with "View on the website". Settings (globals)
have no drafts: **Save** puts them on the website and says so.

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

- **Table** (default). Above it, an **"In progress"** strip with drafts and scheduled
  entries (unfiltered first page), each with its verb (Finish / Edit). Rows: thumbnail,
  title and address; columns from `admin.list.columns`; languages say only what is
  missing ("EN missing"). Phones: title, status and time in one cell.
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
sheet, the welcome animal shrinks into the corner.

## Building blocks

| Component | Use |
|---|---|
| `CmsPage` | Every admin page. Props `title`, `description`, `breadcrumbs`, `back` (editors), `narrow`, `wide`; slots `actions`, `status` (editors), `badge`, `meta`, default |
| `CmsSection` | A titled card. `flush` for lists |
| `CmsEmptyState` | `first-use` (with its animal), `no-results`, `error` (with retry) |
| `CmsStatusBadge` | Draft / On the website / Scheduled as a dot and a word |
| `CmsTime` | Absolute on the server, relative after mount, full date on hover |
| `CmsPublishReview` | The step before going live (checks, now or scheduled) |
| `CmsMoment` | A small success card with an animal, in the corner |
| `CmsPreviewPanel` | The live page beside the form (`sheet` on phones) |
| `CmsFormSections` | A form as titled sections, "+ Add …", folded groups and the section menu; the page renders each field through the `field` slot |
| `useCmsFocus(on)` | Fold the sidebar while a page needs the room |

## Language

- **Admin interface languages** (not content localization): Czech and English at
  launch. `useCmsI18n()` — `t(key, params)` with Intl plural rules (Czech has
  1 / 2–4 / 5+ forms), `tl(text)` for labels written in `cms.config.ts`,
  `formatDate`/`formatRelative`/`formatNumber`.
- Locale: the `cms_admin_locale` cookie → the browser's `Accept-Language` →
  `cms.admin.defaultLocale`. Switchable from the account menu.
- Not `@nuxtjs/i18n`, so the CMS cannot collide with the website's own i18n.
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

- AA contrast for text roles (see Colour). Focus rings from Nuxt UI.
- Icon-only buttons carry translated `aria-label`s; the toolbar's toggles carry
  `aria-pressed`; sortable headers are buttons with `aria-sort` on the column.
- Breadcrumbs are a labelled `nav` with `aria-current` on the last item.
- `prefers-reduced-motion` turns transitions off.

## Accessibility

- AA contrast for text roles in both modes, on white **and on cream**: muted text is 54 % grey in
  light (4.5:1 on cream; 55.6 % was 4.37:1), error text is red-700 in light (6.5:1 on white,
  5.5:1 on the soft red tint; red-500 was 3.8:1). `text-dimmed` is for placeholders and icons,
  never for text someone has to read (sidebar group labels, counts).
- Touch screens (`pointer: coarse`): controls where a thumb does the work are 44 px tall — `.cms-touch`
  on a form or page (sign-in and setup, Privacy), `pointer-coarse:min-h-11` on a single button
  (a block card's Remove and "…"). Desktop keeps the denser 32 px controls.
- A field with no error passes `undefined`, never `''`, to `UFormField`'s `error` (an empty string
  still marks the field invalid: red ring, `aria-invalid="true"`). Messages that should be read out
  get `role="alert"` (`#error` slot, `v-if` the message).
- A page that needs the layout's data reads it with `useNuxtData('cms-graph')`; a second
  `useFetch` under the same key made the form's generated ids differ after hydration (label `for`
  ≠ input `id`: an unlabelled field).
- Focus rings from Nuxt UI.
- Icon-only buttons carry translated `aria-label`s; toggles (Details, Preview) carry
  `aria-pressed`; sortable headers are buttons with `aria-sort` on the column.
- The review's "when" choice is a `radiogroup`; the success card is `role="status"`.
- Breadcrumbs are a labelled `nav` with `aria-current` on the last item.
- `prefers-reduced-motion` turns transitions and the moment's rise off.
