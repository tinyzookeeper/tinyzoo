---
"tinyzoo": minor
---

The editor in the preview works on a phone-sized admin. Experimental, behind `NUXT_CMS_BUILDER=on`; without it nothing changes.

- **The sheet.** On a screen narrower than 1024 px the preview fills the screen, starts at a phone's width, and the selected block's panel is a sheet at the bottom of it, for every kind of block. Its handle names the block and says what it shows; a tap or a drag opens and closes it. With nothing selected it lists the page's sections. A block picked in the page opens it, and the page keeps the block and its tools above it. Typing a text in the page puts it aside for the keyboard. Escape goes up a level, then closes it.
- **Touch.** A tap selects, a second tap goes a level deeper, a double tap on a text types into it, and the toolbar's buttons are at least 40 px to the finger.
- **Fixed.** A block's toolbar no longer takes the second press of a double click meant for the text under it, and in a card it stands over the picture rather than over the card's rows. A section made for one of the site's own types is called by that type (*Courses*) in the panel and the list of sections. In a list drawn as rows, an entry without a picture keeps the picture's column empty, so the texts line up.
- **New text** in English, Czech and German.
