---
'tinyzoo': minor
---

**A cookie banner: `tinyzoo/consent`.** A new first-party plugin asks visitors which cookies the website may use, keeps the answer in a first-party cookie and logs it, so the site can show that a consent was given:

```ts
import { consentPlugin } from 'tinyzoo/consent'

export const plugins = [consentPlugin()]
// app.vue: <CmsConsent />
```

- **`useConsent()`** gives the site's code `granted(category)`, `choice`, `decided`, `ready`, `open()` (a "Cookie settings" link) and `onChange(cb)`, to load a video, a map or a pixel only after a yes. It is also everything a banner of the site's own needs, with its own markup and styles: `bannerVisible`, `settingsOpen`, `close()`, the `texts` from the admin, the `categories` with their services and whether each is granted, the settings' switches `draft` (`v-model`) and `set()`, `acceptAll()`, `rejectAll()`, `save(choice?)`, and `saving` and `error` for the request that logs the choice and sets the cookie. It works without `<CmsConsent>` on the page, the analytics modes included.
- **`<CmsConsent />`** is the ready-made banner and a settings dialog with a switch per category, built on `useConsent()`. Optional: a site that leaves it out gets none of its markup or CSS. "Reject all" and "Accept all" are the same size and style. It works with the keyboard (focus, Escape) and at phone width, uses no Tailwind classes, and is themed with `--cms-consent-*` variables. `unstyled` leaves the default styles out. Slots replace its parts, each given the whole `useConsent()`: `banner`, `actions`, `settings`, `category`, `settings-actions`, or `default` for everything.
- **Categories:** `necessary` (always on), `analytics`, `marketing`, and a site's own with localized texts (`categories`). Editors can change every category's name and description in the admin, the site's own too.
- **Services and cookies:** `services` lists, per category, the services behind it: name, provider, purpose, cookie names, duration and a privacy link. The settings show them folded under each category. The plugin describes its own cookie, and the analytics plugin in the `consent` and `strict` modes what it keeps.
- **The cookie** `tz_consent` holds the categories, the version of the texts, the day and a random consent id. `SameSite=Lax`, `Secure` in production, `cookieDays` (365, at most 395). Nothing else is stored on the device.
- **The texts** are editable in Settings → Cookie banner (per language with `localized: true`), with standard texts in Czech, English and German. **Ask everyone again** raises their version, and everyone is asked anew.
- **The consent log** `consent_log` keeps the consent id, the time, the choice, the version and the action (`given`, `changed`, `withdrawn`), with no address and no browser, for `keepLogDays` (three years). The Cookie consent page shows the answers in counts only.

**Analytics with a cookie banner.** `analyticsPlugin({ mode })` takes `'cookieless'` (the default, as before), `'consent'` or `'strict'`. `consent` keeps the consent id with the views of visitors who allowed statistics, and adds a section "Among visitors who agreed to cookies (N % of visits)": unique visitors over the whole period, new and returning, how often they come back. When someone takes statistics back, their consent id is removed from their views. `strict` sends nothing until statistics are allowed. The headline numbers count the daily hash in every mode. Both need the consent plugin; the build stops with a message without it. `docs/analytics.md` explains when each fits, with privacy-policy sentences.

**Plugins can bring composables:** `defineCmsPlugin({ composables })`, auto-imported in the website and the admin.

New public exports: `consentPlugin`, `ConsentOptions`, `ConsentCategoryDef`, `ConsentServiceDef` in `tinyzoo/consent`; `AnalyticsMode` in `tinyzoo/analytics`; `CmsConsentProps`, `CmsConsentChoice`, `CmsConsentApi`, `CmsConsentTexts`, `CmsConsentCategory`, `CmsConsentService`, `CmsReadonlyRef` in `tinyzoo`. `docs/consent.md` has a complete banner of a site's own, the slots, and the reference of `useConsent()`. `<CmsConsent>` and `useConsent()` join the frontend kit.

### Upgrade

Nothing to do for a site that does not add the plugin, and the analytics plugin keeps counting as before. A site that adds the consent plugin runs `tinyzoo generate` and `tinyzoo up` once, for its tables.
