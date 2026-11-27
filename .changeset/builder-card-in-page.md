---
"tinyzoo": minor
---

A card bound to one of the site's own content types is designed and edited right in the preview. Experimental, behind `NUXT_CMS_BUILDER=on` and `NUXT_CMS_CUSTOM_TYPES=on`; without them nothing changes.

- **In the preview.** A click on a block of a card selects that block of the design: its outline is solid in the card that was clicked and dashed in every other card, and the panel's examples come from the clicked card's entry. The section's toolbar names the type and how often the card repeats; a block's toolbar and name say what it shows. While the section is selected, the card under the pointer names what each of its blocks shows. Adding, dragging, moving, duplicating and deleting act on the design, in the clicked card, and every card follows. A double click on a value changes that entry: a text is typed where it stands, a number, a date, a choice or a rich text opens its own control, and a picture opens the whole entry beside the page; one save stores the page and the entries. The block's toolbar opens the whole entry of its card.
- **In the panel.** Pointing at a field a block could show draws it in every card at once, without a change; choosing it brings the values in card by card.
- **For a developer.** `useCmsEditingTry()` gives the field the panel tries on a block of a card, for a site's own card to draw. `customTypeCard({ heading })` names the section's field that takes the type's name when a person adds the section from the type.
- **Fixed.** A section added from the page's "+" no longer opens its panel scrolled down.
- **New text** in English, Czech and German.
