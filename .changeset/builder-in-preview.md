---
"tinyzoo": minor
---

Experimental: an editor in the preview (`NUXT_CMS_BUILDER=on`). It may change in a minor release.

- **For an owner.** On a page built from blocks, the preview beside the form now has tools of its own: select a block, move it, duplicate it, delete it, or add one between two others. The form follows, the block's row opens, and a moved or deleted block can be brought back with *Undo*.
- **For a developer.** `NUXT_CMS_BUILDER=on` in the server's environment switches it on; it is read at run time, not at build time. Without it nothing runs and the admin is as before. In the preview with it on, `<CmsBlocks>` marks each block's root element with `data-cms-block`, `data-cms-block-type` and `data-cms-block-list`; the live site never gets them. A page in the preview now says `cms:builder:ready` to the admin once it listens, with the setting or without it.
- **The live preview, for everyone.** In a list of blocks, a block that is not filled in yet (one just added) no longer sends the preview back to the saved list: the other blocks show as they are in the form, in their new order.
- **New text:** *Block moved*, in English, Czech and German.
