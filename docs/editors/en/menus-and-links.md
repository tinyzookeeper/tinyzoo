# Menus and links

How to edit the website's menus, make a dropdown, link in a way that doesn't break, and send visitors from an old address to a new one.

> The names may be different on your website. The starter website has a **Navigation** section and a **Redirects** section.

## The website's menus

The menus are in the **Navigation** section. There are usually two:

- **Main menu**: the bar at the top of the website,
- **Footer menu**: the links at the bottom.

Each menu is a list of links. There's nothing to publish separately: a menu goes on the website **as soon as you save it** (**Changes show on the website as soon as you save.**). So check the website after every change.

### Adding a link

1. Open **Navigation** and find the menu you want to change.
2. Click **Add item**.
3. Fill in:
   - **Label**: the words visitors will see ("Contact", for example).
   - **Address**: where the link goes (see below).
   - **Open in a new tab**: tick this for links to other websites, so visitors don't leave yours.
   - **Under the link above**: see dropdowns below.
4. Click **Save**.

If the website has several languages, each language has its own menu: switch language (see [Translations](translations.md)) and edit it separately. If a language has no menu, the default one is used.

You change the order by dragging a link. You remove a link you don't need with the **Remove** button. Nothing changes until you click **Save**.

<!-- screenshot: editing the main menu: a list of links with the Label and Address fields and the switches -->

### Dropdowns

Want **Team** and **History** to drop down when someone points at **About us**? In the list, put the link that should be in the dropdown **right below** the main link and tick **Under the link above** on it. The admin explains: *Shows in the dropdown of the link above it.* You can put several links like this under one link.

> **Tip:** To move a link back into the main bar, untick the box. Check that the order looks the way you expect. Links in a dropdown always sit under the link they belong to.

How the dropdown behaves and looks on the website is decided by the website's design. The admin only decides what goes where.

## Where a link goes

The **Address** field (and a link in text) can do two things. Try typing in the field:

- **A page's title**: start typing and the admin suggests pages on your website (**On this website**). Choose the right one.
- **A full address**: for example `https://www.example.com`, `mailto:info@example.com` for an email, or `tel:+44123456789` for a phone number. The admin offers it as **Link to …**.

If the field is left empty or you type something that isn't an address, you'll see **Enter /page, https://…, mailto: or tel:**.

> **Tip:** Link to pages on your own website by **choosing from the suggestions**, not by typing the address by hand. The next section explains why.

### Links that fix themselves

When you choose a page from the suggestions, the admin remembers **that page**, not its address. Under the link you'll see **Follows the page if its address changes**. Then, if you rename the page, move it under another page, or translate it, **the link keeps working**. Menus, buttons on pages and links in text all fix themselves.

Under the link you can see the page's title and its address in the language you're editing. Warnings may appear there too:

- **Not published yet: visitors see no link here until the page is published.** The link doesn't show on the website until you publish the page it points to.
- **This page no longer exists, so visitors see no link here. Pick another page.** The page it pointed to has been deleted.

That's why the admin won't let you delete a page that something still links to (see **It’s still in use** in the [Pages and blocks](pages-and-blocks.md) chapter). It tells you where the link is, and you change it there first.

You change a link with the **Change link** button and remove it with **Remove link**. You choose a page with the **Choose a page** button.

> **Watch out:** Older links that someone once typed in by hand as an address don't fix themselves. Your developer can convert them once and for all. If some of them broke after pages were moved, let them know.

## Redirects

What if someone has a page bookmarked, or finds it in a search engine, and you've renamed it? A redirect automatically sends visitors from the old address to the new one.

You'll find them in the **Redirects** section. Add a new one and fill in:

- **From**: the old address on your website, for example `/old-page`. It starts with a slash.
- **To**: where to send visitors, either a page on this website (**Choose a page**) or another website (`https://…`).
- **Permanent**: leave this ticked if the page has moved for good. Search engines will then remember the new address. Untick it only for something temporary.

A redirect works on the website **as soon as you save it**. The admin won't let you make a loop (address A to B and B back to A): it shows **Another redirect already sends visitors back here, so they would go round in a circle. Pick another address.**

> **Watch out:** Only administrators and editors can create redirects, because they take effect on the website immediately.

When you move a page in the [page tree](pages-and-blocks.md), the admin creates redirects from the old addresses by itself, if this feature is switched on for your website.

## See also

- [Pages and blocks](pages-and-blocks.md): the page tree and deleting
- [Translations](translations.md): menus in another language
- [Troubleshooting](troubleshooting.md): "A link in the menu doesn't show"
