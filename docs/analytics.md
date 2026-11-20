# Analytics

`tinyzoo/analytics` counts the website's visits and shows them in the site's own admin: how many people came, what they read, where they came from, on which devices and in which language. It sets no cookie and stores nothing in the visitor's browser. It keeps no address. A visitor cannot be recognised from one day to the next.

A site with a cookie banner ([consent](consent.md)) can go further: it can learn more about the visitors who agree, or count nobody who has not agreed. See [Cookie banner](#cookie-banner).

- [Switching it on](#switching-it-on)
- [What the admin shows](#what-the-admin-shows)
- [What is counted, and how](#what-is-counted-and-how)
- [Options](#options)
- [Stopping and starting](#stopping-and-starting)
- [Countries](#countries)
- [Cookie banner](#cookie-banner): the modes `cookieless`, `consent` and `strict`
- [Privacy](#privacy), with a sentence for the site's privacy policy
- [The tables](#the-tables)
- [For a fleet monitor](#for-a-fleet-monitor): the daily totals over HTTP, with the status token

## Switching it on

A site made by `tinyzoo init` or `pnpm create tinyzoo` has it already: it is one of the parts, `analytics`, and on unless `--presets` leaves it out.

For an older site, add the plugin in `cms.config.ts`:

```ts
// cms.config.ts
import { analyticsPlugin } from 'tinyzoo/analytics'

export const plugins = [analyticsPlugin()]
```

Then make the tables, as after any change to the content model:

```sh
pnpm exec tinyzoo generate   # analytics_events, analytics_daily and analytics_settings
pnpm exec tinyzoo up         # or start the app with NUXT_CMS_MIGRATIONS_ON_START=true
```

That is all. The website's pages send their visits from the next deploy on. Nothing in the site's own pages changes.

To take it out again, remove it from `plugins`. The next `tinyzoo generate` offers to drop its tables; the guard stops there, because that loses the numbers. Keep the tables if you may want the numbers again.

## What the admin shows

**Analytics** in the sidebar opens the report:

- **The period.** Today, yesterday, the last 7 or 30 days, this month, last month, the last 12 months, or days of your own. Each is compared with the period before it (this month with the same days of the month before). The comparison can be switched off.
- **The headline numbers**, each with its change against the period before:
  - unique visitors;
  - visits;
  - pageviews;
  - views per visit;
  - the bounce rate (visits that saw one page);
  - the average time a visit had the page in front of it.

  Next to them, **on the website now**: visitors of the last five minutes, updated every 30 seconds.
- **The chart.** Visitors and pageviews by hour for one day, by day for longer periods. The period before is drawn dashed.
- **The lists.**
  - **Pages and entry pages.** A page that is an entry shows its title and opens the editor.
  - **Sources.** Grouped as Google, Seznam, Bing, DuckDuckGo, Facebook, Instagram, LinkedIn, X, YouTube, other websites and "direct or unknown". Also the referring websites themselves and the `utm_campaign`, `utm_source` and `utm_medium` of tagged links.
  - **Countries**, with their flags.
  - **Devices** (phone, tablet, computer), browsers and systems.
  - **The language version** that was read, and the browser's own language.

A click on any row shows only the visits it stands for: "Source: Google", then "Country: Slovakia". The filters apply to every number on the page. They live in the address, so a filtered view can be sent to someone.

The report is in two more places:

- **The admin's home page** has a card: visitors of the last 7 days against the 7 before, and the three most read pages.
- **The entry editor** has a "Visits" panel for entries with a page on the website: views, visitors and average time over the last 30 days, a small chart, and where the visits came from.

Administrators and editors see the reports. Authors do not: how many people read the site is the business's own information. The `access` option changes that ([Options](#options)).

## What is counted, and how

The plugin brings a small script for the website's pages (about 1.3 KB, 0.8 KB compressed, no dependencies). It sends:

- a page view when a page opens, and again after every change of route;
- when the visitor leaves the page or hides the tab, how long the page was visible (at most 30 minutes per view).

A view carries the page's address, where the visitor came from, the `utm_*` values of the address, the screen's width, the browser's language and the page's language. It goes to `POST /api/content/_analytics/e`. The server answers at once and writes the views a few seconds later, several together, so the website never waits for it.

The server adds the rest:

- **Device** from the screen width: phone under 600 pixels, tablet up to 1024, computer above.
- **Browser and system** from the user agent.
- **Source** from the referring address, grouped as above. A tagged link opened from an app or an email, which has no referrer, gets the source its `utm_source` names.
- **Country** from the CDN, or from a country database ([Countries](#countries)).
- **The entry** behind the address, when tinyzoo knows it. The admin then shows the entry's title.

### Visitors and visits

A **visitor** is a hash of the day's salt, the site, the address and the browser's user agent:

- The salt is random. It is replaced every day, and the old one is deleted.
- The same browser counts once a day. On the next day it is a new visitor that cannot be linked to the last one.
- Nobody can go back from the hash to the address. The salt that made it no longer exists.

So "unique visitors" of a week are the visitors of each day, added up. Someone who comes on three days counts three times.

A **visit** is one visitor's page views with gaps under 30 minutes. A visit belongs to where it started: its source and campaign are those of its first view.

### What is not counted

- The admin (`/admin` and below) and the API.
- People signed in to the admin, while they look at their own website.
- The admin's preview.
- Robots and scripts. They are recognised by their user agent. A robot that runs no JavaScript never runs the script either.
- Pages the site leaves out with `excludePaths`.
- Browsers that ask not to be tracked, if the site asks for that with `respectDoNotTrack`.

## Options

```ts
analyticsPlugin({
  mode: 'cookieless',
  keepRawDays: 90,
  access: ({ user }) => user.base === 'admin',
  respectDoNotTrack: true,
  excludePaths: ['/shop/checkout'],
  countryHeaders: ['cf-ipcountry'],
  geoipFile: '/data/dbip-country-lite.mmdb',
  timeZone: 'Europe/Prague',
})
```

| Option | Default | What it does |
|---|---|---|
| `mode` | `'cookieless'` | With a cookie banner or without: `'cookieless'`, `'consent'` or `'strict'`, see [Cookie banner](#cookie-banner) |
| `keepRawDays` | `90` | Days the single page views are kept. Every night, older ones are deleted and only their daily totals stay. From 2 to 3650 |
| `access` | administrators and editors | Who reads the reports: a rule like an entity's access rules, `({ user }) => boolean`. `user.base` is the built-in role a custom role extends |
| `respectDoNotTrack` | `false` | Counts no browser that sends Do Not Track (`DNT: 1`) or Global Privacy Control (`Sec-GPC: 1`) |
| `excludePaths` | none | Paths never counted, each with everything under it |
| `countryHeaders` | Cloudflare's, Vercel's and CloudFront's | The request headers the CDN in front of the site puts the visitor's country in |
| `geoipFile` | `NUXT_CMS_ANALYTICS_GEOIP_FILE` | A country database file, see [Countries](#countries) |
| `timeZone` | the admin's (`cms.admin.timeZone`) | The time zone days are counted in |

### Older periods

Single page views are kept for `keepRawDays`. Every night, the day before is added up per page, source, country, device and so on, and views older than `keepRawDays` are deleted. A period that reaches further back reads those daily totals, so its numbers stay.

The daily totals cover one thing at a time: pages, or sources. They cannot be combined. So filters cover the last `keepRawDays` only, and the page says so when a period reaches further.

## Stopping and starting

There are three ways:

- **For a while.** An administrator switches **Counting visits** off at the top of the Analytics page, or in Settings → Counting visits. The website stops counting. What it counted stays in the reports. Switching it on again continues.
- **On one server.** `NUXT_CMS_ANALYTICS_ENABLED=false` in the environment stops counting there, whatever the admin says. Use it on staging, or to stop at once without a deploy.
- **For good.** Remove the plugin from `plugins` ([Switching it on](#switching-it-on)).

## Countries

The country comes from the CDN when there is one in front of the site. Cloudflare, Vercel and Amazon CloudFront put it in a request header: `cf-ipcountry`, `x-vercel-ip-country`, `cloudfront-viewer-country`. Another CDN goes into `countryHeaders`.

Without a CDN, the plugin can look the address up in a country database. It reads the MaxMind format (`.mmdb`):

- **DB-IP "IP to Country Lite"**: free, licensed CC BY 4.0. Its licence asks for a credit, such as "IP address data by DB-IP" with a link to db-ip.com, on a page of the site (the privacy page is a good place).
- **MaxMind GeoLite2 Country**: free with an account, under MaxMind's own licence.

Download the file, put it somewhere the server reads, and point the plugin at it:

```sh
NUXT_CMS_ANALYTICS_GEOIP_FILE=/data/dbip-country-lite.mmdb
```

The file is read once, into memory. The address is only looked up, never kept. A file that cannot be read is reported once in the log, and visits then have no country. Both databases are updated every month. Replace the file now and then, and restart the app to read the new one.

tinyzoo does not ship a database: it would add several megabytes to every site, and it would be out of date within a month.

## Cookie banner

The plugin has three modes. Each counts the headline numbers (visitors, visits, pageviews) the same way, by the day's hash, so nobody is counted twice and switching modes does not make the charts jump.

```ts
import { analyticsPlugin } from 'tinyzoo/analytics'
import { consentPlugin } from 'tinyzoo/consent'

export const plugins = [consentPlugin(), analyticsPlugin({ mode: 'consent' })]
```

`consent` and `strict` need the [consent plugin](consent.md), asking about `analytics`. Without it, the build and the start stop with a message that names both plugins.

| Mode | What is counted | What the admin shows |
|---|---|---|
| `cookieless` (default) | Every visit, without a cookie. The banner, if the site has one, does not change it | The report |
| `consent` | Every visit, as in `cookieless`. A visit of someone who allowed statistics in the banner also carries the consent id from their cookie | The report, and a section "Among visitors who agreed to cookies" |
| `strict` | Only visits of people who allowed statistics. Before they do, the page sends nothing at all | The report, of those visitors only |

### `cookieless`

Nothing is stored on the visitor's device, so the statistics need no consent ([Privacy](#privacy)). This is right for most sites, and for every site without a cookie banner.

### `consent`

Everyone is still counted by the day's hash. The endpoint also reads the visitor's consent cookie (on the server: it is the same site), and when statistics are allowed, it keeps the cookie's consent id with the view (the column `consent_id`). The consent id lasts as long as the consent, up to 13 months, so these visitors can be followed from one day to the next.

That gives a section of its own on the Analytics page, **Among visitors who agreed to cookies (N % of visits)**. The share is in the heading, so nobody reads the sample as the total:

- **Unique visitors in the whole period**, each person once, not once a day;
- **new and returning** visitors: first seen in the period, or seen before it;
- **how often they came back**: visitors by their number of visits (1, 2, 3–5, 6 or more), and visits per visitor.

These reports cover the raw views only (the last `keepRawDays`). The filters apply to them.

Which source brought the people who later sent a form is not shown: form messages are not linked to visits.

When someone takes statistics back, their consent id is removed from every view at once. Their visits stay, counted like everyone's. The consent log records the withdrawal ([consent](consent.md#the-consent-log)).

Use it when the site already has a banner (for ads, videos or maps) and wants to know its regular readers better. It is a sample: people who say yes to cookies are not a random part of the audience.

### `strict`

The page sends nothing, not even the time on a page, until the visitor allows statistics. From then on they are counted by the day's hash, as everyone is in `cookieless`; the consent id is not kept. When they take it back, sending stops at once. The server checks the cookie too, so a page that still runs the old script cannot add views.

This is for a site whose lawyer reads the European Data Protection Board's Guidelines 2/2023 on Article 5(3) of the ePrivacy Directive strictly: as covering any script that sends something from the visitor's device, even without a cookie. The price is the numbers: everyone who rejects, or never answers the banner, is missing, and that is often more than half of the visitors. Trends stay readable; totals do not.

### Which one

- No banner on the site, or a banner for other things and plain statistics enough: `cookieless`.
- A banner on the site anyway, and wanting to know the people who come back: `consent`.
- A lawyer who asks for consent before any measuring at all: `strict`.

This page describes what each mode does. Whether a site needs consent for its statistics is a legal question for the site's own lawyer.

## Privacy

What is stored per page view: the time, the page, the entry, the language, the day's visitor hash, the visit, where it came from (the referring website's name, never its full address), the campaign, the country, the device, the browser, the system, the browser's language and the time on the page.

What is never stored: the address (IP), the full user agent, a cookie or anything else in the browser, the referring page's full address.

The address and the user agent are used once, when the view arrives, for the hash and the country. Then they are forgotten. The hash cannot be linked across days, and the salt that made it is deleted after a day. After `keepRawDays`, only totals per day remain.

Nothing is stored in the visitor's browser, so the rules on cookie consent do not apply to it, and the site needs no consent banner for its analytics (in the default `cookieless` mode; see [Cookie banner](#cookie-banner) for the others). The site still processes the address for a moment, so the privacy policy should mention it. A sentence to start from:

> **English.** We count visits to this website to see what people read and how they find us. We use no cookies and store nothing in your browser. Your IP address is used only for a moment, to recognise the same visit during one day and to tell the country; it is never stored. Visits cannot be linked from one day to the next, and the statistics stay on our own server; nobody else receives them. Single page views are deleted after 90 days; after that we keep only daily totals.

> **Česky.** Návštěvy tohoto webu počítáme, abychom viděli, co lidé čtou a jak nás najdou. Nepoužíváme cookies a do vašeho prohlížeče nic neukládáme. Vaši IP adresu použijeme jen na okamžik, abychom během jednoho dne poznali stejnou návštěvu a zjistili zemi; nikdy ji neukládáme. Návštěvy nelze propojit z jednoho dne na druhý a statistiky zůstávají na našem vlastním serveru; nikdo jiný je nedostává. Jednotlivá zobrazení stránek po 90 dnech mažeme; potom uchováváme jen denní součty.

> **Deutsch.** Wir zählen die Besuche dieser Website, um zu sehen, was gelesen wird und wie man uns findet. Wir verwenden keine Cookies und speichern nichts in Ihrem Browser. Ihre IP-Adresse wird nur einen Moment lang verwendet, um denselben Besuch innerhalb eines Tages zu erkennen und das Land zu bestimmen; sie wird nie gespeichert. Besuche lassen sich nicht von einem Tag zum nächsten verknüpfen, und die Statistik bleibt auf unserem eigenen Server; niemand sonst erhält sie. Einzelne Seitenaufrufe werden nach 90 Tagen gelöscht; danach behalten wir nur Tagessummen.

Change "90 days" when `keepRawDays` is something else. With a country database from DB-IP, add its credit.

That sentence is for `cookieless`. With a cookie banner, add one of these.

For `consent`:

> **English.** If you allow statistics in the cookie settings, we also keep the random identifier of your consent with your visits, for as long as your consent lasts (at most 13 months). It lets us see how often people come back. If you take your consent back, the identifier is removed from your visits at once.

> **Česky.** Pokud v nastavení cookies povolíte statistiky, uchováváme u vašich návštěv také náhodný identifikátor vašeho souhlasu, a to po dobu platnosti souhlasu (nejvýše 13 měsíců). Díky němu vidíme, jak často se lidé vracejí. Když souhlas odvoláte, identifikátor z vašich návštěv hned odstraníme.

> **Deutsch.** Wenn Sie in den Cookie-Einstellungen Statistik erlauben, speichern wir zu Ihren Besuchen auch die zufällige Kennung Ihrer Einwilligung, solange die Einwilligung gilt (höchstens 13 Monate). So sehen wir, wie oft Besucher wiederkommen. Wenn Sie die Einwilligung widerrufen, entfernen wir die Kennung sofort aus Ihren Besuchen.

For `strict`, instead of "We count visits to this website":

> **English.** We count visits to this website only if you allow statistics in the cookie settings.

> **Česky.** Návštěvy tohoto webu počítáme, jen pokud v nastavení cookies povolíte statistiky.

> **Deutsch.** Wir zählen die Besuche dieser Website nur, wenn Sie in den Cookie-Einstellungen Statistik erlauben.

## The tables

The plugin's tables are made by the site's own migration (`tinyzoo generate`):

| Table | What it holds | Kept |
|---|---|---|
| `analytics_events` | One row per page view, with what is listed under [Privacy](#privacy). `consent_id` holds the visitor's consent id in the `consent` mode, when they allowed statistics; it is empty otherwise, and emptied when they take it back | `keepRawDays` |
| `analytics_daily` | Totals per day, dimension and value: visitors, visits, pageviews, bounces, time. The dimension `total` (value `''`) is the day as a whole | always |
| `analytics_settings` | The "Counting visits" settings (on or off) | always |
| `cms_state`, key `analytics:salt` | The day's salt | one day |

`tinyzoo backup` holds them with the rest of the database. `tinyzoo export` and `import` carry content only, so the numbers stay where they were counted.

The daily totals hold nothing about a single visitor. Code on the server can read them with `dailyRollups(db, from, to)` from `tinyzoo/analytics`.

## For a fleet monitor

A tool that looks after many sites (tinyzoo's Keeper, or your own) can read the daily totals with the site's status token, the same one `/api/health/status` asks for ([Site status](deploying.md#site-status)):

```sh
curl -H "x-api-key: $NUXT_CMS_STATUS_TOKEN" \
  "https://example.com/api/content/_analytics/rollups?from=2026-10-01&to=2026-10-31"
```

The route is guarded exactly like the status. It is off (`404`) until `NUXT_CMS_STATUS_TOKEN` is set. It asks for the token as `x-api-key` or `Authorization: Bearer`, and a signed-in admin without it gets `401`. One address may ask 30 times a minute. `from` and `to` are days in the site's time zone, both included, at most 400 days apart; anything else is a `400`.

The answer (`AnalyticsRollups` in `tinyzoo/analytics`):

```jsonc
{
  "format": "tinyzoo-analytics-rollups",
  "version": 1,
  "at": "2026-11-01T06:00:00.000Z",
  "timeZone": "Europe/Prague",
  "from": "2026-10-01",
  "to": "2026-10-31",
  "since": "2026-09-14",   // the first day with totals; null before the first night
  "through": "2026-10-31", // the last day whose totals are made (usually yesterday); null when none are
  "days": [
    {
      "day": "2026-10-01",
      "visitors": 412, "visits": 468, "pageviews": 1031, "bounces": 201, "engagedMs": 23514000,
      "pages":     [{ "value": "/blog/chleba", "title": "Jak péct chleba", "visitors": 88, "visits": 90, "pageviews": 97 }],
      "sources":   [{ "value": "Google", "visitors": 240, "visits": 262, "pageviews": 610 }],
      "countries": [{ "value": "CZ", "visitors": 371, "visits": 420, "pageviews": 940 }],
      "devices":   [{ "value": "mobile", "visitors": 260, "visits": 291, "pageviews": 588 }]
    }
  ]
}
```

- `days` has every day of the range from `since` to `through`, oldest first. A day nobody visited is there with zeros. Today is never there: a day's totals are made in the night after it, so ask again for the last few days to get them final.
- Each list holds the 10 values with the most visitors. `title` is the entry's title, when the address is an entry tinyzoo knows.
- It holds the [daily totals](#the-tables) only: no single page view, no visitor hash, no visit id, no consent id. Nothing in it tells one visitor from another.

`format` and `version` say how to read it, as with the status. Within version 1, keys are only added, so a reader ignores the ones it does not know; a change that breaks readers is version 2.

The site status says where to look. With the plugin, `/api/health/status` has an `analytics` key:

```json
{ "enabled": true, "collecting": true, "since": "2026-09-14", "rollupsPath": "/api/content/_analytics/rollups" }
```

`enabled` is false when `NUXT_CMS_ANALYTICS_ENABLED=false` stops counting on the server. `collecting` is false then too, and when an administrator switched **Counting visits** off. A site without the plugin, or on an older tinyzoo, has no `analytics` key.
