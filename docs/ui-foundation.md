# UI foundation — a calm editorial workspace

Direction from the Mobbin study (`docs/research/admin-ux-references.md`): closer to
Shopify admin / Squarespace / beehiiv than to Linear. Friendly and spacious enough
for a café owner who edits the menu once a month, crisp enough that an agency is
proud to hand it over. Light by default, dark supported. Live reference:
`/admin/styleguide`.

## Where things live

| What | Where |
|---|---|
| Tokens (colour, type, radius, surfaces) | `packages/cms/app/assets/css/cms-admin.css` |
| Branding & languages (host-overridable) | `cms.admin` in `app.config.ts` (defaults in the layer's `app/app.config.ts`) |
| Fonts | `fonts.families` in `packages/cms/nuxt.config.ts` (@nuxt/fonts, self-hosted at build) |
| Interface strings | `packages/cms/app/i18n/{en,cs}.ts`, used through `useCmsI18n()` |
| Building blocks | `packages/cms/app/components/Cms{Page,Section,EmptyState,StatusBadge,Time}.vue` |

## Scoping: the admin never fights the website

The CMS runs inside the client's own Nuxt app, which has its own theme. All admin
tokens are scoped to `html[data-cms-admin]`, which the admin layout sets on
`<html>` (with `lang` and `data-cms-accent`). Scoping on `<html>` rather than
a wrapper div also covers what Nuxt UI teleports to `<body>` (modals, menus,
toasts). Nuxt UI reads `--ui-color-*` and the role variables (`--ui-primary`,
`--ui-text-muted`, …); the admin overrides them at a higher specificity than
Nuxt UI's `:root`. The website's pages are untouched.

## Colour

- **One accent** (`--ui-color-primary-*`), for primary actions and the active
  navigation item only. Default **indigo**; built-in alternatives `pine`, `plum`,
  `clay` via `cms.admin.accent`. The default is deliberately not green: green
  means *published*, and the brand colour must never read as a status.
- **Neutrals: warm paper grey** (OKLCH hue 75, very low chroma). The page is
  `neutral-50`, cards are white, hairline borders.
- **Status is the only other colour.** Draft = neutral, Published = success
  (green), Scheduled = info, Changed since publishing = warning, errors = error.
- **Contrast:** light-mode text roles are one step darker than Nuxt UI's default
  (`text-muted` = neutral-600) and `--ui-primary` is the 600 step, so white labels
  on solid buttons pass AA. Dark mode uses the 400 step.
- Re-skin for a client: pick an accent, or override the `--ui-color-primary-*`
  variables under `html[data-cms-admin]` in the host's CSS.

## Type

- **Geist** for the interface (14–15 px body, 12–13 px meta, sentence-case labels,
  never all caps except the small sidebar group labels).
- **Newsreader** (serif) for page titles, the greeting and **the text inside the
  rich-text editor**. Writers see their words as readers will, and the serif titles
  are what makes it feel editorial rather than like a dev tool.
- `tabular-nums` for counts and dates.
- Utilities: `.cms-display` (serif title), `.cms-prose` (serif long text).

## Shape & density

- Radius `0.5rem` (controls), cards `0.75rem`.
- **Comfortable, not compact:** list rows ~56 px, form fields `md`, 24 px between
  fields, 24 px between cards.
- `.cms-card` is the one frame: white, hairline border, a whisper of shadow. One
  frame per group, never nested.
- `.cms-page` owns the gutters and max width (72 rem); `narrow` (52 rem) for forms.
  Pages add no padding of their own.

## Shell

Nuxt UI's dashboard components: `UDashboardGroup` + `UDashboardSidebar` (16 rem,
resizable 14–20, collapsible to icons, a slide-over menu on mobile, state
remembered locally). Sidebar groups are named by task, not by implementation:
**Home**, **Content** (collections), **Settings** (globals), then **View website**
pinned at the bottom and the account menu (appearance, language, design system,
sign out). Every page is a `CmsPage`: a sticky top bar with breadcrumbs and the
page's actions (always reachable), over a body with a serif title and an optional
description.

## Building blocks

| Component | Use |
|---|---|
| `CmsPage` | Every admin page. Props `title`, `description`, `breadcrumbs`, `narrow`; slots `actions` (top bar), `badge` (next to the title), `meta` (right of the title), default |
| `CmsSection` | A titled card. `flush` for lists (no inner padding, divider under the header) |
| `CmsEmptyState` | `first-use` (explains what the place is for + the next step), `no-results`, `error` (with retry). The toolbar stays visible above it |
| `CmsStatusBadge` | Draft / Published, the same everywhere |
| `CmsTime` | Absolute date on the server, relative ("3 hours ago") after mount, full date on hover — no hydration mismatch |

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

## Not in this foundation yet (later phases)

Two-column editor with a settings sidebar, list filters and bulk actions, scheduled
status, version history, the block picker, the media library page, sign-in /
invite / reset screens (Phase 2) — all built from these tokens and blocks.
