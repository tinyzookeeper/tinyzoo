---
'tinyzoo': patch
---

Page tree fixes from review:

- Moving a page no longer rewrites other people's pages. Positions are now spaced 1024 apart, so a move writes the moved page only; when two neighbours have no number between them the siblings are renumbered, and only their order changes (their version, author and saved versions stay as they were, so an open editor gets no conflict). An author can move their own draft among live pages.
- `tinyzoo import` checks every page tree it wrote (no loops, not deeper than allowed, one page per address in each language) in the same transaction and refuses a broken tree with the pages named; with `--merge` only problems that involve imported pages count.
- A rename or move that lands between a request reading a page and taking the tree lock can no longer slip a duplicate address through: what the request does not set is read under the lock (move, edit and translation writes).
- A page below a draft is no longer served, listed or put in the sitemap and search when it sits deeper than `maxDepth` allows today (the limit was lowered after it was made): the whole chain of ancestors is checked, and a visitor's breadcrumbs only name live pages.
- Titles of pages a person may not read (row-level `access.read`) are left out of parent-picker labels and of the loop and "address taken" refusals; addresses of such pages are left out of the admin tree. A page cannot be put under a parent the person may not read.
- A visitor asking for a page by address in a language is no longer answered 404 because a draft has that address as its translation: only live pages are matched.
- `definePages({ access })` passes row-level rules to the pages entity.
