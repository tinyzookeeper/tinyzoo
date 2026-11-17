---
'tinyzoo': minor
---

People can change the email address they sign in with. On **Your account**, a person enters the new address and their current password; a confirmation link goes to the new address (it works for 24 hours, once) and a notice to the old one, and the change is made when the link is opened. A new password cancels a pending change, and the old address is told when the change is made. An administrator can also change someone's email in **Team** (it takes effect at once, ends their sessions and tells both addresses; for someone who has not accepted yet, the invitation goes to the new address). Both are in the audit log with the old and the new address, and **Privacy** finds and erases them by either address.

Nothing to do for a site: no migration. The emails use the mail settings and `cms.publicUrl` that invitations and password resets already need. If your privacy policy lists what the audit log keeps, add that a change of sign-in email keeps the old and the new address.
