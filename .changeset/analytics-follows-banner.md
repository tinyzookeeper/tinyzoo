---
"tinyzoo": minor
---

Analytics follow the cookie banner by default. Without `mode`, a site whose consent plugin asks about `analytics` now counts in the `consent` mode: a visitor who allows statistics is also known from one visit to the next (the reports "Among visitors who agreed to cookies"), and one who rejects them is counted without a cookie. A site without a banner stays `cookieless`, and a `mode` set by hand is kept. To keep a banner site's statistics cookieless, set `analyticsPlugin({ mode: 'cookieless' })`.
