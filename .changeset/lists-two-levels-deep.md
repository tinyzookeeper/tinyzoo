---
"tinyzoo": minor
---

Lists two levels deep inside a block, settings of a block, and a choice drawn as segments.

- **Lists two levels deep.** An item of a block's list (`f.list()` or `f.blocks()`) can now hold a list of its own: a layout section with small blocks and groups, each group with small blocks. A third level is refused when the config loads, with the path it found. Every part of tinyzoo that reads a block's lists works at that depth: the checks on write (an item of a type that is gone, or behind its `version`, is kept only when it is stored there already), upgrades and `tinyzoo content:migrate`, media in the content API and media cleanup, links that follow their page, search, seeding, export and import, the generated client types and OpenAPI (the inner list is an array of its own block types), and the admin's form. Stored pages need no migration.
- **`.setting()`** marks a field of a block or a list item as a setting, not content. The block's form in the admin shows its content first and its settings after it, under the heading *Layout*. A block with no settings has a form as before.
- **`f.select({ segments: true })`** draws two to four options as one row of segments, each with its label and its icon from `icons`. It wraps on a narrow screen and works with the arrow keys. With more options the choice is drawn as before. The stored value does not change.
- **The admin's form of a list inside a block.** A row that says nothing itself (a layout that only holds small blocks) is summed up by the texts of its items, and its settings are left out of that line. An empty list of blocks inside a block says *Nothing here yet* in one line, with *Add block* under it, instead of the large empty state of a page.
- **The live preview.** A small block not filled in yet, inside a block's list, is left out of the preview on its own; the block that holds it stays.
- **Fixed:** restoring an older version of an entry now finds the pictures inside the lists of its blocks, so a picture that was deleted since is emptied there too.
- **New text:** *Layout*, in English, Czech and German.
