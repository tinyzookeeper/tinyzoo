---
'tinyzoo': minor
---

With a brand colour (`cms.admin.accent: '#B4532A'`) the whole admin follows it, not only the accent. The moments that are cream in tinyzoo's own look (the sign-in, setup, reset and invitation pages, the welcome card, the current page in the sidebar and in a form's section menu, the section tiles) become a faint tint of the brand in light mode and charcoal leaning toward it in dark mode, and every text on them stays readable at 4.5:1. tinyzoo's animals are drawn in one muted shade of the brand with a near-white face. A near-grey brand gives near-grey moments and animals. `mono` and the built-in colour accents keep cream and the colourful animals, exactly as before.

New option **`cms.admin.animals`** (default `true`): `animals: false` hides the animals everywhere, for any accent (sign-in, welcome, empty places, the review before publishing, the card after it, first-run setup), and each place closes up around them. With your logo, colour and `signature: false`, nothing of tinyzoo's own look is left.

### Upgrade

Nothing to do. Sites with a hex accent see brand-tinted moments and animals after the upgrade; sites on `mono` or a built-in colour accent see no change. `animals: false` is new and optional.
