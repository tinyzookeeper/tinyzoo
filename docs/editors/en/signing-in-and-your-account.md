# Signing in and your account

How you get into the admin for the first time, what to do about a forgotten password, how to change your email, and who can do what.

## Signing in for the first time

You get access in one of two ways.

**You got an email with an invitation.**

1. Open the email and click the link in it. The **Invitation** page opens and tells you who invited you.
2. Fill in your name and choose a password. It must be **at least 10 characters** long. The longer, the better. A few words in a row work well.
3. Click **Accept and sign in**.

> **Watch out:** The invitation link works for 7 days and can be used only once. If it has expired or was already used, you'll see **This invitation no longer works**. Ask the person who invited you to send a new one.

**You're the first person on a new website.** At `/admin` you'll see **Create the first account**. Enter your name, email and password and click **Create account**. You'll be the website's administrator, and you can then invite your colleagues yourself. On a freshly launched website, the page may ask you for a **Setup code**. The person who set up the website will give it to you or show you where to find it.

## Signing in

1. Open your website's `/admin` address, for example `https://www.your-company.com/admin`.
2. Type your **Email** and **Password**. You can check what you typed with the **Show password** button.
3. Click **Sign in**.

You stay signed in for about two weeks. After that, the admin asks you to sign in again.

> **Tip:** Bookmark the `/admin` page in your browser.

If you type the wrong password, you'll see **Wrong email or password.** If you try several times in a row, you'll see **Too many attempts. Wait a few minutes and try again.** Really, just wait a little while (about a quarter of an hour). Nothing is broken. It's a protection against people guessing passwords. Only **failed** attempts count: signing in correctly doesn't add anything.

## Forgotten password

1. On the sign-in page, click **Forgot password?**
2. Type your email and click **Send reset link**.
3. You'll get an email with a link, in the language saved in your account, or otherwise in your browser's language. The link works for **one hour**. If nothing arrives, check your spam folder.
4. Click the link, type a new password and confirm with **Save password and sign in**.

If the link has expired in the meantime, you'll see **This link no longer works**. Click **Send a new link** and try again.

> For security reasons, the admin never tells you whether the email you typed has an account. The message looks the same either way.

## Your account

At the bottom left (in the menu on a phone), open the menu with your name and choose **Your account**.

- **Profile.** Change your name here. Your colleagues see your name in the history of changes.
- **Interface language.** The admin speaks Czech, English or German. This setting only changes how the buttons and messages look. It has no effect on the language of the website your visitors see.
- **Sign-in email.** The address you sign in with. How to change it is explained just below.
- **Password.** Type your **Current password** and a **New password**, then click **Change password**. After the change, the admin signs you out on all your other devices.

The menu with your name also has **Appearance**: **Light**, **Dark** or **System**. It's only about what's comfortable for your eyes; the website your visitors see doesn't change. At the very bottom is **Sign out**.

<!-- screenshot: the menu with your name at the bottom left, with Your account, Appearance and Sign out highlighted -->

## Changing your email

You can change your sign-in email yourself on the **Your account** page, in the **Sign-in email** section.

1. Type the new address in the **New email address** field.
2. In the **Your password** field, type the password you sign in with now. That way the admin knows it's really you.
3. Click **Change email**.
4. You'll get an email at your **new** address with a **Confirm the new address** link. Click it. The **Confirm your new email** page opens, showing your new address. Click **Confirm the new address**.
5. Done. You'll see **Your email has changed**. From now on you sign in with the new address, and your password stays the same.

Until you click the link, nothing changes and you keep signing in with your **current** address. You can open the link on a computer or a phone, and you don't need to be signed in. If you open it in a browser where you're signed in, you stay signed in, just with the new address. On your other devices, the admin signs you out, and you sign in there again with the new address.

Two short emails go to your **old** address: the first right after you ask for the change, the second once the change is done. This is a safeguard: if someone else asked for the change, you'll find out and can undo it.

**Got an email about a change you didn't ask for?** It means someone knows your password. What to do depends on which email you got:

- **Your sign-in email for … is about to change** (the change isn't done yet): set a new password straight away, with the **Choose a new password** button in that email or through **Forgot password?** on the sign-in page. As long as the new address hasn't been confirmed, this cancels the change and signs everyone else out.
- **Your sign-in email for … was changed** (the change is already done): click **Undo the change** in that email. The **Take your account back** page opens. Type a new password and click **Restore the address and save the password**. Your account gets your address back, the new password applies, everyone else is signed out and you're signed in straight away. A new password is needed because whoever made the change knows the old one.

In both cases, let your administrator know afterwards.

> **Watch out:** The **Undo the change** link works for **7 days** and can be used only once. Whoever opens it gets the account back. If you changed the email yourself, you don't need to do anything with it, just don't forward it to anyone. This matters most when a colleague takes over your old mailbox after you (a work address when you leave a company, for example): it's best to delete the change notice from it. If the link has expired or was already used, you'll see **This link no longer works**, and only an administrator can help. For those 7 days, the old address stays reserved for your account: nobody else can be invited with it, and no other account can be moved to it. If someone uses the link, a short message, **Your sign-in email for … was set back**, goes to the new address. If someone has locked you out of your account this way from the old mailbox, contact your administrator. When an administrator changes the email in **Team**, the **Undo the change** links from earlier changes stop working.

**What if the email with the link doesn't arrive?**

- Wait a few minutes and check the spam folder of the new mailbox.
- The **Your account** page shows **Waiting for confirmation of …**, followed by the address the link was sent to. Check that it's right. If it isn't, type the correct address and send the request again.
- You can send the request again even if the address is right. Only the **latest** link works; the older ones stop working.
- If another account on this website already uses the address, no link arrives. Only a notice goes to that address.
- If nothing helps, ask your administrator. They can change your email in **Team** (see below).

The link works for **24 hours** and can be used only once. If it has expired, was already used, or you've asked for a different address in the meantime (or changed your password), you'll see **This link no longer works**. Ask for a new one on the **Your account** page. Changed your mind? Click **Cancel the change** and the link stops working.

## Who can do what: roles

Everyone has one role. Whoever invited you chose it. Only an administrator can change it.

| Role | What they can do |
|---|---|
| **Administrator** | Everything, including people (the **Team** section) and the **Privacy** section. |
| **Editor** | Creates, edits, publishes and deletes all content. Edits **Site settings**. Doesn't manage people. |
| **Author** | Writes drafts, and edits and deletes only what they created themselves. Doesn't publish. Can't change the site settings or content that goes on the website as soon as it's saved (**Redirects**, for example). Changes and deletes only the files they uploaded. Doesn't see **form messages** (they contain visitors' personal data) or the list of people who receive them. |

A website can also have **custom roles** (such as **Translator**): they're based on the Editor or Author role and can do whatever the website's developer set up for them. Your administrator can tell you exactly what a role can do (in **Team** they see it under **What can each role do?**). A field your role can only read has a grey background and a padlock, with a note below it saying who can change it. A field your role isn't allowed to read isn't in the form at all. There's more on this in the [Roles and permissions](roles-and-permissions.md) chapter.

If you're an **Author**, you'll see the note **An editor will publish it** where the **Publish** button would be. What to do when you need something your role doesn't allow is in [Troubleshooting](troubleshooting.md).

## Inviting colleagues (administrators only)

1. In the menu on the left, under **Settings**, open **Team**.
2. Click **Invite someone**.
3. Type their email, optionally their name, and choose a **Role**. Each role has one sentence saying what it can do, and the **What can each role do?** link shows all the roles side by side.
4. Click **Send invitation**.

Your colleague gets an email saying who is inviting them and **as what** (in which role). It's in your interface language (or your browser's language if you haven't saved one). If the email can't be sent, the admin says so and shows the **Invitation link**. Click **Copy link** and send it yourself, but only to that one person. Anyone with the link can join.

In the **Team** list you can see each person's status (**Active**, **Invited**, **Disabled**) and when they were **Last active**. Next to each name there's a menu with these options:

- **Change role** (besides the three basic roles, it also offers the roles your website defines, each with a sentence about what it can do). This **signs the person out on every device**, and they have the new role the next time they sign in. If someone's role no longer exists on the website (the developer removed it from the setup), the **Team** list shows the note **This role no longer exists**. They can still sign in, but they see nothing and get the message **Your role no longer exists**. Just give them another role. More in the [Roles and permissions](roles-and-permissions.md#for-administrators) chapter.
- **Change email**: type the new address, and in the **Your password** field type your own password (the one you sign in with). Then click **Change email**. The password is a safeguard: if someone walked away from your computer while signed in, nobody else could move another person's account to their own address. The change applies straight away, with no confirmation link. The person is signed out on every device and signs in with the new address and their usual password. An email about the change goes to both the old and the new address (the one to the old address has no undo link: the old mailbox often belongs to someone else by now, which is exactly why you're changing it). Someone whose access is **Disabled** gets nothing; they'll sign in with the new address once you restore their access. Someone who hasn't accepted their invitation yet gets a new invitation at the new address, and the old one stops working. Handy if you made a typo in the invitation.
- **Send a new invitation**
- **Cancel invitation**
- **Disable access**: the person is signed out everywhere at once and can't sign in until you give them access again with **Restore access**.
- **Remove**: they can no longer sign in to the admin. Their articles and other content stay.

> **Watch out:** The last active administrator can't be removed or disabled, so that someone can always get into the website.

Your own row in the **Team** list has no menu: you can't change your own role, and you change your own email on the **Your account** page (see [Changing your email](#changing-your-email)).

## See also

- [Pages and blocks](pages-and-blocks.md): what to do after signing in
- [Roles and permissions](roles-and-permissions.md): what each role can do, locked fields, changing a role
- [Privacy](privacy.md): another section for administrators only
- [Troubleshooting](troubleshooting.md)
