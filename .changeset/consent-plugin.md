---
'tinyzoo': minor
---

**A cookie banner: `tinyzoo/consent`.** A new first-party plugin asks visitors which cookies the website may use, keeps the answer in a first-party cookie and logs it, so the site can show that a consent was given:

```ts
import { consentPlugin } from 'tinyzoo/consent'

export const plugins = [consentPlugin()]
// app.vue: <CmsConsent />
```

- **`<CmsConsent />`** is the banner and a settings dialog with a switch per category. "Reject all" and "Accept all" are the same size and style. It works with the keyboard (focus, Escape) and at phone width, uses no Tailwind classes, and is themed with `--cms-consent-*` variables.
- **Categories:** `necessary` (always on), `analytics`, `marketing`, and a site's own with localized texts (`categories`).
- **`useConsent()`** gives the site's code `granted(category)`, `choice`, `decided`, `ready`, `open()` (a "Cookie settings" link) and `onChange(cb)`, to load a video, a map or a pixel only after a yes.
- **The cookie** `tz_consent` holds the categories, the version of the texts, the day and a random consent id. `SameSite=Lax`, `Secure` in production, `cookieDays` (365, at most 395). Nothing else is stored on the device.
- **The texts** are editable in Settings → Cookie banner (per language with `localized: true`), with standard texts in Czech, English and German. **Ask everyone again** raises their version, and everyone is asked anew.
- **The consent log** `consent_log` keeps the consent id, the time, the choice, the version and the action (`given`, `changed`, `withdrawn`), with no address and no browser, for `keepLogDays` (three years). The Cookie consent page shows the answers in counts only.

**Analytics with a cookie banner.** `analyticsPlugin({ mode })` takes `'cookieless'` (the default, as before), `'consent'` or `'strict'`. `consent` keeps the consent id with the views of visitors who allowed statistics, and adds a section "Among visitors who agreed to cookies (N % of visits)": unique visitors over the whole period, new and returning, how often they come back. When someone takes statistics back, their consent id is removed from their views. `strict` sends nothing until statistics are allowed. The headline numbers count the daily hash in every mode. Both need the consent plugin; the build stops with a message without it. `docs/analytics.md` explains when each fits, with privacy-policy sentences.

**Plugins can bring composables:** `defineCmsPlugin({ composables })`, auto-imported in the website and the admin.

New public exports: `consentPlugin`, `ConsentOptions`, `ConsentCategoryDef` in `tinyzoo/consent`; `AnalyticsMode` in `tinyzoo/analytics`; `CmsConsentProps`, `CmsConsentChoice`, `CmsConsentApi`, `CmsReadonlyRef` in `tinyzoo`. `<CmsConsent>` and `useConsent()` join the frontend kit.

### Upgrade

Nothing to do for a site that does not add the plugin, and the analytics plugin keeps counting as before. A site that adds the consent plugin runs `tinyzoo generate` and `tinyzoo up` once, for its tables.
