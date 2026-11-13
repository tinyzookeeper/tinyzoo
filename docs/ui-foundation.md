# UI foundation — modern and neutral

Modern and neutral: true greys, black as the primary colour, one sans-serif
typeface, flat surfaces with hairline borders. The structure and copy follow the
Mobbin study (`docs/research/admin-ux-references.md`); the look is deliberately
quiet so the client's content is what stands out. Light by default, dark
supported. Live reference: `/admin/styleguide`.

*History: the first pass (2026-11-13) was a "calm editorial" look — warm paper
greys and a serif for titles. Reviewed and rejected as not modern/neutral enough;
replaced the same day.*

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

- **Neutral, true grey** (OKLCH chroma 0). Page and cards white, sidebar
  `neutral-50`, hairline `neutral-200` borders.
- **Accent "mono" by default:** primary actions are black (white in dark mode).
  Colour then appears only where it means something — status: Draft = neutral,
  Published = success (green), Scheduled = info, Changed since publishing =
  warning, errors = error.
- **Client accents:** `cms.admin.accent` = `indigo`, `blue`, `violet` or
  `emerald` turns primary actions and the active state into that colour; or
  override `--ui-color-primary-*` under `html[data-cms-admin]` in the host's CSS.

## Type

- **One typeface: Geist** (sans-serif), self-hosted via @nuxt/fonts, Geist Mono
  for code. No serif anywhere.
- Page titles 24 px semibold with tight tracking; section titles 14 px semibold;
  body 14 px; meta 12–13 px; sidebar group labels 12 px, sentence case.
- `tabular-nums` for counts and dates.

## Shape & density

- Radius `0.375rem` (controls), cards `0.5625rem`.
- **Flat:** `.cms-card` is a white surface with a hairline border and no shadow.
  One frame per group, never nested.
- Comfortable but not airy: list rows ~48–56 px, 24 px between form fields.
- `.cms-page` owns the gutters and max width (72 rem); `narrow` (48 rem) for forms.
  Pages add no padding of their own.

## Shell

Nuxt UI's dashboard components: `UDashboardGroup` + `UDashboardSidebar` (16 rem,
resizable 14–20, collapsible to icons, a slide-over menu on mobile, state
remembered locally). Sidebar groups are named by task, not by implementation:
**Home**, **Content** (collections), **Settings** (globals), then **View website**
pinned at the bottom and the account menu (appearance, language, design system,
sign out). Every page is a `CmsPage`: a sticky top bar with breadcrumbs and the
page's actions (always reachable), over a body with the page title and an optional
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
