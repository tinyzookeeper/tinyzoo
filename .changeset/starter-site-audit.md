---
'tinyzoo': minor
'@tinyzoo/client': minor
---

Starter site (what `tinyzoo init` creates), from the 0.2 audit:

- **Languages and search engines.** `useCmsSeo()` writes `<link rel="canonical">`, `hreflang` alternates (with `x-default`), `og:url` and `og:locale` from the item's `paths` (new options `defaultLocale`, `path`, `ogLocales`); addresses start with `cms.publicUrl`, in development with the address the site is opened at. The starter's header has a language switcher that goes to the same page in the other language, else that language's home.
- **Sitemap and robots.** The home page is `/` (and `/en`) in `/sitemap.xml`, not `/home`; the news list is in it (`cms.sitemap.paths`); `/robots.txt` keeps crawlers out of `/admin` and names the sitemap.
- **Draft preview of the home page.** `/home?preview` keeps `?preview` when it redirects to `/`.
- **Header and footer.** A menu with more than five links gets its own row instead of squeezing the header; nested footer links are a small column each. Menu links and buttons to the home page lead to `/`, not `/home`.
- **Pictures.** The hero, picture block, news list and news cover say how wide they show (`sizes`), so a phone no longer downloads a 1600 px copy for a 480 px slot.
- **Opening hours are per language.** The seeded list is `.localized()` (migration `0002_opening_hours_per_language`), with Czech and English texts; before, both languages were written into every row.
- **Block components are typed from the generated client** (`app/lib/cms-content.ts`, now shipped in the starter): rename or remove a block field in `cms.config.ts`, run `pnpm cms:client`, and the component that still uses the old name fails `pnpm typecheck` instead of silently showing nothing.
- The seed writes buttons to its own pages as references (they follow the page, and a second run no longer writes a typed address over a link `links:convert` converted).

`<CmsForm>` and website forms:

- A choice with a `default` starts on it (no empty option); a required choice has a required marker. The server words every refused field in the visitor's language (`_locale`, sent by `<CmsForm>`): "Vyberte jednu z možností." instead of "Zkontrolujte prosím tuto hodnotu.". A choice sent as `null` counts as not given: its default applies.
- A refused field gets its red border (the rule was out-ranked by the input's own); the defaults follow the text colour, so the form reads on a dark page too (the submit button was dark on dark).
- `f.boolean({ mustBeTrue: true })`: a consent that must be ticked. A form refuses it unticked with "Pro odeslání je potřeba toto políčko zaškrtnout." and marks it required.

Messages that cite the docs (`tinyzoo generate`, `status`, `upgrade`, `backup`, `restore`, the migration order error and two storage warnings) give the address on GitHub, since the npm package carries no docs; a guarded column type change links the `USING` cast recipe. `tinyzoo links:convert` says fixed pages (the home page, a list) are not entries and can stay as typed. `tinyzoo` and `@tinyzoo/client` now ship a README.

### Upgrade

Nothing is needed for an existing site. A site made from the starter can copy what it wants from the new starter; to type its block components from the client, import the block's type from `~/lib/cms-content` as the starter does.
