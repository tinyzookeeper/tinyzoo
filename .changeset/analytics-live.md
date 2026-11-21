---
'tinyzoo': minor
---

**Analytics: sites share today's visits live with Keeper.**

- `GET /api/content/_analytics/live` answers today's visits so far for a tool that watches many sites: who is on the site now (the last five minutes), today's totals, visitors and pageviews by hour, today's top pages, sources, countries and devices, and yesterday up to the same time to compare with. It is read with the status token and guarded like `/api/health/status` and the daily totals (format `tinyzoo-analytics-live`, version 1; `AnalyticsLive` in `tinyzoo/analytics`).
- The `analytics` key of `/api/health/status` says where: `livePath`.
- The numbers are counted the way the admin's Analytics page counts them, so both agree. Nothing in the answer tells one visitor from another.

### Upgrade

Nothing to do.
