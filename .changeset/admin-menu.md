---
'tinyzoo': minor
---

The admin's menu is shorter and in an order that makes sense. The forms' messages are one row beside Home ("Messages from the website", with the forms as a row on the page), collections sit under "Content", pages, the site's globals and the media library under "Website", and everything else is behind one "Settings" row that swaps the menu for the settings' pages. A site says what comes first with `defineAdminMenu` in `cms.config.ts`, and an administrator can rearrange the menu for everyone in the admin (Settings → "Arrange the menu"). Nothing has to change in a site: without `defineAdminMenu` the rows keep the order of their names.
