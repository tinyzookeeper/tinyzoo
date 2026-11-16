---
'tinyzoo': patch
---

Text typed in a tab that closed or crashed without saving no longer turns up in the next editor's form as "Unsaved changes". When someone opens an entry and nobody else is in it, the shared document starts from the saved entry, and the left-over text waits aside with who typed it and when: a notice offers Keep (into the form as their own unsaved change) or Discard. The publish review lists unsaved shared text it would publish, and says when left-over text is still waiting for a decision. A published entry no longer opens as "unsaved" because the editor added an empty paragraph after a last heading or list, or filled in attribute defaults. Uses two side rows in `cms_collab` (names ending `~by` and `~unsaved`); no migration needed.
