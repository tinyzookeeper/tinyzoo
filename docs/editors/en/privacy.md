# Privacy

What to do when someone asks what data you hold about them, or wants you to delete it. Only administrators can see the **Privacy** section.

People have the right to know what an organisation stores about them, to get it in a readable form, and to have it deleted. The admin has a tool for this that finds everything stored against one email address. This isn't legal advice. Ask your data protection officer or lawyer too how you should answer such requests, and by when.

## Where to find it

In the menu on the left, under **Settings**, click **Privacy**. If you can't see it, you're not an administrator. Ask a colleague who is. If you try to get there another way, it says **Only administrators can use this page.**

## What it finds

The admin searches by email address. It looks in three places:

- **Form messages**: messages that came from this address through the website (a contact form, for example).
- **Account in this administration**: if the person has an account with you (they're a colleague).
- **Activity log**: entries made by this account, entries about it (an invitation, a role change, a change of sign-in email from or to this address) and failed sign-ins with this address.

For an account, you may also see a sentence saying this address is named in a **change of sign-in email**: either someone asked to switch to this address and hasn't confirmed it yet, or it's an undo link that was sent to this address (see [Changing your email](signing-in-and-your-account.md#changing-your-email)). In the export, this is under `emailChanges`. When a record of an email change also mentions a second address that doesn't belong to this person, the export shows only "(another person’s address)" in its place.

The search doesn't look through any other text that someone has written into the website's content.

## What's stored against an address

1. Open **Privacy**.
2. Type the full **Email address** (`name@example.com`). If it isn't complete, it says **Enter a complete email address.**
3. Click **Search**.

You'll see **Stored about …**, and below it three sections with what was found. A section with nothing in it shows a sentence such as **No messages sent from this address.**, **No account with this address.** or **No entries about this address.** If there's nothing anywhere, you'll see **Nothing is stored about this address.**

<!-- screenshot: the Privacy page with the messages, account and activity log entries found, and the Export as JSON and Delete this person's data buttons -->

## Giving someone their data

When someone asks for a copy of their data:

1. Search for their address (see above).
2. Click **Export as JSON**. A file downloads with what you hold about the person. It doesn't contain passwords. You'll see **File downloaded**.
3. Give the file to the person in a secure way (through a secure message, for example, not as an ordinary attachment), and make sure it really is them asking.

## Deleting someone's data

1. Search for the email address.
2. Click **Delete this person’s data**.
3. The admin asks **Delete everything stored about …?** and lists exactly what will happen, covering only what exists:
   - **form messages are deleted for good, with their saved versions**,
   - the **account** with this address is disabled and anonymised: its name and email are removed, but what it did in the admin stays under “deleted account”,
   - in the **activity log**, the name, email and IP address are removed,
   - a waiting **change of sign-in email** to this address, or an undo link back to it, is cancelled.
4. Read it and confirm. The admin always stresses: **This cannot be undone.**
5. Once it's done, you'll see **Deleted. Nothing is stored about … any more.**

> **Watch out:** Deleting can't be undone, neither in the admin nor from the history. Check the address twice before you confirm. We recommend doing **Export as JSON** first and keeping the file somewhere safe for now, until you've made sure it really is the right person.

> **Watch out:** You can't delete **your own account**, or the last active administrator. If you want to stop using the admin yourself, ask another administrator.

## What deleting doesn't change

The admin says this openly: **Files someone uploaded and text they wrote in entries are the site’s content and stay. Backups are not touched.** In practice:

- A photo the person uploaded, and text they wrote in pages or news items, stay. If those need deleting too, do it by hand (see [Images and files](images-and-files.md) and [Pages and blocks](pages-and-blocks.md)).
- Your organisation's and your developer's **backups** contain the data that existed when the backup was made. That data disappears gradually as old backups are replaced. You can mention this in your reply to the person (and ask your developer how long backups are kept).
- An email with a copy of the message that arrived in your mailbox isn't deleted by this. Delete it yourself.

## Messages that delete themselves

Besides deleting by hand, on some websites form messages delete themselves after a while. See [Form messages](form-messages.md). The log of what happens in the admin (who signed in when, and what they did) is deleted after a year, unless your developer has set it up differently.

## See also

- [Form messages](form-messages.md)
- [Signing in and your account](signing-in-and-your-account.md): roles and invitations
- [Troubleshooting](troubleshooting.md)
