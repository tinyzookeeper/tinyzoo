# The admin: accounts, look and extension points

The admin (`/admin`) is where editors work. This page covers how people sign in, how you brand the admin, and how to change the way a field is drawn.

## Accounts, roles & sign-in

The CMS owns its users (`cms_users`). People get in like this:

1. A fresh install shows **first-run setup** at `/admin`. It creates the first administrator.
2. Everyone else is **invited** from Settings → Team. The invitation is an email with a one-time link, plus a copyable link in case the email gets lost.
3. People reset forgotten passwords themselves.

Invite links expire after 7 days and reset links after 1 hour. Only a hash of each link is stored.

In production, setup always asks for a **setup code**. It is your `NUXT_CMS_AUTH_SETUP_TOKEN`. When none is set, the server prints one in its log (`Setup code: XXXX-XXXX-XXXX-XXXX`). So a fresh deploy cannot be claimed by whoever opens the page first.

There are three built-in roles:

| Role | Can |
|---|---|
| Administrator | everything, plus people (invite, change role, disable, remove) |
| Editor | create, edit, publish and delete all content; edit site settings |
| Author | create drafts; edit and delete only what they created; never publish, never touch settings |

A site can define roles of its own on top of these three, such as a translator that edits only posts, or an editor with no media library. It can also say per field who reads and who edits it. See [Roles and permissions](roles.md).

An entity's own `access` rules still apply on top (AND-ed).

### Configuration

All of these options can be overridden by env:

```ts
cms: {
  publicUrl: 'https://cms.example.com',   // NUXT_CMS_PUBLIC_URL — required in production: links and the logo in emails use it, never the Host header
  mail: {
    transport: 'smtp',                    // NUXT_CMS_MAIL_TRANSPORT: log (default) | file | smtp (Node only)
    from: 'Pekárna Novák <web@pekarna-novak.cz>',
    smtp: { host: 'smtp.example.com', port: 587, user: '…', pass: '…' }, // NUXT_CMS_MAIL_SMTP_*
  },
  auth: {
    mode: 'builtin',                      // 'external': your app signs people in and sets event.context.cmsUser
    trustedProxies: 1,                    // proxies appending to X-Forwarded-For (rate limits read the client IP behind them)
    ipHeader: '',                         // or a trusted edge header, e.g. 'cf-connecting-ip'
  },
}
```

### Security details

- Every request re-reads the account. Disabling someone, changing their role or changing a password takes effect immediately, not when a cookie expires.
- Sign-in is rate-limited. Failures look identical whether or not the address exists.
- Writes, sign-ins and people changes go to an audit log (`cms_audit`).
- Every content row records `createdBy` / `updatedBy`.
- Sessions last 14 days from sign-in (`runtimeConfig.session.maxAge`).
- State-changing requests to `/api/cms/**` must send JSON (multipart only for media uploads). When the browser reports it, they must also come from the same origin. So a form on another page of the site, or on a sibling subdomain, cannot act as a signed-in editor (CSRF).
- Rate limits are in memory per instance today. A shared store for several replicas is planned (Phase 5).

### Email while developing

Locally, `docker compose --profile mail up -d` starts Mailpit. Set `NUXT_CMS_MAIL_TRANSPORT=smtp NUXT_CMS_MAIL_SMTP_HOST=localhost NUXT_CMS_MAIL_SMTP_PORT=1025`, and read the emails at http://localhost:8025.

Without Mailpit, emails are printed to the server log.

![team](../screenshots/admin-team-invite.png)

## Admin look & language

The admin has its own design system, scoped so it never touches the host website's theme. It has:

- a white workspace, charcoal actions, and cream for the brand's moments (with one of the animals)
- Manrope titles and Inter text
- a "charcoal night" dark mode
- a layout that works on phones

It speaks Czech and English (cookie, then browser language, then default). Brand it per client in `app.config.ts`:

```ts
cms: { admin: {
  name: { cs: 'Pekárna Novák', en: 'Novák Bakery' },
  siteUrl: 'https://pekarna-novak.cz',
  accent: '#B4532A',           // the client's brand colour, or mono (default) | indigo | blue | violet | emerald
  locales: ['cs', 'en'], defaultLocale: 'cs',
  timeZone: 'Europe/Prague',   // dates are shown and edited in this zone
  logo: { full: '/brand/logo.svg', mark: '/brand/mark.svg' }, // optional, see below
  signature: true,             // tinyzoo's quiet signature; false hides it
} }
```

### The brand colour

`accent` takes one of the built-in accents (`mono`, tinyzoo's charcoal, is the default; `indigo`, `blue`, `violet`, `emerald`) or the client's brand colour as a hex: `'#B4532A'` or `'#b53'`. The colour goes where the accent goes, and nowhere else:

- main buttons
- the current page in the menu
- links
- focus rings, checked boxes and switches, selected options

The white workspace, the greys, cream, the animals and the status colours (green "On the website", red errors) stay as they are. tinyzoo works out the rest: the shades, a lighter version for dark mode, and the text colour on a button (white or ink, whichever reads better).

**The contrast guard.** Every colour has to stay readable: 4.5:1 for the text on a button and for links on the page, 3:1 for focus rings, in light and dark mode. When the brand colour falls short, tinyzoo moves it to the nearest colour that passes. Only the lightness changes; the hue stays. A light colour keeps its buttons: a yellow brand gets yellow buttons with ink text, while its links use a darker yellow. In development, the server log and the browser console say what changed and why:

```
[tinyzoo] cms.admin: accent #FFD500: links and other accent text would be 1.3:1 on the hover grey; they use #826C00 (4.5:1); buttons keep #FFD500 with ink text (13.0:1).
```

To silence the message, pick a colour that passes, or accept the adjustment: nothing breaks either way. Production adjusts quietly. An accent tinyzoo cannot read (`'red'`, `'#12345'`) falls back to `mono`, with the same kind of message. You can try colours at `/design-system` on the tinyzoo website: it runs the same guard.

Nuxt UI draws a few words itself ("Close", "Previous month", "Show password"). They follow the admin language when the site's `app/app.vue` hands it over, and the starter does. Add:
`const uiLocale = useCmsUiLocale()` and `<UApp :locale="uiLocale">`. On the website's own pages it is empty, so the site keeps its own.

Labels in `cms.config.ts` take one string or one per admin language (`label: { en: 'Posts', cs: 'Články' }`). Entities can also set `icon`, `labelSingular` and `description`.

### The client's logo

Give the admin the client's logo set in `cms.admin.logo`. Each value is a file in the site's `public/` folder (`/brand/logo.svg`) or an `https://` URL:

```ts
logo: {
  full: '/brand/logo.svg',          // the wide logo with the name
  mark: '/brand/mark.svg',          // the square mark
  fullDark: '/brand/logo-dark.svg', // optional: for dark mode
  markDark: '/brand/mark-dark.svg', // optional
},
```

| Logo | Where it shows | Best as |
|---|---|---|
| `full` | the open sidebar (28 px high), the phone's menu, the sign-in, reset and invitation pages (40 px high), the emails | SVG, or a PNG at least 320 px wide (640 px is better), on a transparent background |
| `mark` | the folded sidebar, the phone's top bar, the browser tab, the phone's home screen | a square SVG, or a square PNG of 512 × 512 |
| `fullDark`, `markDark` | the same places in dark mode | light versions of the two above |

What the admin shows when a logo is missing:

- no `full`: the mark with the client's name beside it;
- no `mark`: a tile with the name's initials (the tab keeps tinyzoo's icon);
- no logo and no `name`: tinyzoo's own mascot, as before.

The full logo carries the name, so the admin uses `name` as its text for screen readers. Set `name` too.

**Dark mode.** Without `fullDark` or `markDark`, the light logo sits on a small cream tile in dark mode, so a dark logo never disappears on charcoal. A dark version without its light one is not used.

**A logo that does not load** (a wrong address, a file that is gone) gives way: a full logo to the mark with the name, a mark to the initials, in light and dark mode. A dark version that does not load leaves its light one in place, on the cream tile, as if no dark version had been given. An SVG needs no `width` or `height`: one with only a `viewBox`, as design tools export it, works.

**Tab and home-screen icons.** With a mark, the browser tab shows it, and tinyzoo makes PNG copies of it for browsers that need them: a 32 px tab icon, the 180 px home-screen icon and the icons of the admin's web manifest (`/api/cms/_brand/…`). Without a mark the tab keeps tinyzoo's icon. This happens on the admin's pages only; the website keeps its own.

**Checks in development.** When the dev server starts, tinyzoo looks at each logo and warns in the log about an address it cannot use (it must start with `/` or `https://`), a file that is missing, a mark that is not square, or a PNG that is too small. A logo never stops the start, and production does not check.

**`signature: false`** hides tinyzoo's quiet signature under the sidebar and at the foot of the sign-in pages. The emails never carry it.

### Emails and the phone's home screen

The emails the admin sends (invitations, password resets, changes of the sign-in address) carry the client's brand:

- the full logo at the top, 160 px wide. Without `logo.full`, the site's name in bold;
- the site's name from `cms.admin.name`, in the recipient's language;
- the main button in the accent colour, with its text colour.

Emails never carry tinyzoo's signature. The text version stays plain: the message and the link.

Gmail and Outlook do not show SVG, so tinyzoo makes PNG versions of the logo on the server:

| File | Made from | What for |
|---|---|---|
| `/api/cms/_brand/full-email.png` | `logo.full` | the emails: 320 px wide, at most 120 px tall, transparent |
| `/api/cms/_brand/mark-32.png` | `logo.mark` | the PNG tab icon |
| `/api/cms/_brand/mark-180.png` | `logo.mark` | the phone's home-screen icon (apple-touch-icon): on white, with a little padding |
| `/api/cms/_brand/mark-192.png`, `mark-512.png` | `logo.mark` | the web manifest |

Without a mark, the icons show tinyzoo's own. Without a full logo, `full-email.png` is a 404 and the emails show the name. A logo that cannot be read is a 404 too, with one line in the server log.

`/api/cms/_brand/admin.webmanifest` lets people add the admin to a phone's home screen. It opens `/admin/` as an app, with the site's name in the admin's default language and the mark as its icon.

The logo in emails needs the site's public address, `NUXT_CMS_PUBLIC_URL`. Production needs it anyway for the links. Mail clients load the logo from there, so it must be reachable from the internet.

### How editors and lists are arranged

Each editor and list is arranged for its content, without configuration:

- News (a rich-text body with a page) opens as a calm **writing** column.
- Events and settings open as a **form**.
- Pages built from blocks open beside their **live preview**.
- Lists are tables (with drafts "in progress" on top), picture grids (albums, logos) or **Upcoming / Past** (events).

Override it where the guess is wrong:

```ts
defineEntity('event', { /* … */ admin: { editor: 'form', list: { columns: ['title', 'startsAt'], layout: 'table' } } })
defineSingleton('home', { /* … */ admin: { preview: '/' } }) // edit the home page beside the live page
```

### The live preview

The preview beside the form follows the typing. The editor's unsaved values go to the server, and the preview page refetches its content. Those values are laid over the entry for that editor's own `?preview` requests only. They are never cached, never public, and gone when the editor closes.

A site that loads its content through the content API with `?preview` (as the starter does) needs no code for this. A site rendering from somewhere else can listen for `{ type: 'cms:preview', entity, id, locale, data }` messages.

### Form sections

Forms read as a few titled sections. Name them as plain questions, and give fields the icons and options that make them quick to fill in. Empty optional fields wait behind "+ Add …". Long forms get a section menu beside them.

```ts
defineEntity('event', {
  /* … */
  admin: { sections: [
    { label: { cs: 'Kdy?', en: 'When?' }, icon: 'i-lucide-calendar', fields: ['startsAt', 'endsAt'] },
    { label: { cs: 'Kde?', en: 'Where?' }, icon: 'i-lucide-map-pin', fields: ['place'] },
    { label: { cs: 'Kontakty', en: 'Contacts' }, fields: ['email', 'phone'], columns: 2 },
  ] },
  fields: {
    kind: f.select({ options: ['race', 'club'] as const, icons: { race: 'i-lucide-trophy', club: 'i-lucide-users' } }),
    startsAt: f.datetime({ allDay: true }),          // an "All day" switch; stored at 0:00
    place: f.text().optional().icon('i-lucide-map-pin'),
    organised: f.boolean().label('We organise it').help('It gets a label in the calendar.'), // the help is the switch's sentence
    /* … */
  },
})
```

Without `admin.sections`, a form of six fields or more is grouped by kind (dates, pictures, links, related entries). `admin.tabs` read as sections in the form and preview editors.

Tokens, rules and building blocks are in [`../ui-foundation.md`](../ui-foundation.md). There is a live tour at `/design-system` on the tinyzoo website.

## Theming (host-owned)

The CMS components use semantic Nuxt UI classes (`bg-primary`, `text-muted`, …). So the host re-skins the whole admin from its own `app.config.ts` and `main.css`, with no package edits.

For the admin's colour, set `cms.admin.accent` (above): a built-in accent or a brand hex, checked by the contrast guard. The admin's tokens live under `html[data-cms-admin]`, so a host can still override them in its CSS, but then nothing checks the contrast.

The playground ships a monochrome theme. `primary` is a custom `ink` ramp anchored at `#555` (defined via `@theme` in `main.css`). `neutral` is a true-neutral gray.

## Extensibility — the field & view registry

Every field renders through a tiny dispatcher: `CmsField` for the edit form and `CmsCell` for list cells. It resolves a component **by name** with this precedence:

```
app.config  cms.fields[type].edit   (host override, by field type)
  → a plugin's `fields[type].edit`  (see [Plugins](../plugins.md))
    → field.ui.edit                 (built-in default, from the descriptor)
      → CmsFieldText                 (fallback)
```

So a host adds or replaces a renderer **without touching the package**. Ship a component and register its name:

```ts
// app.config.ts
export default defineAppConfig({
  cms: { fields: { select: { edit: 'MySegmentedSelect' }, color: { edit: 'ColorPicker', cell: 'ColorSwatch' } } },
})
```

```vue
<!-- components/global/MySegmentedSelect.vue -->
<script setup lang="ts">
import type { CmsFieldEditProps } from 'tinyzoo'

const props = defineProps<CmsFieldEditProps>()   // field, entity, id, readOnly
const model = defineModel<string | null>()
</script>

<template>
  <div class="flex gap-1.5">
    <button
      v-for="option in props.field.meta.options as string[]" :key="option" type="button"
      :disabled="props.readOnly" :aria-pressed="model === option" @click="model = option"
    >
      {{ option }}
    </button>
  </div>
</template>
```

### What a renderer receives

A renderer gets these props (`CmsFieldEditProps`):

- `field`: what the admin knows about it, such as its type, `meta`, `required` and `readOnly`
- `entity`
- `id`: the DOM id the control should take, so the label finds it
- the value, through `v-model`

### `readOnly`

`readOnly` is `true` when the person cannot change the field. That happens in two cases:

- Their role may read the field but not edit it (`.access({ edit: [...] })`, [Roles and permissions](roles.md), also `field.readOnly`).
- The whole entry is read-only for them, because their role cannot update it.

The admin disables the native controls inside such a field. A renderer made of anything else has to stop editing itself when `readOnly` is set. That means buttons that are not disabled, a drag handle, a canvas or a color wheel.

`readOnly` is passed to every renderer the registry resolves, the built-in ones too. The server refuses a write to a locked field in any case. `readOnly` only keeps the screen honest.

> Custom renderers must be **globally registered** (put them in `components/global/`
> or use the `.global.vue` suffix) — the registry resolves them at runtime, and
> `resolveComponent` only sees globals. The playground does exactly this in
> `app/components/global/PgStatusSelect.vue`, rendering the post status as a
> segmented control instead of the default dropdown.

![form with a custom (host-registered) status field renderer](../screenshots/admin-editor.png)

Built-in renderers live in `packages/cms/app/components` (`CmsField*` / `CmsCell*`). Each is one small component per type, and each is independently overridable.

## Authoring experience

The admin is built for non-technical clients, not just developers:

- **Rich text.** The TipTap editor does **links** and **inline images** (pick from the media library or upload inline). Stored content is sanitized on write *and* at render (CmsContent). So a `javascript:`/`data:` href or src can never reach a visitor.
- **Media library.** Browse, search and **reuse** existing uploads instead of re-uploading. Set **alt text** per image (accessibility and SEO). Blobs are reference-counted across media fields **and images embedded in rich text**. So an asset is GC'd only when truly orphaned, and never while still referenced.
- **Slugs auto-generate** from their source field (`f.slug({ from: 'title' })`) until you edit them. They never clobber an existing slug.
- **Friendly fields.** Labels are humanized from the key, and you can override them with `.label('Publish date')`. Add help text with `.help('…')`.
- **Safety rails.** Destructive deletes ask for confirmation. Leaving a form with unsaved changes warns you, on in-app navigation and on tab close.

```ts
publishedAt: f.datetime().optional().label('Publish date'),
slug: f.slug({ from: 'title', unique: true }).help('Auto-generated — edit to override.'),
```
