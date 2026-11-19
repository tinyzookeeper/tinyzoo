# Cookie consent

`tinyzoo/consent` puts a cookie banner on the website. Visitors choose which cookies the site may use, one category at a time, and can change their mind later. The choice is kept in a first-party cookie, and a log shows that a consent was given, when and under which texts. Editors write the banner's texts in the admin.

The plugin works on its own: a site uses it to load a YouTube video, a map or an advertising pixel only after the visitor says yes. With [analytics](analytics.md#cookie-banner), it also decides what the statistics may keep.

- [Switching it on](#switching-it-on)
- [Categories](#categories)
- [The banner](#the-banner)
- [useConsent(): the choice in the site's own code](#useconsent-the-choice-in-the-sites-own-code)
- [The texts](#the-texts)
- [Asking everyone again](#asking-everyone-again)
- [The cookie](#the-cookie)
- [The consent log](#the-consent-log)
- [The counts in the admin](#the-counts-in-the-admin)
- [Options](#options)
- [What it does not do](#what-it-does-not-do)

## Switching it on

Add the plugin in `cms.config.ts`:

```ts
// cms.config.ts
import { consentPlugin } from 'tinyzoo/consent'

export const plugins = [consentPlugin()]
```

A site with several languages (`defineLocales`) lets editors write the texts per language:

```ts
export const plugins = [consentPlugin({ localized: true })]
```

Make the tables, as after any change to the content model:

```sh
pnpm exec tinyzoo generate   # consent_log and consent_settings
pnpm exec tinyzoo up         # or start the app with NUXT_CMS_MIGRATIONS_ON_START=true
```

Then put the banner on the website, once, in `app.vue`:

```vue
<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <CmsConsent />
</template>
```

That is enough for a working banner with the standard texts in Czech, English or German.

## Categories

| Category | What it is for |
|---|---|
| `necessary` | What the website needs to work, such as the cookie that remembers the choice. Always on: shown in the settings, but it cannot be switched off |
| `analytics` | Statistics: how the website is used |
| `marketing` | Advertising and measuring it, on this website and others |

Ask only about what the site uses. A site without ads leaves `marketing` out:

```ts
consentPlugin({ categories: ['analytics'] })
```

A site can add categories of its own, with a key and texts in each language:

```ts
consentPlugin({
  categories: [
    'analytics',
    {
      key: 'video',
      label: { cs: 'Videa', en: 'Videos', de: 'Videos' },
      description: { cs: 'Přehrávač YouTube, který ukládá vlastní cookies.', en: 'The YouTube player, which sets cookies of its own.', de: 'Der YouTube-Player, der eigene Cookies setzt.' },
    },
  ],
})
```

A key is lowercase letters, digits and `_`. When the list of categories changes, everyone who has not been asked about the new one is asked again.

## The banner

`<CmsConsent />` shows the banner until the visitor chooses:

- **"Reject all" and "Accept all"** sit side by side, the same size and the same style. The Czech data protection office (ÚOOÚ) and the European Data Protection Board expect saying no to be as easy as saying yes.
- **"Settings"** opens a dialog with one switch per category. `necessary` is shown, switched on, and cannot be changed.
- The privacy policy link, when editors gave one.

It works with the keyboard and a screen reader:

- When the banner appears on a page nobody has used yet, it takes the focus, so it is reached first.
- The settings are a modal dialog: the focus stays inside, Escape closes it without saving, and the focus goes back where it was.
- The switches are checkboxes with the role `switch`, each named by its category.

At phone width the banner fills the bottom of the screen. "Reject all" and "Accept all" stay side by side, and "Settings" goes under them.

The banner is not shown while the page is rendered on the server, nor in the admin. It appears in the browser once the cookie is read, so a page cached by a CDN never carries one visitor's choice to another.

`<CmsConsent locale="en" />` takes the texts of another language than the page's `<html lang>`.

### Styling

The banner is plain HTML with its own classes (`cms-consent`, `cms-consent__btn`, `cms-consent__dialog`…). Its styles sit in the CSS base layer: any class, Tailwind utility or plain CSS of the site wins over them. It uses no Tailwind classes, so it works whether the site uses Tailwind or not.

The colours follow the page's own (`Canvas` and `CanvasText`), light or dark. Set these variables to match the site's design:

```css
:root {
  --cms-consent-bg: #fff;
  --cms-consent-fg: #1d1d1f;
  --cms-consent-button-bg: #0b5cad;   /* both "Accept all" and "Reject all" */
  --cms-consent-button-fg: #fff;
  --cms-consent-border: #e3e3e3;
  --cms-consent-radius: 12px;
  --cms-consent-font: 'Inter', sans-serif;
  --cms-consent-width: 36rem;         /* the banner's width on a large screen */
  --cms-consent-z: 1000;              /* above the site's own fixed elements */
}
```

Also `--cms-consent-shadow` and `--cms-consent-backdrop` (behind the settings dialog).

## useConsent(): the choice in the site's own code

`useConsent()` is available on every page, without an import:

```ts
const { granted, choice, decided, ready, open, onChange } = useConsent()
```

| Returns | What it is |
|---|---|
| `granted(category)` | Whether the visitor allows a category. `necessary` always; the others once they said yes. Reactive in a template or a `computed` |
| `choice` | The choice, `{ analytics: true, marketing: false }`, or `null` while the visitor has not chosen |
| `decided` | The visitor has a choice that holds |
| `ready` | The browser has read the choice. `false` while the page is rendered on the server |
| `open()` | Opens the settings dialog, for a "Cookie settings" link |
| `onChange(cb)` | Calls `cb(choice)` once the choice is known after the page loads, and whenever it changes. It stops by itself with the component, and returns a function that stops it earlier |

Until the browser has read the cookie, only `necessary` is granted. Content that needs a consent therefore appears in the browser only.

### Examples

A YouTube video only after a yes, with a button to ask for it:

```vue
<script setup lang="ts">
const { granted, open } = useConsent()
</script>

<template>
  <iframe
    v-if="granted('marketing')"
    src="https://www.youtube-nocookie.com/embed/VIDEO_ID"
    title="Video" allowfullscreen width="560" height="315"
  />
  <div v-else class="video-placeholder">
    <p>The video is on YouTube, which sets its own cookies.</p>
    <button type="button" @click="open()">Cookie settings</button>
  </div>
</template>
```

A map works the same way. A site with a category of its own (`video`) asks `granted('video')`.

A "Cookie settings" link in the footer, so a visitor can change their mind at any time:

```vue
<script setup lang="ts">
const { open } = useConsent()
</script>

<template>
  <button type="button" class="footer-link" @click="open()">Cookie settings</button>
</template>
```

An advertising pixel, loaded once marketing is allowed:

```ts
// plugins/pixel.client.ts
export default defineNuxtPlugin(() => {
  let loaded = false
  useConsent().onChange((choice) => {
    if (!choice?.marketing || loaded) return
    loaded = true
    const s = document.createElement('script')
    s.src = 'https://example.com/pixel.js'
    s.async = true
    document.head.appendChild(s)
  })
})
```

A script that is already running cannot be taken back. When a visitor withdraws, call the tool's own "stop" function in `onChange` if it has one; otherwise it stops with the next page load.

## The texts

**Settings → Cookie banner** holds the texts:

- the banner's heading and text;
- the buttons ("Accept all", "Reject all", "Settings", "Save my choice") and the heading of the settings;
- each built-in category's name and description;
- the privacy policy's link text and address (a page of the site, such as `/privacy`, or a full address).

A text left empty is the standard one, in the visitor's language. The standard texts exist in Czech, English and German, in plain words. A page in another language gets the English ones.

With `localized: true`, each language has its own texts, and a text left empty in one language is the standard text of that language. Without it, the texts are the default language's, and the site's other languages use the standard texts.

The texts of a site's own categories come from `cms.config.ts`.

## Asking everyone again

When what the cookies are used for changes (a new advertising tool, a new purpose), the earlier answers no longer cover it. **Cookie consent** in the sidebar has **Ask everyone again**: the version of the texts goes up by one, and every visitor whose choice was given under an older version sees the banner again.

The version is also a field of the Cookie banner settings. Raising it there does the same.

Fixing a typo needs no new version.

## The cookie

The choice is kept in one first-party cookie, `tz_consent`:

```
tz_consent=1.q8Kf2mZ0Ls9xWc4RbT7nYe.3.2026-11-19.analytics:1|marketing:0
```

| Part | What it is |
|---|---|
| `1` | the format of the value |
| `q8Kf2mZ0Ls9xWc4RbT7nYe` | the consent id: 16 random bytes. It links the visitor's answers in the log, and nothing else |
| `3` | the version of the texts the choice was given under |
| `2026-11-19` | the day of the choice |
| `analytics:1\|marketing:0` | each category the visitor was asked about: `1` yes, `0` no. `necessary` is not in it |

- It is set by the server when the visitor chooses: `Path=/`, `SameSite=Lax`, `Secure` on HTTPS and in production, and `Max-Age` of `cookieDays` (365 days by default, at most 395: 13 months).
- The page's script reads it, so it is not `HttpOnly`.
- After `cookieDays`, or when the version goes up, or when a category is new, the visitor is asked again.
- If the server cannot be reached, the browser keeps the choice in the same cookie by itself, so it still holds on that device.

The plugin keeps nothing else on the device: no local storage, no other cookie.

## The consent log

Data protection law asks a site to be able to show that a visitor consented. Every answer is one record in the table `consent_log`:

| Column | What it holds |
|---|---|
| `consent_id` | the consent id from the visitor's cookie |
| `at` | when |
| `choice` | yes or no per category: `{ "analytics": true, "marketing": false }` |
| `version` | the version of the texts the visitor answered |
| `action` | `given` (the first answer, or the answer after being asked again), `changed`, or `withdrawn` (it took something back and allowed nothing new) |

No address, no browser, nothing else about the visitor. Who a consent id belongs to is known only to the browser that holds the cookie. To show a consent, the visitor (or their browser's cookie) gives the id, and the log gives its history.

The answers go to `POST /api/content/_consent/choice`. It takes requests from the site's own pages only, checks the choice against the categories, and allows 30 answers per address in ten minutes.

### How long the log is kept

Every night the records older than `keepLogDays` are deleted. The default is **three years** (1095 days):

- A consent lasts at most 13 months, so a record must outlive the cookie it stands for. The plugin refuses a `keepLogDays` shorter than `cookieDays`.
- A question about a consent, from the visitor or a supervisory authority, can come long after the cookie has expired. Three years leaves room for that.
- After that, a record proves nothing anybody still asks about, and keeping it longer only keeps data.

Set it to what the site's privacy policy says.

## The counts in the admin

**Cookie consent** in the sidebar shows how visitors answer, in counts only, per week or month:

- answers that accepted all, rejected all, or chose some, as shares;
- how often each category was allowed;
- how many answers took something back.

It never lists a single record. Administrators and editors see it; the `access` option changes that. The same page has **Ask everyone again** and a link to the texts.

## Options

```ts
consentPlugin({
  categories: ['analytics', 'marketing'],
  cookieDays: 365,
  keepLogDays: 1095,
  localized: true,
  access: ({ user }) => user.base === 'admin',
})
```

| Option | Default | What it does |
|---|---|---|
| `categories` | `['analytics', 'marketing']` | What the banner asks about besides `necessary`: the built-in ones by name, a site's own as `{ key, label, description }` |
| `cookieDays` | `365` | Days a choice holds before the visitor is asked again. From 1 to 395 (13 months) |
| `keepLogDays` | `1095` | Days a record of the log is kept. From `cookieDays` to 3650 |
| `localized` | `false` | The texts per language in the admin. Needs `defineLocales` |
| `access` | administrators and editors | Who sees the counts and may ask everyone again |

## What it does not do

- **It does not block scripts by itself.** The site loads what needs a consent through `useConsent()`. A script pasted into `nuxt.config` runs whatever the visitor chose.
- **It does not list every cookie.** The categories say what the cookies are for. A site that wants a full list puts it on its privacy page.
- **It gives no legal advice.** The defaults follow what the ÚOOÚ and the European Data Protection Board publish, but what a site must ask about depends on what it uses. Ask the site's own lawyer.
