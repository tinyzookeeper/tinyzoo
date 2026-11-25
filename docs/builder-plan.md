# Sections and layout as data, the builder: a first design of step 5

**Status (2026-11-25):** a first design, not a detailed one. What is counted here was counted on the branch `feat/builder` (cut from `feat/look-as-data`, step 4). One experiment was run and is on the branch as an unchecked commit (section 4). Nothing else is built. The owner made the four decisions of section 6 on 2026-11-25, each as picked there, and added one rule: the limits are there so that every site stays responsive (3.4). It is step 5 of `docs/one-app-plan.md` (2.11, levels 3 and 4).

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

**3.1 The frame.** Each look's `Text.vue` gets `<slot />` as the last child of the element that carries its container (50 times the section itself, twice a `div` inside it). A section of the kit is then drawn as the look's Text part with the section's heading and its own content in the slot. A look that wants a section drawn its own way can still bring a part of its own for it, as it does for its blocks. Pages without a kit section must stay as they are, to the pixel: the pictures of step 1 prove or disprove it.

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

On the branch, as one commit marked as an experiment: the slot in all 52 Text parts, slots passed on by `LookPart`, and `KitEntries` drawn inside the frame. Pictures of the two blocks of own types in 21 looks of 8 templates, before and after (`custom-shots.mjs`, 168 pictures each, no failures): the blocks take each look's container, spacing and heading size. Not done: the comparison of all 376 pictures against `main`, the unit specs, a real look at phones. The commit is there to be judged, and to be thrown away if the direction is not wanted.

## 5. The order of work

1. **The frame,** with the proof that pages without a section are unchanged.
2. **A site's own types in the frame, with choices.** The engine carries defaults. *Useful alone: an owner says how their courses are shown.*
3. **The first three sections** (Text and picture, Cards, Questions) and the settings every section has. The picker's groups.
4. **The other sections.** The click in the preview.
5. **The page of an entry.** 6. **Header and footer.** 7. **A website without a template.**

## 6. Decisions

All four were made by the owner on 2026-11-25, as picked.

1. **Sections with choices, not a free layout tree.** Example: an owner adds "Cards", picks three columns and a tinted background; they cannot move a card 20 pixels to the left. The owner's reason: the sites must be responsive, and limits are how that is reached (3.4).
2. **The prefix of the kit's sections is `section_`.**
3. **A website without a template comes after the sections,** as the last part; it is the largest, and the only part that needs new looks.
4. **Step 4 is merged as built** (one own colour). Typefaces, corners and spacing wait for part 7 here.

## 7. Not explored

- How many sections one page takes before the editor is slow or the page heavy.
- Copying a section to another page, and saved sections.
- What the sections cost in the main stylesheet.
- Translations of a section's texts on sites with more languages.
