---
'tinyzoo': minor
---

Entities can publish each language on its own: add `perLocale: true` to an entity's `publish`. A translation then has a state and a schedule of its own (draft, published, scheduled), and the editor's Publish, Unpublish and Schedule act on the language being edited. The default language keeps its state on the entry, and a translation **follows it until someone publishes or unpublishes that language**, so turning the option on changes nothing on the website, for entries with a translation and for entries without one (served in other languages through the fallback) alike.

A language that is not published is not there: the item answers `404` with `?locale=` for it, and it is left out of that language's list, of the sitemap and its `hreflang` alternates, of the website search and of links (a link to it is `null` there, as for a draft). Inside a published translation, fields left empty still show the default language's text. An editor's `?preview` (or the content token) still sees the draft. A translation can be live while the default language is a draft: the languages are independent. Scheduled go-lives and unpublishing are announced per language: `entry.published` and `entry.unpublished` carry that language in `locale` and only its addresses in `paths` (the payload keeps its shape; fields are only added). The admin shows each language's state in the editor and, compactly, in the list; whoever may not publish cannot publish, unpublish or reschedule a language either. Export and import, seeds (`translations: { en: { status: 'draft' } }`), the history of a language and its restore carry the state. `definePages({ perLocale: true })` turns it on for pages (not yet for page trees: the config check says so). `PATCH /api/cms/<entity>/<id>?locale=en` takes the entry's own status and date keys for it (`{ "status": null }` follows the default language again).

**Nothing changes for an entity that does not set `perLocale`**, and the content API's shape and `@tinyzoo/client`'s types are the same (the contract snapshots did not change).

### Upgrade

1. Only if you want it: add `perLocale: true` to the `publish` of an entity that has `.localized()` fields, run `tinyzoo generate` and commit the migration (two nullable columns on its `<entity>_locales` table: `published` and `published_at`), then `tinyzoo up`. There is no data to move and no upgrade step: every language starts by following the default one, so every page, list, sitemap entry and `hreflang` alternate stays as it is.
2. Without it, nothing: no migration, no change.
