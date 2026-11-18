---
'tinyzoo': minor
---

`cms.admin.accent` takes any hex. Set it to the client's brand colour (`accent: '#B4532A'`) and the admin uses it for main buttons, the current page in the menu, links and focus rings, in light and dark mode. tinyzoo derives the shades, a lighter version for dark mode, a button's colour under the pointer and the text colour on buttons: white or ink, whichever reads better, so mid tones such as `#3B82F6` get ink text (5.0:1 against 3.7:1 for white). A contrast guard keeps everything readable (4.5:1 for text, at rest and under the pointer; 3:1 for focus rings): a colour that falls short is moved to the nearest readable one, and development prints what changed and why, in the server log at start and once per browser session in the console. A light colour keeps its buttons (yellow buttons with ink text) while links use a darker shade. An accent tinyzoo cannot read falls back to `mono` with a warning in development.

Accessibility fixes for every accent, built-in ones included:

- **Focus rings** are a solid 2 px ring in the accent's link colour, 3:1 or more on every surface. They were the accent at 25 % (1.1–1.6:1 on white), and a yellow brand's ring was a pale yellow.
- **Buttons under the pointer** take a shade of their own, one step away from their text, instead of the button colour at 75 %, which took white text down to 2.9:1.
- **In dark mode the colour presets' buttons** (`indigo`, `blue`, `violet`, `emerald`) now carry dark text, readable at 6:1 or more; white was 1.9–3.1:1. Light mode and `mono` look as before.

### Upgrade

Nothing to do. The hex is optional and `mono` stays the default. A site on `indigo`, `blue`, `violet` or `emerald` sees dark text on its main buttons in dark mode; a site that styled the admin's focus rings or button hover itself in its own CSS should check that its rules still apply.
