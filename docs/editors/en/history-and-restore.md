# History and restore

How to see what has changed in an entry, and how to go back to an earlier version.

The admin remembers **every save** of a page, a news item and other entries. When something goes wrong (a paragraph deleted by mistake, text written over), you can go back to how it was before.

## Opening the history

1. Open the entry.
2. At the top, click **History**. On a phone, it's in the **More actions** menu.
3. A panel opens with a list of **Versions**: every save, with the date, the time and the name of the person who made it (if that can't be known, you'll see **Someone**). Each one says what happened: **Created**, **Published**, **Taken off the website**, or **Edited** followed by the fields that changed.

<!-- screenshot: the History panel with the list of versions and the differences from the current version -->

If there's nothing here yet, it says **No saved versions yet.**

## Comparing

Click a version in the list. The admin shows the **Differences from the current version**: for every field that's different, you see **This version** (the old one) and **Now** (what's in the form) side by side. If nothing is different, it says **This version is the same as what is in the form now.**

## Restoring an earlier version

1. In the list, choose the version you want to go back to.
2. Click **Restore this version**.
3. The admin puts its content into the form and says **Version loaded into the form. Review it and save.**
4. Check that it's the right one, and click **Save**.

Until you save, nothing has changed. If you change your mind, use **More actions → Discard changes**.

> **Watch out:** Restoring **doesn't overwrite** the history. It adds another version, as a new save. So you can even go back to the version you've just replaced.

What gets restored are the **values of the fields**. Each language version has its own history. If you want to bring back an English translation, open the English version (see [Translations](translations.md)) and open its history.

> **Watch out:** For an entry that's **On the website**, the restored text appears on the website as soon as you save.

If the older version had a picture that you've since deleted from the library, the admin tells you how many **files from that version were deleted since and are left out**. Everything else is restored; just choose the picture again afterwards.

## What the history can't do

- **It can't bring back a deleted entry.** When an entry is deleted, its history is deleted with it. So before you delete something, think carefully about whether you'd rather **Unpublish** it. Only the developer can bring back a deleted entry, from a backup of the whole website, and only as the website was at the time of that backup. If you've deleted something important, say so as soon as possible, and say exactly when.
- **It doesn't remember everything for ever.** It keeps roughly the **last 50 saves** of each entry (separately for each language). Older ones are deleted.
- **It doesn't bring back files from the media library.** A deleted file won't come back this way.
- **It isn't a backup of the website.** It's there to fix your own edits. For bigger disasters, your developer has their own backups.

## See also

- [Pages and blocks](pages-and-blocks.md): bringing back a removed block with the **Undo** button
- [Publishing, scheduling, preview](publishing-and-preview.md)
- [Troubleshooting](troubleshooting.md): "I deleted something by mistake"
