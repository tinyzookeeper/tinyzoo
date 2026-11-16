---
'tinyzoo': patch
---

Smaller editing fixes: the slug in the details panel wraps instead of being cut off; a group, list or block shows a field's problem once, on the field itself; a decimal in a whole-number field says a whole number is expected; publishing several entries from the list asks first and names them; an invitation the mail transport could not really send (`cms.mail.transport` "log") says "Invitation link for …" and shows the link (`sendCmsMail` now returns whether it was sent); removing a translation no longer toasts your own change back at you; the first item of a menu no longer offers "under the link above" (`f.boolean({ needsPrevious: true })` hides a switch on the first block of a list); the parent picker leaves out pages with no room under them; a save that changed an address says how many redirects it left (`redirects` in the save answer, `__redirects` for a translation); a redirect from the address of a live page warns in the form.
