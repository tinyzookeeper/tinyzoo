---
'tinyzoo': minor
---

Translators find their work:

- **Needs translating** on the admin's home page: entries that are on the website (or scheduled) in the default language but not yet in another one, with the language and its state ("English · Not translated", "Being translated", "Draft"), newest first, each opening that language's editor. It shows only what the person may translate (their role, the collection's own rules, the fields they may edit, and for someone who may not publish, a language that is not live). People who may publish see translations someone has started in it too, with **Review**. The greeting says how many texts need translating instead of "Everything is on the website." Nothing changes on a site with one language.
- **Filter by language** in every list of translated content (the Filter panel, one choice per language: Needs translating, Not translated, Being translated, Draft, On the website), done on the server, so counts, pages and the CSV export follow it: `filter.lang:en=missing` in the admin API. "View all" on the home page opens the list filtered this way.
- Whether a language counts as translated is judged by the fields the person may read: a field hidden from them by `.access({ read })` no longer marks a row as translated in the list's Languages column.

### Upgrade

Nothing to do.
