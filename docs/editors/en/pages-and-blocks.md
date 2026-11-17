# Pages and blocks

How to find content, edit a page or a news item, build a page from blocks, and move pages around.

> The parts of the website (**Pages**, **News** and so on) may have different names on your site. The steps are still the same.

## The home screen

After you sign in, you'll see **Home**. It's a starting point with a greeting and a few handy shortcuts:

- **Continue editing** and **Recently edited**: what you (or your colleagues) worked on most recently.
- **Waiting for you**: your unfinished drafts. Each one has a **Finish** button.
- **Coming up**: what's scheduled.
- **Create**: a quick button for a new entry.

The menu is on the left. Under **Content** you'll find all the kinds of content your website has, plus the **Media library**. Under **Settings** is everything that applies to the whole website. On a phone, you open the menu with the **Open menu** button.

## Finding things

**Search.** Click **Search** at the top of the menu, or press **Ctrl+K** (**⌘K** on a Mac). Type at least two letters. The admin finds entries by any word in them. Below them is a **Go to** list for jumping quickly to another part of the admin.

**Lists.** Each kind of content has a list. In it you can:

- search with the **Search…** field,
- sort by clicking a column heading (**Sort by**),
- use a **Filter** (for example, drafts only). You clear filters with the **Clear filters** button,
- tick several entries and publish, unpublish or delete them all at once,
- download the whole list as a spreadsheet with the **Export CSV** button (for Excel).

Drafts you haven't finished yet are usually at the top of the list, in the **In progress** group.

## Editing a page or a news item

1. Open the list (**Pages**, for example) and click the entry's title. To create a new one, use the **+** button at the top right, which shows the name of the kind of content (**News item**, for example).
2. Fill in the fields. Required ones are marked.
3. Click **Save**. For a draft it's **Save draft**, for an entry that's already on the website it's **Update**, and for a new entry without drafts it's **Create**. **Ctrl+S** (**⌘S** on a Mac) does the same.

Editing looks a little different depending on the kind of content:

- **Writing.** News and articles are written in a calm single column, as in Word.
- **Form.** Events or settings are a form with fields you fill in one after another.
- **Page with preview.** Pages built from blocks have a live preview next to the form. See [Publishing, scheduling, preview](publishing-and-preview.md).

At the top you can see whether everything is saved (**All changes saved**) or there are **Unsaved changes**. If you try to leave with unsaved changes, the admin asks: **Leave without saving?** Answer **Stay** if you're not sure.

<!-- screenshot: the page editor with the form on the left and the live preview on the right -->

### A page's title and address

Pages and news items have a **Title** and a **URL address**. The address is what appears in the browser after the website's name, for example `/about-us`. It fills itself in from the title until you change it. It can contain only lowercase letters without accents, numbers and dashes.

> **Watch out:** Change the address only when you really have to. Anyone who has the old address bookmarked won't find the page any more. For pages in the **Page tree** (see below), the admin takes care of the redirect itself. For other content, the developer does it, or you set it up yourself in the **Redirects** section. See [Menus and links](menus-and-links.md).

If the address already belongs to another page, you'll see **The address … already belongs to “…”. Change the URL address.**

## Blocks: building a page

A page is usually built from blocks: a heading with a picture, text, a call to action, a contact form. Each block has its own fields. You stack blocks on top of each other in whatever order you like.

- **Add a block.** Click **Add block**, or **Insert a block here** between two blocks. In the **Add a block** window, choose the kind of block. **Search blocks…** helps you find it. An empty page has an **Add the first block** button.
- **Move.** Drag the block by its handle (**Drag to move**), or use **Move up** and **Move down** in the **Block actions** menu.
- **Copy.** In the **Block actions** menu, choose **Duplicate**. The copy appears right below the original.
- **Remove.** In the **Block actions** menu, choose **Remove**. A message, **Removed: …**, appears with an **Undo** button. As long as you click it in time, the block comes back. Once you save the page, it's gone, and only the [history](history-and-restore.md) can bring it back.
- **Collapse and expand.** Fold long blocks away with **Collapse** and open them again with **Expand**.

A block with a mistake in its fields shows **Needs attention**. Expand it and fix the highlighted fields.

Some blocks contain lists (cards, opening hours, team members). A list has an **Add item** button, and you drag and remove items the same way as blocks.

### A block that no longer exists

A page might contain a block that the developer has removed from the website. You'll see **This block no longer exists (…)** and the text **Visitors no longer see it. It stays here until you remove it.** Nothing is wrong. Click **Remove block** and confirm, or just leave it.

Similarly, **This block could not be brought up to date (…)** means it was saved in an older form. Its content hasn't changed. Remove it, or write to your developer.

## Writing text

A formatted text field has a toolbar at the top:

| Button | What it's for |
|---|---|
| **Bold**, **Italic**, **Strikethrough** | making words stand out |
| **Heading**, **Subheading** | headings, so the text is easy to read and to search |
| **Bulleted list**, **Numbered list** | lists |
| **Quote** | a quoted paragraph |
| **Link** | a link to another page or website |
| **Insert image** | a picture right inside the text |
| **Undo**, **Redo** | undo or repeat your last step |

**Link.** Select the words, click **Link**, and in the **Search pages, or paste an address** field type the start of a page's title, or paste a full address (`https://…`). A link to a page on your website **follows the page if its address changes**, so it doesn't break. More in the [Menus and links](menus-and-links.md) chapter.

**Picture.** Click **Insert image**, choose a file from the library or upload a new one, and in the **Describe the picture** field write what it shows. How to write a description is in the [Images and files](images-and-files.md) chapter.

> **Tip:** You can paste text straight from Word or an email, but check that it didn't bring odd spacing or fonts along with it. Pasting it as plain text helps (**Ctrl+Shift+V**, **⌘⇧V** on a Mac).

## Pages under pages: the page tree

If your website has the page tree switched on, the list of pages looks like an indented tree. The **About us** page can have **Team** and **History** under it, and their addresses then look like `/about-us/team`.

- **Subpages**: show or hide them with the arrow next to a page. Under the title you can see the full address.
- **Add a subpage** is in the menu on the page's row.
- **Move…** in the same menu opens the **Move “…”** window. You choose which page it **Goes under**, and its **Place** among that page's subpages. You can also just drag it with the mouse: drop it in the middle of another page and it goes under that page; drop it on the top or bottom edge and it goes before or after it. There's no dragging on a phone, so use the menu. **Move up** and **Move down** also change the order in the menu.
- You'll see **Hidden** next to the title if a page above it isn't published.

> **Watch out:** When you move a page, **its address changes, and so do the addresses of all the pages under it.** If the website has redirects set up, the admin handles them itself and, after the move, says **Visitors to the old ones are sent to the new ones.** If not, you'll see **Links to the old ones need updating: this site has no redirects.** Tell your developer.

A page that has subpages can't be deleted: **This page has subpages. Move or delete … first, then delete this page.** And when you **Unpublish** a page, all the pages under it disappear from the website too, but they stay unchanged and come back as soon as you publish it again.

## Copying or deleting a whole entry

At the top of the editor is the **More actions** menu:

- **Duplicate** makes a copy (with **(copy)** added to the title). The admin tells you **Copy created. You’re editing the copy now.** Handy when you have a similar page or news item and don't want to write it all again. If you have unsaved changes, it asks whether to copy the saved version.
- **Delete…** asks **Delete “…”?** and, once you confirm, removes the entry from both the website and the admin. **This can’t be undone.**

> **Watch out:** Not even the history can bring back a deleted entry. If you're not sure, use **Unpublish** instead: the entry stays as a draft.

### “It’s still in use”

If you try to delete something that's used elsewhere (a page that a menu links to, a picture in a news item), the admin won't let you and says **It’s still in use**. You'll see **where**: **Used in …** or **Linked from …**. Change it in those places or remove the link first, then delete.

## See also

- [Translations](translations.md): how to add an English version
- [Publishing, scheduling, preview](publishing-and-preview.md)
- [Images and files](images-and-files.md)
- [Menus and links](menus-and-links.md)
- [History and restore](history-and-restore.md)
