---
'tinyzoo': patch
---

Fixes in links that follow their target:

- A redirect whose target is a page no longer loops when that page takes over the redirect's own address (renaming a page to the address of a redirect that led to it answered `301` to itself, forever). Such a redirect is skipped, and a redirect that leaves from an address an entry goes live at is removed when the entry is saved (any collection with an address, a translation too, or when a scheduled entry goes live), as moving a page in a tree already did.
- A redirect whose target is a page now leads to the page in the language of the old address: `/en/old` goes to the English page, not the Czech one (by the site's `defineLocales` prefix rule; the default language otherwise). The loop check on saving a redirect uses the same rule.
- `tinyzoo links:convert` converts an address only when it is the address of one published entry in the language the link is served in (an entry's own row: the default language; a translation: its language). Another language's address and the address of an entry that is not published are left as typed and reported (`other-language`, `draft`), instead of changing which version a link points to or turning it into nothing.
- The publish webhook also names the pages and menus that link to the pages below a page that was moved, renamed or unpublished in a page tree (`paths`, `globals`), not only those that link to the page itself.
- A preview (`?preview`) of a signed-in person resolves a link to a draft only when that person may read the draft; a row-level `access.read` rule is respected.
- The link details the admin asks for no longer tell an entry that exists but may not be read from one that is gone (both are `missing`; the `restricted` state is removed), and refusing a delete because something still uses the entry names only the entries the person may read and counts the rest (`hidden` in the 409 answer).
