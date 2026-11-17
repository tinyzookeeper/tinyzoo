---
'tinyzoo': minor
---

**Breaking:** roles of your own and per-field permissions. `defineRoles({ translator: { from: 'editor', entities: { post: ['read', 'update'] }, publish: false, media: 'own' } })` adds a role that extends the built-in editor or author and narrows it (or, for an author, widens it) per collection, with its own `publish` setting and `media` access (`'all'`, `'own'` or `'none'`); only the built-in admin manages people, and a role can never be or extend it. `.access({ read: ['editor'], edit: ['editor', roles.translator] })` on a field says who reads and who edits it: the server leaves a field a role may not read out of every admin answer (lists, entries, history, CSV export, search results and excerpts, "used by", the schema the admin loads, the draft preview) and refuses with `403 field_forbidden` a write that names a field the role may not edit, without ever overwriting an omitted field; the admin shows such a field read-only, or not at all. A rich-text field with a rule is edited alone instead of together with others in real time. Administrators assign the new roles in Team and in invitations (with the role's own, translated name). A role removed from the config fails closed: the person signs in and sees "Your role no longer exists", gets `403 role-removed` everywhere else, is flagged in Team, and `tinyzoo status` warns. The public content API is not changed. Guide: `docs/guide/roles.md`.

### Upgrade

Nothing, if you define no roles and no field rules: a site behaves as before, and there is no migration (`cms_users.role` is a text column). To use them, see "From 0.5 to 0.6" in `docs/upgrading.md`. Three details:

1. Your own row-level `access` rules now also get `user.base`, the built-in role a person has or extends. A rule that tests `user.role === 'author'` does not see a custom role built on author: test `user.base === 'author'` once you add one.
2. An account whose stored role is not `admin`, `editor` or `author` (only possible by editing the database by hand, or after you remove a role) now has no access. Before, anything but `author` acted as an editor. `tinyzoo status` lists such accounts.
3. With `cms.auth.mode: 'external'`: on a site that defines roles, a role name from your sign-in that you did not define has no access; a site that defines none keeps the old behaviour.
