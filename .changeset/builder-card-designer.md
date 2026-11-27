---
"tinyzoo": minor
---

A card bound to one of the site's own content types is designed in the admin, starting from the type's fields. Experimental, behind `NUXT_CMS_BUILDER=on` and `NUXT_CMS_CUSTOM_TYPES=on`; without them nothing changes.

- **For a developer.** `customTypeCard({ starter, groups })` (`CustomCardOptions`, `CustomCardStep`, `CustomCardGroup`, `CustomCardValue`) says, in the design's own block names, which card the admin designs from a type's fields when a person adds the section, and which groups it offers inside the card. `customTypeFieldRef({ takes, own, only })` (`CustomFieldRefOptions`) names the block's own text and the fields that matter only for one kind of field. Both are optional; a step, a group or a name that the card's blocks do not have stops the config from loading, with the path.
- **In the admin.** Adding a section offers the site's own types first (*Your content*, with how many entries each has); choosing one adds the section with a card designed from the type's fields, which can be undone. The section's panel shows what it shows as one row with *Change*, the card's blocks with the field each one shows, how many blocks show nothing (*Remove unbound*, *Design the card again*) and, for a type with no entries, *Add the first entry*. A block of the card chooses its field from rows with an example from an entry; *Add to the card* starts from the type's fields. Changing the type keeps what still fits, in one step that can be undone.
- **New text** in English, Czech and German.
