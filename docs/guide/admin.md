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
- Rate limits are shared by every replica when the site has Redis or Valkey (`REDIS_URL`, or `NUXT_CMS_REDIS_URL`). Without it, each instance counts on its own, which is right for one instance ([deploying](../deploying.md#what-runs)).
- When Redis does not answer, each instance counts on its own until it does. An outage neither locks people out nor turns the limits off.

### Signing in with the tinyzoo account (experimental)

A site can let people sign in with their **tinyzoo account** next to the site's own password. One account then opens every website the person belongs to, and the site's name at the top of the admin becomes a switcher between them. This is experimental: the settings and the behaviour can change in a minor release.

Switch it on with three settings. The account service gives a site its client id and secret when the site is connected to an account:

```ts
cms: {
  auth: {
    account: {
      issuer: 'https://account.example.com',   // NUXT_CMS_AUTH_ACCOUNT_ISSUER: the account service's address
      clientId: 'tz_…',                        // NUXT_CMS_AUTH_ACCOUNT_CLIENT_ID
      // clientSecret: set NUXT_CMS_AUTH_ACCOUNT_CLIENT_SECRET in the environment. An option is written into the build.
    },
  },
}
```

All three must be set, with the built-in sign-in (`auth.mode: 'builtin'`) and `cms.publicUrl`. Without them nothing changes: no button, no route, no request.

The account service sends the browser back to `<publicUrl>/api/cms/_auth/account/callback`, and accepts that address only when it is exactly the one it keeps for the site. The site therefore sends its public address in a normal form: lower-case host, no default port, no trailing slash. `https://Example.com:443/` and `https://example.com` give the same return address.

**What a person sees.** The sign-in page has a button, "Sign in with your tinyzoo account", above the password form. The password keeps working. Signed in, someone who belongs to other websites of the same owner sees the site's name at the top of the menu as a button: it lists their websites with their role in each, and "All my websites" leads to the account. A website that has not told the account the person's role yet is listed by its name alone. Choosing a website opens its admin without a form. The account page says in one line whether the person's user is connected to an account.

**How an account finds its user.** Roles and people stay on the site, in `cms_users`. The account only says who the person is; the site decides whether they get in:

1. A user already connected to this account signs in. The connection is by the account's id, so it holds when the person changes their email address at the account.
2. Otherwise the site looks for a user with the account's email address, and only when the account service says that address is verified. An active user is connected and signed in. An invited user is accepted: they become active with the account's name and no password, and the invitation link stops working. The proof is the verified address, not the link, so this also works after the link has run out (7 days), as long as the invitation was not taken back by removing the user. The invitation email and page say that the account works, and the page of a link that no longer works offers it.
3. Otherwise the person sees "This account has no access to this website". An administrator invites their address from Settings → Team, as always. An account whose email address is not confirmed yet is told to confirm it first.

A disabled user is refused. A user connected to one account is never handed to another account that later holds the same address. Removing a user removes the connection, and so does erasing a person in Settings → Privacy ([the privacy tools](../deploying.md#privacy-gdpr)); the account service is told both times.

**What stays as it was.** The session is the site's own: disabling someone, changing their role or "sign out everywhere" take effect on the next request. The account service is told a person's role on the site, and when the site stops letting them in, so the switcher can show it; it never decides rights. After a sign-in the site tells it before the browser goes on, so the person's list of websites is right on the next page. Signing out of a site ends that site's session only, and signing out of the account ends no site's session.

**Somebody with no password here.** Someone accepted through the account has no password on the site. Their account page says that they sign in with their account, and offers to send a link to their address where they choose a password for this website: the same email as "Forgot password?". Until they have one, the forms that are confirmed with a password (their own sign-in email, somebody else's email in Team) say so instead of asking for it.

**When something is in the way.** The sign-in page says what happened, in one notice above the form, and the password form stays usable: the account service did not answer (the site asks it before it sends the browser there, so nobody is left on a browser's error page; open sessions keep working), the sign-in took over ten minutes, or there were too many sign-ins from one address (60 in 15 minutes).

A sign-in through the account is `auth.login` in the audit log with `via: account`; a refused one is `auth.login_failed` with the reason.

### Email while developing

Locally, `docker compose --profile mail up -d` starts Mailpit. Set `NUXT_CMS_MAIL_TRANSPORT=smtp NUXT_CMS_MAIL_SMTP_HOST=localhost NUXT_CMS_MAIL_SMTP_PORT=1025`, and read the emails at http://localhost:8025.

Without Mailpit, emails are printed to the server log.

![team](../screenshots/admin-team-invite.png)

## Admin look & language

The admin has its own design system, scoped so it never touches the host website's theme. It has:

- a white workspace, charcoal actions, and cream for the brand's **moments**: the sign-in pages, the welcome card, the current page in the sidebar; most of them with one of tinyzoo's animals
- Manrope titles and Inter text
- a "charcoal night" dark mode
- a layout that works on phones

All of it can carry the client's brand instead of tinyzoo's: a name, a colour and a logo set.

### What you can brand

Everything is in `cms.admin`, in the site's `app.config.ts`, and every key is optional. Without `name`, `accent` and `logo`, the admin is tinyzoo's own.

```ts
export default defineAppConfig({
  cms: { admin: {
    name: { cs: 'Pekárna Novák', en: 'Novák Bakery' }, // the sidebar, the tab title, the emails; the logo's text for screen readers
    siteUrl: 'https://pekarna-novak.cz',                 // "View website"
    accent: '#B4532A',           // the client's brand colour, or mono (default) | indigo | blue | violet | emerald
    logo: { full: '/brand/logo.svg', mark: '/brand/mark.svg' }, // files in public/brand/; fullDark and markDark too
    signature: true,             // tinyzoo's quiet signature; false hides it
    animals: true,               // tinyzoo's animals at the moments; false hides them all
    locales: ['cs', 'en'], defaultLocale: 'cs', // the admin's languages (below)
    timeZone: 'Europe/Prague',   // dates are shown and edited in this zone
  } },
})
```

The server reads `cms.admin` when it runs and gives the admin and the emails one resolved theme (`GET /api/cms/_theme`). Name, colour and logos come from there, so changing `cms.admin` in the browser at run time (`updateAppConfig`) does not change them.

**The name from the site's content.** `nameFrom: 'siteSettings.siteName'` (a global and one of its text fields) makes the admin take its name from that field when it runs, so an editor who renames the site in *Site settings* renames the admin too, and one build can serve sites with different names. While the field is empty the admin keeps `name`. A site that does not set `nameFrom` is unchanged.

![The sign-in page of a made-up bakery: the hedgehog in a muted terracotta, the bakery's logo, a faint warm background and a terracotta "Sign in" button](../screenshots/0.7/en/admin-brand-signin.png)

### The brand colour

`accent` takes one of the built-in accents (`mono`, tinyzoo's charcoal, is the default; `indigo`, `blue`, `violet`, `emerald`) or the client's brand colour as a hex: `'#B4532A'` or `'#b53'`. Names are read in any case, and spaces around a value are ignored.

The colour goes where the accent goes:

- main buttons, and a button under the pointer (a shade of its own, one step away from its text)
- the current page in the menu
- links
- focus rings: a solid 2 px ring in the link colour, never in a light button colour
- checked boxes and switches, selected options

**With a colour, the whole look follows it.** This holds for a brand colour and for the four built-in colours (`indigo`, `blue`, `violet`, `emerald`). The moments, which are cream in tinyzoo's own look (the sign-in, setup, reset and invitation pages, the welcome card on the home page, the current page in the sidebar and in a form's section menu, the icon tiles of form sections), become a faint tint of the colour in light mode and charcoal leaning toward it in dark mode: calm paper with a hint of the colour, never a coloured background. A near-grey brand gives near-grey moments. The animals take one muted shade of the colour with a near-white face, in light and dark mode.

The white workspace, the greys and the status colours (green "On the website", red errors) stay as they are. With `mono`, tinyzoo's own look, the moments stay cream and the animals keep their own colours.

tinyzoo works out the rest: the shades, a lighter version for dark mode, a button's colour under the pointer, the text colour on a button, the moments' tints and the animals' shade.

![The home page of the bakery in light mode: the welcome card on a faint terracotta tint with the owl in a muted terracotta, a terracotta "Page" button and the current page in the sidebar on the same tint](../screenshots/0.7/en/admin-brand-home.png)

**The text on a button is white or ink, whichever reads better.** Dark colours get white text, light ones ink. Mid tones often get ink too: on `#3B82F6` ink reads at 5.0:1 and white at only 3.7:1, so its buttons carry ink text. That is on purpose; there is no option to force white. The built-in colour accents (`indigo`, `blue`, `violet`, `emerald`) have white text in light mode and ink in dark mode.

**The contrast guard.** Every colour has to stay readable, in light and dark mode:

- 4.5:1 for the text on a button, at rest and under the pointer;
- 4.5:1 for links and other accent text on the page, and for every text on the brand's moments;
- 3:1 for focus rings.

When the brand colour falls short, tinyzoo moves it to the nearest colour that passes. Only the lightness changes; the hue stays. A light colour keeps its buttons: a yellow brand gets yellow buttons with ink text, while its links use a darker yellow. Links are checked on white, the brand's own moments, the hover grey and the colour's own light tint (the soft buttons, a hovered day in the calendar). So a colour that reads on white can still get a slightly darker shade for its links: `#B4532A` is 4.9:1 on white but 3.7:1 on its own tint, and its links use `#A44419`.

In development, the server log and the browser console say what changed and why:

```
[tinyzoo] cms.admin: accent #FFD500: links and other accent text would be 1.3:1 on the hover grey; they use #766100 (4.5:1); buttons keep #FFD500 with ink text (13.0:1).
```

The server log says it at every start, the browser console once per browser session (and again when the colour changes). To silence the message, pick a colour that passes, or accept the adjustment: nothing breaks either way. Production adjusts quietly.

An accent tinyzoo cannot read (`'red'`, `'#12345'`) falls back to `mono`, with the same kind of message in development.

You can try colours at `/design-system` on the tinyzoo website: it runs the same guard and shows the moments and animals a colour gives.

![The same home page in dark mode: charcoal leaning toward terracotta in the welcome card, a lighter terracotta button with dark text, and the logo on a small light tile in the sidebar](../screenshots/0.7/en/admin-brand-home-dark.png)

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

The full logo carries the name, so the admin uses `name` as its text for screen readers. Set `name` too.

What the admin shows when a logo is missing:

- no `full`: the mark with the client's name beside it;
- no `mark`: a tile with the name's initials (the tab keeps tinyzoo's icon);
- no logo and no `name`: tinyzoo's own mascot, as before.

**Dark mode.** Without `fullDark` or `markDark`, the light logo sits on a small light tile in dark mode, so a dark logo never disappears on charcoal. The tile is tinyzoo's cream, or with a brand colour the brand's own light tint. A dark version without its light one is not used.

**A logo that does not load** (a wrong address, a file that is gone) gives way: a full logo to the mark with the name, a mark to the initials, in light and dark mode. A dark version that does not load leaves its light one in place, on the light tile, as if no dark version had been given. An SVG needs no `width` or `height`: one with only a `viewBox`, as design tools export it, works.

**Tab and home-screen icons.** With a mark, the browser tab shows it, and tinyzoo makes PNG copies of it for browsers that need them (see [Emails and the phone's home screen](#emails-and-the-phones-home-screen)). Without a mark, or with one the server cannot read, the tab keeps tinyzoo's icon. This happens on the admin's pages only; the website keeps its own.

**Checks in development.** When the dev server starts, tinyzoo looks at each logo and warns in the log about:

- an address it cannot use (it must start with `/` or `https://`; an `http://` logo is kept with a warning, but an https admin blocks it and the server never downloads it);
- a file that is missing;
- a mark that is not square;
- a PNG that is too small to stay sharp;
- an SVG with text in it (`<text>`): the PNG copies are drawn on the server with whatever fonts it has, often none, so convert the text to outlines in your design tool.

A logo never stops the start, and production does not check.

![The bakery's post list with the sidebar folded to icons: the bakery's mark at the top, the current page on the brand's tint, a terracotta "+ Post" button](../screenshots/0.7/en/admin-brand-folded.png)

### Emails and the phone's home screen

The emails the admin sends (invitations, password resets, the emails about a changed sign-in address) carry the client's brand:

- the full logo at the top, 160 px wide. Without `logo.full`, the site's name in bold;
- the site's name from `cms.admin.name`, in the recipient's language;
- the main button in the accent colour, with its text colour;
- the written-out link under it, a real link in the accent's link colour.

Emails never carry tinyzoo's signature. The text version stays plain: the message and the link. The email that a form sends to the site's staff is not branded.

![An invitation email of the bakery: the bakery's logo at the top, one sentence, a terracotta "Accept the invitation" button and the link written out in terracotta](../screenshots/0.7/en/email-brand-invite.png)

Gmail and Outlook do not show SVG, so tinyzoo makes PNG versions of the logo on the server:

| File | Made from | What for |
|---|---|---|
| `/api/cms/_brand/full-email.png` | `logo.full` | the emails: 320 px wide, at most 120 px tall, transparent |
| `/api/cms/_brand/mark-32.png` | `logo.mark` | the PNG tab icon |
| `/api/cms/_brand/mark-180.png` | `logo.mark` | the phone's home-screen icon (apple-touch-icon): on white, with a little padding |
| `/api/cms/_brand/mark-192.png`, `mark-512.png` | `logo.mark` | the web manifest |

Without a mark, the icons show tinyzoo's own. Without a full logo, `full-email.png` is a 404 and the emails show the name. A logo that cannot be read is left out, with one line in the server log: the emails show the name, and the mark files and the tab show tinyzoo's mark.

What tinyzoo reads to make them:

- **A file of the site** (`/brand/logo.svg`): a picture in `public/` ending in `.svg`, `.png`, `.webp`, `.jpg`, `.jpeg` or `.avif`, not under `/api/`. In production it is read from the built site; in development from the `public/` folder on disk.
- **An `https://` URL**: downloaded with a 5 second limit, at most 2 MB, following at most two redirects, each to `https://` again. Only from hosts on the public internet: an address that resolves to the server's own network (localhost, private ranges, link-local, cloud metadata) is refused. A logo on an intranet server belongs in `public/` instead. An `http://` logo is never downloaded.

**Caching.** The addresses carry `?v=`, a hash of the logo file and of how tinyzoo draws it. With it, browsers and mail apps may keep a file for a year; replace the logo, even under the same name, and the address changes. In production tinyzoo reads each logo again every 15 minutes, so a new file (a redeploy, a changed `https://` logo) reaches the icons and new emails within that time. Emails already sent keep the picture they had. Development never lets the browser keep the files.

`/api/cms/_brand/admin.webmanifest` lets people add the admin to a phone's home screen. It opens `/admin/` as an app, with the site's name in the admin's default language and the mark as its icon. Without a mark there is no manifest.

**The public address.** The logo in emails needs the site's public address, `NUXT_CMS_PUBLIC_URL`. Production needs it anyway for the links. Mail clients load the logo from there, so it must be reachable from the internet. `GET /api/cms/_theme` and `/api/cms/_brand/*` need no sign-in (the sign-in page and mail clients read them), so a proxy or an access rule in front of `/api/cms` must let them through.

![The bakery's home page on a phone in dark mode: the mark on its light tile beside the menu button, the welcome card with the owl in the corner](../screenshots/0.7/en/admin-brand-phone-dark.png)

### Signature and animals

**`signature: false`** hides tinyzoo's quiet signature under the sidebar and at the foot of the sign-in pages ("Content administration" stays). The emails never carry it.

**`animals: false`** hides tinyzoo's animals everywhere, for any accent: the sign-in pages, the welcome card, empty places (they show a plain icon instead), the review before publishing, the card after publishing and the family on the first-run setup page. Each place closes up around it.

Together with your logo, your colour and `signature: false`, the admin carries nothing of tinyzoo's own look.

### The admin's language

The admin speaks Czech, English and German. It picks the language from a cookie (the person's own choice in the account menu), then the browser's language, then `defaultLocale`. `locales` limits which of them a site offers.

Labels in `cms.config.ts` take one string or one per admin language (`label: { en: 'Posts', cs: 'Články' }`). Entities can also set `icon`, `labelSingular` and `description`.

Nuxt UI draws a few words itself ("Close", "Previous month", "Show password"). They follow the admin language when the site's `app/app.vue` hands it over, and the starter does. Add `const uiLocale = useCmsUiLocale()` and `<UApp :locale="uiLocale">`. On the website's own pages it is empty, so the site keeps its own.

### The menu

The admin's menu has three parts:

- **beside Home**: the messages from the website's forms and the pages plugins add (visits). Several forms share one row, "Messages from the website"; the page itself moves between the forms and shows how many messages each holds. A site with one form keeps that form's name.
- **the groups**: "Content" for collections, "Website" for pages, the site's own globals and the media library.
- **behind "Settings"**: what plugins bring to configure themselves, the forms' settings, redirects, the team, privacy and "About". "Settings" is one row at the foot of the menu: it swaps the menu for these pages, with a way back.

Without configuration the rows of a group follow their names in the code. Say what comes first, and what belongs where, with `defineAdminMenu` in `cms.config.ts`:

```ts
import { defineAdminMenu } from 'tinyzoo'

export const menu = defineAdminMenu({
  // home: ['@forms', '/admin/p/analytics'],   // the rows beside Home, when their order should differ
  groups: {
    content: [News, Album, Course, Coach],
    website: [Page, Navigation, SiteSettings, '@media'],
    // a group of the site's own brings its name:
    // timetable: { label: { en: 'Timetable', cs: 'Rozvrh' }, items: [Schedule, Slot] },
  },
  settings: [Redirect],
  forms: [EnrolmentForm, ContactForm],          // the order of the forms on the messages page
})
```

A row is a collection or global (the value `defineEntity` and the others return, or its name), a built-in row (`'@forms'`, `'@media'`, `'@team'`, `'@privacy'`, `'@about'`), or the admin address of a plugin's page (`'/admin/p/analytics'`). Any row can go to any place: a global that is content (a timetable's heading) can sit in "Content", a collection nobody touches behind "Settings". **What the menu does not name keeps its usual place**, so a collection added later shows up without a change here. The config is checked when the site starts: a name the site does not have, a row listed twice, or a group without a label stops it with the line to fix.

**Administrators can rearrange the menu in the admin**, for everyone on the site: Settings → "Arrange the menu". Rows are dragged (or moved with the arrows) within and between the places; the groups themselves are the site's. The arrangement is kept in the database and goes on top of `defineAdminMenu`; "Back to the original" forgets it. A row added to the site after someone arranged the menu appears where the config puts it.

People see only the rows their role opens: a global they may not change, the team and privacy pages for anyone but administrators, and a closed media library are left out.

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

**Experimental: the editor in the preview.** With `NUXT_CMS_BUILDER=on` in the server's environment, an editor can select, move, duplicate, delete and add the blocks of a page in the preview itself, and the form follows. The admin and the page talk through `cms:builder:*` messages (`cms:builder:on` and `cms:builder:select` to the page; `cms:builder:select`, `move`, `duplicate`, `remove` and `add` back). A page in the preview says `cms:builder:ready` to the admin once it listens, with the variable or without it. In the preview, `<CmsBlocks>` marks each block's root element (each of them, for a component with several) with `data-cms-block`, `data-cms-block-type` and `data-cms-block-list`, never on the live site. Without the variable none of this runs, and the admin is as before. It may change in a minor release.

Blocks inside a block's list (`f.blocks()` inside a block, drawn with `<CmsBlocks>` too) are edited the same way, one level per click: the first click selects the section, the next a block inside it, the next a block inside a group. Escape goes up a level. A block inside another one is named in the messages by its `path`, the ids from the page's list down; a place can be `{ before, in }`, `{ after, in }` or `{ end: true, in }`, where `in` is the path of the block whose list it is. A block can be dragged into another list that has the same type of block and room for it. A list is full at its `max` (`f.blocks(blocks, { max })`).

While an editor works on the page, `useCmsEditing()` is `true` (never on the live site). Use it to draw an empty block, which a visitor never sees, as a quiet placeholder, so that it can be selected and filled in:

```vue
<script setup lang="ts">
defineProps<{ block: { text?: string | null } }>()
const editing = useCmsEditing()
</script>

<template>
  <h2 v-if="block.text">{{ block.text }}</h2>
  <div v-else-if="editing" class="placeholder-heading" aria-hidden="true" />
</template>
```

`useCmsEditingLabel(type)` gives a block type's name in the admin's language at that time (`''` on the live site), for a placeholder's words: with `const label = useCmsEditingLabel('heading')`, `<h2 v-else-if="editing" class="ghost">{{ label }}</h2>` reads *Nadpis* to a Czech editor. A block whose component draws no element at all gets a quiet placeholder with its name from `<CmsBlocks>` while the editor works, so it can still be selected, moved and deleted.

Beside the preview, the form shows the selected block alone: a way back to all sections, the path as a breadcrumb, its fields, its settings, and a block's own list as rows that each go a level deeper. A desktop page is laid out 1280 px wide and drawn scaled to fit the panel; the page is told its scale (`cms:builder:view`), so the tools keep their size. Undo and redo keep the changes to the page's blocks while the editor is open (at most 50 steps; typing in a field is one step per pause), with Ctrl/⌘ Z and Ctrl/⌘ ⇧ Z outside a text field; the page passes those keys on with `cms:builder:history`.

**Typing in the page.** A block's component says which element shows which field with `cmsField()`, bound in the template. It gives the element `data-cms-field` (and `data-cms-item`) while an editor works on the page, and nothing on the live site, so a visitor's page is as it was:

```vue
<template>
  <section>
    <h2 v-bind="cmsField('heading')">{{ block.heading }}</h2>
    <p v-bind="cmsField('intro')">{{ block.intro }}</p>
    <CmsContent :doc="block.body" v-bind="cmsField('body')" />
    <article v-for="card in block.cards" :key="card.id">
      <h3 v-bind="cmsField('title', card.id)">{{ card.title }}</h3>
    </article>
  </section>
</template>
```

The block is the nearest block around the element. A field of an item of the block's own list (`f.list()`), which the component draws itself, is named with the item's id. With the block selected, one more click on a marked plain text (`f.text()`, one line or several) puts the cursor there: the editor types in the page and the form follows at once (`cms:builder:text`). Enter ends a text of one line and starts a new line in a text of several; Escape or a click elsewhere ends it and keeps the text. A paste comes in as plain text, a field's `max` holds, and the page is not drawn anew while a text is typed. Typing in the page is one step of undo per field per pause, as typing in the form is. An empty text can be typed in where it shows its placeholder (`useCmsEditingLabel()`).

Rich text is not typed in the page. A click on a marked rich text, a picture or a link selects its block and brings that field into view in the panel (`cms:builder:field`); a rich text gets the cursor in its editor there, and a double click on a picture opens its chooser. An element drawn by something the template does not own (a look's own heading) can be marked after it is drawn, with the same attributes.

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

The website's theme stays the website's. The CMS components use semantic Nuxt UI classes (`bg-primary`, `text-muted`, …), but the admin sets the variables behind them itself, under `html[data-cms-admin]`, at a higher specificity than Nuxt UI's `:root`. So the site's `ui.colors` in `app.config.ts` and its `main.css` theme its own pages and do not reach the admin.

To colour the admin, set `cms.admin.accent` ([above](#the-brand-colour)): a built-in accent or a brand hex, checked by the contrast guard.

A host can still override the admin's tokens in its own CSS under `html[data-cms-admin]`, for example a radius. Two limits:

- Nothing checks the contrast of what a host sets.
- With a hex accent, the admin writes the brand's colours in a `<style>` under `html[data-cms-admin][data-cms-accent='brand']`. It wins over a host rule on `html[data-cms-admin]` that sets the accent (`--ui-primary`, `--ui-color-primary-*`) or the moments' variables. `data-cms-accent` is `mono`, `indigo`, `blue`, `violet`, `emerald` or `brand`, nothing else.

The playground's own pages use a monochrome Nuxt UI theme: `primary` is a custom `ink` ramp anchored at `#555` (defined via `@theme` in `main.css`), and `neutral` is a true-neutral gray. The admin does not take it.

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
