# Cookie consent

`tinyzoo/consent` puts a cookie banner on the website. Visitors choose which cookies the site may use, one category at a time, and can change their mind later. The choice is kept in a first-party cookie, and a log shows that a consent was given, when and under which texts. Editors write the banner's texts in the admin.

The plugin gives the data and does the work: the texts from the admin, the categories with their services and cookies, the choice, saving it, the cookie and the log. How the banner looks is up to the site. `<CmsConsent />` is a ready-made banner to use as it is, restyle or partly replace; a site can also leave it out and build its own banner on `useConsent()`, with its own markup and styles.

The plugin works on its own: a site uses it to load a YouTube video, a map or an advertising pixel only after the visitor says yes. With [analytics](analytics.md#cookie-banner), it also decides what the statistics may keep.

- [Switching it on](#switching-it-on)
- [Categories](#categories)
- [Services and cookies](#services-and-cookies)
- [The banner](#the-banner)
- [Slots of `CmsConsent`](#slots-of-cmsconsent)
- [Your own banner](#your-own-banner)
- [useConsent(): the choice in the site's own code](#useconsent-the-choice-in-the-sites-own-code)
- [useConsent() reference](#useconsent-reference)
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

Then put the ready-made banner on the website, once, in `app.vue` (or [build your own](#your-own-banner)):

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

With `analytics` asked, the [analytics plugin](analytics.md#cookie-banner) follows the choice by itself (its `consent` mode, the default with a banner): a yes keeps the visitor's consent id with their visits, a no is counted without a cookie.

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

A key is lowercase letters, digits and `_` (not `privacy`: its texts would take the name of the privacy link's). When the list of categories changes, everyone who has not been asked about the new one is asked again.

The `label` and `description` are the defaults. Editors can change them in the admin, like the built-in categories' texts ([The texts](#the-texts)); after adding a category, run `tinyzoo generate` and `tinyzoo up`, as its two text fields are new columns of the settings.

## Services and cookies

The settings can show, under each category, the services behind it and the cookies they set: who runs them, what for, and for how long. List them in `services`, keyed by the category (`necessary`, a built-in one or one of the site's own):

```ts
consentPlugin({
  categories: [
    'analytics',
    'marketing',
    { key: 'video', label: { en: 'Videos', cs: 'Videa' }, description: { en: 'Videos from YouTube.', cs: 'Videa z YouTube.' } },
  ],
  services: {
    necessary: [{
      name: 'Shopping cart',
      purpose: { en: 'Remembers what is in your cart.', cs: 'Pamatuje si, co máte v košíku.' },
      cookies: ['cart'],
      duration: { en: '7 days', cs: '7 dní' },
    }],
    marketing: [{
      name: 'Meta Pixel',
      provider: 'Meta Platforms Ireland Ltd.',
      purpose: { en: 'Measures how our ads work.', cs: 'Měří, jak fungují naše reklamy.' },
      cookies: ['_fbp'],
      duration: { en: '3 months', cs: '3 měsíce' },
      privacyUrl: 'https://www.facebook.com/privacy/policy/',
    }],
    video: [{
      name: 'YouTube',
      provider: 'Google Ireland Limited',
      purpose: { en: 'Plays the videos embedded in our pages.', cs: 'Přehrává videa vložená do našich stránek.' },
      cookies: ['YSC', 'VISITOR_INFO1_LIVE'],
      duration: { en: 'Up to 6 months', cs: 'Až 6 měsíců' },
      privacyUrl: 'https://policies.google.com/privacy',
    }],
  },
})
```

| Field | | What it is |
|---|---|---|
| `name` | required | The service: `YouTube`, `Shopping cart` |
| `purpose` | required | What it does, in plain words. A text, or one per language |
| `provider` | | Who runs it: `Google Ireland Limited` |
| `cookies` | | The names of its cookies (`_ga`, `_ga_*`) |
| `duration` | | How long they are kept, as text. A text, or one per language |
| `privacyUrl` | | Its own privacy policy, a full address |

The plugins describe two services by themselves, before the site's:

- under `necessary`, the consent cookie `tz_consent` and what it holds, kept for `cookieDays`;
- under `analytics`, the [analytics plugin](analytics.md#cookie-banner) in the `consent` mode (it keeps the consent id from `tz_consent` with the visits) or the `strict` mode (it counts only after a yes, and sets no cookie).

The plugin checks the list when the site starts: a category it does not ask about, a service without a name or purpose, or a misspelled field stops it with a message.

The services reach the website with the texts, in the visitor's language: in the default dialog, folded under each category, and in `useConsent().categories` for a banner of the site's own.

## The banner

`<CmsConsent />` shows the banner until the visitor chooses:

- **"Accept all" and "Reject all"** sit side by side, the same size and the same style. The Czech data protection office (ÚOOÚ) and the European Data Protection Board expect saying no to be as easy as saying yes.
- **"Settings"**, a quieter line under them, opens a dialog with one switch per category. `necessary` is shown, switched on, and cannot be changed. Under each category, "Services and cookies" unfolds its [services](#services-and-cookies).
- The privacy policy link, when editors gave one.

It works with the keyboard and a screen reader:

- When the banner appears on a page nobody has used yet, it takes the focus, so it is reached first. It draws no focus ring for that (nothing looks selected); the next Tab lands on its first button, which shows one.
- The settings are a modal dialog: the focus stays inside, Escape closes it without saving, and the focus goes back where it was.
- The switches are checkboxes with the role `switch`, each named by its category.

On a large screen the banner is a small card in the bottom right corner. At phone width it runs along the bottom edge of the screen, and the settings dialog rises from the bottom. "Accept all" and "Reject all" stay side by side, and "Settings" goes under them.

The banner is not shown while the page is rendered on the server, nor in the admin. It appears in the browser once the cookie is read, so a page cached by a CDN never carries one visitor's choice to another.

`<CmsConsent locale="en" />` takes the texts of another language than the page's `<html lang>`.

`<CmsConsent>` is optional. Everything it does comes from `useConsent()`, which works whether or not the component is on the page: the choice is read, the analytics plugin's `consent` and `strict` modes follow it, and `open()` opens the settings of whatever banner the site has. A site that does not place it gets no markup and no CSS from it.

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
  --cms-consent-width: 25rem;         /* the banner's width on a large screen */
  --cms-consent-z: 1000;              /* above the site's own fixed elements */
}
```

Also `--cms-consent-shadow` and `--cms-consent-backdrop` (behind the settings dialog).

`<CmsConsent unstyled />` leaves the default styles out. The markup and its classes stay, for the site's own CSS:

```css
.cms-consent { position: fixed; bottom: 0; inset-inline: 0; padding: 1rem 2rem; background: #111; color: #fff; }
.cms-consent__btn { padding: 0.5rem 1rem; border-radius: 999px; }
```

## Slots of `CmsConsent`

Each part of the component can be replaced with a slot. Every slot gets the whole [`useConsent()`](#useconsent-reference), with its values unwrapped as in a template (`texts.title`, `bannerVisible`), and the rest stays as it is: the banner's place and focus, the modal dialog, the styles.

| Slot | Replaces | Also gets |
|---|---|---|
| `banner` | the banner's content: heading, text and buttons | |
| `actions` | the banner's buttons | |
| `settings` | the dialog's content: heading, categories and buttons | |
| `category` | one category in the dialog: its name, description, switch and services | `category` (a [`CmsConsentCategory`](#useconsent-reference)) |
| `settings-actions` | the dialog's buttons | |
| `default` | everything: the component draws nothing of its own | |

Markup in a slot can use the component's classes (`cms-consent__btn`, `cms-consent__btn--quiet`) to look like the rest. A banner whose `banner` or `settings` slot is replaced is named by the title (`aria-label`); give the slot's own heading if it shows one.

Other buttons in the banner, and a row per category with the services named:

```vue
<template>
  <CmsConsent>
    <template #actions="{ texts, acceptAll, rejectAll, open, saving }">
      <button type="button" class="cms-consent__btn" :disabled="saving" @click="rejectAll()">{{ texts.rejectAll }}</button>
      <button type="button" class="cms-consent__btn" :disabled="saving" @click="acceptAll()">{{ texts.acceptAll }}</button>
      <button type="button" class="cms-consent__btn cms-consent__btn--quiet" @click="open()">🍪 {{ texts.settings }}</button>
    </template>

    <template #category="{ category, draft, texts }">
      <label class="flex items-start justify-between gap-4">
        <span>
          <strong>{{ category.label }}</strong>
          <small class="block opacity-80">{{ category.description }}</small>
          <small v-if="category.services.length" class="block opacity-80">
            {{ texts.services }}: {{ category.services.map((s) => s.name).join(', ') }}
          </small>
        </span>
        <input v-model="draft[category.key]" type="checkbox" class="size-5" :disabled="category.required">
      </label>
    </template>
  </CmsConsent>
</template>
```

Keep "Reject all" as easy to reach as "Accept all" in whatever the slots draw ([The banner](#the-banner)).

## Your own banner

A site can leave `<CmsConsent>` out and draw the banner and its settings itself, on `useConsent()` only. tinyzoo still gives the texts from the admin, the categories and their services, saves the choice through its endpoint (which sets the cookie and writes the log) and tells the rest of the site.

A complete banner with a settings dialog, in plain Vue with Tailwind classes. Copy it to `components/CookieBanner.vue` and put `<CookieBanner />` in `app.vue` instead of `<CmsConsent />`:

```vue
<script setup lang="ts">
const {
  bannerVisible, settingsOpen, texts, categories, draft,
  acceptAll, rejectAll, save, open, close, saving, error,
} = useConsent()

// The settings are a native modal <dialog>: focus stays inside, Escape closes it.
const dialog = ref<HTMLDialogElement | null>(null)
watch(settingsOpen, (isOpen) => {
  if (isOpen && !dialog.value?.open) dialog.value?.showModal()
  if (!isOpen && dialog.value?.open) dialog.value.close()
}, { flush: 'post' })

const button = 'flex-1 basis-36 rounded-lg px-4 py-2.5 font-medium disabled:opacity-60'
const solid = `${button} bg-gray-900 text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200`
const quiet = `${button} border border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800`
</script>

<template>
  <div
    v-if="bannerVisible" role="dialog" aria-labelledby="cookie-title"
    class="fixed inset-x-2 bottom-2 z-50 mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-5 text-gray-900 shadow-xl sm:inset-x-4 sm:bottom-4 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
  >
    <h2 id="cookie-title" class="text-lg font-semibold">{{ texts.title }}</h2>
    <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
      {{ texts.body }}
      <a v-if="texts.privacyUrl" :href="texts.privacyUrl" class="underline">{{ texts.privacyLabel }}</a>
    </p>
    <div class="mt-4 flex flex-wrap gap-2">
      <!-- "Reject all" and "Accept all": the same size and style -->
      <button type="button" :class="solid" :disabled="saving" @click="rejectAll()">{{ texts.rejectAll }}</button>
      <button type="button" :class="solid" :disabled="saving" @click="acceptAll()">{{ texts.acceptAll }}</button>
      <button type="button" :class="quiet" aria-haspopup="dialog" @click="open()">{{ texts.settings }}</button>
    </div>
  </div>

  <dialog
    ref="dialog" aria-labelledby="cookie-settings-title"
    class="m-auto w-[min(36rem,calc(100vw-1rem))] rounded-2xl bg-white p-0 text-gray-900 shadow-xl backdrop:bg-black/50 dark:bg-gray-900 dark:text-white"
    @cancel.prevent="close()" @close="close()"
  >
    <form class="flex max-h-[88dvh] flex-col" @submit.prevent="save()">
      <header class="flex items-center justify-between gap-4 border-b border-gray-200 py-3 pr-3 pl-5 dark:border-gray-800">
        <h2 id="cookie-settings-title" class="text-lg font-semibold">{{ texts.settingsTitle }}</h2>
        <button type="button" class="size-11 rounded-full text-2xl hover:bg-gray-100 dark:hover:bg-gray-800" :aria-label="texts.close" @click="close()">
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <ul class="divide-y divide-gray-200 overflow-y-auto px-5 dark:divide-gray-800">
        <li v-for="c in categories" :key="c.key" class="py-4">
          <label class="flex items-start justify-between gap-4">
            <span>
              <span class="block font-medium">{{ c.label }}</span>
              <span class="mt-1 block text-sm text-gray-600 dark:text-gray-400">{{ c.description }}</span>
            </span>
            <span class="flex shrink-0 flex-col items-end gap-1">
              <input v-model="draft[c.key]" type="checkbox" role="switch" class="size-5 accent-gray-900 dark:accent-white" :disabled="c.required">
              <span v-if="c.required" class="text-xs text-gray-500">{{ texts.alwaysOn }}</span>
            </span>
          </label>

          <details v-if="c.services.length" class="mt-2 text-sm">
            <summary class="cursor-pointer py-2 underline">{{ texts.services }} ({{ c.services.length }})</summary>
            <ul class="space-y-2">
              <li v-for="s in c.services" :key="s.name" class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                <p class="font-medium">{{ s.name }}</p>
                <p class="text-gray-600 dark:text-gray-300">{{ s.purpose }}</p>
                <dl class="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-gray-600 dark:text-gray-400">
                  <template v-if="s.provider"><dt>{{ texts.provider }}</dt><dd>{{ s.provider }}</dd></template>
                  <template v-if="s.cookies.length"><dt>{{ texts.cookies }}</dt><dd>{{ s.cookies.join(', ') }}</dd></template>
                  <template v-if="s.duration"><dt>{{ texts.duration }}</dt><dd>{{ s.duration }}</dd></template>
                </dl>
                <a v-if="s.privacyUrl" :href="s.privacyUrl" target="_blank" rel="noopener" class="underline">{{ texts.privacyLabel }}</a>
              </li>
            </ul>
          </details>
        </li>
      </ul>

      <footer class="border-t border-gray-200 px-5 py-4 dark:border-gray-800">
        <!-- The choice holds in this browser even when the server could not record it. -->
        <p v-if="error" role="status" class="mb-3 text-sm text-gray-600 dark:text-gray-400">{{ error }}</p>
        <div class="flex flex-wrap gap-2">
          <button type="button" :class="solid" :disabled="saving" @click="rejectAll()">{{ texts.rejectAll }}</button>
          <button type="button" :class="solid" :disabled="saving" @click="acceptAll()">{{ texts.acceptAll }}</button>
          <button type="submit" :class="quiet" :disabled="saving">{{ texts.save }}</button>
        </div>
      </footer>
    </form>
  </dialog>
</template>
```

What it relies on:

- **`bannerVisible`** is true once the browser has read the cookie and loaded the texts, while the visitor has no choice that holds: never asked, the choice too old, the texts' version raised, or a new category. It is false on the server and in the admin, so the banner never ends up in a cached page.
- **`open()`** starts the settings' switches (`draft`) from the visitor's choice; `v-model="draft[c.key]"` (or `set(key, value)`) changes them, and **`save()`** saves them. Closing without saving throws them away.
- **`acceptAll()`, `rejectAll()` and `save()`** hide the banner and close the settings at once; the request to the server follows. While it runs, `saving` is true. If it fails, `error` says why, and the choice still holds in this browser.
- **Keyboard and screen readers:** the native `<dialog>` with `showModal()` keeps the focus inside and closes on Escape (`@cancel`). Give the banner a heading it is labelled by, and keep "Reject all" next to "Accept all", the same size and style.

The "Cookie settings" link in the footer ([examples](#examples)) calls the same `open()`, so it opens this dialog.

## useConsent(): the choice in the site's own code

`useConsent()` is available on every page, without an import. The site's code asks it what the visitor allows:

```ts
const { granted, choice, decided, ready, open, onChange } = useConsent()
```

It is the same whether the page uses `<CmsConsent>`, a banner of the site's own, or none. Until the browser has read the cookie, only `necessary` is granted. Content that needs a consent therefore appears in the browser only. The [reference](#useconsent-reference) lists everything it returns.

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

## useConsent() reference

Values marked *reactive* are Vue computed refs: `.value` in a script, plain in a template.

**The choice**

| Returns | What it is |
|---|---|
| `granted(category)` | Whether the visitor allows a category. `necessary` always; the others once they said yes. Reactive in a template or a `computed` |
| `choice` | *Reactive.* The choice, `{ analytics: true, marketing: false }`, or `null` while the visitor has not chosen (or is asked again) |
| `decided` | *Reactive.* The visitor has a choice that holds |
| `ready` | *Reactive.* The browser has read the choice and the texts. `false` while the page is rendered on the server, and in the admin |
| `onChange(cb)` | Calls `cb(choice)` once the choice is known after the page loads, and whenever it changes. It stops by itself with the component, and returns a function that stops it earlier |

**The banner and its settings**

| Returns | What it is |
|---|---|
| `bannerVisible` | *Reactive.* The banner should show now: `ready`, the texts loaded, and no choice that holds (never asked, too old, new texts or a new category) |
| `settingsOpen` | *Reactive.* The settings are open |
| `open()` | Opens the settings, their switches set from the visitor's choice. Also for a "Cookie settings" link |
| `close()` | Closes the settings without saving |
| `texts` | *Reactive.* The texts in the page's language (`CmsConsentTexts`, below). Empty strings until they are loaded |
| `categories` | *Reactive.* The categories, `necessary` first (`CmsConsentCategory`, below) |
| `draft` | The settings' switches, `{ necessary: true, analytics: false, … }`. Writable: `v-model="draft[c.key]"` |
| `set(category, value)` | Sets one switch. `necessary` stays on |
| `acceptAll()` | Allows every category, saves, closes the settings. Returns a promise |
| `rejectAll()` | Allows only `necessary`, saves, closes the settings. Returns a promise |
| `save(choice?)` | Saves the switches, or the given choice (`{ marketing: true }`; a category left out is a no), and closes the settings. Returns a promise |
| `saving` | *Reactive.* A choice is on its way to the server |
| `error` | *Reactive.* Why the last choice could not be recorded on the server, or `null`. The choice holds in this browser all the same |

The choice counts the moment it is made: the banner hides, `granted()` changes and `onChange` callbacks run before the server answers. The server writes the log and sets the cookie; when it cannot be reached, the browser sets the same cookie itself.

**`texts`** (`CmsConsentTexts`): `title`, `body`, `acceptAll`, `rejectAll`, `settings` (the button that opens them), `settingsTitle`, `save`, `privacyLabel`, `privacyUrl` (`''` when there is none), `alwaysOn` (next to `necessary`'s switch), `close` (the close button's name), and the labels of the services: `services` ("Services and cookies"), `provider`, `cookies`, `duration`. Editors write the first nine in the admin; the others are the standard ones in the visitor's language.

**A category** (`CmsConsentCategory`):

| Field | What it is |
|---|---|
| `key` | `necessary`, `analytics`, `marketing`, or the site's own |
| `label`, `description` | In the visitor's language, as editors wrote them, else the defaults |
| `required` | `true` for `necessary`: shown, always on, not switchable |
| `granted` | Allowed in the visitor's choice now (`required` ones always) |
| `services` | Its [services](#services-and-cookies) (`CmsConsentService`): `name`, `provider`, `purpose`, `cookies` (a list of names), `duration`, `privacyUrl`. Texts not given are `''` |

## The texts

**Settings → Cookie banner** holds the texts:

- the banner's heading and text;
- the buttons ("Accept all", "Reject all", "Settings", "Save my choice") and the heading of the settings;
- each category's name and description, the site's own categories too;
- the privacy policy's link text and address (a page of the site, such as `/privacy`, or a full address).

A text left empty is the standard one, in the visitor's language. The standard texts exist in Czech, English and German, in plain words. A page in another language gets the English ones.

With `localized: true`, each language has its own texts, and a text left empty in one language is the standard text of that language. Without it, the texts are the default language's, and the site's other languages use the standard texts.

For a site's own category, an empty name or description is the one in `cms.config.ts` (in the visitor's language), which the admin shows under the field.

The labels of the services ("Services and cookies", "Provider", "Cookies", "Kept for"), "Always on" and "Close" are the standard ones in the visitor's language. A banner of the site's own uses whatever words it likes.

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
| `services` | none | The services and cookies behind each category, keyed by category, see [Services and cookies](#services-and-cookies) |
| `cookieDays` | `365` | Days a choice holds before the visitor is asked again. From 1 to 395 (13 months) |
| `keepLogDays` | `1095` | Days a record of the log is kept. From `cookieDays` to 3650 |
| `localized` | `false` | The texts per language in the admin. Needs `defineLocales` |
| `access` | administrators and editors | Who sees the counts and may ask everyone again |

## What it does not do

- **It does not block scripts by itself.** The site loads what needs a consent through `useConsent()`. A script pasted into `nuxt.config` runs whatever the visitor chose.
- **It does not find cookies by itself.** It shows the services and cookies the site lists in `services` (and its own). Which tools a site uses, and what they set, only the site knows.
- **It gives no legal advice.** The defaults follow what the ÚOOÚ and the European Data Protection Board publish, but what a site must ask about depends on what it uses. Ask the site's own lawyer.
