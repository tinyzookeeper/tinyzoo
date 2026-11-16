---
'tinyzoo': patch
---

Security: a plugin route declared `access: 'admin'` could be called by any signed-in person by adding a trailing slash to its address (the router reaches the same handler; the access check compared the exact address). The check now reads the address the way the router does, supports `**` routes, and an address in a plugin's namespace that no route declares gets the strictest rule that plugin uses anywhere.
