---
"tinyzoo": minor
---

Experimental: the developer's side of a site's own content types (`NUXT_CMS_CUSTOM_TYPES=on`). It may change in a minor release. The guide is `docs/guide/custom-types.md`.

- **A single-site app can have them.** `NUXT_CMS_CUSTOM_TYPES=on` now works without multi-tenant mode: the site's administrators make content types in the admin, under *Settings › Content types*. A site without the switch runs as before.
- **The model file.** `tinyzoo model pull` writes a site's own types into `cms.model.json`, beside `cms.config.ts`. `tinyzoo model push` sends what you changed in the file to the site. `tinyzoo model check` is for CI: it fails when code built from the file would break. `tinyzoo model register` tells a site which file a separate frontend was built against. All four read an access token from `TINYZOO_TOKEN`.
- **Types.** `tinyzoo client` and `tinyzoo openapi` read `cms.model.json` when it is there (`--model <file>`, `--no-model`), so the generated file holds the custom types with no network. `tinyzoo client --check` fails when the generated file on disk is out of date. Without a model file the output is what it was.
- **The lock.** Code registers the model file it was built against. A single-site app does it by itself at start (`NUXT_CMS_MODEL_FILE`, `NUXT_CMS_MODEL_CODE`); a separate frontend with `tinyzoo model register`. The site then refuses a change that takes away what that code reads (`409 breaks-code`, with the registration's name), and the admin says why. An administrator can remove a registration on the *Content types* screen.
- **`NUXT_CMS_MODEL_FILE=follow`** adds to the database what the app's model file has and the database lacks, at start, and never removes anything: for a developer's own machine and a CI database.
- **Access tokens** have a new right, *Content types*, which only an administrator can give. It reads the types, changes them and registers code, at the new routes under `/api/cms/_model`. It never deletes for good.
- **Changed:** a choice field of a custom type is typed as its known values or any other text (`'a' | 'b' | (string & {})`), and the OpenAPI document names its values as examples. An administrator can add a choice at any time. Choice fields written in `cms.config.ts` are typed as before.
- **Fixed:** the dialog that makes an access token on the account page offers "Create and edit" and its three rights again.
