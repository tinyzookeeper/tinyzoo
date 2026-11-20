# Troubleshooting

The most common problems and how to solve them. Look for the heading that sounds most like what you're seeing.

## I can't sign in

- **Wrong email or password.** Check that Caps Lock isn't on, and use the **Show password** button to see what you typed. Can't remember your password? Click **Forgot password?** (see [Signing in and your account](signing-in-and-your-account.md)).
- **Too many attempts. Wait a few minutes and try again.** Wait about a quarter of an hour and try again. It's a protection. You haven't broken anything.
- **The email with the link didn't arrive.** Check your spam folder, and check that you typed the same address your colleagues invited.
- **Is your access disabled** (**Disabled**)? Ask your administrator to restore it.

## A link from an email doesn't work

You see **This link no longer works** or **This invitation no longer works**. The link has expired (an invitation after 7 days, a new-password link after an hour, a link confirming a new email after 24 hours) or it was already used. For a new password, click **Send a new link**. For an invitation, ask the person who invited you for a new one (in the **Team** section there's **Send a new invitation**). For a new email, ask for the change again on the **Your account** page (see [Changing your email](signing-in-and-your-account.md#changing-your-email)).

## I lost the text I wrote

- If you haven't saved yet, **Unsaved changes** should show at the top. If you close the tab without saving, the text is gone. The admin warns you before you leave (**Leave without saving?**), so when you see that warning, choose **Stay**.
- Nothing shows that it was **saved**? Then it probably wasn't. Look for the red message **Could not save**, or for highlighted fields (**Please check the highlighted fields**) where something required is missing.
- If you saved and then wrote over the text, use the [history](history-and-restore.md) to restore an earlier version.
- If your connection dropped, it says **You seem to be offline. Your changes are still here — try again when you’re connected.** The text is still on the screen: don't close the tab, and wait until you're back online.
- If someone else was saving at the same time, the admin offers **Load newer version** or **Save my changes on top**. See [Publishing, scheduling, preview](publishing-and-preview.md).

## I saved it, but it's not on the website

1. **Is the entry published?** Saving a draft doesn't put the page on the website. The top must say **On the website**, not **Draft**. If it's a draft, click **Publish…**.
2. **Is it scheduled?** If the entry says **Scheduled** and **Goes live …**, it appears on the website only at that time.
3. **Is the page above it published too?** In the page tree, everything under a page that's a draft disappears from the website too (**Hidden**).
4. **Is the translation published?** Check that the right language is filled in (see [Translations](translations.md)).
5. **Wait a few minutes.** The website remembers the old version and updates within about 5 minutes at most. **Ctrl+F5** (**⌘⇧R** on a Mac) helps. Also try the website in a second browser or in a private window.
6. Is it **Site settings**, **Navigation** or something else that should go on the website as soon as it's saved, and still nothing? Write to your developer. Maybe the website doesn't use that piece of information.
7. Do you see **The website has no page here yet**? Your entry is saved correctly, but your website doesn't have a page for it yet. Your developer has to add one.

## A picture won't upload

- **The file is too large (at most … MB).** Make it smaller. Photos from a phone are often huge. A width of about 2000 pixels is plenty.
- **This kind of file can’t be uploaded.** You can only upload JPG, PNG, WebP, GIF, AVIF, PDF, MP4/WebM and MP3. Convert Word documents to PDF.
- **The file is empty.** Try choosing it again, or try another one.
- **That was a lot at once.** Wait a minute and upload in smaller batches.
- **Upload failed.** Check your connection and try again. If that doesn't help, write to your developer and tell them which file it was (its name, type and size).

See [Images and files](images-and-files.md).

## I can't publish

You see **An editor will publish it**, or there's no **Publish…** button. You have a role that only writes drafts (such as **Author** or **Translator**). Ask an editor or an administrator to publish the entry, or to change your role (**Team → Change role**).

## A button or menu item is missing

Most often, your role is the reason:

| What you don't see | Why |
|---|---|
| **Publish…**, **Unpublish** | You're an **Author**. |
| **Site settings**, **Redirects**, other settings | Authors can't change them. |
| Editing someone else's entry | An author changes only what they created themselves. |
| **Team**, **Privacy** | Only an **Administrator** sees them. |
| A field with a grey background and a padlock, or a field that's missing | Your role can only read it, or not even that (the website's developer sets this up). Below a locked field it says who can change it. See [Roles and permissions](roles-and-permissions.md#a-field-you-cant-change). |
| A whole entry that's **Read only** | Your role can't change it. The box above the form says why. |
| **Your role no longer exists** | The website no longer has the role you had. Ask your administrator for another one. |
| **The media library is not open to your role** | Your role isn't allowed to work with files. Pictures already on entries stay. |
| The **+** button for form messages | Messages only arrive from the website. You can't create them by hand. |

If you're missing access you asked for, write to your administrator. On their **Team** page, changing a role takes one click. The admin will also say **You don’t have permission for this. Ask an administrator.**

## Someone else is editing right now

At the top you'll see **… is editing** or **Also here**. You can both write, but agree between you so you don't overwrite each other's work. If your colleague saves before you, you'll see **… saved this while you were editing**, and the admin offers you what to do next (**Load newer version** or **Save my changes on top**).

## I deleted something by mistake

- **A removed block** on a page: if you haven't saved yet, click **Undo** in the **Removed: …** message, or use **More actions → Discard changes**.
- **Text written over** in a saved entry: open **History** and use **Restore this version** (see [History and restore](history-and-restore.md)).
- **A whole deleted entry** can't be brought back by the admin. Write to your developer **straight away** and tell them what it was and roughly when. They may be able to bring it back from a backup of the website, but the sooner, the better.
- **A deleted picture:** upload it again.

## "This entry doesn't exist any more"

**This entry doesn’t exist any more — it may have been deleted. Go back to the list.** The entry has disappeared in the meantime, or you clicked an old link or bookmark. Go back to the list and find it there. If it's not there, one of your colleagues deleted it.

Similarly, **There’s nothing here** means there's a typo in the address. Choose an entry from the menu on the left.

## The address already belongs to another page

**The address … already belongs to “…”. Change the URL address.** Every page must have its own address. Change the address in the **URL address** field (add a number or an extra word, for example), or move the page under another one in the page tree. For a translation, the same applies to the address in that language.

Another message you might see for addresses: **Lowercase letters, numbers and dashes only**. Type the address without accents or spaces, and replace spaces with dashes (`about-us`).

## "It's still in use"

You want to delete something (a page, a picture, a file), but the admin refuses: **It’s still in use**, and says where. It says, for example, **Used in …** or **Linked from …**. Go to those places and remove or replace the picture or link there. Then delete the entry. For a page, you may see **This page has subpages**: move or delete the subpages first.

## The English version is missing

Czech text showing in English (or another language)? Nobody has written the translation yet, or it isn't saved. Use the language button in the top bar to switch to the language, fill in the fields and click **Save translation**. The steps are in the [Translations](translations.md) chapter. In the list, you can spot missing translations by **EN missing** (or by the paler language code in the **Languages** column).

The English page is missing from the website altogether (visitors get "page not found")? If each language is published separately on your website, English is probably a **Draft**, or **Waiting for Czech**. A translation goes on the website only together with the Czech version. See [Each language on its own](translations.md#each-language-on-its-own).

## A link in the menu doesn't show

1. Is the page the link points to **published**? If not, the link says **Not published yet**. The link shows on the website once you publish the page.
2. Does the page still exist? If not, it says **This page no longer exists**. Choose another page.
3. Is the link in the **right menu** and the **right language**? The main menu and the footer menu are two separate things, and each language has its own.
4. Is the link marked **Under the link above**? Then it's in the dropdown of the link above it, not in the main bar.
5. Did you save the menu with the **Save** button? And did you wait a few minutes?

More in the [Menus and links](menus-and-links.md) chapter.

## When you're stuck: who to write to

Write to the person who built or looks after your website (your developer). It helps them a lot if you tell them **in your very first message**:

1. **What you wanted to do** (for example, "publish a news item about the summer holidays").
2. **What you clicked** and which part of the admin you were in (**News → News item → Publish…**).
3. **Exactly what the admin said.** Ideally copy the text of the message, or send a screenshot.
4. **When it happened** (roughly: "today around ten"), and whether it keeps happening or happened once.
5. **Which browser** you use (Chrome, Safari, Firefox…) and whether it's a computer or a phone.
6. **Who you're signed in as** (your email), and what role you have.
7. **Which version your admin runs:** in **Settings → About**, click **Copy details** and paste them into your message.

> **Tip:** Never send your password to anyone, not even your developer. Nobody will ever need it from you.

## See also

- [Signing in and your account](signing-in-and-your-account.md)
- [Pages and blocks](pages-and-blocks.md)
- [Publishing, scheduling, preview](publishing-and-preview.md)
- [Images and files](images-and-files.md)
- [Menus and links](menus-and-links.md)
