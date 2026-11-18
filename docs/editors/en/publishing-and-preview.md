# Publishing, scheduling, preview

When your change appears on the website, how to schedule it for later, and how to look at it before it goes live.

## Draft and "On the website"

Most content (pages, news) has two states:

- **Draft**: only you and your colleagues in the admin can see it. Website visitors can't.
- **On the website**: everyone can see it.

Saving a draft **doesn't** turn it into a public page. Until you click **Publish…**, it stays a draft. So you can happily write over several sittings and save as you go, and nothing goes anywhere.

You can see the state at the top by the title and in the list. A published entry also shows **Live since …**. One that hasn't been published yet says **Not on the website yet**.

> **Watch out:** Some content goes on the website **as soon as you save it**, because it has no draft: **Site settings**, **Navigation** or **Redirects**, for example. For these you'll see the sentence **Changes show on the website as soon as you save.**, and after saving, **Saved — it’s on the website now**. Check them before you click **Save**.

## Publishing step by step

1. Finish writing and click **Save draft**.
2. Click **Publish…**. The **Almost there. Check it, then publish.** screen opens.
3. Look at the **Web address** the entry will get. The admin points out anything you've left empty (**… is empty**, **Translation missing: …**). These warnings don't stop you publishing; they're just a chance to think it over once more. If something is required, you'll see **Fill in the required fields first.**, and the field has a **Fix** or **Add** button.
4. Under **When should it go live?**, choose:
   - **Right now**: *Visitors see it within a minute.*
   - **Schedule**: *Pick a day and time.*
5. Click **Publish on the website** (or **Schedule**).

Once it's published, you'll see the confirmation **It’s on the website. Visitors can see it now.** with a **View on the website** button.

<!-- screenshot: the "Almost there" screen with the Right now / Schedule options and the list of checks -->

If you change your mind, click **Back to editing**.

## Scheduling for later

Choose **Schedule**, enter a day and time, and confirm. The entry gets the **Scheduled** state and shows **Goes live …**. It appears on the website by itself at the moment you chose. You don't need to click anything else. On **Home** it then shows under **Coming up** (**Goes live at …**).

You enter the time in the time zone the website is set to (for a Czech website, usually Prague time).

You can change the scheduled date: open the entry, change the **Publish date** and click **Save changes**. If you'd rather put it on the website straight away, open **Publish…** and choose **Right now**.

## Taking something off the website

When you want to remove something from the website for a while:

1. Open the entry and, in **More actions**, click **Unpublish**.
2. Confirm. The admin reminds you: **Visitors stop seeing it. It stays here as a draft, and you can publish it again any time.**

You bring it back with the **Publish…** button. Nothing is deleted.

When you edit an entry that's already published, click **Update**. The change is on the website straight away. There's no further step.

## Publishing a translation

On websites where each language is published on its own (the developer switches this on for particular kinds of content, posts for example), publishing a translation has its own check. Open the language, English for example, and click **Publish…**. The screen is called **Publish the English version**, and below the heading it says **The other languages stay as they are.** So you publish only English. Czech and the other languages don't change.

![The "Publish the English version" screen: at the top, the notice "Czech is still a draft – This version goes on the website together with Czech, as soon as Czech is published."; below it, a check of the Title, the notice "Text is empty" with a Translate button, and the Web address; at the bottom, the Right now and Schedule options and the Publish button.](../../screenshots/0.6/publish-review-translation.png)

What the check shows:

- **Untranslated fields.** For example **Text is empty**, and below it **Visitors see the Czech text here until you translate it.** The **Translate** button takes you back to the field. It doesn't stop you publishing: visitors just see the Czech text there.
- **The web address** in that language, for example `/en/blog/new-members`.
- **When Czech is still a draft**, the top says **Czech is still a draft** and **This version goes on the website together with Czech, as soon as Czech is published.** The **Right now** option then says **It goes on the website together with Czech.** That's because a translation never goes on the website without the Czech version.

Then choose **Right now** or **Schedule** and click **Publish**. If Czech is on the website, you'll get the confirmation **It’s on the website.** If it's waiting for Czech, you'll see **Ready to go.** and **It goes on the website together with Czech.** Then, as soon as you publish Czech, English goes on the website by itself.

You take a translation off the website the same way as a whole entry (**More actions → Unpublish**, with that language open). The admin asks **Take the English version off the website?** and points out that the other languages stay as they are. If you take Czech off the website, all the languages go with it. They come back once Czech is published again.

Someone who isn't allowed to publish (a **Translator**, for example) saves the translation with the **Save translation** button, and an editor publishes it. More about languages, their states and their marks in the list is in the [Translations](translations.md#each-language-on-its-own) chapter.

## Preview

The preview shows how the page will look to visitors, **before it's published**.

- For pages built from blocks, the preview is **beside the form**. It changes as you type. What you type doesn't go on the website; only you can see it, and it disappears when you close the editor.
- The **Desktop width** and **Phone width** buttons switch how wide a screen you're looking at. The phone view is good for checking that text doesn't break in odd places.
- **Reload preview** helps when it seems to be out of step.
- Other kinds of content have a **Preview** button at the top. It opens the draft on the website (the website usually marks it as a draft preview).
- Once the entry is on the website, you'll find a **View on the website** button in **More actions**. It opens the public page in a new tab.

The preview may show the message **The website has no page here yet**. It means your website doesn't have a page for this kind of content yet. Your content is saved either way; the developer adds the page to the website. And **The preview didn’t load** means the website isn't answering for a moment. Try again in a little while.

## Authors and publishing

Someone with the **Author** role (or another role that doesn't publish, such as **Translator**) writes drafts and can't publish them. Instead of **Publish…**, they see **An editor will publish it**. When the draft is ready, let an editor or an administrator know so they can publish it. What each role can do is in the [Roles and permissions](roles-and-permissions.md) chapter.

## Saving and unsaved changes

- **Save** (**Ctrl+S** or **⌘S**) saves your changes. You'll see **Saved**, and **All changes saved** at the top.
- Until you've saved, the top shows **Unsaved** or **Unsaved changes**.
- If you want to throw your changes away, use **More actions → Discard changes**. The saved version comes back.
- When you leave the editor, it asks **Leave without saving?** (**Your changes aren’t saved yet. If you leave now, they’re lost.**). Choose **Stay** or **Leave without saving**.

If your connection drops, you'll see: **You seem to be offline. Your changes are still here — try again when you’re connected.** The text you've written stays on the screen. Wait until you're back online and click **Save** again.

## When a colleague is editing too

The admin shows who else has the entry open: **Also here**, and next to the name **… is editing** or **… is viewing**. You can write in a text field together. With other fields, be careful:

- If your colleague has saved a newer version in the meantime, you'll see **… saved a newer version** with the text **Your unsaved changes are based on the older one.**
- If you save before loading their version, the admin asks you. You have two options: **Load newer version** (you throw away your unsaved changes) or **Save my changes on top** (only the fields you changed are saved).
- If your colleague has deleted the entry: **… deleted this**. You won't be able to save it any more, so copy anything you want to keep.

> **Tip:** Avoid making big changes to an entry someone else is editing. Talk to them first.

## How long before a change is on the website

Published text usually shows **straight away**. For a few minutes after publishing, someone might still see the older version, because the website (and possibly a service that delivers its pages around the world) remembers the latest version for a little while. Within **about 5 minutes**, though, everyone sees it. **Ctrl+F5** (**⌘⇧R** on a Mac), which reloads the page, also helps.

## See also

- [Pages and blocks](pages-and-blocks.md)
- [Translations](translations.md): publishing applies to all languages, or (when it's switched on) to each one separately
- [Roles and permissions](roles-and-permissions.md): who can publish
- [History and restore](history-and-restore.md)
- [Troubleshooting](troubleshooting.md): "I saved it, but it's not on the website"
