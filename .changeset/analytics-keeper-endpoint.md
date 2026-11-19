---
'tinyzoo': minor
---

**Analytics for a fleet monitor.** With the analytics plugin, a tool that looks after many sites (tinyzoo's Keeper) can read the daily totals with the site's status token:

```sh
curl -H "x-api-key: $NUXT_CMS_STATUS_TOKEN" "https://example.com/api/content/_analytics/rollups?from=2026-10-01&to=2026-10-31"
```

- It is guarded like `/api/health/status`: off (`404`) without `NUXT_CMS_STATUS_TOKEN`, the token as `x-api-key` or `Authorization: Bearer`, 30 requests a minute per address. At most 400 days at once.
- The answer has a format of its own, `tinyzoo-analytics-rollups` version 1 (`AnalyticsRollups` in `tinyzoo/analytics`), frozen like the status: per day the visitors, visits, pageviews, bounces and engaged time, and the 10 pages (with entry titles), sources, countries and devices with the most visitors. Never a single page view, a visitor hash or a consent id.
- `/api/health/status` gets an `analytics` key when the site uses the plugin: `{ enabled, collecting, since, rollupsPath }` (`CmsStatusAnalytics`). Keys are only added, so the status stays version 1.

See "For a fleet monitor" in `docs/analytics.md`.

### Upgrade

Nothing to do.
