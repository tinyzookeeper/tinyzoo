# Form messages

Where the messages visitors send from the website go, how to work with them, and how long they're kept.

When someone fills in and sends a form on the website (a contact form, for example), two things happen:

1. The people set up to receive them get an **email** with the message.
2. The message is saved in the admin. You'll find it there even if the email ends up in spam.

> The names may be different on your website. The starter website has a **Contact form** and a **Forms** settings page.

## Who gets the emails

1. Under **Settings** (or under **Content**), open **Forms**.
2. In the **Send new messages to** list, click **Add item** and type an email address. If there are several addresses, the message goes to all of them.
3. Click **Save**.

The admin explains: *Everyone here gets an email when someone sends a form on the website.* When someone leaves the organisation, remove them from this list with the **Remove** button. If the list is left empty, the address the developer set up is used. It's still a good idea to have your own address filled in here.

> **Tip:** Send messages to an address someone actually reads. A shared mailbox is best, rather than one person's own email.

## Who sees the messages

The messages contain the names, email addresses and words of the people who wrote to you: that's personal data. That's why only **administrators and editors** can see them in the admin. An **Author** doesn't have the form in the menu at all, and if they know its address, the admin tells them they don't have permission. The same goes for the list of recipients in the **Forms** settings. It also applies to **Export CSV** and to search.

If an author needs to see the messages too (someone who looks after a community, say), the developer can allow it for one form. Ask them. Who can do what in general is in the [Signing in and your account](signing-in-and-your-account.md) chapter.

## Where to find the messages

Open **Contact form** (in the menu, under **Content**). The list has all the messages. For each one you can see the name, the email address, the start of the text and its **State**:

| State | What it means |
|---|---|
| **New** | Nobody has dealt with it yet. |
| **Read** | Someone has read it. |
| **Done** | It's been answered or sorted out. |

**Who sees them.** Form messages are visitors' personal data, so only **editors and administrators** can see them. Authors don't have them in the menu and can't open or download them. If someone else needs to see them, an administrator changes their role in **Settings → Team**.

Click a message to open it. You change its state in the **State** field on the right and save. That way you can agree among yourselves who has answered what, and new things don't slip through the cracks. You can filter the messages (**Filter**) and search them (**Search…**), so you can find all the **New** ones, for example.

You **can't create a message yourself** (there's no **+** button here): messages only arrive from the website.

> **Watch out:** You reply to a message with an ordinary email from your own mailbox, to the sender's address. The admin doesn't write emails itself.

<!-- screenshot: the list of contact form messages with the State column and the values New / Read / Done -->

## Exporting to a spreadsheet

Want the messages in Excel? In the list, click **Export CSV**. A spreadsheet with all the messages downloads (the admin describes it as *Download everything here as a table (CSV) for Excel or Google Sheets*).

> **Watch out:** The file contains people's names and email addresses. That's personal data. Keep it only where it belongs, and don't pass it on. Delete it once you've finished with it. Only administrators and editors can see the export.

## Automatic deletion

Messages contain personal data, so they shouldn't be kept for ever. The developer can set them to delete themselves after a certain time. You'll then see a sentence under the list such as **Messages are deleted automatically 180 days after they arrive.** The time counts from the day the message arrived. A deleted message disappears together with its saved versions and can't be brought back.

If you don't see a sentence like that, messages don't delete themselves and stay until you remove them. How long to keep them is your organisation's decision (and depends on what you promise in your privacy policy). Ask your developer, who can set it up.

You can also delete a message yourself: open it and, in **More actions**, click **Delete…**.

## Spam

There's no need to worry about unwanted messages from bots. The form on the website protects itself in several ways you don't see: a hidden field that a person won't fill in but a bot will, a check that the form wasn't sent impossibly quickly, a limit on how many times one visitor can send it, and possibly an "are you a robot?" check from Cloudflare. If you still get spam, write to your developer.

A normal message from a person only rarely ends up in your junk mail. If you're expecting a message and it hasn't arrived, look in the list of messages in the admin. It's always there.

## See also

- [Privacy](privacy.md): what to do about data on a particular person
- [Signing in and your account](signing-in-and-your-account.md): who can do what
- [Troubleshooting](troubleshooting.md)
