---
'tinyzoo': patch
---

The sign-in form (and setup, password-reset request and reset, invitation and the account's name and password forms) is a `method="post"` form. Submitted before the page had hydrated, a form without a method is a native GET: the browser put the password in the address (`/admin/login?email=…&password=…`), the history and any proxy's or server's log. Now such a submit sends its fields in the body and the page ignores them.
