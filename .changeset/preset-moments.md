---
'tinyzoo': patch
---

**The four built-in colours tint the whole admin, as a brand colour does.** With `accent: 'indigo'`, `'blue'`, `'violet'` or `'emerald'`, the moments (the sign-in pages, the welcome card, the current page in the sidebar and in a form's section menu) are now a faint tint of that colour instead of tinyzoo's cream. In dark mode they are charcoal leaning toward it, and the animals take one muted shade of it. Before, a preset coloured only the buttons and links, and the pink animal on a cream card looked half-branded next to them. The page and cards stay white (dark in dark mode), and every text on the tinted moments still reads. `mono`, the default, keeps cream and the colourful animals.

### Upgrade

Nothing to do. `animals: false` still hides the animals for any accent.
