---
'tinyzoo': major
'@tinyzoo/client': patch
---

Names that belong to tinyzoo are refused where they are written, so what tinyzoo adds in 1.x can never collide with a site's own names; and the addresses tinyzoo writes into content are frozen.

- **Field names**: like entity names, a letter first, then letters, digits and `_` (no spaces, dashes or accents). Names starting with `_` are tinyzoo's. `path`, `paths`, `breadcrumbs` and `preview` are reserved in every entity (tinyzoo writes `path` and `breadcrumbs` onto the items of a page tree and `paths` onto translated items, overwriting a field of that name; `preview` is a parameter of the content API), next to `id`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `parentId`, `locale` and `locales`.
- **Entity names**: `email` and `privacy` are reserved (admin pages), and so is every name starting with `cms`, in any case (tinyzoo's own `cms_*` tables and `Cms*` schema names).
- **Plugins**: a plugin's `contentPath` starts with `_<plugin name>` (`_shop/feed` for the plugin `shop`; the forms plugin keeps `_form`). `_tree` and `_form` join `_global`, `_search` and `_sitemap` as content API addresses no plugin may take.
- **`@tinyzoo/client`**: root members added after 1.0 start with `$`, which no collection name can, so a new member never hides a collection. `collection`, `global`, `openapi` and `search` stay as they are.
- **Frozen addresses under `/api/cms`**: `/api/cms/_media/raw/<key>` (a file's stored address, and the `src` of pictures in rich text), `/api/cms/_media/img/<id>/<width>.webp` (the smaller copies `<CmsImage>` lists in srcset, cached a year) and `/api/cms/_brand/<file>` (the logo in e-mails already sent) keep working within a major, and the widths (320, 640, 960, 1280, 1920) may only grow. The rest of `/api/cms/**` stays the admin's own API.

### Upgrade

Nothing to do unless `defineEntity` or `defineSingleton` (or `defineCmsPlugin`) now stops your site at start or at `tinyzoo generate` with a message naming the field, entity or route:

1. A field named `path`, `paths`, `breadcrumbs` or `preview`, starting with `_`, or with a character other than letters, digits and `_`: rename it in `cms.config.ts`. A rename is a migration: follow [Renaming a field](https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/upgrading.md#renaming-a-field), then run `tinyzoo generate` and `tinyzoo client`.
2. An entity named `email`, `privacy` or starting with `cms`: rename it, following [Renaming an entity](https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/upgrading.md#renaming-an-entity).
3. A plugin whose `contentPath` does not start with `_<plugin name>`: move the route there, and update the website code that calls it.
