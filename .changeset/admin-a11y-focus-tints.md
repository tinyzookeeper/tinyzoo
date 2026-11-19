---
'tinyzoo': patch
---

Accessibility fixes in the admin.

- **Readable tints.** With the built-in `blue`, `violet` or `emerald` accent (and `indigo` in dark mode), accent text on its own pale tint read 3.9–4.4:1: a soft button under the pointer, the search's matched letters, a hovered day in the calendar. Those tints are now drawn lighter, so the text reads at 4.5:1 or more. The accent colours and their text are unchanged. `mono` and a brand colour look as before.
- **Visible keyboard focus.** Items in dropdowns, selects, select menus and the search now show the admin's focus ring when the keyboard reaches them, not only a faint grey. The mouse sees them as before, also after Escape closed a menu. A rich-text field in the form now shows a ring when it has the cursor, like the other fields. In the Write layout, the big title, the summary under it and the text show a ring only when you reach them with the keyboard. A click into them stays quiet while you type.
- **The publish review on a phone.** When Tab went round from the last button to the first, the focused button could sit off screen. It now scrolls into view, with room for its focus ring at the edge of the screen. The "now or later" choice is one stop for Tab, and the arrow keys change it.

### Upgrade

Nothing to do. While someone uses the keyboard, the admin puts `data-cms-keys` on `<html>`, and `data-cms-key-focus` while the keyboard put the focus where it is. The new rules in the admin's stylesheet apply only inside the admin (`html[data-cms-admin]`). A site's own admin component that uses Nuxt UI's tint classes (`bg-primary/10` with `hover:bg-primary/15`, and the like) gets the lighter tints too.
