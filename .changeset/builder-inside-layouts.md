---
"tinyzoo": minor
---

The editor in the preview works inside a block's lists, `f.blocks()` takes a `max`, and `useCmsEditing()`.

- **For an owner (experimental, `NUXT_CMS_BUILDER=on`).** Inside a layout section, each click in the preview goes one level deeper: the first selects the section, the next a block in it, the next a block in a group. Escape goes back up a level, then lets go. A block inside a section has the same small toolbar, with arrows that point the way its list runs (left and right in a row). It can be dragged within its list, or into a group or another section that takes it; the line shows where it lands, in a row and in a grid too. A selected section or group has a "+" at each place of its list. An empty section or group says *Add a block*. The form opens the selected block's row at every level, and a row opened in the form is selected in the preview. Escape and Alt with an arrow work after a block was selected in the form too.
- **For a developer.** The `cms:builder:*` messages name a block inside another one by its `path` (the ids from the page's list down) and a place in its list with `in`, or `{ end: true, in }` for the end of a list; the messages without them read as before. The admin sends the page what each list takes (`lists`), and passes on Escape and Alt with an arrow (`cms:builder:key`). In the preview, `<CmsBlocks>` marks each root element of a block whose component has several, so such a block can be selected too.
- **`useCmsEditing()`**, new in the frontend kit: `true` while an editor works on the page in the preview with `NUXT_CMS_BUILDER=on`, `false` on the live site. A site uses it to draw an empty block as a quiet placeholder that only an editor sees. Experimental, like the switch.
- **`f.blocks(blocks, { max })`**: at most this many blocks in the list. The server refuses more, at any depth, and the admin offers no *Add block* or *Duplicate* once the list is full.
- **The admin's form.** Duplicating a block gives every block inside it a new id too. A row of a layout that holds only pictures is summed up by its blocks' names (*Picture · Picture*) instead of nothing.
- **New text:** *Move left*, *Move right*, in English, Czech and German.
