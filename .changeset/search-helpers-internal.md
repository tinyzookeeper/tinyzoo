---
'tinyzoo': major
---

`searchTerms`, `matchEntry`, `highlightRanges`, `SEARCH_MAX_QUERY` and `SearchMatch` are `@internal` again. 0.6 made them public. They are no longer part of the frozen API, because the search may change how it matches (Postgres `pg_trgm`). They are still exported, and can change in any release.

`useCmsSearch()`, `<CmsHighlight>` and the `GET /api/content/_search` route stay public and work as before.

### Upgrade

Nothing to do for most sites. If your own code imports one of these five names from `tinyzoo`, it still works for now. Move to `useCmsSearch()` and `<CmsHighlight>`, or copy the few lines you need into your site.
