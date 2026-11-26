# Sections and layout as data, the builder: a first design of step 5

**Status (2026-11-26):** a first design, not a detailed one. On 2026-11-26 the owner turned the page editor into a builder with a limited layout tree (section 8); part 1 of it, editing a page's blocks in the preview, is built behind an experimental switch. Part 1 of section 5, the frame, is built and checked (section 4). What is counted here was counted on the branch `feat/builder` (cut from `feat/look-as-data`, step 4). Nothing else of section 5 is built. The owner made the four decisions of section 6 on 2026-11-25, each as picked there, and added one rule: the limits are there so that every site stays responsive (3.4). It is step 5 of `docs/one-app-plan.md` (2.11, levels 3 and 4).

**Words.** A *block* is one part of a page, as today. A *section* is a block that belongs to no template: the kit draws it once for every look. A look's *frame* is what its own Text part gives every section: the container, the space above and below, the heading.

---

## 1. The short read

1. **Build a library of sections with choices, not a free canvas.** An owner adds "Cards", "Text and picture", "Questions" to any page of any template and chooses from a few layouts. They do not drag boxes into a tree. A free tree is where a site gets ugly, and no look can keep its character in it (decision 1, made).
2. **Every look already has the frame a section needs.** All 52 looks have a Text part with the same four things: a container, vertical space, a heading size, text styles. With one line added to each (a slot), the kit can draw any section inside the look's own frame. The experiment shows it.
3. **Start with what hurts today: a site's own types.** The two blocks of step 2 are drawn in one generic layout, and the owner cannot say how. Put them into the look's frame and give them choices (columns, picture shape, rows, a table). That is the first part, useful alone.
4. **The engine needs four small additions,** all for the admin: a block's default values, groups and pictures in the block picker, settings shown apart from content, and a click in the preview that opens the section in the form.
5. **The header, the footer, the page of an entry and a website without a template come after,** each as a part of its own. The last one is where typefaces, corners and spacing become data without rewriting 52 looks: new sections are written with tokens from their first line.

## 2. What was counted

- **Blocks today.** The 20 templates list 216 block types on their pages under 114 names, 9 to 14 per template. `text` is in all 20, `opening` in 12, then `contact` 7, `gallery` 6, `prices`, `enquiry`, `about`, `steps`, `team`, `services` 5 each, `reviews`, `news`, `hero`, `testimonials`, `questions` 4 each. 82 names are in one template only. So most of a template is its own, and a short list of kinds comes back everywhere: text, pictures, a list of things with a picture, prices, people, questions, quotes, steps.
- **What the looks share.** Still no variable (step 4). But classes: `.prose-look` is in all 52 stylesheets, `.wrap` (the container) in 51, `.btn` in 50, `.field` in 45 to 48; all 52 style `body` and `h1` to `h3`. The container is 72 to 90 rem wide (20 different values).
- **The Text part.** All 52 looks have one, 10 to 15 lines each, in 14 shapes that differ only in a wrapper or a helper: a section with the container, a heading (`h1` on the first block, else `h2`) with the look's heading size, and the text in `.prose-look`. The looks' components set vertical space 647 times with 60 different classes; the Text part carries the look's own answer.
- **The engine** (`packages/cms/src/blocks.ts`, `CmsFieldBlocks.vue`, `CmsPreviewPanel.vue`). A page is a flat list of blocks in one column, at most 500. A block may hold one level of list (`f.list`) and no deeper. A block type has a label, a description, an icon and fields: no variants, no settings apart from content, no groups or pictures in the picker, and the admin does not carry a field's default (a new block's "layout" starts empty). The preview goes one way: the form sends its values, the page redraws. Nothing goes from the page to the form. There is no copy of a block to another page.
- **A site's own types today** (`KitEntries.vue`, `KitCustomEntry.vue`). Cards or rows, in the kit's own container of 80 rem with the kit's own spacing and a text-sized heading. The page of an entry has one fixed layout.

## 3. The design

**3.1 The frame.** Each look's `Text.vue` gets `<slot />` as the last child of the element that carries its container (50 times the section itself, twice a `div` inside it). A section of the kit is then drawn as the look's Text part with the section's heading and its own content in the slot. A look that wants a section drawn its own way can still bring a part of its own for it, as it does for its blocks. Pages without a kit section must stay as they are, to the pixel: the pictures of step 1 prove or disprove it. Seven looks centre a narrow column for the heading of a text; as a frame, with something in the slot, they put the heading at the left of the container, in line with what follows (the eighth, Wedding's announcement, centres its headings and stays so).

**3.2 The sections.** Defined once in the kit (`kitSections()`, added to each template's page blocks as `customTypeBlocks()` is; blocks are one column, so no migration). The first list, from what comes back in the templates:

| Section | Holds | Choices |
|---|---|---|
| Entries (exists) | the entries of one of the site's own types | cards in 2, 3 or 4 columns, rows, a table; picture shape; which fields |
| Text and picture | a text, one picture, a button | picture left or right, picture size |
| Cards | a list of things: picture, title, text, link | 2, 3 or 4 columns; with or without pictures |
| Questions | questions and answers | open or folded |
| Quotes | what people said, with a name | one large, or several |
| Prices | a list with prices | one column or two |
| Steps | numbered steps | in a row or one under another |
| Gallery | pictures | grid or one row |

Names get the prefix `section_` (`section_cards`), so they never meet a design's own block names (decision 2, made).

**3.3 Every section has the same few settings.** Background: the page's own, or tinted (the look's surface that is "like the page", which step 4 already finds for every look and keeps readable). Width: the look's, or narrow. Close to the section above: no space on top. Not in the first version: a band in the main colour (the looks' buttons and headings are not made for it in most looks) and free spacing values.

**3.4 What an owner cannot break.** A section has no free positions and no free sizes. Its colours are the look's. A choice is one of a short list, checked by the server like every choice field. A section bound to a type keeps the guard of step 2.

**Every choice is responsive.** This is the owner's rule, and the reason for the limits. A choice says what a section is at most, and the section narrows by itself: "three columns" is three on a wide screen, two on a tablet, one on a phone; a picture beside a text goes above it on a phone; a table becomes rows. No choice exists that works on a wide screen only, and the owner sets nothing per screen size. Each section is drawn for 390 px first, and its pictures are taken at 390 and 1440 px in every look before it ships.

**3.5 The admin.** The page editor stays the base. Additions to the engine, each small and additive: (a) the admin carries a block field's default; (b) a block names its group and a small picture, and the picker shows groups ("This look's blocks", "Sections", "Your content types"); (c) a block's settings are shown apart from its content, behind one row; (d) a click on a section in the preview opens it in the form, and the form marks the section it edits in the preview.

**3.6 Later parts.** The page of an entry of an own type: a choice of three layouts and which fields go where. The header and the footer: choices the look offers (the button, what stands in the footer), not a layout editor. A website without a template: one neutral design made only of sections, with its colours, typefaces, corners and spacing as data from the start. It is the last part (decision 3, made).

## 4. The experiment

On the branch: the slot in all 52 Text parts, slots passed on by `LookPart`, and `KitEntries` drawn inside the frame. Pictures of the two blocks of own types in 21 looks of 8 templates, before and after (`custom-shots.mjs`, 168 pictures each, no failures): the blocks take each look's container, spacing and heading size.

**Part 1 is checked (2026-11-25).** The 376 pictures of that build against the pictures of `main` (67e8fad8, kept from step 4): 364 identical, 12 with 1 to 13 differing pixels inside photographs, none failing. So the slot changes no page that has no kit section. A unit spec holds the frame in place (`test/unit/template-kit-custom.spec.ts`): one slot in each of the 52 Text parts, after the heading and the text. After the pictures, the framed section got its id and its accessible name back (no change to what is drawn). Not done yet: a real look at the two blocks on phones in all looks; that belongs to part 2, where their layout changes anyway.

## 5. The order of work

1. **The frame,** with the proof that pages without a section are unchanged.
2. **A site's own types in the frame, with choices.** *Useful alone: an owner says how their courses are shown.*
   - **Built (2026-11-25): two choices for cards,** "Cards side by side" (2, 3 or 4; 3 when empty) and "Picture shape" (landscape, square, portrait; landscape when empty). They are the kit's (`templates/kit/sections.ts`, `kitEntryBlocks()` in the page blocks of all 20 templates in place of `customTypeBlocks()`), so the package is unchanged. An empty choice is the default, so the admin does not have to carry one, and a block saved before is drawn as a new one. The number of columns is the most in a row: a card is never narrower than 13 to 18 rem, so a narrower screen shows fewer and a phone one, with no breakpoint of the kit's own. Pictured in all 52 looks at 1440 and 390 px (`custom-shots.mjs`, which now also makes a block of four columns with square pictures and one of two with upright pictures): 624 pictures, no failures. The 376 pictures of that build against `main` again: 365 identical, 11 within a few pixels inside photographs, none failing. Not checked: the two new fields in the admin form in a real browser.
   - **Built (2026-11-26): a table, and the page of an entry in the frame.** "Layout" has a third choice, "Table": one row per entry, the title first (a link to the entry's page when there is one), then the quiet line and each extra fact as a column of its own, headed with the field's name. A column no entry has a value for is left out; there is no picture and no long text. When the section is narrower than about 9.5 rem a column, each entry becomes a short block, the title and then "name: value" lines. This depends on the width of the section, not of the screen, and the table stays a table for screen readers. "Cards side by side" and "Picture shape" say in their help that they are for cards: the package cannot hide a field by another field's value. The page of an entry (`/kurzy/python`) is drawn in the look's own Text part, as the blocks are: the container, the space and the size of the title are the look's. Two looks with a wide typeface in capitals (Tabule, Talíř) set that title smaller, so a long word stays whole on a phone, and Výkres keeps 2 rem below the line under its headings. Pictured in all 52 looks at 1440 and 390 px (`custom-shots.mjs`, which now also makes a list as a table): 728 pictures, no failures. The 376 pictures of that build against `main`: 326 identical or within a few pixels, 50 failing, all in the five templates whose demo content is dated from the day it is seeded (car service, event, office, restaurant, sports club); the pictures of `main` were seeded a day earlier, so dates of matches, deadlines and free slots moved by a day. Checked in a real browser at 1440 and 390 px, light and dark: the admin form shows the three layouts and the card choices with their help, and a choice saved there changes the published page.
   - **Not checked:** the table with many facts (six columns or more) and with long words in a narrow look. In the admin, each choice also offers "None", and a block's summary names the number of columns for rows and tables too; both are the package's and stay as they are.
   - **Not built yet:** the layouts of the page of an entry. They need a field on the type, which is the package's; it waits for the owner's decision.
3. **The first three sections** (Text and picture, Cards, Questions) and the settings every section has. The picker's groups.
   - **Built (2026-11-26): the three sections, all in the kit.** `kitSections()` (`templates/kit/sections.ts`) is in the page blocks of all 20 templates beside `kitEntryBlocks()`: `section_text_picture`, `section_cards` and `section_questions`. Each is drawn in the look's own Text part (`KitSection.vue`; Cards through `KitEntries`), and the reading is in pure functions (`app/utils/sections.ts`): an empty or unknown choice is the default, and a section with nothing in it draws nothing. *Text and picture:* a rich text, a picture and a button; the picture right or left, a half or a third. The two stand side by side from 48 rem of the section's own width; narrower, the picture is above the text. The picture keeps its shape, cut to at most 4:5 upright and 2:1 wide. *Cards:* up to 12 cards (picture, title, text, link) with the choices of the entries (columns, picture shape); a card's text is not cut. *Questions:* up to 30, folded (`<details>`, a plus drawn in CSS, a ring for the keyboard) or open, at most 48 rem wide. Every section has two settings at its end: *width* (the look's, or narrow: at most 44 rem) and *close to the section above* (no space on top: one rule of the kit clears the padding, the margin and the line of the frame's root and its first child). The button is the look's own main button: a look names its classes (`button` in its definition, 19 looks; `btn` when left out); the two Blog looks without a button draw a plain link with an arrow. Four looks needed a line: the three Development looks keep their space above a section only, so they keep 2 rem above a close section (`--custom-close`); Oznámení centres its headings, so the narrow columns stand in the middle (`--custom-center`).
   - **Checked:** 291 unit tests (19 new, `test/unit/template-kit-sections.spec.ts`); the type check of Medical, Restaurant and Studio. Pictured in all 52 looks at 1440 and 390 px (`custom-shots.mjs --sections`: two of Text and picture, two of Cards, two of Questions, one narrow, one close, three empty ones that must draw nothing): 832 pictures, no failures, nothing wider than the screen. The 376 pictures of the pages against `main` and against the build before (see the report of the slice): no page without a section changed. In a real browser at 1440 and 390 px, light and dark: the form of Cards shows its fields and choices, a card can be added, a choice saved changes the preview and the published page.
   - **Seen, not changed:** a long word in a heading breaks inside the word in four looks with a large heading (Talíř, Tabule, Dres, Cedule) on a phone, Talíř and Tabule also on a wide screen; their own Text block does the same. Výkres draws its line under the heading also when a section has none.
   - **Waits:** the tinted background (it needs each look's surface colour and a band the full width of the page: a part of its own). The picker's groups and the settings shown apart from the content, which are the package's. In the admin, a list's button says "Add item" and not the item's name; that is the package's too.
4. **The other sections.** The click in the preview.
5. **The page of an entry.** 6. **Header and footer.** 7. **A website without a template.**

## 6. Decisions

All four were made by the owner on 2026-11-25, as picked.

1. **Sections with choices, not a free layout tree.** Example: an owner adds "Cards", picks three columns and a tinted background; they cannot move a card 20 pixels to the left. The owner's reason: the sites must be responsive, and limits are how that is reached (3.4). Replaced on 2026-11-26 by a limited layout tree (section 8).
2. **The prefix of the kit's sections is `section_`.**
3. **A website without a template comes after the sections,** as the last part; it is the largest, and the only part that needs new looks.
4. **Step 4 is merged as built** (one own colour). Typefaces, corners and spacing wait for part 7 here.

## 7. Not explored

- How many sections one page takes before the editor is slow or the page heavy.
- Copying a section to another page, and saved sections.
- What the sections cost in the main stylesheet.
- Translations of a section's texts on sites with more languages.

## 8. The editor in the preview, and a limited layout tree (decided 2026-11-26)

**The decision.** The owner turned the page editor into a builder. The owner of a site works in the page's preview: selects a block, drags it, adds one. Later small blocks go into layout containers, and later a container takes one of the site's own content types. This replaces decision 1 of section 6 ("sections with choices, not a free layout tree") by a limited layout tree. The limits stay what keeps a site responsive: no pixel positions, sizes and gaps from a scale, two or three levels at most.

**The three parts, in this order.**

1. **Editing in the preview** for the blocks a page has today.
2. **The layout container:** a row, a stack or a grid of small blocks, its sizes and gaps from a scale.
3. **A container bound to a content type:** it repeats for the type's entries, and its small blocks show the entry's fields.

**Rules taken from the prototype** (`templates/app/.data/builder-editor/editor-prototype.html`, approved by the owner).

- The tools float on a layer above the page. They never move the page's content.
- Hover shows a soft outline and a small name chip.
- A click selects: a clear outline and a small toolbar at the top edge, with a drag handle, the name, up, down, duplicate and delete.
- A "+" between blocks adds a block at that spot.
- Dragging lifts the block, the others make room, and a line shows where it lands.
- Motion takes 150 to 250 ms, eases out and respects `prefers-reduced-motion`.
- Nothing is set per screen size.

**Field kinds and small blocks** (part 3). A text block takes text, number and date fields. A picture block takes picture fields. A button takes link fields.

**Part 1. Built (2026-11-26).** Behind `NUXT_CMS_BUILDER=on`, read from the environment like `NUXT_CMS_CUSTOM_TYPES`. The cloud gives it to the one app's process with `CLOUD_BUILDER=on`. Off, nothing changes in the admin or on the page.

- **The messages.** One typed file for both sides, `packages/cms/shared/builder.ts`: `cms:builder:on` and `cms:builder:select` to the page; `ready`, `select`, `move`, `duplicate`, `remove` and `add` to the admin. A block is named by its id and a place by "before" or "after" a block, never by an index, because the page draws only the blocks it has a component for. Both sides check the origin and the window, as the preview did already. The page says `ready` once it listens, because the frame's load can come before its listener.
- **The page.** The admin learns of the switch from its menu (`GET /api/cms/_menu` says `builder: true`) and tells the page. Only then does `<CmsBlocks>` mark each block's root element (`data-cms-block`, `-type`, `-list`) and the page load the overlay (`packages/cms/app/builder/overlay.ts`): one layer in a shadow root, in the document's coordinates, so it scrolls with the page. Its colours are its own. A block whose component has no single root element is not marked and cannot be selected: on the Medical home page 3 of 19 blocks, all lists of a site's own entries with nothing to show. Links and buttons in the page do not act; a click selects. Escape lets go, Alt+↑ and Alt+↓ move the selected block.
- **The admin.** The form's own list of page blocks registers with a bridge (`useCmsBuilder`) and does every change with its own functions, so ids, checks and limits stay in one place. A block selected in the page opens its row and closes the others; a row opened in the form selects the block in the page and scrolls the page to it. A move from the page shows *Block moved* with *Undo*; a delete has the *Undo* it had. After a change from the page the panel sends the values at once.
- **The preview, for everyone.** In a list of blocks, a block not filled in yet no longer sends the whole list back to its saved state; the others show as they are. Without this, adding a block from the page undid the new order until the block was filled in.
- **Checked.** 15 unit tests of the protocol and the drag arithmetic (`test/unit/builder-protocol.spec.ts`), with 161 tests in 12 spec files around it; the type checks of the package, the playground and the cloud; the content API spec of the preview (19 tests; the new rule for a list of blocks has no test of its own). In a real browser on two seeded sites, Medical (Čekárna) and Photographer (Atelier), admin light and dark, the preview at 1440 and 390 px: hover, select from the page and from the form, the toolbar's four actions, drag on a page of 19 blocks with the page scrolling under the pointer, Escape during a drag, add at a spot, *Undo*, the keyboard, a direct load and a reload of the editor and arriving from the list, and that saving stores the new order. With the switch off: no marks, no layer, no `builder` in the menu. The 376 pictures of all 20 templates (switch off) against those of the commit before: 368 identical, 8 with 1 to 6 differing pixels, none failing.
- **Differs from the prototype.** The tools are drawn in the real page, so their name chip and toolbar sit above the block's top edge and may cover the site's header. A block is lifted with its own page background. There is no dashed slot where the dragged block came from: the others make room and a line shows the place. The "+" shows only near the edge between two blocks. A new block that is still empty is not in the preview until it is valid. *Undo* is the admin's toast, not a history.
- **Not done or not checked.** Touch was not tried on a real phone. A phone-sized admin has nothing new (as decided). Typing in the page is not part of it. A page with two lists of blocks was not tried. Keyboard focus moves to the page only once it was clicked.

