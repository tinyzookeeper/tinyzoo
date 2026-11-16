---
'tinyzoo': patch
---

Editor, history and search fixes:

- Pasting from Word: bullet and numbered paragraphs (`mso-list`) become real lists, with nested levels; a table becomes one readable line per row (cells apart, nothing run together); pictures with a `file://`, `data:` or missing source are dropped with a notice to use the media library, instead of empty image nodes.
- On a phone a draft with unsaved changes shows Save in the top bar (Publish moves into the menu then).
- History shows files and related entries by name (and a thumbnail), never by id; list items stay on their own lines in the text comparison, and a one-line legend explains the highlight and strike-through.
- Admin list search matches every word in any order, ignoring accents, and forgives a typo in longer words (trigram word similarity, as the admin search). Filters, sort and paging are unchanged.
- The link picker searches the titles and addresses of the language being edited (and still the default language's), and puts a title that is exactly what was typed first.
- "Take it off the website" in the editor and the page tree names how many pages under it go offline too.
