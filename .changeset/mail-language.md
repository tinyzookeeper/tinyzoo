---
'tinyzoo': patch
---

Invitation and password-reset mails are written in the right language. They came out in the site's default (Czech for the playground) for anyone who had not saved a language, even with an English browser. Now: the recipient's saved language; otherwise the language of the request that caused the mail (the language chosen in the admin, else the browser's `Accept-Language`) — for an invitation that is the inviting administrator's, for a reset the person asking's; only then the site's default. The invitation now names the role ("…as an editor" / "…jako editor" / "…als Redakteur"), also when it is sent again. (The language is not stored on the invitation: a re-sent invitation uses the language of whoever re-sends it.)
