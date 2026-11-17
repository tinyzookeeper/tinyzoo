---
'tinyzoo': minor
---

`searchTerms`, `matchEntry`, `highlightRanges` and `SEARCH_MAX_QUERY` (and the `SearchMatch` type) are public: a site can search its own content outside the CMS, such as static pages or documentation, with the same matching as the website search (words in any order, accents and small typos forgiven). They were exported before, marked internal.

### Upgrade

Nothing to do.
