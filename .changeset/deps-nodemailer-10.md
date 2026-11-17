---
'tinyzoo': patch
---

Emails over SMTP (invitations, password resets, form notifications) are sent with nodemailer 10 (was 7). Nothing changes in your mail settings: the same `cms.mail.smtp` host, port, `secure`, user and password work as before. nodemailer 10 brings its own types, so tinyzoo no longer installs `@types/nodemailer`; if your own code imports nodemailer, it gets the types from nodemailer itself. One thing you may notice in the logs: an SMTP server that asks for a password when none is configured now fails with the error code `ENOAUTH` (was `NoAuth`).
