---
'tinyzoo': patch
---

Accessibility fixes in the admin.

- **Readable tints.** With the built-in `blue`, `violet` or `emerald` accent (and `indigo` in dark mode), accent text on its own pale tint read 3.9–4.4:1: a soft button under the pointer, the search's matched letters, a hovered day in the calendar. Those tints are now drawn lighter, so the text reads at 4.5:1 or more. The accent colours and their text are unchanged. `mono` and a brand colour look as before.
- **Visible keyboard focus.** Items in dropdowns, selects, select menus and the search now show the admin's focus ring when the keyboard reaches them, not only a faint grey. The mouse sees them as before. The big title, the summary under it and the text of a rich-text field now show a ring when they have the cursor, like the other fields.
- **The publish review on a phone.** When Tab went round from the last button to the first, the focused button could sit off screen. It now scrolls into view. The "now or later" choice is one stop for Tab, and the arrow keys change it.

### Upgrade

Nothing to do. While someone uses the keyboard, the admin puts `data-cms-keys` on `<html>`. The new rules in the admin's stylesheet apply only inside the admin (`html[data-cms-admin]`). A site's own admin component that uses Nuxt UI's tint classes (`bg-primary/10` with `hover:bg-primary/15`, and the like) gets the lighter tints too.
