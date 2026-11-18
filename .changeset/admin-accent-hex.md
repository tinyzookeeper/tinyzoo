---
'tinyzoo': minor
---

`cms.admin.accent` takes any hex. Set it to the client's brand colour (`accent: '#B4532A'`) and the admin uses it for main buttons, the current page in the menu, links and focus rings, in light and dark mode. tinyzoo derives the shades, a lighter version for dark mode and the text colour on buttons. A contrast guard keeps everything readable (4.5:1 for text, 3:1 for focus rings): a colour that falls short is moved to the nearest readable one, and development prints what changed and why. A light colour keeps its buttons (yellow buttons with ink text) while links use a darker shade. The five built-in accents look exactly as before. An accent tinyzoo cannot read falls back to `mono` with a warning in development.

The resolved theme (`CmsAccentScheme`, internal) gains `text`, the accent as links and other text; additive.

### Upgrade

Nothing to do. The new value is optional; `mono` stays the default.
