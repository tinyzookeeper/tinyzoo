---
"tinyzoo": minor
---

The admin can take its name from the site's own content. With `cms.admin.nameFrom: 'siteSettings.siteName'` (a global and one of its text fields) the sidebar, the tab title, the sign-in pages and the emails show that field's value, read when the site runs: renaming the site in *Site settings* renames the admin, and one build can serve sites with different names. While the field is empty the admin keeps `cms.admin.name`. A site without `nameFrom` behaves as before.
