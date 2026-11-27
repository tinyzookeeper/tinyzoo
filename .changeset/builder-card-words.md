---
"tinyzoo": minor
---

A page can show the admin's words in the placeholders of a card that an owner designs. Experimental, behind `NUXT_CMS_BUILDER=on`; without it nothing changes.

- **For a developer.** `useCmsEditingWords()`, new in the frontend kit: `chooseField`, `emptyCard` and `sampleCard`, and the functions `fieldMissing(name)` and `fieldUnfit(name)`, in the admin's language while an editor works on the page in the preview; every word is `''` on the live site, on the server and in a preview without the switch. `cms:builder:on` carries five new optional `texts` for them (`chooseField`, `fieldMissing`, `fieldUnfit`, `emptyCard`, `sampleCard`); a message without them is still accepted.
- **New text:** *Choose a field*, *Field {name} is missing*, *Field {name} does not fit here*, *The card is empty. Add a field or a block to it.* and *Sample card: this type has no entries yet*, in English, Czech and German.
