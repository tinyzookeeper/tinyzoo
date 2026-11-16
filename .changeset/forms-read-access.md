---
'tinyzoo': minor
---

Form messages are personal data, so by default only administrators and editors can read them. Authors could list, open and export (CSV) every message of every form, and read the recipients in the Forms settings. Now `defineForm` and `defineFormSettings` (from `tinyzoo/forms`) give `read` access to administrators and editors only: the list, a message, its history, the CSV export, search and the form's entry in the admin menu are closed to authors. `defineForm('x', { access })` widens or narrows that with the usual entity rules (`read`, `update`, `delete`; a `read` of yours replaces the default), `defineFormSettings({ access })` likewise. Documented in the forms docs and in the editors' manual (`zpravy-z-formularu.md`, `prihlaseni-a-ucet.md`).

### Upgrade

If authors (or a custom role of an external sign-in) must keep reading a form's messages, say so in that form: `defineForm('contactForm', { …, access: { read: () => true } })`, or a rule that names who. Nothing else changes for administrators and editors.
