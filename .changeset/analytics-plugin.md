---
'tinyzoo': minor
---

**Website analytics in the site's own admin: `tinyzoo/analytics`.** A new first-party plugin counts the website's visits without cookies and without storing anything in the visitor's browser, so the site needs no consent banner for it:

```ts
import { analyticsPlugin } from 'tinyzoo/analytics'

export const plugins = [analyticsPlugin()]
```

- **The tracker** (about 1.3 KB, 0.8 KB compressed, no dependencies) sends a page view on load and on every route change, and how long the page was visible. It skips the admin, its preview and automated browsers. The server skips robots and signed-in editors, answers at once and writes the views in batches.
- **Visitors** are a daily hash of a random salt, the site, the address and the user agent. The salt is replaced and deleted every day. The address is never stored.
- **The Analytics page** shows the headline numbers against the period before (visitors, visits, pageviews, views per visit, bounce rate, average time, and who is on the website now), visitors and pageviews over time, and lists of pages (by entry title, linked to the editor), entry pages, sources and campaigns, countries, devices, browsers, systems and languages. A click on any row filters the whole page; the filters live in the address.
- **The admin's home** gets a card with the last 7 days and the most read pages. **The entry editor** gets a "Visits" panel with the last 30 days of the entry.
- **Countries** come from the CDN's header, or from a country database file (`NUXT_CMS_ANALYTICS_GEOIP_FILE`, MaxMind format, such as DB-IP's free "IP to Country Lite").
- **Storage.** Single page views are kept `keepRawDays` (default 90) and turned into daily totals every night, which stay. Administrators can stop counting in the admin; `NUXT_CMS_ANALYTICS_ENABLED=false` stops it on a server.

`docs/analytics.md` describes it, with a sentence for the site's privacy policy in English, Czech and German. New public exports in `tinyzoo/analytics`: `analyticsPlugin`, `AnalyticsOptions`, `dailyRollups`, `DailyRollup`.

The entry editor now also leaves out a plugin's panel, heading included, when its component renders nothing. On touch screens, switches (a yes/no field, for one) keep their drawn size; the 44 px minimum for controls had stretched them into a large circle. They get the 44 px as an invisible tap area instead.

### Upgrade

Nothing to do for a site that does not add the plugin. A site that adds it runs `tinyzoo generate` and `tinyzoo up` once, for its three tables.
